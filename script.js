let PORTFOLIO,PRICES,SNAPSHOTS,ACCOUNT1_DAILY,PENSION_CONTRIBUTIONS,PENSION_CASH_SNAPSHOTS,ACTIVE_DATE;const fmt=n=>Math.round(Number(n)||0).toLocaleString('ko-KR'),won=n=>fmt(n)+'원',pct=n=>(Number(n)||0).toFixed(2)+'%',signed=(n,s='')=>(n>0?'+':'')+fmt(n)+s,cls=n=>n<0?'negative':(n>0?'positive':''),byDate=(a,b)=>a.localeCompare(b),shortDate=d=>{const [y,m,day]=d.split('-');return `${Number(m)}/${Number(day)}`},koreanDateLabel=d=>{
  const [y,m,day]=d.split('-');
  const snap=PRICES?.[d]||{};
  const status=snap.marketStatus||'close';
  if(status==='intraday'){
    const time=snap.updatedAtKST?snap.updatedAtKST.slice(11,16):'';
    return `${Number(m)}월 ${Number(day)}일 장중 ${time} 기준`;
  }
  return `${Number(m)}월 ${Number(day)}일 종가 기준`;
};
let pensionContributionSaveMode = 'githubPages';
const PENSION_CONTRIBUTION_SAVE_CONFIG = {
  githubPages: {
    label: 'GitHub Pages',
    url: 'https://script.google.com/macros/s/AKfycbwxPSFL8VMQLOuncl5ul_leqdnbfjhJve09ZReyaJvjWj8C-5UINeGhtwBxyklRj9AE/exec',
  },
  netlify: {
    label: 'Netlify',
    url: '/.netlify/functions/save-pension-contribution'
  }
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
      map.set(date,{...v,date,valuation:Number(v.valuation)||0});
      return map;
    },new Map())
    .values()
).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
const latestPensionCashSnapshot=d=>pensionCashSnapshotItems()
  .filter(v=>v.date&&v.date<=d&&Number(v.valuation))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  .at(-1)||null;
const pensionCashValuation=(d,baseCash=0)=>{
  const snap=latestPensionCashSnapshot(d);
  if(!snap) return Number(baseCash||0)+pensionContributionSum(d);
  return Number(snap.valuation||0)+pensionContributionSumAfter(snap.date,d);
};
const pensionContributionSubText=x=>{
  const latest=latestPensionContribution(x.date);
  return latest?`${latest.date} 기업적립금 ${won(Number(latest.amount)||0)} 반영 기준`:'6/30까지 기 반영분 기준';
};
const defaultPensionContributionDate=d=>{
  const base='2026-07-01';
  if(!d || d<base) return base;
  const [y,m]=d.split('-').map(Number);
  const nextMonth=m===12?1:m+1;
  const nextYear=m===12?y+1:y;
  return `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`;
};
const defaultPensionContributionMemo=d=>{
  const [y,m]=d.split('-');
  return `${y}년 ${Number(m)}월 기업적립금`;
};
const hasPensionData=d=>{const pp=PRICES?.[d]?.pension||{};return !!(pp['278530']&&pp['395160']&&pp['448330'])};
const dayOptionLabel=d=>{const [y,m,day]=d.split('-');const w='일월화수목금토'[new Date(d+'T00:00:00').getDay()];return `${Number(m)}/${Number(day)} ${w}`};
const sectionScopeText=x=>{
  const parts=['계좌1'];
  if(x.tossIncluded)parts.push('토스');
  if(x.account2Included)parts.push('계좌2');
  if(x.hasPension)parts.push('퇴직연금');
  return parts.join(' + ');
};
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
    account1Principal=isLedgerCheckDate(date)?c.account1Principal:daily.totalCost;
    account1Profit=isLedgerCheckDate(date)?daily.totalProfit+c.account1ProfitAdjustment:daily.totalProfit;
    account1Result=account1Principal+account1Profit;
    account1Return=account1Principal?account1Profit/account1Principal*100:0;
    etfEval=holdings.filter(h=>h.type==='ETF').reduce((a,h)=>a+h.evalAmount,0);
    stockEval=holdings.filter(h=>h.type==='개별주식').reduce((a,h)=>a+h.evalAmount,0);
    allocTotal=daily.totalEval;
  }else{
    holdings=p.securities.map(h=>{const price=getPrice(s,'securities',h.ticker),prevPrice=prev?getPrice(prev,'securities',h.ticker):null,evalAmount=(price||0)*h.qty,profit=evalAmount-h.cost,feeAdjustedProfit=profit-(h.feeBuffer||0),prevProfit=prevPrice==null?null:prevPrice*h.qty-h.cost;return {...h,price,prevPrice,evalAmount,profit,feeAdjustedProfit,returnRate:h.cost?profit/h.cost*100:0,prevEval:prevPrice==null?null:prevPrice*h.qty,dayChange:prevPrice==null?null:(price-prevPrice)*h.qty,prevProfit}});
    securitiesCash=c.securitiesCash;
    rawHoldingProfit=holdings.reduce((a,h)=>a+h.profit,0);
    account1Principal=c.account1Principal;
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
  const totalPrincipal=account2Included?c.externalPrincipal:account1Principal;
  const returnRate=totalPrincipal?totalProfit/totalPrincipal*100:0;
  const actualHolding=isLedgerCheckDate(date)?totalResult-c.livingSpent:null;
  const pensionRows=hasPension?p.pension.map(pos=>{const price=getPrice(s,'pension',pos.ticker),prevPrice=prev?getPrice(prev,'pension',pos.ticker):null,evalAmount=(price||0)*pos.qty,profit=evalAmount-pos.cost,prevEval=prevPrice==null?null:prevPrice*pos.qty;return {...pos,price,prevPrice,evalAmount,profit,returnRate:pos.cost?profit/pos.cost*100:0,dayChange:prevEval==null?null:evalAmount-prevEval,prevEval}}):[];
  const basePensionCash=hasPension?Number(s?.pension?.cash||0):0,basePrevPensionCash=Number(prev?.pension?.cash||0),pensionCash=hasPension?pensionCashValuation(date,basePensionCash):0,prevPensionCash=prev?pensionCashValuation(pk,basePrevPensionCash):0,pensionEval=hasPension?pensionRows.reduce((a,r)=>a+r.evalAmount,0)+pensionCash:0,pensionPrevEval=hasPension&&prev?pensionRows.reduce((a,r)=>a+(r.prevEval||0),0)+prevPensionCash:null,pensionProfit=hasPension?pensionEval-pensionPrincipal:0,pensionReturn=hasPension&&pensionPrincipal?pensionProfit/pensionPrincipal*100:0;
  const combinedPrincipal=hasPension?totalPrincipal+pensionPrincipal:totalPrincipal,combinedResult=hasPension?totalResult+pensionEval:totalResult,combinedProfit=hasPension?totalProfit+pensionProfit:totalProfit,combinedReturn=combinedPrincipal?combinedProfit/combinedPrincipal*100:0;
  return {date,s,prevKey:pk,prev,daily,hasDaily:!!daily,account2Included,tossIncluded,hasPension,holdings,securitiesCash,rawHoldingProfit,account1Principal,account1Profit,account1Result,account1Return,account2Profit,account2Principal,account2RealizedAmount,account2Remainder,tossProfit,tossRealizedAmount,tossRemainder,totalPrincipal,totalProfit,totalResult,returnRate,actualHolding,pensionRows,pensionCash,prevPensionCash,pensionEval,pensionPrevEval,pensionProfit,pensionReturn,extraPensionContrib,prevExtraPensionContrib,basePensionCash,basePrevPensionCash,pensionPrincipal,combinedPrincipal,combinedResult,combinedProfit,combinedReturn,etfEval,stockEval,allocTotal}
}
function snapshotDates(d){
  return allAvailableDates().filter(x=>x<=d);
}
function cumHistory(d){
  return snapshotDates(d).map(x=>{
    const v=calc(x);
    const principal=v.account1Principal||1;
    const profit=v.rawHoldingProfit;
    return {
      '날짜':x,
      '합계 : 누적손익':profit,
      '합계 : 누적수익률':principal?profit/principal*100:0,
      '합계 : 전일대비손익':0
    };
  }).map((row,i,arr)=>{
    row['합계 : 전일대비손익']=i===0?row['합계 : 누적손익']:row['합계 : 누적손익']-arr[i-1]['합계 : 누적손익'];
    return row;
  });
}
function symbolHistory(d){
  return snapshotDates(d).map(x=>{
    const v=calc(x);
    const get=name=>{
      const h=v.holdings.find(h=>h.name===name);
      return h?Number(h.profit||0):0;
    };
    return {
      '날짜':x,
      'SK하이닉스':get('SK하이닉스'),
      '삼성전자':get('삼성전자'),
      '현대차':get('현대차'),
      'KODEX 200':get('KODEX 200')
    };
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
        {type:'action',action:'triggerKrxPriceUpdate();closeDateActionMenu();closeMobileNavMenu();',icon:'refresh',title:'KRX 현재가 반영'},
        {type:'action',action:'openPensionContributionModal();closeDateActionMenu();closeMobileNavMenu();',icon:'wallet',title:'퇴직연금 금액 조정'}
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
    if(item.type==='link') return `<a class="${cls}" href="${item.url}" target="_blank" rel="noopener noreferrer" onclick="closeDateActionMenu();closeMobileNavMenu()">${inner}</a>`;
    if(item.type==='action') return `<button type="button" class="${cls}" onclick="${item.action}">${inner}</button>`;
    return `<button type="button" class="${cls}" onclick="jumpToSection('${item.id}');closeDateActionMenu()">${inner}</button>`;
  }).join('')}</div>`).join('');
}
function renderTabs(){
  const dates=allAvailableDates(),months=[...new Set(dates.map(d=>d.slice(0,7)))],activeMonth=ACTIVE_DATE.slice(0,7),monthDates=dates.filter(d=>d.startsWith(activeMonth));
  document.getElementById('tabs').innerHTML=`<div class="date-picker"><div class="market-link-area"><a class="date-tool-btn market-link-btn market-link-btn-desktop" href="https://esignal.co.kr/kospi200-futures-night/" target="_blank" rel="noopener noreferrer" title="코스피200 야간선물"><span class="date-tool-action-icon">🌙</span>코스피200 야간선물</a><a class="date-tool-btn market-link-btn market-link-btn-desktop" href="https://esignal.co.kr/nasdaq100-futures/" target="_blank" rel="noopener noreferrer" title="나스닥100 선물"><span class="date-tool-action-icon">🚀</span>나스닥100 선물</a></div><div class="date-picker-center"><span class="date-picker-label">기준일</span><select class="date-select month-select" id="monthSelect" aria-label="월 선택">${months.map(m=>`<option value="${m}" ${m===activeMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}</select><select class="date-select day-select" id="dateSelect" aria-label="일 선택">${monthDates.map(d=>`<option value="${d}" ${d===ACTIVE_DATE?'selected':''}>${dayOptionLabel(d)}</option>`).join('')}</select><span class="date-picker-caption">${dates.length}개 거래일</span></div><div class="date-picker-action"><button type="button" class="date-tool-btn date-tool-btn-desktop" title="KRX 현재가 반영" aria-label="KRX 현재가 반영" onclick="triggerKrxPriceUpdate()"><span class="date-tool-action-icon">📈</span>KRX 현재가 반영</button><button type="button" class="date-tool-btn date-tool-btn-desktop" title="퇴직연금 금액 조정" aria-label="퇴직연금 금액 조정" onclick="openPensionContributionModal()"><span class="date-tool-action-icon">💰</span>퇴직연금 금액 조정</button><div class="date-action-menu-wrap"><button type="button" class="date-tool-btn date-tool-menu-btn" title="메뉴" aria-label="메뉴" onclick="toggleDateActionMenu(event)"><span class="date-tool-icon">☰</span></button><div id="dateActionMenu" class="date-action-menu mobile-combined-menu" aria-label="모바일 통합 메뉴"><div class="mobile-nav-head"><button type="button" onclick="closeDateActionMenu()" aria-label="메뉴 닫기">×</button></div>${renderUnifiedMobileMenuContent()}</div></div></div></div>`;
}
function metricCard(label,value,sub,dark=false,vcls=''){return `<div class="card ${dark?'dark':''}"><div class="label">${label}</div><div class="value ${vcls}">${value}</div><div class="sub">${sub}</div></div>`}


function closeDateActionMenu(){
  const menu=document.getElementById('dateActionMenu');
  if(menu) menu.classList.remove('show');
}
function toggleDateActionMenu(event){
  if(event) event.stopPropagation();
  closeMarketLinkMenu();
  const menu=document.getElementById('dateActionMenu');
  if(menu) menu.classList.toggle('show');
}
function closeMarketLinkMenu(){
  const menu=document.getElementById('marketLinkMenu');
  if(menu) menu.classList.remove('show');
}
function toggleMarketLinkMenu(event){
  if(event) event.stopPropagation();
  closeDateActionMenu();
  const menu=document.getElementById('marketLinkMenu');
  if(menu) menu.classList.toggle('show');
}
document.addEventListener('click',()=>{closeDateActionMenu();closeMarketLinkMenu()});
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
  // auto: 날짜를 보내지 않고, update_prices.py의 누락 거래일 자동 보충 로직 사용
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
      <button type="button" class="ghost" onclick="submitKrxActionModal('auto')">최신/누락 자동 반영</button>
      <button type="button" class="primary" onclick="submitKrxActionModal('selected')">선택일 재갱신</button>
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
        : '최신/누락 KRX 현재가 자동 반영 요청 중...';
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
      : '최신/누락 KRX 현재가 자동 반영 요청 완료. GitHub Actions 완료 후 새로고침해 주세요.';
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

function closeMobileNavMenu(){
  const menu=document.getElementById('mobileNavMenu');
  if(menu) menu.classList.remove('show');
}
function toggleMobileNavMenu(){
  const menu=document.getElementById('mobileNavMenu');
  if(menu) menu.classList.toggle('show');
}
function jumpToSection(id){
  const el=document.getElementById(id);
  closeMobileNavMenu();
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderMobileNavMenu(){
  return '';
}


function sectionToSecuritiesBlock(html, extraClass=''){
  if(!html) return '';
  return html
    .replace(/^<section([^>]*)>/, (_, attrs='')=>{
      const idMatch=attrs.match(/\sid="([^"]*)"/);
      const classMatch=attrs.match(/\sclass="([^"]*)"/);
      const idAttr=idMatch?` id="${idMatch[1]}"`:'';
      const classes=['securities-subsection',extraClass,classMatch?classMatch[1]:''].filter(Boolean).join(' ');
      return `<div${idAttr} class="${classes}">`;
    })
    .replace(/<\/section>\s*$/, '</div>');
}
function renderSecuritiesSummaryCards(x){
  const securitiesScope=securitiesScopeText(x);
  return `<div class="securities-subsection securities-summary-block"><div class="grid cards">${metricCard('증권계좌 투자 결과물',won(x.totalResult),`${securitiesScope} 기준`,true)}${metricCard('기준 투입원금',won(x.totalPrincipal),x.account2Included?'계좌2 실현분 포함 후 장부상 외부투입원금 기준':'선택일 계좌1 투자원금 기준')}${metricCard('총 합산 누적손익',won(x.totalProfit),`${securitiesScope} 누적손익`,false,'positive')}${metricCard('투자대비 이익률',pct(x.returnRate),'총 합산 누적손익 ÷ 기준 투입원금',false,'blue')}</div></div>`;
}
function renderSecuritiesSection(x){
  return `<section id="securities-section"><div class="section-title"><h2><span class="section-title-icon">🏦</span>증권계좌 현황</h2></div><div class="securities-band">${renderSecuritiesSummaryCards(x)}${sectionToSecuritiesBlock(renderHoldings(x),'holdings-block')}${sectionToSecuritiesBlock(renderAccounts(x),'accounts-block')}${sectionToSecuritiesBlock(renderCharts(x),'charts-block')}${sectionToSecuritiesBlock(renderResultSummary(x),'ledger-block')}${isLedgerCheckDate(x.date)?sectionToSecuritiesBlock(renderSourceTables(),'source-block'):''}</div></section>`;
}

function pensionContributionModeLabel(){
  return pensionContributionSaveMode==='githubPages'?'GitHub Pages':'Netlify';
}

function pensionContributionModeHelp(mode=pensionContributionSaveMode){
  if(mode==='githubPages'){
    return 'GitHub Pages: Apps Script로 기업적립금/현금성 평가금액을 GitHub에 저장합니다. 저장·삭제 시 PIN 필요.';
  }
  return 'Netlify: Netlify Function으로 동일 데이터를 저장합니다. 저장·삭제 시 PIN 필요.';
}

function setPensionContributionSaveMode(mode){
  pensionContributionSaveMode = mode==='netlify' ? 'netlify' : 'githubPages';

  document.querySelectorAll('.contrib-save-tab').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.saveMode===pensionContributionSaveMode);
  });

  const help=document.getElementById('contribSaveHelp');
  if(help) help.textContent=pensionContributionModeHelp();

  const pinBox=document.getElementById('contribPinBox');
  if(pinBox) pinBox.classList.toggle('netlify-mode', pensionContributionSaveMode==='netlify');

  const pinDesc=document.getElementById('contribPinDesc');
  if(pinDesc) pinDesc.textContent='GitHub Pages / Netlify 저장과 삭제 모두 PIN 입력 필요';
}

function renderPensionContributionList(){
  const contribItems=pensionContributionItems()
    .slice()
    .filter(v=>v&&v.date)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id||'').localeCompare(String(a.id||'')))
    .map(v=>({target:'contribution',key:v.id,date:v.date,amount:Number(v.amount)||0,memo:v.memo||'',label:'기업적립금'}));

  const cashItems=pensionCashSnapshotItems()
    .slice()
    .filter(v=>v&&v.date)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
    .map(v=>({target:'cashSnapshot',key:v.date,date:v.date,amount:Number(v.valuation)||0,memo:v.memo||'',label:'현금성 평가금액'}));

  const items=[...contribItems,...cashItems]
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.label).localeCompare(String(b.label))||String(b.key||'').localeCompare(String(a.key||'')));

  if(!items.length) return `<p class="small">등록된 기업적립금/현금성자산 평가금액이 없습니다.</p>`;

  return items.map(v=>`<label class="contrib-existing-item"><input type="radio" name="pensionContribDeleteTarget" value="${v.target}|${v.key}"><span class="contrib-existing-main"><span class="contrib-existing-title"><span class="contrib-existing-date">${v.date}</span><span class="contrib-existing-sep"> / </span><span class="contrib-existing-info">${v.label} / ${won(v.amount)}</span></span><span class="contrib-existing-memo">${escapeHtml(v.memo)}</span></span></label>`).join('');
}

function renderPensionContributionModal(x){
  const contribDefaultDate=defaultPensionContributionDate(x.date);
  const contribDefaultMemo=defaultPensionContributionMemo(contribDefaultDate);
  const cashDefaultDate=x.date||contribDefaultDate;
  const cashDefaultValue=x.pensionCash?fmt(x.pensionCash):'';
  return `<div id="pensionContribModal" class="contrib-modal" aria-hidden="true" onclick="if(event.target===this)closePensionContributionModal()"><div class="contrib-modal-card" role="dialog" aria-modal="true" aria-labelledby="pensionContribModalTitle"><div class="contrib-modal-head"><div><h2 id="pensionContribModalTitle"><span class="section-title-icon">💰</span>퇴직연금 금액 조정</h2><p>기업적립금은 원금/현금성자산을 늘리고, 현금성자산 평가금액은 앱 기준 평가금액으로 보정합니다.</p></div><button type="button" class="contrib-modal-close" onclick="closePensionContributionModal()" aria-label="닫기">×</button></div>
<div class="pension-contrib-tool modal-card-box">
  <h3>등록</h3>
  <div class="contrib-save-tabs" role="tablist" aria-label="저장 방식 선택">
    <button type="button" class="contrib-save-tab active" data-save-mode="githubPages" onclick="setPensionContributionSaveMode('githubPages')">GitHub Pages</button>
    <button type="button" class="contrib-save-tab" data-save-mode="netlify" onclick="setPensionContributionSaveMode('netlify')">Netlify</button>
  </div>
  <div class="contrib-save-help" id="contribSaveHelp">${pensionContributionModeHelp('githubPages')}</div>
  <p class="small">기업적립금은 납입원금과 현금성자산 매수원금을 늘립니다. 현금성자산 평가금액은 앱 화면의 평가금액을 특정일 기준으로 저장합니다.</p>
  <p class="small">현금성자산 평가금액은 같은 일자로 다시 저장하면 기존 금액이 새 금액으로 수정됩니다.</p>
  <div class="contrib-form-grid">
    <div class="contrib-field full contrib-target-field"><span class="contrib-field-label">등록 유형</span><input type="hidden" id="pensionContribTarget" value="contribution"><div class="contrib-target-tabs" role="tablist" aria-label="등록 유형 선택"><button type="button" class="contrib-target-option active" data-target="contribution" onclick="setPensionContributionTarget('contribution')">기업적립금</button><button type="button" class="contrib-target-option" data-target="cashSnapshot" onclick="setPensionContributionTarget('cashSnapshot')">현금성자산 평가금액</button></div></div>
    <div class="contrib-field"><label for="pensionContribDate">일자</label><input id="pensionContribDate" type="date" value="${contribDefaultDate}" data-contrib-default-date="${contribDefaultDate}" data-cash-default-date="${cashDefaultDate}"></div>
    <div class="contrib-field"><label id="pensionContribAmountLabel" for="pensionContribAmount">금액</label><input id="pensionContribAmount" type="text" inputmode="numeric" value="618,060" data-contrib-default-value="618,060" data-cash-default-value="${cashDefaultValue}"></div>
    <div class="contrib-field full"><label for="pensionContribMemo">메모</label><input id="pensionContribMemo" type="text" value="${contribDefaultMemo}" data-contrib-default-memo="${contribDefaultMemo}" data-cash-default-memo="현금성자산 평가금액 앱 확인"></div>
  </div>
  <div class="contrib-actions">
    <button type="button" class="contrib-btn" onclick="savePensionContribution()">저장</button>
    <button type="button" class="contrib-btn secondary" onclick="generatePensionContributionJson()">JSON 만들기</button>
    <button type="button" class="contrib-btn secondary" onclick="copyPensionContributionJson()">복사</button>
  </div>
  <div id="pensionContribStatus" class="contrib-status"></div>
  <pre id="pensionContribOutput" class="contrib-output"></pre>
</div>
<div class="contrib-list modal-card-box">
  <h3>삭제</h3>
  <p class="small">잘못 넣은 기업적립금 또는 현금성자산 평가금액을 선택 후 삭제합니다.</p>
  <div id="pensionContribExistingList" class="contrib-existing-list">${renderPensionContributionList()}</div>
  <div class="contrib-actions"><button type="button" class="contrib-btn danger" onclick="deleteSelectedPensionContribution()">선택 항목 삭제</button></div>
</div>
<details class="token-guide">
  <summary>GitHub 토큰 만료/교체 방법</summary>
  <div class="token-guide-body">
    <div class="token-guide-alert">토큰이 만료되면 대시보드 조회는 되지만, 기업적립금/현금성자산 저장과 삭제만 실패할 수 있습니다.</div>
    <p><strong>GitHub Pages 방식</strong>은 Google Apps Script의 Script Properties에 저장된 <code>GITHUB_TOKEN</code>을 사용합니다.</p>
    <ol>
      <li>GitHub에서 새 Fine-grained token 생성</li>
      <li>대시보드 repo만 선택</li>
      <li>권한은 <code>Contents: Read and write</code>, <code>Actions: Read and write</code>, <code>Metadata: Read-only</code></li>
      <li>Google Apps Script → 프로젝트 설정 → Script Properties</li>
      <li><code>GITHUB_TOKEN</code> 값을 새 토큰으로 교체</li>
      <li>Apps Script 웹 앱을 새 버전으로 배포</li>
      <li>GitHub Pages 화면에서 저장 테스트</li>
    </ol>
    <p><strong>Netlify 방식</strong>을 사용할 경우에만 Netlify Environment variables의 <code>GITHUB_TOKEN</code>을 교체합니다.</p>
  </div>
</details></div></div>`;
}

function render(){const x=calc(ACTIVE_DATE),c=PORTFOLIO.constants;renderTabs();const securitiesScope=securitiesScopeText(x),pensionPill=x.hasPension?`<span class="pill">퇴직연금 포함 결과물 ${won(x.combinedResult)}</span>`:'';document.getElementById('app').innerHTML=`<div class="wrap">${renderMobileNavMenu()}<header class="hero" id="top-section"><h1>${PORTFOLIO.meta.title}</h1><p>${koreanDateLabel(x.date)}. 선택일에 존재하는 원시데이터 범위만 반영하여 표시.</p><div class="pillbar"><span class="pill">증권계좌 범위 ${securitiesScope}</span><span class="pill">증권계좌 기준 투입원금 ${won(x.totalPrincipal)}</span><span class="pill">증권계좌 누적손익 ${won(x.totalProfit)}</span><span class="pill">증권계좌 투자대비 이익률 ${pct(x.returnRate)}</span><span class="pill">증권계좌 투자 결과물 ${won(x.totalResult)}</span>${pensionPill}</div></header>${renderPensionContributionModal(x)}${x.hasPension?renderCombined(x):''}${x.hasPension?renderPension(x):''}${renderSecuritiesSection(x)}</div>`;drawAllCharts();setupPensionVizTooltips()}


function renderResultSummary(x){
  const c=PORTFOLIO.constants;
  const outsideCash=c.outsideCash ?? 2035097;
  const actualHoldingAndCash=x.allocTotal + outsideCash;
  const ledgerGap=x.totalResult - actualHoldingAndCash;
  if(!isLedgerCheckDate(x.date)) return '';

  return `<section id="ledger-check"><div class="section-title"><h2><span class="section-title-icon">🔍</span>장부결과 VS 실제보유</h2></div><div class="grid cards">${metricCard('장부상 증권계좌 투자 결과물(A)',won(x.totalResult),'계좌1 성과 + 계좌2 실현분 + 토스 실현분 기준',true)}${metricCard('현재 증권계좌 및 현금 보유액(B)',won(actualHoldingAndCash),'증권계좌 평가총액 + 계좌 밖 현금',false,'blue')}${metricCard('차액(A-B)',won(ledgerGap),'장부상 결과물과 실제 보유액의 차이',false,ledgerGap>=0?'positive':'negative')}${metricCard('차액 발생 이유','수익실현분 카드대금 사용','6/18 기준 확정 정리값',false)}</div><p class="table-note"><strong>차액 발생 사유:</strong> 계좌 밖 현금은 6/18 확인값 ${won(outsideCash)} 유지. 해당 현금은 투자 실현수익 잔액 반영, 차액은 수익실현분 카드대금 사용액으로 정리.</p></section>`;
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

  return `<section id="securities-holdings"><div class="section-title"><h2><span class="section-title-icon">📁</span>증권계좌 보유분</h2></div><div class="mobile-scroll"><table class="hold-position-table"><thead><tr><th>종목명</th><th>수량</th><th>평단</th><th>투자원금</th><th>현재가</th><th>평가금액</th><th>평가손익</th><th>수수료반영 손익</th><th>손익률</th></tr></thead><tbody>${x.holdings.map(h=>`<tr class="hold-row ${h.cssClass||''}"><td>${h.name}</td><td class="num">${fmt(h.qty)}</td><td class="num">${fmt(h.avgPrice ?? (h.qty?h.cost/h.qty:0))}</td><td class="num">${fmt(h.cost)}</td><td class="num">${fmt(h.price)}</td><td class="num">${fmt(h.evalAmount)}</td><td class="num ${cls(h.profit)}">${fmt(h.profit)}</td><td class="num ${cls(h.feeAdjustedProfit ?? h.profit)}">${fmt(h.feeAdjustedProfit ?? h.profit)}</td><td class="num ${cls(h.returnRate)}">${pct(h.returnRate)}</td></tr>`).join('')}<tr class="summary-row"><td>보유종목 합계</td><td class="num">-</td><td class="num">-</td><td class="num">${fmt(holdCost)}</td><td class="num">-</td><td class="num">${fmt(holdEval)}</td><td class="num ${cls(holdProfit)}">${fmt(holdProfit)}</td><td class="num ${cls(holdFeeAdjusted)}">${fmt(holdFeeAdjusted)}</td><td class="num ${cls(holdReturn)}">${pct(holdReturn)}</td></tr><tr><td>증권계좌 현금</td><td class="num">-</td><td class="num">-</td><td class="num">${fmt(cash)}</td><td class="num">-</td><td class="num">${fmt(cash)}</td><td class="num">0</td><td class="num">0</td><td class="num">0.00%</td></tr><tr class="summary-row"><td>총계(보유분+현금)</td><td class="num">-</td><td class="num">-</td><td class="num">${fmt(totalCostWithCash)}</td><td class="num">-</td><td class="num">${fmt(totalEvalWithCash)}</td><td class="num ${cls(holdProfit)}">${fmt(holdProfit)}</td><td class="num ${cls(holdFeeAdjusted)}">${fmt(holdFeeAdjusted)}</td><td class="num ${cls(totalReturnWithCash)}">${pct(totalReturnWithCash)}</td></tr></tbody></table></div></section>`;
}
function renderPension(x){
  const c=PORTFOLIO.constants,
        day=x.pensionPrevEval==null?null:x.pensionEval-x.pensionPrevEval,
        rate=x.pensionPrevEval?day/x.pensionPrevEval*100:0,
        pensionCashCost=Number(c.pensionCashCost||39408)+Number(x.extraPensionContrib||0),
        pensionHeldCost=x.pensionRows.reduce((a,r)=>a+r.cost,0)+pensionCashCost,
        pensionHeldProfit=x.pensionEval-pensionHeldCost,
        pensionHeldReturn=pensionHeldCost?pensionHeldProfit/pensionHeldCost*100:0,
        hasPrevPension=x.pensionPrevEval!=null,
        noPrevBlock=`<div class="pension-no-prev-note">전일 데이터가 없습니다.</div>`,
        changeContent=hasPrevPension?`<div class="change-kpis"><div class="mini-card"><div class="m-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가금액</div><div class="m-value">${won(x.pensionPrevEval)}</div></div><div class="mini-card"><div class="m-label">${shortDate(x.date)} 평가금액</div><div class="m-value">${won(x.pensionEval)}</div></div><div class="mini-card"><div class="m-label">하루 변동분</div><div class="m-value ${cls(day)}">${signed(day,'원')}</div></div><div class="mini-card"><div class="m-label">하루 변동률</div><div class="m-value ${cls(rate)}">${(rate>0?'+':'')+pct(rate)}</div></div></div><div class="change-table-wrap desktop-change-table"><table class="change-table"><thead><tr><th>상품</th><th>${x.prevKey?shortDate(x.prevKey):'-'} 종가</th><th>${shortDate(x.date)} 종가</th><th>일변동</th></tr></thead><tbody>${x.pensionRows.map(r=>`<tr><td>${r.name}</td><td class="num"><span class="change-price">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span><span class="change-eval">${r.prevEval==null?'-':won(r.prevEval)}</span></td><td class="num"><span class="change-price">${fmt(r.price)}</span><span class="change-eval">${won(r.evalAmount)}</span></td><td class="num ${cls(r.dayChange)}">${r.dayChange==null?'-':signed(r.dayChange)}</td></tr>`).join('')}<tr><td>현금성자산</td><td class="num"><span class="change-price">—</span><span class="change-eval">${won(x.prevPensionCash)}</span></td><td class="num"><span class="change-price">—</span><span class="change-eval">${won(x.pensionCash)}</span></td><td class="num ${cls(x.pensionCash-x.prevPensionCash)}">${signed(x.pensionCash-x.prevPensionCash)}</td></tr><tr class="summary-row"><td>합계</td><td class="num">${fmt(x.pensionPrevEval)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${cls(day)}">${signed(day)}</td></tr></tbody></table></div><div class="change-mobile-list">${x.pensionRows.map(r=>`<div class="change-product-card"><div class="change-product-title">${r.name}</div><div class="change-product-row"><span class="change-product-label">${x.prevKey?shortDate(x.prevKey):'-'} 종가</span><span class="change-product-value">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span></div><div class="change-product-row"><span class="change-product-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가액</span><span class="change-product-value">${r.prevEval==null?'-':won(r.prevEval)}</span></div><div class="change-product-row"><span class="change-product-label">${shortDate(x.date)} 종가</span><span class="change-product-value">${fmt(r.price)}</span></div><div class="change-product-row"><span class="change-product-label">${shortDate(x.date)} 평가액</span><span class="change-product-value">${won(r.evalAmount)}</span></div><div class="change-product-row"><span class="change-product-label">일변동</span><span class="change-product-value ${cls(r.dayChange)}">${r.dayChange==null?'-':signed(r.dayChange)}</span></div></div>`).join('')}<div class="change-product-card"><div class="change-product-title">현금성자산</div><div class="change-product-row"><span class="change-product-label">${x.prevKey?shortDate(x.prevKey):'-'} 평가액</span><span class="change-product-value">${won(x.prevPensionCash)}</span></div><div class="change-product-row"><span class="change-product-label">${shortDate(x.date)} 평가액</span><span class="change-product-value">${won(x.pensionCash)}</span></div><div class="change-product-row"><span class="change-product-label">일변동</span><span class="change-product-value ${cls(x.pensionCash-x.prevPensionCash)}">${signed(x.pensionCash-x.prevPensionCash)}</span></div></div></div>`:noPrevBlock;
  return `<section id="pension-section"><div class="section-title"><h2><span class="section-title-icon">💼</span>퇴직연금 현황</h2></div><div class="pension-band"><div class="grid cards" style="margin-top:0">${metricCard('퇴직연금 평가금액',won(x.pensionEval),`${basisText(x.date)} 추정 평가금액`,true)}${metricCard('퇴직연금 납입원금',won(x.pensionPrincipal),pensionContributionSubText(x))}${metricCard('퇴직연금 운용수익',won(x.pensionProfit),'평가금액 - 납입원금',false,'positive')}${metricCard('퇴직연금 누적수익률',pct(x.pensionReturn),'퇴직연금 운용수익 ÷ 퇴직연금 납입원금',false,'blue')}</div><div class="grid two pension-detail-grid" style="margin-top:16px"><div class="note pension-products-note" id="pension-products"><div class="section-title"><h2><span class="section-title-icon">📦</span>연금상품별 현황</h2></div><div class="mobile-scroll"><table class="pension-products-table"><thead><tr><th>상품</th><th>수량</th><th>평균단가</th><th>매수원금</th><th>평가금액</th><th>평가손익</th><th>수익률</th><th>비중</th></tr></thead><tbody>${x.pensionRows.map(r=>pensionRow(r,x.pensionEval)).join('')}${pensionCashRow(x.pensionCash,x.pensionEval,pensionCashCost)}<tr class="summary-row"><td>합계</td><td></td><td></td><td class="num">${fmt(pensionHeldCost)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${cls(pensionHeldProfit)}">${fmt(pensionHeldProfit)}</td><td class="num ${cls(pensionHeldReturn)}">${pct(pensionHeldReturn)}</td><td></td></tr></tbody></table></div><p class="small" style="margin-top:10px">※ 매수원금 합계는 현재 보유상품 재투자 기준</p>${renderPensionProductInsights(x)}
</div><div class="note pension-change-note" id="pension-change"><div class="section-title"><h2><span class="section-title-icon">📈</span>전일 대비 변동</h2></div>${changeContent}</div></div>${renderPensionCharts(x)}</div></section>`;
}
function pensionRow(r,total){const w=total?r.evalAmount/total*100:0;return `<tr><td><strong>${r.name}</strong></td><td class="num">${fmt(r.qty)}</td><td class="num">${fmt(r.cost/r.qty)}</td><td class="num">${fmt(r.cost)}</td><td class="num">${fmt(r.evalAmount)}</td><td class="num ${cls(r.profit)}">${fmt(r.profit)}</td><td class="num ${cls(r.returnRate)}">${pct(r.returnRate)}</td><td><div class="bar-box"><div class="bar-fill ${r.barClass}" style="width:${Math.max(0,Math.min(100,w)).toFixed(1)}%"></div></div><div class="small">${w.toFixed(1)}%</div></td></tr>`}
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
  const cashDelta=Number(x.pensionCash||0)-Number(x.prevPensionCash||0);
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
function renderCombined(x){const c=PORTFOLIO.constants;return `<section id="summary-section"><div class="section-title"><h2><span class="section-title-icon">🏠</span>연금+계좌 성과</h2><p>단타 제외</p></div><div class="mobile-scroll"><table class="combined-performance-table"><thead><tr><th>구분</th><th>투입원금</th><th>투자 결과물</th><th>누적손익</th><th>투자대비 이익률</th></tr></thead><tbody><tr><td><strong>퇴직연금</strong></td><td class="num">${fmt(x.pensionPrincipal)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${cls(x.pensionProfit)}">${fmt(x.pensionProfit)}</td><td class="num ${cls(x.pensionReturn)}">${pct(x.pensionReturn)}</td></tr><tr><td><strong>증권계좌</strong></td><td class="num">${fmt(x.totalPrincipal)}</td><td class="num">${fmt(x.totalResult)}</td><td class="num ${cls(x.totalProfit)}">${fmt(x.totalProfit)}</td><td class="num ${cls(x.returnRate)}">${pct(x.returnRate)}</td></tr><tr class="summary-row"><td>합산</td><td class="num">${fmt(x.combinedPrincipal)}</td><td class="num">${fmt(x.combinedResult)}</td><td class="num ${cls(x.combinedProfit)}">${fmt(x.combinedProfit)}</td><td class="num ${cls(x.combinedReturn)}">${pct(x.combinedReturn)}</td></tr></tbody></table></div></section>`}
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
        mdd=calcMdd(cum),chartNames=['삼성전자','SK하이닉스','현대차','KODEX 200'],symbols=x.holdings.filter(h=>chartNames.includes(h.name)),symbolTotal=symbols.reduce((a,h)=>a+h.profit,0),
        lastProfit=last['합계 : 누적손익'], lastReturn=last['합계 : 누적수익률'],
        profitDelta=prevCum?lastProfit-prevCum['합계 : 누적손익']:0,
        returnDelta=prevCum?lastReturn-prevCum['합계 : 누적수익률']:0,
        bestGap=best['합계 : 누적손익']-lastProfit,
        bestDetail=bestGap===0?'금일 갱신':'금일 대비 '+signed(bestGap,'원');
  return `<section id="investment-analysis"><div class="section-title"><h2><span class="section-title-icon">🗓️</span>투자 기간 분석</h2><p>삼성증권 계좌1 기준</p></div><div class="grid chart-grid">
  <div class="chart-card" id="chart-cum"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">📊</span>누적손익 및 누적수익률</h3><p>막대는 누적손익과 전일대비손익, 선은 누적수익률을 나타냄.</p></div></div><div class="chart-wrap"><svg class="chart" id="chartCum"></svg></div><div class="chart-legend"><span class="legend-item"><span class="swatch" style="background:#ffb84d"></span>누적손익</span><span class="legend-item"><span class="swatch" style="background:#a7d7a8"></span>전일대비손익</span><span class="legend-item"><span class="swatch" style="background:#5abdf2"></span>누적수익률</span></div><div class="chart-note six"><div class="mini-card"><div class="m-label">최종 누적손익</div><div class="m-value ${cls(lastProfit)}">${won(lastProfit)}</div><div class="m-detail ${cls(profitDelta)}">전일 대비 ${signed(profitDelta,'원')}</div></div><div class="mini-card"><div class="m-label">최종 누적수익률</div><div class="m-value ${cls(lastReturn)}">${pct(lastReturn)}</div><div class="m-detail ${cls(returnDelta)}">전일 대비 ${returnDelta>0?'+':''}${returnDelta.toFixed(2)}%p</div></div><div class="mini-card"><div class="m-label">최고 누적손익(${best.날짜})</div><div class="m-value">${won(best['합계 : 누적손익'])}</div><div class="m-detail ${bestGap===0?'positive':''}">${bestDetail}</div></div><div class="mini-card"><div class="m-label">최대 낙폭</div><div class="m-value negative">${won(mdd.drop)}</div><div class="m-detail">${mdd.from} → ${mdd.to}</div></div><div class="mini-card"><div class="m-label">최고의 하루(${bestDay.날짜})</div><div class="m-value positive">${signed(bestDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail positive">전일 대비 변화</div></div><div class="mini-card"><div class="m-label">최악의 하루(${worstDay.날짜})</div><div class="m-value negative">${signed(worstDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail negative">전일 대비 변화</div></div></div></div>
  <div class="chart-card" id="chart-symbol"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🧩</span>종목별 누적손익</h3><p>핵심종목별 누적손익의 변화와 기여도를 비교.</p></div></div><div class="chart-wrap"><svg class="chart" id="chartSymbol"></svg></div><div class="chart-legend"><span class="legend-item"><span class="swatch" style="background:#ff8a65"></span>SK하이닉스</span><span class="legend-item"><span class="swatch" style="background:#8bc34a"></span>삼성전자</span><span class="legend-item"><span class="swatch" style="background:#26c6da"></span>현대차</span><span class="legend-item"><span class="swatch" style="background:#42a5f5"></span>KODEX 200</span></div><div class="chart-note symbol-summary-grid">${symbols.sort((a,b)=>Math.abs(b.profit)-Math.abs(a.profit)).map(h=>symbolCard(h,symbolTotal)).join('')}</div><div class="symbol-summary-note">※ 기여도는 차트에 표시된 종목들의 누적손익 합계 기준이며, 전일대비 변동률은 전일대비 변동액 ÷ 전일의 평가금액</div></div>
  <div class="chart-card" id="chart-alloc"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🥧</span>평가액 비중</h3><p>ETF·개별주식·현금의 일자별 평가액 비중 변화.</p></div></div><div class="chart-wrap"><svg class="chart" id="chartAlloc"></svg></div><div class="chart-legend"><span class="legend-item"><span class="swatch" style="background:#ff6b6b"></span>ETF</span><span class="legend-item"><span class="swatch" style="background:#ffc857"></span>개별주식</span><span class="legend-item"><span class="swatch" style="background:#8fd18f"></span>현금</span></div><div class="chart-note"><div class="mini-card"><div class="m-label">ETF</div><div class="m-value">${won(x.etfEval)} <span class="small">(${(x.etfEval/x.allocTotal*100).toFixed(1)}%)</span></div></div><div class="mini-card"><div class="m-label">개별주식</div><div class="m-value">${won(x.stockEval)} <span class="small">(${(x.stockEval/x.allocTotal*100).toFixed(1)}%)</span></div></div><div class="mini-card"><div class="m-label">현금</div><div class="m-value">${won(x.securitiesCash)} <span class="small">(${(x.securitiesCash/x.allocTotal*100).toFixed(1)}%)</span></div></div><div class="mini-card"><div class="m-label">현재 증권계좌 평가총액</div><div class="m-value">${won(x.allocTotal)}</div></div></div></div>
  </div></section>`;
}
function symbolCard(h,total){const contrib=total?h.profit/total*100:0,cr=h.prevEval?h.dayChange/h.prevEval*100:null;return `<div class="mini-card symbol-card"><div class="m-label">${h.name==='KODEX 200'?'KODEX 200':h.name}</div><div class="m-value ${cls(h.profit)}">${won(h.profit)}</div><div class="symbol-metrics"><div class="symbol-metric"><span class="symbol-metric-label">기여도</span><span class="symbol-metric-value ${cls(contrib)}">${pct(contrib)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동액</span><span class="symbol-metric-value ${cls(h.dayChange)}">${h.dayChange==null?'-':signed(h.dayChange,'원')}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동률</span><span class="symbol-metric-value ${cr==null?'':cls(cr)}">${cr==null?'-':((cr>0?'+':'')+pct(cr))}</span></div></div></div>`}

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
    const row={'날짜':x};
    v.pensionRows.forEach(r=>row[r.name]=Number(r.profit||0));
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
function pensionProductCard(h,total){const contrib=total?h.profit/total*100:0,cr=h.prevEval?h.dayChange/h.prevEval*100:null;return `<div class="mini-card symbol-card"><div class="m-label">${h.name}</div><div class="m-value ${cls(h.profit)}">${won(h.profit)}</div><div class="symbol-metrics"><div class="symbol-metric"><span class="symbol-metric-label">기여도</span><span class="symbol-metric-value ${cls(contrib)}">${pct(contrib)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동액</span><span class="symbol-metric-value ${cls(h.dayChange)}">${h.dayChange==null?'-':signed(h.dayChange,'원')}</span></div><div class="symbol-metric"><span class="symbol-metric-label">전일대비 변동률</span><span class="symbol-metric-value ${cr==null?'':cls(cr)}">${cr==null?'-':((cr>0?'+':'')+pct(cr))}</span></div></div></div>`}
function renderPensionCharts(x){
  const cum=pensionCumHistory(x.date);
  if(!cum.length) return '';
  const last=cum.at(-1),prevCum=cum.length>1?cum.at(-2):null,best=cum.reduce((a,b)=>b['합계 : 누적손익']>a['합계 : 누적손익']?b:a,cum[0]),
        bestDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']>a['합계 : 전일대비손익']?b:a,cum[0]),
        worstDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']<a['합계 : 전일대비손익']?b:a,cum[0]),
        mdd=calcMdd(cum),
        symbols=x.pensionRows.map(r=>{const prevProfit=r.prevEval==null?null:r.prevEval-r.cost;return {...r,prevProfit,dayChange:prevProfit==null?null:r.profit-prevProfit};}),
        symbolTotal=symbols.reduce((a,h)=>a+h.profit,0),
        lastProfit=last['합계 : 누적손익'], lastReturn=last['합계 : 누적수익률'],
        profitDelta=prevCum?lastProfit-prevCum['합계 : 누적손익']:0,
        returnDelta=prevCum?lastReturn-prevCum['합계 : 누적수익률']:0,
        bestGap=best['합계 : 누적손익']-lastProfit,
        bestDetail=bestGap===0?'금일 갱신':'금일 대비 '+signed(bestGap,'원');
  const productEvalTotal=x.pensionRows.reduce((a,r)=>a+r.evalAmount,0);
  const allocCards=x.pensionRows.map(r=>`<div class="mini-card"><div class="m-label">${r.name}</div><div class="m-value">${won(r.evalAmount)} <span class="small">(${(r.evalAmount/productEvalTotal*100).toFixed(1)}%)</span></div></div>`).join('');
  return `<section id="pension-investment-analysis" class="pension-chart-block"><div class="section-title"><h2><span class="section-title-icon">🗓️</span>투자 기간 분석</h2><p>퇴직연금 기준</p></div><div class="grid chart-grid">
  <div class="chart-card" id="pension-chart-cum"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">📊</span>운용수익 및 누적수익률 <span class="chart-title-sub">(전체 운용 기준)</span></h3><p>막대는 운용수익과 전일대비손익, 선은 누적수익률.</p></div></div><div class="chart-wrap"><svg class="chart" id="pensionChartCum"></svg></div><div class="chart-legend"><span class="legend-item"><span class="swatch" style="background:#ffb84d"></span>운용수익</span><span class="legend-item"><span class="swatch" style="background:#a7d7a8"></span>전일대비손익</span><span class="legend-item"><span class="swatch" style="background:#5abdf2"></span>누적수익률</span></div><div class="chart-note six"><div class="mini-card"><div class="m-label">최종 운용수익</div><div class="m-value ${cls(lastProfit)}">${won(lastProfit)}</div><div class="m-detail ${cls(profitDelta)}">전일 대비 ${signed(profitDelta,'원')}</div></div><div class="mini-card"><div class="m-label">최종 누적수익률</div><div class="m-value ${cls(lastReturn)}">${pct(lastReturn)}</div><div class="m-detail ${cls(returnDelta)}">전일 대비 ${returnDelta>0?'+':''}${returnDelta.toFixed(2)}%p</div></div><div class="mini-card"><div class="m-label">최고 운용수익(${best.날짜})</div><div class="m-value">${won(best['합계 : 누적손익'])}</div><div class="m-detail ${bestGap===0?'positive':''}">${bestDetail}</div></div><div class="mini-card"><div class="m-label">최대 낙폭</div><div class="m-value negative">${won(mdd.drop)}</div><div class="m-detail">${mdd.from} → ${mdd.to}</div></div><div class="mini-card"><div class="m-label">최고의 하루(${bestDay.날짜})</div><div class="m-value positive">${signed(bestDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail positive">전일 대비 변화</div></div><div class="mini-card"><div class="m-label">최악의 하루(${worstDay.날짜})</div><div class="m-value negative">${signed(worstDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail negative">전일 대비 변화</div></div></div></div>
  <div class="chart-card" id="pension-chart-symbol"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🧩</span>연금상품별 운용수익 <span class="chart-title-sub">(보유상품 재투자 기준)</span></h3><p>연금상품별 운용수익의 변화와 기여도를 비교.</p></div></div><div class="chart-wrap"><svg class="chart" id="pensionChartSymbol"></svg></div><div class="chart-legend">${x.pensionRows.map(r=>`<span class="legend-item"><span class="swatch" style="background:${pensionSeriesColor(r.name)}"></span>${r.name}</span>`).join('')}</div><div class="chart-note symbol-summary-grid pension-symbol-summary-grid">${symbols.sort((a,b)=>Math.abs(b.profit)-Math.abs(a.profit)).map(h=>pensionProductCard(h,symbolTotal)).join('')}</div><div class="symbol-summary-note">※ 기여도는 차트에 표시된 상품들의 운용수익 합계 기준이며, 전일대비 변동률은 전일대비 변동액 ÷ 전일의 평가금액</div></div>
  <div class="chart-card" id="pension-chart-alloc"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon">🥧</span>평가액 비중</h3><p>각 연금상품 및 현금성자산의 일자별 평가액 비중 변화.</p></div></div><div class="chart-wrap"><svg class="chart" id="pensionChartAlloc"></svg></div><div class="chart-legend">${x.pensionRows.map(r=>`<span class="legend-item"><span class="swatch" style="background:${pensionSeriesColor(r.name)}"></span>${r.name}</span>`).join('')}<span class="legend-item"><span class="swatch" style="background:#8fd18f"></span>현금성자산</span></div><div class="chart-note">${allocCards}<div class="mini-card"><div class="m-label">현재 평가총액</div><div class="m-value">${won(x.pensionEval)}</div><div class="m-detail cash-include-detail">(현금 ${won(x.pensionCash)} 포함)</div></div></div></div>
  </div></section>`;
}

function renderAccounts(x){
  const c=PORTFOLIO.constants;
  const rows=[
    ['삼성증권 계좌1',x.account1Principal,x.account1Profit,x.account1Return,'2025-10-16 최초 시작.'],
    ...(x.account2Included?[['삼성증권 계좌2',c.account2Principal,c.account2Profit,c.account2Profit/c.account2Principal*100,'2023-12-20 최초 시작. 2026-05-22 전량 매도 후 실현분 반영.']]:[]),
    ['토스증권',0,c.tossProfit,0,'2026-03-09 매수 후 익일 매도. 3/23 이전 확정 실현수익이라 전 구간 포함.']
  ];
  const hiddenNote=x.account2Included?'':'<p class="table-note"><strong>참고:</strong> 삼성증권 계좌2는 2026-05-22 전량 매도 후 실현분 반영. 선택일이 2026-05-21 이전이면 당시 전체 성과 기준에서 제외되어 이 표에서도 숨김.</p>';
  return `<section id="accounts-summary"><div class="section-title"><h2><span class="section-title-icon">📋</span>계좌별 성과 요약</h2><span class="title-badge">2023-12 이후 누적</span></div><div class="mobile-scroll accounts-scroll"><table class="accounts-table"><thead><tr><th class="accounts-name-head">구분</th><th>투자원금</th><th>누적손익</th><th>수익률</th><th>메모</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="accounts-name">${r[0]}</td><td class="num">${r[1]?fmt(r[1]):'-'}</td><td class="num ${cls(r[2])}">${fmt(r[2])}</td><td class="num ${cls(r[3])}">${r[1]?pct(r[3]):'-'}</td><td class="accounts-memo">${r[4]}</td></tr>`).join('')}</tbody></table></div>${hiddenNote}</section>`;
}
function renderSourceTables(){const c=PORTFOLIO.constants,vipProfitReinvest=c.account2ReinvestedToAccount1-c.account2Principal;return `<section id="capital-source-check" class="capital-source-section"><div class="section-title source-title"><h2><span class="section-title-icon">🧾</span>투자원금 원천 및 검산</h2></div><div class="source-panel"><div class="grid three source-grid"><div class="card source-card"><div class="label">계좌1 원천별 투입</div><table style="font-size:12px;margin-top:8px;border-radius:12px"><tbody><tr><td>금 판매액 투입</td><td class="num">4,000,000</td></tr><tr><td>근로소득 투입</td><td class="num">7,036,104</td></tr><tr><td>임시자금 투입</td><td class="num">4,955,580</td></tr><tr><td>원금 회수</td><td class="num negative">-6,089,845</td></tr><tr><td>레버수익 재투입</td><td class="num">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr><td>VIP 재투입</td><td class="num">${fmt(c.account2ReinvestedToAccount1)}</td></tr><tr class="summary-row"><td>계좌1 투자원금</td><td class="num">${fmt(c.account1Principal)}</td></tr></tbody></table></div><div class="card source-card highlight"><div class="label">전체 외부투입원금</div><div class="value">${won(c.externalPrincipal)}</div><div class="sub">외부에서 실제 들어온 돈만 계산</div><table style="font-size:12px;margin-top:12px;border-radius:12px"><tbody><tr><td>금 판매액 투입 총액</td><td class="num">${fmt(c.goldPrincipal)}</td></tr><tr><td>근로소득 순투입액</td><td class="num">${fmt(c.laborNetPrincipal)}</td></tr><tr class="summary-row"><td>합계</td><td class="num">${fmt(c.externalPrincipal)}</td></tr></tbody></table></div><div class="card source-card"><div class="label">계좌1 투자원금 검산</div><div class="value">${won(c.account1Principal)}</div><div class="sub">전체 외부투입 + 수익 재투입</div><table style="font-size:12px;margin-top:12px;border-radius:12px"><tbody><tr><td>전체 외부투입원금</td><td class="num">${fmt(c.externalPrincipal)}</td></tr><tr><td>레버 수익 재투입분</td><td class="num">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr><td>VIP 수익 재투입분</td><td class="num">${fmt(vipProfitReinvest)}</td></tr><tr class="summary-row"><td>검산값</td><td class="num">${fmt(c.account1Principal)}</td></tr></tbody></table></div></div></div></section>`}

function clear(svg){while(svg.firstChild)svg.removeChild(svg.firstChild)}
function el(name, attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e}
function tooltip(){return document.getElementById('dashTooltip')}
function showTooltip(evt, html){
  const tt=tooltip(); if(!tt) return;
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
  for(const tick of yTicks){const y=cfg.y(tick);svg.appendChild(el('line',{x1:l,y1:y,x2:w-r,y2:y,stroke:'#e5e7eb','stroke-width':1}));const tx=el('text',{x:l-10,y:y+4,'text-anchor':'end','font-size':11,fill:'#6b7280'});tx.textContent=fmt(tick);svg.appendChild(tx)}
  svg.appendChild(el('line',{x1:l,y1:t,x2:l,y2:h-b,stroke:'#cbd5e1'}));
  svg.appendChild(el('line',{x1:l,y1:h-b,x2:w-r,y2:h-b,stroke:'#cbd5e1'}));
  if(y2Ticks){for(const tick of y2Ticks){const y=cfg.y2(tick);const tx=el('text',{x:w-r+10,y:y+4,'text-anchor':'start','font-size':11,fill:'#6b7280'});tx.textContent=tick.toFixed(0)+'%';svg.appendChild(tx)}svg.appendChild(el('line',{x1:w-r,y1:t,x2:w-r,y2:h-b,stroke:'#cbd5e1'}))}
}

function chartX(cfg,dataLength,index){
  const plotW=cfg.w-cfg.l-cfg.r;
  const edge=Number(cfg.edgePad||0);
  if(dataLength<=1) return cfg.l+plotW/2;
  return cfg.l+edge+index*(plotW-edge*2)/(dataLength-1);
}

function labelDates(svg,cfg,data,every=3){
  const{h,b}=cfg;
  data.forEach((d,i)=>{if(i%every===0||i===data.length-1){const x=chartX(cfg,data.length,i);const txt=el('text',{x:x,y:h-b+32,transform:`rotate(-65 ${x} ${h-b+32})`,'text-anchor':'end','font-size':10,fill:'#6b7280'});txt.textContent=d['날짜'];svg.appendChild(txt)}})
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
function addHover(svg,cfg,data,renderHtml){
  const line=el('line',{x1:cfg.l,y1:cfg.t,x2:cfg.l,y2:cfg.h-cfg.b,stroke:'#334155','stroke-width':1.2,'stroke-dasharray':'4 4',opacity:0,class:'chart-hover-line'});
  svg.appendChild(line);
  const hit=el('rect',{x:cfg.l,y:cfg.t,width:cfg.w-cfg.l-cfg.r,height:cfg.h-cfg.t-cfg.b,class:'svg-hitbox'});
  svg.appendChild(hit);
  const show=evt=>{const idx=nearestIndex(evt,svg,cfg,data);const x=chartX(cfg,data.length,idx);line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('opacity',1);showTooltip(evt,renderHtml(data[idx],idx))};
  hit.addEventListener('mousemove',show);
  hit.addEventListener('pointerdown',show);
  hit.addEventListener('mouseleave',()=>{line.setAttribute('opacity',0);hideTooltip()});
  svg.addEventListener('pointerdown',evt=>{if(evt.target!==hit)clearChartHover()});
}

function safeScale(min,max,pad=0){
  if(!Number.isFinite(min)||!Number.isFinite(max)) return {min:0,max:1};
  if(min===max){
    const base=Math.max(1,Math.abs(max))*0.1;
    return {min:min-base,max:max+base};
  }
  const span=max-min;
  return {min:min-span*pad,max:max+span*pad};
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
function alignedDualTickInfo(leftMin,leftMax,leftStep,rightMin,rightMax,rightStep){
  const lb=Math.ceil(Math.max(0,-leftMin)/leftStep);
  const la=Math.ceil(Math.max(0,leftMax)/leftStep);
  const rb=Math.ceil(Math.max(0,-rightMin)/rightStep);
  const ra=Math.ceil(Math.max(0,rightMax)/rightStep);
  const below=Math.max(lb,rb,1);
  const above=Math.max(la,ra,1);
  const leftTicks=[],rightTicks=[];
  for(let i=-below;i<=above;i++){
    leftTicks.push(Math.round(i*leftStep));
    rightTicks.push(Math.round(i*rightStep));
  }
  return {
    left:{min:leftTicks[0],max:leftTicks[leftTicks.length-1],ticks:leftTicks},
    right:{min:rightTicks[0],max:rightTicks[rightTicks.length-1],ticks:rightTicks}
  };
}

function pensionSeriesColor(name){
  const rows=PORTFOLIO?.pension||[];
  const idx=Math.max(0,rows.findIndex(r=>r.name===name));
  const palette=['#42a5f5','#8bc34a','#ffb84d','#8fd18f','#ab47bc','#26c6da'];
  return palette[idx%palette.length];
}
function drawPensionCumChart(){
  const data=pensionCumHistory(ACTIVE_DATE),svg=document.getElementById('pensionChartCum');if(!svg||!data.length)return;clear(svg);
  const profits=data.map(d=>d['합계 : 누적손익']),daily=data.map(d=>d['합계 : 전일대비손익']),returns=data.map(d=>d['합계 : 누적수익률']);
  const tickInfo=alignedDualTickInfo(Math.min(...profits,...daily),Math.max(...profits,...daily),5000000,Math.min(...returns),Math.max(...returns),20);
  const yInfo=tickInfo.left,rInfo=tickInfo.right;
  const w=1120,h=330,l=82,rgt=66,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const plotW=w-l-rgt,n=data.length,barW=Math.max(8,plotW/Math.max(1,n)/3);
  const edgePad=Math.max(24,barW*2.1);
  const cfg={w,h,l,r:rgt,t,b,edgePad,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b),y2:v=>t+(rInfo.max-v)/(rInfo.max-rInfo.min)*(h-t-b)};
  drawAxes(svg,cfg,yInfo.ticks,rInfo.ticks);
  data.forEach((d,i)=>{
    const x=chartX(cfg,n,i),p=d['합계 : 누적손익'],dy=d['합계 : 전일대비손익'];
    const y0=cfg.y(0);
    [[p,'#ffb84d',-barW*.6],[dy,'#a7d7a8',barW*.6]].forEach(([v,color,off])=>{
      const y=cfg.y(v),hh=Math.abs(y0-y);
      svg.appendChild(el('rect',{x:x+off-barW/2,y:Math.min(y,y0),width:barW,height:hh,rx:3,fill:color,opacity:.9}));
    });
  });
  const pts=data.map((d,i)=>[chartX(cfg,n,i),cfg.y2(d['합계 : 누적수익률'])]);
  polyline(svg,pts,'#5abdf2',2.8);circles(svg,pts,'#5abdf2');labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>`<div class="tt-date">${d['날짜']}</div>${row('운용수익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']))}${row('전일대비손익',signed(d['합계 : 전일대비손익'],'원'),clsBy(d['합계 : 전일대비손익']))}${row('누적수익률',(d['합계 : 누적수익률']>0?'+':'')+pct(d['합계 : 누적수익률']),clsBy(d['합계 : 누적수익률']))}`);
}

function drawPensionSymbolChart(){
  const data=pensionSymbolHistory(ACTIVE_DATE),svg=document.getElementById('pensionChartSymbol');if(!svg||!data.length)return;clear(svg);
  const series=(PORTFOLIO.pension||[]).map(r=>r.name),values=data.flatMap(d=>series.map(s=>d[s]||0));
  const yInfo=fixedTickInfo(Math.min(...values),Math.max(...values),2000000,true),w=1120,h=330,l=82,r=25,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const cfg={w,h,l,r,t,b,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b)};drawAxes(svg,cfg,yInfo.ticks);
  const plotW=w-l-r,n=data.length;series.forEach(name=>{const pts=data.map((d,i)=>[l+(n===1?0:i*plotW/(n-1)),cfg.y(d[name]||0)]);polyline(svg,pts,pensionSeriesColor(name));circles(svg,pts,pensionSeriesColor(name))});labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=`<div class="tt-date">${d['날짜']}</div>`;series.forEach(s=>html+=row(s,signed(d[s]||0,'원'),clsBy(d[s]||0)));const total=series.reduce((a,s)=>a+(d[s]||0),0);return html+'<div style="height:6px"></div>'+row('상품 합계',signed(total,'원'),clsBy(total))});
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
  const data=cumHistory(ACTIVE_DATE),svg=document.getElementById('chartCum');if(!svg)return;clear(svg);
  const w=1120,h=330,l=70,r=70,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const vals=data.flatMap(d=>[d['합계 : 누적손익'],d['합계 : 전일대비손익']]);
  const rates=data.map(d=>d['합계 : 누적수익률']);
  const tickInfo=alignedDualTickInfo(Math.min(-4000000,...vals),Math.max(12000000,...vals),2000000,Math.min(-20,...rates),Math.max(80,...rates),20);
  const yInfo=tickInfo.left,rInfo=tickInfo.right;
  const plotW=w-l-r,n=data.length,gap=plotW/Math.max(n,1),bw=gap*.28;
  const edgePad=Math.max(24,bw*2.1);
  const cfg={w,h,l,r,t,b,edgePad,y:v=>t+(yInfo.max-v)/(yInfo.max-yInfo.min)*(h-t-b),y2:v=>t+(rInfo.max-v)/(rInfo.max-rInfo.min)*(h-t-b)};
  drawAxes(svg,cfg,yInfo.ticks,rInfo.ticks);
  data.forEach((d,i)=>{const x=chartX(cfg,n,i),zero=cfg.y(0),cp=cfg.y(d['합계 : 누적손익']);svg.appendChild(el('rect',{x:x-bw-1,y:Math.min(cp,zero),width:bw,height:Math.abs(zero-cp),fill:'#ffb84d',opacity:.8}));const day=cfg.y(d['합계 : 전일대비손익']);svg.appendChild(el('rect',{x:x+2,y:Math.min(day,zero),width:bw,height:Math.abs(zero-day),fill:d['합계 : 전일대비손익']>=0?'#a7d7a8':'#c7e6c8',stroke:d['합계 : 전일대비손익']<0?'#86b58a':'none',opacity:.9}))});
  const pts=data.map((d,i)=>[chartX(cfg,n,i),cfg.y2(d['합계 : 누적수익률'])]);
  polyline(svg,pts,'#5abdf2',2.5);circles(svg,pts,'#5abdf2');labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>`<div class="tt-date">${d['날짜']}</div>`+row('누적손익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']))+row('누적수익률',pct(d['합계 : 누적수익률']),clsBy(d['합계 : 누적수익률']))+row('전일대비손익',signed(d['합계 : 전일대비손익'],'원'),clsBy(d['합계 : 전일대비손익'])));
}

function drawLineChart(){
  const data=symbolHistory(ACTIVE_DATE),svg=document.getElementById('chartSymbol');if(!svg)return;clear(svg);
  const series=['SK하이닉스','삼성전자','현대차','KODEX 200'],colors={'SK하이닉스':'#ff8a65','삼성전자':'#8bc34a','현대차':'#26c6da','KODEX 200':'#42a5f5'},values=data.flatMap(d=>series.map(s=>d[s]||0));
  const minY=Math.min(-1000000,...values),maxY=Math.max(7000000,...values),w=1120,h=330,l=70,r=25,t=22,b=72;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const cfg={w,h,l,r,t,b,y:v=>t+(maxY-v)/(maxY-minY)*(h-t-b)};drawAxes(svg,cfg,[-1000000,0,1000000,2000000,3000000,4000000,5000000,6000000,7000000]);
  const plotW=w-l-r,n=data.length;series.forEach(s=>{const pts=data.map((d,i)=>[l+(n===1?0:i*plotW/(n-1)),cfg.y(d[s]||0)]);polyline(svg,pts,colors[s]);circles(svg,pts,colors[s])});labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=`<div class="tt-date">${d['날짜']}</div>`;series.forEach(s=>html+=row(s,signed(d[s]||0,'원'),clsBy(d[s]||0)));const total=series.reduce((a,s)=>a+(d[s]||0),0);return html+'<div style="height:6px"></div>'+row('4종목 합계',signed(total,'원'),clsBy(total))});
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
  document.querySelectorAll('.mobile-scroll, .chart-wrap').forEach(wrap=>{
    const prev=wrap.previousElementSibling;
    if(prev&&prev.classList.contains('scroll-hint'))prev.remove();
    const scrollable=wrap.scrollWidth>wrap.clientWidth+4;
    wrap.classList.toggle('is-scrollable',scrollable);
    if(scrollable){const hint=document.createElement('div');hint.className='scroll-hint';hint.textContent='좌우로 밀어 더 보기';wrap.parentNode.insertBefore(hint,wrap)}
  });
}
function drawAllCharts(){drawCumChart();drawLineChart();drawStacked();drawPensionCumChart();drawPensionSymbolChart();drawPensionStacked();refreshScrollHints();setTimeout(refreshScrollHints,120)}



function openPensionContributionModal(){
  const modal=document.getElementById('pensionContribModal');
  if(!modal) return;
  document.body.classList.add('contrib-modal-open');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  setPensionContributionSaveMode(pensionContributionSaveMode);
  setTimeout(()=>document.getElementById('pensionContribDate')?.focus(),0);
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
  if(e.key==='Escape') closePensionContributionModal();
});

function cleanNumberInput(v){
  return Number(String(v||'').replace(/[^\d.-]/g,''));
}

function pensionContributionTarget(){
  return document.getElementById('pensionContribTarget')?.value==='cashSnapshot'?'cashSnapshot':'contribution';
}
function pensionContributionTargetLabel(target=pensionContributionTarget()){
  return target==='cashSnapshot'?'현금성자산 평가금액':'기업적립금';
}
function setPensionContributionTarget(target){
  const el=document.getElementById('pensionContribTarget');
  if(el) el.value=target==='cashSnapshot'?'cashSnapshot':'contribution';
  syncPensionContributionTargetUi();
}
function syncPensionContributionTargetUi(){
  const target=pensionContributionTarget();
  document.querySelectorAll('.contrib-target-option').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.target===target);
  });
  const dateEl=document.getElementById('pensionContribDate');
  const amountEl=document.getElementById('pensionContribAmount');
  const memoEl=document.getElementById('pensionContribMemo');
  const amountLabel=document.getElementById('pensionContribAmountLabel');
  if(amountLabel) amountLabel.textContent=target==='cashSnapshot'?'평가금액':'금액';
  if(dateEl) dateEl.value=target==='cashSnapshot'?(dateEl.dataset.cashDefaultDate||dateEl.value):(dateEl.dataset.contribDefaultDate||dateEl.value);
  if(amountEl) amountEl.value=target==='cashSnapshot'?(amountEl.dataset.cashDefaultValue||''):(amountEl.dataset.contribDefaultValue||'618,060');
  if(memoEl) memoEl.value=target==='cashSnapshot'?(memoEl.dataset.cashDefaultMemo||'현금성자산 평가금액 앱 확인'):(memoEl.dataset.contribDefaultMemo||defaultPensionContributionMemo(dateEl?.value||''));
}
function buildPensionContributionItem(){
  const target=pensionContributionTarget();
  const dateEl=document.getElementById('pensionContribDate');
  const amountEl=document.getElementById('pensionContribAmount');
  const memoEl=document.getElementById('pensionContribMemo');
  if(!dateEl||!amountEl||!memoEl) throw new Error('입력칸을 찾지 못했습니다.');
  const date=dateEl.value;
  const amount=cleanNumberInput(amountEl.value);
  const memo=memoEl.value.trim()||(target==='cashSnapshot'?'현금성자산 평가금액 앱 확인':defaultPensionContributionMemo(date));
  if(!date) throw new Error('일자를 입력해주세요.');
  if(!amount || amount<=0) throw new Error(target==='cashSnapshot'?'평가금액을 입력해주세요.':'금액을 입력해주세요.');
  if(target==='cashSnapshot') return {target,date,valuation:amount,memo};
  return {target,date,amount,memo};
}
function showPensionContributionStatus(message,type='ok'){
  const status=document.getElementById('pensionContribStatus');
  if(!status) return;
  status.textContent=message;
  status.className=`contrib-status show ${type}`;
}

function requestPensionActionPin({title='PIN 입력',description='저장/삭제를 계속하려면 PIN을 입력하세요.',confirmText='확인',danger=false}={}){
  return new Promise(resolve=>{
    const old=document.getElementById('pensionActionPinModal');
    if(old) old.remove();

    const modal=document.createElement('div');
    modal.id='pensionActionPinModal';
    modal.className='pension-action-pin-modal';
    modal.innerHTML=`<div class="pension-action-pin-card" role="dialog" aria-modal="true" aria-labelledby="pensionActionPinTitle">
      <button type="button" class="pension-action-pin-close" aria-label="닫기">×</button>
      <div class="pension-action-pin-icon">🔐</div>
      <h3 id="pensionActionPinTitle">${title}</h3>
      <p>${description}</p>
      <label for="pensionActionPinInput">PIN</label>
      <input id="pensionActionPinInput" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN 입력">
      <div id="pensionActionPinStatus" class="pension-action-pin-status"></div>
      <div class="pension-action-pin-buttons">
        <button type="button" class="ghost">취소</button>
        <button type="button" class="primary ${danger?'danger':''}">${confirmText}</button>
      </div>
    </div>`;

    const finish=value=>{
      modal.remove();
      resolve(value);
    };
    const input=modal.querySelector('#pensionActionPinInput');
    const status=modal.querySelector('#pensionActionPinStatus');
    const primary=modal.querySelector('.primary');
    const cancel=modal.querySelector('.ghost');
    const close=modal.querySelector('.pension-action-pin-close');

    const submit=()=>{
      const pin=String(input?.value||'').trim();
      if(!pin){
        if(status) status.textContent='PIN을 입력해 주세요.';
        input?.focus();
        return;
      }
      finish(pin);
    };

    primary?.addEventListener('click',submit);
    cancel?.addEventListener('click',()=>finish(null));
    close?.addEventListener('click',()=>finish(null));
    modal.addEventListener('click',e=>{if(e.target===modal)finish(null)});
    input?.addEventListener('keydown',e=>{
      if(e.key==='Enter') submit();
      if(e.key==='Escape') finish(null);
    });

    document.body.appendChild(modal);
    requestAnimationFrame(()=>input?.focus());
  });
}

function generatePensionContributionJson(){
  const out=document.getElementById('pensionContribOutput');
  if(!out) return;
  try{
    const item=buildPensionContributionItem();
    out.textContent=JSON.stringify(item,null,2);
    out.classList.add('show');
    showPensionContributionStatus('JSON 생성 완료. 수동 반영이 필요하면 대상 data 파일에 반영해주세요.','ok');
  }catch(e){
    out.textContent=e.message||String(e);
    out.classList.add('show');
    showPensionContributionStatus(e.message||String(e),'err');
  }
}
async function copyPensionContributionJson(){
  const out=document.getElementById('pensionContribOutput');
  if(!out) return;
  if(!out.textContent.trim() || out.textContent.includes('복사 완료')) generatePensionContributionJson();
  if(!out.textContent.trim()) return;
  const text=out.textContent.replace(/\n\n복사 완료$/,'');
  try{
    await navigator.clipboard.writeText(text);
    out.textContent=text + '\n\n복사 완료';
    showPensionContributionStatus('복사 완료.','ok');
  }catch(e){
    showPensionContributionStatus('복사는 브라우저 권한 때문에 실패. 위 내용을 직접 선택해서 복사해주세요.','err');
  }
}

async function savePensionContributionViaGithubPages(item,pin){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.githubPages;

  if(!config.url || config.url.includes('여기에_')){
    throw new Error('GitHub Pages 저장 URL이 설정되지 않았습니다.');
  }

  const res=await fetch(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({
      pin:String(pin||'').trim(),
      target:item.target||'contribution',
      action:'upsert',
      date:item.date,
      amount:item.amount,
      valuation:item.valuation,
      memo:item.memo||'',
      updatedBy:'github-pages'
    })
  });

  const data=await res.json().catch(()=>({}));

  if(!data.ok){
    throw new Error(data.error||'GitHub Pages 방식 저장 실패');
  }

  return data;
}

async function savePensionContributionViaNetlify(item,pin){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.netlify;

  const res=await fetch(config.url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      pin:String(pin||'').trim(),
      action:'upsert',
      item:{...item,updatedBy:'netlify'}
    })
  });

  const data=await res.json().catch(()=>({}));

  if(!res.ok){
    throw new Error(data.error||`Netlify 방식 저장 실패 (${res.status})`);
  }

  return data;
}

async function savePensionContributionByMode(item,pin){
  if(pensionContributionSaveMode==='githubPages'){
    return savePensionContributionViaGithubPages(item,pin);
  }

  return savePensionContributionViaNetlify(item,pin);
}

async function savePensionContribution(){
  const out=document.getElementById('pensionContribOutput');

  try{
    const item=buildPensionContributionItem();

    if(out){
      out.textContent=JSON.stringify(item,null,2);
      out.classList.add('show');
    }

    const modeLabel=pensionContributionModeLabel();
    const targetText=pensionContributionTargetLabel(item.target);
    const pin=await requestPensionActionPin({
      title:`${targetText} 저장`,
      description:`${modeLabel} 방식으로 GitHub 파일에 저장합니다. 계속하려면 PIN을 입력하세요.`,
      confirmText:'저장 실행'
    });
    if(!pin){
      showPensionContributionStatus('저장이 취소되었습니다.','err');
      return;
    }

    showPensionContributionStatus(`${modeLabel} 방식으로 저장 중... GitHub 파일을 업데이트하고 있습니다.`,'ok');

    const data=await savePensionContributionByMode(item,pin);

    const actionText=data.action==='updated'?'기존 항목 수정':'신규 항목 추가';
    if(pensionContributionSaveMode==='githubPages'){
      showPensionContributionStatus(`${targetText} ${actionText} 완료. GitHub Pages 반영까지 1~3분 정도 걸릴 수 있습니다.`,'ok');
    }else{
      showPensionContributionStatus(`${targetText} ${actionText} 완료. Netlify 재배포가 끝나면 화면에 반영됩니다. commit: ${data.commitSha||'-'}`,'ok');
    }

  }catch(e){
    showPensionContributionStatus(e.message||String(e),'err');
  }
}

async function deletePensionContributionViaGithubPages(target,key,pin){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.githubPages;

  if(!config.url || config.url.includes('여기에_')){
    throw new Error('GitHub Pages 삭제 URL이 설정되지 않았습니다.');
  }

  const isCash=target==='cashSnapshot';

  const res=await fetch(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({
      pin:String(pin||'').trim(),
      target:target||'contribution',
      action:'delete',
      id:isCash?'':key,
      date:isCash?key:''
    })
  });

  const data=await res.json().catch(()=>({}));

  if(!data.ok){
    throw new Error(data.error||'GitHub Pages 방식 삭제 실패');
  }

  return data;
}

async function deletePensionContributionViaNetlify(target,key,pin){
  const isCash=target==='cashSnapshot';

  const res=await fetch('/.netlify/functions/save-pension-contribution',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      pin:String(pin||'').trim(),
      target:target||'contribution',
      action:'delete',
      id:isCash?'':key,
      date:isCash?key:''
    })
  });

  const data=await res.json().catch(()=>({}));

  if(!res.ok){
    throw new Error(data.error||`Netlify 방식 삭제 실패 (${res.status})`);
  }

  return data;
}

async function deleteSelectedPensionContribution(){
  const selected=document.querySelector('input[name="pensionContribDeleteTarget"]:checked');

  if(!selected){
    showPensionContributionStatus('삭제할 항목을 선택해주세요.','err');
    return;
  }

  const [target,key]=String(selected.value||'').split('|');
  const isCash=target==='cashSnapshot';
  const item=isCash?pensionCashSnapshotItems().find(v=>v.date===key):pensionContributionItems().find(v=>v.id===key);
  const date=item?.date||key;
  const amount=item?won(Number(isCash?item.valuation:item.amount)||0):'선택 항목';
  const targetText=pensionContributionTargetLabel(isCash?'cashSnapshot':'contribution');
  const modeLabel=pensionContributionModeLabel();

  const pin=await requestPensionActionPin({
    title:`${targetText} 삭제`,
    description:`${date} / ${targetText} / ${amount} 항목을 ${modeLabel} 방식으로 삭제합니다. 계속하려면 PIN을 입력하세요.`,
    confirmText:'삭제 실행',
    danger:true
  });
  if(!pin){
    showPensionContributionStatus('삭제가 취소되었습니다.','err');
    return;
  }

  try{
    showPensionContributionStatus(`${modeLabel} 방식으로 삭제 중... GitHub 파일을 업데이트하고 있습니다.`,'ok');

    const data=pensionContributionSaveMode==='githubPages'
    ? await deletePensionContributionViaGithubPages(target,key,pin)
    : await deletePensionContributionViaNetlify(target,key,pin);

    if(pensionContributionSaveMode==='githubPages'){
      showPensionContributionStatus('선택 항목 삭제 완료. GitHub Pages 반영까지 1~3분 정도 걸릴 수 있습니다.','ok');
    }else{
      showPensionContributionStatus(`선택 항목 삭제 완료. Netlify 재배포가 끝나면 화면에 반영됩니다. commit: ${data.commitSha||'-'}`,'ok');
    }

  }catch(e){
    showPensionContributionStatus(e.message||String(e),'err');
  }
}


document.addEventListener('click',e=>{
  const actionWrap=e.target.closest?.('.date-action-menu-wrap');
  if(!actionWrap) closeDateActionMenu();
  const wrap=e.target.closest?.('.mobile-nav-menu-wrap');
  if(!wrap) closeMobileNavMenu();
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

async function boot(){[PORTFOLIO,PRICES,SNAPSHOTS,ACCOUNT1_DAILY,PENSION_CONTRIBUTIONS,PENSION_CASH_SNAPSHOTS]=await Promise.all([fetch('data/portfolio.json?ts='+Date.now()).then(r=>r.json()),fetch('data/prices.json?ts='+Date.now()).then(r=>r.json()),fetch('data/performance_snapshots.json?ts='+Date.now()).then(r=>r.json()),fetch('data/account1_daily_snapshots.json?ts='+Date.now()).then(r=>r.json()).catch(()=>({})),fetch('data/pension_contributions.json?ts='+Date.now()).then(r=>r.json()).catch(()=>({contributions:[]})),fetch('data/pension_cash_snapshots.json?ts='+Date.now()).then(r=>r.json()).catch(()=>({snapshots:[]}))]);const dates=allAvailableDates(),hash=location.hash.replace('#','');ACTIVE_DATE=dates.includes(hash)?hash:dates.at(-1);render();document.getElementById('tabs').addEventListener('change',e=>{
  if(e.target.id==='monthSelect'){
    const month=e.target.value,dates=allAvailableDates().filter(d=>d.startsWith(month));
    ACTIVE_DATE=dates.at(-1);
    history.replaceState(null,'','#'+ACTIVE_DATE);
    render();
  }
  if(e.target.id==='dateSelect'){
    ACTIVE_DATE=e.target.value;
    history.replaceState(null,'','#'+ACTIVE_DATE);
    render();
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
