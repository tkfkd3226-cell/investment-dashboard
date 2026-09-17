/**
 * Investment Dashboard Google Apps Script (단일 파일 유지)
 *
 * 역할
 * - GitHub JSON 읽기/쓰기
 * - 퇴직연금 기업적립금·현금성자산·ETF 추가 매수 저장/삭제
 * - 퇴직연금 작업 모음(Batch) 원자적 반영 및 중복 실행 방지
 * - KRX 현재가 갱신용 GitHub Actions workflow_dispatch 실행
 *
 * 호출 구조
 * GitHub Pages
 * → Google Apps Script Web App
 * → Script Properties의 인증/저장소 설정 사용
 * → GitHub REST API 또는 GitHub Actions 호출
 *
 * 클라이언트 action 계약
 * - updateKrxPrices : KRX 최신/누락 반영 또는 선택일 재갱신
 * - batchPension    : 퇴직연금 작업 모음 일괄 반영
 * - upsert/delete   : cashSnapshot / contribution / etfTrade 단건 처리
 *
 * Script Properties (운영 설정)
 * - GITHUB_OWNER
 * - GITHUB_REPO
 * - GITHUB_BRANCH
 * - GITHUB_TOKEN
 * - ADMIN_PIN (숫자 6자리 관리자 PIN)
 *
 * Script Properties (내부 자동 관리)
 * - PENSION_REQ_R_* / PENSION_REQ_I_* (단건 request별 receipt/intent)
 * - PENSION_BATCH_R_* / PENSION_BATCH_I_* (batch request별 receipt/intent)
 * - PENSION_REQUEST_RECEIPTS / PENSION_REQUEST_INTENTS (legacy read-only fallback)
 * - PENSION_BATCH_RECEIPTS / PENSION_BATCH_INTENTS (legacy read-only fallback)
 * - KRX_DISPATCH_R_* / KRX_DISPATCH_I_* (KRX request별 receipt/intent)
 * - KRX_OP_* (branch+date/mode 단위 in-flight operation marker)
 * - PENSION_MUTATION_EPOCH (Pension 단조 증가 causal epoch)
 * - PENSION_CONFIRM_* (state-bound duplicate confirmation token)
 * - KRX_DISPATCH_RECEIPTS (legacy read-only fallback)
 *
 * 유지보수 원칙
 * - GAS는 여러 .gs 파일로 분리하지 않고 이 1파일 구조와 기능별 섹션 순서를 유지한다.
 * - 업무 처리 함수는 plain object를 반환하고 ContentService 응답 생성은 Web App Entry에서만 수행한다.
 * - GitHub Token/PIN 등 비밀값은 소스에 넣지 않고 Script Properties에만 둔다.
 * - Pension mutation은 exact identity + semantic ledger + mutation epoch/confirmation을 사용하고, cashSnapshot은 optimistic concurrency를 적용한다.
 * - direct request property는 저장 예산과 active intent 보호를 지키며, stale/abandoned intent는 durable identity/tombstone 확보 후 정리한다.
 * - KRX 갱신은 frontend requestId + durable dispatch ledger + operation marker/workflow run proof로 중복 dispatch와 race를 막고 불확실 상태는 fail-closed한다.
 * - 세부 transaction/idempotency lifecycle invariant와 회귀 기준은 main_dashboard_maintenance_handover.md 및 dashboard_evaluation_guide.md를 따른다.
 *
 * 응답 지연(latency) 최적화 원칙
 * - 성능 목표는 연산 자체보다 GitHub/GAS 원격 I/O 왕복과 중복 read/write를 줄여 전체 요청 지연을 낮추는 것이다.
 * - 정합성·idempotency·fail-closed 계약이 성능보다 우선하며, fast-path가 안전 조건을 만족하지 못하면 기존 slow-path로 fallback한다.
 * - request-local cache는 같은 immutable base commit의 JSON에만 사용하고, 최신 HEAD 확인·commit CAS·write read-back은 fresh read를 유지한다.
 * - 서로 독립적인 GitHub GET은 fetchAll로 병렬화하고, 안전한 Script Properties write는 batch write를 사용하되 exact read-back 계약을 유지한다.
 * - Pension/KRX timing은 운영 latency 관측용이며 business state나 mutation 판단 근거로 사용하지 않는다.
 */

/* =========================================================
 * 00. Structure Map / Maintenance Guide
 * =========================================================
 * 01. 공통 기반 / Script Properties / Request State
 *     01A 공통 응답·안전 정수
 *     01B Request maintenance·quota·mutation epoch
 *     01C Active intent terminalization·GC
 *     01D Direct property write·batch fast-path
 * 02. 인증 / 관리자 PIN
 * 03. 날짜 / KST 공통 Helper
 * 04. GitHub REST / 병렬 I/O / JSON Commit
 *     04A Transport·fetchAll 병렬 GET
 *     04B Contents decode·JSON read
 *     04C 단일 JSON Contents CAS
 *     04D Git tree batch commit·branch CAS
 * 05. 퇴직연금 Target / Normalize / ID
 * 06. 퇴직연금 현금흐름 / Snapshot / Latency 계측
 * 07. 퇴직연금 단건 Transaction / Durable Identity
 *     Semantic ledger → request cache/preflight → exact identity
 *     → duplicate confirmation → stale retry → upsert/delete
 * 08. 퇴직연금 Batch 적용 / Atomic Commit
 * 09. Pension Idempotency / Retry / Batch Orchestration
 *     Request identity → receipt/intent → durable recovery
 *     → duplicate/conflict confirmation → parallel prefetch → execute
 * 10. KRX 갱신 / Durable Dispatch / GitHub Actions
 *     Dispatch decision → durable ledger → local evidence
 *     → workflow proof → remote preflight → dispatch/persist → latency
 * 11. Web App Entry / Router
 *
 * Latency hot path
 * - Pension Single: immutable-base request cache + parallel dependency preflight
 * - Pension Batch : initial/dependency/state 병렬 prefetch + request-local cache
 * - Script Props  : maintenance boundary 이후 batch fast-path
 * - KRX           : 독립 remote state 병렬 preflight + 단계별 timing
 *
 * 변경 원칙
 * - 섹션/주석 정리는 실행 순서와 transaction/idempotency 의미를 바꾸지 않는다.
 * - latency 최적화 시 latest HEAD/CAS/read-back을 cache로 대체하지 않는다.
 * - durable proof를 줄여 빨라지는 변경은 최적화로 보지 않는다.
 * ========================================================= */

const KRX_WORKFLOW_FILE = "update-prices.yml";
const KRX_DISPATCH_LEDGER_DIR = "data/krx_dispatch_ledger";
const KRX_DISPATCH_LEDGER_SHARD_PREFIX_LENGTH = 2;
const KRX_ACTIVE_WORKFLOW_STATUSES = Object.freeze(["queued", "in_progress", "waiting", "pending", "requested"]);
const KRX_ACTIVE_WORKFLOW_PAGE_SIZE = 100;
const PENSION_OPERATION_LEDGER_LEGACY_PATH = "data/pension_operation_ledger.json";
const PENSION_OPERATION_LEDGER_DIR = "data/pension_operation_ledger";
const PENSION_OPERATION_LEDGER_SHARD_PREFIX_LENGTH = 2;
const PENSION_OPERATION_IDENTITY_DIR = "data/pension_operation_identity";
const PENSION_OPERATION_IDENTITY_SHARD_PREFIX_LENGTH = 2;
const PENSION_BATCH_REQUEST_IDENTITY_DIR = "data/pension_batch_request_identity";
const PENSION_BATCH_REQUEST_IDENTITY_SHARD_PREFIX_LENGTH = 2;
const PENSION_CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const DURABLE_GITHUB_CAS_ATTEMPTS = 3;

const PENSION_TARGET_META = Object.freeze({
  cashSnapshot: Object.freeze({
    dataPath: "data/pension_cash_snapshots.json",
    collectionKey: "snapshots",
    wrapOnWrite: false
  }),
  contribution: Object.freeze({
    dataPath: "data/pension_contributions.json",
    collectionKey: "contributions",
    wrapOnWrite: false
  }),
  etfTrade: Object.freeze({
    dataPath: "data/pension_trades.json",
    collectionKey: "trades",
    wrapOnWrite: true
  })
});

/* =========================================================
 * 01. 공통 기반 / Script Properties / Request State
 * ========================================================= */

/* --- 01A. 공통 응답 / 안전 정수 --------------------------------------------------- */

// JSON 응답을 생성한다.
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 필수 Script Property를 읽고 누락 시 즉시 실패시킨다.
function getProp(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);

  if (!value) {
    throw new Error("Missing script property: " + name);
  }

  return value;
}


// 퇴직연금 금액/수량 입력을 JavaScript 안전 정수 범위에서 검증한다.
function isSafePensionWhole(value, positive) {
  return Number.isSafeInteger(value) && (positive ? value > 0 : value >= 0);
}

// 퇴직연금 파생 현금 계산도 안전 정수 범위를 벗어나면 즉시 실패시킨다.
function assertSafePensionCalculation(result, label) {
  if (!Number.isSafeInteger(result)) {
    throw new Error((label || "금액") + " 계산 결과가 안전한 정수 범위를 벗어났습니다.");
  }
  return result;
}

function safePensionAdd(left, right, label) {
  return assertSafePensionCalculation(Number(left) + Number(right), label);
}

function safePensionSubtract(left, right, label) {
  return assertSafePensionCalculation(Number(left) - Number(right), label);
}

/* --- 01B. Request Maintenance / Quota / Mutation Epoch -------------------- */

// Apps Script Properties의 값 1개 한도(9KB)보다 여유를 둔 내부 JSON 예산.
// 단일 property는 실제 UTF-8 byte 크기를 제한한다. TTL/cap 직접 정리는 receipt/confirmation/marker에만 적용하고, 오래된 active intent는 durable identity/tombstone 확보 후 terminalize한다.
const PENSION_PROPERTY_VALUE_BUDGET_BYTES = 8000;
const REQUEST_PROPERTY_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
// active intent는 임의 삭제하지 않되, 장시간 응답이 없거나 prefix cap을 채우면
// GitHub durable identity/tombstone을 먼저 확보한 뒤 terminal receipt로 승격해 active slot을 회수한다.
const ACTIVE_INTENT_TERMINALIZE_MS = 24 * 60 * 60 * 1000;
// 일반 foreground 요청 하나가 abandoned intent 전체를 한꺼번에 GitHub로 terminalize하지 않도록
// background-style cleanup은 doPost 실행 전체에서 소수만 점진 처리한다. prefix cap 확보도 같은 실행 budget 안에서 필요한 1건을 우선 처리한다.
const ACTIVE_INTENT_BACKGROUND_TERMINALIZE_LIMIT = 3;
// 한 doPost 실행 안에서는 direct property write가 여러 번 발생해도 같은 cleanup budget을 공유한다.
// GAS warm instance 재사용 가능성을 고려해 doPost 진입/종료 때마다 scope를 명시적으로 초기화/복원한다.
let DIRECT_REQUEST_MAINTENANCE_CONTEXT = null;
function beginDirectRequestMaintenanceScope() {
  const previous = DIRECT_REQUEST_MAINTENANCE_CONTEXT;
  DIRECT_REQUEST_MAINTENANCE_CONTEXT = {
    terminalizeBudget: { remaining: ACTIVE_INTENT_BACKGROUND_TERMINALIZE_LIMIT },
    protectedActiveIntentKeys: {},
    snapshotBoundaryPrepared: false,
    activeTerminalizationFrozen: false
  };
  return previous;
}
function restoreDirectRequestMaintenanceScope(previous) {
  DIRECT_REQUEST_MAINTENANCE_CONTEXT = previous || null;
}
function directRequestMaintenanceContext() {
  return DIRECT_REQUEST_MAINTENANCE_CONTEXT || null;
}
function directRequestTerminalizeBudget() {
  return DIRECT_REQUEST_MAINTENANCE_CONTEXT && DIRECT_REQUEST_MAINTENANCE_CONTEXT.terminalizeBudget
    ? DIRECT_REQUEST_MAINTENANCE_CONTEXT.terminalizeBudget
    : { remaining: ACTIVE_INTENT_BACKGROUND_TERMINALIZE_LIMIT };
}
function directRequestActiveIntentProtected(key) {
  const context = directRequestMaintenanceContext();
  return !!(context && context.protectedActiveIntentKeys && context.protectedActiveIntentKeys[String(key || "")]);
}
function protectDirectRequestActiveIntentKey(key) {
  const context = directRequestMaintenanceContext();
  if (!context || !key) return;
  context.protectedActiveIntentKeys[String(key)] = true;
}
// Apps Script 전체 Script Properties 500KB 한도에 운영 설정/legacy 값을 위한 여유를 남긴다.
// direct request property는 write 전에 global budget을 확보해 quota 초과가 prune보다 먼저 발생하지 않게 한다.
const DIRECT_REQUEST_GLOBAL_BUDGET_BYTES = 430 * 1024;
const PENSION_MUTATION_EPOCH_KEY = "PENSION_MUTATION_EPOCH";
const KRX_OPERATION_VISIBILITY_GRACE_MS = 60 * 1000;
const DIRECT_REQUEST_PROPERTY_LIMITS = Object.freeze({
  PENSION_REQ_R_: 600,
  PENSION_REQ_I_: 100,
  PENSION_BATCH_R_: 120,
  PENSION_BATCH_I_: 40,
  KRX_DISPATCH_R_: 100,
  KRX_DISPATCH_I_: 40,
  KRX_OP_: 100,
  PENSION_CONFIRM_: 120
});
const DIRECT_REQUEST_ACTIVE_INTENT_PREFIXES = Object.freeze({
  PENSION_REQ_I_: true,
  PENSION_BATCH_I_: true,
  KRX_DISPATCH_I_: true
});

// 모든 Pension mutation은 같은 ScriptLock 아래에서 이 단조 증가 epoch를 공유한다.
// Git blob SHA는 파일 내용이 원복되면 과거 SHA로 되돌아갈 수 있으므로 causal version으로 사용하지 않는다.
function getPensionMutationEpoch() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PENSION_MUTATION_EPOCH_KEY);
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("PENSION_MUTATION_EPOCH 값이 손상되었습니다.");
  }
  return value;
}

function reserveNextPensionMutationEpoch() {
  const props = PropertiesService.getScriptProperties();
  const current = getPensionMutationEpoch();
  if (current >= Number.MAX_SAFE_INTEGER - 1) {
    throw new Error("Pension mutation epoch가 안전한 정수 범위를 초과했습니다.");
  }
  const next = current + 1;
  try {
    props.setProperty(PENSION_MUTATION_EPOCH_KEY, String(next));
    return next;
  } catch (err) {
    // Script Properties도 remote write와 마찬가지로 "반영됐지만 응답만 실패"할 수 있다.
    // 예약값이 실제 저장됐다면 성공으로 인정해 phantom epoch만 남는 상태를 만들지 않는다.
    try {
      const observed = Number(props.getProperty(PENSION_MUTATION_EPOCH_KEY));
      if (Number.isSafeInteger(observed) && observed === next) return next;
    } catch (_) {}
    throw err;
  }
}

// 동일 ScriptLock 안에서 mutation이 확실히 발생하지 않았음을 확인한 경우에만 예약 epoch를 되돌린다.
function rollbackPensionMutationEpoch(reservedEpoch) {
  const value = Number(reservedEpoch || 0);
  if (!Number.isSafeInteger(value) || value <= 0) return false;
  const props = PropertiesService.getScriptProperties();
  const current = getPensionMutationEpoch();
  if (current !== value) return false;
  const previous = value - 1;
  try {
    props.setProperty(PENSION_MUTATION_EPOCH_KEY, String(previous));
    return true;
  } catch (err) {
    // rollback write의 응답만 유실된 경우에도 실제 저장 상태를 우선한다.
    try {
      const observed = Number(props.getProperty(PENSION_MUTATION_EPOCH_KEY));
      if (Number.isSafeInteger(observed) && observed === previous) return true;
    } catch (_) {}
    throw err;
  }
}

function utf8ByteLength(text) {
  try {
    return Utilities.newBlob(String(text || ""), "text/plain").getBytes().length;
  } catch (_) {
    return unescape(encodeURIComponent(String(text || ""))).length;
  }
}


// request별 direct property는 전체 500KB 저장소를 무한히 잠식하지 않도록
// receipt/marker는 retention을 적용하고 confirmation은 실제 token TTL(10분)에 맞춰 더 적극적으로 정리한다. 활성 intent는 prune에서 별도 보호한다.
function directRequestPropertyRetentionMs(prefix) {
  return String(prefix || "") === "PENSION_CONFIRM_" ? PENSION_CONFIRMATION_TTL_MS : REQUEST_PROPERTY_RETENTION_MS;
}

function directRequestPropertyPrefixForKey(key) {
  const text = String(key || "");
  return Object.keys(DIRECT_REQUEST_PROPERTY_LIMITS).find(function(prefix) { return text.indexOf(prefix) === 0; }) || "";
}

function directRequestPropertySavedAtMs(raw) {
  const parsed = parsePensionDirectProperty(raw);
  return Number(parsed && parsed.savedAtMs || 0) || Date.parse(String(parsed && parsed.savedAtKST || "")) || 0;
}

function scriptPropertiesUtf8Bytes(all) {
  return Object.keys(all || {}).reduce(function(sum, key) {
    return sum + utf8ByteLength(key) + utf8ByteLength(all[key]);
  }, 0);
}

/* --- 01C. Active Intent Terminalization / GC ------------------------------ */

// active intent를 그대로 삭제하지 않고 durable identity/tombstone 확보 후 대응 receipt로 승격한다.
// durable identity는 receipt GC 이후에도 같은 identity+다른 내용 재사용을 차단한다.
function terminalIntentReceiptDescriptor(prefix, intent, entryKey) {
  const value = intent || {};
  const nowMs = Date.now();
  if (prefix === "PENSION_REQ_I_") {
    const identity = String(value.key || "");
    if (!identity || !String(value.hash || "")) return null;
    return {
      prefix: "PENSION_REQ_R_",
      key: requestDirectPropertyKey("PENSION_REQ_R_", identity),
      value: {
        key: identity, hash: String(value.hash || ""), target: String(value.target || ""),
        terminalStale: true, reason: "abandoned_intent_terminalized",
        savedAtKST: nowKSTText(), savedAtMs: nowMs
      }
    };
  }
  if (prefix === "PENSION_BATCH_I_") {
    const identity = String(value.id || "");
    if (!identity || !String(value.operationsHash || "")) return null;
    return {
      prefix: "PENSION_BATCH_R_",
      key: requestDirectPropertyKey("PENSION_BATCH_R_", identity),
      value: {
        id: identity, operationsHash: String(value.operationsHash || ""), commitSha: "", changedFiles: [],
        terminalStale: true, reason: "abandoned_intent_terminalized",
        savedAtKST: nowKSTText(), savedAtMs: nowMs
      }
    };
  }
  if (prefix === "KRX_DISPATCH_I_") {
    const identity = String(value.requestId || value.id || "");
    const sourceKey = String(entryKey || "");
    const suffix = sourceKey.indexOf("KRX_DISPATCH_I_") === 0 ? sourceKey.slice("KRX_DISPATCH_I_".length) : "";
    // v14 이전 intent는 raw requestId를 저장하지 않았지만 direct-property suffix 자체가
    // requestId hash이므로 동일 suffix의 receipt key로 안전하게 승격할 수 있다.
    if ((!identity && !suffix) || !String(value.hash || "")) return null;
    return {
      prefix: "KRX_DISPATCH_R_",
      key: identity ? requestDirectPropertyKey("KRX_DISPATCH_R_", identity) : ("KRX_DISPATCH_R_" + suffix),
      value: {
        hash: String(value.hash || ""), branch: String(value.branch || ""), date: String(value.date || ""),
        reason: "dispatch_uncertain_terminal", workflowRunId: String(value.workflowRunId || ""),
        runUrl: String(value.runUrl || ""), htmlUrl: String(value.htmlUrl || ""), terminalUncertain: true,
        savedAtKST: nowKSTText(), savedAtMs: nowMs
      }
    };
  }
  return null;
}

function terminalIntentReceiptCompatible(existing, descriptor) {
  const current = existing || {};
  const next = descriptor && descriptor.value || {};
  const prefix = String(descriptor && descriptor.prefix || "");
  if (prefix === "PENSION_REQ_R_") {
    return String(current.hash || "") && String(current.hash || "") === String(next.hash || "");
  }
  if (prefix === "PENSION_BATCH_R_") {
    return String(current.operationsHash || "") && String(current.operationsHash || "") === String(next.operationsHash || "");
  }
  if (prefix === "KRX_DISPATCH_R_") {
    return String(current.hash || "") && String(current.hash || "") === String(next.hash || "");
  }
  return false;
}

function persistTerminalIntentDurableIdentity(prefix, intent, entryKey, existingReceipt) {
  const value = intent || {};
  if (prefix === "PENSION_REQ_I_") {
    return rememberPensionSingleTerminalIdentityState(String(value.key || ""), String(value.hash || ""), String(value.target || ""), value);
  }
  if (prefix === "PENSION_BATCH_I_") {
    const status = existingReceipt && existingReceipt.terminalStale !== true ? "completed" : "terminal_stale";
    return rememberPensionBatchRequestDurableIdentityState(String(value.id || ""), String(value.operationsHash || ""), status, {
      commitSha: String(existingReceipt && existingReceipt.commitSha || ""),
      reason: String(existingReceipt && existingReceipt.reason || (status === "completed" ? "receipt_recovered" : "abandoned_intent_terminalized"))
    });
  }
  if (prefix === "KRX_DISPATCH_I_") {
    const requestId = String(value.requestId || value.id || "");
    const sourceKey = String(entryKey || "");
    const legacyIdentityHash = sourceKey.indexOf("KRX_DISPATCH_I_") === 0 ? sourceKey.slice("KRX_DISPATCH_I_".length) : "";
    const dispatchAccepted = value.dispatchAccepted === true || !!String(value.workflowRunId || "");
    const dispatchRejected = value.dispatchRejected === true;
    const receiptCompleted = !!(existingReceipt && existingReceipt.terminalUncertain !== true);
    const completed = dispatchAccepted || receiptCompleted;
    const info = {
      branch: String(value.branch || ""), date: String(value.date || ""),
      reason: dispatchRejected && !completed ? "dispatch_rejected" : (completed ? String(existingReceipt && existingReceipt.reason || value.reason || "dispatch_accepted_recovered") : "dispatch_uncertain_terminal"),
      workflowRunId: String(value.workflowRunId || existingReceipt && existingReceipt.workflowRunId || ""),
      runUrl: String(value.runUrl || existingReceipt && existingReceipt.runUrl || ""),
      htmlUrl: String(value.htmlUrl || existingReceipt && existingReceipt.htmlUrl || "")
    };
    if (requestId) {
      // GC는 local intent의 accepted/rejected proof를 잃기 전 durable ledger 의미를 먼저 같은 상태로 수렴시킨다.
      // 기존 dispatch_retry_inflight/uncertain entry가 있어도 remember()로 그대로 두지 않는다.
      if (completed) return promoteKrxDispatchLedgerEntryCompleted(requestId, String(value.hash || ""), info);
      if (dispatchRejected) return setKrxDispatchLedgerEntryState(requestId, String(value.hash || ""), info);
      return rememberKrxDispatchLedgerEntryState(requestId, String(value.hash || ""), info);
    }
    // v14 이전 intent는 raw requestId가 없지만 direct-property suffix가 SHA-256(requestId)의 앞 128bit다.
    // 이 hash identity를 GitHub ledger에 그대로 남겨 receipt GC 뒤에도 같은 raw requestId가 재사용되지 않게 한다.
    if (/^[0-9a-f]{32}$/i.test(legacyIdentityHash)) {
      if (completed || dispatchRejected) return setLegacyKrxDispatchLedgerEntryState(legacyIdentityHash, String(value.hash || ""), info);
      return rememberLegacyKrxDispatchLedgerEntryState(legacyIdentityHash, String(value.hash || ""), info);
    }
    return { stored: false, status: "", match: null };
  }
  return { stored: false, status: "", match: null };
}

function terminalIntentReceiptDescriptorForDurableState(descriptor, durableState) {
  if (!descriptor || !durableState || durableState.stored !== true) return descriptor;
  const status = String(durableState.status || "");
  const match = durableState.match || {};
  const next = {
    prefix: String(descriptor.prefix || ""),
    key: String(descriptor.key || ""),
    value: Object.assign({}, descriptor.value || {})
  };
  if (next.prefix === "PENSION_REQ_R_" && status === "completed") {
    next.value.terminalStale = false;
    next.value.reason = "receipt_recovered";
  } else if (next.prefix === "PENSION_BATCH_R_" && status === "completed") {
    next.value.terminalStale = false;
    next.value.reason = String(match.reason || "receipt_recovered");
    next.value.commitSha = String(match.commitSha || next.value.commitSha || "");
  } else if (next.prefix === "KRX_DISPATCH_R_" && status === "completed") {
    next.value.terminalUncertain = false;
    next.value.reason = String(match.reason || "receipt_recovered");
    next.value.workflowRunId = String(match.workflowRunId || next.value.workflowRunId || "");
    next.value.runUrl = String(match.runUrl || next.value.runUrl || "");
    next.value.htmlUrl = String(match.htmlUrl || next.value.htmlUrl || "");
  }
  return next;
}

function writeScriptPropertyExactWithReadback(props, key, raw, rethrowFailure) {
  if (!props || !key) return false;
  const expected = String(raw == null ? "" : raw);
  let writeError = null;
  try {
    props.setProperty(key, expected);
    return true;
  } catch (err) {
    writeError = err;
  }
  try { if (String(props.getProperty(key) || "") === expected) return true; } catch (_) {}
  if (rethrowFailure && writeError) throw writeError;
  return false;
}

function deleteScriptPropertyWithReadback(props, key) {
  if (!props || !key) return false;
  try {
    if (typeof props.deleteProperty === "function") props.deleteProperty(key);
    else props.setProperty(key, "");
    return true;
  } catch (_) {
    try { return !String(props.getProperty(key) || ""); } catch (_) { return false; }
  }
}

function writeTerminalIntentReceipt(props, descriptor) {
  if (!props || !descriptor) return false;
  const prefix = String(descriptor.prefix || "");
  const key = String(descriptor.key || "");
  const raw = JSON.stringify(descriptor.value || {});
  if (!prefix || !key || utf8ByteLength(raw) > PENSION_PROPERTY_VALUE_BUDGET_BYTES) return false;
  try {
    let all = props.getProperties() || {};
    if (Object.prototype.hasOwnProperty.call(all, key)) {
      const existing = parsePensionDirectProperty(all[key]);
      // 성공 receipt를 terminal stale/uncertain receipt로 덮어쓰지 않는다.
      // 같은 identity/hash의 기존 receipt면 그대로 보존하고 intent만 정리할 수 있다.
      return terminalIntentReceiptCompatible(existing, descriptor);
    }
    if (!Object.prototype.hasOwnProperty.call(all, key)) {
      const limit = Number(DIRECT_REQUEST_PROPERTY_LIMITS[prefix] || 0);
      if (limit) {
        const keys = Object.keys(all).filter(function(candidateKey) { return candidateKey.indexOf(prefix) === 0; });
        if (keys.length >= limit) {
          const required = keys.length - limit + 1;
          const removable = keys.map(function(candidateKey) {
            return { key: candidateKey, savedAtMs: directRequestPropertySavedAtMs(all[candidateKey]) };
          }).filter(function(entry) {
            return !directRequestReceiptHasPairedActiveIntent(all, prefix, entry.key);
          }).sort(function(a, b) {
            return a.savedAtMs - b.savedAtMs || String(a.key).localeCompare(String(b.key));
          });
          if (removable.length < required) return false;
          removable.slice(0, required).forEach(function(entry) {
            if (deleteScriptPropertyWithReadback(props, entry.key)) delete all[entry.key];
          });
          const remaining = Object.keys(props.getProperties() || {}).filter(function(candidateKey) { return candidateKey.indexOf(prefix) === 0; }).length;
          if (remaining >= limit) return false;
        }
      }
    }
    return writeScriptPropertyExactWithReadback(props, key, raw, false);
  } catch (_) {
    try { return String(props.getProperty(key) || "") === raw; } catch (_) { return false; }
  }
}

function terminalizeActiveIntentProperty(props, prefix, entryKey, raw) {
  const intent = parsePensionDirectProperty(raw);
  const descriptor = terminalIntentReceiptDescriptor(prefix, intent, entryKey);
  if (!descriptor) return false;
  const existingReceipt = parsePensionDirectProperty(props.getProperty(descriptor.key));
  if (existingReceipt && !terminalIntentReceiptCompatible(existingReceipt, descriptor)) return false;

  // active intent를 제거하기 전에 GitHub durable identity/tombstone을 먼저 확보한다.
  // durable ledger가 이미 completed를 증명하면 stale receipt를 만들지 않고 completed receipt로 복구한다.
  let durableState = { stored: false, status: "", match: null };
  try { durableState = persistTerminalIntentDurableIdentity(prefix, intent, entryKey, existingReceipt) || durableState; } catch (_) {}
  if (durableState.stored !== true) return false;
  if (prefix === "KRX_DISPATCH_I_" && String(durableState.status || "") === "rejected_retryable") {
    return deleteScriptPropertyWithReadback(props, entryKey);
  }
  if ((prefix === "PENSION_REQ_I_" || prefix === "PENSION_BATCH_I_") && intent && intent.terminalPending === true && String(durableState.status || "") === "terminal_stale") {
    try { rollbackPensionMutationEpoch(Number(intent.mutationEpoch || 0)); } catch (_) {}
  }
  const receiptDescriptor = terminalIntentReceiptDescriptorForDurableState(descriptor, durableState);
  if (!existingReceipt && !writeTerminalIntentReceipt(props, receiptDescriptor)) return false;
  return deleteScriptPropertyWithReadback(props, entryKey);
}

function directRequestReceiptHasPairedActiveIntent(all, prefix, key) {
  if (String(prefix || "") !== "KRX_DISPATCH_R_") return false;
  const receiptKey = String(key || "");
  if (receiptKey.indexOf("KRX_DISPATCH_R_") !== 0) return false;
  const suffix = receiptKey.slice("KRX_DISPATCH_R_".length);
  return !!suffix && Object.prototype.hasOwnProperty.call(all || {}, "KRX_DISPATCH_I_" + suffix);
}

function consumeDirectRequestTerminalizeAttempt(budget) {
  if (!budget || Number(budget.remaining || 0) <= 0) return false;
  budget.remaining = Math.max(0, Number(budget.remaining || 0) - 1);
  return true;
}

function oldestActiveIntentEntry(props, prefix) {
  const all = props && typeof props.getProperties === "function" ? (props.getProperties() || {}) : {};
  const entries = Object.keys(all).filter(function(key) {
    return key.indexOf(prefix) === 0 && !directRequestActiveIntentProtected(key);
  }).map(function(key) {
    return { key: key, raw: all[key], savedAtMs: directRequestPropertySavedAtMs(all[key]) };
  }).sort(function(a, b) {
    return a.savedAtMs - b.savedAtMs || String(a.key).localeCompare(String(b.key));
  });
  return entries.length ? entries[0] : null;
}

function terminalizeOldestActiveIntentForSlot(props, prefix, budget) {
  if (!DIRECT_REQUEST_ACTIVE_INTENT_PREFIXES[prefix]) return false;
  const oldest = oldestActiveIntentEntry(props, prefix);
  if (!oldest || !consumeDirectRequestTerminalizeAttempt(budget)) return false;
  return terminalizeActiveIntentProperty(props, prefix, oldest.key, oldest.raw);
}

function pruneDirectRequestProperties(props, prefix, terminalizeBudget) {
  const limit = Number(DIRECT_REQUEST_PROPERTY_LIMITS[prefix] || 0);
  if (!limit || !props || typeof props.getProperties !== "function") return;

  // active intent는 그대로 삭제하지 않는다. 24시간 이상 응답이 없는 intent는
  // foreground 요청마다 소수만 점진적으로 durable terminal 상태로 승격한다.
  if (DIRECT_REQUEST_ACTIVE_INTENT_PREFIXES[prefix]) {
    try {
      const now = Date.now();
      const all = props.getProperties() || {};
      const budget = terminalizeBudget || { remaining: ACTIVE_INTENT_BACKGROUND_TERMINALIZE_LIMIT };
      const expired = Object.keys(all).filter(function(key) {
        if (key.indexOf(prefix) !== 0 || directRequestActiveIntentProtected(key)) return false;
        const savedAtMs = directRequestPropertySavedAtMs(all[key]);
        return savedAtMs > 0 && now - savedAtMs > ACTIVE_INTENT_TERMINALIZE_MS;
      }).map(function(key) {
        return { key: key, raw: all[key], savedAtMs: directRequestPropertySavedAtMs(all[key]) };
      }).sort(function(a, b) {
        return a.savedAtMs - b.savedAtMs || String(a.key).localeCompare(String(b.key));
      });
      for (let index = 0; index < expired.length && Number(budget.remaining || 0) > 0; index += 1) {
        if (!consumeDirectRequestTerminalizeAttempt(budget)) break;
        terminalizeActiveIntentProperty(props, prefix, expired[index].key, expired[index].raw);
      }
    } catch (_) {}
    return;
  }

  try {
    const now = Date.now();
    const retentionMs = directRequestPropertyRetentionMs(prefix);
    let all = props.getProperties() || {};
    let entries = Object.keys(all).filter(function(key) {
      return key.indexOf(prefix) === 0;
    }).map(function(key) {
      return { key: key, savedAtMs: directRequestPropertySavedAtMs(all[key]) };
    });

    // TTL은 paired active KRX intent의 성공 receipt만 예외로 보존한다.
    entries.forEach(function(entry) {
      const tooOld = entry.savedAtMs > 0 && now - entry.savedAtMs > retentionMs;
      if (!tooOld || directRequestReceiptHasPairedActiveIntent(all, prefix, entry.key)) return;
      if (deleteScriptPropertyWithReadback(props, entry.key)) delete all[entry.key];
    });

    // protected entry가 오래된 순번에 끼어 있어도 총 prefix cap은 정확히 유지되도록
    // 남은 unprotected entry 중 가장 오래된 것부터 필요한 개수만 제거한다.
    all = props.getProperties() || {};
    entries = Object.keys(all).filter(function(key) {
      return key.indexOf(prefix) === 0;
    }).map(function(key) {
      return { key: key, savedAtMs: directRequestPropertySavedAtMs(all[key]) };
    });
    const overflow = Math.max(0, entries.length - limit);
    if (overflow > 0) {
      const removable = entries.filter(function(entry) {
        return !directRequestReceiptHasPairedActiveIntent(all, prefix, entry.key);
      }).sort(function(a, b) {
        return a.savedAtMs - b.savedAtMs || String(a.key).localeCompare(String(b.key));
      });
      removable.slice(0, overflow).forEach(function(entry) {
        deleteScriptPropertyWithReadback(props, entry.key);
      });
    }
  } catch (_) {
    // GC 실패는 현재 mutation 성공 여부를 뒤집지 않는다.
  }
}

// direct property write 전에 prefix별 GC + 전체 byte budget GC를 수행한다.
// 활성 intent는 causal/idempotency 근거이므로 global budget 확보를 위해 임의 삭제하지 않는다.
// Pension/KRX는 GitHub snapshot을 읽은 뒤 maintenance terminalization commit이 생기면
// 자기 요청의 base/dependency를 스스로 흔들 수 있다. active intent maintenance를 snapshot 전에
// 끝내고 현재 retry intent는 보호한 뒤, 이후 동일 doPost에서는 active terminalization을 동결한다.
function prepareDirectRequestMaintenanceBoundary(activePrefix, activeKey) {
  const context = directRequestMaintenanceContext();
  if (!context || context.snapshotBoundaryPrepared) return;
  const props = PropertiesService.getScriptProperties();
  protectDirectRequestActiveIntentKey(activeKey);
  const budget = directRequestTerminalizeBudget();

  let all = props.getProperties() || {};
  const limit = Number(DIRECT_REQUEST_PROPERTY_LIMITS[activePrefix] || 0);
  const exists = !!(activeKey && Object.prototype.hasOwnProperty.call(all, activeKey));
  if (activeKey && !exists && limit) {
    const count = Object.keys(all).filter(function(candidateKey) { return candidateKey.indexOf(activePrefix) === 0; }).length;
    if (count >= limit && !terminalizeOldestActiveIntentForSlot(props, activePrefix, budget)) {
      throw new Error("활성 요청 보존 한도에 도달했고 GitHub snapshot 전에 기존 intent를 안전하게 terminal 상태로 승격하지 못했습니다. 새 요청을 시작하지 않았습니다.");
    }
  }

  Object.keys(DIRECT_REQUEST_PROPERTY_LIMITS).forEach(function(prefix) {
    pruneDirectRequestProperties(props, prefix, budget);
  });

  all = props.getProperties() || {};
  if (activeKey && !exists && limit) {
    const countAfter = Object.keys(all).filter(function(candidateKey) { return candidateKey.indexOf(activePrefix) === 0; }).length;
    if (countAfter >= limit && !terminalizeOldestActiveIntentForSlot(props, activePrefix, budget)) {
      throw new Error("활성 요청 보존 한도에 도달했고 현재 요청의 cleanup budget 안에서 신규 slot을 안전하게 확보하지 못했습니다. 새 요청을 시작하지 않았습니다.");
    }
  }

  context.snapshotBoundaryPrepared = true;
  context.activeTerminalizationFrozen = true;
  budget.remaining = 0;
}

function prepareDirectRequestPropertyWrite(props, prefix, key, raw) {
  if (!props || typeof props.getProperties !== "function") return;
  if (utf8ByteLength(raw) > PENSION_PROPERTY_VALUE_BUDGET_BYTES) {
    throw new Error(key + " 저장 크기가 Script Properties 안전 예산을 초과했습니다.");
  }

  const terminalizeBudget = directRequestTerminalizeBudget();

  // 새 active intent가 이미 cap에 걸린 경우, unrelated background cleanup이 budget을 먼저 소모하기 전에
  // 해당 prefix의 가장 오래된 1건을 우선 terminalize해 신규 요청 slot을 확보한다.
  let all = props.getProperties() || {};
  let existing = Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null;
  const prefixLimit = Number(DIRECT_REQUEST_PROPERTY_LIMITS[prefix] || 0);
  if (existing == null && prefixLimit && DIRECT_REQUEST_ACTIVE_INTENT_PREFIXES[prefix]) {
    const activeCount = Object.keys(all).filter(function(candidateKey) { return candidateKey.indexOf(prefix) === 0; }).length;
    if (activeCount >= prefixLimit) {
      if (!terminalizeOldestActiveIntentForSlot(props, prefix, terminalizeBudget)) {
        throw new Error("활성 요청 보존 한도에 도달했고 현재 요청의 cleanup budget 안에서 기존 intent를 terminal 상태로 안전하게 승격하지 못했습니다. 새 요청을 시작하지 않았습니다.");
      }
    }
  }

  Object.keys(DIRECT_REQUEST_PROPERTY_LIMITS).forEach(function(itemPrefix) {
    pruneDirectRequestProperties(props, itemPrefix, terminalizeBudget);
  });

  all = props.getProperties() || {};
  existing = Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null;
  if (existing == null && prefixLimit) {
    const prefixKeys = Object.keys(all).filter(function(candidateKey) {
      return candidateKey.indexOf(prefix) === 0;
    });
    if (DIRECT_REQUEST_ACTIVE_INTENT_PREFIXES[prefix]) {
      if (prefixKeys.length >= prefixLimit) {
        if (!terminalizeOldestActiveIntentForSlot(props, prefix, terminalizeBudget)) {
          throw new Error("활성 요청 보존 한도에 도달했고 현재 요청의 cleanup budget 안에서 기존 intent를 terminal 상태로 안전하게 승격하지 못했습니다. 새 요청을 시작하지 않았습니다.");
        }
        all = props.getProperties() || {};
      }
    } else if (prefixKeys.length >= prefixLimit) {
      // 새 receipt/confirmation/marker가 들어갈 자리를 확보하되, active KRX intent와 짝을 이루는
      // dispatch 성공 receipt는 durable ledger 복구 전까지 cap/TTL GC로 삭제하지 않는다.
      const removable = prefixKeys.map(function(candidateKey) {
        return { key: candidateKey, savedAtMs: directRequestPropertySavedAtMs(all[candidateKey]) };
      }).filter(function(entry) {
        return !directRequestReceiptHasPairedActiveIntent(all, prefix, entry.key);
      }).sort(function(a, b) {
        return a.savedAtMs - b.savedAtMs || String(a.key).localeCompare(String(b.key));
      });
      const required = prefixKeys.length - prefixLimit + 1;
      if (removable.length < required) {
        throw new Error("보존 중인 KRX dispatch 성공 증거 때문에 Script Properties prefix 한도를 안전하게 확보하지 못했습니다.");
      }
      removable.slice(0, required).forEach(function(entry) {
        if (deleteScriptPropertyWithReadback(props, entry.key)) delete all[entry.key];
      });
    }
  }

  all = props.getProperties() || {};
  existing = Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null;
  let projected = scriptPropertiesUtf8Bytes(all)
    - (existing == null ? 0 : utf8ByteLength(key) + utf8ByteLength(existing))
    + utf8ByteLength(key) + utf8ByteLength(raw);
  if (projected <= DIRECT_REQUEST_GLOBAL_BUDGET_BYTES) return;

  const prefixPriority = { PENSION_CONFIRM_: 0, PENSION_REQ_R_: 1, PENSION_BATCH_R_: 1, KRX_DISPATCH_R_: 1, KRX_OP_: 2 };
  const candidates = Object.keys(all).filter(function(candidateKey) {
    if (candidateKey === key) return false;
    const candidatePrefix = directRequestPropertyPrefixForKey(candidateKey);
    if (!candidatePrefix || DIRECT_REQUEST_ACTIVE_INTENT_PREFIXES[candidatePrefix]) return false;
    if (directRequestReceiptHasPairedActiveIntent(all, candidatePrefix, candidateKey)) return false;
    return true;
  }).map(function(candidateKey) {
    const candidatePrefix = directRequestPropertyPrefixForKey(candidateKey);
    return {
      key: candidateKey,
      prefix: candidatePrefix,
      priority: Object.prototype.hasOwnProperty.call(prefixPriority, candidatePrefix) ? prefixPriority[candidatePrefix] : 9,
      savedAtMs: directRequestPropertySavedAtMs(all[candidateKey])
    };
  }).sort(function(a, b) {
    return a.priority - b.priority || a.savedAtMs - b.savedAtMs || String(a.key).localeCompare(String(b.key));
  });

  for (let index = 0; index < candidates.length && projected > DIRECT_REQUEST_GLOBAL_BUDGET_BYTES; index += 1) {
    const candidate = candidates[index];
    const value = all[candidate.key];
    if (deleteScriptPropertyWithReadback(props, candidate.key)) {
      projected -= utf8ByteLength(candidate.key) + utf8ByteLength(value);
      delete all[candidate.key];
    }
  }

  if (projected > DIRECT_REQUEST_GLOBAL_BUDGET_BYTES) {
    throw new Error("Script Properties 내부 저장 예산이 부족합니다. 활성 요청과 KRX dispatch 성공 증거를 보존하기 위해 새 요청을 시작하지 않았습니다.");
  }
}

/* --- 01D. Direct Property Write / Batch Fast-Path ------------------------- */

function setDirectRequestProperty(props, prefix, key, value) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  prepareDirectRequestPropertyWrite(props, prefix, key, raw);
  // 실제 반영 후 응답 유실이면 exact read-back을 성공으로 인정하고, definite failure만 원래 오류를 다시 던진다.
  writeScriptPropertyExactWithReadback(props, key, raw, true);
}

// KRX foreground 요청은 snapshot boundary에서 direct-property GC를 이미 마친 뒤 ScriptLock 안에서 실행된다.
// 정상 여유 상태에서는 여러 local evidence를 Properties.setProperties 1회로 저장해 개별 setProperty 왕복을 줄인다.
// prefix/global budget이 부족하면 기존 개별 write 경로로 즉시 fallback하여 GC/보존 계약을 그대로 유지한다.
function tryWriteDirectRequestPropertiesBatchFast(entries) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) return { used: false, storedByKey: {}, previousByKey: {}, rawByKey: {} };
  const context = directRequestMaintenanceContext();
  if (!context || context.snapshotBoundaryPrepared !== true || context.activeTerminalizationFrozen !== true) {
    return { used: false, storedByKey: {}, previousByKey: {}, rawByKey: {} };
  }

  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties() || {};
  const rawByKey = {};
  const previousByKey = {};
  const prefixCounts = {};
  Object.keys(DIRECT_REQUEST_PROPERTY_LIMITS).forEach(function(prefix) {
    prefixCounts[prefix] = Object.keys(all).filter(function(key) { return key.indexOf(prefix) === 0; }).length;
  });

  let projected = scriptPropertiesUtf8Bytes(all);
  for (let index = 0; index < list.length; index += 1) {
    const entry = list[index] || {};
    const prefix = String(entry.prefix || "");
    const key = String(entry.key || "");
    if (!prefix || !key || !Object.prototype.hasOwnProperty.call(DIRECT_REQUEST_PROPERTY_LIMITS, prefix)) {
      return { used: false, storedByKey: {}, previousByKey: {}, rawByKey: {} };
    }
    if (Object.prototype.hasOwnProperty.call(rawByKey, key)) {
      return { used: false, storedByKey: {}, previousByKey: {}, rawByKey: {} };
    }
    const raw = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
    if (utf8ByteLength(raw) > PENSION_PROPERTY_VALUE_BUDGET_BYTES) {
      return { used: false, storedByKey: {}, previousByKey: {}, rawByKey: {} };
    }
    const previous = Object.prototype.hasOwnProperty.call(all, key) ? String(all[key]) : null;
    const limit = Number(DIRECT_REQUEST_PROPERTY_LIMITS[prefix] || 0);
    if (previous == null && limit && Number(prefixCounts[prefix] || 0) >= limit) {
      return { used: false, storedByKey: {}, previousByKey: {}, rawByKey: {} };
    }
    if (previous == null) prefixCounts[prefix] = Number(prefixCounts[prefix] || 0) + 1;
    projected -= previous == null ? 0 : utf8ByteLength(key) + utf8ByteLength(previous);
    projected += utf8ByteLength(key) + utf8ByteLength(raw);
    if (projected > DIRECT_REQUEST_GLOBAL_BUDGET_BYTES) {
      return { used: false, storedByKey: {}, previousByKey: {}, rawByKey: {} };
    }
    rawByKey[key] = raw;
    previousByKey[key] = previous;
  }

  const storedByKey = {};
  let writeError = null;
  try {
    if (typeof props.setProperties === "function") {
      props.setProperties(rawByKey, false);
    } else {
      Object.keys(rawByKey).forEach(function(key) { props.setProperty(key, rawByKey[key]); });
    }
    Object.keys(rawByKey).forEach(function(key) { storedByKey[key] = true; });
    return { used: true, storedByKey: storedByKey, previousByKey: previousByKey, rawByKey: rawByKey, error: null };
  } catch (err) {
    writeError = err;
  }

  try {
    const observed = props.getProperties() || {};
    Object.keys(rawByKey).forEach(function(key) {
      storedByKey[key] = String(observed[key] == null ? "" : observed[key]) === String(rawByKey[key]);
    });
  } catch (_) {
    Object.keys(rawByKey).forEach(function(key) { storedByKey[key] = false; });
  }
  return { used: true, storedByKey: storedByKey, previousByKey: previousByKey, rawByKey: rawByKey, error: writeError };
}

// maintenance boundary 이후 정상 여유 상태의 단일 direct property는 full GC를 다시 돌리지 않고
// 기존 batch-fast 검증/정확 readback 계약을 재사용한다. 사용 불가 시 호출부가 기존 slow path로 fallback한다.
function trySetDirectRequestPropertyFastAfterBoundary(prefix, key, value) {
  const batch = tryWriteDirectRequestPropertiesBatchFast([{ prefix: prefix, key: key, value: value }]);
  if (!batch || batch.used !== true) return false;
  if (batch.storedByKey && batch.storedByKey[key] === true) return true;
  rollbackDirectRequestPropertiesBatch(batch);
  if (batch.error) throw batch.error;
  return false;
}

// pre-dispatch batch가 부분 반영된 경우 POST를 보내기 전에 해당 key를 이전 값으로 되돌린다.
// 정상 성공 경로에서는 호출되지 않으며, rollback 자체도 exact read-back으로 definite 상태만 인정한다.
function rollbackDirectRequestPropertiesBatch(batch) {
  if (!batch || batch.used !== true) return;
  const props = PropertiesService.getScriptProperties();
  const previousByKey = batch.previousByKey || {};
  const rawByKey = batch.rawByKey || {};
  Object.keys(rawByKey).forEach(function(key) {
    let observed = null;
    try { observed = props.getProperty(key); } catch (_) { return; }
    if (String(observed == null ? "" : observed) !== String(rawByKey[key])) return;
    const previous = Object.prototype.hasOwnProperty.call(previousByKey, key) ? previousByKey[key] : null;
    if (previous == null) {
      deleteScriptPropertyWithReadback(props, key);
    } else {
      writeScriptPropertyExactWithReadback(props, key, String(previous), false);
    }
  });
}

/* =========================================================
 * 02. 인증 / 관리자 PIN
 * ========================================================= */

// 공개 GAS Web App은 요청자 IP별 신뢰 가능한 rate-limit 수단을 제공하지 않으므로,
// 운영 계약은 Dashboard와 동일한 숫자 6자리 PIN이다.
// 전역 실패 상태/lockout은 두지 않아 제3자의 오입력만으로 정상 관리자를 차단하지 않는다.
// 인증 비교는 digest 기반 constant-time 비교를 유지한다.
const ADMIN_PIN_LENGTH = 6;

function assertAdminPinStrength(secret) {
  const value = String(secret || "");
  if (value.length !== ADMIN_PIN_LENGTH || !/^\d+$/.test(value)) {
    throw new Error("ADMIN_PIN 설정이 올바르지 않습니다. 숫자 6자리 관리자 PIN으로 설정해주세요.");
  }
}

function constantTimeSecretEquals(left, right) {
  const leftDigest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(left || ""),
    Utilities.Charset.UTF_8
  );
  const rightDigest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(right || ""),
    Utilities.Charset.UTF_8
  );
  let diff = 0;
  for (let index = 0; index < leftDigest.length; index += 1) {
    diff |= (leftDigest[index] & 0xff) ^ (rightDigest[index] & 0xff);
  }
  return diff === 0;
}

function assertAdminPin(body) {
  const expectedPin = String(getProp("ADMIN_PIN")).trim();
  const pin = String(body.pin || "").trim();
  assertAdminPinStrength(expectedPin);
  if (!constantTimeSecretEquals(pin, expectedPin)) {
    throw new Error("PIN이 올바르지 않습니다.");
  }
}

/* =========================================================
 * 03. 날짜 / KST 공통 Helper
 * ========================================================= */

// YYYY-MM-DD 형식과 실제 달력 날짜 유효성을 검증한다.
function isValidDateText(date) {
  const text = String(date || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

// 기업적립금 기본 메모를 생성한다.
function makeDefaultMemo(date) {
  return date.slice(0, 4) + "년 " + Number(date.slice(5, 7)) + "월 기업적립금";
}

// 현재 시각을 KST ISO 형태 문자열로 반환한다.
function nowKSTText() {
  return Utilities.formatDate(
    new Date(),
    "Asia/Seoul",
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );
}

// 현재 KST 날짜·요일·장중/장전/장후 상태를 계산한다.
function nowKSTDateTimeInfo() {
  const now = new Date();
  const dateText = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd");
  const hour = Number(Utilities.formatDate(now, "Asia/Seoul", "H"));
  const minute = Number(Utilities.formatDate(now, "Asia/Seoul", "m"));
  const day = Number(Utilities.formatDate(now, "Asia/Seoul", "u")); // 1=월, 7=일
  const minutes = hour * 60 + minute;

  return {
    dateText: dateText,
    day: day,
    minutes: minutes,
    isWeekday: day >= 1 && day <= 5,
    isBeforeOpen: day >= 1 && day <= 5 && minutes < 9 * 60,
    isMarketTime: day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes < 15 * 60 + 30,
    isAfterClose: day >= 1 && day <= 5 && minutes >= 15 * 60 + 30
  };
}

// KST 기준 날짜 문자열에 일수를 더하거나 뺀다.
function addDaysText(dateText, days) {
  const d = new Date(dateText + "T12:00:00+09:00");
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM-dd");
}

// 주말을 고려해 직전 영업일 후보 날짜를 계산한다.
function previousBusinessDateText(dateText, day) {
  // 1=월, 6=토, 7=일 기준. 한국 휴장일은 pykrx backfill 단계에서 최종 판단.
  if (day === 1) return addDaysText(dateText, -3); // 월요일 → 직전 금요일
  if (day === 7) return addDaysText(dateText, -2); // 일요일 → 직전 금요일
  return addDaysText(dateText, -1); // 화~토 → 전일
}

/* =========================================================
 * 04. GitHub REST / 병렬 I/O / JSON Commit
 * ========================================================= */

/* --- 04A. GitHub Transport / 병렬 GET --------------------------------------- */

// GitHub REST API를 공통 호출하고 HTTP 오류를 표준화한다.
function githubRequest(method, path, payload, accept) {
  const url =
    "https://api.github.com/repos/" +
    getProp("GITHUB_OWNER") +
    "/" +
    getProp("GITHUB_REPO") +
    path;

  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + getProp("GITHUB_TOKEN"),
      Accept: String(accept || "application/vnd.github+json"),
      "X-GitHub-Api-Version": "2022-11-28"
    }
  };

  if (payload) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  const text = res.getContentText();

  if (code === 409) {
    const err = new Error("다른 저장이 먼저 반영되었습니다. 새로고침 후 다시 시도하세요.");
    err.githubHttpStatus = code;
    throw err;
  }

  if (code < 200 || code >= 300) {
    const err = new Error("GitHub API error " + code + ": " + text);
    err.githubHttpStatus = code;
    throw err;
  }

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return { raw: text };
  }
}

// 독립적인 GitHub GET 여러 건은 UrlFetchApp.fetchAll로 병렬 실행해 KRX 상태 조회의 순차 network wait를 줄인다.
function githubRequestManyGet(paths) {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
  if (!list.length) return [];

  const baseUrl =
    "https://api.github.com/repos/" +
    getProp("GITHUB_OWNER") +
    "/" +
    getProp("GITHUB_REPO");
  const headers = {
    Authorization: "Bearer " + getProp("GITHUB_TOKEN"),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const responses = UrlFetchApp.fetchAll(list.map(function(path) {
    return {
      url: baseUrl + String(path || ""),
      method: "get",
      muteHttpExceptions: true,
      headers: headers
    };
  }));

  return responses.map(function(res) {
    const code = res.getResponseCode();
    const text = res.getContentText();
    if (code === 409) {
      const err = new Error("다른 저장이 먼저 반영되었습니다. 새로고침 후 다시 시도하세요.");
      err.githubHttpStatus = code;
      throw err;
    }
    if (code < 200 || code >= 300) {
      const err = new Error("GitHub API error " + code + ": " + text);
      err.githubHttpStatus = code;
      throw err;
    }
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_) {
      return { raw: text };
    }
  });
}

// KRX preflight처럼 서로 성격이 다른 GitHub GET을 한 fetchAll에 묶을 때는
// 각 응답의 성공/404/오류를 개별 보존해 durable 조회 실패와 active-run 조회 실패를 구분한다.
function githubRequestManyGetSettled(requests) {
  const list = Array.isArray(requests) ? requests.filter(function(item) { return item && item.path; }) : [];
  if (!list.length) return [];

  const baseUrl =
    "https://api.github.com/repos/" +
    getProp("GITHUB_OWNER") +
    "/" +
    getProp("GITHUB_REPO");
  const headers = {
    Authorization: "Bearer " + getProp("GITHUB_TOKEN"),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  let responses = null;
  try {
    responses = UrlFetchApp.fetchAll(list.map(function(item) {
      return {
        url: baseUrl + String(item.path || ""),
        method: "get",
        muteHttpExceptions: true,
        headers: headers
      };
    }));
  } catch (err) {
    return list.map(function(item) {
      return { key: String(item.key || ""), ok: false, status: 0, data: null, error: err };
    });
  }

  return responses.map(function(res, index) {
    const item = list[index] || {};
    const code = res.getResponseCode();
    const text = res.getContentText();
    if (code === 404 && item.allow404 === true) {
      return { key: String(item.key || ""), ok: true, status: 404, data: null, error: null };
    }
    if (code < 200 || code >= 300) {
      const err = new Error(code === 409
        ? "다른 저장이 먼저 반영되었습니다. 새로고침 후 다시 시도하세요."
        : ("GitHub API error " + code + ": " + text));
      err.githubHttpStatus = code;
      return { key: String(item.key || ""), ok: false, status: code, data: null, error: err };
    }
    if (!text) return { key: String(item.key || ""), ok: true, status: code, data: {}, error: null };
    try {
      return { key: String(item.key || ""), ok: true, status: code, data: JSON.parse(text), error: null };
    } catch (_) {
      return { key: String(item.key || ""), ok: true, status: code, data: { raw: text }, error: null };
    }
  });
}

/* --- 04B. Contents API Decode / JSON Read --------------------------------- */

function githubContentsApiPath(filePath, ref) {
  const path = String(filePath || "").split("/").map(encodeURIComponent).join("/");
  return "/contents/" + path + "?ref=" + encodeURIComponent(String(ref || getProp("GITHUB_BRANCH")));
}

function decodeGithubJsonContentsResult(result, filePath, ref, fallbackData, allowMissing) {
  if (!result) {
    if (allowMissing === true) return { sha: "", data: fallbackData, missing: true };
    throw new Error("GitHub JSON 내용을 읽지 못했습니다: " + filePath);
  }

  let encoded = String(result.content || "");
  const needsBlobFallback = !encoded || String(result.encoding || "").toLowerCase() === "none" || Number(result.size || 0) > 1024 * 1024;
  if (needsBlobFallback) {
    if (allowMissing === true) return readGithubJsonOptional(filePath, ref, fallbackData);
    const current = readGithubJson(filePath, ref);
    return { sha: current.sha, data: current.data, missing: false };
  }

  const decoded = Utilities.newBlob(
    Utilities.base64Decode(encoded.replace(/\n/g, ""))
  ).getDataAsString("UTF-8");
  return { sha: String(result.sha || ""), data: JSON.parse(decoded), missing: false };
}


// 현재 branch 또는 지정 ref에서 GitHub JSON을 읽는다.
function readGithubJson(filePath, ref) {
  const resolvedRef = String(ref || getProp("GITHUB_BRANCH"));
  const path = filePath.split("/").map(encodeURIComponent).join("/");

  const result = githubRequest(
    "get",
    "/contents/" + path + "?ref=" + encodeURIComponent(resolvedRef),
    null,
    "application/vnd.github.object+json"
  );

  // GitHub Contents API는 1MB 초과 파일에서 content를 비우고 encoding=none으로
  // 돌려줄 수 있다. durable ledger shard가 커져도 읽기 실패하지 않도록 blob API로 fallback한다.
  let encoded = String(result && result.content || "");
  const needsBlobFallback = !encoded || String(result && result.encoding || "").toLowerCase() === "none" || Number(result && result.size || 0) > 1024 * 1024;
  if (needsBlobFallback) {
    const sha = String(result && result.sha || "");
    if (!sha) throw new Error("GitHub JSON blob SHA를 확인하지 못했습니다: " + filePath);
    const blob = githubRequest("get", "/git/blobs/" + encodeURIComponent(sha));
    encoded = String(blob && blob.content || "");
    if (!encoded || String(blob && blob.encoding || "base64").toLowerCase() !== "base64") {
      throw new Error("GitHub JSON blob 내용을 읽지 못했습니다: " + filePath);
    }
  }

  const decoded = Utilities.newBlob(
    Utilities.base64Decode(encoded.replace(/\n/g, ""))
  ).getDataAsString("UTF-8");

  return {
    sha: result.sha,
    data: JSON.parse(decoded)
  };
}

// ledger shard처럼 아직 생성되지 않은 JSON은 404를 빈 데이터로 취급한다.
function readGithubJsonOptional(filePath, ref, fallbackData) {
  try {
    const current = readGithubJson(filePath, ref);
    return { sha: current.sha, data: current.data, missing: false };
  } catch (err) {
    if (Number(err && err.githubHttpStatus || 0) === 404) {
      return { sha: "", data: fallbackData, missing: true };
    }
    throw err;
  }
}

/* --- 04C. 단일 JSON Contents CAS -------------------------------------------- */

// KRX durable ledger처럼 단일 JSON 파일만 바꾸는 metadata commit은 Contents API의 blob SHA CAS를 사용한다.
// 같은 shard가 동시에 바뀌면 409/422 또는 응답 유실 후 재조회에서 충돌을 감지하고 최신 shard에 다시 적용한다.
// Pension/Batch처럼 여러 파일을 한 commit에 묶어야 하는 mutation에는 이 fast-path를 사용하지 않는다.
function tryWriteGithubJsonContentsCas(filePath, currentSha, data, message) {
  const branch = getProp("GITHUB_BRANCH");
  const raw = JSON.stringify(data, null, 2) + "\n";
  const payload = {
    message: String(message || "Update JSON"),
    content: Utilities.base64Encode(Utilities.newBlob(raw, "application/json").getBytes()),
    branch: branch
  };
  if (String(currentSha || "")) payload.sha = String(currentSha);

  const path = String(filePath || "").split("/").map(encodeURIComponent).join("/");
  try {
    const result = githubRequest("put", "/contents/" + path, payload);
    return {
      stored: true,
      retryable: false,
      commitSha: String(result && result.commit && result.commit.sha || ""),
      contentSha: String(result && result.content && result.content.sha || ""),
      error: null
    };
  } catch (err) {
    const status = Number(err && err.githubHttpStatus || 0);
    // 409/422는 동일 file SHA 경쟁일 수 있고, 5xx/transport error는 write 응답만 유실됐을 수 있다.
    // 호출부가 같은 identity/hash를 최신 shard에서 다시 확인한 뒤에만 재시도한다.
    if (!status || status === 409 || status === 422 || status >= 500) {
      return { stored: false, retryable: true, commitSha: "", contentSha: "", error: err };
    }
    throw err;
  }
}

/* --- 04D. Git Tree Batch Commit / Branch CAS ------------------------------ */

// 현재 branch HEAD commit SHA를 조회한다.
function getGithubBranchHeadSha() {
  const branch = getProp("GITHUB_BRANCH");
  const ref = githubRequest(
    "get",
    "/git/ref/heads/" + branch.split("/").map(encodeURIComponent).join("/")
  );
  return String(ref && ref.object && ref.object.sha || "");
}

// 여러 JSON 변경을 base commit 위의 새 Git tree/commit으로 조립한다.
function createGithubJsonBatchCommit(baseCommitSha, fileChanges, message) {
  const baseCommit = githubRequest("get", "/git/commits/" + encodeURIComponent(baseCommitSha));
  // Git tree API는 entry.content를 직접 받을 수 있으므로 파일마다 /git/blobs POST를 만들지 않는다.
  // 대규모 ledger-shard Batch에서도 content-generating REST 호출 수를 일정하게 유지한다.
  const treeEntries = fileChanges.map(function(change) {
    return {
      path: change.path,
      mode: "100644",
      type: "blob",
      content: JSON.stringify(change.data, null, 2) + "\n"
    };
  });

  const tree = githubRequest("post", "/git/trees", {
    base_tree: baseCommit.tree.sha,
    tree: treeEntries
  });
  return githubRequest("post", "/git/commits", {
    message: message,
    tree: tree.sha,
    parents: [baseCommitSha]
  });
}

// branch HEAD가 baseCommitSha일 때만 새 commit으로 전진시킨다.
function advanceGithubBranchHeadCas(branch, baseCommitSha, commitSha) {
  const latestHead = getGithubBranchHeadSha();
  if (latestHead !== baseCommitSha) {
    throw new Error("다른 저장이 먼저 반영되었습니다. 새로고침 후 다시 시도하세요.");
  }

  try {
    githubRequest(
      "patch",
      "/git/refs/heads/" + branch.split("/").map(encodeURIComponent).join("/"),
      { sha: commitSha, force: false }
    );
  } catch (err) {
    const messageText = String(err && err.message ? err.message : err);
    if (messageText.indexOf("GitHub API error 422") >= 0 || messageText.indexOf("GitHub API error 409") >= 0) {
      throw new Error("다른 저장이 먼저 반영되었습니다. 새로고침 후 다시 시도하세요.");
    }
    throw err;
  }
}

// 여러 JSON 파일을 하나의 Git commit으로 원자적으로 반영한다.
function writeGithubJsonBatch(baseCommitSha, fileChanges, message) {
  if (!fileChanges || !fileChanges.length) {
    throw new Error("반영할 변경 파일이 없습니다.");
  }

  const branch = getProp("GITHUB_BRANCH");
  const commit = createGithubJsonBatchCommit(baseCommitSha, fileChanges, message);
  advanceGithubBranchHeadCas(branch, baseCommitSha, commit.sha);
  return commit;
}

// durable metadata/identity ledger의 CAS write는 충돌 시 최신 branch HEAD를 다시 읽고 재구성한다.
// 호출부는 매 attempt마다 context를 새로 만들며, 이 helper는 write 실패의 재시도/최종 throw 규칙만 공통화한다.
function tryDurableGithubJsonBatchWrite(baseCommitSha, fileChanges, message, attempt) {
  try {
    writeGithubJsonBatch(baseCommitSha, fileChanges, message);
    return true;
  } catch (err) {
    if (Number(attempt) >= DURABLE_GITHUB_CAS_ATTEMPTS - 1) throw err;
    return false;
  }
}

/* =========================================================
 * 05. 퇴직연금 Target / Normalize / ID
 * ========================================================= */

// 요청 target을 허용된 퇴직연금 target으로 검증한다. 잘못된 값은 다른 target으로 fallback하지 않는다.
function getTarget(body) {
  const target = String(body.target || "").trim();
  if (!Object.prototype.hasOwnProperty.call(PENSION_TARGET_META, target)) {
    throw new Error("지원하지 않는 target입니다: " + (target || "(empty)"));
  }
  return target;
}

// 단건 신규 저장의 client-generated ID 형식을 검증한다.
function assertPensionRequestId(id) {
  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(String(id || ""))) {
    throw new Error("요청 ID 형식이 올바르지 않습니다.");
  }
}

// 같은 요청 ID가 이미 저장된 경우 동일 내용의 안전한 재시도인지 확인한다.
function pensionRequestMatchesExisting(existing, target, fields) {
  if (!existing) return false;

  if (target === "contribution") {
    if (String(existing.date || "") !== String(fields.date || "")) return false;
    if (Math.round(Number(existing.amount) || 0) !== Math.round(Number(fields.amount) || 0)) return false;
    return !fields.memo || String(existing.memo || "") === String(fields.memo);
  }

  if (target === "etfTrade") {
    if (String(existing.tradeDate || "") !== String(fields.tradeDate || "")) return false;
    if (String(existing.ticker || "") !== String(fields.ticker || "")) return false;
    if (Number(existing.qty) !== Number(fields.qty)) return false;
    if (Math.round(Number(existing.amount) || 0) !== Math.round(Number(fields.amount) || 0)) return false;
    return !fields.memo || String(existing.memo || "") === String(fields.memo);
  }

  return false;
}

// 이미 성공한 단건 요청의 동일 재시도면 GitHub write 없이 기존 item을 반환한다.
function repeatedPensionRequestResult(items, target, id, fields) {
  if (!id) return null;
  assertPensionRequestId(id);

  const existing = items.find(function(item) {
    return item && String(item.id || "") === String(id);
  });
  if (!existing) return null;

  if (!pensionRequestMatchesExisting(existing, target, fields)) {
    throw new Error("동일한 요청 ID가 다른 저장 내용에 이미 사용되었습니다. 새로고침 후 다시 시도하세요.");
  }

  return {
    ok: true,
    target: target,
    action: "duplicate_ignored",
    duplicate: true,
    item: existing
  };
}

// target별 GitHub JSON 경로를 반환한다.
function getDataPath(target) {
  const meta = PENSION_TARGET_META[target] || PENSION_TARGET_META.contribution;
  return meta.dataPath;
}

// 배열 또는 legacy wrapper JSON을 공통 배열로 변환한다.
// 예상 구조가 아니면 빈 배열로 치환하지 않고 fail-closed하여 다음 저장에서 원본 row가 소실되는 것을 막는다.
function normalizeItems(data, target) {
  if (Array.isArray(data)) {
    return data;
  }

  const meta = PENSION_TARGET_META[target] || PENSION_TARGET_META.contribution;
  if (data && typeof data === "object" && Array.isArray(data[meta.collectionKey])) {
    return data[meta.collectionKey];
  }

  throw new Error("퇴직연금 " + String(target || "unknown") + " JSON 구조가 올바르지 않습니다. 저장을 중단했습니다.");
}

// target별 저장 JSON 형태로 변환한다.
function dataForTarget(items, target) {
  const meta = PENSION_TARGET_META[target] || PENSION_TARGET_META.contribution;
  if (!meta.wrapOnWrite) return items;

  const wrapped = {};
  wrapped[meta.collectionKey] = items;
  return wrapped;
}

// GitHub의 target JSON을 읽고 현재 SHA와 normalize된 item 목록을 함께 반환한다.
function readPensionTarget(target, ref, requestCache) {
  const normalizedTarget = Object.prototype.hasOwnProperty.call(PENSION_TARGET_META, target)
    ? target
    : "contribution";
  const current = readGithubJsonRequestCached(getDataPath(normalizedTarget), ref, requestCache);

  return {
    sha: current.sha,
    data: current.data,
    items: normalizeItemsForTarget(
      normalizeItems(current.data, normalizedTarget),
      normalizedTarget
    )
  };
}

// 저장된 Pension JSON은 normalize 과정에서 row를 조용히 버리거나 0으로 치환하지 않는다.
// 사람이 GitHub JSON을 직접 수정했거나 외부 도구가 비정상 row를 만든 경우 다음 mutation 전에 fail-closed한다.
function isStoredPensionNumericScalar(value, positive, optional) {
  if (value == null) return optional === true;
  if (typeof value === "boolean" || typeof value === "object") return false;
  if (typeof value === "string" && value.trim() === "") return false;
  const number = Number(value);
  return isSafePensionWhole(number, positive === true);
}

function isStoredPensionPositiveNumber(value, optional) {
  if (value == null) return optional === true;
  if (typeof value === "boolean" || typeof value === "object") return false;
  if (typeof value === "string" && value.trim() === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function assertStoredPensionStringField(item, field, target, row, required, allowEmpty) {
  const value = item && item[field];
  if (value == null) {
    if (required) throw new Error("퇴직연금 " + String(target || "unknown") + " " + row + "번 row " + field + "가 없습니다. 저장을 중단했습니다.");
    return "";
  }
  if (typeof value !== "string" || value !== value.trim() || (allowEmpty !== true && !value)) {
    throw new Error("퇴직연금 " + String(target || "unknown") + " " + row + "번 row " + field + "가 올바른 문자열이 아닙니다. 저장을 중단했습니다.");
  }
  return value;
}

function assertStoredPensionItemsIntegrity(items, target) {
  if (!Array.isArray(items)) {
    throw new Error("퇴직연금 " + String(target || "unknown") + " 데이터가 배열이 아닙니다. 저장을 중단했습니다.");
  }

  const seenCashDates = {};
  const seenResourceIds = {};
  const seenLogicalOperationIds = {};
  items.forEach(function(item, index) {
    const row = Number(index) + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("퇴직연금 " + String(target || "unknown") + " " + row + "번 row 형식이 올바르지 않습니다. 저장을 중단했습니다.");
    }

    const date = String(item.date || "").trim();
    if (!isValidDateText(date)) {
      throw new Error("퇴직연금 " + String(target || "unknown") + " " + row + "번 row 날짜가 올바르지 않습니다. 저장을 중단했습니다.");
    }

    if (target === "cashSnapshot") {
      if (seenCashDates[date]) {
        throw new Error("퇴직연금 현금성자산에 동일 날짜 " + date + " row가 중복되어 있습니다. 저장을 중단했습니다.");
      }
      seenCashDates[date] = true;

      if (!isStoredPensionNumericScalar(item.valuation, false, false)) {
        throw new Error("퇴직연금 현금성자산 " + row + "번 row 평가금액이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (!isStoredPensionNumericScalar(item.costBasis, false, true)) {
        throw new Error("퇴직연금 현금성자산 " + row + "번 row 매수원금이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      ["afterTradeIds", "afterContributionIds"].forEach(function(field) {
        if (item[field] == null) return; // legacy snapshot의 결측은 허용한다.
        if (!Array.isArray(item[field])) {
          throw new Error("퇴직연금 현금성자산 " + row + "번 row " + field + "가 배열이 아닙니다. 저장을 중단했습니다.");
        }
        const seenIds = {};
        item[field].forEach(function(id) {
          if (typeof id !== "string" || !id || id !== id.trim()) {
            throw new Error("퇴직연금 현금성자산 " + row + "번 row " + field + " 항목이 올바른 문자열 ID가 아닙니다. 저장을 중단했습니다.");
          }
          if (seenIds[id]) {
            throw new Error("퇴직연금 현금성자산 " + row + "번 row " + field + "에 중복 ID가 있습니다. 저장을 중단했습니다.");
          }
          seenIds[id] = true;
        });
      });
      ["memo", "updatedBy", "updatedAtKST"].forEach(function(field) {
        if (item[field] != null) assertStoredPensionStringField(item, field, target, row, false, true);
      });
      ["requestId", "logicalOperationId", "batchRequestId", "batchOperationId"].forEach(function(field) {
        if (item[field] != null) assertStoredPensionStringField(item, field, target, row, false, false);
      });
      const hasBatchRequestId = item.batchRequestId != null;
      const hasBatchOperationId = item.batchOperationId != null;
      if (hasBatchRequestId !== hasBatchOperationId) {
        throw new Error("퇴직연금 현금성자산 " + row + "번 row batch identity가 불완전합니다. 저장을 중단했습니다.");
      }
      if (item.requestId != null && hasBatchRequestId) {
        throw new Error("퇴직연금 현금성자산 " + row + "번 row에 single requestId와 batch identity가 함께 존재합니다. 저장을 중단했습니다.");
      }
      [
        item.requestId != null ? "request:" + String(item.requestId) : "",
        item.logicalOperationId != null ? "logical:" + String(item.logicalOperationId) : "",
        hasBatchRequestId ? "batch:" + String(item.batchRequestId) + "|" + String(item.batchOperationId) : ""
      ].forEach(function(identityKey) {
        if (!identityKey) return;
        if (seenLogicalOperationIds[identityKey]) {
          throw new Error("퇴직연금 현금성자산에 중복 identity " + identityKey + "가 있습니다. 저장을 중단했습니다.");
        }
        seenLogicalOperationIds[identityKey] = true;
      });
      return;
    }

    if (target !== "cashSnapshot") {
      // contribution/ETF는 id가 실제 delete resource key이므로, 값이 존재하면 정확한 문자열이어야 한다.
      // legacy row의 id 필드 자체가 없는 경우에는 normalize와 같은 규칙으로 effective id를 계산한 뒤
      // 명시적 id와의 충돌까지 함께 검사한다. 그래야 한 delete가 여러 row를 지우는 상태를 만들지 않는다.
      if (item.id != null && (typeof item.id !== "string" || !item.id.trim() || item.id !== item.id.trim())) {
        throw new Error("퇴직연금 " + String(target || "unknown") + " " + row + "번 row id가 올바른 문자열이 아닙니다. 저장을 중단했습니다.");
      }
      const effectiveId = item.id != null
        ? String(item.id)
        : (target === "etfTrade"
          ? "legacy-trade-" + date + "-" + String(item.ticker || "") + "-" + index
          : "legacy-contrib-" + date + "-" + index);
      if (seenResourceIds[effectiveId]) {
        throw new Error("퇴직연금 " + String(target || "unknown") + "에 중복 id " + effectiveId + "가 있습니다. 저장을 중단했습니다.");
      }
      seenResourceIds[effectiveId] = true;

      // logicalOperationId는 semantic/exact identity 판단에 사용된다. normalize는 명시값이 없으면
      // 실제 저장에 사용할 effectiveId를 fallback으로 쓰므로 검증도 같은 값으로 충돌을 검사한다.
      if (item.logicalOperationId != null && (typeof item.logicalOperationId !== "string" || !item.logicalOperationId.trim() || item.logicalOperationId !== item.logicalOperationId.trim())) {
        throw new Error("퇴직연금 " + String(target || "unknown") + " " + row + "번 row logicalOperationId가 올바르지 않습니다. 저장을 중단했습니다.");
      }
      const effectiveLogicalOperationId = item.logicalOperationId != null
        ? String(item.logicalOperationId)
        : effectiveId;
      if (effectiveLogicalOperationId) {
        if (seenLogicalOperationIds[effectiveLogicalOperationId]) {
          throw new Error("퇴직연금 " + String(target || "unknown") + "에 중복 logicalOperationId " + effectiveLogicalOperationId + "가 있습니다. 저장을 중단했습니다.");
        }
        seenLogicalOperationIds[effectiveLogicalOperationId] = true;
      }
    }

    if (target === "etfTrade") {
      assertStoredPensionStringField(item, "ticker", target, row, true, false);
      ["name", "memo", "updatedBy", "updatedAtKST", "appliedAtKST"].forEach(function(field) {
        if (item[field] != null) assertStoredPensionStringField(item, field, target, row, false, true);
      });
      if (!isStoredPensionNumericScalar(item.qty, true, false)) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 수량이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (!isStoredPensionNumericScalar(item.amount, true, false)) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 체결금액이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      // type/funding은 실제 현금흐름 의미에 관여하므로 값이 존재하면 허용 계약을 정확히 검증한다.
      // legacy row에서 필드 자체가 없는 경우에만 기존 buy/pension_cash fallback을 허용한다.
      if (item.type != null && (typeof item.type !== "string" || !item.type.trim() || (item.type.trim() !== "buy" && item.type.trim() !== "sell"))) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 거래유형이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (item.funding != null && (typeof item.funding !== "string" || item.funding.trim() !== "pension_cash")) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 자금출처가 올바르지 않습니다. 저장을 중단했습니다.");
      }
      // legacy row는 필드 자체가 없을 수 있어 결측은 기존 fallback을 허용한다.
      // 하지만 값이 존재하는데 손상된 경우에는 정상값처럼 보정하지 않고 fail-closed한다.
      if (item.tradeDate != null && (typeof item.tradeDate !== "string" || !item.tradeDate.trim() || !isValidDateText(item.tradeDate.trim()))) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 신청일이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (item.applyDate != null && (typeof item.applyDate !== "string" || !item.applyDate.trim() || !isValidDateText(item.applyDate.trim()))) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 반영일이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (!isStoredPensionPositiveNumber(item.price, true)) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 단가가 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (item.cashBeforeDate != null && (typeof item.cashBeforeDate !== "string" || !item.cashBeforeDate.trim() || !isValidDateText(item.cashBeforeDate.trim()))) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 현금기준일이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (!isStoredPensionNumericScalar(item.cashBefore, false, true)) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 매수 전 현금이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      if (!isStoredPensionNumericScalar(item.cashAfter, false, true)) {
        throw new Error("퇴직연금 ETF 거래 " + row + "번 row 매수 후 현금이 올바르지 않습니다. 저장을 중단했습니다.");
      }
      return;
    }

    ["memo", "updatedBy", "updatedAtKST", "source", "createdAtKST"].forEach(function(field) {
      if (item[field] != null) assertStoredPensionStringField(item, field, target, row, false, true);
    });
    if (!isStoredPensionNumericScalar(item.amount, true, false)) {
      throw new Error("퇴직연금 기업적립금 " + row + "번 row 금액이 올바르지 않습니다. 저장을 중단했습니다.");
    }
  });
}

// target별 데이터 필드를 검증·정규화·정렬한다.
function normalizeItemsForTarget(items, target) {
  assertStoredPensionItemsIntegrity(items, target);

  if (target === "cashSnapshot") {
    const map = {};

    items.forEach(function(item) {
      const date = String(item.date || "").trim();
      const normalized = {
        date: date,
        valuation: Math.round(Number(item.valuation)),
        memo: String(item.memo || "").trim(),
        updatedBy: item.updatedBy || "unknown",
        updatedAtKST: item.updatedAtKST || ""
      };
      const costBasis = item.costBasis == null ? null : Number(item.costBasis);
      if (costBasis != null) {
        normalized.costBasis = Math.round(costBasis);
      }
      if (Array.isArray(item.afterTradeIds)) {
        normalized.afterTradeIds = item.afterTradeIds.slice();
      }
      if (Array.isArray(item.afterContributionIds)) {
        normalized.afterContributionIds = item.afterContributionIds.slice();
      }
      if (item.requestId) {
        normalized.requestId = String(item.requestId);
      }
      if (item.logicalOperationId || item.requestId || item.batchRequestId || item.batchOperationId) {
        normalized.logicalOperationId = String(item.logicalOperationId || item.requestId || ("batch:" + String(item.batchRequestId || "") + "|" + String(item.batchOperationId || "")));
      }
      if (item.batchRequestId) {
        normalized.batchRequestId = String(item.batchRequestId);
      }
      if (item.batchOperationId) {
        normalized.batchOperationId = String(item.batchOperationId);
      }
      map[date] = normalized;
    });

    return Object.keys(map)
      .sort()
      .map(function(date) {
        return map[date];
      });
  }

  if (target === "etfTrade") {
    return items
      .map(function(item, index) {
        const date = String(item.date || "").trim();
        const tradeDate = item.tradeDate == null ? date : String(item.tradeDate).trim();
        const qty = Number(item.qty);
        const amount = Math.round(Number(item.amount));
        const effectiveId = item.id || "legacy-trade-" + date + "-" + String(item.ticker || "") + "-" + index;
        return {
          id: effectiveId,
          date: date,
          applyDate: item.applyDate == null ? date : String(item.applyDate).trim(),
          tradeDate: tradeDate,
          ticker: String(item.ticker || "").trim(),
          name: String(item.name || "").trim(),
          type: item.type == null ? "buy" : String(item.type).trim(),
          qty: qty,
          price: item.price == null ? (qty > 0 ? amount / qty : 0) : Number(item.price),
          amount: amount,
          funding: item.funding == null ? "pension_cash" : String(item.funding).trim(),
          cashBeforeDate: item.cashBeforeDate == null ? null : String(item.cashBeforeDate).trim(),
          cashBefore: item.cashBefore == null ? null : Number(item.cashBefore),
          cashAfter: item.cashAfter == null ? null : Number(item.cashAfter),
          memo: String(item.memo || "").trim(),
          updatedBy: item.updatedBy || "unknown",
          updatedAtKST: item.updatedAtKST || "",
          appliedAtKST: item.appliedAtKST || item.updatedAtKST || "",
          logicalOperationId: String(item.logicalOperationId || effectiveId)
        };
      })
      .sort(function(a, b) {
        return String(a.date || "").localeCompare(String(b.date || "")) ||
          String(a.appliedAtKST || "").localeCompare(String(b.appliedAtKST || "")) ||
          String(a.id || "").localeCompare(String(b.id || ""));
      });
  }

  return items
    .map(function(item, index) {
      const date = String(item.date || "").trim();
      const effectiveId = item.id || "legacy-contrib-" + date + "-" + index;
      return {
        id: effectiveId,
        date: date,
        amount: Math.round(Number(item.amount)),
        memo: String(item.memo || "").trim(),
        updatedBy: item.updatedBy || item.source || "unknown",
        updatedAtKST: item.updatedAtKST || item.createdAtKST || "",
        logicalOperationId: String(item.logicalOperationId || effectiveId)
      };
    })
    .sort(function(a, b) {
      return String(a.date || "").localeCompare(String(b.date || "")) || String(a.id || "").localeCompare(String(b.id || ""));
    });
}

// portfolio.json에서 퇴직연금 상품을 ticker로 조회한다.
function getPensionPortfolioProduct(ticker, ref, requestCache) {
  const portfolioCurrent = readGithubJsonRequestCached("data/portfolio.json", ref, requestCache);
  const products = portfolioCurrent.data && Array.isArray(portfolioCurrent.data.pension)
    ? portfolioCurrent.data.pension
    : [];
  return products.find(function(item) {
    return String(item && item.ticker || "").trim() === String(ticker || "").trim();
  }) || null;
}

/* =========================================================
 * 06. 퇴직연금 현금흐름 / Snapshot / Latency 계측
 * ========================================================= */

/* --- 06A. 현금흐름 / Snapshot 계산 ---------------------------------------------- */

// 현금 snapshot이 특정 ETF 거래를 이미 반영했는지 판단한다.
function pensionCashSnapshotReflectsTrade(snapshot, trade) {
  if (!snapshot || !trade) return false;

  const snapshotDate = String(snapshot.date || "");
  const tradeDate = String(trade.date || "");
  if (!snapshotDate || !tradeDate || snapshotDate < tradeDate) return false;

  // 더 늦은 날짜의 앱 현금 snapshot은 이미 반영된 이전 날짜 거래를 포함한 것으로 본다.
  if (snapshotDate > tradeDate) return true;

  if (Array.isArray(snapshot.afterTradeIds)) {
    return snapshot.afterTradeIds.map(String).indexOf(String(trade.id || "")) >= 0;
  }

  const snapshotAt = String(snapshot.updatedAtKST || "");
  const tradeAt = String(trade.appliedAtKST || trade.updatedAtKST || "");
  if (snapshotAt && tradeAt) {
    return snapshotAt >= tradeAt;
  }

  return true;
}

// 현금 snapshot이 특정 기업적립금을 이미 반영했는지 판단한다.
function pensionCashSnapshotReflectsContribution(snapshot, contribution) {
  if (!snapshot || !contribution) return false;

  const snapshotDate = String(snapshot.date || "");
  const contributionDate = String(contribution.date || "");
  if (!snapshotDate || !contributionDate || snapshotDate < contributionDate) return false;

  if (snapshotDate > contributionDate) return true;

  if (Array.isArray(snapshot.afterContributionIds)) {
    return snapshot.afterContributionIds.map(String).indexOf(String(contribution.id || "")) >= 0;
  }

  const snapshotAt = String(snapshot.updatedAtKST || "");
  const contributionAt = String(contribution.updatedAtKST || contribution.createdAtKST || "");
  if (snapshotAt && contributionAt) {
    return snapshotAt >= contributionAt;
  }

  // 순서 메타데이터가 없는 legacy snapshot은 기존의 동일 날짜 처리 규칙을 유지한다.
  return true;
}

// snapshot 이후 ETF 매수/매도 현금흐름을 합산한다.
function pensionTradeFlowAfterSnapshot(trades, snapshot, asOfDate) {
  return trades.reduce(function(acc, trade) {
    const date = String(trade.date || "");
    if (!date || date > asOfDate || date < snapshot.date) return acc;
    if (date === snapshot.date && pensionCashSnapshotReflectsTrade(snapshot, trade)) return acc;

    const amount = Number(trade.amount) || 0;
    if (trade.type === "sell") {
      acc.sellAmount = safePensionAdd(acc.sellAmount, amount, "퇴직연금 매도 현금흐름");
    } else {
      acc.buyAmount = safePensionAdd(acc.buyAmount, amount, "퇴직연금 매수 현금흐름");
    }
    return acc;
  }, { buyAmount: 0, sellAmount: 0 });
}

// snapshot 이후 기업적립금 유입을 합산한다.
function pensionContributionFlowAfterSnapshot(contributions, snapshot, asOfDate) {
  return contributions.reduce(function(sum, contribution) {
    const date = String(contribution.date || "");
    if (!date || date > asOfDate || date < snapshot.date) return sum;
    if (date === snapshot.date && pensionCashSnapshotReflectsContribution(snapshot, contribution)) return sum;
    return safePensionAdd(sum, Number(contribution.amount) || 0, "퇴직연금 기업적립금 현금흐름");
  }, 0);
}

// 가격 데이터에서 기준일 이전 최신 연금 현금 기준값을 구한다.
function latestPriceCashBase(prices, asOfDate) {
  const dates = Object.keys(prices || {}).filter(function(date) {
    return date <= asOfDate;
  }).sort();
  const latestDate = dates.length ? dates[dates.length - 1] : "";
  return latestDate ? Number((((prices || {})[latestDate] || {}).pension || {}).cash || 0) : 0;
}

// 메모리 state만으로 기준일 사용 가능 현금을 계산한다.
// 단건 저장과 Batch 모두 이 함수를 canonical 계산식으로 사용한다.
function calculatePensionCashAvailableFromState(asOfDate, state) {
  const snapshots = state.cashSnapshots || [];
  const contributions = state.contributions || [];
  const trades = state.trades || [];
  const eligibleSnapshots = snapshots.filter(function(item) {
    return item.date <= asOfDate;
  }).sort(function(a, b) {
    return String(a.date || "").localeCompare(String(b.date || ""));
  });
  const snapshot = eligibleSnapshots.length ? eligibleSnapshots[eligibleSnapshots.length - 1] : null;

  let balance = 0;
  if (snapshot) {
    balance = Number(snapshot.valuation) || 0;
    if (!Number.isSafeInteger(balance)) {
      throw new Error("퇴직연금 현금성자산 평가금액이 안전한 정수 범위를 벗어났습니다.");
    }
    balance = safePensionAdd(balance, pensionContributionFlowAfterSnapshot(contributions, snapshot, asOfDate), "퇴직연금 현금성자산");
    const flow = pensionTradeFlowAfterSnapshot(trades, snapshot, asOfDate);
    balance = safePensionSubtract(balance, flow.buyAmount, "퇴직연금 현금성자산");
    balance = safePensionAdd(balance, flow.sellAmount, "퇴직연금 현금성자산");
    return balance;
  }

  // snapshot이 없을 때만 prices가 필요하다. 단건 경로에서는 lazy loader를 사용해
  // 기존과 동일하게 불필요한 GitHub prices.json 요청을 만들지 않는다.
  const prices = state.prices || (typeof state.loadPrices === "function" ? state.loadPrices() : {});
  balance = latestPriceCashBase(prices || {}, asOfDate);
  if (!Number.isSafeInteger(balance)) {
    throw new Error("퇴직연금 현금성자산 기준값이 안전한 정수 범위를 벗어났습니다.");
  }
  contributions.forEach(function(item) {
    if (item.date <= asOfDate) balance = safePensionAdd(balance, Number(item.amount) || 0, "퇴직연금 현금성자산");
  });
  trades.forEach(function(trade) {
    if (trade.date > asOfDate) return;
    if (trade.type === "sell") balance = safePensionAdd(balance, Number(trade.amount) || 0, "퇴직연금 현금성자산");
    else balance = safePensionSubtract(balance, Number(trade.amount) || 0, "퇴직연금 현금성자산");
  });
  return balance;
}

// GitHub 데이터를 state로 구성한 뒤 canonical 현금 계산식에 위임한다.
function calculatePensionCashAvailable(asOfDate, tradeItems, ref, requestCache) {
  const cashCurrent = readPensionTarget("cashSnapshot", ref, requestCache);
  const contributionCurrent = readPensionTarget("contribution", ref, requestCache);

  return calculatePensionCashAvailableFromState(asOfDate, {
    cashSnapshots: cashCurrent.items,
    contributions: contributionCurrent.items,
    trades: normalizeItemsForTarget(tradeItems || [], "etfTrade"),
    loadPrices: function() {
      const pricesCurrent = readGithubJsonRequestCached("data/prices.json", ref, requestCache);
      return pricesCurrent.data || {};
    }
  });
}

// 거래/적립금 유형에 맞는 snapshot 반영 판정 함수를 반환한다.
function pensionCashSnapshotReflector(target) {
  return target === "etfTrade"
    ? pensionCashSnapshotReflectsTrade
    : pensionCashSnapshotReflectsContribution;
}

// state에서 특정 거래/적립금을 반영한 현금 snapshot 목록을 찾는 canonical 함수다.
function findLinkedCashSnapshots(state, item, target) {
  if (!item) return [];
  const reflects = pensionCashSnapshotReflector(target);

  return (state.cashSnapshots || []).filter(function(snapshot) {
    return String(snapshot.date || "") >= String(item.date || "") && reflects(snapshot, item);
  }).sort(function(a, b) {
    return String(a.date || "").localeCompare(String(b.date || ""));
  });
}

// state에서 특정 거래/적립금과 연결된 최초 현금 snapshot을 찾는다.
function findLinkedCashSnapshot(state, item, target) {
  return findLinkedCashSnapshots(state, item, target)[0] || null;
}

// GitHub 현금 snapshot을 읽어 단건 삭제 보호용 연결 snapshot을 찾는다.
function findLinkedCashSnapshotFromGithub(item, target, ref, requestCache) {
  if (!item) return null;
  const cashCurrent = readPensionTarget("cashSnapshot", ref, requestCache);
  return findLinkedCashSnapshot({ cashSnapshots: cashCurrent.items }, item, target);
}

/* --- 06B. Pension Latency Instrumentation --------------------------------- */

// Pension 저장 지연을 운영 환경에서 계측한다. Date.now() 외 추가 I/O를 만들지 않으며 business state에는 사용하지 않는다.
function createPensionTimingTrace(scope, body) {
  const value = body || {};
  return {
    startedAtMs: Date.now(),
    scope: String(scope || "single"),
    action: String(value.action || (String(scope || "") === "batch" ? "batchPension" : "")),
    target: String(value.target || (String(scope || "") === "batch" ? "batch" : "")),
    stages: {},
    details: {}
  };
}

function recordPensionTimingStage(trace, name, startedAtMs) {
  if (!trace || !name) return 0;
  const elapsed = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
  trace.stages[name] = Math.max(0, Number(trace.stages[name] || 0)) + elapsed;
  return elapsed;
}

function recordPensionTimingDetail(trace, group, name, startedAtMs) {
  if (!trace || !group || !name) return 0;
  const elapsed = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
  if (!trace.details[group]) trace.details[group] = {};
  trace.details[group][name] = Math.max(0, Number(trace.details[group][name] || 0)) + elapsed;
  return elapsed;
}

function buildPensionTimingSnapshot(trace, outcome) {
  if (!trace) return null;
  const totalMs = Math.max(0, Date.now() - Number(trace.startedAtMs || Date.now()));
  const stages = {};
  let measuredMs = 0;
  Object.keys(trace.stages || {}).forEach(function(key) {
    const value = Math.max(0, Number(trace.stages[key] || 0));
    stages[key] = value;
    measuredMs += value;
  });
  const details = {};
  Object.keys(trace.details || {}).forEach(function(group) {
    const values = {};
    Object.keys(trace.details[group] || {}).forEach(function(key) {
      values[key] = Math.max(0, Number(trace.details[group][key] || 0));
    });
    details[group] = values;
  });
  return {
    version: 1,
    scope: String(trace.scope || "single"),
    action: String(trace.action || ""),
    target: String(trace.target || ""),
    outcome: String(outcome || ""),
    totalMs: totalMs,
    measuredMs: measuredMs,
    unattributedMs: Math.max(0, totalMs - measuredMs),
    stages: stages,
    details: details
  };
}

function attachPensionTiming(trace, result, outcome) {
  const value = result && typeof result === "object"
    ? result
    : { ok: false, error: String(result || "Pension 처리 결과가 없습니다.") };
  value.timing = buildPensionTimingSnapshot(trace, outcome || value.action || (value.ok ? "ok" : "error"));
  return value;
}

/* =========================================================
 * 07. 퇴직연금 단건 Transaction / Durable Identity
 * ========================================================= */

/* --- 07A. Resource Version / Semantic Ledger ------------------------------ */

// 현금성자산 삭제는 날짜만으로 최신 snapshot을 지우지 않도록 화면이 본 버전을 함께 검증한다.
function pensionCashSnapshotVersion(snapshot) {
  if (!snapshot) return "";
  if (snapshot.requestId) return "request:" + String(snapshot.requestId);
  if (snapshot.batchRequestId || snapshot.batchOperationId) {
    return "batch:" + String(snapshot.batchRequestId || "") + "|" + String(snapshot.batchOperationId || "");
  }
  return [
    "legacy",
    String(snapshot.date || ""),
    String(snapshot.updatedAtKST || ""),
    String(snapshot.valuation == null ? "" : snapshot.valuation),
    String(snapshot.costBasis == null ? "" : snapshot.costBasis),
    String(snapshot.memo || "")
  ].join("|");
}


// durable ledger는 idempotency/race의 Source of Truth이므로 손상 row를 filter로 조용히 버리지 않는다.
// 내부 writer가 만들지 않는 구조가 관측되면 다음 mutation 전에 fail-closed하여 proof 소실을 막는다.
function storedDurableLedgerItems(data, collectionKey, label) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray(data[collectionKey])) {
    return data[collectionKey];
  }
  throw new Error(String(label || "durable ledger") + " JSON 구조가 올바르지 않습니다. 저장을 중단했습니다.");
}

function assertStoredDurableStringField(item, field, label, required, allowEmpty) {
  const value = item && item[field];
  if (value == null) {
    if (required) throw new Error(label + " " + field + "가 없습니다. 저장을 중단했습니다.");
    return "";
  }
  if (typeof value !== "string" || value !== value.trim() || (allowEmpty !== true && !value)) {
    throw new Error(label + " " + field + "가 올바른 문자열이 아닙니다. 저장을 중단했습니다.");
  }
  return value;
}

function assertStoredDurableHash(value, label, lengths) {
  const text = typeof value === "string" ? value : "";
  const allowedLengths = Array.isArray(lengths) && lengths.length ? lengths : [64];
  if (text !== text.trim() || !/^[0-9a-f]+$/.test(text) || allowedLengths.indexOf(text.length) < 0) {
    throw new Error(label + " hash가 올바르지 않습니다. 저장을 중단했습니다.");
  }
  return text;
}

function storedDurableSavedAtMs(value, label) {
  if (value == null) return 0; // legacy row는 timestamp가 없을 수 있다.
  if (typeof value === "boolean" || typeof value === "object" || (typeof value === "string" && !value.trim())) {
    throw new Error(label + " savedAtMs가 올바르지 않습니다. 저장을 중단했습니다.");
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(label + " savedAtMs가 올바르지 않습니다. 저장을 중단했습니다.");
  }
  return number;
}

// 모든 Pension logical mutation은 현재 resource가 overwrite/delete되어도 cross-device stale retry를
// 식별할 수 있도록 semantic hash 기반 GitHub shard ledger에 durable history를 남긴다.
function normalizePensionOperationLedger(data) {
  const items = storedDurableLedgerItems(data, "operations", "Pension semantic ledger");
  const seenLogicalOperationIds = {};
  const seenRequestIds = {};
  return items.map(function(item, index) {
    const label = "Pension semantic ledger " + (index + 1) + "번 row";
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(label + " 형식이 올바르지 않습니다. 저장을 중단했습니다.");
    }
    const target = assertStoredDurableStringField(item, "target", label, true, false);
    const action = assertStoredDurableStringField(item, "action", label, true, false);
    if (!Object.prototype.hasOwnProperty.call(PENSION_TARGET_META, target) || (action !== "upsert" && action !== "delete")) {
      throw new Error(label + " target/action이 올바르지 않습니다. 저장을 중단했습니다.");
    }
    const semanticHash = assertStoredDurableHash(assertStoredDurableStringField(item, "semanticHash", label, true, false), label + " semanticHash", [64]);
    const resourceKey = item.resourceKey != null
      ? assertStoredDurableStringField(item, "resourceKey", label, false, false)
      : assertStoredDurableStringField(item, "date", label, false, false);
    if (!resourceKey) throw new Error(label + " resourceKey가 없습니다. 저장을 중단했습니다.");
    ["date", "logicalOperationId", "requestId", "batchRequestId", "batchOperationId", "resultVersion", "expectedVersion", "savedAtKST"].forEach(function(field) {
      if (item[field] != null) assertStoredDurableStringField(item, field, label, false, true);
    });
    const logicalOperationId = String(item.logicalOperationId || "");
    const requestId = String(item.requestId || "");
    if (logicalOperationId) {
      if (seenLogicalOperationIds[logicalOperationId]) throw new Error(label + " logicalOperationId가 중복됩니다. 저장을 중단했습니다.");
      seenLogicalOperationIds[logicalOperationId] = true;
    }
    if (requestId) {
      if (seenRequestIds[requestId]) throw new Error(label + " requestId가 중복됩니다. 저장을 중단했습니다.");
      seenRequestIds[requestId] = true;
    }
    return {
      target: target,
      action: action,
      resourceKey: resourceKey,
      date: String(item.date || ""),
      semanticHash: semanticHash,
      logicalOperationId: logicalOperationId,
      requestId: requestId,
      batchRequestId: String(item.batchRequestId || ""),
      batchOperationId: String(item.batchOperationId || ""),
      resultVersion: String(item.resultVersion || ""),
      expectedVersion: String(item.expectedVersion || ""),
      savedAtKST: String(item.savedAtKST || ""),
      savedAtMs: storedDurableSavedAtMs(item.savedAtMs, label)
    };
  }).sort(function(a, b) {
    return Number(a.savedAtMs || 0) - Number(b.savedAtMs || 0);
  });
}

function pensionOperationSemanticPayload(target, action, fields) {
  const normalizedTarget = String(target || "");
  const normalizedAction = String(action || "");
  const source = fields || {};
  if (normalizedAction === "delete") {
    if (normalizedTarget === "cashSnapshot") {
      return { target: normalizedTarget, action: "delete", date: String(source.date || source.resourceKey || source.key || "") };
    }
    return {
      target: normalizedTarget,
      action: "delete",
      resourceKey: String(source.resourceKey || source.key || source.date || "")
    };
  }
  if (normalizedTarget === "cashSnapshot") {
    return {
      target: normalizedTarget, action: "upsert", date: String(source.date || ""),
      valuation: Number(source.valuation), costBasis: Number(source.costBasis), memo: String(source.memo || "")
    };
  }
  if (normalizedTarget === "contribution") {
    return {
      target: normalizedTarget, action: "upsert", date: String(source.date || ""),
      amount: Number(source.amount), memo: String(source.memo || "")
    };
  }
  return {
    target: normalizedTarget, action: "upsert", tradeDate: String(source.tradeDate || ""),
    ticker: String(source.ticker || ""), qty: Number(source.qty), amount: Number(source.amount), memo: String(source.memo || "")
  };
}

function pensionOperationSemanticHash(target, action, fields) {
  return sha256HexText(canonicalPensionBatchJson(pensionOperationSemanticPayload(target, action, fields)));
}

function pensionOperationLedgerShardPath(semanticHash) {
  const hash = String(semanticHash || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("Pension operation semantic hash가 올바르지 않습니다.");
  return PENSION_OPERATION_LEDGER_DIR + "/" + hash.slice(0, PENSION_OPERATION_LEDGER_SHARD_PREFIX_LENGTH) + ".json";
}

/* --- 07B. Request-local Read Cache / Parallel Preflight ------------------- */

function pensionRequestReadCacheKey(path, ref) {
  return String(ref || "") + "|" + String(path || "");
}

function readGithubJsonRequestCached(path, ref, requestCache) {
  if (!requestCache) return readGithubJson(path, ref);
  const key = pensionRequestReadCacheKey(path, ref);
  if (Object.prototype.hasOwnProperty.call(requestCache, key)) {
    const cached = requestCache[key];
    // optional 404 fallback이 같은 cache key에 남아 있으면 required read로는 재사용하지 않는다.
    if (!(cached && cached.missing === true)) return cached;
  }
  const current = readGithubJson(path, ref);
  requestCache[key] = current;
  return current;
}

function readGithubJsonOptionalRequestCached(path, ref, fallbackData, requestCache) {
  if (!requestCache) return readGithubJsonOptional(path, ref, fallbackData);
  const key = pensionRequestReadCacheKey(path, ref);
  if (Object.prototype.hasOwnProperty.call(requestCache, key)) return requestCache[key];
  const current = readGithubJsonOptional(path, ref, fallbackData);
  requestCache[key] = current;
  return current;
}

// 같은 immutable base commit에서 cashSnapshot 단건 upsert가 곧 사용할 독립 JSON들을
// 한 fetchAll로 미리 채운다. 최신 HEAD/commit preflight/readback에는 이 cache를 사용하지 않는다.
function primePensionCashUpsertReadCache(fields, identity, ref, requestCache) {
  if (!requestCache || !ref) return;
  const semanticHash = pensionOperationSemanticHash("cashSnapshot", "upsert", fields || {});
  const ledgerPath = pensionOperationLedgerShardPath(semanticHash);
  const identityPaths = pensionOperationIdentityKeys("cashSnapshot", identity || {}).map(function(identityKey) {
    return pensionOperationIdentityLedgerShardPath(identityKey);
  });
  const specs = [
    { path: ledgerPath, optional: true, fallbackData: [] },
    { path: PENSION_OPERATION_LEDGER_LEGACY_PATH, optional: true, fallbackData: [] },
    { path: getDataPath("contribution"), optional: false, fallbackData: null },
    { path: getDataPath("etfTrade"), optional: false, fallbackData: null }
  ];
  identityPaths.forEach(function(path) {
    specs.push({ path: path, optional: true, fallbackData: [] });
  });

  const unique = [];
  const seen = {};
  specs.forEach(function(spec) {
    const path = String(spec && spec.path || "");
    if (!path || seen[path]) return;
    seen[path] = true;
    const key = pensionRequestReadCacheKey(path, ref);
    if (Object.prototype.hasOwnProperty.call(requestCache, key)) return;
    unique.push(spec);
  });
  if (!unique.length) return;

  const settled = githubRequestManyGetSettled(unique.map(function(spec) {
    return {
      key: String(spec.path || ""),
      path: githubContentsApiPath(String(spec.path || ""), ref),
      allow404: spec.optional === true
    };
  }));

  settled.forEach(function(result, index) {
    const spec = unique[index];
    if (!result || result.ok !== true) throw (result && result.error) || new Error("Pension preflight JSON을 읽지 못했습니다: " + spec.path);
    let current = null;
    if (Number(result.status || 0) === 404 && spec.optional === true) {
      current = { sha: "", data: spec.fallbackData, missing: true };
    } else {
      current = decodeGithubJsonContentsResult(result.data, spec.path, ref, spec.fallbackData, spec.optional === true);
    }
    requestCache[pensionRequestReadCacheKey(spec.path, ref)] = current;
  });
}

// 같은 immutable base commit에서 단건 delete가 곧 사용할 ledger/identity/dependency JSON을
// 한 fetchAll로 미리 채운다. contribution/ETF delete의 연결 snapshot 보호 검사도 같은
// cashSnapshot cache를 재사용한다. 최신 HEAD/commit preflight/readback은 항상 fresh read다.
function primePensionDeleteReadCache(target, fields, identity, ref, requestCache) {
  if (!requestCache || !ref) return;
  const normalizedTarget = String(target || "");
  const semanticHash = pensionOperationSemanticHash(normalizedTarget, "delete", fields || {});
  const ledgerPath = pensionOperationLedgerShardPath(semanticHash);
  const identityPaths = pensionOperationIdentityKeys(normalizedTarget, identity || {}).map(function(identityKey) {
    return pensionOperationIdentityLedgerShardPath(identityKey);
  });
  const specs = [
    { path: ledgerPath, optional: true, fallbackData: [] }
  ];
  if (normalizedTarget === "cashSnapshot") {
    specs.push({ path: PENSION_OPERATION_LEDGER_LEGACY_PATH, optional: true, fallbackData: [] });
  }
  if (normalizedTarget === "contribution" || normalizedTarget === "etfTrade") {
    specs.push({ path: getDataPath("cashSnapshot"), optional: false, fallbackData: null });
  }
  identityPaths.forEach(function(path) {
    specs.push({ path: path, optional: true, fallbackData: [] });
  });

  const unique = [];
  const seen = {};
  specs.forEach(function(spec) {
    const path = String(spec && spec.path || "");
    if (!path || seen[path]) return;
    seen[path] = true;
    const key = pensionRequestReadCacheKey(path, ref);
    if (Object.prototype.hasOwnProperty.call(requestCache, key)) return;
    unique.push(spec);
  });
  if (!unique.length) return;

  const settled = githubRequestManyGetSettled(unique.map(function(spec) {
    return {
      key: String(spec.path || ""),
      path: githubContentsApiPath(String(spec.path || ""), ref),
      allow404: spec.optional === true
    };
  }));

  settled.forEach(function(result, index) {
    const spec = unique[index];
    if (!result || result.ok !== true) throw (result && result.error) || new Error("Pension delete preflight JSON을 읽지 못했습니다: " + spec.path);
    let current = null;
    if (Number(result.status || 0) === 404 && spec.optional === true) {
      current = { sha: "", data: spec.fallbackData, missing: true };
    } else {
      current = decodeGithubJsonContentsResult(result.data, spec.path, ref, spec.fallbackData, spec.optional === true);
    }
    requestCache[pensionRequestReadCacheKey(spec.path, ref)] = current;
  });
}

// 같은 immutable base commit에서 ETF 추가매수 단건 upsert가 곧 사용할 독립 JSON들을
// 한 fetchAll로 미리 채운다. target etfTrade/portfolio는 앞선 validation read cache를 재사용하고,
// 최신 HEAD/commit preflight/readback에는 이 cache를 사용하지 않는다.
function primePensionEtfUpsertReadCache(fields, identity, ref, requestCache) {
  if (!requestCache || !ref) return;
  const semanticHash = pensionOperationSemanticHash("etfTrade", "upsert", fields || {});
  const ledgerPath = pensionOperationLedgerShardPath(semanticHash);
  const identityPaths = pensionOperationIdentityKeys("etfTrade", identity || {}).map(function(identityKey) {
    return pensionOperationIdentityLedgerShardPath(identityKey);
  });
  const specs = [
    { path: ledgerPath, optional: true, fallbackData: [] },
    { path: getDataPath("cashSnapshot"), optional: false, fallbackData: null },
    { path: getDataPath("contribution"), optional: false, fallbackData: null },
    { path: "data/prices.json", optional: false, fallbackData: null }
  ];
  identityPaths.forEach(function(path) {
    specs.push({ path: path, optional: true, fallbackData: [] });
  });

  const unique = [];
  const seen = {};
  specs.forEach(function(spec) {
    const path = String(spec && spec.path || "");
    if (!path || seen[path]) return;
    seen[path] = true;
    const key = pensionRequestReadCacheKey(path, ref);
    if (Object.prototype.hasOwnProperty.call(requestCache, key)) return;
    unique.push(spec);
  });
  if (!unique.length) return;

  const settled = githubRequestManyGetSettled(unique.map(function(spec) {
    return {
      key: String(spec.path || ""),
      path: githubContentsApiPath(String(spec.path || ""), ref),
      allow404: spec.optional === true
    };
  }));

  settled.forEach(function(result, index) {
    const spec = unique[index];
    if (!result || result.ok !== true) throw (result && result.error) || new Error("Pension ETF preflight JSON을 읽지 못했습니다: " + spec.path);
    let current = null;
    if (Number(result.status || 0) === 404 && spec.optional === true) {
      current = { sha: "", data: spec.fallbackData, missing: true };
    } else {
      current = decodeGithubJsonContentsResult(result.data, spec.path, ref, spec.fallbackData, spec.optional === true);
    }
    requestCache[pensionRequestReadCacheKey(spec.path, ref)] = current;
  });
}

function readPensionOperationLedgerShardByHash(semanticHash, ref, requestCache) {
  const path = pensionOperationLedgerShardPath(semanticHash);
  const current = readGithubJsonOptionalRequestCached(path, ref, [], requestCache);
  return { path: path, sha: current.sha, missing: current.missing === true, items: normalizePensionOperationLedger(current.data) };
}

function readLegacyPensionOperationLedger(ref, requestCache) {
  const current = readGithubJsonOptionalRequestCached(PENSION_OPERATION_LEDGER_LEGACY_PATH, ref, [], requestCache);
  return { path: PENSION_OPERATION_LEDGER_LEGACY_PATH, sha: current.sha, missing: current.missing === true, items: normalizePensionOperationLedger(current.data) };
}

function findPensionLedgerMatchInItems(items, semanticHash) {
  const list = Array.isArray(items) ? items : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const entry = list[index];
    if (String(entry && entry.semanticHash || "") === String(semanticHash || "")) return entry;
  }
  return null;
}

// semantic 최신 후보보다 request/logical/batch identity의 정확한 과거 operation을 먼저 찾는다.
// 같은 내용의 정상 별도 operation이 더 최근에 있어도 오래된 SAME retry가 가려지지 않는다.
function pensionLedgerEntryExactIdentityMatch(entry, identity) {
  const value = entry || {};
  const criteria = identity || {};
  const logicalOperationId = String(criteria.logicalOperationId || "");
  const requestId = String(criteria.requestId || "");
  const batchRequestId = String(criteria.batchRequestId || "");
  const batchOperationId = String(criteria.batchOperationId || "");
  if (logicalOperationId && String(value.logicalOperationId || "") === logicalOperationId) return true;
  if (requestId && String(value.requestId || "") === requestId) return true;
  return !!batchRequestId && !!batchOperationId &&
    String(value.batchRequestId || "") === batchRequestId &&
    String(value.batchOperationId || "") === batchOperationId;
}

function findPensionLedgerExactIdentityInItems(items, identity, semanticHash) {
  const list = Array.isArray(items) ? items : [];
  const expectedSemanticHash = String(semanticHash || "");
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const entry = list[index];
    if (expectedSemanticHash && String(entry && entry.semanticHash || "") !== expectedSemanticHash) continue;
    if (pensionLedgerEntryExactIdentityMatch(entry, identity)) return entry;
  }
  return null;
}

function findPensionLedgerExactIdentity(ledgerContext, target, identity, ref, requestCache) {
  if (!ledgerContext) return null;
  const semanticHash = String(ledgerContext.semanticHash || "");
  let match = findPensionLedgerExactIdentityInItems(ledgerContext.items, identity, semanticHash);
  if (!match && String(target || "") === "cashSnapshot") {
    const legacy = readLegacyPensionOperationLedger(ref, requestCache);
    match = findPensionLedgerExactIdentityInItems(legacy.items, identity, semanticHash);
  }
  return match;
}

function loadPensionOperationLedgerContext(target, action, fields, ref, requestCache) {
  const semanticHash = pensionOperationSemanticHash(target, action, fields);
  const shard = readPensionOperationLedgerShardByHash(semanticHash, ref, requestCache);
  let match = findPensionLedgerMatchInItems(shard.items, semanticHash);
  let legacy = null;
  if (!match && String(target || "") === "cashSnapshot") {
    legacy = readLegacyPensionOperationLedger(ref, requestCache);
    match = findPensionLedgerMatchInItems(legacy.items, semanticHash);
  }
  return {
    semanticHash: semanticHash,
    path: shard.path,
    items: shard.items,
    match: match,
    legacyPath: legacy && match ? legacy.path : ""
  };
}

function appendPensionOperationLedgerEntry(items, entry) {
  const next = (Array.isArray(items) ? items : []).filter(function(item) {
    return !entry.logicalOperationId || String(item && item.logicalOperationId || "") !== String(entry.logicalOperationId || "");
  });
  next.push(entry);
  return normalizePensionOperationLedger(next);
}

function makePensionOperationLedgerEntry(target, action, fields) {
  const semanticHash = pensionOperationSemanticHash(target, action, fields);
  return {
    target: String(target || ""),
    action: String(action || ""),
    resourceKey: String(fields && (fields.resourceKey || fields.key || fields.date) || ""),
    date: String(fields && fields.date || ""),
    semanticHash: semanticHash,
    logicalOperationId: String(fields && fields.logicalOperationId || ""),
    requestId: String(fields && fields.requestId || ""),
    batchRequestId: String(fields && fields.batchRequestId || ""),
    batchOperationId: String(fields && fields.batchOperationId || ""),
    resultVersion: String(fields && fields.resultVersion || ""),
    expectedVersion: String(fields && fields.expectedVersion || ""),
    savedAtKST: nowKSTText(),
    savedAtMs: Date.now()
  };
}


/* --- 07C. Exact Identity / Durable Identity ------------------------------- */

// semantic ledger는 "같은 효과 후보" 탐색용이고, exact identity는 payload 내용과 무관한
// 별도 shard index에 보존한다. 같은 request/logical/batch identity가 다른 내용으로 재사용되어도
// semantic hash가 바뀌어 다른 shard로 이동하는 우회를 허용하지 않는다.
function normalizePensionOperationIdentityLedger(data) {
  const items = storedDurableLedgerItems(data, "identities", "Pension exact identity ledger");
  const seenIdentityKeys = {};
  return items.map(function(item, index) {
    const label = "Pension exact identity ledger " + (index + 1) + "번 row";
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(label + " 형식이 올바르지 않습니다. 저장을 중단했습니다.");
    }
    const identityKey = assertStoredDurableStringField(item, "identityKey", label, true, false);
    if (seenIdentityKeys[identityKey]) {
      throw new Error(label + " identityKey가 중복됩니다. 저장을 중단했습니다.");
    }
    seenIdentityKeys[identityKey] = true;
    const contentHash = assertStoredDurableHash(assertStoredDurableStringField(item, "contentHash", label, true, false), label + " contentHash", [64]);
    const target = assertStoredDurableStringField(item, "target", label, true, false);
    const action = assertStoredDurableStringField(item, "action", label, true, false);
    if (!Object.prototype.hasOwnProperty.call(PENSION_TARGET_META, target) || ["upsert", "delete", "terminal_stale", "receipt_recovered"].indexOf(action) < 0) {
      throw new Error(label + " target/action이 올바르지 않습니다. 저장을 중단했습니다.");
    }
    ["semanticHash", "resourceKey", "logicalOperationId", "requestId", "batchRequestId", "batchOperationId", "resultVersion", "savedAtKST"].forEach(function(field) {
      if (item[field] != null) assertStoredDurableStringField(item, field, label, false, true);
    });
    if (item.semanticHash) assertStoredDurableHash(String(item.semanticHash), label + " semanticHash", [64]);
    return {
      identityKey: identityKey,
      contentHash: contentHash,
      target: target,
      action: action,
      semanticHash: String(item.semanticHash || ""),
      resourceKey: String(item.resourceKey || ""),
      logicalOperationId: String(item.logicalOperationId || ""),
      requestId: String(item.requestId || ""),
      batchRequestId: String(item.batchRequestId || ""),
      batchOperationId: String(item.batchOperationId || ""),
      resultVersion: String(item.resultVersion || ""),
      savedAtKST: String(item.savedAtKST || ""),
      savedAtMs: storedDurableSavedAtMs(item.savedAtMs, label)
    };
  }).sort(function(a, b) {
    return Number(a.savedAtMs || 0) - Number(b.savedAtMs || 0) || String(a.identityKey || "").localeCompare(String(b.identityKey || ""));
  });
}

function pensionOperationIdentityKeys(target, identity) {
  const normalizedTarget = String(target || "");
  const value = identity || {};
  const keys = [];
  const requestId = String(value.requestId || "");
  const logicalOperationId = String(value.logicalOperationId || "");
  const batchRequestId = String(value.batchRequestId || "");
  const batchOperationId = String(value.batchOperationId || "");
  if (requestId) keys.push("request:" + normalizedTarget + ":" + requestId);
  if (logicalOperationId) keys.push("logical:" + normalizedTarget + ":" + logicalOperationId);
  if (batchRequestId && batchOperationId) keys.push("batch:" + normalizedTarget + ":" + batchRequestId + "|" + batchOperationId);
  return keys.filter(function(key, index) { return keys.indexOf(key) === index; });
}

function pensionOperationIdentityLedgerShardPath(identityKey) {
  const key = String(identityKey || "");
  if (!key) throw new Error("Pension operation identity key가 비어 있습니다.");
  const hash = sha256HexText(key);
  return PENSION_OPERATION_IDENTITY_DIR + "/" + hash.slice(0, PENSION_OPERATION_IDENTITY_SHARD_PREFIX_LENGTH) + ".json";
}

function loadPensionOperationIdentityContext(target, identity, ref, requestCache) {
  const keys = pensionOperationIdentityKeys(target, identity);
  const shards = {};
  const matches = [];
  keys.forEach(function(identityKey) {
    const path = pensionOperationIdentityLedgerShardPath(identityKey);
    if (!shards[path]) {
      const current = readGithubJsonOptionalRequestCached(path, ref, [], requestCache);
      const items = normalizePensionOperationIdentityLedger(current.data);
      shards[path] = { path: path, initial: items.slice(), items: items };
    }
    const list = shards[path].items;
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (String(list[index] && list[index].identityKey || "") === identityKey) {
        matches.push(list[index]);
        break;
      }
    }
  });
  return { target: String(target || ""), keys: keys, shards: shards, matches: matches };
}

function pensionOperationIdentityContextPaths(context) {
  return Object.keys(context && context.shards || {}).sort();
}

function assertPensionOperationIdentityCompatible(context, contentHash) {
  const expectedHash = String(contentHash || "");
  const matches = Array.isArray(context && context.matches) ? context.matches : [];
  let latestCompleted = null;
  let latestTerminal = null;
  matches.forEach(function(match) {
    if (String(match.contentHash || "") !== expectedHash) {
      throw new Error("동일한 요청 identity가 다른 저장 내용에 이미 사용되었습니다. 새로고침 후 다시 시도하세요.");
    }
    const terminal = String(match.action || "") === "terminal_stale" || String(match.resultVersion || "") === "terminal-stale";
    if (terminal) {
      if (!latestTerminal || Number(match.savedAtMs || 0) >= Number(latestTerminal.savedAtMs || 0)) latestTerminal = match;
    } else if (!latestCompleted || Number(match.savedAtMs || 0) >= Number(latestCompleted.savedAtMs || 0)) {
      latestCompleted = match;
    }
  });
  // 동일 content에 completed와 terminal_stale residue가 함께 있으면 실제 mutation/no-op 성공을 증명하는 completed가 더 강한 proof다.
  return latestCompleted || latestTerminal;
}

function pensionOperationIdentityContextMissingKeys(context) {
  const keys = Array.isArray(context && context.keys) ? context.keys : [];
  return keys.filter(function(identityKey) {
    const path = pensionOperationIdentityLedgerShardPath(identityKey);
    const shard = context && context.shards && context.shards[path];
    if (!shard) return true;
    return !shard.items.some(function(item) { return String(item && item.identityKey || "") === String(identityKey || ""); });
  });
}

// Single exact identity는 requestId/logicalOperationId 중 하나만 과거 ledger에 존재하더라도
// 같은 content의 durable proof가 확인되면 누락된 key를 metadata-only CAS commit으로 backfill한다.
// duplicate/stale 응답 전에 모든 exact key를 영구적으로 묶어 receipt GC 뒤 identity 재사용을 차단한다.
function ensurePensionSingleDurableIdentityComplete(target, identity, contentHash) {
  const normalizedTarget = String(target || "");
  const value = identity || {};
  const expectedHash = String(contentHash || "");
  const keys = pensionOperationIdentityKeys(normalizedTarget, value);
  if (!normalizedTarget || !expectedHash || !keys.length) return { stored: false, status: "", match: null };

  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const head = getGithubBranchHeadSha();
    if (!head) throw new Error("Pension exact identity backfill 기준 커밋을 확인하지 못했습니다.");
    const context = loadPensionOperationIdentityContext(normalizedTarget, value, head);
    const existing = assertPensionOperationIdentityCompatible(context, expectedHash);
    if (!existing) return { stored: false, status: "", match: null };
    if (!pensionOperationIdentityContextMissingKeys(context).length) {
      return { stored: true, status: pensionSingleDurableIdentityStatus(existing), match: existing };
    }

    const entry = makePensionOperationLedgerEntry(normalizedTarget, String(existing.action || "duplicate"), {
      resourceKey: String(existing.resourceKey || ""),
      logicalOperationId: String(value.logicalOperationId || existing.logicalOperationId || ""),
      requestId: String(value.requestId || existing.requestId || ""),
      resultVersion: String(existing.resultVersion || "")
    });
    entry.semanticHash = String(existing.semanticHash || entry.semanticHash || "");
    entry.resourceKey = String(existing.resourceKey || entry.resourceKey || "");
    appendPensionOperationIdentityEntries(context, normalizedTarget, String(existing.action || "duplicate"), expectedHash, entry);
    const changes = pensionOperationIdentityContextFileChanges(context);
    if (!changes.length) return { stored: true, status: pensionSingleDurableIdentityStatus(existing), match: existing };
    if (tryDurableGithubJsonBatchWrite(
      head, changes,
      "Backfill pension exact identity " + normalizedTarget + " [" + String(value.requestId || value.logicalOperationId || "") + "]",
      attempt
    )) return { stored: true, status: pensionSingleDurableIdentityStatus(existing), match: existing };
  }
  return { stored: false, status: "", match: null };
}

function appendPensionOperationIdentityEntries(context, target, action, contentHash, operationEntry) {
  const value = operationEntry || {};
  const keys = Array.isArray(context && context.keys) ? context.keys : [];
  keys.forEach(function(identityKey) {
    const path = pensionOperationIdentityLedgerShardPath(identityKey);
    const shard = context.shards[path];
    if (!shard) throw new Error("Pension identity ledger shard를 준비하지 못했습니다.");
    const existing = shard.items.find(function(item) { return String(item && item.identityKey || "") === identityKey; }) || null;
    if (existing) {
      if (String(existing.contentHash || "") !== String(contentHash || "")) {
        throw new Error("동일한 요청 identity가 다른 저장 내용에 이미 사용되었습니다. 새로고침 후 다시 시도하세요.");
      }
      return;
    }
    shard.items.push({
      identityKey: identityKey,
      contentHash: String(contentHash || ""),
      target: String(target || ""),
      action: String(action || ""),
      semanticHash: String(value.semanticHash || ""),
      resourceKey: String(value.resourceKey || value.date || ""),
      logicalOperationId: String(value.logicalOperationId || ""),
      requestId: String(value.requestId || ""),
      batchRequestId: String(value.batchRequestId || ""),
      batchOperationId: String(value.batchOperationId || ""),
      resultVersion: String(value.resultVersion || ""),
      savedAtKST: nowKSTText(),
      savedAtMs: Date.now()
    });
    shard.items = normalizePensionOperationIdentityLedger(shard.items);
  });
}

function pensionOperationIdentityContextFileChanges(context) {
  const changes = [];
  Object.keys(context && context.shards || {}).sort().forEach(function(path) {
    const shard = context.shards[path];
    if (canonicalPensionBatchJson(shard.initial) !== canonicalPensionBatchJson(shard.items)) {
      changes.push({ path: path, data: shard.items });
    }
  });
  return changes;
}

// terminal stale Single은 Script Properties receipt가 GC된 뒤에도 같은 request/logical identity가
// 다른 내용으로 부활하지 않도록 exact identity ledger에 metadata-only tombstone을 남긴다.
function pensionSingleRequestIdFromKey(requestKey) {
  const text = String(requestKey || "");
  const separator = text.indexOf("|");
  return separator >= 0 ? text.slice(separator + 1) : "";
}

function pensionSingleDurableIdentityStatus(match) {
  return String(match && match.action || "") === "terminal_stale" || String(match && match.resultVersion || "") === "terminal-stale"
    ? "terminal_stale"
    : "completed";
}

function rememberPensionSingleTerminalIdentityState(requestKey, requestHash, target, intent) {
  const value = intent || {};
  const requestId = String(value.requestId || pensionSingleRequestIdFromKey(requestKey));
  const logicalOperationId = String(value.logicalOperationId || "");
  if (!requestId || !String(requestHash || "") || !String(target || "")) return { stored: false, status: "", match: null };

  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const head = getGithubBranchHeadSha();
    if (!head) throw new Error("Pension terminal identity 기준 커밋을 확인하지 못했습니다.");
    const context = loadPensionOperationIdentityContext(target, {
      requestId: requestId,
      logicalOperationId: logicalOperationId
    }, head);
    const existing = assertPensionOperationIdentityCompatible(context, requestHash);
    if (existing) {
      if (!pensionOperationIdentityContextMissingKeys(context).length) {
        return { stored: true, status: pensionSingleDurableIdentityStatus(existing), match: existing };
      }
      const existingEntry = makePensionOperationLedgerEntry(target, String(existing.action || "duplicate"), {
        resourceKey: String(existing.resourceKey || ""), requestId: requestId, logicalOperationId: logicalOperationId, resultVersion: String(existing.resultVersion || "")
      });
      existingEntry.semanticHash = String(existing.semanticHash || existingEntry.semanticHash || "");
      existingEntry.resourceKey = String(existing.resourceKey || existingEntry.resourceKey || "");
      appendPensionOperationIdentityEntries(context, target, String(existing.action || "duplicate"), requestHash, existingEntry);
      const existingChanges = pensionOperationIdentityContextFileChanges(context);
      if (!existingChanges.length || tryDurableGithubJsonBatchWrite(
        head, existingChanges, "Backfill pension terminal identity " + target + " [" + requestId + "]", attempt
      )) return { stored: true, status: pensionSingleDurableIdentityStatus(existing), match: existing };
      continue;
    }

    const entry = makePensionOperationLedgerEntry(target, "terminal_stale", {
      requestId: requestId,
      logicalOperationId: logicalOperationId,
      resultVersion: "terminal-stale"
    });
    appendPensionOperationIdentityEntries(context, target, "terminal_stale", requestHash, entry);
    const changes = pensionOperationIdentityContextFileChanges(context);
    if (!changes.length) return { stored: true, status: "terminal_stale", match: entry };
    if (tryDurableGithubJsonBatchWrite(
      head, changes, "Record pension terminal identity " + target + " [" + requestId + "]", attempt
    )) return { stored: true, status: "terminal_stale", match: entry };
  }
  return { stored: false, status: "", match: null };
}


// batchRequestId 자체도 operationId와 별개로 durable하게 보존한다.
// receipt GC 뒤 operationId를 모두 바꿔 같은 batchRequestId를 재사용하는 우회까지 차단한다.
function pensionBatchRequestIdentityShardPath(requestId) {
  const hash = sha256HexText(String(requestId || ""));
  return PENSION_BATCH_REQUEST_IDENTITY_DIR + "/" + hash.slice(0, PENSION_BATCH_REQUEST_IDENTITY_SHARD_PREFIX_LENGTH) + ".json";
}

function normalizePensionBatchRequestIdentityLedger(data) {
  const items = storedDurableLedgerItems(data, "requests", "Pension batch request identity ledger");
  const seenRequestIds = {};
  return items.map(function(item, index) {
    const label = "Pension batch request identity ledger " + (index + 1) + "번 row";
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(label + " 형식이 올바르지 않습니다. 저장을 중단했습니다.");
    }
    const requestId = assertStoredDurableStringField(item, "requestId", label, true, false);
    if (seenRequestIds[requestId]) throw new Error(label + " requestId가 중복됩니다. 저장을 중단했습니다.");
    seenRequestIds[requestId] = true;
    const operationsHash = assertStoredDurableHash(assertStoredDurableStringField(item, "operationsHash", label, true, false), label + " operationsHash", [64]);
    const status = item.status == null ? "completed" : assertStoredDurableStringField(item, "status", label, false, false);
    if (status !== "completed" && status !== "terminal_stale") {
      throw new Error(label + " status가 올바르지 않습니다. 저장을 중단했습니다.");
    }
    ["commitSha", "reason", "savedAtKST"].forEach(function(field) {
      if (item[field] != null) assertStoredDurableStringField(item, field, label, false, true);
    });
    return {
      requestId: requestId,
      operationsHash: operationsHash,
      status: status,
      commitSha: String(item.commitSha || ""),
      reason: String(item.reason || ""),
      savedAtKST: String(item.savedAtKST || ""),
      savedAtMs: storedDurableSavedAtMs(item.savedAtMs, label)
    };
  }).sort(function(a, b) {
    return Number(a.savedAtMs || 0) - Number(b.savedAtMs || 0) || String(a.requestId || "").localeCompare(String(b.requestId || ""));
  });
}

function loadPensionBatchRequestIdentityContext(requestId, ref, requestCache) {
  const path = pensionBatchRequestIdentityShardPath(requestId);
  const current = requestCache
    ? readGithubJsonOptionalRequestCached(path, ref, [], requestCache)
    : readGithubJsonOptional(path, ref, []);
  const items = normalizePensionBatchRequestIdentityLedger(current.data);
  const match = items.find(function(item) { return String(item.requestId || "") === String(requestId || ""); }) || null;
  return { path: path, initial: items.slice(), items: items, match: match };
}

function assertPensionBatchRequestIdentityCompatible(context, operationsHash) {
  const match = context && context.match;
  if (!match) return null;
  if (String(match.operationsHash || "") !== String(operationsHash || "")) {
    throw new Error("동일한 batchRequestId가 다른 작업 내용에 이미 사용되었습니다. 작업 모음을 새로 구성해 다시 시도해주세요.");
  }
  return match;
}

function appendPensionBatchRequestIdentity(context, requestId, operationsHash, status, info) {
  const existing = assertPensionBatchRequestIdentityCompatible(context, operationsHash);
  if (existing) return existing;
  const value = info || {};
  context.items.push({
    requestId: String(requestId || ""),
    operationsHash: String(operationsHash || ""),
    status: String(status || "completed"),
    commitSha: String(value.commitSha || ""),
    reason: String(value.reason || ""),
    savedAtKST: nowKSTText(),
    savedAtMs: Date.now()
  });
  context.items = normalizePensionBatchRequestIdentityLedger(context.items);
  context.match = context.items.find(function(item) { return String(item.requestId || "") === String(requestId || ""); }) || null;
  return context.match;
}

function pensionBatchRequestIdentityFileChange(context) {
  if (!context) return null;
  if (canonicalPensionBatchJson(context.initial) === canonicalPensionBatchJson(context.items)) return null;
  return { path: context.path, data: context.items };
}

function findPensionBatchRequestIdentity(requestId, operationsHash) {
  const head = getGithubBranchHeadSha();
  if (!head) throw new Error("Pension Batch identity 기준 커밋을 확인하지 못했습니다.");
  const context = loadPensionBatchRequestIdentityContext(requestId, head);
  return assertPensionBatchRequestIdentityCompatible(context, operationsHash);
}

function rememberPensionBatchRequestDurableIdentityState(requestId, operationsHash, status, info) {
  if (!String(requestId || "") || !String(operationsHash || "")) return { stored: false, status: "", match: null };
  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const head = getGithubBranchHeadSha();
    if (!head) throw new Error("Pension Batch durable identity 기준 커밋을 확인하지 못했습니다.");
    const context = loadPensionBatchRequestIdentityContext(requestId, head);
    const existing = assertPensionBatchRequestIdentityCompatible(context, operationsHash);
    if (existing) return { stored: true, status: String(existing.status || "completed"), match: existing };
    const created = appendPensionBatchRequestIdentity(context, requestId, operationsHash, status || "completed", info || {});
    const change = pensionBatchRequestIdentityFileChange(context);
    if (!change) return { stored: true, status: String(created && created.status || status || "completed"), match: created };
    if (tryDurableGithubJsonBatchWrite(
      head, [change], "Record pension batch request identity [" + requestId + "]", attempt
    )) return { stored: true, status: String(created && created.status || status || "completed"), match: created };
  }
  return { stored: false, status: "", match: null };
}


function rememberPensionBatchRequestTerminalIdentityState(requestId, operationsHash, result) {
  return rememberPensionBatchRequestDurableIdentityState(requestId, operationsHash, "terminal_stale", {
    commitSha: String(result && result.commitSha || ""),
    reason: String(result && (result.reason || result.action) || "terminal_stale")
  });
}


function pensionSingleDurableIdentityResult(requestKey, requestHash, target, match, identityMeta) {
  if (identityMeta && (String(identityMeta.requestId || "") || String(identityMeta.logicalOperationId || ""))) {
    const completedIdentity = ensurePensionSingleDurableIdentityComplete(target, identityMeta, requestHash);
    if (!completedIdentity || completedIdentity.stored !== true) {
      throw new Error("Pension exact identity의 누락 key를 안전하게 backfill하지 못했습니다. 중복 요청을 확정하지 않았습니다.");
    }
    match = completedIdentity.match || match;
  }
  const terminalStale = pensionSingleDurableIdentityStatus(match) === "terminal_stale";
  if (terminalStale) {
    finishPensionSingleTerminalRequest(requestKey, requestHash, target, String(match && (match.reason || match.action) || "terminal_stale"));
  } else {
    finishPensionSingleRequest(requestKey, requestHash, target);
  }
  return {
    ok: true,
    target: target,
    action: terminalStale ? "stale_retry_ignored" : "duplicate_ignored",
    duplicate: true,
    stale: terminalStale,
    completed: !terminalStale,
    resultVersion: String(match && match.resultVersion || ""),
    message: terminalStale
      ? "GitHub identity ledger에서 terminal stale로 종료된 동일 요청을 확인했습니다. 과거 mutation은 다시 적용하지 않았습니다."
      : "GitHub identity ledger에서 이미 완료된 동일 요청을 확인했습니다. 중복 mutation은 만들지 않았습니다."
  };
}

// cash 전용 legacy helper 이름은 테스트/문서 호환을 위해 generic ledger wrapper로 유지한다.
function pensionCashOperationSemanticHash(action, fields) {
  return pensionOperationSemanticHash("cashSnapshot", action, fields);
}
function findPensionCashLedgerMatch(items, action, fields) {
  return findPensionLedgerMatchInItems(items, pensionCashOperationSemanticHash(action, fields));
}
function appendPensionCashLedgerEntry(items, entry) { return appendPensionOperationLedgerEntry(items, entry); }
function makePensionCashLedgerEntry(action, fields) { return makePensionOperationLedgerEntry("cashSnapshot", action, fields); }

/* --- 07D. Duplicate Confirmation ------------------------------------------ */

function pensionConfirmationCandidateHash(candidate) {
  return sha256HexText(canonicalPensionBatchJson(candidate || {}));
}

function rememberPensionConfirmation(scope, identity, requestHash, dependencyHash, candidate) {
  const token = "pconf-" + Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();
  const savedAtMs = Date.now();
  const key = requestDirectPropertyKey("PENSION_CONFIRM_", token);
  const value = {
    token: token,
    scope: String(scope || ""),
    identity: String(identity || ""),
    requestHash: String(requestHash || ""),
    dependencyHash: String(dependencyHash || ""),
    mutationEpoch: getPensionMutationEpoch(),
    candidateHash: pensionConfirmationCandidateHash(candidate),
    savedAtMs: savedAtMs,
    expiresAtMs: savedAtMs + PENSION_CONFIRMATION_TTL_MS
  };
  if (!trySetDirectRequestPropertyFastAfterBoundary("PENSION_CONFIRM_", key, value)) {
    setDirectRequestProperty(props, "PENSION_CONFIRM_", key, value);
  }
  return token;
}

function findPensionConfirmation(token) {
  if (!token) return null;
  const props = PropertiesService.getScriptProperties();
  return parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("PENSION_CONFIRM_", token)));
}

function clearPensionConfirmation(token) {
  if (!token) return;
  const props = PropertiesService.getScriptProperties();
  deleteScriptPropertyWithReadback(props, requestDirectPropertyKey("PENSION_CONFIRM_", token));
}

function validatePensionConfirmation(body, scope, identity, requestHash, dependencyHash, candidate) {
  const decision = String(body && body.confirmationDecision || "").trim();
  if (!decision) return { provided: false, valid: false, decision: "" };
  if (decision !== "existing" && decision !== "distinct") {
    return { provided: true, valid: false, error: "중복 확인 결정값이 올바르지 않습니다." };
  }
  const token = String(body && body.confirmationToken || "").trim();
  const saved = findPensionConfirmation(token);
  const now = Date.now();
  const valid = !!saved &&
    String(saved.scope || "") === String(scope || "") &&
    String(saved.identity || "") === String(identity || "") &&
    String(saved.requestHash || "") === String(requestHash || "") &&
    Number(saved.expiresAtMs || 0) >= now &&
    Number(saved.mutationEpoch || 0) === getPensionMutationEpoch() &&
    String(saved.dependencyHash || "") === String(dependencyHash || "") &&
    String(saved.candidateHash || "") === pensionConfirmationCandidateHash(candidate);
  if (!valid) {
    return { provided: true, valid: false, token: token, error: "중복 확인 이후 데이터가 변경되었습니다. 최신 상태에서 다시 확인해주세요." };
  }
  return { provided: true, valid: true, token: token, decision: decision };
}

function pensionDuplicateCandidateDescriptor(source, value) {
  if (source === "ledger" || source === "cashLedger" || source === "identity") {
    return {
      source: source,
      action: String(value && value.action || ""), date: String(value && value.date || ""),
      semanticHash: String(value && value.semanticHash || ""),
      logicalOperationId: String(value && value.logicalOperationId || ""),
      resultVersion: String(value && value.resultVersion || "")
    };
  }
  const item = value || {};
  return {
    source: "item",
    logicalOperationId: String(item.logicalOperationId || item.id || item.requestId || ""),
    id: String(item.id || item.requestId || ""), date: String(item.date || item.tradeDate || ""),
    semanticHash: sha256HexText(canonicalPensionBatchJson(item))
  };
}

function pensionDuplicateConfirmationResult(target, existing, token, source) {
  return {
    ok: true,
    target: target,
    action: "duplicate_confirmation_required",
    requiresDuplicateConfirmation: true,
    confirmationToken: String(token || ""),
    duplicateCandidate: (source === "ledger" || source === "cashLedger" || source === "identity") ? null : (existing || null),
    duplicateCandidateSource: String(source || "item"),
    existingLogicalOperationId: String(existing && (existing.logicalOperationId || existing.id || existing.requestId) || ""),
    message: "동일한 logical operation 후보가 있습니다. 기존 처리로 볼지 실제 별도 작업인지 서버 상태를 다시 확인한 뒤 선택해주세요."
  };
}

function resolvePensionSingleConfirmation(body, args) {
  if (args.identityCheck && args.identityCheck.hasIdentity) return { proceed: true };
  const candidate = args.candidate || null;
  const descriptor = candidate ? pensionDuplicateCandidateDescriptor(candidate.source, candidate.value) : null;
  const dependencyHash = String(args.dependencyHash || "");
  const confirmation = validatePensionConfirmation(body, "single", args.requestKey, args.requestHash, dependencyHash, descriptor);
  if (confirmation.provided) {
    if (!candidate || !confirmation.valid) {
      return { proceed: false, result: { ok: false, action: "confirmation_stale", stale: true, error: confirmation.error || "중복 확인 상태가 만료되었습니다. 최신 상태에서 다시 시도해주세요." } };
    }
    if (confirmation.decision === "existing") {
      clearPensionConfirmation(confirmation.token);
      return { proceed: false, identityCompletionRequired: true, result: { ok: true, target: args.target, action: "duplicate_user_confirmed", duplicate: true, stale: false, message: "서버에서 기존 logical operation이 여전히 존재함을 확인했습니다. 새 mutation은 만들지 않았습니다." } };
    }
    clearPensionConfirmation(confirmation.token);
    return { proceed: true, distinctConfirmed: true };
  }
  if (!candidate) return { proceed: true };
  const candidateLogicalId = String(candidate.value && candidate.value.logicalOperationId || "");
  if (candidateLogicalId && candidateLogicalId === String(args.logicalOperationId || "")) {
    return { proceed: false, identityCompletionRequired: true, result: { ok: true, target: args.target, action: "duplicate_ignored", duplicate: true, message: "동일 logical operation token이 이미 반영되어 중복 mutation을 만들지 않았습니다." } };
  }
  const token = rememberPensionConfirmation("single", args.requestKey, args.requestHash, dependencyHash, descriptor);
  return { proceed: false, result: pensionDuplicateConfirmationResult(args.target, candidate.value, token, candidate.source) };
}

/* --- 07E. Semantic Duplicate / Stale Retry Resolution --------------------- */

// 다른 탭/기기에서 새 requestId가 생성된 경우 동일 내용만으로 retry와 실제 별도 거래를
// 구분할 수 없다. 따라서 semantic match를 자동 dedupe 근거로 사용하지 않고,
// mutation 없이 후보만 반환해 사용자가 명시적으로 별도 거래 여부를 결정하게 한다.
function pensionSemanticMatchesExisting(existing, target, fields) {
  if (!existing) return false;
  if (target === "cashSnapshot") {
    return String(existing.date || "") === String(fields.date || "") &&
      Number(existing.valuation) === Number(fields.valuation) &&
      Number(existing.costBasis) === Number(fields.costBasis) &&
      String(existing.memo || "") === String(fields.memo || "");
  }
  if (target === "contribution") {
    return String(existing.date || "") === String(fields.date || "") &&
      Number(existing.amount) === Number(fields.amount) &&
      String(existing.memo || "") === String(fields.memo || "");
  }
  if (target === "etfTrade") {
    if (String(existing.tradeDate || "") !== String(fields.tradeDate || "")) return false;
    if (String(existing.ticker || "") !== String(fields.ticker || "")) return false;
    if (Number(existing.qty) !== Number(fields.qty)) return false;
    if (Number(existing.amount) !== Number(fields.amount)) return false;
    return !fields.memo || String(existing.memo || "") === String(fields.memo || "");
  }
  return false;
}

function findPensionSemanticExisting(items, target, fields, usedIndexes) {
  const used = usedIndexes || {};
  for (let index = 0; index < (items || []).length; index += 1) {
    if (used[index]) continue;
    const item = items[index];
    if (!pensionSemanticMatchesExisting(item, target, fields)) continue;
    return { item: item, index: index };
  }
  return null;
}

// 단건 mutation이 확정 pre-commit 실패한 경우 intent를 지우지 않는다.
// 예약 epoch만 되돌리고 당시 dependency/epoch를 retryable tombstone으로 보존한다.
function markPensionSingleIntentRetryableIfTargetUnchanged(context, target, baseSha) {
  if (!context || !context.key) return false;
  try {
    const after = readPensionTarget(target);
    if (String(after.sha || "") !== String(baseSha || "")) return false;
    const dependencyHash = pensionSingleDependencyHash(context.action || "upsert", target, null, context.extraDependencyPaths || []);
    if (context.dependencyHash && String(dependencyHash || "") !== String(context.dependencyHash || "")) return false;
    return transitionPensionSingleIntentToRetryable(context, target, baseSha, dependencyHash);
  } catch (_) {
    return false;
  }
}

// 실제 business JSON 변경이 없는 terminal success도 request/logical identity 자체는 완료된 작업이다.
// delete_already_absent, 기존 처리 확인, pre-v12/current-item duplicate 같은 no-op 성공도
// durable identity shard에 metadata-only commit으로 남겨 receipt GC 이후 다른 내용 재사용을 차단한다.
function completePensionSingleNoMutationIdentity(args, successResult) {
  const context = args || {};
  const target = String(context.target || "");
  const action = String(context.action || "");
  const requestKey = String(context.requestKey || "");
  const requestHash = String(context.requestHash || "");
  const logicalOperationId = String(context.logicalOperationId || "");
  const requestId = String(context.requestId || "");
  const currentSha = String(context.currentSha || "");
  const dependencyHash = String(context.dependencyHash || "");
  const extraDependencyPaths = Array.isArray(context.extraDependencyPaths) ? context.extraDependencyPaths : [];
  const identityContext = context.identityContext;
  if (!identityContext || !requestKey || !requestHash || !target || !action) {
    throw new Error("Pension no-op identity 완료 컨텍스트가 올바르지 않습니다.");
  }

  const existing = assertPensionOperationIdentityCompatible(identityContext, requestHash);
  if (existing) {
    const completedIdentity = ensurePensionSingleDurableIdentityComplete(target, { requestId: requestId, logicalOperationId: logicalOperationId }, requestHash);
    if (!completedIdentity || completedIdentity.stored !== true) {
      throw new Error("Pension no-op exact identity의 누락 key를 안전하게 backfill하지 못했습니다.");
    }
    finishPensionSingleRequest(requestKey, requestHash, target);
    return successResult;
  }

  const hadIdentity = context.identityCheck && context.identityCheck.hasIdentity === true;
  if (!hadIdentity) beginPensionSingleRequest(requestKey, requestHash, target, currentSha, action, dependencyHash, { requestId: requestId, logicalOperationId: logicalOperationId });
  const activeIntent = findPensionRequestIntent(requestKey) || {};
  const requestContext = {
    key: requestKey, hash: requestHash, target: target, action: action,
    mutationEpoch: Number(activeIntent.mutationEpoch || 0),
    dependencyHash: String(activeIntent.dependencyHash || dependencyHash),
    baseCommitSha: String(context.baseCommitSha || ""),
    extraDependencyPaths: extraDependencyPaths,
    requestId: requestId, logicalOperationId: logicalOperationId
  };

  const entryFields = Object.assign({}, context.ledgerFields || {}, {
    logicalOperationId: logicalOperationId,
    requestId: requestId,
    resultVersion: String(context.resultVersion || "noop")
  });
  const identityEntry = makePensionOperationLedgerEntry(target, action, entryFields);
  appendPensionOperationIdentityEntries(identityContext, target, action, requestHash, identityEntry);
  const identityFileChanges = pensionOperationIdentityContextFileChanges(identityContext);

  const commitBase = resolvePensionSingleCommitBase(
    String(context.baseCommitSha || ""),
    action,
    target,
    requestContext.dependencyHash,
    extraDependencyPaths
  );
  if (!commitBase.ok) {
    return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
      ok: true, target: target, action: "stale_view_rejected", stale: true, error: commitBase.error
    }, {
      requestId: requestId, logicalOperationId: logicalOperationId, action: action
    }, requestContext.mutationEpoch).result;
  }

  try {
    if (identityFileChanges.length) {
      writeGithubJsonBatch(
        commitBase.baseCommitSha,
        identityFileChanges,
        "Record pension terminal identity " + target + " [" + requestId + "]"
      );
    }
  } catch (err) {
    markPensionSingleIntentRetryableIfTargetUnchanged(requestContext, target, currentSha);
    throw err;
  }

  finishPensionSingleRequest(requestKey, requestHash, target);
  return successResult;
}

function assertPensionLogicalOperationId(id) {
  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(String(id || ""))) {
    throw new Error("logicalOperationId 형식이 올바르지 않습니다.");
  }
}

function pensionSingleDependencyPaths(action, target, extraPaths) {
  const paths = {};
  paths[getDataPath(target)] = true;
  (Array.isArray(extraPaths) ? extraPaths : []).forEach(function(path) { if (path) paths[String(path)] = true; });
  if (target === "cashSnapshot" && action === "upsert") {
    paths[getDataPath("contribution")] = true;
    paths[getDataPath("etfTrade")] = true;
  }
  if ((target === "contribution" || target === "etfTrade") && action === "delete") {
    paths[getDataPath("cashSnapshot")] = true;
  }
  if (target === "etfTrade" && action === "upsert") {
    paths[getDataPath("cashSnapshot")] = true;
    paths[getDataPath("contribution")] = true;
    paths["data/prices.json"] = true;
    paths["data/portfolio.json"] = true;
  }
  return Object.keys(paths).sort();
}

function pensionSingleDependencyHash(action, target, ref, extraPaths, requestCache) {
  const entries = pensionSingleDependencyPaths(action, target, extraPaths).map(function(path) {
    const current = (path.indexOf(PENSION_OPERATION_LEDGER_DIR + "/") === 0 || path.indexOf(PENSION_OPERATION_IDENTITY_DIR + "/") === 0)
      ? readGithubJsonOptionalRequestCached(path, ref, [], requestCache)
      : readGithubJsonRequestCached(path, ref, requestCache);
    return { path: path, sha: String(current.sha || "") };
  });
  return sha256HexText(canonicalPensionBatchJson(entries));
}


function resolvePensionSingleCommitBase(baseCommitSha, action, target, dependencyHash, extraDependencyPaths) {
  const latestHead = getGithubBranchHeadSha();
  if (!latestHead) return { ok: false, error: "GitHub 최신 커밋을 확인하지 못했습니다." };
  if (String(latestHead) === String(baseCommitSha || "")) return { ok: true, baseCommitSha: latestHead };
  const latestDependencyHash = pensionSingleDependencyHash(action, target, latestHead, extraDependencyPaths || []);
  if (String(latestDependencyHash || "") !== String(dependencyHash || "")) {
    return { ok: false, stale: true, error: "저장 준비 후 의존 데이터가 변경되었습니다. 최신 데이터를 새로고침한 뒤 다시 시도해주세요." };
  }
  return { ok: true, baseCommitSha: latestHead };
}

function pensionSingleMaintenanceIntentKey(body, target, action) {
  const value = body || {};
  let identity = "";
  let keyTarget = String(target || "");
  if (String(action || "") === "delete") {
    identity = String(value.deleteRequestId || "").trim();
    keyTarget += "-delete";
  } else if (String(target || "") === "cashSnapshot") {
    identity = String(value.requestId || "").trim();
  } else {
    identity = String(value.id || "").trim();
  }
  return identity ? requestDirectPropertyKey("PENSION_REQ_I_", pensionSingleRequestKey(keyTarget, identity)) : "";
}

/* --- 07F. Single Mutation Entry / Upsert / Delete ------------------------- */

// 단건과 Batch가 같은 pension JSON 묶음을 읽고 쓰므로 같은 ScriptLock으로 직렬화한다.
function handlePensionDataSerialized(body) {
  const timing = createPensionTimingTrace("single", body);
  const lock = LockService.getScriptLock();
  let stageStartedAtMs = Date.now();
  const locked = lock.tryLock(30000);
  recordPensionTimingStage(timing, "lockWait", stageStartedAtMs);
  if (!locked) {
    return attachPensionTiming(timing, { ok: false, error: "다른 퇴직연금 저장/삭제 요청이 처리 중입니다. 잠시 후 다시 시도해주세요." }, "lock_busy");
  }
  try {
    const result = handlePensionData(body, timing);
    return attachPensionTiming(timing, result, result && result.action || (result && result.ok ? "ok" : "error"));
  } catch (err) {
    try { err.pensionTiming = buildPensionTimingSnapshot(timing, "error"); } catch (_) {}
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// cashSnapshot/contribution/etfTrade 단건 upsert·delete 요청을 처리한다.
function handlePensionData(body, timing) {
  const target = getTarget(body);
  const filePath = getDataPath(target);
  const action = String(body.action || "").trim();
  if (action !== "upsert" && action !== "delete") {
    return { ok: false, error: "지원하지 않는 pension action입니다: " + (action || "(empty)") };
  }

  let stageStartedAtMs = Date.now();
  prepareDirectRequestMaintenanceBoundary("PENSION_REQ_I_", pensionSingleMaintenanceIntentKey(body, target, action));
  recordPensionTimingStage(timing, "maintenanceBoundary", stageStartedAtMs);

  stageStartedAtMs = Date.now();
  const baseCommitSha = getGithubBranchHeadSha();
  recordPensionTimingStage(timing, "baseHeadRead", stageStartedAtMs);
  if (!baseCommitSha) return { ok: false, error: "GitHub 기준 커밋을 확인하지 못했습니다." };
  // 같은 immutable base commit SHA 안에서 이미 읽은 JSON만 현재 요청 범위에서 재사용한다.
  // 최신 HEAD 재검증이나 commit preflight는 별도 fresh read 경로를 그대로 유지한다.
  const requestCache = {};
  stageStartedAtMs = Date.now();
  const current = readPensionTarget(target, baseCommitSha, requestCache);
  recordPensionTimingStage(timing, "targetSnapshotRead", stageStartedAtMs);
  const context = {
    target: target,
    filePath: filePath,
    baseCommitSha: baseCommitSha,
    current: current,
    requestCache: requestCache,
    timing: timing,
    nowKST: nowKSTText()
  };
  context.nowDate = context.nowKST.slice(0, 10);

  return action === "delete"
    ? handlePensionSingleDelete(body, context)
    : handlePensionSingleUpsert(body, context);
}

function handlePensionSingleDelete(body, context) {
  const target = context.target;
  const filePath = context.filePath;
  const baseCommitSha = context.baseCommitSha;
  const current = context.current;
  const requestCache = context.requestCache || {};
  const timing = context.timing;
  let items = current.items;
  const isCash = target === "cashSnapshot";
  const resourceKey = String(isCash ? body.date : body.id || "").trim();
  const deleteRequestId = String(body.deleteRequestId || "").trim();
  const logicalOperationId = String(body.logicalOperationId || deleteRequestId || "").trim();
  const expectedVersion = String(body.expectedVersion || "").trim();
  if (isCash && !isValidDateText(resourceKey)) return { ok: false, error: "date must be YYYY-MM-DD" };
  if (!resourceKey) return { ok: false, error: target === "etfTrade" ? "trade id is required" : (target === "contribution" ? "contribution id is required" : "cashSnapshot date is required") };
  if (!deleteRequestId) return { ok: false, error: "deleteRequestId가 필요합니다. 최신 화면에서 다시 시도해주세요." };
  if (!logicalOperationId) return { ok: false, error: "logicalOperationId가 필요합니다. 최신 화면에서 다시 시도해주세요." };
  if (isCash && !expectedVersion) return { ok: false, error: "cashSnapshot expectedVersion이 필요합니다. 최신 화면에서 다시 시도해주세요." };
  assertPensionRequestId(deleteRequestId);
  assertPensionLogicalOperationId(logicalOperationId);

  const ledgerFields = { resourceKey: resourceKey, key: resourceKey, date: isCash ? resourceKey : "" };
  let stageStartedAtMs = Date.now();
  primePensionDeleteReadCache(target, ledgerFields, { logicalOperationId: logicalOperationId, requestId: deleteRequestId }, baseCommitSha, requestCache);
  recordPensionTimingStage(timing, "deleteDependencyPreflight", stageStartedAtMs);
  stageStartedAtMs = Date.now();
  const ledgerContext = loadPensionOperationLedgerContext(target, "delete", ledgerFields, baseCommitSha, requestCache);
  recordPensionTimingStage(timing, "semanticLedgerRead", stageStartedAtMs);
  stageStartedAtMs = Date.now();
  const identityContext = loadPensionOperationIdentityContext(target, { logicalOperationId: logicalOperationId, requestId: deleteRequestId }, baseCommitSha, requestCache);
  recordPensionTimingStage(timing, "exactIdentityLedgerRead", stageStartedAtMs);
  const extraDependencyPaths = [ledgerContext.path]
    .concat(pensionOperationIdentityContextPaths(identityContext))
    .concat(ledgerContext.legacyPath ? [ledgerContext.legacyPath] : []);
  stageStartedAtMs = Date.now();
  const dependencyHash = pensionSingleDependencyHash("delete", target, baseCommitSha, extraDependencyPaths, requestCache);
  recordPensionTimingStage(timing, "dependencyFingerprint", stageStartedAtMs);
  const requestKey = pensionSingleRequestKey(target + "-delete", deleteRequestId);
  const requestHash = pensionSingleRequestHash({
    target: target, action: "delete", resourceKey: resourceKey,
    expectedVersion: expectedVersion, logicalOperationId: logicalOperationId
  });
  stageStartedAtMs = Date.now();
  const identityCheck = inspectPensionSingleRequestIdentity(requestKey, requestHash, target, current.sha, "delete", dependencyHash, { ledgerContext: ledgerContext, identityContext: identityContext, logicalOperationId: logicalOperationId, requestId: deleteRequestId, requestHash: requestHash, ref: baseCommitSha });
  recordPensionTimingStage(timing, "requestIdentityResolve", stageStartedAtMs);
  if (identityCheck.result) return identityCheck.result;
  const durableIdentityMatch = assertPensionOperationIdentityCompatible(identityContext, requestHash);
  if (durableIdentityMatch) return pensionSingleDurableIdentityResult(requestKey, requestHash, target, durableIdentityMatch, { requestId: deleteRequestId, logicalOperationId: logicalOperationId });

  const exactLedgerMatch = findPensionLedgerExactIdentity(ledgerContext, target, {
    logicalOperationId: logicalOperationId, requestId: deleteRequestId
  }, baseCommitSha, requestCache);
  stageStartedAtMs = Date.now();
  const confirmationResolution = resolvePensionSingleConfirmation(body, {
    identityCheck: identityCheck, requestKey: requestKey, requestHash: requestHash, target: target,
    logicalOperationId: logicalOperationId, dependencyHash: dependencyHash,
    candidate: exactLedgerMatch ? { source: "ledger", value: exactLedgerMatch } :
      (ledgerContext.match ? { source: "ledger", value: ledgerContext.match } : null)
  });
  recordPensionTimingStage(timing, "confirmationCheck", stageStartedAtMs);
  if (!confirmationResolution.proceed) {
    if (confirmationResolution.identityCompletionRequired) {
      return completePensionSingleNoMutationIdentity({
        target: target, action: "delete", requestKey: requestKey, requestHash: requestHash,
        logicalOperationId: logicalOperationId, requestId: deleteRequestId, currentSha: current.sha,
        dependencyHash: dependencyHash, extraDependencyPaths: extraDependencyPaths,
        identityContext: identityContext, identityCheck: identityCheck, baseCommitSha: baseCommitSha,
        ledgerFields: ledgerFields,
        resultVersion: String(confirmationResolution.result && confirmationResolution.result.action || "duplicate") + ":" + resourceKey
      }, confirmationResolution.result);
    }
    return confirmationResolution.result;
  }

  let targetItem = null;
  if (isCash) targetItem = items.find(function(item) { return item && String(item.date || "") === resourceKey; }) || null;
  else targetItem = items.find(function(item) { return item && String(item.id || "") === resourceKey; }) || null;

  if (!targetItem) {
    return completePensionSingleNoMutationIdentity({
      target: target, action: "delete", requestKey: requestKey, requestHash: requestHash,
      logicalOperationId: logicalOperationId, requestId: deleteRequestId, currentSha: current.sha,
      dependencyHash: dependencyHash, extraDependencyPaths: extraDependencyPaths,
      identityContext: identityContext, identityCheck: identityCheck, baseCommitSha: baseCommitSha,
      ledgerFields: ledgerFields, resultVersion: "absent:" + resourceKey
    }, { ok: true, target: target, action: "delete_already_absent", duplicate: true, deletedCount: 0, key: resourceKey });
  }
  if (isCash && pensionCashSnapshotVersion(targetItem) !== expectedVersion) {
    const staleResult = { ok: true, target: target, action: "stale_view_rejected", stale: true, error: "삭제하려던 현금성자산 기록이 이후 변경되었습니다. 최신 데이터를 새로고침한 뒤 다시 선택해주세요." };
    const terminalEpoch = identityCheck.hasIdentity === true
      ? Number((findPensionRequestIntent(requestKey) || {}).mutationEpoch || 0)
      : beginPensionSingleTerminalPending(requestKey, requestHash, target, current.sha, dependencyHash, "stale_view_rejected", { requestId: deleteRequestId, logicalOperationId: logicalOperationId, action: "delete" });
    if (identityCheck.hasIdentity === true) {
      markPensionSingleIntentTerminalPending(requestKey, requestHash, target, "stale_view_rejected", { requestId: deleteRequestId, logicalOperationId: logicalOperationId, action: "delete" });
    }
    return finalizePensionSingleTerminalStale(requestKey, requestHash, target, staleResult, {
      requestId: deleteRequestId, logicalOperationId: logicalOperationId, action: "delete"
    }, terminalEpoch).result;
  }
  if (target === "etfTrade") {
    const linkedSnapshot = findLinkedCashSnapshotFromGithub(targetItem, "etfTrade", baseCommitSha, requestCache);
    if (linkedSnapshot) {
      return { ok: false, error: linkedSnapshot.date + " 현금성자산 기록이 이 추가 매수를 반영하고 있습니다. 해당 날짜 현금성자산을 먼저 삭제해주세요." };
    }
  }
  if (target === "contribution") {
    const linkedSnapshot = findLinkedCashSnapshotFromGithub(targetItem, "contribution", baseCommitSha, requestCache);
    if (linkedSnapshot) {
      return { ok: false, error: linkedSnapshot.date + " 현금성자산 기록이 이 기업적립금을 반영하고 있습니다. 해당 날짜 현금성자산을 먼저 삭제해주세요." };
    }
  }

  stageStartedAtMs = Date.now();
  if (!identityCheck.hasIdentity) beginPensionSingleRequest(requestKey, requestHash, target, current.sha, "delete", dependencyHash, { requestId: deleteRequestId, logicalOperationId: logicalOperationId });
  const activeIntent = findPensionRequestIntent(requestKey) || {};
  recordPensionTimingStage(timing, "intentEpochPrepare", stageStartedAtMs);
  const requestContext = {
    key: requestKey, hash: requestHash, target: target, action: "delete",
    mutationEpoch: Number(activeIntent.mutationEpoch || 0), dependencyHash: String(activeIntent.dependencyHash || dependencyHash),
    baseCommitSha: baseCommitSha, extraDependencyPaths: extraDependencyPaths,
    requestId: deleteRequestId, logicalOperationId: logicalOperationId
  };

  items = isCash
    ? items.filter(function(item) { return String(item.date || "") !== resourceKey; })
    : items.filter(function(item) { return String(item.id || "") !== resourceKey; });

  const ledgerEntry = makePensionOperationLedgerEntry(target, "delete", {
    resourceKey: resourceKey, date: isCash ? resourceKey : String(targetItem.date || ""),
    logicalOperationId: logicalOperationId, requestId: deleteRequestId, expectedVersion: expectedVersion,
    resultVersion: "deleted:" + resourceKey
  });
  const ledgerNext = appendPensionOperationLedgerEntry(ledgerContext.items, ledgerEntry);
  appendPensionOperationIdentityEntries(identityContext, target, "delete", requestHash, ledgerEntry);
  const identityFileChanges = pensionOperationIdentityContextFileChanges(identityContext);
  stageStartedAtMs = Date.now();
  const commitBase = resolvePensionSingleCommitBase(baseCommitSha, "delete", target, requestContext.dependencyHash, extraDependencyPaths);
  recordPensionTimingStage(timing, "commitPreflight", stageStartedAtMs);
  if (!commitBase.ok) {
    return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
      ok: true, target: target, action: "stale_view_rejected", stale: true, error: commitBase.error
    }, {
      requestId: deleteRequestId, logicalOperationId: logicalOperationId, action: "delete"
    }, requestContext.mutationEpoch).result;
  }

  const deleteLabel = targetItem.date || resourceKey;
  const deleteTypeText = target === "cashSnapshot" ? "pension cash snapshot " : (target === "etfTrade" ? "pension ETF trade " : "pension contribution ");
  stageStartedAtMs = Date.now();
  try {
    writeGithubJsonBatch(commitBase.baseCommitSha, [
      { path: filePath, data: dataForTarget(items, target) },
      { path: ledgerContext.path, data: ledgerNext }
    ].concat(identityFileChanges), "Delete " + deleteTypeText + deleteLabel);
    recordPensionTimingStage(timing, "githubCommit", stageStartedAtMs);
  } catch (err) {
    recordPensionTimingStage(timing, "githubCommit", stageStartedAtMs);
    const readbackStartedAtMs = Date.now();
    markPensionSingleIntentRetryableIfTargetUnchanged(requestContext, target, current.sha);
    recordPensionTimingStage(timing, "failureReadback", readbackStartedAtMs);
    throw err;
  }
  stageStartedAtMs = Date.now();
  finishPensionSingleRequest(requestKey, requestHash, target);
  recordPensionTimingStage(timing, "localFinalize", stageStartedAtMs);
  return { ok: true, target: target, action: "deleted", deletedCount: 1, key: deleteLabel };
}

function handlePensionSingleUpsert(body, context) {
  const target = context.target;
  const filePath = context.filePath;
  const baseCommitSha = context.baseCommitSha;
  const current = context.current;
  const requestCache = context.requestCache || {};
  const timing = context.timing;
  let items = current.items;
  const nowKST = context.nowKST;
  let stageStartedAtMs = 0;
  const nowDate = context.nowDate;

  const memo = String(body.memo || "").trim();
  let newItem = null;
  let itemDate = "";
  let requestKey = "";
  let requestHash = "";
  let logicalOperationId = "";
  let dependencyHash = "";
  let ledgerContext = null;
  let ledgerFields = null;
  let identityContext = null;
  let identityCheck = null;
  let requestContext = null;

  if (target === "etfTrade") {
    const tradeDate = String(body.tradeDate || "").trim();
    const ticker = String(body.ticker || "").trim();
    const name = String(body.name || "").trim();
    const qtyText = String(body.qty == null ? "" : body.qty).replace(/,/g, "").trim();
    const amountText = String(body.amount == null ? "" : body.amount).replace(/,/g, "").trim();
    const qty = Number(qtyText), amount = Number(amountText);
    if (!isValidDateText(tradeDate)) return { ok: false, error: "신청일은 YYYY-MM-DD 형식이어야 합니다." };
    if (tradeDate > nowDate) return { ok: false, error: "신청일은 앱 반영일보다 늦을 수 없습니다." };
    if (!ticker || !name) return { ok: false, error: "ticker and name are required" };
    const portfolioProduct = getPensionPortfolioProduct(ticker, baseCommitSha, requestCache);
    if (!portfolioProduct) return { ok: false, error: "등록된 퇴직연금 ETF 상품이 아닙니다. 상품 목록을 다시 확인해주세요." };
    const resolvedName = String(portfolioProduct.name || "").trim() || name;
    if (qtyText === "" || !isSafePensionWhole(qty, true)) return { ok: false, error: "qty must be a positive safe integer" };
    if (amountText === "" || !isSafePensionWhole(amount, true)) return { ok: false, error: "amount must be a positive safe integer" };
    const id = String(body.id || "").trim();
    if (!id) return { ok: false, error: "etfTrade id가 필요합니다. 다시 시도해주세요." };
    assertPensionRequestId(id);
    logicalOperationId = String(body.logicalOperationId || id).trim(); assertPensionLogicalOperationId(logicalOperationId);
    requestKey = pensionSingleRequestKey(target, id);
    requestHash = pensionSingleRequestHash({ target: target, tradeDate: tradeDate, ticker: ticker, name: resolvedName, qty: qty, amount: amount, memo: memo, logicalOperationId: logicalOperationId });
    ledgerFields = { tradeDate: tradeDate, ticker: ticker, qty: qty, amount: amount, memo: memo };
    stageStartedAtMs = Date.now();
    primePensionEtfUpsertReadCache(ledgerFields, { logicalOperationId: logicalOperationId, requestId: id }, baseCommitSha, requestCache);
    recordPensionTimingStage(timing, "etfDependencyPreflight", stageStartedAtMs);
    stageStartedAtMs = Date.now();
    ledgerContext = loadPensionOperationLedgerContext(target, "upsert", ledgerFields, baseCommitSha, requestCache);
    recordPensionTimingStage(timing, "semanticLedgerRead", stageStartedAtMs);
    stageStartedAtMs = Date.now();
    identityContext = loadPensionOperationIdentityContext(target, { logicalOperationId: logicalOperationId, requestId: id }, baseCommitSha, requestCache);
    recordPensionTimingStage(timing, "exactIdentityLedgerRead", stageStartedAtMs);
    const extraPaths = [ledgerContext.path].concat(pensionOperationIdentityContextPaths(identityContext));
    stageStartedAtMs = Date.now();
    dependencyHash = pensionSingleDependencyHash("upsert", target, baseCommitSha, extraPaths, requestCache);
    recordPensionTimingStage(timing, "dependencyFingerprint", stageStartedAtMs);
    stageStartedAtMs = Date.now();
    identityCheck = inspectPensionSingleRequestIdentity(requestKey, requestHash, target, current.sha, "upsert", dependencyHash, { ledgerContext: ledgerContext, identityContext: identityContext, logicalOperationId: logicalOperationId, requestId: id, requestHash: requestHash, ref: baseCommitSha });
    recordPensionTimingStage(timing, "requestIdentityResolve", stageStartedAtMs);
    if (identityCheck.result) return identityCheck.result;
    const durableIdentityMatch = assertPensionOperationIdentityCompatible(identityContext, requestHash);
    if (durableIdentityMatch) return pensionSingleDurableIdentityResult(requestKey, requestHash, target, durableIdentityMatch, { requestId: id, logicalOperationId: logicalOperationId });
    const repeated = repeatedPensionRequestResult(items, target, id, { tradeDate: tradeDate, ticker: ticker, qty: qty, amount: amount, memo: memo });
    if (repeated) {
      return completePensionSingleNoMutationIdentity({
        target: target, action: "upsert", requestKey: requestKey, requestHash: requestHash,
        logicalOperationId: logicalOperationId, requestId: id, currentSha: current.sha,
        dependencyHash: dependencyHash, extraDependencyPaths: extraPaths, identityContext: identityContext,
        identityCheck: identityCheck, baseCommitSha: baseCommitSha, ledgerFields: ledgerFields, resultVersion: String(id)
      }, repeated);
    }
    const exactLedgerMatch = findPensionLedgerExactIdentity(ledgerContext, target, { logicalOperationId: logicalOperationId, requestId: id }, baseCommitSha, requestCache);
    const semantic = findPensionSemanticExisting(items, target, ledgerFields);
    const duplicateCandidate = exactLedgerMatch ? { source: "ledger", value: exactLedgerMatch } :
      (semantic ? { source: "item", value: semantic.item } : (ledgerContext.match ? { source: "ledger", value: ledgerContext.match } : null));
    stageStartedAtMs = Date.now();
    const confirmationResolution = resolvePensionSingleConfirmation(body, { identityCheck: identityCheck, requestKey: requestKey, requestHash: requestHash, target: target, logicalOperationId: logicalOperationId, dependencyHash: dependencyHash, candidate: duplicateCandidate });
    recordPensionTimingStage(timing, "confirmationCheck", stageStartedAtMs);
    if (!confirmationResolution.proceed) {
      if (confirmationResolution.identityCompletionRequired) {
        return completePensionSingleNoMutationIdentity({
          target: target, action: "upsert", requestKey: requestKey, requestHash: requestHash,
          logicalOperationId: logicalOperationId, requestId: id, currentSha: current.sha,
          dependencyHash: dependencyHash, extraDependencyPaths: extraPaths, identityContext: identityContext,
          identityCheck: identityCheck, baseCommitSha: baseCommitSha, ledgerFields: ledgerFields,
          resultVersion: String(duplicateCandidate && duplicateCandidate.value && (duplicateCandidate.value.resultVersion || duplicateCandidate.value.id || duplicateCandidate.value.requestId) || id)
        }, confirmationResolution.result);
      }
      return confirmationResolution.result;
    }
    stageStartedAtMs = Date.now();
    const serverCashBefore = calculatePensionCashAvailable(nowDate, items, baseCommitSha, requestCache);
    recordPensionTimingStage(timing, "cashStateRead", stageStartedAtMs);
    if (!Number.isSafeInteger(serverCashBefore)) return { ok: false, error: "현재 현금성자산을 안전한 정수로 계산하지 못했습니다. 잠시 후 다시 시도해주세요." };
    if (serverCashBefore < amount) return { ok: false, error: "현재 현금성자산 " + Math.round(serverCashBefore).toLocaleString("ko-KR") + "원보다 체결금액 " + amount.toLocaleString("ko-KR") + "원이 큽니다. 현금성자산 평가금액을 먼저 확인해주세요." };
    stageStartedAtMs = Date.now();
    if (!identityCheck.hasIdentity) beginPensionSingleRequest(requestKey, requestHash, target, current.sha, "upsert", dependencyHash, { requestId: id, logicalOperationId: logicalOperationId });
    const activeIntent = findPensionRequestIntent(requestKey) || {};
    recordPensionTimingStage(timing, "intentEpochPrepare", stageStartedAtMs);
    requestContext = { key: requestKey, hash: requestHash, target: target, action: "upsert", mutationEpoch: Number(activeIntent.mutationEpoch || 0), dependencyHash: String(activeIntent.dependencyHash || dependencyHash), baseCommitSha: baseCommitSha, extraDependencyPaths: extraPaths, requestId: id, logicalOperationId: logicalOperationId };
    itemDate = nowDate;
    newItem = { id: id, date: itemDate, applyDate: itemDate, tradeDate: tradeDate, ticker: ticker, name: resolvedName, type: "buy", qty: qty, price: amount / qty, amount: amount, funding: "pension_cash", cashBeforeDate: itemDate, cashBefore: Math.round(serverCashBefore), cashAfter: safePensionSubtract(Math.round(serverCashBefore), amount, "퇴직연금 추가 매수 후 현금성자산"), memo: memo || ("신청일 " + tradeDate + " · " + resolvedName + " " + qty + "좌 매수 체결 · 앱 반영일 " + itemDate), updatedBy: "google-apps-script", updatedAtKST: nowKST, appliedAtKST: nowKST, logicalOperationId: logicalOperationId };
  } else {
    const date = String(body.date || "").trim();
    itemDate = date;
    if (!isValidDateText(date)) return { ok: false, error: "date must be YYYY-MM-DD" };
    if (target === "cashSnapshot") {
      const rawValuation = body.valuation !== undefined && body.valuation !== null ? body.valuation : body.amount;
      const valuationText = String(rawValuation == null ? "" : rawValuation).replace(/,/g, "").trim();
      const costBasisText = String(body.costBasis == null ? "" : body.costBasis).replace(/,/g, "").trim();
      const valuation = Number(valuationText), costBasis = Number(costBasisText);
      if (valuationText === "" || !isSafePensionWhole(valuation, false)) return { ok: false, error: "valuation must be a zero-or-positive safe integer" };
      if (costBasisText === "" || !isSafePensionWhole(costBasis, false)) return { ok: false, error: "costBasis must be a zero-or-positive safe integer" };
      const requestId = String(body.requestId || "").trim();
      if (!requestId) return { ok: false, error: "cashSnapshot requestId가 필요합니다. 다시 시도해주세요." };
      assertPensionRequestId(requestId);
      logicalOperationId = String(body.logicalOperationId || requestId).trim(); assertPensionLogicalOperationId(logicalOperationId);
      const resolvedMemo = memo || "현금성자산 앱 확인";
      const expectedVersion = String(body.expectedVersion || "").trim(), expectedAbsent = body.expectedAbsent === true;
      if ((expectedVersion ? 1 : 0) + (expectedAbsent ? 1 : 0) !== 1) return { ok: false, error: "cashSnapshot 저장에는 expectedVersion 또는 expectedAbsent=true 중 하나가 필요합니다. 최신 화면에서 다시 시도해주세요." };
      requestKey = pensionSingleRequestKey(target, requestId);
      requestHash = pensionSingleRequestHash({ target: target, date: date, valuation: valuation, costBasis: costBasis, memo: resolvedMemo, expectedVersion: expectedVersion, expectedAbsent: expectedAbsent, logicalOperationId: logicalOperationId });
      ledgerFields = { date: date, valuation: valuation, costBasis: costBasis, memo: resolvedMemo };
      stageStartedAtMs = Date.now();
      primePensionCashUpsertReadCache(ledgerFields, { logicalOperationId: logicalOperationId, requestId: requestId }, baseCommitSha, requestCache);
      recordPensionTimingStage(timing, "ledgerIdentityPreflight", stageStartedAtMs);
      stageStartedAtMs = Date.now();
      ledgerContext = loadPensionOperationLedgerContext(target, "upsert", ledgerFields, baseCommitSha, requestCache);
      recordPensionTimingStage(timing, "semanticLedgerRead", stageStartedAtMs);
      stageStartedAtMs = Date.now();
      identityContext = loadPensionOperationIdentityContext(target, { logicalOperationId: logicalOperationId, requestId: requestId }, baseCommitSha, requestCache);
      recordPensionTimingStage(timing, "exactIdentityLedgerRead", stageStartedAtMs);
      const extraPaths = [ledgerContext.path]
        .concat(pensionOperationIdentityContextPaths(identityContext))
        .concat(ledgerContext.legacyPath ? [ledgerContext.legacyPath] : []);
      stageStartedAtMs = Date.now();
      dependencyHash = pensionSingleDependencyHash("upsert", target, baseCommitSha, extraPaths, requestCache);
      recordPensionTimingStage(timing, "dependencyFingerprint", stageStartedAtMs);
      stageStartedAtMs = Date.now();
      identityCheck = inspectPensionSingleRequestIdentity(requestKey, requestHash, target, current.sha, "upsert", dependencyHash, { ledgerContext: ledgerContext, identityContext: identityContext, logicalOperationId: logicalOperationId, requestId: requestId, requestHash: requestHash, ref: baseCommitSha });
      recordPensionTimingStage(timing, "requestIdentityResolve", stageStartedAtMs);
      if (identityCheck.result) return identityCheck.result;
      const durableIdentityMatch = assertPensionOperationIdentityCompatible(identityContext, requestHash);
      if (durableIdentityMatch) return pensionSingleDurableIdentityResult(requestKey, requestHash, target, durableIdentityMatch, { requestId: requestId, logicalOperationId: logicalOperationId });
      const existingSnapshot = items.find(function(item) { return item && String(item.date || "") === date && String(item.requestId || "") === requestId; });
      if (existingSnapshot) {
        const sameContent = Number(existingSnapshot.valuation) === valuation && Number(existingSnapshot.costBasis) === costBasis && String(existingSnapshot.memo || "") === resolvedMemo;
        if (!sameContent) return { ok: false, error: "동일한 현금성자산 requestId가 다른 저장 내용에 이미 사용되었습니다. 새로고침 후 다시 시도하세요." };
        return completePensionSingleNoMutationIdentity({
          target: target, action: "upsert", requestKey: requestKey, requestHash: requestHash,
          logicalOperationId: logicalOperationId, requestId: requestId, currentSha: current.sha,
          dependencyHash: dependencyHash, extraDependencyPaths: extraPaths, identityContext: identityContext,
          identityCheck: identityCheck, baseCommitSha: baseCommitSha, ledgerFields: ledgerFields,
          resultVersion: pensionCashSnapshotVersion(existingSnapshot)
        }, { ok: true, target: target, action: "duplicate_ignored", duplicate: true, item: existingSnapshot });
      }
      const currentSnapshot = items.find(function(item) { return item && String(item.date || "") === date; }) || null;
      if (expectedAbsent && currentSnapshot) {
        const staleResult = { ok: true, target: target, action: "stale_view_rejected", stale: true, error: "현금성자산 기록이 화면을 연 이후 생성되었습니다. 최신 데이터를 새로고침한 뒤 다시 시도해주세요." };
        const terminalEpoch = identityCheck.hasIdentity === true
          ? Number((findPensionRequestIntent(requestKey) || {}).mutationEpoch || 0)
          : beginPensionSingleTerminalPending(requestKey, requestHash, target, current.sha, dependencyHash, "stale_view_rejected", { requestId: requestId, logicalOperationId: logicalOperationId, action: "upsert" });
        if (identityCheck.hasIdentity === true) {
          markPensionSingleIntentTerminalPending(requestKey, requestHash, target, "stale_view_rejected", { requestId: requestId, logicalOperationId: logicalOperationId, action: "upsert" });
        }
        return finalizePensionSingleTerminalStale(requestKey, requestHash, target, staleResult, {
          requestId: requestId, logicalOperationId: logicalOperationId, action: "upsert"
        }, terminalEpoch).result;
      }
      if (expectedVersion && (!currentSnapshot || pensionCashSnapshotVersion(currentSnapshot) !== expectedVersion)) {
        const staleResult = { ok: true, target: target, action: "stale_view_rejected", stale: true, error: "현금성자산 기록이 화면을 연 이후 변경되었습니다. 최신 데이터를 새로고침한 뒤 다시 시도해주세요." };
        const terminalEpoch = identityCheck.hasIdentity === true
          ? Number((findPensionRequestIntent(requestKey) || {}).mutationEpoch || 0)
          : beginPensionSingleTerminalPending(requestKey, requestHash, target, current.sha, dependencyHash, "stale_view_rejected", { requestId: requestId, logicalOperationId: logicalOperationId, action: "upsert" });
        if (identityCheck.hasIdentity === true) {
          markPensionSingleIntentTerminalPending(requestKey, requestHash, target, "stale_view_rejected", { requestId: requestId, logicalOperationId: logicalOperationId, action: "upsert" });
        }
        return finalizePensionSingleTerminalStale(requestKey, requestHash, target, staleResult, {
          requestId: requestId, logicalOperationId: logicalOperationId, action: "upsert"
        }, terminalEpoch).result;
      }
      const exactLedgerMatch = findPensionLedgerExactIdentity(ledgerContext, target, { logicalOperationId: logicalOperationId, requestId: requestId }, baseCommitSha, requestCache);
      const currentSemantic = currentSnapshot && pensionSemanticMatchesExisting(currentSnapshot, target, ledgerFields) ? currentSnapshot : null;
      const duplicateCandidate = exactLedgerMatch ? { source: "ledger", value: exactLedgerMatch } :
        (currentSemantic ? { source: "item", value: currentSemantic } : (ledgerContext.match ? { source: "ledger", value: ledgerContext.match } : null));
      stageStartedAtMs = Date.now();
      const confirmationResolution = resolvePensionSingleConfirmation(body, { identityCheck: identityCheck, requestKey: requestKey, requestHash: requestHash, target: target, logicalOperationId: logicalOperationId, dependencyHash: dependencyHash, candidate: duplicateCandidate });
      recordPensionTimingStage(timing, "confirmationCheck", stageStartedAtMs);
      if (!confirmationResolution.proceed) {
        if (confirmationResolution.identityCompletionRequired) {
          return completePensionSingleNoMutationIdentity({
            target: target, action: "upsert", requestKey: requestKey, requestHash: requestHash,
            logicalOperationId: logicalOperationId, requestId: requestId, currentSha: current.sha,
            dependencyHash: dependencyHash, extraDependencyPaths: extraPaths, identityContext: identityContext,
            identityCheck: identityCheck, baseCommitSha: baseCommitSha, ledgerFields: ledgerFields,
            resultVersion: String(duplicateCandidate && duplicateCandidate.value && (duplicateCandidate.value.resultVersion || duplicateCandidate.value.requestId || duplicateCandidate.value.id) || ("cash:" + date))
          }, confirmationResolution.result);
        }
        return confirmationResolution.result;
      }
      stageStartedAtMs = Date.now();
      if (!identityCheck.hasIdentity) beginPensionSingleRequest(requestKey, requestHash, target, current.sha, "upsert", dependencyHash, { requestId: requestId, logicalOperationId: logicalOperationId });
      const activeIntent = findPensionRequestIntent(requestKey) || {};
      recordPensionTimingStage(timing, "intentEpochPrepare", stageStartedAtMs);
      requestContext = { key: requestKey, hash: requestHash, target: target, action: "upsert", mutationEpoch: Number(activeIntent.mutationEpoch || 0), dependencyHash: String(activeIntent.dependencyHash || dependencyHash), baseCommitSha: baseCommitSha, extraDependencyPaths: extraPaths, requestId: requestId, logicalOperationId: logicalOperationId };
      stageStartedAtMs = Date.now();
      const tradeCurrent = readPensionTarget("etfTrade", baseCommitSha, requestCache), contributionCurrent = readPensionTarget("contribution", baseCommitSha, requestCache);
      recordPensionTimingStage(timing, "cashDependencyRead", stageStartedAtMs);
      const afterTradeIds = tradeCurrent.items.filter(function(item) { return String(item.date || "") <= date; }).map(function(item) { return String(item.id || ""); }).filter(Boolean);
      const afterContributionIds = contributionCurrent.items.filter(function(item) { return String(item.date || "") <= date; }).map(function(item) { return String(item.id || ""); }).filter(Boolean);
      newItem = { date: date, valuation: valuation, costBasis: costBasis, requestId: requestId, logicalOperationId: logicalOperationId, memo: resolvedMemo, updatedBy: "google-apps-script", updatedAtKST: nowKST, afterTradeIds: afterTradeIds, afterContributionIds: afterContributionIds };
    } else {
      const amountText = String(body.amount == null ? "" : body.amount).replace(/,/g, "").trim(), amount = Number(amountText);
      if (amountText === "" || !isSafePensionWhole(amount, true)) return { ok: false, error: "amount must be a positive safe integer" };
      const id = String(body.id || "").trim();
      if (!id) return { ok: false, error: "contribution id가 필요합니다. 다시 시도해주세요." };
      assertPensionRequestId(id);
      logicalOperationId = String(body.logicalOperationId || id).trim(); assertPensionLogicalOperationId(logicalOperationId);
      requestKey = pensionSingleRequestKey(target, id);
      const resolvedContributionMemo = memo || makeDefaultMemo(date);
      requestHash = pensionSingleRequestHash({ target: target, date: date, amount: amount, memo: memo, logicalOperationId: logicalOperationId });
      ledgerFields = { date: date, amount: amount, memo: resolvedContributionMemo };
      stageStartedAtMs = Date.now();
      ledgerContext = loadPensionOperationLedgerContext(target, "upsert", ledgerFields, baseCommitSha, requestCache);
      recordPensionTimingStage(timing, "semanticLedgerRead", stageStartedAtMs);
      stageStartedAtMs = Date.now();
      identityContext = loadPensionOperationIdentityContext(target, { logicalOperationId: logicalOperationId, requestId: id }, baseCommitSha, requestCache);
      recordPensionTimingStage(timing, "exactIdentityLedgerRead", stageStartedAtMs);
      const extraPaths = [ledgerContext.path].concat(pensionOperationIdentityContextPaths(identityContext));
      stageStartedAtMs = Date.now();
      dependencyHash = pensionSingleDependencyHash("upsert", target, baseCommitSha, extraPaths, requestCache);
      recordPensionTimingStage(timing, "dependencyFingerprint", stageStartedAtMs);
      stageStartedAtMs = Date.now();
      identityCheck = inspectPensionSingleRequestIdentity(requestKey, requestHash, target, current.sha, "upsert", dependencyHash, { ledgerContext: ledgerContext, identityContext: identityContext, logicalOperationId: logicalOperationId, requestId: id, requestHash: requestHash, ref: baseCommitSha });
      recordPensionTimingStage(timing, "requestIdentityResolve", stageStartedAtMs);
      if (identityCheck.result) return identityCheck.result;
      const durableIdentityMatch = assertPensionOperationIdentityCompatible(identityContext, requestHash);
      if (durableIdentityMatch) return pensionSingleDurableIdentityResult(requestKey, requestHash, target, durableIdentityMatch, { requestId: id, logicalOperationId: logicalOperationId });
      const repeated = repeatedPensionRequestResult(items, target, id, { date: date, amount: amount, memo: memo });
      if (repeated) {
        return completePensionSingleNoMutationIdentity({
          target: target, action: "upsert", requestKey: requestKey, requestHash: requestHash,
          logicalOperationId: logicalOperationId, requestId: id, currentSha: current.sha,
          dependencyHash: dependencyHash, extraDependencyPaths: extraPaths, identityContext: identityContext,
          identityCheck: identityCheck, baseCommitSha: baseCommitSha, ledgerFields: ledgerFields, resultVersion: String(id)
        }, repeated);
      }
      const exactLedgerMatch = findPensionLedgerExactIdentity(ledgerContext, target, { logicalOperationId: logicalOperationId, requestId: id }, baseCommitSha, requestCache);
      const semantic = findPensionSemanticExisting(items, target, ledgerFields);
      const duplicateCandidate = exactLedgerMatch ? { source: "ledger", value: exactLedgerMatch } :
        (semantic ? { source: "item", value: semantic.item } : (ledgerContext.match ? { source: "ledger", value: ledgerContext.match } : null));
      const confirmationResolution = resolvePensionSingleConfirmation(body, { identityCheck: identityCheck, requestKey: requestKey, requestHash: requestHash, target: target, logicalOperationId: logicalOperationId, dependencyHash: dependencyHash, candidate: duplicateCandidate });
      if (!confirmationResolution.proceed) {
        if (confirmationResolution.identityCompletionRequired) {
          return completePensionSingleNoMutationIdentity({
            target: target, action: "upsert", requestKey: requestKey, requestHash: requestHash,
            logicalOperationId: logicalOperationId, requestId: id, currentSha: current.sha,
            dependencyHash: dependencyHash, extraDependencyPaths: extraPaths, identityContext: identityContext,
            identityCheck: identityCheck, baseCommitSha: baseCommitSha, ledgerFields: ledgerFields,
            resultVersion: String(duplicateCandidate && duplicateCandidate.value && (duplicateCandidate.value.resultVersion || duplicateCandidate.value.id || duplicateCandidate.value.requestId) || id)
          }, confirmationResolution.result);
        }
        return confirmationResolution.result;
      }
      stageStartedAtMs = Date.now();
      if (!identityCheck.hasIdentity) beginPensionSingleRequest(requestKey, requestHash, target, current.sha, "upsert", dependencyHash, { requestId: id, logicalOperationId: logicalOperationId });
      const activeIntent = findPensionRequestIntent(requestKey) || {};
      recordPensionTimingStage(timing, "intentEpochPrepare", stageStartedAtMs);
      requestContext = { key: requestKey, hash: requestHash, target: target, action: "upsert", mutationEpoch: Number(activeIntent.mutationEpoch || 0), dependencyHash: String(activeIntent.dependencyHash || dependencyHash), baseCommitSha: baseCommitSha, extraDependencyPaths: extraPaths, requestId: id, logicalOperationId: logicalOperationId };
      newItem = { id: id, date: date, amount: amount, memo: resolvedContributionMemo, logicalOperationId: logicalOperationId, updatedBy: "google-apps-script", updatedAtKST: nowKST };
    }
  }

  let existingIndex = target === "cashSnapshot"
    ? items.findIndex(function(item) { return String(item.date || "") === itemDate; })
    : items.findIndex(function(item) { return String(item.id || "") === newItem.id; });
  const resultAction = existingIndex >= 0 ? "updated" : "created";
  if (existingIndex >= 0) items[existingIndex] = newItem; else items.push(newItem);
  items = normalizeItemsForTarget(items, target);

  const ledgerEntryFields = target === "cashSnapshot"
    ? { date: itemDate, valuation: Number(newItem.valuation), costBasis: Number(newItem.costBasis), memo: String(newItem.memo || ""), logicalOperationId: logicalOperationId, requestId: String(newItem.requestId || ""), resultVersion: pensionCashSnapshotVersion(newItem) }
    : (target === "contribution"
      ? { date: String(newItem.date || ""), amount: Number(newItem.amount), memo: String(newItem.memo || ""), logicalOperationId: logicalOperationId, requestId: String(newItem.id || ""), resultVersion: String(newItem.id || "") }
      : { resourceKey: String(newItem.id || ""), date: String(newItem.date || ""), tradeDate: String(newItem.tradeDate || ""), ticker: String(newItem.ticker || ""), qty: Number(newItem.qty), amount: Number(newItem.amount), memo: memo, logicalOperationId: logicalOperationId, requestId: String(newItem.id || ""), resultVersion: String(newItem.id || "") });
  const ledgerEntry = makePensionOperationLedgerEntry(target, "upsert", ledgerEntryFields);
  const ledgerNext = appendPensionOperationLedgerEntry(ledgerContext.items, ledgerEntry);
  appendPensionOperationIdentityEntries(identityContext, target, "upsert", requestHash, ledgerEntry);
  const identityFileChanges = pensionOperationIdentityContextFileChanges(identityContext);
  stageStartedAtMs = Date.now();
  const commitBase = resolvePensionSingleCommitBase(baseCommitSha, "upsert", target, requestContext.dependencyHash, requestContext.extraDependencyPaths);
  recordPensionTimingStage(timing, "commitPreflight", stageStartedAtMs);
  if (!commitBase.ok) {
    return finalizePensionSingleTerminalStale(requestContext.key, requestContext.hash, target, {
      ok: true, target: target, action: "stale_view_rejected", stale: true, error: commitBase.error
    }, {
      requestId: requestContext.requestId, logicalOperationId: requestContext.logicalOperationId, action: "upsert"
    }, requestContext.mutationEpoch).result;
  }
  const typeText = target === "cashSnapshot" ? "pension cash snapshot " : (target === "etfTrade" ? "pension ETF trade " : "pension contribution ");
  stageStartedAtMs = Date.now();
  try {
    writeGithubJsonBatch(commitBase.baseCommitSha, [
      { path: filePath, data: dataForTarget(items, target) },
      { path: ledgerContext.path, data: ledgerNext }
    ].concat(identityFileChanges), (resultAction === "updated" ? "Update " : "Add ") + typeText + itemDate);
    recordPensionTimingStage(timing, "githubCommit", stageStartedAtMs);
  } catch (err) {
    recordPensionTimingStage(timing, "githubCommit", stageStartedAtMs);
    const readbackStartedAtMs = Date.now();
    markPensionSingleIntentRetryableIfTargetUnchanged(requestContext, target, current.sha);
    recordPensionTimingStage(timing, "failureReadback", readbackStartedAtMs);
    throw err;
  }
  stageStartedAtMs = Date.now();
  finishPensionSingleRequest(requestContext.key, requestContext.hash, requestContext.target);
  recordPensionTimingStage(timing, "localFinalize", stageStartedAtMs);
  return { ok: true, target: target, action: resultAction, item: newItem };
}


/* =========================================================
 * 08. 퇴직연금 Batch 적용 / Atomic Commit
 * ========================================================= */

/* --- 08A. Batch Ledger / Identity Preparation ----------------------------- */

function pensionBatchOperationLedgerFields(operation) {
  const op = operation || {};
  const action = String(op.action || "");
  const target = String(op.target || "");
  const item = op.item && typeof op.item === "object" ? op.item : {};
  if (action === "delete") return { resourceKey: String(op.key || ""), key: String(op.key || ""), date: target === "cashSnapshot" ? String(op.key || "") : "" };
  if (target === "cashSnapshot") return { date: String(item.date || ""), valuation: Number(item.valuation), costBasis: Number(item.costBasis), memo: String(item.memo || "현금성자산 앱 확인") };
  if (target === "contribution") return { date: String(item.date || ""), amount: Number(item.amount), memo: String(item.memo || makeDefaultMemo(String(item.date || ""))) };
  return { tradeDate: String(item.tradeDate || ""), ticker: String(item.ticker || ""), qty: Number(item.qty), amount: Number(item.amount), memo: String(item.memo || "") };
}

function preparePensionBatchLedgerOperations(operations, ref, requestCache) {
  const shards = {};
  (Array.isArray(operations) ? operations : []).forEach(function(op) {
    const fields = pensionBatchOperationLedgerFields(op);
    const semanticHash = pensionOperationSemanticHash(String(op.target || ""), String(op.action || ""), fields);
    const path = pensionOperationLedgerShardPath(semanticHash);
    op.__ledgerFields = fields;
    op.__ledgerSemanticHash = semanticHash;
    op.__ledgerPath = path;
    if (!shards[path]) {
      const current = readGithubJsonOptionalRequestCached(path, ref, [], requestCache);
      shards[path] = { initial: normalizePensionOperationLedger(current.data), items: normalizePensionOperationLedger(current.data) };
    }
  });
  return shards;
}

function appendPensionBatchLedgerOperation(shards, op, requestId, resultVersion, dateText) {
  const path = String(op && op.__ledgerPath || "");
  if (!path || !shards[path]) throw new Error("Batch operation ledger shard를 준비하지 못했습니다.");
  const fields = Object.assign({}, op.__ledgerFields || {}, {
    date: String(dateText || (op.__ledgerFields && op.__ledgerFields.date) || ""),
    logicalOperationId: String(op.logicalOperationId || op.__batchOperationId || ""),
    batchRequestId: String(requestId || ""),
    batchOperationId: String(op.__batchOperationId || ""),
    resultVersion: String(resultVersion || ""),
    expectedVersion: String(op.expectedVersion || "")
  });
  const entry = makePensionOperationLedgerEntry(String(op.target || ""), String(op.action || ""), fields);
  shards[path].items = appendPensionOperationLedgerEntry(shards[path].items, entry);
}


function pensionBatchOperationIdentityContentHash(operation) {
  const op = operation || {};
  return sha256HexText(canonicalPensionBatchJson({
    target: String(op.target || ""),
    action: String(op.action || ""),
    fields: pensionBatchOperationLedgerFields(op),
    expectedVersion: String(op.expectedVersion || ""),
    expectedAbsent: op.expectedAbsent === true
  }));
}

function preparePensionBatchIdentityOperations(operations, batchRequestId, ref, requestCache) {
  const shards = {};
  (Array.isArray(operations) ? operations : []).forEach(function(op, index) {
    const operationId = String(op.__batchOperationId || pensionBatchOperationIdentity(op, index));
    const logicalOperationId = String(op.logicalOperationId || operationId || "");
    const identity = { logicalOperationId: logicalOperationId, batchRequestId: String(batchRequestId || ""), batchOperationId: operationId };
    const keys = pensionOperationIdentityKeys(String(op.target || ""), identity);
    op.__identityKeys = keys;
    op.__identityContentHash = pensionBatchOperationIdentityContentHash(op);
    keys.forEach(function(identityKey) {
      const path = pensionOperationIdentityLedgerShardPath(identityKey);
      if (!shards[path]) {
        const current = readGithubJsonOptionalRequestCached(path, ref, [], requestCache);
        const items = normalizePensionOperationIdentityLedger(current.data);
        shards[path] = { path: path, initial: items.slice(), items: items };
      }
    });
  });
  return shards;
}

function appendPensionBatchIdentityOperation(shards, op, batchRequestId, resultVersion, dateText) {
  const keys = Array.isArray(op && op.__identityKeys) ? op.__identityKeys : [];
  const contentHash = String(op && op.__identityContentHash || pensionBatchOperationIdentityContentHash(op || {}));
  const semanticHash = String(op && op.__ledgerSemanticHash || pensionOperationSemanticHash(String(op && op.target || ""), String(op && op.action || ""), pensionBatchOperationLedgerFields(op || {})));
  keys.forEach(function(identityKey) {
    const path = pensionOperationIdentityLedgerShardPath(identityKey);
    const shard = shards[path];
    if (!shard) throw new Error("Batch identity ledger shard를 준비하지 못했습니다.");
    const existing = shard.items.find(function(item) { return String(item && item.identityKey || "") === identityKey; }) || null;
    if (existing) {
      if (String(existing.contentHash || "") !== contentHash) {
        throw new Error("동일한 Batch/logical identity가 다른 작업 내용에 이미 사용되었습니다. 작업 모음을 새로 구성해 다시 시도해주세요.");
      }
      return;
    }
    shard.items.push({
      identityKey: identityKey,
      contentHash: contentHash,
      target: String(op && op.target || ""),
      action: String(op && op.action || ""),
      semanticHash: semanticHash,
      resourceKey: String(op && (op.key || (op.item && op.item.date)) || ""),
      logicalOperationId: String(op && (op.logicalOperationId || op.__batchOperationId) || ""),
      requestId: "",
      batchRequestId: String(batchRequestId || ""),
      batchOperationId: String(op && op.__batchOperationId || ""),
      resultVersion: String(resultVersion || ""),
      savedAtKST: nowKSTText(),
      savedAtMs: Date.now()
    });
    shard.items = normalizePensionOperationIdentityLedger(shard.items);
  });
}

// completed batchRequestId/receipt가 강한 성공 proof인데 operation exact identity 일부가 과거 버전에서
// 누락된 경우, logical + batch operation key 전체를 metadata-only CAS commit으로 복구한다.
function ensurePensionBatchOperationIdentitiesComplete(operations, batchRequestId) {
  const requestId = String(batchRequestId || "");
  const normalized = normalizePensionBatchOperations(operations, false);
  if (!requestId || !normalized.length) return false;
  assertPensionBatchUniqueLogicalIdentities(normalized);

  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const head = getGithubBranchHeadSha();
    if (!head) throw new Error("Pension Batch exact identity backfill 기준 커밋을 확인하지 못했습니다.");
    const shards = preparePensionBatchIdentityOperations(normalized, requestId, head, {});
    normalized.forEach(function(op) {
      const keys = Array.isArray(op.__identityKeys) ? op.__identityKeys : [];
      const contentHash = String(op.__identityContentHash || "");
      keys.forEach(function(identityKey) {
        const shard = shards[pensionOperationIdentityLedgerShardPath(identityKey)];
        const existing = shard && shard.items.find(function(item) { return String(item && item.identityKey || "") === String(identityKey || ""); });
        if (existing && String(existing.contentHash || "") !== contentHash) {
          throw new Error("동일한 Batch/logical identity가 다른 작업 내용에 이미 사용되었습니다. 작업 모음을 새로 구성해 다시 시도해주세요.");
        }
      });
      appendPensionBatchIdentityOperation(
        shards, op, requestId, "batch-request-recovered",
        String(op.key || (op.item && op.item.date) || "")
      );
    });
    const changes = [];
    Object.keys(shards).sort().forEach(function(path) {
      const shard = shards[path];
      if (canonicalPensionBatchJson(shard.initial) !== canonicalPensionBatchJson(shard.items)) {
        changes.push({ path: path, data: shard.items });
      }
    });
    if (!changes.length) return true;
    if (tryDurableGithubJsonBatchWrite(
      head, changes, "Backfill pension batch exact identities [" + requestId + "]", attempt
    )) return true;
  }
  return false;
}

// 연결 snapshot 삭제가 선행되도록 batch 작업 순서를 안전하게 보정한다.

/* --- 08B. Batch Normalize / Validation / Apply ---------------------------- */

function orderPensionBatchOperations(operations, initialState) {
  const ordered = operations.slice();
  let reordered = false;

  function moveBefore(moveOp, beforeOp) {
    const from = ordered.indexOf(moveOp);
    const to = ordered.indexOf(beforeOp);
    if (from < 0 || to < 0 || from < to) return;
    ordered.splice(from, 1);
    ordered.splice(ordered.indexOf(beforeOp), 0, moveOp);
    reordered = true;
  }

  operations.forEach(function(op) {
    if (!op || op.action !== "delete" || (op.target !== "etfTrade" && op.target !== "contribution")) return;
    const source = op.target === "etfTrade" ? initialState.trades : initialState.contributions;
    const item = source.find(function(v) {
      return String(v.id || "") === String(op.key || "");
    });
    if (!item) return;
    const linkedSnapshots = findLinkedCashSnapshots(initialState, item, op.target);
    linkedSnapshots.forEach(function(linked) {
      const cashDelete = ordered.find(function(candidate) {
        return candidate && candidate.action === "delete" && candidate.target === "cashSnapshot" && String(candidate.key || "") === String(linked.date || "");
      });
      if (cashDelete) moveBefore(cashDelete, op);
    });
  });

  return { operations: ordered, reordered: reordered };
}

// Batch cash upsert/delete는 queue를 만들 때 사용자가 본 initial snapshot 버전을 기준으로 검증한다.
// 같은 Batch 내부에서 같은 날짜를 여러 번 수정하는 순서는 initial precondition이 같아도 허용한다.
function assertPensionBatchCashPreconditions(operations, initialState, operationDecisions) {
  const initialCash = initialState.cashSnapshots || [];
  (operations || []).forEach(function(rawOp, index) {
    const op = rawOp || {};
    const originalIndex = Number(op.__originalIndex);
    const confirmationDecision = operationDecisions && Object.prototype.hasOwnProperty.call(operationDecisions, String(originalIndex))
      ? String(operationDecisions[String(originalIndex)] || "")
      : "";
    if (confirmationDecision === "existing") return;
    if (String(op.target || "") !== "cashSnapshot") return;
    const action = String(op.action || "");
    const date = String(action === "delete" ? op.key : (op.item && op.item.date) || "");
    const current = initialCash.find(function(v) { return String(v.date || "") === date; }) || null;
    const expectedVersion = String(op.expectedVersion || "").trim();
    const expectedAbsent = op.expectedAbsent === true;

    if (action === "delete") {
      if (!expectedVersion || expectedAbsent) throw new Error((index + 1) + "번 현금성자산 삭제의 expectedVersion이 없습니다. 최신 화면에서 작업 모음을 다시 구성해주세요.");
      if (!current || pensionCashSnapshotVersion(current) !== expectedVersion) throw new Error((index + 1) + "번 현금성자산 삭제 대상이 작업 모음을 구성한 뒤 변경되었습니다. 최신 화면에서 다시 구성해주세요.");
      return;
    }

    if ((expectedVersion ? 1 : 0) + (expectedAbsent ? 1 : 0) !== 1) throw new Error((index + 1) + "번 현금성자산 저장의 expectedVersion/expectedAbsent 조건이 올바르지 않습니다.");
    if (expectedAbsent && current) throw new Error((index + 1) + "번 현금성자산 기록이 작업 모음을 구성한 뒤 생성되었습니다. 최신 화면에서 다시 구성해주세요.");
    if (expectedVersion && (!current || pensionCashSnapshotVersion(current) !== expectedVersion)) throw new Error((index + 1) + "번 현금성자산 기록이 작업 모음을 구성한 뒤 변경되었습니다. 최신 화면에서 다시 구성해주세요.");
  });
}

// 하나의 logicalOperationId는 같은 target 안에서 정확히 하나의 Batch operation만 나타내야 한다.
// 같은 logical identity를 여러 operation이 공유하면 deterministic resource ID가 달라져 중복 mutation이 생길 수 있으므로
// GitHub read / 메모리 state 변경보다 먼저 malformed batch로 거부한다.
function normalizePensionBatchOperations(operations, includeOriginalIndex) {
  return (Array.isArray(operations) ? operations : []).map(function(rawOp, index) {
    const op = Object.assign({}, rawOp || {});
    if (includeOriginalIndex === true) op.__originalIndex = index;
    op.__batchOperationId = pensionBatchOperationIdentity(op, index);
    op.logicalOperationId = String(op.logicalOperationId || op.__batchOperationId || "").trim();
    assertPensionLogicalOperationId(op.logicalOperationId);
    return op;
  });
}

function assertPensionBatchUniqueLogicalIdentities(operations) {
  const seen = {};
  (Array.isArray(operations) ? operations : []).forEach(function(op, index) {
    const target = String(op && op.target || "");
    const logicalOperationId = String(op && op.logicalOperationId || "");
    if (!target || !logicalOperationId) return;
    const key = target + "|" + logicalOperationId;
    if (Object.prototype.hasOwnProperty.call(seen, key)) {
      throw new Error((index + 1) + "번 작업의 logicalOperationId가 " + (seen[key] + 1) + "번 작업과 중복됩니다. 각 작업은 고유한 logicalOperationId를 사용해야 합니다.");
    }
    seen[key] = index;
  });
}

// 작업 모음을 메모리 state에 순차 적용한 뒤 하나의 Git commit으로 저장한다.
function applyPensionBatchOperation(state, rawOp, index, requestId, operationDecisions, nowKST, nowDate, touched, results) {
  const op = rawOp || {};
  const action = String(op.action || "").trim();
  const target = String(op.target || "").trim();
  const originalIndex = Number(op.__originalIndex);
  const confirmationDecision = operationDecisions && Object.prototype.hasOwnProperty.call(operationDecisions, String(originalIndex))
    ? String(operationDecisions[String(originalIndex)] || "")
    : "";
  if (["upsert", "delete"].indexOf(action) < 0 || ["cashSnapshot", "contribution", "etfTrade"].indexOf(target) < 0) {
    throw new Error((index + 1) + "번 작업 형식이 올바르지 않습니다.");
  }
  if (confirmationDecision === "existing") {
    appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, "existing", String(op && (op.key || (op.item && op.item.date)) || ""));
    results.push({ action: "duplicate_user_confirmed", duplicate: true, target: target, key: String(op.key || ""), operationIndex: originalIndex });
    return;
  }
  touched[target] = true;

  if (action === "delete") {
    const key = String(op.key || "").trim();
    if (!key) throw new Error((index + 1) + "번 삭제 키가 없습니다.");

    if (target === "cashSnapshot") {
      if (!isValidDateText(key)) throw new Error((index + 1) + "번 현금성자산 삭제 날짜가 올바르지 않습니다.");
      const before = state.cashSnapshots.length;
      state.cashSnapshots = state.cashSnapshots.filter(function(item) {
        return String(item.date || "") !== key;
      });
      if (state.cashSnapshots.length === before) {
        appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, "absent:" + key, key);
        results.push({ action: "delete_already_absent", duplicate: true, target: target, key: key });
        return;
      }
      appendPensionBatchLedgerOperation(state.operationLedgerShards, op, requestId, "deleted:" + key, key);
      appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, "deleted:" + key, key);
      results.push({ action: "deleted", target: target, key: key });
      return;
    }

    const source = target === "etfTrade" ? state.trades : state.contributions;
    const item = source.find(function(v) {
      return String(v.id || "") === key;
    });
    if (!item) {
      appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, "absent:" + key, key);
      results.push({ action: "delete_already_absent", duplicate: true, target: target, key: key });
      return;
    }

    const linked = findLinkedCashSnapshot(state, item, target);
    if (linked) {
      throw new Error(linked.date + " 현금성자산 기록이 이 " + (target === "etfTrade" ? "추가 매수를" : "기업적립금을") + " 반영하고 있습니다. 해당 날짜 현금성자산 삭제 작업을 작업 모음에 먼저 추가해주세요.");
    }

    if (target === "etfTrade") {
      state.trades = state.trades.filter(function(v) { return String(v.id || "") !== key; });
    } else {
      state.contributions = state.contributions.filter(function(v) { return String(v.id || "") !== key; });
    }
    appendPensionBatchLedgerOperation(state.operationLedgerShards, op, requestId, "deleted:" + key, String(item.date || ""));
    appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, "deleted:" + key, String(item.date || ""));
    results.push({ action: "deleted", target: target, key: key });
    return;
  }

  const item = op.item && typeof op.item === "object" ? op.item : {};
  const memo = String(item.memo || "").trim();

  if (target === "cashSnapshot") {
    const date = String(item.date || "").trim();
    const valuationText = String(item.valuation == null ? "" : item.valuation).replace(/,/g, "").trim();
    const valuation = Number(valuationText);
    const costBasisText = String(item.costBasis == null ? "" : item.costBasis).replace(/,/g, "").trim();
    const costBasis = Number(costBasisText);
    if (!isValidDateText(date)) throw new Error((index + 1) + "번 현금성자산 날짜가 올바르지 않습니다.");
    if (valuationText === "" || !isSafePensionWhole(valuation, false)) throw new Error((index + 1) + "번 현금성자산 평가금액을 안전한 정수로 입력해주세요.");
    if (costBasisText === "" || !isSafePensionWhole(costBasis, false)) throw new Error((index + 1) + "번 현금성자산 매수원금을 안전한 정수로 입력해주세요.");

    const existingBatchSnapshot = state.cashSnapshots.find(function(v) {
      return String(v.date || "") === date &&
        String(v.batchRequestId || "") === requestId &&
        String(v.batchOperationId || "") === String(op.__batchOperationId || "");
    });
    if (existingBatchSnapshot) {
      appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, pensionCashSnapshotVersion(existingBatchSnapshot), date);
      results.push({ action: "duplicate_ignored", duplicate: true, target: target, item: existingBatchSnapshot });
      return;
    }

    const afterTradeIds = state.trades.filter(function(v) { return String(v.date || "") <= date; }).map(function(v) { return String(v.id || ""); }).filter(Boolean);
    const afterContributionIds = state.contributions.filter(function(v) { return String(v.date || "") <= date; }).map(function(v) { return String(v.id || ""); }).filter(Boolean);
    const saved = {
      date: date,
      valuation: valuation,
      costBasis: costBasis,
      memo: memo || "현금성자산 앱 확인",
      updatedBy: "google-apps-script-batch",
      updatedAtKST: nowKST,
      afterTradeIds: afterTradeIds,
      afterContributionIds: afterContributionIds,
      batchRequestId: requestId,
      batchOperationId: String(op.__batchOperationId || ""),
      logicalOperationId: String(op.logicalOperationId || op.__batchOperationId || "")
    };
    state.cashSnapshots = state.cashSnapshots.filter(function(v) { return String(v.date || "") !== date; });
    state.cashSnapshots.push(saved);
    state.cashSnapshots = normalizeItemsForTarget(state.cashSnapshots, "cashSnapshot");
    appendPensionBatchLedgerOperation(state.operationLedgerShards, op, requestId, pensionCashSnapshotVersion(saved), date);
    appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, pensionCashSnapshotVersion(saved), date);
    results.push({ action: "upserted", target: target, item: saved });
    return;
  }

  if (target === "contribution") {
    const date = String(item.date || "").trim();
    const amountText = String(item.amount == null ? "" : item.amount).replace(/,/g, "").trim();
    const amount = Number(amountText);
    if (!isValidDateText(date)) throw new Error((index + 1) + "번 기업적립금 날짜가 올바르지 않습니다.");
    if (amountText === "" || !isSafePensionWhole(amount, true)) throw new Error((index + 1) + "번 기업적립금 금액을 안전한 정수로 입력해주세요.");

    const id = newPensionBatchDeterministicId(requestId, op, "contribution");
    const existing = state.contributions.find(function(v) { return String(v.id || "") === id; });
    if (existing) {
      appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, id, date);
      results.push({ action: "duplicate_ignored", duplicate: true, target: target, item: existing });
      return;
    }

    const saved = {
      id: id,
      date: date,
      amount: amount,
      memo: memo || makeDefaultMemo(date),
      logicalOperationId: String(op.logicalOperationId || op.__batchOperationId || ""),
      updatedBy: "google-apps-script-batch",
      updatedAtKST: nowKST
    };
    state.contributions.push(saved);
    state.contributions = normalizeItemsForTarget(state.contributions, "contribution");
    appendPensionBatchLedgerOperation(state.operationLedgerShards, op, requestId, id, date);
    appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, id, date);
    results.push({ action: "created", target: target, item: saved });
    return;
  }

  const tradeDate = String(item.tradeDate || "").trim();
  const ticker = String(item.ticker || "").trim();
  const qtyText = String(item.qty == null ? "" : item.qty).replace(/,/g, "").trim();
  const amountText = String(item.amount == null ? "" : item.amount).replace(/,/g, "").trim();
  const qty = Number(qtyText);
  const amount = Number(amountText);
  if (!isValidDateText(tradeDate)) throw new Error((index + 1) + "번 추가 매수 신청일이 올바르지 않습니다.");
  if (tradeDate > nowDate) throw new Error((index + 1) + "번 추가 매수 신청일은 앱 반영일보다 늦을 수 없습니다.");
  const product = state.products.find(function(v) {
    return String(v && v.ticker || "").trim() === ticker;
  });
  if (!product) throw new Error((index + 1) + "번 추가 매수 상품이 등록된 퇴직연금 ETF가 아닙니다.");
  if (qtyText === "" || !isSafePensionWhole(qty, true)) throw new Error((index + 1) + "번 추가 매수 수량을 안전한 정수로 입력해주세요.");
  if (amountText === "" || !isSafePensionWhole(amount, true)) throw new Error((index + 1) + "번 추가 매수 체결금액을 안전한 정수로 입력해주세요.");

  const id = newPensionBatchDeterministicId(requestId, op, "etfTrade");
  const existing = state.trades.find(function(v) { return String(v.id || "") === id; });
  if (existing) {
    appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, id, nowDate);
    results.push({ action: "duplicate_ignored", duplicate: true, target: target, item: existing });
    return;
  }

  const roundedAmount = amount;
  const cashBefore = calculatePensionCashAvailableFromState(nowDate, state);
  if (!Number.isSafeInteger(cashBefore)) throw new Error((index + 1) + "번 추가 매수의 현재 현금성자산을 안전한 정수로 계산하지 못했습니다.");
  if (cashBefore < roundedAmount) {
    throw new Error((index + 1) + "번 추가 매수 시점의 현금성자산 " + Math.round(cashBefore).toLocaleString("ko-KR") + "원보다 체결금액 " + roundedAmount.toLocaleString("ko-KR") + "원이 큽니다. 기업적립금/현금성자산 작업 순서를 확인해주세요.");
  }

  const resolvedName = String(product.name || item.name || "").trim();
  const roundedCashBefore = Math.round(cashBefore);
  const saved = {
    id: id,
    date: nowDate,
    applyDate: nowDate,
    tradeDate: tradeDate,
    ticker: ticker,
    name: resolvedName,
    type: "buy",
    qty: qty,
    price: roundedAmount / qty,
    amount: roundedAmount,
    funding: "pension_cash",
    cashBeforeDate: nowDate,
    cashBefore: roundedCashBefore,
    cashAfter: safePensionSubtract(roundedCashBefore, roundedAmount, "퇴직연금 추가 매수 후 현금성자산"),
    memo: memo || ("신청일 " + tradeDate + " · " + resolvedName + " " + qty + "좌 매수 체결 · 앱 반영일 " + nowDate),
    logicalOperationId: String(op.logicalOperationId || op.__batchOperationId || ""),
    updatedBy: "google-apps-script-batch",
    updatedAtKST: nowKST,
    appliedAtKST: nowKST
  };
  state.trades.push(saved);
  state.trades = normalizeItemsForTarget(state.trades, "etfTrade");
  appendPensionBatchLedgerOperation(state.operationLedgerShards, op, requestId, id, nowDate);
  appendPensionBatchIdentityOperation(state.operationIdentityShards, op, requestId, id, nowDate);
  results.push({ action: "created", target: target, item: saved });
}

/* --- 08C. Batch File Changes / Atomic Commit ------------------------------ */

function buildPensionBatchFileChanges(state, initialPayloads, touched) {
  const fileChanges = [];
  function addChangeIfDifferent(target, data) {
    if (!touched[target]) return;
    if (canonicalPensionBatchJson(initialPayloads[target]) === canonicalPensionBatchJson(data)) return;
    fileChanges.push({ path: getDataPath(target), data: data });
  }
  addChangeIfDifferent("cashSnapshot", dataForTarget(state.cashSnapshots, "cashSnapshot"));
  addChangeIfDifferent("contribution", dataForTarget(state.contributions, "contribution"));
  addChangeIfDifferent("etfTrade", dataForTarget(state.trades, "etfTrade"));
  Object.keys(state.operationLedgerShards || {}).sort().forEach(function(path) {
    const shard = state.operationLedgerShards[path];
    if (canonicalPensionBatchJson(shard.initial) !== canonicalPensionBatchJson(shard.items)) {
      fileChanges.push({ path: path, data: shard.items });
    }
  });
  Object.keys(state.operationIdentityShards || {}).sort().forEach(function(path) {
    const shard = state.operationIdentityShards[path];
    if (canonicalPensionBatchJson(shard.initial) !== canonicalPensionBatchJson(shard.items)) {
      fileChanges.push({ path: path, data: shard.items });
    }
  });
  const batchRequestIdentityChange = pensionBatchRequestIdentityFileChange(state.batchRequestIdentityContext);
  if (batchRequestIdentityChange) fileChanges.push(batchRequestIdentityChange);
  return fileChanges;
}

function handlePensionBatch(body, expectedBaseCommitSha, requestCache, operationDecisions, timing) {
  const rawOperations = Array.isArray(body.operations) ? body.operations : [];
  if (!rawOperations.length) {
    return { ok: false, error: "작업 모음이 비어 있습니다." };
  }
  if (rawOperations.length > 100) {
    return { ok: false, error: "한 번에 처리할 수 있는 작업은 최대 100건입니다." };
  }

  const requestId = String(body.batchRequestId || "").trim();
  const operations = normalizePensionBatchOperations(rawOperations, true);
  assertPensionBatchUniqueLogicalIdentities(operations);

  let stageStartedAtMs = Date.now();
  const baseCommitSha = String(expectedBaseCommitSha || getGithubBranchHeadSha());
  recordPensionTimingStage(timing, "batchBaseHead", stageStartedAtMs);
  if (!baseCommitSha) {
    return { ok: false, error: "GitHub 기준 커밋을 확인하지 못했습니다." };
  }

  stageStartedAtMs = Date.now();
  primePensionBatchStateReadCache(requestId, baseCommitSha, requestCache);
  let detailStartedAtMs = Date.now();
  const cashCurrent = readPensionTarget("cashSnapshot", baseCommitSha, requestCache);
  recordPensionTimingDetail(timing, "stateRead", "cashSnapshot", detailStartedAtMs);
  detailStartedAtMs = Date.now();
  const contributionCurrent = readPensionTarget("contribution", baseCommitSha, requestCache);
  recordPensionTimingDetail(timing, "stateRead", "contribution", detailStartedAtMs);
  detailStartedAtMs = Date.now();
  const tradeCurrent = readPensionTarget("etfTrade", baseCommitSha, requestCache);
  recordPensionTimingDetail(timing, "stateRead", "etfTrade", detailStartedAtMs);
  detailStartedAtMs = Date.now();
  const pricesCurrent = readGithubJsonRequestCached("data/prices.json", baseCommitSha, requestCache);
  recordPensionTimingDetail(timing, "stateRead", "prices", detailStartedAtMs);
  detailStartedAtMs = Date.now();
  const portfolioCurrent = readGithubJsonRequestCached("data/portfolio.json", baseCommitSha, requestCache);
  recordPensionTimingDetail(timing, "stateRead", "portfolio", detailStartedAtMs);
  recordPensionTimingStage(timing, "stateSnapshotRead", stageStartedAtMs);
  stageStartedAtMs = Date.now();
  const operationLedgerShards = preparePensionBatchLedgerOperations(operations, baseCommitSha, requestCache);
  recordPensionTimingStage(timing, "semanticLedgerRead", stageStartedAtMs);
  stageStartedAtMs = Date.now();
  const operationIdentityShards = preparePensionBatchIdentityOperations(operations, requestId, baseCommitSha, requestCache);
  recordPensionTimingStage(timing, "exactIdentityLedgerRead", stageStartedAtMs);
  const batchRequestOperationsHash = pensionBatchOperationsHash(rawOperations);
  stageStartedAtMs = Date.now();
  const batchRequestIdentityContext = loadPensionBatchRequestIdentityContext(requestId, baseCommitSha, requestCache);
  recordPensionTimingStage(timing, "batchRequestIdentityRead", stageStartedAtMs);
  const existingBatchRequestIdentity = assertPensionBatchRequestIdentityCompatible(batchRequestIdentityContext, batchRequestOperationsHash);
  if (existingBatchRequestIdentity && String(existingBatchRequestIdentity.status || "") === "terminal_stale") {
    throw new Error("이 batchRequestId는 terminal stale로 종료되어 다시 적용할 수 없습니다. 작업 모음을 새로 구성해 다시 시도해주세요.");
  }
  appendPensionBatchRequestIdentity(batchRequestIdentityContext, requestId, batchRequestOperationsHash, "completed", { reason: "batch_applied" });

  const initialState = {
    cashSnapshots: cashCurrent.items,
    contributions: contributionCurrent.items,
    trades: tradeCurrent.items,
    prices: pricesCurrent.data || {},
    products: portfolioCurrent.data && Array.isArray(portfolioCurrent.data.pension) ? portfolioCurrent.data.pension : []
  };
  assertPensionBatchCashPreconditions(operations, initialState, operationDecisions);

  const initialPayloads = {
    cashSnapshot: dataForTarget(initialState.cashSnapshots, "cashSnapshot"),
    contribution: dataForTarget(initialState.contributions, "contribution"),
    etfTrade: dataForTarget(initialState.trades, "etfTrade")
  };
  const state = {
    cashSnapshots: initialState.cashSnapshots.map(function(v) { return Object.assign({}, v); }),
    contributions: initialState.contributions.map(function(v) { return Object.assign({}, v); }),
    trades: initialState.trades.map(function(v) { return Object.assign({}, v); }),
    prices: initialState.prices,
    products: initialState.products,
    operationLedgerShards: operationLedgerShards,
    operationIdentityShards: operationIdentityShards,
    batchRequestIdentityContext: batchRequestIdentityContext
  };

  const orderInfo = orderPensionBatchOperations(operations, initialState);
  const nowKST = nowKSTText();
  const nowDate = nowKST.slice(0, 10);
  const touched = {};
  const results = [];


  stageStartedAtMs = Date.now();
  orderInfo.operations.forEach(function(rawOp, index) {
    applyPensionBatchOperation(state, rawOp, index, requestId, operationDecisions, nowKST, nowDate, touched, results);
  });
  recordPensionTimingStage(timing, "operationApply", stageStartedAtMs);

  stageStartedAtMs = Date.now();
  const fileChanges = buildPensionBatchFileChanges(state, initialPayloads, touched);
  recordPensionTimingStage(timing, "commitPrepare", stageStartedAtMs);
  if (!fileChanges.length) {
    return {
      ok: true,
      action: "batch_duplicate_ignored",
      duplicate: true,
      operationsApplied: rawOperations.length,
      reordered: orderInfo.reordered,
      commitSha: baseCommitSha,
      changedFiles: [],
      results: results,
      state: {
        cashSnapshots: state.cashSnapshots,
        contributions: state.contributions,
        trades: state.trades
      },
      message: "이미 동일한 작업 모음 상태가 반영되어 있습니다. 중복 커밋은 만들지 않았습니다."
    };
  }

  stageStartedAtMs = Date.now();
  const commit = writeGithubJsonBatch(
    baseCommitSha,
    fileChanges,
    "Apply pension batch (" + rawOperations.length + " operations)" + (requestId ? " [" + requestId + "]" : "")
  );
  recordPensionTimingStage(timing, "githubCommit", stageStartedAtMs);

  return {
    ok: true,
    action: "batch_applied",
    operationsApplied: rawOperations.length,
    reordered: orderInfo.reordered,
    commitSha: commit.sha || "",
    changedFiles: fileChanges.map(function(v) { return v.path; }),
    results: results,
    state: {
      cashSnapshots: state.cashSnapshots,
      contributions: state.contributions,
      trades: state.trades
    }
  };
}

/* =========================================================
 * 09. Pension Idempotency / Retry / Batch Orchestration
 * ========================================================= */

// batch 작업 내용을 안정적으로 hash하기 위한 canonical JSON 문자열을 만든다.

/* --- 09A. Canonical Hash / Request Identity ------------------------------- */

function canonicalPensionBatchJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalPensionBatchJson).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map(function(key) {
      return JSON.stringify(key) + ":" + canonicalPensionBatchJson(value[key]);
    }).join(",") + "}";
  }
  return JSON.stringify(value);
}

// 공통 SHA-256 hex helper.
function sha256HexText(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ""),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(value) {
    const unsigned = value < 0 ? value + 256 : value;
    return ("0" + unsigned.toString(16)).slice(-2);
  }).join("");
}

// batch operations의 SHA-256 hash를 계산한다.
function pensionBatchOperationsHash(operations) {
  return sha256HexText(canonicalPensionBatchJson(Array.isArray(operations) ? operations : []));
}

// frontend가 보낸 operationId를 우선 사용하고, legacy client는 내용 기반 fallback key를 만든다.
function pensionBatchOperationIdentity(operation, index) {
  const supplied = String(operation && operation.operationId || "").trim();
  if (supplied) {
    if (!/^[A-Za-z0-9._:-]{8,180}$/.test(supplied)) {
      throw new Error((Number(index) + 1) + "번 operationId 형식이 올바르지 않습니다.");
    }
    return supplied;
  }

  const legacySource = {
    action: String(operation && operation.action || ""),
    target: String(operation && operation.target || ""),
    key: String(operation && operation.key || ""),
    item: operation && operation.item && typeof operation.item === "object" ? operation.item : null,
    index: Number(index) || 0
  };
  return "legacy-op-" + sha256HexText(canonicalPensionBatchJson(legacySource)).slice(0, 28);
}

// batchRequestId + operation identity + item 내용으로 재시도 시 항상 같은 저장 ID를 만든다.
function newPensionBatchDeterministicId(requestId, operation, target) {
  const source = [
    String(requestId || ""),
    String(operation && operation.__batchOperationId || ""),
    String(target || ""),
    canonicalPensionBatchJson(operation && operation.item && typeof operation.item === "object" ? operation.item : null)
  ].join("|");
  const prefix = target === "etfTrade" ? "trade-batch-" : "contrib-batch-";
  return prefix + sha256HexText(source).slice(0, 32);
}

// 단건 upsert의 완료 receipt / 진행 intent. resource가 이후 update/delete되어도
// 오래된 retry가 다시 mutation하지 않도록 request identity를 resource 밖에 보존한다.
function pensionSingleRequestKey(target, identity) {
  return String(target || "") + "|" + String(identity || "");
}

function pensionSingleRequestHash(payload) {
  return sha256HexText(canonicalPensionBatchJson(payload || {}));
}

function requestDirectPropertyKey(prefix, identity) {
  return String(prefix || "") + sha256HexText(String(identity || "")).slice(0, 32);
}

function parsePensionDirectProperty(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function clearDirectRequestProperty(prefix, identity, rethrowFailure) {
  const props = PropertiesService.getScriptProperties();
  const key = requestDirectPropertyKey(prefix, identity);
  try {
    if (rethrowFailure || typeof props.deleteProperty === "function") props.deleteProperty(key);
    else props.setProperty(key, "");
    return true;
  } catch (err) {
    let cleared = false;
    try { cleared = !parsePensionDirectProperty(props.getProperty(key)); } catch (_) {}
    if (cleared) return true;
    if (rethrowFailure) throw err;
    return false;
  }
}

/* --- 09B. Single Receipt / Intent / Local Idempotency --------------------- */

function readLegacyArrayProperty(propertyName) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(String(propertyName || "")) || "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function findPensionRequestReceipt(requestKey) {
  const props = PropertiesService.getScriptProperties();
  const direct = parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("PENSION_REQ_R_", requestKey)));
  if (direct) return direct;
  // 이전 array 형식이 남아 있으면 read-only fallback으로만 인식한다.
  return readLegacyArrayProperty("PENSION_REQUEST_RECEIPTS").find(function(item) {
    return item && String(item.key || "") === String(requestKey || "");
  }) || null;
}

function rememberPensionRequestReceipt(requestKey, requestHash, target) {
  const props = PropertiesService.getScriptProperties();
  setDirectRequestProperty(props, "PENSION_REQ_R_", requestDirectPropertyKey("PENSION_REQ_R_", requestKey), {
    key: String(requestKey || ""),
    hash: String(requestHash || ""),
    target: String(target || ""),
    terminalStale: false,
    savedAtKST: nowKSTText(),
    savedAtMs: Date.now()
  });
}

function rememberPensionRequestTerminalReceipt(requestKey, requestHash, target, reason) {
  const props = PropertiesService.getScriptProperties();
  setDirectRequestProperty(props, "PENSION_REQ_R_", requestDirectPropertyKey("PENSION_REQ_R_", requestKey), {
    key: String(requestKey || ""),
    hash: String(requestHash || ""),
    target: String(target || ""),
    terminalStale: true,
    reason: String(reason || "terminal_stale"),
    savedAtKST: nowKSTText(),
    savedAtMs: Date.now()
  });
}


function findPensionRequestIntent(requestKey) {
  const props = PropertiesService.getScriptProperties();
  const direct = parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("PENSION_REQ_I_", requestKey)));
  if (direct) return direct;
  return readLegacyArrayProperty("PENSION_REQUEST_INTENTS").find(function(item) {
    return item && String(item.key || "") === String(requestKey || "");
  }) || null;
}

function rememberPensionRequestIntent(requestKey, requestHash, target, baseSha, mutationEpoch, dependencyHash, retryablePrecommit, retryableEpoch, identityMeta) {
  const props = PropertiesService.getScriptProperties();
  setDirectRequestProperty(props, "PENSION_REQ_I_", requestDirectPropertyKey("PENSION_REQ_I_", requestKey), {
    key: String(requestKey || ""),
    hash: String(requestHash || ""),
    target: String(target || ""),
    baseSha: String(baseSha || ""),
    mutationEpoch: Number(mutationEpoch || 0),
    dependencyHash: String(dependencyHash || ""),
    retryablePrecommit: retryablePrecommit === true,
    retryableEpoch: Number(retryableEpoch || 0),
    terminalPending: identityMeta && identityMeta.terminalPending === true,
    terminalReason: String(identityMeta && identityMeta.terminalReason || ""),
    requestId: String(identityMeta && identityMeta.requestId || pensionSingleRequestIdFromKey(requestKey)),
    logicalOperationId: String(identityMeta && identityMeta.logicalOperationId || ""),
    action: String(identityMeta && identityMeta.action || ""),
    savedAtKST: nowKSTText(),
    savedAtMs: Date.now()
  });
}

function clearPensionRequestIntent(requestKey) {
  return clearDirectRequestProperty("PENSION_REQ_I_", requestKey, false);
}

function reserveAndRememberPensionSingleIntent(requestKey, requestHash, target, baseSha, dependencyHash, identityMeta) {
  const mutationEpoch = reserveNextPensionMutationEpoch();
  try {
    rememberPensionRequestIntent(requestKey, requestHash, target, baseSha, mutationEpoch, dependencyHash, false, 0, identityMeta || {});
    return mutationEpoch;
  } catch (err) {
    const saved = findPensionRequestIntent(requestKey);
    if (saved && String(saved.hash || "") === String(requestHash || "") && Number(saved.mutationEpoch || 0) === mutationEpoch && saved.retryablePrecommit !== true) {
      return mutationEpoch;
    }
    try { rollbackPensionMutationEpoch(mutationEpoch); } catch (_) {}
    throw err;
  }
}

function transitionPensionSingleIntentToRetryable(context, target, baseSha, dependencyHash) {
  if (!context || !context.key) return false;
  const currentEpoch = getPensionMutationEpoch();
  const reservedEpoch = Number(context.mutationEpoch || 0);
  if (!reservedEpoch || currentEpoch !== reservedEpoch) return false;
  const retryableEpoch = reservedEpoch - 1;
  try {
    rememberPensionRequestIntent(
      context.key, context.hash, target, baseSha, 0, dependencyHash, true, retryableEpoch,
      { requestId: String(context.requestId || pensionSingleRequestIdFromKey(context.key)), logicalOperationId: String(context.logicalOperationId || ""), action: String(context.action || "") }
    );
  } catch (err) {
    const saved = findPensionRequestIntent(context.key);
    const applied = saved && String(saved.hash || "") === String(context.hash || "") && saved.retryablePrecommit === true && Number(saved.retryableEpoch || 0) === retryableEpoch;
    if (!applied) throw err;
  }
  if (!rollbackPensionMutationEpoch(reservedEpoch)) {
    try {
      rememberPensionRequestIntent(
        context.key, context.hash, target, baseSha, reservedEpoch, dependencyHash, false, 0,
        { requestId: String(context.requestId || pensionSingleRequestIdFromKey(context.key)), logicalOperationId: String(context.logicalOperationId || ""), action: String(context.action || "") }
      );
    } catch (_) {}
    return false;
  }
  return true;
}

// terminal stale 판정이 난 뒤 durable GitHub tombstone 쓰기가 일시 실패해도
// 동일 requestId가 다시 active mutation으로 돌아가지 않도록 local intent부터 terminal-pending으로 고정한다.
function markPensionSingleIntentTerminalPending(requestKey, requestHash, target, reason, identityMeta) {
  const existing = findPensionRequestIntent(requestKey);
  if (!existing || String(existing.hash || "") !== String(requestHash || "")) return { marked: false, mutationEpoch: 0 };
  const meta = {
    requestId: String(identityMeta && identityMeta.requestId || existing.requestId || pensionSingleRequestIdFromKey(requestKey)),
    logicalOperationId: String(identityMeta && identityMeta.logicalOperationId || existing.logicalOperationId || ""),
    action: String(identityMeta && identityMeta.action || existing.action || ""),
    terminalPending: true,
    terminalReason: String(reason || existing.terminalReason || "terminal_stale")
  };
  try {
    rememberPensionRequestIntent(
      requestKey, requestHash, target,
      String(existing.baseSha || ""), Number(existing.mutationEpoch || 0), String(existing.dependencyHash || ""),
      false, 0, meta
    );
  } catch (err) {
    const saved = findPensionRequestIntent(requestKey);
    const applied = saved && String(saved.hash || "") === String(requestHash || "") && saved.terminalPending === true;
    if (!applied) throw err;
  }
  const saved = findPensionRequestIntent(requestKey) || existing;
  return { marked: true, mutationEpoch: Number(saved.mutationEpoch || existing.mutationEpoch || 0) };
}

// 아직 active intent를 만들기 전 precondition에서 stale가 확정된 경우에도
// terminal-pending intent를 먼저 남겨 응답 유실 뒤 identity가 새 요청으로 부활하지 않게 한다.
function beginPensionSingleTerminalPending(requestKey, requestHash, target, currentSha, dependencyHash, reason, identityMeta) {
  const meta = Object.assign({}, identityMeta || {}, {
    terminalPending: true,
    terminalReason: String(reason || "terminal_stale")
  });
  return reserveAndRememberPensionSingleIntent(requestKey, requestHash, target, currentSha, dependencyHash, meta);
}

function finalizePensionSingleTerminalStale(requestKey, requestHash, target, result, identityMeta, reservedEpoch) {
  const terminalReason = String(result && (result.reason || result.action) || "terminal_stale");
  const initialIntent = findPensionRequestIntent(requestKey);
  let intent = Object.assign({}, initialIntent || {}, identityMeta || {});
  let localTerminalEvidence = !!(initialIntent && String(initialIntent.hash || "") === String(requestHash || "") && initialIntent.terminalPending === true);

  // stale 판정은 local terminal-pending 또는 durable tombstone 중 최소 하나가 실제 남은 뒤에만 확정한다.
  // 둘 다 저장되지 않은 상태에서 stale 성공 응답을 반환하면 응답 유실 뒤 같은 identity가 mutation으로 부활할 수 있다.
  if (initialIntent && String(initialIntent.hash || "") === String(requestHash || "") && !localTerminalEvidence) {
    try {
      const marked = markPensionSingleIntentTerminalPending(requestKey, requestHash, target, terminalReason, identityMeta || {});
      if (marked.marked) {
        localTerminalEvidence = true;
        intent = Object.assign({}, findPensionRequestIntent(requestKey) || intent, identityMeta || {});
        if (!Number(reservedEpoch || 0) && Number(marked.mutationEpoch || 0)) reservedEpoch = Number(marked.mutationEpoch || 0);
      }
    } catch (_) {}
  }

  let durableState = { stored: false, status: "", match: null };
  try { durableState = rememberPensionSingleTerminalIdentityState(requestKey, requestHash, target, intent); } catch (_) {}
  const durableTerminalEvidence = durableState.stored === true;
  if (!localTerminalEvidence && !durableTerminalEvidence) {
    throw new Error("stale 요청의 terminal identity를 안전하게 보존하지 못했습니다. 요청을 확정 종료하지 않았습니다. 잠시 후 동일 요청으로 다시 시도해주세요.");
  }

  if (durableTerminalEvidence) {
    // stale_view_rejected처럼 이 실행에서 business mutation이 전혀 없었던 경우에는
    // durable terminal identity를 먼저 확보한 뒤 예약 epoch만 되돌린다. 더 최신 epoch면 건드리지 않는다.
    const epoch = Number(reservedEpoch || 0);
    if (epoch > 0) {
      try { rollbackPensionMutationEpoch(epoch); } catch (_) {}
    }
    if (String(durableState.status || "") === "completed") {
      return { hasIdentity: true, result: pensionSingleDurableIdentityResult(requestKey, requestHash, target, durableState.match, { requestId: String(intent.requestId || pensionSingleRequestIdFromKey(requestKey)), logicalOperationId: String(intent.logicalOperationId || "") }) };
    }
    finishPensionSingleTerminalRequest(requestKey, requestHash, target, terminalReason);
  }
  // durable write가 실패해도 local terminal-pending이 실제 남아 있으면 mutation 경로는 봉쇄된다.
  return { hasIdentity: true, result: result };
}

/* --- 09C. Single Durable Recovery / Retry Causality ----------------------- */

function pensionSingleLedgerSuccessProof(ledgerContext, logicalOperationId, requestId, target, ref, requestCache) {
  if (!ledgerContext) return null;
  const logicalId = String(logicalOperationId || "");
  const reqId = String(requestId || "");
  const expectedSemanticHash = String(ledgerContext.semanticHash || "");
  const lists = [Array.isArray(ledgerContext.items) ? ledgerContext.items : []];
  // cashSnapshot은 과거 단일 ledger 파일을 사용한 이력이 있으므로 active-intent 복구에서도
  // legacy ledger를 같은 full semanticHash + exact identity 기준으로 성공 proof에 포함한다.
  if (String(target || "") === "cashSnapshot" && ref) {
    const legacy = readLegacyPensionOperationLedger(ref, requestCache);
    lists.push(Array.isArray(legacy && legacy.items) ? legacy.items : []);
  }
  for (let l = 0; l < lists.length; l += 1) {
    const list = lists[l];
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const entry = list[index] || {};
      // 같은 2자리 shard 안의 다른 semanticHash entry를 exact 성공 proof로 오인하지 않는다.
      if (expectedSemanticHash && String(entry.semanticHash || "") !== expectedSemanticHash) continue;
      if (logicalId && String(entry.logicalOperationId || "") === logicalId) return entry;
      if (reqId && String(entry.requestId || "") === reqId) return entry;
    }
  }
  return null;
}

function ensurePensionSingleIdentityFromLedgerProof(target, identity, contentHash, proof) {
  const normalizedTarget = String(target || "");
  const value = identity || {};
  const expectedHash = String(contentHash || "");
  if (!normalizedTarget || !expectedHash || !proof) return { stored: false, status: "", match: null };
  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const head = getGithubBranchHeadSha();
    if (!head) throw new Error("Pension legacy success identity backfill 기준 커밋을 확인하지 못했습니다.");
    const context = loadPensionOperationIdentityContext(normalizedTarget, value, head);
    const existing = assertPensionOperationIdentityCompatible(context, expectedHash);
    if (existing) return ensurePensionSingleDurableIdentityComplete(normalizedTarget, value, expectedHash);

    const entry = makePensionOperationLedgerEntry(normalizedTarget, String(proof.action || "duplicate"), {
      resourceKey: String(proof.resourceKey || ""),
      logicalOperationId: String(value.logicalOperationId || proof.logicalOperationId || ""),
      requestId: String(value.requestId || proof.requestId || ""),
      resultVersion: String(proof.resultVersion || "")
    });
    entry.semanticHash = String(proof.semanticHash || entry.semanticHash || "");
    entry.resourceKey = String(proof.resourceKey || entry.resourceKey || "");
    appendPensionOperationIdentityEntries(context, normalizedTarget, String(proof.action || "duplicate"), expectedHash, entry);
    const changes = pensionOperationIdentityContextFileChanges(context);
    if (!changes.length) return { stored: true, status: "completed", match: entry };
    if (tryDurableGithubJsonBatchWrite(
      head, changes,
      "Backfill pension identity from operation ledger " + normalizedTarget + " [" + String(value.requestId || value.logicalOperationId || "") + "]",
      attempt
    )) return { stored: true, status: "completed", match: entry };
  }
  return { stored: false, status: "", match: null };
}

function ensurePensionSingleIdentityFromReceipt(target, identity, contentHash, terminalStale, action, semanticHash) {
  const normalizedTarget = String(target || "");
  const value = identity || {};
  const expectedHash = String(contentHash || "");
  if (!normalizedTarget || !expectedHash || !pensionOperationIdentityKeys(normalizedTarget, value).length) {
    return { stored: false, status: "", match: null };
  }
  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const head = getGithubBranchHeadSha();
    if (!head) throw new Error("Pension receipt identity backfill 기준 커밋을 확인하지 못했습니다.");
    const context = loadPensionOperationIdentityContext(normalizedTarget, value, head);
    const existing = assertPensionOperationIdentityCompatible(context, expectedHash);
    if (existing) return ensurePensionSingleDurableIdentityComplete(normalizedTarget, value, expectedHash);
    const entryAction = terminalStale ? "terminal_stale" : String(action || "receipt_recovered");
    const entry = makePensionOperationLedgerEntry(normalizedTarget, entryAction, {
      logicalOperationId: String(value.logicalOperationId || ""),
      requestId: String(value.requestId || ""),
      resultVersion: terminalStale ? "terminal-stale" : "receipt-recovered"
    });
    if (semanticHash) entry.semanticHash = String(semanticHash);
    appendPensionOperationIdentityEntries(context, normalizedTarget, entryAction, expectedHash, entry);
    const changes = pensionOperationIdentityContextFileChanges(context);
    if (!changes.length) return { stored: true, status: terminalStale ? "terminal_stale" : "completed", match: entry };
    if (tryDurableGithubJsonBatchWrite(
      head, changes,
      "Backfill pension identity from receipt " + normalizedTarget + " [" + String(value.requestId || value.logicalOperationId || "") + "]",
      attempt
    )) return { stored: true, status: terminalStale ? "terminal_stale" : "completed", match: entry };
  }
  return { stored: false, status: "", match: null };
}

function inspectPensionSingleRequestIdentity(requestKey, requestHash, target, currentSha, action, dependencyHashOverride, successProofContext) {
  const receipt = findPensionRequestReceipt(requestKey);
  if (receipt) {
    if (String(receipt.hash || "") !== String(requestHash || "")) {
      throw new Error("동일한 요청 identity가 다른 저장 내용에 이미 사용되었습니다. 새로고침 후 다시 시도하세요.");
    }
    // v17 이전에 terminal_stale durable identity가 일반 completed receipt로 잘못 번역된 이력이 있어도
    // durable identity가 준비된 요청은 GitHub 상태를 우선해 receipt 의미를 자동 교정한다.
    const durableReceiptProof = successProofContext && successProofContext.identityContext
      ? assertPensionOperationIdentityCompatible(successProofContext.identityContext, successProofContext.requestHash || requestHash)
      : null;
    if (durableReceiptProof) {
      return { hasIdentity: true, result: pensionSingleDurableIdentityResult(requestKey, requestHash, target, durableReceiptProof, { requestId: String(successProofContext && successProofContext.requestId || pensionSingleRequestIdFromKey(requestKey)), logicalOperationId: String(successProofContext && successProofContext.logicalOperationId || "") }) };
    }
    const terminalStale = receipt.terminalStale === true;
    const receiptIdentity = {
      requestId: String(successProofContext && successProofContext.requestId || pensionSingleRequestIdFromKey(requestKey)),
      logicalOperationId: String(successProofContext && successProofContext.logicalOperationId || "")
    };
    const migratedReceiptIdentity = ensurePensionSingleIdentityFromReceipt(
      target, receiptIdentity, requestHash, terminalStale, action,
      String(successProofContext && successProofContext.ledgerContext && successProofContext.ledgerContext.semanticHash || "")
    );
    if (!migratedReceiptIdentity || migratedReceiptIdentity.stored !== true) {
      throw new Error("Pension receipt를 durable exact identity로 안전하게 backfill하지 못했습니다.");
    }
    return { hasIdentity: true, result: pensionSingleDurableIdentityResult(
      requestKey, requestHash, target, migratedReceiptIdentity.match, receiptIdentity
    ) };
  }

  const intent = findPensionRequestIntent(requestKey);
  if (!intent) return { hasIdentity: false, result: null };
  if (String(intent.hash || "") !== String(requestHash || "")) {
    throw new Error("동일한 요청 identity가 다른 저장 내용으로 처리 중이거나 재시도되었습니다. 새로고침 후 다시 시도하세요.");
  }

  const proof = successProofContext && pensionSingleLedgerSuccessProof(
    successProofContext.ledgerContext,
    successProofContext.logicalOperationId,
    successProofContext.requestId,
    target,
    successProofContext.ref || currentSha,
    successProofContext.requestCache
  );
  if (proof) {
    const proofIdentity = {
      requestId: String(successProofContext && successProofContext.requestId || pensionSingleRequestIdFromKey(requestKey)),
      logicalOperationId: String(successProofContext && successProofContext.logicalOperationId || "")
    };
    const durableProof = ensurePensionSingleIdentityFromLedgerProof(target, proofIdentity, requestHash, proof);
    if (!durableProof || durableProof.stored !== true) {
      throw new Error("Pension operation ledger 성공 proof를 exact identity로 안전하게 backfill하지 못했습니다.");
    }
    finishPensionSingleRequest(requestKey, requestHash, target);
    return { hasIdentity: true, result: {
      ok: true, target: target, action: "duplicate_ignored", duplicate: true, stale: false, completed: true,
      message: "GitHub operation ledger에서 이 요청의 성공 반영을 확인하고 exact identity를 복구했습니다. 중복 mutation은 만들지 않았습니다."
    }};
  }

  const identityProof = successProofContext && successProofContext.identityContext
    ? assertPensionOperationIdentityCompatible(successProofContext.identityContext, successProofContext.requestHash || requestHash)
    : null;
  if (identityProof) {
    return { hasIdentity: true, result: pensionSingleDurableIdentityResult(requestKey, requestHash, target, identityProof, { requestId: String(successProofContext && successProofContext.requestId || intent.requestId || pensionSingleRequestIdFromKey(requestKey)), logicalOperationId: String(successProofContext && successProofContext.logicalOperationId || intent.logicalOperationId || "") }) };
  }

  if (intent.terminalPending === true) {
    return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
      ok: true, target: target, action: "stale_retry_ignored", duplicate: true, stale: true,
      reason: String(intent.terminalReason || "terminal_stale"),
      message: "이미 stale로 확정된 과거 저장 요청입니다. 최신 상태를 유지했습니다."
    }, {
      requestId: String(intent.requestId || pensionSingleRequestIdFromKey(requestKey)),
      logicalOperationId: String(intent.logicalOperationId || ""), action: String(intent.action || action || "")
    }, Number(intent.mutationEpoch || 0));
  }

  if (intent.retryablePrecommit === true) {
    const retryableEpoch = Number(intent.retryableEpoch || 0);
    if (retryableEpoch !== getPensionMutationEpoch()) {
      return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
        ok: true, target: target, action: "stale_retry_ignored", duplicate: true, stale: true,
        message: "이 실패 요청 이후 더 최신 퇴직연금 작업이 처리되어 과거 요청을 다시 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
      });
    }
    const dependencyHash = String(dependencyHashOverride || pensionSingleDependencyHash(action || "upsert", target));
    if (intent.dependencyHash && String(intent.dependencyHash || "") !== String(dependencyHash || "")) {
      return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
        ok: true, target: target, action: "stale_retry_ignored", duplicate: true, stale: true,
        message: "이 실패 요청 이후 의존 데이터가 변경되어 과거 요청을 다시 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
      });
    }
    reserveAndRememberPensionSingleIntent(requestKey, requestHash, target, currentSha, dependencyHash, {
      requestId: String(successProofContext && successProofContext.requestId || pensionSingleRequestIdFromKey(requestKey)),
      logicalOperationId: String(successProofContext && successProofContext.logicalOperationId || ""),
      action: String(action || "")
    });
    return { hasIdentity: true, result: null };
  }

  const activeDependencyHash = String(dependencyHashOverride || pensionSingleDependencyHash(action || "upsert", target));
  if (intent.dependencyHash && String(intent.dependencyHash || "") !== activeDependencyHash) {
    return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
      ok: true, target: target, action: "stale_retry_ignored", duplicate: true, stale: true,
      message: "이 요청이 시작된 뒤 의존 데이터가 변경되어 과거 요청을 다시 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
    });
  }

  const intentEpoch = Number(intent.mutationEpoch || 0);
  if (intentEpoch > 0 && intentEpoch !== getPensionMutationEpoch()) {
    return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
      ok: true, target: target, action: "stale_retry_ignored", duplicate: true, stale: true,
      message: "이 요청 이후 더 최신 퇴직연금 작업이 시작되어 오래된 재시도를 다시 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
    });
  }
  if (String(intent.baseSha || "") !== String(currentSha || "")) {
    return finalizePensionSingleTerminalStale(requestKey, requestHash, target, {
      ok: true, target: target, action: "stale_retry_ignored", duplicate: true, stale: true,
      message: "이 요청 이후 대상 데이터가 변경되어 오래된 재시도를 다시 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
    });
  }
  return { hasIdentity: true, result: null };
}

function beginPensionSingleRequest(requestKey, requestHash, target, currentSha, action, dependencyHashOverride, identityMeta) {
  const dependencyHash = String(dependencyHashOverride || pensionSingleDependencyHash(action || "upsert", target));
  const mutationEpoch = reserveAndRememberPensionSingleIntent(
    requestKey, requestHash, target, currentSha, dependencyHash,
    Object.assign({}, identityMeta || {}, { action: String(action || "") })
  );
  return { mutationEpoch: mutationEpoch, dependencyHash: dependencyHash };
}


function finishPensionSingleRequest(requestKey, requestHash, target) {
  let receiptStored = false;
  try {
    rememberPensionRequestReceipt(requestKey, requestHash, target);
    receiptStored = true;
  } catch (_) {
    // GitHub write가 이미 성공한 뒤 receipt 저장이 실패해도 intent를 남겨 stale retry를 차단한다.
  }
  if (receiptStored) {
    try {
      clearPensionRequestIntent(requestKey);
    } catch (_) {
      // receipt가 durable 근거이므로 stale intent는 다음 요청에서 receipt보다 뒤에 평가되어 무해하다.
    }
  }
}

function finishPensionSingleTerminalRequest(requestKey, requestHash, target, reason) {
  let receiptStored = false;
  try {
    rememberPensionRequestTerminalReceipt(requestKey, requestHash, target, reason);
    receiptStored = true;
  } catch (_) {
    // durable terminal identity가 있더라도 receipt 저장 실패 시 intent를 남겨 다음 retry에서 상태를 다시 복구한다.
  }
  if (receiptStored) {
    try { clearPensionRequestIntent(requestKey); } catch (_) {}
  }
}

/* --- 09D. Batch Duplicate Detection / Confirmation ------------------------ */

function pensionBatchTargetNeeds(operations) {
  const needs = { cashSnapshot: false, contribution: false, etfTrade: false };
  (Array.isArray(operations) ? operations : []).forEach(function(op) {
    const target = String(op && op.target || "");
    if (Object.prototype.hasOwnProperty.call(needs, target)) needs[target] = true;
  });
  return needs;
}

// 현재 GitHub state가 특정 batch의 결과를 이미 포함하는지 mutation 없이 확인한다.
// receipt 저장 실패 뒤 재시도에서만 사용하며, 이후 update/delete가 있으면 false로 판단해 오래된 batch를 다시 적용하지 않는다.
function pensionBatchStateReflectsOperations(body, requestId, ref, operationDecisions, requestCache) {
  const operations = Array.isArray(body && body.operations) ? body.operations : [];
  const needs = pensionBatchTargetNeeds(operations);

  const state = { cashSnapshots: [], contributions: [], trades: [] };
  if (needs.cashSnapshot) state.cashSnapshots = readPensionTarget("cashSnapshot", ref, requestCache).items;
  if (needs.contribution) state.contributions = readPensionTarget("contribution", ref, requestCache).items;
  if (needs.etfTrade) state.trades = readPensionTarget("etfTrade", ref, requestCache).items;

  // cashSnapshot은 date upsert semantics라 같은 Batch에서 같은 날짜를 여러 번 수정하면
  // intermediate state는 commit 후 남지 않는다. 날짜별 마지막 operation의 final effect만 검증한다.
  const lastCashByDate = {};
  const nonCash = [];
  operations.forEach(function(rawOp, index) {
    if (operationDecisions && String(operationDecisions[String(index)] || "") === "existing") return;
    const op = Object.assign({}, rawOp || {});
    op.__batchOperationId = pensionBatchOperationIdentity(op, index);
    const target = String(op.target || "");
    if (target === "cashSnapshot") {
      const date = String(op.action === "delete" ? op.key : (op.item && op.item.date) || "");
      lastCashByDate[date] = op;
    } else {
      nonCash.push(op);
    }
  });

  const cashOk = Object.keys(lastCashByDate).every(function(date) {
    const op = lastCashByDate[date] || {};
    const current = state.cashSnapshots.find(function(v) { return String(v.date || "") === date; }) || null;
    if (String(op.action || "") === "delete") return !current;
    if (!current) return false;
    const item = op.item && typeof op.item === "object" ? op.item : {};
    return String(current.batchRequestId || "") === String(requestId || "") &&
      String(current.batchOperationId || "") === String(op.__batchOperationId || "") &&
      Number(current.valuation) === Number(item.valuation) &&
      Number(current.costBasis) === Number(item.costBasis) &&
      String(current.memo || "") === String(item.memo || "현금성자산 앱 확인");
  });
  if (!cashOk) return false;

  return nonCash.every(function(op) {
    const action = String(op.action || "");
    const target = String(op.target || "");
    if (action === "delete") {
      const key = String(op.key || "");
      const source = target === "contribution" ? state.contributions : state.trades;
      return !source.some(function(v) { return String(v.id || "") === key; });
    }

    const item = op.item && typeof op.item === "object" ? op.item : {};
    const expectedId = newPensionBatchDeterministicId(requestId, op, target);
    const source = target === "contribution" ? state.contributions : state.trades;
    const current = source.find(function(v) { return String(v.id || "") === expectedId; });
    if (!current) return false;
    if (target === "contribution") {
      return String(current.date || "") === String(item.date || "") &&
        Number(current.amount) === Number(item.amount) &&
        String(current.memo || "") === String(item.memo || makeDefaultMemo(String(item.date || "")));
    }
    return String(current.tradeDate || "") === String(item.tradeDate || "") &&
      String(current.ticker || "") === String(item.ticker || "") &&
      Number(current.qty) === Number(item.qty) &&
      Number(current.amount) === Number(item.amount) &&
      (!item.memo || String(current.memo || "") === String(item.memo));
  });
}

// 서로 다른 기기/탭이 응답 유실 후 새 batchRequestId로 동일 작업 모음을 재구성하는 경우를
// 현재 GitHub 최종 상태의 semantic effect를 확인한다. operationId/precondition은 logical identity에서 제외한다.
function pensionBatchStateReflectsLogicalOperations(body, ref, requestCache) {
  const operations = Array.isArray(body && body.operations) ? body.operations : [];
  if (!operations.length) return false;
  const needs = pensionBatchTargetNeeds(operations);
  const state = { cashSnapshots: [], contributions: [], trades: [] };
  if (needs.cashSnapshot) state.cashSnapshots = readPensionTarget("cashSnapshot", ref, requestCache).items;
  if (needs.contribution) state.contributions = readPensionTarget("contribution", ref, requestCache).items;
  if (needs.etfTrade) state.trades = readPensionTarget("etfTrade", ref, requestCache).items;

  const lastCashByDate = {};
  const nonCash = [];
  operations.forEach(function(op) {
    const target = String(op && op.target || "");
    if (target === "cashSnapshot") {
      const date = String(op.action === "delete" ? op.key : (op.item && op.item.date) || "");
      lastCashByDate[date] = op || {};
    } else {
      nonCash.push(op || {});
    }
  });

  // additive operation을 먼저 semantic match해 실제 GitHub item ID를 확보한다.
  // 이후 cash snapshot이 그 matched item을 causal anchor로 실제 포함하는지도 검증한다.
  const usedContribution = {};
  const usedTrade = {};
  const matchedContributionIds = [];
  const matchedTradeIds = [];
  const nonCashOk = nonCash.every(function(op) {
    const action = String(op.action || "");
    const target = String(op.target || "");
    const source = target === "contribution" ? state.contributions : state.trades;
    if (action === "delete") {
      const key = String(op.key || "");
      return !source.some(function(v) { return String(v.id || "") === key; });
    }
    const item = op.item && typeof op.item === "object" ? op.item : {};
    if (target === "contribution") {
      const match = findPensionSemanticExisting(source, target, {
        date: String(item.date || ""), amount: Number(item.amount), memo: String(item.memo || makeDefaultMemo(String(item.date || "")))
      }, usedContribution);
      if (!match) return false;
      usedContribution[match.index] = true;
      matchedContributionIds.push(String(match.item.id || ""));
      return true;
    }
    const match = findPensionSemanticExisting(source, target, {
      tradeDate: String(item.tradeDate || ""), ticker: String(item.ticker || ""), qty: Number(item.qty), amount: Number(item.amount), memo: String(item.memo || "")
    }, usedTrade);
    if (!match) return false;
    usedTrade[match.index] = true;
    matchedTradeIds.push(String(match.item.id || ""));
    return true;
  });
  if (!nonCashOk) return false;

  return Object.keys(lastCashByDate).every(function(date) {
    const op = lastCashByDate[date] || {};
    const current = state.cashSnapshots.find(function(v) { return String(v.date || "") === date; }) || null;
    if (String(op.action || "") === "delete") return !current;
    const item = op.item && typeof op.item === "object" ? op.item : {};
    if (!current || !pensionSemanticMatchesExisting(current, "cashSnapshot", {
      date: date, valuation: Number(item.valuation), costBasis: Number(item.costBasis), memo: String(item.memo || "현금성자산 앱 확인")
    })) return false;

    const afterContributionIds = Array.isArray(current.afterContributionIds) ? current.afterContributionIds.map(String) : [];
    const afterTradeIds = Array.isArray(current.afterTradeIds) ? current.afterTradeIds.map(String) : [];
    const contributionOk = matchedContributionIds.every(function(id) {
      const matched = state.contributions.find(function(v) { return String(v.id || "") === id; });
      return !matched || String(matched.date || "") > date || afterContributionIds.indexOf(id) >= 0;
    });
    const tradeOk = matchedTradeIds.every(function(id) {
      const matched = state.trades.find(function(v) { return String(v.id || "") === id; });
      return !matched || String(matched.date || "") > date || afterTradeIds.indexOf(id) >= 0;
    });
    return contributionOk && tradeOk;
  });
}

// 전체 Batch final effect가 아직 같지 않더라도 additive upsert 중 동일 semantic 후보가 있으면
// cross-device retry와 실제 별도 작업을 서버가 임의로 구분하지 않고 확인을 요구한다.
function pensionBatchCandidateAllocationKeys(source, candidate) {
  const value = candidate || {};
  const keys = [];
  const logicalOperationId = String(value.logicalOperationId || "");
  const requestId = String(value.requestId || "");
  // contribution/ETF에서 date/resourceKey는 resource identity가 아니다.
  // 동일 날짜의 서로 다른 logical operation을 함께 소진하지 않도록 강한 ID만 one-to-one key로 사용한다.
  const resourceId = String(value.id || value.requestId || "");
  const resultVersion = String(value.resultVersion || "");
  const batchKey = String(value.batchRequestId || "") && String(value.batchOperationId || "")
    ? String(value.batchRequestId || "") + "|" + String(value.batchOperationId || "")
    : "";
  if (logicalOperationId) keys.push("logical:" + logicalOperationId);
  if (requestId) keys.push("request:" + requestId);
  if (resourceId) keys.push("resource:" + resourceId);
  if (resultVersion) keys.push("result:" + resultVersion);
  if (batchKey) keys.push("batch:" + batchKey);
  if (!keys.length) keys.push("fallback:" + String(source || "") + ":" + sha256HexText(canonicalPensionBatchJson(value)));
  return keys;
}

function pensionBatchCandidateExactIdentityMatch(candidate, operation, batchRequestId, index) {
  const value = candidate || {};
  const op = operation || {};
  const operationId = pensionBatchOperationIdentity(op, index);
  const logicalOperationId = String(op.logicalOperationId || operationId || "");
  const candidateLogicalId = String(value.logicalOperationId || "");
  const candidateBatchRequestId = String(value.batchRequestId || "");
  const candidateBatchOperationId = String(value.batchOperationId || "");
  if (candidateLogicalId && logicalOperationId && candidateLogicalId === logicalOperationId) return true;
  return !!candidateBatchRequestId && !!candidateBatchOperationId &&
    candidateBatchRequestId === String(batchRequestId || "") &&
    candidateBatchOperationId === String(operationId || "");
}

function pensionBatchCandidateAlreadyUsed(source, candidate, usedCandidateKeys) {
  const used = usedCandidateKeys || {};
  return pensionBatchCandidateAllocationKeys(source, candidate).some(function(key) { return !!used[key]; });
}

function markPensionBatchCandidateUsed(source, candidate, usedCandidateKeys) {
  const used = usedCandidateKeys || {};
  pensionBatchCandidateAllocationKeys(source, candidate).forEach(function(key) { used[key] = true; });
}

function findAvailablePensionLedgerMatch(items, semanticHash, usedCandidateKeys) {
  const list = Array.isArray(items) ? items : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const entry = list[index];
    if (String(entry && entry.semanticHash || "") !== String(semanticHash || "")) continue;
    if (pensionBatchCandidateAlreadyUsed("ledger", entry, usedCandidateKeys)) continue;
    return entry;
  }
  return null;
}

// Batch confirmation candidate는 cardinality를 보존한다. 동일한 기존 item/ledger operation 하나를
// 여러 Batch operation의 "existing" 근거로 재사용하지 않고 one-to-one으로 소진한다.
function pensionBatchConflictDescriptors(body, ref, requestCache) {
  const operations = Array.isArray(body && body.operations) ? body.operations : [];
  const needs = pensionBatchTargetNeeds(operations);
  const state = { cashSnapshot: [], contribution: [], etfTrade: [] };
  if (needs.cashSnapshot) state.cashSnapshot = readPensionTarget("cashSnapshot", ref, requestCache).items;
  if (needs.contribution) state.contribution = readPensionTarget("contribution", ref, requestCache).items;
  if (needs.etfTrade) state.etfTrade = readPensionTarget("etfTrade", ref, requestCache).items;

  const conflicts = [];
  const usedContributionIndexes = {};
  const usedTradeIndexes = {};
  const usedCandidateKeys = {};

  operations.forEach(function(rawOp, index) {
    const op = rawOp || {};
    const target = String(op.target || "");
    const action = String(op.action || "");
    if (!Object.prototype.hasOwnProperty.call(PENSION_TARGET_META, target) || (action !== "upsert" && action !== "delete")) return;
    const fields = pensionBatchOperationLedgerFields(op);
    const ledgerContext = loadPensionOperationLedgerContext(target, action, fields, ref, requestCache);
    let source = "";
    let candidate = null;
    const operationId = pensionBatchOperationIdentity(op, index);
    const logicalOperationId = String(op.logicalOperationId || operationId || "");
    const durableIdentityContext = loadPensionOperationIdentityContext(target, {
      logicalOperationId: logicalOperationId,
      batchRequestId: String(body && body.batchRequestId || ""),
      batchOperationId: String(operationId || "")
    }, ref, requestCache);
    const durableIdentityCandidate = assertPensionOperationIdentityCompatible(durableIdentityContext, pensionBatchOperationIdentityContentHash(op));
    if (durableIdentityCandidate) { source = "identity"; candidate = durableIdentityCandidate; }
    const exactLedgerCandidate = !candidate ? findPensionLedgerExactIdentity(ledgerContext, target, {
      logicalOperationId: logicalOperationId,
      batchRequestId: String(body && body.batchRequestId || ""),
      batchOperationId: String(operationId || "")
    }, ref, requestCache) : null;
    if (exactLedgerCandidate) { source = "ledger"; candidate = exactLedgerCandidate; }

    if (!candidate && action === "upsert") {
      const item = op.item && typeof op.item === "object" ? op.item : {};
      if (target === "cashSnapshot") {
        const current = state.cashSnapshot.find(function(v) { return String(v.date || "") === String(item.date || ""); }) || null;
        if (current && pensionSemanticMatchesExisting(current, target, fields) && !pensionBatchCandidateAlreadyUsed("item", current, usedCandidateKeys)) {
          source = "item"; candidate = current;
        }
      } else if (target === "contribution") {
        const semantic = findPensionSemanticExisting(state.contribution, target, fields, usedContributionIndexes);
        if (semantic && !pensionBatchCandidateAlreadyUsed("item", semantic.item, usedCandidateKeys)) {
          source = "item"; candidate = semantic.item; usedContributionIndexes[semantic.index] = true;
        }
      } else if (target === "etfTrade") {
        const semantic = findPensionSemanticExisting(state.etfTrade, target, fields, usedTradeIndexes);
        if (semantic && !pensionBatchCandidateAlreadyUsed("item", semantic.item, usedCandidateKeys)) {
          source = "item"; candidate = semantic.item; usedTradeIndexes[semantic.index] = true;
        }
      }
    }

    // 같은 현재 item이 이미 소진됐다면 그 item과 같은 logical/result ledger entry로 우회하지 않는다.
    if (!candidate) {
      const ledgerCandidate = findAvailablePensionLedgerMatch(ledgerContext.items, ledgerContext.semanticHash, usedCandidateKeys);
      if (ledgerCandidate) { source = "ledger"; candidate = ledgerCandidate; }
    }
    if (!candidate && target === "cashSnapshot" && ledgerContext.legacyPath) {
      const legacy = readLegacyPensionOperationLedger(ref, requestCache);
      const legacyCandidate = findAvailablePensionLedgerMatch(legacy.items, ledgerContext.semanticHash, usedCandidateKeys);
      if (legacyCandidate) { source = "ledger"; candidate = legacyCandidate; }
    }
    if (!candidate) return;

    markPensionBatchCandidateUsed(source, candidate, usedCandidateKeys);
    const descriptor = pensionDuplicateCandidateDescriptor(source, candidate);
    const exactIdentityMatch = pensionBatchCandidateExactIdentityMatch(candidate, op, String(body && body.batchRequestId || ""), index);
    conflicts.push({
      index: index,
      target: target,
      action: action,
      source: source,
      semanticHash: String(ledgerContext.semanticHash || ""),
      logicalOperationId: String(descriptor.logicalOperationId || ""),
      resourceKey: String((candidate && (candidate.id || candidate.requestId || candidate.resultVersion || candidate.resourceKey || candidate.date)) || ""),
      exactIdentityMatch: exactIdentityMatch,
      forcedDecision: exactIdentityMatch ? "existing" : ""
    });
  });
  return conflicts;
}

function normalizePensionBatchConfirmationDecisions(body, conflicts, fullMatch) {
  const list = Array.isArray(conflicts) ? conflicts : [];
  const decisions = {};
  const forced = {};
  const expected = {};
  list.forEach(function(conflict) {
    const key = String(conflict.index);
    if (String(conflict.forcedDecision || "") === "existing") {
      forced[key] = true;
      decisions[key] = "existing";
    } else {
      expected[key] = true;
    }
  });

  const globalDecision = String(body && body.confirmationDecision || "").trim();
  if (globalDecision) {
    if (globalDecision !== "existing" && globalDecision !== "distinct") return { ok: false, error: "중복 확인 결정값이 올바르지 않습니다." };
    if (!fullMatch) return { ok: false, error: "부분 충돌 작업 모음은 operation별 중복 결정을 선택해야 합니다." };
    if (globalDecision === "distinct" && Object.keys(forced).length) {
      return { ok: false, error: "동일 batch/logical identity의 과거 operation은 별도 작업으로 다시 실행할 수 없습니다." };
    }
    list.forEach(function(conflict) {
      const key = String(conflict.index);
      decisions[key] = forced[key] ? "existing" : globalDecision;
    });
    return { ok: true, decisions: decisions };
  }

  const raw = body && body.confirmationDecisions && typeof body.confirmationDecisions === "object" ? body.confirmationDecisions : {};
  const rawKeys = Object.keys(raw);
  for (let i = 0; i < rawKeys.length; i += 1) {
    const key = String(rawKeys[i]);
    const value = String(raw[key] || "").trim();
    if (forced[key]) {
      if (value && value !== "existing") return { ok: false, error: "동일 batch/logical identity의 과거 operation은 기존 처리로만 확인할 수 있습니다." };
      decisions[key] = "existing";
      continue;
    }
    if (!expected[key] || (value !== "existing" && value !== "distinct")) {
      return { ok: false, error: "operation별 중복 확인 결정이 현재 충돌 항목과 일치하지 않습니다." };
    }
    decisions[key] = value;
  }
  const missing = Object.keys(expected).filter(function(key) { return !decisions[key]; });
  if (missing.length) return { ok: false, error: "operation별 중복 확인 결정 수가 현재 충돌 항목과 일치하지 않습니다." };
  return { ok: true, decisions: decisions };
}

function validatePensionBatchConfirmation(body, requestId, operationsHash, dependencyHash, descriptor) {
  const token = String(body && body.confirmationToken || "").trim();
  const saved = findPensionConfirmation(token);
  const now = Date.now();
  const validToken = !!saved &&
    String(saved.scope || "") === "batch" &&
    String(saved.identity || "") === String(requestId || "") &&
    String(saved.requestHash || "") === String(operationsHash || "") &&
    Number(saved.expiresAtMs || 0) >= now &&
    Number(saved.mutationEpoch || 0) === getPensionMutationEpoch() &&
    String(saved.dependencyHash || "") === String(dependencyHash || "") &&
    String(saved.candidateHash || "") === pensionConfirmationCandidateHash(descriptor);
  if (!validToken) return { valid: false, token: token, error: "중복 확인 이후 작업 모음 상태가 변경되었습니다. 최신 상태에서 다시 확인해주세요." };
  const normalized = normalizePensionBatchConfirmationDecisions(body, descriptor.conflicts || [], descriptor.fullMatch === true);
  if (!normalized.ok) return { valid: false, token: token, error: normalized.error };
  return { valid: true, token: token, decisions: normalized.decisions };
}

function issuePensionBatchConfirmation(requestId, operationsHash, dependencyHash, descriptor) {
  const token = rememberPensionConfirmation("batch", requestId, operationsHash, dependencyHash, descriptor);
  return {
    ok: true,
    action: "batch_duplicate_confirmation_required",
    requiresDuplicateConfirmation: true,
    confirmationToken: token,
    fullMatch: descriptor.fullMatch === true,
    conflictOperations: Array.isArray(descriptor.conflicts) ? descriptor.conflicts : [],
    changedFiles: [],
    message: descriptor.fullMatch === true
      ? "동일 작업 모음 효과가 이미 존재합니다. 서버 상태를 다시 확인한 뒤 기존 처리 또는 실제 별도 작업을 선택해주세요."
      : "작업 모음 일부가 기존 logical operation과 겹칩니다. 충돌 operation별로 기존 처리 또는 실제 별도 작업을 선택해주세요."
  };
}

// batchRequestId에 해당하는 direct/legacy 처리 영수증을 찾는다.

/* --- 09E. Batch Receipt / Intent / Parallel Prefetch ---------------------- */

function findPensionBatchReceipt(requestId) {
  const props = PropertiesService.getScriptProperties();
  const direct = parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("PENSION_BATCH_R_", requestId)));
  if (direct) return direct;
  return readLegacyArrayProperty("PENSION_BATCH_RECEIPTS").find(function(item) {
    return item && String(item.id || "") === String(requestId || "");
  }) || null;
}

// batch receipt는 request별 compact property로 분리해 단일 property 9KB 누적 한도를 피한다.
function rememberPensionBatchReceipt(requestId, operationsHash, result) {
  if (!requestId || !operationsHash || !result) return;
  const props = PropertiesService.getScriptProperties();
  const key = requestDirectPropertyKey("PENSION_BATCH_R_", requestId);
  const value = {
    id: requestId,
    operationsHash: operationsHash,
    commitSha: String(result.commitSha || ""),
    changedFiles: Array.isArray(result.changedFiles) ? result.changedFiles.slice(0, 3) : [],
    terminalStale: result.stale === true,
    reason: String(result.reason || result.action || ""),
    message: String(result.message || ""),
    savedAtKST: nowKSTText(),
    savedAtMs: Date.now()
  };
  if (!trySetDirectRequestPropertyFastAfterBoundary("PENSION_BATCH_R_", key, value)) {
    setDirectRequestProperty(props, "PENSION_BATCH_R_", key, value);
  }
}

// Batch retry는 branch HEAD 전체가 아니라 실제 작업 의미에 영향을 주는 dependency의 blob SHA를 비교한다.
// 동시에 global Pension epoch를 사용해 save→delete→원상복구 같은 ABA도 별도로 차단한다.
function pensionBatchDependencyPaths(operations, batchRequestId) {
  const paths = {};
  (Array.isArray(operations) ? operations : []).forEach(function(op, index) {
    const target = String(op && op.target || "");
    const action = String(op && op.action || "");
    if (Object.prototype.hasOwnProperty.call(PENSION_TARGET_META, target)) paths[getDataPath(target)] = true;
    try {
      const semanticHash = pensionOperationSemanticHash(target, action, pensionBatchOperationLedgerFields(op));
      paths[pensionOperationLedgerShardPath(semanticHash)] = true;
      const operationId = pensionBatchOperationIdentity(op || {}, index);
      const logicalOperationId = String(op && op.logicalOperationId || operationId || "");
      pensionOperationIdentityKeys(target, {
        logicalOperationId: logicalOperationId,
        batchRequestId: String(batchRequestId || ""),
        batchOperationId: operationId
      }).forEach(function(identityKey) { paths[pensionOperationIdentityLedgerShardPath(identityKey)] = true; });
    } catch (_) {}
    if (action === "delete" && (target === "contribution" || target === "etfTrade")) paths[getDataPath("cashSnapshot")] = true;
    if (action === "upsert" && target === "cashSnapshot") {
      paths[getDataPath("contribution")] = true;
      paths[getDataPath("etfTrade")] = true;
      paths[PENSION_OPERATION_LEDGER_LEGACY_PATH] = true;
    }
    if (action === "upsert" && target === "etfTrade") {
      paths[getDataPath("cashSnapshot")] = true;
      paths[getDataPath("contribution")] = true;
      paths["data/prices.json"] = true;
      paths["data/portfolio.json"] = true;
    }
  });
  return Object.keys(paths).sort();
}

// 새 Batch의 최초 immutable HEAD에서 dependency + canonical state + batchRequest identity를
// 한 번의 병렬 GET으로 채운다. 이후 durable identity / conflict scan / 실제 apply가 같은 cache를 공유한다.
// branch HEAD 자체와 commit CAS/readback은 이 cache를 사용하지 않는다.
function primePensionBatchInitialReadCache(operations, batchRequestId, ref, requestCache) {
  if (!requestCache || !ref) return;
  const specs = [];
  pensionBatchDependencyPaths(operations, batchRequestId).forEach(function(path) {
    const text = String(path || "");
    const optional = text.indexOf(PENSION_OPERATION_LEDGER_DIR + "/") === 0 ||
      text.indexOf(PENSION_OPERATION_IDENTITY_DIR + "/") === 0 ||
      text === PENSION_OPERATION_LEDGER_LEGACY_PATH;
    specs.push({ path: text, optional: optional, fallbackData: optional ? [] : null });
  });
  [
    { path: getDataPath("cashSnapshot"), optional: false, fallbackData: null },
    { path: getDataPath("contribution"), optional: false, fallbackData: null },
    { path: getDataPath("etfTrade"), optional: false, fallbackData: null },
    { path: "data/prices.json", optional: false, fallbackData: null },
    { path: "data/portfolio.json", optional: false, fallbackData: null },
    { path: pensionBatchRequestIdentityShardPath(batchRequestId), optional: true, fallbackData: [] }
  ].forEach(function(spec) { specs.push(spec); });

  const unique = [];
  const seen = {};
  specs.forEach(function(spec) {
    const path = String(spec && spec.path || "");
    if (!path || seen[path]) return;
    seen[path] = true;
    const key = pensionRequestReadCacheKey(path, ref);
    if (Object.prototype.hasOwnProperty.call(requestCache, key)) return;
    unique.push(spec);
  });
  if (!unique.length) return;

  const chunkSize = 50;
  for (let offset = 0; offset < unique.length; offset += chunkSize) {
    const chunk = unique.slice(offset, offset + chunkSize);
    const settled = githubRequestManyGetSettled(chunk.map(function(spec) {
      return {
        key: String(spec.path || ""),
        path: githubContentsApiPath(String(spec.path || ""), ref),
        allow404: spec.optional === true
      };
    }));
    settled.forEach(function(result, index) {
      const spec = chunk[index];
      if (!result || result.ok !== true) throw (result && result.error) || new Error("Pension Batch initial preflight JSON을 읽지 못했습니다: " + spec.path);
      let current = null;
      if (Number(result.status || 0) === 404 && spec.optional === true) {
        current = { sha: "", data: spec.fallbackData, missing: true };
      } else {
        current = decodeGithubJsonContentsResult(result.data, spec.path, ref, spec.fallbackData, spec.optional === true);
      }
      requestCache[pensionRequestReadCacheKey(spec.path, ref)] = current;
    });
  }
}

// 같은 immutable Batch base commit에서 dependency/ledger/identity JSON을 한 번에 읽어
// request-local cache에 채운다. HEAD 확인 자체와 commit CAS/readback은 이 helper를 사용하지 않는다.
function primePensionBatchDependencyReadCache(operations, batchRequestId, ref, requestCache) {
  if (!requestCache || !ref) return;
  const paths = pensionBatchDependencyPaths(operations, batchRequestId);
  const specs = paths.map(function(path) {
    const text = String(path || "");
    const optional = text.indexOf(PENSION_OPERATION_LEDGER_DIR + "/") === 0 ||
      text.indexOf(PENSION_OPERATION_IDENTITY_DIR + "/") === 0 ||
      text === PENSION_OPERATION_LEDGER_LEGACY_PATH;
    return { path: text, optional: optional, fallbackData: optional ? [] : null };
  });

  const unique = [];
  const seen = {};
  specs.forEach(function(spec) {
    const path = String(spec && spec.path || "");
    if (!path || seen[path]) return;
    seen[path] = true;
    const key = pensionRequestReadCacheKey(path, ref);
    if (Object.prototype.hasOwnProperty.call(requestCache, key)) return;
    unique.push(spec);
  });
  if (!unique.length) return;

  // 최대 100개 operation에서 shard path가 많이 갈라져도 한 fetchAll에 수백 요청을 몰지 않는다.
  // 작은 실사용 Batch는 1회, 큰 Batch만 안전한 크기로 나눠 병렬 wave를 실행한다.
  const chunkSize = 50;
  for (let offset = 0; offset < unique.length; offset += chunkSize) {
    const chunk = unique.slice(offset, offset + chunkSize);
    const settled = githubRequestManyGetSettled(chunk.map(function(spec) {
      return {
        key: String(spec.path || ""),
        path: githubContentsApiPath(String(spec.path || ""), ref),
        allow404: spec.optional === true
      };
    }));

    settled.forEach(function(result, index) {
      const spec = chunk[index];
      if (!result || result.ok !== true) throw (result && result.error) || new Error("Pension Batch preflight JSON을 읽지 못했습니다: " + spec.path);
      let current = null;
      if (Number(result.status || 0) === 404 && spec.optional === true) {
        current = { sha: "", data: spec.fallbackData, missing: true };
      } else {
        current = decodeGithubJsonContentsResult(result.data, spec.path, ref, spec.fallbackData, spec.optional === true);
      }
      requestCache[pensionRequestReadCacheKey(spec.path, ref)] = current;
    });
  }
}

// 실제 Batch 적용 단계가 항상 읽는 canonical state 5종과 batchRequest identity를
// 같은 base commit에서 병렬로 채운다. dependency preflight가 이미 채운 path는 자동 건너뛴다.
function primePensionBatchStateReadCache(requestId, ref, requestCache) {
  if (!requestCache || !ref) return;
  const specs = [
    { path: getDataPath("cashSnapshot"), optional: false, fallbackData: null },
    { path: getDataPath("contribution"), optional: false, fallbackData: null },
    { path: getDataPath("etfTrade"), optional: false, fallbackData: null },
    { path: "data/prices.json", optional: false, fallbackData: null },
    { path: "data/portfolio.json", optional: false, fallbackData: null },
    { path: pensionBatchRequestIdentityShardPath(requestId), optional: true, fallbackData: [] }
  ];

  const unique = [];
  const seen = {};
  specs.forEach(function(spec) {
    const path = String(spec && spec.path || "");
    if (!path || seen[path]) return;
    seen[path] = true;
    const key = pensionRequestReadCacheKey(path, ref);
    if (Object.prototype.hasOwnProperty.call(requestCache, key)) return;
    unique.push(spec);
  });
  if (!unique.length) return;

  const settled = githubRequestManyGetSettled(unique.map(function(spec) {
    return {
      key: String(spec.path || ""),
      path: githubContentsApiPath(String(spec.path || ""), ref),
      allow404: spec.optional === true
    };
  }));

  settled.forEach(function(result, index) {
    const spec = unique[index];
    if (!result || result.ok !== true) throw (result && result.error) || new Error("Pension Batch state preflight JSON을 읽지 못했습니다: " + spec.path);
    let current = null;
    if (Number(result.status || 0) === 404 && spec.optional === true) {
      current = { sha: "", data: spec.fallbackData, missing: true };
    } else {
      current = decodeGithubJsonContentsResult(result.data, spec.path, ref, spec.fallbackData, spec.optional === true);
    }
    requestCache[pensionRequestReadCacheKey(spec.path, ref)] = current;
  });
}

function pensionBatchDependencyHash(operations, ref, requestCache, batchRequestId) {
  const entries = pensionBatchDependencyPaths(operations, batchRequestId).map(function(path) {
    const current = (path.indexOf(PENSION_OPERATION_LEDGER_DIR + "/") === 0 || path.indexOf(PENSION_OPERATION_IDENTITY_DIR + "/") === 0 || path === PENSION_OPERATION_LEDGER_LEGACY_PATH)
      ? readGithubJsonOptionalRequestCached(path, ref, [], requestCache)
      : readGithubJsonRequestCached(path, ref, requestCache);
    return { path: path, sha: String(current.sha || "") };
  });
  return sha256HexText(canonicalPensionBatchJson(entries));
}

// batchRequestId에 해당하는 direct/legacy 진행 intent를 찾는다.
function findPensionBatchIntent(requestId) {
  const props = PropertiesService.getScriptProperties();
  const direct = parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("PENSION_BATCH_I_", requestId)));
  if (direct) return direct;
  return readLegacyArrayProperty("PENSION_BATCH_INTENTS").find(function(item) {
    return item && String(item.id || "") === String(requestId || "");
  }) || null;
}

function rememberPensionBatchIntent(requestId, operationsHash, baseCommitSha, dependencyHash, mutationEpoch, retryablePrecommit, retryableEpoch, operationDecisions, terminalMeta) {
  const props = PropertiesService.getScriptProperties();
  const key = requestDirectPropertyKey("PENSION_BATCH_I_", requestId);
  const value = {
    id: requestId,
    operationsHash: operationsHash,
    baseCommitSha: String(baseCommitSha || ""),
    dependencyHash: String(dependencyHash || ""),
    mutationEpoch: Number(mutationEpoch || 0),
    retryablePrecommit: retryablePrecommit === true,
    retryableEpoch: Number(retryableEpoch || 0),
    terminalPending: terminalMeta && terminalMeta.terminalPending === true,
    terminalReason: String(terminalMeta && terminalMeta.terminalReason || ""),
    operationDecisions: operationDecisions && typeof operationDecisions === "object" ? operationDecisions : {},
    savedAtKST: nowKSTText(),
    savedAtMs: Date.now()
  };
  if (!trySetDirectRequestPropertyFastAfterBoundary("PENSION_BATCH_I_", key, value)) {
    setDirectRequestProperty(props, "PENSION_BATCH_I_", key, value);
  }
}

function clearPensionBatchIntent(requestId) {
  return clearDirectRequestProperty("PENSION_BATCH_I_", requestId, false);
}

function reserveAndRememberPensionBatchIntent(requestId, operationsHash, baseCommitSha, dependencyHash, operationDecisions) {
  const mutationEpoch = reserveNextPensionMutationEpoch();
  try {
    rememberPensionBatchIntent(requestId, operationsHash, baseCommitSha, dependencyHash, mutationEpoch, false, 0, operationDecisions);
    return mutationEpoch;
  } catch (err) {
    const saved = findPensionBatchIntent(requestId);
    if (saved && String(saved.operationsHash || "") === String(operationsHash || "") && Number(saved.mutationEpoch || 0) === mutationEpoch && saved.retryablePrecommit !== true) {
      return mutationEpoch;
    }
    try { rollbackPensionMutationEpoch(mutationEpoch); } catch (_) {}
    throw err;
  }
}

function transitionPensionBatchIntentToRetryable(requestId, operationsHash, baseCommitSha, dependencyHash, mutationEpoch, operationDecisions) {
  const reservedEpoch = Number(mutationEpoch || 0);
  if (!reservedEpoch || getPensionMutationEpoch() !== reservedEpoch) return false;
  const retryableEpoch = reservedEpoch - 1;
  try {
    rememberPensionBatchIntent(requestId, operationsHash, baseCommitSha, dependencyHash, 0, true, retryableEpoch, operationDecisions);
  } catch (err) {
    const saved = findPensionBatchIntent(requestId);
    const applied = saved && String(saved.operationsHash || "") === String(operationsHash || "") && saved.retryablePrecommit === true && Number(saved.retryableEpoch || 0) === retryableEpoch;
    if (!applied) throw err;
  }
  if (!rollbackPensionMutationEpoch(reservedEpoch)) {
    try { rememberPensionBatchIntent(requestId, operationsHash, baseCommitSha, dependencyHash, reservedEpoch, false, 0, operationDecisions); } catch (_) {}
    return false;
  }
  return true;
}

/* --- 09F. Batch Durable Recovery / Stale Resolution ----------------------- */

function pensionBatchExactIdentitySuccessProof(operations, requestId, ref, requestCache) {
  const list = normalizePensionBatchOperations(operations, false);
  if (!list.length || !ref) return false;
  const shards = preparePensionBatchIdentityOperations(list, requestId, ref, requestCache || {});
  return list.every(function(op) {
    const keys = Array.isArray(op.__identityKeys) ? op.__identityKeys : [];
    const contentHash = String(op.__identityContentHash || "");
    if (!keys.length || !contentHash) return false;
    return keys.every(function(identityKey) {
      const shard = shards[pensionOperationIdentityLedgerShardPath(identityKey)];
      const match = shard && shard.items.find(function(item) { return String(item && item.identityKey || "") === identityKey; });
      return !!match && String(match.contentHash || "") === contentHash;
    });
  });
}

function promotePensionBatchRequestDurableIdentityCompleted(requestId, operationsHash, info) {
  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const head = getGithubBranchHeadSha();
    if (!head) throw new Error("Pension Batch durable identity 승격 기준 커밋을 확인하지 못했습니다.");
    const context = loadPensionBatchRequestIdentityContext(requestId, head);
    const existing = assertPensionBatchRequestIdentityCompatible(context, operationsHash);
    if (!existing) {
      return rememberPensionBatchRequestDurableIdentityState(requestId, operationsHash, "completed", info || {});
    }
    if (String(existing.status || "completed") !== "terminal_stale") return { stored: true, status: "completed", match: existing };
    const original = context.items.find(function(entry) { return String(entry.requestId || "") === String(requestId || ""); });
    if (!original) return { stored: false, status: "", match: null };
    const item = Object.assign({}, original, {
      status: "completed",
      commitSha: String(info && info.commitSha || original.commitSha || ""),
      reason: String(info && info.reason || "operation_identity_recovered"),
      savedAtKST: nowKSTText(),
      savedAtMs: Date.now()
    });
    context.items = normalizePensionBatchRequestIdentityLedger(context.items.map(function(entry) {
      return String(entry.requestId || "") === String(requestId || "") ? item : entry;
    }));
    const change = pensionBatchRequestIdentityFileChange(context);
    if (!change) return { stored: true, status: "completed", match: item };
    if (tryDurableGithubJsonBatchWrite(
      head, [change], "Recover pension batch request identity [" + requestId + "]", attempt
    )) return { stored: true, status: "completed", match: item };
  }
  return { stored: false, status: "", match: null };
}

function markPensionBatchIntentTerminalPending(requestId, operationsHash, reason) {
  const existing = findPensionBatchIntent(requestId);
  if (!existing || String(existing.operationsHash || "") !== String(operationsHash || "")) return { marked: false, mutationEpoch: 0 };
  const decisions = Object.assign({}, existing.operationDecisions || {});
  const terminalMeta = {
    terminalPending: true,
    terminalReason: String(reason || existing.terminalReason || "terminal_stale")
  };
  try {
    rememberPensionBatchIntent(
      requestId, operationsHash, String(existing.baseCommitSha || ""), String(existing.dependencyHash || ""),
      Number(existing.mutationEpoch || 0), false, 0, decisions, terminalMeta
    );
  } catch (err) {
    const saved = findPensionBatchIntent(requestId);
    const applied = saved && String(saved.operationsHash || "") === String(operationsHash || "") && saved.terminalPending === true;
    if (!applied) throw err;
  }
  const saved = findPensionBatchIntent(requestId) || existing;
  return { marked: true, mutationEpoch: Number(saved.mutationEpoch || existing.mutationEpoch || 0) };
}

// 현재 GitHub business state가 이미 Batch 결과를 반영했다는 복구 판단은 유한 receipt로만 끝내지 않는다.
// batchRequestId durable completed + 모든 operation exact identity를 먼저 확보한 뒤에만 duplicate를 확정한다.
function finalizePensionBatchRecoveredDuplicate(operations, requestId, operationsHash, commitSha, changedFiles, message) {
  const durable = promotePensionBatchRequestDurableIdentityCompleted(requestId, operationsHash, {
    commitSha: String(commitSha || ""), reason: "state_reflects_recovered"
  });
  if (!durable || durable.stored !== true || String(durable.status || "") !== "completed") {
    throw new Error("현재 state에서 확인한 Batch 완료 결과를 durable batchRequestId identity로 안전하게 보존하지 못했습니다.");
  }
  if (!ensurePensionBatchOperationIdentitiesComplete(operations, requestId)) {
    throw new Error("현재 state에서 확인한 Batch 완료 결과의 operation exact identity를 안전하게 backfill하지 못했습니다.");
  }
  const result = {
    ok: true, action: "batch_duplicate_ignored", duplicate: true, stale: false,
    commitSha: String(durable.match && durable.match.commitSha || commitSha || ""),
    changedFiles: Array.isArray(changedFiles) ? changedFiles : [],
    message: String(message || "이미 동일한 작업 모음 결과가 반영되어 있고 durable identity까지 확인했습니다. 중복 커밋은 만들지 않았습니다.")
  };
  try { rememberPensionBatchReceipt(requestId, operationsHash, result); } catch (_) {}
  try { clearPensionBatchIntent(requestId); } catch (_) {}
  return result;
}

function finalizePensionBatchTerminalStale(requestId, operationsHash, result) {
  const terminalReason = String(result && (result.reason || result.action) || "terminal_stale");
  let terminalEpoch = 0;
  const active = findPensionBatchIntent(requestId);
  let localTerminalEvidence = !!(active && String(active.operationsHash || "") === String(operationsHash || "") && active.terminalPending === true);
  if (active && String(active.operationsHash || "") === String(operationsHash || "")) {
    terminalEpoch = Number(active.mutationEpoch || 0);
    if (!localTerminalEvidence) {
      try {
        const marked = markPensionBatchIntentTerminalPending(requestId, operationsHash, terminalReason);
        if (marked.marked) {
          localTerminalEvidence = true;
          if (Number(marked.mutationEpoch || 0)) terminalEpoch = Number(marked.mutationEpoch || 0);
        }
      } catch (_) {}
    }
  }

  let durableState = { stored: false, status: "", match: null };
  try { durableState = rememberPensionBatchRequestTerminalIdentityState(requestId, operationsHash, result) || durableState; } catch (_) {}
  const durableStored = durableState.stored === true;
  if (!localTerminalEvidence && !durableStored) {
    throw new Error("stale Batch의 terminal identity를 안전하게 보존하지 못했습니다. 작업 모음을 확정 종료하지 않았습니다. 잠시 후 동일 batchRequestId로 다시 시도해주세요.");
  }

  // 이 실행에서 business mutation이 없고 durable state가 확보된 경우에만 phantom epoch를 되돌린다.
  // local terminal marker만 남은 경우 epoch는 유지해 causal barrier를 보존한다.
  if (durableStored && terminalEpoch > 0) {
    try { rollbackPensionMutationEpoch(terminalEpoch); } catch (_) {}
  }

  if (!durableStored) return result;

  // 동일 batchRequestId durable state가 이미 completed라면 stale 응답으로 강등하지 않는다.
  if (String(durableState.status || "") === "completed") {
    const duplicateResult = {
      ok: true, action: "batch_duplicate_ignored", duplicate: true, stale: false,
      commitSha: String(durableState.match && durableState.match.commitSha || result && result.commitSha || ""),
      changedFiles: Array.isArray(result && result.changedFiles) ? result.changedFiles : [],
      message: "GitHub durable batch identity에서 이미 완료된 동일 작업 모음을 확인했습니다. 중복 커밋은 만들지 않았습니다."
    };
    try { rememberPensionBatchReceipt(requestId, operationsHash, duplicateResult); } catch (_) {}
    try { clearPensionBatchIntent(requestId); } catch (_) {}
    return duplicateResult;
  }

  const existingReceipt = findPensionBatchReceipt(requestId);
  if (existingReceipt) {
    const existingHash = String(existingReceipt.operationsHash || "");
    if (existingHash && existingHash !== String(operationsHash || "")) return result;
    // 이미 정상 성공 receipt가 있으면 그 이력을 보존하고 stale receipt로 덮어쓰지 않는다.
    if (existingReceipt.terminalStale !== true) {
      try { clearPensionBatchIntent(requestId); } catch (_) {}
      return result;
    }
  }

  try { rememberPensionBatchReceipt(requestId, operationsHash, result); } catch (_) {}
  // durable batchRequestId tombstone이 있으므로 receipt 저장 실패와 무관하게 active intent는 해제할 수 있다.
  try { clearPensionBatchIntent(requestId); } catch (_) {}
  return result;
}

// Lock/Intent/Receipt + 결정적 저장 ID를 사용해 commit/응답 경계 재시도까지 멱등하게 처리한다.
function resolvePensionBatchReceiptResult(requestId, operationsHash, preflightOperations, operations) {
  const receipt = findPensionBatchReceipt(requestId);
  if (receipt) {
    const receiptHash = String(receipt.operationsHash || "");
    if (!receiptHash) {
      return {
        ok: false,
        error: "동일한 batchRequestId에 기존 형식의 처리 이력이 있습니다. 작업 모음을 새로 구성해 다시 시도해주세요."
      };
    }
    if (receiptHash !== operationsHash) {
      return {
        ok: false,
        error: "동일한 batchRequestId가 다른 작업 내용에 이미 사용되었습니다. 작업 모음을 새로 구성해 다시 시도해주세요."
      };
    }
    let recoveredCompleted = false;
    let recoveredCommitSha = String(receipt.commitSha || "");
    if (receipt.terminalStale === true) {
      // batchRequest durable identity의 completed는 정상 business commit과 같은 Git commit에 들어간 강한 증거다.
      // 과거/부분 실패로 stale receipt가 남아 있어도 completed durable state가 있으면 receipt보다 우선한다.
      try {
        const durableReceiptIdentity = findPensionBatchRequestIdentity(requestId, operationsHash);
        if (durableReceiptIdentity && String(durableReceiptIdentity.status || "completed") !== "terminal_stale") {
          recoveredCompleted = true;
          recoveredCommitSha = String(durableReceiptIdentity.commitSha || recoveredCommitSha);
        }
      } catch (_) {}

      let proofHead = "";
      if (!recoveredCompleted) {
        try {
          proofHead = getGithubBranchHeadSha();
          recoveredCompleted = !!proofHead && pensionBatchExactIdentitySuccessProof(preflightOperations, requestId, proofHead, {});
          if (recoveredCompleted && !recoveredCommitSha) recoveredCommitSha = proofHead;
        } catch (_) { recoveredCompleted = false; }
      }
      if (recoveredCompleted) {
        try { promotePensionBatchRequestDurableIdentityCompleted(requestId, operationsHash, { commitSha: recoveredCommitSha, reason: "operation_identity_recovered" }); } catch (_) {}
        try { rememberPensionBatchReceipt(requestId, operationsHash, { ok: true, action: "batch_duplicate_ignored", duplicate: true, stale: false, commitSha: recoveredCommitSha, changedFiles: receipt.changedFiles || [], message: "GitHub durable/operation identity에서 과거 작업 모음의 완료를 확인했습니다." }); } catch (_) {}
      }
    }
    // Script Properties receipt는 유한 보존이므로 현재 retry만 막는 증거로 끝내지 않는다.
    // completed/stale 어느 쪽이든 batchRequestId durable identity를 실제 확보한 뒤에만 확정 응답한다.
    // receipt GC 뒤 같은 batchRequestId가 다른 operation 묶음으로 부활하는 것을 차단한다.
    let durableReceiptState = null;
    if (recoveredCompleted || receipt.terminalStale !== true) {
      durableReceiptState = promotePensionBatchRequestDurableIdentityCompleted(requestId, operationsHash, {
        commitSha: String(recoveredCommitSha || receipt.commitSha || ""),
        reason: String(recoveredCompleted ? "operation_identity_recovered" : (receipt.reason || "receipt_recovered"))
      });
      if (!durableReceiptState || durableReceiptState.stored !== true || String(durableReceiptState.status || "") !== "completed") {
        throw new Error("완료된 Batch receipt를 durable batchRequestId identity로 안전하게 backfill하지 못했습니다.");
      }
      recoveredCompleted = true;
      recoveredCommitSha = String(durableReceiptState.match && durableReceiptState.match.commitSha || recoveredCommitSha || receipt.commitSha || "");
    } else {
      durableReceiptState = rememberPensionBatchRequestDurableIdentityState(requestId, operationsHash, "terminal_stale", {
        commitSha: String(receipt.commitSha || ""), reason: String(receipt.reason || "receipt_terminal_stale")
      });
      if (!durableReceiptState || durableReceiptState.stored !== true) {
        throw new Error("terminal stale Batch receipt를 durable batchRequestId identity로 안전하게 backfill하지 못했습니다.");
      }
      // 과거 completed durable state가 이미 존재하면 stale receipt보다 강한 성공 proof를 우선한다.
      if (String(durableReceiptState.status || "") === "completed") {
        recoveredCompleted = true;
        recoveredCommitSha = String(durableReceiptState.match && durableReceiptState.match.commitSha || recoveredCommitSha || receipt.commitSha || "");
      } else if (String(durableReceiptState.status || "") !== "terminal_stale") {
        throw new Error("Batch receipt의 durable 상태를 확정하지 못했습니다.");
      }
    }
    if (recoveredCompleted || receipt.terminalStale !== true) {
      if (!ensurePensionBatchOperationIdentitiesComplete(operations, requestId)) {
        throw new Error("완료된 Batch receipt의 operation exact identity를 안전하게 backfill하지 못했습니다.");
      }
    }
    if (receipt.terminalStale === true && !recoveredCompleted) {
      return {
        ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true,
        commitSha: receipt.commitSha || "", changedFiles: receipt.changedFiles || [],
        message: receipt.message || "이미 terminal stale로 종료된 과거 작업 모음입니다. 최신 상태를 유지했습니다."
      };
    }
    return {
      ok: true,
      action: "batch_duplicate_ignored",
      duplicate: true,
      commitSha: recoveredCompleted ? recoveredCommitSha : (receipt.commitSha || ""),
      changedFiles: receipt.changedFiles || [],
      message: recoveredCompleted
        ? "GitHub durable/operation identity에서 이미 완료된 동일 작업 모음을 확인했습니다. 중복 커밋은 만들지 않았습니다."
        : "이미 동일한 작업 모음 요청이 처리되었습니다. 중복 커밋은 만들지 않았습니다."
    };
  }
  return null;
}

function resolvePensionBatchDurableIdentityResult(requestId, operationsHash, preflightOperations, operations, prefetchedHead, requestCache) {
  let durableBatchRequestIdentity = null;
  try {
    if (prefetchedHead) {
      const context = loadPensionBatchRequestIdentityContext(requestId, prefetchedHead, requestCache || {});
      durableBatchRequestIdentity = assertPensionBatchRequestIdentityCompatible(context, operationsHash);
    } else {
      durableBatchRequestIdentity = findPensionBatchRequestIdentity(requestId, operationsHash);
    }
  } catch (err) {
    throw err;
  }
  if (durableBatchRequestIdentity) {
    if (String(durableBatchRequestIdentity.status || "") === "terminal_stale") {
      let recovered = false;
      let proofHead = "";
      try {
        proofHead = String(prefetchedHead || getGithubBranchHeadSha() || "");
        recovered = !!proofHead && pensionBatchExactIdentitySuccessProof(preflightOperations, requestId, proofHead, requestCache || {});
      } catch (_) { recovered = false; }
      let recoveredDurableState = null;
      if (recovered) {
        recoveredDurableState = promotePensionBatchRequestDurableIdentityCompleted(requestId, operationsHash, {
          commitSha: String(durableBatchRequestIdentity.commitSha || proofHead), reason: "operation_identity_recovered"
        });
        if (!recoveredDurableState || recoveredDurableState.stored !== true || String(recoveredDurableState.status || "") !== "completed") {
          throw new Error("operation identity가 증명한 Batch 완료 상태를 durable completed로 안전하게 승격하지 못했습니다.");
        }
      }
      if (!recovered) {
        return {
          ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true,
          commitSha: String(durableBatchRequestIdentity.commitSha || ""), changedFiles: [],
          message: "GitHub durable batch identity에서 terminal stale로 종료된 동일 작업 모음을 확인했습니다. 과거 작업은 다시 적용하지 않았습니다."
        };
      }
      return {
        ok: true, action: "batch_duplicate_ignored", duplicate: true, stale: false,
        commitSha: String(recoveredDurableState && recoveredDurableState.match && recoveredDurableState.match.commitSha || durableBatchRequestIdentity.commitSha || proofHead || ""), changedFiles: [],
        message: "operation identity ledger에서 과거 작업 모음의 완료를 확인해 durable 상태를 completed로 복구했습니다."
      };
    }
    if (!ensurePensionBatchOperationIdentitiesComplete(operations, requestId)) {
      throw new Error("완료된 durable batchRequestId의 operation exact identity를 안전하게 backfill하지 못했습니다.");
    }
    return {
      ok: true, action: "batch_duplicate_ignored", duplicate: true,
      commitSha: String(durableBatchRequestIdentity.commitSha || ""), changedFiles: [],
      message: "GitHub durable batch identity에서 이미 완료된 동일 batchRequestId를 확인했습니다. 중복 커밋은 만들지 않았습니다."
    };
  }
  return null;
}

function preparePensionBatchIdempotentExecution(body, operations, preflightOperations, requestId, operationsHash, batchReadCache, timing, prefetchedHead) {
  let resolvedOperationDecisions = {};
  const intent = findPensionBatchIntent(requestId);
  let batchBaseCommitSha = "";
  if (intent) {
    if (String(intent.operationsHash || "") !== operationsHash) {
      return {
        ok: false,
        error: "동일한 batchRequestId가 다른 작업 내용으로 처리 중이거나 재시도되었습니다. 작업 모음을 새로 구성해 다시 시도해주세요."
      };
    }
    batchBaseCommitSha = String(intent.baseCommitSha || "");
    resolvedOperationDecisions = intent.operationDecisions && typeof intent.operationDecisions === "object" ? intent.operationDecisions : {};
    if (!batchBaseCommitSha) {
      return {
        ok: false,
        error: "기존 형식의 batch intent가 남아 있습니다. 최신 데이터를 새로고침한 뒤 작업 모음을 새로 구성해주세요."
      };
    }

    let detailStartedAtMs = Date.now();
    const currentHead = String(prefetchedHead || getGithubBranchHeadSha() || "");
    recordPensionTimingDetail(timing, "batchPrepare", "currentHeadRead", detailStartedAtMs);
    if (!currentHead) {
      return { ok: false, error: "GitHub 최신 커밋을 확인하지 못했습니다." };
    }
    detailStartedAtMs = Date.now();
    primePensionBatchDependencyReadCache(operations, requestId, currentHead, batchReadCache);
    recordPensionTimingDetail(timing, "batchPrepare", "dependencyPreflight", detailStartedAtMs);

    if (intent.terminalPending === true) {
      let completedProof = false;
      try { completedProof = pensionBatchExactIdentitySuccessProof(preflightOperations, requestId, currentHead, batchReadCache); } catch (_) { completedProof = false; }
      if (completedProof) {
        const duplicateResult = {
          ok: true, action: "batch_duplicate_ignored", duplicate: true, stale: false, commitSha: currentHead, changedFiles: [],
          message: "operation identity ledger에서 이미 완료된 동일 작업 모음을 확인했습니다. 중복 커밋은 만들지 않았습니다."
        };
        let durableCompleted = false;
        try {
          const promoted = promotePensionBatchRequestDurableIdentityCompleted(requestId, operationsHash, { commitSha: currentHead, reason: "operation_identity_recovered" });
          durableCompleted = promoted && promoted.stored === true && String(promoted.status || "") === "completed";
        } catch (_) {}
        try { rememberPensionBatchReceipt(requestId, operationsHash, duplicateResult); } catch (_) {}
        if (durableCompleted) try { clearPensionBatchIntent(requestId); } catch (_) {}
        return duplicateResult;
      }
      return finalizePensionBatchTerminalStale(requestId, operationsHash, {
        ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true, commitSha: currentHead, changedFiles: [],
        reason: String(intent.terminalReason || "terminal_stale"),
        message: "이미 stale로 확정된 과거 작업 모음입니다. 최신 상태를 유지했습니다."
      });
    }

    if (intent.retryablePrecommit === true) {
      if (Number(intent.retryableEpoch || 0) !== getPensionMutationEpoch()) {
        return finalizePensionBatchTerminalStale(requestId, operationsHash, { ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true, commitSha: currentHead, changedFiles: [],
          message: "이 실패 작업 모음 이후 더 최신 퇴직연금 작업이 처리되어 과거 요청을 다시 적용하지 않았습니다." });
      }
      const currentDependencyHash = pensionBatchDependencyHash(operations, currentHead, batchReadCache, requestId);
      if (String(currentDependencyHash || "") !== String(intent.dependencyHash || "")) {
        return finalizePensionBatchTerminalStale(requestId, operationsHash, { ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true, commitSha: currentHead, changedFiles: [],
          message: "이 실패 작업 모음 이후 의존 데이터가 변경되어 과거 요청을 다시 적용하지 않았습니다." });
      }
      batchBaseCommitSha = currentHead;
      reserveAndRememberPensionBatchIntent(requestId, operationsHash, batchBaseCommitSha, currentDependencyHash, resolvedOperationDecisions);
    }

    const refreshedIntent = findPensionBatchIntent(requestId) || intent;
    const intentEpoch = Number(refreshedIntent.mutationEpoch || 0);
    if (intentEpoch > 0 && intentEpoch !== getPensionMutationEpoch()) {
      if (pensionBatchStateReflectsOperations(body, requestId, currentHead, resolvedOperationDecisions, batchReadCache)) {
        return finalizePensionBatchRecoveredDuplicate(
          operations, requestId, operationsHash, currentHead, [],
          "이미 동일한 작업 모음 결과가 반영되어 있고 durable identity까지 복구했습니다. 중복 커밋은 만들지 않았습니다."
        );
      }
      return finalizePensionBatchTerminalStale(requestId, operationsHash, {
        ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true, commitSha: currentHead, changedFiles: [],
        message: "이 작업 모음 이후 더 최신 퇴직연금 작업이 시작되어 오래된 재시도를 다시 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
      });
    }

    if (currentHead !== batchBaseCommitSha) {
      if (pensionBatchStateReflectsOperations(body, requestId, currentHead, resolvedOperationDecisions, batchReadCache)) {
        return finalizePensionBatchRecoveredDuplicate(
          operations, requestId, operationsHash, currentHead, [],
          "이미 동일한 작업 모음 결과가 반영되어 있고 durable identity까지 복구했습니다. 중복 커밋은 만들지 않았습니다."
        );
      }

      const priorDependencyHash = String(intent.dependencyHash || "");
      if (priorDependencyHash) {
        const currentDependencyHash = pensionBatchDependencyHash(operations, currentHead, batchReadCache, requestId);
        if (currentDependencyHash === priorDependencyHash) {
          batchBaseCommitSha = currentHead;
          rememberPensionBatchIntent(requestId, operationsHash, batchBaseCommitSha, currentDependencyHash, intentEpoch, false, 0, resolvedOperationDecisions);
        } else {
          return finalizePensionBatchTerminalStale(requestId, operationsHash, {
            ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true, commitSha: currentHead, changedFiles: [],
            message: "이 작업 모음이 의존하는 퇴직연금 데이터가 변경되어 오래된 재시도를 다시 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
          });
        }
      } else {
        return finalizePensionBatchTerminalStale(requestId, operationsHash, {
          ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true, commitSha: currentHead, changedFiles: [],
          message: "기존 형식의 작업 모음 intent 이후 branch가 변경되어 안전하게 재적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
        });
      }
    }
  } else {
    let detailStartedAtMs = Date.now();
    batchBaseCommitSha = String(prefetchedHead || getGithubBranchHeadSha() || "");
    recordPensionTimingDetail(timing, "batchPrepare", "baseHeadRead", detailStartedAtMs);
    if (!batchBaseCommitSha) {
      return { ok: false, error: "GitHub 기준 커밋을 확인하지 못했습니다." };
    }
    detailStartedAtMs = Date.now();
    primePensionBatchDependencyReadCache(operations, requestId, batchBaseCommitSha, batchReadCache);
    recordPensionTimingDetail(timing, "batchPrepare", "dependencyPreflight", detailStartedAtMs);
    detailStartedAtMs = Date.now();
    const dependencyHash = pensionBatchDependencyHash(operations, batchBaseCommitSha, batchReadCache, requestId);
    recordPensionTimingDetail(timing, "batchPrepare", "dependencyHash", detailStartedAtMs);
    detailStartedAtMs = Date.now();
    const fullDuplicateMatch = pensionBatchStateReflectsLogicalOperations(body, batchBaseCommitSha, batchReadCache);
    recordPensionTimingDetail(timing, "batchPrepare", "logicalStateCheck", detailStartedAtMs);
    detailStartedAtMs = Date.now();
    const conflictOperations = pensionBatchConflictDescriptors(body, batchBaseCommitSha, batchReadCache);
    recordPensionTimingDetail(timing, "batchPrepare", "conflictScan", detailStartedAtMs);
    const conflictDescriptor = { fullMatch: fullDuplicateMatch, conflicts: conflictOperations };
    const hasConflict = conflictOperations.length > 0 || fullDuplicateMatch;
    const hasConfirmation = !!String(body.confirmationToken || "").trim() || !!String(body.confirmationDecision || "").trim() || !!(body.confirmationDecisions && typeof body.confirmationDecisions === "object");
    if (hasConfirmation) {
      const confirmation = validatePensionBatchConfirmation(body, requestId, operationsHash, dependencyHash, conflictDescriptor);
      if (!hasConflict || !confirmation.valid) {
        return { ok: false, action: "confirmation_stale", stale: true, error: confirmation.error || "중복 확인 이후 작업 모음 의존 상태가 변경되었습니다. 최신 상태에서 다시 확인해주세요." };
      }
      resolvedOperationDecisions = confirmation.decisions || {};
      clearPensionConfirmation(confirmation.token);
    } else if (hasConflict) {
      return issuePensionBatchConfirmation(requestId, operationsHash, dependencyHash, conflictDescriptor);
    }
    detailStartedAtMs = Date.now();
    const mutationEpoch = reserveAndRememberPensionBatchIntent(requestId, operationsHash, batchBaseCommitSha, dependencyHash, resolvedOperationDecisions);
    recordPensionTimingDetail(timing, "batchPrepare", "intentEpochPrepare", detailStartedAtMs);

    // intent prefix cap 정리 과정에서 오래된 intent의 durable tombstone commit이 생기거나
    // 무관한 remote commit이 끼어들 수 있다. 현재 dependency가 그대로면 최신 HEAD를
    // 이 새 Batch의 base로 승격해 자기 자신의 metadata commit 때문에 첫 CAS가 실패하지 않게 한다.
    detailStartedAtMs = Date.now();
    const postIntentHead = getGithubBranchHeadSha();
    recordPensionTimingDetail(timing, "batchPrepare", "postIntentHeadRead", detailStartedAtMs);
    if (postIntentHead && postIntentHead !== batchBaseCommitSha) {
      primePensionBatchDependencyReadCache(operations, requestId, postIntentHead, batchReadCache);
      const postIntentDependencyHash = pensionBatchDependencyHash(operations, postIntentHead, batchReadCache, requestId);
      if (String(postIntentDependencyHash || "") !== String(dependencyHash || "")) {
        return finalizePensionBatchTerminalStale(requestId, operationsHash, {
          ok: true, action: "batch_stale_retry_ignored", duplicate: true, stale: true, commitSha: postIntentHead, changedFiles: [],
          message: "작업 모음 시작 직후 의존 데이터가 변경되어 과거 기준의 작업을 적용하지 않았습니다. 최신 데이터를 새로고침해 확인해주세요."
        });
      }
      batchBaseCommitSha = postIntentHead;
      rememberPensionBatchIntent(requestId, operationsHash, batchBaseCommitSha, postIntentDependencyHash, mutationEpoch, false, 0, resolvedOperationDecisions);
    }
  }
  return { ready: true, batchBaseCommitSha: batchBaseCommitSha, resolvedOperationDecisions: resolvedOperationDecisions };
}

/* --- 09G. Batch Execute / Orchestration ----------------------------------- */

function executePensionBatchIdempotent(body, operations, requestId, operationsHash, batchReadCache, batchBaseCommitSha, resolvedOperationDecisions, timing) {
  let result;
  try {
    result = handlePensionBatch(body, batchBaseCommitSha, batchReadCache, resolvedOperationDecisions, timing);
  } catch (err) {
    // branch HEAD가 그대로이거나 무관한 commit만 앞서가 dependency가 동일하면
    // 이 Batch는 Pension mutation을 만들지 못한 확정 실패다. intent/예약 epoch를 되돌린다.
    try {
      const readbackStartedAtMs = Date.now();
      const currentHeadAfterFailure = getGithubBranchHeadSha();
      const activeIntent = findPensionBatchIntent(requestId);
      const intentEpoch = Number(activeIntent && activeIntent.mutationEpoch || 0);
      let definitelyNoMutation = currentHeadAfterFailure === batchBaseCommitSha;
      if (!definitelyNoMutation && activeIntent && activeIntent.dependencyHash && currentHeadAfterFailure) {
        const currentDependencyHash = pensionBatchDependencyHash(operations, currentHeadAfterFailure, batchReadCache, requestId);
        definitelyNoMutation = String(currentDependencyHash || "") === String(activeIntent.dependencyHash || "") &&
          !pensionBatchStateReflectsOperations(body, requestId, currentHeadAfterFailure, resolvedOperationDecisions);
      }
      if (definitelyNoMutation) {
        transitionPensionBatchIntentToRetryable(
          requestId, operationsHash, currentHeadAfterFailure || batchBaseCommitSha,
          String(activeIntent && activeIntent.dependencyHash || ""), intentEpoch, resolvedOperationDecisions
        );
      }
      recordPensionTimingStage(timing, "failureReadback", readbackStartedAtMs);
    } catch (_) {}
    throw err;
  }
  if (result && result.ok) {
    // Receipt 저장 실패가 이미 성공한 GitHub commit을 실패로 뒤집지 않도록 intent를 fallback tombstone으로 남긴다.
    const finalizeStartedAtMs = Date.now();
    let receiptStored = false;
    try {
      rememberPensionBatchReceipt(requestId, operationsHash, result);
      receiptStored = true;
    } catch (_) {}
    if (receiptStored) {
      try {
        clearPensionBatchIntent(requestId);
      } catch (_) {
        // receipt가 이미 있으므로 stale intent는 receipt보다 뒤에서 평가되어 무해하다.
      }
    }
    recordPensionTimingStage(timing, "receiptIntentFinalize", finalizeStartedAtMs);

  }
  return result;
}

function handlePensionBatchIdempotentCore(body, timing) {
  const requestId = String(body && body.batchRequestId || "").trim();
  if (!requestId) {
    return { ok: false, error: "batchRequestId가 필요합니다. 작업 모음을 다시 실행해주세요." };
  }
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(requestId)) {
    return { ok: false, error: "batchRequestId 형식이 올바르지 않습니다." };
  }

  const operations = Array.isArray(body && body.operations) ? body.operations : [];
  if (!operations.length) {
    return { ok: false, error: "작업 모음이 비어 있습니다." };
  }
  if (operations.length > 100) {
    return { ok: false, error: "한 번에 처리할 수 있는 작업은 최대 100건입니다." };
  }

  // operationId도 hash 계약에 포함되므로 같은 requestId로 다른 queue를 보내면 거부된다.
  const preflightOperations = normalizePensionBatchOperations(operations, false);
  assertPensionBatchUniqueLogicalIdentities(preflightOperations);
  const operationsHash = pensionBatchOperationsHash(operations);
  const lock = LockService.getScriptLock();
  let stageStartedAtMs = Date.now();
  const locked = lock.tryLock(30000);
  recordPensionTimingStage(timing, "lockWait", stageStartedAtMs);
  if (!locked) {
    return { ok: false, error: "다른 작업 모음 요청이 처리 중입니다. 잠시 후 다시 시도해주세요." };
  }


  try {
    const batchReadCache = {};
    // Batch idempotency는 CacheService를 정합성 근거로 사용하지 않는다.
    // 유한 cache가 durable identity migration을 우회하지 않도록 receipt/GitHub durable/intent만 Source of Truth로 판단한다.

    stageStartedAtMs = Date.now();
    prepareDirectRequestMaintenanceBoundary("PENSION_BATCH_I_", requestDirectPropertyKey("PENSION_BATCH_I_", requestId));
    recordPensionTimingStage(timing, "maintenanceBoundary", stageStartedAtMs);

    stageStartedAtMs = Date.now();
    const receiptResult = resolvePensionBatchReceiptResult(requestId, operationsHash, preflightOperations, operations);
    recordPensionTimingStage(timing, "receiptResolve", stageStartedAtMs);
    if (receiptResult) return receiptResult;

    stageStartedAtMs = Date.now();
    let detailStartedAtMs = Date.now();
    const initialHead = getGithubBranchHeadSha();
    recordPensionTimingDetail(timing, "batchInitial", "headRead", detailStartedAtMs);
    if (!initialHead) return { ok: false, error: "GitHub 최신 커밋을 확인하지 못했습니다." };
    detailStartedAtMs = Date.now();
    primePensionBatchInitialReadCache(operations, requestId, initialHead, batchReadCache);
    recordPensionTimingDetail(timing, "batchInitial", "parallelRead", detailStartedAtMs);
    recordPensionTimingStage(timing, "initialBatchPreflight", stageStartedAtMs);

    stageStartedAtMs = Date.now();
    const durableIdentityResult = resolvePensionBatchDurableIdentityResult(
      requestId, operationsHash, preflightOperations, operations, initialHead, batchReadCache
    );
    recordPensionTimingStage(timing, "durableIdentityResolve", stageStartedAtMs);
    if (durableIdentityResult) return durableIdentityResult;

    stageStartedAtMs = Date.now();
    const prepared = preparePensionBatchIdempotentExecution(
      body, operations, preflightOperations, requestId, operationsHash, batchReadCache, timing, initialHead
    );
    recordPensionTimingStage(timing, "intentDependencyPrepare", stageStartedAtMs);
    if (!prepared || prepared.ready !== true) return prepared;

    return executePensionBatchIdempotent(
      body, operations, requestId, operationsHash, batchReadCache,
      prepared.batchBaseCommitSha, prepared.resolvedOperationDecisions, timing
    );
  } finally {
    lock.releaseLock();
  }
}

function handlePensionBatchIdempotent(body) {
  const timing = createPensionTimingTrace("batch", body);
  try {
    const result = handlePensionBatchIdempotentCore(body, timing);
    return attachPensionTiming(timing, result, result && result.action || (result && result.ok ? "ok" : "error"));
  } catch (err) {
    try { err.pensionTiming = buildPensionTimingSnapshot(timing, "error"); } catch (_) {}
    throw err;
  }
}

/* =========================================================
 * 10. KRX 갱신 / Durable Dispatch / GitHub Actions
 * ========================================================= */

// 화면 노출 가능한 최신 prices snapshot을 찾는다.

/* --- 10A. KRX Dispatch Decision ------------------------------------------- */

function latestVisiblePriceSnapshot(prices) {
  const keys = Object.keys(prices || {})
    .filter(function(date) {
      const item = prices[date];
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && item && item.display !== false;
    })
    .sort();

  if (!keys.length) {
    return null;
  }

  const date = keys[keys.length - 1];

  return {
    date: date,
    snapshot: prices[date] || {}
  };
}


function krxSnapshotPriceBasis(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  const explicit = String(snapshot.priceBasis || "").trim();
  if (explicit) return explicit;
  return String(snapshot.marketStatus || "close") === "intraday" ? "intraday" : "legacy_close";
}

function krxSnapshotHasVerifiedRegularClose(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || snapshot.display === false) return false;
  if (krxSnapshotPriceBasis(snapshot) !== "regular_close") return false;
  // 2026-09-17 source-policy revision: regular_close is trusted only when the
  // updater explicitly attests that the value came from raw KRX pykrx data.
  // Older regular_close rows without this attestation are re-confirmed once.
  const source = String(snapshot.regularCloseSource || "").trim();
  return source === "pykrx_raw" || source.indexOf("pykrx_raw+") === 0;
}

// 현재 시각·최신 데이터 상태에 따라 KRX workflow 실행 필요성을 판단한다.
function shouldDispatchKrxWorkflow(body, prefetchedPrices) {
  const explicitDate = String(body.date || "").trim();
  const prices = arguments.length >= 2
    ? (prefetchedPrices || {})
    : ((readGithubJson("data/prices.json").data) || {});

  // 사용자가 누른 선택일 재갱신은 저장 라벨과 무관하게 실제로 다시 조회한다.
  // 같은 requestId의 재시도/진행 중 중복 실행 방지는 바깥 durable dispatch 경계가 담당한다.
  if (explicitDate) {
    return {
      shouldDispatch: true,
      reason: "explicit_date_refresh"
    };
  }

  const latest = latestVisiblePriceSnapshot(prices);
  const now = nowKSTDateTimeInfo();

  if (!latest) {
    return {
      shouldDispatch: true,
      reason: "no_price_data"
    };
  }

  const latestStatus = String(latest.snapshot.marketStatus || "close");
  const previousBusinessDate = previousBusinessDateText(now.dateText, now.day);

  // 장중에는 같은 날짜라도 현재가 갱신을 계속 허용
  if (now.isMarketTime) {
    return {
      shouldDispatch: true,
      reason: "market_time_refresh"
    };
  }

  // 오늘 데이터가 raw pykrx 정규장 종가로 검증된 경우에만 추가 실행을 막는다.
  if (latest.date === now.dateText && krxSnapshotHasVerifiedRegularClose(latest.snapshot)) {
    return {
      shouldDispatch: false,
      reason: "already_closed_today",
      message: "이미 정규장 종가 기준 데이터가 반영되어 있습니다."
    };
  }

  // 오늘 장중 데이터가 있고, 장 마감 후라면 정규장 종가 확정용 실행 허용
  if (latest.date === now.dateText && latestStatus === "intraday" && now.isAfterClose) {
    return {
      shouldDispatch: true,
      reason: "finalize_intraday_after_close"
    };
  }

  // 과거 구현이 close/regular_close만 저장했거나 source attestation 없는 당일 데이터는
  // raw pykrx 정규장 종가 source로 한 번 재확정한다.
  if (latest.date === now.dateText && latestStatus === "close" && !krxSnapshotHasVerifiedRegularClose(latest.snapshot) && now.isAfterClose) {
    return {
      shouldDispatch: true,
      reason: "reconfirm_regular_close"
    };
  }

  // 장 시작 전에는 직전 영업일 데이터가 raw pykrx regular_close로 검증된 경우에만 실행하지 않는다.
  if (now.isBeforeOpen && krxSnapshotHasVerifiedRegularClose(latest.snapshot) && latest.date >= previousBusinessDate) {
    return {
      shouldDispatch: false,
      reason: "before_open_already_closed",
      message: "장 시작 전이며 최신 정규장 종가 데이터가 이미 반영되어 있습니다."
    };
  }

  // 주말에도 직전 영업일 데이터가 raw pykrx regular_close로 검증된 경우에만 실행하지 않는다.
  if (!now.isWeekday && krxSnapshotHasVerifiedRegularClose(latest.snapshot) && latest.date >= previousBusinessDate) {
    return {
      shouldDispatch: false,
      reason: "weekend_already_closed",
      message: "장중 시간이 아니며 최신 정규장 종가 데이터가 이미 반영되어 있습니다."
    };
  }

  return {
    shouldDispatch: true,
    reason: "possible_missing_dates"
  };
}

// KRX requestId 완료 이력은 Script Properties GC 이후에도 동일 requestId가 다시 dispatch되지 않도록
// requestId hash 2자리 shard의 GitHub durable ledger에 보존한다.

/* --- 10B. Durable Dispatch Ledger ----------------------------------------- */

function krxDispatchLedgerHash(requestId) { return sha256HexText(String(requestId || "")); }
function krxDispatchIdentityHash(requestId) { return krxDispatchLedgerHash(requestId).slice(0, 32); }
// 64자리 legacy full hash와 현재 32자리 identity hash를 동일한 128bit identity로 비교한다.
// 저장 형식 자체는 normalize 단계에서 검증하므로 lookup은 유효한 hash만 canonicalize하고 그 외 값은 match하지 않는다.
function krxDispatchCanonicalIdentityHash(identityHash) {
  const hash = String(identityHash || "").toLowerCase();
  return /^[0-9a-f]{32,64}$/.test(hash) ? hash.slice(0, 32) : "";
}
function krxDispatchLedgerShardPathFromIdentityHash(identityHash) {
  const hash = String(identityHash || "").toLowerCase();
  if (!/^[0-9a-f]{32,64}$/.test(hash)) throw new Error("KRX durable identity hash 형식이 올바르지 않습니다.");
  return KRX_DISPATCH_LEDGER_DIR + "/" + hash.slice(0, KRX_DISPATCH_LEDGER_SHARD_PREFIX_LENGTH) + ".json";
}
const KRX_DURABLE_DECISION_REASONS = Object.freeze({
  explicit_date_already_closed: true,
  explicit_date_refresh: true,
  no_price_data: true,
  market_time_refresh: true,
  already_closed_today: true,
  finalize_intraday_after_close: true,
  reconfirm_regular_close: true,
  before_open_already_closed: true,
  weekend_already_closed: true,
  possible_missing_dates: true,
  no_dispatch_needed: true
});
const KRX_DURABLE_SYSTEM_REASONS = Object.freeze({
  dispatch_rejected: true,
  dispatch_uncertain_terminal: true,
  dispatch_retry_inflight: true,
  dispatch_marker_recovered: true,
  dispatch_server_run_recovered: true,
  dispatch_accepted_recovered: true,
  dispatch_receipt_recovered: true,
  duplicate_request: true
});
function assertKrxDurableReason(reason, label) {
  const value = String(reason || "");
  if (KRX_DURABLE_DECISION_REASONS[value] || KRX_DURABLE_SYSTEM_REASONS[value]) return value;
  if (value.indexOf("workflow_skipped:") === 0) {
    const suffix = value.slice("workflow_skipped:".length);
    if (KRX_DURABLE_DECISION_REASONS[suffix]) return value;
  }
  throw new Error(label + " reason 상태가 올바르지 않습니다. 저장을 중단했습니다.");
}

function normalizeKrxDispatchLedger(data) {
  const items = storedDurableLedgerItems(data, "dispatches", "KRX durable dispatch ledger");
  const seenIdentityHashes = {};
  return items.map(function(item, index) {
    const label = "KRX durable dispatch ledger " + (index + 1) + "번 row";
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(label + " 형식이 올바르지 않습니다. 저장을 중단했습니다.");
    }
    const requestId = item.requestId == null ? "" : assertStoredDurableStringField(item, "requestId", label, false, true);
    let requestIdHash = item.requestIdHash == null ? "" : assertStoredDurableStringField(item, "requestIdHash", label, false, false);
    if (!requestId && !requestIdHash) throw new Error(label + " request identity가 없습니다. 저장을 중단했습니다.");
    if (!requestIdHash && requestId) requestIdHash = krxDispatchIdentityHash(requestId);
    requestIdHash = assertStoredDurableHash(requestIdHash, label + " requestIdHash", [32, 64]);
    if (requestId && requestIdHash !== krxDispatchIdentityHash(requestId) && requestIdHash !== krxDispatchLedgerHash(requestId)) {
      throw new Error(label + " requestId와 requestIdHash가 일치하지 않습니다. 저장을 중단했습니다.");
    }
    // 64자리 legacy full hash와 현재 32자리 identity hash가 같은 request를 가리킬 수 있으므로
    // 중복 판정은 앞 128bit canonical identity 기준으로 수행한다.
    const canonicalIdentityHash = requestId ? krxDispatchIdentityHash(requestId) : requestIdHash.slice(0, 32);
    if (seenIdentityHashes[canonicalIdentityHash]) throw new Error(label + " request identity가 중복됩니다. 저장을 중단했습니다.");
    seenIdentityHashes[canonicalIdentityHash] = true;
    const requestHash = assertStoredDurableHash(assertStoredDurableStringField(item, "hash", label, true, false), label + " request hash", [64]);
    // legacy hash-only identity는 오래된 local intent에서 branch가 비어 있을 수 있다.
    // raw requestId를 가진 현재형 row는 branch를 필수로 유지하되, legacy row만 빈 branch를 허용한다.
    const branch = requestId
      ? assertStoredDurableStringField(item, "branch", label, true, false)
      : (item.branch == null ? "" : assertStoredDurableStringField(item, "branch", label, false, true));
    const reason = assertKrxDurableReason(assertStoredDurableStringField(item, "reason", label, true, false), label);
    ["date", "workflowRunId", "runUrl", "htmlUrl", "savedAtKST"].forEach(function(field) {
      if (item[field] != null) assertStoredDurableStringField(item, field, label, false, true);
    });
    const date = String(item.date || "");
    if (date && !isValidDateText(date)) throw new Error(label + " date가 올바르지 않습니다. 저장을 중단했습니다.");
    if (requestId && requestHash !== krxDispatchHash(branch, date)) {
      throw new Error(label + " request hash가 branch/date와 일치하지 않습니다. 저장을 중단했습니다.");
    }
    return { requestId: requestId, requestIdHash: requestIdHash, hash: requestHash, branch: branch, date: date,
      workflowRunId: String(item.workflowRunId || ""), runUrl: String(item.runUrl || ""), htmlUrl: String(item.htmlUrl || ""),
      reason: reason, savedAtKST: String(item.savedAtKST || ""), savedAtMs: storedDurableSavedAtMs(item.savedAtMs, label) };
  }).sort(function(a,b) { return Number(a.savedAtMs || 0) - Number(b.savedAtMs || 0); });
}
function findCompatibleKrxDispatchLedgerEntry(items, identityHash, requestId, requestHash) {
  const id = String(requestId || "");
  const canonicalIdentityHash = krxDispatchCanonicalIdentityHash(identityHash);
  const match = (Array.isArray(items) ? items : []).find(function(item) {
    const storedIdentityHash = krxDispatchCanonicalIdentityHash(item && item.requestIdHash);
    return (!!canonicalIdentityHash && storedIdentityHash === canonicalIdentityHash) ||
      (!!id && String(item && item.requestId || "") === id);
  }) || null;
  if (match && String(match.hash || "") && String(match.hash || "") !== String(requestHash || "")) {
    throw new Error("동일한 KRX requestId가 다른 갱신 조건에 이미 사용되었습니다.");
  }
  return match;
}

function findKrxDispatchLedgerEntry(requestId) {
  const id = String(requestId || "");
  if (!id) return null;
  const identityHash = krxDispatchIdentityHash(id);
  // read-only identity lookup은 branch ref를 직접 읽어 별도 HEAD 조회 한 번을 없앤다.
  // file SHA는 이후 Contents API CAS write에서 같은 shard 경쟁 검증에 사용된다.
  const current = readGithubJsonOptional(
    krxDispatchLedgerShardPathFromIdentityHash(identityHash),
    getProp("GITHUB_BRANCH"),
    []
  );
  const items = normalizeKrxDispatchLedger(current.data);
  const canonicalIdentityHash = krxDispatchCanonicalIdentityHash(identityHash);
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index] || {};
    if (String(item.requestId || "") === id ||
        (!!canonicalIdentityHash && krxDispatchCanonicalIdentityHash(item.requestIdHash) === canonicalIdentityHash)) return item;
  }
  return null;
}
function krxDispatchDurableStatus(entry) {
  const reason = String(entry && entry.reason || "");
  if (reason === "dispatch_rejected") return "rejected_retryable";
  if (reason === "dispatch_uncertain_terminal" || reason === "dispatch_retry_inflight") return "terminal_uncertain";
  return "completed";
}

function rememberKrxDispatchLedgerIdentityState(requestId, requestIdHash, requestHash, info) {
  const id = String(requestId || "");
  const identityHash = String(requestIdHash || (id ? krxDispatchIdentityHash(id) : "")).toLowerCase();
  if (!identityHash) return { stored: false, status: "", match: null };
  const path = krxDispatchLedgerShardPathFromIdentityHash(identityHash);
  const branch = getProp("GITHUB_BRANCH");
  let lastWriteError = null;

  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const current = readGithubJsonOptional(path, branch, []);
    const items = normalizeKrxDispatchLedger(current.data);
    const existing = findCompatibleKrxDispatchLedgerEntry(items, identityHash, id, requestHash);
    if (existing) return { stored: true, status: krxDispatchDurableStatus(existing), match: existing };

    const created = {
      requestId: id, requestIdHash: identityHash, hash: String(requestHash || ""),
      branch: String(info && info.branch || ""), date: String(info && info.date || ""),
      workflowRunId: String(info && info.workflowRunId || ""), runUrl: String(info && info.runUrl || ""), htmlUrl: String(info && info.htmlUrl || ""),
      reason: String(info && info.reason || ""), savedAtKST: nowKSTText(), savedAtMs: Date.now()
    };
    const nextItems = normalizeKrxDispatchLedger(items.concat([created]));
    const write = tryWriteGithubJsonContentsCas(path, current.sha, nextItems, "Record KRX dispatch " + (id || identityHash));
    if (write.stored) return { stored: true, status: krxDispatchDurableStatus(created), match: created };
    lastWriteError = write.error || lastWriteError;
  }

  // 마지막 PUT의 응답만 유실됐을 수 있으므로 한 번 더 최신 shard를 읽어 exact identity/hash 반영 여부를 확인한다.
  const finalCurrent = readGithubJsonOptional(path, branch, []);
  const finalItems = normalizeKrxDispatchLedger(finalCurrent.data);
  const finalMatch = findCompatibleKrxDispatchLedgerEntry(finalItems, identityHash, id, requestHash);
  if (finalMatch) return { stored: true, status: krxDispatchDurableStatus(finalMatch), match: finalMatch };
  if (lastWriteError) throw lastWriteError;
  return { stored: false, status: "", match: null };
}

function rememberKrxDispatchLedgerEntryState(requestId, requestHash, info) {
  const id = String(requestId || "");
  return rememberKrxDispatchLedgerIdentityState(id, id ? krxDispatchIdentityHash(id) : "", requestHash, info);
}

// 기존 KRX durable identity의 reason/status를 CAS로 교체한다.
// 명시적 4xx는 rejected_retryable, 그 rejected request를 실제 재-dispatch하기 직전에는
// dispatch_retry_inflight(=terminal_uncertain)로 전환해 이후 5xx/응답 유실 시 중복 dispatch를 차단한다.
function setKrxDispatchLedgerIdentityState(requestId, requestIdHash, requestHash, info) {
  const id = String(requestId || "");
  const identityHash = String(requestIdHash || (id ? krxDispatchIdentityHash(id) : "")).toLowerCase();
  if (!identityHash) return { stored: false, status: "", match: null };
  const path = krxDispatchLedgerShardPathFromIdentityHash(identityHash);
  const branch = getProp("GITHUB_BRANCH");
  const requestedStatus = krxDispatchDurableStatus({ reason: String(info && info.reason || "") });
  let lastWriteError = null;

  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const current = readGithubJsonOptional(path, branch, []);
    const items = normalizeKrxDispatchLedger(current.data);
    let existing = findCompatibleKrxDispatchLedgerEntry(items, identityHash, id, requestHash);
    // completed는 실제 accepted/no-op 완료의 가장 강한 terminal proof다.
    // stale local rejected/inflight residue가 GC나 retry 경계에서 completed durable identity를 약한 상태로 되돌리지 못하게 한다.
    if (existing && krxDispatchDurableStatus(existing) === "completed") {
      const requestedReason = String(info && info.reason || existing.reason || "");
      if (krxDispatchDurableStatus({ reason: requestedReason }) !== "completed") {
        return { stored: true, status: "completed", match: existing };
      }
    }

    const next = existing || { requestId: id, requestIdHash: identityHash, hash: String(requestHash || "") };
    next.requestId = id || String(next.requestId || "");
    next.requestIdHash = identityHash;
    next.hash = String(requestHash || next.hash || "");
    next.branch = String(info && info.branch || next.branch || "");
    next.date = String(info && info.date || next.date || "");
    next.reason = String(info && info.reason || next.reason || "");
    next.workflowRunId = String(info && info.workflowRunId || "");
    next.runUrl = String(info && info.runUrl || "");
    next.htmlUrl = String(info && info.htmlUrl || "");
    next.savedAtKST = nowKSTText();
    next.savedAtMs = Date.now();
    const nextItems = existing ? items : items.concat([next]);
    const normalized = normalizeKrxDispatchLedger(nextItems);
    const write = tryWriteGithubJsonContentsCas(
      path,
      current.sha,
      normalized,
      "Set KRX dispatch state " + (id || identityHash) + " [" + String(next.reason || "") + "]"
    );
    if (write.stored) return { stored: true, status: krxDispatchDurableStatus(next), match: next };
    lastWriteError = write.error || lastWriteError;
  }

  const finalCurrent = readGithubJsonOptional(path, branch, []);
  const finalItems = normalizeKrxDispatchLedger(finalCurrent.data);
  const finalMatch = findCompatibleKrxDispatchLedgerEntry(finalItems, identityHash, id, requestHash);
  if (finalMatch) {
    const finalStatus = krxDispatchDurableStatus(finalMatch);
    // completed는 어떤 약한 requested state보다 강하고, 그 외에는 요청한 상태와 정확히 수렴해야 한다.
    if (finalStatus === "completed" || finalStatus === requestedStatus) {
      return { stored: true, status: finalStatus, match: finalMatch };
    }
  }
  if (lastWriteError) throw lastWriteError;
  return { stored: false, status: "", match: finalMatch || null };
}

function setKrxDispatchLedgerEntryState(requestId, requestHash, info) {
  const id = String(requestId || "");
  if (!id) return { stored: false, status: "", match: null };
  return setKrxDispatchLedgerIdentityState(id, krxDispatchIdentityHash(id), requestHash, info);
}

function setLegacyKrxDispatchLedgerEntryState(requestIdHash, requestHash, info) {
  return setKrxDispatchLedgerIdentityState("", String(requestIdHash || ""), requestHash, info);
}

function rememberLegacyKrxDispatchLedgerEntryState(requestIdHash, requestHash, info) {
  return rememberKrxDispatchLedgerIdentityState("", String(requestIdHash || ""), requestHash, info);
}

function rememberKrxDispatchLedgerEntry(requestId, requestHash, info) {
  return rememberKrxDispatchLedgerEntryState(requestId, requestHash, info).stored === true;
}

// KRX receipt는 direct property를 우선 사용하고 legacy array는 read-only fallback으로만 유지한다.

/* --- 10C. Local Receipt / Intent / Operation Marker ----------------------- */

function findKrxDispatchReceipt(requestId) {
  if (!requestId) return null;
  const props = PropertiesService.getScriptProperties();
  const direct = parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("KRX_DISPATCH_R_", requestId)));
  if (direct) return direct;
  return readLegacyArrayProperty("KRX_DISPATCH_RECEIPTS").find(function(item) {
    return item && String(item.id || "") === String(requestId || "");
  }) || null;
}

function findKrxDispatchIntent(requestId) {
  if (!requestId) return null;
  const props = PropertiesService.getScriptProperties();
  return parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("KRX_DISPATCH_I_", requestId)));
}

function krxDispatchHash(branch, date) {
  return sha256HexText(canonicalPensionBatchJson({
    branch: String(branch || ""),
    date: String(date || "")
  }));
}

function krxDispatchIntentPropertyEntry(requestId, requestHash, info) {
  return {
    prefix: "KRX_DISPATCH_I_",
    key: requestDirectPropertyKey("KRX_DISPATCH_I_", requestId),
    value: {
      requestId: String(requestId || ""),
      hash: String(requestHash || ""),
      branch: String(info && info.branch || ""),
      date: String(info && info.date || ""),
      reason: String(info && info.reason || ""),
      workflowRunId: String(info && info.workflowRunId || ""),
      runUrl: String(info && info.runUrl || ""),
      htmlUrl: String(info && info.htmlUrl || ""),
      dispatchAccepted: info && info.dispatchAccepted === true,
      dispatchRejected: info && info.dispatchRejected === true,
      rejectedStatus: Number(info && info.rejectedStatus || 0),
      savedAtKST: nowKSTText(),
      savedAtMs: Date.now()
    }
  };
}

function rememberKrxDispatchIntent(requestId, requestHash, info) {
  const props = PropertiesService.getScriptProperties();
  const entry = krxDispatchIntentPropertyEntry(requestId, requestHash, info);
  setDirectRequestProperty(props, entry.prefix, entry.key, entry.value);
}

function clearKrxDispatchIntent(requestId) {
  return clearDirectRequestProperty("KRX_DISPATCH_I_", requestId, true);
}

function krxDispatchReceiptPropertyEntry(requestId, requestHash, info) {
  return {
    prefix: "KRX_DISPATCH_R_",
    key: requestDirectPropertyKey("KRX_DISPATCH_R_", requestId),
    value: {
      hash: String(requestHash || ""),
      branch: String(info && info.branch || ""),
      date: String(info && info.date || ""),
      reason: String(info && info.reason || ""),
      workflowRunId: String(info && info.workflowRunId || ""),
      runUrl: String(info && info.runUrl || ""),
      htmlUrl: String(info && info.htmlUrl || ""),
      terminalUncertain: info && info.terminalUncertain === true,
      savedAtKST: nowKSTText(),
      savedAtMs: Date.now()
    }
  };
}

function rememberKrxDispatchReceipt(requestId, requestHash, info) {
  if (!requestId) return;
  const props = PropertiesService.getScriptProperties();
  const entry = krxDispatchReceiptPropertyEntry(requestId, requestHash, info);
  setDirectRequestProperty(props, entry.prefix, entry.key, entry.value);
}

function krxOperationHash(branch, date) {
  return sha256HexText(canonicalPensionBatchJson({ branch: String(branch || ""), mode: String(date || "") ? "date" : "auto", date: String(date || "") }));
}

function findKrxOperationMarker(operationHash) {
  const props = PropertiesService.getScriptProperties();
  return parsePensionDirectProperty(props.getProperty(requestDirectPropertyKey("KRX_OP_", operationHash)));
}

function krxOperationMarkerPropertyEntry(operationHash, requestId, branch, date, runInfo) {
  return {
    prefix: "KRX_OP_",
    key: requestDirectPropertyKey("KRX_OP_", operationHash),
    value: {
      operationHash: String(operationHash || ""), requestId: String(requestId || ""), branch: String(branch || ""), date: String(date || ""),
      workflowRunId: String(runInfo && runInfo.workflowRunId || ""),
      runUrl: String(runInfo && runInfo.runUrl || ""),
      htmlUrl: String(runInfo && runInfo.htmlUrl || ""),
      savedAtKST: nowKSTText(), savedAtMs: Date.now()
    }
  };
}

function rememberKrxOperationMarker(operationHash, requestId, branch, date, runInfo) {
  const props = PropertiesService.getScriptProperties();
  const entry = krxOperationMarkerPropertyEntry(operationHash, requestId, branch, date, runInfo);
  setDirectRequestProperty(props, entry.prefix, entry.key, entry.value);
}

function clearKrxOperationMarker(operationHash) {
  return clearDirectRequestProperty("KRX_OP_", operationHash, true);
}

/* --- 10D. Workflow Run Query / Acceptance Proof --------------------------- */

function krxWorkflowDisplayPrefix(date) {
  return "KRX update " + (String(date || "") || "auto") + " ·";
}

function isActiveKrxWorkflowRun(run) {
  const activeStatuses = { queued: true, in_progress: true, waiting: true, pending: true, requested: true };
  return !!run && !!activeStatuses[String(run.status || "")];
}

function getKrxWorkflowRunById(runId) {
  const id = String(runId || "").trim();
  if (!/^\d+$/.test(id)) return null;
  try {
    return githubRequest("get", "/actions/runs/" + encodeURIComponent(id));
  } catch (err) {
    if (Number(err && err.githubHttpStatus || 0) === 404) return null;
    throw err;
  }
}

function krxActiveWorkflowQueryPaths(branch) {
  const basePath = "/actions/workflows/" + encodeURIComponent(KRX_WORKFLOW_FILE) +
    "/runs?branch=" + encodeURIComponent(String(branch || "")) + "&event=workflow_dispatch";
  return KRX_ACTIVE_WORKFLOW_STATUSES.map(function(status) {
    return basePath + "&status=" + encodeURIComponent(status) +
      "&per_page=" + KRX_ACTIVE_WORKFLOW_PAGE_SIZE + "&page=1";
  });
}

function findActiveKrxWorkflowRunFromResults(date, results) {
  const prefix = krxWorkflowDisplayPrefix(date);
  let coverageIncomplete = false;
  const list = Array.isArray(results) ? results : [];

  for (let index = 0; index < list.length; index += 1) {
    const result = list[index] || {};
    const runs = Array.isArray(result.workflow_runs) ? result.workflow_runs : [];
    const match = runs.find(function(run) {
      return isActiveKrxWorkflowRun(run) && String(run.display_title || "").indexOf(prefix) === 0;
    });
    if (match) return match;

    if (Object.prototype.hasOwnProperty.call(result, "total_count")) {
      const totalCount = Number(result.total_count);
      if (!Number.isFinite(totalCount) || totalCount < 0 || totalCount > runs.length) coverageIncomplete = true;
    } else if (runs.length >= KRX_ACTIVE_WORKFLOW_PAGE_SIZE) {
      coverageIncomplete = true;
    }
  }

  if (coverageIncomplete) {
    throw new Error("GitHub Actions 활성 KRX run이 조회 한도를 넘어 전체 상태를 확정하지 못했습니다.");
  }
  return null;
}

function findActiveKrxWorkflowRun(branch, date) {
  return findActiveKrxWorkflowRunFromResults(date, githubRequestManyGet(krxActiveWorkflowQueryPaths(branch)));
}

function findKrxWorkflowRunByRequestId(branch, date, requestId) {
  const expectedTitle = krxWorkflowDisplayPrefix(date) + " " + String(requestId || "");
  for (let page = 1; page <= 10; page += 1) {
    const result = githubRequest("get", "/actions/workflows/" + encodeURIComponent(KRX_WORKFLOW_FILE) +
      "/runs?branch=" + encodeURIComponent(String(branch || "")) + "&event=workflow_dispatch&per_page=100&page=" + page);
    const runs = (result && result.workflow_runs) || [];
    const match = runs.find(function(run) {
      return String(run && run.display_title || "") === expectedTitle &&
        String(run && run.event || "") === "workflow_dispatch" &&
        String(run && run.head_branch || "") === String(branch || "");
    });
    if (match) return match;
    if (runs.length < 100) break;
  }
  return null;
}

function findKrxDispatchAcceptanceProof(branch, date, requestId) {
  const operationHash = krxOperationHash(branch, date);
  const marker = findKrxOperationMarker(operationHash);
  if (marker && String(marker.requestId || "") === String(requestId || "") && String(marker.workflowRunId || "")) {
    return {
      workflowRunId: String(marker.workflowRunId || ""), runUrl: String(marker.runUrl || ""), htmlUrl: String(marker.htmlUrl || ""),
      reason: "dispatch_marker_recovered"
    };
  }
  const run = findKrxWorkflowRunByRequestId(branch, date, requestId);
  if (!run) return null;
  return {
    workflowRunId: String(run.id || ""),
    runUrl: String(run.url || ""),
    htmlUrl: String(run.html_url || ""),
    reason: "dispatch_server_run_recovered"
  };
}

function promoteKrxDispatchLedgerEntryCompleted(requestId, requestHash, info, prefetchedCurrent) {
  const id = String(requestId || "");
  if (!id) return { stored: false, status: "", match: null };
  const identityHash = krxDispatchIdentityHash(id);
  const path = krxDispatchLedgerShardPathFromIdentityHash(identityHash);
  const branch = getProp("GITHUB_BRANCH");
  let lastWriteError = null;
  const seededCurrent = prefetchedCurrent && String(prefetchedCurrent.path || "") === path
    ? { sha: String(prefetchedCurrent.sha || ""), data: prefetchedCurrent.data || [], missing: prefetchedCurrent.missing === true }
    : null;

  for (let attempt = 0; attempt < DURABLE_GITHUB_CAS_ATTEMPTS; attempt += 1) {
    const current = attempt === 0 && seededCurrent ? seededCurrent : readGithubJsonOptional(path, branch, []);
    const items = normalizeKrxDispatchLedger(current.data);
    const existing = findCompatibleKrxDispatchLedgerEntry(items, identityHash, id, requestHash);
    if (!existing) {
      const created = {
        requestId: id, requestIdHash: identityHash, hash: String(requestHash || ""),
        branch: String(info && info.branch || ""), date: String(info && info.date || ""),
        workflowRunId: String(info && info.workflowRunId || ""), runUrl: String(info && info.runUrl || ""), htmlUrl: String(info && info.htmlUrl || ""),
        reason: String(info && info.reason || ""), savedAtKST: nowKSTText(), savedAtMs: Date.now()
      };
      const write = tryWriteGithubJsonContentsCas(
        path,
        current.sha,
        normalizeKrxDispatchLedger(items.concat([created])),
        "Record KRX dispatch " + id
      );
      if (write.stored) return { stored: true, status: krxDispatchDurableStatus(created), match: created };
      lastWriteError = write.error || lastWriteError;
      continue;
    }

    if (krxDispatchDurableStatus(existing) === "completed") {
      return { stored: true, status: "completed", match: existing };
    }

    existing.requestId = id;
    existing.requestIdHash = identityHash;
    existing.reason = String(info && info.reason || "dispatch_accepted_recovered");
    existing.workflowRunId = String(info && info.workflowRunId || existing.workflowRunId || "");
    existing.runUrl = String(info && info.runUrl || existing.runUrl || "");
    existing.htmlUrl = String(info && info.htmlUrl || existing.htmlUrl || "");
    existing.savedAtKST = nowKSTText();
    existing.savedAtMs = Date.now();
    const write = tryWriteGithubJsonContentsCas(
      path,
      current.sha,
      normalizeKrxDispatchLedger(items),
      "Recover KRX dispatch " + id
    );
    if (write.stored) return { stored: true, status: "completed", match: existing };
    lastWriteError = write.error || lastWriteError;
  }

  const finalCurrent = readGithubJsonOptional(path, branch, []);
  const finalItems = normalizeKrxDispatchLedger(finalCurrent.data);
  const finalMatch = findCompatibleKrxDispatchLedgerEntry(finalItems, identityHash, id, requestHash);
  if (finalMatch && krxDispatchDurableStatus(finalMatch) === "completed") {
    return { stored: true, status: "completed", match: finalMatch };
  }
  if (lastWriteError) throw lastWriteError;
  return { stored: false, status: "", match: finalMatch || null };
}

function recoverKrxDispatchCompletedFromProof(requestId, requestHash, branch, date) {
  let proof = null;
  try { proof = findKrxDispatchAcceptanceProof(branch, date, requestId); } catch (_) { return null; }
  if (!proof) return null;
  let durable = null;
  try {
    durable = promoteKrxDispatchLedgerEntryCompleted(requestId, requestHash, {
      branch: branch, date: date, reason: proof.reason, workflowRunId: proof.workflowRunId, runUrl: proof.runUrl, htmlUrl: proof.htmlUrl
    });
  } catch (_) { durable = null; }
  try {
    rememberKrxDispatchReceipt(requestId, requestHash, {
      branch: branch, date: date, reason: proof.reason, workflowRunId: proof.workflowRunId, runUrl: proof.runUrl, htmlUrl: proof.htmlUrl, terminalUncertain: false
    });
  } catch (_) {}
  // exact server/marker proof는 실제 acceptance를 증명하지만, 장기 idempotency를 위해
  // GitHub durable completed identity까지 확보된 경우에만 completed 복구를 확정한다.
  // durable 승격 실패 시 기존 uncertain/intent evidence를 유지해 새 dispatch를 보내지 않는다.
  if (!(durable && durable.stored === true && String(durable.status || "") === "completed")) return null;
  try { clearKrxDispatchIntent(requestId); } catch (_) {}
  return proof;
}

function krxWorkflowInProgressResult(branch, date, run) {
  return {
    ok: true, action: "workflow_in_progress", duplicate: true, workflow: KRX_WORKFLOW_FILE, branch: branch, date: date || "",
    workflowRunId: String(run && run.id || ""),
    message: "동일한 KRX 현재가 반영 작업이 이미 queued/running 상태입니다. 새 dispatch는 만들지 않았습니다."
  };
}

// workflow_skipped는 해당 requestId의 terminal no-op 완료를 durable ledger에 남긴 뒤 성공 응답한다.
// skip 응답이 유실된 뒤 외부 상태가 바뀌더라도 같은 requestId가 실제 dispatch로 부활하지 않아야 한다.
// krx_dispatch_ledger 경로는 Pages paths-ignore 대상이므로 이 durable write가 Pages 재배포를 유발하지 않는다.
function finalizeKrxWorkflowSkipped(requestId, requestHash, branch, date, decision) {
  const decisionReason = String(decision && decision.reason || "no_dispatch_needed");

  const skipReason = "workflow_skipped:" + decisionReason;
  const skippedState = setKrxDispatchLedgerEntryState(requestId, requestHash, {
    branch: branch, date: date, reason: skipReason
  });
  if (!skippedState || skippedState.stored !== true || String(skippedState.status || "") !== "completed") {
    throw new Error("KRX workflow_skipped requestId를 durable terminal identity로 확정하지 못했습니다.");
  }
  try { clearKrxDispatchIntent(requestId); } catch (_) {}
  return {
    ok: true,
    action: "workflow_skipped",
    reason: decisionReason,
    message: String(decision && decision.message || "업데이트할 KRX 현재가 데이터가 없습니다."),
    date: date || ""
  };
}

// fresh KRX 요청의 remote preflight는 durable shard·최초 prices·active workflow 상태를 한 fetchAll로 읽는다.
// active 조회가 끝난 뒤 POST 직전 prices는 반드시 별도 재조회해 기존 TOCTOU 순서를 유지한다.

/* --- 10E. Remote Preflight / Dispatch State Machine ----------------------- */

function loadKrxInitialRemotePreflight(branch, date, requestId, requestHash, operationHash) {
  const id = String(requestId || "");
  const identityHash = krxDispatchIdentityHash(id);
  const ledgerPath = krxDispatchLedgerShardPathFromIdentityHash(identityHash);
  const marker = findKrxOperationMarker(operationHash);
  const requests = [
    { key: "durable", path: githubContentsApiPath(ledgerPath, branch), allow404: true },
    { key: "prices", path: githubContentsApiPath("data/prices.json", branch), allow404: false }
  ].concat(krxActiveWorkflowQueryPaths(branch).map(function(path, index) {
    return { key: "active:" + index, path: path, allow404: false };
  }));

  let markerRunId = "";
  if (marker && String(marker.requestId || "") !== id) {
    const markerAge = Date.now() - Number(marker.savedAtMs || 0);
    markerRunId = String(marker.workflowRunId || "").trim();
    if (!(markerAge >= 0 && markerAge <= KRX_OPERATION_VISIBILITY_GRACE_MS) && /^\d+$/.test(markerRunId)) {
      requests.push({ key: "markerRun", path: "/actions/runs/" + encodeURIComponent(markerRunId), allow404: true });
    }
  }

  const results = githubRequestManyGetSettled(requests);
  const durableResponse = results.find(function(item) { return item.key === "durable"; }) || null;
  const pricesResponse = results.find(function(item) { return item.key === "prices"; }) || null;
  const activeResponses = results.filter(function(item) { return String(item.key || "").indexOf("active:") === 0; });

  let durable = { loaded: true, value: null, current: null, error: null };
  if (!durableResponse || durableResponse.ok !== true) {
    durable.error = durableResponse && durableResponse.error ? durableResponse.error : new Error("KRX durable dispatch ledger를 확인하지 못했습니다.");
  } else {
    const current = durableResponse.status === 404
      ? { sha: "", data: [], missing: true }
      : decodeGithubJsonContentsResult(durableResponse.data, ledgerPath, branch, [], true);
    const items = normalizeKrxDispatchLedger(current.data);
    durable.current = { path: ledgerPath, sha: String(current.sha || ""), data: items, missing: current.missing === true };
    durable.value = findCompatibleKrxDispatchLedgerEntry(items, identityHash, id, requestHash);
  }

  const pricesError = !pricesResponse || pricesResponse.ok !== true
    ? (pricesResponse && pricesResponse.error ? pricesResponse.error : new Error("KRX prices.json을 확인하지 못했습니다."))
    : null;
  const pricesCurrent = pricesError
    ? null
    : decodeGithubJsonContentsResult(pricesResponse.data, "data/prices.json", branch, {}, false);

  const activeErrorResponse = activeResponses.find(function(item) { return item.ok !== true; }) || null;
  let activeRun = null;
  let activeParseError = null;
  if (!activeErrorResponse) {
    try {
      activeRun = findActiveKrxWorkflowRunFromResults(date, activeResponses.map(function(item) { return item.data || {}; }));
    } catch (err) {
      activeParseError = err;
    }
  }

  const markerRunResponse = results.find(function(item) { return item.key === "markerRun"; }) || null;
  const markerRunLoaded = !!markerRunResponse;
  const markerRunError = markerRunResponse && markerRunResponse.ok !== true ? markerRunResponse.error : null;
  const markerRun = markerRunResponse && markerRunResponse.ok === true && markerRunResponse.status !== 404
    ? markerRunResponse.data
    : null;

  return {
    durable: durable,
    prices: pricesCurrent ? (pricesCurrent.data || {}) : null,
    pricesError: pricesError,
    active: {
      loaded: true,
      run: activeRun,
      error: activeErrorResponse && activeErrorResponse.error || activeParseError || null,
      markerRunLoaded: markerRunLoaded,
      markerRunId: markerRunId,
      markerRun: markerRun,
      markerRunError: markerRunError
    }
  };
}

// durable KRX identity를 local receipt/intent/server proof와 reconciliation한다.
function resolveKrxDurableDispatchState(branch, workflowFile, date, requestId, requestHash, prefetchedDurable) {
  let durableDispatch = null;
  if (prefetchedDurable && prefetchedDurable.loaded === true) {
    if (prefetchedDurable.error) {
      return {
        ok: true, action: "workflow_status_uncertain", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
        message: "KRX durable dispatch ledger를 확인하지 못했습니다. 동일 requestId 중복 dispatch 방지를 위해 새 요청을 보내지 않았습니다."
      };
    }
    durableDispatch = prefetchedDurable.value || null;
  } else {
    try {
      durableDispatch = findKrxDispatchLedgerEntry(requestId);
    } catch (_) {
      return {
        ok: true, action: "workflow_status_uncertain", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
        message: "KRX durable dispatch ledger를 확인하지 못했습니다. 동일 requestId 중복 dispatch 방지를 위해 새 요청을 보내지 않았습니다."
      };
    }
  }
  let retryRejectedDispatch = false;
  if (durableDispatch) {
    if (String(durableDispatch.hash || "") && String(durableDispatch.hash || "") !== requestHash) {
      return { ok: false, error: "동일한 KRX requestId가 다른 갱신 조건에 이미 사용되었습니다. 다시 시도해주세요." };
    }
    let durableStatus = krxDispatchDurableStatus(durableDispatch);
    if (durableStatus === "terminal_uncertain") {
      // inflight/uncertain durable state는 재-dispatch를 막는 barrier이지, 더 강한 후속 증거보다 우선하는 최종 결과가 아니다.
      // completed receipt/accepted intent/exact server proof를 먼저 reconciliation하고, 명시적 4xx rejected proof가 있으면
      // durable state를 rejected_retryable로 되돌린 뒤 안전한 재시도를 허용한다.
      const localReceipt = findKrxDispatchReceipt(requestId);
      if (localReceipt) {
        const localReceiptHash = String(localReceipt.hash || "");
        if (localReceiptHash && localReceiptHash !== requestHash) {
          return { ok: false, error: "동일한 KRX requestId가 다른 갱신 조건에 이미 사용되었습니다. 다시 시도해주세요." };
        }
        if (!localReceiptHash && (String(localReceipt.branch || "") !== branch || String(localReceipt.date || "") !== date)) {
          return { ok: false, error: "동일한 KRX requestId가 다른 갱신 조건에 이미 사용되었습니다. 다시 시도해주세요." };
        }
        const localReceiptUncertain = localReceipt.terminalUncertain === true || String(localReceipt.reason || "") === "dispatch_uncertain_terminal";
        if (!localReceiptUncertain) {
          const promotedReceipt = promoteKrxDispatchLedgerEntryCompleted(requestId, requestHash, {
            branch: branch, date: date, reason: localReceipt.reason || "dispatch_receipt_recovered",
            workflowRunId: localReceipt.workflowRunId || "", runUrl: localReceipt.runUrl || "", htmlUrl: localReceipt.htmlUrl || ""
          });
          if (!promotedReceipt || promotedReceipt.stored !== true || String(promotedReceipt.status || "") !== "completed") {
            throw new Error("KRX completed receipt를 durable completed identity로 복구하지 못했습니다.");
          }
          try { clearKrxDispatchIntent(requestId); } catch (_) {}
          return {
            ok: true, action: "workflow_duplicate_ignored", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
            reason: localReceipt.reason || "dispatch_receipt_recovered", workflowRunId: String(localReceipt.workflowRunId || ""),
            message: "완료 receipt가 durable inflight 상태보다 강한 성공 증거라 completed로 복구했습니다. 중복 실행은 만들지 않았습니다."
          };
        }
      }

      const localIntent = findKrxDispatchIntent(requestId);
      if (localIntent && String(localIntent.hash || "") !== requestHash) {
        return { ok: false, error: "동일한 KRX requestId가 다른 갱신 조건으로 처리 중이거나 재시도되었습니다. 다시 시도해주세요." };
      }
      if (localIntent && (localIntent.dispatchAccepted === true || !!String(localIntent.workflowRunId || ""))) {
        const promotedIntent = promoteKrxDispatchLedgerEntryCompleted(requestId, requestHash, {
          branch: branch, date: date, reason: localIntent.reason || "dispatch_accepted_recovered",
          workflowRunId: localIntent.workflowRunId || "", runUrl: localIntent.runUrl || "", htmlUrl: localIntent.htmlUrl || ""
        });
        if (!promotedIntent || promotedIntent.stored !== true || String(promotedIntent.status || "") !== "completed") {
          throw new Error("KRX accepted intent를 durable completed identity로 복구하지 못했습니다.");
        }
        try { rememberKrxDispatchReceipt(requestId, requestHash, {
          branch: branch, date: date, reason: localIntent.reason || "dispatch_accepted_recovered",
          workflowRunId: localIntent.workflowRunId || "", runUrl: localIntent.runUrl || "", htmlUrl: localIntent.htmlUrl || "", terminalUncertain: false
        }); } catch (_) {}
        try { clearKrxDispatchIntent(requestId); } catch (_) {}
        return {
          ok: true, action: "workflow_duplicate_ignored", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
          reason: localIntent.reason || "dispatch_accepted_recovered", workflowRunId: String(localIntent.workflowRunId || ""),
          message: "accepted intent가 durable inflight 상태보다 강한 성공 증거라 completed로 복구했습니다. 중복 실행은 만들지 않았습니다."
        };
      }

      const proof = recoverKrxDispatchCompletedFromProof(requestId, requestHash, branch, date);
      if (proof) {
        return {
          ok: true, action: "workflow_duplicate_ignored", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
          reason: proof.reason, workflowRunId: proof.workflowRunId || "",
          message: "GitHub Actions의 정확한 requestId 실행 증거를 확인해 과거 uncertain 상태를 completed로 복구했습니다. 중복 실행은 만들지 않았습니다."
        };
      }

      const receiptStillUncertain = localReceipt && (localReceipt.terminalUncertain === true || String(localReceipt.reason || "") === "dispatch_uncertain_terminal");
      if (!receiptStillUncertain && localIntent && localIntent.dispatchRejected === true) {
        const rejectedState = setKrxDispatchLedgerEntryState(requestId, requestHash, {
          branch: branch, date: date, reason: "dispatch_rejected"
        });
        if (rejectedState && rejectedState.stored === true && String(rejectedState.status || "") === "rejected_retryable") {
          retryRejectedDispatch = true;
          durableStatus = "rejected_retryable";
          durableDispatch = rejectedState.match || durableDispatch;
        }
      }
      if (!retryRejectedDispatch) {
        return {
          ok: true, action: "workflow_dispatch_uncertain", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
          reason: durableDispatch.reason || "dispatch_uncertain_terminal", workflowRunId: durableDispatch.workflowRunId || "",
          message: "GitHub durable dispatch ledger에서 과거 dispatch의 접수 여부를 확정할 수 없는 terminal 상태를 확인했습니다. 새 dispatch는 만들지 않았습니다."
        };
      }
    }
    if (durableStatus === "rejected_retryable") {
      retryRejectedDispatch = true;
    } else {
      return { ok: true, action: "workflow_duplicate_ignored", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
        reason: durableDispatch.reason || "durable_duplicate_request", workflowRunId: durableDispatch.workflowRunId || "",
        message: "GitHub durable dispatch ledger에서 이미 처리된 동일 KRX requestId를 확인했습니다. 중복 실행은 만들지 않았습니다." };
    }
  }

  return { _continueKrxDispatch: true, retryRejectedDispatch: retryRejectedDispatch };
}

// local KRX receipt를 durable identity로 복구하거나 terminal 결과로 수렴시킨다.
function resolveKrxDispatchReceiptState(branch, workflowFile, date, requestId, requestHash, retryRejectedDispatch) {
  const receipt = findKrxDispatchReceipt(requestId);
  if (receipt) {
    const receiptHash = String(receipt.hash || "");
    if (receiptHash && receiptHash !== requestHash) {
      return { ok: false, error: "동일한 KRX requestId가 다른 갱신 조건에 이미 사용되었습니다. 다시 시도해주세요." };
    }
    if (!receiptHash && (String(receipt.branch || "") !== branch || String(receipt.date || "") !== date)) {
      return { ok: false, error: "동일한 KRX requestId가 다른 갱신 조건에 이미 사용되었습니다. 다시 시도해주세요." };
    }
    const receiptUncertain = receipt.terminalUncertain === true || String(receipt.reason || "") === "dispatch_uncertain_terminal";
    if (receiptUncertain) {
      const proof = recoverKrxDispatchCompletedFromProof(requestId, requestHash, branch, date);
      if (proof) {
        return {
          ok: true, action: "workflow_duplicate_ignored", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
          workflowRunId: String(proof.workflowRunId || ""), reason: proof.reason,
          message: "GitHub Actions의 정확한 requestId 실행 증거를 확인해 과거 uncertain receipt를 completed로 복구했습니다. 중복 실행은 만들지 않았습니다."
        };
      }
      // 과거 receipt 자체는 유한 보존이므로 terminal uncertain identity를 GitHub durable ledger로 먼저 승격한다.
      // rejected residue가 함께 있더라도 uncertain receipt가 존재하면 보수적으로 uncertain이 우선한다.
      let uncertainState = null;
      if (retryRejectedDispatch) {
        uncertainState = setKrxDispatchLedgerEntryState(requestId, requestHash, {
          branch: branch, date: date, reason: receipt.reason || "dispatch_uncertain_terminal",
          workflowRunId: receipt.workflowRunId || "", runUrl: receipt.runUrl || "", htmlUrl: receipt.htmlUrl || ""
        });
      } else {
        uncertainState = rememberKrxDispatchLedgerEntryState(requestId, requestHash, {
          branch: branch, date: date, reason: receipt.reason || "dispatch_uncertain_terminal",
          workflowRunId: receipt.workflowRunId || "", runUrl: receipt.runUrl || "", htmlUrl: receipt.htmlUrl || ""
        });
      }
      if (!uncertainState || uncertainState.stored !== true || String(uncertainState.status || "") !== "terminal_uncertain") {
        throw new Error("KRX uncertain receipt를 durable terminal identity로 안전하게 backfill하지 못했습니다.");
      }
      return {
        ok: true, action: "workflow_dispatch_uncertain", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
        workflowRunId: String(receipt.workflowRunId || ""), reason: receipt.reason || "dispatch_uncertain_terminal",
        message: "과거 dispatch의 접수 여부를 확정할 수 없어 해당 requestId를 durable terminal fail-closed 상태로 유지합니다. 새 requestId로 상태를 다시 확인해주세요."
      };
    }
    const completedReceiptState = promoteKrxDispatchLedgerEntryCompleted(requestId, requestHash, {
      branch: branch, date: date, reason: receipt.reason || "duplicate_request",
      workflowRunId: receipt.workflowRunId || "", runUrl: receipt.runUrl || "", htmlUrl: receipt.htmlUrl || ""
    });
    if (!completedReceiptState || completedReceiptState.stored !== true || String(completedReceiptState.status || "") !== "completed") {
      throw new Error("KRX completed receipt를 durable completed identity로 안전하게 backfill하지 못했습니다.");
    }
    return {
      ok: true,
      action: "workflow_duplicate_ignored",
      duplicate: true,
      workflow: workflowFile,
      branch: branch,
      date: date || "",
      reason: receipt.reason || "duplicate_request",
      message: "이미 동일한 KRX 현재가 반영 요청이 접수되었고 durable identity로 확인했습니다. 중복 실행은 만들지 않았습니다."
    };
  }

  return { _continueKrxDispatch: true, retryRejectedDispatch: retryRejectedDispatch };
}

// active KRX intent를 accepted/rejected/uncertain 의미에 따라 복구한다.
function resolveKrxDispatchIntentState(branch, workflowFile, date, requestId, requestHash, retryRejectedDispatch) {
  const intent = findKrxDispatchIntent(requestId);
  if (intent) {
    if (String(intent.hash || "") !== requestHash) {
      return { ok: false, error: "동일한 KRX requestId가 다른 갱신 조건으로 처리 중이거나 재시도되었습니다. 다시 시도해주세요." };
    }
    let dispatchAccepted = intent.dispatchAccepted === true || !!String(intent.workflowRunId || "");
    const rejectedEvidence = intent.dispatchRejected === true || retryRejectedDispatch;
    if (!dispatchAccepted && rejectedEvidence) {
      // 명시적 4xx 미접수 증거가 남아 있으면 같은 requestId 재시도는 안전하다.
      // 실제 POST 직전 durable 상태를 uncertain/inflight로 바꾼 뒤에만 재-dispatch한다.
      retryRejectedDispatch = true;
    } else {
      let recoveredProof = null;
      if (!dispatchAccepted) {
        recoveredProof = recoverKrxDispatchCompletedFromProof(requestId, requestHash, branch, date);
        dispatchAccepted = !!recoveredProof;
      }
      let terminalized = false;
      try {
        if (dispatchAccepted) {
          const promoted = promoteKrxDispatchLedgerEntryCompleted(requestId, requestHash, {
            branch: branch, date: date, reason: String(recoveredProof && recoveredProof.reason || intent.reason || "dispatch_accepted_recovered"),
            workflowRunId: String(recoveredProof && recoveredProof.workflowRunId || intent.workflowRunId || ""),
            runUrl: String(recoveredProof && recoveredProof.runUrl || intent.runUrl || ""),
            htmlUrl: String(recoveredProof && recoveredProof.htmlUrl || intent.htmlUrl || "")
          });
          terminalized = !!(promoted && promoted.stored === true && promoted.status === "completed");
        } else {
          terminalized = rememberKrxDispatchLedgerEntry(requestId, requestHash, {
            branch: branch, date: date, reason: "dispatch_uncertain_terminal",
            workflowRunId: String(intent.workflowRunId || ""), runUrl: String(intent.runUrl || ""), htmlUrl: String(intent.htmlUrl || "")
          });
        }
      } catch (_) {}
      if (terminalized) {
        try { rememberKrxDispatchReceipt(requestId, requestHash, {
          branch: branch, date: date, reason: dispatchAccepted ? String(recoveredProof && recoveredProof.reason || intent.reason || "dispatch_accepted_recovered") : "dispatch_uncertain_terminal",
          workflowRunId: String(recoveredProof && recoveredProof.workflowRunId || intent.workflowRunId || ""),
          runUrl: String(recoveredProof && recoveredProof.runUrl || intent.runUrl || ""),
          htmlUrl: String(recoveredProof && recoveredProof.htmlUrl || intent.htmlUrl || ""), terminalUncertain: !dispatchAccepted
        }); } catch (_) {}
        try { clearKrxDispatchIntent(requestId); } catch (_) {}
      }
      if (dispatchAccepted) {
        return {
          ok: true, action: "workflow_duplicate_ignored", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
          workflowRunId: String(recoveredProof && recoveredProof.workflowRunId || intent.workflowRunId || ""),
          reason: String(recoveredProof && recoveredProof.reason || intent.reason || "dispatch_accepted_recovered"),
          message: terminalized
            ? "과거 GitHub dispatch 성공 증거를 intent에서 복구해 durable 완료 상태로 전환했습니다. 중복 dispatch는 만들지 않았습니다."
            : "과거 GitHub dispatch 성공 증거가 intent에 남아 있어 중복 dispatch를 만들지 않았습니다."
        };
      }
      return {
        ok: true, action: "workflow_dispatch_uncertain", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
        reason: terminalized ? "dispatch_uncertain_terminal" : (intent.reason || "dispatch_receipt_missing"),
        message: terminalized
          ? "과거 dispatch의 접수 여부를 확정할 수 없어 requestId를 durable terminal 상태로 전환했습니다. 중복 dispatch는 만들지 않았습니다."
          : "이 요청은 GitHub 접수 여부가 불확실한 이력이 있어 중복 dispatch를 만들지 않았습니다. Actions 실행 상태를 확인해주세요."
      };
    }
  }

  return { _continueKrxDispatch: true, retryRejectedDispatch: retryRejectedDispatch };
}

// 동일 branch/date의 marker와 active workflow를 확인한다. 상태 조회가 불확실하면 fail-closed 결과를 반환한다.
function resolveKrxActiveWorkflowState(branch, workflowFile, date, requestId, operationHash, prefetchedActive) {
  const marker = findKrxOperationMarker(operationHash);
  if (marker && String(marker.requestId || "") !== requestId) {
    const markerAge = Date.now() - Number(marker.savedAtMs || 0);
    if (markerAge >= 0 && markerAge <= KRX_OPERATION_VISIBILITY_GRACE_MS) return krxWorkflowInProgressResult(branch, date, null);
    try {
      let directRun = null;
      let markerRunId = String(marker.workflowRunId || "");
      // 정상 dispatch 성공 뒤 marker run proof 갱신이 유실된 구형/부분 상태도 durable request ledger에서
      // 같은 operation의 run ID를 복구한다. 새 requestId는 과거 request ledger를 직접 보지 않으므로
      // marker.requestId를 연결 고리로 사용해 상태별 목록 조회의 queued→in_progress 전환 레이스를 피한다.
      if (!markerRunId && String(marker.requestId || "")) {
        const markerDurable = findKrxDispatchLedgerEntry(String(marker.requestId || ""));
        const durableBranchMatches = markerDurable && String(markerDurable.branch || "") === String(branch || "");
        const durableDateMatches = markerDurable && String(markerDurable.date || "") === String(date || "");
        const durableRunId = String(markerDurable && markerDurable.workflowRunId || "");
        if (durableBranchMatches && durableDateMatches && /^\d+$/.test(durableRunId)) {
          markerRunId = durableRunId;
          try {
            rememberKrxOperationMarker(operationHash, String(marker.requestId || ""), branch, date, {
              workflowRunId: markerRunId,
              runUrl: String(markerDurable.runUrl || ""),
              htmlUrl: String(markerDurable.htmlUrl || "")
            });
          } catch (_) {}
        }
      }
      if (markerRunId) {
        if (prefetchedActive && prefetchedActive.loaded === true && prefetchedActive.markerRunLoaded === true && String(prefetchedActive.markerRunId || "") === markerRunId) {
          if (prefetchedActive.markerRunError) throw prefetchedActive.markerRunError;
          directRun = prefetchedActive.markerRun || null;
        } else {
          directRun = getKrxWorkflowRunById(markerRunId);
        }
        if (directRun && isActiveKrxWorkflowRun(directRun)) return krxWorkflowInProgressResult(branch, date, directRun);
        if (directRun && !isActiveKrxWorkflowRun(directRun)) {
          try { clearKrxOperationMarker(operationHash); } catch (_) {}
        }
      }
      // dispatch 응답 유실/5xx에서는 workflowRunId를 받지 못해 marker와 durable ledger 모두 run ID가
      // 비어 있을 수 있다. 이 경우 status별 병렬 목록은 queued→in_progress 전환 순간을 서로 엇갈려
      // 놓칠 수 있으므로 marker가 보존한 과거 requestId로 먼저 정확한 workflow run을 찾는다.
      if (!directRun && !markerRunId && String(marker.requestId || "")) {
        directRun = findKrxWorkflowRunByRequestId(branch, date, String(marker.requestId || ""));
        if (directRun) {
          const recoveredRunId = String(directRun.id || "");
          try {
            rememberKrxOperationMarker(operationHash, String(marker.requestId || ""), branch, date, {
              workflowRunId: recoveredRunId,
              runUrl: String(directRun.url || ""),
              htmlUrl: String(directRun.html_url || "")
            });
          } catch (_) {}
          if (isActiveKrxWorkflowRun(directRun)) return krxWorkflowInProgressResult(branch, date, directRun);
          if (!isActiveKrxWorkflowRun(directRun)) {
            try { clearKrxOperationMarker(operationHash); } catch (_) {}
          }
        }
      }
      if (!directRun) {
        if (prefetchedActive && prefetchedActive.loaded === true && prefetchedActive.error) throw prefetchedActive.error;
        const activeRunFromMarker = prefetchedActive && prefetchedActive.loaded === true
          ? (prefetchedActive.run || null)
          : findActiveKrxWorkflowRun(branch, date);
        if (activeRunFromMarker) return krxWorkflowInProgressResult(branch, date, activeRunFromMarker);
        try { clearKrxOperationMarker(operationHash); } catch (_) {}
      }
    } catch (_) {
      return {
        ok: true, action: "workflow_status_uncertain", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
        workflowRunId: String(marker.workflowRunId || ""),
        message: "기존 KRX 작업 marker가 있으나 GitHub run 상태를 확인하지 못했습니다. 중복 dispatch 방지를 위해 새 요청을 보내지 않았습니다."
      };
    }
  }

  try {
    if (prefetchedActive && prefetchedActive.loaded === true && prefetchedActive.error) throw prefetchedActive.error;
    const activeRun = prefetchedActive && prefetchedActive.loaded === true
      ? (prefetchedActive.run || null)
      : findActiveKrxWorkflowRun(branch, date);
    if (activeRun) return krxWorkflowInProgressResult(branch, date, activeRun);
  } catch (_) {
    return {
      ok: true, action: "workflow_status_uncertain", duplicate: true, workflow: workflowFile, branch: branch, date: date || "",
      message: "GitHub Actions 실행 상태를 확인하지 못했습니다. 중복 dispatch 방지를 위해 새 요청을 보내지 않았습니다."
    };
  }

  return null;
}

// 실제 dispatch 직전에 intent/marker와 rejected-retry durable barrier를 준비한다.

/* --- 10F. Dispatch Attempt / Persist Success ------------------------------ */

function prepareKrxDispatchAttempt(branch, date, requestId, requestHash, decision, operationHash, retryRejectedDispatch, timing) {
  let detailStartedAtMs = 0;
  if (!retryRejectedDispatch) {
    const intentEntry = krxDispatchIntentPropertyEntry(requestId, requestHash, {
      branch: branch, date: date, reason: decision.reason
    });
    const markerEntry = krxOperationMarkerPropertyEntry(operationHash, requestId, branch, date);
    detailStartedAtMs = Date.now();
    const batch = tryWriteDirectRequestPropertiesBatchFast([intentEntry, markerEntry]);
    if (batch.used) {
      recordKrxTimingDetail(timing, "prepareDispatch", "localPreDispatchBatchWrite", detailStartedAtMs);
      const intentStored = batch.storedByKey && batch.storedByKey[intentEntry.key] === true;
      const markerStored = batch.storedByKey && batch.storedByKey[markerEntry.key] === true;
      if (!intentStored || !markerStored) {
        try { rollbackDirectRequestPropertiesBatch(batch); } catch (_) {}
        throw batch.error || new Error("KRX dispatch 전 local intent/marker를 함께 저장하지 못해 dispatch를 보내지 않았습니다.");
      }
    } else {
      // prefix/global budget 압박처럼 GC가 필요한 드문 경계에서는 기존 보수적 개별 write 경로를 사용한다.
      detailStartedAtMs = Date.now();
      rememberKrxDispatchIntent(requestId, requestHash, {
        branch: branch, date: date, reason: decision.reason
      });
      recordKrxTimingDetail(timing, "prepareDispatch", "intentWriteFallback", detailStartedAtMs);
      try {
        detailStartedAtMs = Date.now();
        rememberKrxOperationMarker(operationHash, requestId, branch, date);
        recordKrxTimingDetail(timing, "prepareDispatch", "operationMarkerWriteFallback", detailStartedAtMs);
      } catch (err) {
        recordKrxTimingDetail(timing, "prepareDispatch", "operationMarkerWriteFallback", detailStartedAtMs);
        try { clearKrxDispatchIntent(requestId); } catch (_) {}
        throw err;
      }
    }
  } else {
    // rejected retry는 기존 순서를 유지한다. durable inflight barrier가 marker와 retry intent 사이의 causal 경계다.
    try {
      detailStartedAtMs = Date.now();
      rememberKrxOperationMarker(operationHash, requestId, branch, date);
      recordKrxTimingDetail(timing, "prepareDispatch", "operationMarkerWrite", detailStartedAtMs);
    } catch (err) {
      recordKrxTimingDetail(timing, "prepareDispatch", "operationMarkerWrite", detailStartedAtMs);
      throw err;
    }
  }

  const payload = {
    ref: branch,
    inputs: {
      request_id: requestId
    },
    return_run_details: true
  };
  if (date) payload.inputs.date = date;

  if (retryRejectedDispatch) {
    detailStartedAtMs = Date.now();
    const inflightState = setKrxDispatchLedgerEntryState(requestId, requestHash, {
      branch: branch, date: date, reason: "dispatch_retry_inflight"
    });
    recordKrxTimingDetail(timing, "prepareDispatch", "retryDurableInflight", detailStartedAtMs);
    if (!inflightState || inflightState.stored !== true || inflightState.status !== "terminal_uncertain") {
      throw new Error("KRX 4xx 재시도 전 durable inflight 상태를 확보하지 못해 dispatch를 보내지 않았습니다.");
    }
    try {
      detailStartedAtMs = Date.now();
      rememberKrxDispatchIntent(requestId, requestHash, {
        branch: branch, date: date, reason: decision.reason
      });
      recordKrxTimingDetail(timing, "prepareDispatch", "retryIntentWrite", detailStartedAtMs);
    } catch (err) {
      recordKrxTimingDetail(timing, "prepareDispatch", "retryIntentWrite", detailStartedAtMs);
      // 아직 POST 전이므로 local active 전환 실패 시 durable rejection으로 되돌려 안전한 재시도를 유지한다.
      try {
        setKrxDispatchLedgerEntryState(requestId, requestHash, { branch: branch, date: date, reason: "dispatch_rejected" });
      } catch (_) {}
      try { clearKrxOperationMarker(operationHash); } catch (_) {}
      throw err;
    }
  }

  return payload;
}

// GitHub workflow_dispatch POST를 실행하고 명시적 4xx rejection evidence를 보존한다.
function sendKrxWorkflowDispatch(workflowFile, branch, date, requestId, requestHash, operationHash, payload) {
  let dispatchResult = null;
  try {
    dispatchResult = githubRequest(
      "post",
      "/actions/workflows/" + encodeURIComponent(workflowFile) + "/dispatches",
      payload
    );
  } catch (err) {
    const status = Number(err && err.githubHttpStatus || 0);
    // 명시적인 4xx는 GitHub가 dispatch를 수락하지 않은 확정 실패다. 삭제 성공에 의존하지 않고
    // rejected_retryable evidence를 durable/local에 먼저 남겨 같은 requestId의 안전한 재시도를 허용한다.
    if (status >= 400 && status < 500) {
      let durableRejected = false;
      let localRejected = false;
      try {
        const rejectedState = setKrxDispatchLedgerEntryState(requestId, requestHash, {
          branch: branch, date: date, reason: "dispatch_rejected"
        });
        durableRejected = !!(rejectedState && rejectedState.stored === true && rejectedState.status === "rejected_retryable");
      } catch (_) {}
      try {
        rememberKrxDispatchIntent(requestId, requestHash, {
          branch: branch, date: date, reason: "dispatch_rejected", dispatchRejected: true, rejectedStatus: status
        });
        const savedRejected = findKrxDispatchIntent(requestId);
        localRejected = !!(savedRejected && String(savedRejected.hash || "") === requestHash && savedRejected.dispatchRejected === true);
      } catch (_) {}
      try { clearKrxOperationMarker(operationHash); } catch (_) {}
      if (!durableRejected && !localRejected) {
        // evidence 저장소가 모두 실패한 경우에는 pre-dispatch intent 제거가 실제 확인된 경우에만 fresh retry가 안전하다.
        try { clearKrxDispatchIntent(requestId); } catch (_) {}
      }
    }
    throw err;
  }

  return dispatchResult;
}

// GitHub가 dispatch를 수락한 뒤 local/durable 성공 증거를 가능한 한 모두 보존한다.
function persistKrxDispatchSuccess(workflowFile, branch, date, requestId, requestHash, operationHash, decision, dispatchResult, durableSeedCurrent, timing) {
  const workflowRunId = String(dispatchResult && dispatchResult.workflow_run_id || "");
  const runUrl = String(dispatchResult && dispatchResult.run_url || "");
  const htmlUrl = String(dispatchResult && dispatchResult.html_url || "");
  const successInfo = {
    branch: branch, date: date, reason: decision.reason,
    workflowRunId: workflowRunId, runUrl: runUrl, htmlUrl: htmlUrl
  };
  let detailStartedAtMs = 0;

  // POST 전에 저장된 active intent + operation marker가 visibility/response-loss barrier다.
  // dispatch 수락 뒤에는 GitHub durable completed를 먼저 확정한다. 이 exact durable identity가 확보되면
  // 동일 requestId의 장기 idempotency는 이미 보장되므로 accepted intent/receipt를 다시 쓰지 않는다.
  // pre-dispatch marker는 다른 requestId가 run visibility 전에 재-dispatch되는 것을 막기 위해 그대로 유지한다.
  let durableLedgerStored = false;
  try {
    detailStartedAtMs = Date.now();
    const completedState = promoteKrxDispatchLedgerEntryCompleted(requestId, requestHash, successInfo, durableSeedCurrent);
    recordKrxTimingDetail(timing, "persistSuccess", "durableCompletedWrite", detailStartedAtMs);
    durableLedgerStored = !!(completedState && completedState.stored === true && completedState.status === "completed");
  } catch (_) {
    recordKrxTimingDetail(timing, "persistSuccess", "durableCompletedWrite", detailStartedAtMs);
    // durable 실패 시에도 pre-dispatch intent가 동일 requestId 재전송을 막고 exact run proof reconciliation을 강제한다.
  }

  if (durableLedgerStored) {
    // durable completed가 가장 강한 exact request identity 증거다. 다만 새 requestId는 이 ledger를 직접
    // 조회하지 않으므로 operation marker에도 확보한 workflow run proof를 보존해야 한다.
    // 그래야 60초 visibility grace 이후 queued→in_progress 전환 중 상태별 목록 조회가 서로 엇갈려도
    // marker의 run ID를 직접 조회해 동일 branch/date operation의 중복 dispatch를 차단할 수 있다.
    detailStartedAtMs = Date.now();
    try {
      rememberKrxOperationMarker(operationHash, requestId, branch, date, successInfo);
    } catch (_) {
      // marker 갱신 실패가 이미 수락된 dispatch를 실패로 뒤집지는 않는다.
      // 기존 pre-dispatch marker는 그대로 남아 최소 visibility barrier를 유지한다.
    }
    recordKrxTimingDetail(timing, "persistSuccess", "operationMarkerRunProofWrite", detailStartedAtMs);
    // 정상 성공 경로에서는 동일 성공을 설명하는 accepted intent/receipt 재저장을 생략한다.
    detailStartedAtMs = Date.now();
    try { clearKrxDispatchIntent(requestId); } catch (_) {}
    recordKrxTimingDetail(timing, "persistSuccess", "durableSuccessIntentCleanup", detailStartedAtMs);
  } else {
    // durable completed를 확보하지 못한 경우에만 local accepted evidence를 보강한다.
    // setProperties partial-write 상황에서도 기존 pre-dispatch intent 또는 갱신된 accepted intent/marker/receipt가
    // fail-closed reconciliation barrier로 남도록 기존 보수적 fallback을 유지한다.
    const acceptedIntentEntry = krxDispatchIntentPropertyEntry(requestId, requestHash, Object.assign({}, successInfo, { dispatchAccepted: true }));
    const markerEntry = krxOperationMarkerPropertyEntry(operationHash, requestId, branch, date, successInfo);
    const receiptEntry = krxDispatchReceiptPropertyEntry(requestId, requestHash, successInfo);
    detailStartedAtMs = Date.now();
    const localBatch = tryWriteDirectRequestPropertiesBatchFast([acceptedIntentEntry, markerEntry, receiptEntry]);
    const localStoredByKey = localBatch && localBatch.storedByKey || {};
    if (localBatch.used) {
      recordKrxTimingDetail(timing, "persistSuccess", "localSuccessEvidenceBatchWriteFallback", detailStartedAtMs);
    }

    // setProperties는 예외를 던진 뒤 일부 key만 실제 반영될 수 있다. batch helper의 used 여부가 아니라
    // key별 exact read-back 결과를 기준으로 누락 evidence만 개별 보강한다. 이미 저장된 key는 같은 값을
    // 다시 쓰지 않아 불필요한 Properties I/O를 피하고, 모두 실패해도 pre-dispatch intent/marker는 그대로
    // 남겨 다음 요청이 exact reconciliation을 거치도록 fail-closed한다.
    if (!localBatch.used || localStoredByKey[acceptedIntentEntry.key] !== true) {
      try {
        detailStartedAtMs = Date.now();
        rememberKrxDispatchIntent(requestId, requestHash, Object.assign({}, successInfo, { dispatchAccepted: true }));
        recordKrxTimingDetail(timing, "persistSuccess", "acceptedIntentWriteFallback", detailStartedAtMs);
      } catch (_) {
        recordKrxTimingDetail(timing, "persistSuccess", "acceptedIntentWriteFallback", detailStartedAtMs);
      }
    }
    if (!localBatch.used || localStoredByKey[markerEntry.key] !== true) {
      try {
        detailStartedAtMs = Date.now();
        rememberKrxOperationMarker(operationHash, requestId, branch, date, successInfo);
        recordKrxTimingDetail(timing, "persistSuccess", "operationMarkerWriteFallback", detailStartedAtMs);
      } catch (_) {
        recordKrxTimingDetail(timing, "persistSuccess", "operationMarkerWriteFallback", detailStartedAtMs);
      }
    }
    if (!localBatch.used || localStoredByKey[receiptEntry.key] !== true) {
      try {
        detailStartedAtMs = Date.now();
        rememberKrxDispatchReceipt(requestId, requestHash, successInfo);
        recordKrxTimingDetail(timing, "persistSuccess", "receiptWriteFallback", detailStartedAtMs);
      } catch (_) {
        recordKrxTimingDetail(timing, "persistSuccess", "receiptWriteFallback", detailStartedAtMs);
      }
    }
  }

  return {
    ok: true,
    action: "workflow_dispatched",
    workflow: workflowFile,
    branch: branch,
    date: date || "",
    reason: decision.reason,
    requestId: requestId,
    workflowRunId: workflowRunId,
    runUrl: runUrl,
    htmlUrl: htmlUrl
  };
}

// KRX 응답 지연을 운영 환경에서 자동 계측한다. business state에는 관여하지 않고 duration만 응답에 첨부한다.

/* --- 10G. KRX Latency Instrumentation / Entry ----------------------------- */

function createKrxTimingTrace(date) {
  const startedAtMs = Date.now();
  return {
    startedAtMs: startedAtMs,
    mode: String(date || "") ? "selected" : "auto",
    stages: {},
    details: {}
  };
}

function recordKrxTimingStage(trace, name, startedAtMs) {
  if (!trace || !name) return 0;
  const elapsed = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
  trace.stages[name] = Math.max(0, Number(trace.stages[name] || 0)) + elapsed;
  return elapsed;
}


function recordKrxTimingDetail(trace, group, name, startedAtMs) {
  if (!trace || !group || !name) return 0;
  const elapsed = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
  if (!trace.details[group]) trace.details[group] = {};
  trace.details[group][name] = Math.max(0, Number(trace.details[group][name] || 0)) + elapsed;
  return elapsed;
}

function buildKrxTimingSnapshot(trace, outcome) {
  if (!trace) return null;
  const totalMs = Math.max(0, Date.now() - Number(trace.startedAtMs || Date.now()));
  const stages = {};
  let measuredMs = 0;
  Object.keys(trace.stages || {}).forEach(function(key) {
    const value = Math.max(0, Number(trace.stages[key] || 0));
    stages[key] = value;
    measuredMs += value;
  });
  const details = {};
  Object.keys(trace.details || {}).forEach(function(group) {
    const values = {};
    Object.keys(trace.details[group] || {}).forEach(function(key) {
      values[key] = Math.max(0, Number(trace.details[group][key] || 0));
    });
    details[group] = values;
  });
  return {
    version: 4,
    mode: String(trace.mode || "auto"),
    outcome: String(outcome || ""),
    totalMs: totalMs,
    measuredMs: measuredMs,
    unattributedMs: Math.max(0, totalMs - measuredMs),
    stages: stages,
    details: details
  };
}

function attachKrxTiming(trace, result, outcome) {
  const value = result && typeof result === "object" ? result : { ok: false, error: String(result || "KRX 처리 결과가 없습니다.") };
  value.timing = buildKrxTimingSnapshot(trace, outcome || value.action || (value.ok ? "ok" : "error"));
  return value;
}

// update-prices.yml workflow_dispatch를 실행하거나 불필요한 실행/동일 요청 재시도를 건너뛴다.
function dispatchKrxPriceWorkflow(body) {
  const branch = getProp("GITHUB_BRANCH");
  const workflowFile = KRX_WORKFLOW_FILE;
  const date = String(body.date || "").trim();
  const requestId = String(body.requestId || "").trim();
  const timing = createKrxTimingTrace(date);

  if (date && !isValidDateText(date)) {
    return attachKrxTiming(timing, { ok: false, error: "date must be YYYY-MM-DD" }, "validation_error");
  }
  if (!requestId) {
    return attachKrxTiming(timing, { ok: false, error: "KRX requestId가 필요합니다. 다시 시도해주세요." }, "validation_error");
  }
  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(requestId)) {
    return attachKrxTiming(timing, { ok: false, error: "KRX requestId 형식이 올바르지 않습니다." }, "validation_error");
  }

  const requestHash = krxDispatchHash(branch, date);
  const lock = LockService.getScriptLock();
  let stageStartedAtMs = Date.now();
  const locked = lock.tryLock(10000);
  recordKrxTimingStage(timing, "lockWait", stageStartedAtMs);
  if (!locked) {
    return attachKrxTiming(timing, { ok: false, error: "다른 KRX 현재가 반영 요청이 처리 중입니다. 잠시 후 다시 시도해주세요." }, "lock_busy");
  }

  try {
    stageStartedAtMs = Date.now();
    prepareDirectRequestMaintenanceBoundary("KRX_DISPATCH_I_", requestDirectPropertyKey("KRX_DISPATCH_I_", requestId));
    recordKrxTimingStage(timing, "maintenanceBoundary", stageStartedAtMs);

    const operationHash = krxOperationHash(branch, date);
    // durable identity·최초 prices·active workflow 상태는 서로 독립적이므로 한 preflight에서 동시에 읽는다.
    // 단 POST 직전 prices 재검증은 이 batch에 합치지 않고 active 확인 이후 별도 조회한다.
    stageStartedAtMs = Date.now();
    const initialPreflight = loadKrxInitialRemotePreflight(branch, date, requestId, requestHash, operationHash);
    recordKrxTimingStage(timing, "initialPreflight", stageStartedAtMs);

    stageStartedAtMs = Date.now();
    const durableState = resolveKrxDurableDispatchState(branch, workflowFile, date, requestId, requestHash, initialPreflight.durable);
    recordKrxTimingStage(timing, "durableResolve", stageStartedAtMs);
    if (!durableState || durableState._continueKrxDispatch !== true) {
      return attachKrxTiming(timing, durableState, durableState && durableState.action || "durable_return");
    }
    let retryRejectedDispatch = durableState.retryRejectedDispatch === true;

    stageStartedAtMs = Date.now();
    const receiptState = resolveKrxDispatchReceiptState(branch, workflowFile, date, requestId, requestHash, retryRejectedDispatch);
    recordKrxTimingStage(timing, "receiptResolve", stageStartedAtMs);
    if (!receiptState || receiptState._continueKrxDispatch !== true) {
      return attachKrxTiming(timing, receiptState, receiptState && receiptState.action || "receipt_return");
    }
    retryRejectedDispatch = receiptState.retryRejectedDispatch === true;

    stageStartedAtMs = Date.now();
    const intentState = resolveKrxDispatchIntentState(branch, workflowFile, date, requestId, requestHash, retryRejectedDispatch);
    recordKrxTimingStage(timing, "intentResolve", stageStartedAtMs);
    if (!intentState || intentState._continueKrxDispatch !== true) {
      return attachKrxTiming(timing, intentState, intentState && intentState.action || "intent_return");
    }
    retryRejectedDispatch = intentState.retryRejectedDispatch === true;

    if (initialPreflight.pricesError) throw initialPreflight.pricesError;
    stageStartedAtMs = Date.now();
    let decision = shouldDispatchKrxWorkflow(body, initialPreflight.prices);
    recordKrxTimingStage(timing, "initialDecision", stageStartedAtMs);
    if (!decision.shouldDispatch) {
      stageStartedAtMs = Date.now();
      const skipped = finalizeKrxWorkflowSkipped(requestId, requestHash, branch, date, decision);
      recordKrxTimingStage(timing, "finalizeSkipped", stageStartedAtMs);
      return attachKrxTiming(timing, skipped, skipped.action || "workflow_skipped");
    }

    stageStartedAtMs = Date.now();
    const activeState = resolveKrxActiveWorkflowState(branch, workflowFile, date, requestId, operationHash, initialPreflight.active);
    recordKrxTimingStage(timing, "activeResolve", stageStartedAtMs);
    if (activeState) return attachKrxTiming(timing, activeState, activeState.action || "active_return");

    // 기존 marker/run을 확인하는 동안 직전 workflow가 완료되어 prices 상태가 바뀔 수 있다.
    // 실제 intent/marker/POST 직전에 prices.json을 별도로 다시 읽어 기존 TOCTOU 순서를 유지한다.
    stageStartedAtMs = Date.now();
    decision = shouldDispatchKrxWorkflow(body);
    recordKrxTimingStage(timing, "finalPricesRecheck", stageStartedAtMs);
    if (!decision.shouldDispatch) {
      stageStartedAtMs = Date.now();
      const skipped = finalizeKrxWorkflowSkipped(requestId, requestHash, branch, date, decision);
      recordKrxTimingStage(timing, "finalizeSkipped", stageStartedAtMs);
      return attachKrxTiming(timing, skipped, skipped.action || "workflow_skipped");
    }

    stageStartedAtMs = Date.now();
    const payload = prepareKrxDispatchAttempt(
      branch, date, requestId, requestHash, decision, operationHash, retryRejectedDispatch, timing
    );
    recordKrxTimingStage(timing, "prepareDispatch", stageStartedAtMs);

    stageStartedAtMs = Date.now();
    const dispatchResult = sendKrxWorkflowDispatch(
      workflowFile, branch, date, requestId, requestHash, operationHash, payload
    );
    recordKrxTimingStage(timing, "workflowDispatch", stageStartedAtMs);

    const durableSeedCurrent = !retryRejectedDispatch && initialPreflight.durable && !initialPreflight.durable.value
      ? initialPreflight.durable.current
      : null;
    stageStartedAtMs = Date.now();
    const success = persistKrxDispatchSuccess(
      workflowFile, branch, date, requestId, requestHash, operationHash, decision, dispatchResult, durableSeedCurrent, timing
    );
    recordKrxTimingStage(timing, "persistSuccess", stageStartedAtMs);
    return attachKrxTiming(timing, success, success.action || "workflow_dispatched");
  } catch (err) {
    try { err.krxTiming = buildKrxTimingSnapshot(timing, "error"); } catch (_) {}
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * 11. Web App Entry / Router
 * ========================================================= */

// POST 요청 본문을 JSON object로 파싱한다.
// 인증 전에도 JSON.parse가 실행되므로 비정상 대용량 payload가 불필요한 CPU/메모리를 쓰지 않게 상한을 둔다.
// 정상 Batch 최대 100건보다 충분히 큰 여유를 두되, 공개 Web App의 unauthenticated parse surface는 제한한다.
const MAX_POST_BODY_CHARS = 256 * 1024;

/* --- 11A. Parse / Authenticated Router / HTTP Response -------------------- */

function parsePostBody(e) {
  const bodyText =
    e && e.postData && e.postData.contents
      ? String(e.postData.contents)
      : "{}";

  if (bodyText.length > MAX_POST_BODY_CHARS) {
    throw new Error("요청 본문이 너무 큽니다.");
  }

  const parsed = JSON.parse(bodyText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("요청 본문은 JSON object여야 합니다.");
  }
  return parsed;
}

// 인증이 끝난 요청을 허용된 action별 업무 처리 함수로 전달한다. 알 수 없는 action은 fail-closed한다.
function routePostAction(body) {
  const action = String(body.action || "").trim();

  if (action === "updateKrxPrices") {
    return dispatchKrxPriceWorkflow(body);
  }

  if (action === "batchPension") {
    return handlePensionBatchIdempotent(body);
  }

  if (action === "upsert" || action === "delete") {
    return handlePensionDataSerialized(body);
  }

  throw new Error("지원하지 않는 action입니다: " + (action || "(empty)"));
}

// POST entry: 파싱/인증/라우팅 후 최종 JSON HTTP 응답만 생성한다.
function doPost(e) {
  const previousMaintenanceContext = beginDirectRequestMaintenanceScope();
  try {
    const body = parsePostBody(e);
    assertAdminPin(body);
    return jsonResponse(routePostAction(body));
  } catch (err) {
    const failure = {
      ok: false,
      error: String(err && err.message ? err.message : err)
    };
    if (err && err.krxTiming) failure.timing = err.krxTiming;
    if (err && err.pensionTiming) failure.timing = err.pensionTiming;
    return jsonResponse(failure);
  } finally {
    restoreDirectRequestMaintenanceScope(previousMaintenanceContext);
  }
}

// GAS Web App 상태 확인용 health 응답을 반환한다.
function doGet() {
  return jsonResponse({
    ok: true,
    service: "investment-dashboard-github-writer",
    message: "퇴직연금 기업적립금·현금성자산·추가 매수 저장 및 KRX 현재가 반영용 Apps Script가 실행 중입니다."
  });
}
