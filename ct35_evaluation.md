# 투자 대시보드 공통화·토큰화 35개 항목 평가 기준서

> **문서 성격**: 이 문서는 공통화·토큰화 관점의 **35개 관찰 항목과 고정 배점**만 정의합니다. 전체 평가 명령, 전역 A/B/C 의미, 100점 Gate, Counterexample Pass, 평가 종료 기준은 `dashboard_evaluation_guide.md`를 따릅니다. Main/Add의 실제 유지보수 contract는 각 handover 문서가 소유합니다.

## 0. 적용 원칙

- 최신 실제 소스가 Source of Truth다. 문서와 다르면 코드와 handover를 대조해 회귀인지 문서 노후화인지 구분한다.
- `Main + Add` 항목은 Main과 Add를 **각각 100점 만점으로 독립 채점**하며 평균내지 않는다.
- Main 전용 항목은 Add를 `N/A`, Add 전용 항목은 Main을 `N/A`로 둔다.
- 각 세부 배점은 `PASS=100% / MINOR=80% / MAJOR=40% / FAIL=0%`를 적용한 뒤 합산한다.
- 자동 테스트 개수·파일 수·코드 길이 자체는 가감점하지 않는다. 테스트 FAIL은 실제 결함인지 과도하거나 낡은 contract인지 먼저 확인한다.
- 장식용 exact pixel/color/count나 특정 구현 순서를 품질 기준으로 만들지 않는다. 실제 semantic·책임·재사용·responsive contract를 평가한다.
- 같은 결함을 여러 항목에서 중복 감점하지 않는다. 가장 직접적인 항목에서 1회 반영한다.
- C급 또는 비감점 관찰은 이 문서가 아니라 상위 평가 가이드의 A/B/C 정의를 따른다.
- runtime이 필요할 때는 최신 revision 검증 가능 여부를 구분한다. 공개 GitHub Pages가 최신 ZIP과 같은 revision인지 확인되지 않으면 `배포본 runtime`으로만 기록한다.

### 항목 범위

- **Main + Add:** 1~10, 13~15, 17~20, 23, 35
- **Main 중심:** 11, 12, 16, 21, 22, 24~30, 33, 34
- **Add 전용:** 31, 32
- 실제 component가 없는 영역은 억지로 구현을 요구하지 않고 `N/A`로 처리한다.

### 평가 출력 최소 형식

| 항목 | Main | Add | 판정 | 핵심 근거 |
|---|---:|---:|---|---|
| 1. 색상·Semantic Color | 00/100 | 00/100 | PASS/MINOR/... | 실제 token/selector 근거 |

전체 평가에서는 1~35를 모두 기록하고, 특정 번호 요청에서는 해당 항목만 평가한다. 카테고리 평균은 문서 마지막 분류표를 사용하되 Main/Add를 합산하지 않는다.

# 1. 색상·Semantic Color 체계

**분류:** 토큰화 중심 · **검사 범위:** Main + Add

### 평가 대상
- background / surface / border / muted text
- positive / negative / warning / emphasis
- Light / Dark theme 대응
- 손익 색상
- 보조 텍스트 색상

### 평가 기준
- 의미가 같은 색을 semantic token으로 공유하는가
- 동일 의미의 색이 여러 hex/rgb 값으로 흩어져 있지 않은가
- Light/Dark에서 의미는 유지하면서 실제 값만 theme token으로 바뀌는가
- 손익/상승/하락/경고 색이 component별 임의값으로 재정의되지 않는가
- JS가 색을 직접 하드코딩하지 않고 CSS/token source를 재사용하는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Semantic token coverage | 25 |
| 중복 literal / hardcoding 억제 | 25 |
| Light / Dark semantic parity | 20 |
| 상태·손익·보조색 일관성 | 15 |
| JS / Chart 색상 책임 | 15 |
| **합계** | **100** |

### 필수 검사
- Main CSS 전체 color/background/border 계열 literal과 `var()` 사용 전수 검색
- Add CSS 전체를 동일 방식으로 전수 검색
- Light/Dark token override 대조
- JS의 hex/rgb literal을 전수 검색해 UI semantic / categorical data palette / fallback으로 분류
- 같은 semantic이 card/table/chart/add에서 동일 token을 쓰는지 교차 확인

### 항목 특이 판정
- UI semantic 색이 component selector에서 반복 직접값으로 존재하면 해당 세부항목은 최소 MINOR
- Light/Dark에서 같은 semantic이 서로 다른 의미색으로 바뀌면 해당 parity 항목 FAIL

### 대표 감점 요인
- 동일 semantic에 다수 하드코딩 색상 존재
- theme별 의미 불일치
- chart/table/card가 같은 의미의 색을 서로 다르게 사용
- 색상 변경을 위해 여러 파일을 동시에 수정해야 하는 구조

### 허용 예외
- categorical/data-series palette
- CSS variable 조회 실패용 JS fallback
- `transparent`, `currentColor`, 브라우저 기본색
- 외부 asset 또는 third-party가 소유하는 색

# 2. Corner / Radius 체계

**분류:** 토큰화 중심 · **검사 범위:** Main + Add

### 평가 대상
- Surface
- Control
- Inner
- Card / Modal / Button / Input / Tooltip radius

### 평가 기준
- 역할별 radius token 체계가 존재하는가
- 같은 계층의 component가 임의 radius를 사용하지 않는가
- surface와 control의 corner 의미가 구분되는가
- 개별 component 미세값이 과도하게 남아 있지 않은가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 역할별 radius token | 25 |
| Surface / Control / Inner 구분 | 25 |
| 동일 계층 일관성 | 20 |
| 직접 radius 억제 | 15 |
| Corner mode / responsive 일관성 | 15 |
| **합계** | **100** |

### 필수 검사
- Main/Add CSS의 `border-radius` 전수 검색
- radius token 정의와 사용처 역추적
- surface/control/inner 계층별 직접값 분류
- rounded/soft-square mode override 확인
- responsive override가 canonical cap/token을 우회하는지 확인

### 항목 특이 판정
- 동일 역할 component에 근거 없는 서로 다른 직접 radius가 반복되면 해당 일관성 항목 MAJOR
- corner mode가 selector별 개별 override에 의존하면 mode 항목 MAJOR

### 대표 감점 요인
- 22px / 23px처럼 같은 역할에 불필요한 변형 존재
- component마다 radius 직접 지정
- radius 변경 시 다수 selector를 수정해야 함

### 허용 예외
- `0`
- `50%` 원형
- pill/circle shape
- 작은 swatch/marker처럼 독립 shape semantic이 명확한 값

# 3. Spacing / Density 체계

**분류:** 토큰화 중심 · **검사 범위:** Main + Add

### 평가 대상
- 카드 padding
- component gap
- KPI gap
- heading-content gap
- mini / normal density
- viewport별 density 단계

### 평가 기준
- 반복 spacing 값이 token화되어 있는가
- 카드 내부 상하좌우 padding의 의미가 일관적인가
- mini / normal / large density가 구분되는가
- Desktop → Tablet → Mobile compact 단계가 일관적인가
- 내부 content gap과 surface padding을 혼동하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Spacing token coverage | 25 |
| Surface padding 일관성 | 20 |
| Density hierarchy | 20 |
| Responsive density progression | 20 |
| magic spacing 억제 | 15 |
| **합계** | **100** |

### 필수 검사
- padding/gap/margin 주요 반복값 전수 검색
- spacing/density token 정의-사용 역추적
- 동일 card/KPI/mini 군 비교
- Desktop/Tablet/Mobile 단계별 값 비교
- 개별 margin 보정이 구조적 이유인지 확인

### 항목 특이 판정
- 동일 component군에서 근거 없는 padding 편차가 반복되면 일관성 MAJOR
- viewport별 임의 보정이 3곳 이상 반복되면 responsive 항목 MAJOR

### 대표 감점 요인
- 동일 component군에 서로 다른 padding
- viewport마다 임의 px 추가
- margin으로 레이아웃을 억지 보정
- spacing 변경 시 selector 다수를 따로 수정해야 함

### 허용 예외
- 광학 보정이 필요한 icon/text baseline
- 차트 plot geometry
- 브라우저 기본 control 보정
- 기능적 safe-area/viewport 대응

# 4. Card Surface

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 대상
- 일반 카드
- KPI 카드
- mini-card
- summary / large card

### 평가 기준
- 같은 역할의 카드가 공통 surface contract를 공유하는가
- background/border/radius/padding이 token을 따르는가
- feature별 별도 card shell 중복이 과하지 않은가
- card content와 surface 책임이 분리되어 있는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 공통 surface contract | 30 |
| token 적용 | 25 |
| feature 중복 억제 | 20 |
| content/surface 책임 분리 | 25 |
| **합계** | **100** |

### 필수 검사
- card/surface 계열 selector 전수 확인
- 동일 역할 card의 background/border/radius/padding 비교
- feature 전용 shell과 공통 shell 중복 여부 확인
- content layout rule이 surface primitive에 섞였는지 확인

### 항목 특이 판정
- 동일 card군의 surface CSS가 feature별 반복되면 중복 항목 MAJOR
- 공통 surface가 feature-specific 조건으로 비대해지면 책임 분리 MAJOR

### 대표 감점 요인
- card마다 독립 surface CSS 반복
- 동일 card군에서 padding/radius 차이
- feature 전용 shell이 사실상 동일한데 중복 유지

### 허용 예외
- Hero, modal, warning card 등 의미가 다른 surface
- Add의 독립 token 체계

# 5. Section Title / Heading

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 대상
- 메인 section title
- 하위 section title
- chart heading
- info heading

### 평가 기준
- icon/text/gap/alignment가 공통 primitive를 사용하는가
- heading row가 우측 control 상태에 따라 흔들리지 않는가
- 같은 hierarchy의 typography가 일관적인가
- title spacing이 component마다 따로 관리되지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Heading primitive 재사용 | 30 |
| typography hierarchy | 25 |
| icon/text/gap 정렬 | 25 |
| control 유무 geometry 안정성 | 20 |
| **합계** | **100** |

### 필수 검사
- section/subsection/chart/info heading selector 비교
- font-size/weight/line-height/gap source 확인
- 우측 control ON/OFF 상태의 DOM/CSS 구조 확인
- Add heading 체계 교차 확인

### 항목 특이 판정
- 같은 hierarchy가 3종 이상 개별 규칙이면 primitive 항목 MAJOR
- control 표시 때문에 row 높이/정렬이 구조적으로 바뀌면 geometry 항목 MAJOR

### 허용 예외
- Hero title
- modal title
- report 전용 heading처럼 hierarchy가 다른 경우

# 6. Icon + Label

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 기준
- icon size / baseline / text gap이 공통 규칙을 따르는가
- 같은 label hierarchy가 같은 typography를 사용하는가
- icon alignment를 개별 margin으로 맞추지 않는가
- 기능적으로 다른 icon까지 억지로 하나의 class에 합치지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| icon size/token 일관성 | 25 |
| label typography 일관성 | 25 |
| baseline/gap 공통화 | 25 |
| 의미 다른 icon 예외 보존 | 25 |
| **합계** | **100** |

### 필수 검사
- icon+label 조합 selector와 markup 검색
- icon 크기·vertical-align·gap 비교
- 개별 margin-top/left 보정 검색
- 기능적으로 다른 icon class가 억지 병합됐는지 확인

### 항목 특이 판정
- 동일 hierarchy에서 개별 icon 보정이 반복되면 baseline 항목 MAJOR
- 의미 다른 icon을 하나의 rigid primitive에 강제하면 예외 보존 항목 MAJOR

### 허용 예외
- 브랜드/종목 로고
- 상태 아이콘
- SVG viewBox 차이로 인한 국소 광학 보정

# 7. Button

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 대상
- 일반 action
- secondary
- chart
- modal
- 확대
- segmented action

### 평가 기준
- 높이/padding/radius/typography가 공통 primitive를 사용하는가
- hover/focus/disabled 상태가 일관적인가
- 동일 의미 button이 feature별 중복 CSS를 갖지 않는가
- button 위치 보정을 개별 margin/padding으로 해결하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Button primitive | 30 |
| token 적용 | 20 |
| interaction state | 25 |
| 개별 위치 보정 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- button class/selector 전수 확인
- height/padding/radius/typeography 비교
- hover/focus/disabled 상태 확인
- feature별 중복 button CSS 검색
- button에만 붙은 임의 margin/padding 보정 분류

### 항목 특이 판정
- 동일 의미 button이 feature별 독립 구현이면 primitive MAJOR
- focus/disabled 상태 누락은 interaction MAJOR

### 허용 예외
- icon-only button
- danger/destructive semantic variant
- native file/date control 버튼

# 8. Toggle / Switch / Segmented Control

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 대상
- ON/OFF
- 수익률/KOSPI
- 전체/계좌별
- 카드/표 보기

### 평가 기준
- 공통 visual grammar를 공유하는가
- active/inactive/focus 상태가 일관적인가
- viewport별로 component 자체가 달라지지 않고 배치만 조정되는가
- 동일 기능이 서로 다른 구현으로 중복되지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 공통 visual grammar | 30 |
| state 표현 | 25 |
| responsive 재사용 | 20 |
| 중복 구현 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- toggle/switch/segmented/tab 계열 selector와 DOM 확인
- active/inactive/focus/aria state 확인
- viewport별 DOM 교체 여부 확인
- 동일 기능의 별도 구현 수 확인

### 항목 특이 판정
- 같은 기능이 서로 다른 primitive 2개 이상으로 중복되면 중복 항목 MAJOR
- viewport마다 별도 DOM으로 갈라지면 responsive 항목 MAJOR

### 허용 예외
- native checkbox가 접근성/플랫폼 이유로 유지되는 경우
- Calc tab처럼 semantic role이 다른 control

# 9. Table 기본 Contract

**분류:** 공통화 중심 · **검사 범위:** Main + Add

### 평가 대상
- 숫자셀
- 텍스트셀
- 가운데 정렬셀
- header / body / summary

### 평가 기준
- 의미 기반 class를 사용하는가
- `nth-child()`에 과도하게 의존하지 않는가
- 숫자/텍스트/중앙 정렬 contract가 일관적인가
- 공통 table shell을 재사용하는가
- feature 계산과 table presentation이 분리되어 있는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| semantic cell contract | 30 |
| table shell 재사용 | 25 |
| position selector 억제 | 20 |
| presentation/계산 분리 | 25 |
| **합계** | **100** |

### 필수 검사
- table selector와 renderer/markup 전수 확인
- `.num`/text/center 등 semantic class 확인
- `nth-child`/위치 기반 selector 전수 검색
- summary/data/header 표현 비교
- renderer가 계산을 직접 소유하는지 확인

### 항목 특이 판정
- 열 의미를 `nth-child`에 주로 의존하면 position 항목 FAIL
- renderer가 feature 계산을 수행하면 책임 분리 MAJOR

### 대표 감점 요인
- 열 순서가 바뀌면 CSS가 깨지는 구조
- table마다 독립 padding/font/alignment 반복
- summary를 위치 기반 selector로만 처리

### 허용 예외
- print-only column width
- 고정 구조 legacy report table
- 접근성 `scope`/caption 관련 selector

# 10. Table Summary / Total Row

**분류:** 공통화 중심 · **검사 범위:** Main + Add

### 평가 기준
- 합계/총계/summary row의 weight와 hierarchy가 일관적인가
- 일반 데이터 행과 명확히 구분되는가
- 합계 value와 메모/secondary text의 weight가 적절히 분리되는가
- feature별 같은 summary를 별도 구현하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| summary hierarchy | 30 |
| weight/alignment 일관성 | 25 |
| secondary text 분리 | 20 |
| 중복 구현 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- summary/total/footer row selector 전수 확인
- font-weight/color/alignment 비교
- 메모/secondary 텍스트가 total weight를 상속하는지 확인
- Main/Add 각각 같은 역할의 중복 규칙 확인

### 항목 특이 판정
- 합계/총계가 일반행과 구분되지 않으면 hierarchy FAIL
- 메모까지 무조건 bold되는 반복 구조면 secondary 항목 MAJOR

### 허용 예외
- 법적/회계적 이유로 강조 hierarchy가 다른 특정 total

# 11. Asset Detail

**분류:** 공통화 중심 · **검사 범위:** Main

### 평가 대상
- 증권 / 퇴직연금 상세
- 상품행 / 현금행 / 합계행
- neutral View Model / renderer

### 평가 기준
- UI shell은 공통화되어 있는가
- 증권/연금 계산 로직은 feature에 유지되는가
- 현금/현금성자산의 semantic 차이는 보존되는가
- 같은 표현을 위해 계산 로직을 억지 통합하지 않았는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 공통 UI shell | 30 |
| neutral View Model | 25 |
| feature 계산 분리 | 30 |
| 현금 semantic 보존 | 15 |
| **합계** | **100** |

### 필수 검사
- 증권/퇴직연금 Asset Detail renderer 비교
- 공통 renderer/helper 사용 확인
- View Model 필드와 raw data 처리 위치 확인
- 현금/현금성자산 계산 포함·제외 규칙이 feature에 남는지 확인

### 항목 특이 판정
- 공통 renderer가 raw feature data를 직접 해석하면 View Model MAJOR
- 증권/연금 계산을 하나로 합치면 계산 분리 FAIL

### 허용 예외
- feature별 메모/상품명/현금 행 의미 차이

# 12. 성과 요약 / 계좌별 보기

**분류:** 공통화 중심 · **검사 범위:** Main

### 평가 기준
- 증권/퇴직연금 성과요약 shell이 일관적인가
- 전체/계좌별 전환이 중복 section이 아닌 상태 전환으로 처리되는가
- KPI visual grammar가 일관적인가
- 전체 합계와 계좌별 합계가 동일한 계산 contract를 사용하는가
- 별도수익 ON/OFF에서 layout 회귀가 없는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Overview shell 공통화 | 25 |
| KPI grammar | 25 |
| 전체/계좌별 state 전환 | 25 |
| 계산 정합성/레이아웃 안정성 | 25 |
| **합계** | **100** |

### 필수 검사
- 증권/연금 overview DOM/renderer 비교
- KPI class/token 비교
- 전체/계좌별이 duplicate section인지 state 전환인지 확인
- 별도수익 ON/OFF 및 합계 산식 source 확인

### 항목 특이 판정
- 동일 overview가 duplicate markup으로 병렬 유지되면 state 항목 MAJOR
- ON/OFF로 layout geometry가 깨지면 안정성 MAJOR

### 허용 예외
- 증권만 존재하는 계좌별 기능
- feature별 설명 문구

# 13. Mini Card

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 기준
- mini card군이 padding/radius/label/value/gap을 공유하는가
- 일반 card와 mini card density 차이가 명확한가
- feature별 mini-card 변형이 불필요하게 늘어나지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| mini-card primitive | 30 |
| density token | 25 |
| typography/gap | 20 |
| 변형 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- mini/small KPI card selector 전수 확인
- padding/radius/gap/label/value 비교
- viewport별 density 확인
- feature 전용 변형 수 확인

### 항목 특이 판정
- 동일 mini-card군에 3개 이상 독립 padding/radius가 있으면 primitive MAJOR

### 허용 예외
- interactive card
- warning/status mini surface
- report-only metric card

# 14. Empty State

**분류:** 공통화 중심 · **검사 범위:** Main + Add

### 평가 기준
- 빈 상태의 typography/alignment/spacing이 일관적인가
- 동일 목적의 empty state가 feature별 중복 구현되지 않는가
- 데이터 없음과 오류 상태를 혼동하지 않는가
- placeholder가 실제 layout을 왜곡하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Empty-state primitive | 30 |
| typography/alignment | 25 |
| data-empty vs error 구분 | 25 |
| layout 비왜곡 | 20 |
| **합계** | **100** |

### 필수 검사
- empty/no-data/placeholder/error 렌더 검색
- 관련 selector 비교
- error와 empty 메시지 경로 확인
- placeholder가 높이 확보용으로 남는지 확인

### 항목 특이 판정
- error와 empty를 같은 상태로 처리하면 상태 구분 FAIL
- empty state 때문에 layout용 dummy DOM이 반복되면 layout MAJOR

### 허용 예외
- skeleton/loading
- preview/sample 상태

# 15. Tooltip

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 대상
- info
- chart
- asset visualization
- account memo
- Market AI

### 평가 기준
- surface/typography/radius/shadow가 공통 grammar를 사용하는가
- tooltip lifecycle과 feature content 책임이 분리되는가
- chart tooltip과 일반 UI tooltip을 무리하게 하나로 합치지 않는가
- keyboard/focus/aria 연계가 필요한 tooltip에서 보존되는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| visual grammar | 25 |
| lifecycle 책임 | 25 |
| 접근성/interaction | 25 |
| feature 예외 분리 | 25 |
| **합계** | **100** |

### 필수 검사
- tooltip selector/renderer 전수 확인
- surface/token 비교
- hover/focus/dismiss/aria 흐름 확인
- chart tooltip과 info tooltip lifecycle 비교
- Add tooltip 존재 시 동일 검토

### 항목 특이 판정
- keyboard 접근이 필요한 tooltip이 hover-only면 accessibility MAJOR
- feature data 계산을 generic tooltip이 소유하면 책임 MAJOR

### 허용 예외
- SVG chart tooltip
- native `title` fallback
- pointer-follow tooltip

# 16. Modal Surface

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main

### 평가 기준
- backdrop/panel/header/body/footer/close가 공통 primitive를 사용하는가
- focus trap / ESC / focus return / body lock / inert가 공통 lifecycle로 처리되는가
- modal별 업무 로직은 feature에 남아 있는가
- modal별 open/close 코드가 중복되지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Modal surface primitive | 25 |
| 공통 lifecycle | 30 |
| 접근성/focus | 25 |
| business 책임 분리 | 20 |
| **합계** | **100** |

### 필수 검사
- 모든 modal/dialog open/close 경로 검색
- dashboard-modal canonical 함수 사용 확인
- ESC/focus trap/return/inert/body lock 확인
- feature save/delete/state가 modal module에 섞였는지 확인

### 항목 특이 판정
- modal별 lifecycle 중복이 반복되면 lifecycle MAJOR
- feature persistence가 modal module로 이동하면 책임 분리 FAIL

### 허용 예외
- native confirm/alert를 의도적으로 사용하는 단순 경고

# 17. Action Form

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 대상
- input / select / date / numeric
- label / helper / validation / action area

### 평가 기준
- 공통 control primitive를 사용하는가
- validation state와 normal state가 일관적인가
- 업무 validation/persistence를 generic form layer가 소유하지 않는가
- browser/mobile 예외를 공통화 때문에 제거하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Form primitive | 25 |
| control token/density | 25 |
| validation state | 25 |
| business 책임 분리 | 25 |
| **합계** | **100** |

### 필수 검사
- input/select/date/number/label/helper selector 비교
- validation/error class 확인
- Main pension/KRX와 Add Calc form 교차 확인
- 저장/계산 로직이 generic form helper에 들어갔는지 확인

### 항목 특이 판정
- 동일 control이 feature별 독립 높이/padding을 반복하면 token 항목 MAJOR
- generic form이 persistence를 소유하면 책임 FAIL

### 허용 예외
- browser native date appearance
- PIN masking
- 특수 numeric formatting

# 18. Date Selector / Input Density

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 기준
- 날짜/select/input control의 높이·padding·vertical alignment가 일관적인가
- native date picker 동작이 viewport/browser 특성과 충돌하지 않는가
- 같은 control에 임의 top/bottom padding 보정이 남아 있지 않은가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| control height | 25 |
| padding/vertical alignment | 25 |
| native picker 호환 | 25 |
| 개별 보정 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- date/select/input 관련 CSS 전수 비교
- line-height/padding/appearance 확인
- mobile/native date 예외 확인
- top/bottom 보정 selector 검색

### 항목 특이 판정
- 같은 control군 높이가 이유 없이 다르면 height MAJOR
- desktop calendar/mobile native 동작이 깨지면 picker FAIL

### 허용 예외
- iOS 확대 방지
- browser-specific date indicator
- inputmode 차이

# 19. Chart Card

**분류:** 공통화 + 토큰 적용 · **검사 범위:** Main + Add

### 평가 기준
- chart surface/header/title/legend/control/plot 구조가 공통 grammar를 따르는가
- chart마다 header height/padding이 불필요하게 다르지 않은가
- 확대/토글/legend의 위치를 개별 margin으로 보정하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Chart card structure | 30 |
| header/legend/control grammar | 25 |
| spacing token | 20 |
| 개별 보정 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- Main chart card와 Add Report chart surface 비교
- header/title/legend/control selector 확인
- padding/gap source 확인
- chart별 margin-top/right 보정 검색

### 항목 특이 판정
- 동일 chart군 header geometry가 반복 분기되면 grammar MAJOR

### 허용 예외
- expanded chart
- single-purpose compact sparkline
- print chart

# 20. Chart Plot Margin

**분류:** 토큰화 중심 · **검사 범위:** Main + Add

### 평가 대상
- SVG left/right/top/bottom margin

### 평가 기준
- chart별 magic number가 제거되었는가
- 축 유무와 관계없이 plot geometry가 일관적인가
- plot margin이 공통 기준값/계산식으로 관리되는가
- viewport별 예외가 최소화되어 있는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 공통 plot margin source | 30 |
| magic number 억제 | 25 |
| axis 유무 geometry | 25 |
| responsive 예외 최소화 | 20 |
| **합계** | **100** |

### 필수 검사
- 모든 chart의 plot padding/margin 상수 검색
- Main chart 계산식 역추적
- Add Report chart가 별도 라이브러리면 해당 plot contract 확인
- 좌/우축 유무 시 plot start/end 비교
- viewport override 검색

### 항목 특이 판정
- chart별 독립 magic margin이 반복되면 source 항목 MAJOR
- 좌우축 유무로 plot 폭이 달라지면 geometry MAJOR

### 허용 예외
- 라이브러리 내부 자동 margin
- legend/title 공간
- expanded/fullscreen 전용 margin

# 21. Chart Axis / Zero Alignment

**분류:** 로직/상태 공통화 · **검사 범위:** Main

### 평가 기준
- dual-axis 0선이 일치하는가
- auto Y range 계산이 공통 로직을 사용하는가
- ON/OFF 또는 series toggle에 따라 축이 불필요하게 흔들리지 않는가
- 실제 데이터 범위를 과도하게 낭비하지 않는가
- 특정 chart만 별도 축 계산식을 갖지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 0선 정렬 | 25 |
| 공통 Y-range 로직 | 30 |
| state 안정성 | 25 |
| 공간 효율 | 20 |
| **합계** | **100** |

### 필수 검사
- dual-axis 계산 함수 역추적
- 전체 series/ON-OFF 범위 입력 확인
- 0선 좌표 계산 대조
- 토글/범례 변경 시 range 재계산 조건 확인
- 실데이터 극값으로 clipping/낭비 계산

### 항목 특이 판정
- dual-axis 0선 불일치면 0선 항목 FAIL
- ON/OFF마다 축이 불필요하게 흔들리면 state MAJOR
- data clipping은 range 항목 FAIL

### 허용 예외
- 의도된 fixed axis
- 단일축 chart

# 22. Chart Legend / Selection State

**분류:** 로직/상태 공통화 · **검사 범위:** Main

### 평가 기준
- 다중선택
- 최소 1개 선택
- 전체선택
- 확대 후 상태 유지
- mode 전환

이 동일 state contract를 공유하는가.

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| selection contract | 30 |
| 최소 1개/전체선택 | 25 |
| expanded state 유지 | 25 |
| mode 전환 일관성 | 20 |
| **합계** | **100** |

### 필수 검사
- legend state source 검색
- 모든 chart handler 비교
- 최소1개 guard 확인
- 확대/축소 시 state source 확인
- 수익률/KOSPI mode와 selection interaction 확인

### 항목 특이 판정
- chart마다 별도 incompatible state 구현이면 contract MAJOR
- expanded에서 state reset이면 유지 항목 FAIL

### 대표 감점 요인
- chart마다 별도 selection 구현
- 확대/축소 시 state reset
- 최소 1개 규칙이 component마다 다름

### 허용 예외
- 단일-series chart
- 선택 자체가 없는 chart

# 23. Responsive Density

**분류:** 토큰화 + 반응형 공통화 · **검사 범위:** Main + Add

### 평가 기준
- Desktop / Tablet / Mobile density 단계가 일관적인가
- spacing/card/KPI density가 같은 방향으로 compact해지는가
- 임의 breakpoint와 임의 px 보정이 늘어나지 않는가
- component별 responsive density가 서로 어긋나지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 3단계 density contract | 30 |
| spacing/card/KPI 방향성 | 25 |
| breakpoint discipline | 25 |
| component 간 일관성 | 20 |
| **합계** | **100** |

### 필수 검사
- Desktop/Tablet/Mobile media 전수 확인
- Main/Add의 padding/gap/font density 비교
- 임의 breakpoint 검색
- 같은 viewport에서 component별 density 역전 여부 확인
- public runtime 가능 시 대표 폭 대조

### 항목 특이 판정
- 근거 없는 추가 breakpoint가 반복되면 discipline MAJOR
- Mobile이 Desktop보다 더 넓은 padding 등 방향성 역전 반복 시 일관성 MAJOR

### 허용 예외
- 기능성 phone landscape
- ≤400px 정보 재배치
- print media

# 24. Phone Portrait / Landscape

**분류:** 반응형 공통화 · **검사 범위:** Main

### 평가 기준
- landscape가 별도 앱처럼 분리되지 않고 mobile family로 유지되는가
- topbar/table/chart control/typography가 portrait와 의미적으로 일관적인가
- touch/height 조건이 필요한 기능성 예외만 존재하는가
- desktop media와 충돌하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| mobile family 유지 | 30 |
| topbar/table/chart 일관성 | 25 |
| 기능성 landscape 예외 | 25 |
| desktop media 충돌 방지 | 20 |
| **합계** | **100** |

### 필수 검사
- portrait/mobile과 landscape media 비교
- topbar DOM/CSS 확인
- table/font/control 차이 확인
- hover:none/height 조건 확인
- desktop/tablet media 우선순위 확인

### 항목 특이 판정
- landscape가 별도 desktop UI로 변하면 family FAIL
- desktop media와 충돌해 중복 적용되면 충돌 MAJOR

### 허용 예외
- 가로에서 공간상 제거되는 chart 보조버튼
- safe-area/height 제약

# 25. Tablet

**분류:** 반응형 공통화 + 토큰 적용 · **검사 범위:** Main

### 평가 기준
- Desktop/Mobile 사이의 중간 density로 자연스럽게 동작하는가
- Tablet 전용 arbitrary component가 과도하게 존재하지 않는가
- hamburger/KPI/card/chart 등이 공통 token과 primitive를 재사용하는가
- 761~1100 기본 구간이 유지되는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 761~1100 구간 유지 | 25 |
| 중간 density | 25 |
| 공통 primitive 재사용 | 25 |
| Tablet 전용 중복 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- tablet.css와 관련 media 확인
- KPI/card/topbar/chart density 비교
- mobile/desktop primitive class 재사용 확인
- tablet-only component/markup 검색

### 항목 특이 판정
- 새 arbitrary breakpoint로 tablet 의미가 분할되면 구간 항목 MAJOR
- tablet-only duplicate component가 반복되면 중복 MAJOR

### 허용 예외
- hamburger 전환
- tablet에서만 필요한 column count

# 26. Topbar / Navigation

**분류:** 공통화 중심 · **검사 범위:** Main

### 평가 기준
- 년월/일/테마/hamburger/navigation control이 일관된 primitive를 사용하는가
- Desktop/Tablet/Mobile 역할 차이가 명확한가
- topbar height/alignment가 state에 따라 흔들리지 않는가
- viewport별 중복 markup이 최소화되어 있는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 공통 control primitive | 25 |
| viewport 역할 분리 | 25 |
| geometry 안정성 | 25 |
| markup 중복 억제 | 25 |
| **합계** | **100** |

### 필수 검사
- topbar/nav DOM 확인
- year/month/day/theme/hamburger selector 비교
- Desktop/Tablet/Mobile visibility rule 확인
- state 전환 시 row height 영향 확인
- viewport별 duplicate markup 검색

### 항목 특이 판정
- 동일 control이 viewport별 별도 markup으로 반복되면 중복 MAJOR
- state에 따라 topbar 높이가 흔들리면 geometry MAJOR

### 허용 예외
- 접근성상 필요한 duplicate label
- desktop-only TOC vs mobile hamburger

# 27. Source / Ledger / Symbol 예외

**분류:** 예외/불변조건 정리 · **검사 범위:** Main

### 평가 기준
- 의미가 다른 component를 외형이 비슷하다는 이유로 억지 공통화하지 않는가
- 공통 primitive는 재사용하되 고유 semantic은 유지되는가
- 예외가 근거 없이 늘어나지 않는가
- 예외를 수정할 때 generic contract를 훼손하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 예외 semantic 타당성 | 30 |
| 공통 primitive 재사용 | 25 |
| 예외 수 통제 | 20 |
| generic contract 보호 | 25 |
| **합계** | **100** |

### 필수 검사
- Source/Ledger/Symbol 관련 selector와 renderer 확인
- 공통 surface/table/token 재사용 여부 확인
- 예외 selector 수와 사유 확인
- 예외가 generic selector를 override해 다른 영역에 leakage하는지 확인

### 항목 특이 판정
- 의미 차이 없이 예외가 누적되면 예외 수 항목 MAJOR
- 예외 수정이 generic contract를 깨면 보호 항목 FAIL

### 허용 예외
- 실제 semantic/시각 역할이 다른 Source/Ledger/Symbol 고유 표현

# 28. Account / Portfolio 표현

**분류:** 공통화 중심 · **검사 범위:** Main

### 평가 기준
- 투자 결과물/투입원금/누적손익/메모의 hierarchy가 일관적인가
- summary/detail의 visual grammar가 공통화되어 있는가
- 숫자/텍스트 정렬 contract가 table/card 양쪽에서 일관적인가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| visual hierarchy | 25 |
| summary/detail grammar | 25 |
| 정렬 contract | 25 |
| 메모/secondary 일관성 | 25 |
| **합계** | **100** |

### 필수 검사
- 투자결과물/투입원금/누적손익/메모 renderer와 CSS 비교
- card/table 숫자 정렬 확인
- summary/detail typography 비교
- 모바일/계좌별 표현 대조

### 항목 특이 판정
- 같은 의미 값이 card/table에서 반대 정렬이면 정렬 MAJOR
- summary hierarchy가 계좌별마다 다르면 grammar MAJOR

### 허용 예외
- 메모는 regular weight 등 semantic 차이

# 29. 전일 대비 변동 표현

**분류:** 공통화 중심 · **검사 범위:** Main

### 평가 기준
- 증권/퇴직연금의 전일종가/당일종가/일변동/등락률 의미가 동일한가
- 동일 포맷과 semantic class를 사용하는가
- 좁은 화면에서도 정보 의미가 유지되는가
- 특정 viewport 표현 변경이 다른 viewport로 leakage되지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| 의미/포맷 통일 | 30 |
| semantic class/renderer | 25 |
| narrow layout 의미 보존 | 25 |
| viewport leakage 방지 | 20 |
| **합계** | **100** |

### 필수 검사
- 증권/연금 변동표 renderer 비교
- 전일/당일/일변동/% 포맷 함수 확인
- ≤400px CSS/DOM 확인
- 401px 이상 leakage 여부 정적 확인
- runtime 가능 시 대표 폭 확인

### 항목 특이 판정
- 증권/연금 계산 의미가 다르면 통일 항목 FAIL
- ≤400px 변경이 상위 viewport에 새면 leakage FAIL

### 허용 예외
- 현금/현금성자산의 계산 포함 여부 차이

# 30. Market AI Frontend Surface

**분류:** 공통화 중심 + 책임 분리 · **검사 범위:** Main

### 평가 기준
- 메인 card/modal/tooltip primitive를 재사용하는가
- 현재 시장·AI Signal panel의 polling/state/snapshot/signal render는 `dashboard-market-ai.js` standalone이 소유하고, KST 오늘 및 제한된 직전 완료 거래일 보유종목 평가 overlay는 `dashboard-live-valuation.js`가 별도 소유하는가
- standalone Signal panel이 main `dataState/uiState`에 직접 결합하지 않으며, live valuation만 `dataState.liveValuation`의 휘발성 계산 입력을 사용하는 책임 경계를 지키는가
- Snapshot / Signal / KIS Bridge 실패를 격리하는가
- 환경과 무관하게 실제 endpoint 응답이 확인되기 전 Market AI UI를 mount하지 않고, 전체 연결 실패 시 panel·button·dialog를 제거한 채 `OFFLINE`으로 종료하는가
- 전체 연결 실패는 `OFFLINE`으로 종료해 panel을 제거하고 자동 polling을 멈추며, 사용자 재시도 전까지 서버 요청을 반복하지 않는가
- display logic과 Signal 계산 책임이 분리되어 있는가
- live valuation은 backend `usable/state/market_state/source`를 소비할 뿐 durable DB 복구 조건을 frontend에서 재계산하지 않는가. 장마감 `closed + usable`은 허용하되 unusable 종목은 개별 JSON fallback하는가
- embedded `실시간 시세` Monitor는 read-only iframe 관찰면으로 유지되어 Dashboard live valuation `client_id` lease를 생성·연장하지 않는가
- SOX 표시와 Signal 입력이 모두 `INDEX:SOX` contract를 유지하며 `SOX-F` 또는 `FUTURES:SOX`로 임의 전환되지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| main primitive 재사용 | 20 |
| standalone state | 25 |
| 실패 격리 | 20 |
| display/Signal 책임 분리 | 20 |
| main state 비결합 | 15 |
| **합계** | **100** |

### 필수 검사
- dashboard-market-ai.js / dashboard-live-valuation.js import graph와 책임 경계 확인
- standalone Market AI의 main dataState/uiState 직접 참조 검색; `dataState.liveValuation`은 live valuation adapter의 휘발성 입력 예외인지 확인
- modal/tooltip/card primitive 사용 확인
- polling endpoint별 error handling과 latest-wins 확인
- 초기 미연결·전체 연결 실패·사용자 재연결 시 UI mount/remove/polling 흐름 확인
- 전체 연결 실패 시 `OFFLINE` 종료·UI 제거·자동 polling 중단 확인
- Preview/sample 실행 경로가 재도입되지 않았는지 확인
- live valuation의 `usable:true` 소비·종목별 JSON fallback·closed durable 소비가 backend 판정을 그대로 따르는지 확인
- embedded Monitor 경로가 `quote-universe` read-only 관찰면이며 Dashboard client lease와 분리되는지 확인
- SOX 표시와 Signal 입력이 모두 `INDEX:SOX`를 사용하는지 확인

### 항목 특이 판정
- main feature state 직접 결합 시 비결합 FAIL
- Signal 계산 또는 durable quote 승격 조건을 frontend display 로직이 재해석하면 책임 분리 FAIL
- 연결 확인 전 빈 Market AI UI를 노출하거나 전체 실패 후에도 자동 polling을 계속하면 실패 격리 항목 MAJOR
- Preview/sample 실행 경로 또는 SOX-F 자동 전환이 재도입되면 display/Signal 책임 분리 항목 MAJOR

### 허용 예외
- standalone 전용 polling/cache/state
- `dataState.liveValuation`의 휘발성 screen-only quote snapshot 사용

# 31. Add Calc UI

**분류:** 토큰화 + 공통화 · **검사 범위:** Add

### 평가 기준
- add 내부 surface/control/input/button/radius/spacing이 자체 token 체계를 사용하는가
- main과 비슷하다는 이유로 강제 공유하지 않는가
- Calc layout과 common primitive 책임이 분리되는가
- 접근성 label/tab/tooltip contract가 유지되는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| Add 자체 token·독립성 | 25 |
| Calc primitive 공통화 | 25 |
| layout/primitive 책임 분리 | 25 |
| 접근성 contract | 25 |
| **합계** | **100** |

### 필수 검사
- `add/add.css`의 공통 token/primitive와 `data-add-page="calc"` scope 전수 확인
- `add/add.css`의 Shared 영역과 Calc 전용 layout 책임 비교
- input/button/card selector 중복 확인
- `calc.html`과 `add/add.js`의 label/tab/tooltip 및 선택상태 ARIA 확인
- `add/add.js`의 Calc boot·계산 engine·render/event 책임 경계 확인
- 메인 CSS 강제 의존성 여부 확인

### 항목 특이 판정
- 메인 CSS에 직접 의존하면 Add 자체 token·독립성 항목 MAJOR
- `data-add-page="calc"` scope가 Shared primitive를 대량 재정의하면 Calc primitive 공통화 항목 MAJOR
- Calc 전용 layout 규칙이 Shared primitive에 섞여 Report까지 누출되면 layout/primitive 책임 분리 항목 MAJOR

### 허용 예외
- Add가 메인과 별도 token 파일을 갖는 것 자체
- Calc 전용 layout

# 32. Add Report

**분류:** 공통화 중심 · **검사 범위:** Add

### 평가 기준
- KPI/table/chart/timeline/card의 visual grammar가 일관적인가
- 동일 metric이 숫자와 chart에서 같은 계산 source를 사용하는가
- responsive에서 날짜/순서/수치 의미가 사라지지 않는가
- canonical report 한 파일 원칙이 유지되는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| visual grammar | 25 |
| 동일 metric single source | 30 |
| responsive 의미 보존 | 25 |
| canonical report 원칙 | 20 |
| **합계** | **100** |

### 필수 검사
- `add/kodex-leverage-report.html`과 공통 runtime인 `add/add.css` / `add/add.js` 확인
- KPI/table/chart/timeline metric 계산 source 추적
- 모바일에서 날짜/순서/수치 식별 가능성 확인
- 날짜형/병렬 report 파일 존재 여부 확인
- runtime 가능 시 Add Report URL 확인

### 항목 특이 판정
- 같은 metric이 화면 위치별 다른 계산식을 쓰면 single source FAIL
- canonical 외 병렬 report가 운영본으로 존재하면 canonical MAJOR

### 허용 예외
- 증권사 원본 이미지의 고정 과거 수치
- 설명용 caption

# 33. JavaScript Common Helper

**분류:** 구조/책임 정리 · **검사 범위:** Main

### 평가 기준
- `dashboard-core.js`가 DOM-free인가
- `dashboard-ui-common.js`가 presentation helper 책임만 갖는가
- feature → common dependency 방향이 유지되는가
- common → feature 역방향 import가 없는가
- helper가 무분별한 misc dumping ground가 되지 않는가
- global/window bridge가 재등장하지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| core DOM-free | 20 |
| ui-common 책임 | 20 |
| dependency direction | 25 |
| helper 응집도 | 20 |
| global bridge 부재 | 15 |
| **합계** | **100** |

### 필수 검사
- dashboard-core.js DOM/window/document 검색
- dashboard-ui-common.js import/export 확인
- 전체 ES module import graph 생성
- common→feature 역방향 import 검색
- window/global assignment 검색
- helper 함수 책임 샘플/전수 분류

### 항목 특이 판정
- core가 DOM 접근하면 core 항목 FAIL
- common→feature cycle/역참조면 dependency FAIL
- global bridge 재등장 시 해당 항목 MAJOR

### 허용 예외
- browser capability check가 UI-common에 존재
- 명시적 public integration hook

# 34. Modal Lifecycle Module

**분류:** 구조/책임 정리 + 공통화 · **검사 범위:** Main

### 평가 기준
- modal lifecycle이 `dashboard-modal.js` 등 canonical module에 모여 있는가
- open/close/ESC/focus/inert/body lock이 중복 구현되지 않는가
- feature별 business state/persistence는 modal module로 넘어오지 않는가
- modal 공통화가 feature coupling을 만들지 않는가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| canonical lifecycle module | 30 |
| 중복 제거 | 20 |
| focus/inert/body lock | 25 |
| feature 책임 분리 | 25 |
| **합계** | **100** |

### 필수 검사
- dashboard-modal.js API 확인
- 모든 dialog의 open/close 호출처 검색
- ESC/backdrop/focus trap 구현 중복 검색
- feature save/delete/polling이 modal module에 없는지 확인

### 항목 특이 판정
- modal별 독립 lifecycle 반복 시 중복 MAJOR
- business persistence가 modal module에 있으면 책임 분리 FAIL

### 허용 예외
- 아주 단순한 native confirm
- non-modal popover

# 35. 표현 공통화와 계산 책임 분리

**분류:** 아키텍처 불변조건 · **검사 범위:** Main + Add

### 핵심 원칙
- **모양이 같으면 표현은 공통화할 수 있다.**
- **계산이 다르면 feature별로 유지한다.**
- **state가 다르면 feature별로 유지한다.**
- **persistence가 다르면 feature별로 유지한다.**
- neutral View Model / presentation layer까지만 공통화하고 업무 계산까지 억지로 합치지 않는다.

### 평가 기준
- 공통화가 presentation layer에 머무르는가
- feature 계산식이 generic helper 안으로 침범하지 않는가
- 같은 UI를 이유로 데이터 contract까지 합쳐지지 않는가
- 공통 component가 feature별 조건문으로 비대해지지 않는가
- 새 기능 추가 시 common layer 수정이 과도하게 필요한 구조가 아닌가

### 고정 배점
| 세부 항목 | 배점 |
|---|---:|
| presentation 공통화 경계 | 25 |
| 계산 feature 소유 | 25 |
| state/persistence feature 소유 | 25 |
| common layer 비대화 방지 | 25 |
| **합계** | **100** |

### 필수 검사
- 공통 renderer/helper가 raw feature data를 해석하는지 검색
- 계산 함수 위치와 import graph 확인
- state/persistence owner 확인
- common module의 feature-specific 조건문 검색
- Add가 메인 계산/상태에 결합되지 않는지 확인

### 항목 특이 판정
- 계산을 공통화 명분으로 합치면 계산 소유 FAIL
- state/persistence가 generic common으로 이동하면 소유 FAIL
- common이 feature-specific 분기 저장소가 되면 비대화 MAJOR

### 허용 예외
- neutral View Model
- format/date/math 같은 순수 helper
- 공통 modal lifecycle

# 36. 카테고리 분류

| 카테고리 | 항목 |
|---|---|
| 순수 토큰화 | 1, 2, 3, 20 |
| 공통화 + 토큰 적용 | 4, 5, 6, 7, 8, 13, 15, 16, 17, 18, 19, 23, 25, 31 |
| Component / 표현 공통화 | 9, 10, 11, 12, 14, 26, 28, 29, 30, 32 |
| 로직 / 상태 공통화 | 21, 22 |
| Responsive 공통화 | 23, 24, 25 |
| 구조 / 책임 / Architecture | 27, 30, 33, 34, 35 |

23, 25, 30은 성격상 여러 카테고리에 포함될 수 있다. 카테고리 분석용 중복일 뿐 영역 전체 평균에서는 번호당 한 번만 반영한다. Main 카테고리와 Add 카테고리는 별도로 계산한다.

# 37. 금지사항과 문서 유지관리

- 고정 배점 대신 평가자가 임의로 `-2점`, `-7점` 같은 별도 감점표를 만들지 않는다.
- Main+Add 항목을 평균내 하나의 점수로 만들지 않는다.
- 한 영역의 결함을 다른 영역 점수에 전가하지 않는다.
- token/class/helper 개수나 파일 수 자체를 품질로 평가하지 않는다.
- 공통화를 이유로 계산·state·persistence 책임을 generic common layer로 이동시키지 않는다.
- 이미 안정적인 구조를 더 공통화하기 위한 리팩터링을 권하지 않는다.
- 실제 소스 근거 없이 현재 동작을 추정하지 않는다.

이 문서는 **35개 평가 항목, 고정 배점, 항목별 장기 판정 기준이 바뀔 때만 수정**한다. 단순 CSS/JS 수정, 특정 버그·viewport 조정, QA PASS, 특정 수치 변화, 과거 작업 이력은 누적하지 않는다. 전역 평가 방법론과 A/B/C·100점·종료 기준은 `dashboard_evaluation_guide.md`에서만 관리한다.
