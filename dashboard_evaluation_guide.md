# 투자 대시보드 평가 기준

> 이 문서는 사용자가 `점수`, `평가`, `평가해줘`라고 요청했을 때 **무엇을 어느 깊이까지 확인하고, 어떤 근거로 점수와 A/B/C를 산정할지** 정의하는 평가 전용 기준서다.  
> 기능 구현·수정 절차는 handover, 실제 상태는 최신 소스, 공통화 35개 항목은 `ct35_evaluation.md`가 Source of Truth다.

---

## 1. 평가 명령과 기본 범위

### 1.1 `점수` / `점수만`

최신 실제 소스를 필요한 범위에서 확인한 뒤 점수 중심으로 간결하게 출력한다.

```text
CSS
JavaScript
UI
UX
UI/UX 총점
전체 총점
```

- 과거 점수를 복사하지 않는다.
- 파일을 수정하지 않는다.
- 자동 테스트 PASS만 보고 점수를 정하지 않는다.

### 1.2 `평가` / `평가해줘`

기본적으로 **예전 상세 평가 수준**으로 수행한다.

```text
최신 실제 소스와 범위 확인
→ 프로젝트/기능 inventory
→ 자동·정적 검증
→ CSS / JS / UI / UX 상세 평가
→ 실제 화면영역·사용자 flow 평가
→ 필요 시 CT35 Main/Add 평가
→ A/B/C 분류
→ 점수와 종료 판단
```

단순히 `테스트 PASS → 98점`처럼 끝내지 않는다. **왜 그 점수인지 실제 함수·module·selector·상태전이·계산 근거를 대표적으로 제시**한다.

### 1.3 범위 지정

사용자가 **전체 프로젝트 ZIP을 첨부하고 별도 제한 없이 `평가해줘`**라고 하면 기본 범위는 **Main + Add(Calc/Report)**다. 이 경우 CT35의 Main+Add 항목도 두 영역을 모두 확인한다. GAS와 별도 Market AI backend는 명시 요청이 있거나 현재 결함 판정에 직접 필요한 경우에만 별도 평가한다.

사용자가 지정한 범위를 우선한다.

예:

- `Main만 평가`
- `Add만 평가`
- `Calc 평가`
- `Report 평가`
- `GAS 제외`
- `CSS만 평가`
- `월간손익 모달만 평가`
- `수정한 부분만 다시 평가`

ZIP 안에 파일이 있다는 이유만으로 GAS·Add·Main을 전부 강제 평가하지 않는다. 다만 요청 범위의 판정에 필요한 shared dependency나 cross-contract는 필요한 만큼 함께 확인한다.

### 1.4 평가와 QA는 다르다

- **평가:** 현재 품질을 독립적으로 판정한다. 점수/A/B/C/구조/UI/UX가 목적이다.
- **QA:** 직전 수정으로 인한 회귀 여부를 확인한다. 변경 영향 범위와 현재 revision이 목적이다.

수정 직후 QA를 과거 배포본으로 대신하지 않는다.

---

## 2. Source of Truth

| 확인 대상 | 우선 Source of Truth |
|---|---|
| 현재 실제 구현 | 사용자가 제공한 최신 HTML/CSS/JS/data/scripts/workflows/tests |
| Main 장기 contract | `main_dashboard_maintenance_handover.md` |
| Add 장기 contract | `add_maintenance_handover.md` |
| 공통화·토큰화 35항목 | `ct35_evaluation.md` |
| 평가 방식·점수·A/B/C | `dashboard_evaluation_guide.md` |
| 프로젝트 개요 | `README.md` |
| 과거 변경 이력 | Git history |

문서와 코드가 다르면 무조건 코드를 문서에 맞추지 않는다.

```text
실제 구현 확인
→ 장기 contract 확인
→ 코드 회귀인지 문서 노후화인지 구분
→ 실행 결함과 문서 결함을 따로 기록
```

문서 오류를 CSS/UI 점수에 억지로 섞지 않는다. 단, 운영을 잘못 유도하는 심각한 문서 오류는 A/B로 별도 기록할 수 있다.

---

## 3. 평가 보호 원칙

평가자는 **실제 문제를 찾는 것**이 목적이지, 100점을 피하기 위해 문제를 만드는 것이 목적이 아니다.

### 3.1 감점하지 않는 것

실제 사용자 영향이나 contract 위반이 확인되지 않는 한 다음만으로 감점하지 않는다.

- 파일 길이·줄 수·파일 개수
- Vanilla JS 사용
- framework/state library 미사용
- 테스트 개수의 많고 적음
- 대형 lint/test framework 부재
- 전체 dashboard `render()` 방식 자체
- `Date.now()` cache bust 자체
- browser/native control 차이
- 기능성 `!important`, media query, 긴 selector
- one-use literal 또는 page-specific 값
- Main과 Add가 서로 다른 runtime/CSS를 유지하는 것 자체
- Market AI backend가 첨부되지 않았거나 현재 연결되지 않는 것 자체

### 3.2 이미 의도된 trade-off

현재 handover가 의도된 설계로 명확히 규정하고 실제 문제가 없는 항목은 반복 개선안으로 만들지 않는다.

예:

- PIN 입력의 browser password-manager 회피 구현
- private gesture처럼 의도적으로 discoverability가 낮은 기능
- native `<select>`/date picker rendering
- Main/Add의 의도된 runtime 분리

### 3.3 새 결함을 제시할 최소 근거

최소 하나가 있어야 한다.

- 재현 가능한 bug
- 계산·표시값 불일치
- 현실적인 상태전이에서 기능 failure
- cascade/responsive 회귀
- 접근성 오류
- 사용자 혼란·복구 어려움
- 측정된 성능 병목
- 운영을 잘못 유도하는 문서/contract 오류

다음 식의 판정은 금지한다.

```text
"완벽할 수 없으니 99점"
"가능성은 있으니 B급"
"파일이 길어서 감점"
"테스트가 적어서 감점"
"더 예쁘게 정리할 수 있어서 감점"
```

---

## 4. 점수 체계

### 4.1 CSS /100

| 축 | 비중 | 핵심 질문 |
|---|---:|---|
| 구조 / 파일 책임 | 12 | rule이 소유 영역에 응집되어 있는가 |
| Token / Variable / 공통화 | 12 | 반복 semantic이 적절히 공통화되는가 |
| Cascade / Specificity | 12 | source-order와 override가 설명 가능하고 안전한가 |
| Responsive | 14 | Desktop/Tablet/Phone 및 기능성 예외가 충돌하지 않는가 |
| Theme / 색상 | 10 | Light/Dark semantic parity가 유지되는가 |
| Interaction / State CSS | 10 | hover/focus/active/disabled/open 상태가 일관적인가 |
| Component 일관성 | 10 | 같은 역할 component의 visual contract가 유지되는가 |
| Dead / Legacy / Fallback | 8 | 실제 미사용인지 dynamic/print 경로까지 확인했는가 |
| Print / 특수환경 | 5 | 존재하는 print contract가 정상인가 |
| 유지보수성 / 회귀위험 | 7 | 작은 변경이 불필요하게 여러 selector를 건드리지 않는가 |

### 4.2 JavaScript /100

| 축 | 비중 | 핵심 질문 |
|---|---:|---|
| Module responsibility / API | 12 | module 경계와 public API가 명확한가 |
| Dependency graph | 8 | cycle·역방향 dependency가 없는가 |
| State ownership | 12 | 동일 state의 owner가 하나로 설명되는가 |
| Rendering / DOM lifecycle | 10 | render/mount/unmount 책임이 안정적인가 |
| Event / listener ownership | 8 | 중복 listener·해제 누락·재진입 문제가 없는가 |
| Async / race / stale state | 14 | 늦은 응답·중복 요청·세션 변경을 안전하게 처리하는가 |
| Error / recovery | 9 | 실패가 격리되고 정상 복구 경로가 있는가 |
| Persistence / restore | 9 | 저장·복원이 현재 schema/state와 일치하는가 |
| Lifecycle / cleanup | 8 | timer/polling/modal/chart 등 lifecycle이 누수되지 않는가 |
| 유지보수성 / 확장성 | 10 | 기능 변경이 책임 경계를 무너뜨리지 않는가 |

### 4.3 UI /100

| 축 | 비중 |
|---|---:|
| Visual hierarchy | 10 |
| Layout / alignment | 10 |
| Typography | 8 |
| Spacing / density | 8 |
| Table / Card | 12 |
| Chart / visual data | 10 |
| Modal / Tooltip / Overlay | 10 |
| Control / interaction visual | 8 |
| Responsive | 16 |
| Theme / runtime visual consistency | 8 |

### 4.4 UX /100

| 축 | 비중 |
|---|---:|
| 정보구조 / discoverability | 8 |
| 핵심 flow 정확성 | 14 |
| Feedback / 진행상태 | 10 |
| Error recovery | 10 |
| 상태 continuity | 12 |
| Re-entry / duplicate action | 12 |
| Keyboard / touch / accessibility | 10 |
| Persistence / restore / recalculation | 8 |
| Perceived performance | 6 |
| Cross-view / feature consistency | 10 |

```text
UI/UX 총점 = UI와 UX 평균
전체 총점 = CSS / JavaScript / UI / UX 동일가중 평균
```

N/A가 있으면 해당 범위에 맞게 재배분하되 이유를 적는다.

---

## 5. A / B / C 판정

### A — 높은 우선순위의 실제 결함

다음처럼 즉시 수정 가치가 큰 문제다.

- 잘못된 계산/데이터
- 저장 손상 또는 인증 우회
- 핵심 기능 failure
- 주요 viewport 사용 불가
- 현실적으로 반복 가능한 중복 mutation/race
- 대규모 UI/UX 회귀

### B — 수정 권장 결함

현재 전체 기능을 막지는 않지만 현실적인 사용에서 **잘못된 값, 사용자 혼란, 회귀 가능성, 유지보수 비용**이 명확한 문제다.

예:

- 특정 정상 상태에서 tooltip 값이 실제 scale과 어긋남
- 한 viewport에서 control이 겹침
- 전용 행동 테스트가 있는데 source-shape를 중복 고정해 정상 수정이 자주 깨짐
- 문서가 중요한 평가/운영 범위를 누락함

### C — 비감점 관찰 / 선택적 정리

- 기능 영향 없는 미세 중복
- 취향성 정리
- 극저확률 다중 장애
- 변경 이득보다 회귀 위험이 큰 리팩터링
- 향후 정리하면 좋은 문서 중복

C는 기본적으로 100점을 막지 않으며 `수정해`에서 자동 수정하지 않는다. 사용자가 C까지 수정하라고 명시하면 실익이 있는 범위만 정리한다.

---

## 6. 전체 평가 workflow

### 6.1 프로젝트 inventory

전체 평가에서는 먼저 실제 ZIP 구조를 확인한다.

최소 확인:

- main entry와 CSS/JS entry
- JS module graph
- data와 canonical 원천
- Python scripts / workflow
- Add Calc / Report
- tests
- README / handover / evaluation 문서
- 실제 구조와 문서 경로의 불일치

이 단계 없이 과거 기억으로 `현재도 동일함`을 가정하지 않는다.

### 6.2 자동·정적 QA

가능한 범위에서 다음을 실행한다.

- Node test
- Python test
- JS syntax/module parse
- Python syntax
- JSON parse
- YAML parse
- local import/path 존재 여부
- import cycle
- 필요 시 test별 실행시간/중복 assertion 구조

자동 테스트가 전부 PASS해도 **실제 계산·상태·UI 의미를 별도로 평가**한다.

### 6.3 코드 검토

자동 QA 후 실제 변경 위험을 찾는다.

```text
구조/책임
→ 계산/데이터
→ state/lifecycle
→ async/race/re-entry
→ UI/responsive
→ accessibility
→ 문서/테스트 정합성
```

### 6.4 bounded 반례 검토

현실적인 대표 반례를 본다.

- 연타/중복 실행
- 닫자마자 다시 열기
- 응답 순서 역전
- 이전 timer/session 잔존
- 처리 중 theme/viewport/tab/date 변경
- 이전 저장값 복원
- 0/empty/경계값
- keyboard/touch 사용

**같은 위험 패턴을 표현만 바꿔 계속 공격하지 않는다.** 독립적인 희귀 장애를 여러 개 겹쳐야만 발생하는 경우는 원칙적으로 C 또는 비감점이다.

---

## 7. Main 상세 평가

Main 평가는 CSS/JS 총점만 내지 않고 **현재 존재하는 화면영역과 사용자 flow**를 inventory해 실제 근거를 남긴다.

### 7.1 Main CSS

확인:

- CSS 파일별 responsibility와 source order
- token/theme 정의와 실제 사용
- duplicate selector와 override chain
- specificity outlier
- dynamic class와 pseudo/media/print 사용처
- Desktop / Tablet / Mobile 기본 contract
- 기능성 breakpoint의 이유와 leakage
- card/table/modal/chart/topbar 등 component grammar
- Light/Dark parity
- print override와 일반 화면 rule의 분리

Dead CSS는 HTML 문자열 검색만으로 판정하지 않는다. JS template, `classList`, state class, print, SVG 생성 경로까지 확인한다.

### 7.2 Main JavaScript architecture

확인:

- 실제 import graph와 circular dependency
- core / UI common / chart / pension / app / standalone subsystem의 책임
- public export의 실제 소비처
- feature state가 common module로 역류하지 않는지
- global/window bridge 재등장 여부
- renderer가 raw business data를 과도하게 해석하지 않는지

파일이 크다는 이유만으로 분할을 권하지 않는다. **응집된 subsystem이면 큰 파일도 정상**일 수 있다.

### 7.3 데이터·계산 정합성

표시 숫자를 만드는 feature는 원천→파생→표시 경로를 확인한다.

대표 확인:

- 원금 / 평가금액 / 누적손익 / 수익률
- 실현손익과 보유분 계산의 구분
- 전량매도 종목의 historical 처리
- 현금/현금성자산 포함 규칙
- 별도수익 ON/OFF
- 퇴직연금 추가매수/적립/조정에 따른 원금 변동
- 동일 값이 table/card/chart에서 서로 다른 계산식을 쓰지 않는지

숫자 하나가 이상하면 renderer만 보지 않고 **계산 source와 표시 formatter를 분리해서 추적**한다.

### 7.4 Frontend ↔ Backend / Workflow contract

현재 범위에 원격 저장·시세 갱신·workflow가 연결되어 있으면 **frontend 요청 의미와 backend/script 동작이 같은지** 확인한다.

- KRX: 선택 날짜·request body·workflow input·Python 갱신 대상 날짜가 같은 의미인지
- 퇴직연금: upsert/delete/batch, request identity, PIN, response/result와 frontend 재렌더가 맞는지
- GitHub Actions/Python: workflow 입력·branch·data 경로와 실제 script 옵션이 일치하는지
- GAS가 첨부되지 않았으면 frontend contract까지만 평가하고 server 내부 동작을 추정하지 않는다.
- Market AI backend는 별도 소스가 제공되고 평가 범위에 포함된 경우만 backend 자체를 평가한다. Main에서는 frontend adapter·polling·실패 격리를 본다.

문서 설명과 실제 workflow/script가 다르면 실행 결함인지 문서 노후화인지 구분한다.

### 7.5 Live / async / polling

실시간 시세·Market AI·원격 저장처럼 async가 있는 기능은 다음을 본다.

- polling owner와 interval
- 중복 timer/listener
- latest-wins 또는 stale response 방지
- partial refresh와 full render 경계
- focus/scroll/navigation 보존
- timeout/response.ok/parse 실패
- endpoint별 실패 격리
- 연결 실패 후 recovery

성능은 polling 주기 숫자만 보고 감점하지 않고 실제 request 양·render 범위·측정 결과를 함께 본다.

### 7.6 Chart

현재 존재하는 차트를 inventory하고 다음을 확인한다.

- data source와 formatter
- plot margin / axis domain / tick
- 0선 및 dual-axis 정렬
- auto Y와 fixed Y
- legend 선택 최소 1개/전체선택
- mode 전환과 선택 state 유지
- 확대 modal과 원본 state parity
- resize/re-render
- tooltip 위치와 표시값
- chart card/axis/gridline 가독성
- 모바일/태블릿 control 배치

**축의 눈금 text와 실제 scale domain이 다를 수 있으므로 tooltip 값 역산은 실제 좌표 scale 기준으로 검증**한다.

### 7.7 Table / Card / Tooltip / Modal

- 숫자/텍스트 alignment
- sticky/summary/source row 예외
- sold-out/historical row 표현
- 좁은 화면의 줄바꿈과 overflow
- tooltip clipping, hover/focus/touch
- modal open/close/ESC/backdrop
- focus trap / focus return / inert / body lock
- destructive action과 저장 feedback
- Light/Dark/print surface

### 7.8 Responsive

대표 viewport family:

```text
Desktop >= 1101
Tablet 761~1100
Phone <= 760
```

현재 기능성 exception이 있으면 해당 폭을 추가한다.

확인:

- topbar/nav/hamburger 구성
- title/control 충돌
- card/grid column 변화
- table→mobile 표현 변화
- chart button/legend/tooltip
- phone portrait/landscape
- 작은 폭에서 긴 숫자·종목명·상태 chip
- viewport 변경 후 JS visibility/state 갱신

특정 캡처 한 장만 맞추고 인접 폭에서 깨지는 **하드코딩 보정**을 B 이상으로 본다.

### 7.9 Print

Print가 존재하는 경우 실제 print lifecycle을 확인한다.

- 다크모드에서도 출력 theme contract
- 페이지 첫 장 공백/강제 page-break
- modal/card 높이 잘림
- chart/hidden component 포함 여부
- mobile F12 상태가 print CSS에 누출되는지
- print 전용 render가 일반 runtime을 오염시키지 않는지

### 7.10 Main 주요 UX flow

현재 실제 구현을 기준으로 최소 다음 유형을 본다.

```text
날짜 선택 → active date → 데이터/차트 반영
실시간 시세 → partial refresh → 화면 continuity
월간손익/히트맵 → 날짜·모드 전환 → 최신 값 반영
퇴직연금 → 조정/추가매수/삭제 → 검증/PIN/저장/재렌더
차트 → legend/mode/auto Y/확대 → state 유지
Market AI → 연결/실패/복구 → endpoint별 상태 격리
```

실제 프로젝트에서 기능이 추가/삭제되면 목록도 소스 기준으로 조정한다. 이 목록을 고정된 UI inventory로 취급하지 않는다.

---

## 8. Add 상세 평가

Add가 전체 평가 범위에 포함되면 **Calc와 Report를 실제로 읽고**, Main과 별개로 평가한다.

### 8.1 Add 공통 UI / 구조

확인:

- `add/add.css` token과 shared primitive
- `data-add-page` 등 page scope
- Calc/Report 공통 surface/control과 page-specific layout 분리
- `add/add.js` boot/공통 interaction/페이지별 책임
- Light/Dark
- Desktop/Tablet/Phone
- keyboard/focus/touch
- Main과 같은 semantic contract가 drift하지 않는지

Main과 모양이 비슷하다는 이유만으로 CSS/JS runtime을 합치도록 요구하지 않는다.

### 8.2 Add Calc

Calc는 UI만이 아니라 **계산 정확성 + validation + stale-result UX**까지 평가한다.

확인:

- 입력 validation
- `compute()` 등 production 계산식
- 단위/반올림/step
- 목표값과 결과값 관계
- invalid 입력 후 이전 결과 제거/무효화
- 기본값 restore와 state reset
- input/label/stepper/button selected state
- 모바일 입력 편의와 overflow
- tooltip/info icon semantic
- 계산식과 테스트가 별도 복사본으로 drift하지 않는지

실제 계산 오류는 단순 UI 문제로 낮추지 않는다.

### 8.3 Add Report

Report는 **canonical 거래 data → 계산 파생 → KPI/차트/표/Timeline** 정합성을 중심으로 본다.

확인:

- canonical 거래 파일과 validator
- 날짜 정렬/중복/schema
- 손익금액·거래비용·순손익 관계
- 날짜별 합계와 전체 합계
- 본 포지션/단타/혼합일 계산 contract
- 같은 metric이 KPI·차트·표·Timeline에서 같은 source를 쓰는지
- responsive에서 날짜/순서/수치 의미가 유지되는지
- canonical report 외 병렬 운영본이 생기지 않았는지

원본 증권사 자료가 없는 경우 원본과 직접 대조하지 못했다는 사실만 명시하고 감점하지 않는다.

---

## 9. Main ↔ Add 통합 정합성

전체 Dashboard 평가에서 확인할 수 있다.

- 공통 viewport family
- theme/appearance 의미
- corner/surface/control 등 장기 UI contract
- asset/favicon/path
- canonical 거래 data / validator / schema
- Main 파생값과 Report 파생값의 원천 일치
- 의도적으로 독립이어야 하는 runtime이 과결합하지 않았는지
- README/handover/test 경로 정합성

통합 평가의 목적은 모든 것을 한 파일로 만드는 것이 아니다.

```text
같은 semantic / 같은 canonical data → 공유 가치 확인
다른 page / 다른 state / 다른 업무 계산 → 독립성 보존
```

---

## 10. GAS 평가

GAS는 사용자가 포함해 달라고 했거나 현재 문제를 판정하는 데 실제로 필요한 경우만 평가한다.

### 10.1 기본 bounded 모드

```text
syntax/regression
→ 핵심 mutation/dispatch 상태모델
→ 현재 변경 또는 고위험 경계 대표 반례
→ A/B/C
→ 마지막 bounded counterexample pass 1회
→ 새 A/B 없으면 종료
```

### 10.2 B 이상으로 보는 대표 위험

- 정상 사용자 재시도/중복 요청
- 현실적인 timeout/5xx/409/422/응답 유실
- single/batch mutation의 idempotency
- partial conflict / atomicity
- GitHub branch/queue 경쟁
- 지원하는 legacy/restore data
- KRX 동일 request 중복 dispatch와 stale retry

원칙적으로 C/비감점:

- 독립적인 희귀 장애 2개 이상이 동시에 필요
- production 도달 근거 없이 mock만 가능한 순서
- stronger durable proof를 의도적으로 여러 개 제거해야 성립
- 자동 복구/다음 요청에서 자연 수렴하고 영향이 작음

### 10.3 GAS 점수

필요할 때 별도 /100으로 평가한다. CSS/JS/UI/UX 총점에 자동 합산하지 않는다.

---

## 11. 테스트 품질 평가 — 과테스트 / 과축소

테스트는 많고 적음이 아니라 **무엇을 고정하는지** 본다.

### 11.1 좋은 테스트

우선 보존:

- 계산/데이터 정답
- 실제 재발한 bug 행동
- async/race/session state transition
- persistence/idempotency
- cross-module 장기 contract
- accessibility state처럼 실제 사용자 영향이 큰 것

### 11.2 과테스트 후보

다음은 실제 유지보수 비용이 있으면 B/C로 본다.

- exact selector 순서 고정
- 함수 내부 문장/중간 변수명 고정
- 특정 helper 호출 목록과 순서를 regex로 고정
- 전용 행동 테스트가 이미 보호하는 기능을 contract test가 다시 source-shape로 고정
- 디자인 변경과 무관한 DOM 개수/미세 px/hex를 장기 contract로 고정
- 같은 root cause를 여러 테스트 파일에서 반복 assertion

다만 breakpoint 숫자, schema key, canonical path처럼 **숫자/문자열 자체가 제품 contract**인 경우는 고정할 수 있다.

### 11.3 과축소 / 테스트 공백

테스트가 없다는 이유만으로 감점하지 않는다. 하지만 다음처럼 위험이 크고 실제 반복 회귀가 있는 영역에 최소 행동 검증조차 없다면 유지보수 위험으로 지적할 수 있다.

- 핵심 계산식
- 중복 mutation/idempotency
- 복잡한 chart state transition
- 실제 반복된 responsive regression을 순수 함수/DOM contract로 안정적으로 검증 가능한 경우

테스트 추가가 browser E2E 전체 도입보다 더 비싸거나 flaky하면 억지로 권하지 않는다.

---

## 12. MD 문서 품질 — 과작성 / 과축소 / 정합성

문서도 평가 대상이 될 수 있다. 특히 사용자가 과작성·과축소를 요청했을 때 아래를 본다.

### 12.1 과작성

다음이 반복되면 정리 후보이다.

- README/handover/evaluation에 같은 내용을 장문 중복
- 현재 selector·함수 구현문을 문서가 다시 복제
- 특정 날짜의 테스트 결과·점수·일회성 수정 이력을 계속 누적
- 실제 코드에서 자동으로 알 수 있는 파일 목록을 여러 문서가 각각 장문 보유
- 같은 규칙을 표현만 바꿔 여러 절에서 반복

### 12.2 과축소

짧다고 좋은 문서가 아니다. 다음이 빠지면 과축소다.

- 문서 역할과 Source of Truth
- Main/Add 적용 범위
- 핵심 불변조건과 금지사항
- `평가해줘`에서 기대하는 평가 깊이
- 계산/상태/async/responsive 같은 필수 평가 영역
- Add Calc/Report처럼 독립적으로 평가해야 할 영역
- 수정/QA 시 회귀를 막기 위해 사람이 반드시 알아야 하는 contract

### 12.3 정합성

- 문서 경로/파일명이 실제 구조와 맞는가
- 서로 다른 문서가 같은 contract를 반대로 설명하지 않는가
- 삭제된 기능을 현재 기능처럼 설명하지 않는가
- 테스트 설명이 실제 test runner와 맞는가

목표는 **최소 문서가 아니라 최소 중복 + 충분한 의사결정 정보**다.

---

## 13. Accessibility / Interaction

실제 존재하는 component에서 확인한다.

- `<a>` / `<button>` semantic과 button `type`
- keyboard activation
- `:focus-visible`
- dialog role / `aria-modal`
- focus trap / focus return / ESC
- label / `aria-label`
- `aria-controls` / `aria-labelledby` / `aria-describedby`
- `aria-expanded` / `aria-live`
- table caption/scope
- chart keyboard interaction
- hover-only 정보의 대체 경로
- touch target
- contrast
- `touch-action`, `user-select`, draggable이 UX를 방해하지 않는지

의도된 PIN masking과 native control은 3장의 보호 원칙을 우선한다.

---

## 14. 성능 / 유지보수성

성능은 추측보다 실제 근거를 본다.

재검토 근거:

- 체감 지연
- profiling 병목
- 과도한 네트워크 요청
- polling/render 중복
- 불필요한 full re-render로 focus/scroll이 깨짐
- 반복 회귀와 직접 연결된 구조
- 한 변경에 여러 파일을 불필요하게 동기 수정해야 하는 비용

다음만으로는 감점하지 않는다.

- 함수가 길다
- CSS 파일이 많다
- framework가 없다
- state library가 없다
- 테스트 framework가 작다

---

## 15. Runtime / 실기 원칙

브라우저 실기가 실제 판단에 도움이 되고 실행 환경이 허용될 때만 보조 검증한다.

- 사용자가 `브라우저 테스트 하지마`라고 하면 수행하지 않는다.
- 실기를 하지 않았으면 `실화면 확인 PASS`라고 쓰지 않는다.
- 공개 배포본과 최신 ZIP revision이 다를 수 있으므로 공개 페이지는 최신 ZIP의 Source of Truth가 아니다.
- 수정 직후 QA는 현재 수정본 자체를 검증하는 것이 우선이다.

실기가 필요한 대표 상황:

- overflow/겹침
- modal focus/stacking
- print pagination
- actual SVG size/tooltip clipping
- mobile touch/landscape
- browser native control

정적 분석으로 충분한 계산·import·schema 문제에 불필요하게 브라우저를 띄우지 않는다.

---

## 16. CT35 연계

`ct35_evaluation.md`는 공통화·토큰화 전용 평가 contract다.

- 전체 Main+Add 평가: 적용 가능한 1~35를 **Main/Add 각각 확인**한다.
- Main만 평가: Add는 평가하지 않는다.
- Add 전체 평가: Main+Add 공통 항목의 Add + 31/32를 확인한다.
- 특정 기능: 관련 CT35만 골라 적용한다.

전체 평가에서 CT35 표를 출력할 때 **Main만 채우고 Add를 전부 N/A로 처리하지 않는다.** Add source가 포함되어 있고 평가 범위에 포함되면 실제 Add 점수를 산정한다.

---

## 17. 100점 Gate

100점은 “절대 버그 없음” 선언이 아니라 **현재 평가 범위에서 구체적인 A/B 감점 근거가 없다는 뜻**이다.

```text
[ ] 실행 가능한 자동/정적 QA 확인
[ ] 구조/dependency/state/async/persistence 중 해당 범위 확인
[ ] 계산·데이터 정합성 확인
[ ] UI/responsive/accessibility 중 해당 범위 확인
[ ] 문서/schema/workflow 의미 정합성 확인
[ ] 필요한 경우 CT35 Main/Add 확인
[ ] 현실적인 대표 반례 bounded 검토
[ ] A = 0, B = 0
```

C만 있다는 이유로 99점을 만들지 않는다. 반대로 필요한 범위를 확인하지 않았는데 테스트 PASS만으로 100점을 주지 않는다.

---

## 18. 평가 결과 작성 형식

### 18.1 전체 평가 기본 순서

`평가해줘`의 기본 결과는 아래 수준을 유지한다.

1. **한눈에 보는 결론** — 범위, A/B/C 개수, 전체 총점
2. **검증 결과** — 실행한 Node/Python/parse/import QA와 미실시 항목
3. **CSS 상세 평가** — 하위 축과 핵심 근거
4. **JavaScript 상세 평가** — module/state/async/lifecycle 근거
5. **UI 상세 평가** — 화면영역·responsive·chart/table/modal 근거
6. **UX 상세 평가** — 주요 flow와 recovery/state continuity
7. **데이터/계산·workflow contract** — 범위에 필요한 경우
8. **Add 상세 평가** — Add가 범위에 포함될 때 Calc/Report 분리
9. **CT35** — 필요한 경우 Main/Add 1~35 표 또는 관련 항목
10. **A/B/C 상세** — 파일/함수/영역, 실제 영향, 수정 방향
11. **최종 점수표와 종료 판단**

### 18.2 점수표

최소 다음을 제공한다.

| 구분 | 점수 | 핵심 판정 |
|---|---:|---|
| CSS | 00 | |
| JavaScript | 00 | |
| UI | 00 | |
| UX | 00 | |
| UI/UX | 00 | |
| **전체** | **00** | |

범위가 Add 전용이면 Add에 맞춰 같은 깊이로 작성하고, Main 점수를 억지로 만들지 않는다.

### 18.3 A/B/C 상세 작성

A/B는 최소 다음을 포함한다.

```text
등급 / 제목
- 위치: 파일·함수·selector·화면영역
- 현재 상태
- 실제 영향
- 왜 이 등급인지
- 수정 방향
```

가능하면 숫자나 state transition을 사용해 **재현 가능한 설명**을 한다.

### 18.4 검증 표현

- 실행한 검사는 `PASS`라고 명시할 수 있다.
- 실행하지 않은 검사는 `미실시`라고 쓴다.
- 브라우저를 안 봤으면 `코드상/정적 분석상`이라고 구분한다.
- 특정 범위를 제외했다면 `평가 제외`라고 명시한다.

### 18.5 상세도 조절

- 전체 `평가해줘`: 위 기본 순서의 상세 수준을 유지한다.
- `점수만`: 점수 중심으로 줄인다.
- `수정한 부분만 다시 평가`: 영향 범위만 깊게 본다.
- 특정 기능: 해당 기능 + dependency만 본다.

즉, **문서가 짧아졌다는 이유로 전체 평가 답변까지 짧아져서는 안 된다.**

---

## 19. 평가 종료 조건

```text
[ ] 미해결 A = 0인지 확인
[ ] 미해결 B = 0인지 확인
[ ] 변경 영향 범위 QA 상태 확인
[ ] 계산/async/persistence 고위험 변경이면 대표 반례 확인
[ ] 문서/테스트가 실제 contract와 충돌하지 않는지 확인
[ ] 마지막 bounded pass에서 새 A/B가 없는지 확인
```

평가 후 사용자가 `수정해`라고 하면 A부터, 그다음 B를 수정한다. C는 사용자가 포함하라고 한 경우만 실익이 있는 범위에서 정리한다.

---

## 20. 문서 유지관리 원칙

이 문서는 **평가 방법만 소유**한다.

기록하지 않는 것:

- 현재 selector 전체 목록
- 특정 함수 내부 구현문
- 일회성 수정 내역
- 특정 날짜의 점수/테스트 PASS 기록
- 현재 데이터 숫자

유지해야 하는 것:

- 평가 범위와 Source of Truth
- 보호 원칙
- CSS/JS/UI/UX 채점축
- Main/Add/GAS 평가 깊이
- 과테스트/과작성·과축소 판정 기준
- A/B/C와 100점 Gate
- 결과 작성 수준

목표는 **과작성 없는 충분한 평가 contract**다. 문서를 줄이는 것 자체가 목표가 아니며, 문서를 읽고도 `평가해줘` 결과가 예전보다 얕아지면 과축소로 본다.
