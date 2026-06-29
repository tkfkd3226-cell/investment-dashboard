#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import argparse, json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from pykrx import stock

ROOT = Path(__file__).resolve().parents[1]
PORTFOLIO_PATH = ROOT / 'data' / 'portfolio.json'
PRICES_PATH = ROOT / 'data' / 'prices.json'
KST = timezone(timedelta(hours=9))

def today_kst() -> str:
    return datetime.now(KST).strftime('%Y-%m-%d')

def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))

def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def previous_snapshot(prices: dict[str, Any], before: str | None = None):
    keys = sorted(prices.keys())
    if before:
        keys = [k for k in keys if k < before]
    if not keys:
        return None, None
    return keys[-1], prices[keys[-1]]

def fetch_close(ticker: str, target_date: str, lookback_days: int = 7):
    start = datetime.strptime(target_date, '%Y-%m-%d') - timedelta(days=lookback_days)
    end = datetime.strptime(target_date, '%Y-%m-%d')
    try:
        df = stock.get_market_ohlcv_by_date(start.strftime('%Y%m%d'), end.strftime('%Y%m%d'), ticker)
        if df is None or df.empty:
            return None, None, 'empty-dataframe'
        last_idx = df.index[-1]
        actual_date = last_idx.strftime('%Y-%m-%d') if hasattr(last_idx, 'strftime') else str(last_idx)[:10]
        close = int(df.iloc[-1]['종가'])
        return actual_date, close, None
    except Exception as exc:
        return None, None, repr(exc)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', default=today_kst(), help='YYYY-MM-DD. 기본값은 한국시간 오늘.')
    parser.add_argument('--force-display', action='store_true')
    parser.add_argument('--no-display', action='store_true')
    args = parser.parse_args()
    target_date = args.date
    portfolio = load_json(PORTFOLIO_PATH)
    prices = load_json(PRICES_PATH)
    prev_key, prev = previous_snapshot(prices, before=target_date)
    securities, pension, warnings, actual_dates = {}, {}, [], set()
    for item in portfolio['securities']:
        ticker = item['ticker']
        actual, close, err = fetch_close(ticker, target_date)
        if close is None:
            fallback = prev.get('securities', {}).get(ticker) if prev else None
            if fallback is None:
                warnings.append(f'SEC {ticker}: 조회 실패 및 직전값 없음: {err}')
                continue
            securities[ticker] = int(fallback)
            warnings.append(f'SEC {ticker}: 조회 실패, 직전 스냅샷 {prev_key} 값 {fallback} 사용: {err}')
        else:
            securities[ticker] = close
            actual_dates.add(actual)
    for item in portfolio['pension']:
        ticker = item['ticker']
        actual, close, err = fetch_close(ticker, target_date)
        if close is None:
            fallback = prev.get('pension', {}).get(ticker) if prev else None
            if fallback is None:
                warnings.append(f'PEN {ticker}: 조회 실패 및 직전값 없음: {err}')
                continue
            pension[ticker] = int(fallback)
            warnings.append(f'PEN {ticker}: 조회 실패, 직전 스냅샷 {prev_key} 값 {fallback} 사용: {err}')
        else:
            pension[ticker] = close
            actual_dates.add(actual)
    pension['cash'] = int(prev.get('pension', {}).get('cash', 0)) if prev else 0
    actual_date = sorted(actual_dates)[-1] if actual_dates else target_date
    display = True
    if args.no_display:
        display = False
    if args.force_display:
        display = True
    prices[target_date] = {
        'display': display,
        'source': 'pykrx-github-actions',
        'requestedDate': target_date,
        'actualMarketDate': actual_date,
        'updatedAtKST': datetime.now(KST).isoformat(timespec='seconds'),
        'securities': securities,
        'pension': pension,
    }
    if warnings:
        prices[target_date]['warnings'] = warnings
    save_json(PRICES_PATH, prices)
    if warnings:
        print('WARNINGS:')
        for w in warnings: print('-', w)
    print(f'updated {PRICES_PATH} for {target_date} actualMarketDate={actual_date}')
    return 0
if __name__ == '__main__':
    raise SystemExit(main())
