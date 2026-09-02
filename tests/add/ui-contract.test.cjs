const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ADD_DIR=path.resolve(__dirname,'../../add');
const read=name=>fs.readFileSync(path.join(ADD_DIR,name),'utf8');
const css=read('add.css');
const js=read('add.js');
const calc=read('calc.html');
const report=read('kodex-leverage-report.html');
const themeJs=read('add-theme.js');
const themeCss=read('add-theme.css');
const calcAltCss=read('calc-alt.css');
const reportAltCss=read('report-alt.css');

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

test('date와 일반 input은 같은 Y padding token으로 동일 외곽 높이를 만든다',()=>{
  assert.match(css1,/--calc-control-pad-y:8px/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{ :root:where\(\[data-add-page="calc"\]\)\{[^}]*--calc-control-pad-y:6px;/);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.control\{font-size:16px;line-height:1\}/);
  const dateBody=rule(':where(html[data-add-page="calc"]) .date-control-shell .date-control');
  assert.match(dateBody,/height:var\(--calc-control-inner-height\)/);
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

  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) label, :where\(html\[data-add-page="calc"\]\) \.field-label-slot, :where\(html\[data-add-page="calc"\]\) \.kpi \.name\{font-size:var\(--calc-type-label\)/);
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

test('Calc iPhone 데스크탑 웹사이트 요청은 1280 viewport contract를 유지한다',()=>{
  assert.match(calc,/desktopAppleUA=\/Macintosh\//);
  assert.match(calc,/touchApple=\(navigator\.maxTouchPoints\|\|0\)>0/);
  assert.match(calc,/shortSide<=500/);
  assert.match(calc,/viewport\.setAttribute\('content','width=1280'\)/);
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


test('calculation criteria buttons share the same Calc control geometry token', () => {
  assert.match(css1, /\.calculation-group \.seg button\{[^}]*height:var\(--calc-control-box-height\)[^}]*border-width:var\(--calc-control-border-width\)[^}]*line-height:1/);
  assert.doesNotMatch(css1, /\.calculation-group \.seg button\{[^}]*height:calc\(/);
  assert.doesNotMatch(css1, /\.calculation-group \.seg button\{[^}]*height:var\(--button-control-height\)/);
});


test('Calc 입력영역은 viewport 공통 Field Layout primitive를 사용한다', () => {
  assert.match(css1,/--calc-field-label-gap:var\(--density-gap-xs\)/);
  assert.match(css1,/--calc-field-row-gap:var\(--density-gap-sm\)/);
  assert.match(css1,/--calc-field-label-line-height:1\.45/);
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

// Alt theme contracts are UI contracts, so they live in this file instead of a separate theme test.
function createHarness(page,{storedTheme=null}={}){
  const storage=new Map();
  const storageKey=`investmentDashboard.addTheme.${page}`;
  if(storedTheme!==null)storage.set(storageKey,storedTheme);

  const events={};
  const label={textContent:''};
  const attrs=new Map();
  const button={
    title:'',
    setAttribute(name,value){attrs.set(name,String(value));},
    getAttribute(name){return attrs.get(name)??null;},
    querySelector(selector){return selector==='[data-add-theme-label]'?label:null;},
    addEventListener(type,handler){events[type]=handler;}
  };
  const root={dataset:{addPage:page}};
  const dispatched=[];
  const document={
    documentElement:root,
    readyState:'complete',
    getElementById(id){return id==='addThemeToggle'?button:null;},
    addEventListener(){}
  };
  const localStorage={
    getItem(key){return storage.has(key)?storage.get(key):null;},
    setItem(key,value){storage.set(key,String(value));},
    removeItem(key){storage.delete(key);}
  };
  class Event{constructor(type){this.type=type;}}
  const window={dispatchEvent(event){dispatched.push(event.type);}};
  const context={document,window,localStorage,Event,requestAnimationFrame:fn=>fn()};
  vm.runInNewContext(themeJs,context,{filename:'add-theme.js'});

  return {
    root,button,label,storage,storageKey,dispatched,
    click(){assert.ok(events.click,'theme click handler must exist');events.click();}
  };
}

function contrastRatio(hexA,hexB){
  const lum=hex=>{
    const rgb=hex.replace('#','').match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  };
  const [a,b]=[lum(hexA),lum(hexB)].sort((x,y)=>y-x);
  return (a+0.05)/(b+0.05);
}

test('Calc와 Report HTML은 기본 디자인을 유지한 채 각 Alt CSS와 공통 theme controller만 추가한다',()=>{
  assert.match(calc,/data-add-page="calc"/);
  assert.match(report,/data-add-page="report"/);
  assert.match(calc,/href="calc-alt\.css"/);
  assert.match(report,/href="report-alt\.css"/);
  assert.match(calc,/src="add-theme\.js"/);
  assert.match(report,/src="add-theme\.js"/);
  assert.match(calc,/id="addThemeToggle"/);
  assert.match(report,/id="addThemeToggle"/);
});

test('Alt CSS는 data-add-theme="alt" 범위에서만 활성화된다',()=>{
  assert.match(calcAltCss,/data-add-page="calc"\]\[data-add-theme="alt"\]/);
  assert.match(reportAltCss,/data-add-page="report"\]\[data-add-theme="alt"\]/);
  assert.match(themeCss,/data-add-theme="alt"/);
});

test('Calc 기본 상태에서 Compact 버튼 contract가 맞고 Alt 선택/복귀가 즉시 동기화된다',()=>{
  const h=createHarness('calc');
  assert.equal(h.root.dataset.addTheme,undefined);
  assert.equal(h.button.getAttribute('aria-pressed'),'false');
  assert.equal(h.label.textContent,'Compact');
  assert.equal(h.storage.has(h.storageKey),false);

  h.click();
  assert.equal(h.root.dataset.addTheme,'alt');
  assert.equal(h.button.getAttribute('aria-pressed'),'true');
  assert.equal(h.label.textContent,'기본');
  assert.equal(h.storage.get(h.storageKey),'alt');

  h.click();
  assert.equal(h.root.dataset.addTheme,undefined);
  assert.equal(h.button.getAttribute('aria-pressed'),'false');
  assert.equal(h.label.textContent,'Compact');
  assert.equal(h.storage.has(h.storageKey),false);
});

test('Calc와 Report는 서로 독립적인 localStorage key를 사용한다',()=>{
  const calc=createHarness('calc',{storedTheme:'alt'});
  const report=createHarness('report');
  assert.equal(calc.storageKey,'investmentDashboard.addTheme.calc');
  assert.equal(report.storageKey,'investmentDashboard.addTheme.report');
  assert.equal(calc.root.dataset.addTheme,'alt');
  assert.equal(report.root.dataset.addTheme,undefined);
});

test('Report 저장된 Dynamic 상태는 초기 렌더 전에 복원되고 버튼 ARIA와 label이 동기화된다',()=>{
  const h=createHarness('report',{storedTheme:'alt'});
  assert.equal(h.root.dataset.addTheme,'alt');
  assert.equal(h.button.getAttribute('aria-pressed'),'true');
  assert.equal(h.button.getAttribute('aria-label'),'기본 디자인으로 전환');
  assert.equal(h.label.textContent,'기본');
});

test('Report 테마 전환은 기존 resize lifecycle을 호출해 Canvas palette를 다시 읽게 한다',()=>{
  const h=createHarness('report');
  h.click();
  assert.deepEqual(h.dispatched,['resize']);
});

test('Dynamic 라이트모드의 작은 cyan 텍스트는 그래픽 cyan과 분리되고 4.5:1 이상 대비를 확보한다',()=>{
  const token=reportAltCss.match(/--energy-cyan-text:(#[0-9a-f]{6})/i);
  assert.ok(token,'missing --energy-cyan-text token');
  assert.ok(contrastRatio(token[1],'#ffffff')>=4.5,`cyan text contrast is ${contrastRatio(token[1],'#ffffff').toFixed(2)}:1`);
  assert.match(reportAltCss,/\.split-group-day \.split-group-kicker\{\s*color:var\(--energy-cyan-text\)/);
  assert.match(reportAltCss,/--energy-cyan:#18a9c9/);
});

