import { dataState, shortDate } from './dashboard-core.js';
import { escapeHtml, navIconSvg } from './dashboard-ui-common.js';
import {
  bindDashboardModalDismiss,
  closeDashboardModal,
  openDashboardModal
} from './dashboard-modal.js';

// Portfolio Heatmap · 1차 shell / 진입점 / mode state
// Ownership: 히트맵 feature의 modal shell과 mode state만 소유한다.
// 2차 전까지 canonical holdings 계산, treemap geometry, color scale, live refresh는 의도적으로 구현하지 않는다.
// Structure map:
//   [HEATMAP01] Constants / State
//   [HEATMAP02] Shell Rendering
//   [HEATMAP03] Modal Lifecycle
//   [HEATMAP04] Public API

// [HEATMAP01] Constants / State · 1차 mode control 계약
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

// [HEATMAP02] Shell Rendering · 실제 treemap 대신 1차 placeholder만 렌더
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
      <span>2차에서 평가금액 비중 기반 treemap을 연결합니다.</span>
    </div>
  </div>`;
}

// [HEATMAP03] Modal Lifecycle · 공통 dashboard-modal lifecycle 재사용
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

// [HEATMAP04] Public API
export {
  PORTFOLIO_HEATMAP_ACTION,
  closePortfolioHeatmap,
  openPortfolioHeatmap,
  setPortfolioHeatmapMode
};
