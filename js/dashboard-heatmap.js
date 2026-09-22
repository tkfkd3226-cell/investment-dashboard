import { dataState, fmt, pct, shortDate, signed, won } from './dashboard-core.js';
import { assetPriceSourceInfo, escapeHtml, navIconSvg } from './dashboard-ui-common.js';
import {
  bindDashboardModalDismiss,
  closeDashboardModal,
  openDashboardModal
} from './dashboard-modal.js';

// Portfolio Heatmap · canonical portfolio view + deterministic treemap visualization
// Ownership: canonical securities 결과를 읽는 View Model, deterministic treemap geometry, mode metric,
// dense tile renderer, legend, tooltip/tap interaction, modal-local responsive/live refresh.
// 가격 fetch/평가 재계산/Market AI 요청/polling/main render orchestration은 소유하지 않는다.
// Structure map:
//   [HEATMAP01] Constants / State
//   [HEATMAP02] Pure View Model
//   [HEATMAP03] Pure Treemap Engine
//   [HEATMAP04] Pure Mode / Color / Density
//   [HEATMAP05] Formatting / Tooltip Data
//   [HEATMAP06] Visualization Rendering
//   [HEATMAP07] Tooltip / Interaction
//   [HEATMAP08] Modal Lifecycle
//   [HEATMAP09] Public API

// [HEATMAP01] Constants / State
const PORTFOLIO_HEATMAP_ACTION=Object.freeze({
  open:'open-portfolio-heatmap',
  close:'close-portfolio-heatmap',
  setMode:'set-portfolio-heatmap-mode'
});
const PORTFOLIO_HEATMAP_MODES=Object.freeze({
  day:'당일',
  cumulative:'누적손익',
  weight:'비중'
});
const PORTFOLIO_HEATMAP_SCALE=Object.freeze({day:3,cumulative:30});
const PORTFOLIO_HEATMAP_TOOLTIP_ID='portfolioHeatmapTooltip';
const portfolioHeatmapState={
  mode:'day',
  rows:[],
  context:null,
  layoutRows:[],
  layoutWidth:0,
  layoutHeight:0,
  pinnedIndex:null,
  resizeFrame:0
};
let portfolioHeatmapInteractionsBound=false;

function portfolioHeatmapFocusFallbackSelector(){
  return '.topbar-heatmap-action,#dateActionMenuButton';
}

// [HEATMAP02] Pure View Model · calc()의 canonical holdings/change rows만 읽는다.
function finiteHeatmapNumber(value,fallback=null){
  if(value==null||value==='')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}
function firstFiniteHeatmapNumber(values,fallback=null){
  for(const value of values){
    const number=finiteHeatmapNumber(value,null);
    if(number!==null)return number;
  }
  return fallback;
}
function heatmapStableKey(row){
  return String(row?.ticker||row?.name||'').trim().toUpperCase();
}
function comparePortfolioHeatmapRows(a,b){
  const evalDiff=b.evalAmount-a.evalAmount;
  if(evalDiff!==0)return evalDiff;
  const aKey=heatmapStableKey(a),bKey=heatmapStableKey(b);
  if(aKey<bKey)return -1;
  if(aKey>bKey)return 1;
  const aName=String(a?.name||''),bName=String(b?.name||'');
  return aName<bName?-1:aName>bName?1:0;
}
function portfolioHeatmapChangeMap(changeRows=[]){
  const map=new Map();
  for(const row of Array.isArray(changeRows)?changeRows:[]){
    const ticker=String(row?.ticker||'').trim();
    const name=String(row?.name||'').trim();
    if(ticker)map.set(`ticker:${ticker}`,row);
    if(name)map.set(`name:${name}`,row);
  }
  return map;
}
function portfolioHeatmapChangeForHolding(map,holding){
  const ticker=String(holding?.ticker||'').trim();
  const name=String(holding?.name||'').trim();
  return (ticker&&map.get(`ticker:${ticker}`))||(name&&map.get(`name:${name}`))||null;
}
function createPortfolioHeatmapViewModel({holdings=[],changeRows=[]}={}){
  const changes=portfolioHeatmapChangeMap(changeRows);
  const rows=(Array.isArray(holdings)?holdings:[]).reduce((result,holding)=>{
    const type=String(holding?.type||'');
    if(type==='현금')return result;
    const evalAmount=finiteHeatmapNumber(holding?.evalAmount,NaN);
    if(!(evalAmount>0))return result;
    const change=portfolioHeatmapChangeForHolding(changes,holding);
    const cumulativePnl=firstFiniteHeatmapNumber([holding?.totalProfit,holding?.profit],null);
    const cumulativeRate=finiteHeatmapNumber(holding?.returnRate,null);
    result.push({
      ticker:String(holding?.ticker||''),
      name:String(holding?.name||holding?.ticker||''),
      type,
      qty:finiteHeatmapNumber(holding?.qty,null),
      cost:finiteHeatmapNumber(holding?.cost,null),
      avgPrice:finiteHeatmapNumber(holding?.avgPrice,null),
      price:finiteHeatmapNumber(holding?.price,null),
      evalAmount,
      weight:0,
      dayChange:firstFiniteHeatmapNumber([change?.dayChange,holding?.dayChange],null),
      dayRate:finiteHeatmapNumber(change?.dayRate,null),
      cumulativePnl,
      cumulativeRate,
      liveQuote:holding?.liveQuote??null,
      postClosePending:holding?.postClosePending===true
    });
    return result;
  },[]).sort(comparePortfolioHeatmapRows);
  const totalEval=rows.reduce((sum,row)=>sum+row.evalAmount,0);
  if(!(totalEval>0))return [];
  return rows.map(row=>({...row,weight:row.evalAmount/totalEval*100}));
}
function createPortfolioHeatmapViewModelFromCalc(calcResult){
  return createPortfolioHeatmapViewModel({
    holdings:calcResult?.holdings,
    changeRows:calcResult?.securitiesAssetDetail?.change?.rows
  });
}
function portfolioHeatmapContextFromCalc(calcResult){
  return {
    date:String(calcResult?.date||dataState.activeDate||''),
    fallbackSource:calcResult?.daily?'account1_daily_snapshots.json':'prices.json',
    marketStatus:String(calcResult?.s?.marketStatus||''),
    priceBasis:String(calcResult?.s?.priceBasis||''),
    regularCloseSource:String(calcResult?.s?.regularCloseSource||'')
  };
}

// [HEATMAP03] Pure Treemap Engine · mode와 무관하게 evalAmount만 geometry에 사용한다.
function portfolioHeatmapWorstAspect(row,shortSide){
  if(!row.length||!(shortSide>0))return Infinity;
  const sum=row.reduce((total,item)=>total+item.area,0);
  if(!(sum>0))return Infinity;
  let min=Infinity,max=0;
  for(const item of row){
    if(item.area<min)min=item.area;
    if(item.area>max)max=item.area;
  }
  if(!(min>0))return Infinity;
  const sideSquared=shortSide*shortSide;
  const sumSquared=sum*sum;
  return Math.max(sideSquared*max/sumSquared,sumSquared/(sideSquared*min));
}
function portfolioHeatmapLayoutRow(row,frame,placements){
  const rowArea=row.reduce((sum,item)=>sum+item.area,0);
  if(!(rowArea>0))return frame;
  const {x,y,width,height}=frame;
  if(width>=height){
    const rowWidth=height>0?rowArea/height:0;
    let offsetY=y;
    row.forEach((item,index)=>{
      const itemHeight=rowWidth>0?item.area/rowWidth:0;
      const nextY=index===row.length-1?y+height:offsetY+itemHeight;
      placements[item.index]={x,y:offsetY,width:rowWidth,height:Math.max(0,nextY-offsetY)};
      offsetY=nextY;
    });
    return {x:x+rowWidth,y,width:Math.max(0,width-rowWidth),height};
  }
  const rowHeight=width>0?rowArea/width:0;
  let offsetX=x;
  row.forEach((item,index)=>{
    const itemWidth=rowHeight>0?item.area/rowHeight:0;
    const nextX=index===row.length-1?x+width:offsetX+itemWidth;
    placements[item.index]={x:offsetX,y,width:Math.max(0,nextX-offsetX),height:rowHeight};
    offsetX=nextX;
  });
  return {x,y:y+rowHeight,width,height:Math.max(0,height-rowHeight)};
}
function layoutPortfolioHeatmap(rows,width,height){
  const canvasWidth=finiteHeatmapNumber(width,0);
  const canvasHeight=finiteHeatmapNumber(height,0);
  if(!(canvasWidth>0&&canvasHeight>0)||!Array.isArray(rows)||!rows.length)return [];
  const values=rows.map(row=>finiteHeatmapNumber(row?.evalAmount,0));
  const total=values.reduce((sum,value)=>sum+(value>0?value:0),0);
  if(!(total>0))return [];
  const scale=canvasWidth*canvasHeight/total;
  const pending=values.map((value,index)=>({index,area:Math.max(0,value)*scale})).filter(item=>item.area>0);
  const placements=Array(rows.length).fill(null);
  let frame={x:0,y:0,width:canvasWidth,height:canvasHeight};
  let current=[];
  while(pending.length){
    const next=pending[0];
    const shortSide=Math.min(frame.width,frame.height);
    if(!current.length||portfolioHeatmapWorstAspect([...current,next],shortSide)<=portfolioHeatmapWorstAspect(current,shortSide)){
      current.push(pending.shift());
      continue;
    }
    frame=portfolioHeatmapLayoutRow(current,frame,placements);
    current=[];
  }
  if(current.length)portfolioHeatmapLayoutRow(current,frame,placements);
  return rows.map((row,index)=>({...row,rect:placements[index]||{x:0,y:0,width:0,height:0}}));
}

// [HEATMAP04] Pure Mode / Color / Density · geometry를 변경하지 않는 표시 계약.
function portfolioHeatmapModeMetric(row,mode='day'){
  if(mode==='cumulative')return {
    mode,
    primaryValue:row?.cumulativeRate??null,
    secondaryValue:row?.cumulativePnl??null,
    tertiaryValue:row?.weight??null,
    colorValue:row?.cumulativeRate??null,
    colorKind:'performance'
  };
  if(mode==='weight')return {
    mode,
    primaryValue:row?.weight??null,
    secondaryValue:row?.evalAmount??null,
    tertiaryValue:null,
    colorValue:null,
    colorKind:'neutral'
  };
  return {
    mode:'day',
    primaryValue:row?.dayRate??null,
    secondaryValue:row?.evalAmount??null,
    tertiaryValue:row?.weight??null,
    colorValue:row?.dayRate??null,
    colorKind:'performance'
  };
}
function portfolioHeatmapColorState(row,mode='day'){
  const metric=portfolioHeatmapModeMetric(row,mode);
  if(metric.colorKind==='neutral')return {kind:'neutral',direction:'weight',intensity:100,value:null};
  const value=finiteHeatmapNumber(metric.colorValue,null);
  if(value===null||value===0)return {kind:value===null?'unavailable':'neutral',direction:'neutral',intensity:0,value};
  const scale=PORTFOLIO_HEATMAP_SCALE[mode]||PORTFOLIO_HEATMAP_SCALE.day;
  return {
    kind:'performance',
    direction:value>0?'positive':'negative',
    intensity:Math.max(0,Math.min(1,Math.abs(value)/scale))*100,
    value
  };
}
function portfolioHeatmapTileDensity(rect={}){
  const width=Math.max(0,finiteHeatmapNumber(rect.width,0));
  const height=Math.max(0,finiteHeatmapNumber(rect.height,0));
  const area=width*height;
  if(width>=170&&height>=88&&area>=18000)return 'large';
  if(width>=92&&height>=50&&area>=6000)return 'medium';
  if(width>=46&&height>=27&&area>=1500)return 'small';
  return 'tiny';
}

// [HEATMAP05] Formatting / Tooltip Data · Dashboard formatter/source helper를 재사용한다.
function heatmapRateText(value,{signedValue=true}={}){
  const number=finiteHeatmapNumber(value,null);
  if(number===null)return '-';
  return `${signedValue&&number>0?'+':''}${pct(number)}`;
}
function heatmapAmountText(value,{signedValue=false}={}){
  const number=finiteHeatmapNumber(value,null);
  if(number===null)return '-';
  return signedValue?signed(number,'원'):won(number);
}
function portfolioHeatmapPrimaryText(row,mode){
  const metric=portfolioHeatmapModeMetric(row,mode);
  if(mode==='weight')return heatmapRateText(metric.primaryValue,{signedValue:false});
  return heatmapRateText(metric.primaryValue);
}
function portfolioHeatmapSecondaryText(row,mode){
  if(mode==='cumulative')return `${heatmapAmountText(row.cumulativePnl,{signedValue:true})} · ${heatmapRateText(row.weight,{signedValue:false})}`;
  if(mode==='weight')return heatmapAmountText(row.evalAmount);
  return `${heatmapAmountText(row.evalAmount)} · ${heatmapRateText(row.weight,{signedValue:false})}`;
}
function portfolioHeatmapTileAriaLabel(row,mode){
  const parts=[row.name||row.ticker||'종목',PORTFOLIO_HEATMAP_MODES[mode]||PORTFOLIO_HEATMAP_MODES.day,portfolioHeatmapPrimaryText(row,mode)];
  if(row.evalAmount!=null)parts.push(`평가금액 ${won(row.evalAmount)}`);
  if(row.weight!=null)parts.push(`비중 ${heatmapRateText(row.weight,{signedValue:false})}`);
  return parts.join(', ');
}
function portfolioHeatmapPriceSource(row){
  const context=portfolioHeatmapState.context||{};
  return assetPriceSourceInfo({
    name:row?.name||'',ticker:row?.ticker||'',date:context.date||'',priceText:row?.price==null?'':won(row.price),
    liveQuote:row?.liveQuote??null,postClosePending:row?.postClosePending===true,
    fallbackSource:context.fallbackSource||'prices.json',marketStatus:context.marketStatus||'',priceBasis:context.priceBasis||'',regularCloseSource:context.regularCloseSource||''
  });
}
function portfolioHeatmapTooltipRow(label,value,{current=false,valueClass=''}={}){
  if(value==null||value==='')return '';
  return `<div class="tt-row portfolio-heatmap-tooltip-row${current?' is-current-mode':''}"><span class="tt-name">${escapeHtml(label)}</span><span class="tt-val${valueClass?` ${valueClass}`:''}">${escapeHtml(value)}</span></div>`;
}
function portfolioHeatmapTooltipHtml(row){
  if(!row)return '';
  const mode=portfolioHeatmapState.mode;
  const sourceInfo=portfolioHeatmapPriceSource(row);
  const dayText=row.dayChange!=null||row.dayRate!=null
    ?`${row.dayChange==null?'-':heatmapAmountText(row.dayChange,{signedValue:true})} (${heatmapRateText(row.dayRate)})`
    :null;
  const cumulativeText=row.cumulativePnl!=null||row.cumulativeRate!=null
    ?`${row.cumulativePnl==null?'-':heatmapAmountText(row.cumulativePnl,{signedValue:true})} (${heatmapRateText(row.cumulativeRate)})`
    :null;
  const sourceText=[sourceInfo.state,sourceInfo.source].filter(Boolean).join(' / ');
  return `<div class="tt-date">${escapeHtml(row.name||row.ticker||'종목')}${row.ticker?` · ${escapeHtml(row.ticker)}`:''}</div>
    ${portfolioHeatmapTooltipRow('현재가',row.price==null?null:won(row.price))}
    ${portfolioHeatmapTooltipRow('보유수량',row.qty==null?null:`${fmt(row.qty)}주`)}
    ${portfolioHeatmapTooltipRow('평균단가',row.avgPrice==null?null:won(row.avgPrice))}
    ${portfolioHeatmapTooltipRow('매수원금',row.cost==null?null:won(row.cost))}
    ${portfolioHeatmapTooltipRow('평가금액',row.evalAmount==null?null:won(row.evalAmount))}
    ${portfolioHeatmapTooltipRow('포트폴리오',row.weight==null?null:heatmapRateText(row.weight,{signedValue:false}),{current:mode==='weight'})}
    <div class="tt-divider"></div>
    ${portfolioHeatmapTooltipRow('당일손익',dayText,{current:mode==='day'})}
    ${portfolioHeatmapTooltipRow('누적손익',cumulativeText,{current:mode==='cumulative'})}
    ${sourceText?'<div class="tt-divider"></div>':''}
    ${portfolioHeatmapTooltipRow('가격기준',sourceText)}
    ${portfolioHeatmapTooltipRow('시세시각',sourceInfo.observedAt||'')}`;
}

// [HEATMAP06] Visualization Rendering
function renderPortfolioHeatmapModeSelector(){
  return `<div class="control-tab-group portfolio-heatmap-mode-tabs" role="group" aria-label="히트맵 표시 기준">${Object.entries(PORTFOLIO_HEATMAP_MODES).map(([mode,label])=>{
    const active=portfolioHeatmapState.mode===mode;
    return `<button type="button" class="control-tab portfolio-heatmap-mode-tab${active?' active':''}" data-dashboard-action="${PORTFOLIO_HEATMAP_ACTION.setMode}" data-heatmap-mode="${mode}" aria-pressed="${active?'true':'false'}">${label}</button>`;
  }).join('')}</div>`;
}
function renderPortfolioHeatmapModal(){
  const modal=document.getElementById('portfolioHeatmapModal');
  if(!modal)return;
  const activeDate=String(portfolioHeatmapState.context?.date||dataState.activeDate||'');
  const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(activeDate)?shortDate(activeDate):activeDate;
  modal.innerHTML=`<div class="action-modal-card portfolio-heatmap-card" role="dialog" aria-modal="true" aria-labelledby="portfolioHeatmapTitle">
    <button type="button" class="control-icon-button modal-icon-btn portfolio-heatmap-close" data-dashboard-action="${PORTFOLIO_HEATMAP_ACTION.close}" aria-label="포트폴리오 히트맵 닫기">${navIconSvg('close')}</button>
    <div class="portfolio-heatmap-head">
      <div class="portfolio-heatmap-title-block">
        <h3 id="portfolioHeatmapTitle" class="modal-main-title">포트폴리오 히트맵</h3>
        <p class="portfolio-heatmap-date">${escapeHtml(dateLabel)}</p>
      </div>
      ${renderPortfolioHeatmapModeSelector()}
    </div>
    <div class="portfolio-heatmap-stage">
      <div class="portfolio-heatmap__canvas" role="group" aria-label="포트폴리오 히트맵 시각화 영역"></div>
      <div class="portfolio-heatmap__legend" aria-label="히트맵 색상 범례"></div>
    </div>
  </div>`;
}
function portfolioHeatmapToneVariable(direction){
  if(direction==='positive')return 'var(--heatmap-pos-base)';
  if(direction==='negative')return 'var(--heatmap-neg-base)';
  if(direction==='weight')return 'var(--heatmap-weight-base)';
  return 'var(--heatmap-neutral-base)';
}
function portfolioHeatmapColorStyle(state){
  return `--heatmap-tone:${portfolioHeatmapToneVariable(state.direction)};--heatmap-intensity:${state.intensity.toFixed(2)}%`;
}
function portfolioHeatmapTileContent(row,density,mode){
  if(density==='tiny')return '';
  const name=`<span class="portfolio-heatmap__name">${escapeHtml(row.name||row.ticker||'')}</span>`;
  if(density==='small')return name;
  const primary=`<strong class="portfolio-heatmap__primary">${escapeHtml(portfolioHeatmapPrimaryText(row,mode))}</strong>`;
  if(density==='medium')return `${name}${primary}`;
  return `${name}${primary}<span class="portfolio-heatmap__secondary">${escapeHtml(portfolioHeatmapSecondaryText(row,mode))}</span>`;
}
function renderPortfolioHeatmapTile(row,index){
  const mode=portfolioHeatmapState.mode;
  const density=portfolioHeatmapTileDensity(row.rect);
  const color=portfolioHeatmapColorState(row,mode);
  const rect=row.rect;
  return `<button type="button" class="portfolio-heatmap__tile is-${density} is-${color.direction}${color.kind==='unavailable'?' is-unavailable':''}" data-heatmap-tile data-heatmap-index="${index}" aria-describedby="${PORTFOLIO_HEATMAP_TOOLTIP_ID}" aria-label="${escapeHtml(portfolioHeatmapTileAriaLabel(row,mode))}" style="left:${rect.x.toFixed(3)}px;top:${rect.y.toFixed(3)}px;width:${rect.width.toFixed(3)}px;height:${rect.height.toFixed(3)}px;${portfolioHeatmapColorStyle(color)}">${portfolioHeatmapTileContent(row,density,mode)}</button>`;
}
function portfolioHeatmapLegendColor(value,mode){
  const row=mode==='cumulative'?{cumulativeRate:value}:{dayRate:value};
  return portfolioHeatmapColorStyle(portfolioHeatmapColorState(row,mode));
}
function renderPortfolioHeatmapLegend(){
  const mode=portfolioHeatmapState.mode;
  if(mode==='weight')return `<span class="portfolio-heatmap__legend-note"><span class="portfolio-heatmap__legend-neutral" aria-hidden="true"></span>면적 = 평가금액 비중</span>`;
  const values=mode==='cumulative'?[-30,-20,-10,0,10,20,30]:[-3,-2,-1,0,1,2,3];
  return values.map(value=>`<span class="portfolio-heatmap__legend-item"><span class="portfolio-heatmap__legend-swatch" style="${portfolioHeatmapLegendColor(value,mode)}" aria-hidden="true"></span><span>${value>0?'+':''}${value}%</span></span>`).join('');
}
function renderPortfolioHeatmapVisualization({forceLayout=false}={}){
  const modal=document.getElementById('portfolioHeatmapModal');
  const canvas=modal?.querySelector('.portfolio-heatmap__canvas');
  const legend=modal?.querySelector('.portfolio-heatmap__legend');
  if(!canvas||!legend)return;
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!(width>0&&height>0))return;
  if(forceLayout||width!==portfolioHeatmapState.layoutWidth||height!==portfolioHeatmapState.layoutHeight||portfolioHeatmapState.layoutRows.length!==portfolioHeatmapState.rows.length){
    portfolioHeatmapState.layoutRows=layoutPortfolioHeatmap(portfolioHeatmapState.rows,width,height);
    portfolioHeatmapState.layoutWidth=width;
    portfolioHeatmapState.layoutHeight=height;
  }
  if(!portfolioHeatmapState.layoutRows.length){
    canvas.innerHTML='<div class="portfolio-heatmap__empty">표시할 보유종목이 없습니다.</div>';
  }else{
    canvas.innerHTML=portfolioHeatmapState.layoutRows.map(renderPortfolioHeatmapTile).join('');
  }
  legend.innerHTML=renderPortfolioHeatmapLegend();
}
function syncPortfolioHeatmapModeControls(){
  const modal=document.getElementById('portfolioHeatmapModal');
  if(!modal)return;
  modal.querySelectorAll('[data-heatmap-mode]').forEach(button=>{
    const active=button.dataset.heatmapMode===portfolioHeatmapState.mode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
}

// [HEATMAP07] Tooltip / Interaction
function ensurePortfolioHeatmapTooltip(){
  const modal=document.getElementById('portfolioHeatmapModal');
  if(!modal)return null;
  let tooltip=document.getElementById(PORTFOLIO_HEATMAP_TOOLTIP_ID);
  if(tooltip){
    if(tooltip.parentElement!==modal)modal.appendChild(tooltip);
    return tooltip;
  }
  tooltip=document.createElement('div');
  tooltip.id=PORTFOLIO_HEATMAP_TOOLTIP_ID;
  tooltip.className='dash-tooltip portfolio-heatmap-tooltip';
  tooltip.setAttribute('role','tooltip');
  tooltip.setAttribute('aria-hidden','true');
  modal.appendChild(tooltip);
  return tooltip;
}
function portfolioHeatmapTileFromEvent(event){
  return event?.target?.closest?.('#portfolioHeatmapModal [data-heatmap-tile]')||null;
}
function portfolioHeatmapRowForTile(tile){
  const index=Number(tile?.dataset?.heatmapIndex);
  return Number.isInteger(index)?portfolioHeatmapState.layoutRows[index]||null:null;
}
function positionPortfolioHeatmapTooltip(tile,event=null){
  const tooltip=ensurePortfolioHeatmapTooltip();
  if(!tooltip)return;
  const rect=tooltip.getBoundingClientRect();
  const tileRect=tile?.getBoundingClientRect?.();
  const viewportWidth=globalThis.innerWidth||document.documentElement.clientWidth||0;
  const viewportHeight=globalThis.innerHeight||document.documentElement.clientHeight||0;
  const gutter=10,gap=10;
  let left=event&&Number.isFinite(event.clientX)?event.clientX+gap:(tileRect?tileRect.left+tileRect.width/2-rect.width/2:gutter);
  let top=event&&Number.isFinite(event.clientY)?event.clientY+gap:(tileRect?tileRect.bottom+gap:gutter);
  left=Math.max(gutter,Math.min(left,Math.max(gutter,viewportWidth-rect.width-gutter)));
  if(top+rect.height>viewportHeight-gutter&&tileRect)top=tileRect.top-rect.height-gap;
  top=Math.max(gutter,Math.min(top,Math.max(gutter,viewportHeight-rect.height-gutter)));
  tooltip.style.left=`${Math.round(left)}px`;
  tooltip.style.top=`${Math.round(top)}px`;
}
function showPortfolioHeatmapTooltip(tile,event=null,{pinned=false}={}){
  const row=portfolioHeatmapRowForTile(tile);
  if(!row)return;
  const tooltip=ensurePortfolioHeatmapTooltip();
  if(!tooltip)return;
  tooltip.innerHTML=portfolioHeatmapTooltipHtml(row);
  tooltip.setAttribute('aria-hidden','false');
  tooltip.classList.add('visible');
  if(pinned)portfolioHeatmapState.pinnedIndex=Number(tile.dataset.heatmapIndex);
  positionPortfolioHeatmapTooltip(tile,event);
}
function hidePortfolioHeatmapTooltip({clearPinned=true}={}){
  const tooltip=document.getElementById(PORTFOLIO_HEATMAP_TOOLTIP_ID);
  if(tooltip){
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden','true');
  }
  if(clearPinned)portfolioHeatmapState.pinnedIndex=null;
}
function schedulePortfolioHeatmapResize(){
  hidePortfolioHeatmapTooltip();
  const modal=document.getElementById('portfolioHeatmapModal');
  if(!modal?.classList.contains('show'))return;
  if(portfolioHeatmapState.resizeFrame)return;
  portfolioHeatmapState.resizeFrame=requestAnimationFrame(()=>{
    portfolioHeatmapState.resizeFrame=0;
    renderPortfolioHeatmapVisualization({forceLayout:true});
  });
}
function bindPortfolioHeatmapInteractions(){
  if(portfolioHeatmapInteractionsBound)return;
  portfolioHeatmapInteractionsBound=true;
  document.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const tile=portfolioHeatmapTileFromEvent(event);
    if(!tile||tile.contains(event.relatedTarget))return;
    portfolioHeatmapState.pinnedIndex=null;
    showPortfolioHeatmapTooltip(tile,event);
  });
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||portfolioHeatmapState.pinnedIndex!=null)return;
    const tile=portfolioHeatmapTileFromEvent(event);
    if(tile)positionPortfolioHeatmapTooltip(tile,event);
  },{passive:true});
  document.addEventListener('pointerout',event=>{
    if(event.pointerType==='touch'||portfolioHeatmapState.pinnedIndex!=null)return;
    const tile=portfolioHeatmapTileFromEvent(event);
    if(!tile||tile.contains(event.relatedTarget))return;
    hidePortfolioHeatmapTooltip({clearPinned:false});
  });
  document.addEventListener('focusin',event=>{
    const tile=portfolioHeatmapTileFromEvent(event);
    if(tile)showPortfolioHeatmapTooltip(tile,null);
  });
  document.addEventListener('focusout',event=>{
    const tile=portfolioHeatmapTileFromEvent(event);
    if(tile&&!tile.contains(event.relatedTarget)&&portfolioHeatmapState.pinnedIndex==null)hidePortfolioHeatmapTooltip({clearPinned:false});
  });
  document.addEventListener('pointerup',event=>{
    if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;
    const tile=portfolioHeatmapTileFromEvent(event);
    if(!tile)return;
    const index=Number(tile.dataset.heatmapIndex);
    if(portfolioHeatmapState.pinnedIndex===index){
      hidePortfolioHeatmapTooltip();
      return;
    }
    showPortfolioHeatmapTooltip(tile,null,{pinned:true});
  });
  document.addEventListener('pointerdown',event=>{
    if(portfolioHeatmapState.pinnedIndex==null)return;
    if(portfolioHeatmapTileFromEvent(event))return;
    hidePortfolioHeatmapTooltip();
  });
  document.addEventListener('scroll',()=>hidePortfolioHeatmapTooltip(),true);
  globalThis.addEventListener?.('resize',schedulePortfolioHeatmapResize,{passive:true});
}

// [HEATMAP08] Modal Lifecycle · 공통 dashboard-modal lifecycle 재사용
function ensurePortfolioHeatmapModal(){
  let modal=document.getElementById('portfolioHeatmapModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='portfolioHeatmapModal';
  modal.className='action-modal portfolio-heatmap-modal';
  modal.setAttribute('aria-hidden','true');
  bindDashboardModalDismiss(modal,{onDismiss:closePortfolioHeatmap,stopEscapePropagation:false});
  document.body.appendChild(modal);
  bindPortfolioHeatmapInteractions();
  return modal;
}
function openPortfolioHeatmap(returnFocus=null,calcResult=null){
  const modal=ensurePortfolioHeatmapModal();
  portfolioHeatmapState.rows=createPortfolioHeatmapViewModelFromCalc(calcResult||{});
  portfolioHeatmapState.context=portfolioHeatmapContextFromCalc(calcResult||{});
  portfolioHeatmapState.layoutRows=[];
  portfolioHeatmapState.layoutWidth=0;
  portfolioHeatmapState.layoutHeight=0;
  portfolioHeatmapState.pinnedIndex=null;
  renderPortfolioHeatmapModal();
  ensurePortfolioHeatmapTooltip();
  openDashboardModal(modal,{
    initialFocus:modal.querySelector(`[data-heatmap-mode="${portfolioHeatmapState.mode}"]`)||modal.querySelector('[data-dashboard-action="close-portfolio-heatmap"]'),
    returnFocus,
    fallbackSelector:portfolioHeatmapFocusFallbackSelector()
  });
  requestAnimationFrame(()=>renderPortfolioHeatmapVisualization({forceLayout:true}));
}
function closePortfolioHeatmap(){
  const modal=document.getElementById('portfolioHeatmapModal');
  if(!modal)return;
  hidePortfolioHeatmapTooltip();
  if(portfolioHeatmapState.resizeFrame){
    cancelAnimationFrame(portfolioHeatmapState.resizeFrame);
    portfolioHeatmapState.resizeFrame=0;
  }
  closeDashboardModal(modal,{fallbackSelector:portfolioHeatmapFocusFallbackSelector()});
}
function portfolioHeatmapIsOpen(){
  return document.getElementById('portfolioHeatmapModal')?.classList.contains('show')===true;
}
function refreshPortfolioHeatmap(calcResult){
  if(!portfolioHeatmapIsOpen())return false;
  const modal=document.getElementById('portfolioHeatmapModal');
  const activeTile=document.activeElement?.closest?.('#portfolioHeatmapModal [data-heatmap-tile]')||null;
  const activeKey=heatmapStableKey(portfolioHeatmapRowForTile(activeTile));
  const pinnedRow=Number.isInteger(portfolioHeatmapState.pinnedIndex)
    ?portfolioHeatmapState.layoutRows[portfolioHeatmapState.pinnedIndex]||null
    :null;
  const pinnedKey=heatmapStableKey(pinnedRow);

  hidePortfolioHeatmapTooltip({clearPinned:false});
  portfolioHeatmapState.rows=createPortfolioHeatmapViewModelFromCalc(calcResult||{});
  portfolioHeatmapState.context=portfolioHeatmapContextFromCalc(calcResult||{});
  portfolioHeatmapState.layoutRows=[];
  portfolioHeatmapState.layoutWidth=0;
  portfolioHeatmapState.layoutHeight=0;
  renderPortfolioHeatmapVisualization({forceLayout:true});

  if(activeTile){
    const nextIndex=portfolioHeatmapState.layoutRows.findIndex(row=>heatmapStableKey(row)===activeKey);
    const nextFocus=nextIndex>=0
      ?modal?.querySelector(`[data-heatmap-index="${nextIndex}"]`)
      :modal?.querySelector(`[data-heatmap-mode="${portfolioHeatmapState.mode}"]`);
    nextFocus?.focus?.({preventScroll:true});
  }
  if(pinnedKey){
    const nextPinnedIndex=portfolioHeatmapState.layoutRows.findIndex(row=>heatmapStableKey(row)===pinnedKey);
    const nextPinnedTile=nextPinnedIndex>=0?modal?.querySelector(`[data-heatmap-index="${nextPinnedIndex}"]`):null;
    if(nextPinnedTile)showPortfolioHeatmapTooltip(nextPinnedTile,null,{pinned:true});
    else portfolioHeatmapState.pinnedIndex=null;
  }else{
    portfolioHeatmapState.pinnedIndex=null;
  }
  return true;
}
function setPortfolioHeatmapMode(mode){
  if(!PORTFOLIO_HEATMAP_MODES[mode]||portfolioHeatmapState.mode===mode)return;
  portfolioHeatmapState.mode=mode;
  hidePortfolioHeatmapTooltip();
  syncPortfolioHeatmapModeControls();
  renderPortfolioHeatmapVisualization();
}

// [HEATMAP09] Public API
export {
  PORTFOLIO_HEATMAP_ACTION,
  PORTFOLIO_HEATMAP_MODES,
  closePortfolioHeatmap,
  comparePortfolioHeatmapRows,
  createPortfolioHeatmapViewModel,
  createPortfolioHeatmapViewModelFromCalc,
  layoutPortfolioHeatmap,
  openPortfolioHeatmap,
  portfolioHeatmapColorState,
  portfolioHeatmapIsOpen,
  portfolioHeatmapModeMetric,
  portfolioHeatmapTileDensity,
  refreshPortfolioHeatmap,
  setPortfolioHeatmapMode
};
