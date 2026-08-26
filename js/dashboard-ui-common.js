import {
  dataState,
  pensionSeriesColor,
  securityAllocationColor,
  securityChartNamesForDate
} from './dashboard-core.js';

// 여러 UI 모듈이 공유하는 저수준 DOM · 접근성 · 마크업 · 반응형 UI 판정 helper

// Responsive Predicate · 반응형 UI 판정
const PHONE_LANDSCAPE_QUERY='(orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse)';
function phoneLandscapeUi(){
  return window.matchMedia?.(PHONE_LANDSCAPE_QUERY).matches===true;
}

// Dialog Focus / Accessibility · 다이얼로그 포커스 / 접근성
const dashboardDialogFocusState=new WeakMap();
let dashboardDialogBodyLockCount=0;
function dashboardDialogBackgroundElements(container){
  const elements=[];
  let current=container;
  while(current&&current!==document.body){
    const parent=current.parentElement;
    if(!parent)break;
    [...parent.children].forEach(sibling=>{if(sibling!==current)elements.push(sibling)});
    current=parent;
  }
  return [...new Set(elements)];
}
function lockDashboardDialogBody(state){
  if(!state||state.bodyLocked)return;
  state.bodyLocked=true;
  dashboardDialogBodyLockCount+=1;
  document.body?.classList.add('dashboard-dialog-open');
}
function unlockDashboardDialogBody(state){
  if(!state?.bodyLocked)return;
  state.bodyLocked=false;
  dashboardDialogBodyLockCount=Math.max(0,dashboardDialogBodyLockCount-1);
  if(dashboardDialogBodyLockCount===0)document.body?.classList.remove('dashboard-dialog-open');
}
function setDashboardDialogBackgroundInert(container,state){
  if(!container||!state||state.inertSnapshot)return;
  const snapshot=new Map();
  dashboardDialogBackgroundElements(container).forEach(element=>{
    snapshot.set(element,element.inert===true);
    element.inert=true;
  });
  state.inertSnapshot=snapshot;
}
function restoreDashboardDialogBackgroundInert(state){
  if(!state?.inertSnapshot)return;
  state.inertSnapshot.forEach((wasInert,element)=>{
    if(element?.isConnected)element.inert=wasInert;
  });
  state.inertSnapshot=null;
}
function dashboardElementVisible(el){
  if(!el||!el.isConnected||el.disabled)return false;
  const style=getComputedStyle(el);
  return style.display!=='none'&&style.visibility!=='hidden'&&(el.offsetWidth>0||el.offsetHeight>0||el.getClientRects().length>0);
}
function dashboardDialogFocusables(container){
  if(!container)return [];
  return [...container.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(dashboardElementVisible);
}
function dashboardVisibleFallback(selector){
  if(!selector)return null;
  return [...document.querySelectorAll(selector)].find(dashboardElementVisible)||null;
}
function dashboardReturnFocusVisible(el){
  if(!dashboardElementVisible(el)||el===document.body||el===document.documentElement)return false;
  const tag=String(el.tagName||'').toLowerCase();
  return typeof el.focus==='function'&&(el.tabIndex>=0||['a','button','input','select','textarea','summary'].includes(tag));
}
function activateDashboardDialogFocus(container,{initialFocus=null,fallbackSelector='',returnFocus=null}={}){
  if(!container)return;
  let state=dashboardDialogFocusState.get(container);
  if(!state){
    state={returnFocus:null,fallbackSelector:'',keydown:null,inertSnapshot:null,bodyLocked:false};
    state.keydown=event=>{
      if(event.key!=='Tab')return;
      const focusables=dashboardDialogFocusables(container);
      if(!focusables.length){event.preventDefault();return;}
      const first=focusables[0],last=focusables.at(-1),active=document.activeElement;
      if(event.shiftKey&&(active===first||!container.contains(active))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(active===last||!container.contains(active))){event.preventDefault();first.focus();}
    };
    container.addEventListener('keydown',state.keydown);
    dashboardDialogFocusState.set(container,state);
  }
  if(returnFocus)state.returnFocus=returnFocus;
  else if(!container.contains(document.activeElement)&&dashboardReturnFocusVisible(document.activeElement))state.returnFocus=document.activeElement;
  state.fallbackSelector=fallbackSelector||state.fallbackSelector||'';
  setDashboardDialogBackgroundInert(container,state);
  lockDashboardDialogBody(state);
  const resolveInitial=()=>typeof initialFocus==='string'?container.querySelector(initialFocus):initialFocus;
  requestAnimationFrame(()=>{
    const target=resolveInitial()||dashboardDialogFocusables(container)[0];
    target?.focus?.({preventScroll:true});
  });
}
function releaseDashboardDialogFocus(container,{fallbackSelector=''}={}){
  if(!container)return;
  const state=dashboardDialogFocusState.get(container);
  const stored=state?.returnFocus||null;
  const fallback=fallbackSelector||state?.fallbackSelector||'';
  restoreDashboardDialogBackgroundInert(state);
  unlockDashboardDialogBody(state);
  if(state){state.returnFocus=null;state.fallbackSelector='';}
  requestAnimationFrame(()=>{
    const target=dashboardReturnFocusVisible(stored)?stored:dashboardVisibleFallback(fallback);
    target?.focus?.({preventScroll:true});
  });
}

// Icon / Markup Helpers · 아이콘 / 마크업 helper
const NAV_ICON_ATTRS='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
const NAV_ICONS=Object.freeze({
    sun:`<svg ${NAV_ICON_ATTRS}><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>`,
    moon:`<svg ${NAV_ICON_ATTRS}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    cornerSoft:`<svg ${NAV_ICON_ATTRS}><rect x="4" y="4" width="16" height="16" rx="1.5"></rect></svg>`,
    cornerRounded:`<svg ${NAV_ICON_ATTRS}><rect x="4" y="4" width="16" height="16" rx="5"></rect></svg>`,
    link:`<svg ${NAV_ICON_ATTRS}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"></path></svg>`,
    activity:`<svg ${NAV_ICON_ATTRS}><path d="M22 12h-4l-3 8-6-16-3 8H2"></path></svg>`,
    refresh:`<svg ${NAV_ICON_ATTRS}><path d="M21 12a9 9 0 0 1-15.5 6.2"></path><path d="M3 12A9 9 0 0 1 18.5 5.8"></path><path d="M18 2v4h4"></path><path d="M6 22v-4H2"></path></svg>`,
    menu:`<svg ${NAV_ICON_ATTRS}><path d="M4 6h16M4 12h16M4 18h16"></path></svg>`,
    close:`<svg ${NAV_ICON_ATTRS}><path d="M18 6 6 18M6 6l12 12"></path></svg>`,
    reset:`<svg ${NAV_ICON_ATTRS}><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path></svg>`,
    chevronUp:`<svg ${NAV_ICON_ATTRS}><path d="m18 15-6-6-6 6"></path></svg>`,
    chevronDown:`<svg ${NAV_ICON_ATTRS}><path d="m6 9 6 6 6-6"></path></svg>`,
    chevronRight:`<svg ${NAV_ICON_ATTRS}><path d="m9 18 6-6-6-6"></path></svg>`,
    arrowLeft:`<svg ${NAV_ICON_ATTRS}><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>`,
    arrowRight:`<svg ${NAV_ICON_ATTRS}><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`,
    arrowUp:`<svg ${NAV_ICON_ATTRS}><path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path></svg>`,
    trash:`<svg ${NAV_ICON_ATTRS}><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"></path></svg>`,
    wallet:`<svg ${NAV_ICON_ATTRS}><path d="M20 7H5a3 3 0 0 0 0 6h15v6H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h15v3Z"></path><path d="M16 13h.01"></path></svg>`,
    calculator:`<svg ${NAV_ICON_ATTRS}><rect x="5" y="2" width="14" height="20" rx="2"></rect><path d="M8 6h8"></path><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>`,
    home:`<svg ${NAV_ICON_ATTRS}><path d="m3 10 9-7 9 7"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path></svg>`,
    briefcase:`<svg ${NAV_ICON_ATTRS}><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path></svg>`,
    package:`<svg ${NAV_ICON_ATTRS}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"></path><path d="M12 12 4.5 7.8"></path><path d="M12 12l7.5-4.2"></path><path d="M12 12v9"></path></svg>`,
    trending:`<svg ${NAV_ICON_ATTRS}><path d="m3 17 6-6 4 4 8-8"></path><path d="M14 7h7v7"></path></svg>`,
    chart:`<svg ${NAV_ICON_ATTRS}><path d="M3 3v18h18"></path><path d="M7 15v2"></path><path d="M12 11v6"></path><path d="M17 7v10"></path></svg>`,
    period:`<svg ${NAV_ICON_ATTRS}><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"></path></svg>`,
    lineChart:`<svg ${NAV_ICON_ATTRS}><path d="M3 3v18h18"></path><path d="m7 16 4-5 3 3 5-7"></path></svg>`,
    barChart:`<svg ${NAV_ICON_ATTRS}><path d="M4 20V11h4v9M10 20V5h4v15M16 20v-7h4v7"></path></svg>`,
    pie:`<svg ${NAV_ICON_ATTRS}><path d="M21 12a9 9 0 1 1-9-9v9h9Z"></path><path d="M12 3a9 9 0 0 1 9 9"></path></svg>`,
    bank:`<svg ${NAV_ICON_ATTRS}><path d="m3 9 9-6 9 6"></path><path d="M4 10h16"></path><path d="M6 10v8"></path><path d="M10 10v8"></path><path d="M14 10v8"></path><path d="M18 10v8"></path><path d="M3 18h18"></path><path d="M2 21h20"></path></svg>`,
    list:`<svg ${NAV_ICON_ATTRS}><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>`,
    folder:`<svg ${NAV_ICON_ATTRS}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>`,
    search:`<svg ${NAV_ICON_ATTRS}><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>`,
    receipt:`<svg ${NAV_ICON_ATTRS}><path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path></svg>`,
    alertTriangle:`<svg ${NAV_ICON_ATTRS}><path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`,
});
function navIconSvg(name){
  return NAV_ICONS[name]||NAV_ICONS.list;
}

const assetColorSwatch=color=>color?`<span class="asset-color-swatch" style="--asset-swatch-color:${color}" aria-hidden="true">■</span>`:'';
const securitySymbolSwatch=name=>(!dataState.activeDate||securityChartNamesForDate(dataState.activeDate).includes(name))?assetColorSwatch(securityAllocationColor(name)):'';
const pensionProductSwatch=name=>assetColorSwatch(pensionSeriesColor(name));
const chartSeriesSwatch=color=>assetColorSwatch(color);

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}


function mobileTableAssetName(name=''){
  const text=String(name||'');
  const match=text.match(/^(KODEX|KOACT|KoAct)\s+/);
  if(!match)return escapeHtml(text);
  const prefix=match[0];
  return `<span class="mobile-table-brand-prefix">${escapeHtml(prefix)}</span>${escapeHtml(text.slice(prefix.length))}`;
}


// Asset Shared Renderers · 자산 공통 renderer
// 자산별 계산은 adapter가 소유하고, 이 레이어는 표현만 담당한다.
function renderAssetTableRows(rows=[]){
  return rows.map(row=>`<tr${row.className?` class="${row.className}"`:''}><th scope="row"${row.labelClass?` class="${row.labelClass}"`:''}>${row.labelHtml??''}</th>${(row.cells||[]).map(cell=>`<td${cell.className?` class="${cell.className}"`:''}>${cell.html??''}</td>`).join('')}</tr>`).join('');
}
function renderAssetTableHead(columns=[]){
  return columns.map(column=>`<th scope="col"${column.className?` class="${column.className}"`:''}>${column.label??''}</th>`).join('');
}
function renderAssetMobileCards(cards=[],mobileInfoCard){
  if(typeof mobileInfoCard!=='function')return '';
  return cards.map(card=>mobileInfoCard(card.title,card.items||[],card.extraClass||'',card.accessibleLabel||'')).join('');
}
function renderAssetStatusBlock({
  sectionId,
  idPrefix,
  viewStateKey,
  title,
  icon='package',
  sectionClass='note asset-status-note',
  tableClass='dashboard-data-table asset-status-table',
  caption='',
  columns=[],
  rows=[],
  summaryRows=[],
  cards=[],
  afterHtml='',
  mobileViewAttrs,
  mobileViewToggle,
  mobileInfoCard
}={}){
  const viewAttrs=typeof mobileViewAttrs==='function'?mobileViewAttrs(viewStateKey):'';
  const toggle=typeof mobileViewToggle==='function'?mobileViewToggle(viewStateKey):'';
  const tableRows=renderAssetTableRows([...rows,...summaryRows]);
  const cardHtml=renderAssetMobileCards(cards,mobileInfoCard);
  return `<div class="${sectionClass}" id="${sectionId}"${viewAttrs?` ${viewAttrs}`:''}><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="${icon}" aria-hidden="true"></span>${title}</h2>${toggle}</div><div id="${idPrefix}-table-view" class="mobile-scroll table-view"><table class="${tableClass}"><caption class="visually-hidden">${caption}</caption><thead><tr>${renderAssetTableHead(columns)}</tr></thead><tbody>${tableRows}</tbody></table></div><div id="${idPrefix}-card-view" class="mobile-card-view">${cardHtml}</div>${afterHtml}</div>`;
}
function renderAssetDayChangeBlock({
  sectionId,
  idPrefix,
  viewStateKey,
  title='전일 대비 변동',
  icon='trending',
  sectionClass='note asset-change-note',
  hasPrev=false,
  renderWithoutPrev=false,
  summaryItems=[],
  tableWrapClass='change-table-wrap mobile-scroll table-view',
  tableClass='dashboard-data-table asset-change-table',
  cardClass='change-mobile-list mobile-card-view',
  caption='',
  columns=[],
  rows=[],
  summaryRows=[],
  cards=[],
  noPrevHtml='',
  mobileViewAttrs,
  mobileViewToggle,
  mobileInfoCard
}={}){
  const viewAttrs=typeof mobileViewAttrs==='function'?mobileViewAttrs(viewStateKey):'';
  const showDetail=hasPrev||renderWithoutPrev;
  const toggle=showDetail&&typeof mobileViewToggle==='function'?mobileViewToggle(viewStateKey):'';
  const content=showDetail
    ? `<div class="change-kpis">${summaryItems.map(item=>`<div class="mini-card"><div class="m-label">${item.label??''}</div><div class="m-value ${item.valueClass||''}">${item.value??''}</div></div>`).join('')}</div><div id="${idPrefix}-table-view" class="${tableWrapClass}"><table class="${tableClass}"><caption class="visually-hidden">${caption}</caption><thead><tr>${renderAssetTableHead(columns)}</tr></thead><tbody>${renderAssetTableRows([...rows,...summaryRows])}</tbody></table></div><div id="${idPrefix}-card-view" class="${cardClass}">${renderAssetMobileCards(cards,mobileInfoCard)}</div>`
    : noPrevHtml;
  return `<div class="${sectionClass}" id="${sectionId}"${viewAttrs?` ${viewAttrs}`:''}><div class="section-title"><h2><span class="section-title-icon" data-section-title-icon="${icon}" aria-hidden="true"></span>${title}</h2>${toggle}</div>${content}</div>`;
}
function renderAssetWeight({label='',weight=0,color='',fillClass=''}={}){
  const safeWeight=Math.max(0,Math.min(100,Number(weight)||0));
  const weightText=safeWeight.toFixed(1);
  const fillClasses=['bar-fill',fillClass].filter(Boolean).join(' ');
  const fillStyle=`width:${weightText}%${color?`;background:${color}`:''}`;
  return `<div class="bar-box" role="progressbar" aria-label="${escapeHtml(label)} 비중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${weightText}" aria-valuetext="${weightText}%"><div class="${fillClasses}" aria-hidden="true" style="${fillStyle}"></div></div><div class="small data-table-sub">${weightText}%</div>`;
}
function renderAssetContributionCard({
  idPrefix='assetContribution',
  title='오늘 상승분 기여도',
  hasPrev=false,
  items=[],
  cardClass='asset-insight-card',
  headClass='asset-insight-head simple',
  stackClass='asset-stack-bar compact simple',
  segmentClass='asset-stack-segment has-tooltip',
  tooltipClass='asset-viz-tooltip',
  emptyClass='asset-empty-state',
  emptyNoItemsClass='asset-empty-state asset-contribution-empty-state',
  noPrevMessage='전일 데이터가 없어 오늘 상승분 기여도를 표시하지 않습니다.',
  emptyMessage='상승한 자산이 없어 기여도를 표시하지 않습니다.'
}={}){
  const titleId=`${idPrefix}InsightTitle`;
  const content=!hasPrev
    ? `<div class="${emptyClass}">${noPrevMessage}</div>`
    : items.length
      ? `<div class="${stackClass}" role="group" aria-label="${escapeHtml(title)} 구성">${items.map((item,index)=>{const tooltipId=`${idPrefix}Tooltip${index}`;const share=Number(item.share)||0;const valueText=item.valueText??'';const ariaLabel=escapeHtml(`${item.name} 상승분 기여도 ${share.toFixed(1)}%, ${valueText}`);return `<div class="${segmentClass}" tabindex="0" role="img" aria-label="${ariaLabel}" aria-describedby="${tooltipId}" style="width:${Math.max(share,2).toFixed(2)}%;background:${item.color}"><span>${share>=8?(item.shortLabel??item.name):''}</span><div id="${tooltipId}" class="${tooltipClass}" role="tooltip"><strong>${escapeHtml(item.name)}</strong><div>${share.toFixed(1)}%</div><div>${valueText}</div></div></div>`}).join('')}</div>`
      : `<div class="${emptyNoItemsClass||emptyClass}">${emptyMessage}</div>`;
  return `<div class="${cardClass}" role="group" aria-labelledby="${titleId}"><div class="${headClass}"><h3 id="${titleId}">${title}</h3></div>${content}</div>`;
}

const assetVizTooltipZoneSelectors=new Set();
let assetVizTooltipTouchBound=false;
// Asset Tooltip Interaction · 자산 시각화 툴팁 상호작용
function setupAssetVizTooltips(zoneSelector){
  if(zoneSelector)assetVizTooltipZoneSelectors.add(zoneSelector);
  if(assetVizTooltipTouchBound)return;
  assetVizTooltipTouchBound=true;

  const isTouchLike=()=>window.matchMedia('(hover: none)').matches||window.innerWidth<=900;
  const targetSelector=()=>[...assetVizTooltipZoneSelectors].map(selector=>`${selector} .has-tooltip`).join(',');
  const openSelector=()=>[...assetVizTooltipZoneSelectors].map(selector=>`${selector} .has-tooltip.tooltip-open`).join(',');
  const touchDragThreshold=6;
  let touchDragState=null;
  let suppressTouchClickTargets=[];
  let suppressTouchClickUntil=0;
  const clearTooltipFollow=target=>{
    if(!target)return;
    target.classList.remove('asset-tooltip-following');
    target.style.removeProperty('--asset-tooltip-left');
    target.style.removeProperty('--asset-tooltip-arrow-left');
  };
  const closeTooltips=except=>{
    const selector=openSelector();
    if(!selector)return;
    document.querySelectorAll(selector).forEach(el=>{
      if(el===except)return;
      el.classList.remove('tooltip-open');
      clearTooltipFollow(el);
    });
  };
  const positionStackTooltip=(target,event)=>{
    if(!target?.classList.contains('asset-stack-segment')||!Number.isFinite(event?.clientX))return;
    const tooltip=target.querySelector('.asset-viz-tooltip');
    if(!tooltip)return;
    const segmentRect=target.getBoundingClientRect();
    target.classList.add('asset-tooltip-following');
    target.style.setProperty('--asset-tooltip-left',`${event.clientX-segmentRect.left}px`);
    requestAnimationFrame(()=>{
      if(!target.isConnected||!target.classList.contains('asset-tooltip-following'))return;
      const tooltipRect=tooltip.getBoundingClientRect();
      const viewportWidth=Math.max(1,Math.min(window.innerWidth,window.visualViewport?.width||window.innerWidth));
      const pad=14;
      const width=Math.min(tooltipRect.width,Math.max(1,viewportWidth-pad*2));
      const half=width/2;
      const center=Math.max(pad+half,Math.min(event.clientX,viewportWidth-pad-half));
      const localLeft=center-segmentRect.left;
      const tooltipLeft=center-width/2;
      const arrowLeft=Math.max(10,Math.min(event.clientX-tooltipLeft,width-10));
      target.style.setProperty('--asset-tooltip-left',`${localLeft}px`);
      target.style.setProperty('--asset-tooltip-arrow-left',`${arrowLeft}px`);
    });
  };

  const targetAtPoint=(selector,event)=>{
    if(!selector||!Number.isFinite(event?.clientX)||!Number.isFinite(event?.clientY))return null;
    return document.elementFromPoint(event.clientX,event.clientY)?.closest(selector)||null;
  };
  const finishTouchDrag=(event,cancelled=false)=>{
    if(!touchDragState||touchDragState.pointerId!==event.pointerId)return;
    const {currentTarget,initialTarget,moved}=touchDragState;
    clearTooltipFollow(currentTarget);
    if(moved&&!cancelled){
      suppressTouchClickTargets=[initialTarget,currentTarget].filter(Boolean);
      suppressTouchClickUntil=performance.now()+600;
    }
    touchDragState=null;
  };

  document.addEventListener('pointerdown',event=>{
    const selector=targetSelector();
    const target=selector?event.target.closest(selector):null;
    if(event.pointerType==='touch'&&target?.classList.contains('asset-stack-segment')){
      closeTooltips(target);
      touchDragState={
        pointerId:event.pointerId,
        startX:event.clientX,
        startY:event.clientY,
        initialTarget:target,
        currentTarget:target,
        moved:false
      };
    }
    positionStackTooltip(target,event);
  });
  document.addEventListener('pointermove',event=>{
    const selector=targetSelector();
    if(event.pointerType==='touch'&&touchDragState?.pointerId===event.pointerId){
      const dx=event.clientX-touchDragState.startX;
      const dy=event.clientY-touchDragState.startY;
      if(Math.hypot(dx,dy)>=touchDragThreshold)touchDragState.moved=true;
      const target=targetAtPoint(selector,event);
      if(!target?.classList.contains('asset-stack-segment')){
        clearTooltipFollow(touchDragState.currentTarget);
        touchDragState.currentTarget=null;
        return;
      }
      if(target!==touchDragState.currentTarget){
        clearTooltipFollow(touchDragState.currentTarget);
        closeTooltips(target);
        touchDragState.currentTarget=target;
      }
      positionStackTooltip(target,event);
      return;
    }
    const target=selector?event.target.closest(selector):null;
    if(!target)return;
    positionStackTooltip(target,event);
  },{passive:true});
  document.addEventListener('pointerup',event=>finishTouchDrag(event));
  document.addEventListener('pointercancel',event=>finishTouchDrag(event,true));
  document.addEventListener('pointerout',event=>{
    if(event.pointerType==='touch'&&touchDragState?.pointerId===event.pointerId)return;
    const selector=targetSelector();
    const target=selector?event.target.closest(selector):null;
    if(!target||target.contains(event.relatedTarget)||target.classList.contains('tooltip-open'))return;
    clearTooltipFollow(target);
  });
  document.addEventListener('click',event=>{
    const selector=targetSelector();
    const target=selector?event.target.closest(selector):null;
    if(target&&suppressTouchClickTargets.includes(target)&&performance.now()<=suppressTouchClickUntil){
      event.preventDefault();
      event.stopPropagation();
      suppressTouchClickTargets=[];
      suppressTouchClickUntil=0;
      return;
    }
    suppressTouchClickTargets=[];
    suppressTouchClickUntil=0;
    if(!target){closeTooltips(null);return;}
    if(!isTouchLike())return;
    event.preventDefault();
    event.stopPropagation();
    positionStackTooltip(target,event);
    const shouldOpen=!target.classList.contains('tooltip-open');
    closeTooltips(target);
    target.classList.toggle('tooltip-open',shouldOpen);
    if(!shouldOpen)clearTooltipFollow(target);
  });
  document.addEventListener('scroll',()=>closeTooltips(null),true);
}

export {
  activateDashboardDialogFocus,
  renderAssetContributionCard,
  renderAssetDayChangeBlock,
  renderAssetStatusBlock,
  renderAssetWeight,
  chartSeriesSwatch,
  escapeHtml,
  mobileTableAssetName,
  navIconSvg,
  pensionProductSwatch,
  phoneLandscapeUi,
  releaseDashboardDialogFocus,
  securitySymbolSwatch,
  setupAssetVizTooltips
};
