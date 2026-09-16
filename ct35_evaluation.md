# 투자 대시보드 공통화·토큰화 35개 항목 평가 기준서

> 목적: 투자 대시보드의 공통화·토큰화·반응형 공통화·로직/상태 공통화·책임 구조 정리를 1~35번 항목으로 고정하여,  
> 사용자가 `평가해줘`라고 요청할 때 CSS / JS / UI / UX 평가와 별도로 이 35개 항목도 동일한 방식으로 점검·점수화하기 위한 전용 기준서다.
>
> 이 문서는 changelog가 아니다. **현재 유효한 평가 기준과 유지보수 contract만 보존한다.**
>
> **문서 관계:** `dashboard_evaluation_guide.md`가 전체 Dashboard 평가의 상위 contract이며 **전역 A/B/C 의미·반례 탐색·감점/비감점·평가 종료 기준**을 소유한다. 이 문서는 그 평가와 함께 사용하는 **공통화·토큰화 35개 고정 Rubric**을 소유한다. 두 문서의 등급 표현이 충돌할 여지가 있으면 `dashboard_evaluation_guide.md`의 전역 A/B/C 정의를 우선하고, 이 문서는 해당 결함을 각 항목의 `PASS / MINOR / MAJOR / FAIL` 배점에 연결한다.

---

## 0. 사용 방법

### 0.1 평가 요청

사용자가 최신 프로젝트 파일을 첨부하고 `평가해줘`라고 요청하면 다음을 수행한다.

1. 최신 소스와 이 문서를 함께 기준으로 삼고, 실제 화면 확인이 유효한 항목은 0.6의 GitHub Pages 공개 HTTPS runtime을 함께 대조한다.
2. 사용자가 전체 평가를 요청하면 1~35번을 모두 확인한다. 사용자가 `1`, `2`, `3`처럼 특정 번호를 지정하면 **그 번호 항목만 평가**하고 다른 번호로 넘어가지 않는다.
3. 각 항목을 단순 존재 여부가 아니라 아래 기준으로 평가한다.
   - 공통화/토큰화의 실제 적용 범위
   - 중복 제거 정도
   - 책임 경계
   - 예외 처리의 적절성
   - responsive 일관성
   - 하드코딩/매직넘버 재등장 여부
   - 공통화를 위해 feature 계산·state를 과도하게 합치지 않았는지
4. 각 항목에 **점수 / 판정 / 근거 / 수정 필요 여부**를 제시한다. `Main + Add` 항목은 하나의 합산 점수를 만들지 않고 **Main 점수와 Add 점수를 각각 독립적으로 제시**한다.
5. 마지막에 카테고리별 종합점수와 전체 총점을 제시하되, **Main 종합점수와 Add 종합점수를 분리**한다.
6. 실제 결함과 선택적 개선을 구분한다.
7. 점수를 올리기 위한 과잉 리팩터링은 권하지 않는다.

### 0.2 평가 결과 등급

각 항목은 100점 만점으로 평가한다.

- **95~100**: 매우 안정적. 구조적 재작업은 불필요하며, 100점은 미해결 A/B급이 없을 때만 부여한다.
- **90~94**: 안정적. 경미한 개선 여지는 있으나 필수 아님.
- **80~89**: 개선 권장. 중복/예외/책임 혼재가 일부 존재.
- **70~79**: 구조적 개선 필요.
- **69 이하**: 공통화/토큰화 contract 훼손 또는 회귀 가능성이 큼.

총점은 **Main과 Add를 분리해 계산**한다.

- **Main 총점:** Main을 평가하는 항목들의 Main 점수 단순 평균
- **Add 총점:** Add를 평가하는 항목들의 Add 점수 단순 평균
- `Main + Add` 항목은 Main 100점, Add 100점을 각각 독립적으로 채점하며 서로 평균내어 하나의 항목 점수로 만들지 않는다.
- Main 전용 항목은 Add를 `N/A`, Add 전용 항목은 Main을 `N/A`로 표시한다.
- 특정 영역에서 해당 component/기능이 실제 존재하지 않는 경우 해당 영역 점수를 `N/A`로 표시하고 그 영역 평균에서 제외한다.
- **Main+Add 통합 단일 총점은 기본 출력하지 않는다.** 사용자가 별도로 요구한 경우에만 참고값으로 계산한다.

### 0.3 수정 우선순위

A/B/C의 **전역 의미는 `dashboard_evaluation_guide.md`와 동일하게 사용**한다. CT35는 별도 등급 체계를 만들지 않고, 공통화·토큰화 항목에서 발견한 결함을 그 의미에 맞춰 분류한다.

- **A급 — 실제 중대 결함 / 수정 권장**
  - 데이터·기능·운영 결과 또는 핵심 contract를 실질적으로 깨뜨리는 문제
  - 공통화·토큰화 영역에서는 책임 역전, 계산/state/persistence 침범, 광범위한 semantic 파손처럼 영향이 큰 경우
  - 수정 후 QA 필수

- **B급 — 조건부·경미하지만 실질적인 결함 / 수정 권장**
  - 현재 대부분 정상이어도 지원 환경의 특정 순서·경계·입력에서 오류·혼란·유지보수 위험이 발생하는 문제
  - 실제 소스/문서 contract 불일치, 반복되는 잘못된 직접값, 현실적으로 도달 가능한 responsive·state 회귀 등
  - 단순 취향이나 “더 공통화할 수 있음”만으로 B급을 만들지 않는다

- **C급 — 비감점 관찰사항 / 선택 개선**
  - 현재 설계 의도에 맞거나, 수정 이득이 작고 회귀 위험이 더 큰 항목
  - legacy 보존, feature 고유 책임, 광학 보정, 점수를 위한 과잉 공통화 방지 등
  - 사용자가 C까지 명시적으로 수정 요청한 경우에만 안전한 범위에서 반영한다

#### A/B/C와 고정 배점의 연결

- A/B급은 점수와 분리된 인상평가가 아니다. 반드시 해당 항목의 **고정 배점 세부항목**과 `MINOR / MAJOR / FAIL` 판정을 함께 명시한다.
- A/B의 최종 등급은 `dashboard_evaluation_guide.md`의 실제 영향 기준을 따르고, CT35의 `PASS / MINOR / MAJOR / FAIL`은 고정 배점 계산에 사용한다.
- 모든 고정 배점 세부항목이 `PASS`라면 점수에 영향을 주는 A/B급을 별도로 만들지 않는다. 단순 선택 제안은 C급 또는 비점수 참고사항으로 기록한다.
- C급과 비점수 참고사항은 감점하지 않으며 100점 부여를 막지 않는다.
- A/B/C 수정 우선순위와 `PASS / MINOR / MAJOR / FAIL` 점수 판정은 서로 모순되지 않아야 한다.

### 0.4 수정 요청

사용자가 평가 후 `수정`이라고 하면:

1. **A급부터 우선 수정**한다.
2. B급은 실익이 명확한 것만 수정한다.
3. C급은 기본적으로 수정하지 않되, 사용자가 C급까지 명시적으로 요청하면 회귀 위험이 낮은 범위에서만 수정한다.
4. 변경 파일을 최소화한다.
5. 기존 공통 component/token을 재사용한다.
6. 새 token/class/helper를 추가하기 전에 기존 것으로 해결 가능한지 먼저 확인한다.
7. 공통화 때문에 계산·state·persistence 책임을 common layer로 끌어올리지 않는다.
8. 수정했다고 이 문서나 다른 handover를 자동으로 수정하지 않는다.
9. 장기 contract가 실제로 변경된 경우에만 관련 문서를 수정한다.

### 0.5 QA 요청

사용자가 `QA`라고 하면:

1. 수정 항목과 연결된 35개 평가 항목을 다시 확인한다.
2. 영향받는 CSS/JS/UI/UX 회귀를 함께 검사한다.
3. breakpoint leakage, selector 충돌, import cycle, state 회귀 등을 확인한다.
4. 자동 테스트가 존재하는 영역은 실행한다.
5. 실제 렌더링 환경을 사용할 수 없으면 정적/계산 QA와 실기 미확인 범위를 구분한다.
6. QA 결과는 `PASS / 조건부 PASS / FAIL`로 명확히 표시한다.
7. QA는 직전 수정이 반영된 현재 ZIP·변경 파일·현재 revision을 대상으로 한다. 아래 0.6의 GitHub Pages 공개 URL은 배포 revision이 다를 수 있으므로 QA 근거로 사용하지 않는다.
8. QA에서 runtime 확인이 필요하면 현재 수정본 자체를 실행할 수 있는 환경만 사용한다. 실행할 수 없으면 해당 runtime 범위를 `미실시`로 표시하고 정적·계산·diff·회귀테스트를 끝까지 수행한다.

### 0.6 평가 Runtime 검증 기본 경로

35개 항목의 `평가`, `평가해줘`, `점수`처럼 **현재 프로젝트를 독립 평가하는 작업에서만**, 실제 브라우저 렌더링 검증이 필요한 경우 로컬 HTTP보다 GitHub Pages 공개 HTTPS를 우선한다. 사용자가 주소를 매번 다시 제공할 필요는 없다.

`QA`, 수정 직후 QA, 차수별 QA, 전체 QA에는 아래 공개 URL을 사용하지 않는다. 배포 상태 확인이 필요하면 사용자의 별도 `배포본 확인` 요청으로 분리한다.

canonical 공개 검증 주소:

```text
메인 대시보드
https://tkfkd3226-cell.github.io/investment-dashboard

Add Calc
https://tkfkd3226-cell.github.io/investment-dashboard/add/calc.html

Add Report
https://tkfkd3226-cell.github.io/investment-dashboard/add/kodex-leverage-report.html
```

적용 원칙:

- `localhost` / `127.0.0.1` 로컬 HTTP는 기본 독립 평가 경로로 사용하지 않는다.
- 실행 환경 Chromium에서 `ERR_BLOCKED_BY_ADMINISTRATOR` 등 로컬 접근 제한이 발생해도 프로젝트 오류나 감점 사유로 보지 않는다.
- 메인 관련 항목은 메인 공개 URL, 31번 Add Calc UI는 Calc URL, 32번 Add Report는 Report URL을 우선 사용한다.
- 독립 평가에서 Responsive / spacing / card / table / modal / tooltip / chart / topbar처럼 실제 화면 확인이 유효한 항목은 가능한 경우 공개 페이지 runtime을 정적 소스 분석과 함께 대조한다.
- GitHub Pages는 **배포된 revision의 runtime 검증 수단**일 뿐 최신 ZIP의 Source of Truth를 대체하지 않는다.
- 최신 ZIP과 GitHub Pages가 동일 revision인지 확인되지 않은 경우 공개 화면 결과는 `배포본 runtime`으로 구분한다.
- 최신 ZIP의 미배포 변경사항을 GitHub Pages만 보고 실제 pixel/render `PASS`로 판정하지 않는다.
- 공개 페이지와 최신 ZIP이 다르면 배포 지연·revision 차이를 먼저 구분하고, 공개 페이지를 근거로 최신 ZIP을 되돌리지 않는다.
- 공개 HTTPS에서도 실제 렌더링을 확인할 수 없으면 정적·계산 평가를 끝까지 수행하고, 미확인 범위만 명확히 표시한다. 실행하지 않은 검사를 `PASS`라고 쓰지 않는다.
- 독립 평가의 로컬 실행은 사용자가 명시적으로 요청했거나, 공개 페이지로 확인할 수 없는 항목을 현재 소스로 별도 실행 확인할 필요가 있고 실제 접근 가능할 때만 보조 수단으로 사용한다.
- QA의 runtime 경로는 이 절이 아니라 0.5의 현재 수정본 검증 원칙을 따른다.


### 0.7 채점 재현성 원칙

이 문서의 목적은 평가자마다 점수가 크게 달라지는 것을 막는 데 있다. 따라서 평가자는 임의의 배점표를 새로 만들지 않고, 각 항목에 적힌 **검사 범위 / 필수 검사 절차 / 고정 배점 / 판정 단계 / 허용 예외**를 사용한다.

공통 규칙:

- 최신 ZIP·소스가 **Source of Truth**다.
- `Main + Add` 항목은 **Main과 Add를 각각 별도의 100점 만점으로 채점**한다. 둘을 합산하거나 평균내어 하나의 항목 점수로 만들지 않는다.
- Main 점수는 Main 소스의 위반만 반영하고, Add 점수는 Add 소스의 위반만 반영한다.
- 한쪽의 결함 때문에 다른 쪽 점수를 감점하지 않는다.
- `Main + Add` 항목에서 한쪽을 확인하지 못하면 확인하지 못한 쪽만 `미평가` 또는 `N/A`로 표시하며, 확인한 쪽 점수는 정상 산정한다.
- `Main` 항목은 메인 대시보드 소스만으로 평가하고, Add의 독립 구현 차이를 감점하지 않는다.
- `Add` 항목은 `/add`만 평가하며 메인과 동일 구현을 강제하지 않는다.
- `해당 시`라고 적힌 범위는 실제 component가 존재할 때만 검사하며, 존재하지 않는 component 자체는 감점하지 않는다.
- 소스 전수검사가 필요한 항목에서 일부 파일/selector만 표본 확인한 경우 **95점 이상을 줄 수 없다.**
- 필수 검사 범위를 일부 확인하지 못한 경우 **100점을 줄 수 없다.**
- runtime 확인이 유효한 항목에서 공개 페이지를 확인하지 못했더라도 소스 contract가 완전히 검증되면 감점하지 않는다. 단, pixel/render 확인을 했다고 쓰지 않는다.
- GitHub Pages가 최신 ZIP과 동일 revision인지 확인되지 않으면 runtime 결과는 `배포본 runtime`으로만 기록한다.
- 같은 결함을 여러 세부항목에서 중복 감점하지 않는다. 가장 직접적인 세부항목에서 1회 반영한다.
- 의도된 예외·legacy·categorical palette·browser fallback 등 **허용 예외**는 감점하지 않는다.
- 점수를 올리기 위해 새로운 token/class/helper를 추가하라고 권하지 않는다.

### 0.8 공통 판정 단계

각 세부 배점 항목은 아래 4단계 중 하나로만 판정한다.

| 단계 | 배점 반영 | 적용 기준 |
|---|---:|---|
| **PASS** | 100% | 필수 범위에서 위반 없음 |
| **MINOR** | 80% | 국소적 1~2건, 의미/책임/재사용 구조에는 영향 없음 |
| **MAJOR** | 40% | 반복 위반, 여러 component에 분산, 유지보수 비용 증가 |
| **FAIL** | 0% | contract 부재, 역방향 책임 침범, 핵심 의미 불일치 |

예: 25점짜리 세부항목이 `MINOR`면 20점, `MAJOR`면 10점이다.

`Main + Add` 항목에서는 이 판정을 **Main과 Add에 각각 별도로 적용**한다. 예를 들어 Main이 전부 PASS이고 Add의 25점짜리 한 세부항목만 MAJOR라면 `Main 100 / Add 85`처럼 기록하며 `92.5점`으로 합치지 않는다.

평가자는 `97점`, `93점`처럼 임의 감점값을 먼저 정하지 않는다.  
**세부 배점별 PASS/MINOR/MAJOR/FAIL을 결정한 뒤 합산**한다.

### 0.9 100점 부여 조건

100점은 다음을 모두 만족할 때만 부여한다.

1. 점수를 부여하려는 해당 영역(Main 또는 Add)의 필수 검사 범위를 전부 확인했다.
2. 모든 고정 배점 세부항목이 `PASS`다.
3. 해결되지 않은 A/B급 결함이 없다.
4. 발견된 직접값·예외는 모두 이 문서의 허용 예외 또는 명확한 semantic/feature 사유가 있다.
5. handover와 실제 소스가 충돌하지 않는다.
6. runtime이 핵심 판단에 반드시 필요한 항목이라면 실제 runtime을 확인했거나, runtime 미확인이 점수에 영향을 주지 않는 이유를 명시했다.

위 조건을 충족하지 못하면 100점을 주지 않는다.

### 0.10 검사 근거 최소 요건

개별 평가 답변에는 최소한 다음을 남긴다.

- **검사 범위:** Main / Add / Main+Add
- **영역별 점수:** Main / Add를 각각 별도로 표시 (`N/A` 가능)
- **검사 파일 또는 책임 영역**
- **전수검사인지 표본검사인지**
- **핵심 근거:** selector / token / 함수 / import / renderer 등 실제 소스 근거
- **허용 예외:** 발견했다면 왜 감점하지 않았는지
- **runtime:** 확인 / 배포본만 확인 / 미확인
- **점수 산식:** 고정 배점표의 세부 점수 합계

### 0.11 Main / Add 범위 원칙

35개 항목은 아래 기본 범위를 따른다. 각 항목의 개별 Rubric에 적힌 범위가 최종 기준이다.

- **Main + Add:** 1~10, 13~15, 17~20, 23, 35  
  단, 해당 primitive/component가 실제 존재하는 영역만 검사한다.
- **Main 중심:** 11, 12, 16, 21, 22, 24~30, 33, 34
- **Add 전용:** 31, 32
- **구조/예외:** 27, 30, 35는 책임 경계를 기준으로 필요 시 프로젝트 간 결합 여부까지 확인한다.

### 0.12 Main / Add 독립 채점 원칙

평가 결과에서 Main과 Add는 **서로 다른 평가 대상**이다.

#### Main + Add 항목
예: 1번 색상, 2번 Corner, 3번 Spacing 등.

- 동일한 고정 Rubric 100점을 Main에 한 번 적용한다.
- 동일한 고정 Rubric 100점을 Add에 다시 한 번 적용한다.
- 출력은 `Main 00/100`, `Add 00/100`으로 분리한다.
- 두 점수를 평균내어 `항목 총점`을 만들지 않는다.
- Main의 완성도가 높아도 Add의 문제를 가리지 않으며, Add의 결함도 Main 점수에 영향을 주지 않는다.

#### Main 전용 항목
- Main만 100점 만점으로 평가한다.
- Add는 `N/A`로 표시한다.

#### Add 전용 항목
- Add만 100점 만점으로 평가한다.
- Main은 `N/A`로 표시한다.

#### 수정 우선순위
A/B/C 판정도 영역별로 구분한다.

예:
- `Main: 수정 없음`
- `Add: A급 — 색상 hardcoding 정리`

이 경우 Main을 건드리지 않고 Add만 수정한다.

#### QA
수정 후 QA 역시 변경된 영역 점수를 우선 재평가한다.  
Add만 수정했다면 Main 점수를 억지로 다시 산정하지 않으며, Main과의 공통 contract에 영향이 있을 때만 Main 회귀를 함께 확인한다.

### 0.13 자동 테스트와 평가 점수 분리 원칙

자동 테스트는 수정 후 계산·기능·UI contract 회귀를 빠르게 찾기 위한 **QA 보조수단**이며 독립적인 품질 점수 항목이 아니다.

평가 시 다음을 고정한다.

- 특정 기능 또는 영역에 자동 테스트 파일이 **없다는 이유만으로** A/B/C 문제를 만들거나 감점하지 않는다.
- 테스트 파일 수, 테스트 case 수, coverage 수치가 많다는 이유만으로 가산점을 주지 않는다.
- Main과 Add 모두 동일한 원칙을 적용한다. 한쪽에 자동 테스트가 있고 다른 쪽에 없다는 사실만으로 두 영역의 점수를 다르게 주지 않는다.
- 자동 테스트가 존재하는 영역은 가능한 경우 평가·QA의 **검증 근거 중 하나**로 활용한다.
- 테스트가 PASS했다는 사실만으로 실제 UI/UX·구조·runtime까지 자동 PASS 처리하지 않는다. 테스트가 보호하지 않는 항목은 기존 필수 검사 절차에 따라 별도로 확인한다.
- 테스트가 FAIL한 경우 곧바로 감점하지 않고, 먼저 **실제 코드 회귀/결함인지, 낡거나 과도한 테스트 contract인지** 확인한다.
- 테스트 FAIL로 실제 계산 오류, 기능 회귀, UI contract 훼손이 확인된 경우에는 테스트 실패 자체가 아니라 **확인된 실제 결함**을 해당 고정 Rubric에 반영한다.
- 정상적인 요구사항 변경으로 contract가 바뀌어 테스트 기대값도 함께 수정된 경우, 그 사실 자체를 감점하지 않는다.
- 자동 테스트 추가를 100점 조건이나 B급 해소 조건으로 요구하지 않는다. 실제 소스의 모든 고정 배점 세부항목이 PASS이고 미해결 A/B급 결함이 없다면 테스트 부재와 관계없이 100점 부여가 가능하다.

현재 저장소의 자동 QA 기본 구조는 다음과 같으나, **이 구조의 존재 자체가 평가 점수 조건은 아니다.**

```text
tests/
├─ main-calc.test.cjs
├─ main-ui-contract.test.cjs
├─ add-calc.test.cjs
├─ add-report-data.test.cjs
├─ add-ui-contract.test.cjs
├─ cross-ui-contract.test.cjs
└─ update_prices_test.py
```

평가와 QA의 구분:

```text
평가
→ 실제 코드·기능·UI·UX·구조의 현재 품질을 채점
→ 자동 테스트는 근거 중 하나
→ 테스트 부재/개수 자체는 점수와 무관

QA
→ 변경 영역 Fast QA + 가능한 경우 4종 Full QA 활용
→ 회귀를 빠르게 찾는 안전망으로 사용
→ 실제 UI/UX 판단을 자동 테스트로 대체하지 않음
```


# 1. 색상·Semantic Color 체계
**분류: 토큰화 중심**

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

### 감점 요인
- 동일 semantic에 다수 하드코딩 색상 존재
- theme별 의미 불일치
- chart/table/card가 같은 의미의 색을 서로 다르게 사용
- 색상 변경을 위해 여러 파일을 동시에 수정해야 하는 구조

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Semantic token coverage | 25 |
| 중복 literal / hardcoding 억제 | 25 |
| Light / Dark semantic parity | 20 |
| 상태·손익·보조색 일관성 | 15 |
| JS / Chart 색상 책임 | 15 |
| **합계** | **100** |

**필수 검사 절차:**
- Main CSS 전체 color/background/border 계열 literal과 `var()` 사용 전수 검색
- Add CSS 전체를 동일 방식으로 전수 검색
- Light/Dark token override 대조
- JS의 hex/rgb literal을 전수 검색해 UI semantic / categorical data palette / fallback으로 분류
- 같은 semantic이 card/table/chart/add에서 동일 token을 쓰는지 교차 확인

**정량 판정 / 점수 상한:**
- Main과 Add는 독립 채점한다. 확인하지 못한 영역은 `미평가`로 표시하고 다른 영역 점수에 상한을 두지 않는다.
- UI semantic 색이 component selector에서 반복 직접값으로 존재하면 해당 세부항목은 최소 MINOR
- Light/Dark에서 같은 semantic이 서로 다른 의미색으로 바뀌면 해당 parity 항목 FAIL

**허용 예외 — 감점하지 않음:**
- categorical/data-series palette
- CSS variable 조회 실패용 JS fallback
- `transparent`, `currentColor`, 브라우저 기본색
- 외부 asset 또는 third-party가 소유하는 색

---

# 2. Corner / Radius 체계
**분류: 토큰화 중심**

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

### 감점 요인
- 22px / 23px처럼 같은 역할에 불필요한 변형 존재
- component마다 radius 직접 지정
- radius 변경 시 다수 selector를 수정해야 함

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 역할별 radius token | 25 |
| Surface / Control / Inner 구분 | 25 |
| 동일 계층 일관성 | 20 |
| 직접 radius 억제 | 15 |
| Corner mode / responsive 일관성 | 15 |
| **합계** | **100** |

**필수 검사 절차:**
- Main/Add CSS의 `border-radius` 전수 검색
- radius token 정의와 사용처 역추적
- surface/control/inner 계층별 직접값 분류
- rounded/soft-square mode override 확인
- responsive override가 canonical cap/token을 우회하는지 확인

**정량 판정 / 점수 상한:**
- Main과 Add는 독립 채점한다. 확인하지 못한 영역은 `미평가`로 표시하고 다른 영역 점수에 상한을 두지 않는다.
- 동일 역할 component에 근거 없는 서로 다른 직접 radius가 반복되면 해당 일관성 항목 MAJOR
- corner mode가 selector별 개별 override에 의존하면 mode 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- `0`
- `50%` 원형
- pill/circle shape
- 작은 swatch/marker처럼 독립 shape semantic이 명확한 값

---

# 3. Spacing / Density 체계
**분류: 토큰화 중심**

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

### 감점 요인
- 동일 component군에 서로 다른 padding
- viewport마다 임의 px 추가
- margin으로 레이아웃을 억지 보정
- spacing 변경 시 selector 다수를 따로 수정해야 함

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Spacing token coverage | 25 |
| Surface padding 일관성 | 20 |
| Density hierarchy | 20 |
| Responsive density progression | 20 |
| magic spacing 억제 | 15 |
| **합계** | **100** |

**필수 검사 절차:**
- padding/gap/margin 주요 반복값 전수 검색
- spacing/density token 정의-사용 역추적
- 동일 card/KPI/mini 군 비교
- Desktop/Tablet/Mobile 단계별 값 비교
- 개별 margin 보정이 구조적 이유인지 확인

**정량 판정 / 점수 상한:**
- Main과 Add는 독립 채점한다. 확인하지 못한 영역은 `미평가`로 표시하고 다른 영역 점수에 상한을 두지 않는다.
- 동일 component군에서 근거 없는 padding 편차가 반복되면 일관성 MAJOR
- viewport별 임의 보정이 3곳 이상 반복되면 responsive 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- 광학 보정이 필요한 icon/text baseline
- 차트 plot geometry
- 브라우저 기본 control 보정
- 기능적 safe-area/viewport 대응

---

# 4. Card Surface
**분류: 공통화 + 토큰 적용**

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

### 감점 요인
- card마다 독립 surface CSS 반복
- 동일 card군에서 padding/radius 차이
- feature 전용 shell이 사실상 동일한데 중복 유지

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 공통 surface contract | 30 |
| token 적용 | 25 |
| feature 중복 억제 | 20 |
| content/surface 책임 분리 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- card/surface 계열 selector 전수 확인
- 동일 역할 card의 background/border/radius/padding 비교
- feature 전용 shell과 공통 shell 중복 여부 확인
- content layout rule이 surface primitive에 섞였는지 확인

**정량 판정 / 점수 상한:**
- 동일 card군의 surface CSS가 feature별 반복되면 중복 항목 MAJOR
- 공통 surface가 feature-specific 조건으로 비대해지면 책임 분리 MAJOR

**허용 예외 — 감점하지 않음:**
- Hero, modal, warning card 등 의미가 다른 surface
- Add의 독립 token 체계

---

# 5. Section Title / Heading
**분류: 공통화 + 토큰 적용**

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

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Heading primitive 재사용 | 30 |
| typography hierarchy | 25 |
| icon/text/gap 정렬 | 25 |
| control 유무 geometry 안정성 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- section/subsection/chart/info heading selector 비교
- font-size/weight/line-height/gap source 확인
- 우측 control ON/OFF 상태의 DOM/CSS 구조 확인
- Add heading 체계 교차 확인

**정량 판정 / 점수 상한:**
- 같은 hierarchy가 3종 이상 개별 규칙이면 primitive 항목 MAJOR
- control 표시 때문에 row 높이/정렬이 구조적으로 바뀌면 geometry 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- Hero title
- modal title
- report 전용 heading처럼 hierarchy가 다른 경우

---

# 6. Icon + Label
**분류: 공통화 + 토큰 적용**

### 평가 기준
- icon size / baseline / text gap이 공통 규칙을 따르는가
- 같은 label hierarchy가 같은 typography를 사용하는가
- icon alignment를 개별 margin으로 맞추지 않는가
- 기능적으로 다른 icon까지 억지로 하나의 class에 합치지 않는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| icon size/token 일관성 | 25 |
| label typography 일관성 | 25 |
| baseline/gap 공통화 | 25 |
| 의미 다른 icon 예외 보존 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- icon+label 조합 selector와 markup 검색
- icon 크기·vertical-align·gap 비교
- 개별 margin-top/left 보정 검색
- 기능적으로 다른 icon class가 억지 병합됐는지 확인

**정량 판정 / 점수 상한:**
- 동일 hierarchy에서 개별 icon 보정이 반복되면 baseline 항목 MAJOR
- 의미 다른 icon을 하나의 rigid primitive에 강제하면 예외 보존 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- 브랜드/종목 로고
- 상태 아이콘
- SVG viewBox 차이로 인한 국소 광학 보정

---

# 7. Button
**분류: 공통화 + 토큰 적용**

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

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Button primitive | 30 |
| token 적용 | 20 |
| interaction state | 25 |
| 개별 위치 보정 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- button class/selector 전수 확인
- height/padding/radius/typeography 비교
- hover/focus/disabled 상태 확인
- feature별 중복 button CSS 검색
- button에만 붙은 임의 margin/padding 보정 분류

**정량 판정 / 점수 상한:**
- 동일 의미 button이 feature별 독립 구현이면 primitive MAJOR
- focus/disabled 상태 누락은 interaction MAJOR

**허용 예외 — 감점하지 않음:**
- icon-only button
- danger/destructive semantic variant
- native file/date control 버튼

---

# 8. Toggle / Switch / Segmented Control
**분류: 공통화 + 토큰 적용**

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

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 공통 visual grammar | 30 |
| state 표현 | 25 |
| responsive 재사용 | 20 |
| 중복 구현 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- toggle/switch/segmented/tab 계열 selector와 DOM 확인
- active/inactive/focus/aria state 확인
- viewport별 DOM 교체 여부 확인
- 동일 기능의 별도 구현 수 확인

**정량 판정 / 점수 상한:**
- 같은 기능이 서로 다른 primitive 2개 이상으로 중복되면 중복 항목 MAJOR
- viewport마다 별도 DOM으로 갈라지면 responsive 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- native checkbox가 접근성/플랫폼 이유로 유지되는 경우
- Calc tab처럼 semantic role이 다른 control

---

# 9. Table 기본 Contract
**분류: 공통화 중심**

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

### 감점 요인
- 열 순서가 바뀌면 CSS가 깨지는 구조
- table마다 독립 padding/font/alignment 반복
- summary를 위치 기반 selector로만 처리

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| semantic cell contract | 30 |
| table shell 재사용 | 25 |
| position selector 억제 | 20 |
| presentation/계산 분리 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- table selector와 renderer/markup 전수 확인
- `.num`/text/center 등 semantic class 확인
- `nth-child`/위치 기반 selector 전수 검색
- summary/data/header 표현 비교
- renderer가 계산을 직접 소유하는지 확인

**정량 판정 / 점수 상한:**
- 열 의미를 `nth-child`에 주로 의존하면 position 항목 FAIL
- renderer가 feature 계산을 수행하면 책임 분리 MAJOR

**허용 예외 — 감점하지 않음:**
- print-only column width
- 고정 구조 legacy report table
- 접근성 `scope`/caption 관련 selector

---

# 10. Table Summary / Total Row
**분류: 공통화 중심**

### 평가 기준
- 합계/총계/summary row의 weight와 hierarchy가 일관적인가
- 일반 데이터 행과 명확히 구분되는가
- 합계 value와 메모/secondary text의 weight가 적절히 분리되는가
- feature별 같은 summary를 별도 구현하지 않는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| summary hierarchy | 30 |
| weight/alignment 일관성 | 25 |
| secondary text 분리 | 20 |
| 중복 구현 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- summary/total/footer row selector 전수 확인
- font-weight/color/alignment 비교
- 메모/secondary 텍스트가 total weight를 상속하는지 확인
- Main/Add 각각 같은 역할의 중복 규칙 확인

**정량 판정 / 점수 상한:**
- 합계/총계가 일반행과 구분되지 않으면 hierarchy FAIL
- 메모까지 무조건 bold되는 반복 구조면 secondary 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- 법적/회계적 이유로 강조 hierarchy가 다른 특정 total

---

# 11. Asset Detail
**분류: 공통화 중심**

### 평가 대상
- 증권 / 퇴직연금 상세
- 상품행 / 현금행 / 합계행
- neutral View Model / renderer

### 평가 기준
- UI shell은 공통화되어 있는가
- 증권/연금 계산 로직은 feature에 유지되는가
- 현금/현금성자산의 semantic 차이는 보존되는가
- 같은 표현을 위해 계산 로직을 억지 통합하지 않았는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 공통 UI shell | 30 |
| neutral View Model | 25 |
| feature 계산 분리 | 30 |
| 현금 semantic 보존 | 15 |
| **합계** | **100** |

**필수 검사 절차:**
- 증권/퇴직연금 Asset Detail renderer 비교
- 공통 renderer/helper 사용 확인
- View Model 필드와 raw data 처리 위치 확인
- 현금/현금성자산 계산 포함·제외 규칙이 feature에 남는지 확인

**정량 판정 / 점수 상한:**
- 공통 renderer가 raw feature data를 직접 해석하면 View Model MAJOR
- 증권/연금 계산을 하나로 합치면 계산 분리 FAIL

**허용 예외 — 감점하지 않음:**
- feature별 메모/상품명/현금 행 의미 차이

---

# 12. 성과 요약 / 계좌별 보기
**분류: 공통화 중심**

### 평가 기준
- 증권/퇴직연금 성과요약 shell이 일관적인가
- 전체/계좌별 전환이 중복 section이 아닌 상태 전환으로 처리되는가
- KPI visual grammar가 일관적인가
- 전체 합계와 계좌별 합계가 동일한 계산 contract를 사용하는가
- 별도수익 ON/OFF에서 layout 회귀가 없는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Overview shell 공통화 | 25 |
| KPI grammar | 25 |
| 전체/계좌별 state 전환 | 25 |
| 계산 정합성/레이아웃 안정성 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- 증권/연금 overview DOM/renderer 비교
- KPI class/token 비교
- 전체/계좌별이 duplicate section인지 state 전환인지 확인
- 별도수익 ON/OFF 및 합계 산식 source 확인

**정량 판정 / 점수 상한:**
- 동일 overview가 duplicate markup으로 병렬 유지되면 state 항목 MAJOR
- ON/OFF로 layout geometry가 깨지면 안정성 MAJOR

**허용 예외 — 감점하지 않음:**
- 증권만 존재하는 계좌별 기능
- feature별 설명 문구

---

# 13. Mini Card
**분류: 공통화 + 토큰 적용**

### 평가 기준
- mini card군이 padding/radius/label/value/gap을 공유하는가
- 일반 card와 mini card density 차이가 명확한가
- feature별 mini-card 변형이 불필요하게 늘어나지 않는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| mini-card primitive | 30 |
| density token | 25 |
| typography/gap | 20 |
| 변형 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- mini/small KPI card selector 전수 확인
- padding/radius/gap/label/value 비교
- viewport별 density 확인
- feature 전용 변형 수 확인

**정량 판정 / 점수 상한:**
- 동일 mini-card군에 3개 이상 독립 padding/radius가 있으면 primitive MAJOR

**허용 예외 — 감점하지 않음:**
- interactive card
- warning/status mini surface
- report-only metric card

---

# 14. Empty State
**분류: 공통화 중심**

### 평가 기준
- 빈 상태의 typography/alignment/spacing이 일관적인가
- 동일 목적의 empty state가 feature별 중복 구현되지 않는가
- 데이터 없음과 오류 상태를 혼동하지 않는가
- placeholder가 실제 layout을 왜곡하지 않는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Empty-state primitive | 30 |
| typography/alignment | 25 |
| data-empty vs error 구분 | 25 |
| layout 비왜곡 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- empty/no-data/placeholder/error 렌더 검색
- 관련 selector 비교
- error와 empty 메시지 경로 확인
- placeholder가 높이 확보용으로 남는지 확인

**정량 판정 / 점수 상한:**
- error와 empty를 같은 상태로 처리하면 상태 구분 FAIL
- empty state 때문에 layout용 dummy DOM이 반복되면 layout MAJOR

**허용 예외 — 감점하지 않음:**
- skeleton/loading
- preview/sample 상태

---

# 15. Tooltip
**분류: 공통화 + 토큰 적용**

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

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| visual grammar | 25 |
| lifecycle 책임 | 25 |
| 접근성/interaction | 25 |
| feature 예외 분리 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- tooltip selector/renderer 전수 확인
- surface/token 비교
- hover/focus/dismiss/aria 흐름 확인
- chart tooltip과 info tooltip lifecycle 비교
- Add tooltip 존재 시 동일 검토

**정량 판정 / 점수 상한:**
- keyboard 접근이 필요한 tooltip이 hover-only면 accessibility MAJOR
- feature data 계산을 generic tooltip이 소유하면 책임 MAJOR

**허용 예외 — 감점하지 않음:**
- SVG chart tooltip
- native `title` fallback
- pointer-follow tooltip

---

# 16. Modal Surface
**분류: 공통화 + 토큰 적용**

### 평가 기준
- backdrop/panel/header/body/footer/close가 공통 primitive를 사용하는가
- focus trap / ESC / focus return / body lock / inert가 공통 lifecycle로 처리되는가
- modal별 업무 로직은 feature에 남아 있는가
- modal별 open/close 코드가 중복되지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Modal surface primitive | 25 |
| 공통 lifecycle | 30 |
| 접근성/focus | 25 |
| business 책임 분리 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- 모든 modal/dialog open/close 경로 검색
- dashboard-modal canonical 함수 사용 확인
- ESC/focus trap/return/inert/body lock 확인
- feature save/delete/state가 modal module에 섞였는지 확인

**정량 판정 / 점수 상한:**
- modal별 lifecycle 중복이 반복되면 lifecycle MAJOR
- feature persistence가 modal module로 이동하면 책임 분리 FAIL

**허용 예외 — 감점하지 않음:**
- native confirm/alert를 의도적으로 사용하는 단순 경고

---

# 17. Action Form
**분류: 공통화 + 토큰 적용**

### 평가 대상
- input / select / date / numeric
- label / helper / validation / action area

### 평가 기준
- 공통 control primitive를 사용하는가
- validation state와 normal state가 일관적인가
- 업무 validation/persistence를 generic form layer가 소유하지 않는가
- browser/mobile 예외를 공통화 때문에 제거하지 않는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Form primitive | 25 |
| control token/density | 25 |
| validation state | 25 |
| business 책임 분리 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- input/select/date/number/label/helper selector 비교
- validation/error class 확인
- Main pension/KRX와 Add Calc form 교차 확인
- 저장/계산 로직이 generic form helper에 들어갔는지 확인

**정량 판정 / 점수 상한:**
- 동일 control이 feature별 독립 높이/padding을 반복하면 token 항목 MAJOR
- generic form이 persistence를 소유하면 책임 FAIL

**허용 예외 — 감점하지 않음:**
- browser native date appearance
- PIN masking
- 특수 numeric formatting

---

# 18. Date Selector / Input Density
**분류: 공통화 + 토큰 적용**

### 평가 기준
- 날짜/select/input control의 높이·padding·vertical alignment가 일관적인가
- native date picker 동작이 viewport/browser 특성과 충돌하지 않는가
- 같은 control에 임의 top/bottom padding 보정이 남아 있지 않은가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| control height | 25 |
| padding/vertical alignment | 25 |
| native picker 호환 | 25 |
| 개별 보정 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- date/select/input 관련 CSS 전수 비교
- line-height/padding/appearance 확인
- mobile/native date 예외 확인
- top/bottom 보정 selector 검색

**정량 판정 / 점수 상한:**
- 같은 control군 높이가 이유 없이 다르면 height MAJOR
- desktop calendar/mobile native 동작이 깨지면 picker FAIL

**허용 예외 — 감점하지 않음:**
- iOS 확대 방지
- browser-specific date indicator
- inputmode 차이

---

# 19. Chart Card
**분류: 공통화 + 토큰 적용**

### 평가 기준
- chart surface/header/title/legend/control/plot 구조가 공통 grammar를 따르는가
- chart마다 header height/padding이 불필요하게 다르지 않은가
- 확대/토글/legend의 위치를 개별 margin으로 보정하지 않는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Chart card structure | 30 |
| header/legend/control grammar | 25 |
| spacing token | 20 |
| 개별 보정 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- Main chart card와 Add Report chart surface 비교
- header/title/legend/control selector 확인
- padding/gap source 확인
- chart별 margin-top/right 보정 검색

**정량 판정 / 점수 상한:**
- 동일 chart군 header geometry가 반복 분기되면 grammar MAJOR

**허용 예외 — 감점하지 않음:**
- expanded chart
- single-purpose compact sparkline
- print chart

---

# 20. Chart Plot Margin
**분류: 토큰화 중심**

### 평가 대상
- SVG left/right/top/bottom margin

### 평가 기준
- chart별 magic number가 제거되었는가
- 축 유무와 관계없이 plot geometry가 일관적인가
- plot margin이 공통 기준값/계산식으로 관리되는가
- viewport별 예외가 최소화되어 있는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 공통 plot margin source | 30 |
| magic number 억제 | 25 |
| axis 유무 geometry | 25 |
| responsive 예외 최소화 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- 모든 chart의 plot padding/margin 상수 검색
- Main chart 계산식 역추적
- Add Report chart가 별도 라이브러리면 해당 plot contract 확인
- 좌/우축 유무 시 plot start/end 비교
- viewport override 검색

**정량 판정 / 점수 상한:**
- chart별 독립 magic margin이 반복되면 source 항목 MAJOR
- 좌우축 유무로 plot 폭이 달라지면 geometry MAJOR

**허용 예외 — 감점하지 않음:**
- 라이브러리 내부 자동 margin
- legend/title 공간
- expanded/fullscreen 전용 margin

---

# 21. Chart Axis / Zero Alignment
**분류: 로직/상태 공통화**

### 평가 기준
- dual-axis 0선이 일치하는가
- auto Y range 계산이 공통 로직을 사용하는가
- ON/OFF 또는 series toggle에 따라 축이 불필요하게 흔들리지 않는가
- 실제 데이터 범위를 과도하게 낭비하지 않는가
- 특정 chart만 별도 축 계산식을 갖지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 0선 정렬 | 25 |
| 공통 Y-range 로직 | 30 |
| state 안정성 | 25 |
| 공간 효율 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- dual-axis 계산 함수 역추적
- 전체 series/ON-OFF 범위 입력 확인
- 0선 좌표 계산 대조
- 토글/범례 변경 시 range 재계산 조건 확인
- 실데이터 극값으로 clipping/낭비 계산

**정량 판정 / 점수 상한:**
- dual-axis 0선 불일치면 0선 항목 FAIL
- ON/OFF마다 축이 불필요하게 흔들리면 state MAJOR
- data clipping은 range 항목 FAIL

**허용 예외 — 감점하지 않음:**
- 의도된 fixed axis
- 단일축 chart

---

# 22. Chart Legend / Selection State
**분류: 로직/상태 공통화**

### 평가 기준
- 다중선택
- 최소 1개 선택
- 전체선택
- 확대 후 상태 유지
- mode 전환

이 동일 state contract를 공유하는가.

### 감점 요인
- chart마다 별도 selection 구현
- 확대/축소 시 state reset
- 최소 1개 규칙이 component마다 다름

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| selection contract | 30 |
| 최소 1개/전체선택 | 25 |
| expanded state 유지 | 25 |
| mode 전환 일관성 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- legend state source 검색
- 모든 chart handler 비교
- 최소1개 guard 확인
- 확대/축소 시 state source 확인
- 수익률/KOSPI mode와 selection interaction 확인

**정량 판정 / 점수 상한:**
- chart마다 별도 incompatible state 구현이면 contract MAJOR
- expanded에서 state reset이면 유지 항목 FAIL

**허용 예외 — 감점하지 않음:**
- 단일-series chart
- 선택 자체가 없는 chart

---

# 23. Responsive Density
**분류: 토큰화 + 반응형 공통화**

### 평가 기준
- Desktop / Tablet / Mobile density 단계가 일관적인가
- spacing/card/KPI density가 같은 방향으로 compact해지는가
- 임의 breakpoint와 임의 px 보정이 늘어나지 않는가
- component별 responsive density가 서로 어긋나지 않는가

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 3단계 density contract | 30 |
| spacing/card/KPI 방향성 | 25 |
| breakpoint discipline | 25 |
| component 간 일관성 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- Desktop/Tablet/Mobile media 전수 확인
- Main/Add의 padding/gap/font density 비교
- 임의 breakpoint 검색
- 같은 viewport에서 component별 density 역전 여부 확인
- public runtime 가능 시 대표 폭 대조

**정량 판정 / 점수 상한:**
- 근거 없는 추가 breakpoint가 반복되면 discipline MAJOR
- Mobile이 Desktop보다 더 넓은 padding 등 방향성 역전 반복 시 일관성 MAJOR

**허용 예외 — 감점하지 않음:**
- 기능성 phone landscape
- ≤400px 정보 재배치
- print media

---

# 24. Phone Portrait / Landscape
**분류: 반응형 공통화**

### 평가 기준
- landscape가 별도 앱처럼 분리되지 않고 mobile family로 유지되는가
- topbar/table/chart control/typography가 portrait와 의미적으로 일관적인가
- touch/height 조건이 필요한 기능성 예외만 존재하는가
- desktop media와 충돌하지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| mobile family 유지 | 30 |
| topbar/table/chart 일관성 | 25 |
| 기능성 landscape 예외 | 25 |
| desktop media 충돌 방지 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- portrait/mobile과 landscape media 비교
- topbar DOM/CSS 확인
- table/font/control 차이 확인
- hover:none/height 조건 확인
- desktop/tablet media 우선순위 확인

**정량 판정 / 점수 상한:**
- landscape가 별도 desktop UI로 변하면 family FAIL
- desktop media와 충돌해 중복 적용되면 충돌 MAJOR

**허용 예외 — 감점하지 않음:**
- 가로에서 공간상 제거되는 chart 보조버튼
- safe-area/height 제약

---

# 25. Tablet
**분류: 반응형 공통화 + 토큰 적용**

### 평가 기준
- Desktop/Mobile 사이의 중간 density로 자연스럽게 동작하는가
- Tablet 전용 arbitrary component가 과도하게 존재하지 않는가
- hamburger/KPI/card/chart 등이 공통 token과 primitive를 재사용하는가
- 761~1100 기본 구간이 유지되는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 761~1100 구간 유지 | 25 |
| 중간 density | 25 |
| 공통 primitive 재사용 | 25 |
| Tablet 전용 중복 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- tablet.css와 관련 media 확인
- KPI/card/topbar/chart density 비교
- mobile/desktop primitive class 재사용 확인
- tablet-only component/markup 검색

**정량 판정 / 점수 상한:**
- 새 arbitrary breakpoint로 tablet 의미가 분할되면 구간 항목 MAJOR
- tablet-only duplicate component가 반복되면 중복 MAJOR

**허용 예외 — 감점하지 않음:**
- hamburger 전환
- tablet에서만 필요한 column count

---

# 26. Topbar / Navigation
**분류: 공통화 중심**

### 평가 기준
- 년월/일/테마/hamburger/navigation control이 일관된 primitive를 사용하는가
- Desktop/Tablet/Mobile 역할 차이가 명확한가
- topbar height/alignment가 state에 따라 흔들리지 않는가
- viewport별 중복 markup이 최소화되어 있는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 공통 control primitive | 25 |
| viewport 역할 분리 | 25 |
| geometry 안정성 | 25 |
| markup 중복 억제 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- topbar/nav DOM 확인
- year/month/day/theme/hamburger selector 비교
- Desktop/Tablet/Mobile visibility rule 확인
- state 전환 시 row height 영향 확인
- viewport별 duplicate markup 검색

**정량 판정 / 점수 상한:**
- 동일 control이 viewport별 별도 markup으로 반복되면 중복 MAJOR
- state에 따라 topbar 높이가 흔들리면 geometry MAJOR

**허용 예외 — 감점하지 않음:**
- 접근성상 필요한 duplicate label
- desktop-only TOC vs mobile hamburger

---

# 27. Source / Ledger / Symbol 예외
**분류: 예외/불변조건 정리**

### 평가 기준
- 의미가 다른 component를 외형이 비슷하다는 이유로 억지 공통화하지 않는가
- 공통 primitive는 재사용하되 고유 semantic은 유지되는가
- 예외가 근거 없이 늘어나지 않는가
- 예외를 수정할 때 generic contract를 훼손하지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 예외 semantic 타당성 | 30 |
| 공통 primitive 재사용 | 25 |
| 예외 수 통제 | 20 |
| generic contract 보호 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- Source/Ledger/Symbol 관련 selector와 renderer 확인
- 공통 surface/table/token 재사용 여부 확인
- 예외 selector 수와 사유 확인
- 예외가 generic selector를 override해 다른 영역에 leakage하는지 확인

**정량 판정 / 점수 상한:**
- 의미 차이 없이 예외가 누적되면 예외 수 항목 MAJOR
- 예외 수정이 generic contract를 깨면 보호 항목 FAIL

**허용 예외 — 감점하지 않음:**
- 실제 semantic/시각 역할이 다른 Source/Ledger/Symbol 고유 표현

---

# 28. Account / Portfolio 표현
**분류: 공통화 중심**

### 평가 기준
- 투자 결과물/투입원금/누적손익/메모의 hierarchy가 일관적인가
- summary/detail의 visual grammar가 공통화되어 있는가
- 숫자/텍스트 정렬 contract가 table/card 양쪽에서 일관적인가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| visual hierarchy | 25 |
| summary/detail grammar | 25 |
| 정렬 contract | 25 |
| 메모/secondary 일관성 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- 투자결과물/투입원금/누적손익/메모 renderer와 CSS 비교
- card/table 숫자 정렬 확인
- summary/detail typography 비교
- 모바일/계좌별 표현 대조

**정량 판정 / 점수 상한:**
- 같은 의미 값이 card/table에서 반대 정렬이면 정렬 MAJOR
- summary hierarchy가 계좌별마다 다르면 grammar MAJOR

**허용 예외 — 감점하지 않음:**
- 메모는 regular weight 등 semantic 차이

---

# 29. 전일 대비 변동 표현
**분류: 공통화 중심**

### 평가 기준
- 증권/퇴직연금의 전일종가/당일종가/일변동/등락률 의미가 동일한가
- 동일 포맷과 semantic class를 사용하는가
- 좁은 화면에서도 정보 의미가 유지되는가
- 특정 viewport 표현 변경이 다른 viewport로 leakage되지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| 의미/포맷 통일 | 30 |
| semantic class/renderer | 25 |
| narrow layout 의미 보존 | 25 |
| viewport leakage 방지 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- 증권/연금 변동표 renderer 비교
- 전일/당일/일변동/% 포맷 함수 확인
- ≤400px CSS/DOM 확인
- 401px 이상 leakage 여부 정적 확인
- runtime 가능 시 대표 폭 확인

**정량 판정 / 점수 상한:**
- 증권/연금 계산 의미가 다르면 통일 항목 FAIL
- ≤400px 변경이 상위 viewport에 새면 leakage FAIL

**허용 예외 — 감점하지 않음:**
- 현금/현금성자산의 계산 포함 여부 차이

---

# 30. Market AI Frontend Surface
**분류: 공통화 중심 + 책임 분리**

### 평가 기준
- 메인 card/modal/tooltip primitive를 재사용하는가
- 현재 시장·AI Signal panel의 polling/state/snapshot/signal render는 `dashboard-market-ai.js` standalone이 소유하고, KST 오늘 및 제한된 직전 완료 거래일 보유종목 평가 overlay는 `dashboard-live-valuation.js`가 별도 소유하는가
- standalone Signal panel이 main `dataState/uiState`에 직접 결합하지 않으며, live valuation만 `dataState.liveValuation`의 휘발성 계산 입력을 사용하는 책임 경계를 지키는가
- Snapshot / Signal / KIS Bridge 실패를 격리하는가
- 비로컬 환경은 실제 endpoint 응답이 확인되기 전 Market AI UI를 mount하지 않고, 전체 연결 실패 시 panel·button·dialog를 제거한 채 polling으로 복구를 기다리는가
- 전체 연결 실패는 `OFFLINE`으로 종료해 panel을 제거하고 자동 polling을 멈추며, 사용자 재시도 전까지 서버 요청을 반복하지 않는가
- display logic과 Signal 계산 책임이 분리되어 있는가
- live valuation은 backend `usable/state/market_state/source`를 소비할 뿐 durable DB 복구 조건을 frontend에서 재계산하지 않는가. 장마감 `closed + usable`은 허용하되 unusable 종목은 개별 JSON fallback하는가
- embedded `실시간 시세` Monitor는 read-only iframe 관찰면으로 유지되어 Dashboard live valuation `client_id` lease를 생성·연장하지 않는가
- SOX 표시와 Signal 입력이 모두 `INDEX:SOX` contract를 유지하며 `SOX-F` 또는 `FUTURES:SOX`로 임의 전환되지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| main primitive 재사용 | 20 |
| standalone state | 25 |
| 실패 격리 | 20 |
| display/Signal 책임 분리 | 20 |
| main state 비결합 | 15 |
| **합계** | **100** |

**필수 검사 절차:**
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

**정량 판정 / 점수 상한:**
- main feature state 직접 결합 시 비결합 FAIL
- Signal 계산 또는 durable quote 승격 조건을 frontend display 로직이 재해석하면 책임 분리 FAIL
- 비로컬 미연결 상태에서 빈 Market AI UI를 노출하거나 전체 실패 후 polling 복구를 중단하면 실패 격리 항목 MAJOR
- Preview/sample 실행 경로 또는 SOX-F 자동 전환이 재도입되면 display/Signal 책임 분리 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- standalone 전용 polling/cache/state
- `dataState.liveValuation`의 휘발성 screen-only quote snapshot 사용

---

# 31. Add Calc UI
**분류: 토큰화 + 공통화**

### 평가 기준
- add 내부 surface/control/input/button/radius/spacing이 자체 token 체계를 사용하는가
- main과 비슷하다는 이유로 강제 공유하지 않는가
- Calc layout과 common primitive 책임이 분리되는가
- 접근성 label/tab/tooltip contract가 유지되는가

### 고정 채점 Rubric

**검사 범위:** Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| Add 자체 token·독립성 | 25 |
| Calc primitive 공통화 | 25 |
| layout/primitive 책임 분리 | 25 |
| 접근성 contract | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- `add/add.css`의 공통 token/primitive와 `data-add-page="calc"` scope 전수 확인
- `add/add.css`의 Shared 영역과 Calc 전용 layout 책임 비교
- input/button/card selector 중복 확인
- `calc.html`과 `add/add.js`의 label/tab/tooltip 및 선택상태 ARIA 확인
- `add/add.js`의 Calc boot·계산 engine·render/event 책임 경계 확인
- 메인 CSS 강제 의존성 여부 확인

**정량 판정 / 점수 상한:**
- 메인 CSS에 직접 의존하면 Add 자체 token·독립성 항목 MAJOR
- `data-add-page="calc"` scope가 Shared primitive를 대량 재정의하면 Calc primitive 공통화 항목 MAJOR
- Calc 전용 layout 규칙이 Shared primitive에 섞여 Report까지 누출되면 layout/primitive 책임 분리 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- Add가 메인과 별도 token 파일을 갖는 것 자체
- Calc 전용 layout

---

# 32. Add Report
**분류: 공통화 중심**

### 평가 기준
- KPI/table/chart/timeline/card의 visual grammar가 일관적인가
- 동일 metric이 숫자와 chart에서 같은 계산 source를 사용하는가
- responsive에서 날짜/순서/수치 의미가 사라지지 않는가
- canonical report 한 파일 원칙이 유지되는가

### 고정 채점 Rubric

**검사 범위:** Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| visual grammar | 25 |
| 동일 metric single source | 30 |
| responsive 의미 보존 | 25 |
| canonical report 원칙 | 20 |
| **합계** | **100** |

**필수 검사 절차:**
- `add/kodex-leverage-report.html`과 공통 runtime인 `add/add.css` / `add/add.js` 확인
- KPI/table/chart/timeline metric 계산 source 추적
- 모바일에서 날짜/순서/수치 식별 가능성 확인
- 날짜형/병렬 report 파일 존재 여부 확인
- runtime 가능 시 Add Report URL 확인

**정량 판정 / 점수 상한:**
- 같은 metric이 화면 위치별 다른 계산식을 쓰면 single source FAIL
- canonical 외 병렬 report가 운영본으로 존재하면 canonical MAJOR

**허용 예외 — 감점하지 않음:**
- 증권사 원본 이미지의 고정 과거 수치
- 설명용 caption

---

# 33. JavaScript Common Helper
**분류: 구조/책임 정리**

### 평가 기준
- `dashboard-core.js`가 DOM-free인가
- `dashboard-ui-common.js`가 presentation helper 책임만 갖는가
- feature → common dependency 방향이 유지되는가
- common → feature 역방향 import가 없는가
- helper가 무분별한 misc dumping ground가 되지 않는가
- global/window bridge가 재등장하지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| core DOM-free | 20 |
| ui-common 책임 | 20 |
| dependency direction | 25 |
| helper 응집도 | 20 |
| global bridge 부재 | 15 |
| **합계** | **100** |

**필수 검사 절차:**
- dashboard-core.js DOM/window/document 검색
- dashboard-ui-common.js import/export 확인
- 전체 ES module import graph 생성
- common→feature 역방향 import 검색
- window/global assignment 검색
- helper 함수 책임 샘플/전수 분류

**정량 판정 / 점수 상한:**
- core가 DOM 접근하면 core 항목 FAIL
- common→feature cycle/역참조면 dependency FAIL
- global bridge 재등장 시 해당 항목 MAJOR

**허용 예외 — 감점하지 않음:**
- browser capability check가 UI-common에 존재
- 명시적 public integration hook

---

# 34. Modal Lifecycle Module
**분류: 구조/책임 정리 + 공통화**

### 평가 기준
- modal lifecycle이 `dashboard-modal.js` 등 canonical module에 모여 있는가
- open/close/ESC/focus/inert/body lock이 중복 구현되지 않는가
- feature별 business state/persistence는 modal module로 넘어오지 않는가
- modal 공통화가 feature coupling을 만들지 않는가

### 고정 채점 Rubric

**검사 범위:** Main

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| canonical lifecycle module | 30 |
| 중복 제거 | 20 |
| focus/inert/body lock | 25 |
| feature 책임 분리 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- dashboard-modal.js API 확인
- 모든 dialog의 open/close 호출처 검색
- ESC/backdrop/focus trap 구현 중복 검색
- feature save/delete/polling이 modal module에 없는지 확인

**정량 판정 / 점수 상한:**
- modal별 독립 lifecycle 반복 시 중복 MAJOR
- business persistence가 modal module에 있으면 책임 분리 FAIL

**허용 예외 — 감점하지 않음:**
- 아주 단순한 native confirm
- non-modal popover

---

# 35. 표현 공통화와 계산 책임 분리
**분류: 아키텍처 불변조건**

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

### 가장 큰 감점 요인
- 공통화를 명분으로 계산/상태/persistence를 한 모듈에 통합
- common component 내부에 feature-specific 분기 누적
- View Model 없이 raw feature data를 generic renderer가 직접 해석
- “중복 제거”를 위해 의미가 다른 로직까지 합침

### 고정 채점 Rubric

**검사 범위:** Main + Add

**고정 배점:**

| 세부 항목 | 배점 |
|---|---:|
| presentation 공통화 경계 | 25 |
| 계산 feature 소유 | 25 |
| state/persistence feature 소유 | 25 |
| common layer 비대화 방지 | 25 |
| **합계** | **100** |

**필수 검사 절차:**
- 공통 renderer/helper가 raw feature data를 해석하는지 검색
- 계산 함수 위치와 import graph 확인
- state/persistence owner 확인
- common module의 feature-specific 조건문 검색
- Add가 메인 계산/상태에 결합되지 않는지 확인

**정량 판정 / 점수 상한:**
- 계산을 공통화 명분으로 합치면 계산 소유 FAIL
- state/persistence가 generic common으로 이동하면 소유 FAIL
- common이 feature-specific 분기 저장소가 되면 비대화 MAJOR

**허용 예외 — 감점하지 않음:**
- neutral View Model
- format/date/math 같은 순수 helper
- 공통 modal lifecycle

---

# 36. 카테고리별 종합 평가

35개 개별 점수 외에 다음 카테고리별 평균도 제공한다.

### A. 순수 토큰화
- 1 색상
- 2 Corner
- 3 Spacing/Density
- 20 Chart Plot Margin

### B. 공통화 + 토큰 적용
- 4 Card
- 5 Heading
- 6 Icon+Label
- 7 Button
- 8 Toggle
- 13 Mini Card
- 15 Tooltip
- 16 Modal Surface
- 17 Action Form
- 18 Input Density
- 19 Chart Card
- 23 Responsive Density
- 25 Tablet
- 31 Add Calc UI

### C. Component / 표현 공통화
- 9 Table
- 10 Summary Row
- 11 Asset Detail
- 12 성과 요약
- 14 Empty State
- 26 Topbar
- 28 Account/Portfolio
- 29 전일 대비
- 30 Market AI Frontend
- 32 Add Report

### D. 로직 / 상태 공통화
- 21 Chart Axis
- 22 Chart Selection

### E. Responsive 공통화
- 23 Responsive Density
- 24 Phone Portrait/Landscape
- 25 Tablet

### F. 구조 / 책임 / Architecture
- 27 예외 책임
- 30 Market AI 책임 분리
- 33 JS Common Helper
- 34 Modal Lifecycle
- 35 표현/계산 책임 분리

> 23, 25, 30은 성격상 두 카테고리에 동시에 포함될 수 있다.  
> 카테고리 평균에서는 각 카테고리의 특성을 독립적으로 평가한다.  
또한 **Main 카테고리 평균과 Add 카테고리 평균을 별도로 계산**하며, 같은 번호가 두 카테고리에 속해도 각 카테고리 분석용으로만 중복 포함하고 해당 영역 전체 평균에는 번호당 한 번만 반영한다.

---

# 37. 평가 출력 형식

사용자가 `평가해줘`라고 요청했을 때 권장 출력은 다음과 같다.

## 37.1 전체 요약

Main과 Add를 하나의 점수로 합치지 않는다.

### Main

| 구분 | 점수 | 판정 |
|---|---:|---|
| 순수 토큰화 | 00/100 | |
| 공통화 + 토큰 적용 | 00/100 | |
| Component / 표현 공통화 | 00/100 | |
| 로직 / 상태 공통화 | 00/100 | |
| Responsive 공통화 | 00/100 | |
| 구조 / 책임 / Architecture | 00/100 | |
| **Main 전체** | **00/100** | |

### Add

| 구분 | 점수 | 판정 |
|---|---:|---|
| 순수 토큰화 | 00/100 또는 N/A | |
| 공통화 + 토큰 적용 | 00/100 또는 N/A | |
| Component / 표현 공통화 | 00/100 또는 N/A | |
| 로직 / 상태 공통화 | 00/100 또는 N/A | |
| Responsive 공통화 | 00/100 또는 N/A | |
| 구조 / 책임 / Architecture | 00/100 또는 N/A | |
| **Add 전체** | **00/100** | |

## 37.2 개별 평가

각 항목은 다음 형식으로 평가한다.

### 1. 색상·Semantic Color 체계

| 영역 | 점수 | 판정 | 수정 필요 |
|---|---:|---|---|
| **Main** | 00/100 또는 N/A | | 없음 / A급 / B급 / C급 |
| **Add** | 00/100 또는 N/A | | 없음 / A급 / B급 / C급 |

#### Main
- 잘 된 점:
- 확인 근거:
- 감점 요인:
- 점수 산식:

#### Add
- 잘 된 점:
- 확인 근거:
- 감점 요인:
- 점수 산식:

`Main + Add` 항목에서도 **통합 점수는 표시하지 않는다.**

이 형식을 전체 평가에서는 1~35까지 반복한다. 사용자가 특정 번호만 요청한 경우에는 그 항목만 출력한다.

개별 항목의 점수는 반드시 해당 항목의 **고정 배점표**를 사용해 `PASS / MINOR / MAJOR / FAIL`을 결정한 뒤 합산한다. 평가자가 임의로 `-2점`, `-7점` 같은 별도 감점표를 만들지 않는다.

`Main + Add` 항목은 같은 고정 배점표를 Main과 Add에 각각 독립 적용한다. `Main 100 / Add 74`를 `87점`으로 합치지 않는다.

## 37.3 수정 대상 요약

수정 대상은 **Main / Add를 분리**해서 기록한다.

### Main
- A급:
- B급:
- C급:

### Add
- A급:
- B급:
- C급:

한쪽에만 결함이 있으면 다른 쪽을 함께 수정하지 않는다.

---

# 38. 평가 시 금지사항

- 각 항목의 고정 배점표를 무시하고 평가자 임의의 배점을 만들지 않는다.
- Main+Add 항목에서 Main/Add를 평균내어 하나의 점수로 만들지 않는다.
- 한쪽 영역의 결함을 다른 영역 점수에 전가하지 않는다.
- 전수검사가 필수인 항목을 표본 몇 개만 보고 100점으로 판정하지 않는다.
- token 개수가 많다고 높은 점수를 주지 않는다.
- 공통 class가 많다고 높은 점수를 주지 않는다.
- 파일 수가 적다고 높은 점수를 주지 않는다.
- 중복 제거 자체를 목적으로 feature 의미를 훼손하지 않는다.
- 공통화를 위해 계산·state·persistence 책임을 common으로 이동시키지 않는다.
- 이미 안정적인 구조를 “더 공통화”하기 위한 리팩터링을 권하지 않는다.
- CSS 변수 하나를 추가하는 것만으로 토큰화 완료라고 평가하지 않는다.
- 현재 동작을 소스 근거 없이 추정하지 않는다.
- handover와 실제 소스가 다르면 실제 소스를 확인하고 불일치를 별도로 보고한다.
- QA 결과나 특정 시점 UI 값은 이 문서에 자동 누적하지 않는다.

---

# 39. 문서 유지관리 원칙

이 문서는 **35개 평가 기준 자체가 바뀔 때만 수정한다.**

다음은 문서 수정 사유가 아니다.

- 단순 CSS/JS 수정
- 특정 버그 수정
- 특정 viewport 정렬 변경
- 새로운 QA PASS
- 특정 카드 padding 변경
- 특정 chart margin 변경
- 개별 component의 일회성 개선

다음의 경우에만 수정한다.

- 평가 항목 자체가 추가/삭제되는 경우
- 공통화/토큰화의 장기 기준이 변경되는 경우
- architecture responsibility 기준이 변경되는 경우
- 평가 점수 체계나 A/B/C 판정 방식이 변경되는 경우

**이 문서는 수정 이력이 아니라 공통화·토큰화 평가 contract다.**
