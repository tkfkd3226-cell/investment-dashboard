# 투자 대시보드 공통화·토큰화 35개 평가 기준

> 목적: 사용자가 `평가`, `평가해줘`, `CT35 평가`를 요청했을 때 Main과 Add의 공통화·토큰화·반응형·책임 구조를 같은 기준으로 재현성 있게 확인한다.  
> 이 문서는 변경 이력이 아니라 **평가 contract**다. 현재 selector, 일회성 px, 특정 수정 이력은 기록하지 않는다.

---

## 0. 핵심 원칙

CT35는 “공통화가 많을수록 좋다”는 기준이 아니다.

- **같은 의미는 같은 contract를 재사용**하는지 본다.
- **계산·state·persistence가 다르면 feature owner에 남기는지** 본다.
- Main과 Add는 **독립적으로 채점**한다. 한쪽 결함을 다른 쪽 점수에 전가하지 않는다.
- `Main + Add` 항목은 Main만 보고 끝내지 않는다. Add에 해당 component가 있으면 **Calc와 Report를 실제로 확인**한다.
- Add에서 해당 primitive가 실제로 없을 때만 `N/A`를 쓴다. “Add는 별도 앱이니까”라는 이유로 공통 항목을 일괄 N/A 처리하지 않는다.
- 같은 root cause는 여러 항목에서 반복 감점하지 않는다.
- one-use 값, browser/native 제약, 기능성 예외, page-specific layout은 **재사용 필요성이 없으면 감점하지 않는다.**
- 정확한 selector 순서·내부 변수명·미세 px를 장기 contract로 만들지 않는다.
- 공통화를 위해 정상적인 feature 계산을 generic helper로 끌어올리는 제안은 하지 않는다.

---

## 1. 범위와 채점 방식

### 1.1 기본 범위

| 구분 | CT35 적용 |
|---|---|
| **Main + Add** | 1~10, 13~15, 17~20, 23, 35 |
| **Main 중심** | 11, 12, 16, 21, 22, 24~30, 33, 34 |
| **Add 전용** | 31 Calc, 32 Report |

- 위 표는 기본 범위다. 개별 항목 표의 `범위`가 최종 기준이다.
- `Main + Add` 항목에서 Add는 `add/add.css`, `add/add.js`, `add/calc.html`, `add/kodex-leverage-report.html` 중 해당 기능을 소유한 파일을 확인한다.
- Add의 Calc와 Report 중 한쪽에만 문제가 있으면 **Add 점수에는 반영하되 어느 페이지 문제인지 명시**한다.
- 사용자가 `Main만`, `Add만`, `Calc만`, `Report만`처럼 범위를 지정하면 반대 영역은 평가하지 않는다.

### 1.2 점수 판정

각 항목은 100점 만점이며, 항목별 세부 배점은 아래 표를 사용한다.

| 판정 | 세부 배점 반영 | 기준 |
|---|---:|---|
| **PASS** | 100% | 확인 범위에서 contract 위반 없음 |
| **MINOR** | 80% | 국소적 1~2건, 의미·책임·재사용 구조 영향 작음 |
| **MAJOR** | 40% | 반복 위반, 여러 component에 분산, 유지보수/회귀 비용 큼 |
| **FAIL** | 0% | 핵심 contract 부재, 의미 불일치, 역방향 책임 침범 |

임의로 `-2`, `-7`처럼 점수를 깎지 않는다. **세부 배점별 판정 후 합산**한다.

### 1.3 100점 조건

100점은 다음을 모두 만족할 때만 부여한다.

1. 해당 영역(Main 또는 Add)의 필수 범위를 확인했다.
2. 세부 배점이 모두 PASS다.
3. 미해결 A/B급 결함이 없다.
4. 직접값·예외는 기능적 이유 또는 허용 예외로 설명 가능하다.
5. 실제 소스와 handover가 충돌하지 않는다.

표본검사만 했거나 한쪽 영역을 확인하지 못했다면 그 영역을 100점으로 단정하지 않는다.

---

## 2. CT35 항목

| # | 항목 | 범위 | 고정 배점 구성 | 핵심 검사 |
|---:|---|---|---|---|
| 1 | 색상·Semantic Color | Main + Add | token 25 / literal 억제 25 / Light·Dark 20 / 상태색 15 / JS·Chart 책임 15 | 같은 의미의 색이 semantic token으로 재사용되고 theme/state 의미가 유지되는가 |
| 2 | Corner / Radius | Main + Add | 역할 token 25 / 계층 구분 25 / 동일계층 20 / 직접값 억제 15 / responsive 15 | Surface·Control·Inner radius가 역할별로 일관적인가 |
| 3 | Spacing / Density | Main + Add | token 25 / surface padding 20 / density hierarchy 20 / responsive progression 20 / magic spacing 15 | gap/padding이 역할과 viewport에 따라 설명 가능하게 변하는가 |
| 4 | Card Surface | Main + Add | 공통 surface 30 / token 25 / 중복 억제 20 / content 분리 25 | card 외형과 feature content 책임이 분리되는가 |
| 5 | Section Title / Heading | Main + Add | primitive 30 / typography 25 / icon·gap 25 / geometry 20 | 같은 hierarchy의 제목이 control 유무에도 안정적인가 |
| 6 | Icon + Label | Main + Add | icon 25 / label 25 / baseline·gap 25 / 의미 예외 25 | 같은 역할의 icon-label이 같은 크기·정렬 grammar를 쓰는가 |
| 7 | Button | Main + Add | primitive 30 / token 20 / interaction 25 / 개별보정 억제 25 | 높이·padding·상태·focus가 일관되고 feature별 중복이 적절한가 |
| 8 | Toggle / Switch / Segmented | Main + Add | visual grammar 30 / state 25 / responsive 20 / 중복 억제 25 | 선택/ON-OFF 의미가 동일한 상태 표현을 쓰는가 |
| 9 | Table 기본 | Main + Add | semantic cell 30 / shell 25 / position selector 억제 20 / 계산 분리 25 | 정렬·cell 의미·table shell이 DOM 순번 임시처리에 의존하지 않는가 |
| 10 | Table Summary / Total | Main + Add | hierarchy 30 / weight·align 25 / secondary 20 / 중복 억제 25 | 합계행과 보조문구의 정보 hierarchy가 일관적인가 |
| 11 | Asset Detail | Main | UI shell 30 / neutral VM 25 / 계산 분리 30 / 현금 semantic 15 | 증권/연금 상세가 표현을 공유하되 계산 의미는 보존되는가 |
| 12 | 성과 요약 / 계좌별 보기 | Main | shell 25 / KPI 25 / state 전환 25 / 정합성 25 | 전체↔계좌별 전환에서 계산·state·layout이 일치하는가 |
| 13 | Mini Card | Main + Add | primitive 30 / density 25 / typography·gap 20 / 변형 억제 25 | 작은 카드가 화면별 독자 규칙으로 불필요하게 증식하지 않는가 |
| 14 | Empty State | Main + Add | primitive 30 / typography 25 / empty vs error 25 / layout 20 | 데이터 없음과 오류가 의미와 layout에서 구분되는가 |
| 15 | Tooltip | Main + Add | visual 25 / lifecycle 25 / accessibility 25 / feature 예외 25 | 표현·open/close·focus/touch 책임이 일관되고 feature data 계산과 분리되는가 |
| 16 | Modal Surface | Main | surface 25 / lifecycle 30 / focus 25 / business 분리 20 | modal chrome/lifecycle과 feature 저장·계산 책임이 분리되는가 |
| 17 | Action Form | Main + Add | primitive 25 / control density 25 / validation 25 / business 분리 25 | form state/validation과 feature business logic이 적절히 분리되는가 |
| 18 | Date Selector / Input Density | Main + Add | height 25 / padding·align 25 / native picker 25 / 보정 억제 25 | 날짜/select/input이 browser·viewport별 과도한 예외 없이 안정적인가 |
| 19 | Chart Card | Main + Add | structure 30 / header·legend 25 / spacing 20 / 개별보정 억제 25 | chart shell과 control grammar가 일관적인가 |
| 20 | Chart Plot Margin | Main + Add | 공통 source 30 / magic 억제 25 / axis geometry 25 / responsive 예외 20 | plot 여백이 차트별 임의 숫자로 갈라지지 않고 축 공간이 설명 가능한가 |
| 21 | Chart Axis / Zero | Main | 0선 25 / Y-range 30 / state 25 / 공간효율 20 | 0선·Y range·자동축이 실제 scale과 series state에 맞는가 |
| 22 | Chart Legend / Selection | Main | selection 30 / 최소1개·전체 25 / expanded 25 / mode 20 | selection state가 resize/확대/mode 전환에도 보존되는가 |
| 23 | Responsive Density | Main + Add | 3단계 30 / spacing·KPI 25 / breakpoint 25 / component 20 | Desktop/Tablet/Phone의 밀도 변화가 일관된 방향성을 가지는가 |
| 24 | Phone Portrait / Landscape | Main | mobile family 30 / 주요영역 25 / 기능예외 25 / desktop 충돌 20 | 스마트폰 가로가 Desktop/Tablet 규칙과 충돌하지 않는가 |
| 25 | Tablet | Main | 761~1100 25 / 중간 density 25 / primitive 25 / 중복 억제 25 | Tablet이 Desktop/Phone 복사본이 아니라 중간 density를 유지하는가 |
| 26 | Topbar / Navigation | Main | primitive 25 / viewport 역할 25 / geometry 25 / markup 중복 25 | viewport별 진입점과 control이 겹치거나 불필요하게 중복되지 않는가 |
| 27 | Source / Ledger / Symbol 예외 | Main | semantic 30 / primitive 25 / 예외수 20 / generic 보호 25 | 의미가 다른 예외를 억지 공통화하지 않고 generic contract를 보호하는가 |
| 28 | Account / Portfolio 표현 | Main | hierarchy 25 / summary-detail 25 / align 25 / secondary 25 | 계좌/포트폴리오 정보계층과 숫자 정렬이 일관적인가 |
| 29 | 전일 대비 변동 | Main | 의미·포맷 30 / semantic renderer 25 / narrow 25 / leakage 20 | 현재가·전일가·변동·등락률 의미가 viewport별로 유지되는가 |
| 30 | Market AI Frontend | Main | main primitive 20 / standalone state 25 / 실패격리 20 / display·Signal 분리 20 / main 비결합 15 | Market AI frontend가 Main 저장 state와 과결합하지 않고 실패를 격리하는가 |
| 31 | Add Calc UI | Add Calc | 독립 token 25 / Calc primitive 25 / layout 분리 25 / accessibility 25 | Calc가 Add 공통 primitive를 재사용하면서 계산 UI 책임을 명확히 유지하는가 |
| 32 | Add Report | Add Report | visual 25 / metric single source 30 / responsive 25 / canonical 20 | 동일 metric이 KPI·표·차트·Timeline에서 한 계산 source를 쓰는가 |
| 33 | JavaScript Common Helper | Main | core DOM-free 20 / ui-common 20 / dependency 25 / 응집도 20 / global 부재 15 | common layer가 feature 계산/state를 흡수하거나 역방향 dependency를 만들지 않는가 |
| 34 | Modal Lifecycle Module | Main | canonical module 30 / 중복 제거 20 / focus·inert 25 / feature 분리 25 | open/close/ESC/focus/body-lock은 공통화하고 업무 로직은 feature에 남는가 |
| 35 | 표현 공통화와 계산 책임 분리 | Main + Add | presentation 25 / 계산 25 / state·persistence 25 / common 비대화 25 | 표현은 합리적으로 공유하고 계산·state·저장은 각 feature owner가 소유하는가 |

---

## 3. Main + Add 공통 항목의 Add 검사 규칙

이 절은 최근 과축소로 빠졌던 부분이다. 전체 평가에서는 아래를 반드시 확인한다.

### 3.1 Add 공통 source

- `add/add.css`: Add의 token, surface, control, responsive, Calc/Report scoped rule
- `add/add.js`: page boot, 공통 interaction, Calc 계산/render, Report render
- `add/calc.html`: Calc DOM/label/control 구조
- `add/kodex-leverage-report.html`: Report KPI/table/chart/timeline 구조

### 3.2 항목별 Add 확인 포인트

- **1~8**: Add 자체 theme/token/primitive가 Calc와 Report에서 불필요하게 갈라지지 않는지 확인한다. Main CSS와 동일 파일을 강제 공유할 필요는 없다.
- **9~10**: Calc/Report에 실제 table/summary가 있을 때 semantic cell, alignment, summary hierarchy를 확인한다.
- **13~15**: mini card, empty state, tooltip이 실제 존재하는 페이지에서만 평가한다.
- **17~18**: Calc form/input/date/select 및 Report의 interactive control이 실제 존재하는 범위에서 확인한다.
- **19~20**: Report chart와 Calc의 chart-like surface가 있을 때 plot/card contract를 확인한다. 사용 라이브러리가 다르면 **동일 구현**이 아니라 **동일 역할의 일관성**을 평가한다.
- **23**: Add도 Desktop/Tablet/Phone에서 density가 자연스럽게 줄어드는지 확인한다. Main의 breakpoint 숫자를 무조건 복사했는지가 아니라 **프로젝트 전역 viewport contract를 위반하는지**를 본다.
- **35**: Main↔Add를 억지로 하나의 runtime으로 합치지 않는다. 같은 canonical data/contract는 공유하되 page-specific 계산·state는 분리되어야 한다.

### 3.3 Add 점수 계산

- 공통 항목에서 Calc와 Report 모두 적용되면 **둘을 모두 본 뒤 하나의 Add 점수**를 낸다.
- 한 페이지에만 결함이 있으면 Add 점수에 반영하고 `Calc` 또는 `Report`를 근거에 표시한다.
- 항목 자체가 두 페이지 모두에 존재하지 않으면 Add는 `N/A`다.
- 31은 Calc만, 32는 Report만 평가한다.

---

## 4. 항목별 검사 순서

각 항목은 아래 순서로 본다.

```text
1. 실제 component/기능이 존재하는가
2. 같은 semantic이 여러 구현으로 중복되는가
3. 공통 token/helper가 실제 재사용 가치가 있는가
4. 공통화 때문에 feature 의미·계산·state가 흐려지지 않았는가
5. viewport/theme/state 변화에서도 contract가 유지되는가
6. 예외가 기능적 이유를 갖는가
7. Main/Add 공통 항목이면 Add도 실제로 확인했는가
```

### 대표 감점

- 같은 semantic 값을 여러 파일/기능에서 반복 literal로 관리
- 동일 component가 화면마다 서로 다른 markup/state contract를 가짐
- position selector나 DOM 순번에 업무 의미를 의존
- common helper가 business 계산/state/persistence를 흡수
- responsive 예외가 특정 캡처 맞춤식으로 계속 누적
- Main/Add가 공유해야 할 canonical contract가 서로 drift
- Add 평가 대상이 분명히 존재하는데 Main만 확인하고 Add를 N/A 처리

### 감점하지 않는 예외

- 한 곳에서만 쓰이고 재사용 이유가 없는 값
- native control/browser workaround
- 실제 기능 차이 때문에 필요한 layout/spacing 예외
- Main과 Add의 runtime 독립성을 지키기 위한 의도된 분리
- 성능/접근성 때문에 필요한 specialized implementation
- chart library가 달라 내부 API가 다른 경우

---

## 5. 카테고리별 종합

필요한 경우 35개 개별 점수 외에 아래 카테고리 평균을 보조 지표로 제공한다.

| 카테고리 | 항목 |
|---|---|
| Design token / primitive | 1~8, 13~20 |
| Table / portfolio 표현 | 9~12, 27~29 |
| Chart | 19~22 |
| Responsive / navigation | 23~26 |
| Feature surface | 30~32 |
| JS architecture / 책임 | 33~35 |

- Main 카테고리 평균과 Add 카테고리 평균은 **분리**한다.
- Add에 적용되지 않는 항목은 평균에서 제외한다.
- 카테고리 평균은 분석 보조용이며 개별 항목 판정을 덮어쓰지 않는다.

---

## 6. 출력 형식

### 6.1 전체 Dashboard 평가

최소 다음 수준으로 출력한다.

| 항목 | Main | Add | 판정 | 핵심 근거 |
|---|---:|---:|---|---|
| 각 CT35 항목 | 00 | 00 또는 N/A | PASS/MINOR/... | Main 근거 + 적용되는 Add Calc/Report 근거 |

그 뒤 다음을 별도로 표시한다.

```text
Main CT35 평균: 00/100
Add CT35 평균: 00/100
Main A/B/C: ...
Add A/B/C: ...
```

**Main+Add 통합 단일 CT35 총점은 사용자가 요구하지 않으면 만들지 않는다.**

### 6.2 특정 영역 평가

```text
항목 | 적용여부 | Main 또는 Add 점수/N/A | 핵심 근거
```

- 같은 root cause를 35번 장문 반복하지 않는다.
- 다만 `평가해줘` 전체 평가에서는 **점수만 나열하지 말고 실제 source 근거를 대표적으로 제시**한다.
- Add를 평가했다면 Calc/Report 중 무엇을 확인했는지 결과에서 알 수 있어야 한다.

---

## 7. 과공통화·과테스트와의 관계

CT35 점수를 올리기 위한 다음 작업은 금지한다.

- one-use literal을 무조건 token으로 승격
- Main/Add runtime을 하나로 합치기
- 다른 계산식을 같은 helper에 억지로 합치기
- exact selector/DOM 순서/내부 변수명을 contract test로 고정
- 이미 전용 행동 테스트가 검증하는 기능을 source-regex test로 중복 고정
- 특정 viewport 스크린샷을 맞추기 위해 임의 breakpoint 추가

공통화는 **변경 비용과 회귀 위험을 실제로 줄일 때만** 점수상 장점이다.

---

## 8. 문서 유지관리

- 이 문서는 35개 항목, 적용 범위, 배점, 판정 방식만 소유한다.
- 현재 selector, 함수명, 특정 날짜의 데이터, 개별 수정 이력을 기록하지 않는다.
- 기능 contract는 handover, 실제 구현은 최신 소스를 본다.
- 새로운 UI가 생겨도 기존 35개로 평가 가능하면 항목을 추가하지 않는다.
- Main/Add 적용 범위나 장기 평가 기준이 바뀌는 경우에만 이 문서를 수정한다.
