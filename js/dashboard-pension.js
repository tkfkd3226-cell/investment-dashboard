import {
  CASH_ASSET_COLOR,
  cls,
  dataState,
  fmt,
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
  mobileTableAssetName,
  pensionProductSwatch,
  renderAssetContributionCard,
  renderAssetDayChangeBlock,
  renderAssetStatusBlock,
  renderAssetWeight
} from './dashboard-ui-common.js';
import { renderPensionCharts } from './dashboard-charts.js';
import {
  metricCard,
  mobileInfoCard,
  mobileViewAttrs,
  mobileViewToggle
} from './dashboard-ui.js';

// 퇴직연금 현황 rendering · 상품 인사이트


const pensionEvaluationMobileSubText=x=>{
  const full=pensionEvaluationBasisText(x.date);
  return `${shortDate(x.date)}${full.includes(' 추정 ')?' 추정':''} 기준`;
};

// Pension Insights / Risk Gauge · 퇴직연금 인사이트 / 위험자산 게이지
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
  const contributionHtml=renderAssetContributionCard({
    idPrefix:'pensionContribution',
    hasPrev:x.pensionPrevEval!=null,
    items:items.map(item=>({...item,shortLabel:item.name.replace('KODEX ',''),valueText:signed(item.value)})),
  });
  const riskTooltip=`위험자산 ${won(risk.riskEval)} / 안전자산 ${won(risk.safeEval)} / 기준 대비 ${risk.gap>0?'+':''}${risk.gap.toFixed(1)}%p`;
  const riskHtml=`<div class="asset-insight-card" role="group" aria-labelledby="pensionRiskInsightTitle"><div class="asset-insight-head simple"><h3 id="pensionRiskInsightTitle">위험자산 70% 룰</h3><span class="pension-insight-badge ${riskTone==='danger'?'danger':'safe'}" aria-hidden="true">현재 ${risk.ratio.toFixed(1)}%</span></div><div class="pension-risk-gauge compact has-tooltip" tabindex="0" role="img" aria-label="위험자산 비중 ${risk.ratio.toFixed(1)}%, 기준 ${risk.threshold}%, 기준 대비 ${risk.gap>0?'+':''}${risk.gap.toFixed(1)}%p" aria-describedby="pensionRiskTooltip"><div class="pension-risk-fill ${riskTone==='danger'?'danger':'safe'}" style="width:${gaugeWidth.toFixed(1)}%"></div><div class="pension-risk-threshold" aria-hidden="true" style="left:${risk.threshold}%"><span>${risk.threshold}%</span></div><div id="pensionRiskTooltip" class="asset-viz-tooltip wide" role="tooltip"><strong>위험자산 70% 룰</strong><div>${riskTooltip}</div></div></div><div class="pension-risk-scale" aria-hidden="true"><span>0%</span><span>기준 ${risk.threshold}%</span><span>100%</span></div></div>`;
  return `<div class="asset-insight-zone" role="group" aria-label="퇴직연금 인사이트">${contributionHtml}${riskHtml}</div>`;
}

// Pension Product / Change Rendering · 상품 현황 / 전일대비 렌더링
function renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn){
  const orderedPensionRows=sortPensionItems(x.pensionRows),
        cashProfit=x.pensionCash-pensionCashCost,
        cashReturn=pensionCashCost?cashProfit/pensionCashCost*100:0,
        cashWeight=x.pensionEval?x.pensionCash/x.pensionEval*100:0;
  const rows=orderedPensionRows.map(r=>({
    labelHtml:`${mobileTableAssetName(r.name)}${pensionProductSwatch(r.name)}`,
    cells:[
      {className:'num table-cell-center',html:fmt(r.qty)},
      {className:'num',html:fmt(r.qty?r.cost/r.qty:0)},
      {className:'num',html:fmt(r.cost)},
      {className:'num',html:fmt(r.evalAmount)},
      {className:`num ${tableCls(r.profit)}`,html:fmt(r.profit)},
      {className:`num table-cell-center ${tableCls(r.returnRate)}`,html:pct(r.returnRate)},
      {className:'num table-cell-center',html:renderAssetWeight({label:r.name,weight:x.pensionEval?r.evalAmount/x.pensionEval*100:0,color:pensionSeriesColor(r.name)})}
    ]
  }));
  rows.push({
    labelClass:'table-label-regular',
    labelHtml:'현금성자산',
    cells:[
      {className:'num table-cell-center',html:'-'},
      {className:'num',html:'-'},
      {className:'num',html:fmt(pensionCashCost)},
      {className:'num',html:fmt(x.pensionCash)},
      {className:`num ${tableCls(cashProfit)}`,html:fmt(cashProfit)},
      {className:`num table-cell-center ${tableCls(cashReturn)}`,html:pct(cashReturn)},
      {className:'num table-cell-center',html:renderAssetWeight({label:'현금성자산',weight:cashWeight,fillClass:'bar-gray'})}
    ]
  });
  const summaryRows=[{
    className:'summary-row',
    labelHtml:'합계',
    cells:[
      {className:'table-cell-center',html:'-'},
      {className:'num',html:'-'},
      {className:'num',html:fmt(pensionHeldCost)},
      {className:'num',html:fmt(x.pensionEval)},
      {className:`num ${tableCls(pensionHeldProfit)}`,html:fmt(pensionHeldProfit)},
      {className:`num table-cell-center ${tableCls(pensionHeldReturn)}`,html:pct(pensionHeldReturn)},
      {className:'num table-cell-center',html:renderAssetWeight({label:'합계',weight:100,fillClass:'bar-gray'})}
    ]
  }];
  const cards=orderedPensionRows.map(r=>({
    title:`<span class="holding-name-text">${r.name}</span>${pensionProductSwatch(r.name)}`,
    accessibleLabel:r.name,
    items:[
      ['수량',fmt(r.qty)],['평균단가',won(r.qty?r.cost/r.qty:0)],['매수원금',won(r.cost)],['평가금액',won(r.evalAmount)],['평가손익',won(r.profit),cls(r.profit)],['수익률',pct(r.returnRate),cls(r.returnRate)],['비중',pct(x.pensionEval?r.evalAmount/x.pensionEval*100:0)]
    ]
  }));
  cards.push({title:'현금성자산',items:[
    ['매수원금',won(pensionCashCost)],['평가금액',won(x.pensionCash)],['평가손익',won(cashProfit),cls(cashProfit)],['수익률',pct(cashReturn),cls(cashReturn)],['비중',pct(cashWeight)]
  ]});
  cards.push({title:'합계',extraClass:'summary-card mobile-total-card',items:[
    ['매수원금',won(pensionHeldCost)],['평가금액',won(x.pensionEval)],['평가손익',won(pensionHeldProfit),cls(pensionHeldProfit)],['수익률',pct(pensionHeldReturn),cls(pensionHeldReturn)],['비중',pct(100)]
  ]});
  return renderAssetStatusBlock({
    sectionId:'pension-products',
    idPrefix:'pension-products',
    viewStateKey:'pensionProducts',
    title:'연금상품별 현황',
    icon:'package',
    caption:'퇴직연금 상품별 현황',
    columns:[
      {label:'상품',className:'table-cell-text'},
      {label:'수량',className:'table-cell-center'},
      {label:'평균단가'},
      {label:'매수원금'},
      {label:'평가금액'},
      {label:'평가손익'},
      {label:'수익률',className:'table-cell-center'},
      {label:'비중'}
    ],
    rows,
    summaryRows,
    cards,
    afterHtml:`<p class="small section-explainer">※ 매수원금 합계는 현재 보유상품 재투자 기준</p>${renderPensionProductInsights(x)}`,
    mobileViewAttrs,
    mobileViewToggle,
    mobileInfoCard
  });
}

function renderPensionChangeBlock(x,orderedPensionRows,day,rate){
  const hasPrev=x.pensionPrevEval!=null,
        prevDateLabel=x.prevKey?shortDate(x.prevKey):'-',
        currentDateLabel=shortDate(x.date);
  const rows=orderedPensionRows.map(r=>({
    labelHtml:`<strong>${mobileTableAssetName(r.name)}</strong>${pensionProductSwatch(r.name)}`,
    cells:[
      {className:'num',html:`<span class="change-price">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span><span class="change-eval data-table-sub">${r.prevEval==null?'-':won(r.prevEval)}</span>`},
      {className:'num',html:`<span class="change-price">${fmt(r.price)}</span><span class="change-eval data-table-sub">${won(r.evalAmount)}</span><span class="asset-change-mobile-delta ${tableCls(r.dayChange)}"><span class="visually-hidden">일변동 </span>${r.dayChange==null?'-':signed(r.dayChange)}</span>`},
      {className:`num asset-change-delta-col ${tableCls(r.dayChange)}`,html:r.dayChange==null?'-':signed(r.dayChange)}
    ]
  }));
  rows.push({
    labelHtml:'현금성자산',
    cells:[
      {className:'num',html:`<span class="change-price">—</span><span class="change-eval data-table-sub">${won(x.prevPensionCash)}</span>`},
      {className:'num',html:`<span class="change-price">—</span><span class="change-eval data-table-sub">${won(x.pensionCash)}</span><span class="asset-change-mobile-delta ${tableCls(x.pensionCashDayChange)}"><span class="visually-hidden">일변동 </span>${signed(x.pensionCashDayChange)}</span>`},
      {className:`num asset-change-delta-col ${tableCls(x.pensionCashDayChange)}`,html:signed(x.pensionCashDayChange)}
    ]
  });
  const summaryRows=[{
    className:'summary-row',
    labelHtml:'합계',
    cells:[
      {className:'num',html:fmt(x.pensionPrevEval)},
      {className:'num',html:`${fmt(x.pensionEval)}<span class="asset-change-mobile-delta ${tableCls(day)}"><span class="visually-hidden">일변동 </span>${signed(day)}</span>`},
      {className:`num asset-change-delta-col ${tableCls(day)}`,html:signed(day)}
    ]
  }];
  const cards=orderedPensionRows.map(r=>({
    title:r.name,
    items:[
      [prevDateLabel+' 종가',r.prevPrice==null?'-':fmt(r.prevPrice)],
      [prevDateLabel+' 평가금액',r.prevEval==null?'-':won(r.prevEval)],
      [currentDateLabel+' 종가',fmt(r.price)],
      [currentDateLabel+' 평가금액',won(r.evalAmount)],
      ['일변동',r.dayChange==null?'-':signed(r.dayChange),cls(r.dayChange)]
    ]
  }));
  cards.push({title:'현금성자산',items:[
    [prevDateLabel+' 평가금액',won(x.prevPensionCash)],
    [currentDateLabel+' 평가금액',won(x.pensionCash)],
    ['일변동',signed(x.pensionCashDayChange),cls(x.pensionCashDayChange)]
  ]});
  return renderAssetDayChangeBlock({
    sectionId:'pension-change',
    idPrefix:'pension-change',
    viewStateKey:'pensionChange',
    hasPrev,
    summaryItems:[
      {label:`${prevDateLabel} 평가금액`,value:won(x.pensionPrevEval)},
      {label:`${currentDateLabel} 평가금액`,value:won(x.pensionEval)},
      {label:'하루 변동분',value:signed(day,'원'),valueClass:cls(day)},
      {label:'하루 변동률',value:(rate>0?'+':'')+pct(rate),valueClass:cls(rate)}
    ],
    caption:'퇴직연금 전일 대비 상품별 변동',
    columns:[
      {label:'상품',className:'table-cell-text'},
      {label:`${prevDateLabel} 종가`},
      {label:`${currentDateLabel} 종가`},
      {label:'일변동',className:'asset-change-delta-col'}
    ],
    rows,
    summaryRows,
    cards,
    noPrevHtml:'<div class="asset-no-prev-note">전일 데이터가 없습니다.</div>',
    mobileViewAttrs,
    mobileViewToggle,
    mobileInfoCard
  });
}
// Pension Section Composition · 퇴직연금 섹션 조합
function renderPension(x){
  const c=dataState.portfolio.constants,
        day=x.pensionDayChange,
        rate=x.pensionDayRate,
        pensionCashCost=Number(x.pensionCashCost||0),
        pensionHeldCost=x.pensionRows.reduce((a,r)=>a+r.cost,0)+pensionCashCost,
        pensionHeldProfit=x.pensionEval-pensionHeldCost,
        pensionHeldReturn=pensionHeldCost?pensionHeldProfit/pensionHeldCost*100:0,
        orderedPensionRows=sortPensionItems(x.pensionRows);
  return `<section id="pension-section"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="briefcase" aria-hidden="true"></span>퇴직연금 현황</h2></div><div class="pension-band"><div class="asset-overview"><div class="section-title"><h3><span class="section-title-icon" data-section-title-icon="chart" aria-hidden="true"></span>성과 요약</h3></div><div class="grid cards metric-grid pension-metric-grid">${metricCard('평가금액',won(x.pensionEval),pensionEvaluationBasisText(x.date),true,'',pensionEvaluationMobileSubText(x))}${metricCard('납입원금',won(x.pensionPrincipal),'최근 적립금 반영',false,'','최근 적립금 반영')}${metricCard('운용손익',won(x.pensionProfit),'평가금액 - 납입원금',false,cls(x.pensionProfit))}${metricCard('운용수익률',pct(x.pensionReturn),'운용손익 ÷ 납입원금',false,cls(x.pensionReturn))}</div></div><div class="grid two asset-detail-grid">${renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn)}${renderPensionChangeBlock(x,orderedPensionRows,day,rate)}</div>${renderPensionCharts(x)}</div></section>`;
}


export {
  renderPension
};
