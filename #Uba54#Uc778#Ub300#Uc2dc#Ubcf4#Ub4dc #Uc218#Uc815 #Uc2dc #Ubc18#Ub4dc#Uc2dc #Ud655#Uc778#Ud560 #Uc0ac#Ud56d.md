# 투자 대시보드 소스 수정 · 리팩토링 보존 운영 원칙

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

---

# 1. 현재 디렉토리 구조를 기준선으로 사용

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
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
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

---

# 2. 항상 최신 파일만 기준으로 작업

- 이전 대화에서 기억한 코드를 최종본이라고 추정하지 않는다.
- 내가 현재 채팅에 첨부한 **최신 ZIP 또는 최신 파일을 반드시 직접 읽고 작업한다.**
- 과거 버전의 selector, 함수, DOM, 파일 경로를 현재 코드에 적용하지 않는다.
- 수정 전 요청과 직접 관련된 파일과 사용처를 필요한 범위에서 확인한다.
- 요청과 관계없는 파일이나 영역은 수정하지 않는다.

기본 원칙:

> **최신 파일 기준 + 최소 변경**

---

# 3. 메인 CSS는 `css/style.css` 단일 파일 유지

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

---

# 4. 메인 CSS는 기능별 영역 안에서 반응형까지 함께 관리

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

---

# 5. CSS 섹션과 주요 주석은 영어 + 한글 병기

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

---

# 6. 반응형 기본 viewport는 3구간 고정

메인 대시보드 기본 viewport는 다음과 같다.

- **Desktop · 웹:** `1101px 이상`
- **Tablet · 태블릿:** `761px ~ 1100px`
- **Mobile · 모바일:** `760px 이하`

새로운 UI를 추가하거나 수정할 때 기본적으로 이 세 구간 안에서 해결한다.

---

# 7. 불필요한 추가 breakpoint 금지

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

---

# 8. 특정 viewport 스크린샷 맞춤식 수정 금지

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

---

# 9. 미관 문제와 실제 문제를 구분

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

---

# 10. CSS 추가보다 기존 규칙 수정·통합 우선

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

---

# 11. 동일 selector override 누적 금지

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

---

# 12. `!important` 사용 정책

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

---

# 13. 디자인 토큰과 CSS variable 우선 재사용

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

---

# 14. 메인 JavaScript는 현재 5파일 구조 유지

현재 메인 JavaScript 구조는 다음과 같다.

```text
js/
├─ dashboard-core.js
├─ dashboard-charts.js
├─ dashboard-ui.js
├─ dashboard-pension.js
└─ dashboard-app.js
```

앞으로 기능을 추가할 때 이 책임 경계를 유지한다.

단순 수정 때문에 다시 하나의 거대한 JS 파일로 합치지 않는다.

반대로 작은 기능 하나마다 새 JS 파일을 계속 추가하지도 않는다.

---

# 15. `dashboard-core.js` 책임

`dashboard-core.js`는 기본적으로 다음을 담당한다.

- 데이터
- state
- 계산
- formatter
- 공통 helper
- 데이터 loading 관련 기반

현재 이 파일은 **DOM에 의존하지 않는 core 계층**으로 유지하는 것이 중요하다.

따라서 새 기능을 추가하면서:

```js
document.querySelector(...)
element.classList...
element.innerHTML...
```

같은 DOM 조작을 `dashboard-core.js`에 넣지 않는다.

계산/데이터 함수는 가능한 한:

```text
input
→ calculation
→ result
```

형태를 유지한다.

---

# 16. 메인 상태 구조 유지

현재 메인 상태는 역할별로:

```js
dataState
uiState
chartState
pensionState
```

등으로 구분되어 있다.

새 상태를 추가할 때 어느 영역에 속하는지 먼저 판단한다.

새로운 독립 전역 변수를 습관적으로 계속 추가하지 않는다.

또 모든 상태를 하나의 거대한 `state` 객체로 다시 합치지도 않는다.

---

# 17. `dashboard-charts.js` 책임

차트 관련 기능은 기본적으로:

```text
js/dashboard-charts.js
```

에서 관리한다.

예:

- chart rendering
- SVG
- axis
- bar / line
- legend
- chart controls
- 확대 차트
- chart scroll
- animation
- chart tooltip
- responsive chart 처리

차트 수정 때문에 `dashboard-core.js`, `dashboard-ui.js`, `dashboard-app.js`에 차트 세부 구현을 흩뿌리지 않는다.

공통 데이터 계산이 필요한 경우에만 core의 기존 helper를 사용하거나 적절히 확장한다.

---

# 18. `dashboard-ui.js` 책임

일반 UI 영역은 기본적으로:

```text
js/dashboard-ui.js
```

가 담당한다.

예:

- Topbar
- Navigation
- 모바일 메뉴
- theme
- 일반 card/table rendering
- 공통 modal / 일반 UI

새 UI 기능을 추가할 때 기존 UI helper와 rendering 구조를 먼저 확인한다.

---

# 19. `dashboard-pension.js` 책임

퇴직연금 관련 기능은 기본적으로:

```text
js/dashboard-pension.js
```

에서 관리한다.

예:

- 퇴직연금 rendering
- 납입
- 저장
- 삭제
- batch
- PIN
- 현금성자산
- ETF 관련 처리

퇴직연금 기능을 다른 JS 파일에 중복 구현하지 않는다.

---

# 20. `dashboard-app.js` 책임

`dashboard-app.js`는 앱 전체를 연결하는 orchestration 계층이다.

주 역할:

- 이벤트 연결
- action routing
- render orchestration
- 초기 state 연결
- boot

새 기능의 실제 계산이나 복잡한 rendering 로직을 `dashboard-app.js`에 직접 넣지 않는다.

이 파일은:

> **기능 구현보다 기능들을 연결하는 역할**

을 유지한다.

---

# 21. 메인 JS의 파일 간 책임을 함부로 섞지 않는다

예를 들어:

```text
차트 계산 → charts/core
차트 DOM → charts
Topbar → ui
Pension → pension
앱 boot/action routing → app
```

처럼 책임을 유지한다.

한 기능을 수정하기 위해 4~5개의 JS 파일을 동시에 건드려야 하는 구조를 새로 만들지 않는다.

그렇게 해야만 구현되는 요청이라면 구조가 잘못된 방향인지 먼저 검토한다.

---

# 22. Inline event handler 재도입 금지

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

---

# 23. Event handler에 비즈니스 로직을 과도하게 넣지 않는다

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

---

# 24. JavaScript에서 UI 스타일 직접 지정 최소화

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

---

# 25. JS 중복 로직 추가 금지

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

---

# 26. 현재 classic script load 구조를 함부로 변경하지 않는다

현재 메인 JS는 역할별 classic script 구조로 동작한다.

ES module, TypeScript, bundler, framework 등의 도입은 단순 기능 수정 과정에서 하지 않는다.

다음으로 전환하지 않는다.

```text
React
Vue
TypeScript
Webpack/Vite
ES module 전면 전환
```

별도 구조 개편을 내가 명시적으로 요청한 경우에만 검토한다.

---

# 27. Calc는 메인과 독립된 부가 기능으로 유지

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

---

# 28. Calc의 HTML / CSS / JS 책임 분리 유지

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

---

# 29. Calc 계산 구조 유지

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

---

# 30. Calc Validation 구조 유지

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

---

# 31. Calc JS는 현재 단일 `calc.js` 유지

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

---

# 32. Calc CSS와 메인 CSS를 통합하지 않는다

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

---

# 33. Calc 모바일 KPI 설명은 강제 ellipsis로 다시 자르지 않는다

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

---

# 34. Report 영역 구조 보존

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

---

# 35. 공통화는 실제 공통일 때만 수행

공통화 자체를 목표로 하지 않는다.

먼저:

- 정말 두 곳 이상에서 같은 책임인가
- 앞으로 같이 변경될 가능성이 있는가
- 공통화 후 결합도가 오히려 높아지지 않는가

를 판단한다.

메인과 calc처럼 독립적인 영역의 코드가 우연히 비슷하다는 이유만으로 공통화하지 않는다.

---

# 36. 과도한 리팩토링 금지

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

---

# 37. 사용자의 요청이 현재 구조를 훼손하면 작업 중지

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

---

# 38. 수정 전 영향 범위는 필요한 만큼만 확인

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

---

# 39. 새 코드 적용 후 불필요한 예전 코드 제거

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

---

# 40. Diff 검사 필수

수정 완료 후 변경 파일의 diff를 확인한다.

확인 항목:

- 요청한 부분만 변경됐는지
- 무관한 코드가 포맷팅되지 않았는지
- 기존 기능이 실수로 삭제되지 않았는지
- 같은 목적 코드가 이중으로 남지 않았는지
- 이전 workaround가 불필요하게 남아 있지 않은지
- 다른 책임 파일을 불필요하게 건드리지 않았는지

전체 프로젝트 diff가 아니라 변경 파일 중심으로 확인한다.

---

# 41. CSS 수정 후 기본 보고

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

---

# 42. JS 수정 후 기본 보고

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

---

# 43. Calc 수정 후 기본 보고

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

---

# 44. 새로운 breakpoint / `!important` 발생 시 별도 보고

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

---

# 45. 차수 작업 방식

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

---

# 46. 내가 `QA`라고 하면 직전 변경범위만 검사

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

---

# 47. QA 중 임의 디자인 변경 금지

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

---

# 48. QA는 빠르고 변경범위 중심으로

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

---

# 49. 전체 QA는 명시적으로 요청할 때만

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
- 메인 JS 5파일
- calc
- report
- DOM
- 주요 viewport
- 전체 기능

까지 확장한다.

---

# 50. 작업 속도 보호

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

---

# 51. 일반 수정 요청 처리 순서

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

---

# 52. 변경 파일만 전달

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

---

# 53. 계산 로직 수정은 UI보다 엄격하게 검증

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

---

# 54. 공통 코드 변경은 더 신중하게

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

---

# 55. 숫자 점수나 코드량 자체를 목표로 하지 않는다

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

---

# 56. 신규 기능 추가 시 판단 순서

새 기능 요청을 받으면 내부적으로 다음 순서로 판단한다.

### 1
이 기능은 어느 책임 영역에 속하는가

### 2
기존 component/helper/state/action으로 구현 가능한가

### 3
현재 3개 viewport 규칙 안에서 해결 가능한가

### 4
기존 CSS/JS 규칙을 수정하면 되는가

### 5
새 class/function/state/action이 정말 필요한가

### 6
새 breakpoint, `!important`, inline style 같은 예외가 정말 필요한가

이 순서를 거친 뒤 구현한다.

---

# 57. 구조 보존을 이유로 과도하게 소극적이지 않는다

기존 구조 안에서 정상적으로 구현 가능한 요청이라면 바로 수행한다.

매번:

> 구조를 변경해도 될까요?

라고 확인하지 않는다.

**명백하게 현재 구조를 훼손하는 경우에만 작업을 중지하고 대안을 제시한다.**

---

# 58. 최우선 판단 기준

모든 수정의 우선순위는 다음과 같다.

### 1순위
기존 기능과 계산 결과가 정확하게 유지되는가

### 2순위
현재 리팩토링된 책임 구조가 유지되는가

### 3순위
기존 component / helper / state / action을 재사용하는가

### 4순위
최소 범위로 수정했는가

### 5순위
코드가 읽기 쉽고 명확한가

### 6순위
코드 양이 적은가

코드 줄 수 감소는 가장 낮은 우선순위다.

---

# 59. 현재 구조별 수정 위치 기준

향후 수정 시 기본적으로 다음 책임을 참고한다.

```text
메인 CSS
→ css/style.css

데이터 / 상태 / 계산 / 공통 helper
→ js/dashboard-core.js

차트
→ js/dashboard-charts.js

Topbar / Navigation / 일반 UI
→ js/dashboard-ui.js

퇴직연금
→ js/dashboard-pension.js

event routing / render orchestration / boot
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

---

# 60. 최종 원칙

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