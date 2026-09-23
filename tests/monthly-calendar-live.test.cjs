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
