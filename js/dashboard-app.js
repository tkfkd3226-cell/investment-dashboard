import {
  allAvailableDates,
  calc,
  dataState,
  koreanDateLabel,
  loadInitialData,
  pct,
  separateProfitView,
  uiState,
  won
} from './dashboard-core.js';
import {
  escapeHtml,
  navIconSvg
} from './dashboard-ui-common.js';
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
  closeDateActionMenu,
  ensureDesktopEdgeToc,
  ensureMobileTopButton,
  handleUiDashboardAction,
  handleUiDashboardChange,
  handleUiDashboardKeydown,
  hydrateSectionTitleIcons,
  mobileDateMenuIsOpen,
  renderCombined,
  renderSecuritiesSection,
  renderTabs,
  restoreMobileDateMenuAfterRender,
  setupSectionNavigationTracking,
  setupUiGlobalEvents,
  syncAssetTabs,
  syncCornerThemeControls,
  syncThemeControls
} from './dashboard-ui.js';
import {
  renderPension,
  setupPensionVizTooltips
} from './dashboard-pension.js';
import {
  openPensionContributionModal,
  renderPensionContributionModal,
  setupPensionEventDelegation
} from './dashboard-pension-editor.js';

// 메인 대시보드 app action · render · event binding · boot orchestration

function togglePersonalView(){
  uiState.personalViewUnlocked=!uiState.personalViewUnlocked;
  if(!uiState.personalViewUnlocked)uiState.includeSeparateProfit=false;
  render();
}
function handleHeroBasisTap(){
  const now=Date.now();
  uiState.heroBasisTapCount=now-uiState.heroBasisLastTap<=700?uiState.heroBasisTapCount+1:1;
  uiState.heroBasisLastTap=now;
  if(uiState.heroBasisTapCount<3)return;
  uiState.heroBasisTapCount=0;
  uiState.heroBasisLastTap=0;
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

function setActiveDashboardDate(date,{keepMobileMenuOpen=false}={}){
  if(!allAvailableDates().includes(date))return false;
  dataState.activeDate=date;
  history.replaceState(null,'','#'+dataState.activeDate);
  render();
  if(keepMobileMenuOpen)restoreMobileDateMenuAfterRender();
  return true;
}
function jumpToChartDate(date,chartId){
  if(!setActiveDashboardDate(date)) return;
  requestAnimationFrame(()=>{
    document.getElementById(chartId)?.scrollIntoView({behavior:'smooth',block:'start'});
  });
}
function handleDashboardDateChange(target){
  const keepMobileMenuOpen=mobileDateMenuIsOpen();
  if(target.id==='monthSelect'){
    const dates=allAvailableDates().filter(date=>date.startsWith(target.value));
    const nextDate=dates.at(-1);
    if(nextDate)setActiveDashboardDate(nextDate,{keepMobileMenuOpen});
    return true;
  }
  if(target.id==='dateSelect'){
    setActiveDashboardDate(target.value,{keepMobileMenuOpen});
    return true;
  }
  return false;
}
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
  if(action==='jump-chart-date')return jumpToChartDate(control.dataset.chartDate||'',control.dataset.chartId||'');
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
    jumpToChartDate(control.dataset.chartDate||'',control.dataset.chartId||'');
  });
}
function renderAssetWorkspace(x){
  if(!x.hasPension)return renderSecuritiesSection(x);
  return `<section id="asset-workspace" class="asset-workspace"><div class="asset-workspace-tabs" role="tablist" aria-label="자산 현황 선택" aria-orientation="horizontal"><button type="button" id="asset-tab-securities" class="asset-workspace-tab" data-asset-tab="securities" role="tab" aria-controls="asset-panel-securities" data-dashboard-action="set-asset-tab"><span>증권계좌</span></button><button type="button" id="asset-tab-pension" class="asset-workspace-tab" data-asset-tab="pension" role="tab" aria-controls="asset-panel-pension" data-dashboard-action="set-asset-tab"><span>퇴직연금</span></button></div><div id="asset-panel-securities" class="asset-workspace-panel asset-workspace-panel-securities" data-asset-panel="securities" role="tabpanel" aria-labelledby="asset-tab-securities">${renderSecuritiesSection(x)}</div><div id="asset-panel-pension" class="asset-workspace-panel asset-workspace-panel-pension" data-asset-panel="pension" role="tabpanel" aria-labelledby="asset-tab-pension">${renderPension(x)}</div></section>`;
}

function render(){
  const x=calc(dataState.activeDate),v=separateProfitView(x);
  renderTabs();
  const pensionPills=x.hasPension?`<span class="pill hero-profit-pill"><span class="hero-label-default">퇴직연금 운용수익</span><span class="hero-label-mobile">퇴직연금 수익</span> ${won(x.pensionProfit)}</span><span class="pill hero-return-pill">퇴직연금 운용수익률 ${pct(x.pensionReturn)}</span>`:'';
  document.getElementById('app').innerHTML=`<div class="wrap"><header class="hero" id="top-section" aria-labelledby="dashboardTitle"><div class="hero-title-row"><h1 id="dashboardTitle">${dataState.portfolio.meta.title}</h1><time class="hero-basis" datetime="${x.date}" data-dashboard-action="hero-basis-tap">(${koreanDateLabel(x.date)})</time></div><div class="pillbar hero-metric-pills ${x.hasPension?'has-pension':''}" role="group" aria-label="핵심 성과 요약"><span class="pill hero-profit-pill"><span class="hero-label-default">증권계좌 누적손익</span><span class="hero-label-mobile">증권계좌 손익</span> ${won(v.totalProfit)}</span><span class="pill hero-return-pill">증권계좌 누적손익률 ${pct(v.totalReturn)}</span>${pensionPills}</div></header>${renderPensionContributionModal(x)}${x.hasPension?renderCombined(x):''}${renderAssetWorkspace(x)}</div>`;
  hydrateSectionTitleIcons(document.getElementById('app'));
  syncAssetTabs();
  syncThemeControls();
  syncCornerThemeControls();
  drawAllCharts();
  setupPensionVizTooltips();
  ensureMobileTopButton();
  ensureDesktopEdgeToc();
  setupSectionNavigationTracking();
}
function initializeDashboardState(){
  const dates=allAvailableDates();
  dataState.activeDate=dates.at(-1);
  history.replaceState(null,'','#'+dataState.activeDate);
}

function bindAppEvents(){
  setupDashboardEventDelegation();
  setupUiGlobalEvents();
  setupChartGlobalEvents();
  setupPensionEventDelegation({renderDashboard:render});
}

async function boot(){
  await loadInitialData();
  initializeDashboardState();
  bindAppEvents();
  render();
}

boot().catch(err=>{
  const message=escapeHtml(String(err));
  document.getElementById('app').innerHTML=`<div class="wrap"><div class="note dashboard-error-note" role="alert" aria-labelledby="dashboardLoadErrorTitle"><h2 id="dashboardLoadErrorTitle"><span class="section-title-icon" data-section-title-icon="alertTriangle" aria-hidden="true">${navIconSvg('alertTriangle')}</span>데이터 로딩 오류</h2><pre class="dashboard-error-message">${message}</pre></div></div>`;
})

