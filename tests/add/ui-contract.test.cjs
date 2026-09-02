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

test('Calc control geometry는 단일 box-height token을 Source of Truth로 사용한다',()=>{
  assert.match(css1,/--calc-control-border-width:1px/);
  assert.match(css1,/--calc-control-box-height:calc\(1rem \+ var\(--calc-control-pad-y\) \+ var\(--calc-control-pad-y\) \+ var\(--calc-control-border-width\) \+ var\(--calc-control-border-width\)\)/);
  assert.match(css1,/--calc-control-inner-height:calc\(var\(--calc-control-box-height\) - var\(--calc-control-border-width\) - var\(--calc-control-border-width\)\)/);
  assert.equal((css.match(/--calc-control-box-height:/g)||[]).length,1);
  const body=rule(':where(html[data-add-page="calc"]) .control');
  assert.match(body,/height:var\(--calc-control-box-height\)/);
  assert.match(body,/border:var\(--calc-control-border-width\) solid var\(--control-border\)/);
  assert.match(body,/padding:var\(--calc-control-pad-y\) var\(--density-action-pad-x\)/);
  assert.match(body,/min-height:0/);
  assert.match(body,/line-height:1/);
  assert.match(body,/-webkit-appearance:none/);
  assert.match(body,/appearance:none/);
  assert.doesNotMatch(body,/height:(?:30|34|40)px/);
});

test('Calc input 값은 Web/Tablet 12px, Phone은 iOS 16px computed + .75 optical scale로 12px을 유지한다',()=>{
  assert.match(css1,/--calc-control-value-size:12px; --calc-control-input-size:var\(--calc-control-value-size\); --calc-control-scale:1; --calc-control-inner-size:100%/);
  assert.match(rule(':where(html[data-add-page="calc"]) .control'),/font-size:var\(--calc-control-input-size\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .unit'),/font-size:var\(--calc-control-value-size\)/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:6px;[^}]*--calc-control-input-size:16px; --calc-control-scale:\.75; --calc-control-inner-size:133\.333333%;[^}]*--calc-control-inner-pad-y:8px; --calc-control-inner-pad-x:10\.666667px;/);
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

test('Calc preset 선택은 active와 aria-pressed를 한 번에 동기화한다',()=>{
  assert.match(js1,/function setPresetActive\(id\)\{[^}]*classList\.toggle\('active',active\);b\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(js1,/function setCurrentPurchasePresetActive\(id\)\{[^}]*classList\.toggle\('active',active\);b\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(calc,/class="preset-btn[^\"]*"[^>]*aria-pressed="(?:true|false)"/);
});

test('Calc strategy tab은 active/aria-selected/tabindex/panel aria-hidden을 동기화한다',()=>{
  assert.match(js1,/tabs\.forEach\(b=>\{const active=b\.dataset\.tab===strategyId;b\.classList\.toggle\('active',active\);b\.setAttribute\('aria-selected',String\(active\)\);b\.tabIndex=active\?0:-1;\}\)/);
  assert.match(js1,/panel\.classList\.toggle\('active',active\);panel\.setAttribute\('aria-hidden',String\(!active\)\)/);
  assert.match(calc,/role="tablist"/);
});

test('Report tab도 active/aria-selected/tabindex contract를 유지한다',()=>{
  assert.match(js1,/btn\.classList\.toggle\('active', active\); btn\.setAttribute\('aria-selected', String\(active\)\); btn\.tabIndex = active \? 0 : -1/);
  assert.match(report,/role="tablist"/);
});

test('Calc Compact typography는 역할 token을 유지하고 viewport별 canonical scale을 사용한다',()=>{
  assert.match(css1,/--calc-type-page-title:22px; --calc-type-section:16px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:11px;/);
  assert.match(css1,/@media\(max-width:1100px\)\{ :root:where\(\[data-add-page="calc"\]\)\{ --density-page-pad:9px;[^}]*--calc-type-page-title:21px; --calc-type-section:15px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:11px;/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:6px;[^}]*--calc-type-page-title:22px; --calc-type-section:15px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:10px;/);

  for(const selector of [
    ':where(html[data-add-page="calc"]) .add-heading-section',
    ':where(html[data-add-page="calc"]) .add-heading-subsection',
    ':where(html[data-add-page="calc"]) .mobile-section-title',
    ':where(html[data-add-page="calc"]) .case-note',
    ':where(html[data-add-page="calc"]) .range-box strong',
    ':where(html[data-add-page="calc"]) .strategy-title p',
    ':where(html[data-add-page="calc"]) .summary-card .sname',
    ':where(html[data-add-page="calc"]) .mobile-data-label'
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
  assert.match(js1,/class="mobile-section-title add-heading-minor"/);
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
  assert.match(css1,/--density-gap-lg:8px; --density-gap-md:6px; --density-gap-sm:4px; --density-gap-xs:3px; --density-gap-micro:2px;/);
  assert.match(css1,/--density-action-pad-x:8px; --density-action-pad-y:8px; --density-field-pad-x:6px; --density-table-pad-x:8px; --density-table-pad-y:6px; --button-compact-pad-x:4px;/);
  assert.match(css1,/--calc-type-page-title:22px; --calc-type-section:15px; --calc-type-subsection:13px; --calc-type-support:11px; --calc-type-label:10px;/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid, :where\(html\[data-add-page="calc"\]\) \.input-grid\.no-prior-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) #reportBtn \.report-text, :where\(html\[data-add-page="calc"\]\) #resetBtn \.reset-text\{display:none\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.add-button-mobile-icon\{ width:var\(--button-icon-size\); height:var\(--button-icon-size\); padding:0;/);
});


test('calculation criteria buttons share the same Calc control geometry token', () => {
  assert.match(css1, /\.calculation-group \.seg button\{[^}]*height:var\(--calc-control-box-height\)[^}]*border-width:var\(--calc-control-border-width\)[^}]*line-height:1/);
  assert.doesNotMatch(css1, /\.calculation-group \.seg button\{[^}]*height:calc\(/);
  assert.doesNotMatch(css1, /\.calculation-group \.seg button\{[^}]*height:var\(--button-control-height\)/);
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
  assert.match(css1,/@media\(max-width:1100px\)\{[^}]*\.calculation-mode-field \.field-label-slot\{display:none\}/);
  assert.match(rule(':where(html[data-add-page="calc"]) .calculation-flow'),/gap:var\(--calc-field-row-gap\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .seg'),/gap:var\(--calc-field-row-gap\);margin:0/);
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
  assert.match(css1,/html:where\(\[data-add-page="calc"\]\)\.calc-results-stale :is\(\.kpis,\.range-panel,#strategyTabs,main\)\{opacity:\.48;transition:opacity \.14s ease\}/);
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

test('Calc Compact는 add.css의 canonical style이고 전체 폭은 기존 1480px baseline을 유지한다',()=>{
  assert.match(css1,/:root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:5px/);
  assert.match(css1,/:root:where\(\[data-add-page="calc"\]\)\{[^}]*--surface-radius-md:8px; --control-radius-md:6px; --inner-radius-md:5px/);
  assert.match(css1,/:root:where\(\[data-add-page="calc"\]\)\{[^}]*--density-page-pad:10px; --density-surface-lg:9px; --density-surface-md:7px; --density-surface-sm:6px/);
  assert.match(rule(':where(html[data-add-page="calc"]) .wrap'),/max-width:1480px/);
  assert.doesNotMatch(rule(':where(html[data-add-page="calc"]) .wrap'),/max-width:1600px/);
  assert.match(rule(':where(html[data-add-page="calc"]) body'),/font-variant-numeric:tabular-nums/);
});

test('Calc Compact density는 canonical selector에 직접 병합되고 별도 override layer를 요구하지 않는다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) .input-panel'),/padding:var\(--density-surface-md\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .input-group'),/padding:var\(--density-surface-sm\)/);
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
