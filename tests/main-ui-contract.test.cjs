const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const compact=s=>s.replace(/\s+/g,' ');

const index=read('index.html');
const common=read('css/common.css');
const tablet=read('css/tablet.css');
const mobile=read('css/mobile.css');
const special=read('css/special.css');
const interaction=read('css/interaction.css');
const print=read('css/print.css');
const charts=read('js/dashboard-charts.js');
const core=read('js/dashboard-core.js');
const modal=read('js/dashboard-modal.js');
const uiCommon=read('js/dashboard-ui-common.js');
const ui=read('js/dashboard-ui.js');
const pension=read('js/dashboard-pension.js');
const pensionEditor=read('js/dashboard-pension-editor.js');
const marketAi=read('js/dashboard-market-ai.js');
const marketAiClient=read('js/dashboard-market-ai-client.js');
const liveValuation=read('js/dashboard-live-valuation.js');
const app=read('js/dashboard-app.js');
const updatePricesWorkflow=read('.github/workflows/update-prices.yml');
const updatePricesPython=read('scripts/update_prices.py');

const common1=compact(common);
const special1=compact(special);
const charts1=compact(charts);
const modal1=compact(modal);
const ui1=compact(ui);
const market1=compact(marketAi);
const index1=compact(index);

function importsOf(source){
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
}

test('Main boot contract: CSS 6개 순서와 app/Market AI 두 module entry를 유지한다',()=>{
  const cssOrder=['common.css','tablet.css','mobile.css','special.css','interaction.css','print.css'];
  let last=-1;
  for(const file of cssOrder){
    const at=index.indexOf(`'${file}'`);
    assert.ok(at>last,`${file} must keep canonical CSS order`);
    last=at;
  }
  assert.match(index,/'kodex-leverage-schema\.js'/,'공통 KODEX validator도 importmap cache-bust 대상이어야 한다');
  assert.match(index,/type="module" src="js\/dashboard-app\.js\?v=/);
  assert.match(index,/type="module" src="js\/dashboard-market-ai\.js\?v=/);
  assert.doesNotMatch(index,/'dashboard-responsive\.js'/);
});


test('Main appearance 두 control은 localStorage와 BroadcastChannel을 함께 갱신한다',()=>{
  assert.match(ui1,/const THEME_STORAGE_KEY='investmentDashboard\.theme'/);
  assert.match(ui1,/const CORNER_THEME_STORAGE_KEY='investmentDashboard\.cornerTheme'/);
  assert.match(ui1,/const APPEARANCE_CHANNEL_NAME='investmentDashboard\.appearance'/);
  assert.match(ui1,/appearanceChannel=new BroadcastChannel\(APPEARANCE_CHANNEL_NAME\)/);
  assert.match(ui1,/function publishAppearanceChange\(\)\{ try\{appearanceChannel\?\.postMessage\(\{theme:currentTheme\(\),cornerTheme:currentCornerTheme\(\)\}\)\}catch\(_\)\{\} \}/);
  assert.match(ui1,/function setTheme\(theme,\{redraw=true\}=\{\}\)\{[^]*?localStorage\.setItem\(THEME_STORAGE_KEY,dark\?'dark':'light'\)[^]*?syncThemeControls\(\); publishAppearanceChange\(\);/);
  assert.match(ui1,/function setCornerTheme\(theme\)\{[^]*?localStorage\.setItem\(CORNER_THEME_STORAGE_KEY,rounded\?'rounded':'soft-square'\)[^]*?syncCornerThemeControls\(\); publishAppearanceChange\(\);/);
});

test('Main module boundary: core는 DOM 비의존, Market AI transport는 중립 client로 공유한다',()=>{
  assert.doesNotMatch(core,/\bdocument\b/);
  assert.doesNotMatch(core,/\bwindow\b/);
  assert.deepEqual(importsOf(modal),[]);
  assert.deepEqual(importsOf(marketAi),['./dashboard-modal.js','./dashboard-market-ai-client.js']);
  assert.deepEqual(importsOf(marketAiClient),[]);
  assert.deepEqual(importsOf(liveValuation),['./dashboard-core.js','./dashboard-market-ai-client.js']);
});

test('KODEX canonical schema는 Main core의 별도 구현 없이 공통 validator 모듈을 사용한다',()=>{
  assert.match(core,/import\s*\{\s*validateKodexLeverageSource\s*\}\s*from '\.\/kodex-leverage-schema\.js'/);
  assert.match(core,/const validated=validateKodexLeverageSource\(source\)/);
  assert.doesNotMatch(core,/function isValidIsoCalendarDate\(/);
});

test('공통 scroll overflow state는 ui-common이 소유하고 Table/Chart가 같은 helper를 재사용한다',()=>{
  assert.match(uiCommon,/function refreshScrollOverflowState\(\)\{[^]*?\.mobile-scroll, \.chart-wrap[^]*?classList\.toggle\('is-scrollable',scrollable\)/);
  assert.match(charts,/import\s*\{[^}]*refreshScrollOverflowState[^}]*\}\s*from '\.\/dashboard-ui-common\.js'/);
  assert.doesNotMatch(charts,/function refreshScrollOverflowState\(/);
  assert.match(ui,/import\s*\{[^}]*refreshScrollOverflowState[^}]*\}\s*from '\.\/dashboard-ui-common\.js'/);
  assert.doesNotMatch(ui,/import\s*\{[^}]*refreshScrollOverflowState[^}]*\}\s*from '\.\/dashboard-charts\.js'/);
});

test('Main graph entry: app은 core/ui-common/modal/charts/ui/pension/pension-editor를 orchestration한다',()=>{
  const imports=importsOf(app);
  for(const dependency of [
    './dashboard-core.js','./dashboard-ui-common.js','./dashboard-modal.js','./dashboard-charts.js',
    './dashboard-ui.js','./dashboard-pension.js','./dashboard-pension-editor.js','./dashboard-live-valuation.js'
  ])assert.ok(imports.includes(dependency),`missing app dependency ${dependency}`);
  assert.equal(imports.includes('./dashboard-market-ai.js'),false);
});

test('실시간 평가 adapter는 importmap cache-bust 대상이고 boot 이후 별도 lifecycle로 시작한다',()=>{
  assert.match(index,/'dashboard-market-ai-client\.js'/);
  assert.match(index,/'dashboard-live-valuation\.js'/);
  assert.match(app,/setupLiveValuation\(\{renderDashboard:renderLiveValuationRefresh\}\);/);
  assert.match(liveValuation,/const LIVE_VALUATION_POLL_MS=30_000;/);
  assert.match(marketAi,/const MARKET_AI_POLL_MS=30_000;/);
  assert.match(liveValuation,/\/api\/market-data\/krx-quotes/);
  assert.match(liveValuation,/document\.visibilityState==='visible'/);
});


test('실시간 평가 empty universe도 authoritative client lease로 반납하고 로컬 requestedTickers를 비운다',()=>{
  assert.doesNotMatch(liveValuation,/if\(!tickers\.length\)\{\s*const changed=clearLiveValuationSnapshot\('empty-universe'\);[^}]*return;/);
  assert.match(liveValuation,/if\(!tickers\.length\)\{[^]*?clearLiveValuationSnapshot\('empty-universe',\[\]\)/);
  assert.match(liveValuation,/tickers:tickers\.join\(','\),\s*client_id:LIVE_VALUATION_CLIENT_ID/);
  assert.match(liveValuation,/tickers\.length\?null:\[\]/);
  assert.match(core,/function clearLiveValuationSnapshot\(reason='unavailable',requestedTickersOverride=null\)/);
  assert.match(core,/Array\.isArray\(requestedTickersOverride\)[^]*?requestedTickers:requested/);
});

test('실시간 평가 race 방어: client lease, universe drift, pending render를 fail-safe로 처리한다',()=>{
  assert.match(liveValuation,/LIVE_VALUATION_CLIENT_SESSION_KEY='investmentDashboard\.liveValuationClientId'/);
  assert.match(liveValuation,/client_id:LIVE_VALUATION_CLIENT_ID/);
  assert.match(liveValuation,/const requestedUniverseKey=liveValuationUniverseKey\(tickers\)/);
  assert.match(liveValuation,/const currentUniverseKey=liveValuationUniverseKey\(liveValuationTickersForDate\(today\)\)/);
  assert.match(liveValuation,/if\(currentUniverseKey!==requestedUniverseKey\)\{[^]*?queueUniverseReconcileRefresh\(\);[^]*?return;/);
  assert.match(liveValuation,/let liveValuationRenderPending=false;/);
  assert.match(liveValuation,/function flushLiveValuationRender\(\)/);
  assert.match(liveValuation,/if\(!liveValuationCanRender\(\)\)\{[^]*?schedulePendingRenderCheck\(\);[^]*?return false;/);
  assert.match(liveValuation,/else flushLiveValuationRender\(\);/);
  assert.match(liveValuation,/if\(refreshSequence!==liveValuationRefreshSequence\)return;/);
});

test('Dashboard 날짜 hash는 유효한 값이면 초기 선택일로 복원하고, malformed hash도 최신일로 fallback한다',()=>{
  assert.match(app,/let requestedDate='';\s*try\{requestedDate=decodeURIComponent\(location\.hash\.replace\(\/\^#\/,''\)\);\}catch\{\}/);
  assert.match(app,/dataState\.activeDate=dates\.includes\(requestedDate\)\?requestedDate:dates\.at\(-1\);/);
});

test('KRX 요청은 중복 전송을 막고 재진입 session에서 이전 응답·자동 닫기 timer를 격리한다',()=>{
  assert.match(ui,/let krxActionModalCloseTimer=0;/);
  assert.match(ui,/let krxActionRequestInFlight=false;/);
  assert.match(ui,/let krxActionModalSession=0;/);
  assert.match(ui,/if\(krxActionRequestInFlight\)\{[^]*?return;/);
  assert.match(ui,/const requestSession=krxActionModalSession;/);
  assert.match(ui,/const currentSession=\(\)=>requestSession===krxActionModalSession;/);
  assert.match(ui,/function clearKrxActionModalCloseTimer\(\)\{[^]*?clearTimeout\(krxActionModalCloseTimer\)/);
  assert.match(ui,/function openKrxActionModal\(\)\{\s*clearKrxActionModalCloseTimer\(\);/);
  assert.match(ui,/function closeKrxActionModal\(\)\{\s*clearKrxActionModalCloseTimer\(\);/);
  assert.match(ui,/krxActionModalCloseTimer=window\.setTimeout\(/);
});

test('KRX 실패 재시도는 같은 requestId를 재사용하고 dispatch 불확실 응답도 성공 완료로 오인하지 않는다',()=>{
  assert.match(ui,/let krxActionRequestIdentity=\{key:'',id:''\};/);
  assert.match(ui,/function getKrxActionRequestId\(mode,date\)\{/);
  assert.match(ui,/requestId:String\(requestId\|\|''\)\.trim\(\)/);
  assert.match(ui,/const requestId=getKrxActionRequestId\(updateMode,selectedDate\);/);
  assert.match(ui,/dispatchKrxPriceUpdate\(pin, updateMode, requestId\)/);
  assert.match(ui,/workflow_dispatch_uncertain/);
  assert.match(ui,/Actions 상태를 확인해주세요/);
  const statusUncertainStart=ui.indexOf("if(data.action==='workflow_status_uncertain')");
  const terminalActionStart=ui.indexOf("if(['workflow_skipped','workflow_duplicate_ignored','workflow_dispatch_uncertain','workflow_in_progress'].includes(data.action))",statusUncertainStart);
  assert.ok(statusUncertainStart>=0&&terminalActionStart>statusUncertainStart,'workflow_status_uncertain은 terminal action보다 먼저 분기해야 한다');
  assert.doesNotMatch(ui.slice(statusUncertainStart,terminalActionStart),/resetKrxActionRequestIdentity\(\)/,'transient status uncertainty에서는 같은 requestId를 유지해야 한다');
  assert.match(ui,/resetKrxActionRequestIdentity\(\);\s*const successMsg=/);
});

test('KRX write는 60초 전용 timeout을 사용하고 timeout을 미확정 상태로 안내하며 같은 requestId를 유지한다',()=>{
  assert.match(ui,/const KRX_WRITE_REQUEST_TIMEOUT_MS=60000;/);
  const dispatchStart=ui.indexOf('async function dispatchKrxPriceUpdate');
  const modalStart=ui.indexOf('function ensureKrxActionModal',dispatchStart);
  assert.ok(dispatchStart>=0&&modalStart>dispatchStart,'KRX dispatch 함수 범위를 찾지 못했다');
  const dispatchBlock=ui.slice(dispatchStart,modalStart);
  assert.match(dispatchBlock,/fetchWithTimeout\(config\.url,[^]*?KRX_WRITE_REQUEST_TIMEOUT_MS\);/);
  assert.match(dispatchBlock,/if\(data\?\.timing\)console\.info\('\[KRX timing\]',updateMode,data\.timing\);/,'KRX timing은 UI를 바꾸지 않고 개발자 콘솔에만 남겨야 한다');

  const submitStart=ui.indexOf('async function submitKrxActionModal');
  const catchStart=ui.indexOf('}catch(e){',submitStart);
  const finallyStart=ui.indexOf('}finally{',catchStart);
  assert.ok(submitStart>=0&&catchStart>submitStart&&finallyStart>catchStart,'KRX submit catch 범위를 찾지 못했다');
  const catchBlock=ui.slice(catchStart,finallyStart);
  assert.match(catchBlock,/e\?\.code==='NETWORK_TIMEOUT'/);
  assert.match(catchBlock,/요청은 서버에서 계속 처리될 수 있습니다/);
  assert.match(catchBlock,/timedOut\?'checking':'err'/);
  assert.match(catchBlock,/showAppToast\(errorMessage,timedOut\?'ok':'err'/,'timeout은 실패색 Toast로 단정하지 않아야 한다');
  assert.doesNotMatch(catchBlock,/resetKrxActionRequestIdentity\(\)/,'timeout에서는 동일 requestId를 버리면 안 된다');
});

test('퇴직연금 Action PIN은 서버 요청 중 dismiss를 잠그고 실패 시 다시 활성화한다',()=>{
  assert.match(pensionEditor,/let activePensionActionPinSession=null;/);
  assert.match(pensionEditor,/activePensionActionPinSession\?\.finish\(null\);/);
  assert.match(pensionEditor,/if\(old\)closeDashboardModal\(old,\{visibleClass:'',manageAriaHidden:false,remove:true\}\);/);
  assert.doesNotMatch(pensionEditor,/if\(old\) old\.remove\(\);/);
  assert.match(pensionEditor,/let busy=false;\s*let finished=false;/);
  assert.match(pensionEditor,/const setDismissEnabled=enabled=>\{[^]*?cancel\.disabled=!enabled;[^]*?close\.disabled=!enabled;/);
  assert.match(pensionEditor,/busy=true;\s*input\.disabled=true;\s*setDismissEnabled\(false\);/);
  assert.match(pensionEditor,/busy=false;\s*setDismissEnabled\(true\);/);
  assert.match(pensionEditor,/const dismiss=\(\)=>\{if\(!busy&&!finished\)finish\(null\);\};/);
  assert.match(pensionEditor,/cancel\?\.addEventListener\('click',dismiss\);/);
  assert.match(pensionEditor,/close\?\.addEventListener\('click',dismiss\);/);
  assert.match(pensionEditor,/bindDashboardModalDismiss\(modal,\{onDismiss:dismiss\}\);/);
});

test('퇴직연금 삭제 PIN은 위험 상태를 명시하고 교체된 요청도 완료한다',()=>{
  assert.match(pensionEditor,/pension-action-pin-modal\$\{danger\?' is-danger':''\}/);
  assert.match(pensionEditor,/danger\?'<p class="pension-action-pin-danger" role="alert">삭제한 기록은 되돌릴 수 없습니다\.<\/p>':''/);
  assert.match(pensionEditor,/if\(activePensionActionPinSession\?\.modal===modal\)activePensionActionPinSession=null;/);
  assert.match(pensionEditor,/\}catch\(e\)\{\s*if\(finished\)return;/);
  assert.match(common,/\.pension-action-pin-modal\.is-danger \.pension-action-pin-card/);
  assert.match(common,/\.pension-action-pin-danger\{/);
  assert.match(common,/\.pension-action-pin-danger\{[^}]*line-height:var\(--type-line-body\)/s);
  assert.doesNotMatch(common,/--type-line-height-body/);
});

test('퇴직연금 편집기는 화면 입력과 작업 모음 모두에서 수량·금액을 안전 정수로 제한한다',()=>{
  assert.match(pensionEditor,/const isSafePensionWhole=\(value,\{positive=false\}=\{\}\)=>Number\.isSafeInteger\(value\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(draft\.qty,\{positive:true\}\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(draft\.amount,\{positive:true\}\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(Number\(item\.valuation\)\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(Number\(item\.amount\),\{positive:true\}\)/);
  assert.doesNotMatch(pensionEditor,/!Number\.isInteger\(qty\)\|\|qty<=0\|\|!Number\.isFinite\(amount\)\|\|amount<=0/);
});

test('퇴직연금 일괄 저장은 전체 재렌더링 전에 기존 모달 잠금을 해제한다',()=>{
  assert.match(pensionEditor,/pensionEditorState\.batchMode=true;\s*closePensionContributionModal\(\);\s*renderDashboard\?\.\(\);\s*openPensionContributionModal\(\);/);
});

test('퇴직연금 Batch는 각 작업의 stable operationId를 GAS에 전달하고 삭제 재시도 성공을 로컬에 수렴시킨다',()=>{
  assert.match(pensionEditor,/operationId:op\.operationId\|\|op\.tempId\|\|op\.qid\|\|''/);
  assert.match(pensionEditor,/data\.duplicate[^]*?이미 삭제된 상태를 확인했습니다/);
});


test('현금성자산 단건 저장은 화면 버전 precondition과 durable pending requestId를 함께 유지한다',()=>{
  assert.match(pensionEditor,/PENSION_PENDING_IDENTITY_STORAGE_KEY='investment-dashboard:pension-pending-identities:v1'/);
  assert.match(pensionEditor,/findReusablePendingIdentity\(readPensionPendingIdentityStore\(\)\.single,fingerprint\)/);
  assert.match(pensionEditor,/prepared\.expectedVersion=pensionCashSnapshotVersion\(current\)/);
  assert.match(pensionEditor,/prepared\.expectedAbsent=true/);
  assert.match(pensionEditor,/\{\.\.\.prepared,requestId:pensionEditorState\.singleSaveId,logicalOperationId:pensionEditorState\.singleSaveId\}/);
  assert.match(pensionEditor,/upsertPensionPendingSingle\(saveFingerprint,saveIdentity,\{status:'sent',payload:saveItem\}\)/);
  assert.match(pensionEditor,/markPensionPendingSingleStatus\(saveFingerprint,saveIdentity,'uncertain',saveItem\)/);
  assert.match(pensionEditor,/clearPensionPendingSingle\(saveFingerprint,saveIdentity\)/);
  assert.match(pensionEditor,/오래된 저장 재시도는 최신 상태 위에 다시 적용하지 않았습니다/);
});

test('퇴직연금 Batch cash 작업은 initial snapshot precondition과 reload 복구용 identity를 GAS에 전달한다',()=>{
  assert.match(pensionEditor,/function preparePensionBatchCashPrecondition\(operation\)\{/);
  assert.match(pensionEditor,/op\.expectedVersion=pensionCashSnapshotVersion\(source\)/);
  assert.match(pensionEditor,/op\.expectedAbsent=true/);
  assert.match(pensionEditor,/expectedVersion:String\(op\.expectedVersion\|\|''\),expectedAbsent:op\.expectedAbsent===true/);
  assert.match(pensionEditor,/findPendingBatchIdentity\(signature\)/);
  assert.match(pensionEditor,/persistPendingBatchIdentity\(batchSignature,batchRequestId,pensionEditorState\.batchQueue,\{status:'sent',payloadOperations:batchPayloadOperations\}\)/);
  assert.match(pensionEditor,/markPendingBatchIdentityStatus\(batchSignature,batchRequestId,'uncertain',batchPayloadOperations\)/);
  assert.match(pensionEditor,/confirmationToken=String\(confirmation\.token\)/);
  assert.match(pensionEditor,/confirmationDecision=String\(confirmation\.decision\)/);
  assert.match(pensionEditor,/confirmationDecisions=\{\.\.\.confirmation\.decisions\}/);
  assert.match(pensionEditor,/clearPendingBatchIdentity\(batchSignature,batchRequestId\)/);
  assert.match(pensionEditor,/payloadOperations:payloadOperations\|\|prior\?\.payloadOperations\|\|null/);
  assert.doesNotMatch(pensionEditor,/function pensionBatchOperationFingerprint\(operation\)\{[^]*?const precondition=/);
});

 test('퇴직연금 pending logical identity는 optimistic precondition과 분리하고 최초 payload 자체를 재사용한다',()=>{
  assert.match(pensionEditor,/if\(item\?\.target==='cashSnapshot'\)return `cashSnapshot\|\$\{String\(item\.date\|\|''\)\}\|\$\{String\(item\.valuation\?\?''\)\}\|\$\{String\(item\.costBasis\?\?''\)\}\|\$\{String\(item\.memo\|\|''\)\}`/);
  assert.match(pensionEditor,/if\(pending\?\.id&&pending\?\.payload\)\{[^]*?return \{\.\.\.pensionEditorState\.singleSavePayload\}/);
  assert.match(pensionEditor,/pensionEditorState\.batchPendingOperations=Array\.isArray\(pending\.payloadOperations\)/);
  assert.match(pensionEditor,/const batchPayloadOperations=Array\.isArray\(pensionEditorState\.batchPendingOperations\)/);
});



test('퇴직연금 cross-device 동일 내용은 state-bound confirmation token으로 기존 처리/별도 mutation을 서버에서 재확인한다',()=>{
  assert.match(pensionEditor,/logicalOperationId:String\(op\.logicalOperationId\|\|op\.operationId\|\|op\.tempId\|\|op\.qid\|\|''\)/);
  assert.match(pensionEditor,/requiresDuplicateConfirmation===true/);
  assert.match(pensionEditor,/confirmationToken:String\(data\.confirmationToken\|\|''\)/);
  assert.match(pensionEditor,/confirmationDecisions=\{\.\.\.confirmation\.decisions\}/);
  assert.match(pensionEditor,/const conflicts=Array\.isArray\(data\.conflictOperations\)\?data\.conflictOperations:\[\]/);
  assert.match(pensionEditor,/decisions\[String\(index\)\]=distinct\?'distinct':'existing'/);
  assert.match(pensionEditor,/confirmation=\{token:data\.confirmationToken,decisions\}/);
  assert.doesNotMatch(pensionEditor,/allowDistinct:true/);
  assert.doesNotMatch(pensionEditor,/batchPendingAllowDistinct/);
});

test('퇴직연금 부분 충돌 Batch는 충돌 operation별 existing/distinct 결정을 수집하고 하나의 Batch로 재검증한다',()=>{
  assert.match(pensionEditor,/if\(data\.fullMatch===true\)\{/);
  assert.match(pensionEditor,/conflicts\.forEach\(conflict=>\{/);
  assert.match(pensionEditor,/const description=pensionBatchOperationDescription\(op\)/);
  assert.match(pensionEditor,/부분 충돌 작업 모음 확인/);
  assert.match(pensionEditor,/savePensionBatchViaGithubPages\(batchPayloadOperations,pin,batchRequestId,confirmation\)/);
});


test('퇴직연금 Batch의 동일 batch/logical identity 충돌은 사용자 distinct 선택 없이 existing으로 고정한다',()=>{
  assert.match(pensionEditor,/if\(String\(conflict\?\.forcedDecision\|\|''\)==='existing'\)\{/);
  assert.match(pensionEditor,/decisions\[String\(index\)\]='existing'/);
});

test('퇴직연금 단건 삭제는 모든 target에서 durable pending logicalOperationId를 유지하고 cash만 snapshot version을 추가한다',()=>{
  assert.match(pensionEditor,/singleDeleteFingerprint:'',\s*singleDeleteId:'',\s*singleDeletePayload:null/);
  assert.match(pensionEditor,/function pensionCashSnapshotVersion\(item\)\{/);
  assert.match(pensionEditor,/const fingerprint=`\$\{String\(target\|\|''\)\}-delete\|\$\{String\(key\|\|''\)\}`/);
  assert.match(pensionEditor,/findReusablePendingIdentity\(readPensionPendingIdentityStore\(\)\.single,fingerprint\)/);
  assert.match(pensionEditor,/const payload=\{deleteRequestId:id,logicalOperationId:id\}/);
  assert.match(pensionEditor,/if\(target==='cashSnapshot'\)\{[^]*?payload\.expectedVersion=expectedVersion/);
  assert.match(pensionEditor,/payload\.deleteRequestId=String\(deleteContext\.deleteRequestId\|\|''\)\.trim\(\)/);
  assert.match(pensionEditor,/payload\.logicalOperationId=String\(deleteContext\.logicalOperationId\|\|deleteContext\.deleteRequestId\|\|''\)\.trim\(\)/);
  assert.match(pensionEditor,/upsertPensionPendingSingle\(deleteFingerprint,deleteIdentity,\{status:'sent',payload:deleteContext\}\)/);
  assert.match(pensionEditor,/if\(data\.requiresDuplicateConfirmation===true\)\{/);
  assert.match(pensionEditor,/confirmationToken:String\(data\.confirmationToken\|\|''\)/);
  assert.match(pensionEditor,/clearPensionPendingSingle\(deleteFingerprint,deleteIdentity\)/);
  assert.match(pensionEditor,/오래된 삭제 재시도는 최신 상태에 다시 적용하지 않았습니다/);
});

test('Batch 중복 응답에 state가 없으면 과거 pension state를 로컬에 다시 적용하지 않는다',()=>{
  assert.match(pensionEditor,/const duplicateWithoutState=!!data\.duplicate&&!data\.state;/);
  assert.match(pensionEditor,/if\(!duplicateWithoutState\)applyPensionBatchStateLocally\(data\.state\);/);
  assert.match(pensionEditor,/data\.stale[^]*?오래된 작업 모음 재시도는 다시 적용하지 않았습니다/);
});

test('KRX 갱신은 기준일과 다른 종가·직전값을 숨김 처리하고 자동 성공으로 끝내지 않는다',()=>{
  assert.match(updatePricesPython,/source_dates\[f"SEC:\{ticker\}"\] = actual_date/);
  assert.match(updatePricesPython,/if actual_date != target_date:\s*warnings\.append/);
  assert.match(updatePricesPython,/display = not warnings/);
  assert.match(updatePricesPython,/return 1 if all_warnings else 0/);
});

test('KRX workflow의 shell 조건문은 각 run step 안에서 완결되어 실행 단계 문법 오류를 만들지 않는다',()=>{
  const updateStart=updatePricesWorkflow.indexOf('- name: Update KRX prices and snapshots');
  const verifyStart=updatePricesWorkflow.indexOf('- name: Verify generated prices are selectable closes only');
  const commitStart=updatePricesWorkflow.indexOf('- name: Commit generated KRX data');
  assert.ok(updateStart>=0&&verifyStart>updateStart&&commitStart>verifyStart,'KRX workflow step 경계가 올바르지 않다');
  const updateBlock=updatePricesWorkflow.slice(updateStart,verifyStart);
  const verifyBlock=updatePricesWorkflow.slice(verifyStart,commitStart);
  assert.match(updateBlock,/if \[ -n "\$INPUT_DATE" \]; then[^]*?else[^]*?python scripts\/update_prices\.py[^]*?\n\s*fi\s*$/m,'Update step의 if/else/fi가 같은 run block에서 닫혀야 한다');
  assert.doesNotMatch(verifyBlock,/^\s*fi\s*$/m,'Verify step에 앞 step 조건문의 stray fi가 남으면 안 된다');
});

test('KRX workflow는 같은 branch 생성데이터를 직렬화하고 pending 요청을 queue에 보존한다',()=>{
  assert.match(updatePricesWorkflow,/concurrency:\s*\n\s*group: update-krx-prices-\$\{\{ github\.ref \}\}\s*\n\s*queue: max/);
  assert.doesNotMatch(updatePricesWorkflow,/cancel-in-progress:\s*true/);
  assert.match(updatePricesWorkflow,/request_id:/);
});

test('queued KRX run은 실행 시작 시 최신 branch tip을 generation base로 다시 잡되 generation input 변경은 fail-closed한다',()=>{
  const refreshStart=updatePricesWorkflow.indexOf('- name: Refresh queued run generation base');
  const updateStart=updatePricesWorkflow.indexOf('- name: Update KRX prices and snapshots');
  assert.ok(refreshStart>=0&&updateStart>refreshStart,'queued-run generation base refresh가 updater보다 먼저 실행돼야 한다');
  const refreshBlock=updatePricesWorkflow.slice(refreshStart,updateStart);
  assert.match(refreshBlock,/DISPATCH_SHA="\$\(git rev-parse HEAD\)"/);
  assert.match(refreshBlock,/git fetch origin "\$BRANCH_NAME"/);
  assert.match(refreshBlock,/START_SHA="\$\(git rev-parse "origin\/\$BRANCH_NAME"\)"/);
  assert.match(refreshBlock,/KRX_INPUT_PATHS=\(data\/portfolio\.json scripts\/update_prices\.py requirements\.txt \.github\/workflows\/update-prices\.yml\)/);
  assert.match(refreshBlock,/git diff --quiet "\$DISPATCH_SHA" "\$START_SHA" -- "\$\{KRX_INPUT_PATHS\[@\]\}"/);
  assert.match(refreshBlock,/git checkout --detach "\$START_SHA"/);
  assert.match(refreshBlock,/KRX generation inputs changed while this run was queued/);
});

test('KRX workflow run-name은 date/mode와 requestId를 노출해 GAS가 queued/running 동일 작업을 식별할 수 있다',()=>{
  assert.match(updatePricesWorkflow,/run-name: KRX update \$\{\{ inputs\.date \|\| 'auto' \}\} · \$\{\{ inputs\.request_id \|\| 'manual' \}\}/);
});

test('KRX workflow_dispatch는 request_id input을 받아 run-name 식별자가 서버 run ID 추적과 함께 유지될 수 있다',()=>{
  assert.match(updatePricesWorkflow,/workflow_dispatch:[^]*?request_id:/);
  assert.match(updatePricesWorkflow,/run-name:\s*KRX update/);
  assert.match(updatePricesWorkflow,/inputs\.request_id/);
});

test('KRX workflow는 다른 branch commit과 push가 경합해도 최신 remote에 rebase 후 제한 재시도한다',()=>{
  assert.match(updatePricesWorkflow,/uses: actions\/checkout@v4\s*\n\s*with:\s*\n\s*fetch-depth: 0/);
  assert.match(updatePricesWorkflow,/BASE_SHA="\$\(git rev-parse HEAD\)"/);
  assert.match(updatePricesWorkflow,/for attempt in 1 2 3; do/);
  assert.match(updatePricesWorkflow,/git fetch origin "\$BRANCH_NAME"/);
  assert.match(updatePricesWorkflow,/KRX_MANAGED_PATHS=\(data\/prices\.json data\/performance_snapshots\.json\)/);
  assert.match(updatePricesWorkflow,/KRX_INPUT_PATHS=\(data\/portfolio\.json scripts\/update_prices\.py requirements\.txt \.github\/workflows\/update-prices\.yml\)/);
  assert.match(updatePricesWorkflow,/git diff --quiet "\$BASE_SHA" "origin\/\$BRANCH_NAME" -- "\$\{KRX_MANAGED_PATHS\[@\]\}"/);
  assert.match(updatePricesWorkflow,/git diff --quiet "\$BASE_SHA" "origin\/\$BRANCH_NAME" -- "\$\{KRX_INPUT_PATHS\[@\]\}"/);
  assert.match(updatePricesWorkflow,/KRX generation inputs changed on remote after checkout/);
  assert.match(updatePricesWorkflow,/git rebase "origin\/\$BRANCH_NAME"/);
  assert.match(updatePricesWorkflow,/git push origin "HEAD:\$BRANCH_NAME"/);
  assert.match(updatePricesWorkflow,/KRX data push failed after 3 retries/);
});

test('숨김·경고 KRX 날짜는 다음 자동 실행에서 재수집 대상으로 복구한다',()=>{
  assert.match(updatePricesPython,/retry_dates = \[[^]*?snapshot\.get\("display", True\) is False[^]*?snapshot\.get\("warnings"\)/);
  assert.match(updatePricesPython,/set\(refresh_dates \+ missing_dates \+ retry_dates\)/);
});

test('퇴직연금 ETF 미리보기는 잘못된 수량·금액·일자를 저장 전에 차단한다',()=>{
  assert.match(pensionEditor,/if\(!isSafePensionWhole\(draft\.qty,\{positive:true\}\)\)\{\s*setDisabled\(true\);/);
  assert.match(pensionEditor,/if\(!isSafePensionWhole\(draft\.amount,\{positive:true\}\)\)\{\s*setDisabled\(true\);/);
  assert.match(pensionEditor,/if\(draft\.tradeDate>draft\.applyDate\)\{\s*setDisabled\(true\);/);
});

test('Market AI 신호 HTTP 오류는 helper 내부에서 body timeout을 즉시 해제한다',()=>{
  const start=marketAi.indexOf('async function refreshMarketAiSignalResponse');
  const end=marketAi.indexOf('\nasync function refreshMarketAiMarketSnapshot',start);
  assert.ok(start>=0&&end>start,'Market AI signal response helper is missing');
  const helper=marketAi.slice(start,end);
  assert.match(helper,/if\(response\.status===404\|\|!response\.ok\)\{\s*response\.releaseTimeout\?\.\(\);/);
  assert.match(helper,/return \{response,signal:null,parseError:false\};/);
});

test('Market AI 신호 body는 느린 sibling endpoint를 기다리기 전에 소비해 독립 timeout을 종료한다',async()=>{
  const start=marketAi.indexOf('async function refreshMarketAiSignalResponse');
  const end=marketAi.indexOf('\nasync function refreshMarketAiMarketSnapshot',start);
  assert.ok(start>=0&&end>start,'Market AI signal response helper is missing');

  const vm=require('node:vm');
  let aborted=false;
  let bodyReadStarted=false;
  let timer=0;
  const payload={updated_at:'2026-09-11T06:00:00Z'};
  const response={
    status:200,
    ok:true,
    releaseTimeout(){clearTimeout(timer);},
    async json(){
      bodyReadStarted=true;
      await new Promise(resolve=>setTimeout(resolve,1));
      if(aborted){
        const error=new Error('aborted');
        error.name='AbortError';
        throw error;
      }
      clearTimeout(timer);
      return payload;
    }
  };
  const context={
    setTimeout,
    clearTimeout,
    fetchWithTimeout:async()=>{
      timer=setTimeout(()=>{aborted=true;},10);
      return response;
    }
  };
  vm.createContext(context);
  vm.runInContext(marketAi.slice(start,end),context);

  const [signalResult]=await Promise.all([
    context.refreshMarketAiSignalResponse('http://127.0.0.1:8001'),
    new Promise(resolve=>setTimeout(resolve,20))
  ]);

  assert.equal(bodyReadStarted,true,'signal JSON body must be consumed immediately inside its helper');
  assert.equal(aborted,false,'slow sibling endpoints must not keep the completed signal request timeout alive');
  assert.deepEqual(JSON.parse(JSON.stringify(signalResult.signal)),payload);
  assert.equal(signalResult.parseError,false);
});


test('공통 fetch timeout은 응답 헤더 뒤 JSON 본문 대기까지 유지하고 timeout 오류를 보존한다',async()=>{
  const start=core.indexOf('function networkTimeoutError()');
  const end=core.indexOf('\nfunction dataUrlLabel',start);
  assert.ok(start>=0&&end>start,'core network timeout implementation is missing');
  const vm=require('node:vm');
  let signal;
  const context={
    AbortController,
    NETWORK_REQUEST_TIMEOUT_MS:5,
    setTimeout,
    clearTimeout,
    fetch:async(_url,options)=>{
      signal=options.signal;
      return {
        ok:true,
        json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{
          const error=new Error('aborted');error.name='AbortError';reject(error);
        },{once:true}))
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(core.slice(start,end),context);
  const response=await context.fetchWithTimeout('mock',{},5);
  await assert.rejects(response.json(),error=>error?.code==='NETWORK_TIMEOUT');
  assert.equal(signal.aborted,true);
});

test('가격 갱신 설명은 선택일 종목 갱신과 KOSPI 과거 backfill 범위를 구분한다',()=>{
  assert.match(updatePricesWorkflow,/date 지정:[^\n]*종목 가격\/성과[^\n]*KOSPI[^\n]*backfill/);
  assert.match(updatePricesWorkflow,/지정일까지 저장된 KOSPI 구간의 누락·정정값을 backfill/);
  assert.match(updatePricesPython,/이후 지정일까지 이미 저장된 날짜의 KOSPI 값은 누락·정정 여부를 확인해 backfill할 수 있다/);
  assert.match(updatePricesPython,/help=\([^]*?지정일까지 저장된 KOSPI 구간의 [^]*?누락·정정값을 backfill/);
  assert.doesNotMatch(updatePricesWorkflow,/date 지정:[^\n]*해당 날짜만 갱신/);
  assert.doesNotMatch(updatePricesPython,/--date``가 있으면[^\n]*그 날짜만 처리/);
});

test('Responsive 기본 3구간은 Desktop >=1101 / Tablet 761~1100 / Mobile <=760으로 유지한다',()=>{
  assert.match(tablet,/@media\s*\(min-width:761px\)\s*and\s*\(max-width:1100px\)/);
  assert.match(mobile,/@media\s*\(max-width:760px\)/);
  assert.match(special,/@media\s*\(min-width:1101px\)\s*and\s*\(max-width:1279px\)/);
  assert.match(special,/@media\s*\(max-width:400px\)/);
});

test('Section title/action과 segmented control은 공통 geometry·viewport token contract를 사용한다',()=>{
  assert.match(common1,/--dashboard-control-height:[^;]+/);
  assert.match(common1,/--section-chip-height:var\(--dashboard-control-height\)/);
  assert.match(common1,/--dashboard-control-group-gap:var\(--space-xl\)/);
  assert.match(common1,/--section-title-gap:var\(--space-xl\)/);
  assert.match(common1,/\.section-basis-chip\{[^}]*height:var\(--section-chip-height\);[^}]*padding:0 var\(--space-4xl\);[^}]*line-height:1;/);
  assert.match(special1,/\.section-basis-chip\{[^}]*padding-inline:var\(--space-2xl\);[^}]*font-size:var\(--type-size-xs\);/);
  assert.doesNotMatch(special1,/\.section-basis-chip\{[^}]*padding:var\(--space-sm\)/);
  assert.match(common1,/\.section-title, \.chart-head\{ display:flex; justify-content:space-between; gap:var\(--space-5xl\); \}/);
  assert.match(common1,/\.chart-head-actions, \.section-title-actions\{ display:flex; align-items:center; justify-content:flex-end; gap:var\(--dashboard-control-group-gap\)/);
  assert.match(special1,/--dashboard-control-height:[^;]+/);
  assert.match(special1,/--dashboard-control-group-gap:var\(--space-sm\)/);
  assert.match(special1,/--section-title-gap:var\(--space-sm\)/);
  assert.match(special1,/\.control-tab\{[^}]*min-height:[^;]+;[^}]*font-size:var\(--type-size-sm\)/);
  assert.match(special1,/\.asset-workspace-tabs\{width:100%;margin-bottom:var\(--space-4xl\)\}/);
  for(const source of [common,charts,ui,pensionEditor]) assert.doesNotMatch(source,/chart-compare-toggle|asset-tab-active/);
  assert.match(common1,/\.control-segmented\{/);
  assert.match(interaction,/:is\(\.asset-workspace-tab,\.contrib-target-option\):not\(\.active\):hover/);
  assert.doesNotMatch(mobile,/position:relative;top:1px/);
  assert.doesNotMatch(ui,/source-title/);
});

test('기준 pill과 상태 badge 텍스트는 컨테이너를 움직이지 않고 공통 optical text primitive만 사용한다',()=>{
  assert.match(common1,/--control-text-optical-shift:1px;/);
  assert.equal((common1.match(/--control-text-optical-shift/g)||[]).length,2);
  assert.match(common1,/\.control-text-optical\{[^}]*display:inline-flex;[^}]*align-items:center;[^}]*justify-content:center;[^}]*line-height:1;[^}]*transform:translateY\(var\(--control-text-optical-shift\)\);/);
  assert.doesNotMatch(compact(tablet+mobile+special+print),/--control-text-optical-shift:/);
  assert.match(charts1,/<p class="section-control-chip section-basis-chip"><span class="control-text-optical">삼성증권1 기준<\/span><\/p>/);
  assert.match(charts1,/<p class="section-control-chip section-basis-chip"><span class="control-text-optical">퇴직연금 기준<\/span><\/p>/);
  assert.match(ui1,/class="section-control-chip section-action-chip separate-profit-toggle \$\{uiState\.includeSeparateProfit\?'active':''\}" aria-label="별도수익 포함" aria-pressed="\$\{uiState\.includeSeparateProfit\}"/);
  assert.match(ui1,/<span class="separate-profit-toggle-label">별도수익<\/span><strong><span class="control-text-optical">\$\{uiState\.includeSeparateProfit\?'ON':'OFF'\}<\/span><\/strong>/);
  assert.doesNotMatch(ui1,/aria-label="\$\{uiState\.includeSeparateProfit/);
  assert.match(special1,/\.separate-profit-toggle-label\{display:none\}/);
  assert.match(special1,/\.separate-profit-toggle-label\{display:inline\}/);
  assert.doesNotMatch(special1,/\.separate-profit-toggle span\{display:(?:none|inline)\}/);
  assert.match(charts1,/<span class="chart-y-auto-state"><span class="control-text-optical">\$\{autoY\?'ON':'OFF'\}<\/span><\/span>/);
  assert.doesNotMatch(uiCommon,/mobile-view-toggle[^`]*control-text-optical/);
  assert.doesNotMatch(common1,/\.(?:section-basis-chip|separate-profit-toggle|chart-y-auto-state)[^{]*\{[^}]*transform:translateY/);
});

test('Card surface와 viewport section rhythm은 semantic token 단일 contract를 사용한다',()=>{
  const tablet1=compact(tablet);
  const mobile1=compact(mobile);
  assert.match(common1,/--page-section-gap:var\(--space-9xl\)/);
  assert.match(tablet1,/--page-section-gap:var\(--space-8xl\)/);
  assert.match(special1,/--page-shell-gutter:var\(--space-xl\)/);
  assert.match(special1,/--page-section-gap:var\(--space-5xl\)/);
  assert.match(common1,/--asset-band-section-gap:var\(--card-grid-gap-large\)/);
  assert.match(common1,/:is\(\.card,\.note,\.chart-card\)\{ background:var\(--card\); border-radius:min\(var\(--surface-radius-large\),var\(--corner-surface-cap\)\); padding:var\(--surface-pad-large\)/);
  assert.match(common1,/:is\(\.chart-grid,\.asset-detail-grid,\.metric-grid,\.source-grid,\.ledger-overview-grid\)\{gap:var\(--card-grid-gap-large\)\}/);
  assert.doesNotMatch(common1,/:is\([^}]*#ledger-check[^}]*\)\{gap:/);
  assert.match(common1,/:is\(\.asset-detail-grid,\.securities-subsection,\.pension-chart-block\)\{margin-top:var\(--asset-band-section-gap\)\}/);
assert.match(common1,/\.source-table-scroll\{margin-top:var\(--source-table-gap\);border-radius:0\}/);
  assert.match(common1,/\.change-table-wrap\{margin-top:var\(--space-5xl\);border-radius:min\(var\(--surface-radius-level-3\),var\(--corner-surface-cap\)\)\}/);
  assert.match(common1,/\.data-list-card\{[^}]*border-radius:min\(var\(--surface-radius-mini\),var\(--corner-surface-cap\)\)/);
  assert.doesNotMatch(common,/--surface-radius-data-list:/);
  assert.equal((common.match(/--surface-border-muted:/g)||[]).length,1);
  assert.doesNotMatch(common1,/#ledger-check \.ledger-overview-grid\{[^}]*margin-top:/);
  assert.doesNotMatch(common1,/\.change-kpis\{[^}]*margin-top:/);
  assert.doesNotMatch(mobile1,/\.asset-workspace-tabs\{/);
});

test('Phone Landscape/Phone UI contract는 Main·Market AI·CSS가 같은 predicate를 유지한다',()=>{
  const portrait='(max-width:760px)';
  const landscape='(orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse)';
  const combined=`${portrait}, ${landscape}`;

  const uiLandscape=uiCommon.match(/const PHONE_LANDSCAPE_QUERY='([^']+)'/)?.[1];
  const marketCombined=marketAi.match(/const MARKET_AI_PHONE_MEDIA_QUERY='([^']+)'/)?.[1];

  assert.equal(uiLandscape,landscape,'Main Phone Landscape query drifted');
  assert.match(uiCommon,/function phoneUi\(\)\{\s*return window\.matchMedia\?\.\('\(max-width:760px\)'\)\.matches===true\|\|phoneLandscapeUi\(\);\s*\}/);
  assert.equal(marketCombined,combined,'Market AI Phone query drifted from Main contract');

  const specialCompact=compact(special);
  assert.ok(specialCompact.includes(`@media ${combined}{`),'Phone Shared CSS query drifted');
  assert.ok(specialCompact.includes(`@media ${landscape}{`),'Phone Landscape CSS query drifted');

  assert.deepEqual(importsOf(uiCommon),[],'ui-common must keep responsive predicate local to Main graph');
  assert.deepEqual(importsOf(marketAi),['./dashboard-modal.js','./dashboard-market-ai-client.js'],'Market AI must remain standalone from the main feature graph while sharing only modal/client infrastructure');
  assert.doesNotMatch(index,/dashboard-responsive\.js/);
});

test('Topbar 날짜 년월/일 select는 같은 width token을 공유한다',()=>{
  assert.match(common1,/--topbar-date-select-width:[^;]+/);
  assert.match(common1,/\.month-select\{min-width:var\(--topbar-date-select-width\);flex:0 0 var\(--topbar-date-select-width\)\}/);
  assert.match(common1,/\.day-select\{min-width:var\(--topbar-date-select-width\);flex:0 0 var\(--topbar-date-select-width\)\}/);
});

test('Table summary/sticky/scroll contract는 semantic token과 Phone sticky seam 책임을 분리한다',()=>{
  assert.match(common1,/--data-table-summary-bg:var\(--summary-row-bg\)/);
  assert.match(common1,/--data-table-summary-weight:var\(--type-weight-strong\)/);
  assert.match(common1,/\.dashboard-data-table tbody \.summary-row > :is\(th,td\)\{ background:var\(--data-table-summary-bg\); font-weight:var\(--data-table-summary-weight\); border-top:var\(--data-table-summary-border\)/);
  assert.doesNotMatch(common,/data-table-summary-sticky-shadow/);
  assert.match(special1,/position:-webkit-sticky; position:sticky/);
  assert.match(special1,/tbody tr\.summary-row > :first-child\{z-index:4;background:var\(--data-table-summary-bg\);border-top:0;box-shadow:inset 0 1px 0 var\(--table-column-line\)\}/);
});

test('Table component는 전역 base 없이 semantic table shell과 viewport source gap을 공유한다',()=>{
  const tablet1=compact(tablet);
  assert.match(common1,/\.dashboard-data-table\{[^}]*border-collapse:separate;[^}]*background:var\(--card\);[^}]*border-radius:min\(var\(--surface-radius-level-3\),var\(--corner-surface-cap\)\)/);
  assert.match(common1,/\.dashboard-data-table th, \.dashboard-data-table td\{[^}]*border-right:1px solid var\(--table-column-line\);[^}]*border-bottom:1px solid var\(--line\)/);
  assert.match(common1,/\.dashboard-data-table \.num\{text-align:right;font-variant-numeric:tabular-nums\}/);
  assert.doesNotMatch(common,/^table\{/m);
  assert.doesNotMatch(common,/^td\.num\{/m);
  assert.doesNotMatch(print,/^\s*table\{/m);
  assert.match(print,/\.dashboard-data-table\{\s*box-shadow:none;/);
  assert.match(common1,/--source-table-gap:var\(--space-5xl\)/);
  assert.match(tablet1,/--source-table-gap:var\(--space-4xl\)/);
  assert.match(special1,/--source-table-gap:var\(--space-2xl\)/);
  assert.match(uiCommon,/function renderDashboardDataTable\(/);
  assert.match(ui,/renderDashboardDataTable\(\{id:'combined-table-view'/);
  assert.match(ui,/renderDashboardDataTable\(\{id:'accounts-table-view'/);
  assert.match(ui,/renderDashboardDataTable\(\{wrapClass:'mobile-scroll source-table-scroll'/);
  assert.match(common1,/--interaction-row-bg:var\(--subtle-card\)/);
});

test('성과요약 KPI grid는 metric-grid 단일 base와 asset-summary role marker를 사용한다',()=>{
  assert.doesNotMatch(common,/\.cards\b/);
  assert.doesNotMatch(ui,/grid cards/);
  assert.doesNotMatch(pension,/grid cards/);
  assert.doesNotMatch(common,/--surface-pad-metric:/);
  assert.doesNotMatch(tablet,/--surface-pad-metric:/);
  assert.doesNotMatch(special,/--surface-pad-metric:/);
  assert.doesNotMatch(print,/--surface-pad-metric:/);
  assert.doesNotMatch(common1,/\.metric-grid > \.metric-card\{[^}]*padding:/);
  assert.match(ui,/class="grid metric-grid asset-summary-metric-grid"/);
  assert.match(pension,/class="grid metric-grid asset-summary-metric-grid"/);
  assert.doesNotMatch(pension,/pension-metric-grid/);
  assert.match(special1,/\.asset-summary-metric-grid\{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(special1,/\.asset-summary-metric-grid \.metric-sub-mobile\{display:inline\}/);
});

test('모바일 data card의 빈 label row는 불필요한 label markup을 렌더링하지 않는다',()=>{
  assert.match(uiCommon,/labelHtml=label==null\|\|label===''\?'':`<span class="data-list-card-label mobile-data-card-label">\$\{label\}<\/span>`/);
  assert.doesNotMatch(mobile,/note-only \.mobile-data-card-label\{display:none\}/);
  assert.match(ui,/stacked note-only/);
});

test('KPI·mini-card·모바일 data-list는 공통 typography token과 숫자 정렬 contract를 사용한다',()=>{
  const tablet1=compact(tablet);
  const mobile1=compact(mobile);
  assert.match(common1,/\.metric-card\{ --metric-label-size:[^;]+; --metric-value-size:[^;]+; --metric-sub-size:[^;]+; --metric-value-min-height:[^;}]+/);
  assert.match(common1,/\.metric-card \.value\{[^}]*line-height:var\(--type-line-tight\);[^}]*font-variant-numeric:tabular-nums/);
  assert.match(common1,/\.metric-grid > \.metric-card \.value\{ min-height:var\(--metric-value-min-height\)/);
  assert.match(tablet1,/\.metric-card\{ --metric-label-size:[^;]+; --metric-value-size:[^;]+; --metric-sub-size:[^;]+; --metric-value-min-height:[^;}]+/);
  assert.match(special1,/\.metric-card\{ --metric-label-size:[^;]+; --metric-value-size:[^;]+; --metric-sub-size:[^;]+; --metric-value-min-height:[^;}]+/);
  assert.doesNotMatch(special1,/metric-grid > \.metric-card \.value\{min-height:/);
  assert.match(common1,/\.mini-card \.m-value\{[^}]*font-variant-numeric:tabular-nums/);
  assert.match(tablet1,/--mini-detail-size:[^;]+/);
  assert.match(special1,/--mini-value-size:[^;]+; --mini-detail-size:[^;]+/);
  assert.match(common1,/\.data-list-card-value\{[^}]*font-variant-numeric:tabular-nums/);
  assert.doesNotMatch(mobile1,/\.mobile-data-card-value\{[^}]*font-variant-numeric/);
  assert.doesNotMatch(common,/^\.label\{/m);
  assert.doesNotMatch(common,/^\.value,/m);
});

test('모바일 표↔카드 전환은 단일 config·공통 card shell·viewport별 표현 책임을 사용한다',()=>{
  const mobile1=compact(mobile);
  assert.match(uiCommon,/const MOBILE_VIEW_CONFIG=Object\.freeze\(/);
  assert.doesNotMatch(uiCommon,/const MOBILE_VIEW_META=/);
  assert.match(uiCommon,/const mobileViewModes=Object\.fromEntries\(Object\.entries\(MOBILE_VIEW_CONFIG\)/);
  assert.match(uiCommon,/:not\(\[data-mobile-view-button\]\)/);
  assert.match(uiCommon,/function renderMobileCardView\(/);
  assert.equal((uiCommon.match(/renderMobileCardView\(/g)||[]).length,3);
  assert.equal((ui.match(/renderMobileCardView\(/g)||[]).length,2);
  assert.doesNotMatch(uiCommon,/<div id="\$\{idPrefix\}-card-view" class=/);
  assert.doesNotMatch(ui,/<div id="(?:combined|accounts)-card-view" class="mobile-card-view"/);
  assert.match(mobile1,/\[data-mobile-view="card"\] \.table-view\{display:none\}/);
  assert.match(special1,/\[data-mobile-view\] \.table-view\{display:block\}/);
  assert.match(special1,/\[data-mobile-view\] \.mobile-card-view\{display:none\}/);
  assert.doesNotMatch(special1,/\[data-mobile-view="card"\] \.table-view/);
});

test('자산 인사이트는 viewport token·공통 shell·CSS 소유 시각값을 사용한다',()=>{
  const tablet1=compact(tablet);
  assert.match(common1,/--asset-insight-zone-offset:var\(--space-[^)]+\); --asset-insight-stack-height:[^;]+; --asset-insight-risk-gauge-height:[^;}]+/);
  assert.match(tablet1,/--asset-insight-zone-offset:var\(--space-[^)]+\); --asset-insight-stack-height:[^;]+; --asset-insight-risk-gauge-height:[^;}]+/);
  assert.match(special1,/--asset-insight-zone-offset:var\(--space-[^)]+\); --asset-insight-stack-height:[^;]+; --asset-insight-risk-gauge-height:[^;}]+/);
  assert.match(common1,/\.asset-insight-zone\{[^}]*margin-top:var\(--asset-insight-zone-offset\)/);
  assert.match(common1,/\.asset-stack-bar\{[^}]*height:var\(--asset-insight-stack-height\)/);
  assert.match(common1,/\.pension-risk-gauge\{[^}]*height:var\(--asset-insight-risk-gauge-height\)/);
  assert.match(common1,/\.asset-stack-segment\{[^}]*width:var\(--asset-segment-share,0%\);[^}]*background:var\(--asset-segment-color,transparent\)/);
  assert.match(common1,/\.pension-risk-fill\{[^}]*width:var\(--pension-risk-ratio,0%\)/);
  assert.match(common1,/\.pension-risk-threshold\{[^}]*left:var\(--pension-risk-threshold-position,70%\)/);
  assert.match(common1,/\.pension-risk-gauge \.asset-viz-tooltip\{ bottom:calc\(100% \+ var\(--tooltip-stack-anchor-gap\)\)/);
  assert.match(common1,/\.asset-stack-segment:first-child\{ border-top-left-radius:var\(--radius-pill\);/);
  assert.match(uiCommon,/function renderAssetInsightCard\(/);
  assert.match(uiCommon,/function renderAssetInsightZone\(/);
  const contributionRenderer=uiCommon.match(/function renderAssetContributionCard\([\s\S]*?\n}\r?\n\r?\n\/\/ \[UICOMMON05\]/)?.[0]||'';
  assert.doesNotMatch(contributionRenderer,/cardClass=|headClass=|stackClass=|segmentClass=|tooltipClass=|emptyNoItemsClass=/);
  assert.doesNotMatch(contributionRenderer,/asset-insight-head simple|asset-stack-bar compact|pension-risk-gauge compact/);
  assert.match(uiCommon,/--asset-segment-share:/);
  assert.match(uiCommon,/\(hover: none\), \(pointer: coarse\)/);
  assert.match(ui,/renderAssetInsightZone\(\{label:'증권계좌 인사이트'/);
  assert.match(pension,/renderAssetInsightCard\(\{idPrefix:'pensionRisk'/);
  assert.match(pension,/renderAssetInsightZone\(\{label:'퇴직연금 인사이트'/);
  assert.match(special1,/:is\(\.asset-stack-segment:first-child,\.asset-stack-segment:last-child\) \.asset-viz-tooltip/);
});

test('Mini summary와 source card는 presentation helper 하나를 공유하고 Main dead class를 남기지 않는다',()=>{
  assert.match(charts,/function cumulativeSummaryCards\(/);
  assert.match(charts,/cumulativeSummaryCards\(\{profitLabel:'누적손익'/);
  assert.match(charts,/cumulativeSummaryCards\(\{profitLabel:'운용손익'/);
  assert.match(charts,/function symbolSummaryCard\(/);
  assert.match(charts,/function symbolCard\(h,total\)\{return symbolSummaryCard/);
  assert.match(charts,/function pensionProductCard\(h,total\)\{return symbolSummaryCard/);
  assert.match(ui,/function sourceCard\(/);
  assert.match(ui,/sourceCard\('전체 투입원금'/);
  assert.doesNotMatch(ui,/summary-card/);
  assert.doesNotMatch(read('js/dashboard-pension.js'),/summary-card/);
  assert.match(common1,/\.symbol-metrics\{ display:grid; gap:var\(--space-2xs\); margin-top:var\(--card-text-rhythm-gap\); padding-top:var\(--card-text-rhythm-gap\)/);
  assert.match(common1,/\.phone-chart-ui \.security-alloc-card-grid > \.alloc-total-card\{[^}]*column-gap:clamp\(3px,\.45vw,6px\)/);
});

test('Chart geometry는 CHART_FRAME 단일 Source of Truth를 사용한다',()=>{
  assert.match(charts1,/const CHART_FRAME=Object\.freeze\(\{left:70,right:70,top:20,bottom:70\}\)/);
  assert.equal((charts.match(/const CHART_FRAME=/g)||[]).length,1);
  assert.match(charts1,/const minWidth=CHART_FRAME\.left\+CHART_FRAME\.right\+1/);
  assert.match(charts1,/plotW:Math\.max\(0,normalViewW-CHART_FRAME\.left-CHART_FRAME\.right\)/);
});

test('Chart shell은 공통 renderer·display token·정적 SVG visual source를 사용한다',()=>{
  const tablet1=compact(tablet),mobile1=compact(mobile);
  assert.match(charts,/function renderChartCard\(/);
  assert.equal((charts.match(/\$\{renderChartCard\(\{/g)||[]).length,6);
  assert.match(charts1,/const CHART_VISUAL=Object\.freeze\(\{ axisFontSize:11, dateFontSize:10/);
  assert.match(charts1,/font-size':chartExpandedFixedUnits\(svg,CHART_VISUAL\.axisFontSize\)/);
  assert.match(charts1,/stroke-dasharray':CHART_VISUAL\.hoverDash/);
  assert.match(common1,/--chart-svg-min-width:[^;]+; --chart-svg-height:[^;]+; --chart-svg-radius:var\(--surface-radius-level-4\); --chart-accent-height:[^;]+; --chart-accent-opacity:[^;}]+/);
  assert.match(common1,/svg\.chart\{[^}]*min-width:var\(--chart-svg-min-width\); height:var\(--chart-svg-height\);[^}]*border-radius:min\(var\(--chart-svg-radius\)/);
  assert.match(tablet1,/--chart-svg-min-width:100%/);
  assert.doesNotMatch(charts,/has-horizontal-scroll/);
  assert.match(tablet,/\.chart-grid \.chart-wrap\{/);
  assert.doesNotMatch(mobile,/\.chart-card::before/);
  assert.match(common1,/\.chart-title-sub\{ display:inline; align-self:flex-end;/);
});

test('증권·퇴직연금 6개 차트 제목은 공통 label primitive를 사용하고 info 유무가 제목 geometry를 바꾸지 않는다',()=>{
  assert.equal((charts.match(/\$\{renderChartCard\(\{/g)||[]).length,6);
  assert.match(charts1,/function chartTitleLabel\(title,\{sub='',info=''\}=\{\}\)\{/);
  assert.match(charts1,/\$\{chartTitleLabel\(title,\{sub:titleSub,info:titleInfo\}\)\}/);
  assert.match(charts1,/id:'pension-chart-cum',title:'운용손익 및 운용수익률',titleSub:'전체 운용 기준',titleInfo:'전체 운용 기준'/);
  assert.match(charts1,/id:'pension-chart-symbol',title:'연금상품별 운용손익',titleSub:'보유상품 재투자 기준',titleInfo:'보유상품 재투자 기준'/);
  assert.doesNotMatch(charts,/title:`[^`]*chart-title-sub/);
  assert.match(common1,/--section-title-line-height:1;/);
  assert.match(common1,/--section-title-icon-optical-shift:-1\.5px;/);
  assert.equal((common1.match(/--section-title-icon-optical-shift/g)||[]).length,2);
  assert.match(common1,/:is\(\.section-title :is\(h2,h3\),\.chart-head h3\)\{[^}]*align-items:center;[^}]*line-height:var\(--section-title-line-height\);/);
  assert.doesNotMatch(common1,/:is\(\.section-title :is\(h2,h3\),\.chart-head h3\) > \.section-title-icon\{[^}]*margin-bottom:/);
  assert.match(common1,/:is\(\.section-title :is\(h2,h3\),\.chart-head h3\) > \.section-title-icon, \.chart-head h3 \.chart-title-info-slot\{ transform:translateY\(var\(--section-title-icon-optical-shift\)\); \}/);
  assert.doesNotMatch(compact(tablet+mobile+special+print),/--section-title-icon-optical-shift:/);
  assert.match(common1,/\.chart-title-label\{ display:inline-flex; align-items:center; gap:var\(--section-title-gap\); min-width:0; line-height:inherit; \}/);
  assert.match(common1,/\.chart-title-text\{min-width:0;line-height:inherit\}/);
  assert.match(common1,/\.chart-title-info-slot\{display:none\}/);
  assert.match(common1,/\.compact-chart-ui \.chart-title-info-slot\{ display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; height:1lh; line-height:inherit; \}/);
  assert.match(common1,/\.compact-chart-ui \.chart-title-info\{ display:inline-flex; z-index:12; \}/);
  assert.doesNotMatch(common1,/\.compact-chart-ui \.chart-title-info\{[^}]*margin-(?:top|bottom|left|right):/);
  assert.doesNotMatch(common1,/\.compact-chart-ui \.chart-title-info-slot\{[^}]*transform:/);
  assert.match(compact(print),/\.compact-chart-ui \.chart-title-info-slot,/);
  assert.doesNotMatch(print,/^[ \t]*\.chart-title-info,/m);
});

test('Chart summary는 allocation presentation helper와 viewport meta token을 사용한다',()=>{
  const tablet1=compact(tablet);
  assert.match(charts,/function allocationValueCard\(/);
  assert.match(charts,/function allocationTotalCard\(/);
  assert.match(charts,/allocationValueCard\('ETF'/);
  assert.match(charts,/allocationTotalCard\(won\(x\.pensionEval\)/);
  assert.match(common1,/--allocation-ratio-meta-size:var\(--type-size-xs\); --allocation-cash-meta-size:var\(--type-size-xs\)/);
  assert.match(common1,/\.mini-card \.alloc-ratio-meta\{font-size:var\(--allocation-ratio-meta-size\)\}/);
  assert.match(tablet1,/--allocation-ratio-meta-size:[^;]+; --allocation-cash-meta-size:[^;}]+/);
  assert.match(special1,/--allocation-ratio-meta-size:[^;]+; --allocation-cash-meta-size:[^;}]+/);
  assert.match(special1,/--symbol-metric-value-size:[^;]+/);
  assert.match(common1,/\.allocation-total-card\{ display:grid; grid-template-columns:max-content minmax\(0,max-content\)/);
  assert.doesNotMatch(tablet,/#pension-chart-alloc \.chart-note/);
});

test('장부·원천 검산은 source row helper, wrapper gap token, 인쇄 layout을 사용한다',()=>{
  const tablet1=compact(tablet),print1=compact(print);
  assert.match(ui,/function sourceTableRow\(/);
  assert.match(ui,/sourceTableRow\('금 판매액 총액'/);
  assert.match(ui,/sourceTableRow\('합계',externalPrincipal,\{summary:true\}\)/);
  assert.doesNotMatch(ui,/section-explainer table-note cash-basis-note/);
  assert.match(common1,/--source-reclass-note-size:var\(--type-size-sm\)/);
  assert.match(common1,/:is\(\.asset-insight-card,\.source-card\)\{ padding:var\(--surface-pad-medium\); \}/);
  assert.match(common1,/\.source-card\{ min-width:0; border-radius:/);
  assert.doesNotMatch(common1,/\.source-card\{[^}]*padding:/);
  assert.match(common1,/\.source-reclass-note\{[^}]*font-size:var\(--source-reclass-note-size\)/);
  assert.match(common1,/\.source-table-scroll\{margin-top:var\(--source-table-gap\);border-radius:0\}/);
  assert.match(tablet1,/--source-table-gap:var\(--space-4xl\); --source-reclass-note-size:[^;}]+/);
  assert.match(special1,/--source-table-gap:var\(--space-2xl\); --source-reclass-note-size:var\(--type-size-xs\)/);
  assert.doesNotMatch(tablet,/\.dashboard-data-table\{\s*--source-table-gap:/);
  assert.doesNotMatch(special,/\.dashboard-data-table\{\s*--source-table-gap:/);
  assert.match(print1,/#ledger-check \.ledger-overview-grid\{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(print1,/#capital-source-check \.source-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
});

test('Hero KPI와 navigation hover는 foreground·입력장치 책임을 분리한다',()=>{
  assert.match(common1,/\.pillbar\{ position:relative; z-index:1; display:flex;/);
  assert.match(common1,/:is\(\.desktop-edge-toc-item,\.date-action-menu\.mobile-combined-menu \.mobile-nav-item\):focus-visible\{background:var\(--nav-surface-hover\)\}/);
  assert.doesNotMatch(common,/:is\(\.desktop-edge-toc-item,\.date-action-menu\.mobile-combined-menu \.mobile-nav-item\):hover,/);
  assert.match(interaction,/@media \(hover:hover\) and \(pointer:fine\)\{[^]*?:is\(\.desktop-edge-toc-item,\.date-action-menu\.mobile-combined-menu \.mobile-nav-item\):hover\{[\s\S]*?background:var\(--nav-surface-hover\)/);
  assert.match(interaction,/@media \(hover:hover\) and \(pointer:fine\) and \(min-width:1101px\)\{[^]*?\.desktop-edge-toc:hover \.desktop-edge-toc-panel/);
});

test('반응형·테마·Print는 semantic source와 인쇄 canonical layout을 유지한다',()=>{
  const tablet1=compact(tablet),mobile1=compact(mobile),print1=compact(print);
  assert.doesNotMatch(common,/--modal-overlay:/);
  assert.doesNotMatch(common,/table-positive|table-negative|nav-current-icon|special-profit-control|special-profit-note/);
  assert.match(common1,/--mini-card-bg:var\(--subtle-card\)/);
  assert.match(common1,/\.bar-fill\{ width:var\(--asset-bar-width,0%\);[^}]*background:var\(--asset-bar-color,var\(--meter-neutral\)\)/);
  assert.match(common1,/\.swatch\{[^}]*background:var\(--chart-legend-color,transparent\)/);
  assert.match(uiCommon,/--asset-bar-width:/);
  assert.doesNotMatch(uiCommon,/style=\"\$\{fillStyle\}\"[^]*background:/);
  assert.match(charts,/style=\"--chart-legend-color:\$\{item\.color\}\"/);
  assert.doesNotMatch(charts,/style=\"background:/);
  assert.doesNotMatch(core,/tableCls/);
  assert.doesNotMatch(ui,/tableCls/);
  assert.doesNotMatch(pension,/tableCls/);
  assert.match(tablet1,/:is\(\.contrib-modal,\.action-modal\)\{--modal-card-radius:min\([^,]+,var\(--corner-surface-cap\)\)\}/);
  assert.doesNotMatch(tablet,/--pension-modal-row-height:28px/);
  assert.doesNotMatch(mobile,/--modal-overlay-pad|--modal-card-radius|\.chart-card::before/);
  assert.doesNotMatch(special,/--modal-overlay-pad:20px|--pension-modal-row-height:28px/);
  assert.match(special1,/\.action-modal\{--modal-control-font-size:var\(--type-size-2xl\)\}/);
  assert.match(print1,/html, html\.dark\{ color-scheme:light;/);
  assert.match(print1,/\.hero \.hero-return-pill\{display:inline-flex\}/);
  assert.match(print1,/\.metric-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/);
  assert.match(common1,/html\.print-light-theme\{ color-scheme:light; --chart-surface:#ffffff;/);
  assert.match(charts,/document\.documentElement\.classList\.add\('print-light-theme'\)/);
  assert.match(charts,/document\.documentElement\.classList\.remove\('print-light-theme'\)/);
  assert.match(print1,/\.chart-note\.six\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(common1,/\.positive\{color:var\(--value-positive\)\} \.negative\{color:var\(--value-negative\)\}/);
});

test('계좌 control·Print 표·Phone 위험도·목차·PIN 계약을 유지한다',()=>{
  const mobile1=compact(mobile),print1=compact(print);
  assert.match(mobile1,/\[data-accounts-view-toggle-wrap\]:not\(\[hidden\]\)\{display:inline-flex\}/);
  assert.doesNotMatch(mobile1,/\[data-accounts-view-toggle-wrap\][^{]*\{[^}]*order:/);
  assert.match(ui1,/\$\{separateProfitControl\(x,'section-inline'\)\}<span data-accounts-view-toggle-wrap\$\{accountsMode\?'':' hidden'\}>\$\{mobileViewToggle\('accounts'\)\}<\/span>\$\{securitiesPerformanceViewSwitch\(\)\}/);
  assert.match(print1,/#accounts-summary \.accounts-table\{ width:100%; min-width:0; max-width:100%; table-layout:fixed;/);
  assert.match(print1,/#accounts-summary \.accounts-table :is\(th,td\):first-child\{width:17%\}/);
  assert.match(special1,/\.pension-risk-threshold span\{top:calc\(100% \+ var\(--space-2xs\)\)\}/);
  assert.match(common1,/\.mobile-nav-head\{[^}]*border-bottom:1px solid var\(--nav-divider\)/);
  assert.match(common1,/\.desktop-edge-toc-title \+ \.desktop-edge-toc-group\{/);
  for(const source of [ui,pensionEditor]){
    assert.doesNotMatch(source,/type=["']password["']/i);
    assert.match(source,/input[^>]+inputmode=["']numeric["'][^>]+autocomplete=["']off["']/i);
  }
});

test('Surface radius 4계층은 Desktop·Tablet과 Phone Shared에서 같은 line contract를 사용한다',()=>{
  const print1=compact(print);
  assert.match(common1,/--surface-radius-level-1:18px; --surface-radius-level-2:16px; --surface-radius-level-3:14px; --surface-radius-level-4:12px;/);
  assert.match(common1,/--surface-radius-outer:var\(--surface-radius-level-1\); --surface-radius-large:var\(--surface-radius-level-2\); --surface-radius-mini:var\(--surface-radius-level-3\);/);
  assert.doesNotMatch(common1,/--surface-radius-medium:/);
  assert.match(special1,/--surface-radius-level-1:16px; --surface-radius-level-2:14px; --surface-radius-level-3:12px; --surface-radius-level-4:12px;/);
  assert.doesNotMatch(common1,/--surface-radius-(?:lg|md|sm|xs):/);
  assert.doesNotMatch(special,/--surface-radius-outer:20px|--hero-radius:var\(--surface-radius-sm\)/);
  assert.match(common1,/\.asset-workspace-tabs\{[^}]*border-radius:min\(var\(--surface-radius-level-1\),var\(--corner-surface-cap\)\)/);
  assert.match(common1,/#summary-section :is\(\.mobile-scroll,\.combined-performance-table\)\{border-radius:min\(var\(--surface-radius-level-1\),var\(--corner-surface-cap\)\)\}/);
  assert.match(common1,/#accounts-summary :is\(\.mobile-scroll,\.accounts-table\)\{border-radius:min\(var\(--surface-radius-level-2\),var\(--corner-surface-cap\)\)\}/);
  assert.match(common1,/\.source-card\{[^}]*border-radius:min\(var\(--surface-radius-level-2\),var\(--corner-surface-cap\)\)/);
  assert.match(common1,/\.asset-insight-card\{ border-radius:min\(var\(--surface-radius-level-3\),var\(--corner-surface-cap\)\)/);
  assert.match(common1,/\.change-table-wrap\{[^}]*border-radius:min\(var\(--surface-radius-level-3\),var\(--corner-surface-cap\)\)\}/);
  assert.match(print1,/--surface-radius-level-1:18px; --surface-radius-level-2:16px; --surface-radius-level-3:14px; --surface-radius-level-4:12px;/);
});

test('Chart legend는 전체선택/다중선택을 지원하되 마지막 1개는 해제하지 않는다',()=>{
  assert.match(charts1,/if\(key==='__all__'\)\{ selection\.state\.selected=null;/);
  assert.match(charts1,/if\(next\.has\(key\)\)\{ if\(next\.size<=1\)return; next\.delete\(key\);/);
  assert.match(charts1,/aria-pressed="\$\{active\}"/);
});

test('Chart 확대는 별도 state 복제가 아니라 기존 SVG/controls/options/legend를 이동 후 복원한다',()=>{
  assert.match(charts1,/document\.createComment\('expanded-chart-legend-placeholder'\)/);
  assert.match(charts1,/expandedLegendHost\.appendChild\(legend\)/);
  assert.match(charts1,/legendPlaceholder\?\.parentNode\)legendPlaceholder\.parentNode\.insertBefore\(legend,legendPlaceholder\)/);
  assert.match(charts1,/chartRuntimeState\.expanded=\{overlay,svg,placeholder/);
});

test('Modal lifecycle는 focus trap / focus return / inert / ESC를 공통 layer에서 관리한다',()=>{
  assert.match(modal1,/element\.inert=true/);
  assert.match(modal1,/state\.inertSnapshot\.forEach/);
  assert.match(modal1,/event\.key!=='Escape'/);
  assert.match(modal1,/const first=focusables\[0\],last=focusables\.at\(-1\),active=document\.activeElement/);
  assert.match(modal1,/target\?\.focus\?\.\(\{preventScroll:true\}\)/);
});

test('Market AI contract: KOSPI200 선물 / SOX 현물 / NQ100 선물 symbol을 고정한다',()=>{
  assert.match(marketAi,/MARKET_AI_KIS_FUTURES_SYMBOL='FUTURES:KOSPI200'/);
  assert.match(marketAi,/MARKET_AI_SOX_INDEX_SYMBOL='INDEX:SOX'/);
  assert.match(marketAi,/MARKET_AI_NASDAQ100_FUTURES_SYMBOL='FUTURES:NQ'/);
  assert.doesNotMatch(marketAi,/FUTURES:SOX/);
});

test('Market AI contract: local은 :8001, remote는 Tailscale Serve를 공통 client에서 사용한다',()=>{
  assert.match(marketAiClient,/LOCAL_DASHBOARD_HOSTS=new Set\(\['localhost','127\.0\.0\.1'\]\)/);
  assert.match(marketAiClient,/MARKET_AI_REMOTE_BASE='https:\/\/node\.tail60a98e\.ts\.net'/);
  assert.match(marketAiClient,/return `\$\{location\.protocol\}\/\/\$\{location\.hostname\}:8001`/);
});

test('Market AI contract: remote 전체 실패는 UI 미노출, local 전체 실패는 연결 확인 중을 유지한다',()=>{
  assert.match(market1,/if\(!marketAiLocalMode\(\)&&marketAiState\.serverReachable!==true\)\{ removeMarketAiUi\(\); return;/);
  assert.match(market1,/if\(!serverReachable\)\{ if\(!marketAiLocalMode\(\)\)\{ removeMarketAiUi\(\); return; \} setMarketAiState\(\{ signal:null, status:'연결 확인 중'/);
});

test('Market AI refresh는 3 endpoint를 독립 호출하고 최신 refresh sequence만 state에 반영한다',()=>{
  assert.match(market1,/const \[signalResult,nextMarketSnapshot,nextBridgeStatus\]=await Promise\.all\(\[/);
  assert.match(market1,/const serverReachable=signalResult!==null\|\|nextMarketSnapshot!==null\|\|nextBridgeStatus!==null/);
  assert.match(market1,/let marketAiRefreshSequence=0/);
  assert.match(market1,/if\(refreshSequence!==marketAiRefreshSequence\)return/);
  assert.match(market1,/const \{response,signal,parseError\}=signalResult/);
  assert.match(market1,/if\(parseError\)\{ setMarketAiState/);
});

test('Market AI는 main dataState/uiState를 참조하지 않는 standalone state를 유지한다',()=>{
  assert.doesNotMatch(marketAi,/\bdataState\b/);
  assert.doesNotMatch(marketAi,/\buiState\b/);
  assert.match(marketAi,/const marketAiState=\{/);
});

test('CSS contract: 운영 CSS에는 !important override를 두지 않는다',()=>{
  for(const [name,source] of Object.entries({common,tablet,mobile,special,interaction})){
    assert.doesNotMatch(source,/!important/,`${name}.css contains !important`);
  }
});

test('CSS 책임 분리: Desktop baseline은 common, Tablet/Mobile은 전용 파일, 예외는 special에 존재한다',()=>{
  assert.match(common,/Desktop baseline/i);
  assert.match(tablet,/Tablet/i);
  assert.match(mobile,/Mobile/i);
  assert.match(special,/Compact Desktop|Phone UI Shared|Phone Landscape/);
});

test('강제 웹보기 contract: 스마트폰 web 요청은 1280, tablet 요청은 961 viewport를 사용한다',()=>{
  assert.match(index1,/if\(dashboardView==='web'\)forcedViewport=1280/);
  assert.match(index1,/if\(dashboardView==='tablet'\)forcedViewport=961/);
  assert.match(index1,/if\(desktopAppleUA&&touchApple&&shortSide<=500\)\{ if\(viewport\)viewport\.setAttribute\('content','width=1280'\); \}/);
  assert.doesNotMatch(index1,/iphone-request-desktop/);
  assert.doesNotMatch(common,/iphone-request-desktop/);
});

test('Chart responsive ownership은 공통 Phone helper·responsive CSS 책임·generic info token·expanded geometry source를 유지한다',()=>{
  const commonNarrow=common.slice(common.indexOf('@media (max-width:1100px){'));
  const tablet1=compact(tablet),print1=compact(print);

  assert.match(charts1,/function portraitPhoneChartFlow\(\)\{ return phoneUi\(\)&&!phoneLandscapeUi\(\); \}/);
  assert.doesNotMatch(charts,/max-width:760px/);

  assert.doesNotMatch(commonNarrow,/chart-expanded-stage|chart-expanded-legend-host|chart-wrap\.is-scrollable|pension-cash-detail/);
  assert.match(special,/@media \(max-width:1100px\)\{[\s\S]*?\.chart-expanded-stage\{/);
  assert.match(tablet1,/\.chart-wrap\.is-scrollable\{ border-right:2px solid var\(--scroll-edge-border\); box-shadow:var\(--scroll-edge-shadow-compact\); \}/);
  assert.match(special1,/\.chart-wrap\.is-scrollable\{ border-right:2px solid var\(--scroll-edge-border\); box-shadow:var\(--scroll-edge-shadow-compact\); \}/);
  assert.match(tablet1,/#pension-chart-alloc \.pension-cash-detail-full\{display:none\} #pension-chart-alloc \.pension-cash-detail-compact\{display:block\}/);
  assert.match(special1,/#pension-chart-alloc \.pension-cash-detail-full\{display:none\} #pension-chart-alloc \.pension-cash-detail-compact\{display:block\}/);

  assert.doesNotMatch(common,/--chart-info-/);
  assert.doesNotMatch(print,/--chart-info-/);
  assert.doesNotMatch(common,/--info-control-border:/);
  assert.match(common1,/--info-control-bg:var\(--card\); --info-control-color:var\(--muted\)/);
  assert.match(common1,/\.control-info-button\{[^}]*border:0;[^}]*background:var\(--info-control-bg\); color:var\(--info-control-color\)/);
  assert.match(common1,/\.control-info-button \.info-icon-svg\{[^}]*width:100%;height:100%/);
  assert.doesNotMatch(common1,/\.compact-chart-ui \.chart-title-info\{[^}]*border-width:/);
  assert.match(compact(uiCommon),/INFO_ICON_USE_HREF='img\/ui-icons\.svg#info-circle'/);
  assert.match(charts1,/\$\{infoIconSvg\(\)\}<span class="chart-title-info-tooltip"/);
  assert.match(ui1,/\$\{infoIconSvg\(\)\}<span class="accounts-memo-tooltip-source"/);
  assert.doesNotMatch(charts,/aria-hidden="true">i<\/span>/);
  assert.doesNotMatch(ui,/aria-hidden="true">i<\/span>/);
  assert.match(print1,/--info-control-bg:var\(--card\); --info-control-color:var\(--muted\)/);

  assert.match(common1,/\.chart-expanded-stage\{ --chart-expanded-pad-block-start:[^;]+; --chart-expanded-pad-inline-end:[^;]+; --chart-expanded-pad-block-end:var\(--space-7xl\); --chart-expanded-pad-inline-start:var\(--space-10xl\);/);
  assert.match(common1,/padding:var\(--chart-expanded-pad-block-start\) var\(--chart-expanded-pad-inline-end\) var\(--chart-expanded-pad-block-end\) var\(--chart-expanded-pad-inline-start\)/);
  assert.match(special1,/\.chart-expanded-overlay\.device-landscape \.chart-expanded-stage\{ --chart-expanded-pad-inline-end:[^;]+;/);
  assert.doesNotMatch(common,/padding:20px 68px/);
  assert.doesNotMatch(special,/padding:var\(--space-4xl\) 52px/);
});


test('Pension/Modal/특수 UI는 shared radius·semantic form·modal motion·Phone/Print/Desktop contract를 유지한다',()=>{
  const tablet1=compact(tablet),mobile1=compact(mobile),interaction1=compact(interaction),print1=compact(print),pensionEditor1=compact(pensionEditor);

  assert.equal((common.match(/--modal-card-radius:/g)||[]).length,1);
  assert.match(common1,/:is\(\.contrib-modal,\.action-modal\)\{[^}]*--modal-card-radius:min\([^,]+,var\(--corner-surface-cap\)\)/);
  assert.equal((tablet.match(/--modal-card-radius:/g)||[]).length,1);
  assert.match(tablet1,/:is\(\.contrib-modal,\.action-modal\)\{--modal-card-radius:min\([^,]+,var\(--corner-surface-cap\)\)\}/);

  assert.doesNotMatch(common,/\.contrib-field\.full/);
  assert.doesNotMatch(pensionEditor1,/contrib-field full/);
  assert.doesNotMatch(common1,/pension-cash-memo-field\{grid-area:cash-memo;grid-column:auto\}/);
  assert.doesNotMatch(common1,/pension-trade-(?:date|product)-field\{[^}]*grid-column:auto/);

  assert.doesNotMatch(common,/\.action-modal button:hover/);
  assert.match(interaction1,/button:not\(:disabled\):hover\{ transform:translateY\(-1px\); \} \/\* Modal Motion Guard[^]*\.contrib-modal\.show button:hover, \.action-modal button:hover\{ transform:none; \}/);

  assert.doesNotMatch(mobile,/--modal-card-width/);
  assert.match(special1,/:is\(\.contrib-modal,\.action-modal\)\{ --modal-overlay-pad:var\(--space-5xl\); --modal-card-radius:min\([^,]+,var\(--corner-surface-cap\)\)/);

  assert.doesNotMatch(print,/aspect-ratio\s*:\s*1120\s*\/\s*330/);
  assert.doesNotMatch(print,/1120\s*[:/]\s*330/);
  assert.match(print1,/svg\.chart\{ width:100%; max-width:100%; min-width:0; height:auto; \}/);
  assert.match(charts1,/if\(chartRuntimeState\.printFixedViewBox\)return \{w:CHART_VIEWBOX_BASE\.width,h\}/);

  assert.doesNotMatch(index1,/iphone-request-desktop/);
  assert.doesNotMatch(common,/iphone-request-desktop/);
});

test('자산 시각화 Tooltip은 setup·pointer binding·click binding·follow/touch lifecycle 책임을 분리한다',()=>{
  assert.match(uiCommon,/function createAssetVizTooltipState\(\)/);
  assert.match(uiCommon,/function positionAssetStackTooltip\(state,target,event\)/);
  assert.match(uiCommon,/function finishAssetTouchDrag\(state,event,cancelled=false\)/);
  assert.match(uiCommon,/function bindAssetTooltipPointerInteractions\(state\)/);
  assert.match(uiCommon,/function bindAssetTooltipClickInteractions\(state\)/);
  const setup=uiCommon.match(/function setupAssetVizTooltips\(zoneSelector\)\{([^}]*)\}/)?.[1]||'';
  assert.match(setup,/bindAssetTooltipPointerInteractions\(state\)/);
  assert.match(setup,/bindAssetTooltipClickInteractions\(state\)/);
  assert.doesNotMatch(setup,/addEventListener/,'setup 함수가 다시 세부 listener 구현을 직접 소유하면 안 된다');
});

test('보유종목/연금상품 현재가 출처는 기존 dash-tooltip surface를 재사용하고 별도 CSS를 추가하지 않는다',()=>{
  assert.match(uiCommon,/const ASSET_SOURCE_TOOLTIP_ID='assetPriceSourceTooltip'/);
  assert.match(uiCommon,/tooltip\.className='dash-tooltip'/);
  assert.match(uiCommon,/function renderAssetPriceSourceLabel\(/);
  assert.match(uiCommon,/data-asset-source-tooltip/);
  assert.match(app,/setupAssetSourceTooltips\(\)/);
  assert.match(ui,/renderAssetPriceSourceLabel\(/);
  assert.match(pension,/renderAssetPriceSourceLabel\(/);
  assert.match(ui,/account1_daily_snapshots\.json/);
  assert.match(pension,/fallbackSource:'prices\.json'/);
  assert.equal((common.match(/assetPriceSourceTooltip|asset-source-tooltip|asset-source/g)||[]).length,0,'출처 tooltip 전용 CSS를 추가하면 안 된다');
});

test('현재가 출처 tooltip은 표의 라벨 텍스트뿐 아니라 라벨 셀 전체를 hover hit-area로 사용한다',()=>{
  assert.match(uiCommon,/function assetSourceTooltipTargetFromEvent\(event,selector\)/);
  assert.match(uiCommon,/closest\?\.\('th\[scope=\"row\"\]'\)\?\.querySelector\(selector\)/);
  assert.match(uiCommon,/function assetSourceTooltipHitArea\(target\)/);
  assert.match(uiCommon,/closest\?\.\('th\[scope=\"row\"\]'\)\|\|target/);
});

test('live valuation 재렌더는 퇴직연금 조정 본체와 action modal이 열려 있는 동안 모두 보류한다',()=>{
  assert.match(liveValuation,/\.action-modal\.show,\.contrib-modal\.show,dialog\[open\]/);
});


test('Hero 현재가 상태는 기존 hero-basis typography로 LIVE/CLOSED/STALE/JSON 의미를 표시하고 전용 CSS를 만들지 않는다',()=>{
  assert.match(core,/function liveValuationStatusForDate\(date\)/);
  assert.match(app,/function liveValuationStatusText\(date\)/);
  assert.match(app,/CLOSED \$\{status\.usableCount\}\/\$\{status\.requestedCount\}/);
  assert.match(app,/LIVE \$\{status\.usableCount\}\/\$\{status\.requestedCount\}/);
  assert.match(app,/STALE → JSON/);
  assert.match(app,/status\.marketState==='closed'\)return 'JSON · 장마감'/);
  assert.match(app,/JSON · WARMING/);
  assert.match(app,/JSON · 과거 저장 데이터/);
  assert.match(app,/data-live-valuation-status/);
  assert.equal((common.match(/live-valuation-status|live-source-status/g)||[]).length,0,'상태 표시 전용 CSS를 추가하면 안 된다');
});
