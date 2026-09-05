const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ADD_DIR=path.resolve(__dirname,'../add');
const read=name=>fs.readFileSync(path.join(ADD_DIR,name),'utf8');
const css=read('add.css');
const js=read('add.js');
const calc=read('calc.html');
const report=read('kodex-leverage-report.html');

const compact=s=>s.replace(/\s+/g,' ');
const css1=compact(css);
const js1=compact(js);

const rule=selector=>{
  const i=css1.indexOf(selector);
  assert.notEqual(i,-1,`missing selector: ${selector}`);
  const open=css1.indexOf('{',i);
  const close=css1.indexOf('}',open);
  assert.ok(open>i&&close>open,`missing rule body: ${selector}`);
  return css1.slice(open+1,close);
};
const calcScope=()=>css1.slice(css1.indexOf('/* ==================== 02. Calc'),css1.indexOf('/* ==================== 03. Report'));

// 이 파일은 장기 UI/상태 contract만 보호한다.
// 장식용 exact px/hex/shadow/개수는 테스트하지 않고, 같은 의미가 하나의 source를 공유하는지와
// responsive/state/accessibility 경계가 유지되는지를 production HTML/CSS/JS에서 확인한다.

test('shared hover는 fine pointer에서만 동작하고 선택 상태를 덮지 않는다',()=>{
  assert.match(css1,/@media \(hover:hover\) and \(pointer:fine\)\{/);
  assert.match(css1,/:hover:not\(:disabled\):not\(\.active\):not\(\[aria-selected="true"\]\):not\(\[aria-pressed="true"\]\)/);
});

test('Calc/Report는 Main appearance 저장값과 BroadcastChannel을 함께 소비한다',()=>{
  assert.match(js1,/const THEME_KEY='investmentDashboard\.theme'/);
  assert.match(js1,/const CORNER_KEY='investmentDashboard\.cornerTheme'/);
  assert.match(js1,/const APPEARANCE_CHANNEL_NAME='investmentDashboard\.appearance'/);
  assert.match(js1,/syncStoredAppearance/);
  assert.match(js1,/window\.addEventListener\('storage'/);
  assert.match(js1,/new BroadcastChannel\(APPEARANCE_CHANNEL_NAME\)/);
  assert.match(js1,/appearanceChannel\.addEventListener\('message',syncStoredAppearance\)/);
  assert.match(js1,/pageshow|focus|visibilitychange/);
  assert.match(css1,/html\.rounded-corners\{/);
  const start=css1.indexOf(':root:where([data-add-page="calc"]){');
  const end=css1.indexOf('html:where([data-add-page="calc"]).dark{',start);
  const root=css1.slice(start,end);
  assert.doesNotMatch(root,/--(?:surface|control|inner)-radius-md:/);
});

test('Calc 도움말은 label과 inline-flex 정렬을 공유하고 개별 위치 보정을 만들지 않는다',()=>{
  const label=rule(':where(html[data-add-page="calc"]) :is(.label-with-help,.inline-help-label,.group-title-main)');
  assert.match(label,/display:inline-flex/);
  assert.match(label,/align-items:center/);
  const wrap=rule(':where(html[data-add-page="calc"]) .help-tooltip');
  assert.match(wrap,/display:inline-flex/);
  assert.match(wrap,/align-items:center/);
  assert.doesNotMatch(label,/top:|margin-top:|margin-bottom:/);
  assert.doesNotMatch(wrap,/top:|margin-top:|margin-bottom:/);
  assert.match(calc,/class="help-icon add-button"[^>]*aria-describedby=/);
  assert.match(js1,/class="help-icon add-button"[^>]*aria-describedby=/);
});

test('Calc control 높이와 visual state는 viewport 공통 shell source를 사용한다',()=>{
  assert.equal((css.match(/--calc-control-box-height:/g)||[]).length,1);
  assert.equal((css.match(/--calc-control-space:/g)||[]).length,1);
  const height=rule(':where(html[data-add-page="calc"]) :is(.calc-control-shell,.date-control-shell,.calc-choice-button,.actual-sale-price)');
  assert.match(height,/height:var\(--calc-control-box-height\)/);
  assert.match(height,/min-height:0/);
  const shell=rule(':where(html[data-add-page="calc"]) :is(.calc-control-shell,.date-control-shell)');
  assert.match(shell,/border:var\(--calc-control-border-width\) solid var\(--control-border\)/);
  assert.match(shell,/background:var\(--surface-control\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-control-shell,.date-control-shell):focus-within'),/border-color:var\(--control-focus-border\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-control-shell:has(> .control[readonly])'),/background:var\(--control-readonly-bg\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-control-shell,.date-control-shell):has(> .control.invalid)'),/background:var\(--danger-control-bg\)/);
  const inner=rule(':where(html[data-add-page="calc"]) .calc-control-shell > .control');
  assert.match(inner,/border:0/);
  assert.match(inner,/background:transparent/);
  assert.match(inner,/padding:var\(--calc-control-inner-pad-y\) var\(--calc-control-inner-pad-x\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-choice-button'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.share-step-btn,.pct-step-btn)'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .date-control-shell .date-control'),/padding:var\(--calc-control-inner-pad-y\) var\(--calc-control-inner-pad-x\)/);
});

test('Phone input은 iOS focus zoom 방어를 token override로만 적용하고 shell을 재구현하지 않는다',()=>{
  assert.match(css1,/--calc-control-input-size:16px/);
  assert.match(css1,/--calc-control-scale:\.[0-9]+/);
  assert.match(css1,/--calc-control-unit-pad-right:[^;]+/);
  assert.match(css1,/transform:scale\(var\(--calc-control-scale\)\)/);
  assert.match(css1,/transform-origin:top left/);
  assert.match(calc,/class="date-control-shell"><input[^>]*class="control date-control"/);
  assert.doesNotMatch(calc,/maximum-scale\s*=\s*1|user-scalable\s*=\s*no/i);
  const phoneStart=css1.indexOf('@media (max-width:760px), (orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse){',css1.indexOf('/* ==================== 02. Calc'));
  const reportStart=css1.indexOf('/* ==================== 03. Report',phoneStart);
  const phone=css1.slice(phoneStart,reportStart);
  assert.doesNotMatch(phone,/\.calc-control-shell\{[^}]*border:/);
  assert.doesNotMatch(phone,/\.calc-control-shell:focus-within/);
  assert.doesNotMatch(phone,/\.calc-control-shell:has\(> \.control\[readonly\]\)/);
  assert.doesNotMatch(phone,/\.calc-control-shell:has\(> \.control\.invalid\)/);
});

test('step 버튼은 container stretch를 사용하고 dead fixed-height contract를 갖지 않는다',()=>{
  assert.doesNotMatch(css1,/--button-control-height:/);
  assert.doesNotMatch(rule('.add-button-step'),/height:/);
  assert.match(rule(':where(html[data-add-page="calc"]) .pct-step-btn'),/align-self:stretch/);
  assert.match(css1,/:is\(\.share-step-btn,\.pct-step-btn\)\{display:block;align-self:stretch/);
});

test('거래유형 preset은 active와 aria-pressed를 같은 state owner에서 갱신한다',()=>{
  assert.match(js1,/function setPresetActive\(id\)\{[^}]*classList\.toggle\('active',active\);b\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(calc,/class="preset-btn[^"]*"[^>]*aria-pressed="(?:true|false)"/);
});

test('Calc 수동 편집은 적용 프리셋과 실제 매도단가 shortcut을 함께 해제한다',()=>{
  assert.match(js1,/function clearPresetActive\(\)\{[^]*?activePresetId=''[^]*?setPresetActive\(''\)[^]*?updateActualSellPriceUI\(\);/);
  assert.match(js1,/function markPresetDirty\(\)\{if\(!applying\)clearPresetActive\(\);\}/);
  for(const handler of ['handleMoneyInput','handleNumberInput','handleShareStep','handlePctStep','handleModeChange']){
    const start=js1.indexOf(`function ${handler}`);
    assert.ok(start>=0,`missing ${handler}`);
    assert.ok(js1.slice(start,start+500).includes('markPresetDirty()'),`${handler} must clear preset state`);
  }
  assert.match(js1,/if\(noPriorMode\|\|activePresetId!==getPresetIdForCurrentCase\(\)\)return null;/);
});

test('Calc 저장 복원은 빈 presetId를 수동 수정 상태로 유지하고, 구버전 데이터만 추정한다',()=>{
  assert.match(js1,/const hasStoredPresetId=Object\.prototype\.hasOwnProperty\.call\(v,'presetId'\);/);
  assert.match(js1,/activePresetId=hasStoredPresetId\s*\?\(presets\[v\.presetId\]\?v\.presetId:''\)\s*:\(v\.noPrior\?'current-only'/);
});

test('Calc 검증 오류는 해당 control의 aria-invalid와 설명 영역을 함께 갱신한다',()=>{
  assert.match(js1,/\.control\[aria-invalid="true"\][^]*?setAttribute\('aria-invalid','false'\)/);
  assert.match(js1,/\.control\[aria-describedby="validationMessage"\][^]*?removeAttribute\('aria-describedby'\)[^]*?validation\.invalidIds/);
  assert.match(js1,/n\.setAttribute\('aria-invalid','true'\);n\.setAttribute\('aria-describedby','validationMessage'\);/);
});

test('Calc는 실제 거래일별 빠른 매수 shortcut을 누적하지 않는다',()=>{
  for(const source of [calc,js1,css1]) assert.doesNotMatch(source,/current-purchase-preset|current-purchase-btn|applyBuy20260804|applyBuy20260806|purchase-preset|current-column/);
  const noPrior=rule(':where(html[data-add-page="calc"]) .input-grid.no-prior-layout');
  assert.match(noPrior,/grid-template-areas:"current-group calculation-group"/);
});

test('761~920px 특수 Tablet은 holding/재매수만 2+1로 바꾸고 no-prior는 건드리지 않는다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) .input-grid'),/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .input-grid.no-prior-layout'),/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  const start=css1.indexOf('@media (min-width:761px) and (max-width:920px){');
  const phone=css1.indexOf('@media (max-width:760px),',start);
  assert.ok(start>=0&&phone>start,'missing special Tablet block');
  const special=css1.slice(start,phone);
  assert.match(special,/\.input-grid:not\(\.no-prior-layout\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(special,/\.input-grid:not\(\.no-prior-layout\) \.calculation-group\{grid-column:1 \/ -1\}/);
  assert.doesNotMatch(special,/\.input-grid\.no-prior-layout\{grid-template-columns:/);
});

test('터치 스마트폰 가로는 Tablet이 아니라 Phone UI contract를 사용한다',()=>{
  const media=/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{/;
  assert.match(css1,media);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid:not\(\.no-prior-layout\), :where\(html\[data-add-page="calc"\]\) \.input-grid\.no-prior-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css1,/#reportBtn \.report-text[^}]*display:none/);
});

test('Report도 CSS·메뉴·차트가 같은 터치폰 가로 Phone 판정을 사용한다',()=>{
  const phoneMedia='@media (max-width:760px), (orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse){';
  const reportPhoneStart=css1.lastIndexOf(phoneMedia);
  assert.ok(reportPhoneStart>=0,'missing Report Phone media');
  const reportPhone=css1.slice(reportPhoneStart);
  assert.match(reportPhone,/:where\(html\[data-add-page="report"\]\) \.mobile-menu-toggle\{display:flex\}/);
  assert.match(js1,/const REPORT_PHONE_QUERY='\(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)'/);
  assert.match(js1,/const reportMobileMedia=window\.matchMedia\(REPORT_PHONE_QUERY\)/);
  assert.match(js1,/const mobile=reportMobileMedia\.matches/);
  assert.match(js1,/reportMobileMedia\.addEventListener\('change'/);
});

test('Calc iPhone 데스크탑 웹사이트 요청은 1280 viewport contract를 유지한다',()=>{
  assert.match(calc,/desktopAppleUA=\/Macintosh\//);
  assert.match(calc,/touchApple=\(navigator\.maxTouchPoints\|\|0\)>0/);
  assert.match(calc,/shortSide<=500/);
  assert.match(calc,/viewport\.setAttribute\('content','width=1280'\)/);
});

test('Calc 중간 KPI/range는 하나의 outer summary surface를 공유한다',()=>{
  assert.match(calc,/class="calc-summary-panel add-card-shell add-card-base add-card-shadow"/);
  assert.match(calc,/class="calc-summary-panel[^]*<div class="kpis">[^]*<div class="range-panel">/);
  assert.doesNotMatch(calc,/class="(?:kpis|range-panel) add-card-shell/);
  const shell=rule(':where(html[data-add-page="calc"]) :is(.input-panel,.calc-summary-panel,.strategy-card)');
  assert.match(shell,/background:var\(--calc-shell-bg\)/);
  assert.match(shell,/border-color:var\(--calc-shell-border\)/);
});

test('Calc surface/card/table spacing은 공통 surface source를 재사용한다',()=>{
  assert.match(css1,/--calc-card-gap:var\(--calc-surface-space\)/);
  assert.match(css1,/--density-table-pad-x:var\(--calc-surface-space\)/);
  assert.match(css1,/--density-table-pad-y:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.input-panel,.calc-summary-panel,.strategy-body)'),/padding:var\(--calc-surface-space\)/);
  const inner=rule(':where(html[data-add-page="calc"]) :is(.input-group,.kpi,.range-box,.summary-card,.mobile-data-card)');
  assert.match(inner,/padding:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.input-group,.kpi,.summary-card)'),/box-shadow:none/);
  assert.match(rule('.add-data-table :is(th,td)'),/padding:var\(--density-table-pad-y\) var\(--density-table-pad-x\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .input-grid'),/gap:var\(--calc-card-gap\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-summary-panel,.kpis,.range-panel,.summary-row,.mobile-data)'),/gap:var\(--calc-card-gap\)/);
});

test('입력 subsection은 outer padding을 복제하지 않고 divider 방향 spacing만 갖는다',()=>{
  const base=rule(':where(html[data-add-page="calc"]) .existing-subsection, :where(html[data-add-page="calc"]) .current-subsection, :where(html[data-add-page="calc"]) .additional-group.settled-layout .settled-subsection');
  assert.match(base,/padding:0/);
  assert.match(rule(':where(html[data-add-page="calc"]) .existing-purchase-section'),/padding-right:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .existing-evaluation-section'),/padding-left:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.additional-group.holding-layout .holding-result-section,.additional-group.settled-layout .settled-result-section)'),/padding-top:var\(--calc-surface-space\)/);
});

test('Calc 입력영역은 공통 Field Layout primitive를 사용하고 계산 기준에 magic offset을 두지 않는다',()=>{
  assert.equal((css.match(/--calc-field-label-gap:/g)||[]).length,1);
  assert.equal((css.match(/--calc-field-row-gap:/g)||[]).length,1);
  const stack=rule(':where(html[data-add-page="calc"]) :is(.fields,.calculation-flow,.actual-sale-field,.seg)');
  assert.match(stack,/display:grid/);
  assert.match(stack,/gap:var\(--calc-field-row-gap\)/);
  assert.match(calc,/class="field-label-slot" aria-hidden="true"/);
  const scope=calcScope();
  assert.doesNotMatch(scope,/margin-top:35px|calc\(1\.45em \+ var\(--density-gap-xs\)\)/);
  assert.doesNotMatch(scope,/\.calculation-group \.seg\{[^}]*padding-top:|\.calculation-group \.seg\{[^}]*margin-top:/);
});

test('주요 선택 버튼은 geometry/state만 공유하고 가로 layout은 각 container가 소유한다',()=>{
  const choice=rule(':where(html[data-add-page="calc"]) .calc-choice-button');
  assert.doesNotMatch(choice,/(?:^|;)width:|grid-template-columns:/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-control-shell,.date-control-shell,.calc-choice-button,.actual-sale-price)'),/height:var\(--calc-control-box-height\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-choice-button'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .preset-bar'),/display:flex/);
  assert.match(rule(':where(html[data-add-page="calc"]) .seg'),/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(rule(':where(html[data-add-page="calc"],html[data-add-page="report"]) .tabs'),/overflow:auto/);
  assert.doesNotMatch(calcScope(),/\.preset-btn\{[^}]*padding-inline:|\.calculation-group \.seg button\{[^}]*padding-inline:|\.tab\{[^}]*padding-inline:/);
});

test('Calc legacy alias와 Phone counter override를 누적하지 않는다',()=>{
  const calcClassTokens=[...calc.matchAll(/class="([^"]+)"/g)].flatMap(match=>match[1].trim().split(/\s+/));
  assert.equal(calcClassTokens.includes('btn'),false);
  assert.equal(calcClassTokens.includes('panel'),false);
  assert.doesNotMatch(js1,/class="panel strategy-card/);
  assert.doesNotMatch(calcScope(),/\.btn\{/);

  const phoneStart=css1.indexOf('@media (max-width:760px), (orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse){',css1.indexOf('/* ==================== 02. Calc'));
  const reportStart=css1.indexOf('/* ==================== 03. Report',phoneStart);
  const phone=css1.slice(phoneStart,reportStart);
  assert.doesNotMatch(phone,/existing-group\.holding-layout #holdingPriorFields\{gap:0\}/);
  assert.doesNotMatch(phone,/additional-group\.(?:holding|settled)-layout #currentFields\{gap:0\}/);
  assert.doesNotMatch(phone,/\.calculation-group \.field\.full\{grid-column:auto\}/);
  assert.doesNotMatch(calcScope(),/\.tabs\.settled-tabs\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}[^]*@media \(max-width:760px\)/);
  assert.match(phone,/\.tabs\.settled-tabs\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});

test('Calc와 Report의 공통 layout·상태 primitive는 page별 표현과 분리된다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"],html[data-add-page="report"]) .kpis'),/display:grid/);
  const tabs=rule(':where(html[data-add-page="calc"],html[data-add-page="report"]) .tabs');
  assert.match(tabs,/display:flex/);
  assert.match(tabs,/overflow:auto/);
  assert.match(rule(':where(html[data-add-page="calc"],html[data-add-page="report"]) .tab{'),/white-space:nowrap/);
  assert.match(rule(':where(html[data-add-page="calc"]) .strategy, :where(html[data-add-page="report"]) .panel'),/display:none/);
  assert.match(rule(':where(html[data-add-page="calc"]) .strategy.active, :where(html[data-add-page="report"]) .panel.active'),/display:block/);
  assert.doesNotMatch(tabs,/gap:|grid-template-columns:/);
});

test('Calc와 Report의 손익 의미색은 공통 semantic state를 사용한다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) .positive, :where(html[data-add-page="report"]) .pos, :where(html[data-add-page="report"]) .timeline-profit-card.pos strong'),/color:var\(--positive\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .negative, :where(html[data-add-page="report"]) .neg, :where(html[data-add-page="report"]) .timeline-profit-card.neg strong'),/color:var\(--negative\)/);
});

test('상단 utility 버튼은 선택 버튼과 별도 secondary action class를 사용한다',()=>{
  assert.match(calc,/id="reportBtn"[^>]*calc-utility-button|calc-utility-button[^>]*id="reportBtn"/);
  assert.match(calc,/id="resetBtn"[^>]*calc-utility-button|calc-utility-button[^>]*id="resetBtn"/);
  const utility=rule(':where(html[data-add-page="calc"]) .calc-utility-button');
  assert.match(utility,/background:/);
  assert.match(utility,/border-color:/);
  assert.doesNotMatch(utility,/\.active|aria-pressed/);
});

test('상태 range 카드는 neutral surface와 semantic accent를 분리한다',()=>{
  const range=rule(':where(html[data-add-page="calc"]) .range-box');
  assert.match(range,/background:var\(--range-surface-bg\)/);
  assert.match(range,/border-color:var\(--range-surface-border\)/);
  assert.match(range,/var\(--range-accent\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .range-box.blue'),/--range-accent:var\(--range-blue-accent\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .range-box.red'),/--range-accent:var\(--range-red-accent\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .range-box.green'),/--range-accent:var\(--range-green-accent\)/);
  assert.doesNotMatch(css1,/\.range-box\.(?:blue|red|green)\{[^}]*background:/);
});

test('Calc input/table/Phone card는 같은 data label/value typography source를 공유한다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) label, :where(html[data-add-page="calc"]) .field-label-slot, :where(html[data-add-page="calc"]) .kpi .name, :where(html[data-add-page="calc"]) .summary-card .sname'),/font-size:var\(--calc-type-data-label\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-data-table,.mobile-data-card) .calc-result-label'),/font-size:var\(--calc-type-data-label\)/);
  assert.match(css1,/--calc-control-input-size:var\(--calc-type-data-value\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .control'),/font-size:var\(--calc-control-input-size\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-data-table,.mobile-data-card) .calc-result-value'),/font-size:var\(--calc-type-data-value\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .actual-sale-price strong'),/font-size:var\(--calc-type-data-value\)/);
  assert.match(js1,/calc-result-label/);
  assert.match(js1,/calc-result-value/);
});

test('Calc 결과 표 값 셀은 semantic control surface를 사용한다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-data-table tbody td'),/background:var\(--surface-control\)/);
});

test('Calc 결과 표 최소폭은 렌더된 내용에서 계산하고 열폭은 동일하게 유지한다',()=>{
  const table=rule(':where(html[data-add-page="calc"]) .calc-data-table');
  assert.match(table,/table-layout:fixed/);
  assert.match(table,/var\(--calc-table-content-min/);
  assert.match(js1,/function measureCalcTableContentMinWidth\(table\)/);
  assert.match(js1,/widestCell\*columnCount/);
  assert.match(js1,/window\.addEventListener\('resize',scheduleCalcTableContentWidths/);
  assert.doesNotMatch(css1,/\.(?:five-grid|simple-grid|triple-grid|loan-grid|final-grid)\{/);
  assert.doesNotMatch(js1,/five-grid|simple-grid|triple-grid|loan-grid|final-grid/);
});

test('동적 결과 도움말은 공통 label helper와 aria-describedby 연결을 사용한다',()=>{
  assert.match(js1,/const resultLabel=/);
  assert.match(js1,/resultLabelHTML/);
  assert.match(js1,/aria-describedby="\$\{tooltipId\}"/);
});

test('Calc strategy tab은 visual state와 ARIA/tabindex/panel state를 함께 갱신한다',()=>{
  assert.match(js1,/classList\.toggle\('active',active\).*aria-selected.*tabIndex=active\?0:-1/);
  assert.match(js1,/panel\.classList\.toggle\('active',active\);panel\.setAttribute\('aria-hidden',String\(!active\)\)/);
  assert.match(calc,/role="tablist"/);
});

test('Report tab은 하나의 tablist에서 active/ARIA/tabindex state를 유지한다',()=>{
  assert.match(js1,/btn\.classList\.toggle\('active', active\).*aria-selected.*btn\.tabIndex = active \? 0 : -1/);
  assert.match(report,/role="tablist"/);
});

test('Calc typography는 위치가 아닌 역할 token을 공유하고 component별 size source를 만들지 않는다',()=>{
  for(const token of [
    '--calc-type-page-title','--calc-type-section-title','--calc-type-content-title','--calc-type-button',
    '--calc-type-data-label','--calc-type-data-value','--calc-type-support','--calc-type-emphasis-value','--calc-type-micro'
  ]) assert.match(css1,new RegExp(token.replace('--','--')));

  assert.match(rule(':where(html[data-add-page="calc"]) .hero h1'),/font-size:var\(--calc-type-page-title\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .add-heading-section'),/font-size:var\(--calc-type-section-title\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .add-heading-subsection'),/font-size:var\(--calc-type-content-title\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-result-section-title'),/font-size:var\(--calc-type-content-title\)/);
  assert.match(rule(':root:where([data-add-page="calc"])'),/--button-font-size:var\(--calc-type-button\)/);
  assert.match(rule('.add-button-action{'),/font-size:var\(--button-font-size\)/);
  assert.match(rule('.add-button-toggle{'),/font-size:var\(--button-font-size\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-choice-button'),/font-size:var\(--calc-type-button\)/);

  const emphasis=rule(':where(html[data-add-page="calc"]) :is(.kpi .value,.range-box .big,.summary-card .svalue)');
  assert.match(emphasis,/font-size:var\(--calc-type-emphasis-value\)/);
  assert.match(emphasis,/font-weight:900/);

  for(const selector of [
    ':where(html[data-add-page="calc"]) .hero p',
    ':where(html[data-add-page="calc"]) .kpi .sub',
    ':where(html[data-add-page="calc"]) .range-box .muted',
    ':where(html[data-add-page="calc"]) .strategy-title p'
  ]) assert.match(rule(selector),/font-size:var\(--calc-type-support\)/,selector);

  assert.doesNotMatch(calcScope(),/--calc-result-(?:title|label|value)-/);
  assert.doesNotMatch(js,/style\s*=\s*["'][^"']*font-size/i);
  assert.doesNotMatch(calc,/style\s*=\s*["'][^"']*font-size/i);
});

test('Calc는 iOS text autosizing을 막아 CSS typography를 보존한다',()=>{
  const body=rule(':where(html[data-add-page="calc"]) body');
  assert.match(body,/-webkit-text-size-adjust:100%/);
  assert.match(body,/text-size-adjust:100%/);
});

test('invalid 입력은 마지막 정상 결과를 stale 상태로 표시하고 정상화 시 해제한다',()=>{
  assert.match(js1,/let hasRenderedCalculation=false/);
  assert.match(js1,/setCalculationResultsStale\(hasRenderedCalculation\)/);
  assert.match(js1,/setCalculationResultsStale\(false\)/);
  assert.match(js1,/hasRenderedCalculation=true/);
  assert.match(js,/아래 결과는 마지막 정상 입력 기준입니다/);
  assert.match(css1,/\.calc-results-stale :is\(\.calc-summary-panel,#strategyTabs,main\)/);
});

test('Report Timeline 실현손익 카드는 canonical net에서 파생되고 Phone에서 세로 배치된다',()=>{
  assert.match(js1,/net:reportSum\(rows,'net'\)/);
  assert.match(js1,/function timelineProfitCard\(net\)/);
  assert.match(js1,/reportMetricText\(net,'signedWon'\)/);
  assert.match(css1,/:where\(html\[data-add-page="report"\]\) \.timeline-card\{display:grid/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{[^]*?\.timeline-card\{grid-column:2;grid-template-columns:minmax\(0,1fr\)/);
});

test('interaction state는 입력 방식과 ARIA 상태별 owner를 유지한다',()=>{
  assert.match(css1,/\.preset-btn:is\(\.active,\[aria-pressed="true"\]\)/);
  assert.match(css1,/\.report-nav \.tab:is\(\.active,\[aria-selected="true"\]\)/);
  assert.match(css1,/\.help-icon:focus-visible, :where\(html\[data-add-page="calc"\]\) \.help-tooltip\.is-open \.help-icon/);
  assert.match(css1,/@media \(hover:hover\) and \(pointer:fine\)\{[^]*?\.help-icon:hover/);
  assert.match(css1,/@media\(prefers-reduced-motion:reduce\)\{[^]*?\.custom-tooltip/);
});

test('Calc와 Report HTML은 add.css + add.js 단일 canonical runtime만 사용한다',()=>{
  for(const html of [calc,report]){
    assert.match(html,/href="add\.css"/);
    assert.match(html,/src="add\.js"/);
    assert.doesNotMatch(html,/add-theme\.(?:css|js)|(?:calc|report)-alt\.css|data-add-theme|id="addThemeToggle"/);
  }
  for(const name of ['add-theme.css','add-theme.js','calc-alt.css','report-alt.css']) assert.equal(fs.existsSync(path.join(ADD_DIR,name)),false,`${name} must be removed`);
});

test('Calc/Report canonical page scope와 기존 layout 폭 contract를 유지한다',()=>{
  const wrap=rule(':where(html[data-add-page="calc"],html[data-add-page="report"]) .wrap');
  assert.match(wrap,/max-width:1280px/);
  assert.match(wrap,/padding:var\(--density-page-pad\)/);
  assert.match(css1,/:root:where\(\[data-add-page="calc"\]\)\{/);
  assert.match(css1,/:root:where\(\[data-add-page="report"\]\)\{/);
  assert.equal((css.match(/data-add-theme/g)||[]).length,0);
});

test('Report Dynamic visual language는 canonical scope의 semantic energy token을 사용한다',()=>{
  for(const token of ['--energy-violet','--energy-cyan','--energy-cyan-text','--energy-gold']) assert.match(css1,new RegExp(token));
  assert.match(rule(':where(html[data-add-page="report"]) .hero'),/linear-gradient/);
  assert.match(rule(':where(html[data-add-page="report"]) .kpi:before'),/var\(--energy-violet\).*var\(--energy-cyan\).*var\(--energy-gold\)/);
  assert.match(rule(':where(html[data-add-page="report"]) .timeline:before'),/var\(--energy-violet\).*var\(--energy-cyan\)/);
  assert.match(rule(':where(html[data-add-page="report"]) .split-group-day .split-group-kicker'),/color:var\(--energy-cyan-text\)/);
  assert.doesNotMatch(css1,/html:where\(\[data-add-page="report"\]\)\.dark \.split-group-day \.split-group-kicker/);
  assert.doesNotMatch(css1,/html:where\(\[data-add-page="report"\]\)\.dark \.timeline:before/);
});

test('Report surface density와 보조 typography는 화면 흐름 전체에서 같은 역할 source를 사용한다',()=>{
  assert.equal((css.match(/--report-type-support:/g)||[]).length,1);
  assert.equal((css.match(/--report-type-micro:/g)||[]).length,1);
  assert.match(rule(':where(html[data-add-page="report"]) :is(.kpi,.split-group,.split-total,.timeline-card,details,.split-total-mobile-card)'),/padding:var\(--density-surface-md\)/);
  assert.match(rule(':where(html[data-add-page="report"]) :is(.section-title,.split-group-head) p'),/font-size:var\(--report-type-support\)/);
  assert.match(rule(':where(html[data-add-page="report"]) :is(.split-summary-item span,.split-total>div:first-child small,.split-total-mobile-card span)'),/font-size:var\(--report-type-micro\)/);
});

test('Report 표는 caption/header semantic을 유지한다',()=>{
  assert.match(report,/<caption class="sr-only">/);
  assert.match(report,/<th scope="col">/);
  assert.match(report,/<th scope="row">합계<\/th>/);
});


test('Report 카드 depth와 markup은 feature-owned source만 사용하고 legacy alias를 남기지 않는다',()=>{
  const classTokens=[...report.matchAll(/class="([^"]*)"/g)].flatMap(match=>match[1].split(/\s+/).filter(Boolean));
  for(const legacy of ['add-card-shadow','card','table-scroll']) assert.equal(classTokens.includes(legacy),false,`Report legacy class must be removed: ${legacy}`);
  assert.ok(classTokens.includes('add-card-shell'));
  assert.ok(classTokens.includes('add-table-scroll'));
});

test('Report Hero/KPI responsive 의미배치는 semantic role class를 사용하고 DOM 순번에 의존하지 않는다',()=>{
  for(const role of ['hero-chip-core','hero-chip-day','hero-chip-total','report-kpi-total-net','report-kpi-total-pnl','report-kpi-total-fee','report-kpi-core-net','report-kpi-day-net','report-kpi-win-rate']){
    assert.match(report,new RegExp(`\\b${role}\\b`));
  }
  assert.match(css1,/\.hero-chip-total\{grid-column:1 \/ -1\}/);
  assert.match(css1,/#summary \.report-kpi-core-net\{order:3\}/);
  assert.match(css1,/#summary \.report-kpi-total-net \.sub\{white-space:nowrap/);
  assert.doesNotMatch(css1,/\.hero-summary > \.hero-chip:nth-child\([123]\)/);
  assert.doesNotMatch(css1,/#summary \.kpi:nth-child\(/);
});

test('Report Phone split total은 숨긴 desktop stats에 dead layout declaration을 남기지 않는다',()=>{
  const phoneStart=css1.indexOf('@media (max-width:760px), (orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse){',css1.indexOf('/* ==================== 03. Report'));
  assert.notEqual(phoneStart,-1);
  const phone=css1.slice(phoneStart);
  assert.match(phone,/\.split-total-stats\{display:none\}/);
  assert.doesNotMatch(phone,/\.split-total-stats\{display:none;[^}]*?(?:justify-content|gap):/);
});

test('Report iPhone 데스크탑 웹사이트 요청은 page boot 전에 1280 viewport contract를 유지한다',()=>{
  const start=js1.indexOf("if(page==='report'){");
  const end=js1.indexOf('})();',start);
  assert.ok(start>=0&&end>start);
  const preflight=js1.slice(start,end);
  assert.match(preflight,/desktopAppleUA=\/Macintosh\/\.test\(ua\)/);
  assert.match(preflight,/touchApple=\(navigator\.maxTouchPoints\|\|0\)>0/);
  assert.match(preflight,/shortSide<=500/);
  assert.match(preflight,/viewport\.setAttribute\('content','width=1280'\)/);
});

test('Add CSS custom property는 CSS 또는 JS runtime contract에서 실제 참조된다',()=>{
  const definitions=[...css.matchAll(/--([\w-]+)\s*:/g)].map(match=>match[1]);
  const references=new Set([
    ...[...css.matchAll(/var\(\s*--([\w-]+)/g)].map(match=>match[1]),
    ...[...js.matchAll(/(?:getPropertyValue|chartColor)\(\s*['"]--([\w-]+)/g)].map(match=>match[1])
  ]);
  const unused=[...new Set(definitions)].filter(name=>!references.has(name)).sort();
  assert.deepEqual(unused,[]);
});

test('Add CSS class selector는 production HTML 또는 동적 JS markup에 근거가 있다',()=>{
  const selectorSource=css.replace(/\/\*[^]*?\*\//g,'');
  const productionSource=`${calc}\n${report}\n${js}`;
  const classes=[...new Set([...selectorSource.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(match=>match[1]))];
  const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const unused=classes.filter(name=>!new RegExp(`(^|[^\\w-])${escapeRegExp(name)}([^\\w-]|$)`).test(productionSource)).sort();
  assert.deepEqual(unused,[]);
});

test('Report chart 손익색은 Add 공통 semantic value source를 alias하고 Calc mobile icon은 Phone Shared만 소유한다',()=>{
  assert.match(css1,/--chart-positive:var\(--positive\)/);
  assert.match(css1,/--chart-negative:var\(--negative\)/);
  assert.doesNotMatch(css1,/--chart-positive:#(?:EF3341|FF5964)/i);
  assert.doesNotMatch(css1,/--chart-negative:#(?:3182F6|60A5FA)/i);
  assert.equal((css.match(/:where\(html\[data-add-page="calc"\]\) \.add-button-mobile-icon\{/g)||[]).length,1);
  assert.doesNotMatch(css1,/@media\(max-width:760px\)\{ \.add-button-mobile-icon\{/);
});

test('Report boot는 계산·Timeline·DOM render·navigation·chart controller를 조립만 한다',()=>{
  assert.match(js,/function deriveReportModel\(rows=REPORT_DATA\)/);
  assert.match(js,/function createReportTimelineBuilder\(model\)/);
  assert.match(js,/function createReportRenderer\(model,buildTimelineEvents\)/);
  assert.match(js,/function createReportNavigationController\(reportMobileMedia,drawChart\)/);
  assert.match(js,/function createReportChartController\(chartData,reportMobileMedia\)/);
  const boot=js.match(/const bootReportPage=\(\)=>\{([^}]*)\};/)?.[1]||'';
  assert.match(boot,/deriveReportModel\(REPORT_DATA\)/);
  assert.match(boot,/createReportTimelineBuilder\(model\)/);
  assert.match(boot,/createReportRenderer\(model,buildTimelineEvents\)/);
  assert.match(boot,/createReportNavigationController\(reportMobileMedia,chart\.drawChart\)/);
  assert.match(boot,/createReportChartController\(model\.chartData,reportMobileMedia\)/);
  assert.doesNotMatch(boot,/querySelector|addEventListener|canvas|getContext/,'boot가 다시 feature 세부 구현을 직접 소유하면 안 된다');
});
