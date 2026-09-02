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

const rule=(selector)=>{
  const i=css1.indexOf(selector);
  assert.notEqual(i,-1,`missing selector: ${selector}`);
  const open=css1.indexOf('{',i);
  const close=css1.indexOf('}',open);
  assert.ok(open>i && close>open,`missing rule body: ${selector}`);
  return css1.slice(open+1,close);
};

test('shared hover는 fine pointer에서만 동작하고 선택 상태를 덮지 않는다',()=>{
  assert.match(css1,/@media \(hover:hover\) and \(pointer:fine\)\{/);
  assert.match(css1,/:hover:not\(:disabled\):not\(\.active\):not\(\[aria-selected="true"\]\):not\(\[aria-pressed="true"\]\)/);
});

test('Add Calc/Report는 Main의 Light/Dark·cornerTheme를 storage + BroadcastChannel로 실시간 동기화한다',()=>{
  assert.match(js1,/const THEME_KEY='investmentDashboard\.theme'/);
  assert.match(js1,/const CORNER_KEY='investmentDashboard\.cornerTheme'/);
  assert.match(js1,/const APPEARANCE_CHANNEL_NAME='investmentDashboard\.appearance'/);
  assert.match(js1,/root\.classList\.toggle\('rounded-corners',localStorage\.getItem\(CORNER_KEY\)==='rounded'\)/);
  assert.match(js1,/window\.addEventListener\('storage',event=>\{/);
  assert.match(js1,/appearanceChannel=new BroadcastChannel\(APPEARANCE_CHANNEL_NAME\)/);
  assert.match(js1,/appearanceChannel\.addEventListener\('message',syncStoredAppearance\)/);
  assert.match(js1,/window\.addEventListener\('pageshow',syncStoredAppearance\)/);
  assert.match(js1,/window\.addEventListener\('focus',syncStoredAppearance\)/);
  assert.match(js1,/visibilitychange/);
  assert.match(report,/<script src="add\.js"><\/script>/);
  assert.match(css1,/html\.rounded-corners\{ --corner-surface-cap:999px; --corner-control-cap:999px; --corner-inner-cap:999px/);
  const calcRootStart=css1.indexOf(':root:where([data-add-page="calc"]){');
  const calcRootEnd=css1.indexOf('html:where([data-add-page="calc"]).dark{',calcRootStart);
  const calcRoot=css1.slice(calcRootStart,calcRootEnd);
  assert.doesNotMatch(calcRoot,/--surface-radius-md:/);
  assert.doesNotMatch(calcRoot,/--control-radius-md:/);
  assert.doesNotMatch(calcRoot,/--inner-radius-md:/);
});

test('Calc 도움말 i는 label과 공통 inline-flex 정렬을 쓰고 Main 방식으로 glyph만 광학 보정한다',()=>{
  const labelRule=rule(':where(html[data-add-page="calc"]) .label-with-help, :where(html[data-add-page="calc"]) .inline-help-label');
  assert.match(labelRule,/display:inline-flex/);
  assert.match(labelRule,/align-items:center/);
  assert.match(labelRule,/vertical-align:middle/);
  const wrapRule=rule(':where(html[data-add-page="calc"]) .help-tooltip');
  assert.match(wrapRule,/display:inline-flex/);
  assert.match(wrapRule,/align-items:center/);
  assert.match(wrapRule,/justify-content:center/);
  assert.match(rule(':where(html[data-add-page="calc"]) .help-icon'),/line-height:1\.12/);
  assert.match(rule(':where(html[data-add-page="calc"]) .help-icon > span[aria-hidden="true"]'),/transform:translateY\(-\.2px\)/);
  assert.match(calc,/class="help-icon add-button"[^>]*><span aria-hidden="true">i<\/span><\/button>/);
  assert.match(js1,/class="help-icon add-button"[^>]*><span aria-hidden="true">i<\/span><\/button>/);
});

test('Calc control geometry는 단일 box-height token을 Source of Truth로 사용한다',()=>{
  assert.match(css1,/--calc-control-border-width:1px/);
  assert.match(css1,/--calc-control-box-height:calc\(1rem \+ var\(--calc-control-pad-y\) \+ var\(--calc-control-pad-y\) \+ var\(--calc-control-border-width\) \+ var\(--calc-control-border-width\)\)/);
  assert.match(css1,/--calc-control-inner-height:calc\(var\(--calc-control-box-height\) - var\(--calc-control-border-width\) - var\(--calc-control-border-width\)\)/);
  assert.equal((css.match(/--calc-control-box-height:/g)||[]).length,1);
  const body=rule(':where(html[data-add-page="calc"]) .control');
  assert.match(body,/height:var\(--calc-control-box-height\)/);
  assert.match(body,/border:var\(--calc-control-border-width\) solid var\(--control-border\)/);
  assert.match(body,/padding:var\(--calc-control-space\)/);
  assert.match(body,/min-height:0/);
  assert.match(body,/line-height:1/);
  assert.match(body,/-webkit-appearance:none/);
  assert.match(body,/appearance:none/);
  assert.doesNotMatch(body,/height:(?:30|34|40)px/);
});

test('Calc text/choice/step 버튼과 input 내부 여백은 Web/Tablet/Phone 모두 visual 6px contract를 공유한다',()=>{
  assert.match(css1,/--calc-control-space:6px/);
  assert.equal((css.match(/--calc-control-space:/g)||[]).length,1);
  assert.match(css1,/--density-action-pad-x:var\(--calc-control-space\); --density-action-pad-y:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .control'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-choice-button'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.share-step-btn,.pct-step-btn)'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .actual-sale-price'),/padding:var\(--calc-control-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .date-control-shell .date-control'),/padding:var\(--calc-control-space\)/);
  assert.match(css1,/--calc-control-inner-pad-y:8px; --calc-control-inner-pad-x:8px/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.with-unit \.calc-control-shell > \.control\{padding-right:45\.333333px\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.add-button-mobile-icon\{[^}]*padding:0/);
  assert.match(rule(':where(html[data-add-page="calc"]) .help-icon'),/padding:0/);
});

test('Calc input 값은 Web/Tablet 12px, Phone은 iOS 16px computed + .75 optical scale로 12px을 유지한다',()=>{
  assert.match(css1,/--calc-control-value-size:12px; --calc-control-input-size:var\(--calc-control-value-size\); --calc-control-scale:1; --calc-control-inner-size:100%/);
  assert.match(rule(':where(html[data-add-page="calc"]) .control'),/font-size:var\(--calc-control-input-size\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .unit'),/font-size:var\(--calc-control-value-size\)/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:var\(--calc-control-space\);[^}]*--calc-control-input-size:16px; --calc-control-scale:\.75; --calc-control-inner-size:133\.333333%;[^}]*--calc-control-inner-pad-y:8px; --calc-control-inner-pad-x:8px;/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.calc-control-shell > \.control\{display:block;width:100%;max-width:none\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.calc-control-shell > \.control\{[^}]*transform:scale\(var\(--calc-control-scale\)\);transform-origin:top left/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.date-control-shell \.date-control\{[^}]*font-size:var\(--calc-control-input-size\);[^}]*transform:scale\(var\(--calc-control-scale\)\)/);
  const wrappedControls=(calc.match(/class="calc-control-shell"><input[^>]*class="[^"]*\bcontrol\b[^"]*"[^>]*>/g)||[]).length;
  const allControls=(calc.match(/<input[^>]*class="[^"]*\bcontrol\b[^"]*"[^>]*>/g)||[]).length;
  assert.equal(allControls,28);
  assert.equal(wrappedControls,27);
  assert.match(calc,/class="date-control-shell"><input[^>]*class="control date-control"/);
});

test('모바일 share/pct step 버튼은 input 높이에 stretch되어 별도 40px 높이를 강제하지 않는다',()=>{
  assert.match(css1,/:is\(\.share-step-btn,\.pct-step-btn\)\{display:block;height:auto;align-self:stretch/);
});

test('Calc 거래유형 preset 선택은 active와 aria-pressed를 한 번에 동기화한다',()=>{
  assert.match(js1,/function setPresetActive\(id\)\{[^}]*classList\.toggle\('active',active\);b\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(calc,/class="preset-btn[^\"]*"[^>]*aria-pressed="(?:true|false)"/);
});

test('Calc는 실제 거래일별 빠른 매수 shortcut을 두지 않고 이전 거래 없음도 직접 입력 구조를 사용한다',()=>{
  assert.doesNotMatch(calc,/current-purchase-preset|current-purchase-btn|applyBuy20260804|applyBuy20260806|data-current-purchase-preset/);
  assert.doesNotMatch(js1,/currentPurchasePresets|currentPurchasePresetId|setCurrentPurchasePresetActive|current-purchase-btn/);
  assert.doesNotMatch(css1,/current-purchase-preset|current-purchase-btn|purchase-preset|current-column/);
  const noPrior=rule(':where(html[data-add-page="calc"]) .input-grid.no-prior-layout');
  assert.match(noPrior,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(noPrior,/grid-template-areas:"current-group calculation-group"/);
});

test('Calc 상단 입력카드는 761~920px 기능성 특수 Tablet에서 holding/settled만 2+1로 전환한다',()=>{
  const base=rule(':where(html[data-add-page="calc"]) .input-grid');
  const noPrior=rule(':where(html[data-add-page="calc"]) .input-grid.no-prior-layout');
  assert.match(base,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(noPrior,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css1,/@media \(min-width:761px\) and \(max-width:920px\)\{/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid:not\(\.no-prior-layout\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid:not\(\.no-prior-layout\) \.calculation-group\{grid-column:1 \/ -1\}/);
  const specialStart=css1.indexOf('@media (min-width:761px) and (max-width:920px){');
  const phoneStart=css1.indexOf('@media (max-width:760px),',specialStart);
  const specialBlock=css1.slice(specialStart,phoneStart);
  assert.doesNotMatch(specialBlock,/\.input-grid\.no-prior-layout\{grid-template-columns:/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid:not\(\.no-prior-layout\), :where\(html\[data-add-page="calc"\]\) \.input-grid\.no-prior-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('Calc 중간 KPI/range 두 행은 하나의 outer summary surface를 공유한다',()=>{
  assert.match(calc,/class="panel calc-summary-panel add-card-shell add-card-base add-card-shadow"/);
  assert.match(calc,/class="panel calc-summary-panel[^]*<div class="kpis">[^]*<div class="range-panel">/);
  assert.doesNotMatch(calc,/class="panel kpis add-card-shell/);
  assert.doesNotMatch(calc,/class="panel range-panel add-card-shell/);
  const summary=rule(':where(html[data-add-page="calc"]) .calc-summary-panel');
  assert.match(summary,/display:grid/);
  assert.match(summary,/gap:var\(--calc-card-gap\)/);
  assert.doesNotMatch(summary,/padding:/);
  const largeSurfacePadding=rule(':where(html[data-add-page="calc"]) :is(.input-panel,.calc-summary-panel,.strategy-body)');
  assert.match(largeSurfacePadding,/padding:var\(--calc-surface-space\)/);
  assert.match(summary,/margin-bottom:var\(--calc-card-gap\)/);
  assert.doesNotMatch(rule(':where(html[data-add-page="calc"]) .kpis'),/margin-bottom:|padding:|background:/);
  assert.doesNotMatch(rule(':where(html[data-add-page="calc"]) .range-panel'),/margin-bottom:|padding:/);
});

test('Calc 카드·표 여백과 카드 간 gap은 Web/Tablet/Phone 모두 6px spacing contract를 공유한다',()=>{
  assert.match(css1,/--calc-surface-space:6px; --calc-card-gap:var\(--calc-surface-space\); --density-table-pad-x:var\(--calc-surface-space\); --density-table-pad-y:var\(--calc-surface-space\)/);
  assert.match(css1,/@media\(max-width:1100px\)\{[^}]*:root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-surface-space:6px/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{[^}]*:root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-surface-space:6px/);

  for(const re of [
    /:where\(html\[data-add-page="calc"\]\) :is\(\.input-panel,\.calc-summary-panel,\.strategy-body\)\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.input-group\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.kpi\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.range-box\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.strategy-head\{[^}]*padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.summary-card\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.mobile-data-card\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.calc-data-table :is\(th,td\)\{padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.validation-panel\{[^}]*padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.warning-note\{[^}]*padding:var\(--calc-surface-space\)/,
    /:where\(html\[data-add-page="calc"\]\) \.note\{[^}]*padding:var\(--calc-surface-space\)/,
  ]) assert.match(css1,re);

  for(const selector of [
    ':where(html[data-add-page="calc"]) .input-grid',
    ':where(html[data-add-page="calc"]) .calc-summary-panel',
    ':where(html[data-add-page="calc"]) .kpis',
    ':where(html[data-add-page="calc"]) .range-panel',
    ':where(html[data-add-page="calc"]) .summary-row',
  ]) assert.match(rule(selector),/gap:var\(--calc-card-gap\)/,selector);

  assert.match(rule(':where(html[data-add-page="calc"]) .input-panel'),/margin-bottom:var\(--calc-card-gap\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-summary-panel'),/margin-bottom:var\(--calc-card-gap\)/);
  const calcScope=css1.slice(css1.indexOf('/* ==================== 02. Calc'),css1.indexOf('/* ==================== 03. Report'));
  assert.doesNotMatch(calcScope,/:where\(html\[data-add-page="calc"\]\) \.kpi\{[^}]*padding:[^;}]*var\(--density-(?:surface|action|gap)/);
  assert.doesNotMatch(calcScope,/:where\(html\[data-add-page="calc"\]\) \.range-box\{[^}]*padding:[^;}]*var\(--density-(?:surface|action|gap)/);
  assert.doesNotMatch(calcScope,/:where\(html\[data-add-page="calc"\]\) \.summary-card\{[^}]*padding:[^;}]*var\(--density-(?:surface|action|gap)/);
});

test('Calc 결과 표와 Phone 카드는 title/label/value typography를 같은 role token에서 파생한다',()=>{
  assert.match(css1,/--calc-result-title-size:13px; --calc-result-title-weight:800; --calc-result-title-line-height:1\.3;/);
  assert.match(css1,/--calc-result-label-size:11px; --calc-result-label-weight:800; --calc-result-label-line-height:1\.35;/);
  assert.match(css1,/--calc-result-value-size:12px; --calc-result-value-weight:800; --calc-result-value-line-height:1\.35;/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-result-section-title'),/font-size:var\(--calc-result-title-size\).*font-weight:var\(--calc-result-title-weight\).*line-height:var\(--calc-result-title-line-height\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-data-table,.mobile-data-card) .calc-result-label'),/font-size:var\(--calc-result-label-size\).*font-weight:var\(--calc-result-label-weight\).*line-height:var\(--calc-result-label-line-height\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.calc-data-table,.mobile-data-card) .calc-result-value'),/font-size:var\(--calc-result-value-size\).*font-weight:var\(--calc-result-value-weight\).*line-height:var\(--calc-result-value-line-height\)/);
  assert.match(js1,/class="section-title calc-result-section-title">매도 결과<\/div>/);
  assert.match(js1,/class="add-table-cell-center calc-result-label"/);
  assert.match(js1,/class="add-table-cell-center calc-result-value /);
  assert.match(js1,/class="mobile-section-title calc-result-section-title"/);
  assert.match(js1,/class="mobile-data-label calc-result-label"/);
  assert.match(js1,/class="mobile-data-value calc-result-value /);
  assert.doesNotMatch(rule(':where(html[data-add-page="calc"]) .mobile-data-value'),/font-size:/);
});

test('Calc 결과 표 값 셀은 semantic control surface를 사용한다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-data-table tbody td'),/background:var\(--surface-control\)/);
});

test('Calc 결과 표 최소폭은 실제 label/value 자연 폭을 기준으로 계산하고 모든 열은 동일 폭을 유지한다',()=>{
  const tableRule=rule(':where(html[data-add-page="calc"]) .calc-data-table');
  assert.match(tableRule,/table-layout:fixed/);
  assert.match(tableRule,/min-width:max\(100%,var\(--calc-table-content-min,0px\)\)/);
  assert.doesNotMatch(css1,/\.(?:five-grid|simple-grid|triple-grid|loan-grid|final-grid)\{/);
  assert.doesNotMatch(js1,/five-grid|simple-grid|triple-grid|loan-grid|final-grid/);
  assert.match(js1,/function measureCalcTableContentMinWidth\(table\)/);
  assert.match(js1,/probe\.querySelectorAll\('\.custom-tooltip'\)\.forEach\(node=>node\.remove\(\)\)/);
  assert.match(js1,/widestCell\*columnCount/);
  assert.match(js1,/function scheduleCalcTableContentWidths\(\)/);
  assert.match(js1,/window\.addEventListener\('resize',scheduleCalcTableContentWidths,\{passive:true\}\)/);
});

test('보유 중 추가매수 결과의 잔여현금/손익 개선 라벨은 표·모바일 카드·요약카드에서 같은 설명형 tooltip contract를 사용한다',()=>{
  assert.doesNotMatch(js1,/추가투입금·회수대상 차감 후 잔여현금/);
  assert.doesNotMatch(js1,/추가매수 전 대비 손익 개선액/);
  assert.match(js1,/기존 회수 대상 차감 후 잔여현금/);
  assert.match(js1,/추가매수로 인한 손익 개선액/);
  assert.match(js1,/매도금액에서 추가매수 원금과 기존 회수 대상 금액을 차감한 뒤 남는 현금/);
  assert.match(js1,/동일 목표 매도단가 기준, 추가매수로 개선된 손익 · 계산: 추가매수 수량 × \(목표 매도단가 - 추가매수단가\)/);
  assert.match(js1,/const resultLabel=\(text,tip='',key=''\)=>Object\.freeze/);
  assert.match(js1,/function metric\(name,value,cls='',tip='',idPrefix='summary'\)/);
  assert.match(js1,/desktopTable\(flowH,flowV,`holding-\$\{typeNo\}-flow-desktop`\)/);
  assert.match(js1,/mobileRows\('원금 회수 결과',flowH,flowV,`holding-\$\{typeNo\}-flow-mobile`\)/);
  assert.match(js1,/class="help-icon add-button" aria-label="\$\{esc\(spec\.text\)\} 설명" aria-describedby="\$\{tooltipId\}" aria-expanded="false"><span aria-hidden="true">i<\/span><\/button>/);
  assert.doesNotMatch(js1,/남는 현금입니다|손익입니다|개선됩니다/);
});

test('이전 거래 상세 자동계산 안내 문구는 Calc DOM에서 제거한다',()=>{
  assert.doesNotMatch(calc,/매수단가·매도단가·확정손익은 실제 매수금액·매도금액 기준 자동 계산/);
  assert.doesNotMatch(calc,/class="case-note"/);
  assert.doesNotMatch(css1,/\.case-note\{/);
});

test('Calc strategy tab은 active/aria-selected/tabindex/panel aria-hidden을 동기화한다',()=>{
  assert.match(js1,/tabs\.forEach\(b=>\{const active=b\.dataset\.tab===strategyId;b\.classList\.toggle\('active',active\);b\.setAttribute\('aria-selected',String\(active\)\);b\.tabIndex=active\?0:-1;\}\)/);
  assert.match(js1,/panel\.classList\.toggle\('active',active\);panel\.setAttribute\('aria-hidden',String\(!active\)\)/);
  assert.match(calc,/role="tablist"/);
});


test('Calc 상단 utility 버튼은 선택 버튼과 분리된 secondary action contract를 사용한다',()=>{
  assert.match(calc,/id="reportBtn"[^>]*class="[^"]*calc-utility-button[^"]*"|class="[^"]*calc-utility-button[^"]*"[^>]*id="reportBtn"/);
  assert.match(calc,/id="resetBtn"[^>]*class="[^"]*calc-utility-button[^"]*"|class="[^"]*calc-utility-button[^"]*"[^>]*id="resetBtn"/);
  const utility=rule(':where(html[data-add-page="calc"]) .calc-utility-button');
  assert.match(utility,/font-weight:600/);
  assert.match(utility,/background:linear-gradient\(180deg,var\(--surface-control\),var\(--surface-subtle\)\)/);
  assert.match(utility,/border-color:var\(--control-border\)/);
  assert.match(utility,/color:var\(--navy\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calc-utility-button :is(.reset-icon,.report-icon)'),/display:block.*width:14px.*height:14px/);
  assert.doesNotMatch(utility,/font-weight:(?:700|800|900)/);
});

test('Calc 중간 상태카드 3개는 neutral surface와 semantic accent만 사용한다',()=>{
  assert.match(css1,/--range-surface-bg:var\(--surface-control\); --range-surface-border:var\(--line\); --range-blue-accent:/);
  const range=rule(':where(html[data-add-page="calc"]) .range-box');
  assert.match(range,/background:var\(--range-surface-bg\)/);
  assert.match(range,/border-color:var\(--range-surface-border\)/);
  assert.match(range,/box-shadow:inset 3px 0 0 var\(--range-accent\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .range-box.blue'),/--range-accent:var\(--range-blue-accent\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .range-box.red'),/--range-accent:var\(--range-red-accent\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .range-box.green'),/--range-accent:var\(--range-green-accent\)/);
  assert.doesNotMatch(css1,/--range-(?:blue-bg|blue-border|red-border|green-bg|green-border):/);
  assert.doesNotMatch(css1,/\.range-box\.(?:blue|red|green)\{[^}]*background:/);
});

test('Report tab도 active/aria-selected/tabindex contract를 유지한다',()=>{
  assert.match(js1,/btn\.classList\.toggle\('active', active\); btn\.setAttribute\('aria-selected', String\(active\)\); btn\.tabIndex = active \? 0 : -1/);
  assert.match(report,/role="tablist"/);
});

test('Calc Compact typography는 역할 token을 유지하고 viewport별 canonical scale을 사용한다',()=>{
  assert.match(css1,/--calc-type-page-title:22px; --calc-type-section:16px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:11px;/);
  assert.match(css1,/@media\(max-width:1100px\)\{ :root:where\(\[data-add-page="calc"\]\)\{ --density-page-pad:9px;[^}]*--calc-type-page-title:21px; --calc-type-section:15px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:11px;/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:var\(--calc-control-space\);[^}]*--calc-type-page-title:22px; --calc-type-section:15px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:10px;/);

  for(const selector of [
    ':where(html[data-add-page="calc"]) .add-heading-section',
    ':where(html[data-add-page="calc"]) .add-heading-subsection',
    ':where(html[data-add-page="calc"]) .mobile-section-title',
    ':where(html[data-add-page="calc"]) .range-box strong',
    ':where(html[data-add-page="calc"]) .strategy-title p',
    ':where(html[data-add-page="calc"]) .summary-card .sname'
  ]){
    assert.match(rule(selector),/font-size:var\(--calc-type-(?:section|subsection|support|label)\)/,`${selector} must use Calc type token`);
  }

  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) label, :where\(html\[data-add-page="calc"\]\) \.field-label-slot, :where\(html\[data-add-page="calc"\]\) \.kpi \.name\{font-size:var\(--calc-type-label\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .group-title small'),/font-size:10px/);
  assert.match(rule(':where(html[data-add-page="calc"]) .formula'),/font-size:10px/);
  assert.doesNotMatch(css1,/\.input-group \.field label\{font-size:11px\}/);
  assert.doesNotMatch(css1,/\.summary-card \.sname\{font-size:(?:10|11)px/);
  assert.doesNotMatch(css1,/\.range-box strong\{[^}]*font-size:13px/);
});



test('Calc는 iOS 가로 회전 text autosizing을 막아 CSS font-size를 그대로 유지한다',()=>{
  const body=rule(':where(html[data-add-page="calc"]) body');
  assert.match(body,/-webkit-text-size-adjust:100%/);
  assert.match(body,/text-size-adjust:100%/);
});

test('Calc 페이지 제목은 Compact canonical token을 viewport별로 재사용한다',()=>{
  assert.match(css1,/--calc-type-page-title:22px/);
  assert.match(css1,/@media\(max-width:1100px\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-type-page-title:21px/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-type-page-title:22px/);
  assert.match(rule(':where(html[data-add-page="calc"]) .hero h1'),/font-size:var\(--calc-type-page-title\)/);
});

test('Calc 3개 거래유형의 동적 문구는 inline font-size 없이 공통 typography selector를 사용한다',()=>{
  for(const preset of ['buy-2026-07-29','buy-2026-07-30','current-only']) assert.match(js,new RegExp(`['"]${preset}['"]`));
  assert.match(js1,/\$\('heroDescription'\)\.textContent=/);
  assert.match(js1,/class="mobile-section-title calc-result-section-title"/);
  assert.match(js1,/class="summary-card add-card-shell add-card-control"/);
  assert.doesNotMatch(js,/style\s*=\s*["'][^"']*font-size/i);
  assert.doesNotMatch(calc,/style\s*=\s*["'][^"']*font-size/i);
});

test('Calc iPhone 데스크탑 웹사이트 요청은 1280 viewport contract를 유지한다',()=>{
  assert.match(calc,/desktopAppleUA=\/Macintosh\//);
  assert.match(calc,/touchApple=\(navigator\.maxTouchPoints\|\|0\)>0/);
  assert.match(calc,/shortSide<=500/);
  assert.match(calc,/viewport\.setAttribute\('content','width=1280'\)/);
});

test('Calc 가로 터치폰은 Tablet이 아니라 세로 Phone과 같은 Compact UI contract를 사용한다',()=>{
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{/);
  assert.match(css1,/--density-page-pad:9px; --density-surface-lg:9px; --density-surface-md:9px; --density-surface-sm:8px;/);
  assert.match(css1,/@media \(max-width:760px\),[^]*:where\(html\[data-add-page=\"calc\"\]\) :is\(\.input-panel,\.calc-summary-panel,\.strategy-body\)\{padding:var\(--calc-surface-space\)\}/);
  assert.match(css1,/--density-gap-lg:8px; --density-gap-md:6px; --density-gap-sm:4px; --density-gap-xs:3px; --density-gap-micro:2px;/);
  assert.match(css1,/--density-action-pad-x:var\(--calc-control-space\); --density-action-pad-y:var\(--calc-control-space\); --density-field-pad-x:6px; --calc-surface-space:6px;/);
  assert.match(css1,/--calc-type-page-title:22px; --calc-type-section:15px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:10px;/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid:not\(\.no-prior-layout\), :where\(html\[data-add-page="calc"\]\) \.input-grid\.no-prior-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) #reportBtn \.report-text, :where\(html\[data-add-page="calc"\]\) #resetBtn \.reset-text\{display:none\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.add-button-mobile-icon\{ width:var\(--button-icon-size\); height:var\(--button-icon-size\); padding:0;/);
});


test('Calc 주요 선택 버튼은 6px 내부 spacing과 geometry를 공통화하고 가로 layout은 각 영역이 소유한다', () => {
  assert.equal((calc.match(/class="[^"]*calc-choice-group[^"]*"/g)||[]).length,0);
  assert.equal((calc.match(/class="[^"]*calc-choice-button[^"]*"/g)||[]).length,9);
  const choice=rule(':where(html[data-add-page="calc"]) .calc-choice-button');
  assert.match(choice,/height:var\(--calc-control-box-height\)/);
  assert.match(choice,/padding:var\(--calc-control-space\)/);
  assert.match(choice,/border-width:var\(--calc-control-border-width\)/);
  assert.match(choice,/font-size:var\(--calc-type-label\)/);
  assert.match(choice,/line-height:1/);
  assert.doesNotMatch(choice,/(?:^|;)width:/);
  assert.doesNotMatch(choice,/padding-(?:inline|block):/);
  assert.doesNotMatch(choice,/grid-template-columns:/);
  assert.doesNotMatch(css1,/--calc-choice-pad-x:/);

  const preset=rule(':where(html[data-add-page="calc"]) .preset-bar');
  assert.match(preset,/display:flex/);
  assert.match(preset,/flex-wrap:wrap/);
  const seg=rule(':where(html[data-add-page="calc"]) .seg');
  assert.match(seg,/display:grid/);
  assert.match(seg,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  const tabs=rule(':where(html[data-add-page="calc"]) .tabs');
  assert.match(tabs,/display:flex/);
  assert.match(tabs,/overflow:auto/);
  assert.match(rule(':where(html[data-add-page="calc"]) .tabs.settled-tabs'),/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);

  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{[^]*?\.preset-bar\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:var\(--density-gap-xs\)\}/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{[^]*?\.tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);overflow:visible\}/);
});

test('Calc 입력영역은 viewport 공통 Field Layout primitive를 사용한다', () => {
  assert.match(css1,/--calc-field-label-gap:var\(--density-gap-xs\)/);
  assert.match(css1,/--calc-field-row-gap:var\(--density-gap-md\)/);
  assert.match(css1,/--calc-field-label-line-height:1\.25/);
  assert.equal((css.match(/--calc-field-label-gap:/g)||[]).length,1);
  assert.equal((css.match(/--calc-field-row-gap:/g)||[]).length,1);
  assert.match(rule(':where(html[data-add-page="calc"]) .fields'),/gap:var\(--calc-field-row-gap\)/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.field\{display:flex;flex-direction:column;gap:var\(--calc-field-label-gap\)\}/);
  assert.match(css1,/\.field > :is\(label,\.field-label-slot\)\{line-height:var\(--calc-field-label-line-height\);min-height:1lh\}/);
  assert.match(css1,/\.existing-subsection,[^}]*\.current-subsection,[^}]*\.settled-subsection\{[^}]*gap:var\(--calc-field-row-gap\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .prior-trade-section'),/gap:var\(--calc-field-row-gap\)/);
  assert.doesNotMatch(css1,/\.prior-trade-section\{gap:var\(--density-gap-(?:sm|md)\)/);
  assert.doesNotMatch(css1,/\.settled-subsection\{gap:var\(--density-gap-(?:sm|md)\)/);
});

test('계산 기준은 전용 정렬 보정 없이 공통 field/row gap 구조를 사용한다', () => {
  const titleBody=rule(':where(html[data-add-page="calc"]) .group-title');
  assert.match(titleBody,/margin-bottom:var\(--density-gap-md\)/);
  assert.match(calc,/class="calculation-flow"/);
  assert.match(calc,/class="field calculation-mode-field"/);
  assert.match(calc,/class="field-label-slot" aria-hidden="true"/);
  assert.doesNotMatch(css1,/@media\(max-width:1100px\)\{[^}]*\.calculation-mode-field \.field-label-slot\{display:none\}/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{[^]*?\.calculation-mode-field \.field-label-slot\{display:none\}/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calculation-flow'),/gap:var\(--calc-field-row-gap\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .seg'),/gap:var\(--calc-field-row-gap\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .seg'),/margin:0/);
  assert.match(rule(':where(html[data-add-page="calc"]) .formula'),/margin:0/);
  assert.match(rule(':where(html[data-add-page="calc"]) .actual-sale-price'),/margin:0/);
  assert.doesNotMatch(css1,/\.calculation-group \.seg\{[^}]*padding-top:/);
  assert.doesNotMatch(css1,/\.calculation-group \.seg\{[^}]*margin-top:/);
  assert.doesNotMatch(css1,/margin-top:35px/);
  assert.doesNotMatch(css1,/calc\(1\.45em \+ var\(--density-gap-xs\)\)/);
});

test('Calc invalid 입력은 마지막 정상 결과를 stale 상태로 표시하고 정상 입력 시 즉시 해제한다',()=>{
  assert.match(js1,/let hasRenderedCalculation=false/);
  assert.match(js1,/function setCalculationResultsStale\(stale\)\{ document\.documentElement\.classList\.toggle\('calc-results-stale',stale\); \}/);
  assert.match(js1,/if\(validation\.errors\.length\)\{ setCalculationResultsStale\(hasRenderedCalculation\); return; \} setCalculationResultsStale\(false\)/);
  assert.match(js1,/hasRenderedCalculation=true/);
  assert.match(js,/아래 결과는 마지막 정상 입력 기준입니다\. 입력값을 수정하면 자동으로 다시 계산됩니다\./);
  assert.match(css1,/html:where\(\[data-add-page="calc"\]\)\.calc-results-stale :is\(\.calc-summary-panel,#strategyTabs,main\)\{opacity:\.48;transition:opacity \.14s ease\}/);
});



test('Report Timeline은 실현손익 미니카드를 canonical net에서 렌더하고 모바일에서 설명 하단으로 배치한다',()=>{
  assert.match(js1,/function timelineEvent\(sortDate,range,title,strong,body,net=null\)/);
  assert.match(js1,/events\.push\(Object\.freeze\(\{\.\.\.builder\(rows\),net:reportSum\(rows,'net'\)\}\)\)/);
  assert.match(js1,/function timelineProfitCard\(net\)\{/);
  assert.match(js1,/reportMetricText\(net,'signedWon'\)/);
  assert.match(js1,/class="timeline-profit-card\$\{className\}"/);
  assert.match(js1,/\$\{timelineProfitCard\(item\.net\)\}/);
  const timelineNarrative=js.slice(js.indexOf('function timelineGeneric'),js.indexOf('function timelineProfitCard'));
  assert.doesNotMatch(timelineNarrative,/순손익|순이익|순손실/);
  assert.match(css1,/:where\(html\[data-add-page="report"\]\) \.timeline-card\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;/);
  assert.match(css1,/:where\(html\[data-add-page="report"\]\) \.timeline-profit-card\{[^}]*min-width:108px/);
  assert.match(css1,/\.timeline-profit-card\.pos strong\{color:var\(--positive\)\}/);
  assert.match(css1,/\.timeline-profit-card\.neg strong\{color:var\(--negative\)\}/);
  assert.match(css1,/@media\(max-width:760px\)\{[^]*?\.timeline-card\{grid-column:2;grid-template-columns:minmax\(0,1fr\);gap:var\(--density-gap-xs\)\}[^]*?\.timeline-profit-card\{width:100%;min-width:0;margin-top:var\(--density-gap-xs\)/);
});

// Canonical Add UI contracts after Compact/Dynamic experiment cleanup.
function contrastRatio(hexA,hexB){
  const lum=hex=>{
    const rgb=hex.replace('#','').match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  };
  const [a,b]=[lum(hexA),lum(hexB)].sort((x,y)=>y-x);
  return (a+0.05)/(b+0.05);
}

test('Calc와 Report HTML은 add.css + add.js 단일 canonical runtime만 사용한다',()=>{
  for(const html of [calc,report]){
    assert.match(html,/href="add\.css"/);
    assert.match(html,/src="add\.js"/);
    assert.doesNotMatch(html,/add-theme\.(?:css|js)/);
    assert.doesNotMatch(html,/(?:calc|report)-alt\.css/);
    assert.doesNotMatch(html,/id="addThemeToggle"/);
    assert.doesNotMatch(html,/data-add-theme/);
  }
});

test('폐기된 theme/Alt 파일과 state contract는 Add canonical 구조에 남지 않는다',()=>{
  for(const name of ['add-theme.css','add-theme.js','calc-alt.css','report-alt.css']){
    assert.equal(fs.existsSync(path.join(ADD_DIR,name)),false,`${name} must be removed`);
  }
  for(const source of [css,js,calc,report]){
    assert.doesNotMatch(source,/data-add-theme/);
    assert.doesNotMatch(source,/investmentDashboard\.addTheme\./);
    assert.doesNotMatch(source,/addThemeToggle/);
  }
});

test('Calc Compact는 add.css의 canonical style이고 Desktop 최대폭은 1280px을 유지한다',()=>{
  assert.match(css1,/:root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-space:6px; --calc-control-pad-y:var\(--calc-control-space\)/);
  assert.match(css1,/:root\{[^}]*--surface-radius-md:16px; --control-radius-md:10px; --inner-radius-md:8px;[^}]*--corner-surface-cap:6px; --corner-control-cap:5px; --corner-inner-cap:4px/);
  assert.match(css1,/:root:where\(\[data-add-page="calc"\]\)\{[^}]*--density-page-pad:10px; --density-surface-lg:9px; --density-surface-md:7px; --density-surface-sm:6px/);
  assert.match(css1,/:root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-surface-space:6px; --calc-card-gap:var\(--calc-surface-space\); --density-table-pad-x:var\(--calc-surface-space\); --density-table-pad-y:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .wrap'),/max-width:1280px/);
  assert.doesNotMatch(rule(':where(html[data-add-page="calc"]) .wrap'),/max-width:1600px/);
  assert.match(rule(':where(html[data-add-page="calc"]) body'),/font-variant-numeric:tabular-nums/);
});

test('Calc Compact density는 canonical selector에 직접 병합되고 별도 override layer를 요구하지 않는다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) :is(.input-panel,.calc-summary-panel,.strategy-body)'),/padding:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .input-group'),/padding:var\(--calc-surface-space\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .kpi .value'),/font-size:18px/);
  assert.match(rule(':where(html[data-add-page="calc"]) .summary-card .svalue'),/font-size:17px/);
  assert.equal((css.match(/data-add-theme/g)||[]).length,0);
});

test('Report Dynamic visual language는 canonical add.css가 직접 소유한다',()=>{
  assert.match(css1,/--energy-violet:#6d5dfc; --energy-cyan:#18a9c9; --energy-cyan-text:#167c9a; --energy-gold:#d99a28/);
  assert.match(rule(':where(html[data-add-page="report"]) .hero'),/linear-gradient\(120deg,#151c3a 0%,#382c7e 47%,#15637c 100%\)/);
  assert.match(rule(':where(html[data-add-page="report"]) .kpi:before'),/linear-gradient\(90deg,var\(--energy-violet\),var\(--energy-cyan\),var\(--energy-gold\)\)/);
  assert.match(rule(':where(html[data-add-page="report"]) .timeline:before'),/linear-gradient\(var\(--energy-violet\),var\(--energy-cyan\)\)/);
  assert.match(rule(':where(html[data-add-page="report"]) .timeline-dot'),/background:var\(--energy-violet\)/);
});

test('Report Dynamic은 기존 1280px 레이아웃과 기존 typography scale을 유지한다',()=>{
  assert.match(rule(':where(html[data-add-page="report"]) .wrap'),/max-width:1280px/);
  assert.doesNotMatch(rule(':where(html[data-add-page="report"]) .wrap'),/max-width:1340px/);
  assert.match(rule(':where(html[data-add-page="report"]) .hero'),/padding:24px/);
  assert.match(rule(':where(html[data-add-page="report"]) h1'),/font-size:34px/);
  assert.match(rule(':where(html[data-add-page="report"]) .kpi .value'),/font-size:25px/);
  assert.match(css1,/@media\(max-width:1100px\)\{ :where\(html\[data-add-page="report"\]\) h1\{font-size:27px\}/);
  assert.match(css1,/@media\(max-width:760px\)\{ :where\(html\[data-add-page="report"\]\) h1\{margin:5px 0;font-size:clamp\(20px,6vw,24px\)/);
});

test('Dynamic cyan 작은 텍스트는 그래픽 cyan과 분리되고 라이트모드 4.5:1 이상 대비를 유지한다',()=>{
  const token=css.match(/--energy-cyan-text:(#[0-9a-f]{6})/i);
  assert.ok(token,'missing --energy-cyan-text token');
  assert.ok(contrastRatio(token[1],'#ffffff')>=4.5,`cyan text contrast is ${contrastRatio(token[1],'#ffffff').toFixed(2)}:1`);
  assert.match(css1,/:where\(html\[data-add-page="report"\]\) \.split-group-day \.split-group-kicker\{color:var\(--energy-cyan-text\)\}/);
  assert.match(css1,/--energy-cyan:#18a9c9/);
});
