// Market AI standalone dashboard adapter
// - 메인 7개 ES Module graph와 분리
// - dashboard-app.js / dashboard-ui.js 수정 없이 index.html에서 독립 로드
// - 연금+계좌 성과 영역 안에 한 줄짜리 compact signal row만 부착
// - 기존 대시보드 render가 #app을 교체해도 MutationObserver로 자체 영역만 재부착
// - Stage 9 calibration이 있으면 해당 target만 확률로 표시하고, 없으면 기존 100점 신호 유지
// - GitHub Pages 등 비로컬 환경에서는 Market AI UI 자체를 표시하지 않음

const MARKET_AI_POLL_MS=60_000;
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_STALE_MS=5*60_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1']);
const MARKET_AI_STYLE_ID='marketAiStandaloneStyles';

const marketAiState={
  signal:null,
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

function ensureMarketAiStyles(){
  if(document.getElementById(MARKET_AI_STYLE_ID))return;
  const style=document.createElement('style');
  style.id=MARKET_AI_STYLE_ID;
  style.textContent=`
#market-ai-section{margin-top:var(--space-3xl);min-width:0}
.market-ai-inline-strip{display:flex;align-items:center;gap:10px;min-width:0;min-height:32px;padding:5px 10px;border:1px solid var(--line);border-radius:min(var(--surface-radius-sm),var(--corner-surface-cap));background:var(--card);box-shadow:var(--shadow-low);font-size:var(--type-size-sm);line-height:1.2;white-space:nowrap;overflow:hidden}
.market-ai-inline-title{flex:0 0 auto;color:var(--ink);font-weight:var(--type-weight-strong);letter-spacing:-.02em}
.market-ai-inline-metrics{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:1 1 auto;min-width:0}
.market-ai-inline-metric{display:inline-flex;align-items:baseline;gap:4px;min-width:0}
.market-ai-inline-label{color:var(--muted);font-weight:var(--type-weight-bold);letter-spacing:-.02em}
.market-ai-inline-value{font-weight:var(--type-weight-emphasis);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.market-ai-inline-status{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-weight:var(--type-weight-bold)}
@media (min-width:761px) and (max-width:1100px){
  .market-ai-inline-strip{gap:8px;padding:5px 8px;font-size:11px}
  .market-ai-inline-metrics{gap:9px}
  .market-ai-inline-metric{gap:3px}
}
@media (max-width:760px){
  #market-ai-section{margin-top:var(--space-2xl)}
  .market-ai-inline-strip{gap:5px;min-height:28px;padding:4px 6px;font-size:clamp(9px,2.35vw,10.5px)}
  .market-ai-inline-title{padding-right:5px;border-right:1px solid var(--line)}
  .market-ai-inline-metrics{gap:5px}
  .market-ai-inline-metric{gap:2px}
}
`;
  document.head.appendChild(style);
}

function marketAiInlineMetric(label,key){
  return `<span class="market-ai-inline-metric" data-market-ai-card="${key}"><span class="market-ai-inline-label" data-market-ai-label>${label}</span><strong class="market-ai-inline-value" data-market-ai-score="${key}">--</strong></span>`;
}

function createMarketAiSection(){
  const row=document.createElement('div');
  row.id='market-ai-section';
  row.setAttribute('role','group');
  row.setAttribute('aria-labelledby','marketAiTitle');
  row.innerHTML=`<div class="market-ai-inline-strip"><span id="marketAiTitle" class="market-ai-inline-title">AI Market Signal</span><span class="market-ai-inline-metrics" aria-label="현재 Market AI 시장 신호">${marketAiInlineMetric('KOSPI','kospi')}${marketAiInlineMetric('반도체','semiconductors')}${marketAiInlineMetric('갭상','gap')}${marketAiInlineMetric('상승마감','up-close')}</span><span class="market-ai-inline-status" data-market-ai-status role="status" aria-live="polite">연결 확인 중</span></div>`;
  return row;
}

function mountMarketAiSection(){
  if(!marketAiApiBase())return null;
  ensureMarketAiStyles();
  const summary=document.getElementById('summary-section');
  if(!summary)return null;
  let row=document.getElementById('market-ai-section');
  if(row&&row.parentElement===summary)return row;
  row=createMarketAiSection();
  summary.appendChild(row);
  return row;
}

function removeMarketAiUi(){
  document.getElementById('market-ai-section')?.remove();
  document.querySelectorAll('[data-section-target="market-ai-section"]').forEach(item=>item.remove());
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
    {key:'semiconductors',target:'semiconductor_up',score:signal?.semiconductor_score,shortLabel:'반도체',fullSignalLabel:'반도체 신호',fullProbabilityLabel:'반도체 상승확률'},
    {key:'gap',target:'gap_up',score:signal?.gap_up_probability,shortLabel:'갭상',fullSignalLabel:'갭상 신호',fullProbabilityLabel:'갭상 확률'},
    {key:'up-close',target:'up_close',score:signal?.up_close_probability,shortLabel:'상승마감',fullSignalLabel:'상승마감 신호',fullProbabilityLabel:'상승마감 확률'}
  ];

  const metricsWrap=row.querySelector('.market-ai-inline-metrics');
  const status=row.querySelector('[data-market-ai-status]');
  if(metricsWrap)metricsWrap.hidden=!signal;
  if(status)status.hidden=!!signal;

  metrics.forEach(metric=>{
    const item=row.querySelector(`[data-market-ai-card="${metric.key}"]`);
    const value=row.querySelector(`[data-market-ai-score="${metric.key}"]`);
    if(!value)return;
    const probability=Number(probabilities[metric.target]);
    const calibrated=calibratedTargets.has(metric.target)&&Number.isFinite(probability);
    const displayValue=calibrated?probability*100:metric.score;
    value.textContent=calibrated?marketAiProbabilityText(probability):marketAiScoreText(metric.score);
    value.classList.remove('positive','negative');
    const valueClass=marketAiScoreClass(displayValue);
    if(valueClass)value.classList.add(valueClass);
    const label=item?.querySelector('[data-market-ai-label]');
    if(label)label.textContent=metric.shortLabel;
    if(item){
      const sampleCount=Number(modelMeta?.[metric.target]?.sample_count);
      const fullLabel=calibrated?metric.fullProbabilityLabel:metric.fullSignalLabel;
      const basis=calibrated&&Number.isFinite(sampleCount)?`통계 보정 · n=${sampleCount}`:(calibrated?'통계 보정':'100점 기준');
      item.setAttribute('title',`${fullLabel} · ${basis}`);
      item.setAttribute('aria-label',fullLabel);
    }
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
