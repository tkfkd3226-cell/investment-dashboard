// Market AI Client · Signal panel과 live valuation이 공유하는 endpoint / timeout transport.
// Dashboard state·quote 의미·DOM rendering은 소유하지 않고 local/remote 연결 semantics만 담당한다.
// Structure map:
//   [CLIENT01] Endpoint / Environment
//   [CLIENT02] Timeout-safe Fetch
//   [CLIENT03] Public API

// [CLIENT01] Endpoint / Environment · local 8001 / remote Tailscale origin
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_REMOTE_TIMEOUT_MS=5_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1']);
const MARKET_AI_REMOTE_BASE='https://node.tail60a98e.ts.net';
const MARKET_AI_MONITOR_URL=`${MARKET_AI_REMOTE_BASE}/monitor/`;
const MARKET_AI_CONNECTION_EVENT='investment-dashboard:market-ai-connection';

function marketAiLocalMode(){
  return LOCAL_DASHBOARD_HOSTS.has(location.hostname);
}

function marketAiApiBase(){
  if(marketAiLocalMode())return `${location.protocol}//${location.hostname}:8001`;
  return MARKET_AI_REMOTE_BASE;
}

function marketAiRequestTimeoutMs(){
  return marketAiLocalMode()?MARKET_AI_TIMEOUT_MS:MARKET_AI_REMOTE_TIMEOUT_MS;
}

// [CLIENT02] Timeout-safe Fetch · body 소비가 끝날 때까지 timeout lifecycle 유지
function marketAiFetchWithTimeout(url,options={},timeoutMs=marketAiRequestTimeoutMs()){
  const controller=new AbortController();
  let settled=false;
  const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
  const finish=()=>{
    if(settled)return;
    settled=true;
    window.clearTimeout(timer);
  };
  return fetch(url,{...options,signal:controller.signal}).then(response=>{
    const readBody=method=>async(...args)=>{
      try{return await response[method](...args);}
      finally{finish();}
    };
    return new Proxy(response,{
      get(target,property){
        if(['json','text','blob','arrayBuffer','formData'].includes(property))return readBody(property);
        if(property==='releaseTimeout')return finish;
        const value=Reflect.get(target,property,target);
        return typeof value==='function'?value.bind(target):value;
      }
    });
  },error=>{finish();throw error;});
}

// [CLIENT03] Public API
export {
  MARKET_AI_CONNECTION_EVENT,
  MARKET_AI_MONITOR_URL,
  MARKET_AI_REMOTE_BASE,
  marketAiApiBase,
  marketAiFetchWithTimeout,
  marketAiLocalMode,
  marketAiRequestTimeoutMs
};
