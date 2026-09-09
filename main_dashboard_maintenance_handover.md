# main_dashboard_maintenance_handover · 메인 대시보드 유지보수 및 인수인계

이 문서는 투자 대시보드의 **Main 영역을 수정·유지보수·인수인계하기 위한 기준 문서**다.

이 문서는 평가 점수나 A/B/C급 판정 기준을 소유하지 않는다. 평가 요청은 루트의 `dashboard_evaluation_guide.md`를 기준으로 하고, Add Calc·KODEX Report의 상세 유지보수는 `add_maintenance_handover.md`를 기준으로 한다. `README.md`는 GitHub 프로젝트 소개와 실행·배포 개요를 담당한다.

문서 역할은 다음처럼 분리한다.

| 확인 목적 | 기준 문서/소스 |
|---|---|
| 실제 현재 구현 | 사용자가 제공한 최신 실제 HTML/CSS/JS/data/scripts/workflows/tests |
| Main 수정·유지보수 contract | [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md) |
| Add 수정·유지보수 contract | [add_maintenance_handover.md](./add_maintenance_handover.md) |
| Main↔Add 공통 contract | 이 문서 8장 + `tests/cross-ui-contract.test.cjs` |
| 평가·점수·A/B/C | [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md) |
| 프로젝트 소개·구성·사용 개요 | [README.md](./README.md) |
| 과거 차수별 변경 이력 | Git history |

핵심 원칙은 **최신 파일 기준 + 최소 변경 + 현재 책임 경계 보존**이다. 문서와 실제 구현이 다르면 문서를 근거로 코드를 즉시 되돌리지 않고, 최신 코드가 의도된 변경인지 문서가 낡은 것인지 먼저 확인한다.

현재 문서의 흐름은 다음과 같다.

```text
1. 인수인계 · 범위 · Source of Truth
2. Main Architecture · 책임 경계
3. UI · Responsive · 반복 회귀 불변조건
4. CSS · Responsive 유지보수 규칙
5. JavaScript 구현 규칙
6. 운영 데이터 · GitHub Actions · GAS
7. Main 수정 · QA · Diff · 결과 전달
8. Main ↔ Add 공통 contract
9. Legacy guard · 문서 유지관리
10. 최종 운영 체크리스트
```

# 1. 인수인계 · 범위 · Source of Truth

## 1.1 문서 범위

이 문서는 Main 영역의 다음 책임을 다룬다.

- `index.html`
- `css/common.css`, `tablet.css`, `mobile.css`, `special.css`, `interaction.css`, `print.css`
- `js/dashboard-*.js`, `js/kodex-leverage-schema.js`
- Main이 사용하는 `data/*.json`
- `.github/workflows/update-prices.yml`, `scripts/update_prices.py`, `requirements.txt`
- `tests/main-*.test.cjs`
- Main과 Add가 반드시 동일하게 유지해야 하는 제한적 공통 contract와 `tests/cross-ui-contract.test.cjs`

Add의 계산식, 거래분류, Report 집계, Add 전용 CSS/JS/반응형 상세는 이 문서에서 중복 설명하지 않는다.

## 1.2 새 작업의 읽기 순서

Main 작업을 시작할 때는 다음 순서를 기본으로 한다.

```text
사용자가 제공한 최신 실제 소스 확인
→ 이 문서 확인
→ 실제 디렉토리/관련 소스 확인
→ 요청 범위와 dependency 확인
→ 수정 또는 인수인계 수행
```

`인수인계`라고만 요청한 경우에는 파일을 수정하거나 평가하지 않는다. 현재 구조, 핵심 책임, 유지보수 제약을 파악한 뒤 인수인계 완료 여부만 보고한다.

평가 요청이면 이 문서를 평가기준으로 사용하지 않고 `dashboard_evaluation_guide.md`를 먼저 적용한다. 다만 설계 의도와 Main contract 확인을 위해 이 문서를 함께 참고할 수 있다.

## 1.3 최신 파일 우선 원칙

- 이전 대화에서 기억한 코드를 최신본이라고 추정하지 않는다.
- 현재 작업에 제공된 최신 실제 소스(전체 ZIP 또는 개별 파일)를 직접 읽는다.
- 과거 selector, 함수, DOM, 파일 경로를 현재 코드에 그대로 적용하지 않는다.
- 요청과 직접 관련된 파일과 사용처를 필요한 범위에서 확인한다.
- 요청과 무관한 영역은 수정하지 않는다.
- 최신 제공본에 이 문서가 없거나 읽을 수 없으면 과거 기억으로 대체하지 않는다.

## 1.4 역할별 Source of Truth

단일 순위가 아니라 **확인하려는 대상별 Source of Truth**를 사용한다.

```text
현재 구현 상태
→ 사용자가 제공한 최신 실제 소스

Main 설계·유지보수 contract
→ 이 문서

Add 설계·유지보수 contract
→ add_maintenance_handover.md

Main↔Add 공통 contract
→ 이 문서 8장
→ 실행 정합성은 tests/cross-ui-contract.test.cjs

평가 방식
→ dashboard_evaluation_guide.md

GitHub 프로젝트 설명
→ README.md

과거 변경 이력
→ Git history
```

문서와 코드가 충돌하면 실제 코드 상태를 우선 확인하되, 장기 contract와 다르면 단순히 "코드가 최신"이라고 끝내지 않는다. **의도된 계약 변경인지 회귀인지**를 판단하고, 계약이 실제로 변경된 경우에만 이 문서를 같은 작업에서 갱신한다.

## 1.5 새 채팅 또는 기준 소스 교체 시 확인 항목

최소 다음을 확인한다.

### 프로젝트 구조

- Main 관련 파일이 실제로 존재하는지
- 문서의 파일 책임과 최신 구조가 일치하는지
- 오래된 `style.css`, `desktop.css`, classic script 구조가 재등장하지 않았는지

### JavaScript

- main graph의 ES Module dependency
- `dashboard-core.js` DOM 비의존
- `dashboard-ui-common.js` / `dashboard-modal.js` 저수준 foundation 책임
- Pension View / Editor 분리
- module-private state ownership
- `dashboard-app.js` main graph boot와 `dashboard-market-ai.js` standalone 분리
- circular import / global bridge / 중복 boot 여부

### CSS / Responsive

- 메인 CSS 6파일 canonical role과 load order
- Desktop ≥1101 / Tablet 761~1100 / Mobile ≤760
- `special.css` 기능성 예외
- Phone Landscape / iPhone desktop-request contract
- Theme / Corner / Print의 전역 표현 계약

### 데이터 / 운영

- 보호해야 하는 운영 JSON
- KRX 갱신 파일과 workflow 의미
- Market AI가 별도 backend 프로젝트라는 경계
- Main↔Add 공통 KODEX schema/data source가 중복되지 않았는지

## 1.6 최신 실제 소스와 문서가 다를 때

다음 순서로 처리한다.

```text
실제 diff 확인
→ 기능적으로 의도된 최신 변경인지 확인
→ 문서만 오래된 경우 문서 갱신
→ 코드가 장기 contract를 실수로 깨뜨린 경우 최소 수정
```

문서의 오래된 px 값이나 과거 구조를 근거로 정상 최신 코드를 되돌리지 않는다. 반대로 문서에 적힌 불변조건이 실제 요구사항으로 계속 유효하다면 코드 차이를 회귀 후보로 본다.

## 1.7 문서 유지관리 원칙

이 문서는 **현재 상태와 장기 contract**만 기록한다.

기록할 것:

- 현재 파일 책임
- 변경 시 깨뜨리면 안 되는 구조
- 반복 회귀를 막기 위한 설계 이유
- 운영 데이터/외부 backend 경계
- 현재 QA 절차

기록하지 않을 것:

- 차수별 작업일지
- 과거 점수표
- 파일 줄 수·byte 크기의 역사
- 임시 selector 값
- 이미 폐기된 구조의 상세 구현

과거 변경 이력은 Git history로 확인한다. 같은 규칙을 README, Main handover, Add handover, Evaluation Guide에 장문으로 복제하지 않는다.

# 2. Main Architecture · 책임 경계

## 2.1 Main canonical 파일 지도

README의 전체 repository tree를 이 문서에 다시 복제하지 않는다. Main 유지보수에 필요한 책임만 다음처럼 본다.

```text
index.html

css/
├─ common.css
├─ tablet.css
├─ mobile.css
├─ special.css
├─ interaction.css
└─ print.css

js/
├─ kodex-leverage-schema.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
├─ dashboard-modal.js
├─ dashboard-charts.js
├─ dashboard-ui.js
├─ dashboard-pension.js
├─ dashboard-pension-editor.js
├─ dashboard-app.js
└─ dashboard-market-ai.js   # standalone entry

data/
├─ prices.json
├─ performance_snapshots.json
├─ portfolio.json
├─ kodex_leverage_trades.json
├─ pension_contributions.json
├─ pension_cash_snapshots.json
└─ pension_trades.json

tests/
├─ main-calc.test.cjs
├─ main-ui-contract.test.cjs
└─ cross-ui-contract.test.cjs
```

`img/favicon.png`은 Main과 Add가 공유하는 canonical favicon이다. 루트에 별도 `favicon.png` 복제본을 다시 만들지 않는다.

## 2.2 메인 dependency graph는 9파일 ES Module 구조 유지

현재 main graph는 다음과 같다.

```text
js/
├─ kodex-leverage-schema.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
├─ dashboard-modal.js
├─ dashboard-charts.js
├─ dashboard-ui.js
├─ dashboard-pension.js
├─ dashboard-pension-editor.js
└─ dashboard-app.js
```

책임 경계:

```text
kodex-schema    → KODEX canonical JSON schema 검증 · DOM-free leaf
core            → 데이터 / 계산 / 공통 state / loading
ui-common       → 공통 저수준 DOM / 마크업 / shared view-state / feedback·viewport helper
modal           → custom/native dialog lifecycle / focus / inert / body lock
charts          → 차트 state / SVG / chart action
ui              → 일반 UI / topbar / navigation / UI action
pension         → 퇴직연금 조회 View
pension-editor  → 퇴직연금 변경 Editor / persistence flow
app             → cross-module orchestration / boot
```

단순 수정 때문에 다시 하나의 거대한 JS 파일로 합치지 않고, 반대로 책임 경계가 없는 작은 기능마다 새 파일을 추가하지 않는다.

`dashboard-market-ai.js`는 main feature state와 분리된 standalone entry다. 다만 Mobile dialog lifecycle을 위해 저수준 `dashboard-modal.js`만 공유하며, 상세 책임과 실패 격리 기준은 **2.8**에서 관리한다.

## 2.3 `dashboard-core.js` 책임

`dashboard-core.js`는 다음을 담당한다. KODEX 레버리지 canonical 형식 검증은 자체 구현하지 않고 `kodex-leverage-schema.js`를 import해 사용한다.

- 공통 데이터 상태
- 데이터 loading
- 계산
- formatter
- 증권/퇴직연금 공통 계산 helper

현재 core는 **DOM 비의존 foundation**으로 유지한다.

따라서 다음을 core에 새로 넣지 않는다.

```js
document.querySelector(...)
element.classList...
element.innerHTML...
window.addEventListener(...)
```

UI 여러 곳에서 공통으로 쓰는 저수준 DOM helper는 `dashboard-ui-common.js` 책임이다.

계산/데이터 함수는 가능한 한:

```text
input
→ calculation
→ result
```

형태를 유지한다.

## 2.4 `dashboard-ui.js`와 `dashboard-ui-common.js` 책임

### `dashboard-ui.js`

일반 화면 UI와 UI 전용 action을 담당한다.

예:

- Topbar
- Navigation / 목차
- 모바일 메뉴
- theme / corner theme
- 일반 card/table rendering
- KRX modal
- 증권계좌 View
- asset tab
- `data-dashboard-action` 중 일반 UI action routing

### `dashboard-ui-common.js`

여러 UI 모듈이 함께 사용하는 **저수준 공통 UI foundation**만 담당한다.

예:

- 공통 SVG navigation icon
- HTML escape
- 공통 swatch / metric card / mobile info card markup
- Phone Landscape 공통 predicate
- mobile table/card 보기 state · attrs · toggle helper
- 공통 App Toast / mobile viewport reflow helper
- 증권·퇴직연금 공통 Asset Detail renderer
  - 현황 table/card shell
  - 비중 bar
  - 전일 대비 변동 KPI + table/card shell
  - 오늘 상승분 기여도
  - Asset tooltip interaction

공통 helper를 빌리기 위한 이유만으로 `dashboard-pension.js`, `dashboard-pension-editor.js` 같은 feature module이 `dashboard-ui.js`를 직접 import하지 않는다. 여러 feature가 재사용하는 저수준 UI helper/state는 `dashboard-ui-common.js`에 두되, 화면별 계산·render/action을 common layer로 끌어올리지 않는다.

### `dashboard-modal.js`

기능 내용과 분리된 **Modal/Dialog lifecycle foundation**을 담당한다.

- custom overlay / native `<dialog>` open·close
- ESC / backdrop dismiss
- focus trap / initial focus / focus return
- background inert / body scroll lock / nested modal count

각 feature는 modal 안의 데이터·저장·API·렌더링을 계속 직접 소유한다. Modal markup 전체를 범용 factory로 합치지 않는다.

### Asset Detail 공통 불변조건

- Asset Detail common layer는 각 자산 모듈이 계산한 neutral View Model을 받아 **표현만** 담당한다. 증권과 퇴직연금의 계산 로직을 common layer로 합치지 않는다.
- `dashboard-core.js`는 DOM-free를 유지하고 `dashboard-ui-common.js`는 화면별 기능 모듈을 역으로 import하지 않는다.
- 증권 `보유종목 현황`과 퇴직연금 `연금상품별 현황`, 양쪽 `전일 대비 변동`과 `오늘 상승분 기여도`는 같은 renderer/CSS 체계를 사용한다.
- 현황/변동 표는 공통 auto layout을 사용하며, 개별 화면을 맞추기 위한 컬럼별 고정 폭이나 `table-layout:fixed`를 새로 강제하지 않는다.
- 상품 행은 증권/연금 모두 **선택일 평가금액 내림차순**으로 정렬하고, 현금·현금성자산·합계 같은 비상품 행은 고정 위치를 유지한다.
- 증권 현황 summary는 `보유종목 합계 → 증권계좌 현금 → 총합계`, 퇴직연금 현황 summary는 `투자상품 합계 → 현금성자산 → 총합계`의 의미 구조를 유지한다.
- 증권계좌 현금은 장부 보정값이므로 증권 `전일 대비 변동`과 `오늘 상승분 기여도`에서 제외한다. 퇴직연금 `전일 대비 변동`도 시장성 투자상품의 가격 변동만 비교하도록 현금성자산을 제외하되, `오늘 상승분 기여도`는 운용자산 기준의 기존 현금성자산 포함 계약을 유지한다.
- `전일 대비 변동`의 가격 헤더는 실제 snapshot 날짜·상태를 사용한다. 선택일이 오늘의 `intraday` snapshot일 때만 당일 열을 `현재가`로 표시하고, 과거 또는 종가 확정 snapshot은 `종가`를 사용한다.
- viewport별 상품명 축약, compact row 구성, 정렬·간격 같은 표현 세부는 renderer/CSS를 Source of Truth로 하며 이 문서에 미세 규칙을 중복 기록하지 않는다.

### Table 공통 contract

- 메인 표의 기본 geometry/typography는 `.dashboard-data-table`의 `--data-table-*` semantic token이 소유한다. viewport별 실제 값은 CSS를 Source of Truth로 본다.
- `table / tr / th / td` 높이를 직접 고정하지 않는다. 셀 높이는 font-size, line-height, padding으로 결정한다.
- 숫자는 `.num`이 기본 우측 정렬을 담당하고, 문자형 열은 `.table-cell-text`, 수량/%처럼 의미상 가운데가 필요한 값은 `.table-cell-center`를 사용한다. 위치 기반 `nth-child`나 역할이 중복되는 정렬 utility를 다시 도입하지 않는다.
- 일반 row label과 summary/합계의 weight 차이는 semantic contract로 유지한다. 계좌별 summary 메모 등 의도된 regular 예외를 전체 표 규칙으로 확대하지 않는다.
- secondary 정보는 `.data-table-sub` 계열 contract를 공유하고, 양수·음수 색상은 기존 positive/negative semantic color를 재사용한다.
- `투자원금 원천 및 검산` 3개 표는 `renderSourceDataTable({ caption, rows })`가 공통 shell을 담당한다. 계산식·row 구성·summary 데이터는 각 기능이 소유한다.
- 현황표의 종목/상품 swatch는 기존 chart series color source를 재사용하고 table 전용 color mapping을 별도로 만들지 않는다.

### 성과 요약 · 계좌별 불변조건

- 증권과 퇴직연금 상단 KPI는 공통 **`성과 요약` shell**과 title/action rhythm을 공유한다.
- 증권만 `전체 / 계좌별` 전환을 제공하며, 계좌별은 별도 섹션이 아니라 같은 overview의 view 전환이다.
- 계좌별 기본 의미 순서는 `구분 → 투자 결과물 → 투입원금 → 누적손익 → 누적수익률 → 메모`다. responsive 표현이 바뀌어도 `투자 결과물`과 `투입원금`의 의미·순서를 뒤집지 않는다.
- 각 계좌의 `투입원금`·`투자 결과물`은 성과 기준값(A)과 장부 조정값(B)의 관계를 유지하고, 합계는 각 계좌 최종 장부값과 전체 성과 카드가 일치해야 한다.
- 별도수익 상태는 기존 `separateProfitView()`의 재분류 기준을 따른다. 개인 기능 비활성 상태에서는 개인 기능의 존재를 직접 드러내는 표현을 사용하지 않는다.
- 계좌1 투입원금 조정 B의 중복 제거 근거는 `레버수익 재투입 + VIP 수익 재투입 + 실현수익 투입`이며 `원천·보유 차액`은 성과기준 투입원금에는 남기되 조정 B 근거에서는 제외한다. 삼성증권2 투자 결과물 조정은 VIP 재투입액 중복 제거와 연결된다.
- `투자원금 원천 및 검산`은 3개 source card 구조와 각 표의 `합계`를 최종값으로 사용한다. base 원천과 재투입 원천을 구분하고 `원천·보유 차액`은 중립 검산값으로 취급한다.
- `2026-06-18` 이전 복원 구간은 현재 설명문에 맞추기 위해 과거 수치를 재계산하지 않는다. legacy 수치 의미는 데이터 기준선을 우선한다.
- 세로 Phone의 계좌별 상태에서 제목행 control 순서는 `별도수익 ON/OFF → 카드 보기/표 보기 → 전체/계좌별`이다. 카드/표 전환을 가장 오른쪽으로 보내거나 ON/OFF와 분리하지 않는다. 그 밖의 mobile 열 축약과 메모 표시 방식은 실제 renderer/CSS를 Source of Truth로 한다.
- `삼성증권1 기준` / `퇴직연금 기준`은 동일한 `.section-basis-chip` 역할을 공유한다. 기준 pill의 컨테이너는 시각 중심이 안정적인 action chip의 geometry 원칙을 따라 `height:var(--section-chip-height)`, 상하 padding `0`, `line-height:1`, flex center를 사용하고 viewport에서는 좌우 padding과 font-size만 조정한다. 한글/영문 glyph가 line-box 안에서 위로 보이는 광학 오차는 컨테이너를 움직이지 않고 내부 `.control-text-optical`만 단일 `--control-text-optical-shift:1px`로 아래 보정한다. 같은 state badge 역할인 별도수익 ON/OFF와 차트 Y축 자동 ON/OFF도 badge 배경 자체가 아니라 내부 텍스트만 이 primitive를 공유한다. 모바일 compact에서 별도수익 외부 라벨의 표시 여부는 `.separate-profit-toggle-label`만 직접 제어하며, descendant `span` 전체를 숨기는 selector는 금지한다. 따라서 내부 ON/OFF `.control-text-optical`은 viewport 라벨 숨김 규칙의 영향을 받지 않는다. 별도수익 토글은 외부 라벨이 CSS로 숨겨져도 접근성 이름이 사라지지 않도록 안정적인 `aria-label="별도수익 포함"`을 유지하고, 현재 상태는 기존 `aria-pressed`로 전달한다. 이미 실기 중심이 안정적인 카드/표 전환 같은 일반 action chip에는 이 optical shift를 확대하지 않으며, 개별 `top`/`margin-top`/별도 translate 값을 추가하지 않는다.

### Modal / Action Form 공통 contract

- 업무 목적이 다른 modal도 surface, header/action, input/select/date, focus, 상태 표시 등 공통 form/control 표현과 `dashboard-modal.js`의 dialog lifecycle을 재사용한다.
- 기능별 modal은 자기 업무 state/persistence만 소유한다. KRX 반영 로직이나 퇴직연금 PIN·저장·batch/delete 흐름을 generic modal layer로 끌어올리지 않는다.
- KRX·퇴직연금 modal의 overlay·surface·control은 semantic token을 공유한다. 공통 modal radius는 shared modal contract에서 한 번만 소유하고 Tablet/Phone은 해당 shared token만 override한다. Phone 좌우 여백은 overlay padding을 canonical source로 사용하며 feature별 `100vw - npx` 폭 보정을 중복해서 만들지 않는다.
- Tooltip 표시 motion은 `--tooltip-motion`을 공통 source로 사용한다.
- 검증된 responsive/browser별 표현 예외는 feature/CSS가 소유하며, generic 공통화를 위해 제거하지 않는다.

화면별 계산이나 특정 기능 전용 modal/action을 `dashboard-ui-common.js` 또는 `dashboard-modal.js`로 끌어올리지 않는다.

- 공통 가로 스크롤 overflow 상태(`.mobile-scroll`, `.chart-wrap`의 `.is-scrollable`)는 `dashboard-ui-common.js`가 소유하고, Table UI와 Chart가 같은 `refreshScrollOverflowState()`를 재사용한다. 표가 차트 모듈을 import해서 scroll 상태를 갱신하는 역방향 의존은 만들지 않는다.

## 2.5 `dashboard-charts.js` 책임

차트 관련 기능은 기본적으로:

```text
js/dashboard-charts.js
```

에서 관리한다.

예:

- chart state
- chart rendering
- SVG / axis / bar / line
- legend / chart controls
- 확대 차트
- chart scroll
- animation
- chart tooltip
- responsive chart 처리
- `data-dashboard-action` 중 차트 전용 action routing

차트 내부 DOM/state 구현을 `dashboard-ui.js`나 `dashboard-app.js`가 직접 만지지 않는다.

`dashboard-app.js`는 charts가 제공하는 공개 command/API만 사용한다.

### Chart UI / Expanded / SVG 공통 contract

- 일반 차트는 `.chart-card`, `.chart-head`, 공통 control primitive, options row, legend, mini-card와 공통 vertical rhythm을 재사용한다. 기능별 차트가 동일 역할의 padding/control geometry를 별도로 만들지 않는다.
- Main의 공통 section/chart 제목(`.section-title h2/h3`, `.chart-head h3`)은 `--section-title-line-height:1`을 사용한다. 한글 glyph는 font line-box의 수학적 중심보다 시각 중심이 위에 보일 수 있으므로, 제목 텍스트 자체는 이동하지 않고 왼쪽 `.section-title-icon`과 선택적 `.chart-title-info-slot`만 단일 `--section-title-icon-optical-shift:-1.5px` 토큰을 공유해 동일하게 광학 보정한다. 과거 `.section-title-icon{margin-bottom:1px}`처럼 한쪽 아이콘만 보정하거나 viewport별 값을 따로 만들지 않는다. Desktop/Tablet/Phone 모두 이 공통 계약을 따르며 다른 역할의 Modal/인사이트/데이터카드/Add 제목에는 전파하지 않는다.
- 증권 3개 + 퇴직연금 3개 차트 제목은 `renderChartCard()` → `.chart-title-label > .chart-title-text` 공통 primitive를 사용한다. 퇴직연금 2개 설명 아이콘만 `.chart-title-info-slot`을 선택적으로 추가하며, compact Phone에서는 이 slot이 `1lh` line-box를 소유하고 내부 버튼을 중앙 정렬한다. 개별 `top`/`margin-top`/별도 `translateY` 보정을 추가하지 말고, 광학 보정이 필요하면 반드시 공통 `--section-title-icon-optical-shift` 하나만 사용하여 info가 없는 증권/퇴직연금 차트와 동일한 제목 typography·line-height·row geometry를 유지한다.
- 확대 차트는 별도의 독립 chart/control state를 복제하지 않는다. 기존 SVG와 controls/options/legend를 expanded overlay로 이동해 사용하고 닫을 때 placeholder 위치로 복원하며, chart state와 공개 action 흐름을 그대로 공유한다. 확대에서만 필요한 닫기/viewport 처리와 별도수익 control 보조는 expanded layer가 소유한다.
- 확대 차트의 Desktop baseline geometry는 `common.css`가 소유하고, Tablet/Phone을 함께 가로지르는 회전형 expanded overlay 예외는 `special.css`의 `Expanded Chart Non-Web Shared ≤1100px`가 소유한다. 일반 Tablet chart width/scroll edge는 `tablet.css`, 세로·가로 Phone 공통 compact chart density/scroll edge는 `special.css` Phone Shared가 소유하며 `common.css @media(max-width:1100px)`에 Chart responsive 구현을 다시 두지 않는다.
- `control-info-button`은 Chart 전용이 아니라 계좌 메모 등에서도 재사용하는 generic primitive이며, 원과 `i` geometry는 `img/ui-icons.svg#info-circle` 공통 SVG를 사용하고 색상 source는 `--info-control-*` semantic token을 사용한다. 확대 stage의 비대칭 safe gutter는 `--chart-expanded-pad-*` component-local token으로 이름을 부여해 control/viewport 여백 의도를 추적한다.
- SVG 내부는 frame/scale/좌표 helper처럼 의미가 동일한 계산만 공통화한다. dual axis, KOSPI 비교, line/bar/stack처럼 데이터 의미가 다른 renderer를 범용 renderer 하나로 억지 통합하지 않는다.
- 일반 차트와 확대 차트의 tooltip/resize/keyboard/legend 최소 1개 선택/Y축 자동 등 기존 불변조건은 같은 chart state에서 함께 검증한다.

## 2.6 퇴직연금 View / Editor 책임

퇴직연금은 현재 의도적으로 두 파일로 나뉜다.

### `dashboard-pension.js` — View

**보여주는 책임**을 담당한다.

- 퇴직연금 화면 rendering
- 상품별 현황
- 평가/손익 표시
- 오늘 상승분 기여도
- 위험자산 70% 룰
- Asset 인사이트 markup

읽기 화면에 필요한 계산은 core helper를 사용하고, 저장/PIN/batch 로직을 넣지 않는다.

### `dashboard-pension-editor.js` — Editor

**사용자가 값을 변경하는 흐름**을 담당한다.

- 금액조정 modal
- form state
- 기업적립금 / 현금성자산 / ETF 추가매수
- PIN
  - 퇴직연금 Action PIN 입력은 Chrome 비밀번호 저장 대상으로 오인되지 않도록 credential `password` field를 사용하지 않고, 숫자 입력 + CSS 마스킹을 유지한다.
- batch queue / simulation / apply
- 저장 / 삭제
- Google Apps Script persistence
- editor event delegation

View와 Editor를 다시 하나의 `dashboard-pension.js`로 합치지 않는다.

## 2.7 `dashboard-app.js` 책임

`dashboard-app.js`는 앱 전체를 연결하는 orchestration 계층이다.

주 역할:

- 날짜 변경
- 별도수익처럼 여러 모듈에 영향을 주는 흐름
- cross-module action
- render orchestration
- 초기 state 연결
- event delegation entry
- boot

차트 버튼 종류와 일반 UI 버튼의 세부 동작은 각각 `dashboard-charts.js`, `dashboard-ui.js`가 해석한다.

즉 app은:

> **기능 구현보다 기능들을 연결하는 역할**

을 유지한다.

새 기능의 실제 계산, 특정 화면 rendering, chart DOM, modal 내부 구현을 app에 누적하지 않는다.

## 2.8 `dashboard-market-ai.js` standalone 책임

`dashboard-market-ai.js`는 main feature state와 분리된 **로컬·원격 실제 Market AI 조회 전용 standalone entry**다. `dashboard-modal.js`의 저수준 dialog lifecycle만 공유하며 polling/state/mount/render는 자체 소유한다.

현재 책임과 불변조건:

- 로컬(`localhost`, `127.0.0.1`)에서는 현재 host의 `:8001` Market AI API를 조회하고, 비로컬 GitHub Pages에서는 `https://node.tail60a98e.ts.net` Tailscale Serve를 통해 같은 실제 Market AI API를 조회한다.
- `market-ai-preview` 예시 데이터 모드는 사용하지 않는다. `?dashboard-view=web`, `?dashboard-view=tablet`, `?dashboard-view=mobile`은 화면 형태만 바꾸며 세 모드 모두 실제 Market AI 데이터를 사용한다.
- Market Snapshot, Signal, KIS Bridge 상태는 서로 실패 격리한다. 일부 endpoint 오류 때문에 같은 refresh에서 정상 수신한 다른 데이터를 지우지 않으며, 전체 연결 실패와 개별 데이터 지연/오류를 구분한다. 세 endpoint가 모두 응답하지 않으면 로컬은 panel 중앙에 `연결 확인 중`을 표시하며 재시도하고, 비로컬 환경은 응답 확인 전부터 Market AI panel·button·dialog를 mount하지 않은 채 polling만 유지한다.
- refresh가 겹치면 latest-wins를 유지한다. 늦게 도착한 이전 요청 응답이 더 최신 요청에서 반영한 state를 역으로 덮지 않도록 request sequence를 state 반영 전에 확인한다.
- backend가 제공하는 signal metadata와 산식 contract를 프런트에서 임의 재해석하지 않는다. 상세 backend 계약은 Market AI 프로젝트의 `market_ai_project_handover.md`를 Source of Truth로 한다.
- SOX 시장 metric과 Signal Engine 입력은 모두 `INDEX:SOX`를 사용하며 표시 편의를 위해 `FUTURES:SOX` 또는 `SOX-F`로 자동 전환하지 않는다.
- KOSPI200선물은 `kis-efriend:*` 실제 소스이면서 proxy가 아닌 snapshot만 표시한다. 장 종료로 확인된 마지막 정상값은 허용하지만, 장중 stale·Bridge 단절·대체 소스는 사용 가능한 실선물 값처럼 표시하지 않는다.
- signal state가 `actual_close`이면 상승마감 metric을 예측값으로 계속 표시하지 않고 실제 KOSPI 종가 결과와 확정 상태로 전환한다. `available:false`는 유효 신호 없음으로 처리한다.
- 신호 상세의 판단 근거는 backend `effective_weight`를 우선 표시하고, 해당 metadata가 없는 호환 응답에서만 configured/legacy weight를 fallback한다. 이 normalization은 표시 호환용이며 프런트가 signal 산식을 다시 계산한다는 뜻이 아니다.
- 선택된 과거 `activeDate`와 무관하게 Market AI panel은 현재 시점 신호를 표시한다.
- Desktop/Tablet과 Mobile이 같은 `#market-ai-section` DOM을 재사용하며 별도 Mobile render tree를 만들지 않는다.
- metric tooltip은 Desktop/Tablet의 keyboard/pointer interaction에서만 제공하고 Phone에서는 tooltip 속성·focus target을 제거한다.
- polling은 문서가 보이는 동안만 실제 refresh하고, 다시 visible이 되면 즉시 갱신한다. 정확한 poll/timeout/freshness 수치는 최신 JS를 따른다.
- `window/globalThis` bridge, main `dataState/uiState` 직접 접근, main feature module import를 추가하지 않는다.
- layout 비율, tooltip 위치, viewport별 density, freshness threshold 같은 현재 표현·운영 수치는 실제 CSS/JS/backend 설정을 Source of Truth로 하고 handover에 미세값을 고정하지 않는다.

eFriend, KIS Bridge, Tailscale Serve/CORS, backend 수집·신호 산식·운영 절차는 `dashboard-market-ai.js`의 책임이 아니다. 해당 상세 운영은 Market AI 프로젝트의 `market_ai_project_handover.md`를 따른다.

## 2.9 JS state · initialization ownership

공유 state와 module-private state를 구분하고, **누가 사용하는가보다 누가 책임져야 하는가**를 기준으로 owner를 정한다.

공유 state:

```text
dataState
→ core / 현재 데이터 · activeDate 등 앱 공통 데이터 상태

uiState
→ core / 여러 메인 모듈이 공유하는 UI 상태
```

module-private state:

```text
dashboard-ui-common.js
→ mobileViewModes
→ Asset tooltip touch/binding guard state

dashboard-modal.js
→ focus stack / body lock count / native dialog lifecycle state

dashboard-charts.js
→ chartState
→ chartRuntimeState
→ tooltip animation/runtime guard

dashboard-ui.js
→ appearanceChannel
→ uiRuntimeState

dashboard-pension-editor.js
→ pensionEditorState
→ modal height scheduling state

dashboard-app.js
→ heroBasisTapState
→ chartDateJumpState

dashboard-market-ai.js
→ marketAiState
→ polling / mount / tooltip binding / refresh sequence runtime state
```

유지 원칙:

- `chartState`나 editor batch state를 core/global로 올리지 않는다.
- Market AI state를 메인 `dataState` / `uiState`에 합치지 않는다.
- 새 global store / event bus / framework state manager / 거대한 단일 state 객체를 만들지 않는다.
- `window` / `globalThis` state bridge로 module ownership을 우회하지 않는다.
- 반복 render에 필요한 listener/tooltip/chart guard는 각 owner module 안에서 관리한다.
- 퇴직연금 dashboard 재렌더 연결은 editor setup 단계의 명시적 `renderDashboard` callback dependency를 유지한다.
- main app boot는 `dashboard-app.js` 단일 entry가 담당하며 Market AI는 별도 standalone entry에서 자기 initialization만 담당한다.

## 2.10 메인 JS의 파일 간 책임을 함부로 섞지 않는다

예를 들어:

```text
차트 계산/DOM/action → charts
Topbar/Navigation/UI action → ui
공통 저수준 UI helper → ui-common
Modal/Dialog lifecycle → modal
퇴직연금 조회 View → pension
퇴직연금 변경/저장 → pension-editor
앱 boot/cross-module orchestration → app
Market AI local/remote 실제 API 조회/mount/fail isolation → market-ai standalone
```

처럼 책임을 유지한다.

한 기능을 수정하기 위해 4~5개의 JS 파일을 동시에 건드려야 하는 구조를 새로 만들지 않는다.

그렇게 해야만 구현되는 요청이라면 구조가 잘못된 방향인지 먼저 검토한다.

## 2.11 현재 구조별 수정 위치 기준

향후 수정 시 기본적으로 다음 책임을 참고한다.

```text
메인 CSS 공통/기본 규칙 + Desktop baseline
→ css/common.css

태블릿 전용 반응형
→ css/tablet.css

모바일 전용 반응형
→ css/mobile.css

특수 viewport
→ css/special.css

입력장치 hover / pointer
→ css/interaction.css

인쇄
→ css/print.css

데이터 / 공통 계산 / formatter / 공용 데이터 state
→ js/dashboard-core.js

공통 저수준 DOM / 마크업 / shared mobile view state / Toast·viewport helper
→ js/dashboard-ui-common.js

Modal/Dialog lifecycle / focus / inert / body lock
→ js/dashboard-modal.js

차트
→ js/dashboard-charts.js

Topbar / Navigation / 일반 UI
→ js/dashboard-ui.js

퇴직연금 조회 View
→ js/dashboard-pension.js

퇴직연금 변경 / PIN / batch / persistence
→ js/dashboard-pension-editor.js

cross-module event routing / render orchestration / boot
→ js/dashboard-app.js

Market AI 로컬 `:8001` + 원격 Tailscale 실제 현재 신호 조회 / Hero 보조 UI standalone adapter
→ js/dashboard-market-ai.js

Market AI Desktop baseline / 공통 component
→ css/common.css의 Hero 확장 영역

Market AI Tablet 배치
→ css/tablet.css의 Hero 인접 영역

Market AI Phone 진입 버튼 / native dialog / mounted panel 이동
→ css/special.css의 Phone UI Shared 기능 viewport
```

단, 기능의 실제 책임을 확인한 뒤 판단하며 파일명만 보고 무조건 수정하지 않는다.

## 2.12 현재 ES Module dependency graph

현재 dependency 방향은 다음과 같다.

```text
kodex-schema    → 다른 dashboard module import 없음
core            → kodex-schema
ui-common       → 다른 dashboard module import 없음
modal           → 다른 dashboard module import 없음
charts          → core + ui-common + modal
ui              → core + ui-common + modal + charts
pension         → core + ui-common + charts
pension-editor  → core + ui-common + modal
app             → core + ui-common + modal + charts + ui + pension + pension-editor

standalone entry
market-ai       → modal만 공유
```

`core`와 `modal`은 서로 독립된 저수준 foundation으로 유지하고 feature module을 역으로 import하지 않는다. `market-ai`도 modal lifecycle 외의 main feature module과 결합하지 않는다.

불변조건:

```text
core → DOM/UI module import 금지
ui-common / modal → 화면별 feature module import 금지
feature module → ui를 공통 helper 저장소처럼 직접 import하지 않음
charts → ui 역참조 금지
하위 module → app import 금지
pension View ↔ pension-editor 상호 import 금지
market-ai → modal 외 main feature import 금지
circular import = 0
```

## 2.13 ES Module import / export 운영 규칙

모듈 간 기능 사용은 실제 named `import / export`로 표현한다.

권장:

```js
import {foo, bar} from './dashboard-core.js';
```

규칙:

- relative path에 `.js` 확장자 포함
- named export 우선
- 사용하지 않는 import/export를 습관적으로 만들지 않음
- dependency 우회를 위한 wrapper를 만들지 않음
- global compatibility bridge를 만들지 않음
- 순환 import를 만들지 않음
- 기능을 export하기 위해 책임 파일을 잘못 옮기지 않음

ES Module migration 이후 사용하지 않는:

```text
classic script load-order guard
register hook registry
임시 global bridge
```

등을 다시 도입하지 않는다.

반복 render 때문에 실제로 필요한 listener/tooltip/chart guard는 별개의 문제이므로 함부로 제거하지 않는다.

## 2.14 `index.html` module entry와 cache bust 정책

현재 `index.html`은 main dependency graph를 classic script 다중 load로 구성하지 않는다.

현재 구조:

```text
importmap
+
<script type="module" src="js/dashboard-app.js?...">
+
<script type="module" src="js/dashboard-market-ai.js?...">  # standalone
```

`index.html`에서 `Date.now()`를 기준으로 main module dependency importmap과 두 module entry(`dashboard-app.js`, `dashboard-market-ai.js`)에 cache bust를 적용한다.

중요:

- 신규 module을 추가/이름 변경할 때 importmap 누락 여부 확인
- cache bust 정책을 기능 수정과 함께 임의 변경하지 않음
- importmap을 단순히 불필요해 보인다는 이유로 제거하지 않음
- static import path는 현재 `.js` 상대경로 유지
- module 전환과 무관한 viewport/theme 초기화 inline script는 함부로 변경하지 않음
- 다시 classic script 다중 load 구조로 돌아가지 않음

## 2.15 main graph 단일 entry와 Market AI standalone 분리를 유지한다

현재 main dependency graph는 **9개 ES Module**이며 `dashboard-app.js`가 main graph의 단일 entry다. `dashboard-market-ai.js`는 두 번째 standalone entry로 main boot 책임을 공유하지 않고, 공통 저수준 `dashboard-modal.js`만 import한다.

```text
index.html
├─ dashboard-app.js      → main graph 9모듈
└─ dashboard-market-ai.js
   └─ dashboard-modal.js → dialog lifecycle만 공유
```

`kodex-leverage-schema.js`는 DOM-free leaf module이며 Main `dashboard-core.js`와 Add Report가 동일 validator를 사용한다. Main/Add에 별도 KODEX schema validator를 다시 만들지 않는다.

실제 dependency는 named `import / export`로 표현하며 circular import와 `window/globalThis` compatibility bridge를 허용하지 않는다. classic script 다중 load, framework/bundler 도입 같은 구조 개편은 사용자가 별도로 요청한 경우에만 검토한다.

# 3. UI · Responsive · 반복 회귀 불변조건

이 장은 **현재 화면의 모든 배치값을 문서로 복제하는 곳이 아니다.** 반복적으로 잘못 수정될 가능성이 높은 UX 의미와 responsive 책임만 남기고, px·gap·정렬·grid 열 수 같은 세부는 HTML/CSS/renderer를 Source of Truth로 한다.

## 3.1 반응형 기준과 Phone 역할

기본 breakpoint는 다음 3구간을 유지한다.

```text
Desktop ≥ 1101px
Tablet  761px ~ 1100px
Mobile  ≤ 760px
```

기능상 필요한 실제 스마트폰 landscape media는 유지할 수 있으나 특정 기기 해상도 맞춤식 breakpoint를 추가하지 않는다. Phone Shared는 세로폰과 실제 가로폰이 공유하는 compact density를, Phone Landscape는 가로폰에서만 달라지는 최소 배치를 소유한다.

Navigation 책임은 다음 의미를 유지한다.

- Phone 세로/가로: Mobile hamburger 중심
- Tablet: 축약 action + hamburger 목차
- Desktop: 기존 action + 우측 edge TOC

JavaScript의 phone 판정은 `dashboard-ui-common.js`의 canonical helper를 재사용하고 같은 `matchMedia` 조건을 기능 모듈마다 복제하지 않는다.

### iPhone Safari 데스크탑 웹사이트 요청

현재 canonical desktop-request viewport는 **`width=1280`**이다. 과거 `width=1980` 기준은 폐기되었으며 되돌리지 않는다. 1280px은 일반 Desktop baseline 자체를 사용하므로 `iphone-request-desktop` 같은 별도 CSS 보정 class를 만들지 않는다.


## 3.2 Section Title / Control 공통 불변조건

- 메인 `h2`, 하위/차트 `h3`는 공통 title typography/icon contract를 사용하고 부모 container는 배치 책임만 가진다.
- 같은 모양·상호작용의 control은 기존 공통 primitive를 우선 재사용하고, 기능별 class는 의미·위치·표시조건처럼 필요한 차이만 담당한다.
- ON/OFF 또는 상태 control의 표시 여부 때문에 section title row의 기본 geometry가 흔들리지 않아야 한다.
- 이 문제를 해결하기 위해 hidden placeholder나 임시 margin 보정처럼 공간을 억지로 예약하지 않는다.
- 실제 높이·아이콘 크기·gap·control px 값은 CSS token을 Source of Truth로 한다.

## 3.3 반복 회귀 이력이 있는 UI/기능

관련 영역을 수정할 때 아래 의미 계약을 우선 확인한다. 세부 문구·색상값·현재 위치는 최신 소스를 기준으로 한다.

### Theme / Corner

테마·모서리 control은 실제 현재 상태를 잘못 암시하는 permanent active UI가 되지 않아야 하며 Light/Dark 모두 icon contrast를 유지한다. Main에서 두 appearance control을 변경할 때는 기존 localStorage key(`investmentDashboard.theme`, `investmentDashboard.cornerTheme`) 갱신과 함께 `investmentDashboard.appearance` BroadcastChannel로 현재 Light/Dark·Corner 상태를 발행한다. Add의 Calc/Report는 storage event를 fallback으로 유지하면서 이 channel을 소비해 이미 열린 탭도 실시간 동기화한다.

Light/Dark는 같은 semantic 의미 체계를 공유한다. 양수·음수는 각각 `--value-positive` / `--value-negative`를 사용하고, 성공·정보·주의·오류·위험은 별도 status token으로 구분한다. 테마 공통화 과정에서 양수·음수 class를 한쪽 색으로 합치거나 status color로 대체하지 않는다. Corner는 surface/control/inner cap을 통해 같은 geometry에 적용하며 정보 위계가 다른 작은 control까지 같은 radius로 강제하지 않는다.

### Table

Table의 geometry·정렬·summary contract는 **2.4 `Table 공통 contract`**를 canonical 기준으로 한다. 관련 수정 시 특히 summary 첫 셀과 나머지 셀의 배경/border, sticky first column, horizontal scroll, semantic alignment가 깨지지 않는지 확인한다.

### 성과·장부

- 금액 성과는 `손익`, 비율 성과는 `수익률` 용어를 기본으로 한다. 실제 확정 재원·출처를 뜻하는 `실현수익`, `별도 수익 재투입` 같은 표현은 예외다.
- `장부결과 VS 실제보유`는 `차액(A-B)`이 결론이고 A는 장부상 투자 결과물, B는 실제 증권계좌+현금 보유액이라는 의미를 유지한다.

### KRX 현재가 반영

- 최신/누락 반영과 선택일 재갱신의 업무 의미를 섞지 않는다.
- 이미 종가 기준인 날짜는 불필요한 workflow를 다시 실행하지 않는 현재 contract를 유지한다.
- modal focus/ESC/request timeout과 같은 기본 lifecycle을 회귀검증한다. 요청 중 재전송을 막고, modal 재진입 시 이전 요청의 응답·상태 문구·자동 닫기 timer가 새 session을 덮거나 닫지 않도록 request/session 경계를 함께 보호한다.
- QA에서는 실제 외부 write를 하지 않는다.

### 퇴직연금

PIN, 저장/삭제, batch, 금액조정 modal, 상품/차트 연결을 수정할 때 feature state와 persistence contract를 함께 검증한다. Action PIN은 전송 전에는 취소·닫기·ESC·backdrop dismiss를 허용하지만, 서버 요청이 시작된 뒤에는 결과가 확정될 때까지 dismiss를 잠가 호출자의 로컬 상태·완료 안내가 서버 저장 결과와 분리되지 않게 한다. 요청 실패 시에만 입력과 dismiss를 다시 활성화한다. QA에서는 실제 GAS write를 하지 않는다.

### Chart

관련 수정 시 최소 다음을 함께 확인한다.

- 증권/퇴직연금 전환과 lazy draw
- 범례 다중선택·최소 1개·전체
- Y축 자동/고정 의미와 좌우축 정합성
- 확대/tooltip/keyboard/resize
- smartphone landscape
- listener 중복 또는 chart 이중 생성 없음

표시 기준 스위치는 선/Y축 표시 기준만 바꾸며 tooltip 정보 contract를 불필요하게 축소하지 않는다. 사용자가 범례에서 숨긴 series는 tooltip 대상에서도 제외한다.

### Market AI

- local/remote 모두 실제 API를 사용한다.
- 예시 데이터 전용 모드를 다시 도입하지 않는다.
- Phone의 `dashboard-view`는 화면형태만 바꾼다.
- remote는 실제 endpoint 응답이 확인되기 전까지 Market AI UI를 mount하지 않고 polling으로 복구를 기다리며, local 전체 연결 실패는 panel 중앙의 `연결 확인 중` 상태를 유지한다. 어느 쪽도 일반 대시보드의 다른 기능을 깨뜨리지 않는다.
- Desktop/Tablet Hero와 Mobile dialog가 같은 panel DOM을 재사용하는 구조를 유지한다.
- Phone에서는 Market AI metric tooltip을 활성화하지 않는다.

## 3.4 계좌별 성과 메모 tooltip

- 계좌별 성과 메모 동작은 `dashboard-ui.js`가 소유하고 chart tooltip 구현과 섞지 않는다.
- 좁은 화면의 info tooltip과 넓은 화면의 inline memo는 같은 내용 contract를 유지한다.
- floating tooltip은 viewport/stacking context 밖으로 잘리지 않아야 하고 outside click, ESC, scroll, resize에서 정상 정리된다.
- 정확한 breakpoint, 줄바꿈, 위치 보정 수치는 최신 CSS/JS를 Source of Truth로 한다.

## 3.5 개인보기 3회 클릭 제스처

Hero 기준일 영역의 **연속 3회 클릭 개인보기 ON/OFF는 의도된 비공개 진입 UX**다.

- discoverability 부족 자체를 감점하거나 공개 버튼 추가를 권하지 않는다.
- 이 제스처를 보안 인증 수단으로 취급하지 않는다.
- 3회 클릭 인식, `OFF → ON → OFF` 상태 reset, 일반 날짜/Topbar/입력 동작 간섭 여부는 실제 회귀로 검증한다.

## 3.6 모바일 표 · 카드 보기

- 공통 mobile view state와 renderer는 `dashboard-ui-common.js`가 소유한다. 현황·변동·계좌별 화면마다 별도 toggle state나 카드 shell을 만들지 않는다.
- 최초 진입은 표 보기다. 세로 Phone에서 사용자가 카드 보기를 선택한 뒤 가로로 회전하면 표를 표시하고, 다시 세로로 돌아왔을 때 기존 카드 선택 상태를 복원한다.
- 실제 터치폰 가로는 표 전용이다. 카드 보기 toggle을 숨기고 표를 canonical 표현으로 유지한다.
- Print는 현재 mobile view state와 관계없이 표를 사용한다.
- 모바일 data card는 공통 `data-list-card`의 title/label/value/row/total typography와 separator contract를 재사용하고 숫자에는 tabular number 정렬을 유지한다.

## 3.7 Print canonical 표현

- Print는 현재 Light/Dark 상태와 관계없이 Light palette로 고정한다. `beforeprint`에서 `print-light-theme`을 적용하고 모든 SVG 차트를 Light chart palette로 다시 그린 뒤 `afterprint`에서 화면 테마 차트로 복원한다. 인쇄 차트의 가로세로 비율은 SVG `viewBox`에서 자연스럽게 파생하며 `print.css`에 `1120/330` 같은 프레임 literal을 다시 소유하지 않는다.
- Topbar·목차·modal·tooltip·toast·보기 전환·차트 조작 UI·Market AI는 인쇄에서 제외한다.
- 비활성 자산 panel도 펼쳐 증권계좌와 퇴직연금을 연속 출력하고, Phone에서 숨긴 Hero 요약 pill도 모두 표시한다.
- 성과 KPI는 4열, 누적손익/운용손익 차트 하단 6개 요약은 3열, 종목·상품 차트 하단 요약은 4열을 viewport와 무관한 인쇄 기준으로 사용한다.
- 장부 검산은 결론 전체폭 + A/B 2열의 Tablet형 배치를 사용하고, `투자원금 원천 및 검산`의 source card 3개는 한 행 3열로 출력한다.
- 계좌별 성과표는 인쇄용 고정 layout과 의미 열 폭을 사용해 `구분`·`메모`가 본문을 침범하지 않게 한다. 화면용 sticky/scroll/card 상태는 인쇄에 남기지 않는다.
- 양수·음수 semantic color는 Light 인쇄 palette에서도 유지한다.

# 4. CSS · Responsive 유지보수 규칙


## 4.1 메인 CSS 6파일 구조 원칙

메인 대시보드 CSS는 2026-08-21 구조정리 이후 후속 정리를 거쳐 기존 `css/style.css` 단일 파일에서 **역할별 6파일 구조**로 정착했다. Desktop 전용 파일은 제거하고 `common.css`를 Desktop baseline으로 사용한다. `css/style.css`와 `css/desktop.css`는 최종 구조에서 제거되었으며 다시 만들지 않는다.

현재 canonical 구조:

```text
css/
├─ common.css       # 변수 / 기본 스타일 / 공통 컴포넌트 / Desktop baseline / Responsive Shared
├─ tablet.css       # Tablet 761~1100px에서 common baseline 변경
├─ mobile.css       # Mobile ≤760px에서 common baseline 변경
├─ special.css      # 기능상 필요한 특수 viewport
├─ interaction.css  # hover / pointer
└─ print.css        # Print 전용
```

`index.html`의 load order는 다음 순서를 유지한다. **이 순서가 cascade order**이므로 특별한 구조 변경 작업이 아닌 이상 임의로 바꾸지 않는다.

```text
common.css
→ tablet.css
→ mobile.css
→ special.css
→ interaction.css
→ print.css
```

파일별 책임:

- `common.css`: viewport와 무관한 기본 component, theme/token, 공통 layout, **Desktop baseline**, `max-width:1100px` / `min-width:761px` 같은 Responsive Shared
- `tablet.css`: `761px ~ 1100px`에서 common의 Desktop baseline을 태블릿 표현으로 변경하는 전용 규칙
- `mobile.css`: `max-width:760px` 모바일 전용 규칙
- `special.css`: `≤400px`, `1101~1279px Compact Desktop(Asset Detail)`, Phone UI Shared, Phone Landscape처럼 기능상 이유가 명확한 예외
- `interaction.css`: `hover:hover + pointer:fine`처럼 viewport가 아닌 입력장치 조건
- `print.css`: 인쇄 전용 최종 override

과거 리팩토링의 차수별 상세 이력은 Git history를 사용하며, 이 장은 현재 canonical 구조와 유지보수 규칙만 관리한다.

핵심 유지보수 원칙:

- 기능 수정은 먼저 **어느 역할 파일이 canonical인지** 판단하고 그 파일의 기존 rule을 직접 수정한다.
- 같은 기능을 해결하기 위해 다른 CSS 파일 하단에 임시 override를 누적하지 않는다.
- CSS 구조 변경과 디자인 변경을 같은 차수에 섞지 않는다.
- 새 breakpoint는 실제 레이아웃/정보구조 문제가 있을 때만 추가하고 `special.css`에 기능명 + 존재 이유를 남긴다.
- 파일 분리 자체를 이유로 같은 selector를 여러 파일에 중복 생성하지 않는다.
- `common → 일반 viewport → special → interaction → print`의 우선순위를 보존한다.


## 4.2 반응형 CSS는 뷰포트/역할별 섹션으로 모아 관리

기본 component CSS와 Desktop baseline은 `common.css`의 기능별 영역에 유지하고, Tablet/Mobile에서 달라지는 값만 각 역할 파일에 모아 관리한다. Responsive Shared는 `common.css`, 일반 좁은 뷰포트 override는 `tablet.css` / `mobile.css`, 기능 예외는 `special.css`로 분리한다.

현재 논리적인 cascade 순서는 다음과 같다.

```text
Common component CSS + Desktop baseline + Responsive Shared
↓
Tablet / Mobile override
↓
Special Viewports
↓
Interaction
↓
Print
```

기본 viewport는 계속 다음 3구간을 사용한다.

```text
Desktop · 웹: 1101px 이상
Tablet · 태블릿: 761px ~ 1100px
Mobile · 모바일: 760px 이하
```

특수 viewport는 일반 viewport 섹션에 섞지 않고 **왜 필요한지 기능 기준으로 추적 가능하게 관리**한다. 대표적인 현재 예외는 다음과 같다.

```text
≤400px
→ 초소형 화면에서 계좌별 성과 정보 구조 보정

1101~1279px
→ Compact Desktop 예외: Asset Detail 2-column 가용폭 보정. 1280px은 일반 Desktop 2-column을 유지하며 모바일의 `?dashboard-view=web` 1280 viewport도 이 기준을 따른다.

Phone Landscape
→ iPhone 13 844×390부터 956×440급 대형 스마트폰까지 width만 보면 Tablet으로 오판되는 실제 터치폰 가로모드 대응
```

`hover:hover + pointer:fine`, `print`는 viewport가 아니므로 Desktop/Tablet/Mobile과 분리한다.

Market AI처럼 기존 component를 확장하는 기능은 별도 파일 하단에 모으지 않고 **기준 component와 가까운 순서**로 둔다. 현재 기준은 다음과 같다.

```text
common.css
→ Hero 기본 규칙 직후 Market AI Hero Extension
→ 내부 순서: mount layout → theme/surface → heading/status → rows/metrics → focus/tooltip

tablet.css
→ Hero Tablet 규칙 직후 Market AI Tablet
→ common component를 복제하지 않고 배치/밀도만 override

special.css
→ Market AI용 Compact Desktop override는 두지 않는다.
→ Phone UI Shared에서 Hero의 Desktop panel을 숨기고 AI Signal trigger + native dialog로 같은 panel을 이동·재사용
```

특수 media가 같은 조건을 공유하는 경우 media block을 불필요하게 복제하기보다 하나의 trigger block 안에서 기능별 sub-comment를 분리하고, 상단 `Scope` 주석에 포함 기능을 정확히 적는다.

구조 정리 이후 각 CSS 파일 상단의 Scope/Structure map과 본문의 번호 섹션은 **1:1로 대응**해야 한다. 섹션 순서는 해당 파일의 실제 source order를 Source of Truth로 보고, 문서에 별도의 고정 번호표를 중복 저장하지 않는다.

새 특수 breakpoint를 단순 미관 보정용으로 추가하지 않는다. 실제 레이아웃/정보구조 문제를 해결해야 할 때만 추가하고, `special.css`에 **기능명 + 존재 이유**를 주석으로 남긴다.


## 4.3 CSS 섹션과 주요 주석은 영어 + 한글 병기

주요 CSS 영역과 의미 있는 하위 주석은 영어와 한글을 함께 사용한다.

예:

```css
/* =========================================================
   Topbar / Navigation · 상단바 / 내비게이션
   ========================================================= */

/* Chart Controls · 차트 조작 버튼 */

/* Pension Contribution · 퇴직연금 납입 */

/* Custom Tooltip · 커스텀 툴팁 */
```

다만 모든 selector에 주석을 붙이지 않는다.

주석의 목적은:

> **사람이나 GPT가 원하는 기능 영역을 빠르게 찾도록 하는 것**

이다.

다음과 같은 누적 패치형 주석은 사용하지 않는다.

```text
Fix
Final
Final Fix
Mobile Fix
Override
Temp
New
```

날짜나 작업차수도 CSS 주석에 변경 이력처럼 남기지 않는다.


## 4.4 반응형 기본 viewport는 3구간 고정

메인 대시보드의 canonical viewport 경계는 **3.1 `반응형 기준과 Phone 역할`**을 따른다. CSS 파일별 소유권은 4.1~4.2를 기준으로 하고, 이 절에 같은 경계값을 반복 기록하지 않는다.

새로운 UI를 추가하거나 수정할 때 기본적으로 이 세 구간 안에서 해결한다. **Phone Landscape는 이 기본 3구간을 다시 정의하는 네 번째 breakpoint가 아니라, 실제 터치 스마트폰 가로를 식별하는 기능 media 예외**로만 취급한다.


## 4.5 불필요한 추가 breakpoint 금지

다음과 같은 특정 폭을 단순 미관 보정 목적으로 추가하지 않는다.

- 900px
- 720px
- 520px
- 430px
- 420px
- 390px
- 374px
- 기타 특정 기기 폭

추가 breakpoint는 다음 조건을 모두 만족할 때만 허용한다.

1. 기존 웹 / 태블릿 / 모바일 규칙만으로 해결할 수 없음
2. 실제 기능적 문제가 존재함
3. 해당 구간을 별도로 처리해야 할 명확한 이유가 있음
4. 기존 component 자체를 수정하는 것보다 별도 breakpoint가 더 적절함

현재 이미 존재하는 기능상 필요한 예외 breakpoint는 함부로 제거하지 않는다.

현재 허용된 대표 기능 예외는 다음 두 가지다.

- `1101~1279px`: Compact Desktop 기능 예외다. `.asset-detail-grid`만 1열로 전환한다. `1280px`은 의도적으로 제외해 일반 Desktop 2-column을 유지하고, 모바일의 `?dashboard-view=web`이 강제하는 1280 viewport에서도 변동 카드가 내려가지 않게 한다. `1100px 이하`는 기존 Tablet/Mobile/Phone 규칙이 담당하며 이 조건을 다른 영역의 일반 breakpoint로 확대하지 않는다.
- `landscape + width≤960 + height≤500 + hover:none + pointer:coarse`: 실제 스마트폰 가로 판정에만 사용한다. `960px`을 일반 breakpoint로 재사용하지 않는다.

공통 Asset Detail CSS는 기존 generic class/token을 우선 재사용하고, 실제로 양쪽 자산이 공유하는 의미에만 최소 `.asset-*` semantic class를 사용한다. 현황/전일변동/상승분기여도에서 공통화된 selector는 neutral `.asset-*`가 canonical이며, 같은 역할의 `.pension-*` legacy alias를 병렬로 유지하지 않는다. 위험자산 70% 룰·퇴직연금 조정/PIN/납입 등 연금 전용 UI는 계속 `.pension-*`를 사용한다.



## 4.6 특정 viewport 스크린샷 맞춤식 수정 금지

내가 특정 해상도 화면을 보여주더라도 바로:

> `390px 전용 CSS`

같은 방식으로 해결하지 않는다.

먼저 해당 문제가:

- 모바일 전체 문제인지
- 태블릿 전체 문제인지
- 웹 전체 문제인지
- component 자체 문제인지
- 브라우저 고유 문제인지
- 실제 특정 기기 기능 예외인지

판단한다.

가능하면 대표 breakpoint나 component 자체를 수정해서 해결한다.

목표는 특정 스크린샷 한 장을 맞추는 것이 아니라:

> **해당 viewport 범위 전체를 안정적으로 만드는 것**

이다.


## 4.7 미관 문제와 실제 문제를 구분

다음은 수정해야 할 실제 문제다.

- 요소 겹침
- 텍스트 잘림
- 화면 밖 overflow
- 버튼 조작 불가
- 기능 오류
- 읽기 어려운 텍스트
- 레이아웃 붕괴
- breakpoint 정책 위반
- 명백한 정렬 오류

반면 다음만으로 새 breakpoint나 override를 만들지 않는다.

- 특정 중간 폭에서 약간 어색함
- 여백이 2~3px 마음에 안 듦
- 카드 비율이 조금 덜 예쁨
- 특정 화면에서 아주 미묘한 시각적 차이


## 4.8 CSS 추가보다 기존 규칙 수정·통합 우선

새 수정 요청이 있다고 CSS 파일 하단에 보정 규칙을 계속 추가하지 않는다.

피해야 할 구조:

```css
기존 규칙

/* fix */
같은 selector 재정의

/* mobile fix */
같은 selector 재정의

/* final */
같은 selector 재정의
```

수정 순서:

1. 기존 selector 위치 확인
2. 기존 선언 자체를 수정할 수 있는지 확인
3. 같은 목적의 중복 규칙이 있는지 확인
4. 새 규칙 적용 후 불필요해진 예전 workaround 제거

기본 원칙:

> **patch를 추가하기보다 현재 최종 규칙을 수정한다.**


## 4.9 동일 selector override 누적 금지

동일한 cascade context에서 같은 selector를 뒤에서 반복적으로 덮지 않는다.

예:

```css
.card {
  ...
}

/* 수백 줄 뒤 */

.card {
  ...
}
```

또한 같은 media context에서 동일 component를 여러 위치에서 반복 보정하지 않는다.

component별 CSS 책임 위치를 명확하게 유지한다.


## 4.10 `!important` 사용 정책

현재 메인 CSS의 실제 `!important` 선언은 **0개**이며, 이 상태는 정상 cascade/source order/token 구조로 동작하도록 검증된 현재 기준선이다. 과거 제거 차수와 개수는 Git 이력으로 관리하고 이 문서에는 누적하지 않는다.

현재 운영 원칙:

- 새로운 `!important`는 원칙적으로 추가하지 않는다.
- 단순 specificity 충돌은 canonical selector, source order, 구조 정리로 해결한다.
- `[hidden]`, semantic color, 모바일 view state, print override처럼 정상 cascade로 해결되는 상태를 유지한다.
- OS의 모션 감소·애니메이션 끄기 설정과 웹의 animation/transition/smooth scroll을 연동하지 않는다. production CSS/JS의 `prefers-reduced-motion` 도입은 회귀로 본다.
- 향후 Safari/WebKit 등 실제 브라우저 고유 문제로 강제 우선순위가 다시 필요해 보이더라도 먼저 실기기 재현과 정상 cascade 해결 가능성을 확인한다.

새 `!important`가 불가피하다고 판단되면 반드시:

1. 실제 재현되는 브라우저/상태 문제인지
2. 기존 canonical rule 수정으로 해결 가능한지
3. specificity/source-order 정리로 가능한지
4. 해당 선언만 강제해야 하는 이유가 명확한지

를 확인하고, 추가 이유와 영향 범위를 별도 보고한다.

**현재 0개는 유지보수 결과이지 그 자체가 별도의 목표값은 아니다.** 정상 동작을 깨면서 0개를 고집하지 않지만, 현재 검증된 0개 기준선에 불필요한 `!important`를 다시 추가하지 않는다.


## 4.11 디자인 토큰과 CSS variable 우선 재사용

이미 존재하는:

- color
- padding
- gap
- border-radius
- font-size
- control height
- positive / negative
- card spacing
- chart control size

등의 CSS variable과 design token을 우선 활용한다.

비슷한 값을 새로 하드코딩하거나 의미가 겹치는 변수를 다시 만들지 않는다.

공통화 완료 영역의 대표 source는 다음과 같다.

```text
Page / Section rhythm       → --page-* / --asset-band-section-gap
Surface padding / radius    → --surface-pad-* / --surface-radius-level-*
Card group gap              → --card-grid-gap-*
Title / Control             → --section-* / --dashboard-control-*
Metric / Mini / Data List   → component typography token + 공통 renderer
Table                       → --data-table-* + .dashboard-data-table
Chart                       → --chart-* + CHART_FRAME
Modal / Tooltip / Feedback  → --modal-* / --tooltip-* / --feedback-* / --status-*
Value meaning               → --value-positive / --value-negative
```

토큰을 사용했다는 이유만으로 완료로 보지 않는다. 같은 의미를 다른 이름으로 중복 생성하거나, 1회성 literal에 이름만 붙이거나, base가 이미 소유한 값을 viewport/하위 selector에서 다시 선언하지 않는다. Desktop baseline은 `common.css`, Tablet 차이는 `tablet.css`, 세로 Phone과 실제 터치폰 가로의 공통 density는 `special.css` Phone Shared, 세로 Phone 전용 배치는 `mobile.css`, Print reset은 `print.css`가 소유한다.



## 4.12 증권·퇴직연금 KPI 모바일 2열 규칙

증권·퇴직연금의 `성과 요약` 4개 KPI 카드는 모바일(`<=760px` 및 실제 스마트폰 가로모드)에서만 `2 × 2` grid를 유지한다. 다른 `.metric-grid`에는 이 규칙을 확대 적용하지 않는다.

모바일 KPI 타이포 기준:

```text
라벨 11px
값 18px
설명 11px
```

세 요소는 한 줄 유지한다. 모바일 전용 축약 설명이 필요한 경우 `metricCard()`의 mobile sub variant를 사용하고, 데스크톱/태블릿 설명을 CSS로 억지 축소하거나 ellipsis 처리하지 않는다.

## 4.13 Topbar 날짜 셀렉트 폭 정합성

Topbar의 `년/월`과 `일` 셀렉트는 같은 UI mode에서 동일폭을 유지한다. Desktop의 실제 기본폭과 Tablet/Phone에서의 shrink 값은 CSS가 Source of Truth다. Tablet에서는 기존 구간 안에서 날짜 그룹만 가용폭에 따라 두 셀렉트가 함께 줄고, 우측 action은 `auto` 열로 유지한다. 이 정합성 문제 때문에 새 breakpoint를 추가하지 않는다. Phone 세로/가로도 두 셀렉트가 같은 반응형 폭 체계를 사용한다.

## 4.14 본문 카드 공통 시스템

본문 카드는 **같은 hierarchy + 같은 viewport = 같은 geometry/spacing**을 유지한다. 카드 외곽 padding, 카드 간 gap, 카드 내부 rhythm은 서로 다른 책임으로 관리하며 개별 selector에 임의 숫자를 추가하지 않는다.

### Surface / Radius ownership

카드 padding은 아래 semantic token을 canonical로 사용한다. viewport별 실제 px 값은 CSS token이 Source of Truth이며 이 문서에 중복 기록하지 않는다.

```text
--surface-pad-outer
--surface-pad-large
--surface-pad-medium
--surface-pad-mini
--surface-pad-emphasis
--surface-pad-data-list
```

- Outer: `.pension-band`, `.securities-band`
- Large: `.card`, `.note`, `.chart-card`
- Medium: `.asset-insight-card`, `.source-card`
- Mini: `.mini-card`
- Data List: `.data-list-card`를 모바일 카드보기와 Market AI compact group이 공유하며 `--surface-pad-data-list`, level-3 radius alias, `--shadow-data-list-card`, `--data-list-row-separator` contract를 함께 사용한다. 별도 1회성 data-list radius token을 만들지 않는다.
- Metric은 `.card`의 Large surface padding을 그대로 재사용하며 별도 metric padding token을 두지 않는다. Emphasis 계열만 정보구조상 필요한 경우 `--surface-pad-emphasis`를 사용한다.
- base selector가 semantic token을 소유하고 Tablet/Phone에서는 **token 값만 변경**한다. 같은 padding을 responsive selector에 반복하지 않는다.

radius는 padding 분류와 별도로 화면상 같은 line/hierarchy를 기준으로 4단계 token을 사용한다.

| Radius level | Desktop·Tablet·Print | Phone·실제 터치폰 가로 | 대표 화면군 |
|---|---:|---:|---|
| `--surface-radius-level-1` | 18px | 16px | Hero, 연금+계좌 성과 표, 자산 workspace tab, 증권·퇴직연금 outer band |
| `--surface-radius-level-2` | 16px | 14px | 일반 card/note/chart, 성과 KPI·장부 KPI, 계좌별 성과표, source card |
| `--surface-radius-level-3` | 14px | 12px | mini/data-list/insight, 일반 현황표·변동표, 변동 KPI, 차트 하단 요약 |
| `--surface-radius-level-4` | 12px | 12px | tooltip, chart plot, modal error, inner compact control |

기존 의미 alias인 `--surface-radius-outer/large/medium/mini`는 위 level source에 연결한다. 특정 component가 명시적으로 level을 소유하면 alias 숫자를 다시 복제하지 않는다. Corner theme에서는 각 radius와 `--corner-surface-cap`의 최소값을 사용한다. 같은 visible line의 surface를 viewport별로 따로 키우거나, 4단계 중 일부만 Phone에서 줄이지 않는다.

### Card Grid Gap ownership

카드 그룹 간 gap은 아래 3단계 contract만 사용한다.

```text
--card-grid-gap-large
--card-grid-gap-medium
--card-grid-gap-compact
```

- Large: Metric / Asset Detail / Chart / Ledger / **투자원금 원천 및 검산 Source grid**
- Medium: Insight / Mobile Data grid
- Compact: Mini / Change KPI grid

열 수는 viewport별로 바꿀 수 있지만 같은 hierarchy의 gap을 개별 px로 다시 정의하지 않는다.

### Vertical Rhythm ownership

카드 내부 세로 간격은 surface padding이나 grid gap과 별도로 관리한다. 현재 공통 rhythm은 `--card-text-rhythm-gap`, `--info-stack-gap`, `--chart-content-rhythm-gap`과 각 component typography token이 소유한다.

- Metric label → value / value → sub
- Mini label → value / value → detail
- Info heading → content
- Chart title/content/legend/mini-card 사이의 공통 흐름

이 규칙을 수정할 때 font-size, grid 열 수, breakpoint, Topbar/Hero/table/chart/JS 로직을 한 차수에 함께 변경하지 않는다.

## 4.15 카드 확정 예외 / 완료 기준

카드 공통화는 현재 **완료 상태**로 간주한다. 실제 UI 문제나 신규 카드 유형이 없는 한 Surface / Radius / Grid Gap / Vertical Rhythm을 다시 세분화하거나 합치지 않는다.

확정 예외만 다음과 같이 유지한다.

- **Source**: Medium surface + Metric rhythm을 사용하고 `.source-card{min-width:0}`은 base property로 유지한다. value 아래 `source-table-scroll` 간격과 highlight는 별도 정보영역/상태이므로 공통 rhythm에 합치지 않는다.
- **Table summary separator**: 일반 viewport에서는 summary row 전체가 `border-top`을 사용하고, Phone sticky 첫 열에서만 border seam 방지를 위해 첫 cell의 `border-top`을 제거하고 inset shadow로 같은 의미선을 재현한다.
- **Ledger**: `.value{min-height:0}`, 근거 divider/padding, Tablet·실제 Phone Landscape의 2-column 및 내부 gap은 복합 정보구조 전용 예외로 유지한다.
- **Symbol**: `symbol-metrics` divider 뒤 padding, 내부 label/value layout, allocation detail baseline 보정은 Symbol 상세영역 예외로 유지한다. Mini와 같은 관계의 간격만 공통 rhythm을 사용한다.
- **Long content**: `.chart-note.six`의 숫자 `.m-value`는 한 줄 유지, 날짜가 포함될 수 있는 `.m-label`/`.m-detail`은 자연 줄바꿈을 허용한다. Phone KPI 2×2 및 기존 `<=400px` 계좌성과 table 예외도 유지한다.

base가 이미 소유한 속성을 하위/viewport selector에서 반복하지 않는다. 반대로 실제 정보구조가 다른 scoped rule은 숫자가 다르다는 이유만으로 제거하지 않는다. 사용되지 않는 class, 완전 중복 declaration, 반복된 base property만 cleanup 대상으로 본다.

# 5. JavaScript 구현 세부 규칙


## 5.1 Inline event handler 재도입 금지

메인 대시보드는 현재 동적 HTML의:

```html
onclick=""
onchange=""
oninput=""
onkeydown=""
```

의존성을 제거하고:

```html
data-dashboard-action="..."
```

기반 event delegation 구조를 사용한다.

새 UI를 추가할 때 inline event를 다시 만들지 않는다.

기존:

```text
data-dashboard-action
→ 중앙 event dispatcher
→ 기능 handler
```

구조를 우선 활용한다.


## 5.2 Event handler에 비즈니스 로직을 과도하게 넣지 않는다

피해야 할 구조:

```js
click handler {
  데이터 읽기
  계산 수십 줄
  DOM 생성
  API 저장
  전체 render
}
```

권장 흐름:

```text
event
→ handler
→ helper / calculation
→ state 변경
→ render
```

event handler는 가능한 한 연결 역할에 집중한다.


## 5.3 JavaScript에서 UI 스타일 직접 지정 최소화

JS에서:

```js
element.style.color = ...
element.style.padding = ...
element.style.fontSize = ...
```

또는 HTML 문자열 안의:

```html
style="..."
```

를 단순 시각 표현 목적으로 새로 늘리지 않는다.

색상, 여백, font, 정렬 등은 가능한 CSS class가 담당한다.

단, 다음처럼 runtime 계산이 반드시 필요한 경우는 예외다.

- chart 좌표
- tooltip 위치
- 동적 width/height
- SVG path
- CSS custom property 값


## 5.4 JS 중복 로직 추가 금지

새 함수를 만들기 전에 기존 helper가 있는지 확인한다.

스마트폰 responsive 판정은 main graph에서 `dashboard-ui-common.js`의 공통 helper를 canonical로 사용한다. `phoneLandscapeUi()`는 실제 터치 스마트폰 가로(`960×500 + hover:none + pointer:coarse`) 판정만 담당하고, `phoneUi()`는 `≤760px` 세로폰과 실제 터치폰 가로를 하나의 Phone UI family로 묶는다. UI/Charts 등 main feature의 Phone 표현 여부는 `phoneUi()`를 재사용하고, 각 feature에서 같은 `matchMedia` 문자열이나 동등 helper를 다시 정의하지 않는다.

단, main graph와 의도적으로 분리된 standalone `dashboard-market-ai.js`는 `dashboard-ui-common.js` dependency를 새로 만들지 않는다. Market AI는 동일한 Phone UI contract의 media query를 자체 소유할 수 있으며, 이 조건은 `special.css`의 Phone UI Shared 조건과 항상 동기화한다.

대표적인 공통 대상:

- 날짜 처리
- fetch
- formatter
- modal open/close
- tooltip
- chart option
- responsive sync
- swatch
- table cell
- positive / negative 처리
- data refresh

비슷한 로직을 각 파일에 복사하지 않는다.

## 5.5 JS Structure Map / 책임 주석

구조 정리 이후 9개 `dashboard-*.js`는 파일 상단 Structure Map과 본문의 번호 섹션을 **1:1로 대응**시킨다. 번호 자체를 changelog로 사용하지 않고, 실행 흐름과 ownership 탐색을 위한 구조 표지로만 사용한다. 기능 수정 시 코드와 주석 책임이 달라지면 같은 작업에서 Structure Map도 함께 정합화한다.

코드를 그대로 읽어주는 주석은 늘리지 않고 module ownership, 예외, lifecycle 경계처럼 코드만으로 바로 알기 어려운 이유를 설명한다.

# 6. 운영 데이터 · GitHub Actions · GAS

## 6.1 운영 JSON과 외부 write 보호

다음 운영 데이터는 코드 리팩토링 / UI 수정 과정에서 함부로 변경하지 않는다.

특히:

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
```

은 항상 주의한다.

또한 나머지 `data/*.json`도 요청과 직접 관련 없으면 수정하지 않는다.

장부·성과 계산에 쓰이는 실제 데이터성 값은 JS literal로 중복 보관하지 않는다. 현재 증권의 KODEX 레버리지 별도수익 거래 이력·재투입 한도·Report 기간/포지션 문맥은 `data/kodex_leverage_trades.json`을 source of truth로 사용하고 `dashboard-core.js`가 `portfolio.separateProfit` 표시용 구조를 런타임 파생한다. 6/18 확인 현금 기준값은 `constants.outsideCash`, 원천별 추적의 고정 원천값은 `securitiesSourceTracking`을 source of truth로 사용하며, `dashboard-core.js`/`dashboard-ui.js`는 이를 읽어 계산·표시한다.

주의:

- `prices.json`, `performance_snapshots.json`은 KRX 현재가 반영/워크플로우 때문에 정상적으로 바뀔 수 있다.
- 최신 KRX 반영분과 코드 patch를 섞을 때 단순 hash 차이를 코드 회귀로 오인하지 않는다.
- `pension_contributions.json`은 KRX 재갱신 대상이라고 가정하지 않는다.
- 실제 운영 데이터가 포함된 최신 기준본을 과거 코드 패키지로 덮어쓰기 전에 먼저 확인한다.

QA 중 실제 운영 write 금지:

```text
GAS pension save
GAS delete
batch apply
KRX GitHub workflow 실제 실행
운영 JSON update
```

필요하면 mock / stub으로 검증한다.


## 6.2 Google Apps Script(GAS) 운영 및 배포 원칙

Google Apps Script는 **GitHub 프로젝트와 별도로 운영되는 write 백엔드**다. 이 절에는 현재 운영 불변조건만 남기며, 버전별 패치 이력·점수·Counterexample 목록은 누적하지 않는다. 상세 평가 시나리오는 `dashboard_evaluation_guide.md`를 사용한다.

### 소스·배포·보안

- GAS 수정은 사용자가 별도로 제공한 **최신 운영 `code.js`**만 기준으로 한다. 과거 대화의 코드를 최신본으로 추정하지 않는다.
- 인증값·GitHub token·PIN은 Script Properties에만 두고 저장소·문서에 실제 값을 기록하지 않는다.
- 기존 Web App `/exec` URL 유지가 기본이며 새 URL을 쓰면 frontend endpoint도 함께 갱신한다.
- router action/target allowlist를 유지하고 unknown target을 다른 Pension target으로 fallback하지 않는다.
- QA는 mock/stub을 우선하며 실제 운영 JSON write/delete, Batch apply, KRX dispatch를 테스트 목적으로 실행하지 않는다.

### Pension mutation contract

- Single/Batch는 같은 `ScriptLock`과 `PENSION_MUTATION_EPOCH`을 공유한다. Git blob SHA는 causal version이 아니라 외부 변경 보조 guard다.
- frontend는 재시도 동안 stable request/logical identity와 **최초 전송 payload/precondition**을 재사용한다. cash는 `expectedVersion`/`expectedAbsent` optimistic concurrency를 사용하고 모든 금액·수량 계산은 safe integer 범위에서만 처리한다.
- 모든 cashSnapshot/contribution/etfTrade upsert/delete는 semantic operation ledger와 content-independent exact identity ledger를 사용한다. 실제 mutation commit은 target JSON과 필요한 ledger shard를 같은 Git commit으로 반영한다. terminal no-op 성공도 exact identity를 남긴다.
- 동일 semantic 후보가 보인다고 자동 중복 제거하지 않는다. 다른 기기/새 세션에서는 state-bound confirmation token으로 `existing/distinct`를 다시 검증하고, state가 바뀐 token은 stale로 거부한다.
- Batch 안에서 같은 target의 `logicalOperationId`는 고유해야 한다. 부분 충돌은 operation별 결정을 유지하고 candidate는 one-to-one으로 소진한다. commit-success/receipt-loss는 final-state effect와 durable identity로 duplicate에 수렴한다.
- 확정 pre-commit 실패는 dependency가 그대로일 때만 retryable tombstone으로 전환한다. dependency/epoch가 바뀐 과거 요청은 `stale_retry_ignored`로 끝내며 최신 state를 재사용해 부활시키지 않는다.

### Intent / receipt lifecycle

- active `PENSION_REQ_I_` / `PENSION_BATCH_I_` / `KRX_DISPATCH_I_`는 단순 TTL·prefix cap·global budget GC로 **그대로 삭제하지 않는다**.
- stale 판정이 끝난 Single/Batch intent는 terminal receipt로 승격한 뒤 active intent를 해제한다.
- 응답이 끊긴 abandoned intent는 **24시간**을 넘기면 fail-closed terminal receipt로 승격한다. prefix cap에 먼저 도달해도 가장 오래된 intent를 같은 방식으로 terminalize하여 causal evidence를 보존하면서 신규 요청 slot을 확보한다.
- receipt/confirmation/marker는 새 write 전에 cap 자리를 확보하고, 전체 Script Properties는 내부 byte budget 안에서 관리한다. terminal receipt write가 실패하면 기존 intent를 유지해 fail-open하지 않는다.

### KRX dispatch / GitHub Actions contract

- KRX는 requestId intent/receipt + branch/date operation marker + `data/krx_dispatch_ledger/<shard>.json` durable history를 사용한다. 동일 requestId의 재-dispatch는 금지한다.
- dispatch 접수 여부가 불확실한 requestId는 재시도 시 가능하면 durable ledger에 `dispatch_uncertain_terminal`을 기록하고 active intent를 해제한다. legacy intent처럼 raw requestId가 없더라도 direct-property hash suffix를 같은 receipt key로 승격할 수 있어야 한다. durable 기록이 실패하면 intent를 유지한다.
- `workflow_run_id`가 있으면 직접 상태를 조회하고, fallback은 active runs를 pagination한다. 상태 조회 자체가 실패하면 새 dispatch를 보내지 않는다.
- workflow는 같은 branch의 pending queue를 보존하고, checkout 이후 remote 변경이 계산과 무관할 때만 rebase한다. managed output 또는 generation input이 바뀌면 fail-closed한다.
- push 응답 유실은 직전 `PUSH_SHA`가 이미 `origin/<branch>`에 포함됐는지 managed-file guard보다 먼저 확인하고, 마지막 실패 확정 전에도 재확인한다.

### QA 경계

GAS 집중평가의 구체적인 stale retry, cross-device duplicate, Batch cardinality, receipt/intent loss, GitHub race 반례는 `dashboard_evaluation_guide.md`의 Frontend↔Backend contract와 100점 Gate를 따른다. 이 handover에는 **현재 운영 contract와 수정 위치 판단에 필요한 내용만** 유지한다.

## 6.3 현재 Workflow 날짜 입력 의미

현재 `.github/workflows/update-prices.yml`의 실제 설명은 다음 의미와 일치한다.

```text
날짜 지정
→ 실제 KRX 거래일인지 확인한 뒤 해당 거래일의 종목 가격·성과 스냅샷 갱신
→ 지정일까지 이미 저장된 날짜의 KOSPI 값은 누락·정정 여부를 확인해 backfill 가능
→ 비거래일 또는 종가 확인 불가 날짜면 선택일 종목 갱신은 저장하지 않고 실패 처리

날짜 비움
→ 최신·누락·장중 재확정 대상 날짜를 Python이 자동 판단
→ 한국시간 오늘까지 저장된 KOSPI 구간의 backfill도 함께 확인
```

`비워두면 한국시간 오늘`이라는 과거 설명으로 되돌리지 않는다.

Python / Workflow 유지보수 구조:

- `scripts/update_prices.py`는 `설정·공통 helper → 시장 데이터 조회 → 대상일 판단 → 포트폴리오 계산 → 저장/CLI` 순서의 섹션 구조를 유지한다.
- 반복되는 날짜 형식, 조회 재시도, HTTP timeout/User-Agent 같은 실행 설정은 상수로 관리하고 함수 안에 같은 magic value를 중복하지 않는다.
- `.github/workflows/update-prices.yml`은 `trigger → permission → runtime setup → updater 실행 → 생성 데이터 검증 → commit` 흐름을 유지한다. 각 `run: |` step은 GitHub Actions에서 서로 독립된 shell script이므로 `if/else/fi` 같은 shell 제어문은 반드시 같은 step 안에서 완결해야 한다. `tests/main-ui-contract.test.cjs`가 updater step의 `fi` 누락과 다음 verify step의 stray `fi` 회귀를 자동 차단한다.
- Workflow가 자동 commit하는 운영 데이터는 `data/prices.json`, `data/performance_snapshots.json` 두 파일로 한정하며 다른 운영 JSON을 함께 `git add`하지 않는다.


### Python dependency 재현성

`requirements.txt`의 직접 dependency는 호환 확인된 버전으로 pin한다. 현재 기준은 `pykrx==1.2.8`, `pandas==2.3.3`, `requests==2.34.2`다. `pykrx`를 다시 올릴 때는 Python 3.11 지원 여부와 `scripts/update_prices.py`가 사용하는 종목/지수 OHLCV API의 호환성을 먼저 확인한다. 하위 transitive dependency까지 `pip freeze` 전체를 저장하는 방식은 기본 운영으로 사용하지 않는다.

# 7. Main 수정 · QA · Diff · 결과 전달

## 7.1 실행 모드

| 사용자 요청 | Main 문서에서의 처리 |
|---|---|
| `인수인계` | 구조·contract 확인, 파일 수정 안 함 |
| 구체적 수정 요청 / `1차`, `2차` | 요청 범위 실제 반영 후 영향 범위 QA |
| `QA` | 직전 Main 변경분과 연결부 중심 검증 |
| `전체 QA` | 사용자가 명시한 경우 전체 프로젝트 테스트까지 수행 |
| `평가`, `점수` | `dashboard_evaluation_guide.md` 기준으로 전환 |

`QA`를 임의로 `전체 QA`로 확대하지 않는다. 다만 Main의 전역 appearance/Corner/breakpoint 같은 공통 contract를 수정한 경우에는 직전 변경 QA에서도 `cross-ui-contract.test.cjs`를 함께 확인한다.

## 7.2 Main 수정 기본 순서

```text
최신 실제 소스 확인
→ 이 문서와 관련 소스 확인
→ 책임 파일/영향 범위 특정
→ 최소 수정
→ syntax/import/계산 확인
→ Main 관련 Fast QA
→ 공통 contract 변경 시 Cross QA
→ diff 확인
→ 필요한 runtime/실기 QA 범위 판단
→ 장기 contract가 바뀐 경우에만 문서 갱신
→ 변경 파일만 결과물로 전달
```

요청 범위와 무관한 리팩토링을 섞지 않는다. 현재 요청을 안전하게 구현하기 위해 공통 수정이 반드시 필요한 경우에는 이유와 영향 범위를 명확히 한다.

## 7.3 Main 자동 회귀 테스트

Main 유지보수의 직접 테스트는 다음 두 개다.

```text
tests/main-calc.test.cjs
tests/main-ui-contract.test.cjs
```

공통 전역 계약을 변경한 경우:

```text
tests/cross-ui-contract.test.cjs
```

역할:

- `main-calc.test.cjs`: 원금·합산·손익·수익률·별도수익·연금·차트용 계산 등 정답이 명확한 계산 contract 보호
- `main-ui-contract.test.cjs`: ES Module boundary, breakpoint, Phone Landscape, table/chart/modal/Market AI 등 Main UI/CSS/HTML의 장기 contract 보호
- `cross-ui-contract.test.cjs`: Main↔Add가 반드시 같아야 하는 appearance storage/channel, Corner cap, 기본 breakpoint·Phone Landscape, iPhone desktop-request 1280 contract 보호

테스트는 개발/QA 안전망이며 production page가 runtime에서 import하는 코드가 아니다. `main-ui-contract.test.cjs`와 Cross UI contract는 모든 미세 px 값을 무차별 고정하지 않고, **장기적으로 깨지면 안 되는 구조·반응형·상태·접근성 contract**를 우선 보호한다. 의도된 contract 자체가 변경되는 경우에만 실제 구현·handover·관련 테스트를 함께 정합화한다.

Fast QA 예:

```bash
node --test tests/main-calc.test.cjs
node --test tests/main-ui-contract.test.cjs
```

공통 contract 변경 시:

```bash
node --test tests/cross-ui-contract.test.cjs
```

사용자가 Main+Add `전체 QA`를 명시한 경우에만 repository의 전체 테스트를 실행한다.

```bash
node --test tests/*.test.cjs
```

Add 테스트의 상세 의미와 실패 처리 기준은 `add_maintenance_handover.md`가 소유한다.

## 7.4 변경 유형별 최소 검사

### 공통

- syntax 오류
- import/export 누락
- circular dependency
- 로컬 경로·ID·필수 DOM 참조 파손
- 의도하지 않은 CSS cascade/breakpoint 변화
- listener 중복 등록
- 요청하지 않은 운영 데이터 변경
- 예상 외 대규모 포맷 diff

### UI / CSS

대표 확인 viewport:

```text
Desktop: 1440 / 필요 시 1280
Tablet: 1024 또는 900
Phone: 390 / 필요 시 374
```

기본 breakpoint는 3장의 contract를 따르고, `special.css`의 기능 예외가 아닌 특정 스크린샷 전용 breakpoint를 새로 만들지 않는다.

### JavaScript 구조

최소 확인:

```text
node --check
import target 존재
named export 존재
circular dependency 0
main boot 1회
listener 중복 0
```

파일 분리는 줄 수가 아니라 책임·state ownership·dependency 방향으로 판단한다.

### Main 계산

`dashboard-core.js` 등 계산 책임을 변경했으면 `main-calc.test.cjs`를 우선 실행한다. 테스트 전용 계산식을 별도로 복제하지 않는다. 실제 요구사항 때문에 계산 contract가 바뀐 경우에만 기대값을 함께 갱신한다.

### 공통 token/helper

공통 helper, shared renderer, token을 수정하면 단일 화면만 보고 끝내지 않는다. 그 코드를 사용하는 대표 화면을 함께 확인한다. 반대로 단순히 비슷해 보인다는 이유로 독립 영역을 강제 공통화하지 않는다.

## 7.5 QA runtime 원칙

수정 직후 QA의 대상은 **현재 수정본 자체**다. GitHub Pages 공개본은 같은 revision이라는 보장이 없으므로 QA PASS/FAIL 근거로 사용하지 않는다.

현재 revision을 브라우저에서 실행할 수 없으면 가능한 검증을 끝까지 수행하고 실행하지 못한 항목을 `미실시` 또는 `검증 불가`로 표시한다. 실행하지 못한 검사를 PASS라고 쓰지 않는다.

자동 브라우저 캡처는 이 프로젝트에서 반복적으로 실패했으므로 기본 QA 절차에서 제외한다. 화면 미감과 실제 기기 동작은 사용자의 실기 QA를 우선하고, 자동 캡처는 별도 요청이 있을 때만 시도한다.

공개 배포 상태를 확인해 달라는 요청은 `QA`와 분리해 **배포본 확인**으로 취급한다.

## 7.6 QA FAIL 처리

```text
FAIL 원인 특정
→ 직전 변경과 인과 확인
→ 실제 회귀인지 낡은/과도한 테스트인지 구분
→ 최소 수정
→ 실패 항목 재검증
→ 연결된 대표 회귀 재검증
```

테스트 FAIL이라는 이유만으로 운영 코드를 무조건 바꾸지 않는다. 반대로 실제 계산·기능·UI contract 결함이면 테스트를 우회해서 PASS 처리하지 않는다.

## 7.7 누적 기준본과 baseline parity

여러 차수 작업은 직전 PASS본을 다음 차수의 기준으로 사용한다.

```text
기준본
→ 1차 수정
→ QA
→ 1차 PASS본
→ 2차 수정
→ QA
```

상태 전환, responsive, table, modal, chart 등 반복 회귀가 있었던 영역은 관련 수정 시 baseline과 함께 확인한다.

대표 smoke check:

- 상태 ON/OFF·tab 전환 후 layout/state 보존
- table summary/sticky/scroll/semantic alignment
- modal focus/ESC/save·delete flow
- chart selection/tooltip/resize/listener 중복
- breakpoint 전환 시 Phone/Tablet/Desktop 역할

## 7.8 Diff 검사

전달 전 최소 확인:

```text
의도한 파일만 변경됐는가
요청하지 않은 데이터가 바뀌지 않았는가
최근 수정이 롤백되지 않았는가
dead code / 중복 rule이 새로 생기지 않았는가
단순 rename이 기능값을 바꾸지 않았는가
포맷팅만으로 대규모 diff가 생기지 않았는가
```

다음 운영 JSON은 특히 요청 없이 덮어쓰지 않는다.

```text
data/prices.json
data/performance_snapshots.json
data/kodex_leverage_trades.json
data/pension_contributions.json
data/pension_cash_snapshots.json
data/pension_trades.json
```

## 7.9 CSS / JS 수정 보고

CSS를 수정했으면 필요 범위에서 다음을 확인·보고한다.

- 수정 전/후 줄 수·파일 크기
- 새 breakpoint 여부
- `!important` 증감
- 예상 외 diff
- 주석만 수정한 경우 rule/property/value 불변 여부

JS를 수정했으면:

- syntax
- import/export
- dependency 방향
- top-level side effect
- listener 중복
- boot 횟수
- 예상 외 diff

를 확인한다.

## 7.10 결과 파일 전달

기본은 **실제로 변경된 파일만 원래 폴더 구조를 유지해 ZIP으로 전달**한다. 전체 프로젝트 ZIP은 사용자가 명시적으로 요청한 경우에만 만든다.

여러 차수 작업의 마지막 QA가 끝나면 해당 작업 묶음의 1차부터 최종 차수까지 실제로 수정된 파일의 최종본을 누적해 한 ZIP으로 전달한다.

결과 보고에는 필요 범위에서 다음을 포함한다.

- 변경 내용
- QA 결과
- 변경 파일 목록
- 예상 외 diff 여부
- CSS 통계가 필요한 경우 해당 통계
- GitHub commit용 `Summary` / `Description`

# 8. Main ↔ Add 공통 contract

Main과 Add는 독립 영역이며 외형이 비슷하다는 이유로 CSS/JS를 강제 통합하지 않는다. 다만 실제 공동 책임이 있는 다음 계약은 양쪽이 일치해야 한다.

## 8.1 공유하는 계약

- Light/Dark 및 Corner appearance storage/channel contract
- 기본 Desktop / Tablet / Phone breakpoint 의미
- 실제 Phone Landscape 판정 의미
- iPhone Safari desktop-request `1280px` contract
- `img/favicon.png` canonical favicon
- `js/kodex-leverage-schema.js` KODEX 거래 schema validator
- `data/kodex_leverage_trades.json`을 단일 원천으로 사용

Main은 KODEX canonical JSON에서 필요한 `separateProfit` 표시 구조를 런타임 파생한다. `pnl - fee`와 날짜순 누적 별도수익은 개별 원천값이 안전 정수여도 파생 결과가 JavaScript 안전 정수 범위를 넘으면 즉시 중단해야 하며, Add Report와 같은 원천에 대해 서로 다른 정밀도 정책을 가져서는 안 된다. Add Report의 거래 집계·분류·산식 상세는 `add_maintenance_handover.md`가 소유한다. Main 문서에 거래 수치나 Add 계산식을 복제하지 않는다.

## 8.2 Cross QA

위 공통 계약을 수정하면 다음을 실행한다.

```bash
node --test tests/cross-ui-contract.test.cjs
```

한쪽의 편의를 위해 공통 contract를 조용히 바꾸지 않는다. 공통 contract 자체가 변경되는 요구라면 Main/Add 문서와 관련 테스트를 함께 정합화한다.

# 9. Legacy guard · 문서 유지관리

## 9.1 다시 도입하지 않는 폐기 구조

현재 구조를 단순화한다는 이유로 다음 과거 구조를 복원하지 않는다.

- `css/style.css` 단일 대형 CSS
- 별도 `css/desktop.css`
- classic script 다중 load 기반의 main boot
- `window/globalThis` compatibility bridge
- pension View/Editor 재결합
- Main feature state와 Market AI standalone state 결합
- root `favicon.png` 복제본
- Add 코드/산식을 Main handover에 중복 기록

## 9.2 과거 리팩토링 이력의 취급

1~13차 같은 과거 작업 차수와 세부 selector 변화는 Git history에서 확인한다. 이 문서는 현재 완료 상태와 장기 계약만 유지한다.

과거 변경 이유 중 현재도 필요한 내용은 "왜 이 contract를 유지해야 하는가" 형태로 해당 현재 규칙 옆에 남긴다. 단순 작업일지나 과거 점수·줄 수는 누적하지 않는다.

## 9.3 문서 역할 재확인

- [README.md](./README.md): 프로젝트 설명, 기능, 전체 구조, 실행·배포 개요
- [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md): Main 수정·QA·운영 contract와 Main↔Add 공통 contract 정의
- [add_maintenance_handover.md](./add_maintenance_handover.md): Add Calc/Report 수정·QA·운영 contract
- [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md): Main/Add 평가·점수·등급 기준 및 adversarial Counterexample 기준(구현 설명·패치 이력은 중복 저장하지 않음)
- Git history: 과거 변경 이력

# 10. 최종 운영 체크리스트

## 10.1 작업 시작 전

```text
[ ] 최신 실제 소스를 직접 확인했는가
[ ] Main 작업인데 Add 상세 문서를 불필요하게 선행해서 읽고 있지 않은가
[ ] 실제 책임 파일과 dependency를 확인했는가
[ ] 과거 코드 기억을 최신본으로 가정하지 않았는가
[ ] 현재 ES Module ownership을 유지하는가
[ ] Market AI 변경이라면 standalone 경계를 유지하는가
[ ] 기존 canonical CSS rule/token을 먼저 찾았는가
[ ] 새 breakpoint가 실제 기능상 필요한가
[ ] Phone 판정 helper/contract를 중복 정의하지 않는가
[ ] inline event/global bridge를 만들지 않는가
[ ] 운영 JSON을 불필요하게 건드리지 않는가
```

## 10.2 수정 후

```text
[ ] diff가 요청 범위에 한정되는가
[ ] syntax/import/circular dependency를 확인했는가
[ ] 변경 유형에 맞는 Main Fast QA를 실행했는가
[ ] 공통 appearance/breakpoint contract를 바꿨다면 Cross QA를 실행했는가
[ ] 테스트 FAIL이 실제 회귀인지 낡은 contract인지 구분했는가
[ ] GitHub Pages를 수정 QA의 PASS/FAIL 근거로 쓰지 않았는가
[ ] current revision runtime을 실행하지 못한 항목을 PASS로 가장하지 않았는가
[ ] 운영 write를 QA 중 실제 실행하지 않았는가
[ ] 변경 파일만 결과물에 포함했는가
[ ] 장기 contract가 실제로 바뀐 경우에만 이 문서를 갱신했는가
```

## 10.3 구조 보존 원칙

새 기능은 먼저 현재 구조 안에서 자연스럽게 구현 가능한지 판단한다.

```text
책임 owner 확인
→ 기존 helper/token 재사용 가능 여부
→ state owner 확인
→ responsive 영향
→ 운영 데이터 contract 영향
→ 필요한 QA 범위
→ 최소 구현
```

기능 구현과 현재 리팩토링 구조 보존은 동등하게 중요하다. 다만 구조 보호를 이유로 사용자의 명시적 요구를 무시하지 않는다. 요구 목적을 유지하면서 현재 책임 경계를 덜 훼손하는 방법이 있으면 그 방법을 우선한다.

사용자 요청이 현재 canonical contract와 직접 충돌하거나 운영 데이터 훼손 위험을 만들면 조용히 강행하지 않는다. 최신 실제 소스를 기준으로 충돌 지점을 확인하고, **요청 목적을 최대한 유지하면서 contract와 운영 데이터를 보호하는 안전한 구현 방향**으로 처리하며 필요한 차이는 결과에 명확히 적는다.

모든 Main 작업의 운영 원칙은 다음 한 문장으로 요약한다.

> **최신 실제 소스를 기준으로 현재 책임 경계 안에서 최소 수정하고, 검증 범위는 변경 위험에 비례시키며, 장기 contract만 문서에 남긴다.**
