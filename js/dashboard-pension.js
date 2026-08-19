import {
  CASH_ASSET_COLOR,
  cls,
  dataState,
  fmt,
  latestPensionContribution,
  pct,
  pensionEvaluationBasisText,
  pensionSeriesColor,
  shortDate,
  signed,
  sortPensionItems,
  tableCls,
  won
} from './dashboard-core.js';
import {
  escapeHtml,
  pensionProductSwatch
} from './dashboard-ui-common.js';
import { renderPensionCharts } from './dashboard-charts.js';
import {
  metricCard,
  mobileInfoCard,
  mobileViewAttrs,
  mobileViewToggle
} from './dashboard-ui.js';

// 퇴직연금 현황 rendering · 상품 인사이트 · 시각화 tooltip

let pensionVizTooltipTouchBound=false;

const pensionContributionSubText=x=>{
  const latest=latestPensionContribution(x.date);
  return latest?`${latest.date} 기업적립금 ${won(Number(latest.amount)||0)} 반영 기준`:'6/30까지 기 반영분 기준';
};

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
  return `<div class="note pension-products-note" id="pension-products" ${mobileViewAttrs('pensionProducts')}><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="package" aria-hidden="true"></span>연금상품별 현황</h2>${mobileViewToggle('pensionProducts')}</div><div id="pension-products-table-view" class="mobile-scroll table-view"><table class="dashboard-data-table pension-products-table"><caption class="visually-hidden">퇴직연금 상품별 현황</caption><thead><tr><th scope="col">상품</th><th scope="col" class="table-cell-center">수량</th><th scope="col">평균단가</th><th scope="col">매수원금</th><th scope="col">평가금액</th><th scope="col">평가손익</th><th scope="col" class="table-cell-center">수익률</th><th scope="col">비중</th></tr></thead><tbody>${orderedPensionRows.map(r=>pensionRow(r,x.pensionEval)).join('')}${pensionCashRow(x.pensionCash,x.pensionEval,pensionCashCost)}<tr class="summary-row"><th scope="row">합계</th><td class="table-cell-center"></td><td></td><td class="num table-cell-right">${fmt(pensionHeldCost)}</td><td class="num table-cell-right">${fmt(x.pensionEval)}</td><td class="num table-cell-right ${tableCls(pensionHeldProfit)}">${fmt(pensionHeldProfit)}</td><td class="num table-cell-center ${tableCls(pensionHeldReturn)}">${pct(pensionHeldReturn)}</td><td></td></tr></tbody></table></div><div id="pension-products-card-view" class="mobile-card-view">${cards}</div><p class="small section-explainer pension-products-basis-note">※ 매수원금 합계는 현재 보유상품 재투자 기준</p>${renderPensionProductInsights(x)}</div>`;
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
        changeContent=hasPrevPension?`<div class="change-kpis"><div class="mini-card"><div class="m-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가금액</div><div class="m-value">${won(x.pensionPrevEval)}</div></div><div class="mini-card"><div class="m-label">${shortDate(x.date)} 평가금액</div><div class="m-value">${won(x.pensionEval)}</div></div><div class="mini-card"><div class="m-label">하루 변동분</div><div class="m-value ${cls(day)}">${signed(day,'원')}</div></div><div class="mini-card"><div class="m-label">하루 변동률</div><div class="m-value ${cls(rate)}">${(rate>0?'+':'')+pct(rate)}</div></div></div><div id="pension-change-table-view" class="change-table-wrap mobile-scroll table-view"><table class="dashboard-data-table change-table"><caption class="visually-hidden">퇴직연금 전일 대비 상품별 변동</caption><thead><tr><th scope="col">상품</th><th scope="col">${x.prevKey?shortDate(x.prevKey):'-'} 종가</th><th scope="col">${shortDate(x.date)} 종가</th><th scope="col">일변동</th></tr></thead><tbody>${orderedPensionRows.map(r=>`<tr><th scope="row"><strong>${mobileTableProductName(r.name)}</strong>${pensionProductSwatch(r.name)}</th><td class="num table-cell-right"><span class="change-price">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span><span class="change-eval">${r.prevEval==null?'-':won(r.prevEval)}</span></td><td class="num table-cell-right"><span class="change-price">${fmt(r.price)}</span><span class="change-eval">${won(r.evalAmount)}</span></td><td class="num table-cell-right ${tableCls(r.dayChange)}">${r.dayChange==null?'-':signed(r.dayChange)}</td></tr>`).join('')}<tr><th scope="row">현금성자산</th><td class="num table-cell-right"><span class="change-price">—</span><span class="change-eval">${won(x.prevPensionCash)}</span></td><td class="num table-cell-right"><span class="change-price">—</span><span class="change-eval">${won(x.pensionCash)}</span></td><td class="num table-cell-right ${tableCls(x.pensionCashDayChange)}">${signed(x.pensionCashDayChange)}</td></tr><tr class="summary-row"><th scope="row">합계</th><td class="num table-cell-right">${fmt(x.pensionPrevEval)}</td><td class="num table-cell-right">${fmt(x.pensionEval)}</td><td class="num table-cell-right ${tableCls(day)}">${signed(day)}</td></tr></tbody></table></div><div id="pension-change-card-view" class="change-mobile-list mobile-card-view">${orderedPensionRows.map(r=>mobileInfoCard(r.name,[[prevPensionDateLabel+' 종가',r.prevPrice==null?'-':fmt(r.prevPrice)],[prevPensionDateLabel+' 평가액',r.prevEval==null?'-':won(r.prevEval)],[currentPensionDateLabel+' 종가',fmt(r.price)],[currentPensionDateLabel+' 평가액',won(r.evalAmount)],['일변동',r.dayChange==null?'-':signed(r.dayChange),cls(r.dayChange)]])).join('')}${mobileInfoCard('현금성자산',[[prevPensionDateLabel+' 평가액',won(x.prevPensionCash)],[currentPensionDateLabel+' 평가액',won(x.pensionCash)],['일변동',signed(x.pensionCashDayChange),cls(x.pensionCashDayChange)]])}</div>`:noPrevBlock;
  return `<section id="pension-section"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="briefcase" aria-hidden="true"></span>퇴직연금 현황</h2></div><div class="pension-band"><div class="grid cards metric-grid pension-metric-grid">${metricCard('퇴직연금 평가금액',won(x.pensionEval),pensionEvaluationBasisText(x.date),true)}${metricCard('퇴직연금 납입원금',won(x.pensionPrincipal),pensionContributionSubText(x))}${metricCard('퇴직연금 운용수익',won(x.pensionProfit),'평가금액 - 납입원금',false,cls(x.pensionProfit))}${metricCard('퇴직연금 누적수익률',pct(x.pensionReturn),'퇴직연금 운용수익 ÷ 퇴직연금 납입원금',false,cls(x.pensionReturn))}</div><div class="grid two pension-detail-grid">${renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn)}<div class="note pension-change-note" id="pension-change" ${mobileViewAttrs('pensionChange')}><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="trending" aria-hidden="true"></span>전일 대비 변동</h2>${hasPrevPension?mobileViewToggle('pensionChange'):''}</div>${changeContent}</div></div>${renderPensionCharts(x)}</div></section>`;
}
function mobileTableProductName(name=''){
  const text=String(name||'');
  return text.startsWith('KODEX ')?`<span class="mobile-table-kodex-prefix">KODEX </span>${text.slice(6)}`:text;
}
function pensionRow(r,total){const w=total?r.evalAmount/total*100:0,safeW=Math.max(0,Math.min(100,w)),weight=safeW.toFixed(1),name=String(r.name||'');return `<tr><th scope="row"><strong>${mobileTableProductName(r.name)}</strong>${pensionProductSwatch(r.name)}</th><td class="num table-cell-center">${fmt(r.qty)}</td><td class="num table-cell-right">${fmt(r.qty?r.cost/r.qty:0)}</td><td class="num table-cell-right">${fmt(r.cost)}</td><td class="num table-cell-right">${fmt(r.evalAmount)}</td><td class="num table-cell-right ${tableCls(r.profit)}">${fmt(r.profit)}</td><td class="num table-cell-center ${tableCls(r.returnRate)}">${pct(r.returnRate)}</td><td class="num table-cell-center"><div class="bar-box" role="progressbar" aria-label="${escapeHtml(name)} 비중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${weight}" aria-valuetext="${weight}%"><div class="bar-fill" aria-hidden="true" style="width:${weight}%;background:${pensionSeriesColor(r.name)}"></div></div><div class="small">${weight}%</div></td></tr>`}
function pensionCashRow(cash,total,cost=39408){const w=total?cash/total*100:0,safeW=Math.max(0,Math.min(100,w)),weight=safeW.toFixed(1),profit=cash-cost,ret=cost?profit/cost*100:0;return `<tr><th scope="row"><strong>현금성자산</strong></th><td class="num table-cell-center">1</td><td class="num table-cell-right">${fmt(cost)}</td><td class="num table-cell-right">${fmt(cost)}</td><td class="num table-cell-right">${fmt(cash)}</td><td class="num table-cell-right ${tableCls(profit)}">${fmt(profit)}</td><td class="num table-cell-center ${tableCls(ret)}">${pct(ret)}</td><td class="num table-cell-center"><div class="bar-box" role="progressbar" aria-label="현금성자산 비중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${weight}" aria-valuetext="${weight}%"><div class="bar-fill bar-gray" aria-hidden="true" style="width:${weight}%"></div></div><div class="small">${weight}%</div></td></tr>`}

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

function setupPensionVizTooltips(){
  if(pensionVizTooltipTouchBound)return;
  pensionVizTooltipTouchBound=true;

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

export {
  renderPension,
  setupPensionVizTooltips
};
