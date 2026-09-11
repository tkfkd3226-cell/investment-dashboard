# Investment Dashboard

개인 투자 현황, 계좌별 성과, 퇴직연금, KODEX 레버리지 거래 분석과 Market AI 실시간 시장/보유종목 정보를 하나의 반응형 화면에서 확인하기 위한 정적 웹 대시보드입니다.

이 저장소의 화면은 GitHub Pages 같은 정적 호스팅에서 동작하며, 운영 데이터는 `data/*.json`을 기준으로 읽습니다. 로컬 Market AI가 연결된 환경에서는 오늘 날짜의 보유종목 평가값에 실시간 quote를 overlay하고, 사용할 수 없는 종목만 `data/prices.json` 값으로 개별 fallback합니다.

## 주요 화면

- Main Dashboard: `index.html`
- 투자 계산기: `add/calc.html`
- KODEX 레버리지 리포트: `add/kodex-leverage-report.html`

## 프로젝트 구조

```text
index.html
css/                         Main 반응형·테마·인쇄 스타일
js/                          Main 모듈과 공통 KODEX schema
data/                        운영 JSON 데이터
add/                         Calc / KODEX Report
scripts/update_prices.py     KRX 가격 갱신 스크립트
.github/workflows/           GitHub Actions 가격 갱신
img/                         공통 이미지·아이콘
tests/                       Node / Python 회귀 QA
```

Main JavaScript는 ES Module 구조를 사용합니다. `dashboard-core.js`는 계산·데이터 계층, UI 파일은 렌더와 interaction, `dashboard-app.js`는 Main boot를 담당합니다. Market AI 클라이언트와 오늘 보유종목 live valuation은 별도 모듈로 유지합니다.

## 운영 데이터 원칙

운영 JSON은 임의로 복제하거나 테스트 과정에서 덮어쓰지 않습니다. 특히 KODEX 레버리지 실현거래와 재투입 한도의 canonical Source of Truth는 다음 파일 하나입니다.

```text
data/kodex_leverage_trades.json
```

새로운 KODEX 실현거래는 위 JSON에 1회 반영하고, Main 별도수익과 KODEX Report는 같은 원천에서 파생합니다. 상세 반영 절차와 schema 계약은 `add_maintenance_handover.md`를 따릅니다.

## Market AI 연동

오늘 날짜에서만 로컬 Market AI quote를 평가값에 overlay합니다.

```text
Dashboard holdings universe
→ Market AI KRX quote API
→ KIS eFriend Bridge / SC_R
→ 종목별 live quote
→ 오늘 평가값 overlay
```

- 정상 quote는 종목별로 사용합니다.
- 한 종목의 quote가 usable하지 않아도 다른 정상 종목은 live 값을 유지합니다.
- 사용할 수 없는 종목만 `data/prices.json`으로 fallback합니다.
- 과거 날짜에는 live quote를 사용하지 않습니다.
- multi-tab client lease와 latest-wins 계약을 유지합니다.

Market AI backend와 KIS eFriend Bridge는 별도 프로젝트이며 이 저장소에 포함하지 않습니다.

## 로컬 실행

정적 파일이므로 간단한 HTTP 서버로 확인할 수 있습니다.

```powershell
python -m http.server 8003
```

그 다음 브라우저에서 아래 주소를 엽니다.

```text
http://localhost:8003/index.html
```

GitHub Pages 배포에서는 저장소의 정적 파일을 그대로 사용합니다.

## QA

Node 테스트는 Node.js 내장 test runner를 사용합니다.

```powershell
node --test tests/*.test.cjs
```

Python 가격 갱신 테스트는 다음처럼 실행합니다.

```powershell
python -m unittest tests.update_prices_test
```

수정 후에는 변경 영역 테스트뿐 아니라 전체 QA를 다시 실행해 기존 PASS가 감소하지 않는지 확인합니다.

## 유지보수 문서

문서 역할은 겹치지 않게 유지합니다.

- `README.md`: GitHub 프로젝트 소개, 실행·배포 개요
- `main_dashboard_maintenance_handover.md`: Main 유지보수 contract
- `add_maintenance_handover.md`: Calc / KODEX Report 유지보수 contract
- `dashboard_evaluation_guide.md`: 평가 범위, 등급, 감점 기준

실제 구현 상태를 판단할 때는 사용자가 제공한 최신 소스를 먼저 확인하고, 문서는 설계 의도와 장기 contract를 확인하는 기준으로 사용합니다.
