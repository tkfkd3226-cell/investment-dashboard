# 투자 대시보드

삼성증권 증권계좌와 퇴직연금 계좌의 **날짜별 투자 성과를 복원·검산·분석하기 위한 정적 웹 대시보드**입니다.

메인 화면은 GitHub Pages에서 제공하며, KRX 가격과 성과 스냅샷은 GitHub Actions + Python으로 갱신합니다. 퇴직연금 금액 조정과 KRX 갱신 요청처럼 브라우저에서 직접 파일을 수정할 수 없는 쓰기 작업은 Google Apps Script 웹 앱을 통해 연결합니다.

이 저장소는 단순 시세 조회 화면이 아니라 다음 세 가지를 함께 관리하는 것을 목표로 합니다.

1. **현재 보유 현황** — 증권계좌와 퇴직연금의 자산·손익·비중
2. **날짜별 복원** — 과거 특정 날짜의 계좌 상태와 성과 재구성
3. **장부 검산** — 실제 보유액, 투자원금, 실현손익, 현금 흐름의 일관성 확인

---

## 핵심 기능

### 증권계좌

- 날짜별 증권계좌 성과 복원
- 투자원금·평가금액·누적손익·수익률 조회
- 계좌별 성과 요약과 보유 종목 현황
- 장부결과 VS 실제보유 검산
- 투자원금 원천 및 현금 흐름 확인
- 별도수익 ON/OFF 비교
- KOSPI 대비 초과성과 확인

### 퇴직연금

- 퇴직연금 계좌의 날짜별 성과 및 상품 현황
- 상품별 손익·비중·인사이트
- 위험자산 비중 관리
- 기업적립금·현금성자산·ETF 추가매수 조정
- PIN 기반 저장·삭제 흐름
- 여러 변경사항을 모아 적용하는 batch 처리

### 차트 / 분석

- 누적손익 및 누적수익률
- KOSPI 비교
- 자산·종목 비중 변화
- 증권계좌 / 퇴직연금 관련 기간 차트
- 범례 다중선택 및 최소 1개 유지
- 전체 선택
- Y축 자동 재계산 ON/OFF
- 차트 확대 보기
- Desktop / Tablet / Mobile 반응형 tooltip 및 조작 UI

### 데이터 갱신

- KRX 현재가 **최신/누락 반영**
- 선택된 날짜 **재갱신**
- GitHub Actions 수동 실행을 통한 가격 및 성과 스냅샷 갱신
- 과거 거래일 보완 및 과거 장중 데이터의 종가 확정

### 부가 도구

- 투자 계산기: `add/calc.html`
- 기간별 거래/성과 리포트: `add/report/`
- Light / Dark 테마
- 모바일 날짜 고정 ON/OFF

---

## 전체 동작 구조

메인 화면은 `index.html`에서 시작하고, `dashboard-app.js`가 **단일 ES Module entry point**로 6개 기능/공통 모듈을 조율합니다.

```text
GitHub Pages / Browser
        │
        ├─ index.html
        ├─ css/style.css
        │
        └─ js/dashboard-app.js  ← entry / orchestration
               │
               ├─ dashboard-core.js
               ├─ dashboard-ui-common.js
               ├─ dashboard-charts.js
               ├─ dashboard-ui.js
               ├─ dashboard-pension.js
               └─ dashboard-pension-editor.js
               │
               ├─────────────── 읽기 ───────────────┐
               │                                    ▼
               │                              data/*.json
               │
               └─────────────── 쓰기 요청 ──────────┐
                                                    ▼
                                      Google Apps Script Web App
                                  (GitHub 저장소와 별도 관리·별도 배포)
                                                    │
                              ┌─────────────────────┴─────────────────────┐
                              │                                           │
                              ▼                                           ▼
                    퇴직연금 데이터 저장·삭제                      KRX 현재가 반영 요청
                              │                                           │
                              ▼                                           ▼
                       GitHub REST API                         GitHub Actions workflow_dispatch
                              │                                           │
                              ▼                                           ▼
              pension_*.json 직접 commit                    .github/workflows/update-prices.yml
                                                                          │
                                                                          ▼
                                                               scripts/update_prices.py
                                                                          │
                                                           ┌──────────────┴──────────────┐
                                                           ▼                             ▼
                                                   data/prices.json       data/performance_snapshots.json
```

프론트엔드는 별도 번들러나 프레임워크 없이 **HTML + CSS + Vanilla JavaScript ES Module**로 동작합니다. 조회 데이터는 GitHub Pages의 JSON을 읽고, 브라우저에서 직접 GitHub에 쓰지 않습니다. 퇴직연금 쓰기와 KRX 갱신 요청은 **GitHub 저장소와 별도로 관리·배포되는 Google Apps Script Web App**을 거칩니다.

---

## 프로젝트 구조

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
│  └─ update-prices.yml
├─ requirements.txt
├─ start-local-server.bat
└─ 메인대시보드 수정 시 반드시 확인할 사항 및 채팅창 인수인계.md
```

### Google Apps Script 관리 및 배포

Google Apps Script(GAS)는 **GitHub 저장소에 포함하지 않고 Google Apps Script 프로젝트에서 별도로 관리**합니다.

- GAS 소스의 source of truth는 Google Apps Script 프로젝트의 최신 단일 `Code.gs`입니다.
- 따라서 최신 GitHub ZIP에 `gas/Code.gs` 또는 `gas/` 폴더가 없는 것은 정상입니다.
- GAS 수정이 필요할 때는 GitHub ZIP의 파일을 추정하지 않고, **현재 Apps Script에서 운영 중인 최신 `Code.gs` 전체를 별도로 확보한 뒤 그 코드만 기준으로 수정**합니다.
- `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TOKEN`, `ADMIN_PIN` 같은 운영 값은 Apps Script의 **Script Properties**에서 관리하며 GitHub 저장소에 넣지 않습니다.
- 프런트엔드는 배포된 GAS Web App URL을 호출합니다. 현재 호출 URL은 메인 JS의 API 설정에서 관리합니다.

배포 구조:

```text
Google Apps Script 프로젝트
└─ 단일 Code.gs
      │
      ├─ Script Properties
      │    ├─ GITHUB_OWNER
      │    ├─ GITHUB_REPO
      │    ├─ GITHUB_BRANCH
      │    ├─ GITHUB_TOKEN
      │    └─ ADMIN_PIN
      │
      ▼
Web App 배포
      │
      ▼
배포 URL (/exec)
      │
      ▼
GitHub Pages의 dashboard JS가 HTTPS 요청
```

`Code.gs`를 수정한 경우에는 **운영 Web App 배포를 새 코드 버전으로 갱신해야 실제 `/exec` 호출에 반영**됩니다. 가능하면 기존 운영 배포를 갱신하여 URL을 유지하고, 새 Web App URL을 사용하는 경우에는 메인 JS의 API URL도 함께 변경해야 합니다.

---

## JavaScript 아키텍처

메인 JavaScript는 **7개 ES Module**로 구성되어 있으며 `dashboard-app.js`가 단일 entry point입니다.

| 파일 | 책임 |
|---|---|
| `dashboard-core.js` | 공통 데이터 state, JSON 로딩, 계산, formatter, 데이터 helper |
| `dashboard-ui-common.js` | 여러 UI 모듈이 공유하는 저수준 DOM·접근성·마크업 helper |
| `dashboard-charts.js` | 차트 state, SVG 렌더링, 범례, tooltip, 확대, 반응형, 차트 action routing |
| `dashboard-ui.js` | Topbar, Navigation, 일반 카드·표·모달, KRX UI, UI action routing |
| `dashboard-pension.js` | 퇴직연금 **View** — 현황, 상품 정보, 인사이트, 시각화 tooltip |
| `dashboard-pension-editor.js` | 퇴직연금 **Editor** — 금액조정, PIN, batch, 저장·삭제 |
| `dashboard-app.js` | 날짜·별도수익 등 cross-module 흐름, 전체 render orchestration, 초기화·boot |

### Dependency 방향

아래 표기에서 **`A → B`는 A가 B를 import한다는 의미**입니다. 현재 실제 import 관계는 다음과 같습니다.

```text
dashboard-core.js
└─ 다른 메인 JS 모듈을 import하지 않음

dashboard-ui-common.js
└─ dashboard-core.js

dashboard-charts.js
├─ dashboard-core.js
└─ dashboard-ui-common.js

dashboard-ui.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
└─ dashboard-charts.js

dashboard-pension.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
├─ dashboard-charts.js
└─ dashboard-ui.js

dashboard-pension-editor.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
└─ dashboard-ui.js

dashboard-app.js
├─ dashboard-core.js
├─ dashboard-ui-common.js
├─ dashboard-charts.js
├─ dashboard-ui.js
├─ dashboard-pension.js
└─ dashboard-pension-editor.js
```

현재 구조에서는 **순환 dependency를 만들지 않는 것**이 기본 원칙입니다.

### State ownership

- 여러 모듈이 공유해야 하는 데이터 state만 `dashboard-core.js`에 둡니다.
- chart runtime state는 `dashboard-charts.js`가 소유합니다.
- 퇴직연금 Editor의 batch/runtime state는 `dashboard-pension-editor.js`가 소유합니다.
- 특정 모듈 내부 DOM이나 state를 다른 모듈이 직접 조작하지 않고 필요한 경우 공개 API를 사용합니다.
- `window` / `globalThis`에 기능 API를 매달아 dependency를 우회하지 않습니다.


---

## CSS / Responsive 구조

메인 대시보드 CSS는 다음 단일 파일을 사용합니다.

```text
css/style.css
```

역할별 CSS 파일을 추가로 나누지 않고, 각 기능 섹션 안에서 기본 규칙과 반응형 규칙을 함께 관리합니다.

기본 viewport 기준:

```text
Desktop : 1101px 이상
Tablet  : 761px ~ 1100px
Mobile  : 760px 이하
```

추가 breakpoint는 특정 기능에 실제로 필요한 경우에만 사용합니다.

유지보수 시 기본 원칙:

- canonical selector를 직접 수정
- 후행 `final override` 누적 금지
- 불필요한 `!important` 추가 금지
- 임의의 신규 breakpoint 남발 금지
- Light / Dark 양쪽 상태 확인
- Desktop / Tablet / Mobile UI 일관성 유지

---

## 데이터 파일

| 파일 | 용도 |
|---|---|
| `portfolio.json` | 보유자산, 투자원금 기준, 자금 이벤트 및 기본 포트폴리오 정보 |
| `prices.json` | 날짜별 종목·상품 가격 및 지수 데이터 |
| `performance_snapshots.json` | 날짜별 성과 스냅샷 |
| `account1_daily_snapshots.json` | 증권계좌 일별 복원 데이터 |
| `pension_contributions.json` | 퇴직연금 적립 및 조정 데이터 |
| `pension_cash_snapshots.json` | 퇴직연금 현금성자산 스냅샷 |
| `pension_trades.json` | 퇴직연금 거래 이력 |

대시보드는 이 데이터들을 결합하여 선택 날짜의 계좌 상태를 계산하고 화면을 렌더링합니다.

### 운영 데이터 보호

특히 아래 3개는 GitHub에 소스 패치를 반영할 때 주의해야 하는 실제 운영 데이터입니다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
```

과거 ZIP이나 수정용 ZIP에 들어 있는 데이터를 현재 운영본 위에 무심코 덮어쓰지 않습니다.

- `prices.json`, `performance_snapshots.json`은 KRX workflow로 재생성 가능한 영역이 있습니다.
- `pension_contributions.json`은 사용자 입력 기반 운영 데이터이므로 특히 보존에 주의합니다.

코드 수정 ZIP은 원칙적으로 **변경된 소스 파일만** 포함하고 운영 JSON은 요청이 없는 한 넣지 않습니다.

---

## KRX 가격 갱신

대시보드에서 KRX 가격 갱신은 **날짜 입력창을 직접 사용하는 방식이 아닙니다.** 화면의 두 버튼이 요청에 `date`를 포함할지 여부를 결정합니다.

### 대시보드의 KRX 버튼

- **최신/누락 반영**
  - GAS 요청에 `date`를 보내지 않습니다.
  - GAS가 현재 한국시간, `prices.json`의 최신 데이터, 장중/종가 상태를 확인합니다.
  - 필요한 경우에만 `update-prices.yml`을 `workflow_dispatch`로 실행합니다.
  - 오늘 데이터 갱신, 누락 거래일 보완, 저장된 장중 데이터의 종가 확정이 이 흐름에 포함됩니다.
- **재갱신**
  - 현재 대시보드에서 선택되어 있는 `activeDate`를 JS가 요청의 `date`로 자동 전달합니다.
  - GAS는 **요청에 명시적 `date`가 포함된 재갱신 요청**으로 판단하여 해당 날짜의 workflow를 실행합니다.
  - 사용자가 날짜를 별도의 입력칸에 다시 입력하는 기능은 없습니다.

```text
최신/누락 반영
Browser → GAS (date 없음)
        → 최신/누락/장중 상태 판단
        → 필요한 경우 workflow_dispatch

재갱신
Browser → GAS (date = 현재 activeDate)
        → 해당 날짜 workflow_dispatch
```

### GitHub Actions / Python 처리

GitHub Actions workflow:

```text
.github/workflows/update-prices.yml
```

실행 스크립트:

```text
scripts/update_prices.py
```

기본 처리 흐름:

```text
GAS 또는 GitHub Actions 수동 실행
→ Update KRX closing prices
→ Python 3.11 설정
→ requirements.txt 설치
→ scripts/update_prices.py 실행
→ prices.json / performance_snapshots.json 변경 확인
→ 변경이 있으면 자동 commit + push
```

GitHub Actions 화면에서 workflow를 **직접 수동 실행하는 운영/개발 경로**에는 선택적인 `YYYY-MM-DD` input이 있습니다. 이 input은 대시보드 UI의 날짜 입력 기능이 아닙니다. 날짜를 명시하면 해당 날짜를 처리하고, 날짜를 명시하지 않으면 Python 스크립트가 최신/누락/재확정이 필요한 날짜를 자동으로 결정합니다.

과거 날짜를 명시적으로 재갱신하는 경우 실행 시각이 장중이어도 과거 데이터는 종가 데이터로 취급합니다.

---

## 퇴직연금 편집 흐름

퇴직연금은 조회와 편집 책임을 분리합니다.

```text
dashboard-pension.js
→ 보여주는 View

dashboard-pension-editor.js
→ 변경하고 저장하는 Editor
```

Editor의 주요 흐름:

```text
금액조정 모달
→ 입력 및 변경사항 구성
→ 필요 시 batch queue / simulation
→ PIN 확인
→ Google Apps Script 요청
→ 성공 시 로컬 데이터 반영 및 dashboard 재렌더
```

실제 저장·삭제 요청은 QA 목적으로 임의 실행하지 않습니다.

---

## 로컬 실행

JSON 데이터를 `fetch()`로 읽기 때문에 `index.html`을 `file://`로 직접 열기보다 로컬 HTTP 서버를 사용합니다.

Windows에서는 프로젝트 루트의:

```text
start-local-server.bat
```

을 실행합니다.

기본 주소:

```text
http://localhost:8000/
```

배치 파일은 `python` 또는 `py` 명령을 찾아 Python 내장 HTTP 서버를 실행하고 브라우저를 엽니다.

직접 실행하려면:

```bash
python -m http.server 8000
```

또는 Windows Python Launcher를 사용하는 경우:

```bash
py -m http.server 8000
```

서버 창을 닫으면 로컬 서버도 종료됩니다.

---

## GitHub Pages 배포

메인 대시보드는 GitHub Pages의 branch 배포를 기준으로 합니다.

```text
Branch : main
Folder : /root
```

소스 변경을 `main`에 반영하면 Pages 배포 상태에 따라 웹 화면에 반영됩니다.

데이터 갱신 workflow는 `prices.json`과 `performance_snapshots.json`을 변경한 경우에만 자동 commit/push 합니다.

---

## 수정 · QA 운영 방식

대규모 구조 작업은 한 번에 전부 수정하지 않고 차수별로 진행합니다.

```text
1차
→ QA
→ 2차
→ QA
→ 3차
→ QA
→ ...
→ 최종 누적 QA
```

### 차수 요청

사용자가 `1차`, `2차`, `3차`처럼 차수만 요청하면:

- 해당 차수의 수정만 수행
- 최소 syntax/import/diff 안전검사
- QA는 수행하지 않음
- 실제 변경 파일만 원래 프로젝트 경로대로 ZIP 전달

### QA 요청

사용자가 `QA`라고 요청하면:

- 직전 차수의 변경 범위 중심으로 회귀 확인
- syntax / import-export / dependency / state ownership / action-event 연결 점검
- 관련 기능의 계산·렌더 결과가 변하지 않았는지 필요 범위에서 비교
- FAIL이면 다음 차수로 넘어가지 않고 수정 후 다시 QA

### 최종 누적 QA

각 차수 QA가 모두 PASS했더라도 마지막에는 누적 최종본을 다시 검증합니다.

차수별 QA와 최종 누적 QA는 별개의 단계로 운영하며, 마지막에는 누적본 기준으로 함수 누락·의존성·이벤트 연결·계산 및 렌더 회귀를 다시 확인합니다.

세부 QA 기준과 전체 인수인계 원칙은 다음 문서를 기준으로 합니다.

```text
메인대시보드 수정 시 반드시 확인할 사항 및 채팅창 인수인계.md
```

---

## 수정 파일 전달 규칙

코드 또는 문서를 수정해 전달할 때:

1. 실제 변경된 파일만 포함합니다.
2. 프로젝트 내부의 원래 경로를 유지합니다.
3. 파일이 1개뿐이어도 ZIP으로 전달합니다.
4. ZIP 생성 후 내부 파일 수·경로·압축 무결성을 확인합니다.
5. 여러 차수 작업이 끝나면 필요 시 1차부터 최종 수정까지 합친 **누적 변경 ZIP**을 별도로 만듭니다.

예:

```text
js/dashboard-ui.js만 수정

ZIP 내부:
js/
└─ dashboard-ui.js
```

---

## 유지보수 원칙

현재 프로젝트는 다음 리팩토링을 완료한 상태입니다.

```text
CSS 구조 최적화
→ JavaScript 책임 분리
→ UI/UX 공통화 및 반응형 정리
→ JavaScript ES Module migration
→ JavaScript 3차 구조 리팩토링
```

앞으로는 **현재 정상 구조를 유지하면서 필요한 범위만 최소 수정**하는 것을 기본으로 합니다.

- 과거 단일 `script.js` 구조로 되돌리지 않음
- ES Module의 명시적 `import / export` dependency 유지
- `window` / `globalThis` 기반 우회 dependency 금지
- 메인 CSS는 `css/style.css` 단일 파일 유지
- core / ui-common / charts / ui / pension View / pension Editor / app 책임 경계 유지
- 특정 모듈 private state·DOM에 다른 모듈이 직접 접근하지 않음
- 운영 JSON을 소스 패치로 임의 덮어쓰지 않음
- 파일 줄 수나 점수만을 이유로 추가 분리·재작성하지 않음
- 기능 정확성·계산 parity·회귀 방지를 구조 점수보다 우선

현재 구조와 충돌하는 대규모 개편이 필요하다면 먼저 이유와 영향 범위를 확인한 뒤 진행합니다.

---

## 새 작업 시작 시 Source of Truth

새 채팅이나 새로운 작업 세션에서는 다음 순서로 기준을 잡습니다.

```text
최신 전체 ZIP
→ ZIP 내부 인수인계 MD 확인
→ 같은 ZIP의 실제 소스 확인
→ 문서와 코드의 현재 상태 대조
→ 작업 시작
```

과거 대화에서 기억한 코드나 과거 ZIP을 최신본으로 추정하지 않습니다.

가장 간단한 시작 요청은:

```text
첨부한 최신 ZIP 기준으로 시작해줘.
```

입니다.

---

## 저장소 정리

Python cache 등 실행 중 자동 생성되는 파일은 저장소에 포함하지 않습니다.

```gitignore
__pycache__/
*.pyc
```

---

## 상세 운영 문서

세부 구조, 반복 회귀 이력, QA 범위, 차수별 작업 규칙, 점수 이력, 운영 JSON 보호 기준 및 새 채팅 인수인계 방식은 다음 문서를 기준으로 합니다.

```text
메인대시보드 수정 시 반드시 확인할 사항 및 채팅창 인수인계.md
```

README는 저장소의 전체 구조와 운영 개요를 설명하고, 위 MD는 **실제 수정 작업을 수행할 때 적용하는 상세 유지보수 규칙**을 담당합니다.
