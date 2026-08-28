// Dashboard Modal Lifecycle · 범용 modal shell / focus / dismiss
// Ownership: feature content와 business logic은 각 feature module이 소유하고, 이 모듈은 lifecycle만 담당한다.
// Structure map:
//   [MODAL01] Runtime State / Focus / Accessibility
//   [MODAL02] Custom Overlay
//   [MODAL03] Native Dialog
//   [MODAL04] Public API

// [MODAL01] Runtime State / Focus / Accessibility · 상태 / focus trap / inert / body lock
const dashboardDialogFocusState=new WeakMap();
const dashboardModalDismissState=new WeakMap();
const dashboardNativeDialogState=new WeakMap();
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

// [MODAL02] Custom Overlay · class 기반 modal open / close / dismiss
function openDashboardModal(container,{visibleClass='show',initialFocus=null,fallbackSelector='',returnFocus=null,manageAriaHidden=true}={}){
  if(!container)return false;
  if(visibleClass)container.classList.add(visibleClass);
  if(manageAriaHidden)container.setAttribute('aria-hidden','false');
  activateDashboardDialogFocus(container,{initialFocus,fallbackSelector,returnFocus});
  return true;
}
function closeDashboardModal(container,{visibleClass='show',fallbackSelector='',manageAriaHidden=true,remove=false}={}){
  if(!container)return false;
  if(visibleClass)container.classList.remove(visibleClass);
  if(manageAriaHidden)container.setAttribute('aria-hidden','true');
  releaseDashboardDialogFocus(container,{fallbackSelector});
  if(remove)container.remove();
  return true;
}
function bindDashboardModalDismiss(container,{onDismiss,backdrop=true,escape=true,preventEscapeDefault=true,stopEscapePropagation=true}={}){
  if(!container||typeof onDismiss!=='function')return ()=>{};
  const previous=dashboardModalDismissState.get(container);
  previous?.cleanup?.();
  const onClick=event=>{
    if(!backdrop||event.target!==container)return;
    onDismiss(event);
  };
  const onKeydown=event=>{
    if(!escape||event.key!=='Escape')return;
    if(preventEscapeDefault)event.preventDefault();
    if(stopEscapePropagation)event.stopPropagation();
    onDismiss(event);
  };
  if(backdrop)container.addEventListener('click',onClick);
  if(escape)container.addEventListener('keydown',onKeydown);
  const cleanup=()=>{
    if(backdrop)container.removeEventListener('click',onClick);
    if(escape)container.removeEventListener('keydown',onKeydown);
    if(dashboardModalDismissState.get(container)?.cleanup===cleanup)dashboardModalDismissState.delete(container);
  };
  dashboardModalDismissState.set(container,{cleanup});
  return cleanup;
}

// [MODAL03] Native Dialog · <dialog> show/close/dismiss / focus return
function nativeDialogState(dialog){
  let state=dashboardNativeDialogState.get(dialog);
  if(!state){
    state={returnFocus:null,fallbackSelector:'',cleanup:null,bodyLocked:false};
    dashboardNativeDialogState.set(dialog,state);
  }
  return state;
}
function openDashboardNativeDialog(dialog,{initialFocus=null,returnFocus=null,fallbackSelector=''}={}){
  if(!dialog||typeof dialog.showModal!=='function')return false;
  const state=nativeDialogState(dialog);
  if(returnFocus)state.returnFocus=returnFocus;
  else if(!dialog.contains(document.activeElement)&&dashboardReturnFocusVisible(document.activeElement))state.returnFocus=document.activeElement;
  state.fallbackSelector=fallbackSelector||state.fallbackSelector||'';
  if(!dialog.open)dialog.showModal();
  lockDashboardDialogBody(state);
  const target=typeof initialFocus==='string'?dialog.querySelector(initialFocus):initialFocus;
  (target||dialog)?.focus?.({preventScroll:true});
  return true;
}
function closeDashboardNativeDialog(dialog,{fallbackSelector=''}={}){
  if(!dialog)return false;
  const state=nativeDialogState(dialog);
  const stored=state.returnFocus;
  const fallback=fallbackSelector||state.fallbackSelector||'';
  state.returnFocus=null;
  state.fallbackSelector='';
  if(dialog.open)dialog.close();
  unlockDashboardDialogBody(state);
  requestAnimationFrame(()=>{
    const target=dashboardReturnFocusVisible(stored)?stored:dashboardVisibleFallback(fallback);
    target?.focus?.({preventScroll:true});
  });
  return true;
}
function bindDashboardNativeDialogDismiss(dialog,{onDismiss,backdrop=true,escape=true}={}){
  if(!dialog||typeof onDismiss!=='function')return ()=>{};
  const state=nativeDialogState(dialog);
  state.cleanup?.();
  const onClick=event=>{
    if(!backdrop||event.target!==dialog)return;
    onDismiss(event);
  };
  const onCancel=event=>{
    if(!escape)return;
    event.preventDefault();
    onDismiss(event);
  };
  if(backdrop)dialog.addEventListener('click',onClick);
  if(escape)dialog.addEventListener('cancel',onCancel);
  const cleanup=()=>{
    if(backdrop)dialog.removeEventListener('click',onClick);
    if(escape)dialog.removeEventListener('cancel',onCancel);
    if(state.cleanup===cleanup)state.cleanup=null;
  };
  state.cleanup=cleanup;
  return cleanup;
}

// [MODAL04] Public API
export {
  activateDashboardDialogFocus,
  bindDashboardModalDismiss,
  bindDashboardNativeDialogDismiss,
  closeDashboardModal,
  closeDashboardNativeDialog,
  openDashboardModal,
  openDashboardNativeDialog,
  releaseDashboardDialogFocus
};
