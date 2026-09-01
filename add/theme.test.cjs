const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const themeJs=read('add-theme.js');
const themeCss=read('add-theme.css');
const calcAltCss=read('calc-alt.css');
const reportAltCss=read('report-alt.css');
const calcHtml=read('calc.html');
const reportHtml=read('kodex-leverage-report.html');

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
  assert.match(calcHtml,/data-add-page="calc"/);
  assert.match(reportHtml,/data-add-page="report"/);
  assert.match(calcHtml,/href="calc-alt\.css"/);
  assert.match(reportHtml,/href="report-alt\.css"/);
  assert.match(calcHtml,/src="add-theme\.js"/);
  assert.match(reportHtml,/src="add-theme\.js"/);
  assert.match(calcHtml,/id="addThemeToggle"/);
  assert.match(reportHtml,/id="addThemeToggle"/);
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
