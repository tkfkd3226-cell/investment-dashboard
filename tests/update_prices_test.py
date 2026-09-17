#!/usr/bin/env python3
"""Regression tests for safe KRX closing-price publication."""

import importlib.util
import copy
import json
import sys
import types
import unittest
from datetime import datetime
from unittest.mock import patch
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_updater():
    # The production workflow installs pykrx.  The regression test only exercises
    # update_one_date with a mocked fetcher, so a tiny import stub is sufficient.
    pykrx = types.ModuleType("pykrx")
    pykrx.stock = types.SimpleNamespace()
    sys.modules["pykrx"] = pykrx
    requests = types.ModuleType("requests")
    requests.get = lambda *_, **__: None
    sys.modules["requests"] = requests
    spec = importlib.util.spec_from_file_location("update_prices_under_test", ROOT / "scripts" / "update_prices.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class UpdatePricesSafetyTest(unittest.TestCase):
    def setUp(self):
        self.updater = load_updater()
        self.updater.calculate_performance_snapshot = lambda date, *_: {"date": date}
        self.updater.market_status_for_date = lambda _: "close"
        self.portfolio = {
            "securities": [{"ticker": "SEC", "qty": 1, "cost": 100}],
            "pension": [{"ticker": "PEN"}],
            "securitiesEvents": [],
        }

    def test_stale_close_is_hidden_and_records_each_symbol_source_date(self):
        self.updater.fetch_close = lambda ticker, _, **_kw: ("2026-09-08", 100 if ticker == "SEC" else 200, None)
        prices, snapshots = {}, {}

        warnings = self.updater.update_one_date("2026-09-09", self.portfolio, prices, snapshots)

        row = prices["2026-09-09"]
        self.assertTrue(warnings)
        self.assertFalse(row["display"])
        self.assertEqual(row["actualMarketDate"], "2026-09-08")
        self.assertEqual(row["priceSourceDates"], {"SEC:SEC": "2026-09-08", "PEN:PEN": "2026-09-08"})
        self.assertNotIn("regularCloseSource", row)

    def test_fetch_fallback_is_hidden_and_keeps_previous_source_date(self):
        self.updater.fetch_close = lambda *_, **_kw: (None, None, "network error")
        prices = {
            "2026-09-08": {
                "actualMarketDate": "2026-09-08",
                "priceSourceDates": {"SEC:SEC": "2026-09-08", "PEN:PEN": "2026-09-08"},
                "securities": {"SEC": 100},
                "pension": {"PEN": 200},
            }
        }
        snapshots = {}

        warnings = self.updater.update_one_date("2026-09-09", self.portfolio, prices, snapshots)

        row = prices["2026-09-09"]
        self.assertTrue(warnings)
        self.assertFalse(row["display"])
        self.assertEqual(row["actualMarketDate"], "2026-09-08")
        self.assertEqual(row["priceSourceDates"], {"SEC:SEC": "2026-09-08", "PEN:PEN": "2026-09-08"})
        self.assertNotIn("regularCloseSource", row)

    def test_warning_hidden_date_is_automatically_retried(self):
        self.updater.today_kst = lambda: "2026-09-09"
        self.updater.resolve_latest_market_date = lambda *_, **_kw: "2026-09-09"
        prices = {
            "2026-09-08": {"display": True},
            "2026-09-09": {"display": False, "warnings": ["network error"]},
        }

        dates = self.updater.resolve_target_dates(self.portfolio, prices, None)

        self.assertEqual(dates, ["2026-09-09"])

    def test_close_snapshot_is_tagged_as_regular_close(self):
        self.updater.fetch_close = lambda ticker, date, **_kw: (date, 100 if ticker == "SEC" else 200, None)
        prices, snapshots = {}, {}

        self.updater.update_one_date("2026-09-09", self.portfolio, prices, snapshots)

        self.assertEqual(prices["2026-09-09"]["marketStatus"], "close")
        self.assertEqual(prices["2026-09-09"]["priceBasis"], "regular_close")
        self.assertEqual(prices["2026-09-09"]["regularCloseSource"], "pykrx_pre_aftermarket")

    def test_intraday_snapshot_is_tagged_as_intraday(self):
        self.updater.market_status_for_date = lambda _: "intraday"
        self.updater.fetch_close = lambda ticker, date, **_kw: (date, 100 if ticker == "SEC" else 200, None)
        prices, snapshots = {}, {}

        self.updater.update_one_date("2026-09-09", self.portfolio, prices, snapshots)

        self.assertEqual(prices["2026-09-09"]["marketStatus"], "intraday")
        self.assertEqual(prices["2026-09-09"]["priceBasis"], "intraday")

    def test_fetch_close_uses_exact_1530_minute_after_aftermarket_start(self):
        class FakeResponse:
            def raise_for_status(self):
                return None
            def json(self):
                return [
                    {"localDateTime": "20260917153000", "currentPrice": 1745000},
                    {"localDateTime": "20260917160000", "currentPrice": 1764000},
                ]

        calls = []
        def fake_get(url, **kwargs):
            calls.append((url, kwargs))
            return FakeResponse()

        self.updater.requests.get = fake_get
        self.updater.stock.get_market_ohlcv_by_ticker = lambda *_a, **_k: self.fail(
            "post-cutover close must not use pykrx all-market data"
        )
        self.updater.stock.get_market_ohlcv_by_date = lambda *_a, **_k: self.fail(
            "post-cutover close must not use pykrx by-date data"
        )
        self.updater.market_status_for_date = lambda _: "close"

        actual, close, error = self.updater.fetch_close("000660", "2026-09-17", retries=0)

        self.assertEqual((actual, close, error), ("2026-09-17", 1745000, None))
        self.assertEqual(len(calls), 1)
        url, kwargs = calls[0]
        self.assertEqual(url, "https://api.stock.naver.com/chart/domestic/item/000660/minute")
        self.assertEqual(kwargs["params"], {
            "startDateTime": "202609171530",
            "endDateTime": "202609171530",
        })

    def test_post_aftermarket_close_fails_closed_without_exact_1530_bar(self):
        class FakeResponse:
            def raise_for_status(self):
                return None
            def json(self):
                return [{"localDateTime": "20260917160000", "currentPrice": 1764000}]

        self.updater.requests.get = lambda *_a, **_k: FakeResponse()
        self.updater.stock.get_market_ohlcv_by_ticker = lambda *_a, **_k: self.fail(
            "post-cutover close must not fall back to pykrx"
        )
        self.updater.stock.get_market_ohlcv_by_date = lambda *_a, **_k: self.fail(
            "post-cutover close must not fall back to pykrx"
        )
        self.updater.market_status_for_date = lambda _: "close"

        actual, close, error = self.updater.fetch_close("000660", "2026-09-17", retries=0)

        self.assertIsNone(actual)
        self.assertIsNone(close)
        self.assertIn("naver-krx-1530-minute=", error)
        self.assertIn("missing-exact-1530-minute-bar", error)

    def test_pre_aftermarket_close_falls_back_to_raw_by_date(self):
        calls = []

        class FakeRow:
            def __getitem__(self, key):
                return 1812000 if key == "종가" else None

        class FakeILoc:
            def __getitem__(self, _):
                return FakeRow()

        class FakeFrame:
            empty = False
            index = [__import__("datetime").datetime(2026, 9, 11)]
            iloc = FakeILoc()

        self.updater.stock.get_market_ohlcv_by_ticker = lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("all-market KRX unavailable")
        )
        def fake_getter(*args, **kwargs):
            calls.append((args, kwargs))
            return FakeFrame()
        self.updater.stock.get_market_ohlcv_by_date = fake_getter
        self.updater.requests.get = lambda *_a, **_k: self.fail(
            "pre-aftermarket close should not require Naver minute data"
        )
        self.updater.market_status_for_date = lambda _: "close"

        actual, close, error = self.updater.fetch_close("000660", "2026-09-11", retries=0)

        self.assertEqual((actual, close, error), ("2026-09-11", 1812000, None))
        self.assertEqual(calls[0][1], {"adjusted": False})

    def test_verified_close_source_does_not_trust_legacy_pykrx_label(self):
        self.assertEqual(
            self.updater.verified_regular_close_source("2026-09-17"),
            "naver_krx_1530_minute",
        )
        self.assertEqual(
            self.updater.verified_regular_close_source("2026-09-11"),
            "pykrx_pre_aftermarket",
        )

    def test_fetch_close_keeps_intraday_default_source_during_regular_session(self):
        calls = []

        class FakeRow:
            def __getitem__(self, key):
                return 1750000 if key == "종가" else None

        class FakeILoc:
            def __getitem__(self, _):
                return FakeRow()

        class FakeFrame:
            empty = False
            index = [__import__("datetime").datetime(2026, 9, 16)]
            iloc = FakeILoc()

        def fake_getter(*args, **kwargs):
            calls.append((args, kwargs))
            return FakeFrame()

        self.updater.requests.get = lambda *_args, **_kwargs: self.fail(
            "intraday path must not call the closed-session Naver chart"
        )
        self.updater.stock.get_market_ohlcv_by_date = fake_getter
        self.updater.market_status_for_date = lambda _: "intraday"
        self.updater.fetch_close("000660", "2026-09-16", retries=0)

        self.assertEqual(calls[0][1], {})


class KrxRefreshBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.updater = load_updater()
        self.portfolio = {
            "securities": [{"ticker": "000660", "qty": 1, "cost": 1}],
            "pension": [],
            "securitiesEvents": [],
        }

    def frame(self, date, close):
        return types.SimpleNamespace(
            empty=False, index=[datetime.fromisoformat(date)],
            iloc=[{"종가": close}],
        )

    def test_1530_is_close_weekend_is_not_intraday(self):
        for stamp, status in [("2026-09-17T15:29:59", "intraday"),
                              ("2026-09-17T15:30:00", "close"),
                              ("2026-09-17T15:30:59", "close"),
                              ("2026-09-17T18:00:00", "close"),
                              ("2026-09-19T10:00:00", "close")]:
            with self.subTest(stamp=stamp), patch.object(self.updater, "datetime") as clock:
                clock.now.return_value = datetime.fromisoformat(stamp)
                self.assertEqual(self.updater.market_status_kst(), status)

    def test_historical_date_uses_close_even_during_todays_session(self):
        self.updater.today_kst = lambda: "2026-09-17"
        self.updater.market_status_kst = lambda: "intraday"
        self.assertEqual(self.updater.market_status_for_date("2026-09-16"), "close")
        self.assertEqual(self.updater.market_status_for_date("2026-09-17"), "intraday")

    def test_latest_market_date_probes_backward_when_exact_close_is_missing(self):
        calls = []
        self.updater.first_security_ticker = lambda _portfolio: "000660"
        def probe(_portfolio, date):
            calls.append(date)
            if date == "2026-09-17":
                return date, 1745000, None
            return None, None, "missing-exact-1530-minute-bar"
        self.updater.probe_trading_date = probe

        latest = self.updater.resolve_latest_market_date({}, "2026-09-19")

        self.assertEqual(latest, "2026-09-17")
        self.assertEqual(calls, ["2026-09-18", "2026-09-17"])

    def test_etf_post_aftermarket_uses_exact_1530_minute_source(self):
        class FakeResponse:
            def raise_for_status(self):
                return None
            def json(self):
                return [{"localDateTime": "20260917153000", "currentPrice": 38485}]

        calls = []
        def fake_get(url, **kwargs):
            calls.append((url, kwargs))
            return FakeResponse()

        self.updater.market_status_for_date = lambda _: "close"
        self.updater.requests.get = fake_get
        with patch.object(self.updater.stock, "get_etf_ohlcv_by_ticker", create=True) as getter:
            self.assertEqual(
                self.updater.fetch_close("395160", "2026-09-17", retries=0, is_etf=True),
                ("2026-09-17", 38485, None),
            )
            getter.assert_not_called()
        self.assertIn("/395160/minute", calls[0][0])

    def test_etf_pre_aftermarket_history_fallback_does_not_call_stock_history(self):
        self.updater.market_status_for_date = lambda _: "close"
        self.updater.stock.get_market_ohlcv_by_date = lambda *a, **k: self.fail("ETF must not use stock raw endpoint")
        with patch.object(self.updater.stock, "get_etf_ohlcv_by_ticker", create=True,
                          side_effect=RuntimeError("bulk unavailable")):
            with patch.object(self.updater.stock, "get_etf_ohlcv_by_date", create=True,
                              return_value=self.frame("2026-09-11", 40130)) as getter:
                self.assertEqual(self.updater.fetch_close("395160", "2026-09-11", retries=0, is_etf=True),
                                 ("2026-09-11", 40130, None))
                getter.assert_called_once_with("20260904", "20260911", "395160")

    def test_invalid_and_future_raw_quotes_are_rejected_before_aftermarket_cutover(self):
        self.updater.market_status_for_date = lambda _: "close"
        for date, value in [("2026-09-11", 0), ("2026-09-11", -1), ("2026-09-12", 100)]:
            self.updater.stock.get_market_ohlcv_by_ticker = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("bulk unavailable"))
            self.updater.stock.get_market_ohlcv_by_date = lambda *a, **k: self.frame(date, value)
            actual, close, err = self.updater.fetch_close("000660", "2026-09-11", retries=0)
            self.assertIsNone(close)
            self.assertIn("invalid-price-or-source-date", err)

    def test_entire_snapshot_is_refetched_if_1530_is_crossed(self):
        phase = {"value": "intraday"}
        calls = []
        self.updater.market_status_for_date = lambda _: phase["value"]
        self.updater.calculate_performance_snapshot = lambda date, *_: {"date": date}
        portfolio = {"securities": [{"ticker": "000660", "qty": 1, "cost": 1}],
                     "pension": [{"ticker": "395160"}], "securitiesEvents": []}
        def fetch(ticker, date, **kwargs):
            calls.append((ticker, kwargs["is_etf"]))
            value = 1755000 if phase["value"] == "intraday" else 1745000
            phase["value"] = "close"
            return date, value, None
        self.updater.fetch_close = fetch
        prices, snapshots = {}, {}
        self.updater.update_one_date("2026-09-17", portfolio, prices, snapshots)
        self.assertEqual(calls, [("000660", False), ("395160", True)] * 2)
        self.assertEqual(prices["2026-09-17"]["securities"]["000660"], 1745000)
        self.assertEqual(prices["2026-09-17"]["priceBasis"], "regular_close")

    def test_failed_partial_refresh_does_not_save_either_file(self):
        self.updater.parse_args = lambda: types.SimpleNamespace(date="2026-09-17", force_display=False, no_display=False)
        self.updater.load_dashboard_data = lambda: ({}, {"original": True}, {"original": True})
        self.updater.probe_trading_date = lambda *_: ("2026-09-17", 100, None)
        self.updater.update_one_date = lambda *a, **k: ["ETF lookup failed"]
        self.updater.save_dashboard_data = lambda *_: self.fail("failed refresh must preserve original files")
        self.updater.backfill_kospi_index = lambda *_: self.fail("no further data mutation on failure")
        self.assertEqual(self.updater.main(), 1)

    def test_auto_probe_failure_does_not_report_successful_noop(self):
        self.updater.resolve_latest_market_date = lambda *_: None
        with self.assertRaisesRegex(RuntimeError, "최신 거래일 조회 실패"):
            self.updater.resolve_target_dates({}, {}, None)

    def test_missing_historical_trading_day_is_selected_even_if_1530_bar_expired(self):
        self.updater.today_kst = lambda: "2026-09-18"
        self.updater.resolve_latest_market_date = lambda *_: "2026-09-17"
        self.updater.fetch_index_history = lambda *_: ({
            "2026-09-15": 6700.0,
            "2026-09-16": 6717.97,
            "2026-09-17": 6715.41,
        }, None)
        self.updater.probe_trading_date = lambda *_: (None, None, "missing-exact-1530-minute-bar")
        prices = {
            "2026-09-14": {"display": True, "marketStatus": "close"},
            "2026-09-16": {"display": True, "marketStatus": "close"},
            "2026-09-17": {"display": True, "marketStatus": "close"},
        }

        dates = self.updater.resolve_target_dates(self.portfolio, prices, None)

        self.assertEqual(dates, ["2026-09-15"])

    def test_missing_weekday_absent_from_kospi_calendar_is_treated_as_non_trading(self):
        self.updater.today_kst = lambda: "2026-09-18"
        self.updater.resolve_latest_market_date = lambda *_: "2026-09-17"
        self.updater.fetch_index_history = lambda *_: ({
            "2026-09-16": 6717.97,
            "2026-09-17": 6715.41,
        }, None)
        prices = {
            "2026-09-14": {"display": True, "marketStatus": "close"},
            "2026-09-16": {"display": True, "marketStatus": "close"},
            "2026-09-17": {"display": True, "marketStatus": "close"},
        }

        dates = self.updater.resolve_target_dates(self.portfolio, prices, None)

        self.assertEqual(dates, [])

    def test_missing_date_calendar_lookup_failure_fails_closed(self):
        self.updater.today_kst = lambda: "2026-09-18"
        self.updater.resolve_latest_market_date = lambda *_: "2026-09-17"
        self.updater.fetch_index_history = lambda *_: ({}, "all calendar sources unavailable")
        prices = {
            "2026-09-14": {"display": True, "marketStatus": "close"},
            "2026-09-16": {"display": True, "marketStatus": "close"},
            "2026-09-17": {"display": True, "marketStatus": "close"},
        }

        with self.assertRaisesRegex(RuntimeError, "누락 거래일 달력 조회 실패"):
            self.updater.resolve_target_dates(self.portfolio, prices, None)

    def test_auto_missing_trading_date_close_failure_returns_nonzero_without_save(self):
        self.updater.parse_args = lambda: types.SimpleNamespace(date="", force_display=False, no_display=False)
        self.updater.today_kst = lambda: "2026-09-18"
        self.updater.resolve_latest_market_date = lambda *_: "2026-09-17"
        self.updater.fetch_index_history = lambda *_: ({
            "2026-09-15": 6700.0,
            "2026-09-16": 6717.97,
            "2026-09-17": 6715.41,
        }, None)
        prices = {
            "2026-09-14": {"display": True, "marketStatus": "close"},
            "2026-09-16": {"display": True, "marketStatus": "close"},
            "2026-09-17": {"display": True, "marketStatus": "close"},
        }
        self.updater.load_dashboard_data = lambda: (self.portfolio, prices, {})
        self.updater.update_one_date = lambda date, *_a, **_kw: (
            ["missing exact 15:30 minute bar"] if date == "2026-09-15" else []
        )
        self.updater.save_dashboard_data = lambda *_: self.fail("failed auto refresh must not save partial files")
        self.updater.backfill_kospi_index = lambda *_: self.fail("warning must stop before KOSPI backfill")

        self.assertEqual(self.updater.main(), 1)


class PerformanceCausalOrderingTest(unittest.TestCase):
    def setUp(self):
        self.updater = load_updater()
        self.updater.market_status_for_date = lambda _: "close"
        self.portfolio = {
            "securities": [
                {
                    "ticker": "SEC",
                    "name": "SEC",
                    "type": "개별주식",
                    "qty": 1,
                    "cost": 100,
                }
            ],
            "pension": [],
            "securitiesEvents": [],
            "constants": {
                "securitiesCash": 0,
                "account1Principal": 100,
            },
        }

    def test_historical_backfill_rebases_next_existing_daily_profit(self):
        self.updater.fetch_close = lambda *_, **_kw: ("2026-09-08", 110, None)
        prices = {
            "2026-09-07": {
                "display": True,
                "actualMarketDate": "2026-09-07",
                "securities": {"SEC": 100},
                "pension": {},
            },
            "2026-09-09": {
                "display": True,
                "actualMarketDate": "2026-09-09",
                "securities": {"SEC": 120},
                "pension": {},
            },
        }
        snapshots = {
            "2026-09-07": {"rawHoldingProfit": 0, "dailyProfit": 0, "allocation": {"현금": 0}},
            "2026-09-09": {"rawHoldingProfit": 20, "dailyProfit": 20, "allocation": {"현금": 0}},
        }

        warnings = self.updater.update_one_date("2026-09-08", self.portfolio, prices, snapshots)

        self.assertEqual(warnings, [])
        self.assertEqual(snapshots["2026-09-08"]["rawHoldingProfit"], 10)
        self.assertEqual(snapshots["2026-09-08"]["dailyProfit"], 10)
        self.assertEqual(snapshots["2026-09-09"]["dailyProfit"], 10)

    def test_correcting_middle_date_rebases_only_immediate_forward_dependency(self):
        self.updater.fetch_close = lambda *_, **_kw: ("2026-09-08", 115, None)
        prices = {
            "2026-09-07": {"display": True, "securities": {"SEC": 100}, "pension": {}},
            "2026-09-08": {"display": True, "securities": {"SEC": 110}, "pension": {}},
            "2026-09-09": {"display": True, "securities": {"SEC": 120}, "pension": {}},
            "2026-09-10": {"display": True, "securities": {"SEC": 130}, "pension": {}},
        }
        snapshots = {
            "2026-09-07": {"rawHoldingProfit": 0, "dailyProfit": 0, "allocation": {"현금": 0}},
            "2026-09-08": {"rawHoldingProfit": 10, "dailyProfit": 10, "allocation": {"현금": 0}},
            "2026-09-09": {"rawHoldingProfit": 20, "dailyProfit": 10, "allocation": {"현금": 0}},
            "2026-09-10": {"rawHoldingProfit": 30, "dailyProfit": 10, "allocation": {"현금": 0}},
        }

        warnings = self.updater.update_one_date("2026-09-08", self.portfolio, prices, snapshots)

        self.assertEqual(warnings, [])
        self.assertEqual(snapshots["2026-09-08"]["rawHoldingProfit"], 15)
        self.assertEqual(snapshots["2026-09-08"]["dailyProfit"], 15)
        self.assertEqual(snapshots["2026-09-09"]["dailyProfit"], 5)
        self.assertEqual(snapshots["2026-09-10"]["dailyProfit"], 10)

    def test_multiple_historical_backfills_converge_regardless_of_execution_order(self):
        base_prices = {
            "2026-09-07": {"display": True, "securities": {"SEC": 100}, "pension": {}},
            "2026-09-10": {"display": True, "securities": {"SEC": 130}, "pension": {}},
        }
        base_snapshots = {
            "2026-09-07": {"rawHoldingProfit": 0, "dailyProfit": 0, "allocation": {"현금": 0}},
            "2026-09-10": {"rawHoldingProfit": 30, "dailyProfit": 30, "allocation": {"현금": 0}},
        }
        closes = {"2026-09-08": 110, "2026-09-09": 120}

        def run(order):
            prices = copy.deepcopy(base_prices)
            snapshots = copy.deepcopy(base_snapshots)
            for target_date in order:
                self.updater.fetch_close = lambda _, date, **_kw: (date, closes[date], None)
                self.updater.update_one_date(target_date, self.portfolio, prices, snapshots)
            return {
                date: (snapshot["rawHoldingProfit"], snapshot["dailyProfit"])
                for date, snapshot in sorted(snapshots.items())
            }

        chronological = run(["2026-09-08", "2026-09-09"])
        reverse = run(["2026-09-09", "2026-09-08"])

        self.assertEqual(reverse, chronological)
        self.assertEqual(
            [value[1] for value in chronological.values()],
            [0, 10, 10, 10],
        )

    def test_committed_performance_daily_profit_chain_is_consistent_after_baseline(self):
        snapshots = json.loads((ROOT / "data" / "performance_snapshots.json").read_text(encoding="utf-8"))
        dates = sorted(date for date, snapshot in snapshots.items() if isinstance(snapshot, dict))

        for index, date in enumerate(dates[1:], start=1):
            previous = snapshots[dates[index - 1]]
            current = snapshots[date]
            expected = int(current.get("rawHoldingProfit", 0) or 0) - int(previous.get("rawHoldingProfit", 0) or 0)
            self.assertEqual(
                int(current.get("dailyProfit", 0) or 0),
                expected,
                f"{date} dailyProfit must match the immediately preceding stored snapshot",
            )


class SecuritiesSaleUpdaterTest(unittest.TestCase):
    def setUp(self):
        self.updater = load_updater()
        self.updater.market_status_for_date = lambda _: "close"
        self.portfolio = {
            "constants": {"securitiesCash": 1100, "account1Principal": 1000},
            "securities": [
                {"ticker": "SEC", "name": "Stock A", "type": "개별주식", "qty": 0, "cost": 0, "chart": True}
            ],
            "pension": [],
            "securitiesEvents": [
                {
                    "id": "sell-a", "date": "2026-06-20", "type": "sell", "ticker": "SEC", "qty": 10,
                    "price": 110, "grossAmount": 1100, "transactionCost": 0, "amount": 1100,
                    "costBasis": 1000, "realizedProfit": 100, "cashPrincipalDelta": 1000,
                }
            ],
        }

    def test_sale_date_fetches_market_close_for_sold_position_and_keeps_realized_profit(self):
        calls = []
        self.updater.fetch_close = lambda ticker, date, **_kw: calls.append((ticker, date)) or (date, 999, None)
        prices, snapshots = {}, {}

        warnings = self.updater.update_one_date("2026-06-20", self.portfolio, prices, snapshots)

        self.assertEqual(warnings, [])
        self.assertEqual(calls, [("SEC", "2026-06-20")])
        self.assertEqual(prices["2026-06-20"]["securities"], {"SEC": 999})
        snapshot = snapshots["2026-06-20"]
        self.assertEqual(snapshot["rawHoldingProfit"], 100)
        self.assertEqual(snapshot["symbols"]["Stock A"], 100)
        self.assertEqual(snapshot["allocation"], {"ETF": 0, "개별주식": 0, "현금": 1100})
        self.assertEqual(snapshot["cumulativeReturn"], 10)

    def test_pre_sale_backfill_still_fetches_the_historical_position(self):
        calls = []
        self.updater.fetch_close = lambda ticker, date, **_kw: calls.append((ticker, date)) or (date, 90, None)
        prices, snapshots = {}, {}

        warnings = self.updater.update_one_date("2026-06-19", self.portfolio, prices, snapshots)

        self.assertEqual(warnings, [])
        self.assertEqual(calls, [("SEC", "2026-06-19")])
        self.assertEqual(prices["2026-06-19"]["securities"], {"SEC": 90})
        self.assertEqual(snapshots["2026-06-19"]["rawHoldingProfit"], -100)
        self.assertEqual(snapshots["2026-06-19"]["symbols"]["Stock A"], -100)
        self.assertEqual(self.updater.account1_principal_for_date("2026-06-19", self.portfolio), 1000)
        self.assertEqual(self.updater.account1_principal_for_date("2026-06-20", self.portfolio), 1000)

    def test_post_sale_date_excludes_closed_position_from_fetch_and_symbol_snapshot(self):
        calls = []
        self.updater.fetch_close = lambda ticker, date, **_kw: calls.append((ticker, date)) or (date, 999, None)
        prices, snapshots = {}, {}

        warnings = self.updater.update_one_date("2026-06-21", self.portfolio, prices, snapshots)

        self.assertEqual(warnings, [])
        self.assertEqual(calls, [])
        self.assertEqual(prices["2026-06-21"]["securities"], {})
        self.assertNotIn("Stock A", snapshots["2026-06-21"]["symbols"])
        self.assertEqual(snapshots["2026-06-21"]["rawHoldingProfit"], 100)

    def test_historical_sale_cash_ignores_stale_saved_cash_and_is_idempotent(self):
        stale_snapshots = {
            "2026-06-20": {"rawHoldingProfit": 0, "allocation": {"현금": 0}},
            "2026-06-21": {"rawHoldingProfit": 100, "allocation": {"현금": 1100}},
        }
        prices = {
            "2026-06-19": {"display": True, "securities": {"SEC": 90}, "pension": {}},
            "2026-06-20": {"display": True, "securities": {}, "pension": {}},
        }

        self.assertEqual(
            self.updater.securities_cash_for_date("2026-06-20", self.portfolio, stale_snapshots),
            1100,
        )
        first = self.updater.calculate_performance_snapshot("2026-06-20", self.portfolio, prices, stale_snapshots)
        second = self.updater.calculate_performance_snapshot("2026-06-20", self.portfolio, prices, stale_snapshots)
        self.assertEqual(first, second)
        self.assertEqual(first["rawHoldingProfit"], 100)
        self.assertEqual(first["allocation"]["현금"], 1100)

    def test_rebuy_cash_principal_delta_prevents_principal_double_count(self):
        portfolio = copy.deepcopy(self.portfolio)
        portfolio["constants"]["securitiesCash"] = 500
        portfolio["securities"][0].update({"qty": 6, "cost": 600})
        portfolio["securitiesEvents"].append({
            "id": "rebuy-a", "date": "2026-06-21", "type": "buy", "ticker": "SEC",
            "qty": 6, "price": 100, "amount": 600, "cashPrincipalDelta": -600,
        })

        self.assertEqual(self.updater.security_cash_principal_for_date("2026-06-20", portfolio), 1000)
        self.assertEqual(self.updater.security_cash_principal_for_date("2026-06-21", portfolio), 400)
        self.assertEqual(self.updater.account1_principal_for_date("2026-06-20", portfolio), 1000)
        self.assertEqual(self.updater.account1_principal_for_date("2026-06-21", portfolio), 1000)
        state = self.updater.security_position_state(portfolio["securities"][0], "2026-06-21", portfolio)
        self.assertEqual(state["realizedProfit"], 100)
        self.assertEqual(state["realizedCostBasis"], 1000)

    def test_same_day_sale_and_rebuy_cash_principal_uses_daily_net_delta(self):
        portfolio = copy.deepcopy(self.portfolio)
        portfolio["constants"]["securitiesCash"] = 450
        portfolio["securities"][0].update({"qty": 6, "cost": 600})
        portfolio["securitiesEvents"] = [
            {
                "id": "a-rebuy", "date": "2026-06-20", "type": "buy", "ticker": "SEC",
                "qty": 6, "price": 100, "amount": 600, "cashPrincipalDelta": -600,
            },
            {
                "id": "z-sell", "date": "2026-06-20", "type": "sell", "ticker": "SEC", "qty": 10,
                "price": 105, "grossAmount": 1050, "transactionCost": 0, "amount": 1050,
                "costBasis": 1000, "realizedProfit": 50, "cashPrincipalDelta": 1000,
            },
        ]

        self.assertEqual(self.updater.security_cash_principal_for_date("2026-06-19", portfolio), 0)
        self.assertEqual(self.updater.security_cash_principal_for_date("2026-06-20", portfolio), 400)
        self.assertEqual(self.updater.account1_principal_for_date("2026-06-20", portfolio), 1000)
        before = self.updater.security_position_state(portfolio["securities"][0], "2026-06-19", portfolio)
        self.assertEqual((before["qty"], before["cost"]), (10, 1000))

    def test_invalid_sale_contract_and_negative_cash_principal_fail_closed(self):
        bad_sale = copy.deepcopy(self.portfolio)
        bad_sale["securitiesEvents"][0]["transactionCost"] = 10
        with self.assertRaisesRegex(ValueError, "순매도대금"):
            self.updater.security_position_state(bad_sale["securities"][0], "2026-06-20", bad_sale)

        bad_principal = copy.deepcopy(self.portfolio)
        bad_principal["securitiesEvents"] = [{
            "id": "bad-buy", "date": "2026-06-20", "type": "buy", "ticker": "SEC",
            "qty": 1, "amount": 100, "cashPrincipalDelta": -100,
        }]
        with self.assertRaisesRegex(ValueError, "현금화 원금이 음수가"):
            self.updater.security_cash_principal_for_date("2026-06-20", bad_principal)

    def test_committed_samsung_electro_mechanics_sale_matches_js_contract(self):
        portfolio = json.loads((ROOT / "data" / "portfolio.json").read_text(encoding="utf-8"))
        prices = json.loads((ROOT / "data" / "prices.json").read_text(encoding="utf-8"))
        snapshots = json.loads((ROOT / "data" / "performance_snapshots.json").read_text(encoding="utf-8"))
        item = next(item for item in portfolio["securities"] if item["ticker"] == "009150")

        before_state = self.updater.security_position_state(item, "2026-09-15", portfolio)
        after_state = self.updater.security_position_state(item, "2026-09-16", portfolio)
        self.assertEqual((before_state["qty"], before_state["cost"]), (1, 1345000))
        self.assertEqual((after_state["qty"], after_state["cost"]), (0, 0))
        self.assertEqual(after_state["realizedProfit"], 228)
        self.assertEqual(after_state["realizedCostBasis"], 1345000)
        self.assertEqual(self.updater.securities_cash_for_date("2026-09-15", portfolio, snapshots), 58790)
        self.assertEqual(self.updater.securities_cash_for_date("2026-09-16", portfolio, snapshots), 3790)
        self.assertEqual(self.updater.account1_principal_for_date("2026-09-15", portfolio), 24341210)
        self.assertEqual(self.updater.account1_principal_for_date("2026-09-16", portfolio), 22996210)

        before = self.updater.calculate_performance_snapshot("2026-09-15", portfolio, prices, snapshots)
        after = self.updater.calculate_performance_snapshot("2026-09-16", portfolio, prices, snapshots)
        self.assertEqual(before["symbols"]["삼성전기"], -28000)
        self.assertEqual(after["symbols"]["삼성전기"], 228)
        committed_after = snapshots["2026-09-16"]
        self.assertEqual(committed_after["updatedAtKST"], prices["2026-09-16"]["updatedAtKST"])
        self.assertEqual(committed_after["rawHoldingProfit"], after["rawHoldingProfit"])
        self.assertEqual(committed_after["dailyProfit"], after["dailyProfit"])
        self.assertEqual(after["dailyProfit"], after["rawHoldingProfit"] - snapshots["2026-09-15"]["rawHoldingProfit"])
        self.assertEqual(after["allocation"]["현금"], 3790)
        self.assertIn("삼성전기", after["symbols"])
        post_sale = self.updater.calculate_performance_snapshot(
            "2026-09-17",
            portfolio,
            prices,
            {**snapshots, "2026-09-16": after},
        )
        self.assertNotIn("삼성전기", post_sale["symbols"])
        post_unrealized_profit = 0
        for security in portfolio["securities"]:
            state = self.updater.security_position_state(security, "2026-09-17", portfolio)
            price = int(prices["2026-09-17"]["securities"].get(security["ticker"], 0))
            post_unrealized_profit += int(round(price * float(state["qty"]))) - int(state["cost"])
        self.assertEqual(post_sale["rawHoldingProfit"] - post_unrealized_profit, 228)
        # 운영 JSON에는 과거 오류가 남아 있을 수 있다. 재갱신이 이를 정정하는지 검증한다.
        saved_row = copy.deepcopy(prices["2026-09-17"])
        self.updater.fetch_close = lambda ticker, date, **kw: (
            date, saved_row["pension" if kw.get("is_etf") and ticker not in saved_row["securities"] else "securities"][ticker], None
        )
        self.updater.update_one_date("2026-09-17", portfolio, prices, snapshots)
        self.assertEqual(snapshots["2026-09-17"]["rawHoldingProfit"], post_sale["rawHoldingProfit"])
        self.assertNotIn("삼성전기", snapshots["2026-09-17"]["symbols"])
        withdrawal = next(event for event in portfolio["securitiesEvents"] if event.get("id") == "sec-withdrawal-20260916-internal-cash-return")
        self.assertEqual((withdrawal["amount"], withdrawal["principalAmount"], withdrawal["cashPrincipalDelta"]), (1400228, 1345000, -1345000))



if __name__ == "__main__":
    unittest.main()
