# main_dashboard_maintenance_handover · 메인 대시보드 유지보수 및 인수인계


이 문서는 투자 대시보드의 **단일 유지보수·인수인계 기준 문서**다.

새 채팅이나 새 작업에서는 최신 전체 ZIP 안의 이 파일을 가장 먼저 읽고, 그 다음 같은 ZIP의 실제 소스를 확인한다. **읽는 순서와 source of truth의 우선순위는 다르다.** 문서는 작업 원칙을 설명하지만 실제 구현 상태는 항상 최신 ZIP의 실제 파일이 우선한다.


# 1. 인수인계 · Source of Truth


## 1.1 이 문서의 역할과 현재 파일명

이 문서는 기존의:

```text
과거 한글명 유지보수 문서
20260816_과거 한글명 유지보수 문서
각 채팅에서 별도로 작성하던 인수인계 요청문
```

을 하나로 통합한 **최신 단일 관리 문서**다.

앞으로 새 채팅으로 이동할 때 사용자는 원칙적으로:

```text
현재 GitHub 기준의 최신 투자 대시보드 전체 ZIP
```

**하나만 첨부하면 된다.**

GPT는 새 채팅 시작 시 최신 ZIP을 먼저 열고, ZIP 내부의 정확한 파일명:

```text
main_dashboard_maintenance_handover.md
```

을 찾아 **가장 먼저 읽는다.**

그 후:

1. 이 MD에서 구조 보존 원칙, QA 방식, 점수 이력, 진행상태, 인수인계 기준을 확인한다.
2. 같은 ZIP 안의 실제 소스를 직접 읽는다.
3. 실제 구현 상태는 반드시 최신 ZIP을 source of truth로 사용한다.
4. MD 기록과 실제 ZIP 상태가 일치하는지 확인한다.
5. 일치하면 과거 작업을 재설계하거나 재수정하지 않고 다음 요청을 기다린다.
6. 다르면 임의로 고치지 말고 차이만 먼저 보고한다.

중요:

> **사용자는 이 MD를 새 채팅에 별도로 첨부할 필요가 없다.**  
> **최신 전체 ZIP 하나가 코드와 인수인계 문서를 함께 전달하는 단일 패키지다.**

만약 ZIP 내부에 이 MD가 없거나 읽을 수 없다면 과거 대화 기억으로 대체하지 말고 그 사실을 사용자에게 알린다.

과거 채팅 기억이나 이 문서의 오래된 수치가 최신 ZIP보다 우선할 수 없다.


## 1.2 최신 ZIP 작업의 공통 읽기 순서

최신 전체 ZIP이 첨부된 모든 작업에서는 **작업 종류와 관계없이 ZIP 루트의 `main_dashboard_maintenance_handover.md`를 가장 먼저 전체 읽는다.**

그 다음 같은 ZIP의 실제 파일 구조와 필요한 소스를 확인한 뒤, **사용자가 함께 보낸 명령에 따라 해당 작업만 수행**한다.

중요:

```text
ZIP 첨부 자체
≠ 인수인계
≠ 평가
≠ 수정
≠ QA
```

ZIP은 최신 source of truth를 제공하는 입력일 뿐이며, **실행 모드는 사용자 명령이 결정**한다.

공통 순서:

```text
최신 ZIP 첨부
→ 인수인계 MD 전체 읽기
→ 같은 ZIP의 실제 구조/소스 확인
→ 사용자 명령 해석
→ 해당 범위만 수행
```

과거 채팅 기억이나 예전 ZIP을 최신 기준으로 추정하지 않는다.


## 1.3 `인수인계` 명령

최신 전체 ZIP을 첨부한 뒤 사용자가 아래 한마디만 보내면 된다.

```text
인수인계
```

처리 방식:

```text
인수인계 MD 전체 읽기
→ 같은 ZIP의 실제 구조와 핵심 소스 확인
→ 현재 기준선 / 운영 원칙 / 유지보수 제약 / 주의사항 파악
→ 파일 수정 안 함
→ QA/점수평가 안 함
→ 인수인계 완료 여부만 간단히 보고
```

`인수인계`는 평가 요청이 아니다.


## 1.4 최신 파일 우선 원칙

- 이전 대화에서 기억한 코드를 최종본이라고 추정하지 않는다.
- 내가 현재 채팅에 첨부한 **최신 ZIP 또는 최신 파일을 반드시 직접 읽고 작업한다.**
- 과거 버전의 selector, 함수, DOM, 파일 경로를 현재 코드에 적용하지 않는다.
- 수정 전 요청과 직접 관련된 파일과 사용처를 필요한 범위에서 확인한다.
- 요청과 관계없는 파일이나 영역은 수정하지 않는다.

기본 원칙:

> **최신 파일 기준 + 최소 변경**


## 1.5 Source of Truth 우선순위

새 작업에서의 **읽기 순서**는 `main_dashboard_maintenance_handover.md → 실제 소스`이지만, 내용이 충돌할 때의 **진실 우선순위**는 다음과 같다.

1. 현재 작업에 첨부된 최신 전체 ZIP의 실제 파일
2. 같은 ZIP의 `main_dashboard_maintenance_handover.md`
3. 같은 ZIP의 `README.md`
4. 과거 대화·과거 ZIP·역사적 점수 기록

따라서 MD나 README가 실제 코드와 다르면 문서 내용을 근거로 코드를 되돌리지 않는다. 먼저 차이를 확인하고 실제 최신 코드 상태를 기준으로 판단한다.


## 1.6 새 채팅으로 이동할 때의 기본 인수인계 방식

앞으로 긴 별도 인수인계문을 매번 새로 만들거나 MD를 별도로 첨부할 필요가 없다.

새 채팅에는:

```text
최신 투자 대시보드 전체 ZIP
```

**하나만 첨부한다.**

GPT는 ZIP을 열자마자 내부의:

```text
main_dashboard_maintenance_handover.md
```

를 가장 먼저 읽고, 그 다음 실제 소스를 확인한다.

사용자는 최신 전체 ZIP을 첨부한 뒤 다음 한마디만 보내면 된다.

```text
인수인계
```

또는 별도 문구 없이 ZIP을 첨부한 뒤 바로 작업 요청을 이어가도 된다.

이후 사용자는:

```text
1차
QA
2차
QA
...
```

형태로 이어갈 수 있다.

최신 ZIP 내부 MD가 인수인계 기준이며, 실제 소스 상태는 같은 ZIP의 파일들이 source of truth다.


## 1.7 새 채팅 시작 시 먼저 확인할 것

새 채팅에서는 수정 전에 다음 순서를 지킨다.

### 1. ZIP 내부 인수인계 MD

최신 ZIP 안에서:

```text
main_dashboard_maintenance_handover.md
```

를 찾아 가장 먼저 읽는다.

없거나 읽을 수 없으면 과거 기억으로 작업을 시작하지 않고 사용자에게 알린다.

### 2. 프로젝트

```text
현재 디렉토리 구조
실제 변경 대상 파일
MD가 기록한 현재 구조와 실제 ZIP의 일치 여부
```

### 3. JS

```text
7개 module 구조
core DOM 비의존 여부
ui-common 저수준 공통 책임
pension View / Editor 분리
module-private state ownership
index.html 단일 module entry
importmap/cache bust
import graph
circular import
global bridge 여부
boot 구조
```

### 4. CSS / Responsive

```text
style.css canonical rule
1101 / 761~1100 / ≤760 구조
기능 media
section-title rule
iphone-request-desktop
```

### 5. 데이터

```text
보호 JSON 존재
요청과 무관한 data 변경 금지
```

### 6. 현재 진행위치

MD에 적힌 진행위치와 최신 ZIP이 실제로 일치하는지 확인한다.

일치하면:

> **다시 과거 작업을 재설계하거나 재수정하지 않고 바로 다음 요청으로 이어간다.**


## 1.8 MD와 최신 ZIP이 다를 때

MD의 기록과 최신 ZIP이 다르면:

```text
MD가 최신이라고 가정해서 ZIP 수정
```

하지 않는다.

반드시 먼저 차이를 보고한다.

예:

```text
현재 ZIP은 MD의 ES Module 기준과 다릅니다.

차이
- index.html이 classic script
- dashboard-app.js import 없음
- 현재 HEAD가 과거 상태

임의 수정하지 않고 확인 대기
```

반대로 최신 ZIP이 MD보다 더 최신 구조라면 최신 ZIP을 우선하고 MD가 오래된 것으로 판단한다.


## 1.9 GitHub / 로컬 파일이 엇갈릴 때

모바일 GitHub 수정 후 GitHub Desktop을 실행하는 등 로컬/원격 상태가 엇갈릴 수 있다.

이 경우:

- 파일명이나 수정시간만 보고 최신본 판단 금지
- Git HEAD / remote / working tree 상태 확인
- 필요한 경우 실제 file hash/diff 비교
- 운영 JSON 차이는 KRX 갱신 여부와 분리해서 판단
- conflict가 난 파일을 무작정 ours/theirs로 선택하지 않음

대규모 patch를 적용하기 전에:

> **어느 전체 ZIP이 최종 PASS 기준인지 먼저 확정**

한다.

코드 기준본과 오늘 갱신된 운영 JSON을 구분해서 판단한다.


## 1.10 이 문서의 유지관리 원칙

이 문서는 매 소규모 UI 수정마다 변경이력을 누적하는 changelog가 아니다.

다음과 같은 **기준선이 바뀔 때** 갱신한다.

- 구조 리팩토링 완료
- JS/CSS architecture 변경
- breakpoint 정책 변경
- 중요한 UI 불변조건 변경
- QA 운영 방식 변경
- 점수 기준/기준본 변경
- 차수형 대규모 작업 완료
- 새 채팅 인수인계에 반드시 필요한 진행위치 변경

반대로 다음은 매번 이 문서에 누적하지 않는다.

- 버튼 1개 간격 수정
- 문구 1개 변경
- 단발성 버그 수정
- 단순 data 갱신
- KRX 현재가 갱신

단, 사용자가 대화 중 **앞으로 반복 적용할 유지보수·수정·QA·파일전달 조건을 새로 추가하거나 기존 조건을 변경하면**, 별도 문서 반영 요청이 없어도 이 파일의 기존 관련 항목에 자동 반영한다. 일회성 작업 지시는 장기 운영 규칙으로 확대하지 않는다.

목표는 문서를 계속 길게 만드는 것이 아니라:

> **다음 채팅이 이 문서 하나와 최신 ZIP만 읽고 정확히 이어서 작업할 수 있게 하는 것**

이다.


# 2. 평가 · 점수


## 2.1 평가 명령 구분

다음 두 명령은 목적과 출력 형식이 다르다.

```text
점수
→ 최신 실제 소스를 필요한 범위에서 검증해 점수를 새로 산정
→ CSS / JS / UI / UX 세부 점수와 각 총점, UI/UX 총점, 전체 총점만 출력
→ 상세 평가문, A/B/C 문제 설명, 수정 제안, ZIP 생성 없음

평가
평가해줘
→ 아래 공통 전역 독립 평가 프로토콜 전체 적용
→ 이전 답변 수준의 상세한 CSS / JS / UI / UX 전체 평가
→ A/B/C 문제 분류와 최종 결론 포함
→ 파일 수정 / ZIP 생성 없음
```

`평가`와 `평가해줘`는 완전히 같은 명령으로 처리한다.


## 2.2 `점수` 명령 출력 규칙

사용자가 **`점수`**라고만 하면 과거 점수표를 복사하지 않고 현재 최신 전체 ZIP의 실제 상태를 기준으로 점수를 새로 산정한다. 점수 산정에 필요한 정적·구조·가능한 runtime 검증은 내부적으로 수행하되, **답변에는 점수만 표시**한다.

출력 범위:

### CSS
- 구조 / 파일 구성
- Cascade / Specificity
- Responsive
- Theme / Token
- Interaction CSS
- `!important` 관리
- Dead / Legacy 관리
- 유지보수성
- **CSS 총점 / 100**

### JavaScript
- Module responsibility
- Dependency
- State ownership
- Public API
- Events
- Rendering
- Async / Error
- 유지보수성
- 확장성
- **JS 총점 / 100**

### UI
- Visual hierarchy
- Layout
- Typography
- Spacing
- Table
- Modal
- Tooltip
- Chart UI
- Responsive
- Theme
- Interaction consistency
- **UI 총점 / 100**

### UX
- 날짜 흐름
- KRX
- 개인보기
- 퇴직연금
- 차트
- 모바일
- Feedback
- Error recovery
- Accessibility
- **UX 총점 / 100**

마지막에는 반드시 다음만 추가한다.

```text
UI/UX 총점 = UI 총점과 UX 총점의 평균
전체 총점 = CSS / JS / UI / UX 총점의 동일가중 평균
```

점수가 정수로 충분하면 정수로, 평균 계산에 소수점이 생기면 소수점 첫째 자리까지 표시한다.

`모든 점수`는 과거 호환을 위해 단독 사용 시 `점수`와 같은 의미로 처리한다.

최신 전체 ZIP이 현재 채팅에 명확히 없으면 과거 ZIP이나 기억으로 점수를 만들지 말고 최신 전체 ZIP을 요청한다.


## 2.3 `평가` / `평가해줘` 공통 전역 독립 평가 프로토콜

사용자가 최신 전체 ZIP을 첨부한 상태에서 **`평가` 또는 `평가해줘`**라고 요청하면, 별도의 긴 평가 요청문을 다시 요구하지 않고 **이 섹션의 전체 프로토콜을 자동 적용**한다.

이 프로토콜의 목적은 과거 평가를 이어받아 점수를 확인하는 것이 아니라, **그 시점의 최신 ZIP 실제 소스를 처음부터 다시 독립 분석하여 CSS / JavaScript / UI / UX의 현재 품질을 판정하는 것**이다.

### A. 평가 요청의 의미

`평가`와 `평가해줘`는 다음 의미로 처리한다.

```text
최신 ZIP만 source of truth로 사용
→ 인수인계 MD를 먼저 읽어 설계 의도와 운영 제약 확인
→ 과거 점수/100점 판정은 증거로 사용하지 않음
→ 실제 파일 구조와 실제 코드를 처음부터 다시 분석
→ CSS / JS / UI / UX를 각각 세부 평가
→ 실제 감점 근거가 있는 경우에만 감점
→ 문제를 A / B / C로 분류
→ 파일은 수정하지 않음
→ ZIP도 만들지 않음
```

평가 중 발견한 문제가 있더라도 사용자가 별도로 `수정`을 요청하기 전에는 파일을 고치지 않는다.

현재 채팅에 최신 전체 ZIP이 명확히 없으면 과거 ZIP이나 기억한 파일을 임의로 사용하지 말고 **최신 전체 ZIP을 요청**한다.

### B. Source of Truth 우선순위

평가 시 기준 순서는 다음과 같다.

1. 사용자가 현재 평가 요청과 함께 제공한 **최신 전체 ZIP의 실제 파일**
2. 같은 ZIP의 `main_dashboard_maintenance_handover.md`
3. 같은 ZIP의 `README.md`
4. 과거 대화 내용은 배경 이해에만 사용하고 **점수·정상 판정의 근거로 사용하지 않는다.**

인수인계 MD의 역할:

- 현재 설계 의도
- 유지보수 제약
- 의도된 예외
- source of truth 정책
- GAS 별도 관리 원칙
- 평가에서 반복 감점하지 않기로 확정한 trade-off

를 이해하기 위한 문서다.

그러나 MD에 `PASS`, `100점`, `완료`라고 적혀 있다는 사실만으로 정상 판정하지 않는다. **실제 코드를 다시 확인해야 한다.**

### C. GAS 평가 범위

Google Apps Script는 GitHub 프로젝트 구조 평가 대상이 아니라 **별도 운영 백엔드**로 취급한다.

평가 범위:

```text
GitHub ZIP만 제공
→ Frontend JS가 GAS로 보내는 request payload와 client-side 처리까지 검증
→ GAS server handler 내부는 최신 운영 소스가 별도 제공되지 않으면 직접 검증하지 않음
→ 이것 자체로 CSS / JS / UI / UX 점수를 감점하지 않음

최신 운영 GAS 소스도 별도 제공
→ JS ↔ GAS request / response contract까지 완전 검증
```

GAS 자체의 코드 품질 점수는 사용자가 별도로 요청하지 않는 한 CSS / JS / UI / UX 점수에 섞지 않는다.


### D. 프로젝트 구조부터 실제로 확인

평가 시작 시 ZIP의 실제 디렉터리와 파일 목록을 먼저 확인한다.

현재 기본 기대 구조는 다음 계열이다.

```text
index.html
css/style.css

js/dashboard-core.js
js/dashboard-ui-common.js
js/dashboard-charts.js
js/dashboard-ui.js
js/dashboard-pension.js
js/dashboard-pension-editor.js
js/dashboard-app.js

scripts/update_prices.py
.github/workflows/update-prices.yml
data/*.json

add/calc.html
add/css/common.css
add/css/calc.css
add/js/calc.js
add/report/*
```

그러나 실제 ZIP이 다르면 **실제 구조를 우선**한다.

평가 보고 첫 부분에는 최소 다음을 적는다.

- 실제 메인 entry
- 메인 CSS
- 실제 JS module 수와 파일명
- Python / Workflow
- data 파일
- calc / report 등 부가 페이지
- 문서상 구조와 실제 ZIP 구조의 불일치가 있는지

`add/calc`와 report는 존재 여부와 구조를 확인하되, **메인 대시보드 점수를 왜곡하지 않도록 메인과 부가 페이지를 구분해서 평가**한다.

### E. 정적 검증 기본 세트

가능한 실행 환경에서는 평가 전에 다음을 실제로 검사한다.

#### CSS

- parse 성공 여부
- 전체 line / byte
- rule 수
- declaration 수
- `!important` 수
- media query 조건과 분포
- exact duplicate selector + 동일 context
- 중복 declaration / override 후보
- specificity outlier
- CSS variable 정의/사용
- hard-coded color 후보
- 사용처를 찾기 어려운 selector / token 후보

#### JavaScript

- 7개 ES Module syntax
- 실제 import graph
- circular dependency
- module별 export 수
- 실제 import되지 않는 export
- `window` / `globalThis` 등에 의도치 않은 global export
- 동일 helper 중복 후보
- listener 등록 구조와 guard
- state 정의 위치와 실제 소비 module
- fetch / timeout / response / parse handling

#### Python / Workflow

- Python syntax
- workflow YAML parse 가능 여부
- workflow input 설명과 Python 실제 target-date 처리 의미가 일치하는지

정적 분석 도구가 특정 문법을 해석하지 못한 경우 이를 실제 오류라고 단정하지 말고 **도구 한계와 코드 오류를 구분**한다.

### F. CSS 평가 프로토콜

`css/style.css`는 단일 파일 유지가 현재 설계 원칙이다.

단일 파일이라는 사실 자체는 감점하지 않는다.

#### F-1. 구조 / 파일 구성

다음을 본다.

- section / role anchor가 실제 기능 배치와 맞는지
- 같은 기능 CSS를 찾기 쉬운지
- Topbar / Navigation / Chart 등 주요 기능군의 응집도
- `continuation`
- `cross-cutting continuation`
- source-order 때문에 의도적으로 떨어진 rule의 소속이 설명되어 있는지
- 관련 rule이 이유 없이 멀리 분산되어 있는지
- 동일 기능을 여러 위치에서 응급 override하는 구조인지

`continuation` 또는 `cross-cutting continuation`이 실제 source-order/cross-cutting 이유를 가지고 있다면 **단순 분산으로 감점하지 않는다.**

반대로 이름만 continuation이고 실제로는 의미 없는 중복/override라면 실제 코드 근거로 지적한다.

#### F-2. Cascade / Specificity

- 불필요하게 높은 specificity
- ID selector 남용
- 긴 selector가 실제 유지보수 위험을 만드는지
- 후반 override chain
- 동일 element/property의 반복 재정의
- media 간 충돌
- source-order 의존성이 불투명한 부분

을 실제 cascade 관점에서 평가한다.

selector 길이 자체를 감점 이유로 삼지 않는다.

#### F-3. `!important`

전체 `!important`를 다음으로 분류한다.

```text
필수 또는 browser/native 대응
구조상 허용 가능
제거 후보
설명 곤란
```

개수만으로 감점하지 않는다.

`!important` 제거를 점수 올리기용 작업으로 제안하지 않는다.

#### F-4. Responsive

기본 구간:

```text
Desktop  ≥ 1101
Tablet   761 ~ 1100
Mobile   ≤ 760
```

실제 CSS에서 모든 media 조건을 inventory하고 추가 breakpoint를 확인한다.

추가 breakpoint는:

- 기능상 필요한 예외인지
- orientation / pointer / hover / print / reduced-motion인지
- 단순 임의 breakpoint인지
- 기본 3구간으로 합치면 기능이 깨지는지

를 판단한다.

대표 검증 폭:

```text
1440
1024
900
768
430
390
```

실제 코드에 기능성 좁은 폭 예외가 존재하면 그 조건도 함께 평가한다. 특정 과거 수정사항을 재확인 목록으로 외우지 말고 **현재 CSS에서 발견되는 실제 예외를 inventory하여 검증**한다.

#### F-5. Token / Theme

- semantic CSS variable 구조
- light / dark counterpart
- surface / border / text / positive / negative / accent
- spacing
- radius
- shadow
- typography
- interaction token
- JS가 CSS variable을 읽어 쓰는 chart token

을 확인한다.

일부 값이 hard-coded되어 있어도 browser-native/print/특수 이유가 있으면 맥락을 본다.

#### F-6. Dead / Legacy CSS

dead code는 다음 근거를 함께 봐야 한다.

- HTML 정적 class/id
- JS가 동적으로 생성하는 class/id
- template literal
- `classList`
- `dataset`
- state class
- pseudo state
- print / media
- chart SVG 생성 코드

정적 검색 한 번으로 안 나온다는 이유만으로 dead code라고 단정하지 않는다.

### G. JavaScript 평가 프로토콜

7개 ES Module을 모두 실제로 읽고 평가한다.

#### G-1. Module responsibility

최소 다음을 확인한다.

```text
dashboard-core.js
dashboard-ui-common.js
dashboard-charts.js
dashboard-ui.js
dashboard-pension.js
dashboard-pension-editor.js
dashboard-app.js
```

각 파일별로:

- 실제 책임
- import 대상
- export API
- module-private state
- DOM ownership
- 다른 module에 노출하는 API

를 요약한다.

파일 길이만으로 분리를 권하지 않는다.

응집도가 높고 하나의 subsystem이면 큰 파일도 허용한다.

#### G-2. Dependency graph

실제 `import`를 파싱해 방향 그래프를 만든다.

반드시 확인:

- circular dependency
- 불필요한 역방향 dependency
- core가 UI/DOM을 참조하는지
- app이 orchestration 이상으로 business/UI 구현을 떠안는지
- pension view/editor 책임이 섞이는지
- charts가 외부 내부 state를 직접 침범하는지

#### G-3. Public API

module별 export를 실제 소비처와 대조한다.

분류:

```text
사용 중 public API
unused export
module-private로 내려도 되는 후보
공통화가 필요한 중복 helper 후보
```

실제 unused가 0이면 억지 후보를 만들지 않는다.

#### G-4. State ownership

실제 코드에서 state를 inventory한다.

최소 범위:

- active date / date selection
- personal view
- separate profit
- theme / UI persistent preference
- chart state
- expanded chart state
- pension editor state
- modal state
- batch/idempotency client state
- localStorage state
- listener/runtime state

평가 기준:

- 여러 module이 실제 공유 → shared state 가능
- 한 module만 사용 → module-private이 기본
- DOM state와 계산 state가 불필요하게 뒤섞이지 않는지
- reset 시 숨은 상태가 남지 않는지

#### G-5. Event architecture

다음을 inventory한다.

- delegated click
- direct listener
- change / input / submit
- resize
- pointer / touch
- keyboard
- focus / focus trap
- outside click
- ESC
- dynamically recreated DOM의 listener
- listener guard / duplicate prevention

특정 최근 버그를 암기해 재검증하는 식으로 하지 않는다. **현재 코드에서 실제 존재하는 이벤트 흐름 전체를 기준으로 중복 등록·입력 차단·stale DOM reference 가능성을 평가**한다.

#### G-6. DOM rendering

- `innerHTML`
- `insertAdjacentHTML`
- DOM API
- render 함수 책임
- 전체 render / 부분 render
- 반복 DOM query
- escape helper 사용
- 사용자/JSON 값의 HTML 삽입
- dynamically generated IDs / ARIA references

를 확인한다.

전체 render 자체는 현재 규모에서 이미 허용 가능한 trade-off로 정리되어 있으므로 **실제 성능 문제가 측정되지 않는 한 반복 감점하지 않는다.**

#### G-7. Async / Error

- fetch timeout
- `response.ok`
- JSON parse
- required vs optional JSON
- fallback
- GAS POST
- loading/disabled state
- error text
- duplicate request
- race condition 가능성
- operation id / batch request id

을 실제 흐름별로 확인한다.

### H. Frontend ↔ Backend 계약

#### KRX

Frontend에서 두 mode를 코드로 직접 확인한다.

```text
최신/누락
→ body.date 없음

재갱신
→ body.date = activeDate
```

화면에 선택 날짜가 항상 존재한다는 사실과 request body에 `date`가 존재한다는 사실을 혼동하지 않는다.

최신 운영 GAS 소스가 함께 제공된 경우 서버 측도 확인한다.

- 명시 날짜 처리
- 이미 종가 데이터인 경우 skip 여부
- workflow dispatch 조건
- 반환 action / reason / message
- PIN error contract

GAS가 제공되지 않은 경우 frontend payload까지만 판정하고 서버 내부는 미검증으로 표시한다.

#### Pension

Frontend에서 최소 확인:

```text
upsert
delete
batchPension
batchRequestId
PIN
operations
response state
duplicate/idempotency 처리
```

최신 운영 GAS 소스가 별도 제공된 경우에만 server contract까지 완전 대조한다.

### I. UI 평가 프로토콜

UI 평가는 코드 구조 점수와 분리해서 실제 화면 설계 관점으로 평가한다.

최소 영역:

- Topbar
- Hero
- date controls
- action buttons / external links
- 연금+계좌 성과
- 증권계좌 현황
- 증권/퇴직연금 성과 요약 (증권 전체/계좌별 전환 포함)
- 보유분
- 투자기간 차트
- 장부결과 VS 실제보유
- 투자원금 원천 및 검산
- 퇴직연금
- Table
- Modal
- Tooltip
- Navigation / TOC
- Mobile hamburger
- Footer가 실제 존재하면 Footer

실제 존재하지 않는 영역은 `N/A`로 처리하며 없는 것을 이유로 감점하지 않는다.

각 영역에서 평가:

```text
정보 위계
alignment
spacing
density
typography
label clarity
button/link consistency
hover
active
focus
touch
responsive
light/dark
overflow
stacking / z-index
readability
```

#### Table

모든 실제 table variant를 보며:

- header/body alignment
- `th` / `td`
- first-column sticky
- summary row
- source-data table 예외
- row hover
- light/dark hover
- mobile table/card 전환
- 좁은 폭 기능 예외
- tooltip이 table overflow/stacking context에 잘리는지

를 평가한다.

특정 과거 표 수정사항을 별도 체크리스트로 고정하지 않고 **현재 DOM/CSS에서 실제 구현된 table behavior 전체를 평가**한다.

#### Tooltip / Overlay

- trigger semantic
- tooltip class 공통화
- open/close
- outside click
- aria-expanded
- `role=tooltip`
- viewport overflow
- table overflow clipping
- stacking context / z-index
- light/dark

를 확인한다.

### J. UX 평가 프로토콜

최소 다음 실제 사용자 flow를 코드 순서대로 따라간다.

#### 날짜

```text
year/month 선택
→ day 선택
→ activeDate
→ render
→ mobile sticky/pin
```

#### KRX

```text
modal open
→ PIN
→ 최신/누락 또는 재갱신
→ loading
→ success / skip / error
→ toast / modal feedback
```

#### 개인보기

개인보기 3회 클릭은 **일반 사용자에게 진입 경로를 숨기기 위한 의도된 private gesture**다.

따라서:

- discoverability가 낮음
- 일반 button이 아님
- keyboard로 쉽게 찾기 어려움

만을 이유로 감점하지 않는다.

대신 실제 기능 품질만 본다.

```text
OFF → 3회 → ON
ON → 3회 → OFF
OFF 후 숨은 state reset
별도수익 연동
계산기/메뉴 노출
layout 안정성
일반 클릭 방해 여부
```

#### 퇴직연금

```text
금액 조정
기업적립금
현금성자산
ETF 추가매수
삭제
PIN
작업모음
simulation
batch
save
완료 후 state/render
```

#### Chart

```text
legend
최소 1개 유지
전체
Y축 auto
mode 변경
확대
확대 중 state 변경
keyboard
resize
mobile tooltip
```

UX 문제는:

- 사용자가 현재 상태를 알 수 없음
- 잘못된 action을 하기 쉬움
- feedback이 실제 동작과 다름
- 취소/복구가 어려움
- 불필요한 반복 입력/클릭
- destructive action이 불명확

같은 **실제 영향이 있을 때만** 지적한다.

“더 예쁘게/더 일반적으로 만들 수 있다”만으로 개선안을 만들지 않는다.

### K. Accessibility / Interaction

다음을 실제 markup과 dynamic markup에서 확인한다.

- `<a>` / `<button>` semantic
- button `type`
- keyboard focus
- `:focus-visible`
- dialog role / aria-modal
- focus trap
- focus return
- ESC
- label / aria-label
- aria-controls
- aria-labelledby
- aria-describedby
- aria-expanded
- aria-live/status
- table caption / scope
- chart keyboard support
- color contrast token
- hover-only information
- touch target
- reduced-motion
- user-select
- touch-action
- draggable/link drag

native `<select>`의 펼친 option UI는 browser/OS native rendering일 수 있으므로 **DevTools viewport별 selected color가 다르다는 이유만으로 custom select 전환을 권하지 않는다.**

### L. 성능 / 유지보수성

평가:

- render frequency
- SVG redraw
- resize throttling/debounce
- repeated querySelector
- listener duplication
- fetch duplication
- data size
- localStorage use
- module size와 실제 응집도
- debugging path
- 기능 추가 시 수정 위치 예측 가능성

현재 규모에서는 다음을 **측정된 문제가 없다는 전제에서 반복 감점/개선안으로 제시하지 않는다.**

```text
전체 dashboard render 방식
Date.now() 기반 cache bust
Vanilla JS 구조
framework / state library 미사용
단일 style.css
```

실제 체감 지연 또는 profiling 근거가 있을 때만 다시 검토한다.

### M. 실제 Render / Runtime 검증 원칙

가능한 환경이면 정적 분석에 더해 runtime smoke를 수행한다.

우선순위:

1. 로컬 정적 서버
2. 실제 data JSON 로딩
3. representative date render
4. 최신 날짜와 과거 날짜
5. personal view OFF / ON
6. representative viewports
7. light / dark

대표 viewport:

```text
1440
1024
900
768
430
390
```

실제 CSS에 기능성 exception이 있으면 그 폭도 추가한다.

확인 예:

- runtime exception
- duplicate id
- broken ARIA reference
- overflow
- hidden content collision
- modal focus
- table/tooltip clipping
- chart SVG size
- mobile layout

브라우저 실행 환경이 제공되지 않으면 **실제 pixel/render를 확인했다고 가장하지 않는다.** 그 경우 `정적 코드 기준` 또는 `runtime smoke 미실시`라고 명확히 표시한다.

### N. 점수 산정

과거 점수를 참고하지 않고 최신 실제 근거로 새로 산정한다.

#### CSS

- 구조 / 파일 구성
- Cascade / Specificity
- Responsive
- Theme / Token
- Interaction CSS
- `!important` 관리
- Dead / Legacy 관리
- 유지보수성
- **CSS 종합 /100**

#### JavaScript

- Module responsibility
- Dependency
- State ownership
- Public API
- Events
- Rendering
- Async / Error
- 유지보수성
- 확장성
- **JS 종합 /100**

#### UI

- Visual hierarchy
- Layout
- Typography
- Spacing
- Table
- Modal
- Tooltip
- Chart UI
- Responsive
- Theme
- Interaction consistency
- **UI 종합 /100**

#### UX

- 날짜 흐름
- KRX
- 개인보기
- 퇴직연금
- 차트
- 모바일
- Feedback
- Error recovery
- Accessibility
- **UX 종합 /100**

마지막에 **UI/UX 종합 /100**과 **전체 총점 /100**을 표시한다. 전체 총점은 CSS / JS / UI / UX 총점의 동일가중 평균으로 계산한다.

평가 원칙:

```text
실제 감점 근거 있음 → 감점
실제 감점 근거 없음 → 100 가능
"완벽한 소프트웨어는 없으니 99" 식 감점 금지
점수를 100으로 만들기 위한 억지 개선안 금지
N/A 항목을 점수 하락 근거로 사용 금지
```

### O. 문제 분류

문제는 반드시 아래로 분류한다.

#### A. 실제 수정 권장

명확한:

- bug
- 기능 불일치
- cascade 문제
- responsive 회귀
- 접근성 오류
- 실제 UX 혼란
- documentation이 실제 운영을 잘못 설명하여 오작동을 유발할 가능성

#### B. 선택적 개선

현재 정상이고 회귀도 없지만 **실제 장점이 분명한 경우만** 제안한다.

B급을 채우기 위해 후보를 억지로 만들지 않는다.

#### C. 수정하지 않는 게 나음

- 현재 설계 의도에 맞음
- 복잡도 증가
- regression risk가 이득보다 큼
- browser native behavior
- 이미 검토된 trade-off
- 점수 목적의 정리

각 A/B/C 항목마다 가능하면:

```text
파일
selector / 함수 / 영역
현재 상태
실제 영향
판정 이유
권장 방향
```

을 적는다.

### P. 문서 정확성은 별도 표시

README / 인수인계 MD / workflow description이 실제 코드와 다르면 **문서 정확성 문제**로 따로 보고한다.

문서 오류가 CSS/JS/UI/UX의 실제 실행 품질과 무관하면 해당 점수에 억지로 섞지 않는다.

운영자가 잘못된 action을 수행할 정도의 문서 오류라면 A급 문제로 분류할 수 있다.

### Q. 평가 결과 출력 순서

`평가` / `평가해줘` 결과는 기본적으로 다음 순서로 작성한다.

1. **한눈에 보는 결론**
2. **실제 프로젝트 구조**
3. **검증 방법과 검증 가능/불가 범위**
4. **CSS 상세 평가**
5. **JS 상세 평가 + 실제 dependency graph**
6. **Frontend ↔ GAS / Workflow contract**
7. **UI 영역별 평가**
8. **UX flow별 평가**
9. **Accessibility / Interaction**
10. **성능 / 유지보수성**
11. **A / B / C 문제 목록**
12. **전체 세부 점수표**
13. **최종 결론**

최종 결론에는 반드시:

```text
CSS 최종 점수
JS 최종 점수
UI 최종 점수
UX 최종 점수
UI/UX 종합점수
전체 총점

A급 실제 수정 필요 수
B급 선택적 개선 수
C급 유지 권장 수

현재 구조가 유지보수 기준선으로 적절한지
추가 구조 리팩토링이 실제로 필요한지
아니면 실제 사용 중 발견되는 문제만 최소 수정하는 단계인지
```

를 명시한다.

### R. 과거 수정사항을 평가 체크리스트로 고정하지 않는 원칙

공통 평가 프로토콜에는 **“최근 ○○를 수정했으니 재확인” 같은 과거 작업별 체크리스트를 누적하지 않는다.**

이유:

- 평가가 과거 수정사항 중심으로 편향됨
- 새로 생긴 문제를 놓칠 수 있음
- 오래된 회귀 목록이 계속 비대해짐
- 이미 제거된 UI까지 검사하려는 오류가 생김

대신 최신 ZIP에서:

```text
현재 존재하는 DOM
현재 존재하는 CSS
현재 존재하는 state
현재 존재하는 event
현재 존재하는 UX flow
현재 존재하는 breakpoint / exception
```

을 처음부터 inventory하여 평가한다.

과거 작업 이력은 **설계 의도를 이해하는 참고자료**이며, 최신 평가 범위는 항상 실제 최신 코드 전체다.


앞으로 이 투자 대시보드의 모든 소스 수정은 아래 원칙을 최우선으로 지켜서 수행한다.

현재 프로젝트는 이미 다음 영역의 대규모 리팩토링을 완료한 상태다.

- 메인 대시보드 CSS
- 메인 대시보드 JavaScript
- 투자 계산기 `calc`
- report HTML
- 디렉토리 구조

따라서 현재 최신 버전은 과거 누적 패치본이 아니라 **새로운 구조 기준선**이다.

앞으로의 목표는 단순히 기능을 정상적으로 추가·수정하는 것이 아니다.

> **기능을 추가하면서도 현재 리팩토링된 구조를 다시 망가뜨리지 않는 것**

을 기능 구현과 동등하게 중요한 요구사항으로 취급한다.

다만 구조 보호 때문에 매 작업마다 프로젝트 전체를 분석하거나 전체 QA를 수행해서 작업 시간이 과도하게 늘어나서는 안 된다.

핵심 운영 원칙은 다음과 같다.

> **구조 보호는 항상 적용한다.**  
> **검증 범위는 변경 범위에 비례한다.**  
> **전체 QA는 내가 명시적으로 요청한 경우에만 수행한다.**


## 2.4 평가 답변 작성 형식

전체 평가는 사용자가 읽기 쉽게 **일반 Markdown 제목, 문단, 표** 중심으로 작성한다.

- 별도의 불투명한 참조 박스나 읽기 어려운 특수 UI 형식에 의존하지 않는다.
- 코드나 selector를 보여줄 필요가 있을 때만 짧은 코드 블록을 사용한다.
- 검증 근거와 문제 설명은 해당 항목 바로 아래에 적는다.
- 점수는 표로 정리하되, 상세 평가는 점수표만 나열하지 않고 실제 근거를 함께 설명한다.
- 과거 평가 문구를 재사용하기보다 최신 실제 코드에서 확인한 사실을 자연어로 설명한다.


# 3. 수정 · QA 실행 명령


## 3.1 명령별 실행 모드

```text
1차 / 2차 / 3차 / ...
→ 해당 차수 수정만 수행
→ 최소 안전검사만 수행
→ 같은 답변에서 QA하지 않음

QA
→ 직전 수정 범위 중심 검증
→ 파일은 원칙적으로 수정하지 않음

최종 QA / 전체 QA
→ 여러 차수 또는 누적 수정본을 넓은 범위로 다시 검증

수정
→ 직전 대화에서 합의된 수정사항만 최소 변경
→ 합의되지 않은 개선을 끼워 넣지 않음

구체적인 UI / CSS / JS 수정 요청
→ 해당 요청 범위만 최소 변경
→ 기존 구조 / 기능 / 반응형 / 최근 수정사항 보존
```

`인수인계`, `점수`, `평가`, `평가해줘`는 각각 #1과 #2의 규칙을 적용한다.


## 3.2 차수 작업 방식

내가:

```text
1차
2차
3차
4차
5차
```

등 차수만 지정하면 **해당 차수 수정만 수행한다.**

차수 작업에서는:

- 최신 파일 기준
- 해당 차수 범위만 수정
- 구조 보호
- 최소 변경
- 기본 문법 확인
- 결과 파일 생성

까지만 한다.

**QA는 수행하지 않는다.**

결과를 전달하고 종료한다.


## 3.3 차수 명령의 의미

사용자가:

```text
1차
2차
3차
4차
5차
...
```

처럼 차수만 보내면:

> **그 차수의 수정만 수행한다. QA는 하지 않는다.**

GPT가 해야 할 일:

1. 최신 ZIP/파일 직접 확인
2. 해당 차수 범위 특정
3. 직접 영향 사용처 확인
4. 최소 변경
5. 기본 syntax / import / selector 검사
6. diff 검사
7. 운영 JSON 등 금지 파일 변경 여부 확인
8. 변경 파일만 ZIP으로 전달
9. 다음 요청을 `QA`로 안내

차수 수정 결과에서 전체 브라우저 회귀 테스트나 모든 viewport QA를 선행하지 않는다.


## 3.4 차수 수정 단계에서 허용되는 최소 안전검사

수정 결과물을 주기 전에 최소한 다음은 확인한다.

공통:

```text
syntax
diff
예상 밖 파일 변경
ZIP integrity
운영 JSON 변경
CSS/JS 책임 범위
```

CSS 수정이면 추가:

```text
새 !important
새 breakpoint
동일 목적 override
canonical selector 수정 여부
```

JS 수정이면 추가:

```text
import/export mismatch
unresolved import
circular import
새 global
새 inline event
책임 파일 위반
```

계산 수정이면 추가:

```text
대표 입력 또는 가능한 범위의 전후 계산 parity
```

이 단계는 **QA가 아니다.**

시간이 오래 걸리는 전체 DOM/runtime/responsive 검증은 다음 `QA`에서 한다.


## 3.5 내가 `QA`라고 하면 직전 변경범위만 검사

내가 단순히:

```text
QA
```

라고 하면 직전 변경범위만 빠르게 QA한다.

기본 확인:

- diff
- 문법
- 관련 selector/function
- DOM
- event
- state
- 새 breakpoint
- 새 `!important`
- 명백한 회귀
- 계산 변경이 있다면 결과 동일성

전체 프로젝트를 다시 분석하지 않는다.


## 3.6 `QA` 명령의 의미

사용자가:

```text
QA
qa
QA해줘
```

라고 하면 **직전 수정 결과를 검증한다.**

QA에서는 원칙적으로 파일을 수정하지 않는다.

확인 범위는 직전 변경의 위험도에 비례한다.

예:

```text
CSS 1 selector 수정
→ 해당 component + 직접 영향 viewport 중심

JS event 구조 수정
→ event/listener/runtime/state 관련 검증

계산식 수정
→ 계산 parity 강화

ES Module / 공통 core 수정
→ dependency/runtime 회귀 범위 확대
```

모든 QA를 무조건 전체 프로젝트 QA로 확대하지 않는다.


## 3.7 QA 판정과 수정 절차

QA 판정은 명확하게:

```text
PASS
```

또는:

```text
수정 필요
```

로 한다.

문제가 하나라도 확인되면 PASS라고 하지 않는다.

`수정 필요`일 때 보고:

- 문제
- 재현 조건
- 원인
- 최소 수정 방향

QA 도중 임의로 고치지 않는다.

실제 수정은 사용자가:

```text
수정해
```

라고 요청한 뒤 수행한다.

수정 후 다시 QA하여 PASS를 받아야 다음 차수의 기준본이 된다.


## 3.8 QA는 빠르고 변경범위 중심으로

단순 QA에서 브라우저 환경 구축이나 우회 테스트에 장시간 사용하지 않는다.

브라우저 테스트가 바로 되지 않으면:

1. 정적검증
2. diff
3. 문법
4. 관련 DOM
5. 가능한 최소 계산/렌더 검증
6. 미확인 사항 명시

후 종료한다.

전체 DOM/mock, 모든 viewport, 전체 기능 회귀는 내가 명시적으로 요청했을 때만 수행한다.


## 3.9 QA 검증 강도

단순 QA에서 시간을 과도하게 쓰기 위해 다음을 무조건 수행하지 않는다.

```text
전체 selector 전수검사
전체 browser automation 환경 구축
모든 기능 반복
모든 viewport pixel diff
전체 report/calc 재검증
```

다만 직전 변경이 공통 CSS, core, module graph, 계산식 등 영향도가 높은 영역이면 필요한 범위는 넓힌다.

환경 제약으로 실제 browser test가 안 되면:

1. 실제 시도 여부를 명확히 기록
2. 정적검증
3. module/runtime-aware 가능한 대체 검증
4. DOM/mock
5. baseline parity
6. 미확인 사항 명시

로 진행한다.

실제로 하지 않은 검증을 했다고 말하지 않는다.


## 3.10 전체 QA는 명시적으로 요청할 때만

내가 다음처럼 요청한 경우에만 전체 수준 검증을 수행한다.

```text
전체 QA
전체 구조 QA
리팩토링 점검
전체 DOM/mock 테스트
모든 viewport 검증
전체 회귀 테스트
```

이 경우에만 필요에 따라:

- 전체 CSS
- 메인 JS 7모듈
- calc
- report
- DOM
- 주요 viewport
- 전체 기능

까지 확장한다.


## 3.11 `전체 QA`는 별도 명령이다

다음은 단순 `QA`보다 넓은 요청으로 해석한다.

```text
전체 QA
전체 구조 QA
전체 DOM/mock 테스트
모든 viewport 검증
전체 회귀 테스트
최종 QA
```

필요에 따라 확인 범위를:

- CSS 전체
- 메인 JS 7모듈
- ES Module graph
- calc
- report
- 전체 주요 DOM
- 주요 state
- 주요 modal
- tables
- charts
- theme
- responsive

까지 확대한다.

`점수`는 **독립적인 점수 출력 명령**이고, `전체 QA`는 **검증 범위 명령**이라는 점을 구분한다. `모든 점수`는 단독 사용 시 `점수`의 호환 표현으로만 처리한다.


## 3.12 Responsive QA 대표 viewport

전체 또는 반응형 관련 QA에서 기본 대표 viewport:

```text
Desktop              1440 × 1000
Tablet                820 × 1180
Mobile                390 × 844
Small Mobile          320 × 568
Smartphone Landscape  844 × 390
```

필요시:

```text
iPhone Safari 데스크탑 웹사이트 요청
```

상태도 별도로 확인한다.

대표 viewport는 QA 기준이지 새 CSS breakpoint가 아니다.

확인 항목:

- unintended body overflow
- title row
- line wrap
- topbar
- table scroll
- sticky cell
- modal
- tooltip
- chart
- section-title / toggle 위치


## 3.13 Baseline parity 기본 항목

회귀 위험이 높은 수정에서 가능한 경우 직전 PASS 기준과 다음을 비교한다.

```text
계산값
KPI
row count
selected date
state
chart series
DOM 구조
listener 수
fetch 횟수
console/page error
duplicate ID
```

계산 관련 수정이면 가능한 범위에서 날짜 전체를 직렬화해 비교할 수 있다.

ES Module / event 변경이면:

```text
boot 1회
listener duplication 0
unresolved import 0
circular import 0
console error 0
page error 0
```

을 우선한다.


## 3.14 다음 차수의 기준본 관리

원칙:

> **QA PASS된 결과만 다음 차수의 기준본**

예:

```text
2차
→ QA FAIL
```

이면 해당 결과물을 3차 기준으로 사용하지 않는다.

반드시:

```text
수정해
→ 재QA
→ PASS
→ 다음 차수
```

순서를 거친다.

새 채팅에서도 과거 patch ZIP 여러 개를 이어 붙여 최신본을 추정하지 않는다.

항상 사용자가 첨부한 최신 전체 ZIP을 source of truth로 한다.


## 3.15 QA 중 임의 디자인 변경 금지

QA는 QA다.

QA 도중:

> 이쪽 간격을 조금 바꾸면 더 예쁘겠다.

같은 이유로 임의 수정하지 않는다.

QA에서는 다음만 확인/보고한다.

- 버그
- 회귀
- 구조 위반
- overflow
- 잘림
- 기능 오류
- breakpoint 문제
- 계산 오류

디자인 개선은 별도 작업으로 둔다.


## 3.16 작업 속도 보호

현재 구조를 보존하기 위해 매 수정마다 다음을 모두 검사하지 않는다.

- 전체 CSS 통계
- 모든 selector
- 메인 JS 전체 함수
- 모든 media query
- 전체 DOM/mock
- 모든 viewport
- 전체 브라우저 테스트

일반 수정에서는 관련 범위만 확인한다.

즉:

> **구조 보존은 상시 적용하지만 구조 전체를 매번 검사하지는 않는다.**


## 3.17 일반 수정 요청 처리 순서

일반적인 수정은 다음 순서로 처리한다.

```text
1. 최신 파일 확인
2. 요청과 관련된 책임 파일 특정
3. 관련 코드와 사용처 확인
4. 현재 구조 안에서 해결 가능한지 판단
5. 최소 변경
6. 새 breakpoint / !important / inline event / 중복 여부 확인
7. 문법 및 diff 확인
8. 결과 파일 생성
9. 종료
```

전체 QA는 하지 않는다.


## 3.18 차수형 대규모 작업을 새로 시작할 때 MD에 남길 최소 정보

새로운 큰 리팩토링/개선 작업을 시작해 여러 차수가 예정되면 이 문서의 최신 진행상태 섹션에 최소 다음만 기록한다.

```text
작업명
목표
절대 변경 금지
1차 범위
2차 범위
3차 범위
현재 완료 차수
마지막 QA PASS 기준본
다음 요청
특별 회귀 불변조건
```

모든 대화 내용을 그대로 붙여넣지 않는다.

이렇게 하면 채팅이 바뀌어도:

```text
최신 ZIP + 이 MD
```

두 개만으로 이어갈 수 있다.


## 3.19 대규모 JS 구조 작업의 차수 · QA · 보고 운영

이번 JS 3차 구조 리팩토링에서 실제로 사용한 작업 방식은 이후 유사한 대규모 JS 구조 작업의 기본 운영 방식으로 사용한다.

핵심 순서:

```text
1차 수정
→ QA
→ 2차 수정
→ QA
→ 3차 수정
→ QA
→ ...
→ 마지막 차수 QA
→ 누적 최종 QA
→ 필요 시 수정
→ 재 QA
→ 완료 기준선 확정
```

### A. 차수 요청의 의미

사용자가:

```text
1차
2차
3차
4차
5차
```

처럼 차수만 보내면 **해당 차수의 수정만 수행한다.**

이 단계에서는:

- 해당 차수 범위만 수정
- syntax / import / diff 등 결과물 전달에 필요한 최소 안전검사만 수행
- 전체 기능 QA나 전체 브라우저 회귀검사는 수행하지 않음
- 실제 변경 파일만 원래 프로젝트 경로대로 ZIP 전달
- 다음 요청을 `QA`로 안내

한다.

수정 답변에서 QA까지 자동으로 이어서 장시간 작업하지 않는다.

### B. `QA` 요청의 의미

사용자가 직전 차수 뒤에:

```text
QA
```

라고 보내면 **직전 차수 변경분을 중심으로 QA한다.**

JS 구조 작업의 기본 검증 항목:

```text
변경 범위
syntax
ES Module import / export
순환 dependency
unused import / export
state ownership
public API 경계
action routing
event listener ownership / 중복
DOM ownership
async / error path
기존 함수·계산·render parity
운영 JSON 변경 여부
```

모든 항목을 매번 기계적으로 최대 범위로 검사하는 것이 아니라 **직전 차수의 실제 변경 위험에 맞춰 검증 강도를 조절**한다.

예:

- state 이동 → 옛 state 참조 잔존 여부와 owner module 외 접근 확인
- module 분리 → 함수 누락, import/export, dependency, event 연결 확인
- network 변경 → 정상/404/500/invalid JSON/timeout path 확인
- 계산 core 변경 → 실제 전체 날짜 데이터로 기존 결과와 parity 비교
- render 구조 변경 → 기준본과 HTML/render output 비교

### C. QA FAIL 처리

QA에서 회귀를 찾으면 다음 차수로 넘어가지 않는다.

진행:

```text
QA FAIL
→ 원인 특정
→ 최소 수정
→ QA
→ PASS 확인
→ 다음 차수
```

FAIL을 숨기거나 점수를 유지하기 위해 문제를 축소해서 표현하지 않는다.

### D. 차수별 QA가 PASS해도 누적 최종 QA는 별도로 수행

여러 차수 작업에서는 **각 차수 QA PASS = 최종 PASS가 아니다.**

마지막에는 1차부터 마지막 수정까지 모두 합쳐진 누적 최종본 자체를 기준으로 다시 검증한다.

최종 누적 QA에서는 특히:

```text
전체 변경 파일 범위
전체 module graph
동일 module 내부 미정의 함수 / 심볼
action 종류 및 routing 누락
event 종류 / 중복
전체 public API 사용 여부
계산 parity
주요 render parity
문서와 실제 구조 일치
```

를 다시 본다.

이번 JS 3차 리팩토링에서는 1~5차 QA가 모두 진행된 뒤 최종 누적 QA에서 `dashboard-ui.js`의 `renderResultSummary()` 누락 1건을 추가로 발견했다.

따라서 앞으로도:

> **차수별 QA를 통과했더라도 마지막 누적 QA를 생략하지 않는다.**

를 기본 원칙으로 한다.

### E. 모듈 분리 판단 기준

파일 줄 수만 보고 분리하지 않는다.

분리 기준:

```text
책임이 실제로 다른가
응집도가 높아지는가
state ownership이 더 명확해지는가
dependency가 단순해지는가
public API가 줄어드는가
회귀 추적이 쉬워지는가
```

다음은 분리 이유로 충분하지 않다.

```text
파일이 1,000줄을 넘음
점수를 100으로 만들고 싶음
함수 수가 많음
파일 수가 적어 보임
```

현재 `dashboard-charts.js`와 `dashboard-pension-editor.js`는 파일 규모가 크더라도 각각 Chart subsystem과 Pension Editor transaction flow라는 응집된 책임을 갖고 있으므로, 줄 수만으로 추가 분리하지 않는다.

### F. State / DOM / Public API 운영 원칙

- 공유할 필요가 없는 runtime state는 owner module private으로 둔다.
- core는 data/state/calculation 중심으로 유지한다.
- 여러 UI 모듈이 공유하는 저수준 DOM helper는 `dashboard-ui-common.js`가 담당한다.
- 특정 모듈 내부 DOM 구조를 다른 모듈이 직접 알고 조작하지 않는다.
- 다른 모듈이 기능을 요청해야 하면 작은 공개 API 또는 module action dispatcher를 사용한다.
- `window` / `globalThis` 기반 bridge로 dependency를 우회하지 않는다.
- app은 세부 구현보다 cross-module orchestration에 집중한다.

### G. 결과물 전달 규칙

차수 수정이나 QA 후 수정 파일을 제공할 때:

1. **실제로 변경된 파일만** 넣는다.
2. 프로젝트의 **원래 경로를 유지한 ZIP**으로 제공한다.
3. 변경 파일이 1개여도 ZIP으로 제공한다.
4. ZIP 생성 후 **파일 수·내부 경로·압축 무결성**을 직접 확인한다.
5. 운영 JSON이 의도치 않게 포함되지 않았는지 확인한다.
6. 여러 차수 작업이 끝나면 요청 시 **1차부터 마지막 수정까지 합친 누적 변경 ZIP**을 만든다.
7. ZIP을 만들었다고 가정하지 말고 실제 파일 존재와 ZIP 내부 목록을 확인한다.

### H. 수정·QA 보고 방식

차수 수정 답변:

```text
수정한 목적
변경 파일
핵심 구조 변화
줄 수 / byte 변화
최소 안전검사 결과
다음 요청: QA
```

QA 답변:

```text
PASS / FAIL
변경 범위
검증 항목과 결과
발견 회귀와 영향
수정 필요 여부
다음 요청
```

최종 QA 답변에서는 필요하면 최초 구조 평가와 현재 구조 평가를 다시 비교한다.

구조 점수는 실제 구조와 회귀 결과를 설명하기 위한 보조 지표이며, 점수 자체를 맞추기 위해 불필요한 파일 분리나 framework 도입을 하지 않는다.


# 4. 현재 프로젝트 구조 · Architecture


## 4.1 2026-08-19 첨부 최신 ZIP 실제 구조 snapshot

아래는 이 문서를 재정비할 때 함께 확인한 최신 전체 ZIP의 실제 구조다. 이후 새 ZIP이 달라지면 **새 ZIP의 실제 파일을 우선**한다.

```text
investment-dashboard-main/
├─ .github/workflows/update-prices.yml
├─ .gitignore
├─ README.md
├─ add/
│  ├─ calc.html
│  ├─ css/common.css
│  ├─ css/calc.css
│  ├─ js/calc.js
│  └─ report/*.html
├─ css/style.css
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
│  ├─ dashboard-pension-editor.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-ui-common.js
│  └─ dashboard-ui.js
├─ main_dashboard_maintenance_handover.md
├─ requirements.txt
├─ scripts/update_prices.py
└─ start-local-server.bat
```

현재 확인된 메인 JS 참고 규모:

| 파일 | 줄 수 |
|---|---:|
| `dashboard-core.js` | 705 |
| `dashboard-ui-common.js` | 129 |
| `dashboard-charts.js` | 1,407 |
| `dashboard-ui.js` | 958 |
| `dashboard-pension.js` | 140 |
| `dashboard-pension-editor.js` | 1,158 |
| `dashboard-app.js` | 195 |

현재 `css/style.css`는 5,273줄이며, 이 수치는 **검증 시점 snapshot**일 뿐 고정값이 아니다.



## 4.2 현재 디렉토리 구조를 기준선으로 사용

현재 프로젝트는 개념적으로 다음 구조를 사용한다.

```text
investment-dashboard-main/
│
├─ index.html
│
├─ css/
│  └─ style.css
│
├─ js/
│  ├─ dashboard-core.js
│  ├─ dashboard-ui-common.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-pension-editor.js
│  └─ dashboard-app.js
│
└─ add/
   ├─ calc.html
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


## 4.3 메인 JavaScript는 현재 7파일 ES Module 구조 유지

현재 메인 JavaScript 구조는 다음과 같다.

```text
js/
├─ dashboard-core.js
├─ dashboard-ui-common.js
├─ dashboard-charts.js
├─ dashboard-ui.js
├─ dashboard-pension.js
├─ dashboard-pension-editor.js
└─ dashboard-app.js
```

이 7개는 파일 수를 늘리기 위한 분리가 아니라 다음 책임 경계를 표현한다.

```text
core            → 데이터 / 계산 / 공통 state / loading
ui-common      → 공통 저수준 DOM / 접근성 / 마크업 helper
charts          → 차트 state / SVG / chart action
ui              → 일반 UI / topbar / navigation / UI action
pension         → 퇴직연금 조회 View
pension-editor  → 퇴직연금 변경 Editor / persistence flow
app             → cross-module orchestration / boot
```

단순 수정 때문에 다시 하나의 거대한 JS 파일로 합치지 않는다.

반대로 책임 경계가 명확하지 않은 작은 기능마다 새 파일을 추가하지 않는다.


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


## 4.5 메인 상태 ownership 유지

현재 공유 state와 module-private state를 구분한다.

공유 state:

```text
dataState  → 현재 데이터 / activeDate 등
uiState    → 앱 전체에서 공유하는 UI 상태
```

module-private state:

```text
dashboard-charts.js
→ chartState
→ chartRuntimeState

dashboard-pension-editor.js
→ pensionEditorState

dashboard-pension.js
→ View 전용 tooltip binding state
```

`chartState`나 editor batch state를 다시 core/global로 올리지 않는다.

상태를 추가할 때는 **누가 사용하는가보다 누가 책임져야 하는가**를 기준으로 owner를 정한다.

새 global store / event bus / 거대한 단일 state 객체를 만들지 않는다.


## 4.6 `dashboard-ui.js`와 `dashboard-ui-common.js` 책임

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

- dialog focus / focus-trap / focus 복귀
- 공통 SVG navigation icon
- HTML escape
- 공통 swatch markup
- 증권·퇴직연금 공통 Asset Detail renderer
  - 현황 table/card shell
  - 비중 bar
  - 전일 대비 변동 KPI + table/card shell
  - 오늘 상승분 기여도
  - Asset tooltip interaction

### Asset Detail 공통 불변조건

- Asset Detail common layer는 각 자산 모듈이 계산한 neutral View Model을 받아 **표현만** 담당한다. 증권과 퇴직연금의 계산 로직을 common layer로 합치지 않는다.
- `dashboard-core.js`는 DOM-free를 유지하고 `dashboard-ui-common.js`는 화면별 기능 모듈을 역으로 import하지 않는다.
- 증권 `보유종목 현황`과 퇴직연금 `연금상품별 현황`, 양쪽 `전일 대비 변동`과 `오늘 상승분 기여도`는 같은 renderer/CSS 체계를 사용한다.
- 현황/변동 표는 공통 auto layout을 사용하며 컬럼별 고정 px/% 폭이나 `table-layout:fixed`를 새로 강제하지 않는다. 자산명 길이에 따른 실제 컬럼 폭 차이는 허용한다.
- 상품 행은 증권/연금 모두 **선택일 평가금액 내림차순**으로 정렬하고, 현금·현금성자산·합계 같은 비상품 행은 고정 위치를 유지한다.
- 모바일 상품명 브랜드 축약은 공통 helper/class를 사용한다. 퇴직연금은 `KODEX`, 증권은 `KODEX`·`KOACT/KoAct` 선두 prefix만 모바일에서 숨기고 웹·태블릿 원문은 유지한다.
- 증권 `보유종목 현황` summary는 `보유종목 합계 → 증권계좌 현금 → 총합계` 3단 구조를 유지한다.
- 증권계좌 현금은 장부 보정값이므로 증권 `전일 대비 변동`과 `오늘 상승분 기여도`에서는 제외한다. 퇴직연금 현금성자산은 운용자산이므로 기존처럼 포함한다.
- 누적/운용 수익률 카드의 `전일 대비` 보조 비율은 각 자산의 `하루 변동률`을 `%`로 표시하고, 본 누적/운용 수익률 계산은 변경하지 않는다.
- `400px 이하` 변동 table의 3열 축약 등 실제 좁은 폭 기능 예외는 현재 구현을 유지하며 다른 화면에 확대 적용하지 않는다.

### 성과 요약 · 계좌별 불변조건

- 증권과 퇴직연금 상단 KPI는 공통 **`성과 요약` shell**을 사용하며 기본 vertical rhythm과 title/action 구조를 공유한다.
- 증권만 `전체 / 계좌별` 전환을 제공한다. 계좌별은 별도 섹션을 만들지 않고 같은 overview 안에서 table/card view로 전환한다.
- 계좌별 table의 기본 열 순서는 `구분 → 투자 결과물 → 투입원금 → 누적손익 → 누적수익률 → 메모`다. 모바일 카드도 `투자 결과물 → 투입원금` 순서와 용어를 맞춘다.
- 각 계좌의 `투입원금`·`투자 결과물`은 성과 기준값(A)과 장부 조정값(B)을 2단으로 표시한다. 합계 행은 각 계좌의 `A + B`를 합산한 최종 장부값을 직접 표시하고, `전체` 카드의 투자 결과물·투입원금·누적수익률과 일치해야 한다.
- 별도수익 상태는 기존 `separateProfitView()`의 재분류 기준을 따른다. 개인 기능 비활성 상태에서는 개인 기능의 존재를 직접 드러내는 표현을 쓰지 않는다.
- 계좌1 투입원금 조정 B의 중복 제거 근거는 `레버수익 재투입 + VIP 수익 재투입 + 실현수익 투입`이다. `원천·보유 차액`은 성과기준 투입원금에는 남기되 조정 B 근거에서는 제외한다.
- 삼성증권2 투자 결과물 조정은 VIP 재투입액 중복 제거이며, 원천 추적의 `VIP 금 투입분 + VIP 재투입-금` 관계와 연결된다.
- `투자원금 원천 및 검산`은 기존 3단 카드 구조를 유지한다. base 원천과 재투입 원천을 구분하되 `원천·보유 차액`은 양쪽 표에서 중립 검산값으로 표시한다.
- `2026-06-18` 이후 전체 성과 카드의 누적손익 설명은 `투자 결과물 - 투입원금`, 이전 복원 구간은 `전체 누적 성과 기준`처럼 중립적으로 표시한다. 과거 수치를 설명에 맞추기 위해 재계산하지 않는다.
- 계좌별 모바일 table은 누적수익률을 누적손익 셀의 보조값으로 합쳐 5열로 축약하고, `400px 이하`에서는 메모 내용을 정보 버튼으로 전환한다. 모바일 카드의 메모는 카드 폭에 맞춰 자연스럽게 줄바꿈한다.
- 성과 요약 title/action은 기존 `.section-title`, `.section-title-icon`, `.chart-head-actions`, segmented/button, mobile table/card control을 재사용한다. 증권 성과 요약에서 별도수익 control은 `전체 / 계좌별` 왼쪽에 두고, 모바일에서는 표/카드 보기 control이 가장 왼쪽에 온다.

화면별 계산이나 특정 기능 전용 modal/action을 `dashboard-ui-common.js`로 보내지 않는다.

## 4.7 `dashboard-charts.js` 책임

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


## 4.8 퇴직연금 View / Editor 책임

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
- batch queue / simulation / apply
- 저장 / 삭제
- Google Apps Script persistence
- editor event delegation

View와 Editor를 다시 하나의 `dashboard-pension.js`로 합치지 않는다.


## 4.9 `dashboard-app.js` 책임

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


## 4.10 메인 JS의 파일 간 책임을 함부로 섞지 않는다

예를 들어:

```text
차트 계산/DOM/action → charts
Topbar/Navigation/UI action → ui
공통 저수준 UI helper → ui-common
퇴직연금 조회 View → pension
퇴직연금 변경/저장 → pension-editor
앱 boot/cross-module orchestration → app
```

처럼 책임을 유지한다.

한 기능을 수정하기 위해 4~5개의 JS 파일을 동시에 건드려야 하는 구조를 새로 만들지 않는다.

그렇게 해야만 구현되는 요청이라면 구조가 잘못된 방향인지 먼저 검토한다.


## 4.11 현재 구조별 수정 위치 기준

향후 수정 시 기본적으로 다음 책임을 참고한다.

```text
메인 CSS
→ css/style.css

데이터 / 공통 계산 / formatter / 공용 데이터 state
→ js/dashboard-core.js

공통 저수준 DOM / 접근성 / 마크업 helper
→ js/dashboard-ui-common.js

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


## 4.12 현재 ES Module dependency graph

현재 dependency 방향은 다음과 같다.

```text
ui-common       → core
charts          → core + ui-common
ui              → core + ui-common + charts
pension         → core + ui-common + charts + ui
pension-editor  → core + ui-common + ui
app             → core + ui-common + charts + ui + pension + pension-editor
```

계층 원칙:

```text
core
↑
ui-common
↑
기능 모듈(charts / ui / pension / pension-editor)
↑
app
```

`ui`가 chart rendering을 포함하는 화면 조합을 위해 charts를 사용하고, pension View가 공통 card/UI helper를 위해 ui를 사용하는 현재 방향은 허용한다.

반드시 유지할 불변조건:

```text
core → DOM/UI module import 금지
ui-common → 화면별 기능 module import 금지
charts → ui 역참조 금지
하위 module → app import 금지
pension View ↔ pension-editor 상호 import 금지
circular import = 0
```

새 dependency가 필요하면 현재 방향 안에서 자연스럽게 표현할 수 있는지 먼저 판단한다.


## 4.13 ES Module import / export 운영 규칙

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


## 4.14 `index.html` module entry와 cache bust 정책

현재 `index.html`은 메인 JS 7개를 classic script로 순서대로 load하지 않는다.

현재 구조:

```text
importmap
+
<script type="module" src="js/dashboard-app.js?...">
```

`index.html`에서 `Date.now()`를 기준으로 module dependency와 app entry에 동일 계열 cache bust를 적용한다.

중요:

- 신규 module을 추가/이름 변경할 때 importmap 누락 여부 확인
- cache bust 정책을 기능 수정과 함께 임의 변경하지 않음
- importmap을 단순히 불필요해 보인다는 이유로 제거하지 않음
- static import path는 현재 `.js` 상대경로 유지
- module 전환과 무관한 viewport/theme 초기화 inline script는 함부로 변경하지 않음
- 다시 classic script 다중 load 구조로 돌아가지 않음



## 4.15 현재 JS state / initialization ownership

상태는 공유 필요성에 따라 owner를 명확히 둔다.

```text
dataState
→ core / 앱 공통 데이터 상태

uiState
→ core / 여러 모듈이 공유하는 UI 상태

chartState + chartRuntimeState
→ dashboard-charts.js private

pensionEditorState
→ dashboard-pension-editor.js private

pension View tooltip binding state
→ dashboard-pension.js private
```

새 기능 때문에:

```text
새 global store
event bus
framework state manager
하나의 거대한 state
window/globalThis state bridge
```

를 만들지 않는다.

현재 app은 단일 module entry에서 boot된다.

반복 render 때문에 실제로 필요한 listener/tooltip/chart guard는 owner module 안에서 관리한다.

퇴직연금 dashboard 재렌더 연결은 editor setup 단계의 명시적 `renderDashboard` callback dependency를 유지한다.


## 4.16 현재 ES Module 구조와 단일 entry를 유지한다

현재 메인 JavaScript는 **7개 ES Module + `dashboard-app.js` 단일 entry** 구조로 동작한다.

현재 기본 구조:

```text
index.html
└─ <script type="module" src="js/dashboard-app.js?...">

core
↑
ui-common
↑
├─ charts
├─ ui ──→ charts
├─ pension ──→ charts + ui
├─ pension-editor ──→ ui
└─ app ──→ charts + ui + pension + pension-editor
```

실제 dependency는 named `import / export`로 표현하며 circular import는 허용하지 않는다.

단순 기능 수정 과정에서 다음으로 다시 구조를 변경하지 않는다.

```text
classic script 다중 load
window/globalThis compatibility bridge
React
Vue
TypeScript
Webpack/Vite
npm/bundler 프로젝트화
새 framework
```

특히 ES Module 문제를 우회하기 위해:

```js
window.someFunction = ...
globalThis.dashboard = ...
```

같은 임시 global bridge를 만들지 않는다.

새 구조 개편은 사용자가 별도로 요청한 경우에만 검토한다.


# 5. CSS · Responsive 유지보수 규칙


## 5.1 메인 CSS는 `css/style.css` 단일 파일 유지

메인 투자 성과 대시보드 CSS는:

```text
css/style.css
```

**하나의 파일로 유지한다.**

다음처럼 역할별 CSS 파일로 다시 분리하지 않는다.

```text
base.css
layout.css
components.css
charts.css
pension.css
responsive.css
...
```

현재 프로젝트에서는 단일 CSS 안에서 cascade와 관련 규칙을 함께 추적하는 것이 더 안전하다.

특히 별도의:

```text
responsive.css
```

를 만들지 않는다.


## 5.2 메인 CSS는 기능별 영역 안에서 반응형까지 함께 관리

각 기능의 CSS는 가능한 한 해당 기능 영역 안에서:

```text
기본
↓
Desktop · 웹
↓
Tablet · 태블릿
↓
Mobile · 모바일
↓
기능상 필요한 예외
```

를 같이 관리한다.

예:

```css
/* =========================================================
   Charts · 차트
   ========================================================= */

.chart-card {
  ...
}

/* Tablet · 태블릿 */
@media (min-width:761px) and (max-width:1100px) {
  ...
}

/* Mobile · 모바일 */
@media (max-width:760px) {
  ...
}
```

다음처럼 같은 기능의 CSS가 파일 여러 곳에 다시 흩어지지 않게 한다.

```text
기본 CSS
→ 파일 한참 아래 tablet fix
→ 맨 아래 mobile fix
→ 마지막 final override
```


## 5.3 CSS 섹션과 주요 주석은 영어 + 한글 병기

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


## 5.4 반응형 기본 viewport는 3구간 고정

메인 대시보드 기본 viewport는 다음과 같다.

- **Desktop · 웹:** `1101px 이상`
- **Tablet · 태블릿:** `761px ~ 1100px`
- **Mobile · 모바일:** `760px 이하`

새로운 UI를 추가하거나 수정할 때 기본적으로 이 세 구간 안에서 해결한다.


## 5.5 불필요한 추가 breakpoint 금지

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

현재 허용된 기능상 예외 breakpoint 중 `1280px 이하`는 **공통 Asset Detail 기능 breakpoint**다. 증권의 `보유종목 현황 + 전일 대비 변동`과 퇴직연금의 `연금상품별 현황 + 전일 대비 변동`이 Desktop에서 2열로 배치되다가 `1280px 이하`에서 1열로 전환하여 표 내부 가로 스크롤을 방지한다. 이 규칙은 `.asset-detail-grid`의 공통 기능 기준이며, 다른 일반 영역의 반응형 breakpoint로 확대 적용하지 않는다. 새 증권 전용 breakpoint도 만들지 않는다.

공통 Asset Detail CSS는 기존 generic class/token을 우선 재사용하고, 실제로 양쪽 자산이 공유하는 의미에만 최소 `.asset-*` semantic class를 사용한다. 현황/전일변동/상승분기여도에서 공통화된 selector는 neutral `.asset-*`가 canonical이며, 같은 역할의 `.pension-*` legacy alias를 병렬로 유지하지 않는다. 위험자산 70% 룰·퇴직연금 조정/PIN/납입 등 연금 전용 UI는 계속 `.pension-*`를 사용한다.



## 5.6 특정 viewport 스크린샷 맞춤식 수정 금지

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


## 5.7 미관 문제와 실제 문제를 구분

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


## 5.8 CSS 추가보다 기존 규칙 수정·통합 우선

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


## 5.9 동일 selector override 누적 금지

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


## 5.10 `!important` 사용 정책

새로운 `!important`는 원칙적으로 추가하지 않는다.

현재 메인 CSS는 과거 대량의 `!important`를 대부분 제거하여 정상 cascade 구조로 정리된 상태다.

단순 specificity 해결 수단으로 사용하지 않는다.

허용 가능한 대표 사례:

- 브라우저 고유 UI
- Safari / WebKit intrinsic control
- 명시적인 `[hidden]`
- `prefers-reduced-motion`
- 정상 cascade만으로 해결하기 어려운 명확한 브라우저 예외

새 `!important`가 필요하다면 먼저:

1. 기존 구조 수정으로 해결 가능한지
2. specificity 정리로 가능한지
3. 실제로 강제 우선순위가 필요한지

확인한다.


## 5.11 디자인 토큰과 CSS variable 우선 재사용

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



## 5.12 증권·퇴직연금 KPI 모바일 2열 규칙

증권·퇴직연금의 `성과 요약` 4개 KPI 카드는 모바일(`<=760px` 및 실제 스마트폰 가로모드)에서만 `2 × 2` grid를 유지한다. 다른 `.metric-grid`에는 이 규칙을 확대 적용하지 않는다.

모바일 KPI 타이포 기준:

```text
라벨 11px
값 18px
설명 10px
```

세 요소는 한 줄 유지한다. 모바일 전용 축약 설명이 필요한 경우 `metricCard()`의 mobile sub variant를 사용하고, 데스크톱/태블릿 설명을 CSS로 억지 축소하거나 ellipsis 처리하지 않는다.

## 5.13 Topbar 날짜 셀렉트 폭 정합성

Topbar의 `년/월`과 `일` 셀렉트는 모든 viewport에서 **동일한 가로 폭 체계**를 유지한다. Desktop / Tablet은 두 셀렉트 모두 `148px`, Mobile은 두 셀렉트가 동일한 반응형 계산폭(`max 148px`)을 사용한다. 한쪽만 별도 고정폭으로 축소하지 않는다.

# 6. JavaScript 구현 세부 규칙


## 6.1 Inline event handler 재도입 금지

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


## 6.2 Event handler에 비즈니스 로직을 과도하게 넣지 않는다

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


## 6.3 JavaScript에서 UI 스타일 직접 지정 최소화

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


## 6.4 JS 중복 로직 추가 금지

새 함수를 만들기 전에 기존 helper가 있는지 확인한다.

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


# 7. Calc · Report 유지보수 규칙


## 7.1 Calc는 메인과 독립된 부가 기능으로 유지

현재 계산기는 다음 구조로 분리되어 있다.

```text
add/
├─ calc.html
├─ css/
│  ├─ common.css
│  └─ calc.css
└─ js/
   └─ calc.js
```

계산기 수정 때문에 메인:

```text
css/
js/
```

구조를 변경하지 않는다.

반대로 메인 기능 수정 때문에 `add/calc.*`를 건드리지 않는다.

두 영역의 코드가 우연히 비슷하다는 이유만으로 억지로 공통화하지 않는다.


## 7.2 Calc의 HTML / CSS / JS 책임 분리 유지

현재:

```text
add/calc.html
→ HTML 구조

add/css/calc.css
→ 계산기 전용 스타일

add/js/calc.js
→ 계산 / validation / rendering / event
```

책임을 유지한다.

다시 `calc.html` 안에 대규모:

```html
<style>...</style>
<script>...</script>
```

블록을 넣지 않는다.

새 계산기 CSS는 `add/css/calc.css`에,

새 계산기 JavaScript는 `add/js/calc.js`에 둔다.


## 7.3 Calc 계산 구조 유지

계산기의 기본 흐름은:

```text
Input · 입력
↓
Validation · 검증
↓
Calculation · 계산
↓
Result · 결과
↓
Rendering · 화면 출력
```

이다.

특히 핵심 `compute()`는 DOM과 분리된 계산 함수 성격을 유지한다.

계산 함수 안에서 새로:

```js
document...
classList...
textContent...
innerHTML...
```

등을 직접 조작하지 않는다.


## 7.4 Calc Validation 구조 유지

Validation은:

```text
validation 규칙
↓
validation 결과
↓
UI 표시
```

로 분리된 현재 구조를 유지한다.

검증 함수가 다시:

```text
오류 판단
+
invalid class 직접 변경
+
오류 문구 직접 출력
```

까지 모두 담당하게 만들지 않는다.


## 7.5 Calc JS는 현재 단일 `calc.js` 유지

현재 계산기 JS 규모에서는:

```text
add/js/calc.js
```

하나의 파일이 적절하다.

다시:

```text
calc-core.js
calc-ui.js
calc-validation.js
calc-events.js
...
```

처럼 과도하게 분할하지 않는다.


## 7.6 Calc CSS와 메인 CSS를 통합하지 않는다

```text
css/style.css
```

는 메인 대시보드 전용이다.

```text
add/css/common.css
add/css/calc.css
```

는 부가 페이지 영역이다.

비슷한 card나 button이 있다는 이유만으로 CSS를 서로 이동하거나 공통화하지 않는다.


## 7.7 Calc 모바일 KPI 설명은 강제 ellipsis로 다시 자르지 않는다

계산기의 모바일 KPI/미니카드 하단 설명은 좁은 화면에서 필요한 경우 자연스럽게 줄바꿈되도록 현재 구조를 유지한다.

다시:

```css
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

를 이용해 중요한 설명문을 `...`으로 잘라내지 않는다.

특히:

- 기존 보유분 투자금액 설명
- 추가매수 당일 종가 설명

등 사용자가 읽어야 하는 정보는 카드 안에서 정상적으로 표시되어야 한다.


## 7.8 Report 영역 구조 보존

Report는:

```text
add/report/
```

안에서 독립적으로 관리한다.

공통 CSS가 필요한 경우 현재:

```text
add/css/common.css
```

를 활용한다.

Report UI 수정 시 다시:

```text
기본
→ 모바일 fix
→ iPhone fix
→ final
→ !important
```

식으로 patch를 누적하지 않는다.

기존 규칙 자체를 수정·통합한다.


## 7.9 공통화는 실제 공통일 때만 수행

공통화 자체를 목표로 하지 않는다.

먼저:

- 정말 두 곳 이상에서 같은 책임인가
- 앞으로 같이 변경될 가능성이 있는가
- 공통화 후 결합도가 오히려 높아지지 않는가

를 판단한다.

메인과 calc처럼 독립적인 영역의 코드가 우연히 비슷하다는 이유만으로 공통화하지 않는다.


# 8. 운영 데이터 · GitHub Actions · GAS


## 8.1 운영 JSON과 외부 write 보호

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


## 8.2 Google Apps Script(GAS) 운영 및 배포 원칙

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


## 8.3 현재 Workflow 날짜 입력 의미

현재 `.github/workflows/update-prices.yml`의 실제 설명은 다음 의미와 일치한다.

```text
날짜 지정
→ 해당 날짜 갱신

날짜 비움
→ 최신·누락·장중 재확정 대상 날짜를 Python이 자동 판단
```

`비워두면 한국시간 오늘`이라는 과거 설명으로 되돌리지 않는다.

Python / Workflow 유지보수 구조:

- `scripts/update_prices.py`는 `설정·공통 helper → 시장 데이터 조회 → 대상일 판단 → 포트폴리오 계산 → 저장/CLI` 순서의 섹션 구조를 유지한다.
- 반복되는 날짜 형식, 조회 재시도, HTTP timeout/User-Agent 같은 실행 설정은 상수로 관리하고 함수 안에 같은 magic value를 중복하지 않는다.
- `.github/workflows/update-prices.yml`은 `trigger → permission → runtime setup → updater 실행 → 생성 데이터 commit` 흐름을 유지한다.
- Workflow가 자동 commit하는 운영 데이터는 `data/prices.json`, `data/performance_snapshots.json` 두 파일로 한정하며 다른 운영 JSON을 함께 `git add`하지 않는다.


# 9. UI · Responsive · 반복 회귀 불변조건


## 9.1 최신 반응형 기준과 iPhone 데스크탑 웹사이트 요청

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
  and (max-width:900px)
  and (max-height:500px)
  and (hover:none)
  and (pointer:coarse)
```

이 media는 특정 844px 기기 맞춤식 patch가 아니라 실제 coarse-pointer 스마트폰 가로를 식별하기 위한 기능 media다.

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


## 9.2 Section Title / ON·OFF 버튼 높이 최신 불변조건

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


## 9.3 반복 회귀 이력이 있는 UI/기능 상시 불변조건

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

메인 `dashboard-data-table` 정렬은 개별 표 override보다 공통 semantic utility를 우선한다. 숫자 의미와 정렬 책임은 분리한다.

```text
.num               → 숫자 표현 품질(tabular-nums / nowrap)만 담당, 정렬하지 않음
.table-cell-text   → 좌측 정렬
.table-cell-right  → 우측 정렬
.table-cell-center → 가운데 정렬
```

- `.num`에 `text-align`을 넣지 않는다. 숫자 값의 정렬은 `table-cell-right` 또는 `table-cell-center`로 명시한다.
- 문자형 셀과 정렬 예외는 semantic class로 제어하고, 컬럼 위치 기반 `nth-child`에 의존하지 않는다.
- 일반 숫자 값은 우측 정렬을 기본으로 하되, UI상 가운데 정렬이 필요한 값은 `table-cell-center`를 명시한다.
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

누적차트 하단 날짜 이동 카드는 즉시 날짜를 바꾸지 않고 확인 modal을 거친 뒤 이동하며, mouse / keyboard 모두 같은 flow를 사용한다.

listener 중복 또는 chart 이중 생성은 FAIL이다.


## 9.4 계좌별 성과 메모 툴팁 현재 불변조건

계좌별 성과 메모 동작은 `js/dashboard-ui.js`가 소유하며 차트 tooltip 구현과 섞지 않는다.

현재 불변조건:

- `400px 이하`에서는 메모 헤더 `메모`를 유지하고 각 행의 메모 내용만 정보 버튼으로 전환한다.
- 정보 버튼의 floating tooltip은 table stacking context에 가려지지 않도록 body 레벨에서 표시하고, viewport를 벗어나지 않게 위치를 보정한다.
- outside click / ESC / scroll / resize 등에서 열린 tooltip 상태를 정리한다.
- `401px 이상`에서는 메모 텍스트를 직접 표시한다. 모바일 table view에서는 문장 단위 흐름을 유지하고, 모바일 card view에서는 카드 폭에 맞춰 자연스럽게 줄바꿈한다.
- 계좌 메모 전용 class/action은 `accounts-memo-*` 계열을 사용하며 chart 전용 tooltip class를 재사용하지 않는다.

이 기능을 수정할 때 계좌 메모 전용 동작을 `dashboard-charts.js`로 옮기지 않는다.

## 9.5 개인보기 3회 클릭 제스처 평가·유지 원칙

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


# 10. 수정 원칙 · Diff · 결과 파일 전달


## 10.1 과도한 리팩토링 금지

기능 수정 요청을 받았다고 관련 없는 영역까지 리팩토링하지 않는다.

예:

> 버튼 하나 수정

요청인데:

```text
전체 Topbar 재작성
JS 파일 재분리
CSS 변수명 전체 변경
state 구조 재설계
```

등으로 작업 범위를 확대하지 않는다.

현재 요청에 필요한 최소 범위만 수정한다.

추가 구조 개선이 필요하다면 이번 작업에 섞지 말고 별도 제안한다.


## 10.2 사용자의 요청이 현재 구조를 훼손하면 작업 중지

이 규칙은 매우 중요하다.

내가 요청한 방법 자체가 다음 문제를 만든다고 판단되면 바로 파일을 수정하지 않는다.

- 불필요한 새 breakpoint 필요
- `!important` 다수 추가 필요
- 동일 selector override 누적 필요
- 특정 해상도 전용 임시 patch 필요
- 공통 component 파괴
- 디자인 token 무시
- 메인 JS 책임 경계 파괴
- `dashboard-core.js`에 DOM 조작 추가
- `dashboard-app.js`에 복잡한 기능 구현 누적
- inline event 재도입
- 같은 기능을 여러 JS 파일에 중복 구현
- calc의 계산/validation/render 분리 구조 파괴
- calc CSS/JS를 다시 HTML inline으로 합침
- 메인과 `add/` 영역을 불필요하게 결합
- 현재보다 유지보수성이 명백하게 악화
- 다른 viewport나 기능에 높은 회귀 위험 발생

이 경우 작업을 중지하고 다음 형식으로 먼저 알려준다.

```text
이 요청을 그대로 구현하면 현재 리팩토링 구조를 훼손할 가능성이 있습니다.

문제
- 어떤 구조가 깨지는지
- 왜 유지보수성이 나빠지는지
- 예상되는 회귀 위험

권장 대안
- 현재 구조를 유지하면서 같은 목적을 달성하는 방법
```

단순히 구현하기 어렵다는 이유로 중지하지 않는다.


## 10.3 수정 전 영향 범위는 필요한 만큼만 확인

파일을 수정하기 전에 관련:

- selector
- function
- state
- DOM
- action
- helper

사용처를 확인한다.

특히 공통 class/helper를 수정하면 영향을 받는 직접 사용처를 확인한다.

다만 매번 프로젝트 전체를 전수 분석하지 않는다.

원칙:

> **변경 대상의 직접 사용처와 영향을 받을 가능성이 높은 범위만 확인한다.**


## 10.4 새 코드 적용 후 불필요한 예전 코드 제거

새 구조를 적용한 뒤 예전 workaround가 필요 없어졌다면 같이 제거한다.

다음처럼 남기지 않는다.

```text
기존 코드
+
새 코드
```

가능하면:

```text
기존 코드 수정 또는 제거
→ 최종 코드 하나
```

만 남긴다.


## 10.5 Diff 검사 필수

수정 완료 후 변경 파일의 diff를 확인한다.

확인 항목:

- 요청한 부분만 변경됐는지
- 무관한 코드가 포맷팅되지 않았는지
- 기존 기능이 실수로 삭제되지 않았는지
- 같은 목적 코드가 이중으로 남지 않았는지
- 이전 workaround가 불필요하게 남아 있지 않은지
- 다른 책임 파일을 불필요하게 건드리지 않았는지

전체 프로젝트 diff가 아니라 변경 파일 중심으로 확인한다.


## 10.6 CSS 수정 후 기본 보고

메인 `css/style.css`를 수정했다면 다음을 보고한다.

- 수정 전 전체 줄 수
- 수정 후 전체 줄 수
- 증감 줄 수
- 수정 전 파일 크기
- 수정 후 파일 크기
- 증감 크기
- 새 `!important` 수
- 새 breakpoint 여부
- 동일 목적 selector override 추가 여부
- 예상 외 diff 여부

코드 줄 수 감소 자체를 목표로 하지 않는다.

새 기능 때문에 CSS가 늘어나는 것은 정상이다.

중요한 것은:

> **구조적으로 올바르게 증가했는가**

이다.


## 10.7 JS 수정 후 기본 보고

메인 JS를 수정했다면 다음을 간단히 보고한다.

```text
변경한 JS 파일:
주요 변경 함수:
새 state 추가:
새 전역 변수:
새 inline event:
다른 책임 파일 변경:
예상 외 diff:
```

정상 목표는 상황에 따라 다음과 같다.

```text
새 inline event: 0
불필요한 전역 변수: 0
관련 없는 JS 파일 변경: 없음
예상 외 diff: 없음
```

특히 어떤 기능을 어느 책임 파일에 넣었는지 알려준다.


## 10.8 Calc 수정 후 기본 보고

계산기를 수정했다면 다음을 알려준다.

```text
변경 파일:
계산 공식 변경:
Validation 변경:
UI 변경:
새 breakpoint:
새 !important:
메인 css/js 변경:
예상 외 diff:
```

기능 추가가 아닌 UI 수정이라면 계산 공식은 원칙적으로 변경하지 않는다.


## 10.9 새로운 breakpoint / `!important` 발생 시 별도 보고

새 breakpoint나 `!important`가 생겼다면 반드시 이유를 설명한다.

예:

```text
새 breakpoint: 없음
새 !important: 없음
```

또는:

```text
새 breakpoint: 1개

이유:
기존 3개 viewport 규칙만으로 실제 기능 문제를 해결할 수 없어 추가함.
```

설명할 수 없는 예외는 추가하지 않는다.


## 10.10 변경 파일만 전달

수정 후 ZIP을 제공한다면 **실제로 변경된 파일만 포함**한다.

변경 파일이 하나여도 프로젝트 폴더 구조를 유지한다.

예:

```text
patch/
└─ js/
   └─ dashboard-charts.js
```

또는:

```text
patch/
└─ add/
   ├─ calc.html
   └─ js/
      └─ calc.js
```

변경되지 않은 전체 프로젝트를 다시 압축할 필요는 없다.


## 10.11 계산 로직 수정은 UI보다 엄격하게 검증

다음 영역을 수정한다면 조금 더 엄격하게 확인한다.

- 수익률
- 손익
- 투자원금
- 현금
- 퇴직연금
- 자산배분
- calc 계산식

가능한 경우 동일 입력값 기준 전후 결과를 비교한다.

계산 함수는 DOM과 분리된 구조를 유지한다.


## 10.12 공통 코드 변경은 더 신중하게

다음과 같은 공통 영역은 여러 기능에 영향을 줄 수 있다.

예:

```text
css/style.css의 공통 component
dashboard-core.js의 formatter/helper
공통 date helper
공통 table/card renderer
add/css/common.css
```

단일 화면 문제를 해결하기 위해 공통 코드를 섣불리 변경하지 않는다.

공통 변경이 필요하면 직접 영향을 받는 사용처를 필요한 범위에서 먼저 확인한다.


## 10.13 신규 기능 추가 시 판단 순서

새 기능 요청을 받으면 내부적으로 다음 순서로 판단한다.

#### 1
이 기능은 어느 책임 영역에 속하는가

#### 2
기존 component/helper/state/action으로 구현 가능한가

#### 3
현재 3개 viewport 규칙 안에서 해결 가능한가

#### 4
기존 CSS/JS 규칙을 수정하면 되는가

#### 5
새 class/function/state/action이 정말 필요한가

#### 6
새 breakpoint, `!important`, inline style 같은 예외가 정말 필요한가

이 순서를 거친 뒤 구현한다.


## 10.14 구조 보존을 이유로 과도하게 소극적이지 않는다

기존 구조 안에서 정상적으로 구현 가능한 요청이라면 바로 수행한다.

매번:

> 구조를 변경해도 될까요?

라고 확인하지 않는다.

**명백하게 현재 구조를 훼손하는 경우에만 작업을 중지하고 대안을 제시한다.**


## 10.15 최우선 판단 기준

모든 수정의 우선순위는 다음과 같다.

#### 1순위
기존 기능과 계산 결과가 정확하게 유지되는가

#### 2순위
현재 리팩토링된 책임 구조가 유지되는가

#### 3순위
기존 component / helper / state / action을 재사용하는가

#### 4순위
최소 범위로 수정했는가

#### 5순위
코드가 읽기 쉽고 명확한가

#### 6순위
코드 양이 적은가

코드 줄 수 감소는 가장 낮은 우선순위다.


## 10.16 차수 결과 파일 전달과 통계

차수 수정 후 기본 전달 방식:

> **실제로 변경된 파일만 원래 프로젝트 폴더 구조를 유지해 ZIP으로 제공**

예:

```text
investment-dashboard-main/
└─ css/
   └─ style.css
```

또는:

```text
investment-dashboard-main/
├─ index.html
└─ js/
   ├─ dashboard-core.js
   └─ dashboard-app.js
```

변경되지 않은 파일을 억지로 포함하지 않는다.

각 변경 파일별 보고:

```text
수정 전 line
수정 후 line
증감 line
수정 전 byte
수정 후 byte
증감 byte
```

그리고:

```text
예상하지 않은 diff
대량 formatting
CSS 변경 여부
JS 변경 여부
운영 JSON 변경 여부
```

를 명시한다.

또한 **파일 수정 작업을 완료해 결과 파일을 전달할 때는 GitHub 커밋에 바로 사용할 `Summary`와 `Description`을 함께 제공한다.**

기본 형식:

```text
Summary: 변경 핵심만 매우 짧게 작성
Description: 주요 변경 내용을 간단히 설명
```

작성 원칙:

- `Summary`는 기존보다 더 짧게, 커밋 제목 수준으로 작성한다.
- `Description`은 기존 Summary 수준의 간단한 설명으로 작성한다.
- 둘 다 실제 수정된 내용만 반영한다.
- QA 결과나 상세 작업내역을 길게 넣지 않는다.
- 여러 파일을 수정했더라도 하나의 커밋 단위로 간결하게 작성한다.
- 사용자가 별도 커밋 문구 형식을 지정하면 그 형식을 우선한다.

또한 사용자가 대화 중 **앞으로 반복 적용할 유지보수 규칙, 수정 조건, QA 조건, 파일 전달 방식 등의 운영 조건을 추가하거나 변경하면**, 별도로 문서 반영을 다시 지시하지 않아도 **`main_dashboard_maintenance_handover.md`에 해당 내용을 자동 반영한다.**

운영 조건 자동 반영 원칙:

- 일회성 작업 지시는 장기 운영 규칙으로 확대해 기록하지 않는다.
- 앞으로 반복 적용할 명확한 조건만 반영한다.
- 기존 규칙과 충돌하면 최신 사용자 지시를 우선하고 기존 관련 문구도 함께 갱신한다.
- 같은 의미의 규칙을 새 섹션으로 중복 추가하지 않고 기존 관련 항목에 통합한다.
- 운영 조건 반영 때문에 요청과 무관한 코드나 프로젝트 파일까지 수정 범위를 넓히지 않는다.


# 11. 리팩토링 이력 · 역사적 기준선


## 11.1 역사 기록의 사용 원칙

이 장의 수치와 PASS 기록은 당시 작업의 **역사적 snapshot**이다. 최신 소스의 현재 점수나 현재 줄 수를 고정하는 값이 아니다. 새 `점수` 또는 `평가` 요청에서는 반드시 최신 전체 ZIP을 다시 확인한다.


## 11.2 지금까지의 주요 리팩토링 이력

현재 프로젝트는 대략 다음 순서로 발전했다.

### 1번째 · CSS 최적화 / 구조 리팩토링

핵심:

- 메인 CSS를 `css/style.css` 단일 canonical 파일로 정리
- cascade / specificity 정리
- 중복 selector / override 축소
- 불필요한 `!important` 축소
- 반응형을 기본 3구간 중심으로 정리
- Topbar / Chart / Modal / Table / Tooltip 등 영역별 CSS 책임 정리
- design token / theme 구조 정리

이 단계 이후 CSS는:

> **새 patch를 파일 하단에 누적하기보다 기존 canonical rule을 직접 수정**

하는 것이 기본 원칙이 됐다.

### 2번째 · JavaScript 5분할 리팩토링

기존 통파일 JS를 다음 5개 책임 파일로 분리했다.

```text
dashboard-core.js
dashboard-charts.js
dashboard-ui.js
dashboard-pension.js
dashboard-app.js
```

핵심:

- 계산/data/state → core
- chart → charts
- 일반 UI → ui
- 퇴직연금 → pension
- orchestration/boot → app
- inline event 의존 제거
- event delegation 정리
- 역할별 state / render / event 책임 분리

### 3번째 · UI/UX 100점화 polish 작업

`investment-dashboard-main 3.zip`을 UI 점수 비교 기준점으로 잡고 여러 차수의 수정:

```text
1차 → QA → 2차 → QA → ... → 17차
```

를 진행했다.

당시 목표는 기능 추가가 아니라:

- UI 구조
- 공통 component
- typography
- color
- spacing
- radius
- border
- shadow
- icon
- buttons/forms
- tables
- charts
- modal/tooltip
- responsive
- accessibility
- theme consistency

등을 점검하여 **당시 정의한 평가표 전체를 100점으로 만드는 것**이었다.

17차 완료 시점에는 당시 평가표 기준:

```text
UI 처리 항목 전체 100
화면 영역별 전체 100
최종 UI 점수 전체 100
```

을 기록했다.

단, 이 100점은 **당시 평가기준의 역사적 milestone**이다.

현재 최신 ZIP을 앞으로 재평가할 때 무조건 100점이라고 가정하지 않는다.

### 4번째 · JavaScript ES Module migration

5분할 구조는 유지하면서 classic script의 암묵적 global dependency를 ES Module의 명시적 dependency로 전환했다.

진행:

```text
1차 · module 전환 전 dependency 정리
→ QA PASS

2차 · 5개 JS ES Module 원자적 전환 + 단일 module entry
→ QA PASS

3차 · module 전환 후 cleanup
→ 최종 QA PASS
```

최종 결과:

- 명시적 import/export
- circular import 0
- unresolved import 0
- legacy global dependency 0
- 임시 `window/globalThis` bridge 0
- classic load-order dependency 제거
- listener 중복 0
- 계산 baseline parity 유지
- UI / Responsive parity 유지


### 5번째 · JavaScript 3차 구조 리팩토링

ES Module 전환 후 독립 구조 평가에서 남은 결합도를 줄이기 위해 2026-08-18 진행했다.

진행:

```text
1차 · module-private state 정리 + JSON/network 오류 경계 강화
→ QA PASS

2차 · pension View / Editor 분리
→ QA PASS

3차 · chartState ownership / 내부 구현 은닉
→ QA PASS

4차 · ui-common foundation 분리 + core 순수화 + public API 정리
→ QA PASS

5차 · module별 action routing + app orchestration 최종 정리
→ QA PASS
```

핵심 결과:

- 5모듈 → 책임이 명확한 7모듈 구조
- `dashboard-core.js` DOM 의존 제거
- `chartState` / chart runtime state를 charts private로 이동
- pension batch/runtime state를 editor private로 이동
- 퇴직연금 View와 Editor 분리
- 공통 저수준 DOM helper를 `dashboard-ui-common.js`로 분리
- app의 chart/UI 내부 구현 직접 접근 제거
- module별 dashboard action dispatcher 도입
- public API 축소
- 순환 dependency 없이 단일 entry 유지

이 단계의 목적은 파일 수 자체가 아니라:

> **각 모듈이 자기 상태·DOM·action을 스스로 소유하고 app은 cross-module orchestration에 집중하도록 만드는 것**

이다.


## 11.3 2026-08-18 JS 3차 리팩토링 당시 최종 QA PASS 기준선

당시 메인 구조는 다음과 같았다.

```text
investment-dashboard-main/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ dashboard-core.js
│  ├─ dashboard-ui-common.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-pension-editor.js
│  └─ dashboard-app.js
├─ data/
│  ├─ portfolio.json
│  ├─ prices.json
│  ├─ performance_snapshots.json
│  ├─ account1_daily_snapshots.json
│  ├─ pension_contributions.json
│  ├─ pension_cash_snapshots.json
│  └─ pension_trades.json
├─ scripts/
│  └─ update_prices.py
├─ add/
│  ├─ calc.html
│  ├─ css/
│  │  ├─ common.css
│  │  └─ calc.css
│  ├─ js/
│  │  └─ calc.js
│  └─ report/
├─ .github/workflows/
├─ start-local-server.bat
└─ README.md
```

JS 3차 리팩토링 최종 QA PASS 기준 참고용 규모:

| 파일 | 줄 수 |
|---|---:|
| `dashboard-core.js` | 714 |
| `dashboard-ui-common.js` | 129 |
| `dashboard-charts.js` | 1,407 |
| `dashboard-ui.js` | 883 |
| `dashboard-pension.js` | 140 |
| `dashboard-pension-editor.js` | 1,157 |
| `dashboard-app.js` | 194 |

이 수치는 최신본 여부를 의심할 때 참고하는 snapshot이지 고정값이 아니다.

새 채팅에서 수치가 다르면 과거 ZIP으로 단정하지 말고 실제 diff와 Git 상태를 먼저 확인한다.


## 11.4 2026-08-18 구조 리팩토링 완료 시점 기록

당시 완료 상태:

```text
✅ 1번째 CSS 구조 리팩토링 완료
✅ 2번째 JS 5분할 리팩토링 완료
✅ 3번째 UI/UX polish · 17차 역사적 100점 milestone 완료
✅ 4번째 JS ES Module migration 완료
   ├─ 1차 dependency 정리 → QA PASS
   ├─ 2차 atomic ES Module 전환 → QA PASS
   └─ 3차 cleanup → 최종 QA PASS

✅ 5번째 · JS 3차 구조 리팩토링 완료
   ├─ 1차 private state / network 정리 → QA PASS
   ├─ 2차 pension View / Editor 분리 → QA PASS
   ├─ 3차 chart state ownership / encapsulation → QA PASS
   ├─ 4차 core 순수화 / ui-common / public API 정리 → QA PASS
   ├─ 5차 module action routing / app 최종 정리 → QA PASS
   └─ 최종 QA에서 `renderResultSummary()` 누락 1건 복구 후 → 최종 QA PASS
```

따라서 현재 **7모듈 구조를 JS 3차 구조 리팩토링 완료 기준선으로 확정**한다.

이후 JS 수정은 이 7모듈 구조와 각 모듈의 책임·state ownership·public API 경계를 보존하는 유지보수 작업으로 진행한다.

과거 `1차~17차` UI 작업이나 ES Module migration 차수를 다시 이어서 실행하지 않는다.


## 11.5 UI/UX 점수 이력 ① `investment-dashboard-main 3.zip` 최초 기준

`investment-dashboard-main 3.zip`은 UI 개선 이력의 최초 비교 기준점이다.

실제 수정 source가 아니라 **역사적 점수 비교용 baseline**이다.

### UI 처리 항목별 최초 기준

| 항목 | 점수 |
|---|---:|
| Visual hierarchy | 97 |
| Color | 95 |
| Typography | 94 |
| Spacing | 95 |
| Radius | 97 |
| Border | 95 |
| Shadow | 94 |
| Icon | 96 |
| Card system | 95 |
| Button system | 95 |
| Form controls | 95 |
| Table | 94 |
| Chart | 94 |
| Modal | 95 |
| Responsive | 96 |
| Accessibility | 90 |
| Information density | 94 |
| Navigation | 96 |
| Theme consistency | 95 |
| Overall usability | 95 |

### 화면 영역별 최초 기준

| 영역 | 점수 |
|---|---:|
| Topbar | 95 |
| Hero | 97 |
| 연금+계좌 성과 | 95 |
| 증권/퇴직연금 Tabs | 96 |
| 증권계좌 KPI | 95 |
| 계좌별 성과 | 94 |
| 보유종목 현황 | 94 |
| 장부결과 / 검산 | 92 |
| 퇴직연금 현황 | 96 |
| 퇴직연금 상품별 현황 | 96 |
| 차트 | 94 |
| 모달 | 95 |
| Tooltip | 94 |
| Table | 94 |
| Mobile UI | 94 |
| Tablet UI | 95 |
| Desktop UI | 96 |
| Light mode | 94 |
| Dark mode | 96 |
| Icon system | 96 |
| Typography | 94 |
| Color system | 95 |
| Spacing | 95 |
| Overall consistency | 96 |

### 최종 UI 최초 기준

| 항목 | 점수 |
|---|---:|
| Desktop UI | 96 |
| Tablet UI | 95 |
| Mobile UI | 94 |
| Light theme | 94 |
| Dark theme | 96 |
| Visual design | 96 |
| UX | 95 |
| Consistency | 96 |
| Information architecture | 96 |
| Responsive quality | 96 |
| 전체 UI 종합 점수 | 95 |


## 11.6 UI/UX 점수 이력 ② 2026-08-16 중간 QA 기준

`main 3` 이후 누적 UI polish가 진행되고 17차 최종 100점화에 도달하기 전의 대표 중간 snapshot이다.

### UI 처리 항목별

| 항목 | 점수 |
|---|---:|
| Visual hierarchy | 98 |
| Color | 96 |
| Typography | 95 |
| Spacing | 96 |
| Radius | 98 |
| Border | 95 |
| Shadow | 95 |
| Icon | 97 |
| Card system | 96 |
| Button system | 95 |
| Form controls | 95 |
| Table | 95 |
| Chart | 95 |
| Modal | 95 |
| Responsive | 99 |
| Accessibility | 93 |
| Information density | 98 |
| Navigation | 96 |
| Theme consistency | 96 |
| Overall usability | 97 |

### 화면 영역별

| 영역 | 점수 |
|---|---:|
| Topbar | 95 |
| Hero | 97 |
| 연금+계좌 성과 | 95 |
| 증권/퇴직연금 Tabs | 96 |
| 증권계좌 KPI | 95 |
| 계좌별 성과 | 95 |
| 보유종목 현황 | 95 |
| 장부결과 / 검산 | 99 |
| 퇴직연금 현황 | 96 |
| 퇴직연금 상품별 현황 | 96 |
| 차트 | 95 |
| 모달 | 95 |
| Tooltip | 95 |
| Table | 95 |
| Mobile UI | 97 |
| Tablet UI | 95 |
| Desktop UI | 99 |
| Light mode | 95 |
| Dark mode | 96 |
| Icon system | 97 |
| Typography | 95 |
| Color system | 96 |
| Spacing | 96 |
| Overall consistency | 98 |

### 최종 UI 점수

| 항목 | 점수 |
|---|---:|
| Desktop UI | 99 |
| Tablet UI | 95 |
| Mobile UI | 97 |
| Light theme | 95 |
| Dark theme | 96 |
| Visual design | 97 |
| UX | 97 |
| Consistency | 98 |
| Information architecture | 98 |
| Responsive quality | 99 |
| 전체 UI 종합 점수 | 97 |


## 11.7 UI/UX 점수 이력 ③ 17차 최종 100점 milestone

2026-08-17 `17차 작업 완료 기준`에서 당시 정의한 점수표 기준으로 최종 확인된 milestone:

### UI 처리 항목별

다음 20개 전부:

```text
Visual hierarchy
Color
Typography
Spacing
Radius
Border
Shadow
Icon
Card system
Button system
Form controls
Table
Chart
Modal
Responsive
Accessibility
Information density
Navigation
Theme consistency
Overall usability
```

**모두 100 / 100**

### 화면 영역별

다음 24개 전부:

```text
Topbar
Hero
연금+계좌 성과
증권/퇴직연금 Tabs
증권계좌 KPI
계좌별 성과
보유종목 현황
장부결과 / 검산
퇴직연금 현황
퇴직연금 상품별 현황
차트
모달
Tooltip
Table
Mobile UI
Tablet UI
Desktop UI
Light mode
Dark mode
Icon system
Typography
Color system
Spacing
Overall consistency
```

**모두 100 / 100**

### 최종 UI 점수

```text
Desktop UI                 100
Tablet UI                  100
Mobile UI                  100
Light theme                100
Dark theme                 100
Visual design              100
UX                         100
Consistency                100
Information architecture   100
Responsive quality         100
전체 UI 종합 점수           100
```

이 기록은 **당시 UI 100점화 작업이 완료됐다는 역사적 기준**이다.


## 11.8 `100점`은 현재 소스의 영구 고정 점수가 아니다

17차의 전체 100점은 당시 평가기준과 당시 QA 결과다.

그 뒤:

- 독립 재평가
- 새로운 회귀 발견
- 기능 추가
- ES Module migration
- 추가 UI patch

등이 발생할 수 있다.

따라서 새 채팅에서:

```text
예전에 100점이었으니 현재도 무조건 100
```

으로 판단하면 안 된다.

현재 점수를 물으면:

> **현재 첨부된 최신 ZIP을 처음부터 독립적으로 평가**

한다.

실제 문제가 있으면 100 미만으로 평가한다.

문제가 없다면 근거를 제시한 뒤 100을 줄 수 있다.


## 11.9 JavaScript 구조 점수 변화 이력

JS 점수는 절대 품질 인증이 아니라 구조 변화 추적용 역사 기록이다.

| 단계 | 역사적 평가 | 핵심 상태 |
|---|---:|---|
| 통파일 JS 시절 | **8.9 / 10** | 파일 규모와 implicit dependency, state/event/render 결합 부담 |
| 5파일 책임 분리 완료 | **9.6 / 10** | core/charts/ui/pension/app 책임 분리 |
| ES Module migration 완료 | **9.8 / 10** | import/export 명시화, 순환/global/load-order dependency 제거 |
| JS 3차 구조 리팩토링 완료 | **10.0 / 10** | private state ownership, pension View/Editor, ui-common, action routing, public API 축소, 최종 QA PASS |

이번 JS 3차 리팩토링은 단순히 파일을 더 쪼개 점수를 올리는 작업이 아니다.

구조적 목표:

```text
공유할 필요가 없는 state → owner module private
core의 DOM/UI 책임 → ui-common
퇴직연금 읽기/쓰기 결합 → View / Editor
app의 chart/UI 세부 action 지식 → owner module dispatcher
cross-module DOM 직접 접근 → 공개 API
```

현재 주요 구조:

```text
core
ui-common
charts
ui
pension
pension-editor
app
```

최종 QA에서 실제 회귀·dependency·API·state ownership을 다시 검증했고, `renderResultSummary()` 누락 1건을 복구한 뒤 최종 PASS했다. 현재 JS 구조 평가는 **10.0 / 10**으로 확정한다.

숫자 10점을 맞추기 위한 불필요한 파일 분할이나 framework 도입은 하지 않는다.


## 11.10 CSS 구조 점수의 역사적 참고값

CSS 1차 대규모 구조 정리 과정에서 기록된 대표 역사적 평가 snapshot:

```text
CSS 최종 구조 점수   93 / 100

공통화              96
중복 제거            91
specificity          84
responsive           92
dark mode            96
유지보수성            93
회귀 안정성           97
```

이 값은 이후 UI polish와 추가 CSS 정리가 더 진행되기 전의 **역사적 구조 평가값**이다.

현재 `style.css`의 고정 점수로 사용하지 않는다.

현재 CSS 점수가 필요하면 최신 ZIP으로 다시 평가한다.

2026-08-19에는 아래의 **CSS 1~4차 구조정리와 최종 누적 QA**가 완료되었고, 그 시점의 최신 기준선에서는 기존의 “기능군 CSS 분산” 감점 근거가 해소되어 CSS 구조/파일 구성·유지보수성·종합 평가가 모두 **100 / 100**으로 재평가되었다. 이는 영구 고정 점수가 아니라 해당 기준선의 milestone이며, 향후 실제 코드 변경이 있으면 최신 소스로 다시 평가한다.

다만 앞으로 다음 사실만을 이유로 반복 감점하지 않는다.

```text
css/style.css가 단일 파일이라는 사실 자체
source-order 때문에 의도적으로 남겨둔 continuation
여러 기능이 공유하는 cross-cutting continuation
동일 breakpoint 조건을 기능별 block에서 나누어 관리하는 구조
```

위 구조는 최신 CSS에서 소속과 유지 이유를 명시한 **의도된 유지보수 구조**다.


## 11.11 2026-08-19 CSS 1~4차 구조정리 당시 최종 기준선

메인 CSS는 계속 **`css/style.css` 단일 파일**을 유지한다. 이번 구조정리의 목적은 파일 분할이 아니라, 같은 기능군을 찾기 쉽게 모으고 source-order 때문에 이동하면 위험한 rule은 소속을 명확히 표시하는 것이었다.

차수별 작업:

```text
1차
Topbar / Navigation 통합
- Date Action Menu
- Navigation Primitives
- Edge TOC
- Topbar Layout
- Tablet / Mobile Topbar

2차
Chart 일반 영역 통합
- Primitives / Tooltip
- Core
- Legend / Controls
- Presentation / Compare
- Tooltip Responsive
- Motion / Entrance Animation

3차
Chart 후속 영역 통합
- Navigation
- Expanded Chart
- Expanded tooltip / hitbox
- Phone Chart UI
- Phone Chart Controls / Flow
- Phone Allocation / Options

4차
최종 구조 마감
- Role / Continuation Map
- continuation / cross-cutting continuation 소속 명시
- Chart 내부 중복 section header를 sub-role로 정리
- source-order 의존 영역은 억지로 이동하지 않고 유지
```

당시 정리된 주요 탐색 구조:

```text
[03. Topbar / Navigation]
Date Action
→ Navigation Primitives
→ Edge TOC
→ Topbar Layout
→ Tablet / Mobile

[08. Charts]
Primitives / Tooltip
→ Core
→ Presentation / Controls
→ Motion / Animation
→ Navigation
→ Expanded Chart
→ Phone Chart UI
```

그 밖의 기능은 실제 위치가 떨어져 있더라도 다음 표기를 통해 원 소속을 추적한다.

```text
continuation
cross-cutting continuation
```

의미:

- `continuation`: 같은 기능의 후속 rule이지만 source-order 또는 responsive 관계 때문에 현재 위치를 유지한다.
- `cross-cutting continuation`: 여러 기능/공통 layout/print/browser 정책과 함께 적용되므로 한 기능 영역으로 억지 이동하지 않는다.
- 이런 rule을 “분산되어 있다”는 이유만으로 다시 이동하지 않는다.

최종 누적 QA 기준:

```text
1차 PASS
2차 PASS
3차 PASS
4차 PASS
최종 누적 QA PASS

CSS rules          814 → 814
declarations       3,248 → 3,248
!important         30 → 30
selector 변경       0
property/value 변경 0
새 breakpoint       0
```

1차 이전 기준본과 4차 최종본의 selector / declaration / media-context 의미 집합은 동일했고, 대표 Desktop / Tablet / Mobile / phone-landscape / reduced-motion 및 Light / Dark 환경에서 최종 cascade 적용값 차이도 **0건**으로 검증했다.

`@media (min-width:1101px)` block 수가 기능 분리를 위해 늘어난 부분은 있지만 **새 breakpoint가 추가된 것이 아니며 기존 rule의 media condition은 유지**된다.

최종 구조 평가 milestone:

```text
구조 / 파일 구성    100 / 100
Cascade / Specificity 100 / 100
Responsive          100 / 100
Theme / Token       100 / 100
Interaction CSS     100 / 100
Dead / Legacy       100 / 100
유지보수성           100 / 100
CSS 종합            100 / 100
```

이 점수를 유지하기 위해 CSS를 더 움직이는 것이 목표가 아니다. 앞으로는:

- 점수 목적의 추가 재배치 금지
- 단일 CSS라는 이유만의 파일 분할 제안 금지
- `continuation` / `cross-cutting continuation`을 단순 분산으로 다시 감점 금지
- 실제 UI 회귀, cascade 충돌, dead code, 중복, 불필요한 specificity 등 **새로운 실질 문제를 최신 코드에서 확인한 경우에만** 수정 또는 감점

을 원칙으로 한다.



### README와 handover 문서의 역할 분리

README는 **저장소의 기능·전체 동작 구조·프로젝트 구조·데이터/갱신 방식·실행/배포 개요**를 설명하는 문서로 유지한다.

다음과 같은 상세 작업 운영 규칙은 README에 반복 기재하지 않고 **`main_dashboard_maintenance_handover.md`에서 단일 관리**한다.

- 수정 · QA 운영 방식
- 수정 파일 전달 규칙
- Source of Truth 세부 규칙
- CSS / JS 유지보수 세부 원칙
- 평가 · 점수 운영 규칙
- 반복 회귀 불변조건
- 차수 작업 / 최종 QA 절차

원칙:

- README와 handover MD에 같은 유지보수 규칙을 중복 작성하지 않는다.
- README는 사용자·저장소 관점의 개요를 우선하고, 상세 작업 규칙은 handover MD로 연결한다.
- 상세 유지보수 규칙이 변경되어도 README 내용까지 같이 수정해야 하는 구조를 만들지 않는다.
- README에 반드시 필요한 운영 개요가 아니라면 handover MD에만 기록한다.

# 12. 최종 운영 원칙 · 체크리스트


## 12.1 숫자 점수나 코드량 자체를 목표로 하지 않는다

현재 리팩토링된 상태를 더 높은 점수로 만들겠다는 이유만으로 구조를 계속 뜯지 않는다.

예:

```text
!important 무조건 0
media query 무조건 최소화
JS 파일을 더 많이 분리
dashboard-pension.js를 무조건 더 쪼개기
calc.js를 다시 여러 파일로 나누기
```

같은 숫자 목표를 세우지 않는다.

현재 정상적인 구조와 예외는 유지한다.


## 12.2 점수 운영의 최종 원칙

점수를 올리기 위해 구조를 뜯지 않는다.

다음은 금지:

```text
!important 숫자를 0으로 만들기 위한 억지 수정
media query 개수만 줄이기
JS 파일을 점수 때문에 더 분할
대형 함수가 있다는 이유만으로 무조건 재작성
2px 조정만으로 전체 점수 상승
```

점수보다 우선:

1. 기능 정확성
2. 계산 parity
3. 회귀 없음
4. 현재 책임 구조 유지
5. UI 일관성
6. 유지보수성
7. 최소 변경

점수는 그 결과를 추적하는 보조 지표다.


## 12.3 성능 평가에서 반복 제안하지 않을 항목

현재 프로젝트 규모와 실제 사용량에서는 다음 두 항목을 **이미 검토가 끝난 허용 가능한 trade-off**로 취급한다.

- 날짜 변경·별도수익 변경 등에서 메인 대시보드 DOM을 전체 `render()`하는 구조
- `Date.now()`를 이용한 CSS / ES Module / JSON cache bust 구조

따라서 향후 CSS·JS·UI/UX 구조 평가에서 위 두 항목을 단순한 이론적 최적화 관점으로 다시 감점하거나 선택적 개선사항으로 반복 제시하지 않는다. **실제 체감 지연, 과도한 네트워크 사용, 렌더 병목 등 측정 가능한 성능 문제가 발생했거나 사용자가 성능 최적화를 명시적으로 요청한 경우에만 재검토**한다.

이 원칙 때문에 현재의 전체 render나 cache bust를 무조건 유지해야 하는 것은 아니며, 실제 문제가 확인되면 그때 최신 소스와 측정 결과를 기준으로 최소 범위에서 개선한다.


## 12.4 새 작업 시작 전 최종 체크리스트

새 기능/수정 전에 내부적으로 다음을 확인한다.

```text
[ ] 최신 전체 ZIP을 직접 읽었는가
[ ] 과거 코드 기억을 최신본으로 가정하지 않았는가
[ ] 현재 ES Module 구조를 유지하는가
[ ] 수정 책임 파일이 맞는가
[ ] 공통 canonical CSS rule을 먼저 찾았는가
[ ] 새 breakpoint가 정말 필요한가
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


## 12.5 최종 원칙

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


## 12.6 최종 한 문장 운영 원칙

> **새 채팅에서는 최신 전체 ZIP의 `main_dashboard_maintenance_handover.md`를 가장 먼저 읽고 같은 ZIP의 실제 소스를 source of truth로 확인한다. `점수`는 CSS·JS·UI·UX 세부점수와 각 총점·UI/UX 총점·전체 총점만 출력하고, `평가` 또는 `평가해줘`는 최신 실제 소스를 처음부터 독립적으로 전체 평가한다. 수정은 현재 구조 안에서 최소 범위로 수행하고 QA는 별도 요청에서 변경 위험에 비례해 검증하며, 여러 차수 작업은 마지막에 누적 최종 QA를 수행한다. 결과 파일은 실제 변경 파일만 원래 경로를 유지한 ZIP으로 전달하고 GitHub 커밋용 짧은 Summary와 간단한 Description을 함께 제공한다. 사용자가 앞으로 반복 적용할 운영 조건을 추가·변경하면 별도 요청이 없어도 이 문서의 기존 관련 항목에 자동 반영한다. GAS는 GitHub 프로젝트와 별도로 운영하며, 서버 내부 검증은 최신 운영 GAS 소스가 별도 제공된 경우에만 수행한다.**
