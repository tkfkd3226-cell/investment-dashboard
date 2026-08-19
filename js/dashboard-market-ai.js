// Market AI standalone dashboard adapter
// - 메인 7개 ES Module graph와 분리
// - dashboard-app.js / dashboard-ui.js 수정 없이 index.html에서 독립 로드
// - 기존 대시보드 render가 #app을 교체해도 MutationObserver로 자체 영역만 재부착
// - Stage 9 calibration이 있으면 해당 target만 확률로 표시하고, 없으면 기존 100점 신호 유지

const MARKET_AI_POLL_MS=60_000;
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_STALE_MS=5*60_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1']);

const marketAiState={
  signal:null,
  status:'연결 확인 중',
  message:'선택일과 무관한 현재 Market AI 신호를 확인하고 있습니다.',
  lastSignalAt:null
};

let marketAiPollTimer=0;
let mountFrame=0;

function activityIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12h4l2.2-5.2L13 17l2.2-5H21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

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

function marketAiMetricCard(label,key){
  return `<article class="card metric-card" aria-label="${label}" data-market-ai-card="${key}"><div class="label" data-market-ai-label>${label}</div><div class="value"><span data-market-ai-score="${key}">--</span></div><div class="sub" data-market-ai-basis>100점 기준</div></article>`;
}

function createMarketAiSection(){
  const section=document.createElement('section');
  section.id='market-ai-section';
  section.setAttribute('aria-labelledby','marketAiTitle');
  section.innerHTML=`<div class="section-title"><h2 id="marketAiTitle"><span class="section-title-icon" aria-hidden="true">${activityIconSvg()}</span>AI Market Signal</h2><span class="section-control-chip section-basis-chip" data-market-ai-status role="status" aria-live="polite">연결 확인 중</span></div><div class="grid cards" aria-label="Market AI 시장 신호">${marketAiMetricCard('KOSPI 신호','kospi')}${marketAiMetricCard('반도체 신호','semiconductors')}${marketAiMetricCard('갭상 신호','gap')}${marketAiMetricCard('상승마감 신호','up-close')}</div><div class="sub" data-market-ai-meta>선택일과 무관한 현재 Market AI 신호를 확인하고 있습니다.</div>`;
  return section;
}

function mountMarketAiSection(){
  const wrap=document.querySelector('#app > .wrap');
  if(!wrap)return null;
  let section=document.getElementById('market-ai-section');
  if(section&&section.closest('#app')===document.getElementById('app'))return section;
  section=createMarketAiSection();
  const summary=document.getElementById('summary-section');
  const assetWorkspace=document.getElementById('asset-workspace');
  const securities=document.getElementById('securities-section');
  if(summary&&summary.parentElement===wrap)summary.insertAdjacentElement('afterend',section);
  else if(assetWorkspace&&assetWorkspace.parentElement===wrap)wrap.insertBefore(section,assetWorkspace);
  else if(securities&&securities.parentElement===wrap)wrap.insertBefore(section,securities);
  else wrap.appendChild(section);
  return section;
}

function ensureMarketAiNavItem(group,selector,kind){
  if(!group||group.querySelector('[data-section-target="market-ai-section"]'))return;
  const source=group.querySelector(selector);
  if(!source)return;
  const item=source.cloneNode(true);
  item.removeAttribute('id');
  item.dataset.dashboardAction='jump-section';
  item.dataset.sectionTarget='market-ai-section';
  item.removeAttribute('aria-current');
  item.classList.remove('is-current');
  if(kind==='desktop'){
    item.removeAttribute('data-toc-target');
    item.dataset.tocTarget='market-ai-section';
    const icon=item.querySelector('.desktop-edge-toc-icon');
    if(icon)icon.innerHTML=activityIconSvg();
    const spans=item.querySelectorAll(':scope > span');
    if(spans.length)spans[spans.length-1].textContent='AI Market Signal';
  }else{
    item.dataset.closeDateMenu='true';
    const icon=item.querySelector('.nav-icon');
    if(icon)icon.innerHTML=activityIconSvg();
    const strong=item.querySelector('strong');
    if(strong)strong.textContent='AI Market Signal';
  }
  group.appendChild(item);
}

function mountMarketAiNavigation(){
  document.querySelectorAll('.desktop-edge-toc-group').forEach(group=>{
    if(group.querySelector(':scope > p')?.textContent.trim()!=='전체')return;
    ensureMarketAiNavItem(group,'.desktop-edge-toc-item[data-section-target="summary-section"]','desktop');
  });
  document.querySelectorAll('.mobile-nav-group').forEach(group=>{
    if(group.querySelector(':scope > p')?.textContent.trim()!=='전체')return;
    ensureMarketAiNavItem(group,'.mobile-nav-item[data-section-target="summary-section"]','mobile');
  });
}

function syncMarketAiSignalView(){
  const section=mountMarketAiSection();
  if(!section)return;
  const signal=marketAiState.signal;
  const calibration=signal?.calibration||{};
  const calibratedTargets=new Set(Array.isArray(calibration.available_targets)?calibration.available_targets:[]);
  const probabilities=calibration.probabilities||{};
  const modelMeta=calibration.models||{};
  const metrics=[
    {key:'kospi',target:'kospi_up',score:signal?.kospi_score,signalLabel:'KOSPI 신호',probabilityLabel:'KOSPI 상승확률'},
    {key:'semiconductors',target:'semiconductor_up',score:signal?.semiconductor_score,signalLabel:'반도체 신호',probabilityLabel:'반도체 상승확률'},
    {key:'gap',target:'gap_up',score:signal?.gap_up_probability,signalLabel:'갭상 신호',probabilityLabel:'갭상 확률'},
    {key:'up-close',target:'up_close',score:signal?.up_close_probability,signalLabel:'상승마감 신호',probabilityLabel:'상승마감 확률'}
  ];
  metrics.forEach(metric=>{
    const card=section.querySelector(`[data-market-ai-card="${metric.key}"]`);
    const el=section.querySelector(`[data-market-ai-score="${metric.key}"]`);
    if(!el)return;
    const probability=Number(probabilities[metric.target]);
    const calibrated=calibratedTargets.has(metric.target)&&Number.isFinite(probability);
    const displayValue=calibrated?probability*100:metric.score;
    el.textContent=calibrated?marketAiProbabilityText(probability):marketAiScoreText(metric.score);
    el.classList.remove('positive','negative');
    const valueClass=marketAiScoreClass(displayValue);
    if(valueClass)el.classList.add(valueClass);
    const label=card?.querySelector('[data-market-ai-label]');
    const basis=card?.querySelector('[data-market-ai-basis]');
    if(label)label.textContent=calibrated?metric.probabilityLabel:metric.signalLabel;
    if(card)card.setAttribute('aria-label',calibrated?metric.probabilityLabel:metric.signalLabel);
    if(basis){
      const sampleCount=Number(modelMeta?.[metric.target]?.sample_count);
      basis.textContent=calibrated&&Number.isFinite(sampleCount)
        ?`통계 보정 · n=${sampleCount}`
        :(calibrated?'통계 보정':'100점 기준');
    }
  });

  const status=section.querySelector('[data-market-ai-status]');
  const meta=section.querySelector('[data-market-ai-meta]');
  if(!signal){
    if(status){
      status.textContent=marketAiState.status||'연결 확인 중';
      status.removeAttribute('title');
    }
    if(meta){
      const lastSignal=marketAiKstTime(marketAiState.lastSignalAt);
      const message=marketAiState.message||'Market AI 신호를 확인하고 있습니다.';
      meta.textContent=lastSignal?`${message} · 마지막 신호 ${lastSignal} KST`:message;
    }
    return;
  }

  const updated=marketAiKstTime(signal.updated_at);
  if(status){
    status.textContent=marketAiState.status||'연결됨';
    if(updated)status.setAttribute('title',`Market AI ${updated} 기준`);
    else status.removeAttribute('title');
  }
  if(meta){
    const parts=[
      '현재 시장',
      `신뢰도 ${marketAiPercentText(signal.confidence)}`,
      `데이터 완성도 ${marketAiPercentText(signal.data_completeness)}`,
      calibratedTargets.size?`확률 보정 ${calibratedTargets.size}/4`:'비보정 룰 기반 신호'
    ];
    if(updated)parts.push(`${updated} KST`);
    meta.textContent=parts.join(' · ');
  }
}

function setMarketAiState(next){
  Object.assign(marketAiState,next);
  syncMarketAiSignalView();
}

async function refreshMarketAiSignal(){
  const apiBase=marketAiApiBase();
  if(!apiBase){
    setMarketAiState({
      signal:null,
      status:'로컬 전용',
      message:'GitHub Pages에서는 아직 Market AI 서버를 연결하지 않습니다. 로컬 대시보드에서 확인하세요.',
      lastSignalAt:null
    });
    return;
  }

  if(!marketAiState.signal){
    setMarketAiState({status:'연결 확인 중',message:'Market AI 서버에 연결하고 있습니다.'});
  }
  try{
    const response=await fetchWithTimeout(`${apiBase}/api/signal/latest?include_details=false`,{
      method:'GET',
      headers:{Accept:'application/json'},
      cache:'no-store'
    });
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
      message:'start-market-ai.bat 실행 후 자동으로 다시 연결합니다.',
      lastSignalAt:null
    });
  }
}

function scheduleMount(){
  if(mountFrame)return;
  mountFrame=requestAnimationFrame(()=>{
    mountFrame=0;
    mountMarketAiSection();
    mountMarketAiNavigation();
    syncMarketAiSignalView();
  });
}

function startMarketAiBridge(){
  const app=document.getElementById('app');
  const tabs=document.getElementById('tabs');
  if(app)new MutationObserver(scheduleMount).observe(app,{childList:true,subtree:false});
  if(tabs)new MutationObserver(scheduleMount).observe(tabs,{childList:true,subtree:true});
  document.addEventListener('click',scheduleMount,{passive:true});
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
