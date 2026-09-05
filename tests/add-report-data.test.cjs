const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const portfolio=JSON.parse(read('data/portfolio.json'));
const reportSource=JSON.parse(read('data/kodex_leverage_trades.json'));
const REPORT_DATA=reportSource.trades;
const addSource=read('add/add.js');
const coreSource=read('js/dashboard-core.js');
const schemaSource=read('js/kodex-leverage-schema.js');
const {REPORT_DATA_URL,REPORT_SCHEMA_MODULE_URL,deriveReportModel}=require('../add/add.js');

let core;
let REPORT_SCHEMA_VERSION;
let isValidReportDate;
let validateReportSource;
const model=deriveReportModel(reportSource);
const byDate=rows=>new Map(rows.map(row=>[row.date,row]));

test.before(async()=>{
  const schemaUrl='data:text/javascript;base64,'+Buffer.from(schemaSource).toString('base64');
  const schema=await import(schemaUrl);
  REPORT_SCHEMA_VERSION=schema.KODEX_LEVERAGE_SCHEMA_VERSION;
  isValidReportDate=schema.isValidKodexLeverageDate;
  validateReportSource=schema.validateKodexLeverageSource;
  const coreForNode=coreSource.replace("'./kodex-leverage-schema.js'",`'${schemaUrl}'`);
  const coreUrl='data:text/javascript;base64,'+Buffer.from(coreForNode).toString('base64');
  core=await import(coreUrl);
});

test('KODEX canonical 거래 원천은 schema·기간·날짜순·중복없음·필수 숫자/segment 계약을 유지한다',()=>{
  assert.equal(reportSource.schemaVersion,REPORT_SCHEMA_VERSION);
  assert.equal(reportSource.reportStartDate,'2026-06-08');
  assert.equal(reportSource.reinvestedLimit,6700000);
  assert.equal(validateReportSource(reportSource),reportSource);
  assert.ok(Array.isArray(REPORT_DATA)&&REPORT_DATA.length>0);
  const dates=REPORT_DATA.map(row=>row.date);
  assert.deepEqual(dates,[...dates].sort(),'거래일 정렬이 깨졌다');
  assert.equal(new Set(dates).size,dates.length,'동일 거래일이 canonical source에 중복됐다');
  for(const row of REPORT_DATA){
    assert.match(row.date,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['core','day','mixed'].includes(row.segment),`${row.date} segment 오류`);
    for(const key of ['qty','buy','sell','pnl','fee'])assert.ok(typeof row[key]==='number'&&Number.isInteger(row[key]),`${row.date} ${key}는 JSON 정수여야 한다`);
    if(row.segment==='mixed'){
      assert.ok(row.core&&typeof row.core==='object',`${row.date} mixed core 누락`);
      for(const key of ['qty','buy','sell','pnl','fee'])assert.ok(typeof row.core[key]==='number'&&Number.isInteger(row.core[key]),`${row.date} core.${key}는 JSON 정수여야 한다`);
      assert.ok(row.core.qty>=0&&row.core.qty<=row.qty,`${row.date} core 수량 범위 오류`);
    }
  }
  assert.equal(reportSource.positionContext.legacyBuild.first.qty,16);
  assert.equal(reportSource.positionContext.legacyBuild.second.qty,22);
  assert.equal(reportSource.positionContext.augustFinalBuild.first.qty,15);
});

test('KODEX Report canonical schema validator는 잘못된 운영 데이터를 화면 계산 전에 차단한다',()=>{
  assert.throws(()=>validateReportSource({...reportSource,schemaVersion:2}),/schemaVersion/);
  assert.throws(()=>validateReportSource({...reportSource,trades:[reportSource.trades[0],reportSource.trades[0]]}),/중복/);

  for(const invalidDate of ['2026-08-00','2026-02-30','2026-13-01','0000-01-01']){
    assert.equal(isValidReportDate(invalidDate),false,`${invalidDate}가 실제 달력 날짜로 통과하면 안 된다`);
  }
  for(const validDate of ['2024-02-29','2026-08-31','2000-02-29'])assert.equal(isValidReportDate(validDate),true);
  assert.equal(isValidReportDate('2100-02-29'),false,'세기 윤년 규칙이 잘못됐다');

  const badTradeDate=structuredClone(reportSource);
  badTradeDate.trades[1].date='2026-08-00';
  assert.throws(()=>validateReportSource(badTradeDate),/date가 올바르지/);
  assert.throws(()=>validateReportSource({...reportSource,reportStartDate:'2026-02-30'}),/reportStartDate/);

  for(const [label,mutate] of [
    ['reinvestedLimit 문자열',src=>{src.reinvestedLimit=String(src.reinvestedLimit);}],
    ['거래 qty 문자열',src=>{src.trades[0].qty=String(src.trades[0].qty);}],
    ['거래 fee 문자열',src=>{src.trades[0].fee=String(src.trades[0].fee);}],
    ['mixed core.qty 문자열',src=>{const row=src.trades.find(v=>v.segment==='mixed');row.core.qty=String(row.core.qty);}],
    ['context buy 문자열',src=>{src.positionContext.legacyBuild.first.buy=String(src.positionContext.legacyBuild.first.buy);}],
    ['context qty 문자열',src=>{src.positionContext.legacyBuild.first.qty=String(src.positionContext.legacyBuild.first.qty);}],
  ]){
    const badType=structuredClone(reportSource);
    mutate(badType);
    assert.throws(()=>validateReportSource(badType),/(JSON 정수|reinvestedLimit|context)/,`${label}은 JSON number 계약 위반으로 차단해야 한다`);
  }

  const badMixed=structuredClone(reportSource);
  const mixed=badMixed.trades.find(row=>row.segment==='mixed');
  mixed.core.qty=mixed.qty;
  assert.throws(()=>validateReportSource(badMixed),/core 범위/);

  const badMixedFee=structuredClone(reportSource);
  const mixedFee=badMixedFee.trades.find(row=>row.segment==='mixed');
  mixedFee.core.fee=mixedFee.fee+1;
  assert.throws(()=>validateReportSource(badMixedFee),/core 범위/,'core fee가 전체 fee를 넘으면 단타 비용이 음수가 되므로 차단해야 한다');

  const badContext=structuredClone(reportSource);
  delete badContext.positionContext.augustFinalBuild.second.buy;
  assert.throws(()=>validateReportSource(badContext),/augustFinalBuild\.second context/);
  const badContextDate=structuredClone(reportSource);
  badContextDate.positionContext.legacyBuild.first.date='2026-02-30';
  assert.throws(()=>validateReportSource(badContextDate),/legacyBuild\.first context/);
});

test('KODEX Report 순수 파생 모델은 전체/본 포지션/단타 합계와 표시기간을 보존한다',()=>{
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
  assert.equal(model.reportStartDate,reportSource.reportStartDate);
  assert.equal(model.reportEndDate,REPORT_DATA.at(-1).date);
  assert.equal(model.positionContext,reportSource.positionContext);
});

test('Main과 KODEX Report는 data/kodex_leverage_trades.json 하나만 canonical 거래 원천으로 사용한다',()=>{
  assert.equal(REPORT_DATA_URL,'../data/kodex_leverage_trades.json');
  assert.equal(REPORT_SCHEMA_MODULE_URL,'../js/kodex-leverage-schema.js');
  assert.equal(Object.prototype.hasOwnProperty.call(portfolio,'separateProfit'),false,'portfolio.json에 별도수익 거래 복제본을 다시 두면 안 된다');
  assert.match(coreSource,/loadJson\('data\/kodex_leverage_trades\.json\?ts='/);
  assert.match(coreSource,/portfolio\.separateProfit=deriveSeparateProfitFromKodexReport\(kodexLeverageReport\)/);
  assert.match(addSource,/const REPORT_DATA_URL='\.\.\/data\/kodex_leverage_trades\.json'/);
  assert.match(addSource,/const REPORT_SCHEMA_MODULE_URL='\.\.\/js\/kodex-leverage-schema\.js'/);
  assert.match(addSource,/schema\.validateKodexLeverageSource\(source\)/);
  assert.match(coreSource,/import \{ validateKodexLeverageSource \} from '\.\/kodex-leverage-schema\.js'/);
  assert.match(coreSource,/const validated=validateKodexLeverageSource\(source\)/);
  assert.doesNotMatch(coreSource,/function isValidIsoCalendarDate\(/,'Main에 별도 canonical 날짜 validator를 다시 두면 안 된다');
  assert.doesNotMatch(addSource,/const REPORT_DATA\s*=/,'add.js에 거래 원천 배열을 다시 하드코딩하면 안 된다');
  assert.doesNotMatch(addSource,/legacyBuild:Object\.freeze|firstQty:16|extraBuy:74350|secondBuy:96750/,'매수-only 포지션 context를 add.js에 다시 하드코딩하면 안 된다');
});

test('Main separateProfit는 canonical KODEX 원천에서 날짜별 순손익과 재투입 한도를 파생한다',()=>{
  const mainSeparateProfit=core.deriveSeparateProfitFromKodexReport(reportSource);
  assert.equal(mainSeparateProfit.reinvestedLimit,reportSource.reinvestedLimit);
  const mainByDate=byDate(mainSeparateProfit.trades);
  const reportByDate=byDate(model.reportDailyRows);
  assert.deepEqual([...mainByDate.keys()],[...reportByDate.keys()]);
  reportByDate.forEach((row,date)=>assert.equal(mainByDate.get(date)?.profit,row.net,`${date} Main 파생 순손익 불일치`));
  const mainTotal=mainSeparateProfit.trades.reduce((sum,row)=>sum+row.profit,0);
  assert.equal(mainTotal,model.reportMetrics.totalNet);
  assert.throws(()=>core.deriveSeparateProfitFromKodexReport({...reportSource,schemaVersion:2}),/schemaVersion/);
  const badMainDate=structuredClone(reportSource);
  badMainDate.trades[1].date='2026-08-00';
  assert.throws(()=>core.deriveSeparateProfitFromKodexReport(badMainDate),/date가 올바르지/,'Main도 존재하지 않는 달력 날짜를 거부해야 한다');
  assert.throws(()=>core.deriveSeparateProfitFromKodexReport({...reportSource,reinvestedLimit:String(reportSource.reinvestedLimit)}),/reinvestedLimit/,'Main도 문자열 reinvestedLimit를 거부해야 한다');
  const badMainPnl=structuredClone(reportSource);
  badMainPnl.trades[0].pnl=String(badMainPnl.trades[0].pnl);
  assert.throws(()=>core.deriveSeparateProfitFromKodexReport(badMainPnl),/JSON 정수/,'Main도 문자열 pnl을 거부해야 한다');
  const badMainFee=structuredClone(reportSource);
  badMainFee.trades[0].fee=String(badMainFee.trades[0].fee);
  assert.throws(()=>core.deriveSeparateProfitFromKodexReport(badMainFee),/JSON 정수/,'Main도 문자열 fee를 거부해야 한다');

  for(const [label,mutate] of [
    ['qty 문자열',src=>{src.trades[0].qty=String(src.trades[0].qty);}],
    ['buy 문자열',src=>{src.trades[0].buy=String(src.trades[0].buy);}],
    ['sell 문자열',src=>{src.trades[0].sell=String(src.trades[0].sell);}],
    ['잘못된 segment',src=>{src.trades[0].segment='oops';}],
    ['context buy 문자열',src=>{src.positionContext.legacyBuild.first.buy=String(src.positionContext.legacyBuild.first.buy);}],
    ['mixed core fee 범위',src=>{const row=src.trades.find(v=>v.segment==='mixed');row.core.fee=row.fee+1;}]
  ]){
    const invalid=structuredClone(reportSource);
    mutate(invalid);
    assert.throws(()=>core.deriveSeparateProfitFromKodexReport(invalid),Error,`Main도 Report와 동일하게 ${label} schema 오류를 거부해야 한다`);
  }
});

test('근거·산식의 혼합일 설명은 canonical 거래 데이터에서 파생되는 동적 placeholder를 모든 혼합일에 사용한다',()=>{
  const html=read('add/kodex-leverage-report.html');
  const mixedDates=REPORT_DATA.filter(row=>row.segment==='mixed').map(row=>row.date);
  const dayByDate=byDate(model.dayTradeRows);
  for(const date of mixedDates){
    assert.match(html,new RegExp(`data-report-mixed-qty="${date}"`),`${date} 단타수량 placeholder 누락`);
    assert.match(html,new RegExp(`data-report-mixed-pnl="${date}"`),`${date} 단타손익 placeholder 누락`);
    assert.ok(dayByDate.has(date),`${date} 단타 파생행 누락`);
  }
  assert.match(addSource,/querySelectorAll\('\[data-report-mixed-qty\]'\)/,'혼합일 단타수량 renderer 누락');
  assert.match(addSource,/querySelectorAll\('\[data-report-mixed-pnl\]'\)/,'혼합일 단타손익 renderer 누락');
  assert.doesNotMatch(html,/7\/31은\s*5,370주/,'혼합일 단타수량을 HTML에 다시 하드코딩하면 안 된다');
  assert.doesNotMatch(html,/7\/31 단타 손익은\s*1,026,205원/,'혼합일 단타손익을 HTML에 다시 하드코딩하면 안 된다');
});

test('Report 표시기간과 근거 설명의 거래 수치는 canonical 원천에서 동적으로 렌더링한다',()=>{
  const html=read('add/kodex-leverage-report.html');
  assert.match(html,/data-report-period/);
  assert.doesNotMatch(html,/2026\.06\.08\s*~\s*2026\.09\.02/,'표시기간을 HTML에 고정하면 안 된다');
  for(const key of ['2026-06-09:qty','2026-06-25:qty','2026-08-20:qty','2026-08-20:fee','2026-09-02:qty']){
    assert.match(html,new RegExp(`data-report-row-value=\"${key}\"`),`${key} 동적 placeholder 누락`);
  }
  for(const key of ['legacyFirstQty','legacySecondQty','legacyTotalQty','augustFirstQty','augustSecondQty']){
    assert.match(html,new RegExp(`data-report-context-value=\"${key}\"`),`${key} context placeholder 누락`);
  }
  assert.match(addSource,/period\.textContent=`\$\{reportStartDate\.replaceAll/);
  assert.match(addSource,/querySelectorAll\('\[data-report-row-value\]'\)/);
  assert.match(addSource,/querySelectorAll\('\[data-report-context-value\]'\)/);
});

test('운영 문서는 KODEX 거래 단일 원천 규칙과 신규 거래 반영 절차를 canonical JSON 기준으로 유지한다',()=>{
  const docs=[read('README.md'),read('main_dashboard_maintenance_handover.md'),read('add_maintenance_handover.md')].join('\n');
  assert.match(docs,/data\/kodex_leverage_trades\.json/);
  assert.doesNotMatch(docs,/add\/add\.js[^\n]*REPORT_DATA|data\/portfolio\.json[^\n]*(?:separateProfit\.trades|별도수익)[^\n]*(?:반영|source of truth)/i);
  const addHandover=read('add_maintenance_handover.md');
  assert.match(addHandover,/`data\/kodex_leverage_trades\.json`에 실현거래를 1회 반영/);
  assert.match(addHandover,/`data\/portfolio\.json`에 `separateProfit` 거래 배열을 다시 만들거나/);
  assert.doesNotMatch(addHandover,/실현손익 반영:\s*data\/portfolio\.json 포함/,'작업 시작 순서에 폐기된 portfolio.json 실현손익 반영 문구가 남으면 안 된다');
  const mainHandover=read('main_dashboard_maintenance_handover.md');
  assert.doesNotMatch(mainHandover,/표·KPI·차트·`data\/portfolio\.json`의 누계/,'Main 운영 숫자 QA가 폐기된 portfolio.json 누계를 가리키면 안 된다');
  assert.match(mainHandover,/`data\/kodex_leverage_trades\.json`을 단일 원천으로 사용/);
});
