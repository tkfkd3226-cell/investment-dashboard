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
            "securities": [{"ticker": "SEC", "qty": 1, "cost": 100}],
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

    def test_close_snapshot_is_tagged_as_regular_close(self):
        self.updater.fetch_close = lambda ticker, date: (date, 100 if ticker == "SEC" else 200, None)
        prices, snapshots = {}, {}

        self.updater.update_one_date("2026-09-09", self.portfolio, prices, snapshots)

        self.assertEqual(prices["2026-09-09"]["marketStatus"], "close")
        self.assertEqual(prices["2026-09-09"]["priceBasis"], "regular_close")

    def test_intraday_snapshot_is_tagged_as_intraday(self):
        self.updater.market_status_for_date = lambda _: "intraday"
        self.updater.fetch_close = lambda ticker, date: (date, 100 if ticker == "SEC" else 200, None)
        prices, snapshots = {}, {}

        self.updater.update_one_date("2026-09-09", self.portfolio, prices, snapshots)

        self.assertEqual(prices["2026-09-09"]["marketStatus"], "intraday")
        self.assertEqual(prices["2026-09-09"]["priceBasis"], "intraday")

    def test_fetch_close_uses_krx_source_after_regular_close(self):
        calls = []

        class FakeRow:
            def __getitem__(self, key):
                return 1759000 if key == "종가" else None

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

        self.updater.stock.get_market_ohlcv_by_date = fake_getter
        self.updater.market_status_for_date = lambda _: "close"
        actual, close, error = self.updater.fetch_close("000660", "2026-09-16", retries=0)

        self.assertEqual((actual, close, error), ("2026-09-16", 1759000, None))
        self.assertEqual(calls[0][1], {"adjusted": False})

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

        self.updater.stock.get_market_ohlcv_by_date = fake_getter
        self.updater.market_status_for_date = lambda _: "intraday"
        self.updater.fetch_close("000660", "2026-09-16", retries=0)

        self.assertEqual(calls[0][1], {})


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
        self.updater.fetch_close = lambda ticker, date: calls.append((ticker, date)) or (date, 999, None)
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
        self.updater.fetch_close = lambda ticker, date: calls.append((ticker, date)) or (date, 90, None)
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
        self.updater.fetch_close = lambda ticker, date: calls.append((ticker, date)) or (date, 999, None)
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
        self.assertEqual(before["symbols"]["삼성전기"], -15000)
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
            {**prices, "2026-09-17": {"display": True, "marketStatus": "close", "securities": {}, "pension": {}}},
            {**snapshots, "2026-09-16": after},
        )
        self.assertNotIn("삼성전기", post_sale["symbols"])
        withdrawal = next(event for event in portfolio["securitiesEvents"] if event.get("id") == "sec-withdrawal-20260916-internal-cash-return")
        self.assertEqual((withdrawal["amount"], withdrawal["principalAmount"], withdrawal["cashPrincipalDelta"]), (1400228, 1345000, -1345000))



if __name__ == "__main__":
    unittest.main()
