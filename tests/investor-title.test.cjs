const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const app=read('js/dashboard-app.js');
const special=read('css/special.css');

function extractFunction(source,name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} source not found`);
  const brace=source.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){
      depth--;
      if(depth===0)return source.slice(start,i+1);
    }
  }
  throw new Error(`${name} source is not balanced`);
}

const investorTitleSource=extractFunction(app,'getInvestorTitle');

function titleHarness(cum,{trades=[]}={}){
  const context=vm.createContext({
    cumHistory:()=>cum,
    dataState:{portfolio:{separateProfit:{trades}}}
  });
  vm.runInContext(`${investorTitleSource}; this.getInvestorTitle=getInvestorTitle;`,context);
  return context.getInvestorTitle;
}

function row(daily,cumulative){
  return {'합계 : 전일대비손익':daily,'합계 : 누적손익':cumulative};
}

const xBase={date:'2026-09-28',allocTotal:100,securitiesCash:0};

test('투자 칭호는 5연속 수익을 최우선으로 판정하고 5일 미만에는 조기 부여하지 않는다',()=>{
  const four=[row(1,1),row(1,2),row(1,3),row(1,4)];
  assert.equal(titleHarness(four)(xBase,{totalProfit:0}),'🏃 꾸준한 투자자');

  const five=[...four,row(1,5)];
  assert.equal(titleHarness(five)(xBase,{totalProfit:0}),'🔥 불기둥 탑승자');
});

test('투자 칭호 우선순위는 인내 → 단타 → 관망 → 누적수익 → 기본 순서를 유지한다',()=>{
  const drawdown=[row(0,0),row(-2500000,-2500000),row(1000000,-1500000)];
  const tenTrades=Array.from({length:10},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`}));
  assert.equal(
    titleHarness(drawdown,{trades:tenTrades})({...xBase,securitiesCash:50},{totalProfit:1}),
    '🧘 인내의 화신',
    'MDD 회복 칭호가 단타/관망보다 우선해야 한다'
  );

  const stable=[row(0,0)];
  assert.equal(titleHarness(stable,{trades:tenTrades})({...xBase,securitiesCash:50},{totalProfit:20000000}),'⚔️ 단타 깎는 노인');
  assert.equal(titleHarness(stable)({...xBase,securitiesCash:40},{totalProfit:20000000}),'👀 관망의 달인');
  assert.equal(titleHarness(stable)(xBase,{totalProfit:10000001}),'👑 평온한 투자자');
  assert.equal(titleHarness(stable)(xBase,{totalProfit:10000000}),'🏃 꾸준한 투자자');
});

test('투자 칭호 거래수는 현재 화면 날짜까지의 거래만 세고 데이터가 없으면 새내기로 표시한다',()=>{
  const trades=Array.from({length:10},(_,i)=>({date:i<9?`2026-09-${String(i+1).padStart(2,'0')}`:'2026-10-01'}));
  assert.equal(titleHarness([row(0,0)],{trades})(xBase,{totalProfit:0}),'🏃 꾸준한 투자자');
  assert.equal(titleHarness([])(xBase,{totalProfit:0}),'🌱 투자 새내기');
});

test('Phone은 투자 칭호를 제목 행으로 이동해 기존 Hero 성과 pill 수를 늘리지 않는다',()=>{
  const titleRow=extractFunction(app,'renderHeroTitleRow');
  const metricPills=extractFunction(app,'renderHeroMetricPills');
  assert.match(titleRow,/hero-title-label-default/);
  assert.match(titleRow,/hero-title-label-phone-portrait[^>]*>성과</);
  assert.match(titleRow,/renderInvestorTitleBadge\(title,'phone'\)/);
  assert.match(metricPills,/renderInvestorTitleBadge\(title,'metric'\)/);

  const phoneShared=special.slice(special.indexOf('[S03] Phone UI Shared'),special.indexOf('/* Phone Portrait Hero Title'));
  assert.match(phoneShared,/\.hero \.hero-title-row\{[^}]*flex-wrap:nowrap/s,'Phone 제목 행은 Hero 높이를 늘리는 wrap을 만들면 안 된다');
  assert.match(phoneShared,/\.hero \.hero-investor-title-metric\{display:none\}/,'Phone에서는 metric 행의 칭호를 숨겨 기존 2/4개 성과 pill 구성을 지켜야 한다');
  assert.match(phoneShared,/\.hero \.hero-investor-title-phone\{[^}]*display:inline-flex/s,'Phone에서는 제목 행 칭호를 표시해야 한다');
});

test('세로 Phone은 제목을 성과로 축약하고 가로 Phone은 기존 4개 성과 pill 표시를 유지한다',()=>{
  assert.match(special,/@media \(max-width:760px\) and \(orientation:portrait\)\{[^}]*\.hero \.hero-title-label-default\{display:none\}[^}]*\.hero \.hero-title-label-phone-portrait\{display:inline\}/s);
  const landscape=special.slice(special.indexOf('[S04] Phone Landscape'));
  assert.match(landscape,/\.hero \.hero-return-pill\{[^}]*display:inline-flex/s,'가로 Phone은 기존 수익률 pill을 다시 표시해 4개 구성을 유지해야 한다');
});

test('별도수익 전환과 live valuation partial refresh도 Phone 칭호를 함께 갱신한다',()=>{
  const syncCalls=[...app.matchAll(/replaceDashboardFragment\(document\.querySelector\('\.hero-metric-pills'\),renderHeroMetricPills\(x,v\)\);\s*syncPhoneInvestorTitle\(x,v\);/g)];
  assert.equal(syncCalls.length,2,'두 partial-render 경로 모두 제목 행 칭호를 갱신해야 한다');
});
