
(() => {
  // =========================================================
  // 01. 고정 데이터 / 프리셋
  // - 거래유형 기본값과 이전 거래 없음 빠른 매수값을 한곳에서 관리
  // =========================================================
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

  // =========================================================
  // 02. 런타임 상태 / 공통 유틸리티
  // - 현재 거래유형·계산모드·프리셋 상태와 숫자/문자열/저장소 공통 함수
  // =========================================================
  // 계산에 직접 영향을 주는 상태
  let caseType='settled', noPriorMode=true, mode='current', autoBreakEvenTarget=false;

  // 화면 선택 상태와 프리셋 적용 중 여부
  let activePresetId=defaultPresetId, currentPurchasePresetId=null, applying=false;

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
  const setHelpText=(id,text,tip)=>{const n=$(id),tooltipId=`${id}Tooltip`;n.classList.add('has-help');n.innerHTML=`<span class="inline-help-label"><span>${esc(text)}</span><span class="help-tooltip"><button type="button" class="help-icon" aria-label="${esc(text)} 설명" aria-describedby="${tooltipId}" aria-expanded="false">i</button><span class="custom-tooltip" id="${tooltipId}" role="tooltip">${esc(tip)}</span></span></span>`;};
  const formatPctInput=n=>Number(n).toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
  const readPct=id=>{const n=$(id);return n.dataset.exactValue!==undefined?parseNum(n.dataset.exactValue):parseNum(n.value);};
  const setPct=(id,n,digits=2)=>{const el=$(id);el.dataset.exactValue=String(n);el.value=Number(n).toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');};
  const storage={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}},remove:k=>{try{localStorage.removeItem(k);}catch(e){}}};

  // =========================================================
  // 03. 거래유형별 화면 문구 설정
  // - 보유 중 추가매수와 이전 거래 후 재매수에서 바뀌는 라벨·설명·탭 문구 정의
  // =========================================================
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

  // =========================================================
  // 04. 공통 계산 보조 함수
  // - 이전 거래 손익과 통합 회복가격처럼 여러 흐름에서 재사용하는 순수 계산
  // =========================================================
  function priorPLFrom(v){return (v.priorSettlementValue||0)-(v.existingCost||0);}
  function integratedRecoveryOrder(v){
    const qty=v.addShares||0, principal=(v.addPrice||0)*qty;
    const priorPL=priorPLFrom(v);
    if(qty<=0||v.currentPrice<=0)return 0;
    return ceil5(Math.max(principal-priorPL,0)/qty);
  }

  // =========================================================
  // 05. 거래유형 UI 구성 / DOM 재배치
  // - 거래유형 변경 시 필드 위치·표시 여부·접근성 상태를 함께 동기화
  // =========================================================
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

  // =========================================================
  // 06. 입력 수집 / 검증
  // - 화면 값을 계산용 숫자로 읽고 거래유형별 필수조건을 검증
  // =========================================================
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

  function renderValidation(validation){
    document.querySelectorAll('.control.invalid').forEach(n=>n.classList.remove('invalid'));
    validation.invalidIds.forEach(id=>{const n=$(id);if(n)n.classList.add('invalid');});
    const b=$('validationMessage');
    if(!validation.errors.length){b.classList.remove('show');b.innerHTML='';return;}
    b.classList.add('show');
    b.innerHTML=`입력값 확인 필요.<ul>${validation.errors.map(e=>`<li>${e}</li>`).join('')}</ul>`;
  }

  // =========================================================
  // 07. 핵심 계산 엔진
  // - 입력값을 받아 보유현황·목표가격·전략별 매도결과를 계산하며 DOM은 직접 수정하지 않음
  // =========================================================
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

  // =========================================================
  // 08. 결과 렌더링
  // - 계산결과를 KPI·전략카드·상세표·모바일 카드에 반영
  // =========================================================
  function renderCalculationInputs(c){
    if(c.inputUpdates.overnightPct!==undefined)setPct('overnightPct',c.inputUpdates.overnightPct);
    if(c.inputUpdates.risePct!==undefined)setPct('risePct',c.inputUpdates.risePct);
  }

  function metric(name,value,cls=''){return `<div class="summary-card add-card-shell add-card-control"><div class="sname">${name}</div><div class="svalue ${cls}">${value}</div></div>`;}
  function desktopGrid(headers,vals,extra=''){return `<div class="table-scroll desktop-data"><div class="data-grid ${extra}">${headers.map(h=>`<div class="cell head">${h}</div>`).join('')}${vals.map(v=>`<div class="cell val lastrow ${v.cls||''}">${v.text}</div>`).join('')}</div></div>`;}
  function mobileRows(title,headers,vals){return `<div class="mobile-data-card add-card-shell add-card-control"><div class="mobile-section-title">${title}</div>${headers.map((h,k)=>`<div class="mobile-data-row"><div class="mobile-data-label">${h}</div><div class="mobile-data-value ${vals[k].cls||''}">${vals[k].text}</div></div>`).join('')}</div>`;}

  function holdingStrategyHTML(typeNo,displayNo,title,badge,badgeCls,desc,d,c){
    const saleH=['매도단가','매도수량','매도금액','실현손익','매도 후 보유수량'];
    const saleV=[{text:won(c.targetPrice)},{text:shareText(d.saleQty)},{text:won(d.gross)},{text:won(d.realizedPL),cls:signClass(d.realizedPL)},{text:shareText(d.remainShares)}];
    const flowH=['추가매수 원금 회수액','투입금액 회수 후 잔여현금','추가매수 원금 미회수액','기존 금액 회수액','기존 회수 대상 잔액','추가투입금·회수대상 차감 후 잔여현금'];
    const flowV=[{text:won(d.principalRecovered)},{text:won(Math.max(d.net-c.addedPrincipal,0))},{text:won(d.principalShortfall),cls:d.principalShortfall?'negative':''},{text:won(d.recoveryPaid)},{text:won(d.recoveryBalance),cls:d.recoveryBalance?'negative':''},{text:won(d.cashAfter),cls:d.cashAfter?'positive':''}];
    const full=typeNo===3;
    const remH=full?['보유수량','합산 손익']:['평단','보유수량','투자금액','평가가격','평가금액','평가손익','합산 손익'];
    const remV=full?[{text:shareText(d.remainShares)},{text:won(d.combined),cls:signClass(d.combined)}]:[{text:won(c.finalAvg)},{text:shareText(d.remainShares)},{text:won(d.remainCost)},{text:won(c.targetPrice)},{text:won(d.remainValue)},{text:won(d.remainPL),cls:signClass(d.remainPL)},{text:won(d.combined),cls:signClass(d.combined)}];
    return `<div class="panel strategy-card add-card-shell add-card-base add-card-shadow"><div class="strategy-head"><div class="strategy-title"><h2>${displayNo} ${title}</h2><p>${desc}</p></div><span class="badge ${badgeCls}">${badge}</span></div><div class="strategy-body"><div class="summary-row">${metric('매도금액',won(d.net))}${metric('합산 손익',won(d.combined),signClass(d.combined))}${metric('추가투입금·회수대상 차감 후 잔여현금',won(d.cashAfter),d.cashAfter?'positive':'')}${metric('추가매수 전 대비 손익 개선액',won(d.combined-(c.i.existingShares*c.targetPrice-c.i.existingCost)),signClass(d.combined-(c.i.existingShares*c.targetPrice-c.i.existingCost)))}</div><div class="desktop-details"><div class="section-title">매도 결과</div>${desktopGrid(saleH,saleV,'five-grid')}<div class="section-title">원금 회수 결과</div>${desktopGrid(flowH,flowV,'loan-grid')}<div class="section-title">${full?'매도 후 최종 상태':'매도 후 보유 현황'}</div>${desktopGrid(remH,remV,full?'final-grid':'')}</div><div class="mobile-data">${mobileRows('매도 결과',saleH,saleV)}${mobileRows('원금 회수 결과',flowH,flowV)}${mobileRows(full?'매도 후 최종 상태':'매도 후 보유 현황',remH,remV)}</div><div class="note">${typeNo===1?'매도금액이 추가매수금액 이상이 되도록 필요한 최소 매도수량 올림 처리.':typeNo===2?`추가매수 수량 ${shareText(c.i.addShares)} 그대로 매도 · 기존 보유분 유지.`:'전체 보유분 매도 후 보유수량 0주.'} 수수료·세금 등 거래비용 미반영.</div></div></div>`;
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
    return `<div class="panel strategy-card no-badge add-card-shell add-card-base add-card-shadow"><div class="strategy-head"><div class="strategy-title"><h2>${title}</h2><p>${desc}</p></div></div><div class="strategy-body"><div class="summary-row">${summary}</div><div class="desktop-details"><div class="section-title">매도 결과</div>${desktopGrid(saleH,saleV,'five-grid')}<div class="section-title">${integrationTitle}</div>${desktopGrid(integratedH,integratedV,integrationGridClass)}<div class="section-title">${full?'매도 후 최종 상태':'원금 회수 후 보유 현황'}</div>${desktopGrid(remainH,remainV,full?'final-grid':'simple-grid')}</div><div class="mobile-data">${mobileRows('매도 결과',saleH,saleV)}${mobileRows(integrationTitle,integratedH,integratedV)}${mobileRows(full?'매도 후 최종 상태':'원금 회수 후 보유 현황',remainH,remainV)}</div>${warning}<div class="note">${note} 수수료·세금 등 거래비용 미반영.</div></div></div>`;
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

  // =========================================================
  // 09. 재계산 흐름 / 계산 기준 모드
  // - 입력→검증→계산→렌더 순서를 통제하고 종가·매수가·목표단가 모드를 전환
  // =========================================================
  function getCalculationOptions(){return {caseType,noPrior:noPriorMode,mode,autoBreakEvenTarget};}

  function recalc(){
    const i=getInputs();
    const options=getCalculationOptions();
    const validation=validate(i,options);
    renderValidation(validation);
    if(validation.errors.length)return;
    const c=compute(i,options);
    renderCalculationInputs(c);
    render(c);
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

  // =========================================================
  // 10. 프리셋 / 저장상태 적용
  // - 프리셋 또는 localStorage 값을 화면 상태에 복원하고 전략 선택상태까지 맞춤
  // =========================================================
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

  // =========================================================
  // 11. 사용자 이벤트
  // - 입력·스테퍼·프리셋·전략탭·초기화 버튼의 이벤트를 한 번만 등록
  // =========================================================
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

  // =========================================================
  // 12. 도움말 툴팁
  // - 화면 경계를 벗어나지 않도록 위치를 계산하고 마우스·키보드·ESC 동작을 처리
  // =========================================================
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

  // =========================================================
  // 13. 초기화 / 부팅
  // - 이벤트·툴팁을 등록한 뒤 저장상태가 있으면 복원하고 없으면 기본 프리셋 적용
  // =========================================================
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
    }catch(e){
      applying=false;
      applyPreset(defaultPresetId);
    }
  }

  // Node 기반 회귀검증에서는 계산/검증 함수만 노출하고 브라우저 부팅은 실행하지 않는다.
  if(typeof module==='object'&&module.exports){
    module.exports={compute,validate,ceil5};
  }

  if(typeof document!=='undefined'&&typeof window!=='undefined'){
    initEventBindings();
    initHelpTooltips();
    restoreInitialState();
  }
})();

