# 투자 대시보드

삼성증권 증권계좌와 퇴직연금 계좌의 **날짜별 투자 성과를 복원·검산·분석하기 위한 정적 웹 대시보드**입니다.

메인 화면은 GitHub Pages에서 제공하며, KRX 가격과 성과 스냅샷은 GitHub Actions + Python으로 갱신합니다. 퇴직연금 금액 조정과 KRX 갱신 요청처럼 브라우저에서 직접 저장소 파일을 수정할 수 없는 쓰기 작업은 별도로 배포된 Google Apps Script Web App을 통해 처리합니다.

별도 `market-ai` 프로젝트가 실행 중이면 현재 시장·AI 신호를 대시보드에 함께 표시할 수 있습니다. 로컬에서는 Market AI FastAPI에 직접 연결하고, 외부 GitHub Pages에서는 Tailscale Serve를 통해 같은 실제 데이터를 조회합니다.

---

## 1. 프로젝트 목적

이 저장소는 단순 시세 조회 화면이 아니라 다음 세 가지를 함께 관리하는 것을 목표로 합니다.

1. **현재 보유 현황**
   - 증권계좌와 퇴직연금의 자산·손익·비중 확인

2. **날짜별 복원**
   - 과거 특정 날짜의 계좌 상태와 성과 재구성

3. **장부 검산**
   - 실제 보유액, 투자원금, 실현손익, 현금 흐름의 일관성 확인

프런트엔드는 별도 프레임워크나 번들러 없이 **HTML + CSS + Vanilla JavaScript ES Module**로 구성합니다.

---

## 2. 주요 기능

### 2.1 Main Dashboard

메인 화면:

```text
index.html
```

주요 기능:

- 날짜별 증권계좌 성과 복원
- 투자원금·평가금액·누적손익·수익률 조회
- 계좌별 성과 요약과 보유 종목 현황
- 장부결과 VS 실제보유 검산
- 투자원금 원천 및 검산
- 별도수익 ON/OFF 비교
- KOSPI 대비 초과성과 확인
- 퇴직연금 날짜별 성과 및 상품 현황
- 퇴직연금 상품별 손익·비중·인사이트
- 위험자산 비중 관리
- 기업적립금·현금성자산·ETF 추가매수 조정
- PIN 기반 퇴직연금 저장·삭제
- 누적손익·수익률·비중 변화 등 기간 차트
- Light / Dark 테마
- Desktop / Tablet / Mobile 반응형 UI
- Print 전용 출력

### 2.2 투자 계산기

```text
add/calc.html
```

KODEX 레버리지 보유분과 추가매수 시나리오를 계산하기 위한 보조 화면입니다.

주요 기능:

- 기존 보유분 기준 계산
- 추가매수 시 평균단가 계산
- 목표 매도단가 계산
- 회수 대상 금액 및 잔여현금 계산
- 추가매수 단가·수량 입력 및 시나리오 계산
- 기본값 복원
- Desktop / Tablet / Mobile 반응형 UI

### 2.3 KODEX 레버리지 거래 리포트

```text
add/kodex-leverage-report.html
```

`data/kodex_leverage_trades.json`을 기준으로 KODEX 레버리지 거래와 실현손익을 집계하는 리포트 화면입니다.

Main의 별도수익과 Add Report는 같은 canonical 거래 원천을 사용합니다.

### 2.4 Market AI 연동

Market AI는 Main의 **현재 시점 시장 신호**와 **오늘 보유종목의 현재가 overlay**를 제공하는 선택형 실시간 subsystem입니다.

- KOSPI, KOSPI200 선물, SOX, NQ100 선물과 AI 신호 표시
- 오늘 보유 중인 증권·퇴직연금 종목의 KIS eFriend `SC_R` 현재가를 화면 계산에 overlay
- 실시간 현재가는 현재가·평가금액·평가손익·수익률 등 **현재가 의존 파생값만** 다시 계산하며 수량·원가·원금·매매흐름·실현손익은 바꾸지 않음
- 실시간 quote는 브라우저 메모리에서만 사용하고 `prices.json`, `performance_snapshots.json`, Pension 장부 JSON에는 저장하지 않음
- 과거 날짜는 실시간 값을 적용하지 않고 저장된 JSON/스냅샷 의미를 유지
- usable quote가 없는 종목은 종목별로 기존 JSON 값으로 fallback
- Hero에서 `LIVE / CLOSED / STALE / JSON` 상태와 시세 기준을 표시하고, 종목·상품 셀의 커스텀 툴팁에서 Market AI/JSON 출처를 확인 가능
- Desktop / Tablet의 Market AI 신호는 Hero 우측 보조 카드, Mobile / 실제 터치폰 가로 UI는 **AI Signal** dialog로 표시
- Local: Market AI FastAPI 직접 조회
- GitHub Pages: Tailscale Serve를 통해 같은 실제 데이터 조회
- Market AI가 응답하지 않아도 Main Dashboard의 저장 데이터 기반 기능은 독립 동작

`dashboard-market-ai.js`는 현재 시장·AI 신호 panel을, `dashboard-live-valuation.js`는 오늘 보유종목 평가 overlay를 담당하며 두 기능은 `dashboard-market-ai-client.js`의 local/remote transport contract를 공유합니다. 세부 polling, stale/source 판정, multi-client quote universe와 KIS subscription health는 `main_dashboard_maintenance_handover.md`와 Market AI 프로젝트 문서에서 관리합니다.

---

## 3. 전체 동작 구조

### 3.1 일반 조회

```text
GitHub Pages / Browser
          ↓
      index.html
          ↓
   ES Module frontend
          ↓
      data/*.json
          ↓
   계산 / 화면 렌더링
```

Main의 JavaScript entry point는 `js/dashboard-app.js`입니다.

Market AI는 `js/dashboard-market-ai.js`가 별도 standalone entry로 동작합니다.

### 3.2 퇴직연금 저장

```text
Browser
   ↓
Google Apps Script Web App
   ↓
GitHub REST API
   ↓
pension 관련 JSON
   ↓
GitHub commit
```

브라우저가 GitHub 저장소에 직접 write하지 않습니다.

### 3.3 KRX 가격 갱신

```text
Browser / 수동 실행
          ↓
Google Apps Script 또는 workflow_dispatch
          ↓
.github/workflows/update-prices.yml
          ↓
scripts/update_prices.py
          ↓
data/prices.json
data/performance_snapshots.json
```

### 3.4 Market AI 조회

```text
Dashboard
   ├─ dashboard-market-ai.js
   │    → 현재 Market Snapshot / Signal / Bridge 상태
   │
   └─ dashboard-live-valuation.js
        → 오늘 보유 ticker universe
        → /api/market-data/krx-quotes
        → usable quote만 메모리 overlay

공통 transport
   → dashboard-market-ai-client.js
   → Local : http://127.0.0.1:8001
   → Remote: https://node.tail60a98e.ts.net
```

외부 GitHub Pages에서는 FastAPI 포트를 직접 인터넷에 공개하지 않고 Tailscale Serve를 통해 접근합니다. 보유종목 실시간 평가는 **현재 KST 날짜에서만** 화면 계산에 적용하며, 과거 날짜와 운영 JSON은 변경하지 않습니다.

---

## 4. 프로젝트 구조

```text
investment-dashboard/
├─ index.html
│
├─ css/
│  ├─ common.css
│  ├─ tablet.css
│  ├─ mobile.css
│  ├─ special.css
│  ├─ interaction.css
│  └─ print.css
│
├─ js/
│  ├─ kodex-leverage-schema.js
│  ├─ dashboard-core.js
│  ├─ dashboard-ui-common.js
│  ├─ dashboard-modal.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-pension-editor.js
│  ├─ dashboard-market-ai-client.js
│  ├─ dashboard-live-valuation.js
│  ├─ dashboard-app.js
│  └─ dashboard-market-ai.js
│
├─ data/
│  ├─ portfolio.json
│  ├─ kodex_leverage_trades.json
│  ├─ prices.json
│  ├─ performance_snapshots.json
│  ├─ account1_daily_snapshots.json
│  ├─ pension_contributions.json
│  ├─ pension_cash_snapshots.json
│  ├─ pension_operation_ledger.json   # v6 cash legacy history, read-only fallback
│  ├─ pension_operation_ledger/       # semantic-hash shard, 필요 시 00~ff.json 생성
│  ├─ pension_operation_identity/     # exact identity shard, 필요 시 00~ff.json 생성
│  ├─ pension_batch_request_identity/ # batchRequestId durable shard, 필요 시 00~ff.json 생성
│  ├─ krx_dispatch_ledger/             # KRX requestId durable shard, 필요 시 00~ff.json 생성
│  └─ pension_trades.json
│
├─ img/
│  ├─ favicon.png
│  ├─ hero-bg.webp
│  └─ ui-icons.svg
│
├─ add/
│  ├─ calc.html
│  ├─ kodex-leverage-report.html
│  ├─ add.css
│  └─ add.js
│
├─ scripts/
│  └─ update_prices.py
│
├─ tests/
│  ├─ main-calc.test.cjs
│  ├─ main-ui-contract.test.cjs
│  ├─ add-calc.test.cjs
│  ├─ add-report-data.test.cjs
│  ├─ add-ui-contract.test.cjs
│  ├─ cross-ui-contract.test.cjs
│  └─ update_prices_test.py
│
├─ .github/
│  └─ workflows/
│     └─ update-prices.yml
│
├─ .gitignore
├─ requirements.txt
├─ README.md
├─ main_dashboard_maintenance_handover.md
├─ add_maintenance_handover.md
└─ dashboard_evaluation_guide.md
```

`img/favicon.png`은 Main과 Add가 함께 사용하는 공통 favicon입니다.

---

## 5. 구현 구성 요약

Main은 `index.html`에서 시작하고 `js/dashboard-app.js`가 전체 화면 흐름을 조율합니다. 오늘 보유종목의 실시간 평가 overlay는 main graph의 `js/dashboard-live-valuation.js`가 담당하고, `js/dashboard-market-ai.js`는 현재 시장·AI 신호 조회를 별도 standalone entry로 담당합니다. 두 경로는 endpoint/timeout 선택만 `js/dashboard-market-ai-client.js`에서 공유합니다.

Main CSS는 다음 역할 파일로 나뉩니다.

```text
common.css       공통 / Desktop baseline
tablet.css       Tablet
mobile.css       Mobile
special.css      기능상 필요한 특수 viewport
interaction.css  hover / pointer
print.css        Print
```

Add는 `add/calc.html`과 `add/kodex-leverage-report.html`이 `add/add.css`, `add/add.js`를 공유합니다.

JavaScript dependency/state ownership, CSS cascade, responsive 예외, Main UI contract는 `main_dashboard_maintenance_handover.md`에서 관리하고, Calc/Report의 계산·UI contract는 `add_maintenance_handover.md`에서 관리합니다.

---

## 6. 데이터 구조

| 파일 | 용도 |
|---|---|
| `data/portfolio.json` | 보유자산, 투자원금 기준 및 기본 포트폴리오 정보 |
| `data/kodex_leverage_trades.json` | KODEX 레버리지 거래·실현손익의 canonical 원천 |
| `data/prices.json` | 날짜별 종목·상품 가격과 지수 |
| `data/performance_snapshots.json` | 날짜별 성과 스냅샷 |
| `data/account1_daily_snapshots.json` | 증권계좌 일별 복원 데이터 |
| `data/pension_contributions.json` | 퇴직연금 적립·조정 데이터 |
| `data/pension_cash_snapshots.json` | 퇴직연금 현금성자산 스냅샷 |
| `data/pension_operation_ledger.json` | v6 cash operation legacy history의 read-only fallback |
| `data/pension_operation_ledger/*.json` | 모든 Pension upsert/delete logical operation의 semantic durable history. semantic hash 앞 2자리로 직접 조회하며 800건 ring buffer를 사용하지 않음 |
| `data/pension_operation_identity/*.json` | requestId/logicalOperationId/batchRequestId+operationId의 exact identity durable index. payload 내용과 무관한 identity hash 앞 2자리로 조회하여 같은 identity+다른 내용 재사용을 장기 차단 |
| `data/pension_batch_request_identity/*.json` | batchRequestId 자체의 durable index. receipt GC 뒤 operationId를 바꿔 같은 batchRequestId를 다른 작업 묶음에 재사용하는 우회를 차단 |
| `data/krx_dispatch_ledger/*.json` | KRX 완료 requestId/hash/workflow run ID의 durable shard history. Script Properties receipt/intent GC 이후 동일 requestId 재-dispatch를 차단 |
| `data/pension_trades.json` | 퇴직연금 거래 이력 |

대시보드는 이 데이터를 결합해 선택 날짜의 계좌 상태와 성과를 계산합니다.

`data/kodex_leverage_trades.json`은 Main 별도수익과 Add KODEX Report가 함께 사용하는 단일 거래 원천이며, schema는 `js/kodex-leverage-schema.js`에서 검증합니다.

### 운영 데이터 주의

특히 다음 파일은 실제 운영 데이터이므로 소스 수정 패치에 과거 복사본이 섞이지 않도록 주의합니다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
data/pension_operation_ledger/*.json   # GAS가 생성·갱신하는 semantic operation history shard
data/pension_operation_identity/*.json # GAS가 생성·갱신하는 exact identity history shard
data/pension_batch_request_identity/*.json # GAS가 생성·갱신하는 batchRequestId durable shard
data/krx_dispatch_ledger/*.json        # GAS가 생성·갱신하는 KRX requestId durable history shard
```

코드 수정 패치는 원칙적으로 변경된 소스만 포함하고, 운영 JSON은 필요한 작업이 아닌 경우 함께 덮어쓰지 않습니다.

---

## 7. 데이터 쓰기와 갱신

### 7.1 Google Apps Script

퇴직연금 저장과 KRX 갱신 요청은 GitHub 저장소와 별도로 운영되는 Google Apps Script Web App을 사용합니다. 브라우저가 저장소에 직접 write하지 않으며, 운영 인증값과 GitHub 연동 정보도 프런트엔드 파일에 직접 두지 않습니다.

쓰기 요청은 **stable request identity + 최초 전송 payload 보존 + optimistic concurrency + ScriptLock/PENSION_MUTATION_EPOCH**을 기본 축으로 처리합니다. Pension의 모든 upsert/delete는 semantic operation ledger와 content-independent exact identity ledger를 사용해 retry, delete 후 resurrection, same identity/different content를 차단하며, 실제 business JSON 변경이 없는 terminal no-op도 완료 identity를 남깁니다. 다른 기기에서 동일 semantic 후보가 보이는 경우에는 자동 dedupe하지 않고 state-bound confirmation token으로 기존 처리/별도 작업을 다시 확인합니다.

Script Properties의 active intent는 단순 cap/TTL GC로 버리지 않습니다. **stale 판정이 끝난 Single/Batch intent는 GitHub durable identity/tombstone을 먼저 확보한 뒤 receipt로 승격해 active slot을 해제**하고, 장시간 응답이 없는 abandoned intent는 foreground 요청당 소수만 점진적으로 정리합니다. durable ledger가 이미 성공 완료를 증명하면 stale로 바꾸지 않고 completed receipt를 복구하며, prefix cap에서는 신규 slot 확보에 필요한 가장 오래된 1건만 별도로 terminalize합니다. KRX도 같은 원칙으로 durable dispatch 상태를 우선합니다. receipt/confirmation/marker는 prefix cap과 전체 내부 byte budget 안에서 관리합니다.

세부 GAS 운영 불변조건은 `main_dashboard_maintenance_handover.md` 6.2절, 평가용 반례와 점수 기준은 `dashboard_evaluation_guide.md`의 Frontend↔Backend contract 및 100점 Gate를 기준으로 합니다. README에는 구현 함수·차수별 패치 이력을 반복 기록하지 않습니다.

### 7.2 KRX 갱신

대시보드에서는 두 흐름을 사용합니다.

- **최신/누락 반영**: 최신 거래일, 누락 거래일, 장중 저장값의 종가 확정 등 필요한 갱신을 판단
- **선택 날짜 재갱신**: 현재 선택된 날짜를 대상으로 확인하고, 이미 종가 확정된 경우 불필요한 workflow 실행을 생략

처리 구조:

```text
갱신 요청
   ↓
Google Apps Script / workflow_dispatch
   ↓
.github/workflows/update-prices.yml
   ↓
scripts/update_prices.py
   ↓
prices.json / performance_snapshots.json
   ↓
변경 시 commit + push
```

GitHub Actions에서 직접 수동 실행할 때는 필요한 경우 대상 날짜를 지정할 수 있습니다. 같은 branch의 KRX workflow는 queue를 보존하며 직렬화하고, checkout 이후 remote 변경이 생기면 **계산과 무관한 commit만 rebase**합니다. 관리 파일이나 generation input이 바뀐 경우에는 fail-closed하며, push 응답 유실은 `PUSH_SHA`의 remote 포함 여부를 재확인해 성공을 실패로 오인하지 않습니다.

GAS는 KRX requestId의 intent/receipt와 durable dispatch ledger, workflow run ID/operation marker를 함께 사용합니다. 접수 여부를 끝내 확정하지 못한 requestId도 terminal fail-closed 상태로 수렴시켜 같은 ID의 중복 dispatch와 active intent 영구 누적을 동시에 막습니다. 세부 race/복구 시나리오는 유지보수 문서와 평가 가이드를 따릅니다.

---

## 8. GitHub Pages

배포 기준:

```text
Branch : main
Folder : / (root)
```

주요 경로:

```text
Main        /
Calc        /add/calc.html
Report      /add/kodex-leverage-report.html
```

GitHub Pages는 배포가 완료된 revision을 보여줍니다. 방금 수정한 로컬/ZIP revision의 개발 QA와 공개 배포본 확인은 구분합니다.

---

## 9. 자동 QA

Node·Python 기반 자동 테스트는 계산·데이터·UI contract와 가격 갱신 로직의 반복 회귀를 확인하기 위한 개발 안전망입니다.

```text
tests/
├─ main-calc.test.cjs
├─ main-ui-contract.test.cjs
├─ add-calc.test.cjs
├─ add-report-data.test.cjs
├─ add-ui-contract.test.cjs
├─ cross-ui-contract.test.cjs
└─ update_prices_test.py
```

전체 테스트:

```bash
node --test tests/*.test.cjs
python tests/update_prices_test.py
```

테스트의 역할:

| 파일 | 대상 |
|---|---|
| `main-calc.test.cjs` | Main 계산 회귀 |
| `main-ui-contract.test.cjs` | Main HTML/CSS/UI contract |
| `add-calc.test.cjs` | Add Calc 계산·validation |
| `add-report-data.test.cjs` | KODEX canonical 데이터와 Report/Main 파생 정합성 |
| `add-ui-contract.test.cjs` | Add HTML/CSS/UI contract |
| `cross-ui-contract.test.cjs` | Main↔Add 공통 UI contract |
| `update_prices_test.py` | KRX 가격 갱신·성과 스냅샷 causal ordering 회귀 |

어떤 수정에서 어떤 테스트를 우선 실행할지에 대한 상세 QA 절차는 각 handover 문서를 따릅니다.

자동 테스트 개수나 PASS 자체를 프로젝트 품질 점수로 해석하는 기준은 README가 담당하지 않습니다.

---

## 10. 유지보수 문서

프로젝트 문서는 역할별로 분리합니다.

| 문서 | 역할 |
|---|---|
| [README.md](./README.md) | GitHub 프로젝트 소개, 기능, 전체 구조, 데이터·배포·실행 개요 |
| [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md) | Main 인수인계, 수정, CSS/JS/UI contract, Main QA |
| [add_maintenance_handover.md](./add_maintenance_handover.md) | Calc/Report 인수인계, 계산·데이터 contract, Add QA |
| [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md) | Main+Add 평가 방식, 점수, A/B/C, 감점·비감점 기준 |

### 역할별 Source of Truth

```text
실제 현재 구현
→ repository의 실제 HTML / CSS / JS / data / scripts / workflows / tests

Main 유지보수 contract
→ main_dashboard_maintenance_handover.md

Add 유지보수 contract
→ add_maintenance_handover.md

Main↔Add 공통 contract
→ main_dashboard_maintenance_handover.md 8장
→ 실행 정합성은 tests/cross-ui-contract.test.cjs

평가·점수·A/B/C
→ dashboard_evaluation_guide.md

프로젝트 소개
→ README.md

과거 변경 이력
→ Git history
```

README에는 세부 selector, px 값, JavaScript state ownership, 평가 규칙, 차수별 리팩토링 이력을 중복해서 기록하지 않습니다.

---

## 11. 저장소 관리 원칙

Python 실행 중 생성되는 cache 등은 저장소에 포함하지 않습니다.

```gitignore
__pycache__/
*.pyc
```

현재 구현의 세부 유지보수 규칙은 README에 누적하지 않고 해당 handover 문서에서 관리합니다. 프로젝트의 기능·파일 구성·배포 구조가 바뀌었을 때만 README를 함께 갱신합니다.
