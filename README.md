# 투자 대시보드

삼성증권 증권계좌와 퇴직연금의 현재 상태·과거 복원·장부 검산을 위한 정적 웹 대시보드입니다. 화면은 GitHub Pages에서 동작하고, KRX 가격/성과 스냅샷은 GitHub Actions + Python, 브라우저 쓰기 작업은 Google Apps Script Web App을 사용합니다. Market AI 연결은 선택 기능이며 저장 JSON을 바꾸지 않는 화면 overlay입니다.

## 1. 주요 화면

### Main Dashboard — `index.html`

- 증권/퇴직연금 날짜별 상태와 성과 복원
- 투자원금·평가금액·누적손익·수익률·계좌별 상세
- 증권 `securitiesEvents` 기반 매도·실현손익·현금화 원금·재매수 복원
- 별도수익 ON/OFF, KOSPI 비교, 차트, 월간 손익, 포트폴리오 히트맵
- 퇴직연금 조회·기업적립금/현금성자산/ETF 조정
- KRX 가격 갱신, Market AI 시장/신호, 보유종목 Live Valuation
- Light/Dark, Desktop/Tablet/Phone, Print

세부 architecture·responsive·운영 contract는 `main_dashboard_maintenance_handover.md`를 봅니다.

### 투자 계산기 — `add/calc.html`

KODEX 레버리지 기존 보유분·추가매수·목표 매도단가·회수금액 등을 계산합니다.

### KODEX 거래 리포트 — `add/kodex-leverage-report.html`

`data/kodex_leverage_trades.json`을 단일 거래 원천으로 사용해 실현손익, 본 포지션/단타 분류, 차트, Timeline을 파생합니다. Calc/Report의 계산·데이터 contract는 `add_maintenance_handover.md`를 봅니다.

## 2. 실행 구조

```text
GitHub Pages
  └─ index.html / add/*.html
      └─ ES Module / add runtime
          └─ data/*.json

퇴직연금 저장·KRX 요청
  Browser → GAS Web App → GitHub API / Actions

KRX 갱신
  update-prices.yml → scripts/update_prices.py
  → data/prices.json
  → data/performance_snapshots.json
  → data/krx_trading_calendar.json

Market AI
  Dashboard → dashboard-market-ai-client.js
  ├─ dashboard-market-ai.js          # 시장/신호
  └─ dashboard-live-valuation.js     # 보유종목 현재가 overlay
```

Market AI는 Dashboard의 수량·원가·원금·거래원장·historical snapshot을 소유하지 않습니다. unusable ticker는 해당 ticker만 저장 JSON 값으로 fallback하며, overlay 값은 운영 JSON/GAS에 저장하지 않습니다.

## 3. 프로젝트 구조

```text
index.html
GAS_code.js

css/
  common.css
  tablet.css
  mobile.css
  special.css
  interaction.css
  print.css

js/
  kodex-leverage-schema.js
  dashboard-core.js
  dashboard-ui-common.js
  dashboard-modal.js
  dashboard-monthly-calendar.js
  dashboard-heatmap.js
  dashboard-charts.js
  dashboard-ui.js
  dashboard-pension.js
  dashboard-pension-editor.js
  dashboard-market-ai-client.js
  dashboard-live-valuation.js
  dashboard-app.js
  dashboard-market-ai.js

add/
  calc.html
  kodex-leverage-report.html
  add.css
  add.js

data/
img/
scripts/update_prices.py
.github/workflows/{pages.yml,update-prices.yml}
tests/
```

`dashboard-app.js`가 Main 13개 모듈 graph의 entry이고 `dashboard-market-ai.js`는 standalone entry입니다. 자세한 dependency 책임은 Main handover가 소유합니다.

## 4. 주요 데이터

| 파일 | 역할 |
|---|---|
| `data/portfolio.json` | 현재 보유상태, 증권 거래/원금 원장 |
| `data/kodex_leverage_trades.json` | KODEX 실현거래 canonical 원천 |
| `data/prices.json` | 날짜별 종목·상품 가격과 지수 |
| `data/performance_snapshots.json` | 날짜별 성과 스냅샷 |
| `data/account1_daily_snapshots.json` | 증권계좌 일별 복원 데이터 |
| `data/pension_contributions.json` | 퇴직연금 적립·조정 |
| `data/pension_cash_snapshots.json` | 퇴직연금 현금성자산 |
| `data/pension_trades.json` | 퇴직연금 거래 이력 |
| `data/krx_trading_calendar.json` | KRX 거래일/휴장 판정 보조 |
| `data/pension_operation_ledger/` 등 | GAS durable idempotency/state |
| `data/krx_dispatch_ledger/` | KRX requestId durable state |

운영 데이터는 일반 UI 패치에 과거 복사본을 섞지 않습니다.

## 5. KRX / GAS 운영 핵심

- Root `GAS_code.js`가 canonical GAS source입니다. GitHub 파일 교체만으로 운영 Web App이 갱신되지 않으므로 Apps Script 새 버전 배포가 필요합니다.
- 인증/연동값은 Script Properties 또는 GitHub Actions Secrets에 두며 프런트엔드에 넣지 않습니다.
- GitHub Secrets `KRX_ID`, `KRX_PW`가 필요합니다.
- KRX 오늘 데이터는 KST `09:00 ≤ t < 15:30` 장중, **15:30 정각부터 정규장 종가**를 사용합니다.
- 2026-09-14 이후 장마감/과거일은 네이버 KRX 1분봉의 정확한 `15:30:00` 행만 정규장 종가로 인정합니다. 없으면 다른 가격으로 대체하지 않고 fail-closed 합니다.
- workflow 자동 commit 대상은 `prices.json`, `performance_snapshots.json`, `krx_trading_calendar.json`입니다.
- `pages.yml`은 KRX workflow 성공 완료 후 최신 `main`을 배포합니다.
- KRX 자동 scheduler 설치/변경은 `installKrxAutoScheduler()`, 상태 확인은 `showKrxAutoSchedulerStatus()`, 중지는 `removeKrxAutoScheduler()`를 사용합니다.

상세 race/idempotency/recovery contract는 Main handover와 실제 `GAS_code.js`를 봅니다.

## 6. GitHub Pages

`_config.yml`은 Pages 배포에서 backend/운영 문서/테스트 등 비런타임 파일을 제외합니다. Root에는 Main runtime과 공유 asset만 두고, Add 화면은 `add/` 경로를 유지합니다.

## 7. 자동 QA

저장소 전체 기본 검증:

```bash
node --test tests/*.test.cjs
python -m unittest tests/update_prices_test.py
```

기능별 테스트 책임과 변경 범위별 실행 기준은 `main_dashboard_maintenance_handover.md`의 **QA 체계**가 소유합니다. 이미 전용 행동 테스트가 있는 기능의 내부 구현문을 다른 contract 테스트에서 중복 고정하지 않습니다.

## 8. 문서 역할

`README.md`는 프로젝트 개요와 진입점만 다룹니다. Main/Add 유지보수 contract는 각 handover, 평가 규칙은 `dashboard_evaluation_guide.md`와 `ct35_evaluation.md`를 봅니다.

실제 구현/운영값은 **최신 소스와 데이터가 최종 Source of Truth**입니다. 문서는 코드에서 바로 읽을 수 있는 구현 세부를 복제하지 않습니다.
