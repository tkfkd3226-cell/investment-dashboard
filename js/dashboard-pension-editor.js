import {
  DASHBOARD_WRITE_CONFIG,
  dataState,
  fetchWithTimeout,
  fmt,
  kstTodayText,
  linkedPensionCashSnapshotForContribution,
  linkedPensionCashSnapshotForTrade,
  pensionBaseCashForDate,
  pensionCashBeforeNewTrade,
  pensionCashSnapshotItems,
  pensionCashSnapshotReflectsContribution,
  pensionCashSnapshotReflectsTrade,
  pensionContributionItems,
  pensionPositionState,
  pensionTradeItems,
  rawPensionCashSnapshotItems,
  rawPensionContributionItems,
  rawPensionTradeItems,
  readJsonResponse,
  won
} from './dashboard-core.js';
import {
  escapeHtml,
  forceMobileViewportReflow,
  navIconSvg,
  showAppToast
} from './dashboard-ui-common.js';
import {
  bindDashboardModalDismiss,
  closeDashboardModal,
  openDashboardModal
} from './dashboard-modal.js';

// Pension Editor · 금액조정 / PIN / batch / persistence
// Structure map:
//   [PEDIT01] Runtime State / Modal Rendering
//   [PEDIT02] Modal Lifecycle / Form State
//   [PEDIT03] Input Formatting / Target State
//   [PEDIT04] ETF Trade Draft / Preview
//   [PEDIT05] Validation / Item Build
//   [PEDIT06] Status / Output / Form Reset
//   [PEDIT07] PIN Dialog
//   [PEDIT08] Batch Queue / Simulation
//   [PEDIT09] Persistence / Save/Delete
//   [PEDIT10] Event Delegation / Keyboard / Native Date Picker
//   [PEDIT11] Public API

// [PEDIT01] Runtime State / Modal Rendering · 편집 상태 / 금액조정 모달 렌더링
const pensionEditorState={
  batchMode:false,
  batchQueue:[],
  batchSequence:0,
  batchLastAddFingerprint:'',
  batchLastAddAt:0,
  batchApplying:false,
  batchRequestId:''
};

const defaultPensionContributionDate=d=>{
  const contributionMonths=pensionContributionItems().map(item=>{
    const memo=String(item?.memo||'');
    const memoMatch=/(\d{4})년\s*(\d{1,2})월\s*기업적립금/.exec(memo);
    if(memoMatch){
      const year=Number(memoMatch[1]);
      const month=Number(memoMatch[2]);
      if(year>0&&month>=1&&month<=12) return `${year}-${String(month).padStart(2,'0')}`;
    }
    const date=String(item?.date||'');
    return /^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(0,7):'';
  }).filter(Boolean).sort();
  const latestMonth=contributionMonths.at(-1);
  if(!latestMonth){
    const base='2026-07';
    const fallback=/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?String(d).slice(0,7):base;
    const [fallbackYear,fallbackMonth]=fallback.split('-').map(Number);
    const lastDay=new Date(Date.UTC(fallbackYear,fallbackMonth,0)).getUTCDate();
    return `${fallbackYear}-${String(fallbackMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  }
  const [y,m]=latestMonth.split('-').map(Number);
  const nextMonth=m===12?1:m+1;
  const nextYear=m===12?y+1:y;
  const lastDay=new Date(Date.UTC(nextYear,nextMonth,0)).getUTCDate();
  return `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
};
const defaultPensionContributionMemo=d=>{
  const [y,m]=d.split('-');
  return `${y}년 ${Number(m)}월 기업적립금`;
};
const fmtDecimal=(n,digits=3)=>Number(n||0).toLocaleString('ko-KR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const pensionTradeProductOptions=()=>((dataState.portfolio?.pension)||[]).map(v=>`<option value="${escapeHtml(String(v.ticker))}">${escapeHtml(v.name)}</option>`).join('');

function renderPensionContributionList(target='cashSnapshot'){
  const selectedTarget=['contribution','cashSnapshot','etfTrade'].includes(target)?target:'cashSnapshot';
  const contribItems=pensionContributionItems()
    .slice()
    .filter(v=>v&&v.date)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id||'').localeCompare(String(a.id||'')))
    .map(v=>({target:'contribution',key:v.id,date:v.date,amount:Number(v.amount)||0,memo:v.memo||'',label:'기업적립금'}));

  const cashItems=pensionCashSnapshotItems()
    .slice()
    .filter(v=>v&&v.date)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
    .map(v=>({target:'cashSnapshot',key:v.date,date:v.date,amount:Number(v.valuation)||0,costBasis:v.costBasis==null?null:Number(v.costBasis),memo:v.memo||'',label:'현금성자산'}));

  const tradeItems=pensionTradeItems()
    .slice()
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.appliedAtKST||'').localeCompare(String(a.appliedAtKST||''))||String(b.id||'').localeCompare(String(a.id||'')))
    .map(v=>({
      target:'etfTrade',
      key:v.id,
      date:v.date,
      amount:Number(v.amount)||0,
      memo:`신청 ${v.tradeDate||v.date} · ${v.name||v.ticker} · +${fmt(v.qty)}좌 · ${fmtDecimal(v.price,3)}원/좌`,
      label:'추가 매수'
    }));

  const source=selectedTarget==='contribution'?contribItems:(selectedTarget==='etfTrade'?tradeItems:cashItems);
  const items=source.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.key||'').localeCompare(String(a.key||'')));

  if(!items.length) return '';

  return items.map(v=>{
    const costText=v.target==='cashSnapshot'&&v.costBasis!=null&&Number.isFinite(Number(v.costBasis))?` / 매수원금 ${won(v.costBasis)}`:'';
    return `<label class="contrib-existing-item"><input type="radio" name="pensionContribDeleteTarget" value="${v.target}|${v.key}"><span class="contrib-existing-main"><span class="contrib-existing-title"><span class="contrib-existing-date">${v.date}</span><span class="contrib-existing-sep"> / </span><span class="contrib-existing-info">${v.label} / ${won(v.amount)}${costText}</span></span><span class="contrib-existing-memo">${escapeHtml(v.memo)}</span></span></label>`;
  }).join('');
}

function renderPensionContributionModal(x){
  const contribDefaultDate=defaultPensionContributionDate(x.date);
  const contribDefaultMemo=defaultPensionContributionMemo(contribDefaultDate);
  const cashDefaultDate=x.date||contribDefaultDate;
  const cashDefaultValue=Number.isFinite(Number(x.pensionCash))?fmt(x.pensionCash):'';
  const cashDefaultCostBasis=Number.isFinite(Number(x.pensionCashCost))?fmt(x.pensionCashCost):'';
  const applyDate=kstTodayText();
  return `<div id="pensionContribModal" class="contrib-modal" aria-hidden="true"><div class="contrib-modal-card" role="dialog" aria-modal="true" aria-labelledby="pensionContribModalTitle"><div class="contrib-modal-head"><div><h2 id="pensionContribModalTitle" class="modal-main-title">퇴직연금 금액 조정</h2></div><div class="contrib-modal-head-actions"><button type="button" class="control-icon-button modal-icon-btn pension-form-reset" data-pension-action="reset-form" title="입력값 초기화" aria-label="입력값 초기화">${navIconSvg('reset')}</button><button type="button" class="control-icon-button modal-icon-btn contrib-modal-close" data-pension-action="close-modal" aria-label="닫기">${navIconSvg('close')}</button></div></div>
<div class="pension-contrib-context" aria-label="퇴직연금 금액 조정 옵션">
  <div class="pension-contrib-context-head"><span class="contrib-field-label">조정 항목</span><div class="chart-compare-toggle pension-work-mode" role="group" aria-label="처리 방식 선택"><button type="button" class="pension-work-mode-btn active" aria-pressed="true" data-mode="single" data-pension-action="set-batch-mode" data-pension-enabled="false">개별 처리</button><button type="button" class="pension-work-mode-btn" aria-pressed="false" data-mode="batch" data-pension-action="set-batch-mode" data-pension-enabled="true">작업 모음 <span id="pensionBatchModeCount">0</span></button></div></div>
  <input type="hidden" id="pensionContribTarget" value="cashSnapshot"><div class="control-tab-group contrib-target-tabs" role="tablist" aria-label="조정 항목 선택" aria-orientation="horizontal"><button type="button" id="pension-target-tab-cash" class="control-tab contrib-target-option active" role="tab" aria-selected="true" aria-controls="pensionContribTargetPanel" tabindex="0" data-target="cashSnapshot" data-pension-action="set-target">현금성자산</button><button type="button" id="pension-target-tab-contribution" class="control-tab contrib-target-option" role="tab" aria-selected="false" aria-controls="pensionContribTargetPanel" tabindex="-1" data-target="contribution" data-pension-action="set-target">기업적립금</button><button type="button" id="pension-target-tab-trade" class="control-tab contrib-target-option" role="tab" aria-selected="false" aria-controls="pensionContribTargetPanel" tabindex="-1" data-target="etfTrade" data-pension-action="set-target">추가 매수</button></div>
</div>
<div id="pensionContribTargetPanel" role="tabpanel" aria-labelledby="pension-target-tab-cash">
<div class="pension-contrib-tool modal-card-box" role="group" aria-label="등록">
  <div id="pensionContribStandardFields" class="pension-adjust-form cash-mode">
    <div class="contrib-field pension-cash-date-field"><label for="pensionContribDate">일자</label><span class="pension-control-shell pension-date-shell"><input id="pensionContribDate" type="date" value="${cashDefaultDate}" data-contrib-default-date="${contribDefaultDate}" data-cash-default-date="${cashDefaultDate}"></span></div>
    <div class="contrib-field pension-cash-amount-field"><label id="pensionContribAmountLabel" for="pensionContribAmount">평가금액</label><span class="pension-control-shell"><input id="pensionContribAmount" type="text" inputmode="numeric" value="${cashDefaultValue}" data-contrib-default-value="618,060" data-cash-default-value="${cashDefaultValue}" data-pension-input="money"></span></div>
    <div id="pensionCashCostField" class="contrib-field pension-cash-cost-field"><label for="pensionCashCostBasis">매수원금</label><span class="pension-control-shell"><input id="pensionCashCostBasis" type="text" inputmode="numeric" value="${cashDefaultCostBasis}" data-cash-default-value="${cashDefaultCostBasis}" data-pension-input="money"></span></div>
    <div class="contrib-field full pension-cash-memo-field"><label for="pensionContribMemo">메모</label><span class="pension-control-shell"><input id="pensionContribMemo" type="text" value="현금성자산 앱 확인" data-contrib-default-memo="${contribDefaultMemo}" data-cash-default-memo="현금성자산 앱 확인"></span></div>
  </div>
  <div id="pensionEtfTradeFields" class="pension-etf-trade-fields" hidden>
    <div class="pension-adjust-form trade-mode">
      <div class="contrib-field full pension-trade-date-field"><label for="pensionEtfTradeDate">신청일</label><span class="pension-control-shell pension-date-shell"><input id="pensionEtfTradeDate" type="date" value="${cashDefaultDate}" data-pension-change="trade-preview"></span></div>
      <div class="contrib-field full pension-trade-product-field"><label for="pensionEtfTradeTicker">ETF 상품</label><span class="pension-control-shell pension-select-shell"><select id="pensionEtfTradeTicker" data-pension-change="trade-preview">${pensionTradeProductOptions()}</select></span></div>
      <div class="contrib-field pension-trade-qty-field"><label for="pensionEtfTradeQty">체결수량</label><span class="pension-control-shell"><input id="pensionEtfTradeQty" type="text" inputmode="numeric" data-pension-input="trade-preview"></span></div>
      <div class="contrib-field pension-trade-amount-field"><label for="pensionEtfTradeAmount">체결금액</label><span class="pension-control-shell"><input id="pensionEtfTradeAmount" type="text" inputmode="numeric" data-pension-input="money-preview"></span></div>
    </div>
    <div class="pension-etf-trade-apply-note">앱 반영일 <strong id="pensionEtfTradeApplyDate">${applyDate}</strong> · 저장한 날 기준으로 보유수량/원가/현금에 적용</div>
    <div id="pensionEtfTradePreview" class="pension-etf-trade-preview"><span class="small">상품·수량·체결금액을 입력하면 적용 후 예상값을 보여줍니다.</span></div>
  </div>
  <div class="contrib-actions">
    <button type="button" id="pensionContribSaveButton" class="control-action-button compact primary contrib-btn" data-pension-action="save">저장</button>
  </div>
  <div id="pensionContribStatus" class="contrib-status" role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="pensionContribOutputFile" class="contrib-output-file" hidden></div>
  <pre id="pensionContribOutput" class="contrib-output"></pre>
</div>
<div id="pensionContribDeleteCard" class="contrib-list modal-card-box" role="group" aria-label="삭제"${pensionCashSnapshotItems().length?'':' hidden'}>
  <p id="pensionContribDeleteHelp" class="small">잘못 등록한 현금성자산 기록 선택 후 삭제</p>
  <div id="pensionContribExistingList" class="contrib-existing-list">${renderPensionContributionList('cashSnapshot')}</div>
  <div class="contrib-actions"><button type="button" id="pensionContribDeleteButton" class="control-action-button compact danger contrib-btn" data-pension-action="delete-selected">선택 항목 삭제</button></div>
  <div id="pensionContribDeleteStatus" class="contrib-status" role="status" aria-live="polite" aria-atomic="true"></div>
</div>
</div>
<div id="pensionBatchPanel" class="pension-batch-panel modal-card-box" role="group" aria-labelledby="pensionBatchTitle" hidden>
  <div class="pension-batch-head"><div><h3 id="pensionBatchTitle">작업 모음 <span id="pensionBatchTitleCount">0건</span></h3><p>저장·삭제 작업을 모아 PIN 한 번으로 한 커밋에 반영합니다.</p></div><button type="button" id="pensionBatchClearButton" class="control-action-button compact ghost pension-batch-clear" data-pension-action="clear-batch">전체 비우기</button></div>
  <div id="pensionBatchQueueList" class="pension-batch-queue"><div class="pension-batch-empty">아직 추가된 작업이 없습니다.</div></div>
  <div id="pensionBatchOrderNote" class="pension-batch-order-note" hidden></div>
  <div id="pensionBatchStatus" class="contrib-status" role="status" aria-live="polite" aria-atomic="true"></div>
  <div class="pension-batch-actions"><button type="button" id="pensionBatchApplyButton" class="control-action-button compact primary contrib-btn" data-pension-action="apply-batch" disabled>일괄 적용</button></div>
</div>
<details class="token-guide">
  <summary><span class="token-guide-chevron" aria-hidden="true">${navIconSvg('chevronRight')}</span>GitHub 토큰 만료/교체 방법</summary>
  <div class="token-guide-body">
    <div class="token-guide-alert">토큰이 만료되면 대시보드 조회는 되지만, 퇴직연금 금액 조정 저장·삭제만 실패할 수 있습니다.</div>
    <p>Google Apps Script의 Script Properties에 저장된 <code>GITHUB_TOKEN</code>을 사용합니다.</p>
    <ol>
      <li>GitHub에서 새 Fine-grained token 생성</li>
      <li>대시보드 repo만 선택</li>
      <li>권한은 <code>Contents: Read and write</code>, <code>Actions: Read and write</code>, <code>Metadata: Read-only</code></li>
      <li>Google Apps Script → 프로젝트 설정 → Script Properties</li>
      <li><code>GITHUB_TOKEN</code> 값을 새 토큰으로 교체</li>
    </ol>
  </div>
</details></div></div>`;
}

// [PEDIT02] Modal Lifecycle / Form State · 모달 생명주기 / 입력 상태
const PENSION_MODAL_MEASURE_TARGETS=['cashSnapshot','contribution','etfTrade'];
let pensionModalHeightFrame=0;

// Modal geometry and feature-owned open/close hooks; shell lifecycle is delegated to dashboard-modal.js.
function configurePensionModalMeasureState(card,target,batchMode,tradeDraft){
  const normalized=PENSION_MODAL_MEASURE_TARGETS.includes(target)?target:'cashSnapshot';
  const standardFields=card.querySelector('#pensionContribStandardFields');
  const tradeFields=card.querySelector('#pensionEtfTradeFields');
  const cashCostField=card.querySelector('#pensionCashCostField');
  const amountLabel=card.querySelector('#pensionContribAmountLabel');
  const deleteCard=card.querySelector('#pensionContribDeleteCard');
  const deleteHelp=card.querySelector('#pensionContribDeleteHelp');
  const deleteList=card.querySelector('#pensionContribExistingList');
  const batchPanel=card.querySelector('#pensionBatchPanel');
  const saveButton=card.querySelector('#pensionContribSaveButton');
  const deleteButton=card.querySelector('#pensionContribDeleteButton');

  card.querySelectorAll('.contrib-target-option').forEach(btn=>{
    const active=btn.dataset.target===normalized;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',String(active));
  });
  card.querySelectorAll('.pension-work-mode-btn').forEach(btn=>{
    const active=(btn.dataset.mode==='batch')===batchMode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });

  if(standardFields){
    standardFields.hidden=normalized==='etfTrade';
    standardFields.classList.toggle('cash-mode',normalized==='cashSnapshot');
    standardFields.classList.toggle('contribution-mode',normalized==='contribution');
  }
  if(tradeFields)tradeFields.hidden=normalized!=='etfTrade';
  if(cashCostField)cashCostField.hidden=normalized!=='cashSnapshot';
  if(amountLabel)amountLabel.textContent=normalized==='cashSnapshot'?'평가금액':'금액';

  const hasDeleteItems=pensionContributionDeleteCount(normalized)>0;
  if(deleteCard)deleteCard.hidden=!hasDeleteItems;
  if(deleteList){
    deleteList.innerHTML=hasDeleteItems?renderPensionContributionList(normalized):'';
    deleteList.querySelectorAll('input[type="radio"]').forEach(input=>{input.name='pensionContribDeleteTargetMeasure';input.checked=false});
  }
  if(deleteHelp){
    deleteHelp.textContent=normalized==='cashSnapshot'
      ?'잘못 등록한 현금성자산 기록 선택 후 삭제'
      :(normalized==='contribution'
        ?'잘못 등록한 기업적립금 선택 후 삭제'
        :'잘못 등록한 추가 매수 거래 선택 후 삭제');
  }

  if(batchPanel)batchPanel.hidden=!batchMode;
  if(saveButton)saveButton.textContent=batchMode?'작업 모음에 추가':'저장';
  if(deleteButton)deleteButton.textContent=batchMode?'삭제 작업 추가':'선택 항목 삭제';
  if(normalized==='etfTrade'){
    const preview=card.querySelector('#pensionEtfTradePreview');
    const draft=tradeDraft||pensionEtfTradeDraft();
    renderPensionEtfTradePreview(preview,draft,pensionEtfTradeExpectedForMode(draft,batchMode),{syncSaveDisabled:false});
  }
}

function measurePensionContributionModalHeight(){
  const modal=document.getElementById('pensionContribModal');
  const card=modal?.querySelector('.contrib-modal-card');
  if(!modal?.classList.contains('show')||!card)return;
  const width=card.getBoundingClientRect().width;
  if(!(width>0))return;
  const tradeDraft=pensionEtfTradeDraft();

  const clone=card.cloneNode(true);
  clone.setAttribute('aria-hidden','true');
  clone.querySelectorAll('input[type="radio"]').forEach(input=>{input.name='pensionContribDeleteTargetMeasure';input.checked=false});
  clone.querySelectorAll('details[open]').forEach(detail=>detail.removeAttribute('open'));
  ['pensionContribStatus','pensionContribDeleteStatus','pensionBatchStatus'].forEach(id=>{
    const status=clone.querySelector(`#${id}`);
    if(status){status.textContent='';status.className='contrib-status'}
  });
  const outputFile=clone.querySelector('#pensionContribOutputFile');
  if(outputFile){outputFile.textContent='';outputFile.hidden=true}
  const output=clone.querySelector('#pensionContribOutput');
  if(output){output.textContent='';output.classList.remove('show')}

  Object.assign(clone.style,{
    position:'absolute',
    left:'-100000px',
    top:'0',
    width:`${width}px`,
    height:'auto',
    maxHeight:'none',
    overflow:'visible',
    visibility:'hidden',
    pointerEvents:'none'
  });
  modal.appendChild(clone);

  let maxHeight=0;
  try{
    for(const batchMode of [false,true]){
      for(const target of PENSION_MODAL_MEASURE_TARGETS){
        configurePensionModalMeasureState(clone,target,batchMode,tradeDraft);
        maxHeight=Math.max(maxHeight,Math.ceil(clone.getBoundingClientRect().height));
      }
    }
  }finally{
    clone.remove();
  }
  if(maxHeight>0)card.style.height=`${maxHeight}px`;
}

function schedulePensionContributionModalHeight(){
  if(pensionModalHeightFrame)cancelAnimationFrame(pensionModalHeightFrame);
  pensionModalHeightFrame=requestAnimationFrame(()=>{
    pensionModalHeightFrame=0;
    measurePensionContributionModalHeight();
  });
}

function openPensionContributionModal(){
  const modal=document.getElementById('pensionContribModal');
  if(!modal) return;
  bindDashboardModalDismiss(modal,{onDismiss:closePensionContributionModal,stopEscapePropagation:false});
  setPensionContributionTarget('cashSnapshot');
  syncPensionBatchModeUi();
  schedulePensionContributionModalHeight();
  openDashboardModal(modal,{initialFocus:modal.querySelector('.contrib-modal-close'),fallbackSelector:'[data-dashboard-action="open-pension-modal"]'});
}
function closePensionContributionModal(){
  const modal=document.getElementById('pensionContribModal');
  if(!modal) return;
  closeDashboardModal(modal,{fallbackSelector:'[data-dashboard-action="open-pension-modal"]'});
  forceMobileViewportReflow();
}
// [PEDIT03] Input Formatting / Target State · 입력 포맷 / 대상 상태
function cleanNumberInput(v){
  return Number(String(v||'').replace(/[^\d.-]/g,''));
}
function formatPensionMoneyInput(input){
  if(!input) return;
  const raw=String(input.value||'');
  const cursor=Number.isFinite(input.selectionStart)?input.selectionStart:raw.length;
  const digitsBeforeCursor=raw.slice(0,cursor).replace(/\D/g,'').length;
  let digits=raw.replace(/\D/g,'');
  if(!digits){
    input.value='';
    return;
  }
  digits=digits.replace(/^0+(?=\d)/,'');
  const formatted=digits.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  input.value=formatted;
  if(typeof input.setSelectionRange==='function'){
    let nextCursor=formatted.length;
    if(digitsBeforeCursor===0){
      nextCursor=0;
    }else{
      let seen=0;
      for(let i=0;i<formatted.length;i++){
        if(/\d/.test(formatted[i])) seen+=1;
        if(seen>=digitsBeforeCursor){
          nextCursor=i+1;
          break;
        }
      }
    }
    try{input.setSelectionRange(nextCursor,nextCursor)}catch(_){}
  }
}

function pensionContributionTarget(){
  const value=document.getElementById('pensionContribTarget')?.value;
  return ['cashSnapshot','contribution','etfTrade'].includes(value)?value:'cashSnapshot';
}
function pensionContributionTargetLabel(target=pensionContributionTarget()){
  if(target==='etfTrade') return '추가 매수';
  return target==='cashSnapshot'?'현금성자산':'기업적립금';
}
function pensionContributionTargetObjectLabel(target=pensionContributionTarget()){
  if(target==='etfTrade') return '추가 매수를';
  return target==='cashSnapshot'?'현금성자산을':'기업적립금을';
}
function pensionContributionDataFile(target=pensionContributionTarget()){
  if(target==='etfTrade') return 'data/pension_trades.json';
  return target==='cashSnapshot'?'data/pension_cash_snapshots.json':'data/pension_contributions.json';
}
function pensionSavePinDescription(item){
  if(item.target==='cashSnapshot') return `${item.date} 현금성자산 평가금액 ${won(item.valuation)}, 매수원금 ${won(item.costBasis)}을 저장합니다.`;
  if(item.target==='etfTrade') return `신청일 ${item.tradeDate} · ${item.name} ${fmt(item.qty)}좌 · 체결금액 ${won(item.amount)}을 ${item.applyDate} 앱 반영 기준으로 저장합니다.`;
  return `${item.date} 기업적립금 ${won(item.amount)}을 저장합니다.`;
}
function pensionDeletePinDescription(target,item,key){
  if(target==='cashSnapshot') return `${item?.date||key} 현금성자산 기록(평가금액 ${won(Number(item?.valuation)||0)})을 삭제합니다.`;
  if(target==='etfTrade') return `신청일 ${item?.tradeDate||item?.date||key} · ${item?.name||item?.ticker||''} ${fmt(item?.qty||0)}좌 · 체결금액 ${won(Number(item?.amount)||0)} 추가 매수 기록을 삭제합니다.`;
  return `${item?.date||key} 기업적립금 ${won(Number(item?.amount)||0)} 기록을 삭제합니다.`;
}
function setPensionContributionSaveDisabled(disabled){
  const btn=document.getElementById('pensionContribSaveButton');
  if(!btn) return;
  btn.disabled=!!disabled;
  btn.setAttribute('aria-disabled',disabled?'true':'false');
}
function upsertPensionItemLocally(target,item){
  if(!item) return;
  if(target==='cashSnapshot'){
    if(!item.date) return;
    const next=rawPensionCashSnapshotItems().filter(v=>String(v?.date||'')!==String(item.date));
    next.push(item);
    dataState.pensionCashSnapshots=Array.isArray(dataState.pensionCashSnapshots)?next:{...(dataState.pensionCashSnapshots||{}),snapshots:next};
    return;
  }
  if(target==='etfTrade'){
    if(!item.id) return;
    const next=rawPensionTradeItems().filter(v=>String(v?.id||'')!==String(item.id));
    next.push(item);
    dataState.pensionTrades=Array.isArray(dataState.pensionTrades)?next:{...(dataState.pensionTrades||{}),trades:next};
    return;
  }
  if(!item.id) return;
  const next=rawPensionContributionItems().filter(v=>String(v?.id||'')!==String(item.id));
  next.push(item);
  dataState.pensionContributions=Array.isArray(dataState.pensionContributions)?next:{...(dataState.pensionContributions||{}),contributions:next};
}
function pensionContributionDeleteCount(target=pensionContributionTarget()){
  if(target==='cashSnapshot') return pensionCashSnapshotItems().length;
  if(target==='etfTrade') return pensionTradeItems().length;
  return pensionContributionItems().length;
}
function syncPensionContributionDeleteCard(target=pensionContributionTarget()){
  const card=document.getElementById('pensionContribDeleteCard');
  const list=document.getElementById('pensionContribExistingList');
  const hasItems=pensionContributionDeleteCount(target)>0;
  if(card) card.hidden=!hasItems;
  if(list) list.innerHTML=hasItems?renderPensionContributionList(target):'';
  schedulePensionContributionModalHeight();
}
function removePensionItemLocally(target,key){
  if(target==='cashSnapshot'){
    const next=rawPensionCashSnapshotItems().filter(v=>String(v?.date||'')!==String(key));
    dataState.pensionCashSnapshots=Array.isArray(dataState.pensionCashSnapshots)?next:{...(dataState.pensionCashSnapshots||{}),snapshots:next};
    return;
  }
  if(target==='etfTrade'){
    const next=rawPensionTradeItems().filter(v=>String(v?.id||'')!==String(key));
    dataState.pensionTrades=Array.isArray(dataState.pensionTrades)?next:{...(dataState.pensionTrades||{}),trades:next};
    return;
  }
  const next=rawPensionContributionItems().filter(v=>String(v?.id||'')!==String(key));
  dataState.pensionContributions=Array.isArray(dataState.pensionContributions)?next:{...(dataState.pensionContributions||{}),contributions:next};
}
function setPensionContributionTarget(target){
  const normalized=['cashSnapshot','contribution','etfTrade'].includes(target)?target:'cashSnapshot';
  const el=document.getElementById('pensionContribTarget');
  if(el) el.value=normalized;
  syncPensionContributionTargetUi();
}
function syncPensionContributionTargetUi(){
  const target=pensionContributionTarget();
  let activeTargetTab=null;
  document.querySelectorAll('.contrib-target-option').forEach(btn=>{
    const active=btn.dataset.target===target;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',String(active));
    btn.tabIndex=active?0:-1;
    if(active)activeTargetTab=btn;
  });
  const targetPanel=document.getElementById('pensionContribTargetPanel');
  if(targetPanel&&activeTargetTab?.id)targetPanel.setAttribute('aria-labelledby',activeTargetTab.id);
  const standardFields=document.getElementById('pensionContribStandardFields');
  const tradeFields=document.getElementById('pensionEtfTradeFields');
  if(standardFields){
    standardFields.hidden=target==='etfTrade';
    standardFields.classList.toggle('cash-mode',target==='cashSnapshot');
    standardFields.classList.toggle('contribution-mode',target==='contribution');
  }
  if(tradeFields) tradeFields.hidden=target!=='etfTrade';

  const dateEl=document.getElementById('pensionContribDate');
  const amountEl=document.getElementById('pensionContribAmount');
  const memoEl=document.getElementById('pensionContribMemo');
  const amountLabel=document.getElementById('pensionContribAmountLabel');
  const cashCostField=document.getElementById('pensionCashCostField');
  const cashCostEl=document.getElementById('pensionCashCostBasis');
  const deleteHelp=document.getElementById('pensionContribDeleteHelp');
  const deleteStatus=document.getElementById('pensionContribDeleteStatus');
  const outputFile=document.getElementById('pensionContribOutputFile');
  const output=document.getElementById('pensionContribOutput');

  if(target!=='etfTrade'){
    setPensionContributionSaveDisabled(false);
    if(amountLabel) amountLabel.textContent=target==='cashSnapshot'?'평가금액':'금액';
    if(cashCostField) cashCostField.hidden=target!=='cashSnapshot';
    if(dateEl) dateEl.value=target==='cashSnapshot'?(dateEl.dataset.cashDefaultDate||dateEl.value):(dateEl.dataset.contribDefaultDate||dateEl.value);
    if(amountEl) amountEl.value=target==='cashSnapshot'?(amountEl.dataset.cashDefaultValue||''):(amountEl.dataset.contribDefaultValue||'618,060');
    if(cashCostEl&&target==='cashSnapshot') cashCostEl.value=cashCostEl.dataset.cashDefaultValue||cashCostEl.value||'';
    if(memoEl) memoEl.value=target==='cashSnapshot'?(memoEl.dataset.cashDefaultMemo||'현금성자산 앱 확인'):(memoEl.dataset.contribDefaultMemo||defaultPensionContributionMemo(dateEl?.value||''));
  }else{
    if(cashCostField) cashCostField.hidden=true;
    const applyDateEl=document.getElementById('pensionEtfTradeApplyDate');
    if(applyDateEl) applyDateEl.textContent=kstTodayText();
    updatePensionEtfTradePreview();
  }

  syncPensionContributionDeleteCard(target);
  if(deleteHelp){
    deleteHelp.textContent=target==='cashSnapshot'
      ?'잘못 등록한 현금성자산 기록 선택 후 삭제'
      :(target==='contribution'
        ?'잘못 등록한 기업적립금 선택 후 삭제'
        :'잘못 등록한 추가 매수 거래 선택 후 삭제');
  }
  clearPensionContributionStatus('pensionContribStatus');
  if(deleteStatus){
    deleteStatus.textContent='';
    deleteStatus.className='contrib-status';
  }
  if(outputFile){
    outputFile.textContent='';
    outputFile.hidden=true;
  }
  if(output){
    output.textContent='';
    output.classList.remove('show');
  }
  schedulePensionContributionModalHeight();
}
// [PEDIT04] ETF Trade Draft / Preview · ETF 거래 초안 / 미리보기
function pensionEtfTradeDraft(){
  const tradeDate=String(document.getElementById('pensionEtfTradeDate')?.value||'').trim();
  const ticker=String(document.getElementById('pensionEtfTradeTicker')?.value||'').trim();
  const qtyRaw=String(document.getElementById('pensionEtfTradeQty')?.value||'').trim();
  const amountRaw=String(document.getElementById('pensionEtfTradeAmount')?.value||'').trim();
  const qty=cleanNumberInput(qtyRaw);
  const amount=cleanNumberInput(amountRaw);
  const applyDate=kstTodayText();
  const product=(dataState.portfolio?.pension||[]).find(v=>String(v.ticker)===ticker)||null;
  return {tradeDate,ticker,qtyRaw,amountRaw,qty,amount,applyDate,product};
}
function pensionEtfTradeExpectedForMode(draft,batchMode){
  const {applyDate,product,qty,amount}=draft;
  if(!product||!Number.isFinite(qty)||qty<=0||!Number.isFinite(amount)||amount<=0) return null;
  const batchState=batchMode?pensionBatchCurrentState():null;
  const state=batchState?pensionBatchPositionState(product,applyDate,batchState):pensionPositionState(product,applyDate);
  const cashBefore=batchState?pensionBatchCashAvailable(batchState,applyDate):pensionCashBeforeNewTrade(applyDate);
  const cashAfter=cashBefore-amount;
  const qtyAfter=state.qty+qty;
  const costAfter=state.cost+amount;
  return {
    state,
    cashBefore,
    cashAfter,
    qtyAfter,
    costAfter,
    tradePrice:amount/qty,
    avgAfter:qtyAfter>0?costAfter/qtyAfter:0
  };
}
function pensionEtfTradeExpected(draft=pensionEtfTradeDraft()){
  return pensionEtfTradeExpectedForMode(draft,pensionEditorState.batchMode);
}
function renderPensionEtfTradePreview(box,draft,expected,{syncSaveDisabled=true}={}){
  if(!box)return;
  const setDisabled=disabled=>{if(syncSaveDisabled)setPensionContributionSaveDisabled(disabled)};
  if(!draft.tradeDate||!draft.product||draft.qtyRaw===''||draft.amountRaw===''||!expected){
    setDisabled(false);
    box.className='pension-etf-trade-preview';
    box.innerHTML='<span class="small">상품·수량·체결금액을 입력하면 적용 후 예상값을 보여줍니다.</span>';
    return;
  }
  if(!Number.isInteger(draft.qty)||draft.qty<=0){
    setDisabled(false);
    box.className='pension-etf-trade-preview warning';
    box.innerHTML='<strong>체결수량은 1좌 이상의 정수로 입력해주세요.</strong>';
    return;
  }
  if(draft.tradeDate>draft.applyDate){
    setDisabled(false);
    box.className='pension-etf-trade-preview warning';
    box.innerHTML='<strong>신청일은 앱 반영일보다 늦을 수 없습니다.</strong>';
    return;
  }
  const insufficient=expected.cashAfter<0;
  if(insufficient){
    setDisabled(true);
    box.className='pension-etf-trade-preview warning blocked';
    box.innerHTML=`<div class="pension-etf-trade-preview-title pension-etf-trade-blocked-title">⚠ 저장 불가</div>
      <div class="pension-etf-trade-preview-grid">
        <span>현재 현금성자산</span><strong>${won(expected.cashBefore)}</strong>
        <span>체결금액</span><strong>${won(draft.amount)}</strong>
        <span>부족금액</span><strong class="pension-etf-trade-shortage">${won(Math.abs(expected.cashAfter))}</strong>
      </div>
      <div class="pension-etf-trade-preview-alert">체결금액이 현금성자산보다 큽니다.</div>`;
    return;
  }
  setDisabled(false);
  box.className='pension-etf-trade-preview';
  box.innerHTML=`<div class="pension-etf-trade-preview-title">적용 후 예상</div>
    <div class="pension-etf-trade-preview-grid">
      <span>현금성자산</span><strong>${won(expected.cashBefore)} → ${won(expected.cashAfter)}</strong>
      <span>${escapeHtml(draft.product.name)} 수량</span><strong>${fmt(expected.state.qty)}좌 → ${fmt(expected.qtyAfter)}좌</strong>
      <span>취득원가</span><strong>${won(expected.state.cost)} → ${won(expected.costAfter)}</strong>
      <span>평균단가</span><strong>${fmtDecimal(expected.avgAfter,3)}원 <em>(화면 ${fmt(expected.avgAfter)}원)</em></strong>
      <span>이번 체결단가</span><strong>${fmtDecimal(expected.tradePrice,3)}원/좌</strong>
    </div>`;
}
function updatePensionEtfTradePreview(){
  const box=document.getElementById('pensionEtfTradePreview');
  if(!box) return;
  const draft=pensionEtfTradeDraft();
  renderPensionEtfTradePreview(box,draft,pensionEtfTradeExpected(draft));
}
// [PEDIT05] Validation / Item Build · 검증 / 저장 항목 생성
function pensionEditorInternalError(message){
  const error=new Error(message);
  error.code='PENSION_EDITOR_INTERNAL';
  return error;
}
function buildPensionContributionItem(){
  const target=pensionContributionTarget();
  if(target==='etfTrade'){
    const draft=pensionEtfTradeDraft();
    if(!draft.tradeDate) throw new Error('신청일을 입력해주세요.');
    if(!draft.product) throw new Error('ETF 상품을 선택해주세요.');
    if(draft.qtyRaw===''||!Number.isFinite(draft.qty)||draft.qty<=0||!Number.isInteger(draft.qty)) throw new Error('체결수량을 정수로 입력해주세요.');
    if(draft.amountRaw===''||!Number.isFinite(draft.amount)||draft.amount<=0) throw new Error('체결금액을 입력해주세요.');
    if(draft.tradeDate>draft.applyDate) throw new Error('신청일은 앱 반영일보다 늦을 수 없습니다.');
    const expected=pensionEtfTradeExpected(draft);
    if(!expected) throw new Error('예상값을 계산할 수 없습니다.');
    if(expected.cashAfter<0) throw new Error('체결금액이 현금성자산보다 큽니다.');
    const amount=Math.round(draft.amount);
    return {
      target:'etfTrade',
      tradeDate:draft.tradeDate,
      applyDate:draft.applyDate,
      ticker:draft.ticker,
      name:draft.product.name,
      type:'buy',
      qty:draft.qty,
      price:amount/draft.qty,
      amount,
      funding:'pension_cash',
      cashBefore:expected.cashBefore,
      cashAfter:expected.cashBefore-amount,
      memo:`신청일 ${draft.tradeDate} · ${draft.product.name} ${fmt(draft.qty)}좌 매수 체결 · 앱 반영일 ${draft.applyDate}`
    };
  }

  const dateEl=document.getElementById('pensionContribDate');
  const amountEl=document.getElementById('pensionContribAmount');
  const memoEl=document.getElementById('pensionContribMemo');
  const cashCostEl=document.getElementById('pensionCashCostBasis');
  if(!dateEl||!amountEl||!memoEl) throw pensionEditorInternalError('입력칸을 찾지 못했습니다.');
  const date=dateEl.value;
  const rawAmount=String(amountEl.value||'').trim();
  const amount=cleanNumberInput(rawAmount);
  const memo=memoEl.value.trim()||(target==='cashSnapshot'?'현금성자산 앱 확인':defaultPensionContributionMemo(date));
  if(!date) throw new Error('일자를 입력해주세요.');
  if(target==='cashSnapshot'){
    if(rawAmount===''||!Number.isFinite(amount)||amount<0) throw new Error('평가금액을 입력해주세요.');
    const rawCostBasis=String(cashCostEl?.value||'').trim();
    const costBasis=cleanNumberInput(rawCostBasis);
    if(rawCostBasis===''||!Number.isFinite(costBasis)||costBasis<0) throw new Error('매수원금을 입력해주세요.');
    return {target,date,valuation:amount,costBasis:Math.round(costBasis),memo};
  }
  if(rawAmount===''||!Number.isFinite(amount)||amount<=0) throw new Error('금액을 입력해주세요.');
  return {target,date,amount,memo};
}
// [PEDIT06] Status / Output / Form Reset · 상태 / 결과 / 폼 초기화
function setPensionContributionStatus(elementId,message,type='err'){
  const status=document.getElementById(elementId);
  if(!status) return;
  status.textContent=message;
  status.className=`contrib-status show ${type}`;
}
function showPensionContributionStatus(message,type='err'){
  setPensionContributionStatus('pensionContribStatus',message,type);
}
function showPensionToast(message,type='ok',delay=3500){
  showAppToast(message,type,delay);
}
function showPensionContributionDeleteStatus(message,type='err'){
  setPensionContributionStatus('pensionContribDeleteStatus',message,type);
}
function clearPensionContributionStatus(elementId){
  const status=document.getElementById(elementId);
  if(!status)return;
  status.textContent='';
  status.className='contrib-status';
}
function clearPensionContributionOutput(){
  const outputFile=document.getElementById('pensionContribOutputFile');
  const output=document.getElementById('pensionContribOutput');
  if(outputFile){outputFile.textContent='';outputFile.hidden=true}
  if(output){output.textContent='';output.classList.remove('show')}
}
function showPensionContributionOutput(item){
  const outputFile=document.getElementById('pensionContribOutputFile');
  const output=document.getElementById('pensionContribOutput');
  if(outputFile){outputFile.textContent=`반영 파일 · ${pensionContributionDataFile(item.target)}`;outputFile.hidden=false}
  if(output){output.textContent=JSON.stringify(item,null,2);output.classList.add('show')}
}
function resetPensionContributionForm(){
  const dateEl=document.getElementById('pensionContribDate');
  const tradeDateEl=document.getElementById('pensionEtfTradeDate');
  const cashCostEl=document.getElementById('pensionCashCostBasis');
  const tickerEl=document.getElementById('pensionEtfTradeTicker');
  const qtyEl=document.getElementById('pensionEtfTradeQty');
  const tradeAmountEl=document.getElementById('pensionEtfTradeAmount');
  const defaultCashDate=dateEl?.dataset.cashDefaultDate||kstTodayText();

  setPensionContributionTarget('cashSnapshot');
  if(cashCostEl)cashCostEl.value=cashCostEl.dataset.cashDefaultValue||'';
  if(tradeDateEl)tradeDateEl.value=defaultCashDate;
  if(tickerEl&&tickerEl.options.length)tickerEl.selectedIndex=0;
  if(qtyEl)qtyEl.value='';
  if(tradeAmountEl)tradeAmountEl.value='';
  document.querySelectorAll('input[name="pensionContribDeleteTarget"]').forEach(input=>{input.checked=false});
  clearPensionContributionOutput();
  clearPensionContributionStatus('pensionContribStatus');
  clearPensionContributionStatus('pensionContribDeleteStatus');
  clearPensionContributionStatus('pensionBatchStatus');
  pensionEditorState.batchLastAddFingerprint='';
  pensionEditorState.batchLastAddAt=0;
  updatePensionEtfTradePreview();
  const queuedCount=pensionEditorState.batchQueue.length;
  showPensionToast(queuedCount?'입력값만 초기화했습니다.':'입력값을 초기화했습니다.');
  document.activeElement?.blur?.();
}

// [PEDIT07] PIN Dialog · PIN 확인
function requestPensionActionPin({title='PIN 입력',description='작업 내용을 확인한 뒤 PIN 6자리를 입력하세요.',danger=false,execute}={}){
  return new Promise(resolve=>{
    const old=document.getElementById('pensionActionPinModal');
    if(old) old.remove();

    const modal=document.createElement('div');
    modal.id='pensionActionPinModal';
    modal.className='action-modal pension-action-pin-modal';
    modal.innerHTML=`<div class="action-modal-card pension-action-pin-card" role="dialog" aria-modal="true" aria-labelledby="pensionActionPinTitle">
      <button type="button" class="control-icon-button modal-icon-btn pension-action-pin-close" aria-label="닫기">${navIconSvg('close')}</button>
      <h3 id="pensionActionPinTitle" class="modal-main-title">${title}</h3>
      <p id="pensionActionPinDescription" class="action-modal-description">${description}</p>
      <label class="action-modal-label" for="pensionActionPinInput">PIN</label>
      <input id="pensionActionPinInput" class="action-modal-input" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN 6자리 입력" aria-describedby="pensionActionPinDescription pensionActionPinAutoHelp pensionActionPinStatus">
      <p id="pensionActionPinAutoHelp" class="action-modal-input-help">PIN이 확인되면 바로 적용됩니다.</p>
      <div id="pensionActionPinStatus" class="action-modal-status pension-action-pin-status" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="action-modal-buttons pension-action-pin-buttons"><button type="button" class="control-action-button action-modal-btn ghost">취소</button></div>
    </div>`;

    let busy=false;
    let submitTimer=null;
    const input=modal.querySelector('#pensionActionPinInput');
    const status=modal.querySelector('#pensionActionPinStatus');
    const cancel=modal.querySelector('.ghost');
    const close=modal.querySelector('.pension-action-pin-close');

    const finish=value=>{
      clearTimeout(submitTimer);
      closeDashboardModal(modal,{visibleClass:'',manageAriaHidden:false,remove:true});
      resolve(value);
    };
    const submit=async()=>{
      const pin=String(input?.value||'').replace(/\D/g,'').slice(0,6);
      if(pin.length!==6||busy)return;
      busy=true;
      input.disabled=true;
      if(status){status.textContent='처리 중...';status.className='action-modal-status pension-action-pin-status checking'}
      try{
        const result=typeof execute==='function'?await execute(pin):pin;
        finish(result);
      }catch(e){
        if(status){status.textContent=e.message||String(e);status.className='action-modal-status pension-action-pin-status err'}
        input.disabled=false;
        input.value='';
        busy=false;
        requestAnimationFrame(()=>input.focus());
      }
    };
    const onInput=()=>{
      const cleaned=String(input.value||'').replace(/\D/g,'').slice(0,6);
      if(input.value!==cleaned)input.value=cleaned;
      if(status&&status.classList.contains('err')){status.textContent='';status.className='action-modal-status pension-action-pin-status'}
      clearTimeout(submitTimer);
      if(cleaned.length===6)submitTimer=setTimeout(submit,180);
    };

    input?.addEventListener('input',onInput);
    input?.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
    cancel?.addEventListener('click',()=>finish(null));
    close?.addEventListener('click',()=>finish(null));

    document.body.appendChild(modal);
    bindDashboardModalDismiss(modal,{onDismiss:()=>finish(null)});
    openDashboardModal(modal,{visibleClass:'',manageAriaHidden:false,initialFocus:input});
  });
}


// [PEDIT08] Batch Queue / Simulation · 작업 모음 / 시뮬레이션
function pensionBatchBaseState(){
  return {
    cashSnapshots:pensionCashSnapshotItems().map(v=>({...v,afterTradeIds:Array.isArray(v.afterTradeIds)?[...v.afterTradeIds]:v.afterTradeIds,afterContributionIds:Array.isArray(v.afterContributionIds)?[...v.afterContributionIds]:v.afterContributionIds})),
    contributions:pensionContributionItems().map(v=>({...v})),
    trades:pensionTradeItems().map(v=>({...v}))
  };
}
function pensionBatchCloneState(state){
  return {
    cashSnapshots:(state.cashSnapshots||[]).map(v=>({...v,afterTradeIds:Array.isArray(v.afterTradeIds)?[...v.afterTradeIds]:v.afterTradeIds,afterContributionIds:Array.isArray(v.afterContributionIds)?[...v.afterContributionIds]:v.afterContributionIds})),
    contributions:(state.contributions||[]).map(v=>({...v})),
    trades:(state.trades||[]).map(v=>({...v}))
  };
}
function pensionBatchCashAvailable(state,asOfDate){
  const snapshots=(state.cashSnapshots||[]).filter(v=>v.date<=asOfDate).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const snapshot=snapshots.at(-1)||null;
  if(snapshot){
    let balance=Number(snapshot.valuation)||0;
    (state.contributions||[]).forEach(v=>{
      if(v.date>asOfDate||v.date<snapshot.date)return;
      if(v.date===snapshot.date&&pensionCashSnapshotReflectsContribution(snapshot,v))return;
      balance+=Number(v.amount)||0;
    });
    (state.trades||[]).forEach(v=>{
      if(v.date>asOfDate||v.date<snapshot.date)return;
      if(v.date===snapshot.date&&pensionCashSnapshotReflectsTrade(snapshot,v))return;
      if(v.type==='sell')balance+=Number(v.amount)||0;
      else balance-=Number(v.amount)||0;
    });
    return Math.max(0,balance);
  }
  let balance=Number(pensionBaseCashForDate(asOfDate))||0;
  (state.contributions||[]).forEach(v=>{if(v.date<=asOfDate)balance+=Number(v.amount)||0});
  (state.trades||[]).forEach(v=>{if(v.date<=asOfDate)balance+=(v.type==='sell'?1:-1)*(Number(v.amount)||0)});
  return Math.max(0,balance);
}
function pensionBatchPositionState(pos,d,state){
  let qty=Number(pos.qty)||0,cost=Number(pos.cost)||0,realizedProfit=0;
  (state.trades||[]).filter(v=>v.ticker===String(pos.ticker)&&v.date<=d).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.appliedAtKST||'').localeCompare(String(b.appliedAtKST||''))||String(a.id||'').localeCompare(String(b.id||''))).forEach(v=>{
    if(v.type==='buy'){
      qty+=Number(v.qty)||0;
      cost+=Number(v.amount)||0;
      return;
    }
    const sellQty=Math.min(qty,Number(v.qty)||0);
    const unitCost=qty>0?cost/qty:0;
    const soldCost=unitCost*sellQty;
    qty-=sellQty;
    cost-=soldCost;
    realizedProfit+=(Number(v.amount)||0)-soldCost;
    if(Math.abs(cost)<1e-6)cost=0;
  });
  return {qty,cost,realizedProfit};
}
function pensionBatchLinkedSnapshotsForTrade(state,trade){
  if(!trade)return [];
  return (state.cashSnapshots||[]).filter(v=>v.date>=String(trade?.date||'')&&pensionCashSnapshotReflectsTrade(v,trade)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function pensionBatchLinkedSnapshotForTrade(state,trade){
  return pensionBatchLinkedSnapshotsForTrade(state,trade)[0]||null;
}
function pensionBatchLinkedSnapshotsForContribution(state,contribution){
  if(!contribution)return [];
  return (state.cashSnapshots||[]).filter(v=>v.date>=String(contribution?.date||'')&&pensionCashSnapshotReflectsContribution(v,contribution)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function pensionBatchLinkedSnapshotForContribution(state,contribution){
  return pensionBatchLinkedSnapshotsForContribution(state,contribution)[0]||null;
}
function pensionBatchDeleteDependencyOrder(operations,baseState=pensionBatchBaseState()){
  const ordered=[...operations];
  let reordered=false;
  const cashDeleteForDate=date=>ordered.find(v=>v.action==='delete'&&v.target==='cashSnapshot'&&String(v.key)===String(date));
  const moveBefore=(moveOp,beforeOp)=>{
    const from=ordered.indexOf(moveOp),to=ordered.indexOf(beforeOp);
    if(from<0||to<0||from<to)return;
    ordered.splice(from,1);
    ordered.splice(ordered.indexOf(beforeOp),0,moveOp);
    reordered=true;
  };
  [...ordered].forEach(op=>{
    if(op.action!=='delete'||(op.target!=='etfTrade'&&op.target!=='contribution'))return;
    const source=op.target==='etfTrade'?baseState.trades:baseState.contributions;
    const item=source.find(v=>String(v.id)===String(op.key));
    if(!item)return;
    const linkedSnapshots=op.target==='etfTrade'?pensionBatchLinkedSnapshotsForTrade(baseState,item):pensionBatchLinkedSnapshotsForContribution(baseState,item);
    linkedSnapshots.forEach(linked=>{
      const cashDelete=cashDeleteForDate(linked.date);
      if(cashDelete)moveBefore(cashDelete,op);
    });
  });
  return {operations:ordered,reordered};
}
function pensionBatchSimulate(operations=pensionEditorState.batchQueue){
  const base=pensionBatchBaseState();
  const orderInfo=pensionBatchDeleteDependencyOrder(operations,base);
  const state=pensionBatchCloneState(base);
  const today=kstTodayText();
  orderInfo.operations.forEach((op,index)=>{
    if(!op||!['upsert','delete'].includes(op.action)||!['cashSnapshot','contribution','etfTrade'].includes(op.target))throw new Error(`${index+1}번 작업 형식이 올바르지 않습니다.`);
    if(op.action==='delete'){
      if(op.target==='cashSnapshot'){
        const before=state.cashSnapshots.length;
        state.cashSnapshots=state.cashSnapshots.filter(v=>String(v.date)!==String(op.key));
        if(state.cashSnapshots.length===before)throw new Error(`${op.key} 현금성자산 삭제 대상을 찾지 못했습니다.`);
        return;
      }
      const list=op.target==='etfTrade'?state.trades:state.contributions;
      const item=list.find(v=>String(v.id)===String(op.key));
      if(!item)throw new Error(`${index+1}번 삭제 대상을 찾지 못했습니다.`);
      const linked=op.target==='etfTrade'?pensionBatchLinkedSnapshotForTrade(state,item):pensionBatchLinkedSnapshotForContribution(state,item);
      if(linked)throw new Error(`${linked.date} 현금성자산 삭제 작업을 먼저 추가해주세요.`);
      if(op.target==='etfTrade')state.trades=state.trades.filter(v=>String(v.id)!==String(op.key));
      else state.contributions=state.contributions.filter(v=>String(v.id)!==String(op.key));
      return;
    }

    const item={...(op.item||{})};
    if(op.target==='cashSnapshot'){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||''))||!Number.isFinite(Number(item.valuation))||Number(item.valuation)<0||!Number.isFinite(Number(item.costBasis))||Number(item.costBasis)<0)throw new Error(`${index+1}번 현금성자산 저장값을 확인해주세요.`);
      const saved={
        ...item,
        date:String(item.date),
        valuation:Math.round(Number(item.valuation)),
        costBasis:Math.round(Number(item.costBasis)),
        afterTradeIds:state.trades.filter(v=>v.date<=item.date).map(v=>String(v.id)).filter(Boolean),
        afterContributionIds:state.contributions.filter(v=>v.date<=item.date).map(v=>String(v.id)).filter(Boolean),
        updatedAtKST:`batch-${String(index).padStart(4,'0')}`
      };
      state.cashSnapshots=state.cashSnapshots.filter(v=>String(v.date)!==saved.date);
      state.cashSnapshots.push(saved);
      state.cashSnapshots.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      return;
    }
    if(op.target==='contribution'){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||''))||!Number.isFinite(Number(item.amount))||Number(item.amount)<=0)throw new Error(`${index+1}번 기업적립금 저장값을 확인해주세요.`);
      const saved={...item,id:item.id||op.tempId||`batch-contrib-${index}`,date:String(item.date),amount:Math.round(Number(item.amount)),updatedAtKST:`batch-${String(index).padStart(4,'0')}`};
      state.contributions=state.contributions.filter(v=>String(v.id)!==String(saved.id));
      state.contributions.push(saved);
      state.contributions.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
      return;
    }

    const product=(dataState.portfolio?.pension||[]).find(v=>String(v.ticker)===String(item.ticker));
    if(!product)throw new Error(`${index+1}번 추가 매수 상품이 현재 목록에 없습니다.`);
    const qty=Number(item.qty),amount=Math.round(Number(item.amount));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(item.tradeDate||''))||String(item.tradeDate)>today)throw new Error(`${index+1}번 추가 매수 신청일을 확인해주세요.`);
    if(!Number.isInteger(qty)||qty<=0||!Number.isFinite(amount)||amount<=0)throw new Error(`${index+1}번 추가 매수 수량·금액을 확인해주세요.`);
    const cashBefore=pensionBatchCashAvailable(state,today);
    if(cashBefore<amount)throw new Error(`${index+1}번 추가 매수 금액이 현금성자산보다 큽니다. 작업 순서를 확인해주세요.`);
    const saved={...item,id:item.id||op.tempId||`batch-trade-${index}`,date:today,applyDate:today,tradeDate:String(item.tradeDate),ticker:String(item.ticker),name:product.name,type:'buy',qty,price:amount/qty,amount,funding:'pension_cash',cashBefore,cashAfter:cashBefore-amount,updatedAtKST:`batch-${String(index).padStart(4,'0')}`,appliedAtKST:`batch-${String(index).padStart(4,'0')}`};
    state.trades=state.trades.filter(v=>String(v.id)!==String(saved.id));
    state.trades.push(saved);
    state.trades.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.appliedAtKST||'').localeCompare(String(b.appliedAtKST||''))||String(a.id).localeCompare(String(b.id)));
  });
  return {state,orderedOperations:orderInfo.operations,reordered:orderInfo.reordered};
}
function pensionBatchCurrentState(){
  try{return pensionBatchSimulate(pensionEditorState.batchQueue).state}catch(_){return null}
}
function pensionBatchOperationDescription(op){
  if(op.action==='delete'){
    const item=op.sourceItem||{};
    if(op.target==='cashSnapshot')return `삭제 · 현금성자산 · ${op.key}${item.valuation!=null?` · ${won(item.valuation)}`:''}`;
    if(op.target==='contribution')return `삭제 · 기업적립금 · ${item.date||''} · ${won(item.amount||0)}`;
    return `삭제 · 추가 매수 · ${item.tradeDate||item.date||''} · ${item.name||item.ticker||''} ${fmt(item.qty||0)}좌 / ${won(item.amount||0)}`;
  }
  const item=op.item||{};
  if(op.target==='cashSnapshot')return `저장 · 현금성자산 · ${item.date} · 평가 ${won(item.valuation)} · 매수원금 ${won(item.costBasis)}`;
  if(op.target==='contribution')return `저장 · 기업적립금 · ${item.date} · +${won(item.amount)}`;
  return `저장 · 추가 매수 · 신청 ${item.tradeDate} · ${item.name||item.ticker} ${fmt(item.qty)}좌 / ${won(item.amount)}`;
}
function renderPensionBatchQueue(){
  const panel=document.getElementById('pensionBatchPanel');
  const list=document.getElementById('pensionBatchQueueList');
  const count=document.getElementById('pensionBatchTitleCount');
  const badge=document.getElementById('pensionBatchModeCount');
  const apply=document.getElementById('pensionBatchApplyButton');
  const clear=document.getElementById('pensionBatchClearButton');
  const note=document.getElementById('pensionBatchOrderNote');
  if(panel)panel.hidden=!pensionEditorState.batchMode;
  if(count)count.textContent=`${pensionEditorState.batchQueue.length}건`;
  if(badge)badge.textContent=String(pensionEditorState.batchQueue.length);
  if(clear)clear.disabled=pensionEditorState.batchQueue.length===0;
  if(list){
    list.innerHTML=pensionEditorState.batchQueue.length?pensionEditorState.batchQueue.map((op,index)=>`<div class="pension-batch-item"><div class="pension-batch-index">${index+1}</div><div class="pension-batch-item-text">${escapeHtml(pensionBatchOperationDescription(op))}</div><div class="pension-batch-item-actions"><button type="button" class="control-icon-button-compact" data-pension-action="move-batch" data-pension-qid="${op.qid}" data-pension-direction="-1" aria-label="위로" ${index===0?'disabled':''}>${navIconSvg('chevronUp')}</button><button type="button" class="control-icon-button-compact" data-pension-action="move-batch" data-pension-qid="${op.qid}" data-pension-direction="1" aria-label="아래로" ${index===pensionEditorState.batchQueue.length-1?'disabled':''}>${navIconSvg('chevronDown')}</button><button type="button" class="control-icon-button-compact remove" data-pension-action="remove-batch" data-pension-qid="${op.qid}" aria-label="작업 제거">${navIconSvg('trash')}</button></div></div>`).join(''):'<div class="pension-batch-empty">아직 추가된 작업이 없습니다.</div>';
  }
  let error='';let reordered=false;
  if(pensionEditorState.batchQueue.length){
    try{const simulated=pensionBatchSimulate(pensionEditorState.batchQueue);reordered=simulated.reordered}catch(e){error=e.message||String(e)}
  }
  if(note){
    if(error){note.hidden=false;note.className='pension-batch-order-note error';note.textContent=error}
    else if(reordered){note.hidden=false;note.className='pension-batch-order-note';note.textContent='연결된 현금성자산 삭제가 필요한 작업은 안전한 순서로 자동 조정해 일괄 처리합니다.'}
    else{note.hidden=true;note.textContent='';note.className='pension-batch-order-note'}
  }
  if(apply){
    apply.disabled=pensionEditorState.batchQueue.length===0||!!error||pensionEditorState.batchApplying;
    apply.textContent=pensionEditorState.batchApplying?'처리 중...':(pensionEditorState.batchQueue.length?`${pensionEditorState.batchQueue.length}건 일괄 적용`:'일괄 적용');
  }
  schedulePensionContributionModalHeight();
}
function syncPensionBatchModeUi(){
  document.querySelectorAll('.pension-work-mode-btn').forEach(btn=>{const active=(btn.dataset.mode==='batch')===pensionEditorState.batchMode;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
  const save=document.getElementById('pensionContribSaveButton');
  const del=document.getElementById('pensionContribDeleteButton');
  if(save)save.textContent=pensionEditorState.batchMode?'작업 모음에 추가':'저장';
  if(del)del.textContent=pensionEditorState.batchMode?'삭제 작업 추가':'선택 항목 삭제';
  renderPensionBatchQueue();
}
function setPensionBatchMode(enabled){
  const nextMode=!!enabled;
  const changed=pensionEditorState.batchMode!==nextMode;
  pensionEditorState.batchMode=nextMode;
  if(changed){
    clearPensionContributionStatus('pensionContribStatus');
    clearPensionContributionStatus('pensionContribDeleteStatus');
    clearPensionContributionOutput();
  }
  syncPensionBatchModeUi();
  updatePensionEtfTradePreview();
}
function pensionBatchOperationFingerprint(operation){
  const op=operation||{};
  if(op.action==='delete')return `delete|${String(op.target||'')}|${String(op.key||'')}`;
  const item=op.item||{};
  if(op.target==='cashSnapshot')return `upsert|cashSnapshot|${String(item.date||'')}|${String(item.valuation??'')}|${String(item.costBasis??'')}|${String(item.memo||'')}`;
  if(op.target==='contribution')return `upsert|contribution|${String(item.date||'')}|${String(item.amount??'')}|${String(item.memo||'')}`;
  if(op.target==='etfTrade')return `upsert|etfTrade|${String(item.tradeDate||'')}|${String(item.ticker||'')}|${String(item.qty??'')}|${String(item.amount??'')}|${String(item.memo||'')}`;
  return `${String(op.action||'')}|${String(op.target||'')}|${JSON.stringify(item)}`;
}
function resetPensionBatchRequestId(){
  pensionEditorState.batchRequestId='';
}
function getPensionBatchRequestId(){
  if(pensionEditorState.batchRequestId)return pensionEditorState.batchRequestId;
  const uuid=(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
  pensionEditorState.batchRequestId=`pension-batch-${uuid}`;
  return pensionEditorState.batchRequestId;
}
function pensionBatchDuplicateError(message,code){
  const error=new Error(message);
  error.code=code;
  return error;
}
function showPensionBatchDuplicateToast(error){
  if(error?.code!=='PENSION_BATCH_DUPLICATE'&&error?.code!=='PENSION_BATCH_DUPLICATE_DELETE')return false;
  showPensionToast(error.message||'이미 추가된 작업입니다.');
  return true;
}
function addPensionBatchOperation(operation){
  clearPensionContributionOutput();
  const now=Date.now();
  const fingerprint=pensionBatchOperationFingerprint(operation);
  if(fingerprint&&fingerprint===pensionEditorState.batchLastAddFingerprint&&now-pensionEditorState.batchLastAddAt<800)throw pensionBatchDuplicateError('이미 추가된 작업입니다.','PENSION_BATCH_DUPLICATE');
  const nextSequence=pensionEditorState.batchSequence+1;
  const op={...operation,qid:`batch-${now}-${nextSequence}`,tempId:`batch-temp-${now}-${nextSequence}`};
  if(op.action==='delete'&&pensionEditorState.batchQueue.some(v=>v.action==='delete'&&v.target===op.target&&String(v.key)===String(op.key)))throw pensionBatchDuplicateError('이미 추가된 삭제 항목입니다.','PENSION_BATCH_DUPLICATE_DELETE');
  pensionBatchSimulate([...pensionEditorState.batchQueue,op]);
  pensionEditorState.batchSequence=nextSequence;
  pensionEditorState.batchQueue.push(op);
  pensionEditorState.batchLastAddFingerprint=fingerprint;
  pensionEditorState.batchLastAddAt=now;
  resetPensionBatchRequestId();
  clearPensionContributionStatus('pensionBatchStatus');
  renderPensionBatchQueue();
  return op;
}
function removePensionBatchOperation(qid){
  clearPensionContributionOutput();
  pensionEditorState.batchQueue=pensionEditorState.batchQueue.filter(v=>v.qid!==qid);
  pensionEditorState.batchLastAddFingerprint='';
  pensionEditorState.batchLastAddAt=0;
  resetPensionBatchRequestId();
  clearPensionContributionStatus('pensionBatchStatus');
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
}
function movePensionBatchOperation(qid,direction){
  const index=pensionEditorState.batchQueue.findIndex(v=>v.qid===qid);
  const next=index+Number(direction||0);
  if(index<0||next<0||next>=pensionEditorState.batchQueue.length)return;
  clearPensionContributionOutput();
  const [item]=pensionEditorState.batchQueue.splice(index,1);
  pensionEditorState.batchQueue.splice(next,0,item);
  resetPensionBatchRequestId();
  clearPensionContributionStatus('pensionBatchStatus');
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
}
function clearPensionBatchQueue(){
  clearPensionContributionOutput();
  pensionEditorState.batchQueue=[];
  pensionEditorState.batchLastAddFingerprint='';
  pensionEditorState.batchLastAddAt=0;
  resetPensionBatchRequestId();
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
  clearPensionContributionStatus('pensionBatchStatus');
  showPensionToast('작업 모음을 비웠습니다.');
}
function showPensionBatchStatus(message,type='err'){
  setPensionContributionStatus('pensionBatchStatus',message,type);
}
async function savePensionBatchViaGithubPages(operations,pin,batchRequestId){
  const config=DASHBOARD_WRITE_CONFIG.githubPages;
  if(!config.url||config.url.includes('여기에_'))throw new Error('GitHub Pages 저장 URL이 설정되지 않았습니다.');
  const payload={pin:String(pin||'').trim(),action:'batchPension',batchRequestId:String(batchRequestId||'').trim(),operations:operations.map(op=>({action:op.action,target:op.target,key:op.key||'',item:op.item||null}))};
  const res=await fetchWithTimeout(config.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
  const data=await readJsonResponse(res,'작업 모음 일괄 적용');
  if(!data.ok)throw new Error(data.error||'작업 모음 일괄 적용에 실패했습니다.');
  return data;
}
function applyPensionBatchStateLocally(state){
  if(!state)return;
  dataState.pensionCashSnapshots=Array.isArray(dataState.pensionCashSnapshots)?(state.cashSnapshots||[]):{...(dataState.pensionCashSnapshots||{}),snapshots:state.cashSnapshots||[]};
  dataState.pensionContributions=Array.isArray(dataState.pensionContributions)?(state.contributions||[]):{...(dataState.pensionContributions||{}),contributions:state.contributions||[]};
  dataState.pensionTrades=Array.isArray(dataState.pensionTrades)?(state.trades||[]):{...(dataState.pensionTrades||{}),trades:state.trades||[]};
}
async function applyPensionBatchQueue(renderDashboard){
  if(pensionEditorState.batchApplying)return;
  if(!pensionEditorState.batchQueue.length)return;
  let simulated;
  try{simulated=pensionBatchSimulate(pensionEditorState.batchQueue)}catch(e){showPensionBatchStatus(e.message||String(e),'err');return}
  const count=pensionEditorState.batchQueue.length;
  const batchRequestId=getPensionBatchRequestId();
  pensionEditorState.batchApplying=true;
  renderPensionBatchQueue();
  try{
    clearPensionContributionStatus('pensionBatchStatus');
    const data=await requestPensionActionPin({
      title:'작업 모음 일괄 적용',
      description:`저장·삭제 ${count}건을 한 번에 적용합니다. 하나라도 실패하면 전체 작업을 반영하지 않습니다.`,
      execute:pin=>savePensionBatchViaGithubPages(simulated.orderedOperations,pin,batchRequestId)
    });
    if(!data)return;
    const duplicateWithoutState=!!data.duplicate&&!data.state;
    if(!duplicateWithoutState)applyPensionBatchStateLocally(data.state);
    clearPensionContributionOutput();
    pensionEditorState.batchQueue=[];
    pensionEditorState.batchLastAddFingerprint='';
    pensionEditorState.batchLastAddAt=0;
    resetPensionBatchRequestId();
    pensionEditorState.batchMode=true;
    renderDashboard?.();
    openPensionContributionModal();
    setPensionBatchMode(true);
    clearPensionContributionStatus('pensionBatchStatus');
    showPensionToast(duplicateWithoutState
      ?'이미 적용된 작업입니다. 새로고침해 확인해주세요.'
      :`작업 ${count}건을 적용했습니다.`);
  }finally{
    pensionEditorState.batchApplying=false;
    renderPensionBatchQueue();
  }
}

// [PEDIT09] Persistence / Save/Delete · 저장 / 삭제
async function savePensionContributionViaGithubPages(item,pin){
  const config=DASHBOARD_WRITE_CONFIG.githubPages;
  if(!config.url || config.url.includes('여기에_'))throw new Error('GitHub Pages 저장 URL이 설정되지 않았습니다.');
  const payload={...item,pin:String(pin||'').trim(),target:item.target||'contribution',action:'upsert',updatedBy:'github-pages'};
  const res=await fetchWithTimeout(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  const data=await readJsonResponse(res,'GitHub Pages 방식 저장');
  if(!data.ok)throw new Error(data.error||'GitHub Pages 방식 저장 실패');
  return data;
}

async function savePensionContribution(){
  clearPensionContributionStatus('pensionContribStatus');
  clearPensionContributionStatus('pensionContribDeleteStatus');
  clearPensionContributionOutput();
  try{
    if(pensionEditorState.batchMode&&pensionContributionTarget()==='etfTrade'){
      const qtyRaw=String(document.getElementById('pensionEtfTradeQty')?.value||'').trim();
      const amountRaw=String(document.getElementById('pensionEtfTradeAmount')?.value||'').trim();
      const last=pensionEditorState.batchQueue.at(-1);
      if(!qtyRaw&&!amountRaw&&last?.action==='upsert'&&last?.target==='etfTrade'&&Date.now()-pensionEditorState.batchLastAddAt<800){
        throw pensionBatchDuplicateError('이미 추가된 작업입니다.','PENSION_BATCH_DUPLICATE');
      }
    }
    const item=buildPensionContributionItem();
    const targetText=pensionContributionTargetLabel(item.target);
    if(pensionEditorState.batchMode){
      addPensionBatchOperation({action:'upsert',target:item.target,item});
      showPensionContributionOutput(item);
      if(item.target==='etfTrade'){
        const qtyEl=document.getElementById('pensionEtfTradeQty');
        const amountEl=document.getElementById('pensionEtfTradeAmount');
        if(qtyEl)qtyEl.value='';
        if(amountEl)amountEl.value='';
        updatePensionEtfTradePreview();
      }
      clearPensionContributionStatus('pensionContribStatus');
      showPensionToast('작업 모음에 추가했습니다.');
      return;
    }
    clearPensionContributionStatus('pensionContribStatus');
    showPensionContributionOutput(item);
    const data=await requestPensionActionPin({
      title:`${targetText} 저장`,
      description:pensionSavePinDescription(item),
      execute:pin=>savePensionContributionViaGithubPages(item,pin)
    });
    if(!data){clearPensionContributionOutput();return}
    if(data.item){
      upsertPensionItemLocally(item.target,data.item);
      if(item.target==='etfTrade'){
        const qtyEl=document.getElementById('pensionEtfTradeQty');
        const amountEl=document.getElementById('pensionEtfTradeAmount');
        if(qtyEl) qtyEl.value='';
        if(amountEl) amountEl.value='';
        updatePensionEtfTradePreview();
      }
      syncPensionContributionDeleteCard(item.target);
    }
    clearPensionContributionStatus('pensionContribStatus');
    showPensionToast(`${pensionContributionTargetObjectLabel(item.target)} 저장했습니다.`);
  }catch(e){
    if(showPensionBatchDuplicateToast(e)){clearPensionContributionStatus('pensionContribStatus');return}
    if(e?.code==='PENSION_EDITOR_INTERNAL'){console.error('[Pension editor]',e);clearPensionContributionStatus('pensionContribStatus');return}
    showPensionContributionStatus(e.message||String(e),'err');
  }
}

async function deletePensionContributionViaGithubPages(target,key,pin){
  const config=DASHBOARD_WRITE_CONFIG.githubPages;
  if(!config.url || config.url.includes('여기에_'))throw new Error('GitHub Pages 삭제 URL이 설정되지 않았습니다.');
  const isCash=target==='cashSnapshot';
  const res=await fetchWithTimeout(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({pin:String(pin||'').trim(),target:target||'contribution',action:'delete',id:isCash?'':key,date:isCash?key:''})
  });
  const data=await readJsonResponse(res,'GitHub Pages 방식 삭제');
  if(!data.ok)throw new Error(data.error||'GitHub Pages 방식 삭제 실패');
  return data;
}

async function deleteSelectedPensionContribution(){
  clearPensionContributionStatus('pensionContribStatus');
  clearPensionContributionStatus('pensionContribDeleteStatus');
  const selected=document.querySelector('input[name="pensionContribDeleteTarget"]:checked');
  if(!selected){showPensionContributionDeleteStatus('삭제할 항목을 선택해주세요.','err');return}
  const [target,key]=String(selected.value||'').split('|');
  const isCash=target==='cashSnapshot';
  const isTrade=target==='etfTrade';
  const item=isCash
    ?pensionCashSnapshotItems().find(v=>v.date===key)
    :(isTrade?pensionTradeItems().find(v=>v.id===key):pensionContributionItems().find(v=>v.id===key));
  const targetText=pensionContributionTargetLabel(target);
  if(pensionEditorState.batchMode){
    try{
      addPensionBatchOperation({action:'delete',target,key,sourceItem:item?{...item}:null});
      selected.checked=false;
      clearPensionContributionStatus('pensionContribDeleteStatus');
      showPensionToast('작업 모음에 추가했습니다.');
    }catch(e){
      if(showPensionBatchDuplicateToast(e)){clearPensionContributionStatus('pensionContribDeleteStatus');return}
      showPensionContributionDeleteStatus(e.message||String(e),'err');
    }
    return;
  }
  if(isTrade&&item){
    const linkedSnapshot=linkedPensionCashSnapshotForTrade(item);
    if(linkedSnapshot){
      showPensionContributionDeleteStatus(`${linkedSnapshot.date} 현금성자산 기록을 먼저 삭제해주세요.`,'err');
      return;
    }
  }
  if(target==='contribution'&&item){
    const linkedSnapshot=linkedPensionCashSnapshotForContribution(item);
    if(linkedSnapshot){
      showPensionContributionDeleteStatus(`${linkedSnapshot.date} 현금성자산 기록을 먼저 삭제해주세요.`,'err');
      return;
    }
  }
  clearPensionContributionStatus('pensionContribDeleteStatus');
  const data=await requestPensionActionPin({
    title:`${targetText} 삭제`,
    description:pensionDeletePinDescription(target,item,key),
    danger:true,
    execute:pin=>deletePensionContributionViaGithubPages(target,key,pin)
  });
  if(!data)return;
  removePensionItemLocally(target,key);
  syncPensionContributionDeleteCard(target);
  if(target==='etfTrade') updatePensionEtfTradePreview();
  clearPensionContributionStatus('pensionContribDeleteStatus');
  showPensionToast(`${pensionContributionTargetObjectLabel(target)} 삭제했습니다.`);
}

// [PEDIT10] Event Delegation / Keyboard / Native Date Picker · 이벤트 위임 / 키보드 / 네이티브 날짜 선택
function handlePensionTargetTabKeydown(event,tab){
  const tabs=[...tab.closest('[role="tablist"]')?.querySelectorAll('.contrib-target-option[role="tab"]')||[]];
  if(!tabs.length)return false;
  const current=Math.max(0,tabs.indexOf(tab));
  let next=current;
  if(event.key==='ArrowRight')next=(current+1)%tabs.length;
  else if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=tabs.length-1;
  else return false;
  event.preventDefault();
  const target=tabs[next];
  setPensionContributionTarget(target.dataset.target||'cashSnapshot');
  target.focus();
  return true;
}

function openPensionDatePickerForPointer(event){
  const input=event.target?.closest?.('.contrib-modal .pension-date-shell input[type="date"]');
  if(!input||typeof input.showPicker!=='function'||!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  try{input.showPicker()}catch(_){/* Native date interaction remains the fallback. */}
}

function handlePensionAction(control,renderDashboard){
  const action=control.dataset.pensionAction;
  if(action==='reset-form')return resetPensionContributionForm();
  if(action==='close-modal')return closePensionContributionModal();
  if(action==='set-batch-mode')return setPensionBatchMode(control.dataset.pensionEnabled==='true');
  if(action==='set-target')return setPensionContributionTarget(control.dataset.target||'cashSnapshot');
  if(action==='save')return savePensionContribution();
  if(action==='delete-selected')return deleteSelectedPensionContribution();
  if(action==='clear-batch')return clearPensionBatchQueue();
  if(action==='apply-batch')return applyPensionBatchQueue(renderDashboard);
  if(action==='move-batch')return movePensionBatchOperation(control.dataset.pensionQid||'',Number(control.dataset.pensionDirection||0));
  if(action==='remove-batch')return removePensionBatchOperation(control.dataset.pensionQid||'');
}
function setupPensionEventDelegation({renderDashboard}={}){
  document.addEventListener('keydown',event=>{
    const targetTab=event.target?.closest?.('.contrib-target-option[role="tab"]');
    if(targetTab)handlePensionTargetTabKeydown(event,targetTab);
  });
  document.addEventListener('click',event=>{
    openPensionDatePickerForPointer(event);
    const control=event.target?.closest?.('[data-pension-action]');
    if(control)handlePensionAction(control,renderDashboard);
  });
  document.addEventListener('change',event=>{
    const changed=event.target;
    if(changed?.matches?.('input[name="pensionContribDeleteTarget"]')){
      clearPensionContributionStatus('pensionContribStatus');
      clearPensionContributionStatus('pensionContribDeleteStatus');
    }else if(changed?.closest?.('.contrib-modal .pension-contrib-tool')){
      clearPensionContributionStatus('pensionContribStatus');
      clearPensionContributionOutput();
    }
    const control=changed?.closest?.('[data-pension-change]');
    if(control?.dataset.pensionChange==='trade-preview')updatePensionEtfTradePreview();
    if(changed?.closest?.('.contrib-modal'))schedulePensionContributionModalHeight();
  });
  document.addEventListener('input',event=>{
    const changed=event.target;
    if(changed?.closest?.('.contrib-modal .pension-contrib-tool')){
      clearPensionContributionStatus('pensionContribStatus');
      clearPensionContributionOutput();
    }
    const control=changed?.closest?.('[data-pension-input]');
    if(!control)return;
    const mode=control.dataset.pensionInput;
    if(mode==='money'||mode==='money-preview')formatPensionMoneyInput(control);
    if(mode==='trade-preview'||mode==='money-preview')updatePensionEtfTradePreview();
    if(changed?.closest?.('.contrib-modal'))schedulePensionContributionModalHeight();
  });
  window.addEventListener('resize',schedulePensionContributionModalHeight);
  window.addEventListener('orientationchange',schedulePensionContributionModalHeight);
}

// [PEDIT11] Public API
export {
  openPensionContributionModal,
  renderPensionContributionModal,
  setupPensionEventDelegation
};
