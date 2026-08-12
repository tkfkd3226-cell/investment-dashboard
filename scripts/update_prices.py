#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from pykrx import stock

ROOT = Path(__file__).resolve().parents[1]
PORTFOLIO_PATH = ROOT / "data" / "portfolio.json"
PRICES_PATH = ROOT / "data" / "prices.json"
SNAPSHOTS_PATH = ROOT / "data" / "performance_snapshots.json"
KST = timezone(timedelta(hours=9))
KOSPI_INDEX_TICKER = "1001"


def today_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def market_status_kst() -> str:
    now = datetime.now(KST)
    current_minutes = now.hour * 60 + now.minute
    market_open = 9 * 60
    market_close = 15 * 60 + 30
    if market_open <= current_minutes <= market_close:
        return "intraday"
    return "close"


def is_valid_date_text(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
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


def fetch_close(ticker: str, target_date: str, lookback_days: int = 7, retries: int = 2, retry_delay: float = 1.5):
    start = datetime.strptime(target_date, "%Y-%m-%d") - timedelta(days=lookback_days)
    end = datetime.strptime(target_date, "%Y-%m-%d")
    last_error = None

    for attempt in range(retries + 1):
        try:
            df = stock.get_market_ohlcv_by_date(start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), ticker)
            if df is None or df.empty:
                last_error = "empty-dataframe"
            else:
                last_idx = df.index[-1]
                actual_date = last_idx.strftime("%Y-%m-%d") if hasattr(last_idx, "strftime") else str(last_idx)[:10]
                close = int(df.iloc[-1]["종가"])
                return actual_date, close, None
        except Exception as exc:
            last_error = repr(exc)

        if attempt < retries:
            time.sleep(retry_delay)

    return None, None, last_error


def fetch_index_history_from_pykrx(
    start_date: str,
    end_date: str,
    ticker: str = KOSPI_INDEX_TICKER,
    retries: int = 2,
    retry_delay: float = 1.5,
):
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
                    date = index.strftime("%Y-%m-%d") if hasattr(index, "strftime") else str(index)[:10]
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
    start = datetime.strptime(start_date, "%Y-%m-%d")
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
        headers={"User-Agent": "Mozilla/5.0 (compatible; investment-dashboard/1.0)"},
        timeout=20,
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
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=KST)
    # Yahoo period2 is exclusive, so include the full end date plus one extra day.
    end_dt = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).replace(tzinfo=KST)

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
            "User-Agent": "Mozilla/5.0 (compatible; investment-dashboard/1.0)",
            "Accept": "application/json,text/plain,*/*",
        },
        timeout=20,
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
        date = datetime.fromtimestamp(int(timestamp), KST).strftime("%Y-%m-%d")
        if start_date <= date <= end_date:
            values[date] = round(float(close), 2)

    if not values:
        raise ValueError("Yahoo KOSPI chart returned no values in requested range")
    return values


def fetch_index_history(start_date: str, end_date: str, ticker: str = KOSPI_INDEX_TICKER):
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


def backfill_kospi_index(prices: dict[str, Any], snapshots: dict[str, Any], through_date: str) -> list[str]:
    stored_dates = sorted({
        date for date in [*prices.keys(), *snapshots.keys()]
        if is_valid_date_text(date) and date <= through_date
    })
    if not stored_dates:
        return []

    history, error = fetch_index_history(stored_dates[0], through_date)
    if not history:
        # Do not silently report a successful workflow when the chart data was not written.
        raise RuntimeError(f"KOSPI index backfill failed: {error}")

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


def date_range(start_date: str, end_date: str) -> list[str]:
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    dates: list[str] = []

    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)

    return dates


def latest_price_date(prices: dict[str, Any]) -> str | None:
    keys = sorted(
        k
        for k, v in prices.items()
        if is_valid_date_text(k)
        and isinstance(v, dict)
        and v.get("display", True) is not False
    )
    return keys[-1] if keys else None


def first_security_ticker(portfolio: dict[str, Any]) -> str | None:
    for item in portfolio.get("securities", []):
        ticker = item.get("ticker")
        if ticker:
            return str(ticker)
    return None


def resolve_latest_market_date(portfolio: dict[str, Any], target_date: str) -> str | None:
    ticker = first_security_ticker(portfolio)

    if not ticker:
        return None

    actual, close, err = fetch_close(ticker, target_date)

    if actual and close is not None:
        return actual

    print(f"WARN latest market date lookup failed for {ticker} {target_date}: {err}")
    return None


def is_actual_trading_date(portfolio: dict[str, Any], target_date: str) -> bool:
    ticker = first_security_ticker(portfolio)

    if not ticker:
        return False

    actual, close, err = fetch_close(ticker, target_date)

    return actual == target_date and close is not None


def resolve_target_dates(portfolio: dict[str, Any], prices: dict[str, Any], explicit_date: str | None) -> list[str]:
    if explicit_date:
        return [explicit_date]

    latest_saved = latest_price_date(prices)
    latest_market = resolve_latest_market_date(portfolio, today_kst())

    if not latest_market:
        return []

    if not latest_saved:
        return [latest_market]

    # 가장 최근 저장일이 아직 종가로 확정되지 않은 상태(intraday)라면,
    # 이미 prices에 존재하더라도 다시 갱신 대상에 포함시켜서
    # 장중 재요청 시 최신가로 갱신하거나, 마감 후 요청 시 종가로 확정되게 한다.
    refresh_dates = []
    latest_snapshot = prices.get(latest_saved) or {}
    current_market_status = market_status_kst()

    if latest_snapshot.get("marketStatus") == "intraday":
        refresh_dates.append(latest_saved)
    elif latest_saved == latest_market and latest_saved == today_kst() and current_market_status == "close":
        # 같은 날 장마감 후 자동 실행 시, 오전/장중에 만들어진 스냅샷이
        # 이미 close로 표시되어 있어도 한 번 더 갱신할 수 있게 한다.
        refresh_dates.append(latest_saved)

    start = (datetime.strptime(latest_saved, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

    if start > latest_market:
        return refresh_dates

    candidates = date_range(start, latest_market)

    missing_dates = [
        date
        for date in candidates
        if date not in prices and is_actual_trading_date(portfolio, date)
    ]

    return refresh_dates + missing_dates


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


def security_position_state(item: dict[str, Any], target_date: str, portfolio: dict[str, Any]) -> tuple[float, int]:
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
            qty -= event_qty
            cost -= amount
        elif event_type == "sell":
            qty += event_qty
            cost += max(0, int(event.get("costBasis", 0) or 0))

    return max(0.0, qty), max(0, cost)


def securities_cash_for_date(target_date: str, portfolio: dict[str, Any], snapshots: dict[str, Any] | None = None) -> int:
    if isinstance(snapshots, dict):
        saved_dates = sorted(
            date for date, item in snapshots.items()
            if isinstance(date, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) and isinstance(item, dict)
        )
        if saved_dates and target_date < saved_dates[-1]:
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


def account1_principal_for_date(target_date: str, portfolio: dict[str, Any]) -> int:
    principal = int(portfolio.get("constants", {}).get("account1Principal", 0) or 0)
    for event in security_events(portfolio):
        if str(event.get("date", "")) <= target_date:
            continue
        amount = max(0, int(event.get("amount", 0) or 0))
        if event.get("type") == "contribution":
            principal -= amount
        elif event.get("type") == "withdrawal":
            principal += amount
    return principal


def is_symbol_chart_target(item: dict[str, Any], target_date: str) -> bool:
    if item.get("chart") is False:
        return False
    chart_from = str(item.get("chartFrom", "") or "")
    return not chart_from or target_date >= chart_from


def init_security_symbols(portfolio: dict[str, Any], target_date: str) -> dict[str, int]:
    symbols: dict[str, int] = {}
    for item in portfolio.get("securities", []):
        if not is_symbol_chart_target(item, target_date):
            continue
        name = item.get("name")
        if not name:
            continue
        symbols.setdefault(symbol_key(str(name)), 0)
    return symbols


def calculate_performance_snapshot(target_date: str, portfolio: dict[str, Any], prices: dict[str, Any], snapshots: dict[str, Any]) -> dict[str, Any]:
    constants = portfolio["constants"]
    price_snapshot = prices[target_date]
    securities_prices = price_snapshot.get("securities", {})

    raw_holding_profit = 0
    symbols = init_security_symbols(portfolio, target_date)
    allocation = {"ETF": 0, "개별주식": 0, "현금": securities_cash_for_date(target_date, portfolio, snapshots)}

    for item in portfolio["securities"]:
        ticker = item["ticker"]
        market_price = int(securities_prices.get(ticker, 0))
        qty, cost = security_position_state(item, target_date, portfolio)
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
        raw_holding_profit += profit

        if item.get("type") == "ETF":
            allocation["ETF"] += eval_amount
        else:
            allocation["개별주식"] += eval_amount

        if is_symbol_chart_target(item, target_date):
            name = item["name"]
            key = symbol_key(str(name))
            symbols[key] = profit

    prev_keys = [k for k in sorted(snapshots.keys()) if k < target_date]
    prev_raw = int(snapshots[prev_keys[-1]].get("rawHoldingProfit", 0)) if prev_keys else 0
    daily_profit = raw_holding_profit - prev_raw

    account1_principal = account1_principal_for_date(target_date, portfolio)
    cumulative_return = raw_holding_profit / account1_principal * 100 if account1_principal else 0

    return {
        "display": price_snapshot.get("display", True),
        "source": "calculated-current-portfolio",
        "marketStatus": price_snapshot.get("marketStatus", "close"),
        "requestedDate": price_snapshot.get("requestedDate", target_date),
        "actualMarketDate": price_snapshot.get("actualMarketDate", target_date),
        "updatedAtKST": price_snapshot.get("updatedAtKST"),
        "rawHoldingProfit": raw_holding_profit,
        "cumulativeReturn": cumulative_return,
        "dailyProfit": daily_profit,
        "symbols": symbols,
        "allocation": allocation,
    }


def update_one_date(
    target_date: str,
    portfolio: dict[str, Any],
    prices: dict[str, Any],
    snapshots: dict[str, Any],
    force_display: bool = False,
    no_display: bool = False,
) -> list[str]:
    prev_key, prev = previous_snapshot(prices, before=target_date)
    securities, pension, warnings, actual_dates = {}, {}, [], set()

    manual_valuation_used = False
    for item in portfolio["securities"]:
        ticker = item["ticker"]
        valuation_override = security_valuation_override(portfolio, ticker, target_date)
        if valuation_override is not None:
            securities[ticker] = int(valuation_override)
            actual_dates.add(target_date)
            manual_valuation_used = True
            continue

        actual, close, err = fetch_close(ticker, target_date)

        if close is None:
            fallback = prev.get("securities", {}).get(ticker) if prev else None

            if fallback is None:
                warnings.append(f"SEC {ticker}: 조회 실패 및 직전값 없음: {err}")
                continue

            securities[ticker] = int(fallback)
            warnings.append(f"SEC {ticker}: 조회 실패, 직전 스냅샷 {prev_key} 값 {fallback} 사용: {err}")
        else:
            securities[ticker] = int(close)
            actual_dates.add(actual)

    for item in portfolio["pension"]:
        ticker = item["ticker"]
        actual, close, err = fetch_close(ticker, target_date)

        if close is None:
            fallback = prev.get("pension", {}).get(ticker) if prev else None

            if fallback is None:
                warnings.append(f"PEN {ticker}: 조회 실패 및 직전값 없음: {err}")
                continue

            pension[ticker] = int(fallback)
            warnings.append(f"PEN {ticker}: 조회 실패, 직전 스냅샷 {prev_key} 값 {fallback} 사용: {err}")
        else:
            pension[ticker] = int(close)
            actual_dates.add(actual)

    pension["cash"] = int(prev.get("pension", {}).get("cash", 0)) if prev else 0
    actual_date = sorted(actual_dates)[-1] if actual_dates else target_date

    display = True

    if no_display:
        display = False

    if force_display:
        display = True

    status = market_status_kst()
    updated_at = datetime.now(KST).isoformat(timespec="seconds")

    prices[target_date] = {
        "display": display,
        "source": "pykrx-github-actions+nxt-valuation" if manual_valuation_used else "pykrx-github-actions",
        "marketStatus": status,
        "requestedDate": target_date,
        "actualMarketDate": actual_date,
        "updatedAtKST": updated_at,
        "securities": securities,
        "pension": pension,
    }

    if warnings:
        prices[target_date]["warnings"] = warnings

    snapshots[target_date] = calculate_performance_snapshot(target_date, portfolio, prices, snapshots)

    if warnings:
        print(f"WARNINGS for {target_date}:")
        for warning in warnings:
            print("-", warning)

    print(f"updated prices and performance snapshots for {target_date} actualMarketDate={actual_date} marketStatus={status}")

    return warnings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default="", help="YYYY-MM-DD. 지정하면 해당 날짜만 갱신하고, 비워두면 누락 거래일을 자동 보충.")
    parser.add_argument("--force-display", action="store_true")
    parser.add_argument("--no-display", action="store_true")
    args = parser.parse_args()

    explicit_date = str(args.date or "").strip()

    if explicit_date and not is_valid_date_text(explicit_date):
        raise ValueError("--date는 YYYY-MM-DD 형식이어야 합니다.")

    portfolio = load_json(PORTFOLIO_PATH)
    prices = load_json(PRICES_PATH)
    snapshots = load_json(SNAPSHOTS_PATH) if SNAPSHOTS_PATH.exists() else {}

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

    kospi_through = explicit_date or today_kst()
    kospi_changed = backfill_kospi_index(prices, snapshots, kospi_through)

    if not target_dates and not kospi_changed:
        print("No price, snapshot, or KOSPI index changes to save.")
        return 0

    save_json(PRICES_PATH, dict(sorted(prices.items())))
    save_json(SNAPSHOTS_PATH, dict(sorted(snapshots.items())))

    if all_warnings:
        print("WARNINGS:")
        for warning in all_warnings:
            print("-", warning)

    if target_dates:
        print("updated target dates: " + ", ".join(target_dates))
    if kospi_changed:
        print(f"updated KOSPI dates: {len(kospi_changed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
