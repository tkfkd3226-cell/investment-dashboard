const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/dashboard-monthly-calendar.js'),'utf8')
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm,'')
  .replace(/export\s*\{[\s\S]*?\};?\s*$/,'');

// 실제 renderer의 button/요일 출력을 관찰하는 최소 DOM 대역. 레이아웃 엔진은 모사하지 않는다.
function harness(){
  let phone=false,html='',nodes=[],card={scrollTop:0},writes=0;
  const listeners=new Set();
  const document={activeElement:null,getElementById:()=>modal,
    querySelector:selector=>modal.querySelector(selector.replace('#monthlyCalendarModal ',''))};
  const modal={
    shown:false,classList:{contains:()=>modal.shown},
    contains:node=>nodes.includes(node),
    get innerHTML(){return html},
    set innerHTML(value){
      html=value;writes++;card={scrollTop:0};
      nodes=[...value.matchAll(/<button\b([^>]*)>/g)].map(match=>{
        const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
        return {hasAttribute:key=>key in attrs,getAttribute:key=>attrs[key]??null,
          focus(options){document.activeElement=this;this.focusOptions=options}};
      });
    },
    querySelectorAll(selector){
      const match=selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      return match?nodes.filter(n=>n.hasAttribute(match[1])&&(match[2]===undefined||n.getAttribute(match[1])===match[2])):[];
    },
    querySelector(selector){
      if(selector==='.monthly-calendar-card')return card;
      if(selector==='.monthly-calendar-mode-tab.active')return nodes.find(n=>(n.getAttribute('class')||'').includes('monthly-calendar-mode-tab active'));
      return this.querySelectorAll(selector)[0]||null;
    }
  };
  const context=vm.createContext({
    document,window:{addEventListener:(event,fn)=>{if(event==='resize')listeners.add(fn)},removeEventListener:(event,fn)=>listeners.delete(fn)},
    requestAnimationFrame:fn=>fn(),
    allAvailableDates:()=>['2026-08-03','2026-09-01','2026-09-05'],
    dataState:{activeDate:'2026-09-05'},uiState:{personalViewUnlocked:false},
    kstTodayText:()=> '2026-09-28',krxTradingCalendarStatus:()=> 'unknown',
    combinedDailyProfitChange:()=>100,securitiesDailyProfitChange:()=>100,pensionDailyProfitChange:()=>100,
    hasPensionData:()=>true,fmt:String,escapeHtml:String,navIconSvg:()=>'',phoneUi:()=>phone,
    openDashboardModal:()=>{modal.shown=true},closeDashboardModal:()=>{modal.shown=false}
  });
  vm.runInContext(source,context);
  return {context,modal,document,listeners,get writes(){return writes},
    resize(value){phone=value;for(const fn of listeners)fn()},
    headings(){return [...html.match(/monthly-calendar-weekdays[^>]*>(.*?)<\/div>/s)[1].matchAll(/<span\b/g)].length}
  };
}

test('열린 월간 손익은 7일↔5일 전환에서 탐색 월·조회 범위·control focus를 유지한다',()=>{
  const h=harness();h.context.openMonthlyCalendar();
  h.context.shiftMonthlyCalendarMonth(-1);h.context.setMonthlyCalendarMode('pension');
  assert.equal(h.headings(),7);
  h.modal.querySelector('.monthly-calendar-card').scrollTop=40;
  h.resize(true);
  assert.equal(h.headings(),5);
  assert.equal(vm.runInContext('monthlyCalendarState.month',h.context),'2026-08');
  assert.equal(vm.runInContext('monthlyCalendarState.mode',h.context),'pension');
  assert.equal(h.document.activeElement.getAttribute('data-calendar-mode'),'pension');
  assert.equal(h.modal.querySelector('.monthly-calendar-card').scrollTop,40);
  h.resize(false);assert.equal(h.headings(),7);
  assert.equal(h.document.activeElement.getAttribute('data-calendar-mode'),'pension');
});

test('같은 화면 구간의 resize는 DOM을 유지하고 닫힌 모달은 listener를 해제한다',()=>{
  const h=harness();h.context.openMonthlyCalendar();
  const before=h.writes;h.resize(false);assert.equal(h.writes,before);
  h.context.openMonthlyCalendar();assert.equal(h.listeners.size,1);
  h.context.closeMonthlyCalendar();assert.equal(h.listeners.size,0);
  const closed=h.writes;h.resize(true);assert.equal(h.writes,closed);
  h.context.openMonthlyCalendar();assert.equal(h.headings(),5);assert.equal(h.listeners.size,1);
});

test('날짜 focus를 복원하고 Phone 전환으로 주말 날짜가 사라지면 모달 내부로 옮긴다',()=>{
  const h=harness();h.context.openMonthlyCalendar();
  h.modal.querySelector('[data-calendar-date="2026-09-01"]').focus();h.resize(true);
  assert.equal(h.document.activeElement.getAttribute('data-calendar-date'),'2026-09-01');
  assert.equal(h.document.activeElement.focusOptions.preventScroll,true);
  h.resize(false);h.modal.querySelector('[data-calendar-date="2026-09-05"]').focus();h.resize(true);
  assert.equal(h.modal.querySelector('[data-calendar-date="2026-09-05"]'),null);
  assert.equal(h.modal.contains(h.document.activeElement),true);
  assert.equal(h.document.activeElement.getAttribute('data-calendar-mode'),'combined');
});
