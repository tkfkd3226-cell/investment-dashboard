// Market AI standalone dashboard adapter
// - 메인 7개 ES Module graph와 분리
// - dashboard-app.js / dashboard-ui.js 수정 없이 index.html에서 독립 로드
// - 상단 날짜 바 바로 아래, 본문 KPI보다 앞에 독립 Market Signal 영역으로 부착
// - Desktop/Tablet: KOSPI → K200선물 → SOX → 갭상 → 상승마감 순서로 compact 표시
// - Mobile: 현재 시장(KOSPI/K200선물/SOX)과 AI 신호(코스피/반도체/갭상/상승마감)를 분리 표시
// - 기존 대시보드 render가 #app을 교체해도 MutationObserver로 자체 영역만 재부착
// - Stage 9 calibration이 있으면 해당 target만 확률로 표시하고, 없으면 기존 100점 신호 유지
// - GitHub Pages 등 비로컬 환경에서는 Market AI UI 자체를 표시하지 않음

const MARKET_AI_POLL_MS=60_000;
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_STALE_MS=5*60_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1']);
const MARKET_AI_KIS_FUTURES_SYMBOL='FUTURES:KOSPI200';

const marketAiState={
  signal:null,
  marketSnapshot:{},
  status:'연결 확인 중',
  message:'선택일과 무관한 현재 Market AI 신호를 확인하고 있습니다.',
  lastSignalAt:null
};

let marketAiPollTimer=0;
let mountFrame=0;

function marketAiApiBase(){
  if(!LOCAL_DASHBOARD_HOSTS.has(location.hostname))return '';
  return `${location.protocol}//${location.hostname}:8001`;
}

function fetchWithTimeout(url,options={},timeoutMs=MARKET_AI_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
  return fetch(url,{...options,signal:controller.signal}).finally(()=>window.clearTimeout(timer));
}

function marketAiScoreClass(value){
  if(value==null||value==='')return '';
  const n=Number(value);
  if(!Number.isFinite(n))return '';
  if(n>=55)return 'positive';
  if(n<=45)return 'negative';
  return '';
}

function marketAiDirectionClass(value){
  if(value==null||value==='')return '';
  const n=Number(value);
  if(!Number.isFinite(n)||n===0)return '';
  return n>0?'positive':'negative';
}

function marketAiScoreText(value){
  if(value==null||value==='')return '--';
  const n=Number(value);
  return Number.isFinite(n)?n.toFixed(1):'--';
}

function marketAiPercentText(value){
  if(value==null||value==='')return '--';
  const n=Number(value);
  return Number.isFinite(n)?`${Math.round(n*100)}%`:'--';
}

function marketAiProbabilityText(value){
  if(value==null||value==='')return '--';
  const n=Number(value);
  return Number.isFinite(n)?`${(n*100).toFixed(1)}%`:'--';
}

function marketAiIndexText(value){
  if(value==null||value==='')return '--';
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n).toLocaleString('ko-KR'):'--';
}

function marketAiPriceText(value,digits=2){
  if(value==null||value==='')return '--';
  const n=Number(value);
  return Number.isFinite(n)?n.toLocaleString('ko-KR',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'--';
}

function marketAiChangeText(value){
  if(value==null||value==='')return '';
  const n=Number(value);
  if(!Number.isFinite(n))return '';
  return `${n>0?'+':''}${n.toFixed(2)}%`;
}

function kstDateParts(date){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
  }).formatToParts(date);
  const get=type=>parts.find(part=>part.type===type)?.value||'';
  return {year:get('year'),month:get('month'),day:get('day')};
}

function marketAiKstTime(iso){
  if(!iso)return '';
  const date=new Date(iso);
  if(Number.isNaN(date.getTime()))return '';
  const signalParts=kstDateParts(date);
  const todayParts=kstDateParts(new Date());
  const signalDate=`${signalParts.year}-${signalParts.month}-${signalParts.day}`;
  const today=`${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const time=new Intl.DateTimeFormat('ko-KR',{
    timeZone:'Asia/Seoul',
    hour:'2-digit',
    minute:'2-digit',
    hour12:false
  }).format(date);
  return signalDate===today
    ?time
    :`${Number(signalParts.month)}/${Number(signalParts.day)} ${time}`;
}

function marketAiSignalFreshness(signal){
  const updatedAt=Date.parse(signal?.updated_at||'');
  if(!Number.isFinite(updatedAt))return {fresh:false,updatedAt:null};
  const age=Date.now()-updatedAt;
  return {
    fresh:age>=-MARKET_AI_STALE_MS&&age<=MARKET_AI_STALE_MS,
    updatedAt:signal.updated_at
  };
}

function marketAiSnapshotMap(payload){
  const items=Array.isArray(payload?.items)?payload.items:[];
  return Object.fromEntries(
    items
      .filter(item=>item&&typeof item.symbol==='string')
      .map(item=>[item.symbol,item])
  );
}

function marketAiSnapshotRow(symbol){
  return marketAiState.marketSnapshot?.[symbol]||null;
}

function marketAiSnapshotFreshness(row){
  const observedAt=Date.parse(row?.observed_at||'');
  if(!Number.isFinite(observedAt))return {fresh:false,observedAt:null};
  const age=Date.now()-observedAt;
  return {
    fresh:age>=-MARKET_AI_STALE_MS&&age<=MARKET_AI_STALE_MS,
    observedAt:row.observed_at
  };
}

function marketAiKisFuturesState(){
  const rawRow=marketAiSnapshotRow(MARKET_AI_KIS_FUTURES_SYMBOL);
  if(!rawRow)return {row:null,rawRow:null,reason:'missing'};
  const source=String(rawRow.source||'');
  if(!source.startsWith('kis-efriend:')||source.includes(':proxy')){
    return {row:null,rawRow,reason:'source'};
  }
  const freshness=marketAiSnapshotFreshness(rawRow);
  if(!freshness.fresh){
    return {row:null,rawRow,reason:'stale',observedAt:freshness.observedAt};
  }
  return {row:rawRow,rawRow,reason:'fresh',observedAt:freshness.observedAt};
}

function marketAiKisFuturesTitle(state){
  if(state?.row){
    return marketAiMarketTitle('KOSPI200 선물',state.row,{sourceLabel:'KIS eFriend 실제 선물'});
  }
  if(state?.reason==='stale'&&state.rawRow){
    const observed=marketAiKstTime(state.rawRow.observed_at);
    const parts=['KOSPI200 선물 데이터 지연'];
    if(observed)parts.push(`마지막 수신 ${observed} KST`);
    parts.push('KIS eFriend 실제 선물');
    if(state.rawRow.source)parts.push(String(state.rawRow.source));
    return parts.join(' · ');
  }
  if(state?.reason==='source'&&state.rawRow){
    const parts=['KOSPI200 선물 데이터 없음','실제 KIS 선물 데이터가 확인되지 않았습니다.'];
    if(state.rawRow.source)parts.push(String(state.rawRow.source));
    return parts.join(' · ');
  }
  return 'KOSPI200 선물 데이터 없음 · 실제 KIS 선물 데이터가 확인되지 않았습니다.';
}

function marketAiMarketTitle(label,row,{sourceLabel='시장 데이터'}={}){
  if(!row)return `${label} 데이터 없음`;
  const price=marketAiPriceText(row.price,2);
  const change=marketAiChangeText(row.change_pct);
  const observed=marketAiKstTime(row.observed_at);
  const parts=[`${label} ${price}${change?` (${change})`:''}`,sourceLabel];
  if(observed)parts.push(`${observed} KST`);
  if(row.source)parts.push(String(row.source));
  return parts.join(' · ');
}

function marketAiDesktopSignalMetric(label,key){
  return `<span class="market-ai-desktop-metric" data-market-ai-card="${key}"><span class="market-ai-desktop-label">${label}</span><strong class="market-ai-desktop-signal" data-market-ai-score="${key}">--</strong></span>`;
}

function marketAiDesktopIndexSignalMetric(label,key,marketKey){
  return `<span class="market-ai-desktop-metric" data-market-ai-card="${key}" data-market-ai-market-card="${marketKey}"><span class="market-ai-desktop-label">${label}</span><strong class="market-ai-desktop-value" data-market-ai-market="${marketKey}">--</strong><span class="market-ai-desktop-sep">·</span><span class="market-ai-desktop-signal-prefix">신호</span><strong class="market-ai-desktop-signal" data-market-ai-score="${key}">--</strong></span>`;
}

function marketAiDesktopFuturesMetric(){
  return `<span class="market-ai-desktop-metric" data-market-ai-market-card="kospi200-futures"><span class="market-ai-desktop-label">K200선물</span><strong class="market-ai-desktop-value" data-market-ai-market="kospi200-futures">--</strong><strong class="market-ai-desktop-change" data-market-ai-change="kospi200-futures"></strong></span>`;
}

function marketAiMobileMarketMetric(label,marketKey,{futures=false}={}){
  const change=futures?`<strong class="market-ai-mobile-change" data-market-ai-change="${marketKey}"></strong>`:'';
  return `<span class="market-ai-mobile-metric" data-market-ai-market-card="${marketKey}"><span class="market-ai-mobile-label">${label}</span><span class="market-ai-mobile-value-line"><strong class="market-ai-mobile-value" data-market-ai-market="${marketKey}">--</strong>${change}</span></span>`;
}

function marketAiMobileSignalMetric(label,key){
  return `<span class="market-ai-mobile-metric" data-market-ai-card="${key}"><span class="market-ai-mobile-label">${label}</span><strong class="market-ai-mobile-signal" data-market-ai-score="${key}">--</strong></span>`;
}

function createMarketAiSection(){
  const row=document.createElement('div');
  row.id='market-ai-section';
  row.setAttribute('role','group');
  row.setAttribute('aria-labelledby','marketAiTitle');
  row.innerHTML=`<div class="market-ai-panel"><div class="market-ai-heading"><span id="marketAiTitle" class="market-ai-title">AI Market Signal</span><span class="market-ai-status" data-market-ai-status role="status" aria-live="polite">연결 확인 중</span></div><div class="market-ai-desktop" data-market-ai-content aria-label="현재 시장과 AI 신호">${marketAiDesktopIndexSignalMetric('KOSPI','kospi','kospi-index')}${marketAiDesktopFuturesMetric()}${marketAiDesktopIndexSignalMetric('SOX','semiconductors','sox-index')}${marketAiDesktopSignalMetric('갭상','gap')}${marketAiDesktopSignalMetric('상승마감','up-close')}</div><div class="market-ai-mobile" data-market-ai-content><div class="market-ai-mobile-group"><span class="market-ai-mobile-group-label">현재 시장</span><div class="market-ai-mobile-grid market-ai-mobile-market-grid" aria-label="현재 시장 지수">${marketAiMobileMarketMetric('KOSPI','kospi-index')}${marketAiMobileMarketMetric('K200선물','kospi200-futures',{futures:true})}${marketAiMobileMarketMetric('SOX','sox-index')}</div></div><div class="market-ai-mobile-group"><span class="market-ai-mobile-group-label">AI 신호</span><div class="market-ai-mobile-grid market-ai-mobile-signal-grid" aria-label="AI 시장 신호">${marketAiMobileSignalMetric('코스피','kospi')}${marketAiMobileSignalMetric('반도체','semiconductors')}${marketAiMobileSignalMetric('갭상','gap')}${marketAiMobileSignalMetric('상승마감','up-close')}</div></div></div></div>`;
  return row;
}

function mountMarketAiSection(){
  if(!marketAiApiBase())return null;
  const wrap=document.querySelector('#app > .wrap');
  if(!wrap)return null;
  let row=document.getElementById('market-ai-section');
  if(!row)row=createMarketAiSection();
  if(row.parentElement!==wrap||row!==wrap.firstElementChild)wrap.prepend(row);
  return row;
}

function removeMarketAiUi(){
  document.getElementById('market-ai-section')?.remove();
  document.querySelectorAll('[data-section-target="market-ai-section"]').forEach(item=>item.remove());
}

function syncMarketAiMarketView(row){
  const futuresState=marketAiKisFuturesState();
  const marketItems=[
    {
      key:'kospi-index',
      label:'KOSPI',
      marketRow:marketAiSnapshotRow('INDEX:KOSPI'),
      valueText:item=>marketAiIndexText(item?.price),
      sourceLabel:'Yahoo KOSPI 현물지수'
    },
    {
      key:'sox-index',
      label:'SOX',
      marketRow:marketAiSnapshotRow('INDEX:SOX'),
      valueText:item=>marketAiIndexText(item?.price),
      sourceLabel:'Yahoo PHLX 반도체 현물지수'
    },
    {
      key:'kospi200-futures',
      label:'KOSPI200 선물',
      marketRow:futuresState.row,
      valueText:item=>marketAiPriceText(item?.price,2),
      sourceLabel:'KIS eFriend 실제 선물',
      title:()=>marketAiKisFuturesTitle(futuresState)
    }
  ];

  marketItems.forEach(item=>{
    const cards=[...row.querySelectorAll(`[data-market-ai-market-card="${item.key}"]`)];
    const values=[...row.querySelectorAll(`[data-market-ai-market="${item.key}"]`)];
    if(!cards.length||!values.length)return;
    const directionClass=marketAiDirectionClass(item.marketRow?.change_pct);
    values.forEach(value=>{
      value.textContent=item.valueText(item.marketRow);
      value.classList.remove('positive','negative');
      if(directionClass)value.classList.add(directionClass);
    });
    const title=item.title?item.title():marketAiMarketTitle(item.label,item.marketRow,{sourceLabel:item.sourceLabel});
    cards.forEach(card=>card.setAttribute('title',title));
  });

  const futures=marketItems.find(item=>item.key==='kospi200-futures')?.marketRow||null;
  const directionClass=marketAiDirectionClass(futures?.change_pct);
  row.querySelectorAll('[data-market-ai-change="kospi200-futures"]').forEach(futuresChange=>{
    futuresChange.textContent=marketAiChangeText(futures?.change_pct);
    futuresChange.classList.remove('positive','negative');
    if(directionClass)futuresChange.classList.add(directionClass);
  });
}

function syncMarketAiSignalView(){
  if(!marketAiApiBase()){
    removeMarketAiUi();
    return;
  }
  const row=mountMarketAiSection();
  if(!row)return;
  const signal=marketAiState.signal;
  const calibration=signal?.calibration||{};
  const calibratedTargets=new Set(Array.isArray(calibration.available_targets)?calibration.available_targets:[]);
  const probabilities=calibration.probabilities||{};
  const modelMeta=calibration.models||{};
  const metrics=[
    {key:'kospi',target:'kospi_up',score:signal?.kospi_score,shortLabel:'KOSPI',fullSignalLabel:'KOSPI 신호',fullProbabilityLabel:'KOSPI 상승확률'},
    {key:'semiconductors',target:'semiconductor_up',score:signal?.semiconductor_score,shortLabel:'SOX',fullSignalLabel:'반도체 신호',fullProbabilityLabel:'반도체 상승확률'},
    {key:'gap',target:'gap_up',score:signal?.gap_up_probability,shortLabel:'갭상',fullSignalLabel:'갭상 신호',fullProbabilityLabel:'갭상 확률'},
    {key:'up-close',target:'up_close',score:signal?.up_close_probability,shortLabel:'상승마감',fullSignalLabel:'상승마감 신호',fullProbabilityLabel:'상승마감 확률'}
  ];

  const status=row.querySelector('[data-market-ai-status]');
  row.querySelectorAll('[data-market-ai-content]').forEach(content=>{content.hidden=!signal;});
  if(status)status.hidden=!!signal;

  syncMarketAiMarketView(row);

  metrics.forEach(metric=>{
    const items=[...row.querySelectorAll(`[data-market-ai-card="${metric.key}"]`)];
    const values=[...row.querySelectorAll(`[data-market-ai-score="${metric.key}"]`)];
    if(!values.length)return;
    const probability=Number(probabilities[metric.target]);
    const calibrated=calibratedTargets.has(metric.target)&&Number.isFinite(probability);
    const displayValue=calibrated?probability*100:metric.score;
    const valueText=calibrated?marketAiProbabilityText(probability):marketAiScoreText(metric.score);
    const valueClass=marketAiScoreClass(displayValue);
    values.forEach(value=>{
      value.textContent=valueText;
      value.classList.remove('positive','negative');
      if(valueClass)value.classList.add(valueClass);
    });
    const sampleCount=Number(modelMeta?.[metric.target]?.sample_count);
    const fullLabel=calibrated?metric.fullProbabilityLabel:metric.fullSignalLabel;
    const basis=calibrated&&Number.isFinite(sampleCount)?`통계 보정 · n=${sampleCount}`:(calibrated?'통계 보정':'100점 기준');
    const signalTitle=`${fullLabel} · ${basis}`;
    items.forEach(item=>{
      if(item.hasAttribute('data-market-ai-market-card')){
        const marketTitle=item.getAttribute('title');
        item.setAttribute('title',marketTitle?`${marketTitle} · ${signalTitle}`:signalTitle);
      }else{
        item.setAttribute('title',signalTitle);
      }
      item.setAttribute('aria-label',fullLabel);
    });
  });

  if(!signal){
    if(status){
      status.textContent=marketAiState.status||'연결 확인 중';
      const lastSignal=marketAiKstTime(marketAiState.lastSignalAt);
      const message=marketAiState.message||'Market AI 신호를 확인하고 있습니다.';
      status.setAttribute('title',lastSignal?`${message} · 마지막 신호 ${lastSignal} KST`:message);
    }
    row.setAttribute('aria-label',`AI Market Signal · ${marketAiState.status||'연결 확인 중'}`);
    return;
  }

  const updated=marketAiKstTime(signal.updated_at);
  const meta=[
    '현재 시장',
    `신뢰도 ${marketAiPercentText(signal.confidence)}`,
    `데이터 완성도 ${marketAiPercentText(signal.data_completeness)}`,
    calibratedTargets.size?`확률 보정 ${calibratedTargets.size}/4`:'비보정 룰 기반 신호'
  ];
  if(updated)meta.push(`${updated} KST`);
  const metaText=meta.join(' · ');
  row.setAttribute('title',metaText);
  row.setAttribute('aria-label',`AI Market Signal · ${metaText}`);
}

function setMarketAiState(next){
  Object.assign(marketAiState,next);
  syncMarketAiSignalView();
}

async function refreshMarketAiMarketSnapshot(apiBase){
  try{
    const response=await fetchWithTimeout(`${apiBase}/api/market-data/snapshot`,{
      method:'GET',
      headers:{Accept:'application/json'},
      cache:'no-store'
    });
    if(!response.ok)return null;
    return marketAiSnapshotMap(await response.json());
  }catch(_){
    return null;
  }
}

async function refreshMarketAiSignal(){
  const apiBase=marketAiApiBase();
  if(!apiBase){
    removeMarketAiUi();
    return;
  }

  if(!marketAiState.signal){
    setMarketAiState({status:'연결 확인 중',message:'Market AI 서버에 연결하고 있습니다.'});
  }
  try{
    const [response,nextMarketSnapshot]=await Promise.all([
      fetchWithTimeout(`${apiBase}/api/signal/latest?include_details=false`,{
        method:'GET',
        headers:{Accept:'application/json'},
        cache:'no-store'
      }),
      refreshMarketAiMarketSnapshot(apiBase)
    ]);
    setMarketAiState({marketSnapshot:nextMarketSnapshot||{}});
    if(response.status===404){
      setMarketAiState({
        signal:null,
        status:'신호 대기',
        message:'Market AI가 첫 신호를 생성하면 자동으로 표시됩니다.',
        lastSignalAt:null
      });
      return;
    }
    if(!response.ok)throw new Error(`Market AI HTTP ${response.status}`);
    const signal=await response.json();
    const freshness=marketAiSignalFreshness(signal);
    if(!freshness.fresh){
      setMarketAiState({
        signal:null,
        status:'신호 지연',
        message:freshness.updatedAt
          ?'Market AI 신호가 5분 이상 갱신되지 않았습니다.'
          :'Market AI 신호의 갱신 시각을 확인할 수 없습니다.',
        lastSignalAt:freshness.updatedAt
      });
      return;
    }
    setMarketAiState({signal,status:'연결됨',message:'',lastSignalAt:null});
  }catch(_){
    setMarketAiState({
      signal:null,
      status:'서버 연결 안 됨',
      message:'start-local-server.bat 실행 후 자동으로 다시 연결합니다.',
      lastSignalAt:null
    });
  }
}

function scheduleMount(){
  if(mountFrame)return;
  mountFrame=requestAnimationFrame(()=>{
    mountFrame=0;
    syncMarketAiSignalView();
  });
}

function startMarketAiBridge(){
  if(!marketAiApiBase()){
    removeMarketAiUi();
    return;
  }
  const app=document.getElementById('app');
  if(app)new MutationObserver(scheduleMount).observe(app,{childList:true,subtree:false});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshMarketAiSignal();
  });
  scheduleMount();
  refreshMarketAiSignal();
  if(!marketAiPollTimer){
    marketAiPollTimer=window.setInterval(()=>{
      if(document.visibilityState==='visible')refreshMarketAiSignal();
    },MARKET_AI_POLL_MS);
  }
}

startMarketAiBridge();
