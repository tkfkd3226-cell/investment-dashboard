const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const compact=s=>s.replace(/\s+/g,' ');

const index=read('index.html');
const app=read('js/dashboard-app.js');
const ui=read('js/dashboard-ui.js');
const uiCommon=read('js/dashboard-ui-common.js');
const heatmap=read('js/dashboard-heatmap.js');
const common=read('css/common.css');
const tablet=read('css/tablet.css');
const special=read('css/special.css');
const app1=compact(app);
const heatmap1=compact(heatmap);

function sliceBetween(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`범위를 찾지 못함: ${start}`);
  return source.slice(from,to);
}

test('히트맵 1차: importmap과 전용 ES module 경계를 추가한다',()=>{
  assert.match(index,/'dashboard-heatmap\.js'/,'히트맵 module은 importmap cache-bust 대상이어야 한다');
  assert.match(app,/from '\.\/dashboard-heatmap\.js'/,'app router가 히트맵 feature module을 명시적으로 import해야 한다');
  assert.doesNotMatch(heatmap,/\bwindow\s*\./,'히트맵 module은 window 전역 bridge를 만들면 안 된다');
  assert.doesNotMatch(heatmap,/\bfetch\s*\(/,'1차 히트맵은 network fetch를 추가하면 안 된다');
  assert.doesNotMatch(heatmap,/\bsetInterval\s*\(|\bsetTimeout\s*\(/,'1차 히트맵은 polling/timer를 추가하면 안 된다');
  assert.doesNotMatch(heatmap,/market-ai|Market AI endpoint|prices\.json/i,'1차 shell이 가격/Market AI source를 직접 소유하면 안 된다');
});

test('히트맵 1차: Topbar는 월간 손익과 실시간 시세 사이에 단일 진입점을 둔다',()=>{
  const tabs=sliceBetween(ui,'function renderTabs(){','function toggleMobileDataView');
  const monthly=tabs.indexOf('topbar-monthly-action');
  const heat=tabs.indexOf('topbar-heatmap-action');
  const realtime=tabs.indexOf('topbar-realtime-quotes-action');
  assert.ok(monthly>=0&&monthly<heat&&heat<realtime,'Topbar 순서는 월간 손익 → 히트맵 → 실시간 시세여야 한다');
  assert.match(tabs,/topbar-heatmap-action[^>]*data-dashboard-action="open-portfolio-heatmap"/);
  assert.match(tabs,/navIconSvg\('treemap'\)/,'히트맵은 전용 treemap icon을 사용해야 한다');
  assert.match(uiCommon,/treemap:`<svg/,'공통 icon source에 treemap icon이 있어야 한다');
  const menu=sliceBetween(ui,'function renderResponsiveNavigationMenuContent()','function renderDesktopTocContent()');
  assert.doesNotMatch(menu,/open-portfolio-heatmap|히트맵/,'히트맵은 hamburger menu에 중복 노출하지 않는다');
});

test('히트맵 1차: Phone은 밝기 버튼을 Topbar에서 숨기고 hamburger 상단에 제공한다',()=>{
  const tabs=sliceBetween(ui,'function renderTabs(){','function toggleMobileDataView');
  assert.match(tabs,/mobile-nav-theme-action[^>]*data-theme-toggle[^>]*data-dashboard-action="toggle-theme"/,'Phone hamburger header에 theme action이 있어야 한다');
  assert.match(common,/\.date-action-menu\.mobile-combined-menu \.mobile-nav-theme-action\{display:none\}/,'Tablet에서는 hamburger theme action이 중복 노출되지 않아야 한다');
  assert.match(special,/\.date-action-menu\.mobile-combined-menu \.mobile-nav-theme-action\{display:inline-flex\}/,'Phone에서 hamburger theme action이 보여야 한다');
  assert.match(special,/button\.topbar-monthly-action,[^]*button\.topbar-heatmap-action,[^]*button\.topbar-realtime-action,[^]*button\.topbar-market-ai-toggle\{[^}]*display:inline-flex/,'Phone Topbar은 월간·히트맵·실시간·Market AI 연결 진입점을 함께 유지해야 한다');
  assert.match(special,/\.switcher button\.topbar-theme-action\{display:none\}/,'Phone Topbar에서는 theme action만 숨겨 hamburger 상단으로 이동해야 한다');
  assert.match(tabs,/<span>Top바 고정<\/span>/,'Phone hamburger의 고정 스위치 문구는 Top바 고정이어야 한다');
});

test('히트맵 1차: Web/Tablet/Phone 표시 계약을 CSS만으로 전환한다',()=>{
  assert.match(tablet,/\.date-picker-action \.topbar-label-full\{display:none\}/,'Tablet은 주요 action의 full label을 숨겨야 한다');
  assert.match(tablet,/\.date-picker-action \.topbar-label-short\{display:inline\}/,'Tablet은 주요 action의 축약 label을 표시해야 한다');
  assert.doesNotMatch(tablet,/\.date-picker-action \.topbar-heatmap-action\{[^}]*width:var\(--topbar-control-height\)/,'Tablet 히트맵만 icon-only geometry로 축소하면 안 된다');
  assert.doesNotMatch(tablet,/\.topbar-heatmap-action :is\(\.topbar-label-full,\.topbar-label-short\)\{display:none\}/,'Tablet 히트맵 label을 별도로 숨기면 안 된다');
  assert.match(ui,/<span class="topbar-label-short">히트맵<\/span>/,'Tablet에서 히트맵 축약 label이 보여야 한다');
  assert.match(special,/\.switcher button:is\(\.topbar-monthly-action,\.topbar-heatmap-action,\.topbar-realtime-action\)/,'Phone 히트맵은 월간/실시간과 같은 compact button geometry를 써야 한다');
  assert.doesNotMatch(ui,/appendChild\([^)]*topbar-heatmap|insertBefore\([^)]*topbar-heatmap/,'viewport 전환을 위해 히트맵 DOM을 JS로 재배치하면 안 된다');
});

test('히트맵 1차: 공통 modal lifecycle과 3개 segmented mode shell을 재사용한다',()=>{
  assert.match(heatmap,/modal\.className='action-modal portfolio-heatmap-modal'/);
  assert.match(heatmap,/bindDashboardModalDismiss\(modal,\{onDismiss:closePortfolioHeatmap/);
  assert.match(heatmap,/openDashboardModal\(modal,/);
  assert.match(heatmap,/closeDashboardModal\(modal,/);
  assert.match(heatmap,/day:'당일'/);
  assert.match(heatmap,/cumulative:'누적손익'/);
  assert.match(heatmap,/weight:'비중'/);
  assert.match(heatmap,/const portfolioHeatmapState=\{mode:'day'\}/,'기본 mode는 당일이어야 한다');
  assert.match(heatmap,/class="control-tab-group portfolio-heatmap-mode-tabs"/,'기존 control-tab primitive를 재사용해야 한다');
  assert.match(common,/:is\(\.asset-workspace-tabs,\.contrib-target-tabs,\.monthly-calendar-mode-tabs,\.portfolio-heatmap-mode-tabs\)/,'segmented skin은 기존 공통 selector에 합류해야 한다');
  assert.match(common,/\.portfolio-heatmap-modal\{[^}]*--modal-card-width:min\(1160px,100%\)/,'Web heatmap modal은 넓은 shell을 가져야 한다');
  assert.match(tablet,/\.portfolio-heatmap-head\{[^}]*display:grid[^}]*grid-template-columns:1fr/,'Tablet은 title/mode를 두 줄 shell로 전환해야 한다');
  assert.match(special,/\.portfolio-heatmap-modal\{--modal-card-width:100%\}/,'Phone은 거의 full-width modal shell을 사용해야 한다');
  assert.match(special,/\.action-modal:not\(\.monthly-calendar-modal\):not\(\.realtime-quote-modal\):not\(\.portfolio-heatmap-modal\)\{/,'Phone landscape에서도 히트맵은 generic action modal 중앙형 override 대상에서 제외되어야 한다');
});

test('히트맵 1차: app action router가 open/close/mode를 feature owner에 위임한다',()=>{
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.open[^]*?closeDateActionMenu\(\); return openPortfolioHeatmap\(control\)/);
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.close\)return closePortfolioHeatmap\(\)/);
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.setMode\)return setPortfolioHeatmapMode\(control\.dataset\.heatmapMode\|\|''\)/);
  assert.match(heatmap1,/fallbackSelector:portfolioHeatmapFocusFallbackSelector\(\)/,'공통 modal focus return fallback을 제공해야 한다');
});
