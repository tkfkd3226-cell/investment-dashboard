// 메인 대시보드 app action · render · event binding · boot orchestration

function enterPersonalView(){
  if(uiState.personalViewUnlocked)return;
  uiState.personalViewUnlocked=true;
  render();
}
function handleHeroBasisTap(){
  if(uiState.personalViewUnlocked)return;
  const now=Date.now();
  uiState.heroBasisTapCount=now-uiState.heroBasisLastTap<=700?uiState.heroBasisTapCount+1:1;
  uiState.heroBasisLastTap=now;
  if(uiState.heroBasisTapCount<3)return;
  uiState.heroBasisTapCount=0;
  uiState.heroBasisLastTap=0;
  enterPersonalView();
}
function toggleSeparateProfitMode(){
  const scrollY=window.scrollY;
  uiState.includeSeparateProfit=!uiState.includeSeparateProfit;
  chartState.skipEntranceOnce=true;
  chartState.skipSecuritiesCumCardTransitionOnce=true;
  render();
  requestAnimationFrame(()=>window.scrollTo({top:scrollY,left:0,behavior:'auto'}));
}
function toggleSeparateProfitModeFromExpanded(cardId){
  if(!chartState.expanded||cardId!=='chart-cum')return;
  uiState.includeSeparateProfit=!uiState.includeSeparateProfit;
  document.querySelectorAll('.separate-profit-toggle').forEach(toggle=>{
    toggle.classList.toggle('active',uiState.includeSeparateProfit);
    toggle.setAttribute('aria-pressed',String(uiState.includeSeparateProfit));
    const state=toggle.querySelector('strong');
    if(state)state.textContent=uiState.includeSeparateProfit?'ON':'OFF';
  });
  const expandedControl=chartState.expanded.expandedSeparateProfitControl;
  const note=expandedControl?.querySelector('.separate-profit-control-note');
  if(uiState.includeSeparateProfit){
    const profit=separateProfitCumulativeForDate(dataState.activeDate);
    if(note)note.textContent=`선택일 ${signed(profit,'원')}`;
    else if(expandedControl){
      const span=document.createElement('span');
      span.className='separate-profit-control-note';
      span.textContent=`선택일 ${signed(profit,'원')}`;
      expandedControl.prepend(span);
    }
  }else{
    note?.remove();
  }
  drawCumChart();
  chartState.expanded.afterClose=()=>{
    const scrollY=window.scrollY;
    render();
    requestAnimationFrame(()=>window.scrollTo({top:scrollY,left:0,behavior:'auto'}));
  };
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
  if(action==='toggle-separate-profit') return toggleSeparateProfitMode();
  if(action==='toggle-separate-profit-expanded') return toggleSeparateProfitModeFromExpanded(control.dataset.expandedChartId||'');
  if(action==='close-date-menu') return closeDateActionMenu();
  if(action==='toggle-date-menu') return toggleDateActionMenu(event);
  if(action==='krx-update') return triggerKrxPriceUpdate();
  if(action==='open-pension-modal'){
    openPensionContributionModal();
    closeDateActionMenu();
    return;
  }
  if(action==='toggle-theme') return toggleTheme();
  if(action==='toggle-corner-theme') return toggleCornerTheme();
  if(action==='jump-section'){
    jumpToSection(control.dataset.sectionTarget||'');
    if(control.dataset.closeDateMenu==='true')closeDateActionMenu();
    return;
  }
  if(action==='toggle-mobile-view') return toggleMobileDataView(control.dataset.mobileViewKey||'');
  if(action==='open-expanded-chart') return openExpandedChart(control);
  if(action==='scroll-chart-start') return scrollChartToStart(control);
  if(action==='scroll-chart-end') return scrollChartToEnd(control);
  if(action==='toggle-chart-title-info') return toggleChartTitleInfo(event,control);
  if(action==='toggle-chart-series'){
    const key=control.dataset.chartSeriesKey||'';
    return toggleChartSeries(control.dataset.chartScope||'',key==='__all__'?key:decodeURIComponent(key));
  }
  if(action==='set-chart-auto-y') return setChartAutoY(control.dataset.chartScope||'',control.dataset.chartAutoY==='true');
  if(action==='set-chart-compare-mode') return setChartCompareMode(control.dataset.chartCompareScope||'',control.dataset.chartCompareMode||'return');
  if(action==='set-symbol-chart-mode') return setSymbolChartMode(control.dataset.symbolChartScope||'',control.dataset.symbolChartMode||'profit');
  if(action==='set-security-alloc-mode') return setSecurityAllocMode(control.dataset.securityAllocMode||'type');
  if(action==='close-krx-modal') return closeKrxActionModal();
  if(action==='submit-krx-modal') return submitKrxActionModal(control.dataset.krxMode||'selected');
  if(action==='set-asset-tab') return setAssetTab(control.dataset.assetTab||'securities');
  if(action==='hero-basis-tap') return handleHeroBasisTap();
  if(action==='jump-chart-date') return jumpToChartDate(control.dataset.chartDate||'',control.dataset.chartId||'');
}
function setupDashboardEventDelegation(){
  const root=document.documentElement;
  if(root.dataset.dashboardEventsBound==='1')return;
  root.dataset.dashboardEventsBound='1';
  document.addEventListener('click',event=>{
    const control=event.target.closest?.('[data-dashboard-action]');
    if(control)handleDashboardAction(event,control);
  });
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target?.dataset?.dashboardChange==='mobile-date-pin'){
      setMobileDatePinned(target.checked);
      return;
    }
    handleDashboardDateChange(target);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const control=event.target.closest?.('[data-dashboard-action="jump-chart-date"]');
    if(!control)return;
    event.preventDefault();
    jumpToChartDate(control.dataset.chartDate||'',control.dataset.chartId||'');
  });
}
function renderAssetWorkspace(x){
  if(!x.hasPension)return renderSecuritiesSection(x);
  return `<section id="asset-workspace" class="asset-workspace"><div class="asset-workspace-tabs" role="tablist" aria-label="자산 현황 선택"><button type="button" class="asset-workspace-tab" data-asset-tab="securities" role="tab" aria-controls="asset-panel-securities" data-dashboard-action="set-asset-tab"><span>증권계좌</span></button><button type="button" class="asset-workspace-tab" data-asset-tab="pension" role="tab" aria-controls="asset-panel-pension" data-dashboard-action="set-asset-tab"><span>퇴직연금</span></button></div><div id="asset-panel-securities" class="asset-workspace-panel asset-workspace-panel-securities" data-asset-panel="securities" role="tabpanel">${renderSecuritiesSection(x)}</div><div id="asset-panel-pension" class="asset-workspace-panel asset-workspace-panel-pension" data-asset-panel="pension" role="tabpanel">${renderPension(x)}</div></section>`;
}

function render(){
  const x=calc(dataState.activeDate),v=separateProfitView(x);
  renderTabs();
  const pensionPills=x.hasPension?`<span class="pill hero-profit-pill">퇴직연금 운용수익 ${won(x.pensionProfit)}</span><span class="pill hero-return-pill">퇴직연금 운용수익률 ${pct(x.pensionReturn)}</span>`:'';
  document.getElementById('app').innerHTML=`<div class="wrap"><header class="hero" id="top-section"><div class="hero-title-row"><h1>${dataState.portfolio.meta.title}</h1><span class="hero-basis" data-dashboard-action="hero-basis-tap">(${koreanDateLabel(x.date)})</span></div><div class="pillbar hero-metric-pills ${x.hasPension?'has-pension':''}"><span class="pill hero-profit-pill">증권계좌 누적손익 ${won(v.totalProfit)}</span><span class="pill hero-return-pill">증권계좌 누적손익률 ${pct(v.totalReturn)}</span>${pensionPills}</div></header>${renderPensionContributionModal(x)}${x.hasPension?renderCombined(x):''}${renderAssetWorkspace(x)}</div>`;
  syncAssetTabs();
  syncThemeControls();
  syncCornerThemeControls();
  suppressSecuritiesCumCardTransitionOnce();
  drawAllCharts();
  setupPensionVizTooltips();
  ensureMobileTopButton();
  ensureDesktopEdgeToc();
}
function initializeDashboardState(){
  const dates=allAvailableDates();
  dataState.activeDate=dates.at(-1);
  history.replaceState(null,'','#'+dataState.activeDate);
}

function bindAppEvents(){
  registerPensionHooks({renderDashboard:render});
  setupDashboardEventDelegation();
  setupPensionEventDelegation();
  window.addEventListener('resize',syncMobileTopbarState,{passive:true});
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.svg-hitbox')&&!e.target.closest('#dashTooltip'))clearChartHover();
  });
}

async function boot(){
  await loadInitialData();
  initializeDashboardState();
  bindAppEvents();
  render();
}

boot().catch(err=>{
  document.getElementById('app').innerHTML=`<div class="wrap"><div class="note"><h2><span class="section-title-icon">⚠️</span>데이터 로딩 오류</h2><pre>${String(err)}</pre></div></div>`;
})

