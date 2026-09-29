const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const compact=s=>s.replace(/\s+/g,' ');
const capture=(source,re,label)=>{
  const match=source.match(re);
  assert.ok(match,`missing ${label}`);
  return match[1];
};
const cssProp=(source,prop)=>capture(source,new RegExp(`${prop.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*:\\s*([^;]+);`),prop).trim();
const cssBlock=(source,selector)=>{
  const escaped=selector.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&');
  return capture(source,new RegExp(`${escaped}\\s*\\{([^}]*)\\}`),`${selector} block`);
};

const mainUi=read('js/dashboard-ui.js');
const mainUiCommon=read('js/dashboard-ui-common.js');
const mainIndex=read('index.html');
const mainCommon=read('css/common.css');
const mainTablet=read('css/tablet.css');
const mainMobile=read('css/mobile.css');
const mainSpecial=read('css/special.css');
const mainInteraction=read('css/interaction.css');

const addJs=read('add/add.js');
const addCss=read('add/add.css');
const calcHtml=read('add/calc.html');
const reportHtml=read('add/kodex-leverage-report.html');

test('Main↔Add suite-wide appearance/corner/responsive/desktop-request contract는 서로 같은 값을 유지한다',()=>{
  // 1) Appearance protocol: 값 자체가 제품 contract다. 내부 상수명은 정상 리팩터링을 막지 않도록 고정하지 않는다.
  for(const value of ['investmentDashboard.theme','investmentDashboard.cornerTheme','investmentDashboard.appearance']){
    for(const [label,source] of [['Main',mainUi],['Add',addJs]]){
      assert.ok(source.includes(`'${value}'`),`${label} appearance contract drifted: ${value}`);
    }
  }
  assert.match(mainUi,/new BroadcastChannel\([^)]+\)/,'Main appearance BroadcastChannel missing');
  assert.match(addJs,/new BroadcastChannel\([^)]+\)/,'Add appearance BroadcastChannel missing');

  // 2) Corner cap: palette/radius scale은 독립이어도 soft-square/rounded cap contract는 같아야 한다.
  for(const prop of ['--corner-surface-cap','--corner-control-cap','--corner-inner-cap']){
    assert.equal(cssProp(addCss,prop),cssProp(mainCommon,prop),`${prop} base cap drifted`);
    const mainRounded=cssBlock(mainCommon,'html.rounded-corners');
    const addRounded=cssBlock(addCss,'html.rounded-corners');
    assert.equal(cssProp(addRounded,prop),cssProp(mainRounded,prop),`${prop} rounded cap drifted`);
  }

  // 3) 기본 breakpoint / 실제 터치 Phone Landscape contract.
  const tabletMatch=mainTablet.match(/@media\s*\(min-width:(\d+)px\)\s*and\s*\(max-width:(\d+)px\)/);
  assert.ok(tabletMatch,'missing Main Tablet breakpoint');
  const mainTabletMin=Number(tabletMatch[1]);
  const mainTabletMax=Number(tabletMatch[2]);
  const mainPhoneMax=Number(capture(mainMobile,/@media\s*\(max-width:(\d+)px\)/,'Main Phone breakpoint'));
  const addTabletMax=Number(capture(addCss,/@media\s*\(max-width:(\d+)px\)\s*\{/,'Add Tablet/compact breakpoint'));
  const addPhoneMax=Number(capture(addCss,/@media\s*\(max-width:(\d+)px\),\s*\(orientation:landscape\)/,'Add Phone breakpoint'));
  assert.equal(mainTabletMin,mainPhoneMax+1,'Main Tablet/Phone boundary is not contiguous');
  assert.equal(addPhoneMax,mainPhoneMax,'Main/Add Phone max-width drifted');
  assert.equal(addTabletMax,mainTabletMax,'Main/Add Tablet max-width drifted');

  const landscape=capture(mainUiCommon,/const PHONE_LANDSCAPE_QUERY='([^']+)'/,'Main Phone Landscape query');
  const combined=`(max-width:${mainPhoneMax}px), ${landscape}`;
  const addReportPhone=capture(addJs,/const REPORT_PHONE_QUERY='([^']+)'/,'Add Report Phone query');
  assert.equal(addReportPhone,combined,'Main/Add JS Phone Landscape contract drifted');
  assert.ok(compact(mainSpecial).includes(`@media ${combined}{`),'Main Phone Shared CSS drifted from suite contract');
  assert.ok(compact(addCss).includes(`@media ${combined}{`),'Add Phone CSS drifted from suite contract');

  // 4) iPhone "데스크탑 웹사이트 요청": Main/Calc/Report는 모두 1280px desktop contract를 사용한다.
  const mainDesktop=Number(capture(mainIndex,/dashboardView==='web'\)forcedViewport=(\d+)/,'Main forced desktop viewport'));
  const calcDesktop=Number(capture(calcHtml,/viewport\.setAttribute\('content','width=(\d+)'\)/,'Calc desktop viewport'));
  const reportDesktop=Number(capture(addJs,/if\(page==='report'\)[^]*?viewport\.setAttribute\('content','width=(\d+)'\)/,'Report desktop viewport'));
  assert.equal(calcDesktop,mainDesktop,'Calc desktop-request viewport drifted from Main');
  assert.equal(reportDesktop,mainDesktop,'Report desktop-request viewport drifted from Main');
  assert.equal(mainDesktop,1280,'suite desktop-request viewport must remain 1280px');
});

test('Main↔Add motion은 OS 설정과 분리하고 주요 화면 전환 motion contract를 유지한다',()=>{
  const productionMotionFiles=[
    ...fs.readdirSync(path.join(ROOT,'css')).filter(name=>name.endsWith('.css')).map(name=>`css/${name}`),
    ...fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js')).map(name=>`js/${name}`),
    'add/add.css','add/add.js'
  ];
  for(const file of productionMotionFiles){
    assert.doesNotMatch(read(file),/prefers-reduced-motion/i,`${file} must not couple web motion to OS reduced-motion`);
  }
  for(const prop of ['--nav-motion-shift','--nav-motion-slide-duration','--nav-motion-fade-duration']){
    assert.ok(cssProp(mainCommon,prop),`Desktop ${prop} missing`);
  }
  assert.match(mainInteraction,/\.desktop-edge-toc:hover \.desktop-edge-toc-panel\{[^}]*transition:/s,'Desktop 목차 전환 motion이 필요하다');
  assert.match(addCss,/\.custom-tooltip\{[^}]*transition:/s,'Add tooltip transition이 필요하다');
  assert.match(addCss,/\.hamburger-icon i\{[^}]*transition:/s,'Add hamburger transition이 필요하다');
});

test('Hero background와 공통 favicon은 배포에 필요한 최적화 자산만 참조한다',()=>{
  assert.match(mainCommon,/hero-bg\.webp/);
  assert.doesNotMatch(mainCommon,/hero-bg\.png/);
  assert.match(mainIndex,/rel="icon" href="img\/favicon\.png"[^>]*sizes="128x128"/);
  assert.match(calcHtml,/rel="icon" href="\.\.\/img\/favicon\.png"[^>]*sizes="128x128"/);
  assert.match(reportHtml,/rel="icon" href="\.\.\/img\/favicon\.png"[^>]*sizes="128x128"/);
  assert.equal(fs.existsSync(path.join(ROOT,'img/hero-bg.webp')),true);
  assert.equal(fs.existsSync(path.join(ROOT,'img/hero-bg.png')),false);
  assert.equal(fs.existsSync(path.join(ROOT,'favicon.png')),false,'root favicon must not return');
});

test('공통 정보 아이콘은 단일 SVG sprite와 symbol contract만 유지한다',()=>{
  const iconPath=path.join(ROOT,'img/ui-icons.svg');
  assert.equal(fs.existsSync(iconPath),true);
  const icon=fs.readFileSync(iconPath,'utf8');
  assert.match(icon,/<symbol id="info-circle"/);
});

