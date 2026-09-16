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
  // 1) Appearance protocol: storage key와 BroadcastChannel 이름은 Main/Add가 같은 통신 contract다.
  const mainTheme=capture(mainUi,/const THEME_STORAGE_KEY='([^']+)'/,'Main theme storage key');
  const mainCorner=capture(mainUi,/const CORNER_THEME_STORAGE_KEY='([^']+)'/,'Main corner storage key');
  const mainChannel=capture(mainUi,/const APPEARANCE_CHANNEL_NAME='([^']+)'/,'Main appearance channel');
  const addTheme=capture(addJs,/const THEME_KEY='([^']+)'/,'Add theme storage key');
  const addCorner=capture(addJs,/const CORNER_KEY='([^']+)'/,'Add corner storage key');
  const addChannel=capture(addJs,/const APPEARANCE_CHANNEL_NAME='([^']+)'/,'Add appearance channel');
  assert.equal(addTheme,mainTheme,'Main/Add theme storage key drifted');
  assert.equal(addCorner,mainCorner,'Main/Add corner storage key drifted');
  assert.equal(addChannel,mainChannel,'Main/Add appearance BroadcastChannel drifted');

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

test('Main↔Add motion은 OS 설정과 분리하고 웹 자체 animation/transition/smooth scroll을 유지한다',()=>{
  const productionMotionFiles=[
    ...fs.readdirSync(path.join(ROOT,'css')).filter(name=>name.endsWith('.css')).map(name=>`css/${name}`),
    ...fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js')).map(name=>`js/${name}`),
    'add/add.css',
    'add/add.js'
  ];
  for(const file of productionMotionFiles){
    assert.doesNotMatch(read(file),/prefers-reduced-motion/i,`${file} must not couple web motion to OS reduced-motion`);
  }

  const mainApp=read('js/dashboard-app.js');
  const mainCharts=read('js/dashboard-charts.js');
  assert.match(mainCommon,/@keyframes\s+chartBarSweep/);
  assert.match(mainCommon,/@keyframes\s+chartPointPop/);
  assert.match(mainCommon,/@keyframes\s+chartLineDraw/);
  assert.match(mainInteraction,/\.desktop-edge-toc:hover \.desktop-edge-toc-panel\{[^}]*transition:/s);
  assert.match(mainApp,/scrollIntoView\(\{\s*behavior:'smooth'/);
  assert.match(mainCharts,/scrollTo\(\{left:0,behavior:'smooth'\}\)/);
  assert.match(mainUi,/window\.scrollTo\(\{top:0,left:0,behavior:'smooth'\}\)/);
  assert.match(addCss,/\.custom-tooltip\{[^}]*transition:/s);
  assert.match(addCss,/html:where\(\[data-add-page="report"\]\)\{scroll-behavior:smooth\}/);
  assert.match(addCss,/\.hamburger-icon i\{[^}]*transition:/s);

  // Motion 자체의 존재와 open/closed state contract만 고정한다.
  // 거리·속도·opacity·메뉴 폭 같은 튜닝값은 정상적인 디자인 조정 대상이므로 테스트하지 않는다.
  for(const prop of ['--nav-motion-shift','--nav-motion-slide-duration','--nav-motion-fade-duration']){
    assert.ok(cssProp(mainCommon,prop),`Desktop ${prop} missing`);
  }
  const tabletRoot=cssBlock(mainTablet,':root');
  const phoneRoot=capture(mainSpecial,/\[S03\][^]*?:root\{([^}]*)\}/,'Phone Shared root');
  for(const source of [tabletRoot,phoneRoot]){
    assert.ok(cssProp(source,'--nav-motion-shift'));
    assert.ok(cssProp(source,'--nav-motion-slide-duration'));
  }
  assert.match(cssBlock(mainCommon,'.desktop-edge-toc.is-open .desktop-edge-toc-panel'),/transform:translate\(0,-50%\)/);
  assert.match(cssBlock(mainCommon,'.date-action-menu.mobile-combined-menu.show'),/transform:translateX\(0\)/);
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

