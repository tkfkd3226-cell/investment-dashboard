import { dataState, shortDate } from './dashboard-core.js';
import { escapeHtml, navIconSvg } from './dashboard-ui-common.js';
import {
  bindDashboardModalDismiss,
  closeDashboardModal,
  openDashboardModal
} from './dashboard-modal.js';

// Portfolio Heatmap · 2차 pure data/layout engine + 1차 shell
// Ownership: canonical securities 결과를 읽는 View Model, deterministic treemap geometry, mode metric, modal shell/state.
// 가격 fetch/평가 재계산/Market AI 요청/polling/main render orchestration은 소유하지 않는다.
// Structure map:
//   [HEATMAP01] Constants / State
//   [HEATMAP02] Pure View Model
//   [HEATMAP03] Pure Treemap Engine
//   [HEATMAP04] Pure Mode Metrics
//   [HEATMAP05] Shell Rendering
//   [HEATMAP06] Modal Lifecycle
//   [HEATMAP07] Public API

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
const portfolioHeatmapState={mode:'day'};

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
    const evalAmount=finiteHeatmapNumber(holding?.evalAmount,NaN);
    if(!(evalAmount>0))return result;
    const change=portfolioHeatmapChangeForHolding(changes,holding);
    const cumulativePnl=firstFiniteHeatmapNumber([holding?.totalProfit,holding?.profit],0);
    const cumulativeRate=finiteHeatmapNumber(holding?.returnRate,null);
    result.push({
      ticker:String(holding?.ticker||''),
      name:String(holding?.name||holding?.ticker||''),
      type:String(holding?.type||''),
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
      priceSource:holding?.priceSource==null?'':String(holding.priceSource),
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

// [HEATMAP04] Pure Mode Metrics · formatter/color token은 3차 renderer 책임이다.
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

// [HEATMAP05] Shell Rendering · 실제 tile DOM/color/tooltip은 3차에서 연결한다.
function renderPortfolioHeatmapModeSelector(){
  return `<div class="control-tab-group portfolio-heatmap-mode-tabs" role="group" aria-label="히트맵 표시 기준">${Object.entries(PORTFOLIO_HEATMAP_MODES).map(([mode,label])=>{
    const active=portfolioHeatmapState.mode===mode;
    return `<button type="button" class="control-tab portfolio-heatmap-mode-tab${active?' active':''}" data-dashboard-action="${PORTFOLIO_HEATMAP_ACTION.setMode}" data-heatmap-mode="${mode}" aria-pressed="${active?'true':'false'}">${label}</button>`;
  }).join('')}</div>`;
}
function renderPortfolioHeatmapModal(){
  const modal=document.getElementById('portfolioHeatmapModal');
  if(!modal)return;
  const activeDate=String(dataState.activeDate||'');
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
    <div class="portfolio-heatmap__canvas portfolio-heatmap__placeholder" aria-label="포트폴리오 히트맵 시각화 영역">
      <strong>포트폴리오 히트맵</strong>
      <span>2차 데이터·treemap 엔진 준비 완료 · 3차에서 실제 시각화를 연결합니다.</span>
    </div>
  </div>`;
}

// [HEATMAP06] Modal Lifecycle · 공통 dashboard-modal lifecycle 재사용
function ensurePortfolioHeatmapModal(){
  let modal=document.getElementById('portfolioHeatmapModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='portfolioHeatmapModal';
  modal.className='action-modal portfolio-heatmap-modal';
  modal.setAttribute('aria-hidden','true');
  bindDashboardModalDismiss(modal,{onDismiss:closePortfolioHeatmap,stopEscapePropagation:false});
  document.body.appendChild(modal);
  return modal;
}
function openPortfolioHeatmap(returnFocus=null){
  const modal=ensurePortfolioHeatmapModal();
  renderPortfolioHeatmapModal();
  openDashboardModal(modal,{
    initialFocus:modal.querySelector(`[data-heatmap-mode="${portfolioHeatmapState.mode}"]`)||modal.querySelector('[data-dashboard-action="close-portfolio-heatmap"]'),
    returnFocus,
    fallbackSelector:portfolioHeatmapFocusFallbackSelector()
  });
}
function closePortfolioHeatmap(){
  const modal=document.getElementById('portfolioHeatmapModal');
  if(!modal)return;
  closeDashboardModal(modal,{fallbackSelector:portfolioHeatmapFocusFallbackSelector()});
}
function setPortfolioHeatmapMode(mode){
  if(!PORTFOLIO_HEATMAP_MODES[mode]||portfolioHeatmapState.mode===mode)return;
  portfolioHeatmapState.mode=mode;
  renderPortfolioHeatmapModal();
  requestAnimationFrame(()=>{
    document.querySelector(`#portfolioHeatmapModal [data-heatmap-mode="${mode}"]`)?.focus?.({preventScroll:true});
  });
}

// [HEATMAP07] Public API
export {
  PORTFOLIO_HEATMAP_ACTION,
  PORTFOLIO_HEATMAP_MODES,
  closePortfolioHeatmap,
  comparePortfolioHeatmapRows,
  createPortfolioHeatmapViewModel,
  createPortfolioHeatmapViewModelFromCalc,
  layoutPortfolioHeatmap,
  openPortfolioHeatmap,
  portfolioHeatmapModeMetric,
  setPortfolioHeatmapMode
};
