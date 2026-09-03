import {
  ASSET_TYPE_COLORS,
  CASH_ASSET_COLOR,
  SECURITY_SYMBOL_COLORS,
  allocHistory,
  allAvailableDates,
  assetTypeColor,
  calc,
  cls,
  cumHistory,
  dataState,
  fmt,
  formatKospi,
  hasPensionData,
  kospiIndexForDate,
  pct,
  pensionSeriesColor,
  securityAllocOneShareEval,
  securityAllocTypeTotals,
  securityAllocVisibleHoldings,
  securityAllocationColor,
  securityChartNamesForDate,
  securitySymbolAllocHistory,
  separateProfitCumulativeForDate,
  separateProfitReinvestedForDate,
  signed,
  snapshotDates,
  sortPensionItems,
  sortSecurityAllocationItems,
  sortSecurityChartItems,
  symbolHistory,
  uiState,
  won
} from './dashboard-core.js';
import {
  assetColorSwatch,
  chartSeriesSwatch,
  escapeHtml,
  navIconSvg,
  phoneLandscapeUi,
  phoneUi
} from './dashboard-ui-common.js';
import {
  activateDashboardDialogFocus,
  bindDashboardModalDismiss,
  releaseDashboardDialogFocus
} from './dashboard-modal.js';

// Dashboard Charts · chart state / SVG rendering / responsive controls / expanded view
// Structure map:
//   [CHART01] Layout / Sizing Primitives
//   [CHART02] Expanded View / Responsive Controls
//   [CHART03] Responsive Controls / Entrance Motion
//   [CHART04] Scroll State / Hints
//   [CHART05] Series State / Legend Controls
//   [CHART06] Chart Data / Card Rendering
//   [CHART07] SVG Core / Tooltip Infrastructure
//   [CHART08] Global Events / Action Routing
//   [CHART09] Tooltip Rows / Axes / Hover Geometry
//   [CHART10] Chart Drawing / Refresh
//   [CHART11] Public API

// [CHART01] Layout / Sizing Primitives · 차트 레이아웃 / 크기 primitive
const CHART_FRAME=Object.freeze({left:70,right:70,top:20,bottom:70});
const CHART_EDGE_PAD=24;
const CHART_VIEWBOX_BASE=Object.freeze({width:1120,height:330});
const CHART_EXPANDED_VISUAL_GROWTH=.5;

function chartSvgLayoutSize(svg){
  const clientWidth=Number(svg?.clientWidth),clientHeight=Number(svg?.clientHeight);
  if(clientWidth>0&&clientHeight>0)return {width:clientWidth,height:clientHeight};
  const computed=svg&&typeof window!=='undefined'?window.getComputedStyle?.(svg):null;
  const computedWidth=Number.parseFloat(computed?.width),computedHeight=Number.parseFloat(computed?.height);
  if(computedWidth>0&&computedHeight>0)return {width:computedWidth,height:computedHeight};
  const rect=svg?.getBoundingClientRect?.();
  return {width:Number(rect?.width)||0,height:Number(rect?.height)||0};
}
function chartViewBoxSize(svg){
  const h=CHART_VIEWBOX_BASE.height;
  if(chartRuntimeState.printFixedViewBox)return {w:CHART_VIEWBOX_BASE.width,h};
  const {width:cssWidth,height:cssHeight}=chartSvgLayoutSize(svg);
  if(!(cssWidth>0&&cssHeight>0))return {w:CHART_VIEWBOX_BASE.width,h};
  const minWidth=CHART_FRAME.left+CHART_FRAME.right+1;
  return {w:Math.max(minWidth,Math.round(h*cssWidth/cssHeight)),h};
}
function chartExpandedFrameUnits(svg,baseUnits,safetyPx=0){
  const baseline=expandedChartVisualBaseline(svg);
  if(!baseline||!phoneUi())return baseUnits;
  const currentScale=chartSvgDisplayScale(svg);
  if(!(currentScale>0))return baseUnits;
  const targetUnits=(baseUnits*baseline.scale+safetyPx)/currentScale;
  return Math.max(baseUnits,targetUnits);
}
function chartConfig(svg,edgePad=CHART_EDGE_PAD){
  const {w,h}=chartViewBoxSize(svg),{right:r,top:t}=CHART_FRAME;
  const l=chartExpandedFrameUnits(svg,CHART_FRAME.left,4),b=chartExpandedFrameUnits(svg,CHART_FRAME.bottom);
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  return {w,h,l,r,t,b,plotW:w-l-r,plotH:h-t-b,edgePad};
}
function chartY(cfg,min,max,value){
  return cfg.t+(max-value)/(max-min)*cfg.plotH;
}
function chartSvgDisplayScale(svg){
  const {height:cssHeight}=chartSvgLayoutSize(svg),viewH=Number(svg?.viewBox?.baseVal?.height||CHART_VIEWBOX_BASE.height);
  return cssHeight>0&&viewH>0?cssHeight/viewH:1;
}
function expandedChartVisualBaseline(svg){
  const expanded=chartRuntimeState.expanded;
  return expanded?.svg===svg?expanded.visualBaseline:null;
}
function chartExpandedFixedUnits(svg,baseUnits){
  const baseline=expandedChartVisualBaseline(svg);
  if(!baseline)return baseUnits;
  const currentScale=chartSvgDisplayScale(svg);
  return currentScale>0?baseUnits*baseline.scale/currentScale:baseUnits;
}
function chartExpandedHalfGrowthUnits(svg,currentUnits,normalUnits=currentUnits){
  const baseline=expandedChartVisualBaseline(svg);
  if(!baseline)return currentUnits;
  const currentScale=chartSvgDisplayScale(svg);
  if(!(currentScale>0))return currentUnits;
  const normalPx=normalUnits*baseline.scale,currentPx=currentUnits*currentScale;
  return (normalPx+(currentPx-normalPx)*CHART_EXPANDED_VISUAL_GROWTH)/currentScale;
}
function chartBarWidth(svg,cfg,n,ratio,minWidth=0){
  const count=Math.max(1,n),current=Math.max(minWidth,cfg.plotW/count*ratio),baseline=expandedChartVisualBaseline(svg);
  if(!baseline)return current;
  const normal=Math.max(minWidth,baseline.plotW/count*ratio);
  return chartExpandedHalfGrowthUnits(svg,current,normal);
}
function chartViewBoxNeedsRedraw(){
  if(chartRuntimeState.expanded)return false;
  return [...document.querySelectorAll('svg.chart')].some(svg=>{
    const current=Number(svg.viewBox?.baseVal?.width||0),next=chartViewBoxSize(svg).w;
    return current>0&&Math.abs(current-next)>1;
  });
}

// [CHART02] Expanded View / Responsive Controls · 확대 / 반응형 컨트롤
const chartRuntimeState={
  entranceObserver:null,
  expandedViewportBound:false,
  responsiveControlsBound:false,
  entrancePhoneLandscapeBound:false,
  skipEntranceOnce:false,
  securitiesCumTransitionSuppressionPending:false,
  printFixedViewBox:false,
  expanded:null
};
const chartState={
  compareModes:{securities:'return',pension:'return'},
  symbolModes:{securities:'profit',pension:'profit'},
  securityAllocMode:'type',
  series:{
    securitiesCum:{selected:null,autoY:false},
    pensionCum:{selected:null,autoY:false},
    securitiesSymbol:{selected:null,autoY:false},
    pensionSymbol:{selected:null,autoY:false},
    'securitiesAlloc:type':{selected:null,autoY:false},
    'securitiesAlloc:symbol':{selected:null,autoY:false},
    pensionAlloc:{selected:null,autoY:false}
  }
};

function suppressChartEntranceOnce(){
  chartRuntimeState.skipEntranceOnce=true;
}
function requestSecuritiesCumCardTransitionSuppression(){
  chartRuntimeState.securitiesCumTransitionSuppressionPending=true;
}
function applySecuritiesCumCardTransitionSuppression(){
  if(!chartRuntimeState.securitiesCumTransitionSuppressionPending)return;
  chartRuntimeState.securitiesCumTransitionSuppressionPending=false;
  const card=document.getElementById('chart-cum');
  if(!card)return;
  const nodes=[card,...card.querySelectorAll('.mini-card')];
  nodes.forEach(node=>node.classList.add('transition-suppressed-once'));
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    nodes.forEach(node=>node.classList.remove('transition-suppressed-once'));
  }));
}
function isExpandedChart(cardId=''){
  const expanded=chartRuntimeState.expanded;
  return !!expanded&&(!cardId||expanded.cardId===cardId);
}
function setExpandedChartAfterClose(cardId,callback){
  const expanded=chartRuntimeState.expanded;
  if(!expanded||expanded.cardId!==cardId)return false;
  expanded.afterClose=typeof callback==='function'?callback:null;
  return true;
}
function syncExpandedSeparateProfitControl(){
  const enabled=uiState.includeSeparateProfit;
  document.querySelectorAll('.separate-profit-toggle').forEach(toggle=>{
    toggle.classList.toggle('active',enabled);
    toggle.setAttribute('aria-pressed',String(enabled));
    const state=toggle.querySelector('strong');
    if(state)state.textContent=enabled?'ON':'OFF';
  });
  const expandedControl=document.querySelector('.expanded-separate-profit-control');
  const note=expandedControl?.querySelector('.separate-profit-control-note');
  if(!enabled){
    note?.remove();
    return;
  }
  const noteText=`선택일 ${signed(separateProfitCumulativeForDate(dataState.activeDate),'원')}`;
  if(note){
    note.textContent=noteText;
    return;
  }
  if(expandedControl){
    const span=document.createElement('span');
    span.className='separate-profit-control-note';
    span.textContent=noteText;
    expandedControl.prepend(span);
  }
}
function refreshExpandedSeparateProfitChart(afterClose){
  if(!isExpandedChart('chart-cum'))return false;
  syncExpandedSeparateProfitControl();
  drawCumChart();
  setExpandedChartAfterClose('chart-cum',afterClose);
  return true;
}

function chartExpandIcon(){
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"></path><path d="M9 9 3 3M15 9l6-6M15 15l6 6M9 15l-6 6"></path></svg>`;
}
function chartWebExpandButton(){
  return `<button type="button" class="control-square-button chart-expand-control chart-web-expand-button" aria-label="차트를 전체화면으로 확대" title="전체화면" data-dashboard-action="open-expanded-chart">${chartExpandIcon()}</button>`;
}
function chartScrollButton(){
  return `<div class="chart-scroll-row"><button type="button" class="control-square-button chart-scroll-start" aria-label="차트를 왼쪽 끝으로 이동" title="왼쪽 끝으로 이동" data-dashboard-action="scroll-chart-start">${navIconSvg('arrowLeft')}</button><button type="button" class="control-square-button chart-scroll-end" aria-label="차트를 오른쪽 끝으로 이동" title="오른쪽 끝으로 이동" data-dashboard-action="scroll-chart-end">${navIconSvg('arrowRight')}</button><button type="button" class="control-square-button chart-expand-control chart-expand-button" aria-label="차트를 가로 전체화면으로 확대" title="가로 전체화면" data-dashboard-action="open-expanded-chart">${chartExpandIcon()}</button></div>`;
}
function chartTitleInfoButton(text){
  const safe=escapeHtml(text);
  return `<button type="button" class="control-info-button chart-title-info" aria-label="${safe} 설명" aria-expanded="false" data-dashboard-action="toggle-chart-title-info"><span aria-hidden="true">i</span><span class="chart-title-info-tooltip" role="tooltip">${safe}</span></button>`;
}
function closeChartTitleInfo(except=null){
  document.querySelectorAll('.chart-title-info.open').forEach(button=>{
    if(button===except)return;
    button.classList.remove('open');
    button.setAttribute('aria-expanded','false');
  });
}
function toggleChartTitleInfo(event,button){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if(!button)return;
  const open=!button.classList.contains('open');
  closeChartTitleInfo(button);
  button.classList.toggle('open',open);
  button.setAttribute('aria-expanded',String(open));
}
function portraitPhoneChartFlow(){
  return window.matchMedia?.('(max-width:760px)').matches===true&&!phoneLandscapeUi();
}
function chartDisplayLabel(scope,label){
  const compact=phoneUi();
  const symbolScope=scope==='pensionSymbol'||scope==='pensionAlloc'||scope==='securitiesSymbol'||(scope==='securitiesAlloc'&&chartState.securityAllocMode==='symbol');
  return compact&&symbolScope?String(label||'').replace(/^KODEX\s+/i,''):String(label||'');
}
function chartScrollToWrap(button){
  return button?.closest('.chart-card')?.querySelector('.chart-wrap')||null;
}
function scrollChartToStart(button){
  const wrap=chartScrollToWrap(button);
  if(!wrap)return;
  wrap.scrollTo({left:0,behavior:'smooth'});
}
function scrollChartToEnd(button){
  const wrap=chartScrollToWrap(button);
  if(!wrap)return;
  wrap.scrollTo({left:Math.max(0,wrap.scrollWidth-wrap.clientWidth),behavior:'smooth'});
}
function expandedChartLandscapeViewport(){
  return window.matchMedia?.('(orientation: landscape)').matches===true;
}
function syncExpandedChartViewport(){
  const overlay=document.querySelector('.chart-expanded-overlay');
  if(!overlay)return;
  overlay.style.setProperty('--chart-expanded-vw',`${window.innerWidth}px`);
  overlay.style.setProperty('--chart-expanded-vh',`${window.innerHeight}px`);
  overlay.classList.toggle('device-landscape',expandedChartLandscapeViewport());
  overlay.classList.toggle('compact-chart-ui',phoneUi());
}
function openExpandedChart(button){
  const opener=button||null;
  const card=button?.closest('.chart-card');
  const wrap=card?.querySelector('.chart-wrap');
  const svg=wrap?.querySelector('svg.chart');
  if(!card||!wrap||!svg)return;
  closeExpandedChart();
  clearChartHover();
  const originalScrollLeft=wrap.scrollLeft;
  const normalViewW=Number(svg.viewBox?.baseVal?.width||CHART_VIEWBOX_BASE.width);
  const visualBaseline={scale:chartSvgDisplayScale(svg),plotW:Math.max(0,normalViewW-CHART_FRAME.left-CHART_FRAME.right)};
  const placeholder=document.createComment('expanded-chart-placeholder');
  svg.parentNode.insertBefore(placeholder,svg);
  const titleHeading=card.querySelector('.chart-head h3');
  const title=chartAccessibleTitle(svg);
  const controls=card.querySelector('.chart-head-actions');
  let expandedSeparateProfitControl=null;
  if(card.id==='chart-cum'&&controls){
    const sourceSeparateControl=card.querySelector('.chart-head > .separate-profit-control-row');
    if(sourceSeparateControl){
      expandedSeparateProfitControl=sourceSeparateControl.cloneNode(true);
      expandedSeparateProfitControl.classList.add('expanded-separate-profit-control');
      const expandedToggle=expandedSeparateProfitControl.querySelector('.separate-profit-toggle');
      if(expandedToggle){
        expandedToggle.dataset.dashboardAction='toggle-separate-profit-expanded';
        expandedToggle.dataset.expandedChartId=card.id;
      }
      controls.prepend(expandedSeparateProfitControl);
    }
  }
  const controlsPlaceholder=controls?document.createComment('expanded-chart-controls-placeholder'):null;
  if(controls)controls.parentNode.insertBefore(controlsPlaceholder,controls);
  const optionsRow=card.querySelector(':scope > .chart-options-row');
  const optionsPlaceholder=optionsRow?document.createComment('expanded-chart-options-placeholder'):null;
  if(optionsRow)optionsRow.parentNode.insertBefore(optionsPlaceholder,optionsRow);
  const legend=card.querySelector('.chart-legend');
  const legendPlaceholder=legend?document.createComment('expanded-chart-legend-placeholder'):null;
  if(legend)legend.parentNode.insertBefore(legendPlaceholder,legend);
  const overlay=document.createElement('div');
  overlay.className='chart-expanded-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label',`${title} 확대 보기`);
  overlay.innerHTML=`<div class="chart-expanded-stage"><div class="chart-expanded-head chart-head"><div class="chart-expanded-title"></div><div class="chart-expanded-controls-host"></div></div><div class="chart-expanded-chart-host"></div><div class="chart-expanded-legend-host"></div></div>`;
  const expandedTitle=overlay.querySelector('.chart-expanded-title');
  if(titleHeading&&expandedTitle){
    const clonedTitle=titleHeading.cloneNode(true);
    clonedTitle.removeAttribute('id');
    expandedTitle.appendChild(clonedTitle);
  }else if(expandedTitle){
    expandedTitle.textContent=title;
  }
  const closeButton=document.createElement('button');
  closeButton.type='button';
  closeButton.className='control-square-button chart-expand-control chart-expanded-close';
  closeButton.setAttribute('aria-label','확대 차트 닫기');
  closeButton.title='닫기';
  closeButton.innerHTML=navIconSvg('close');
  if(controls){
    overlay.querySelector('.chart-expanded-controls-host').appendChild(controls);
    controls.appendChild(closeButton);
  }
  overlay.querySelector('.chart-expanded-chart-host').appendChild(svg);
  const expandedLegendHost=overlay.querySelector('.chart-expanded-legend-host');
  if(optionsRow)expandedLegendHost.appendChild(optionsRow);
  if(legend)expandedLegendHost.appendChild(legend);
  document.body.appendChild(overlay);
  document.body.classList.add('chart-expanded-open');
  chartRuntimeState.expanded={overlay,svg,placeholder,wrap,scrollLeft:originalScrollLeft,controls,controlsPlaceholder,closeButton,optionsRow,optionsPlaceholder,legend,legendPlaceholder,expandedSeparateProfitControl,visualBaseline,renderedScale:visualBaseline.scale,cardId:card.id};
  syncExpandedChartViewport();
  bindDashboardModalDismiss(overlay,{onDismiss:closeExpandedChart,backdrop:false,preventEscapeDefault:false,stopEscapePropagation:false});
  closeButton.addEventListener('click',closeExpandedChart,{once:true});
  requestAnimationFrame(()=>{
    redrawChartForCardSize(card.id,{force:true});
    overlay.classList.add('show');
  });
  activateDashboardDialogFocus(overlay,{initialFocus:overlay.querySelector('.chart-expanded-close'),fallbackSelector:`#${card.id} [data-dashboard-action="open-expanded-chart"]`,returnFocus:opener});
}
function closeExpandedChart(){
  const state=chartRuntimeState.expanded;
  if(!state)return;
  clearChartHover();
  chartRuntimeState.expanded=null;
  const {overlay,svg,placeholder,wrap,scrollLeft,controls,controlsPlaceholder,closeButton,optionsRow,optionsPlaceholder,legend,legendPlaceholder,expandedSeparateProfitControl,cardId,afterClose}=state;
  if(placeholder?.parentNode)placeholder.parentNode.insertBefore(svg,placeholder);
  placeholder?.remove();
  expandedSeparateProfitControl?.remove();
  closeButton?.remove();
  if(controls&&controlsPlaceholder?.parentNode)controlsPlaceholder.parentNode.insertBefore(controls,controlsPlaceholder);
  controlsPlaceholder?.remove();
  if(optionsRow&&optionsPlaceholder?.parentNode)optionsPlaceholder.parentNode.insertBefore(optionsRow,optionsPlaceholder);
  optionsPlaceholder?.remove();
  if(legend&&legendPlaceholder?.parentNode)legendPlaceholder.parentNode.insertBefore(legend,legendPlaceholder);
  legendPlaceholder?.remove();
  overlay?.remove();
  document.body.classList.remove('chart-expanded-open');
  syncResponsiveChartControls();
  const restoreFocus=()=>releaseDashboardDialogFocus(overlay,{fallbackSelector:cardId?`#${cardId} [data-dashboard-action="open-expanded-chart"]`:'[data-dashboard-action="open-expanded-chart"]'});
  if(typeof afterClose==='function'){
    afterClose();
    requestAnimationFrame(()=>{
      redrawVisibleChartsForCurrentSize();
      restoreFocus();
    });
    return;
  }
  restoreFocus();
  if(wrap){
    requestAnimationFrame(()=>{
      redrawVisibleChartsForCurrentSize();
      requestAnimationFrame(()=>{
        wrap.scrollLeft=scrollLeft||0;
        if(typeof prepareChartEntranceForSvg==='function')prepareChartEntranceForSvg(svg);
        if(typeof activateChartEntrance==='function')activateChartEntrance(wrap);
      });
    });
  }
}
function setupExpandedChartViewport(){
  if(chartRuntimeState.expandedViewportBound)return;
  chartRuntimeState.expandedViewportBound=true;
  let frame=0;
  const sync=()=>{
    if(!chartRuntimeState.expanded)return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const cardId=chartRuntimeState.expanded?.cardId;
      syncExpandedChartViewport();
      redrawChartForCardSize(cardId);
    });
  };
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});
}
const RESPONSIVE_CHART_SCOPES=[
  {id:'pension-chart-cum',scope:'pensionCum'},
  {id:'chart-cum',scope:'securitiesCum'},
  {id:'pension-chart-symbol',scope:'pensionSymbol'},
  {id:'chart-symbol',scope:'securitiesSymbol'},
  {id:'chart-alloc',scope:'securitiesAlloc'},
  {id:'pension-chart-alloc',scope:'pensionAlloc'}
];
function redrawChartForCardSize(cardId,{force=false}={}){
  const scope=RESPONSIVE_CHART_SCOPES.find(item=>item.id===cardId)?.scope;
  if(!scope)return false;
  const expanded=chartRuntimeState.expanded;
  const svg=expanded?.cardId===cardId?expanded.svg:document.querySelector(`#${cardId} svg.chart`);
  if(!svg)return false;
  const current=Number(svg.viewBox?.baseVal?.width||0),next=chartViewBoxSize(svg).w;
  const currentScale=chartSvgDisplayScale(svg);
  const scaleChanged=expanded?.svg===svg&&Number(expanded.renderedScale)>0&&Math.abs(currentScale-expanded.renderedScale)>.01;
  if(!force&&current>0&&Math.abs(current-next)<=1&&!scaleChanged)return false;
  redrawChartScope(scope);
  if(expanded?.svg===svg)expanded.renderedScale=chartSvgDisplayScale(svg);
  return true;
}
function redrawVisibleChartsForCurrentSize(){
  RESPONSIVE_CHART_SCOPES.forEach(({id})=>{
    const svg=document.querySelector(`#${id} svg.chart`);
    const rect=svg?.getBoundingClientRect?.();
    if(Number(rect?.width)>0&&Number(rect?.height)>0)redrawChartForCardSize(id);
  });
}
// [CHART03] Responsive Controls / Entrance Motion · 반응형 컨트롤 / 진입 모션
function syncChartOptions(scope,card,legend){
  if(!card||!legend)return;
  let options=document.querySelector(`.chart-options-row[data-chart-scope="${scope}"]`);
  if(!options){
    options=document.createElement('div');
    options.className='chart-options-row';
    options.dataset.chartScope=scope;
  }
  const left=legend.querySelector(':scope > .chart-legend-control-left');
  const right=legend.querySelector(':scope > .chart-legend-control-right');
  if(left||right){
    options.replaceChildren();
    if(left)options.appendChild(left);
    if(right)options.appendChild(right);
  }
  const expandedHost=legend.closest('.chart-expanded-legend-host');
  if(expandedHost){
    if(options.parentElement!==expandedHost||options.nextElementSibling!==legend)expandedHost.insertBefore(options,legend);
  }else if(options.previousElementSibling!==legend){
    legend.after(options);
  }
  const allButton=options.querySelector('.chart-series-all');
  const hasYAuto=!!options.querySelector('.chart-y-auto-toggle');
  const allSelected=allButton?.classList.contains('active')===true;
  if(allButton)allButton.style.display=allSelected?'none':'';
  options.style.display=((allButton&&!allSelected)||hasYAuto)?'':'none';
  options.classList.toggle('has-y-auto',hasYAuto);
}
function refreshChartOptions(scope){
  const item=RESPONSIVE_CHART_SCOPES.find(entry=>entry.scope===scope);
  if(!item)return;
  const card=document.getElementById(item.id);
  const legendId=chartLegendId(scope),legend=legendId?document.getElementById(legendId):null;
  if(card&&legend)syncChartOptions(scope,card,legend);
}
// [CHART04] Scroll State / Hints · 가로 스크롤 상태 / 힌트
function refreshScrollHints(){
  document.querySelectorAll('.scroll-hint').forEach(el=>el.remove());
  document.querySelectorAll('.mobile-scroll, .chart-wrap').forEach(wrap=>{
    const scrollable=wrap.scrollWidth>wrap.clientWidth+4;
    wrap.classList.toggle('is-scrollable',scrollable);
    if(wrap.classList.contains('chart-wrap')){
      wrap.closest('.chart-card')?.classList.toggle('has-horizontal-scroll',scrollable);
    }
  });
}

function syncResponsiveChartControls(){
  const compact=phoneUi(),phoneFlow=portraitPhoneChartFlow();
  RESPONSIVE_CHART_SCOPES.forEach(({id,scope})=>{
    const card=document.getElementById(id);
    const head=card?.querySelector('.chart-head');
    const actions=card?.querySelector('.chart-head-actions');
    const row=card?.querySelector('.chart-scroll-row');
    const mobileExpand=row?.querySelector('.chart-expand-button')||head?.querySelector('.chart-expand-button');
    if(!card||!row)return;
    card.classList.toggle('compact-chart-ui',compact);
    card.classList.toggle('phone-chart-ui',phoneFlow);
    if(head&&actions){
      const hasLeadingSwitch=!!actions.querySelector('.control-segmented');
      actions.classList.toggle('mobile-no-leading-switch',phoneFlow&&!hasLeadingSwitch);
      if(phoneFlow){
        if(actions.parentElement!==row)row.insertBefore(actions,row.querySelector('.chart-scroll-start')||null);
        if(mobileExpand&&mobileExpand.parentElement!==head)head.appendChild(mobileExpand);
      }else{
        if(actions.parentElement!==head)head.appendChild(actions);
        if(mobileExpand&&mobileExpand.parentElement!==row)row.appendChild(mobileExpand);
        actions.classList.remove('mobile-no-leading-switch');
      }
    }
    const legendId=chartLegendId(scope),legend=legendId?document.getElementById(legendId):null;
    if(legend){
      legend.innerHTML=chartLegendHtml(scope);
      syncChartOptions(scope,card,legend);
    }
  });
  if(!compact)closeChartTitleInfo();
}
function setupResponsiveChartControls(){
  syncResponsiveChartControls();
  setupExpandedChartViewport();
  if(chartRuntimeState.responsiveControlsBound)return;
  chartRuntimeState.responsiveControlsBound=true;
  document.addEventListener('click',event=>{if(!event.target.closest('.chart-title-info'))closeChartTitleInfo()});
  let frame=0;
  window.addEventListener('resize',()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      if(chartViewBoxNeedsRedraw())drawAllCharts();
      else{
        syncResponsiveChartControls();
        refreshScrollHints();
      }
    });
  },{passive:true});
}

function activatePendingChartEntrancesForPhoneLandscape(){
  if(!phoneLandscapeUi())return;
  document.querySelectorAll('.chart-card .chart-wrap').forEach(activateChartEntrance);
}
function chartEntranceDataElements(svg){
  const viewWidth=svg.viewBox?.baseVal?.width||Number(svg.getAttribute('width'))||CHART_VIEWBOX_BASE.width;
  return [...svg.querySelectorAll('rect, polyline, circle')].filter(node=>{
    if(node.classList.contains('svg-hitbox'))return false;
    if(node.tagName.toLowerCase()!=='rect')return true;
    const x=Number(node.getAttribute('x')||0),y=Number(node.getAttribute('y')||0);
    const width=Number(node.getAttribute('width')||0),height=Number(node.getAttribute('height')||0);
    const viewHeight=svg.viewBox?.baseVal?.height||Number(svg.getAttribute('height'))||CHART_VIEWBOX_BASE.height;
    return !(x===0&&y===0&&width>=viewWidth*.98&&height>=viewHeight*.98);
  });
}
function chartEntranceXRatio(node,svg){
  const viewWidth=svg.viewBox?.baseVal?.width||CHART_VIEWBOX_BASE.width;
  let x=0;
  if(node.tagName.toLowerCase()==='rect'){
    x=Number(node.getAttribute('x')||0)+Number(node.getAttribute('width')||0)/2;
  }else if(node.tagName.toLowerCase()==='circle'){
    x=Number(node.getAttribute('cx')||0);
  }else{
    const points=node.points;
    x=points?.numberOfItems?points.getItem(0).x:0;
  }
  return Math.max(0,Math.min(1,x/Math.max(1,viewWidth)));
}
function prepareChartEntranceForSvg(svg){
  if(!svg)return;
  const card=svg.closest('.chart-card');
  if(!card)return;
  if(card.dataset.chartEntrancePlayed==='true'){
    card.classList.remove('chart-entrance-ready');
    card.classList.add('chart-entrance-active');
    return;
  }
  let lineIndex=0;
  chartEntranceDataElements(svg).forEach(node=>{
    const tag=node.tagName.toLowerCase();
    if(tag==='polyline'){
      const length=Math.max(1,Math.ceil(node.getTotalLength?.()||1));
      node.classList.add('chart-anim-line');
      node.style.setProperty('--chart-path-length',String(length));
      node.style.setProperty('--chart-delay',`${80+lineIndex*55}ms`);
      lineIndex+=1;
      return;
    }
    const delay=Math.round(chartEntranceXRatio(node,svg)*680);
    node.classList.add(tag==='circle'?'chart-anim-point':'chart-anim-bar');
    node.style.setProperty('--chart-delay',`${delay}ms`);
  });
  card.classList.remove('chart-entrance-active');
  card.classList.add('chart-entrance-ready');
}
function activateChartEntrance(wrap){
  const card=wrap?.closest('.chart-card');
  if(!card||card.dataset.chartEntrancePlayed==='true')return;
  card.dataset.chartEntrancePlayed='true';
  requestAnimationFrame(()=>card.classList.add('chart-entrance-active'));
  chartRuntimeState.entranceObserver?.unobserve(wrap);
}
function chartWrapFullyVisible(wrap){
  const rect=wrap.getBoundingClientRect();
  return rect.top>=-1&&rect.bottom<=window.innerHeight+1;
}
function setupChartEntranceAnimations(){
  chartRuntimeState.entranceObserver?.disconnect();
  chartRuntimeState.entranceObserver=null;
  const wraps=[...document.querySelectorAll('.chart-card .chart-wrap')];
  if(!wraps.length)return;
  if(!chartRuntimeState.entrancePhoneLandscapeBound){
    chartRuntimeState.entrancePhoneLandscapeBound=true;
    let landscapeFrame=0;
    const syncLandscapeEntrance=()=>{
      cancelAnimationFrame(landscapeFrame);
      landscapeFrame=requestAnimationFrame(activatePendingChartEntrancesForPhoneLandscape);
    };
    window.addEventListener('resize',syncLandscapeEntrance,{passive:true});
    window.addEventListener('orientationchange',syncLandscapeEntrance,{passive:true});
  }
  if(phoneLandscapeUi()||!('IntersectionObserver' in window)){
    wraps.forEach(activateChartEntrance);
    return;
  }
  chartRuntimeState.entranceObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting&&entry.intersectionRatio>=.97&&chartWrapFullyVisible(entry.target)){
        activateChartEntrance(entry.target);
      }
    });
  },{threshold:[0,.5,.9,.97,1]});
  wraps.forEach(wrap=>chartRuntimeState.entranceObserver.observe(wrap));
  requestAnimationFrame(()=>wraps.forEach(wrap=>{
    if(chartWrapFullyVisible(wrap))activateChartEntrance(wrap);
  }));
}

// [CHART05] Series State / Legend Controls · 시리즈 상태 / 범례 컨트롤
const CHART_SERIES_THEME=Object.freeze({
  profit:{token:'--chart-series-profit',fallback:'#ffb84d'},
  daily:{token:'--chart-series-daily',fallback:'#a7d7a8'},
  return:{token:'--chart-series-return',fallback:'#5abdf2'},
  kospi:{token:'--chart-series-kospi',fallback:'#7c3aed'}
});
function chartSeriesColor(key){
  const item=CHART_SERIES_THEME[key];
  return item?cssThemeValue(item.token,item.fallback):'';
}
function chartSeriesLegendColor(key){
  const item=CHART_SERIES_THEME[key];
  return item?`var(${item.token},${item.fallback})`:'';
}
function chartCompareSeriesKey(mode){return mode==='kospi'?'kospi':'return'}
function chartCompareSeriesColor(mode){return chartSeriesColor(chartCompareSeriesKey(mode))}
function chartCompareLegendColor(mode){return chartSeriesLegendColor(chartCompareSeriesKey(mode))}
function chartStateKey(scope){
  return scope==='securitiesAlloc'?`securitiesAlloc:${chartState.securityAllocMode==='symbol'?'symbol':'type'}`:scope;
}
function chartSeriesState(scope){
  const key=chartStateKey(scope);
  if(!chartState.series[key])chartState.series[key]={selected:null,autoY:false};
  return chartState.series[key];
}
function chartLegendId(scope){
  return {
    securitiesCum:'securitiesCumLegend',
    pensionCum:'pensionCumLegend',
    securitiesSymbol:'securitiesSymbolLegend',
    pensionSymbol:'pensionSymbolLegend',
    securitiesAlloc:'securityAllocLegend',
    pensionAlloc:'pensionAllocLegend'
  }[scope]||'';
}
function chartLegendItems(scope){
  if(scope==='securitiesCum')return [
    {key:'profit',label:'누적손익',color:chartSeriesLegendColor('profit')},
    {key:'daily',label:'전일대비손익',color:chartSeriesLegendColor('daily')},
    {key:'compare',label:chartCompareLabel('securities'),color:chartCompareLegendColor(chartState.compareModes.securities)}
  ];
  if(scope==='pensionCum')return [
    {key:'profit',label:'운용손익',color:chartSeriesLegendColor('profit')},
    {key:'daily',label:'전일대비손익',color:chartSeriesLegendColor('daily')},
    {key:'compare',label:chartCompareLabel('pension'),color:chartCompareLegendColor(chartState.compareModes.pension)}
  ];
  if(scope==='securitiesSymbol'){
    const current=dataState.activeDate?calc(dataState.activeDate):null;
    const activeNames=new Set(dataState.activeDate?securityChartNamesForDate(dataState.activeDate):[]);
    const names=current?sortSecurityChartItems(current.holdings.filter(h=>activeNames.has(h.name))).map(h=>h.name):[];
    return names.map(name=>({key:name,label:name,color:SECURITY_SYMBOL_COLORS[name]||securityAllocationColor(name)}));
  }
  if(scope==='pensionSymbol'){
    const current=dataState.activeDate?calc(dataState.activeDate):null;
    return (current?.pensionRows||[]).map(r=>({key:r.name,label:r.name,color:pensionSeriesColor(r.name)}));
  }
  if(scope==='pensionAlloc'){
    const current=dataState.activeDate?calc(dataState.activeDate):null;
    const rows=current?sortPensionItems(current.pensionRows):[];
    return [...rows.map(r=>({key:r.name,label:r.name,color:pensionSeriesColor(r.name)})),{key:'현금성자산',label:'현금성자산',color:CASH_ASSET_COLOR}];
  }
  if(scope==='securitiesAlloc'){
    const current=dataState.activeDate?calc(dataState.activeDate):null;
    if(chartState.securityAllocMode==='symbol'){
      return [...(current?securityAllocItems(current):[]).map(h=>({key:h.name,label:h.name,color:securityAllocationColor(h.name)})),{key:'현금',label:'현금',color:CASH_ASSET_COLOR}];
    }
    return [
      {key:'ETF',label:'ETF',color:assetTypeColor('ETF')},
      {key:'개별주식',label:'개별주식',color:assetTypeColor('개별주식')},
      {key:'현금',label:'현금',color:CASH_ASSET_COLOR}
    ];
  }
  return [];
}
function chartSelection(scope){
  const available=chartLegendItems(scope).map(item=>item.key);
  const state=chartSeriesState(scope);
  if(!available.length)return {available,selected:new Set(),all:true,state};
  if(state.selected==null)return {available,selected:new Set(available),all:true,state};
  const selected=new Set([...state.selected].filter(key=>available.includes(key)));
  if(!selected.size){
    selected.add(available[0]);
    state.selected=new Set(selected);
  }
  if(selected.size===available.length){
    state.selected=null;
    return {available,selected:new Set(available),all:true,state};
  }
  state.selected=new Set(selected);
  return {available,selected,all:false,state};
}
function chartAutoYEnabled(scope){
  const selection=chartSelection(scope);
  return !selection.all&&selection.state.autoY===true;
}
function chartLegendHtml(scope){
  const items=chartLegendItems(scope),selection=chartSelection(scope);
  const autoY=selection.state.autoY===true;
  const allButton=selection.all?'':`<button type="button" class="legend-item chart-series-all" aria-pressed="false" data-dashboard-action="toggle-chart-series" data-chart-scope="${scope}" data-chart-series-key="__all__">전체</button>`;
  const itemButtons=items.map(item=>{
    const active=selection.selected.has(item.key);
    return `<button type="button" class="legend-item chart-series-toggle${active?' active':' inactive'}" aria-pressed="${active}" data-dashboard-action="toggle-chart-series" data-chart-scope="${scope}" data-chart-series-key="${encodeURIComponent(item.key)}"><span class="swatch" aria-hidden="true" style="background:${item.color}"></span>${chartDisplayLabel(scope,item.label)}</button>`;
  }).join('');
  const autoButton=selection.all?'':`<button type="button" class="chart-y-auto-toggle${autoY?' active':''}" role="switch" aria-checked="${autoY}" data-dashboard-action="set-chart-auto-y" data-chart-scope="${scope}" data-chart-auto-y="${autoY?'false':'true'}"><span>Y축 자동 재계산</span><span class="chart-y-auto-state">${autoY?'ON':'OFF'}</span></button>`;
  return `<span class="chart-legend-control chart-legend-control-left">${allButton}</span><span class="chart-legend-series">${itemButtons}</span><span class="chart-legend-control chart-legend-control-right">${autoButton}</span>`;
}
function refreshChartLegend(scope){
  const id=chartLegendId(scope),legend=id?document.getElementById(id):null;
  if(legend)legend.innerHTML=chartLegendHtml(scope);
  refreshChartOptions(scope);
}
function redrawChartScope(scope){
  const drawers={
    securitiesCum:drawCumChart,
    pensionCum:drawPensionCumChart,
    securitiesSymbol:drawLineChart,
    pensionSymbol:drawPensionSymbolChart,
    securitiesAlloc:drawStacked,
    pensionAlloc:drawPensionStacked
  };
  const svgIds={
    securitiesCum:'chartCum',pensionCum:'pensionChartCum',securitiesSymbol:'chartSymbol',pensionSymbol:'pensionChartSymbol',securitiesAlloc:'chartAlloc',pensionAlloc:'pensionChartAlloc'
  };
  drawers[scope]?.();
  const svg=document.getElementById(svgIds[scope]);
  if(svg)prepareChartEntranceForSvg(svg);
  refreshScrollHints();
}
function toggleChartSeries(scope,key){
  const selection=chartSelection(scope);
  if(!selection.available.length)return;
  if(key==='__all__'){
    selection.state.selected=null;
  }else if(selection.available.includes(key)){
    const next=new Set(selection.selected);
    if(next.has(key)){
      if(next.size<=1)return;
      next.delete(key);
    }else next.add(key);
    selection.state.selected=next.size===selection.available.length?null:next;
  }
  refreshChartLegend(scope);
  redrawChartScope(scope);
}
function setChartAutoY(scope,enabled){
  const selection=chartSelection(scope);
  if(selection.all)return;
  selection.state.autoY=enabled!==false;
  refreshChartLegend(scope);
  redrawChartScope(scope);
}

function chartCompareLabel(scope){
  if(chartState.compareModes[scope]==='kospi')return '코스피 지수';
  return scope==='pension'?'운용수익률':'누적수익률';
}
function chartCompareToggle(scope){
  const mode=chartState.compareModes[scope]||'return';
  return `<div class="control-segmented" role="group" aria-label="선 그래프 표시 기준"><button type="button" class="${mode==='return'?'active':''}" data-chart-compare-scope="${scope}" data-chart-compare-mode="return" aria-pressed="${mode==='return'}" data-dashboard-action="set-chart-compare-mode">수익률</button><button type="button" class="${mode==='kospi'?'active':''}" data-chart-compare-scope="${scope}" data-chart-compare-mode="kospi" aria-pressed="${mode==='kospi'}" data-dashboard-action="set-chart-compare-mode">코스피</button></div>`;
}
function setChartCompareMode(scope,mode){
  if(!['securities','pension'].includes(scope))return;
  chartState.compareModes[scope]=mode==='kospi'?'kospi':'return';
  document.querySelectorAll(`[data-chart-compare-scope="${scope}"]`).forEach(btn=>{
    const active=btn.dataset.chartCompareMode===chartState.compareModes[scope];
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  const chartScope=scope==='pension'?'pensionCum':'securitiesCum';
  refreshChartLegend(chartScope);
  redrawChartScope(chartScope);
}

function symbolChartToggle(scope){
  const mode=chartState.symbolModes[scope]||'profit';
  const profitLabel=scope==='pension'?'운용손익':'누적손익';
  const rateLabel='수익률';
  return `<div class="control-segmented" role="group" aria-label="상품·종목별 차트 표시 기준"><button type="button" class="${mode==='profit'?'active':''}" data-symbol-chart-scope="${scope}" data-symbol-chart-mode="profit" aria-pressed="${mode==='profit'}" data-dashboard-action="set-symbol-chart-mode">${profitLabel}</button><button type="button" class="${mode==='rate'?'active':''}" data-symbol-chart-scope="${scope}" data-symbol-chart-mode="rate" aria-pressed="${mode==='rate'}" data-dashboard-action="set-symbol-chart-mode">${rateLabel}</button></div>`;
}
function setSymbolChartMode(scope,mode){
  if(!['securities','pension'].includes(scope))return;
  chartState.symbolModes[scope]=mode==='rate'?'rate':'profit';
  document.querySelectorAll(`[data-symbol-chart-scope="${scope}"]`).forEach(btn=>{
    const active=btn.dataset.symbolChartMode===chartState.symbolModes[scope];
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  if(scope==='pension'){
    drawPensionSymbolChart();
    prepareChartEntranceForSvg(document.getElementById('pensionChartSymbol'));
  }else{
    drawLineChart();
    prepareChartEntranceForSvg(document.getElementById('chartSymbol'));
  }
}

function securityAllocToggle(){
  const mode=chartState.securityAllocMode==='symbol'?'symbol':'type';
  return `<div class="control-segmented" role="group" aria-label="증권계좌 평가금액 비중 표시 기준"><button type="button" class="${mode==='type'?'active':''}" data-security-alloc-mode="type" aria-pressed="${mode==='type'}" data-dashboard-action="set-security-alloc-mode">유형별</button><button type="button" class="${mode==='symbol'?'active':''}" data-security-alloc-mode="symbol" aria-pressed="${mode==='symbol'}" data-dashboard-action="set-security-alloc-mode">종목별</button></div>`;
}
function securityAllocItems(x){
  return sortSecurityAllocationItems(securityAllocVisibleHoldings(x));
}
function securityAllocLegendHtml(x){
  return chartLegendHtml('securitiesAlloc');
}
function securityAllocCardCount(x){
  return chartState.securityAllocMode==='symbol'?4:3;
}
function securityAllocCardsHtml(x){
  const ratioBase=securityAllocVisibleHoldings(x).reduce((sum,h)=>sum+Number(h?.evalAmount||0),0),ratio=value=>ratioBase?Number(value||0)/ratioBase*100:0;
  const oneShareAndCashEval=securityAllocOneShareEval(x)+Number(x?.securitiesCash||0),includeDetail=oneShareAndCashEval?`<div class="m-detail cash-include-detail alloc-cash-meta">(1주 종목 및 현금 ${won(oneShareAndCashEval)} 포함)</div>`:'';
  const totalCard=`<div class="mini-card alloc-total-card${chartState.securityAllocMode==='symbol'?' alloc-total-card-wide':''}"><div class="m-label">평가금액 합계</div><div class="m-value">${won(x.allocTotal)}</div>${includeDetail}</div>`;
  if(chartState.securityAllocMode!=='symbol'){
    const typeTotals=securityAllocTypeTotals(x);
    return `<div class="mini-card"><div class="m-label">ETF${chartSeriesSwatch(assetTypeColor('ETF'))}</div><div class="m-value">${won(typeTotals.etf)} <span class="small alloc-ratio-meta">(${ratio(typeTotals.etf).toFixed(1)}%)</span></div></div><div class="mini-card"><div class="m-label">개별주식${chartSeriesSwatch(assetTypeColor('개별주식'))}</div><div class="m-value">${won(typeTotals.stock)} <span class="small alloc-ratio-meta">(${ratio(typeTotals.stock).toFixed(1)}%)</span></div></div>${totalCard}`;
  }
  const itemCards=securityAllocItems(x).map(h=>`<div class="mini-card"><div class="m-label">${h.name}${chartSeriesSwatch(securityAllocationColor(h.name))}</div><div class="m-value">${won(h.evalAmount)} <span class="small alloc-ratio-meta">(${ratio(h.evalAmount).toFixed(1)}%)</span></div></div>`).join('');
  return itemCards+totalCard;
}
function setSecurityAllocMode(mode){
  chartState.securityAllocMode=mode==='symbol'?'symbol':'type';
  document.querySelectorAll('[data-security-alloc-mode]').forEach(btn=>{
    const active=btn.dataset.securityAllocMode===chartState.securityAllocMode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
  const x=dataState.activeDate?calc(dataState.activeDate):null;
  const legend=document.getElementById('securityAllocLegend');
  const cards=document.getElementById('securityAllocCards');
  if(x&&legend)legend.innerHTML=securityAllocLegendHtml(x);
  refreshChartOptions('securitiesAlloc');
  if(x&&cards){
    cards.style.setProperty('--security-alloc-card-count',String(securityAllocCardCount(x)));
    cards.innerHTML=securityAllocCardsHtml(x);
  }
  drawStacked();
  prepareChartEntranceForSvg(document.getElementById('chartAlloc'));
  refreshScrollHints();
}


// [CHART06] Chart Data / Card Rendering · 차트 데이터 / 카드 렌더링
// Feature-owned swatch adapters: series 존재/팔레트 판단은 chart feature가 소유한다.
const securitySymbolSwatch=name=>(!dataState.activeDate||securityChartNamesForDate(dataState.activeDate).includes(name))
  ?assetColorSwatch(securityAllocationColor(name))
  :'';
const pensionProductSwatch=name=>assetColorSwatch(pensionSeriesColor(name));

function calcMdd(cum){
  if(!cum.length)return null;
  let peak=cum[0], maxDrop=0, from=cum[0].날짜, to=cum[0].날짜;
  for(const r of cum){
    if(r['합계 : 누적손익']>peak['합계 : 누적손익']) peak=r;
    const drop=r['합계 : 누적손익']-peak['합계 : 누적손익'];
    if(drop<maxDrop){maxDrop=drop;from=peak.날짜;to=r.날짜;}
  }
  return {drop:maxDrop,from,to};
}
function renderCharts(x,separateProfitHtml=''){
  const cum=cumHistory(x.date),last=cum.at(-1),prevCum=cum.length>1?cum.at(-2):null,best=cum.reduce((a,b)=>b['합계 : 누적손익']>a['합계 : 누적손익']?b:a,cum[0]),
        bestDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']>a['합계 : 전일대비손익']?b:a,cum[0]),
        worstDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']<a['합계 : 전일대비손익']?b:a,cum[0]),
        mdd=calcMdd(cum),chartNames=securityChartNamesForDate(x.date),symbolCards=x.holdings.filter(h=>chartNames.includes(h.name)||h.name==='KODEX 로봇액티브'||h.name==='KoAct 코스닥액티브'),orderedSymbols=sortSecurityChartItems(symbolCards),symbolTotal=symbolCards.reduce((a,h)=>a+h.profit,0),
        lastProfit=last['합계 : 누적손익'], lastReturn=last['합계 : 누적수익률'],
        profitDelta=prevCum?lastProfit-prevCum['합계 : 누적손익']:0,
        dayReturnRate=x?.securitiesAssetDetail?.change?.dayRate??null,
        bestGap=best['합계 : 누적손익']-lastProfit,
        bestDetail=bestGap===0?'금일 갱신':'금일 대비 '+signed(bestGap,'원');
  return `<section id="investment-analysis"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="period" aria-hidden="true"></span>투자 기간 분석</h2><p class="section-control-chip section-basis-chip">삼성증권1 기준</p></div><div class="grid chart-grid">
  <div class="chart-card" id="chart-cum"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon" data-section-title-icon="lineChart" aria-hidden="true"></span>누적손익 및 누적수익률</h3></div>${separateProfitHtml}<div class="chart-head-actions">${chartCompareToggle('securities')}${chartWebExpandButton()}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="chartCum"></svg></div><div class="chart-legend" id="securitiesCumLegend">${chartLegendHtml('securitiesCum')}</div><div class="chart-note six"><div class="mini-card"><div class="m-label">누적손익</div><div class="m-value ${cls(lastProfit)}">${won(lastProfit)}</div><div class="m-detail ${cls(profitDelta)}">전일 대비 ${signed(profitDelta,'원')}</div></div><div class="mini-card"><div class="m-label">누적수익률</div><div class="m-value ${cls(lastReturn)}">${pct(lastReturn)}</div><div class="m-detail ${dayReturnRate==null?'':cls(dayReturnRate)}">전일 대비 ${dayReturnRate==null?'-':`${dayReturnRate>0?'+':''}${pct(dayReturnRate)}`}</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" data-dashboard-action="jump-chart-date" data-chart-date="${best.날짜}" data-chart-id="chart-cum" title="${best.날짜} 기준으로 이동"><div class="m-label">최대 누적손익(${best.날짜})</div><div class="m-value ${cls(best['합계 : 누적손익'])}">${won(best['합계 : 누적손익'])}</div><div class="m-detail ${bestGap===0?'positive':''}">${bestDetail}</div></div><div class="mini-card"><div class="m-label">최대 낙폭</div><div class="m-value negative">${won(mdd.drop)}</div><div class="m-detail">${mdd.from} → ${mdd.to}</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" data-dashboard-action="jump-chart-date" data-chart-date="${bestDay.날짜}" data-chart-id="chart-cum" title="${bestDay.날짜} 기준으로 이동"><div class="m-label">Best(${bestDay.날짜})</div><div class="m-value positive">${signed(bestDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail positive">전일 대비 변화</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" data-dashboard-action="jump-chart-date" data-chart-date="${worstDay.날짜}" data-chart-id="chart-cum" title="${worstDay.날짜} 기준으로 이동"><div class="m-label">Worst(${worstDay.날짜})</div><div class="m-value negative">${signed(worstDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail negative">전일 대비 변화</div></div></div></div>
  <div class="chart-card" id="chart-symbol"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon" data-section-title-icon="barChart" aria-hidden="true"></span>종목별 누적손익</h3></div><div class="chart-head-actions">${symbolChartToggle('securities')}${chartWebExpandButton()}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="chartSymbol"></svg></div><div class="chart-legend" id="securitiesSymbolLegend">${chartLegendHtml('securitiesSymbol')}</div><div class="chart-note symbol-summary-grid">${orderedSymbols.map(h=>symbolCard(h,symbolTotal)).join('')}</div></div>
  <div class="chart-card" id="chart-alloc"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon" data-section-title-icon="pie" aria-hidden="true"></span>평가금액 비중</h3></div><div class="chart-head-actions">${securityAllocToggle()}${chartWebExpandButton()}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="chartAlloc"></svg></div><div class="chart-legend" id="securityAllocLegend">${securityAllocLegendHtml(x)}</div><div class="chart-note security-alloc-card-grid" id="securityAllocCards" style="--security-alloc-card-count:${securityAllocCardCount(x)}">${securityAllocCardsHtml(x)}</div></div>
  </div></section>`;
}
function symbolCard(h,total){const contrib=total?h.profit/total*100:0,rr=h.cost?h.profit/h.cost*100:0;return `<div class="mini-card symbol-card"><div class="m-label">${h.name==='KODEX 200'?'KODEX 200':h.name}${securitySymbolSwatch(h.name)}</div><div class="m-value ${cls(h.profit)}">${won(h.profit)}</div><div class="symbol-metrics"><div class="symbol-metric"><span class="symbol-metric-label">기여도</span><span class="symbol-metric-value ${cls(contrib)}">${pct(contrib)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">수익률</span><span class="symbol-metric-value ${cls(rr)}">${rr>0?'+':''}${pct(rr)}</span></div></div></div>`}


function pensionSnapshotDates(d){
  return allAvailableDates().filter(x=>x<=d&&hasPensionData(x));
}
function pensionCalcOn(date){
  return calc(date);
}
function pensionCumHistory(d){
  return pensionSnapshotDates(d).map(x=>{
    const v=pensionCalcOn(x);
    return {
      '날짜':x,
      '합계 : 누적손익':v.pensionProfit,
      '합계 : 누적수익률':v.pensionReturn,
      '코스피 지수':kospiIndexForDate(x),
      '합계 : 전일대비손익':0
    };
  }).map((row,i,arr)=>{
    row['합계 : 전일대비손익']=i===0?0:row['합계 : 누적손익']-arr[i-1]['합계 : 누적손익'];
    return row;
  });
}
function pensionSymbolHistory(d){
  return pensionSnapshotDates(d).map(x=>{
    const v=pensionCalcOn(x);
    const row={'날짜':x,'_rates':{}};
    v.pensionRows.forEach(r=>{
      const profit=Number(r.totalProfit ?? r.profit ?? 0);
      row[r.name]=profit;
      row._rates[r.name]=Number(r.cost)?profit/Number(r.cost)*100:0;
    });
    return row;
  });
}
function pensionAllocHistory(d){
  return pensionSnapshotDates(d).map(x=>{
    const v=pensionCalcOn(x), row={'날짜':x};
    v.pensionRows.forEach(r=>row[r.name]=Number(r.evalAmount||0));
    row['현금성자산']=Number(v.pensionCash||0);
    return row;
  });
}
function pensionProductCard(h,total){const contrib=total?h.profit/total*100:0,rr=h.cost?h.profit/h.cost*100:0;return `<div class="mini-card symbol-card"><div class="m-label">${h.name}${pensionProductSwatch(h.name)}</div><div class="m-value ${cls(h.profit)}">${won(h.profit)}</div><div class="symbol-metrics"><div class="symbol-metric"><span class="symbol-metric-label">기여도</span><span class="symbol-metric-value ${cls(contrib)}">${pct(contrib)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">수익률</span><span class="symbol-metric-value ${cls(rr)}">${rr>0?'+':''}${pct(rr)}</span></div></div></div>`}
function pensionProductTotalCard(x,symbols){
  const cashProfit=Number(x.pensionCash||0)-Number(x.pensionCashCost||0);
  const totalProfit=symbols.reduce((a,h)=>a+Number(h.profit||0),0)+cashProfit;
  const totalCost=symbols.reduce((a,h)=>a+Number(h.cost||0),0)+Number(x.pensionCashCost||0);
  const contrib=totalProfit?100:0;
  const rr=totalCost?totalProfit/totalCost*100:0;
  return `<div class="mini-card symbol-card pension-symbol-total-card"><div class="m-label">현금성 자산 포함 합계</div><div class="m-value ${cls(totalProfit)}">${won(totalProfit)}</div><div class="symbol-metrics"><div class="symbol-metric"><span class="symbol-metric-label">기여도</span><span class="symbol-metric-value ${cls(contrib)}">${pct(contrib)}</span></div><div class="symbol-metric"><span class="symbol-metric-label">수익률</span><span class="symbol-metric-value ${cls(rr)}">${rr>0?'+':''}${pct(rr)}</span></div></div></div>`;
}
function renderPensionCharts(x){
  const cum=pensionCumHistory(x.date);
  if(!cum.length) return '';
  const last=cum.at(-1),prevCum=cum.length>1?cum.at(-2):null,best=cum.reduce((a,b)=>b['합계 : 누적손익']>a['합계 : 누적손익']?b:a,cum[0]),
        bestDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']>a['합계 : 전일대비손익']?b:a,cum[0]),
        worstDay=cum.reduce((a,b)=>b['합계 : 전일대비손익']<a['합계 : 전일대비손익']?b:a,cum[0]),
        mdd=calcMdd(cum),
        symbols=x.pensionRows.map(r=>({...r,profit:Number(r.totalProfit ?? r.profit ?? 0),dayChange:r.dayChange})),
        symbolTotal=symbols.reduce((a,h)=>a+h.profit,0),
        lastProfit=last['합계 : 누적손익'], lastReturn=last['합계 : 누적수익률'],
        profitDelta=prevCum?lastProfit-prevCum['합계 : 누적손익']:0,
        dayReturnRate=x.pensionPrevEval==null?null:Number(x.pensionDayRate),
        bestGap=best['합계 : 누적손익']-lastProfit,
        bestDetail=bestGap===0?'금일 갱신':'금일 대비 '+signed(bestGap,'원');
  const productEvalTotal=x.pensionRows.reduce((a,r)=>a+r.evalAmount,0);
  const orderedAllocRows=sortPensionItems(x.pensionRows);
  const allocCards=orderedAllocRows.map(r=>`<div class="mini-card"><div class="m-label">${r.name}${pensionProductSwatch(r.name)}</div><div class="m-value">${won(r.evalAmount)} <span class="small alloc-ratio-meta">(${(r.evalAmount/productEvalTotal*100).toFixed(1)}%)</span></div></div>`).join('');
  return `<section id="pension-investment-analysis" class="pension-chart-block"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="period" aria-hidden="true"></span>투자 기간 분석</h2><p class="section-control-chip section-basis-chip">퇴직연금 기준</p></div><div class="grid chart-grid">
  <div class="chart-card" id="pension-chart-cum"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon" data-section-title-icon="lineChart" aria-hidden="true"></span>운용손익 및 운용수익률 <span class="chart-title-sub">(전체 운용 기준)</span>${chartTitleInfoButton('전체 운용 기준')}</h3></div><div class="chart-head-actions">${chartCompareToggle('pension')}${chartWebExpandButton()}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="pensionChartCum"></svg></div><div class="chart-legend" id="pensionCumLegend">${chartLegendHtml('pensionCum')}</div><div class="chart-note six"><div class="mini-card"><div class="m-label">운용손익</div><div class="m-value ${cls(lastProfit)}">${won(lastProfit)}</div><div class="m-detail ${cls(profitDelta)}">전일 대비 ${signed(profitDelta,'원')}</div></div><div class="mini-card"><div class="m-label">운용수익률</div><div class="m-value ${cls(lastReturn)}">${pct(lastReturn)}</div><div class="m-detail ${dayReturnRate==null?'':cls(dayReturnRate)}">전일 대비 ${dayReturnRate==null?'-':`${dayReturnRate>0?'+':''}${pct(dayReturnRate)}`}</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" data-dashboard-action="jump-chart-date" data-chart-date="${best.날짜}" data-chart-id="pension-chart-cum" title="${best.날짜} 기준으로 이동"><div class="m-label">최대 운용손익(${best.날짜})</div><div class="m-value ${cls(best['합계 : 누적손익'])}">${won(best['합계 : 누적손익'])}</div><div class="m-detail ${bestGap===0?'positive':''}">${bestDetail}</div></div><div class="mini-card"><div class="m-label">최대 낙폭</div><div class="m-value negative">${won(mdd.drop)}</div><div class="m-detail">${mdd.from} → ${mdd.to}</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" data-dashboard-action="jump-chart-date" data-chart-date="${bestDay.날짜}" data-chart-id="pension-chart-cum" title="${bestDay.날짜} 기준으로 이동"><div class="m-label">Best(${bestDay.날짜})</div><div class="m-value positive">${signed(bestDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail positive">전일 대비 변화</div></div><div class="mini-card chart-date-jump" role="button" tabindex="0" data-dashboard-action="jump-chart-date" data-chart-date="${worstDay.날짜}" data-chart-id="pension-chart-cum" title="${worstDay.날짜} 기준으로 이동"><div class="m-label">Worst(${worstDay.날짜})</div><div class="m-value negative">${signed(worstDay['합계 : 전일대비손익'],'원')}</div><div class="m-detail negative">전일 대비 변화</div></div></div></div>
  <div class="chart-card" id="pension-chart-symbol"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon" data-section-title-icon="barChart" aria-hidden="true"></span>연금상품별 운용손익 <span class="chart-title-sub">(보유상품 재투자 기준)</span>${chartTitleInfoButton('보유상품 재투자 기준')}</h3></div><div class="chart-head-actions">${symbolChartToggle('pension')}${chartWebExpandButton()}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="pensionChartSymbol"></svg></div><div class="chart-legend" id="pensionSymbolLegend">${chartLegendHtml('pensionSymbol')}</div><div class="chart-note symbol-summary-grid pension-symbol-summary-grid">${symbols.sort((a,b)=>Math.abs(b.profit)-Math.abs(a.profit)).map(h=>pensionProductCard(h,symbolTotal)).join('')}${pensionProductTotalCard(x,symbols)}</div></div>
  <div class="chart-card" id="pension-chart-alloc"><div class="chart-head"><div><h3><span class="section-title-icon chart-icon" data-section-title-icon="pie" aria-hidden="true"></span>평가금액 비중</h3></div><div class="chart-head-actions">${chartWebExpandButton()}</div></div>${chartScrollButton()}<div class="chart-wrap"><svg class="chart" id="pensionChartAlloc"></svg></div><div class="chart-legend" id="pensionAllocLegend">${chartLegendHtml('pensionAlloc')}</div><div class="chart-note">${allocCards}<div class="mini-card pension-alloc-total-card"><div class="m-label">평가금액 합계</div><div class="m-value">${won(x.pensionEval)}</div><div class="m-detail cash-include-detail alloc-cash-meta pension-cash-detail pension-cash-detail-full">(현금성자산 ${won(x.pensionCash)} 포함)</div><div class="m-detail cash-include-detail alloc-cash-meta pension-cash-detail pension-cash-detail-compact">(현금 ${fmt(x.pensionCash)})</div></div></div></div>
  </div></section>`;
}


// [CHART07] SVG Core / Tooltip Infrastructure · SVG 기반 / 툴팁 인프라
function clear(svg){while(svg.firstChild)svg.removeChild(svg.firstChild)}
function el(name, attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e}
function cssThemeValue(name,fallback){
  const value=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value||fallback;
}
function tooltip(){
  const tt=document.getElementById('dashTooltip');
  if(tt&&!tt.hasAttribute('role')){
    tt.setAttribute('role','tooltip');
    tt.setAttribute('aria-hidden','true');
  }
  return tt;
}
function chartA11yStatus(){
  let status=document.getElementById('chartA11yStatus');
  if(!status){
    status=document.createElement('div');
    status.id='chartA11yStatus';
    status.className='visually-hidden';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    status.setAttribute('aria-atomic','true');
    document.body.appendChild(status);
  }
  return status;
}
function chartTooltipPlainText(html){
  const temp=document.createElement('div');
  temp.innerHTML=html;
  const parts=[...temp.querySelectorAll('.tt-date,.tt-row')].map(el=>String(el.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  return (parts.length?parts:[String(temp.textContent||'')]).join(', ').replace(/\s+/g,' ').trim();
}
function chartAccessibleTitle(svg){
  const heading=svg.closest('.chart-card')?.querySelector('.chart-head h3');
  if(!heading)return '투자 차트';
  const clone=heading.cloneNode(true);
  clone.querySelectorAll('button,.chart-title-info-tooltip').forEach(el=>el.remove());
  return String(clone.textContent||'투자 차트').replace(/\s+/g,' ').trim();
}
function chartKeyboardAnchor(svg,cfg,dataLength,index){
  const point=svg.createSVGPoint();
  point.x=chartX(cfg,dataLength,index);
  point.y=cfg.t+(cfg.h-cfg.t-cfg.b)/2;
  const matrix=svg.getScreenCTM();
  if(!matrix)return {clientX:window.innerWidth/2,clientY:window.innerHeight/2};
  const screenPoint=point.matrixTransform(matrix);
  return {clientX:screenPoint.x,clientY:screenPoint.y};
}
function announceChartTooltip(html){
  const status=chartA11yStatus();
  status.textContent='';
  requestAnimationFrame(()=>{status.textContent=chartTooltipPlainText(html)});
}
function tooltipEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function tooltipDate(value){return `<div class="tt-date">${tooltipEscape(value)}</div>`}
function tooltipDivider(){return '<div class="tt-divider" aria-hidden="true"></div>'}
function tooltipViewport(){
  const vv=window.visualViewport;
  return {
    width:Math.max(1,Math.min(window.innerWidth,vv?.width||window.innerWidth)),
    height:Math.max(1,Math.min(window.innerHeight,vv?.height||window.innerHeight))
  };
}
function showTooltip(evt, html, kind='', ownerChartId=''){
  const tt=tooltip(); if(!tt) return;
  tt.dataset.tooltipKind=kind;
  tt.dataset.chartOwner=ownerChartId;
  tt.innerHTML=html;
  tt.setAttribute('aria-hidden','false');
  tt.style.visibility='hidden';
  tt.style.left=evt.clientX+'px';
  tt.style.top=evt.clientY+'px';
  tt.classList.add('visible');
  const expanded=!!chartRuntimeState.expanded,pad=expanded?10:14,gap=12;
  requestAnimationFrame(()=>{
    if(!tt.classList.contains('visible'))return;
    const rect=tt.getBoundingClientRect(),viewport=tooltipViewport();
    const width=Math.min(rect.width,Math.max(1,viewport.width-pad*2));
    const height=Math.min(rect.height,Math.max(1,viewport.height-pad*2));
    let left=evt.clientX+gap;
    if(left+width>viewport.width-pad)left=evt.clientX-width-gap;
    left=Math.max(pad,Math.min(left,Math.max(pad,viewport.width-width-pad)));
    let top=evt.clientY-height-gap;
    if(top<pad)top=evt.clientY+18;
    if(top+height>viewport.height-pad)top=Math.max(pad,viewport.height-height-pad);
    tt.style.left=left+'px';
    tt.style.top=top+'px';
    tt.style.visibility='visible';
  });
}
function hideTooltip(){
  const tt=tooltip();
  if(!tt)return;
  tt.classList.remove('visible');
  tt.setAttribute('aria-hidden','true');
  tt.style.visibility='';
  delete tt.dataset.chartOwner;
}
function clearChartHover(){hideTooltip();document.querySelectorAll('.chart-hover-line').forEach(line=>line.setAttribute('opacity',0))}
let chartTooltipViewportCheckRaf=0;
function chartTooltipOwnerVisible(){
  const tt=tooltip();
  if(!tt?.classList.contains('visible')||chartRuntimeState.expanded)return true;
  const ownerId=tt.dataset.chartOwner||'';
  const owner=ownerId?document.getElementById(ownerId):null;
  if(!owner)return false;
  const rect=owner.getBoundingClientRect(),viewport=tooltipViewport();
  return rect.bottom>0&&rect.top<viewport.height&&rect.right>0&&rect.left<viewport.width;
}
function scheduleChartTooltipViewportCheck(){
  if(chartTooltipViewportCheckRaf)return;
  chartTooltipViewportCheckRaf=requestAnimationFrame(()=>{
    chartTooltipViewportCheckRaf=0;
    if(!chartTooltipOwnerVisible())clearChartHover();
  });
}
// [CHART08] Global Events / Action Routing · 전역 이벤트 / 차트 액션 라우팅
function setupChartGlobalEvents(){
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.svg-hitbox')&&!event.target.closest('#dashTooltip'))clearChartHover();
  });
  window.addEventListener('scroll',scheduleChartTooltipViewportCheck,{passive:true,capture:true});
  window.addEventListener('resize',scheduleChartTooltipViewportCheck,{passive:true});
  window.visualViewport?.addEventListener('scroll',scheduleChartTooltipViewportCheck,{passive:true});
  window.visualViewport?.addEventListener('resize',scheduleChartTooltipViewportCheck,{passive:true});
  window.addEventListener('beforeprint',prepareChartsForPrint);
  window.addEventListener('afterprint',drawAllCharts);
}
function handleChartDashboardAction(event,control){
  const action=control.dataset.dashboardAction;
  if(action==='open-expanded-chart')openExpandedChart(control);
  else if(action==='scroll-chart-start')scrollChartToStart(control);
  else if(action==='scroll-chart-end')scrollChartToEnd(control);
  else if(action==='toggle-chart-title-info')toggleChartTitleInfo(event,control);
  else if(action==='toggle-chart-series'){
    const key=control.dataset.chartSeriesKey||'';
    toggleChartSeries(control.dataset.chartScope||'',key==='__all__'?key:decodeURIComponent(key));
  }
  else if(action==='set-chart-auto-y')setChartAutoY(control.dataset.chartScope||'',control.dataset.chartAutoY==='true');
  else if(action==='set-chart-compare-mode')setChartCompareMode(control.dataset.chartCompareScope||'',control.dataset.chartCompareMode||'return');
  else if(action==='set-symbol-chart-mode')setSymbolChartMode(control.dataset.symbolChartScope||'',control.dataset.symbolChartMode||'profit');
  else if(action==='set-security-alloc-mode')setSecurityAllocMode(control.dataset.securityAllocMode||'type');
  else return false;
  return true;
}
// [CHART09] Tooltip Rows / Axes / Hover Geometry · 툴팁 행 / 축 / hover 좌표
function row(name,val,clsName='',rowClass=''){return `<div class="tt-row${rowClass?' '+rowClass:''}"><span class="tt-name">${tooltipEscape(name)}</span><span class="tt-val ${clsName}">${tooltipEscape(val)}</span></div>`}
function totalRow(name,val,clsName=''){return row(name,val,clsName,'tt-total')}
function clsBy(n){return n<0?'tt-neg':(n>0?'tt-pos':'')}
function drawAxes(svg,cfg,yTicks,y2Ticks=null){
  const{w,h,l,r,t,b}=cfg;
  const surface=cssThemeValue('--chart-surface','#fff'),grid=cssThemeValue('--chart-grid','#e5e7eb'),axis=cssThemeValue('--chart-axis','#cbd5e1'),text=cssThemeValue('--chart-text','#6b7280');
  svg.appendChild(el('rect',{x:0,y:0,width:w,height:h,fill:surface}));
  for(const tick of yTicks){const y=cfg.y(tick);svg.appendChild(el('line',{x1:l,y1:y,x2:w-r,y2:y,stroke:grid,'stroke-width':1}));const tx=el('text',{x:l-10,y:y+4,'text-anchor':'end','font-size':chartExpandedFixedUnits(svg,11),fill:text});tx.textContent=cfg.yFormatter?cfg.yFormatter(tick):fmt(tick);svg.appendChild(tx)}
  svg.appendChild(el('line',{x1:l,y1:t,x2:l,y2:h-b,stroke:axis}));
  svg.appendChild(el('line',{x1:l,y1:h-b,x2:w-r,y2:h-b,stroke:axis}));
  if(y2Ticks){for(const tick of y2Ticks){const y=cfg.y2(tick);const tx=el('text',{x:w-r+10,y:y+4,'text-anchor':'start','font-size':chartExpandedFixedUnits(svg,11),fill:text});tx.textContent=cfg.y2Formatter?cfg.y2Formatter(tick):tick.toFixed(0)+'%';svg.appendChild(tx)}svg.appendChild(el('line',{x1:w-r,y1:t,x2:w-r,y2:h-b,stroke:axis}))}
}

function chartX(cfg,dataLength,index){
  const edge=Number(cfg.edgePad||0);
  if(dataLength<=1)return cfg.l+cfg.plotW/2;
  return cfg.l+edge+index*(cfg.plotW-edge*2)/(dataLength-1);
}

function labelDates(svg,cfg,data,every=3){
  const{h,b}=cfg;
  const labelY=h-b+16;
  const interval=phoneUi()?Math.max(every,Math.ceil(data.length/24)):every;
  data.forEach((d,i)=>{if(i%interval===0||i===data.length-1){const x=chartX(cfg,data.length,i);const txt=el('text',{x:x,y:labelY,transform:`rotate(-65 ${x} ${labelY})`,'text-anchor':'end','font-size':chartExpandedFixedUnits(svg,10),fill:cssThemeValue('--chart-text','#6b7280')});txt.textContent=d['날짜'];svg.appendChild(txt)}})
}
function polyline(svg,points,color,width=2){svg.appendChild(el('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':chartExpandedHalfGrowthUnits(svg,width),'stroke-linejoin':'round','stroke-linecap':'round'}))}
function circles(svg,points,color){
  const fill=cssThemeValue('--chart-surface','#fff'),radius=chartExpandedHalfGrowthUnits(svg,2.2),strokeWidth=chartExpandedHalfGrowthUnits(svg,1.1);
  points.forEach(p=>svg.appendChild(el('circle',{cx:p[0],cy:p[1],r:radius,fill,stroke:color,'stroke-width':strokeWidth})));
}
function nearestIndex(evt,svg,cfg,data){
  const pt=svg.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;
  const loc=pt.matrixTransform(svg.getScreenCTM().inverse());
  const edge=Number(cfg.edgePad||0);
  const usable=Math.max(1,cfg.plotW-edge*2);
  let idx=Math.round((loc.x-cfg.l-edge)/usable*(data.length-1));
  return Math.max(0,Math.min(data.length-1,idx));
}
function addHover(svg,cfg,data,renderHtml,tooltipKind=''){
  const line=el('line',{x1:cfg.l,y1:cfg.t,x2:cfg.l,y2:cfg.h-cfg.b,stroke:cssThemeValue('--chart-hover','#334155'),'stroke-width':1.2,'stroke-dasharray':'4 4',opacity:0,class:'chart-hover-line'});
  svg.appendChild(line);
  const hit=el('rect',{x:cfg.l,y:cfg.t,width:cfg.plotW,height:cfg.plotH,class:'svg-hitbox'});
  svg.appendChild(hit);
  const savedIndex=Number(svg.dataset.chartKeyboardIndex);
  let activeIndex=Number.isInteger(savedIndex)&&savedIndex>=0&&savedIndex<data.length?savedIndex:Math.max(0,data.length-1);
  const showIndex=(idx,evt,{announce=false}={})=>{
    if(!data.length)return;
    activeIndex=Math.max(0,Math.min(data.length-1,idx));
    svg.dataset.chartKeyboardIndex=String(activeIndex);
    const x=chartX(cfg,data.length,activeIndex),html=renderHtml(data[activeIndex],activeIndex);
    line.setAttribute('x1',x);
    line.setAttribute('x2',x);
    line.setAttribute('opacity',1);
    showTooltip(evt||chartKeyboardAnchor(svg,cfg,data.length,activeIndex),html,tooltipKind,svg.id||'');
    if(announce)announceChartTooltip(html);
  };
  const showPointer=evt=>showIndex(nearestIndex(evt,svg,cfg,data),evt);
  hit.addEventListener('mousemove',showPointer);
  hit.addEventListener('pointerdown',showPointer);
  hit.addEventListener('pointermove',evt=>{
    if(chartRuntimeState.expanded?.svg!==svg)return;
    if(evt.pointerType!=='touch'&&evt.pointerType!=='pen')return;
    if(evt.cancelable)evt.preventDefault();
    showPointer(evt);
  });
  hit.addEventListener('mouseleave',()=>{line.setAttribute('opacity',0);hideTooltip()});
  svg.setAttribute('tabindex','0');
  svg.setAttribute('role','group');
  svg.setAttribute('aria-label',`${chartAccessibleTitle(svg)}. 좌우 방향키로 날짜별 값을 확인하고 Home과 End 키로 처음·마지막 날짜로 이동할 수 있습니다.`);
  svg.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight Home End Enter Space Escape');
  svg.onfocus=()=>{line.setAttribute('opacity',0);hideTooltip()};
  svg.onblur=()=>{line.setAttribute('opacity',0);hideTooltip()};
  svg.onkeydown=event=>{
    if(!data.length)return;
    let next=activeIndex,handled=true;
    if(event.key==='ArrowLeft')next=Math.max(0,activeIndex-1);
    else if(event.key==='ArrowRight')next=Math.min(data.length-1,activeIndex+1);
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=data.length-1;
    else if(event.key==='Enter'||event.key===' ')next=activeIndex;
    else if(event.key==='Escape'){
      event.preventDefault();
      line.setAttribute('opacity',0);
      hideTooltip();
      return;
    }else handled=false;
    if(!handled)return;
    event.preventDefault();
    showIndex(next,null,{announce:true});
  };
  svg.onpointerdown=evt=>{if(evt.target!==hit)clearChartHover()};
}

function niceStep(rawStep){
  if(!Number.isFinite(rawStep)||rawStep<=0) return 1;
  const exp=Math.floor(Math.log10(rawStep));
  const base=Math.pow(10,exp);
  const f=rawStep/base;
  const nf=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;
  return nf*base;
}
function niceTickInfo(min,max,target=6,forceZero=false){
  let lo=Number.isFinite(min)?min:0, hi=Number.isFinite(max)?max:1;
  if(forceZero){lo=Math.min(lo,0);hi=Math.max(hi,0);}
  if(lo===hi){const pad=Math.max(1,Math.abs(hi)*.1);lo-=pad;hi+=pad;}
  const step=niceStep((hi-lo)/Math.max(2,target-1));
  const niceMin=Math.floor(lo/step)*step;
  const niceMax=Math.ceil(hi/step)*step;
  const ticks=[];
  for(let v=niceMin,i=0;v<=niceMax+step*.5&&i<20;v+=step,i++){
    const fixed=Math.abs(step)<1?Number(v.toFixed(2)):Math.round(v);
    ticks.push(fixed);
  }
  return {min:niceMin,max:niceMax,ticks};
}

function fixedTickInfo(min,max,step,forceZero=false){
  let lo=Number.isFinite(min)?min:0, hi=Number.isFinite(max)?max:step;
  if(forceZero){lo=Math.min(lo,0);hi=Math.max(hi,0);}
  if(lo===hi){lo-=step;hi+=step;}
  const niceMin=Math.floor(lo/step)*step;
  const niceMax=Math.ceil(hi/step)*step;
  const ticks=[];
  for(let v=niceMin,i=0;v<=niceMax+step*.5&&i<60;v+=step,i++){
    ticks.push(Math.round(v));
  }
  return {min:niceMin,max:niceMax,ticks};
}

function alignZeroTickRanges(firstInfo,firstStep,secondInfo,secondStep){
  const intervalCounts=(info,step)=>({
    below:Math.max(0,Math.round(-Math.min(0,info.min)/step)),
    above:Math.max(0,Math.round(Math.max(0,info.max)/step))
  });
  const first=intervalCounts(firstInfo,firstStep),second=intervalCounts(secondInfo,secondStep);
  const below=Math.max(first.below,second.below),above=Math.max(first.above,second.above);
  const build=step=>{
    const ticks=[];
    for(let i=-below,count=0;i<=above&&count<60;i++,count++) ticks.push(i*step);
    return {min:-below*step,max:above*step,ticks};
  };
  return [build(firstStep),build(secondStep)];
}

function gcdInt(a,b){
  let x=Math.abs(Math.round(a)),y=Math.abs(Math.round(b));
  while(y){const next=x%y;x=y;y=next;}
  return x||1;
}
function alignFixedAxisZeroToReference(referenceInfo,referenceStep,targetInfo,targetStep){
  const refBelow=Math.max(0,Math.round(-Math.min(0,referenceInfo.min)/referenceStep));
  const refAbove=Math.max(0,Math.round(Math.max(0,referenceInfo.max)/referenceStep));
  const needBelow=Math.max(0,Math.ceil((-Math.min(0,targetInfo.min)-targetStep*1e-9)/targetStep));
  const needAbove=Math.max(0,Math.ceil((Math.max(0,targetInfo.max)-targetStep*1e-9)/targetStep));
  let below=needBelow,above=needAbove;
  if(refBelow===0&&refAbove>0){
    below=0;
    above=Math.max(1,needAbove);
  }else if(refAbove===0&&refBelow>0){
    above=0;
    below=Math.max(1,needBelow);
  }else if(refBelow>0&&refAbove>0){
    const divisor=gcdInt(refBelow,refAbove),baseBelow=refBelow/divisor,baseAbove=refAbove/divisor;
    const scale=Math.max(1,Math.ceil(needBelow/baseBelow),Math.ceil(needAbove/baseAbove));
    below=baseBelow*scale;
    above=baseAbove*scale;
  }
  const ticks=[];
  for(let i=-below,count=0;i<=above&&count<80;i++,count++)ticks.push(i*targetStep);
  return {min:-below*targetStep,max:above*targetStep,ticks};
}
function selectedCumMoneyValues(data,selection){
  const values=[];
  if(selection.has('profit'))data.forEach(d=>values.push(Number(d['합계 : 누적손익'])));
  if(selection.has('daily'))data.forEach(d=>values.push(Number(d['합계 : 전일대비손익'])));
  return values.filter(Number.isFinite);
}
function pensionCumFullMoneyAxis(data){
  const profits=data.map(d=>d['합계 : 누적손익']),daily=data.map(d=>d['합계 : 전일대비손익']);
  const returns=data.map(d=>d['합계 : 누적수익률']).filter(Number.isFinite);
  const money=fixedTickInfo(Math.min(...profits,...daily),Math.max(...profits,...daily),5000000,true);
  const rate=fixedTickInfo(Math.min(0,...returns),Math.max(20,...returns),20,true);
  return alignZeroTickRanges(money,5000000,rate,20)[0];
}
function securitiesCumFullMoneyAxis(){
  return securitiesCumFullAxes().money;
}
function cumulativeMoneyAxis(scope,data,selection,autoY){
  const step=scope==='pensionCum'?5000000:2000000;
  const full=scope==='pensionCum'?pensionCumFullMoneyAxis(data):securitiesCumFullMoneyAxis();
  const hasMoney=selection.has('profit')||selection.has('daily');
  if(!hasMoney||!autoY)return {info:full,step,visible:hasMoney};
  const values=selectedCumMoneyValues(data,selection);
  if(!values.length)return {info:full,step,visible:hasMoney};
  return {info:fixedTickInfo(Math.min(...values),Math.max(...values),step,true),step,visible:true};
}
function cumulativeRightAxis(scope,data,mode,leftAxis,compareSelected,autoY){
  if(!compareSelected)return {info:null,visible:false};
  const values=data.map(d=>mode==='kospi'?d['코스피 지수']:d['합계 : 누적수익률']).filter(Number.isFinite);
  if(mode==='kospi')return {info:values.length?niceTickInfo(Math.min(...values),Math.max(...values),6,false):{min:0,max:1,ticks:[0,1]},visible:true};
  const step=scope==='pensionCum'?20:(!autoY&&scope==='securitiesCum'?10:20);
  let raw;
  if(!autoY&&scope==='securitiesCum')raw=securitiesCumFullAxes().returns;
  else if(!autoY&&scope==='pensionCum')raw=fixedTickInfo(Math.min(0,...values),Math.max(20,...values),20,true);
  else raw=fixedTickInfo(Math.min(0,...values),Math.max(0,...values),step,true);
  if(leftAxis.visible)raw=alignFixedAxisZeroToReference(leftAxis.info,leftAxis.step,raw,step);
  return {info:raw,visible:true};
}

// [CHART10] Chart Drawing / Refresh · 차트 그리기 / 갱신
function drawPensionCumChart(){
  const data=pensionCumHistory(dataState.activeDate),svg=document.getElementById('pensionChartCum');if(!svg||!data.length)return;clear(svg);
  const mode=chartState.compareModes.pension||'return',selection=chartSelection('pensionCum'),selected=selection.selected,autoY=chartAutoYEnabled('pensionCum');
  const leftAxis=cumulativeMoneyAxis('pensionCum',data,selected,autoY),rightAxis=cumulativeRightAxis('pensionCum',data,mode,leftAxis,selected.has('compare'),autoY);
  const yInfo=leftAxis.info,rInfo=rightAxis.info||{min:0,max:1,ticks:[]};
  const cfg=chartConfig(svg),n=data.length,barW=chartBarWidth(svg,cfg,n,1/3,8);
  cfg.edgePad=Math.max(CHART_EDGE_PAD,barW*2.1);
  cfg.y=v=>chartY(cfg,yInfo.min,yInfo.max,v);
  cfg.y2=v=>chartY(cfg,rInfo.min,rInfo.max,v);
  cfg.y2Formatter=mode==='kospi'?(v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})):(v=>v.toFixed(0)+'%');
  drawAxes(svg,cfg,leftAxis.visible?yInfo.ticks:[],rightAxis.visible?rInfo.ticks:null);
  const moneyKeys=[...(selected.has('profit')?['profit']:[]),...(selected.has('daily')?['daily']:[])];
  data.forEach((d,i)=>{
    const x=chartX(cfg,n,i),y0=cfg.y(0);
    moneyKeys.forEach((key,index)=>{
      const v=key==='profit'?d['합계 : 누적손익']:d['합계 : 전일대비손익'];
      const color=chartSeriesColor(key==='profit'?'profit':'daily');
      const off=moneyKeys.length===1?0:(index===0?-barW*.6:barW*.6);
      const y=cfg.y(v),hh=Math.abs(y0-y);
      svg.appendChild(el('rect',{x:x+off-barW/2,y:Math.min(y,y0),width:barW,height:hh,rx:chartExpandedHalfGrowthUnits(svg,3),fill:color,opacity:.9}));
    });
  });
  if(selected.has('compare')){
    const lineColor=chartCompareSeriesColor(mode);
    const pts=data.map((d,i)=>({value:mode==='kospi'?d['코스피 지수']:d['합계 : 누적수익률'],point:[chartX(cfg,n,i),0]})).filter(v=>Number.isFinite(v.value)).map(v=>[v.point[0],cfg.y2(v.value)]);
    if(pts.length){polyline(svg,pts,lineColor,2);circles(svg,pts,lineColor)}
  }
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{
    let html=tooltipDate(d['날짜']);
    if(selected.has('profit'))html+=row('운용손익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']));
    if(selected.has('daily'))html+=row('전일대비손익',signed(d['합계 : 전일대비손익'],'원'),clsBy(d['합계 : 전일대비손익']));
    if(selected.has('compare')){
      const returnValue=d['합계 : 누적수익률'];
      html+=row('운용수익률',(returnValue>0?'+':'')+pct(returnValue),clsBy(returnValue));
      html+=row('코스피 지수',Number.isFinite(d['코스피 지수'])?formatKospi(d['코스피 지수']):'-');
    }
    return html;
  });
}
function drawPensionSymbolChart(){
  const data=pensionSymbolHistory(dataState.activeDate),svg=document.getElementById('pensionChartSymbol');if(!svg||!data.length)return;clear(svg);
  const mode=chartState.symbolModes.pension||'profit',selection=chartSelection('pensionSymbol'),allSeries=chartLegendItems('pensionSymbol').map(item=>item.key),series=allSeries.filter(name=>selection.selected.has(name)),autoY=chartAutoYEnabled('pensionSymbol');
  const valueOf=(d,s)=>mode==='rate'?Number(d._rates?.[s]||0):Number(d[s]||0),axisSeries=autoY?series:allSeries,values=data.flatMap(d=>axisSeries.map(s=>valueOf(d,s))).filter(Number.isFinite);
  const yInfo=mode==='rate'?fixedTickInfo(Math.min(0,...values),Math.max(0,...values),20,true):fixedTickInfo(Math.min(0,...values),Math.max(0,...values),2000000,true),cfg=chartConfig(svg);
  cfg.y=v=>chartY(cfg,yInfo.min,yInfo.max,v);
  cfg.yFormatter=mode==='rate'?(v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+'%'):null;drawAxes(svg,cfg,yInfo.ticks);
  const n=data.length;series.forEach(name=>{const pts=data.map((d,i)=>[chartX(cfg,n,i),cfg.y(valueOf(d,name))]);polyline(svg,pts,pensionSeriesColor(name));circles(svg,pts,pensionSeriesColor(name))});labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=tooltipDate(d['날짜']);series.forEach(s=>{const rawProfit=d[s],profit=Number(rawProfit),rate=Number(d._rates?.[s]);if(rawProfit==null||!Number.isFinite(profit))return;const rateText=Number.isFinite(rate)?`${rate>0?'+':''}${pct(rate)}`:'-';html+=row(chartDisplayLabel('pensionSymbol',s),`${signed(profit,'원')} (${rateText})`,clsBy(profit))});const total=series.reduce((a,s)=>{const raw=d[s],value=Number(raw);return a+(raw!=null&&Number.isFinite(value)?value:0)},0);return html+tooltipDivider()+totalRow(selection.all?'상품 합계':`${series.length}상품 합계`,signed(total,'원'),clsBy(total))},'symbol');
}
function drawPensionStacked(){
  const data=pensionAllocHistory(dataState.activeDate),svg=document.getElementById('pensionChartAlloc');if(!svg||!data.length)return;clear(svg);
  const selection=chartSelection('pensionAlloc'),allSeries=chartLegendItems('pensionAlloc').map(item=>item.key),series=allSeries.filter(s=>selection.selected.has(s)),autoY=chartAutoYEnabled('pensionAlloc');
  const colors=Object.fromEntries(allSeries.map(s=>[s,s==='현금성자산'?CASH_ASSET_COLOR:pensionSeriesColor(s)]));
  const axisSeries=autoY?series:allSeries,totals=data.map(d=>axisSeries.reduce((a,s)=>a+Number(d[s]||0),0));
  const yInfo=fixedTickInfo(0,Math.max(1,...totals),10000000,true),cfg=chartConfig(svg),n=data.length,barW=chartBarWidth(svg,cfg,n,.55,10);
  cfg.edgePad=Math.max(CHART_EDGE_PAD,barW*.62);
  cfg.y=v=>chartY(cfg,yInfo.min,yInfo.max,v);drawAxes(svg,cfg,yInfo.ticks);
  data.forEach((d,i)=>{let acc=0;const x=chartX(cfg,n,i)-barW/2;series.forEach(s=>{const v=Number(d[s]||0),y1=cfg.y(acc+v),y0=cfg.y(acc);svg.appendChild(el('rect',{x,y:y1,width:barW,height:Math.max(0,y0-y1),fill:colors[s],rx:chartExpandedHalfGrowthUnits(svg,2)}));acc+=v})});
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=tooltipDate(d['날짜']);const total=series.reduce((a,s)=>a+Number(d[s]||0),0);series.forEach(s=>html+=row(chartDisplayLabel('pensionAlloc',s),won(d[s]||0),''));return html+tooltipDivider()+totalRow('평가금액 합계',won(total),'')});
}

function securitiesCumAxisValues(d){
  const rows=snapshotDates(d).map(x=>{
    const value=calc(x);
    const baseProfit=value.rawHoldingProfit;
    const separateProfit=separateProfitCumulativeForDate(x);
    const reinvested=separateProfitReinvestedForDate(x);
    const offPrincipal=Math.max(0,value.account1Principal)||1;
    const onPrincipal=Math.max(0,value.account1Principal-reinvested)||1;
    return {
      off:baseProfit,
      on:baseProfit+separateProfit,
      offReturn:baseProfit/offPrincipal*100,
      onReturn:(baseProfit+separateProfit)/onPrincipal*100
    };
  });
  const money=[];
  rows.forEach((row,i)=>{
    const prev=i>0?rows[i-1]:null;
    money.push(
      row.off,
      row.on,
      prev?row.off-prev.off:row.off,
      prev?row.on-prev.on:row.on
    );
  });
  return {
    money:money.filter(Number.isFinite),
    returns:rows.flatMap(row=>[row.offReturn,row.onReturn]).filter(Number.isFinite)
  };
}
// 별도수익 OFF/ON 양쪽 범위를 함께 사용해 토글 시 축을 고정하고 좌우 0선을 같은 높이에 유지한다.
function securitiesCumFullAxes(){
  const values=securitiesCumAxisValues(dataState.activeDate);
  const money=fixedTickInfo(Math.min(0,...values.money),Math.max(0,...values.money),2000000,true);
  const returns=fixedTickInfo(Math.min(0,...values.returns),Math.max(0,...values.returns),10,true);
  const aligned=alignZeroTickRanges(money,2000000,returns,10);
  return {money:aligned[0],returns:aligned[1]};
}
function drawCumChart(){
  const data=cumHistory(dataState.activeDate),svg=document.getElementById('chartCum');if(!svg||!data.length)return;clear(svg);
  const mode=chartState.compareModes.securities||'return',selection=chartSelection('securitiesCum'),selected=selection.selected,autoY=chartAutoYEnabled('securitiesCum');
  const leftAxis=cumulativeMoneyAxis('securitiesCum',data,selected,autoY),rightAxis=cumulativeRightAxis('securitiesCum',data,mode,leftAxis,selected.has('compare'),autoY);
  const yInfo=leftAxis.info,rInfo=rightAxis.info||{min:0,max:1,ticks:[]};
  const cfg=chartConfig(svg),n=data.length,bw=chartBarWidth(svg,cfg,n,.28);
  cfg.edgePad=Math.max(CHART_EDGE_PAD,bw*2.1);
  cfg.y=v=>chartY(cfg,yInfo.min,yInfo.max,v);
  cfg.y2=v=>chartY(cfg,rInfo.min,rInfo.max,v);
  cfg.y2Formatter=mode==='kospi'?(v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})):(v=>v.toFixed(0)+'%');
  drawAxes(svg,cfg,leftAxis.visible?yInfo.ticks:[],rightAxis.visible?rInfo.ticks:null);
  const moneyKeys=[...(selected.has('profit')?['profit']:[]),...(selected.has('daily')?['daily']:[])];
  data.forEach((d,i)=>{
    const x=chartX(cfg,n,i),zero=cfg.y(0);
    if(moneyKeys.length===2){
      const cp=cfg.y(d['합계 : 누적손익']);
      svg.appendChild(el('rect',{x:x-bw-1,y:Math.min(cp,zero),width:bw,height:Math.abs(zero-cp),fill:chartSeriesColor('profit'),opacity:.8}));
      const day=cfg.y(d['합계 : 전일대비손익']);
      svg.appendChild(el('rect',{x:x+2,y:Math.min(day,zero),width:bw,height:Math.abs(zero-day),fill:chartSeriesColor('daily'),opacity:.9}));
      return;
    }
    moneyKeys.forEach((key,index)=>{
      const value=key==='profit'?d['합계 : 누적손익']:d['합계 : 전일대비손익'];
      const y=cfg.y(value),color=chartSeriesColor(key==='profit'?'profit':'daily');
      svg.appendChild(el('rect',{x:x-bw/2,y:Math.min(y,zero),width:bw,height:Math.abs(zero-y),fill:color,opacity:key==='profit'?.8:.9}));
    });
  });
  if(selected.has('compare')){
    const lineColor=chartCompareSeriesColor(mode);
    const pts=data.map((d,i)=>({value:mode==='kospi'?d['코스피 지수']:d['합계 : 누적수익률'],x:chartX(cfg,n,i)})).filter(v=>Number.isFinite(v.value)).map(v=>[v.x,cfg.y2(v.value)]);
    if(pts.length){polyline(svg,pts,lineColor,2);circles(svg,pts,lineColor)}
  }
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{
    let html=tooltipDate(d['날짜']);
    if(selected.has('profit')){
      if(uiState.includeSeparateProfit){
        html+=row('전체 누적손익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']));
        html+=row('기존 포트 손익',signed(d['_기존포트누적손익'],'원'),clsBy(d['_기존포트누적손익']));
        html+=row('6~8월 별도수익',signed(d['_별도수익누적'],'원'),clsBy(d['_별도수익누적']));
        html+=row('성과기준 투입원금',won(d['_성과기준투입원금']));
      }else html+=row('누적손익',signed(d['합계 : 누적손익'],'원'),clsBy(d['합계 : 누적손익']));
    }
    if(selected.has('daily'))html+=row('전일대비손익',signed(d['합계 : 전일대비손익'],'원'),clsBy(d['합계 : 전일대비손익']));
    if(selected.has('compare')){
      html+=row('누적수익률',pct(d['합계 : 누적수익률']),clsBy(d['합계 : 누적수익률']));
      html+=row('코스피 지수',Number.isFinite(d['코스피 지수'])?formatKospi(d['코스피 지수']):'-');
    }
    return html;
  });
}
function drawLineChart(){
  const data=symbolHistory(dataState.activeDate),svg=document.getElementById('chartSymbol');if(!svg)return;clear(svg);
  const mode=chartState.symbolModes.securities||'profit',selection=chartSelection('securitiesSymbol'),allSeries=chartLegendItems('securitiesSymbol').map(item=>item.key),series=allSeries.filter(s=>selection.selected.has(s)),autoY=chartAutoYEnabled('securitiesSymbol');
  const colors=SECURITY_SYMBOL_COLORS,valueOf=(d,s)=>{const value=mode==='rate'?d._rates?.[s]:d[s];return value==null?null:Number(value);},axisSeries=autoY?series:allSeries,values=data.flatMap(d=>axisSeries.map(s=>valueOf(d,s))).filter(Number.isFinite);
  const cfg=chartConfig(svg);
  if(mode==='rate'){
    const yInfo=fixedTickInfo(Math.min(0,...values),Math.max(0,...values),20,true);
    cfg.y=v=>chartY(cfg,yInfo.min,yInfo.max,v);
    cfg.yFormatter=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+'%';drawAxes(svg,cfg,yInfo.ticks);
    const n=data.length;series.forEach(s=>{const pts=data.map((d,i)=>{const value=valueOf(d,s);return Number.isFinite(value)?[chartX(cfg,n,i),cfg.y(value)]:null}).filter(Boolean);if(pts.length){polyline(svg,pts,colors[s]||securityAllocationColor(s));circles(svg,pts,colors[s]||securityAllocationColor(s))}});labelDates(svg,cfg,data,3);
    addHover(svg,cfg,data,d=>{let html=tooltipDate(d['날짜']);series.forEach(s=>{const rawProfit=d[s],profit=Number(rawProfit),rate=Number(d._rates?.[s]);if(rawProfit==null||!Number.isFinite(profit))return;const rateText=Number.isFinite(rate)?`${rate>0?'+':''}${pct(rate)}`:'-';html+=row(chartDisplayLabel('securitiesSymbol',s),`${signed(profit,'원')} (${rateText})`,clsBy(profit))});const total=series.reduce((a,s)=>{const raw=d[s],value=Number(raw);return a+(raw!=null&&Number.isFinite(value)?value:0)},0);return html+tooltipDivider()+totalRow(`${series.length}종목 합계`,signed(total,'원'),clsBy(total))},'symbol');
    return;
  }
  let minY,maxY,ticks;
  if(autoY){
    const info=fixedTickInfo(Math.min(0,...values),Math.max(0,...values),1000000,true);minY=info.min;maxY=info.max;ticks=info.ticks;
  }else{
    const allValues=data.flatMap(d=>allSeries.map(s=>valueOf(d,s))).filter(Number.isFinite);minY=Math.min(-1000000,...allValues);maxY=Math.max(7000000,...allValues);ticks=[-1000000,0,1000000,2000000,3000000,4000000,5000000,6000000,7000000];
  }
  cfg.y=v=>chartY(cfg,minY,maxY,v);drawAxes(svg,cfg,ticks);
  const n=data.length;series.forEach(s=>{const pts=data.map((d,i)=>{const value=valueOf(d,s);return Number.isFinite(value)?[chartX(cfg,n,i),cfg.y(value)]:null}).filter(Boolean);if(pts.length){polyline(svg,pts,colors[s]||securityAllocationColor(s));circles(svg,pts,colors[s]||securityAllocationColor(s))}});labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{let html=tooltipDate(d['날짜']);series.forEach(s=>{const value=valueOf(d,s),rate=d._rates?.[s];if(!Number.isFinite(value))return;html+=row(chartDisplayLabel('securitiesSymbol',s),`${signed(value,'원')} (${Number(rate)>0?'+':''}${pct(rate)})`,clsBy(value))});const total=series.reduce((a,s)=>{const value=valueOf(d,s);return a+(Number.isFinite(value)?value:0)},0);return html+tooltipDivider()+totalRow(`${series.length}종목 합계`,signed(total,'원'),clsBy(total))},'symbol');
}
function drawStacked(){
  const svg=document.getElementById('chartAlloc');if(!svg)return;clear(svg);
  const mode=chartState.securityAllocMode==='symbol'?'symbol':'type',selection=chartSelection('securitiesAlloc'),allSeries=chartLegendItems('securitiesAlloc').map(item=>item.key),series=allSeries.filter(key=>selection.selected.has(key)),autoY=chartAutoYEnabled('securitiesAlloc');
  const symbolSeries=mode==='symbol'?allSeries.filter(key=>key!=='현금'):[];
  const data=mode==='symbol'?securitySymbolAllocHistory(dataState.activeDate,symbolSeries):allocHistory(dataState.activeDate);
  if(!data.length)return;
  const colors=mode==='symbol'?Object.fromEntries(allSeries.map(name=>[name,name==='현금'?CASH_ASSET_COLOR:securityAllocationColor(name)])):ASSET_TYPE_COLORS;
  const axisSeries=autoY?series:allSeries,values=data.map(d=>axisSeries.reduce((a,key)=>a+Number(d[key]||0),0));
  const cfg=chartConfig(svg);
  let minY=0,maxY,ticks;
  if(autoY){
    const info=fixedTickInfo(0,Math.max(1,...values)*1.05,5000000,true);maxY=info.max;ticks=info.ticks;
  }else{
    maxY=Math.max(30000000,...values)*1.05;ticks=[0,5000000,10000000,15000000,20000000,25000000,30000000];
  }
  const n=data.length,bw=chartBarWidth(svg,cfg,n,.72);
  cfg.edgePad=Math.max(CHART_EDGE_PAD,bw*.62);
  cfg.y=v=>chartY(cfg,minY,maxY,v);drawAxes(svg,cfg,ticks);
  data.forEach((d,i)=>{const x=chartX(cfg,n,i)-bw/2;let base=0;series.forEach(key=>{const value=Number(d[key]||0),yTop=cfg.y(base+value),yBase=cfg.y(base);svg.appendChild(el('rect',{x:x,y:yTop,width:bw,height:yBase-yTop,fill:colors[key],opacity:.75,stroke:cssThemeValue('--chart-stack-stroke','#fff'),'stroke-width':chartExpandedHalfGrowthUnits(svg,.4)}));base+=value})});
  labelDates(svg,cfg,data,3);
  addHover(svg,cfg,data,d=>{const displayedTotal=series.reduce((a,key)=>a+Number(d[key]||0),0),total=selection.all?(Number(d._total)||displayedTotal):displayedTotal;let html=tooltipDate(d['날짜']);series.forEach(key=>{const value=Number(d[key]||0),share=total?value/total*100:0;html+=row(chartDisplayLabel('securitiesAlloc',key),fmt(value)+`원 (${share.toFixed(1)}%)`)});return html+tooltipDivider()+totalRow('합계',fmt(total)+'원')});
}
function drawAllCharts(){
  applySecuritiesCumCardTransitionSuppression();
  if(uiState.activeAssetTab==='pension'){
    drawPensionCumChart();
    drawPensionSymbolChart();
    drawPensionStacked();
  }else{
    drawCumChart();
    drawLineChart();
    drawStacked();
  }
  setupResponsiveChartControls();
  const skipEntrance=chartRuntimeState.skipEntranceOnce;
  chartRuntimeState.skipEntranceOnce=false;
  document.querySelectorAll('svg.chart').forEach(svg=>{
    if(skipEntrance){
      const card=svg.closest('.chart-card');
      if(card){
        card.dataset.chartEntrancePlayed='true';
        card.classList.remove('chart-entrance-ready');
        card.classList.add('chart-entrance-active');
      }
    }
    prepareChartEntranceForSvg(svg);
  });
  setupChartEntranceAnimations();
  refreshScrollHints();
  setTimeout(refreshScrollHints,120);
}

function prepareChartsForPrint(){
  if(chartRuntimeState.expanded)closeExpandedChart();
  drawInactiveChartsForPrint();
}
function drawInactiveChartsForPrint(){
  chartRuntimeState.printFixedViewBox=true;
  try{
    if(uiState.activeAssetTab==='pension'){
      drawCumChart();
      drawLineChart();
      drawStacked();
      return;
    }
    drawPensionCumChart();
    drawPensionSymbolChart();
    drawPensionStacked();
  }finally{
    chartRuntimeState.printFixedViewBox=false;
  }
}

// [CHART11] Public API
export {
  drawAllCharts,
  refreshScrollHints,
  handleChartDashboardAction,
  isExpandedChart,
  refreshExpandedSeparateProfitChart,
  renderCharts,
  renderPensionCharts,
  requestSecuritiesCumCardTransitionSuppression,
  setupChartGlobalEvents,
  suppressChartEntranceOnce
};
