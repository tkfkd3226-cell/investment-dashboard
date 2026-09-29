# add 영역 유지보수 및 거래 리포트 인수인계

## 1. 범위와 Source of Truth

이 문서는 `add/`의 Calc와 KODEX 거래 리포트 유지보수에 필요한 **업무 규칙과 장기 contract**만 기록합니다. 현재 selector·함수 내부 구현은 최신 소스를 봅니다.

| 대상 | Source of Truth |
|---|---|
| Calc 화면/로직 | `add/calc.html`, `add/add.js`, `add/add.css` |
| Report 화면/로직 | `add/kodex-leverage-report.html`, `add/add.js`, `add/add.css` |
| KODEX 거래 원천 | `data/kodex_leverage_trades.json` |
| Schema 검증 | `js/kodex-leverage-schema.js` |
| Add 계산 QA | `tests/add-calc.test.cjs` |
| 거래/파생 QA | `tests/add-report-data.test.cjs` |
| UI 장기 contract | `tests/add-ui-contract.test.cjs` |
| Main↔Add 공통 contract | `tests/cross-ui-contract.test.cjs` |

Main 구조·KRX·Pension 운영은 `main_dashboard_maintenance_handover.md`, 평가 기준은 `dashboard_evaluation_guide.md`가 소유합니다.

## 2. 공통 UI contract

- 기본 viewport: Desktop `≥1101`, Tablet `761~1100`, Phone `≤760`.
- 터치 스마트폰 가로는 Tablet이 아니라 Phone family로 취급합니다.
- iPhone Safari 데스크탑 웹사이트 요청은 `1280px` contract를 Main과 공유합니다.
- Light/Dark, Corner appearance storage/channel은 Main과 동일 contract를 사용합니다.
- Add는 `add.css` + `add.js` 단일 runtime을 유지합니다. Main CSS/JS와 외형이 비슷하다는 이유만으로 강제 합치지 않습니다.
- 공통 semantic color, tab/ARIA, table caption/header, invalid/stale-result 의미는 유지하되 미세 px/selector 순서를 테스트나 문서에서 고정하지 않습니다.

## 3. KODEX 거래 canonical 원칙

단일 거래 원천은 다음 파일입니다.

```text
data/kodex_leverage_trades.json
```

이 파일에서 두 화면이 파생됩니다.

- Main `separateProfit`
- Add KODEX Report 전체/Core/Day/누적/차트/Timeline

`portfolio.json`이나 `add.js`에 거래 배열을 다시 복제하지 않습니다.

### 기본 schema

```json
{
  "schemaVersion": 1,
  "reportStartDate": "YYYY-MM-DD",
  "reinvestedLimit": 6700000,
  "positionContext": {},
  "trades": [
    {
      "date": "YYYY-MM-DD",
      "qty": 220,
      "buy": 97685,
      "sell": 102650,
      "pnl": 1092275,
      "fee": 1852,
      "segment": "core"
    }
  ]
}
```

핵심 의미:

- `date`: 매도실현일
- `qty`: 해당 일 전체 매도수량
- `buy`/`sell`: 증권사 기준 평균 매수/매도 단가
- `pnl`: 거래비용 차감 전 손익
- `fee`: 실제 거래비용
- `pnl - fee`: 날짜별 순손익
- `segment`: `core` / `day` / `mixed`
- `mixed.core`: 혼합일 중 본 포지션 귀속분
- `reinvestedLimit`: 별도 요청 없이는 자동 변경하지 않음

Schema validator는 날짜·정수·중복·segment·positionContext 연결관계와 JavaScript 안전 정수 범위를 계산 전에 차단합니다.

## 4. 증권사 자료의 역할

자료가 둘 이상이면 역할을 분리합니다.

- **매도실현손익 원본/내역**: 날짜별 수량·평균단가·손익·거래비용·순손익의 확정값
- **상세 매매보고서/매매내역**: 매수일·보유기간·기존 포지션과 당일 매매 연결 확인

자료끼리 실제로 다르면 임의로 숫자를 맞추지 않습니다. 원본 파일/이미지는 Report에 내장하지 않고 canonical JSON을 검산·갱신하는 입력자료로만 사용합니다.

## 5. 거래 분류와 계산

### 전체 실현손익

```text
순손익 = 손익금액 - 거래비용
누적 실현 순손익 = Σ 날짜별 순손익
```

### 본 포지션 / 단타

```text
매수한 날을 넘겨 보유 후 매도 → core
같은 날 매수 후 같은 날 매도 → day
기존 보유분 청산과 당일 반복매매가 함께 존재 → mixed
```

혼합일:

```text
단타 수량   = 전체 매도수량 - core 수량
단타 손익   = 전체 손익금액 - core 손익금액
단타 비용   = 전체 거래비용 - core 거래비용
```

증권사 원본이 그룹별 비용을 주지 않을 때만 기존 방식대로 추정 왕복 거래대금 비율을 사용합니다. 이 경우 각 그룹 비용은 추정일 수 있지만 합계는 원본의 전체 거래비용과 반드시 일치해야 합니다.

검산:

```text
core 순손익 + day 순손익 = 전체 순손익
```

## 6. positionContext

매도실현손익만으로 복원되지 않는 매수-only 포지션 형성 사실은 `positionContext`가 소유합니다. 현재 schema v1의 필수 context와 연결 실현거래는 실제 `js/kodex-leverage-schema.js`를 Source of Truth로 봅니다.

- JS literal로 context를 다시 복제하지 않습니다.
- 날짜순서·수량·가중평균 매수단가·취득원가가 연결 실현거래와 모순되면 schema 단계에서 차단합니다.
- 음수 파생수량이나 안전 정수 범위를 벗어나는 계산을 Timeline에 표시하지 않습니다.

## 7. 자금 출처는 추적하지 않는다

이 Report는 **투자거래 손익 리포트**입니다.

- 현금/급여/대출 등 자금 출처 분류를 새로 만들지 않습니다.
- 대출이자·상환일·중도상환수수료·자금조달비용을 투자손익에 섞지 않습니다.
- 과거의 자금 흐름/차입금 패널을 사용자 요청 없이 복원하지 않습니다.

## 8. 신규 거래 반영 절차

```text
1. 매도실현손익 원본에서 확정 수량·손익·비용·순손익 확인
2. 상세 매매보고서에서 매수일·포지션 연결 확인
3. data/kodex_leverage_trades.json에 해당 매도일 1회 반영
4. 날짜 오름차순·중복 없음·schema 검증
5. 전체/Core/Day/누적 합계와 reinvestedLimit 검산
6. Report의 표시기간·필요 설명문만 갱신
7. Hero/KPI/표/차트/Timeline이 같은 canonical 값에서 파생되는지 확인
8. 관련 자동 QA 실행
```

매도일당 canonical 레코드는 1개만 유지합니다. 같은 날짜가 있으면 중복 추가하지 않고 확정값으로 갱신합니다.

## 9. QA

변경 유형에 맞는 테스트만 실행합니다.

### 거래/Report 데이터

```bash
node --test tests/add-report-data.test.cjs
```

항상 확인:

- `손익 - 비용 = 순손익`
- 날짜별 합계 = 전체 합계
- Core + Day = 전체
- mixed의 `core.fee <= fee`
- 거래일 오름차순·중복 없음
- Main 별도수익과 Report 날짜별 순손익 일치
- Hero/KPI/표/차트/Timeline에 과거 숫자 잔존 없음

### Calc 계산/validation

```bash
node --test tests/add-calc.test.cjs
```

- production `compute()/validate()/ceil5()`를 직접 검증합니다.
- `NaN`, `Infinity`, unsafe integer가 렌더/저장으로 넘어가면 안 됩니다.
- 개별 입력뿐 아니라 곱셈·합산·회복금액 등 파생 정수도 안전 범위를 확인합니다.

### Add UI

```bash
node --test tests/add-ui-contract.test.cjs
```

장기 접근성/상태/반응형 contract를 확인합니다. 미세 hover 보정, 정확한 selector 순서, 단발성 px 값처럼 소스를 그대로 고정하는 테스트는 추가하지 않습니다.

### Main↔Add 공통 contract

```bash
node --test tests/cross-ui-contract.test.cjs
```

appearance, viewport, Phone Landscape, iPhone desktop-request, 공통 자산/schema 같은 실제 공유 책임을 바꿀 때만 실행합니다.

## 10. 수정 금지/주의

- 새 거래 반영과 무관한 Main/KRX/Pension 구조를 함께 변경하지 않습니다.
- 사용자 요청 없이 `reinvestedLimit`을 바꾸지 않습니다.
- 날짜형 legacy report 파일명을 다시 canonical로 만들지 않습니다.
- canonical JSON을 두고 HTML/JS에 거래 숫자를 복제하지 않습니다.
- 비슷해 보인다는 이유만으로 Main/Add를 억지 공통화하지 않습니다.

> 운영 원칙: **증권사 확정 거래를 `data/kodex_leverage_trades.json` 한 곳에 반영하고, Main 별도수익과 Add Report의 모든 파생값이 같은 원천과 schema에서 나온다는 것만 끝까지 보존합니다.**
