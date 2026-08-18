// 메인 대시보드 공통 상태 · 데이터 · 계산 · 공통 helper

const dataState={
  portfolio:null,
  prices:null,
  snapshots:null,
  account1Daily:null,
  pensionContributions:null,
  pensionCashSnapshots:null,
  pensionTrades:null,
  activeDate:null
};
const uiState={
  activeAssetTab:'securities',
  personalViewUnlocked:false,
  heroBasisTapCount:0,
  heroBasisLastTap:0,
  includeSeparateProfit:false,
  mobileViewModes:{
    combined:'table',
    pensionProducts:'table',
    holdings:'table',
    accounts:'table',
    pensionChange:'table'
  }
};
const fmt=n=>Math.round(Number(n)||0).toLocaleString('ko-KR'),won=n=>fmt(n)+'원',pct=n=>(Number(n)||0).toFixed(2)+'%',signed=(n,s='')=>(n>0?'+':'')+fmt(n)+s,cls=n=>n<0?'negative':(n>0?'positive':''),tableCls=n=>n<0?'table-negative':(n>0?'table-positive':''),byDate=(a,b)=>a.localeCompare(b),shortDate=d=>{const [y,m,day]=d.split('-');return `${Number(m)}/${Number(day)}`},koreanDateLabel=d=>{
  const [y,m,day]=d.split('-');
  const snap=dataState.prices?.[d]||{};
  const status=snap.marketStatus||'close';
  if(status==='intraday'){
    const time=snap.updatedAtKST?snap.updatedAtKST.slice(11,16):'';
    return `${Number(m)}월 ${Number(day)}일 장중 ${time} 기준`;
  }
  return `${Number(m)}월 ${Number(day)}일 종가 기준`;
};

const SEPARATE_PROFIT_TRADES=Object.freeze([
  {date:'2026-06-09',profit:15975},
  {date:'2026-06-16',profit:5004},
  {date:'2026-06-19',profit:50215},
  {date:'2026-06-23',profit:10446},
  {date:'2026-06-25',profit:427007},
  {date:'2026-07-30',profit:-4036636},
  {date:'2026-07-31',profit:5804782},
  {date:'2026-08-04',profit:206313},
  {date:'2026-08-05',profit:4826661},
  {date:'2026-08-06',profit:202219},
  {date:'2026-08-07',profit:163334},
  {date:'2026-08-12',profit:68059}
]);
const SEPARATE_PROFIT_REINVESTED=6700000;
const SECURITY_SYMBOL_COLORS=Object.freeze({
  'SK하이닉스':'#ff8a65',
  '삼성전자':'#8bc34a',
  '현대차':'#26c6da',
  'KODEX 200':'#4f46e5',
  'KODEX AI반도체':'#ec4899',
  '삼성전기':'#8D6E63'
});
const CASH_ASSET_COLOR='#94a3b8';
const PENSION_PRODUCT_COLORS=Object.freeze({
  'KODEX 200TR':'#42a5f5',
  'KODEX AI반도체':SECURITY_SYMBOL_COLORS['KODEX AI반도체'],
  'KODEX 삼전채권혼합':'#66bb6a'
});
const pensionSeriesColor=name=>{
  if(PENSION_PRODUCT_COLORS[name])return PENSION_PRODUCT_COLORS[name];
  const rows=dataState.portfolio?.pension||[];
  const idx=Math.max(0,rows.findIndex(r=>r.name===name));
  const palette=['#42a5f5','#8bc34a','#ffb84d','#8fd18f','#ab47bc','#26c6da'];
  return palette[idx%palette.length];
};
const ASSET_TYPE_COLORS=Object.freeze({ETF:'#ff6b6b','개별주식':'#ffc857','현금':CASH_ASSET_COLOR});
const SECURITY_DISPLAY_ORDER=Object.freeze(['KODEX 200','SK하이닉스','삼성전자','현대차']);
const sortSecurityItems=items=>[...items].sort((a,b)=>{
  const principalDiff=(Number(b?.cost)||0)-(Number(a?.cost)||0);
  return principalDiff||String(a?.name||'').localeCompare(String(b?.name||''),'ko');
});
const sortPensionItems=items=>[...items].sort((a,b)=>{
  const evalDiff=(Number(b?.evalAmount)||0)-(Number(a?.evalAmount)||0);
  return evalDiff||String(a?.name||'').localeCompare(String(b?.name||''),'ko');
});
const sortSecurityChartItems=items=>[...items].sort((a,b)=>{
  const profitDiff=(Number(b?.profit)||0)-(Number(a?.profit)||0);
  if(profitDiff) return profitDiff;
  const ai=SECURITY_DISPLAY_ORDER.indexOf(a.name),bi=SECURITY_DISPLAY_ORDER.indexOf(b.name);
  return (ai<0?SECURITY_DISPLAY_ORDER.length:ai)-(bi<0?SECURITY_DISPLAY_ORDER.length:bi);
});
const sortSecurityAllocationItems=items=>[...items].filter(h=>(Number(h?.qty)||0)>0||(Number(h?.evalAmount)||0)>0).sort((a,b)=>{
  const evalDiff=(Number(b?.evalAmount)||0)-(Number(a?.evalAmount)||0);
  return evalDiff||String(a?.name||'').localeCompare(String(b?.name||''),'ko');
});
const SECURITY_ALLOC_FALLBACK_COLORS=Object.freeze(['#7e57c2','#26a69a','#ef5350','#66bb6a','#ffa726','#5c6bc0','#29b6f6','#ab47bc']);
const securityAllocationColor=name=>{
  if(SECURITY_SYMBOL_COLORS[name])return SECURITY_SYMBOL_COLORS[name];
  const idx=Math.max(0,(dataState.portfolio?.securities||[]).findIndex(r=>r.name===name));
  return SECURITY_ALLOC_FALLBACK_COLORS[idx%SECURITY_ALLOC_FALLBACK_COLORS.length];
};
// 증권 allocation 공용 계산 helper
function securityAllocHoldingVisible(h,date){
  const oneShare=Number(h?.qty)===1;
  const explicitChart=oneShare&&h?.chart===true&&(!h?.chartFrom||String(date||'')>=String(h.chartFrom));
  return !oneShare||explicitChart;
}
function securityAllocVisibleHoldings(x){
  return (x?.holdings||[]).filter(h=>securityAllocHoldingVisible(h,x?.date));
}
function securityAllocOneShareEval(x){
  return (x?.holdings||[]).filter(h=>Number(h?.qty)===1&&!securityAllocHoldingVisible(h,x?.date)).reduce((sum,h)=>sum+Number(h?.evalAmount||0),0);
}
function securityAllocTypeTotals(x){
  const holdings=securityAllocVisibleHoldings(x);
  return {
    etf:holdings.filter(h=>h.type==='ETF').reduce((sum,h)=>sum+Number(h.evalAmount||0),0),
    stock:holdings.filter(h=>h.type==='개별주식').reduce((sum,h)=>sum+Number(h.evalAmount||0),0)
  };
}

const assetTypeColor=type=>ASSET_TYPE_COLORS[type]||CASH_ASSET_COLOR;
const PENSION_CONTRIBUTION_SAVE_CONFIG = {
  githubPages: {
    label: 'GitHub Pages',
    url: 'https://script.google.com/macros/s/AKfycbwxPSFL8VMQLOuncl5ul_leqdnbfjhJve09ZReyaJvjWj8C-5UINeGhtwBxyklRj9AE/exec',
  }
};
const formatKospi=n=>Number(n).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});
const kospiIndexForDate=date=>{
  const value=dataState.snapshots?.[date]?.kospi ?? dataState.prices?.[date]?.indices?.KOSPI;
  const number=Number(value);
  return Number.isFinite(number)&&number>0?number:null;
};
const allAvailableDates=()=>Array.from(new Set([...(Object.keys(dataState.account1Daily||{})),...(Object.keys(dataState.prices||{}).filter(d=>dataState.prices[d].display!==false))])).sort(byDate);
const monthLabel=m=>{const [y,mo]=m.split('-');return `${y}년 ${Number(mo)}월`};
const includeAccount2=d=>d>='2026-05-22';
const includeToss=d=>d>='2026-03-23';
const isLedgerCheckDate=d=>d>='2026-06-18';

const dayOptionLabel=d=>{const [y,m,day]=d.split('-');const w='일월화수목금토'[new Date(d+'T00:00:00').getDay()];return `${Number(m)}/${Number(day)} ${w}`};
const securitiesScopeText=x=>{
  const parts=['계좌1'];
  if(x.account2Included)parts.push('계좌2');
  if(x.tossIncluded)parts.push('토스');
  return parts.join(' + ');
};
const kstTodayText=()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=type=>parts.find(v=>v.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const pensionEvaluationBasisText=d=>{
  const snap=dataState.prices?.[d]||{};
  const intraday=(snap.marketStatus||'close')==='intraday';
  const estimated=intraday||d===kstTodayText();
  return `${koreanDateLabel(d)}${estimated?' 추정':''} 평가금액`;
};
// 퇴직연금 데이터 원장 · 평가 계산 helper
const rawPensionContributionItems=()=>Array.isArray(dataState.pensionContributions)?dataState.pensionContributions:(dataState.pensionContributions?.contributions||[]);
const pensionContributionItems=()=>rawPensionContributionItems()
  .filter(v=>v&&v.date)
  .map((v,i)=>({
    ...v,
    id:v.id||`legacy-contrib-${String(v.date)}-${i}`,
    date:String(v.date),
    amount:Number(v.amount)||0
  }))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id||'').localeCompare(String(b.id||'')));
const pensionContributionSum=d=>pensionContributionItems().filter(v=>v.date&&v.date<=d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const pensionContributionSumAfter=(fromDate,toDate)=>pensionContributionItems().filter(v=>v.date&&v.date>fromDate&&v.date<=toDate).reduce((a,v)=>a+(Number(v.amount)||0),0);
const latestPensionContribution=d=>pensionContributionItems()
  .filter(v=>v.date&&v.date<=d&&Number(v.amount))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  .at(-1)||null;
const rawPensionCashSnapshotItems=()=>Array.isArray(dataState.pensionCashSnapshots)?dataState.pensionCashSnapshots:(dataState.pensionCashSnapshots?.snapshots||[]);
const pensionCashSnapshotItems=()=>Array.from(
  rawPensionCashSnapshotItems()
    .filter(v=>v&&v.date)
    .reduce((map,v)=>{
      const date=String(v.date);
      map.set(date,{
        ...v,
        date,
        valuation:Number(v.valuation)||0,
        costBasis:v.costBasis==null?null:(Number.isFinite(Number(v.costBasis))?Math.max(0,Number(v.costBasis)):null),
        afterTradeIds:Array.isArray(v.afterTradeIds)?v.afterTradeIds.map(String):null,
        afterContributionIds:Array.isArray(v.afterContributionIds)?v.afterContributionIds.map(String):null
      });
      return map;
    },new Map())
    .values()
).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
const latestPensionCashSnapshot=d=>pensionCashSnapshotItems()
  .filter(v=>v.date&&v.date<=d&&Number.isFinite(Number(v.valuation)))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  .at(-1)||null;
const pensionCashValuation=(d,baseCash=0)=>{
  const snapshot=latestPensionCashSnapshot(d);
  if(snapshot){
    const flow=pensionTradeFlowAfterCashSnapshot(snapshot,d);
    const contributionFlow=pensionContributionFlowAfterCashSnapshot(snapshot,d);
    return Math.max(0,Number(snapshot.valuation||0)+contributionFlow.amount-flow.buyAmount+flow.sellAmount);
  }
  const flow=pensionTradeFlow(null,d);
  return Math.max(0,Number(baseCash||0)+pensionContributionSum(d)-flow.buyAmount+flow.sellAmount);
};
const rawPensionTradeItems=()=>Array.isArray(dataState.pensionTrades)?dataState.pensionTrades:(dataState.pensionTrades?.trades||[]);
const pensionTradeItems=()=>rawPensionTradeItems()
  .filter(v=>v&&v.date&&v.ticker&&['buy','sell'].includes(String(v.type||'').toLowerCase()))
  .map((v,i)=>({
    ...v,
    id:v.id||`legacy-pension-trade-${String(v.date)}-${String(v.ticker)}-${i}`,
    date:String(v.date),
    applyDate:String(v.applyDate||v.date),
    tradeDate:String(v.tradeDate||v.date),
    ticker:String(v.ticker),
    name:String(v.name||''),
    type:String(v.type).toLowerCase(),
    qty:Number(v.qty)||0,
    price:Number(v.price)||0,
    amount:Number(v.amount)||0,
    costBasis:v.costBasis==null?null:Number(v.costBasis),
    cashBeforeDate:v.cashBeforeDate==null?null:String(v.cashBeforeDate),
    cashBefore:v.cashBefore==null?null:Number(v.cashBefore),
    cashAfter:v.cashAfter==null?null:Number(v.cashAfter),
    appliedAtKST:String(v.appliedAtKST||v.updatedAtKST||'')
  }))
  .filter(v=>v.qty>0&&v.amount>=0)
  .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.appliedAtKST).localeCompare(String(b.appliedAtKST))||String(a.id).localeCompare(String(b.id)));
const pensionTradesBetween=(fromDate,toDate,ticker=null)=>pensionTradeItems().filter(v=>(!fromDate||v.date>fromDate)&&v.date<=toDate&&(!ticker||v.ticker===ticker));
const pensionPositionState=(pos,d)=>{
  let qty=Number(pos.qty)||0,cost=Number(pos.cost)||0,realizedProfit=0;
  pensionTradeItems().filter(v=>v.ticker===String(pos.ticker)&&v.date<=d).forEach(v=>{
    if(v.type==='buy'){
      qty+=v.qty;
      cost+=v.amount;
      return;
    }
    const avgCost=qty>0?cost/qty:0;
    const costBasis=Number.isFinite(v.costBasis)?v.costBasis:avgCost*v.qty;
    qty-=v.qty;
    cost-=costBasis;
    realizedProfit+=v.amount-costBasis;
    if(Math.abs(qty)<1e-9) qty=0;
    if(Math.abs(cost)<1e-6) cost=0;
  });
  return {qty,cost,realizedProfit};
};
const pensionTradeFlow=(fromDate,toDate,ticker=null)=>pensionTradesBetween(fromDate,toDate,ticker).reduce((a,v)=>{
  if(v.type==='buy'){a.buyAmount+=v.amount;a.buyQty+=v.qty}else{a.sellAmount+=v.amount;a.sellQty+=v.qty}
  return a;
},{buyAmount:0,sellAmount:0,buyQty:0,sellQty:0});
const pensionCashSnapshotReflectsTrade=(snapshot,trade)=>{
  if(!snapshot||!trade) return false;
  const snapshotDate=String(snapshot.date||'');
  const tradeDate=String(trade.date||'');
  if(!snapshotDate||!tradeDate||snapshotDate<tradeDate) return false;
  // A later app cash snapshot necessarily contains an already-applied earlier-date trade.
  if(snapshotDate>tradeDate) return true;
  if(Array.isArray(snapshot.afterTradeIds)) return snapshot.afterTradeIds.map(String).includes(String(trade.id));
  const snapshotAt=String(snapshot.updatedAtKST||'');
  const tradeAt=String(trade.appliedAtKST||trade.updatedAtKST||'');
  if(snapshotAt&&tradeAt) return snapshotAt>=tradeAt;
  return true;
};
const pensionCashSnapshotReflectsContribution=(snapshot,contribution)=>{
  if(!snapshot||!contribution) return false;
  const snapshotDate=String(snapshot.date||'');
  const contributionDate=String(contribution.date||'');
  if(!snapshotDate||!contributionDate||snapshotDate<contributionDate) return false;
  if(snapshotDate>contributionDate) return true;
  if(Array.isArray(snapshot.afterContributionIds)) return snapshot.afterContributionIds.map(String).includes(String(contribution.id));
  const snapshotAt=String(snapshot.updatedAtKST||'');
  const contributionAt=String(contribution.updatedAtKST||contribution.createdAtKST||'');
  if(snapshotAt&&contributionAt) return snapshotAt>=contributionAt;
  // Legacy same-day snapshots had no ordering metadata and previously treated same-day contributions as reflected.
  return true;
};
const pensionTradeFlowAfterCashSnapshot=(snapshot,toDate,ticker=null)=>pensionTradeItems().filter(v=>{
  if(v.date>toDate||v.date<snapshot.date|| (ticker&&v.ticker!==ticker)) return false;
  if(v.date>snapshot.date) return true;
  return !pensionCashSnapshotReflectsTrade(snapshot,v);
}).reduce((a,v)=>{
  if(v.type==='buy'){a.buyAmount+=v.amount;a.buyQty+=v.qty}else{a.sellAmount+=v.amount;a.sellQty+=v.qty}
  return a;
},{buyAmount:0,sellAmount:0,buyQty:0,sellQty:0});
const pensionContributionFlowAfterCashSnapshot=(snapshot,toDate)=>pensionContributionItems().filter(v=>{
  if(v.date>toDate||v.date<snapshot.date) return false;
  if(v.date>snapshot.date) return true;
  return !pensionCashSnapshotReflectsContribution(snapshot,v);
}).reduce((a,v)=>{a.amount+=Number(v.amount)||0;return a},{amount:0});
const linkedPensionCashSnapshotForTrade=trade=>pensionCashSnapshotItems()
  .filter(snapshot=>snapshot.date>=String(trade?.date||'')&&pensionCashSnapshotReflectsTrade(snapshot,trade))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  .at(0)||null;
const linkedPensionCashSnapshotForContribution=contribution=>pensionCashSnapshotItems()
  .filter(snapshot=>snapshot.date>=String(contribution?.date||'')&&pensionCashSnapshotReflectsContribution(snapshot,contribution))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  .at(0)||null;
const pensionCashLedgerEventTime=event=>String(event?.item?.appliedAtKST||event?.item?.updatedAtKST||event?.item?.createdAtKST||'');
const pensionCashLedgerEventOrder=(a,b)=>{
  const dateCmp=String(a?.item?.date||'').localeCompare(String(b?.item?.date||''));
  if(dateCmp) return dateCmp;

  if(a.kind==='snapshot'&&b.kind==='trade'&&Array.isArray(a.item.afterTradeIds)){
    return a.item.afterTradeIds.map(String).includes(String(b.item.id))?1:-1;
  }
  if(a.kind==='trade'&&b.kind==='snapshot'&&Array.isArray(b.item.afterTradeIds)){
    return b.item.afterTradeIds.map(String).includes(String(a.item.id))?-1:1;
  }
  if(a.kind==='snapshot'&&b.kind==='contribution'&&Array.isArray(a.item.afterContributionIds)){
    return a.item.afterContributionIds.map(String).includes(String(b.item.id))?1:-1;
  }
  if(a.kind==='contribution'&&b.kind==='snapshot'&&Array.isArray(b.item.afterContributionIds)){
    return b.item.afterContributionIds.map(String).includes(String(a.item.id))?-1:1;
  }

  const timeA=pensionCashLedgerEventTime(a),timeB=pensionCashLedgerEventTime(b);
  if(timeA&&timeB&&timeA!==timeB) return timeA.localeCompare(timeB);

  // Legacy same-day records had no ordering metadata. Preserve the old assumption
  // that contributions/trades were already reflected by a same-day app snapshot.
  const fallbackOrder={contribution:0,trade:1,snapshot:2};
  const kindCmp=(fallbackOrder[a.kind]??9)-(fallbackOrder[b.kind]??9);
  if(kindCmp) return kindCmp;
  return String(a?.item?.id||'').localeCompare(String(b?.item?.id||''));
};
const pensionCashCostBasis=d=>{
  const c=dataState.portfolio?.constants||{};
  let cashCost=Math.max(0,Number(c.pensionCashCost)||0);
  let cashValuation=Math.max(0,Number(pensionBaseCashForDate(d))||cashCost);

  const events=[
    ...pensionContributionItems().filter(v=>v.date<=d).map(item=>({kind:'contribution',item})),
    ...pensionTradeItems().filter(v=>v.date<=d).map(item=>({kind:'trade',item})),
    ...pensionCashSnapshotItems().filter(v=>v.date<=d).map(item=>({kind:'snapshot',item}))
  ].sort(pensionCashLedgerEventOrder);

  events.forEach(event=>{
    const item=event.item;
    if(event.kind==='snapshot'){
      cashValuation=Math.max(0,Number(item.valuation)||0);
      if(item.costBasis!=null&&Number.isFinite(Number(item.costBasis))) cashCost=Math.max(0,Number(item.costBasis));
      return;
    }
    if(event.kind==='contribution'){
      const amount=Math.max(0,Number(item.amount)||0);
      cashValuation+=amount;
      cashCost+=amount;
      return;
    }

    const amount=Math.max(0,Number(item.amount)||0);
    if(item.type==='sell'){
      cashValuation+=amount;
      cashCost+=amount;
      return;
    }

    // A cash snapshot can include interest/distributions that are valuation gains,
    // not new principal. Consume those gains first when cash is moved into an ETF;
    // only the remainder reduces the cash principal. This keeps untouched gains
    // from being converted into cash cost basis by a later partial purchase.
    const positiveGain=Math.max(0,cashValuation-cashCost);
    const principalSpent=Math.min(cashCost,Math.max(0,amount-positiveGain));
    cashCost=Math.max(0,cashCost-principalSpent);
    cashValuation=Math.max(0,cashValuation-amount);
  });

  return Math.max(0,cashCost);
};
const pensionBaseCashForDate=d=>{
  const key=Object.keys(dataState.prices||{}).filter(k=>k<=d).sort(byDate).at(-1);
  return key?Number(dataState.prices?.[key]?.pension?.cash||0):0;
};
const pensionCashBeforeNewTrade=d=>pensionCashValuation(d,pensionBaseCashForDate(d));
const hasPensionData=d=>{const pp=dataState.prices?.[d]?.pension||{};return !!(pp['278530']&&pp['395160']&&pp['448330'])};

function previousDate(date){return allAvailableDates().filter(d=>d<date).sort(byDate).at(-1)||null}function getPrice(s,section,ticker){return s?.[section]?.[ticker]??null}
const securityEventItems=()=>Array.isArray(dataState.portfolio?.securitiesEvents)?dataState.portfolio.securitiesEvents:[];
const securityChartItemsForDate=d=>(dataState.portfolio?.securities||[]).filter(item=>item.chart!==false&&(!item.chartFrom||d>=item.chartFrom));
const securityValuationOverride=(ticker,d)=>{const e=securityEventItems().find(v=>String(v?.ticker||'')===String(ticker||'')&&String(v?.date||'')===String(d||'')&&Number(v?.valuationPrice)>0);return e?Number(e.valuationPrice):null};
const securityChartNamesForDate=d=>securityChartItemsForDate(d).map(item=>item.name);
const securityEventsBetween=(fromDate,toDate,ticker=null)=>securityEventItems().filter(v=>{
  const date=String(v?.date||'');
  if(!date||date>toDate||(fromDate&&date<=fromDate)) return false;
  return ticker==null||String(v?.ticker||'')===String(ticker);
});
const securityTradeFlow=(fromDate,toDate,ticker=null)=>securityEventsBetween(fromDate,toDate,ticker).reduce((a,v)=>{
  const qty=Math.max(0,Number(v.qty)||0),amount=Math.max(0,Number(v.amount)||0);
  if(v.type==='buy'){a.buyQty+=qty;a.buyAmount+=amount;}
  if(v.type==='sell'){a.sellQty+=qty;a.sellAmount+=amount;}
  return a;
},{buyAmount:0,sellAmount:0,buyQty:0,sellQty:0});
const securityPositionState=(pos,d)=>{
  let qty=Number(pos?.qty)||0,cost=Number(pos?.cost)||0;
  securityEventItems().filter(v=>String(v?.ticker||'')===String(pos?.ticker||'')&&String(v?.date||'')>d).sort((a,b)=>String(b.date).localeCompare(String(a.date))).forEach(v=>{
    const eventQty=Math.max(0,Number(v.qty)||0),amount=Math.max(0,Number(v.amount)||0);
    if(v.type==='buy'){qty-=eventQty;cost-=amount;}
    if(v.type==='sell'){qty+=eventQty;cost+=Math.max(0,Number(v.costBasis)||0);}
  });
  return {qty:Math.max(0,qty),cost:Math.max(0,cost)};
};
const securitiesCashForDate=d=>{
  const latestPriceDate=Object.keys(dataState.prices||{}).filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&dataState.prices?.[v]?.display!==false).sort(byDate).at(-1)||'';
  const savedCash=dataState.snapshots?.[d]?.allocation?.['현금'];
  if(latestPriceDate&&d<latestPriceDate&&Number.isFinite(Number(savedCash))) return Number(savedCash);
  let cash=Number(dataState.portfolio?.constants?.securitiesCash)||0;
  securityEventItems().filter(v=>String(v?.date||'')>d).forEach(v=>{
    const amount=Math.max(0,Number(v.amount)||0);
    if(v.type==='contribution'||v.type==='sell') cash-=amount;
    if(v.type==='withdrawal'||v.type==='buy') cash+=amount;
  });
  return cash;
};
const isPerformanceExcludedSecurityFunding=v=>v?.type==='contribution'&&v?.fundingClass==='performanceExcludedTransfer';
const isInternalCashTransferSecurityFunding=v=>v?.type==='contribution'&&v?.fundingClass==='internalCashTransfer';
const securityContributionAfter=d=>securityEventItems().filter(v=>v.type==='contribution'&&String(v?.date||'')>d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityExternalPrincipalContributionAfter=d=>securityEventItems().filter(v=>v.type==='contribution'&&!isInternalCashTransferSecurityFunding(v)&&String(v?.date||'')>d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityWithdrawalAfter=d=>securityEventItems().filter(v=>v.type==='withdrawal'&&String(v?.date||'')>d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityExternalContributionSum=d=>securityEventItems().filter(v=>v.type==='contribution'&&!isPerformanceExcludedSecurityFunding(v)&&!isInternalCashTransferSecurityFunding(v)&&String(v?.date||'')<=d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityExcludedTransferSum=d=>securityEventItems().filter(v=>isPerformanceExcludedSecurityFunding(v)&&String(v?.date||'')<=d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityInternalCashTransferSum=d=>securityEventItems().filter(v=>isInternalCashTransferSecurityFunding(v)&&String(v?.date||'')<=d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const account1SourcePrincipalForDate=d=>(Number(dataState.portfolio?.constants?.account1Principal)||0)-securityContributionAfter(d)+securityWithdrawalAfter(d);
const securitiesHoldingCostForDate=d=>{
  const daily=dataState.account1Daily?.[d];
  if(Array.isArray(daily?.holdings)) return daily.holdings.reduce((a,h)=>a+(Number(h?.cost)||0),0);
  return (dataState.portfolio?.securities||[]).reduce((a,h)=>a+(Number(securityPositionState(h,d)?.cost)||0),0);
};
const account1SourceHoldingGapForDate=d=>isLedgerCheckDate(d)?securitiesHoldingCostForDate(d)-account1SourcePrincipalForDate(d):0;
const account1PrincipalForDate=d=>isLedgerCheckDate(d)?securitiesHoldingCostForDate(d):account1SourcePrincipalForDate(d);
const externalPrincipalForDate=d=>(Number(dataState.portfolio?.constants?.externalPrincipal)||0)-securityExternalPrincipalContributionAfter(d)+securityWithdrawalAfter(d);
const sourceExternalPrincipalForDate=d=>externalPrincipalForDate(d)-securityExcludedTransferSum(d);
const outsideCashForDate=d=>(Number(dataState.portfolio?.constants?.outsideCash??2035097)||0)-securityInternalCashTransferSum(d);
const separateProfitCumulativeForDate=d=>SEPARATE_PROFIT_TRADES.filter(v=>v.date<=d).reduce((a,v)=>a+v.profit,0);
const separateProfitReinvestedForDate=d=>Math.min(SEPARATE_PROFIT_REINVESTED,securityExcludedTransferSum(d),Math.max(0,separateProfitCumulativeForDate(d)));
const separateProfitView=x=>{
  const separateProfit=uiState.includeSeparateProfit?separateProfitCumulativeForDate(x.date):0;
  const reclassifiedReinvestment=uiState.includeSeparateProfit?separateProfitReinvestedForDate(x.date):0;
  const account1Principal=x.account1Principal-reclassifiedReinvestment;
  const account1Profit=x.account1Profit+separateProfit;
  const account1Result=x.account1Result+separateProfit-reclassifiedReinvestment;
  const totalPrincipal=x.totalPrincipal-reclassifiedReinvestment;
  const totalProfit=x.totalProfit+separateProfit;
  const totalResult=x.totalResult+separateProfit-reclassifiedReinvestment;
  const combinedPrincipal=x.combinedPrincipal-reclassifiedReinvestment;
  const combinedProfit=x.combinedProfit+separateProfit;
  const combinedResult=x.combinedResult+separateProfit-reclassifiedReinvestment;
  return {
    separateProfit,
    reclassifiedReinvestment,
    unreflectedSeparateProfit:separateProfit-reclassifiedReinvestment,
    account1Principal,
    account1Profit,
    account1Result,
    account1Return:account1Principal?account1Profit/account1Principal*100:0,
    totalPrincipal,
    totalProfit,
    totalResult,
    totalReturn:totalPrincipal?totalProfit/totalPrincipal*100:0,
    combinedPrincipal,
    combinedProfit,
    combinedResult,
    combinedReturn:combinedPrincipal?combinedProfit/combinedPrincipal*100:0
  };
};

function calc(date){
  const p=dataState.portfolio,c=p.constants,s=dataState.prices[date]||{},pk=previousDate(date),prev=pk?dataState.prices[pk]:null,daily=dataState.account1Daily?.[date]||null,extraPensionContrib=pensionContributionSum(date),prevExtraPensionContrib=pk?pensionContributionSum(pk):0,pensionPrincipal=(Number(c.pensionContributionPrincipal)||0)+extraPensionContrib;
  const account2Included=includeAccount2(date),tossIncluded=includeToss(date),hasPension=hasPensionData(date);
  const ledgerAccount1ActualGap=(Number(c.account2RealizedAmount)||0)-(Number(c.account2ReinvestedToAccount1)||0)+(Number(c.tossRealizedAmount)||0)-(Number(c.tossReinvestedToAccount1)||0)-(Number(c.outsideCash??2035097)||0)-(Number(c.livingSpent)||0);
  let holdings,rawHoldingProfit,account1Principal,account1Profit,account1Result,account1Return,etfEval,stockEval,allocTotal,securitiesCash;
  if(daily){
    const prevDaily=pk?dataState.account1Daily?.[pk]:null;
    holdings=daily.holdings.map(h=>{
      const prevH=prevDaily?.holdings?.find(v=>v.name===h.name),prevProfit=prevH?prevH.profit:null,dayChange=prevH==null?null:h.profit-prevH.profit;
      return {...h,feeAdjustedProfit:h.profit,returnRate:h.cost?h.profit/h.cost*100:0,prevPrice:prevH?.price??null,prevEval:prevH?.evalAmount??(prevH?.price!=null?prevH.price*h.qty:null),prevProfit,dayChange};
    });
    securitiesCash=daily.cash;
    rawHoldingProfit=daily.totalProfit;
    account1Principal=isLedgerCheckDate(date)?account1PrincipalForDate(date):daily.totalCost;
    account1Result=isLedgerCheckDate(date)?Number(daily.totalEval||0)-ledgerAccount1ActualGap:daily.totalCost+daily.totalProfit;
    account1Profit=account1Result-account1Principal;
    account1Return=account1Principal?account1Profit/account1Principal*100:0;
    etfEval=holdings.filter(h=>h.type==='ETF').reduce((a,h)=>a+h.evalAmount,0);
    stockEval=holdings.filter(h=>h.type==='개별주식').reduce((a,h)=>a+h.evalAmount,0);
    allocTotal=daily.totalEval;
  }else{
    holdings=p.securities.map(h=>{
      const state=securityPositionState(h,date),prevState=pk?securityPositionState(h,pk):null,marketPrice=securityValuationOverride(h.ticker,date)??getPrice(s,'securities',h.ticker),prevPrice=pk?(securityValuationOverride(h.ticker,pk)??getPrice(prev,'securities',h.ticker)):null,tradeFlow=pk?securityTradeFlow(pk,date,h.ticker):{buyAmount:0,sellAmount:0,buyQty:0,sellQty:0};
      const postClosePending=!!(h.chartFrom&&date<h.chartFrom&&securityEventItems().some(v=>v.type==='buy'&&String(v?.ticker||'')===String(h.ticker||'')&&String(v?.date||'')===date));
      const price=postClosePending&&state.qty?state.cost/state.qty:marketPrice,evalAmount=postClosePending?state.cost:(price||0)*state.qty,profit=postClosePending?0:evalAmount-state.cost,feeAdjustedProfit=postClosePending?0:profit-(h.feeBuffer||0),prevEval=prevPrice==null||!prevState?null:prevPrice*prevState.qty,prevProfit=prevPrice==null||!prevState?null:prevEval-prevState.cost,dayChange=postClosePending?null:(prevEval==null?null:evalAmount-prevEval-tradeFlow.buyAmount+tradeFlow.sellAmount);
      return {...h,qty:state.qty,cost:state.cost,avgPrice:state.qty?state.cost/state.qty:0,price,prevPrice,evalAmount,profit,feeAdjustedProfit,returnRate:state.cost?profit/state.cost*100:0,prevEval,dayChange,prevProfit,tradeFlow,postClosePending};
    });
    securitiesCash=securitiesCashForDate(date);
    rawHoldingProfit=holdings.reduce((a,h)=>a+h.profit,0);
    account1Principal=account1PrincipalForDate(date);
    etfEval=holdings.filter(h=>h.type==='ETF').reduce((a,h)=>a+h.evalAmount,0);
    stockEval=holdings.filter(h=>h.type==='개별주식').reduce((a,h)=>a+h.evalAmount,0);
    allocTotal=etfEval+stockEval+securitiesCash;
    account1Result=isLedgerCheckDate(date)?allocTotal-ledgerAccount1ActualGap:account1Principal+rawHoldingProfit+c.account1ProfitAdjustment;
    account1Profit=account1Result-account1Principal;
    account1Return=account1Principal?account1Profit/account1Principal*100:0;
  }
  const account2Profit=account2Included?c.account2Profit:0,account2Principal=account2Included?c.account2Principal:0,account2RealizedAmount=account2Included?c.account2RealizedAmount:0,account2Remainder=account2Included?c.account2RealizedAmount-c.account2ReinvestedToAccount1:0;
  const tossProfit=tossIncluded?c.tossProfit:0,tossRealizedAmount=tossIncluded?c.tossRealizedAmount:0,tossRemainder=tossIncluded?c.tossRealizedAmount-c.tossReinvestedToAccount1:0;
  const internalCashTransfer=isLedgerCheckDate(date)?securityInternalCashTransferSum(date):0;
  const totalProfit=account1Profit+account2Profit+tossProfit,totalResult=account1Result+account2Remainder+tossRemainder-internalCashTransfer;
  const totalPrincipal=account2Included?externalPrincipalForDate(date):account1Principal;
  const returnRate=totalPrincipal?totalProfit/totalPrincipal*100:0;
  const actualHolding=isLedgerCheckDate(date)?totalResult-c.livingSpent:null;
  const pensionRows=hasPension?p.pension.map(pos=>{
    const state=pensionPositionState(pos,date),prevState=pk?pensionPositionState(pos,pk):null;
    const price=getPrice(s,'pension',pos.ticker),prevPrice=prev?getPrice(prev,'pension',pos.ticker):null;
    const evalAmount=(price||0)*state.qty,profit=evalAmount-state.cost,totalProfit=profit+state.realizedProfit;
    const prevEval=prevPrice==null||!prevState?null:prevPrice*prevState.qty;
    const tradeFlow=pk?pensionTradeFlow(pk,date,pos.ticker):{buyAmount:0,sellAmount:0,buyQty:0,sellQty:0};
    const dayChange=prevEval==null?null:evalAmount-prevEval-tradeFlow.buyAmount+tradeFlow.sellAmount;
    return {...pos,qty:state.qty,cost:state.cost,realizedProfit:state.realizedProfit,totalProfit,price,prevPrice,evalAmount,profit,returnRate:state.cost?profit/state.cost*100:0,dayChange,prevEval,prevQty:prevState?.qty??null,prevCost:prevState?.cost??null,tradeFlow};
  }):[];
  const basePensionCash=hasPension?Number(s?.pension?.cash||0):0,basePrevPensionCash=Number(prev?.pension?.cash||0),pensionCash=hasPension?pensionCashValuation(date,basePensionCash):0,prevPensionCash=prev?pensionCashValuation(pk,basePrevPensionCash):0,pensionTradeDayFlow=pk?pensionTradeFlow(pk,date):{buyAmount:0,sellAmount:0,buyQty:0,sellQty:0},pensionExternalFlow=pk?pensionContributionSumAfter(pk,date):0,pensionCashDayChange=prev?pensionCash-prevPensionCash-pensionExternalFlow+pensionTradeDayFlow.buyAmount-pensionTradeDayFlow.sellAmount:null,pensionCashCost=hasPension?pensionCashCostBasis(date):0,pensionEval=hasPension?pensionRows.reduce((a,r)=>a+r.evalAmount,0)+pensionCash:0,pensionPrevEval=hasPension&&prev?pensionRows.reduce((a,r)=>a+(r.prevEval||0),0)+prevPensionCash:null,pensionDayChange=hasPension&&prev?pensionRows.reduce((a,r)=>a+(Number(r.dayChange)||0),0)+(Number(pensionCashDayChange)||0):null,pensionDayRate=pensionPrevEval?pensionDayChange/pensionPrevEval*100:0,pensionProfit=hasPension?pensionEval-pensionPrincipal:0,pensionReturn=hasPension&&pensionPrincipal?pensionProfit/pensionPrincipal*100:0;
  const combinedPrincipal=hasPension?totalPrincipal+pensionPrincipal:totalPrincipal,combinedResult=hasPension?totalResult+pensionEval:totalResult,combinedProfit=hasPension?totalProfit+pensionProfit:totalProfit,combinedReturn=combinedPrincipal?combinedProfit/combinedPrincipal*100:0;
  return {date,s,prevKey:pk,prev,daily,hasDaily:!!daily,account2Included,tossIncluded,hasPension,holdings,securitiesCash,rawHoldingProfit,account1Principal,account1Profit,account1Result,account1Return,account2Profit,account2Principal,account2RealizedAmount,account2Remainder,tossProfit,tossRealizedAmount,tossRemainder,totalPrincipal,totalProfit,totalResult,returnRate,actualHolding,pensionRows,pensionCash,prevPensionCash,pensionCashCost,pensionCashDayChange,pensionTradeDayFlow,pensionExternalFlow,pensionEval,pensionPrevEval,pensionDayChange,pensionDayRate,pensionProfit,pensionReturn,extraPensionContrib,prevExtraPensionContrib,basePensionCash,basePrevPensionCash,pensionPrincipal,combinedPrincipal,combinedResult,combinedProfit,combinedReturn,etfEval,stockEval,allocTotal}
}
function snapshotDates(d){
  return allAvailableDates().filter(x=>x<=d);
}
function cumHistory(d){
  return snapshotDates(d).map(x=>{
    const v=calc(x);
    const baseProfit=v.rawHoldingProfit;
    const separateProfit=uiState.includeSeparateProfit?separateProfitCumulativeForDate(x):0;
    const reclassifiedReinvestment=uiState.includeSeparateProfit?separateProfitReinvestedForDate(x):0;
    const principal=Math.max(0,v.account1Principal-reclassifiedReinvestment)||1;
    const totalProfit=baseProfit+separateProfit;
    return {
      '날짜':x,
      '합계 : 누적손익':totalProfit,
      '합계 : 누적수익률':principal?totalProfit/principal*100:0,
      '코스피 지수':kospiIndexForDate(x),
      '합계 : 전일대비손익':0,
      '_기존포트누적손익':baseProfit,
      '_별도수익누적':separateProfit,
      '_성과기준투입원금':principal
    };
  }).map((row,i,arr)=>{
    row['합계 : 전일대비손익']=i===0?row['합계 : 누적손익']:row['합계 : 누적손익']-arr[i-1]['합계 : 누적손익'];
    return row;
  });
}
function symbolHistory(d){
  const series=securityChartNamesForDate(d);
  return snapshotDates(d).map(x=>{
    const v=calc(x),activeNames=new Set(securityChartNamesForDate(x));
    const row={'날짜':x,'_rates':{}};
    series.forEach(name=>{
      if(!activeNames.has(name)){row[name]=null;row._rates[name]=null;return;}
      const h=v.holdings.find(h=>h.name===name);
      row[name]=h?Number(h.profit||0):0;
      row._rates[name]=h&&Number(h.cost)?Number(h.profit||0)/Number(h.cost)*100:0;
    });
    return row;
  });
}
function allocHistory(d){
  return snapshotDates(d).map(x=>{
    const v=calc(x),typeTotals=securityAllocTypeTotals(v);
    return {
      '날짜':x,
      ETF:typeTotals.etf,
      개별주식:typeTotals.stock,
      현금:Number(v.securitiesCash||0),
      _total:Number(v.allocTotal||0)
    };
  });
}
function securitySymbolAllocHistory(d,series){
  return snapshotDates(d).map(x=>{
    const v=calc(x),row={'날짜':x,'_total':Number(v.allocTotal||0)};
    series.forEach(name=>{
      const h=v.holdings.find(item=>item.name===name);
      row[name]=h&&securityAllocHoldingVisible(h,x)?Number(h?.evalAmount||0):0;
    });
    row['현금']=Number(v.securitiesCash||0);
    return row;
  });
}

const NETWORK_REQUEST_TIMEOUT_MS=20000;
async function fetchWithTimeout(url,options={},timeoutMs=NETWORK_REQUEST_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetch(url,{...options,signal:controller.signal});
  }catch(error){
    if(error?.name==='AbortError')throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

function dataUrlLabel(url){
  return String(url||'').split('?')[0]||'데이터';
}
async function loadJson(url){
  const response=await fetchWithTimeout(url);
  if(!response.ok){
    const error=new Error(`${dataUrlLabel(url)} 로드 실패 (HTTP ${response.status})`);
    error.status=response.status;
    error.url=url;
    throw error;
  }
  try{
    return await response.json();
  }catch(cause){
    const error=new Error(`${dataUrlLabel(url)} JSON 형식이 올바르지 않습니다.`);
    error.cause=cause;
    error.url=url;
    throw error;
  }
}
async function loadJsonOr(url,fallback,{fallbackStatuses=[404]}={}){
  try{
    return await loadJson(url);
  }catch(error){
    if(fallbackStatuses.includes(Number(error?.status)))return fallback;
    throw error;
  }
}

async function loadInitialData(){
  const [portfolio,prices,snapshots,account1Daily,pensionContributions,pensionCashSnapshots,pensionTrades]=await Promise.all([
    loadJson('data/portfolio.json?ts='+Date.now()),
    loadJson('data/prices.json?ts='+Date.now()),
    loadJson('data/performance_snapshots.json?ts='+Date.now()),
    loadJsonOr('data/account1_daily_snapshots.json?ts='+Date.now(),{}),
    loadJsonOr('data/pension_contributions.json?ts='+Date.now(),{contributions:[]}),
    loadJsonOr('data/pension_cash_snapshots.json?ts='+Date.now(),{snapshots:[]}),
    loadJsonOr('data/pension_trades.json?ts='+Date.now(),{trades:[]})
  ]);
  Object.assign(dataState,{portfolio,prices,snapshots,account1Daily,pensionContributions,pensionCashSnapshots,pensionTrades});
}

export {
  ASSET_TYPE_COLORS,
  CASH_ASSET_COLOR,
  PENSION_CONTRIBUTION_SAVE_CONFIG,
  SECURITY_SYMBOL_COLORS,
  account1PrincipalForDate,
  account1SourceHoldingGapForDate,
  account1SourcePrincipalForDate,
  allocHistory,
  allAvailableDates,
  assetTypeColor,
  calc,
  cls,
  cumHistory,
  dataState,
  dayOptionLabel,
  fetchWithTimeout,
  fmt,
  formatKospi,
  hasPensionData,
  isLedgerCheckDate,
  koreanDateLabel,
  kospiIndexForDate,
  kstTodayText,
  latestPensionContribution,
  linkedPensionCashSnapshotForContribution,
  linkedPensionCashSnapshotForTrade,
  loadInitialData,
  monthLabel,
  outsideCashForDate,
  pct,
  pensionBaseCashForDate,
  pensionCashBeforeNewTrade,
  pensionCashSnapshotItems,
  pensionCashSnapshotReflectsContribution,
  pensionCashSnapshotReflectsTrade,
  pensionContributionItems,
  pensionEvaluationBasisText,
  pensionPositionState,
  pensionSeriesColor,
  pensionTradeItems,
  rawPensionCashSnapshotItems,
  rawPensionContributionItems,
  rawPensionTradeItems,
  securityAllocOneShareEval,
  securityAllocTypeTotals,
  securityAllocVisibleHoldings,
  securityAllocationColor,
  securityChartNamesForDate,
  securityExcludedTransferSum,
  securityExternalContributionSum,
  securityInternalCashTransferSum,
  securitySymbolAllocHistory,
  securitiesScopeText,
  separateProfitCumulativeForDate,
  separateProfitReinvestedForDate,
  separateProfitView,
  shortDate,
  signed,
  snapshotDates,
  sortPensionItems,
  sortSecurityAllocationItems,
  sortSecurityChartItems,
  sortSecurityItems,
  sourceExternalPrincipalForDate,
  symbolHistory,
  tableCls,
  uiState,
  won
};
