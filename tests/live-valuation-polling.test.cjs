const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/dashboard-live-valuation.js'),'utf8')
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm,'')
  .replace(/export\s*\{[\s\S]*?\};?\s*$/,'');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('Market AI 카드도 5초 주기를 사용하며 진행 중인 세 API 묶음을 중복 시작하지 않는다',async()=>{
  const market=fs.readFileSync(path.join(__dirname,'../js/dashboard-market-ai.js'),'utf8');
  const start=market.indexOf('function refreshMarketAiSignal(){');
  const end=market.indexOf('// [MARKET11]',start);
  const first=deferred();let calls=0;
  const context=vm.createContext({
    Promise,marketAiEnabled:()=>true,marketAiLifecycleGeneration:1,marketAiRefreshInFlight:null,
    runMarketAiSignalRefresh:()=>{calls++;return calls===1?first.promise:Promise.resolve();}
  });
  vm.runInContext(market.match(/const MARKET_AI_POLL_MS=[\d_]+;/)[0]+market.slice(start,end),context);
  assert.equal(vm.runInContext('MARKET_AI_POLL_MS',context),5000);
  const a=context.refreshMarketAiSignal(),b=context.refreshMarketAiSignal();
  assert.equal(a,b);assert.equal(calls,1);
  first.resolve();await flush();await context.refreshMarketAiSignal();
  assert.equal(calls,2);
});

function harness(){
  let nextTimer=1;
  const timers=new Map(),events=new Map(),requests=[],applied=[];
  const settings={enabled:true,tickers:['005930'],now:'2026-09-23T04:00:00Z',modal:false,main:0,overlay:0};
  const dataState={activeDate:'2026-09-23',liveValuation:{requestedTickers:[],items:{}}};
  class Clock extends Date{
    constructor(...args){super(...(args.length?args:[settings.now]));}
    static now(){return new Date(settings.now).getTime();}
  }
  const document={
    visibilityState:'visible',documentElement:{dataset:{marketAiConnected:'true'}},activeElement:null,
    addEventListener:(name,callback)=>events.set(name,callback),
    querySelector:()=>settings.modal?{}:null
  };
  const addTimer=(callback,delay,repeat)=>{const id=nextTimer++;timers.set(id,{callback,delay,repeat});return id;};
  const sandbox={
    console,Date:Clock,Intl,URLSearchParams,Map,Promise,document,dataState,
    window:{
      addEventListener:(name,callback)=>events.set(name,callback),
      setInterval:(callback,delay)=>addTimer(callback,delay,true),clearInterval:id=>timers.delete(id),
      setTimeout:(callback,delay)=>addTimer(callback,delay,false),clearTimeout:id=>timers.delete(id)
    },
    MARKET_AI_CONNECTION_EVENT:'connection',MARKET_AI_KOSPI_SNAPSHOT_EVENT:'kospi',
    marketAiEnabled:()=>settings.enabled,marketAiApiBase:()=>'/backend',marketAiKospiSnapshot:()=>null,
    kstTodayText:()=>new Clock().toISOString().slice(0,10),
    liveValuationRenderDateEligible:()=>true,liveValuationTickersForDate:()=>[...settings.tickers],
    applyLiveKospiSnapshot:()=>false,clearLiveKospiSnapshot:()=>false,
    clearLiveValuationSnapshot:(reason,override)=>{
      const changed=Object.keys(dataState.liveValuation.items).length>0;
      dataState.liveValuation={reason,requestedTickers:override||[],items:{}};
      return changed;
    },
    applyLiveValuationSnapshot:(payload,tickers)=>{
      applied.push(payload);
      dataState.liveValuation={requestedTickers:tickers,items:Object.fromEntries(payload.items.map(item=>[item.ticker,{
        ...item,marketState:item.market_state
      }]))};
    },
    marketAiFetchWithTimeout:url=>{
      const headers=deferred(),body=deferred();
      const request={url,headers,body,releaseCount:0};
      request.respond=()=>headers.resolve({ok:true,status:200,json:()=>body.promise,releaseTimeout:()=>request.releaseCount++});
      request.finish=payload=>{request.respond();body.resolve(payload);};
      requests.push(request);
      return headers.promise;
    }
  };
  const context=vm.createContext(sandbox);
  vm.runInContext(source,context);
  vm.runInContext('liveValuationMarketAiConnected=true;',context);
  const snapshot=(price=100,{closed=false,ticker=settings.tickers[0]}={})=>({
    status:'ok',market_state:closed?'closed':'open',bridge_connected:true,universe_version:1,
    items:ticker?[{ticker,price,usable:true,state:closed?'closed':'live',market_state:closed?'closed':'open',observed_at:'2026-09-23T04:00:00Z'}]:[]
  });
  const start=()=>context.setupLiveValuation({renderDashboard:()=>settings.main++,renderOpenOverlay:()=>settings.overlay++});
  const tick=async()=>{for(const timer of [...timers.values()])if(timer.repeat)timer.callback();await flush();};
  const queued=async()=>{
    for(const [id,timer] of [...timers])if(!timer.repeat&&timer.delay===0){timers.delete(id);timer.callback();}
    await flush();
  };
  const connect=value=>events.get('connection')({detail:{connected:value}});
  return {context,settings,dataState,document,timers,events,requests,applied,snapshot,start,tick,queued,connect};
}

test('5초 주기에서도 응답 body가 끝나기 전에는 조회가 중복되지 않는다',async()=>{
  const h=harness();h.start();await flush();
  assert.deepEqual([...h.timers.values()].filter(t=>t.repeat).map(t=>t.delay),[5000]);
  assert.equal(h.requests.length,1);
  await h.tick();await h.tick();
  assert.equal(h.requests.length,1,'느린 headers 대기 중 추가 요청 금지');
  h.requests[0].respond();await flush();await h.tick();
  assert.equal(h.requests.length,1,'headers 도착 후 body 대기 중에도 추가 요청 금지');
  h.requests[0].body.resolve(h.snapshot());await flush();await h.tick();
  assert.equal(h.requests.length,2);
  assert.equal(h.applied.length,1);
});

test('연결 해제 후 이전 응답은 적용하지 않고 재연결 시 직렬로 새 요청을 시작한다',async()=>{
  const h=harness();h.start();await flush();
  h.connect(false);h.connect(true);await flush();
  assert.equal(h.requests.length,1);
  h.requests[0].finish(h.snapshot(100));await flush();
  assert.equal(h.applied.length,0);
  await h.queued();assert.equal(h.requests.length,2);
  h.requests[1].finish(h.snapshot(200));await flush();
  assert.equal(h.applied.length,1);assert.equal(h.applied[0].items[0].price,200);
});

test('client identity 확인 중 재연결되어도 이전 세대의 조회를 전송하지 않는다',async()=>{
  const h=harness(),identity=deferred();
  h.context.identity=identity.promise;
  vm.runInContext('resolveLiveValuationClientId=()=>identity;',h.context);
  h.start();await flush();h.connect(false);h.connect(true);
  assert.equal(h.requests.length,0);
  identity.resolve('one-client');await flush();
  assert.equal(h.requests.length,0,'무효화된 identity 대기 요청은 fetch를 시작하면 안 된다');
  await h.queued();assert.equal(h.requests.length,1);
});

test('타임아웃 이후 요청 잠금이 해제되고 다음 주기에서 복구된다',async()=>{
  const h=harness();h.start();await flush();
  const error=new Error('timeout');error.name='AbortError';
  h.requests[0].headers.reject(error);await flush();
  assert.equal(h.dataState.liveValuation.reason,'timeout');
  await h.tick();assert.equal(h.requests.length,2);
  h.requests[1].finish(h.snapshot());await flush();assert.equal(h.applied.length,1);
});

test('조회 중 보유종목 변경 시 옛 universe 응답을 버리고 최신 목록을 즉시 요청한다',async()=>{
  const h=harness();h.start();await flush();
  h.settings.tickers=['000660'];
  h.requests[0].finish(h.snapshot(100,{ticker:'005930'}));await flush();
  assert.equal(h.applied.length,0);
  await h.queued();assert.equal(h.requests.length,2);
  assert.equal(new URL(h.requests[1].url,'https://example.test').searchParams.get('tickers'),'000660');
  h.requests[1].finish(h.snapshot(200));await flush();
  assert.equal(h.applied[0].items[0].ticker,'000660');
});

test('빈 보유종목도 1회 서버에 전달해 lease를 반납하고 이후 조회를 쉰다',async()=>{
  const h=harness();h.start();await flush();h.settings.tickers=[];
  h.requests[0].finish(h.snapshot(100,{ticker:'005930'}));await flush();await h.queued();
  assert.equal(h.requests.length,2);
  assert.equal(new URL(h.requests[1].url,'https://example.test').searchParams.get('tickers'),'');
  h.requests[1].finish(h.snapshot());await flush();await h.tick();
  assert.equal(h.requests.length,2);
});

test('숨김·OFF 상태에서는 조회하지 않고 visible 복귀 시 한 번 조회한다',async()=>{
  const h=harness();h.start();await flush();h.requests[0].finish(h.snapshot());await flush();
  h.document.visibilityState='hidden';await h.tick();assert.equal(h.requests.length,1);
  h.document.visibilityState='visible';h.events.get('visibilitychange')();await flush();
  assert.equal(h.requests.length,2);
  h.settings.enabled=false;h.connect(false);h.requests[1].finish(h.snapshot(200));await flush();await h.queued();await h.tick();
  assert.equal(h.requests.length,2);assert.equal(h.applied.length,1);
});

test('장마감 확정값은 반복 조회하지 않고 다음 세션에서 다시 조회한다',async()=>{
  const h=harness();h.settings.now='2026-09-23T07:00:00Z';h.start();await flush();
  h.requests[0].finish(h.snapshot(100,{closed:true}));await flush();await h.tick();await h.tick();
  assert.equal(h.requests.length,1);
  h.settings.now='2026-09-24T00:01:00Z';await h.tick();assert.equal(h.requests.length,2);
});

test('모달이 열린 상태에서도 overlay는 갱신하고 main render는 보류한다',async()=>{
  const h=harness();h.settings.modal=true;h.start();await flush();
  h.requests[0].finish(h.snapshot(100));await flush();
  assert.equal(h.settings.overlay,1);assert.equal(h.settings.main,0);
  await h.tick();h.requests[1].finish(h.snapshot(200));await flush();
  assert.equal(h.settings.overlay,2);assert.equal(h.settings.main,0);
  await h.tick();h.requests[2].finish(h.snapshot(200));await flush();
  assert.equal(h.settings.overlay,2,'동일 fingerprint는 모달을 재갱신하지 않는다');
  h.settings.modal=false;h.events.get('visibilitychange')();await flush();
  assert.equal(h.settings.main,1,'모달 해제 후 누적 상태는 한 번 그린다');
});
