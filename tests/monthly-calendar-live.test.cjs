const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'js',name),'utf8');
const app=read('dashboard-app.js');
const live=read('dashboard-live-valuation.js');
const calendar=read('dashboard-monthly-calendar.js');
const between=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const calendarBody=calendar.replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm,'').replace(/export\s*\{[\s\S]*?\};?\s*$/,'');

test('월간손익 live callback은 히트맵 갱신 여부와 부모 선택 날짜에 관계없이 실행된다',()=>{
  for(const heatmapChanged of [false,true]){
    const calls=[];
    const context=vm.createContext({
      dataState:{activeDate:'2026-08-03'},
      refreshOpenPortfolioHeatmapLive:()=>{calls.push('heatmap');return heatmapChanged;},
      refreshMonthlyCalendarLive:()=>{calls.push('calendar');return true;}
    });
    vm.runInContext(between(app,'function refreshOpenLiveModals(){','function renderLiveValuationRefresh(){'),context);
    assert.equal(context.refreshOpenLiveModals(),true);
    assert.deepEqual(calls,['heatmap','calendar']);
  }
});

test('열린 모달은 main 화면 갱신 보류 전에 시세 변경·연결해제 알림을 받는다',()=>{
  const calls=[];
  const context=vm.createContext({
    console,
    renderOpenOverlayCallback:()=>calls.push('modal'),
    renderDashboardCallback:()=>calls.push('main'),
    liveValuationRenderPending:false,
    flushLiveValuationRender:()=>{calls.push('deferred');return false;}
  });
  vm.runInContext(between(live,'function requestLiveValuationRender(','// [LIVE03]'),context);
  context.requestLiveValuationRender();
  assert.deepEqual(calls,['modal','deferred']);
  assert.equal(context.liveValuationRenderPending,true);
  calls.length=0;
  context.requestLiveValuationRender({refreshOpenOverlay:false});
  assert.deepEqual(calls,['deferred'],'KOSPI 단독 갱신은 모달 가격 갱신에서 제외한다');
  assert.match(live,/clearLiveValuationSnapshot\(reason,\[\]\)[\s\S]*?requestLiveValuationRender\(\{refreshOpenOverlay:valuationChanged\}\)/);
});

test('닫힌 월간손익 모달은 계산과 DOM 갱신을 생략한다',()=>{
  let calculations=0;
  const context=vm.createContext({
    document:{getElementById:()=>({classList:{contains:()=>false}}),createElement:()=>assert.fail('닫힌 모달에 DOM을 생성하면 안 된다')},
    allAvailableDates:()=>{calculations++;return [];}
  });
  vm.runInContext(calendarBody,context);
  assert.equal(context.refreshMonthlyCalendarLive(),false);
  assert.equal(calculations,0);
});

test('값이 같은 live 갱신은 DOM 쓰기를 생략하고 날짜 button의 자식은 보존한다',()=>{
  const context=vm.createContext({});
  vm.runInContext(calendarBody,context);
  let writes=0;
  function element(text,attributes){
    return {
      get textContent(){return text;},
      set textContent(value){writes++;text=value;},
      getAttribute:name=>attributes[name]??null,
      setAttribute(name,value){writes++;attributes[name]=value;},
      removeAttribute(name){writes++;delete attributes[name];}
    };
  }
  const span=element('+1.0만',{class:'monthly-calendar-day-profit positive'});
  assert.equal(context.syncMonthlyCalendarLiveValue(span,element('+1.0만',{class:'monthly-calendar-day-profit positive'})),false);
  assert.equal(writes,0);
  assert.equal(context.syncMonthlyCalendarLiveValue(span,element('-2.0만',{class:'monthly-calendar-day-profit negative'})),true);
  assert.equal(span.textContent,'-2.0만');
  assert.equal(span.getAttribute('class'),'monthly-calendar-day-profit negative');
  const button=element('23+1.0만',{'aria-label':'23일, 일손익 +10,000원',title:'+10,000원'});
  const next=element('23-2.0만',{'aria-label':'23일, 일손익 -20,000원',title:'-20,000원'});
  context.syncMonthlyCalendarLiveValue(button,next,{text:false,attributes:['aria-label','title']});
  assert.equal(button.textContent,'23+1.0만','button 전체 textContent를 교체하면 자식과 포커스 구조가 깨진다');
  assert.equal(button.getAttribute('title'),'-20,000원');
});

// 실제 renderer가 만든 날짜 button/손익 span을 보관하는 최소 DOM 대역.
// layout은 모사하지 않고 refresh의 DOM identity·속성·쓰기 여부를 관찰한다.
function liveCalendarHarness(initialProfit){
  const profits={'2026-09-01':-100,'2026-09-02':-200,'2026-09-03':initialProfit};
  let buttons=[],writes=0;
  function element(text,attributes){
    const node={
      dataset:{calendarDate:attributes['data-calendar-date']},
      get textContent(){return text;},
      set textContent(value){writes++;text=value;},
      getAttribute:name=>attributes[name]??null,
      setAttribute(name,value){writes++;attributes[name]=value;},
      removeAttribute(name){writes++;delete attributes[name];},
      querySelector:()=>node.profit
    };
    node.classList={
      contains:name=>(attributes.class||'').split(/\s+/).includes(name),
      toggle(name,enabled){
        const classes=new Set((attributes.class||'').split(/\s+/).filter(Boolean));
        if(enabled)classes.add(name);else classes.delete(name);
        node.setAttribute('class',[...classes].join(' '));
        return enabled;
      }
    };
    return node;
  }
  function parseButtons(html){
    return [...html.matchAll(/<button\b([^>]*data-calendar-date[^>]*)>([\s\S]*?)<\/button>/g)].map(match=>{
      const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item=>[item[1],item[2]]));
      const button=element('',attrs);
      const profit=match[2].match(/<span class="(monthly-calendar-day-profit[^"]*)">([^<]*)<\/span>/);
      button.profit=element(profit[2],{class:profit[1]});
      return button;
    });
  }
  const card={scrollTop:40};
  const modal={
    classList:{contains:()=>true},
    querySelector:selector=>selector==='.monthly-calendar-card'?card:buttons.find(button=>selector===`[data-calendar-date="${button.dataset.calendarDate}"]`),
    querySelectorAll:()=>[],
    set innerHTML(value){assert.fail('실시간 갱신이 모달 전체를 다시 렌더링하면 안 된다');}
  };
  const document={
    activeElement:null,getElementById:()=>modal,
    createElement(){return {set innerHTML(html){this.content={querySelectorAll:selector=>selector==='[data-calendar-date]'?parseButtons(html):[]};}};}
  };
  const context=vm.createContext({
    document,allAvailableDates:()=>Object.keys(profits),
    combinedDailyProfitChange:date=>profits[date],securitiesDailyProfitChange:date=>profits[date],pensionDailyProfitChange:date=>profits[date],
    separateProfitDailyChangeForDate:()=>0,hasPensionData:()=>true,
    dataState:{activeDate:'2026-09-03'},uiState:{includeSeparateProfit:false},
    krxTradingCalendarStatus:()=> 'unknown',kstTodayText:()=> '2026-09-03',fmt:String,escapeHtml:String
  });
  vm.runInContext(calendarBody,context);
  vm.runInContext("monthlyCalendarState.month='2026-09'",context);
  buttons=parseButtons(context.renderMonthlyCalendarGrid('2026-09',context.monthlyCalendarMonthModel('2026-09')));
  document.activeElement=buttons.at(-1);
  return {context,profits,document,card,button:buttons.at(-1),modal,get writes(){return writes;}};
}

test('월간손익 실시간 손실·수익·보합 전환은 심호흡 표시와 금액을 함께 갱신한다',()=>{
  for(const [before,after,expectedGloomy] of [[-300,300,false],[-300,0,false],[300,-300,true]]){
    const h=liveCalendarHarness(before),button=h.button,profit=button.profit;
    h.profits['2026-09-03']=after;
    assert.equal(h.context.refreshMonthlyCalendarLive(),true);
    assert.equal(button.classList.contains('is-gloomy'),expectedGloomy);
    assert.equal(profit.textContent,h.context.monthlyCalendarCompactProfit(after));
    assert.equal(button.getAttribute('title'),h.context.monthlyCalendarExactProfitLabel(after));
    assert.equal(h.modal.querySelector('[data-calendar-date="2026-09-03"]'),button);
    assert.equal(button.profit,profit);
    assert.equal(h.document.activeElement,button);
    assert.equal(h.card.scrollTop,40);
    assert.equal(button.classList.contains('is-active'),true);
    assert.equal(button.classList.contains('is-today'),true);
    const writes=h.writes;
    assert.equal(h.context.refreshMonthlyCalendarLive(),false);
    assert.equal(h.writes,writes,'같은 상태의 다음 polling은 DOM 쓰기를 생략한다');
  }
});

test('금액이 같아도 심호흡 표시만 바뀌면 live 갱신 결과는 변경을 보고한다',()=>{
  const h=liveCalendarHarness(-300);
  h.button.classList.toggle('is-gloomy',false);
  const profitText=h.button.profit.textContent;
  assert.equal(h.context.refreshMonthlyCalendarLive(),true);
  assert.equal(h.button.classList.contains('is-gloomy'),true);
  assert.equal(h.button.profit.textContent,profitText);
});
