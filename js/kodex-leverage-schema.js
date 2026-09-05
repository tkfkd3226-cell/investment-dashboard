// KODEX Leverage canonical data schema · DOM-independent shared validator
// Main dashboard and Add Report must consume this single validation contract.

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

const isKodexLeverageInteger=value=>typeof value==='number'&&Number.isInteger(value);

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
  return source;
}

export {
  KODEX_LEVERAGE_SCHEMA_VERSION,
  isValidKodexLeverageDate,
  validateKodexLeverageSource
};
