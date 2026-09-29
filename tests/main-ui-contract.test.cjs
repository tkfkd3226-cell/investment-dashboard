const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const compact=s=>s.replace(/\s+/g,' ');

const index=read('index.html');
const common=read('css/common.css');
const tablet=read('css/tablet.css');
const mobile=read('css/mobile.css');
const special=read('css/special.css');
const interaction=read('css/interaction.css');
const print=read('css/print.css');
const charts=read('js/dashboard-charts.js');
const core=read('js/dashboard-core.js');
const modal=read('js/dashboard-modal.js');
const monthlyCalendar=read('js/dashboard-monthly-calendar.js');
const uiCommon=read('js/dashboard-ui-common.js');
const ui=read('js/dashboard-ui.js');
const pension=read('js/dashboard-pension.js');
const pensionEditor=read('js/dashboard-pension-editor.js');
const marketAi=read('js/dashboard-market-ai.js');
const marketAiClient=read('js/dashboard-market-ai-client.js');
const liveValuation=read('js/dashboard-live-valuation.js');
const app=read('js/dashboard-app.js');

const common1=compact(common);
const special1=compact(special);
const charts1=compact(charts);
const modal1=compact(modal);
const ui1=compact(ui);
const market1=compact(marketAi);
const index1=compact(index);

function importsOf(source){
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
}

test('Main boot contract: canonical CSS와 app/Market AI module entry를 로드한다',()=>{
  for(const file of ['common.css','tablet.css','mobile.css','special.css','interaction.css','print.css']){
    assert.match(index,new RegExp(`(?:css/)?${file.replace('.', '\\.')}`),`${file}가 Main에서 로드돼야 한다`);
  }
  assert.match(index,/'kodex-leverage-schema\.js'/,'공통 KODEX validator는 importmap cache-bust 대상이어야 한다');
  assert.match(index,/type="module" src="js\/dashboard-app\.js\?v=/);
  assert.match(index,/type="module" src="js\/dashboard-market-ai\.js\?v=/);
  assert.doesNotMatch(index,/'dashboard-responsive\.js'/,'폐기된 responsive entry가 되살아나면 안 된다');
});

test('Main appearance 두 control은 localStorage와 BroadcastChannel을 함께 갱신한다',()=>{
  assert.match(ui1,/const THEME_STORAGE_KEY='investmentDashboard\.theme'/);
  assert.match(ui1,/const CORNER_THEME_STORAGE_KEY='investmentDashboard\.cornerTheme'/);
  assert.match(ui1,/const APPEARANCE_CHANNEL_NAME='investmentDashboard\.appearance'/);
  assert.match(ui1,/appearanceChannel=new BroadcastChannel\(APPEARANCE_CHANNEL_NAME\)/);
  assert.match(ui1,/function publishAppearanceChange\(\)\{ try\{appearanceChannel\?\.postMessage\(\{theme:currentTheme\(\),cornerTheme:currentCornerTheme\(\)\}\)\}catch\(_\)\{\} \}/);
  assert.match(ui1,/function setTheme\(theme,\{redraw=false,syncMonitor=true\}=\{\}\)\{[^]*?localStorage\.setItem\(THEME_STORAGE_KEY,dark\?'dark':'light'\)[^]*?syncThemeControls\(\); publishAppearanceChange\(\);[^]*?if\(syncMonitor\)publishRealtimeMonitorTheme\(dark\?'dark':'light'\);/);
  assert.match(charts,/function cssThemePaint\(name,fallback\)\{\s*return `var\(\$\{name\},\$\{fallback\}\)`;\s*\}/,'차트 theme paint는 CSS 변수 참조를 유지해 theme 전환에 redraw가 필요 없어야 한다');
  assert.match(ui1,/function setCornerTheme\(theme\)\{[^]*?localStorage\.setItem\(CORNER_THEME_STORAGE_KEY,rounded\?'rounded':'soft-square'\)[^]*?syncCornerThemeControls\(\); publishAppearanceChange\(\);/);
});

test('Main module architecture는 순수 core·공통 UI owner·중립 Market AI client 경계를 유지한다',()=>{
  assert.doesNotMatch(core,/\bdocument\b/);
  assert.doesNotMatch(core,/\bwindow\b/);
  assert.deepEqual(importsOf(modal),[]);
  assert.deepEqual(importsOf(marketAi),['./dashboard-market-ai-client.js']);
  assert.deepEqual(importsOf(marketAiClient),[]);
  assert.deepEqual(importsOf(liveValuation),['./dashboard-core.js','./dashboard-market-ai-client.js']);

  assert.match(uiCommon,/function refreshScrollOverflowState\(\)\{[^]*?\.mobile-scroll, \.chart-wrap[^]*?classList\.toggle\('is-scrollable',scrollable\)/);
  assert.match(charts,/import\s*\{[^}]*refreshScrollOverflowState[^}]*\}\s*from '\.\/dashboard-ui-common\.js'/);
  assert.doesNotMatch(charts,/function refreshScrollOverflowState\(/);
  assert.match(ui,/import\s*\{[^}]*refreshScrollOverflowState[^}]*\}\s*from '\.\/dashboard-ui-common\.js'/);
  assert.doesNotMatch(ui,/import\s*\{[^}]*refreshScrollOverflowState[^}]*\}\s*from '\.\/dashboard-charts\.js'/);

  const imports=importsOf(app);
  for(const dependency of [
    './dashboard-core.js','./dashboard-ui-common.js','./dashboard-modal.js','./dashboard-charts.js',
    './dashboard-monthly-calendar.js','./dashboard-ui.js','./dashboard-pension.js','./dashboard-pension-editor.js','./dashboard-live-valuation.js'
  ])assert.ok(imports.includes(dependency),`missing app dependency ${dependency}`);
  assert.equal(imports.includes('./dashboard-market-ai.js'),false);
  const uiCommonImport=app.match(/import\s*\{([^]*?)\}\s*from '\.\/dashboard-ui-common\.js';/);
  assert.ok(uiCommonImport&&/\bphoneUi\b/.test(uiCommonImport[1]),'app이 사용하는 phoneUi는 ui-common에서 명시적으로 import해야 한다');
});

test('Main ES modules는 브라우저와 같은 module 문법으로 parse된다',()=>{
  const moduleFiles=fs.readdirSync(path.join(ROOT,'js')).filter(file=>file.endsWith('.js')).sort();
  for(const file of moduleFiles){
    const source=read(`js/${file}`);
    const parsed=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8'});
    assert.equal(parsed.status,0,parsed.stderr||parsed.stdout||`${file} module syntax error`);
  }
});

test('Tablet/Phone hamburger는 공통 menu source에서 Tablet Topbar 중복만 즉시 숨긴다',()=>{
  const responsiveMenu=ui.slice(ui.indexOf('function renderResponsiveNavigationMenuContent()'),ui.indexOf('function renderDesktopTocContent()'));
  const linkGroupIndex=responsiveMenu.indexOf("label:'링크'");
  const manageGroupIndex=responsiveMenu.indexOf("label:'관리'");
  const tocGroupIndex=responsiveMenu.indexOf('...tocGroups');
  assert.ok(linkGroupIndex>=0&&linkGroupIndex<manageGroupIndex&&manageGroupIndex<tocGroupIndex,'hamburger source는 링크 → 관리 → section 목차 순서를 유지해야 한다');
  assert.doesNotMatch(responsiveMenu,/label:'목차'/,'Tablet/Phone hamburger에는 별도 목차 header group을 다시 만들면 안 된다');
  const nasdaqLinkIndex=responsiveMenu.indexOf("title:'나스닥100 선물'");
  const calculatorLinkIndex=responsiveMenu.indexOf("title:'투자 계산기'");
  assert.ok(nasdaqLinkIndex>=0&&nasdaqLinkIndex<calculatorLinkIndex&&calculatorLinkIndex<manageGroupIndex,'투자 계산기는 링크 그룹의 나스닥100 선물 바로 아래에 있어야 한다');
  assert.match(responsiveMenu,/title:'투자 계산기'[^}]*tabletTopbarDuplicate:true/,'Tablet에서는 Topbar와 중복되는 투자 계산기 링크를 숨길 수 있어야 한다');
  assert.match(responsiveMenu,/label:'관리',[^}]*tabletTopbarDuplicate:true/,'Tablet에서는 Topbar와 중복되는 관리 그룹을 숨길 수 있어야 한다');
  assert.match(common,/\.switcher\.tablet-topbar-ui \.date-action-menu\.mobile-combined-menu :is\(\.mobile-nav-group-tablet-topbar-duplicate,\.mobile-nav-item-tablet-topbar-duplicate\)\{display:none\}/,'Tablet 상태에서는 Topbar 중복 메뉴를 즉시 숨겨야 한다');
  assert.match(ui,/classList\.toggle\('tablet-topbar-ui',tabletTopbarUi\(\)\)/,'viewport 상태 동기화가 Tablet 중복 메뉴 표시를 즉시 갱신해야 한다');
  assert.match(ui,/visualViewport\?\.addEventListener\('resize',\(\)=>\{[^]*?syncMobileTopbarState\(\)/,'F12/device viewport 변경도 새로고침 없이 즉시 동기화해야 한다');
  const menuHead=ui.slice(ui.indexOf('<div class="mobile-nav-head">'),ui.indexOf('</div>${renderResponsiveNavigationMenuContent()}'));
  assert.match(menuHead,/mobile-date-pin-control[^]*?mobile-nav-head-actions[^]*?mobile-nav-corner-action[^]*?close-date-menu/,'Phone hamburger header는 날짜 고정을 왼쪽에 두고 모서리 변경·닫기를 오른쪽 action으로 묶어야 한다');
  assert.match(common,/\.date-action-menu\.mobile-combined-menu \.mobile-nav-corner-action\{display:none\}/,'Tablet hamburger에는 모서리 변경 action을 중복 노출하지 않아야 한다');
  assert.match(special,/\.date-action-menu\.mobile-combined-menu \.mobile-nav-corner-action\{display:inline-flex\}/,'Phone hamburger에서만 모서리 변경 action을 제공해야 한다');
});

test('Tablet/Phone hamburger panel은 공통 viewport 높이 contract를 공유한다',()=>{
  const menuStart=common.indexOf('.date-action-menu.mobile-combined-menu{');
  const menuEnd=common.indexOf('\n}',menuStart);
  const menuBlock=common.slice(menuStart,menuEnd);
  assert.match(menuBlock,/--nav-menu-viewport-clearance:[^;]+;/,'hamburger viewport clearance는 공통 owner가 가져야 한다');
  assert.match(menuBlock,/max-height:calc\(100vh - var\(--nav-menu-viewport-clearance\)\)/,'vh fallback을 공통으로 가져야 한다');
  assert.match(menuBlock,/max-height:calc\(100dvh - var\(--nav-menu-viewport-clearance\)\)/,'동적 viewport 높이도 공통으로 사용해야 한다');
  assert.match(menuBlock,/overflow:auto/,'작은 높이에서만 공통 panel이 스크롤 owner가 되어야 한다');
  assert.doesNotMatch(tablet,/\.date-action-menu\.mobile-combined-menu\{[^}]*max-height:/,'Tablet이 별도 max-height cap을 가지면 Phone보다 먼저 스크롤이 생길 수 있다');
  assert.doesNotMatch(special,/\.date-action-menu\.mobile-combined-menu\{[^}]*max-height:/,'Phone도 공통 menu height contract를 우회하면 안 된다');
});



test('Dashboard 날짜 이동은 Web 좌우 버튼과 Tablet/Phone swipe가 canonical activeDate 경로를 공유한다',()=>{
  assert.match(app,/function dashboardDateNeighbor\(delta\)\{[^]*?allAvailableDates\(\)[^]*?dates\.indexOf\(dataState\.activeDate\)[^]*?nextIndex=index\+\(delta<0\?-1:1\)/,'이전/다음 날짜는 정렬된 canonical available dates에서 계산해야 한다');
  assert.match(app,/function shiftActiveDashboardDate\(delta,\{announce=false\}=\{\}\)\{[^]*?dashboardDateNeighbor\(delta\)[^]*?setActiveDashboardDate\(nextDate\)[^]*?showAppToast\(`\$\{dashboardDateLabel\(nextDate\)\}로 이동했습니다\.`,'ok',1800\)/,'버튼과 swipe는 canonical setActiveDashboardDate를 재사용하고 touch 이동은 자동 종료 toast를 보여야 한다');
  assert.match(app,/data-dashboard-action="previous-dashboard-date"[^]*?&lt;[^]*?data-dashboard-action="next-dashboard-date"[^]*?&gt;/,'Web edge 날짜 이동은 화살표가 아니라 < / > glyph를 사용해야 한다');
  assert.match(ui,/topbar-date-step-prev[^>]*data-dashboard-action="previous-dashboard-date"[^]*?&lt;[^]*?topbar-date-step-next[^>]*data-dashboard-action="next-dashboard-date"[^]*?&gt;/,'좁은 Web Topbar도 동일한 < / > 날짜 이동 action을 제공해야 한다');
  assert.match(app,/if\(action==='previous-dashboard-date'\)return shiftActiveDashboardDate\(-1\);[^]*?if\(action==='next-dashboard-date'\)return shiftActiveDashboardDate\(1\);/,'Web 좌측은 전날짜, 우측은 다음날짜로 이동해야 한다');
  assert.match(app,/DASHBOARD_DATE_SWIPE_MIN_DISTANCE=72/,'touch swipe는 짧은 수평 이동을 날짜 전환으로 오인하면 안 된다');
  assert.match(app,/DASHBOARD_DATE_SWIPE_AXIS_RATIO=1\.25/,'touch swipe는 세로 scroll보다 수평 의도가 충분히 강해야 한다');
  assert.match(app,/dashboardDateSwipeBlockedTarget\(target\)[^]*?a,button,input,select,textarea,label[^]*?\.mobile-scroll,\.chart-wrap,svg,canvas/,'interactive/control/chart/horizontal scroll 시작점은 날짜 swipe에서 제외해야 한다');
  assert.match(app,/shiftActiveDashboardDate\(deltaX>0\?-1:1,\{announce:true\}\)/,'실사용 계약대로 좌→우 touch는 이전 날짜, 우→좌 touch는 다음 날짜여야 한다');
  assert.match(common,/@media \(min-width:1101px\) and \(max-width:1823px\)\{[^}]*\.topbar-date-step\{display:inline-flex\}/,'side rail이 부족한 Web은 fixed edge button 대신 Topbar 날짜 이동을 사용해야 한다');
  assert.match(common,/@media \(min-width:1824px\)\{[^]*?\.dashboard-date-navigation\{[^]*?display:block[^]*?position:fixed[^]*?\.dashboard-date-nav-btn\{[^]*?top:50%/,'충분한 side rail이 있는 Web에서만 날짜 이동을 화면 세로 중앙 edge control로 노출해야 한다');
  assert.match(common,/--dashboard-date-nav-edge:calc\(var\(--edge-rail-inset\) \+ var\(--edge-rail-control-width\) \+ var\(--edge-rail-gap\)\);[^]*?\.dashboard-date-nav-prev\{left:var\(--dashboard-date-nav-edge\)\}[^]*?\.dashboard-date-nav-next\{right:var\(--dashboard-date-nav-edge\)\}/,'Web 좌우 날짜 버튼은 TOC rail을 피하는 같은 edge 계산을 대칭으로 재사용해야 한다');
  assert.match(print,/\.dashboard-date-navigation/,'인쇄에서는 화면 날짜 이동 control을 숨겨야 한다');
});

test('월간 손익 캘린더는 기존 계산·modal·날짜 이동 contract를 재사용한다',()=>{
  assert.match(index,/'dashboard-monthly-calendar\.js'/,'월간 캘린더 module은 importmap cache-bust 대상이어야 한다');
  assert.match(ui,/topbar-monthly-action[^>]*data-dashboard-action="open-monthly-calendar"/,'월간 손익은 공통 Topbar action으로 진입해야 한다');
  const responsiveMenu=ui.slice(ui.indexOf('function renderResponsiveNavigationMenuContent()'),ui.indexOf('function renderDesktopTocContent()'));
  assert.doesNotMatch(responsiveMenu,/action:'open-monthly-calendar'/,'Topbar action을 hamburger에 중복 배치하면 안 된다');

  assert.match(monthlyCalendar,/combinedDailyProfitChange\(date\)/,'합산 일손익은 core helper를 재사용해야 한다');
  assert.match(monthlyCalendar,/const securities=securitiesDailyProfitChange\(date\)/,'증권 범위는 core helper를 재사용해야 한다');
  assert.match(monthlyCalendar,/pensionDailyProfitChange\(date\)/,'퇴직연금 범위는 core helper를 재사용해야 한다');
  assert.match(monthlyCalendar,/separateProfitDailyChangeForDate\(date\)/,'별도수익 ON은 core의 당일 증가분을 사용해야 한다');
  assert.doesNotMatch(monthlyCalendar,/\bcalc\(date\)|separateProfitCumulativeForDate\(date\)/,'calendar가 날짜별 계산을 중복 소유하면 안 된다');
  assert.match(monthlyCalendar,/combined:\{label:'합산'[^]*?securities:\{label:'증권'[^]*?pension:\{label:'퇴직연금'/,'범위는 합산·증권·퇴직연금 3개를 유지해야 한다');

  assert.match(monthlyCalendar,/class="control-tab monthly-calendar-mode-tab/,'범위 switch는 공통 control-tab을 재사용해야 한다');
  assert.match(monthlyCalendar,/if\(!uiState\.personalViewUnlocked\)return '';/,'월간 별도수익 toggle은 개인보기에서만 노출되어야 한다');
  assert.match(monthlyCalendar,/data-dashboard-action="toggle-separate-profit"/,'별도수익 toggle은 기존 canonical action을 재사용해야 한다');
  assert.match(monthlyCalendar,/modal\.className='action-modal monthly-calendar-modal'/,'월간 캘린더는 공통 action modal shell을 재사용해야 한다');
  assert.match(monthlyCalendar,/openDashboardModal\(modal,/);
  assert.match(monthlyCalendar,/closeDashboardModal\(modal,/);

  assert.match(app,/action===MONTHLY_CALENDAR_ACTION\.setMode[^]*?setMonthlyCalendarMode\(control\.dataset\.calendarMode\|\|''\)/,'범위 전환은 calendar state owner에 위임해야 한다');
  assert.match(app,/action===MONTHLY_CALENDAR_ACTION\.selectDate[^]*?closeMonthlyCalendar\(\);[^]*?setActiveDashboardDate\(date\)/,'날짜 선택은 canonical activeDate 경로로 위임해야 한다');
  assert.match(monthlyCalendar,/aria-disabled=/,'월 경계 이동 control은 focusable aria-disabled 상태를 유지해야 한다');
  assert.match(common,/\.monthly-calendar-grid\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/,'calendar는 월~금 5열 grid를 유지해야 한다');
  assert.match(monthlyCalendar,/if\(weekdayIndex>=5\)continue/,'토·일 날짜 cell을 생성하면 안 된다');
  assert.match(monthlyCalendar,/item\.profit==null\?'기준'/,'비교 기준이 없는 최초 날짜는 0원이 아니라 기준일로 표시해야 한다');
});

test('KODEX canonical schema는 Main core의 별도 구현 없이 공통 validator 모듈을 사용한다',()=>{
  assert.match(core,/import\s*\{\s*validateKodexLeverageSource\s*\}\s*from '\.\/kodex-leverage-schema\.js'/);
  assert.match(core,/const validated=validateKodexLeverageSource\(source\)/);
  assert.doesNotMatch(core,/function isValidIsoCalendarDate\(/);
});

test('실시간 평가 adapter는 importmap cache-bust 대상이고 boot 이후 별도 lifecycle로 시작한다',()=>{
  assert.match(index,/'dashboard-market-ai-client\.js'/);
  assert.match(index,/'dashboard-live-valuation\.js'/);
  assert.match(app,/setupLiveValuation\(\{renderDashboard:renderLiveValuationRefresh,renderOpenOverlay:refreshOpenLiveModals\}\);/);
  assert.match(liveValuation,/const LIVE_VALUATION_POLL_MS=5_000;/);
  assert.match(marketAi,/const MARKET_AI_POLL_MS=5_000;/);
  assert.match(liveValuation,/\/api\/market-data\/krx-quotes/);
  assert.match(liveValuation,/document\.visibilityState==='visible'/);
});


test('별도수익 ON/OFF는 full render 대신 영향 영역만 부분 갱신하고 누적차트만 다시 그린다',()=>{
  const toggleStart=app.indexOf('function toggleSeparateProfitMode(){');
  const toggleEnd=app.indexOf('\nfunction toggleSeparateProfitModeFromExpanded',toggleStart);
  assert.ok(toggleStart>=0&&toggleEnd>toggleStart,'별도수익 toggle 함수 범위를 찾지 못했다');
  const toggleBlock=app.slice(toggleStart,toggleEnd);
  assert.match(toggleBlock,/refreshSeparateProfitModeView\(\)/);
  assert.match(toggleBlock,/refreshMonthlyCalendarModal\(\)/,'열린 월간 손익 모달도 같은 별도수익 상태로 즉시 갱신되어야 한다');
  assert.doesNotMatch(toggleBlock,/\brender\(\)/,'일반 별도수익 토글에서 #app full render를 호출하면 안 된다');

  const refreshStart=app.indexOf('function refreshSeparateProfitModeView(){');
  const refreshEnd=app.indexOf('\nfunction renderAssetWorkspace',refreshStart);
  assert.ok(refreshStart>=0&&refreshEnd>refreshStart,'별도수익 partial refresh 범위를 찾지 못했다');
  const refreshBlock=app.slice(refreshStart,refreshEnd);
  for(const marker of [
    "document.querySelector('.hero-metric-pills')",
    "document.getElementById('summary-section')",
    "#securities-section .securities-summary-block",
    "document.getElementById('chart-cum')",
    "document.getElementById('ledger-check')",
    "document.getElementById('capital-source-check')"
  ])assert.ok(refreshBlock.includes(marker),`별도수익 partial refresh 누락: ${marker}`);
  assert.match(refreshBlock,/renderSecuritiesCumulativeChart\(x,separateProfitControl\(x,'chart-inline'\)\)/);
  assert.match(refreshBlock,/getElementById\('ledger-check'\),renderSecuritiesLedgerBlock\(x\)/,'부분 갱신 뒤에도 증권 band 공통 wrapper를 유지해야 한다');
  assert.match(refreshBlock,/getElementById\('capital-source-check'\),renderSecuritiesSourceBlock\(x\)/,'원천 검산도 공통 wrapper를 유지해야 한다');
  assert.doesNotMatch(refreshBlock,/getElementById\('ledger-check'\),renderResultSummary\(x\)/);
  assert.doesNotMatch(refreshBlock,/getElementById\('capital-source-check'\),renderSourceTables\(x\)/);
  assert.match(refreshBlock,/refreshSecuritiesCumulativeChart\(\)/);
  assert.doesNotMatch(refreshBlock,/renderPension\(/);
  assert.doesNotMatch(refreshBlock,/renderSecuritiesSection\(/);
  assert.doesNotMatch(refreshBlock,/drawAllCharts\(/);

  assert.match(charts,/function renderSecuritiesCumulativeChart\(x,separateProfitHtml=''\)/);
  assert.match(charts,/function refreshSecuritiesCumulativeChart\(\)\{[^]*?drawCumChart\(\);/);
  const chartRefreshStart=charts.indexOf('function refreshSecuritiesCumulativeChart(){');
  const chartRefreshEnd=charts.indexOf('\nfunction drawAllCharts(){',chartRefreshStart);
  const chartRefreshBlock=charts.slice(chartRefreshStart,chartRefreshEnd);
  assert.doesNotMatch(chartRefreshBlock,/drawLineChart\(\)|drawStacked\(\)|drawPension/,'별도수익 partial chart refresh는 누적차트 외 차트를 다시 그리면 안 된다');
});

test('공통 full render는 keyboard focus를 보존하고 live partial refresh는 열린 목차·scroll 및 metadata-only 무렌더 계약을 유지한다',()=>{
  assert.match(app,/function render\(\{renderTopbar=true\}=\{\}\)\{\s*const focusSnapshot=dashboardFocusSnapshot\(\);/);
  assert.match(app,/if\(renderTopbar\)renderTabs\(\);/);
  const liveRefreshStart=app.indexOf('function renderLiveValuationRefresh(){');
  const liveRefreshEnd=app.indexOf('\n// [APP05]',liveRefreshStart);
  const liveRefreshBlock=app.slice(liveRefreshStart,liveRefreshEnd);
  assert.ok(liveRefreshStart>=0&&liveRefreshEnd>liveRefreshStart,'live partial refresh block is missing');
  assert.match(liveRefreshBlock,/if\(!liveValuationRenderDateEligible\(dataState\.activeDate\)\)return;/,'live partial refresh must render eligible pre-open carry dates, not only KST today');
  assert.doesNotMatch(liveRefreshBlock,/activeDate!==kstTodayText\(\)/,'live partial refresh must not hard-block the previous completed session before market open');
  assert.doesNotMatch(liveRefreshBlock,/render\(\{renderTopbar:false\}\)|document\.getElementById\('app'\)\.innerHTML/);
  for(const marker of ['renderHeroMetricPills(x,v)','renderCombined(x)','renderPensionOverview(x)','renderPensionAssetDetail(x)','renderPensionCharts(x)','renderSecuritiesPerformanceSummary(x)','renderSecuritiesAssetDetail(x)','renderSecuritiesChartsBlock(x)','renderSecuritiesLedgerBlock(x)','renderSecuritiesSourceBlock(x)'])assert.ok(liveRefreshBlock.includes(marker),`live partial refresh 누락: ${marker}`);
  assert.match(liveRefreshBlock,/drawAllCharts\(\);/);
  const preserveEntranceAt=liveRefreshBlock.indexOf('preservePlayedChartEntrancesOnce();');
  const replaceChartsAt=liveRefreshBlock.indexOf("replaceDashboardFragment(document.getElementById('investment-analysis')");
  assert.ok(preserveEntranceAt>=0&&replaceChartsAt>=0&&preserveEntranceAt<replaceChartsAt,'재생 완료 차트 상태는 기존 차트 DOM을 교체하기 전에 수집해야 한다');
  assert.match(app,/if\(target===document\.activeElement\)return;/);
  assert.match(app,/restoreDashboardFocus\(focusSnapshot\);/);
  assert.match(app,/active\.dataset\?\.dashboardFocusKey/);
  assert.match(app,/snapshot\.kind==='focus-key'/);
  assert.match(app,/return \{kind:'focus-key',value:focusKey,index:Math\.max\(0,matches\.indexOf\(active\)\)\}/);
  assert.match(app,/requestAnimationFrame\(\(\)=>restoreDashboardFocus\(snapshot,retryFrames-1\)\)/);
  assert.match(marketAi,/data-dashboard-focus-key="market-ai:signal:\$\{key\}"/);
  assert.match(marketAi,/data-dashboard-focus-key="market-ai:market:\$\{marketKey\}"/);
  assert.match(uiCommon,/data-dashboard-focus-key="\$\{escapeHtml\(idPrefix\)\}:contribution:\$\{index\}"/);
  assert.match(uiCommon,/const focusKey=`asset-source:\$\{ticker\|\|name\|\|'unknown'\}`/);
  assert.match(pension,/data-dashboard-focus-key="pension:risk-gauge"/);
  assert.match(app,/const keepDateMenuOpen=dateActionMenuIsOpen\(\);/);
  assert.match(app,/const keepDesktopTocOpen=desktopEdgeTocIsOpen\(\);/);
  assert.match(app,/if\(keepDateMenuOpen\)restoreDateActionMenuAfterRender\(\);/);
  assert.match(app,/if\(keepDesktopTocOpen\)restoreDesktopEdgeTocAfterRender\(\);/);
  assert.match(ui,/function desktopEdgeTocIsOpen\(\)/);
  assert.match(ui,/function restoreDesktopEdgeTocAfterRender\(\)/);
  assert.match(liveValuation,/function liveValuationFingerprint\(payload,requestedTickers=\[\]\)/);
  const fingerprintStart=liveValuation.indexOf('function liveValuationFingerprint');
  const fingerprintEnd=liveValuation.indexOf('\nfunction liveValuationCanRender',fingerprintStart);
  assert.ok(fingerprintStart>=0&&fingerprintEnd>fingerprintStart,'live valuation fingerprint block is missing');
  assert.doesNotMatch(liveValuation.slice(fingerprintStart,fingerprintEnd),/generated_at|generatedAt/);
  assert.match(liveValuation,/String\(item\?\.market_state\|\|''\)/);
  assert.match(liveValuation,/const fingerprint=liveValuationFingerprint\(payload,tickers\);/);
  assert.match(liveValuation,/if\(payloadChanged\)requestLiveValuationRender\(\);/);
  assert.doesNotMatch(liveValuation,/stateChanged\|\|payloadChanged/);
});

test('일반 브라우저 날짜 hash는 유효한 값이면 초기 선택일로 복원하고 malformed hash도 최신일로 fallback한다',()=>{
  assert.match(app,/let requestedDate='';\s*try\{requestedDate=decodeURIComponent\(location\.hash\.replace\(\/\^#\/,''\)\);\}catch\{\}/);
  assert.match(app,/const standaloneLaunchDate=dashboardStandaloneMode\(\)\?[^;]+:'';/);
  assert.match(app,/dataState\.activeDate=standaloneLaunchDate\|\|\(dates\.includes\(requestedDate\)\?requestedDate:dates\.at\(-1\)\);/);
});

test('KRX 요청은 중복 전송을 막고 재진입 session에서 이전 응답·자동 닫기 timer를 격리한다',()=>{
  assert.match(ui,/let krxActionModalCloseTimer=0;/);
  assert.match(ui,/let krxActionRequestInFlight=false;/);
  assert.match(ui,/let krxActionModalSession=0;/);
  assert.match(ui,/if\(krxActionRequestInFlight\)\{[^]*?return;/);
  assert.match(ui,/const requestSession=krxActionModalSession;/);
  assert.match(ui,/const currentSession=\(\)=>requestSession===krxActionModalSession;/);
  assert.match(ui,/function clearKrxActionModalCloseTimer\(\)\{[^]*?clearTimeout\(krxActionModalCloseTimer\)/);
  assert.match(ui,/function openKrxActionModal\(\)\{\s*clearKrxActionModalCloseTimer\(\);/);
  assert.match(ui,/function closeKrxActionModal\(\)\{\s*clearKrxActionModalCloseTimer\(\);/);
  assert.match(ui,/krxActionModalCloseTimer=window\.setTimeout\(/);
});

test('KRX 실패 재시도는 같은 requestId를 재사용하고 dispatch 불확실 응답도 성공 완료로 오인하지 않는다',()=>{
  assert.match(ui,/let krxActionRequestIdentity=\{key:'',id:''\};/);
  assert.match(ui,/function getKrxActionRequestId\(mode,date\)\{/);
  assert.match(ui,/requestId:String\(requestId\|\|''\)\.trim\(\)/);
  assert.match(ui,/const requestId=getKrxActionRequestId\(updateMode,selectedDate\);/);
  assert.match(ui,/dispatchKrxPriceUpdate\(pin, updateMode, requestId\)/);
  assert.match(ui,/workflow_dispatch_uncertain/);
  assert.match(ui,/Actions 상태를 확인해주세요/);
  const statusUncertainStart=ui.indexOf("if(data.action==='workflow_status_uncertain')");
  const terminalActionStart=ui.indexOf("if(['workflow_skipped','workflow_duplicate_ignored','workflow_dispatch_uncertain','workflow_in_progress'].includes(data.action))",statusUncertainStart);
  assert.ok(statusUncertainStart>=0&&terminalActionStart>statusUncertainStart,'workflow_status_uncertain은 terminal action보다 먼저 분기해야 한다');
  assert.doesNotMatch(ui.slice(statusUncertainStart,terminalActionStart),/resetKrxActionRequestIdentity\(\)/,'transient status uncertainty에서는 같은 requestId를 유지해야 한다');
  assert.match(ui,/resetKrxActionRequestIdentity\(\);\s*const successMsg=/);
});

test('KRX write는 60초 전용 timeout을 사용하고 timeout을 미확정 상태로 안내하며 같은 requestId를 유지한다',()=>{
  assert.match(ui,/const KRX_WRITE_REQUEST_TIMEOUT_MS=60000;/);
  const dispatchStart=ui.indexOf('async function dispatchKrxPriceUpdate');
  const modalStart=ui.indexOf('function ensureKrxActionModal',dispatchStart);
  assert.ok(dispatchStart>=0&&modalStart>dispatchStart,'KRX dispatch 함수 범위를 찾지 못했다');
  const dispatchBlock=ui.slice(dispatchStart,modalStart);
  assert.match(dispatchBlock,/fetchWithTimeout\(config\.url,[^]*?KRX_WRITE_REQUEST_TIMEOUT_MS\);/);
  assert.match(dispatchBlock,/if\(data\?\.timing\)console\.info\('\[KRX timing\]',updateMode,data\.timing\);/,'KRX timing은 UI를 바꾸지 않고 개발자 콘솔에만 남겨야 한다');

  const submitStart=ui.indexOf('async function submitKrxActionModal');
  const catchStart=ui.indexOf('}catch(e){',submitStart);
  const finallyStart=ui.indexOf('}finally{',catchStart);
  assert.ok(submitStart>=0&&catchStart>submitStart&&finallyStart>catchStart,'KRX submit catch 범위를 찾지 못했다');
  const catchBlock=ui.slice(catchStart,finallyStart);
  assert.match(catchBlock,/e\?\.code==='NETWORK_TIMEOUT'/);
  assert.match(catchBlock,/요청은 서버에서 계속 처리될 수 있습니다/);
  assert.match(catchBlock,/timedOut\?'checking':'err'/);
  assert.match(catchBlock,/showAppToast\(errorMessage,timedOut\?'ok':'err'/,'timeout은 실패색 Toast로 단정하지 않아야 한다');
  assert.doesNotMatch(catchBlock,/resetKrxActionRequestIdentity\(\)/,'timeout에서는 동일 requestId를 버리면 안 된다');
});

test('퇴직연금 Action PIN은 서버 요청 중 dismiss를 잠그고 실패 시 다시 활성화한다',()=>{
  assert.match(pensionEditor,/let activePensionActionPinSession=null;/);
  assert.match(pensionEditor,/activePensionActionPinSession\?\.finish\(null\);/);
  assert.match(pensionEditor,/if\(old\)closeDashboardModal\(old,\{visibleClass:'',manageAriaHidden:false,remove:true\}\);/);
  assert.doesNotMatch(pensionEditor,/if\(old\) old\.remove\(\);/);
  assert.match(pensionEditor,/let busy=false;\s*let finished=false;/);
  assert.match(pensionEditor,/const setDismissEnabled=enabled=>\{[^]*?cancel\.disabled=!enabled;[^]*?close\.disabled=!enabled;/);
  assert.match(pensionEditor,/busy=true;\s*input\.disabled=true;\s*setDismissEnabled\(false\);/);
  assert.match(pensionEditor,/busy=false;\s*setDismissEnabled\(true\);/);
  assert.match(pensionEditor,/const dismiss=\(\)=>\{if\(!busy&&!finished\)finish\(null\);\};/);
  assert.match(pensionEditor,/cancel\?\.addEventListener\('click',dismiss\);/);
  assert.match(pensionEditor,/close\?\.addEventListener\('click',dismiss\);/);
  assert.match(pensionEditor,/bindDashboardModalDismiss\(modal,\{onDismiss:dismiss\}\);/);
});

test('퇴직연금 삭제 PIN은 위험 상태를 명시하고 교체된 요청도 완료한다',()=>{
  assert.match(pensionEditor,/pension-action-pin-modal\$\{danger\?' is-danger':''\}/);
  assert.match(pensionEditor,/danger\?'<p class="pension-action-pin-danger" role="alert">삭제한 기록은 되돌릴 수 없습니다\.<\/p>':''/);
  assert.match(pensionEditor,/if\(activePensionActionPinSession\?\.modal===modal\)activePensionActionPinSession=null;/);
  assert.match(pensionEditor,/\}catch\(e\)\{\s*if\(finished\)return;/);
  assert.match(common,/\.pension-action-pin-modal\.is-danger \.pension-action-pin-card/);
  assert.match(common,/\.pension-action-pin-danger\{/);
  assert.match(common,/\.pension-action-pin-danger\{[^}]*line-height:var\(--type-line-body\)/s);
  assert.match(common,/\.pension-action-pin-danger\{[^}]*border-radius:min\(var\(--surface-radius-level-4\),var\(--corner-inner-cap\)\)/s);
  const dangerStart=common.indexOf('.pension-action-pin-danger{');
  const dangerEnd=common.indexOf('}',dangerStart);
  assert.ok(dangerStart>=0&&dangerEnd>dangerStart,'삭제 PIN 경고 CSS block is missing');
  assert.doesNotMatch(common.slice(dangerStart,dangerEnd),/--inner-radius-md/);
  assert.doesNotMatch(common,/--type-line-height-body/);
});

test('퇴직연금 편집기는 화면 입력과 작업 모음 모두에서 수량·금액을 안전 정수로 제한한다',()=>{
  assert.match(pensionEditor,/const isSafePensionWhole=\(value,\{positive=false\}=\{\}\)=>Number\.isSafeInteger\(value\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(draft\.qty,\{positive:true\}\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(draft\.amount,\{positive:true\}\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(Number\(item\.valuation\)\)/);
  assert.match(pensionEditor,/isSafePensionWhole\(Number\(item\.amount\),\{positive:true\}\)/);
  assert.doesNotMatch(pensionEditor,/!Number\.isInteger\(qty\)\|\|qty<=0\|\|!Number\.isFinite\(amount\)\|\|amount<=0/);
});

test('퇴직연금 mutation 재렌더는 모달 잠금을 해제한 뒤 Dashboard를 수렴시키고 재개방한다',()=>{
  assert.match(pensionEditor,/function rerenderPensionEditorAfterMutation\(renderDashboard,target,\{batchMode=false,draft=null\}=\{\}\)\{/);
  assert.match(pensionEditor,/const modalScrollTop=Math\.max\(0,Number\(modalCard\?\.scrollTop\)\|\|0\)/);
  assert.match(pensionEditor,/closePensionContributionModal\(\{reflow:false\}\);\s*renderDashboard\(\);\s*openPensionContributionModal\(\);/);
  assert.match(pensionEditor,/nextCard\.scrollTop=Math\.min\(modalScrollTop,Math\.max\(0,nextCard\.scrollHeight-nextCard\.clientHeight\)\)/);
  assert.match(pensionEditor,/if\(batchMode\)setPensionBatchMode\(true\);\s*setPensionContributionTarget\(target\);\s*restorePensionContributionDraft\(draft\);/);
  assert.match(pensionEditor,/rerenderPensionEditorAfterMutation\(renderDashboard,pensionContributionTarget\(\),\{batchMode:true\}\)/);
  assert.match(pensionEditor,/const saveDraft=pensionContributionDraftSnapshot\(\)/);
  assert.match(pensionEditor,/if\(localConverged\)\{[^]*?restoredDraft\.pensionEtfTradeQty=''[^]*?rerenderPensionEditorAfterMutation\(renderDashboard,item\.target,\{draft:restoredDraft\}\)[^]*?if\(appliedItem\)showPensionContributionOutput\(appliedItem\)/);
  assert.match(pensionEditor,/if\(!data\.stale\)\{[^]*?if\(localConverged\)\{[^]*?rerenderPensionEditorAfterMutation\(renderDashboard,target,\{draft:deleteDraft\}\)/);
});

test('퇴직연금 Batch는 각 작업의 stable operationId를 GAS에 전달하고 삭제 재시도 성공을 로컬에 수렴시킨다',()=>{
  assert.match(pensionEditor,/operationId:op\.operationId\|\|op\.tempId\|\|op\.qid\|\|''/);
  assert.match(pensionEditor,/data\.duplicate[^]*?중복 삭제 요청의 최신 삭제 상태를 반영했습니다/);
});


test('현금성자산 단건 저장은 화면 버전 precondition과 durable pending requestId를 함께 유지한다',()=>{
  assert.match(pensionEditor,/PENSION_PENDING_IDENTITY_STORAGE_KEY='investment-dashboard:pension-pending-identities:v1'/);
  assert.match(pensionEditor,/findReusablePendingIdentity\(readPensionPendingIdentityStore\(\)\.single,fingerprint\)/);
  assert.match(pensionEditor,/prepared\.expectedVersion=pensionCashSnapshotVersion\(current\)/);
  assert.match(pensionEditor,/prepared\.expectedAbsent=true/);
  assert.match(pensionEditor,/\{\.\.\.prepared,requestId:pensionEditorState\.singleSaveId,logicalOperationId:pensionEditorState\.singleSaveId\}/);
  assert.match(pensionEditor,/upsertPensionPendingSingle\(saveFingerprint,saveIdentity,\{status:'sent',payload:saveItem\}\)/);
  assert.match(pensionEditor,/markPensionPendingSingleStatus\(saveFingerprint,saveIdentity,'uncertain',saveItem\)/);
  assert.match(pensionEditor,/clearPensionPendingSingle\(saveFingerprint,saveIdentity\)/);
  assert.match(pensionEditor,/오래된 저장 재시도는 최신 상태 위에 다시 적용하지 않았습니다/);
});

test('퇴직연금 Batch cash 작업은 initial snapshot precondition과 reload 복구용 identity를 GAS에 전달한다',()=>{
  assert.match(pensionEditor,/function preparePensionBatchCashPrecondition\(operation\)\{/);
  assert.match(pensionEditor,/op\.expectedVersion=pensionCashSnapshotVersion\(source\)/);
  assert.match(pensionEditor,/op\.expectedAbsent=true/);
  assert.match(pensionEditor,/expectedVersion:String\(op\.expectedVersion\|\|''\),expectedAbsent:op\.expectedAbsent===true/);
  assert.match(pensionEditor,/findPendingBatchIdentity\(signature\)/);
  assert.match(pensionEditor,/persistPendingBatchIdentity\(batchSignature,batchRequestId,pensionEditorState\.batchQueue,\{status:'sent',payloadOperations:batchPayloadOperations\}\)/);
  assert.match(pensionEditor,/markPendingBatchIdentityStatus\(batchSignature,batchRequestId,'uncertain',batchPayloadOperations\)/);
  assert.match(pensionEditor,/confirmationToken=String\(confirmation\.token\)/);
  assert.match(pensionEditor,/confirmationDecision=String\(confirmation\.decision\)/);
  assert.match(pensionEditor,/confirmationDecisions=\{\.\.\.confirmation\.decisions\}/);
  assert.match(pensionEditor,/clearPendingBatchIdentity\(batchSignature,batchRequestId\)/);
  assert.match(pensionEditor,/payloadOperations:payloadOperations\|\|prior\?\.payloadOperations\|\|null/);
  assert.doesNotMatch(pensionEditor,/function pensionBatchOperationFingerprint\(operation\)\{[^]*?const precondition=/);
});

 test('퇴직연금 pending logical identity는 optimistic precondition과 분리하고 최초 payload 자체를 재사용한다',()=>{
  assert.match(pensionEditor,/if\(item\?\.target==='cashSnapshot'\)return `cashSnapshot\|\$\{String\(item\.date\|\|''\)\}\|\$\{String\(item\.valuation\?\?''\)\}\|\$\{String\(item\.costBasis\?\?''\)\}\|\$\{String\(item\.memo\|\|''\)\}`/);
  assert.match(pensionEditor,/if\(pending\?\.id&&pending\?\.payload\)\{[^]*?return \{\.\.\.pensionEditorState\.singleSavePayload\}/);
  assert.match(pensionEditor,/pensionEditorState\.batchPendingOperations=Array\.isArray\(pending\.payloadOperations\)/);
  assert.match(pensionEditor,/const batchPayloadOperations=Array\.isArray\(pensionEditorState\.batchPendingOperations\)/);
});



test('퇴직연금 cross-device 동일 내용은 state-bound confirmation token으로 기존 처리/별도 mutation을 서버에서 재확인한다',()=>{
  assert.match(pensionEditor,/logicalOperationId:String\(op\.logicalOperationId\|\|op\.operationId\|\|op\.tempId\|\|op\.qid\|\|''\)/);
  assert.match(pensionEditor,/requiresDuplicateConfirmation===true/);
  assert.match(pensionEditor,/confirmationToken:String\(data\.confirmationToken\|\|''\)/);
  assert.match(pensionEditor,/confirmationDecisions=\{\.\.\.confirmation\.decisions\}/);
  assert.match(pensionEditor,/const conflicts=Array\.isArray\(data\.conflictOperations\)\?data\.conflictOperations:\[\]/);
  assert.match(pensionEditor,/decisions\[String\(index\)\]=distinct\?'distinct':'existing'/);
  assert.match(pensionEditor,/confirmation=\{token:data\.confirmationToken,decisions\}/);
  assert.doesNotMatch(pensionEditor,/allowDistinct:true/);
  assert.doesNotMatch(pensionEditor,/batchPendingAllowDistinct/);
});

test('퇴직연금 부분 충돌 Batch는 충돌 operation별 existing/distinct 결정을 수집하고 하나의 Batch로 재검증한다',()=>{
  assert.match(pensionEditor,/if\(data\.fullMatch===true\)\{/);
  assert.match(pensionEditor,/conflicts\.forEach\(conflict=>\{/);
  assert.match(pensionEditor,/const description=pensionBatchOperationDescription\(op\)/);
  assert.match(pensionEditor,/부분 충돌 작업 모음 확인/);
  assert.match(pensionEditor,/savePensionBatchViaGithubPages\(batchPayloadOperations,pin,batchRequestId,confirmation\)/);
});


test('퇴직연금 Batch의 동일 batch/logical identity 충돌은 사용자 distinct 선택 없이 existing으로 고정한다',()=>{
  assert.match(pensionEditor,/if\(String\(conflict\?\.forcedDecision\|\|''\)==='existing'\)\{/);
  assert.match(pensionEditor,/decisions\[String\(index\)\]='existing'/);
});

test('퇴직연금 단건 삭제는 모든 target에서 durable pending logicalOperationId를 유지하고 cash만 snapshot version을 추가한다',()=>{
  assert.match(pensionEditor,/singleDeleteFingerprint:'',\s*singleDeleteId:'',\s*singleDeletePayload:null/);
  assert.match(pensionEditor,/function pensionCashSnapshotVersion\(item\)\{/);
  assert.match(pensionEditor,/const fingerprint=`\$\{String\(target\|\|''\)\}-delete\|\$\{String\(key\|\|''\)\}`/);
  assert.match(pensionEditor,/findReusablePendingIdentity\(readPensionPendingIdentityStore\(\)\.single,fingerprint\)/);
  assert.match(pensionEditor,/const payload=\{deleteRequestId:id,logicalOperationId:id\}/);
  assert.match(pensionEditor,/if\(target==='cashSnapshot'\)\{[^]*?payload\.expectedVersion=expectedVersion/);
  assert.match(pensionEditor,/payload\.deleteRequestId=String\(deleteContext\.deleteRequestId\|\|''\)\.trim\(\)/);
  assert.match(pensionEditor,/payload\.logicalOperationId=String\(deleteContext\.logicalOperationId\|\|deleteContext\.deleteRequestId\|\|''\)\.trim\(\)/);
  assert.match(pensionEditor,/upsertPensionPendingSingle\(deleteFingerprint,deleteIdentity,\{status:'sent',payload:deleteContext\}\)/);
  assert.match(pensionEditor,/if\(data\.requiresDuplicateConfirmation===true\)\{/);
  assert.match(pensionEditor,/confirmationToken:String\(data\.confirmationToken\|\|''\)/);
  assert.match(pensionEditor,/clearPensionPendingSingle\(deleteFingerprint,deleteIdentity\)/);
  assert.match(pensionEditor,/오래된 삭제 재시도는 최신 상태에 다시 적용하지 않았습니다/);
});

test('Batch 중복 응답에 state가 없으면 과거 pension state를 로컬에 다시 적용하지 않는다',()=>{
  assert.match(pensionEditor,/const duplicateWithoutState=!!data\.duplicate&&!data\.state;/);
  assert.match(pensionEditor,/if\(!duplicateWithoutState\)applyPensionBatchStateLocally\(data\.state\);/);
  assert.match(pensionEditor,/data\.stale[^]*?오래된 작업 모음 재시도는 다시 적용하지 않았습니다/);
});



test('퇴직연금 단건 duplicate 성공은 과거 요청 payload fallback 없이 최신 서버 resource로 수렴한다',()=>{
  assert.doesNotMatch(pensionEditor,/duplicateFallbackItem/);
  assert.match(pensionEditor,/function reconcilePensionDuplicateResource\(target,fallbackKey,data\)\{/);
  assert.match(pensionEditor,/resource=data\.currentResource/);
  assert.match(pensionEditor,/resource\.known!==true/);
  assert.match(pensionEditor,/upsertPensionItemLocally\(target,resource\.item\)/);
  assert.match(pensionEditor,/if\(key\)removePensionItemLocally\(target,key\)/);
  assert.match(pensionEditor,/const reconciled=reconcilePensionDuplicateResource\(item\.target,saveResourceKey,data\)/);
  assert.match(pensionEditor,/const reconciled=reconcilePensionDuplicateResource\(target,key,data\)/);
  assert.match(pensionEditor,/중복 저장 요청은 확인했지만 최신 서버 상태를 확인하지 못했습니다/);
  assert.match(pensionEditor,/중복 삭제 요청 이후의 최신 서버 기록을 반영했습니다/);
  assert.match(pensionEditor,/const deleteDraft=pensionContributionDraftSnapshot\(\)/);
  assert.match(pensionEditor,/rerenderPensionEditorAfterMutation\(renderDashboard,target,\{draft:deleteDraft\}\)/);
});

test('퇴직연금 duplicate local convergence는 최신 item upsert·최신 absent remove·구 GAS fail-closed를 구분한다',()=>{
  const vm=require('node:vm');
  const start=pensionEditor.indexOf('function reconcilePensionDuplicateResource(');
  const end=pensionEditor.indexOf('\nfunction setPensionContributionTarget',start);
  assert.ok(start>=0&&end>start,'duplicate resource helper가 존재해야 한다');
  const applied=[];
  const removed=[];
  const context=vm.createContext({
    upsertPensionItemLocally:(target,item)=>applied.push([target,item]),
    removePensionItemLocally:(target,key)=>removed.push([target,key])
  });
  vm.runInContext(pensionEditor.slice(start,end),context);

  let result=context.reconcilePensionDuplicateResource('cashSnapshot','2026-09-18',{duplicate:true,stale:false,currentResource:{known:true,key:'2026-09-18',exists:true,item:{date:'2026-09-18',valuation:2000000}}});
  assert.equal(result.handled,true);
  assert.equal(result.item.valuation,2000000);
  assert.equal(applied.length,1);
  assert.equal(removed.length,0);

  result=context.reconcilePensionDuplicateResource('cashSnapshot','2026-09-18',{duplicate:true,stale:false,currentResource:{known:true,key:'2026-09-18',exists:false,item:null}});
  assert.equal(result.handled,true);
  assert.equal(result.item,null);
  assert.deepEqual(removed,[['cashSnapshot','2026-09-18']]);

  result=context.reconcilePensionDuplicateResource('cashSnapshot','2026-09-18',{duplicate:true,stale:false});
  assert.equal(result.handled,false);
  assert.equal(applied.length,1);
  assert.equal(removed.length,1);
});

test('Live Valuation partial refresh는 내부 가로 스크롤과 native input interaction을 보존한다',()=>{
  assert.match(app,/function dashboardNestedScrollSnapshot\(\)\{/);
  const nestedScrollStart=app.indexOf('function dashboardNestedScrollSnapshot(){');
  const nestedScrollEnd=app.indexOf('\nfunction restoreDashboardNestedScroll',nestedScrollStart);
  const nestedScrollBlock=app.slice(nestedScrollStart,nestedScrollEnd);
  assert.ok(nestedScrollStart>=0&&nestedScrollEnd>nestedScrollStart,'nested scroll snapshot helper is missing');
  assert.match(nestedScrollBlock,/querySelectorAll\(/,'nested scroll snapshot은 DOM 대상 목록을 수집해야 한다');
  assert.match(nestedScrollBlock,/\.mobile-scroll/,'표 가로 스크롤을 보존해야 한다');
  assert.match(nestedScrollBlock,/\.chart-wrap/,'차트 가로 스크롤을 보존해야 한다');
  assert.match(app,/const nestedScrollSnapshot=dashboardNestedScrollSnapshot\(\)/);
  assert.match(app,/restoreDashboardNestedScroll\(nestedScrollSnapshot\)/);
  assert.match(liveValuation,/active\?\.matches\?\.\('select,input,textarea,\[contenteditable="true"\]'\)/);
  assert.match(liveValuation,/#app \.control-info-button\[aria-expanded=\"true\"\],#app \.has-tooltip\.tooltip-open,#assetPriceSourceTooltip\.visible,#securitySaleTooltip\.visible,#marketAiTooltip\.visible/);
  assert.match(app,/hideAssetSourceTooltip\(\);\s*hideSecuritySaleTooltip\(\);\s*closeAccountMemoInfo\(\);/);
});

test('퇴직연금 ETF 미리보기는 잘못된 수량·금액·일자를 저장 전에 차단한다',()=>{
  assert.match(pensionEditor,/if\(!isSafePensionWhole\(draft\.qty,\{positive:true\}\)\)\{\s*setDisabled\(true\);/);
  assert.match(pensionEditor,/if\(!isSafePensionWhole\(draft\.amount,\{positive:true\}\)\)\{\s*setDisabled\(true\);/);
  assert.match(pensionEditor,/if\(draft\.tradeDate>draft\.applyDate\)\{\s*setDisabled\(true\);/);
});

test('Market AI 신호 HTTP 오류는 helper 내부에서 body timeout을 즉시 해제한다',()=>{
  const start=marketAi.indexOf('async function refreshMarketAiSignalResponse');
  const end=marketAi.indexOf('\nasync function refreshMarketAiMarketSnapshot',start);
  assert.ok(start>=0&&end>start,'Market AI signal response helper is missing');
  const helper=marketAi.slice(start,end);
  assert.match(helper,/if\(response\.status===404\|\|!response\.ok\)\{\s*response\.releaseTimeout\?\.\(\);/);
  assert.match(helper,/return \{response,signal:null,parseError:false\};/);
});

test('Market AI 신호 body는 느린 sibling endpoint를 기다리기 전에 소비해 독립 timeout을 종료한다',async()=>{
  const start=marketAi.indexOf('async function refreshMarketAiSignalResponse');
  const end=marketAi.indexOf('\nasync function refreshMarketAiMarketSnapshot',start);
  assert.ok(start>=0&&end>start,'Market AI signal response helper is missing');

  const vm=require('node:vm');
  let aborted=false;
  let bodyReadStarted=false;
  let timer=0;
  const payload={updated_at:'2026-09-11T06:00:00Z'};
  const response={
    status:200,
    ok:true,
    releaseTimeout(){clearTimeout(timer);},
    async json(){
      bodyReadStarted=true;
      await new Promise(resolve=>setTimeout(resolve,1));
      if(aborted){
        const error=new Error('aborted');
        error.name='AbortError';
        throw error;
      }
      clearTimeout(timer);
      return payload;
    }
  };
  const context={
    setTimeout,
    clearTimeout,
    fetchWithTimeout:async()=>{
      timer=setTimeout(()=>{aborted=true;},10);
      return response;
    }
  };
  vm.createContext(context);
  vm.runInContext(marketAi.slice(start,end),context);

  const [signalResult]=await Promise.all([
    context.refreshMarketAiSignalResponse('http://127.0.0.1:8001'),
    new Promise(resolve=>setTimeout(resolve,20))
  ]);

  assert.equal(bodyReadStarted,true,'signal JSON body must be consumed immediately inside its helper');
  assert.equal(aborted,false,'slow sibling endpoints must not keep the completed signal request timeout alive');
  assert.deepEqual(JSON.parse(JSON.stringify(signalResult.signal)),payload);
  assert.equal(signalResult.parseError,false);
});


test('공통 fetch timeout은 응답 헤더 뒤 JSON 본문 대기까지 유지하고 timeout 오류를 보존한다',async()=>{
  const start=core.indexOf('function networkTimeoutError()');
  const end=core.indexOf('\nfunction dataUrlLabel',start);
  assert.ok(start>=0&&end>start,'core network timeout implementation is missing');
  const vm=require('node:vm');
  let signal;
  const context={
    AbortController,
    NETWORK_REQUEST_TIMEOUT_MS:5,
    setTimeout,
    clearTimeout,
    fetch:async(_url,options)=>{
      signal=options.signal;
      return {
        ok:true,
        json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{
          const error=new Error('aborted');error.name='AbortError';reject(error);
        },{once:true}))
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(core.slice(start,end),context);
  const response=await context.fetchWithTimeout('mock',{},5);
  await assert.rejects(response.json(),error=>error?.code==='NETWORK_TIMEOUT');
  assert.equal(signal.aborted,true);
});


test('초기 JSON 로더는 일시적 fetch 연결 실패만 짧게 재시도한다',async()=>{
  const start=core.indexOf('const DATA_READ_RETRY_DELAYS_MS=');
  const end=core.indexOf('\nfunction deriveSeparateProfitFromKodexReport',start);
  assert.ok(start>=0&&end>start,'core data-read retry implementation is missing');
  const vm=require('node:vm');
  const delays=[];
  let attempts=0;
  const context={
    setTimeout:(fn,delay)=>{delays.push(delay);fn();return 0;},
    dataUrlLabel:url=>url,
    fetchWithTimeout:async()=>{
      attempts+=1;
      if(attempts<3)throw new TypeError('Failed to fetch');
      return {ok:true,json:async()=>({ok:true})};
    }
  };
  vm.createContext(context);
  vm.runInContext(core.slice(start,end),context);
  const result=await context.loadJson('data/mock.json');
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true});
  assert.equal(attempts,3);
  assert.deepEqual(delays,[250,750]);

  attempts=0;
  delays.length=0;
  context.fetchWithTimeout=async()=>{
    attempts+=1;
    return {ok:false,status:500,releaseTimeout(){}};
  };
  await assert.rejects(context.loadJson('data/mock.json'),/HTTP 500/);
  assert.equal(attempts,1,'HTTP 오류는 retry 대상이 아니어야 한다');
  assert.deepEqual(delays,[]);
});

test('모바일 표↔카드 전환은 단일 config·공통 card shell·viewport별 표현 책임을 사용한다',()=>{
  const mobile1=compact(mobile);
  assert.match(uiCommon,/const MOBILE_VIEW_CONFIG=Object\.freeze\(/);
  assert.doesNotMatch(uiCommon,/const MOBILE_VIEW_META=/);
  assert.match(uiCommon,/const mobileViewModes=Object\.fromEntries\(Object\.entries\(MOBILE_VIEW_CONFIG\)/);
  assert.match(uiCommon,/:not\(\[data-mobile-view-button\]\)/);
  assert.match(uiCommon,/function renderMobileCardView\(/);
  assert.equal((uiCommon.match(/renderMobileCardView\(/g)||[]).length,3);
  assert.equal((ui.match(/renderMobileCardView\(/g)||[]).length,2);
  assert.doesNotMatch(uiCommon,/<div id="\$\{idPrefix\}-card-view" class=/);
  assert.doesNotMatch(ui,/<div id="(?:combined|accounts)-card-view" class="mobile-card-view"/);
  assert.match(mobile1,/\[data-mobile-view="card"\] \.table-view\{display:none\}/);
  assert.match(special1,/\[data-mobile-view\] \.table-view\{display:block\}/);
  assert.match(special1,/\[data-mobile-view\] \.mobile-card-view\{display:none\}/);
  assert.doesNotMatch(special1,/\[data-mobile-view="card"\] \.table-view/);
});

test('Chart legend는 전체선택/다중선택을 지원하되 마지막 1개는 해제하지 않는다',()=>{
  assert.match(charts1,/if\(key==='__all__'\)\{ selection\.state\.selected=null;/);
  assert.match(charts1,/if\(next\.has\(key\)\)\{ if\(next\.size<=1\)return; next\.delete\(key\);/);
  assert.match(charts1,/aria-pressed="\$\{active\}"/);
});

test('Chart 확대는 별도 state 복제가 아니라 기존 SVG/controls/options/legend를 이동 후 복원한다',()=>{
  assert.match(charts1,/document\.createComment\('expanded-chart-legend-placeholder'\)/);
  assert.match(charts1,/expandedLegendHost\.appendChild\(legend\)/);
  assert.match(charts1,/legendPlaceholder\?\.parentNode\)legendPlaceholder\.parentNode\.insertBefore\(legend,legendPlaceholder\)/);
  assert.match(charts1,/chartRuntimeState\.expanded=\{overlay,svg,placeholder/);
});

test('Modal lifecycle는 focus trap / focus return / inert / ESC를 공통 layer에서 관리한다',()=>{
  assert.match(modal1,/element\.inert=true/);
  assert.match(modal1,/state\.inertSnapshot\.forEach/);
  assert.match(modal1,/event\.key!=='Escape'/);
  assert.match(modal1,/const first=focusables\[0\],last=focusables\.at\(-1\),active=document\.activeElement/);
  assert.match(modal1,/target\?\.focus\?\.\(\{preventScroll:true\}\)/);
});

test('Hero 성과 pill label은 Desktop full / compact Web short / Tablet·Phone compact 3단계를 유지한다',()=>{
  for(const [full,short,compact] of [
    ['증권계좌 누적손익','증권계좌 손익','계좌 손익'],
    ['증권계좌 누적수익률','증권계좌 수익률','계좌 수익률'],
    ['퇴직연금 운용손익','퇴직연금 손익','연금 손익'],
    ['퇴직연금 운용수익률','퇴직연금 수익률','연금 수익률'],
  ]){
    assert.match(app,new RegExp(`<span class=\"hero-label-default\">${full}</span><span class=\"hero-label-short\">${short}</span><span class=\"hero-label-compact\">${compact}</span>`),`${full}은 short/compact label과 함께 렌더되어야 한다`);
  }
  assert.match(special,/@media \(max-width:1279px\)\{[^]*?\.hero \.hero-label-default,[^]*?\.hero \.hero-label-compact\{display:none\}[^]*?\.hero \.hero-label-short\{display:inline\}/,'1101~1279px compact Web은 short label을 표시해야 한다');
  assert.match(special,/@media \(max-width:1100px\)\{[^]*?\.hero \.hero-label-short\{display:none\}[^]*?\.hero \.hero-label-compact\{display:inline\}/,'Tablet/Phone은 계좌·연금 compact label을 표시해야 한다');
  assert.match(common,/\.hero-label-short,\.hero-label-compact\{display:none\}/,'1280px 이상 Desktop baseline은 full label을 유지해야 한다');
  assert.match(print,/\.hero \.hero-label-default\{display:inline\}[^]*?\.hero \.hero-label-short,[^]*?\.hero \.hero-label-compact\{display:none\}/s,'Print는 viewport와 무관하게 full label을 복원해야 한다');
  assert.match(app,/hero-label-compact\">계좌 수익률<\/span>&nbsp;\$\{pct\(v\.totalReturn\)\}/,'계좌 수익률 label과 값 사이는 명시적 공백을 유지해야 한다');
  assert.match(app,/hero-label-compact\">연금 수익률<\/span>&nbsp;\$\{pct\(x\.pensionReturn\)\}/,'연금 수익률 label과 값 사이는 명시적 공백을 유지해야 한다');
});

test('Market AI contract: KOSPI200 선물 / SOX 현물 / NQ100 선물 symbol을 고정한다',()=>{
  assert.match(marketAi,/MARKET_AI_KIS_FUTURES_SYMBOL='FUTURES:KOSPI200'/);
  assert.match(marketAi,/MARKET_AI_SOX_INDEX_SYMBOL='INDEX:SOX'/);
  assert.match(marketAi,/MARKET_AI_NASDAQ100_FUTURES_SYMBOL='FUTURES:NQ'/);
  assert.doesNotMatch(marketAi,/FUTURES:SOX/);
});

test('Market AI contract: local은 :8001, remote는 Tailscale Serve를 공통 client에서 사용한다',()=>{
  assert.match(marketAiClient,/LOCAL_DASHBOARD_HOSTS=new Set\(\['localhost','127\.0\.0\.1'\]\)/);
  assert.match(marketAiClient,/MARKET_AI_REMOTE_BASE='https:\/\/node\.tail60a98e\.ts\.net'/);
  assert.match(marketAiClient,/return `\$\{location\.protocol\}\/\/\$\{location\.hostname\}:8001`/);
});

test('Market AI는 main dataState/uiState를 참조하지 않는 standalone state를 유지한다',()=>{
  assert.doesNotMatch(marketAi,/\bdataState\b/);
  assert.doesNotMatch(marketAi,/\buiState\b/);
  assert.match(marketAi,/const marketAiState=\{/);
});

test('보유종목/연금상품 현재가 출처는 저장 기준과 Market AI 적용 여부를 기존 tooltip에서 구분한다',()=>{
  assert.match(uiCommon,/tooltip\.className='dash-tooltip'/);
  assert.match(uiCommon,/function renderAssetPriceSourceLabel\(/);
  assert.match(uiCommon,/function storedAssetPriceState\(/);
  assert.match(uiCommon,/정규장 종가 저장 데이터/);
  assert.match(uiCommon,/장중 저장 데이터/);
  assert.match(ui,/renderAssetPriceSourceLabel\(/);
  assert.match(pension,/renderAssetPriceSourceLabel\(/);
  assert.equal((common.match(/assetPriceSourceTooltip|asset-source-tooltip|asset-source/g)||[]).length,0,'출처 tooltip 전용 CSS를 추가하면 안 된다');
});

test('전일 대비 변동 현재 열은 증권/연금별 실제 가격 상태 집계 helper를 독립 사용한다',()=>{
  assert.match(core,/function assetAppliedPriceKindForRow\(row,date\)/);
  assert.match(core,/const assetCurrentPriceColumnLabel=\(date,rows=\[\]\)=>/);
  assert.match(core,/priceSource:h\.priceSource,\s*liveQuote:h\.liveQuote,\s*postClosePending:h\.postClosePending===true/);
  assert.match(ui,/const currentPriceLabel=assetCurrentPriceColumnLabel\(detail\.date,orderedRows\);/);
  assert.match(pension,/currentPriceLabel=assetCurrentPriceColumnLabel\(x\.date,orderedPensionRows\)/);
});

test('Hero 기준문구는 raw 상태 대신 실제 적용 가격의 사용자 의미를 노출한다',()=>{
  assert.match(core,/function heroPerformanceBasisLabel\(date,now=new Date\(\)\)/);
  for(const label of ['정규장 종가 기준','애프터 종가 기준','시간외 포함 현재가 기준','실시간 현재가 기준','일부 실시간 반영']){
    assert.ok(core.includes(label),`Hero basis label 누락: ${label}`);
  }
  assert.doesNotMatch(app,/data-live-valuation-status|LIVE \${status\.usableCount}/);
  assert.match(app,/data-dashboard-action="hero-basis-tap"/);
});

test('Live Valuation 부분 갱신은 Hero 기준문구도 실제 Market AI 가격 기준으로 동기화한다',()=>{
  assert.match(app,/const heroBasis=document\.querySelector\('\.hero-basis'\);/);
  assert.match(app,/heroBasis\.setAttribute\('datetime',x\.date\);/);
  assert.match(app,/heroBasis\.textContent=`\(\$\{heroPerformanceBasisLabel\(x\.date\)\}\)`;/);
});

test('저장 가격 tooltip은 애프터마켓 이후 source 미검증 regular_close를 확정 종가로 단정하지 않는다',()=>{
  assert.match(uiCommon,/regularCloseSource='',date=''/);
  assert.match(uiCommon,/String\(date\|\|''\)>='2026-09-14'&&!verifiedAftermarket\)return '저장 데이터'/);
  assert.match(ui,/regularCloseSource:x\.s\?\.regularCloseSource/);
  assert.match(pension,/regularCloseSource:x\.s\?\.regularCloseSource/);
});

test('Standalone Web App은 설치 당시 hash보다 KST 오늘을 우선하고 날짜가 바뀐 foreground 복귀에서 최신 데이터를 다시 읽는다',()=>{
  assert.match(app,/const today=kstTodayText\(\);[^]*const standaloneLaunchDate=dashboardStandaloneMode\(\)\?\(dates\.includes\(today\)\?today:dates\.at\(-1\)\):'';/);
  assert.match(app,/dataState\.activeDate=standaloneLaunchDate\|\|\(dates\.includes\(requestedDate\)\?requestedDate:dates\.at\(-1\)\);/);
  assert.match(app,/function setupStandaloneTodayDateRefresh\(\)/);
  assert.match(app,/standaloneSessionKstDate=kstTodayText\(\);[^]*document\.addEventListener\('visibilitychange'/);
  assert.match(app,/if\(document\.visibilityState!=='visible'\)return;/);
  assert.match(app,/if\(today===standaloneSessionKstDate\)return;[^]*window\.location\.reload\(\);/);
  assert.match(app,/setupStandaloneTodayDateRefresh\(\);/);
});

test('Standalone Web App은 최상단 단일 터치 pull-to-refresh를 제공하고 일반 브라우저에는 생성하지 않는다',()=>{
  assert.match(app,/function dashboardStandaloneMode\(\)/);
  assert.match(app,/display-mode: standalone/);
  assert.match(app,/window\.navigator\?\.standalone===true/);
  assert.match(app,/function setupStandalonePullToRefresh\(\)/);
  assert.match(app,/dashboardScrollTop\(\)>1/);
  assert.match(app,/document\.body\.classList\.contains\('dashboard-dialog-open'\)/);
  assert.match(app,/dashboardPullRefreshBlocked\(\)/);
  assert.match(app,/event\.touches\.length!==1\|\|dashboardScrollTop\(\)>1\|\|dashboardPullRefreshBlocked\(\)/);
  assert.match(app,/if\(deltaY<=0\|\|Math\.abs\(deltaX\)>deltaY\)\{\s*resetStandalonePullRefresh\(indicator\)/);
  assert.match(app,/standalonePullRefreshState\.dragY=deltaY;\s*if\(deltaY<8\)/);
  assert.match(app,/touchmove[^]*\{passive:false\}/);
  assert.match(app,/standalonePullRefreshState\.threshold:80|threshold:80/);
  assert.match(app,/window\.location\.reload\(\)/);
  assert.match(common1,/\.standalone-pull-refresh\{/);
  assert.match(common1,/\.standalone-pull-refresh\.refreshing \.standalone-pull-refresh-icon\{/);
});

test('Market AI 시장 카드/툴팁은 공통 View Model과 고정 정보 순서를 사용하고 K200에만 세션을 둔다',()=>{
  assert.match(marketAi,/function marketAiMarketDisplayModel\(key\)/);
  assert.match(marketAi,/function marketAiMarketStatusLabel\(reason\)/);
  assert.match(marketAi,/fresh:'정상'/);
  assert.match(marketAi,/closed:'장마감'/);
  assert.match(marketAi,/stale:'데이터 지연'/);
  assert.match(marketAi,/preopen:'장전'/);
  assert.match(marketAi,/maintenance:'거래중단'/);
  assert.match(marketAi,/bridge:'Bridge 지연'/);
  assert.match(marketAi,/source:'선물 데이터 확인 필요'/);
  assert.match(marketAi,/missing:'데이터 없음'/);
  assert.match(marketAi,/label='K200선물'/);
  assert.match(marketAi,/label='NQ100선물'/);
  assert.match(marketAi,/session=\(\{day:'주간',night:'야간',closed:'장외'\}\)\[state\.bridgeStatus\?\.expected_session\]\|\|''/);
  const tooltipBlock=marketAi.slice(marketAi.indexOf('function marketAiMarketTooltipHtml'),marketAi.indexOf('function marketAiSignalMetric'));
  const orderedFields=["'현재가'","'등락률'","'상태'","'세션'","'출처'","'기준 시각'"];
  let previousIndex=-1;
  orderedFields.forEach(field=>{
    const index=tooltipBlock.indexOf(field);
    assert.ok(index>previousIndex,`${field}는 Market AI 시장 툴팁 고정 순서에 있어야 한다`);
    previousIndex=index;
  });
  assert.doesNotMatch(marketAi,/marketAiTooltipRow\('데이터',sourceLabel\)/);
  assert.doesNotMatch(marketAi,/\?'마지막 수신':'갱신'/);
});


test('Market AI 시장 카드도 tooltip과 같은 display model을 사용해 마지막 수신값을 숨기지 않는다',()=>{
  const start=marketAi.indexOf('function syncMarketAiMarketView');
  const end=marketAi.indexOf('\nfunction syncMarketAiSignalView',start);
  assert.ok(start>=0&&end>start,'Market AI market card sync block is missing');
  const block=marketAi.slice(start,end);
  assert.match(block,/const model=marketAiMarketDisplayModel\(key\)/);
  assert.doesNotMatch(block,/marketAiKisFuturesState\(\)/);
  assert.doesNotMatch(block,/futuresState\.row/);
  assert.match(block,/value\.textContent=model\.price/);
  assert.match(block,/change\.textContent=model\.changePct;/);
  assert.match(block,/const unavailable=model\.price==='--'/);
});

test('Market AI 시장 세션 판정은 KRX/SOX/NQ의 휴장 시간을 stale과 분리하고 KIS business_time을 우선한다',()=>{
  const vm=require('node:vm');
  const start=marketAi.indexOf('function marketAiClockParts');
  const end=marketAi.indexOf('\nfunction marketAiMarketSourceLabel',start);
  assert.ok(start>=0&&end>start,'Market session helper block is missing');
  const context={marketAiKstTime:value=>String(value||'').replace('Z','')};
  vm.createContext(context);
  vm.runInContext(marketAi.slice(start,end),context);

  const koreaEvening=new Date('2026-09-14T11:05:00Z'); // 20:05 KST / 07:05 ET / 06:05 CT
  assert.equal(context.marketAiKrxCashSessionState(koreaEvening),'closed');
  assert.equal(context.marketAiSoxSessionState(koreaEvening),'preopen');
  assert.equal(context.marketAiNasdaq100FuturesSessionState(koreaEvening),'open');
  assert.equal(context.marketAiSoxSessionState(new Date('2026-09-14T14:00:00Z')),'open');
  assert.equal(context.marketAiSoxSessionState(new Date('2026-09-14T20:30:00Z')),'closed');
  assert.equal(context.marketAiNasdaq100FuturesSessionState(new Date('2026-09-14T21:30:00Z')),'maintenance');
  assert.equal(context.marketAiBusinessTimeText('153000'),'15:30');
  assert.equal(context.marketAiBusinessTimeText('888888'),'');
  assert.equal(context.marketAiMarketReferenceTime({source:'kis-efriend:JUC_R:0001',business_time:'153000',observed_at:'20:05Z'},'kospi-index'),'15:30');
  assert.equal(context.marketAiMarketReferenceTime({source:'yfinance:^SOX',observed_at:'19:59Z'},'sox-index'),'19:59');
});

test('Market AI 시장 카드는 backend 거래소 캘린더 상태를 로컬 요일·시간 추정보다 우선한다',()=>{
  const vm=require('node:vm');
  const start=marketAi.indexOf('function marketAiBackendInputReason');
  const end=marketAi.indexOf('\nfunction marketAiK200FallbackSessionOpen',start);
  const context={marketAiSnapshotFreshness:row=>({fresh:false,observedAt:row.observed_at})};
  vm.createContext(context);
  vm.runInContext(marketAi.slice(start,end),context);
  const laborDayRow={
    observed_at:'2026-09-04T20:00:00Z',
    input_status:{available:true,status:'closed_latest'}
  };
  assert.equal(context.marketAiSnapshotDisplayState(laborDayRow,'open').reason,'closed');
  assert.equal(context.marketAiSnapshotDisplayState({observed_at:'2026-09-07T18:00:00Z'},'open').reason,'stale');
});

test('Market AI K200 시장 카드는 backend input_status를 Bridge/5분 freshness보다 우선한다',()=>{
  const vm=require('node:vm');
  const reasonStart=marketAi.indexOf('function marketAiBackendInputReason');
  const reasonEnd=marketAi.indexOf('\nfunction marketAiSnapshotDisplayState',reasonStart);
  const stateStart=marketAi.indexOf('function marketAiKisFuturesState');
  const stateEnd=marketAi.indexOf('\n// 카드와 tooltip',stateStart);
  assert.ok(reasonStart>=0&&reasonEnd>reasonStart&&stateStart>=0&&stateEnd>stateStart,'K200 input-status helper block is missing');
  let rawRow={
    source:'kis-efriend:night:CMEC_R:A01612',
    observed_at:'2026-09-18T20:57:00Z',
    input_status:{available:false,status:'missing_close'}
  };
  let bridgeStatus={market_open:false,connected:true,expected_session:'closed'};
  const context={
    MARKET_AI_KIS_FUTURES_SYMBOL:'FUTURES:KOSPI200',
    marketAiState:{bridgeStatus},
    marketAiSnapshotRow:()=>rawRow,
    marketAiObject:value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null,
    marketAiSnapshotFreshness:row=>({fresh:true,observedAt:row.observed_at}),
    marketAiK200FallbackSessionOpen:()=>false
  };
  vm.createContext(context);
  vm.runInContext(marketAi.slice(reasonStart,reasonEnd),context);
  vm.runInContext(marketAi.slice(stateStart,stateEnd),context);

  let state=context.marketAiKisFuturesState();
  assert.equal(state.reason,'missing-close','backend missing_close는 장마감 fallback보다 우선해야 한다');
  assert.equal(state.row,rawRow,'backend 상태가 unavailable이어도 마지막 KIS 값은 카드에 유지한다');

  rawRow={...rawRow,input_status:{available:false,status:'stale'}};
  state=context.marketAiKisFuturesState();
  assert.equal(state.reason,'stale','backend stale은 5분 freshness가 fresh여도 우선해야 한다');

  rawRow={...rawRow,input_status:null};
  context.marketAiSnapshotFreshness=()=>({fresh:false,observedAt:rawRow.observed_at});
  state=context.marketAiKisFuturesState();
  assert.equal(state.reason,'closed','backend 상태가 없는 구버전 응답에서만 기존 Bridge/session fallback을 사용한다');
});

test('Market AI 시장 tooltip View Model은 session-aware KOSPI/SOX/NQ와 K200 closed/bridge/source 의미를 구분한다',()=>{
  const vm=require('node:vm');
  const start=marketAi.indexOf('function marketAiMarketStatusLabel');
  const end=marketAi.indexOf('\n// [MARKET05]',start);
  assert.ok(start>=0&&end>start,'Market tooltip View Model block is missing');

  let rows={};
  let k200State={row:null,rawRow:null,reason:'missing',bridgeStatus:{}};
  let sessions={krx:'closed',sox:'preopen',nq:'open'};
  const context={
    MARKET_AI_SOX_INDEX_SYMBOL:'INDEX:SOX',
    MARKET_AI_NASDAQ100_FUTURES_SYMBOL:'FUTURES:NQ',
    marketAiSnapshotRow:symbol=>rows[symbol]||null,
    marketAiKrxCashSessionState:()=>sessions.krx,
    marketAiSoxSessionState:()=>sessions.sox,
    marketAiNasdaq100FuturesSessionState:()=>sessions.nq,
    marketAiSnapshotDisplayState:(row,sessionState)=>{
      if(!row)return {reason:'missing',rawRow:null,observedAt:''};
      if(sessionState==='preopen'||sessionState==='closed'||sessionState==='maintenance')return {reason:sessionState,rawRow:row,observedAt:row.observed_at||''};
      return {reason:row.__fresh===false?'stale':'fresh',rawRow:row,observedAt:row.observed_at||''};
    },
    marketAiKisFuturesState:()=>k200State,
    marketAiPriceText:value=>value==null?'--':Number(value).toFixed(2),
    marketAiMarketSourceLabel:(row,key)=>row?.source||`source:${key}`,
    marketAiDirectionClass:value=>Number(value)>0?'positive':(Number(value)<0?'negative':'neutral'),
    marketAiMarketReferenceTime:(row,key)=>key==='kospi-index'&&row?.business_time==='153000'?'15:30':String(row?.observed_at||'').replace('Z','')
  };
  vm.createContext(context);
  const changeStart=marketAi.indexOf('function marketAiChangeText');
  const changeEnd=marketAi.indexOf('\nfunction kstDateParts',changeStart);
  vm.runInContext(marketAi.slice(changeStart,changeEnd),context);
  vm.runInContext(marketAi.slice(start,end),context);

  rows['INDEX:KOSPI']={price:3210.5,change_pct:0.42,source:'kis-efriend:JUC_R:0001',observed_at:'20:05Z',business_time:'153000',__fresh:false};
  let model=context.marketAiMarketDisplayModel('kospi-index');
  assert.equal(model.status,'장마감');
  assert.equal(model.price,'3210.50');
  assert.equal(model.observedAt,'15:30');
  assert.equal(model.session,'');

  rows['INDEX:SOX']={price:7123.8,change_pct:-0.21,source:'yfinance:^SOX',observed_at:'20:00Z',__fresh:false};
  model=context.marketAiMarketDisplayModel('sox-index');
  assert.equal(model.status,'장전');
  assert.equal(model.price,'7123.80');

  rows['FUTURES:NQ']={price:25000,change_pct:-0.31,source:'yahoo',observed_at:'09:30Z',__fresh:false};
  model=context.marketAiMarketDisplayModel('nasdaq100-futures');
  assert.equal(model.status,'데이터 지연');
  assert.equal(model.price,'25000.00');
  assert.equal(model.observedAt,'09:30');
  assert.equal(model.session,'');

  rows['FUTURES:NQ'].change_pct=null;
  model=context.marketAiMarketDisplayModel('nasdaq100-futures');
  assert.equal(model.price,'25000.00');
  assert.equal(model.changePct,'--','기준가 누락은 0%로 표시하지 않는다');
  assert.equal(model.changeClass,'');

  sessions.nq='maintenance';
  model=context.marketAiMarketDisplayModel('nasdaq100-futures');
  assert.equal(model.status,'거래중단');
  sessions.nq='open';

  delete rows['INDEX:SOX'];
  model=context.marketAiMarketDisplayModel('sox-index');
  assert.equal(model.status,'데이터 없음');
  assert.equal(model.price,'--');
  assert.equal(model.observedAt,'');

  k200State={
    row:{price:450.25,change_pct:0.1,source:'kis-efriend:real',observed_at:'15:45Z'},
    rawRow:{price:450.25,change_pct:0.1,source:'kis-efriend:real',observed_at:'15:45Z'},
    reason:'closed',
    bridgeStatus:{expected_session:'closed'}
  };
  model=context.marketAiMarketDisplayModel('kospi200-futures');
  assert.equal(model.status,'장마감');
  assert.equal(model.price,'450.25');
  assert.equal(model.session,'장외');

  for(const reason of ['bridge','source','stale']){
    k200State={
      row:null,
      rawRow:{price:451.5,change_pct:0.2,source:'kis-efriend:real',observed_at:'15:50Z'},
      reason,
      bridgeStatus:{expected_session:'day'}
    };
    model=context.marketAiMarketDisplayModel('kospi200-futures');
    assert.equal(model.price,'451.50',`${reason} 상태에서도 마지막 수신 현재가는 표시한다`);
    assert.equal(model.changePct,'+0.20%',`${reason} 상태에서도 마지막 수신 등락률은 표시한다`);
    assert.equal(model.observedAt,'15:50',`${reason} 상태에서도 raw 관측시각은 유지한다`);
    assert.equal(model.session,'주간');
  }
  k200State={row:null,rawRow:null,reason:'missing',bridgeStatus:{}};
  model=context.marketAiMarketDisplayModel('kospi200-futures');
  assert.equal(model.price,'--');
  assert.equal(model.changePct,'--');
  assert.equal(model.status,'데이터 없음');

  assert.equal(context.marketAiMarketDisplayModel('unknown'),null);
});

test('Market AI 신호 상세는 신뢰도 휴리스틱 대신 신호별 입력 충족률·100% 반영비중·누락 사유를 표시한다',()=>{
  assert.match(marketAi,/signal_inputs|signalInputs/,'signal_inputs 계약을 소비해야 한다');
  assert.match(marketAi,/input_coverage|inputCoverage/,'신호별 입력 충족률을 소비해야 한다');
  assert.match(marketAi,/normalized_weight|normalizedWeight/,'backend normalized weight를 우선 소비해야 한다');
  const start=marketAi.indexOf('function marketAiSignalTooltipHtml');
  const end=marketAi.indexOf('function marketAiTooltipHtml',start);
  const tooltip=marketAi.slice(start,end);
  assert.ok(start>=0&&end>start,'Market AI signal tooltip renderer is missing');
  assert.match(tooltip,/입력 충족률/);
  assert.match(tooltip,/실제 반영 비중/);
  assert.match(tooltip,/누락 입력/);
  assert.doesNotMatch(tooltip,/신뢰도|데이터 완성도|signal\.confidence|signal\.data_completeness/,'deprecated confidence/completeness must not return to signal UI');
  const weightStart=marketAi.indexOf('function marketAiDisplayedWeights');
  const weightEnd=marketAi.indexOf('// [MARKET07]',weightStart);
  const weightBlock=marketAi.slice(weightStart,weightEnd);
  assert.match(weightBlock,/100-rows\.reduce/,'표시 비중은 정수 반올림 후 잔여를 100%까지 배분해야 한다');
  assert.match(weightBlock,/remaining-=1/,'반올림 잔여 배분이 누락되면 안 된다');
  assert.match(marketAi,/stale:'현재 세션 입력 지연'/);
  assert.match(marketAi,/missing_close:'최근 마감 데이터 없음'/);
  assert.match(marketAi,/calendar_unknown:'거래 세션 확인 불가'/);
});

test('Market AI standalone refresh는 열린 tooltip 본문도 최신 state로 동기화한다',()=>{
  assert.match(marketAi,/let marketAiActiveTooltipTarget=null/);
  assert.match(marketAi,/marketAiActiveTooltipTarget=target/);
  assert.match(marketAi,/const activeTooltip=document\.getElementById\(MARKET_AI_TOOLTIP_ID\);[^]*?if\(!signal\)\{/);
  assert.match(marketAi,/marketAiActiveTooltipTarget\?\.isConnected/);
  assert.match(marketAi,/activeTooltip\.innerHTML=html/);
  assert.match(marketAi,/marketAiActiveTooltipTarget=null;\s*const tooltip=document\.getElementById\(MARKET_AI_TOOLTIP_ID\)/);
});

test('Repository data text는 trusted HTML과 분리해 innerHTML 경계에서 escape한다',()=>{
  assert.match(app,/<h1 id="dashboardTitle">\$\{escapeHtml\(dataState\.portfolio\.meta\.title\)\}<\/h1>/);
  assert.match(ui,/labelHtml:`<span class="holding-name-text\$\{h\.fullExit\?' security-sale-marker-name':''\}">\$\{escapeHtml\(h\.name\)\}<\/span>\$\{securitySymbolSwatch\(h\.name\)\}`/);
  assert.match(pension,/labelHtml:`<span class="holding-name-text">\$\{mobileTableAssetName\(r\.name\)\}<\/span>\$\{pensionProductSwatch\(r\.name\)\}`/);
  assert.match(ui,/const cards=orderedRows\.map\(r=>\(\{\s*title:securitySaleMarkerHtml\(r\),\s*accessibleLabel:r\.name,/);
  assert.match(ui,/const title=`<span class="security-sale-marker-name">\$\{escapeHtml\(String\(row\?\.name\|\|''\)\)\}<\/span>`/);
  assert.match(pension,/const cards=orderedPensionRows\.map\(r=>\(\{\s*title:mobileTableAssetName\(r\.name\),\s*accessibleLabel:r\.name,/);
  assert.match(pensionEditor,/<h3 id="pensionActionPinTitle" class="modal-main-title">\$\{escapeHtml\(title\)\}<\/h3>/);
  assert.match(pensionEditor,/<p id="pensionActionPinDescription" class="action-modal-description">\$\{escapeHtml\(description\)\}<\/p>/);
  assert.match(pensionEditor,/value="\$\{escapeHtml\(`\$\{v\.target\}\|\$\{v\.key\}`\)\}"/);
  assert.match(charts,/function allocationValueCard\([\s\S]*?safeLabel=escapeHtml\(label\)[\s\S]*?\$\{safeLabel\}\$\{swatch\}/);
  assert.match(charts,/function symbolSummaryCard\([\s\S]*?safeLabel=escapeHtml\(label\)[\s\S]*?\$\{safeLabel\}\$\{swatch\}/);
  assert.match(charts,/\$\{escapeHtml\(chartDisplayLabel\(scope,item\.label\)\)\}<\/button>/);
  assert.doesNotMatch(app,/<h1 id="dashboardTitle">\$\{dataState\.portfolio\.meta\.title\}<\/h1>/);
  assert.doesNotMatch(ui,/labelHtml:`<span class="holding-name-text">\$\{h\.name\}\<\/span>/);
  assert.doesNotMatch(pension,/labelHtml:`<span class="holding-name-text">\$\{r\.name\}<\/span>/);
  assert.doesNotMatch(ui,/const cards=orderedRows\.map\(r=>\(\{\s*title:r\.name,/);
  assert.doesNotMatch(pension,/const cards=orderedPensionRows\.map\(r=>\(\{\s*title:r\.name,/);
  assert.doesNotMatch(pensionEditor,/<h3 id="pensionActionPinTitle" class="modal-main-title">\$\{title\}<\/h3>/);
  assert.doesNotMatch(pensionEditor,/<p id="pensionActionPinDescription" class="action-modal-description">\$\{description\}<\/p>/);
});

test('누적 차트 자동 Y축은 서로 반대 부호 데이터도 포함하면서 좌우 0선을 같은 위치에 맞춘다',()=>{
  const vm=require('node:vm');
  const start=charts.indexOf('function alignZeroTickRanges(');
  const end=charts.indexOf('\nfunction selectedCumMoneyValues',start);
  assert.ok(start>=0&&end>start,'alignZeroTickRanges block is missing');
  const context={Math};
  vm.createContext(context);
  vm.runInContext(`${charts.slice(start,end)};this.alignZeroTickRanges=alignZeroTickRanges;`,context);

  const left={min:-5_000_000,max:0,ticks:[-5_000_000,0]};
  const right={min:0,max:140,ticks:[0,20,40,60,80,100,120,140]};
  const [alignedLeft,alignedRight]=context.alignZeroTickRanges(left,5_000_000,right,20);
  assert.ok(alignedLeft.min<=-5_000_000&&alignedLeft.max>=0,'왼쪽 금액축 데이터가 범위 안에 있어야 한다');
  assert.ok(alignedRight.min<=0&&alignedRight.max>=130.73,'오른쪽 수익률축 양수 데이터가 범위 안에 있어야 한다');
  const leftZero=(0-alignedLeft.min)/(alignedLeft.max-alignedLeft.min);
  const rightZero=(0-alignedRight.min)/(alignedRight.max-alignedRight.min);
  assert.ok(Math.abs(leftZero-rightZero)<1e-12,'좌우 0선 좌표가 같아야 한다');
  assert.match(charts,/const \[alignedLeft,alignedRight\]=alignZeroTickRanges\(leftAxis\.info,leftAxis\.step,raw,step\);\s*leftAxis\.info=alignedLeft;\s*raw=alignedRight;/s);
  assert.doesNotMatch(charts,/alignFixedAxisZeroToReference/);
});

test('차트 범례 부분 렌더는 조작 control focus를 복원하고 사라지는 전체 버튼은 첫 series로 fallback한다',()=>{
  const vm=require('node:vm');
  const start=charts.indexOf('function chartControlFocusSnapshot(');
  const end=charts.indexOf('\nfunction syncChartOptions',start);
  assert.ok(start>=0&&end>start,'chart focus helper block is missing');
  let focused=null;
  const firstSeries={
    dataset:{dashboardAction:'toggle-chart-series',chartScope:'pensionCum',chartSeriesKey:'profit'},
    focus:opts=>{focused={control:firstSeries,opts};}
  };
  const root={querySelectorAll:()=>[firstSeries]};
  const legend={closest:()=>null};
  const activeControl={dataset:{dashboardAction:'toggle-chart-series',chartScope:'pensionCum',chartSeriesKey:'__all__'}};
  const context={document:{activeElement:{closest:()=>activeControl}}};
  vm.createContext(context);
  vm.runInContext(`${charts.slice(start,end)};this.chartControlFocusSnapshot=chartControlFocusSnapshot;this.restoreChartControlFocus=restoreChartControlFocus;`,context);
  const snapshot=context.chartControlFocusSnapshot('pensionCum');
  assert.deepEqual({...snapshot},{action:'toggle-chart-series',key:'__all__'});
  context.restoreChartControlFocus('pensionCum',snapshot,root,legend);
  assert.equal(focused?.control,firstSeries);
  assert.equal(focused?.opts?.preventScroll,true);
  assert.match(charts,/const focusSnapshot=chartControlFocusSnapshot\(scope\);\s*if\(legend\)legend\.innerHTML=chartLegendHtml\(scope\);[^]*?restoreChartControlFocus\(scope,focusSnapshot,card,legend\);/);
});

test('실시간 시세는 연결 gating·Phone icon entry·theme 동기화·responsive modal 계약을 유지한다',()=>{
  assert.match(ui,/data-market-ai-monitor-entry/,'실시간 시세 진입점은 Market AI 상태로 gating할 수 있어야 한다');
  assert.match(common,/\[data-market-ai-monitor-entry\]\[hidden\]\{display:none\}/,'숨김 상태는 viewport와 무관하게 보장돼야 한다');

  const mobileMenuSource=ui.slice(ui.indexOf('function renderResponsiveNavigationMenuContent()'),ui.indexOf('function renderDesktopTocContent()'));
  assert.doesNotMatch(mobileMenuSource,/REALTIME_QUOTES_ACTION/,'Tablet/Phone hamburger 관리 메뉴에는 실시간 시세 진입점을 중복 배치하지 않는다');
  const realtimeTopbarButtons=ui.match(/class="[^"]*topbar-realtime-action[^"]*"/g)||[];
  assert.equal(realtimeTopbarButtons.length,1,'실시간 시세는 viewport 경계에서 교체되지 않는 단일 Topbar 버튼이어야 한다');
  assert.match(special,/:is\(\.topbar-monthly-action,\.topbar-heatmap-action,\.topbar-realtime-action\) :is\(\.topbar-label-full,\.topbar-label-short\)\{display:none\}/,'Phone 월간 손익·히트맵·실시간 시세 버튼은 같은 DOM의 label만 숨겨 icon-only로 전환해야 한다');

  assert.match(ui,/addEventListener\('message',handleRealtimeMonitorMessage\)/,'embedded Monitor message bridge가 필요하다');
  assert.match(ui,/event\.origin!==realtimeMonitorExpectedOrigin\(\)/,'Monitor message는 origin 검증을 유지해야 한다');
  assert.match(ui,/REALTIME_MONITOR_THEME_READY_MESSAGE='market-ai-monitor:theme-ready'/);
  assert.match(ui,/REALTIME_MONITOR_THEME_STATE_MESSAGE='market-ai-monitor:theme-state'/);
  assert.match(ui,/REALTIME_MONITOR_THEME_CHANGE_MESSAGE='market-ai-monitor:theme-change'/);

  const realtimeModalCss=common.slice(common.indexOf('.realtime-quote-modal{'),common.indexOf('.pension-action-pin-modal{'));
  assert.ok(realtimeModalCss.includes('.realtime-quote-modal-card'),'실시간 시세 modal card CSS가 필요하다');
  assert.doesNotMatch(realtimeModalCss,/transform\s*:\s*scale\(/,'Monitor 자체를 scale해 글자/입력 좌표를 왜곡하면 안 된다');

  const phoneRealtimeStart=special.indexOf('/* Realtime Quotes Phone');
  const phoneRealtimeEnd=special.indexOf('.contrib-modal{',phoneRealtimeStart);
  const phoneRealtimeCss=special.slice(phoneRealtimeStart,phoneRealtimeEnd);
  assert.ok(phoneRealtimeStart>=0&&phoneRealtimeEnd>phoneRealtimeStart,'Phone 실시간 시세 responsive block이 필요하다');
  assert.doesNotMatch(phoneRealtimeCss,/--modal-overlay-pad\s*:\s*0|--modal-card-radius\s*:\s*0|position\s*:\s*fixed|inset\s*:\s*0|border-radius\s*:\s*0/,'Phone 실시간 시세가 공통 action modal 외곽 계약을 우회하면 안 된다');
  assert.doesNotMatch(phoneRealtimeCss,/--realtime-quote-shell-bg/,'Phone 전용 CSS가 shell 테마 색을 별도로 고정하면 안 된다');
});

test('Market AI 연결 toggle은 OFF fallback과 viewport별 진입점 계약을 유지한다',()=>{
  assert.match(marketAiClient,/function setMarketAiEnabled\(/);
  assert.match(marketAi,/marketAiEnabled\(\)/);
  assert.match(liveValuation,/marketAiEnabled\(\)/);
  assert.match(liveValuation,/clearLiveValuationForDisconnected\('market-ai-offline'\)/);
  const mobileMenu=ui.slice(ui.indexOf('function renderResponsiveNavigationMenuContent()'),ui.indexOf('function renderDesktopTocContent()'));
  assert.doesNotMatch(mobileMenu,/action:'toggle-market-ai-connection'/,'Phone hamburger에는 Topbar와 중복되는 Market AI 연결 action을 두면 안 된다');
  const tabsBlock=ui.slice(ui.indexOf('function renderTabs(){'),ui.indexOf('\nfunction toggleMobileDataView'));
  assert.doesNotMatch(tabsBlock,/\$\{phoneUi\(\)\?'':/,'Market AI toggle 생성 여부를 최초 viewport에 고정하면 크기 변경 후 새로고침이 필요해진다');
  assert.match(tabsBlock,/class="date-tool-btn control-icon-button topbar-market-ai-toggle"/,'Market AI toggle은 Web/Tablet/Phone Topbar에서 같은 control을 재사용해야 한다');
  assert.match(special,/button\.topbar-market-ai-toggle\{[^}]*display:inline-flex/,'Phone Topbar에서도 Market AI 연결 toggle을 유지해야 한다');
  assert.match(special,/\.switcher button\.topbar-theme-action\{display:none\}/,'Phone Topbar에서는 theme control만 숨겨야 한다');
  assert.match(special,/\.date-action-menu\.mobile-combined-menu \.mobile-nav-theme-action\{display:inline-flex\}/,'Phone 테마 control은 hamburger 상단에서 제공해야 한다');
  assert.match(tabsBlock,/<span>Top바 고정<\/span>/,'Phone hamburger 고정 스위치는 Top바 고정 문구를 사용해야 한다');
});

test('Market AI는 초기 OFF로 열려도 연결 켜기 lifecycle listener를 먼저 등록한다',()=>{
  const start=marketAi.indexOf('function startMarketAiBridge(){');
  const end=marketAi.indexOf('\nstartMarketAiBridge();',start);
  assert.ok(start>=0&&end>start,'Market AI lifecycle block is missing');
  const block=marketAi.slice(start,end);
  assert.match(marketAi,/function handleMarketAiEnabledChange\(event\)/);
  assert.match(block,/window\.addEventListener\(MARKET_AI_ENABLED_EVENT,handleMarketAiEnabledChange\)/);
  assert.doesNotMatch(block,/if\(!marketAiUiEnabled\(\)\)\{[^]*?removeMarketAiUi\(\);[^]*?return;/);
  assert.ok(
    block.indexOf('window.addEventListener(MARKET_AI_ENABLED_EVENT,handleMarketAiEnabledChange)')
      < block.indexOf('if(marketAiUiEnabled())'),
    'enabled listener must exist before initial enabled-state branch'
  );
});

test('개인보기 3회 입력은 Web/Tablet 기준문구와 Phone Hero 전체를 같은 click handler로 처리한다',()=>{
  assert.match(app,/data-dashboard-action="hero-basis-tap"/);
  assert.match(app,/phoneUi\(\)&&heroCardTarget\(event\.target\)[^]*?handleHeroBasisTap\(\)/s);
  assert.doesNotMatch(app,/addEventListener\('pointer(?:down|up|cancel)'/);
  const toggleStart=app.indexOf('function togglePersonalView(){');
  const toggleEnd=app.indexOf('\nfunction handleHeroBasisTap',toggleStart);
  const toggleBlock=app.slice(toggleStart,toggleEnd);
  assert.match(toggleBlock,/syncPersonalViewControls\(\)/,'개인보기 unlock/lock은 full render 대신 mount된 control visibility만 동기화해야 한다');
  assert.doesNotMatch(toggleBlock,/\brender\(\)/,'개인보기 3회 입력에서 #app full render를 호출하면 안 된다');
  assert.match(ui,/data-personal-view-control/,'개인보기 control은 최초 render부터 mount되어 있어야 한다');
  assert.match(common,/\[data-personal-view-control\]\[hidden\],\s*\.date-action-menu\.mobile-combined-menu \[data-personal-view-control\]\[hidden\]\{display:none\}/,'Tablet/Phone 관리 메뉴에서도 개인보기 hidden이 nav item display 규칙보다 높은 specificity를 가져야 한다');
});

test('자산 탭 전환은 이미 그린 차트를 재사용하고 최초 차트만 다음 paint 이후 lazy draw한다',()=>{
  assert.match(charts,/function assetTabChartsReady\(tab=uiState\.activeAssetTab\)/);
  const start=ui.indexOf('function setAssetTab(tab,{scroll=false}={}){');
  const end=ui.indexOf('\nfunction handleAssetTabKeydown',start);
  const block=ui.slice(start,end);
  assert.match(block,/const needsChartDraw=!assetTabChartsReady\(tab\)/);
  assert.match(block,/requestAnimationFrame\(\(\)=>\{[^]*?if\(!needsChartDraw\)return;[^]*?requestAnimationFrame\(\(\)=>\{[^]*?drawAllCharts\(\)/s);
});

test('자산 탭 차트 cache는 현재 표시 크기와 viewBox가 다르면 무효화한다',()=>{
  const vm=require('node:vm');
  const chartIds=['pensionChartCum','pensionChartSymbol','pensionChartAlloc'];
  const svgs=Object.fromEntries(chartIds.map(id=>[id,{
    childElementCount:1,
    clientWidth:520,
    clientHeight:330,
    viewBox:{baseVal:{width:1120}}
  }]));
  const context={
    chartRuntimeState:{expanded:null},
    chartViewBoxSize:svg=>({w:Math.round(330*svg.clientWidth/svg.clientHeight)}),
    uiState:{activeAssetTab:'pension'},
    document:{getElementById:id=>svgs[id]||null},
    Math
  };
  vm.createContext(context);
  const redrawStart=charts.indexOf('function chartSvgViewBoxNeedsRedraw');
  const redrawEnd=charts.indexOf('\n// [CHART02]',redrawStart);
  const readyStart=charts.indexOf('function assetTabChartIds');
  const readyEnd=charts.indexOf('\nfunction drawAllCharts',readyStart);
  assert.ok(redrawStart>=0&&redrawEnd>redrawStart&&readyStart>=0&&readyEnd>readyStart);
  vm.runInContext(charts.slice(redrawStart,redrawEnd),context);
  vm.runInContext(charts.slice(readyStart,readyEnd),context);
  assert.equal(context.assetTabChartsReady('pension'),false);
  Object.values(svgs).forEach(svg=>{svg.viewBox.baseVal.width=520;});
  assert.equal(context.assetTabChartsReady('pension'),true);
});

test('증권 historical 차트 universe와 요약 카드 universe는 독립적으로 유지한다',()=>{
  assert.match(core,/const securityTotalProfitValue=h=>Number\(h\?\.totalProfit\?\?h\?\.profit\)\|\|0/);
  assert.match(core,/const securityHistoricalChartCardItems=d=>securityHistoricalChartItems\(d\)\.filter\(item=>securityHistoricalCardVisibleForDate\(item,d\)\)/);
  assert.match(core,/const securityHistoricalAllocCardItems=d=>securityHistoricalAllocItems\(d\)\.filter\(item=>securityHistoricalCardVisibleForDate\(item,d\)\)/);
  assert.match(charts,/symbolSeries=securityHistoricalChartItems\(x\.date\),symbolCards=securityHistoricalChartCardItems\(x\.date\)/);
  assert.match(charts,/symbolTotal=symbolSeries\.reduce\(\(a,h\)=>a\+Number\(h\.totalProfit\?\?h\.profit\?\?0\),0\)/);
  assert.match(charts,/const profit=Number\(h\.totalProfit\?\?h\.profit\?\?0\),performanceCost=Number\(h\.performanceCost\?\?h\.cost\?\?0\)/);
  assert.match(charts,/securityHistoricalChartNamesForDate\(dataState\.activeDate\)/);
  assert.match(charts,/const items=dataState\.activeDate\?securityHistoricalAllocItems\(dataState\.activeDate\):\[\]/);
  assert.match(charts,/securityHistoricalAllocCardItems\(x\.date\)\.map\(h=>\{/);
});

test('전량매도 취소선과 거래 상세 tooltip은 동일한 공통 lifecycle 조건을 4개 화면에 적용한다',()=>{
  assert.match(core,/const securityFullExitForDate=\(ticker,d\)=>/);
  assert.match(core,/const securityFullExitSaleForDate=\(ticker,d\)=>/);
  assert.match(core,/if\(!securityFullExitForDate\(ticker,d\)\)return null/);
  assert.match(core,/const sale=securityFullExitSaleForDate\(h\?\.ticker,date\),fullExit=!!sale/);
  assert.match(ui,/securitySaleTooltipAttrs\(h,\{focusScope:'holdings'\}\)/);
  assert.match(ui,/labelClass:saleTooltipAttrs\?'security-sale-cell':''/);
  assert.match(ui,/labelAttrs:saleTooltipAttrs/);
  assert.match(ui,/securitySaleTooltipAttrs\(r\)/);
  assert.match(charts,/securitySaleTooltipAttrs\(\{\.\.\.h,sale\},\{focusScope:'allocation-card'\}\)/);
  assert.match(charts,/securitySaleTooltipAttrs\(\{\.\.\.h,sale\},\{focusScope:'symbol-card'\}\)/);
  assert.match(charts,/cardAttrs:saleTooltipAttrs/);
  assert.match(uiCommon,/function securitySaleTooltipAttrs\(row,\{focusScope=''\}=\{\}\)/);
  assert.match(uiCommon,/data-security-sale-tooltip/);
  assert.match(uiCommon,/data-sale-price/);
  assert.match(uiCommon,/data-sale-cost/);
  assert.match(uiCommon,/data-sale-net/);
  assert.match(uiCommon,/data-sale-basis/);
  assert.match(uiCommon,/data-sale-profit/);
  assert.match(uiCommon,/data-sale-hypo-available/);
  assert.match(uiCommon,/data-sale-hypo-price/);
  assert.match(uiCommon,/data-sale-hypo-date/);
  assert.match(uiCommon,/data-sale-hypo-eval/);
  assert.match(uiCommon,/data-sale-hypo-profit/);
  assert.match(uiCommon,/지금까지 안 팔았다면\?/);
  assert.match(uiCommon,/diff>0\?'\(팔길 잘했네요!\)':diff<0\?'\(존버가 승리\.\.\.\)':''/);
  assert.match(uiCommon,/현재 시세 없음/);
  assert.match(core,/const securityHypotheticalLatestQuote=ticker=>/);
  assert.match(core,/const hypotheticalQuote=securityHypotheticalLatestQuote\(ticker\)/);
  assert.doesNotMatch(core,/currentMarketPrice=liveQuote\?\.price\?\?securityValuationOverride/);
  assert.match(uiCommon,/const SECURITY_SALE_TOOLTIP_ID='securitySaleTooltip'/);
  assert.match(uiCommon,/tooltip\.className='dash-tooltip'/);
  assert.match(uiCommon,/assetSourceTooltipRow\('매도가',data\.salePrice\)/);
  assert.match(uiCommon,/assetSourceTooltipRow\('거래비용',data\.saleCost\)/);
  assert.match(uiCommon,/assetSourceTooltipRow\('순매도대금',data\.saleNet\)/);
  assert.match(uiCommon,/assetSourceTooltipRow\('매수원가',data\.saleBasis\)/);
  assert.match(uiCommon,/assetSourceTooltipRow\('실현손익',data\.saleProfit\)/);
  assert.match(common,/\.security-sale-marker-name\{[^}]*text-decoration-line:line-through/s);
  assert.match(common,/\.security-sale-cell\{\s*cursor:help;/s);
  assert.match(app,/setupSecuritySaleTooltips\(\)/);
  assert.match(app,/hideSecuritySaleTooltip\(\)/);
});

test('추적 현금은 최신 확인값을 기준으로 표시하고 계좌1 검산/원천 추적에서 내부 현금 왕복 행을 노출하지 않는다',()=>{
  assert.match(ui,/outsideCashSnapshot=outsideCashSnapshotForDate\(x\.date\)/);
  assert.match(ui,/`\$\{outsideCashSnapshot\.date\} 확인값 \$\{won\(outsideCash\)\}`/);
  const sourceStart=ui.indexOf('function renderSourceTables(x)');
  const sourceEnd=ui.indexOf('// [UI12]',sourceStart);
  const sourceBlock=ui.slice(sourceStart,sourceEnd);
  assert.doesNotMatch(sourceBlock,/sourceTableRow\('실현수익 투입'/);
  assert.doesNotMatch(sourceBlock,/sourceTableRow\('증권계좌 원금 회수'/);
  assert.doesNotMatch(sourceBlock,/realizedProfitRow|internalCashReturnRow/);
  assert.match(sourceBlock,/internalCashNetRow=internalCashPrincipalNet\?sourceTableRow\('내부 현금 순이동'/);
});

