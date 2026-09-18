import {
  allAvailableDates,
  combinedDailyProfitChange,
  dataState,
  fmt,
  kstTodayText,
  uiState
} from './dashboard-core.js';
import { escapeHtml, navIconSvg, phoneUi } from './dashboard-ui-common.js';
import {
  bindDashboardModalDismiss,
  closeDashboardModal,
  openDashboardModal
} from './dashboard-modal.js';

// Monthly Profit Calendar · 월간 손익 탐색 / 요약 modal
// Ownership: 월별 calendar view model과 modal content만 소유한다.
// 실제 activeDate 변경은 dashboard-app.js가 담당한다.
// Structure map:
//   [CAL01] Constants / State
//   [CAL02] Monthly Performance View Model
//   [CAL03] Calendar Rendering
//   [CAL04] Modal Lifecycle
//   [CAL05] Public API

// [CAL01] Constants / State · action / weekday / 현재 탐색 월
const MONTHLY_CALENDAR_ACTION={
  open:'open-monthly-calendar',
  close:'close-monthly-calendar',
  previous:'monthly-calendar-previous',
  next:'monthly-calendar-next',
  selectDate:'select-monthly-calendar-date'
};
const MONTHLY_CALENDAR_WEEKDAYS=['월','화','수','목','금','토','일'];
const MONTHLY_CALENDAR_DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
function monthlyCalendarFocusFallbackSelector(){
  return phoneUi()
    ? '.topbar-calendar-phone-action,#dateActionMenuButton'
    : '.date-tool-btn-desktop[data-dashboard-action="open-monthly-calendar"],#dateActionMenuButton';
}
const monthlyCalendarState={month:''};

// [CAL02] Monthly Performance View Model · 기존 flow-neutral 일성과 helper를 재사용
function monthlyCalendarMonths(){
  return [...new Set(allAvailableDates().map(String).filter(date=>MONTHLY_CALENDAR_DATE_RE.test(date)).map(date=>date.slice(0,7)))].sort();
}
function monthlyCalendarMonthLabel(month){
  const [year,monthNumber]=String(month||'').split('-').map(Number);
  return year&&monthNumber?`${year}년 ${monthNumber}월`:String(month||'');
}
function monthlyCalendarExactProfitLabel(value){
  const number=Math.round(Number(value)||0);
  if(number===0)return '0원';
  return `${number>0?'+':''}${fmt(number)}원`;
}
function monthlyCalendarCompactProfit(value){
  const number=Math.round(Number(value)||0);
  if(number===0)return '0';
  const sign=number>0?'+':'-';
  const absolute=Math.abs(number);
  if(absolute>=100_000_000){
    const scaled=absolute/100_000_000;
    return `${sign}${scaled>=10?scaled.toFixed(1):scaled.toFixed(2)}억`.replace(/\.0(?=억$)/,'');
  }
  if(absolute>=10_000){
    const scaled=absolute/10_000;
    return `${sign}${scaled>=100?Math.round(scaled):scaled.toFixed(1)}만`.replace(/\.0(?=만$)/,'');
  }
  return `${sign}${fmt(absolute)}`;
}
function monthlyCalendarDailyProfit(date){
  return combinedDailyProfitChange(date);
}
function monthlyCalendarDayModel(date,today){
  const profit=monthlyCalendarDailyProfit(date);
  return {
    date,
    day:Number(String(date).slice(8,10)),
    profit,
    active:date===dataState.activeDate,
    today:date===today
  };
}
function monthlyCalendarMonthModel(month){
  const availableSet=new Set(allAvailableDates());
  const monthDates=[...availableSet].filter(date=>date.startsWith(`${month}-`)).sort();
  const today=kstTodayText();
  const dayModels=monthDates.map(date=>monthlyCalendarDayModel(date,today));
  const comparable=dayModels.filter(item=>Number.isFinite(item.profit));
  const total=comparable.reduce((sum,item)=>sum+item.profit,0);
  const positive=comparable.filter(item=>item.profit>0);
  const negative=comparable.filter(item=>item.profit<0);
  const best=comparable.length?comparable.reduce((winner,item)=>item.profit>winner.profit?item:winner):null;
  const worst=comparable.length?comparable.reduce((winner,item)=>item.profit<winner.profit?item:winner):null;
  return {availableSet,dayModels,total,positiveCount:positive.length,negativeCount:negative.length,best,worst};
}

// [CAL03] Calendar Rendering · 7열 calendar / 월간 요약
function monthlyCalendarCellAria(item){
  const prefix=item.today?'오늘, ':'';
  if(item.profit==null)return `${prefix}${item.day}일, 성과 비교 기준일`;
  return `${prefix}${item.day}일, 일손익 ${monthlyCalendarExactProfitLabel(item.profit)}`;
}
function renderMonthlyCalendarDayCell({day,date='',available=false,item=null,weekdayIndex=0,today:isToday=false}){
  const weekend=weekdayIndex>=5?' is-weekend':'';
  if(!available||!item){
    const todayClass=isToday?' is-today':'';
    const cellAccessibility=isToday?'':' aria-hidden="true"';
    const visibleDayAccessibility=isToday?' aria-hidden="true"':'';
    const screenReaderText=isToday?`<span class="visually-hidden">오늘, ${day}일, 데이터 없음</span>`:'';
    return `<div class="monthly-calendar-day is-unavailable${weekend}${todayClass}"${cellAccessibility}><span class="monthly-calendar-day-number"${visibleDayAccessibility}>${day}</span>${screenReaderText}</div>`;
  }
  const profitClass=item.profit==null?'':(item.profit>0?' positive':item.profit<0?' negative':'');
  const profitText=item.profit==null?'기준':monthlyCalendarCompactProfit(item.profit);
  const active=item.active?' is-active':'';
  const availableTodayClass=item.today?' is-today':'';
  return `<button type="button" class="monthly-calendar-day is-available${weekend}${availableTodayClass}${active}" data-dashboard-action="${MONTHLY_CALENDAR_ACTION.selectDate}" data-calendar-date="${escapeHtml(date)}" aria-label="${escapeHtml(monthlyCalendarCellAria(item))}"${item.active?' aria-current="date"':''} title="${escapeHtml(item.profit==null?'성과 비교 기준일':monthlyCalendarExactProfitLabel(item.profit))}"><span class="monthly-calendar-day-number">${day}</span><span class="monthly-calendar-day-profit${profitClass}">${profitText}</span></button>`;
}
function renderMonthlyCalendarGrid(month,model){
  const [year,monthNumber]=month.split('-').map(Number);
  const firstWeekday=(new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay()+6)%7;
  const daysInMonth=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const itemByDate=new Map(model.dayModels.map(item=>[item.date,item]));
  const today=kstTodayText();
  const cells=[];
  for(let i=0;i<firstWeekday;i++)cells.push('<div class="monthly-calendar-day is-placeholder" aria-hidden="true"></div>');
  for(let day=1;day<=daysInMonth;day++){
    const date=`${month}-${String(day).padStart(2,'0')}`;
    const weekdayIndex=(firstWeekday+day-1)%7;
    cells.push(renderMonthlyCalendarDayCell({day,date,available:model.availableSet.has(date),item:itemByDate.get(date)||null,weekdayIndex,today:date===today}));
  }
  return cells.join('');
}
function monthlyCalendarSummaryDetail(item){
  if(!item)return '비교 가능한 거래일 없음';
  return `${item.day}일 · ${monthlyCalendarExactProfitLabel(item.profit)}`;
}
function renderMonthlyCalendarSummary(model){
  const totalClass=model.total>0?' positive':model.total<0?' negative':'';
  const bestClass=model.best?.profit>0?' positive':model.best?.profit<0?' negative':'';
  const worstClass=model.worst?.profit>0?' positive':model.worst?.profit<0?' negative':'';
  return `<div class="monthly-calendar-summary" aria-label="월간 손익 요약">
    <div class="mini-card monthly-calendar-summary-card"><div class="m-label">월 손익</div><div class="m-value${totalClass}">${monthlyCalendarExactProfitLabel(model.total)}</div><div class="m-detail">비교 가능한 거래일 합계</div></div>
    <div class="mini-card monthly-calendar-summary-card"><div class="m-label">상승 · 하락</div><div class="m-value">${model.positiveCount} · ${model.negativeCount}</div><div class="m-detail">상승 ${model.positiveCount}일 · 하락 ${model.negativeCount}일</div></div>
    <div class="mini-card monthly-calendar-summary-card"><div class="m-label">최고일</div><div class="m-value${bestClass}">${model.best?`${model.best.day}일`:'-'}</div><div class="m-detail${bestClass}">${monthlyCalendarSummaryDetail(model.best)}</div></div>
    <div class="mini-card monthly-calendar-summary-card"><div class="m-label">최저일</div><div class="m-value${worstClass}">${model.worst?`${model.worst.day}일`:'-'}</div><div class="m-detail${worstClass}">${monthlyCalendarSummaryDetail(model.worst)}</div></div>
  </div>`;
}
function renderMonthlyCalendarModal(){
  const modal=document.getElementById('monthlyCalendarModal');
  if(!modal)return;
  const months=monthlyCalendarMonths();
  if(!months.length)return;
  const month=months.includes(monthlyCalendarState.month)?monthlyCalendarState.month:months.at(-1);
  monthlyCalendarState.month=month;
  const monthIndex=months.indexOf(month);
  const model=monthlyCalendarMonthModel(month);
  const modeNote=uiState.includeSeparateProfit?' · 별도수익 포함':'';
  modal.innerHTML=`<div class="action-modal-card monthly-calendar-card" role="dialog" aria-modal="true" aria-labelledby="monthlyCalendarTitle" aria-describedby="monthlyCalendarDescription">
    <button type="button" class="control-icon-button modal-icon-btn monthly-calendar-close" data-dashboard-action="${MONTHLY_CALENDAR_ACTION.close}" aria-label="월간 손익 닫기">${navIconSvg('close')}</button>
    <div class="monthly-calendar-head">
      <button type="button" class="control-icon-button modal-icon-btn monthly-calendar-nav" data-dashboard-action="${MONTHLY_CALENDAR_ACTION.previous}" aria-label="이전 월" aria-disabled="${monthIndex<=0?'true':'false'}">${navIconSvg('arrowLeft')}</button>
      <h3 id="monthlyCalendarTitle" class="modal-main-title">${escapeHtml(monthlyCalendarMonthLabel(month))}</h3>
      <button type="button" class="control-icon-button modal-icon-btn monthly-calendar-nav" data-dashboard-action="${MONTHLY_CALENDAR_ACTION.next}" aria-label="다음 월" aria-disabled="${monthIndex>=months.length-1?'true':'false'}">${navIconSvg('arrowRight')}</button>
    </div>
    <p id="monthlyCalendarDescription" class="monthly-calendar-description">증권·연금의 전일 대비 성과를 합산해 일손익으로 표시합니다${modeNote}.</p>
    <div class="monthly-calendar-weekdays" aria-hidden="true">${MONTHLY_CALENDAR_WEEKDAYS.map((label,index)=>`<span${index>=5?' class="is-weekend"':''}>${label}</span>`).join('')}</div>
    <div class="monthly-calendar-grid" role="group" aria-label="${escapeHtml(monthlyCalendarMonthLabel(month))} 손익 캘린더">${renderMonthlyCalendarGrid(month,model)}</div>
    ${renderMonthlyCalendarSummary(model)}
  </div>`;
}

// [CAL04] Modal Lifecycle · 공통 dashboard-modal lifecycle 재사용
function ensureMonthlyCalendarModal(){
  let modal=document.getElementById('monthlyCalendarModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='monthlyCalendarModal';
  modal.className='action-modal monthly-calendar-modal';
  modal.setAttribute('aria-hidden','true');
  bindDashboardModalDismiss(modal,{onDismiss:closeMonthlyCalendar,stopEscapePropagation:false});
  document.body.appendChild(modal);
  return modal;
}
function openMonthlyCalendar(returnFocus=null){
  const modal=ensureMonthlyCalendarModal();
  const activeMonth=String(dataState.activeDate||'').slice(0,7);
  const months=monthlyCalendarMonths();
  monthlyCalendarState.month=months.includes(activeMonth)?activeMonth:months.at(-1)||'';
  renderMonthlyCalendarModal();
  openDashboardModal(modal,{
    initialFocus:modal.querySelector('[aria-current="date"]')||modal.querySelector('[data-dashboard-action="monthly-calendar-previous"]')||modal.querySelector('[data-dashboard-action="monthly-calendar-next"]')||modal.querySelector('[data-dashboard-action="close-monthly-calendar"]'),
    returnFocus,
    fallbackSelector:monthlyCalendarFocusFallbackSelector()
  });
}
function closeMonthlyCalendar(){
  const modal=document.getElementById('monthlyCalendarModal');
  if(!modal)return;
  closeDashboardModal(modal,{fallbackSelector:monthlyCalendarFocusFallbackSelector()});
}
function shiftMonthlyCalendarMonth(delta){
  const months=monthlyCalendarMonths();
  const index=months.indexOf(monthlyCalendarState.month);
  if(index<0)return;
  const nextIndex=Math.min(months.length-1,Math.max(0,index+delta));
  if(nextIndex===index)return;
  monthlyCalendarState.month=months[nextIndex];
  renderMonthlyCalendarModal();
  requestAnimationFrame(()=>{
    const action=delta<0?MONTHLY_CALENDAR_ACTION.previous:MONTHLY_CALENDAR_ACTION.next;
    document.querySelector(`#monthlyCalendarModal [data-dashboard-action="${action}"]`)?.focus?.({preventScroll:true});
  });
}

// [CAL05] Public API
export {
  MONTHLY_CALENDAR_ACTION,
  closeMonthlyCalendar,
  openMonthlyCalendar,
  shiftMonthlyCalendarMonth
};
