import {
  applyLiveKospiSnapshot,
  applyLiveValuationSnapshot,
  clearLiveKospiSnapshot,
  clearLiveValuationSnapshot,
  dataState,
  liveValuationRenderDateEligible,
  liveValuationTickersForDate,
  kstTodayText
} from './dashboard-core.js';
import {
  MARKET_AI_CONNECTION_EVENT,
  MARKET_AI_KOSPI_SNAPSHOT_EVENT,
  marketAiApiBase,
  marketAiEnabled,
  marketAiKospiSnapshot,
  marketAiFetchWithTimeout
} from './dashboard-market-ai-client.js';

// Live Valuation Adapter · 현재 KRX 세션과 직전 완료 세션의 Market AI quote와 KOSPI benchmark를 화면 평가값/차트에만 overlay한다.
// Backend가 quote usable 및 KOSPI input_status 판정을 소유하고, 이 모듈은 검증된 현재값만 소비한다.
// transport는 dashboard-market-ai-client.js, position/cost/calculation은 dashboard-core.js가 소유하며 overlay 값은 운영 JSON에 저장하지 않는다.
// Structure map:
//   [LIVE01] Configuration / Client Identity
//   [LIVE02] Fingerprint / Deferred Render
//   [LIVE03] KOSPI Benchmark Handoff
//   [LIVE04] Quote Refresh / Universe Reconcile
//   [LIVE05] Lifecycle / Public API

// [LIVE01] Configuration / Client Identity · poll 설정 / tab별 client identity(backend lease key)
const LIVE_VALUATION_POLL_MS=5_000;
const LIVE_VALUATION_ENDPOINT='/api/market-data/krx-quotes';
const LIVE_VALUATION_CLIENT_SESSION_KEY='investmentDashboard.liveValuationClientId';
const LIVE_VALUATION_CLIENT_CHANNEL_NAME='investmentDashboard.liveValuationClients';
const LIVE_VALUATION_CLIENT_PROBE_MS=80;
const LIVE_VALUATION_PENDING_RENDER_RETRY_MS=250;

let liveValuationPollTimer=0;
let liveValuationPendingRenderTimer=0;
let liveValuationRefreshSequence=0;
let liveValuationRefreshInFlight=null;
let liveValuationLastFingerprint='';
let liveValuationRenderPending=false;
let liveValuationSetupBound=false;
let liveValuationMarketAiConnected=false;
let liveValuationSettledSessionKey='';
let liveValuationSettledPhase='';
let renderDashboardCallback=null;
let renderOpenOverlayCallback=null;
let liveValuationClientCandidate='';
let liveValuationClientChannel=null;
let liveValuationClientResolvePromise=null;
const liveValuationClientProbeWaiters=new Map();
const LIVE_VALUATION_RUNTIME_ID=randomLiveValuationClientId('runtime');

function randomLiveValuationClientId(prefix='tab'){
  return globalThis.crypto?.randomUUID?.()||`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
}

function storedLiveValuationClientId(){
  if(liveValuationClientCandidate)return liveValuationClientCandidate;
  try{
    const saved=sessionStorage.getItem(LIVE_VALUATION_CLIENT_SESSION_KEY);
    liveValuationClientCandidate=saved||randomLiveValuationClientId();
    if(!saved)sessionStorage.setItem(LIVE_VALUATION_CLIENT_SESSION_KEY,liveValuationClientCandidate);
  }catch{
    liveValuationClientCandidate=randomLiveValuationClientId();
  }
  return liveValuationClientCandidate;
}

function saveLiveValuationClientId(clientId){
  liveValuationClientCandidate=String(clientId||'');
  try{sessionStorage.setItem(LIVE_VALUATION_CLIENT_SESSION_KEY,liveValuationClientCandidate)}catch{}
}

function ensureLiveValuationClientChannel(){
  if(liveValuationClientChannel||typeof BroadcastChannel!=='function')return liveValuationClientChannel;
  try{
    liveValuationClientChannel=new BroadcastChannel(LIVE_VALUATION_CLIENT_CHANNEL_NAME);
    liveValuationClientChannel.addEventListener('message',event=>{
      const message=event?.data||{};
      if(message.runtimeId===LIVE_VALUATION_RUNTIME_ID)return;
      if(message.type==='probe'&&message.clientId===liveValuationClientCandidate){
        liveValuationClientChannel?.postMessage({type:'occupied',probeId:message.probeId,runtimeId:LIVE_VALUATION_RUNTIME_ID});
        return;
      }
      if(message.type==='occupied'&&message.probeId){
        liveValuationClientProbeWaiters.get(message.probeId)?.();
      }
    });
  }catch{
    liveValuationClientChannel=null;
  }
  return liveValuationClientChannel;
}

async function resolveLiveValuationClientId(){
  if(liveValuationClientResolvePromise)return liveValuationClientResolvePromise;
  liveValuationClientResolvePromise=(async()=>{
    let clientId=storedLiveValuationClientId();
    const channel=ensureLiveValuationClientChannel();
    if(!channel)return clientId;

    const probeId=randomLiveValuationClientId('probe');
    const occupied=await new Promise(resolve=>{
      let settled=false;
      const finish=value=>{
        if(settled)return;
        settled=true;
        liveValuationClientProbeWaiters.delete(probeId);
        resolve(value);
      };
      liveValuationClientProbeWaiters.set(probeId,()=>finish(true));
      window.setTimeout(()=>finish(false),LIVE_VALUATION_CLIENT_PROBE_MS);
      try{channel.postMessage({type:'probe',clientId,probeId,runtimeId:LIVE_VALUATION_RUNTIME_ID})}catch{finish(false)}
    });
    if(occupied){
      clientId=randomLiveValuationClientId();
      saveLiveValuationClientId(clientId);
    }
    return clientId;
  })();
  return liveValuationClientResolvePromise;
}

function liveValuationNetworkAllowed(){
  return marketAiEnabled()&&liveValuationMarketAiConnected;
}

function liveValuationSessionKey(date,tickers){
  return `${String(date||'')}|${liveValuationUniverseKey(tickers)}`;
}

function liveValuationMarketPhase(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get=type=>parts.find(value=>value.type===type)?.value||'';
  const weekdays={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const weekday=weekdays[get('weekday')]??-1;
  const minuteOfDay=(Number(get('hour'))||0)*60+(Number(get('minute'))||0);
  if(weekday===0||weekday===6)return 'closed';
  if(minuteOfDay<9*60)return 'preopen';
  if(minuteOfDay<15*60+30)return 'open';
  return 'closed';
}

function clearLiveValuationSettledSession(){
  liveValuationSettledSessionKey='';
  liveValuationSettledPhase='';
}

function liveValuationSettledFor(date,tickers){
  return Boolean(liveValuationSettledSessionKey)
    &&liveValuationSettledSessionKey===liveValuationSessionKey(date,tickers)
    &&liveValuationSettledPhase===liveValuationMarketPhase();
}

function updateLiveValuationSettledSession(date,tickers){
  const requested=[...new Set((tickers||[]).map(value=>String(value||'').trim().toUpperCase()).filter(Boolean))].sort();
  const sessionKey=liveValuationSessionKey(date,requested);
  if(!requested.length){
    liveValuationSettledSessionKey=sessionKey;
    liveValuationSettledPhase=liveValuationMarketPhase();
    return true;
  }
  const items=dataState.liveValuation?.items||{};
  const fullyClosed=requested.every(ticker=>{
    const item=items[ticker];
    return item?.usable===true
      &&item?.state==='closed'
      &&item?.marketState==='closed'
      &&Number(item?.price)>0;
  });
  if(fullyClosed){
    liveValuationSettledSessionKey=sessionKey;
    liveValuationSettledPhase=liveValuationMarketPhase();
    return true;
  }
  if(liveValuationSettledSessionKey===sessionKey){
    liveValuationSettledSessionKey='';
    liveValuationSettledPhase='';
  }
  return false;
}

function stopLiveValuationPollTimer(){
  if(!liveValuationPollTimer)return;
  window.clearInterval(liveValuationPollTimer);
  liveValuationPollTimer=0;
}

function ensureLiveValuationPollTimer(){
  if(liveValuationPollTimer||!liveValuationNetworkAllowed())return;
  liveValuationPollTimer=window.setInterval(()=>{
    if(document.visibilityState==='visible'&&liveValuationNetworkAllowed())refreshLiveValuation();
  },LIVE_VALUATION_POLL_MS);
}

function clearLiveValuationForDisconnected(reason='market-ai-disconnected'){
  liveValuationRefreshSequence+=1;
  liveValuationLastFingerprint='';
  clearLiveValuationSettledSession();
  stopLiveValuationPollTimer();
  const valuationChanged=clearLiveValuationSnapshot(reason,[]);
  const kospiChanged=clearLiveKospiSnapshot();
  if(valuationChanged||kospiChanged)requestLiveValuationRender({refreshOpenOverlay:valuationChanged});
  else flushLiveValuationRender();
}

// [LIVE02] Fingerprint / Deferred Render · latest-wins fingerprint / modal·chart 보호 렌더
function liveValuationUniverseKey(tickers){
  return (tickers||[]).map(value=>String(value||'').trim().toUpperCase()).filter(Boolean).sort().join(',');
}

function liveValuationFingerprint(payload,requestedTickers=[]){
  const items=Array.isArray(payload?.items)?payload.items:[];
  return JSON.stringify({
    requestedTickers:[...new Set((requestedTickers||[]).map(value=>String(value||'').trim().toUpperCase()).filter(Boolean))].sort(),
    status:String(payload?.status||''),
    marketState:String(payload?.market_state||''),
    bridgeConnected:payload?.bridge_connected===true,
    universeVersion:Number(payload?.universe_version)||0,
    items:items.map(item=>[
      String(item?.ticker||''),
      Number(item?.price)||0,
      item?.usable===true,
      String(item?.state||''),
      String(item?.market_state||''),
      String(item?.observed_at||'')
    ])
  });
}

function liveValuationCanRender(){
  if(!liveValuationRenderDateEligible(dataState.activeDate))return false;
  if(document.visibilityState!=='visible')return false;
  if(document.querySelector('.chart-expanded-overlay,.action-modal.show,.contrib-modal.show,dialog[open]'))return false;
  if(document.querySelector('#app .control-info-button[aria-expanded="true"],#app .has-tooltip.tooltip-open,#assetPriceSourceTooltip.visible,#securitySaleTooltip.visible,#marketAiTooltip.visible'))return false;
  const active=document.activeElement;
  if(active?.matches?.('select,input,textarea,[contenteditable="true"]'))return false;
  return true;
}

function clearPendingRenderTimer(){
  if(!liveValuationPendingRenderTimer)return;
  window.clearTimeout(liveValuationPendingRenderTimer);
  liveValuationPendingRenderTimer=0;
}

function schedulePendingRenderCheck(){
  if(!liveValuationRenderPending||liveValuationPendingRenderTimer)return;
  if(!liveValuationRenderDateEligible(dataState.activeDate)||document.visibilityState!=='visible')return;
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

function requestLiveValuationRender({refreshOpenOverlay=true}={}){
  if(refreshOpenOverlay&&renderOpenOverlayCallback){
    try{renderOpenOverlayCallback()}catch(error){console.error('Live valuation overlay refresh failed',error)}
  }
  if(!renderDashboardCallback)return;
  liveValuationRenderPending=true;
  flushLiveValuationRender();
}

// [LIVE03] KOSPI Benchmark Handoff · standalone snapshot의 backend 판정을 그대로 소비하고 저장 JSON에는 쓰지 않는다.
function normalizedLiveKospiSnapshot(row){
  const price=Number(row?.price);
  const source=String(row?.source||'');
  const inputStatus=row?.input_status||{};
  const status=String(inputStatus?.status||'');
  const usable=source.startsWith('kis-efriend:JUC_R:')
    &&inputStatus?.available===true
    &&['realtime','closed_latest'].includes(status)
    &&Number.isFinite(price)
    &&price>0;
  if(!usable)return null;
  const observedAt=row?.observed_at?String(row.observed_at):null;
  return {
    price,
    observedAt,
    source,
    status,
    usable:true
  };
}

function syncLiveKospiSnapshot(row=marketAiKospiSnapshot()){
  const changed=applyLiveKospiSnapshot(normalizedLiveKospiSnapshot(row));
  if(changed)requestLiveValuationRender({refreshOpenOverlay:false});
  else flushLiveValuationRender();
  return changed;
}

// [LIVE04] Quote Refresh / Universe Reconcile · 현재 보유 ticker universe 조회 / stale response 폐기
function queueUniverseReconcileRefresh(){
  if(document.visibilityState!=='visible')return;
  window.setTimeout(()=>refreshLiveValuation(),0);
}

// Polling·visible 복귀·종목 재조정이 겹쳐도 client identity 확인부터 body 소비까지
// 한 요청만 유지한다. 재연결은 이전 요청 종료 후 새 세션으로 즉시 다시 조회한다.
function refreshLiveValuation(){
  if(!liveValuationNetworkAllowed())return Promise.resolve();
  if(liveValuationRefreshInFlight)return liveValuationRefreshInFlight.promise;
  const flight={sequence:++liveValuationRefreshSequence,promise:null};
  liveValuationRefreshInFlight=flight;
  flight.promise=runLiveValuationRefresh(flight.sequence).finally(()=>{
    if(liveValuationRefreshInFlight===flight)liveValuationRefreshInFlight=null;
    if(flight.sequence!==liveValuationRefreshSequence&&liveValuationNetworkAllowed())queueUniverseReconcileRefresh();
  });
  return flight.promise;
}

async function runLiveValuationRefresh(refreshSequence){
  if(!liveValuationNetworkAllowed())return;
  const today=kstTodayText();
  const tickers=liveValuationTickersForDate(today);
  if(liveValuationSettledFor(today,tickers)){
    flushLiveValuationRender();
    return;
  }
  const requestedUniverseKey=liveValuationUniverseKey(tickers);
  const clientId=await resolveLiveValuationClientId();
  if(!liveValuationNetworkAllowed())return;
  if(refreshSequence!==liveValuationRefreshSequence)return;
  if(!tickers.length){
    const previousRequested=Array.isArray(dataState.liveValuation?.requestedTickers)?dataState.liveValuation.requestedTickers:[];
    const hasPreviousItems=Object.keys(dataState.liveValuation?.items||{}).length>0;
    if(previousRequested.length||hasPreviousItems){
      const changed=clearLiveValuationSnapshot('empty-universe',[]);
      liveValuationLastFingerprint='';
      if(changed)requestLiveValuationRender();
      else flushLiveValuationRender();
    }
  }

  const query=new URLSearchParams({
    tickers:tickers.join(','),
    client_id:clientId
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
    // Never apply a response for an obsolete ticker universe; immediately reconcile 해당 client_id의 backend lease.
    const currentUniverseKey=liveValuationUniverseKey(liveValuationTickersForDate(today));
    if(currentUniverseKey!==requestedUniverseKey){
      queueUniverseReconcileRefresh();
      return;
    }

    const fingerprint=liveValuationFingerprint(payload,tickers);
    applyLiveValuationSnapshot(payload,tickers);
    updateLiveValuationSettledSession(today,tickers);
    const payloadChanged=fingerprint!==liveValuationLastFingerprint;
    liveValuationLastFingerprint=fingerprint;
    if(payloadChanged)requestLiveValuationRender();
    else flushLiveValuationRender();
  }catch(error){
    if(refreshSequence!==liveValuationRefreshSequence)return;
    response?.releaseTimeout?.();
    liveValuationLastFingerprint='';
    const changed=clearLiveValuationSnapshot(
      error?.name==='AbortError'?'timeout':'request-failed',
      tickers.length?null:[]
    );
    if(changed)requestLiveValuationRender();
    else flushLiveValuationRender();
  }
}

// [LIVE05] Lifecycle / Public API · visible 복귀 refresh / 5초 network polling + closed-session local sentinel
function setupLiveValuation({renderDashboard,renderOpenOverlay}={}){
  renderDashboardCallback=typeof renderDashboard==='function'?renderDashboard:null;
  renderOpenOverlayCallback=typeof renderOpenOverlay==='function'?renderOpenOverlay:null;
  if(liveValuationSetupBound){
    flushLiveValuationRender();
    return;
  }
  liveValuationSetupBound=true;
  liveValuationMarketAiConnected=document.documentElement.dataset.marketAiConnected==='true';
  window.addEventListener(MARKET_AI_KOSPI_SNAPSHOT_EVENT,event=>{
    if(!marketAiEnabled())return;
    syncLiveKospiSnapshot(event?.detail?.row??null);
  });
  window.addEventListener(MARKET_AI_CONNECTION_EVENT,event=>{
    const connected=event?.detail?.connected===true;
    liveValuationMarketAiConnected=connected;
    if(!connected){
      clearLiveValuationForDisconnected('market-ai-offline');
      return;
    }
    syncLiveKospiSnapshot();
    ensureLiveValuationPollTimer();
    if(document.visibilityState==='visible')refreshLiveValuation();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      flushLiveValuationRender();
      if(liveValuationNetworkAllowed())refreshLiveValuation();
    }
  });
  if(liveValuationNetworkAllowed()){
    syncLiveKospiSnapshot();
    ensureLiveValuationPollTimer();
    refreshLiveValuation();
  }else{
    clearLiveValuationSnapshot(marketAiEnabled()?'market-ai-offline':'market-ai-disabled',[]);
    clearLiveKospiSnapshot();
  }
}

export {
  LIVE_VALUATION_POLL_MS,
  refreshLiveValuation,
  setupLiveValuation
};
