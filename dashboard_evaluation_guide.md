# dashboard_evaluation_guide · 투자 대시보드 평가 기준

이 문서는 투자 대시보드 **MAIN + ADD 공통 평가 전용 기준서**다.

이 문서의 목적은 프로젝트를 수정하거나 인수인계하는 방법을 설명하는 것이 아니라, 사용자가 `점수`, `평가`, `평가해줘`를 요청했을 때 **무엇을 어떤 근거로 평가하고, 어떤 실패 가설을 새로 만들어 검증하며, 무엇은 감점하지 않고, 결과를 어떤 형식으로 작성할지**를 일관되게 정의하는 것이다.

평가의 목표는 기존 요구사항과 테스트의 준수 여부 확인에 그치지 않는다.

> **평가자는 새로운 실패 시나리오와 반례를 능동적으로 생성하여, 기존 테스트·설계·문서가 아직 인지하지 못한 결함까지 탐색해야 한다.**

평가의 기본 질문은 다음과 같다.

> **“현재 문제가 보이는가?”가 아니라, “어떤 사용자 행동 순서·비동기 실행 순서·경계값·상태 복원 조합이면 이 기능을 깨뜨릴 수 있는가?”를 먼저 묻는다.**

문서 역할은 다음처럼 분리한다.

| 문서/기록 | 역할 |
|---|---|
| [README.md](./README.md) | GitHub 프로젝트 소개 · 전체 구조 · 실행/배포 개요 |
| [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md) | MAIN 수정 · 유지보수 · QA · 장기 contract와 Main↔Add 공통 contract 정의 |
| [add_maintenance_handover.md](./add_maintenance_handover.md) | ADD Calc/Report 수정 · 유지보수 · QA · 장기 contract |
| [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md) | MAIN + ADD 평가 · 점수 · A/B/C · 반례 탐색 · 감점/비감점 기준 |
| Git history | 과거 변경 이력 |

평가는 항상 **최신 실제 소스를 독립적으로 다시 확인**하는 작업이다. 과거 평가 결과, 과거 점수, 현재 자동 테스트 PASS 여부는 최신 정상 판정의 출발점일 뿐 최종 근거가 아니다.

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
- 간단한 점수 요청이라도 100점을 부여하려면 이 문서의 **100점 Gate**와 **Counterexample Pass**를 내부적으로 충족해야 한다.

## 1.2 `평가` / `평가해줘`

두 표현은 같은 평가 명령으로 처리한다.

```text
최신 실제 소스 확인
→ 평가 보호 규칙 선확인
→ 프로젝트 구조와 현재 구현 inventory
→ 기존 contract / 테스트 확인
→ 상태 모델과 async boundary 식별
→ 실패 가설·반례 생성
→ CSS / JS / UI / UX 독립 평가
→ 접근성 / 성능 / 유지보수성 / 문서 의미 확인
→ 100점 반증 평가
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

범위가 좁더라도 해당 기능의 판정에 필요한 dependency / shared contract / responsive rule / persistence / async lifecycle은 필요한 만큼 함께 확인한다.

## 1.4 평가와 QA는 다른 작업이다

```text
평가
→ 현재 품질을 독립적으로 판정
→ 기존 요구사항 밖의 실패 시나리오도 새로 생성
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
| 평가·점수·A/B/C·감점 보호·반례 탐색 규칙 | [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md) |
| GitHub 프로젝트 설명·전체 구성 | [README.md](./README.md) |
| 과거 변경 이력 | Git history |

실제 코드와 문서가 다르면 문서를 근거로 코드를 자동으로 되돌리지 않는다.

```text
실제 구현 확인
→ 해당 handover의 장기 contract 확인
→ 회귀인지 문서 노후화인지 판단
→ 코드 결함인지 문서 semantic drift인지 구분
→ 평가 결과에 구분하여 기록
```

README / handover / workflow 설명이 실제 코드와 다르면 **문서 정확성 또는 semantic contract 문제**로 표시한다. 실행 품질과 직접 무관한 문서 오류를 CSS / JS / UI / UX 점수에 억지로 섞지 않되, 유지보수·운영 오판 가능성이 실제로 크면 B/A급 문서 결함으로 반영할 수 있다.

---

# 3. 평가 철학과 최우선 보호 규칙

## 3.1 평가 철학

평가자는 단순 체크리스트 수행자가 아니라 **실패 가설을 세우고 코드·상태·문서에서 반례를 검증하는 역할**을 한다.

평가의 기본 사고 순서는 다음과 같다.

```text
정상 contract 확인
→ 상태와 경계 식별
→ “어떻게 깨질 수 있는가?” 가설 생성
→ 실제 코드 흐름 추적
→ 재현 가능성/영향 판단
→ 기존 테스트가 보호하는지 확인
→ 감점 또는 비감점 판정
```

다음 방식은 충분한 평가로 보지 않는다.

```text
문법 오류 없음 → 정상
자동 테스트 전부 PASS → 정상
기존 체크리스트 전부 PASS → 100
과거 평가에서 100 → 이번에도 100
```

자동 테스트와 정적 검증을 통과한 뒤부터 **테스트 밖 상태공간 탐색이 시작**된다고 본다.

## 3.2 평가 보호 규칙

평가자는 점수 산정 전에 아래 보호 항목을 먼저 확인한다.

```text
보호 항목 선확인
→ 실제 재현 문제 / 사용자 영향 / 구체적 코드 오류가 있는지 확인
→ 실제 근거가 없으면 감점하지 않음
→ 실제 장점이 분명하지 않으면 B급 개선안으로도 만들지 않음
→ 충분한 적대적 평가 후에도 문제가 없으면 100 가능
```

다음은 이미 검토된 설계 의도·browser/native behavior·허용된 trade-off다. **실제 대상 환경에서 문제가 재현되지 않는 한 감점하거나 반복 개선안으로 제시하지 않는다.**

- **KRX·퇴직연금 Action PIN**: `type="text" + inputmode="numeric" + autocomplete="off" + -webkit-text-security:disc` 조합은 Chrome 비밀번호 저장 제안을 피하면서 숫자 PIN 마스킹을 유지하기 위한 의도된 구현이다. 비표준 CSS라는 이유만으로 credential `password` field로 되돌리지 않는다. 다만 PIN 요청의 **진행 중 닫기·중복 제출·재진입·실패 후 복구 lifecycle**은 별도로 평가한다.
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
- browser/native 대응을 위해 이유가 있는 `!important`, 기능성 media query, 긴 selector, fallback duplicate declaration은 **개수·형태만으로** 감점하지 않는다.
- `100vh → 100dvh`, `position:-webkit-sticky → position:sticky` 같은 명확한 progressive/browser fallback을 dead duplicate로 오판하지 않는다.

평가자가 새 문제를 제시하려면 최소 하나의 실제 근거가 있어야 한다.

```text
재현 가능한 bug
구체적 기능 불일치
실제 cascade / responsive 회귀
접근성 오류
실제 사용자 혼란 / 복구 어려움
비동기 race / stale state 경로
경계값·복원·재계산 오류
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
"테스트가 많으니 100"
"이전 버전에서 고쳤으니 이번에도 정상"
```

---

# 4. 점수 및 A / B / C 판정

## 4.1 CSS

기본 평가 축:

- 구조 / 파일 책임
- Cascade / Specificity
- Responsive
- Theme / Token
- Interaction CSS
- `!important`
- Dead / Legacy
- Runtime state class와의 정합성
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
- Async / Error / stale state
- Lifecycle / cleanup
- Persistence / restore
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
- Runtime rerender consistency
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
- re-entry / duplicate action 안정성
- 저장·복원·재계산 lifecycle
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

단, **100점은 20장의 100점 Gate를 모두 통과한 경우에만 허용**한다.

## 4.6 A — 실제 수정 권장

A는 데이터·기능·운영 결과에 중대한 영향을 주는 구체적 문제다.

대표 예:

- 데이터 손상 또는 손실 가능성
- 계산 오류 또는 잘못된 투자 결과 표시
- 보안 / 인증 / 권한 오류
- 중대한 async race로 사용자 의도와 다른 요청이 실행됨
- stale response로 최신 상태가 실질적으로 오염됨
- 주요 기능 작동 불능
- 잘못된 저장/복원으로 결과가 변조됨
- frontend-backend contract 파손
- 운영자가 잘못된 조작을 하게 만드는 중대한 문서 오류

가능하면 다음을 함께 적는다.

```text
파일 / selector / 함수 / 화면 영역
재현 또는 상태 전이 경로
현재 상태
실제 영향
판정 이유
기존 테스트가 놓친 이유
권장 수정 방향
회귀 테스트 후보
```

## 4.7 B — 수정 권장 또는 명확한 개선

B는 현재 대부분 정상이어도 **특정 순서·경계·입력 경로에서 실질적인 오류·혼란·유지보수 위험이 발생하는 문제**다.

대표 예:

- 특정 순서에서 발생하는 race / lifecycle 오류
- stale timer / listener / observer가 새 session에 개입
- 잘못된 경계값 처리 (`-0`, 이미 달성 상태의 의미 왜곡 등)
- keyboard 경로에서만 발생하는 기능 오류
- theme 변경 시 Canvas/SVG/runtime visual 재렌더링 누락
- restore 경로와 최초 입력 경로의 validation 불일치
- 실제 제품 기능과 README/MD 설명의 의미 불일치
- handover가 필수 schema context/field를 빠뜨려 유지보수자가 오판할 가능성
- workflow / CLI help / docstring이 서로 다른 동작을 같은 것으로 설명

B급을 채우기 위해 후보를 만들지 않는다.

- 보호 항목은 실제 문제가 재현되지 않는 한 B급으로 반복 제안하지 않는다.
- “더 현대적”, “더 짧음”, “더 토큰화 가능” 같은 이유만으로 제안하지 않는다.
- 문제를 재현하거나 코드 흐름으로 구체화할 수 없는 잠재 가능성은 감점하지 않는다.

## 4.8 C — 유지 또는 비감점 기록

C는 **실제 문제라기보다 현재 상태를 유지해야 할 이유가 있거나, 수정 이득이 매우 작은 항목**을 기록하는 분류다.

- 현재 설계 의도에 맞음
- browser native behavior
- progressive fallback
- 이미 검토된 trade-off
- 변경 이득보다 복잡도·회귀 위험이 큼
- 점수 목적의 정리
- 현재 구조에서 의도적으로 분리된 책임

C는 문제점을 억지로 만들기 위한 등급이 아니다.

A/B/C는 개수를 채우지 않는다. 실제 감점 근거가 없으면 A/B 0건이 정상이다.

---

# 5. 전체 평가 Workflow — 6 Pass

전체 평가 또는 100점 판정이 필요한 평가에서는 최소 다음 6 Pass를 순서대로 수행한다.

## Pass 1 — 구조 분석

목표: 현재 저장소가 무엇으로 구성되고 어떤 contract를 가지는지 파악한다.

확인:

- HTML / CSS / JS / Python / workflow / data / tests / MD inventory
- 실제 entry와 dependency graph
- CSS responsibility와 source order
- responsive contract
- shared schema / canonical data
- 문서와 실제 구조의 불일치
- syntax / reference / ARIA / duplicate id 등 정적 결함

**Pass 1의 PASS는 평가 종료 조건이 아니다.**

## Pass 2 — 기능 및 상태 모델 분석

목표: 각 주요 기능을 화면이 아니라 **state machine**으로 이해한다.

각 기능에 대해 가능한 경우 다음을 적어본다.

```text
idle
opening
ready
submitting/loading
success
error
closing
closed
re-opened
restored
```

그리고 다음을 식별한다.

- state owner
- session identity
- in-flight request
- timer
- listener / observer
- modal open/close
- 저장 상태
- theme / viewport / tab 같은 외부 상태
- 성공/실패 이후 cleanup

## Pass 3 — 적대적 시나리오 생성

목표: 정상 사용 순서가 아닌 **실패 가설**을 새로 만든다.

주요 interactive 기능마다 원칙적으로 **최소 5개의 비정상 순서 또는 반례 후보**를 생성한다. 기능이 단순하고 상태가 거의 없는 경우에는 합리적으로 줄일 수 있으나, `fetch`, modal, timer, localStorage, keyboard interaction이 있는 기능은 생략하지 않는다.

예:

```text
연타
중복 submit
작업 시작 직후 닫기
닫자마자 재열기
이전 요청보다 새 요청이 먼저 완료
실패 직후 재시도
처리 중 theme 변경
처리 중 viewport 변경
Tab으로 진입 후 Esc
저장된 예전 값을 복원 후 즉시 계산
```

## Pass 4 — 경계값 / 비동기 / 복원 집중 분석

목표: 단일 기능을 값과 시간축에서 공격한다.

필수 영역:

- Async / race
- stale response / stale error
- timer / cleanup
- numerical boundary
- persistence / restore
- runtime rerender
- keyboard state

각 boundary에서 **“이전 상태가 최신 상태를 덮는가?”**, **“다른 진입 경로에서도 같은 규칙인가?”**를 확인한다.

## Pass 5 — 코드 ↔ UI ↔ 테스트 ↔ 문서 의미 일치

목표: 문자열이나 파일 경로 수준을 넘어 실제 의미를 대조한다.

확인:

- 코드가 실제 제공하는 기능과 UI label
- README 기능 설명
- handover contract
- workflow input 설명
- Python docstring / CLI help
- JSON 예제와 실제 schema
- 테스트가 주장하는 contract와 production 구현
- Main ↔ Add 파생값 / theme / viewport contract

## Pass 6 — 100점 반증 평가

모든 평가가 끝난 뒤 **점수를 확정하기 전에 별도의 공격 평가를 한 번 더 수행**한다.

반드시 다음 질문을 한다.

> **“이 프로젝트에 100점을 주면 틀렸다고 반박할 수 있는 구체적인 반례가 무엇인가?”**

Pass 1~5에서 이미 확인한 내용을 반복하는 것이 아니라, 아직 안 본 조합을 찾는다.

예:

- 두 개의 정상 기능을 동시에 조작했을 때 충돌하는가
- 첫 `await` 뒤 최신성 guard가 있지만 두 번째 `await` 뒤에는 없는가
- 이전 session의 timer가 새 session을 건드리는가
- 실패 상태에서 닫기/재시도를 섞으면 guard가 영구적으로 잠기는가
- localStorage restore 직후 첫 렌더와 재계산 결과가 다른가
- CSS theme은 바뀌지만 Canvas/SVG 내부 픽셀은 남는가
- 문서의 기능 설명이 실제 UI에 존재하지 않는가

**Pass 6까지 수행한 뒤에도 구체적인 감점 사유를 찾지 못한 경우에만 100점을 허용한다.**

---

# 6. Static / Structural QA

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
- fallback declaration인지 실수성 duplicate인지 구분

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
- timer / observer / listener cleanup
- localStorage / restore entry
- theme/viewport runtime hooks

단순 함수 길이·파일 길이만으로 감점하지 않는다.

## 6.4 HTML / ARIA 정적 검증

가능하면 다음을 대조한다.

- duplicate `id`
- `aria-controls`
- `aria-describedby`
- `aria-labelledby`
- `aria-expanded`
- dialog role / `aria-modal`
- inline event handler
- inline style
- button `type`
- label / input 연결
- table caption / scope

정적 ARIA 검증이 PASS해도 실제 keyboard lifecycle은 별도 평가한다.

## 6.5 Python / Workflow

평가 범위에 포함될 때 다음을 확인한다.

- Python syntax
- workflow YAML parse
- workflow input 설명과 Python 실제 동작 정합성
- Python docstring / CLI help와 실제 분기
- 선택일 종목 가격·성과 갱신과 지수 historical backfill처럼 의미가 다른 operation의 구분
- 운영 data 보호

사용자가 별도 범위를 지정하지 않았다면 Python / Workflow 코드 품질을 MAIN frontend 점수에 과도하게 합산하지 않는다.

---

# 7. Contract QA와 자동 테스트 사용법

자동 테스트는 평가 점수 자체가 아니라 **현재 명시된 contract가 유지되는지 확인하는 증거**다.

```text
테스트 PASS
→ 현재 테스트가 알고 있는 contract는 만족
→ 평가 종료 아님
→ 테스트 밖 상태공간 탐색 시작

테스트 FAIL
→ 실제 코드/계산/UI contract 결함인지 확인
→ 낡은 테스트인지 확인
→ 실제 결함이 확인된 경우 그 결함을 평가
```

평가자는 가능하면 다음을 확인한다.

- 테스트가 production 함수 자체를 검증하는지
- 계산식 복사본을 따로 만들어 가짜 parity를 만들지 않는지
- responsive 숫자가 제품 contract인지 단순 장식값인지
- async / modal / restore의 상태 전이를 실제로 검증하는지
- stale response / timer / re-entry 같은 경로가 빠져 있는지

새로운 결함 가능성을 발견하면 다음 순서로 처리한다.

1. 실제 발생 가능한지 코드 흐름으로 검증
2. 기존 테스트가 왜 놓쳤는지 설명
3. 실제 결함이면 등급·점수에 반영
4. 가능하면 **regression test 후보**를 제안

현재 저장소의 자동 테스트 수나 파일 개수는 점수 기준이 아니다.

---

# 8. State Transition QA

상태가 있는 기능은 단순 기능 호출이 아니라 **전이 조합**을 평가한다.

## 8.1 공통 전이 패턴

반드시 가능한 범위에서 다음을 검토한다.

```text
열기 → 닫기
열기 → 작업 시작 → 닫기
작업 진행 중 → X
작업 진행 중 → Esc
작업 진행 중 → backdrop
닫기 → 즉시 재열기
성공 → 자동 닫기
실패 → 재시도
실패 → 닫기 → 재열기
활성 → 비활성 → 재활성
Tab focus → Esc → 재진입
저장 → 새로고침 → 복원 → 재계산
```

## 8.2 Session identity

modal, request, timer가 있는 기능에서는 다음을 확인한다.

- 새로 연 modal이 이전 modal과 같은 상태 객체를 공유하는가
- 이전 요청의 응답이 새 session을 덮을 수 있는가
- 이전 요청의 auto-close timer가 새 session을 닫을 수 있는가
- UI는 닫혔지만 서버 작업은 이미 실행된 경우 결과를 어떻게 전달하는가
- operation id / sequence / session token이 적절히 분리되는가

## 8.3 In-flight control

요청이 시작된 뒤 사용 가능한 interaction을 점검한다.

- submit/Enter 연타 차단
- X/Esc/backdrop 허용 여부
- 취소가 실제 서버 취소인지 단지 UI dismiss인지
- 진행 중 닫기 금지가 필요한 작업인지
- 실패 시 입력/닫기/재시도가 정상적으로 다시 활성화되는지
- 중복 종료 guard가 정상 성공/실패 모두에서 해제되는지

---

# 9. Async / Race Condition QA

비동기 코드는 `fetch()` 호출만 보지 않는다. 다음을 모두 **async boundary**로 간주한다.

- `fetch`
- 모든 `await`
- `response.json()`
- timer / timeout
- debounce / throttle
- animation completion
- event queue
- modal session
- external API
- server response
- request retry

## 9.1 최신성 guard 위치

각 `await` 전후를 추적한다.

```js
const response = await fetch(...)
if (seq !== currentSeq) return
const data = await response.json()
```

위와 같은 코드가 있어도 `response.json()` 뒤에 새 요청이 시작될 수 있으므로 **두 번째 async boundary 뒤의 최신성 검사 필요 여부**를 다시 본다.

검사 질문:

- 이전 응답이 최신 응답을 덮는가
- 이전 JSON parse 완료가 최신 상태를 덮는가
- 이전 JSON parse error가 최신 성공 상태를 오류로 되돌리는가
- request sequence가 success뿐 아니라 error/finally에서도 보호되는가

## 9.2 Stale timer / callback

- 이전 session의 `setTimeout`이 새 modal을 닫는가
- timer clear가 모든 exit path에서 실행되는가
- callback이 대상 element/session이 아직 동일한지 확인하는가
- debounce된 이전 입력이 최신 입력 결과를 덮는가

## 9.3 Duplicate action / idempotency

- Enter 연타
- double click
- submit + keyboard 중복
- 동일 request가 서버에 2회 전달되는지
- 서버가 idempotency/request id를 지원하는 경우 frontend가 올바르게 사용하는지
- UI에서 중복을 막아도 server execution이 이미 시작된 결과를 놓치지 않는지

## 9.4 Error race

성공 race뿐 아니라 **오류 race**를 별도로 본다.

```text
요청 A 시작
→ 요청 B 시작
→ B 성공
→ A parse/error 발생
→ A 오류가 최신 B 성공 UI를 덮는가?
```

`catch` / `finally`도 sequence/session guard 범위에 포함되는지 확인한다.

---

# 10. Boundary / Numerical QA

계산·입력 기능은 정상값만으로 평가하지 않는다.

최소 검토 후보:

- `0`
- `-0`
- 빈 값
- 최소값
- 최대값
- 정확히 경계값
- 경계보다 1 작은 값 / 1 큰 값
- 음수
- 매우 큰 값
- 이미 목표 달성
- 이미 회복 완료
- 분모 0 가능성
- rounding 전후 역전
- `NaN`
- `Infinity`
- 날짜 경계 / 월말 / 연말

## 10.1 계산값뿐 아니라 상태 의미까지 검증

숫자가 수학적으로 계산 가능하더라도 **UI 의미가 잘못되면 결함**일 수 있다.

예:

```text
이전 확정이익만으로 현재 투자금액까지 이미 회복됨
→ 자동 목표단가가 음수/0 기반 비정상값이 되지 않는가
→ 변동률이 -100%처럼 잘못된 의미를 표시하지 않는가
→ “이미 회복” 같은 별도 상태가 필요한가
```

## 10.2 Rounding / step

- `ceil5(0)`이 `-0`을 만들지 않는가
- 5원/10원 step 전후 경계
- rounding 후 validation 범위가 바뀌지 않는가
- 표시값과 내부 계산값이 모순되지 않는가
- 목표값이 현재가보다 낮아지는 특수 상태가 의미상 허용되는지

## 10.3 다음 계산까지 이어서 본다

경계값은 한 번 계산하고 끝내지 않는다.

```text
입력
→ 계산
→ 표시
→ validation
→ 저장
→ 복원
→ 수정
→ 재계산
```

어느 단계에서라도 의미가 깨지면 실제 결함으로 판단한다.

---

# 11. Persistence / Restore QA

저장 기능이 있는 경우 다음 lifecycle을 하나의 평가 단위로 본다.

```text
입력 → 계산 → 저장 → 새로고침 → 복원 → 수정 → 재계산
```

확인 대상:

- localStorage
- session state
- URL / hash
- 사용자 설정
- theme
- 선택 tab
- 계산 결과/입력값
- 이전 버전에서 저장된 데이터

필수 질문:

- 최초 입력 경로와 restore 경로가 같은 validation을 거치는가
- restore된 특수 상태가 다시 계산 가능 상태인가
- stale result가 복원되어 최신 입력과 섞이지 않는가
- schema 변경 시 예전 데이터가 안전하게 무시/보정되는가
- 복원 후 theme/chart/modal 상태가 일관되는가

---

# 12. Runtime / Theme / Canvas / Visual Lifecycle QA

CSS만 바뀐다고 모든 시각 요소가 갱신되는 것은 아니다.

다음 요소가 있으면 runtime rerender를 확인한다.

- Canvas
- SVG
- Chart.js 또는 custom chart
- inline calculated style
- dynamically measured modal
- tooltip position
- expanded chart
- print chart clone/render

## 12.1 Theme lifecycle

Light ↔ Dark 전환 시 다음을 구분한다.

```text
CSS variable 기반 DOM
→ CSS 변경만으로 갱신 가능

Canvas / JS로 그린 SVG / cached style
→ theme 변경 이벤트 후 재그리기 필요 가능
```

MAIN theme이 ADD에 동기화되는 것만 확인하지 말고, **ADD의 Canvas 차트가 실제로 즉시 새 theme으로 다시 그려지는지**까지 본다.

## 12.2 Viewport / mode lifecycle

- Desktop ↔ Tablet ↔ Mobile
- 세로 ↔ 가로
- card ↔ table
- tab 전환
- chart expanded open/close
- modal open 중 viewport change

상태 변경 후 계산된 크기·tooltip 좌표·chart geometry가 stale하지 않은지 확인한다.

---

# 13. Keyboard / Accessibility Interaction QA

ARIA 정적 검사를 통과했다고 keyboard UX가 정상인 것은 아니다.

필수 interaction 후보:

- Tab
- Shift+Tab
- Enter
- Space
- Esc
- focus return
- focus 유지
- modal focus trap
- tooltip keyboard open/close
- keyboard와 mouse state 충돌
- touch와 keyboard 경로의 의미 일치

## 13.1 Tooltip / 도움말

- hover뿐 아니라 focus로 열리는가
- Tab focus로 열린 상태에서 Esc로 닫을 수 있는가
- Esc가 tooltip만 dismiss해야 하는데 실제 input/button focus까지 강제로 날리지 않는가
- `is-dismissed` 같은 state가 필요해 focus를 유지하면서 재오픈을 제어하는가
- blur 후 다시 focus하면 정상적으로 열리는가

## 13.2 Modal

- open 시 초기 focus
- Tab / Shift+Tab trap
- Esc 정책
- backdrop 정책
- close 후 focus return
- in-flight request 동안 닫기 정책
- 실패 후 focus/interaction 복구

## 13.3 Motion 정책

현재 프로젝트 contract상 OS 모션 설정과 웹 motion을 연동하지 않는다. production CSS/JS의 `prefers-reduced-motion` 도입은 장기 contract와 충돌 여부를 먼저 확인한다.

---

# 14. Semantic Documentation QA

문서는 링크와 경로가 맞는지만 검사하지 않는다. **실제 제품이 무엇을 하는지 정확히 설명하는가**를 평가한다.

## 14.1 README 기능 설명

확인:

- 문서에 적힌 기능이 실제 존재하는가
- 기능명이 실제 UI와 같은가
- 실제보다 기능을 과장하지 않는가
- 이미 제거된 기능이 남아 있지 않은가
- “여러 추가매수 내역 관리”처럼 실제로는 단일 시나리오 입력인데 다중 관리 기능처럼 오해시키는 표현이 없는가

## 14.2 Workflow / Python 설명

서로 다른 operation은 명확히 구분해야 한다.

예:

- 선택일 종목 가격·성과 갱신
- 지정일까지의 KOSPI historical backfill

다음을 서로 대조한다.

- Workflow 주석
- workflow input description
- Python docstring
- CLI help
- Main handover
- README 설명

## 14.3 Schema / JSON 예시

handover의 JSON 예시는 단순 샘플이 아니라 유지보수자가 실제 구조를 이해하는 근거다.

확인:

- 실제 필수 context가 모두 설명되는가
- `julyAdd`, `augustFinalBuild.first`, `augustFinalBuild.second`처럼 production에서 실제 사용하는 context가 예시에서 빠지지 않는가
- 각 context의 필수 field가 빠지지 않는가
- `qty / buy / date` 같은 핵심 구조가 명확한가
- 실제 production schema와 예제가 drift하지 않는가

## 14.4 문서 오류의 등급

- 단순 오탈자: 필요 시 C 또는 무감점
- 유지보수자가 기능을 잘못 이해할 가능성: B
- 운영/데이터 처리 방향을 잘못 안내할 위험: B~A

문서 문제를 CSS/JS/UI 점수에 억지로 넣지 않되 전체 유지보수성/평가 총점에는 실제 영향에 맞게 반영할 수 있다.

---

# 15. Adversarial Pattern Library

아래는 과거 결함을 외우기 위한 목록이 아니라 **같은 종류의 아직 발견되지 않은 결함을 찾기 위한 seed**다.

| 패턴 | 평가 질문 |
|---|---|
| Duplicate Action | Enter 연타, 더블클릭, submit 중복은 안전한가 |
| Stale Response | 이전 응답이 최신 상태를 덮을 수 있는가 |
| Multi-await Race | 첫 `await` 뒤 검사했어도 다음 `await` 뒤 다시 검사해야 하지 않는가 |
| Stale Error | 이전 요청 오류가 최신 성공 상태를 덮을 수 있는가 |
| Modal Session | 닫기→재열기 시 이전 작업과 새 작업이 분리되는가 |
| Stale Timer | 이전 timer가 새 UI session을 건드리는가 |
| In-flight Close | 서버 요청 시작 후 X/Esc/backdrop이 허용돼도 되는가 |
| Re-entry | 처리 도중 같은 기능에 다시 진입해도 안전한가 |
| Theme Render | CSS 변경 외 Canvas/SVG 재렌더링이 필요한가 |
| Keyboard State | mouse와 keyboard 경로에서 state가 동일한가 |
| Focus Dismiss | Esc가 overlay만 닫아야 하는데 focus까지 제거하지 않는가 |
| Boundary State | 0/-0/이미 달성/정확한 경계에서 의미가 깨지지 않는가 |
| Rounding Drift | rounding 전후 validation/표시 의미가 달라지지 않는가 |
| Persistence Drift | 최초 입력과 restore 이후 결과가 같은가 |
| Old Schema Restore | 이전 버전 저장 데이터가 최신 계산을 오염시키지 않는가 |
| Documentation Drift | 문서가 실제 없는 기능 또는 옛 기능을 설명하지 않는가 |
| Schema Drift | 문서 예제가 실제 필수 schema를 모두 설명하는가 |
| Workflow Semantic Drift | 서로 다른 작업을 같은 동작처럼 설명하지 않는가 |
| Cleanup Leak | listener/timer/observer가 이전 session 이후 남지 않는가 |
| Cross-state Collision | theme/tab/viewport 변경이 진행 중 request와 충돌하지 않는가 |
| Partial Success | 일부 endpoint 성공/실패가 다른 상태를 잘못 초기화하지 않는가 |
| Server Already Executed | UI가 닫혔어도 이미 실행된 서버 결과를 사용자에게 안전하게 전달하는가 |

평가자는 Pattern Library를 체크박스처럼 끝내지 않는다.

```text
패턴 선택
→ 현재 코드에 맞는 새로운 실패 가설 생성
→ 실제 함수/상태/DOM 흐름 추적
→ 재현 가능성 판정
→ 테스트 보호 여부 확인
```

---

# 16. MAIN 평가 기준

MAIN 상세 architecture / module ownership / CSS ownership / responsive contract의 현재 canonical 내용은 `main_dashboard_maintenance_handover.md`를 참고한다. 평가 문서는 구조를 복제하지 않고 **평가 관점**만 정의한다.

## 16.1 MAIN CSS

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
- state class가 JS lifecycle과 일치하는지

`continuation`, cross-cutting rule, selector 길이, 기능성 media query는 실제 이유와 영향을 보고 판단한다.

`!important`는 개수만으로 감점하지 않는다.

## 16.2 MAIN JavaScript

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
- modal/session identity
- timer cleanup
- restore/re-entry

현재 handover가 정의하는 의도된 책임 분리를 “파일이 많다”는 이유로 합치도록 권하지 않는다.

## 16.3 Frontend ↔ Backend contract

### KRX

현재 frontend의 실제 mode와 request contract를 확인한다.

특히 다음 lifecycle을 반드시 본다.

```text
Enter/submit 중복
→ request 시작
→ modal 닫기 시도
→ 재열기
→ 이전 response 도착
→ success/skip/error feedback
→ auto-close timer
```

확인:

- 중복 요청 방지
- request/session sequence
- 닫기→재열기 시 이전 응답이 새 modal을 덮지 않는지
- 이전 자동 닫기 timer가 새 session을 닫지 않는지
- UI가 닫힌 뒤 서버에서 이미 실행된 결과를 별도 Toast 등으로 안전하게 전달하는지
- 선택 날짜가 화면에 존재한다는 사실과 request body의 `date` 존재 여부를 혼동하지 않는지

GAS가 제공된 경우에만 server handler까지 완전 대조한다.

### Pension

현재 frontend가 사용하는 upsert / delete / batch 계열 request, request id / PIN / operations / response / duplicate·idempotency 처리를 실제 코드와 대조한다.

특히 PIN modal의 다음 전이를 본다.

```text
입력
→ request 시작
→ X/Esc/backdrop
→ 성공
→ 실패
→ 재시도
→ 중복 종료
```

요청 시작 후 닫기를 막아야 하는 contract라면 실제로 모든 닫기 경로가 차단되는지, 실패 시 입력·닫기가 다시 활성화되는지, 중복 종료 guard가 안전한지 확인한다.

server contract는 최신 GAS가 제공된 경우에만 완전 대조한다.

### Market AI

Market AI 백엔드는 기본 MAIN 평가 대상에서 제외한다.

대시보드에서는 필요한 범위에서 다음을 확인한다.

- frontend adapter 구조
- main graph와의 책임 분리
- mount / polling / timeout / stale 처리
- endpoint별 실패 격리
- CSS ownership
- request sequence가 `fetch` 이후뿐 아니라 `response.json()` 이후에도 최신성을 보장하는지
- 이전 JSON 응답 또는 이전 parse error가 최신 상태를 덮지 않는지

```text
백엔드 미첨부·미연결
→ MAIN CSS / JS / UI / UX 감점 없음

백엔드 최신 소스 + 별도 평가 요청
→ Market AI backend를 별도 범위로 평가
→ MAIN 점수와 자동 합산하지 않음
```

## 16.4 MAIN UI

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
runtime visual refresh
```

## 16.5 MAIN Table

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

## 16.6 MAIN Tooltip / Overlay / Modal

- trigger semantic
- open / close
- outside click
- ESC
- focus trap / focus return
- ARIA
- viewport overflow
- stacking
- light / dark
- in-flight request 상태
- close→re-open session separation
- stale timer / listener cleanup

## 16.7 MAIN 주요 UX flow

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

각 flow는 정상 순서뿐 아니라 **중복·닫기·재진입·실패·theme/viewport 변경**을 섞어 공격한다.

## 16.8 MAIN Print

Print 관련 CSS를 dead로 판단하기 전에 실제 print lifecycle과 chart render 경로를 확인한다.

평가 시 실제 인쇄 contract가 현재 handover와 코드에 맞는지 보고, 비활성 상태 때문에 빈 차트·누락 카드·레이아웃 침범 등이 발생하는 실제 회귀가 있을 때만 감점한다.

---

# 17. ADD 공통 평가 기준

ADD 상세 계산·UI·responsive contract의 Source of Truth는 `add_maintenance_handover.md`다.

평가 시 `calc.html`, `kodex-leverage-report.html`, `add/add.css`, `add/add.js` 및 관련 canonical data / validator / tests를 실제로 확인한다.

## 17.1 ADD 토큰화·공통화 감점 원칙

ADD의 토큰화·공통화 평가는 **literal 값의 존재 자체가 아니라 공통화 필요성과 유지보수 위험**을 기준으로 한다.

- 페이지/컴포넌트에 한 번만 쓰이는 고유 색상·표현값은 그 자체로 감점하지 않는다.
- Light/Dark 대응이 정상이고 동일 semantic의 반복값이 아니며 유지보수상 단일 source가 필요하지 않은 값은 local literal로 유지할 수 있다.
- one-use 값을 단지 “더 토큰화할 수 있다”는 이유로 token으로 승격하도록 요구하거나 감점하지 않는다.
- 불필요한 one-use token 증가는 피한다.
- 동일 semantic 값이 여러 곳에서 반복되는데 공통 source가 없거나 literal 분산 때문에 일관성·수정성·회귀 위험이 실제로 생기는 경우에만 감점한다.
- component-local / page-specific color literal이 위 조건을 만족하면 Semantic Color 감점 사유로 보지 않는다.

> **평가 기준은 “더 토큰화할 수 있는가”가 아니라 “공통화해야 할 이유가 있는데도 분산되어 있는가”다.**

## 17.2 ADD 자동 테스트와 평가 점수 분리

- Add 자동 테스트는 계산·UI 회귀를 확인하는 QA 안전망이다.
- 테스트 파일의 존재 여부나 테스트 개수 자체는 Add 평가 가산·감점 기준이 아니다.
- 자동 테스트가 없다는 이유만으로 B급을 만들거나 감점하지 않는다.
- 테스트 FAIL은 실제 결함인지 변경된 의도에 비해 테스트가 낡은 것인지 구분한다.
- 실제 결함이 확인된 경우에만 그 결함 자체를 평가한다.
- 자동 테스트 PASS는 UI 미감·정보 위계·실기 UX·async lifecycle까지 자동 PASS한다는 뜻이 아니다.
- UI contract 테스트는 폐기 시 실제 회귀가 생기는 구조·상태·responsive·접근성 경계를 보호하는지 본다.
- 장식용 exact px/hex/shadow/opacity나 DOM 개수처럼 정상적인 디자인 수정에도 자주 바뀌는 구현값을 과도하게 contract로 고정했다고 판단되는 경우 실제 유지보수 영향을 확인한다.
- viewport 경계처럼 숫자 자체가 제품 동작인 값은 contract 검증이 가능하다.

## 17.3 ADD 공통 UI / Responsive

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
- MAIN에서 동기화된 theme이 runtime chart에도 적용되는지

MAIN과 모양이 비슷하다는 이유만으로 CSS/JS runtime을 억지로 합치도록 권하지 않는다. 실제 공통화 이득과 coupling 위험을 함께 본다.

---

# 18. ADD Calc 평가 기준

Calc 평가는 단순 UI뿐 아니라 **계산식·validation·경계값·stale-result·persistence·keyboard UX**까지 포함한다.

## 18.1 계산 정확성

`add_maintenance_handover.md`가 정의하는 현재 계산 contract와 production `compute() / validate() / ceil5()` 등 실제 구현을 대조한다.

확인:

- 입력값 validation
- 계산식 일관성
- 단위 / 반올림 / step
- 목표값 / 결과값 관계
- invalid 입력 후 이전 결과가 stale 상태로 남아 사용자를 오도하지 않는지
- 기본값 복원과 관련 state reset
- production 계산식과 테스트가 서로 다른 복사본으로 분기되지 않는지
- `0 / -0 / 이미 회복 / 이미 목표 달성` 상태
- localStorage 복원 후 동일 validation/계산 contract 유지

실제 계산 오류가 확인되면 UI 점수에만 묻지 않고 기능 정확성 문제로 명확히 기록한다.

## 18.2 Calc 경계값 필수 시나리오

최소 다음을 별도로 검토한다.

```text
ceil5(0)
목표단가가 현재 종가와 정확히 같은 경우
이전 확정이익만으로 이미 투자금액을 회복한 경우
분모가 0에 가까운 경우
수량/단가 최소·최대
step 직전/직후
localStorage에서 복원된 특수 상태
```

“이미 회복”처럼 계산 결과가 숫자보다 **상태 의미**로 표현되어야 하는 경우를 식별한다.

## 18.3 Calc UI

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

## 18.4 Calc UX

- 입력 → 검증 → 계산 → 결과 흐름
- invalid / edge case feedback
- 기본값 복원
- stepper 조작
- 모바일 입력 편의
- stale result 제거
- 잘못된 결과를 확정값처럼 보이게 하지 않는지
- 도움말을 hover/focus로 열었을 때 Esc 처리
- Esc가 focus를 강제로 날리지 않는지
- dismiss state와 재진입 일관성

---

# 19. ADD KODEX Leverage Report 평가 기준

Report 평가는 **canonical 거래 data → 계산 파생 → 요약/차트/표/Timeline 표현 → theme/runtime lifecycle**의 정합성을 중심으로 본다.

## 19.1 canonical data

현재 `add_maintenance_handover.md`와 실제 data/validator를 기준으로 다음을 확인한다.

- canonical 거래 파일 경로
- 거래일 정렬 / 중복
- 필수 numeric type
- segment 구조
- validation
- Main 파생값과 Report 파생값의 공통 원천 일치
- handover JSON 예제가 `julyAdd`, `augustFinalBuild.first`, `augustFinalBuild.second` 등 실제 context와 `qty / buy / date` 필수 field를 빠뜨리지 않는지

문서와 실제 canonical 경로가 다르면 문서/contract 오류로 구분한다.

## 19.2 손익 계산 정합성

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

## 19.3 Report UI / Runtime

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
- MAIN theme 동기화 후 Canvas chart 즉시 redraw

Timeline은 장식 자체보다 **날짜 누락·순서 왜곡·카드 겹침·파생값 불일치**처럼 실제 정보 전달 문제를 본다.

---

# 20. MAIN ↔ ADD 통합 평가

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
- MAIN theme 변경이 ADD DOM뿐 아니라 Canvas 등 runtime visual에도 전달되는지

통합 평가의 목적은 “모든 것을 한 파일로 합치는 것”이 아니다.

```text
같은 semantic / 같은 contract
→ 공통화 가치 확인

서로 다른 page/runtime responsibility
→ 의도된 분리 인정
```

공통화 가능성만으로 감점하지 않고 실제 중복 관리 위험이나 contract drift가 있는지 본다.

---

# 21. 성능 / 유지보수성 평가

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
- cleanup 누락 때문에 event/timer가 누적되는 실제 경로
- stale request가 반복적으로 최신 상태를 덮는 구조

---

# 22. Runtime 평가 원칙

가능한 환경에서는 정적 분석에 더해 runtime smoke를 수행한다.

## 22.1 canonical 공개 평가 URL

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

## 22.2 대표 viewport

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

## 22.3 runtime smoke 예

- runtime exception
- duplicate id
- broken ARIA reference
- overflow / hidden collision
- modal focus
- table / tooltip clipping
- chart SVG/Canvas size
- mobile layout
- light / dark
- 주요 interaction flow
- double click / Enter 연타
- modal close→re-open
- stale timer
- theme 변경 후 chart rerender
- localStorage restore 후 재계산

브라우저 실행 환경이 없으면 실제 pixel/render를 확인했다고 하지 않고 `정적 코드 기준` 또는 `runtime smoke 미실시`라고 명시한다.

---

# 23. 평가 결과 작성 순서

전체 평가의 기본 순서는 다음과 같다.

1. 한눈에 보는 결론
2. 실제 프로젝트 구조
3. 검증 방법과 가능/불가 범위
4. **이번 평가에서 새로 생성한 주요 실패 가설 / 적대적 시나리오 요약**
5. CSS 상세 평가
6. JavaScript 상세 평가 + dependency / state / async 확인
7. Frontend ↔ backend / workflow contract
8. UI 영역별 평가
9. UX flow별 평가
10. Boundary / Persistence / Keyboard / Runtime lifecycle
11. Semantic Documentation QA
12. Accessibility / Interaction
13. 성능 / 유지보수성
14. **100점 Counterexample Pass 결과**
15. A / B / C 목록
16. 세부 점수표
17. 최종 결론

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
- 자동 테스트 밖에서 새로 검토한 실패 시나리오가 무엇인지
- 100점이라면 Counterexample Pass까지 통과했는지

## 23.1 답변 형식

- 일반 Markdown 제목, 문단, 표 중심
- selector/함수 증거가 필요한 경우만 짧은 코드 블록
- 검증 근거를 해당 평가 항목 가까이에 배치
- 점수표만 나열하지 않고 실제 근거 설명
- 과거 평가 문구를 복사하지 않음
- 최신 실제 코드에서 확인한 사실을 설명
- “테스트 전부 PASS”를 최종 결론의 핵심 근거처럼 쓰지 않음
- 새 결함을 찾았다면 **재현 순서 또는 상태 전이**를 함께 적음

## 23.2 영역별·기능별 상세 평가

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

구성요소별 100점 평가를 요청받은 경우 **각 구성요소에서도 구체적인 감점 사유가 없고 해당 범위의 adversarial/Counterexample 검토까지 완료됐으면 100점을 허용한다.**

---

# 24. 100점 Gate와 Counterexample Pass

기존 원칙인 **“구체적인 감점 사유가 없으면 100점”**은 유지한다. 단, “감점 사유가 없다”는 판단 전에 아래 Gate를 모두 통과해야 한다.

## 24.1 100점 Gate

```text
[ ] 전체 자동 QA가 실행 가능한 범위에서 PASS했는가
[ ] A/B급 미해결 문제 0건인가
[ ] 구조 QA에서 실질적 문제 0건인가
[ ] 주요 state transition을 분석했는가
[ ] async/race boundary를 분석했는가
[ ] 경계값을 분석했는가
[ ] persistence/restore를 분석했는가
[ ] keyboard/accessibility interaction을 분석했는가
[ ] theme/runtime Canvas/SVG lifecycle을 분석했는가
[ ] README/handover/workflow/schema semantic QA를 수행했는가
[ ] 주요 interactive 기능별 adversarial scenario를 생성·검토했는가
[ ] 기존 테스트가 놓칠 수 있는 상태공간을 따로 탐색했는가
[ ] 마지막 Counterexample Pass에서도 새로운 구체적 감점 사유가 없었는가
```

환경상 일부 runtime 검증이 불가능하면 그 사실을 명확히 쓰고, 가능한 정적·코드 흐름 분석으로 대체한다. 단, 실제 화면을 보지 않았으면서 pixel/runtime까지 100이라고 단정하지 않는다.

## 24.2 Counterexample Pass 질문

점수를 확정하기 직전 최소 다음을 다시 묻는다.

```text
이 기능을 연타하면?
닫자마자 다시 열면?
응답 순서가 뒤집히면?
첫 await 이후 또 await가 있으면?
이전 오류가 최신 성공을 덮으면?
이전 timer가 새 session에 남으면?
처리 중 theme/viewport/tab이 바뀌면?
저장된 예전 값을 복원하면?
정확히 0 또는 경계값이면?
mouse 대신 keyboard로만 조작하면?
문서가 실제 없는 기능을 설명하고 있으면?
JSON 예제가 실제 필수 context를 누락하면?
```

이 질문들은 예시다. 평가자는 현재 코드에 맞는 새 반례를 추가해야 한다.

## 24.3 100점과 99점의 사용

- 충분한 6 Pass + 100점 Gate + Counterexample Pass 후에도 구체적 문제를 찾지 못했다면 **100점**을 부여한다.
- “아마 뭔가 있을 것 같아서”, “완벽한 소프트웨어는 없어서” 같은 이유로 99/99.5를 남겨두지 않는다.
- 반대로 100점 Gate를 수행하지 않았는데 기존 테스트와 정적 검사만 통과했다는 이유로 100점을 주지 않는다.

---

# 25. 평가 전 최종 체크리스트

`점수` / `평가` / `평가해줘` 전에는 내부적으로 다음을 확인한다.

```text
[ ] 현재 평가 범위를 판정할 수 있는 최신 실제 소스를 확인했는가
[ ] 과거 평가 점수를 baseline으로 사용하지 않았는가
[ ] 해당 범위의 handover에서 현재 설계 의도를 확인했는가
[ ] 평가 보호 규칙을 먼저 확인했는가
[ ] KRX/Pension PIN, 개인보기 gesture, native select, render/cache bust 등 보호 항목을 잠재적 가능성만으로 감점하지 않았는가
[ ] 실제 재현·사용자 영향·구체적 오류가 없는 항목을 B급으로 억지 제시하지 않았는가
[ ] 테스트 부재·개수 자체를 A/B 또는 감점·가산 근거로 사용하지 않았는가
[ ] 테스트 PASS를 평가 종료 조건으로 사용하지 않았는가
[ ] 테스트 FAIL을 근거로 삼았다면 실제 기능/계산/UI contract 결함까지 확인했는가
[ ] 주요 기능의 state machine / session identity를 확인했는가
[ ] fetch뿐 아니라 모든 await/json/timer를 async boundary로 봤는가
[ ] stale response뿐 아니라 stale error도 확인했는가
[ ] 0/-0/이미 달성/정확한 경계값을 확인했는가
[ ] 저장→복원→수정→재계산 흐름을 확인했는가
[ ] mouse 외 keyboard 경로도 확인했는가
[ ] theme 변경 시 Canvas/SVG/runtime visual 재렌더링을 확인했는가
[ ] README/MD가 실제 기능을 과장하거나 옛 기능을 설명하지 않는지 확인했는가
[ ] workflow/Python/docstring/CLI help의 의미가 일치하는가
[ ] schema 문서 예제가 실제 필수 context/field를 설명하는가
[ ] 문서 오류와 실행 품질 문제를 구분했는가
[ ] runtime을 실행하지 못한 경우 실제 화면을 본 것처럼 쓰지 않았는가
[ ] ADD 평가에서 one-use literal을 토큰화 가능성만으로 감점하지 않았는가
[ ] MAIN↔ADD 평가에서 의도된 runtime 분리를 통합 부족으로 오판하지 않았는가
[ ] 주요 interactive 기능마다 새로운 adversarial scenario를 생성했는가
[ ] 마지막에 100점을 깨는 반례를 별도로 찾아봤는가
[ ] 충분한 반증 평가 후 실제 감점 근거가 없다면 100점을 허용했는가
```

---

# 26. Regression Test 제안 원칙

평가 중 기존 테스트가 놓친 실제 결함을 발견하면, 수정 작업을 수행하지 않더라도 가능한 경우 회귀 테스트 후보를 함께 제시한다.

좋은 회귀 테스트는 **발견된 버그의 구현 세부가 아니라 실패 contract**를 보호한다.

예:

```text
KRX
→ modal A request 진행 중 close/re-open 후 A 응답이 modal B를 덮지 않는다.

Market AI
→ request A의 json parse가 늦게 끝나도 request B의 최신 상태를 덮지 않는다.

Calc
→ 이미 회복 상태를 저장/복원/재계산해도 -100%나 invalid 상태로 돌아가지 않는다.

Report
→ MAIN theme 변경 후 Canvas chart의 실제 drawing theme도 즉시 갱신된다.
```

피해야 할 테스트:

- exact DOM 개수만 고정
- 장식용 px/hex/shadow/opacity를 불필요하게 고정
- production 계산식과 별도 복사본을 테스트 내부에 만들어 같은 실수를 공유
- 현재 구현 방식만 보호하고 사용자 contract를 보호하지 않는 테스트

---

# 27. 최종 운영 원칙

평가의 우선순위는 다음과 같다.

1. 기능 정확성
2. 계산 parity
3. 비동기·상태전이 안전성
4. 저장·복원·재계산 일관성
5. 실제 회귀 여부
6. 현재 책임 구조의 적절성
7. UI 일관성
8. UX와 접근성
9. 문서 semantic 정확성
10. 유지보수성
11. 성능

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
테스트 개수 증가 자체를 품질 향상으로 평가
발견 가능한 반례 탐색 없이 PASS 숫자만으로 100점 선언
```

평가의 최종 원칙은 다음 두 문장으로 요약한다.

> **최신 실제 구현을 처음부터 독립적으로 확인하고, 설계 의도를 존중하되 실제 재현 가능한 문제는 A/B/C와 점수에 숨김없이 반영한다.**
>
> **기존 테스트와 체크리스트가 놓친 상태공간을 능동적으로 공격하고 100점을 깨는 반례를 끝까지 찾아본 뒤에도 구체적인 감점 사유가 없을 때만 100점을 부여한다.**
