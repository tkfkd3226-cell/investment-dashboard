# 투자 대시보드

> **문서 성격**: GitHub 저장소의 **프로젝트 소개 · 주요 기능 · 실행 경로 · 전체 구조 · 운영/배포 개요**를 설명합니다.  
> selector, state ownership, responsive 세부 수치, GAS transaction/idempotency 내부 알고리즘, 평가 점수 기준은 각각의 handover/evaluation 문서가 소유합니다.

삼성증권 증권계좌와 퇴직연금 계좌의 **날짜별 투자 성과를 복원·검산·분석하기 위한 정적 웹 대시보드**입니다.

정적 화면은 GitHub Pages에서 동작합니다. KRX 가격과 성과 스냅샷은 GitHub Actions + Python으로 갱신하고, 브라우저 쓰기 작업은 별도 Google Apps Script Web App을 사용합니다. 선택적으로 `market-ai` runtime에 연결해 현재 시장·AI Signal과 보유종목 현재가를 화면에 overlay할 수 있습니다.

---

## 1. 프로젝트 목적

이 저장소는 다음 세 가지를 함께 관리합니다.

1. **현재 보유 현황** — 증권계좌와 퇴직연금의 자산·손익·비중 확인
2. **날짜별 복원** — 과거 특정 날짜의 계좌 상태와 성과 재구성
3. **장부 검산** — 실제 보유액, 투자원금, 실현손익, 현금 흐름의 일관성 확인

프런트엔드는 별도 프레임워크나 번들러 없이 **HTML + CSS + Vanilla JavaScript ES Module**로 구성합니다.

---

## 2. 주요 기능

### 2.1 Main Dashboard

```text
index.html
```

주요 기능:

- 날짜별 증권계좌·퇴직연금 성과 복원
- 투자원금·평가금액·누적손익·수익률 조회
- 계좌별 성과 요약과 보유 종목/상품 현황
- 증권 `securitiesEvents` 기반 매도·실현손익·현금화 원금·재매수 원금 이동 복원
- 장부결과 VS 실제보유 검산
- 별도수익 ON/OFF 비교
- KOSPI 대비 초과성과 및 기간 차트
- 퇴직연금 상품별 손익·비중·위험자산 관리
- 기업적립금·현금성자산·ETF 추가매수 조정
- PIN 기반 퇴직연금 저장·삭제
- Light / Dark, Desktop / Tablet / Mobile, Print 지원

세부 UI lifecycle·partial render·모달·차트·반응형 contract는 `main_dashboard_maintenance_handover.md`가 소유합니다.

### 2.2 투자 계산기

```text
add/calc.html
```

KODEX 레버리지 보유분과 추가매수 시나리오를 계산합니다.

- 기존 보유분 기준 계산
- 추가매수 평균단가
- 목표 매도단가
- 회수 대상 금액·잔여현금
- 추가매수 단가·수량 시나리오
- 기본값 복원
- Desktop / Tablet / Mobile 반응형 UI

### 2.3 KODEX 레버리지 거래 리포트

```text
add/kodex-leverage-report.html
```

`data/kodex_leverage_trades.json`을 canonical 거래 원천으로 사용해 실현거래·손익·본 포지션/단타 분류·차트·Timeline을 파생합니다. Main의 별도수익과 Add Report는 같은 거래 원천을 사용합니다.

Calc/Report의 계산·데이터·UI contract는 `add_maintenance_handover.md`가 소유합니다.

### 2.4 Market AI 연동

Market AI는 Main에 다음 두 기능을 제공하는 **선택형 화면 overlay subsystem**입니다.

1. 현재 시장·AI Signal
2. 현재 평가 대상 거래일 보유종목의 현재가 overlay

핵심 경계:

- Dashboard가 수량·원가·원금·매매흐름·실현손익·historical snapshot을 소유합니다.
- Market AI는 현재 시장 데이터와 ticker별 현재가/source/session/usable 상태를 제공합니다.
- 원칙적으로 KST 오늘에 usable quote를 적용하고, 자정 이후 다음 KRX 정규장 시작 전에는 **직전 완료 거래일의 확정 closed quote**를 그 거래일 화면에 제한적으로 이어서 사용할 수 있습니다.
- 그보다 오래된 과거 날짜와 운영 JSON에는 Market AI 값을 적용하지 않습니다.
- 일부 ticker가 unusable이면 해당 ticker만 저장 JSON 값으로 fallback합니다.
- 개별주식 시간외와 ETF 장마감이 공존할 수 있으므로 보유종목 상태는 ticker별 market state를 사용합니다.
- Market AI overlay는 `prices.json`, 성과 snapshot, Pension JSON, GAS에 저장하지 않습니다.
- Dashboard에서 Market AI 사용 여부를 켜고 끌 수 있으며, 연결 실패 시 저장 JSON 기반 Dashboard는 독립 동작합니다.
- AI Signal polling과 보유종목 Live Valuation은 서로 다른 책임으로 유지합니다.

Local은 `127.0.0.1:8001` full API에 직접 연결하고, GitHub Pages에서는 Tailscale Serve → `127.0.0.1:8002` GET-only proxy를 사용합니다.

Market AI frontend 세션·polling·partial render·fallback의 세부 contract는 Main handover가, backend 내부 계약은 Market AI 프로젝트 문서가 소유합니다.

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

Main entry는 `js/dashboard-app.js`입니다. 현재 시장·AI Signal은 `js/dashboard-market-ai.js`, 보유종목 현재가 overlay는 main graph의 `js/dashboard-live-valuation.js`가 담당하며 transport/preference는 `js/dashboard-market-ai-client.js`를 공유합니다.

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

브라우저는 GitHub 저장소에 직접 write하지 않습니다.

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

가격 원장은 KRX **정규장 기준**을 유지합니다. 장중 snapshot은 intraday, 장마감/과거일은 regular close로 구분하며 Market AI 애프터 quote는 화면 overlay로만 사용합니다.

### 3.4 Market AI 조회

```text
Dashboard
   ├─ dashboard-market-ai.js
   │    → Market Snapshot / Signal / Bridge 상태
   └─ dashboard-live-valuation.js
        → 보유 ticker 현재가 overlay

공통 transport
   → dashboard-market-ai-client.js
   → Local  : 127.0.0.1:8001
   → Remote : Tailscale Serve → 127.0.0.1:8002 GET-only proxy
```

---

## 4. 프로젝트 구조

```text
investment-dashboard/
├─ index.html
├─ GAS_code.js                    # GAS Web App canonical source; Pages 배포 제외
├─ css/
│  ├─ common.css
│  ├─ tablet.css
│  ├─ mobile.css
│  ├─ special.css
│  ├─ interaction.css
│  └─ print.css
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
├─ data/
│  ├─ portfolio.json
│  ├─ kodex_leverage_trades.json
│  ├─ prices.json
│  ├─ performance_snapshots.json
│  ├─ account1_daily_snapshots.json
│  ├─ pension_contributions.json
│  ├─ pension_cash_snapshots.json
│  ├─ pension_operation_ledger.json
│  ├─ pension_operation_ledger/
│  ├─ pension_operation_identity/
│  ├─ pension_batch_request_identity/
│  ├─ krx_dispatch_ledger/
│  └─ pension_trades.json
├─ img/
│  ├─ favicon.png
│  ├─ hero-bg.webp
│  └─ ui-icons.svg
├─ add/
│  ├─ calc.html
│  ├─ kodex-leverage-report.html
│  ├─ add.css
│  └─ add.js
├─ scripts/
│  └─ update_prices.py
├─ tests/
│  ├─ main-calc.test.cjs
│  ├─ main-ui-contract.test.cjs
│  ├─ add-calc.test.cjs
│  ├─ add-report-data.test.cjs
│  ├─ add-ui-contract.test.cjs
│  ├─ cross-ui-contract.test.cjs
│  └─ update_prices_test.py
├─ .github/workflows/
│  ├─ pages.yml
│  └─ update-prices.yml
├─ .gitattributes
├─ _config.yml
├─ requirements.txt
├─ README.md
├─ main_dashboard_maintenance_handover.md
├─ add_maintenance_handover.md
├─ dashboard_evaluation_guide.md
└─ ct35_evaluation.md
```

`img/favicon.png`과 `img/ui-icons.svg`는 Main/Add가 공유하는 canonical asset입니다. JavaScript dependency/state ownership과 CSS/Responsive 세부는 handover 문서에서 관리합니다.

---

## 5. 주요 데이터

| 파일 | 용도 |
|---|---|
| `data/portfolio.json` | 현재 보유자산, 투자원금 기준, 증권 `securitiesEvents` 거래·현금흐름 원장 |
| `data/kodex_leverage_trades.json` | KODEX 레버리지 거래·실현손익 canonical 원천 |
| `data/prices.json` | 날짜별 종목·상품 가격과 지수 |
| `data/performance_snapshots.json` | 날짜별 성과 스냅샷 |
| `data/account1_daily_snapshots.json` | 증권계좌 일별 복원 데이터 |
| `data/pension_contributions.json` | 퇴직연금 적립·조정 데이터 |
| `data/pension_cash_snapshots.json` | 퇴직연금 현금성자산 스냅샷 |
| `data/pension_operation_ledger.json` | legacy cash operation read-only fallback |
| `data/pension_operation_ledger/*.json` | Pension semantic durable operation history |
| `data/pension_operation_identity/*.json` | Pension exact identity durable index |
| `data/pension_batch_request_identity/*.json` | batchRequestId durable index |
| `data/krx_dispatch_ledger/*.json` | KRX requestId durable dispatch history |
| `data/pension_trades.json` | 퇴직연금 거래 이력 |

`data/kodex_leverage_trades.json`은 Main 별도수익과 Add Report가 함께 사용하는 단일 거래 원천이며 `js/kodex-leverage-schema.js`로 검증합니다.

### 운영 데이터 주의

다음 데이터는 실제 운영 상태이므로 일반 소스 패치에 과거 복사본을 함께 넣지 않습니다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
data/pension_operation_ledger/*.json
data/pension_operation_identity/*.json
data/pension_batch_request_identity/*.json
data/krx_dispatch_ledger/*.json
```

---

## 6. 데이터 쓰기와 갱신

### 6.1 Google Apps Script

퇴직연금 저장과 KRX 갱신 요청은 별도 Google Apps Script Web App을 사용합니다. 저장소 root `GAS_code.js`가 canonical backend source이며 실제 Apps Script 배포본과 일치해야 합니다.

운영 인증값과 GitHub 연동 정보는 프런트엔드/GAS 소스에 직접 넣지 않고 Script Properties에서 관리합니다. `GAS_code.js`는 Pages runtime asset이 아니므로 `_config.yml`에서 배포 산출물에서 제외합니다.

stable request identity, optimistic concurrency, durable idempotency, fail-closed 복구의 구체 구현은 Main handover와 `GAS_code.js`가 소유합니다.

### 6.2 KRX 갱신

- 최신/누락 거래일과 정규장 종가 확정이 필요한 날짜를 갱신합니다.
- 선택 날짜 재갱신은 `priceBasis: regular_close`와 `regularCloseSource: pykrx_raw...`가 함께 확인된 경우에만 불필요한 실행을 생략합니다. 과거에 source attestation 없이 저장된 `regular_close`는 한 번 재확정합니다.
- workflow는 `prices.json`과 `performance_snapshots.json`만 자동 commit 대상으로 취급합니다.
- branch 경쟁·push 응답 유실·generation input drift는 fail-closed 또는 검증 후 재시도로 처리합니다.
- 매도 완료 종목은 해당 날짜 이후 신규 KRX 조회 대상에서 제외하되 매도 전 과거 backfill에서는 다시 조회합니다.

세부 GitHub Actions/GAS race contract는 Main handover에서 관리합니다.

---

## 7. GitHub Pages

기본 배포 경로:

```text
Main   /
Calc   /add/calc.html
Report /add/kodex-leverage-report.html
```

루트 `_config.yml`은 repository에는 유지하되 브라우저가 직접 사용할 필요가 없는 backend/durable state를 Pages 산출물에서 제외합니다.

```text
GAS_code.js
data/krx_dispatch_ledger/
data/pension_operation_identity/
data/pension_operation_ledger/
data/pension_batch_request_identity/
```

새 repository-only durable 디렉터리를 추가하거나 경로를 바꾸면 `_config.yml`과 이 README의 구조 설명을 함께 갱신합니다.

---

## 8. 자동 QA

현재 기본 테스트:

```text
tests/main-calc.test.cjs
tests/main-ui-contract.test.cjs
tests/add-calc.test.cjs
tests/add-report-data.test.cjs
tests/add-ui-contract.test.cjs
tests/cross-ui-contract.test.cjs
tests/update_prices_test.py
```

전체 실행 예:

```bash
node --test tests/*.test.cjs
python tests/update_prices_test.py
```

테스트는 계산·데이터·UI contract·가격 생성 회귀를 빠르게 찾는 개발 안전망입니다. **테스트 개수나 PASS 숫자 자체를 품질 점수로 해석하지 않습니다.** 변경 유형별 최소 QA와 과도한 구현 고정 테스트의 판단 기준은 handover/evaluation 문서를 따릅니다.

---

## 9. 문서 역할

| 문서 | 역할 |
|---|---|
| `README.md` | 프로젝트 소개, 주요 기능, 전체 구조, 데이터·배포 개요 |
| `main_dashboard_maintenance_handover.md` | Main 장기 유지보수 contract, 수정·QA, Main↔Add 공통 contract |
| `add_maintenance_handover.md` | Calc/Report 계산·데이터·UI 유지보수 contract와 Add QA |
| `dashboard_evaluation_guide.md` | 평가 방법, CSS/JS/UI/UX 점수, 전역 A/B/C, GAS 평가 모드, Counterexample/종료 기준 |
| `ct35_evaluation.md` | 공통화·토큰화 35개 관찰 항목과 고정 배점 |
| Git history | 과거 변경 이력 |

### 역할별 Source of Truth

```text
실제 현재 구현
→ 최신 repository 소스

Main 유지보수 contract
→ main_dashboard_maintenance_handover.md

Add 유지보수 contract
→ add_maintenance_handover.md

전체 평가 방법
→ dashboard_evaluation_guide.md

공통화·토큰화 35개 Rubric
→ ct35_evaluation.md

프로젝트 소개
→ README.md
```

README에는 selector, px 값, 함수 내부 순서, JavaScript state ownership, GAS transaction 세부, 평가 점수 규칙, 차수별 작업 이력을 중복 기록하지 않습니다.

---

## 10. 저장소 관리 원칙

Python cache 등 생성물은 저장소에 포함하지 않습니다.

```gitignore
__pycache__/
*.pyc
```

문서는 **해당 문서가 소유한 장기 contract가 바뀔 때만** 갱신합니다. 단순 버그 수정·QA PASS·현재 수치·과거 차수 기록을 README나 handover에 누적하지 않습니다.
