// 퇴직연금 rendering · 금액조정 · 저장/삭제 · batch · PIN

const pensionHooks={renderDashboard:null};
function registerPensionHooks({renderDashboard}={}){
  pensionHooks.renderDashboard=typeof renderDashboard==='function'?renderDashboard:null;
}

const pensionContributionSubText=x=>{
  const latest=latestPensionContribution(x.date);
  return latest?`${latest.date} 기업적립금 ${won(Number(latest.amount)||0)} 반영 기준`:'6/30까지 기 반영분 기준';
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


// Modal Rendering · 금액조정 모달 렌더링
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
  return `<div id="pensionContribModal" class="contrib-modal" aria-hidden="true" data-pension-backdrop-close="true"><div class="contrib-modal-card" role="dialog" aria-modal="true" aria-labelledby="pensionContribModalTitle"><div class="contrib-modal-head"><div><h2 id="pensionContribModalTitle" class="modal-main-title">퇴직연금 금액 조정</h2></div><div class="contrib-modal-head-actions"><button type="button" class="modal-icon-btn contrib-modal-icon-btn pension-form-reset" data-pension-action="reset-form" title="입력값 초기화" aria-label="입력값 초기화">${navIconSvg('reset')}</button><button type="button" class="modal-icon-btn contrib-modal-icon-btn contrib-modal-close" data-pension-action="close-modal" aria-label="닫기">${navIconSvg('close')}</button></div></div>
<div class="pension-contrib-context" aria-label="퇴직연금 금액 조정 옵션">
  <div class="pension-contrib-context-head"><span class="contrib-field-label">조정 항목</span><div class="chart-compare-toggle pension-work-mode" role="group" aria-label="처리 방식 선택"><button type="button" class="pension-work-mode-btn active" aria-pressed="true" data-mode="single" data-pension-action="set-batch-mode" data-pension-enabled="false">개별 처리</button><button type="button" class="pension-work-mode-btn" aria-pressed="false" data-mode="batch" data-pension-action="set-batch-mode" data-pension-enabled="true">작업 모음 <span id="pensionBatchModeCount" class="pension-batch-count" hidden>0</span></button></div></div>
  <input type="hidden" id="pensionContribTarget" value="cashSnapshot"><div class="contrib-target-tabs" role="tablist" aria-label="조정 항목 선택"><button type="button" class="contrib-target-option active" data-target="cashSnapshot" data-pension-action="set-target">현금성자산</button><button type="button" class="contrib-target-option" data-target="contribution" data-pension-action="set-target">기업적립금</button><button type="button" class="contrib-target-option" data-target="etfTrade" data-pension-action="set-target">추가 매수</button></div>
</div>
<div class="pension-contrib-tool modal-card-box">
  <h3>등록</h3>
  <div id="pensionContribStandardFields" class="pension-adjust-form cash-mode">
    <div class="contrib-field"><label for="pensionContribDate">일자</label><input id="pensionContribDate" type="date" value="${cashDefaultDate}" data-contrib-default-date="${contribDefaultDate}" data-cash-default-date="${cashDefaultDate}"></div>
    <div class="contrib-field"><label id="pensionContribAmountLabel" for="pensionContribAmount">평가금액</label><input id="pensionContribAmount" type="text" inputmode="numeric" value="${cashDefaultValue}" data-contrib-default-value="618,060" data-cash-default-value="${cashDefaultValue}" data-pension-input="money"></div>
    <div id="pensionCashCostField" class="contrib-field"><label for="pensionCashCostBasis">매수원금</label><input id="pensionCashCostBasis" type="text" inputmode="numeric" value="${cashDefaultCostBasis}" data-cash-default-value="${cashDefaultCostBasis}" data-pension-input="money"></div>
    <div class="contrib-field full"><label for="pensionContribMemo">메모</label><input id="pensionContribMemo" type="text" value="현금성자산 앱 확인" data-contrib-default-memo="${contribDefaultMemo}" data-cash-default-memo="현금성자산 앱 확인"></div>
  </div>
  <div id="pensionEtfTradeFields" class="pension-etf-trade-fields" hidden>
    <div class="pension-adjust-form trade-mode">
      <div class="contrib-field full"><label for="pensionEtfTradeDate">신청일</label><input id="pensionEtfTradeDate" type="date" value="${cashDefaultDate}" data-pension-change="trade-preview"></div>
      <div class="contrib-field full"><label for="pensionEtfTradeTicker">ETF 상품</label><select id="pensionEtfTradeTicker" data-pension-change="trade-preview">${pensionTradeProductOptions()}</select></div>
      <div class="contrib-field"><label for="pensionEtfTradeQty">체결수량</label><input id="pensionEtfTradeQty" type="text" inputmode="numeric" placeholder="77" data-pension-input="trade-preview"></div>
      <div class="contrib-field"><label for="pensionEtfTradeAmount">체결금액</label><input id="pensionEtfTradeAmount" type="text" inputmode="numeric" placeholder="1,290,580" data-pension-input="money-preview"></div>
    </div>
    <div class="pension-etf-trade-apply-note">앱 반영일 <strong id="pensionEtfTradeApplyDate">${applyDate}</strong> · 저장한 날 기준으로 보유수량/원가/현금에 적용</div>
    <div id="pensionEtfTradePreview" class="pension-etf-trade-preview"><span class="small">상품·수량·체결금액을 입력하면 적용 후 예상값을 보여줍니다.</span></div>
  </div>
  <div class="contrib-actions">
    <button type="button" id="pensionContribSaveButton" class="contrib-btn" data-pension-action="save">저장</button>
  </div>
  <div id="pensionContribStatus" class="contrib-status" role="status" aria-live="polite" aria-atomic="true"></div>
  <pre id="pensionContribOutput" class="contrib-output"></pre>
</div>
<div id="pensionContribDeleteCard" class="contrib-list modal-card-box"${pensionCashSnapshotItems().length?'':' hidden'}>
  <h3>삭제</h3>
  <p id="pensionContribDeleteHelp" class="small">잘못 등록한 현금성자산 기록 선택 후 삭제</p>
  <div id="pensionContribExistingList" class="contrib-existing-list">${renderPensionContributionList('cashSnapshot')}</div>
  <div class="contrib-actions"><button type="button" id="pensionContribDeleteButton" class="contrib-btn danger" data-pension-action="delete-selected">선택 항목 삭제</button></div>
  <div id="pensionContribDeleteStatus" class="contrib-status" role="status" aria-live="polite" aria-atomic="true"></div>
</div>
<div id="pensionBatchPanel" class="pension-batch-panel modal-card-box" hidden>
  <div class="pension-batch-head"><div><h3>작업 모음 <span id="pensionBatchTitleCount">0건</span></h3><p>저장·삭제 작업을 모아 PIN 한 번으로 한 커밋에 반영합니다.</p></div><button type="button" id="pensionBatchClearButton" class="pension-batch-clear" data-pension-action="clear-batch">전체 비우기</button></div>
  <div id="pensionBatchQueueList" class="pension-batch-queue"><div class="pension-batch-empty">아직 추가된 작업이 없습니다.</div></div>
  <div id="pensionBatchOrderNote" class="pension-batch-order-note" hidden></div>
  <div id="pensionBatchStatus" class="contrib-status" role="status" aria-live="polite" aria-atomic="true"></div>
  <div class="pension-batch-actions"><button type="button" id="pensionBatchApplyButton" class="contrib-btn" data-pension-action="apply-batch" disabled>일괄 적용</button></div>
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


function renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn){
  const orderedPensionRows=sortPensionItems(x.pensionRows),
        cashProfit=x.pensionCash-pensionCashCost,
        cashReturn=pensionCashCost?cashProfit/pensionCashCost*100:0,
        cashWeight=x.pensionEval?x.pensionCash/x.pensionEval*100:0;
  const cards=orderedPensionRows.map(r=>{
    const weight=x.pensionEval?r.evalAmount/x.pensionEval*100:0;
    return mobileInfoCard(`<span class="holding-name-text">${r.name}</span>${pensionProductSwatch(r.name)}`,[
      ['수량',fmt(r.qty)],['평균단가',won(r.qty?r.cost/r.qty:0)],['매수원금',won(r.cost)],['평가금액',won(r.evalAmount)],['평가손익',won(r.profit),cls(r.profit)],['수익률',pct(r.returnRate),cls(r.returnRate)],['비중',pct(weight)]
    ],'',r.name);
  }).join('')+mobileInfoCard('현금성자산',[
    ['수량',fmt(1)],['평균단가',won(pensionCashCost)],['매수원금',won(pensionCashCost)],['평가금액',won(x.pensionCash)],['평가손익',won(cashProfit),cls(cashProfit)],['수익률',pct(cashReturn),cls(cashReturn)],['비중',pct(cashWeight)]
  ])+mobileInfoCard('합계',[
    ['매수원금',won(pensionHeldCost)],['평가금액',won(x.pensionEval)],['평가손익',won(pensionHeldProfit),cls(pensionHeldProfit)],['수익률',pct(pensionHeldReturn),cls(pensionHeldReturn)]
  ],'summary-card mobile-total-card');
  return `<div class="note pension-products-note" id="pension-products" ${mobileViewAttrs('pensionProducts')}><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="package" aria-hidden="true"></span>연금상품별 현황</h2>${mobileViewToggle('pensionProducts')}</div><div class="mobile-scroll table-view"><table class="dashboard-data-table pension-products-table"><caption class="visually-hidden">퇴직연금 상품별 현황</caption><thead><tr><th scope="col">상품</th><th scope="col" class="table-cell-center">수량</th><th scope="col">평균단가</th><th scope="col">매수원금</th><th scope="col">평가금액</th><th scope="col">평가손익</th><th scope="col" class="table-cell-center">수익률</th><th scope="col">비중</th></tr></thead><tbody>${orderedPensionRows.map(r=>pensionRow(r,x.pensionEval)).join('')}${pensionCashRow(x.pensionCash,x.pensionEval,pensionCashCost)}<tr class="summary-row"><th scope="row">합계</th><td></td><td></td><td class="num">${fmt(pensionHeldCost)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${tableCls(pensionHeldProfit)}">${fmt(pensionHeldProfit)}</td><td class="num table-cell-center ${tableCls(pensionHeldReturn)}">${pct(pensionHeldReturn)}</td><td></td></tr></tbody></table></div><div class="mobile-card-view">${cards}</div><p class="small section-explainer pension-products-basis-note">※ 매수원금 합계는 현재 보유상품 재투자 기준</p>${renderPensionProductInsights(x)}</div>`;
}

function renderPension(x){
  const c=dataState.portfolio.constants,
        day=x.pensionDayChange,
        rate=x.pensionDayRate,
        pensionCashCost=Number(x.pensionCashCost||0),
        pensionHeldCost=x.pensionRows.reduce((a,r)=>a+r.cost,0)+pensionCashCost,
        pensionHeldProfit=x.pensionEval-pensionHeldCost,
        pensionHeldReturn=pensionHeldCost?pensionHeldProfit/pensionHeldCost*100:0,
        orderedPensionRows=sortPensionItems(x.pensionRows),
        hasPrevPension=x.pensionPrevEval!=null,
        prevPensionDateLabel=x.prevKey?shortDate(x.prevKey):'-',
        currentPensionDateLabel=shortDate(x.date),
        noPrevBlock=`<div class="pension-no-prev-note">전일 데이터가 없습니다.</div>`,
        changeContent=hasPrevPension?`<div class="change-kpis"><div class="mini-card"><div class="m-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가금액</div><div class="m-value">${won(x.pensionPrevEval)}</div></div><div class="mini-card"><div class="m-label">${shortDate(x.date)} 평가금액</div><div class="m-value">${won(x.pensionEval)}</div></div><div class="mini-card"><div class="m-label">하루 변동분</div><div class="m-value ${cls(day)}">${signed(day,'원')}</div></div><div class="mini-card"><div class="m-label">하루 변동률</div><div class="m-value ${cls(rate)}">${(rate>0?'+':'')+pct(rate)}</div></div></div><div class="change-table-wrap mobile-scroll table-view"><table class="dashboard-data-table change-table"><caption class="visually-hidden">퇴직연금 전일 대비 상품별 변동</caption><thead><tr><th scope="col">상품</th><th scope="col">${x.prevKey?shortDate(x.prevKey):'-'} 종가</th><th scope="col">${shortDate(x.date)} 종가</th><th scope="col">일변동</th></tr></thead><tbody>${orderedPensionRows.map(r=>`<tr><th scope="row"><strong>${mobileTableProductName(r.name)}</strong>${pensionProductSwatch(r.name)}</th><td class="num"><span class="change-price">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span><span class="change-eval">${r.prevEval==null?'-':won(r.prevEval)}</span></td><td class="num"><span class="change-price">${fmt(r.price)}</span><span class="change-eval">${won(r.evalAmount)}</span></td><td class="num ${tableCls(r.dayChange)}">${r.dayChange==null?'-':signed(r.dayChange)}</td></tr>`).join('')}<tr><th scope="row">현금성자산</th><td class="num"><span class="change-price">—</span><span class="change-eval">${won(x.prevPensionCash)}</span></td><td class="num"><span class="change-price">—</span><span class="change-eval">${won(x.pensionCash)}</span></td><td class="num ${tableCls(x.pensionCashDayChange)}">${signed(x.pensionCashDayChange)}</td></tr><tr class="summary-row"><th scope="row">합계</th><td class="num">${fmt(x.pensionPrevEval)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${tableCls(day)}">${signed(day)}</td></tr></tbody></table></div><div class="change-mobile-list mobile-card-view">${orderedPensionRows.map(r=>mobileInfoCard(r.name,[[prevPensionDateLabel+' 종가',r.prevPrice==null?'-':fmt(r.prevPrice)],[prevPensionDateLabel+' 평가액',r.prevEval==null?'-':won(r.prevEval)],[currentPensionDateLabel+' 종가',fmt(r.price)],[currentPensionDateLabel+' 평가액',won(r.evalAmount)],['일변동',r.dayChange==null?'-':signed(r.dayChange),cls(r.dayChange)]])).join('')}${mobileInfoCard('현금성자산',[[prevPensionDateLabel+' 평가액',won(x.prevPensionCash)],[currentPensionDateLabel+' 평가액',won(x.pensionCash)],['일변동',signed(x.pensionCashDayChange),cls(x.pensionCashDayChange)]])}</div>`:noPrevBlock;
  return `<section id="pension-section"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="briefcase" aria-hidden="true"></span>퇴직연금 현황</h2></div><div class="pension-band"><div class="grid cards metric-grid pension-metric-grid">${metricCard('퇴직연금 평가금액',won(x.pensionEval),pensionEvaluationBasisText(x.date),true)}${metricCard('퇴직연금 납입원금',won(x.pensionPrincipal),pensionContributionSubText(x))}${metricCard('퇴직연금 운용수익',won(x.pensionProfit),'평가금액 - 납입원금',false,cls(x.pensionProfit))}${metricCard('퇴직연금 누적수익률',pct(x.pensionReturn),'퇴직연금 운용수익 ÷ 퇴직연금 납입원금',false,cls(x.pensionReturn))}</div><div class="grid two pension-detail-grid">${renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn)}<div class="note pension-change-note" id="pension-change" ${mobileViewAttrs('pensionChange')}><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="trending" aria-hidden="true"></span>전일 대비 변동</h2>${hasPrevPension?mobileViewToggle('pensionChange'):''}</div>${changeContent}</div></div>${renderPensionCharts(x)}</div></section>`;
}
function mobileTableProductName(name=''){
  const text=String(name||'');
  return text.startsWith('KODEX ')?`<span class="mobile-table-kodex-prefix">KODEX </span>${text.slice(6)}`:text;
}
function pensionRow(r,total){const w=total?r.evalAmount/total*100:0,safeW=Math.max(0,Math.min(100,w)),weight=safeW.toFixed(1),name=String(r.name||'');return `<tr><th scope="row"><strong>${mobileTableProductName(r.name)}</strong>${pensionProductSwatch(r.name)}</th><td class="num table-cell-center">${fmt(r.qty)}</td><td class="num">${fmt(r.qty?r.cost/r.qty:0)}</td><td class="num">${fmt(r.cost)}</td><td class="num">${fmt(r.evalAmount)}</td><td class="num ${tableCls(r.profit)}">${fmt(r.profit)}</td><td class="num table-cell-center ${tableCls(r.returnRate)}">${pct(r.returnRate)}</td><td><div class="bar-box" role="progressbar" aria-label="${escapeHtml(name)} 비중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${weight}" aria-valuetext="${weight}%"><div class="bar-fill" aria-hidden="true" style="width:${weight}%;background:${pensionSeriesColor(r.name)}"></div></div><div class="small">${weight}%</div></td></tr>`}
function pensionCashRow(cash,total,cost=39408){const w=total?cash/total*100:0,safeW=Math.max(0,Math.min(100,w)),weight=safeW.toFixed(1),profit=cash-cost,ret=cost?profit/cost*100:0;return `<tr><th scope="row"><strong>현금성자산</strong></th><td class="num table-cell-center">1</td><td class="num">${fmt(cost)}</td><td class="num">${fmt(cost)}</td><td class="num">${fmt(cash)}</td><td class="num ${tableCls(profit)}">${fmt(profit)}</td><td class="num table-cell-center ${tableCls(ret)}">${pct(ret)}</td><td><div class="bar-box" role="progressbar" aria-label="현금성자산 비중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${weight}" aria-valuetext="${weight}%"><div class="bar-fill bar-gray" aria-hidden="true" style="width:${weight}%"></div></div><div class="small">${weight}%</div></td></tr>`}

function isSafePensionAsset(name=''){return /(채권|현금|예금|MMF|RP|CMA|단기채)/.test(String(name));}
function getPensionDayContributionItems(x){
  if(x.pensionPrevEval==null)return [];
  const cashDelta=Number(x.pensionCashDayChange)||0;
  const items=[...x.pensionRows.map(r=>({name:r.name,value:Number(r.dayChange)||0,color:pensionSeriesColor(r.name)})),{name:'현금성자산',value:cashDelta,color:CASH_ASSET_COLOR}]
    .filter(v=>v.value>0)
    .sort((a,b)=>b.value-a.value);
  const total=items.reduce((a,v)=>a+v.value,0);
  return items.map(v=>({...v,share:total?v.value/total*100:0}));
}
function getPensionRiskGauge(x){
  const riskEval=x.pensionRows.filter(r=>!isSafePensionAsset(r.name)).reduce((a,r)=>a+Number(r.evalAmount||0),0);
  const safeEval=Math.max(0,Number(x.pensionEval||0)-riskEval);
  const ratio=Number(x.pensionEval||0)?riskEval/Number(x.pensionEval)*100:0;
  const threshold=70;
  return {riskEval,safeEval,ratio,threshold,gap:ratio-threshold,allowedEval:Number(x.pensionEval||0)*(threshold/100)};
}
function renderPensionProductInsights(x){
  const items=getPensionDayContributionItems(x);
  const risk=getPensionRiskGauge(x);
  const gaugeWidth=Math.max(0,Math.min(100,risk.ratio));
  const riskTone=risk.ratio>risk.threshold?'danger':'safe';
  const topHtml=x.pensionPrevEval==null
    ? `<div class="pension-empty-state">전일 데이터가 없어 오늘 상승분 기여도를 표시하지 않습니다.</div>`
    : items.length
      ? `<div class="pension-stack-bar compact simple" role="group" aria-label="오늘 상승분 기여도 구성">${items.map((item,index)=>{const tooltipId=`pensionContributionTooltip${index}`;const ariaLabel=escapeHtml(`${item.name} 상승분 기여도 ${item.share.toFixed(1)}%, ${signed(item.value)}`);return `<div class="pension-stack-segment has-tooltip" tabindex="0" role="img" aria-label="${ariaLabel}" aria-describedby="${tooltipId}" style="width:${Math.max(item.share,2).toFixed(2)}%;background:${item.color}"><span>${item.share>=8?item.name.replace('KODEX ',''):''}</span><div id="${tooltipId}" class="pension-viz-tooltip" role="tooltip"><strong>${escapeHtml(item.name)}</strong><div>${item.share.toFixed(1)}%</div><div>${signed(item.value)}</div></div></div>`}).join('')}</div>`
      : `<div class="pension-empty-state">상승한 자산이 없어 기여도를 표시하지 않습니다.</div>`;
  const riskTooltip=`위험자산 ${won(risk.riskEval)} / 안전자산 ${won(risk.safeEval)} / 기준 대비 ${risk.gap>0?'+':''}${risk.gap.toFixed(1)}%p`;
  return `<div class="pension-insight-zone" role="group" aria-label="퇴직연금 인사이트"><div class="pension-insight-card compact-card" role="group" aria-labelledby="pensionContributionInsightTitle"><div class="pension-insight-head simple"><h3 id="pensionContributionInsightTitle">오늘 상승분 기여도</h3></div>${topHtml}</div><div class="pension-insight-card compact-card" role="group" aria-labelledby="pensionRiskInsightTitle"><div class="pension-insight-head simple"><h3 id="pensionRiskInsightTitle">위험자산 70% 룰</h3><span class="pension-insight-badge ${riskTone==='danger'?'danger':'safe'}" aria-hidden="true">현재 ${risk.ratio.toFixed(1)}%</span></div><div class="pension-risk-gauge compact has-tooltip" tabindex="0" role="img" aria-label="위험자산 비중 ${risk.ratio.toFixed(1)}%, 기준 ${risk.threshold}%, 기준 대비 ${risk.gap>0?'+':''}${risk.gap.toFixed(1)}%p" aria-describedby="pensionRiskTooltip"><div class="pension-risk-fill ${riskTone==='danger'?'danger':'safe'}" style="width:${gaugeWidth.toFixed(1)}%"></div><div class="pension-risk-threshold" aria-hidden="true" style="left:${risk.threshold}%"><span>${risk.threshold}%</span></div><div id="pensionRiskTooltip" class="pension-viz-tooltip wide" role="tooltip"><strong>위험자산 70% 룰</strong><div>${riskTooltip}</div></div></div><div class="pension-risk-scale" aria-hidden="true"><span>0%</span><span>기준 ${risk.threshold}%</span><span>100%</span></div></div></div>`;
}

// Modal Lifecycle / Form State · 모달 생명주기 / 입력 상태
function openPensionContributionModal(){
  const modal=document.getElementById('pensionContribModal');
  if(!modal) return;
  document.body.classList.add('contrib-modal-open');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  setPensionContributionTarget('cashSnapshot');
  syncPensionBatchModeUi();
  activateDashboardDialogFocus(modal,{initialFocus:modal.querySelector('.contrib-modal-close'),fallbackSelector:'[data-dashboard-action="open-pension-modal"]'});
}
function closePensionContributionModal(){
  const modal=document.getElementById('pensionContribModal');
  if(!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('contrib-modal-open');
  releaseDashboardDialogFocus(modal,{fallbackSelector:'[data-dashboard-action="open-pension-modal"]'});
  forceMobileViewportReflow();
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||e.defaultPrevented||document.getElementById('pensionActionPinModal'))return;
  const modal=document.getElementById('pensionContribModal');
  if(!modal?.classList.contains('show'))return;
  e.preventDefault();
  closeDateActionMenu();
  closePensionContributionModal();
});

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
  document.querySelectorAll('.contrib-target-option').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.target===target);
  });
  const standardFields=document.getElementById('pensionContribStandardFields');
  const tradeFields=document.getElementById('pensionEtfTradeFields');
  if(standardFields){
    standardFields.hidden=target==='etfTrade';
    standardFields.classList.toggle('cash-mode',target==='cashSnapshot');
  }
  if(tradeFields) tradeFields.hidden=target!=='etfTrade';

  const dateEl=document.getElementById('pensionContribDate');
  const amountEl=document.getElementById('pensionContribAmount');
  const memoEl=document.getElementById('pensionContribMemo');
  const amountLabel=document.getElementById('pensionContribAmountLabel');
  const cashCostField=document.getElementById('pensionCashCostField');
  const cashCostEl=document.getElementById('pensionCashCostBasis');
  const existingList=document.getElementById('pensionContribExistingList');
  const deleteHelp=document.getElementById('pensionContribDeleteHelp');
  const deleteStatus=document.getElementById('pensionContribDeleteStatus');
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
  if(deleteStatus){
    deleteStatus.textContent='';
    deleteStatus.className='contrib-status';
  }
  if(output){
    output.textContent='';
    output.classList.remove('show');
  }
}
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
function pensionEtfTradeExpected(draft=pensionEtfTradeDraft()){
  const {applyDate,product,qty,amount}=draft;
  if(!product||!Number.isFinite(qty)||qty<=0||!Number.isFinite(amount)||amount<=0) return null;
  const batchState=pensionState.batchMode?pensionBatchCurrentState():null;
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
function updatePensionEtfTradePreview(){
  const box=document.getElementById('pensionEtfTradePreview');
  if(!box) return;
  const draft=pensionEtfTradeDraft();
  const expected=pensionEtfTradeExpected(draft);
  if(!draft.tradeDate||!draft.product||draft.qtyRaw===''||draft.amountRaw===''||!expected){
    setPensionContributionSaveDisabled(false);
    box.className='pension-etf-trade-preview';
    box.innerHTML='<span class="small">상품·수량·체결금액을 입력하면 적용 후 예상값을 보여줍니다.</span>';
    return;
  }
  if(!Number.isInteger(draft.qty)||draft.qty<=0){
    setPensionContributionSaveDisabled(false);
    box.className='pension-etf-trade-preview warning';
    box.innerHTML='<strong>체결수량은 1좌 이상의 정수로 입력해주세요.</strong>';
    return;
  }
  if(draft.tradeDate>draft.applyDate){
    setPensionContributionSaveDisabled(false);
    box.className='pension-etf-trade-preview warning';
    box.innerHTML='<strong>신청일은 앱 반영일보다 늦을 수 없습니다.</strong>';
    return;
  }
  const insufficient=expected.cashAfter<0;
  if(insufficient){
    setPensionContributionSaveDisabled(true);
    box.className='pension-etf-trade-preview warning blocked';
    box.innerHTML=`<div class="pension-etf-trade-preview-title pension-etf-trade-blocked-title">⚠ 저장 불가</div>
      <div class="pension-etf-trade-preview-grid">
        <span>현재 현금성자산</span><strong>${won(expected.cashBefore)}</strong>
        <span>체결금액</span><strong>${won(draft.amount)}</strong>
        <span>부족금액</span><strong class="pension-etf-trade-shortage">${won(Math.abs(expected.cashAfter))}</strong>
      </div>
      <div class="pension-etf-trade-preview-alert">현금성자산보다 큰 금액의 추가 매수는 저장할 수 없습니다. 앱 기준 현금성자산 평가금액을 먼저 확인해주세요.</div>`;
    return;
  }
  setPensionContributionSaveDisabled(false);
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
    if(!expected) throw new Error('추가 매수 예상값을 계산하지 못했습니다.');
    if(expected.cashAfter<0) throw new Error(`현재 현금성자산 ${won(expected.cashBefore)}보다 체결금액이 큽니다. 현금성자산 평가금액을 먼저 확인해주세요.`);
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
  if(!dateEl||!amountEl||!memoEl) throw new Error('입력칸을 찾지 못했습니다.');
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
function setPensionContributionStatus(elementId,message,type='ok'){
  const status=document.getElementById(elementId);
  if(!status) return;
  status.textContent=message;
  status.className=`contrib-status show ${type}`;
}
function showPensionContributionStatus(message,type='ok'){
  setPensionContributionStatus('pensionContribStatus',message,type);
}
function showPensionMobileToast(message,type='ok',delay=3500){
  if(typeof window==='undefined'||!window.matchMedia||!window.matchMedia('(max-width:760px)').matches)return;
  showAppToast(message,type,delay);
}
function showPensionContributionDeleteStatus(message,type='ok'){
  setPensionContributionStatus('pensionContribDeleteStatus',message,type);
}
function clearPensionContributionStatus(elementId){
  const status=document.getElementById(elementId);
  if(!status)return;
  status.textContent='';
  status.className='contrib-status';
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
  const output=document.getElementById('pensionContribOutput');
  if(output){output.textContent='';output.classList.remove('show')}
  clearPensionContributionStatus('pensionContribStatus');
  clearPensionContributionStatus('pensionContribDeleteStatus');
  clearPensionContributionStatus('pensionBatchStatus');
  pensionState.batchLastAddFingerprint='';
  pensionState.batchLastAddAt=0;
  updatePensionEtfTradePreview();
  const queuedCount=pensionState.batchQueue.length;
  showPensionContributionStatus(queuedCount
    ? `입력값과 삭제 선택을 초기화했습니다. 작업 모음 ${queuedCount}건은 유지됩니다.`
    : '입력값과 삭제 선택을 초기화했습니다.','ok');
  document.activeElement?.blur?.();
}

// PIN Dialog · PIN 확인
function requestPensionActionPin({title='PIN 입력',description='작업 내용을 확인한 뒤 PIN 6자리를 입력하세요.',danger=false,actionLabel='',execute}={}){
  return new Promise(resolve=>{
    const old=document.getElementById('pensionActionPinModal');
    if(old) old.remove();

    const modal=document.createElement('div');
    modal.id='pensionActionPinModal';
    modal.className='action-modal pension-action-pin-modal';
    modal.innerHTML=`<div class="action-modal-card pension-action-pin-card" role="dialog" aria-modal="true" aria-labelledby="pensionActionPinTitle">
      <button type="button" class="modal-icon-btn pension-action-pin-close" aria-label="닫기">${navIconSvg('close')}</button>
      <h3 id="pensionActionPinTitle" class="modal-main-title">${title}</h3>
      <p id="pensionActionPinDescription" class="action-modal-description">${description}</p>
      <label class="action-modal-label" for="pensionActionPinInput">PIN</label>
      <input id="pensionActionPinInput" class="action-modal-input" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN 6자리 입력" aria-describedby="pensionActionPinDescription pensionActionPinGuide pensionActionPinStatus">
      <div id="pensionActionPinGuide" class="pension-action-pin-guide">PIN 확인 후 ${actionLabel||(danger?'삭제':'저장')}합니다.</div>
      <div id="pensionActionPinStatus" class="action-modal-status pension-action-pin-status" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="action-modal-buttons pension-action-pin-buttons"><button type="button" class="action-modal-btn ghost">취소</button></div>
    </div>`;

    let busy=false;
    let submitTimer=null;
    const input=modal.querySelector('#pensionActionPinInput');
    const status=modal.querySelector('#pensionActionPinStatus');
    const cancel=modal.querySelector('.ghost');
    const close=modal.querySelector('.pension-action-pin-close');

    const finish=value=>{
      clearTimeout(submitTimer);
      modal.remove();
      releaseDashboardDialogFocus(modal);
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
    modal.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    });
    cancel?.addEventListener('click',()=>finish(null));
    close?.addEventListener('click',()=>finish(null));
    modal.addEventListener('click',e=>{if(e.target===modal)finish(null)});

    document.body.appendChild(modal);
    activateDashboardDialogFocus(modal,{initialFocus:input});
  });
}


// Batch Queue / Simulation · 작업 모음 / 시뮬레이션
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
function pensionBatchSimulate(operations=pensionState.batchQueue){
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
      if(linked)throw new Error(`${linked.date} 현금성자산 기록이 이 ${op.target==='etfTrade'?'추가 매수를':'기업적립금을'} 반영하고 있습니다. 해당 날짜 현금성자산 삭제 작업을 작업 모음에 먼저 추가해주세요.`);
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
    if(!product)throw new Error(`${index+1}번 추가 매수 상품이 현재 퇴직연금 상품 목록에 없습니다.`);
    const qty=Number(item.qty),amount=Math.round(Number(item.amount));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(item.tradeDate||''))||String(item.tradeDate)>today)throw new Error(`${index+1}번 추가 매수 신청일을 확인해주세요.`);
    if(!Number.isInteger(qty)||qty<=0||!Number.isFinite(amount)||amount<=0)throw new Error(`${index+1}번 추가 매수 수량·금액을 확인해주세요.`);
    const cashBefore=pensionBatchCashAvailable(state,today);
    if(cashBefore<amount)throw new Error(`${index+1}번 추가 매수 시점의 현금성자산 ${won(cashBefore)}보다 체결금액 ${won(amount)}이 큽니다. 기업적립금/현금성자산 작업 순서를 확인해주세요.`);
    const saved={...item,id:item.id||op.tempId||`batch-trade-${index}`,date:today,applyDate:today,tradeDate:String(item.tradeDate),ticker:String(item.ticker),name:product.name,type:'buy',qty,price:amount/qty,amount,funding:'pension_cash',cashBefore,cashAfter:cashBefore-amount,updatedAtKST:`batch-${String(index).padStart(4,'0')}`,appliedAtKST:`batch-${String(index).padStart(4,'0')}`};
    state.trades=state.trades.filter(v=>String(v.id)!==String(saved.id));
    state.trades.push(saved);
    state.trades.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.appliedAtKST||'').localeCompare(String(b.appliedAtKST||''))||String(a.id).localeCompare(String(b.id)));
  });
  return {state,orderedOperations:orderInfo.operations,reordered:orderInfo.reordered};
}
function pensionBatchCurrentState(){
  try{return pensionBatchSimulate(pensionState.batchQueue).state}catch(_){return null}
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
  if(panel)panel.hidden=!pensionState.batchMode;
  if(count)count.textContent=`${pensionState.batchQueue.length}건`;
  if(badge){badge.textContent=String(pensionState.batchQueue.length);badge.hidden=pensionState.batchQueue.length===0}
  if(clear)clear.disabled=pensionState.batchQueue.length===0;
  if(list){
    list.innerHTML=pensionState.batchQueue.length?pensionState.batchQueue.map((op,index)=>`<div class="pension-batch-item"><div class="pension-batch-index">${index+1}</div><div class="pension-batch-item-text">${escapeHtml(pensionBatchOperationDescription(op))}</div><div class="pension-batch-item-actions"><button type="button" data-pension-action="move-batch" data-pension-qid="${op.qid}" data-pension-direction="-1" aria-label="위로" ${index===0?'disabled':''}>${navIconSvg('chevronUp')}</button><button type="button" data-pension-action="move-batch" data-pension-qid="${op.qid}" data-pension-direction="1" aria-label="아래로" ${index===pensionState.batchQueue.length-1?'disabled':''}>${navIconSvg('chevronDown')}</button><button type="button" class="remove" data-pension-action="remove-batch" data-pension-qid="${op.qid}" aria-label="작업 제거">${navIconSvg('trash')}</button></div></div>`).join(''):'<div class="pension-batch-empty">아직 추가된 작업이 없습니다.</div>';
  }
  let error='';let reordered=false;
  if(pensionState.batchQueue.length){
    try{const simulated=pensionBatchSimulate(pensionState.batchQueue);reordered=simulated.reordered}catch(e){error=e.message||String(e)}
  }
  if(note){
    if(error){note.hidden=false;note.className='pension-batch-order-note error';note.textContent=error}
    else if(reordered){note.hidden=false;note.className='pension-batch-order-note';note.textContent='연결된 현금성자산 삭제가 필요한 작업은 안전한 순서로 자동 조정해 일괄 처리합니다.'}
    else{note.hidden=true;note.textContent='';note.className='pension-batch-order-note'}
  }
  if(apply){
    apply.disabled=pensionState.batchQueue.length===0||!!error||pensionState.batchApplying;
    apply.textContent=pensionState.batchApplying?'처리 중...':(pensionState.batchQueue.length?`${pensionState.batchQueue.length}건 일괄 적용`:'일괄 적용');
  }
}
function syncPensionBatchModeUi(){
  document.querySelectorAll('.pension-work-mode-btn').forEach(btn=>{const active=(btn.dataset.mode==='batch')===pensionState.batchMode;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
  const save=document.getElementById('pensionContribSaveButton');
  const del=document.getElementById('pensionContribDeleteButton');
  if(save)save.textContent=pensionState.batchMode?'작업 모음에 추가':'저장';
  if(del)del.textContent=pensionState.batchMode?'삭제 작업 추가':'선택 항목 삭제';
  renderPensionBatchQueue();
}
function setPensionBatchMode(enabled){
  pensionState.batchMode=!!enabled;
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
  pensionState.batchRequestId='';
}
function getPensionBatchRequestId(){
  if(pensionState.batchRequestId)return pensionState.batchRequestId;
  const uuid=(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
  pensionState.batchRequestId=`pension-batch-${uuid}`;
  return pensionState.batchRequestId;
}
function addPensionBatchOperation(operation){
  const now=Date.now();
  const fingerprint=pensionBatchOperationFingerprint(operation);
  if(fingerprint&&fingerprint===pensionState.batchLastAddFingerprint&&now-pensionState.batchLastAddAt<800)throw new Error('동일한 작업이 방금 추가되었습니다. 중복 클릭은 반영하지 않았습니다.');
  const op={...operation,qid:`batch-${now}-${++pensionState.batchSequence}`,tempId:`batch-temp-${now}-${pensionState.batchSequence}`};
  if(op.action==='delete'&&pensionState.batchQueue.some(v=>v.action==='delete'&&v.target===op.target&&String(v.key)===String(op.key)))throw new Error('이미 작업 모음에 추가된 삭제 항목입니다.');
  pensionState.batchQueue.push(op);
  pensionState.batchLastAddFingerprint=fingerprint;
  pensionState.batchLastAddAt=now;
  resetPensionBatchRequestId();
  clearPensionContributionStatus('pensionBatchStatus');
  renderPensionBatchQueue();
  return op;
}
function removePensionBatchOperation(qid){
  pensionState.batchQueue=pensionState.batchQueue.filter(v=>v.qid!==qid);
  pensionState.batchLastAddFingerprint='';
  pensionState.batchLastAddAt=0;
  resetPensionBatchRequestId();
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
}
function movePensionBatchOperation(qid,direction){
  const index=pensionState.batchQueue.findIndex(v=>v.qid===qid);
  const next=index+Number(direction||0);
  if(index<0||next<0||next>=pensionState.batchQueue.length)return;
  const [item]=pensionState.batchQueue.splice(index,1);
  pensionState.batchQueue.splice(next,0,item);
  resetPensionBatchRequestId();
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
}
function clearPensionBatchQueue(){
  pensionState.batchQueue=[];
  pensionState.batchLastAddFingerprint='';
  pensionState.batchLastAddAt=0;
  resetPensionBatchRequestId();
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
  showPensionBatchStatus('작업 모음을 비웠습니다.','ok');
}
function showPensionBatchStatus(message,type='ok'){
  setPensionContributionStatus('pensionBatchStatus',message,type);
}
async function savePensionBatchViaGithubPages(operations,pin,batchRequestId){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.githubPages;
  if(!config.url||config.url.includes('여기에_'))throw new Error('GitHub Pages 저장 URL이 설정되지 않았습니다.');
  const payload={pin:String(pin||'').trim(),action:'batchPension',batchRequestId:String(batchRequestId||'').trim(),operations:operations.map(op=>({action:op.action,target:op.target,key:op.key||'',item:op.item||null}))};
  const res=await fetch(config.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!data.ok)throw new Error(data.error||'작업 모음 일괄 적용에 실패했습니다.');
  return data;
}
function applyPensionBatchStateLocally(state){
  if(!state)return;
  dataState.pensionCashSnapshots=Array.isArray(dataState.pensionCashSnapshots)?(state.cashSnapshots||[]):{...(dataState.pensionCashSnapshots||{}),snapshots:state.cashSnapshots||[]};
  dataState.pensionContributions=Array.isArray(dataState.pensionContributions)?(state.contributions||[]):{...(dataState.pensionContributions||{}),contributions:state.contributions||[]};
  dataState.pensionTrades=Array.isArray(dataState.pensionTrades)?(state.trades||[]):{...(dataState.pensionTrades||{}),trades:state.trades||[]};
}
async function applyPensionBatchQueue(){
  if(pensionState.batchApplying)return;
  if(!pensionState.batchQueue.length){showPensionBatchStatus('적용할 작업이 없습니다.','err');return}
  let simulated;
  try{simulated=pensionBatchSimulate(pensionState.batchQueue)}catch(e){showPensionBatchStatus(e.message||String(e),'err');return}
  const count=pensionState.batchQueue.length;
  const batchRequestId=getPensionBatchRequestId();
  pensionState.batchApplying=true;
  renderPensionBatchQueue();
  try{
    clearPensionContributionStatus('pensionBatchStatus');
    const data=await requestPensionActionPin({
      title:'작업 모음 일괄 적용',
      description:`저장·삭제 ${count}건을 한 번에 적용합니다. 하나라도 실패하면 전체 작업을 반영하지 않습니다.`,
      actionLabel:'일괄 적용',
      execute:pin=>savePensionBatchViaGithubPages(simulated.orderedOperations,pin,batchRequestId)
    });
    if(!data){showPensionBatchStatus('일괄 적용 취소','err');return}
    const duplicateWithoutState=!!data.duplicate&&!data.state;
    if(!duplicateWithoutState)applyPensionBatchStateLocally(data.state);
    pensionState.batchQueue=[];
    pensionState.batchLastAddFingerprint='';
    pensionState.batchLastAddAt=0;
    resetPensionBatchRequestId();
    pensionState.batchMode=true;
    pensionHooks.renderDashboard?.();
    openPensionContributionModal();
    setPensionBatchMode(true);
    showPensionBatchStatus(duplicateWithoutState
      ?'동일한 작업 모음은 이미 반영되어 있습니다. 중복 적용하지 않았습니다. 최신 값은 새로고침 후 확인해주세요.'
      :`작업 모음 ${count}건 적용 완료`,'ok');
    showPensionMobileToast(duplicateWithoutState
      ?`작업 모음 ${count}건 이미 반영 완료`
      :`작업 모음 ${count}건 적용 완료`,'ok');
  }finally{
    pensionState.batchApplying=false;
    renderPensionBatchQueue();
  }
}

// Persistence / Save/Delete · 저장 / 삭제
async function savePensionContributionViaGithubPages(item,pin){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.githubPages;
  if(!config.url || config.url.includes('여기에_'))throw new Error('GitHub Pages 저장 URL이 설정되지 않았습니다.');
  const payload={...item,pin:String(pin||'').trim(),target:item.target||'contribution',action:'upsert',updatedBy:'github-pages'};
  const res=await fetch(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  const data=await res.json().catch(()=>({}));
  if(!data.ok)throw new Error(data.error||'GitHub Pages 방식 저장 실패');
  return data;
}

async function savePensionContribution(){
  const out=document.getElementById('pensionContribOutput');
  try{
    if(pensionState.batchMode&&pensionContributionTarget()==='etfTrade'){
      const qtyRaw=String(document.getElementById('pensionEtfTradeQty')?.value||'').trim();
      const amountRaw=String(document.getElementById('pensionEtfTradeAmount')?.value||'').trim();
      const last=pensionState.batchQueue.at(-1);
      if(!qtyRaw&&!amountRaw&&last?.action==='upsert'&&last?.target==='etfTrade'&&Date.now()-pensionState.batchLastAddAt<800){
        throw new Error('동일한 작업이 방금 추가되었습니다. 중복 클릭은 반영하지 않았습니다.');
      }
    }
    const item=buildPensionContributionItem();
    if(out){out.textContent=JSON.stringify(item,null,2);out.classList.add('show')}
    const targetText=pensionContributionTargetLabel(item.target);
    if(pensionState.batchMode){
      addPensionBatchOperation({action:'upsert',target:item.target,item});
      if(item.target==='etfTrade'){
        const qtyEl=document.getElementById('pensionEtfTradeQty');
        const amountEl=document.getElementById('pensionEtfTradeAmount');
        if(qtyEl)qtyEl.value='';
        if(amountEl)amountEl.value='';
        updatePensionEtfTradePreview();
      }
      showPensionContributionStatus(`${targetText} 저장 작업 추가 완료`,'ok');
      return;
    }
    clearPensionContributionStatus('pensionContribStatus');
    const data=await requestPensionActionPin({
      title:`${targetText} 저장`,
      description:pensionSavePinDescription(item),
      execute:pin=>savePensionContributionViaGithubPages(item,pin)
    });
    if(!data){showPensionContributionStatus('저장 취소','err');return}
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
    showPensionContributionStatus(`${targetText} 저장 완료`,'ok');
    showPensionMobileToast(`${targetText} 저장 완료`,'ok');
  }catch(e){showPensionContributionStatus(e.message||String(e),'err')}
}

async function deletePensionContributionViaGithubPages(target,key,pin){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.githubPages;
  if(!config.url || config.url.includes('여기에_'))throw new Error('GitHub Pages 삭제 URL이 설정되지 않았습니다.');
  const isCash=target==='cashSnapshot';
  const res=await fetch(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({pin:String(pin||'').trim(),target:target||'contribution',action:'delete',id:isCash?'':key,date:isCash?key:''})
  });
  const data=await res.json().catch(()=>({}));
  if(!data.ok)throw new Error(data.error||'GitHub Pages 방식 삭제 실패');
  return data;
}

async function deleteSelectedPensionContribution(){
  const selected=document.querySelector('input[name="pensionContribDeleteTarget"]:checked');
  if(!selected){showPensionContributionDeleteStatus('삭제할 항목을 선택해주세요.','err');return}
  const [target,key]=String(selected.value||'').split('|');
  const isCash=target==='cashSnapshot';
  const isTrade=target==='etfTrade';
  const item=isCash
    ?pensionCashSnapshotItems().find(v=>v.date===key)
    :(isTrade?pensionTradeItems().find(v=>v.id===key):pensionContributionItems().find(v=>v.id===key));
  const targetText=pensionContributionTargetLabel(target);
  if(pensionState.batchMode){
    try{
      addPensionBatchOperation({action:'delete',target,key,sourceItem:item?{...item}:null});
      selected.checked=false;
      showPensionContributionDeleteStatus(`${targetText} 삭제 작업 추가 완료`,'ok');
    }catch(e){showPensionContributionDeleteStatus(e.message||String(e),'err')}
    return;
  }
  if(isTrade&&item){
    const linkedSnapshot=linkedPensionCashSnapshotForTrade(item);
    if(linkedSnapshot){
      showPensionContributionDeleteStatus(`${linkedSnapshot.date} 현금성자산 기록이 이 추가 매수를 반영하고 있습니다. 먼저 조정 항목을 '현금성자산'으로 바꿔 해당 날짜 항목을 삭제한 뒤 추가 매수를 삭제해주세요.`,'err');
      return;
    }
  }
  if(target==='contribution'&&item){
    const linkedSnapshot=linkedPensionCashSnapshotForContribution(item);
    if(linkedSnapshot){
      showPensionContributionDeleteStatus(`${linkedSnapshot.date} 현금성자산 기록이 이 기업적립금을 반영하고 있습니다. 먼저 조정 항목을 '현금성자산'으로 바꿔 해당 날짜 항목을 삭제한 뒤 기업적립금을 삭제해주세요.`,'err');
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
  if(!data){showPensionContributionDeleteStatus('삭제 취소','err');return}
  removePensionItemLocally(target,key);
  syncPensionContributionDeleteCard(target);
  if(target==='etfTrade') updatePensionEtfTradePreview();
  showPensionContributionDeleteStatus(`${targetText} 삭제 완료`,'ok');
  showPensionMobileToast(`${targetText} 삭제 완료`,'ok');
}


// Event Delegation / Tooltip · 이벤트 위임 / 툴팁
function handlePensionAction(control){
  const action=control.dataset.pensionAction;
  if(action==='reset-form')return resetPensionContributionForm();
  if(action==='close-modal')return closePensionContributionModal();
  if(action==='set-batch-mode')return setPensionBatchMode(control.dataset.pensionEnabled==='true');
  if(action==='set-target')return setPensionContributionTarget(control.dataset.target||'cashSnapshot');
  if(action==='save')return savePensionContribution();
  if(action==='delete-selected')return deleteSelectedPensionContribution();
  if(action==='clear-batch')return clearPensionBatchQueue();
  if(action==='apply-batch')return applyPensionBatchQueue();
  if(action==='move-batch')return movePensionBatchOperation(control.dataset.pensionQid||'',Number(control.dataset.pensionDirection||0));
  if(action==='remove-batch')return removePensionBatchOperation(control.dataset.pensionQid||'');
}
function setupPensionEventDelegation(){
  const root=document.documentElement;
  if(root.dataset.pensionEventsBound==='1')return;
  root.dataset.pensionEventsBound='1';
  document.addEventListener('click',event=>{
    if(event.target?.matches?.('[data-pension-backdrop-close="true"]')){
      closePensionContributionModal();
      return;
    }
    const control=event.target?.closest?.('[data-pension-action]');
    if(control)handlePensionAction(control);
  });
  document.addEventListener('change',event=>{
    const control=event.target?.closest?.('[data-pension-change]');
    if(control?.dataset.pensionChange==='trade-preview')updatePensionEtfTradePreview();
  });
  document.addEventListener('input',event=>{
    const control=event.target?.closest?.('[data-pension-input]');
    if(!control)return;
    const mode=control.dataset.pensionInput;
    if(mode==='money'||mode==='money-preview')formatPensionMoneyInput(control);
    if(mode==='trade-preview'||mode==='money-preview')updatePensionEtfTradePreview();
  });
}


function setupPensionVizTooltips(){
  if(pensionState.vizTooltipTouchBound)return;
  pensionState.vizTooltipTouchBound=true;

  const isTouchLike=()=>window.matchMedia('(hover: none)').matches||window.innerWidth<=900;
  const closeTooltips=except=>document.querySelectorAll('.pension-insight-zone .has-tooltip.tooltip-open').forEach(el=>{if(el!==except)el.classList.remove('tooltip-open')});

  document.addEventListener('click',e=>{
    const target=e.target.closest('.pension-insight-zone .has-tooltip');

    if(!target){
      closeTooltips(null);
      return;
    }

    if(!isTouchLike())return;

    e.preventDefault();
    e.stopPropagation();

    const shouldOpen=!target.classList.contains('tooltip-open');
    closeTooltips(target);
    target.classList.toggle('tooltip-open',shouldOpen);
  });

  document.addEventListener('scroll',()=>closeTooltips(null),true);
}

