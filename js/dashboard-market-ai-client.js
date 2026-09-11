// Market AI Client · endpoint / timeout transport shared by signal panel and live valuation.
// This module owns only connection semantics. It has no dashboard state or DOM rendering responsibility.
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_REMOTE_TIMEOUT_MS=5_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1']);
const MARKET_AI_REMOTE_BASE='https://node.tail60a98e.ts.net';

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

export {
  MARKET_AI_REMOTE_BASE,
  marketAiApiBase,
  marketAiFetchWithTimeout,
  marketAiLocalMode,
  marketAiRequestTimeoutMs
};
