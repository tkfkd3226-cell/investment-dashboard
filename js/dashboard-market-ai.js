import {
  MARKET_AI_CONNECTION_EVENT,
  MARKET_AI_ENABLED_EVENT,
  marketAiApiBase,
  marketAiEnabled,
  marketAiFetchWithTimeout as fetchWithTimeout,
  publishMarketAiKospiSnapshot
} from './dashboard-market-ai-client.js';

// Market AI Standalone Adapter · main feature graph와 분리된 독립 entry
// Ownership: dashboard-market-ai-client.js의 endpoint/timeout transport만 공유하고, mount/state/polling/render/tooltip은 이 파일이 소유한다.
// Responsive contract: Desktop/Tablet은 Hero 우측 panel, Phone은 동일 panel을 Hero 바로 아래 inline slot로 이동 재사용하며 metric tap으로 동일 Tooltip을 연다.
// View-mode contract: ?dashboard-view=web/tablet/mobile은 레이아웃만 선택하며 Market AI는 항상 실제 데이터를 사용한다.
// Structure map:
//   [MARKET01] Configuration / Runtime State
//   [MARKET02] Environment / Fetch
//   [MARKET03] Formatting / Time / Freshness
//   [MARKET04] Snapshot / Session State
//   [MARKET05] Tooltip Core
//   [MARKET06] Signal Detail Normalization
//   [MARKET07] Tooltip Content / Interaction
//   [MARKET08] Metric Markup / Responsive Phone UI
//   [MARKET09] Mount / Render
//   [MARKET10] State Update / Data Refresh
//   [MARKET11] Lifecycle / Polling

// [MARKET01] Configuration / Runtime State · endpoint / metric contract

const MARKET_AI_POLL_MS=5_000;
const MARKET_AI_OFFLINE_FAILURE_LIMIT=2;
const MARKET_AI_STALE_MS=5*60_000;
const MARKET_AI_KIS_FUTURES_SYMBOL='FUTURES:KOSPI200';
const MARKET_AI_SOX_INDEX_SYMBOL='INDEX:SOX';
const MARKET_AI_NASDAQ100_FUTURES_SYMBOL='FUTURES:NQ';
const MARKET_AI_TOOLTIP_ID='marketAiTooltip';
const MARKET_AI_PHONE_INLINE_SLOT_ID='marketAiPhoneInlineSlot';
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
const MARKET_AI_INPUT_STATUS_LABELS={
  realtime:'실시간',within_delay:'허용 지연 범위',closed_latest:'최근 마감값',awaiting_session:'새 세션 수신 대기',
  closing_pending:'마감 데이터 수신 대기',stale:'현재 세션 입력 지연',missing_close:'최근 마감 데이터 없음',
  calendar_unknown:'거래 세션 확인 불가',invalid_time:'관측 시각 오류',missing:'데이터 또는 등락률 없음',invalid_value:'값 오류'
};

const marketAiState={
  signal:null,
  marketSnapshot:{},
  bridgeStatus:null,
  serverReachable:false,
  lifecycle:'off',
  status:'연결 확인 중',
  statusKind:'checking',
  message:'선택일과 무관한 현재 Market AI 신호를 확인하고 있습니다.',
  lastSignalAt:null
};

let marketAiPollTimer=0;
let mountFrame=0;
let marketAiTooltipEventsBound=false;
let marketAiActiveTooltipTarget=null;
let marketAiPublishedConnectionState=null;
let marketAiLifecycleGeneration=0;
let marketAiRefreshInFlight=null;
let marketAiConsecutiveUnavailableRefreshes=0;
let marketAiHeroResizeObserver=null;
let marketAiHeroObservedRow=null;

function publishMarketAiConnectionState(connected,{force=false}={}){
  const next=connected===true;
  if(!force&&marketAiPublishedConnectionState===next)return;
  marketAiPublishedConnectionState=next;
  document.documentElement.dataset.marketAiConnected=next?'true':'false';
  window.dispatchEvent(new CustomEvent(MARKET_AI_CONNECTION_EVENT,{detail:{connected:next}}));
}

function setMarketAiLifecycleState(lifecycle,{resetData=false}={}){
  marketAiState.lifecycle=lifecycle;
  document.documentElement.dataset.marketAiLifecycle=lifecycle;
  if(lifecycle==='online')return;
  stopMarketAiPollTimer();
  marketAiConsecutiveUnavailableRefreshes=0;
  marketAiState.serverReachable=false;
  if(resetData){
    Object.assign(marketAiState,{signal:null,marketSnapshot:{},bridgeStatus:null,lastSignalAt:null});
  }
  publishMarketAiKospiSnapshot(null);
  publishMarketAiConnectionState(false);
  removeMarketAiUi();
}

function marketAiLifecycleIsCurrent(generation,refreshSequence){
  return marketAiEnabled()
    &&generation===marketAiLifecycleGeneration
    &&refreshSequence===marketAiRefreshSequence;
}

function marketAiPollingAllowed(){
  return marketAiEnabled()&&marketAiState.lifecycle==='online';
}

function stopMarketAiPollTimer(){
  if(!marketAiPollTimer)return;
  window.clearInterval(marketAiPollTimer);
  marketAiPollTimer=0;
}

function ensureMarketAiPollTimer(){
  if(marketAiPollTimer||!marketAiPollingAllowed())return;
  marketAiPollTimer=window.setInterval(()=>{
    if(document.visibilityState==='visible'&&marketAiPollingAllowed())refreshMarketAiSignal();
  },MARKET_AI_POLL_MS);
}

// [MARKET02] Environment / Fetch · 실행 환경 / timeout
function marketAiUiEnabled(){
  return marketAiEnabled()&&!!marketAiApiBase();
}

function marketAiPhoneUi(){
  return marketAiPhoneMedia.matches;
}

// Hero Reservation Width · absolute Market AI의 실제 자연 폭만큼만 title/pill 영역을 예약한다.
function syncMarketAiHeroReservedWidth(row,hero){
  if(!row||!hero||marketAiPhoneUi()||row.dataset.marketAiPlacement!=='hero')return;
  const width=Math.ceil(row.getBoundingClientRect().width);
  if(width>0)hero.style.setProperty('--market-ai-reserved-width',`${width}px`);
}

function stopMarketAiHeroWidthObserver(hero){
  marketAiHeroResizeObserver?.disconnect();
  marketAiHeroResizeObserver=null;
  marketAiHeroObservedRow=null;
  hero?.style.removeProperty('--market-ai-reserved-width');
}

function observeMarketAiHeroWidth(row,hero){
  syncMarketAiHeroReservedWidth(row,hero);
  if(typeof ResizeObserver!=='function')return;
  if(marketAiHeroResizeObserver&&marketAiHeroObservedRow===row)return;
  marketAiHeroResizeObserver?.disconnect();
  marketAiHeroObservedRow=row;
  marketAiHeroResizeObserver=new ResizeObserver(()=>syncMarketAiHeroReservedWidth(row,hero));
  marketAiHeroResizeObserver.observe(row);
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

// [MARKET04] Snapshot / Session State · 시장 snapshot / KRX·US index·futures session / KIS business_time 기준시각 판단
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

function marketAiKrxCashSessionState(date=new Date()){
  const {weekday,minuteOfDay}=marketAiKstClockParts(date);
  if(weekday<0||minuteOfDay<0)return 'unknown';
  if(weekday===0||weekday===6)return 'closed';
  if(minuteOfDay<9*60)return 'preopen';
  if(minuteOfDay<15*60+30)return 'open';
  return 'closed';
}

function marketAiSoxSessionState(date=new Date()){
  const {weekday,minuteOfDay}=marketAiClockParts('America/New_York',date);
  if(weekday<0||minuteOfDay<0)return 'unknown';
  if(weekday===0||weekday===6)return 'closed';
  if(minuteOfDay<9*60+30)return 'preopen';
  if(minuteOfDay<16*60)return 'open';
  return 'closed';
}

function marketAiNasdaq100FuturesSessionState(date=new Date()){
  const {weekday,minuteOfDay}=marketAiClockParts('America/Chicago',date);
  if(weekday<0||minuteOfDay<0)return 'unknown';
  if(weekday===6)return 'closed';
  if(weekday===0)return minuteOfDay>=17*60?'open':'closed';
  if(weekday===5)return minuteOfDay<16*60?'open':'closed';
  if(minuteOfDay>=16*60&&minuteOfDay<17*60)return 'maintenance';
  return 'open';
}

function marketAiBusinessTimeText(value){
  const text=String(value||'').trim();
  if(!/^(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(text))return '';
  return `${text.slice(0,2)}:${text.slice(2,4)}`;
}

function marketAiMarketReferenceTime(row,marketKey){
  const source=String(row?.source||'').trim();
  if((marketKey==='kospi-index'||marketKey==='kospi200-futures')&&source.startsWith('kis-efriend:')){
    const businessTime=marketAiBusinessTimeText(row?.business_time);
    if(businessTime)return businessTime;
  }
  return marketAiKstTime(row?.observed_at);
}

function marketAiMarketSourceLabel(row,marketKey){
  const source=String(row?.source||'').trim();
  if(marketKey==='kospi-index'){
    if(source.startsWith('kis-efriend:JUC_R:'))return 'KIS eFriend KOSPI 실시간';
    if(source.startsWith('yfinance:'))return 'Yahoo KOSPI 현물지수';
    return source||'KOSPI 데이터 소스 확인 필요';
  }
  if(marketKey==='kospi200-futures'){
    if(source.startsWith('kis-efriend:'))return 'KIS eFriend 실제 선물';
    if(source.startsWith('yfinance:'))return 'Yahoo KOSPI200 선물';
    return source||'KOSPI200 선물 데이터 소스 확인 필요';
  }
  return source||'데이터 소스 확인 필요';
}

function marketAiBackendInputReason(row){
  const backendStatus=String(row?.input_status?.status||'');
  return ({
    realtime:'fresh',within_delay:'fresh',closed_latest:'closed',awaiting_session:'preopen',
    closing_pending:'closing-pending',stale:'stale',missing_close:'missing-close',
    calendar_unknown:'calendar-unknown',invalid_time:'invalid-time',missing:'missing'
  })[backendStatus]||'';
}

function marketAiSnapshotDisplayState(row,sessionState='open'){
  const freshness=marketAiSnapshotFreshness(row);
  if(!row){
    return {reason:'missing',rawRow:null,observedAt:null};
  }
  const backendReason=marketAiBackendInputReason(row);
  const sessionReason=({preopen:'preopen',closed:'closed',maintenance:'maintenance'})[String(sessionState||'')];
  return {
    reason:backendReason||sessionReason||(freshness.fresh?'fresh':'stale'),
    rawRow:row,
    observedAt:freshness.observedAt
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
  const backendReason=marketAiBackendInputReason(rawRow);
  if(backendReason){
    return {row:rawRow,rawRow,reason:backendReason,observedAt:freshness.observedAt,bridgeStatus};
  }
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

// 카드와 tooltip은 같은 display model을 사용한다. 값·상태·출처·기준시각 의미를 별도 경로에서 재판정하지 않는다.
function marketAiMarketStatusLabel(reason){
  return ({
    fresh:'정상',
    closed:'장마감',
    stale:'데이터 지연',
    preopen:'장전',
    maintenance:'거래중단',
    'closing-pending':'마감 데이터 수신 대기',
    'missing-close':'최근 마감 데이터 없음',
    'calendar-unknown':'거래 세션 확인 불가',
    'invalid-time':'관측 시각 오류',
    bridge:'Bridge 지연',
    source:'선물 데이터 확인 필요',
    missing:'데이터 없음'
  })[String(reason||'')]||'상태 확인';
}

function marketAiMarketDisplayModel(key){
  const marketKey=String(key||'');
  let row=null;
  let state=null;
  let label='';
  let priceText='--';
  let sourceLabel='데이터 소스 확인 필요';
  let session='';

  if(marketKey==='kospi-index'){
    row=marketAiSnapshotRow('INDEX:KOSPI');
    state=marketAiSnapshotDisplayState(row,marketAiKrxCashSessionState());
    label='KOSPI';
    priceText=row?marketAiPriceText(row.price,2):'--';
    sourceLabel=marketAiMarketSourceLabel(row,'kospi-index');
  }else if(marketKey==='kospi200-futures'){
    state=marketAiKisFuturesState();
    row=state.row||state.rawRow||null;
    label='K200선물';
    priceText=row?marketAiPriceText(row.price,2):'--';
    sourceLabel=marketAiMarketSourceLabel(row,'kospi200-futures');
    session=({day:'주간',night:'야간',closed:'장외'})[state.bridgeStatus?.expected_session]||'';
  }else if(marketKey==='sox-index'){
    row=marketAiSnapshotRow(MARKET_AI_SOX_INDEX_SYMBOL);
    state=marketAiSnapshotDisplayState(row,marketAiSoxSessionState());
    label='SOX';
    priceText=row?marketAiPriceText(row.price,2):'--';
    sourceLabel='Yahoo PHLX 반도체 현물지수';
  }else if(marketKey==='nasdaq100-futures'){
    row=marketAiSnapshotRow(MARKET_AI_NASDAQ100_FUTURES_SYMBOL);
    state=marketAiSnapshotDisplayState(row,marketAiNasdaq100FuturesSessionState());
    label='NQ100선물';
    priceText=row?marketAiPriceText(row.price,2):'--';
    sourceLabel='Yahoo Nasdaq-100 선물 (NQ=F)';
  }else{
    return null;
  }

  const sourceRow=row||state?.rawRow||null;
  const changeText=row?(marketAiChangeText(row.change_pct)||'--'):'--';
  const direction=marketAiDirectionClass(row?.change_pct);
  return {
    key:marketKey,
    label,
    price:priceText,
    changePct:changeText,
    changeClass:direction==='positive'?'tt-pos':(direction==='negative'?'tt-neg':''),
    status:marketAiMarketStatusLabel(state?.reason),
    session,
    source:sourceLabel,
    observedAt:marketAiMarketReferenceTime(sourceRow,marketKey)
  };
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
  marketAiActiveTooltipTarget=null;
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

function marketAiSignalInputSummary(signal,metric){
  const targets=[metric?.stateKey,...(metric?.detailKeys||[])].filter(Boolean);
  return marketAiTargetBucket(signal,['signal_inputs','signalInputs'],targets);
}

function marketAiSignalCoverage(signal,metric){
  const summary=marketAiSignalInputSummary(signal,metric);
  const raw=summary?.input_coverage??summary?.inputCoverage;
  if(raw==null||raw==='')return null;
  const value=Number(raw);
  return Number.isFinite(value)?Math.max(0,Math.min(1,value)):null;
}

function marketAiMissingReason(item){
  const inputs=Array.isArray(item?.inputs)?item.inputs:[];
  const statusLabels=[];
  inputs.forEach(input=>{
    if(input?.available!==false)return;
    const label=MARKET_AI_INPUT_STATUS_LABELS[String(input?.status||'')];
    if(label&&!statusLabels.includes(label))statusLabels.push(label);
  });
  if(statusLabels.length)return statusLabels.join(' · ');
  const reason=String(item?.reason||'').trim();
  if(/proxy/i.test(reason))return '선물 proxy 제외';
  if(/missing snapshot|change_pct/i.test(reason))return '데이터 또는 등락률 없음';
  return reason||'사용 가능한 입력 없음';
}

function marketAiSignalMissingInputs(signal,metric){
  const summary=marketAiSignalInputSummary(signal,metric);
  const source=Array.isArray(summary?.missing_inputs)?summary.missing_inputs:(Array.isArray(summary?.basis)?summary.basis.filter(item=>item?.available===false):[]);
  return source.map(item=>({
    key:String(item?.key||''),
    label:marketAiComponentLabel(item?.key),
    reason:marketAiMissingReason(item)
  })).filter(item=>item.key);
}

function marketAiSignalBasis(signal,metric){
  const summary=marketAiSignalInputSummary(signal,metric);
  if(Array.isArray(summary?.basis)&&summary.basis.length){
    return summary.basis
      .map(item=>{
        const key=String(item?.key||'');
        const normalizedWeight=Number(item?.normalized_weight??item?.normalizedWeight);
        const effectiveWeight=Number(item?.effective_weight??item?.effectiveWeight);
        const configuredWeight=Number(item?.configured_weight??item?.configuredWeight??item?.weight);
        const quality=item?.quality==null?NaN:Number(item.quality);
        const weight=Number.isFinite(normalizedWeight)?normalizedWeight:(Number.isFinite(effectiveWeight)?effectiveWeight:configuredWeight);
        return {
          key,
          label:marketAiComponentLabel(key),
          weight:Number.isFinite(weight)?weight:null,
          available:item?.available!==false,
          quality:Number.isFinite(quality)?quality:null
        };
      })
      .filter(item=>item.key&&item.available&&item.weight!=null&&item.weight>0)
      .sort((a,b)=>Number(b.weight)-Number(a.weight));
  }

  const targets=metric.detailKeys||[];
  const effective=marketAiTargetBucket(signal,['effective_weights','effectiveWeights','effective_weight'],targets);
  const weights=marketAiTargetBucket(signal,['weights','base_weights','raw_weights'],targets);
  const components=marketAiTargetBucket(signal,['components','component_details','inputs'],targets);
  const qualityBucket=marketAiGlobalBucket(signal,['qualities','quality']);
  const weightSource=effective||weights;
  const entries=[];

  if(weightSource){
    Object.entries(weightSource).forEach(([key,value])=>{
      const inline=marketAiObject(value);
      if(inline?.available===false)return;
      const normalized=Number(inline?.normalized_weight??inline?.normalizedWeight);
      const fallback=Number(inline?.effective_weight??inline?.effectiveWeight??inline?.weight??value);
      const weight=Number.isFinite(normalized)?normalized:fallback;
      if(!Number.isFinite(weight)||weight<=0)return;
      const record=marketAiComponentRecord(signal,key);
      if(record?.available===false)return;
      const quality=Number(inline?.quality??record?.quality??qualityBucket?.[key]);
      entries.push({
        key,
        label:marketAiComponentLabel(key),
        weight,
        available:true,
        quality:Number.isFinite(quality)?quality:null
      });
    });
  }else if(components){
    Object.entries(components).forEach(([key,value])=>{
      const record=marketAiObject(value);
      if(record?.available===false)return;
      const normalized=Number(record?.normalized_weight??record?.normalizedWeight);
      const fallback=Number(record?.effective_weight??record?.effectiveWeight??record?.weight);
      const weight=Number.isFinite(normalized)?normalized:fallback;
      const quality=Number(record?.quality);
      if(!Number.isFinite(weight)||weight<=0)return;
      entries.push({
        key,
        label:marketAiComponentLabel(key),
        weight,
        available:true,
        quality:Number.isFinite(quality)?quality:null
      });
    });
  }

  return entries.sort((a,b)=>Number(b.weight)-Number(a.weight));
}

function marketAiDisplayedWeights(items){
  const usable=items.filter(item=>Number.isFinite(Number(item?.weight))&&Number(item.weight)>0);
  const total=usable.reduce((sum,item)=>sum+Number(item.weight),0);
  if(!usable.length||!Number.isFinite(total)||total<=0)return [];
  const rows=usable.map((item,index)=>{
    const raw=Number(item.weight)/total*100;
    const base=Math.floor(raw);
    return {...item,index,displayWeight:base,remainder:raw-base};
  });
  let remaining=100-rows.reduce((sum,item)=>sum+item.displayWeight,0);
  [...rows].sort((a,b)=>b.remainder-a.remainder||a.index-b.index).forEach(item=>{
    if(remaining<=0)return;
    item.displayWeight+=1;
    remaining-=1;
  });
  return rows.map(({index,remainder,...item})=>item);
}

// [MARKET07] Tooltip Content / Interaction · 시장·신호 설명 / desktop interaction
function marketAiMarketTooltipHtml(key){
  const model=marketAiMarketDisplayModel(key);
  if(!model)return '';
  const parts=[`<div class="tt-date">${marketAiEscape(model.label)}</div>`];
  parts.push(marketAiTooltipRow('현재가',model.price));
  parts.push(marketAiTooltipRow('등락률',model.changePct,model.changeClass));
  parts.push(marketAiTooltipRow('상태',model.status));
  if(model.session)parts.push(marketAiTooltipRow('세션',model.session));
  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipRow('출처',model.source));
  parts.push(marketAiTooltipRow('기준 시각',model.observedAt?`${model.observedAt} KST`:'--'));
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
  const coverage=marketAiSignalCoverage(signal,metric);
  const missingInputs=marketAiSignalMissingInputs(signal,metric);
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
    return parts.join('');
  }

  if(state&&state.available===false){
    const parts=[`<div class="tt-date">${marketAiEscape(`${metric.fullSignalLabel} · --`)}</div>`];
    parts.push(marketAiTooltipRow('상태',stateLabel||'신호 없음'));
    if(state.target_session_date)parts.push(marketAiTooltipRow('대상 장',marketAiSessionDateText(state.target_session_date)));
    parts.push(marketAiTooltipRow('입력 충족률',marketAiPercentText(coverage)));
    if(missingInputs.length){
      parts.push(marketAiTooltipDivider());
      parts.push(marketAiTooltipSection('누락 입력'));
      missingInputs.forEach(item=>parts.push(marketAiTooltipRow(item.label,item.reason)));
    }
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
  parts.push(marketAiTooltipRow('입력 충족률',marketAiPercentText(coverage)));
  if(calibrated&&Number.isFinite(rawScore))parts.push(marketAiTooltipRow('원신호',`${rawScore.toFixed(1)}점`));
  if(calibrated&&Number.isFinite(sampleCount))parts.push(marketAiTooltipRow('보정 표본',`n=${sampleCount}`));
  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipSection(calibrated?'확률 구간':'점수 구간'));
  parts.push(marketAiScoreRangeHtml(calibrated));

  const basis=marketAiDisplayedWeights(marketAiSignalBasis(signal,metric));
  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipSection('실제 반영 비중'));
  if(basis.length){
    basis.forEach(item=>parts.push(marketAiTooltipRow(item.label,`${item.displayWeight}%`)));
  }else{
    parts.push(marketAiTooltipNote('현재 신호에 반영된 입력 비중을 확인할 수 없습니다.'));
  }

  if(missingInputs.length){
    parts.push(marketAiTooltipDivider());
    parts.push(marketAiTooltipSection('누락 입력'));
    missingInputs.forEach(item=>parts.push(marketAiTooltipRow(item.label,item.reason)));
  }

  const updated=marketAiKstTime(signal.updated_at);
  parts.push(marketAiTooltipDivider());
  parts.push(marketAiTooltipRow('갱신',updated?`${updated} KST`:'--'));
  return parts.join('');
}

function marketAiTooltipHtml(target){
  const type=target.dataset.marketAiTooltip;
  const key=target.dataset.marketAiKey||'';
  return type==='market'?marketAiMarketTooltipHtml(key):(type==='signal'?marketAiSignalTooltipHtml(key):'');
}

function showMarketAiTooltip(target,event){
  const html=marketAiTooltipHtml(target);
  if(!html)return;
  marketAiActiveTooltipTarget=target;
  const tooltip=marketAiTooltip();
  tooltip.innerHTML=html;
  tooltip.setAttribute('aria-hidden','false');
  positionMarketAiTooltip(target,event);
}

function setupMarketAiTooltipEvents(){
  if(marketAiTooltipEventsBound)return;
  marketAiTooltipEventsBound=true;
  const targetFromEvent=event=>event.target.closest?.('#market-ai-section [data-market-ai-tooltip]')||null;
  document.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const target=targetFromEvent(event);
    if(!target||target.contains(event.relatedTarget))return;
    showMarketAiTooltip(target,event);
  });
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    const target=targetFromEvent(event);
    if(target&&document.getElementById(MARKET_AI_TOOLTIP_ID)?.classList.contains('visible'))positionMarketAiTooltip(target,event);
  });
  document.addEventListener('pointerout',event=>{
    if(event.pointerType==='touch')return;
    const target=targetFromEvent(event);
    if(target&&!target.contains(event.relatedTarget))hideMarketAiTooltip();
  });
  document.addEventListener('click',event=>{
    if(!marketAiPhoneUi())return;
    const target=targetFromEvent(event);
    if(!target){
      hideMarketAiTooltip();
      return;
    }
    const tooltip=document.getElementById(MARKET_AI_TOOLTIP_ID);
    if(marketAiActiveTooltipTarget===target&&tooltip?.classList.contains('visible')){
      hideMarketAiTooltip();
      return;
    }
    showMarketAiTooltip(target,null);
  });
  document.addEventListener('focusin',event=>{
    if(marketAiPhoneUi())return;
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

// [MARKET08] Metric Markup / Responsive Phone UI · panel metric / Phone inline owner
function marketAiDesktopSignalMetric(label,key){
  return `<span class="market-ai-desktop-metric" tabindex="0" aria-describedby="${MARKET_AI_TOOLTIP_ID}" data-dashboard-focus-key="market-ai:signal:${key}" data-market-ai-card="${key}" data-market-ai-tooltip="signal" data-market-ai-key="${key}"><span class="data-list-card-label market-ai-desktop-label">${label}</span><strong class="data-list-card-value market-ai-desktop-signal" data-market-ai-score="${key}">--</strong></span>`;
}

function marketAiDesktopMarketMetric(label,marketKey){
  return `<span class="market-ai-desktop-metric" tabindex="0" aria-describedby="${MARKET_AI_TOOLTIP_ID}" data-dashboard-focus-key="market-ai:market:${marketKey}" data-market-ai-market-card="${marketKey}" data-market-ai-tooltip="market" data-market-ai-key="${marketKey}"><span class="data-list-card-label market-ai-desktop-label">${label}</span><strong class="data-list-card-value market-ai-desktop-value" data-market-ai-market="${marketKey}">--</strong><strong class="data-list-card-value market-ai-desktop-change" data-market-ai-change="${marketKey}"></strong></span>`;
}

function marketAiDesktopFuturesMetric(){
  return marketAiDesktopMarketMetric('K200선물','kospi200-futures');
}

function syncMarketAiMetricInteractivity(row){
  row?.querySelectorAll('[data-market-ai-tooltip],[data-market-ai-tooltip-type]').forEach(metric=>{
    const tooltipType=metric.dataset.marketAiTooltip||metric.dataset.marketAiTooltipType||'';
    if(tooltipType)metric.dataset.marketAiTooltip=tooltipType;
    metric.removeAttribute('data-market-ai-tooltip-type');
    metric.setAttribute('tabindex','0');
    metric.setAttribute('aria-describedby',MARKET_AI_TOOLTIP_ID);
  });
  marketAiTooltip();
}


function marketAiPhoneInlineSlot(hero){
  if(!hero)return null;
  let slot=document.getElementById(MARKET_AI_PHONE_INLINE_SLOT_ID);
  if(!slot){
    slot=document.createElement('div');
    slot.id=MARKET_AI_PHONE_INLINE_SLOT_ID;
    slot.className='market-ai-phone-inline-slot';
    slot.setAttribute('data-market-ai-phone-inline-slot','');
  }
  if(hero.nextElementSibling!==slot)hero.insertAdjacentElement('afterend',slot);
  return slot;
}


function syncMarketAiResponsiveMount(row,hero){
  if(marketAiPhoneUi()){
    const inlineSlot=marketAiPhoneInlineSlot(hero);
    if(inlineSlot&&row.parentElement!==inlineSlot)inlineSlot.appendChild(row);
    stopMarketAiHeroWidthObserver(hero);
    hero.classList.remove('market-ai-mounted');
    syncMarketAiMetricInteractivity(row);
    row.dataset.marketAiPlacement='phone-inline';
    return;
  }

  syncMarketAiMetricInteractivity(row);
  if(row.parentElement!==hero)hero.appendChild(row);
  document.getElementById(MARKET_AI_PHONE_INLINE_SLOT_ID)?.remove();
  row.dataset.marketAiPlacement='hero';
  observeMarketAiHeroWidth(row,hero);
  hero.classList.add('market-ai-mounted');
}

// [MARKET09] Mount / Render · 하나의 canonical panel을 Hero ↔ Phone inline slot 사이에서 재사용
function createMarketAiSection(){
  const row=document.createElement('aside');
  row.id='market-ai-section';
  row.setAttribute('role','group');
  row.setAttribute('aria-labelledby','marketAiTitle');
  row.innerHTML=`<div class="market-ai-panel"><div class="market-ai-heading"><span id="marketAiTitle" class="market-ai-title">AI Market Signal</span><span class="market-ai-status" data-market-ai-status role="status" aria-live="polite">연결 확인 중</span></div><div class="market-ai-desktop" data-market-ai-content aria-label="Market AI 현재 지표"><div class="data-list-card market-ai-card-row market-ai-market-row">${marketAiDesktopMarketMetric('KOSPI','kospi-index')}${marketAiDesktopFuturesMetric()}${marketAiDesktopMarketMetric('SOX','sox-index')}${marketAiDesktopMarketMetric('NQ100선물','nasdaq100-futures')}</div><div class="data-list-card market-ai-card-row market-ai-signal-row">${marketAiDesktopSignalMetric('코스피','kospi')}${marketAiDesktopSignalMetric('반도체','semiconductors')}${marketAiDesktopSignalMetric('갭상','gap')}${marketAiDesktopSignalMetric('상승마감','up-close')}</div></div></div>`;
  return row;
}

function mountMarketAiSection(){
  if(!marketAiUiEnabled()||marketAiState.lifecycle!=='online')return null;
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
  row?.remove();
  document.getElementById(MARKET_AI_PHONE_INLINE_SLOT_ID)?.remove();
  stopMarketAiHeroWidthObserver(hero);
  hero?.classList.remove('market-ai-mounted');
  document.querySelectorAll('[data-section-target="market-ai-section"]').forEach(item=>item.remove());
}

function syncMarketAiMarketView(row){
  const marketKeys=['kospi-index','kospi200-futures','sox-index','nasdaq100-futures'];

  marketKeys.forEach(key=>{
    const model=marketAiMarketDisplayModel(key);
    if(!model)return;

    const values=[...row.querySelectorAll(`[data-market-ai-market="${key}"]`)];
    const changes=[...row.querySelectorAll(`[data-market-ai-change="${key}"]`)];
    if(!values.length)return;

    const directionClass=model.changeClass==='tt-pos'?'positive':(model.changeClass==='tt-neg'?'negative':'');
    values.forEach(value=>{
      value.textContent=model.price;
      value.classList.remove('positive','negative');
      if(directionClass)value.classList.add(directionClass);
    });
    changes.forEach(change=>{
      change.textContent=model.changePct;
      change.classList.remove('positive','negative');
      if(directionClass)change.classList.add(directionClass);
    });

    const card=row.querySelector(`[data-market-ai-market-card="${key}"]`);
    if(card){
      const unavailable=model.price==='--';
      card.classList.toggle('is-unavailable',unavailable);
      const labelNode=card.querySelector('.market-ai-desktop-label');
      if(labelNode&&model.label)labelNode.textContent=model.label;
      const changeText=model.changePct==='--'?'등락률 없음':model.changePct;
      card.setAttribute('aria-label',`${model.label} ${model.price} · ${changeText}`);
    }
  });
}

function syncMarketAiSignalView(){
  if(!marketAiUiEnabled()||marketAiState.lifecycle!=='online'||marketAiState.serverReachable!==true){
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
    status.hidden=!!signal;
    status.dataset.marketAiState=marketAiState.statusKind||'checking';
  }
  row.dataset.marketAiState=marketAiState.statusKind||'checking';

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

  const activeTooltip=document.getElementById(MARKET_AI_TOOLTIP_ID);
  if(activeTooltip?.classList.contains('visible')){
    if(marketAiActiveTooltipTarget?.isConnected){
      const html=marketAiTooltipHtml(marketAiActiveTooltipTarget);
      if(html)activeTooltip.innerHTML=html;
      else hideMarketAiTooltip();
    }else{
      hideMarketAiTooltip();
    }
  }

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
  const coverageMeta=MARKET_AI_SIGNAL_METRICS.map(metric=>{
    const coverage=marketAiSignalCoverage(signal,metric);
    const label=metric.key==='semiconductors'?'반도체':(metric.key==='up-close'?'상승마감':(metric.key==='gap'?'갭상':'코스피'));
    return `${label} ${marketAiPercentText(coverage)}`;
  }).join(' / ');
  const meta=[
    '현재 시장',
    `입력 충족률 ${coverageMeta}`,
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

// Signal body를 이 요청 경계에서 소비해 sibling Snapshot/Bridge와 timeout lifecycle을 분리한다.
async function refreshMarketAiSignalResponse(apiBase){
  try{
    const response=await fetchWithTimeout(`${apiBase}/api/signal/latest?include_details=true`,{
      method:'GET',
      headers:{Accept:'application/json'},
      cache:'no-store'
    });
    if(response.status===404||!response.ok){
      response.releaseTimeout?.();
      return {response,signal:null,parseError:false};
    }
    try{
      return {response,signal:await response.json(),parseError:false};
    }catch(_){
      return {response,signal:null,parseError:true};
    }
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
    if(!response.ok){response.releaseTimeout?.();return null;}
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
    if(!response.ok){response.releaseTimeout?.();return null;}
    const payload=await response.json();
    return marketAiObject(payload);
  }catch(_){
    return null;
  }
}

// 동일 lifecycle 세션의 refresh는 single-flight로 합치고, 이전 세션 응답은 generation/sequence로 폐기한다.
let marketAiRefreshSequence=0;

async function runMarketAiSignalRefresh(generation){
  const refreshSequence=++marketAiRefreshSequence;
  const startedOnline=marketAiState.lifecycle==='online';
  if(!marketAiEnabled()){
    setMarketAiLifecycleState('off',{resetData:true});
    return;
  }
  const apiBase=marketAiApiBase();
  if(!apiBase){
    setMarketAiLifecycleState('offline',{resetData:true});
    return;
  }

  if(!startedOnline){
    Object.assign(marketAiState,{status:'연결 확인 중',statusKind:'checking',message:'Market AI 서버에 연결하고 있습니다.'});
    setMarketAiLifecycleState('checking');
  }

  const previousSignalAt=marketAiState.signal?.updated_at||marketAiState.lastSignalAt||null;
  const [signalResult,nextMarketSnapshot,nextBridgeStatus]=await Promise.all([
    refreshMarketAiSignalResponse(apiBase),
    refreshMarketAiMarketSnapshot(apiBase),
    refreshMarketAiBridgeStatus(apiBase)
  ]);
  if(!marketAiLifecycleIsCurrent(generation,refreshSequence))return;

  const signalTransportReachable=signalResult!==null&&Number(signalResult.response?.status||0)<500;
  const serverReachable=signalTransportReachable||nextMarketSnapshot!==null||nextBridgeStatus!==null;
  if(!serverReachable){
    if(startedOnline){
      marketAiConsecutiveUnavailableRefreshes+=1;
      if(marketAiConsecutiveUnavailableRefreshes<MARKET_AI_OFFLINE_FAILURE_LIMIT)return;
    }
    Object.assign(marketAiState,{
      signal:null,marketSnapshot:{},bridgeStatus:null,serverReachable:false,
      status:'연결 실패',statusKind:'offline',message:'Market AI 서버에 연결할 수 없습니다.',lastSignalAt:null
    });
    setMarketAiLifecycleState('offline');
    return;
  }

  marketAiConsecutiveUnavailableRefreshes=0;
  Object.assign(marketAiState,{
    lifecycle:'online',
    serverReachable:true,
    marketSnapshot:nextMarketSnapshot??{},
    bridgeStatus:nextBridgeStatus
  });
  publishMarketAiKospiSnapshot(marketAiState.marketSnapshot?.['INDEX:KOSPI']||null);
  document.documentElement.dataset.marketAiLifecycle='online';
  publishMarketAiConnectionState(true);
  ensureMarketAiPollTimer();

  if(!signalResult){
    setMarketAiState({
      signal:null,
      status:'신호 오류',
      statusKind:'signal-error',
      message:'시장 데이터는 연결되었지만 AI 신호 응답을 확인할 수 없습니다.',
      lastSignalAt:previousSignalAt
    });
    return;
  }

  const {response,signal,parseError}=signalResult;

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

  if(parseError){
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

function refreshMarketAiSignal(){
  if(!marketAiEnabled()){
    setMarketAiLifecycleState('off',{resetData:true});
    return Promise.resolve();
  }
  const generation=marketAiLifecycleGeneration;
  if(marketAiRefreshInFlight?.generation===generation)return marketAiRefreshInFlight.promise;
  const promise=runMarketAiSignalRefresh(generation);
  marketAiRefreshInFlight={generation,promise};
  promise.finally(()=>{
    if(marketAiRefreshInFlight?.promise===promise)marketAiRefreshInFlight=null;
  });
  return promise;
}

// [MARKET11] Lifecycle / Polling · render 교체 감시 / polling boot
function scheduleMount(){
  if(mountFrame)return;
  mountFrame=requestAnimationFrame(()=>{
    mountFrame=0;
    syncMarketAiSignalView();
  });
}

function handleMarketAiEnabledChange(event){
  const enabled=event?.detail?.enabled===true;
  if(enabled&&marketAiState.lifecycle==='checking')return;
  marketAiLifecycleGeneration+=1;
  marketAiRefreshSequence+=1;
  if(!enabled){
    Object.assign(marketAiState,{status:'연결 꺼짐',statusKind:'disabled',message:''});
    // setMarketAiLifecycleState()가 connection=false를 한 번만 publish한다.
    // OFF preference와 connection event 양쪽에서 같은 live valuation 정리를 중복 실행하지 않는다.
    setMarketAiLifecycleState('off',{resetData:true});
    return;
  }
  Object.assign(marketAiState,{status:'연결 확인 중',statusKind:'checking',message:'Market AI 서버에 연결하고 있습니다.'});
  setMarketAiLifecycleState('checking',{resetData:true});
  refreshMarketAiSignal();
}

function startMarketAiBridge(){
  document.documentElement.dataset.marketAiLifecycle='off';
  publishMarketAiConnectionState(false,{force:true});
  setupMarketAiTooltipEvents();
  if(typeof marketAiPhoneMedia.addEventListener==='function')marketAiPhoneMedia.addEventListener('change',scheduleMount);
  else marketAiPhoneMedia.addListener?.(scheduleMount);

  // 초기 OFF여도 이후 연결 켜기 이벤트를 받을 수 있도록 lifecycle listener는 항상 등록한다.
  const app=document.getElementById('app');
  if(app)new MutationObserver(scheduleMount).observe(app,{childList:true,subtree:false});
  window.addEventListener(MARKET_AI_ENABLED_EVENT,handleMarketAiEnabledChange);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&marketAiPollingAllowed())refreshMarketAiSignal();
  });

  if(marketAiUiEnabled()){
    marketAiLifecycleGeneration+=1;
    Object.assign(marketAiState,{status:'연결 확인 중',statusKind:'checking',message:'Market AI 서버에 연결하고 있습니다.'});
    setMarketAiLifecycleState('checking',{resetData:true});
    refreshMarketAiSignal();
  }else{
    setMarketAiLifecycleState('off',{resetData:true});
    publishMarketAiConnectionState(false,{force:true});
  }

}

startMarketAiBridge();
