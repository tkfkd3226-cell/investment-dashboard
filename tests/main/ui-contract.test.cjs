const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'../..');
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
const uiCommon=read('js/dashboard-ui-common.js');
const ui=read('js/dashboard-ui.js');
const pensionEditor=read('js/dashboard-pension-editor.js');
const marketAi=read('js/dashboard-market-ai.js');
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

test('Main boot contract: CSS 6개 순서와 app/Market AI 두 module entry를 유지한다',()=>{
  const cssOrder=['common.css','tablet.css','mobile.css','special.css','interaction.css','print.css'];
  let last=-1;
  for(const file of cssOrder){
    const at=index.indexOf(`'${file}'`);
    assert.ok(at>last,`${file} must keep canonical CSS order`);
    last=at;
  }
  assert.match(index,/type="module" src="js\/dashboard-app\.js\?v=/);
  assert.match(index,/type="module" src="js\/dashboard-market-ai\.js\?v=/);
});


test('Main appearance 두 control은 localStorage와 BroadcastChannel을 함께 갱신한다',()=>{
  assert.match(ui1,/const THEME_STORAGE_KEY='investmentDashboard\.theme'/);
  assert.match(ui1,/const CORNER_THEME_STORAGE_KEY='investmentDashboard\.cornerTheme'/);
  assert.match(ui1,/const APPEARANCE_CHANNEL_NAME='investmentDashboard\.appearance'/);
  assert.match(ui1,/appearanceChannel=new BroadcastChannel\(APPEARANCE_CHANNEL_NAME\)/);
  assert.match(ui1,/function publishAppearanceChange\(\)\{ try\{appearanceChannel\?\.postMessage\(\{theme:currentTheme\(\),cornerTheme:currentCornerTheme\(\)\}\)\}catch\(_\)\{\} \}/);
  assert.match(ui1,/function setTheme\(theme,\{redraw=true\}=\{\}\)\{[^]*?localStorage\.setItem\(THEME_STORAGE_KEY,dark\?'dark':'light'\)[^]*?syncThemeControls\(\); publishAppearanceChange\(\);/);
  assert.match(ui1,/function setCornerTheme\(theme\)\{[^]*?localStorage\.setItem\(CORNER_THEME_STORAGE_KEY,rounded\?'rounded':'soft-square'\)[^]*?syncCornerThemeControls\(\); publishAppearanceChange\(\);/);
});

test('Main module boundary: core는 DOM 비의존, modal은 무의존, Market AI는 modal만 공유한다',()=>{
  assert.doesNotMatch(core,/\bdocument\b/);
  assert.doesNotMatch(core,/\bwindow\b/);
  assert.deepEqual(importsOf(modal),[]);
  assert.deepEqual(importsOf(marketAi),['./dashboard-modal.js']);
});

test('Main graph entry: app은 core/ui-common/modal/charts/ui/pension/pension-editor를 orchestration한다',()=>{
  const imports=importsOf(app);
  for(const dependency of [
    './dashboard-core.js','./dashboard-ui-common.js','./dashboard-modal.js','./dashboard-charts.js',
    './dashboard-ui.js','./dashboard-pension.js','./dashboard-pension-editor.js'
  ])assert.ok(imports.includes(dependency),`missing app dependency ${dependency}`);
  assert.equal(imports.includes('./dashboard-market-ai.js'),false);
});

test('Responsive 기본 3구간은 Desktop >=1101 / Tablet 761~1100 / Mobile <=760으로 유지한다',()=>{
  assert.match(tablet,/@media\s*\(min-width:761px\)\s*and\s*\(max-width:1100px\)/);
  assert.match(mobile,/@media\s*\(max-width:760px\)/);
  assert.match(special,/@media\s*\(min-width:1101px\)\s*and\s*\(max-width:1279px\)/);
  assert.match(special,/@media\s*\(max-width:400px\)/);
});

test('Section title/action과 segmented control은 공통 geometry·viewport token contract를 사용한다',()=>{
  assert.match(common1,/--dashboard-control-height:29px/);
  assert.match(common1,/--section-chip-height:var\(--dashboard-control-height\)/);
  assert.match(common1,/--dashboard-control-group-gap:var\(--space-xl\)/);
  assert.match(common1,/--section-title-gap:var\(--space-xl\)/);
  assert.match(common1,/\.section-title, \.chart-head\{ display:flex; justify-content:space-between; gap:var\(--space-5xl\); \}/);
  assert.match(common1,/\.chart-head-actions, \.section-title-actions\{ display:flex; align-items:center; justify-content:flex-end; gap:var\(--dashboard-control-group-gap\)/);
  assert.match(special1,/--dashboard-control-height:25px/);
  assert.match(special1,/--dashboard-control-group-gap:var\(--space-sm\)/);
  assert.match(special1,/--section-title-gap:var\(--space-sm\)/);
  assert.match(special1,/\.control-tab\{ min-height:28px;[^}]*font-size:var\(--type-size-sm\)/);
  assert.match(special1,/\.asset-workspace-tabs\{width:100%;margin-bottom:var\(--space-4xl\)\}/);
  for(const source of [common,charts,ui,pensionEditor]) assert.doesNotMatch(source,/chart-compare-toggle|asset-tab-active/);
  assert.match(common1,/\.control-segmented\{/);
  assert.match(interaction,/:is\(\.asset-workspace-tab,\.contrib-target-option\):not\(\.active\):hover/);
  assert.doesNotMatch(mobile,/position:relative;top:1px/);
  assert.doesNotMatch(ui,/source-title/);
});

test('Card surface와 viewport section rhythm은 semantic token 단일 contract를 사용한다',()=>{
  const tablet1=compact(tablet);
  const mobile1=compact(mobile);
  assert.match(common1,/--page-section-gap:var\(--space-9xl\)/);
  assert.match(tablet1,/--page-section-gap:var\(--space-8xl\)/);
  assert.match(special1,/--page-shell-gutter:var\(--space-xl\)/);
  assert.match(special1,/--page-section-gap:var\(--space-5xl\)/);
  assert.match(common1,/--asset-band-section-gap:var\(--card-grid-gap-large\)/);
  assert.match(common1,/:is\(\.card,\.note,\.chart-card\)\{ background:var\(--card\); border-radius:min\(var\(--surface-radius-large\),var\(--corner-surface-cap\)\); padding:var\(--surface-pad-large\)/);
  assert.match(common1,/:is\(\.chart-grid,\.asset-detail-grid,\.metric-grid,\.source-grid,\.ledger-overview-grid\)\{gap:var\(--card-grid-gap-large\)\}/);
  assert.doesNotMatch(common1,/:is\([^}]*#ledger-check[^}]*\)\{gap:/);
  assert.match(common1,/:is\(\.asset-detail-grid,\.securities-subsection,\.pension-chart-block\)\{margin-top:var\(--asset-band-section-gap\)\}/);
assert.match(common1,/\.source-table-scroll\{margin-top:var\(--source-table-gap\);border-radius:0\}/);
  assert.match(common1,/\.change-table-wrap\{margin-top:var\(--space-5xl\);border-radius:min\(var\(--surface-radius-xs\),var\(--corner-surface-cap\)\)\}/);
  assert.match(common1,/\.data-list-card\{[^}]*border-radius:min\(var\(--surface-radius-mini\),var\(--corner-surface-cap\)\)/);
  assert.doesNotMatch(common,/--surface-radius-data-list:/);
  assert.equal((common.match(/--surface-border-muted:/g)||[]).length,1);
  assert.doesNotMatch(common1,/#ledger-check \.ledger-overview-grid\{[^}]*margin-top:/);
  assert.doesNotMatch(common1,/\.change-kpis\{[^}]*margin-top:/);
  assert.doesNotMatch(mobile1,/\.asset-workspace-tabs\{/);
});

test('Phone Landscape는 별도 일반 breakpoint가 아니라 touch landscape 기능 media로 유지한다',()=>{
  const query='(orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse)';
  assert.ok(compact(special).includes(`@media ${query}{`));
  assert.match(uiCommon,/const PHONE_LANDSCAPE_QUERY='\(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)'/);
  assert.match(uiCommon,/function phoneUi\(\)\{\s*return window\.matchMedia\?\.\('\(max-width:760px\)'\)\.matches===true\|\|phoneLandscapeUi\(\);\s*\}/);
});

test('Topbar 날짜 년월/일 select는 같은 width token을 공유한다',()=>{
  assert.match(common1,/--topbar-date-select-width:148px/);
  assert.match(common1,/\.month-select\{min-width:var\(--topbar-date-select-width\);flex:0 0 var\(--topbar-date-select-width\)\}/);
  assert.match(common1,/\.day-select\{min-width:var\(--topbar-date-select-width\);flex:0 0 var\(--topbar-date-select-width\)\}/);
});

test('Table summary/sticky/scroll contract는 semantic token과 sticky first-column 규칙을 유지한다',()=>{
  assert.match(common1,/--data-table-summary-bg:var\(--summary-row-bg\)/);
  assert.match(common1,/--data-table-summary-weight:var\(--type-weight-strong\)/);
  assert.match(common1,/\.dashboard-data-table tbody \.summary-row > :is\(th,td\)\{ background:var\(--data-table-summary-bg\); font-weight:var\(--data-table-summary-weight\)/);
  assert.match(special1,/position:-webkit-sticky; position:sticky/);
  assert.match(special1,/tbody tr\.summary-row > :first-child\{z-index:4;background:var\(--data-table-summary-bg\)\}/);
});

test('6차 table component는 전역 base 없이 semantic table shell과 viewport source gap을 공유한다',()=>{
  const tablet1=compact(tablet);
  assert.match(common1,/\.dashboard-data-table\{[^}]*border-collapse:separate;[^}]*background:var\(--card\);[^}]*border-radius:min\(var\(--surface-radius-md\),var\(--corner-surface-cap\)\)/);
  assert.match(common1,/\.dashboard-data-table th, \.dashboard-data-table td\{[^}]*border-right:1px solid var\(--table-column-line\);[^}]*border-bottom:1px solid var\(--line\)/);
  assert.match(common1,/\.dashboard-data-table \.num\{text-align:right;font-variant-numeric:tabular-nums\}/);
  assert.doesNotMatch(common,/^table\{/m);
  assert.doesNotMatch(common,/^td\.num\{/m);
  assert.doesNotMatch(print,/^\s*table\{/m);
  assert.match(print,/\.dashboard-data-table\{\s*box-shadow:none;/);
  assert.match(common1,/--source-table-gap:var\(--space-5xl\)/);
  assert.match(tablet1,/--source-table-gap:var\(--space-4xl\)/);
  assert.match(special1,/--source-table-gap:var\(--space-2xl\)/);
  assert.match(uiCommon,/function renderDashboardDataTable\(/);
  assert.match(ui,/renderDashboardDataTable\(\{id:'combined-table-view'/);
  assert.match(ui,/renderDashboardDataTable\(\{id:'accounts-table-view'/);
  assert.match(ui,/renderDashboardDataTable\(\{wrapClass:'mobile-scroll source-table-scroll'/);
  assert.match(common1,/--interaction-row-bg:var\(--subtle-card\)/);
});

test('모바일 성과요약 KPI 4개는 Phone UI에서만 2x2 grid contract를 유지한다',()=>{
  assert.match(special1,/\.securities-summary-block \.metric-grid, \.pension-metric-grid\{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/);
});

test('5차 KPI·mini-card·모바일 data-list는 공통 typography token과 숫자 정렬 contract를 사용한다',()=>{
  const tablet1=compact(tablet);
  const mobile1=compact(mobile);
  assert.match(common1,/\.metric-card\{ --metric-label-size:13px; --metric-value-size:28px; --metric-sub-size:13px; --metric-value-min-height:35px/);
  assert.match(common1,/\.metric-card \.value\{[^}]*line-height:var\(--type-line-tight\);[^}]*font-variant-numeric:tabular-nums/);
  assert.match(common1,/\.metric-grid > \.metric-card \.value\{ min-height:var\(--metric-value-min-height\)/);
  assert.match(tablet1,/\.metric-card\{ --metric-label-size:12px; --metric-value-size:24px; --metric-sub-size:12px; --metric-value-min-height:30px/);
  assert.match(special1,/\.metric-card\{ --metric-label-size:11px; --metric-value-size:18px; --metric-sub-size:11px; --metric-value-min-height:24px/);
  assert.doesNotMatch(special1,/metric-grid > \.metric-card \.value\{min-height:/);
  assert.match(common1,/\.mini-card \.m-value\{[^}]*font-variant-numeric:tabular-nums/);
  assert.match(tablet1,/--mini-detail-size:11px/);
  assert.match(special1,/--mini-value-size:13px; --mini-detail-size:10px/);
  assert.doesNotMatch(special1,/13\.5px|9\.6px|--mini-detail-weight:500/);
  assert.match(common1,/\.data-list-card-value\{[^}]*font-variant-numeric:tabular-nums/);
  assert.doesNotMatch(mobile1,/\.mobile-data-card-value\{[^}]*font-variant-numeric/);
  assert.doesNotMatch(common,/^\.label\{/m);
  assert.doesNotMatch(common,/^\.value,/m);
});

test('7차 모바일 표↔카드 전환은 단일 config·공통 card shell·viewport별 표현 책임을 사용한다',()=>{
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

test('5차 mini summary와 source card는 presentation helper 하나를 공유하고 Main dead class를 남기지 않는다',()=>{
  assert.match(charts,/function cumulativeSummaryCards\(/);
  assert.match(charts,/cumulativeSummaryCards\(\{profitLabel:'누적손익'/);
  assert.match(charts,/cumulativeSummaryCards\(\{profitLabel:'운용손익'/);
  assert.match(charts,/function symbolSummaryCard\(/);
  assert.match(charts,/function symbolCard\(h,total\)\{return symbolSummaryCard/);
  assert.match(charts,/function pensionProductCard\(h,total\)\{return symbolSummaryCard/);
  assert.match(ui,/function sourceCard\(/);
  assert.match(ui,/sourceCard\('전체 투입원금'/);
  assert.doesNotMatch(ui,/summary-card/);
  assert.doesNotMatch(read('js/dashboard-pension.js'),/summary-card/);
  assert.match(common1,/\.symbol-metrics\{ display:grid; gap:var\(--space-2xs\); margin-top:var\(--card-text-rhythm-gap\); padding-top:var\(--card-text-rhythm-gap\)/);
  assert.match(common1,/\.phone-chart-ui \.security-alloc-card-grid > \.alloc-total-card\{[^}]*column-gap:clamp\(3px,\.45vw,6px\)/);
});

test('Chart geometry는 CHART_FRAME 단일 Source of Truth를 사용한다',()=>{
  assert.match(charts1,/const CHART_FRAME=Object\.freeze\(\{left:70,right:70,top:20,bottom:70\}\)/);
  assert.equal((charts.match(/const CHART_FRAME=/g)||[]).length,1);
  assert.match(charts1,/const minWidth=CHART_FRAME\.left\+CHART_FRAME\.right\+1/);
  assert.match(charts1,/plotW:Math\.max\(0,normalViewW-CHART_FRAME\.left-CHART_FRAME\.right\)/);
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

test('Market AI contract: KOSPI200 선물 / SOX 현물 / NQ100 선물 symbol을 고정한다',()=>{
  assert.match(marketAi,/MARKET_AI_KIS_FUTURES_SYMBOL='FUTURES:KOSPI200'/);
  assert.match(marketAi,/MARKET_AI_SOX_INDEX_SYMBOL='INDEX:SOX'/);
  assert.match(marketAi,/MARKET_AI_NASDAQ100_FUTURES_SYMBOL='FUTURES:NQ'/);
  assert.doesNotMatch(marketAi,/FUTURES:SOX/);
});

test('Market AI contract: local은 :8001, remote는 Tailscale Serve를 사용한다',()=>{
  assert.match(marketAi,/LOCAL_DASHBOARD_HOSTS=new Set\(\['localhost','127\.0\.0\.1'\]\)/);
  assert.match(marketAi,/MARKET_AI_REMOTE_BASE='https:\/\/node\.tail60a98e\.ts\.net'/);
  assert.match(marketAi,/return `\$\{location\.protocol\}\/\/\$\{location\.hostname\}:8001`/);
});

test('Market AI contract: remote 전체 실패는 UI 미노출, local 전체 실패는 연결 확인 중을 유지한다',()=>{
  assert.match(market1,/if\(!marketAiLocalMode\(\)&&marketAiState\.serverReachable!==true\)\{ removeMarketAiUi\(\); return;/);
  assert.match(market1,/if\(!serverReachable\)\{ if\(!marketAiLocalMode\(\)\)\{ removeMarketAiUi\(\); return; \} setMarketAiState\(\{ signal:null, status:'연결 확인 중'/);
});

test('Market AI refresh는 3 endpoint를 독립 호출하고 최신 refresh sequence만 state에 반영한다',()=>{
  assert.match(market1,/const \[response,nextMarketSnapshot,nextBridgeStatus\]=await Promise\.all\(\[/);
  assert.match(market1,/const serverReachable=response!==null\|\|nextMarketSnapshot!==null\|\|nextBridgeStatus!==null/);
  assert.match(market1,/let marketAiRefreshSequence=0/);
  assert.match(market1,/if\(refreshSequence!==marketAiRefreshSequence\)return/);
});

test('Market AI는 main dataState/uiState를 참조하지 않는 standalone state를 유지한다',()=>{
  assert.doesNotMatch(marketAi,/\bdataState\b/);
  assert.doesNotMatch(marketAi,/\buiState\b/);
  assert.match(marketAi,/const marketAiState=\{/);
});

test('CSS contract: 운영 CSS에는 !important override를 두지 않는다',()=>{
  for(const [name,source] of Object.entries({common,tablet,mobile,special,interaction})){
    assert.doesNotMatch(source,/!important/,`${name}.css contains !important`);
  }
});

test('CSS 책임 분리: Desktop baseline은 common, Tablet/Mobile은 전용 파일, 예외는 special에 존재한다',()=>{
  assert.match(common,/Desktop baseline/i);
  assert.match(tablet,/Tablet/i);
  assert.match(mobile,/Mobile/i);
  assert.match(special,/Compact Desktop|Phone UI Shared|Phone Landscape/);
});

test('강제 웹보기 contract: 스마트폰 web 요청은 1280, tablet 요청은 961 viewport를 사용한다',()=>{
  assert.match(index1,/if\(dashboardView==='web'\)forcedViewport=1280/);
  assert.match(index1,/if\(dashboardView==='tablet'\)forcedViewport=961/);
  assert.match(index1,/if\(forcedViewport===1280&&\(appleMobileUA\|\|desktopAppleUA\)&&touchApple&&shortSide<=500\)document\.documentElement\.classList\.add\('iphone-request-desktop'\)/);
});
