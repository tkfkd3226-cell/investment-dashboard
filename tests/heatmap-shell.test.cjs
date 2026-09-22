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
  assert.doesNotMatch(heatmap,/Market AI endpoint/i,'히트맵은 Market AI endpoint를 직접 소유하면 안 된다');
  assert.match(heatmap,/assetPriceSourceInfo/,'가격기준 표시는 기존 공통 source helper를 재사용해야 한다');
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
  assert.match(heatmap,/day:'당일손익'/);
  assert.match(heatmap,/cumulative:'누적손익'/);
  assert.match(heatmap,/weight:'비중'/);
  assert.match(heatmap,/const portfolioHeatmapState=\{[^}]*mode:'day'/,'기본 mode는 당일손익이어야 한다');
  assert.match(heatmap,/class="control-tab-group portfolio-heatmap-mode-tabs"/,'기존 control-tab primitive를 재사용해야 한다');
  assert.match(common,/:is\(\.asset-workspace-tabs,\.contrib-target-tabs,\.monthly-calendar-mode-tabs,\.portfolio-heatmap-mode-tabs\)/,'segmented skin은 기존 공통 selector에 합류해야 한다');
  assert.match(common,/--modal-segment-height:28px/,'퇴직연금/월간/히트맵 modal segmented 높이는 공통 token을 사용해야 한다');
  assert.match(common,/:is\(\.contrib-target-option,\.monthly-calendar-mode-tab,\.portfolio-heatmap-mode-tab\)\{[^}]*min-height:var\(--modal-segment-height\)[^}]*padding-inline:var\(--modal-segment-pad-x\)[^}]*font-size:var\(--modal-segment-font-size\)/,'세 modal의 segmented button geometry가 같은 token을 사용해야 한다');
  assert.match(tablet,/--modal-segment-font-size:var\(--type-size-md\)/,'Tablet modal segmented typography는 viewport token으로 조정해야 한다');
  assert.match(special,/--modal-segment-font-size:var\(--type-size-sm\)/,'Phone modal segmented typography는 viewport token으로 조정해야 한다');
  assert.match(common,/\.portfolio-heatmap-modal\{[^}]*--modal-card-width:min\(1160px,100%\)/,'Web heatmap modal은 넓은 shell을 가져야 한다');
  assert.match(common,/\.portfolio-heatmap-head\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/,'Web 히트맵 mode는 좌우 대칭 grid의 중앙 열을 사용해야 한다');
  assert.match(common,/\.portfolio-heatmap-mode-tabs\{[^}]*grid-column:2[^}]*justify-self:center/,'Web/Tablet 히트맵 mode selector는 modal 중앙에 정렬되어야 한다');
  assert.doesNotMatch(tablet,/\.portfolio-heatmap-head\{[^}]*grid-template-columns:1fr/,'Tablet에서 히트맵 mode selector를 다시 좌측 2줄 배치로 되돌리면 안 된다');
  assert.match(special,/\.portfolio-heatmap-head\{[^}]*grid-template-columns:1fr/,'Phone은 기존 title 아래 mode 배치를 유지해야 한다');
  assert.match(special,/\.portfolio-heatmap-mode-tabs\{grid-column:1;justify-self:stretch;width:100%\}/,'Phone mode selector는 기존 full-width 3등분 배치를 유지해야 한다');
  assert.match(special,/\.portfolio-heatmap-modal\{--modal-card-width:100%\}/,'Phone은 거의 full-width modal shell을 사용해야 한다');
  assert.match(special,/\.action-modal:not\(\.monthly-calendar-modal\):not\(\.realtime-quote-modal\):not\(\.portfolio-heatmap-modal\)\{/,'Phone landscape에서도 히트맵은 generic action modal 중앙형 override 대상에서 제외되어야 한다');
});

test('히트맵 1차: app action router가 open/close/mode를 feature owner에 위임한다',()=>{
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.open[^]*?const x=latestDashboardCalcResult=calc\(dataState\.activeDate\);[^]*?openPortfolioHeatmap\(control,x\)/,'open 시 deferred live state까지 반영하도록 현재 activeDate를 1회 fresh calc해야 한다');
  assert.doesNotMatch(app1,/PORTFOLIO_HEATMAP_ACTION\.open[^]*?latestDashboardCalcResult\?\.date===dataState\.activeDate\?latestDashboardCalcResult:/,'같은 날짜라는 이유만으로 stale canonical cache를 재사용하면 안 된다');
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.close\)return closePortfolioHeatmap\(\)/);
  assert.match(app1,/action===PORTFOLIO_HEATMAP_ACTION\.setMode\)return setPortfolioHeatmapMode\(control\.dataset\.heatmapMode\|\|''\)/);
  assert.match(heatmap1,/fallbackSelector:portfolioHeatmapFocusFallbackSelector\(\)/,'공통 modal focus return fallback을 제공해야 한다');
});

test('히트맵 3차: Finviz형 dense tile과 고정 color scale을 renderer에 연결한다',()=>{
  assert.match(heatmap,/PORTFOLIO_HEATMAP_SCALE=Object\.freeze\(\{day:3,cumulative:30\}\)/,'전일 대비 ±3%, 누적 ±30% 고정 scale이어야 한다');
  assert.match(heatmap,/portfolio-heatmap__tile is-\$\{density\}/,'각 보유종목은 treemap tile button으로 렌더되어야 한다');
  assert.match(heatmap,/portfolioHeatmapTileDensity\(row\.rect,\{phoneFamily:phoneUi\(\)\}\)/,'정보 밀도는 실제 geometry px 크기와 Phone family 판정을 함께 사용해야 한다');
  assert.match(heatmap,/portfolioHeatmapState\.layoutRows=layoutPortfolioHeatmap\(portfolioHeatmapState\.rows,width,height,portfolioHeatmapState\.mode\)/,'geometry는 현재 mode의 면적 기준을 사용해야 한다');
  assert.match(heatmap,/function portfolioHeatmapAreaValue\(row,mode='weight'\)/,'mode별 area helper가 있어야 한다');
  assert.match(heatmap,/if\(mode==='day'\)[^]*?Math\.abs\(value\)/,'전일 대비 면적은 dayChange 절댓값이어야 한다');
  assert.match(heatmap,/if\(mode==='cumulative'\)[^]*?Math\.abs\(value\)/,'누적손익 면적은 cumulativePnl 절댓값이어야 한다');
  assert.match(heatmap,/function setPortfolioHeatmapMode[^]*?renderPortfolioHeatmapVisualization\(\{forceLayout:true\}\)/,'mode 변경 시 geometry를 다시 계산해야 한다');
  assert.doesNotMatch(heatmap,/function setPortfolioHeatmapMode[^]*?renderPortfolioHeatmapModal\(\)/,'mode 변경 때 modal shell 전체를 다시 만들어 geometry를 흔들면 안 된다');
  assert.match(heatmap,/if\(portfolioHeatmapState\.mode==='day'\)return '전일 대비 변동이 없습니다\.'/,'전일 대비 면적 합이 0이면 보유종목 없음으로 오인하지 않아야 한다');
  assert.match(heatmap,/if\(portfolioHeatmapState\.mode==='cumulative'\)return '누적손익이 없습니다\.'/,'누적손익 면적 합이 0이면 모드 의미에 맞는 empty state를 사용해야 한다');
  assert.match(common,/--heatmap-neg-base:/);
  assert.match(common,/--heatmap-neutral-base:/);
  assert.match(common,/--heatmap-pos-base:/);
  assert.match(common,/color-mix\(in srgb,var\(--heatmap-neutral-base\),var\(--heatmap-tone\) var\(--heatmap-intensity\)\)/);
});

test('히트맵 3차: Large/Medium/Small/Tiny 정보량과 mode별 핵심값 역할을 분리한다',()=>{
  assert.match(heatmap,/if\(density==='tiny'\)return ''/);
  assert.match(heatmap,/if\(density==='small'\)return name/);
  assert.match(heatmap,/if\(density==='medium'\)return `\$\{name\}\$\{primary\}`/);
  assert.match(heatmap,/portfolio-heatmap__secondary/,'Large tile에만 보조값 line을 제공해야 한다');
  assert.match(heatmap,/function syncPortfolioHeatmapSecondaryVisibility\(canvas\)/,'Large 판정과 별개로 보조문구 실제 너비를 검사해야 한다');
  assert.match(heatmap,/secondary\.hidden=secondary\.scrollWidth>secondary\.clientWidth\+1/,'보조문구가 실제 타일 폭을 넘을 때만 숨겨야 한다');
  assert.match(heatmap,/canvas\.innerHTML=portfolioHeatmapState\.layoutRows\.map\(renderPortfolioHeatmapTile\)\.join\(''\);\s*syncPortfolioHeatmapSecondaryVisibility\(canvas\)/,'타일 DOM 생성 후 실제 너비를 측정해야 한다');
  assert.match(heatmap,/if\(mode==='cumulative'\)return heatmapAmountText\(row\.cumulativePnl,\{signedValue:true\}\)/,'누적손익 Large tile은 누적손익 금액만 보조 표시해야 한다');
  assert.match(heatmap,/`\$\{total\} · \$\{heatmapAmountText\(unit,\{signedValue:true\}\)\} × \$\{fmt\(qty\)\}주`/,'전일 대비 Large tile은 변동총액 · 주당변동액 × 수량을 표시해야 한다');
  assert.match(heatmap,/`\$\{amount\} · \$\{fmt\(qty\)\}주 × \$\{won\(price\)\}`/,'비중 Large tile은 평가금액 · 수량 × 적용가격을 표시해야 한다');
  assert.match(heatmap,/PORTFOLIO_HEATMAP_WEIGHT_STEPS=Object\.freeze/,'비중 색상은 고정 구간 scale을 사용해야 한다');
  assert.match(special,/Heatmap Phone Tile Density[^]*?\.portfolio-heatmap__tile\.is-large \.portfolio-heatmap__secondary\{[^}]*font-size:9px[^}]*white-space:normal[^}]*-webkit-line-clamp:2/,'Phone Large tile은 충분한 면적에서 긴 보조문구를 compact 2줄로 유지해야 한다');
  assert.match(common,/--heatmap-weight-base:#0f6074/,'Light 비중 색상은 손익과 구분되는 청록-슬레이트 계열이어야 한다');
  assert.match(common,/\.portfolio-heatmap__tile\.is-large/);
  assert.match(common,/\.portfolio-heatmap__tile\.is-medium/);
  assert.match(common,/\.portfolio-heatmap__tile\.is-small/);
  assert.match(common,/\.portfolio-heatmap__tile\.is-tiny/);
});

test('히트맵 3차: tooltip은 pointer/focus/touch를 지원하고 기존 source helper를 재사용한다',()=>{
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

test('히트맵 3차: 범례와 4 viewport modal density를 제공한다',()=>{
  assert.match(heatmap,/\[-3,-2,-1,0,1,2,3\]/,'전일 대비 범례는 -3~+3이어야 한다');
  assert.match(heatmap,/\[-30,-20,-10,0,10,20,30\]/,'누적 범례는 -30~+30이어야 한다');
  assert.match(heatmap,/label:'0–5%'/,'비중 범례는 고정 5단계 구간을 제공해야 한다');
  assert.match(heatmap,/label:'30%\+'/,'비중 범례는 30% 이상 구간을 제공해야 한다');
  assert.match(heatmap,/portfolioHeatmapColorState\(\{weight:step\.sample\},'weight'\)/,'비중 범례 swatch도 실제 weight color scale을 재사용해야 한다');
  assert.match(common,/\.portfolio-heatmap__legend\{/);
  assert.match(tablet,/\.portfolio-heatmap__canvas\{height:clamp\(380px,54vh,540px\)\}/,'Tablet 전용 treemap 높이 계약을 유지해야 한다');
  assert.match(special,/\.portfolio-heatmap__canvas\{[^}]*height:clamp\(240px,58dvh,490px\)/,'Phone portrait treemap 높이를 확보해야 한다');
  assert.match(special,/Heatmap Landscape[^]*height:clamp\(180px,calc\(100dvh - 118px\),250px\)/,'Phone landscape는 세로 공간을 compact하게 사용해야 한다');
});

test('히트맵 4차: live refresh는 열린 modal에서만 canonical rows/context를 교체하고 polling을 소유하지 않는다',()=>{
  assert.match(heatmap,/function portfolioHeatmapIsOpen\(\)\{\s*return document\.getElementById\('portfolioHeatmapModal'\)\?\.classList\.contains\('show'\)===true;/);
  assert.match(heatmap,/function refreshPortfolioHeatmap\(calcResult\)\{\s*if\(!portfolioHeatmapIsOpen\(\)\)return false;/,'닫힌 modal에서는 refresh 작업을 하지 않아야 한다');
  assert.match(heatmap,/portfolioHeatmapState\.rows=createPortfolioHeatmapViewModelFromCalc\(calcResult\|\|\{\}\)/);
  assert.match(heatmap,/portfolioHeatmapState\.context=portfolioHeatmapContextFromCalc\(calcResult\|\|\{\}\)/);
  assert.match(heatmap,/portfolioHeatmapState\.layoutRows=\[\];[^]*?renderPortfolioHeatmapVisualization\(\{forceLayout:true\}\)/,'live 평가금액 변경 시 geometry는 새 canonical rows 기준으로 다시 계산해야 한다');
  assert.match(heatmap,/const activeKey=heatmapStableKey\(portfolioHeatmapRowForTile\(activeTile\)\)/,'live refresh 전 keyboard tile focus의 stable key를 보존해야 한다');
  assert.match(heatmap,/const pinnedRow=Number\.isInteger\(portfolioHeatmapState\.pinnedIndex\)[^]*?const pinnedKey=heatmapStableKey\(pinnedRow\)/,'live refresh 전 touch pinned tile도 index가 아니라 stable key로 보존해야 한다');
  assert.match(heatmap,/hidePortfolioHeatmapTooltip\(\{clearPinned:false\}\)/,'live refresh 시작 시 pinned 선택 상태를 즉시 지우면 안 된다');
  assert.match(heatmap,/nextFocus\?\.focus\?\.\(\{preventScroll:true\}\)/,'live refresh 후 focus를 동일 종목 또는 mode control로 복원해야 한다');
  assert.match(heatmap,/if\(nextPinnedTile\)showPortfolioHeatmapTooltip\(nextPinnedTile,null,\{pinned:true\}\)/,'live refresh 후 동일 종목 tooltip을 최신 내용으로 다시 pin해야 한다');
  assert.doesNotMatch(heatmap,/\bsetInterval\s*\(|\bfetch\s*\(/,'Heatmap 자체는 polling/network를 소유하면 안 된다');
  assert.doesNotMatch(heatmap,/priceSource:holding\?\.priceSource/,'사용하지 않는 중복 priceSource View Model field를 남기지 않는다');
});

