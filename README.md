# 투자 대시보드

삼성증권 증권계좌와 퇴직연금 계좌의 **날짜별 투자 성과를 복원·검산·분석하기 위한 정적 웹 대시보드**입니다.

메인 화면은 GitHub Pages에서 제공하며, KRX 가격과 성과 스냅샷은 GitHub Actions + Python으로 갱신합니다. 퇴직연금 금액 조정과 KRX 갱신 요청처럼 브라우저에서 직접 파일을 수정할 수 없는 쓰기 작업은 Google Apps Script Web App을 통해 연결합니다. 별도 `market-ai` 프로젝트가 실행 중이면 로컬에서는 `127.0.0.1:8001`, 외부 GitHub Pages에서는 Tailscale Serve를 통해 같은 실제 현재 시장·AI 신호를 Desktop/Tablet Hero 보조 카드 또는 Mobile dialog로 표시합니다.

이 저장소는 단순 시세 조회 화면이 아니라 다음 세 가지를 함께 관리하는 것을 목표로 합니다.

1. **현재 보유 현황** — 증권계좌와 퇴직연금의 자산·손익·비중
2. **날짜별 복원** — 과거 특정 날짜의 계좌 상태와 성과 재구성
3. **장부 검산** — 실제 보유액, 투자원금, 실현손익, 현금 흐름의 일관성 확인

---

## 1. 핵심 기능

### 1.1 증권계좌

- 날짜별 증권계좌 성과 복원
- 투자원금·평가금액·누적손익·수익률 조회
- 계좌별 성과 요약과 보유 종목 현황
- 장부결과 VS 실제보유 검산
- 투자원금 원천 및 검산
- 별도수익 ON/OFF 비교
- KOSPI 대비 초과성과 확인

### 1.2 퇴직연금

- 퇴직연금 계좌의 날짜별 성과 및 상품 현황
- 상품별 손익·비중·인사이트
- 위험자산 비중 관리
- 기업적립금·현금성자산·ETF 추가매수 조정
- PIN 기반 저장·삭제 흐름
- 여러 변경사항을 모아 적용하는 batch 처리

### 1.3 차트 / 분석

- 누적손익 및 누적수익률
- KOSPI 비교
- 자산·종목 비중 변화
- 증권계좌 / 퇴직연금 관련 기간 차트
- 범례 다중선택 및 최소 1개 유지
- 전체 선택
- Y축 자동 재계산 ON/OFF
- 차트 확대 보기
- Desktop / Tablet / Mobile 반응형 tooltip 및 조작 UI

### 1.4 데이터 갱신

- KRX 현재가 **최신/누락 반영**
- 선택된 날짜 **재갱신**
- GitHub Actions 수동 실행을 통한 가격 및 성과 스냅샷 갱신
- 과거 거래일 보완 및 과거 장중 데이터의 종가 확정

### 1.5 Market AI 연동

- `dashboard-market-ai.js` standalone entry를 통한 현재 시장·AI 신호 표시. main feature state와는 분리하고 공통 `dashboard-modal.js`의 dialog lifecycle만 공유
- 시장 4개 metric(KOSPI·KOSPI200선물·SOX·NQ100선물)과 AI 신호 4개 metric을 공통 `data-list-card` 기반의 **시장 65% / AI 신호 35%** 구조로 표시. SOX 시장 metric과 Signal 입력은 모두 `INDEX:SOX` 현물지수를 사용하며, 표시 편의를 위해 `FUTURES:SOX` 또는 `SOX-F`로 자동 전환하지 않음
- Desktop / Tablet은 Hero 우측 보조 카드, Mobile ≤760px·실제 터치폰 가로 UI는 Hero의 **AI Signal** 버튼에서 같은 Market AI panel을 modal로 이동·재사용
- 로컬에서는 `http://127.0.0.1:8001`의 실제 API 데이터를 사용
- 외부 GitHub Pages에서는 `https://node.tail60a98e.ts.net` Tailscale Serve를 통해 같은 실제 Market AI API를 조회. FastAPI 8001 포트를 인터넷에 직접 공개하지 않음
- 외부 조회는 Market AI PC의 Local Suite와 Tailscale이 실행 중이고, 조회 기기도 같은 tailnet에 연결되어 있을 때 사용 가능
- 예시 데이터 전용 모드는 폐기했으며, 폰에서 화면 형태만 강제 확인할 때는 `?dashboard-view=web`, `?dashboard-view=tablet`, `?dashboard-view=mobile`을 사용하고 세 모드 모두 실제 Market AI 데이터를 사용
- Mobile modal에서는 metric tooltip을 사용하지 않고, Desktop / Tablet에서만 keyboard/pointer tooltip을 제공
- 선택한 과거 기준일과 분리된 **현재 시점 신호**로 동작
- Signal endpoint가 대기·오류·timeout·stale 상태여도 같은 refresh에서 정상 수신한 Market Snapshot은 유지하고 신호 상태만 분리 표시
- KOSPI200선물은 `kis-efriend:*` 실제 소스이면서 proxy가 아닌 데이터만 사용. 장 종료로 확인된 마지막 정상값은 유지하되 장중 stale·Bridge 단절·대체 소스는 사용 불가로 표시
- backend가 `actual_close`를 제공한 상승마감 항목은 예측 점수 대신 실제 KOSPI 종가 결과와 확정 상태로 표시
- 신호 tooltip의 가중치는 backend `effective_weight`를 우선 사용하며, checkpoint metadata가 없는 구버전 응답에서는 configured/legacy weight로 fallback
- 세 endpoint가 모두 응답하지 않으면 로컬은 panel 중앙에 `연결 확인 중`을 표시하며 재시도하고, 원격은 응답 확인 전부터 Market AI panel·button·dialog를 만들지 않은 채 polling만 유지. 두 경우 모두 메인 대시보드에는 영향을 주지 않음

### 1.6 부가 도구

- 투자 계산기: `add/calc.html`
- 기간별 거래/성과 리포트: `add/kodex-leverage-report.html`
- Light / Dark 테마
- 모바일 날짜 고정 ON/OFF

---

## 2. 전체 동작 구조

메인 화면은 `index.html`에서 시작하고, `dashboard-app.js`가 **main dependency graph의 단일 ES Module entry point**로 나머지 메인 모듈을 조율합니다. `dashboard-market-ai.js`는 이 graph와 분리된 standalone module로 `index.html`에서 독립 로드됩니다.

가로로 긴 하나의 도식 대신 실제 동작을 **조회 / 퇴직연금 쓰기 / KRX 갱신 / Market AI 조회**의 네 흐름으로 나눠 보면 다음과 같습니다.

### 2.1 화면 조회 흐름

```text
GitHub Pages / Browser
          ↓
      index.html
          ↓
  dashboard-app.js
          ↓
   나머지 ES Modules
          ↓
      data/*.json
          ↓
   화면 계산 / 렌더링
```

`dashboard-app.js`가 연결하는 main graph 구성:

```text
dashboard-core.js
dashboard-ui-common.js
dashboard-modal.js
dashboard-charts.js
dashboard-ui.js
dashboard-pension.js
dashboard-pension-editor.js
```

### 2.2 퇴직연금 쓰기 흐름

```text
Browser
   ↓
GAS Web App
   ↓
GitHub REST API
   ↓
pension 관련 JSON
   ↓
GitHub commit
```

### 2.3 KRX 가격 갱신 흐름

```text
Browser
   ↓
GAS Web App
   ↓
workflow_dispatch
   ↓
update-prices.yml
   ↓
update_prices.py
   ↓
prices.json
performance_snapshots.json
```

### 2.4 Market AI 조회 흐름

```text
Local Browser (:8000)
        ↓
dashboard-market-ai.js
   ├─ dashboard-modal.js   (공통 dialog lifecycle만 공유)
   ↓
Market AI FastAPI (:8001)
   ├─ /api/market-data/snapshot
   ├─ /api/signal/latest?include_details=true
   └─ /api/bridge/kis-efriend/status

External GitHub Pages
        ↓
dashboard-market-ai.js
        ↓
https://node.tail60a98e.ts.net
        ↓
Tailscale Serve
        ↓
http://127.0.0.1:8001
        ↓
Market AI FastAPI
```

이 흐름은 main feature state와 분리된 조회 전용 entry입니다. `dashboard-market-ai.js`는 `dashboard-modal.js`의 저수준 dialog lifecycle만 공유하고 polling/state/mount/render는 자체 소유합니다. Signal endpoint의 404·오류·timeout·stale은 Market Snapshot과 분리해 처리하며, 같은 refresh에서 snapshot이 정상 수신되면 시장값을 유지한 채 신호 상태만 `대기 / 오류 / 지연`으로 표시합니다. 세 endpoint가 모두 응답하지 않으면 로컬은 panel 중앙에 `연결 확인 중`을 표시하고, 비로컬 환경은 응답 확인 전부터 Market AI UI를 만들지 않습니다. polling은 계속되어 다음 정상 응답 때 UI가 mount됩니다.

로컬과 원격 모두 **실제 Market AI 데이터**를 사용합니다. 외부 GitHub Pages에서 cross-origin `fetch()`가 가능하도록 Market AI FastAPI는 Dashboard Origin `https://tkfkd3226-cell.github.io`를 명시적으로 CORS 허용합니다. Tailscale Serve와 CORS의 상세 운영 계약은 Market AI 프로젝트 문서를 Source of Truth로 합니다.

프론트엔드는 별도 번들러나 프레임워크 없이 **HTML + CSS + Vanilla JavaScript ES Module**로 동작합니다.

조회 데이터는 GitHub Pages의 JSON을 읽고, 브라우저에서 GitHub 저장소에 직접 쓰지 않습니다. 퇴직연금 쓰기와 KRX 갱신 요청은 **GitHub 저장소와 별도로 운영·배포되는 Google Apps Script Web App**을 거칩니다.

---

## 3. 프로젝트 구조

```text
investment-dashboard-main/
├─ index.html
├─ css/
│  ├─ common.css
│  ├─ tablet.css
│  ├─ mobile.css
│  ├─ special.css
│  ├─ interaction.css
│  └─ print.css
├─ js/
│  ├─ dashboard-core.js
│  ├─ dashboard-ui-common.js
│  ├─ dashboard-modal.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-pension-editor.js
│  ├─ dashboard-app.js
│  └─ dashboard-market-ai.js
├─ data/
│  ├─ portfolio.json
│  ├─ prices.json
│  ├─ performance_snapshots.json
│  ├─ account1_daily_snapshots.json
│  ├─ pension_contributions.json
│  ├─ pension_cash_snapshots.json
│  └─ pension_trades.json
├─ img/
│  └─ hero-bg.png
├─ scripts/
│  └─ update_prices.py
├─ add/
│  ├─ calc.html
│  ├─ kodex-leverage-report.html
│  ├─ add.css
│  ├─ add.js
│  └─ add_maintenance_handover.md
├─ tests/
│  ├─ main/
│  │  ├─ calc.test.cjs
│  │  └─ ui-contract.test.cjs
│  ├─ add/
│  │  ├─ calc.test.cjs
│  │  └─ ui-contract.test.cjs
│  └─ cross/
│     └─ ui-contract.test.cjs
├─ .github/workflows/
│  └─ update-prices.yml
├─ requirements.txt
└─ main_dashboard_maintenance_handover.md
```

---

## 4. 프론트엔드 아키텍처

### 4.1 JavaScript 모듈

main dependency graph는 **8개 ES Module**로 구성되어 있으며 `dashboard-app.js`가 단일 entry point입니다. `dashboard-market-ai.js`는 두 번째 standalone entry로 로드되며 main feature state와는 분리하고 `dashboard-modal.js`의 저수준 dialog lifecycle만 공유합니다.

| 파일 | 책임 |
|---|---|
| `dashboard-core.js` | 공통 데이터 state, JSON 로딩, 계산, formatter, 데이터 helper |
| `dashboard-ui-common.js` | 여러 UI 모듈이 공유하는 저수준 DOM·마크업, 공통 카드/모바일 보기 state, Toast·viewport·Asset tooltip interaction helper |
| `dashboard-modal.js` | custom/native modal의 focus·inert·body lock·ESC·backdrop·focus return lifecycle |
| `dashboard-charts.js` | 차트 state, SVG 렌더링, 범례, tooltip, 확대, 반응형, 차트 action routing |
| `dashboard-ui.js` | Topbar, Navigation, 일반 카드·표, KRX UI, UI action routing |
| `dashboard-pension.js` | 퇴직연금 **View** — 현황, 상품 정보, 인사이트, 위험도 및 tooltip markup |
| `dashboard-pension-editor.js` | 퇴직연금 **Editor** — 금액조정, PIN, batch, 저장·삭제 |
| `dashboard-app.js` | 날짜·별도수익 등 cross-module 흐름, 전체 render orchestration, 초기화·boot |
| `dashboard-market-ai.js` | 로컬 `:8001` 또는 원격 Tailscale Serve의 실제 Market AI API polling/state/render와 Mobile modal mount를 자체 소유하는 standalone entry; `dashboard-modal.js`만 공유 |

### 4.2 Dependency 방향

아래 표기에서 **`A → B`는 A가 B를 import한다는 의미**입니다.

```text
dashboard-core.js
└─ 다른 메인 JS 모듈 import 없음

dashboard-ui-common.js
└─ 다른 dashboard module import 없음

dashboard-modal.js
└─ 다른 dashboard module import 없음

dashboard-charts.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
└─ dashboard-modal.js

dashboard-ui.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
├─ dashboard-modal.js
└─ dashboard-charts.js

dashboard-pension.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
└─ dashboard-charts.js

dashboard-pension-editor.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
└─ dashboard-modal.js

dashboard-app.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
├─ dashboard-modal.js
├─ dashboard-charts.js
├─ dashboard-ui.js
├─ dashboard-pension.js
└─ dashboard-pension-editor.js

dashboard-market-ai.js
└─ dashboard-modal.js만 공유 · polling/state/render는 standalone 소유
```

현재 구조에서는 **순환 dependency를 만들지 않는 것**이 기본 원칙입니다.

### 4.3 State ownership

- 여러 모듈이 공유해야 하는 데이터 state만 `dashboard-core.js`에 둡니다.
- modal focus stack·body lock 같은 dialog lifecycle state는 `dashboard-modal.js`가 소유합니다.
- chart runtime state는 `dashboard-charts.js`가 소유합니다.
- 퇴직연금 Editor의 batch/runtime state는 `dashboard-pension-editor.js`가 소유합니다.
- 공통 mobile table/card 보기 state와 toggle helper, App Toast·mobile viewport reflow는 `dashboard-ui-common.js`가 소유합니다. 화면별 feature가 `dashboard-ui.js`를 단순 helper 저장소처럼 import하지 않습니다.
- Market AI의 signal/snapshot/status/polling state는 standalone `dashboard-market-ai.js` 내부에서 소유합니다.
- 특정 모듈 내부 DOM이나 state를 다른 모듈이 직접 조작하지 않고 필요한 경우 공개 API를 사용합니다.
- `window` / `globalThis`에 기능 API를 매달아 dependency를 우회하지 않습니다.

### 4.4 CSS / Responsive

메인 대시보드 CSS는 **6개 역할 파일**로 분리합니다. Desktop은 별도 CSS 파일을 두지 않고 `common.css`의 기본값을 사용합니다. Tablet/Mobile 공통 차이는 `common.css`의 Responsive Shared에서, 각 구간 고유 차이는 `tablet.css` / `mobile.css`에서 override합니다.

```text
css/common.css       # 공통 변수·기본 컴포넌트·Desktop baseline·Responsive Shared
css/tablet.css       # Tablet 761~1100px
css/mobile.css       # Mobile ≤760px
css/special.css      # 기능상 필요한 특수 viewport
css/interaction.css  # hover/pointer
css/print.css        # 인쇄 전용
```

`index.html`의 CSS load order는 다음 순서를 유지합니다. 이 순서가 cascade order이므로 임의로 바꾸지 않습니다.

```text
common → tablet → mobile → special → interaction → print
```

기본 viewport 기준:

```text
Desktop : 1101px 이상
Tablet  : 761px ~ 1100px
Mobile  : 760px 이하
```

추가 breakpoint는 특정 기능에 실제로 필요한 경우에만 사용합니다.

Market AI UI의 CSS도 같은 역할 분리를 따릅니다. Desktop baseline과 공통 `data-list-card`/tooltip은 `common.css`의 **Hero 인접 영역**, Tablet 배치·밀도는 `tablet.css`의 Hero 영역, 실제 Phone 진입 버튼·modal·panel 이동은 `special.css`의 Phone UI Shared에서 관리합니다. **1101~1279 compact Desktop은 Asset Detail 전용이며 Market AI override를 두지 않고, 1280px은 일반 Desktop으로 유지합니다.** Mobile Market AI metric tooltip은 사용하지 않습니다. `dashboard-market-ai.js` 전용 class라는 이유로 파일 하단에 별도 override 묶음을 추가하지 않습니다.

세부 CSS 수정·QA 원칙과 breakpoint/override 규칙은 `main_dashboard_maintenance_handover.md`를 Source of Truth로 따릅니다.

### 4.5 Main UI presentation contract

Main 화면의 1~13차 CSS 토큰화·공통화 작업은 다음 장기 기준으로 정리되어 있습니다. 실제 px 값과 selector는 최신 CSS가 Source of Truth이며, README에는 구조만 기록합니다.

- 페이지 여백과 section 간격, 카드 padding·gap·radius, 제목·control, KPI·mini-card·data-list, 표, 차트, modal, tooltip, feedback 상태를 semantic token과 공통 component rule이 소유합니다.
- surface radius는 `--surface-radius-level-1/2/3/4`의 4단계 위계로 관리합니다. Desktop·Tablet과 Print는 같은 기준선을 사용하고, 세로 Phone과 실제 터치폰 가로는 Phone Shared에서 함께 compact 기준으로 전환합니다.
- Main 표는 `.dashboard-data-table`과 `--data-table-*` 계약을 사용합니다. 모바일 카드 표시는 공통 `data-list-card` renderer를 사용하며, 세로 Phone에서만 표/카드 전환을 제공하고 실제 터치폰 가로와 Print는 표를 canonical 표현으로 사용합니다.
- 양수·음수는 각각 `--value-positive`와 `--value-negative`를 사용해 Light·Dark·Print에서 의미를 유지합니다. 성공·정보·주의·오류 색상은 별도의 status token 체계를 사용합니다.
- Print는 현재 화면 테마와 관계없이 Light palette로 고정하고, 인쇄 직전에 모든 차트를 Light chart palette로 다시 그립니다. 화면 조작 UI와 Market AI는 제외하고, 두 자산 panel·Hero 전체 요약·표·차트·장부·원천 검산을 인쇄용 canonical layout으로 표시합니다.
- Modal은 공통 dialog lifecycle과 form/control token을 공유하되 KRX·퇴직연금의 업무 state와 저장 흐름은 각 feature가 소유합니다. PIN 입력은 브라우저의 비밀번호 저장 대상으로 오인되지 않도록 credential password field를 사용하지 않습니다.

이 완료 범위는 **Main 화면 1~13차**입니다. `add/calc.html`과 `add/kodex-leverage-report.html`은 독립 화면군이며, Main 완료 차수의 연장선으로 간주하지 않고 별도 작업에서 `add/add_maintenance_handover.md`를 기준으로 관리합니다.

---

## 5. 데이터 구조와 보호

### 5.1 데이터 파일

| 파일 | 용도 |
|---|---|
| `portfolio.json` | 보유자산, 투자원금 기준, 자금 이벤트 및 기본 포트폴리오 정보 |
| `prices.json` | 날짜별 종목·상품 가격 및 지수 데이터 |
| `performance_snapshots.json` | 날짜별 성과 스냅샷 |
| `account1_daily_snapshots.json` | 증권계좌 일별 복원 데이터 |
| `pension_contributions.json` | 퇴직연금 적립 및 조정 데이터 |
| `pension_cash_snapshots.json` | 퇴직연금 현금성자산 스냅샷 |
| `pension_trades.json` | 퇴직연금 거래 이력 |

대시보드는 이 데이터들을 결합하여 선택 날짜의 계좌 상태를 계산하고 화면을 렌더링합니다.

### 5.2 운영 데이터 보호

특히 아래 3개는 GitHub에 소스 패치를 반영할 때 주의해야 하는 실제 운영 데이터입니다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
```

과거 ZIP이나 수정용 ZIP에 들어 있는 데이터를 현재 운영본 위에 무심코 덮어쓰지 않습니다.

- `prices.json`, `performance_snapshots.json`은 KRX workflow로 재생성 가능한 영역이 있습니다.
- `pension_contributions.json`은 사용자 입력 기반 운영 데이터이므로 특히 보존에 주의합니다.
- 코드 수정 ZIP은 원칙적으로 **변경된 소스 파일만** 포함하고 운영 JSON은 요청이 없는 한 넣지 않습니다.

---

## 6. 쓰기 · 갱신 구조

### 6.1 Google Apps Script 연동

퇴직연금 쓰기와 KRX 갱신 요청은 **GitHub 저장소와 별도로 운영되는 Google Apps Script Web App**을 거칩니다.

- 운영 인증값과 GitHub 연동 정보는 Apps Script의 Script Properties에서 관리합니다.
- 프런트엔드는 배포된 GAS Web App URL을 호출합니다.
- `upsert`/`delete`는 허용된 pension target만 처리하고, 알 수 없는 action/target은 다른 작업으로 fallback하지 않고 거부합니다.
- 기업적립금·ETF 추가매수 단건 저장은 프런트에서 생성한 요청 ID를 실패·재시도 동안 유지하며, GAS는 같은 ID·같은 내용이 이미 반영된 경우 추가 GitHub write 없이 기존 결과를 반환합니다.
- GAS 수정·검증이 필요한 경우에는 사용자가 별도로 제공한 최신 운영 소스를 기준으로 확인합니다.
- 운영 Web App 코드가 변경되면 배포 버전도 함께 갱신해야 실제 `/exec` 호출에 반영됩니다.

### 6.2 KRX 가격 갱신

대시보드에서 KRX 가격 갱신은 **날짜 입력창을 직접 사용하는 방식이 아닙니다.** 화면의 두 버튼이 요청에 `date`를 포함할지 여부를 결정합니다.

#### 최신/누락 반영

- GAS 요청에 `date`를 보내지 않습니다.
- GAS가 현재 한국시간, `prices.json`의 최신 데이터, 장중/종가 상태를 확인합니다.
- 필요한 경우에만 `update-prices.yml`을 `workflow_dispatch`로 실행합니다.
- 오늘 데이터 갱신, 누락 거래일 보완, 저장된 장중 데이터의 종가 확정이 이 흐름에 포함됩니다.

```text
Browser
  ↓
GAS 요청
(date 없음)
  ↓
대상 날짜 판단
  ↓
필요 시 workflow 실행
```

#### 재갱신

- 현재 대시보드에서 선택되어 있는 `activeDate`를 JS가 요청의 `date`로 자동 전달합니다.
- GAS는 해당 날짜의 `prices.json` 상태를 먼저 확인합니다.
- 해당 날짜가 이미 `marketStatus: "close"`이면 `이미 종가 기준 데이터가 반영되어 있습니다.`를 반환하고 workflow를 실행하지 않습니다.
- 해당 날짜가 장중(`intraday`)이거나 데이터가 없을 때만 해당 날짜의 workflow를 실행합니다.
- 사용자가 날짜를 별도의 입력칸에 다시 입력하는 기능은 없습니다.

```text
Browser
  ↓
GAS 요청
(date = activeDate)
  ↓
marketStatus 확인
  ↓
close
→ workflow 생략

intraday / 미존재
→ workflow 실행
```

### 6.3 GitHub Actions / Python 처리

GitHub Actions workflow:

```text
.github/workflows/update-prices.yml
```

실행 스크립트:

```text
scripts/update_prices.py
```

기본 처리 흐름:

```text
GAS 또는 수동 실행
        ↓
GitHub Actions
        ↓
Python 3.11 설정
        ↓
requirements.txt 설치
        ↓
update_prices.py 실행
        ↓
JSON 변경 확인
        ↓
변경 시 commit + push
```

GitHub Actions 화면에서 workflow를 **직접 수동 실행하는 운영/개발 경로**에는 선택적인 `YYYY-MM-DD` input이 있습니다.

- 날짜를 명시하면 Python이 실제 KRX 거래일인지 먼저 확인한 뒤 해당 날짜를 처리합니다.
- 비거래일이거나 해당 날짜 종가를 확인할 수 없으면 JSON을 저장하지 않고 실행을 실패 처리합니다.
- 날짜를 비워두면 Python 스크립트가 최신/누락/재확정이 필요한 날짜를 자동으로 결정합니다.
- 이 input은 대시보드 UI의 날짜 입력 기능이 아닙니다.
- 과거 날짜를 명시적으로 재갱신하는 경우 실행 시각이 장중이어도 과거 데이터는 종가 데이터로 취급합니다.

### 6.4 퇴직연금 편집 흐름

퇴직연금은 조회와 편집 책임을 분리합니다.

```text
dashboard-pension.js
→ 보여주는 View

dashboard-pension-editor.js
→ 변경·저장하는 Editor
```

Editor의 주요 흐름:

```text
금액조정 모달
     ↓
입력 / 변경사항 구성
     ↓
batch / simulation
     ↓
PIN 확인
     ↓
GAS 요청
     ↓
로컬 반영 / 재렌더
```

실제 저장·삭제 요청은 QA 목적으로 임의 실행하지 않습니다.

---

## 7. GitHub Pages 배포

메인 대시보드는 GitHub Pages의 branch 배포를 기준으로 합니다.

```text
Branch : main
Folder : /root
```

소스 변경을 `main`에 반영하면 Pages 배포 상태에 따라 웹 화면에 반영됩니다.

데이터 갱신 workflow는 `prices.json`과 `performance_snapshots.json`을 변경한 경우에만 자동 commit/push 합니다.

---

## 8. 저장소 정리

Python cache 등 실행 중 자동 생성되는 파일은 저장소에 포함하지 않습니다.

```gitignore
__pycache__/
*.pyc
```

---

## 9. 자동 QA 테스트

수정 작업의 QA를 빠르게 하고 계산·UI 회귀를 조기에 발견하기 위해 Main과 Add에 동일한 두 축의 Node 테스트를 둡니다. 테스트는 **개발/수정 QA용**이며 웹페이지 접속 시 자동 실행되지 않고 운영 성능에도 관여하지 않습니다.

```text
tests/
├─ main/
│  ├─ calc.test.cjs          # Main 계산 결과·경계값 회귀
│  └─ ui-contract.test.cjs   # Main UI/CSS/HTML/반응형 핵심 contract
├─ add/
│  ├─ calc.test.cjs          # Add Calc 계산·validation 회귀
│  └─ ui-contract.test.cjs   # Add UI/CSS/HTML/반응형·canonical style contract
└─ cross/
   └─ ui-contract.test.cjs   # Main↔Add appearance/Corner/responsive 전역 contract
```

전체 자동 QA:

```bash
node --test tests/main/*.test.cjs tests/add/*.test.cjs tests/cross/*.test.cjs
```

영역별 빠른 QA도 가능합니다.

```bash
node --test tests/main/calc.test.cjs
node --test tests/main/ui-contract.test.cjs
node --test tests/add/calc.test.cjs
node --test tests/add/ui-contract.test.cjs
node --test tests/cross/ui-contract.test.cjs
```

자동 테스트는 반복적인 회귀 확인을 줄이는 **QA 안전망**입니다. 실제 UI 미감, 정보 위계, 신규 UX의 적절성, 실제 기기 체감처럼 자동화가 대신할 수 없는 항목은 별도 QA가 필요합니다. 테스트 파일의 존재 여부나 테스트 개수 자체는 프로젝트 품질 점수의 가산·감점 기준이 아닙니다.

Main만 수정한 작업은 `tests/main/*`, Add만 수정한 작업은 `tests/add/*`를 우선 실행합니다. appearance/Corner/breakpoint/Phone Landscape/iPhone desktop request처럼 Main↔Add가 반드시 같아야 하는 전역 contract를 변경한 경우에는 `tests/cross/*`도 실행합니다. Main과 Add를 모두 포함하는 전체 QA에는 cross contract까지 함께 포함합니다.

---

## 10. 상세 운영 문서

README는 저장소의 **기능, 전체 동작 구조, 프로젝트 구조, 데이터·갱신 방식, 실행·배포 개요**만 설명합니다.

수정·QA 방식, 변경 파일 전달 규칙, Source of Truth, 상세 유지보수 기준, 반복 회귀 불변조건, 평가·점수 기준 등 실제 작업 운영 규칙은 아래 문서에서 통합 관리합니다.

```text
main_dashboard_maintenance_handover.md
add/add_maintenance_handover.md
```

전역 유지보수·평가·QA 규칙은 main handover를, Calc/Report 세부 contract는 add handover를 기준으로 합니다. 같은 유지보수 규칙을 README와 두 문서에 중복 기재하지 않습니다.
