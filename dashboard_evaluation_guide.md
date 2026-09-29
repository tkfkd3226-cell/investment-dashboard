# 투자 대시보드 평가 기준

## 1. 명령과 범위

- `점수`, `점수만`: 총점 중심의 간결한 결과
- `평가`, `평가해줘`: 해당 범위의 상세 평가
- `수정해`: A/B급만 수정하고 관련 QA 후 A/B=0에서 종료. C는 별도 요청 없으면 수정하지 않음

평가 범위는 사용자가 지정한 파일/영역을 우선합니다. ZIP 안에 파일이 있다는 이유만으로 GAS·Add·Main 전부를 자동 평가하지 않습니다.

**최신 실제 소스가 Source of Truth**이며 과거 점수/평가 문구를 baseline으로 사용하지 않습니다. Handover는 설계 의도를 확인하는 보조 자료입니다.

자동 테스트는 증거 중 하나입니다. PASS만으로 100점을 주지 않고, FAIL도 실제 기능/contract 결함인지 낡거나 과도한 테스트인지 확인합니다.

## 2. 평가 보호 원칙

- 실제 재현·사용자 영향·구체적 contract 위반이 없는 가설을 A/B로 만들지 않습니다.
- 코드가 방어적이라는 이유로 평가 강도를 계속 올리지 않습니다.
- 테스트 수, 파일 길이, helper 수 자체는 감점/가산 근거가 아닙니다.
- 기존 기능의 의도된 분리나 browser/native fallback을 중복/legacy로 오판하지 않습니다.
- 같은 root cause는 하나의 결함으로 묶습니다.
- 극저확률 다중 장애를 무한 조합하지 않습니다.

## 3. 점수 체계

### CSS /100

| 축 | 비중 |
|---|---:|
| 구조/파일 책임 | 12 |
| Token/Variable/공통화 | 12 |
| Cascade/Specificity | 12 |
| Responsive | 14 |
| Theme/색상 | 10 |
| Interaction/State CSS | 10 |
| Component 일관성 | 10 |
| Dead/Legacy/Fallback | 8 |
| Print/특수환경 | 5 |
| 유지보수성/회귀위험 | 7 |

### JavaScript /100

| 축 | 비중 |
|---|---:|
| Module responsibility/API | 12 |
| Dependency graph | 8 |
| State ownership | 12 |
| Rendering/DOM lifecycle | 10 |
| Event/listener ownership | 8 |
| Async/race/stale state | 14 |
| Error/recovery | 9 |
| Persistence/restore | 9 |
| Lifecycle/cleanup | 8 |
| 유지보수성/확장성 | 10 |

### UI /100

| 축 | 비중 |
|---|---:|
| Visual hierarchy | 10 |
| Layout/alignment | 10 |
| Typography | 8 |
| Spacing/density | 8 |
| Table/Card | 12 |
| Chart/visual data | 10 |
| Modal/Tooltip/Overlay | 10 |
| Control/interaction visual | 8 |
| Responsive | 16 |
| Theme/runtime visual consistency | 8 |

### UX /100

| 축 | 비중 |
|---|---:|
| 정보구조/discoverability | 8 |
| 핵심 flow 정확성 | 14 |
| Feedback/진행상태 | 10 |
| Error recovery | 10 |
| 상태 continuity | 12 |
| Re-entry/duplicate action | 12 |
| Keyboard/touch/accessibility | 10 |
| Persistence/restore/recalculation | 8 |
| Perceived performance | 6 |
| Cross-view/feature consistency | 10 |

```text
UI/UX 총점 = UI와 UX 평균
전체 총점 = CSS / JavaScript / UI / UX 동일가중 평균
```

N/A가 있으면 남은 축을 합리적으로 재배분합니다.

## 4. A / B / C

### A — 실제 수정 필요

핵심 기능 실패, 잘못된 데이터/계산, 저장 손상, 인증 우회, 반복 가능한 중복 mutation, 주요 viewport 사용 불가 등 **즉시 수정 가치가 큰 실제 결함**입니다.

### B — 수정 권장

현실적인 상태전이에서 기능이 막히거나, 사용자 혼란/회귀 가능성이 명확하고 수정 가치가 충분한 문제입니다. 단순 취향·미세 정리·이론적 가능성은 B가 아닙니다.

### C — 비감점 관찰

취향성 개선, 미세 구조 정리, 극저확률 조합, 현재 기능에 영향 없는 방어 심화입니다. C는 100점을 막지 않으며 `수정해`에서 자동 수정하지 않습니다.

## 5. 평가 workflow

```text
1. 최신 실제 소스와 요청 범위 확인
2. 구조/책임/dependency 확인
3. 주요 상태와 사용자 flow 확인
4. async/race/re-entry/persistence 경계 확인
5. 자동 QA와 문서 의미 정합성 확인
6. 현실적인 대표 반례만 bounded하게 검토
7. A/B 판정 및 점수 확정
```

전체 평가에서는 실제 존재하는 화면/flow를 inventory합니다. 존재하지 않는 영역은 N/A로 처리합니다.

### 대표 반례 질문

- 연타/중복 실행하면?
- 닫자마자 다시 열면?
- 응답 순서가 뒤집히면?
- 이전 timer/session이 남으면?
- 처리 중 theme/viewport/tab/date가 바뀌면?
- 저장된 예전 값을 복원하면?
- 0/경계값/empty 상태면?
- keyboard/touch만 사용하면?
- 문서와 실제 코드가 다른 기능을 말하고 있으면?

같은 위험 패턴을 표현만 바꿔 반복하지 않습니다.

## 6. CT35

`평가` / `평가해줘`에서 공통화·토큰화가 범위에 포함되면 `ct35_evaluation.md` 1~35를 확인합니다.

- 전체 Dashboard 평가: Main/Add를 각 항목별로 `점수 또는 N/A`로 기록
- 한 영역만 평가: 반대쪽은 N/A
- 특정 기능 평가: 각 항목을 `적용 / 간접 적용 / N/A`로 분류
- 같은 root cause를 여러 항목에서 중복 감점하지 않음

35개 항목을 출력해야 하는 경우에도 근거는 간결하게 씁니다. **35개를 각각 장문으로 반복하는 것은 요구하지 않습니다.**

## 7. GAS 평가

GAS는 사용자가 GAS를 포함해 달라고 했거나 전체 범위상 실제로 필요한 경우에만 평가합니다.

### 7.1 기본 bounded 모드

```text
syntax/기존 regression
→ 핵심 mutation/dispatch 상태모델
→ 현재 변경 또는 고위험 경계 대표 반례
→ A/B/C
→ 마지막 bounded counterexample pass 1회
→ 새 A/B 없으면 종료
```

코드가 복잡하거나 이미 방어가 많다는 이유로 더 희귀한 반례를 계속 요구하지 않습니다.

### 7.2 Fault budget

B 이상으로 적극 보는 범위:

- 정상 사용자 재시도/동시 요청/다른 탭·기기
- 현실적인 단일 timeout/5xx/409/422/응답 유실
- 한 번의 Properties read/write 불확실성
- 일반적인 GitHub branch 경쟁/queue 전환
- 지원하는 legacy/restore 데이터
- 위 장애 하나 + 자연스러운 재시도/시간 경과

원칙적으로 C/비감점:

- 독립적인 희귀 장애를 2개 이상 겹쳐야만 성립
- production 도달 근거 없이 mock으로만 만든 순서
- stronger durable proof를 일부러 여러 개 제거해야 성립
- 자동 복구/다음 요청에서 자연 수렴하며 영향이 미미
- 수정 복잡도/회귀위험이 운영리스크보다 큼

데이터 손상·중복 금전성 mutation·인증 우회처럼 영향이 큰 영역은 구체적 도달 경로가 있으면 예외적으로 검토합니다.

### 7.3 GAS 점수 /100

| 축 | 비중 |
|---|---:|
| 구조·책임 분리 | 8 |
| 인증·입력·schema 검증 | 8 |
| 업무 저장 정확성 | 14 |
| 원자성·Git 경쟁 | 12 |
| Single 멱등성·stale retry | 12 |
| Batch 적용·확인 | 10 |
| Durable identity/evidence | 10 |
| KRX dispatch/run/race | 12 |
| 실패복구·응답유실 | 6 |
| 정규화·legacy 호환 | 4 |
| Properties/I/O/관측성/유지보수 | 4 |

GAS 점수는 CSS/JS/UI/UX 총점에 자동 합산하지 않습니다.

### 7.4 GAS 대표 seed

현재 변경과 관련된 것만 선택합니다.

- Pension Single: 응답 유실 후 같은 identity 재시도, save/delete/stale retry
- Pension Batch: operation별 existing/distinct, partial conflict, atomicity/cardinality
- Durable evidence: receipt/intent/ledger 우선순위와 terminalization
- KRX: 동일 request 중복 dispatch, run visibility, queue/race, bounded retry/recovery, stale retry 날짜 변질 방지

이미 같은 root cause를 충분히 검증했다면 seed를 추가로 전수 실행하지 않습니다.

## 8. 100점 Gate

100점은 “완벽한 소프트웨어” 선언이 아니라 **현재 평가 범위에서 구체적인 A/B 감점 근거가 없다는 뜻**입니다.

확인:

```text
[ ] 실행 가능한 자동/정적 QA 확인
[ ] A = 0, B = 0
[ ] 구조/상태/async/race/경계/persistence 중 현재 범위 관련 항목 확인
[ ] 문서/schema/workflow 의미 정합성 확인
[ ] 필요한 경우 CT35 확인
[ ] 대표 반례를 bounded하게 검토
[ ] 마지막 pass에서 새 A/B 없음
```

C만 남았다는 이유로 99/99.5를 만들지 않습니다. 반대로 필요한 Gate를 수행하지 않았는데 테스트 PASS만으로 100점을 주지 않습니다.

## 9. 평가/수정 종료 조건

```text
[ ] 미해결 A = 0
[ ] 미해결 B = 0
[ ] 변경 영향 범위 QA PASS 또는 미실시 사유 명시
[ ] 고위험 변경이면 관련 async/persistence/transaction 대표 반례 확인
[ ] 마지막 bounded pass에서 새 A/B 없음
```

종료 후 떠오르는 극저확률 가설이나 C는 실제 증거/새 변경이 생길 때 다시 엽니다.

## 10. 결과 작성

`평가해줘` 기본 결과:

1. 결론과 범위
2. 실행한 검증과 미실시 항목
3. CSS / JavaScript / UI / UX 하위 평가
4. 필요한 경우 CT35 1~35 표
5. 실제 화면영역/UX flow별 핵심 근거
6. A/B 및 필요한 C 관찰
7. 총점과 종료 판단

원칙:

- 100점도 대표 근거를 적습니다.
- 테스트 PASS만 결론으로 쓰지 않습니다.
- 새 결함은 재현 순서 또는 상태전이를 적습니다.
- 브라우저 실기를 하지 않았으면 `실화면 확인`이라고 표현하지 않습니다.
- 좁은 재평가는 영향 없는 전체 프로젝트를 다시 장문 평가하지 않습니다.

## 11. Regression Test 제안 원칙

새 테스트는 다음 중 하나일 때 추가합니다.

- 계산/데이터 정답을 명확히 보호
- 실제로 재발한 버그의 행동을 직접 검증
- async/race/session 같은 코드만 보고 놓치기 쉬운 상태전이를 보호
- cross-module 장기 contract가 깨지면 실제 사용자 영향이 큼

추가하지 않는 예:

- exact selector 순서
- 함수 내부 문장/중간 변수명
- 이미 전용 행동 테스트가 보호하는 기능을 다른 contract 테스트에서 다시 regex로 확인
- 특정 스크린샷의 미세 px를 장기 contract로 고정

테스트가 과도해지면 **중복 source-shape assertion부터 삭제/통합**하고 계산·상태전이 테스트를 우선 보존합니다.

## 12. 문서 유지관리

평가 문서는 평가 방법만 소유합니다. 실제 기능 구현·현재 selector·운영 숫자를 여기에 복제하지 않습니다. 기능 contract는 handover, 실제 구현은 최신 소스, CT35 세부 공통화 항목은 `ct35_evaluation.md`를 봅니다.
