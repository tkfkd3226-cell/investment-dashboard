// Market AI Client · Signal panel/live valuation이 공유하는 endpoint·timeout transport, canonical Monitor URL/connection event, Dashboard-side 연결 사용 preference를 소유한다.
// quote 의미·DOM rendering·Monitor lease 의미는 소유하지 않고 local/remote 연결 semantics와 사용자 연결 사용 여부만 담당한다.
// Structure map:
//   [CLIENT01] Endpoint / Environment
//   [CLIENT02] User Connection Preference
//   [CLIENT03] Timeout-safe Fetch
//   [CLIENT04] Public API

// [CLIENT01] Endpoint / Environment · local 8001 / remote Tailscale origin
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_REMOTE_TIMEOUT_MS=5_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1']);
const MARKET_AI_REMOTE_BASE='https://node.tail60a98e.ts.net';
const MARKET_AI_MONITOR_URL=`${MARKET_AI_REMOTE_BASE}/monitor/`;
const MARKET_AI_CONNECTION_EVENT='investment-dashboard:market-ai-connection';
const MARKET_AI_ENABLED_EVENT='investment-dashboard:market-ai-enabled';
const MARKET_AI_ENABLED_STORAGE_KEY='investmentDashboard.marketAiEnabled';

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

// [CLIENT02] User Connection Preference · Dashboard-side Market AI 연결 사용 여부
function marketAiEnabled(){
  try{return localStorage.getItem(MARKET_AI_ENABLED_STORAGE_KEY)!=='0'}catch{return true}
}

function setMarketAiEnabled(enabled,{force=false}={}){
  const next=enabled===true;
  const previous=marketAiEnabled();
  try{localStorage.setItem(MARKET_AI_ENABLED_STORAGE_KEY,next?'1':'0')}catch{}
  document.documentElement.dataset.marketAiEnabled=next?'true':'false';
  if(force||previous!==next)window.dispatchEvent(new CustomEvent(MARKET_AI_ENABLED_EVENT,{detail:{enabled:next}}));
  return next;
}

document.documentElement.dataset.marketAiEnabled=marketAiEnabled()?'true':'false';
window.addEventListener?.('storage',event=>{
  if(event.key!==MARKET_AI_ENABLED_STORAGE_KEY)return;
  const enabled=event.newValue!=='0';
  document.documentElement.dataset.marketAiEnabled=enabled?'true':'false';
  window.dispatchEvent(new CustomEvent(MARKET_AI_ENABLED_EVENT,{detail:{enabled}}));
});

// [CLIENT03] Timeout-safe Fetch · body 소비가 끝날 때까지 timeout lifecycle 유지
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

// [CLIENT04] Public API
export {
  MARKET_AI_CONNECTION_EVENT,
  MARKET_AI_ENABLED_EVENT,
  MARKET_AI_MONITOR_URL,
  MARKET_AI_REMOTE_BASE,
  marketAiApiBase,
  marketAiEnabled,
  marketAiFetchWithTimeout,
  marketAiLocalMode,
  marketAiRequestTimeoutMs,
  setMarketAiEnabled
};
