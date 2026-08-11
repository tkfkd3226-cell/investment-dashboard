let PORTFOLIO,PRICES,SNAPSHOTS,ACCOUNT1_DAILY,PENSION_CONTRIBUTIONS,PENSION_CASH_SNAPSHOTS,PENSION_TRADES,ACTIVE_DATE;const fmt=n=>Math.round(Number(n)||0).toLocaleString('ko-KR'),won=n=>fmt(n)+'원',pct=n=>(Number(n)||0).toFixed(2)+'%',signed=(n,s='')=>(n>0?'+':'')+fmt(n)+s,cls=n=>n<0?'negative':(n>0?'positive':''),byDate=(a,b)=>a.localeCompare(b),shortDate=d=>{const [y,m,day]=d.split('-');return `${Number(m)}/${Number(day)}`},koreanDateLabel=d=>{
  const [y,m,day]=d.split('-');
  const snap=PRICES?.[d]||{};
  const status=snap.marketStatus||'close';
  if(status==='intraday'){
    const time=snap.updatedAtKST?snap.updatedAtKST.slice(11,16):'';
    return `${Number(m)}월 ${Number(day)}일 장중 ${time} 기준`;
  }
  return `${Number(m)}월 ${Number(day)}일 종가 기준`;
};
const CHART_COMPARE_MODES={securities:'return',pension:'return'};
const SYMBOL_CHART_MODES={securities:'profit',pension:'profit'};
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
  {date:'2026-08-07',profit:163334}
]);
const SEPARATE_PROFIT_REINVESTED=6700000;
let INCLUDE_SEPARATE_PROFIT=false;
let chartEntranceObserver=null;
const SECURITY_SYMBOL_COLORS=Object.freeze({
  'SK하이닉스':'#ff8a65',
  '삼성전자':'#8bc34a',
  '현대차':'#26c6da',
  'KODEX 200':'#4f46e5',
  'KODEX AI반도체':'#ec4899'
});
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
const securitySymbolSwatch=name=>SECURITY_SYMBOL_COLORS[name]&&(!ACTIVE_DATE||securityChartNamesForDate(ACTIVE_DATE).includes(name))?`<span class="holding-symbol-swatch" style="--holding-symbol-color:${SECURITY_SYMBOL_COLORS[name]}" aria-hidden="true">■</span>`:'';
const pensionProductSwatch=name=>`<span class="holding-symbol-swatch" style="--holding-symbol-color:${pensionSeriesColor(name)}" aria-hidden="true">■</span>`;
const chartSeriesSwatch=color=>`<span class="holding-symbol-swatch" style="--holding-symbol-color:${color}" aria-hidden="true">■</span>`;
const PENSION_CONTRIBUTION_SAVE_CONFIG = {
  githubPages: {
    label: 'GitHub Pages',
    url: 'https://script.google.com/macros/s/AKfycbwxPSFL8VMQLOuncl5ul_leqdnbfjhJve09ZReyaJvjWj8C-5UINeGhtwBxyklRj9AE/exec',
  }
};
let PENSION_BATCH_MODE=false;
let PENSION_BATCH_QUEUE=[];
let PENSION_BATCH_SEQUENCE=0;
let PENSION_BATCH_LAST_ADD_FINGERPRINT='';
let PENSION_BATCH_LAST_ADD_AT=0;
let PENSION_BATCH_APPLYING=false;
let PENSION_BATCH_REQUEST_ID='';
const formatKospi=n=>Number(n).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});
const kospiIndexForDate=date=>{
  const value=SNAPSHOTS?.[date]?.kospi ?? PRICES?.[date]?.indices?.KOSPI;
  const number=Number(value);
  return Number.isFinite(number)&&number>0?number:null;
};
const allAvailableDates=()=>Array.from(new Set([...(Object.keys(ACCOUNT1_DAILY||{})),...(Object.keys(PRICES||{}).filter(d=>PRICES[d].display!==false))])).sort(byDate);
const monthLabel=m=>{const [y,mo]=m.split('-');return `${y}년 ${Number(mo)}월`};
const includeAccount2=d=>d>='2026-05-22';
const includeToss=d=>d>='2026-03-23';
const isLedgerCheckDate=d=>d>='2026-06-18';
const rawPensionContributionItems=()=>Array.isArray(PENSION_CONTRIBUTIONS)?PENSION_CONTRIBUTIONS:(PENSION_CONTRIBUTIONS?.contributions||[]);
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
const rawPensionCashSnapshotItems=()=>Array.isArray(PENSION_CASH_SNAPSHOTS)?PENSION_CASH_SNAPSHOTS:(PENSION_CASH_SNAPSHOTS?.snapshots||[]);
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
const exactPensionCashSnapshot=d=>pensionCashSnapshotItems().find(v=>v.date===d)||null;
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
const rawPensionTradeItems=()=>Array.isArray(PENSION_TRADES)?PENSION_TRADES:(PENSION_TRADES?.trades||[]);
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
const latestPensionTradeDate=d=>pensionTradeItems().filter(v=>v.date<=d).map(v=>v.date).sort(byDate).at(-1)||null;
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
  const c=PORTFOLIO?.constants||{};
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
const kstTodayText=()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=type=>parts.find(v=>v.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const fmtDecimal=(n,digits=3)=>Number(n||0).toLocaleString('ko-KR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const pensionTradeProductOptions=()=>((PORTFOLIO?.pension)||[]).map(v=>`<option value="${escapeHtml(String(v.ticker))}">${escapeHtml(v.name)}</option>`).join('');
const pensionBaseCashForDate=d=>{
  const key=Object.keys(PRICES||{}).filter(k=>k<=d).sort(byDate).at(-1);
  return key?Number(PRICES?.[key]?.pension?.cash||0):0;
};
const pensionCashBeforeNewTrade=d=>pensionCashValuation(d,pensionBaseCashForDate(d));
const hasPensionData=d=>{const pp=PRICES?.[d]?.pension||{};return !!(pp['278530']&&pp['395160']&&pp['448330'])};
const dayOptionLabel=d=>{const [y,m,day]=d.split('-');const w='일월화수목금토'[new Date(d+'T00:00:00').getDay()];return `${Number(m)}/${Number(day)} ${w}`};
const securitiesScopeText=x=>{
  const parts=['계좌1'];
  if(x.account2Included)parts.push('계좌2');
  if(x.tossIncluded)parts.push('토스');
  return parts.join(' + ');
};
const basisText=d=>{
  const snap=PRICES?.[d]||{};
  const status=snap.marketStatus||'close';
  if(status==='intraday'){
    const time=snap.updatedAtKST?snap.updatedAtKST.slice(11,16):'';
    return `장중 ${time} 기준`;
  }
  return '종가 기준';
}
function previousDate(date){return allAvailableDates().filter(d=>d<date).sort(byDate).at(-1)||null}function getPrice(s,section,ticker){return s?.[section]?.[ticker]??null}
const securityEventItems=()=>Array.isArray(PORTFOLIO?.securitiesEvents)?PORTFOLIO.securitiesEvents:[];
const securityChartItemsForDate=d=>(PORTFOLIO?.securities||[]).filter(item=>item.chart!==false&&(!item.chartFrom||d>=item.chartFrom));
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
  let cash=Number(PORTFOLIO?.constants?.securitiesCash)||0;
  securityEventItems().filter(v=>String(v?.date||'')>d).forEach(v=>{
    const amount=Math.max(0,Number(v.amount)||0);
    if(v.type==='contribution'||v.type==='sell') cash-=amount;
    if(v.type==='withdrawal'||v.type==='buy') cash+=amount;
  });
  return cash;
};
const isPerformanceExcludedSecurityFunding=v=>v?.type==='contribution'&&v?.fundingClass==='performanceExcludedTransfer';
const securityContributionAfter=d=>securityEventItems().filter(v=>v.type==='contribution'&&String(v?.date||'')>d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityWithdrawalAfter=d=>securityEventItems().filter(v=>v.type==='withdrawal'&&String(v?.date||'')>d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityExternalContributionSum=d=>securityEventItems().filter(v=>v.type==='contribution'&&!isPerformanceExcludedSecurityFunding(v)&&String(v?.date||'')<=d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const securityExcludedTransferSum=d=>securityEventItems().filter(v=>isPerformanceExcludedSecurityFunding(v)&&String(v?.date||'')<=d).reduce((a,v)=>a+(Number(v.amount)||0),0);
const account1PrincipalForDate=d=>(Number(PORTFOLIO?.constants?.account1Principal)||0)-securityContributionAfter(d)+securityWithdrawalAfter(d);
const externalPrincipalForDate=d=>(Number(PORTFOLIO?.constants?.externalPrincipal)||0)-securityContributionAfter(d)+securityWithdrawalAfter(d);
const sourceExternalPrincipalForDate=d=>externalPrincipalForDate(d)-securityExcludedTransferSum(d);
const separateProfitCumulativeForDate=d=>SEPARATE_PROFIT_TRADES.filter(v=>v.date<=d).reduce((a,v)=>a+v.profit,0);
const separateProfitReinvestedForDate=d=>Math.min(SEPARATE_PROFIT_REINVESTED,securityExcludedTransferSum(d),Math.max(0,separateProfitCumulativeForDate(d)));
const separateProfitView=x=>{
  const separateProfit=INCLUDE_SEPARATE_PROFIT?separateProfitCumulativeForDate(x.date):0;
  const reclassifiedReinvestment=INCLUDE_SEPARATE_PROFIT?separateProfitReinvestedForDate(x.date):0;
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
const separateProfitToggle=()=>`<button type="button" class="separate-profit-toggle ${INCLUDE_SEPARATE_PROFIT?'active':''}" aria-pressed="${INCLUDE_SEPARATE_PROFIT}" onclick="toggleSeparateProfitMode()"><span>별도수익</span><strong>${INCLUDE_SEPARATE_PROFIT?'ON':'OFF'}</strong></button>`;
const separateProfitControl=(x,extraClass='')=>{
  const profit=separateProfitCumulativeForDate(x.date);
  const note=INCLUDE_SEPARATE_PROFIT?`<span class="separate-profit-control-note">선택일 ${signed(profit,'원')}</span>`:'';
  return `<div class="separate-profit-control-row${extraClass?' '+extraClass:''}">${note}${separateProfitToggle()}</div>`;
};
function toggleSeparateProfitMode(){
  const scrollY=window.scrollY;
  INCLUDE_SEPARATE_PROFIT=!INCLUDE_SEPARATE_PROFIT;
  render();
  requestAnimationFrame(()=>window.scrollTo({top:scrollY,left:0,behavior:'auto'}));
}
function calc(date){
  const p=PORTFOLIO,c=p.constants,s=PRICES[date]||{},pk=previousDate(date),prev=pk?PRICES[pk]:null,daily=ACCOUNT1_DAILY?.[date]||null,extraPensionContrib=pensionContributionSum(date),prevExtraPensionContrib=pk?pensionContributionSum(pk):0,pensionPrincipal=(Number(c.pensionContributionPrincipal)||0)+extraPensionContrib;
  const account2Included=includeAccount2(date),tossIncluded=includeToss(date),hasPension=hasPensionData(date);
  let holdings,rawHoldingProfit,account1Principal,account1Profit,account1Result,account1Return,etfEval,stockEval,allocTotal,securitiesCash;
  if(daily){
    const prevDaily=pk?ACCOUNT1_DAILY?.[pk]:null;
    holdings=daily.holdings.map(h=>{
      const prevH=prevDaily?.holdings?.find(v=>v.name===h.name),prevProfit=prevH?prevH.profit:null,dayChange=prevH==null?null:h.profit-prevH.profit;
      return {...h,feeAdjustedProfit:h.profit,returnRate:h.cost?h.profit/h.cost*100:0,prevPrice:prevH?.price??null,prevEval:prevH?.evalAmount??(prevH?.price!=null?prevH.price*h.qty:null),prevProfit,dayChange};
    });
    securitiesCash=daily.cash;
    rawHoldingProfit=daily.totalProfit;
    account1Principal=isLedgerCheckDate(date)?account1PrincipalForDate(date):daily.totalCost;
    account1Profit=isLedgerCheckDate(date)?daily.totalProfit+c.account1ProfitAdjustment:daily.totalProfit;
    account1Result=account1Principal+account1Profit;
    account1Return=account1Principal?account1Profit/account1Principal*100:0;
    etfEval=holdings.filter(h=>h.type==='ETF').reduce((a,h)=>a+h.evalAmount,0);
    stockEval=holdings.filter(h=>h.type==='개별주식').reduce((a,h)=>a+h.evalAmount,0);
    allocTotal=daily.totalEval;
  }else{
    holdings=p.securities.map(h=>{
      const state=securityPositionState(h,date),prevState=pk?securityPositionState(h,pk):null,price=getPrice(s,'securities',h.ticker),prevPrice=prev?getPrice(prev,'securities',h.ticker):null,evalAmount=(price||0)*state.qty,profit=evalAmount-state.cost,feeAdjustedProfit=profit-(h.feeBuffer||0),prevEval=prevPrice==null||!prevState?null:prevPrice*prevState.qty,prevProfit=prevPrice==null||!prevState?null:prevEval-prevState.cost,tradeFlow=pk?securityTradeFlow(pk,date,h.ticker):{buyAmount:0,sellAmount:0,buyQty:0,sellQty:0},dayChange=prevEval==null?null:evalAmount-prevEval-tradeFlow.buyAmount+tradeFlow.sellAmount;
      return {...h,qty:state.qty,cost:state.cost,avgPrice:state.qty?state.cost/state.qty:0,price,prevPrice,evalAmount,profit,feeAdjustedProfit,returnRate:state.cost?profit/state.cost*100:0,prevEval,dayChange,prevProfit,tradeFlow};
    });
    securitiesCash=securitiesCashForDate(date);
    rawHoldingProfit=holdings.reduce((a,h)=>a+h.profit,0);
    account1Principal=account1PrincipalForDate(date);
    account1Profit=rawHoldingProfit+c.account1ProfitAdjustment;
    account1Result=account1Principal+account1Profit;
    account1Return=account1Principal?account1Profit/account1Principal*100:0;
    etfEval=holdings.filter(h=>h.type==='ETF').reduce((a,h)=>a+h.evalAmount,0);
    stockEval=holdings.filter(h=>h.type==='개별주식').reduce((a,h)=>a+h.evalAmount,0);
    allocTotal=etfEval+stockEval+securitiesCash;
  }
  const account2Profit=account2Included?c.account2Profit:0,account2Principal=account2Included?c.account2Principal:0,account2RealizedAmount=account2Included?c.account2RealizedAmount:0,account2Remainder=account2Included?c.account2RealizedAmount-c.account2ReinvestedToAccount1:0;
  const tossProfit=tossIncluded?c.tossProfit:0,tossRealizedAmount=tossIncluded?c.tossRealizedAmount:0,tossRemainder=tossIncluded?c.tossRealizedAmount-c.tossReinvestedToAccount1:0;
  const totalProfit=account1Profit+account2Profit+tossProfit,totalResult=account1Result+account2Remainder+tossRemainder;
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
    const separateProfit=INCLUDE_SEPARATE_PROFIT?separateProfitCumulativeForDate(x):0;
    const reclassifiedReinvestment=INCLUDE_SEPARATE_PROFIT?separateProfitReinvestedForDate(x):0;
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
    const v=calc(x);
    return {
      '날짜':x,
      ETF:Number(v.etfEval||0),
      개별주식:Number(v.stockEval||0),
      현금:Number(v.securitiesCash||0)
    };
  });
}
function navIconSvg(name){
  const attrs='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const icons={
    link:`<svg ${attrs}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"></path></svg>`,
    activity:`<svg ${attrs}><path d="M22 12h-4l-3 8-6-16-3 8H2"></path></svg>`,
    refresh:`<svg ${attrs}><path d="M21 12a9 9 0 0 1-15.5 6.2"></path><path d="M3 12A9 9 0 0 1 18.5 5.8"></path><path d="M18 2v4h4"></path><path d="M6 22v-4H2"></path></svg>`,
    wallet:`<svg ${attrs}><path d="M20 7H5a3 3 0 0 0 0 6h15v6H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h15v3Z"></path><path d="M16 13h.01"></path></svg>`,
    calculator:`<svg ${attrs}><rect x="5" y="2" width="14" height="20" rx="2"></rect><path d="M8 6h8"></path><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>`,
    home:`<svg ${attrs}><path d="m3 10 9-7 9 7"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path></svg>`,
    briefcase:`<svg ${attrs}><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path></svg>`,
    package:`<svg ${attrs}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"></path><path d="M12 12 4.5 7.8"></path><path d="M12 12l7.5-4.2"></path><path d="M12 12v9"></path></svg>`,
    trending:`<svg ${attrs}><path d="m3 17 6-6 4 4 8-8"></path><path d="M14 7h7v7"></path></svg>`,
    chart:`<svg ${attrs}><path d="M3 3v18h18"></path><path d="M7 15v2"></path><path d="M12 11v6"></path><path d="M17 7v10"></path></svg>`,
    pie:`<svg ${attrs}><path d="M21 12a9 9 0 1 1-9-9v9h9Z"></path><path d="M12 3a9 9 0 0 1 9 9"></path></svg>`,
    bank:`<svg ${attrs}><path d="m3 9 9-6 9 6"></path><path d="M4 10h16"></path><path d="M6 10v8"></path><path d="M10 10v8"></path><path d="M14 10v8"></path><path d="M18 10v8"></path><path d="M3 18h18"></path><path d="M2 21h20"></path></svg>`,
    list:`<svg ${attrs}><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>`,
    folder:`<svg ${attrs}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>`,
    search:`<svg ${attrs}><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>`,
    receipt:`<svg ${attrs}><path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path></svg>`
  };
  return icons[name]||icons.list;
}
function renderUnifiedMobileMenuContent(){
  const groups=[
    {
      label:'링크',
      items:[
        {type:'link',url:'https://esignal.co.kr/kospi200-futures-night/',icon:'activity',title:'코스피200 야간선물'},
        {type:'link',url:'https://esignal.co.kr/nasdaq100-futures/',icon:'link',title:'나스닥100 선물'}
      ]
    },
    {
      label:'관리',
      items:[
        {type:'action',action:'triggerKrxPriceUpdate();closeDateActionMenu();',icon:'refresh',title:'KRX 현재가 반영'},
        {type:'action',action:'openPensionContributionModal();closeDateActionMenu();',icon:'wallet',title:'퇴직연금 금액 조정'},
        {type:'link',url:'calc.html',icon:'calculator',title:'투자 계산기'}
      ]
    },
    {
      label:'전체',
      items:[
        {type:'section',id:'summary-section',icon:'home',title:'연금+계좌 성과'}
      ]
    },
    {
      label:'퇴직연금',
      items:[
        {type:'section',id:'pension-section',icon:'briefcase',title:'퇴직연금 현황'},
        {type:'section',id:'pension-products',icon:'package',title:'연금상품별 현황'},
        {type:'section',id:'pension-change',icon:'trending',title:'전일 대비 변동'},
        {type:'section',id:'pension-chart-cum',icon:'chart',title:'운용수익 및 누적수익률'},
        {type:'section',id:'pension-chart-symbol',icon:'chart',title:'연금상품별 운용수익'},
        {type:'section',id:'pension-chart-alloc',icon:'pie',title:'평가액 비중'}
      ]
    },
    {
      label:'증권계좌',
      items:[
        {type:'section',id:'securities-section',icon:'bank',title:'증권계좌 현황'},
        {type:'section',id:'securities-holdings',icon:'folder',title:'증권계좌 보유분'},
        {type:'section',id:'accounts-summary',icon:'list',title:'계좌별 성과 요약'},
        {type:'section',id:'chart-cum',icon:'chart',title:'누적손익 및 누적수익률'},
        {type:'section',id:'chart-symbol',icon:'chart',title:'종목별 누적손익'},
        {type:'section',id:'chart-alloc',icon:'pie',title:'평가액 비중'},
        {type:'section',id:'ledger-check',icon:'search',title:'장부결과 VS 실제보유'},
        ...(isLedgerCheckDate(ACTIVE_DATE)?[{type:'section',id:'capital-source-check',icon:'receipt',title:'투자원금 원천 및 검산'}]:[])
      ]
    }
  ];
  return groups.map(group=>`<div class="mobile-nav-group"><p>${group.label}</p>${group.items.map((item,idx)=>{
    const inner=`<span class="nav-icon">${navIconSvg(item.icon)}</span><span><strong>${item.title}</strong></span>`;
    const cls=`mobile-nav-item ${idx?'sub':''}`;
    if(item.type==='link') return `<a class="${cls}" href="${item.url}" target="_blank" rel="noopener noreferrer" onclick="closeDateActionMenu()">${inner}</a>`;
    if(item.type==='action') return `<button type="button" class="${cls}" onclick="${item.action}">${inner}</button>`;
    return `<button type="button" class="${cls}" onclick="jumpToSection('${item.id}');closeDateActionMenu()">${inner}</button>`;
  }).join('')}</div>`).join('');
}
function renderDesktopTocContent(){
  const groups=[
    {
      label:'전체',
      items:[
        {id:'summary-section',icon:'home',title:'연금+계좌 성과'}
      ]
    },
    {
      label:'퇴직연금',
      items:[
        {id:'pension-section',icon:'briefcase',title:'퇴직연금 현황'},
        {id:'pension-products',icon:'package',title:'연금상품별 현황'},
        {id:'pension-change',icon:'trending',title:'전일 대비 변동'},
        {id:'pension-chart-cum',icon:'chart',title:'운용수익 및 누적수익률'},
        {id:'pension-chart-symbol',icon:'chart',title:'연금상품별 운용수익'},
        {id:'pension-chart-alloc',icon:'pie',title:'평가액 비중'}
      ]
    },
    {
      label:'증권계좌',
      items:[
        {id:'securities-section',icon:'bank',title:'증권계좌 현황'},
        {id:'securities-holdings',icon:'folder',title:'증권계좌 보유분'},
        {id:'accounts-summary',icon:'list',title:'계좌별 성과 요약'},
        {id:'chart-cum',icon:'chart',title:'누적손익 및 누적수익률'},
        {id:'chart-symbol',icon:'chart',title:'종목별 누적손익'},
        {id:'chart-alloc',icon:'pie',title:'평가액 비중'},
        {id:'ledger-check',icon:'search',title:'장부결과 VS 실제보유'},
        ...(isLedgerCheckDate(ACTIVE_DATE)?[{id:'capital-source-check',icon:'receipt',title:'투자원금 원천 및 검산'}]:[])
      ]
    }
  ];
  return groups.map(group=>`<div class="desktop-edge-toc-group"><p>${group.label}</p>${group.items.map(item=>`<button type="button" class="desktop-edge-toc-item" data-toc-target="${item.id}" onclick="jumpToSection('${item.id}')"><span class="desktop-edge-toc-icon">${navIconSvg(item.icon)}</span><span>${item.title}</span></button>`).join('')}</div>`).join('');
}
function ensureDesktopEdgeToc(){
  let toc=document.getElementById('desktopEdgeToc');
  if(!toc){
    toc=document.createElement('aside');
    toc.id='desktopEdgeToc';
    toc.className='desktop-edge-toc';
    toc.setAttribute('aria-label','화면 목차');
    document.body.appendChild(toc);
  }
  toc.innerHTML=`<button type="button" class="desktop-edge-toc-trigger" aria-label="목차 열기"><span>목차</span></button><nav class="desktop-edge-toc-panel" aria-label="페이지 내 목차"><div class="desktop-edge-toc-title">목차</div>${renderDesktopTocContent()}</nav>`;
}
function renderTabs(){
  const dates=allAvailableDates(),months=[...new Set(dates.map(d=>d.slice(0,7)))],activeMonth=ACTIVE_DATE.slice(0,7),monthDates=dates.filter(d=>d.startsWith(activeMonth));
  document.getElementById('tabs').innerHTML=`
    <div class="date-picker">
      <div class="date-picker-center">
        <span class="date-picker-label">기준일</span>
        <select class="date-select month-select" id="monthSelect" aria-label="월 선택">${months.map(m=>`<option value="${m}" ${m===activeMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}</select>
        <select class="date-select day-select" id="dateSelect" aria-label="일 선택">${monthDates.map(d=>`<option value="${d}" ${d===ACTIVE_DATE?'selected':''}>${dayOptionLabel(d)}</option>`).join('')}</select>
      </div>
      <div class="date-picker-action">
        <a class="date-tool-btn market-link-btn market-link-btn-desktop date-tool-btn-desktop topbar-market-action" href="https://esignal.co.kr/kospi200-futures-night/" target="_blank" rel="noopener noreferrer" title="코스피200 야간선물">
          <span class="date-tool-action-icon">🌙</span><span class="topbar-label-full">코스피200 야간선물</span><span class="topbar-label-short">코스피 야선</span>
        </a>
        <a class="date-tool-btn market-link-btn market-link-btn-desktop date-tool-btn-desktop topbar-market-action" href="https://esignal.co.kr/nasdaq100-futures/" target="_blank" rel="noopener noreferrer" title="나스닥100 선물">
          <span class="date-tool-action-icon">🚀</span><span class="topbar-label-full">나스닥100 선물</span><span class="topbar-label-short">나스닥 선물</span>
        </a>
        <button type="button" class="date-tool-btn date-tool-btn-desktop topbar-krx-action" title="KRX 현재가 반영" aria-label="KRX 현재가 반영" onclick="triggerKrxPriceUpdate()">
          <span class="date-tool-action-icon">📈</span><span class="topbar-label-full">KRX 현재가 반영</span><span class="topbar-label-short">KRX 반영</span>
        </button>
        <button type="button" class="date-tool-btn date-tool-btn-desktop topbar-pension-action" title="퇴직연금 금액 조정" aria-label="퇴직연금 금액 조정" onclick="openPensionContributionModal()">
          <span class="date-tool-action-icon">💰</span><span class="topbar-label-full">퇴직연금 금액 조정</span><span class="topbar-label-short">연금 조정</span>
        </button>
        <a class="date-tool-btn date-tool-btn-desktop topbar-calc-action" href="calc.html" target="_blank" rel="noopener noreferrer" title="투자 계산기" aria-label="투자 계산기" style="text-decoration:none">
          <span class="date-tool-action-icon">🧮</span><span class="topbar-label-full">투자 계산기</span><span class="topbar-label-short">계산기</span>
        </a>
        <div class="compact-action-menu-wrap">
          <button type="button" id="compactActionMenuButton" class="date-tool-btn compact-more-btn" title="더보기" aria-label="추가 기능 열기" aria-haspopup="true" aria-expanded="false" onclick="toggleCompactActionMenu(event)">
            <span class="compact-more-icon" aria-hidden="true">•••</span><span>더보기</span>
          </button>
          <div id="compactActionMenu" class="compact-action-menu" aria-label="추가 기능">
            <div class="compact-action-menu-title">시장지표</div>
            <a href="https://esignal.co.kr/kospi200-futures-night/" target="_blank" rel="noopener noreferrer"><span>🌙</span><strong>코스피200 야간선물</strong></a>
            <a href="https://esignal.co.kr/nasdaq100-futures/" target="_blank" rel="noopener noreferrer"><span>🚀</span><strong>나스닥100 선물</strong></a>
            <button type="button" class="compact-menu-pension" onclick="openPensionContributionModal();closeCompactActionMenu()"><span>💰</span><strong>퇴직연금 금액 조정</strong></button>
          </div>
        </div>
        <div class="date-action-menu-wrap">
          <button type="button" class="date-tool-btn date-tool-menu-btn" title="목차" aria-label="목차" onclick="toggleDateActionMenu(event)"><span class="date-tool-icon">☰</span><span class="date-tool-menu-label">목차</span></button>
          <div id="dateActionMenu" class="date-action-menu mobile-combined-menu" aria-label="화면 목차"><div class="mobile-nav-head"><span>목차</span><button type="button" onclick="closeDateActionMenu()" aria-label="목차 닫기">×</button></div>${renderUnifiedMobileMenuContent()}</div>
        </div>
      </div>
    </div>`;
}
function metricCard(label,value,sub,dark=false,vcls=''){return `<div class="card ${dark?'dark':''}"><div class="label">${label}</div><div class="value ${vcls}">${value}</div><div class="sub">${sub}</div></div>`}

const MOBILE_VIEW_MODES={
  combined:'table',
  pensionProducts:'table',
  holdings:'table',
  accounts:'table',
  pensionChange:'table'
};
function mobileViewAttrs(key){
  const mode=MOBILE_VIEW_MODES[key]||'card';
  return `data-mobile-view-key="${key}" data-mobile-view="${mode}"`;
}
function mobileViewToggle(key){
  const mode=MOBILE_VIEW_MODES[key]||'card';
  const label=mode==='card'?'표 보기':'카드 보기';
  return `<button type="button" class="mobile-view-toggle" data-mobile-view-button="${key}" onclick="toggleMobileDataView('${key}')">${label}</button>`;
}
function toggleMobileDataView(key){
  const current=MOBILE_VIEW_MODES[key]||'card';
  const next=current==='card'?'table':'card';
  MOBILE_VIEW_MODES[key]=next;
  document.querySelectorAll(`[data-mobile-view-key="${key}"]`).forEach(el=>el.dataset.mobileView=next);
  document.querySelectorAll(`[data-mobile-view-button="${key}"]`).forEach(btn=>btn.textContent=next==='card'?'표 보기':'카드 보기');
}
function mobileInfoCard(title,items=[],extraClass=''){
  return `<article class="mobile-data-card ${extraClass}"><div class="mobile-data-card-title">${title}</div><div class="mobile-data-card-list">${items.map(item=>{const [label,value,valueClass='',rowClass='']=item;return `<div class="mobile-data-card-row ${rowClass}"><span class="mobile-data-card-label">${label}</span><span class="mobile-data-card-value ${valueClass}">${value}</span></div>`}).join('')}</div></article>`;
}
function jumpToChartDate(date,chartId){
  if(!allAvailableDates().includes(date)) return;
  ACTIVE_DATE=date;
  history.replaceState(null,'','#'+ACTIVE_DATE);
  render();
  requestAnimationFrame(()=>{
    document.getElementById(chartId)?.scrollIntoView({behavior:'smooth',block:'start'});
  });
}
function chartScrollButton(){
  return `<div class="chart-scroll-row"><button type="button" class="chart-scroll-start" aria-label="차트를 왼쪽 끝으로 이동" title="왼쪽 끝으로 이동" onclick="scrollChartToStart(this)">←</button><button type="button" class="chart-scroll-end" aria-label="차트를 오른쪽 끝으로 이동" title="오른쪽 끝으로 이동" onclick="scrollChartToEnd(this)">→</button><button type="button" class="chart-expand-button" aria-label="차트를 가로 전체화면으로 확대" title="가로 전체화면" onclick="openExpandedChart(this)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"></path><path d="M9 9 3 3M15 9l6-6M15 15l6 6M9 15l-6 6"></path></svg></button></div>`;
}
function chartScrollToWrap(button){
  return button?.closest('.chart-card')?.querySelector('.chart-wrap')||null;
}
function scrollChartToStart(button){
  const wrap=chartScrollToWrap(button);
  if(!wrap)return;
  wrap.scrollTo({left:0,behavior:'smooth'});
}
function scrollChartToEnd(button){
  const wrap=chartScrollToWrap(button);
  if(!wrap)return;
  wrap.scrollTo({left:Math.max(0,wrap.scrollWidth-wrap.clientWidth),behavior:'smooth'});
}
let EXPANDED_CHART_STATE=null;
function expandedChartLandscapeViewport(){
  return window.matchMedia?.('(orientation: landscape)').matches===true;
}
function syncExpandedChartViewport(){
  const overlay=document.querySelector('.chart-expanded-overlay');
  if(!overlay)return;
  overlay.style.setProperty('--chart-expanded-vw',`${window.innerWidth}px`);
  overlay.style.setProperty('--chart-expanded-vh',`${window.innerHeight}px`);
  overlay.classList.toggle('device-landscape',expandedChartLandscapeViewport());
}
function openExpandedChart(button){
  const card=button?.closest('.chart-card');
  const wrap=card?.querySelector('.chart-wrap');
  const svg=wrap?.querySelector('svg.chart');
  if(!card||!wrap||!svg)return;
  closeExpandedChart();
  const originalScrollLeft=wrap.scrollLeft;
  const placeholder=document.createComment('expanded-chart-placeholder');
  svg.parentNode.insertBefore(placeholder,svg);
  const title=card.querySelector('.chart-head h3')?.textContent?.trim()||'차트';
  const controls=card.querySelector('.chart-head-actions');
  const controlsPlaceholder=controls?document.createComment('expanded-chart-controls-placeholder'):null;
  if(controls)controls.parentNode.insertBefore(controlsPlaceholder,controls);
  const legend=card.querySelector('.chart-legend');
  const legendPlaceholder=legend?document.createComment('expanded-chart-legend-placeholder'):null;
  if(legend)legend.parentNode.insertBefore(legendPlaceholder,legend);
  const overlay=document.createElement('div');
  overlay.className='chart-expanded-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label',`${title} 확대 보기`);
  overlay.innerHTML=`<button type="button" class="chart-expanded-close" aria-label="확대 차트 닫기" title="닫기">×</button><div class="chart-expanded-stage"><div class="chart-expanded-head"><div class="chart-expanded-title"></div><div class="chart-expanded-controls-host"></div></div><div class="chart-expanded-chart-host"></div><div class="chart-expanded-legend-host"></div></div>`;
  overlay.querySelector('.chart-expanded-title').textContent=title;
  if(controls)overlay.querySelector('.chart-expanded-controls-host').appendChild(controls);
  overlay.querySelector('.chart-expanded-chart-host').appendChild(svg);
  if(legend)overlay.querySelector('.chart-expanded-legend-host').appendChild(legend);
  document.body.appendChild(overlay);
  document.body.classList.add('chart-expanded-open');
  EXPANDED_CHART_STATE={overlay,svg,placeholder,wrap,scrollLeft:originalScrollLeft,controls,controlsPlaceholder,legend,legendPlaceholder};
  syncExpandedChartViewport();
  overlay.querySelector('.chart-expanded-close')?.addEventListener('click',closeExpandedChart,{once:true});
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeExpandedChart()});
  requestAnimationFrame(()=>overlay.classList.add('show'));
  overlay.querySelector('.chart-expanded-close')?.focus({preventScroll:true});
}
function closeExpandedChart(){
  const state=EXPANDED_CHART_STATE;
  if(!state)return;
  EXPANDED_CHART_STATE=null;
  const {overlay,svg,placeholder,wrap,scrollLeft,controls,controlsPlaceholder,legend,legendPlaceholder}=state;
  if(placeholder?.parentNode)placeholder.parentNode.insertBefore(svg,placeholder);
  placeholder?.remove();
  if(controls&&controlsPlaceholder?.parentNode)controlsPlaceholder.parentNode.insertBefore(controls,controlsPlaceholder);
  controlsPlaceholder?.remove();
  if(legend&&legendPlaceholder?.parentNode)legendPlaceholder.parentNode.insertBefore(legend,legendPlaceholder);
  legendPlaceholder?.remove();
  overlay?.remove();
  document.body.classList.remove('chart-expanded-open');
  if(wrap){
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        wrap.scrollLeft=scrollLeft||0;
        if(typeof prepareChartEntranceForSvg==='function')prepareChartEntranceForSvg(svg);
        if(typeof activateChartEntrance==='function')activateChartEntrance(wrap);
      });
    });
  }
}
function setupExpandedChartViewport(){
  if(window.__expandedChartViewportBound)return;
  window.__expandedChartViewportBound=true;
  let frame=0;
  const sync=()=>{
    if(!EXPANDED_CHART_STATE)return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(syncExpandedChartViewport);
  };
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&EXPANDED_CHART_STATE)closeExpandedChart()});
}
function syncResponsiveChartControls(){
  const mobile=window.matchMedia('(max-width:760px)').matches;
  ['pension-chart-cum','chart-cum','pension-chart-symbol','chart-symbol'].forEach(id=>{
    const card=document.getElementById(id);
    const head=card?.querySelector('.chart-head');
    const actions=card?.querySelector('.chart-head-actions');
    const row=card?.querySelector('.chart-scroll-row');
    if(!head||!actions||!row)return;
    if(mobile){
      if(actions.parentElement!==row)row.prepend(actions);
      row.classList.add('has-compare-toggle');
    }else{
      if(actions.parentElement!==head)head.appendChild(actions);
      row.classList.remove('has-compare-toggle');
    }
  });
}
function setupResponsiveChartControls(){
  syncResponsiveChartControls();
  setupExpandedChartViewport();
  if(window.__responsiveChartControlsBound)return;
  window.__responsiveChartControlsBound=true;
  let frame=0;
  window.addEventListener('resize',()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(syncResponsiveChartControls);
  },{passive:true});
}

function chartEntranceReducedMotion(){
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
}
function chartEntrancePhoneLandscape(){
  return window.matchMedia?.('(orientation: landscape) and (max-width:900px) and (max-height:500px) and (hover:none) and (pointer:coarse)').matches===true;
}
function activatePendingChartEntrancesForPhoneLandscape(){
  if(!chartEntrancePhoneLandscape())return;
  document.querySelectorAll('.chart-card .chart-wrap').forEach(activateChartEntrance);
}
function chartEntranceDataElements(svg){
  const viewWidth=svg.viewBox?.baseVal?.width||Number(svg.getAttribute('width'))||1120;
  return [...svg.querySelectorAll('rect, polyline, circle')].filter(node=>{
    if(node.classList.contains('svg-hitbox'))return false;
    if(node.tagName.toLowerCase()!=='rect')return true;
    const x=Number(node.getAttribute('x')||0),y=Number(node.getAttribute('y')||0);
    const width=Number(node.getAttribute('width')||0),height=Number(node.getAttribute('height')||0);
    const viewHeight=svg.viewBox?.baseVal?.height||Number(svg.getAttribute('height'))||330;
    return !(x===0&&y===0&&width>=viewWidth*.98&&height>=viewHeight*.98);
  });
}
function chartEntranceXRatio(node,svg){
  const viewWidth=svg.viewBox?.baseVal?.width||1120;
  let x=0;
  if(node.tagName.toLowerCase()==='rect'){
    x=Number(node.getAttribute('x')||0)+Number(node.getAttribute('width')||0)/2;
  }else if(node.tagName.toLowerCase()==='circle'){
    x=Number(node.getAttribute('cx')||0);
  }else{
    const points=node.points;
    x=points?.numberOfItems?points.getItem(0).x:0;
  }
  return Math.max(0,Math.min(1,x/Math.max(1,viewWidth)));
}
function prepareChartEntranceForSvg(svg){
  if(!svg)return;
  const card=svg.closest('.chart-card');
  if(!card)return;
  if(chartEntranceReducedMotion()||card.dataset.chartEntrancePlayed==='true'){
    card.classList.remove('chart-entrance-ready');
    card.classList.add('chart-entrance-active');
    return;
  }
  let lineIndex=0;
  chartEntranceDataElements(svg).forEach(node=>{
    const tag=node.tagName.toLowerCase();
    if(tag==='polyline'){
      const length=Math.max(1,Math.ceil(node.getTotalLength?.()||1));
      node.classList.add('chart-anim-line');
      node.style.setProperty('--chart-path-length',String(length));
      node.style.setProperty('--chart-delay',`${80+lineIndex*55}ms`);
      lineIndex+=1;
      return;
    }
    const delay=Math.round(chartEntranceXRatio(node,svg)*680);
    node.classList.add(tag==='circle'?'chart-anim-point':'chart-anim-bar');
    node.style.setProperty('--chart-delay',`${delay}ms`);
  });
  card.classList.remove('chart-entrance-active');
  card.classList.add('chart-entrance-ready');
}
function activateChartEntrance(wrap){
  const card=wrap?.closest('.chart-card');
  if(!card||card.dataset.chartEntrancePlayed==='true')return;
  card.dataset.chartEntrancePlayed='true';
  requestAnimationFrame(()=>card.classList.add('chart-entrance-active'));
  chartEntranceObserver?.unobserve(wrap);
}
function chartWrapFullyVisible(wrap){
  const rect=wrap.getBoundingClientRect();
  return rect.top>=-1&&rect.bottom<=window.innerHeight+1;
}
function setupChartEntranceAnimations(){
  chartEntranceObserver?.disconnect();
  chartEntranceObserver=null;
  const wraps=[...document.querySelectorAll('.chart-card .chart-wrap')];
  if(!wraps.length)return;
  if(!window.__chartEntrancePhoneLandscapeBound){
    window.__chartEntrancePhoneLandscapeBound=true;
    let landscapeFrame=0;
    const syncLandscapeEntrance=()=>{
      cancelAnimationFrame(landscapeFrame);
      landscapeFrame=requestAnimationFrame(activatePendingChartEntrancesForPhoneLandscape);
    };
    window.addEventListener('resize',syncLandscapeEntrance,{passive:true});
    window.addEventListener('orientationchange',syncLandscapeEntrance,{passive:true});
  }
  if(chartEntranceReducedMotion()||chartEntrancePhoneLandscape()||!('IntersectionObserver' in window)){
    wraps.forEach(activateChartEntrance);
    return;
  }
  chartEntranceObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting&&entry.intersectionRatio>=.97&&chartWrapFullyVisible(entry.target)){
        activateChartEntrance(entry.target);
      }
    });
  },{threshold:[0,.5,.9,.97,1]});
  wraps.forEach(wrap=>chartEntranceObserver.observe(wrap));
  requestAnimationFrame(()=>wraps.forEach(wrap=>{
    if(chartWrapFullyVisible(wrap))activateChartEntrance(wrap);
  }));
}

function chartCompareLabel(scope){
  return CHART_COMPARE_MODES[scope]==='kospi'?'코스피 지수':'누적수익률';
}
function chartCompareToggle(scope){
  const mode=CHART_COMPARE_MODES[scope]||'return';
  return `<div class="chart-compare-toggle" role="group" aria-label="선 그래프 표시 기준"><button type="button" class="${mode==='return'?'active':''}" data-chart-compare-scope="${scope}" data-chart-compare-mode="return" aria-pressed="${mode==='return'}" onclick="setChartCompareMode('${scope}','return')">수익률</button><button type="button" class="${mode==='kospi'?'active':''}" data-chart-compare-scope="${scope}" data-chart-compare-mode="kospi" aria-pressed="${mode==='kospi'}" onclick="setChartCompareMode('${scope}','kospi')">코스피</button></div>`;
}
function setChartCompareMode(scope,mode){
  if(!['securities','pension'].includes(scope))return;
  CHART_COMPARE_MODES[scope]=mode==='kospi'?'kospi':'return';
  document.querySelectorAll(`[data-chart-compare-scope="${scope}"]`).forEach(btn=>{
    const active=btn.dataset.chartCompareMode===CHART_COMPARE_MODES[scope];
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  const legend=document.getElementById(`${scope}CompareLegend`);
  if(legend)legend.textContent=chartCompareLabel(scope);
  const swatch=document.getElementById(`${scope}CompareSwatch`);
  if(swatch)swatch.style.background=CHART_COMPARE_MODES[scope]==='kospi'?'#7c3aed':'#5abdf2';
  if(scope==='pension'){
    drawPensionCumChart();
    prepareChartEntranceForSvg(document.getElementById('pensionChartCum'));
  }else{
    drawCumChart();
    prepareChartEntranceForSvg(document.getElementById('chartCum'));
  }
}

function symbolChartToggle(scope){
  const mode=SYMBOL_CHART_MODES[scope]||'profit';
  const profitLabel=scope==='pension'?'운용수익':'누적손익';
  const rateLabel=scope==='pension'?'수익률':'손익률';
  return `<div class="chart-compare-toggle" role="group" aria-label="상품·종목별 차트 표시 기준"><button type="button" class="${mode==='profit'?'active':''}" data-symbol-chart-scope="${scope}" data-symbol-chart-mode="profit" aria-pressed="${mode==='profit'}" onclick="setSymbolChartMode('${scope}','profit')">${profitLabel}</button><button type="button" class="${mode==='rate'?'active':''}" data-symbol-chart-scope="${scope}" data-symbol-chart-mode="rate" aria-pressed="${mode==='rate'}" onclick="setSymbolChartMode('${scope}','rate')">${rateLabel}</button></div>`;
}
function setSymbolChartMode(scope,mode){
  if(!['securities','pension'].includes(scope))return;
  SYMBOL_CHART_MODES[scope]=mode==='rate'?'rate':'profit';
  document.querySelectorAll(`[data-symbol-chart-scope="${scope}"]`).forEach(btn=>{
    const active=btn.dataset.symbolChartMode===SYMBOL_CHART_MODES[scope];
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  if(scope==='pension'){
    drawPensionSymbolChart();
    prepareChartEntranceForSvg(document.getElementById('pensionChartSymbol'));
  }else{
    drawLineChart();
    prepareChartEntranceForSvg(document.getElementById('chartSymbol'));
  }
}

function scrollToDashboardTop(){
  window.scrollTo({top:0,left:0,behavior:'smooth'});
}
function ensureMobileTopButton(){
  let button=document.getElementById('mobileTopButton');
  if(!button){
    button=document.createElement('button');
    button.id='mobileTopButton';
    button.type='button';
    button.className='mobile-top-button';
    button.textContent='↑ TOP';
    button.setAttribute('aria-label','화면 맨 위로 이동');
    button.addEventListener('click',scrollToDashboardTop);
    document.body.appendChild(button);
  }
  const update=()=>button.classList.toggle('show',(window.scrollY||document.documentElement.scrollTop||0)>220);
  if(!window.__mobileTopScrollBound){
    window.__mobileTopScrollBound=true;
    window.addEventListener('scroll',update,{passive:true});
  }
  update();
}

function closeDateActionMenu(){
  const menu=document.getElementById('dateActionMenu');
  const tabs=document.getElementById('tabs');
  if(menu) menu.classList.remove('show');
  if(tabs) tabs.classList.remove('mobile-menu-open');
}
function toggleDateActionMenu(event){
  if(event) event.stopPropagation();
  closeCompactActionMenu();
  const menu=document.getElementById('dateActionMenu');
  const tabs=document.getElementById('tabs');
  if(!menu) return;
  const shouldOpen=!menu.classList.contains('show');
  menu.classList.toggle('show',shouldOpen);
  if(tabs) tabs.classList.toggle('mobile-menu-open',shouldOpen);
}
function closeCompactActionMenu(){
  const menu=document.getElementById('compactActionMenu');
  const button=document.getElementById('compactActionMenuButton');
  if(menu) menu.classList.remove('show');
  if(button) button.setAttribute('aria-expanded','false');
}
function toggleCompactActionMenu(event){
  if(event) event.stopPropagation();
  const menu=document.getElementById('compactActionMenu');
  const button=document.getElementById('compactActionMenuButton');
  if(!menu||!button) return;
  const shouldOpen=!menu.classList.contains('show');
  closeDateActionMenu();
  menu.classList.toggle('show',shouldOpen);
  button.setAttribute('aria-expanded',String(shouldOpen));
}
document.addEventListener('click',e=>{
  if(!e.target.closest('#tabs')) closeDateActionMenu();
  closeCompactActionMenu();
});
async function dispatchKrxPriceUpdate(pin, mode='selected'){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.githubPages;
  const selectedDate=ACTIVE_DATE || '';
  const updateMode=mode==='auto'?'auto':'selected';

  if(!config.url || config.url.includes('여기에_')){
    throw new Error('Apps Script URL이 설정되지 않았습니다.');
  }

  const body={
    pin:String(pin||'').trim(),
    action:'updateKrxPrices'
  };

  // selected: 현재 화면의 기준일을 강제로 재갱신
  // auto: 날짜를 보내지 않아 서버가 최신/누락 여부와 종가 반영 상태를 판단한다.
  // 이미 종가가 반영된 경우 서버측 조건에 따라 워크플로 실행을 건너뛴다.
  if(updateMode==='selected'){
    body.date=selectedDate;
  }

  const res=await fetch(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(body)
  });

  const data=await res.json().catch(()=>({}));

  if(!data.ok){
    throw new Error(data.error||'KRX 현재가 반영 요청 실패');
  }

  return data;
}
function ensureAppToast(){
  let toast=document.getElementById('appToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='appToast';
    toast.className='app-toast';
    document.body.appendChild(toast);
  }
  return toast;
}
function showAppToast(message,type='ok',delay=3500){
  const toast=ensureAppToast();
  toast.className=`app-toast show ${type==='err'?'err':'ok'}`;
  toast.textContent=message;
  clearTimeout(showAppToast._timer);
  showAppToast._timer=setTimeout(()=>toast.classList.remove('show'),delay);
}
function ensureKrxActionModal(){
  let modal=document.getElementById('krxActionModal');
  if(modal) return modal;
  modal=document.createElement('div');
  modal.id='krxActionModal';
  modal.className='krx-action-modal';
  modal.innerHTML=`<div class="krx-action-card" role="dialog" aria-modal="true" aria-labelledby="krxActionTitle">
    <button type="button" class="krx-action-close" onclick="closeKrxActionModal()" aria-label="닫기">×</button>
    <div class="krx-action-icon">📈</div>
    <h3 id="krxActionTitle">KRX 현재가 반영</h3>
    <p>선택한 기준일만 다시 갱신하거나, 날짜를 비워 누락 거래일을 자동 보충할 수 있습니다. Pages 반영까지 몇 분 걸릴 수 있습니다.</p>
    <label class="krx-action-label" for="krxActionPin">저장/실행 PIN</label>
    <input id="krxActionPin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN 입력">
    <div id="krxActionStatus" class="krx-action-status"></div>
    <div class="krx-action-buttons">
      <button type="button" class="ghost" onclick="closeKrxActionModal()">취소</button>
      <button type="button" class="ghost" onclick="submitKrxActionModal('auto')">최신/누락 반영</button>
      <button type="button" class="primary" onclick="submitKrxActionModal('selected')"><span class="krx-selected-line">선택일</span><span class="krx-selected-space"> </span><span class="krx-selected-line">재갱신</span></button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeKrxActionModal()});
  return modal;
}
function openKrxActionModal(){
  const modal=ensureKrxActionModal();
  const status=modal.querySelector('#krxActionStatus');
  const input=modal.querySelector('#krxActionPin');
  if(status){status.textContent='';status.className='krx-action-status'}
  modal.classList.add('show');
  setTimeout(()=>input?.focus(),30);
}

function forceMobileViewportReflow(){
  const y=window.scrollY||document.documentElement.scrollTop||0;
  if(document.activeElement&&typeof document.activeElement.blur==='function'){
    document.activeElement.blur();
  }
  setTimeout(()=>{
    window.scrollTo({top:y,left:0,behavior:'auto'});
    window.scrollBy(0,1);
    window.scrollBy(0,-1);
    document.body.style.transform='translateZ(0)';
    requestAnimationFrame(()=>{
      document.body.style.transform='';
      window.dispatchEvent(new Event('resize'));
    });
  },120);
}

function closeKrxActionModal(){
  const modal=document.getElementById('krxActionModal');
  if(modal) modal.classList.remove('show');
  forceMobileViewportReflow();
}
async function submitKrxActionModal(mode='selected'){
  const modal=ensureKrxActionModal();
  const input=modal.querySelector('#krxActionPin');
  const status=modal.querySelector('#krxActionStatus');
  const buttons=modal.querySelectorAll('.krx-action-buttons button');
  const pin=String(input?.value||'').trim();
  const updateMode=mode==='auto'?'auto':'selected';
  const selectedDate=ACTIVE_DATE || '';
  if(!pin){
    if(status){status.textContent='PIN을 입력해 주세요.';status.className='krx-action-status err'}
    input?.focus();
    return;
  }
  try{
    buttons.forEach(btn=>btn.disabled=true);
    if(status){
      status.textContent=updateMode==='selected'
        ? `${selectedDate} KRX 현재가 재갱신 요청 중...`
        : '최신/누락 KRX 현재가 반영 요청 중...';
      status.className='krx-action-status ok';
    }
    const data = await dispatchKrxPriceUpdate(pin, updateMode);

    if(data.action === 'workflow_skipped'){
      const msg = data.message || '업데이트할 KRX 현재가 데이터가 없습니다.';
      if(status){status.textContent=msg;status.className='krx-action-status ok'}
      showAppToast(msg, 'ok', 6500);
      return;
    }

    const successMsg=updateMode==='selected'
      ? `${selectedDate} KRX 현재가 재갱신 요청 완료. GitHub Actions 완료 후 새로고침해 주세요.`
      : '최신/누락 KRX 현재가 반영 요청 완료. GitHub Actions 완료 후 새로고침해 주세요.';
    if(status){status.textContent=successMsg;status.className='krx-action-status ok'}
    showAppToast(updateMode==='selected'?'선택일 KRX 재갱신 요청 완료':'KRX 자동 반영 요청 완료', 'ok');
    setTimeout(closeKrxActionModal,2000);
  }catch(e){
    if(status){status.textContent='실패: '+(e.message||String(e));status.className='krx-action-status err'}
  }finally{
    buttons.forEach(btn=>btn.disabled=false);
  }
}
async function triggerKrxPriceUpdate(){
  closeDateActionMenu();
  openKrxActionModal();
}

function jumpToSection(id){
  const el=document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}


function sectionToSecuritiesBlock(html, extraClass=''){
  if(!html) return '';
  return html
    .replace(/^<section([^>]*)>/, (_, attrs='')=>{
      const idMatch=attrs.match(/\sid="([^"]*)"/);
      const classMatch=attrs.match(/\sclass="([^"]*)"/);
      const idAttr=idMatch?` id="${idMatch[1]}"`:'';
      const classes=['securities-subsection',extraClass,classMatch?classMatch[1]:''].filter(Boolean).join(' ');
      const otherAttrs=attrs
        .replace(/\sid="[^"]*"/,'')
        .replace(/\sclass="[^"]*"/,'');
      return `<div${idAttr} class="${classes}"${otherAttrs}>`;
    })
    .replace(/<\/section>\s*$/, '</div>');
}
function renderSecuritiesSummaryCards(x){
  const securitiesScope=securitiesScopeText(x),v=separateProfitView(x);
  const principalNote=INCLUDE_SEPARATE_PROFIT&&v.reclassifiedReinvestment?`별도수익 재투입 ${won(v.reclassifiedReinvestment)} 원금 제외`:x.account2Included?'계좌2 실현분·성과 제외 자금 전입 포함 기준':'선택일 계좌1 투자원금 기준';
  const returnNote=INCLUDE_SEPARATE_PROFIT?'별도수익 포함 누적손익 ÷ 성과기준 투입원금':'총 합산 누적손익 ÷ 기준 투입원금';
  return `<div class="securities-subsection securities-summary-block"><div class="grid cards">${metricCard('증권계좌 투자 결과물',won(v.totalResult),`${securitiesScope} 기준`,true)}${metricCard('기준 투입원금',won(v.totalPrincipal),principalNote)}${metricCard('총 합산 누적손익',won(v.totalProfit),`${securitiesScope} 누적손익`,false,cls(v.totalProfit))}${metricCard('투자대비 이익률',pct(v.totalReturn),returnNote,false,cls(v.totalReturn))}</div></div>`;
}
function renderSecuritiesSection(x){
  return `<section id="securities-section"><div class="section-title"><h2><span class="section-title-icon">🏦</span>증권계좌 현황</h2>${separateProfitControl(x,'section-inline')}</div><div class="securities-band">${renderSecuritiesSummaryCards(x)}${sectionToSecuritiesBlock(renderHoldings(x),'holdings-block')}${sectionToSecuritiesBlock(renderAccounts(x),'accounts-block')}${sectionToSecuritiesBlock(renderCharts(x),'charts-block')}${sectionToSecuritiesBlock(renderResultSummary(x),'ledger-block')}${isLedgerCheckDate(x.date)?sectionToSecuritiesBlock(renderSourceTables(x),'source-block'):''}</div></section>`;
}

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
  return `<div id="pensionContribModal" class="contrib-modal" aria-hidden="true" onclick="if(event.target===this)closePensionContributionModal()"><div class="contrib-modal-card" role="dialog" aria-modal="true" aria-labelledby="pensionContribModalTitle"><div class="contrib-modal-head"><div><h2 id="pensionContribModalTitle"><span class="section-title-icon">💰</span>퇴직연금 금액 조정</h2></div><div class="contrib-modal-head-actions"><button type="button" class="contrib-modal-icon-btn pension-form-reset" onclick="resetPensionContributionForm()" title="입력값 초기화" aria-label="입력값 초기화">↻</button><button type="button" class="contrib-modal-icon-btn contrib-modal-close" onclick="closePensionContributionModal()" aria-label="닫기">×</button></div></div>
<div class="pension-contrib-tool modal-card-box">
  <div class="pension-contrib-section-head"><h3>등록</h3><div class="pension-work-controls"><div class="pension-work-mode" role="tablist" aria-label="처리 방식 선택"><button type="button" class="pension-work-mode-btn active" data-mode="single" onclick="setPensionBatchMode(false)">개별 처리</button><button type="button" class="pension-work-mode-btn" data-mode="batch" onclick="setPensionBatchMode(true)">작업 모음 <span id="pensionBatchModeCount" class="pension-batch-count" hidden>0</span></button></div></div></div>
  <div class="contrib-field full contrib-target-field"><span class="contrib-field-label">등록 유형</span><input type="hidden" id="pensionContribTarget" value="cashSnapshot"><div class="contrib-target-tabs" role="tablist" aria-label="등록 유형 선택"><button type="button" class="contrib-target-option active" data-target="cashSnapshot" onclick="setPensionContributionTarget('cashSnapshot')">현금성자산</button><button type="button" class="contrib-target-option" data-target="contribution" onclick="setPensionContributionTarget('contribution')">기업적립금</button><button type="button" class="contrib-target-option" data-target="etfTrade" onclick="setPensionContributionTarget('etfTrade')">추가 매수</button></div></div>
  <p id="pensionEtfTradeHelp" class="small" hidden>추가 매수는 퇴직연금 앱 보유현황에 실제 반영된 날 저장하세요. 신청일·상품·수량·체결금액만 입력하면 나머지는 자동 계산합니다.</p>
  <div id="pensionContribStandardFields" class="contrib-form-grid cash-mode">
    <div class="contrib-field"><label for="pensionContribDate">일자</label><input id="pensionContribDate" type="date" value="${cashDefaultDate}" data-contrib-default-date="${contribDefaultDate}" data-cash-default-date="${cashDefaultDate}"></div>
    <div class="contrib-field"><label id="pensionContribAmountLabel" for="pensionContribAmount">평가금액</label><input id="pensionContribAmount" type="text" inputmode="numeric" value="${cashDefaultValue}" data-contrib-default-value="618,060" data-cash-default-value="${cashDefaultValue}" oninput="formatPensionMoneyInput(this)"></div>
    <div id="pensionCashCostField" class="contrib-field"><label for="pensionCashCostBasis">매수원금</label><input id="pensionCashCostBasis" type="text" inputmode="numeric" value="${cashDefaultCostBasis}" data-cash-default-value="${cashDefaultCostBasis}" oninput="formatPensionMoneyInput(this)"></div>
    <div class="contrib-field full"><label for="pensionContribMemo">메모</label><input id="pensionContribMemo" type="text" value="현금성자산 앱 확인" data-contrib-default-memo="${contribDefaultMemo}" data-cash-default-memo="현금성자산 앱 확인"></div>
  </div>
  <div id="pensionEtfTradeFields" class="pension-etf-trade-fields" hidden>
    <div class="contrib-form-grid">
      <div class="contrib-field full"><label for="pensionEtfTradeDate">신청일</label><input id="pensionEtfTradeDate" type="date" value="${cashDefaultDate}" onchange="updatePensionEtfTradePreview()"></div>
      <div class="contrib-field full"><label for="pensionEtfTradeTicker">ETF 상품</label><select id="pensionEtfTradeTicker" onchange="updatePensionEtfTradePreview()">${pensionTradeProductOptions()}</select></div>
      <div class="contrib-field"><label for="pensionEtfTradeQty">체결수량</label><input id="pensionEtfTradeQty" type="text" inputmode="numeric" placeholder="예: 77" oninput="updatePensionEtfTradePreview()"></div>
      <div class="contrib-field"><label for="pensionEtfTradeAmount">체결금액</label><input id="pensionEtfTradeAmount" type="text" inputmode="numeric" placeholder="예: 1,290,580" oninput="formatPensionMoneyInput(this);updatePensionEtfTradePreview()"></div>
    </div>
    <div class="pension-etf-trade-apply-note">앱 반영일 <strong id="pensionEtfTradeApplyDate">${applyDate}</strong> · 저장한 날 기준으로 보유수량/원가/현금에 적용</div>
    <div id="pensionEtfTradePreview" class="pension-etf-trade-preview"><span class="small">상품·수량·체결금액을 입력하면 적용 후 예상값을 보여줍니다.</span></div>
  </div>
  <div class="contrib-actions">
    <button type="button" id="pensionContribSaveButton" class="contrib-btn" onclick="savePensionContribution()">저장</button>
  </div>
  <div id="pensionContribStatus" class="contrib-status"></div>
  <pre id="pensionContribOutput" class="contrib-output"></pre>
</div>
<div id="pensionContribDeleteCard" class="contrib-list modal-card-box"${pensionCashSnapshotItems().length?'':' hidden'}>
  <h3>삭제</h3>
  <p id="pensionContribDeleteHelp" class="small">잘못 넣은 현금성자산 기록을 선택 후 삭제합니다.</p>
  <div id="pensionContribExistingList" class="contrib-existing-list">${renderPensionContributionList('cashSnapshot')}</div>
  <div class="contrib-actions"><button type="button" id="pensionContribDeleteButton" class="contrib-btn danger" onclick="deleteSelectedPensionContribution()">선택 항목 삭제</button></div>
  <div id="pensionContribDeleteStatus" class="contrib-status"></div>
</div>
<div id="pensionBatchPanel" class="pension-batch-panel modal-card-box" hidden>
  <div class="pension-batch-head"><div><h3>작업 모음 <span id="pensionBatchTitleCount">0건</span></h3><p>저장·삭제 작업을 모아 PIN 한 번으로 한 커밋에 반영합니다.</p></div><button type="button" id="pensionBatchClearButton" class="pension-batch-clear" onclick="clearPensionBatchQueue()">전체 비우기</button></div>
  <div id="pensionBatchQueueList" class="pension-batch-queue"><div class="pension-batch-empty">아직 추가된 작업이 없습니다.</div></div>
  <div id="pensionBatchOrderNote" class="pension-batch-order-note" hidden></div>
  <div id="pensionBatchStatus" class="contrib-status"></div>
  <div class="pension-batch-actions"><button type="button" id="pensionBatchApplyButton" class="contrib-btn" onclick="applyPensionBatchQueue()" disabled>일괄 적용</button></div>
</div>
<details class="token-guide">
  <summary>GitHub 토큰 만료/교체 방법</summary>
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

function render(){
  const x=calc(ACTIVE_DATE),v=separateProfitView(x);
  renderTabs();
  const pensionPills=x.hasPension?`<span class="pill hero-profit-pill">퇴직연금 운용수익 ${won(x.pensionProfit)}</span><span class="pill hero-return-pill">퇴직연금 운용수익률 ${pct(x.pensionReturn)}</span>`:'';
  document.getElementById('app').innerHTML=`<div class="wrap"><header class="hero" id="top-section"><div class="hero-title-row"><h1>${PORTFOLIO.meta.title}</h1><span class="hero-basis">(${koreanDateLabel(x.date)})</span></div><div class="pillbar hero-metric-pills ${x.hasPension?'has-pension':''}"><span class="pill hero-profit-pill">증권계좌 누적손익 ${won(v.totalProfit)}</span><span class="pill hero-return-pill">증권계좌 누적손익률 ${pct(v.totalReturn)}</span>${pensionPills}</div></header>${renderPensionContributionModal(x)}${x.hasPension?renderCombined(x):''}${x.hasPension?renderPension(x):''}${renderSecuritiesSection(x)}</div>`;
  drawAllCharts();
  setupPensionVizTooltips();
  ensureMobileTopButton();
  ensureDesktopEdgeToc();
}
function renderResultSummary(x){
  const c=PORTFOLIO.constants,v=separateProfitView(x);
  const outsideCash=c.outsideCash ?? 2035097;
  const actualHoldingAndCash=x.allocTotal + outsideCash;
  const baseLedgerGap=x.totalResult-actualHoldingAndCash;
  const ledgerGap=v.totalResult-actualHoldingAndCash;
  if(!isLedgerCheckDate(x.date)) return '';
  const separateUnreflected=v.unreflectedSeparateProfit;
  const reasonValue=INCLUDE_SEPARATE_PROFIT&&separateUnreflected?'카드대금 사용 + 별도손익 미반영':'수익실현분 카드대금 사용';
  const reasonDetail=INCLUDE_SEPARATE_PROFIT&&separateUnreflected?`${won(baseLedgerGap)} ${separateUnreflected>=0?'+':'-'} ${won(Math.abs(separateUnreflected))}`:'6/18 기준 확정 정리값';
  const note=INCLUDE_SEPARATE_PROFIT?`<p class="table-note"><strong>차액 발생 사유:</strong> 기존 장부 차액 ${won(baseLedgerGap)}에 6~8월 별도손익 중 현 보유자산 미반영분 ${won(separateUnreflected)}을 합산한 값. AI반도체에 재투입된 ${won(v.reclassifiedReinvestment)}은 중복계상하지 않음.</p>`:`<p class="table-note"><strong>차액 발생 사유:</strong> 계좌 밖 현금은 6/18 확인값 ${won(outsideCash)} 유지. 해당 현금은 투자 실현수익 잔액 반영, 차액은 수익실현분 카드대금 사용액으로 정리.</p>`;
  return `<section id="ledger-check"><div class="section-title"><h2><span class="section-title-icon">🔍</span>장부결과 VS 실제보유</h2>${separateProfitControl(x,'section-inline')}</div><div class="grid cards">${metricCard('장부상 증권계좌 투자 결과물(A)',won(v.totalResult),INCLUDE_SEPARATE_PROFIT?'기존 장부 + 별도수익 반영(재투입 중복 제외)':'계좌1 성과 + 계좌2 실현분 + 토스 실현분 기준',true)}${metricCard('현재 증권계좌 및 현금 보유액(B)',won(actualHoldingAndCash),'증권계좌 평가총액 + 계좌 밖 현금')}${metricCard('차액(A-B)',won(ledgerGap),'장부상 결과물과 실제 보유액의 차이',false,cls(ledgerGap))}${metricCard('차액 발생 이유',reasonValue,reasonDetail,false)}</div>${note}</section>`;
}

function holdingRowCssClass(h){
  const cssClass=String(h?.cssClass||'');
  return cssClass==='ticker-mini'&&Number(h?.qty)!==1?'':cssClass;
}

function renderHoldings(x){
  const holdCost=x.holdings.reduce((a,h)=>a+h.cost,0),
        holdEval=x.holdings.reduce((a,h)=>a+h.evalAmount,0),
        holdProfit=holdEval-holdCost,
        holdFeeAdjusted=x.holdings.reduce((a,h)=>a+(Number(h.feeAdjustedProfit ?? h.profit) || 0),0),
        cash=Number(x.securitiesCash||0),
        totalCostWithCash=holdCost+cash,
        totalEvalWithCash=holdEval+cash,
        holdReturn=holdCost?holdProfit/holdCost*100:0,
        totalReturnWithCash=totalCostWithCash?holdProfit/totalCostWithCash*100:0;
  const orderedHoldings=sortSecurityItems(x.holdings);
  const cards=orderedHoldings.map(h=>mobileInfoCard(`<span class="holding-name-text">${h.name}</span>${securitySymbolSwatch(h.name)}`,[
    ['수량',fmt(h.qty)],
    ['평단',won(h.avgPrice ?? (h.qty?h.cost/h.qty:0))],
    ['투자원금',won(h.cost)],
    ['현재가',won(h.price)],
    ['평가금액',won(h.evalAmount)],
    ['평가손익',won(h.profit),cls(h.profit)],
    ['손익률',pct(h.returnRate),cls(h.returnRate)]
  ],holdingRowCssClass(h))).join('')+
  mobileInfoCard('보유종목 합계',[
    ['투자원금',won(holdCost)],['평가금액',won(holdEval)],['평가손익',won(holdProfit),cls(holdProfit)],['손익률',pct(holdReturn),cls(holdReturn)]
  ],'summary-card')+
  mobileInfoCard('증권계좌 현금',[
    ['투자원금',won(cash)],['평가금액',won(cash)],['평가손익',won(0)],['손익률',pct(0)]
  ])+
  mobileInfoCard('총계(보유분+현금)',[
    ['투자원금',won(totalCostWithCash)],['평가금액',won(totalEvalWithCash)],['평가손익',won(holdProfit),cls(holdProfit)],['손익률',pct(totalReturnWithCash),cls(totalReturnWithCash)]
  ],'summary-card');
  return `<section id="securities-holdings" ${mobileViewAttrs('holdings')}><div class="section-title"><h2><span class="section-title-icon">📁</span>증권계좌 보유분</h2>${mobileViewToggle('holdings')}</div><div class="mobile-scroll table-view"><table class="hold-position-table"><thead><tr><th>종목명</th><th>수량</th><th>평단</th><th>투자원금</th><th>현재가</th><th>평가금액</th><th>평가손익</th><th>손익률</th></tr></thead><tbody>${orderedHoldings.map(h=>`<tr class="hold-row ${holdingRowCssClass(h)}"><td><span class="holding-name-text">${h.name}</span>${securitySymbolSwatch(h.name)}</td><td class="num">${fmt(h.qty)}</td><td class="num">${fmt(h.avgPrice ?? (h.qty?h.cost/h.qty:0))}</td><td class="num">${fmt(h.cost)}</td><td class="num">${fmt(h.price)}</td><td class="num">${fmt(h.evalAmount)}</td><td class="num ${cls(h.profit)}">${fmt(h.profit)}</td><td class="num ${cls(h.returnRate)}">${pct(h.returnRate)}</td></tr>`).join('')}<tr class="summary-row"><td>보유종목 합계</td><td class="num">-</td><td class="num">-</td><td class="num">${fmt(holdCost)}</td><td class="num">-</td><td class="num">${fmt(holdEval)}</td><td class="num ${cls(holdProfit)}">${fmt(holdProfit)}</td><td class="num ${cls(holdReturn)}">${pct(holdReturn)}</td></tr><tr><td>증권계좌 현금</td><td class="num">-</td><td class="num">-</td><td class="num">${fmt(cash)}</td><td class="num">-</td><td class="num">${fmt(cash)}</td><td class="num">0</td><td class="num">0.00%</td></tr><tr class="summary-row"><td>총계(보유분+현금)</td><td class="num">-</td><td class="num">-</td><td class="num">${fmt(totalCostWithCash)}</td><td class="num">-</td><td class="num">${fmt(totalEvalWithCash)}</td><td class="num ${cls(holdProfit)}">${fmt(holdProfit)}</td><td class="num ${cls(totalReturnWithCash)}">${pct(totalReturnWithCash)}</td></tr></tbody></table></div><div class="mobile-card-view">${cards}</div></section>`;
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
    ]);
  }).join('')+mobileInfoCard('현금성자산',[
    ['수량',fmt(1)],['평균단가',won(pensionCashCost)],['매수원금',won(pensionCashCost)],['평가금액',won(x.pensionCash)],['평가손익',won(cashProfit),cls(cashProfit)],['수익률',pct(cashReturn),cls(cashReturn)],['비중',pct(cashWeight)]
  ])+mobileInfoCard('합계',[
    ['매수원금',won(pensionHeldCost)],['평가금액',won(x.pensionEval)],['평가손익',won(pensionHeldProfit),cls(pensionHeldProfit)],['수익률',pct(pensionHeldReturn),cls(pensionHeldReturn)]
  ],'summary-card');
  return `<div class="note pension-products-note" id="pension-products" ${mobileViewAttrs('pensionProducts')}><div class="section-title"><h2><span class="section-title-icon">📦</span>연금상품별 현황</h2>${mobileViewToggle('pensionProducts')}</div><div class="mobile-scroll table-view"><table class="pension-products-table"><thead><tr><th>상품</th><th>수량</th><th>평균단가</th><th>매수원금</th><th>평가금액</th><th>평가손익</th><th>수익률</th><th>비중</th></tr></thead><tbody>${orderedPensionRows.map(r=>pensionRow(r,x.pensionEval)).join('')}${pensionCashRow(x.pensionCash,x.pensionEval,pensionCashCost)}<tr class="summary-row"><td>합계</td><td></td><td></td><td class="num">${fmt(pensionHeldCost)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${cls(pensionHeldProfit)}">${fmt(pensionHeldProfit)}</td><td class="num ${cls(pensionHeldReturn)}">${pct(pensionHeldReturn)}</td><td></td></tr></tbody></table></div><div class="mobile-card-view">${cards}</div><p class="small pension-products-basis-note">※ 매수원금 합계는 현재 보유상품 재투자 기준</p>${renderPensionProductInsights(x)}</div>`;
}

function renderPension(x){
  const c=PORTFOLIO.constants,
        day=x.pensionDayChange,
        rate=x.pensionDayRate,
        pensionCashCost=Number(x.pensionCashCost||0),
        pensionHeldCost=x.pensionRows.reduce((a,r)=>a+r.cost,0)+pensionCashCost,
        pensionHeldProfit=x.pensionEval-pensionHeldCost,
        pensionHeldReturn=pensionHeldCost?pensionHeldProfit/pensionHeldCost*100:0,
        orderedPensionRows=sortPensionItems(x.pensionRows),
        hasPrevPension=x.pensionPrevEval!=null,
        noPrevBlock=`<div class="pension-no-prev-note">전일 데이터가 없습니다.</div>`,
        changeContent=hasPrevPension?`<div class="change-kpis"><div class="mini-card"><div class="m-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가금액</div><div class="m-value">${won(x.pensionPrevEval)}</div></div><div class="mini-card"><div class="m-label">${shortDate(x.date)} 평가금액</div><div class="m-value">${won(x.pensionEval)}</div></div><div class="mini-card"><div class="m-label">하루 변동분</div><div class="m-value ${cls(day)}">${signed(day,'원')}</div></div><div class="mini-card"><div class="m-label">하루 변동률</div><div class="m-value ${cls(rate)}">${(rate>0?'+':'')+pct(rate)}</div></div></div><div class="change-table-wrap mobile-scroll table-view"><table class="change-table"><thead><tr><th>상품</th><th>${x.prevKey?shortDate(x.prevKey):'-'} 종가</th><th>${shortDate(x.date)} 종가</th><th>일변동</th></tr></thead><tbody>${orderedPensionRows.map(r=>`<tr><td><strong>${mobileTableProductName(r.name)}</strong>${pensionProductSwatch(r.name)}</td><td class="num"><span class="change-price">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span><span class="change-eval">${r.prevEval==null?'-':won(r.prevEval)}</span></td><td class="num"><span class="change-price">${fmt(r.price)}</span><span class="change-eval">${won(r.evalAmount)}</span></td><td class="num ${cls(r.dayChange)}">${r.dayChange==null?'-':signed(r.dayChange)}</td></tr>`).join('')}<tr><td>현금성자산</td><td class="num"><span class="change-price">—</span><span class="change-eval">${won(x.prevPensionCash)}</span></td><td class="num"><span class="change-price">—</span><span class="change-eval">${won(x.pensionCash)}</span></td><td class="num ${cls(x.pensionCashDayChange)}">${signed(x.pensionCashDayChange)}</td></tr><tr class="summary-row"><td>합계</td><td class="num">${fmt(x.pensionPrevEval)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${cls(day)}">${signed(day)}</td></tr></tbody></table></div><div class="change-mobile-list mobile-card-view">${orderedPensionRows.map(r=>`<div class="change-product-card"><div class="change-product-title">${r.name}</div><div class="change-product-row"><span class="change-product-label">${x.prevKey?shortDate(x.prevKey):'-'} 종가</span><span class="change-product-value">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span></div><div class="change-product-row"><span class="change-product-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가액</span><span class="change-product-value">${r.prevEval==null?'-':won(r.prevEval)}</span></div><div class="change-product-row"><span class="change-product-label">${shortDate(x.date)} 종가</span><span class="change-product-value">${fmt(r.price)}</span></div><div class="change-product-row"><span class="change-product-label">${shortDate(x.date)} 평가액</span><span class="change-product-value">${won(r.evalAmount)}</span></div><div class="change-product-row"><span class="change-product-label">일변동</span><span class="change-product-value ${cls(r.dayChange)}">${r.dayChange==null?'-':signed(r.dayChange)}</span></div></div>`).join('')}<div class="change-product-card"><div class="change-product-title">현금성자산</div><div class="change-product-row"><span class="change-product-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가액</span><span class="change-product-value">${won(x.prevPensionCash)}</span></div><div class="change-product-row"><span class="change-product-label">${shortDate(x.date)} 평가액</span><span class="change-product-value">${won(x.pensionCash)}</span></div><div class="change-product-row"><span class="change-product-label">일변동</span><span class="change-product-value ${cls(x.pensionCashDayChange)}">${signed(x.pensionCashDayChange)}</span></div></div></div>`:noPrevBlock;
  return `<section id="pension-section"><div class="section-title"><h2><span class="section-title-icon">💼</span>퇴직연금 현황</h2></div><div class="pension-band"><div class="grid cards" style="margin-top:0">${metricCard('퇴직연금 평가금액',won(x.pensionEval),`${basisText(x.date)}${x.date===kstTodayText()?' 추정':''} 평가금액`,true)}${metricCard('퇴직연금 납입원금',won(x.pensionPrincipal),pensionContributionSubText(x))}${metricCard('퇴직연금 운용수익',won(x.pensionProfit),'평가금액 - 납입원금',false,cls(x.pensionProfit))}${metricCard('퇴직연금 누적수익률',pct(x.pensionReturn),'퇴직연금 운용수익 ÷ 퇴직연금 납입원금',false,cls(x.pensionReturn))}</div><div class="grid two pension-detail-grid" style="margin-top:16px">${renderPensionProductsBlock(x,pensionCashCost,pensionHeldCost,pensionHeldProfit,pensionHeldReturn)}<div class="note pension-change-note" id="pension-change" ${mobileViewAttrs('pensionChange')}><div class="section-title"><h2><span class="section-title-icon">📈</span>전일 대비 변동</h2>${hasPrevPension?mobileViewToggle('pensionChange'):''}</div>${changeContent}</div></div>${renderPensionCharts(x)}</div></section>`;
}
function mobileTableProductName(name=''){
  const text=String(name||'');
  return text.startsWith('KODEX ')?`<span class="mobile-table-kodex-prefix">KODEX </span>${text.slice(6)}`:text;
}
function pensionRow(r,total){const w=total?r.evalAmount/total*100:0;return `<tr><td><strong>${mobileTableProductName(r.name)}</strong>${pensionProductSwatch(r.name)}</td><td class="num">${fmt(r.qty)}</td><td class="num">${fmt(r.qty?r.cost/r.qty:0)}</td><td class="num">${fmt(r.cost)}</td><td class="num">${fmt(r.evalAmount)}</td><td class="num ${cls(r.profit)}">${fmt(r.profit)}</td><td class="num ${cls(r.returnRate)}">${pct(r.returnRate)}</td><td><div class="bar-box"><div class="bar-fill ${r.barClass}" style="width:${Math.max(0,Math.min(100,w)).toFixed(1)}%"></div></div><div class="small">${w.toFixed(1)}%</div></td></tr>`}
function pensionCashRow(cash,total,cost=39408){const w=total?cash/total*100:0,profit=cash-cost,ret=cost?profit/cost*100:0;return `<tr><td><strong>현금성자산</strong></td><td class="num">1</td><td class="num">${fmt(cost)}</td><td class="num">${fmt(cost)}</td><td class="num">${fmt(cash)}</td><td class="num ${cls(profit)}">${fmt(profit)}</td><td class="num ${cls(ret)}">${pct(ret)}</td><td><div class="bar-box"><div class="bar-fill bar-gray" style="width:${w.toFixed(1)}%"></div></div><div class="small">${w.toFixed(1)}%</div></td></tr>`}

function pensionBarColorFromClass(barClass=''){
  const map={
    'bar-blue':'#2563eb',
    'bar-green':'#16a34a',
    'bar-amber':'#d97706',
    'bar-gray':'#94a3b8',
    'bar-purple':'#8b5cf6'
  };
  return map[String(barClass||'').trim()]||'#2563eb';
}
function isSafePensionAsset(name=''){return /(채권|현금|예금|MMF|RP|CMA|단기채)/.test(String(name));}
function getPensionDayContributionItems(x){
  if(x.pensionPrevEval==null)return [];
  const cashDelta=Number(x.pensionCashDayChange)||0;
  const items=[...x.pensionRows.map(r=>({name:r.name,value:Number(r.dayChange)||0,color:pensionBarColorFromClass(r.barClass)})),{name:'현금성자산',value:cashDelta,color:pensionBarColorFromClass('bar-gray')}]
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
      ? `<div class="pension-stack-bar compact simple">${items.map(item=>`<div class="pension-stack-segment has-tooltip" style="width:${Math.max(item.share,2).toFixed(2)}%;background:${item.color}"><span>${item.share>=8?item.name.replace('KODEX ',''):''}</span><div class="pension-viz-tooltip"><strong>${item.name}</strong><div>${item.share.toFixed(1)}%</div><div>${signed(item.value)}</div></div></div>`).join('')}</div>`
      : `<div class="pension-empty-state">상승한 자산이 없어 기여도를 표시하지 않습니다.</div>`;
  const riskTooltip=`위험자산 ${won(risk.riskEval)} / 안전자산 ${won(risk.safeEval)} / 기준 대비 ${risk.gap>0?'+':''}${risk.gap.toFixed(1)}%p`;
  return `<div class="pension-insight-zone"><div class="pension-insight-card compact-card"><div class="pension-insight-head simple"><h3>오늘 상승분 기여도</h3></div>${topHtml}</div><div class="pension-insight-card compact-card"><div class="pension-insight-head simple"><h3>위험자산 70% 룰</h3><span class="pension-insight-badge ${riskTone==='danger'?'danger':'safe'}">현재 ${risk.ratio.toFixed(1)}%</span></div><div class="pension-risk-gauge compact has-tooltip"><div class="pension-risk-fill ${riskTone==='danger'?'danger':'safe'}" style="width:${gaugeWidth.toFixed(1)}%"></div><div class="pension-risk-threshold" style="left:${risk.threshold}%"><span>${risk.threshold}%</span></div><div class="pension-viz-tooltip wide"><strong>위험자산 70% 룰</strong><div>${riskTooltip}</div></div></div><div class="pension-risk-scale"><span>0%</span><span>기준 ${risk.threshold}%</span><span>100%</span></div></div></div>`;
}
function renderCombined(x){
  const v=separateProfitView(x),returnLabel='투자대비 이익률',mobileReturnPct=n=>(Number(n)||0).toFixed(1)+'%';
  const cards=mobileInfoCard('퇴직연금',[
    ['투입원금',won(x.pensionPrincipal)],['투자 결과물',won(x.pensionEval)],['누적손익',won(x.pensionProfit),cls(x.pensionProfit)],['투자대비 이익률',pct(x.pensionReturn),cls(x.pensionReturn)]
  ])+mobileInfoCard('증권계좌',[
    ['투입원금',won(v.totalPrincipal)],['투자 결과물',won(v.totalResult)],['누적손익',won(v.totalProfit),cls(v.totalProfit)],[returnLabel,pct(v.totalReturn),cls(v.totalReturn)]
  ])+mobileInfoCard('합산',[
    ['투입원금',won(v.combinedPrincipal)],['투자 결과물',won(v.combinedResult)],['누적손익',won(v.combinedProfit),cls(v.combinedProfit)],[returnLabel,pct(v.combinedReturn),cls(v.combinedReturn)]
  ],'summary-card');
  return `<section id="summary-section" ${mobileViewAttrs('combined')}><div class="section-title"><h2><span class="section-title-icon">🏠</span>연금+계좌 성과</h2><div class="section-title-actions">${separateProfitControl(x,'section-inline')}${mobileViewToggle('combined')}</div></div><div class="mobile-scroll table-view"><table class="combined-performance-table"><thead><tr><th>구분</th><th>투입원금</th><th>투자 결과물</th><th>누적손익</th><th>${returnLabel}</th></tr></thead><tbody><tr><td><strong>퇴직연금</strong></td><td class="num">${fmt(x.pensionPrincipal)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${cls(x.pensionProfit)}">${fmt(x.pensionProfit)}<span class="combined-mobile-return ${cls(x.pensionReturn)}"> (${mobileReturnPct(x.pensionReturn)})</span></td><td class="num ${cls(x.pensionReturn)}">${pct(x.pensionReturn)}</td></tr><tr><td><strong>증권계좌</strong></td><td class="num">${fmt(v.totalPrincipal)}</td><td class="num">${fmt(v.totalResult)}</td><td class="num ${cls(v.totalProfit)}">${fmt(v.totalProfit)}<span class="combined-mobile-return ${cls(v.totalReturn)}"> (${mobileReturnPct(v.totalReturn)})</span></td><td class="num ${cls(v.totalReturn)}">${pct(v.totalReturn)}</td></tr><tr class="summary-row"><td>합산</td><td class="num">${fmt(v.combinedPrincipal)}</td><td class="num">${fmt(v.combinedResult)}</td><td class="num ${cls(v.combinedProfit)}">${fmt(v.combinedProfit)}<span class="combined-mobile-return ${cls(v.combinedReturn)}"> (${mobileReturnPct(v.combinedReturn)})</span></td><td class="num ${cls(v.combinedReturn)}">${pct(v.combinedReturn)}</td></tr></tbody></table></div><div class="mobile-card-view">${cards}</div></section>`;
}
function calcMdd(cum){
  if(!cum.length)return null;
  let peak=cum[0], maxDrop=0, from=cum[0].날짜, to=cum[0].날짜;
  for(const r of cum){
    if(r['합계 : 누적손익']>peak['합계 : 누적손익']) peak=r;
    const drop=r['합계 : 누적손익']-peak['합계 : 누적손익'];
    if(drop<maxDrop){maxDrop=drop;from=peak.날짜;to=r.날짜;}
  }
  return {drop:maxDrop,from,to};
}
function renderCharts(x){
  const cum=cumHistory(x.date),last=cum.at(-1),prevCum=cum.length>1?cum.at(-2):null,best=cum.reduce((a,b)=>b['합계 : 누적손익']>a['합계 : 누적손익']?b:a,cum[0]),
        bestDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']>a['합계 : 전일대비손익']?b:a,cum[0]),
        worstDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']<a['합계 : 전일대비손익']?b:a,cum[0]),
        mdd=calcMdd(cum),chartNames=securityChartNamesForDate(x.date),symbols=x.holdings.filter(h=>chartNames.includes(h.name)),orderedSymbols=sortSecurityChartItems(symbols),symbolTotal=symbols.reduce((a,h)=>a+h.profit,0),hasSymbolBuyFlow=orderedSymbols.some(h=>(Number(h?.tradeFlow?.buyAmount)||0)>0),
        lastProfit=last['합계 : 누적손익'], lastReturn=last['합계 : 누적수익률'],
        profitDelta=prevCum?lastProfit-prevCum['합계 : 누적손익']:0,
        returnDelta=prevCum?lastReturn-prevCum['합계 : 누적수익률']:0,
        bestGap=best['합계 : 누적손익']-lastProfit,
        bestDetail=bestGap===0?'금일 갱신':'금일 대비 '+signed(bestGap,'원');
  return `<section id="investment-analysis"><div class="section-title"><h2><span class="section-title-icon">🗓️</span>투자 기간 분석</h2><p>삼성증권1 기준</p></div><div class="grid chart-grid">
  <div class="chart-card" id="chart-cum"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">📊</span>누적손익 및 누적수익률</h3></div>${separateProfitControl(x,'chart-inline')}<div class="chart-head-actions">${chartCompareToggle('securities')}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="chartCum"></svg></div><div class="chart-legend"><span class="legend-item"><span class="swatch" style="background:#ffb84d"></span>누적손익</span><span class="legend-item"><span class="swatch" style="background:#a7d7a8"></span>전일대비손익</span><span class="legend-item"><span class="swatch" id="securitiesCompareSwatch" style="background:${CHART_COMPARE_MODES.securities==='kospi'?'#7c3aed':'#5abdf2'}"></span><span id="securitiesCompareLegend">${chartCompareLabel('securities')}</span></span></div><div class="chart-note six"><div class="mini-card"><div class="m-label">최종 누적손익</div><div class="m-value ${cls(lastProfit)}">${won(lastProfit)}</div><div class="m-detail ${cls(profitDelta)}">전일 대비 ${signed(profitDelta,'원')}</div></div><div class="mini-card"><div class="m-label">최종 누적수익률</div><div class="m-value ${cls(lastReturn)}">${pct(lastReturn)}</div><div class="m-detail ${cls(returnDelta)}">전일 대비 ${returnDelta>0?'+':''}${returnDelta.toFixed(2)}%p</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" onclick="jumpToChartDate('${best.날짜}','chart-cum')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();jumpToChartDate('${best.날짜}','chart-cum')}" title="${best.날짜} 기준으로 이동"><div class="m-label">최대 수익(${best.날짜})</div><div class="m-value ${cls(best['합계 : 누적손익'])}">${won(best['합계 : 누적손익'])}</div><div class="m-detail ${bestGap===0?'positive':''}">${bestDetail}</div></div><div class="mini-card"><div class="m-label">최대 낙폭</div><div class="m-value negative">${won(mdd.drop)}</div><div class="m-detail">${mdd.from} → ${mdd.to}</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" onclick="jumpToChartDate('${bestDay.날짜}','chart-cum')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();jumpToChartDate('${bestDay.날짜}','chart-cum')}" title="${bestDay.날짜} 기준으로 이동"><div class="m-label">Best(${bestDay.날짜})</div><div class="m-value positive">${signed(bestDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail positive">전일 대비 변화</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" onclick="jumpToChartDate('${worstDay.날짜}','chart-cum')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();jumpToChartDate('${worstDay.날짜}','chart-cum')}" title="${worstDay.날짜} 기준으로 이동"><div class="m-label">Worst(${worstDay.날짜})</div><div class="m-value negative">${signed(worstDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail negative">전일 대비 변화</div></div></div></div>
  <div class="chart-card" id="chart-symbol"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🧩</span>종목별 누적손익</h3></div><div class="chart-head-actions">${symbolChartToggle('securities')}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="chartSymbol"></svg></div><div class="chart-legend">${orderedSymbols.map(h=>`<span class="legend-item"><span class="swatch" style="background:${SECURITY_SYMBOL_COLORS[h.name]}"></span>${h.name}</span>`).join('')}</div><div class="chart-note symbol-summary-grid${orderedSymbols.length>=5?' five':''}">${orderedSymbols.map(h=>symbolCard(h,symbolTotal)).join('')}</div><div class="symbol-summary-note">${hasSymbolBuyFlow?'기여도 - 누적손익 합계 기준, 손익률 - 누적손익 ÷ 매입원금, 전일대비 변동률 - 전일대비 변동액 ÷ (전일 평가액 + 당일 매수금액)':'기여도 - 누적손익 합계 기준, 손익률 - 누적손익 ÷ 매입원금, 전일대비 변동률 - 전일대비 변동액 ÷ 전일의 평가금액'}</div></div>
  <div class="chart-card" id="chart-alloc"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🥧</span>평가액 비중</h3></div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="chartAlloc"></svg></div><div class="chart-legend"><span class="legend-item"><span class="swatch" style="background:#ff6b6b"></span>ETF</span><span class="legend-item"><span class="swatch" style="background:#ffc857"></span>개별주식</span><span class="legend-item"><span class="swatch" style="background:#8fd18f"></span>현금</span></div><div class="chart-note"><div class="mini-card"><div class="m-label">ETF${chartSeriesSwatch('#ff6b6b')}</div><div class="m-value">${won(x.etfEval)} <span class="small">(${(x.etfEval/x.allocTotal*100).toFixed(1)}%)</span></div></div><div class="mini-card"><div class="m-label">개별주식${chartSeriesSwatch('#ffc857')}</div><div class="m-value">${won(x.stockEval)} <span class="small">(${(x.stockEval/x.allocTotal*100).toFixed(1)}%)</span></div></div><div class="mini-card"><div class="m-label">현금${chartSeriesSwatch('#8fd18f')}</div><div class="m-value">${won(x.securitiesCash)} <span class="small">(${(x.securitiesCash/x.allocTotal*100).toFixed(1)}%)</span></div></div><div class="mini-card"><div class="m-label">현재 증권계좌 평가총액</div><div class="m-value">${won(x.allocTotal)}</div></div></div></div>
  </div></section>`;
}
function symbolCard(h,total){const contrib=total?h.profit/total*100:0,rr=h.cost?h.profit/h.cost*100:0,dayBase=(Number(h.prevEval)||0)+(Number(h?.tradeFlow?.buyAmount)||0),cr=dayBase?h.dayChange/dayBase*100:null;return `<div class="mini-card symbol-card"><div class="m-label">${h.name==='KODEX 200'?'KODEX 200':h.name}${securitySymbolSwatch(h.name)}</div><div class="m-value ${cls(h.profit)}">${won(h.profit)}</div><div class="symbol-metrics"><div class="symbol-metric"><span class="symbol-metric-label">기여도</span><span class="symbol-metric-value ${cls(contrib)}">${pct(contrib)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">손익률</span><span class="symbol-metric-value ${cls(rr)}">${rr>0?'+':''}${pct(rr)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동액</span><span class="symbol-metric-value ${cls(h.dayChange)}">${h.dayChange==null?'-':signed(h.dayChange,'원')}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동률</span><span class="symbol-metric-value ${cr==null?'':cls(cr)}">${cr==null?'-':((cr>0?'+':'')+pct(cr))}</span></div></div></div>`}

function pensionSnapshotDates(d){
  return allAvailableDates().filter(x=>x<=d&&hasPensionData(x));
}
function pensionCalcOn(date){
  return calc(date);
}
function pensionCumHistory(d){
  return pensionSnapshotDates(d).map(x=>{
    const v=pensionCalcOn(x);
    return {
      '날짜':x,
      '합계 : 누적손익':v.pensionProfit,
      '합계 : 누적수익률':v.pensionReturn,
      '코스피 지수':kospiIndexForDate(x),
      '합계 : 전일대비손익':0
    };
  }).map((row,i,arr)=>{
    row['합계 : 전일대비손익']=i===0?0:row['합계 : 누적손익']-arr[i-1]['합계 : 누적손익'];
    return row;
  });
}
function pensionSymbolHistory(d){
  return pensionSnapshotDates(d).map(x=>{
    const v=pensionCalcOn(x);
    const row={'날짜':x,'_rates':{}};
    v.pensionRows.forEach(r=>{
      const profit=Number(r.totalProfit ?? r.profit ?? 0);
      row[r.name]=profit;
      row._rates[r.name]=Number(r.cost)?profit/Number(r.cost)*100:0;
    });
    return row;
  });
}
function pensionAllocHistory(d){
  return pensionSnapshotDates(d).map(x=>{
    const v=pensionCalcOn(x), row={'날짜':x};
    v.pensionRows.forEach(r=>row[r.name]=Number(r.evalAmount||0));
    row['현금성자산']=Number(v.pensionCash||0);
    return row;
  });
}
function pensionProductCard(h,total){const contrib=total?h.profit/total*100:0,rr=h.cost?h.profit/h.cost*100:0,cr=h.prevEval?h.dayChange/h.prevEval*100:null;return `<div class="mini-card symbol-card"><div class="m-label">${h.name}${pensionProductSwatch(h.name)}</div><div class="m-value ${cls(h.profit)}">${won(h.profit)}</div><div class="symbol-metrics"><div class="symbol-metric"><span class="symbol-metric-label">기여도</span><span class="symbol-metric-value ${cls(contrib)}">${pct(contrib)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">수익률</span><span class="symbol-metric-value ${cls(rr)}">${rr>0?'+':''}${pct(rr)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동액</span><span class="symbol-metric-value ${cls(h.dayChange)}">${h.dayChange==null?'-':signed(h.dayChange,'원')}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동률</span><span class="symbol-metric-value ${cr==null?'':cls(cr)}">${cr==null?'-':((cr>0?'+':'')+pct(cr))}</span></div></div></div>`}
function renderPensionCharts(x){
  const cum=pensionCumHistory(x.date);
  if(!cum.length) return '';
  const last=cum.at(-1),prevCum=cum.length>1?cum.at(-2):null,best=cum.reduce((a,b)=>b['합계 : 누적손익']>a['합계 : 누적손익']?b:a,cum[0]),
        bestDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']>a['합계 : 전일대비손익']?b:a,cum[0]),
        worstDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']<a['합계 : 전일대비손익']?b:a,cum[0]),
        mdd=calcMdd(cum),
        symbols=x.pensionRows.map(r=>({...r,profit:Number(r.totalProfit ?? r.profit ?? 0),dayChange:r.dayChange})),
        symbolTotal=symbols.reduce((a,h)=>a+h.profit,0),
        lastProfit=last['합계 : 누적손익'], lastReturn=last['합계 : 누적수익률'],
        profitDelta=prevCum?lastProfit-prevCum['합계 : 누적손익']:0,
        returnDelta=prevCum?lastReturn-prevCum['합계 : 누적수익률']:0,
        bestGap=best['합계 : 누적손익']-lastProfit,
        bestDetail=bestGap===0?'금일 갱신':'금일 대비 '+signed(bestGap,'원');
  const productEvalTotal=x.pensionRows.reduce((a,r)=>a+r.evalAmount,0);
  const allocCards=x.pensionRows.map(r=>`<div class="mini-card"><div class="m-label">${r.name}${pensionProductSwatch(r.name)}</div><div class="m-value">${won(r.evalAmount)} <span class="small">(${(r.evalAmount/productEvalTotal*100).toFixed(1)}%)</span></div></div>`).join('');
  return `<section id="pension-investment-analysis" class="pension-chart-block"><div class="section-title"><h2><span class="section-title-icon">🗓️</span>투자 기간 분석</h2><p>퇴직연금 기준</p></div><div class="grid chart-grid">
  <div class="chart-card" id="pension-chart-cum"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">📊</span>운용수익 및 누적수익률 <span class="chart-title-sub">(전체 운용 기준)</span></h3></div><div class="chart-head-actions">${chartCompareToggle('pension')}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="pensionChartCum"></svg></div><div class="chart-legend"><span class="legend-item"><span class="swatch" style="background:#ffb84d"></span>운용수익</span><span class="legend-item"><span class="swatch" style="background:#a7d7a8"></span>전일대비손익</span><span class="legend-item"><span class="swatch" id="pensionCompareSwatch" style="background:${CHART_COMPARE_MODES.pension==='kospi'?'#7c3aed':'#5abdf2'}"></span><span id="pensionCompareLegend">${chartCompareLabel('pension')}</span></span></div><div class="chart-note six"><div class="mini-card"><div class="m-label">최종 운용수익</div><div class="m-value ${cls(lastProfit)}">${won(lastProfit)}</div><div class="m-detail ${cls(profitDelta)}">전일 대비 ${signed(profitDelta,'원')}</div></div><div class="mini-card"><div class="m-label">최종 누적수익률</div><div class="m-value ${cls(lastReturn)}">${pct(lastReturn)}</div><div class="m-detail ${cls(returnDelta)}">전일 대비 ${returnDelta>0?'+':''}${returnDelta.toFixed(2)}%p</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" onclick="jumpToChartDate('${best.날짜}','pension-chart-cum')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();jumpToChartDate('${best.날짜}','pension-chart-cum')}" title="${best.날짜} 기준으로 이동"><div class="m-label">최대 수익(${best.날짜})</div><div class="m-value ${cls(best['합계 : 누적손익'])}">${won(best['합계 : 누적손익'])}</div><div class="m-detail ${bestGap===0?'positive':''}">${bestDetail}</div></div><div class="mini-card"><div class="m-label">최대 낙폭</div><div class="m-value negative">${won(mdd.drop)}</div><div class="m-detail">${mdd.from} → ${mdd.to}</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" onclick="jumpToChartDate('${bestDay.날짜}','pension-chart-cum')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();jumpToChartDate('${bestDay.날짜}','pension-chart-cum')}" title="${bestDay.날짜} 기준으로 이동"><div class="m-label">Best(${bestDay.날짜})</div><div class="m-value positive">${signed(bestDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail positive">전일 대비 변화</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" onclick="jumpToChartDate('${worstDay.날짜}','pension-chart-cum')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();jumpToChartDate('${worstDay.날짜}','pension-chart-cum')}" title="${worstDay.날짜} 기준으로 이동"><div class="m-label">Worst(${worstDay.날짜})</div><div class="m-value negative">${signed(worstDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail negative">전일 대비 변화</div></div></div></div>
  <div class="chart-card" id="pension-chart-symbol"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🧩</span>연금상품별 운용수익 <span class="chart-title-sub">(보유상품 재투자 기준)</span></h3></div><div class="chart-head-actions">${symbolChartToggle('pension')}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="pensionChartSymbol"></svg></div><div class="chart-legend">${x.pensionRows.map(r=>`<span class="legend-item"><span class="swatch" style="background:${pensionSeriesColor(r.name)}"></span>${r.name}</span>`).join('')}</div><div class="chart-note symbol-summary-grid pension-symbol-summary-grid">${symbols.sort((a,b)=>Math.abs(b.profit)-Math.abs(a.profit)).map(h=>pensionProductCard(h,symbolTotal)).join('')}</div><div class="symbol-summary-note">기여도 - 운용수익 합계 기준, 수익률 - 운용수익 ÷ 매입원금, 전일대비 변동률 - 전일대비 변동액 ÷ 전일의 평가금액</div></div>
  <div class="chart-card" id="pension-chart-alloc"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🥧</span>평가액 비중</h3></div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="pensionChartAlloc"></svg></div><div class="chart-legend">${x.pensionRows.map(r=>`<span class="legend-item"><span class="swatch" style="background:${pensionSeriesColor(r.name)}"></span>${r.name}</span>`).join('')}<span class="legend-item"><span class="swatch" style="background:#8fd18f"></span>현금성자산</span></div><div class="chart-note">${allocCards}<div class="mini-card"><div class="m-label">현재 평가총액</div><div class="m-value">${won(x.pensionEval)}</div><div class="m-detail cash-include-detail">(현금성자산 ${won(x.pensionCash)} 포함)</div></div></div></div>
  </div></section>`;
}

function renderAccounts(x){
  const c=PORTFOLIO.constants,v=separateProfitView(x);
  const rows=[
    ['삼성증권1',v.account1Principal,v.account1Profit,v.account1Return,'2025-10-16 최초 시작.'],
    ...(x.account2Included?[['삼성증권2',c.account2Principal,c.account2Profit,c.account2Profit/c.account2Principal*100,'2023-12-20 최초 시작. 2026-05-22 전량 매도 후 실현분 반영.']]:[]),
    ['토스증권',0,c.tossProfit,0,'2026-03-09 매수 후 익일 매도. 3/23 이전 확정 실현수익이라 전 구간 포함.']
  ];
  const hiddenNote=x.account2Included?'':'<p class="table-note"><strong>참고:</strong> 삼성증권2는 2026-05-22 전량 매도 후 실현분 반영. 선택일이 2026-05-21 이전이면 당시 전체 성과 기준에서 제외되어 이 표에서도 숨김.</p>';
  const cards=rows.map(r=>mobileInfoCard(r[0],[
    ['투자원금',r[1]?won(r[1]):'-'],['누적손익',won(r[2]),cls(r[2])],['수익률',r[1]?pct(r[3]):'-',r[1]?cls(r[3]):''],['메모',r[4],'','stacked']
  ])).join('');
  return `<section id="accounts-summary" ${mobileViewAttrs('accounts')}><div class="section-title"><h2><span class="section-title-icon">📋</span>계좌별 성과 요약</h2><div class="section-title-actions">${separateProfitControl(x,'section-inline')}${mobileViewToggle('accounts')}</div></div><div class="mobile-scroll accounts-scroll table-view"><table class="accounts-table"><thead><tr><th class="accounts-name-head">구분</th><th>투자원금</th><th>누적손익</th><th>수익률</th><th>메모</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="accounts-name">${r[0]}</td><td class="num">${r[1]?fmt(r[1]):'-'}</td><td class="num ${cls(r[2])}">${fmt(r[2])}</td><td class="num ${cls(r[3])}">${r[1]?pct(r[3]):'-'}</td><td class="accounts-memo">${r[4]}</td></tr>`).join('')}</tbody></table></div><div class="mobile-card-view">${cards}</div>${hiddenNote}</section>`;
}
function renderSourceTables(x){
  const c=PORTFOLIO.constants,vipProfitReinvest=c.account2ReinvestedToAccount1-c.account2Principal,extraContribution=securityExternalContributionSum(x.date),excludedTransfer=securityExcludedTransferSum(x.date),baseAccount1Principal=account1PrincipalForDate(x.date),externalPrincipal=sourceExternalPrincipalForDate(x.date),reclassified=INCLUDE_SEPARATE_PROFIT?separateProfitReinvestedForDate(x.date):0,account1Principal=baseAccount1Principal-reclassified,extraRow=extraContribution?`<tr><td>추가 외부투입</td><td class="num">${fmt(extraContribution)}</td></tr>`:'',excludedRow=!INCLUDE_SEPARATE_PROFIT&&excludedTransfer?`<tr><td>기타 자금 투입</td><td class="num">${fmt(excludedTransfer)}</td></tr>`:'',reclassNote=INCLUDE_SEPARATE_PROFIT&&reclassified?`<div class="source-reclass-note"><strong>6~8월 별도수익 재투입 ${won(reclassified)}</strong><span>AI반도체 재투입분 · 투자원금 산정 제외</span></div>`:'';
  return `<section id="capital-source-check" class="capital-source-section"><div class="section-title source-title"><h2><span class="section-title-icon">🧾</span>투자원금 원천 및 검산</h2>${separateProfitControl(x,'section-inline')}</div><div class="grid three source-grid"><div class="card source-card"><div class="label">계좌1 원천별 투입</div><div class="value">${won(account1Principal)}</div><table style="font-size:12px;margin-top:12px;border-radius:12px"><tbody><tr><td>금 판매액 투입</td><td class="num">4,000,000</td></tr><tr><td>근로소득 투입</td><td class="num">7,036,104</td></tr><tr><td>임시자금 투입</td><td class="num">4,955,580</td></tr><tr><td>원금 회수</td><td class="num negative">-6,089,845</td></tr><tr><td>레버수익 재투입</td><td class="num">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr><td>VIP 재투입</td><td class="num">${fmt(c.account2ReinvestedToAccount1)}</td></tr>${excludedRow}${extraRow}<tr class="summary-row"><td>계좌1 투자원금</td><td class="num">${fmt(account1Principal)}</td></tr></tbody></table>${reclassNote}</div><div class="card source-card highlight"><div class="label">전체 투입원금</div><div class="value">${won(externalPrincipal)}</div><table style="font-size:12px;margin-top:12px;border-radius:12px"><tbody><tr><td>금 판매액 총액</td><td class="num">${fmt(c.goldPrincipal)}</td></tr><tr><td>근로소득 투입액</td><td class="num">${fmt(c.laborNetPrincipal)}</td></tr>${extraRow}<tr class="summary-row"><td>합계</td><td class="num">${fmt(externalPrincipal)}</td></tr></tbody></table></div><div class="card source-card"><div class="label">계좌1 투자원금 검산</div><div class="value">${won(account1Principal)}</div><table style="font-size:12px;margin-top:12px;border-radius:12px"><tbody><tr><td>전체 투입원금</td><td class="num">${fmt(externalPrincipal)}</td></tr><tr><td>레버수익 재투입</td><td class="num">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr><td>VIP 수익 재투입</td><td class="num">${fmt(vipProfitReinvest)}</td></tr>${excludedRow}<tr class="summary-row"><td>검산값</td><td class="num">${fmt(account1Principal)}</td></tr></tbody></table>${reclassNote}</div></div></section>`;
}

function clear(svg){while(svg.firstChild)svg.removeChild(svg.firstChild)}
function el(name, attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e}
function tooltip(){return document.getElementById('dashTooltip')}
function showTooltip(evt, html, kind=''){
  const tt=tooltip(); if(!tt) return;
  tt.dataset.tooltipKind=kind;
  tt.innerHTML=html; tt.classList.add('visible');
  const pad=14; tt.style.left=evt.clientX+'px'; tt.style.top=(evt.clientY-12)+'px';
  requestAnimationFrame(()=>{
    const rect=tt.getBoundingClientRect();
    let left=evt.clientX+12;
    let top=evt.clientY-rect.height-12;
    if(left+rect.width>window.innerWidth-pad)left=window.innerWidth-rect.width-pad;
    if(left<pad)left=pad;
    if(top<pad)top=evt.clientY+18;
    tt.style.left=left+'px'; tt.style.top=top+'px';
  });
}
function hideTooltip(){const tt=tooltip(); if(tt)tt.classList.remove('visible')}
function clearChartHover(){hideTooltip();document.querySelectorAll('.chart-hover-line').forEach(line=>line.setAttribute('opacity',0))}
function row(name,val,clsName=''){return `<div class="tt-row"><span class="tt-name">${name}</span><span class="tt-val ${clsName}">${val}</span></div>`}
function clsBy(n){return n<0?'tt-neg':(n>0?'tt-pos':'')}
function drawAxes(svg,cfg,yTicks,y2Ticks=null){
  const{w,h,l,r,t,b}=cfg;
  svg.appendChild(el('rect',{x:0,y:0,width:w,height:h,fill:'#fff'}));
  for(const tick of yTicks){const y=cfg.y(tick);svg.appendChild(el('line',{x1:l,y1:y,x2:w-r,y2:y,stroke:'#e5e7eb','stroke-width':1}));const tx=el('text',{x:l-10,y:y+4,'text-anchor':'end','font-size':11,fill:'#6b7280'});tx.textContent=cfg.yFormatter?cfg.yFormatter(tick):fmt(tick);svg.appendChild(tx)}
  svg.appendChild(el('line',{x1:l,y1:t,x2:l,y2:h-b,stroke:'#cbd5e1'}));
  svg.appendChild(el('line',{x1:l,y1:h-b,x2:w-r,y2:h-b,stroke:'#cbd5e1'}));
  if(y2Ticks){for(const tick of y2Ticks){const y=cfg.y2(tick);const tx=el('text',{x:w-r+10,y:y+4,'text-anchor':'start','font-size':11,fill:'#6b7280'});tx.textContent=cfg.y2Formatter?cfg.y2Formatter(tick):tick.toFixed(0)+'%';svg.appendChild(tx)}svg.appendChild(el('line',{x1:w-r,y1:t,x2:w-r,y2:h-b,stroke:'#cbd5e1'}))}
}

function chartX(cfg,dataLength,index){
  const plotW=cfg.w-cfg.l-cfg.r;
  const edge=Number(cfg.edgePad||0);
  if(dataLength<=1) return cfg.l+plotW/2;
  return cfg.l+edge+index*(plotW-edge*2)/(dataLength-1);
}

function labelDates(svg,cfg,data,every=3){
  const{h,b}=cfg;
  const labelY=h-b+16;
  data.forEach((d,i)=>{if(i%every===0||i===data.length-1){const x=chartX(cfg,data.length,i);const txt=el('text',{x:x,y:labelY,transform:`rotate(-65 ${x} ${labelY})`,'text-anchor':'end','font-size':10,fill:'#6b7280'});txt.textContent=d['날짜'];svg.appendChild(txt)}})
}
function polyline(svg,points,color,width=2.5){svg.appendChild(el('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'round'}))}
function circles(svg,points,color){points.forEach(p=>svg.appendChild(el('circle',{cx:p[0],cy:p[1],r:3,fill:'#fff',stroke:color,'stroke-width':2})))}
function nearestIndex(evt,svg,cfg,data){
  const pt=svg.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;
  const loc=pt.matrixTransform(svg.getScreenCTM().inverse());
  const plotW=cfg.w-cfg.l-cfg.r;
  const edge=Number(cfg.edgePad||0);
  const usable=Math.max(1,plotW-edge*2);
  let idx=Math.round((loc.x-cfg.l-edge)/usable*(data.length-1));
  return Math.max(0,Math.min(data.length-1,idx));
}
function addHover(svg,cfg,data,renderHtml,tooltipKind=''){
  const line=el('line',{x1:cfg.l,y1:cfg.t,x2:cfg.l,y2:cfg.h-cfg.b,stroke:'#334155','stroke-width':1.2,'stroke-dasharray':'4 4',opacity:0,class:'chart-hover-line'});
  svg.appendChild(line);
  const hit=el('rect',{x:cfg.l,y:cfg.t,width:cfg.w-cfg.l-cfg.r,height:cfg.h-cfg.t-cfg.b,class:'svg-hitbox'});
  svg.appendChild(hit);
  const show=evt=>{const idx=nearestIndex(evt,svg,cfg,data);const x=chartX(cfg,data.length,idx);line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('opacity',1);showTooltip(evt,renderHtml(data[idx],idx),tooltipKind)};
  hit.addEventListener('mousemove',show);
  hit.addEventListener('pointerdown',show);
  hit.addEventListener('mouseleave',()=>{line.setAttribute('opacity',0);hideTooltip()});
  svg.addEventListener('pointerdown',evt=>{if(evt.target!==hit)clearChartHover()});
}

function niceStep(rawStep){
  if(!Number.isFinite(rawStep)||rawStep<=0) return 1;
  const exp=Math.floor(Math.log10(rawStep));
  const base=Math.pow(10,exp);
  const f=rawStep/base;
  const nf=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;
  return nf*base;
}
function niceTickInfo(min,max,target=6,forceZero=false){
  let lo=Number.isFinite(min)?min:0, hi=Number.isFinite(max)?max:1;
  if(forceZero){lo=Math.min(lo,0);hi=Math.max(hi,0);}
  if(lo===hi){const pad=Math.max(1,Math.abs(hi)*.1);lo-=pad;hi+=pad;}
  const step=niceStep((hi-lo)/Math.max(2,target-1));
  const niceMin=Math.floor(lo/step)*step;
  const niceMax=Math.ceil(hi/step)*step;
  const ticks=[];
  for(let v=niceMin,i=0;v<=niceMax+step*.5&&i<20;v+=step,i++){
    const fixed=Math.abs(step)<1?Number(v.toFixed(2)):Math.round(v);
    ticks.push(fixed);
  }
  return {min:niceMin,max:niceMax,ticks};
}

function fixedTickInfo(min,max,step,forceZero=false){
  let lo=Number.isFinite(min)?min:0, hi=Number.isFinite(max)?max:step;
  if(forceZero){lo=Math.min(lo,0);hi=Math.max(hi,0);}
  if(lo===hi){lo-=step;hi+=step;}
  const niceMin=Math.floor(lo/step)*step;
  const niceMax=Math.ceil(hi/step)*step;
  const ticks=[];
  for(let v=niceMin,i=0;v<=niceMax+step*.5&&i<60;v+=step,i++){
    ticks.push(Math.round(v));
  }
  return {min:niceMin,max:niceMax,ticks};
}

function alignZeroTickRanges(firstInfo,firstStep,secondInfo,secondStep){
  const intervalCounts=(info,step)=>({
    below:Math.max(0,Math.round(-Math.min(0,info.min)/step)),
    above:Math.max(0,Math.round(Math.max(0,info.max)/step))
  });
  const first=intervalCounts(firstInfo,firstStep),second=intervalCounts(secondInfo,secondStep);
  const below=Math.max(first.below,second.below),above=Math.max(first.above,second.above);
  const build=step=>{
    const ticks=[];
    for(let i=-below,count=0;i<=above&&count<60;i++,count++) ticks.push(i*step);
    return {min:-below*step,max:above*step,ticks};
  };
  return [build(firstStep),build(secondStep)];
}

function pensionSeriesColor(name){
  const rows=PORTFOLIO?.pension||[];
  const idx=Math.max(0,rows.findIndex(r=>r.name===name));
  const palette=['#42a5f5','#8bc34a','#ffb84d','#8fd18f','#ab47bc','#26c6da'];
  return palette[idx%palette.length];
}
function drawPensionCumChart(){
  const data=pensionCumHistory(ACTIVE_DATE),svg=document.getElementById('pensionChartCum');if(!svg||!data.length)return;clear(svg);
  const mode=CHART_COMPARE_MODES.pension||'return';
  const profits=data.map(d=>d['합계 : 누적손익']),daily=data.map(d=>d['합계 : 전일대비손익']);
  const lineValues=data.map(d=>mode==='kospi'?d['코스피 지수']:d['합계 : 누적수익률']).filter(v=>Number.isFinite(v));
  let yInfo=fixedTickInfo(Math.min(...profits,...daily),Math.max(...profits,...daily),5000000,true);
  let rInfo=mode==='kospi'
    ? (lineValues.length?niceTickInfo(Math.min(...lineValues),Math.max(...lineValues),6,false):{min:0,max:1,ticks:[0,1]})
    : fixedTickInfo(Math.min(0,...lineValues),Math.max(25,...lineValues),25,true);
  if(mode!=='kospi') [yInfo,rInfo]=alignZeroTickRanges(yInfo,5000000,rInfo,25);
  const w=1120,h=330,l=82,rgt=72,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const plotW=w-l-rgt,n=data.length,barW=Math.max(8,plotW/Math.max(1,n)/3);
  const edgePad=Math.max(24,barW*2.1);
  const cfg={w,h,l,r:rgt,t,b,edgePad,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b),y2:v=>t+(rInfo.max-v)/(rInfo.max-rInfo.min)*(h-t-b),y2Formatter:mode==='kospi'?(v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})):(v=>v.toFixed(0)+'%')};
  drawAxes(svg,cfg,yInfo.ticks,rInfo.ticks);
  data.forEach((d,i)=>{
    const x=chartX(cfg,n,i),p=d['합계 : 누적손익'],dy=d['합계 : 전일대비손익'];
    const y0=cfg.y(0);
    [[p,'#ffb84d',-barW*.6],[dy,'#a7d7a8',barW*.6]].forEach(([v,color,off])=>{
      const y=cfg.y(v),hh=Math.abs(y0-y);
      svg.appendChild(el('rect',{x:x+off-barW/2,y:Math.min(y,y0),width:barW,height:hh,rx:3,fill:color,opacity:.9}));
    });
  });
  const lineColor=mode==='kospi'?'#7c3aed':'#5abdf2';
  const pts=data.map((d,i)=>({value:mode==='kospi'?d['코스피 지수']:d['합계 : 누적수익률'],point:[chartX(cfg,n,i),0]})).filter(v=>Number.isFinite(v.value)).map(v=>[v.point[0],cfg.y2(v.value)]);
  if(pts.length){polyline(svg,pts,lineColor,2.8);circles(svg,pts,lineColor)}
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{
    const lineValue=mode==='kospi'?(Number.isFinite(d['코스피 지수'])?formatKospi(d['코스피 지수']):'-'):((d['합계 : 누적수익률']>0?'+':'')+pct(d['합계 : 누적수익률']));
    const lineClass=mode==='kospi'?'':clsBy(d['합계 : 누적수익률']);
    return `<div class="tt-date">${d['날짜']}</div>${row('운용수익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']))}${row('전일대비손익',signed(d['합계 : 전일대비손익'],'원'),clsBy(d['합계 : 전일대비손익']))}${row(mode==='kospi'?'코스피 지수':'누적수익률',lineValue,lineClass)}`;
  });
}
function drawPensionSymbolChart(){
  const data=pensionSymbolHistory(ACTIVE_DATE),svg=document.getElementById('pensionChartSymbol');if(!svg||!data.length)return;clear(svg);
  const mode=SYMBOL_CHART_MODES.pension||'profit';
  const series=(PORTFOLIO.pension||[]).map(r=>r.name),valueOf=(d,s)=>mode==='rate'?Number(d._rates?.[s]||0):Number(d[s]||0),values=data.flatMap(d=>series.map(s=>valueOf(d,s)));
  const yInfo=mode==='rate'?niceTickInfo(Math.min(0,...values),Math.max(0,...values),6,true):fixedTickInfo(Math.min(...values),Math.max(...values),2000000,true),w=1120,h=330,l=82,r=25,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const cfg={w,h,l,r,t,b,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b),yFormatter:mode==='rate'?(v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+'%'):null};drawAxes(svg,cfg,yInfo.ticks);
  const plotW=w-l-r,n=data.length;series.forEach(name=>{const pts=data.map((d,i)=>[l+(n===1?0:i*plotW/(n-1)),cfg.y(valueOf(d,name))]);polyline(svg,pts,pensionSeriesColor(name));circles(svg,pts,pensionSeriesColor(name))});labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=`<div class="tt-date">${d['날짜']}</div>`;series.forEach(s=>{const rate=Number(d._rates?.[s]||0),value=mode==='rate'?`${rate>0?'+':''}${pct(rate)}`:`${signed(d[s]||0,'원')} (${rate>0?'+':''}${pct(rate)})`;html+=row(s,value,clsBy(mode==='rate'?rate:(d[s]||0)))});if(mode==='rate')return html;const total=series.reduce((a,s)=>a+(d[s]||0),0);return html+'<div style="height:6px"></div>'+row('상품 합계',signed(total,'원'),clsBy(total))},'symbol');
}

function drawPensionStacked(){
  const data=pensionAllocHistory(ACTIVE_DATE),svg=document.getElementById('pensionChartAlloc');if(!svg||!data.length)return;clear(svg);
  const series=[...(PORTFOLIO.pension||[]).map(r=>r.name),'현금성자산'],colors=Object.fromEntries(series.map(s=>[s,s==='현금성자산'?'#8fd18f':pensionSeriesColor(s)])),totals=data.map(d=>series.reduce((a,s)=>a+(d[s]||0),0));
  const yInfo=fixedTickInfo(0,Math.max(1,...totals),10000000,true),w=1120,h=330,l=82,r=25,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const plotW=w-l-r,n=data.length,barW=Math.max(10,plotW/Math.max(1,n)*.55);
  const edgePad=Math.max(24,barW*.62);
  const cfg={w,h,l,r,t,b,edgePad,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b)};drawAxes(svg,cfg,yInfo.ticks);
  data.forEach((d,i)=>{let acc=0;const x=chartX(cfg,n,i)-barW/2;series.forEach(s=>{const v=d[s]||0,y1=cfg.y(acc+v),y0=cfg.y(acc);svg.appendChild(el('rect',{x,y:y1,width:barW,height:Math.max(0,y0-y1),fill:colors[s],rx:2}));acc+=v})});
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=`<div class="tt-date">${d['날짜']}</div>`;let total=series.reduce((a,s)=>a+(d[s]||0),0);series.forEach(s=>html+=row(s,won(d[s]||0),''));return html+'<div style="height:6px"></div>'+row('평가총액',won(total),'')});
}

function drawCumChart(){
  const data=cumHistory(ACTIVE_DATE),svg=document.getElementById('chartCum');if(!svg||!data.length)return;clear(svg);
  const mode=CHART_COMPARE_MODES.securities||'return';
  const w=1120,h=330,l=70,r=76,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const vals=data.flatMap(d=>[d['합계 : 누적손익'],d['합계 : 전일대비손익']]);
  const lineValues=data.map(d=>mode==='kospi'?d['코스피 지수']:d['합계 : 누적수익률']).filter(v=>Number.isFinite(v));
  let yInfo=fixedTickInfo(Math.min(-4000000,...vals),Math.max(12000000,...vals),2000000,true);
  let rInfo=mode==='kospi'
    ? (lineValues.length?niceTickInfo(Math.min(...lineValues),Math.max(...lineValues),6,false):{min:0,max:1,ticks:[0,1]})
    : {min:-40,max:120,ticks:[-40,-20,0,20,40,60,80,100,120]};
  if(mode!=='kospi'){
    const yStep=2000000;
    const below=Math.max(1,Math.round(-Math.min(0,yInfo.min)/yStep),Math.ceil(Math.max(0,yInfo.max)/yStep/3));
    const above=below*3,ticks=[];
    for(let i=-below;i<=above;i++) ticks.push(i*yStep);
    yInfo={min:-below*yStep,max:above*yStep,ticks};
  }
  const plotW=w-l-r,n=data.length,gap=plotW/Math.max(n,1),bw=gap*.28;
  const edgePad=Math.max(24,bw*2.1);
  const cfg={w,h,l,r,t,b,edgePad,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b),y2:v=>t+(rInfo.max-v)/(rInfo.max-rInfo.min)*(h-t-b),y2Formatter:mode==='kospi'?(v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})):(v=>v.toFixed(0)+'%')};
  drawAxes(svg,cfg,yInfo.ticks,rInfo.ticks);
  data.forEach((d,i)=>{const x=chartX(cfg,n,i),zero=cfg.y(0),cp=cfg.y(d['합계 : 누적손익']);svg.appendChild(el('rect',{x:x-bw-1,y:Math.min(cp,zero),width:bw,height:Math.abs(zero-cp),fill:'#ffb84d',opacity:.8}));const day=cfg.y(d['합계 : 전일대비손익']);svg.appendChild(el('rect',{x:x+2,y:Math.min(day,zero),width:bw,height:Math.abs(zero-day),fill:d['합계 : 전일대비손익']>=0?'#a7d7a8':'#c7e6c8',stroke:d['합계 : 전일대비손익']<0?'#86b58a':'none',opacity:.9}))});
  const lineColor=mode==='kospi'?'#7c3aed':'#5abdf2';
  const pts=data.map((d,i)=>({value:mode==='kospi'?d['코스피 지수']:d['합계 : 누적수익률'],x:chartX(cfg,n,i)})).filter(v=>Number.isFinite(v.value)).map(v=>[v.x,cfg.y2(v.value)]);
  if(pts.length){polyline(svg,pts,lineColor,2.5);circles(svg,pts,lineColor)}
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{
    const lineValue=mode==='kospi'?(Number.isFinite(d['코스피 지수'])?formatKospi(d['코스피 지수']):'-'):pct(d['합계 : 누적수익률']);
    let html=`<div class="tt-date">${d['날짜']}</div>`;
    if(INCLUDE_SEPARATE_PROFIT){
      html+=row('전체 누적손익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']));
      html+=row('기존 포트 손익',signed(d['_기존포트누적손익'],'원'),clsBy(d['_기존포트누적손익']));
      html+=row('6~8월 별도수익',signed(d['_별도수익누적'],'원'),clsBy(d['_별도수익누적']));
      html+=row('성과기준 투입원금',won(d['_성과기준투입원금']));
    }else{
      html+=row('누적손익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']));
    }
    html+=row(mode==='kospi'?'코스피 지수':'누적수익률',lineValue,mode==='kospi'?'':clsBy(d['합계 : 누적수익률']));
    html+=row('전일대비손익',signed(d['합계 : 전일대비손익'],'원'),clsBy(d['합계 : 전일대비손익']));
    return html;
  });
}
function drawLineChart(){
  const data=symbolHistory(ACTIVE_DATE),svg=document.getElementById('chartSymbol');if(!svg)return;clear(svg);
  const mode=SYMBOL_CHART_MODES.securities||'profit';
  const current=calc(ACTIVE_DATE),activeNames=new Set(securityChartNamesForDate(ACTIVE_DATE)),series=sortSecurityChartItems(current.holdings.filter(h=>activeNames.has(h.name))).map(h=>h.name),colors=SECURITY_SYMBOL_COLORS,valueOf=(d,s)=>{const value=mode==='rate'?d._rates?.[s]:d[s];return value==null?null:Number(value);},values=data.flatMap(d=>series.map(s=>valueOf(d,s))).filter(Number.isFinite);
  const w=1120,h=330,l=70,r=25,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  if(mode==='rate'){
    const yInfo=niceTickInfo(Math.min(0,...values),Math.max(0,...values),6,true),cfg={w,h,l,r,t,b,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b),yFormatter:v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+'%'};drawAxes(svg,cfg,yInfo.ticks);
    const plotW=w-l-r,n=data.length;series.forEach(s=>{const pts=data.map((d,i)=>{const value=valueOf(d,s);return Number.isFinite(value)?[l+(n===1?0:i*plotW/(n-1)),cfg.y(value)]:null}).filter(Boolean);if(pts.length){polyline(svg,pts,colors[s]);circles(svg,pts,colors[s])}});labelDates(svg,cfg,data,3);
    addHover(svg,cfg,data,d=>{let html=`<div class="tt-date">${d['날짜']}</div>`;series.forEach(s=>{const rate=valueOf(d,s);if(!Number.isFinite(rate))return;html+=row(s,`${rate>0?'+':''}${pct(rate)}`,clsBy(rate))});return html},'symbol');
    return;
  }
  const minY=Math.min(-1000000,...values),maxY=Math.max(7000000,...values),cfg={w,h,l,r,t,b,y:v=>t+(maxY-v)/(maxY-minY)*(h-t-b)};drawAxes(svg,cfg,[-1000000,0,1000000,2000000,3000000,4000000,5000000,6000000,7000000]);
  const plotW=w-l-r,n=data.length;series.forEach(s=>{const pts=data.map((d,i)=>{const value=valueOf(d,s);return Number.isFinite(value)?[l+(n===1?0:i*plotW/(n-1)),cfg.y(value)]:null}).filter(Boolean);if(pts.length){polyline(svg,pts,colors[s]);circles(svg,pts,colors[s])}});labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=`<div class="tt-date">${d['날짜']}</div>`;series.forEach(s=>{const value=valueOf(d,s),rate=d._rates?.[s];if(!Number.isFinite(value))return;html+=row(s,`${signed(value,'원')} (${Number(rate)>0?'+':''}${pct(rate)})`,clsBy(value))});const total=series.reduce((a,s)=>{const value=valueOf(d,s);return a+(Number.isFinite(value)?value:0)},0);return html+'<div style="height:6px"></div>'+row(`${series.length}종목 합계`,signed(total,'원'),clsBy(total))},'symbol');
}
function drawStacked(){
  const data=allocHistory(ACTIVE_DATE),svg=document.getElementById('chartAlloc');if(!svg)return;clear(svg);
  const values=data.map(d=>d.ETF+d.개별주식+d.현금),maxY=Math.max(30000000,...values)*1.05,w=1120,h=330,l=70,r=25,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const plotW=w-l-r,n=data.length,gap=plotW/Math.max(n,1),bw=gap*.72;
  const edgePad=Math.max(24,bw*.62);
  const cfg={w,h,l,r,t,b,edgePad,y:v=>t+(maxY-v)/(maxY)*(h-t-b)};drawAxes(svg,cfg,[0,5000000,10000000,15000000,20000000,25000000,30000000]);
  data.forEach((d,i)=>{const x=chartX(cfg,n,i)-bw/2;let base=0;[['ETF','#ff6b6b'],['개별주식','#ffc857'],['현금','#8fd18f']].forEach(([key,color])=>{const yTop=cfg.y(base+d[key]),yBase=cfg.y(base);svg.appendChild(el('rect',{x:x,y:yTop,width:bw,height:yBase-yTop,fill:color,opacity:.75,stroke:'#fff','stroke-width':.4}));base+=d[key]})});
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{const total=d.ETF+d.개별주식+d.현금;return `<div class="tt-date">${d['날짜']}</div>`+row('ETF',fmt(d.ETF)+`원 (${(d.ETF/total*100).toFixed(1)}%)`)+row('개별주식',fmt(d.개별주식)+`원 (${(d.개별주식/total*100).toFixed(1)}%)`)+row('현금',fmt(d.현금)+`원 (${(d.현금/total*100).toFixed(1)}%)`)+'<div style="height:6px"></div>'+row('합계',fmt(total)+'원')});
}
function refreshScrollHints(){
  document.querySelectorAll('.scroll-hint').forEach(el=>el.remove());
  document.querySelectorAll('.mobile-scroll, .chart-wrap').forEach(wrap=>{
    const scrollable=wrap.scrollWidth>wrap.clientWidth+4;
    wrap.classList.toggle('is-scrollable',scrollable);
    if(wrap.classList.contains('chart-wrap')){
      wrap.closest('.chart-card')?.classList.toggle('has-horizontal-scroll',scrollable);
    }
  });
}
function drawAllCharts(){
  drawCumChart();
  drawLineChart();
  drawStacked();
  drawPensionCumChart();
  drawPensionSymbolChart();
  drawPensionStacked();
  setupResponsiveChartControls();
  document.querySelectorAll('svg.chart').forEach(prepareChartEntranceForSvg);
  setupChartEntranceAnimations();
  refreshScrollHints();
  setTimeout(refreshScrollHints,120);
}



function openPensionContributionModal(){
  const modal=document.getElementById('pensionContribModal');
  if(!modal) return;
  document.body.classList.add('contrib-modal-open');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  setPensionContributionTarget('cashSnapshot');
  syncPensionBatchModeUi();
  document.activeElement?.blur?.();
}
function closePensionContributionModal(){
  const modal=document.getElementById('pensionContribModal');
  if(!modal) return;
  if(modal.contains(document.activeElement)){
    document.activeElement.blur();
  }
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('contrib-modal-open');
  const trigger=document.querySelector('.date-tool-btn');
  if(trigger) trigger.focus({preventScroll:true});
  forceMobileViewportReflow();
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  closeCompactActionMenu();
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
    PENSION_CASH_SNAPSHOTS=Array.isArray(PENSION_CASH_SNAPSHOTS)?next:{...(PENSION_CASH_SNAPSHOTS||{}),snapshots:next};
    return;
  }
  if(target==='etfTrade'){
    if(!item.id) return;
    const next=rawPensionTradeItems().filter(v=>String(v?.id||'')!==String(item.id));
    next.push(item);
    PENSION_TRADES=Array.isArray(PENSION_TRADES)?next:{...(PENSION_TRADES||{}),trades:next};
    return;
  }
  if(!item.id) return;
  const next=rawPensionContributionItems().filter(v=>String(v?.id||'')!==String(item.id));
  next.push(item);
  PENSION_CONTRIBUTIONS=Array.isArray(PENSION_CONTRIBUTIONS)?next:{...(PENSION_CONTRIBUTIONS||{}),contributions:next};
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
    PENSION_CASH_SNAPSHOTS=Array.isArray(PENSION_CASH_SNAPSHOTS)?next:{...(PENSION_CASH_SNAPSHOTS||{}),snapshots:next};
    return;
  }
  if(target==='etfTrade'){
    const next=rawPensionTradeItems().filter(v=>String(v?.id||'')!==String(key));
    PENSION_TRADES=Array.isArray(PENSION_TRADES)?next:{...(PENSION_TRADES||{}),trades:next};
    return;
  }
  const next=rawPensionContributionItems().filter(v=>String(v?.id||'')!==String(key));
  PENSION_CONTRIBUTIONS=Array.isArray(PENSION_CONTRIBUTIONS)?next:{...(PENSION_CONTRIBUTIONS||{}),contributions:next};
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
  const tradeHelp=document.getElementById('pensionEtfTradeHelp');
  if(standardFields){
    standardFields.hidden=target==='etfTrade';
    standardFields.classList.toggle('cash-mode',target==='cashSnapshot');
  }
  if(tradeFields) tradeFields.hidden=target!=='etfTrade';
  if(tradeHelp) tradeHelp.hidden=target!=='etfTrade';

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
      ?'잘못 넣은 현금성자산 기록을 선택 후 삭제합니다.'
      :(target==='contribution'
        ?'잘못 넣은 기업적립금을 선택 후 삭제합니다.'
        :'잘못 등록한 추가 매수 거래를 선택 후 삭제합니다.');
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
  const product=(PORTFOLIO?.pension||[]).find(v=>String(v.ticker)===ticker)||null;
  return {tradeDate,ticker,qtyRaw,amountRaw,qty,amount,applyDate,product};
}
function pensionEtfTradeExpected(draft=pensionEtfTradeDraft()){
  const {applyDate,product,qty,amount}=draft;
  if(!product||!Number.isFinite(qty)||qty<=0||!Number.isFinite(amount)||amount<=0) return null;
  const batchState=PENSION_BATCH_MODE?pensionBatchCurrentState():null;
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
  PENSION_BATCH_LAST_ADD_FINGERPRINT='';
  PENSION_BATCH_LAST_ADD_AT=0;
  updatePensionEtfTradePreview();
  const queuedCount=PENSION_BATCH_QUEUE.length;
  showPensionContributionStatus(queuedCount
    ? `입력값과 삭제 선택을 초기화했습니다. 작업 모음 ${queuedCount}건은 유지됩니다.`
    : '입력값과 삭제 선택을 초기화했습니다.','ok');
  document.activeElement?.blur?.();
}

function requestPensionActionPin({title='PIN 입력',description='저장/삭제를 계속하려면 PIN을 입력하세요.',danger=false,execute}={}){
  return new Promise(resolve=>{
    const old=document.getElementById('pensionActionPinModal');
    if(old) old.remove();

    const modal=document.createElement('div');
    modal.id='pensionActionPinModal';
    modal.className='pension-action-pin-modal';
    modal.innerHTML=`<div class="pension-action-pin-card" role="dialog" aria-modal="true" aria-labelledby="pensionActionPinTitle">
      <button type="button" class="pension-action-pin-close" aria-label="닫기">×</button>
      <div class="pension-action-pin-icon">${danger?'🗑️':'🔐'}</div>
      <h3 id="pensionActionPinTitle">${title}</h3>
      <p>${description}</p>
      <label for="pensionActionPinInput">PIN</label>
      <input id="pensionActionPinInput" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN 6자리 입력">
      <div class="pension-action-pin-guide">PIN이 일치하면 자동으로 ${danger?'삭제':'저장'} 실행됩니다.</div>
      <div id="pensionActionPinStatus" class="pension-action-pin-status" aria-live="polite"></div>
      <div class="pension-action-pin-buttons"><button type="button" class="ghost">취소</button></div>
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
      resolve(value);
    };
    const submit=async()=>{
      const pin=String(input?.value||'').replace(/\D/g,'').slice(0,6);
      if(pin.length!==6||busy)return;
      busy=true;
      input.disabled=true;
      if(status){status.textContent='PIN 확인 및 처리 중...';status.className='pension-action-pin-status checking'}
      try{
        const result=typeof execute==='function'?await execute(pin):pin;
        finish(result);
      }catch(e){
        if(status){status.textContent=e.message||String(e);status.className='pension-action-pin-status err'}
        input.disabled=false;
        input.value='';
        busy=false;
        requestAnimationFrame(()=>input.focus());
      }
    };
    const onInput=()=>{
      const cleaned=String(input.value||'').replace(/\D/g,'').slice(0,6);
      if(input.value!==cleaned)input.value=cleaned;
      if(status&&status.classList.contains('err')){status.textContent='';status.className='pension-action-pin-status'}
      clearTimeout(submitTimer);
      if(cleaned.length===6)submitTimer=setTimeout(submit,180);
    };

    input?.addEventListener('input',onInput);
    input?.addEventListener('keydown',e=>{if(e.key==='Enter')submit();if(e.key==='Escape')finish(null)});
    cancel?.addEventListener('click',()=>finish(null));
    close?.addEventListener('click',()=>finish(null));
    modal.addEventListener('click',e=>{if(e.target===modal)finish(null)});

    document.body.appendChild(modal);
    requestAnimationFrame(()=>input?.focus());
  });
}


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
function pensionBatchSimulate(operations=PENSION_BATCH_QUEUE){
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

    const product=(PORTFOLIO?.pension||[]).find(v=>String(v.ticker)===String(item.ticker));
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
  try{return pensionBatchSimulate(PENSION_BATCH_QUEUE).state}catch(_){return null}
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
  if(panel)panel.hidden=!PENSION_BATCH_MODE;
  if(count)count.textContent=`${PENSION_BATCH_QUEUE.length}건`;
  if(badge){badge.textContent=String(PENSION_BATCH_QUEUE.length);badge.hidden=PENSION_BATCH_QUEUE.length===0}
  if(clear)clear.disabled=PENSION_BATCH_QUEUE.length===0;
  if(list){
    list.innerHTML=PENSION_BATCH_QUEUE.length?PENSION_BATCH_QUEUE.map((op,index)=>`<div class="pension-batch-item"><div class="pension-batch-index">${index+1}</div><div class="pension-batch-item-text">${escapeHtml(pensionBatchOperationDescription(op))}</div><div class="pension-batch-item-actions"><button type="button" onclick="movePensionBatchOperation('${op.qid}',-1)" aria-label="위로" ${index===0?'disabled':''}>↑</button><button type="button" onclick="movePensionBatchOperation('${op.qid}',1)" aria-label="아래로" ${index===PENSION_BATCH_QUEUE.length-1?'disabled':''}>↓</button><button type="button" class="remove" onclick="removePensionBatchOperation('${op.qid}')" aria-label="작업 제거">×</button></div></div>`).join(''):'<div class="pension-batch-empty">아직 추가된 작업이 없습니다.</div>';
  }
  let error='';let reordered=false;
  if(PENSION_BATCH_QUEUE.length){
    try{const simulated=pensionBatchSimulate(PENSION_BATCH_QUEUE);reordered=simulated.reordered}catch(e){error=e.message||String(e)}
  }
  if(note){
    if(error){note.hidden=false;note.className='pension-batch-order-note error';note.textContent=error}
    else if(reordered){note.hidden=false;note.className='pension-batch-order-note';note.textContent='연결된 현금성자산 삭제가 필요한 작업은 안전한 순서로 자동 조정해 일괄 처리합니다.'}
    else{note.hidden=true;note.textContent='';note.className='pension-batch-order-note'}
  }
  if(apply){
    apply.disabled=PENSION_BATCH_QUEUE.length===0||!!error||PENSION_BATCH_APPLYING;
    apply.textContent=PENSION_BATCH_APPLYING?'처리 중...':(PENSION_BATCH_QUEUE.length?`${PENSION_BATCH_QUEUE.length}건 일괄 적용`:'일괄 적용');
  }
}
function syncPensionBatchModeUi(){
  document.querySelectorAll('.pension-work-mode-btn').forEach(btn=>btn.classList.toggle('active',(btn.dataset.mode==='batch')===PENSION_BATCH_MODE));
  const save=document.getElementById('pensionContribSaveButton');
  const del=document.getElementById('pensionContribDeleteButton');
  if(save)save.textContent=PENSION_BATCH_MODE?'작업 모음에 추가':'저장';
  if(del)del.textContent=PENSION_BATCH_MODE?'삭제 작업 추가':'선택 항목 삭제';
  renderPensionBatchQueue();
}
function setPensionBatchMode(enabled){
  PENSION_BATCH_MODE=!!enabled;
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
  PENSION_BATCH_REQUEST_ID='';
}
function getPensionBatchRequestId(){
  if(PENSION_BATCH_REQUEST_ID)return PENSION_BATCH_REQUEST_ID;
  const uuid=(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
  PENSION_BATCH_REQUEST_ID=`pension-batch-${uuid}`;
  return PENSION_BATCH_REQUEST_ID;
}
function addPensionBatchOperation(operation){
  const now=Date.now();
  const fingerprint=pensionBatchOperationFingerprint(operation);
  if(fingerprint&&fingerprint===PENSION_BATCH_LAST_ADD_FINGERPRINT&&now-PENSION_BATCH_LAST_ADD_AT<800)throw new Error('동일한 작업이 방금 추가되었습니다. 중복 클릭은 반영하지 않았습니다.');
  const op={...operation,qid:`batch-${now}-${++PENSION_BATCH_SEQUENCE}`,tempId:`batch-temp-${now}-${PENSION_BATCH_SEQUENCE}`};
  if(op.action==='delete'&&PENSION_BATCH_QUEUE.some(v=>v.action==='delete'&&v.target===op.target&&String(v.key)===String(op.key)))throw new Error('이미 작업 모음에 추가된 삭제 항목입니다.');
  PENSION_BATCH_QUEUE.push(op);
  PENSION_BATCH_LAST_ADD_FINGERPRINT=fingerprint;
  PENSION_BATCH_LAST_ADD_AT=now;
  resetPensionBatchRequestId();
  clearPensionContributionStatus('pensionBatchStatus');
  renderPensionBatchQueue();
  return op;
}
function removePensionBatchOperation(qid){
  PENSION_BATCH_QUEUE=PENSION_BATCH_QUEUE.filter(v=>v.qid!==qid);
  PENSION_BATCH_LAST_ADD_FINGERPRINT='';
  PENSION_BATCH_LAST_ADD_AT=0;
  resetPensionBatchRequestId();
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
}
function movePensionBatchOperation(qid,direction){
  const index=PENSION_BATCH_QUEUE.findIndex(v=>v.qid===qid);
  const next=index+Number(direction||0);
  if(index<0||next<0||next>=PENSION_BATCH_QUEUE.length)return;
  const [item]=PENSION_BATCH_QUEUE.splice(index,1);
  PENSION_BATCH_QUEUE.splice(next,0,item);
  resetPensionBatchRequestId();
  renderPensionBatchQueue();
  updatePensionEtfTradePreview();
}
function clearPensionBatchQueue(){
  PENSION_BATCH_QUEUE=[];
  PENSION_BATCH_LAST_ADD_FINGERPRINT='';
  PENSION_BATCH_LAST_ADD_AT=0;
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
  PENSION_CASH_SNAPSHOTS=Array.isArray(PENSION_CASH_SNAPSHOTS)?(state.cashSnapshots||[]):{...(PENSION_CASH_SNAPSHOTS||{}),snapshots:state.cashSnapshots||[]};
  PENSION_CONTRIBUTIONS=Array.isArray(PENSION_CONTRIBUTIONS)?(state.contributions||[]):{...(PENSION_CONTRIBUTIONS||{}),contributions:state.contributions||[]};
  PENSION_TRADES=Array.isArray(PENSION_TRADES)?(state.trades||[]):{...(PENSION_TRADES||{}),trades:state.trades||[]};
}
async function applyPensionBatchQueue(){
  if(PENSION_BATCH_APPLYING)return;
  if(!PENSION_BATCH_QUEUE.length){showPensionBatchStatus('적용할 작업이 없습니다.','err');return}
  let simulated;
  try{simulated=pensionBatchSimulate(PENSION_BATCH_QUEUE)}catch(e){showPensionBatchStatus(e.message||String(e),'err');return}
  const count=PENSION_BATCH_QUEUE.length;
  const batchRequestId=getPensionBatchRequestId();
  PENSION_BATCH_APPLYING=true;
  renderPensionBatchQueue();
  try{
    showPensionBatchStatus('PIN 입력 대기 중...','ok');
    const data=await requestPensionActionPin({
      title:'작업 모음 일괄 적용',
      description:`저장·삭제 ${count}건을 검증한 뒤 GitHub 한 커밋으로 반영합니다. 하나라도 실패하면 아무것도 저장하지 않습니다.`,
      execute:pin=>savePensionBatchViaGithubPages(simulated.orderedOperations,pin,batchRequestId)
    });
    if(!data){showPensionBatchStatus('일괄 적용이 취소되었습니다.','err');return}
    const duplicateWithoutState=!!data.duplicate&&!data.state;
    if(!duplicateWithoutState)applyPensionBatchStateLocally(data.state);
    PENSION_BATCH_QUEUE=[];
    PENSION_BATCH_LAST_ADD_FINGERPRINT='';
    PENSION_BATCH_LAST_ADD_AT=0;
    resetPensionBatchRequestId();
    PENSION_BATCH_MODE=true;
    render();
    openPensionContributionModal();
    setPensionBatchMode(true);
    showPensionBatchStatus(duplicateWithoutState
      ?'동일한 작업 모음은 이미 서버에서 반영 완료되었습니다. 중복 커밋은 만들지 않았습니다. Pages 반영 후 새로고침하면 최신 값이 표시됩니다.'
      :`${count}건 일괄 적용 완료. GitHub에는 한 커밋으로 반영했습니다. Pages 배포까지 잠시 걸릴 수 있습니다.`,'ok');
    showPensionMobileToast(duplicateWithoutState
      ?`작업 모음 ${count}건 이미 반영 완료`
      :`작업 모음 ${count}건 적용 완료`,'ok');
  }finally{
    PENSION_BATCH_APPLYING=false;
    renderPensionBatchQueue();
  }
}

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
    if(PENSION_BATCH_MODE&&pensionContributionTarget()==='etfTrade'){
      const qtyRaw=String(document.getElementById('pensionEtfTradeQty')?.value||'').trim();
      const amountRaw=String(document.getElementById('pensionEtfTradeAmount')?.value||'').trim();
      const last=PENSION_BATCH_QUEUE.at(-1);
      if(!qtyRaw&&!amountRaw&&last?.action==='upsert'&&last?.target==='etfTrade'&&Date.now()-PENSION_BATCH_LAST_ADD_AT<800){
        throw new Error('동일한 작업이 방금 추가되었습니다. 중복 클릭은 반영하지 않았습니다.');
      }
    }
    const item=buildPensionContributionItem();
    if(out){out.textContent=JSON.stringify(item,null,2);out.classList.add('show')}
    const targetText=pensionContributionTargetLabel(item.target);
    if(PENSION_BATCH_MODE){
      addPensionBatchOperation({action:'upsert',target:item.target,item});
      if(item.target==='etfTrade'){
        const qtyEl=document.getElementById('pensionEtfTradeQty');
        const amountEl=document.getElementById('pensionEtfTradeAmount');
        if(qtyEl)qtyEl.value='';
        if(amountEl)amountEl.value='';
        updatePensionEtfTradePreview();
      }
      showPensionContributionStatus(`${targetText} 저장 작업을 작업 모음에 추가했습니다.`,'ok');
      return;
    }
    showPensionContributionStatus('PIN 입력 대기 중...','ok');
    const data=await requestPensionActionPin({
      title:`${targetText} 저장`,
      description:item.target==='cashSnapshot'
        ?`현금성자산의 평가금액 ${won(item.valuation)}과 매수원금 ${won(item.costBasis)}을 GitHub 파일에 함께 저장합니다.`
        :(item.target==='etfTrade'
          ?`${item.tradeDate} 신청한 ${item.name} ${fmt(item.qty)}좌 매수를 오늘(${item.applyDate}) 앱 반영 기준으로 적용합니다.`
          :`${targetText}을 GitHub 파일에 저장합니다. PIN 6자리를 입력하세요.`),
      execute:pin=>savePensionContributionViaGithubPages(item,pin)
    });
    if(!data){showPensionContributionStatus('저장이 취소되었습니다.','err');return}
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
    const actionText=data.action==='updated'?'기존 항목 수정':'신규 항목 추가';
    showPensionContributionStatus(`${targetText} ${actionText} 완료. GitHub Pages 반영까지 1~3분 정도 걸릴 수 있습니다.`,'ok');
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
  const date=item?.date||key;
  const amount=item?won(Number(isCash?item.valuation:item.amount)||0):'선택 항목';
  const targetText=pensionContributionTargetLabel(target);
  const tradeDetail=isTrade&&item?` / 신청 ${item.tradeDate||item.date} / ${item.name||item.ticker} ${fmt(item.qty)}좌`:'';
  if(PENSION_BATCH_MODE){
    try{
      addPensionBatchOperation({action:'delete',target,key,sourceItem:item?{...item}:null});
      selected.checked=false;
      showPensionContributionDeleteStatus(`${targetText} 삭제 작업을 작업 모음에 추가했습니다.`,'ok');
    }catch(e){showPensionContributionDeleteStatus(e.message||String(e),'err')}
    return;
  }
  if(isTrade&&item){
    const linkedSnapshot=linkedPensionCashSnapshotForTrade(item);
    if(linkedSnapshot){
      showPensionContributionDeleteStatus(`${linkedSnapshot.date} 현금성자산 기록이 이 추가 매수를 반영하고 있습니다. 먼저 등록 유형을 '현금성자산'으로 바꿔 해당 날짜 항목을 삭제한 뒤 추가 매수를 삭제해주세요.`,'err');
      return;
    }
  }
  if(target==='contribution'&&item){
    const linkedSnapshot=linkedPensionCashSnapshotForContribution(item);
    if(linkedSnapshot){
      showPensionContributionDeleteStatus(`${linkedSnapshot.date} 현금성자산 기록이 이 기업적립금을 반영하고 있습니다. 먼저 등록 유형을 '현금성자산'으로 바꿔 해당 날짜 항목을 삭제한 뒤 기업적립금을 삭제해주세요.`,'err');
      return;
    }
  }
  showPensionContributionDeleteStatus('PIN 입력 대기 중...','ok');
  const data=await requestPensionActionPin({
    title:`${targetText} 삭제`,
    description:`${date} / ${targetText} / ${amount}${tradeDetail} 항목을 삭제합니다. PIN 6자리를 입력하세요.`,
    danger:true,
    execute:pin=>deletePensionContributionViaGithubPages(target,key,pin)
  });
  if(!data){showPensionContributionDeleteStatus('삭제가 취소되었습니다.','err');return}
  removePensionItemLocally(target,key);
  syncPensionContributionDeleteCard(target);
  if(target==='etfTrade') updatePensionEtfTradePreview();
  showPensionContributionDeleteStatus('선택 항목 삭제 완료. GitHub Pages 반영까지 1~3분 정도 걸릴 수 있습니다.','ok');
  showPensionMobileToast(`${targetText} 삭제 완료`,'ok');
}


document.addEventListener('click',e=>{
  const actionWrap=e.target.closest?.('.date-action-menu-wrap');
  if(!actionWrap) closeDateActionMenu();
});


function setupPensionVizTooltips(){
  if(window.__pensionVizTooltipTouchBound)return;
  window.__pensionVizTooltipTouchBound=true;

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

async function boot(){[PORTFOLIO,PRICES,SNAPSHOTS,ACCOUNT1_DAILY,PENSION_CONTRIBUTIONS,PENSION_CASH_SNAPSHOTS,PENSION_TRADES]=await Promise.all([fetch('data/portfolio.json?ts='+Date.now()).then(r=>r.json()),fetch('data/prices.json?ts='+Date.now()).then(r=>r.json()),fetch('data/performance_snapshots.json?ts='+Date.now()).then(r=>r.json()),fetch('data/account1_daily_snapshots.json?ts='+Date.now()).then(r=>r.json()).catch(()=>({})),fetch('data/pension_contributions.json?ts='+Date.now()).then(r=>r.json()).catch(()=>({contributions:[]})),fetch('data/pension_cash_snapshots.json?ts='+Date.now()).then(r=>r.json()).catch(()=>({snapshots:[]})),fetch('data/pension_trades.json?ts='+Date.now()).then(r=>r.json()).catch(()=>({trades:[]}))]);const dates=allAvailableDates();ACTIVE_DATE=dates.at(-1);history.replaceState(null,'','#'+ACTIVE_DATE);render();document.getElementById('tabs').addEventListener('change',e=>{
  if(e.target.id==='monthSelect'){
    const month=e.target.value,dates=allAvailableDates().filter(d=>d.startsWith(month));
    const keepMobileMenuOpen=window.matchMedia('(max-width:760px)').matches && document.getElementById('tabs')?.classList.contains('mobile-menu-open');
    ACTIVE_DATE=dates.at(-1);
    history.replaceState(null,'','#'+ACTIVE_DATE);
    render();
    if(keepMobileMenuOpen){
      document.getElementById('tabs')?.classList.add('mobile-menu-open');
      document.getElementById('dateActionMenu')?.classList.add('show');
    }
  }
  if(e.target.id==='dateSelect'){
    const keepMobileMenuOpen=window.matchMedia('(max-width:760px)').matches && document.getElementById('tabs')?.classList.contains('mobile-menu-open');
    ACTIVE_DATE=e.target.value;
    history.replaceState(null,'','#'+ACTIVE_DATE);
    render();
    if(keepMobileMenuOpen){
      document.getElementById('tabs')?.classList.add('mobile-menu-open');
      document.getElementById('dateActionMenu')?.classList.add('show');
    }
  }
});document.addEventListener('pointerdown',e=>{if(!e.target.closest('.svg-hitbox')&&!e.target.closest('#dashTooltip'))clearChartHover()})}boot().catch(err=>{document.getElementById('app').innerHTML=`<div class="wrap"><div class="note"><h2><span class="section-title-icon">⚠️</span>데이터 로딩 오류</h2><pre>${String(err)}</pre></div></div>`})

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}
