# dashboard_evaluation_guide · 투자 대시보드 평가 기준

이 문서는 투자 대시보드 **MAIN + ADD 공통 평가 전용 기준서**다.

이 문서의 목적은 프로젝트를 수정하거나 인수인계하는 방법을 설명하는 것이 아니라, 사용자가 `점수`, `평가`, `평가해줘`를 요청했을 때 **무엇을 어떤 근거로 평가하고, 무엇은 감점하지 않으며, 결과를 어떤 형식으로 작성할지**를 일관되게 정의하는 것이다.

문서 역할은 다음처럼 분리한다.

| 문서/기록 | 역할 |
|---|---|
| [README.md](./README.md) | GitHub 프로젝트 소개 · 전체 구조 · 실행/배포 개요 |
| [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md) | MAIN 수정 · 유지보수 · QA · 장기 contract와 Main↔Add 공통 contract 정의 |
| [add_maintenance_handover.md](./add_maintenance_handover.md) | ADD Calc/Report 수정 · 유지보수 · QA · 장기 contract |
| [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md) | MAIN + ADD 평가 · 점수 · A/B/C · 감점/비감점 기준 |
| Git history | 과거 변경 이력 |

평가는 항상 **최신 실제 소스를 독립적으로 다시 확인**하는 작업이다. 과거 평가 결과나 과거 점수는 최신 정상 판정의 근거가 아니다.

---

# 1. 평가 명령과 범위

## 1.1 `점수`

`점수`는 최신 실제 소스를 필요한 범위에서 검증해 CSS / JavaScript / UI / UX 점수를 새로 산정한다.

기본 출력은 점수 중심으로 간결하게 작성한다.

```text
CSS
JavaScript
UI
UX
UI/UX 총점
전체 총점
```

- 상세 수정 작업은 수행하지 않는다.
- 파일을 수정하거나 ZIP을 만들지 않는다.
- 과거 점수를 복사하지 않는다.
- `모든 점수`는 단독 사용 시 `점수`와 같은 의미로 처리한다.

## 1.2 `평가` / `평가해줘`

두 표현은 같은 평가 명령으로 처리한다.

```text
최신 실제 소스 확인
→ 평가 보호 규칙 선확인
→ 프로젝트 구조와 현재 구현 inventory
→ CSS / JS / UI / UX 독립 평가
→ 접근성 / 성능 / 유지보수성 확인
→ A / B / C 분류
→ 세부 점수와 최종 결론
```

평가에서는 파일을 수정하지 않는다.

전체 프로젝트 평가에서 현재 전체 구조를 확인할 수 있는 최신 기준본(전체 ZIP 또는 동등한 저장소 snapshot)이 없으면 과거 자료나 기억만으로 전체 평가를 확정하지 않는다.

## 1.3 평가 범위 지정

사용자가 범위를 지정하면 해당 범위를 중심으로 평가한다.

예:

```text
MAIN만 평가
ADD만 평가
Calc 평가
KODEX Report 평가
CSS만 평가
JS만 평가
화면 영역별 평가
기능별 평가
MAIN ↔ ADD 통합 평가
전체 평가
```

범위가 좁더라도 해당 기능의 판정에 필요한 dependency / shared contract / responsive rule은 필요한 만큼 함께 확인한다.

## 1.4 평가와 QA는 다른 작업이다

```text
평가
→ 현재 품질을 독립적으로 판정
→ 점수 / A·B·C / 구조·UI·UX 평가

QA
→ 방금 수정한 current revision의 회귀 여부 확인
→ handover의 수정·QA 절차를 따름
```

GitHub Pages 공개본은 평가의 runtime 보조 근거로 사용할 수 있지만 **수정 직후 QA의 PASS/FAIL 근거로 사용하지 않는다.**

---

# 2. 평가 Source of Truth

평가 시 확인하려는 정보의 Source of Truth는 역할별로 구분한다.

| 확인 대상 | Source of Truth |
| --- | --- |
| 실제 현재 구현 | 사용자가 제공한 최신 실제 HTML / CSS / JS / data / scripts / workflows / tests |
| MAIN의 장기 설계 의도·유지보수 contract | [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md) |
| ADD의 장기 설계 의도·계산·유지보수 contract | [add_maintenance_handover.md](./add_maintenance_handover.md) |
| Main↔Add 공통 contract | Main handover 8장 + Add handover 관련 적용 규칙 + `tests/cross-ui-contract.test.cjs` |
| 평가·점수·A/B/C·감점 보호 규칙 | [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md) |
| GitHub 프로젝트 설명·전체 구성 | [README.md](./README.md) |
| 과거 변경 이력 | Git history |

실제 코드와 문서가 다르면 문서를 근거로 코드를 자동으로 되돌리지 않는다.

```text
실제 구현 확인
→ 해당 handover의 장기 contract 확인
→ 회귀인지 문서 노후화인지 판단
→ 평가 결과에 구분하여 기록
```

README / handover / workflow 설명이 실제 코드와 다르면 **문서 정확성 문제**로 표시한다. 실행 품질과 직접 무관한 문서 오류를 CSS / JS / UI / UX 점수에 억지로 섞지 않는다.

---

# 3. 평가 전 최우선 보호 규칙

평가자는 점수 산정 전에 아래 보호 항목을 먼저 확인한다.

```text
보호 항목 선확인
→ 실제 재현 문제 / 사용자 영향 / 구체적 코드 오류가 있는지 확인
→ 실제 근거가 없으면 감점하지 않음
→ 실제 장점이 분명하지 않으면 B급 개선안으로도 만들지 않음
→ 문제가 없으면 CSS / JS / UI / UX 각각 100점 가능
```

다음은 이미 검토된 설계 의도·browser/native behavior·허용된 trade-off다. **실제 대상 환경에서 문제가 재현되지 않는 한 감점하거나 반복 개선안으로 제시하지 않는다.**

- **KRX·퇴직연금 Action PIN**: `type="text" + inputmode="numeric" + autocomplete="off" + -webkit-text-security:disc` 조합은 Chrome 비밀번호 저장 제안을 피하면서 숫자 PIN 마스킹을 유지하기 위한 의도된 구현이다. 비표준 CSS라는 이유만으로 credential `password` field로 되돌리지 않는다. KRX modal 재진입 시 PIN reset 같은 실제 contract는 MAIN handover와 현재 코드를 확인한다.
- **개인보기 3회 gesture**: 일반 사용자에게 진입 경로를 숨기는 private gesture다. discoverability 부족이나 일반 버튼이 아니라는 이유로 감점하지 않는다.
- **Native `<select>` option UI**: browser / OS native rendering 차이를 이유로 custom select 전환을 권하지 않는다.
- **전체 dashboard `render()` 방식 / `Date.now()` cache bust**: 실제 측정된 병목·과도한 네트워크 사용이 없으면 감점하지 않는다.
- **Vanilla JS / framework·state library 미사용** 자체를 감점하지 않는다.
- **CSS 파일 개수, CSS/JS/MD 길이·줄 수·byte 크기 자체**를 감점하지 않는다.
- **Playwright / Jest / ESLint / Stylelint 등 대형 테스트·lint 인프라 부재 자체**를 감점하지 않는다.
- **자동 테스트 파일 존재 여부나 테스트 개수 자체**를 감점·가산하지 않는다.
- 특정 기능에 자동 테스트가 없다는 이유만으로 A/B급을 만들거나 점수를 깎지 않는다.
- 테스트가 많다는 이유만으로 점수를 올리지 않는다.
- 테스트 FAIL이 실제 계산·기능·UI contract 결함을 확인해 준 경우에만 **그 실제 결함 자체**를 평가한다.
- **Market AI 백엔드 또는 GAS 미첨부·미연결 자체**를 MAIN CSS / JS / UI / UX 감점 사유로 사용하지 않는다.
- browser/native 대응을 위해 이유가 있는 `!important`, 기능성 media query, 긴 selector 등은 **개수·형태만으로** 감점하지 않는다.

평가자가 새 문제를 제시하려면 최소 하나의 실제 근거가 있어야 한다.

```text
재현 가능한 bug
구체적 기능 불일치
실제 cascade / responsive 회귀
접근성 오류
실제 사용자 혼란 / 복구 어려움
측정된 성능 병목
운영을 잘못 유도하는 문서 / contract 오류
```

다음과 같은 평가는 금지한다.

```text
"완벽한 소프트웨어는 없으니 99"
"가능성이 있으니 99"
"더 깔끔하게 만들 수 있으니 B급"
"파일이 길어서 감점"
"테스트가 적어서 감점"
```

---

# 4. 점수 산정 기준

## 4.1 CSS

기본 평가 축:

- 구조 / 파일 책임
- Cascade / Specificity
- Responsive
- Theme / Token
- Interaction CSS
- `!important`
- Dead / Legacy
- 유지보수성
- **CSS 총점 /100**

파일 수나 selector 수 같은 단순 수량보다 실제 역할 분리·cascade 안정성·회귀 위험을 본다.

## 4.2 JavaScript

기본 평가 축:

- Module responsibility
- Dependency
- State ownership
- Public API
- Events
- Rendering
- Async / Error
- 유지보수성 / 확장성
- **JavaScript 총점 /100**

파일 길이만으로 분리를 권하지 않는다. 하나의 subsystem으로 응집되어 있다면 큰 파일도 허용한다.

## 4.3 UI

기본 평가 축:

- Visual hierarchy
- Layout
- Typography
- Spacing
- Table / Modal / Tooltip / Chart UI
- Responsive
- Theme
- Interaction consistency
- **UI 총점 /100**

실제 존재하지 않는 UI 영역은 `N/A`로 처리하며 감점하지 않는다.

## 4.4 UX

기본 평가 축:

- 주요 사용자 flow 정확성
- Feedback
- Error recovery
- 상태 이해 가능성
- destructive action 명확성
- 불필요 반복 여부
- Accessibility / keyboard / touch
- **UX 총점 /100**

UX는 추상적인 취향보다 실제 사용자 영향이 있을 때 지적한다.

## 4.5 종합점수

```text
UI/UX 총점 = UI와 UX 평균
전체 총점 = CSS / JavaScript / UI / UX 동일가중 평균
```

과거 점수를 baseline으로 사용하지 않고 최신 실제 상태에서 새로 산정한다.

```text
실제 감점 근거 있음 → 감점
실제 감점 근거 없음 → 100 가능
N/A → 점수 하락 근거로 사용 금지
```

---

# 5. A / B / C 분류

A/B/C는 억지로 개수를 채우지 않는다.

## 5.1 A — 실제 수정 권장

다음처럼 **구체적인 영향이 있는 문제**다.

- bug
- 기능 불일치
- 계산 오류
- cascade / responsive 회귀
- 접근성 오류
- 실제 UX 혼란
- 운영을 잘못 유도할 문서 오류
- 데이터 / frontend-backend contract 오류

가능하면 다음을 함께 적는다.

```text
파일 / selector / 함수 / 화면 영역
현재 상태
실제 영향
판정 이유
권장 수정 방향
```

## 5.2 B — 선택적 개선

현재 정상이고 회귀도 없지만 **실제 장점이 분명한 경우에만** 제안한다.

- B급을 채우기 위해 후보를 만들지 않는다.
- 보호 항목은 실제 문제가 재현되지 않는 한 B급으로도 반복 제안하지 않는다.
- “더 현대적”, “더 짧음”, “더 토큰화 가능” 같은 이유만으로 제안하지 않는다.

## 5.3 C — 수정하지 않는 게 나음

다음은 C로 분류할 수 있다.

- 현재 설계 의도에 맞음
- browser native behavior
- 이미 검토된 trade-off
- 변경 이득보다 복잡도·회귀 위험이 큼
- 점수 목적의 정리
- 현재 구조에서 의도적으로 분리된 책임

C는 **문제점을 억지로 만들기 위한 등급이 아니라, 현재 상태를 유지해야 할 이유를 명확히 기록하는 분류**다.

---

# 6. 공통 평가 절차

## 6.1 실제 프로젝트 inventory

평가 시작 시 사용자가 제공한 최신 기준 소스의 실제 디렉토리·파일 목록을 확인한다.

최소 확인:

- main entry
- CSS 파일과 역할
- JS module / entry
- Python / Workflow
- data
- ADD Calc / Report
- tests
- README / handover / evaluation 문서
- 문서와 실제 구조의 불일치

canonical 구조의 상세 설명은 각 handover를 참고하되 **최신 실제 소스가 다르면 실제 구조를 먼저 확인**한다.

## 6.2 CSS 정적 검증

가능한 환경에서는 다음을 확인한다.

- parse
- rule / declaration 구조
- `!important`
- media query inventory
- exact duplicate selector / 동일 context
- override / specificity outlier
- CSS variable 정의/사용
- hard-coded color 후보
- dead / legacy 후보
- theme counterpart
- dynamic state class 사용처

도구가 특정 문법을 해석하지 못한 경우 도구 한계와 실제 코드 오류를 구분한다.

Dead CSS 판정 전에는 HTML뿐 아니라 JavaScript dynamic class, template literal, `classList`, state class, pseudo/media/print, chart SVG 생성 등 실제 사용 경로를 확인한다.

## 6.3 JavaScript 정적 검증

가능한 환경에서는 다음을 확인한다.

- ES Module syntax
- 실제 import graph
- circular dependency
- export 소비처
- 의도치 않은 global bridge
- helper 중복 후보
- listener ownership
- state ownership
- render / DOM insertion
- escape / ARIA reference
- fetch / timeout / response.ok / parse handling
- duplicate request / race / operation id / idempotency

단순 함수 길이·파일 길이만으로 감점하지 않는다.

## 6.4 Python / Workflow

평가 범위에 포함될 때 다음을 확인한다.

- Python syntax
- workflow YAML parse
- workflow input 설명과 Python 실제 동작 정합성
- 운영 data 보호

사용자가 별도 범위를 지정하지 않았다면 Python / Workflow 코드 품질을 MAIN frontend 점수에 과도하게 합산하지 않는다.

## 6.5 자동 테스트의 사용법

자동 테스트는 평가 점수 자체가 아니라 **실제 결함을 확인하기 위한 증거 중 하나**다.

```text
테스트 PASS
≠ UI/UX 자동 100점

테스트 FAIL
→ 실제 코드/계산/UI contract 결함인지 확인
→ 낡은 테스트인지 확인
→ 실제 결함이 확인된 경우 그 결함을 평가
```

현재 저장소의 자동 테스트 수나 파일 개수는 점수 기준이 아니다.

---

# 7. MAIN 평가 기준

MAIN 상세 architecture / module ownership / CSS ownership / responsive contract의 현재 canonical 내용은 `main_dashboard_maintenance_handover.md`를 참고한다. 평가 문서는 구조를 복제하지 않고 **평가 관점**만 정의한다.

## 7.1 MAIN CSS

확인:

- 현재 CSS 파일들의 responsibility가 실제 기능과 맞는지
- 관련 rule의 응집도와 탐색성
- 이유 없는 override chain / 높은 specificity
- source-order 의존성이 명확한지
- Desktop / Tablet / Mobile 기본 contract 준수
- 기능성 exception의 실제 필요성
- theme / semantic token / spacing / radius / typography
- light / dark counterpart
- dead / legacy CSS의 실제 사용처

`continuation`, cross-cutting rule, selector 길이, 기능성 media query는 실제 이유와 영향을 보고 판단한다.

`!important`는 개수만으로 감점하지 않는다.

## 7.2 MAIN JavaScript

현재 실제 main graph 및 standalone entry를 읽고 다음을 본다.

- module responsibility
- dependency 방향
- circular dependency
- core / UI / chart / pension / app 책임 경계
- standalone subsystem의 격리
- state ownership
- public export 실제 소비처
- delegated/direct event와 listener guard
- rendering / DOM insertion
- async / error / stale / timeout 처리

현재 handover가 정의하는 의도된 책임 분리를 “파일이 많다”는 이유로 합치도록 권하지 않는다.

## 7.3 Frontend ↔ Backend contract

### KRX

현재 frontend의 실제 mode와 request contract를 확인한다.

특히 선택 날짜가 화면에 존재한다는 사실과 request body의 `date` 존재 여부를 혼동하지 않는다.

GAS가 제공된 경우에만 server handler까지 완전 대조한다.

### Pension

현재 frontend가 사용하는 upsert / delete / batch 계열 request, request id / PIN / operations / response / duplicate·idempotency 처리를 실제 코드와 대조한다.

server contract는 최신 GAS가 제공된 경우에만 완전 대조한다.

### Market AI

Market AI 백엔드는 기본 MAIN 평가 대상에서 제외한다.

대시보드에서는 필요한 범위에서 다음을 확인한다.

- frontend adapter 구조
- main graph와의 책임 분리
- mount / polling / timeout / stale 처리
- endpoint별 실패 격리
- CSS ownership

```text
백엔드 미첨부·미연결
→ MAIN CSS / JS / UI / UX 감점 없음

백엔드 최신 소스 + 별도 평가 요청
→ Market AI backend를 별도 범위로 평가
→ MAIN 점수와 자동 합산하지 않음
```

## 7.4 MAIN UI

현재 실제 화면에서 존재하는 영역을 inventory한다.

대표 영역:

- Topbar / Hero / date controls
- action buttons / external links
- 연금+계좌 성과
- 증권계좌 성과·보유분
- 퇴직연금 성과·보유분
- Chart / 확대
- 장부결과 VS 실제보유
- 투자원금 원천 및 검산
- Table / Modal / Tooltip
- Navigation / TOC / Mobile hamburger
- 실제 존재하는 Footer

공통 평가 요소:

```text
정보 위계
alignment
spacing / density
typography
label clarity
interaction consistency
hover / active / focus / touch
responsive
light / dark
overflow / z-index
readability
```

## 7.5 MAIN Table

현재 존재하는 table variant를 실제 DOM/CSS에서 inventory하여 본다.

- header/body alignment
- sticky first column
- summary
- source table 예외
- hover
- mobile table/card
- phone landscape behavior
- narrow-width exception
- tooltip clipping

과거 특정 표 수정사항을 체크리스트로 외워 평가하지 않는다.

## 7.6 MAIN Tooltip / Overlay / Modal

- trigger semantic
- open / close
- outside click
- ESC
- focus trap / focus return
- ARIA
- viewport overflow
- stacking
- light / dark

## 7.7 MAIN 주요 UX flow

현재 실제 구현을 기준으로 다음 flow를 확인한다.

```text
날짜
→ year/month → day → activeDate → render

KRX
→ modal → PIN → action → loading → success/skip/error → feedback

개인보기
→ OFF/ON private gesture → state/reset/layout

퇴직연금
→ 조정/적립/추가매수/삭제/PIN/batch/save/render

Chart
→ legend/최소1개/전체/Y auto/mode/확대/keyboard/resize/tooltip

Market AI
→ local/remote fetch → endpoint별 상태 격리 → viewport별 UI
```

UX는 실제 상태 혼란, 오동작 가능성, feedback 불일치, 복구 어려움, 불필요 반복, destructive action 불명확성처럼 **사용자 영향이 있을 때만** 지적한다.

## 7.8 MAIN Print

Print 관련 CSS를 dead로 판단하기 전에 실제 print lifecycle과 chart render 경로를 확인한다.

평가 시 실제 인쇄 contract가 현재 handover와 코드에 맞는지 보고, 비활성 상태 때문에 빈 차트·누락 카드·레이아웃 침범 등이 발생하는 실제 회귀가 있을 때만 감점한다.

---

# 8. ADD 공통 평가 기준

ADD 상세 계산·UI·responsive contract의 Source of Truth는 `add_maintenance_handover.md`다.

평가 시 `calc.html`, `kodex-leverage-report.html`, `add/add.css`, `add/add.js` 및 관련 canonical data / validator / tests를 실제로 확인한다.

## 8.1 ADD 토큰화·공통화 감점 원칙

ADD의 토큰화·공통화 평가는 **literal 값의 존재 자체가 아니라 공통화 필요성과 유지보수 위험**을 기준으로 한다.

- 페이지/컴포넌트에 한 번만 쓰이는 고유 색상·표현값은 그 자체로 감점하지 않는다.
- Light/Dark 대응이 정상이고 동일 semantic의 반복값이 아니며 유지보수상 단일 source가 필요하지 않은 값은 local literal로 유지할 수 있다.
- one-use 값을 단지 “더 토큰화할 수 있다”는 이유로 token으로 승격하도록 요구하거나 감점하지 않는다.
- 불필요한 one-use token 증가는 피한다.
- 동일 semantic 값이 여러 곳에서 반복되는데 공통 source가 없거나 literal 분산 때문에 일관성·수정성·회귀 위험이 실제로 생기는 경우에만 감점한다.
- component-local / page-specific color literal이 위 조건을 만족하면 Semantic Color 감점 사유로 보지 않는다.

> **평가 기준은 “더 토큰화할 수 있는가”가 아니라 “공통화해야 할 이유가 있는데도 분산되어 있는가”다.**

## 8.2 ADD 자동 테스트와 평가 점수 분리

- Add 자동 테스트는 계산·UI 회귀를 확인하는 QA 안전망이다.
- 테스트 파일의 존재 여부나 테스트 개수 자체는 Add 평가 가산·감점 기준이 아니다.
- 자동 테스트가 없다는 이유만으로 B급을 만들거나 감점하지 않는다.
- 테스트 FAIL은 실제 결함인지 변경된 의도에 비해 테스트가 낡은 것인지 구분한다.
- 실제 결함이 확인된 경우에만 그 결함 자체를 평가한다.
- 자동 테스트 PASS는 UI 미감·정보 위계·실기 UX까지 자동 PASS한다는 뜻이 아니다.
- UI contract 테스트는 폐기 시 실제 회귀가 생기는 구조·상태·responsive·접근성 경계를 보호하는지 본다.
- 장식용 exact px/hex/shadow/opacity나 DOM 개수처럼 정상적인 디자인 수정에도 자주 바뀌는 구현값을 과도하게 contract로 고정했다고 판단되는 경우 실제 유지보수 영향을 확인한다.
- viewport 경계처럼 숫자 자체가 제품 동작인 값은 contract 검증이 가능하다.

## 8.3 ADD 공통 UI / Responsive

평가 시 다음을 본다.

- MAIN과 공유하는 전역 viewport contract 준수
- 요청되지 않은 Add 전용 breakpoint의 불필요한 증가 여부
- Calc / Report 공통 primitive와 page-specific rule의 책임 분리
- typography / field / control / selected state / surface / result 표현
- Light / Dark
- keyboard / focus / touch
- ARIA / tooltip / table semantic
- overflow / narrow-width
- Timeline 등 페이지별 responsive exception의 실제 필요성

MAIN과 모양이 비슷하다는 이유만으로 CSS/JS runtime을 억지로 합치도록 권하지 않는다. 실제 공통화 이득과 coupling 위험을 함께 본다.

---

# 9. ADD Calc 평가 기준

Calc 평가는 단순 UI뿐 아니라 **계산식·validation·stale-result UX**까지 포함한다.

## 9.1 계산 정확성

`add_maintenance_handover.md`가 정의하는 현재 계산 contract와 production `compute() / validate() / ceil5()` 등 실제 구현을 대조한다.

확인:

- 입력값 validation
- 계산식 일관성
- 단위 / 반올림 / step
- 목표값 / 결과값 관계
- invalid 입력 후 이전 결과가 stale 상태로 남아 사용자를 오도하지 않는지
- 기본값 복원과 관련 state reset
- production 계산식과 테스트가 서로 다른 복사본으로 분기되지 않는지

실제 계산 오류가 확인되면 UI 점수에만 묻지 않고 기능 정확성 문제로 명확히 기록한다.

## 9.2 Calc UI

- 입력 필드와 label 관계
- stepper / button selected state
- 계산 기준 카드와 결과 카드 정보 위계
- Desktop / Tablet / Mobile 배치
- 좁은 폭의 줄바꿈·겹침·overflow
- hover / active / focus
- tooltip / info icon alignment와 semantic
- Light / Dark
- 결과값 강조가 계산 의미와 일치하는지

단순 exact px 차이는 실제 시각 불균형·일관성 문제로 이어질 때만 감점한다.

## 9.3 Calc UX

- 입력 → 검증 → 계산 → 결과 흐름
- invalid / edge case feedback
- 기본값 복원
- stepper 조작
- 모바일 입력 편의
- stale result 제거
- 잘못된 결과를 확정값처럼 보이게 하지 않는지

---

# 10. ADD KODEX Leverage Report 평가 기준

Report 평가는 **canonical 거래 data → 계산 파생 → 요약/차트/표/Timeline 표현**의 정합성을 중심으로 본다.

## 10.1 canonical data

현재 `add_maintenance_handover.md`와 실제 data/validator를 기준으로 다음을 확인한다.

- canonical 거래 파일 경로
- 거래일 정렬 / 중복
- 필수 numeric type
- segment 구조
- validation
- Main 파생값과 Report 파생값의 공통 원천 일치

문서와 실제 canonical 경로가 다르면 문서/contract 오류로 구분한다.

## 10.2 손익 계산 정합성

실제 거래가 포함된 평가에서는 가능한 범위에서 다음을 대조한다.

```text
손익금액 - 거래비용 = 순손익
날짜별 합계 = 전체 합계
본 포지션 + 단타 = 전체
혼합일 비용 배분 contract 준수
Timeline / 요약 / 차트 / 표 파생값 일치
```

원본 증권사 자료가 함께 제공된 경우에만 원본 수치까지 직접 대조한다.

원본 자료가 없다는 사실 자체를 UI/CSS/JS 점수 감점 사유로 쓰지 않는다.

## 10.3 Report UI

- 요약 KPI
- 차트
- 날짜별 거래 표
- 본 포지션 / 단타 표현
- Timeline
- tooltip / source / 근거 표현
- Desktop / Tablet / Mobile
- Light / Dark
- 긴 숫자·라벨·날짜의 overflow
- table semantic

Timeline은 장식 자체보다 **날짜 누락·순서 왜곡·카드 겹침·파생값 불일치**처럼 실제 정보 전달 문제를 본다.

---

# 11. MAIN ↔ ADD 통합 평가

통합 평가는 MAIN과 ADD가 같은 repository 안에서 공유하는 **전역 contract와 canonical 원천**을 확인하는 작업이다.

확인 예:

- 공통 viewport 분류
- Appearance / Theme contract
- Corner / surface 등 의도된 공통 UI contract
- 공통 asset 경로
- favicon
- KODEX leverage canonical 거래 data
- shared validator / schema
- Main 파생 별도수익과 Report 파생 실현손익의 원천 일치
- 서로 독립이어야 하는 runtime 책임을 불필요하게 결합하지 않았는지
- 문서 경로 / tests 경로 / README 안내 정합성

통합 평가의 목적은 “모든 것을 한 파일로 합치는 것”이 아니다.

```text
같은 semantic / 같은 contract
→ 공통화 가치 확인

서로 다른 page/runtime responsibility
→ 의도된 분리 인정
```

공통화 가능성만으로 감점하지 않고 실제 중복 관리 위험이나 contract drift가 있는지 본다.

---

# 12. Accessibility / Interaction 공통 평가

실제 static / dynamic markup에서 다음을 확인한다.

- `<a>` / `<button>` semantic
- button `type`
- keyboard
- `:focus-visible`
- dialog role / `aria-modal`
- focus trap / focus return / ESC
- label
- `aria-label`
- `aria-controls`
- `aria-labelledby`
- `aria-describedby`
- `aria-expanded`
- `aria-live` / status
- table caption / scope
- chart keyboard support
- hover-only 정보
- touch target
- contrast
- `user-select`
- `touch-action`
- `draggable`

Native `<select>` option UI와 의도된 PIN masking은 3장의 보호 규칙을 우선 적용한다.

---

# 13. 성능 / 유지보수성 평가

성능과 유지보수성은 실제 근거를 기준으로 본다.

다음은 실제 문제가 확인되지 않는 한 감점하거나 반복 개선안으로 제시하지 않는다.

```text
전체 dashboard render 방식
Date.now() 기반 cache bust
Vanilla JS
framework / state library 미사용
CSS 파일 개수
CSS / JS / MD의 길이·줄 수·byte 크기
대형 test/lint framework 부재
```

잠재적 가능성만으로 감점하지 않는다.

다음과 같은 실제 근거가 있을 때 재검토한다.

- 체감 지연
- profiling 병목
- 과도한 네트워크 요청
- 재현성 장애
- 반복 회귀와 직접 연결된 구조
- 변경 하나에 여러 파일이 불필요하게 동기 수정되는 실제 비용
- 문서/코드가 서로 다른 contract를 지속적으로 주장하는 문제

---

# 14. Runtime 평가 원칙

가능한 환경에서는 정적 분석에 더해 runtime smoke를 수행한다.

## 14.1 canonical 공개 평가 URL

```text
MAIN
https://tkfkd3226-cell.github.io/investment-dashboard

ADD Calc
https://tkfkd3226-cell.github.io/investment-dashboard/add/calc.html

ADD KODEX Leverage Report
https://tkfkd3226-cell.github.io/investment-dashboard/add/kodex-leverage-report.html
```

`평가`, `평가해줘`, `점수`, UI/UX 독립 평가에서는 사용자가 주소를 다시 제공하지 않아도 위 URL을 runtime 보조 검증에 사용할 수 있다.

단, GitHub Pages는 **배포된 revision의 runtime 보조 수단**이며 사용자가 제공한 최신 실제 소스의 Source of Truth를 대체하지 않는다.

- 최신 실제 소스와 배포본이 동일 revision인지 확인되지 않으면 결과를 `배포본 runtime`으로 구분한다.
- 공개 화면과 최신 실제 소스가 충돌하면 배포 지연·revision 차이 가능성을 먼저 확인한다.
- 공개 페이지를 근거로 최신 실제 소스를 되돌리지 않는다.
- 미배포 변경사항을 공개 페이지 화면만 보고 `최신 수정본 pixel/render PASS`라고 하지 않는다.
- QA에서는 공개 Pages를 PASS/FAIL 근거로 사용하지 않는다.
- Market AI가 tailnet 조건 때문에 연결되지 않는 사실만으로 frontend를 감점하지 않는다.

## 14.2 대표 viewport

MAIN 평가의 기본 대표 폭:

```text
1440
1024
900
768
430
390
```

현재 CSS에 기능성 exception이 있으면 필요한 폭을 추가한다.

ADD도 Desktop / Tablet / Mobile contract를 대표하는 폭을 사용하되, 평가 대상의 실제 responsive exception이 있으면 해당 폭을 추가한다.

이 viewport 숫자는 특정 screenshot pixel matching 목표가 아니라 **responsive contract 검증용 대표 폭**이다.

## 14.3 runtime smoke 예

- runtime exception
- duplicate id
- broken ARIA reference
- overflow / hidden collision
- modal focus
- table / tooltip clipping
- chart SVG size
- mobile layout
- light / dark
- 주요 interaction flow

브라우저 실행 환경이 없으면 실제 pixel/render를 확인했다고 하지 않고 `정적 코드 기준` 또는 `runtime smoke 미실시`라고 명시한다.

---

# 15. 평가 결과 작성 순서

전체 평가의 기본 순서는 다음과 같다.

1. 한눈에 보는 결론
2. 실제 프로젝트 구조
3. 검증 방법과 가능/불가 범위
4. CSS 상세 평가
5. JavaScript 상세 평가 + dependency 확인
6. Frontend ↔ backend / workflow contract
7. UI 영역별 평가
8. UX flow별 평가
9. Accessibility / Interaction
10. 성능 / 유지보수성
11. A / B / C 목록
12. 세부 점수표
13. 최종 결론

평가 범위가 ADD Calc나 특정 화면처럼 좁으면 해당 범위에 맞게 불필요한 장은 줄인다.

최종 결론에는 가능한 범위에서 다음을 명시한다.

- CSS 총점
- JavaScript 총점
- UI 총점
- UX 총점
- UI/UX 총점
- 전체 총점
- A/B/C 개수
- 현재 구조가 기준선으로 적절한지
- 추가 구조 리팩토링이 실제로 필요한지

## 15.1 답변 형식

- 일반 Markdown 제목, 문단, 표 중심
- selector/함수 증거가 필요한 경우만 짧은 코드 블록
- 검증 근거를 해당 평가 항목 가까이에 배치
- 점수표만 나열하지 않고 실제 근거 설명
- 과거 평가 문구를 복사하지 않음
- 최신 실제 코드에서 확인한 사실을 설명

## 15.2 영역별·기능별 상세 평가

사용자가 화면영역별·기능별 평가를 요청하면 전체 평균점수만 먼저 내지 않고, 실제 구성 요소를 inventory한 뒤 구성요소별로 평가한다.

필요한 경우 다음 상태 표현을 사용할 수 있다.

```text
완료
완료에 가까움
부분 완료
통합 필요
과토큰화
의도된 분리
```

상태명 자체가 점수를 자동 결정하지 않는다.

예:

- `의도된 분리`는 정상 구조라면 감점하지 않는다.
- `과토큰화`는 실제 탐색성·유지보수 비용이 있을 때만 감점한다.
- `완료에 가까움`도 실제 감점 사유가 없다면 억지로 99점을 만들지 않는다.

구성요소별 100점 평가를 요청받은 경우 **각 구성요소에서도 구체적인 감점 사유가 없으면 100점을 허용한다.**

---

# 16. 평가 전 최종 체크리스트

`점수` / `평가` / `평가해줘` 전에는 내부적으로 다음을 확인한다.

```text
[ ] 현재 평가 범위를 판정할 수 있는 최신 실제 소스를 확인했는가
[ ] 과거 평가 점수를 baseline으로 사용하지 않았는가
[ ] 해당 범위의 handover에서 현재 설계 의도를 확인했는가
[ ] 평가 보호 규칙을 먼저 확인했는가
[ ] KRX/Pension PIN, 개인보기 gesture, native select, render/cache bust 등 보호 항목을 잠재적 가능성만으로 감점하지 않았는가
[ ] 실제 재현·사용자 영향·구체적 오류가 없는 항목을 B급으로 억지 제시하지 않았는가
[ ] 실제 감점 근거가 없다면 100점을 허용했는가
[ ] 테스트 부재·개수 자체를 A/B 또는 감점·가산 근거로 사용하지 않았는가
[ ] 테스트 FAIL을 근거로 삼았다면 실제 기능/계산/UI contract 결함까지 확인했는가
[ ] 문서 오류와 실행 품질 문제를 구분했는가
[ ] runtime을 실행하지 못한 경우 실제 화면을 본 것처럼 쓰지 않았는가
[ ] ADD 평가에서 one-use literal을 토큰화 가능성만으로 감점하지 않았는가
[ ] MAIN↔ADD 평가에서 의도된 runtime 분리를 통합 부족으로 오판하지 않았는가
```

---

# 17. 최종 운영 원칙

평가의 우선순위는 다음과 같다.

1. 기능 정확성
2. 계산 parity
3. 실제 회귀 여부
4. 현재 책임 구조의 적절성
5. UI 일관성
6. UX와 접근성
7. 유지보수성
8. 성능

점수는 그 결과를 표현하는 보조 지표다.

점수를 올리기 위해 정상 구조를 계속 뜯지 않는다.

금지 예:

```text
!important 숫자를 줄이기 위한 억지 수정 제안
media query 개수만 줄이기
JS 파일을 점수 때문에 추가 분할
큰 함수라는 이유만으로 무조건 재작성
one-use literal을 점수 때문에 token화
미세 UI 수치 조정만으로 전체 점수 상승
```

평가의 최종 원칙은 다음 한 문장으로 요약한다.

> **최신 실제 구현을 처음부터 독립적으로 확인하고, 설계 의도를 존중하되 실제 재현 가능한 문제는 A/B/C와 점수에 숨김없이 반영하며, 구체적인 감점 사유가 없으면 100점을 허용한다.**
