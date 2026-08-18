# 투자 대시보드

삼성증권 증권계좌와 퇴직연금 계좌의 **날짜별 투자 성과를 복원·분석하는 정적 웹 대시보드**입니다.

메인 화면은 GitHub Pages에서 제공하고, KRX 가격·성과 데이터 갱신은 GitHub Actions와 Python 스크립트로 처리합니다. 퇴직연금 데이터 저장과 KRX 갱신 요청 등 쓰기 작업은 Google Apps Script 웹 앱을 통해 연결합니다.

---

## 주요 기능

- 날짜별 증권계좌·퇴직연금 투자 성과 복원
- 증권계좌 / 퇴직연금 탭 기반 성과 조회
- 투자원금, 누적손익, 수익률, 보유자산, 장부 검산
- 별도수익 ON/OFF에 따른 성과 비교
- KOSPI 대비 성과 및 주요 투자 차트
- 차트 범례 선택, Y축 자동 재계산, 확대 보기
- KRX 현재가 최신/누락 반영 및 선택일 재갱신
- 퇴직연금 기업적립금·현금성자산·추가매수 관리
- Light / Dark 테마와 Desktop / Tablet / Mobile 반응형 UI
- 별도 투자 계산기 `add/calc.html`
- 기간별 거래 리포트 `add/report/`

---

## 프로젝트 구조

```text
investment-dashboard-main/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ dashboard-core.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
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
├─ start-local-server.bat
└─ 메인대시보드 수정 시 반드시 확인할 사항 및 채팅창 인수인계.md
```

---

## 프론트엔드 구조

메인 JavaScript는 **5개 ES Module**로 구성되어 있으며 `dashboard-app.js`가 단일 entry point입니다.

| 파일 | 역할 |
|---|---|
| `dashboard-core.js` | 데이터, 상태, 계산, formatter, 공통 helper |
| `dashboard-charts.js` | 차트 렌더링, 범례, tooltip, 확대 및 반응형 처리 |
| `dashboard-ui.js` | Topbar, Navigation, 일반 UI, table/card/modal 렌더링 |
| `dashboard-pension.js` | 퇴직연금 화면, 저장·삭제, batch, PIN 처리 |
| `dashboard-app.js` | 이벤트 연결, render orchestration, 초기화 및 boot |

현재 module dependency는 다음 방향을 유지합니다.

```text
charts  → core
ui      → core + charts
pension → core + charts + ui
app     → core + charts + ui + pension
```

메인 CSS는 `css/style.css` **단일 파일 구조**를 유지합니다.

기본 반응형 구간:

```text
Desktop : 1101px 이상
Tablet  : 761px ~ 1100px
Mobile  : 760px 이하
```

---

## 데이터와 자동화

### 주요 데이터

- `portfolio.json` — 보유자산, 원금 기준, 자금 이벤트 등
- `prices.json` — 날짜별 종목·상품 가격 및 지수
- `performance_snapshots.json` — 날짜별 성과 스냅샷
- `account1_daily_snapshots.json` — 증권계좌 일별 복원 데이터
- `pension_*.json` — 퇴직연금 적립금·현금·거래 데이터

### KRX 데이터 갱신

`.github/workflows/update-prices.yml`이 `scripts/update_prices.py`를 실행하여 KRX 가격과 성과 스냅샷을 갱신합니다.

워크플로는 수동 실행을 지원하며, 날짜를 지정하지 않으면 한국시간 기준 오늘 데이터를 처리합니다.

---

## 로컬 실행

JSON 데이터를 `fetch()`로 읽기 때문에 HTML 파일을 직접 열기보다 로컬 HTTP 서버로 실행합니다.

Windows에서는 프로젝트 루트의:

```text
start-local-server.bat
```

을 실행하면 됩니다.

기본 주소:

```text
http://localhost:8000/
```

Python이 설치되어 있어야 합니다.

직접 실행하려면:

```bash
python -m http.server 8000
```

---

## 배포

메인 대시보드는 **GitHub Pages**의 branch 배포 방식을 기준으로 합니다.

```text
Branch : main
Folder : /root
```

KRX 데이터 갱신은 GitHub Actions가 `prices.json`과 `performance_snapshots.json`을 업데이트하고 커밋하는 방식으로 운영합니다.

---

## 유지보수 원칙

현재 프로젝트는 다음 구조 리팩토링을 완료한 상태입니다.

```text
CSS 구조 최적화
→ JavaScript 5파일 책임 분리
→ UI/UX 공통화 및 반응형 정리
→ JavaScript ES Module migration
```

앞으로의 기본 원칙은 **현재 정상 구조를 유지하면서 필요한 범위만 최소 수정하는 것**입니다.

- 과거 단일 `script.js` 구조로 되돌리지 않음
- ES Module의 명시적 `import / export` dependency 유지
- `window` / `globalThis` 기반 우회 dependency를 만들지 않음
- 메인 CSS는 `css/style.css` 단일 파일 유지
- 불필요한 breakpoint, `!important`, 후행 override를 추가하지 않음
- 계산·데이터·UI·차트·퇴직연금의 현재 책임 경계를 유지
- 운영 JSON을 소스 패치로 임의 덮어쓰지 않음

세부 구조, QA 방식, 점수 이력, 회귀 불변조건 및 새 채팅 인수인계 기준은 다음 문서를 사용합니다.

```text
메인대시보드 수정 시 반드시 확인할 사항 및 채팅창 인수인계.md
```

이 문서는 최신 전체 ZIP과 함께 관리하며, 실제 구현 상태는 항상 최신 소스를 기준으로 확인합니다.

---

## 운영 데이터 주의

다음 `data/*.json`은 실제 운영 데이터입니다.

특히:

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
```

은 코드 패치나 과거 ZIP을 GitHub에 반영할 때 덮어쓰기 전에 현재 운영본과 반드시 비교합니다.

---

## 저장소 정리

Python cache는 저장소에 포함하지 않습니다.

```gitignore
__pycache__/
*.pyc
```
