const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
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

test('Calc control 높이는 고정 px가 아니라 1em + 공통 Y padding에서 파생된다',()=>{
  const body=rule(':where(html[data-add-page="calc"]) .control');
  assert.match(body,/height:calc\(1em \+ var\(--calc-control-pad-y\) \+ var\(--calc-control-pad-y\) \+ 2px\)/);
  assert.match(body,/padding:var\(--calc-control-pad-y\) var\(--density-action-pad-x\)/);
  assert.match(body,/min-height:0/);
  assert.match(body,/line-height:1/);
  assert.match(body,/-webkit-appearance:none/);
  assert.match(body,/appearance:none/);
  assert.doesNotMatch(body,/height:(?:30|34|40)px/);
});

test('date와 일반 input은 같은 Y padding token으로 동일 외곽 높이를 만든다',()=>{
  assert.match(css1,/--calc-control-pad-y:8px/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:6px;/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.control\{font-size:16px;line-height:1\}/);
  const dateBody=rule(':where(html[data-add-page="calc"]) .date-control-shell .date-control');
  assert.match(dateBody,/height:calc\(1em \+ var\(--calc-control-pad-y\) \+ var\(--calc-control-pad-y\)\)/);
  assert.match(dateBody,/padding:var\(--calc-control-pad-y\) var\(--density-action-pad-x\)/);
  assert.match(dateBody,/-webkit-appearance:none/);
  assert.match(dateBody,/appearance:none/);
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

test('Calc label typography는 역할별 token으로 통일되고 viewport마다 2px씩 줄어든다',()=>{
  assert.match(css1,/--calc-type-page-title:28px; --calc-type-section:20px; --calc-type-subsection:18px; --calc-type-support:16px; --calc-type-label:14px;/);
  assert.match(css1,/@media\(max-width:1100px\)\{ :root:where\(\[data-add-page="calc"\]\)\{ --calc-type-page-title:26px; --calc-type-section:18px; --calc-type-subsection:16px; --calc-type-support:14px; --calc-type-label:12px;/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:6px; --calc-type-page-title:24px; --calc-type-section:16px; --calc-type-subsection:14px; --calc-type-support:12px; --calc-type-label:10px;/);

  for(const selector of [
    ':where(html[data-add-page="calc"]) .add-heading-section',
    ':where(html[data-add-page="calc"]) .add-heading-subsection',
    ':where(html[data-add-page="calc"]) .mobile-section-title',
    ':where(html[data-add-page="calc"]) .group-title small',
    ':where(html[data-add-page="calc"]) .formula',
    ':where(html[data-add-page="calc"]) .case-note',
    ':where(html[data-add-page="calc"]) .range-box strong',
    ':where(html[data-add-page="calc"]) .strategy-title p',
    ':where(html[data-add-page="calc"]) .summary-card .sname',
    ':where(html[data-add-page="calc"]) .mobile-data-label'
  ]){
    assert.match(rule(selector),/font-size:var\(--calc-type-(?:section|subsection|support|label)\)/,`${selector} must use Calc type token`);
  }

  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) label, :where\(html\[data-add-page="calc"\]\) \.kpi \.name\{font-size:var\(--calc-type-label\)/);
  assert.doesNotMatch(css1,/\.input-group \.field label\{font-size:11px\}/);
  assert.doesNotMatch(css1,/\.summary-card \.sname\{font-size:(?:10|11)px/);
  assert.doesNotMatch(css1,/\.range-box strong\{[^}]*font-size:13px/);
});



test('Calc는 iOS 가로 회전 text autosizing을 막아 CSS font-size를 그대로 유지한다',()=>{
  const body=rule(':where(html[data-add-page="calc"]) body');
  assert.match(body,/-webkit-text-size-adjust:100%/);
  assert.match(body,/text-size-adjust:100%/);
});

test('Calc 페이지 제목도 Desktop Tablet Phone 2px typography contract를 사용한다',()=>{
  assert.match(css1,/--calc-type-page-title:28px/);
  assert.match(css1,/@media\(max-width:1100px\)\{ :root:where\(\[data-add-page="calc"\]\)\{ --calc-type-page-title:26px/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-type-page-title:24px/);
  assert.match(rule(':where(html[data-add-page="calc"]) .hero h1'),/font-size:var\(--calc-type-page-title\)/);
  assert.doesNotMatch(css1,/:where\(html\[data-add-page="calc"\]\) \.hero h1\{font-size:24px\}/);
});

test('Calc 3개 거래유형의 동적 문구는 inline font-size 없이 공통 typography selector를 사용한다',()=>{
  for(const preset of ['buy-2026-07-29','buy-2026-07-30','current-only']) assert.match(js,new RegExp(`['"]${preset}['"]`));
  assert.match(js1,/\$\('heroDescription'\)\.textContent=/);
  assert.match(js1,/class="mobile-section-title add-heading-minor"/);
  assert.match(js1,/class="summary-card add-card-shell add-card-control"/);
  assert.doesNotMatch(js,/style\s*=\s*["'][^"']*font-size/i);
  assert.doesNotMatch(calc,/style\s*=\s*["'][^"']*font-size/i);
});

test('Calc 가로 터치폰은 Tablet이 아니라 세로 Phone과 같은 UI contract를 사용한다',()=>{
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{/);
  assert.match(css1,/--density-page-pad:10px; --density-surface-lg:12px; --density-surface-md:10px; --density-surface-sm:8px;/);
  assert.match(css1,/--density-gap-lg:8px; --density-gap-md:6px; --density-gap-sm:4px; --density-gap-micro:2px;/);
  assert.match(css1,/--density-action-pad-x:8px; --density-table-pad-x:8px; --density-table-pad-y:6px; --button-compact-pad-x:4px;/);
  assert.match(css1,/--calc-type-page-title:24px; --calc-type-section:16px; --calc-type-subsection:14px; --calc-type-support:12px; --calc-type-label:10px;/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid, :where\(html\[data-add-page="calc"\]\) \.input-grid\.no-prior-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) #reportBtn \.report-text, :where\(html\[data-add-page="calc"\]\) #resetBtn \.reset-text\{display:none\}/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.add-button-mobile-icon\{ width:var\(--button-icon-size\); height:var\(--button-icon-size\); padding:0;/);
});


test('calculation criteria buttons share Calc input-derived box height', () => {
  assert.match(css1, /\.calculation-group \.seg button\{[^}]*height:calc\(1rem \+ var\(--calc-control-pad-y\) \+ var\(--calc-control-pad-y\) \+ 2px\)[^}]*line-height:1/);
  assert.doesNotMatch(css1, /\.calculation-group \.seg button\{[^}]*height:var\(--button-control-height\)/);
});


test('calculation criteria card keeps common title flow and uses a non-collapsing desktop label-row spacer', () => {
  const titleBody=rule(':where(html[data-add-page=\"calc\"]) .group-title');
  assert.match(titleBody,/margin-bottom:var\(--density-gap-md\)/);
  assert.doesNotMatch(css1,/\.calculation-group \.group-title\{[^}]*margin-bottom:0/);
  assert.match(css1,/@media\(min-width:1101px\)\{\s*:where\(html\[data-add-page="calc"\]\) \.calculation-group \.seg\{font-size:var\(--calc-type-label\);padding-top:calc\(1\.45em \+ var\(--density-gap-xs\)\)\}\s*\}/);
  assert.doesNotMatch(css1,/\.calculation-group \.seg\{[^}]*margin-top:/);
  assert.doesNotMatch(css1,/\.calculation-group \.seg\{[^}]*margin-top:35px/);
  assert.doesNotMatch(css1,/\.calculation-group\{[^}]*padding:var\(--density-surface-sm\)/);
});
