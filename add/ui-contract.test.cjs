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
  assert.match(css1,/@media\(max-width:760px\)\{ :root:where\(\[data-add-page="calc"\]\)\{--calc-control-pad-y:6px\}/);
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
