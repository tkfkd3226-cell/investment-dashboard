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
- 날짜 탐색 — Web 좌우 이동 버튼, Tablet/Phone 수평 swipe로 같은 activeDate 경로 사용
- 투자원금·평가금액·누적손익·수익률 조회
- 계좌별 성과 요약과 보유 종목/상품 현황
- 증권 `securitiesEvents` 기반 매도·실현손익·현금화 원금·재매수 원금 이동 복원
- 장부결과 VS 실제보유 검산
- 별도수익 ON/OFF 비교
- 월간 손익 캘린더 — 합산/증권/퇴직연금별 flow-neutral 일손익을 전환해 보고, KRX 휴장·데이터 누락을 구분하며 날짜 선택 시 해당 일자 Dashboard로 이동
- 포트폴리오 히트맵 — 메인 증권 보유종목을 `당일손익=|당일손익 금액|`, `누적손익=|누적손익 금액|`, `비중=평가금액` 기준의 treemap으로 전환해 당일 영향도·누적 손익 기여도·현재 보유비중을 확인
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
│  ├─ dashboard-monthly-calendar.js
│  ├─ dashboard-heatmap.js
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
│  ├─ krx_trading_calendar.json
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
│  ├─ heatmap-engine.test.cjs
│  ├─ heatmap-shell.test.cjs
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

- 최신/누락 거래일과 정규장 종가 확정이 필요한 날짜를 갱신합니다. 누락 평일의 실제 거래 여부는 KOSPI 일별 날짜 존재 여부로 일괄 판정하며, 달력 조회가 불완전하면 휴장일로 넘기지 않고 fail-closed 합니다.
- 선택 날짜 **재갱신은 기존 종가 라벨과 관계없이 실제로 다시 조회**합니다. 같은 요청의 재전송·진행 중 중복 실행 방지는 유지합니다.
- 오늘은 한국시간 `09:00 ≤ 시각 < 15:30`에 장중 가격, **15:30 정각부터 KRX 정규장 종가**를 사용합니다. 과거 거래일은 실행 시간과 무관하게 정규장 종가를 사용합니다. 기준은 Actions에서 실제 가격을 조회하는 시각이며, 조회 도중 마감되면 전체 종목을 종가 경로로 다시 조회합니다.
- 장중은 기존 pykrx 기본 시세 경로를 유지합니다. **2026-09-14 KRX 애프터마켓 개설 이후 날짜의 장마감/과거일은 네이버 KRX 1분봉에서 해당 날짜의 정확한 `15:30:00` 행(`currentPrice`)만 정규장 종가로 인정**합니다. `15:30` 행이 없으면 pykrx·일봉·애프터마켓 현재가로 대체하지 않고 기존 JSON을 유지한 채 실패합니다. 2026-09-14 이전 날짜만 기존 raw pykrx 종가 경로를 허용합니다.
- **필수 설정:** GitHub 저장소 `Settings → Secrets and variables → Actions → New repository secret`에 `KRX_ID`, `KRX_PW`를 등록합니다. 값은 KRX 정보데이터시스템의 로그인 ID/비밀번호입니다. workflow가 이 Secrets를 pykrx 환경변수로 전달합니다. 누락 시 설정 안내와 함께 중단합니다.
- `GAS_code.js` 수정은 GitHub 업로드만으로 운영 Web App에 적용되지 않습니다. Apps Script 소스를 교체한 뒤 기존 Web App 배포를 **새 버전으로 업데이트**해야 합니다.
- workflow는 updater가 생성하는 `prices.json`, `performance_snapshots.json`, `krx_trading_calendar.json`만 자동 commit 대상으로 취급합니다.
- branch 경쟁·push 응답 유실·generation input drift는 fail-closed 또는 검증 후 재시도로 처리합니다.
- 매도 완료 종목은 해당 날짜 이후 신규 KRX 조회 대상에서 제외하되 매도 전 과거 backfill에서는 다시 조회합니다.

세부 GitHub Actions/GAS race contract는 Main handover에서 관리합니다.

---

## 7. GitHub Pages

Pages의 `Build and deployment → Source`는 **GitHub Actions**를 유지합니다. 일반 main push는 `pages.yml`을 실행하고, KRX workflow의 `GITHUB_TOKEN` push는 별도 push workflow를 발생시키지 않으므로 **KRX workflow 성공 완료(`workflow_run`) 후 Pages를 실행**합니다. 실패·취소·다른 branch/다른 저장소의 실행은 배포하지 않습니다. checkout은 가격 저장 전 실행 SHA 대신 실행 시점 `main`을 사용합니다. KRX 갱신과 Pages 배포는 별도 실행이므로 둘 다 성공한 뒤 새로고침합니다.

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
