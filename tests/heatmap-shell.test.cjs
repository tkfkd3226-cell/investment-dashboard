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
const interaction=read('css/interaction.css');
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

test('히트맵은 전용 ES module 경계와 공통 helper 재사용을 유지한다',()=>{
  assert.match(index,/'dashboard-heatmap\.js'/,'히트맵 module은 importmap cache-bust 대상이어야 한다');
  assert.match(app,/from '\.\/dashboard-heatmap\.js'/,'app router가 히트맵 feature module을 명시적으로 import해야 한다');
  assert.doesNotMatch(heatmap,/\bwindow\s*\./,'히트맵 module은 window 전역 bridge를 만들면 안 된다');
  assert.doesNotMatch(heatmap,/\bfetch\s*\(/,'히트맵은 별도 network fetch를 추가하면 안 된다');
  assert.doesNotMatch(heatmap,/\bsetInterval\s*\(|\bsetTimeout\s*\(/,'히트맵은 별도 polling/timer를 추가하면 안 된다');
  assert.doesNotMatch(heatmap,/Market AI endpoint/i,'히트맵은 Market AI endpoint를 직접 소유하면 안 된다');
  assert.match(heatmap,/assetPriceSourceInfo/,'가격기준 표시는 기존 공통 source helper를 재사용해야 한다');
});

test('히트맵 Topbar 진입점은 중복 없이 지정 위치를 유지한다',()=>{
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

test('히트맵 반응형 진입점은 DOM 재배치 없이 CSS로 전환한다',()=>{
  assert.match(tablet,/\.date-picker-action \.topbar-label-full\{display:none\}/,'Tablet은 주요 action의 full label을 숨겨야 한다');
  assert.match(tablet,/\.date-picker-action \.topbar-label-short\{display:inline\}/,'Tablet은 주요 action의 축약 label을 표시해야 한다');
  assert.doesNotMatch(tablet,/\.date-picker-action \.topbar-heatmap-action\{[^}]*width:var\(--topbar-control-height\)/,'Tablet 히트맵만 icon-only geometry로 축소하면 안 된다');
  assert.doesNotMatch(tablet,/\.topbar-heatmap-action :is\(\.topbar-label-full,\.topbar-label-short\)\{display:none\}/,'Tablet 히트맵 label을 별도로 숨기면 안 된다');
  assert.match(ui,/<span class="topbar-label-short">히트맵<\/span>/,'Tablet에서 히트맵 축약 label이 보여야 한다');
  assert.match(special,/\.switcher button:is\(\.topbar-monthly-action,\.topbar-heatmap-action,\.topbar-realtime-action\)/,'Phone 히트맵은 월간/실시간과 같은 compact button geometry를 써야 한다');
  assert.doesNotMatch(ui,/appendChild\([^)]*topbar-heatmap|insertBefore\([^)]*topbar-heatmap/,'viewport 전환을 위해 히트맵 DOM을 JS로 재배치하면 안 된다');
});

test('히트맵 modal은 공통 lifecycle과 segmented control primitive를 재사용한다',()=>{
  assert.match(heatmap,/modal\.className='action-modal portfolio-heatmap-modal'/);
  assert.match(heatmap,/bindDashboardModalDismiss\(modal,\{onDismiss:closePortfolioHeatmap/);
  assert.match(heatmap,/openDashboardModal\(modal,/);
  assert.match(heatmap,/closeDashboardModal\(modal,/);
  assert.match(heatmap,/day:'당일손익'/);
  assert.match(heatmap,/cumulative:'누적손익'/);
  assert.match(heatmap,/weight:'비중'/);
  assert.match(heatmap,/const portfolioHeatmapState=\{[^}]*mode:'day'/,'기본 mode는 당일손익이어야 한다');
  assert.match(heatmap,/class="control-tab-group portfolio-heatmap-mode-tabs"/,'기존 control-tab primitive를 재사용해야 한다');
  assert.match(common,/:is\(\.contrib-target-tabs,\.monthly-calendar-mode-tabs,\.portfolio-heatmap-mode-tabs\)\{background:var\(--modal-segment-group-bg\)\}/,'세 modal segmented group은 공통 state token을 사용해야 한다');
  assert.match(common,/:is\(\.contrib-target-option,\.monthly-calendar-mode-tab,\.portfolio-heatmap-mode-tab\)\{[^}]*min-height:var\(--modal-segment-height\)[^}]*padding-inline:var\(--modal-segment-pad-x\)[^}]*font-size:var\(--modal-segment-font-size\)[^}]*font-weight:var\(--modal-segment-font-weight\)/,'세 modal은 geometry/typography token을 공유해야 한다');
  assert.match(heatmap,/class="portfolio-heatmap-date-controls"[^]*?data-dashboard-change="portfolio-heatmap-date"/,'모달 안에서 부모 기준일과 독립된 날짜 selector를 제공해야 한다');
  assert.doesNotMatch(heatmap,/appendChild\([^)]*portfolio-heatmap-date-controls|insertBefore\([^)]*portfolio-heatmap-date-controls/,'viewport 전환을 위해 날짜 control DOM을 재배치하면 안 된다');
});

test('히트맵 app router는 action을 feature owner에 위임한다',()=>{
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.open[^]*?const x=latestDashboardCalcResult=calc\(dataState\.activeDate\);[^]*?openPortfolioHeatmap\(control,x\)/,'open 시 deferred live state까지 반영하도록 현재 activeDate를 1회 fresh calc해야 한다');
  assert.doesNotMatch(app1,/PORTFOLIO_HEATMAP_ACTION\.open[^]*?latestDashboardCalcResult\?\.date===dataState\.activeDate\?latestDashboardCalcResult:/,'같은 날짜라는 이유만으로 stale canonical cache를 재사용하면 안 된다');
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.close\)return closePortfolioHeatmap\(\)/);
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.previousDate\)return shiftOpenPortfolioHeatmapDate\(-1\)/);
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.nextDate\)return shiftOpenPortfolioHeatmapDate\(1\)/);
  assert.match(app1,/target\.dataset\.dashboardChange==='portfolio-heatmap-date'\)return setOpenPortfolioHeatmapDate\(target\.value\)/,'모달 날짜 select change는 부모 date handler보다 먼저 분기해야 한다');
  assert.match(app1,/function setOpenPortfolioHeatmapDate\(date\)\{[^]*?allAvailableDates\(\)\.includes\(nextDate\)[^]*?setPortfolioHeatmapDate\(nextDate,calc\(nextDate\)\)/,'모달 날짜 변경은 사용 가능한 날짜만 canonical calc로 계산해 feature owner에 전달해야 한다');
  assert.doesNotMatch(app1,/function setOpenPortfolioHeatmapDate\(date\)\{[^}]*latestDashboardCalcResult\s*=/,'모달 전용 날짜 계산을 부모 latest calc cache로 승격하면 안 된다');
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.setMode\)return setPortfolioHeatmapMode\(control\.dataset\.heatmapMode\|\|''\)/);
  assert.match(heatmap1,/fallbackSelector:portfolioHeatmapFocusFallbackSelector\(\)/,'공통 modal focus return fallback을 제공해야 한다');
});

test('히트맵 renderer는 mode별 geometry와 고정 color scale을 연결한다',()=>{
  assert.match(heatmap,/PORTFOLIO_HEATMAP_SCALE=Object\.freeze\(\{day:3,cumulative:30\}\)/,'당일손익 등락률 ±3%, 누적 ±30% 고정 scale이어야 한다');
  assert.match(heatmap,/portfolio-heatmap__tile is-\$\{density\}/,'각 보유종목은 treemap tile button으로 렌더되어야 한다');
  assert.match(heatmap,/portfolioHeatmapTileDensity\(row\.rect,\{phoneFamily:phoneUi\(\)\}\)/,'정보 밀도는 실제 geometry px 크기와 Phone family 판정을 함께 사용해야 한다');
  assert.match(heatmap,/portfolioHeatmapState\.layoutRows=layoutPortfolioHeatmap\(portfolioHeatmapState\.rows,width,height,portfolioHeatmapState\.mode\)/,'geometry는 현재 mode의 면적 기준을 사용해야 한다');
  assert.match(heatmap,/function portfolioHeatmapAreaValue\(row,mode='weight'\)/,'mode별 area helper가 있어야 한다');
  assert.match(heatmap,/if\(mode==='day'\)[^]*?Math\.abs\(value\)/,'당일손익 면적은 dayChange 절댓값이어야 한다');
  assert.match(heatmap,/if\(mode==='cumulative'\)[^]*?Math\.abs\(value\)/,'누적손익 면적은 cumulativePnl 절댓값이어야 한다');
  assert.match(heatmap,/function setPortfolioHeatmapMode[^]*?renderPortfolioHeatmapVisualization\(\{forceLayout:true\}\)/,'mode 변경 시 geometry를 다시 계산해야 한다');
  assert.doesNotMatch(heatmap,/function setPortfolioHeatmapMode[^]*?renderPortfolioHeatmapModal\(\)/,'mode 변경 때 modal shell 전체를 다시 만들어 geometry를 흔들면 안 된다');
  assert.match(heatmap,/if\(portfolioHeatmapState\.mode==='day'\)return '당일손익이 없습니다\.'/,'당일손익 면적 합이 0이면 보유종목 없음으로 오인하지 않아야 한다');
  assert.match(heatmap,/if\(portfolioHeatmapState\.mode==='cumulative'\)return '누적손익이 없습니다\.'/,'누적손익 면적 합이 0이면 모드 의미에 맞는 empty state를 사용해야 한다');
  assert.match(common,/--heatmap-neg-base:/);
  assert.match(common,/--heatmap-neutral-base:/);
  assert.match(common,/--heatmap-pos-base:/);
  assert.match(common,/color-mix\(in srgb,var\(--heatmap-neutral-base\),var\(--heatmap-tone\) var\(--heatmap-intensity\)\)/);
});

test('히트맵 tile은 geometry별 정보량과 mode별 핵심값을 분리한다',()=>{
  assert.match(heatmap,/if\(density==='tiny'\)return ''/);
  assert.match(heatmap,/if\(density==='small'\)return name/);
  assert.match(heatmap,/if\(density==='medium'\)return `\$\{name\}\$\{primary\}`/);
  assert.match(heatmap,/portfolio-heatmap__secondary/,'Large tile에만 보조값 line을 제공해야 한다');
  assert.match(heatmap,/function syncPortfolioHeatmapSecondaryVisibility\(canvas\)/,'Large 판정과 별개로 보조문구 실제 너비를 검사해야 한다');
  assert.match(heatmap,/secondary\.hidden=secondary\.scrollWidth>secondary\.clientWidth\+1/,'보조문구가 실제 타일 폭을 넘을 때만 숨겨야 한다');
  assert.match(heatmap,/canvas\.innerHTML=portfolioHeatmapState\.layoutRows\.map\(renderPortfolioHeatmapTile\)\.join\(''\);\s*syncPortfolioHeatmapSecondaryVisibility\(canvas\)/,'타일 DOM 생성 후 실제 너비를 측정해야 한다');
  assert.match(heatmap,/if\(mode==='cumulative'\)return heatmapAmountText\(row\.cumulativePnl,\{signedValue:true\}\)/,'누적손익 Large tile은 누적손익 금액만 보조 표시해야 한다');
  assert.match(heatmap,/const formula=portfolioHeatmapDayFormulaText\(row\);\s*return formula\?`\$\{total\} · \$\{formula\}`:total/,'당일손익 Large tile은 변동총액 · 주당변동액 × 수량을 표시해야 한다');
  assert.match(heatmap,/const formula=portfolioHeatmapWeightFormulaText\(row\);\s*return formula\?`\$\{amount\} · \$\{formula\}`:amount/,'비중 Large tile은 평가금액 · 수량 × 적용가격을 표시해야 한다');
  assert.match(heatmap,/PORTFOLIO_HEATMAP_WEIGHT_STEPS=Object\.freeze/,'비중 색상은 고정 구간 scale을 사용해야 한다');
  assert.match(special,/Heatmap Phone Tile Density[^]*?\.portfolio-heatmap__tile\.is-large \.portfolio-heatmap__secondary\{[^}]*white-space:normal[^}]*-webkit-line-clamp:2/,'Phone Large tile은 긴 보조문구를 최대 2줄로 수용해야 한다');
  assert.match(common,/--heatmap-weight-base:/,'비중 mode는 손익 color scale과 분리된 semantic base를 가져야 한다');
});

test('히트맵 tooltip은 상세값과 현재 mode 핵심 행을 함께 제공한다',()=>{
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('당일 등락률',[^]*?current:mode==='day'/,'당일손익 mode는 등락률을 핵심행으로 강조해야 한다');
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('당일손익',[^]*?current:mode==='day'/,'당일손익 mode는 손익금액을 핵심행으로 강조해야 한다');
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('변동 계산',dayFormula,\{current:mode==='day'\}\)/,'산식이 유효한 날은 주당변동×수량을 상세에서 확인할 수 있어야 한다');
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('누적수익률',[^]*?current:mode==='cumulative'/,'누적손익 mode는 누적수익률을 강조해야 한다');
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('누적손익',[^]*?current:mode==='cumulative'/,'누적손익 mode는 누적손익 금액을 강조해야 한다');
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('평가금액',[^]*?current:mode==='weight'/,'비중 mode는 평가금액을 함께 강조해야 한다');
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('포트폴리오 비중',[^]*?current:mode==='weight'/,'비중 mode는 포트폴리오 비중을 강조해야 한다');
  assert.match(heatmap,/portfolioHeatmapTooltipRow\('평가 계산',weightFormula,\{current:mode==='weight'\}\)/,'비중 mode는 수량×적용가격 계산식을 상세에서 확인할 수 있어야 한다');
  assert.doesNotMatch(heatmap,/const dayText=/,'당일손익 금액과 등락률을 한 문자열로 뭉쳐 mode 의미를 흐리면 안 된다');
  assert.doesNotMatch(heatmap,/const cumulativeText=/,'누적손익 금액과 수익률을 한 문자열로 뭉쳐 mode 의미를 흐리면 안 된다');
});

test('히트맵 tooltip은 pointer/focus/touch와 공통 source helper를 사용한다',()=>{
  assert.match(heatmap,/className='dash-tooltip portfolio-heatmap-tooltip'/,'공통 dash-tooltip primitive를 재사용해야 한다');
  assert.match(heatmap,/const modal=document\.getElementById\('portfolioHeatmapModal'\)[^]*?modal\.appendChild\(tooltip\)/,'tooltip은 modal 내부에 있어 공통 inert 처리에서 제외되어야 한다');
  assert.doesNotMatch(heatmap,/document\.body\.appendChild\(tooltip\)/,'tooltip을 body sibling으로 두면 modal open 시 inert 대상이 된다');
  assert.match(heatmap,/renderPortfolioHeatmapModal\(\);\s*ensurePortfolioHeatmapTooltip\(\);\s*openDashboardModal/,'modal 내용을 렌더한 뒤 tooltip을 생성해 innerHTML 교체로 제거되지 않아야 한다');
  assert.match(heatmap,/document\.addEventListener\('pointerover'/);
  assert.match(heatmap,/document\.addEventListener\('focusin'/);
  assert.match(heatmap,/event\.pointerType!=='touch'&&event\.pointerType!=='pen'/,'touch/pen tap interaction이 있어야 한다');
  assert.match(heatmap,/portfolioHeatmapState\.pinnedIndex===index[^]*?hidePortfolioHeatmapTooltip/,'같은 tile 재탭은 닫혀야 한다');
  assert.match(heatmap,/document\.addEventListener\('scroll',\(\)=>hidePortfolioHeatmapTooltip\(\),true\)/,'scroll 시 tooltip을 닫아야 한다');
  assert.match(heatmap,/globalThis\.addEventListener\?\.\('resize',schedulePortfolioHeatmapResize/,'resize 시 tooltip을 닫고 geometry를 갱신해야 한다');
  assert.match(heatmap,/assetPriceSourceInfo\(\{/,'가격 source는 공통 helper를 사용해야 한다');
  assert.doesNotMatch(heatmap,/liveQuote\.state[^]*?'정규장|marketStatus[^]*?'장중 저장 데이터'/,'히트맵 자체에서 가격 source 문구를 재판정하면 안 된다');
});

test('히트맵 범례는 실제 color scale 의미를 재사용한다',()=>{
  assert.match(heatmap,/\[-3,-2,-1,0,1,2,3\]/,'전일 대비 범례는 -3~+3이어야 한다');
  assert.match(heatmap,/\[-30,-20,-10,0,10,20,30\]/,'누적 범례는 -30~+30이어야 한다');
  assert.match(heatmap,/label:'0–5%'/,'비중 범례는 고정 5단계 구간을 제공해야 한다');
  assert.match(heatmap,/label:'30%\+'/,'비중 범례는 30% 이상 구간을 제공해야 한다');
  assert.match(heatmap,/portfolioHeatmapColorState\(\{weight:step\.sample\},'weight'\)/,'비중 범례 swatch도 실제 weight color scale을 재사용해야 한다');
  assert.match(common,/\.portfolio-heatmap__legend\{/,'범례 surface가 존재해야 한다');
  assert.match(tablet,/\.portfolio-heatmap__canvas\{/,'Tablet은 기존 viewport owner에서 treemap canvas를 조정할 수 있어야 한다');
  assert.match(special,/Heatmap Landscape[^]*?\.portfolio-heatmap__canvas\{/,'Phone landscape 예외는 special.css의 기능 scope 안에 있어야 한다');
});

test('히트맵 날짜 상태: live refresh와 모달 날짜는 canonical 날짜 경계를 지킨다',()=>{
  assert.match(heatmap,/date:null,/,'모달 날짜는 부모 activeDate와 분리된 local state여야 한다');
  assert.match(heatmap,/function portfolioHeatmapContextFromCalc\(calcResult\)\{[^]*?date:String\(calcResult\?\.date\|\|''\)/,'히트맵 context가 부모 activeDate를 fallback으로 읽으면 안 된다');
  assert.match(heatmap,/function portfolioHeatmapIsOpen\(\)\{\s*return document\.getElementById\('portfolioHeatmapModal'\)\?\.classList\.contains\('show'\)===true;/);
  assert.match(heatmap,/function refreshPortfolioHeatmap\(calcResult\)\{\s*if\(!portfolioHeatmapIsOpen\(\)\)return false;\s*if\(portfolioHeatmapCalcDate\(calcResult\)!==portfolioHeatmapState\.date\)return false;/,'현재 모달 날짜와 다른 live 결과가 모달을 덮으면 안 된다');
  assert.match(heatmap,/applyPortfolioHeatmapCalcResult\(calcResult,\{date:portfolioHeatmapState\.date\}\)/,'live refresh도 공통 canonical 적용 경로를 재사용해야 한다');
  assert.match(heatmap,/function setPortfolioHeatmapDate\(date,calcResult\)[^]*?portfolioHeatmapCalcDate\(calcResult\)!==nextDate[^]*?applyPortfolioHeatmapCalcResult\(calcResult,\{date:nextDate\}\)/,'모달 날짜 변경은 요청 날짜와 같은 calc 결과만 수용해야 한다');
  assert.match(heatmap,/closeDashboardModal\(modal,[^]*?portfolioHeatmapState\.date=null/,'모달을 닫으면 local 날짜를 폐기해야 한다');
  assert.match(app,/const heatmapDate=portfolioHeatmapDate\(\);[^]*?heatmapDate!==dataState\.activeDate[^]*?calc\(heatmapDate\)/,'부모 날짜의 live refresh가 다른 모달 날짜를 덮지 않도록 app에서도 차단해야 한다');
  assert.match(heatmap,/const activeKey=heatmapStableKey\(portfolioHeatmapRowForTile\(activeTile\)\)/,'live refresh 전 keyboard tile focus의 stable key를 보존해야 한다');
  assert.match(heatmap,/const pinnedRow=Number\.isInteger\(portfolioHeatmapState\.pinnedIndex\)[^]*?const pinnedKey=heatmapStableKey\(pinnedRow\)/,'live refresh 전 touch pinned tile도 index가 아니라 stable key로 보존해야 한다');
  assert.match(heatmap,/hidePortfolioHeatmapTooltip\(\{clearPinned:false\}\)/,'live refresh 시작 시 pinned 선택 상태를 즉시 지우면 안 된다');
  assert.match(heatmap,/nextFocus\?\.focus\?\.\(\{preventScroll:true\}\)/,'live refresh 후 focus를 동일 종목 또는 mode control로 복원해야 한다');
  assert.match(heatmap,/if\(nextPinnedTile\)showPortfolioHeatmapTooltip\(nextPinnedTile,null,\{pinned:true\}\)/,'live refresh 후 동일 종목 tooltip을 최신 내용으로 다시 pin해야 한다');
  assert.doesNotMatch(heatmap,/\bsetInterval\s*\(|\bfetch\s*\(/,'Heatmap 자체는 polling/network를 소유하면 안 된다');
  assert.doesNotMatch(heatmap,/priceSource:holding\?\.priceSource/,'사용하지 않는 중복 priceSource View Model field를 남기지 않는다');
});

