const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ADD_DIR=path.resolve(__dirname,'../../add');
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
  const label=rule(':where(html[data-add-page="calc"]) .label-with-help, :where(html[data-add-page="calc"]) .inline-help-label');
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

test('Calc control 높이와 내부 spacing은 공통 source를 사용한다',()=>{
  assert.equal((css.match(/--calc-control-box-height:/g)||[]).length,1);
  assert.equal((css.match(/--calc-control-space:/g)||[]).length,1);
  const control=rule(':where(html[data-add-page="calc"]) .control');
  assert.match(control,/height:var\(--calc-control-box-height\)/);
  assert.match(control,/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-choice-button'),/height:var\(--calc-control-box-height\).*padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.share-step-btn,.pct-step-btn)'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .date-control-shell .date-control'),/padding:var\(--calc-control-space\)/);
});

test('Phone input은 iOS focus zoom 방어와 optical scale 구조를 유지한다',()=>{
  assert.match(css1,/--calc-control-input-size:16px/);
  assert.match(css1,/--calc-control-scale:\.[0-9]+/);
  assert.match(css1,/transform:scale\(var\(--calc-control-scale\)\)/);
  assert.match(css1,/transform-origin:top left/);
  assert.match(calc,/class="date-control-shell"><input[^>]*class="control date-control"/);
  assert.doesNotMatch(calc,/maximum-scale\s*=\s*1|user-scalable\s*=\s*no/i);
});

test('모바일 step 버튼은 input 높이에 맞춰 stretch되고 고정 높이를 강제하지 않는다',()=>{
  assert.match(css1,/:is\(\.share-step-btn,\.pct-step-btn\)\{display:block;height:auto;align-self:stretch/);
});

test('거래유형 preset은 active와 aria-pressed를 같은 state owner에서 갱신한다',()=>{
  assert.match(js1,/function setPresetActive\(id\)\{[^}]*classList\.toggle\('active',active\);b\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(calc,/class="preset-btn[^"]*"[^>]*aria-pressed="(?:true|false)"/);
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

test('Calc iPhone 데스크탑 웹사이트 요청은 1280 viewport contract를 유지한다',()=>{
  assert.match(calc,/desktopAppleUA=\/Macintosh\//);
  assert.match(calc,/touchApple=\(navigator\.maxTouchPoints\|\|0\)>0/);
  assert.match(calc,/shortSide<=500/);
  assert.match(calc,/viewport\.setAttribute\('content','width=1280'\)/);
});

test('Calc 중간 KPI/range는 하나의 outer summary surface를 공유한다',()=>{
  assert.match(calc,/class="panel calc-summary-panel add-card-shell add-card-base add-card-shadow"/);
  assert.match(calc,/class="panel calc-summary-panel[^]*<div class="kpis">[^]*<div class="range-panel">/);
  assert.doesNotMatch(calc,/class="panel (?:kpis|range-panel) add-card-shell/);
  const shell=rule(':where(html[data-add-page="calc"]) :is(.input-panel,.calc-summary-panel,.strategy-card)');
  assert.match(shell,/background:var\(--calc-shell-bg\)/);
  assert.match(shell,/border-color:var\(--calc-shell-border\)/);
});

test('Calc surface/card/table spacing은 공통 surface source를 재사용한다',()=>{
  assert.match(css1,/--calc-card-gap:var\(--calc-surface-space\)/);
  assert.match(css1,/--density-table-pad-x:var\(--calc-surface-space\)/);
  assert.match(css1,/--density-table-pad-y:var\(--calc-surface-space\)/);
  for(const re of [
    /:where\(html\[data-add-page="calc"\]\) :is\(\.input-panel,\.calc-summary-panel,\.strategy-body\)\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.input-group\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.kpi\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.range-box\{[^}]*padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.summary-card\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.mobile-data-card\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.calc-data-table :is\(th,td\)\{padding:var\(--calc-surface-space\)/
  ]) assert.match(css1,re);
  for(const selector of [
    ':where(html[data-add-page="calc"]) .input-grid',
    ':where(html[data-add-page="calc"]) .calc-summary-panel',
    ':where(html[data-add-page="calc"]) .kpis',
    ':where(html[data-add-page="calc"]) .range-panel',
    ':where(html[data-add-page="calc"]) .summary-row'
  ]) assert.match(rule(selector),/gap:var\(--calc-card-gap\)/,selector);
});

test('입력 subsection은 outer padding을 복제하지 않고 divider 방향 spacing만 갖는다',()=>{
  const base=rule(':where(html[data-add-page="calc"]) .existing-subsection, :where(html[data-add-page="calc"]) .current-subsection, :where(html[data-add-page="calc"]) .additional-group.settled-layout .settled-subsection');
  assert.match(base,/padding:0/);
  assert.match(rule(':where(html[data-add-page="calc"]) .existing-purchase-section'),/padding-right:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .existing-evaluation-section'),/padding-left:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .current-subsection:nth-of-type(n+3)'),/padding-top:var\(--calc-surface-space\)/);
});

test('Calc 입력영역은 공통 Field Layout primitive를 사용하고 계산 기준에 magic offset을 두지 않는다',()=>{
  assert.equal((css.match(/--calc-field-label-gap:/g)||[]).length,1);
  assert.equal((css.match(/--calc-field-row-gap:/g)||[]).length,1);
  assert.match(rule(':where(html[data-add-page="calc"]) .fields'),/gap:var\(--calc-field-row-gap\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calculation-flow'),/gap:var\(--calc-field-row-gap\)/);
  assert.match(calc,/class="field-label-slot" aria-hidden="true"/);
  const scope=calcScope();
  assert.doesNotMatch(scope,/margin-top:35px|calc\(1\.45em \+ var\(--density-gap-xs\)\)/);
  assert.doesNotMatch(scope,/\.calculation-group \.seg\{[^}]*padding-top:|\.calculation-group \.seg\{[^}]*margin-top:/);
});

test('주요 선택 버튼은 geometry/state만 공유하고 가로 layout은 각 container가 소유한다',()=>{
  const choice=rule(':where(html[data-add-page="calc"]) .calc-choice-button');
  assert.match(choice,/height:var\(--calc-control-box-height\)/);
  assert.match(choice,/padding:var\(--calc-control-space\)/);
  assert.doesNotMatch(choice,/(?:^|;)width:|grid-template-columns:/);
  assert.match(rule(':where(html[data-add-page="calc"]) .preset-bar'),/display:flex/);
  assert.match(rule(':where(html[data-add-page="calc"]) .seg'),/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .tabs'),/overflow:auto/);
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

test('Calc 결과 표와 Phone 카드는 title/label/value semantic typography role을 공유한다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-result-section-title'),/var\(--calc-result-title-/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-data-table,.mobile-data-card) .calc-result-label'),/var\(--calc-result-label-/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-data-table,.mobile-data-card) .calc-result-value'),/var\(--calc-result-value-/);
  assert.match(js1,/calc-result-section-title/);
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

test('Calc typography는 역할 token을 사용하고 inline font-size를 만들지 않는다',()=>{
  for(const token of ['--calc-type-page-title','--calc-type-section','--calc-type-subsection','--calc-type-support','--calc-type-label']) assert.match(css1,new RegExp(token.replace('--','--')));
  assert.match(rule(':where(html[data-add-page="calc"]) .hero h1'),/font-size:var\(--calc-type-page-title\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .add-heading-section'),/font-size:var\(--calc-type-section\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .add-heading-subsection'),/font-size:var\(--calc-type-subsection\)/);
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
  assert.match(css1,/@media\(max-width:760px\)\{[^]*?\.timeline-card\{grid-column:2;grid-template-columns:minmax\(0,1fr\)/);
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
  assert.match(rule(':where(html[data-add-page="calc"]) .wrap'),/max-width:1280px/);
  assert.match(rule(':where(html[data-add-page="report"]) .wrap'),/max-width:1280px/);
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
});

test('Report 표는 caption/header semantic을 유지한다',()=>{
  assert.match(report,/<caption class="sr-only">/);
  assert.match(report,/<th scope="col">/);
  assert.match(report,/<th scope="row">합계<\/th>/);
});
