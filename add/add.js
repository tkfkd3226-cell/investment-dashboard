// =========================================================
// ADD unified runtime
// - Calc / Report가 add.js 하나를 공유하고 data-add-page로 실행 경계를 분리한다.
// - Calc의 순수 계산 함수만 CommonJS 경로로 노출해 Node 회귀테스트에 사용한다.
// =========================================================
(() => {
  if(typeof document==='undefined'||typeof window==='undefined')return;
  const root=document.documentElement;
  const page=root.dataset.addPage;
  try{
    if(localStorage.getItem('investmentDashboard.theme')==='dark')root.classList.add('dark');
    if(localStorage.getItem('investmentDashboard.cornerTheme')==='rounded')root.classList.add('rounded-corners');
  }catch{}

  // Report의 iPhone '데스크탑 웹사이트 요청' 보정은 viewport 계산 전에 적용한다.
  if(page==='report'){
    const ua=navigator.userAgent||'';
    const desktopAppleUA=/Macintosh/.test(ua)&&!/(iPhone|iPad|iPod)/.test(ua);
    const touchApple=(navigator.maxTouchPoints||0)>0;
    const shortSide=Math.min(screen.width||9999,screen.height||9999);
    if(desktopAppleUA&&touchApple&&shortSide<=500){
      const viewport=document.querySelector('meta[name="viewport"]');
      if(viewport)viewport.setAttribute('content','width=1280');
      root.classList.add('iphone-request-desktop');
    }
  }
})();

// ==================== Calc ====================
(() => {
  const isCommonJs=typeof module==='object'&&!!module.exports;
  const isCalcPage=typeof document!=='undefined'&&typeof window!=='undefined'&&document.documentElement.dataset.addPage==='calc';
  if(!isCommonJs&&!isCalcPage)return;

  // 01. 고정 데이터 / 프리셋
  // 거래유형 기본값과 이전 거래 없음 빠른 매수값을 한곳에서 관리
  const presets = {
    'buy-2026-07-29': {
      caseType:'holding', noPrior:false, existingShares:38, existingCost:7005530, priorSettlementValue:0, priorSellPrice:0,
      currentPrice:79020, oldRecovery:3700000, addPrice:74350, addShares:604, autoBreakEvenTarget:true, mode:'current'
    },
    'buy-2026-07-30': {
      caseType:'settled', noPrior:false, priorSellDate:'2026-07-30', existingShares:642, existingCost:51912930, priorSettlementValue:47880490, priorSellPrice:74580,
      currentPrice:75595, oldRecovery:0, addPrice:82680, addShares:576, autoBreakEvenTarget:true, mode:'current'
    },
    'current-only': {
      caseType:'settled', noPrior:true, priorSellDate:'', existingShares:0, existingCost:0, priorSettlementValue:0, priorSellPrice:0,
      currentPrice:80000, oldRecovery:0, addPrice:80000, addShares:100, autoBreakEvenTarget:true, mode:'current'
    }
  };
  const currentPurchasePresets = {
    'buy-2026-08-04': {addPrice:94417, currentPrice:95335, addShares:532, actualSellPrice:104035},
    'buy-2026-08-06': {addPrice:91767, currentPrice:92200, addShares:100, actualSellPrice:93813}
  };
  const defaultPresetId='current-only';

  // 02. 런타임 상태 / 공통 유틸리티
  // 현재 거래유형·계산모드·프리셋 상태와 숫자/문자열/저장소 공통 함수
  // 계산에 직접 영향을 주는 상태
  let caseType='settled', noPriorMode=true, mode='current', autoBreakEvenTarget=false;

  // 화면 선택 상태와 프리셋 적용 중 여부
  let activePresetId=defaultPresetId, currentPurchasePresetId=null, applying=false;

  // 마지막 정상 계산결과가 존재하는지 추적해 invalid 입력 중 stale 결과임을 명확히 표시
  let hasRenderedCalculation=false;

  const $=id=>document.getElementById(id);
  const nf0=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});
  const won=n=>`${nf0.format(Math.round(Number.isFinite(n)?n:0))}원`;
  const shareText=n=>`${nf0.format(Math.round(Number.isFinite(n)?n:0))}주`;
  const signedIntText=n=>`${n>=0?'+':''}${nf0.format(Math.round(Number.isFinite(n)?n:0))}`;
  const pct=(n,d=2)=>`${n>=0?'+':''}${new Intl.NumberFormat('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n)}%`;
  const parseNum=v=>{const s=String(v??'').replace(/,/g,'').trim();if(s==='')return NaN;const n=Number(s);return Number.isFinite(n)?n:NaN;};
  const ceil5=n=>Math.ceil((n-1e-9)/5)*5;
  const signClass=n=>n>0?'positive':n<0?'negative':'zero';
  const setClass=(node,cls)=>{node.classList.remove('positive','negative','zero');if(cls)node.classList.add(cls);};
  const setText=(id,text,cls)=>{const n=$(id);n.classList.remove('has-help');n.textContent=text;if(cls)setClass(n,cls);};
  const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const setHelpText=(id,text,tip)=>{const n=$(id),tooltipId=`${id}Tooltip`;n.classList.add('has-help');n.innerHTML=`<span class="inline-help-label"><span>${esc(text)}</span><span class="help-tooltip"><button type="button" class="help-icon add-button" aria-label="${esc(text)} 설명" aria-describedby="${tooltipId}" aria-expanded="false">i</button><span class="custom-tooltip" id="${tooltipId}" role="tooltip">${esc(tip)}</span></span></span>`;};
  const formatPctInput=n=>Number(n).toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
  const readPct=id=>{const n=$(id);return n.dataset.exactValue!==undefined?parseNum(n.dataset.exactValue):parseNum(n.value);};
  const setPct=(id,n,digits=2)=>{const el=$(id);el.dataset.exactValue=String(n);el.value=Number(n).toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');};
  const storage={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}},remove:k=>{try{localStorage.removeItem(k);}catch{}}};

  // 03. 거래유형별 화면 문구 설정
  // 보유 중 추가매수와 이전 거래 후 재매수에서 바뀌는 라벨·설명·탭 문구 정의
  const CASE_UI_COPY={
    settled:{
      text:{
        priorGroupTitle:'이전 거래',priorGroupSub:'실제 거래금액 기준',currentGroupTitle:'현재 보유분',
        currentPriceLabel:'매수일 종가',addPriceLabel:'매수단가',addSharesLabel:'보유수량',actualLoanLabel:'투자금액',currentBuyGainLabel:'손익률',
        out1Label:'평가금액',out2Label:'현재 보유분 손익',out3Label:'이전 손익 포함 통합손익',
        modeCurrent:'매수일 종가',modeRise:'매수가',modeTarget:'목표단가',
        overnightLabel:'매수일 종가 대비 목표 변동률',riseLabel:'매수가 대비 목표 변동률',
        tabS3:'① 전체 보유분 매도',tabS1:'② 투자원금만 회수'
      },
      currentGroupSub:{withPrior:'현재 보유 기준',noPrior:'신규·단일 보유 기준'},
      heroDescription:{
        withPrior:'이전 거래 손익과 현재 보유분 분리 · 손익분기, 통합 회복가격, 매도 결과 계산 · 수수료·세금 등 거래비용 제외',
        noPrior:'이전 거래 없이 현재 보유분만 입력 · 손익분기, 목표가격, 매도 결과 계산 · 수수료·세금 등 거래비용 제외'
      }
    },
    holding:{
      text:{
        priorGroupTitle:'기존 보유분',priorGroupSub:'기본 투자 정보',existingAvgLabel:'원래 평단',existingSharesLabel:'보유수량',
        existingCostLabel:'투자금액',existingValueLabel:'평가금액',existingPLLabel:'손익',oldRecoveryLabel:'기존 회수 대상 금액',
        currentGroupTitle:'추가매수 내역',currentPriceLabel:'추가매수 당일 종가',addPriceLabel:'추가매수단가',addSharesLabel:'추가매수수량',
        actualLoanLabel:'추가매수금액',currentBuyGainLabel:'추가매수가 대비 종가 변동률',out1Label:'최종 평단',out2Label:'최종 평가금액',
        out3Label:'최종 보유수량',out4Label:'추가매수 반영 총손익',out5Label:'최종 투자금액',out6Label:'추가매수 반영 총손익률',
        modeCurrent:'매수일 종가',modeRise:'추가매수가',modeTarget:'목표단가',overnightLabel:'다음 거래일 변동률',riseLabel:'추가매수가 대비 변동률',
        heroDescription:'추가매수 당일 종가 또는 추가매수가 대비 변동률 기준 · 목표 매도단가와 3가지 손실 회복 방식 자동 계산 · 수수료·세금 등 거래비용 제외',
        tabS3:'① 전체 보유분 매도',tabS2:'② 추가매수 수량 매도',tabS1:'③ 추가매수 원금만 회수'
      },
      currentGroupSubHtml:'<span class="desktop-only">실제 체결 기준 · 3개 전략 공통</span><span class="mobile-only">실제 체결 기준</span>'
    }
  };

  function setTextMap(values){Object.entries(values).forEach(([id,text])=>{$(id).textContent=text;});}
  function getCaseContext(){const settled=caseType==='settled';return {settled,noPrior:settled&&noPriorMode};}

  // 04. 공통 계산 보조 함수
  // 이전 거래 손익과 통합 회복가격처럼 여러 흐름에서 재사용하는 순수 계산
  function priorPLFrom(v){return (v.priorSettlementValue||0)-(v.existingCost||0);}
  function integratedRecoveryOrder(v){
    const qty=v.addShares||0, principal=(v.addPrice||0)*qty;
    const priorPL=priorPLFrom(v);
    if(qty<=0||v.currentPrice<=0)return 0;
    return ceil5(Math.max(principal-priorPL,0)/qty);
  }

  // 05. 거래유형 UI 구성 / DOM 재배치
  // 거래유형 변경 시 필드 위치·표시 여부·접근성 상태를 함께 동기화
  function setPresetActive(id){document.querySelectorAll('.preset-btn').forEach(b=>{const active=b.dataset.preset===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
  function setCurrentPurchasePresetActive(id){document.querySelectorAll('.current-purchase-btn').forEach(b=>{const active=b.dataset.currentPurchasePreset===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
  function getActualSellPrice(){
    if(noPriorMode)return currentPurchasePresets[currentPurchasePresetId]?.actualSellPrice??null;
    return caseType==='settled'?91065:74580;
  }
  function updateActualSellPriceUI(){
    const actualSellPrice=getActualSellPrice();
    const visible=Number.isFinite(actualSellPrice);
    $('applyActualSellPrice').classList.toggle('hidden',!visible);
    if(!visible)return;
    const display=nf0.format(actualSellPrice);
    $('actualSellPriceValue').textContent=display;
    $('applyActualSellPrice').setAttribute('aria-label',`실제 매도 단가 ${display}를 목표 매도단가에 반영`);
  }
  function disableAutoBreakEven(){if(!applying&&autoBreakEvenTarget){autoBreakEvenTarget=false;setMode(mode,false);}}

  function moveCurrentPrice(settled){
    const field=$('currentPriceField');
    if(settled){$('currentPriceSlot').after(field);}else{$('currentPriceAnchor').after(field);}
  }

  function reorderCurrentFields(settled){
    const container=$('currentFields');
    const currentGroup=$('currentGroup');
    currentGroup.classList.toggle('holding-layout',!settled);
    currentGroup.classList.toggle('settled-layout',settled);

    if(settled){
      const settledSections={
        settledCostSection:['addPriceField','addSharesField','actualLoanField'],
        settledEvaluationSection:['currentPriceField','out1Field','currentBuyGainField'],
        settledResultSection:['out2Field','out3Field']
      };
      Object.entries(settledSections).forEach(([sectionId,ids])=>{
        const section=$(sectionId);
        ids.forEach(id=>{const el=$(id);if(el)section.appendChild(el);});
      });
      ['out4Field','out5Field','out6Field','breakEvenInputField']
        .forEach(id=>{const el=$(id);if(el)container.appendChild(el);});
      return;
    }

    const sections={
      purchaseInputSection:['addPriceField','addSharesField','actualLoanField'],
      postPurchaseSection:['out1Field','out3Field','out5Field'],
      closeEvaluationSection:['currentPriceField','currentBuyGainField','out2Field'],
      recoveryResultSection:['out4Field','out6Field','breakEvenInputField']
    };
    Object.entries(sections).forEach(([sectionId,ids])=>{
      const section=$(sectionId);
      ids.forEach(id=>{const el=$(id);if(el)section.appendChild(el);});
    });
  }

  function reorderHoldingPriorFields(settled){
    const container=$('holdingPriorFields');
    const priorGroup=$('priorGroup');
    priorGroup.classList.toggle('holding-layout',!settled);
    if(settled) return;

    const sections={
      existingPurchaseSection:['existingAvgField','existingSharesField','existingCostField'],
      existingEvaluationSection:['existingValueField','existingPLField','oldRecoveryField']
    };
    Object.entries(sections).forEach(([sectionId,ids])=>{
      const section=$(sectionId);
      ids.forEach(id=>{const el=$(id);if(el)section.appendChild(el);});
    });
  }

  function applySettledCaseUI(noPrior){
    const copy=CASE_UI_COPY.settled;
    setTextMap(copy.text);
    $('currentGroupSub').textContent=noPrior?copy.currentGroupSub.noPrior:copy.currentGroupSub.withPrior;
    $('heroDescription').textContent=noPrior?copy.heroDescription.noPrior:copy.heroDescription.withPrior;

    $('currentPriceField').classList.remove('hidden');
    $('out3Field').classList.toggle('hidden',noPrior);
    ['out4Field','out5Field','out6Field','breakEvenInputField'].forEach(id=>$(id).classList.add('hidden'));
    $('strategyTabs').classList.add('settled-tabs');
    $('tabS2').classList.add('hidden');
    $('s2').classList.add('hidden');
  }

  function applyHoldingCaseUI(){
    setTextMap(CASE_UI_COPY.holding.text);
    $('currentGroupSub').innerHTML=CASE_UI_COPY.holding.currentGroupSubHtml;

    $('priorGroup').classList.remove('hidden');
    $('inputGrid').classList.remove('no-prior-layout');
    $('currentGroup').classList.remove('no-prior-current');
    $('out3Field').classList.remove('hidden');
    $('holdingPriorFields').classList.remove('hidden');
    $('settledPriorSummary').style.display='none';
    ['out4Field','out5Field','out6Field','breakEvenInputField'].forEach(id=>$(id).classList.remove('hidden'));
    $('strategyTabs').classList.remove('settled-tabs');
    $('tabS2').classList.remove('hidden');
    $('s2').classList.remove('hidden');
  }

  function updateStepperAccessibility(){
    document.querySelectorAll('.share-step-btn,.pct-step-btn').forEach(btn=>{
      const input=$(btn.dataset.target),label=input?.closest('.field')?.querySelector('label');
      const delta=parseNum(btn.dataset.delta);
      if(!input||!label||!Number.isFinite(delta))return;
      const name=label.textContent.replace(/\s+/g,' ').trim();
      const amount=btn.classList.contains('share-step-btn')?`${Math.abs(delta)}주`:`${Math.abs(delta)}%p`;
      btn.setAttribute('aria-label',`${name} ${amount} ${delta<0?'감소':'증가'}`);
    });
  }

  function updateCaseUI(){
    const {settled,noPrior}=getCaseContext();
    updateActualSellPriceUI();
    $('inputGrid').classList.toggle('no-prior-layout',noPrior);
    $('inputGrid').classList.toggle('holding-case',!settled);
    $('currentGroup').classList.toggle('no-prior-current',noPrior);
    $('priorGroup').classList.toggle('hidden',noPrior);
    moveCurrentPrice(settled);
    $('holdingPriorFields').classList.toggle('hidden',settled);
    $('settledPriorSummary').style.display=settled&&!noPrior?'block':'none';

    if(settled)applySettledCaseUI(noPrior);
    else applyHoldingCaseUI();

    reorderCurrentFields(settled);
    reorderHoldingPriorFields(settled);
    updateStepperAccessibility();
    setMode(mode,false);
  }

  // 06. 입력 수집 / 검증
  // 화면 값을 계산용 숫자로 읽고 거래유형별 필수조건을 검증
  function getInputs(){
    const {settled}=getCaseContext();
    const existingShares=settled?parseNum($('priorSoldSharesInput').value):parseNum($('existingShares').value);
    const priorCost=settled?parseNum($('priorCostInput').value):parseNum($('existingCost').value);
    const priorProceeds=settled?parseNum($('priorSettlementValueInput').value):parseNum($('priorSettlementValue').value);
    const priorSellPrice=existingShares>0?priorProceeds/existingShares:0;
    const priorPL=settled?priorProceeds-priorCost:0;
    return {
      caseType, noPrior:noPriorMode, priorSellDate:settled?$('priorSellDateInput').value:'', existingShares, existingCost:priorCost,
      priorSettlementValue:priorProceeds, priorSellPrice, currentPrice:parseNum($('currentPrice').value),
      oldRecovery:settled?0:parseNum($('oldOverdraft').value), addPrice:parseNum($('addPrice').value), addShares:parseNum($('addShares').value),
      overnightPct:readPct('overnightPct'), risePct:readPct('risePct'), targetPrice:parseNum($('targetPrice').value)
    };
  }

  function validate(i,options){
    const settled=options.caseType==='settled';
    const validationMode=options.mode;
    const errors=[];
    const invalidIds=[];
    const addError=(message,id)=>{errors.push(message);if(id)invalidIds.push(id);};
    const checks=[['currentPrice',settled?'매수일 종가':'추가매수 당일 종가',i.currentPrice,n=>Number.isInteger(n)&&n>0],['addPrice',settled?'매수단가':'추가매수단가',i.addPrice,n=>Number.isInteger(n)&&n>0],['addShares',settled?'보유수량':'추가매수수량',i.addShares,n=>Number.isInteger(n)&&n>=0]];
    if(!settled)checks.push(['existingShares','기존 보유수량',i.existingShares,n=>Number.isInteger(n)&&n>=0],['existingCost','기존 보유분 투자금액',i.existingCost,n=>Number.isInteger(n)&&n>=0],['oldOverdraft','기존 회수 대상 금액',i.oldRecovery,n=>Number.isInteger(n)&&n>=0]);
    if(validationMode==='current')checks.push(['overnightPct',settled?'매수일 종가 대비 목표 변동률':'다음 거래일 변동률',i.overnightPct,n=>Number.isFinite(n)&&n>-100]);
    else if(validationMode==='rise')checks.push(['risePct',settled?'매수가 대비 목표 변동률':'추가매수가 대비 변동률',i.risePct,n=>Number.isFinite(n)&&n>-100]);
    for(const [id,label,v,test] of checks){if(!test(v))addError(`${label} 값 확인 필요.`,id);}
    const totalShares=(settled?0:i.existingShares)+i.addShares;
    if(totalShares<=0)addError(settled?'보유수량 1주 이상 필요.':'최종 보유수량 1주 이상 필요.');
    if(settled){
      const priorNumericChecks=[
        ['priorSoldSharesInput','매도수량',i.existingShares,n=>Number.isInteger(n)&&n>=0],
        ['priorCostInput','매수금액',i.existingCost,n=>Number.isInteger(n)&&n>=0],
        ['priorSettlementValueInput','매도금액',i.priorSettlementValue,n=>Number.isInteger(n)&&n>=0]
      ];
      for(const [id,label,v,test] of priorNumericChecks){if(!test(v))addError(`${label} 값 확인 필요.`,id);}
      const hasPriorTrade=i.existingShares>0||i.existingCost>0||i.priorSettlementValue>0;
      if(hasPriorTrade){
        if(!/^\d{4}-\d{2}-\d{2}$/.test(i.priorSellDate))addError('매도일 값 확인 필요.','priorSellDateInput');
        if(!(Number.isInteger(i.existingShares)&&i.existingShares>0))addError('이전 거래 입력 시 매도수량 1주 이상 필요.','priorSoldSharesInput');
      }
    }
    if(validationMode==='target'&&!(Number.isInteger(i.targetPrice)&&i.targetPrice>0))addError('목표 매도단가 값 확인 필요.','targetPrice');
    return {errors:[...new Set(errors)],invalidIds:[...new Set(invalidIds)]};
  }

  function setCalculationResultsStale(stale){
    document.documentElement.classList.toggle('calc-results-stale',stale);
  }

  function renderValidation(validation){
    document.querySelectorAll('.control.invalid').forEach(n=>n.classList.remove('invalid'));
    validation.invalidIds.forEach(id=>{const n=$(id);if(n)n.classList.add('invalid');});
    const b=$('validationMessage');
    if(!validation.errors.length){b.classList.remove('show');b.innerHTML='';return;}
    const resultNote=hasRenderedCalculation
      ? '<div class="validation-result-note">아래 결과는 마지막 정상 입력 기준입니다. 입력값을 수정하면 자동으로 다시 계산됩니다.</div>'
      : '<div class="validation-result-note">입력값을 수정하면 결과가 자동으로 계산됩니다.</div>';
    b.classList.add('show');
    b.innerHTML=`입력값 확인 필요.${resultNote}<ul>${validation.errors.map(e=>`<li>${e}</li>`).join('')}</ul>`;
  }

  // 07. 핵심 계산 엔진
  // 입력값을 받아 보유현황·목표가격·전략별 매도결과를 계산하며 DOM은 직접 수정하지 않음
  function compute(i,options){
    const settled=options.caseType==='settled';
    const noPrior=!!options.noPrior;
    const calculationMode=options.mode;
    const useAutoBreakEvenTarget=!!options.autoBreakEvenTarget;
    const input={...i};
    const inputUpdates={};
    const priorAvg=input.existingShares?input.existingCost/input.existingShares:0;
    const priorValue=settled?input.priorSettlementValue:input.currentPrice*input.existingShares;
    const priorPL=settled?input.priorSettlementValue-input.existingCost:priorValue-input.existingCost;
    const recoveryAmount=settled?0:input.oldRecovery;
    const addedPrincipal=input.addPrice*input.addShares;
    const finalShares=(settled?0:input.existingShares)+input.addShares;
    const finalCost=(settled?0:input.existingCost)+addedPrincipal;
    const finalAvg=finalShares?finalCost/finalShares:0;
    const currentValue=input.currentPrice*finalShares;
    const currentPositionPL=currentValue-finalCost;
    const currentPositionPLRate=finalCost?currentPositionPL/finalCost*100:0;
    const integratedCurrentPL=currentPositionPL+(settled?priorPL:0);
    const positionBERaw=finalShares?finalCost/finalShares:0;
    const positionBE=Math.ceil(positionBERaw), positionBEOrder=ceil5(positionBERaw);
    const integratedBasis=settled?Math.max(finalCost-priorPL,0):finalCost+recoveryAmount;
    const integratedBERaw=finalShares?integratedBasis/finalShares:0;
    const integratedBE=Math.ceil(integratedBERaw), integratedBEOrder=ceil5(integratedBERaw);
    let targetPrice;
    if(calculationMode==='current'&&useAutoBreakEvenTarget){
      targetPrice=settled&&!noPrior?integratedBEOrder:positionBEOrder;
      input.overnightPct=input.currentPrice?(targetPrice/input.currentPrice-1)*100:0;
      input.risePct=input.addPrice?(targetPrice/input.addPrice-1)*100:0;
      inputUpdates.overnightPct=input.overnightPct;
      inputUpdates.risePct=input.risePct;
    }else if(calculationMode==='current'){
      targetPrice=ceil5(input.currentPrice*(1+input.overnightPct/100));
      input.risePct=input.addPrice?(targetPrice/input.addPrice-1)*100:0;
      inputUpdates.risePct=input.risePct;
    }else if(calculationMode==='rise'){
      targetPrice=ceil5(input.addPrice*(1+input.risePct/100));
      input.overnightPct=input.currentPrice?(targetPrice/input.currentPrice-1)*100:0;
      inputUpdates.overnightPct=input.overnightPct;
    }else{
      targetPrice=ceil5(input.targetPrice);
      input.overnightPct=input.currentPrice?(targetPrice/input.currentPrice-1)*100:0;
      input.risePct=input.addPrice?(targetPrice/input.addPrice-1)*100:0;
      inputUpdates.overnightPct=input.overnightPct;
      inputUpdates.risePct=input.risePct;
    }
    const targetPositionNet=targetPrice*finalShares-finalCost;
    const targetIntegratedPL=targetPositionNet+(settled?priorPL:0);
    const addZeroRaw=input.addShares?input.addPrice:null;
    function strategy(type){
      const valuePerShare=targetPrice;
      let saleQty=type==='full'?finalShares:type==='addOnly'?input.addShares:Math.min(finalShares,valuePerShare>0?Math.ceil(addedPrincipal/valuePerShare):finalShares);
      const gross=targetPrice*saleQty, sellFee=0, net=gross;
      const realizedPL=net-finalAvg*saleQty;
      const remainShares=finalShares-saleQty, remainCost=finalAvg*remainShares, remainValue=targetPrice*remainShares;
      const remainPL=remainValue-remainCost;
      const currentCombined=realizedPL+remainPL;
      const combined=currentCombined+(settled?priorPL:0);
      const principalRecovered=Math.min(net,addedPrincipal), principalShortfall=Math.max(addedPrincipal-net,0);
      const remainAfterPrincipal=Math.max(net-addedPrincipal,0);
      const recoveryPaid=Math.min(remainAfterPrincipal,recoveryAmount), recoveryBalance=Math.max(recoveryAmount-recoveryPaid,0), cashAfter=Math.max(remainAfterPrincipal-recoveryPaid,0);
      return {saleQty,gross,sellFee,net,realizedPL,remainShares,remainCost,remainValue,remainPL,currentCombined,combined,principalRecovered,principalShortfall,recoveryPaid,recoveryBalance,cashAfter};
    }
    return {i:input,inputUpdates,settled,noPrior,priorAvg,priorValue,priorPL,recoveryAmount,integratedBasis,addedPrincipal,finalShares,finalCost,finalAvg,r:0,buyFee:0,allInCost:finalCost,currentValue,currentPositionPL,currentPositionPLRate,integratedCurrentPL,positionBE,positionBEOrder,integratedBE,integratedBEOrder,targetPrice,targetPositionNet,targetIntegratedPL,addZeroRaw,sFull:strategy('full'),sAdd:strategy('addOnly'),sPrincipal:strategy('principal')};
  }

  // 08. 결과 렌더링
  // 계산결과를 KPI·전략카드·상세표·모바일 카드에 반영
  function renderCalculationInputs(c){
    if(c.inputUpdates.overnightPct!==undefined)setPct('overnightPct',c.inputUpdates.overnightPct);
    if(c.inputUpdates.risePct!==undefined)setPct('risePct',c.inputUpdates.risePct);
  }

  function metric(name,value,cls=''){return `<div class="summary-card add-card-shell add-card-control"><div class="sname">${name}</div><div class="svalue ${cls}">${value}</div></div>`;}
  function desktopTable(headers,vals,extra=''){return `<div class="table-scroll add-table-scroll desktop-data"><table class="add-data-table calc-data-table ${extra}"><thead><tr>${headers.map(h=>`<th scope="col" class="add-table-cell-center">${h}</th>`).join('')}</tr></thead><tbody><tr>${vals.map(v=>`<td class="add-table-cell-center ${v.cls||''}">${v.text}</td>`).join('')}</tr></tbody></table></div>`;}
  function mobileRows(title,headers,vals){return `<div class="mobile-data-card add-card-shell add-card-control"><div class="mobile-section-title add-heading-minor">${title}</div>${headers.map((h,k)=>`<div class="mobile-data-row"><div class="mobile-data-label">${h}</div><div class="mobile-data-value ${vals[k].cls||''}">${vals[k].text}</div></div>`).join('')}</div>`;}

  function holdingStrategyHTML(typeNo,displayNo,title,badge,badgeCls,desc,d,c){
    const saleH=['매도단가','매도수량','매도금액','실현손익','매도 후 보유수량'];
    const saleV=[{text:won(c.targetPrice)},{text:shareText(d.saleQty)},{text:won(d.gross)},{text:won(d.realizedPL),cls:signClass(d.realizedPL)},{text:shareText(d.remainShares)}];
    const flowH=['추가매수 원금 회수액','투입금액 회수 후 잔여현금','추가매수 원금 미회수액','기존 금액 회수액','기존 회수 대상 잔액','추가투입금·회수대상 차감 후 잔여현금'];
    const flowV=[{text:won(d.principalRecovered)},{text:won(Math.max(d.net-c.addedPrincipal,0))},{text:won(d.principalShortfall),cls:d.principalShortfall?'negative':''},{text:won(d.recoveryPaid)},{text:won(d.recoveryBalance),cls:d.recoveryBalance?'negative':''},{text:won(d.cashAfter),cls:d.cashAfter?'positive':''}];
    const full=typeNo===3;
    const remH=full?['보유수량','합산 손익']:['평단','보유수량','투자금액','평가가격','평가금액','평가손익','합산 손익'];
    const remV=full?[{text:shareText(d.remainShares)},{text:won(d.combined),cls:signClass(d.combined)}]:[{text:won(c.finalAvg)},{text:shareText(d.remainShares)},{text:won(d.remainCost)},{text:won(c.targetPrice)},{text:won(d.remainValue)},{text:won(d.remainPL),cls:signClass(d.remainPL)},{text:won(d.combined),cls:signClass(d.combined)}];
    return `<div class="panel strategy-card add-card-shell add-card-base add-card-shadow"><div class="strategy-head"><div class="strategy-title"><h2 class="add-heading-section">${displayNo} ${title}</h2><p>${desc}</p></div><span class="badge ${badgeCls}">${badge}</span></div><div class="strategy-body"><div class="summary-row">${metric('매도금액',won(d.net))}${metric('합산 손익',won(d.combined),signClass(d.combined))}${metric('추가투입금·회수대상 차감 후 잔여현금',won(d.cashAfter),d.cashAfter?'positive':'')}${metric('추가매수 전 대비 손익 개선액',won(d.combined-(c.i.existingShares*c.targetPrice-c.i.existingCost)),signClass(d.combined-(c.i.existingShares*c.targetPrice-c.i.existingCost)))}</div><div class="desktop-details"><div class="section-title add-heading-subsection">매도 결과</div>${desktopTable(saleH,saleV,'five-grid')}<div class="section-title add-heading-subsection">원금 회수 결과</div>${desktopTable(flowH,flowV,'loan-grid')}<div class="section-title add-heading-subsection">${full?'매도 후 최종 상태':'매도 후 보유 현황'}</div>${desktopTable(remH,remV,full?'final-grid':'')}</div><div class="mobile-data">${mobileRows('매도 결과',saleH,saleV)}${mobileRows('원금 회수 결과',flowH,flowV)}${mobileRows(full?'매도 후 최종 상태':'매도 후 보유 현황',remH,remV)}</div><div class="note">${typeNo===1?'매도금액이 추가매수금액 이상이 되도록 필요한 최소 매도수량 올림 처리.':typeNo===2?`추가매수 수량 ${shareText(c.i.addShares)} 그대로 매도 · 기존 보유분 유지.`:'전체 보유분 매도 후 보유수량 0주.'} 수수료·세금 등 거래비용 미반영.</div></div></div>`;
  }

  function settledStrategyHTML(kind,d,c){
    const full=kind==='full';
    const title=full?'① 전체 보유분 매도':'② 투자원금만 회수';
    const desc=c.noPrior
      ?(full?'<span class="desktop-only">현재 보유분 전량 매도 시 실현손익 계산.</span><span class="mobile-only">전량 매도 후 실현손익 계산.</span>':'<span class="desktop-only">매도금액이 현재 투자금액에 도달하도록 최소 수량만 매도 · 잔여 보유분 유지.</span><span class="mobile-only">원금 회수분만 매도 · 잔여 보유분 유지.</span>')
      :(full?`<span class="desktop-only">현재 ${shareText(c.finalShares)} 전량 매도 시 현재 보유분과 이전 거래 확정손익 합산.</span><span class="mobile-only">전량 매도 후 현재 보유분·이전 손익 합산.</span>`:'<span class="desktop-only">매도금액이 현재 투자금액에 도달하도록 최소 수량만 매도 · 잔여 보유분 유지.</span><span class="mobile-only">원금 회수분만 매도 · 잔여 보유분 유지.</span>');
    const saleH=['매도단가','매도수량','매도금액','현재 보유분 실현손익','매도 후 보유수량'];
    const saleV=[{text:won(c.targetPrice)},{text:shareText(d.saleQty)},{text:won(d.gross)},{text:won(d.realizedPL),cls:signClass(d.realizedPL)},{text:shareText(d.remainShares)}];
    const integratedH=c.noPrior?['목표가격 기준 손익','목표가격 수익률']:['현재 보유분 손익','이전 거래 확정손익','통합손익'];
    const targetRate=c.finalCost?d.currentCombined/c.finalCost*100:0;
    const integratedV=c.noPrior?[{text:won(d.currentCombined),cls:signClass(d.currentCombined)},{text:pct(targetRate,2),cls:signClass(targetRate)}]:[{text:won(d.currentCombined),cls:signClass(d.currentCombined)},{text:won(c.priorPL),cls:signClass(c.priorPL)},{text:won(d.combined),cls:signClass(d.combined)}];
    const remainH=full?['보유수량',c.noPrior?'최종 손익':'최종 통합손익']:['남은 보유수량','남은 투자원가','목표가격 평가금액','남은 보유분 평가손익'];
    const remainV=full?[{text:shareText(0)},{text:won(c.noPrior?d.currentCombined:d.combined),cls:signClass(c.noPrior?d.currentCombined:d.combined)}]:[{text:shareText(d.remainShares)},{text:won(d.remainCost)},{text:won(d.remainValue)},{text:won(d.remainPL),cls:signClass(d.remainPL)}];
    const warning=!full&&d.principalShortfall>0?`<div class="warning-note add-card-shell">현재 목표가격에서 전량 매도 시에도 투자원금 ${won(d.principalShortfall)} 부족.</div>`:'';
    const summary=c.noPrior
      ?`${metric('매도금액',won(d.net))}${metric('현재 보유분 실현손익',won(d.realizedPL),signClass(d.realizedPL))}${metric('매도 후 보유수량',shareText(d.remainShares))}${metric('목표가격 기준 전체 손익',won(d.currentCombined),signClass(d.currentCombined))}`
      :`${metric('매도금액',won(d.net))}${metric('현재 보유분 손익',won(d.currentCombined),signClass(d.currentCombined))}${metric('이전 거래 확정손익',won(c.priorPL),signClass(c.priorPL))}${metric('통합손익',won(d.combined),signClass(d.combined))}`;
    const integrationTitle=c.noPrior?'손익 요약':'손익 통합';
    const integrationGridClass=c.noPrior?'final-grid':'triple-grid';
    const note=c.noPrior
      ?(full?'현재 보유분 최종 실현손익.':'현재 투자원금만 회수 · 잔여 주식은 목표가격 기준 평가금액으로 표시.')
      :(full?'현재 보유분 실현손익 + 이전 거래 확정손익으로 통합손익 계산.':'현재 투자원금만 회수 · 잔여 주식은 목표가격 기준 평가금액으로 표시. 이전 거래 확정손익은 통합손익에 계속 포함.');
    return `<div class="panel strategy-card no-badge add-card-shell add-card-base add-card-shadow"><div class="strategy-head"><div class="strategy-title"><h2 class="add-heading-section">${title}</h2><p>${desc}</p></div></div><div class="strategy-body"><div class="summary-row">${summary}</div><div class="desktop-details"><div class="section-title add-heading-subsection">매도 결과</div>${desktopTable(saleH,saleV,'five-grid')}<div class="section-title add-heading-subsection">${integrationTitle}</div>${desktopTable(integratedH,integratedV,integrationGridClass)}<div class="section-title add-heading-subsection">${full?'매도 후 최종 상태':'원금 회수 후 보유 현황'}</div>${desktopTable(remainH,remainV,full?'final-grid':'simple-grid')}</div><div class="mobile-data">${mobileRows('매도 결과',saleH,saleV)}${mobileRows(integrationTitle,integratedH,integratedV)}${mobileRows(full?'매도 후 최종 상태':'원금 회수 후 보유 현황',remainH,remainV)}</div>${warning}<div class="note">${note} 수수료·세금 등 거래비용 미반영.</div></div></div>`;
  }

  function render(c){
    $('existingOriginalAvg').value=nf0.format(Math.round(c.priorAvg));
    $('existingCurrentValue').value=nf0.format(Math.round(c.priorValue));
    $('existingCurrentPL').value=signedIntText(c.priorPL);setClass($('existingCurrentPL'),signClass(c.priorPL));
    $('actualLoan').value=nf0.format(Math.round(c.addedPrincipal));
    const displayedRate=c.settled?c.currentPositionPLRate:((c.i.currentPrice/c.i.addPrice-1)*100);
    $('currentBuyGain').value=pct(displayedRate,2);setClass($('currentBuyGain'),signClass(displayedRate));
    $('brokerBreakEven').value=nf0.format(c.settled?c.integratedBE:c.positionBE);
    if(!(mode==='target'&&document.activeElement===$('targetPrice')))$('targetPrice').value=nf0.format(c.targetPrice);

    if(c.settled){
      $('out1').value=nf0.format(Math.round(c.currentValue));setClass($('out1'),'');
      $('out2').value=signedIntText(c.currentPositionPL);setClass($('out2'),signClass(c.currentPositionPL));
      $('out3').value=signedIntText(c.noPrior?c.currentPositionPL:c.integratedCurrentPL);setClass($('out3'),signClass(c.noPrior?c.currentPositionPL:c.integratedCurrentPL));
      $('out5').value='';setClass($('out5'),'');$('out6').value='';setClass($('out6'),'');
      $('priorAvgDisplay').value=nf0.format(Math.round(c.priorAvg));
      $('priorSellPriceDisplay').value=nf0.format(Math.round(c.i.priorSellPrice));
      $('priorPLDisplay').value=signedIntText(c.priorPL);setClass($('priorPLDisplay'),signClass(c.priorPL));
      $('currentGroupSub').textContent=c.noPrior?`현재 ${shareText(c.finalShares)} · 단일 보유 기준`:`현재 ${shareText(c.finalShares)} 기준`;
      if(c.noPrior){
        setText('kpi1Name','현재 보유분 손익분기');setText('kpi1Value',won(c.positionBEOrder));setText('kpi1Sub','거래비용 제외 기준');
        setText('kpi2Name','현재 보유분 손익');setText('kpi2Value',won(c.currentPositionPL),signClass(c.currentPositionPL));setText('kpi2Sub',`매수일 종가 ${won(c.i.currentPrice)} 기준`);
        setText('kpi3Name','목표 매도단가');setText('kpi3Value',won(c.targetPrice),signClass(c.targetPositionNet));setText('kpi3Sub',`손익분기 대비 ${c.targetPrice>=c.positionBEOrder?'+':''}${nf0.format(c.targetPrice-c.positionBEOrder)}원`);
        setText('kpi4Name','목표가격 예상손익');setText('kpi4Value',won(c.targetPositionNet),signClass(c.targetPositionNet));setText('kpi4Sub',`현재 투자금 대비 ${pct(c.finalCost?c.targetPositionNet/c.finalCost*100:0,2)}`);
        setText('range1Title','현재 보유분 손익분기');setText('range1Value',pct((c.positionBEOrder/c.i.currentPrice-1)*100,2),signClass(c.positionBEOrder-c.i.currentPrice));setText('range1Sub',`${won(c.positionBEOrder)} · 매수일 종가 대비 필요 변동률`);
        setText('range2Title','목표가격 변동률');setText('range2Value',pct((c.targetPrice/c.i.currentPrice-1)*100,2),signClass(c.targetPrice-c.i.currentPrice));setText('range2Sub',`${won(c.targetPrice)} · 매수일 종가 ${won(c.i.currentPrice)} 기준`);
        setText('range3Title','목표가격 상태');setText('range3Value',c.targetPositionNet>=0?'손익분기 이상':'손익분기 미달',c.targetPositionNet>=0?'positive':'negative');setText('range3Sub',`${won(c.targetPrice)}에서 예상손익 ${won(c.targetPositionNet)}`);
      }else{
        setText('kpi1Name','현재 보유분 손익분기');setText('kpi1Value',won(c.positionBEOrder));setText('kpi1Sub',`현재 ${shareText(c.finalShares)} 자체의 거래비용 제외 기준`);
        setText('kpi2Name','이전 거래 확정손익');setText('kpi2Value',won(c.priorPL),signClass(c.priorPL));setText('kpi2Sub','이전 거래내역에서 자동 계산');
        setHelpText('kpi3Name','통합 회복가격','현재 보유분 투자금액에 이전 거래 확정손익까지 반영한 통합 손익분기 가격.');setText('kpi3Value',won(c.integratedBEOrder));
        $('kpi3Sub').innerHTML=c.priorPL<0?'<span class="desktop-only">현재 보유분 투자금액·이전 거래 확정손실 전부 회복</span><span class="mobile-only">투자금·이전 손실까지 회복</span>':c.priorPL>0?'<span class="desktop-only">현재 보유분 투자금액에 이전 거래 확정이익 반영</span><span class="mobile-only">투자금에 이전 이익 반영</span>':'<span class="desktop-only">현재 보유분 투자금액 회복</span><span class="mobile-only">투자금 회복</span>';
        setText('kpi4Name','목표 매도단가');setText('kpi4Value',won(c.targetPrice),signClass(c.targetIntegratedPL));setText('kpi4Sub',`목표가격 통합손익 ${won(c.targetIntegratedPL)}`);
        setText('range1Title','현재 보유분 손익분기');setText('range1Value',pct((c.positionBEOrder/c.i.currentPrice-1)*100,2),signClass(c.positionBEOrder-c.i.currentPrice));setText('range1Sub',`${won(c.positionBEOrder)} · 현재 ${shareText(c.finalShares)} 자체 손익분기`);
        setHelpText('range2Title','이전 손익 반영 통합 회복','현재 보유분 투자금액에 이전 거래 확정손익까지 반영한 통합 손익분기 가격.');setText('range2Value',pct((c.integratedBEOrder/c.i.currentPrice-1)*100,2),signClass(c.integratedBEOrder-c.i.currentPrice));setText('range2Sub',c.priorPL<0?`${won(c.integratedBEOrder)} · 이전 거래 확정손실까지 회복`:c.priorPL>0?`${won(c.integratedBEOrder)} · 이전 거래 확정이익 반영`:`${won(c.integratedBEOrder)} · 현재 보유분 자체 손익분기`);
        setText('range3Title','목표가격 통합 상태');setText('range3Value',c.targetIntegratedPL>=0?'통합 회복':'미회복',c.targetIntegratedPL>=0?'positive':'negative');setText('range3Sub',`${won(c.targetPrice)}에서 통합손익 ${won(c.targetIntegratedPL)}`);
      }
      $('s3').innerHTML=settledStrategyHTML('full',c.sFull,c);$('s1').innerHTML=settledStrategyHTML('principal',c.sPrincipal,c);$('s2').innerHTML='';
    }else{
      $('out1').value=nf0.format(Math.round(c.finalAvg));setClass($('out1'),'');
      $('out2').value=nf0.format(Math.round(c.currentValue));setClass($('out2'),'');
      $('out3').value=shareText(c.finalShares);setClass($('out3'),'');
      $('out4').value=signedIntText(c.currentPositionPL);setClass($('out4'),signClass(c.currentPositionPL));
      $('out5').value=nf0.format(Math.round(c.finalCost));setClass($('out5'),'');
      $('out6').value=pct(c.currentPositionPLRate,2);setClass($('out6'),signClass(c.currentPositionPLRate));
      setText('kpi1Name','기존 보유분 원래 평단');setText('kpi1Value',won(c.priorAvg));setText('kpi1Sub','기존 보유분 투자금액 ÷ 기존 보유수량');
      setText('kpi2Name','기존 보유분 손익');setText('kpi2Value',won(c.priorPL),signClass(c.priorPL));setText('kpi2Sub','추가매수 당일 종가 기준 · 추가매수 전');
      setHelpText('kpi3Name','손익분기','기존 보유분과 추가매수분의 전체 투자금액 회수 가격. 기존 회수 대상 금액 제외.');setText('kpi3Value',won(c.positionBE));setText('kpi3Sub','거래비용 제외 기준');
      setText('kpi4Name','목표 매도단가');setText('kpi4Value',won(c.targetPrice),signClass(c.targetPrice-c.positionBE));setText('kpi4Sub',`손익분기 대비 ${c.targetPrice>=c.positionBE?'+':''}${nf0.format(c.targetPrice-c.positionBE)}원`);
      setHelpText('range1Title','추가매수 효과 0원 기준','추가매수분 기준 손익 0원 가격. 기존 보유분 손익과 기존 회수 대상 금액 제외.');setText('range1Value',c.addZeroRaw?pct((c.addZeroRaw/c.i.currentPrice-1)*100,2):'해당 없음',c.addZeroRaw?signClass(c.addZeroRaw-c.i.currentPrice):'zero');setText('range1Sub',c.addZeroRaw?`${won(Math.ceil(c.addZeroRaw))} · 5원 호가 ${won(ceil5(c.addZeroRaw))}`:'추가매수수량 0주.');
      setHelpText('range2Title','손익분기 구간','기존 보유분과 추가매수분의 전체 투자금액 회수 가격. 기존 회수 대상 금액 제외.');setText('range2Value',pct((c.positionBE/c.i.currentPrice-1)*100,2),signClass(c.positionBE-c.i.currentPrice));setText('range2Sub',`${won(c.positionBE)} · 5원 호가 ${won(c.positionBEOrder)}`);
      setText('range3Title','목표가격 상태');setText('range3Value',c.targetPrice>=c.positionBE?'손익분기 이상':'손익분기 미달',c.targetPrice>=c.positionBE?'positive':'negative');setText('range3Sub',`${won(c.targetPrice)} · 손익분기 대비 ${c.targetPrice>=c.positionBE?'+':''}${nf0.format(c.targetPrice-c.positionBE)}원`);
      $('s1').innerHTML=holdingStrategyHTML(1,'③','추가매수 원금만 회수','비추천','bad','추가매수 원금 회수에 필요한 최소 수량만 매도.',c.sPrincipal,c);
      $('s2').innerHTML=holdingStrategyHTML(2,'②','추가매수 수량 매도','조건부 추천','conditional','추가매수 수량만 매도 · 기존 보유분 유지.',c.sAdd,c);
      $('s3').innerHTML=holdingStrategyHTML(3,'①','전체 보유분 매도','추천','good','전체 보유분 매도 · 투입금액 회수 우선.',c.sFull,c);
    }
  }

  // 09. 재계산 흐름 / 계산 기준 모드
  // 입력→검증→계산→렌더 순서를 통제하고 종가·매수가·목표단가 모드를 전환
  function getCalculationOptions(){return {caseType,noPrior:noPriorMode,mode,autoBreakEvenTarget};}

  function recalc(){
    const i=getInputs();
    const options=getCalculationOptions();
    const validation=validate(i,options);
    renderValidation(validation);
    if(validation.errors.length){
      setCalculationResultsStale(hasRenderedCalculation);
      return;
    }
    setCalculationResultsStale(false);
    const c=compute(i,options);
    renderCalculationInputs(c);
    render(c);
    hasRenderedCalculation=true;
    storage.set('investmentLossRecoveryCalcV17',JSON.stringify({...c.i,targetPrice:c.targetPrice,...options,presetId:activePresetId,currentPurchasePresetId}));
  }

  function getModeFormula(activeMode){
    const {settled,noPrior}=getCaseContext();
    if(activeMode==='current'&&autoBreakEvenTarget){
      if(!settled)return '손익분기 가격 기준으로 다음 거래일 변동률 자동 설정';
      return noPrior?'현재 보유분 손익분기 가격 기준으로 목표 변동률 자동 설정':'이전 손익 반영 통합 회복가격 기준으로 목표 변동률 자동 설정';
    }
    if(activeMode==='target')return '목표 매도단가 직접 입력 → 5원 단위 올림 · 두 변동률 자동 계산';
    if(settled)return activeMode==='current'?'매수일 종가 × (1 + 목표 변동률 %) → 5원 단위 올림':'매수단가 × (1 + 목표 변동률 %) → 5원 단위 올림';
    return activeMode==='current'?'추가매수 당일 종가 × (1 + 다음 거래일 변동률 %) → 5원 단위 올림':'추가매수단가 × (1 + 추가매수가 대비 변동률 %) → 5원 단위 올림';
  }

  function setMode(next,doRecalc=true){
    mode=['current','rise','target'].includes(next)?next:'current';
    [['modeCurrent','current'],['modeRise','rise'],['modeTarget','target']].forEach(([id,value])=>{const active=mode===value;$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));});
    $('overnightPct').readOnly=mode!=='current';
    $('risePct').readOnly=mode!=='rise';
    $('targetPrice').readOnly=mode!=='target';
    document.querySelectorAll('.pct-step-btn').forEach(b=>b.disabled=$(b.dataset.target).readOnly);
    $('formulaText').textContent=getModeFormula(mode);
    if(doRecalc)recalc();
  }

  // 10. 프리셋 / 저장상태 적용
  // 프리셋 또는 localStorage 값을 화면 상태에 복원하고 전략 선택상태까지 맞춤
  function applyValues(v){
    caseType=v.caseType||'holding';noPriorMode=!!v.noPrior;mode=['current','rise','target'].includes(v.mode)?v.mode:'current';autoBreakEvenTarget=!!v.autoBreakEvenTarget;currentPurchasePresetId=noPriorMode&&currentPurchasePresets[v.currentPurchasePresetId]?v.currentPurchasePresetId:null;setCurrentPurchasePresetActive(currentPurchasePresetId);
    $('existingShares').value=String(v.existingShares??0);$('existingCost').value=nf0.format(v.existingCost??0);$('priorSettlementValue').value=String(v.priorSettlementValue??0);$('priorSellPrice').value=String(v.priorSellPrice??0);$('currentPrice').value=nf0.format(v.currentPrice??0);$('oldOverdraft').value=nf0.format(v.oldRecovery??0);$('addPrice').value=nf0.format(v.addPrice??0);$('addShares').value=String(v.addShares??0);
    $('priorSellDateInput').value=v.priorSellDate||'';$('priorSoldSharesInput').value=String(v.existingShares??0);$('priorCostInput').value=nf0.format(v.existingCost??0);$('priorSettlementValueInput').value=nf0.format(v.priorSettlementValue??0);
    let overnight=v.overnightPct??0,rise=v.risePct??0,target=v.targetPrice??0;
    if(autoBreakEvenTarget){
      if(caseType==='holding'){
        const shares=(v.existingShares||0)+(v.addShares||0),cost=(v.existingCost||0)+(v.addPrice||0)*(v.addShares||0);
        target=shares?ceil5(cost/shares):0;
      }else if(noPriorMode){
        target=(v.addShares||0)>0?ceil5(v.addPrice||0):0;
      }else{
        target=integratedRecoveryOrder(v);
      }
      overnight=v.currentPrice?(target/v.currentPrice-1)*100:0;
      rise=v.addPrice?(target/v.addPrice-1)*100:0;
    }
    if(!target){target=mode==='rise'?ceil5((v.addPrice||0)*(1+rise/100)):ceil5((v.currentPrice||0)*(1+overnight/100));}
    setPct('overnightPct',overnight);setPct('risePct',rise);$('targetPrice').value=nf0.format(target);
    updateCaseUI();setMode(mode,false);recalc();
  }

  function setStrategyActive(strategyId,{focus=false}={}){
    const tabs=[...document.querySelectorAll('#strategyTabs .tab')];
    tabs.forEach(b=>{const active=b.dataset.tab===strategyId;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    document.querySelectorAll('.strategy').forEach(panel=>{const active=panel.id===strategyId;panel.classList.toggle('active',active);panel.setAttribute('aria-hidden',String(!active));});
    if(focus)tabs.find(b=>b.dataset.tab===strategyId)?.focus();
  }
  function applyPreset(id){if(!presets[id])return;applying=true;activePresetId=id;setPresetActive(id);applyValues({...presets[id]});setStrategyActive('s3');applying=false;}

  // 11. 사용자 이벤트
  // 입력·스테퍼·프리셋·전략탭·초기화 버튼의 이벤트를 한 번만 등록
  function handleMoneyFocus(e){const inp=e.currentTarget,n=parseNum(inp.value);if(Number.isFinite(n))inp.value=String(n);}
  function handleMoneyBlur(e){const inp=e.currentTarget,n=parseNum(inp.value);if(Number.isInteger(n))inp.value=nf0.format(n);recalc();}
  function handleMoneyInput(e){if(e.currentTarget.id==='targetPrice')disableAutoBreakEven();recalc();}
  function handleNumberInput(e){const inp=e.currentTarget;if(inp.id==='overnightPct'||inp.id==='risePct'){delete inp.dataset.exactValue;disableAutoBreakEven();}recalc();}
  function handleShareStep(e){const b=e.currentTarget,inp=$(b.dataset.target),cur=parseNum(inp.value);if(!Number.isFinite(cur))return;inp.value=String(Math.max(0,Math.trunc(cur)+parseNum(b.dataset.delta)));recalc();}
  function handlePctStep(e){const b=e.currentTarget,inp=$(b.dataset.target);if(inp.readOnly)return;const cur=parseNum(inp.value);if(!Number.isFinite(cur))return;delete inp.dataset.exactValue;disableAutoBreakEven();inp.value=formatPctInput(Math.round((cur+parseNum(b.dataset.delta))*1e6)/1e6);recalc();}
  function handleModeChange(next){disableAutoBreakEven();setMode(next);}

  function initEventBindings(){
    document.querySelectorAll('.money-input').forEach(inp=>{inp.addEventListener('focus',handleMoneyFocus);inp.addEventListener('blur',handleMoneyBlur);inp.addEventListener('input',handleMoneyInput);});
    document.querySelectorAll('input[type=number]').forEach(inp=>inp.addEventListener('input',handleNumberInput));
    document.querySelectorAll('.share-step-btn').forEach(b=>b.addEventListener('click',handleShareStep));
    document.querySelectorAll('.pct-step-btn').forEach(b=>b.addEventListener('click',handlePctStep));
    document.querySelectorAll('.preset-btn[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
    $('modeCurrent').addEventListener('click',()=>handleModeChange('current'));$('modeRise').addEventListener('click',()=>handleModeChange('rise'));$('modeTarget').addEventListener('click',()=>handleModeChange('target'));
    document.querySelectorAll('.current-purchase-btn').forEach(b=>b.addEventListener('click',()=>{
      if(!noPriorMode)return;
      const preset=currentPurchasePresets[b.dataset.currentPurchasePreset];
      if(!preset)return;
      currentPurchasePresetId=b.dataset.currentPurchasePreset;
      setCurrentPurchasePresetActive(currentPurchasePresetId);
      activePresetId='current-only';
      setPresetActive(activePresetId);
      autoBreakEvenTarget=true;
      mode='current';
      $('addPrice').value=nf0.format(preset.addPrice);
      $('currentPrice').value=nf0.format(preset.currentPrice);
      $('addShares').value=String(preset.addShares);
      updateActualSellPriceUI();
      setMode('current',false);
      recalc();
    }));
    $('applyActualSellPrice').addEventListener('click',()=>{
      const actualSellPrice=getActualSellPrice();
      if(!Number.isFinite(actualSellPrice))return;
      disableAutoBreakEven();
      setMode('target',false);
      $('targetPrice').value=nf0.format(actualSellPrice);
      recalc();
    });
    $('priorSellDateInput').addEventListener('input',recalc);
    $('resetBtn').addEventListener('click',()=>{storage.remove('investmentLossRecoveryCalcV17');storage.remove('investmentLossRecoveryCalcV16');storage.remove('investmentLossRecoveryCalcV15');storage.remove('investmentLossRecoveryCalcV12');applyPreset(defaultPresetId);});
    document.querySelectorAll('#strategyTabs .tab').forEach(b=>b.addEventListener('click',()=>{if(!b.classList.contains('hidden'))setStrategyActive(b.dataset.tab);}));
    $('strategyTabs').addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      const tabs=[...document.querySelectorAll('#strategyTabs .tab:not(.hidden)')];
      if(!tabs.length)return;
      const current=Math.max(0,tabs.indexOf(document.activeElement));
      const nextIndex=e.key==='Home'?0:e.key==='End'?tabs.length-1:e.key==='ArrowRight'?(current+1)%tabs.length:(current-1+tabs.length)%tabs.length;
      e.preventDefault();
      setStrategyActive(tabs[nextIndex].dataset.tab,{focus:true});
    });
  }

  // 12. 도움말 툴팁
  // 화면 경계를 벗어나지 않도록 위치를 계산하고 마우스·키보드·ESC 동작을 처리
  const positionHelpTooltip=wrap=>{
    if(!wrap)return;
    const btn=wrap.querySelector('.help-icon'),tip=wrap.querySelector('.custom-tooltip');
    if(!btn||!tip)return;
    const margin=12,gap=9,vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
    tip.style.setProperty('--tooltip-left','0px');
    tip.style.setProperty('--tooltip-top','0px');
    tip.classList.remove('tooltip-below');
    const br=btn.getBoundingClientRect(),tr=tip.getBoundingClientRect();
    let left=br.left+br.width/2-tr.width/2;
    left=Math.max(margin,Math.min(left,vw-margin-tr.width));
    const above=br.top-gap-tr.height,below=br.bottom+gap;
    const useBelow=above<margin&&below+tr.height<=vh-margin;
    let top=useBelow?below:above;
    top=Math.max(margin,Math.min(top,vh-margin-tr.height));
    const arrowX=Math.max(12,Math.min(br.left+br.width/2-left,tr.width-12));
    tip.style.setProperty('--tooltip-left',`${Math.round(left)}px`);
    tip.style.setProperty('--tooltip-top',`${Math.round(top)}px`);
    tip.style.setProperty('--tooltip-arrow-x',`${Math.round(arrowX)}px`);
    tip.classList.toggle('tooltip-below',useBelow);
  };
  const repositionVisibleTooltips=()=>document.querySelectorAll('.help-tooltip.is-open,.help-tooltip:hover,.help-tooltip:focus-within').forEach(positionHelpTooltip);
  const closeHelpTooltip=wrap=>{wrap.classList.remove('is-open');const btn=wrap.querySelector('.help-icon');if(btn)btn.setAttribute('aria-expanded','false');};

  function initHelpTooltips(){
    document.addEventListener('pointerover',e=>{const wrap=e.target.closest('.help-tooltip');if(wrap)positionHelpTooltip(wrap);});
    document.addEventListener('focusin',e=>{const wrap=e.target.closest('.help-tooltip');if(wrap)positionHelpTooltip(wrap);});
    window.addEventListener('resize',repositionVisibleTooltips,{passive:true});
    document.addEventListener('scroll',repositionVisibleTooltips,{passive:true,capture:true});
    document.addEventListener('click',e=>{
      const btn=e.target.closest('.help-icon');
      const activeWrap=btn?.closest('.help-tooltip')||null;
      document.querySelectorAll('.help-tooltip.is-open').forEach(w=>{if(w!==activeWrap)closeHelpTooltip(w);});
      if(!btn)return;
      e.stopPropagation();
      positionHelpTooltip(activeWrap);
      const open=activeWrap.classList.toggle('is-open');
      btn.setAttribute('aria-expanded',String(open));
    });
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      document.querySelectorAll('.help-tooltip.is-open').forEach(w=>{const btn=w.querySelector('.help-icon');closeHelpTooltip(w);if(btn)btn.blur();});
    });
  }

  // 13. 초기화 / 부팅
  // 이벤트·툴팁을 등록한 뒤 저장상태가 있으면 복원하고 없으면 기본 프리셋 적용
  function restoreInitialState(){
    const saved=storage.get('investmentLossRecoveryCalcV17');
    if(!saved){
      applyPreset(defaultPresetId);
      return;
    }
    try{
      const v=JSON.parse(saved);
      applying=true;
      activePresetId=v.presetId&&presets[v.presetId]
        ?v.presetId
        :(v.noPrior?'current-only':(v.caseType==='holding'?'buy-2026-07-29':'buy-2026-07-30'));
      setPresetActive(activePresetId);
      applyValues(v);
      applying=false;
    }catch{
      applying=false;
      applyPreset(defaultPresetId);
    }
  }

  // Node 기반 회귀검증에서는 계산/검증 함수만 노출하고 브라우저 부팅은 실행하지 않는다.
  if(isCommonJs)module.exports={compute,validate,ceil5};

  if(isCalcPage){
    const bootCalcPage=()=>{
      initEventBindings();
      initHelpTooltips();
      restoreInitialState();
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootCalcPage,{once:true});
    else bootCalcPage();
  }
})();

// ==================== Report ====================
(() => {
  if(typeof document==='undefined'||typeof window==='undefined'||document.documentElement.dataset.addPage!=='report')return;
  const bootReportPage=()=>{
    // 01. 리포트 데이터 / DOM 참조
    // 거래 원천 데이터에서 합계·표·차트를 파생하고 단일 tablist를 초기화
    const REPORT_DATA = Object.freeze([{"date":"2026-06-09","qty":12,"buy":164170,"sell":165515,"pnl":16140,"fee":165,"segment":"core"},{"date":"2026-06-16","qty":36,"buy":210398,"sell":210554,"pnl":5640,"fee":636,"segment":"day"},{"date":"2026-06-19","qty":15,"buy":235711,"sell":239078,"pnl":50510,"fee":295,"segment":"day"},{"date":"2026-06-23","qty":26,"buy":229138,"sell":229558,"pnl":10945,"fee":499,"segment":"day"},{"date":"2026-06-25","qty":15,"buy":198500,"sell":226985,"pnl":427275,"fee":268,"segment":"core"},{"date":"2026-07-30","qty":642,"buy":80861,"sell":74580,"pnl":-4032440,"fee":4196,"segment":"core"},{"date":"2026-07-31","qty":5946,"buy":101778,"sell":102763,"pnl":5855965,"fee":51183,"segment":"mixed","core":{"qty":576,"buy":82680,"sell":91065,"pnl":4829760,"fee":4212}},{"date":"2026-08-04","qty":371,"buy":90649,"sell":91212,"pnl":209150,"fee":2837,"segment":"day"},{"date":"2026-08-05","qty":1558,"buy":100153,"sell":103259,"pnl":4839995,"fee":13334,"segment":"mixed","core":{"qty":532,"buy":94417,"sell":104035,"pnl":5116776,"fee":4442}},{"date":"2026-08-06","qty":4002,"buy":92364,"sell":92422,"pnl":233340,"fee":31121,"segment":"day"},{"date":"2026-08-07","qty":493,"buy":90384,"sell":90723,"pnl":167090,"fee":3756,"segment":"mixed","core":{"qty":100,"buy":91767,"sell":93813,"pnl":204590,"fee":781}},{"date":"2026-08-12","qty":101,"buy":99463,"sell":100145,"pnl":68905,"fee":846,"segment":"mixed","core":{"qty":32,"buy":92580,"sell":95480,"pnl":92800,"fee":253}},{"date":"2026-08-20","qty":220,"buy":97685,"sell":102650,"pnl":1092275,"fee":1852,"segment":"core"},{"date":"2026-09-02","qty":500,"buy":100630,"sell":101125,"pnl":247500,"fee":4244,"segment":"day"}]);
    
    function reportSum(rows, key){
      return rows.reduce((sum,row)=>sum+Number(row[key]||0),0);
    }
    function deriveReportRows(rows){
      let cumulative=0;
      return rows.map(row=>{
        const net=Number(row.pnl||0)-Number(row.fee||0);
        cumulative+=net;
        return Object.freeze({...row,net,cumulative});
      });
    }
    function deriveSplitRows(rows, segment){
      return rows.flatMap(row=>{
        if(row.segment===segment){
          return [Object.freeze({date:row.date,qty:row.qty,buy:row.buy,sell:row.sell,pnl:row.pnl,fee:row.fee})];
        }
        if(row.segment!=='mixed') return [];
        if(segment==='core'){
          return [Object.freeze({date:row.date,...row.core})];
        }
        return [Object.freeze({
          date:row.date,
          qty:row.qty-row.core.qty,
          pnl:row.pnl-row.core.pnl,
          fee:row.fee-row.core.fee
        })];
      });
    }
    function deriveSplitMetrics(rows){
      const qty=reportSum(rows,'qty');
      const pnl=reportSum(rows,'pnl');
      const fee=reportSum(rows,'fee');
      return Object.freeze({qty,pnl,fee,net:pnl-fee});
    }
    
    const reportDailyRows=Object.freeze(deriveReportRows(REPORT_DATA));
    const coreTradeRows=Object.freeze(deriveSplitRows(REPORT_DATA,'core'));
    const dayTradeRows=Object.freeze(deriveSplitRows(REPORT_DATA,'day'));
    const coreMetrics=deriveSplitMetrics(coreTradeRows);
    const dayMetrics=deriveSplitMetrics(dayTradeRows);
    const totalPnl=reportSum(reportDailyRows,'pnl');
    const totalFee=reportSum(reportDailyRows,'fee');
    const totalNet=reportSum(reportDailyRows,'net');
    const totalQty=reportSum(reportDailyRows,'qty');
    const sellDays=reportDailyRows.length;
    const winDays=reportDailyRows.filter(row=>row.net>0).length;
    const coreNetRatio=totalNet?coreMetrics.net/totalNet*100:0;
    const dayNetRatio=totalNet?dayMetrics.net/totalNet*100:0;
    const splitQty=coreMetrics.qty+dayMetrics.qty;
    const coreQtyRatio=splitQty?coreMetrics.qty/splitQty*100:0;
    const dayQtyRatio=splitQty?dayMetrics.qty/splitQty*100:0;
    
    const reportMetrics=Object.freeze({
      totalPnl,totalFee,totalNet,totalQty,sellDays,winDays,
      winRate:sellDays?winDays/sellDays*100:0,
      coreQty:coreMetrics.qty,corePnl:coreMetrics.pnl,coreFee:coreMetrics.fee,coreNet:coreMetrics.net,
      dayQty:dayMetrics.qty,dayPnl:dayMetrics.pnl,dayFee:dayMetrics.fee,dayNet:dayMetrics.net,
      coreNetRatio,dayNetRatio,coreQtyRatio,dayQtyRatio
    });
    
    const chartData=Object.freeze({
      labels:Object.freeze(reportDailyRows.map(row=>row.date.slice(5))),
      net:Object.freeze(reportDailyRows.map(row=>row.net)),
      cum:Object.freeze(reportDailyRows.map(row=>row.cumulative))
    });
    
    const reportNf0=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});
    function reportNumber(value){
      return reportNf0.format(Number(value||0));
    }
    function reportSigned(value){
      const n=Number(value||0);
      return `${n>0?'+':''}${reportNumber(n)}`;
    }
    function reportMetricText(value,format){
      if(format==='qty') return `${reportNumber(value)}주`;
      if(format==='won') return `${reportNumber(value)}원`;
      if(format==='signedWon') return `${reportSigned(value)}원`;
      if(format==='percent1') return `${Number(value||0).toFixed(1)}%`;
      return reportNumber(value);
    }
    function reportValueClass(value){
      const n=Number(value||0);
      return n<0?'neg':n>0?'pos':'';
    }

    // Timeline의 실현거래 숫자는 REPORT_DATA/분리 파생값을 그대로 사용한다.
    // 매수만 존재해 REPORT_DATA에 없는 포지션 형성 사실만 별도 context로 둔다.
    const reportRowByDate=new Map(reportDailyRows.map(row=>[row.date,row]));
    const coreRowByDate=new Map(coreTradeRows.map(row=>[row.date,row]));
    const dayRowByDate=new Map(dayTradeRows.map(row=>[row.date,row]));
    const POSITION_CONTEXT=Object.freeze({
      legacyBuild:Object.freeze({firstQty:16,firstBuy:203800,secondQty:22,secondBuy:170215}),
      julyAdd:Object.freeze({extraBuy:74350}),
      augustFinalBuild:Object.freeze({firstQty:15,firstBuy:110465,secondBuy:96750})
    });

    function timelineDateShort(date){
      const [,m,d]=date.split('-');
      return `${Number(m)}/${Number(d)}`;
    }
    function timelineRow(date){
      return reportRowByDate.get(date)||null;
    }
    function timelineCore(date){
      return coreRowByDate.get(date)||null;
    }
    function timelineDay(date){
      return dayRowByDate.get(date)||null;
    }
    function timelineClassification(row){
      return row.segment==='mixed'?'본 포지션과 단타가 함께 포함된 매도일.':row.segment==='core'?'본 포지션으로 분류.':'당일 단타로 분류.';
    }
    function timelineEvent(sortDate,range,title,strong,body,net=null){
      return Object.freeze({sortDate,range,title,strong,body,net});
    }
    function timelineGeneric(row){
      const type=row.segment==='core'?'본 포지션 청산':row.segment==='day'?'당일 단타':'혼합 거래';
      return timelineEvent(
        row.date,
        row.date,
        type,
        `${reportNumber(row.qty)}주 · ${reportNumber(row.buy)}원 매수 → ${reportNumber(row.sell)}원 매도`,
        timelineClassification(row),
        row.net
      );
    }
    function buildTimelineEvents(){
      const coveredDates=new Set();
      const events=[];
      const addRealized=(dates,builder)=>{
        const rows=dates.map(timelineRow).filter(Boolean);
        if(rows.length!==dates.length) return;
        dates.forEach(date=>coveredDates.add(date));
        events.push(Object.freeze({...builder(rows),net:reportSum(rows,'net')}));
      };

      addRealized(['2026-06-09'],([row])=>timelineEvent(
        row.date,'2026-06-08~09','첫 오버나이트 거래',
        `${reportNumber(row.qty)}주 · ${reportNumber(row.buy)}원 매수 → ${reportNumber(row.sell)}원 매도`,
        `6/8 매수 후 6/9 청산. 본 포지션으로 분류.`
      ));

      addRealized(['2026-06-16','2026-06-19','2026-06-23'],rows=>{
        const qty=reportSum(rows,'qty');
        return timelineEvent(
          rows[0].date,'2026-06-16~23','초기 당일 단타 구간',
          rows.map(row=>`${timelineDateShort(row.date)} ${reportNumber(row.qty)}주`).join(' · '),
          `같은 날 매수·매도를 완료한 ${reportNumber(qty)}주. 세 거래일 모두 당일 단타로 분류.`
        );
      });

      addRealized(['2026-06-25'],([row])=>timelineEvent(
        row.date,'2026-06-23~25',`${reportNumber(row.qty)}주 보유 포지션 청산`,
        `${reportNumber(row.buy)}원 매수 → ${reportNumber(row.sell)}원 매도`,
        `6/23 별도로 매수한 ${reportNumber(row.qty)}주를 6/25 청산. 본 포지션으로 분류.`
      ));

      const legacy=POSITION_CONTEXT.legacyBuild;
      const legacyQty=legacy.firstQty+legacy.secondQty;
      const legacyCost=legacy.firstQty*legacy.firstBuy+legacy.secondQty*legacy.secondBuy;
      events.push(timelineEvent(
        '2026-07-02','2026-06-26~07-02',`기존 ${reportNumber(legacyQty)}주 고평단 포지션 형성`,
        `${reportNumber(legacyQty)}주 · 총 취득원가 ${reportMetricText(legacyCost,'won')} · 평단 ${reportNumber(Math.round(legacyCost/legacyQty))}원`,
        `6/26 ${reportNumber(legacy.firstQty)}주를 ${reportNumber(legacy.firstBuy)}원에 매수하고 7/2 ${reportNumber(legacy.secondQty)}주를 ${reportNumber(legacy.secondBuy)}원에 추가매수.`
      ));

      const july30=timelineRow('2026-07-30');
      if(july30){
        const extraQty=july30.qty-legacyQty;
        const totalCost=legacyCost+extraQty*POSITION_CONTEXT.julyAdd.extraBuy;
        events.push(timelineEvent(
          '2026-07-29','2026-07-29','대규모 추가매수',
          `${reportNumber(extraQty)}주 × ${reportNumber(POSITION_CONTEXT.julyAdd.extraBuy)}원 추가 → 총 ${reportNumber(july30.qty)}주`,
          `기존 ${reportNumber(legacyQty)}주 취득원가 ${reportMetricText(legacyCost,'won')}과 ${reportNumber(extraQty)}주 추가매수 ${reportMetricText(extraQty*POSITION_CONTEXT.julyAdd.extraBuy,'won')}을 합쳐 총 ${reportNumber(july30.qty)}주 운용원가 ${reportMetricText(totalCost,'won')}.`
        ));
      }

      addRealized(['2026-07-30'],([row])=>{
        const nextCore=timelineCore('2026-07-31');
        const repurchase=nextCore?` 같은 날 ${reportNumber(nextCore.qty)}주를 ${reportNumber(nextCore.buy)}원에 재매수.`:'';
        return timelineEvent(
          row.date,row.date,'첫 대규모 포지션 청산',
          `${reportNumber(row.qty)}주 · ${reportNumber(row.sell)}원 매도`,
          `기존 보유 포지션 전량 청산.${repurchase}`
        );
      });

      addRealized(['2026-07-31'],([row])=>{
        const core=timelineCore(row.date),day=timelineDay(row.date);
        return timelineEvent(
          row.date,row.date,'재매수분 청산 + 대량 단타',
          `총 매도 ${reportNumber(row.qty)}주`,
          core&&day?`본 포지션 ${reportNumber(core.qty)}주를 청산하고 나머지 ${reportNumber(day.qty)}주는 반복 단타 물량으로 분리.`:timelineClassification(row)
        );
      });

      addRealized(['2026-08-04'],([row])=>{
        const nextCore=timelineCore('2026-08-05');
        return timelineEvent(
          row.date,row.date,'단타 + 종가 매수',
          `당일 매도 ${reportNumber(row.qty)}주${nextCore?` · 신규 ${reportNumber(nextCore.qty)}주`:''}`,
          `당일 단타로 분류.${nextCore?` ${reportNumber(nextCore.qty)}주는 ${reportNumber(nextCore.buy)}원에 다음 날까지 보유.`:''}`
        );
      });

      addRealized(['2026-08-05'],([row])=>{
        const core=timelineCore(row.date),day=timelineDay(row.date);
        return timelineEvent(
          row.date,row.date,'보유분 청산 + 추가 단타',
          `총 매도 ${reportNumber(row.qty)}주`,
          core&&day?`본 포지션 ${reportNumber(core.qty)}주를 ${reportNumber(core.sell)}원에 청산하고 나머지 ${reportNumber(day.qty)}주는 당일 반복매매.`:timelineClassification(row)
        );
      });

      addRealized(['2026-08-06'],([row])=>{
        const nextCore=timelineCore('2026-08-07');
        return timelineEvent(
          row.date,row.date,'대량 단타 + 소규모 오버나이트',
          `당일 매도 ${reportNumber(row.qty)}주${nextCore?` · 신규 ${reportNumber(nextCore.qty)}주`:''}`,
          `당일 단타로 분류.${nextCore?` ${reportNumber(nextCore.qty)}주는 ${reportNumber(nextCore.buy)}원에 매수해 다음 날까지 보유.`:''}`
        );
      });

      addRealized(['2026-08-07'],([row])=>{
        const core=timelineCore(row.date),day=timelineDay(row.date);
        return timelineEvent(
          row.date,row.date,'보유분 청산 + 추가 단타',
          `총 매도 ${reportNumber(row.qty)}주`,
          core&&day?`전일 보유 ${reportNumber(core.qty)}주는 ${reportNumber(core.sell)}원에 청산. 추가 ${reportNumber(day.qty)}주는 당일 단타로 분류.`:timelineClassification(row)
        );
      });

      addRealized(['2026-08-12'],([row])=>{
        const core=timelineCore(row.date),day=timelineDay(row.date);
        return timelineEvent(
          row.date,'2026-08-11~12',`${reportNumber(core?.qty||0)}주 오버나이트 청산 + 추가 단타`,
          `총 매도 ${reportNumber(row.qty)}주`,
          core&&day?`8/11 매수한 ${reportNumber(core.qty)}주는 ${reportNumber(core.buy)}원 → ${reportNumber(core.sell)}원에 청산해 본 포지션으로 분류. 나머지 ${reportNumber(day.qty)}주는 8/12 당일 단타로 분류.`:timelineClassification(row)
        );
      });

      addRealized(['2026-08-20'],([row])=>{
        const build=POSITION_CONTEXT.augustFinalBuild;
        const secondQty=row.qty-build.firstQty;
        return timelineEvent(
          row.date,'2026-08-18~20',`${reportNumber(row.qty)}주 오버나이트 포지션 청산`,
          `8/18 ${reportNumber(build.firstQty)}주 + 8/19 ${reportNumber(secondQty)}주 → 8/20 전량 매도`,
          `${reportNumber(build.firstQty)}주는 ${reportNumber(build.firstBuy)}원, ${reportNumber(secondQty)}주는 ${reportNumber(build.secondBuy)}원에 매수해 가중평균 ${reportNumber(row.buy)}원. 8/20 ${reportNumber(row.sell)}원에 ${reportNumber(row.qty)}주 전량 매도해 본 포지션으로 분류.`
        );
      });

      // 새 REPORT_DATA 행이 curated group에 아직 정의되지 않아도 Timeline에서 누락되지 않게 자동 보완한다.
      reportDailyRows.forEach(row=>{
        if(!coveredDates.has(row.date)) events.push(timelineGeneric(row));
      });
      return events.sort((a,b)=>a.sortDate.localeCompare(b.sortDate));
    }
    function timelineProfitCard(net){
      if(!Number.isFinite(net)) return '';
      const valueClass=reportValueClass(net);
      const className=valueClass?` ${valueClass}`:'';
      const valueText=reportMetricText(net,'signedWon');
      return `<div class="timeline-profit-card${className}"><span>순손익</span><strong>${valueText}</strong></div>`;
    }
    function renderReportTimeline(){
      const timeline=document.getElementById('reportTimeline');
      if(!timeline) return;
      timeline.innerHTML=buildTimelineEvents().map(item=>`<article class="timeline-item"><div class="timeline-date">${item.range}</div><div class="timeline-dot"></div><div class="timeline-card add-card-shell add-card-control"><div class="timeline-card-main"><div class="timeline-card-date">${item.range}</div><h3 class="add-heading-subsection">${item.title}</h3><strong>${item.strong}</strong><p>${item.body}</p></div>${timelineProfitCard(item.net)}</div></article>`).join('');
    }
    function renderReportMetricValues(){
      document.querySelectorAll('[data-report-value]').forEach(node=>{
        const key=node.dataset.reportValue;
        if(!(key in reportMetrics)) return;
        node.textContent=reportMetricText(reportMetrics[key],node.dataset.format||'integer');
      });
      document.getElementById('profitCompositionDonut')?.style.setProperty('--main-position-ratio',`${coreNetRatio}%`);
      document.getElementById('coreVolumeBar')?.style.setProperty('width',`${coreQtyRatio}%`);
      document.getElementById('dayVolumeBar')?.style.setProperty('width',`${dayQtyRatio}%`);
    }
    function renderDailyTradeRows(){
      const tbody=document.getElementById('dailyTradeRows');
      if(!tbody) return;
      tbody.innerHTML=reportDailyRows.map(row=>`<tr><th scope="row">${row.date}</th><td class="num">${reportMetricText(row.qty,'qty')}</td><td class="num">${reportNumber(row.buy)}</td><td class="num">${reportNumber(row.sell)}</td><td class="num ${reportValueClass(row.pnl)}">${reportMetricText(row.pnl,'won')}</td><td class="num">${reportMetricText(row.fee,'won')}</td><td class="num ${reportValueClass(row.net)}">${reportMetricText(row.net,'won')}</td><td class="num ${reportValueClass(row.cumulative)}">${reportMetricText(row.cumulative,'won')}</td></tr>`).join('');
    }
    function renderCoreTradeRows(){
      const tbody=document.getElementById('coreTradeRows');
      if(!tbody) return;
      tbody.innerHTML=coreTradeRows.map(row=>{
        const net=row.pnl-row.fee;
        return `<tr><th scope="row">${row.date}</th><td class="num">${reportNumber(row.qty)}</td><td class="num">${reportNumber(row.buy)}</td><td class="num">${reportNumber(row.sell)}</td><td class="num ${reportValueClass(row.pnl)}">${reportMetricText(row.pnl,'signedWon')}</td><td class="num">${reportMetricText(row.fee,'won')}</td><td class="num ${reportValueClass(net)}">${reportMetricText(net,'signedWon')}</td></tr>`;
      }).join('');
    }
    function renderDayTradeRows(){
      const tbody=document.getElementById('dayTradeRows');
      if(!tbody) return;
      tbody.innerHTML=dayTradeRows.map(row=>{
        const net=row.pnl-row.fee;
        return `<tr><th scope="row">${row.date}</th><td class="num">${reportNumber(row.qty)}</td><td class="num ${reportValueClass(row.pnl)}">${reportMetricText(row.pnl,'signedWon')}</td><td class="num">${reportMetricText(row.fee,'won')}</td><td class="num ${reportValueClass(net)}">${reportMetricText(net,'signedWon')}</td></tr>`;
      }).join('');
    }
    function renderCanonicalReportData(){
      renderReportMetricValues();
      renderDailyTradeRows();
      renderCoreTradeRows();
      renderDayTradeRows();
      renderReportTimeline();
    }
    
    const reportTabs=[...document.querySelectorAll('.tab')];
    const reportPanels=[...document.querySelectorAll('.panel')];
    const reportNav=document.querySelector('.report-nav');
    const reportTablist=document.getElementById('reportTabs');
    const mobileToggle=document.querySelector('.mobile-menu-toggle');
    const mobileLabel=document.getElementById('mobileMenuLabel');
    const reportMobileMedia=window.matchMedia('(max-width:760px)');
    
    // 02. 패널 전환 / 접근성 상태 동기화
    // 단일 tablist의 active, aria-selected, tabindex를 viewport와 무관하게 유지
    function setTabState(panelId){
      reportTabs.forEach(btn => {
        const active = btn.dataset.panel === panelId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
        btn.tabIndex = active ? 0 : -1;
      });
    }
    
    function closeMobileMenu(){
      reportNav?.classList.remove('open');
      mobileToggle?.setAttribute('aria-expanded','false');
    }
    
    function activatePanel(panelId, label, {closeMobile=true}={}){
      reportPanels.forEach(panel => {
        const active = panel.id === panelId;
        panel.classList.toggle('active', active);
        panel.setAttribute('aria-hidden', String(!active));
      });
      setTabState(panelId);
      if (mobileLabel && label) mobileLabel.textContent = label;
      if (closeMobile) closeMobileMenu();
      if (panelId === 'summary') requestAnimationFrame(drawChart);
    }
    
    function bindTabKeyboard(){
      reportTablist?.addEventListener('keydown', e => {
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
        const current = Math.max(0, reportTabs.indexOf(document.activeElement));
        const nextIndex = e.key === 'Home' ? 0 : e.key === 'End' ? reportTabs.length - 1 : e.key === 'ArrowRight' ? (current + 1) % reportTabs.length : (current - 1 + reportTabs.length) % reportTabs.length;
        const next = reportTabs[nextIndex];
        if(!next) return;
        e.preventDefault();
        const keepMobileMenuOpen = window.matchMedia('(max-width:760px)').matches && reportNav?.classList.contains('open');
        activatePanel(next.dataset.panel, next.textContent.trim(), {closeMobile: !keepMobileMenuOpen});
        next.focus();
      });
    }
    
    // 03. 메뉴 이벤트 / 키보드 조작
    // 동일 탭의 클릭·방향키와 모바일 패널 열기·닫기, ESC·외부 클릭 처리
    function initNavigationEvents(){
      reportTabs.forEach(btn => btn.addEventListener('click', () => {
        const mobile=reportMobileMedia.matches;
        activatePanel(btn.dataset.panel, btn.textContent.trim());
        if(mobile) mobileToggle?.focus();
      }));
      bindTabKeyboard();
      
      if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
          const open = reportNav?.classList.toggle('open') ?? false;
          mobileToggle.setAttribute('aria-expanded', String(open));
          if(open) requestAnimationFrame(() => reportTabs.find(btn => btn.getAttribute('aria-selected') === 'true')?.focus());
        });
      }
      document.addEventListener('click', e => {
        if (reportNav?.classList.contains('open') && !reportNav.contains(e.target)) closeMobileMenu();
      });
      document.addEventListener('keydown', e => {
        if(e.key === 'Escape' && reportNav?.classList.contains('open')){
          closeMobileMenu();
          mobileToggle?.focus();
        }
      });
    }
    
    // 04. 차트 표시 보조 함수
    // Y축 금액 축약과 둥근 막대 path 생성을 담당
    function formatWon(v){
      const abs = Math.abs(v);
      if(abs >= 1000000) return (v/1000000).toFixed(abs >= 10000000 ? 0 : 1).replace('.0','') + '백만';
      if(abs >= 10000) return Math.round(v/10000) + '만';
      return Math.round(v).toLocaleString('ko-KR');
    }
    function roundedRect(ctx,x,y,w,h,r){
      const rr=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);
      ctx.beginPath();
      ctx.moveTo(x+rr,y);
      ctx.arcTo(x+w,y,x+w,y+h,rr);
      ctx.arcTo(x+w,y+h,x,y+h,rr);
      ctx.arcTo(x,y+h,x,y,rr);
      ctx.arcTo(x,y,x+w,y,rr);
      ctx.closePath();
    }
    
    const REPORT_CHART_FRAME=Object.freeze({
      desktop:Object.freeze({left:60,right:60,top:30,bottom:40}),
      mobile:Object.freeze({left:48,right:48,top:28,bottom:38})
    });
    
    // 05. 누적 실현손익 차트 렌더링
    // DPR 대응, 공통 Plot Frame, 막대·누적선·라벨 충돌 회피를 한 번에 처리
    function drawChart(){
      const canvas=document.getElementById('pnlChart');
      if(!canvas || !canvas.closest('.panel.active')) return;
      const rect=canvas.getBoundingClientRect();
      if(rect.width < 20 || rect.height < 20) return;
      const dpr=window.devicePixelRatio||1;
      canvas.width=Math.round(rect.width*dpr);
      canvas.height=Math.round(rect.height*dpr);
      const ctx=canvas.getContext('2d');
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const rootStyle=getComputedStyle(document.documentElement);
      const chartColorCache=Object.create(null);
      const chartColor=name=>chartColorCache[name]||(chartColorCache[name]=rootStyle.getPropertyValue(name).trim());
    
      const W=rect.width,H=rect.height;
      const mobile=reportMobileMedia.matches;
      const frame=mobile?REPORT_CHART_FRAME.mobile:REPORT_CHART_FRAME.desktop;
      const plotW=W-frame.left-frame.right,plotH=H-frame.top-frame.bottom;
      const values=chartData.net.concat(chartData.cum);
      const rawMax=Math.max(...values,0),rawMin=Math.min(...values,0);
      const range=(rawMax-rawMin)||1;
      const top=rawMax+range*.13,bottom=rawMin-range*.11;
      const y=v=>frame.top+(top-v)/(top-bottom)*plotH;
      const zeroY=y(0);
    
      ctx.clearRect(0,0,W,H);
    
      // 차트 플롯 배경
      const bg=ctx.createLinearGradient(0,frame.top,0,H-frame.bottom);
      bg.addColorStop(0,chartColor('--chart-plot-top'));
      bg.addColorStop(1,chartColor('--chart-plot-bottom'));
      ctx.fillStyle=bg;
      roundedRect(ctx,frame.left,frame.top,plotW,plotH,14);
      ctx.fill();
    
      // 가로 그리드와 Y축 금액 라벨
      ctx.font=(mobile?'9px':'10px')+' system-ui';
      ctx.textAlign='right';
      ctx.textBaseline='middle';
      for(let i=0;i<=4;i++){
        const v=bottom+(top-bottom)*i/4;
        const yy=y(v);
        ctx.strokeStyle=chartColor('--chart-grid');
        ctx.lineWidth=1;
        ctx.setLineDash([3,5]);
        ctx.beginPath();ctx.moveTo(frame.left,yy);ctx.lineTo(W-frame.right,yy);ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=chartColor('--chart-axis-text');
        ctx.fillText(formatWon(v),frame.left-8,yy);
      }
    
      // 손익 0원 기준선
      ctx.strokeStyle=chartColor('--chart-zero');
      ctx.lineWidth=1.2;
      ctx.beginPath();ctx.moveTo(frame.left,zeroY);ctx.lineTo(W-frame.right,zeroY);ctx.stroke();
    
      const step=plotW/chartData.labels.length;
      const barW=Math.min(mobile?25:34,step*.38);
    
      // X축 날짜: 별도 breakpoint 없이 실제 가용 폭에 따라 자동 생략
      ctx.font='10px system-ui';
      const maxXLabelWidth=Math.max(...chartData.labels.map(label=>ctx.measureText(label).width),0);
      const xLabelEvery=Math.max(1,Math.ceil((maxXLabelWidth+8)/step));
      const lastXLabelIndex=chartData.labels.length-1;
    
      // 일별 실현손익 막대
      const dailyLabelBoxes=[];
      const collides=(a,b)=>!(a.right<b.left || a.left>b.right || a.bottom<b.top || a.top>b.bottom);
      chartData.net.forEach((v,i)=>{
        const cx=frame.left+step*(i+.5),yy=y(v);
        const topY=Math.min(yy,zeroY),h=Math.max(2,Math.abs(zeroY-yy));
        const grad=ctx.createLinearGradient(0,topY,0,topY+h);
        if(v>=0){
          grad.addColorStop(0,chartColor('--chart-positive'));
          grad.addColorStop(1,chartColor('--chart-positive-soft'));
        }else{
          grad.addColorStop(0,chartColor('--chart-negative-soft'));
          grad.addColorStop(1,chartColor('--chart-negative'));
        }
        ctx.fillStyle=grad;
        roundedRect(ctx,cx-barW/2,topY,barW,h,6);
        ctx.fill();
    
        // 일별 손익 라벨: 인접 라벨과 겹치면 위·아래로 순차 이동
        const dailyText=(v>=0?'+':'')+formatWon(v);
        const dailyFontSize=mobile?9:10;
        ctx.font='800 '+dailyFontSize+'px system-ui';
        ctx.textAlign='center';
        ctx.textBaseline=v>=0?'bottom':'top';
        ctx.fillStyle=v>=0?chartColor('--chart-positive-label'):chartColor('--chart-negative-label');
    
        const textW=ctx.measureText(dailyText).width;
        const textH=dailyFontSize+3;
        let labelY=v>=0?topY-6:topY+h+6;
        let box={
          left:cx-textW/2-3,
          right:cx+textW/2+3,
          top:v>=0?labelY-textH:labelY,
          bottom:v>=0?labelY:labelY+textH
        };
    
        let guard=0;
        while(dailyLabelBoxes.some(prev=>collides(box,prev)) && guard<12){
          if(v>=0){
            labelY-=textH+4;
          }else{
            labelY+=textH+4;
          }
          box={
            left:cx-textW/2-3,
            right:cx+textW/2+3,
            top:v>=0?labelY-textH:labelY,
            bottom:v>=0?labelY:labelY+textH
          };
          guard++;
        }
    
        if(v>=0 && box.top<frame.top+2){
          labelY=frame.top+textH+2;
          box.top=labelY-textH;
          box.bottom=labelY;
        }
        if(v<0 && box.bottom>H-frame.bottom-2){
          labelY=H-frame.bottom-textH-2;
          box.top=labelY;
          box.bottom=labelY+textH;
        }
    
        dailyLabelBoxes.push(box);
        ctx.fillText(dailyText,cx,labelY);
    
        // 날짜 라벨: 마지막 거래일은 항상 표시하고 직전 라벨과 최소 간격 확보
        const showXLabel=i===lastXLabelIndex || (i%xLabelEvery===0 && lastXLabelIndex-i>=xLabelEvery);
        if(showXLabel){
          ctx.font='10px system-ui';
          ctx.textBaseline='top';
          ctx.fillStyle=chartColor('--chart-x-text');
          ctx.fillText(chartData.labels[i],cx,H-frame.bottom+13);
        }
      });
    
      // 누적손익 선 아래 영역 채움
      const points=chartData.cum.map((v,i)=>({x:frame.left+step*(i+.5),y:y(v),v}));
      const area=ctx.createLinearGradient(0,frame.top,0,H-frame.bottom);
      area.addColorStop(0,chartColor('--chart-area-top'));
      area.addColorStop(1,chartColor('--chart-area-bottom'));
      ctx.beginPath();
      points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.lineTo(points[points.length-1].x,H-frame.bottom);
      ctx.lineTo(points[0].x,H-frame.bottom);
      ctx.closePath();
      ctx.fillStyle=area;ctx.fill();
    
      // 누적손익 선
      ctx.beginPath();
      points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.strokeStyle=chartColor('--chart-line');
      ctx.lineWidth=3;
      ctx.lineJoin='round';
      ctx.lineCap='round';
      ctx.stroke();
    
      // 누적손익 데이터 포인트
      points.forEach((p,i)=>{
        ctx.fillStyle=chartColor('--chart-point-bg');
        ctx.beginPath();ctx.arc(p.x,p.y,4.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=chartColor('--chart-line');ctx.lineWidth=2.5;ctx.stroke();
    
        // 누적값은 일별 손익 라벨과의 충돌을 피하기 위해 마지막 값만 표시한다.
        if(i===points.length-1){
          ctx.font='900 '+(mobile?'9px':'10px')+' system-ui';
          ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle=chartColor('--chart-line');
          ctx.fillText(formatWon(p.v),p.x,p.y-8);
        }
      });
    }
    
    // 06. 차트 초기화 / resize 재렌더
    // resize 연속 호출은 80ms debounce 후 다시 그림
    let resizeTimer;
    function initChart(){
      window.addEventListener('resize',()=>{
        clearTimeout(resizeTimer);
        resizeTimer=setTimeout(drawChart,80);
      });
      drawChart();
    }
    
    // 리포트 부팅 순서: canonical data 렌더 → 메뉴 이벤트 등록 → 차트 초기 렌더 및 resize 감시
    renderCanonicalReportData();
    initNavigationEvents();
    initChart();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootReportPage,{once:true});
  else bootReportPage();
})();
