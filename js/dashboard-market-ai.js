// Market AI standalone dashboard adapter
// - 메인 7개 ES Module graph와 분리
// - dashboard-app.js / dashboard-ui.js 수정 없이 index.html에서 독립 로드
// - Desktop: Hero 우측의 보조 카드로 현재 시장 + AI 신호를 표시
// - Tablet: Hero 내부 하단에 보조 카드로 표시
// - Mobile/실제 터치폰 가로: Market AI UI를 숨김
// - CSS ownership: common(Hero baseline/component) → tablet(layout) → special(compact/phone exception)
// - 구조 스타일은 CSS class에 맡기고 JS는 mount/state/tooltip 위치 계산만 담당
// - 기존 대시보드 render가 #app을 교체해도 MutationObserver로 자체 영역만 재부착
// - Stage 9 calibration이 있으면 해당 target만 확률로 표시하고, 없으면 기존 100점 신호 유지
// - 일반 모드의 실제 API 호출은 localhost/LAN에서만 수행하며, 비로컬 환경에서는 Market AI UI를 표시하지 않음
// - ?marketAiPreview=1을 명시한 경우에만 API 부재/실패/404/stale 시 DB 응답 형태의 UI fallback을 사용

const MARKET_AI_POLL_MS=60_000;
const MARKET_AI_TIMEOUT_MS=2_500;
const MARKET_AI_STALE_MS=5*60_000;
const LOCAL_DASHBOARD_HOSTS=new Set(['localhost','127.0.0.1','::1']);
const MARKET_AI_KIS_FUTURES_SYMBOL='FUTURES:KOSPI200';
const MARKET_AI_NASDAQ100_FUTURES_SYMBOL='FUTURES:NQ';
const MARKET_AI_TOOLTIP_ID='marketAiTooltip';
const MARKET_AI_PREVIEW_PARAM='marketAiPreview';
const MARKET_AI_SCORE_RANGE_LINES=[
  '0–34.9 강한 약세 · 35–45 약세 · 45 초과–54.9 중립',
  '55–64.9 강세 · 65–100 강한 강세'
];
const MARKET_AI_SIGNAL_METRICS=[
  {key:'kospi',target:'kospi_up',scoreField:'kospi_score',detailKeys:['kospi','kospi_up'],fullSignalLabel:'코스피 신호',fullProbabilityLabel:'코스피 상승확률'},
  {key:'semiconductors',target:'semiconductor_up',scoreField:'semiconductor_score',detailKeys:['semiconductors','semiconductor','semiconductor_up'],fullSignalLabel:'반도체 신호',fullProbabilityLabel:'반도체 상승확률'},
  {key:'gap',target:'gap_up',scoreField:'gap_up_probability',detailKeys:['gap','gap_up'],fullSignalLabel:'갭상 신호',fullProbabilityLabel:'갭상 확률'},
  {key:'up-close',target:'up_close',scoreField:'up_close_probability',detailKeys:['up_close','up-close','up_close_probability'],fullSignalLabel:'상승마감 신호',fullProbabilityLabel:'상승마감 확률'}
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
  status:'연결 확인 중',
  message:'선택일과 무관한 현재 Market AI 신호를 확인하고 있습니다.',
  lastSignalAt:null
};

let marketAiPollTimer=0;
let mountFrame=0;
let marketAiTooltipEventsBound=false;

function marketAiLocalHost(){
  const host=String(location.hostname||'').toLowerCase();
  if(LOCAL_DASHBOARD_HOSTS.has(host)||host.endsWith('.local'))return true;
  if(/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host))return true;
  const match=host.match(/^172\.(\d{1,3})\./);
  return !!match&&Number(match[1])>=16&&Number(match[1])<=31;
}

function marketAiApiBase(){
  if(!marketAiLocalHost())return '';
  return `${location.protocol}//${location.hostname}:8001`;
}

function marketAiPreviewRequested(){
  return new URLSearchParams(location.search).get(MARKET_AI_PREVIEW_PARAM)==='1';
}

function marketAiPreviewEnabled(){
  return marketAiPreviewRequested();
}

function syncMarketAiPreviewMode(){
  document.documentElement.classList.toggle('market-ai-preview',marketAiPreviewEnabled());
}

function marketAiPreviewPayload(){
  const observedAt=new Date().toISOString();
  const snapshotRows=[
    {symbol:'INDEX:KOSPI',price:6912.95,change_pct:0.88,source:'yfinance:^KS11'},
    {symbol:MARKET_AI_KIS_FUTURES_SYMBOL,price:1074.55,change_pct:-2.29,source:'kis-efriend:day:FC_R:A01609'},
    {symbol:'INDEX:SOX',price:11740.37,change_pct:-0.51,source:'yfinance:^SOX'},
    {symbol:MARKET_AI_NASDAQ100_FUTURES_SYMBOL,price:29374.00,change_pct:0.25,source:'yfinance:NQ=F'}
  ].map(row=>({...row,observed_at:observedAt}));
  return {
    signal:{
      updated_at:observedAt,
      engine_version:'stage6_rule_v5',
      kospi_score:27.14,
      semiconductor_score:56.89,
      gap_up_probability:32.54,
      up_close_probability:42.72,
      confidence:0.86,
      data_completeness:0.79,
      calibrated:false,
      calibration:null,
      details:{
        method:'stage6_rule_v5',
        weights:{
          kospi:{kospi_index:0.35,kospi200_futures:0.65},
          semiconductors:{samsung_electronics:0.20,sk_hynix:0.20,sox_index:0.20,nvidia:0.15,sk_hynix_adr:0.15,micron:0.10},
          gap_up:{kospi200_futures:0.50,sox_index:0.25,nasdaq100_futures:0.20,usdkrw:0.05},
          up_close:{kospi_index:0.45,kospi200_futures:0.35,sox_index:0.12,nasdaq100_futures:0.08}
        },
        qualities:{
          kospi_index:1,kospi200_futures:1,samsung_electronics:1,sk_hynix:1,sox_index:1,
          nvidia:1,sk_hynix_adr:1,micron:1,nasdaq100_futures:1,usdkrw:1
        }
      }
    },
    marketSnapshot:Object.fromEntries(snapshotRows.map(row=>[row.symbol,row]))
  };
}

function applyMarketAiPreview(){
  const preview=marketAiPreviewPayload();
  setMarketAiState({
    signal:preview.signal,
    marketSnapshot:preview.marketSnapshot,
    status:'연결됨',
    message:'',
    lastSignalAt:null
  });
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

function marketAiKstClockParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Seoul',
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

function marketAiK200SessionOpen(date=new Date()){
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
  if(!rawRow)return {row:null,rawRow:null,reason:'missing'};
  const source=String(rawRow.source||'');
  if(!source.startsWith('kis-efriend:')||source.includes(':proxy')){
    return {row:null,rawRow,reason:'source'};
  }
  const freshness=marketAiSnapshotFreshness(rawRow);
  if(!freshness.fresh){
    if(!marketAiK200SessionOpen()){
      return {row:rawRow,rawRow,reason:'closed',observedAt:freshness.observedAt};
    }
    return {row:null,rawRow,reason:'stale',observedAt:freshness.observedAt};
  }
  return {row:rawRow,rawRow,reason:'fresh',observedAt:freshness.observedAt};
}

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

function marketAiSignalBasis(signal,metric){
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

function marketAiMarketTooltipHtml(key){
  const futuresState=marketAiKisFuturesState();
  const config={
    'kospi-index':{label:'KOSPI',row:marketAiSnapshotRow('INDEX:KOSPI'),price:item=>marketAiIndexText(item?.price),source:'Yahoo KOSPI 현물지수'},
    'sox-index':{label:'SOX',row:marketAiSnapshotRow('INDEX:SOX'),price:item=>marketAiIndexText(item?.price),source:'Yahoo PHLX 반도체 현물지수'},
    'nasdaq100-futures':{label:'NASDAQ100 선물',row:marketAiSnapshotRow(MARKET_AI_NASDAQ100_FUTURES_SYMBOL),price:item=>marketAiPriceText(item?.price,2),source:'Yahoo Nasdaq-100 선물 (NQ=F)'},
    'kospi200-futures':{label:'KOSPI200 선물',row:futuresState.row,price:item=>marketAiPriceText(item?.price,2),source:'KIS eFriend 실제 선물',state:futuresState}
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
    const stateLabel={fresh:'거래 데이터 정상',closed:'장 종료 · 마지막 정상값',stale:'장중 데이터 지연',source:'실제 선물 소스 없음',missing:'데이터 없음'}[config.state.reason]||'상태 확인';
    parts.push(marketAiTooltipRow('상태',stateLabel));
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
  const calibration=signal.calibration||{};
  const calibratedTargets=new Set(Array.isArray(calibration.available_targets)?calibration.available_targets:[]);
  const probability=Number(calibration.probabilities?.[metric.target]);
  const calibrated=calibratedTargets.has(metric.target)&&Number.isFinite(probability);
  const rawScore=Number(signal[metric.scoreField]);
  const displayValue=calibrated?probability*100:rawScore;
  const displayText=calibrated?marketAiProbabilityText(probability):marketAiScoreText(rawScore);
  const band=marketAiScoreBand(displayValue);
  const sampleCount=Number(calibration.models?.[metric.target]?.sample_count);
  const fullLabel=calibrated?metric.fullProbabilityLabel:metric.fullSignalLabel;
  const parts=[`<div class="tt-date">${marketAiEscape(`${fullLabel} ${displayText} · ${band.label}`)}</div>`];
  parts.push(marketAiTooltipRow('판단',band.label,band.className));
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
  const targetFromEvent=event=>event.target.closest?.('#market-ai-section [data-market-ai-tooltip]')||null;
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

function marketAiDesktopSignalMetric(label,key){
  return `<span class="market-ai-desktop-metric" tabindex="0" data-market-ai-card="${key}" data-market-ai-tooltip="signal" data-market-ai-key="${key}"><span class="market-ai-desktop-label">${label}</span><strong class="market-ai-desktop-signal" data-market-ai-score="${key}">--</strong></span>`;
}

function marketAiDesktopMarketMetric(label,marketKey){
  return `<span class="market-ai-desktop-metric" tabindex="0" data-market-ai-market-card="${marketKey}" data-market-ai-tooltip="market" data-market-ai-key="${marketKey}"><span class="market-ai-desktop-label">${label}</span><strong class="market-ai-desktop-value" data-market-ai-market="${marketKey}">--</strong><strong class="market-ai-desktop-change" data-market-ai-change="${marketKey}"></strong></span>`;
}

function marketAiDesktopFuturesMetric(){
  return marketAiDesktopMarketMetric('K200선물','kospi200-futures');
}

function marketAiDesktopGroupLabel(label){
  return `<span class="market-ai-desktop-group-label">${label}</span>`;
}

function createMarketAiSection(){
  const row=document.createElement('aside');
  row.id='market-ai-section';
  row.setAttribute('role','group');
  row.setAttribute('aria-labelledby','marketAiTitle');
  row.innerHTML=`<div class="market-ai-panel"><div class="market-ai-heading"><span id="marketAiTitle" class="market-ai-title">AI Market Signal</span><span class="market-ai-status" data-market-ai-status role="status" aria-live="polite">연결 확인 중</span></div><div class="market-ai-desktop" data-market-ai-content aria-label="현재 시장과 AI 신호"><div class="market-ai-card-row market-ai-market-row">${marketAiDesktopGroupLabel('시장')}${marketAiDesktopMarketMetric('KOSPI','kospi-index')}${marketAiDesktopFuturesMetric()}${marketAiDesktopMarketMetric('SOX','sox-index')}${marketAiDesktopMarketMetric('NQ100선물','nasdaq100-futures')}</div><div class="market-ai-card-row market-ai-signal-row">${marketAiDesktopGroupLabel('AI 신호')}${marketAiDesktopSignalMetric('코스피','kospi')}${marketAiDesktopSignalMetric('반도체','semiconductors')}${marketAiDesktopSignalMetric('갭상','gap')}${marketAiDesktopSignalMetric('상승마감','up-close')}</div></div></div>`;
  return row;
}

function mountMarketAiSection(){
  const hero=document.querySelector('#app > .wrap > .hero');
  if(!hero)return null;
  let row=document.getElementById('market-ai-section');
  if(!row)row=createMarketAiSection();
  if(row.parentElement!==hero)hero.append(row);
  hero.classList.add('market-ai-mounted');
  return row;
}

function removeMarketAiUi(){
  hideMarketAiTooltip();
  const row=document.getElementById('market-ai-section');
  const hero=row?.closest('.hero')||document.querySelector('#app > .wrap > .hero');
  row?.remove();
  hero?.classList.remove('market-ai-mounted');
  document.querySelectorAll('[data-section-target="market-ai-section"]').forEach(item=>item.remove());
}

function syncMarketAiMarketView(row){
  const futuresState=marketAiKisFuturesState();
  const marketItems=[
    {key:'kospi-index',marketRow:marketAiSnapshotRow('INDEX:KOSPI'),valueText:item=>marketAiIndexText(item?.price)},
    {key:'kospi200-futures',marketRow:futuresState.row,valueText:item=>marketAiPriceText(item?.price,2)},
    {key:'sox-index',marketRow:marketAiSnapshotRow('INDEX:SOX'),valueText:item=>marketAiIndexText(item?.price)},
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
      const label=card.querySelector('.market-ai-desktop-label')?.textContent?.trim()||item.key;
      const valueText=item.valueText(item.marketRow);
      const changeText=marketAiChangeText(item.marketRow?.change_pct)||'등락률 없음';
      card.setAttribute('aria-label',`${label} ${valueText} · ${changeText}`);
    }
  });
}

function syncMarketAiSignalView(){
  const row=mountMarketAiSection();
  if(!row)return;
  const signal=marketAiState.signal;
  const calibration=signal?.calibration||{};
  const calibratedTargets=new Set(Array.isArray(calibration.available_targets)?calibration.available_targets:[]);
  const probabilities=calibration.probabilities||{};
  const metrics=MARKET_AI_SIGNAL_METRICS.map(metric=>({...metric,score:signal?.[metric.scoreField]}));

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
    const fullLabel=calibrated?metric.fullProbabilityLabel:metric.fullSignalLabel;
    const band=marketAiScoreBand(displayValue);
    items.forEach(item=>{
      item.removeAttribute('title');
      item.setAttribute('aria-label',`${fullLabel} ${valueText} · ${band.label}`);
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
    if(marketAiPreviewEnabled())applyMarketAiPreview();
    else removeMarketAiUi();
    return;
  }

  if(!marketAiState.signal){
    setMarketAiState({status:'연결 확인 중',message:'Market AI 서버에 연결하고 있습니다.'});
  }
  try{
    const [response,nextMarketSnapshot]=await Promise.all([
      fetchWithTimeout(`${apiBase}/api/signal/latest?include_details=true`,{
        method:'GET',
        headers:{Accept:'application/json'},
        cache:'no-store'
      }),
      refreshMarketAiMarketSnapshot(apiBase)
    ]);
    setMarketAiState({
      marketSnapshot:nextMarketSnapshot||(marketAiPreviewEnabled()?marketAiPreviewPayload().marketSnapshot:{})
    });
    if(response.status===404){
      if(marketAiPreviewEnabled()){
        applyMarketAiPreview();
        return;
      }
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
      if(marketAiPreviewEnabled()){
        applyMarketAiPreview();
        return;
      }
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
    if(marketAiPreviewEnabled()){
      applyMarketAiPreview();
      return;
    }
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
  syncMarketAiPreviewMode();
  setupMarketAiTooltipEvents();

  const apiBase=marketAiApiBase();
  const preview=marketAiPreviewEnabled();
  if(!apiBase&&!preview){
    removeMarketAiUi();
    return;
  }

  const app=document.getElementById('app');
  if(app)new MutationObserver(scheduleMount).observe(app,{childList:true,subtree:false});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshMarketAiSignal();
  });
  scheduleMount();

  if(!apiBase){
    applyMarketAiPreview();
    return;
  }

  refreshMarketAiSignal();
  if(!marketAiPollTimer){
    marketAiPollTimer=window.setInterval(()=>{
      if(document.visibilityState==='visible')refreshMarketAiSignal();
    },MARKET_AI_POLL_MS);
  }
}

startMarketAiBridge();
