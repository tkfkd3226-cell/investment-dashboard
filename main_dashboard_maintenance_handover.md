# main_dashboard_maintenance_handover · 메인 대시보드 유지보수 및 인수인계


이 문서는 투자 대시보드의 **단일 유지보수·인수인계 기준 문서**다.

새 채팅이나 새 작업에서는 최신 전체 ZIP 안의 이 파일을 가장 먼저 읽고, 그 다음 같은 ZIP의 실제 소스를 확인한다. **읽는 순서와 source of truth의 우선순위는 다르다.** 문서는 작업 원칙을 설명하지만 실제 구현 상태는 항상 최신 ZIP의 실제 파일이 우선한다.

문서의 기본 흐름은 다음과 같다.

```text
1. 인수인계 / Source of Truth
2. 평가 / 점수
3. 수정 / QA / Diff / 결과 전달
4. 현재 프로젝트 구조
5. UI / Responsive 반복 회귀 불변조건
6. CSS / Responsive 유지보수 규칙
7. JavaScript 구현 규칙
8. Calc / Report 유지보수 규칙
9. 운영 데이터 / GitHub Actions / GAS
10. 리팩토링 이력 / 역사적 기준선
11. 최종 운영 체크리스트
```

**1~9장은 현재 작업에 직접 적용하는 현행 규칙이고, 10장은 과거 구조 변경의 역사 기록, 11장은 작업 전후 최종 확인용이다.**

# 1. 인수인계 · Source of Truth


## 1.1 이 문서의 역할과 현재 파일명

이 파일은 투자 대시보드의 **단일 유지보수·인수인계 기준 문서**다.

정확한 파일명:

```text
main_dashboard_maintenance_handover.md
```

새 채팅이나 새 작업에서는 사용자가 제공한 **최신 전체 ZIP**을 기준으로 다음 순서를 따른다.

```text
최신 ZIP 확인
→ ZIP 내부 이 MD 전체 읽기
→ 같은 ZIP의 실제 구조/소스 확인
→ 사용자 명령에 해당하는 범위만 수행
```

읽는 순서와 진실의 우선순위는 다르다. 이 MD는 설계 의도·운영 제약·QA 기준을 설명하고, **실제 구현 상태는 항상 같은 최신 ZIP의 실제 파일이 우선**한다.

사용자는 이 MD를 별도로 첨부할 필요가 없다. 최신 전체 ZIP 하나가 코드와 인수인계 문서를 함께 전달하는 단일 패키지다.

ZIP 내부에 이 MD가 없거나 읽을 수 없으면 과거 대화 기억으로 대체하지 말고 그 사실을 사용자에게 알린다.


## 1.2 최신 ZIP 작업의 공통 읽기 순서

최신 전체 ZIP이 첨부된 작업에서는 작업 종류와 관계없이 이 MD를 먼저 읽고, 그 다음 실제 파일 구조와 요청 관련 소스를 확인한다.

중요:

```text
ZIP 첨부 자체
≠ 인수인계
≠ 평가
≠ 수정
≠ QA
```

ZIP은 최신 source of truth를 제공하는 입력이고, **실행 모드는 사용자 명령이 결정**한다.

새 채팅 최초 진입 또는 기준 구조를 아직 읽지 않은 상태에서는 이 MD를 전체 읽는다. 같은 채팅에서 이미 같은 기준 구조를 읽은 뒤 더 최신 ZIP이 올라온 경우에는 **MD 자체가 변경되었는지 확인한 뒤 변경된 문서/관련 section과 실제 diff를 중심으로 재확인**할 수 있다. 다만 구조·운영 규칙이 바뀌었을 가능성이 있거나 평가/최종 QA처럼 전체 기준이 필요한 작업에서는 다시 전체를 확인한다.

과거 채팅 기억이나 예전 ZIP을 최신 기준으로 추정하지 않는다.


## 1.3 `인수인계` 명령

최신 전체 ZIP과 함께 사용자가:

```text
인수인계
```

라고 하면 다음만 수행한다.

```text
이 MD 확인
→ 실제 구조와 핵심 소스 확인
→ 현재 기준선 / 운영 원칙 / 유지보수 제약 파악
→ 파일 수정 안 함
→ QA/점수평가 안 함
→ 인수인계 완료 여부만 간단히 보고
```

`인수인계`는 평가 요청이 아니다.


## 1.4 최신 파일 우선 원칙

- 이전 대화에서 기억한 코드를 최종본이라고 추정하지 않는다.
- 현재 작업에 첨부된 최신 ZIP/파일을 직접 읽고 작업한다.
- 과거 selector, 함수, DOM, 파일 경로를 현재 코드에 그대로 적용하지 않는다.
- 요청과 직접 관련된 파일과 사용처를 필요한 범위에서 확인한다.
- 요청과 무관한 파일이나 영역은 수정하지 않는다.

기본 원칙:

> **최신 파일 기준 + 최소 변경**


## 1.5 Source of Truth 우선순위

내용이 충돌할 때의 우선순위는 다음과 같다.

1. 현재 작업에 첨부된 최신 전체 ZIP의 실제 파일
2. 같은 ZIP의 `main_dashboard_maintenance_handover.md`
3. 같은 ZIP의 `README.md`
4. 과거 대화·과거 ZIP·역사적 점수 기록

따라서 MD나 README가 실제 코드와 다르면 문서를 근거로 코드를 되돌리지 않는다. 먼저 차이를 확인하고 **실제 최신 코드 상태를 기준으로 판단**한다.


## 1.6 새 채팅으로 이동할 때의 기본 인수인계 방식

새 채팅에는 원칙적으로 최신 전체 ZIP 하나만 첨부한다. 별도의 긴 인수인계문을 새로 만들 필요가 없다.

사용자는 ZIP 첨부 후:

```text
인수인계
```

또는 바로 작업 요청을 보낼 수 있다.

이후 작업은 필요에 따라:

```text
1차
QA
2차
QA
...
```

형태로 이어간다.


## 1.7 새 채팅 시작 시 먼저 확인할 것

새 채팅에서 수정 전에 최소 다음을 확인한다.

### 1. ZIP 내부 인수인계 MD

- `main_dashboard_maintenance_handover.md` 존재/가독 여부
- 현재 구조·운영 규칙·진행 기준선

### 2. 프로젝트 구조

- 실제 디렉토리/파일 구조
- 요청 관련 변경 대상
- MD 기록과 실제 ZIP의 구조 일치 여부

### 3. JavaScript

- main 8개 module graph + Market AI standalone entry (`dashboard-modal.js` lifecycle 공유)
- `core` DOM 비의존
- `ui-common` 저수준 공통 책임
- pension View / Editor 분리
- module-private state ownership
- main graph 단일 module entry + Market AI standalone
- import graph / circular import / global bridge / boot 구조

### 4. CSS / Responsive

- 메인 CSS 6파일 canonical role / load order
- Desktop ≥1101 / Tablet 761~1100 / Mobile ≤760 기본 구간
- `special.css`의 기능성 예외
- 현재 section/title/topbar 관련 불변조건

### 5. 데이터 / 진행위치

- 보호 JSON 존재 여부와 요청 무관 data 변경 금지
- MD의 기준선과 최신 ZIP이 실제로 일치하는지

일치하면 과거 작업을 다시 설계하거나 재수정하지 않고 바로 현재 요청으로 이어간다.


## 1.8 MD와 최신 ZIP이 다를 때

MD와 최신 ZIP이 다르면 **임의로 어느 한쪽을 맞추지 않는다.**

- ZIP이 과거 구조라면 차이를 보고하고 확인한다.
- ZIP이 MD보다 더 최신 구조라면 실제 ZIP을 우선하고 MD가 오래된 것으로 판단한다.
- 문서 정합화가 필요하면 코드가 아니라 MD를 현재 구조에 맞춰 수정하는 것이 기본이다.


## 1.9 GitHub / 로컬 파일이 엇갈릴 때

로컬/원격 상태가 엇갈릴 수 있으므로 파일명이나 수정시간만으로 최신본을 판단하지 않는다.

필요 시 확인:

- Git HEAD / remote / working tree
- 실제 file hash / diff
- 운영 JSON 갱신과 코드 변경의 분리
- conflict 파일의 양쪽 실제 내용

대규모 patch 전에는 **어느 전체 ZIP이 최종 PASS 기준본인지 먼저 확정**한다.


## 1.10 이 문서의 유지관리 원칙

이 문서는 changelog가 아니라 **장기 유지보수 기준서**다.

다음처럼 기준선이 바뀔 때 갱신한다.

- 구조 리팩토링 완료
- JS/CSS architecture 변경
- breakpoint 정책 변경
- 중요한 UI 불변조건 변경
- QA/평가 운영 방식 변경
- 새 채팅 인수인계에 필요한 기준선 변경

다음은 별도 요청이 없는 한 누적하지 않는다.

- 버튼 하나의 미세 간격
- 문구 1개
- 단발성 버그 수정
- 단순 data/KRX 갱신
- CSS가 직접 소유해야 할 미세 px 값

사용자가 앞으로 반복 적용할 유지보수·수정·QA·파일전달 조건을 새로 추가하거나 바꾸면 관련 기존 항목에 반영한다. 일회성 작업 지시는 장기 규칙으로 확대하지 않는다.

목표는 문서를 계속 길게 만드는 것이 아니라:

> **다음 채팅이 최신 ZIP과 이 문서를 읽고 현재 구조를 정확히 이어서 작업할 수 있게 하는 것**

이다.

# 2. 평가 · 점수


## 2.1 평가 명령 구분

다음 두 명령은 목적과 출력 형식이 다르다.

```text
점수
→ 최신 실제 소스를 필요한 범위에서 검증해 CSS / JS / UI / UX 점수를 새로 산정
→ 점수표만 간결하게 출력
→ 상세 문제 분석·수정·ZIP 생성 없음

평가 / 평가해줘
→ 최신 ZIP을 처음부터 독립 분석
→ CSS / JS / UI / UX 상세 평가
→ A / B / C 문제 분류와 최종 결론 포함
→ 파일 수정·ZIP 생성 없음
```

`평가`와 `평가해줘`는 같은 명령으로 처리한다. 현재 채팅에 최신 전체 ZIP이 명확히 없으면 과거 ZIP이나 기억으로 평가하지 않고 최신 전체 ZIP을 요청한다.


## 2.2 `점수` 명령 출력 규칙

`점수`는 과거 점수표를 복사하지 않고 최신 ZIP 실제 상태에서 새로 산정한다. 필요한 검증은 내부적으로 수행하되 답변에는 점수 중심으로 표시한다.

### CSS
- 구조 / 파일 구성
- Cascade / Specificity
- Responsive
- Theme / Token
- Interaction CSS
- `!important`
- Dead / Legacy
- 유지보수성
- **CSS 총점 /100**

### JavaScript
- Module responsibility
- Dependency
- State ownership
- Public API
- Events
- Rendering
- Async / Error
- 유지보수성 / 확장성
- **JS 총점 /100**

### UI
- Visual hierarchy / Layout / Typography / Spacing
- Table / Modal / Tooltip / Chart UI
- Responsive / Theme / Interaction consistency
- **UI 총점 /100**

### UX
- 날짜 / KRX / 개인보기 / 퇴직연금 / 차트 / 모바일
- Feedback / Error recovery / Accessibility
- **UX 총점 /100**

마지막에는:

```text
UI/UX 총점 = UI와 UX 평균
전체 총점 = CSS / JS / UI / UX 동일가중 평균
```

을 표시한다. `모든 점수`는 단독 사용 시 `점수`와 같은 의미로 처리한다.


## 2.3 `평가` / `평가해줘` 공통 독립 평가 프로토콜

### A. 기본 원칙

평가는 그 시점의 최신 ZIP을 **처음부터 다시 독립 분석**하는 작업이다.

```text
최신 ZIP 실제 파일 우선
→ 이 MD로 설계 의도와 허용된 trade-off 확인
→ 실제 구조/코드를 재검증
→ 실제 근거가 있는 경우에만 감점
→ A / B / C로 문제 분류
→ 평가만 수행하고 파일은 수정하지 않음
```

과거 `PASS`, `100점`, 이전 평가문은 최신 정상 판정의 증거가 아니다.

Source of Truth 우선순위는 1.5와 동일하다.


### B. 평가 범위와 외부 백엔드 경계

#### GAS

GitHub ZIP만 제공된 경우 frontend가 GAS로 보내는 request와 client-side response 처리까지 본다. 최신 운영 GAS 소스가 별도로 제공된 경우에만 server handler까지 완전 대조한다.

GAS 미첨부 자체는 CSS / JS / UI / UX 감점 사유가 아니다. GAS 코드 품질도 사용자가 별도 요청하지 않는 한 메인 점수에 합산하지 않는다.

#### Market AI

Market AI 백엔드는 기본 평가 대상에서 제외한다.

대시보드에서는 `dashboard-market-ai.js`의 frontend adapter 구조, main graph와의 분리, mount/polling/timeout/stale 처리, 실패 격리, CSS ownership만 필요한 범위에서 확인한다.

```text
백엔드 미첨부·미연결
→ 메인 CSS / JS / UI / UX 감점 없음

백엔드 최신 소스 + 별도 평가 요청
→ Market AI 백엔드를 별도 범위로 평가
→ 메인 대시보드 점수와 자동 합산하지 않음
```


### C. 프로젝트 구조와 정적 검증

평가 시작 시 실제 ZIP의 디렉토리/파일 목록을 먼저 확인한다. 현재 canonical 구조는 4장을 참고하되 **실제 ZIP이 다르면 실제 구조가 우선**한다.

최소 보고:

- 실제 main entry
- 메인 CSS 파일/역할
- JS module 수와 파일명
- Python / Workflow
- data
- `add/calc` / report
- 문서와 실제 구조의 불일치 여부

가능한 실행 환경에서는 다음을 실제 검사한다.

#### CSS
- parse
- rule/declaration 구조
- `!important`
- media query inventory
- exact duplicate selector / 동일 context
- override / specificity outlier
- CSS variable 정의/사용
- hard-coded color 및 dead/legacy 후보

#### JavaScript
- ES Module syntax
- 실제 import graph / circular dependency
- export 사용처
- 의도치 않은 global bridge
- helper 중복 후보
- listener/state ownership
- fetch / timeout / response / parse handling

#### Python / Workflow
- Python syntax
- workflow YAML parse
- workflow input 설명과 Python 실제 동작의 정합성

도구가 특정 문법을 해석하지 못한 경우 도구 한계와 실제 코드 오류를 구분한다.


### D. CSS 평가 기준

현재 메인 CSS는 `common / tablet / mobile / special / interaction / print` 6파일 구조다. 파일 개수 자체를 감점하지 않고 실제 역할 분리와 cascade 안정성을 본다.

확인:

- section / ownership이 실제 기능과 맞는지
- 관련 rule의 응집도와 탐색성
- 이유 없는 override chain / 높은 specificity
- source-order 의존성의 명확성
- Desktop ≥1101 / Tablet 761~1100 / Mobile ≤760 기본 구간
- `special.css` 등 기능성 예외의 실제 필요성
- theme / semantic token / spacing / radius / typography
- light/dark counterpart
- dead / legacy CSS의 실제 사용처

`continuation`, cross-cutting rule, selector 길이, 추가 media query는 **실제 이유와 영향**을 보고 판단한다.

`!important`는 개수만으로 감점하지 않는다. browser/native 대응 등 실제 이유가 있으면 허용한다. 현재 0개라는 사실 자체를 점수 목표로 삼지 않는다.

Dead CSS 판정 전에는 HTML, JS dynamic class, template literal, `classList`, state class, pseudo/media/print, chart SVG 생성까지 확인한다.

인쇄 관련 selector를 dead로 판단할 때는 `dashboard-charts.js`의 `beforeprint` 흐름까지 확인한다. 현재 비활성 자산 탭의 차트만 추가 렌더링해 증권계좌·퇴직연금 차트가 모두 인쇄되도록 하는 구조를 보존하며, 활성 탭 차트를 불필요하게 재렌더하거나 비활성 탭 차트를 lazy-render 상태로 남겨 빈 차트가 인쇄되는 회귀를 허용하지 않는다.


### E. JavaScript 평가 기준

main graph 8개 ES Module과 `dashboard-market-ai.js` standalone entry를 실제로 읽고 다음을 확인한다.

- module responsibility
- dependency 방향 / circular dependency
- core의 DOM 비의존
- app의 orchestration 범위
- pension View / Editor 분리
- chart state ownership
- public export 실제 소비처
- module-private/shared state 구분
- delegated/direct event와 중복 listener guard
- render / DOM insertion / escape / ARIA reference
- async fetch / timeout / response.ok / JSON/application-level contract
- duplicate request / race / operation id / idempotency

파일 길이만으로 분리를 권하지 않는다. 하나의 subsystem으로 응집되어 있으면 큰 파일도 허용한다.

전체 dashboard `render()` 방식 역시 현재 규모에서 허용된 trade-off이므로 실제 병목이 측정되지 않는 한 감점하지 않는다.


### F. Frontend ↔ Backend contract

#### KRX

Frontend의 두 mode를 실제 코드로 확인한다.

```text
최신/누락 → body.date 없음
재갱신   → body.date = activeDate
```

선택 날짜가 화면에 존재한다는 사실과 request body의 `date` 존재를 혼동하지 않는다.

GAS가 제공된 경우 명시 날짜 처리, skip, workflow dispatch, action/reason/message, PIN error contract까지 확인한다.

#### Pension

최소 확인:

```text
upsert / delete / batchPension
batchRequestId / PIN / operations
response state / duplicate·idempotency 처리
```

server contract는 최신 GAS가 제공된 경우에만 완전 대조한다.


### G. UI / UX 평가 기준

UI는 코드 구조와 분리해서 실제 화면 설계 관점으로 본다.

주요 영역:

- Topbar / Hero / date controls
- action buttons / external links
- 연금+계좌 성과
- 증권계좌 / 퇴직연금 성과·보유분
- 차트 / 확대
- 장부결과 VS 실제보유
- 투자원금 원천 및 검산
- Table / Modal / Tooltip
- Navigation / TOC / Mobile hamburger
- 실제 존재하는 Footer

실제 존재하지 않는 영역은 `N/A`이며 감점하지 않는다.

공통 평가 요소:

```text
정보 위계 / alignment / spacing / density / typography
label clarity / interaction consistency
hover / active / focus / touch
responsive / light-dark / overflow / z-index / readability
```

#### Table

현재 존재하는 모든 table variant를 기준으로 header/body alignment, sticky first column, summary, source table 예외, hover, mobile table/card, phone landscape table-only, narrow-width 예외, tooltip clipping을 본다.

특정 과거 표 수정사항을 체크리스트로 외우지 않고 현재 DOM/CSS에서 실제 구현된 behavior를 inventory한다.

#### Tooltip / Overlay

trigger semantic, open/close, outside click, ARIA, viewport overflow, stacking, light/dark를 확인한다.

#### 주요 UX flow

```text
날짜: year/month → day → activeDate → render
KRX: modal → PIN → action → loading → success/skip/error → feedback
개인보기: OFF/ON 3회 gesture → state/reset/layout
퇴직연금: 조정/적립/추가매수/삭제/PIN/batch/save/render
Chart: legend/최소1개/전체/Y auto/mode/확대/keyboard/resize/tooltip
```

개인보기 3회 클릭은 **일반 사용자에게 진입 경로를 숨기는 의도된 private gesture**이므로 discoverability나 일반 button이 아니라는 이유만으로 감점하지 않는다.

UX는 실제 상태 혼란, 오동작 가능성, feedback 불일치, 복구 어려움, 불필요 반복, destructive action 불명확성처럼 **사용자 영향이 있을 때만** 지적한다.


### H. Accessibility / Interaction

실제 static/dynamic markup에서 다음을 확인한다.

- `<a>` / `<button>` semantic과 button `type`
- keyboard / `:focus-visible`
- dialog role / aria-modal / focus trap / focus return / ESC
- label / aria-label / aria-controls / labelledby / describedby / expanded
- aria-live/status
- table caption / scope
- chart keyboard support
- hover-only 정보 / touch target
- contrast / user-select / touch-action / draggable

Native `<select>`의 펼친 option UI는 browser/OS native rendering일 수 있으므로 viewport별 native 색상 차이만으로 custom select 전환을 권하지 않는다.

퇴직연금 Action PIN의 `type="text" + inputmode="numeric" + -webkit-text-security:disc`는 Chrome 비밀번호 저장 제안을 피하면서 PIN 마스킹을 유지하기 위한 의도된 처리다. 비표준 CSS라는 이유만으로 감점하거나 `type="password"`로 되돌리라고 제안하지 않는다. 실제 대상 브라우저에서 문제가 확인된 경우에만 재검토한다.


### I. 성능 / 유지보수성에서 반복 감점하지 않을 항목

다음은 **실제 문제가 확인되지 않는 한** 감점하거나 선택적 개선안으로 반복 제시하지 않는다.

```text
전체 dashboard render 방식
Date.now() 기반 cache bust
Vanilla JS / framework·state library 미사용
CSS 파일 개수 자체
CSS / JS / handover의 길이·줄 수·byte 크기 자체
Playwright / Jest / ESLint / Stylelint 등 대형 테스트·lint 인프라 부재 자체
```

잠재적 가능성만으로 감점하지 않는다. 실제 체감 지연·profiling 병목·재현성 장애·반복 회귀와의 직접 연관이 확인되었거나 사용자가 해당 최적화/인프라 도입을 명시적으로 요청한 경우에만 재검토한다.

현재의 변경 범위 diff + syntax/import/cascade 검사 + viewport/fixture + Calc Node 회귀테스트 + 필요 시 실기기 QA는 이 프로젝트에서 허용된 유지보수 검증 방식이다.


### J. Runtime 검증 원칙

가능한 환경에서는 정적 분석에 더해 runtime smoke를 수행한다.

우선순위:

1. 로컬 정적 서버
2. 실제 data JSON
3. 대표 날짜 / 최신·과거 날짜
4. personal view OFF / ON
5. representative viewport
6. light / dark

대표 기본 viewport는 다음을 사용한다.

```text
1440
1024
900
768
430
390
```

현재 CSS에 기능성 exception이 있으면 해당 조건을 추가한다. 이 숫자는 UI 미세 geometry가 아니라 **Desktop / Tablet / Mobile의 대표 runtime 검증 폭**이므로 평가 프로토콜 값으로 유지한다.

확인 예:

- runtime exception / duplicate id / broken ARIA
- overflow / hidden collision
- modal focus
- table/tooltip clipping
- chart SVG size
- mobile layout

브라우저 실행 환경이 없으면 실제 pixel/render를 확인했다고 가장하지 않고 `정적 코드 기준` 또는 `runtime smoke 미실시`라고 명시한다.


### K. 점수 산정과 문제 분류

과거 점수를 참고하지 않고 최신 실제 근거로 새로 산정한다.

```text
실제 감점 근거 있음 → 감점
실제 감점 근거 없음 → 100 가능
"완벽한 소프트웨어는 없으니 99" 식 감점 금지
점수용 억지 개선안 금지
N/A 항목을 점수 하락 근거로 사용 금지
```

문제는 다음으로 분류한다.

#### A. 실제 수정 권장

bug, 기능 불일치, cascade/responsive 회귀, 접근성 오류, 실제 UX 혼란, 운영을 잘못 유도할 문서 오류 등 **구체적 영향이 있는 문제**.

#### B. 선택적 개선

현재 정상이고 회귀도 없지만 실제 장점이 분명한 경우만 제안한다. B급을 채우기 위해 후보를 만들지 않는다.

#### C. 수정하지 않는 게 나음

현재 설계 의도에 맞거나, 복잡도/회귀 위험이 이득보다 큰 경우, browser native behavior, 이미 검토된 trade-off, 점수 목적의 정리.

가능하면 A/B/C 각 항목에 파일, selector/함수/영역, 현재 상태, 실제 영향, 판정 이유, 권장 방향을 적는다.

README / handover / workflow description이 실제 코드와 다르면 **문서 정확성 문제**로 별도 표시한다. 실행 품질과 무관한 문서 오류를 CSS/JS/UI/UX 점수에 억지로 섞지 않는다.


### L. 평가 결과 출력 순서

기본 순서:

1. 한눈에 보는 결론
2. 실제 프로젝트 구조
3. 검증 방법과 가능/불가 범위
4. CSS 상세 평가
5. JS 상세 평가 + dependency graph
6. Frontend ↔ GAS / Workflow contract
7. UI 영역별 평가
8. UX flow별 평가
9. Accessibility / Interaction
10. 성능 / 유지보수성
11. A / B / C 문제 목록
12. 세부 점수표
13. 최종 결론

최종 결론에는 CSS / JS / UI / UX / UI·UX 종합 / 전체 총점, A/B/C 개수, 현재 구조가 기준선으로 적절한지와 추가 구조 리팩토링이 실제로 필요한지를 명시한다.

과거 특정 수정사항을 평가 체크리스트로 계속 누적하지 않는다. 최신 ZIP에서 현재 존재하는 DOM/CSS/state/event/UX flow/breakpoint를 처음부터 inventory하여 평가한다.


## 2.4 평가 답변 작성 형식

전체 평가는 일반 Markdown 제목, 문단, 표 중심으로 작성한다.

- 읽기 어려운 특수 형식에 의존하지 않는다.
- selector/함수 증거가 필요할 때만 짧은 코드 블록을 사용한다.
- 검증 근거는 해당 항목 바로 아래에 둔다.
- 점수표만 나열하지 않고 실제 근거를 함께 설명한다.
- 과거 평가 문구를 복사하지 않고 최신 실제 코드에서 확인한 사실을 설명한다.


## 2.5 점수 · 성능 평가 최종 운영 원칙

현재 리팩토링된 구조는 새로운 기준선이다. 점수를 올리기 위해 정상 구조를 계속 뜯지 않는다.

금지 예:

```text
!important 숫자를 줄이기 위한 억지 수정
media query 개수만 줄이기
JS 파일을 점수 때문에 추가 분할
큰 함수라는 이유만으로 무조건 재작성
미세 UI 수치 조정만으로 전체 점수 상승
```

우선순위:

1. 기능 정확성
2. 계산 parity
3. 회귀 없음
4. 현재 책임 구조 유지
5. UI 일관성
6. 유지보수성
7. 최소 변경

점수는 그 결과를 추적하는 보조 지표다.

현재 전체 `render()`와 `Date.now()` cache bust는 이미 검토된 허용 가능한 trade-off다. 실제 체감 지연·과도한 네트워크 사용·렌더 병목 등이 확인되었거나 사용자가 성능 최적화를 명시적으로 요청한 경우에만 최신 소스와 측정 결과를 기준으로 재검토한다.

# 3. 수정 · QA · Diff · 결과 전달

이 장은 수정 작업의 실행 방식과 QA 범위를 한곳에서 정의한다. 같은 원칙을 차수별·파일별로 반복해서 적지 않는다.

## 3.1 명령별 실행 모드

| 사용자 명령 | 의미 | 기본 검증 범위 |
|---|---|---|
| `수정`, 구체적 수정 요청 | 요청한 범위만 수정 | 영향 범위 + 최소 회귀 |
| `1차`, `2차`, `3차` 등 | 해당 차수 작업을 실제 반영 | 해당 차수 변경 범위 |
| `QA` | 직전 변경분 검증 | 변경 파일·연결부 중심 |
| `전체 QA` | 프로젝트 전역 검증 | 메인 + add + 데이터/연결부 |
| `평가` | 현재 ZIP 독립 평가 | 2장 프로토콜 |

`QA`를 `전체 QA`로 임의 확대하지 않는다. 반대로 구조 공통부를 수정했으면 직전 변경분만 보더라도 그 공통부가 연결되는 대표 화면은 확인한다.

## 3.2 수정의 기본 순서

```text
최신 ZIP 확인
→ 관련 handover 확인
→ 영향 범위 확인
→ 최소 수정
→ syntax / import / 계산 검증
→ diff 확인
→ 필요한 viewport / runtime QA
→ 변경 파일만 결과물로 전달
```

항상 **최신 파일 기준 + 최소 변경**을 우선한다. 과거 대화의 코드나 파일 구조를 현재 소스라고 추정하지 않는다.

수정 중 더 좋은 구조가 보여도 요청 범위와 무관하면 섞지 않는다. 단, 현재 요청을 안전하게 구현하기 위해 꼭 필요한 공통 수정은 허용하며 이유와 영향 범위를 보고한다.

## 3.3 QA 범위와 판정

QA는 변경범위에 비례한다.

### 공통 최소 검사

- 변경 파일 syntax 오류
- ES Module import/export 누락 또는 순환 의존성
- 로컬 경로·ID·필수 DOM 참조 파손
- 의도하지 않은 CSS cascade / breakpoint / `!important`
- event listener 중복 등록
- 변경하지 않은 기능의 대표 회귀
- 실제 diff가 요청 범위와 일치하는지

### UI/CSS 변경

대표 viewport는 다음을 기본으로 한다.

```text
Desktop: 1440 / 필요 시 1280
Tablet: 1024 또는 900
Mobile: 390 / 필요 시 374
```

기본 breakpoint는:

```text
Desktop ≥ 1101
Tablet 761~1100
Mobile ≤ 760
```

특수 viewport는 현재 `special.css` 또는 명시된 add 규칙에 이미 존재하거나 기능상 필요한 경우만 확인한다. 스크린샷 한 장을 맞추기 위한 새 breakpoint는 만들지 않는다.

### JS 구조 변경

최소 확인:

```text
node --check
import target 존재
import한 export 존재
circular dependency 0
boot 1회
listener 중복 0
```

파일 분리는 줄 수가 아니라 책임·state ownership·dependency 방향으로 판단한다.

### Calc 계산 로직 변경

`add/js/calc.js`의 계산/validation을 건드렸으면 일반 syntax 검사에 더해 반드시 실행한다.

```bash
node --test tests/calc.test.cjs
```

현재 회귀테스트는 production `compute()`, `validate()`, `ceil5()`를 직접 호출한다. 테스트를 위해 계산식을 별도 복사하지 않는다.

검사 범위에는 최소한 다음이 포함된다.

- 이전 거래 없음
- 이전 거래 후 재매수
- 보유 중 추가매수
- current / rise / target 모드
- 자동 손익분기
- 5원 주문단위 올림
- 3개 매도 전략
- 주요 validation 실패 조건

계산 테스트 FAIL이면 UI 수정 여부와 관계없이 결과물을 PASS로 보고하지 않는다.

### Report / 운영 숫자 변경

`add/add_maintenance_handover.md`의 확정 계산 기준과 체크리스트를 우선한다. 표·KPI·차트·`data/portfolio.json`의 누계가 서로 맞는지 교차검산한다.

## 3.4 QA FAIL 처리

QA 중 실제 회귀가 발견되면:

```text
FAIL 원인 특정
→ 직전 변경과의 인과 확인
→ 최소 수정
→ 실패 항목 재검증
→ 연결된 대표 회귀 재검증
```

QA라는 이유로 디자인을 임의 변경하지 않는다. FAIL을 고치면서 기존 의도까지 롤백하지 않는다.

환경 제한으로 실제 browser test가 불가능하면 정적 검증과 가능한 runtime 범위를 끝까지 수행하고, 실행하지 못한 항목만 명확히 표시한다. 실행하지 못한 검사를 PASS라고 쓰지 않는다.

## 3.5 누적 기준본 관리

수정이 완료된 결과물이 다음 작업의 기준이 된다. 새 작업에서 이전 ZIP과 현재 ZIP이 같이 있으면 사용자가 가장 최근에 지정·업로드한 파일을 우선한다.

차수 작업은:

```text
기준본
→ 1차 수정
→ QA
→ 2차는 1차 PASS본 기준
→ QA
```

처럼 누적한다. 중간에 오래된 파일을 다시 기준으로 사용해 최근 수정이 사라지지 않게 한다.

## 3.6 Baseline parity와 반복 회귀

변경 범위와 연결된 기존 불변조건은 유지한다. 특히 다음은 수정 시 자주 회귀하므로 관련 영역을 건드렸을 때 확인한다.

- 개인보기 ON/OFF 전후 레이아웃 높이
- Theme / Corner active 상태
- 합계·총계·summary 행 border
- 모바일 table scroll / sticky
- 날짜 selector와 topbar 배치
- KRX 모달 버튼/문구
- 퇴직연금 편집 / PIN / 저장
- Chart selection / tooltip / resize
- Calc 거래유형별 결과표 열 구조

전체 반복 회귀 목록은 5장과 add handover를 기준으로 한다.

## 3.7 Diff 검사

모든 수정은 전달 전에 diff를 확인한다.

확인 항목:

```text
의도한 파일만 변경됐는가
요청하지 않은 데이터가 바뀌지 않았는가
최근 수정사항이 롤백되지 않았는가
dead code / 중복 rule을 새로 만들지 않았는가
단순 이름 변경이 기능값을 바꾸지 않았는가
줄바꿈/포맷팅만으로 대규모 diff가 생기지 않았는가
```

특히 운영 데이터:

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
data/pension_cash_snapshots.json
data/pension_trades.json
```

는 요청 없이 덮어쓰지 않는다.

## 3.8 CSS 수정 보고

CSS를 수정했으면 해당 CSS 파일에 대해 다음을 기본 보고한다.

- 수정 전/후 줄 수
- 수정 전/후 파일 크기
- 증감
- 새 breakpoint 여부
- `!important` 증감
- 예상 외 diff 여부

주석만 정리한 경우에는 실제 rule/property/value가 바뀌지 않았는지 별도로 확인한다.

## 3.9 JS 수정 보고

JS를 수정했으면 관련 범위에서:

- syntax
- import/export
- dependency 방향
- top-level side effect
- listener 중복
- boot 횟수
- 예상 외 diff

를 확인한다.

구조 변경이 아니라 rename이라면 rename 외 바이트/토큰 차이가 없는지도 가능하면 확인한다.

## 3.10 Calc 수정 보고

Calc는 UI보다 계산 결과의 정확성을 우선한다.

계산 로직을 수정한 경우:

1. `node --check add/js/calc.js`
2. `node --test tests/calc.test.cjs`
3. 관련 거래유형 fixture 확인
4. 관련 결과표 UI 확인
5. diff 확인

순서로 검증한다.

UI/CSS만 수정했고 계산 엔진에 diff가 없다면 회귀테스트는 선택적으로 실행할 수 있으나, 계산 엔진까지 함께 수정됐다면 필수다.

## 3.11 공통 코드 수정

공통 helper / token / shared render를 수정하면 단일 화면만 보고 끝내지 않는다. 그 공통 코드를 사용하는 대표 화면을 같이 확인한다.

반대로 공통화 자체를 목표로 하지 않는다. 우연히 비슷한 코드가 있다는 이유만으로 독립 영역을 결합하지 않는다.

## 3.12 신규 기능 추가 판단 순서

새 기능은 다음 순서로 판단한다.

1. 현재 구조에서 책임 파일이 어디인지
2. 기존 helper / token을 재사용할 수 있는지
3. state owner가 누구인지
4. responsive 영향이 있는지
5. 운영 데이터 계약을 바꾸는지
6. QA fixture가 필요한지

이 순서로 확인한 뒤 최소 범위에 구현한다.

## 3.13 결과 파일 전달

기본 원칙은 **실제 변경된 파일만 ZIP으로 전달**한다. 변경 파일이 1개여도 폴더 구조를 보존해 압축한다.

예:

```text
investment-dashboard-main/
├─ add/js/calc.js
├─ tests/calc.test.cjs
└─ requirements.txt
```

전체 프로젝트 ZIP이 필요하다고 사용자가 명시한 경우에만 전체본을 만든다.

차수 작업이 `1차 → QA → 2차 → ... → 마지막 QA(최종 QA)`처럼 진행된 경우, **마지막 QA가 완료되면 사용자가 다시 요청하지 않아도 해당 작업의 1차부터 최종 차수까지 실제로 수정된 파일의 최종본을 한꺼번에 모아 ZIP으로 제공한다.** 이 최종 ZIP은 직전 차수의 변경 파일만 담는 것이 아니라, 해당 작업 묶음 전체에서 수정된 파일을 누적 기준으로 모으고 원래 폴더 구조를 보존한다. 중간 차수에서는 해당 차수 변경 파일만 전달할 수 있다.

결과 보고에는 최소한 다음을 포함한다.

- 무엇을 바꿨는지
- QA 결과
- 변경 파일 목록
- 예상 외 diff 여부
- 필요 시 CSS 통계
- GitHub commit 문구

GitHub 문구는 두 줄로 제공한다.

```text
Summary: 짧은 핵심 요약
Description: 변경 범위와 검증 내용을 한 문장 또는 짧은 문단으로 설명
```

## 3.14 작업 중지 기준

사용자 요청이 현재 canonical 구조와 직접 충돌하거나 운영 데이터 훼손 가능성이 높으면 임의로 강행하지 않는다. 다만 단순히 구조가 바뀐다는 이유만으로 소극적으로 중지하지 말고, 최신 ZIP을 확인해 안전한 구현 방법이 있으면 그 방법으로 진행한다.

최우선 판단 순서는:

```text
1. 사용자 명시 요청
2. 최신 ZIP 실제 코드
3. 현재 handover 불변조건
4. 기능/데이터 정확성
5. 최소 변경과 회귀 방지
6. 미관·코드량·점수 최적화
```

점수를 위해 기능을 바꾸거나 불필요한 리팩토링을 추가하지 않는다.

# 4. 현재 프로젝트 구조 · Architecture


## 4.1 현재 canonical 프로젝트 구조 snapshot

아래는 이 문서를 재정비할 때 함께 확인한 최신 전체 ZIP의 실제 구조다. 이후 새 ZIP이 달라지면 **새 ZIP의 실제 파일을 우선**한다.

```text
investment-dashboard-main/
├─ .github/workflows/update-prices.yml
├─ .gitignore
├─ README.md
├─ add/
│  ├─ calc.html
│  ├─ add_maintenance_handover.md
│  ├─ css/common.css
│  ├─ css/calc.css
│  ├─ js/calc.js
│  └─ report/kodex-leverage-report.html
├─ css/
│  ├─ common.css
│  ├─ tablet.css
│  ├─ mobile.css
│  ├─ special.css
│  ├─ interaction.css
│  └─ print.css
├─ data/
│  ├─ account1_daily_snapshots.json
│  ├─ pension_cash_snapshots.json
│  ├─ pension_contributions.json
│  ├─ pension_trades.json
│  ├─ performance_snapshots.json
│  ├─ portfolio.json
│  └─ prices.json
├─ favicon.png
├─ index.html
├─ js/
│  ├─ dashboard-app.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-core.js
│  ├─ dashboard-market-ai.js
│  ├─ dashboard-modal.js
│  ├─ dashboard-pension-editor.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-ui-common.js
│  └─ dashboard-ui.js
├─ main_dashboard_maintenance_handover.md
├─ requirements.txt
├─ scripts/update_prices.py
├─ tests/calc.test.cjs
├─ tools/
│  ├─ close-efriend-tray.ps1
│  └─ inspect-efriend-ui.ps1
├─ InvestmentLocalSuite.ico
└─ start-local-server.pyw
```

메인 CSS는 6개 역할 파일로 분리되어 있으며 Desktop은 `common.css` baseline을 사용하고 `css/style.css`는 최종 구조에서 제거되었다. 파일별 줄 수와 크기는 변경 시점의 snapshot으로만 보고 고정값으로 취급하지 않는다.



## 4.2 현재 디렉토리 구조를 기준선으로 사용

현재 프로젝트는 개념적으로 다음 구조를 사용한다.

```text
investment-dashboard-main/
│
├─ index.html
│
├─ css/
│  ├─ common.css
│  ├─ tablet.css
│  ├─ mobile.css
│  ├─ special.css
│  ├─ interaction.css
│  ├─ print.css
│
├─ js/
│  ├─ dashboard-core.js
│  ├─ dashboard-ui-common.js
│  ├─ dashboard-modal.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-pension-editor.js
│  ├─ dashboard-app.js
│  └─ dashboard-market-ai.js  # standalone entry · dashboard-modal lifecycle만 공유
│
└─ add/
   ├─ calc.html
   ├─ add_maintenance_handover.md
   │
   ├─ css/
   │  ├─ common.css
   │  └─ calc.css
   │
   ├─ js/
   │  └─ calc.js
   │
   └─ report/
      └─ *.html
```

Calc 계산 회귀검증은 루트 `tests/calc.test.cjs`에서 관리한다.

이 구조를 앞으로의 기본 구조로 취급한다.

과거의:

```text
script.js
root calc.html
assets/
inline calc CSS
inline calc JavaScript
```

등의 구조가 현재도 존재한다고 가정하지 않는다.


## 4.3 메인 dependency graph는 8파일 ES Module 구조 유지

현재 main graph는 다음과 같다.

```text
js/
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
core            → 데이터 / 계산 / 공통 state / loading
ui-common       → 공통 저수준 DOM / 마크업 / 반응형 UI helper
modal           → custom/native dialog lifecycle / focus / inert / body lock
charts          → 차트 state / SVG / chart action
ui              → 일반 UI / topbar / navigation / UI action
pension         → 퇴직연금 조회 View
pension-editor  → 퇴직연금 변경 Editor / persistence flow
app             → cross-module orchestration / boot
```

단순 수정 때문에 다시 하나의 거대한 JS 파일로 합치지 않고, 반대로 책임 경계가 없는 작은 기능마다 새 파일을 추가하지 않는다.

`dashboard-market-ai.js`는 main feature state와 분리된 standalone entry다. 다만 Mobile dialog lifecycle을 위해 저수준 `dashboard-modal.js`만 공유하며, 상세 책임과 실패 격리 기준은 **4.9**에서 관리한다.

## 4.4 `dashboard-core.js` 책임

`dashboard-core.js`는 다음을 담당한다.

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

## 4.5 `dashboard-ui.js`와 `dashboard-ui-common.js` 책임

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
- 공통 swatch markup
- 증권·퇴직연금 공통 Asset Detail renderer
  - 현황 table/card shell
  - 비중 bar
  - 전일 대비 변동 KPI + table/card shell
  - 오늘 상승분 기여도
  - Asset tooltip interaction

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
- 현황/변동 표는 공통 auto layout을 사용하며 컬럼별 고정 px/% 폭이나 `table-layout:fixed`를 새로 강제하지 않는다. 자산명 길이에 따른 실제 컬럼 폭 차이는 허용한다.
- 상품 행은 증권/연금 모두 **선택일 평가금액 내림차순**으로 정렬하고, 현금·현금성자산·합계 같은 비상품 행은 고정 위치를 유지한다.
- **세로 Mobile(`≤760px`)에서만** 상품명 브랜드 축약 공통 helper/class를 사용한다. 현황표에 한해 퇴직연금 `KODEX`, 증권 `KODEX`·`KOACT/KoAct` 선두 prefix를 숨기고, 증권/퇴직연금 **전일 대비 변동표는 세로 Mobile에서도 전체 상품명을 유지**한다. 실제 가로폰·Tablet·Desktop은 모두 원문을 유지한다.
- 증권 `보유종목 현황` summary는 `보유종목 합계 → 증권계좌 현금 → 총합계` 3단 구조를 유지한다.
- 증권계좌 현금은 장부 보정값이므로 증권 `전일 대비 변동`과 `오늘 상승분 기여도`에서는 제외한다. 퇴직연금 현금성자산은 운용자산이므로 기존처럼 포함한다.
- 누적/운용 수익률 카드의 `전일 대비` 보조 비율은 각 자산의 `하루 변동률`을 `%`로 표시하고, 본 누적/운용 수익률 계산은 변경하지 않는다.
- `400px 이하` 변동 table의 3열 축약 등 실제 좁은 폭 기능 예외는 현재 구현을 유지하며 다른 화면에 확대 적용하지 않는다.

### Table 공통 contract

- 메인 표의 기본 geometry/typography는 `.dashboard-data-table`의 `--data-table-*` semantic token이 소유한다. viewport별 실제 font-size/padding/line-height 값은 CSS를 Source of Truth로 보고 이 문서에 중복 기록하지 않는다.
- `table / tr / th / td` 높이를 직접 고정하지 않는다. 셀 높이는 font-size, line-height, padding으로 결정한다.
- 숫자는 `.num`이 기본 우측 정렬을 담당하고, 문자형 열은 `.table-cell-text`, 수량/%처럼 의미상 가운데가 필요한 값은 `.table-cell-center`를 사용한다. 위치 기반 `nth-child`나 `table-cell-right` 같은 중복 utility를 다시 도입하지 않는다.
- 일반 row label은 bold가 기본이고, 증권 `현금`, 퇴직연금 `현금성자산`, 투자원금 원천 source table의 일반 첫 열은 regular 예외다. summary/합계/합산 행은 전체 bold를 유지하되 계좌별 성과표의 summary 메모만 regular다.
- 비중, 계좌 메모, 장부 조정 하단값, 변동표 평가금액 하단값은 `.data-table-sub` secondary typography contract를 공유한다. 일반 secondary는 regular, summary 내부 secondary는 summary weight를 따르며 계좌 summary memo만 regular 예외다.
- 손익/수익률/일변동의 양수·음수 색상은 기존 positive/negative semantic color를 재사용하고 table 전용 색상 token을 새로 만들지 않는다.
- `투자원금 원천 및 검산` 3개 표는 `renderSourceDataTable({ caption, rows })`가 공통 table shell을 담당한다. 계산식, row 구성, summary 데이터는 각 기능이 소유하며 renderer 하나로 억지 통합하지 않는다.
- 현황표의 종목/상품 색상 swatch는 `assetColorSwatch()` 계열 helper를 통해 기존 chart series color source를 재사용한다. table 전용 색상 mapping을 별도로 만들지 않는다.

### 성과 요약 · 계좌별 불변조건

- 증권과 퇴직연금 상단 KPI는 공통 **`성과 요약` shell**을 사용하며 기본 vertical rhythm과 title/action 구조를 공유한다.
- 증권만 `전체 / 계좌별` 전환을 제공한다. 계좌별은 별도 섹션을 만들지 않고 같은 overview 안에서 table/card view로 전환한다.
- 계좌별 table의 기본 열 순서는 `구분 → 투자 결과물 → 투입원금 → 누적손익 → 누적수익률 → 메모`다. 모바일 카드도 `투자 결과물 → 투입원금` 순서와 용어를 맞춘다.
- 각 계좌의 `투입원금`·`투자 결과물`은 성과 기준값(A)과 장부 조정값(B)을 2단으로 표시한다. 합계 행은 각 계좌의 `A + B`를 합산한 최종 장부값을 직접 표시하고, `전체` 카드의 투자 결과물·투입원금·누적수익률과 일치해야 한다.
- 별도수익 상태는 기존 `separateProfitView()`의 재분류 기준을 따른다. 개인 기능 비활성 상태에서는 개인 기능의 존재를 직접 드러내는 표현을 쓰지 않는다.
- 계좌1 투입원금 조정 B의 중복 제거 근거는 `레버수익 재투입 + VIP 수익 재투입 + 실현수익 투입`이다. `원천·보유 차액`은 성과기준 투입원금에는 남기되 조정 B 근거에서는 제외한다.
- 삼성증권2 투자 결과물 조정은 VIP 재투입액 중복 제거이며, 원천 추적의 `VIP 금 투입분 + VIP 재투입-금` 관계와 연결된다.
- `투자원금 원천 및 검산`은 3개 source card 구조를 유지하되 카드 상단의 중복 대형 value는 두지 않고 각 표의 `합계` 행을 최종값으로 사용한다. base 원천과 재투입 원천을 구분하며 `원천·보유 차액`은 양쪽 표에서 중립 검산값으로 표시한다.
- `2026-06-18` 이후 전체 성과 카드의 누적손익 설명은 `투자 결과물 - 투입원금`, 이전 복원 구간은 `전체 누적 성과 기준`처럼 중립적으로 표시한다. 과거 수치를 설명에 맞추기 위해 재계산하지 않는다.
- 계좌별 table은 **세로 Mobile과 실제 가로폰**에서 누적수익률을 누적손익 셀의 보조값으로 합쳐 5열로 축약한다. `400px 이하`에서는 메모 내용을 정보 버튼으로 전환하고, **세로 Mobile card view**의 메모는 카드 폭에 맞춰 자연스럽게 줄바꿈한다.
- 성과 요약 title/action은 기존 `.section-title`, `.section-title-icon`, `.chart-head-actions`, segmented/button, mobile table/card control을 재사용한다. 증권 성과 요약에서 별도수익 control은 `전체 / 계좌별` 왼쪽에 둔다. **세로 Mobile에서만** `표 보기 / 카드 보기` control을 표시해 가장 왼쪽에 두고, 실제 가로폰에서는 해당 control을 숨긴 채 table view를 유지한다.

### Modal / Action Form 공통 contract

- KRX 현재가 반영과 퇴직연금 금액조정처럼 업무 목적이 다른 modal도 surface, header/action, input/select/date, focus, border/radius, 상태 표시 등 공통 form/control 표현은 기존 modal/control token과 `dashboard-modal.js`의 공통 dialog lifecycle을 재사용한다.
- 기능별 modal은 자기 업무 구조와 state/persistence만 소유한다. KRX 반영 로직이나 퇴직연금의 PIN·기업적립금·현금성자산·ETF 추가매수·batch/delete 흐름을 generic modal layer로 끌어올리지 않는다.
- 세로 Mobile bottom-sheet, Desktop/Tablet/Phone Landscape 중앙 modal, iOS 입력 확대 방지 같은 실제 viewport/browser 예외는 현재 검증된 범위에서 유지한다. 공통화를 이유로 기능 예외를 제거하지 않는다.

화면별 계산이나 특정 기능 전용 modal/action을 `dashboard-ui-common.js` 또는 `dashboard-modal.js`로 끌어올리지 않는다.

## 4.6 `dashboard-charts.js` 책임

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
- 확대 차트는 별도의 독립 chart/control state를 복제하지 않는다. 기존 SVG와 controls/options/legend를 expanded overlay로 이동해 사용하고 닫을 때 placeholder 위치로 복원하며, chart state와 공개 action 흐름을 그대로 공유한다. 확대에서만 필요한 닫기/viewport 처리와 별도수익 control 보조는 expanded layer가 소유한다.
- SVG 내부는 frame/scale/좌표 helper처럼 의미가 동일한 계산만 공통화한다. dual axis, KOSPI 비교, line/bar/stack처럼 데이터 의미가 다른 renderer를 범용 renderer 하나로 억지 통합하지 않는다.
- 일반 차트와 확대 차트의 tooltip/resize/keyboard/legend 최소 1개 선택/Y축 자동 등 기존 불변조건은 같은 chart state에서 함께 검증한다.

## 4.7 퇴직연금 View / Editor 책임

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

## 4.8 `dashboard-app.js` 책임

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

## 4.9 `dashboard-market-ai.js` standalone 책임

`dashboard-market-ai.js`는 main feature state와 분리된 **로컬 조회 + 명시적 preview 전용 standalone entry**다. `dashboard-modal.js`의 저수준 dialog lifecycle만 공유하며 polling/state/mount/render는 자체 소유한다.

preview viewport ownership은 `index.html` head inline script가 가진다.

```text
?market-ai-preview=1 → phone 초기 viewport를 Desktop 1280 preview로 전환
?market-ai-preview=2 → phone 초기 viewport를 Tablet 961 preview로 전환
?market-ai-preview=3 → viewport를 바꾸지 않고 현재 Mobile viewport에서 예시 UI 표시
```

현재 책임과 불변조건:

- 로컬(`localhost`, `127.0.0.1`)에서만 실제 Market AI API를 조회하고, 비로컬 기본 모드는 UI를 숨긴다. preview mode는 API polling 없이 내장 예시 데이터만 사용한다.
- `/api/market-data/snapshot`, `/api/signal/latest?include_details=true`, KIS Bridge 상태를 사용하며 unavailable/stale/error를 메인 대시보드와 실패 격리한다.
- 시장 4개 metric과 AI 신호 4개 metric은 공통 `data-list-card` surface를 사용하고 **시장 60% / AI 신호 40%** 비율을 Desktop/Tablet/Mobile에서 유지한다.
- Desktop/Tablet은 Hero 우측 panel, Mobile/실제 터치폰 가로는 Hero의 `AI Signal` 버튼에서 같은 `#market-ai-section` DOM을 native dialog로 이동·재사용한다. 별도 Mobile render tree를 만들지 않는다.
- Mobile에서는 metric tooltip/focusability를 제거하고, Desktop/Tablet에서만 keyboard/pointer tooltip을 제공한다.
- 선택된 과거 `activeDate`와 무관한 현재 시점 신호를 표시한다.
- `window/globalThis` bridge, main `dataState/uiState` 직접 접근, feature module import를 추가하지 않는다.

CSS는 기존 6파일 역할을 따른다. `common.css`가 Desktop baseline과 공통 Data List/Market AI component를, `tablet.css`가 Tablet density를, `special.css` Phone UI Shared가 Mobile trigger/dialog/panel 이동을 소유한다. Hero 우측 여백은 Market AI 전용 edge token으로 덮지 않고 Hero의 기존 responsive padding을 그대로 따른다. JS에서 구조용 inline style을 누적하거나 별도 Market AI CSS 파일을 만들지 않고, tooltip 좌표처럼 런타임 계산이 필요한 값만 직접 처리한다.

로컬 통합 실행의 canonical entry는 `start-local-server.pyw`다. 런처는 single-UAC·단일 인스턴스를 유지하고 **eFriend Ready → KIS Bridge → Market AI API → Dashboard** 순서를 보존한다. eFriend Ready는 로그인·공인인증 완료 상태인 `efexpertmain.exe`를 기준으로 하며, 자동 로그인 자격 증명은 Windows Credential Manager만 사용하고 실패 시 수동 로그인으로 fallback한다.

KIS Bridge는 사전 빌드된 Release/x86 실행 파일을 사용하고 런처 기동 시 자동 재빌드하지 않는다. eFriend Ready 또는 Bridge 시작 실패 시 뒤 단계를 실행하지 않으며, Local Suite 전체 종료는 Dashboard / Market AI API / KIS Bridge / eFriend Expert를 함께 정리한다.

## 4.10 JS state · initialization ownership

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
dashboard-modal.js
→ focus stack / body lock count / native dialog lifecycle state

dashboard-charts.js
→ chartState
→ chartRuntimeState

dashboard-pension-editor.js
→ pensionEditorState

dashboard-pension.js
→ View 전용 tooltip binding state

dashboard-market-ai.js
→ marketAiState
→ polling / mount / tooltip binding runtime state
```

유지 원칙:

- `chartState`나 editor batch state를 core/global로 올리지 않는다.
- Market AI state를 메인 `dataState` / `uiState`에 합치지 않는다.
- 새 global store / event bus / framework state manager / 거대한 단일 state 객체를 만들지 않는다.
- `window` / `globalThis` state bridge로 module ownership을 우회하지 않는다.
- 반복 render에 필요한 listener/tooltip/chart guard는 각 owner module 안에서 관리한다.
- 퇴직연금 dashboard 재렌더 연결은 editor setup 단계의 명시적 `renderDashboard` callback dependency를 유지한다.
- main app boot는 `dashboard-app.js` 단일 entry가 담당하며 Market AI는 별도 standalone entry에서 자기 initialization만 담당한다.

## 4.11 메인 JS의 파일 간 책임을 함부로 섞지 않는다

예를 들어:

```text
차트 계산/DOM/action → charts
Topbar/Navigation/UI action → ui
공통 저수준 UI helper → ui-common
Modal/Dialog lifecycle → modal
퇴직연금 조회 View → pension
퇴직연금 변경/저장 → pension-editor
앱 boot/cross-module orchestration → app
Market AI 로컬 조회/preview/mount/fail isolation → market-ai standalone
```

처럼 책임을 유지한다.

한 기능을 수정하기 위해 4~5개의 JS 파일을 동시에 건드려야 하는 구조를 새로 만들지 않는다.

그렇게 해야만 구현되는 요청이라면 구조가 잘못된 방향인지 먼저 검토한다.

## 4.12 현재 구조별 수정 위치 기준

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

공통 저수준 DOM / 마크업 helper
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

Market AI 로컬 현재 신호 조회 + 비로컬 명시적 preview / Hero 보조 UI standalone adapter
→ js/dashboard-market-ai.js

Market AI Desktop baseline / 공통 component
→ css/common.css의 Hero 확장 영역

Market AI Tablet 배치
→ css/tablet.css의 Hero 인접 영역

Market AI Phone 진입 버튼 / native dialog / mounted panel 이동
→ css/special.css의 Phone UI Shared 기능 viewport

투자 계산기 HTML
→ add/calc.html

투자 계산기 CSS
→ add/css/calc.css

투자 계산기 JS
→ add/js/calc.js

calc/report 공통 CSS
→ add/css/common.css

거래 리포트
→ add/report/
```

단, 기능의 실제 책임을 확인한 뒤 판단하며 파일명만 보고 무조건 수정하지 않는다.

## 4.13 현재 ES Module dependency graph

현재 dependency 방향은 다음과 같다.

```text
ui-common       → core
modal           → 다른 dashboard module import 없음
charts          → core + ui-common + modal
ui              → core + ui-common + modal + charts
pension         → core + ui-common + charts + ui
pension-editor  → core + ui-common + modal + ui
app             → core + ui-common + modal + charts + ui + pension + pension-editor

standalone entry
market-ai       → modal만 공유
```

`core`와 `modal`은 서로 독립된 저수준 foundation으로 유지하고 feature module을 역으로 import하지 않는다. `market-ai`도 modal lifecycle 외의 main feature module과 결합하지 않는다.

불변조건:

```text
core → DOM/UI module import 금지
ui-common / modal → 화면별 feature module import 금지
charts → ui 역참조 금지
하위 module → app import 금지
pension View ↔ pension-editor 상호 import 금지
market-ai → modal 외 main feature import 금지
circular import = 0
```

## 4.14 ES Module import / export 운영 규칙

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

## 4.15 `index.html` module entry와 cache bust 정책

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

## 4.16 main graph 단일 entry와 Market AI standalone 분리를 유지한다

현재 main dependency graph는 **8개 ES Module**이며 `dashboard-app.js`가 main graph의 단일 entry다. `dashboard-market-ai.js`는 두 번째 standalone entry로 main boot 책임을 공유하지 않고, 공통 저수준 `dashboard-modal.js`만 import한다.

```text
index.html
├─ dashboard-app.js      → main graph 8모듈
└─ dashboard-market-ai.js
   └─ dashboard-modal.js → dialog lifecycle만 공유
```

실제 dependency는 named `import / export`로 표현하며 circular import와 `window/globalThis` compatibility bridge를 허용하지 않는다. classic script 다중 load, framework/bundler 도입 같은 구조 개편은 사용자가 별도로 요청한 경우에만 검토한다.

# 5. UI · Responsive · 반복 회귀 불변조건


## 5.1 최신 반응형 기준과 iPhone 데스크탑 웹사이트 요청

기본 breakpoint:

```text
Desktop ≥ 1101px
Tablet  761px ~ 1100px
Mobile  ≤ 760px
```

기능상 필요한 스마트폰 가로 media는 유지한다.

대표:

```css
@media
  (orientation:landscape)
  and (max-width:960px)
  and (max-height:500px)
  and (hover:none)
  and (pointer:coarse)
```

이 media는 특정 844px 기기 맞춤식 patch가 아니라 실제 coarse-pointer 스마트폰 가로를 식별하기 위한 기능 media다. `960px` 상한은 iPhone 13의 844×390뿐 아니라 956×440급 대형 iPhone / 일반 대형 Android / Z Flip 가로까지 같은 Phone UI를 적용하기 위한 범용 상한이며, 펼친 Z Fold처럼 높이가 500px를 넘는 화면은 Phone Landscape에서 제외하여 Tablet 계열로 둔다.

### Phone UI Shared / Phone Landscape 최신 역할

`Phone UI Shared`는 **세로 Mobile과 실제 가로폰이 공통으로 가져야 하는 compact 디자인 밀도**만 소유한다.

- Hero / KPI / mini-card / 섹션 제목 / 자산 탭 / 자산 인사이트 / tooltip의 폰트·여백은 세로폰과 가로폰 동일
- `투자원금 원천 및 검산`의 3개 `.source-card`도 세로폰·가로폰 모두 같은 compact 내부 padding을 사용한다.
- 증권·퇴직연금 KPI는 가로폰에서도 2×2 compact 유지
- 성과/현황/변동 표는 가로폰에서도 세로폰과 동일한 font / cell padding을 사용하고 첫 열 sticky 유지
- 계좌별 성과의 수익률은 가로폰에서도 손익 아래 `(~%)`로 결합하여 긴 메모 열 폭을 확보
- `KODEX` / `KOACT` 접두어 숨김과 `표 보기 / 카드 보기` UI는 **세로폰 전용**이며 가로폰에서는 전체 종목명 + 표만 표시
- Navigation은 **Phone 세로/가로 = Mobile hamburger 전체 메뉴**, **Tablet = 기존 action + hamburger 목차 전용**, **Desktop = 기존 action + 우측 edge TOC**로 역할을 분리한다.

`Phone Landscape`는 **가로폰에서 세로폰과 배치가 달라지는 최소 규칙만** 소유한다.

- Hero pill 2열 / 연금 포함 4열
- 누적차트 아래 6개 요약카드 3열, 종목·연금상품 손익카드 4열, 전일대비 4 KPI 한 줄
- 비중카드는 Tablet 수준의 열 수를 사용하되 카드 내부 밀도는 Phone Shared 기준
- 투자원금 원천 3카드 한 줄
- 장부검산은 결론 full-width + A/B 2열, 내부 밀도는 세로폰 기준
- Topbar는 **폰 세로/가로 모두 동일한 Mobile Topbar**를 사용한다. 가로폰에서도 `[년월][일][테마][모서리][햄버거]` 구조와 날짜 고정/모바일 메뉴 flow를 그대로 사용한다. Tablet은 기존 축약 action 버튼을 유지하되 우측 edge TOC를 사용하지 않고 Topbar hamburger에 **목차만** 넣는다. 웹(`≥1101px`)만 우측 edge TOC를 사용한다.
- `평가금액 비중`의 종목별 모드에서는 4열 grid 안에서 `평가금액 합계` 카드가 2칸을 차지하고, 유형별 모드의 합계 카드는 기존처럼 전체폭을 사용한다.
- 차트 control은 제목 오른쪽 한 줄을 유지하고 가로폰에서는 차트를 컨테이너 폭에 맞춰 no-scroll로 표시하며 `← / →` 버튼을 숨김
- 차트 높이는 낮은 가로 viewport에 맞게 축소하고 Tablet / 가로폰 모두 범례를 차트 쪽으로 당김
- 별도수익은 compact control 크기는 유지하되 가로폰에서는 `별도수익` 라벨과 활성 시 선택일 설명을 표시
- 퇴직연금 / PIN / KRX 모달은 가로폰에서 중앙 modal 레이아웃을 유지한다. Mobile bottom-sheet 규칙이 실기기에서 함께 매치되어도 Phone Landscape가 중앙형 구조를 복원하고, iPhone Safari 확대 방지가 필요한 input font만 16px 계열을 사용한다.

JavaScript 반응형 판정은 `compactPhoneChartUi()`(세로폰+가로폰 compact), `portraitPhoneChartFlow()`(세로폰 전용 flow), `phoneLandscapeUi()`(가로폰 판정)로 역할을 나눈다. `phoneLandscapeUi()`는 `dashboard-ui-common.js`의 canonical helper를 재사용하고 같은 `matchMedia` 조건을 다른 모듈에 복제하지 않는다.

Navigation은 Tablet/Mobile ↔ Desktop 전환 시 Edge TOC의 생성·제거를 동기화하되, Desktop 구간 내부 resize에서는 기존 TOC DOM을 재생성하지 않아 상태를 보존한다.

### iPhone Safari 데스크탑 웹사이트 요청

**현재 최신 ZIP의 실제 기준은 `width=1280`이다.**

```text
일반 mobile → width=device-width
iPhone "데스크탑 웹사이트 요청" 감지 → width=1280
```

그리고:

```text
html.iphone-request-desktop
```

상태 class를 이용해 필요한 Desktop 레이아웃을 보장한다.

과거 문서에 기록됐던:

```text
width=1980
```

은 **폐기된 이전 기준**이다.

새 작업에서 1980으로 되돌리지 않는다.


## 5.2 Section Title / Control 공통 불변조건

메인 `h2`, 하위 `h3`, 차트 `h3`의 제목 typography와 SVG 아이콘 크기·간격·정렬은 공통 title rule을 사용하고, `.section-title` / `.chart-head` 같은 부모는 배치 책임만 가진다.

같은 모양·상호작용의 control은 기능별 CSS를 복제하지 않고 공통 primitive를 우선 사용한다. 현재 canonical primitive는 `control-action-button`, `control-icon-button`, `control-icon-button-compact`, `control-info-button`, `control-square-button`, `control-switch-*`, `control-tab-group` / `control-tab`, `control-text-toggle`이며, 2분할 선택은 `.chart-compare-toggle`, 라벨+ON/OFF는 `.chart-y-auto-toggle` / `.separate-profit-toggle`의 공통 골격을 사용한다. 기능별 class는 의미·위치·표시조건·semantic color처럼 필요한 차이만 담당한다.

현재 section title은 ON/OFF 버튼이 있는 제목행의 현재 레이아웃을 기준으로 맞춘다.

현재 공통 selector에는 다음이 포함된다.

```text
#summary-section
#securities-section
#pension-section
#accounts-summary
#ledger-check
#capital-source-check
```

그리고:

```css
min-height:var(--section-chip-height);
```

를 사용한다.

현재 token:

```text
Desktop / Tablet 계열: 28px
Mobile / Smartphone landscape 계열: 25px
```

핵심 불변조건:

```text
ON/OFF 있음  → 현재 제목행 높이
ON/OFF 없음  → 같은 제목행 높이
```

즉 ON/OFF 표시 여부가:

- section-title 전체 높이
- 제목 top
- toggle top
- line-height

를 움직이면 안 된다.

별도수익 또는 개인보기 상태 변경 QA에서는:

```text
OFF → ON → OFF
```

등 실제 state transition 후 title row 내부 위치 변화 **0px**를 기준으로 본다.

이 문제를 해결한다는 이유로 다음을 새로 만들지 않는다.

```text
hidden DOM 공간 예약
visibility:hidden note
불필요한 빈 placeholder
별도수익 DOM 구조 변경
임시 section-title margin 보정
```


## 5.3 반복 회귀 이력이 있는 UI/기능 상시 불변조건

다음은 과거 실제 회귀가 있었거나 자주 의심된 영역이므로 관련 수정 시 우선 확인한다.

### Theme / Corner

테마 버튼과 모서리 버튼은 현재 상태를 나타내는 permanent active toggle처럼 보이면 안 된다.

금지:

```text
permanent blue active border
상시 aria-pressed active UI
아이콘 암전
```

Light / Dark 모두 icon contrast가 유지돼야 한다.

### Table summary / 합산 / 합계 / 총계

확인:

- 첫 번째 `th`
- 이후 `td`
- background
- border
- 마지막 행 border
- sticky first column
- mobile horizontal scroll
- 401px 이상 account memo 텍스트 레이아웃 유지
- 400px 이하 account memo 전용 floating tooltip 정상 동작

특히 summary 행:

> **첫 `th`와 이후 `td`의 배경·border가 달라지면 FAIL**

### Table alignment

메인 `dashboard-data-table` 정렬은 개별 표 override보다 공통 semantic contract를 우선한다. 숫자 셀은 `.num` 자체가 기본 우측 정렬을 담당하고, 문자형 열과 가운데 정렬 예외만 semantic class로 명시한다.

```text
.num               → 숫자 표현 품질(tabular-nums / nowrap) + 기본 우측 정렬
.table-cell-text   → 문자형 열 좌측 정렬
.table-cell-center → 수량 / % 등 가운데 정렬 예외
```

- 일반 숫자 셀에 우측 정렬 class를 반복해서 붙이지 않는다. `.num`의 기본 contract를 사용한다.
- 수량 / %처럼 UI상 가운데 정렬이 필요한 값은 `table-cell-center`를 명시한다.
- 문자형 셀과 정렬 예외는 semantic class로 제어하고, 컬럼 위치 기반 `nth-child`에 의존하지 않는다.
- `table-cell-right` 같은 `.num`과 역할이 중복되는 utility를 다시 도입하지 않는다.
- 특정 표·컬럼의 현재 정렬 상태나 문구 변경 이력은 이 문서에 누적하지 않고 최신 실제 소스를 기준으로 확인한다.

### 성과 용어

성과 UI의 공통 용어는 **금액 성과 = 손익, 비율 성과 = 수익률**로 통일한다. 다만 `실현수익`, `별도 수익 재투입`처럼 실제 확정된 양수 재원·출처를 뜻하는 경우에는 `수익` 표현을 유지한다.

### 장부결과 VS 실제보유

현재 정보 우선순위:

```text
차액(A-B) = 결론
A = 장부상 증권계좌 투자 결과물
B = 실제 증권계좌 + 현금 보유액
```

`.ledger-gap-value`는 Light / Dark 모두 밝은 노란색 계열을 유지한다.

최근 검증 기준 computed color:

```text
rgb(251, 191, 36)
```

### KRX 현재가 반영

현재 버튼:

```text
취소
최신/누락 반영
재갱신
```

현재 설명:

```text
최신/누락 반영은 오늘 데이터와 누락 거래일을 생성·보완하고,
재갱신은 선택된 날짜를 확인해 종가 기준이 아니면 다시 반영합니다.
```

기능 의미:

- 최신/누락: 오늘 생성/갱신 + 누락 거래일 보완 + 과거 장중 데이터 종가 확정
- 재갱신: `activeDate`를 `body.date`로 전달 → 해당 날짜가 이미 `marketStatus: "close"`이면 `이미 종가 기준 데이터가 반영되어 있습니다.` 안내 후 workflow 생략 → `intraday` 또는 미존재 데이터일 때만 해당 날짜 재반영

관련 수정 시:

- focus
- focus trap
- ESC
- 버튼 한 줄
- request timeout
- 외부 write 0

을 확인한다.

### 퇴직연금

관련 수정 시:

- 금액 조정 modal
- PIN flow
- 저장 UI
- 삭제 UI
- 일괄 적용
- tooltip
- chart
- 상품별 현황
- ESC
- focus
- request timeout

을 확인한다.

QA에서 실제 GAS write는 하지 않는다.

증권계좌와 퇴직연금의 **현황 / 전일 대비 변동 바깥 `.note` surface는 hover lift/transition을 적용하지 않는다.** 단, 그 안의 table row hover, `mini-card`, 모바일 내부 카드 등 개별 content interaction은 유지한다. 바깥 surface의 모션을 없애기 위해 내부 component animation까지 함께 제거하지 않는다.

퇴직연금 `추가 매수`의 체결수량·체결금액 입력칸은 예시 숫자를 placeholder로 미리 표시하지 않는다. 빈 입력칸에서 사용자가 직접 입력을 시작하는 현재 UX를 유지한다.

### Chart

관련 수정 시:

- 증권/퇴직연금 tab
- lazy draw
- 범례
- 다중선택
- 최소 1개 유지
- 전체
- Y축 자동
- 확대
- tooltip
- keyboard
- resize
- smartphone landscape

를 확인한다.

일반 차트 tooltip은 owner SVG가 viewport 밖으로 완전히 벗어나면 tooltip과 hover guide를 정리한다. 확대 차트 overlay 내부 tooltip은 이 page-scroll 정리 대상에서 제외한다.

차트의 **표시 기준 스위치와 tooltip 정보량은 분리**한다. 현재 불변조건:

- 증권/퇴직연금 누적차트의 `수익률 ↔ 코스피` 스위치는 선 그래프 표시 기준만 바꾸며, tooltip에는 수익률과 코스피 지수를 함께 표시한다.
- 증권 종목별 / 퇴직연금 상품별 `손익 ↔ 수익률` 스위치는 Y축·선 표시 기준만 바꾸며, tooltip은 두 모드 모두 `손익 원화 (수익률 %)` 형식으로 표시한다.
- 범례에서 사용자가 숨긴 series는 기존처럼 tooltip 대상에서도 제외한다.

누적차트 하단 날짜 이동 카드는 즉시 날짜를 바꾸지 않고 확인 modal을 거친 뒤 이동하며, mouse / keyboard 모두 같은 flow를 사용한다.

listener 중복 또는 chart 이중 생성은 FAIL이다.


## 5.4 계좌별 성과 메모 툴팁 현재 불변조건

계좌별 성과 메모 동작은 `js/dashboard-ui.js`가 소유하며 차트 tooltip 구현과 섞지 않는다.

현재 불변조건:

- `400px 이하`에서는 메모 헤더 `메모`를 유지하고 각 행의 메모 내용만 정보 버튼으로 전환한다.
- 정보 버튼의 floating tooltip은 table stacking context에 가려지지 않도록 body 레벨에서 표시하고, viewport를 벗어나지 않게 위치를 보정한다.
- Tooltip은 일반 메모와 같은 문장 분리 및 `memoJoinFirstTwo` 흐름을 사용하되 **표 전용 source-link 강조 markup은 생성하지 않고 regular 텍스트로 표시**한다.
- outside click / ESC / scroll / resize 등에서 열린 tooltip 상태를 정리한다.
- `401px 이상`에서는 메모 텍스트를 직접 표시한다. **세로 Mobile / 실제 가로폰의 table view**에서는 문장 단위 흐름을 유지하고, **세로 Mobile card view**에서는 카드 폭에 맞춰 자연스럽게 줄바꿈한다.
- 계좌 메모 전용 class/action은 `accounts-memo-*` 계열을 사용하며 chart 전용 tooltip class를 재사용하지 않는다.

이 기능을 수정할 때 계좌 메모 전용 동작을 `dashboard-charts.js`로 옮기지 않는다.

## 5.5 개인보기 3회 클릭 제스처 평가·유지 원칙

Hero 기준일 영역을 **연속 3회 클릭하여 개인보기를 ON/OFF하는 방식은 사용자가 개인보기 진입 경로를 일반 화면에서 의도적으로 숨기기 위해 선택한 비공개 제스처**다.

따라서 향후 CSS·JS·UI/UX 평가에서 다음 이유만으로 감점하거나 개선사항으로 제시하지 않는다.

- 일반 사용자가 기능을 발견하기 어렵다는 `discoverability` 지적
- 별도의 버튼·메뉴·아이콘이 노출되어 있지 않다는 지적
- `<time>` 요소의 3회 클릭이라는 비표준 진입 방식 자체
- 해당 숨김 제스처가 일반적인 키보드 탐색으로 노출되지 않는다는 이유만의 접근성 감점
- 일반 UI로 노출하거나 별도 진입 버튼을 추가하자는 제안

이는 **의도된 비공개 UX**이며 일반 사용자를 위한 공개 기능과 같은 discoverability 기준으로 평가하지 않는다.

단, 다음은 실제 회귀 또는 버그이므로 별도로 검증한다.

- 3회 클릭이 정상적으로 인식되지 않음
- `OFF → ON → OFF → ON` 토글이 깨짐
- 개인보기 OFF 시 `includeSeparateProfit` 등 숨겨진 상태가 잘못 남음
- 3회 클릭 처리 때문에 일반 날짜 표시·선택·Topbar·레이아웃·라벨 간격에 회귀가 생김
- 제스처가 다른 일반 클릭이나 입력 동작을 방해함

이 제스처는 **보안 인증 수단이 아니라 화면상 진입 경로를 숨기기 위한 UX**로 취급한다.

# 6. CSS · Responsive 유지보수 규칙


## 6.1 메인 CSS 6파일 구조 원칙

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

상세 리팩토링 이력은 **10.2 통합 연혁**을 참고한다. 현재 장에서는 최종 구조와 유지보수 규칙만 관리한다.

핵심 유지보수 원칙:

- 기능 수정은 먼저 **어느 역할 파일이 canonical인지** 판단하고 그 파일의 기존 rule을 직접 수정한다.
- 같은 기능을 해결하기 위해 다른 CSS 파일 하단에 임시 override를 누적하지 않는다.
- CSS 구조 변경과 디자인 변경을 같은 차수에 섞지 않는다.
- 새 breakpoint는 실제 레이아웃/정보구조 문제가 있을 때만 추가하고 `special.css`에 기능명 + 존재 이유를 남긴다.
- 파일 분리 자체를 이유로 같은 selector를 여러 파일에 중복 생성하지 않는다.
- `common → 일반 viewport → special → interaction → print`의 우선순위를 보존한다.


## 6.2 반응형 CSS는 뷰포트/역할별 섹션으로 모아 관리

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
→ Compact Desktop 예외: Asset Detail 2-column 가용폭 보정. 1280px은 일반 Desktop 2-column을 유지하며 모바일 preview의 1280 viewport도 이 기준을 따른다.

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

17차 구조 정리 이후 각 CSS 파일 상단의 Scope/Structure map과 본문의 번호 섹션은 **1:1로 대응**해야 한다. 섹션 순서는 해당 파일의 실제 source order를 Source of Truth로 보고, 문서에 별도의 고정 번호표를 중복 저장하지 않는다.

새 특수 breakpoint를 단순 미관 보정용으로 추가하지 않는다. 실제 레이아웃/정보구조 문제를 해결해야 할 때만 추가하고, `special.css`에 **기능명 + 존재 이유**를 주석으로 남긴다.


## 6.3 CSS 섹션과 주요 주석은 영어 + 한글 병기

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


## 6.4 반응형 기본 viewport는 3구간 고정

메인 대시보드 기본 viewport는 다음과 같다.

- **Desktop · 웹:** `1101px 이상`
- **Tablet · 태블릿:** `761px ~ 1100px`
- **Mobile · 모바일:** `760px 이하`

새로운 UI를 추가하거나 수정할 때 기본적으로 이 세 구간 안에서 해결한다. **Phone Landscape는 이 기본 3구간을 다시 정의하는 네 번째 breakpoint가 아니라, 실제 터치 스마트폰 가로를 식별하는 기능 media 예외**로만 취급한다.


## 6.5 불필요한 추가 breakpoint 금지

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

- `1101~1279px`: Compact Desktop 기능 예외다. `.asset-detail-grid`만 1열로 전환한다. `1280px`은 의도적으로 제외해 일반 Desktop 2-column을 유지하고, 모바일 Market AI preview가 강제하는 1280 viewport에서도 변동 카드가 내려가지 않게 한다. `1100px 이하`는 기존 Tablet/Mobile/Phone 규칙이 담당하며 이 조건을 다른 영역의 일반 breakpoint로 확대하지 않는다.
- `landscape + width≤960 + height≤500 + hover:none + pointer:coarse`: 실제 스마트폰 가로 판정에만 사용한다. `960px`을 일반 breakpoint로 재사용하지 않는다.

공통 Asset Detail CSS는 기존 generic class/token을 우선 재사용하고, 실제로 양쪽 자산이 공유하는 의미에만 최소 `.asset-*` semantic class를 사용한다. 현황/전일변동/상승분기여도에서 공통화된 selector는 neutral `.asset-*`가 canonical이며, 같은 역할의 `.pension-*` legacy alias를 병렬로 유지하지 않는다. 위험자산 70% 룰·퇴직연금 조정/PIN/납입 등 연금 전용 UI는 계속 `.pension-*`를 사용한다.



## 6.6 특정 viewport 스크린샷 맞춤식 수정 금지

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


## 6.7 미관 문제와 실제 문제를 구분

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


## 6.8 CSS 추가보다 기존 규칙 수정·통합 우선

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


## 6.9 동일 selector override 누적 금지

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


## 6.10 `!important` 사용 정책

현재 메인 CSS의 실제 `!important` 선언은 **0개**이며, 이 상태는 정상 cascade/source order/token 구조로 동작하도록 검증된 현재 기준선이다. 과거 제거 차수와 개수는 Git 이력으로 관리하고 이 문서에는 누적하지 않는다.

현재 운영 원칙:

- 새로운 `!important`는 원칙적으로 추가하지 않는다.
- 단순 specificity 충돌은 canonical selector, source order, 구조 정리로 해결한다.
- `[hidden]`, semantic color, 모바일 view state, print override처럼 정상 cascade로 해결되는 상태를 유지한다.
- Windows/macOS 등의 OS 모션 감소 설정은 차트·카드·버튼 animation/transition을 비활성화하는 조건으로 사용하지 않는다.
- 향후 Safari/WebKit 등 실제 브라우저 고유 문제로 강제 우선순위가 다시 필요해 보이더라도 먼저 실기기 재현과 정상 cascade 해결 가능성을 확인한다.

새 `!important`가 불가피하다고 판단되면 반드시:

1. 실제 재현되는 브라우저/상태 문제인지
2. 기존 canonical rule 수정으로 해결 가능한지
3. specificity/source-order 정리로 가능한지
4. 해당 선언만 강제해야 하는 이유가 명확한지

를 확인하고, 추가 이유와 영향 범위를 별도 보고한다.

**현재 0개는 유지보수 결과이지 점수용 숫자 목표가 아니다.** 정상 동작을 깨면서 0개를 고집하지 않지만, 현재 검증된 0개 기준선에 불필요한 `!important`를 다시 추가하지 않는다.


## 6.11 디자인 토큰과 CSS variable 우선 재사용

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



## 6.12 증권·퇴직연금 KPI 모바일 2열 규칙

증권·퇴직연금의 `성과 요약` 4개 KPI 카드는 모바일(`<=760px` 및 실제 스마트폰 가로모드)에서만 `2 × 2` grid를 유지한다. 다른 `.metric-grid`에는 이 규칙을 확대 적용하지 않는다.

모바일 KPI 타이포 기준:

```text
라벨 11px
값 18px
설명 10px
```

세 요소는 한 줄 유지한다. 모바일 전용 축약 설명이 필요한 경우 `metricCard()`의 mobile sub variant를 사용하고, 데스크톱/태블릿 설명을 CSS로 억지 축소하거나 ellipsis 처리하지 않는다.

## 6.13 Topbar 날짜 셀렉트 폭 정합성

Topbar의 `년/월`과 `일` 셀렉트는 같은 UI mode에서 동일폭을 유지한다. Desktop의 실제 기본폭과 Tablet/Phone에서의 shrink 값은 CSS가 Source of Truth다. Tablet에서는 기존 구간 안에서 날짜 그룹만 가용폭에 따라 두 셀렉트가 함께 줄고, 우측 action은 `auto` 열로 유지한다. 이 정합성 문제 때문에 새 breakpoint를 추가하지 않는다. Phone 세로/가로도 두 셀렉트가 같은 반응형 폭 체계를 사용한다.

## 6.14 본문 카드 공통 시스템

본문 카드는 **같은 hierarchy + 같은 viewport = 같은 geometry/spacing**을 유지한다. 카드 외곽 padding, 카드 간 gap, 카드 내부 rhythm은 서로 다른 책임으로 관리하며 개별 selector에 임의 숫자를 추가하지 않는다.

### Surface / Radius ownership

카드 surface는 아래 semantic token을 canonical로 사용한다. viewport별 실제 px 값은 CSS token이 Source of Truth이며 이 문서에 중복 기록하지 않는다.

```text
--surface-pad-outer
--surface-pad-large
--surface-pad-medium
--surface-pad-mini
--surface-pad-metric
--surface-pad-emphasis
--surface-pad-data-list
```

- Outer: `.pension-band`, `.securities-band`
- Large: `.card`, `.note`, `.chart-card`
- Medium: `.asset-insight-card`, `.source-card`
- Mini: `.mini-card`
- Data List: `.data-list-card`를 모바일 카드보기와 Market AI compact group이 공유하며 `--surface-pad-data-list`, `--surface-radius-data-list`, `--shadow-data-list-card`, `--data-list-row-separator` contract를 함께 사용한다.
- Metric/Emphasis는 `.card` 기반 variant다.
- base selector가 semantic token을 소유하고 Tablet/Phone에서는 **token 값만 변경**한다. 같은 padding/radius를 responsive selector에 반복하지 않는다.

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

## 6.15 카드 확정 예외 / 완료 기준

카드 공통화는 현재 **완료 상태**로 간주한다. 실제 UI 문제나 신규 카드 유형이 없는 한 Surface / Radius / Grid Gap / Vertical Rhythm을 다시 세분화하거나 합치지 않는다.

확정 예외만 다음과 같이 유지한다.

- **Source**: Medium surface + Metric rhythm을 사용하고 `.source-card{min-width:0}`은 base property로 유지한다. value 아래 `source-table-scroll` 간격과 highlight는 별도 정보영역/상태이므로 공통 rhythm에 합치지 않는다.
- **Ledger**: `.value{min-height:0}`, 근거 divider/padding, Tablet·실제 Phone Landscape의 2-column 및 내부 gap은 복합 정보구조 전용 예외로 유지한다.
- **Symbol**: `symbol-metrics` divider 뒤 padding, 내부 label/value layout, allocation detail baseline 보정은 Symbol 상세영역 예외로 유지한다. Mini와 같은 관계의 간격만 공통 rhythm을 사용한다.
- **Long content**: `.chart-note.six`의 숫자 `.m-value`는 한 줄 유지, 날짜가 포함될 수 있는 `.m-label`/`.m-detail`은 자연 줄바꿈을 허용한다. Phone KPI 2×2 및 기존 `<=400px` 계좌성과 table 예외도 유지한다.

base가 이미 소유한 속성을 하위/viewport selector에서 반복하지 않는다. 반대로 실제 정보구조가 다른 scoped rule은 숫자가 다르다는 이유만으로 제거하지 않는다. 사용되지 않는 class, 완전 중복 declaration, 반복된 base property만 cleanup 대상으로 본다.

# 7. JavaScript 구현 세부 규칙


## 7.1 Inline event handler 재도입 금지

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


## 7.2 Event handler에 비즈니스 로직을 과도하게 넣지 않는다

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


## 7.3 JavaScript에서 UI 스타일 직접 지정 최소화

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


## 7.4 JS 중복 로직 추가 금지

새 함수를 만들기 전에 기존 helper가 있는지 확인한다.

특히 스마트폰 가로 판정은 `dashboard-ui-common.js`의 `phoneLandscapeUi()`가 canonical이다. `dashboard-charts.js`, `dashboard-ui.js` 또는 새 모듈에서 같은 `960×500 + hover:none + pointer:coarse` `matchMedia` 문자열이나 동등 helper를 다시 정의하지 않는다.

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

## 7.5 JS Structure Map / 책임 주석

18차 구조 정리 이후 9개 `dashboard-*.js`는 파일 상단 Structure Map과 본문의 번호 섹션을 **1:1로 대응**시킨다. 번호 자체를 changelog로 사용하지 않고, 실행 흐름과 ownership 탐색을 위한 구조 표지로만 사용한다. 기능 수정 시 코드와 주석 책임이 달라지면 같은 작업에서 Structure Map도 함께 정합화한다.

코드를 그대로 읽어주는 주석은 늘리지 않고 module ownership, 예외, lifecycle 경계처럼 코드만으로 바로 알기 어려운 이유를 설명한다.

# 8. Calc · Report 유지보수 규칙

`add/`는 메인 대시보드와 독립된 부가 영역이다. 상세 규칙은 **`add/add_maintenance_handover.md`를 우선**하고, 이 장에는 전역 연결 원칙만 둔다.

## 8.1 책임 경계

현재 기본 구조:

```text
add/
├─ calc.html
├─ add_maintenance_handover.md
├─ css/common.css
├─ css/calc.css
├─ js/calc.js
└─ report/kodex-leverage-report.html

tests/
└─ calc.test.cjs
```

- `calc.html`: DOM / 접근성 구조
- `add/css/common.css`: add 공통 의미 token
- `add/css/calc.css`: Calc 전용 UI / responsive
- `add/js/calc.js`: 계산 / validation / render / event / tooltip / boot
- `add/report/...`: standalone 거래 리포트
- `tests/calc.test.cjs`: Calc production 계산 함수 회귀검증

메인 `css/`, `js/`와 add 코드를 비슷해 보인다는 이유로 억지 공통화하지 않는다.

## 8.2 Calc 구조 불변조건

Calc 기본 흐름은:

```text
Input
→ Validation
→ compute()
→ Rendering
```

이다.

`compute()`는 DOM을 직접 수정하지 않는 계산 함수 성격을 유지한다. Validation 판단과 invalid UI 표시도 현재처럼 분리한다.

현재 규모에서는 `add/js/calc.js` 단일 파일을 유지하며, 테스트 때문에 `calc-core.js`, `calc-validation.js` 등으로 분리하지 않는다.

Node 회귀검증을 위해 파일 하단에서 `compute`, `validate`, `ceil5`만 CommonJS로 노출한다. 브라우저에서는 기존 부팅이 실행되고 Node에서는 DOM 초기화를 실행하지 않는 현재 guard를 유지한다.

계산 로직 변경 시 필수:

```bash
node --test tests/calc.test.cjs
```

테스트에는 production 계산식을 복사하지 않는다. 실제 `add/js/calc.js` 함수를 직접 호출한다.

## 8.3 Calc CSS / 모바일

메인 CSS와 Calc CSS를 통합하지 않는다. 기본 viewport는 메인과 동일한 3구간을 사용하며 add 전용 특수 breakpoint는 기능상 필요할 때만 추가한다.

모바일 KPI/미니카드의 중요한 설명은 `ellipsis`로 강제 절단하지 않고 필요한 경우 자연스럽게 줄바꿈한다.

## 8.4 Report

Report는 `add/report/`에서 독립 관리한다. 데이터 갱신·본 포지션/단타 분류·증권사 원본·누계 검산·차트/KPI 동기화의 상세 기준은 `add/add_maintenance_handover.md`를 따른다.

새 거래를 반영할 때 메인 handover에 같은 산식과 절차를 다시 복사하지 않는다. 전역 규칙은 이 문서, add 전용 상세 규칙은 add handover 한 곳에 둔다.

## 8.5 공통화 판단

공통화는 다음 세 조건을 모두 만족할 때만 검토한다.

- 실제로 둘 이상의 영역이 같은 책임을 갖는가
- 앞으로 함께 변경될 가능성이 높은가
- 공통화 후 결합도가 더 높아지지 않는가

그렇지 않으면 현재 독립 구조를 유지한다.

# 9. 운영 데이터 · GitHub Actions · GAS


## 9.1 운영 JSON과 외부 write 보호

다음 운영 데이터는 코드 리팩토링 / UI 수정 과정에서 함부로 변경하지 않는다.

특히:

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
```

은 항상 주의한다.

또한 나머지 `data/*.json`도 요청과 직접 관련 없으면 수정하지 않는다.

장부·성과 계산에 쓰이는 실제 데이터성 값은 JS literal로 중복 보관하지 않는다. 현재 증권의 별도수익 거래 이력과 재투입 한도는 `data/portfolio.json`의 `separateProfit`, 6/18 확인 현금 기준값은 `constants.outsideCash`, 원천별 추적의 고정 원천값은 `securitiesSourceTracking`을 source of truth로 사용하며, `dashboard-core.js`/`dashboard-ui.js`는 이를 읽어 계산·표시한다.

주의:

- `prices.json`, `performance_snapshots.json`은 KRX 현재가 반영/워크플로우 때문에 정상적으로 바뀔 수 있다.
- 최신 KRX 반영분과 코드 patch를 섞을 때 단순 hash 차이를 코드 회귀로 오인하지 않는다.
- `pension_contributions.json`은 KRX 재갱신 대상이라고 가정하지 않는다.
- 실제 운영 데이터가 포함된 최신 ZIP을 과거 코드 ZIP으로 덮어쓰기 전에 먼저 확인한다.

QA 중 실제 운영 write 금지:

```text
GAS pension save
GAS delete
batch apply
KRX GitHub workflow 실제 실행
운영 JSON update
```

필요하면 mock / stub으로 검증한다.


## 9.2 Google Apps Script(GAS) 운영 및 배포 원칙

Google Apps Script는 **GitHub 프로젝트와 별도로 운영되는 백엔드**다.

기본 원칙:

- GAS 수정이 필요한 경우 사용자가 별도로 제공한 최신 운영 소스를 기준으로 작업한다.
- 과거 대화에서 기억한 GAS 코드를 최신 운영본으로 추정하지 않는다.
- 운영 인증값과 GitHub 연동 정보는 Apps Script의 Script Properties에서 관리하고 문서나 저장소에 실제 값을 기록하지 않는다.
- 프런트엔드는 배포된 GAS Web App `/exec` URL을 호출한다.
- 운영 코드를 수정한 경우 Web App 배포 버전도 함께 갱신한다.
- 가능하면 기존 운영 배포를 갱신하여 기존 `/exec` URL을 유지한다.
- 새 Web App URL을 사용하는 경우에는 메인 JS의 GAS API URL도 함께 맞춘다.
- GAS QA에서는 실제 운영 JSON write, delete, batch apply, KRX workflow 실행을 하지 않고 mock/stub을 우선 사용한다.

JS ↔ GAS 계약 검증 시:

- 프런트 JS의 요청 payload는 GitHub ZIP에서 확인한다.
- 서버 측 handler는 최신 운영 GAS 소스가 별도로 제공된 경우에만 완전 검증한다.


## 9.3 현재 Workflow 날짜 입력 의미

현재 `.github/workflows/update-prices.yml`의 실제 설명은 다음 의미와 일치한다.

```text
날짜 지정
→ 실제 KRX 거래일인지 확인한 뒤 해당 날짜 갱신
→ 비거래일 또는 종가 확인 불가 날짜면 저장하지 않고 실패 처리

날짜 비움
→ 최신·누락·장중 재확정 대상 날짜를 Python이 자동 판단
```

`비워두면 한국시간 오늘`이라는 과거 설명으로 되돌리지 않는다.

Python / Workflow 유지보수 구조:

- `scripts/update_prices.py`는 `설정·공통 helper → 시장 데이터 조회 → 대상일 판단 → 포트폴리오 계산 → 저장/CLI` 순서의 섹션 구조를 유지한다.
- 반복되는 날짜 형식, 조회 재시도, HTTP timeout/User-Agent 같은 실행 설정은 상수로 관리하고 함수 안에 같은 magic value를 중복하지 않는다.
- `.github/workflows/update-prices.yml`은 `trigger → permission → runtime setup → updater 실행 → 생성 데이터 commit` 흐름을 유지한다.
- Workflow가 자동 commit하는 운영 데이터는 `data/prices.json`, `data/performance_snapshots.json` 두 파일로 한정하며 다른 운영 JSON을 함께 `git add`하지 않는다.


### Python dependency 재현성

`requirements.txt`의 직접 dependency는 호환 확인된 버전으로 pin한다. 현재 기준은 `pykrx==1.2.8`, `pandas==2.3.3`, `requests==2.34.2`다. `pykrx`를 다시 올릴 때는 Python 3.11 지원 여부와 `scripts/update_prices.py`가 사용하는 종목/지수 OHLCV API의 호환성을 먼저 확인한다. 하위 transitive dependency까지 `pip freeze` 전체를 저장하는 방식은 기본 운영으로 사용하지 않는다.

# 10. 리팩토링 이력 · 역사적 기준선

이 장은 **현재 구조가 왜 이렇게 되었는지 이해하기 위한 최소 이력**만 남긴다. 과거 차수별 세부 selector, 당시 줄 수, 과거 점수표는 현재 작업 기준으로 사용하지 않는다.

## 10.1 사용 원칙

현재 작업의 Source of Truth는 항상 최신 ZIP과 1~9장의 현재 운영 규칙이다.

과거 이력은:

- 구조 변경의 이유 확인
- 이미 폐기한 구조를 다시 도입하지 않기
- 반복 회귀의 배경 이해

용도로만 사용한다.

과거 점수나 특정 ZIP의 줄 수를 최신 코드의 목표값으로 사용하지 않는다.

## 10.2 통합 연혁

| 단계 | 핵심 결과 |
|---|---|
| 초기 CSS 정리 | 단일 대형 스타일에서 canonical CSS 책임 정리 시작 |
| JS 5분할 | core / charts / ui / pension / app 책임 분리 |
| UI/UX polish | 모바일·표·KPI·topbar·툴팁 반복 회귀 정리 |
| ES Module 전환 | main entry를 module로 전환하고 전역 bridge 제거 |
| JS ownership 재정리 | `dashboard-ui-common`, `dashboard-pension-editor`를 포함한 7-module graph 확립 |
| CSS 기능군 정리 | component / viewport 역할과 cascade 책임 재정비 |
| CSS viewport 재편 | 현재 6파일 `common / tablet / mobile / special / interaction / print` 구조 확립 |
| 후속 정리 | `!important` 제거, Desktop baseline 흡수, Phone UI 역할 최소화, dead/legacy 정리 |
| UI 시스템 통합 리팩토링 (1~18차) | 제목·카드·컨트롤·차트·모달·표·페이지·Feedback·Theme/Corner·Print·Market AI를 공통 primitive/semantic token으로 정리하고, Data List Card와 Modal lifecycle 공통화 및 CSS 6파일·JS 9파일 구조/주석 체계를 확정 |

세부 작업일지는 Git 이력 또는 당시 작업 결과물로 확인하고, handover에 다시 누적하지 않는다.

## 10.3 현재 완료 기준선

현재 유지해야 할 핵심 결과는 다음이다.

### 메인 CSS

```text
css/common.css
css/tablet.css
css/mobile.css
css/special.css
css/interaction.css
css/print.css
```

Desktop은 `common.css` baseline을 사용한다. `style.css`, `desktop.css`, 반복 override 파일을 다시 만들지 않는다.

### 메인 JavaScript

```text
dashboard-core.js
dashboard-ui-common.js
dashboard-modal.js
dashboard-charts.js
dashboard-ui.js
dashboard-pension.js
dashboard-pension-editor.js
dashboard-app.js
```

`dashboard-app.js`가 main graph entry이며, `dashboard-market-ai.js`는 standalone entry로 분리하되 `dashboard-modal.js`의 dialog lifecycle만 공유한다.

### add

Calc는 HTML / CSS / 단일 JS 책임 분리를 유지하고, 핵심 계산 로직은 `tests/calc.test.cjs`로 회귀검증한다. Report는 canonical standalone 파일과 add handover 기준을 유지한다.

## 10.4 과거 점수 기록 처리

과거 UI/UX 100점 milestone, JavaScript 구조 점수, CSS 구조 점수 등은 **역사적 참고값**이며 현재 ZIP의 고정 점수가 아니다.

따라서 이전처럼 여러 시점의 상세 점수표를 이 문서에 보존하지 않는다. 사용자가 `평가`를 요청하면 2장 기준으로 현재 ZIP을 새로 독립 평가한다.

평가 점수 변화가 필요하면 현재 답변에서 근거와 함께 설명하고, 그 숫자를 handover의 영구 baseline으로 누적하지 않는다.

## 10.5 README와 handover 역할

- `README.md`: 실행/사용자가 보는 프로젝트 안내
- `main_dashboard_maintenance_handover.md`: 메인 구조·수정·평가·운영 규칙
- `add/add_maintenance_handover.md`: Calc/Report 상세 운영 규칙
- Git history: 과거 차수별 세부 변경 기록

같은 상세 이력을 여러 문서에 중복 저장하지 않는다.

# 11. 최종 운영 체크리스트

## 11.1 새 작업 시작 전 · 수정 후 체크리스트

새 기능/수정 전에 내부적으로 다음을 확인한다.

```text
[ ] 최신 전체 ZIP을 직접 읽었는가
[ ] 과거 코드 기억을 최신본으로 가정하지 않았는가
[ ] 현재 ES Module 구조를 유지하는가
[ ] 수정 책임 파일이 맞는가
[ ] standalone Market AI 변경이면 `dashboard-modal.js` 외 main feature module과 불필요하게 결합하지 않았는가
[ ] 로컬 런처/Bridge 변경이면 eFriend Ready(efexpertmain.exe) → Bridge → Market AI API → Dashboard 순서, single-UAC/tray, eFriend 포함 전체 종료 동작을 보존했는가
[ ] 공통 canonical CSS rule을 먼저 찾았는가
[ ] 새 breakpoint가 정말 필요한가
[ ] Phone Landscape 판정은 `dashboard-ui-common.js`의 canonical helper를 재사용하는가
[ ] 새 !important가 정말 필요한가
[ ] inline event/global bridge를 만들지 않는가
[ ] protected JSON을 건드리지 않는가
[ ] 계산 결과에 영향이 있는가
[ ] 직전 PASS 기준으로 돌아갈 수 있는가
```

수정 후:

```text
[ ] diff가 요청 범위뿐인가
[ ] 변경 파일만 ZIP에 들어갔는가
[ ] line/byte 통계를 보고했는가
[ ] GitHub 커밋용 짧은 Summary와 간단한 Description을 적었는가
[ ] 새 반복 운영 조건이 있다면 main_dashboard_maintenance_handover.md에 반영했는가
[ ] 다음 요청을 안내했는가
```

## 11.2 최종 구조 보존 원칙

기능 요청을 받으면 코드부터 추가하지 말고 내부적으로 먼저 판단한다.

> **현재 리팩토링된 구조 안에서 자연스럽게 구현 가능한가?**

가능하면 현재 책임 경계를 유지하면서 최소 변경한다.

요청 방식 자체가 현재 구조를 명백하게 훼손한다면:

> **그 요청 그대로는 수행하지 않는다.**

대신 문제점을 짧게 설명하고 현재 구조를 유지하면서 같은 목적을 달성할 수 있는 대안을 제시한다.

이번 프로젝트에서는:

> **기능 구현과 현재 리팩토링 구조 보존은 동등하게 중요한 요구사항이다.**

그리고 모든 작업의 기본 운영 원칙은 다음 한 문장으로 요약한다.

> **구조 보호는 항상 적용하되 검증 범위는 변경 범위에 비례시키고, 전체 QA는 내가 명시적으로 요청한 경우에만 수행한다.**

## 11.3 최종 한 문장 운영 원칙

> **새 채팅에서는 최신 전체 ZIP의 `main_dashboard_maintenance_handover.md`를 가장 먼저 읽고 같은 ZIP의 실제 소스를 source of truth로 확인한다. `점수`는 CSS·JS·UI·UX 세부점수와 각 총점·UI/UX 총점·전체 총점만 출력하고, `평가` 또는 `평가해줘`는 최신 실제 소스를 처음부터 독립적으로 전체 평가한다. 수정은 현재 구조 안에서 최소 범위로 수행하고 QA는 별도 요청에서 변경 위험에 비례해 검증하며, 여러 차수 작업은 마지막에 누적 최종 QA를 수행한다. 결과 파일은 실제 변경 파일만 원래 경로를 유지한 ZIP으로 전달하고 GitHub 커밋용 짧은 Summary와 간단한 Description을 함께 제공한다. 사용자가 앞으로 반복 적용할 운영 조건을 추가·변경하면 별도 요청이 없어도 이 문서의 기존 관련 항목에 자동 반영한다. GAS는 GitHub 프로젝트와 별도로 운영하며, 서버 내부 검증은 최신 운영 GAS 소스가 별도 제공된 경우에만 수행한다.**
