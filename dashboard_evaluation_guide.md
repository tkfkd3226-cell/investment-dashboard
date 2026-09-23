# dashboard_evaluation_guide · 투자 대시보드 평가 기준

> **문서 성격**: 이 문서는 Dashboard의 **평가 방법**만 정의합니다. 실제 Main/Add 기능·selector·state ownership·responsive 수치·GAS 운영 구현은 각 handover와 최신 소스가 소유합니다. 이 문서에는 평가에 필요한 점수축, A/B/C 의미, 반례 탐색, GAS 평가 강도, 출력 형식과 종료 기준만 둡니다.

평가의 목표는 기존 테스트를 다시 읽는 것이 아니라 **최신 실제 소스에서 현실적인 실패 가설을 만들고 반증하는 것**입니다. 반대로 이론적으로 가능한 모든 희귀 조합을 끝없이 생성하거나, 코드가 정교하다는 이유로 합격선을 계속 높이지 않습니다.

## 1. 평가 명령과 범위

### `점수`

최신 실제 소스를 필요한 범위에서 확인해 CSS / JavaScript / UI / UX 점수를 새로 산정합니다. 사용자가 범위를 좁히지 않은 전체 점수 요청에서는 root `GAS_code.js`가 제공되어 있으면 **GAS 서버 점수도 별도로** 표시합니다.

`점수`는 파일을 수정하지 않으며, 과거 점수를 복사하지 않습니다. 100점은 이 문서의 적용 가능한 100점 Gate와 bounded Counterexample Pass를 통과했을 때만 허용합니다.

### `평가` / `평가해줘`

상세 평가로 처리합니다.

```text
최신 실제 소스 확인
→ 범위와 Source of Truth 확인
→ 구조 / 상태 / async boundary inventory
→ 기존 테스트가 보호하는 계약과 보호하지 않는 상태공간 구분
→ 현실적인 실패 가설 생성
→ CSS / JS / UI / UX 독립 평가
→ `ct35_evaluation.md` 1~35 전수 평가 + 별도 CT35 표 출력
→ [범위상 포함 시] GAS 서버 독립 평가
→ 문서 semantic 정합성 확인
→ bounded Counterexample Pass
→ A / B / C 판정 및 점수 확정
```

### 범위 규칙

- `MAIN만`, `ADD만`, `Calc`, `Report`, `CSS만`, `JS만`, 특정 화면·기능처럼 범위를 명시하면 그 범위만 평가합니다.
- 범위가 좁아도 판정에 필요한 dependency/shared contract는 필요한 만큼 확인합니다.
- `평가` / `평가해줘` / `전체 평가` / `상세 평가` / `영역별 평가` / `기능별 평가`에서는 **반드시 `ct35_evaluation.md`를 읽고 1~35 전 항목을 별도 섹션으로 출력**합니다. 전체 평가에서는 Main/Add 독립 점수와 판정을 35개 모두 기록하고, 특정 기능·화면처럼 범위가 좁으면 CT35의 집중평가 규칙대로 각 항목을 `적용 / 간접 적용 / N/A`로 먼저 분류한 뒤 **1~35 행 자체는 생략하지 않습니다**.
- `점수` / `점수만`은 간결 출력 계약을 유지하므로 CT35 판단을 CSS 점수에 반영하되, 사용자가 별도로 요구하지 않으면 35개 전수 표 출력은 생략할 수 있습니다.
- 범위를 좁히지 않은 `점수` / `평가` / `평가해줘` / `전체 평가`에서는 root `GAS_code.js`가 있으면 GAS를 별도 서버 평가축으로 포함합니다.
- 좁은 Dashboard 평가에서는 GAS 내부를 자동 전수평가하지 않습니다. frontend 기능 판정에 필요한 API shape만 dependency로 확인할 수 있습니다.
- `GAS 포함`, `GAS_code.js도`, `frontend↔GAS 통합`처럼 명시되면 좁은 평가와 함께 GAS 평가를 수행합니다.
- 전체 평가인데 `GAS_code.js`가 누락되면 GAS 점수를 추정하지 않고 `필수 평가 소스 누락`으로 표시합니다.

### 평가와 QA의 구분

```text
평가
→ 현재 snapshot의 품질을 독립 판정
→ 기존 요구사항 밖의 현실적인 실패 시나리오도 생성
→ 점수 / A·B·C / 구조·UI·UX 판정

QA
→ 방금 수정한 current revision의 회귀 여부 확인
→ 각 handover의 변경 유형별 QA 절차를 따름
```

GitHub Pages 공개본은 동일 revision이 확인되지 않으면 수정 직후 QA의 PASS/FAIL 근거로 사용하지 않습니다.

## 2. Source of Truth와 문서 역할

| 확인 대상 | Source of Truth |
|---|---|
| 실제 현재 동작 | 최신 HTML / CSS / JS / data / scripts / workflows / tests |
| Main 유지보수 contract | `main_dashboard_maintenance_handover.md` |
| Add 유지보수 contract | `add_maintenance_handover.md` |
| Main↔Add 공통 contract | Main handover 8장 + 관련 Cross test |
| 공통화·토큰화 35개 Rubric | `ct35_evaluation.md` |
| 전체 평가 방법·점수·A/B/C·종료 기준 | 이 문서 |
| 프로젝트 소개·전체 구조 | `README.md` |
| 과거 변경 이력 | Git history |

실제 코드와 문서가 다르면 문서를 근거로 코드를 자동으로 되돌리지 않습니다. **코드 회귀인지 문서 semantic drift인지 먼저 구분**합니다.

## 3. 평가 보호 원칙

평가자는 문제를 만들기 위해 평가하지 않습니다. 다음은 실제 재현 문제나 사용자 영향이 없는 한 그 자체로 감점하지 않습니다.

- Vanilla JS / framework·state library 미사용
- CSS/JS/MD 파일 수·길이·byte 크기
- 자동 테스트 파일 수·case 수·coverage 수치
- Playwright/Jest/ESLint/Stylelint 같은 대형 인프라 부재
- browser/native fallback, 이유 있는 `!important`, 기능성 media query
- native `<select>`의 OS/browser rendering 차이
- 개인보기 3회 private gesture의 discoverability
- PIN의 의도된 numeric text + masking 구현
- 전체 render 방식이나 cache bust가 실제 병목을 만들지 않는 경우
- one-use literal을 더 token화할 수 있다는 가능성
- 의도적으로 분리된 Main/Add 또는 feature별 계산/state/persistence 책임

자동 테스트는 **증거 중 하나**입니다. PASS만으로 100점을 주지 않고, FAIL도 실제 기능/계산/UI contract 결함인지 낡거나 과도한 테스트인지 확인한 뒤 판정합니다.

# 4. 점수 및 A / B / C 판정

## 4.1 CSS

CSS는 아래 하위 축을 각각 평가한 뒤 **CSS 총점 /100**을 산정한다. 단순히 최종 점수 하나만 제시하지 않는다.

| 하위 평가축 | 기본 비중 | 핵심 질문 |
|---|---:|---|
| 구조 / 파일 책임 | 12 | 파일과 layer의 책임이 명확하고 중복 override를 유발하지 않는가 |
| Token / Variable / 공통화 | 12 | 반복 값이 합리적으로 token화되고, 반대로 one-use 값을 과토큰화하지 않았는가 |
| Cascade / Specificity | 12 | selector 우선순위가 예측 가능하고 accidental override가 없는가 |
| Responsive | 14 | Desktop / Tablet / Mobile / orientation 경계가 실제 contract와 일치하는가 |
| Theme / 색상 체계 | 10 | Light/Dark 및 semantic color가 runtime state와 일치하는가 |
| Interaction / State CSS | 10 | hover/focus/active/open/disabled/runtime class가 JS 상태와 정확히 맞물리는가 |
| Component 일관성 | 10 | table/card/modal/tooltip/control 간 typography·spacing·radius·border 규칙이 일관적인가 |
| Dead / Legacy / fallback | 8 | 실제 dead rule은 없는가, browser fallback을 dead duplicate로 오판하지 않았는가 |
| Print / 특수 환경 | 5 | print/special viewport 규칙이 화면 contract를 깨지 않는가 |
| 유지보수성 / 회귀 위험 | 7 | 1px·2px 차이와 예외가 실제 이유가 있는가, 수정 영향 범위가 예측 가능한가 |

비중은 평가 설명의 기준선이며, 특정 범위에 N/A가 있으면 남은 항목을 합리적으로 재배분한다. 파일 수나 selector 수 같은 단순 수량보다 실제 역할 분리·cascade 안정성·회귀 위험을 본다.

## 4.2 JavaScript

JavaScript는 아래 하위 축을 각각 평가한 뒤 **JavaScript 총점 /100**을 산정한다.

| 하위 평가축 | 기본 비중 | 핵심 질문 |
|---|---:|---|
| Module responsibility / API | 12 | 모듈 책임과 public surface가 명확한가 |
| Dependency graph | 8 | 순환 의존·숨은 global bridge·역방향 결합이 없는가 |
| State ownership | 12 | 상태 소유자와 source of truth가 명확하고 중복 상태가 충돌하지 않는가 |
| Rendering / DOM lifecycle | 10 | 전체/부분 render가 transient UI·focus·scroll·runtime state를 깨지 않는가 |
| Event / listener ownership | 8 | 중복 bind, 누수, stale listener, 재진입 문제가 없는가 |
| Async / race / stale state | 14 | 응답 역전, duplicate action, stale success/error, session 혼선이 방어되는가 |
| Error / recovery | 9 | 실패가 최신 성공을 덮지 않고 사용자가 정상 복구할 수 있는가 |
| Persistence / restore | 9 | 저장→복원→수정→재계산 contract가 모든 진입 경로에서 일치하는가 |
| Lifecycle / cleanup | 8 | timer/observer/request/session cleanup이 close/reopen/theme/viewport 변화에도 안전한가 |
| 유지보수성 / 확장성 | 10 | helper 중복, 의미 중복, 과분리/과결합 없이 현재 규모에 적정한가 |

파일 길이만으로 분리를 권하지 않는다. 하나의 subsystem으로 응집되어 있다면 큰 파일도 허용한다.

## 4.3 UI

UI는 추상적인 미감 점수 하나로 평가하지 않는다. 먼저 **실제 화면 영역 inventory**를 만들고, 존재하는 영역별 평가와 아래 공통 UI 축을 교차 확인한 뒤 **UI 총점 /100**을 산정한다.

| 공통 UI 축 | 기본 비중 | 핵심 질문 |
|---|---:|---|
| Visual hierarchy / 정보 우선순위 | 10 | 중요한 값과 행동이 자연스럽게 먼저 읽히는가 |
| Layout / alignment | 10 | grid, 정렬, 폭, overflow가 viewport별로 안정적인가 |
| Typography | 8 | 제목/본문/수치/보조문구 계층과 숫자 가독성이 일관적인가 |
| Spacing / density | 8 | gap/padding/row height가 영역별 이유 없이 흔들리지 않는가 |
| Table / Card | 12 | 정보 밀도·정렬·sticky·scroll·card 변환이 안정적인가 |
| Chart / visual data | 10 | 범례, 축, tooltip, resize, theme, empty state가 일관적인가 |
| Modal / Tooltip / Overlay | 10 | 위치, layering, focus visual, close affordance, clipping이 안정적인가 |
| Control / interaction visual | 8 | toggle/button/select/input의 상태 표현과 hit area가 일관적인가 |
| Responsive | 16 | Desktop/Tablet/Mobile 및 orientation에서 정보 손실·겹침·잘림이 없는가 |
| Theme / runtime visual consistency | 8 | Light/Dark 전환 후 DOM뿐 아니라 Canvas/SVG/overlay까지 일치하는가 |

실제 존재하지 않는 UI 영역은 `N/A`로 처리하며 감점하지 않는다. MAIN/ADD 전체 평가에서는 공통 UI 축만 제시하지 말고 **실제 화면 영역별 표를 반드시 별도로 출력**한다.

## 4.4 UX

UX는 화면 모양이 아니라 **사용자 flow와 상태 전이**를 기준으로 아래 하위 축을 평가한 뒤 **UX 총점 /100**을 산정한다.

| 하위 평가축 | 기본 비중 | 핵심 질문 |
|---|---:|---|
| 정보 구조 / discoverability | 8 | 사용자가 다음 행동과 현재 위치를 이해할 수 있는가 |
| 핵심 flow 정확성 | 14 | 조회·변경·계산·저장·갱신 같은 주요 목적을 오류 없이 완료할 수 있는가 |
| Feedback / 진행상태 | 10 | loading/success/error/disabled 상태가 충분히 설명되는가 |
| Error recovery | 10 | 실패 후 재시도·취소·재진입이 자연스럽고 상태가 잠기지 않는가 |
| 상태 이해 / continuity | 12 | tab/theme/view/date/filter/open state가 예측 가능하게 유지·복원되는가 |
| Re-entry / duplicate action | 12 | 연타, Enter 반복, close→reopen, 중복 요청에 안전한가 |
| Keyboard / touch / accessibility | 10 | mouse 외 입력에서도 같은 기능과 feedback을 제공하는가 |
| Persistence / restore / recalculation | 8 | 저장된 상태가 복원된 뒤 첫 렌더·재계산과 의미가 일치하는가 |
| Perceived performance | 6 | 불필요 rerender, flicker, 기다림, focus loss가 체감 흐름을 깨지 않는가 |
| Cross-view / cross-feature consistency | 10 | Table↔Card, MAIN↔ADD, Desktop↔Mobile에서 같은 개념이 같은 방식으로 동작하는가 |

UX는 추상적인 취향보다 실제 사용자 영향이 있을 때 지적한다. 전체 평가에서는 핵심 flow를 inventory하고 **flow별 상태 전이와 판정 근거를 별도 표로 출력**한다.

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

단, **100점은 9장의 100점 Gate를 모두 통과한 경우에만 허용**한다.

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
- B는 **지원 환경에서 현실적으로 도달 가능한 사용자/비동기/복원 경로**이거나, 코드상 도달 가능성이 명확하고 발생 시 사용자·데이터·운영 영향이 실질적인 경우에만 부여한다.
- 극저확률 다중 장애 조합, 이론적으로만 가능한 순서, 수정 이득보다 회귀 위험이 큰 미세 개선은 B가 아니라 C 또는 비감점 관찰사항으로 처리한다.

## 4.8 C — 비감점 관찰사항 / 선택 개선

C는 **실제 결함이라기보다 현재 상태를 유지해야 할 이유가 있거나, 수정 이득이 매우 작은 항목**을 기록하는 분류다.

- 현재 설계 의도에 맞음
- browser native behavior
- progressive fallback
- 이미 검토된 trade-off
- 변경 이득보다 복잡도·회귀 위험이 큼
- 점수 목적의 정리
- 현재 구조에서 의도적으로 분리된 책임
- 낮은 확률의 비핵심 edge case로서 현재 운영 리스크가 작음

C는 **감점하지 않으며 미해결 결함으로 계산하지 않는다.** 따라서 C가 남아 있어도 A/B가 0이고 적용 가능한 QA/반증 평가가 통과하면 **100점 및 수정 종료가 가능**하다.

C는 문제점을 억지로 만들기 위한 등급이 아니며 기본 수정 대상도 아니다. 사용자가 C까지 정리해 달라고 명시한 경우에만 선택적으로 수정한다.

A/B/C는 개수를 채우지 않는다. 실제 감점 근거가 없으면 A/B 0건이 정상이며, C는 필요할 때만 비감점 관찰사항으로 기록한다.

---

# 5. 평가 Workflow

## 5.1 Pass 1 — 구조와 책임

- 실제 파일 inventory, entry/import graph, state owner, persistence owner를 확인합니다.
- handover에 적힌 현재 장기 contract와 최신 소스를 대조합니다.
- 파일 수·줄 수가 아니라 책임 방향과 실제 결합을 평가합니다.

## 5.2 Pass 2 — 상태와 사용자 flow

각 주요 기능을 다음 형태로 봅니다.

```text
초기 상태
→ 사용자 입력
→ in-flight
→ 성공 / 실패
→ close / reopen / retry
→ restore / recalculation
```

같은 기능을 mouse, keyboard, 반복 입력, viewport/theme 변화에서 확인할 필요가 있는지 위험도에 따라 판단합니다.

## 5.3 Pass 3 — Async / Race / Session

최소 다음 질문을 적용합니다.

- 이전 응답이 최신 상태를 덮을 수 있는가?
- stale error가 최신 성공 뒤에 도착할 수 있는가?
- close→reopen 후 이전 timer/listener/request가 새 session에 개입하는가?
- 중복 submit/Enter/연타가 같은 mutation을 두 번 실행하는가?
- await/fetch/json parse 사이에서 session identity가 바뀌어도 최신성 guard가 유효한가?

## 5.4 Pass 4 — Boundary / Restore / Runtime

- `0`, `-0`, 정확한 threshold, 이미 달성된 상태, 빈 데이터, 일부 실패를 확인합니다.
- 저장→복원→수정→재계산 의미가 최초 입력 경로와 같은지 봅니다.
- theme/viewport/tab 변경이 Canvas/SVG/modal/tooltip 같은 runtime surface를 놓치지 않는지 확인합니다.

## 5.5 Pass 5 — 코드 ↔ 테스트 ↔ 문서 의미

- 테스트는 사용자/운영 contract를 보호하는지, 특정 함수명·문자열·px·구현 순서를 불필요하게 고정하는지 구분합니다.
- README에는 프로젝트 개요만, handover에는 유지보수 contract만, 이 문서에는 평가 방법만 있는지 확인합니다.
- 문서가 실제 없는 기능을 설명하거나, 실제 contract를 다른 의미로 설명하면 semantic documentation 결함으로 기록합니다.

## 5.6 Pass 6 — bounded Counterexample

점수를 확정하기 직전 현재 위험도가 높은 기능 몇 개를 골라 **기존 테스트에 직접 적혀 있지 않은 현실적인 반례**를 한 번 더 생성합니다. 같은 root cause의 변형을 무한히 늘리지 않습니다.

# 6. 프로젝트별 평가 범위 지도

이 절은 **무엇을 평가할지 찾기 위한 지도**이며 기능 세부 contract의 Source of Truth가 아닙니다.

| 영역 | 평가 초점 | 실제 contract |
|---|---|---|
| Main 계산 | 원금·손익·실현손익·별도수익·연금 계산 parity | Main handover + production core |
| Main UI | Table/Card/Chart/Modal/Tooltip/Theme/Responsive/Print | Main handover |
| Market AI frontend | standalone Signal, live valuation overlay, 연결/실패 격리, partial render | Main handover + Market AI 문서 |
| Pension/KRX frontend↔GAS | 요청 identity, 진행중 UI, retry, response loss, stale state | Main handover + GAS source |
| Add Calc | production 계산/validation, restore, stale-result UX | Add handover |
| Add Report | canonical trade source, 파생 합계, chart/timeline 표현 | Add handover |
| Main↔Add | appearance/breakpoint/canonical KODEX source 등 실제 공동 contract | Main handover 8장 |

공통화·토큰화의 35개 고정 Rubric은 `ct35_evaluation.md`를 사용합니다. 이 문서에 35개 항목의 selector/token 세부를 다시 복제하지 않습니다.

`평가` / `평가해줘` 계열 상세 평가에서는 이 Rubric을 단순 참고만 하지 않고 **1~35 전 항목을 실제 최신 소스에 대입해 별도 CT35 표로 전수 기록**합니다. 전체 평가에서는 `ct35_evaluation.md`의 `항목 | Main | Add | 판정 | 핵심 근거` 형식을 따르고, 특정 기능 집중평가에서는 같은 문서의 `항목 | 적용 범위 | 점수 | 판정 | 핵심 근거` 형식을 사용합니다. 다른 CSS 상세표에 근거가 이미 있더라도 CT35 행을 생략하거나 “CSS 100에 포함”처럼 축약하지 않습니다.

# 7. GAS 평가 모드

## 7.1 `GAS_code.js` 독립 평가 모드

이 절은 **평가 범위 규칙상 GAS가 포함되는 경우** 또는 사용자가 `GAS_code.js` 평가를 별도로 요청한 경우 적용한다. 단순히 ZIP 안에 파일이 존재한다는 이유만으로 좁은 Dashboard 평가에 이 절을 자동 적용하지 않는다.

기존 Pension/KRX 반례 계약은 **평가 seed library**다. 모든 bullet을 매번 독립 반례로 전수 조합하거나, 한 반례에서 또 다른 희귀 반례를 재귀적으로 파생시키는 체크리스트가 아니다. 기본 평가는 **실제 운영에서 의미 있는 실패를 합리적인 비용으로 찾는 것**을 목표로 한다.

### 평가 강도 캘리브레이션 방화벽

GAS 평가 강도는 **사용자가 이번 요청에서 지정한 범위와 이 문서의 명시적 평가 모드만**으로 결정한다. 소스 자체가 고도화되어 있다는 이유로 심사 강도를 자동 상승시키지 않는다.

다음 요소는 **확장 평가를 유도하는 신호로 사용하지 않는다.**

- `GAS_code.js`의 파일 길이, helper 수, 상태머신 복잡도
- transaction/idempotency/race 방어 코드가 이미 많이 존재한다는 사실
- 극저확률 장애를 다루는 주석, durable evidence, fail-closed 복구 분기
- 과거 버그를 막기 위해 쌓인 defensive code 또는 테스트 수
- 코드만 보고 추정한 사용자의 성향, 위험 선호도, 품질 기대치
- “여기까지 방어했으니 더 희귀한 반례도 막아야 할 것”이라는 상대적 기준 상승

평가자는 **현재 documented contract를 깨는 현실적인 결함이 있는지**를 판단한다. 이미 존재하는 방어 수준을 새로운 최소 기준으로 삼아 그보다 한 단계 더 극단적인 방어를 요구하지 않는다. 즉 **코드가 강해질수록 합격선도 같이 올라가는 arms race를 금지**한다.

기본 모드에서 새 A/B 후보를 만들 때는 원칙적으로 **한 번의 현실적인 외부 장애 또는 정상적인 동시성/재시도와 그 자연스러운 후속 상태 전이** 범위에서 먼저 증명한다. 기존 stronger proof·정상 복구 경로를 일부러 제거하거나 서로 독립적인 희귀 장애를 연쇄적으로 추가해야만 성립하는 가설은 아래 Fault budget에 따라 C 또는 비감점으로 종료한다.

### 평가 강도: 기본 bounded 모드와 확장 모드

기본 `평가` / `평가해줘`는 **bounded 모드**다.

```text
기존 회귀·문법·정적 contract 확인
→ 핵심 mutation/dispatch 상태 모델 확인
→ 현재 변경 또는 고위험 경계의 대표 반례 선택
→ 실제 재현 또는 결정적 코드 흐름으로 검증
→ A/B/C 판정
→ 마지막 bounded Counterexample Pass 1회
→ 새 A/B가 없으면 종료
```

- 5장의 `고위험 기능 3~5개 반례`는 GAS에서 **각 함수·각 bullet마다 3~5개**라는 뜻이 아니다. 현재 평가의 핵심 mutation/dispatch subsystem 전체에서 정보가 겹치지 않는 대표 반례를 위험도에 맞게 선택한다.
- 일반적인 `GAS_code.js` 재평가에서는 최근 변경 파일/함수와 직접 dependency, 기존 A/B 수정 영향, 핵심 회귀 flow를 먼저 본다.
- 이미 안정화된 contract를 표현만 바꿔 반복 공격하지 않는다.
- 새 A/B를 하나 찾았다고 그 branch에서 희귀 장애를 계속 덧붙여 **반례의 반례**를 무한 생성하지 않는다. 등급·공통 원인·회귀 범위를 판정하는 데 필요한 만큼만 더 확인하고 다음 독립 축으로 이동한다.
- 마지막 bounded pass에서 새로 나오는 것이 C, 이론적 가능성, 운영 증거 없는 극저확률 조합뿐이면 평가를 종료한다.

다음 요청에서만 **확장 모드**로 범위를 넓힌다.

```text
GAS_code.js 전수 평가
공격적으로 평가
transaction/idempotency를 끝까지 파줘
KRX race를 집중 공격해줘
```

확장 모드에서도 무한 반례 생성은 금지한다. 동일 root cause의 변형은 하나의 결함으로 묶고, 기대 정보가 거의 늘지 않으면 종료한다.

### Fault budget — 극저확률 반례 필터

GAS는 네트워크·GitHub·Script Properties·동시 실행이 얽혀 있어 이론적으로는 매우 많은 실패 조합을 만들 수 있다. 기본 평가에서는 아래 fault budget을 적용한다.

**B 이상으로 적극 검토하는 기본 범위**

- 정상적인 사용자 재시도, 다른 탭/기기, 동시 요청, status transition, 시간 경과
- 한 번의 현실적인 transport/API 응답 유실·5xx·409/422·timeout
- 한 번의 Script Properties write/readback 불확실성
- 정상적인 GitHub branch 경쟁이나 workflow queue/run 전환
- 지원하는 legacy/restore 데이터가 실제 코드 경로로 유입되는 경우
- 위 항목 하나와 **통상적인 재시도·동시성·시간 경과**가 결합되는 경우

위의 재시도·동시성·status transition은 별도의 희귀 장애로 세지 않는다. 실제 운영에서 자연스럽게 뒤따르는 상태 전이이기 때문이다.

**원칙적으로 C 또는 비감점으로 종료하는 범위**

- 서로 독립적인 희귀 저장소 장애·API 장애·데이터 손상을 **2개 이상 동시에** 가정해야만 성립하고, 그 사이에 정상 복구 기회도 여러 번 모두 실패해야 하는 경우
- 수동으로 손상된 내부 ledger와 별도의 네트워크 응답 유실, GC 타이밍, 추가 API race까지 겹쳐야 하는 경우
- production에서 도달 근거가 없고 mock으로만 임의 순서를 만들 수 있는 경우
- 이미 stronger durable proof가 정상적으로 존재한다는 전제를 일부러 제거한 뒤, 별도의 local proof도 동시에 제거해야 성립하는 경우
- 사용자 영향이 미미하고 자동 복구/다음 요청에서 자연스럽게 수렴하는 극저확률 상태
- 수정 복잡도와 회귀 위험이 현재 운영 리스크보다 명백히 큰 경우

이 범위의 가설은 단순히 "더 방어할 수 있다"는 이유만으로 C급 개선 과제까지 새로 만들지 않는다. **실제 운영 가치가 확인되지 않으면 비감점 관찰로 종료하거나 결과에서 생략**한다.

예외적으로 **데이터 손상·중복 금전성 mutation·인증 우회처럼 영향이 A급인 영역**은 두 장애가 결합되더라도 코드가 그 조합을 명시적으로 지원·복구한다고 주장하거나 실제 운영 증거가 있으면 검토할 수 있다. 이때도 “가능하다”가 아니라 구체적 도달 경로와 실제 영향이 필요하다.

### A/B 판정에 필요한 증거 강도

`GAS_code.js`에서 새 A/B를 제시하려면 다음을 모두 만족하는 것을 원칙으로 한다.

1. 지원 환경에서 도달 가능한 요청/상태 전이인가.
2. production 함수 실행, 현실적인 mock injection, 또는 결정적인 코드 흐름으로 재현 가능한가.
3. 사용자의 저장/삭제/재시도/KRX 실행 결과에 실질적인 영향이 있는가.
4. 단순한 방어 심화가 아니라 현재 contract를 실제로 위반하는가.
5. 위 fault budget을 넘는 극저확률 다중 장애 조합이 아닌가.
6. 현재 코드의 방어 수준이 높다는 이유만으로 더 높은 방어 수준을 새 contract처럼 요구한 것은 아닌가.
7. 기존 stronger proof나 정상 복구 경로가 실제 production에서 존재하는데, 반례 성립을 위해 그것을 임의로 제거한 것은 아닌가.

mock은 다음 조건에서만 강한 근거로 쓴다.

- 실제 외부 서비스에서 가능한 응답/오류 순서를 주입한다.
- production 함수를 그대로 실행한다.
- mock 전용 코드나 현실에 없는 API semantics를 만들어 결함을 성립시키지 않는다.

실행하지 못한 경우에는 코드 경로가 결정적이면 B/A 판정이 가능하지만, 단순 추측이면 C 또는 비감점으로 남긴다.

### `GAS_code.js` 점수축

평가 범위 규칙상 GAS가 포함되는 경우의 `GAS_code.js` 서버 점수와 GAS 단독 평가에는 아래 11개 축을 사용한다. N/A가 있으면 남은 비중을 합리적으로 재배분한다.

| 평가축 | 기본 비중 | 핵심 질문 |
|---|---:|---|
| 구조·책임 분리 | 8 | 단일 파일 유지 계약 안에서 섹션/업무 책임/entry가 명확한가 |
| 인증·입력·schema 검증 | 8 | PIN, action, ID, 숫자, 날짜, stored data를 fail-closed로 검증하는가 |
| 업무 저장 정확성 | 14 | Single/Batch 저장·삭제가 정상 요청을 거부하거나 잘못된 값을 쓰지 않는가 |
| 원자성·Git 경쟁 처리 | 12 | multi-file mutation, branch CAS, dependency drift, 응답 유실에서 부분·덮어쓰기가 없는가 |
| Single 멱등성·stale retry | 12 | same identity retry, save→delete→old retry, no-op completion이 최신 상태를 되돌리지 않는가 |
| Batch 적용·확인 계약 | 10 | atomicity, operation별 existing/distinct, uniqueness, cardinality, batch identity가 일치하는가 |
| Durable identity·evidence lifecycle | 10 | receipt/intent/ledger/epoch/terminalization/GC의 proof 강도와 우선순위가 안전한가 |
| KRX dispatch·run/race | 12 | request/operation 단위 중복 dispatch, run visibility, retry inflight, response-loss를 fail-closed로 다루는가 |
| 실패 복구·응답 유실 | 6 | 실제 반영 후 응답만 실패한 상태를 read-back/reconciliation으로 안전하게 수렴시키는가 |
| 정규화·legacy 호환 | 4 | 지원한다고 명시한 구형 데이터가 정규화→재검증→mutation에서 자기모순 없이 동작하는가 |
| Properties·원격 I/O·관측성·유지보수 | 4 | quota/GC, fetch 병렬화, timing, cache가 정합성을 약화시키지 않고 현재 규모에 적절한가. KRX 자동 scheduler/retry가 정상 수동·자동 hot path에 중복 GitHub/Properties I/O를 넣지 않는가 |

**GAS 점수는 평가 범위 규칙상 GAS가 포함되는 경우에만 제시하며, CSS/JavaScript/UI/UX 총점에 자동 합산하지 않는다.** 범위를 따로 좁히지 않은 전체 평가에서는 Dashboard와 GAS를 병렬 표기하고, MAIN/ADD/CSS/JS 등 좁은 평가에서는 GAS 점수 자체를 만들지 않는다.

### `GAS_code.js` 기본 대표 반례

기본 bounded 평가에서는 아래 seed에서 **현재 변경·위험도와 관련된 것만 선택**한다. 전부를 매번 조합하지 않는다.

**Pension Single**

- commit 성공 + HTTP/receipt 응답 유실 → 동일 identity 재시도
- save → delete → 과거 save 재전송
- exact identity same content / different content
- expectedVersion/expectedAbsent stale
- no-op 성공 후 receipt GC
- 정상적으로 지원하는 legacy row 정규화→재검증

**Pension Batch**

- 후반 operation 오류가 앞선 operation을 부분 저장하지 않는가
- 일부 semantic candidate만 존재할 때 operation별 existing/distinct
- confirmation 이후 정상 state 변화 → token stale
- same batch/logical identity를 distinct로 부활시키지 않는가
- completed receipt 유실 후 durable recovery

**KRX**

- POST 수락 + 응답 유실 → 같은 requestId 재시도
- 같은 branch/date에 새 requestId가 들어오는 동안 queued↔in_progress 정상 전환
- explicit 4xx rejected → 안전한 retry
- durable success write 실패 → local evidence fallback
- marker/run proof가 있는 정상 경로에서 상태별 목록 race가 중복 dispatch를 열지 않는가
- 자동 morning/close가 같은 날짜에서 서로 다른 안정 identity를 쓰고, 같은 phase retry는 동일 identity를 유지하는가
- 자동 scheduler의 중복/stale trigger 정리가 다른 project trigger 또는 기존 KRX durable evidence를 건드리지 않는가
- 자동 retry가 transient 상태에만 bounded하게 열리고, 전날 retry·metadata 손상·terminal 4xx가 새 dispatch로 변질되지 않는가
- 정상 자동 성공 경로가 기존 수동 KRX hot path 앞에 GitHub/Properties 선조회나 별도 dispatch를 추가하지 않는가

한 평가에서 이미 같은 root cause를 충분히 검증했다면 동일 계열 seed를 추가로 모두 돌릴 필요는 없다.

### 기존 상세 Pension/KRX bullet의 해석

바로 위 `Pension`, `KRX` 상세 bullet은 장기 contract를 보존하기 위한 **회귀·집중평가 seed pool**이다.

- 기본 `평가해줘`에서는 모든 문장을 mandatory test case로 변환하지 않는다.
- 최근 변경과 직접 관련된 contract, 과거 실제 A/B, 현재 데이터 mutation 위험이 큰 부분을 우선 선택한다.
- 서로 같은 root cause를 보는 bullet은 하나의 대표 반례로 묶을 수 있다.
- 과거 한 번 발견됐던 버그를 매번 똑같이 수동 재현할 필요는 없고, 해당 회귀 테스트/production contract가 유지되는지 확인한 뒤 주변의 새로운 대표 경계만 본다.
- 특정 bullet을 만족시키기 위해 **강한 proof를 일부러 여러 개 동시에 제거하는 mock**을 만들지 않는다.
- contract에 “fail-closed”가 이미 구현돼 있고 해당 실패가 사용자에게 재시도만 요구하며 데이터/중복 실행을 만들지 않으면, 단순 보수성 자체를 B로 만들지 않는다.

### `GAS_code.js` A / B / C 예시

**A**

- 정상 Single/Batch 핵심 저장이 항상 실패
- 부분 commit 또는 잘못된 데이터 저장
- stale retry가 최신 저장/삭제를 되돌림
- 동일 operation의 중복 KRX dispatch가 현실적인 단일 장애에서 발생
- 인증/권한 우회
- durable identity 충돌로 다른 내용을 같은 요청으로 승인

**B**

- 특정하지만 현실적인 retry/concurrency 순서에서 정상 작업 전체가 불필요하게 막힘
- 응답 유실 후 fail-closed proof가 약해져 다음 일반 재시도에서 중복 실행 가능
- 지원 legacy 데이터가 정상 mutation을 막음
- partial local evidence를 성공으로 오인
- operation별 confirmation 결정이 다른 operation에 잘못 적용

**C / 비감점**

- 세 가지 이상의 독립적인 저장소/네트워크 장애가 모두 겹쳐야 드러나는 추가 방어
- 실제 운영 데이터에 없고 지원 대상도 아닌 손상 JSON을 더 친절하게 복구하는 개선
- 이미 fail-closed하여 데이터/중복 실행 영향 없이 사용자가 한 번 더 재시도하면 수렴하는 희귀 경로
- helper를 더 짧게 만들거나 추상화할 수 있다는 구조 취향
- timing/log 메시지의 미세한 표현 개선

### `GAS_code.js` 평가 종료 Gate

기본 `GAS_code.js` 평가는 아래 조건이면 종료한다.

```text
[ ] JavaScript syntax / 실행 가능한 기존 regression이 PASS
[ ] 현재 평가에서 확인된 A = 0
[ ] 현재 평가에서 확인된 B = 0
[ ] 최근 변경 또는 고위험 mutation/dispatch contract의 대표 반례를 확인
[ ] Single/Batch/KRX 중 현재 범위에 관련된 async·idempotency 경계를 확인
[ ] 마지막 bounded Counterexample Pass 1회에서 새 A/B 없음
[ ] 새로 떠오른 후보가 fault budget 밖의 극저확률 조합 또는 C뿐임
```

이 조건을 충족하면 **100점을 허용하고 평가를 종료한다.** “더 복잡한 mock을 만들면 뭔가 나올 수 있다”는 이유로 99점을 남기거나 반례 생성을 계속하지 않는다.

반대로 기존 테스트 PASS만으로 위 Gate를 생략하고 100점을 주지도 않는다.

### 수정 후 재평가

`GAS_code.js`의 A/B를 수정한 직후에는 기본적으로:

```text
수정된 root cause 직접 회귀
→ 직접 dependency / proof lifecycle 확인
→ 관련 Single/Batch/KRX 대표 반례
→ 마지막 bounded Counterexample Pass 1회
→ A/B 0이면 종료
```

순서로 본다.

**수정한 B에서 더 낮은 확률의 새로운 B를 계속 파생해 무한 patch loop를 만드는 것을 금지한다.** 새 후보가 기본 fault budget을 넘으면 C/비감점으로 분류하고, 실제 운영 증거·사용자 보고·다음 코드 변경이 생길 때 다시 연다.

# 8. 평가 결과 작성 순서

전체 평가의 기본 순서는 다음과 같다.

1. 한눈에 보는 결론
2. 실제 프로젝트 구조
3. 검증 방법과 가능/불가 범위
4. **이번 평가에서 새로 생성한 주요 실패 가설 / 적대적 시나리오 요약**
5. CSS 상세 평가
6. **CT35 공통화·토큰화 1~35 전수 평가**
7. JavaScript 상세 평가 + dependency / state / async 확인
8. Frontend ↔ backend / workflow contract
9. UI 영역별 평가
10. UX flow별 평가
11. Boundary / Persistence / Keyboard / Runtime lifecycle
12. Semantic Documentation QA
13. Accessibility / Interaction
14. 성능 / 유지보수성
15. **100점 Counterexample Pass 결과**
16. A / B 목록 + 필요한 경우 C 비감점 관찰사항
17. 세부 점수표
18. 최종 결론

평가 범위가 ADD Calc나 특정 화면처럼 좁으면 해당 범위에 맞게 불필요한 장은 줄인다.

최종 결론에는 가능한 범위에서 다음을 명시한다.

- CSS 총점
- JavaScript 총점
- UI 총점
- UX 총점
- UI/UX 총점
- 전체 총점
- A/B 개수와, 필요한 경우 C 비감점 관찰사항 수
- 현재 구조가 기준선으로 적절한지
- 추가 구조 리팩토링이 실제로 필요한지
- 자동 테스트 밖에서 새로 검토한 실패 시나리오가 무엇인지
- 100점이라면 Counterexample Pass까지 통과했는지

## 8.1 답변 형식

- 일반 Markdown 제목, 문단, 표 중심
- selector/함수 증거가 필요한 경우만 짧은 코드 블록
- 검증 근거를 해당 평가 항목 가까이에 배치
- **`평가` / `평가해줘`에서는 CSS·JavaScript·UI·UX 각각의 하위 평가표를 생략하지 않음**
- **`ct35_evaluation.md`를 반드시 읽고 CT35 1~35 전 항목을 별도 표로 모두 출력함.** 전체 평가에서는 Main/Add를 독립 채점하고, 좁은 기능 평가에서도 35개 행을 유지한 채 `적용 / 간접 적용 / N/A`를 표시함
- **UI는 실제 화면 영역별 표, UX는 실제 사용자 flow별 표를 별도로 작성**
- 각 상세표는 원칙적으로 `평가항목 | 점수 | 상태 | 핵심 근거 | 감점 여부` 5개 열을 사용
- 점수표만 나열하지 않고 실제 근거 설명
- 100점 항목도 `정상` 한 단어로 끝내지 않고 대표적인 정상 근거를 적음
- A/B가 0건이어도 어떤 실패 가설과 반례를 확인했는지 적음
- 과거 평가 문구를 복사하지 않음
- 최신 실제 코드에서 확인한 사실을 설명
- “테스트 전부 PASS”를 최종 결론의 핵심 근거처럼 쓰지 않음
- 새 결함을 찾았다면 **재현 순서 또는 상태 전이**를 함께 적음
- 브라우저 실기를 하지 않았다면 `실화면 확인`으로 표현하지 않고 정적/코드흐름/자동QA 기준임을 구분

`평가` / `평가해줘`에서 다음과 같은 축약 답변은 허용하지 않는다.

```text
CSS 100 — 문제 없음
JS 100 — 문제 없음
UI 100 — 문제 없음
UX 100 — 문제 없음
종합 100
```

이 형식은 사용자가 명시적으로 `점수만`, `간단히`, `요약만`을 요청한 경우에만 허용한다.

### CT35 전수 출력 계약

`평가` / `평가해줘` 계열 상세 평가에서는 CT35를 CSS 총점의 내부 근거로만 흡수하지 않습니다. **독립 섹션에서 1번부터 35번까지 모든 항목을 순서대로 기록**합니다.

- 전체 Dashboard 평가: `ct35_evaluation.md`의 전체 평가 최소 형식대로 `항목 | Main | Add | 판정 | 핵심 근거`를 35행 모두 작성
- MAIN만 / ADD만 평가: 관련 프로젝트는 실제 점수를 기록하고 반대쪽은 CT35 범위 규칙에 따라 `N/A` 처리하되 35행을 유지
- 특정 기능·화면 평가: 1~35를 먼저 `적용 / 간접 적용 / N/A`로 분류하고 집중평가 최소 형식대로 35행을 모두 작성
- 동일 root cause를 여러 CT35 항목에서 중복 감점하지 않으며, `N/A`를 억지로 적용 대상으로 만들지 않음
- CT35의 Main/Add 점수는 서로 평균내지 않으며, Dashboard CSS/전체 점수와의 관계는 근거를 설명하되 별도 점수축을 임의로 새로 만들지 않음
- 35행 전수 출력은 **가시성 contract**이며, 각 항목을 이유 없이 장문으로 반복하는 것은 요구하지 않음. 근거는 실제 token/selector/shared owner 중심으로 간결하게 작성

## 8.2 영역별·기능별 상세 평가

`평가` / `평가해줘` 자체를 기본적으로 **영역별·기능별 상세 평가**로 본다. 사용자가 별도로 `화면영역별`, `기능별`이라고 쓰지 않아도 전체 평균점수만 먼저 내지 않고, 실제 구성 요소를 inventory한 뒤 구성요소별로 평가한다.

MAIN 전체 평가에서는 실제 존재 여부를 확인한 뒤 최소한 다음 후보를 inventory한다.

```text
Topbar / navigation / 목차
Hero / KPI / 총합계
일변동 / 변동표
계좌별 Table / Card
성과 / 자산 / 손익 Chart
퇴직연금 영역과 조정 flow
Market AI / Live Valuation
Modal / Tooltip / Overlay
Theme / Responsive / Print
```

ADD가 포함된 전체 평가에서는 다음 후보도 실제 존재 여부를 확인한다.

```text
ADD shell / navigation
Calc 입력 / 결과 / 복원 flow
KODEX Report 입력 / 결과 / Chart
MAIN ↔ ADD shared token / theme / viewport contract
```

존재하지 않는 항목은 `N/A`로 표시하고 감점하지 않는다.

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


## 8.3 영역별 점수 보고의 최소 단위

전체 평가에서 CSS / JavaScript / UI / UX는 **각각 최소 6개 이상의 실제 관련 하위 항목**으로 나눠 보고한다. 다만 범위가 매우 좁거나 N/A가 많은 경우에는 실제 관련 항목만 남긴다.

각 영역의 총점은 하위 평가와 논리적으로 연결되어야 한다. 예를 들어 Responsive에 실제 B급 결함이 있는데 UI 100을 줄 수 없고, Async/race에 명확한 B급 결함이 있는데 JavaScript 100을 줄 수 없다. 반대로 모든 하위 항목에서 실제 감점 근거가 없다면 하위 점수와 총점 모두 100을 허용한다.

100점 영역의 설명에는 최소 다음 세 종류의 근거가 포함되어야 한다.

```text
구조적 정상 근거 1개 이상
실제 기능/상태 정상 근거 1개 이상
반례/경계/회귀 검토 근거 1개 이상
```

## 8.4 최종 보고서의 상세도 규칙

명령별 기본 상세도는 다음과 같다.

| 사용자 명령 | 기본 출력 수준 |
|---|---|
| `점수`, `점수만` | 총점 중심의 간결한 결과 |
| `평가`, `평가해줘` | **전체 상세 평가 + CT35 1~35 전수 표** |
| `상세 평가`, `영역별 평가`, `기능별 평가` | 전체 상세 평가 + CT35 1~35 전수 표 + 요청 축을 더 세분화 |
| `수정할 거 찾아줘` | 점수보다 실제 A/B 후보 탐색 중심 |
| `수정해` | A/B를 수정하고 영향 범위 QA·대표 반증 평가를 반복해 A/B=0에서 종료. C는 명시 요청 시에만 수정 |

따라서 `평가해줘`에 대해 단순 종합점수표와 A/B 개수만 제공하는 것은 이 문서의 출력 contract를 충족하지 못한 것으로 본다. C는 필요한 경우 비감점 관찰사항으로 별도 기록한다.

---

# 9. 100점 Gate와 Counterexample Pass

기존 원칙인 **“구체적인 A/B급 감점 사유가 없으면 100점”**은 유지한다. C는 비감점 관찰사항이므로 100점을 막지 않는다.

아래 Gate는 **현재 평가 범위와 위험도에 적용되는 항목**을 확인한다. 제한된 수정의 재평가에서 영향이 없는 전체 프로젝트 영역을 매번 처음부터 다시 검증할 필요는 없다.

## 9.1 100점 Gate

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
[ ] `평가` / `평가해줘` 계열이면 `ct35_evaluation.md`를 읽고 1~35 전 항목을 별도 표로 기록했는가
[ ] 위험도에 맞는 대표 interactive adversarial scenario를 생성·검토했는가
[ ] 기존 테스트가 놓칠 수 있는 관련 상태공간을 합리적인 범위에서 탐색했는가
[ ] 마지막 bounded Counterexample Pass에서도 새로운 A/B급 감점 사유가 없었는가
```

환경상 일부 runtime 검증이 불가능하면 그 사실을 명확히 쓰고, 가능한 정적·코드 흐름 분석으로 대체한다. 단, 실제 화면을 보지 않았으면서 pixel/runtime까지 100이라고 단정하지 않는다.

## 9.2 Counterexample Pass 질문

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

이 질문들은 예시다. 평가자는 현재 코드와 변경 범위에 맞는 대표 반례를 추가한다. 단, 같은 위험 패턴을 표현만 바꿔 무한히 늘리지 않는다.

## 9.3 100점과 99점의 사용

- 현재 범위에 필요한 Pass + 적용 가능한 100점 Gate + bounded Counterexample Pass 후에도 **구체적인 A/B급 문제를 찾지 못했다면 100점**을 부여한다.
- C 비감점 관찰사항이 남아 있다는 이유만으로 99/99.5를 남겨두지 않는다.
- “아마 뭔가 있을 것 같아서”, “완벽한 소프트웨어는 없어서” 같은 이유로 99/99.5를 남겨두지 않는다.
- 반대로 필요한 Gate를 수행하지 않았는데 기존 테스트와 정적 검사만 통과했다는 이유로 100점을 주지 않는다.

## 9.4 평가·수정 종료 조건

다음 조건을 모두 만족하면 평가 또는 `수정해` 반복을 종료한다.

```text
[ ] 미해결 A = 0
[ ] 미해결 B = 0
[ ] 변경 영향 범위의 자동/정적/회귀 QA가 실행 가능한 범위에서 PASS
[ ] 고위험 변경이면 관련 async·persistence·transaction 반례를 추가 검토
[ ] 마지막 bounded Counterexample Pass 1회에서 새로운 A/B 없음
```

종료 후 새로 생각나는 **이론적 가능성, 극저확률 다중 장애, 미세 유지보수 개선, 취향성 개선, C급 관찰사항**은 기존 평가를 다시 열기 위한 근거로 사용하지 않는다. 새로운 실제 증거, 재현 경로, 사용자 보고, 또는 다음 코드 변경이 생겼을 때 다시 평가한다.

---

# 10. 평가 전 최종 체크리스트

`점수` / `평가` / `평가해줘` 전에는 내부적으로 다음을 확인한다.

```text
[ ] 현재 평가 범위를 판정할 수 있는 최신 실제 소스를 확인했는가
[ ] 과거 평가 점수를 baseline으로 사용하지 않았는가
[ ] 해당 범위의 handover에서 현재 설계 의도를 확인했는가
[ ] `평가` / `평가해줘` 계열이면 `ct35_evaluation.md`를 실제로 읽었는가
[ ] 평가 보호 규칙을 먼저 확인했는가
[ ] KRX/Pension PIN, 개인보기 gesture, native select, render/cache bust 등 보호 항목을 잠재적 가능성만으로 감점하지 않았는가
[ ] 실제 재현·사용자 영향·구체적 오류가 없는 항목을 B급으로 억지 제시하지 않았는가
[ ] 테스트 부재·개수 자체를 A/B 또는 감점·가산 근거로 사용하지 않았는가
[ ] 테스트 PASS만을 단독 평가 종료 조건으로 사용하지 않았는가
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
[ ] 위험도에 맞는 대표 adversarial scenario를 생성했는가
[ ] 마지막에 100점을 깨는 현실적 A/B급 반례를 bounded pass로 별도 검토했는가
[ ] `평가`/`평가해줘`라면 CSS·JS·UI·UX 하위 평가표를 모두 작성했는가
[ ] `평가`/`평가해줘`라면 CT35 1~35 전 항목을 별도 섹션에 모두 출력했는가
[ ] 좁은 기능 평가라면 CT35 35개 행을 `적용 / 간접 적용 / N/A`로 빠짐없이 분류했는가
[ ] UI 실제 화면 영역 inventory와 영역별 판정을 작성했는가
[ ] UX 주요 flow inventory와 flow별 상태 전이 판정을 작성했는가
[ ] 100점 하위 항목에도 구조·기능·반례 검토 근거를 남겼는가
[ ] 충분한 범위의 반증 평가 후 실제 A/B 감점 근거가 없다면 C 존재 여부와 무관하게 100점을 허용했는가
[ ] 미해결 A/B가 0이고 마지막 bounded Counterexample Pass에서 새 A/B가 없다면 평가를 종료했는가
[ ] 평가 범위 규칙상 GAS가 포함되는 요청이라면 root `GAS_code.js`를 함께 평가했는가
[ ] GAS가 평가 범위에 포함된 경우 Dashboard 점수와 GAS 서버 점수를 별도로 취급했는가
[ ] `GAS_code.js` 기본 평가에서 fault budget 밖의 극저확률 다중 장애를 B로 승격하지 않았는가
[ ] `GAS_code.js` 상세 Pension/KRX bullet을 mandatory 전수 조합 체크리스트로 오해하지 않았는가
[ ] `GAS_code.js` 수정 후 마지막 bounded pass가 끝났다면 반례의 반례를 재귀적으로 만들어 patch loop를 다시 열지 않았는가
```

---

# 11. Regression Test 제안 원칙

평가 중 기존 테스트가 놓친 실제 결함을 발견하면, 수정 작업을 수행하지 않더라도 가능한 경우 회귀 테스트 후보를 함께 제시한다.

좋은 회귀 테스트는 **발견된 버그의 구현 세부가 아니라 실패 contract**를 보호한다.

예:

```text
KRX
→ modal A request 진행 중 close/re-open 후 A 응답이 modal B를 덮지 않는다.

Market AI
→ request A의 json parse가 늦게 끝나도 request B의 최신 상태를 덮지 않는다.
→ 실시간 시세 modal close 후 Topbar trigger에 focus가 있어도 5초 갱신마다 화면 scroll이 위로 이동하지 않는다.

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

# 12. 문서 유지관리와 최종 원칙

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

> **최신 실제 구현을 필요한 범위에서 독립적으로 확인하고, 설계 의도를 존중하되 실제 재현 가능한 A/B급 문제는 점수에 숨김없이 반영한다. C는 비감점 관찰사항으로 구분한다.**
>
> **기존 테스트와 체크리스트가 놓친 상태공간을 위험도에 맞는 대표 반례로 능동적으로 검토하되, 미해결 A/B가 없고 마지막 bounded Counterexample Pass에서 새 A/B가 나오지 않으면 평가를 종료하고 100점을 허용한다.**
