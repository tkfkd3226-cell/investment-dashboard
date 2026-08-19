import {
  PENSION_CONTRIBUTION_SAVE_CONFIG,
  account1PrincipalForDate,
  account1SourceHoldingGapForDate,
  allAvailableDates,
  cls,
  dataState,
  dayOptionLabel,
  fetchWithTimeout,
  fmt,
  isLedgerCheckDate,
  monthLabel,
  outsideCashForDate,
  pct,
  securityExcludedTransferSum,
  securityExternalContributionSum,
  securityInternalCashTransferSum,
  securityAllocationColor,
  securitiesScopeText,
  separateProfitCumulativeForDate,
  separateProfitReinvestedForDate,
  separateProfitView,
  shortDate,
  signed,
  sortSecurityItems,
  sourceExternalPrincipalForDate,
  tableCls,
  uiState,
  won
} from './dashboard-core.js';
import {
  activateDashboardDialogFocus,
  escapeHtml,
  mobileTableAssetName,
  navIconSvg,
  releaseDashboardDialogFocus,
  renderAssetContributionCard,
  renderAssetDayChangeBlock,
  renderAssetStatusBlock,
  renderAssetWeight,
  securitySymbolSwatch
} from './dashboard-ui-common.js';
import {
  drawAllCharts,
  renderCharts
} from './dashboard-charts.js';

// 메인 대시보드 일반 UI · topbar · navigation · rendering component

const THEME_STORAGE_KEY='investmentDashboard.theme';
const CORNER_THEME_STORAGE_KEY='investmentDashboard.cornerTheme';
const currentTheme=()=>document.documentElement.classList.contains('dark')?'dark':'light';
const uiRuntimeState={
  mobileTopScrollBound:false,
  sectionNavigationBound:false,
  sectionNavigationFrame:0,
  securitiesPerformanceView:'overall'
};
const mobileViewModes={
  combined:'table',
  pensionProducts:'table',
  holdings:'table',
  securitiesChange:'table',
  accounts:'table',
  pensionChange:'table'
};
const currentCornerTheme=()=>document.documentElement.classList.contains('rounded-corners')?'rounded':'soft-square';
function themeToggleIconMarkup(dark){
  return navIconSvg(dark?'sun':'moon');
}
function syncThemeControls(){
  const dark=currentTheme()==='dark';
  const nextLabel=dark?'밝은 모드로 전환':'다크 모드로 전환';
  document.querySelectorAll('[data-theme-toggle-icon]').forEach(el=>el.innerHTML=themeToggleIconMarkup(dark));
  document.querySelectorAll('[data-theme-toggle]').forEach(el=>{
    el.removeAttribute('aria-pressed');
    el.setAttribute('title',nextLabel);
    el.setAttribute('aria-label',nextLabel);
  });
}
function setTheme(theme,{redraw=true}={}){
  const dark=theme==='dark';
  document.documentElement.classList.toggle('dark',dark);
  try{localStorage.setItem(THEME_STORAGE_KEY,dark?'dark':'light')}catch(_){}
  syncThemeControls();
  if(redraw&&dataState.portfolio)drawAllCharts();
}
function toggleTheme(){setTheme(currentTheme()==='dark'?'light':'dark')}

function cornerThemeToggleIconMarkup(rounded){
  return navIconSvg(rounded?'cornerSoft':'cornerRounded');
}
function syncCornerThemeControls(){
  const rounded=currentCornerTheme()==='rounded';
  document.querySelectorAll('[data-corner-theme-toggle-icon]').forEach(el=>el.innerHTML=cornerThemeToggleIconMarkup(rounded));
  document.querySelectorAll('[data-corner-theme-toggle]').forEach(el=>{
    const nextLabel=rounded?'각진 모서리로 전환':'둥근 모서리로 전환';
    el.removeAttribute('aria-pressed');
    el.setAttribute('title',nextLabel);
    el.setAttribute('aria-label',nextLabel);
  });
}
function setCornerTheme(theme){
  const rounded=theme==='rounded';
  document.documentElement.classList.toggle('rounded-corners',rounded);
  try{localStorage.setItem(CORNER_THEME_STORAGE_KEY,rounded?'rounded':'soft-square')}catch(_){}
  syncCornerThemeControls();
}
function toggleCornerTheme(){setCornerTheme(currentCornerTheme()==='rounded'?'soft-square':'rounded')}



const separateProfitToggle=()=>`<button type="button" class="section-control-chip section-action-chip separate-profit-toggle ${uiState.includeSeparateProfit?'active':''}" aria-pressed="${uiState.includeSeparateProfit}" data-dashboard-action="toggle-separate-profit"><span>별도수익</span><strong>${uiState.includeSeparateProfit?'ON':'OFF'}</strong></button>`;
const separateProfitControl=(x,extraClass='')=>{
  if(!uiState.personalViewUnlocked)return '';
  const profit=separateProfitCumulativeForDate(x.date);
  const note=uiState.includeSeparateProfit?`<span class="separate-profit-control-note">선택일 ${signed(profit,'원')}</span>`:'';
  return `<div class="separate-profit-control-row${extraClass?' '+extraClass:''}">${note}${separateProfitToggle()}</div>`;
};
const TOPBAR_ACTION_ICONS=Object.freeze({
  kospiNight:'activity',
  nasdaqFutures:'link',
  krxUpdate:'refresh',
  pensionAdjust:'wallet',
  calculator:'calculator'
});
function hydrateSectionTitleIcons(root=document){
  root?.querySelectorAll?.('[data-section-title-icon]').forEach(el=>{
    el.innerHTML=navIconSvg(el.dataset.sectionTitleIcon||'list');
  });
}
function renderUnifiedMobileMenuContent(){
  const groups=[
    {
      label:'링크',
      items:[
        {type:'link',url:'https://esignal.co.kr/kospi200-futures-night/',icon:TOPBAR_ACTION_ICONS.kospiNight,title:'코스피200 야간선물'},
        {type:'link',url:'https://esignal.co.kr/nasdaq100-futures/',icon:TOPBAR_ACTION_ICONS.nasdaqFutures,title:'나스닥100 선물'}
      ]
    },
    {
      label:'관리',
      items:[
        {type:'action',action:'krx-update',icon:TOPBAR_ACTION_ICONS.krxUpdate,title:'KRX 현재가 반영'},
        {type:'action',action:'open-pension-modal',icon:TOPBAR_ACTION_ICONS.pensionAdjust,title:'퇴직연금 금액 조정'},
        ...(uiState.personalViewUnlocked?[{type:'link',url:'add/calc.html',icon:TOPBAR_ACTION_ICONS.calculator,title:'투자 계산기'}]:[])
      ]
    },
    {
      label:'전체',
      items:[
        {type:'section',id:'summary-section',icon:'home',title:'연금+계좌 성과'}
      ]
    },
    {
      label:'증권계좌',
      items:[
        {type:'section',id:'securities-section',icon:'chart',title:'증권계좌 성과 요약'},
        {type:'section',id:'securities-holdings',icon:'folder',title:'보유종목 현황'},
        {type:'section',id:'securities-change',icon:'trending',title:'전일 대비 변동'},
        {type:'section',id:'chart-cum',icon:'lineChart',title:'누적손익 및 누적수익률'},
        {type:'section',id:'chart-symbol',icon:'barChart',title:'종목별 누적손익'},
        {type:'section',id:'chart-alloc',icon:'pie',title:'평가금액 비중'},
        {type:'section',id:'ledger-check',icon:'search',title:'장부결과 VS 실제보유'},
        ...(isLedgerCheckDate(dataState.activeDate)?[{type:'section',id:'capital-source-check',icon:'receipt',title:'투자원금 원천 및 검산'}]:[])
      ]
    },
    {
      label:'퇴직연금',
      items:[
        {type:'section',id:'pension-section',icon:'chart',title:'퇴직연금 성과 요약'},
        {type:'section',id:'pension-products',icon:'package',title:'연금상품별 현황'},
        {type:'section',id:'pension-change',icon:'trending',title:'전일 대비 변동'},
        {type:'section',id:'pension-chart-cum',icon:'lineChart',title:'운용손익 및 운용수익률'},
        {type:'section',id:'pension-chart-symbol',icon:'barChart',title:'연금상품별 운용손익'},
        {type:'section',id:'pension-chart-alloc',icon:'pie',title:'평가금액 비중'}
      ]
    }
  ];
  return groups.map(group=>`<div class="mobile-nav-group"><p>${group.label}</p>${group.items.map((item,idx)=>{
    const inner=`<span class="nav-icon">${navIconSvg(item.icon)}</span><span><strong>${item.title}</strong></span>`;
    const cls=`mobile-nav-item ${idx?'sub':''}`;
    if(item.type==='link') return `<a class="${cls}" href="${item.url}" target="_blank" rel="noopener noreferrer" draggable="false" data-dashboard-action="close-date-menu">${inner}</a>`;
    if(item.type==='action') return `<button type="button" class="${cls}" data-dashboard-action="${item.action}">${inner}</button>`;
    return `<button type="button" class="${cls}" data-dashboard-action="jump-section" data-section-target="${item.id}" data-close-date-menu="true">${inner}</button>`;
  }).join('')}</div>`).join('');
}
function renderDesktopTocContent(){
  const groups=[
    {
      label:'전체',
      items:[
        {id:'summary-section',icon:'home',title:'연금+계좌 성과'}
      ]
    },
    {
      label:'증권계좌',
      items:[
        {id:'securities-section',icon:'chart',title:'증권계좌 성과 요약'},
        {id:'securities-holdings',icon:'folder',title:'보유종목 현황'},
        {id:'securities-change',icon:'trending',title:'전일 대비 변동'},
        {id:'chart-cum',icon:'lineChart',title:'누적손익 및 누적수익률'},
        {id:'chart-symbol',icon:'barChart',title:'종목별 누적손익'},
        {id:'chart-alloc',icon:'pie',title:'평가금액 비중'},
        {id:'ledger-check',icon:'search',title:'장부결과 VS 실제보유'},
        ...(isLedgerCheckDate(dataState.activeDate)?[{id:'capital-source-check',icon:'receipt',title:'투자원금 원천 및 검산'}]:[])
      ]
    },
    {
      label:'퇴직연금',
      items:[
        {id:'pension-section',icon:'chart',title:'퇴직연금 성과 요약'},
        {id:'pension-products',icon:'package',title:'연금상품별 현황'},
        {id:'pension-change',icon:'trending',title:'전일 대비 변동'},
        {id:'pension-chart-cum',icon:'lineChart',title:'운용손익 및 운용수익률'},
        {id:'pension-chart-symbol',icon:'barChart',title:'연금상품별 운용손익'},
        {id:'pension-chart-alloc',icon:'pie',title:'평가금액 비중'}
      ]
    }
  ];
  return groups.map(group=>`<div class="desktop-edge-toc-group"><p>${group.label}</p>${group.items.map(item=>`<button type="button" class="desktop-edge-toc-item" data-toc-target="${item.id}" data-dashboard-action="jump-section" data-section-target="${item.id}"><span class="desktop-edge-toc-icon">${navIconSvg(item.icon)}</span><span>${item.title}</span></button>`).join('')}</div>`).join('');
}
function ensureDesktopEdgeToc(){
  let toc=document.getElementById('desktopEdgeToc');
  if(!toc){
    toc=document.createElement('aside');
    toc.id='desktopEdgeToc';
    toc.className='desktop-edge-toc';
    toc.setAttribute('aria-label','화면 목차');
    document.body.appendChild(toc);
  }
  toc.innerHTML=`<button type="button" id="desktopEdgeTocTrigger" class="desktop-edge-toc-trigger" aria-label="목차" aria-controls="desktopEdgeTocPanel" aria-expanded="false" title="목차 열기" data-dashboard-action="toggle-desktop-toc"><span>목차</span></button><nav id="desktopEdgeTocPanel" class="desktop-edge-toc-panel" aria-label="페이지 내 목차"><div class="desktop-edge-toc-title"><span>목차</span></div>${renderDesktopTocContent()}</nav>`;
}
function setDesktopEdgeTocOpen(open,{focusTrigger=false}={}){
  const toc=document.getElementById('desktopEdgeToc');
  const trigger=document.getElementById('desktopEdgeTocTrigger');
  if(!toc||!trigger)return;
  const next=!!open&&window.matchMedia?.('(min-width:761px)').matches!==false;
  toc.classList.toggle('is-open',next);
  trigger.setAttribute('aria-expanded',String(next));
  trigger.setAttribute('title',next?'목차 닫기':'목차 열기');
  if(focusTrigger)trigger.focus();
}
function toggleDesktopEdgeToc(){
  const toc=document.getElementById('desktopEdgeToc');
  setDesktopEdgeTocOpen(!toc?.classList.contains('is-open'));
}
function closeDesktopEdgeToc(options){setDesktopEdgeTocOpen(false,options)}

function visibleSectionNavigationTargets(){
  const ids=[...document.querySelectorAll('[data-dashboard-action="jump-section"][data-section-target]')]
    .map(control=>control.dataset.sectionTarget)
    .filter((id,index,all)=>id&&all.indexOf(id)===index);
  return ids.map(id=>document.getElementById(id)).filter(el=>el&&el.getClientRects().length);
}
function setSectionNavigationCurrent(id){
  document.querySelectorAll('[data-dashboard-action="jump-section"][data-section-target]').forEach(control=>{
    const current=!!id&&control.dataset.sectionTarget===id;
    control.classList.toggle('is-current',current);
    if(current)control.setAttribute('aria-current','location');
    else control.removeAttribute('aria-current');
  });
}
function currentSectionNavigationId(){
  const sections=visibleSectionNavigationTargets();
  if(!sections.length)return '';
  const threshold=window.matchMedia?.('(max-width:760px)').matches?64:96;
  let passed=null,below=null;
  sections.forEach(section=>{
    const top=section.getBoundingClientRect().top;
    if(top<=threshold){
      if(!passed||top>passed.top)passed={id:section.id,top};
    }else if(!below||top<below.top){
      below={id:section.id,top};
    }
  });
  return passed?.id||below?.id||sections[0].id;
}
function syncSectionNavigationState(forcedId=''){
  setSectionNavigationCurrent(forcedId||currentSectionNavigationId());
}
function scheduleSectionNavigationSync(){
  if(uiRuntimeState.sectionNavigationFrame)return;
  uiRuntimeState.sectionNavigationFrame=requestAnimationFrame(()=>{
    uiRuntimeState.sectionNavigationFrame=0;
    syncSectionNavigationState();
  });
}
function setupSectionNavigationTracking(){
  if(!uiRuntimeState.sectionNavigationBound){
    uiRuntimeState.sectionNavigationBound=true;
    window.addEventListener('scroll',scheduleSectionNavigationSync,{passive:true});
    window.addEventListener('resize',()=>{
      scheduleSectionNavigationSync();
      if(window.matchMedia?.('(max-width:760px)').matches)closeDesktopEdgeToc();
    },{passive:true});
    document.addEventListener('click',event=>{
      const toc=document.getElementById('desktopEdgeToc');
      if(toc?.classList.contains('is-open')&&!event.target.closest('#desktopEdgeToc'))closeDesktopEdgeToc();
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape'||!event.target.closest?.('#desktopEdgeToc'))return;
      const toc=document.getElementById('desktopEdgeToc');
      if(!toc?.classList.contains('is-open'))return;
      event.preventDefault();
      closeDesktopEdgeToc({focusTrigger:true});
    });
  }
  syncSectionNavigationState();
}
const MOBILE_DATE_PIN_STORAGE_KEY='investmentDashboard.mobileDatePinned';
function mobileDatePinned(){
  try{return localStorage.getItem(MOBILE_DATE_PIN_STORAGE_KEY)==='1'}catch(_){return false}
}
function syncMobileTopbarState(){
  const tabs=document.getElementById('tabs');
  const toggle=document.getElementById('mobileDatePinToggle');
  const mobile=window.matchMedia?.('(max-width:760px)').matches===true;
  const pinned=mobileDatePinned();
  if(tabs)tabs.classList.toggle('mobile-date-pinned',mobile&&pinned);
  if(toggle){
    toggle.checked=pinned;
    toggle.setAttribute('aria-checked',String(pinned));
  }
  const visible=!!(mobile&&tabs&&(tabs.classList.contains('mobile-menu-open')||pinned));
  document.body.classList.toggle('mobile-topbar-fixed-visible',visible);
}
function setMobileDatePinned(pinned){
  try{localStorage.setItem(MOBILE_DATE_PIN_STORAGE_KEY,pinned?'1':'0')}catch(_){}
  syncMobileTopbarState();
}
function renderTabs(){
  const dates=allAvailableDates(),months=[...new Set(dates.map(d=>d.slice(0,7)))],activeMonth=dataState.activeDate.slice(0,7),monthDates=dates.filter(d=>d.startsWith(activeMonth));
  document.getElementById('tabs').innerHTML=`
    <div class="date-picker">
      <div class="date-picker-center" role="group" aria-label="기준일 선택">
        <select class="date-select month-select" id="monthSelect" aria-label="월 선택" aria-controls="app">${months.map(m=>`<option value="${m}" ${m===activeMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}</select>
        <select class="date-select day-select" id="dateSelect" aria-label="일 선택" aria-controls="app">${monthDates.map(d=>`<option value="${d}" ${d===dataState.activeDate?'selected':''}>${dayOptionLabel(d)}</option>`).join('')}</select>
      </div>
      <div class="date-picker-action" role="group" aria-label="대시보드 도구">
        <a class="date-tool-btn market-link-btn market-link-btn-desktop date-tool-btn-desktop topbar-market-action" href="https://esignal.co.kr/kospi200-futures-night/" target="_blank" rel="noopener noreferrer" draggable="false" title="코스피200 야간선물">
          <span class="date-tool-action-icon">${navIconSvg(TOPBAR_ACTION_ICONS.kospiNight)}</span><span class="topbar-label-full">코스피200 야간선물</span><span class="topbar-label-short">코스피 야선</span>
        </a>
        <a class="date-tool-btn market-link-btn market-link-btn-desktop date-tool-btn-desktop topbar-market-action" href="https://esignal.co.kr/nasdaq100-futures/" target="_blank" rel="noopener noreferrer" draggable="false" title="나스닥100 선물">
          <span class="date-tool-action-icon">${navIconSvg(TOPBAR_ACTION_ICONS.nasdaqFutures)}</span><span class="topbar-label-full">나스닥100 선물</span><span class="topbar-label-short">나스닥 선물</span>
        </a>
        <button type="button" class="date-tool-btn date-tool-btn-desktop topbar-krx-action" title="KRX 현재가 반영" aria-label="KRX 현재가 반영" data-dashboard-action="krx-update">
          <span class="date-tool-action-icon">${navIconSvg(TOPBAR_ACTION_ICONS.krxUpdate)}</span><span class="topbar-label-full">KRX 현재가 반영</span><span class="topbar-label-short">KRX 반영</span>
        </button>
        <button type="button" class="date-tool-btn date-tool-btn-desktop topbar-pension-action" title="퇴직연금 금액 조정" aria-label="퇴직연금 금액 조정" data-dashboard-action="open-pension-modal">
          <span class="date-tool-action-icon">${navIconSvg(TOPBAR_ACTION_ICONS.pensionAdjust)}</span><span class="topbar-label-full">퇴직연금 금액 조정</span><span class="topbar-label-short">연금 조정</span>
        </button>
        ${uiState.personalViewUnlocked?`<a class="date-tool-btn date-tool-btn-desktop topbar-calc-action" href="add/calc.html" target="_blank" rel="noopener noreferrer" draggable="false" title="투자 계산기" aria-label="투자 계산기">
          <span class="date-tool-action-icon">${navIconSvg(TOPBAR_ACTION_ICONS.calculator)}</span><span class="topbar-label-full">투자 계산기</span><span class="topbar-label-short">계산기</span>
        </a>`:''}
        <button type="button" class="date-tool-btn topbar-theme-action" data-theme-toggle title="${currentTheme()==='dark'?'밝은 모드로 전환':'다크 모드로 전환'}" aria-label="${currentTheme()==='dark'?'밝은 모드로 전환':'다크 모드로 전환'}" data-dashboard-action="toggle-theme">
          <span class="date-tool-action-icon" data-theme-toggle-icon>${themeToggleIconMarkup(currentTheme()==='dark')}</span>
        </button>
        <button type="button" class="date-tool-btn topbar-corner-action" data-corner-theme-toggle title="${currentCornerTheme()==='rounded'?'각진 모서리로 전환':'둥근 모서리로 전환'}" aria-label="${currentCornerTheme()==='rounded'?'각진 모서리로 전환':'둥근 모서리로 전환'}" data-dashboard-action="toggle-corner-theme">
          <span class="date-tool-action-icon" data-corner-theme-toggle-icon>${cornerThemeToggleIconMarkup(currentCornerTheme()==='rounded')}</span>
        </button>
        <div class="date-action-menu-wrap">
          <button type="button" id="dateActionMenuButton" class="date-tool-btn date-tool-menu-btn" title="목차" aria-label="목차" aria-haspopup="true" aria-controls="dateActionMenu" aria-expanded="false" data-dashboard-action="toggle-date-menu"><span class="date-tool-icon">${navIconSvg('menu')}</span><span class="date-tool-menu-label">목차</span></button>
          <div id="dateActionMenu" class="date-action-menu mobile-combined-menu" aria-label="화면 목차"><div class="mobile-nav-head"><div class="mobile-nav-head-title"><span>목차</span></div><label class="mobile-date-pin-control" for="mobileDatePinToggle"><span>날짜 선택 고정</span><input type="checkbox" id="mobileDatePinToggle" role="switch" ${mobileDatePinned()?'checked':''} data-dashboard-change="mobile-date-pin"><span class="mobile-date-pin-track" aria-hidden="true"><span></span></span></label><button type="button" data-dashboard-action="close-date-menu" aria-label="목차 닫기">${navIconSvg('close')}</button></div>${renderUnifiedMobileMenuContent()}</div>
        </div>
      </div>
    </div>`;
  syncMobileTopbarState();
}
function metricCard(label,value,sub,dark=false,vcls='',mobileSub=''){const accessibleLabel=escapeHtml(String(label||'').replace(/<[^>]*>/g,'').trim()),subContent=mobileSub?`<span class="metric-sub-default">${sub}</span><span class="metric-sub-mobile">${mobileSub}</span>`:sub;return `<article class="card metric-card ${dark?'dark':''}" aria-label="${accessibleLabel}"><div class="label">${label}</div><div class="value ${vcls}">${value}</div><div class="sub">${subContent}</div></article>`}

function mobileViewAttrs(key){
  const mode=mobileViewModes[key]||'card';
  return `data-mobile-view-key="${key}" data-mobile-view="${mode}"`;
}
const MOBILE_VIEW_META=Object.freeze({
  holdings:{label:'보유종목 현황',controls:'securities-holdings-table-view securities-holdings-card-view'},
  securitiesChange:{label:'전일 대비 변동',controls:'securities-change-table-view securities-change-card-view'},
  combined:{label:'연금+계좌 성과',controls:'combined-table-view combined-card-view'},
  accounts:{label:'계좌별 성과 요약',controls:'accounts-table-view accounts-card-view'},
  pensionProducts:{label:'퇴직연금 상품별 현황',controls:'pension-products-table-view pension-products-card-view'},
  pensionChange:{label:'전일 대비 변동',controls:'pension-change-table-view pension-change-card-view'}
});
function mobileViewToggle(key){
  const mode=mobileViewModes[key]||'card';
  const action=mode==='card'?'표 보기':'카드 보기';
  const meta=MOBILE_VIEW_META[key]||{label:'데이터 보기',controls:''};
  return `<button type="button" class="section-control-chip section-action-chip mobile-view-toggle" data-mobile-view-button="${key}" data-dashboard-action="toggle-mobile-view" data-mobile-view-key="${key}" aria-label="${meta.label} ${action}"${meta.controls?` aria-controls="${meta.controls}"`:''}>${action}</button>`;
}
function toggleMobileDataView(key){
  const current=mobileViewModes[key]||'card';
  const next=current==='card'?'table':'card';
  mobileViewModes[key]=next;
  document.querySelectorAll(`[data-mobile-view-key="${key}"]`).forEach(el=>el.dataset.mobileView=next);
  const meta=MOBILE_VIEW_META[key]||{label:'데이터 보기'};
  const action=next==='card'?'표 보기':'카드 보기';
  document.querySelectorAll(`[data-mobile-view-button="${key}"]`).forEach(btn=>{
    btn.textContent=action;
    btn.setAttribute('aria-label',`${meta.label} ${action}`);
  });
}
function mobileInfoCard(title,items=[],extraClass='',accessibleLabel=''){
  const accessibleTitle=escapeHtml(String(accessibleLabel||title||'').replace(/<[^>]*>/g,'').replace(/■/g,'').trim());
  return `<article class="mobile-data-card ${extraClass}" aria-label="${accessibleTitle}"><div class="mobile-data-card-title">${title}</div><div class="mobile-data-card-list">${items.map(item=>{const [label,value,valueClass='',rowClass='']=item;return `<div class="mobile-data-card-row ${rowClass}"><span class="mobile-data-card-label">${label}</span><span class="mobile-data-card-value ${valueClass}">${value}</span></div>`}).join('')}</div></article>`;
}

function scrollToDashboardTop(){
  window.scrollTo({top:0,left:0,behavior:'smooth'});
}
function ensureMobileTopButton(){
  let button=document.getElementById('mobileTopButton');
  if(!button){
    button=document.createElement('button');
    button.id='mobileTopButton';
    button.type='button';
    button.className='mobile-top-button';
    button.innerHTML=`${navIconSvg('arrowUp')}<span>TOP</span>`;
    button.setAttribute('aria-label','화면 맨 위로 이동');
    button.addEventListener('click',scrollToDashboardTop);
    document.body.appendChild(button);
  }
  const update=()=>button.classList.toggle('show',(window.scrollY||document.documentElement.scrollTop||0)>220);
  if(!uiRuntimeState.mobileTopScrollBound){
    uiRuntimeState.mobileTopScrollBound=true;
    window.addEventListener('scroll',update,{passive:true});
  }
  update();
}

function closeDateActionMenu(){
  const menu=document.getElementById('dateActionMenu');
  const tabs=document.getElementById('tabs');
  const button=document.getElementById('dateActionMenuButton');
  if(menu) menu.classList.remove('show');
  if(tabs) tabs.classList.remove('mobile-menu-open');
  if(button) button.setAttribute('aria-expanded','false');
  syncMobileTopbarState();
}
function toggleDateActionMenu(event){
  if(event){event.preventDefault();event.stopPropagation();}
  const menu=document.getElementById('dateActionMenu');
  const tabs=document.getElementById('tabs');
  const button=document.getElementById('dateActionMenuButton');
  if(!menu) return;
  const shouldOpen=!menu.classList.contains('show');
  menu.classList.toggle('show',shouldOpen);
  if(tabs) tabs.classList.toggle('mobile-menu-open',shouldOpen);
  if(button) button.setAttribute('aria-expanded',String(shouldOpen));
  syncMobileTopbarState();
}
function mobileDateMenuIsOpen(){
  return window.matchMedia('(max-width:760px)').matches&&document.getElementById('dateActionMenu')?.classList.contains('show');
}
function restoreMobileDateMenuAfterRender(){
  document.getElementById('tabs')?.classList.add('mobile-menu-open');
  document.getElementById('dateActionMenu')?.classList.add('show');
  document.getElementById('dateActionMenuButton')?.setAttribute('aria-expanded','true');
  syncMobileTopbarState();
}
function setupUiGlobalEvents(){
  document.addEventListener('click',e=>{
    if(!e.target.closest('#tabs'))closeDateActionMenu();
    if(!e.target.closest('#accounts-summary .accounts-memo-info-button'))closeAccountMemoInfo();
  });
  document.addEventListener('change',closeAccountMemoInfo);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeAccountMemoInfo();
  });
  window.addEventListener('scroll',closeAccountMemoInfo,{passive:true});
  window.addEventListener('resize',()=>{
    closeAccountMemoInfo();
    syncMobileTopbarState();
  },{passive:true});
}
async function dispatchKrxPriceUpdate(pin, mode='selected'){
  const config=PENSION_CONTRIBUTION_SAVE_CONFIG.githubPages;
  const selectedDate=dataState.activeDate || '';
  const updateMode=mode==='auto'?'auto':'selected';

  if(!config.url || config.url.includes('여기에_')){
    throw new Error('Apps Script URL이 설정되지 않았습니다.');
  }

  const body={
    pin:String(pin||'').trim(),
    action:'updateKrxPrices'
  };

  // selected 모드: 재갱신 요청으로 현재 화면 기준일을 body.date에 명시한다.
  // auto 모드: body.date를 보내지 않아 서버가 최신/누락 여부와 종가 반영 상태를 판단한다.
  // 이미 종가가 반영된 경우 서버측 조건에 따라 워크플로 실행을 건너뛴다.
  if(updateMode==='selected'){
    body.date=selectedDate;
  }

  const res=await fetchWithTimeout(config.url,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(body)
  });

  const data=await res.json().catch(()=>({}));

  if(!data.ok){
    throw new Error(data.error||'KRX 현재가 반영 요청 실패');
  }

  return data;
}
function ensureAppToast(){
  let toast=document.getElementById('appToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='appToast';
    toast.className='app-toast';
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    toast.setAttribute('aria-atomic','true');
    document.body.appendChild(toast);
  }
  return toast;
}
function showAppToast(message,type='ok',delay=3500){
  const toast=ensureAppToast();
  toast.className=`app-toast show ${type==='err'?'err':'ok'}`;
  toast.textContent=message;
  clearTimeout(showAppToast._timer);
  showAppToast._timer=setTimeout(()=>toast.classList.remove('show'),delay);
}
function ensureKrxActionModal(){
  let modal=document.getElementById('krxActionModal');
  if(modal) return modal;
  modal=document.createElement('div');
  modal.id='krxActionModal';
  modal.className='action-modal krx-action-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="action-modal-card krx-action-card" role="dialog" aria-modal="true" aria-labelledby="krxActionTitle">
    <button type="button" class="modal-icon-btn krx-action-close" data-dashboard-action="close-krx-modal" aria-label="닫기">${navIconSvg('close')}</button>
    <h3 id="krxActionTitle" class="modal-main-title">KRX 현재가 반영</h3>
    <p id="krxActionDescription" class="action-modal-description">최신/누락 반영은 오늘 데이터와 누락 거래일을 생성·보완하고, 재갱신은 선택된 날짜를 확인해 종가 기준이 아니면 다시 반영합니다.</p>
    <label class="action-modal-label krx-action-label" for="krxActionPin">저장/실행 PIN</label>
    <input id="krxActionPin" class="action-modal-input" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN 6자리 입력" aria-describedby="krxActionDescription krxActionEnterHelp krxActionStatus" aria-invalid="false">
    <p id="krxActionEnterHelp" class="action-modal-input-help">Enter 시 재갱신됩니다.</p>
    <div id="krxActionStatus" class="action-modal-status krx-action-status" role="status" aria-live="polite" aria-atomic="true"></div>
    <div class="action-modal-buttons krx-action-buttons">
      <button type="button" class="action-modal-btn ghost" data-dashboard-action="close-krx-modal">취소</button>
      <button type="button" class="action-modal-btn ghost" data-dashboard-action="submit-krx-modal" data-krx-mode="auto">최신/누락 반영</button>
      <button type="button" class="action-modal-btn primary" data-dashboard-action="submit-krx-modal" data-krx-mode="selected">재갱신</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeKrxActionModal()});
  modal.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    e.preventDefault();
    e.stopPropagation();
    closeKrxActionModal();
  });
  const pinInput=modal.querySelector('#krxActionPin');
  pinInput?.addEventListener('input',()=>{
    const cleaned=String(pinInput.value||'').replace(/\D/g,'').slice(0,6);
    if(pinInput.value!==cleaned)pinInput.value=cleaned;
    pinInput.setAttribute('aria-invalid','false');
    const pinStatus=modal.querySelector('#krxActionStatus');
    if(pinStatus?.classList.contains('err')){pinStatus.textContent='';pinStatus.className='action-modal-status krx-action-status'}
  });
  pinInput?.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    e.preventDefault();
    submitKrxActionModal('selected');
  });
  return modal;
}
function openKrxActionModal(){
  const modal=ensureKrxActionModal();
  const status=modal.querySelector('#krxActionStatus');
  const input=modal.querySelector('#krxActionPin');
  if(status){status.textContent='';status.className='action-modal-status krx-action-status'}
  input?.setAttribute('aria-invalid','false');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  activateDashboardDialogFocus(modal,{initialFocus:input,fallbackSelector:'[data-dashboard-action="krx-update"]'});
}

function forceMobileViewportReflow(){
  const y=window.scrollY||document.documentElement.scrollTop||0;
  if(document.activeElement&&typeof document.activeElement.blur==='function'){
    document.activeElement.blur();
  }
  setTimeout(()=>{
    window.scrollTo({top:y,left:0,behavior:'auto'});
    window.scrollBy(0,1);
    window.scrollBy(0,-1);
    document.body.style.transform='translateZ(0)';
    requestAnimationFrame(()=>{
      document.body.style.transform='';
      window.dispatchEvent(new Event('resize'));
    });
  },120);
}

function closeKrxActionModal(){
  const modal=document.getElementById('krxActionModal');
  if(modal){
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    releaseDashboardDialogFocus(modal,{fallbackSelector:'[data-dashboard-action="krx-update"]'});
  }
  forceMobileViewportReflow();
}
async function submitKrxActionModal(mode='selected'){
  const modal=ensureKrxActionModal();
  const input=modal.querySelector('#krxActionPin');
  const status=modal.querySelector('#krxActionStatus');
  const buttons=modal.querySelectorAll('.krx-action-buttons button');
  const pin=String(input?.value||'').replace(/\D/g,'').slice(0,6);
  const updateMode=mode==='auto'?'auto':'selected';
  const selectedDate=dataState.activeDate || '';
  if(pin.length!==6){
    input?.setAttribute('aria-invalid','true');
    if(status){status.textContent='PIN 6자리를 입력해 주세요.';status.className='action-modal-status krx-action-status err'}
    input?.focus();
    return;
  }
  input?.setAttribute('aria-invalid','false');
  try{
    buttons.forEach(btn=>btn.disabled=true);
    if(status){
      status.textContent=updateMode==='selected'
        ? `${selectedDate} KRX 현재가 재갱신 요청 중...`
        : '최신/누락 KRX 현재가 반영 요청 중...';
      status.className='action-modal-status krx-action-status ok';
    }
    const data = await dispatchKrxPriceUpdate(pin, updateMode);

    if(data.action === 'workflow_skipped'){
      const msg = data.message || '업데이트할 KRX 현재가 데이터가 없습니다.';
      if(status){status.textContent=msg;status.className='action-modal-status krx-action-status ok'}
      showAppToast(msg, 'ok', 6500);
      return;
    }

    const successMsg=updateMode==='selected'
      ? `${selectedDate} KRX 현재가 재갱신 요청 완료.`
      : '최신/누락 KRX 현재가 반영 요청 완료.';
    if(status){status.textContent=successMsg;status.className='action-modal-status krx-action-status ok'}
    showAppToast(updateMode==='selected'?'선택일 KRX 재갱신 요청 완료':'KRX 자동 반영 요청 완료', 'ok');
    setTimeout(closeKrxActionModal,2000);
  }catch(e){
    if(status){status.textContent=e.message||String(e);status.className='action-modal-status krx-action-status err'}
  }finally{
    buttons.forEach(btn=>btn.disabled=false);
  }
}
async function triggerKrxPriceUpdate(){
  closeDateActionMenu();
  openKrxActionModal();
}

function syncAssetTabs(){
  document.querySelectorAll('[data-asset-tab]').forEach(button=>{
    const active=button.dataset.assetTab===uiState.activeAssetTab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
  });
  document.querySelectorAll('[data-asset-panel]').forEach(panel=>{
    const active=panel.dataset.assetPanel===uiState.activeAssetTab;
    panel.hidden=!active;
    panel.setAttribute('aria-hidden',String(!active));
  });
}
function setAssetTab(tab,{scroll=false}={}){
  if(!['securities','pension'].includes(tab))return;
  uiState.activeAssetTab=tab;
  syncAssetTabs();
  requestAnimationFrame(()=>{
    drawAllCharts();
    syncSectionNavigationState();
    if(scroll)document.getElementById('asset-workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
}
function handleAssetTabKeydown(event,currentTab){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return false;
  const tablist=currentTab.closest('[role="tablist"]');
  const tabs=[...tablist?.querySelectorAll('[role="tab"][data-asset-tab]')||[]];
  const currentIndex=tabs.indexOf(currentTab);
  if(currentIndex<0||!tabs.length)return false;
  let nextIndex=currentIndex;
  if(event.key==='Home')nextIndex=0;
  else if(event.key==='End')nextIndex=tabs.length-1;
  else if(event.key==='ArrowLeft')nextIndex=(currentIndex-1+tabs.length)%tabs.length;
  else if(event.key==='ArrowRight')nextIndex=(currentIndex+1)%tabs.length;
  event.preventDefault();
  const next=tabs[nextIndex];
  setAssetTab(next.dataset.assetTab||'securities');
  next.focus();
  return true;
}
function assetTabForTarget(id){
  const el=document.getElementById(id);
  return el?.closest?.('[data-asset-panel]')?.dataset?.assetPanel||null;
}
function jumpToSection(id){
  const targetTab=assetTabForTarget(id);
  if(targetTab&&targetTab!==uiState.activeAssetTab)setAssetTab(targetTab);
  setSectionNavigationCurrent(id);
  requestAnimationFrame(()=>{
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  });
}

function sectionToSecuritiesBlock(html, extraClass=''){
  if(!html) return '';
  return html
    .replace(/^<section([^>]*)>/, (_, attrs='')=>{
      const idMatch=attrs.match(/\sid="([^"]*)"/);
      const classMatch=attrs.match(/\sclass="([^"]*)"/);
      const idAttr=idMatch?` id="${idMatch[1]}"`:'';
      const classes=['securities-subsection',extraClass,classMatch?classMatch[1]:''].filter(Boolean).join(' ');
      const otherAttrs=attrs
        .replace(/\sid="[^"]*"/,'')
        .replace(/\sclass="[^"]*"/,'');
      return `<div${idAttr} class="${classes}"${otherAttrs}>`;
    })
    .replace(/<\/section>\s*$/, '</div>');
}
function renderSecuritiesSummaryCards(x,{hidden=false}={}){
  const securitiesScope=securitiesScopeText(x),v=separateProfitView(x),separateProfitOn=uiState.includeSeparateProfit;
  const principalNote=separateProfitOn?'전체 투입원금 + 원천·보유 차액 | 별도 수익 재투입 670만 원 제외':'전체 투입원금 + 보유 자금 투입 670만 원 + 원천·보유 차액';
  const principalMobileNote=separateProfitOn?'전체 투입원금 + 차액 | 670만 원 제외':'전체 투입원금 + 670만 원 + 차액';
  const returnNote='누적손익 ÷ 투입원금';
  return `<div id="securities-overall-summary"${hidden?' hidden':''}><div class="grid cards metric-grid">${metricCard('투자 결과물',won(v.totalResult),securitiesScope,true)}${metricCard('투입원금',won(v.totalPrincipal),principalNote,false,'',principalMobileNote)}${metricCard('누적손익',won(v.totalProfit),'투자 결과물 - 투입원금',false,cls(v.totalProfit))}${metricCard('누적수익률',pct(v.totalReturn),returnNote,false,cls(v.totalReturn))}</div></div>`;
}
function securitiesPerformanceViewSwitch(){
  const mode=uiRuntimeState.securitiesPerformanceView;
  return `<div class="chart-compare-toggle securities-performance-toggle" role="group" aria-label="증권 성과 요약 표시 기준"><button type="button" class="${mode==='overall'?'active':''}" data-securities-performance-view="overall" data-dashboard-action="set-securities-performance-view" aria-pressed="${mode==='overall'}" aria-controls="securities-overall-summary">전체</button><button type="button" class="${mode==='accounts'?'active':''}" data-securities-performance-view="accounts" data-dashboard-action="set-securities-performance-view" aria-pressed="${mode==='accounts'}" aria-controls="accounts-summary">계좌별</button></div>`;
}
function setSecuritiesPerformanceView(mode='overall'){
  const next=mode==='accounts'?'accounts':'overall';
  uiRuntimeState.securitiesPerformanceView=next;
  document.querySelectorAll('[data-securities-performance-view]').forEach(button=>{
    const active=button.dataset.securitiesPerformanceView===next;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  document.getElementById('securities-overall-summary')?.toggleAttribute('hidden',next!=='overall');
  document.getElementById('accounts-summary')?.toggleAttribute('hidden',next!=='accounts');
  const accountsViewToggle=document.querySelector('[data-accounts-view-toggle-wrap]');
  if(accountsViewToggle)accountsViewToggle.hidden=next!=='accounts';
  if(next!=='accounts')closeAccountMemoInfo();
}
function renderSecuritiesPerformanceSummary(x){
  const accountsMode=uiRuntimeState.securitiesPerformanceView==='accounts';
  return `<div class="securities-subsection securities-summary-block asset-overview"><div class="section-title"><h3><span class="section-title-icon" data-section-title-icon="chart" aria-hidden="true"></span>성과 요약</h3><div class="chart-head-actions">${separateProfitControl(x,'section-inline')}${securitiesPerformanceViewSwitch()}<span data-accounts-view-toggle-wrap${accountsMode?'':' hidden'}>${mobileViewToggle('accounts')}</span></div></div>${renderSecuritiesSummaryCards(x,{hidden:accountsMode})}${renderAccounts(x,{hidden:!accountsMode})}</div>`;
}
function renderSecuritiesSection(x){
  return `<section id="securities-section"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="bank" aria-hidden="true"></span>증권계좌 현황</h2></div><div class="securities-band">${renderSecuritiesPerformanceSummary(x)}${renderSecuritiesAssetDetail(x)}${sectionToSecuritiesBlock(renderCharts(x,separateProfitControl(x,'chart-inline')),'charts-block')}${sectionToSecuritiesBlock(renderResultSummary(x),'ledger-block')}${isLedgerCheckDate(x.date)?sectionToSecuritiesBlock(renderSourceTables(x),'source-block'):''}</div></section>`;
}


function renderResultSummary(x){
  const c=dataState.portfolio.constants,v=separateProfitView(x);
  const outsideCashBase=c.outsideCash ?? 2035097,outsideCash=outsideCashForDate(x.date),outsideCashUsed=securityInternalCashTransferSum(x.date);
  const separateUnreflected=v.unreflectedSeparateProfit;
  const outsideCashBasis=outsideCash+(uiState.includeSeparateProfit?separateUnreflected:0);
  const actualHoldingAndCash=x.allocTotal+outsideCashBasis;
  const ledgerGap=v.totalResult-actualHoldingAndCash;
  if(!isLedgerCheckDate(x.date)) return '';
  const reasonValue='수익실현분 카드대금 사용';
  const footnoteMark='<span class="cash-basis-note-mark">(1)</span>';
  const footnoteSup='<sup class="cash-basis-note-mark cash-basis-note-sup">(1)</sup>';
  const outsideCashFlowText=outsideCashUsed?`6/18 확인값 ${won(outsideCashBase)} - 투자 사용 ${won(outsideCashUsed)}`:`6/18 확인값 ${won(outsideCashBase)}`;
  const note=uiState.includeSeparateProfit
    ?`<p class="section-explainer table-note cash-basis-note">${footnoteMark} 실현수익 반영 현금 보유액 ${won(outsideCashBasis)} = ${outsideCashFlowText} + 6~8월 별도손익 중 현 보유자산 미반영분 ${won(separateUnreflected)}</p>`
    :`<p class="section-explainer table-note cash-basis-note">${footnoteMark} 실현수익 반영 현금 보유액 ${won(outsideCash)} = ${outsideCashFlowText}</p>`;
  const ledgerSourceSub='계좌1 성과 + 계좌2 실현분 + 토스 실현분 기준<br>출처: 연금+계좌 성과 &gt; 증권계좌 투자 결과물';
  const actualHoldingSub=`평가금액 합계(${won(x.allocTotal)}) +<br>실현수익 반영 현금 보유액(${won(outsideCashBasis)})${footnoteSup}`;
  const gapClass=ledgerGap!==0?'ledger-gap-value':'';
  const conclusion=`<article class="card metric-card ledger-conclusion-card dark" aria-label="장부결과 차액"><div class="ledger-conclusion-main"><div class="label">차액(A-B)</div><div class="value ${gapClass}">${won(ledgerGap)}</div><div class="sub">장부상 결과물과 실제 보유액의 차이<div class="ledger-conclusion-inline-reason">차액 발생 이유: ${reasonValue}</div></div></div><div class="ledger-conclusion-reason"><span>차액 발생 이유</span><strong>${reasonValue}</strong></div></article>`;
  const overview=`<div class="grid cards metric-grid ledger-overview-grid">${conclusion}${metricCard('장부상 투자 결과물(A)',won(v.totalResult),ledgerSourceSub)}${metricCard('현재 증권계좌 및 현금 보유액(B)',won(actualHoldingAndCash),actualHoldingSub)}</div>`;
  return `<section id="ledger-check"><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="search" aria-hidden="true"></span>장부결과 VS 실제보유</h2>${separateProfitControl(x,'section-inline')}</div>${overview}${note}</section>`;
}


function renderHoldings(x){
  const detail=x.securitiesAssetDetail;
  const orderedHoldings=sortSecurityItems(detail.statusRows);
  const summaryById=Object.fromEntries(detail.summaryRows.map(row=>[row.id,row]));
  const rows=orderedHoldings.map(h=>({
    className:'asset-item-row',
    labelHtml:`<span class="holding-name-text">${mobileTableAssetName(h.name)}</span>${securitySymbolSwatch(h.name)}`,
    cells:[
      {className:'num table-cell-center',html:fmt(h.qty)},
      {className:'num table-cell-right',html:fmt(h.avgPrice ?? (h.qty?h.cost/h.qty:0))},
      {className:'num table-cell-right',html:fmt(h.cost)},
      {className:'num table-cell-right',html:fmt(h.evalAmount)},
      {className:`num table-cell-right ${tableCls(h.profit)}`,html:fmt(h.profit)},
      {className:`num table-cell-center ${tableCls(h.returnRate)}`,html:pct(h.returnRate)},
      {className:'num table-cell-center',html:renderAssetWeight({label:h.name,weight:h.weightPct,color:securityAllocationColor(h.name)})}
    ]
  }));
  const summaryRows=['holdings','cash','total'].map(id=>{
    const row=summaryById[id];
    return {
      className:id==='cash'?'':'summary-row',
      labelHtml:row.label,
      cells:[
        {className:'num table-cell-center',html:'-'},
        {className:'num table-cell-right',html:'-'},
        {className:'num table-cell-right',html:fmt(row.cost)},
        {className:'num table-cell-right',html:fmt(row.evalAmount)},
        {className:`num table-cell-right ${tableCls(row.profit)}`,html:fmt(row.profit)},
        {className:`num table-cell-center ${tableCls(row.returnRate)}`,html:pct(row.returnRate)},
        {className:'num table-cell-center',html:renderAssetWeight({label:row.label,weight:row.weightPct,fillClass:'bar-gray'})}
      ]
    };
  });
  const cards=orderedHoldings.map(h=>({
    title:`<span class="holding-name-text">${h.name}</span>${securitySymbolSwatch(h.name)}`,
    accessibleLabel:h.name,
    items:[
      ['수량',fmt(h.qty)],
      ['평균단가',won(h.avgPrice ?? (h.qty?h.cost/h.qty:0))],
      ['투자원금',won(h.cost)],
      ['평가금액',won(h.evalAmount)],
      ['평가손익',won(h.profit),cls(h.profit)],
      ['수익률',pct(h.returnRate),cls(h.returnRate)],
      ['비중',pct(h.weightPct)]
    ]
  }));
  ['holdings','cash','total'].forEach(id=>{
    const row=summaryById[id];
    cards.push({
      title:row.label,
      extraClass:id==='cash'?'':'summary-card mobile-total-card',
      items:[
        ['투자원금',won(row.cost)],
        ['평가금액',won(row.evalAmount)],
        ['평가손익',won(row.profit),cls(row.profit)],
        ['수익률',pct(row.returnRate),cls(row.returnRate)],
        ['비중',pct(row.weightPct)]
      ]
    });
  });
  const contributionItems=detail.contribution.items.map(item=>({
    ...item,
    share:item.sharePct,
    shortLabel:item.name.replace('KODEX ',''),
    color:securityAllocationColor(item.name),
    valueText:signed(item.value)
  }));
  const contributionHtml=`<div class="asset-insight-zone" role="group" aria-label="증권계좌 인사이트">${renderAssetContributionCard({
    idPrefix:'securitiesContribution',
    hasPrev:detail.hasPrev,
    items:contributionItems
  })}</div>`;
  return renderAssetStatusBlock({
    sectionId:'securities-holdings',
    idPrefix:'securities-holdings',
    viewStateKey:'holdings',
    title:'보유종목 현황',
    icon:'folder',
    sectionClass:'holdings-block note asset-status-note',
    tableClass:'dashboard-data-table asset-status-table',
    caption:'증권계좌 보유종목 현황',
    columns:[
      {label:'종목',className:'asset-status-col-name'},
      {label:'수량',className:'asset-status-col-qty table-cell-center'},
      {label:'평균단가',className:'asset-status-col-average'},
      {label:'투자원금',className:'asset-status-col-principal'},
      {label:'평가금액',className:'asset-status-col-evaluation'},
      {label:'평가손익',className:'asset-status-col-profit'},
      {label:'수익률',className:'asset-status-col-return table-cell-center'},
      {label:'비중',className:'asset-status-col-weight'}
    ],
    rows,
    summaryRows,
    cards,
    afterHtml:`<p class="small section-explainer asset-status-basis-note">※ 투자원금 합계는 현재 보유상품 재투자 기준</p>${contributionHtml}`,
    mobileViewAttrs,
    mobileViewToggle,
    mobileInfoCard
  });
}


function renderSecuritiesChangeBlock(x){
  const detail=x.securitiesAssetDetail,change=detail.change,hasPrev=detail.hasPrev;
  const prevDateLabel=detail.prevDate?shortDate(detail.prevDate):'전일';
  const currentDateLabel=shortDate(detail.date);
  const orderedRows=sortSecurityItems(change.rows);
  const rows=orderedRows.map(r=>({
    labelHtml:`<strong>${mobileTableAssetName(r.name)}</strong>${securitySymbolSwatch(r.name)}`,
    cells:[
      {className:'num table-cell-right',html:`<span class="change-price">${r.prevPrice==null?'-':fmt(r.prevPrice)}</span><span class="change-eval">${r.prevEval==null?'-':won(r.prevEval)}</span>`},
      {className:'num table-cell-right asset-change-current-col',html:`<span class="change-price">${r.price==null?'-':fmt(r.price)}</span><span class="change-eval">${won(r.evalAmount)}</span><span class="asset-change-mobile-delta ${tableCls(r.dayChange)}"><span class="visually-hidden">일변동 </span>${r.dayChange==null?'-':signed(r.dayChange)}</span>`},
      {className:`num table-cell-right asset-change-delta-col ${tableCls(r.dayChange)}`,html:r.dayChange==null?'-':signed(r.dayChange)}
    ]
  }));
  const summaryRows=[{
    className:'summary-row',
    labelHtml:'합계',
    cells:[
      {className:'num table-cell-right',html:hasPrev?fmt(change.prevEvaluationTotal):'-'},
      {className:'num table-cell-right asset-change-current-col',html:`${fmt(change.evaluationTotal)}<span class="asset-change-mobile-delta ${tableCls(change.dayChange)}"><span class="visually-hidden">일변동 </span>${change.dayChange==null?'-':signed(change.dayChange)}</span>`},
      {className:`num table-cell-right asset-change-delta-col ${tableCls(change.dayChange)}`,html:change.dayChange==null?'-':signed(change.dayChange)}
    ]
  }];
  const cards=orderedRows.map(r=>({
    title:r.name,
    items:[
      [prevDateLabel+' 종가',r.prevPrice==null?'-':fmt(r.prevPrice)],
      [prevDateLabel+' 평가금액',r.prevEval==null?'-':won(r.prevEval)],
      [currentDateLabel+' 종가',r.price==null?'-':fmt(r.price)],
      [currentDateLabel+' 평가금액',won(r.evalAmount)],
      ['일변동',r.dayChange==null?'-':signed(r.dayChange),cls(r.dayChange)]
    ]
  }));
  return renderAssetDayChangeBlock({
    sectionId:'securities-change',
    idPrefix:'securities-change',
    viewStateKey:'securitiesChange',
    hasPrev,
    renderWithoutPrev:true,
    summaryItems:[
      {label:`${prevDateLabel} 평가금액`,value:hasPrev?won(change.prevEvaluationTotal):'-'},
      {label:`${currentDateLabel} 평가금액`,value:won(change.evaluationTotal)},
      {label:'하루 변동분',value:change.dayChange==null?'-':signed(change.dayChange,'원'),valueClass:cls(change.dayChange)},
      {label:'하루 변동률',value:change.dayRate==null?'-':(change.dayRate>0?'+':'')+pct(change.dayRate),valueClass:cls(change.dayRate)}
    ],
    caption:'증권계좌 전일 대비 종목별 변동',
    columns:[
      {label:'종목'},
      {label:`${prevDateLabel} 종가`},
      {label:`${currentDateLabel} 종가`,className:'asset-change-current-col'},
      {label:'일변동',className:'asset-change-delta-col'}
    ],
    rows,
    summaryRows,
    cards,
    mobileViewAttrs,
    mobileViewToggle,
    mobileInfoCard
  });
}
function renderSecuritiesAssetDetail(x){
  return `<div class="grid two asset-detail-grid">${renderHoldings(x)}${renderSecuritiesChangeBlock(x)}</div>`;
}
function renderCombined(x){
  const v=separateProfitView(x),returnLabel='누적수익률',mobileReturnPct=n=>(Number(n)||0).toFixed(1)+'%';
  const cards=mobileInfoCard('퇴직연금',[
    ['투입원금',won(x.pensionPrincipal)],['투자 결과물',won(x.pensionEval)],['누적손익',won(x.pensionProfit),cls(x.pensionProfit)],['누적수익률',pct(x.pensionReturn),cls(x.pensionReturn)]
  ])+mobileInfoCard('증권계좌',[
    ['투입원금',won(v.totalPrincipal)],['투자 결과물',won(v.totalResult)],['누적손익',won(v.totalProfit),cls(v.totalProfit)],[returnLabel,pct(v.totalReturn),cls(v.totalReturn)]
  ])+mobileInfoCard('합산',[
    ['투입원금',won(v.combinedPrincipal)],['투자 결과물',won(v.combinedResult)],['누적손익',won(v.combinedProfit),cls(v.combinedProfit)],[returnLabel,pct(v.combinedReturn),cls(v.combinedReturn)]
  ],'summary-card mobile-total-card');
  return `<section id="summary-section" ${mobileViewAttrs('combined')}><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="home" aria-hidden="true"></span>연금+계좌 성과</h2><div class="section-title-actions">${separateProfitControl(x,'section-inline')}${mobileViewToggle('combined')}</div></div><div id="combined-table-view" class="mobile-scroll table-view"><table class="dashboard-data-table combined-performance-table"><caption class="visually-hidden">연금과 증권계좌 성과 비교</caption><thead><tr><th scope="col">구분</th><th scope="col">투입원금</th><th scope="col">투자 결과물</th><th scope="col" class="combined-profit-col">누적손익</th><th scope="col" class="table-cell-center combined-return-col">${returnLabel}</th></tr></thead><tbody><tr><th scope="row"><strong>퇴직연금</strong></th><td class="num table-cell-right">${fmt(x.pensionPrincipal)}</td><td class="num table-cell-right">${fmt(x.pensionEval)}</td><td class="num table-cell-right combined-profit-col ${tableCls(x.pensionProfit)}">${fmt(x.pensionProfit)}<span class="combined-mobile-return ${tableCls(x.pensionReturn)}"> (${mobileReturnPct(x.pensionReturn)})</span></td><td class="num table-cell-center combined-return-col ${tableCls(x.pensionReturn)}">${pct(x.pensionReturn)}</td></tr><tr><th scope="row"><strong>증권계좌</strong></th><td class="num table-cell-right">${fmt(v.totalPrincipal)}</td><td class="num table-cell-right">${fmt(v.totalResult)}</td><td class="num table-cell-right combined-profit-col ${tableCls(v.totalProfit)}">${fmt(v.totalProfit)}<span class="combined-mobile-return ${tableCls(v.totalReturn)}"> (${mobileReturnPct(v.totalReturn)})</span></td><td class="num table-cell-center combined-return-col ${tableCls(v.totalReturn)}">${pct(v.totalReturn)}</td></tr><tr class="summary-row"><th scope="row">합산</th><td class="num table-cell-right">${fmt(v.combinedPrincipal)}</td><td class="num table-cell-right">${fmt(v.combinedResult)}</td><td class="num table-cell-right combined-profit-col ${tableCls(v.combinedProfit)}">${fmt(v.combinedProfit)}<span class="combined-mobile-return ${tableCls(v.combinedReturn)}"> (${mobileReturnPct(v.combinedReturn)})</span></td><td class="num table-cell-center combined-return-col ${tableCls(v.combinedReturn)}">${pct(v.combinedReturn)}</td></tr></tbody></table></div><div id="combined-card-view" class="mobile-card-view">${cards}</div></section>`;
}

function accountMemoTableHtml(text,{joinFirstTwo=false}={}){
  const parts=String(text||'').match(/[^.]+\.(?:\s*|$)|[^.]+$/g)||[];
  if(joinFirstTwo&&parts.length>1){
    parts.splice(0,2,`${parts[0].trim()} ${parts[1].trim()}`);
  }
  const sourceLinkPattern=/([+-]?[\d,]+원은 계좌1 투자원금 검산의 레버수익 재투입·VIP 수익 재투입·실현수익 투입)/;
  return parts.map(part=>{
    const safe=escapeHtml(part.trim());
    return `<span class="accounts-memo-sentence">${safe.replace(sourceLinkPattern,'<span class="accounts-memo-source-link">$1</span>')}</span>`;
  }).join(' ');
}
function accountMemoInfoButton(text){
  const safe=escapeHtml(String(text||''));
  return `<button type="button" class="accounts-memo-info-button" aria-label="${safe} 설명" aria-expanded="false" data-dashboard-action="toggle-account-memo-info"><span aria-hidden="true">i</span><span class="accounts-memo-tooltip-source" role="tooltip">${safe}</span></button>`;
}
function removeAccountMemoFloatingTooltip(){
  document.querySelector('.accounts-memo-floating-tooltip')?.remove();
}
function closeAccountMemoInfo(except=null){
  removeAccountMemoFloatingTooltip();
  document.querySelectorAll('#accounts-summary .accounts-memo-info-button.open').forEach(button=>{
    if(button===except)return;
    button.classList.remove('open');
    button.setAttribute('aria-expanded','false');
  });
}
function showAccountMemoFloatingTooltip(button){
  if(!button?.closest('#accounts-summary .accounts-memo'))return;
  if(window.matchMedia?.('(max-width:400px)').matches!==true)return;
  const source=button.querySelector('.accounts-memo-tooltip-source');
  if(!source)return;

  removeAccountMemoFloatingTooltip();

  const floating=document.createElement('span');
  floating.className='accounts-memo-floating-tooltip';
  floating.setAttribute('role','tooltip');
  floating.textContent=source.textContent||'';
  document.body.appendChild(floating);

  const buttonRect=button.getBoundingClientRect();
  const tooltipRect=floating.getBoundingClientRect();
  const edge=14,gap=7;
  const viewportWidth=document.documentElement.clientWidth||window.innerWidth;
  const viewportHeight=window.innerHeight;

  const maxLeft=Math.max(edge,viewportWidth-tooltipRect.width-edge);
  const left=Math.max(edge,Math.min(buttonRect.right-tooltipRect.width,maxLeft));
  const belowTop=buttonRect.bottom+gap;
  const top=belowTop+tooltipRect.height<=viewportHeight-edge
    ? belowTop
    : Math.max(edge,buttonRect.top-tooltipRect.height-gap);

  floating.style.left=`${Math.round(left)}px`;
  floating.style.top=`${Math.round(top)}px`;
}
function toggleAccountMemoInfo(event,button){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if(!button)return;

  const open=!button.classList.contains('open');
  closeAccountMemoInfo(button);
  button.classList.toggle('open',open);
  button.setAttribute('aria-expanded',String(open));

  if(open)showAccountMemoFloatingTooltip(button);
}
function renderAccounts(x,{hidden=false}={}){
  const c=dataState.portfolio.constants,sourceTracking=dataState.portfolio.securitiesSourceTracking||{},v=separateProfitView(x),realizedProfitInput=securityInternalCashTransferSum(x.date),excludedTransfer=securityExcludedTransferSum(x.date),vipProfitReinvest=(Number(c.account2ReinvestedToAccount1)||0)-(Number(c.account2Principal)||0),vipGoldInput=Number(sourceTracking.vipGoldInput)||0,vipReinvestLessGold=(Number(c.account2ReinvestedToAccount1)||0)-vipGoldInput,mobileReturnPct=n=>(Number(n)||0).toFixed(1)+'%';
  const separateProfitModeMemo=excludedTransfer
    ? (uiState.includeSeparateProfit
      ? ` 보유 자금 투입 ${won(excludedTransfer)}을 별도수익 재투입분으로 재분류하여 성과기준 원금에서 제외.`
      : ` 보유 자금 투입 ${won(excludedTransfer)}을 성과기준 원금에 포함.`)
    : '';
  const adjustmentHtml=value=>{
    const amount=Math.round(Number(value)||0);
    return amount?`<span class="accounts-ledger-adjustment">조정 ${signed(amount)}</span>`:'';
  };
  const account1PrincipalAdjustment=v.totalPrincipal-v.account1Principal;
  const account1ResultAdjustment=-realizedProfitInput;
  const account1DerivedAdjustmentBasis=(Number(c.tossReinvestedToAccount1)||0)+vipProfitReinvest+(Number(realizedProfitInput)||0);
  const account1PrincipalAdjustmentMemo=account1PrincipalAdjustment
    ? (Math.abs(account1PrincipalAdjustment+account1DerivedAdjustmentBasis)<0.5
      ? ` 투입원금 조정 ${signed(account1PrincipalAdjustment)}원은 계좌1 투자원금 검산의 레버수익 재투입·VIP 수익 재투입·실현수익 투입을 전체 투입원금 기준으로 조정한 값.`
      : ` 투입원금 조정 ${signed(account1PrincipalAdjustment)}원은 전체 투입원금과 계좌1 투자원금 간 장부 차이를 반영한 조정값.`)
    : '';
  const rows=[
    {
      name:'삼성증권1',
      principal:v.account1Principal,
      principalAdjustment:account1PrincipalAdjustment,
      result:v.account1Result,
      resultAdjustment:account1ResultAdjustment,
      profit:v.account1Profit,
      returnRate:v.account1Return,
      memo:`2025-10-16 최초 시작.${account1PrincipalAdjustmentMemo}${account1ResultAdjustment?` 투자 결과물 조정 ${signed(account1ResultAdjustment)}원은 계좌1 투자원금 검산의 실현수익 투입 ${won(realizedProfitInput)}에 대한 중복 반영 제거값.`:''}${separateProfitModeMemo}`
    },
    ...(x.account2Included?[{
      name:'삼성증권2',
      principal:Number(c.account2Principal)||0,
      principalAdjustment:-(Number(c.account2Principal)||0),
      result:Number(c.account2RealizedAmount)||0,
      resultAdjustment:-(Number(c.account2ReinvestedToAccount1)||0),
      profit:Number(c.account2Profit)||0,
      returnRate:(Number(c.account2Principal)||0)?(Number(c.account2Profit)||0)/(Number(c.account2Principal)||0)*100:0,
      memoJoinFirstTwo:true,
      memo:`2023-12-20 최초 시작. 2026-05-22 전량 매도. 투입원금 조정 ${signed(-(Number(c.account2Principal)||0))}원은 삼성증권1에 이미 반영된 이전 원금의 중복 제거값. 투자 결과물 조정 ${signed(-(Number(c.account2ReinvestedToAccount1)||0))}원은 VIP 재투입액(VIP 금 투입분 ${won(vipGoldInput)} + VIP 재투입-금 ${won(vipReinvestLessGold)})의 중복 제거값.`
    }]:[]),
    {
      name:'토스증권',
      principal:0,
      principalAdjustment:0,
      result:Number(c.tossRealizedAmount)||0,
      resultAdjustment:-(Number(c.tossReinvestedToAccount1)||0),
      profit:Number(c.tossProfit)||0,
      returnRate:null,
      memo:`2026-03-09 매수 후 익일 매도. 투자 결과물 조정 ${signed(-(Number(c.tossReinvestedToAccount1)||0))}원은 삼성증권1 재투입분의 중복 제거값. 투입원금은 0원으로 별도 원금 조정 없음.`
    }
  ];
  const totalPrincipal=rows.reduce((sum,row)=>sum+(Number(row.principal)||0)+(Number(row.principalAdjustment)||0),0);
  const totalResult=rows.reduce((sum,row)=>sum+(Number(row.result)||0)+(Number(row.resultAdjustment)||0),0);
  const totalReturn=Number(v.totalReturn)||0;
  const totalMemo='각 계좌의 투자 결과물·투입원금에 계좌 간 재투입 및 중복 제거 조정을 반영한 최종 합계.';
  const hiddenNote=x.account2Included?'':'<p class="table-note"><strong>참고:</strong> 삼성증권2는 2026-05-22 전량 매도 후 실현분 반영. 선택일이 2026-05-21 이전이면 당시 전체 성과 기준에서 제외되어 이 표에서도 숨김.</p>';
  const cards=rows.map(row=>mobileInfoCard(row.name,[
    ['투자 결과물',`${won(row.result)}${adjustmentHtml(row.resultAdjustment)}`],
    ['투입원금',`${won(row.principal)}${adjustmentHtml(row.principalAdjustment)}`],
    ['누적손익',won(row.profit),cls(row.profit)],
    ['누적수익률',row.returnRate==null?'-':pct(row.returnRate),row.returnRate==null?'':cls(row.returnRate)],
    ['',accountMemoTableHtml(row.memo,{joinFirstTwo:!!row.memoJoinFirstTwo}),'','stacked note-only']
  ])).join('')+mobileInfoCard('합계',[
    ['투자 결과물',won(totalResult)],
    ['투입원금',won(totalPrincipal)],
    ['누적손익',won(v.totalProfit),cls(v.totalProfit)],
    ['누적수익률',pct(totalReturn),cls(totalReturn)],
    ['',accountMemoTableHtml(totalMemo),'','stacked note-only']
  ],'summary-card mobile-total-card');
  const totalRow=`<tr class="summary-row"><th scope="row" class="accounts-name">합계</th><td class="num table-cell-right">${fmt(totalResult)}</td><td class="num table-cell-right">${fmt(totalPrincipal)}</td><td class="num table-cell-right performance-profit-col ${tableCls(v.totalProfit)}">${fmt(v.totalProfit)}<span class="performance-inline-return ${tableCls(totalReturn)}"> (${mobileReturnPct(totalReturn)})</span></td><td class="num table-cell-center performance-return-col ${tableCls(totalReturn)}">${pct(totalReturn)}</td><td class="table-cell-text accounts-memo"><span class="accounts-memo-text">${accountMemoTableHtml(totalMemo)}</span>${accountMemoInfoButton(totalMemo)}</td></tr>`;
  return `<div id="accounts-summary" ${mobileViewAttrs('accounts')}${hidden?' hidden':''}><div id="accounts-table-view" class="mobile-scroll accounts-scroll table-view"><table class="dashboard-data-table accounts-table"><caption class="visually-hidden">성과 요약 계좌별 보기</caption><thead><tr><th scope="col" class="accounts-name-head">구분</th><th scope="col">투자 결과물</th><th scope="col">투입원금</th><th scope="col" class="performance-profit-col">누적손익</th><th scope="col" class="table-cell-center performance-return-col">누적수익률</th><th scope="col" class="table-cell-text accounts-memo-head" aria-label="메모"><span class="accounts-memo-head-label">메모</span><span class="accounts-memo-head-compact" aria-hidden="true">i</span></th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row" class="accounts-name">${row.name}</th><td class="num table-cell-right">${fmt(row.result)}${adjustmentHtml(row.resultAdjustment)}</td><td class="num table-cell-right">${fmt(row.principal)}${adjustmentHtml(row.principalAdjustment)}</td><td class="num table-cell-right performance-profit-col ${tableCls(row.profit)}">${fmt(row.profit)}${row.returnRate==null?'':`<span class="performance-inline-return ${tableCls(row.returnRate)}"> (${mobileReturnPct(row.returnRate)})</span>`}</td><td class="num table-cell-center performance-return-col ${row.returnRate==null?'':tableCls(row.returnRate)}">${row.returnRate==null?'-':pct(row.returnRate)}</td><td class="table-cell-text accounts-memo"><span class="accounts-memo-text">${accountMemoTableHtml(row.memo,{joinFirstTwo:!!row.memoJoinFirstTwo})}</span>${accountMemoInfoButton(row.memo)}</td></tr>`).join('')}${totalRow}</tbody></table></div><div id="accounts-card-view" class="mobile-card-view">${cards}</div>${hiddenNote}</div>`;
}
function renderSourceTables(x){
  const c=dataState.portfolio.constants,
    sourceTracking=dataState.portfolio.securitiesSourceTracking||{},
    vipProfitReinvest=c.account2ReinvestedToAccount1-c.account2Principal,
    extraContribution=securityExternalContributionSum(x.date),
    excludedTransfer=securityExcludedTransferSum(x.date),
    realizedProfitInput=securityInternalCashTransferSum(x.date),
    sourceHoldingGap=account1SourceHoldingGapForDate(x.date),
    holdingCostPrincipal=account1PrincipalForDate(x.date),
    externalPrincipal=sourceExternalPrincipalForDate(x.date),
    reclassified=uiState.includeSeparateProfit?separateProfitReinvestedForDate(x.date):0,
    performancePrincipal=holdingCostPrincipal-reclassified,
    extraRow=extraContribution?`<tr class="source-base-row"><th scope="row">추가 외부투입</th><td class="num table-cell-right">${fmt(extraContribution)}</td></tr>`:'',
    excludedRow=!uiState.includeSeparateProfit&&excludedTransfer?`<tr class="source-base-row"><th scope="row">보유 자금 투입</th><td class="num table-cell-right">${fmt(excludedTransfer)}</td></tr>`:'',
    realizedProfitRow=realizedProfitInput?`<tr class="source-derived-row"><th scope="row">실현수익 투입</th><td class="num table-cell-right">${fmt(realizedProfitInput)}</td></tr>`:'',
    reconciliationRow=`<tr><th scope="row">원천·보유 차액</th><td class="num table-cell-right">${fmt(sourceHoldingGap)}</td></tr>`,
    reclassNote=uiState.includeSeparateProfit&&reclassified?`<div class="source-reclass-note"><strong>6~8월 별도수익 재투입 ${won(reclassified)}</strong><span>기존 투자수익 재투자분 · 신규 외부투입금 아님</span><span>전체 투입원금 제외 · 별도수익 ON 시 성과기준 원금 제외</span></div>`:'',
    principalLabel=uiState.includeSeparateProfit&&reclassified?'계좌1 성과기준 투자원금':'계좌1 투자원금 검산',
    principalSummaryLabel='합계';
  const externalCard=`<div class="card source-card metric-card highlight"><div class="label">전체 투입원금</div><div class="value">${won(externalPrincipal)}</div><div class="mobile-scroll source-table-scroll"><table class="dashboard-data-table source-data-table"><caption class="visually-hidden">전체 투입원금 구성</caption><tbody><tr><th scope="row">금 판매액 총액</th><td class="num table-cell-right">${fmt(c.goldPrincipal)}</td></tr><tr><th scope="row">근로소득 투입액</th><td class="num table-cell-right">${fmt(c.laborNetPrincipal)}</td></tr>${extraRow}<tr class="summary-row"><th scope="row">합계</th><td class="num table-cell-right">${fmt(externalPrincipal)}</td></tr></tbody></table></div>${reclassNote}</div>`;
  const performanceCard=`<div class="card source-card metric-card"><div class="label">${principalLabel}</div><div class="value">${won(performancePrincipal)}</div><div class="mobile-scroll source-table-scroll"><table class="dashboard-data-table source-data-table"><caption class="visually-hidden">계좌1 투자원금 검산</caption><tbody><tr class="source-base-row"><th scope="row">전체 투입원금</th><td class="num table-cell-right">${fmt(externalPrincipal)}</td></tr>${excludedRow}<tr class="source-derived-row"><th scope="row">레버수익 재투입</th><td class="num table-cell-right">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr class="source-derived-row"><th scope="row">VIP 수익 재투입</th><td class="num table-cell-right">${fmt(vipProfitReinvest)}</td></tr>${realizedProfitRow}${reconciliationRow}<tr class="summary-row"><th scope="row">${principalSummaryLabel}</th><td class="num table-cell-right">${fmt(performancePrincipal)}</td></tr></tbody></table></div></div>`;
  const account1GoldSource=Number(sourceTracking.account1GoldInput)||0,account2GoldSource=Number(sourceTracking.vipGoldInput)||0,temporarySource=Number(sourceTracking.temporaryFunding)||0,principalRecovery=Number(sourceTracking.principalRecovery)||0,vipReinvestLessGold=(Number(c.account2ReinvestedToAccount1)||0)-account2GoldSource;
  const trackedCard=`<div class="card source-card metric-card"><div class="label">계좌1 원천별 추적</div><div class="value">${won(performancePrincipal)}</div><div class="mobile-scroll source-table-scroll"><table class="dashboard-data-table source-data-table"><caption class="visually-hidden">계좌1 원천별 추적</caption><tbody><tr class="source-base-row"><th scope="row">금 판매액 투입</th><td class="num table-cell-right">${fmt(account1GoldSource)}</td></tr><tr class="source-base-row"><th scope="row">VIP 금 투입분</th><td class="num table-cell-right">${fmt(account2GoldSource)}</td></tr><tr class="source-base-row"><th scope="row">근로소득 투입액</th><td class="num table-cell-right">${fmt(c.laborNetPrincipal)}</td></tr>${extraRow}${excludedRow}<tr class="source-derived-row"><th scope="row">레버수익 재투입</th><td class="num table-cell-right">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr class="source-derived-row"><th scope="row">VIP 재투입-금</th><td class="num table-cell-right">${fmt(vipReinvestLessGold)}</td></tr><tr class="source-derived-row"><th scope="row">임시자금 투입</th><td class="num table-cell-right">${fmt(temporarySource)}</td></tr><tr class="source-derived-row"><th scope="row">원금 회수</th><td class="num table-cell-right">${fmt(principalRecovery)}</td></tr>${realizedProfitRow}${reconciliationRow}<tr class="summary-row"><th scope="row">합계</th><td class="num table-cell-right">${fmt(performancePrincipal)}</td></tr></tbody></table></div></div>`;
  return `<section id="capital-source-check" class="capital-source-section"><div class="section-title source-title"><h2><span class="section-title-icon" data-section-title-icon="receipt" aria-hidden="true"></span>투자원금 원천 및 검산</h2>${separateProfitControl(x,'section-inline')}</div><div class="grid three source-grid">${externalCard}${performanceCard}${trackedCard}</div></section>`;
}


function handleUiDashboardAction(event,control){
  const action=control.dataset.dashboardAction;
  if(action==='close-date-menu')closeDateActionMenu();
  else if(action==='toggle-date-menu')toggleDateActionMenu(event);
  else if(action==='toggle-desktop-toc')toggleDesktopEdgeToc();
  else if(action==='krx-update')triggerKrxPriceUpdate();
  else if(action==='toggle-theme')toggleTheme();
  else if(action==='toggle-corner-theme')toggleCornerTheme();
  else if(action==='jump-section'){
    jumpToSection(control.dataset.sectionTarget||'');
    closeDesktopEdgeToc();
    if(control.dataset.closeDateMenu==='true')closeDateActionMenu();
  }
  else if(action==='toggle-mobile-view')toggleMobileDataView(control.dataset.mobileViewKey||'');
  else if(action==='set-securities-performance-view')setSecuritiesPerformanceView(control.dataset.securitiesPerformanceView||'overall');
  else if(action==='toggle-account-memo-info')toggleAccountMemoInfo(event,control);
  else if(action==='close-krx-modal')closeKrxActionModal();
  else if(action==='submit-krx-modal')submitKrxActionModal(control.dataset.krxMode||'selected');
  else if(action==='set-asset-tab')setAssetTab(control.dataset.assetTab||'securities');
  else return false;
  return true;
}
function handleUiDashboardChange(control){
  if(control?.dataset?.dashboardChange!=='mobile-date-pin')return false;
  setMobileDatePinned(control.checked);
  return true;
}
function handleUiDashboardKeydown(event){
  const assetTab=event.target.closest?.('[role="tab"][data-asset-tab]');
  return !!(assetTab&&handleAssetTabKeydown(event,assetTab));
}

export {
  closeDateActionMenu,
  ensureDesktopEdgeToc,
  ensureMobileTopButton,
  forceMobileViewportReflow,
  handleUiDashboardAction,
  handleUiDashboardChange,
  handleUiDashboardKeydown,
  hydrateSectionTitleIcons,
  metricCard,
  mobileDateMenuIsOpen,
  mobileInfoCard,
  mobileViewAttrs,
  mobileViewToggle,
  renderCombined,
  renderSecuritiesSection,
  renderTabs,
  restoreMobileDateMenuAfterRender,
  setupSectionNavigationTracking,
  setupUiGlobalEvents,
  showAppToast,
  syncAssetTabs,
  syncCornerThemeControls,
  syncThemeControls
};
