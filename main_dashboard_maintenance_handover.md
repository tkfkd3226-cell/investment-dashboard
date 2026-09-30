# Main Dashboard 유지보수 인수인계

## 1. 문서 목적과 Source of Truth

이 문서는 Main Dashboard를 수정할 때 필요한 **책임 경계·업무 불변조건·운영 절차·QA 범위**만 기록합니다. 함수 내부 호출순서, selector 배열, CSS 한두 px 같은 구현 세부는 최신 소스를 봅니다.

우선순위:

```text
최신 실제 소스/운영 데이터
→ 이 handover의 장기 contract
→ README의 프로젝트 개요
→ 평가 문서의 점수/판정 규칙
```

문서별 역할과 프로젝트 파일 개요는 `README.md`가 소유합니다. 문서와 코드가 다르면 코드를 확인한 뒤 **장기 contract가 실제로 바뀐 경우에만** 이 handover를 갱신합니다.

## 2. Main architecture

### 2.1 Runtime 경계

전체 파일 목록은 `README.md`가 소유합니다. Main runtime은 `index.html`에서 시작해 `css/`와 `js/`의 Dashboard 모듈을 사용하며, KRX 갱신은 Python/workflow, 브라우저 write는 root `GAS_code.js`가 담당합니다.

`dashboard-app.js`에서 도달하는 Main graph는 **13개 ES Module**입니다. `dashboard-market-ai.js`는 별도 standalone entry이며 `dashboard-market-ai-client.js`만 공유합니다.

### 2.2 모듈 책임

| 모듈 | 책임 |
|---|---|
| `kodex-leverage-schema.js` | KODEX canonical JSON 검증, DOM-free |
| `dashboard-core.js` | 데이터 loading, 계산, formatter, 공통 state, live quote snapshot |
| `dashboard-ui-common.js` | 저수준 공통 UI helper/view-state |
| `dashboard-modal.js` | open/close, focus, inert, body lock, ESC/backdrop |
| `dashboard-monthly-calendar.js` | 월간손익 view/state |
| `dashboard-heatmap.js` | 증권 보유종목 treemap view/state |
| `dashboard-charts.js` | 차트 state/SVG/action |
| `dashboard-ui.js` | 일반 UI, Topbar, navigation, 일반 action routing |
| `dashboard-pension.js` | 퇴직연금 조회 View |
| `dashboard-pension-editor.js` | 퇴직연금 변경/persistence flow |
| `dashboard-market-ai-client.js` | Market AI endpoint/transport/preference/event |
| `dashboard-live-valuation.js` | 보유 ticker quote overlay/polling/race guard |
| `dashboard-app.js` | boot와 cross-module orchestration |
| `dashboard-market-ai.js` | 시장·AI 신호 standalone panel |

원칙:

- `core`는 DOM-free를 유지합니다.
- feature 계산/저장을 공통 UI layer로 끌어올리지 않습니다.
- 단순 편의를 위해 feature module이 `dashboard-ui.js`에 역방향 결합하지 않습니다.
- 파일 수나 줄 수를 줄이기 위한 합치기/쪼개기를 하지 않고 **state ownership과 dependency 방향**으로 판단합니다.
- repository text를 `innerHTML`에 넣을 때는 text-safe escape와 trusted markup을 구분합니다.

### 2.3 초기화/entry

- Main boot는 `dashboard-app.js`가 1회 소유합니다.
- Market AI panel은 standalone lifecycle을 유지하고 Main `dataState/uiState`를 직접 소유하지 않습니다.
- cache-bust/importmap 변경은 실제 import graph와 함께 정합화합니다.
- circular dependency와 hidden global bridge를 만들지 않습니다.

## 3. 핵심 데이터/계산 contract

### 3.1 증권 `securitiesEvents`

`securities[]`는 현재 상태, `securitiesEvents`는 과거 상태를 복원하는 거래/원금 원장입니다. 전량매도 종목도 현재 `qty:0`, `cost:0` 형태로 남겨 historical lifecycle을 복원합니다.

매도 event 의미:

```text
price                 실제 체결 단가
grossAmount           거래비용 차감 전 총매도금액
transactionCost       실제 거래비용
amount                실제 순매도대금
costBasis             매도수량 대응 취득원가
realizedProfit        amount - costBasis
cashPrincipalDelta    주식 원금 ↔ 현금 원금 이동액
```

매도/재매수 변경 시 최소 확인 흐름:

```text
매도 전 historical 복원
→ 부분/전량매도
→ 실현손익·현금화 원금
→ 재매수
→ 현재 보유/차트/Live Valuation universe
```

### 3.2 KODEX 별도수익

`data/kodex_leverage_trades.json`이 유일한 거래 원천입니다. Main은 이 파일에서 `separateProfit`을 런타임 파생합니다. 거래 schema와 Add Report의 상세 계산은 `add_maintenance_handover.md`가 소유합니다.

## 4. 기능별 장기 불변조건

### 4.1 월간 손익

- 별도 계산식을 만들지 않고 core의 flow-neutral 일성과 helper를 재사용합니다.
- 범위는 **합산 / 증권 / 퇴직연금**입니다.
- 별도수익 ON은 증권/합산에 당일 증가분만 더하며 퇴직연금 단독에는 섞지 않습니다.
- 모든 viewport에서 월~금 5영업일만 렌더링합니다.
- KRX 거래일인데 Dashboard 데이터가 없으면 `누락`, 실제 비거래 평일은 `휴장`으로 구분합니다.
- 비교 기준이 없는 최초 날짜는 `0원`이 아니라 **기준일**입니다.
- 0원은 월 합계에는 포함하되 상승/하락 일수에는 넣지 않습니다.
- 날짜 선택은 `dashboard-app.js`의 canonical activeDate 경로에 위임합니다.
- live 갱신은 열린 모달만 업데이트하고 탐색 월·범위·포커스·스크롤을 보존합니다.
- 3연속 손실 멘탈케어는 같은 월에서 세 번째 연속 손실일부터 표시하고 0원/수익 또는 월 경계에서 reset합니다.
- Topbar action만 사용하고 hamburger에 중복 진입점을 만들지 않습니다.

세부 live/gloomy/viewport 동작은 전용 테스트가 소유합니다.

### 4.2 포트폴리오 히트맵

히트맵은 **기존 증권 계산결과를 표현하는 View Layer**입니다.

- 가격 fetch, Market AI 요청, 별도 polling, 평가금액/손익 재계산을 소유하지 않습니다.
- 현금과 평가금액 `<=0`은 제외합니다.
- 원본 계산 row를 mutate하지 않습니다.
- mode별 면적 의미:
  - 전일 대비: `|당일손익 금액|`
  - 누적손익: `|누적손익 금액|`
  - 비중: `평가금액`
- color scale/treemap 계산은 deterministic해야 합니다.
- 모달 내부 날짜 이동은 부모 Dashboard activeDate를 바꾸지 않습니다.
- live refresh는 모달 날짜가 부모 activeDate와 맞는 경우에만 현재 overlay를 적용합니다.

### 4.3 퇴직연금 View/Editor

- 조회와 mutation 책임을 `dashboard-pension.js` / `dashboard-pension-editor.js`로 분리합니다.
- 기업적립금/현금성자산/ETF 작업은 stable operation identity와 optimistic precondition을 유지합니다.
- stale/duplicate 응답이 최신 상태를 되돌리지 않게 합니다.
- 삭제·저장 중 action modal dismiss/재진입이 최신 요청 lifecycle을 깨지 않게 합니다.
- duplicate 성공은 과거 request payload가 아니라 최신 server resource에 수렴해야 합니다.
- cross-device 동일/상이 mutation은 서버의 durable identity/evidence로 판정합니다.

GAS 내부 proof lifecycle을 handover에 세세하게 복제하지 않고 실제 `GAS_code.js`와 평가 guide를 봅니다.

### 4.4 Market AI / Live Valuation

경계:

- Dashboard: 수량·원가·원금·매매흐름·historical snapshot 소유
- Market AI: 시장/신호와 ticker별 현재 quote/source/session/usable 소유

적용 원칙:

- 원칙적으로 KST 오늘에 usable quote를 적용합니다.
- 다음 정규장 시작 전에는 직전 완료 거래일의 확정 closed quote를 제한적으로 이어서 사용할 수 있습니다.
- 그보다 오래된 과거 날짜와 운영 JSON에는 overlay를 적용하지 않습니다.
- unusable ticker만 저장 JSON 값으로 fallback합니다.
- 개별주식 extended와 ETF closed가 섞일 수 있으므로 ticker별 market state를 사용합니다.
- Market AI OFF/OFFLINE에서는 저장 JSON 기반 Dashboard가 독립 동작합니다.
- 시장/Signal polling과 보유종목 Live Valuation은 별도 lifecycle입니다.
- 현재 5초 polling은 **진행 중 요청 중복 금지**, stale generation 폐기, universe drift 처리, hidden/OFF gating을 유지합니다.
- 페이지 스크롤 중에는 Live Valuation DOM 부분 렌더를 보류하고, 마지막 스크롤 후 200ms 뒤 누적된 최신 상태를 1회 반영합니다. 5초 network polling과 기존 scroll 위치 복원은 그대로 유지합니다.
- 연결 해제/재연결, modal open, activeDate/session 전환에서 stale 응답이 최신 UI를 덮지 않아야 합니다.
- 실시간 quote는 운영 JSON/GAS에 저장하지 않습니다.

Endpoint contract:

```text
Local  : 127.0.0.1:8001
Remote : Tailscale Serve → 127.0.0.1:8002 GET-only proxy
```

### 4.5 Chart / Modal / Tooltip

- 차트는 계산 owner와 렌더 owner를 분리합니다.
- expanded chart는 별도 계산 state를 복제하지 않습니다.
- legend selection은 최소 1개 series를 유지합니다.
- 자동 Y축은 양/음수 혼합에서도 좌우 비교 0선 의미를 보존합니다.
- Modal lifecycle은 `dashboard-modal.js`를 재사용합니다.
- feature는 modal 내용/데이터/저장 책임을 직접 소유합니다.
- tooltip은 view data를 설명하되 별도 계산 source가 되지 않습니다.

## 5. UI / Responsive / CSS contract

### 5.1 기본 viewport

```text
Desktop  ≥ 1101
Tablet   761 ~ 1100
Phone    ≤ 760
```

- 터치 스마트폰 가로는 Phone family입니다.
- iPhone Safari 데스크탑 웹사이트 요청은 `1280px` contract를 유지합니다.
- 특정 스크린샷을 맞추기 위한 새 breakpoint는 만들지 않습니다.

### 5.2 CSS 파일 책임

| 파일 | 책임 |
|---|---|
| `common.css` | 공통 token, Desktop 기본, 공통 component |
| `tablet.css` | Tablet override |
| `mobile.css` | Phone 기본 |
| `special.css` | orientation/기능성 예외 |
| `interaction.css` | hover/focus/interaction |
| `print.css` | Print |

규칙:

- 기존 token/owner를 수정할 수 있으면 새 override를 덧붙이지 않습니다.
- 동일 selector의 override 누적과 근거 없는 `!important`를 피합니다.
- one-use 값까지 억지 token화하지 않습니다.
- 일반 CSS 원칙을 이 handover에 반복 설명하지 않고 `ct35_evaluation.md`와 실제 CSS를 봅니다.

### 5.3 Print

Print는 화면 다크모드와 무관하게 밝은 인쇄 표현을 유지합니다. Market AI 등 인쇄 제외 대상은 `print.css`의 현재 contract를 따릅니다.

## 6. 운영 데이터 / KRX / GAS

### 6.1 운영 데이터 보호

일반 UI 패치에서 다음 운영 데이터의 과거 복사본을 덮어쓰지 않습니다.

```text
data/prices.json
data/performance_snapshots.json
data/kodex_leverage_trades.json
data/pension_contributions.json
data/pension_cash_snapshots.json
data/pension_trades.json
```

`pension_operation_ledger/`, `pension_operation_identity/`, `pension_batch_request_identity/`, `krx_dispatch_ledger/`는 GAS가 사용하는 repository-only durable state입니다.

### 6.2 GAS

- Root `GAS_code.js`가 canonical source입니다.
- 운영 인증/연동값은 Script Properties로 관리합니다.
- GitHub 파일 수정만으로 운영 Web App이 바뀌지 않으므로 새 버전 배포가 필요합니다.
- Single/Batch mutation은 stable identity, precondition, durable evidence, fail-closed recovery를 유지합니다.
- 실제로 반영된 뒤 응답만 유실된 경우 중복 mutation 없이 read-back/reconciliation으로 수렴해야 합니다.
- 수동 KRX hot path에 자동 scheduler/recovery용 불필요한 원격 I/O를 추가하지 않습니다.

### 6.3 KRX 가격 갱신

- KST `09:00 ≤ t < 15:30`: 장중 가격
- **15:30 정각부터**: 정규장 종가
- 과거 거래일: 실행시각과 무관하게 정규장 종가
- 2026-09-14 이후 장마감/과거일: 네이버 KRX 1분봉의 정확한 `15:30:00` 행만 종가로 인정
- 해당 행이 없으면 pykrx/일봉/애프터마켓 값으로 대체하지 않고 fail-closed
- 선택일 재갱신은 기존 label과 무관하게 실제 dispatch 가능
- 매도 완료 종목은 매도 후 신규 조회에서는 제외하되 과거 backfill에서는 조회

Workflow 자동 commit 대상:

```text
data/prices.json
data/performance_snapshots.json
data/krx_trading_calendar.json
```

`update-prices.yml`의 날짜 입력 의미:

```text
날짜 지정 → 해당 거래일 종목/성과 갱신 + 저장 구간 KOSPI backfill 확인
날짜 비움 → 최신/누락/재확정 대상 자동 판단 + KOSPI backfill 확인
```

`비워두면 한국시간 오늘`이라는 과거 설명으로 되돌리지 않습니다.

`pages.yml`은 KRX workflow 성공 완료 뒤 **최신 main**을 checkout해 배포합니다.

### 6.4 KRX 자동 scheduler/recovery

운영 적용:

```text
GAS_code.js 교체
→ Web App 새 버전 배포
→ installKrxAutoScheduler() 1회
→ 권한 승인
→ showKrxAutoSchedulerStatus() 확인
```

중지:

```text
removeKrxAutoScheduler()
```

원칙:

- 기존 manual dispatch core를 재사용합니다.
- recurring scheduler, one-shot, retry/verification pending 상태를 구분합니다.
- transient만 bounded retry하고 terminal/4xx는 자동 반복하지 않습니다.
- stale/orphan retry가 다음 날짜 request로 변질되면 안 됩니다.
- exact run 미가시성을 terminal failure로 단정해 중복 recovery dispatch하지 않습니다.
- detailed recovery 상태전이는 `tests/krx-auto-recovery.test.cjs`가 소유합니다.

### 6.5 Python dependency

직접 dependency와 정확한 버전의 Source of Truth는 `requirements.txt`입니다. 버전 변경 시 Python 3.11과 실제 사용 API를 확인합니다.

## 7. QA 체계

### 7.1 원칙

테스트 목적은 **실제 기능/업무 contract 보호**입니다.

- 계산/상태전이는 가능한 한 production 함수를 실행하는 행동 테스트를 우선합니다.
- `main-ui-contract.test.cjs`는 장기 구조·접근성·반응형 경계만 보호합니다.
- 전용 행동 테스트가 생긴 기능의 내부 함수명, selector 순서, 중간 변수, 정확한 구현문을 `main-ui-contract`에서 다시 중복 고정하지 않습니다.
- 의도된 contract 변경이면 구현과 관련 테스트를 함께 바꿉니다.
- 테스트 FAIL은 실제 회귀인지 낡거나 과도한 테스트인지 먼저 구분합니다.

### 7.2 Main 테스트 지도

기존의 “Main 직접 테스트는 두 개”라는 설명은 폐기합니다. 현재 기능별 전용 테스트까지 포함한 실제 지도는 다음과 같습니다.

| 테스트 | 담당 범위 | 언제 실행 |
|---|---|---|
| `tests/main-calc.test.cjs` | 원금·손익·수익률·매도/재매수·연금 계산 | 계산 변경 |
| `tests/main-ui-contract.test.cjs` | Main 장기 구조/UI contract | 일반 Main UI/구조 변경 |
| `tests/chart-interaction.test.cjs` | 차트 축 hover·범례 interaction 행동 | 차트 축/범례 interaction 변경 |
| `tests/investor-title.test.cjs` | 투자 칭호 state/획득/renderer | 칭호 변경 |
| `tests/monthly-calendar-live.test.cjs` | 열린 월간손익 live refresh | 월간손익/live 변경 |
| `tests/monthly-calendar-gloomy.test.cjs` | 3연속 손실 멘탈케어 | gloomy 변경 |
| `tests/monthly-calendar-viewport.test.cjs` | 5영업일/viewport 안정성 | 월간손익 responsive 변경 |
| `tests/live-valuation-polling.test.cjs` | 5초 polling/race/reconnect/universe/modal | Live Valuation 변경 |
| `tests/heatmap-engine.test.cjs` | treemap geometry/면적/color 계산 | 히트맵 계산 변경 |
| `tests/heatmap-shell.test.cjs` | 히트맵 entry/modal/interaction ownership | 히트맵 UI 변경 |
| `tests/krx-auto-recovery.test.cjs` | 자동 recovery 상태전이/중복 방지 | KRX 자동복구 변경 |
| `tests/update_prices_test.py` | updater, 거래일/가격/성과 스냅샷 | Python/workflow 변경 |
| `tests/cross-ui-contract.test.cjs` | Main↔Add 공유 appearance/viewport/asset | 공통 contract 변경 |
| `tests/add-report-data.test.cjs` | KODEX canonical 원천과 Main 별도수익 정합성 | KODEX 거래/schema 변경 |

### 7.3 실행 기준

저장소 전체 실행 명령은 `README.md`가 소유합니다. 기능 수정 시에는 위 테스트 지도에서 직접 관련된 전용 테스트를 먼저 실행하고, 영향 범위가 넓거나 전체 검증 요청이 있을 때 전체 QA로 확장합니다.

### 7.4 정적 QA

변경 범위에 따라 확인:

```text
JS syntax/import/export
circular dependency 0
필수 local path/DOM id 존재
JSON parse
YAML parse
listener/boot 중복
운영 데이터 비의도 변경 없음
대규모 포맷 diff 없음
```

브라우저 자동 캡처는 기본 QA에서 제외합니다. 실제 화면/기기 확인을 하지 않았으면 정적·코드흐름·자동QA로 구분해 기록합니다.

### 7.5 FAIL 처리

```text
FAIL 원인 특정
→ 실제 회귀 vs 낡은/과도한 테스트 구분
→ 최소 수정
→ 직접 실패 테스트 재실행
→ 연결된 대표 회귀만 재검증
```

테스트를 통과시키기 위해 운영 코드를 왜곡하거나, 실제 결함을 테스트 삭제로 숨기지 않습니다.

## 8. 변경 절차와 diff

```text
최신 소스 확인
→ 책임 파일/영향 범위 특정
→ 최소 수정
→ 관련 자동/정적 QA
→ diff 확인
→ 장기 contract가 바뀐 경우에만 문서 수정
```

전달 전 확인:

- 의도한 파일만 변경됐는가
- 운영 JSON이 불필요하게 바뀌지 않았는가
- 최근 수정이 롤백되지 않았는가
- dead code/중복 rule이 새로 생기지 않았는가
- 단순 rename/formatting이 대규모 diff를 만들지 않았는가

## 9. Main ↔ Add 공유 contract

공유 항목:

- Light/Dark 및 Corner appearance storage/channel
- Desktop/Tablet/Phone breakpoint 의미
- Phone Landscape 판정
- iPhone Safari desktop-request `1280px`
- `img/favicon.png`, `img/ui-icons.svg`
- `js/kodex-leverage-schema.js`
- `data/kodex_leverage_trades.json`

공유 contract를 바꿀 때만 `tests/cross-ui-contract.test.cjs`를 함께 봅니다. 비슷하게 생겼다는 이유로 두 영역의 CSS/JS를 합치지 않습니다.

## 10. 문서/테스트 유지관리 원칙

새 버그를 막기 위해 항상 **테스트 + handover 상세 설명을 둘 다 추가**하는 방식은 사용하지 않습니다.

- 반복될 가치가 있는 기능 동작 → 전용 행동 테스트
- 사람이 코드만 보고 알기 어려운 장기 업무/운영 규칙 → handover
- 구현 세부·현재 함수명·selector 위치 → 최신 소스
- 평가 방법/일반 CSS·JS 품질 기준 → evaluation 문서

같은 사실을 여러 문서와 여러 테스트에 중복 기록하지 않습니다.
