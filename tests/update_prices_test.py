#!/usr/bin/env python3
"""Regression tests for safe KRX closing-price publication."""

import importlib.util
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


if __name__ == "__main__":
    unittest.main()
