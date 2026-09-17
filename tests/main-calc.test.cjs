const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const coreSource=fs.readFileSync(path.join(ROOT,'js/dashboard-core.js'),'utf8');
const kodexSchemaSource=fs.readFileSync(path.join(ROOT,'js/kodex-leverage-schema.js'),'utf8');
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
    activeDate:null,
    liveValuation:{status:'idle',marketState:'',bridgeConnected:null,universeVersion:0,generatedAt:null,requestedTickers:[],items:{},reason:''}
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
  for(const key of ['prices','snapshots','account1Daily','pensionContributions','pensionCashSnapshots','pensionTrades','activeDate','liveValuation']){
    if(Object.prototype.hasOwnProperty.call(overrides,key))core.dataState[key]=overrides[key];
  }
}

test.before(async()=>{
  const schemaUrl='data:text/javascript;base64,'+Buffer.from(kodexSchemaSource).toString('base64');
  const coreForNode=coreSource.replace("'./kodex-leverage-schema.js'",`'${schemaUrl}'`);
  const url='data:text/javascript;base64,'+Buffer.from(coreForNode).toString('base64');
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

test('연금 거래: 개별 입력이 안전해도 합산 결과가 안전 범위를 넘으면 계산을 중단한다',()=>{
  setState({
    pensionTrades:{trades:[
      {id:'b1',date:'2026-06-02',ticker:'P',name:'Pension',type:'buy',qty:1,price:1,amount:1}
    ]}
  });
  assert.throws(
    ()=>core.pensionPositionState({ticker:'P',qty:Number.MAX_SAFE_INTEGER,cost:Number.MAX_SAFE_INTEGER},'2026-06-02'),
    /안전한 정수 범위를 벗어납니다/
  );
});

test('연금 현금: 안전한 개별 적립금도 합산 결과가 범위를 넘으면 계산을 중단한다',()=>{
  setState({
    pensionContributions:{contributions:[
      {id:'c1',date:'2026-06-01',amount:Number.MAX_SAFE_INTEGER},
      {id:'c2',date:'2026-06-02',amount:1}
    ]}
  });
  assert.throws(
    ()=>core.pensionCashBeforeNewTrade('2026-06-02'),
    /안전한 정수 범위를 벗어납니다/
  );
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

test('증권 누적 차트 bundle은 별도수익 OFF/ON을 한 계산원천에서 만들고 데이터 reference 변경 시 갱신한다',()=>{
  const portfolio=basePortfolio({
    separateProfit:{reinvestedLimit:50,trades:[{date:'2026-03-20',profit:100}]},
    securitiesEvents:[{date:'2026-03-20',type:'contribution',amount:50,fundingClass:'performanceExcludedTransfer'}]
  });
  setState({
    portfolio,
    prices:{'2026-03-20':{indices:{KOSPI:2600}},'2026-03-21':{indices:{KOSPI:2610}}},
    account1Daily:{
      '2026-03-20':dailySnapshot({profit:100}),
      '2026-03-21':dailySnapshot({profit:160})
    }
  });
  const first=core.securitiesCumHistoryBundle('2026-03-21');
  assert.equal(first.off.at(-1)['합계 : 누적손익'],160);
  assert.equal(first.on.at(-1)['합계 : 누적손익'],260);
  core.uiState.includeSeparateProfit=false;
  assert.deepEqual(core.cumHistory('2026-03-21'),first.off);
  core.uiState.includeSeparateProfit=true;
  assert.deepEqual(core.cumHistory('2026-03-21'),first.on);

  core.dataState.account1Daily={
    ...core.dataState.account1Daily,
    '2026-03-21':dailySnapshot({profit:220})
  };
  const refreshed=core.securitiesCumHistoryBundle('2026-03-21');
  assert.notEqual(refreshed,first);
  assert.equal(refreshed.off.at(-1)['합계 : 누적손익'],220);
  assert.equal(refreshed.on.at(-1)['합계 : 누적손익'],320);
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

test('Topbar 날짜 label은 좁은 Phone에서도 년-월 / 월-일 요일 형식을 공통 사용한다',()=>{
  assert.equal(core.monthLabel('2026-09'),'2026-9');
  assert.equal(core.monthLabel('2026-12'),'2026-12');
  assert.equal(core.dayOptionLabel('2026-09-16'),'9-16 수');
  assert.equal(core.dayOptionLabel('2026-12-31'),'12-31 목');
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

test('내부 현금이체·내부회수와 외부기여금은 fundingClass 의미에 따라 서로 다른 합계에 들어간다',()=>{
  const portfolio=basePortfolio({
    constants:baseConstants({outsideCash:1000,securitiesCash:50,account1Principal:1700}),
    securitiesEvents:[
      {date:'2026-06-01',type:'contribution',amount:300,fundingClass:'internalCashTransfer'},
      {date:'2026-06-02',type:'contribution',amount:400,fundingClass:'performanceExcludedTransfer'},
      {date:'2026-06-03',type:'contribution',amount:500},
      {date:'2026-06-10',type:'withdrawal',amount:350,principalAmount:300,cashPrincipalDelta:-300,fundingClass:'internalCashReturn'}
    ]
  });
  setState({portfolio});
  assert.equal(core.securityInternalCashTransferSum('2026-06-10'),300);
  assert.equal(core.securityInternalCashReturnSum('2026-06-10'),350);
  assert.equal(core.securityInternalCashReturnPrincipalSum('2026-06-10'),300);
  assert.equal(core.securityInternalCashPrincipalNetForDate('2026-06-10'),0);
  assert.equal(core.outsideCashForDate('2026-06-10'),1050);
  assert.equal(core.securityExcludedTransferSum('2026-06-10'),400);
  assert.equal(core.securityExternalContributionSum('2026-06-10'),500);
});

test('추적 현금 확인값: 새 확인일을 기준점으로 재설정하고 이후 내부이동만 증감한다',()=>{
  const portfolio=basePortfolio({
    constants:baseConstants({outsideCash:1000}),
    outsideCashSnapshots:[
      {date:'2026-06-18',amount:1000},
      {date:'2026-06-25',amount:750}
    ],
    securitiesEvents:[
      {date:'2026-06-20',type:'contribution',amount:300,fundingClass:'internalCashTransfer'},
      {date:'2026-06-26',type:'withdrawal',amount:50,principalAmount:0,cashPrincipalDelta:0,fundingClass:'internalCashReturn'}
    ]
  });
  setState({portfolio});
  assert.equal(core.outsideCashForDate('2026-06-20'),700);
  assert.deepEqual(core.outsideCashSnapshotForDate('2026-06-20'),portfolio.outsideCashSnapshots[0]);
  assert.equal(core.outsideCashForDate('2026-06-25'),750);
  assert.deepEqual(core.outsideCashSnapshotForDate('2026-06-25'),portfolio.outsideCashSnapshots[1]);
  assert.equal(core.outsideCashForDate('2026-06-26'),800);
});

test('실시간 평가: 오늘 날짜만 usable Market AI quote를 가격·평가손익에 overlay하고 과거 날짜는 JSON을 유지한다',()=>{
  const today=core.kstTodayText();
  const past='2026-09-10';
  const portfolio=basePortfolio({
    securities:[{name:'삼성전자',ticker:'005930',type:'개별주식',qty:10,cost:1000,chart:true}],
    pension:[]
  });
  setState({
    portfolio,
    prices:{
      [past]:{securities:{'005930':100}},
      [today]:{securities:{'005930':110}}
    }
  });
  assert.equal(core.applyLiveValuationSnapshot({
    status:'ok',market_state:'open',bridge_connected:true,universe_version:2,generated_at:'2026-09-11T06:00:00Z',
    items:[{ticker:'005930',symbol:'KRX:005930',service:'SC_R',price:125,state:'live',usable:true,observed_at:'2026-09-11T06:00:00Z'}]
  },['005930']),true);
  const live=core.calc(today).holdings[0];
  assert.equal(live.price,125);
  assert.equal(live.evalAmount,1250);
  assert.equal(live.profit,250);
  assert.equal(live.priceSource,'market-ai');
  const historical=core.calc(past).holdings[0];
  assert.equal(historical.price,100);
  assert.equal(historical.priceSource,'json');
});

test('실시간 평가: 자정 이후 장전에는 직전 완료 세션의 closed quote를 유지하고 장 시작 시점에는 재검증한다',()=>{
  const sessionDate='2026-09-16';
  const portfolio=basePortfolio({
    securities:[{name:'삼성전자',ticker:'005930',type:'개별주식',qty:1,cost:100,chart:true}],
    pension:[]
  });
  setState({portfolio,prices:{[sessionDate]:{securities:{'005930':110}}}});
  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'closed',bridge_connected:true,generated_at:'2026-09-16T11:00:00Z',
    items:[{ticker:'005930',price:125,state:'closed',market_state:'closed',usable:true,observed_at:'2026-09-16T10:59:00Z'}]
  },['005930']);

  const preopen=new Date('2026-09-16T23:30:00Z'); // 2026-09-17 08:30 KST
  assert.equal(core.liveValuationQuoteForDate('005930',sessionDate,preopen)?.price,125);
  assert.equal(core.liveValuationStatusForDate(sessionDate,preopen).mode,'closed');
  assert.match(core.heroPerformanceBasisLabel(sessionDate,preopen),/애프터 종가 기준$/);

  const afterOpen=new Date('2026-09-17T00:01:00Z'); // 2026-09-17 09:01 KST
  assert.equal(core.liveValuationQuoteForDate('005930',sessionDate,afterOpen),null);
  assert.equal(core.liveValuationStatusForDate(sessionDate,afterOpen).mode,'historical');

  // 휴장일처럼 09:00 이후 backend가 당일 생성시각으로 closed를 재확인하면 직전 완료 세션을 계속 쓸 수 있다.
  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'closed',bridge_connected:true,generated_at:'2026-09-17T00:01:30Z',
    items:[{ticker:'005930',price:125,state:'closed',market_state:'closed',usable:true,observed_at:'2026-09-16T10:59:00Z'}]
  },['005930']);
  assert.equal(core.liveValuationQuoteForDate('005930',sessionDate,afterOpen)?.price,125);
});

test('실시간 평가: unusable 종목은 JSON fallback하고 같은 ticker의 증권·연금은 universe에서 1회만 요청한다',()=>{
  const today=core.kstTodayText();
  const portfolio=basePortfolio({
    securities:[
      {name:'KODEX AI반도체',ticker:'395160',type:'ETF',qty:2,cost:100,chart:true},
      {name:'매도완료',ticker:'005930',type:'개별주식',qty:0,cost:0,chart:false}
    ],
    pension:[
      {name:'KODEX 200TR',ticker:'278530',qty:0,cost:0},
      {name:'KODEX AI반도체',ticker:'395160',qty:3,cost:150},
      {name:'KODEX 삼전채권',ticker:'448330',qty:0,cost:0}
    ]
  });
  setState({portfolio,prices:{[today]:{securities:{'395160':60},pension:{'278530':1,'395160':61,'448330':1,cash:0}}}});
  assert.deepEqual(core.liveValuationTickersForDate(today),['395160']);
  core.applyLiveValuationSnapshot({
    status:'unavailable',market_state:'open',bridge_connected:true,universe_version:3,
    items:[{ticker:'395160',price:70,state:'warming',usable:false}]
  },['395160']);
  const x=core.calc(today);
  assert.equal(x.holdings[0].price,60);
  assert.equal(x.holdings[0].priceSource,'json');
  const pensionAi=x.pensionRows.find(row=>row.ticker==='395160');
  assert.equal(pensionAi.price,61);
  assert.equal(pensionAi.priceSource,'json');
});

test('실시간 평가: 요청 실패 clear는 live quote를 제거해 즉시 JSON fallback 상태로 되돌린다',()=>{
  const today=core.kstTodayText();
  const portfolio=basePortfolio({securities:[{name:'삼성전자',ticker:'005930',type:'개별주식',qty:1,cost:100,chart:true}],pension:[]});
  setState({portfolio,prices:{[today]:{securities:{'005930':110}}}});
  core.applyLiveValuationSnapshot({status:'ok',market_state:'open',bridge_connected:true,items:[{ticker:'005930',price:120,state:'live',usable:true}]},['005930']);
  assert.equal(core.calc(today).holdings[0].price,120);
  assert.equal(core.clearLiveValuationSnapshot('request-failed'),true);
  assert.equal(core.calc(today).holdings[0].price,110);
});



test('실시간 평가 상태 요약: 오늘 LIVE/CLOSED/혼합 fallback을 종목 수 기준으로 집계한다',()=>{
  const today=core.kstTodayText();
  const portfolio=basePortfolio({
    securities:[
      {name:'A',ticker:'005930',type:'개별주식',qty:1,cost:100,chart:true},
      {name:'B',ticker:'000660',type:'개별주식',qty:1,cost:100,chart:true}
    ],
    pension:[]
  });
  setState({portfolio,prices:{[today]:{securities:{'005930':100,'000660':100}}}});
  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'open',bridge_connected:true,generated_at:'2026-09-11T06:20:00Z',
    items:[
      {ticker:'005930',price:120,state:'live',market_state:'open',usable:true,observed_at:'2026-09-11T06:19:58Z'},
      {ticker:'000660',price:130,state:'stale',market_state:'open',usable:false,observed_at:'2026-09-11T06:18:00Z'}
    ]
  },['005930','000660']);
  const mixed=core.liveValuationStatusForDate(today);
  assert.equal(mixed.mode,'mixed');
  assert.equal(mixed.requestedCount,2);
  assert.equal(mixed.usableCount,1);
  assert.equal(mixed.fallbackCount,1);
  assert.equal(mixed.liveCount,1);
  assert.equal(mixed.regularLiveCount,1);
  assert.equal(mixed.extendedLiveCount,0);
  assert.equal(mixed.marketClosedCount,0);
  assert.equal(core.dataState.liveValuation.items['005930'].marketState,'open');
  assert.equal(mixed.staleCount,1);
  assert.equal(mixed.latestObservedAt,'2026-09-11T06:19:58.000Z');

  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'closed',bridge_connected:true,
    items:[
      {ticker:'005930',price:121,state:'closed',market_state:'closed',usable:true,observed_at:'2026-09-11T06:30:00Z'},
      {ticker:'000660',price:131,state:'closed',market_state:'closed',usable:true,observed_at:'2026-09-11T06:30:01Z'}
    ]
  },['005930','000660']);
  const closed=core.liveValuationStatusForDate(today);
  assert.equal(closed.mode,'closed');
  assert.equal(closed.closedCount,2);
  assert.equal(closed.marketClosedCount,2);
  assert.equal(closed.regularLiveCount,0);
  assert.equal(closed.extendedLiveCount,0);
  assert.equal(closed.fallbackCount,0);
});


test('실시간 평가 상태 요약: 개별 market_state를 보존하고 정규장·시간외 live를 구분 집계한다',()=>{
  const today=core.kstTodayText();
  const portfolio=basePortfolio({
    securities:[
      {name:'주식',ticker:'005930',type:'개별주식',qty:1,cost:100,chart:true},
      {name:'ETF',ticker:'069500',type:'ETF',qty:1,cost:100,chart:true}
    ],
    pension:[]
  });
  setState({portfolio,prices:{[today]:{securities:{'005930':100,'069500':100}}}});
  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'closed',bridge_connected:true,
    items:[
      {ticker:'005930',price:121,state:'live',market_state:'extended',usable:true,observed_at:'2026-09-11T07:10:00Z'},
      {ticker:'069500',price:101,state:'closed',market_state:'closed',usable:true,observed_at:'2026-09-11T06:30:00Z'}
    ]
  },['005930','069500']);
  const status=core.liveValuationStatusForDate(today);
  assert.equal(status.mode,'live');
  assert.equal(status.liveCount,1);
  assert.equal(status.closedCount,1);
  assert.equal(status.regularLiveCount,0);
  assert.equal(status.extendedLiveCount,1);
  assert.equal(status.marketClosedCount,1);
  assert.equal(core.dataState.liveValuation.items['005930'].marketState,'extended');
  assert.equal(core.dataState.liveValuation.items['069500'].marketState,'closed');
});

test('Hero 투자 성과 기준문구: 실제 적용된 live 가격 성격에 따라 정규장·시간외·부분 반영만 표시한다',()=>{
  const today=core.kstTodayText();
  const portfolio=basePortfolio({
    securities:[
      {name:'주식',ticker:'005930',type:'개별주식',qty:1,cost:100,chart:true},
      {name:'ETF',ticker:'069500',type:'ETF',qty:1,cost:100,chart:true}
    ],
    pension:[]
  });
  setState({portfolio,prices:{[today]:{marketStatus:'intraday',updatedAtKST:`${today} 14:20:00`,securities:{'005930':100,'069500':100}}}});
  assert.match(core.heroPerformanceBasisLabel(today),/장중 14:20 기준$/);

  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'open',bridge_connected:true,
    items:[
      {ticker:'005930',price:121,state:'live',market_state:'open',usable:true},
      {ticker:'069500',price:100,state:'warming',market_state:'open',usable:false}
    ]
  },['005930','069500']);
  assert.match(core.heroPerformanceBasisLabel(today),/일부 실시간 반영$/);

  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'open',bridge_connected:true,
    items:[
      {ticker:'005930',price:121,state:'live',market_state:'open',usable:true},
      {ticker:'069500',price:102,state:'live',market_state:'open',usable:true}
    ]
  },['005930','069500']);
  assert.match(core.heroPerformanceBasisLabel(today),/실시간 현재가 기준$/);

  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'closed',bridge_connected:true,
    items:[
      {ticker:'005930',price:122,state:'live',market_state:'extended',usable:true},
      {ticker:'069500',price:103,state:'closed',market_state:'closed',usable:true}
    ]
  },['005930','069500']);
  assert.match(core.heroPerformanceBasisLabel(today),/시간외 포함 현재가 기준$/);

  core.applyLiveValuationSnapshot({
    status:'ok',market_state:'closed',bridge_connected:true,
    items:[
      {ticker:'005930',price:123,state:'closed',market_state:'closed',usable:true},
      {ticker:'069500',price:103,state:'closed',market_state:'closed',usable:true}
    ]
  },['005930','069500']);
  assert.match(core.heroPerformanceBasisLabel(today,new Date('2026-09-16T11:05:00Z')),/애프터 종가 기준$/);

  core.clearLiveValuationSnapshot('disabled');
  setState({prices:{[today]:{marketStatus:'close',priceBasis:'regular_close',securities:{'005930':123,'069500':103}}}});
  assert.match(core.heroPerformanceBasisLabel(today),/정규장 종가 기준$/);
});

test('실시간 평가 상태 요약: 실패/과거 화면은 STALE·JSON 의미를 분리한다',()=>{
  const today=core.kstTodayText();
  const portfolio=basePortfolio({securities:[{name:'A',ticker:'005930',type:'개별주식',qty:1,cost:100,chart:true}],pension:[]});
  setState({portfolio,prices:{[today]:{securities:{'005930':100}}}});
  core.clearLiveValuationSnapshot('request-failed');
  const stale=core.liveValuationStatusForDate(today);
  assert.equal(stale.mode,'stale');
  assert.equal(stale.fallbackCount,1);
  const historical=core.liveValuationStatusForDate('2026-09-10');
  assert.equal(historical.mode,'historical');
});

test('증권 매도: 전량매도는 순매도대금·실현손익·현금화 원금을 분리하고 매도 전후 투입원금을 보존한다',()=>{
  const portfolio=basePortfolio({
    constants:baseConstants({account1Principal:1000,externalPrincipal:1000,securitiesCash:1600}),
    securities:[{name:'Stock A',ticker:'A',type:'개별주식',qty:0,cost:0,chart:true}],
    securitiesEvents:[{
      id:'sell-a',date:'2026-06-20',type:'sell',ticker:'A',qty:10,price:110,
      grossAmount:1100,transactionCost:0,amount:1100,costBasis:1000,realizedProfit:100,cashPrincipalDelta:1000
    }]
  });
  setState({portfolio,prices:{
    '2026-06-19':{securities:{A:90}},
    '2026-06-20':{securities:{A:120}},
    '2026-06-21':{securities:{A:130}}
  }});
  const before=core.securityPositionState(portfolio.securities[0],'2026-06-19');
  const after=core.securityPositionState(portfolio.securities[0],'2026-06-20');
  assert.deepEqual(before,{qty:10,cost:1000,realizedProfit:0,realizedCostBasis:0});
  assert.deepEqual(after,{qty:0,cost:0,realizedProfit:100,realizedCostBasis:1000});
  assert.equal(core.securityCashPrincipalForDate('2026-06-19'),0);
  assert.equal(core.securityCashPrincipalForDate('2026-06-20'),1000);
  assert.equal(core.account1PrincipalForDate('2026-06-19'),1000);
  assert.equal(core.account1PrincipalForDate('2026-06-20'),1000);
  const x=core.calc('2026-06-20'),holding=x.holdings[0];
  assert.equal(x.securitiesCash,1600);
  assert.equal(holding.profit,0);
  assert.equal(holding.realizedProfit,100);
  assert.equal(holding.totalProfit,100);
  assert.equal(holding.performanceCost,1000);
  approx(holding.returnRate,10);
  assert.equal(holding.dayChange,200);
  assert.equal(x.securitiesAssetDetail.statusRows.length,1);
  assert.equal(x.securitiesAssetDetail.statusRows[0].profit,100);
  assert.equal(x.securitiesAssetDetail.summaryRows.find(r=>r.id==='holdings').profit,100);
  assert.deepEqual(core.securityAllocVisibleHoldings(x).map(v=>v.name),['Stock A']);
  assert.equal(x.securitiesAssetDetail.change.rows[0].dayChange,200);
  const history=core.symbolHistory('2026-06-20');
  assert.equal(history.at(-2)['Stock A'],-100);
  assert.equal(history.at(-1)['Stock A'],100);
  approx(history.at(-1)._rates['Stock A'],10);
  const post=core.calc('2026-06-21');
  assert.equal(post.securitiesAssetDetail.statusRows.length,0);
  assert.equal(core.securityAllocVisibleHoldings(post).some(v=>v.name==='Stock A'),false);
  assert.equal(post.rawHoldingProfit,0);
  assert.equal(post.ledgerHoldingProfit,100);
});


test('증권 일부매도: 잔여 평가손익과 확정 실현손익을 합산하고 누적 기준원가를 보존한다',()=>{
  const portfolio=basePortfolio({
    constants:baseConstants({account1Principal:1000,externalPrincipal:1000,securitiesCash:550}),
    securities:[{name:'Stock A',ticker:'A',type:'개별주식',qty:5,cost:500,chart:true}],
    securitiesEvents:[{id:'partial-sell',date:'2026-06-20',type:'sell',ticker:'A',qty:5,price:110,grossAmount:550,transactionCost:0,amount:550,costBasis:500,realizedProfit:50,cashPrincipalDelta:500}]
  });
  setState({portfolio,prices:{'2026-06-19':{securities:{A:100}},'2026-06-20':{securities:{A:120}}}});
  const h=core.calc('2026-06-20').holdings[0];
  assert.equal(h.qty,5);
  assert.equal(h.cost,500);
  assert.equal(h.profit,100);
  assert.equal(h.realizedProfit,50);
  assert.equal(h.totalProfit,150);
  assert.equal(h.realizedCostBasis,500);
  assert.equal(h.performanceCost,1000);
  approx(h.returnRate,15);
  assert.equal(core.account1PrincipalForDate('2026-06-20'),1000);
});

test('증권 현금화 원금: 전량매도 후 재매수는 명시적 cashPrincipalDelta로 원금을 중복 계상하지 않는다',()=>{
  const portfolio=basePortfolio({
    constants:baseConstants({account1Principal:1000,externalPrincipal:1000,securitiesCash:850}),
    securities:[{name:'Stock A',ticker:'A',type:'개별주식',qty:6,cost:600,chart:true}],
    securitiesEvents:[
      {id:'sell-a',date:'2026-06-20',type:'sell',ticker:'A',qty:10,price:105,grossAmount:1050,transactionCost:0,amount:1050,costBasis:1000,realizedProfit:50,cashPrincipalDelta:1000},
      {id:'buy-a',date:'2026-06-21',type:'buy',ticker:'A',qty:6,price:100,amount:600,cashPrincipalDelta:-600}
    ]
  });
  setState({portfolio,prices:{
    '2026-06-19':{securities:{A:100}},
    '2026-06-20':{securities:{A:105}},
    '2026-06-21':{securities:{A:120}}
  }});
  assert.equal(core.securityCashPrincipalForDate('2026-06-20'),1000);
  assert.equal(core.securityCashPrincipalForDate('2026-06-21'),400);
  assert.equal(core.account1PrincipalForDate('2026-06-20'),1000);
  assert.equal(core.account1PrincipalForDate('2026-06-21'),1000);
  const after=core.calc('2026-06-21').holdings[0];
  assert.equal(after.qty,6);
  assert.equal(after.cost,600);
  assert.equal(after.realizedProfit,50);
  assert.equal(after.realizedCostBasis,1000);
  assert.equal(after.performanceCost,1600);
  assert.equal(after.totalProfit,170);
  approx(after.returnRate,170/1600*100);
});

test('증권 현금화 원금: 같은 날 매도→재매수는 event id 정렬과 무관하게 일별 순변동으로 계산한다',()=>{
  const portfolio=basePortfolio({
    constants:baseConstants({account1Principal:1000,externalPrincipal:1000,securitiesCash:450}),
    securities:[{name:'Stock A',ticker:'A',type:'개별주식',qty:6,cost:600,chart:true}],
    securitiesEvents:[
      {id:'a-rebuy',date:'2026-06-20',type:'buy',ticker:'A',qty:6,price:100,amount:600,cashPrincipalDelta:-600},
      {id:'z-sell',date:'2026-06-20',type:'sell',ticker:'A',qty:10,price:105,grossAmount:1050,transactionCost:0,amount:1050,costBasis:1000,realizedProfit:50,cashPrincipalDelta:1000}
    ]
  });
  setState({portfolio,prices:{'2026-06-19':{securities:{A:100}},'2026-06-20':{securities:{A:100}}}});
  assert.equal(core.securityCashPrincipalForDate('2026-06-19'),0);
  assert.equal(core.securityCashPrincipalForDate('2026-06-20'),400);
  assert.equal(core.account1PrincipalForDate('2026-06-20'),1000);
  const before=core.securityPositionState(portfolio.securities[0],'2026-06-19');
  assert.deepEqual(before,{qty:10,cost:1000,realizedProfit:0,realizedCostBasis:0});
});

test('증권 매도 원장: optional 숫자 필드가 숫자가 아니면 JS도 Python과 동일하게 fail-closed 한다',()=>{
  const badSell=basePortfolio({
    securities:[{name:'Stock A',ticker:'A',type:'개별주식',qty:0,cost:0,chart:true}],
    securitiesEvents:[{id:'bad-realized',date:'2026-06-20',type:'sell',ticker:'A',qty:1,grossAmount:1100,transactionCost:0,amount:1100,costBasis:1000,realizedProfit:'invalid',cashPrincipalDelta:1000}]
  });
  setState({portfolio:badSell});
  assert.throws(()=>core.securityPositionState(badSell.securities[0],'2026-06-20'),/realizedProfit 값이 숫자가 아닙니다/);
});

test('증권 매도 원장: gross/net/costBasis/realizedProfit 불일치와 음수 현금화 원금은 fail-closed 한다',()=>{
  const badSell=basePortfolio({
    securities:[{name:'Stock A',ticker:'A',type:'개별주식',qty:0,cost:0,chart:true}],
    securitiesEvents:[{id:'bad-sell',date:'2026-06-20',type:'sell',ticker:'A',qty:1,grossAmount:1100,transactionCost:10,amount:1100,costBasis:1000,realizedProfit:100,cashPrincipalDelta:1000}]
  });
  setState({portfolio:badSell});
  assert.throws(()=>core.securityPositionState(badSell.securities[0],'2026-06-20'),/순매도대금/);

  const badPrincipal=basePortfolio({
    securitiesEvents:[{id:'bad-buy',date:'2026-06-20',type:'buy',ticker:'A',qty:1,amount:100,cashPrincipalDelta:-100}]
  });
  setState({portfolio:badPrincipal});
  assert.throws(()=>core.securityCashPrincipalForDate('2026-06-20'),/현금화 원금이 음수가/);
});

test('삼성전기 2026-09-16 전량매도·당일 내부회수: 매도일 표시·3,790원 현금·원금회수·장부 검산을 확정한다',()=>{
  const loadJson=relative=>JSON.parse(fs.readFileSync(path.join(ROOT,relative),'utf8'));
  const portfolio=loadJson('data/portfolio.json');
  setState({
    portfolio,
    prices:loadJson('data/prices.json'),
    snapshots:loadJson('data/performance_snapshots.json'),
    account1Daily:loadJson('data/account1_daily_snapshots.json'),
    pensionContributions:loadJson('data/pension_contributions.json'),
    pensionCashSnapshots:loadJson('data/pension_cash_snapshots.json'),
    pensionTrades:loadJson('data/pension_trades.json')
  });
  const sale=portfolio.securitiesEvents.find(v=>v.id==='sec-sell-20260916-009150');
  const withdrawal=portfolio.securitiesEvents.find(v=>v.id==='sec-withdrawal-20260916-internal-cash-return');
  assert.deepEqual({
    price:sale.price,grossAmount:sale.grossAmount,transactionCost:sale.transactionCost,amount:sale.amount,costBasis:sale.costBasis,realizedProfit:sale.realizedProfit,cashPrincipalDelta:sale.cashPrincipalDelta
  },{
    price:1348000,grossAmount:1348000,transactionCost:2772,amount:1345228,costBasis:1345000,realizedProfit:228,cashPrincipalDelta:1345000
  });
  assert.deepEqual({amount:withdrawal.amount,principalAmount:withdrawal.principalAmount,cashPrincipalDelta:withdrawal.cashPrincipalDelta,fundingClass:withdrawal.fundingClass},{amount:1400228,principalAmount:1345000,cashPrincipalDelta:-1345000,fundingClass:'internalCashReturn'});
  const before=core.calc('2026-09-15'),after=core.calc('2026-09-16');
  const beforeSamsung=before.holdings.find(h=>h.ticker==='009150'),afterSamsung=after.holdings.find(h=>h.ticker==='009150');
  assert.equal(beforeSamsung.qty,1);
  assert.equal(beforeSamsung.cost,1345000);
  assert.equal(beforeSamsung.totalProfit,-28000);
  assert.equal(afterSamsung.qty,0);
  assert.equal(afterSamsung.cost,0);
  assert.equal(afterSamsung.realizedProfit,228);
  assert.equal(afterSamsung.totalProfit,228);
  assert.equal(afterSamsung.performanceCost,1345000);
  approx(afterSamsung.returnRate,228/1345000*100);
  assert.equal(before.securitiesCash,58790);
  assert.equal(after.securitiesCash,3790);
  assert.equal(before.account1Principal,24341210);
  assert.equal(after.account1Principal,22996210);
  assert.equal(core.account1SourceHoldingGapForDate('2026-09-15'),12862);
  assert.equal(core.account1SourceHoldingGapForDate('2026-09-16'),12862);
  assert.equal(core.outsideCashForDate('2026-09-15'),690097);
  assert.equal(core.securityInternalCashPrincipalNetForDate('2026-09-15'),1345000);
  assert.equal(core.outsideCashForDate('2026-09-16'),2090325);
  assert.equal(core.securityInternalCashPrincipalNetForDate('2026-09-16'),0);
  assert.deepEqual(core.outsideCashSnapshotForDate('2026-09-16'),portfolio.outsideCashSnapshots.find(v=>v.date==='2026-09-16'));
  assert.equal(after.securitiesAssetDetail.statusRows.some(r=>r.ticker==='009150'),true);
  assert.equal(after.securitiesAssetDetail.statusRows.find(r=>r.ticker==='009150').profit,228);
  assert.equal(after.securitiesAssetDetail.summaryRows.find(r=>r.id==='holdings').profit,after.rawHoldingProfit);
  const changeRow=after.securitiesAssetDetail.change.rows.find(r=>r.ticker==='009150');
  assert.equal(changeRow.dayChange,28228);
  assert.equal(changeRow.sale.fullExit,true);
  assert.equal(changeRow.sale.price,1348000);
  assert.equal(changeRow.sale.transactionCost,2772);
  assert.equal(changeRow.sale.amount,1345228);
  assert.equal(changeRow.sale.realizedProfit,228);
  const last=core.symbolHistory('2026-09-16').at(-1);
  assert.equal(last['삼성전기'],228);
  approx(last._rates['삼성전기'],228/1345000*100);
  assert.equal(core.securityChartNamesForDate('2026-09-16').includes('삼성전기'),true);
  assert.equal(core.securityChartNamesForDate('2026-09-17').includes('삼성전기'),false);
  assert.equal(core.liveValuationTickersForDate('2026-09-16').includes('009150'),false);
  const post=core.calc('2026-09-17');
  assert.equal(post.securitiesAssetDetail.statusRows.some(r=>r.ticker==='009150'),false);
  assert.equal(post.securitiesAssetDetail.change.rows.some(r=>r.ticker==='009150'),false);
  assert.equal(core.securityAllocVisibleHoldings(after).some(r=>r.ticker==='009150'),true);
  assert.equal(core.securityAllocVisibleHoldings(post).some(r=>r.ticker==='009150'),false);
  assert.equal(after.rawHoldingProfit,after.ledgerHoldingProfit);
  assert.equal(post.ledgerHoldingProfit-post.rawHoldingProfit,228);
  assert.equal(after.totalResult-(after.allocTotal+core.outsideCashForDate('2026-09-16')),3063626);
});
