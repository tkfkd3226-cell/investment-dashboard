const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const coreSource=read('js/dashboard-core.js');
const kodexSchemaSource=read('js/kodex-leverage-schema.js');
const app=read('js/dashboard-app.js');
const common=read('css/common.css');
const mobile=read('css/mobile.css');
const tablet=read('css/tablet.css');
const special=read('css/special.css');
let core;

test.before(async()=>{
  const schemaUrl='data:text/javascript;base64,'+Buffer.from(kodexSchemaSource).toString('base64');
  const coreForNode=coreSource.replace("'./kodex-leverage-schema.js'",`'${schemaUrl}'`);
  core=await import('data:text/javascript;base64,'+Buffer.from(coreForNode).toString('base64'));
});

const row=(date,daily,cumulative)=>({
  '날짜':date,
  '합계 : 전일대비손익':daily,
  '합계 : 누적손익':cumulative
});
const base={date:'2026-09-28',allocTotal:1000,securitiesCash:100,separateProfitTrades:[]};

test('투자 칭호 현재 상태형은 새내기·5연속 수익·현금비중·누적손익·기본 임계값을 보존한다',()=>{
  assert.deepEqual(core.investorTitleFromSignals({...base,cum:[]}),{
    status:'🌱 투자 새내기',achievement:null,achievementDate:null
  });

  const fiveWins=[1,2,3,4,5].map((n,i)=>row(`2026-09-${String(i+1).padStart(2,'0')}`,1,n));
  assert.equal(core.investorTitleFromSignals({...base,cum:fiveWins,totalProfit:5}).status,'🔥 불기둥 탑승자');

  const stable=[row('2026-09-01',0,500)];
  assert.equal(core.investorTitleFromSignals({...base,cum:stable,securitiesCash:400,totalProfit:500}).status,'👀 관망의 달인');
  assert.equal(core.investorTitleFromSignals({...base,cum:stable,totalProfit:10000001}).status,'👑 평온한 투자자');
  assert.equal(core.investorTitleFromSignals({...base,cum:stable,totalProfit:10000000}).status,'🏃 꾸준한 투자자');
});

test('업적형은 획득일을 계산해 가장 최근 업적 1개를 표시하고 단타 업적은 별도수익 ON에서만 활성화한다',()=>{
  const cum=[
    row('2026-06-01',1,3000000),
    row('2026-06-02',-1,-500000),
    row('2026-06-05',1,100000)
  ];
  const nineTrades=Array.from({length:9},(_,i)=>({date:`2026-07-${String(i+1).padStart(2,'0')}`}));
  const tenTrades=[...nineTrades,{date:'2026-08-06'}];

  let title=core.investorTitleFromSignals({...base,date:'2026-08-05',cum,totalProfit:100000,separateProfitTrades:nineTrades});
  assert.equal(title.achievement,'🧘 인내의 화신');
  assert.equal(title.achievementDate,'2026-06-05');

  title=core.investorTitleFromSignals({...base,date:'2026-08-06',cum,totalProfit:100000,separateProfitTrades:tenTrades,includeSeparateProfit:false});
  assert.equal(title.achievement,'🧘 인내의 화신','별도수익 OFF에서는 단타 업적을 후보에 올리면 안 된다');

  title=core.investorTitleFromSignals({...base,date:'2026-08-06',cum,totalProfit:100000,separateProfitTrades:tenTrades,includeSeparateProfit:true});
  assert.equal(title.achievement,'⚔️ 단타 깎는 노인');
  assert.equal(title.achievementDate,'2026-08-06');

  title=core.investorTitleFromSignals({...base,date:'2026-08-05',cum,totalProfit:100000,separateProfitTrades:tenTrades,includeSeparateProfit:true});
  assert.equal(title.achievement,'🧘 인내의 화신','화면 날짜 이후 거래를 업적 횟수에 포함하면 안 된다');
});

test('실제 현재 데이터에서 단타 업적은 2026-08-06부터 최근 업적으로 전환된다',()=>{
  const report=JSON.parse(read('data/kodex_leverage_trades.json'));
  const portfolio=JSON.parse(read('data/portfolio.json'));
  const separate=core.deriveSeparateProfitFromKodexReport(report);
  assert.equal(separate.trades[9]?.date,'2026-08-06','10번째 별도수익 거래일 contract가 달라졌다');

  // 실제 누적손익 이력은 별도수익 ON 기준으로 생성한다.
  portfolio.separateProfit=separate;
  Object.assign(core.dataState,{
    portfolio,
    prices:JSON.parse(read('data/prices.json')),
    snapshots:JSON.parse(read('data/performance_snapshots.json')),
    account1Daily:JSON.parse(read('data/account1_daily_snapshots.json')),
    pensionContributions:JSON.parse(read('data/pension_contributions.json')),
    pensionCashSnapshots:JSON.parse(read('data/pension_cash_snapshots.json')),
    pensionTrades:JSON.parse(read('data/pension_trades.json')),
    krxTradingCalendar:JSON.parse(read('data/krx_trading_calendar.json'))
  });
  core.uiState.includeSeparateProfit=false;
  const off=core.calc('2026-08-06');
  assert.notEqual(core.investorTitleViewModel(off,core.separateProfitView(off)).achievement,'⚔️ 단타 깎는 노인','실데이터에서도 별도수익 OFF면 단타 업적이 노출되면 안 된다');

  core.uiState.includeSeparateProfit=true;
  const before=core.calc('2026-08-05');
  const after=core.calc('2026-08-06');
  assert.equal(core.investorTitleViewModel(before,core.separateProfitView(before)).achievement,'🧘 인내의 화신');
  assert.equal(core.investorTitleViewModel(after,core.separateProfitView(after)).achievement,'⚔️ 단타 깎는 노인');
});

test('Hero 정보 계층은 Web/Phone 기존 구조를 유지하고 Tablet은 제목 행 우측에 칭호를 정렬한다',()=>{
  assert.match(app,/function renderHeroPerformanceRow\(x,v=separateProfitView\(x\)\)\{[^]*?class="hero-performance-row"[^]*?renderHeroTitleBadges\(x,v\)[^]*?renderHeroMetricPills\(x,v\)/);
  assert.match(app,/hero-title-row[^]*?renderHeroTitleBadges\(x,v,'tablet'\)[^]*?renderHeroPerformanceRow\(x,v\)/);
  assert.match(app,/hero-title-badges-tablet/);
  assert.match(app,/hero-title-badges-performance/);
  assert.match(app,/hero-title-badge-status/);
  assert.match(app,/hero-title-badge-achievement/);

  const metricStart=app.indexOf('function renderHeroMetricPills(');
  const metricEnd=app.indexOf('\nfunction renderHeroPerformanceRow',metricStart);
  const metricBlock=app.slice(metricStart,metricEnd);
  assert.doesNotMatch(metricBlock,/hero-title-badge|투자 칭호/);
  assert.equal((metricBlock.match(/hero-profit-pill/g)||[]).length,2);
  assert.equal((metricBlock.match(/hero-return-pill/g)||[]).length,2);

  assert.match(common,/\.hero-title-badges-tablet\{display:none\}/);
  assert.match(common,/\.hero-performance-row\{[^}]*display:flex;[^}]*flex-wrap:nowrap;/s);
  assert.match(common,/\.hero-performance-row \.hero-metric-pills\{[^}]*flex-wrap:nowrap;/s);
  assert.match(tablet,/Tablet Hero는 제목\/기준문구 우측 끝에 칭호를 두고[^]*?\.hero \.hero-title-row\{[^}]*flex-wrap:nowrap;[^}]*align-items:center;/s);
  assert.match(tablet,/\.hero \.hero-title-row \.hero-title-badges-tablet\{[^}]*display:flex;[^}]*margin-left:auto;/s);
  assert.match(tablet,/\.hero \.hero-performance-row \.hero-title-badges-performance\{[^}]*display:none;/s);
  assert.match(tablet,/\.hero \.hero-performance-row \.hero-metric-pills\{[^}]*flex-wrap:nowrap;[^}]*margin-top:var\(--space-sm\);/s);
  assert.match(tablet,/\.hero \.hero-return-pill\{display:inline-flex\}/);
  assert.match(special,/Phone은 칭호 전용 행과 기존 성과 pill 행을 분리[^]*?\.hero \.hero-performance-row\{[^}]*display:block;/s);
  assert.match(special,/\.hero \.hero-performance-row \.hero-metric-pills\{[^}]*flex-wrap:wrap;[^}]*margin-top:var\(--space-sm\);/s);
});

test('Phone은 기존 세로 2개·가로 4개 성과 pill contract를 복원하고 이전 제목 우측 칭호 규칙을 남기지 않는다',()=>{
  assert.match(mobile,/\.hero \.hero-return-pill\{display:none\}/);
  const landscape=special.slice(special.indexOf('[S04] Phone Landscape'));
  assert.match(landscape,/\.hero \.hero-return-pill\{[^}]*display:inline-flex/s);
  assert.doesNotMatch(special,/hero-investor-title|hero-title-label-phone-portrait|Phone Portrait Hero Title/,'이전 Phone 제목 우측 칭호/성과 축약 규칙이 남으면 안 된다');
  assert.doesNotMatch(app,/hero-investor-title|hero-title-label-phone-portrait|syncPhoneInvestorTitle/);
});

test('칭호/성과 행은 Market AI 예약 폭과 partial refresh에 참여해 상태 변화와 화면 표시가 어긋나지 않는다',()=>{
  assert.match(common,/\.hero\.market-ai-mounted \.hero-title-row,/);
  assert.match(common,/\.hero\.market-ai-mounted \.hero-performance-row/);
  assert.match(common,/\.hero-title-badges\{[^}]*display:flex;[^}]*flex-wrap:nowrap;/);
  assert.match(app,/function refreshHeroTitleBadges\(x,v=separateProfitView\(x\)\)\{[^]*?hero-title-badges-tablet[^]*?hero-title-badges-performance/s);
  const refreshCalls=[...app.matchAll(/refreshHeroTitleBadges\(x,v\);/g)];
  assert.equal(refreshCalls.length,2,'별도수익 전환과 live valuation 두 경로 모두 Tablet/Performance 칭호 슬롯을 함께 갱신해야 한다');
});
