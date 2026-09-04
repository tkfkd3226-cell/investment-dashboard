const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const coreSource=fs.readFileSync(path.join(ROOT,'js/dashboard-core.js'),'utf8');
let core;

const approx=(actual,expected,tolerance=1e-9)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,`expected ${actual} ≈ ${expected}`);
};

function baseConstants(overrides={}){
  return {
    account1Principal:2000,
    account1ProfitAdjustment:0,
    account2Profit:400,
    account2Principal:1500,
    account2RealizedAmount:1700,
    account2ReinvestedToAccount1:1500,
    tossProfit:100,
    tossRealizedAmount:600,
    tossReinvestedToAccount1:500,
    externalPrincipal:5000,
    outsideCash:0,
    livingSpent:0,
    securitiesCash:500,
    pensionContributionPrincipal:1000,
    pensionCashCost:0,
    ...overrides
  };
}

function basePortfolio(overrides={}){
  return {
    constants:baseConstants(),
    securities:[
      {name:'ETF A',ticker:'A',type:'ETF',qty:10,cost:1000,chart:true},
      {name:'Stock B',ticker:'B',type:'개별주식',qty:5,cost:1000,chart:true}
    ],
    securitiesEvents:[],
    pension:[],
    separateProfit:{trades:[],reinvestedLimit:0},
    ...overrides
  };
}

function dailySnapshot({profit=300,totalEval=2500,cash=500,etfEval=1200,stockEval=800}={}){
  const etfProfit=200;
  const stockProfit=profit-etfProfit;
  return {
    holdings:[
      {name:'ETF A',ticker:'A',type:'ETF',qty:10,cost:1000,price:etfEval/10,evalAmount:etfEval,profit:etfProfit},
      {name:'Stock B',ticker:'B',type:'개별주식',qty:5,cost:1000,price:stockEval/5,evalAmount:stockEval,profit:stockProfit}
    ],
    cash,
    totalCost:2000,
    totalProfit:profit,
    totalEval
  };
}

function resetState(){
  Object.assign(core.dataState,{
    portfolio:basePortfolio(),
    prices:{},
    snapshots:{},
    account1Daily:{},
    pensionContributions:{contributions:[]},
    pensionCashSnapshots:{snapshots:[]},
    pensionTrades:{trades:[]},
    activeDate:null
  });
  Object.assign(core.uiState,{
    activeAssetTab:'securities',
    personalViewUnlocked:false,
    includeSeparateProfit:false
  });
}

function setState(overrides={}){
  resetState();
  if(overrides.portfolio)core.dataState.portfolio=overrides.portfolio;
  for(const key of ['prices','snapshots','account1Daily','pensionContributions','pensionCashSnapshots','pensionTrades','activeDate']){
    if(Object.prototype.hasOwnProperty.call(overrides,key))core.dataState[key]=overrides[key];
  }
}

test.before(async()=>{
  const url='data:text/javascript;base64,'+Buffer.from(coreSource).toString('base64');
  core=await import(url);
});

test.beforeEach(()=>resetState());

test('dayChangeRate: 당일 외부 유입은 전일 평가액에 더해 수익률 분모를 보정한다',()=>{
  approx(core.dayChangeRate(120,1000,200),10);
  assert.equal(core.dayChangeRate(120,0,0),null);
});

test('Main calc: 계좌2·토스 시작 전에는 계좌1 수치만 합계에 반영한다',()=>{
  setState({
    prices:{'2026-03-20':{}},
    account1Daily:{'2026-03-20':dailySnapshot()}
  });
  const x=core.calc('2026-03-20');
  assert.equal(x.account2Included,false);
  assert.equal(x.tossIncluded,false);
  assert.equal(x.account1Principal,2000);
  assert.equal(x.account1Profit,300);
  assert.equal(x.account1Result,2300);
  assert.equal(x.totalPrincipal,2000);
  assert.equal(x.totalProfit,300);
  assert.equal(x.totalResult,2300);
  approx(x.returnRate,15);
});

test('Main calc: 토스 시작일 이후에는 토스 실현손익과 잔액만 해당 합계에 포함한다',()=>{
  setState({
    prices:{'2026-03-20':{},'2026-03-23':{}},
    account1Daily:{'2026-03-20':dailySnapshot({profit:250}), '2026-03-23':dailySnapshot({profit:300})}
  });
  const x=core.calc('2026-03-23');
  assert.equal(x.account2Included,false);
  assert.equal(x.tossIncluded,true);
  assert.equal(x.tossProfit,100);
  assert.equal(x.tossRemainder,100);
  assert.equal(x.totalProfit,400);
  assert.equal(x.totalResult,2400);
  assert.equal(x.totalPrincipal,2000);
});

test('Main calc: 계좌2 시작일 이후 전체 투자원금은 외부투입원금 기준을 사용한다',()=>{
  setState({
    prices:{'2026-05-21':{},'2026-05-22':{}},
    account1Daily:{'2026-05-21':dailySnapshot({profit:250}), '2026-05-22':dailySnapshot({profit:300})}
  });
  const x=core.calc('2026-05-22');
  assert.equal(x.account2Included,true);
  assert.equal(x.tossIncluded,true);
  assert.equal(x.account2Profit,400);
  assert.equal(x.account2Remainder,200);
  assert.equal(x.totalPrincipal,5000);
  assert.equal(x.totalProfit,800);
  assert.equal(x.totalResult,2600);
  approx(x.returnRate,16);
});

test('Main calc: 6/18 이후 계좌1 원금은 보유종목 cost 합계를 canonical 원금으로 사용한다',()=>{
  const portfolio=basePortfolio({constants:baseConstants({account1Principal:2000,externalPrincipal:5000})});
  setState({
    portfolio,
    prices:{'2026-06-18':{}},
    account1Daily:{'2026-06-18':dailySnapshot({profit:300,totalEval:2500})}
  });
  assert.equal(core.isLedgerCheckDate('2026-06-18'),true);
  assert.equal(core.account1PrincipalForDate('2026-06-18'),2000);
  assert.equal(core.account1SourceHoldingGapForDate('2026-06-18'),0);
});

test('별도수익: 누적수익은 거래일까지 합산하고 재투입 반영액은 세 기준의 최소값으로 제한한다',()=>{
  const portfolio=basePortfolio({
    constants:baseConstants(),
    separateProfit:{reinvestedLimit:700,trades:[
      {date:'2026-06-01',profit:400},
      {date:'2026-06-10',profit:500},
      {date:'2026-06-20',profit:-100}
    ]},
    securitiesEvents:[
      {date:'2026-06-05',type:'contribution',amount:600,fundingClass:'performanceExcludedTransfer'},
      {date:'2026-06-15',type:'contribution',amount:300,fundingClass:'performanceExcludedTransfer'}
    ]
  });
  setState({portfolio});
  assert.equal(core.separateProfitCumulativeForDate('2026-06-10'),900);
  assert.equal(core.securityExcludedTransferSum('2026-06-10'),600);
  assert.equal(core.separateProfitReinvestedForDate('2026-06-10'),600);
  assert.equal(core.separateProfitReinvestedForDate('2026-06-20'),700);
});

test('별도수익 OFF/ON: 원본 계산값은 유지하고 표시용 principal/profit/result만 재분류한다',()=>{
  const portfolio=basePortfolio({
    separateProfit:{reinvestedLimit:500,trades:[{date:'2026-06-01',profit:800}]},
    securitiesEvents:[{date:'2026-06-02',type:'contribution',amount:500,fundingClass:'performanceExcludedTransfer'}]
  });
  setState({portfolio});
  const base={date:'2026-06-10',account1Principal:2000,account1Profit:300,account1Result:2300,totalPrincipal:5000,totalProfit:800,totalResult:5800,combinedPrincipal:6000,combinedProfit:900,combinedResult:6900};
  core.uiState.includeSeparateProfit=false;
  const off=core.separateProfitView(base);
  assert.equal(off.separateProfit,0);
  assert.equal(off.totalPrincipal,5000);
  assert.equal(off.totalProfit,800);

  core.uiState.includeSeparateProfit=true;
  const on=core.separateProfitView(base);
  assert.equal(on.separateProfit,800);
  assert.equal(on.reclassifiedReinvestment,500);
  assert.equal(on.totalPrincipal,4500);
  assert.equal(on.totalProfit,1600);
  assert.equal(on.totalResult,6100);
  approx(on.totalReturn,1600/4500*100);
});

test('증권 allocation: 1주 보유는 명시적 chart opt-in 전까지 allocation에서 제외한다',()=>{
  const x={date:'2026-06-10',holdings:[
    {name:'일반',qty:5,evalAmount:500,type:'ETF'},
    {name:'1주 기본',qty:1,evalAmount:100,type:'개별주식'},
    {name:'1주 명시',qty:1,evalAmount:120,type:'개별주식',chart:true,chartFrom:'2026-06-01'}
  ]};
  assert.deepEqual(core.securityAllocVisibleHoldings(x).map(v=>v.name),['일반','1주 명시']);
  assert.equal(core.securityAllocOneShareEval(x),100);
  assert.deepEqual(core.securityAllocTypeTotals(x),{etf:500,stock:120});
});

test('연금 거래: 매수 후 일부 매도는 잔여 cost와 실현손익을 정확히 분리한다',()=>{
  setState({
    pensionTrades:{trades:[
      {id:'b1',date:'2026-06-02',ticker:'P',name:'Pension',type:'buy',qty:5,price:100,amount:500},
      {id:'s1',date:'2026-06-03',ticker:'P',name:'Pension',type:'sell',qty:3,price:130,amount:390,costBasis:300}
    ]}
  });
  const state=core.pensionPositionState({ticker:'P',qty:10,cost:1000},'2026-06-03');
  assert.equal(state.qty,12);
  assert.equal(state.cost,1200);
  assert.equal(state.realizedProfit,90);
});

test('연금 현금: 기준 현금 + 적립금 - 매수 + 매도로 가용현금을 계산한다',()=>{
  setState({
    prices:{'2026-06-01':{pension:{cash:1000}}},
    pensionContributions:{contributions:[{id:'c1',date:'2026-06-02',amount:500}]},
    pensionTrades:{trades:[
      {id:'b1',date:'2026-06-03',ticker:'P',name:'Pension',type:'buy',qty:3,price:100,amount:300},
      {id:'s1',date:'2026-06-04',ticker:'P',name:'Pension',type:'sell',qty:1,price:150,amount:150,costBasis:100}
    ]}
  });
  assert.equal(core.pensionBaseCashForDate('2026-06-04'),1000);
  assert.equal(core.pensionCashBeforeNewTrade('2026-06-04'),1350);
});

test('연금 cash snapshot: 같은 날 afterTradeIds에 포함된 거래는 snapshot에 이미 반영된 것으로 본다',()=>{
  const trade={id:'t1',date:'2026-06-05',appliedAtKST:'2026-06-05T10:00:00+09:00'};
  const reflected={date:'2026-06-05',afterTradeIds:['t1']};
  const before={date:'2026-06-05',afterTradeIds:[]};
  assert.equal(core.pensionCashSnapshotReflectsTrade(reflected,trade),true);
  assert.equal(core.pensionCashSnapshotReflectsTrade(before,trade),false);
});

test('연금 cash snapshot: 같은 날 적립금도 afterContributionIds 순서를 존중한다',()=>{
  const contribution={id:'c1',date:'2026-06-05',updatedAtKST:'2026-06-05T09:00:00+09:00'};
  assert.equal(core.pensionCashSnapshotReflectsContribution({date:'2026-06-05',afterContributionIds:['c1']},contribution),true);
  assert.equal(core.pensionCashSnapshotReflectsContribution({date:'2026-06-05',afterContributionIds:[]},contribution),false);
});

test('Main calc: 연금 데이터가 있으면 증권 + 연금을 combined principal/result/profit으로 합산한다',()=>{
  const portfolio=basePortfolio({
    pension:[{name:'연금 ETF',ticker:'278530',qty:10,cost:1000}],
    constants:baseConstants({pensionContributionPrincipal:1000,pensionCashCost:0})
  });
  setState({
    portfolio,
    prices:{'2026-03-20':{pension:{'278530':120,'395160':1,'448330':1,cash:300}}},
    account1Daily:{'2026-03-20':dailySnapshot()}
  });
  const x=core.calc('2026-03-20');
  assert.equal(x.hasPension,true);
  assert.equal(x.pensionEval,1500);
  assert.equal(x.pensionPrincipal,1000);
  assert.equal(x.pensionProfit,500);
  assert.equal(x.combinedPrincipal,3000);
  assert.equal(x.combinedResult,3800);
  assert.equal(x.combinedProfit,800);
  approx(x.combinedReturn,800/3000*100);
});

test('누적 차트 데이터: 첫 행 변화는 누적손익, 이후 행은 직전 누적손익과의 차이로 계산한다',()=>{
  setState({
    prices:{
      '2026-03-20':{indices:{KOSPI:2600}},
      '2026-03-21':{indices:{KOSPI:2610}}
    },
    account1Daily:{
      '2026-03-20':dailySnapshot({profit:100}),
      '2026-03-21':dailySnapshot({profit:160})
    }
  });
  const rows=core.cumHistory('2026-03-21');
  assert.equal(rows.length,2);
  assert.equal(rows[0]['합계 : 누적손익'],100);
  assert.equal(rows[0]['합계 : 전일대비손익'],100);
  assert.equal(rows[1]['합계 : 누적손익'],160);
  assert.equal(rows[1]['합계 : 전일대비손익'],60);
  assert.equal(rows[1]['코스피 지수'],2610);
});

test('종목 차트 데이터: chartFrom 이전 종목은 null, 활성화 이후는 손익/수익률을 계산한다',()=>{
  const portfolio=basePortfolio({
    securities:[
      {name:'ETF A',ticker:'A',type:'ETF',qty:10,cost:1000,chart:true},
      {name:'Stock B',ticker:'B',type:'개별주식',qty:5,cost:1000,chart:true,chartFrom:'2026-03-21'}
    ]
  });
  setState({
    portfolio,
    prices:{'2026-03-20':{},'2026-03-21':{}},
    account1Daily:{
      '2026-03-20':dailySnapshot({profit:100}),
      '2026-03-21':dailySnapshot({profit:160})
    }
  });
  const rows=core.symbolHistory('2026-03-21');
  assert.equal(rows[0]['Stock B'],null);
  assert.equal(rows[0]._rates['Stock B'],null);
  assert.equal(rows[1]['ETF A'],200);
  approx(rows[1]._rates['ETF A'],20);
});

test('allocation 차트 데이터: ETF/개별주식/현금의 합은 _total 평가금액과 일치한다',()=>{
  setState({
    prices:{'2026-03-20':{}},
    account1Daily:{'2026-03-20':dailySnapshot({totalEval:2500,cash:500,etfEval:1200,stockEval:800})}
  });
  const row=core.allocHistory('2026-03-20')[0];
  assert.equal(row.ETF,1200);
  assert.equal(row['개별주식'],800);
  assert.equal(row['현금'],500);
  assert.equal(row._total,2500);
  assert.equal(row.ETF+row['개별주식']+row['현금'],row._total);
});

test('Main 날짜 범위: 숨김 가격일은 제외하고 daily snapshot 날짜는 포함해 정렬한다',()=>{
  setState({
    prices:{
      '2026-03-22':{display:false},
      '2026-03-21':{},
      '2026-03-23':{}
    },
    account1Daily:{'2026-03-20':dailySnapshot()}
  });
  assert.deepEqual(core.allAvailableDates(),['2026-03-20','2026-03-21','2026-03-23']);
});

test('내부 현금이체와 외부기여금은 fundingClass 의미에 따라 서로 다른 합계에 들어간다',()=>{
  const portfolio=basePortfolio({
    securitiesEvents:[
      {date:'2026-06-01',type:'contribution',amount:300,fundingClass:'internalCashTransfer'},
      {date:'2026-06-02',type:'contribution',amount:400,fundingClass:'performanceExcludedTransfer'},
      {date:'2026-06-03',type:'contribution',amount:500}
    ]
  });
  setState({portfolio});
  assert.equal(core.securityInternalCashTransferSum('2026-06-10'),300);
  assert.equal(core.securityExcludedTransferSum('2026-06-10'),400);
  assert.equal(core.securityExternalContributionSum('2026-06-10'),500);
});
