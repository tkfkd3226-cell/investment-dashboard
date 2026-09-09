# 투자 대시보드

삼성증권 증권계좌와 퇴직연금 계좌의 **날짜별 투자 성과를 복원·검산·분석하기 위한 정적 웹 대시보드**입니다.

메인 화면은 GitHub Pages에서 제공하며, KRX 가격과 성과 스냅샷은 GitHub Actions + Python으로 갱신합니다. 퇴직연금 금액 조정과 KRX 갱신 요청처럼 브라우저에서 직접 저장소 파일을 수정할 수 없는 쓰기 작업은 별도로 배포된 Google Apps Script Web App을 통해 처리합니다.

별도 `market-ai` 프로젝트가 실행 중이면 현재 시장·AI 신호를 대시보드에 함께 표시할 수 있습니다. 로컬에서는 Market AI FastAPI에 직접 연결하고, 외부 GitHub Pages에서는 Tailscale Serve를 통해 같은 실제 데이터를 조회합니다.

---

## 1. 프로젝트 목적

이 저장소는 단순 시세 조회 화면이 아니라 다음 세 가지를 함께 관리하는 것을 목표로 합니다.

1. **현재 보유 현황**
   - 증권계좌와 퇴직연금의 자산·손익·비중 확인

2. **날짜별 복원**
   - 과거 특정 날짜의 계좌 상태와 성과 재구성

3. **장부 검산**
   - 실제 보유액, 투자원금, 실현손익, 현금 흐름의 일관성 확인

프런트엔드는 별도 프레임워크나 번들러 없이 **HTML + CSS + Vanilla JavaScript ES Module**로 구성합니다.

---

## 2. 주요 기능

### 2.1 Main Dashboard

메인 화면:

```text
index.html
```

주요 기능:

- 날짜별 증권계좌 성과 복원
- 투자원금·평가금액·누적손익·수익률 조회
- 계좌별 성과 요약과 보유 종목 현황
- 장부결과 VS 실제보유 검산
- 투자원금 원천 및 검산
- 별도수익 ON/OFF 비교
- KOSPI 대비 초과성과 확인
- 퇴직연금 날짜별 성과 및 상품 현황
- 퇴직연금 상품별 손익·비중·인사이트
- 위험자산 비중 관리
- 기업적립금·현금성자산·ETF 추가매수 조정
- PIN 기반 퇴직연금 저장·삭제
- 누적손익·수익률·비중 변화 등 기간 차트
- Light / Dark 테마
- Desktop / Tablet / Mobile 반응형 UI
- Print 전용 출력

### 2.2 투자 계산기

```text
add/calc.html
```

KODEX 레버리지 보유분과 추가매수 시나리오를 계산하기 위한 보조 화면입니다.

주요 기능:

- 기존 보유분 기준 계산
- 추가매수 시 평균단가 계산
- 목표 매도단가 계산
- 회수 대상 금액 및 잔여현금 계산
- 추가매수 단가·수량 입력 및 시나리오 계산
- 기본값 복원
- Desktop / Tablet / Mobile 반응형 UI

### 2.3 KODEX 레버리지 거래 리포트

```text
add/kodex-leverage-report.html
```

`data/kodex_leverage_trades.json`을 기준으로 KODEX 레버리지 거래와 실현손익을 집계하는 리포트 화면입니다.

Main의 별도수익과 Add Report는 같은 canonical 거래 원천을 사용합니다.

### 2.4 Market AI 연동

Market AI는 Main feature state와 분리된 **현재 시점의 보조 시장 신호**입니다.

- KOSPI, KOSPI200 선물, SOX, NQ100 선물과 AI 신호 표시
- Desktop / Tablet: Hero 우측 보조 카드
- Mobile / 실제 터치폰 가로 UI: **AI Signal** dialog
- Local: Market AI FastAPI 직접 조회
- GitHub Pages: Tailscale Serve를 통해 같은 실제 데이터 조회
- Market AI가 응답하지 않아도 Main Dashboard 기본 기능은 독립 동작

세부 polling, stale/source 판정, UI lifecycle은 `main_dashboard_maintenance_handover.md`와 Market AI 프로젝트 문서에서 관리합니다.

---

## 3. 전체 동작 구조

### 3.1 일반 조회

```text
GitHub Pages / Browser
          ↓
      index.html
          ↓
   ES Module frontend
          ↓
      data/*.json
          ↓
   계산 / 화면 렌더링
```

Main의 JavaScript entry point는 `js/dashboard-app.js`입니다.

Market AI는 `js/dashboard-market-ai.js`가 별도 standalone entry로 동작합니다.

### 3.2 퇴직연금 저장

```text
Browser
   ↓
Google Apps Script Web App
   ↓
GitHub REST API
   ↓
pension 관련 JSON
   ↓
GitHub commit
```

브라우저가 GitHub 저장소에 직접 write하지 않습니다.

### 3.3 KRX 가격 갱신

```text
Browser / 수동 실행
          ↓
Google Apps Script 또는 workflow_dispatch
          ↓
.github/workflows/update-prices.yml
          ↓
scripts/update_prices.py
          ↓
data/prices.json
data/performance_snapshots.json
```

### 3.4 Market AI 조회

```text
Dashboard
   ↓
js/dashboard-market-ai.js
   ↓
Market AI API
```

외부 GitHub Pages에서는 FastAPI 포트를 직접 인터넷에 공개하지 않고 Tailscale Serve를 통해 접근합니다.

---

## 4. 프로젝트 구조

```text
investment-dashboard/
├─ index.html
│
├─ css/
│  ├─ common.css
│  ├─ tablet.css
│  ├─ mobile.css
│  ├─ special.css
│  ├─ interaction.css
│  └─ print.css
│
├─ js/
│  ├─ kodex-leverage-schema.js
│  ├─ dashboard-core.js
│  ├─ dashboard-ui-common.js
│  ├─ dashboard-modal.js
│  ├─ dashboard-charts.js
│  ├─ dashboard-ui.js
│  ├─ dashboard-pension.js
│  ├─ dashboard-pension-editor.js
│  ├─ dashboard-app.js
│  └─ dashboard-market-ai.js
│
├─ data/
│  ├─ portfolio.json
│  ├─ kodex_leverage_trades.json
│  ├─ prices.json
│  ├─ performance_snapshots.json
│  ├─ account1_daily_snapshots.json
│  ├─ pension_contributions.json
│  ├─ pension_cash_snapshots.json
│  ├─ pension_operation_ledger.json   # v6 cash legacy history, read-only fallback
│  ├─ pension_operation_ledger/       # semantic-hash shard, 필요 시 00~ff.json 생성
│  ├─ pension_operation_identity/     # exact identity shard, 필요 시 00~ff.json 생성
│  ├─ krx_dispatch_ledger/             # KRX requestId durable shard, 필요 시 00~ff.json 생성
│  └─ pension_trades.json
│
├─ img/
│  ├─ favicon.png
│  ├─ hero-bg.webp
│  └─ ui-icons.svg
│
├─ add/
│  ├─ calc.html
│  ├─ kodex-leverage-report.html
│  ├─ add.css
│  └─ add.js
│
├─ scripts/
│  └─ update_prices.py
│
├─ tests/
│  ├─ main-calc.test.cjs
│  ├─ main-ui-contract.test.cjs
│  ├─ add-calc.test.cjs
│  ├─ add-report-data.test.cjs
│  ├─ add-ui-contract.test.cjs
│  └─ cross-ui-contract.test.cjs
│
├─ .github/
│  └─ workflows/
│     └─ update-prices.yml
│
├─ requirements.txt
├─ README.md
├─ main_dashboard_maintenance_handover.md
├─ add_maintenance_handover.md
└─ dashboard_evaluation_guide.md
```

`img/favicon.png`은 Main과 Add가 함께 사용하는 공통 favicon입니다.

---

## 5. 구현 구성 요약

Main은 `index.html`에서 시작하고 `js/dashboard-app.js`가 전체 화면 흐름을 조율합니다. `js/dashboard-market-ai.js`는 Market AI 조회를 별도 entry로 담당합니다.

Main CSS는 다음 역할 파일로 나뉩니다.

```text
common.css       공통 / Desktop baseline
tablet.css       Tablet
mobile.css       Mobile
special.css      기능상 필요한 특수 viewport
interaction.css  hover / pointer
print.css        Print
```

Add는 `add/calc.html`과 `add/kodex-leverage-report.html`이 `add/add.css`, `add/add.js`를 공유합니다.

JavaScript dependency/state ownership, CSS cascade, responsive 예외, Main UI contract는 `main_dashboard_maintenance_handover.md`에서 관리하고, Calc/Report의 계산·UI contract는 `add_maintenance_handover.md`에서 관리합니다.

---

## 6. 데이터 구조

| 파일 | 용도 |
|---|---|
| `data/portfolio.json` | 보유자산, 투자원금 기준 및 기본 포트폴리오 정보 |
| `data/kodex_leverage_trades.json` | KODEX 레버리지 거래·실현손익의 canonical 원천 |
| `data/prices.json` | 날짜별 종목·상품 가격과 지수 |
| `data/performance_snapshots.json` | 날짜별 성과 스냅샷 |
| `data/account1_daily_snapshots.json` | 증권계좌 일별 복원 데이터 |
| `data/pension_contributions.json` | 퇴직연금 적립·조정 데이터 |
| `data/pension_cash_snapshots.json` | 퇴직연금 현금성자산 스냅샷 |
| `data/pension_operation_ledger.json` | v6 cash operation legacy history의 read-only fallback |
| `data/pension_operation_ledger/*.json` | 모든 Pension upsert/delete logical operation의 semantic durable history. semantic hash 앞 2자리로 직접 조회하며 800건 ring buffer를 사용하지 않음 |
| `data/pension_operation_identity/*.json` | requestId/logicalOperationId/batchRequestId+operationId의 exact identity durable index. payload 내용과 무관한 identity hash 앞 2자리로 조회하여 같은 identity+다른 내용 재사용을 장기 차단 |
| `data/krx_dispatch_ledger/*.json` | KRX 완료 requestId/hash/workflow run ID의 durable shard history. Script Properties receipt/intent GC 이후 동일 requestId 재-dispatch를 차단 |
| `data/pension_trades.json` | 퇴직연금 거래 이력 |

대시보드는 이 데이터를 결합해 선택 날짜의 계좌 상태와 성과를 계산합니다.

`data/kodex_leverage_trades.json`은 Main 별도수익과 Add KODEX Report가 함께 사용하는 단일 거래 원천이며, schema는 `js/kodex-leverage-schema.js`에서 검증합니다.

### 운영 데이터 주의

특히 다음 파일은 실제 운영 데이터이므로 소스 수정 패치에 과거 복사본이 섞이지 않도록 주의합니다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
data/pension_operation_ledger/*.json   # GAS가 생성·갱신하는 semantic operation history shard
data/pension_operation_identity/*.json # GAS가 생성·갱신하는 exact identity history shard
data/krx_dispatch_ledger/*.json        # GAS가 생성·갱신하는 KRX requestId durable history shard
```

코드 수정 패치는 원칙적으로 변경된 소스만 포함하고, 운영 JSON은 필요한 작업이 아닌 경우 함께 덮어쓰지 않습니다.

---

## 7. 데이터 쓰기와 갱신

### 7.1 Google Apps Script

퇴직연금 저장과 KRX 갱신 요청은 GitHub 저장소와 별도로 운영되는 Google Apps Script Web App을 사용합니다. 브라우저가 저장소에 직접 write하지 않으며, 운영 인증값과 GitHub 연동 정보도 프런트엔드 파일에 직접 두지 않습니다.

쓰기 요청은 네트워크 응답 유실 뒤 재시도해도 중복 데이터나 과거 상태 재적용이 생기지 않도록 요청 identity와 최근 처리 receipt/intent를 유지합니다. 퇴직연금 단건 저장은 현금성자산 `requestId` 및 기업적립금·ETF의 client-generated ID를 재사용하고, request intent에 단조 증가 `PENSION_MUTATION_EPOCH`을 함께 저장합니다. 응답이 확정되기 전 single/batch pending store는 PIN 같은 비밀값 없이 **logical fingerprint와 최초 전송 payload 자체**를 브라우저 `localStorage`에 짧은 TTL로 보존합니다. logical fingerprint에는 `expectedVersion`/`expectedAbsent` 같은 서버 precondition을 넣지 않으므로 저장 성공 뒤 state가 바뀌어도 reload가 같은 logical 요청을 알아볼 수 있고, 재시도 시에는 최신 화면 상태로 payload를 재조립하지 않고 최초 requestId·operationId·precondition을 그대로 재전송합니다. 현금성자산 upsert/delete와 Batch cash operation은 화면이 본 `expectedVersion` 또는 신규 생성용 `expectedAbsent`를 사용해 stale-view mutation을 거부합니다. 다른 탭/기기처럼 브라우저 pending identity를 공유할 수 없는 경우에는 **동일 내용만으로 retry와 실제 별도 거래를 자동 판정하지 않습니다.** contribution/ETF 또는 동일 Batch effect 후보가 있으면 GAS가 mutation 전에 `duplicate_confirmation_required` / `batch_duplicate_confirmation_required`를 반환합니다. 확인은 단순 boolean 우회가 아니라 GAS가 발급한 **state-bound confirmation token**으로 처리하며, token은 현재 Pension epoch·semantic dependency fingerprint·확인 후보에 묶입니다. 따라서 확인창을 띄운 뒤 다른 mutation이 들어오면 오래된 token은 `confirmation_stale`로 거부됩니다. 사용자의 **기존 처리** 선택도 서버에 다시 전송해 후보가 여전히 존재하는지 재확인하며, **실제 별도 거래·작업**도 같은 token 검증을 통과한 경우에만 새 mutation으로 진행합니다. `logicalOperationId`는 GitHub item에도 보존됩니다. 현재 resource가 overwrite/delete되면 과거 operation 흔적이 사라질 수 있으므로 **cashSnapshot·contribution·etfTrade의 모든 upsert/delete**를 `data/pension_operation_ledger/<semantic-hash-prefix>.json` semantic shard와 `data/pension_operation_identity/<identity-hash-prefix>.json` exact identity shard에 기록하고 대상 JSON과 **같은 Git commit으로 원자 반영**합니다. semantic shard는 같은 효과 후보 확인용이고, exact identity shard는 `requestId`·`logicalOperationId`·`batchRequestId+operationId`를 payload 내용과 무관한 key로 직접 찾아 receipt/intent가 GC된 뒤 payload 내용이 바뀌어 semantic shard가 달라져도 같은 identity 재사용을 거부합니다. 두 shard 모두 2자리(00~ff)로 직접 찾고 800건 ring buffer를 두지 않아 `저장 성공/응답유실 → 정상 삭제 → 다른 기기에서 과거 저장 재시도`와 오래된 cash rollback/delete history가 rollover로 사라지지 않습니다. v6의 `data/pension_operation_ledger.json`은 cash legacy history의 read-only fallback으로만 읽습니다. 동일 내용의 실제 별도 거래나 같은 평가금액의 새 cash causal anchor는 state-bound confirmation token을 거쳐 새 logical operation으로 정상 저장할 수 있습니다. Git blob SHA는 causal version으로 사용하지 않고 target 외부 변경 감지의 보조 guard로만 쓰며, 확정 pre-commit 실패로 target/dependency가 전혀 바뀌지 않은 것이 확인되면 intent를 삭제하지 않고 **retryable tombstone**으로 전환하며 예약 epoch만 되돌립니다. tombstone에는 당시 dependency hash와 rollback 후 epoch를 보존해 `A 실패 → B 실패 → A retry`는 복구하되 `A 실패 → B 성공 → A retry`는 stale로 차단합니다. Batch는 `batchRequestId` + 작업별 `operationId`·Pension epoch·semantic dependency fingerprint를 함께 사용하고, receipt/cache 유실 복구 시 cashSnapshot은 날짜별 마지막 operation의 최종 효과를 기준으로 이미 반영된 Batch인지 판단합니다. **부분 충돌 Batch는 Batch 전체에 existing/distinct 하나를 적용하지 않고 충돌 operation별 결정을 받습니다.** `existing`으로 확인한 operation만 no-op으로 건너뛰고 신규/`distinct` operation은 같은 atomic Batch commit에서 계속 처리하며, 이 operation별 결정은 Batch intent에 보존되어 확정 pre-commit 실패 후 재시도에도 유지됩니다. 동일 semantic 후보를 operation별로 배정할 때는 **candidate cardinality를 one-to-one으로 소진**하여 기존 logical operation 1건을 여러 Batch operation의 `existing` 근거로 재사용하지 않습니다. 이 one-to-one 소진은 contribution/ETF의 날짜나 ledger `resourceKey`를 identity로 사용하지 않고 `logicalOperationId`·request ID·`batchRequestId+operationId`·실제 resource ID·`resultVersion` 같은 강한 identity만 사용합니다. 또한 ledger 후보가 incoming과 **동일 batch/logical identity**라면 과거 동일 요청임이 확정된 것이므로 `distinct` 선택을 허용하지 않고 해당 operation을 `existing`으로 고정합니다. 이때 후보 선택 순서는 **content-independent identity ledger의 exact identity(`logicalOperationId` / requestId / `batchRequestId+operationId`) → legacy semantic-ledger exact fallback → semantic candidate** 순서로 고정해, 같은 내용의 정상 별도 operation이 더 최근에 생겼더라도 오래된 SAME retry의 정확한 identity가 최신 semantic 후보에 가려지지 않게 합니다. commit은 성공했지만 receipt/cache/HTTP 응답이 유실된 재시도에서는 intent에 보존된 operation별 결정까지 반영하여 `existing`으로 건너뛴 operation은 deterministic ID 검증 대상에서 제외하고 실제 실행된 신규/`distinct` operation의 최종 효과가 있으면 `batch_duplicate_ignored`로 성공 복구합니다. Git commit 생성은 각 파일마다 `/git/blobs`를 POST하지 않고 `git/trees` entry의 `content`를 직접 사용해 다수 ledger shard가 포함된 Batch에서도 content-generating REST 호출 수를 억제하며, 같은 request 안에서 읽은 ledger shard는 request-local cache로 재사용합니다. shard 파일이 1MB를 넘으면 Contents API object 응답의 `content:""`/`encoding:"none"`을 감지해 Git Blob API로 읽는 fallback을 사용합니다. commit 직전 dependency stale로 실제 mutation이 시작되지 않은 단건 요청은 완료 receipt를 만들지 않고 예약 epoch/intent를 정리해 실패 요청을 완료 처리로 오인하지 않습니다. request별 direct Script Properties는 prefix별 건수/retention 외에 **전체 약 430KB 내부 byte budget**을 write 전에 확보하며, 만료 confirmation은 실제 10분 TTL 기준으로 우선 정리합니다. global budget 확보 과정에서도 활성 Pension/KRX intent는 임의 삭제하지 않아 quota 방어가 causal/idempotency 근거를 훼손하지 않게 합니다. 반대로 Git commit/ref 이동은 성공했지만 GAS receipt/HTTP 응답만 유실된 단건 요청은 같은 atomic commit에 기록된 operation ledger의 `logicalOperationId/requestId`를 **durable success proof**로 사용해 stale 실패가 아니라 `duplicate_ignored`로 복구합니다.

### 7.2 KRX 갱신

대시보드에서는 두 흐름을 사용합니다.

- **최신/누락 반영**: 최신 거래일, 누락 거래일, 장중 저장값의 종가 확정 등 필요한 갱신을 판단
- **선택 날짜 재갱신**: 현재 선택된 날짜를 대상으로 확인하고, 이미 종가 확정된 경우 불필요한 workflow 실행을 생략

처리 구조:

```text
갱신 요청
   ↓
Google Apps Script / workflow_dispatch
   ↓
.github/workflows/update-prices.yml
   ↓
scripts/update_prices.py
   ↓
prices.json / performance_snapshots.json
   ↓
변경 시 commit + push
```

GitHub Actions에서 직접 수동 실행할 때는 필요한 경우 대상 날짜를 지정할 수 있습니다. 같은 branch의 KRX workflow는 `concurrency + queue: max`로 직렬화하면서 pending 실행을 보존합니다. 또한 checkout 이후 연금 저장처럼 KRX 계산과 무관한 commit이 branch를 앞서가면 최신 remote에 rebase하고 제한 횟수만큼 push를 재시도합니다. 반대로 `prices.json`·`performance_snapshots.json` 또는 계산 입력인 `portfolio.json`·`scripts/update_prices.py`·`requirements.txt`·workflow 정의가 remote에서 바뀐 경우에는 과거 checkout 기준 결과를 최신 상태 위에 올리지 않고 fail-closed합니다. GAS는 KRX `requestId`별 dispatch intent/receipt와 `branch + date/mode` 단위 in-flight operation marker를 보존합니다. 완료된 requestId는 Script Properties GC 이후에도 재-dispatch되지 않도록 `data/krx_dispatch_ledger/<request-id-hash-prefix>.json` GitHub shard에 `requestId/hash/workflow_run_id`를 durable proof로 남깁니다. dispatch 성공 뒤 durable ledger write가 실패하면 request intent를 지우지 않아 fail-safe로 동일 requestId를 계속 차단하고, durable ledger 조회 자체가 실패한 경우에도 새 dispatch를 보내지 않습니다. workflow `run-name`에도 date/mode와 requestId를 노출하고 queued/running run을 REST API로 확인하므로, 응답/receipt 유실 뒤 같은 requestId뿐 아니라 새 requestId로 같은 작업을 다시 눌러도 중복 dispatch를 만들지 않습니다. Marker에 `workflow_run_id`가 있으면 marker 나이와 무관하게 해당 run ID를 우선 직접 확인하고, marker 또는 active-run 조회 중 GitHub 상태 확인 자체가 실패하면 `workflow_status_uncertain`으로 **fail-closed**하여 새 dispatch를 보내지 않습니다.

---

## 8. GitHub Pages

배포 기준:

```text
Branch : main
Folder : /root
```

주요 경로:

```text
Main        /
Calc        /add/calc.html
Report      /add/kodex-leverage-report.html
```

GitHub Pages는 배포가 완료된 revision을 보여줍니다. 방금 수정한 로컬/ZIP revision의 개발 QA와 공개 배포본 확인은 구분합니다.

---

## 9. 자동 QA

Node 기반 테스트는 계산·데이터·UI contract의 반복 회귀를 확인하기 위한 개발 안전망입니다.

```text
tests/
├─ main-calc.test.cjs
├─ main-ui-contract.test.cjs
├─ add-calc.test.cjs
├─ add-report-data.test.cjs
├─ add-ui-contract.test.cjs
└─ cross-ui-contract.test.cjs
```

전체 테스트:

```bash
node --test tests/*.test.cjs
```

테스트의 역할:

| 파일 | 대상 |
|---|---|
| `main-calc.test.cjs` | Main 계산 회귀 |
| `main-ui-contract.test.cjs` | Main HTML/CSS/UI contract |
| `add-calc.test.cjs` | Add Calc 계산·validation |
| `add-report-data.test.cjs` | KODEX canonical 데이터와 Report/Main 파생 정합성 |
| `add-ui-contract.test.cjs` | Add HTML/CSS/UI contract |
| `cross-ui-contract.test.cjs` | Main↔Add 공통 UI contract |

어떤 수정에서 어떤 테스트를 우선 실행할지에 대한 상세 QA 절차는 각 handover 문서를 따릅니다.

자동 테스트 개수나 PASS 자체를 프로젝트 품질 점수로 해석하는 기준은 README가 담당하지 않습니다.

---

## 10. 유지보수 문서

프로젝트 문서는 역할별로 분리합니다.

| 문서 | 역할 |
|---|---|
| [README.md](./README.md) | GitHub 프로젝트 소개, 기능, 전체 구조, 데이터·배포·실행 개요 |
| [main_dashboard_maintenance_handover.md](./main_dashboard_maintenance_handover.md) | Main 인수인계, 수정, CSS/JS/UI contract, Main QA |
| [add_maintenance_handover.md](./add_maintenance_handover.md) | Calc/Report 인수인계, 계산·데이터 contract, Add QA |
| [dashboard_evaluation_guide.md](./dashboard_evaluation_guide.md) | Main+Add 평가 방식, 점수, A/B/C, 감점·비감점 기준 |

### 역할별 Source of Truth

```text
실제 현재 구현
→ repository의 실제 HTML / CSS / JS / data / scripts / workflows / tests

Main 유지보수 contract
→ main_dashboard_maintenance_handover.md

Add 유지보수 contract
→ add_maintenance_handover.md

Main↔Add 공통 contract
→ main_dashboard_maintenance_handover.md 8장
→ 실행 정합성은 tests/cross-ui-contract.test.cjs

평가·점수·A/B/C
→ dashboard_evaluation_guide.md

프로젝트 소개
→ README.md

과거 변경 이력
→ Git history
```

README에는 세부 selector, px 값, JavaScript state ownership, 평가 규칙, 차수별 리팩토링 이력을 중복해서 기록하지 않습니다.

---

## 11. 저장소 관리 원칙

Python 실행 중 생성되는 cache 등은 저장소에 포함하지 않습니다.

```gitignore
__pycache__/
*.pyc
```

현재 구현의 세부 유지보수 규칙은 README에 누적하지 않고 해당 handover 문서에서 관리합니다. 프로젝트의 기능·파일 구성·배포 구조가 바뀌었을 때만 README를 함께 갱신합니다.
