// 메인 대시보드 일반 UI · topbar · navigation · rendering component

const THEME_STORAGE_KEY='investmentDashboard.theme';
const currentTheme=()=>document.documentElement.classList.contains('dark')?'dark':'light';
function syncThemeControls(){
  const dark=currentTheme()==='dark';
  document.querySelectorAll('[data-theme-toggle-icon]').forEach(el=>el.textContent=dark?'☀️':'🌙');
  document.querySelectorAll('[data-theme-toggle]').forEach(el=>{
    el.setAttribute('aria-pressed',String(dark));
    el.setAttribute('title',dark?'밝은 모드로 전환':'다크 모드로 전환');
    el.setAttribute('aria-label',dark?'밝은 모드로 전환':'다크 모드로 전환');
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


const separateProfitToggle=()=>`<button type="button" class="section-control-chip section-action-chip separate-profit-toggle ${uiState.includeSeparateProfit?'active':''}" aria-pressed="${uiState.includeSeparateProfit}" data-dashboard-action="toggle-separate-profit"><span>별도수익</span><strong>${uiState.includeSeparateProfit?'ON':'OFF'}</strong></button>`;
const separateProfitControl=(x,extraClass='')=>{
  if(!uiState.personalViewUnlocked)return '';
  const profit=separateProfitCumulativeForDate(x.date);
  const note=uiState.includeSeparateProfit?`<span class="separate-profit-control-note">선택일 ${signed(profit,'원')}</span>`:'';
  return `<div class="separate-profit-control-row${extraClass?' '+extraClass:''}">${note}${separateProfitToggle()}</div>`;
};
function navIconSvg(name){
  const attrs='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const icons={
    link:`<svg ${attrs}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"></path></svg>`,
    activity:`<svg ${attrs}><path d="M22 12h-4l-3 8-6-16-3 8H2"></path></svg>`,
    refresh:`<svg ${attrs}><path d="M21 12a9 9 0 0 1-15.5 6.2"></path><path d="M3 12A9 9 0 0 1 18.5 5.8"></path><path d="M18 2v4h4"></path><path d="M6 22v-4H2"></path></svg>`,
    wallet:`<svg ${attrs}><path d="M20 7H5a3 3 0 0 0 0 6h15v6H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h15v3Z"></path><path d="M16 13h.01"></path></svg>`,
    calculator:`<svg ${attrs}><rect x="5" y="2" width="14" height="20" rx="2"></rect><path d="M8 6h8"></path><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>`,
    home:`<svg ${attrs}><path d="m3 10 9-7 9 7"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path></svg>`,
    briefcase:`<svg ${attrs}><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path></svg>`,
    package:`<svg ${attrs}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"></path><path d="M12 12 4.5 7.8"></path><path d="M12 12l7.5-4.2"></path><path d="M12 12v9"></path></svg>`,
    trending:`<svg ${attrs}><path d="m3 17 6-6 4 4 8-8"></path><path d="M14 7h7v7"></path></svg>`,
    chart:`<svg ${attrs}><path d="M3 3v18h18"></path><path d="M7 15v2"></path><path d="M12 11v6"></path><path d="M17 7v10"></path></svg>`,
    pie:`<svg ${attrs}><path d="M21 12a9 9 0 1 1-9-9v9h9Z"></path><path d="M12 3a9 9 0 0 1 9 9"></path></svg>`,
    bank:`<svg ${attrs}><path d="m3 9 9-6 9 6"></path><path d="M4 10h16"></path><path d="M6 10v8"></path><path d="M10 10v8"></path><path d="M14 10v8"></path><path d="M18 10v8"></path><path d="M3 18h18"></path><path d="M2 21h20"></path></svg>`,
    list:`<svg ${attrs}><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>`,
    folder:`<svg ${attrs}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>`,
    search:`<svg ${attrs}><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>`,
    receipt:`<svg ${attrs}><path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path></svg>`,
  };
  return icons[name]||icons.list;
}
function renderUnifiedMobileMenuContent(){
  const groups=[
    {
      label:'링크',
      items:[
        {type:'link',url:'https://esignal.co.kr/kospi200-futures-night/',icon:'activity',title:'코스피200 야간선물'},
        {type:'link',url:'https://esignal.co.kr/nasdaq100-futures/',icon:'link',title:'나스닥100 선물'}
      ]
    },
    {
      label:'관리',
      items:[
        {type:'action',action:'krx-update',icon:'refresh',title:'KRX 현재가 반영'},
        {type:'action',action:'open-pension-modal',icon:'wallet',title:'퇴직연금 금액 조정'},
        ...(uiState.personalViewUnlocked?[{type:'link',url:'add/calc.html',icon:'calculator',title:'투자 계산기'}]:[])
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
        {type:'section',id:'securities-section',icon:'bank',title:'증권계좌 현황'},
        {type:'section',id:'accounts-summary',icon:'list',title:'계좌별 성과 요약'},
        {type:'section',id:'securities-holdings',icon:'folder',title:'증권계좌 보유분'},
        {type:'section',id:'chart-cum',icon:'chart',title:'누적손익 및 누적수익률'},
        {type:'section',id:'chart-symbol',icon:'chart',title:'종목별 누적손익'},
        {type:'section',id:'chart-alloc',icon:'pie',title:'평가액 비중'},
        {type:'section',id:'ledger-check',icon:'search',title:'장부결과 VS 실제보유'},
        ...(isLedgerCheckDate(dataState.activeDate)?[{type:'section',id:'capital-source-check',icon:'receipt',title:'투자원금 원천 및 검산'}]:[])
      ]
    },
    {
      label:'퇴직연금',
      items:[
        {type:'section',id:'pension-section',icon:'briefcase',title:'퇴직연금 현황'},
        {type:'section',id:'pension-products',icon:'package',title:'연금상품별 현황'},
        {type:'section',id:'pension-change',icon:'trending',title:'전일 대비 변동'},
        {type:'section',id:'pension-chart-cum',icon:'chart',title:'운용수익 및 누적수익률'},
        {type:'section',id:'pension-chart-symbol',icon:'chart',title:'연금상품별 운용수익'},
        {type:'section',id:'pension-chart-alloc',icon:'pie',title:'평가액 비중'}
      ]
    }
  ];
  return groups.map(group=>`<div class="mobile-nav-group"><p>${group.label}</p>${group.items.map((item,idx)=>{
    const inner=`<span class="nav-icon">${navIconSvg(item.icon)}</span><span><strong>${item.title}</strong></span>`;
    const cls=`mobile-nav-item ${idx?'sub':''}`;
    if(item.type==='link') return `<a class="${cls}" href="${item.url}" target="_blank" rel="noopener noreferrer" data-dashboard-action="close-date-menu">${inner}</a>`;
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
        {id:'securities-section',icon:'bank',title:'증권계좌 현황'},
        {id:'accounts-summary',icon:'list',title:'계좌별 성과 요약'},
        {id:'securities-holdings',icon:'folder',title:'증권계좌 보유분'},
        {id:'chart-cum',icon:'chart',title:'누적손익 및 누적수익률'},
        {id:'chart-symbol',icon:'chart',title:'종목별 누적손익'},
        {id:'chart-alloc',icon:'pie',title:'평가액 비중'},
        {id:'ledger-check',icon:'search',title:'장부결과 VS 실제보유'},
        ...(isLedgerCheckDate(dataState.activeDate)?[{id:'capital-source-check',icon:'receipt',title:'투자원금 원천 및 검산'}]:[])
      ]
    },
    {
      label:'퇴직연금',
      items:[
        {id:'pension-section',icon:'briefcase',title:'퇴직연금 현황'},
        {id:'pension-products',icon:'package',title:'연금상품별 현황'},
        {id:'pension-change',icon:'trending',title:'전일 대비 변동'},
        {id:'pension-chart-cum',icon:'chart',title:'운용수익 및 누적수익률'},
        {id:'pension-chart-symbol',icon:'chart',title:'연금상품별 운용수익'},
        {id:'pension-chart-alloc',icon:'pie',title:'평가액 비중'}
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
  toc.innerHTML=`<button type="button" class="desktop-edge-toc-trigger" aria-label="목차 열기"><span>목차</span></button><nav class="desktop-edge-toc-panel" aria-label="페이지 내 목차"><div class="desktop-edge-toc-title"><span>목차</span></div>${renderDesktopTocContent()}</nav>`;
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
      <div class="date-picker-center">
        <select class="date-select month-select" id="monthSelect" aria-label="월 선택">${months.map(m=>`<option value="${m}" ${m===activeMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}</select>
        <select class="date-select day-select" id="dateSelect" aria-label="일 선택">${monthDates.map(d=>`<option value="${d}" ${d===dataState.activeDate?'selected':''}>${dayOptionLabel(d)}</option>`).join('')}</select>
      </div>
      <div class="date-picker-action">
        <a class="date-tool-btn market-link-btn market-link-btn-desktop date-tool-btn-desktop topbar-market-action" href="https://esignal.co.kr/kospi200-futures-night/" target="_blank" rel="noopener noreferrer" title="코스피200 야간선물">
          <span class="date-tool-action-icon">🌙</span><span class="topbar-label-full">코스피200 야간선물</span><span class="topbar-label-short">코스피 야선</span>
        </a>
        <a class="date-tool-btn market-link-btn market-link-btn-desktop date-tool-btn-desktop topbar-market-action" href="https://esignal.co.kr/nasdaq100-futures/" target="_blank" rel="noopener noreferrer" title="나스닥100 선물">
          <span class="date-tool-action-icon">🚀</span><span class="topbar-label-full">나스닥100 선물</span><span class="topbar-label-short">나스닥 선물</span>
        </a>
        <button type="button" class="date-tool-btn date-tool-btn-desktop topbar-krx-action" title="KRX 현재가 반영" aria-label="KRX 현재가 반영" data-dashboard-action="krx-update">
          <span class="date-tool-action-icon">📈</span><span class="topbar-label-full">KRX 현재가 반영</span><span class="topbar-label-short">KRX 반영</span>
        </button>
        <button type="button" class="date-tool-btn date-tool-btn-desktop topbar-pension-action" title="퇴직연금 금액 조정" aria-label="퇴직연금 금액 조정" data-dashboard-action="open-pension-modal">
          <span class="date-tool-action-icon">💰</span><span class="topbar-label-full">퇴직연금 금액 조정</span><span class="topbar-label-short">연금 조정</span>
        </button>
        ${uiState.personalViewUnlocked?`<a class="date-tool-btn date-tool-btn-desktop topbar-calc-action" href="add/calc.html" target="_blank" rel="noopener noreferrer" title="투자 계산기" aria-label="투자 계산기" style="text-decoration:none">
          <span class="date-tool-action-icon">🧮</span><span class="topbar-label-full">투자 계산기</span><span class="topbar-label-short">계산기</span>
        </a>`:''}
        <button type="button" class="date-tool-btn topbar-theme-action" data-theme-toggle aria-pressed="${currentTheme()==='dark'}" title="${currentTheme()==='dark'?'밝은 모드로 전환':'다크 모드로 전환'}" aria-label="${currentTheme()==='dark'?'밝은 모드로 전환':'다크 모드로 전환'}" data-dashboard-action="toggle-theme">
          <span class="date-tool-action-icon" data-theme-toggle-icon>${currentTheme()==='dark'?'☀️':'🌙'}</span>
        </button>
        <div class="date-action-menu-wrap">
          <button type="button" id="dateActionMenuButton" class="date-tool-btn date-tool-menu-btn" title="목차" aria-label="목차" aria-haspopup="true" aria-expanded="false" data-dashboard-action="toggle-date-menu"><span class="date-tool-icon">☰</span><span class="date-tool-menu-label">목차</span></button>
          <div id="dateActionMenu" class="date-action-menu mobile-combined-menu" aria-label="화면 목차"><div class="mobile-nav-head"><div class="mobile-nav-head-title"><span>목차</span></div><label class="mobile-date-pin-control" for="mobileDatePinToggle"><span>날짜 선택 고정</span><input type="checkbox" id="mobileDatePinToggle" role="switch" ${mobileDatePinned()?'checked':''} data-dashboard-change="mobile-date-pin"><span class="mobile-date-pin-track" aria-hidden="true"><span></span></span></label><button type="button" data-dashboard-action="close-date-menu" aria-label="목차 닫기">×</button></div>${renderUnifiedMobileMenuContent()}</div>
        </div>
      </div>
    </div>`;
  syncMobileTopbarState();
}
function metricCard(label,value,sub,dark=false,vcls=''){return `<div class="card metric-card ${dark?'dark':''}"><div class="label">${label}</div><div class="value ${vcls}">${value}</div><div class="sub">${sub}</div></div>`}

function mobileViewAttrs(key){
  const mode=uiState.mobileViewModes[key]||'card';
  return `data-mobile-view-key="${key}" data-mobile-view="${mode}"`;
}
function mobileViewToggle(key){
  const mode=uiState.mobileViewModes[key]||'card';
  const label=mode==='card'?'표 보기':'카드 보기';
  return `<button type="button" class="section-control-chip section-action-chip mobile-view-toggle" data-mobile-view-button="${key}" data-dashboard-action="toggle-mobile-view" data-mobile-view-key="${key}">${label}</button>`;
}
function toggleMobileDataView(key){
  const current=uiState.mobileViewModes[key]||'card';
  const next=current==='card'?'table':'card';
  uiState.mobileViewModes[key]=next;
  document.querySelectorAll(`[data-mobile-view-key="${key}"]`).forEach(el=>el.dataset.mobileView=next);
  document.querySelectorAll(`[data-mobile-view-button="${key}"]`).forEach(btn=>btn.textContent=next==='card'?'표 보기':'카드 보기');
}
function mobileInfoCard(title,items=[],extraClass=''){
  return `<article class="mobile-data-card ${extraClass}"><div class="mobile-data-card-title">${title}</div><div class="mobile-data-card-list">${items.map(item=>{const [label,value,valueClass='',rowClass='']=item;return `<div class="mobile-data-card-row ${rowClass}"><span class="mobile-data-card-label">${label}</span><span class="mobile-data-card-value ${valueClass}">${value}</span></div>`}).join('')}</div></article>`;
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
    button.textContent='↑ TOP';
    button.setAttribute('aria-label','화면 맨 위로 이동');
    button.addEventListener('click',scrollToDashboardTop);
    document.body.appendChild(button);
  }
  const update=()=>button.classList.toggle('show',(window.scrollY||document.documentElement.scrollTop||0)>220);
  if(!uiState.mobileTopScrollBound){
    uiState.mobileTopScrollBound=true;
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
document.addEventListener('click',e=>{
  if(!e.target.closest('#tabs')) closeDateActionMenu();
});
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

  // selected: 현재 화면의 기준일을 강제로 재갱신
  // auto: 날짜를 보내지 않아 서버가 최신/누락 여부와 종가 반영 상태를 판단한다.
  // 이미 종가가 반영된 경우 서버측 조건에 따라 워크플로 실행을 건너뛴다.
  if(updateMode==='selected'){
    body.date=selectedDate;
  }

  const res=await fetch(config.url,{
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
  modal.className='krx-action-modal';
  modal.innerHTML=`<div class="krx-action-card" role="dialog" aria-modal="true" aria-labelledby="krxActionTitle">
    <button type="button" class="krx-action-close" data-dashboard-action="close-krx-modal" aria-label="닫기">×</button>
    <div class="krx-action-icon">📈</div>
    <h3 id="krxActionTitle">KRX 현재가 반영</h3>
    <p>선택한 기준일만 다시 갱신하거나, 날짜를 비워 누락 거래일을 자동 보충할 수 있습니다. Pages 반영까지 몇 분 걸릴 수 있습니다.</p>
    <label class="krx-action-label" for="krxActionPin">저장/실행 PIN</label>
    <input id="krxActionPin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN 입력">
    <div id="krxActionStatus" class="krx-action-status"></div>
    <div class="krx-action-buttons">
      <button type="button" class="ghost" data-dashboard-action="close-krx-modal">취소</button>
      <button type="button" class="ghost" data-dashboard-action="submit-krx-modal" data-krx-mode="auto">최신/누락 반영</button>
      <button type="button" class="primary" data-dashboard-action="submit-krx-modal" data-krx-mode="selected"><span class="krx-selected-line">선택일</span><span class="krx-selected-space"> </span><span class="krx-selected-line">재갱신</span></button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeKrxActionModal()});
  return modal;
}
function openKrxActionModal(){
  const modal=ensureKrxActionModal();
  const status=modal.querySelector('#krxActionStatus');
  const input=modal.querySelector('#krxActionPin');
  if(status){status.textContent='';status.className='krx-action-status'}
  modal.classList.add('show');
  setTimeout(()=>input?.focus(),30);
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
  if(modal) modal.classList.remove('show');
  forceMobileViewportReflow();
}
async function submitKrxActionModal(mode='selected'){
  const modal=ensureKrxActionModal();
  const input=modal.querySelector('#krxActionPin');
  const status=modal.querySelector('#krxActionStatus');
  const buttons=modal.querySelectorAll('.krx-action-buttons button');
  const pin=String(input?.value||'').trim();
  const updateMode=mode==='auto'?'auto':'selected';
  const selectedDate=dataState.activeDate || '';
  if(!pin){
    if(status){status.textContent='PIN을 입력해 주세요.';status.className='krx-action-status err'}
    input?.focus();
    return;
  }
  try{
    buttons.forEach(btn=>btn.disabled=true);
    if(status){
      status.textContent=updateMode==='selected'
        ? `${selectedDate} KRX 현재가 재갱신 요청 중...`
        : '최신/누락 KRX 현재가 반영 요청 중...';
      status.className='krx-action-status ok';
    }
    const data = await dispatchKrxPriceUpdate(pin, updateMode);

    if(data.action === 'workflow_skipped'){
      const msg = data.message || '업데이트할 KRX 현재가 데이터가 없습니다.';
      if(status){status.textContent=msg;status.className='krx-action-status ok'}
      showAppToast(msg, 'ok', 6500);
      return;
    }

    const successMsg=updateMode==='selected'
      ? `${selectedDate} KRX 현재가 재갱신 요청 완료. GitHub Actions 완료 후 새로고침해 주세요.`
      : '최신/누락 KRX 현재가 반영 요청 완료. GitHub Actions 완료 후 새로고침해 주세요.';
    if(status){status.textContent=successMsg;status.className='krx-action-status ok'}
    showAppToast(updateMode==='selected'?'선택일 KRX 재갱신 요청 완료':'KRX 자동 반영 요청 완료', 'ok');
    setTimeout(closeKrxActionModal,2000);
  }catch(e){
    if(status){status.textContent='실패: '+(e.message||String(e));status.className='krx-action-status err'}
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
    syncResponsiveChartControls();
    refreshScrollHints();
    if(scroll)document.getElementById('asset-workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
}
function assetTabForTarget(id){
  const el=document.getElementById(id);
  return el?.closest?.('[data-asset-panel]')?.dataset?.assetPanel||null;
}
function jumpToSection(id){
  const targetTab=assetTabForTarget(id);
  if(targetTab&&targetTab!==uiState.activeAssetTab)setAssetTab(targetTab);
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
function renderSecuritiesSummaryCards(x){
  const securitiesScope=securitiesScopeText(x),v=separateProfitView(x);
  const principalNote=uiState.includeSeparateProfit&&v.reclassifiedReinvestment?`별도수익 재투입 ${won(v.reclassifiedReinvestment)} 원금 제외`:x.account2Included?'계좌2 실현분·성과 제외 자금 전입 포함 기준':'선택일 계좌1 투자원금 기준';
  const returnNote=uiState.includeSeparateProfit?'별도수익 포함 누적손익 ÷ 성과기준 투입원금':'총 합산 누적손익 ÷ 기준 투입원금';
  return `<div class="securities-subsection securities-summary-block"><div class="grid cards metric-grid">${metricCard('증권계좌 투자 결과물',won(v.totalResult),`${securitiesScope} 기준`,true)}${metricCard('기준 투입원금',won(v.totalPrincipal),principalNote)}${metricCard('총 합산 누적손익',won(v.totalProfit),`${securitiesScope} 누적손익`,false,cls(v.totalProfit))}${metricCard('투자대비 이익률',pct(v.totalReturn),returnNote,false,cls(v.totalReturn))}</div></div>`;
}
function renderSecuritiesSection(x){
  return `<section id="securities-section"><div class="section-title"><h2><span class="section-title-icon">🏦</span>증권계좌 현황</h2>${separateProfitControl(x,'section-inline')}</div><div class="securities-band">${renderSecuritiesSummaryCards(x)}${sectionToSecuritiesBlock(renderAccounts(x),'accounts-block')}${sectionToSecuritiesBlock(renderHoldings(x),'holdings-block')}${sectionToSecuritiesBlock(renderCharts(x,separateProfitControl(x,'chart-inline')),'charts-block')}${sectionToSecuritiesBlock(renderResultSummary(x),'ledger-block')}${isLedgerCheckDate(x.date)?sectionToSecuritiesBlock(renderSourceTables(x),'source-block'):''}</div></section>`;
}


function suppressSecuritiesCumCardTransitionOnce(){
  if(!chartState.skipSecuritiesCumCardTransitionOnce)return;
  chartState.skipSecuritiesCumCardTransitionOnce=false;
  const card=document.getElementById('chart-cum');
  if(!card)return;
  const nodes=[card,...card.querySelectorAll('.mini-card')];
  nodes.forEach(node=>node.style.setProperty('transition','none','important'));
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    nodes.forEach(node=>node.style.removeProperty('transition'));
  }));
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
  const reasonDetail='현재 보유액에서 제외된 사용분';
  const footnoteMark='<span class="cash-basis-note-mark">(1)</span>';
  const footnoteSup='<sup class="cash-basis-note-mark cash-basis-note-sup">(1)</sup>';
  const outsideCashFlowText=outsideCashUsed?`6/18 확인값 ${won(outsideCashBase)} - 투자 사용 ${won(outsideCashUsed)}`:`6/18 확인값 ${won(outsideCashBase)}`;
  const note=uiState.includeSeparateProfit
    ?`<p class="section-explainer table-note cash-basis-note">${footnoteMark} 실현수익 반영 현금 보유액 ${won(outsideCashBasis)} = ${outsideCashFlowText} + 6~8월 별도손익 중 현 보유자산 미반영분 ${won(separateUnreflected)}</p>`
    :`<p class="section-explainer table-note cash-basis-note">${footnoteMark} 실현수익 반영 현금 보유액 ${won(outsideCash)} = ${outsideCashFlowText}</p>`;
  const ledgerSourceSub='계좌1 성과 + 계좌2 실현분 + 토스 실현분 기준<br>출처: 연금+계좌 성과 &gt; 증권계좌 투자 결과물';
  const actualHoldingSub=`증권계좌 평가총액(${won(x.allocTotal)}) +<br>실현수익 반영 현금 보유액(${won(outsideCashBasis)})${footnoteSup}`;
  return `<section id="ledger-check"><div class="section-title"><h2><span class="section-title-icon">🔍</span>장부결과 VS 실제보유</h2>${separateProfitControl(x,'section-inline')}</div><div class="grid cards metric-grid">${metricCard('장부상 증권계좌 투자 결과물(A)',won(v.totalResult),ledgerSourceSub,true)}${metricCard('현재 증권계좌 및 현금 보유액(B)',won(actualHoldingAndCash),actualHoldingSub)}${metricCard('차액(A-B)',won(ledgerGap),'장부상 결과물과 실제 보유액의 차이',false,ledgerGap!==0?'ledger-gap-value':'')}${metricCard('차액 발생 이유',reasonValue,reasonDetail,false,'ledger-reason-value')}</div>${note}</section>`;
}

function holdingRowCssClass(h){
  const cssClass=String(h?.cssClass||'');
  if(String(h?.ticker||'')==='009150')return '';
  return cssClass==='ticker-mini'&&Number(h?.qty)!==1?'':cssClass;
}

function renderHoldings(x){
  const holdCost=x.holdings.reduce((a,h)=>a+h.cost,0),
        holdEval=x.holdings.reduce((a,h)=>a+h.evalAmount,0),
        holdProfit=holdEval-holdCost,
        holdFeeAdjusted=x.holdings.reduce((a,h)=>a+(Number(h.feeAdjustedProfit ?? h.profit) || 0),0),
        cash=Number(x.securitiesCash||0),
        totalCostWithCash=holdCost+cash,
        totalEvalWithCash=holdEval+cash,
        holdReturn=holdCost?holdProfit/holdCost*100:0,
        totalReturnWithCash=totalCostWithCash?holdProfit/totalCostWithCash*100:0;
  const orderedHoldings=sortSecurityItems(x.holdings.filter(h=>(Number(h?.qty)||0)>0));
  const cards=orderedHoldings.map(h=>mobileInfoCard(`<span class="holding-name-text">${h.name}</span>${securitySymbolSwatch(h.name)}`,[
    ['수량',fmt(h.qty)],
    ['평단',won(h.avgPrice ?? (h.qty?h.cost/h.qty:0))],
    ['투자원금',won(h.cost)],
    ['현재가',won(h.price)],
    ['평가금액',won(h.evalAmount)],
    ['평가손익',won(h.profit),cls(h.profit)],
    ['손익률',pct(h.returnRate),cls(h.returnRate)]
  ],holdingRowCssClass(h))).join('')+
  mobileInfoCard('보유종목 합계',[
    ['투자원금',won(holdCost)],['평가금액',won(holdEval)],['평가손익',won(holdProfit),cls(holdProfit)],['손익률',pct(holdReturn),cls(holdReturn)]
  ],'summary-card mobile-total-card')+
  mobileInfoCard('증권계좌 현금',[
    ['투자원금',won(cash)],['평가금액',won(cash)],['평가손익',won(0)],['손익률',pct(0)]
  ])+
  mobileInfoCard('총계(보유분+현금)',[
    ['투자원금',won(totalCostWithCash)],['평가금액',won(totalEvalWithCash)],['평가손익',won(holdProfit),cls(holdProfit)],['손익률',pct(totalReturnWithCash),cls(totalReturnWithCash)]
  ],'summary-card mobile-total-card');
  return `<section id="securities-holdings" ${mobileViewAttrs('holdings')}><div class="section-title"><h2><span class="section-title-icon">📁</span>증권계좌 보유분</h2>${mobileViewToggle('holdings')}</div><div class="mobile-scroll table-view"><table class="dashboard-data-table hold-position-table"><thead><tr><th>종목명</th><th class="table-cell-center">수량</th><th>평단</th><th>투자원금</th><th>현재가</th><th>평가금액</th><th>평가손익</th><th class="table-cell-center">손익률</th></tr></thead><tbody>${orderedHoldings.map(h=>`<tr class="hold-row ${holdingRowCssClass(h)}"><td><span class="holding-name-text">${h.name}</span>${securitySymbolSwatch(h.name)}</td><td class="num table-cell-center">${fmt(h.qty)}</td><td class="num">${fmt(h.avgPrice ?? (h.qty?h.cost/h.qty:0))}</td><td class="num">${fmt(h.cost)}</td><td class="num">${fmt(h.price)}</td><td class="num">${fmt(h.evalAmount)}</td><td class="num ${tableCls(h.profit)}">${fmt(h.profit)}</td><td class="num table-cell-center ${tableCls(h.returnRate)}">${pct(h.returnRate)}</td></tr>`).join('')}<tr class="summary-row"><td>보유종목 합계</td><td class="num table-cell-center">-</td><td class="num">-</td><td class="num">${fmt(holdCost)}</td><td class="num">-</td><td class="num">${fmt(holdEval)}</td><td class="num ${tableCls(holdProfit)}">${fmt(holdProfit)}</td><td class="num table-cell-center ${tableCls(holdReturn)}">${pct(holdReturn)}</td></tr><tr><td>증권계좌 현금</td><td class="num table-cell-center">-</td><td class="num">-</td><td class="num">${fmt(cash)}</td><td class="num">-</td><td class="num">${fmt(cash)}</td><td class="num">0</td><td class="num table-cell-center">0.00%</td></tr><tr class="summary-row"><td>총계(보유분+현금)</td><td class="num table-cell-center">-</td><td class="num">-</td><td class="num">${fmt(totalCostWithCash)}</td><td class="num">-</td><td class="num">${fmt(totalEvalWithCash)}</td><td class="num ${tableCls(holdProfit)}">${fmt(holdProfit)}</td><td class="num table-cell-center ${tableCls(totalReturnWithCash)}">${pct(totalReturnWithCash)}</td></tr></tbody></table></div><div class="mobile-card-view">${cards}</div></section>`;
}

function renderCombined(x){
  const v=separateProfitView(x),returnLabel='투자대비 이익률',mobileReturnPct=n=>(Number(n)||0).toFixed(1)+'%';
  const cards=mobileInfoCard('퇴직연금',[
    ['투입원금',won(x.pensionPrincipal)],['투자 결과물',won(x.pensionEval)],['누적손익',won(x.pensionProfit),cls(x.pensionProfit)],['투자대비 이익률',pct(x.pensionReturn),cls(x.pensionReturn)]
  ])+mobileInfoCard('증권계좌',[
    ['투입원금',won(v.totalPrincipal)],['투자 결과물',won(v.totalResult)],['누적손익',won(v.totalProfit),cls(v.totalProfit)],[returnLabel,pct(v.totalReturn),cls(v.totalReturn)]
  ])+mobileInfoCard('합산',[
    ['투입원금',won(v.combinedPrincipal)],['투자 결과물',won(v.combinedResult)],['누적손익',won(v.combinedProfit),cls(v.combinedProfit)],[returnLabel,pct(v.combinedReturn),cls(v.combinedReturn)]
  ],'summary-card mobile-total-card');
  return `<section id="summary-section" ${mobileViewAttrs('combined')}><div class="section-title"><h2><span class="section-title-icon">🏠</span>연금+계좌 성과</h2><div class="section-title-actions">${separateProfitControl(x,'section-inline')}${mobileViewToggle('combined')}</div></div><div class="mobile-scroll table-view"><table class="dashboard-data-table combined-performance-table"><thead><tr><th>구분</th><th>투입원금</th><th>투자 결과물</th><th>누적손익</th><th class="table-cell-center">${returnLabel}</th></tr></thead><tbody><tr><td><strong>퇴직연금</strong></td><td class="num">${fmt(x.pensionPrincipal)}</td><td class="num">${fmt(x.pensionEval)}</td><td class="num ${tableCls(x.pensionProfit)}">${fmt(x.pensionProfit)}<span class="combined-mobile-return ${tableCls(x.pensionReturn)}"> (${mobileReturnPct(x.pensionReturn)})</span></td><td class="num table-cell-center ${tableCls(x.pensionReturn)}">${pct(x.pensionReturn)}</td></tr><tr><td><strong>증권계좌</strong></td><td class="num">${fmt(v.totalPrincipal)}</td><td class="num">${fmt(v.totalResult)}</td><td class="num ${tableCls(v.totalProfit)}">${fmt(v.totalProfit)}<span class="combined-mobile-return ${tableCls(v.totalReturn)}"> (${mobileReturnPct(v.totalReturn)})</span></td><td class="num table-cell-center ${tableCls(v.totalReturn)}">${pct(v.totalReturn)}</td></tr><tr class="summary-row"><td>합산</td><td class="num">${fmt(v.combinedPrincipal)}</td><td class="num">${fmt(v.combinedResult)}</td><td class="num ${tableCls(v.combinedProfit)}">${fmt(v.combinedProfit)}<span class="combined-mobile-return ${tableCls(v.combinedReturn)}"> (${mobileReturnPct(v.combinedReturn)})</span></td><td class="num table-cell-center ${tableCls(v.combinedReturn)}">${pct(v.combinedReturn)}</td></tr></tbody></table></div><div class="mobile-card-view">${cards}</div></section>`;
}

function accountMemoTableHtml(text){
  const parts=String(text||'').match(/[^.]+\.(?:\s*|$)|[^.]+$/g)||[];
  return parts.map(part=>`<span class="accounts-memo-sentence">${part.trim()}</span>`).join(' ');
}
function renderAccounts(x){
  const c=dataState.portfolio.constants,v=separateProfitView(x);
  const rows=[
    ['삼성증권1',v.account1Principal,v.account1Profit,v.account1Return,'2025-10-16 최초 시작.'],
    ...(x.account2Included?[['삼성증권2',c.account2Principal,c.account2Profit,c.account2Profit/c.account2Principal*100,'2023-12-20 최초 시작. 2026-05-22 전량 매도 후 실현분 반영.']]:[]),
    ['토스증권',0,c.tossProfit,0,'2026-03-09 매수 후 익일 매도.']
  ];
  const totalMemo='계좌 간 자금 이동 반영';
  const hiddenNote=x.account2Included?'':'<p class="table-note"><strong>참고:</strong> 삼성증권2는 2026-05-22 전량 매도 후 실현분 반영. 선택일이 2026-05-21 이전이면 당시 전체 성과 기준에서 제외되어 이 표에서도 숨김.</p>';
  const cards=rows.map(r=>mobileInfoCard(r[0],[
    ['투자원금',r[1]?won(r[1]):'-'],['누적손익',won(r[2]),cls(r[2])],['수익률',r[1]?pct(r[3]):'-',r[1]?cls(r[3]):''],['',r[4],'','stacked note-only']
  ])).join('')+mobileInfoCard('합계',[
    ['투자원금',won(v.totalPrincipal)],['누적손익',won(v.totalProfit),cls(v.totalProfit)],['수익률',pct(v.totalReturn),cls(v.totalReturn)],['',totalMemo,'','stacked note-only']
  ],'summary-card mobile-total-card');
  const totalRow=`<tr class="summary-row"><td class="accounts-name">합계</td><td class="num">${fmt(v.totalPrincipal)}</td><td class="num ${tableCls(v.totalProfit)}">${fmt(v.totalProfit)}</td><td class="num table-cell-center ${tableCls(v.totalReturn)}">${pct(v.totalReturn)}</td><td class="accounts-memo">${totalMemo}</td></tr>`;
  return `<section id="accounts-summary" ${mobileViewAttrs('accounts')}><div class="section-title"><h2><span class="section-title-icon">📋</span>계좌별 성과 요약</h2><div class="section-title-actions">${separateProfitControl(x,'section-inline')}${mobileViewToggle('accounts')}</div></div><div class="mobile-scroll accounts-scroll table-view"><table class="dashboard-data-table accounts-table"><thead><tr><th class="accounts-name-head">구분</th><th>투자원금</th><th>누적손익</th><th class="table-cell-center">수익률</th><th>메모</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="accounts-name">${r[0]}</td><td class="num">${r[1]?fmt(r[1]):'-'}</td><td class="num ${tableCls(r[2])}">${fmt(r[2])}</td><td class="num table-cell-center ${r[1]?tableCls(r[3]):''}">${r[1]?pct(r[3]):'-'}</td><td class="accounts-memo">${accountMemoTableHtml(r[4])}</td></tr>`).join('')}${totalRow}</tbody></table></div><div class="mobile-card-view">${cards}</div>${hiddenNote}</section>`;
}
function renderSourceTables(x){
  const c=dataState.portfolio.constants,
    vipProfitReinvest=c.account2ReinvestedToAccount1-c.account2Principal,
    extraContribution=securityExternalContributionSum(x.date),
    excludedTransfer=securityExcludedTransferSum(x.date),
    internalCashTransfer=securityInternalCashTransferSum(x.date),
    sourceTrackedPrincipal=account1SourcePrincipalForDate(x.date),
    sourceHoldingGap=account1SourceHoldingGapForDate(x.date),
    holdingCostPrincipal=account1PrincipalForDate(x.date),
    externalPrincipal=sourceExternalPrincipalForDate(x.date),
    reclassified=uiState.includeSeparateProfit?separateProfitReinvestedForDate(x.date):0,
    performancePrincipal=holdingCostPrincipal-reclassified,
    extraRow=extraContribution?`<tr><td>추가 외부투입</td><td class="num">${fmt(extraContribution)}</td></tr>`:'',
    excludedRow=!uiState.includeSeparateProfit&&excludedTransfer?`<tr><td>보유 자금 투입</td><td class="num">${fmt(excludedTransfer)}</td></tr>`:'',
    internalCashRow=internalCashTransfer?`<tr><td>실현수익 투입</td><td class="num">${fmt(internalCashTransfer)}</td></tr>`:'',
    reconciliationRow=`<tr><td>원천·보유 차액</td><td class="num">${fmt(sourceHoldingGap)}</td></tr>`,
    reclassNote=uiState.includeSeparateProfit&&reclassified?`<div class="source-reclass-note"><strong>6~8월 별도수익 재투입 ${won(reclassified)}</strong><span>기존 투자수익 재투자분 · 신규 외부투입금 아님</span><span>전체 투입원금 제외 · 별도수익 ON 시 성과기준 원금 제외</span></div>`:'',
    principalLabel=uiState.includeSeparateProfit&&reclassified?'계좌1 성과기준 투자원금':'계좌1 투자원금 검산',
    principalSummaryLabel='합계';
  return `<section id="capital-source-check" class="capital-source-section"><div class="section-title source-title"><h2><span class="section-title-icon">🧾</span>투자원금 원천 및 검산</h2>${separateProfitControl(x,'section-inline')}</div><div class="grid three source-grid"><div class="card source-card metric-card"><div class="label">계좌1 원천별 추적</div><div class="value">${won(performancePrincipal)}</div><div class="mobile-scroll source-table-scroll"><table class="dashboard-data-table source-data-table"><tbody><tr><td>금 판매액 투입</td><td class="num">4,000,000</td></tr><tr><td>근로소득 투입</td><td class="num">7,036,104</td></tr><tr><td>임시자금 투입</td><td class="num">4,955,580</td></tr><tr><td>원금 회수</td><td class="num">-6,089,845</td></tr><tr><td>레버수익 재투입</td><td class="num">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr><td>VIP 재투입</td><td class="num">${fmt(c.account2ReinvestedToAccount1)}</td></tr>${excludedRow}${internalCashRow}${extraRow}${reconciliationRow}<tr class="summary-row"><td>합계</td><td class="num">${fmt(performancePrincipal)}</td></tr></tbody></table></div></div><div class="card source-card metric-card highlight"><div class="label">전체 투입원금</div><div class="value">${won(externalPrincipal)}</div><div class="mobile-scroll source-table-scroll"><table class="dashboard-data-table source-data-table"><tbody><tr><td>금 판매액 총액</td><td class="num">${fmt(c.goldPrincipal)}</td></tr><tr><td>근로소득 투입액</td><td class="num">${fmt(c.laborNetPrincipal)}</td></tr>${extraRow}<tr class="summary-row"><td>합계</td><td class="num">${fmt(externalPrincipal)}</td></tr></tbody></table></div>${reclassNote}</div><div class="card source-card metric-card"><div class="label">${principalLabel}</div><div class="value">${won(performancePrincipal)}</div><div class="mobile-scroll source-table-scroll"><table class="dashboard-data-table source-data-table"><tbody><tr><td>전체 투입원금</td><td class="num">${fmt(externalPrincipal)}</td></tr><tr><td>레버수익 재투입</td><td class="num">${fmt(c.tossReinvestedToAccount1)}</td></tr><tr><td>VIP 수익 재투입</td><td class="num">${fmt(vipProfitReinvest)}</td></tr>${excludedRow}${internalCashRow}${reconciliationRow}<tr class="summary-row"><td>${principalSummaryLabel}</td><td class="num">${fmt(performancePrincipal)}</td></tr></tbody></table></div></div></div></section>`;
}

