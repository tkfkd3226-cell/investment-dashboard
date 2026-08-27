import {
  bindDashboardNativeDialogDismiss,
  closeDashboardNativeDialog,
  openDashboardNativeDialog
} from './dashboard-modal.js';

// Market AI Standalone Adapter · main feature graph와 분리된 독립 entry
// Ownership: dashboard-modal.js의 저수준 dialog lifecycle만 공유하고, mount/state/fetch/render는 이 파일이 소유한다.
// Responsive contract: Desktop/Tablet은 Hero 우측 panel, Phone은 동일 panel을 modal로 이동 재사용하며 Tooltip을 비활성화한다.
// Preview contract: ?market-ai-preview=1/2는 Desktop/Tablet, 3은 실제 Mobile viewport 예시 데이터다.
// Structure map:
//   [MARKET01] Configuration / Runtime State
//   [MARKET02] Environment / Preview / Fetch
//   [MARKET03] Formatting / Time / Freshness
//   [MARKET04] Snapshot / Session State
//   [MARKET05] Tooltip Core
//   [MARKET06] Signal Detail Normalization
//   [MARKET07] Tooltip Content / Interaction
//   [MARKET08] Metric Markup / Responsive Mobile UI
//   [MARKET09] Mount / Render
//   [MARKET10] State Update / Data Refresh
//   [MARKET11] Lifecycle / Polling

// [MARKET01] Configuration / Runtime State · endpoint / preview / metric contract

const MARKET_AI_POLL_MS=60_000;
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_STALE_MS=5*60_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1']);
const MARKET_AI_PREVIEW_VARIANT=new URLSearchParams(location.search).get('market-ai-preview');
const MARKET_AI_PREVIEW_MODE=['1','2','3'].includes(MARKET_AI_PREVIEW_VARIANT);
const MARKET_AI_KIS_FUTURES_SYMBOL='FUTURES:KOSPI200';
const MARKET_AI_SOX_INDEX_SYMBOL='INDEX:SOX';
const MARKET_AI_SOX_FUTURES_SYMBOL='FUTURES:SOX';
const MARKET_AI_NASDAQ100_FUTURES_SYMBOL='FUTURES:NQ';
const MARKET_AI_TOOLTIP_ID='marketAiTooltip';
const MARKET_AI_MOBILE_DIALOG_ID='marketAiMobileDialog';
const MARKET_AI_MOBILE_TRIGGER_ID='marketAiMobileTrigger';
const MARKET_AI_CLOSE_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
const MARKET_AI_PHONE_MEDIA_QUERY='(max-width:760px), (orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse)';
const marketAiPhoneMedia=window.matchMedia(MARKET_AI_PHONE_MEDIA_QUERY);
const MARKET_AI_SCORE_RANGE_LINES=[
  '0–34.9 강한 약세 · 35–45 약세 · 45 초과–54.9 중립',
  '55–64.9 강세 · 65–100 강한 강세'
];
const MARKET_AI_SIGNAL_METRICS=[
  {key:'kospi',target:'kospi_up',stateKey:'kospi',scoreField:'kospi_score',detailKeys:['kospi','kospi_up'],fullSignalLabel:'코스피 신호',fullProbabilityLabel:'코스피 상승확률'},
  {key:'semiconductors',target:'semiconductor_up',stateKey:'semiconductors',scoreField:'semiconductor_score',detailKeys:['semiconductors','semiconductor','semiconductor_up'],fullSignalLabel:'반도체 신호',fullProbabilityLabel:'반도체 상승확률'},
  {key:'gap',target:'gap_up',stateKey:'gap_up',scoreField:'gap_up_probability',detailKeys:['gap','gap_up'],fullSignalLabel:'갭상 신호',fullProbabilityLabel:'갭상 확률'},
  {key:'up-close',target:'up_close',stateKey:'up_close',scoreField:'up_close_probability',detailKeys:['up_close','up-close','up_close_probability'],fullSignalLabel:'상승마감 신호',fullProbabilityLabel:'상승마감 확률'}
];
const MARKET_AI_COMPONENT_LABELS={
  kospi:'KOSPI',kospi_index:'KOSPI',kospi_spot:'KOSPI 현물',kospi200:'KOSPI200',kospi200_futures:'KOSPI200 선물',
  semiconductor:'반도체',semiconductors:'반도체',sox:'SOX',sox_index:'SOX',
  samsung:'삼성전자',samsung_electronics:'삼성전자',sk_hynix:'SK하이닉스',sk_hynix_adr:'SK하이닉스 ADR',
  nvidia:'NVIDIA',nvda:'NVIDIA',micron:'Micron',mu:'Micron',
  nasdaq100:'NASDAQ100',nasdaq100_futures:'NASDAQ100 선물',sp500:'S&P500',sp500_futures:'S&P500 선물',
  usdkrw:'USD/KRW',fx_usdkrw:'USD/KRW',us10y:'미국 10년물',us30y:'미국 30년물',
  wti:'WTI',brent:'Brent',oil:'유가',news:'뉴스',news_score:'뉴스',ai_news:'AI 뉴스',
  geopolitics:'지정학',fed_rates:'Fed·금리',us_policy:'미국 정책',korea_market:'국내 시장'
};

const marketAiState={
  signal:null,
  marketSnapshot:{},
  bridgeStatus:null,
  status:'연결 확인 중',
  statusKind:'checking',
  message:'선택일과 무관한 현재 Market AI 신호를 확인하고 있습니다.',
  lastSignalAt:null
};

let marketAiPollTimer=0;
let mountFrame=0;
let marketAiTooltipEventsBound=false;

// [MARKET02] Environment / Preview / Fetch · 실행 환경 / 예시 데이터 / timeout
function marketAiApiBase(){
  if(!LOCAL_DASHBOARD_HOSTS.has(location.hostname))return '';
  return `${location.protocol}//${location.hostname}:8001`;
}

function marketAiUiEnabled(){
  return MARKET_AI_PREVIEW_MODE||!!marketAiApiBase();
}

function marketAiPhoneUi(){
  return marketAiPhoneMedia.matches;
}

function marketAiPreviewState(){
  const now=new Date().toISOString();
  return {
    signal:{
      kospi_score:68.4,
      semiconductor_score:73.1,
      gap_up_probability:64.2,
      up_close_probability:59.6,
      confidence:0.78,
      data_completeness:0.96,
      updated_at:now,
      calibration:{
        available_targets:[],
        probabilities:{},
        models:{}
      },
      details:{
        session_phase:{phase:'intraday',kst:now,trading_today:true,calendar_source:'preview'},
        signal_state:{
          kospi:{available:true,note:'예시 KOSPI 신호'},
          semiconductors:{available:true,note:'예시 반도체 신호'},
          gap_up:{mode:'locked_preopen',available:true,target_session_date:now.slice(0,10),forecast_at:now,note:'예시 장전 확정 신호'},
          up_close:{mode:'intraday_forecast',available:true,target_session_date:now.slice(0,10),forecast_at:now,note:'예시 장중 예측'}
        },
        effective_weights:{
          kospi:{
            kospi_index:{configured_weight:0.35,effective_weight:0.35,quality:1,available:true},
            kospi200_futures:{configured_weight:0.65,effective_weight:0.65,quality:1,available:true}
          },
          semiconductors:{
            samsung_electronics:{configured_weight:0.20,effective_weight:0.20,quality:1,available:true},
            sk_hynix:{configured_weight:0.20,effective_weight:0.20,quality:1,available:true},
            sox_index:{configured_weight:0.20,effective_weight:0.20,quality:1,available:true},
            nvidia:{configured_weight:0.15,effective_weight:0.15,quality:1,available:true},
            sk_hynix_adr:{configured_weight:0.15,effective_weight:0.15,quality:1,available:true},
            micron:{configured_weight:0.10,effective_weight:0.10,quality:1,available:true}
          },
          gap_up:{
            kospi200_futures:{configured_weight:0.50,effective_weight:0.50,quality:1,available:true},
            sox_index:{configured_weight:0.25,effective_weight:0.25,quality:1,available:true},
            nasdaq100_futures:{configured_weight:0.20,effective_weight:0.20,quality:1,available:true},
            usdkrw:{configured_weight:0.05,effective_weight:0.05,quality:1,available:true}
          },
          up_close:{
            kospi_index:{configured_weight:0.45,effective_weight:0.45,quality:1,available:true},
            kospi200_futures:{configured_weight:0.35,effective_weight:0.35,quality:1,available:true},
            sox_index:{configured_weight:0.12,effective_weight:0.12,quality:1,available:true},
            nasdaq100_futures:{configured_weight:0.08,effective_weight:0.08,quality:1,available:true}
          }
        }
      }
    },
    marketSnapshot:marketAiSnapshotMap({items:[
      {symbol:'INDEX:KOSPI',price:3278.64,change_pct:0.84,observed_at:now,source:'preview'},
      {symbol:MARKET_AI_KIS_FUTURES_SYMBOL,price:438.25,change_pct:0.72,observed_at:now,source:'kis-efriend:preview'},
      {symbol:MARKET_AI_SOX_INDEX_SYMBOL,price:5916.43,change_pct:1.18,observed_at:now,source:'preview'},
      {symbol:MARKET_AI_SOX_FUTURES_SYMBOL,price:5934.75,change_pct:0.92,observed_at:now,source:'preview'},
      {symbol:MARKET_AI_NASDAQ100_FUTURES_SYMBOL,price:24386.75,change_pct:0.61,observed_at:now,source:'preview'}
    ]}),
    bridgeStatus:{market_open:true,connected:true,expected_session:'day'},
    status:'예시 데이터',
    statusKind:'preview',
    message:'비로컬 미리보기용 예시 데이터입니다.',
    lastSignalAt:null
  };
}

function fetchWithTimeout(url,options={},timeoutMs=MARKET_AI_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
  return fetch(url,{...options,signal:controller.signal}).finally(()=>window.clearTimeout(timer));
}

// [MARKET03] Formatting / Time / Freshness · 점수 / 시장값 / 시간 표현
function marketAiScoreClass(value){
  if(value==null||value==='')return '';
  const n=Number(value);
  if(!Number.isFinite(n))return '';
  if(n>=55)return 'positive';
  if(n<=45)return 'negative';
  return '';
}

function marketAiScoreBand(value){
  const n=Number(value);
  if(!Number.isFinite(n))return {label:'판단 불가',className:''};
  if(n<35)return {label:'강한 약세',className:'tt-neg'};
  if(n<=45)return {label:'약세',className:'tt-neg'};
  if(n<55)return {label:'중립',className:''};
  if(n<65)return {label:'강세',className:'tt-pos'};
  return {label:'강한 강세',className:'tt-pos'};
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

// [MARKET04] Snapshot / Session State · 시장 snapshot / K200 session 판단
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

function marketAiClockParts(timeZone,date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone,
    weekday:'short',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23'
  }).formatToParts(date);
  const get=type=>parts.find(part=>part.type===type)?.value||'';
  const weekdayIndex={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[get('weekday')];
  const hour=Number(get('hour'));
  const minute=Number(get('minute'));
  return {
    weekday:Number.isInteger(weekdayIndex)?weekdayIndex:-1,
    minuteOfDay:Number.isFinite(hour)&&Number.isFinite(minute)?hour*60+minute:-1
  };
}

function marketAiKstClockParts(date=new Date()){
  return marketAiClockParts('Asia/Seoul',date);
}

function marketAiUsCashSessionOpen(date=new Date()){
  const {weekday,minuteOfDay}=marketAiClockParts('America/New_York',date);
  return weekday>=1&&weekday<=5&&minuteOfDay>=9*60+30&&minuteOfDay<16*60;
}

function marketAiSoxDisplayState(date=new Date()){
  const indexRow=marketAiSnapshotRow(MARKET_AI_SOX_INDEX_SYMBOL);
  const futuresRow=marketAiSnapshotRow(MARKET_AI_SOX_FUTURES_SYMBOL);
  const regularClockOpen=marketAiUsCashSessionOpen(date);
  const indexFresh=marketAiSnapshotFreshness(indexRow).fresh;
  const useIndex=regularClockOpen&&(MARKET_AI_PREVIEW_MODE||indexFresh);
  if(useIndex||(!futuresRow&&indexRow)){
    return {
      row:indexRow,
      label:'SOX',
      price:item=>marketAiIndexText(item?.price),
      source:MARKET_AI_PREVIEW_MODE?'내장 예시 데이터':'Yahoo PHLX 반도체 현물지수'
    };
  }
  return {
    row:futuresRow,
    label:'SOX-F',
    price:item=>marketAiPriceText(item?.price,2),
    source:MARKET_AI_PREVIEW_MODE?'내장 예시 데이터':'Yahoo E-mini PHLX 반도체 선물 (SOX=F)'
  };
}

function marketAiK200FallbackSessionOpen(date=new Date()){
  const {weekday,minuteOfDay}=marketAiKstClockParts(date);
  if(weekday<0||minuteOfDay<0)return true;

  const daySession=minuteOfDay>=8*60+45&&minuteOfDay<15*60+45;
  const nightEvening=minuteOfDay>=18*60;
  const nightMorning=minuteOfDay<6*60;

  if(weekday===0)return false;
  if(weekday===1)return daySession||nightEvening;
  if(weekday>=2&&weekday<=5)return nightMorning||daySession||nightEvening;
  return weekday===6&&nightMorning;
}

function marketAiKisFuturesState(){
  const rawRow=marketAiSnapshotRow(MARKET_AI_KIS_FUTURES_SYMBOL);
  const bridgeStatus=marketAiObject(marketAiState.bridgeStatus);
  if(!rawRow)return {row:null,rawRow:null,reason:'missing',bridgeStatus};
  const source=String(rawRow.source||'');
  if(!source.startsWith('kis-efriend:')||source.includes(':proxy')){
    return {row:null,rawRow,reason:'source',bridgeStatus};
  }
  const freshness=marketAiSnapshotFreshness(rawRow);
  if(!freshness.fresh){
    const backendMarketOpen=typeof bridgeStatus?.market_open==='boolean'?bridgeStatus.market_open:null;
    if(backendMarketOpen===false||(backendMarketOpen==null&&!marketAiK200FallbackSessionOpen())){
      return {row:rawRow,rawRow,reason:'closed',observedAt:freshness.observedAt,bridgeStatus};
    }
    if(backendMarketOpen===true&&bridgeStatus?.connected===false){
      return {row:null,rawRow,reason:'bridge',observedAt:freshness.observedAt,bridgeStatus};
    }
    return {row:null,rawRow,reason:'stale',observedAt:freshness.observedAt,bridgeStatus};
  }
  return {row:rawRow,rawRow,reason:'fresh',observedAt:freshness.observedAt,bridgeStatus};
}

// [MARKET05] Tooltip Core · markup / positioning / visibility
function marketAiEscape(value){
  return String(value??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function marketAiTooltipRow(name,value,className=''){
  return `<div class="tt-row"><span class="tt-name">${marketAiEscape(name)}</span><span class="tt-val${className?` ${className}`:''}">${marketAiEscape(value)}</span></div>`;
}

function marketAiTooltipDivider(){
  return '<div class="tt-divider" aria-hidden="true"></div>';
}

function marketAiTooltipSection(label){
  return `<div class="market-ai-tooltip-section">${marketAiEscape(label)}</div>`;
}

function marketAiTooltipNote(text){
  return `<div class="market-ai-tooltip-note">${marketAiEscape(text)}</div>`;
}

function marketAiScoreRangeHtml(calibrated){
  const lines=MARKET_AI_SCORE_RANGE_LINES.map(line=>calibrated?line.replace(/(\d+(?:\.\d+)?)/g,'$1%'):line);
  return `<div class="market-ai-tooltip-score-range">${lines.map(line=>`<div class="market-ai-tooltip-score-line">${marketAiEscape(line)}</div>`).join('')}</div>`;
}

function marketAiTooltip(){
  let tooltip=document.getElementById(MARKET_AI_TOOLTIP_ID);
  if(tooltip)return tooltip;
  tooltip=document.createElement('div');
  tooltip.id=MARKET_AI_TOOLTIP_ID;
  tooltip.className='dash-tooltip market-ai-tooltip';
  tooltip.setAttribute('role','tooltip');
  tooltip.setAttribute('aria-hidden','true');
  document.body.appendChild(tooltip);
  return tooltip;
}

function marketAiTooltipViewport(){
  const viewport=window.visualViewport;
  return {
    width:Math.max(1,Math.min(window.innerWidth,viewport?.width||window.innerWidth)),
    height:Math.max(1,Math.min(window.innerHeight,viewport?.height||window.innerHeight))
  };
}

function marketAiTooltipPoint(target,event){
  if(Number.isFinite(event?.clientX)&&Number.isFinite(event?.clientY)&&event.clientX+event.clientY>0){
    return {x:event.clientX,y:event.clientY};
  }
  const rect=target.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
}

function positionMarketAiTooltip(target,event){
  const tooltip=marketAiTooltip();
  const point=marketAiTooltipPoint(target,event);
  tooltip.style.visibility='hidden';
  tooltip.style.left=`${point.x}px`;
  tooltip.style.top=`${point.y}px`;
  tooltip.classList.add('visible');
  requestAnimationFrame(()=>{
    if(!tooltip.classList.contains('visible'))return;
    const viewport=marketAiTooltipViewport();
    const rect=tooltip.getBoundingClientRect();
    const pad=14,gap=12;
    const width=Math.min(rect.width,Math.max(1,viewport.width-pad*2));
    const height=Math.min(rect.height,Math.max(1,viewport.height-pad*2));
    let left=point.x+gap;
    if(left+width>viewport.width-pad)left=point.x-width-gap;
    left=Math.max(pad,Math.min(left,Math.max(pad,viewport.width-width-pad)));
    let top=point.y-height-gap;
    if(top<pad)top=point.y+18;
    if(top+height>viewport.height-pad)top=Math.max(pad,viewport.height-height-pad);
    tooltip.style.left=`${left}px`;
    tooltip.style.top=`${top}px`;
    tooltip.style.visibility='visible';
  });
}

function hideMarketAiTooltip(){
  const tooltip=document.getElementById(MARKET_AI_TOOLTIP_ID);
  if(!tooltip)return;
  tooltip.classList.remove('visible');
  tooltip.setAttribute('aria-hidden','true');
  tooltip.style.visibility='';
}

// [MARKET06] Signal Detail Normalization · API details / availability / effective weights
function marketAiObject(value){
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
}

function marketAiSignalRoots(signal){
  return [signal,signal?.details,signal?.detail,signal?.diagnostics].map(marketAiObject).filter(Boolean);
}

function marketAiTargetBucket(signal,bucketNames,targetNames){
  for(const root of marketAiSignalRoots(signal)){
    for(const bucketName of bucketNames){
      const bucket=marketAiObject(root[bucketName]);
      if(!bucket)continue;
      for(const targetName of targetNames){
        const target=marketAiObject(bucket[targetName]);
        if(target)return target;
      }
    }
  }
  return null;
}

function marketAiGlobalBucket(signal,bucketNames){
  for(const root of marketAiSignalRoots(signal)){
    for(const bucketName of bucketNames){
      const bucket=marketAiObject(root[bucketName]);
      if(bucket)return bucket;
    }
  }
  return null;
}

function marketAiComponentRecord(signal,key){
  for(const root of marketAiSignalRoots(signal)){
    const direct=marketAiObject(root[key]);
    if(direct)return direct;
    for(const bucketName of ['component_details','components','inputs','market_components']){
      const bucket=marketAiObject(root[bucketName]);
      const item=marketAiObject(bucket?.[key]);
      if(item)return item;
    }
  }
  return null;
}

function marketAiComponentLabel(key){
  if(MARKET_AI_COMPONENT_LABELS[key])return MARKET_AI_COMPONENT_LABELS[key];
  return String(key||'')
    .replace(/^market_/,'')
    .replace(/_/g,' ')
    .replace(/\b\w/g,char=>char.toUpperCase());
}

function marketAiWeightText(value){
  const n=Number(value);
  if(!Number.isFinite(n))return '';
  const pct=Math.abs(n)<=1.000001?n*100:n;
  return `${pct.toFixed(Math.abs(pct)>=10?0:1)}%`;
}

function marketAiSignalState(signal,metric){
  if(!metric?.stateKey)return null;
  const state=signal?.details?.signal_state?.[metric.stateKey];
  return marketAiObject(state);
}

function marketAiSignalStateLabel(state){
  return {
    live_preopen:'장전 실시간 예측',
    next_session_preopen:'다음 장 예측',
    locked_preopen:'장전 확정',
    preopen_forecast:'장전 예측',
    intraday_forecast:'장중 예측',
    post_close_pending:'종가 확정 대기',
    actual_close:'장 마감 확정'
  }[state?.mode]||'';
}

function marketAiSessionDateText(value){
  if(!value)return '';
  const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)return String(value);
  return `${Number(match[2])}/${Number(match[3])}`;
}

function marketAiSignalBasis(signal,metric){
  const state=marketAiSignalState(signal,metric);
  if(Array.isArray(state?.basis)&&state.basis.length){
    return state.basis
      .map(item=>{
        const key=String(item?.key||'');
        const effectiveWeight=Number(item?.effective_weight??item?.effectiveWeight);
        const configuredWeight=Number(item?.configured_weight??item?.configuredWeight??item?.weight);
        const usesEffectiveWeight=Number.isFinite(effectiveWeight);
        const weight=usesEffectiveWeight?effectiveWeight:configuredWeight;
        const quality=item?.quality==null?NaN:Number(item.quality);
        return {
          key,
          label:marketAiComponentLabel(key),
          weight:Number.isFinite(weight)?weight:null,
          effective:usesEffectiveWeight,
          quality:Number.isFinite(quality)?quality:null
        };
      })
      .filter(item=>item.key&&(item.weight!=null||item.quality!=null))
      .sort((a,b)=>Math.abs(Number(b.weight)||0)-Math.abs(Number(a.weight)||0));
  }
  const targets=metric.detailKeys||[];
  const effective=marketAiTargetBucket(signal,['effective_weights','effectiveWeights','effective_weight'],targets);
  const weights=marketAiTargetBucket(signal,['weights','base_weights','raw_weights'],targets);
  const components=marketAiTargetBucket(signal,['components','component_details','inputs'],targets);
  const qualityBucket=marketAiGlobalBucket(signal,['qualities','quality']);
  const weightSource=effective||weights;
  const entries=[];
  const usesEffectiveWeights=!!effective;

  if(weightSource){
    Object.entries(weightSource).forEach(([key,value])=>{
      const inline=marketAiObject(value);
      const n=Number(inline?.effective_weight??inline?.effectiveWeight??inline?.weight??value);
      if(!Number.isFinite(n)||Math.abs(n)<1e-9)return;
      const record=marketAiComponentRecord(signal,key);
      if(inline?.available===false||record?.available===false)return;
      const quality=Number(inline?.quality??record?.quality??qualityBucket?.[key]);
      entries.push({
        key,
        label:marketAiComponentLabel(key),
        weight:n,
        effective:usesEffectiveWeights||inline?.effective_weight!=null||inline?.effectiveWeight!=null,
        quality:Number.isFinite(quality)?quality:null
      });
    });
  }else if(components){
    Object.entries(components).forEach(([key,value])=>{
      const record=marketAiObject(value);
      if(record?.available===false)return;
      const weight=Number(record?.effective_weight??record?.effectiveWeight??record?.weight);
      const quality=Number(record?.quality);
      entries.push({
        key,
        label:marketAiComponentLabel(key),
        weight:Number.isFinite(weight)?weight:null,
        effective:record?.effective_weight!=null||record?.effectiveWeight!=null,
        quality:Number.isFinite(quality)?quality:null
      });
    });
  }

  return entries
    .filter(item=>item.weight!=null||item.quality!=null)
    .sort((a,b)=>Math.abs(Number(b.weight)||0)-Math.abs(Number(a.weight)||0));
}

// [MARKET07] Tooltip Content / Interaction · 시장·신호 설명 / desktop interaction
function marketAiMarketTooltipHtml(key){
  const futuresState=marketAiKisFuturesState();
  const soxState=marketAiSoxDisplayState();
  const config={
    'kospi-index':{label:'KOSPI',row:marketAiSnapshotRow('INDEX:KOSPI'),price:item=>marketAiIndexText(item?.price),source:MARKET_AI_PREVIEW_MODE?'내장 예시 데이터':'Yahoo KOSPI 현물지수'},
    'sox-index':soxState,
    'nasdaq100-futures':{label:'NASDAQ100 선물',row:marketAiSnapshotRow(MARKET_AI_NASDAQ100_FUTURES_SYMBOL),price:item=>marketAiPriceText(item?.price,2),source:MARKET_AI_PREVIEW_MODE?'내장 예시 데이터':'Yahoo Nasdaq-100 선물 (NQ=F)'},
    'kospi200-futures':{label:'KOSPI200 선물',row:futuresState.row,price:item=>marketAiPriceText(item?.price,2),source:MARKET_AI_PREVIEW_MODE?'내장 예시 데이터':'KIS eFriend 실제 선물',state:futuresState}
  }[key];
  if(!config)return '';
  const row=config.row;
  const change=marketAiChangeText(row?.change_pct)||'--';
  const changeClass=marketAiDirectionClass(row?.change_pct)==='positive'?'tt-pos':(marketAiDirectionClass(row?.change_pct)==='negative'?'tt-neg':'');
  const parts=[`<div class="tt-date">${marketAiEscape(config.label)}</div>`];

  if(row){
    parts.push(marketAiTooltipRow('현재가',config.price(row)));
    parts.push(marketAiTooltipRow('등락률',change,changeClass));
  }else{
    parts.push(marketAiTooltipRow('현재가','--'));
    parts.push(marketAiTooltipRow('등락률','--'));
  }

  if(config.state){
    const stateLabel=MARKET_AI_PREVIEW_MODE?'예시 데이터':({fresh:'거래 데이터 정상',closed:'장 종료 · 마지막 정상값',stale:'장중 데이터 지연',bridge:'Bridge 연결 지연',source:'실제 선물 소스 없음',missing:'데이터 없음'}[config.state.reason]||'상태 확인');
    parts.push(marketAiTooltipRow('상태',stateLabel));
    const sessionLabel={day:'주간',night:'야간',closed:'장외'}[config.state.bridgeStatus?.expected_session];
    if(sessionLabel)parts.push(marketAiTooltipRow('세션',sessionLabel));
  }
  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipRow('데이터',config.source));
  const observed=marketAiKstTime((row||config.state?.rawRow)?.observed_at);
  parts.push(marketAiTooltipRow(config.state?.reason==='closed'?'마지막 수신':'갱신',observed?`${observed} KST`:'--'));
  return parts.join('');
}

function marketAiSignalMetric(key){
  return MARKET_AI_SIGNAL_METRICS.find(metric=>metric.key===key)||null;
}

function marketAiSignalTooltipHtml(key){
  const signal=marketAiState.signal;
  const metric=marketAiSignalMetric(key);
  if(!signal||!metric)return '';
  const state=marketAiSignalState(signal,metric);
  const calibration=signal.calibration||{};
  const calibratedTargets=new Set(Array.isArray(calibration.available_targets)?calibration.available_targets:[]);
  const probability=Number(calibration.probabilities?.[metric.target]);
  const calibrated=calibratedTargets.has(metric.target)&&Number.isFinite(probability);
  const rawScore=Number(signal[metric.scoreField]);
  const stateLabel=marketAiSignalStateLabel(state);

  if(state?.mode==='actual_close'){
    const actualLabel=String(state.actual_label||'확정');
    const change=Number(state.actual_change_pct);
    const changeText=Number.isFinite(change)?`${change>0?'+':''}${change.toFixed(2)}%`:'--';
    const className=change>0?'tt-pos':(change<0?'tt-neg':'');
    const parts=[`<div class="tt-date">${marketAiEscape(`상승마감 · ${actualLabel} 확정`)}</div>`];
    parts.push(marketAiTooltipRow('결과',`${actualLabel} 마감`,className));
    parts.push(marketAiTooltipRow('KOSPI 등락률',changeText,className));
    if(state.target_session_date)parts.push(marketAiTooltipRow('대상 장',marketAiSessionDateText(state.target_session_date)));
    const actualAt=marketAiKstTime(state.actual_at);
    parts.push(marketAiTooltipRow('상태',stateLabel||'장 마감 확정'));
    if(actualAt)parts.push(marketAiTooltipRow('확정 시각',`${actualAt} KST`));
    parts.push(marketAiTooltipDivider());
    parts.push(marketAiTooltipRow('산출 방식','실제 KOSPI 종가 결과'));
    parts.push(marketAiTooltipRow('신뢰도','확정값'));
    return parts.join('');
  }

  if(state&&state.available===false){
    const parts=[`<div class="tt-date">${marketAiEscape(`${metric.fullSignalLabel} · --`)}</div>`];
    parts.push(marketAiTooltipRow('상태',stateLabel||'신호 없음'));
    if(state.target_session_date)parts.push(marketAiTooltipRow('대상 장',marketAiSessionDateText(state.target_session_date)));
    parts.push(marketAiTooltipDivider());
    parts.push(marketAiTooltipNote(state.note||'현재 시점에 유효한 신호가 없습니다.'));
    const updated=marketAiKstTime(signal.updated_at);
    parts.push(marketAiTooltipDivider());
    parts.push(marketAiTooltipRow('갱신',updated?`${updated} KST`:'--'));
    return parts.join('');
  }

  const displayValue=calibrated?probability*100:rawScore;
  const displayText=calibrated?marketAiProbabilityText(probability):marketAiScoreText(rawScore);
  const band=marketAiScoreBand(displayValue);
  const sampleCount=Number(calibration.models?.[metric.target]?.sample_count);
  const fullLabel=calibrated?metric.fullProbabilityLabel:metric.fullSignalLabel;
  const parts=[`<div class="tt-date">${marketAiEscape(`${fullLabel} ${displayText} · ${band.label}`)}</div>`];
  parts.push(marketAiTooltipRow('판단',band.label,band.className));
  if(stateLabel)parts.push(marketAiTooltipRow('상태',stateLabel));
  if(state?.target_session_date)parts.push(marketAiTooltipRow('대상 장',marketAiSessionDateText(state.target_session_date)));
  const forecastAt=marketAiKstTime(state?.forecast_at);
  if(forecastAt)parts.push(marketAiTooltipRow(state?.mode==='locked_preopen'?'장전 기준':'기준 시각',`${forecastAt} KST`));
  parts.push(marketAiTooltipRow('산출 방식',calibrated?'통계 보정 상승확률':'룰 기반 100점 점수'));
  if(calibrated&&Number.isFinite(rawScore))parts.push(marketAiTooltipRow('원신호',`${rawScore.toFixed(1)}점`));
  if(calibrated&&Number.isFinite(sampleCount))parts.push(marketAiTooltipRow('보정 표본',`n=${sampleCount}`));
  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipSection(calibrated?'확률 구간':'점수 구간'));
  parts.push(marketAiScoreRangeHtml(calibrated));

  const basis=marketAiSignalBasis(signal,metric);
  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipSection('주요 판단 근거'));
  if(basis.length){
    basis.forEach(item=>{
      let meta='사용';
      if(item.weight!=null)meta=`${item.effective?'유효가중치':'가중치'} ${marketAiWeightText(item.weight)}`;
      if(item.quality!=null&&item.quality<0.999)meta+=` · 품질 ${Math.round(item.quality*100)}%`;
      parts.push(marketAiTooltipRow(item.label,meta));
    });
  }else{
    parts.push(marketAiTooltipNote('세부 구성정보가 응답에 없어 엔진 입력 항목을 표시할 수 없습니다.'));
  }

  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipRow('신뢰도',marketAiPercentText(signal.confidence)));
  parts.push(marketAiTooltipRow('데이터 완성도',marketAiPercentText(signal.data_completeness)));
  const updated=marketAiKstTime(signal.updated_at);
  parts.push(marketAiTooltipRow('갱신',updated?`${updated} KST`:'--'));
  return parts.join('');
}

function marketAiTooltipHtml(target){
  const type=target.dataset.marketAiTooltip;
  const key=target.dataset.marketAiKey||'';
  return type==='market'?marketAiMarketTooltipHtml(key):(type==='signal'?marketAiSignalTooltipHtml(key):'');
}

function showMarketAiTooltip(target,event){
  if(marketAiPhoneUi())return;
  const html=marketAiTooltipHtml(target);
  if(!html)return;
  const tooltip=marketAiTooltip();
  tooltip.innerHTML=html;
  tooltip.setAttribute('aria-hidden','false');
  positionMarketAiTooltip(target,event);
}

function setupMarketAiTooltipEvents(){
  if(marketAiTooltipEventsBound)return;
  marketAiTooltipEventsBound=true;
  const targetFromEvent=event=>marketAiPhoneUi()?null:(event.target.closest?.('#market-ai-section [data-market-ai-tooltip]')||null);
  document.addEventListener('pointerover',event=>{
    const target=targetFromEvent(event);
    if(!target||target.contains(event.relatedTarget))return;
    showMarketAiTooltip(target,event);
  });
  document.addEventListener('pointermove',event=>{
    const target=targetFromEvent(event);
    if(target&&document.getElementById(MARKET_AI_TOOLTIP_ID)?.classList.contains('visible'))positionMarketAiTooltip(target,event);
  });
  document.addEventListener('pointerout',event=>{
    const target=targetFromEvent(event);
    if(target&&!target.contains(event.relatedTarget))hideMarketAiTooltip();
  });
  document.addEventListener('focusin',event=>{
    const target=targetFromEvent(event);
    if(target)showMarketAiTooltip(target,null);
  });
  document.addEventListener('focusout',event=>{
    const target=targetFromEvent(event);
    if(target&&!target.contains(event.relatedTarget))hideMarketAiTooltip();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideMarketAiTooltip();});
  window.addEventListener('scroll',hideMarketAiTooltip,{passive:true,capture:true});
  window.addEventListener('resize',hideMarketAiTooltip,{passive:true});
  window.visualViewport?.addEventListener('scroll',hideMarketAiTooltip,{passive:true});
  window.visualViewport?.addEventListener('resize',hideMarketAiTooltip,{passive:true});
}

// [MARKET08] Metric Markup / Responsive Mobile UI · panel metric / trigger / dialog
function marketAiDesktopSignalMetric(label,key){
  return `<span class="market-ai-desktop-metric" tabindex="0" aria-describedby="${MARKET_AI_TOOLTIP_ID}" data-market-ai-card="${key}" data-market-ai-tooltip="signal" data-market-ai-key="${key}"><span class="data-list-card-label market-ai-desktop-label">${label}</span><strong class="data-list-card-value market-ai-desktop-signal" data-market-ai-score="${key}">--</strong></span>`;
}

function marketAiDesktopMarketMetric(label,marketKey){
  return `<span class="market-ai-desktop-metric" tabindex="0" aria-describedby="${MARKET_AI_TOOLTIP_ID}" data-market-ai-market-card="${marketKey}" data-market-ai-tooltip="market" data-market-ai-key="${marketKey}"><span class="data-list-card-label market-ai-desktop-label">${label}</span><strong class="data-list-card-value market-ai-desktop-value" data-market-ai-market="${marketKey}">--</strong><strong class="data-list-card-value market-ai-desktop-change" data-market-ai-change="${marketKey}"></strong></span>`;
}

function marketAiDesktopFuturesMetric(){
  return marketAiDesktopMarketMetric('K200선물','kospi200-futures');
}

function marketAiDesktopGroupLabel(label){
  return `<span class="data-list-card-title market-ai-desktop-group-label">${label}</span>`;
}

function syncMarketAiMetricInteractivity(row,phoneUi){
  row?.querySelectorAll('[data-market-ai-tooltip],[data-market-ai-tooltip-type]').forEach(metric=>{
    const tooltipType=metric.dataset.marketAiTooltip||metric.dataset.marketAiTooltipType||'';
    if(phoneUi){
      if(tooltipType)metric.dataset.marketAiTooltipType=tooltipType;
      metric.removeAttribute('data-market-ai-tooltip');
      metric.removeAttribute('tabindex');
      metric.removeAttribute('aria-describedby');
      return;
    }
    if(tooltipType)metric.dataset.marketAiTooltip=tooltipType;
    metric.removeAttribute('data-market-ai-tooltip-type');
    metric.setAttribute('tabindex','0');
    metric.setAttribute('aria-describedby',MARKET_AI_TOOLTIP_ID);
  });
  row?.querySelector('.market-ai-title')?.classList.toggle('modal-main-title',phoneUi);
  if(phoneUi){
    hideMarketAiTooltip();
    document.getElementById(MARKET_AI_TOOLTIP_ID)?.remove();
  }else{
    marketAiTooltip();
  }
}

function marketAiMobileTrigger(hero){
  const titleRow=hero?.querySelector('.hero-title-row');
  if(!titleRow)return null;
  let trigger=document.getElementById(MARKET_AI_MOBILE_TRIGGER_ID);
  if(!trigger){
    trigger=document.createElement('button');
    trigger.id=MARKET_AI_MOBILE_TRIGGER_ID;
    trigger.type='button';
    trigger.className='control-action-button compact market-ai-mobile-trigger';
    trigger.textContent='AI Signal';
    trigger.setAttribute('aria-label','AI Market Signal 열기');
    trigger.setAttribute('aria-haspopup','dialog');
    trigger.setAttribute('aria-controls',MARKET_AI_MOBILE_DIALOG_ID);
    trigger.setAttribute('aria-expanded','false');
    trigger.addEventListener('click',openMarketAiMobileDialog);
  }
  if(trigger.parentElement!==titleRow)titleRow.appendChild(trigger);
  return trigger;
}

function marketAiMobileDialog(){
  let dialog=document.getElementById(MARKET_AI_MOBILE_DIALOG_ID);
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id=MARKET_AI_MOBILE_DIALOG_ID;
  dialog.className='market-ai-mobile-dialog';
  dialog.tabIndex=-1;
  dialog.setAttribute('aria-labelledby','marketAiTitle');
  dialog.innerHTML=`<div class="action-modal-card market-ai-mobile-dialog-card"><button type="button" class="control-icon-button modal-icon-btn market-ai-mobile-close" aria-label="AI Market Signal 닫기">${MARKET_AI_CLOSE_ICON}</button><div class="market-ai-mobile-dialog-content" data-market-ai-mobile-content></div></div>`;
  const closeDialog=()=>closeDashboardNativeDialog(dialog,{fallbackSelector:`#${MARKET_AI_MOBILE_TRIGGER_ID}`});
  dialog.querySelector('.market-ai-mobile-close')?.addEventListener('click',closeDialog);
  bindDashboardNativeDialogDismiss(dialog,{onDismiss:closeDialog});
  dialog.addEventListener('close',()=>{
    document.body.classList.remove('market-ai-mobile-dialog-open');
    hideMarketAiTooltip();
    document.getElementById(MARKET_AI_MOBILE_TRIGGER_ID)?.setAttribute('aria-expanded','false');
  });
  document.body.appendChild(dialog);
  return dialog;
}

function openMarketAiMobileDialog(){
  if(!marketAiPhoneUi()||!marketAiUiEnabled())return;
  const row=mountMarketAiSection();
  if(!row)return;
  const dialog=marketAiMobileDialog();
  const trigger=document.getElementById(MARKET_AI_MOBILE_TRIGGER_ID);
  openDashboardNativeDialog(dialog,{initialFocus:dialog,returnFocus:trigger,fallbackSelector:`#${MARKET_AI_MOBILE_TRIGGER_ID}`});
  document.body.classList.add('market-ai-mobile-dialog-open');
  trigger?.setAttribute('aria-expanded','true');
}

function syncMarketAiResponsiveMount(row,hero){
  if(marketAiPhoneUi()){
    const dialog=marketAiMobileDialog();
    const content=dialog.querySelector('[data-market-ai-mobile-content]');
    if(content&&row.parentElement!==content)content.appendChild(row);
    hero.classList.remove('market-ai-mounted');
    marketAiMobileTrigger(hero);
    syncMarketAiMetricInteractivity(row,true);
    row.dataset.marketAiPlacement='mobile';
    return;
  }

  syncMarketAiMetricInteractivity(row,false);
  document.getElementById(MARKET_AI_MOBILE_TRIGGER_ID)?.remove();
  const dialog=document.getElementById(MARKET_AI_MOBILE_DIALOG_ID);
  if(dialog?.open)closeDashboardNativeDialog(dialog,{fallbackSelector:`#${MARKET_AI_MOBILE_TRIGGER_ID}`});
  if(row.parentElement!==hero)hero.appendChild(row);
  hero.classList.add('market-ai-mounted');
  row.dataset.marketAiPlacement='hero';
}

// [MARKET09] Mount / Render · 하나의 canonical panel을 Hero ↔ Mobile dialog 사이에서 재사용
function createMarketAiSection(){
  const row=document.createElement('aside');
  row.id='market-ai-section';
  row.setAttribute('role','group');
  row.setAttribute('aria-labelledby','marketAiTitle');
  row.innerHTML=`<div class="market-ai-panel"><div class="market-ai-heading"><span id="marketAiTitle" class="market-ai-title">AI Market Signal</span><span class="market-ai-status" data-market-ai-status role="status" aria-live="polite">연결 확인 중</span></div><div class="market-ai-desktop" data-market-ai-content aria-label="현재 시장과 AI 신호"><div class="data-list-card market-ai-card-row market-ai-market-row">${marketAiDesktopGroupLabel('시장')}${marketAiDesktopMarketMetric('KOSPI','kospi-index')}${marketAiDesktopFuturesMetric()}${marketAiDesktopMarketMetric('SOX','sox-index')}${marketAiDesktopMarketMetric('NQ100선물','nasdaq100-futures')}</div><div class="data-list-card market-ai-card-row market-ai-signal-row">${marketAiDesktopGroupLabel('AI 신호')}${marketAiDesktopSignalMetric('코스피','kospi')}${marketAiDesktopSignalMetric('반도체','semiconductors')}${marketAiDesktopSignalMetric('갭상','gap')}${marketAiDesktopSignalMetric('상승마감','up-close')}</div></div></div>`;
  return row;
}

function mountMarketAiSection(){
  if(!marketAiUiEnabled())return null;
  const hero=document.querySelector('#app > .wrap > .hero');
  if(!hero)return null;
  let row=document.getElementById('market-ai-section');
  if(!row)row=createMarketAiSection();
  syncMarketAiResponsiveMount(row,hero);
  return row;
}

function removeMarketAiUi(){
  hideMarketAiTooltip();
  const row=document.getElementById('market-ai-section');
  const hero=document.querySelector('#app > .wrap > .hero');
  const dialog=document.getElementById(MARKET_AI_MOBILE_DIALOG_ID);
  if(dialog?.open)closeDashboardNativeDialog(dialog,{fallbackSelector:`#${MARKET_AI_MOBILE_TRIGGER_ID}`});
  document.body.classList.remove('market-ai-mobile-dialog-open');
  row?.remove();
  dialog?.remove();
  document.getElementById(MARKET_AI_MOBILE_TRIGGER_ID)?.remove();
  hero?.classList.remove('market-ai-mounted');
  document.querySelectorAll('[data-section-target="market-ai-section"]').forEach(item=>item.remove());
}

function syncMarketAiMarketView(row){
  const futuresState=marketAiKisFuturesState();
  const soxState=marketAiSoxDisplayState();
  const marketItems=[
    {key:'kospi-index',marketRow:marketAiSnapshotRow('INDEX:KOSPI'),valueText:item=>marketAiIndexText(item?.price)},
    {key:'kospi200-futures',marketRow:futuresState.row,valueText:item=>marketAiPriceText(item?.price,2)},
    {key:'sox-index',label:soxState.label,marketRow:soxState.row,valueText:soxState.price},
    {key:'nasdaq100-futures',marketRow:marketAiSnapshotRow(MARKET_AI_NASDAQ100_FUTURES_SYMBOL),valueText:item=>marketAiPriceText(item?.price,2)}
  ];

  marketItems.forEach(item=>{
    const values=[...row.querySelectorAll(`[data-market-ai-market="${item.key}"]`)];
    const changes=[...row.querySelectorAll(`[data-market-ai-change="${item.key}"]`)];
    if(!values.length)return;
    const directionClass=marketAiDirectionClass(item.marketRow?.change_pct);
    values.forEach(value=>{
      value.textContent=item.valueText(item.marketRow);
      value.classList.remove('positive','negative');
      if(directionClass)value.classList.add(directionClass);
    });
    changes.forEach(change=>{
      change.textContent=marketAiChangeText(item.marketRow?.change_pct);
      change.classList.remove('positive','negative');
      if(directionClass)change.classList.add(directionClass);
    });
    const card=row.querySelector(`[data-market-ai-market-card="${item.key}"]`);
    if(card){
      const unavailable=!item.marketRow;
      card.classList.toggle('is-unavailable',unavailable);
      const labelNode=card.querySelector('.market-ai-desktop-label');
      if(item.label&&labelNode)labelNode.textContent=item.label;
      const label=labelNode?.textContent?.trim()||item.key;
      const valueText=item.valueText(item.marketRow);
      const changeText=marketAiChangeText(item.marketRow?.change_pct)||'등락률 없음';
      card.setAttribute('aria-label',`${label} ${valueText} · ${changeText}`);
    }
  });
}

function syncMarketAiSignalView(){
  if(!marketAiUiEnabled()){
    removeMarketAiUi();
    return;
  }
  const row=mountMarketAiSection();
  if(!row)return;
  const signal=marketAiState.signal;
  const calibration=signal?.calibration||{};
  const calibratedTargets=new Set(Array.isArray(calibration.available_targets)?calibration.available_targets:[]);
  const probabilities=calibration.probabilities||{};
  const metrics=MARKET_AI_SIGNAL_METRICS.map(metric=>({...metric,score:signal?.[metric.scoreField]}));

  const status=row.querySelector('[data-market-ai-status]');
  const hasMarketData=Object.keys(marketAiState.marketSnapshot||{}).length>0;
  row.querySelectorAll('[data-market-ai-content]').forEach(content=>{content.hidden=!signal&&!hasMarketData;});
  if(status){
    status.hidden=!!signal&&!MARKET_AI_PREVIEW_MODE;
    status.dataset.marketAiState=MARKET_AI_PREVIEW_MODE?'preview':(marketAiState.statusKind||'checking');
    if(MARKET_AI_PREVIEW_MODE){
      status.textContent='예시 데이터';
      status.setAttribute('aria-label','Market AI 비로컬 미리보기용 예시 데이터');
    }
  }

  syncMarketAiMarketView(row);

  metrics.forEach(metric=>{
    const items=[...row.querySelectorAll(`[data-market-ai-card="${metric.key}"]`)];
    const values=[...row.querySelectorAll(`[data-market-ai-score="${metric.key}"]`)];
    if(!values.length)return;
    const state=marketAiSignalState(signal,metric);
    const probability=Number(probabilities[metric.target]);
    const calibrated=calibratedTargets.has(metric.target)&&Number.isFinite(probability);
    const actualClose=state?.mode==='actual_close';
    const rawScore=Number(metric.score);
    const unavailable=!signal||state?.available===false||(!actualClose&&!calibrated&&!Number.isFinite(rawScore));
    let displayValue=calibrated?probability*100:metric.score;
    let valueText=calibrated?marketAiProbabilityText(probability):marketAiScoreText(metric.score);
    let stateText='';
    if(actualClose){
      stateText=String(state.actual_label||'확정');
      valueText=stateText;
      const change=Number(state.actual_change_pct);
      displayValue=Number.isFinite(change)?(change>0?100:(change<0?0:50)):50;
    }else if(unavailable){
      valueText='--';
      displayValue=null;
      stateText=marketAiSignalStateLabel(state)||'신호 없음';
    }
    const valueClass=marketAiScoreClass(displayValue);
    values.forEach(value=>{
      value.textContent=valueText;
      value.classList.remove('positive','negative');
      if(valueClass)value.classList.add(valueClass);
    });
    const fullLabel=calibrated?metric.fullProbabilityLabel:metric.fullSignalLabel;
    const band=marketAiScoreBand(displayValue);
    items.forEach(item=>{
      item.removeAttribute('title');
      item.classList.toggle('is-unavailable',unavailable);
      const suffix=actualClose?`${stateText} 확정`:(unavailable?(stateText||'신호 없음'):band.label);
      item.setAttribute('aria-label',`${fullLabel} ${valueText} · ${suffix}`);
    });
  });

  if(!signal){
    if(status){
      status.textContent=marketAiState.status||'연결 확인 중';
      const lastSignal=marketAiKstTime(marketAiState.lastSignalAt);
      const message=marketAiState.message||'Market AI 신호를 확인하고 있습니다.';
      status.removeAttribute('title');
      status.setAttribute('aria-label',lastSignal?`${message} · 마지막 신호 ${lastSignal} KST`:message);
    }
    row.setAttribute('aria-label',`AI Market Signal · ${marketAiState.status||'연결 확인 중'}`);
    return;
  }

  const updated=marketAiKstTime(signal.updated_at);
  const meta=[
    ...(MARKET_AI_PREVIEW_MODE?['예시 데이터']:[]),
    '현재 시장',
    `신뢰도 ${marketAiPercentText(signal.confidence)}`,
    `데이터 완성도 ${marketAiPercentText(signal.data_completeness)}`,
    calibratedTargets.size?`확률 보정 ${calibratedTargets.size}/4`:'비보정 룰 기반 신호'
  ];
  if(updated)meta.push(`${updated} KST`);
  const metaText=meta.join(' · ');
  row.removeAttribute('title');
  row.setAttribute('aria-label',`AI Market Signal · ${metaText}`);
}

// [MARKET10] State Update / Data Refresh · snapshot / bridge / signal refresh
function setMarketAiState(next){
  Object.assign(marketAiState,next);
  syncMarketAiSignalView();
}

async function refreshMarketAiSignalResponse(apiBase){
  try{
    return await fetchWithTimeout(`${apiBase}/api/signal/latest?include_details=true`,{
      method:'GET',
      headers:{Accept:'application/json'},
      cache:'no-store'
    });
  }catch(_){
    return null;
  }
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


async function refreshMarketAiBridgeStatus(apiBase){
  try{
    const response=await fetchWithTimeout(`${apiBase}/api/bridge/kis-efriend/status`,{
      method:'GET',
      headers:{Accept:'application/json'},
      cache:'no-store'
    });
    if(!response.ok)return null;
    const payload=await response.json();
    return marketAiObject(payload);
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
    setMarketAiState({status:'연결 확인 중',statusKind:'checking',message:'Market AI 서버에 연결하고 있습니다.'});
  }

  const previousSignalAt=marketAiState.signal?.updated_at||marketAiState.lastSignalAt||null;
  const [response,nextMarketSnapshot,nextBridgeStatus]=await Promise.all([
    refreshMarketAiSignalResponse(apiBase),
    refreshMarketAiMarketSnapshot(apiBase),
    refreshMarketAiBridgeStatus(apiBase)
  ]);
  const serverReachable=response!==null||nextMarketSnapshot!==null||nextBridgeStatus!==null;
  Object.assign(marketAiState,{
    marketSnapshot:nextMarketSnapshot??{},
    bridgeStatus:nextBridgeStatus
  });

  if(!serverReachable){
    setMarketAiState({
      signal:null,
      status:'서버 연결 안 됨',
      statusKind:'error',
      message:'Local Suite 실행 후 자동으로 다시 연결합니다.',
      lastSignalAt:null
    });
    return;
  }

  if(!response){
    setMarketAiState({
      signal:null,
      status:'신호 오류',
      statusKind:'signal-error',
      message:'시장 데이터는 연결되었지만 AI 신호 응답을 확인할 수 없습니다.',
      lastSignalAt:previousSignalAt
    });
    return;
  }

  if(response.status===404){
    setMarketAiState({
      signal:null,
      status:'신호 대기',
      statusKind:'waiting',
      message:'Market AI가 첫 신호를 생성하면 자동으로 표시됩니다.',
      lastSignalAt:null
    });
    return;
  }

  if(!response.ok){
    setMarketAiState({
      signal:null,
      status:'신호 오류',
      statusKind:'signal-error',
      message:`Market AI 신호 API 응답 오류 (${response.status})`,
      lastSignalAt:previousSignalAt
    });
    return;
  }

  let signal=null;
  try{
    signal=await response.json();
  }catch(_){
    setMarketAiState({
      signal:null,
      status:'신호 오류',
      statusKind:'signal-error',
      message:'Market AI 신호 응답 형식을 확인할 수 없습니다.',
      lastSignalAt:previousSignalAt
    });
    return;
  }

  const freshness=marketAiSignalFreshness(signal);
  if(!freshness.fresh){
    setMarketAiState({
      signal:null,
      status:'신호 지연',
      statusKind:'stale',
      message:freshness.updatedAt
        ?'Market AI 신호가 5분 이상 갱신되지 않았습니다.'
        :'Market AI 신호의 갱신 시각을 확인할 수 없습니다.',
      lastSignalAt:freshness.updatedAt
    });
    return;
  }
  setMarketAiState({signal,status:'연결됨',statusKind:'connected',message:'',lastSignalAt:null});
}

// [MARKET11] Lifecycle / Polling · render 교체 감시 / polling boot
function scheduleMount(){
  if(mountFrame)return;
  mountFrame=requestAnimationFrame(()=>{
    mountFrame=0;
    syncMarketAiSignalView();
  });
}

function startMarketAiBridge(){
  setupMarketAiTooltipEvents();
  if(typeof marketAiPhoneMedia.addEventListener==='function')marketAiPhoneMedia.addEventListener('change',scheduleMount);
  else marketAiPhoneMedia.addListener?.(scheduleMount);
  if(!marketAiUiEnabled()){
    removeMarketAiUi();
    return;
  }
  const app=document.getElementById('app');
  if(app)new MutationObserver(scheduleMount).observe(app,{childList:true,subtree:false});
  if(MARKET_AI_PREVIEW_MODE){
    Object.assign(marketAiState,marketAiPreviewState());
    scheduleMount();
    return;
  }
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
