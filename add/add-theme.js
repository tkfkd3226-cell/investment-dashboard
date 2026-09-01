// =========================================================
// ADD alternate design theme switcher
// - Calc / Report의 대체 디자인 선택만 담당한다.
// - 계산·데이터·리포트 상태에는 관여하지 않는다.
// =========================================================
(() => {
  if(typeof document==='undefined'||typeof window==='undefined')return;

  const root=document.documentElement;
  const page=root.dataset.addPage;
  const configs={
    calc:{storageKey:'investmentDashboard.addTheme.calc',altLabel:'Compact',altAria:'컴팩트 디자인으로 전환'},
    report:{storageKey:'investmentDashboard.addTheme.report',altLabel:'Dynamic',altAria:'다이내믹 디자인으로 전환'}
  };
  const config=configs[page];
  if(!config)return;

  const readStoredTheme=()=>{
    try{return localStorage.getItem(config.storageKey)==='alt'?'alt':'default';}
    catch{return 'default';}
  };

  const writeStoredTheme=theme=>{
    try{
      if(theme==='alt')localStorage.setItem(config.storageKey,'alt');
      else localStorage.removeItem(config.storageKey);
    }catch{}
  };

  const setRootTheme=theme=>{
    if(theme==='alt')root.dataset.addTheme='alt';
    else delete root.dataset.addTheme;
  };

  let currentTheme=readStoredTheme();
  setRootTheme(currentTheme);

  const refreshVisuals=()=>{
    // Report Canvas는 CSS 변수 기반 palette를 다시 읽도록 기존 resize lifecycle만 호출한다.
    if(page!=='report')return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.dispatchEvent(new Event('resize'))));
  };

  const init=()=>{
    const button=document.getElementById('addThemeToggle');
    if(!button)return;
    const label=button.querySelector('[data-add-theme-label]');

    const syncButton=()=>{
      const alt=currentTheme==='alt';
      button.setAttribute('aria-pressed',String(alt));
      button.setAttribute('aria-label',alt?'기본 디자인으로 전환':config.altAria);
      button.title=alt?'기본 디자인으로 전환':config.altAria;
      if(label)label.textContent=alt?'기본':config.altLabel;
    };

    button.addEventListener('click',()=>{
      currentTheme=currentTheme==='alt'?'default':'alt';
      setRootTheme(currentTheme);
      writeStoredTheme(currentTheme);
      syncButton();
      refreshVisuals();
    });

    syncButton();
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
