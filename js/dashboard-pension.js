import {
  CASH_ASSET_COLOR,
  assetPriceColumnLabel,
  cls,
  dayChangeRate,
  fmt,
  pct,
  pensionEvaluationBasisText,
  pensionSeriesColor,
  shortDate,
  signed,
  sortPensionItems,
  won
} from './dashboard-core.js';
import {
  assetColorSwatch,
  metricCard,
  mobileTableAssetName,
  renderAssetContributionCard,
  renderAssetDayChangeValue,
  renderAssetDayChangeBlock,
  renderAssetInsightCard,
  renderAssetInsightZone,
  renderAssetStatusBlock,
  renderAssetWeight
} from './dashboard-ui-common.js';
import { renderPensionCharts } from './dashboard-charts.js';

// Pension Rendering · summary / product status / daily change / section composition
// Structure map:
//   [PENSION01] Evaluation Text / Insights / Risk Gauge
//   [PENSION02] Product / Change Rendering
//   [PENSION03] Section Composition
//   [PENSION04] Public API


// [PENSION01] Evaluation Text / Insights / Risk Gauge · 평가기준 문구 / 인사이트 / 위험자산 게이지
const pensionEvaluationMobileSubText=x=>{
  const full=pensionEvaluationBasisText(x.date);
  return `${shortDate(x.date)}${full.includes(' 추정 ')?' 추정':''} 기준`;
};

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
  const riskContent=`<div class="pension-risk-gauge has-tooltip" tabindex="0" role="img" aria-label="위험자산 비중 ${risk.ratio.toFixed(1)}%, 기준 ${risk.threshold}%, 기준 대비 ${risk.gap>0?'+':''}${risk.gap.toFixed(1)}%p" aria-describedby="pensionRiskTooltip" style="--pension-risk-ratio:${gaugeWidth.toFixed(1)}%;--pension-risk-threshold-position:${risk.threshold}%"><div class="pension-risk-fill ${riskTone==='danger'?'danger':'safe'}"></div><div class="pension-risk-threshold" aria-hidden="true"><span>${risk.threshold}%</span></div><div id="pensionRiskTooltip" class="asset-viz-tooltip wide" role="tooltip"><strong>위험자산 70% 룰</strong><div>${riskTooltip}</div></div></div><div class="pension-risk-scale" aria-hidden="true"><span>0%</span><span>기준 ${risk.threshold}%</span><span>100%</span></div>`;
  const riskHtml=renderAssetInsightCard({idPrefix:'pensionRisk',title:'위험자산 70% 룰',headExtra:`<span class="pension-insight-badge ${riskTone==='danger'?'danger':'safe'}" aria-hidden="true">현재 ${risk.ratio.toFixed(1)}%</span>`,content:riskContent});
  return renderAssetInsightZone({label:'퇴직연금 인사이트',content:`${contributionHtml}${riskHtml}`});
}

// [PENSION02] Product / Change Rendering · 상품 현황 / 전일대비 렌더링
// Feature-owned presentation adapters: 연금 상품 팔레트/표시명 정책은 연금 feature가 소유한다.
const pensionProductSwatch=name=>assetColorSwatch(pensionSeriesColor(name));
function renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn){
  const orderedPensionRows=sortPensionItems(x.pensionRows),
        productCost=orderedPensionRows.reduce((a,r)=>a+(Number(r.cost)||0),0),
        productEval=orderedPensionRows.reduce((a,r)=>a+(Number(r.evalAmount)||0),0),
        productProfit=productEval-productCost,
        productReturn=productCost?productProfit/productCost*100:0,
        productWeight=x.pensionEval?productEval/x.pensionEval*100:0,
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
      {className:`num ${cls(r.profit)}`,html:fmt(r.profit)},
      {className:`num table-cell-center ${cls(r.returnRate)}`,html:pct(r.returnRate)},
      {className:'num table-cell-center',html:renderAssetWeight({label:r.name,weight:x.pensionEval?r.evalAmount/x.pensionEval*100:0,color:pensionSeriesColor(r.name)})}
    ]
  }));
  const summaryRows=[
    {
      className:'summary-row',
      labelHtml:'투자상품 합계',
      cells:[
        {className:'num table-cell-center',html:'-'},
        {className:'num',html:'-'},
        {className:'num',html:fmt(productCost)},
        {className:'num',html:fmt(productEval)},
        {className:`num ${cls(productProfit)}`,html:fmt(productProfit)},
        {className:`num table-cell-center ${cls(productReturn)}`,html:pct(productReturn)},
        {className:'num table-cell-center',html:renderAssetWeight({label:'투자상품 합계',weight:productWeight,fillClass:'bar-gray'})}
      ]
    },
    {
      labelClass:'table-label-regular',
      labelHtml:'현금성자산',
      cells:[
        {className:'num table-cell-center',html:'-'},
        {className:'num',html:'-'},
        {className:'num',html:fmt(pensionCashCost)},
        {className:'num',html:fmt(x.pensionCash)},
        {className:`num ${cls(cashProfit)}`,html:fmt(cashProfit)},
        {className:`num table-cell-center ${cls(cashReturn)}`,html:pct(cashReturn)},
        {className:'num table-cell-center',html:renderAssetWeight({label:'현금성자산',weight:cashWeight,fillClass:'bar-gray'})}
      ]
    },
    {
      className:'summary-row',
      labelHtml:'총합계',
      cells:[
        {className:'num table-cell-center',html:'-'},
        {className:'num',html:'-'},
        {className:'num',html:fmt(pensionHeldCost)},
        {className:'num',html:fmt(x.pensionEval)},
        {className:`num ${cls(pensionHeldProfit)}`,html:fmt(pensionHeldProfit)},
        {className:`num table-cell-center ${cls(pensionHeldReturn)}`,html:pct(pensionHeldReturn)},
        {className:'num table-cell-center',html:renderAssetWeight({label:'총합계',weight:100,fillClass:'bar-gray'})}
      ]
    }
  ];
  const cards=orderedPensionRows.map(r=>({
    title:`<span class="holding-name-text">${r.name}</span>${pensionProductSwatch(r.name)}`,
    accessibleLabel:r.name,
    items:[
      ['수량',fmt(r.qty)],['평균단가',won(r.qty?r.cost/r.qty:0)],['매수원금',won(r.cost)],['평가금액',won(r.evalAmount)],['평가손익',won(r.profit),cls(r.profit)],['수익률',pct(r.returnRate),cls(r.returnRate)],['비중',pct(x.pensionEval?r.evalAmount/x.pensionEval*100:0)]
    ]
  }));
  cards.push({title:'투자상품 합계',extraClass:'mobile-total-card',items:[
    ['매수원금',won(productCost)],['평가금액',won(productEval)],['평가손익',won(productProfit),cls(productProfit)],['수익률',pct(productReturn),cls(productReturn)],['비중',pct(productWeight)]
  ]});
  cards.push({title:'현금성자산',items:[
    ['매수원금',won(pensionCashCost)],['평가금액',won(x.pensionCash)],['평가손익',won(cashProfit),cls(cashProfit)],['수익률',pct(cashReturn),cls(cashReturn)],['비중',pct(cashWeight)]
  ]});
  cards.push({title:'총합계',extraClass:'mobile-total-card',items:[
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
    afterHtml:`<p class="small section-explainer">※ 매수원금 합계는 현재 보유상품 재투자 기준</p>${renderPensionProductInsights(x)}`
  });
}

function renderPensionChangeBlock(x,orderedPensionRows){
  const hasPrev=x.pensionPrevEval!=null,
        prevDateLabel=x.prevKey?shortDate(x.prevKey):'-',
        currentDateLabel=shortDate(x.date),
        prevPriceLabel=assetPriceColumnLabel(x.prevKey),
        currentPriceLabel=assetPriceColumnLabel(x.date,{current:true}),
        productPrevEval=hasPrev?orderedPensionRows.reduce((a,r)=>a+(Number(r.prevEval)||0),0):null,
        productEval=orderedPensionRows.reduce((a,r)=>a+(Number(r.evalAmount)||0),0),
        productDayChange=hasPrev?orderedPensionRows.reduce((a,r)=>a+(Number(r.dayChange)||0),0):null,
        productBuyAmount=hasPrev?orderedPensionRows.reduce((a,r)=>a+(Number(r.tradeFlow?.buyAmount)||0),0):0,
        productDayRate=hasPrev?dayChangeRate(productDayChange,productPrevEval,productBuyAmount):null;
  const rows=orderedPensionRows.map(r=>({
    className:'asset-change-row',
    labelClass:'asset-change-asset-col',
    labelHtml:`${mobileTableAssetName(r.name)}${pensionProductSwatch(r.name)}`,
    cells:[
      {className:'num asset-change-prev-col',html:`<span class="change-price">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span><span class="change-eval data-table-sub">${r.prevEval==null?'-':fmt(r.prevEval)}</span>`},
      {className:'num asset-change-current-col',html:`<span class="change-price">${fmt(r.price)}</span><span class="change-eval data-table-sub">${fmt(r.evalAmount)}</span>`},
      {className:'num asset-change-delta-col',html:renderAssetDayChangeValue({
        amountText:r.dayChange==null?'-':signed(r.dayChange),
        rateText:r.dayRate==null?'-':`${r.dayRate>0?'+':''}${pct(r.dayRate)}`,
        amountClass:cls(r.dayChange),
        rateClass:cls(r.dayRate)
      })}
    ]
  }));
  const summaryRows=[{
    className:'summary-row asset-change-row',
    labelClass:'asset-change-asset-col',
    labelHtml:'합계',
    cells:[
      {className:'num asset-change-prev-col',html:hasPrev?fmt(productPrevEval):'-'},
      {className:'num asset-change-current-col',html:fmt(productEval)},
      {className:'num asset-change-delta-col',html:renderAssetDayChangeValue({
        amountText:productDayChange==null?'-':signed(productDayChange),
        rateText:productDayRate==null?'-':`${productDayRate>0?'+':''}${pct(productDayRate)}`,
        amountClass:cls(productDayChange),
        rateClass:cls(productDayRate)
      })}
    ]
  }];
  const cards=orderedPensionRows.map(r=>({
    title:r.name,
    items:[
      [prevPriceLabel,r.prevPrice==null?'-':fmt(r.prevPrice)],
      [prevDateLabel+' 평가금액',r.prevEval==null?'-':won(r.prevEval)],
      [currentPriceLabel,fmt(r.price)],
      [currentDateLabel+' 평가금액',won(r.evalAmount)],
      ['일변동',r.dayChange==null?'-':signed(r.dayChange),cls(r.dayChange)],
      ['전일대비 변동률',r.dayRate==null?'-':`${r.dayRate>0?'+':''}${pct(r.dayRate)}`,cls(r.dayRate)]
    ]
  }));
  return renderAssetDayChangeBlock({
    sectionId:'pension-change',
    idPrefix:'pension-change',
    viewStateKey:'pensionChange',
    hasPrev,
    summaryItems:[
      {label:`${prevDateLabel} 평가금액`,value:hasPrev?won(productPrevEval):'-'},
      {label:`${currentDateLabel} 평가금액`,value:won(productEval)},
      {label:'하루 변동분',value:productDayChange==null?'-':signed(productDayChange,'원'),valueClass:cls(productDayChange)},
      {label:'하루 변동률',value:productDayRate==null?'-':(productDayRate>0?'+':'')+pct(productDayRate),valueClass:cls(productDayRate)}
    ],
    caption:'퇴직연금 전일 대비 상품별 변동',
    columns:[
      {label:'상품',className:'table-cell-text asset-change-asset-col'},
      {label:prevPriceLabel,className:'asset-change-prev-col'},
      {label:currentPriceLabel,className:'asset-change-current-col'},
      {label:'일변동',className:'asset-change-delta-col'}
    ],
    rows,
    summaryRows,
    cards,
    noPrevHtml:'<div class="asset-empty-state asset-no-prev-note">전일 데이터가 없습니다.</div>'
  });
}
// [PENSION03] Section Composition · 퇴직연금 섹션 조합
function renderPension(x){
  const pensionCashCost=Number(x.pensionCashCost||0),
        pensionHeldCost=x.pensionRows.reduce((a,r)=>a+r.cost,0)+pensionCashCost,
        pensionHeldProfit=x.pensionEval-pensionHeldCost,
        pensionHeldReturn=pensionHeldCost?pensionHeldProfit/pensionHeldCost*100:0,
        orderedPensionRows=sortPensionItems(x.pensionRows);
  return `<section id="pension-section"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="briefcase" aria-hidden="true"></span>퇴직연금 현황</h2></div><div class="pension-band"><div class="asset-overview"><div class="section-title"><h3><span class="section-title-icon" data-section-title-icon="chart" aria-hidden="true"></span>성과 요약</h3></div><div class="grid metric-grid asset-summary-metric-grid">${metricCard('평가금액',won(x.pensionEval),pensionEvaluationBasisText(x.date),true,'',pensionEvaluationMobileSubText(x))}${metricCard('납입원금',won(x.pensionPrincipal),'최근 적립금 반영',false,'','최근 적립금 반영')}${metricCard('운용손익',won(x.pensionProfit),'평가금액 - 납입원금',false,cls(x.pensionProfit))}${metricCard('운용수익률',pct(x.pensionReturn),'운용손익 ÷ 납입원금',false,cls(x.pensionReturn))}</div></div><div class="grid two asset-detail-grid">${renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn)}${renderPensionChangeBlock(x,orderedPensionRows)}</div>${renderPensionCharts(x)}</div></section>`;
}


// [PENSION04] Public API
export {
  renderPension
};
