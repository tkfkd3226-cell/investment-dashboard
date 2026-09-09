// KODEX Leverage Data Schema · DOM 비의존 공통 validator
// Main Dashboard와 Add Report는 이 단일 검증 contract를 함께 사용한다.

const KODEX_LEVERAGE_SCHEMA_VERSION=1;
const KODEX_LEVERAGE_DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const KODEX_LEVERAGE_SEGMENTS=Object.freeze(['core','day','mixed']);

function isValidKodexLeverageDate(value){
  const text=String(value||'');
  if(!KODEX_LEVERAGE_DATE_RE.test(text))return false;
  const [year,month,day]=text.split('-').map(Number);
  if(year<1||month<1||month>12||day<1)return false;
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const daysInMonth=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return day<=daysInMonth[month-1];
}

const isKodexLeverageInteger=value=>typeof value==='number'&&Number.isSafeInteger(value);

function validateKodexLeverageSource(source){
  if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('KODEX 거래 데이터 형식이 올바르지 않습니다.');
  if(source.schemaVersion!==KODEX_LEVERAGE_SCHEMA_VERSION)throw new Error(`KODEX 거래 데이터 schemaVersion은 ${KODEX_LEVERAGE_SCHEMA_VERSION}이어야 합니다.`);
  if(!isValidKodexLeverageDate(source.reportStartDate))throw new Error('KODEX 거래 데이터 reportStartDate가 올바르지 않습니다.');
  if(!isKodexLeverageInteger(source.reinvestedLimit)||source.reinvestedLimit<0)throw new Error('KODEX 거래 데이터 reinvestedLimit가 올바르지 않습니다.');
  if(!Array.isArray(source.trades)||source.trades.length===0)throw new Error('KODEX 거래 데이터 trades가 비어 있습니다.');

  let previousDate='';
  const seen=new Set();
  source.trades.forEach((row,index)=>{
    const date=String(row?.date||'');
    if(!isValidKodexLeverageDate(date))throw new Error(`KODEX 거래 ${index+1}의 date가 올바르지 않습니다.`);
    if(seen.has(date))throw new Error(`KODEX 거래일 ${date}가 중복되었습니다.`);
    if(previousDate&&date<previousDate)throw new Error('KODEX 거래 데이터는 날짜 오름차순이어야 합니다.');
    seen.add(date);
    previousDate=date;

    if(!KODEX_LEVERAGE_SEGMENTS.includes(row?.segment))throw new Error(`KODEX 거래 ${date}의 segment가 올바르지 않습니다.`);
    ['qty','buy','sell','pnl','fee'].forEach(key=>{
      if(!isKodexLeverageInteger(row?.[key]))throw new Error(`KODEX 거래 ${date}의 ${key}가 JSON 정수가 아닙니다.`);
    });
    if(row.qty<=0||row.buy<=0||row.sell<=0||row.fee<0)throw new Error(`KODEX 거래 ${date}의 수량·단가·비용 범위가 올바르지 않습니다.`);

    if(row.segment==='mixed'){
      if(!row.core||typeof row.core!=='object'||Array.isArray(row.core))throw new Error(`KODEX 혼합거래 ${date}의 core가 없습니다.`);
      ['qty','buy','sell','pnl','fee'].forEach(key=>{
        if(!isKodexLeverageInteger(row.core?.[key]))throw new Error(`KODEX 혼합거래 ${date}의 core.${key}가 JSON 정수가 아닙니다.`);
      });
      if(row.core.qty<=0||row.core.qty>=row.qty||row.core.buy<=0||row.core.sell<=0||row.core.fee<0||row.core.fee>row.fee)throw new Error(`KODEX 혼합거래 ${date}의 core 범위가 올바르지 않습니다.`);
    }
  });

  if(String(source.reportStartDate)>String(source.trades[0].date))throw new Error('reportStartDate는 첫 매도일보다 늦을 수 없습니다.');

  const context=source.positionContext;
  const validateContextPoint=(label,point,{qty=true}={})=>{
    if(!point||typeof point!=='object'||Array.isArray(point)||!isValidKodexLeverageDate(point.date)||!isKodexLeverageInteger(point.buy)||point.buy<=0||qty&&(!isKodexLeverageInteger(point.qty)||point.qty<=0))throw new Error(`KODEX 거래 데이터 ${label} context가 올바르지 않습니다.`);
  };
  validateContextPoint('legacyBuild.first',context?.legacyBuild?.first);
  validateContextPoint('legacyBuild.second',context?.legacyBuild?.second);
  validateContextPoint('julyAdd',context?.julyAdd,{qty:false});
  validateContextPoint('augustFinalBuild.first',context?.augustFinalBuild?.first);
  validateContextPoint('augustFinalBuild.second',context?.augustFinalBuild?.second,{qty:false});

  // positionContext는 Timeline 설명용 임의 메모가 아니라 실제 canonical 거래의 매수 형성 문맥이다.
  // 따라서 개별 숫자 형식뿐 아니라 연결된 실현거래와의 수량·가중평균·날짜 관계도 함께 검증한다.
  const tradeByDate=new Map(source.trades.map(row=>[row.date,row]));
  const julyClose=tradeByDate.get('2026-07-30');
  const augustClose=tradeByDate.get('2026-08-20');
  if(!julyClose||julyClose.segment!=='core')throw new Error('KODEX 거래 데이터 positionContext 기준 거래 2026-07-30이 올바르지 않습니다.');
  if(!augustClose||augustClose.segment!=='core')throw new Error('KODEX 거래 데이터 positionContext 기준 거래 2026-08-20이 올바르지 않습니다.');

  const contextSafeAdd=(left,right,label)=>{
    const value=left+right;
    if(!Number.isSafeInteger(value))throw new Error(`KODEX 거래 데이터 ${label} 파생 정수가 안전 범위를 벗어났습니다.`);
    return value;
  };
  const contextSafeSubtract=(left,right,label)=>{
    const value=left-right;
    if(!Number.isSafeInteger(value))throw new Error(`KODEX 거래 데이터 ${label} 파생 정수가 안전 범위를 벗어났습니다.`);
    return value;
  };
  const contextSafeMultiply=(left,right,label)=>{
    const value=left*right;
    if(!Number.isSafeInteger(value))throw new Error(`KODEX 거래 데이터 ${label} 파생 정수가 안전 범위를 벗어났습니다.`);
    return value;
  };
  const assertRoundedAverage=(cost,qty,buy,label)=>{
    if(Math.round(cost/qty)!==buy)throw new Error(`KODEX 거래 데이터 ${label} context가 실제 거래 수량·평단과 일치하지 않습니다.`);
  };

  const legacyFirst=context.legacyBuild.first;
  const legacySecond=context.legacyBuild.second;
  const julyAdd=context.julyAdd;
  if(!(legacyFirst.date<legacySecond.date&&legacySecond.date<julyAdd.date&&julyAdd.date<julyClose.date))throw new Error('KODEX 거래 데이터 legacyBuild/julyAdd 날짜 순서가 실제 거래 흐름과 일치하지 않습니다.');
  const legacyQty=contextSafeAdd(legacyFirst.qty,legacySecond.qty,'legacyBuild 수량 합계');
  const julyAddQty=contextSafeSubtract(julyClose.qty,legacyQty,'julyAdd 파생 수량');
  if(julyAddQty<=0)throw new Error('KODEX 거래 데이터 julyAdd 파생 수량은 양수여야 합니다.');
  const legacyCost=contextSafeAdd(
    contextSafeMultiply(legacyFirst.qty,legacyFirst.buy,'legacyBuild.first 취득원가'),
    contextSafeMultiply(legacySecond.qty,legacySecond.buy,'legacyBuild.second 취득원가'),
    'legacyBuild 취득원가 합계'
  );
  const julyCost=contextSafeAdd(
    legacyCost,
    contextSafeMultiply(julyAddQty,julyAdd.buy,'julyAdd 취득원가'),
    '2026-07-30 취득원가 합계'
  );
  assertRoundedAverage(julyCost,julyClose.qty,julyClose.buy,'legacyBuild/julyAdd');

  const augustFirst=context.augustFinalBuild.first;
  const augustSecond=context.augustFinalBuild.second;
  if(!(augustFirst.date<augustSecond.date&&augustSecond.date<augustClose.date))throw new Error('KODEX 거래 데이터 augustFinalBuild 날짜 순서가 실제 거래 흐름과 일치하지 않습니다.');
  const augustSecondQty=contextSafeSubtract(augustClose.qty,augustFirst.qty,'augustFinalBuild.second 파생 수량');
  if(augustSecondQty<=0)throw new Error('KODEX 거래 데이터 augustFinalBuild.second 파생 수량은 양수여야 합니다.');
  const augustCost=contextSafeAdd(
    contextSafeMultiply(augustFirst.qty,augustFirst.buy,'augustFinalBuild.first 취득원가'),
    contextSafeMultiply(augustSecondQty,augustSecond.buy,'augustFinalBuild.second 취득원가'),
    '2026-08-20 취득원가 합계'
  );
  assertRoundedAverage(augustCost,augustClose.qty,augustClose.buy,'augustFinalBuild');
  return source;
}

export {
  KODEX_LEVERAGE_SCHEMA_VERSION,
  isValidKodexLeverageDate,
  validateKodexLeverageSource
};
