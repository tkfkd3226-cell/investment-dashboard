import {
  applyLiveValuationSnapshot,
  clearLiveValuationSnapshot,
  dataState,
  liveValuationTickersForDate,
  kstTodayText
} from './dashboard-core.js';
import {
  marketAiApiBase,
  marketAiFetchWithTimeout
} from './dashboard-market-ai-client.js';

// Live Valuation Adapter · current-date quote universe + screen-only valuation overlay refresh.
// Market AI owns quotes; dashboard-core owns positions/cost basis/calculation. No live value is persisted.
const LIVE_VALUATION_POLL_MS=10_000;
const LIVE_VALUATION_ENDPOINT='/api/market-data/krx-quotes';
const LIVE_VALUATION_CLIENT_SESSION_KEY='investmentDashboard.liveValuationClientId';
const LIVE_VALUATION_PENDING_RENDER_RETRY_MS=250;

let liveValuationPollTimer=0;
let liveValuationPendingRenderTimer=0;
let liveValuationRefreshSequence=0;
let liveValuationLastFingerprint='';
let liveValuationRenderPending=false;
let liveValuationSetupBound=false;
let renderDashboardCallback=null;

function liveValuationClientId(){
  try{
    const saved=sessionStorage.getItem(LIVE_VALUATION_CLIENT_SESSION_KEY);
    if(saved)return saved;
    const generated=globalThis.crypto?.randomUUID?.()||`tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
    sessionStorage.setItem(LIVE_VALUATION_CLIENT_SESSION_KEY,generated);
    return generated;
  }catch{
    return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
  }
}
const LIVE_VALUATION_CLIENT_ID=liveValuationClientId();

function liveValuationUniverseKey(tickers){
  return (tickers||[]).map(value=>String(value||'').trim().toUpperCase()).filter(Boolean).sort().join(',');
}

function liveValuationFingerprint(payload){
  const items=Array.isArray(payload?.items)?payload.items:[];
  return JSON.stringify({
    status:String(payload?.status||''),
    marketState:String(payload?.market_state||''),
    bridgeConnected:payload?.bridge_connected===true,
    universeVersion:Number(payload?.universe_version)||0,
    items:items.map(item=>[
      String(item?.ticker||''),
      Number(item?.price)||0,
      item?.usable===true,
      String(item?.state||''),
      String(item?.observed_at||'')
    ])
  });
}

function liveValuationCanRender(){
  if(dataState.activeDate!==kstTodayText())return false;
  if(document.visibilityState!=='visible')return false;
  if(document.querySelector('.chart-expanded-overlay,.action-modal.show,dialog[open]'))return false;
  return true;
}

function clearPendingRenderTimer(){
  if(!liveValuationPendingRenderTimer)return;
  window.clearTimeout(liveValuationPendingRenderTimer);
  liveValuationPendingRenderTimer=0;
}

function schedulePendingRenderCheck(){
  if(!liveValuationRenderPending||liveValuationPendingRenderTimer)return;
  if(dataState.activeDate!==kstTodayText()||document.visibilityState!=='visible')return;
  liveValuationPendingRenderTimer=window.setTimeout(()=>{
    liveValuationPendingRenderTimer=0;
    flushLiveValuationRender();
  },LIVE_VALUATION_PENDING_RENDER_RETRY_MS);
}

function flushLiveValuationRender(){
  if(!liveValuationRenderPending||!renderDashboardCallback)return false;
  if(!liveValuationCanRender()){
    schedulePendingRenderCheck();
    return false;
  }
  clearPendingRenderTimer();
  liveValuationRenderPending=false;
  renderDashboardCallback();
  return true;
}

function requestLiveValuationRender(){
  if(!renderDashboardCallback)return;
  liveValuationRenderPending=true;
  flushLiveValuationRender();
}

function queueUniverseReconcileRefresh(){
  if(document.visibilityState!=='visible')return;
  window.setTimeout(()=>refreshLiveValuation(),0);
}

async function refreshLiveValuation(){
  const refreshSequence=++liveValuationRefreshSequence;
  const today=kstTodayText();
  const tickers=liveValuationTickersForDate(today);
  const requestedUniverseKey=liveValuationUniverseKey(tickers);
  if(!tickers.length){
    const changed=clearLiveValuationSnapshot('empty-universe');
    liveValuationLastFingerprint='';
    if(changed)requestLiveValuationRender();
    else flushLiveValuationRender();
    return;
  }

  const query=new URLSearchParams({
    tickers:tickers.join(','),
    client_id:LIVE_VALUATION_CLIENT_ID
  });
  let response=null;
  try{
    response=await marketAiFetchWithTimeout(`${marketAiApiBase()}${LIVE_VALUATION_ENDPOINT}?${query.toString()}`,{
      headers:{Accept:'application/json'},
      cache:'no-store'
    });
    if(refreshSequence!==liveValuationRefreshSequence){response.releaseTimeout?.();return;}
    if(!response.ok){
      response.releaseTimeout?.();
      throw new Error(`Market AI quote API ${response.status}`);
    }
    const payload=await response.json();
    if(refreshSequence!==liveValuationRefreshSequence)return;

    // Holdings can change while the request is in flight (for example pension editor save).
    // Never apply a response for an obsolete ticker universe; immediately reconcile the server lease.
    const currentUniverseKey=liveValuationUniverseKey(liveValuationTickersForDate(today));
    if(currentUniverseKey!==requestedUniverseKey){
      queueUniverseReconcileRefresh();
      return;
    }

    const fingerprint=liveValuationFingerprint(payload);
    const stateChanged=applyLiveValuationSnapshot(payload,tickers);
    const payloadChanged=fingerprint!==liveValuationLastFingerprint;
    liveValuationLastFingerprint=fingerprint;
    if(stateChanged||payloadChanged)requestLiveValuationRender();
    else flushLiveValuationRender();
  }catch(error){
    if(refreshSequence!==liveValuationRefreshSequence)return;
    response?.releaseTimeout?.();
    liveValuationLastFingerprint='';
    const changed=clearLiveValuationSnapshot(error?.name==='AbortError'?'timeout':'request-failed');
    if(changed)requestLiveValuationRender();
    else flushLiveValuationRender();
  }
}

function setupLiveValuation({renderDashboard}={}){
  renderDashboardCallback=typeof renderDashboard==='function'?renderDashboard:null;
  if(liveValuationSetupBound){
    flushLiveValuationRender();
    return;
  }
  liveValuationSetupBound=true;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      flushLiveValuationRender();
      refreshLiveValuation();
    }
  });
  refreshLiveValuation();
  if(!liveValuationPollTimer){
    liveValuationPollTimer=window.setInterval(()=>{
      if(document.visibilityState==='visible')refreshLiveValuation();
    },LIVE_VALUATION_POLL_MS);
  }
}

export {
  LIVE_VALUATION_POLL_MS,
  refreshLiveValuation,
  setupLiveValuation
};
