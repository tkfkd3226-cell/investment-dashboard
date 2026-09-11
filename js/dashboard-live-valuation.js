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

let liveValuationPollTimer=0;
let liveValuationRefreshSequence=0;
let liveValuationLastFingerprint='';
let renderDashboardCallback=null;

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

function requestLiveValuationRender(){
  if(!renderDashboardCallback||!liveValuationCanRender())return;
  renderDashboardCallback();
}

async function refreshLiveValuation(){
  const refreshSequence=++liveValuationRefreshSequence;
  const today=kstTodayText();
  const tickers=liveValuationTickersForDate(today);
  if(!tickers.length){
    const changed=clearLiveValuationSnapshot('empty-universe');
    liveValuationLastFingerprint='';
    if(changed)requestLiveValuationRender();
    return;
  }

  const query=new URLSearchParams({tickers:tickers.join(',')});
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
    const fingerprint=liveValuationFingerprint(payload);
    const stateChanged=applyLiveValuationSnapshot(payload,tickers);
    const payloadChanged=fingerprint!==liveValuationLastFingerprint;
    liveValuationLastFingerprint=fingerprint;
    if(stateChanged||payloadChanged)requestLiveValuationRender();
  }catch(error){
    if(refreshSequence!==liveValuationRefreshSequence)return;
    response?.releaseTimeout?.();
    liveValuationLastFingerprint='';
    const changed=clearLiveValuationSnapshot(error?.name==='AbortError'?'timeout':'request-failed');
    if(changed)requestLiveValuationRender();
  }
}

function setupLiveValuation({renderDashboard}={}){
  renderDashboardCallback=typeof renderDashboard==='function'?renderDashboard:null;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshLiveValuation();
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
