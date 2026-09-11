import {
  allAvailableDates,
  calc,
  dataState,
  koreanDateLabel,
  kstTodayText,
  loadInitialData,
  pct,
  separateProfitView,
  uiState,
  won
} from './dashboard-core.js';
import {
  escapeHtml,
  navIconSvg,
  hideAssetSourceTooltip,
  setupAssetSourceTooltips,
  setupAssetVizTooltips
} from './dashboard-ui-common.js';
import {
  bindDashboardModalDismiss,
  closeDashboardModal,
  openDashboardModal
} from './dashboard-modal.js';
import {
  drawAllCharts,
  handleChartDashboardAction,
  isExpandedChart,
  refreshExpandedSeparateProfitChart,
  requestSecuritiesCumCardTransitionSuppression,
  setupChartGlobalEvents,
  suppressChartEntranceOnce
} from './dashboard-charts.js';
import {
  closeAccountMemoInfo,
  closeDateActionMenu,
  ensureDesktopEdgeToc,
  ensureMobileTopButton,
  handleUiDashboardAction,
  handleUiDashboardChange,
  handleUiDashboardKeydown,
  hydrateSectionTitleIcons,
  dateActionMenuIsOpen,
  desktopEdgeTocIsOpen,
  renderCombined,
  renderSecuritiesSection,
  renderTabs,
  restoreDateActionMenuAfterRender,
  restoreDesktopEdgeTocAfterRender,
  setupSectionNavigationTracking,
  setupUiGlobalEvents,
  syncAssetTabs,
  syncCornerThemeControls,
  syncThemeControls
} from './dashboard-ui.js';
import { renderPension } from './dashboard-pension.js';
import { setupLiveValuation } from './dashboard-live-valuation.js';
import {
  openPensionContributionModal,
  renderPensionContributionModal,
  setupPensionEventDelegation
} from './dashboard-pension-editor.js';

// Dashboard App Orchestration · action routing / render / boot
// Structure map:
//   [APP01] Personal View / Separate Profit
//   [APP02] Date Navigation / Chart Date Confirm
//   [APP03] Dashboard Action Routing
//   [APP04] Render Orchestration
//   [APP05] Standalone Pull-to-Refresh
//   [APP06] Initialization / Boot

// [APP01] Personal View / Separate Profit · 개인 보기 / 별도수익
const heroBasisTapState={count:0,lastTap:0};

function togglePersonalView(){
  uiState.personalViewUnlocked=!uiState.personalViewUnlocked;
  if(!uiState.personalViewUnlocked)uiState.includeSeparateProfit=false;
  render();
}
function handleHeroBasisTap(){
  const now=Date.now();
  heroBasisTapState.count=now-heroBasisTapState.lastTap<=700?heroBasisTapState.count+1:1;
  heroBasisTapState.lastTap=now;
  if(heroBasisTapState.count<3)return;
  heroBasisTapState.count=0;
  heroBasisTapState.lastTap=0;
  togglePersonalView();
}
function toggleSeparateProfitMode(){
  const scrollY=window.scrollY;
  uiState.includeSeparateProfit=!uiState.includeSeparateProfit;
  suppressChartEntranceOnce();
  requestSecuritiesCumCardTransitionSuppression();
  render();
  requestAnimationFrame(()=>window.scrollTo({top:scrollY,left:0,behavior:'auto'}));
}
function toggleSeparateProfitModeFromExpanded(cardId){
  if(cardId!=='chart-cum'||!isExpandedChart(cardId))return;
  uiState.includeSeparateProfit=!uiState.includeSeparateProfit;
  refreshExpandedSeparateProfitChart(()=>{
    const scrollY=window.scrollY;
    render();
    requestAnimationFrame(()=>window.scrollTo({top:scrollY,left:0,behavior:'auto'}));
  });
}

// [APP02] Date Navigation / Chart Date Confirm · 날짜 이동 / 차트 날짜 확인
function setActiveDashboardDate(date,{keepDateMenuOpen=false}={}){
  if(!allAvailableDates().includes(date))return false;
  dataState.activeDate=date;
  history.replaceState(null,'','#'+dataState.activeDate);
  render();
  if(keepDateMenuOpen)restoreDateActionMenuAfterRender();
  return true;
}
const chartDateJumpState={date:'',chartId:''};
function chartDateDialogLabel(date){
  const [year,month,day]=String(date||'').split('-').map(Number);
  if(!year||!month||!day)return String(date||'');
  return `${year}년 ${month}월 ${day}일`;
}
function ensureChartDateConfirmModal(){
  let modal=document.getElementById('chartDateConfirmModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='chartDateConfirmModal';
  modal.className='action-modal chart-date-confirm-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="action-modal-card chart-date-confirm-card" role="dialog" aria-modal="true" aria-labelledby="chartDateConfirmTitle" aria-describedby="chartDateConfirmDescription">
    <h3 id="chartDateConfirmTitle" class="modal-main-title">날짜 이동</h3>
    <p id="chartDateConfirmDescription" class="action-modal-description"></p>
    <div class="action-modal-buttons chart-date-confirm-buttons">
      <button type="button" class="control-action-button action-modal-btn ghost" data-dashboard-action="close-chart-date-confirm">취소</button>
      <button type="button" class="control-action-button action-modal-btn primary" data-dashboard-action="confirm-chart-date-jump">이동</button>
    </div>
  </div>`;
  bindDashboardModalDismiss(modal,{onDismiss:closeChartDateConfirmModal,stopEscapePropagation:false});
  document.body.appendChild(modal);
  return modal;
}
function closeChartDateConfirmModal(){
  const modal=document.getElementById('chartDateConfirmModal');
  if(!modal)return;
  closeDashboardModal(modal);
  chartDateJumpState.date='';
  chartDateJumpState.chartId='';
}
function performChartDateJump(date,chartId){
  if(!setActiveDashboardDate(date))return;
  requestAnimationFrame(()=>{
    document.getElementById(chartId)?.scrollIntoView({behavior:'smooth',block:'start'});
  });
}
function requestChartDateJump(date,chartId,returnFocus=null){
  if(!allAvailableDates().includes(date)||!chartId)return;
  if(date===dataState.activeDate)return;
  const modal=ensureChartDateConfirmModal();
  const description=modal.querySelector('#chartDateConfirmDescription');
  if(description)description.textContent=`${chartDateDialogLabel(date)} 화면으로 이동할까요?`;
  chartDateJumpState.date=date;
  chartDateJumpState.chartId=chartId;
  openDashboardModal(modal,{
    initialFocus:modal.querySelector('[data-dashboard-action="close-chart-date-confirm"]'),
    returnFocus:returnFocus||null
  });
}
function confirmChartDateJump(){
  const {date,chartId}=chartDateJumpState;
  const modal=document.getElementById('chartDateConfirmModal');
  if(modal)closeDashboardModal(modal);
  chartDateJumpState.date='';
  chartDateJumpState.chartId='';
  if(date&&chartId)performChartDateJump(date,chartId);
}
function handleDashboardDateChange(target){
  const keepDateMenuOpen=dateActionMenuIsOpen();
  if(target.id==='monthSelect'){
    const dates=allAvailableDates().filter(date=>date.startsWith(target.value));
    const nextDate=dates.at(-1);
    if(nextDate)setActiveDashboardDate(nextDate,{keepDateMenuOpen});
    return true;
  }
  if(target.id==='dateSelect'){
    setActiveDashboardDate(target.value,{keepDateMenuOpen});
    return true;
  }
  return false;
}
// [APP03] Dashboard Action Routing · 대시보드 액션 라우팅
function handleDashboardAction(event,control){
  const action=control.dataset.dashboardAction;
  if(action==='toggle-separate-profit')return toggleSeparateProfitMode();
  if(action==='toggle-separate-profit-expanded')return toggleSeparateProfitModeFromExpanded(control.dataset.expandedChartId||'');
  if(action==='open-pension-modal'){
    openPensionContributionModal();
    closeDateActionMenu();
    return;
  }
  if(action==='hero-basis-tap')return handleHeroBasisTap();
  if(action==='jump-chart-date')return requestChartDateJump(control.dataset.chartDate||'',control.dataset.chartId||'',control);
  if(action==='close-chart-date-confirm')return closeChartDateConfirmModal();
  if(action==='confirm-chart-date-jump')return confirmChartDateJump();
  if(handleChartDashboardAction(event,control))return;
  handleUiDashboardAction(event,control);
}
function setupDashboardEventDelegation(){
  document.addEventListener('click',event=>{
    const control=event.target.closest?.('[data-dashboard-action]');
    if(control)handleDashboardAction(event,control);
  });
  document.addEventListener('change',event=>{
    const target=event.target;
    if(handleUiDashboardChange(target))return;
    handleDashboardDateChange(target);
  });
  document.addEventListener('keydown',event=>{
    if(handleUiDashboardKeydown(event))return;
    if(event.key!=='Enter'&&event.key!==' ')return;
    const control=event.target.closest?.('[data-dashboard-action="jump-chart-date"]');
    if(!control)return;
    event.preventDefault();
    requestChartDateJump(control.dataset.chartDate||'',control.dataset.chartId||'',control);
  });
}
// [APP04] Render Orchestration · 자산 workspace / 전체 렌더링
function renderAssetWorkspace(x){
  if(!x.hasPension)return renderSecuritiesSection(x);
  return `<section id="asset-workspace" class="asset-workspace"><div class="control-tab-group asset-workspace-tabs" role="tablist" aria-label="자산 현황 선택" aria-orientation="horizontal"><button type="button" id="asset-tab-securities" class="control-tab asset-workspace-tab" data-asset-tab="securities" role="tab" aria-controls="asset-panel-securities" data-dashboard-action="set-asset-tab"><span>증권계좌</span></button><button type="button" id="asset-tab-pension" class="control-tab asset-workspace-tab" data-asset-tab="pension" role="tab" aria-controls="asset-panel-pension" data-dashboard-action="set-asset-tab"><span>퇴직연금</span></button></div><div id="asset-panel-securities" class="asset-workspace-panel asset-workspace-panel-securities" data-asset-panel="securities" role="tabpanel" aria-labelledby="asset-tab-securities">${renderSecuritiesSection(x)}</div><div id="asset-panel-pension" class="asset-workspace-panel asset-workspace-panel-pension" data-asset-panel="pension" role="tabpanel" aria-labelledby="asset-tab-pension">${renderPension(x)}</div></section>`;
}

function render(){
  const focusSnapshot=dashboardFocusSnapshot();
  hideAssetSourceTooltip();
  closeAccountMemoInfo();
  const x=calc(dataState.activeDate),v=separateProfitView(x);
  renderTabs();
  const pensionPills=x.hasPension?`<span class="pill hero-profit-pill"><span class="hero-label-default">퇴직연금 운용손익</span><span class="hero-label-mobile">퇴직연금 손익</span> ${won(x.pensionProfit)}</span><span class="pill hero-return-pill">퇴직연금 운용수익률 ${pct(x.pensionReturn)}</span>`:'';
  document.getElementById('app').innerHTML=`<div class="wrap"><header class="hero" id="top-section" aria-labelledby="dashboardTitle"><div class="hero-title-row"><h1 id="dashboardTitle">${dataState.portfolio.meta.title}</h1><time class="hero-basis" datetime="${x.date}" data-dashboard-action="hero-basis-tap">(${koreanDateLabel(x.date)})</time></div><div class="pillbar hero-metric-pills ${x.hasPension?'has-pension':''}" role="group" aria-label="핵심 성과 요약"><span class="pill hero-profit-pill"><span class="hero-label-default">증권계좌 누적손익</span><span class="hero-label-mobile">증권계좌 손익</span> ${won(v.totalProfit)}</span><span class="pill hero-return-pill">증권계좌 누적수익률 ${pct(v.totalReturn)}</span>${pensionPills}</div></header>${renderPensionContributionModal(x)}${x.hasPension?renderCombined(x):''}${renderAssetWorkspace(x)}</div>`;
  hydrateSectionTitleIcons(document.getElementById('app'));
  syncAssetTabs();
  syncThemeControls();
  syncCornerThemeControls();
  drawAllCharts();
  setupAssetVizTooltips('.asset-insight-zone');
  ensureMobileTopButton();
  ensureDesktopEdgeToc();
  setupSectionNavigationTracking();
  restoreDashboardFocus(focusSnapshot);
}
function dashboardFocusSnapshot(){
  const active=document.activeElement;
  if(!active||active===document.body||active===document.documentElement)return null;
  if(!active.closest?.('#tabs,#app,#desktopEdgeToc'))return null;
  if(active.id)return {kind:'id',value:active.id};
  const focusKey=active.dataset?.dashboardFocusKey;
  if(focusKey){
    const matches=[...document.querySelectorAll('[data-dashboard-focus-key]')].filter(node=>node.dataset.dashboardFocusKey===focusKey);
    return {kind:'focus-key',value:focusKey,index:Math.max(0,matches.indexOf(active))};
  }
  const action=active.dataset?.dashboardAction;
  if(action){
    const matches=[...document.querySelectorAll('[data-dashboard-action]')].filter(node=>node.dataset.dashboardAction===action);
    return {kind:'action',value:action,index:Math.max(0,matches.indexOf(active))};
  }
  const href=active.getAttribute?.('href');
  if(href){
    const matches=[...document.querySelectorAll('a[href]')].filter(node=>node.getAttribute('href')===href);
    return {kind:'href',value:href,index:Math.max(0,matches.indexOf(active))};
  }
  return null;
}
function dashboardFocusTarget(snapshot){
  if(!snapshot)return null;
  if(snapshot.kind==='id')return document.getElementById(snapshot.value);
  if(snapshot.kind==='focus-key'){
    const matches=[...document.querySelectorAll('[data-dashboard-focus-key]')].filter(node=>node.dataset.dashboardFocusKey===snapshot.value);
    return matches[snapshot.index]||matches[0]||null;
  }
  if(snapshot.kind==='action'){
    const matches=[...document.querySelectorAll('[data-dashboard-action]')].filter(node=>node.dataset.dashboardAction===snapshot.value);
    return matches[snapshot.index]||matches[0]||null;
  }
  if(snapshot.kind==='href'){
    const matches=[...document.querySelectorAll('a[href]')].filter(node=>node.getAttribute('href')===snapshot.value);
    return matches[snapshot.index]||matches[0]||null;
  }
  return null;
}
function restoreDashboardFocus(snapshot,retryFrames=2){
  if(!snapshot)return;
  const target=dashboardFocusTarget(snapshot);
  if(target){
    try{target.focus?.({preventScroll:true})}catch{target.focus?.()}
    return;
  }
  // Standalone surfaces such as Market AI remount on the frame after #app replacement.
  // Retry only stable keyed targets so unrelated controls never receive guessed focus.
  if(snapshot.kind==='focus-key'&&retryFrames>0){
    requestAnimationFrame(()=>restoreDashboardFocus(snapshot,retryFrames-1));
  }
}
function dashboardNestedScrollSnapshot(){
  return [...document.querySelectorAll('#app .mobile-scroll,#app .chart-wrap')].map((node,index)=>({
    index,
    left:Number(node.scrollLeft)||0,
    top:Number(node.scrollTop)||0
  })).filter(item=>item.left||item.top);
}
function restoreDashboardNestedScroll(snapshot=[]){
  if(!snapshot.length)return;
  const nodes=[...document.querySelectorAll('#app .mobile-scroll,#app .chart-wrap')];
  snapshot.forEach(item=>{
    const node=nodes[item.index];
    if(!node)return;
    node.scrollLeft=Math.min(item.left,Math.max(0,node.scrollWidth-node.clientWidth));
    node.scrollTop=Math.min(item.top,Math.max(0,node.scrollHeight-node.clientHeight));
  });
}
function renderLiveValuationRefresh(){
  if(dataState.activeDate!==kstTodayText())return;
  const scrollX=window.scrollX,scrollY=window.scrollY;
  const nestedScrollSnapshot=dashboardNestedScrollSnapshot();
  const keepDateMenuOpen=dateActionMenuIsOpen();
  const keepDesktopTocOpen=desktopEdgeTocIsOpen();
  suppressChartEntranceOnce();
  requestSecuritiesCumCardTransitionSuppression();
  render();
  if(keepDateMenuOpen)restoreDateActionMenuAfterRender();
  if(keepDesktopTocOpen)restoreDesktopEdgeTocAfterRender();
  requestAnimationFrame(()=>{
    restoreDashboardNestedScroll(nestedScrollSnapshot);
    window.scrollTo({left:scrollX,top:scrollY,behavior:'auto'});
  });
}

// [APP05] Standalone Pull-to-Refresh · 홈화면 Web App 새로고침 제스처
const standalonePullRefreshState={
  bound:false,
  active:false,
  startX:0,
  startY:0,
  dragY:0,
  threshold:80,
  maxOffset:96
};

function dashboardStandaloneMode(){
  return window.matchMedia?.('(display-mode: standalone)').matches===true||window.navigator?.standalone===true;
}

function dashboardPullRefreshBlocked(){
  if(document.body.classList.contains('dashboard-dialog-open'))return true;
  return !!document.querySelector('.chart-expanded-overlay.show,dialog[open]');
}

function dashboardScrollTop(){
  return Math.max(0,Number(window.scrollY||document.documentElement?.scrollTop||document.body?.scrollTop||0));
}

function ensureStandalonePullRefreshIndicator(){
  let indicator=document.getElementById('standalonePullRefresh');
  if(indicator)return indicator;
  indicator=document.createElement('div');
  indicator.id='standalonePullRefresh';
  indicator.className='standalone-pull-refresh';
  indicator.setAttribute('role','status');
  indicator.setAttribute('aria-live','polite');
  indicator.setAttribute('aria-atomic','true');
  indicator.innerHTML='<span class="standalone-pull-refresh-icon" aria-hidden="true">↻</span><span class="standalone-pull-refresh-label">당겨서 새로고침</span>';
  document.body.appendChild(indicator);
  return indicator;
}

function resetStandalonePullRefresh(indicator){
  standalonePullRefreshState.active=false;
  standalonePullRefreshState.dragY=0;
  indicator?.classList.remove('visible','armed');
  indicator?.style.setProperty('--pull-refresh-offset','0px');
  const label=indicator?.querySelector('.standalone-pull-refresh-label');
  if(label)label.textContent='당겨서 새로고침';
}

function setupStandalonePullToRefresh(){
  if(standalonePullRefreshState.bound||!dashboardStandaloneMode()||!('ontouchstart' in window))return;
  standalonePullRefreshState.bound=true;
  const indicator=ensureStandalonePullRefreshIndicator();

  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1||dashboardScrollTop()>1||dashboardPullRefreshBlocked()){
      resetStandalonePullRefresh(indicator);
      return;
    }
    const touch=event.touches[0];
    standalonePullRefreshState.active=true;
    standalonePullRefreshState.startX=touch.clientX;
    standalonePullRefreshState.startY=touch.clientY;
    standalonePullRefreshState.dragY=0;
  },{passive:true});

  document.addEventListener('touchmove',event=>{
    if(!standalonePullRefreshState.active)return;
    if(event.touches.length!==1||dashboardScrollTop()>1||dashboardPullRefreshBlocked()){
      resetStandalonePullRefresh(indicator);
      return;
    }
    const touch=event.touches[0];
    const deltaX=touch.clientX-standalonePullRefreshState.startX;
    const deltaY=touch.clientY-standalonePullRefreshState.startY;
    if(deltaY<=0||Math.abs(deltaX)>deltaY){
      resetStandalonePullRefresh(indicator);
      return;
    }
    standalonePullRefreshState.dragY=deltaY;
    if(deltaY<8){
      indicator.classList.remove('visible','armed');
      indicator.style.setProperty('--pull-refresh-offset','0px');
      const label=indicator.querySelector('.standalone-pull-refresh-label');
      if(label)label.textContent='당겨서 새로고침';
      return;
    }
    event.preventDefault();
    const offset=Math.min(standalonePullRefreshState.maxOffset,Math.round(deltaY*.7));
    const armed=deltaY>=standalonePullRefreshState.threshold;
    indicator.style.setProperty('--pull-refresh-offset',`${offset}px`);
    indicator.classList.add('visible');
    indicator.classList.toggle('armed',armed);
    const label=indicator.querySelector('.standalone-pull-refresh-label');
    if(label)label.textContent=armed?'놓으면 새로고침':'당겨서 새로고침';
  },{passive:false});

  const finish=()=>{
    if(!standalonePullRefreshState.active)return;
    const shouldReload=standalonePullRefreshState.dragY>=standalonePullRefreshState.threshold;
    standalonePullRefreshState.active=false;
    if(!shouldReload){
      resetStandalonePullRefresh(indicator);
      return;
    }
    indicator.classList.remove('armed');
    indicator.classList.add('visible','refreshing');
    indicator.style.setProperty('--pull-refresh-offset','96px');
    const label=indicator.querySelector('.standalone-pull-refresh-label');
    if(label)label.textContent='새로고침 중';
    requestAnimationFrame(()=>window.location.reload());
  };

  document.addEventListener('touchend',finish,{passive:true});
  document.addEventListener('touchcancel',()=>resetStandalonePullRefresh(indicator),{passive:true});
}

// [APP06] Initialization / Boot · 상태 초기화 / 이벤트 바인딩 / 부팅
function initializeDashboardState(){
  const dates=allAvailableDates();
  let requestedDate='';
  try{requestedDate=decodeURIComponent(location.hash.replace(/^#/,''));}catch{}
  dataState.activeDate=dates.includes(requestedDate)?requestedDate:dates.at(-1);
  history.replaceState(null,'','#'+dataState.activeDate);
}

function renderDashboardLoadingState(){
  document.getElementById('app').innerHTML=`<div class="wrap"><div class="note dashboard-loading-note" role="status" aria-live="polite" aria-atomic="true" aria-busy="true"><span class="dashboard-loading-label">데이터를 불러오는 중입니다.</span></div></div>`;
}

function bindAppEvents(){
  setupDashboardEventDelegation();
  setupUiGlobalEvents();
  setupAssetSourceTooltips();
  setupChartGlobalEvents();
  setupPensionEventDelegation({renderDashboard:render});
  setupStandalonePullToRefresh();
}

async function boot(){
  renderDashboardLoadingState();
  await loadInitialData();
  initializeDashboardState();
  bindAppEvents();
  render();
  setupLiveValuation({renderDashboard:renderLiveValuationRefresh});
}

boot().catch(err=>{
  const message=escapeHtml(String(err));
  document.getElementById('app').innerHTML=`<div class="wrap"><div class="note dashboard-error-note" role="alert" aria-labelledby="dashboardLoadErrorTitle"><h2 id="dashboardLoadErrorTitle"><span class="section-title-icon" data-section-title-icon="alertTriangle" aria-hidden="true">${navIconSvg('alertTriangle')}</span>데이터 로딩 오류</h2><pre class="dashboard-error-message">${message}</pre></div></div>`;
})
