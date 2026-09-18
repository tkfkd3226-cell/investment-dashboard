#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KRX 가격·성과 스냅샷·거래일 캘린더를 갱신하는 GitHub Actions용 스크립트.

운영 원칙:
- ``prices.json``·``performance_snapshots.json``·``krx_trading_calendar.json``만 갱신한다.
- ``--date``가 있으면 해당 날짜가 실제 KRX 거래일인지 확인한 뒤 그 거래일의 종목 가격·성과 스냅샷을 갱신한다.
- 이후 지정일까지 이미 저장된 날짜의 KOSPI 값은 누락·정정 여부를 확인해 backfill할 수 있다.
- ``--date``가 없으면 최신·누락·장중 재확정 대상을 자동 계산한다.
- KOSPI 지수는 pykrx → Naver → Yahoo 순서로 fallback 한다.

함수는 아래 순서로 배치한다.
설정/공통 helper → 시장 데이터 조회 → 대상일 계산 → 포트폴리오 계산 → 저장/CLI.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from pykrx import stock

# ---------------------------------------------------------------------------
# Repository paths / runtime constants
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parents[1]
PORTFOLIO_PATH = ROOT / "data" / "portfolio.json"
PRICES_PATH = ROOT / "data" / "prices.json"
SNAPSHOTS_PATH = ROOT / "data" / "performance_snapshots.json"
KRX_TRADING_CALENDAR_PATH = ROOT / "data" / "krx_trading_calendar.json"

KST = timezone(timedelta(hours=9))
DATE_FORMAT = "%Y-%m-%d"
KOSPI_INDEX_TICKER = "1001"
DEFAULT_LOOKBACK_DAYS = 7
FETCH_RETRIES = 2
FETCH_RETRY_DELAY_SECONDS = 1.5
HTTP_TIMEOUT_SECONDS = 20
HTTP_USER_AGENT = "Mozilla/5.0 (compatible; investment-dashboard/1.0)"
KRX_AFTERMARKET_START_DATE = "2026-09-14"
NAVER_MINUTE_CHART_URL = "https://api.stock.naver.com/chart/domestic/item/{ticker}/minute"
REGULAR_CLOSE_HHMM = "1530"
LEDGER_CHECK_FROM = "2026-06-18"
JS_MAX_SAFE_INTEGER = 9_007_199_254_740_991

# ---------------------------------------------------------------------------
# Time / JSON helpers
# ---------------------------------------------------------------------------

def today_kst() -> str:
    return datetime.now(KST).strftime(DATE_FORMAT)


def market_status_kst() -> str:
    now = datetime.now(KST)
    current_minutes = now.hour * 60 + now.minute
    market_open = 9 * 60
    market_close = 15 * 60 + 30
    if now.weekday() < 5 and market_open <= current_minutes < market_close:
        return "intraday"
    return "close"


def market_status_for_date(target_date: str) -> str:
    # 과거 거래일을 나중에 보충/재갱신할 때는 실행 시각이 장중이어도 종가 데이터다.
    # 장중 표시는 한국시간 오늘 날짜를 실제로 갱신하는 경우에만 사용한다.
    if target_date == today_kst():
        return market_status_kst()
    return "close"


def is_valid_date_text(value: str) -> bool:
    try:
        datetime.strptime(value, DATE_FORMAT)
        return True
    except ValueError:
        return False


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def previous_snapshot(prices: dict[str, Any], before: str | None = None):
    keys = sorted(prices.keys())
    if before:
        keys = [k for k in keys if k < before]
    if not keys:
        return None, None
    return keys[-1], prices[keys[-1]]

# ---------------------------------------------------------------------------
# Market data fetchers
# ---------------------------------------------------------------------------

_REGULAR_CLOSE_MAP_CACHE: dict[tuple[str, bool], dict[str, int]] = {}


def _coerce_positive_price(value: Any) -> int:
    """Parse a Naver/pykrx price token and require a positive integer value."""
    if isinstance(value, str):
        value = value.replace(",", "").strip()
    try:
        price = int(float(value))
    except (TypeError, ValueError):
        raise ValueError(f"invalid-price:{value!r}") from None
    if price <= 0:
        raise ValueError(f"invalid-price:{value!r}")
    return price


def _fetch_exact_regular_close_from_naver_minute(ticker: str, target_date: str):
    """Return the exact KRX 15:30 one-minute close for ``target_date``.

    Since the KRX after-market launch, end-of-day/day-candle feeds can contain
    trades after the 15:30 regular-session close.  The Naver minute endpoint
    still exposes the regular KRX session by timestamp, so only the exact
    ``YYYYMMDD153000`` row is accepted.  Missing/ambiguous rows fail closed.
    """
    date_text = target_date.replace("-", "")
    expected_timestamp = f"{date_text}{REGULAR_CLOSE_HHMM}00"
    response = requests.get(
        NAVER_MINUTE_CHART_URL.format(ticker=ticker),
        params={
            "startDateTime": f"{date_text}{REGULAR_CLOSE_HHMM}",
            "endDateTime": f"{date_text}{REGULAR_CLOSE_HHMM}",
        },
        headers={
            "User-Agent": HTTP_USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://m.stock.naver.com/",
        },
        timeout=HTTP_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise ValueError("invalid-minute-payload")

    matches: list[int] = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        if str(row.get("localDateTime") or "") != expected_timestamp:
            continue
        matches.append(_coerce_positive_price(row.get("currentPrice")))

    if not matches:
        raise ValueError("missing-exact-1530-minute-bar")
    if len(set(matches)) != 1:
        raise ValueError("conflicting-exact-1530-minute-bars")
    return target_date, matches[0]


def verified_regular_close_source(target_date: str, manual_valuation_used: bool = False) -> str:
    """Return the attested source label for a successful regular-close row."""
    if target_date >= KRX_AFTERMARKET_START_DATE:
        base = "naver_krx_1530_minute"
    else:
        base = "pykrx_pre_aftermarket"
    return f"{base}+nxt_valuation_override" if manual_valuation_used else base


def snapshot_has_verified_regular_close(target_date: str, snapshot: Any) -> bool:
    """Return whether a stored close carries the source attestation required for its date."""
    if not isinstance(snapshot, dict) or snapshot.get("display", True) is False:
        return False
    if snapshot.get("priceBasis") != "regular_close":
        return False

    source = str(snapshot.get("regularCloseSource") or "").strip()
    expected = (
        "naver_krx_1530_minute"
        if target_date >= KRX_AFTERMARKET_START_DATE
        else "pykrx_pre_aftermarket"
    )
    return source == expected or source.startswith(expected + "+")


def _fetch_regular_close_map_from_pykrx(target_date: str, is_etf: bool = False) -> dict[str, int]:
    """Return the exact-date raw KRX close map from pykrx's all-market endpoint.

    This uses a different KRX endpoint from ``get_market_ohlcv_by_date`` and is
    cached per date and asset class so one workflow run does not download the
    whole market for every holding. ETFs use their own KRX endpoint.
    """
    cache_key = (target_date, is_etf)
    cached = _REGULAR_CLOSE_MAP_CACHE.get(cache_key)
    if cached is not None:
        return cached

    getter = getattr(stock, "get_etf_ohlcv_by_ticker" if is_etf else "get_market_ohlcv_by_ticker", None)
    if getter is None:
        raise AttributeError("pykrx all-market OHLCV function is unavailable")

    date_text = target_date.replace("-", "")
    # 주식 ALL에는 ETF가 포함되지 않는다. ETF는 별도 KRX 시장 API를 쓴다.
    df = getter(date_text) if is_etf else getter(date_text, market="ALL", alternative=False)
    if df is None or df.empty:
        raise ValueError("empty-all-market-dataframe")
    if "종가" not in df.columns:
        raise ValueError("missing-close-column")

    closes: dict[str, int] = {}
    for raw_ticker, raw_close in df["종가"].items():
        try:
            close = int(raw_close)
        except (TypeError, ValueError):
            continue
        if close > 0:
            closes[str(raw_ticker).zfill(6)] = close

    if not closes:
        raise ValueError("empty-all-market-close-map")

    _REGULAR_CLOSE_MAP_CACHE[cache_key] = closes
    return closes


def _fetch_exact_close_from_pykrx_all_market(ticker: str, target_date: str, is_etf: bool = False):
    closes = _fetch_regular_close_map_from_pykrx(target_date, is_etf)
    key = str(ticker).zfill(6)
    if key not in closes:
        raise KeyError(f"ticker-not-in-all-market:{key}")
    return target_date, closes[key]


def _fetch_close_from_pykrx(
    ticker: str,
    start: datetime,
    end: datetime,
    *,
    adjusted: bool | None,
    is_etf: bool = False,
):
    kwargs = {} if adjusted is None else {"adjusted": adjusted}
    # 장중 기본 경로는 Naver이고, 장후 ETF는 주식용 raw API로 조회할 수 없다.
    getter = stock.get_market_ohlcv_by_date
    if is_etf and adjusted is False:
        getter = stock.get_etf_ohlcv_by_date
        kwargs = {}
    df = getter(
        start.strftime("%Y%m%d"),
        end.strftime("%Y%m%d"),
        ticker,
        **kwargs,
    )
    if df is None or df.empty:
        raise ValueError("empty-dataframe")

    last_idx = df.index[-1]
    actual_date = last_idx.strftime(DATE_FORMAT) if hasattr(last_idx, "strftime") else str(last_idx)[:10]
    close = int(df.iloc[-1]["종가"])
    if close <= 0 or not start.strftime(DATE_FORMAT) <= actual_date <= end.strftime(DATE_FORMAT):
        raise ValueError("invalid-price-or-source-date")
    return actual_date, close


def fetch_close(
    ticker: str,
    target_date: str,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    retries: int = FETCH_RETRIES,
    retry_delay: float = FETCH_RETRY_DELAY_SECONDS,
    *,
    is_etf: bool = False,
):
    """Return a KRX price for ``target_date`` without mixing after-market trades.

    - During today's regular session, keep the existing pykrx intraday path.
    - For closes on/after 2026-09-14 (KRX after-market launch), accept only the
      exact 15:30 Naver KRX one-minute bar.  pykrx/day-candle values are not a
      fallback because they can contain later after-market trades.
    - For older dates, the legacy raw pykrx close paths remain valid because the
      new KRX after-market did not yet exist.

    A post-cutover close that cannot be proven from the exact 15:30 minute row
    fails closed instead of silently publishing a stale or after-market price.
    """
    start = datetime.strptime(target_date, DATE_FORMAT) - timedelta(days=lookback_days)
    end = datetime.strptime(target_date, DATE_FORMAT)
    closed = market_status_for_date(target_date) == "close"
    last_error = None

    for attempt in range(retries + 1):
        errors: list[str] = []

        if closed and target_date >= KRX_AFTERMARKET_START_DATE:
            try:
                actual_date, close = _fetch_exact_regular_close_from_naver_minute(ticker, target_date)
                return actual_date, close, None
            except Exception as exc:
                errors.append(f"naver-krx-1530-minute={exc!r}")
        elif closed:
            try:
                actual_date, close = _fetch_exact_close_from_pykrx_all_market(ticker, target_date, is_etf)
                return actual_date, close, None
            except Exception as exc:
                errors.append(f"pykrx-pre-aftermarket-all-market={exc!r}")

            try:
                actual_date, close = _fetch_close_from_pykrx(
                    ticker,
                    start,
                    end,
                    adjusted=False,
                    is_etf=is_etf,
                )
                return actual_date, close, None
            except Exception as exc:
                errors.append(f"pykrx-pre-aftermarket-by-date={exc!r}")
        else:
            try:
                actual_date, close = _fetch_close_from_pykrx(
                    ticker,
                    start,
                    end,
                    adjusted=None,
                    is_etf=is_etf,
                )
                return actual_date, close, None
            except Exception as exc:
                errors.append(f"pykrx-intraday={exc!r}")

        last_error = "; ".join(errors)
        if attempt < retries:
            time.sleep(retry_delay)

    return None, None, last_error


def fetch_index_history_from_pykrx(
    start_date: str,
    end_date: str,
    ticker: str = KOSPI_INDEX_TICKER,
    retries: int = FETCH_RETRIES,
    retry_delay: float = FETCH_RETRY_DELAY_SECONDS,
):
    """Fetch KOSPI history through pykrx when the endpoint is available."""
    last_error = None
    for attempt in range(retries + 1):
        try:
            getter = getattr(stock, "get_index_ohlcv", None) or getattr(stock, "get_index_ohlcv_by_date", None)
            if getter is None:
                raise AttributeError("pykrx index OHLCV function is unavailable")
            df = getter(start_date.replace("-", ""), end_date.replace("-", ""), ticker)
            if df is None or df.empty:
                last_error = "empty-dataframe"
            else:
                values: dict[str, float] = {}
                for index, row in df.iterrows():
                    date = index.strftime(DATE_FORMAT) if hasattr(index, "strftime") else str(index)[:10]
                    close = row.get("종가")
                    if close is not None:
                        values[date] = round(float(close), 2)
                if values:
                    return values, None
                last_error = "empty-close-values"
        except Exception as exc:
            last_error = repr(exc)
        if attempt < retries:
            time.sleep(retry_delay)
    return {}, last_error


def fetch_index_history_from_naver(start_date: str, end_date: str):
    """Fallback for environments where KRX index endpoints require a login session."""
    start = datetime.strptime(start_date, DATE_FORMAT)
    today = datetime.now(KST).replace(tzinfo=None)
    calendar_days = max(1, (today - start).days)
    count = min(5000, max(180, int(calendar_days * 1.7) + 45))
    url = "https://fchart.stock.naver.com/sise.nhn"
    response = requests.get(
        url,
        params={
            "symbol": "KOSPI",
            "timeframe": "day",
            "count": count,
            "requestType": 0,
        },
        headers={"User-Agent": HTTP_USER_AGENT},
        timeout=HTTP_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    root = ET.fromstring(response.content)
    values: dict[str, float] = {}
    for item in root.findall(".//item"):
        parts = str(item.attrib.get("data", "")).split("|")
        if len(parts) < 5:
            continue
        raw_date, raw_close = parts[0], parts[4]
        if len(raw_date) != 8:
            continue
        date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        if start_date <= date <= end_date:
            values[date] = round(float(raw_close), 2)
    if not values:
        raise ValueError("Naver KOSPI chart returned no values in requested range")
    return values


def fetch_index_history_from_yahoo(start_date: str, end_date: str):
    """Fallback using Yahoo Finance chart data for the KOSPI composite index (^KS11)."""
    start_dt = datetime.strptime(start_date, DATE_FORMAT).replace(tzinfo=KST)
    # Yahoo period2 is exclusive, so include the full end date plus one extra day.
    end_dt = (datetime.strptime(end_date, DATE_FORMAT) + timedelta(days=1)).replace(tzinfo=KST)

    response = requests.get(
        "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11",
        params={
            "period1": int(start_dt.timestamp()),
            "period2": int(end_dt.timestamp()),
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true",
        },
        headers={
            "User-Agent": HTTP_USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
        },
        timeout=HTTP_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    chart = payload.get("chart") or {}
    if chart.get("error"):
        raise ValueError(f"Yahoo chart error: {chart['error']}")

    results = chart.get("result") or []
    if not results:
        raise ValueError("Yahoo KOSPI chart returned no result")

    result = results[0]
    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    quotes = indicators.get("quote") or []
    closes = quotes[0].get("close") if quotes else []
    closes = closes or []

    values: dict[str, float] = {}
    for timestamp, close in zip(timestamps, closes):
        if timestamp is None or close is None:
            continue
        date = datetime.fromtimestamp(int(timestamp), KST).strftime(DATE_FORMAT)
        if start_date <= date <= end_date:
            values[date] = round(float(close), 2)

    if not values:
        raise ValueError("Yahoo KOSPI chart returned no values in requested range")
    return values


def fetch_index_history(start_date: str, end_date: str, ticker: str = KOSPI_INDEX_TICKER):
    """Fetch KOSPI history with a deterministic fallback chain.

    Source priority is pykrx → Naver fchart → Yahoo Finance.  The fallback is
    intentionally kept here so the workflow does not silently lose KOSPI data
    when a single upstream endpoint changes or requires a session.
    """
    errors: list[str] = []

    values, pykrx_error = fetch_index_history_from_pykrx(start_date, end_date, ticker)
    if values:
        print(f"KOSPI source=pykrx rows={len(values)}")
        return values, None
    errors.append(f"pykrx={pykrx_error}")

    try:
        values = fetch_index_history_from_naver(start_date, end_date)
        print(f"KOSPI source=naver-fchart rows={len(values)}; pykrx failed: {pykrx_error}")
        return values, None
    except Exception as naver_exc:
        errors.append(f"naver={naver_exc!r}")

    try:
        values = fetch_index_history_from_yahoo(start_date, end_date)
        print(f"KOSPI source=yahoo-ks11 rows={len(values)}; earlier sources failed")
        return values, None
    except Exception as yahoo_exc:
        errors.append(f"yahoo={yahoo_exc!r}")

    return {}, "; ".join(errors)


# ---------------------------------------------------------------------------
# KOSPI backfill
# ---------------------------------------------------------------------------

def dashboard_history_start_date(prices: dict[str, Any], snapshots: dict[str, Any], through_date: str) -> str | None:
    stored_dates = sorted({
        date for date in [*prices.keys(), *snapshots.keys()]
        if is_valid_date_text(date) and date <= through_date
    })
    if not stored_dates:
        return None
    return stored_dates[0]


def fetch_dashboard_kospi_history(
    prices: dict[str, Any], snapshots: dict[str, Any], through_date: str
) -> dict[str, float]:
    start_date = dashboard_history_start_date(prices, snapshots, through_date)
    if not start_date:
        return {}

    history, error = fetch_index_history(start_date, through_date)
    if not history:
        # Do not silently report a successful workflow when the chart data was not written.
        raise RuntimeError(f"KOSPI index backfill failed: {error}")
    return history


def backfill_kospi_index(
    prices: dict[str, Any], snapshots: dict[str, Any], history: dict[str, float]
) -> list[str]:
    if not history:
        return []

    changed: list[str] = []
    for date, close in history.items():
        touched = False
        if date in snapshots and float(snapshots[date].get("kospi", 0) or 0) != close:
            snapshots[date]["kospi"] = close
            touched = True
        if date in prices:
            indices = prices[date].setdefault("indices", {})
            if float(indices.get("KOSPI", 0) or 0) != close:
                indices["KOSPI"] = close
                touched = True
        if touched:
            changed.append(date)

    if changed:
        print(f"updated KOSPI index for {len(changed)} stored dates ({changed[0]} ~ {changed[-1]})")
    return changed


def build_krx_trading_calendar(
    prices: dict[str, Any], snapshots: dict[str, Any], history: dict[str, float]
) -> dict[str, Any]:
    """Build the dashboard market calendar from proven KOSPI/price trading dates.

    KOSPI history is the canonical historical calendar.  A visible current-day
    price row is also accepted because the stock quote can prove today's session
    before the KOSPI daily series is published.  ``through`` stops at the latest
    proven trading date, so a pre-open weekday is never mislabelled as a holiday.
    """
    history_dates = {
        date for date in history
        if is_valid_date_text(date)
    }
    known_dates = set(history_dates)

    # KRX 거래일 캘린더의 확정 구간과 범위 밖 보완 데이터를 분리한다.
    # KOSPI 이력이 제공된 구간은 그 날짜 집합 자체가 확정 캘린더다.
    # prices/snapshots의 잘못된 과거 행이 휴장일을 거래일로 되살리지 못하게 하고,
    # KOSPI 일봉이 아직 게시되지 않은 오늘처럼 이력 범위 밖의 날짜만 보완한다.
    if history_dates:
        history_first, history_last = min(history_dates), max(history_dates)

        def outside_history_range(date: str) -> bool:
            return date < history_first or date > history_last

        known_dates.update(
            date for date, row in prices.items()
            if is_valid_date_text(date)
            and isinstance(row, dict)
            and row.get("display", True) is not False
            and outside_history_range(date)
        )
        known_dates.update(
            date for date in snapshots
            if is_valid_date_text(date)
            and outside_history_range(date)
        )

        if KRX_TRADING_CALENDAR_PATH.exists():
            try:
                existing_calendar = load_json(KRX_TRADING_CALENDAR_PATH)
            except (OSError, ValueError, TypeError, json.JSONDecodeError):
                existing_calendar = {}
            known_dates.update(
                str(date) for date in existing_calendar.get("tradingDates", [])
                if is_valid_date_text(str(date))
                and outside_history_range(str(date))
            )
    else:
        # 저장 데이터만 있는 초기/격리 호출에서는 기존 동작을 보존한다.
        known_dates.update(
            date for date, row in prices.items()
            if is_valid_date_text(date)
            and isinstance(row, dict)
            and row.get("display", True) is not False
        )
        known_dates.update(
            date for date in snapshots
            if is_valid_date_text(date)
        )
    trading_dates = sorted(known_dates)
    return {
        "from": trading_dates[0] if trading_dates else "",
        "through": trading_dates[-1] if trading_dates else "",
        "generatedAtKST": datetime.now(KST).isoformat(timespec="seconds"),
        "tradingDates": trading_dates,
    }


def trading_calendar_changed(calendar: dict[str, Any]) -> bool:
    if not KRX_TRADING_CALENDAR_PATH.exists():
        return True
    try:
        current = load_json(KRX_TRADING_CALENDAR_PATH)
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return True
    # generatedAtKST is provenance metadata, not a reason to create a commit by itself.
    comparable = {key: value for key, value in calendar.items() if key != "generatedAtKST"}
    current_comparable = {key: value for key, value in current.items() if key != "generatedAtKST"}
    return current_comparable != comparable


# ---------------------------------------------------------------------------
# Target-date resolution
# ---------------------------------------------------------------------------

def date_range(start_date: str, end_date: str) -> list[str]:
    start = datetime.strptime(start_date, DATE_FORMAT)
    end = datetime.strptime(end_date, DATE_FORMAT)
    dates: list[str] = []

    current = start
    while current <= end:
        dates.append(current.strftime(DATE_FORMAT))
        current += timedelta(days=1)

    return dates


def visible_price_dates(prices: dict[str, Any]) -> list[str]:
    """Return stored dashboard dates that are valid and visible."""
    return sorted(
        date
        for date, snapshot in prices.items()
        if is_valid_date_text(date)
        and isinstance(snapshot, dict)
        and snapshot.get("display", True) is not False
    )


def latest_price_date(prices: dict[str, Any]) -> str | None:
    dates = visible_price_dates(prices)
    return dates[-1] if dates else None


def first_security_ticker(portfolio: dict[str, Any]) -> str | None:
    for item in portfolio.get("securities", []):
        ticker = item.get("ticker")
        if ticker:
            return str(ticker)
    return None


def probe_trading_date(portfolio: dict[str, Any], target_date: str):
    ticker = first_security_ticker(portfolio)
    if not ticker:
        return None, None, "portfolio has no securities ticker"
    item = next(item for item in portfolio["securities"] if str(item.get("ticker")) == ticker)
    return fetch_close(ticker, target_date, is_etf=item.get("type") == "ETF")


def resolve_latest_market_date(portfolio: dict[str, Any], target_date: str) -> str | None:
    """Resolve the latest available trading date without publishing a stale close.

    Post-aftermarket close lookup is exact-date/fail-closed, so weekends, holidays
    and pre-open runs probe backward one calendar day at a time instead of asking a
    price source to silently substitute the previous session.
    """
    ticker = first_security_ticker(portfolio)
    target = datetime.strptime(target_date, DATE_FORMAT)
    errors: list[str] = []

    for offset in range(DEFAULT_LOOKBACK_DAYS + 1):
        candidate_dt = target - timedelta(days=offset)
        if candidate_dt.weekday() >= 5:
            continue
        candidate = candidate_dt.strftime(DATE_FORMAT)
        actual, close, err = probe_trading_date(portfolio, candidate)
        if actual == candidate and close is not None:
            return candidate
        if err:
            errors.append(f"{candidate}:{err}")

    detail = " | ".join(errors[-3:]) if errors else "no candidate returned a price"
    print(f"WARN latest market date lookup failed for {ticker or '-'} {target_date}: {detail}")
    return None


def resolve_missing_trading_dates(candidates: list[str], latest_market: str) -> list[str]:
    """Resolve missing weekdays from KOSPI date presence, not retained minute bars.

    A missing historical stock close may no longer have a retrievable 15:30 minute
    bar.  Treating that lookup failure as "not a trading day" can silently turn a
    real gap into a successful no-op.  KOSPI history is used only as a market
    calendar here: if the calendar source itself is unavailable or does not cover
    the already-proven latest market date, fail closed.  Actual price publication
    still goes through ``fetch_close`` and therefore keeps the exact-15:30 rule.
    """
    if not candidates:
        return []

    history, error = fetch_index_history(candidates[0], latest_market)
    if not history or latest_market not in history:
        detail = error or f"latest market date {latest_market} missing from KOSPI history"
        raise RuntimeError(
            "KRX 누락 거래일 달력 조회 실패: 실제 거래일 누락을 휴장일로 오인하지 않도록 "
            f"가격 갱신 없이 중단합니다. ({detail})"
        )

    return [date for date in candidates if date in history]


def resolve_target_dates(portfolio: dict[str, Any], prices: dict[str, Any], explicit_date: str | None) -> list[str]:
    """Resolve explicit or automatic KRX refresh dates.

    Automatic mode includes missing trading dates and snapshots that still need
    intraday/closing-price reconfirmation.
    """
    if explicit_date:
        return [explicit_date]

    latest_saved = latest_price_date(prices)
    latest_market = resolve_latest_market_date(portfolio, today_kst())

    if not latest_market:
        raise RuntimeError("KRX 최신 거래일 조회 실패: 가격 갱신 없이 성공 처리하지 않습니다.")

    if not latest_saved:
        return [latest_market]

    # 가장 최근 저장일이 아직 종가로 확정되지 않은 상태(intraday)라면,
    # 이미 prices에 존재하더라도 다시 갱신 대상에 포함시켜서
    # 장중 재요청 시 최신가로 갱신하거나, 마감 후 요청 시 종가로 확정되게 한다.
    # 저장 시점이 장중이었던 과거 날짜가 남아 있으면 최신 저장일이 아니어도
    # 다시 갱신한다. 예: 다음 거래일 장중에 누락된 전 거래일을 보충한 경우,
    # 전 거래일은 종가로 확정해야 한다.
    refresh_dates = [
        date
        for date, snapshot in prices.items()
        if is_valid_date_text(date)
        and isinstance(snapshot, dict)
        and snapshot.get("display", True) is not False
        and snapshot.get("marketStatus") == "intraday"
    ]
    latest_snapshot = prices.get(latest_saved) or {}
    current_market_status = market_status_kst()

    if latest_snapshot.get("marketStatus") == "intraday" and latest_saved not in refresh_dates:
        refresh_dates.append(latest_saved)
    elif latest_saved == latest_market and latest_saved == today_kst() and current_market_status == "close":
        # 같은 날 장마감 후 자동 실행 시, 오전/장중에 만들어진 스냅샷이
        # 이미 close로 표시되어 있어도 한 번 더 갱신할 수 있게 한다.
        refresh_dates.append(latest_saved)

    stored_dates = visible_price_dates(prices)
    first_saved = stored_dates[0] if stored_dates else latest_saved

    # 최신 저장일 이후뿐 아니라 저장 구간 내부의 누락도 함께 확인한다.
    # 주말은 사전 제외하고, 공휴일/실제 거래일 여부만 KRX 데이터로 확인한다.
    candidates = [
        date
        for date in date_range(first_saved, latest_market)
        if date not in prices
        and datetime.strptime(date, DATE_FORMAT).weekday() < 5
    ]
    if latest_market == today_kst() and current_market_status == "intraday":
        # 종목 현재가로 이미 확인된 오늘 거래일은 KOSPI 일봉 게시를 기다리지 않는다.
        # 장초반에는 종목 조회가 오늘을 반환해도 지수 일봉은 전 거래일까지일 수 있다.
        missing_dates = [latest_market] if latest_market in candidates else []
        historical_candidates = [date for date in candidates if date < latest_market]
        if historical_candidates:
            previous_day = (
                datetime.strptime(latest_market, DATE_FORMAT) - timedelta(days=1)
            ).strftime(DATE_FORMAT)
            previous_market = resolve_latest_market_date(portfolio, previous_day)
            if not previous_market:
                raise RuntimeError(
                    "KRX 누락 거래일 달력 조회 실패: 직전 거래일을 확인하지 못해 "
                    "가격 갱신 없이 중단합니다."
                )
            # 과거 누락은 별도로 검증한다. 단순히 오늘을 history에 추가하면
            # 오래된/불완전한 달력까지 정상으로 간주할 수 있으므로 하지 않는다.
            historical_candidates = [date for date in historical_candidates if date <= previous_market]
            missing_dates.extend(resolve_missing_trading_dates(historical_candidates, previous_market))
    else:
        missing_dates = resolve_missing_trading_dates(candidates, latest_market)

    # A prior local run can leave a hidden, warning-bearing snapshot behind.
    # It is not selectable, so retry it automatically instead of treating the
    # mere presence of its JSON key as a completed market-date update.
    retry_dates = [
        date
        for date, snapshot in prices.items()
        if is_valid_date_text(date)
        and isinstance(snapshot, dict)
        and snapshot.get("display", True) is False
        and snapshot.get("warnings")
        and date <= latest_market
    ]

    # KRX after-market 도입 이후에는 priceBasis 라벨만으로 정규장 종가를
    # 신뢰하지 않는다. 과거 버전이 남긴 regular_close 행 중 exact 15:30
    # source attestation이 없는 날짜를 자동 대상에 포함해 한 번 재확정한다.
    # 검증 source가 기록된 뒤에는 이 목록에서 빠지므로 자동 실행이 수렴한다.
    reconfirm_dates = [
        date
        for date, snapshot in prices.items()
        if is_valid_date_text(date)
        and KRX_AFTERMARKET_START_DATE <= date <= latest_market
        and isinstance(snapshot, dict)
        and snapshot.get("display", True) is not False
        and snapshot.get("priceBasis") == "regular_close"
        and not snapshot_has_verified_regular_close(date, snapshot)
    ]

    return sorted(set(refresh_dates + missing_dates + retry_dates + reconfirm_dates))


# ---------------------------------------------------------------------------
# Portfolio state / performance calculation
# ---------------------------------------------------------------------------

def symbol_key(name: str) -> str:
    return "KODEX200" if name == "KODEX 200" else name


def security_events(portfolio: dict[str, Any]) -> list[dict[str, Any]]:
    events = portfolio.get("securitiesEvents", [])
    return events if isinstance(events, list) else []


def security_valuation_override(portfolio: dict[str, Any], ticker: str, target_date: str) -> int | None:
    for event in security_events(portfolio):
        if str(event.get("ticker", "")) != str(ticker) or str(event.get("date", "")) != target_date:
            continue
        value = int(event.get("valuationPrice", 0) or 0)
        if value > 0:
            return value
    return None


def security_safe_aggregate(label: str, value: int | float) -> int | float:
    if not isinstance(value, (int, float)) or not math.isfinite(value) or abs(value) > JS_MAX_SAFE_INTEGER:
        raise ValueError(f"{label} 계산값이 JavaScript 안전 정수 범위를 벗어납니다.")
    return value


def security_optional_number(event: dict[str, Any], key: str) -> int | None:
    value = event.get(key)
    if value is None:
        return None
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{event.get('id') or event.get('ticker') or '증권 거래'} {key} 값이 숫자가 아닙니다.") from exc
    return number


def security_sell_realized_profit(event: dict[str, Any]) -> int:
    amount = max(0, int(event.get("amount", 0) or 0))
    cost_basis = max(0, int(event.get("costBasis", 0) or 0))
    gross = security_optional_number(event, "grossAmount")
    transaction_cost = security_optional_number(event, "transactionCost")
    explicit = security_optional_number(event, "realizedProfit")
    identity = str(event.get("id") or event.get("ticker") or "증권 매도")

    if gross is not None and transaction_cost is not None and gross - transaction_cost != amount:
        raise ValueError(f"{identity} 순매도대금이 총매도금액-거래비용과 일치하지 않습니다.")

    derived = int(security_safe_aggregate("실현손익", amount - cost_basis))
    if explicit is not None and explicit != derived:
        raise ValueError(f"{identity} 실현손익이 순매도대금-기준원가와 일치하지 않습니다.")
    return explicit if explicit is not None else derived


def security_cash_principal_delta(event: dict[str, Any]) -> int:
    explicit = security_optional_number(event, "cashPrincipalDelta")
    if explicit is not None:
        return explicit
    if str(event.get("type", "")) == "sell":
        return max(0, int(event.get("costBasis", 0) or 0))
    return 0


def is_internal_cash_return(event: dict[str, Any]) -> bool:
    return str(event.get("type", "")) == "withdrawal" and str(event.get("fundingClass", "")) == "internalCashReturn"


def security_withdrawal_principal_amount(event: dict[str, Any]) -> int:
    if str(event.get("type", "")) != "withdrawal":
        return 0
    explicit = security_optional_number(event, "principalAmount")
    if explicit is not None:
        return max(0, int(explicit))
    cash_delta = security_optional_number(event, "cashPrincipalDelta")
    if cash_delta is not None and cash_delta < 0:
        return abs(int(cash_delta))
    return max(0, int(event.get("amount", 0) or 0))


def security_has_trade_on_date(portfolio: dict[str, Any], ticker: str, target_date: str) -> bool:
    return any(
        str(event.get("type", "")) in {"buy", "sell"}
        and str(event.get("ticker", "")) == str(ticker)
        and str(event.get("date", "")) == target_date
        for event in security_events(portfolio)
    )


def security_cash_principal_for_date(target_date: str, portfolio: dict[str, Any]) -> int:
    daily_deltas: dict[str, int] = {}
    for event in security_events(portfolio):
        date = str(event.get("date", ""))
        if date > target_date:
            continue
        daily_deltas[date] = int(security_safe_aggregate(
            "증권 일별 현금화 원금 변동",
            daily_deltas.get(date, 0) + security_cash_principal_delta(event),
        ))

    principal = 0
    for date in sorted(daily_deltas):
        principal = int(security_safe_aggregate(
            "증권 현금화 원금",
            principal + daily_deltas[date],
        ))
        if principal < 0:
            raise ValueError(f"{date or '증권 거래'} 처리 후 현금화 원금이 음수가 됩니다.")
    return principal


def security_position_state(item: dict[str, Any], target_date: str, portfolio: dict[str, Any]) -> dict[str, int | float]:
    qty = float(item.get("qty", 0) or 0)
    cost = int(item.get("cost", 0) or 0)
    ticker = str(item.get("ticker", ""))

    later = sorted(
        (event for event in security_events(portfolio)
         if str(event.get("ticker", "")) == ticker and str(event.get("date", "")) > target_date),
        key=lambda event: str(event.get("date", "")),
        reverse=True,
    )
    for event in later:
        event_qty = max(0.0, float(event.get("qty", 0) or 0))
        amount = max(0, int(event.get("amount", 0) or 0))
        event_type = str(event.get("type", ""))
        if event_type == "buy":
            qty = float(security_safe_aggregate("보유 수량", qty - event_qty))
            cost = int(security_safe_aggregate("취득원가", cost - amount))
        elif event_type == "sell":
            qty = float(security_safe_aggregate("보유 수량", qty + event_qty))
            cost = int(security_safe_aggregate("취득원가", cost + max(0, int(event.get("costBasis", 0) or 0))))

    realized_profit = 0
    realized_cost_basis = 0
    for event in security_events(portfolio):
        if (
            str(event.get("type", "")) != "sell"
            or str(event.get("ticker", "")) != ticker
            or str(event.get("date", "")) > target_date
        ):
            continue
        realized_profit = int(security_safe_aggregate(
            "실현손익", realized_profit + security_sell_realized_profit(event)
        ))
        realized_cost_basis = int(security_safe_aggregate(
            "실현 기준원가", realized_cost_basis + max(0, int(event.get("costBasis", 0) or 0))
        ))

    return {
        "qty": max(0.0, qty),
        "cost": max(0, cost),
        "realizedProfit": realized_profit,
        "realizedCostBasis": realized_cost_basis,
    }


def securities_cash_for_date(
    target_date: str,
    portfolio: dict[str, Any],
    snapshots: dict[str, Any] | None = None,
) -> int:
    if isinstance(snapshots, dict):
        saved_dates = sorted(
            date for date, item in snapshots.items()
            if isinstance(date, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) and isinstance(item, dict)
        )
        has_sell_event = any(
            str(event.get("type", "")) == "sell" and str(event.get("date", "")) == target_date
            for event in security_events(portfolio)
        )
        if saved_dates and target_date < saved_dates[-1] and not has_sell_event:
            allocation = snapshots.get(target_date, {}).get("allocation", {})
            saved_cash = allocation.get("현금") if isinstance(allocation, dict) else None
            if saved_cash is not None:
                return int(saved_cash)

    cash = int(portfolio.get("constants", {}).get("securitiesCash", 0) or 0)
    for event in security_events(portfolio):
        if str(event.get("date", "")) <= target_date:
            continue
        amount = max(0, int(event.get("amount", 0) or 0))
        event_type = str(event.get("type", ""))
        if event_type in {"contribution", "sell"}:
            cash -= amount
        elif event_type in {"withdrawal", "buy"}:
            cash += amount
    return cash


def account1_source_principal_for_date(target_date: str, portfolio: dict[str, Any]) -> int:
    principal = int(portfolio.get("constants", {}).get("account1Principal", 0) or 0)
    for event in security_events(portfolio):
        if str(event.get("date", "")) <= target_date:
            continue
        amount = max(0, int(event.get("amount", 0) or 0))
        if event.get("type") == "contribution":
            principal -= amount
        elif event.get("type") == "withdrawal":
            principal += security_withdrawal_principal_amount(event)
    return principal


def securities_holding_cost_for_date(target_date: str, portfolio: dict[str, Any]) -> int:
    return sum(
        int(security_position_state(item, target_date, portfolio)["cost"])
        for item in portfolio.get("securities", [])
    )


def account1_principal_for_date(target_date: str, portfolio: dict[str, Any]) -> int:
    if target_date >= LEDGER_CHECK_FROM:
        return securities_holding_cost_for_date(target_date, portfolio) + security_cash_principal_for_date(target_date, portfolio)
    return account1_source_principal_for_date(target_date, portfolio)

def is_symbol_chart_target(item: dict[str, Any], target_date: str, portfolio: dict[str, Any] | None = None) -> bool:
    if item.get("chart") is False:
        return False
    chart_from = str(item.get("chartFrom", "") or "")
    if chart_from and target_date < chart_from:
        return False
    if portfolio is None:
        return True
    state = security_position_state(item, target_date, portfolio)
    return float(state["qty"]) > 0 or security_has_trade_on_date(portfolio, str(item.get("ticker", "")), target_date)


def init_security_symbols(portfolio: dict[str, Any], target_date: str) -> dict[str, int]:
    symbols: dict[str, int] = {}
    for item in portfolio.get("securities", []):
        if not is_symbol_chart_target(item, target_date, portfolio):
            continue
        name = item.get("name")
        if not name:
            continue
        symbols.setdefault(symbol_key(str(name)), 0)
    return symbols


def calculate_performance_snapshot(
    target_date: str,
    portfolio: dict[str, Any],
    prices: dict[str, Any],
    snapshots: dict[str, Any],
) -> dict[str, Any]:
    """Build the performance snapshot corresponding to one price snapshot."""
    price_snapshot = prices[target_date]
    securities_prices = price_snapshot.get("securities", {})

    raw_holding_profit = 0
    symbols = init_security_symbols(portfolio, target_date)
    allocation = {"ETF": 0, "개별주식": 0, "현금": securities_cash_for_date(target_date, portfolio, snapshots)}

    for item in portfolio["securities"]:
        ticker = item["ticker"]
        market_price = int(securities_prices.get(ticker, 0))
        state = security_position_state(item, target_date, portfolio)
        qty = float(state["qty"])
        cost = int(state["cost"])
        realized_profit = int(state["realizedProfit"])
        chart_from = str(item.get("chartFrom", "") or "")
        post_close_pending = bool(
            chart_from
            and target_date < chart_from
            and any(
                str(event.get("type", "")) == "buy"
                and str(event.get("ticker", "")) == str(ticker)
                and str(event.get("date", "")) == target_date
                for event in security_events(portfolio)
            )
        )
        price = int(round(cost / qty)) if post_close_pending and qty else market_price
        eval_amount = cost if post_close_pending else int(round(price * qty))
        profit = 0 if post_close_pending else eval_amount - cost
        total_profit = int(security_safe_aggregate("종목 누적손익", profit + realized_profit))
        # 가격 조회/차트에서 제외된 전량매도 종목도 확정 실현손익은 계좌 성과에 남는다.
        raw_holding_profit = int(security_safe_aggregate("증권 누적손익", raw_holding_profit + total_profit))

        if item.get("type") == "ETF":
            allocation["ETF"] += eval_amount
        else:
            allocation["개별주식"] += eval_amount

        if is_symbol_chart_target(item, target_date, portfolio):
            name = item["name"]
            key = symbol_key(str(name))
            symbols[key] = total_profit

    prev_keys = [k for k in sorted(snapshots.keys()) if k < target_date]
    prev_raw = int(snapshots[prev_keys[-1]].get("rawHoldingProfit", 0)) if prev_keys else 0
    daily_profit = raw_holding_profit - prev_raw

    account1_principal = account1_principal_for_date(target_date, portfolio)
    cumulative_return = raw_holding_profit / account1_principal * 100 if account1_principal else 0

    return {
        "display": price_snapshot.get("display", True),
        "source": "calculated-current-portfolio",
        "marketStatus": price_snapshot.get("marketStatus", "close"),
        "priceBasis": price_snapshot.get("priceBasis"),
        "requestedDate": price_snapshot.get("requestedDate", target_date),
        "actualMarketDate": price_snapshot.get("actualMarketDate", target_date),
        "updatedAtKST": price_snapshot.get("updatedAtKST"),
        "rawHoldingProfit": raw_holding_profit,
        "cumulativeReturn": cumulative_return,
        "dailyProfit": daily_profit,
        "symbols": symbols,
        "allocation": allocation,
    }


def reconcile_next_daily_profit(target_date: str, snapshots: dict[str, Any]) -> str | None:
    """Repair the first forward daily-profit dependency after ``target_date``.

    ``dailyProfit`` is the only performance field whose value depends on the
    immediately preceding stored performance snapshot.  When a historical date
    is inserted or its ``rawHoldingProfit`` is corrected, the next existing
    snapshot must therefore be rebased as well.  Later snapshots do not need a
    cascade because their predecessor's ``rawHoldingProfit`` is unchanged.
    """
    current = snapshots.get(target_date)
    if not isinstance(current, dict):
        return None

    next_dates = sorted(
        date
        for date, snapshot in snapshots.items()
        if date > target_date and is_valid_date_text(date) and isinstance(snapshot, dict)
    )
    if not next_dates:
        return None

    next_date = next_dates[0]
    next_snapshot = snapshots[next_date]
    expected = int(next_snapshot.get("rawHoldingProfit", 0) or 0) - int(current.get("rawHoldingProfit", 0) or 0)
    actual = int(next_snapshot.get("dailyProfit", 0) or 0)

    if actual == expected:
        return None

    next_snapshot["dailyProfit"] = expected
    print(
        "reconciled forward dailyProfit dependency "
        f"for {next_date} after {target_date}: {actual} -> {expected}"
    )
    return next_date


# ---------------------------------------------------------------------------
# Per-date update / persistence
# ---------------------------------------------------------------------------

def update_one_date(
    target_date: str,
    portfolio: dict[str, Any],
    prices: dict[str, Any],
    snapshots: dict[str, Any],
    force_display: bool = False,
    no_display: bool = False,
    _session_retry: bool = False,
) -> list[str]:
    """Fetch one date, update prices, then rebuild its performance snapshot."""
    prev_key, prev = previous_snapshot(prices, before=target_date)
    securities, pension, warnings, source_dates = {}, {}, [], {}
    status = market_status_for_date(target_date)

    manual_valuation_used = False
    for item in portfolio["securities"]:
        ticker = item["ticker"]
        valuation_override = security_valuation_override(portfolio, ticker, target_date)
        if valuation_override is not None:
            securities[ticker] = int(valuation_override)
            source_dates[f"SEC:{ticker}"] = target_date
            manual_valuation_used = True
            continue

        if float(security_position_state(item, target_date, portfolio)["qty"]) <= 0 and not security_has_trade_on_date(portfolio, ticker, target_date):
            continue

        actual, close, err = fetch_close(ticker, target_date, is_etf=item.get("type") == "ETF")

        actual_date = str(actual or target_date)
        if close is None:
            fallback = prev.get("securities", {}).get(ticker) if prev else None

            if fallback is None:
                warnings.append(f"SEC {ticker}: 조회 실패 및 직전값 없음: {err}")
                continue

            securities[ticker] = int(fallback)
            warnings.append(f"SEC {ticker}: 조회 실패, 직전 스냅샷 {prev_key} 값 {fallback} 사용: {err}")
            source_dates[f"SEC:{ticker}"] = str(prev.get("priceSourceDates", {}).get(f"SEC:{ticker}") or prev.get("actualMarketDate") or prev_key)
        else:
            securities[ticker] = int(close)
            source_dates[f"SEC:{ticker}"] = actual_date
            if actual_date != target_date:
                warnings.append(f"SEC {ticker}: {target_date} 종가를 확인하지 못해 {actual_date} 종가를 보류값으로 저장했습니다.")

    for item in portfolio["pension"]:
        ticker = item["ticker"]
        actual, close, err = fetch_close(ticker, target_date, is_etf=True)

        actual_date = str(actual or target_date)
        if close is None:
            fallback = prev.get("pension", {}).get(ticker) if prev else None

            if fallback is None:
                warnings.append(f"PEN {ticker}: 조회 실패 및 직전값 없음: {err}")
                continue

            pension[ticker] = int(fallback)
            warnings.append(f"PEN {ticker}: 조회 실패, 직전 스냅샷 {prev_key} 값 {fallback} 사용: {err}")
            source_dates[f"PEN:{ticker}"] = str(prev.get("priceSourceDates", {}).get(f"PEN:{ticker}") or prev.get("actualMarketDate") or prev_key)
        else:
            pension[ticker] = int(close)
            source_dates[f"PEN:{ticker}"] = actual_date
            if actual_date != target_date:
                warnings.append(f"PEN {ticker}: {target_date} 종가를 확인하지 못해 {actual_date} 종가를 보류값으로 저장했습니다.")

    pension["cash"] = int(prev.get("pension", {}).get("cash", 0)) if prev else 0
    actual_date = min(source_dates.values()) if source_dates else target_date

    # A date with any stale/missing symbol must not become a selectable dashboard close.
    display = not warnings

    if no_display:
        display = False

    if force_display and not warnings:
        display = True

    # 여러 종목을 읽는 중 15:30을 넘으면 장중 값을 종가로 표시하지 않고 전부 재조회한다.
    if status != market_status_for_date(target_date):
        if _session_retry:
            raise RuntimeError("KRX 조회 중 거래 세션이 다시 변경되었습니다. 재갱신이 필요합니다.")
        return update_one_date(target_date, portfolio, prices, snapshots,
                               force_display, no_display, _session_retry=True)
    price_basis = "intraday" if status == "intraday" else "regular_close"
    updated_at = datetime.now(KST).isoformat(timespec="seconds")

    prices[target_date] = {
        "display": display,
        "source": "krx-github-actions+nxt-valuation" if manual_valuation_used else "krx-github-actions",
        "marketStatus": status,
        "priceBasis": price_basis,
        **({
            "regularCloseSource": verified_regular_close_source(target_date, manual_valuation_used),
        } if status == "close" and not warnings else {}),
        "requestedDate": target_date,
        "actualMarketDate": actual_date,
        "updatedAtKST": updated_at,
        "priceSourceDates": source_dates,
        "securities": securities,
        "pension": pension,
    }

    if warnings:
        prices[target_date]["warnings"] = warnings

    snapshots[target_date] = calculate_performance_snapshot(target_date, portfolio, prices, snapshots)
    reconcile_next_daily_profit(target_date, snapshots)

    if warnings:
        print(f"WARNINGS for {target_date}:")
        for warning in warnings:
            print("-", warning)

    print(
        "updated prices and performance snapshots "
        f"for {target_date} actualMarketDate={actual_date} marketStatus={status}"
    )

    return warnings

# ---------------------------------------------------------------------------
# CLI orchestration
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="KRX 가격, 성과 스냅샷, KOSPI 지수를 갱신합니다.",
    )
    parser.add_argument(
        "--date",
        default="",
        help=(
            "YYYY-MM-DD. 지정하면 해당 거래일의 종목 가격·성과를 갱신하고 지정일까지 저장된 KOSPI 구간의 "
            "누락·정정값을 backfill. 비워두면 누락 거래일 보완 및 장중 저장분의 종가 재확정 대상을 자동 갱신."
        ),
    )
    parser.add_argument(
        "--force-display",
        action="store_true",
        help="갱신 날짜를 dashboard 표시 대상으로 강제합니다.",
    )
    parser.add_argument(
        "--no-display",
        action="store_true",
        help="갱신 날짜를 dashboard 비표시 대상으로 저장합니다.",
    )
    return parser.parse_args()


def load_dashboard_data() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Load the three JSON documents required by the updater."""
    portfolio = load_json(PORTFOLIO_PATH)
    prices = load_json(PRICES_PATH)
    snapshots = load_json(SNAPSHOTS_PATH) if SNAPSHOTS_PATH.exists() else {}
    return portfolio, prices, snapshots


def save_dashboard_data(prices: dict[str, Any], snapshots: dict[str, Any]) -> None:
    """Persist only the generated KRX data files managed by this script."""
    save_json(PRICES_PATH, dict(sorted(prices.items())))
    save_json(SNAPSHOTS_PATH, dict(sorted(snapshots.items())))


def main() -> int:
    args = parse_args()
    explicit_date = str(args.date or "").strip()

    if explicit_date and not is_valid_date_text(explicit_date):
        raise ValueError("--date는 YYYY-MM-DD 형식이어야 합니다.")

    portfolio, prices, snapshots = load_dashboard_data()

    if explicit_date:
        actual_date, close, probe_error = probe_trading_date(portfolio, explicit_date)
        if actual_date != explicit_date or close is None:
            if actual_date and close is not None:
                raise ValueError(
                    f"--date {explicit_date}는 KRX 거래일이 아닙니다. "
                    f"직전 확인 거래일은 {actual_date}입니다."
                )
            raise RuntimeError(
                f"--date {explicit_date}의 KRX 가격/정규장 종가를 확인하지 못했습니다: {probe_error}"
            )

    target_dates = resolve_target_dates(portfolio, prices, explicit_date or None)

    if target_dates:
        print("target dates: " + ", ".join(target_dates))
    else:
        print("No missing trading dates to update. KOSPI index backfill will still be checked.")

    all_warnings: list[str] = []

    for target_date in target_dates:
        warnings = update_one_date(
            target_date,
            portfolio,
            prices,
            snapshots,
            force_display=args.force_display,
            no_display=args.no_display,
        )
        all_warnings.extend(warnings)

    # 일부 종목만 성공한 결과로 기존 정상 파일을 덮어쓰지 않는다.
    if all_warnings:
        print("KRX 갱신 실패: 원본 prices/performance 파일을 유지합니다.")
        return 1

    kospi_through = explicit_date or today_kst()
    kospi_history = fetch_dashboard_kospi_history(prices, snapshots, kospi_through)
    kospi_changed = backfill_kospi_index(prices, snapshots, kospi_history)
    trading_calendar = build_krx_trading_calendar(prices, snapshots, kospi_history)
    calendar_changed = trading_calendar_changed(trading_calendar)

    if not target_dates and not kospi_changed and not calendar_changed:
        print("No price, snapshot, KOSPI index, or trading-calendar changes to save.")
        return 0

    save_dashboard_data(prices, snapshots)
    if calendar_changed:
        save_json(KRX_TRADING_CALENDAR_PATH, trading_calendar)

    if target_dates:
        print("updated target dates: " + ", ".join(target_dates))
    if kospi_changed:
        print(f"updated KOSPI dates: {len(kospi_changed)}")
    if calendar_changed:
        print(
            "updated KRX trading calendar: "
            f"{trading_calendar.get('from') or '-'} ~ {trading_calendar.get('through') or '-'}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
