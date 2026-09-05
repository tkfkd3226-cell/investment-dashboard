const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const portfolio=JSON.parse(read('data/portfolio.json'));
const {REPORT_DATA,deriveReportModel}=require('../add/add.js');

const model=deriveReportModel(REPORT_DATA);
const byDate=rows=>new Map(rows.map(row=>[row.date,row]));

test('KODEX Report 순수 파생 모델은 전체/본 포지션/단타 합계를 보존한다',()=>{
  assert.equal(model.reportMetrics.totalQty,13937);
  assert.equal(model.reportMetrics.totalPnl,9192290);
  assert.equal(model.reportMetrics.totalFee,115232);
  assert.equal(model.reportMetrics.totalNet,9077058);
  assert.equal(model.reportMetrics.coreQty+model.reportMetrics.dayQty,model.reportMetrics.totalQty);
  assert.equal(model.reportMetrics.corePnl+model.reportMetrics.dayPnl,model.reportMetrics.totalPnl);
  assert.equal(model.reportMetrics.coreFee+model.reportMetrics.dayFee,model.reportMetrics.totalFee);
  assert.equal(model.reportMetrics.coreNet+model.reportMetrics.dayNet,model.reportMetrics.totalNet);
  assert.equal(model.chartData.net.at(-1),model.reportDailyRows.at(-1).net);
  assert.equal(model.chartData.cum.at(-1),model.reportMetrics.totalNet);
});

test('Main separateProfit와 KODEX Report는 거래일 set·날짜별 순손익·최종 합계를 동일하게 유지한다',()=>{
  const mainTrades=portfolio.separateProfit?.trades||[];
  const reportTrades=model.reportDailyRows;
  const mainByDate=byDate(mainTrades);
  const reportByDate=byDate(reportTrades);
  assert.deepEqual([...reportByDate.keys()],[...mainByDate.keys()],'Main/Report 거래일 또는 정렬 순서가 달라졌다');
  reportByDate.forEach((row,date)=>{
    assert.equal(row.net,mainByDate.get(date)?.profit,`${date} Main/Report 순손익이 다르다`);
  });
  const mainTotal=mainTrades.reduce((sum,row)=>sum+Number(row.profit||0),0);
  assert.equal(model.reportMetrics.totalNet,mainTotal,'Main/Report 누적 별도수익 합계가 다르다');
});

test('근거·산식의 혼합일 설명은 REPORT_DATA에서 파생되는 동적 placeholder를 모든 혼합일에 사용한다',()=>{
  const html=read('add/kodex-leverage-report.html');
  const addJs=read('add/add.js');
  const mixedDates=REPORT_DATA.filter(row=>row.segment==='mixed').map(row=>row.date);
  const dayByDate=byDate(model.dayTradeRows);
  for(const date of mixedDates){
    assert.match(html,new RegExp(`data-report-mixed-qty="${date}"`),`${date} 단타수량 placeholder 누락`);
    assert.match(html,new RegExp(`data-report-mixed-pnl="${date}"`),`${date} 단타손익 placeholder 누락`);
    assert.ok(dayByDate.has(date),`${date} 단타 파생행 누락`);
  }
  assert.match(addJs,/querySelectorAll\('\[data-report-mixed-qty\]'\)/,'혼합일 단타수량 renderer 누락');
  assert.match(addJs,/querySelectorAll\('\[data-report-mixed-pnl\]'\)/,'혼합일 단타손익 renderer 누락');
  assert.doesNotMatch(html,/7\/31은\s*5,370주/,'혼합일 단타수량을 HTML에 다시 하드코딩하면 안 된다');
  assert.doesNotMatch(html,/7\/31 단타 손익은\s*1,026,205원/,'혼합일 단타손익을 HTML에 다시 하드코딩하면 안 된다');
});
