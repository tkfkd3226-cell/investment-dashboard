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

  // Navigation motion tuning: 최종 좌표는 유지하고 viewport별 시작 거리/속도/페이드만 다듬는다.
  assert.equal(cssProp(mainCommon,'--nav-motion-shift'),'40px','Desktop TOC motion shift drifted');
  assert.equal(cssProp(mainCommon,'--nav-motion-slide-duration'),'.28s','Desktop TOC slide duration drifted');
  assert.equal(cssProp(mainCommon,'--nav-motion-fade-duration'),'.10s','Desktop TOC fade duration drifted');
  assert.equal(cssProp(mainCommon,'--nav-motion-slide-delay'),'.04s','Desktop TOC slide delay drifted');
  assert.equal(cssProp(mainCommon,'--nav-motion-hide-delay'),'.38s','Desktop TOC hide delay drifted');
  assert.equal(cssProp(mainCommon,'--nav-motion-start-opacity'),'.89','Desktop TOC start opacity drifted');

  const tabletRoot=cssBlock(mainTablet,':root');
  assert.equal(cssProp(tabletRoot,'--nav-motion-shift'),'36px','Tablet hamburger motion shift drifted');
  assert.equal(cssProp(tabletRoot,'--nav-motion-slide-duration'),'.27s','Tablet hamburger slide duration drifted');
  assert.equal(cssProp(tabletRoot,'--nav-motion-fade-duration'),'.10s','Tablet hamburger fade duration drifted');
  assert.equal(cssProp(tabletRoot,'--nav-motion-slide-delay'),'.04s','Tablet hamburger slide delay drifted');
  assert.equal(cssProp(tabletRoot,'--nav-motion-hide-delay'),'.37s','Tablet hamburger hide delay drifted');
  assert.equal(cssProp(tabletRoot,'--nav-motion-start-opacity'),'.90','Tablet hamburger start opacity drifted');

  const phoneRoot=capture(mainSpecial,/\[S03\][^]*?:root\{([^}]*)\}/,'Phone Shared root');
  assert.equal(cssProp(phoneRoot,'--nav-motion-shift'),'32px','Phone hamburger motion shift drifted');
  assert.equal(cssProp(phoneRoot,'--nav-motion-slide-duration'),'.26s','Phone hamburger slide duration drifted');
  assert.equal(cssProp(phoneRoot,'--nav-motion-fade-duration'),'.09s','Phone hamburger fade duration drifted');
  assert.equal(cssProp(phoneRoot,'--nav-motion-slide-delay'),'.03s','Phone hamburger slide delay drifted');
  assert.equal(cssProp(phoneRoot,'--nav-motion-hide-delay'),'.35s','Phone hamburger hide delay drifted');
  assert.equal(cssProp(phoneRoot,'--nav-motion-start-opacity'),'.91','Phone hamburger start opacity drifted');

  // Motion tuning must not move each menu's final anchor/size.
  const desktopPanel=cssBlock(mainCommon,'.desktop-edge-toc-panel');
  assert.equal(cssProp(desktopPanel,'top'),'50%','Desktop TOC final top drifted');
  assert.equal(cssProp(desktopPanel,'right'),'44px','Desktop TOC final right drifted');
  assert.equal(cssProp(desktopPanel,'width'),'220px','Desktop TOC width drifted');
  assert.match(cssBlock(mainCommon,'.desktop-edge-toc.is-open .desktop-edge-toc-panel'),/transform:translate\(0,-50%\)/);

  const tabletMenu=cssBlock(mainTablet,'.date-action-menu.mobile-combined-menu');
  assert.equal(cssProp(tabletMenu,'top'),'calc(100% + var(--space-lg))','Tablet hamburger final top drifted');
  assert.equal(cssProp(tabletMenu,'right'),'0','Tablet hamburger final right drifted');
  assert.equal(cssProp(tabletMenu,'width'),'220px','Tablet hamburger width drifted');
  assert.match(cssBlock(mainCommon,'.date-action-menu.mobile-combined-menu.show'),/transform:translateX\(0\)/);

  const phoneMenu=capture(mainSpecial,/\[S03\][^]*?\.date-action-menu\.mobile-combined-menu\{([^}]*)\}/,'Phone hamburger menu');
  assert.equal(cssProp(phoneMenu,'top'),'calc(var(--topbar-phone-height) + var(--space-xs))','Phone hamburger final top drifted');
  assert.equal(cssProp(phoneMenu,'right'),'var(--nav-menu-phone-edge)','Phone hamburger final right drifted');
  assert.equal(cssProp(phoneMenu,'width'),'min(200px,calc(100vw - var(--nav-menu-phone-edge) - var(--nav-menu-phone-edge)))','Phone hamburger width drifted');
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
  assert.ok(fs.statSync(path.join(ROOT,'img/favicon.png')).size<100*1024,'favicon must remain lightweight');
  assert.ok(fs.statSync(path.join(ROOT,'img/hero-bg.webp')).size<100*1024,'hero background must remain lightweight');
});

test('공통 정보 아이콘은 단일 SVG sprite를 사용하고 원/i geometry를 고정한다',()=>{
  const iconPath=path.join(ROOT,'img/ui-icons.svg');
  assert.equal(fs.existsSync(iconPath),true);
  const icon=fs.readFileSync(iconPath,'utf8');
  assert.match(icon,/<symbol id="info-circle" viewBox="0 0 20 20">/);
  assert.match(icon,/<circle cx="10" cy="10" r="8\.75"/);
  assert.match(icon,/<circle cx="10" cy="6\.7" r="1"/);
  assert.match(icon,/<rect x="9" y="8\.9" width="2" height="5\.4"/);
});

