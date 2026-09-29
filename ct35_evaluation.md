# 투자 대시보드 공통화·토큰화 35개 평가 기준

## 0. 적용 원칙

CT35는 “공통화가 많을수록 좋다”는 기준이 아닙니다. **같은 의미는 같은 contract를 쓰고, 다른 의미는 억지로 합치지 않는지**를 봅니다.

- Main/Add는 각각 독립 채점합니다. 적용되지 않으면 N/A입니다.
- 특정 기능 평가에서는 35개를 `적용 / 간접 적용 / N/A`로 먼저 분류합니다.
- 동일 root cause는 여러 항목에 중복 감점하지 않습니다.
- one-use 값, 기능성 예외, browser/native 제약은 이유가 있으면 감점하지 않습니다.
- 정확한 selector 순서나 미세 px를 공통화 점수 때문에 억지로 token화하지 않습니다.

각 항목은 /100이며 아래 배점 구성을 사용합니다.

## 1. CT35 항목

| # | 항목 | 고정 배점 구성 | 핵심 검사 |
|---:|---|---|---|
| 1 | 색상·Semantic Color | token 25 / literal 억제 25 / Light·Dark 20 / 상태색 15 / JS·Chart 책임 15 | 의미색이 semantic token과 runtime state에 맞고 기능별 색 literal이 불필요하게 복제되지 않는가 |
| 2 | Corner / Radius | 역할 token 25 / 계층 구분 25 / 동일계층 20 / 직접값 억제 15 / responsive 15 | Surface·Control·Inner radius가 역할별로 일관적인가 |
| 3 | Spacing / Density | token 25 / surface padding 20 / density hierarchy 20 / responsive progression 20 / magic spacing 15 | gap/padding이 계층과 viewport에 따라 설명 가능하게 변하는가 |
| 4 | Card Surface | 공통 surface 30 / token 25 / 중복 억제 20 / content 분리 25 | card 외형과 feature content 책임이 분리되는가 |
| 5 | Section Title / Heading | primitive 30 / typography 25 / icon·gap 25 / geometry 20 | 제목+control 유무에도 정렬/높이가 안정적인가 |
| 6 | Icon + Label | icon 25 / label 25 / baseline·gap 25 / 의미 예외 25 | 같은 역할의 icon-label이 같은 크기·정렬을 쓰는가 |
| 7 | Button | primitive 30 / token 20 / interaction 25 / 개별보정 억제 25 | button 상태와 hit area가 일관적인가 |
| 8 | Toggle / Switch / Segmented | visual grammar 30 / state 25 / responsive 20 / 중복 억제 25 | 같은 선택/ON-OFF 의미가 공통 상태 표현을 쓰는가 |
| 9 | Table 기본 | semantic cell 30 / shell 25 / position selector 억제 20 / 계산 분리 25 | 정렬·cell 의미·table shell이 position 기반 임시처리에 의존하지 않는가 |
| 10 | Table Summary / Total | hierarchy 30 / weight·align 25 / secondary 20 / 중복 억제 25 | 합계행/보조문구의 의미 계층이 일관적인가 |
| 11 | Asset Detail | UI shell 30 / neutral VM 25 / 계산 분리 30 / 현금 semantic 15 | 증권/연금 상세가 표현을 공유하되 계산을 섞지 않는가 |
| 12 | 성과 요약 / 계좌별 보기 | shell 25 / KPI 25 / state 전환 25 / 정합성 25 | 전체↔계좌별 전환에서 계산과 레이아웃이 일치하는가 |
| 13 | Mini Card | primitive 30 / density 25 / typography·gap 20 / 변형 억제 25 | 작은 카드가 화면마다 독자 규칙으로 증식하지 않는가 |
| 14 | Empty State | primitive 30 / typography 25 / empty vs error 25 / layout 20 | 빈 데이터와 오류가 의미/레이아웃상 구분되는가 |
| 15 | Tooltip | visual 25 / lifecycle 25 / accessibility 25 / feature 예외 25 | tooltip 표현·open/close·focus/touch 책임이 일관적인가 |
| 16 | Modal Surface | surface 25 / lifecycle 30 / focus 25 / business 분리 20 | modal chrome/lifecycle과 feature 저장/계산이 분리되는가 |
| 17 | Action Form | primitive 25 / control density 25 / validation 25 / business 분리 25 | form 상태/validation이 개별 화면 임시구현에 의존하지 않는가 |
| 18 | Date Selector / Input Density | height 25 / padding·align 25 / native picker 25 / 보정 억제 25 | 날짜/input이 viewport별로 과도한 예외 없이 안정적인가 |
| 19 | Chart Card | structure 30 / header·legend 25 / spacing 20 / 개별보정 억제 25 | chart shell과 control grammar가 일관적인가 |
| 20 | Chart Plot Margin | 공통 source 30 / magic 억제 25 / axis geometry 25 / responsive 예외 20 | plot 여백이 차트마다 임의 숫자로 갈라지지 않는가 |
| 21 | Chart Axis / Zero | 0선 25 / Y-range 30 / state 25 / 공간효율 20 | 양·음수 혼합/비교차트의 0선과 범위 의미가 맞는가 |
| 22 | Chart Legend / Selection | selection 30 / 최소1개·전체 25 / expanded 25 / mode 20 | 선택 state가 resize/확대/mode 전환에도 보존되는가 |
| 23 | Responsive Density | 3단계 30 / spacing·KPI 25 / breakpoint 25 / component 20 | Desktop/Tablet/Phone 밀도 변화가 한 방향성을 가지는가 |
| 24 | Phone Portrait / Landscape | mobile family 30 / 주요영역 25 / 기능예외 25 / desktop 충돌 20 | 스마트폰 가로가 Tablet 규칙으로 오인되지 않는가 |
| 25 | Tablet | 761~1100 25 / 중간 density 25 / primitive 25 / 중복 억제 25 | Tablet이 Desktop/Phone 복사본이 아니라 중간 역할을 유지하는가 |
| 26 | Topbar / Navigation | primitive 25 / viewport 역할 25 / geometry 25 / markup 중복 25 | viewport별 진입점이 중복되거나 겹치지 않는가 |
| 27 | Source / Ledger / Symbol 예외 | semantic 30 / primitive 25 / 예외수 20 / generic 보호 25 | 출처·원장·기호 예외가 실제 의미 때문에 존재하는가 |
| 28 | Account / Portfolio 표현 | hierarchy 25 / summary-detail 25 / align 25 / secondary 25 | 계좌/포트폴리오 표기가 같은 정보계층을 유지하는가 |
| 29 | 전일 대비 변동 | 의미·포맷 30 / semantic renderer 25 / narrow 25 / leakage 20 | 금액/부호/현재가 출처가 viewport별로 의미를 잃지 않는가 |
| 30 | Market AI Frontend | main primitive 20 / standalone state 25 / 실패격리 20 / display·Signal 분리 20 / main 비결합 15 | Market AI가 Main 저장 state와 과결합하지 않고 실패가 격리되는가 |
| 31 | Add Calc UI | 독립 token 25 / Calc primitive 25 / layout 분리 25 / accessibility 25 | Calc가 Main 복제 CSS가 아닌 Add 책임 안에서 일관적인가 |
| 32 | Add Report | visual 25 / metric single source 30 / responsive 25 / canonical 20 | 동일 metric이 표/차트/요약에서 한 계산값을 쓰는가 |
| 33 | JavaScript Common Helper | core DOM-free 20 / ui-common 20 / dependency 25 / 응집도 20 / global 부재 15 | common layer가 기능 계산을 흡수하거나 역방향 dependency를 만들지 않는가 |
| 34 | Modal Lifecycle Module | canonical module 30 / 중복 제거 20 / focus·inert 25 / feature 분리 25 | modal lifecycle이 공통 owner에 있고 feature logic은 남아 있는가 |
| 35 | 표현 공통화와 계산 책임 분리 | presentation 25 / 계산 25 / state·persistence 25 / common 비대화 방지 25 | 표현은 합리적으로 공유하고 계산/저장은 feature owner가 소유하는가 |

## 2. 판정 방법

각 항목에서 아래 순서로 봅니다.

```text
1. 같은 의미가 여러 구현으로 중복되는가
2. 공통 token/helper가 실제로 재사용 가치가 있는가
3. 공통화 때문에 feature 의미가 흐려지거나 dependency가 역전되지 않았는가
4. viewport/theme/state 변화에서 같은 contract가 유지되는가
5. 예외가 기능적 이유를 갖는가
```

### 대표 감점

- 같은 semantic 값을 여러 파일/기능에서 literal로 반복
- 동일 component가 화면마다 다른 selector/markup 계약을 가짐
- position selector나 DOM 순번에 의미를 의존
- 공통 helper가 business 계산/state까지 흡수
- responsive 예외가 특정 캡처 맞춤식으로 누적
- Main/Add가 공유해야 할 contract가 서로 다른 값으로 drift

### 감점하지 않는 예외

- 한 곳에서만 쓰이고 재사용 가능성이 낮은 값
- native control/browser workaround
- 실제 기능 차이 때문에 필요한 layout/spacing 예외
- Main과 Add의 독립성을 지키기 위한 의도된 분리
- 성능/접근성 때문에 필요한 specialized implementation

## 3. 카테고리

| 카테고리 | 항목 |
|---|---|
| Design token / primitive | 1~8, 13~20 |
| Table / portfolio 표현 | 9~12, 27~29 |
| Chart | 19~22 |
| Responsive / navigation | 23~26 |
| Feature surface | 30~32 |
| JS architecture | 33~35 |

카테고리는 탐색 편의를 위한 분류이며 별도 점수축을 만들지 않습니다.

## 4. 출력 최소 형식

전체 Dashboard:

```text
항목 | Main | Add | 판정 | 핵심 근거
```

특정 영역/기능:

```text
항목 | 적용여부 | 점수/N/A | 핵심 근거
```

각 행은 한두 문장으로 충분합니다. 같은 root cause를 35번 반복 설명하지 않습니다.

## 5. 문서 유지관리

- 이 문서는 평가 항목과 배점만 소유합니다.
- 현재 selector, px, 함수명, 특정 DOM 순서는 기록하지 않습니다.
- 기능 contract는 handover, 실제 구현은 최신 소스를 봅니다.
- 새로운 UI가 생겨도 기존 항목으로 평가 가능하면 항목을 추가하지 않습니다.
- 35개 체계 자체가 바뀌는 경우에만 이 문서를 수정합니다.
