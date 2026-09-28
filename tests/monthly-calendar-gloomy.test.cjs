const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/dashboard-monthly-calendar.js'),'utf8')
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm,'')
  .replace(/export\s*\{[\s\S]*?\};?\s*$/,'');
const common=fs.readFileSync(path.join(root,'css/common.css'),'utf8');

function harness(profits){
  const dates=Object.keys(profits).sort();
  const context=vm.createContext({
    allAvailableDates:()=>dates,
    combinedDailyProfitChange:date=>profits[date]??null,
    securitiesDailyProfitChange:date=>profits[date]??null,
    pensionDailyProfitChange:date=>profits[date]??null,
    separateProfitDailyChangeForDate:()=>0,
    dataState:{activeDate:dates.at(-1)||''},
    uiState:{includeSeparateProfit:false,personalViewUnlocked:false},
    hasPensionData:()=>true,
    krxTradingCalendarStatus:()=> 'closed',
    kstTodayText:()=> '2099-01-01',
    fmt:value=>String(value),
    escapeHtml:value=>String(value),
    navIconSvg:()=>'',
    phoneUi:()=>false
  });
  vm.runInContext(source,context);
  return context;
}

function gloomyDates(context,month){
  const model=context.monthlyCalendarMonthModel(month,'combined');
  return Array.from(model.dayModels).filter(item=>item.isGloomy).map(item=>item.date);
}

test('멘탈 케어는 3연속 손실의 세 번째 날부터 이후 연속 손실일에만 붙는다',()=>{
  const context=harness({
    '2026-09-01':-100,
    '2026-09-02':-200,
    '2026-09-03':-300,
    '2026-09-04':-400
  });
  assert.deepEqual(gloomyDates(context,'2026-09'),['2026-09-03','2026-09-04']);
});

test('보합 또는 수익일은 연속 손실 카운트를 초기화한다',()=>{
  const context=harness({
    '2026-09-01':-100,
    '2026-09-02':-200,
    '2026-09-03':0,
    '2026-09-04':-300,
    '2026-09-05':-400,
    '2026-09-06':-500,
    '2026-09-07':100,
    '2026-09-08':-600,
    '2026-09-09':-700
  });
  assert.deepEqual(gloomyDates(context,'2026-09'),['2026-09-06']);
});

test('월 경계에서는 이전 달의 연속 손실 횟수를 다음 달로 이어받지 않는다',()=>{
  const context=harness({
    '2026-09-29':-100,
    '2026-09-30':-200,
    '2026-10-01':-300,
    '2026-10-02':-400,
    '2026-10-05':-500
  });
  assert.deepEqual(gloomyDates(context,'2026-09'),[]);
  assert.deepEqual(gloomyDates(context,'2026-10'),['2026-10-05']);
});

test('gloomy day renderer와 CSS는 is-gloomy 및 심호흡 표시 contract를 유지한다',()=>{
  const context=harness({'2026-09-03':-300});
  const base={
    day:3,date:'2026-09-03',available:true,weekdayIndex:2,today:false,marketStatus:'trading',
    item:{date:'2026-09-03',day:3,profit:-300,profitState:'value',active:false,today:false}
  };
  const normal=context.renderMonthlyCalendarDayCell(base);
  const gloomy=context.renderMonthlyCalendarDayCell({...base,item:{...base.item,isGloomy:true}});
  assert.doesNotMatch(normal,/\bis-gloomy\b/);
  assert.match(gloomy,/\bis-gloomy\b/);
  assert.match(common,/button\.monthly-calendar-day\.is-gloomy::before\s*\{[^}]*content:\s*"☔️ 심호흡"/s);
});
