#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from pykrx import stock

ROOT = Path(__file__).resolve().parents[1]
PORTFOLIO_PATH = ROOT / "data" / "portfolio.json"
PRICES_PATH = ROOT / "data" / "prices.json"
SNAPSHOTS_PATH = ROOT / "data" / "performance_snapshots.json"
KST = timezone(timedelta(hours=9))


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
    if latest_snapshot.get("marketStatus") == "intraday":
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


def is_symbol_chart_target(item: dict[str, Any]) -> bool:
    return item.get("chart") is not False


def init_security_symbols(portfolio: dict[str, Any]) -> dict[str, int]:
    symbols: dict[str, int] = {}
    for item in portfolio.get("securities", []):
        if not is_symbol_chart_target(item):
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
    symbols = init_security_symbols(portfolio)
    allocation = {"ETF": 0, "개별주식": 0, "현금": int(constants.get("securitiesCash", 0))}

    for item in portfolio["securities"]:
        ticker = item["ticker"]
        price = int(securities_prices.get(ticker, 0))
        qty = float(item["qty"])
        cost = int(item["cost"])
        eval_amount = int(round(price * qty))
        profit = eval_amount - cost
        raw_holding_profit += profit

        if item.get("type") == "ETF":
            allocation["ETF"] += eval_amount
        else:
            allocation["개별주식"] += eval_amount

        if is_symbol_chart_target(item):
            name = item["name"]
            key = symbol_key(str(name))
            symbols[key] = profit

    prev_keys = [k for k in sorted(snapshots.keys()) if k < target_date]
    prev_raw = int(snapshots[prev_keys[-1]].get("rawHoldingProfit", 0)) if prev_keys else 0
    daily_profit = raw_holding_profit - prev_raw

    account1_principal = int(constants.get("account1Principal", 0))
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

    for item in portfolio["securities"]:
        ticker = item["ticker"]
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
        "source": "pykrx-github-actions",
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

    if not target_dates:
        print("No missing trading dates to update.")
        return 0

    print("target dates: " + ", ".join(target_dates))

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

    save_json(PRICES_PATH, dict(sorted(prices.items())))
    save_json(SNAPSHOTS_PATH, dict(sorted(snapshots.items())))

    if all_warnings:
        print("WARNINGS:")
        for warning in all_warnings:
            print("-", warning)

    print("updated target dates: " + ", ".join(target_dates))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
