# add 영역 유지보수 및 거래 리포트 인수인계

> **문서 성격 / 대상 환경**  
> 이 문서는 GitHub Pages의 `add/` 정적 화면인 **Calc + KODEX 레버리지 Report 개발·유지보수용 contract**다. 운영자용 프로젝트 소개는 `README.md`, Main의 공통 규칙은 `main_dashboard_maintenance_handover.md`, 평가·점수 기준은 `dashboard_evaluation_guide.md`가 담당한다.  
> 현재 canonical runtime은 `add.css` + `add.js` 공유 구조이며, 실제 파일이 분리되지 않은 상태에서 문서만 미래 구조로 선행 변경하지 않는다.

## 0. 문서 목적 · 범위 · Source of Truth

이 문서는 `add/` 영역의 **CALC + KODEX 레버리지 거래 리포트**를 현재 canonical 구조 그대로 유지하기 위한 인수인계·수정·QA 기준서다.

적용 범위는 다음과 같다.

- `add/calc.html`
- `add/kodex-leverage-report.html`
- `add/add.css`
- `add/add.js`
- `js/kodex-leverage-schema.js`
- `data/kodex_leverage_trades.json`
- `img/favicon.png`
- `img/ui-icons.svg`
- 관련 `tests/*.test.cjs`

문서별 책임은 다음처럼 분리한다.

- **실제 현재 구현 상태**: 사용자가 제공한 최신 실제 HTML/CSS/JS/data와 관련 테스트가 Source of Truth다.
- **Add 유지보수 contract**: 이 문서가 Source of Truth다.
- **Main 유지보수 contract**: [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md)가 Source of Truth다.
- **Main↔Add 공통 contract**: canonical 정의는 [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md)의 8장을 따르고, Add 적용 규칙은 이 문서에 기록한다. 실행 정합성은 `tests/cross-ui-contract.test.cjs`로 검증한다.
- **평가·점수·A/B/C·감점 기준**: [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md)가 Source of Truth다.
- **프로젝트 소개·전체 저장소 개요**: [README.md](./README.md)가 담당한다.
- **과거 변경 이력**: Git history를 사용하며 이 문서에 차수별 작업일지를 누적하지 않는다.
- **GitHub Pages 공통 배포 경계**: 루트 `_config.yml`이 `data/krx_dispatch_ledger/`, `data/pension_operation_identity/`, `data/pension_operation_ledger/`, `data/pension_batch_request_identity/`를 Pages 산출물에서 제외한다. Add는 이 repository-only shard들에 runtime 의존성을 만들지 않으며, 상세 contract는 Main handover와 README를 따른다.

사용자의 이번 작업 지시와 최신 실제 소스가 가장 우선한다. 과거 대화의 수치나 과거 ZIP을 최신값으로 추정하지 않는다.

### 0.1 현재 canonical 파일과 책임

현재 Add 영역은 아래 구조를 기준으로 유지한다.

```text
add/
├─ calc.html
├─ kodex-leverage-report.html
├─ add.css
└─ add.js

add_maintenance_handover.md

tests/
├─ add-calc.test.cjs
├─ add-report-data.test.cjs
├─ add-ui-contract.test.cjs
└─ cross-ui-contract.test.cjs

img/
├─ favicon.png   # Main·Calc·Report 공통 favicon
└─ ui-icons.svg  # Main·Add 공통 정보 아이콘 sprite
```

역할은 다음과 같다.

- `add/calc.html`
  - CALC DOM과 접근성 구조만 소유한다.
  - 페이지 stylesheet/script는 `add.css`와 `add.js`만 로드하고, 공통 favicon은 `../img/favicon.png`을 참조한다.
  - 기능 로직이나 대량 스타일을 HTML 안으로 다시 넣지 않는다.
- `add/kodex-leverage-report.html`
  - 거래 리포트 canonical HTML과 증빙/본문 DOM을 소유한다. Timeline은 렌더 대상 shell만 소유하고 실현거래 숫자를 HTML에 중복 하드코딩하지 않는다.
  - 페이지 stylesheet/script는 Calc와 동일하게 `add.css`와 `add.js`만 로드하고, 공통 favicon은 `../img/favicon.png`을 참조한다. CSS/JS를 다시 HTML 내부 대량 `<style>` / 기능 `<script>`로 되돌리지 않는다.
- `add/add.css`
  - Calc와 Report의 단일 런타임 stylesheet다.
  - 공통 의미색·Corner·Spacing/Density·Heading·Button·Card Surface primitive를 먼저 정의하고, Calc/Report 전용 규칙은 `data-add-page` scope로 서로 격리한다.
  - Calc의 Compact 스타일과 Report의 Dynamic 시각 언어는 별도 override가 아니라 각 페이지 canonical 규칙 안에서 직접 관리한다.
  - 페이지 scope는 `:where()`를 사용해 기존 selector specificity를 바꾸지 않는다.
- `add/add.js`
  - Calc와 Report의 단일 런타임 script다.
  - 공통 조기 Light/Dark·Corner 처리를 수행한 뒤 `data-add-page="calc|report"`에 따라 해당 페이지의 boot만 실행한다.
  - Calc 계산·렌더·프리셋·이벤트·툴팁과 Report 데이터·탭·차트·Timeline 파생 로직은 한 파일 안에서도 section/boot 경계를 유지하고 서로의 DOM/state를 참조하지 않는다. Report는 `data/kodex_leverage_trades.json`을 로드한 뒤 DOM-free `deriveReportModel()` 계층에서 집계·본 포지션/단타 분리를 먼저 계산하고, browser 쪽은 Timeline builder·DOM renderer·navigation controller·chart controller로 책임을 나눈 뒤 `bootReportPage()`가 조립만 담당한다.
  - Report Timeline의 실현거래 수량·단가·손익·비용뿐 아니라 매도실현 데이터에 없는 매수-only 포지션 형성 문맥도 `data/kodex_leverage_trades.json`의 `positionContext`를 Source of Truth로 사용한다. 새 canonical 거래 행은 curated 설명이 없어도 Timeline에 기본 항목으로 자동 노출되어야 한다.
  - Report의 손익 의미색은 HTML에 양수 클래스를 고정하지 않고 현재 파생값에서 매 렌더마다 `pos`/`neg`를 다시 결정한다. `수익 구성` 도넛은 본 포지션·단타 순손익이 모두 0 이상이고 합계가 양수일 때만 비중을 표시하며, 손익 상쇄·순손실·0원 상태에서는 구성비를 만들지 않고 상태 문구를 표시한다.
  - Node 회귀검증에서는 Calc의 `compute`/`validate`/`ceil5`와 Report의 `deriveProfitComposition`/`deriveReportModel` 계층을 노출하되 브라우저 boot는 실행하지 않는다. canonical 거래 원천은 테스트가 JSON을 직접 읽는다.
- `tests/add-calc.test.cjs`
  - Node 내장 `node:test` / `node:assert`만 사용한다.
  - production `add/add.js`의 계산 함수를 직접 호출하며 계산식을 테스트 파일에 복사하지 않는다.
- `tests/add-report-data.test.cjs`
  - `data/kodex_leverage_trades.json`을 canonical 거래 원천으로 직접 읽고 production 공통 `js/kodex-leverage-schema.js` validator와 Report 순수 파생모델을 호출해 형식·전체/본 포지션/단타 합계·표시기간 보존과 수익 구성의 손익 상쇄·순손실·0원 경계를 검증한다. 개별 거래값이 안전 정수여도 누적 합계나 혼합일 전체-Core 차감 결과가 JavaScript 안전 정수 범위를 넘으면 Report 파생 단계에서 즉시 차단되는 반례도 함께 검증한다. Main과 Add Report가 별도 validator를 다시 만들지 않는다.
  - Main의 `deriveSeparateProfitFromKodexReport()`와 Report가 같은 canonical JSON을 소비하는지, 날짜별 순손익·누적합계·재투입 한도·표시기간·혼합일/근거 설명·`positionContext`가 동일 원천에서 파생되는지 자동 검증한다. `portfolio.json`이나 `add.js`에 거래/포지션 문맥 복제본이 다시 생기는 것도 금지한다.
- `tests/add-ui-contract.test.cjs`
  - 외부 DOM/test framework 없이 Node 내장 기능만 사용한다.
  - production HTML/CSS/JS에서 구조·상태·responsive·접근성·single-source contract를 확인하며, 장식용 exact pixel/color/count를 snapshot처럼 고정하지 않는다.
- `tests/cross-ui-contract.test.cjs`
  - Main/Add runtime을 서로 import시키지 않고 production source를 직접 읽어 suite-wide equality만 검증한다.
  - appearance storage/channel, Corner cap, 기본 breakpoint·Phone Landscape, iPhone desktop 1280처럼 두 영역이 반드시 같이 움직여야 하는 contract만 포함한다.

### 0.2 문서 운영 원칙

이 문서는 changelog가 아니라 **현재 유효한 Add 유지보수 contract**만 남긴다.

- `add/`의 코드·UI·데이터 파일을 수정했다는 이유만으로 이 문서를 자동 수정하지 않는다.
- 계산식·검산 기준·데이터 contract, Calc/Report 책임 경계, 공통 구조 원칙, 반복 회귀 방지 규칙처럼 **장기 유지보수 기준이 실제로 바뀐 경우에만** 기존 항목을 수정·통합한다.
- 단순 UI 정렬·여백·크기·색상, 특정 거래 1건의 현재 숫자, 단발성 버그 수정 이력, QA 통과 기록은 원칙적으로 추가하지 않는다.
- 현재 CSS/HTML/JS를 보면 바로 확인할 수 있는 구현 세부를 문서에 다시 복제하지 않는다.
- 평가 기준은 이 문서에 추가하지 않고 `dashboard_evaluation_guide.md`에서 관리한다.
- Main에 이미 정의된 공통 contract를 장문으로 복제하지 않는다. Add에 필요한 영향과 준수 규칙만 기록한다.
- 기존 규칙과 같은 목적이면 새 항목을 누적하지 말고 기존 문장을 수정·통합·삭제한다.
- 코드 변경으로 기존 문구가 더 이상 유효하지 않으면 새 규칙을 덧붙이기보다 해당 문구를 바로잡거나 제거한다.

> **핵심: Add handover는 “현재 어떻게 유지보수해야 하는가”만 소유한다. 평가와 프로젝트 소개, 과거 이력은 별도 문서가 담당한다.**

## 1. 작업 시작과 공통 contract

Add 작업은 Main handover를 선행해서 전부 읽지 않는다. 작업 대상에 따라 다음 순서로 확인한다.

```text
1. add_maintenance_handover.md
   - Calc/Report 계산·UI·데이터·QA contract 확인

2. 최신 실제 관련 소스
   - Calc: add/calc.html, add/add.css, add/add.js
   - Report: add/kodex-leverage-report.html, add/add.css, add/add.js
   - 거래 원천: data/kodex_leverage_trades.json
   - 공통 validator: js/kodex-leverage-schema.js

3. 사용자가 이번 작업에 제공한 최신 증권사 원본 자료
   - 거래·실현손익 반영 작업일 때 확인

4. 필요한 경우에만 다른 기준서 확인
   - Main↔Add appearance/Corner/breakpoint 등 공통 contract 변경:
     [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md)
   - 평가 요청:
     [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md)
```

사용자가 별도 요청을 주면 그 요청을 가장 우선한다. Add 단독 수정인데 Main handover 전체를 선행 분석 대상으로 삼지 않는다.

### 1.1 add 영역 Responsive viewport 기준

`calc`와 거래 `report`는 메인 대시보드와 동일한 3구간을 기본으로 사용한다.

```text
Desktop · 웹      ≥ 1101px
Tablet · 태블릿   761px ~ 1100px
Mobile · 모바일   ≤ 760px
```

- 사용자가 별도로 요청하지 않는 한 add 전용 미관용 breakpoint를 추가하지 않는다.
- 좁은 화면 대응은 새 breakpoint보다 grid/flex/overflow/`clamp()` 같은 component 자체의 유동 규칙을 우선한다.
- 공통 범위 media는 위 경계값을 공유하는 범위에서 허용한다.
- **Calc의 실제 터치 스마트폰 가로화면은 예외적으로 Tablet이 아니라 Phone UI로 분류한다.** 메인 `special.css`와 동일하게 `landscape + width≤960px + height≤500px + hover:none + pointer:coarse` 조건을 사용하며, 이 조건은 미관용 추가 breakpoint가 아니라 장치 분류 contract다.
- 위 가로폰 조건에서는 세로폰과 동일한 Phone typography·density·control/input 배치·mobile/desktop 표시 규칙을 다시 적용한다. 폭이 761px 이상이라는 이유만으로 Tablet UI로 바꾸지 않는다.
- **Calc와 Report에서 iPhone의 ‘데스크탑 웹사이트 요청’으로 감지되는 경우에는 viewport를 1280px로 전환한다.** Calc는 `calc.html`의 조기 head script, Report는 `add.js`의 page boot 전 preflight가 담당한다. 일반 모바일/가로폰 Phone UI 판정과 별개의 명시적 사용 모드이며, 이 보정을 임의로 제거하거나 3구간 breakpoint 값으로 대체하지 않는다.

### 1.2 add 영역 UI 공통 구성 원칙

#### 1.2.1 공통 외형·페이지 구조

- `calc`와 `report`는 `add/add.css`의 공통 의미색·Corner·Spacing/Density·Heading·Button·Card/Table primitive를 재사용한다.
- 현재 색상·여백·폰트·radius 수치는 CSS를 Source of Truth로 보고 이 문서에 중복 고정하지 않는다. 단, **Light 손익 의미색 `--positive:#EF3341`, `--negative:#3182F6`은 사용자가 시각적으로 확정한 design-locked canonical 값**이므로 예외적으로 이 contract에 명시한다. 일반 텍스트 대비 수치만을 이유로 색을 더 진하게 보정하지 않으며, 사용자의 명시적 재지시 없이 변경하지 않는다.
- Main의 Light/Dark·모서리 선택은 동일 저장 key와 appearance 동기화 경로를 통해 Calc와 Report 모두에 반영한다. Report Canvas 차트는 appearance 변경 시 현재 CSS chart palette를 다시 읽어 즉시 재렌더한다. Calc가 공통 Corner 역할값을 별도 값으로 다시 덮지 않는다.
- **Add는 선택형 대체 디자인이 없는 단일 canonical 스타일 구조다.** Calc는 Compact 정보 밀도, Report는 Dynamic 시각 언어를 각 `data-add-page` scope가 직접 소유하며 별도 theme/alt stylesheet·runtime을 다시 만들지 않는다.
- Report의 Hero/KPI처럼 Tablet/Phone에서 순서·span이 달라지는 요소는 DOM 순번 `nth-child`가 아니라 semantic role class로 관리한다. Timeline 교차색·hamburger bar처럼 순번 자체가 표현 의미인 구조적 `nth-child`는 예외로 허용한다.
- `add-card-shadow`는 해당 카드의 최종 shadow가 공통 `--shadow`일 때만 조합한다. Report처럼 feature가 자체 depth를 소유하거나 shadow를 제거하는 카드에 공통 shadow class를 붙인 뒤 다시 override하지 않는다.

#### 1.2.2 Responsive·장치 분류

- Responsive는 1.1의 장치 분류 contract를 따른다. 터치폰 가로 판정은 특수 Tablet 규칙보다 우선한다.
- Calc의 `보유 중 추가매수`·`이전 거래 후 재매수`는 큰 Tablet 이상에서 3열을 유지한다. 실제 내용 충돌이 생기는 `761~920px`에서만 앞의 두 카드 + 다음 행 전체폭 `계산 기준`의 2+1 구조를 사용한다.
- `이전 거래 없음`은 Tablet에서 2열을 유지하고 Phone에서만 1열로 내려간다.

#### 1.2.3 Typography·Field/Control

- Calc typography는 위치가 아니라 의미 역할별 공통 token을 사용한다. 페이지/section/content 제목, 버튼, 일반 data label/value, 보조 설명, 강조 value, micro 정보는 역할을 기준으로 font-size source를 공유한다.
- input·readonly 값·실제 매도 단가 값·Desktop/Tablet table value·Phone card value는 같은 visual data-value 역할을 사용한다. 표현 방식이 다르다는 이유로 별도 size source를 만들지 않는다.
- KPI·상태(range)·전략 summary 카드의 큰 값은 같은 emphasis-value 역할을 공유한다.
- 일반 입력카드와 `계산 기준`은 공통 Field/Control contract의 label/control gap·field row gap·control geometry source를 공유한다. 정렬을 위한 magic margin·padding·고정 offset을 추가하지 않는다.
- Web/Tablet의 빈 label slot은 같은 field track 정렬용이며 Phone에서만 제거한다.
- input/date의 border·surface·focus·readonly·invalid visual state는 viewport와 무관하게 control shell이 canonical source다. 내부 input은 typography/value/padding과 Phone optical scale만 소유한다.
- choice/step control은 feature별 고정 높이를 복제하지 않고 각 container의 공통 field geometry를 따른다.
- Phone input은 iOS focus zoom을 막는 computed-size + optical-scale 구조를 유지하되 확대 자체를 viewport 설정으로 차단하지 않는다. optical scale 후 visual size는 공통 data-value와, 시각적 padding과 control 정렬은 공통 control spacing과 일치시킨다.
- `원/%` 단위 reserve와 고정 icon geometry처럼 기능상 필요한 부분만 Phone input 예외로 둔다. Phone media에서 control shell의 border/focus/state를 다시 구현하지 않으며 정확한 scale은 현재 CSS를 Source of Truth로 본다.

#### 1.2.4 선택·Surface·결과 표현

- Calc 주요 선택 버튼은 세로 geometry·typography·state를 공유하지만 가로 layout은 각 container가 소유한다. 거래유형·계산 기준·매도 전략의 폭/열 구성을 하나로 강제하지 않는다.
- `거래 리포트`·`기본값 복원`은 선택 상태가 없는 secondary utility action으로 별도 역할을 유지한다.
- Calc 중간 계산 요약은 하나의 outer surface 안에서 KPI 행과 상태 행으로 나눈다. 상단 입력·중간 요약·하단 전략 outer surface는 페이지 배경과 구분되는 같은 surface hierarchy를 사용한다.
- 내부 카드까지 같은 면색으로 덮어 계층을 없애지 않는다. 상태카드는 중립 surface를 기본으로 하고 semantic accent로 상태만 구분한다.
- 카드/패널/table cell의 surface spacing과 카드 간 gap은 공통 source를 재사용한다. subsection은 카드 외곽 padding을 중복하지 않고 divider 방향에만 필요한 간격을 둔다.
- Calc 결과 상세는 Desktop/Tablet table과 Phone card가 같은 semantic information role을 공유한다. section title·label·value typography는 같은 역할 source를 사용하고 table value는 semantic control surface를 사용하며, 표현 방식이 다르다는 이유로 별도 typography 체계를 만들지 않는다.
- Calc 상세표는 동일 열폭 + content-driven minimum width를 사용한다. 표 종류별 임의 `min-width` modifier를 누적하지 않고, 렌더된 label/value가 잘리지 않는 최소폭을 계산해 container보다 넓을 때만 표를 가로 스크롤한다.
- 상세표의 최소폭은 viewport 변화 시 같은 기준으로 다시 계산한다. Phone 카드 표현과 계산 로직은 이 presentation 규칙과 분리한다.
- Calc는 거래유형 preset만 유지하고 실제 거래일별 빠른 매수 shortcut을 누적하지 않는다. 실제 매수·매도 이력은 Report가 소유한다.
- 정상 계산 뒤 입력이 invalid가 되면 직전 정상 결과를 stale 상태로 유지하고, 다시 유효해지면 즉시 새 결과로 갱신한다.

#### 1.2.5 접근성·공통 자산·문구

- 입력 요소의 label 연결, 전략/Report tab의 `tablist/tab/tabpanel`·ARIA·keyboard state, tooltip의 `aria-describedby`, Calc Desktop 결과표와 Report table의 caption/header semantic을 유지한다. Calc 결과표의 hidden caption은 바로 위 section title과 같은 의미를 사용한다.
- 작은 도움말 정보 아이콘은 `img/ui-icons.svg#info-circle` 공통 SVG를 사용하고 label과 공통 inline 정렬 구조를 유지한다. 개별 위치 보정값을 누적하지 않는다. 키보드 focus로 열린 도움말도 Esc로 닫을 수 있어야 하며, 이때 focus를 강제로 blur하지 않고 현재 `:focus-within` 표시만 dismiss하는 상태 제어를 유지한다.
- Main·Calc·Report의 favicon은 저장소 공통 정적 자산 `img/favicon.png` 한 파일을 사용하며 Add HTML에서는 `../img/favicon.png`으로 참조한다.
- OS 모션 설정과 Calc/Report의 animation/transition/smooth scroll을 연동하지 않으며 production CSS/JS에 `prefers-reduced-motion`을 도입하지 않는다.
- CALC 설명문·툴팁·검증문구는 짧은 명사형·단문 스타일을 유지한다.

### 1.3 CSS / JS 내부 구조 원칙

- CSS/JS는 기능 책임과 화면 흐름 기준의 한글 section 구성을 유지하되, 이 문서가 파일 내부 목차를 중복 보관하지 않는다. 실제 section 순서와 selector/function 구성은 현재 소스를 Source of Truth로 본다.
- CSS는 기본 component 규칙 뒤에 responsive 규칙을 두고, 기능과 무관한 알파벳/가나다 정렬을 목적으로 재배치하지 않는다.
- `add.js`의 계산 엔진은 DOM-free를 유지하고 render/event 책임과 분리한다.
- 이벤트·툴팁·초기화는 중복 등록되지 않게 명시적으로 관리하며, Node export/browser boot guard를 유지한다.
- 계산 또는 validation을 변경한 경우 production `add/add.js`를 대상으로 `node --test tests/add-calc.test.cjs`를 실행한다. Report 거래 데이터·분류·합계를 변경한 경우에는 `node --test tests/add-report-data.test.cjs`를 반드시 함께 실행한다.
- Calc/Report의 선택상태·ARIA·responsive·control/typography source·Phone UI 등 장기 UI contract를 변경한 경우 `node --test tests/add-ui-contract.test.cjs`를 함께 실행한다.
- appearance/Corner/breakpoint/Phone Landscape/iPhone desktop request처럼 Main과 동일해야 하는 전역 contract를 변경한 경우 `node --test tests/cross-ui-contract.test.cjs`도 실행한다.
- Report의 차트 label thinning, 마지막 거래일 식별, DPR/resize 처리처럼 동작 의미가 있는 로직은 관련 변경 시 회귀 확인한다.

## 2. 거래 리포트 canonical 파일명

거래 리포트 canonical 파일은 아래 하나로 고정한다.

```text
add/kodex-leverage-report.html
```

- 거래기간은 본문에서 표시하고 파일명에는 넣지 않는다.
- 새 거래가 추가되어도 같은 canonical 파일을 갱신한다.
- 사용자가 별도로 보관본을 요청하지 않는 한 날짜형/병렬 report 파일을 새로 만들거나 복원하지 않는다.
- `add/calc.html`의 거래 리포트 링크는 `kodex-leverage-report.html`을 가리킨다.

## 3. 새로운 KODEX 레버리지 실현거래가 생겼을 때 기본 수정 범위

새로운 실현손익이 발생하면 기본적으로 아래 파일을 한 세트로 확인한다.

```text
data/kodex_leverage_trades.json # KODEX 레버리지 실현거래 + separateProfit 재투입 한도의 단일 canonical 원천
add/add.js               # canonical JSON 로드 후 파생 합계·본 포지션/단타·Timeline 계산/렌더
add/kodex-leverage-report.html # 표시기간·증빙 이미지·정적 설명문 등 실제 변경이 필요한 부분만
add/calc.html            # 링크/연동 확인. canonical 파일명 정착 후 보통 내용 변경 없음
add_maintenance_handover.md  # 장기 contract가 실제로 변경된 경우에만
main_dashboard_maintenance_handover.md # 메인 전역 contract가 실제로 변경된 경우에만
```

### 기본 원칙

> **리포트만 수정하지 않는다.**

새로운 실현손익은 메인 대시보드의 별도수익 계산과 KODEX Report가 함께 사용하므로 **`data/kodex_leverage_trades.json` 한 곳만 수정한다.** Main은 이 JSON에서 `separateProfit.trades`를 런타임 파생하고, Report는 같은 JSON을 `deriveReportModel()`에 전달한다. `data/portfolio.json`이나 `add/add.js`에 실현거래 배열을 별도로 복제하지 않는다. Report의 Hero/KPI/표/차트/본 포지션·단타/Timeline·혼합일 산식 설명 숫자도 모두 같은 canonical 원천의 파생값을 사용한다.

다음 파일은 단순히 새로운 실현거래가 생겼다는 이유만으로 수정하지 않는다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
data/pension_trades.json
data/pension_cash_snapshots.json
메인 CSS/JS
```

실제 요청이 해당 파일의 책임까지 포함할 때만 수정한다.

---

## 4. 증권사 원본 자료별 역할

새 거래를 반영할 때 자료의 역할을 다음과 같이 고정한다.

### 4.1 매도실현손익 화면

날짜별 최종 확정값의 1차 기준이다.

다음 값을 읽는다.

```text
매도일
종목명
매도수량
평균매수가
평균매도가
손익금액
거래비용
순손익금액
수익률
누적 합계
```

특히 `data/kodex_leverage_trades.json`에는 **손익금액(`pnl`)과 거래비용(`fee`)을 각각 확정값으로 반영**하고, Main/Report의 순손익은 `pnl - fee`로 동일하게 파생한다.

### 4.2 상세 매매보고서 / 매매내역

다음 용도로 사용한다.

```text
실제 매수일
실제 매도일
수량 연결
오버나이트 여부
본 포지션 / 단타 분류
타임라인 설명
```

### 4.3 자료가 서로 다르게 보일 때

- 날짜별 전체 손익·거래비용·순손익은 매도실현손익 화면을 우선한다.
- 매수일·보유기간·포지션 연결은 상세 매매보고서를 사용한다.
- 자료 간 불일치가 실제로 존재하면 임의로 숫자를 맞추지 말고 사용자에게 그 차이만 알린다.

---

## 5. KODEX 레버리지 canonical 거래 데이터 반영 규칙

단일 Source of Truth:

```text
data/kodex_leverage_trades.json
```

이 파일 하나가 다음 두 화면의 공통 원천이다.

- Main 대시보드의 `portfolio.separateProfit` 런타임 파생값
- Add KODEX Report의 날짜별/누적/Core/Day/차트/Timeline 파생값

`data/portfolio.json`에 `separateProfit` 거래 배열을 다시 만들거나, `add/add.js`에 거래 배열 literal을 다시 하드코딩하지 않는다.

기본 형식:

```json
{
  "schemaVersion": 1,
  "reportStartDate": "YYYY-MM-DD",
  "reinvestedLimit": 6700000,
  "positionContext": {
    "legacyBuild": {
      "first": {"date": "YYYY-MM-DD", "qty": 16, "buy": 203800},
      "second": {"date": "YYYY-MM-DD", "qty": 22, "buy": 170215}
    },
    "julyAdd": {"date": "YYYY-MM-DD", "buy": 74350},
    "augustFinalBuild": {
      "first": {"date": "YYYY-MM-DD", "qty": 15, "buy": 110465},
      "second": {"date": "YYYY-MM-DD", "buy": 96750}
    }
  },
  "trades": [
    {
      "date": "YYYY-MM-DD",
      "qty": 220,
      "buy": 97685,
      "sell": 102650,
      "pnl": 1092275,
      "fee": 1852,
      "segment": "core"
    }
  ]
}
```

- `schemaVersion`: 현재 형식은 `1`. `js/kodex-leverage-schema.js`가 Main과 Add Report의 단일 schema validator이며, 브라우저와 QA가 다른 버전 또는 잘못된 숫자·실제 달력에 존재하지 않는 날짜·중복 거래를 계산 전에 동일하게 차단한다. 숫자 필드는 문자열 숫자를 허용하지 않고 JSON `number` 정수만 허용하며, 윤년 규칙까지 실제 달력 기준으로 검증한다.
- `reportStartDate`: Report 상단 표시기간의 시작일. 종료일은 `trades`의 마지막 매도일에서 자동 파생한다.
- `positionContext`: 매도실현손익만으로 복원할 수 없는 매수-only 포지션 형성 사실. `legacyBuild.first/second`, `julyAdd`, `augustFinalBuild.first/second`는 현재 schema validator의 필수 context다. `legacyBuild.first/second`와 `augustFinalBuild.first`는 `date`·`qty`·`buy`, `julyAdd`와 `augustFinalBuild.second`는 `date`·`buy`를 요구하며, 후자의 수량은 canonical 실현거래 수량과 앞선 context에서 파생한다. 형식만 맞으면 통과시키지 않고 현재 schema v1의 연결 실현거래인 2026-07-30·2026-08-20과 날짜 순서·파생 수량의 양수 여부·수량×단가/취득원가 합계의 안전 정수 범위·가중평균 매수단가까지 교차 검증한다. 이 검증을 우회해 Timeline에 음수 파생수량이나 실제 거래와 모순되는 평단이 표시되어서는 안 된다. Timeline과 근거 설명에 필요한 값을 JS literal로 복제하지 않는다.

혼합일은 전체 거래값과 Core 귀속값을 함께 둔다.

```json
{
  "date": "YYYY-MM-DD",
  "qty": 101,
  "buy": 99463,
  "sell": 100145,
  "pnl": 68905,
  "fee": 846,
  "segment": "mixed",
  "core": {
    "qty": 32,
    "buy": 92580,
    "sell": 95480,
    "pnl": 92800,
    "fee": 253
  }
}
```

### 값의 의미

- `date` = 매도실현일
- `qty` = 해당 매도일 전체 매도수량
- `buy` / `sell` = 증권사 기준 평균 매수/매도 단가
- `pnl` = 거래비용 차감 전 손익금액
- `fee` = 거래비용
- `pnl - fee` = Main 별도수익과 Report가 공통으로 사용하는 날짜별 순손익
- `segment` = `core` / `day` / `mixed`
- `mixed.core` = 혼합일 중 본 포지션 귀속분. 단타분은 전체값에서 Core를 차감해 파생한다.

### 날짜별 관리

- 매도일 1일당 1개 canonical 레코드를 유지한다.
- 같은 날짜가 이미 있으면 중복 추가하지 않고 해당 날짜의 최종 확정값으로 갱신한다.
- 배열은 날짜 오름차순을 유지한다.
- Main의 `deriveSeparateProfitFromKodexReport()`는 `date`와 `pnl - fee`를 `separateProfit.trades` 형태로 런타임 파생한다.
- Report의 `deriveReportModel()`은 같은 `trades` 배열에서 전체/Core/Day/누적/차트 값을 파생한다.

### 재투입 한도

```text
reinvestedLimit
```

은 사용자가 별도로 변경하라고 하지 않는 한 기존 값을 유지한다. 새 실현손익이 생겼다고 자동으로 늘리지 않는다.

## 6. 거래 리포트의 확정 계산 기준

### 6.1 날짜별 전체 실현손익

증권사 매도실현손익 화면의 날짜별 값을 그대로 사용한다.

기본 검산:

```text
손익금액 - 거래비용 = 순손익
```

전체 합계:

```text
Σ 날짜별 손익금액 = 총 손익금액
Σ 날짜별 거래비용 = 총 거래비용
Σ 날짜별 순손익 = 누적 실현 순손익
```

### 6.2 본 포지션 / 단타 분류

기본 분류는 다음과 같다.

```text
매수한 날을 넘겨 보유 후 매도
→ 본 포지션

같은 날 매수 후 같은 날 매도
→ 단타
```

한 매도일에 기존 보유분 청산과 당일 반복매매가 섞여 있으면 **혼합일**로 처리한다.

### 6.3 혼합일 단타 수량

현재 리포트의 기존 방법을 유지한다.

```text
혼합일 단타 매도수량
= 증권사 그날 전체 매도수량
- 확인 가능한 본 포지션 매도수량
```

### 6.4 혼합일 단타 손익금액

```text
혼합일 단타 손익금액
= 증권사 그날 전체 손익금액
- 확인 가능한 본 포지션 손익금액
```

### 6.5 혼합일 거래비용 배분

증권사 화면이 날짜별 총 거래비용만 제공하고 본 포지션/단타별 비용을 따로 제공하지 않는 경우, 기존 리포트와 동일하게 **추정 왕복 거래대금 비율**로 비용을 배분한다.

따라서:

- 본 포지션·단타 각각의 거래비용/순손익에는 추정값이 포함될 수 있다.
- 그러나 두 그룹 합계는 증권사 날짜별 정확값과 반드시 일치해야 한다.

검산:

```text
본 포지션 순손익 + 단타 순손익
= 전체 누적 실현 순손익
```

---

## 7. 신규 거래의 자금 출처는 추적하지 않는다

새 KODEX 레버리지 매매가 어떤 자금으로 이루어졌는지는 이 리포트의 계산 범위가 아니다.

- 기존 현금·급여·대출 등 자금 출처를 사용자에게 다시 묻거나 별도로 분류하지 않는다.
- 신규 차입원금·대출이자·상환일·중도상환수수료·자금조달비용·자금 출처별 ROI를 새로 계산하지 않는다.
- 투자 리포트에는 실제 거래의 **손익금액·거래비용·순손익**만 반영한다.
- 대출이자 등 금융비용은 본 거래 리포트의 투자손익에서 제외한다.

## 8. 자금 흐름 / 차입금 섹션은 사용하지 않는다

현재 canonical 거래 리포트는 투자거래 손익 리포트이며 자금조달 리포트가 아니다.

- 과거의 자금 흐름·차입금 상환 후 현금·최종 순수 자기자금·자금 출처별 운용원금 계산은 현재 canonical 범위에서 제외한다.
- 신규 거래가 생겨도 과거 차입/카드대금 흐름을 다시 이어서 계산하지 않는다.
- 거래 설명에 필요한 매수원가·매도금액·손익·거래비용·순손익은 표시할 수 있지만 자금 출처까지 재분해하지 않는다.
- 사용자가 명시적으로 자금 흐름 분석을 다시 요청하지 않는 한 관련 패널/KPI를 복원하지 않는다.

### 8.1 거래 흐름 Timeline responsive contract

- Timeline은 Desktop/Tablet과 Mobile에서 표현 방식이 달라도 **모든 거래의 날짜와 순서가 식별 가능**해야 한다.
- Mobile에서도 날짜가 누락되지 않아야 하며, 현재 세부 배치·간격은 report HTML/CSS를 Source of Truth로 본다.
- Timeline UI를 수정한 경우 날짜 누락·순서 왜곡·카드 겹침만 반복 회귀 항목으로 확인한다.

## 9. 리포트에서 새 거래 반영 시 반드시 함께 갱신할 부분

- 같은 metric을 숫자·도넛·차트·요약에서 반복 표시할 경우 **하나의 최신 계산값**을 기준으로 사용하고 서로 불일치하지 않게 한다.
- 본 포지션/단타 비율 같은 시각화 값은 selector 내부 숫자로 하드코딩하지 않고 계산값에서 주입한다.
- 누적손익 차트 X축 날짜는 실제 plot 폭에 따라 생략할 수 있지만 마지막 거래일은 항상 식별 가능해야 한다.
- `매도일 기준 승률`은 `순손익 > 0인 매도일 수 ÷ 전체 매도일 수 × 100`이며, 0원인 날은 승리로 계산하지 않는다. 현재 표시 자릿수·보조문구는 report 소스를 Source of Truth로 본다.
- 새 거래 반영 후 Hero/KPI/표/차트/본 포지션·단타 요약은 동일 canonical 계산값을 사용해야 한다. Timeline의 실현거래 숫자는 `data/kodex_leverage_trades.json`에서 파생하고 HTML에 별도 숫자를 복제하지 않는다. 새 거래가 curated Timeline 설명에 없더라도 기본 항목이 자동 생성되는지 확인한다.
- 과거 마지막 날짜·누계·총수량 같은 문자열이 잔존하지 않는지 마지막에 검색한다.

## 10. 증권사 원본 이미지 반영

리포트에 증권사 실현손익 원본 이미지가 내장되어 있고 사용자가 최신 원본을 제공한 경우, 현재 숫자와 근거가 서로 다른 시점이 되지 않도록 관련 이미지·업데이트 표기·대체텍스트를 함께 갱신한다. 오래된 캡처와 최신 숫자를 한 리포트에 혼재시키지 않는다.

## 11. 새 거래 반영 시 빠른 작업 절차

```text
1. 증권사 매도실현손익에서 확정 손익·비용·순손익 확인
2. 상세 매매보고서에서 매수일·수량·오버나이트/포지션 연결 확인
3. `data/kodex_leverage_trades.json`에 실현거래를 1회 반영
4. 날짜별·합계·본 포지션/단타 파생값과 `reinvestedLimit` 검산
5. kodex-leverage-report.html의 표시기간·증빙 이미지·정적 설명문 중 필요한 부분만 갱신
6. Hero/KPI/표/차트와 Timeline 자동 파생·누락 여부를 동일 canonical JSON 기준으로 검산
7. `node --test tests/add-report-data.test.cjs`로 canonical 원천·Main 파생·Report 파생의 날짜별 정합성과 합계 보존 확인 후 변경 유형에 해당하는 추가 QA 수행
```

자금 출처·대출이자 분석이나 자금 흐름 패널 복원은 위 절차에 포함하지 않는다. 문서는 이 절차를 수행했다는 이유만으로 자동 갱신하지 않는다.

## 12. 필수 QA / 검산

모든 항목을 매번 기계적으로 검사하지 않고 **실제 변경 유형에 해당하는 범위만** 확인한다. 다만 거래/손익 정합성은 새 거래 반영 시 항상 확인한다.

### 12.1 새 거래·실현손익 반영 시

- 새 매도일의 수량·평균매수·평균매도·손익·비용·순손익이 증권사 원본과 일치한다.
- 날짜별 `손익금액 - 거래비용 = 순손익`, 전체 합계와 날짜별 합계가 일치한다.
- `data/kodex_leverage_trades.json`의 거래일이 오름차순·중복 없음·필수 숫자는 JavaScript 안전 정수 범위의 JSON `number`·segment 형식을 유지하고, Main 파생 별도수익과 Report 파생 날짜별 순손익·누적 실현 순손익이 일치한다. 문자열 숫자와 안전 정수 범위를 넘는 개별 정수는 허용하지 않으며, 개별 값이 모두 안전하더라도 Main의 `pnl - fee`·누적 별도수익과 Report의 날짜별 순손익·누적합계·전체/Core/Day 합계·혼합일 전체-Core 차감 등 파생 정수 결과가 안전 범위를 넘으면 계산/렌더 전에 중단해야 한다. `positionContext`도 연결 실현거래와 날짜·수량·가중평균이 모순되거나 파생 취득원가가 안전 정수 범위를 넘으면 schema 단계에서 차단한다. `tests/add-report-data.test.cjs`로 이 경계를 자동 확인한다.
- 본 포지션 + 단타의 수량·손익·비용·순손익 합계가 전체와 일치한다. 혼합일의 `core.fee`는 전체 `fee`를 넘을 수 없으며, 파생 단타 비용이 음수가 되면 canonical validation에서 차단한다.
- 동일 지표를 사용하는 요약·차트·표에 과거 값이 잔존하지 않으며, Timeline은 `data/kodex_leverage_trades.json` 파생값과 일치하고 새 매도일이 누락되지 않는다.
- 원본 이미지/근거를 갱신하는 작업이라면 최신 숫자와 같은 시점인지 확인한다.

### 12.2 Calc 계산·validation 변경 시

- `node --test tests/add-calc.test.cjs` 전체 PASS.
- 테스트는 production `compute()/validate()/ceil5()`를 직접 검증하고 계산식 복사본을 만들지 않는다.
- 숫자 입력은 `-0`을 `0`으로 정규화하고, 원화·수량·목표단가처럼 정수 정확도가 필요한 값은 JavaScript 안전 정수 범위 안에서만 계산한다. 변동률은 값 자체가 유한한 것만으로 통과시키지 않고 실제 5원 주문단위 목표가격까지 안전하게 산출되는지 검증한다.
- 개별 입력이 안전하더라도 `단가 × 수량`, 최종 보유수량·평가금액, 이전 손익과 현재·목표 손익의 통합 합계, 회수 대상 금액을 반영한 회복금액 등 핵심 파생 정수 계산이 안전 범위를 넘으면 관련 control을 invalid 처리한다. 계산 결과에서 `NaN`·`Infinity`·안전 범위를 벗어난 정수가 발견되면 렌더링·localStorage 저장을 수행하지 않는다.
- 최종 보유수량 0처럼 둘 이상의 입력 조합으로 발생하는 validation도 상단 오류문구만 표시하지 말고 원인 control의 `aria-invalid`/`aria-describedby`가 함께 연결되도록 유지한다.

### 12.3 Calc/Report UI·responsive 변경 시

- 수정 직후 QA의 기준은 **방금 수정한 현재 revision**이다. 동일 revision임이 확인되지 않은 GitHub Pages 공개본을 PASS/FAIL 근거로 사용하지 않는다.
- 사용자가 별도로 `배포본 확인`을 요청했거나 독립 평가를 수행하는 경우의 공개 runtime 사용 기준은 `dashboard_evaluation_guide.md`를 따른다.
- Desktop/Tablet/Mobile 기준에서 관련 화면을 확인하고, 요청하지 않은 add 전용 breakpoint가 생기지 않았는지 본다.
- tab/ARIA/tooltip/table semantic이 관련 변경으로 깨지지 않았는지 확인한다.
- 선택상태·hover·input/date/stepper CSS contract 또는 invalid 입력의 stale-result UX 관련 변경은 `node --test tests/add-ui-contract.test.cjs` 전체 PASS를 확인한다.
- Timeline을 건드렸다면 날짜 누락·순서 왜곡·카드 겹침을 확인한다.
### 12.4 구조 리팩터링 시

- `add.css`의 Shared/Calc/Report scope와 `add.js`의 Calc/Report boot 책임 경계가 유지되는지 확인한다.
- 계산 engine과 render/event가 다시 결합되거나 listener/boot가 중복 등록되지 않았는지 확인한다.
- `add-ui-contract.test.cjs`는 모든 미세 px 값을 무차별 고정하지 않고, 장기적으로 폐기되면 안 되는 구조·반응형·상태·접근성 contract를 우선 보호한다. 의도된 contract 자체가 바뀐 경우에만 실제 구현·handover·관련 테스트를 함께 정합화한다.

### 12.5 canonical 경로 관련 변경 시

- `add/calc.html`의 report 링크가 `kodex-leverage-report.html`인지 확인한다.
- 날짜형 report나 legacy canonical 경로 참조가 다시 생기지 않았는지 확인한다.

## 13. 수정하지 말아야 할 것

새 거래 반영이나 add 영역 유지보수와 직접 관계없는 책임까지 함께 변경하지 않는다.

- 메인 대시보드·퇴직연금·가격갱신/KRX 구조
- 요청하지 않은 Calc 계산식 또는 본 포지션/단타 분류 기준

사용자 요청이 Add canonical 계산·데이터 contract와 직접 충돌하거나 운영 데이터 훼손 위험을 만들면 조용히 강행하지 않는다. 최신 실제 소스를 기준으로 충돌 지점을 확인하고, 요청 목적을 최대한 유지하면서 canonical 원천과 계산 정합성을 보호하는 방향으로 처리한다.
- `data/kodex_leverage_trades.json`의 `reinvestedLimit` (별도 요청 없이 임의 변경 금지)
- 현재 사용하지 않는 자금 흐름/차입금 상환 후 자기자금 패널

다른 개선 아이디어가 보여도 사용자가 요청하지 않았다면 현재 작업과 섞지 않는다.

## 14. 최종 한 문장 운영 원칙

> **새 KODEX 레버리지 실현거래가 생기면 증권사 확정 거래를 `data/kodex_leverage_trades.json` 한 곳에 반영하고, Main 별도수익과 canonical report의 합계·분류·시각화·Timeline·근거가 같은 원천에서 파생되는지 검산한다. 자금 출처·대출이자 등은 추적하지 않으며 report 파일명은 고정하고, handover는 장기 contract가 바뀐 경우에만 수정한다.**
