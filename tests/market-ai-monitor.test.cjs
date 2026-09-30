const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const client=fs.readFileSync(path.join(__dirname,'../js/dashboard-market-ai-client.js'),'utf8')
  .replace(/export\s*\{[\s\S]*?\};?\s*$/,'');
const ui=fs.readFileSync(path.join(__dirname,'../js/dashboard-ui.js'),'utf8');
const messages=ui.match(/^const REALTIME_MONITOR_\w+_MESSAGE=.+;$/gm).join('\n');
const monitorUi=ui.slice(ui.indexOf('function realtimeMonitorExpectedOrigin(){'),ui.indexOf('function syncRealtimeQuotesModalGeometry(){'));

for(const [page,origin] of [
  ['http://localhost:8000/','http://localhost:8001'],
  ['http://127.0.0.1:8000/','http://127.0.0.1:8001'],
  ['https://example.github.io/dashboard/','https://node.tail60a98e.ts.net'],
]){
  test(`${page}에서 Monitor는 API origin을 따르고 메시지 origin/source 검증을 유지한다`,()=>{
    const sent=[],themes=[];
    const frame={contentWindow:{postMessage:(message,target)=>sent.push({message,target})},getAttribute:()=>`${origin}/monitor/`};
    const context=vm.createContext({
      URL,location:new URL(page),localStorage:{getItem:()=>null},window:{location:new URL(page)},
      document:{documentElement:{dataset:{}},getElementById:()=>({querySelector:()=>frame})},
      currentTheme:()=> 'light',setTheme:theme=>themes.push(theme),
    });
    vm.runInContext(client+'\n'+messages+'\n'+monitorUi,context);
    assert.equal(context.marketAiApiBase(),origin);
    assert.equal(vm.runInContext('MARKET_AI_MONITOR_URL',context),`${origin}/monitor/`);
    assert.equal(context.realtimeMonitorExpectedOrigin(),origin);
    context.publishRealtimeMonitorTheme('dark');
    assert.equal(sent[0].target,origin);
    assert.equal(sent[0].message.theme,'dark');
    const message={source:frame.contentWindow,origin,data:{type:'market-ai-monitor:theme-change',theme:'dark'}};
    context.handleRealtimeMonitorMessage({...message,origin:'https://wrong.example'});
    context.handleRealtimeMonitorMessage({...message,source:{}});
    assert.deepEqual(themes,[]);
    context.handleRealtimeMonitorMessage(message);
    assert.deepEqual(themes,['dark']);
  });
}
