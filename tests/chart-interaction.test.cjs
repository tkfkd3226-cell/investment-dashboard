const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const charts=fs.readFileSync(path.join(__dirname,'../js/dashboard-charts.js'),'utf8');

function functionSource(name,nextName){
  const start=charts.indexOf(`function ${name}(`);
  const end=charts.indexOf(`\nfunction ${nextName}(`,start);
  assert.ok(start>=0&&end>start,`${name} production function을 찾지 못했다`);
  return charts.slice(start,end);
}

test('차트 축 hover 값은 tick 끝값이 아니라 실제 Y축 scale에서 역산한다',()=>{
  const context=vm.createContext({});
  vm.runInContext(functionSource('chartAxisHoverValue','addAxisHover'),context);
  const cfg={t:20,h:320,b:20};
  const domainMax=31_500_000;
  const plotBottom=300,plotHeight=280;
  const project=value=>plotBottom-(value/domainMax)*plotHeight;
  const meta={ticks:[0,5_000_000,10_000_000,15_000_000,20_000_000,25_000_000,30_000_000],project};

  assert.equal(Math.round(context.chartAxisHoverValue(meta,cfg,project(30_000_000))),30_000_000,'3천만원 grid line은 정확히 3천만원이어야 한다');
  assert.equal(Math.round(context.chartAxisHoverValue(meta,cfg,cfg.t)),domainMax,'tick보다 위로 확장된 고정축 상단도 실제 domain 값을 표시해야 한다');
  assert.equal(context.chartAxisHoverValue({...meta,project:null},cfg,100),null,'실제 scale이 없으면 임의 tick 범위로 추정하지 않아야 한다');
});

test('Chart legend toggle은 전체복귀·다중선택·마지막 1개 보호 동작을 유지한다',()=>{
  const context=vm.createContext({});
  vm.runInContext(functionSource('toggleChartSeries','setChartAutoY'),context);
  const calls=[];
  context.refreshChartLegend=scope=>calls.push(`legend:${scope}`);
  context.redrawChartScope=scope=>calls.push(`draw:${scope}`);

  const state={selected:new Set(['a','b','c'])};
  context.chartSelection=()=>({available:['a','b','c'],selected:new Set(state.selected),state});
  context.toggleChartSeries('scope','b');
  assert.deepEqual([...state.selected].sort(),['a','c']);
  assert.deepEqual(calls,['legend:scope','draw:scope']);

  calls.length=0;
  state.selected=new Set(['a']);
  context.toggleChartSeries('scope','a');
  assert.deepEqual([...state.selected],['a'],'마지막 series는 해제되지 않아야 한다');
  assert.deepEqual(calls,[],'상태가 바뀌지 않으면 불필요한 redraw를 하지 않아야 한다');

  state.selected=new Set(['a','c']);
  context.toggleChartSeries('scope','__all__');
  assert.equal(state.selected,null,'전체 선택은 null canonical state로 복귀해야 한다');
});
