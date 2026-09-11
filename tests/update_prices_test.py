#!/usr/bin/env python3
"""Regression tests for safe KRX closing-price publication."""

import importlib.util
import copy
import json
import sys
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_updater():
    # The production workflow installs pykrx.  The regression test only exercises
    # update_one_date with a mocked fetcher, so a tiny import stub is sufficient.
    pykrx = types.ModuleType("pykrx")
    pykrx.stock = types.SimpleNamespace()
    sys.modules.setdefault("pykrx", pykrx)
    requests = types.ModuleType("requests")
    requests.get = lambda *_, **__: None
    sys.modules.setdefault("requests", requests)
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
            "securities": [{"ticker": "SEC"}],
            "pension": [{"ticker": "PEN"}],
            "securitiesEvents": [],
        }

    def test_stale_close_is_hidden_and_records_each_symbol_source_date(self):
        self.updater.fetch_close = lambda ticker, _: ("2026-09-08", 100 if ticker == "SEC" else 200, None)
        prices, snapshots = {}, {}

        warnings = self.updater.update_one_date("2026-09-09", self.portfolio, prices, snapshots)

        row = prices["2026-09-09"]
        self.assertTrue(warnings)
        self.assertFalse(row["display"])
        self.assertEqual(row["actualMarketDate"], "2026-09-08")
        self.assertEqual(row["priceSourceDates"], {"SEC:SEC": "2026-09-08", "PEN:PEN": "2026-09-08"})

    def test_fetch_fallback_is_hidden_and_keeps_previous_source_date(self):
        self.updater.fetch_close = lambda *_: (None, None, "network error")
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

    def test_warning_hidden_date_is_automatically_retried(self):
        self.updater.today_kst = lambda: "2026-09-09"
        self.updater.resolve_latest_market_date = lambda *_: "2026-09-09"
        self.updater.is_actual_trading_date = lambda *_: True
        prices = {
            "2026-09-08": {"display": True},
            "2026-09-09": {"display": False, "warnings": ["network error"]},
        }

        dates = self.updater.resolve_target_dates(self.portfolio, prices, None)

        self.assertEqual(dates, ["2026-09-09"])


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
        self.updater.fetch_close = lambda *_: ("2026-09-08", 110, None)
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
        self.updater.fetch_close = lambda *_: ("2026-09-08", 115, None)
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
                self.updater.fetch_close = lambda _, date: (date, closes[date], None)
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


if __name__ == "__main__":
    unittest.main()
