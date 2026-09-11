const test=require('node:test');
const assert=require('node:assert/strict');
const {compute,validate,ceil5}=require('../add/add.js');

const approx=(actual,expected,tolerance=1e-9)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,`expected ${actual} ≈ ${expected}`);
};

const settledNoPrior={
  caseType:'settled',noPrior:true,priorSellDate:'',existingShares:0,existingCost:0,priorSettlementValue:0,priorSellPrice:0,
  currentPrice:80000,oldRecovery:0,addPrice:80000,addShares:100,overnightPct:0,risePct:0,targetPrice:80000
};

const settledWithPrior={
  caseType:'settled',noPrior:false,priorSellDate:'2026-07-30',existingShares:642,existingCost:51912930,
  priorSettlementValue:47880490,priorSellPrice:74580,currentPrice:75595,oldRecovery:0,addPrice:82680,addShares:576,
  overnightPct:0,risePct:0,targetPrice:0
};

const holding={
  caseType:'holding',noPrior:false,priorSellDate:'',existingShares:38,existingCost:7005530,priorSettlementValue:0,
  priorSellPrice:0,currentPrice:79020,oldRecovery:3700000,addPrice:74350,addShares:604,overnightPct:0,risePct:0,targetPrice:0
};

const settledAlreadyRecovered={
  caseType:'settled',noPrior:false,priorSellDate:'2026-08-01',existingShares:100,existingCost:1000000,priorSettlementValue:2000000,
  priorSellPrice:20000,currentPrice:10000,oldRecovery:0,addPrice:10000,addShares:10,overnightPct:0,risePct:0,targetPrice:0
};

test('ceil5: 5원 주문단위 올림 경계',()=>{
  assert.equal(ceil5(0),0);
  assert.equal(ceil5(80000),80000);
  assert.equal(ceil5(80001),80005);
  assert.equal(ceil5(79020),79020);
  assert.equal(ceil5(79021),79025);
});

test('validate: 이전 거래 없음 current 입력 정상',()=>{
  const result=validate(settledNoPrior,{caseType:'settled',mode:'current'});
  assert.deepEqual(result,{errors:[],invalidIds:[]});
});

test('validate: 보유 중 추가매수의 음수/0 입력 차단',()=>{
  const input={...holding,currentPrice:0,existingShares:-1,oldRecovery:-1,addShares:0};
  const result=validate(input,{caseType:'holding',mode:'current'});
  assert.ok(result.invalidIds.includes('currentPrice'));
  assert.ok(result.invalidIds.includes('existingShares'));
  assert.ok(result.invalidIds.includes('oldOverdraft'));
});

test('validate: 이전 거래 입력 시 매도일과 매도수량 검증',()=>{
  const input={...settledWithPrior,priorSellDate:'',existingShares:0};
  const result=validate(input,{caseType:'settled',mode:'current'});
  assert.ok(result.invalidIds.includes('priorSellDateInput'));
  assert.ok(result.invalidIds.includes('priorSoldSharesInput'));
});

test('validate: target 모드는 양의 정수 목표단가 필요',()=>{
  const result=validate({...settledNoPrior,targetPrice:0},{caseType:'settled',mode:'target'});
  assert.ok(result.invalidIds.includes('targetPrice'));
});


test('validate: 목표단가 × 매도수량이 안전 정수 범위를 넘으면 결과 표시 전에 차단한다',()=>{
  const input={...settledNoPrior,addShares:101,targetPrice:100000000000005};
  const result=validate(input,{caseType:'settled',mode:'target'});
  assert.ok(result.invalidIds.includes('targetPrice'));
  assert.ok(result.errors.some(message=>message.includes('목표 매도금액')));
});

test('validate: 이전 확정손실을 합친 자동 통합 회복금액도 결과 계산 전에 차단한다',()=>{
  const input={
    ...settledWithPrior,
    existingShares:1,existingCost:Number.MAX_SAFE_INTEGER,priorSettlementValue:0,
    currentPrice:1,addPrice:1,addShares:1
  };
  const result=validate(input,{caseType:'settled',mode:'current',autoBreakEvenTarget:true});
  assert.ok(result.invalidIds.includes('priorCostInput'));
  assert.ok(result.invalidIds.includes('priorSettlementValueInput'));
  assert.ok(result.invalidIds.includes('addPrice'));
  assert.ok(result.invalidIds.includes('addShares'));
  assert.ok(result.errors.some(message=>message.includes('통합 회복금액')));
});

test('compute: 이전 거래 없음 자동 손익분기',()=>{
  const c=compute(settledNoPrior,{caseType:'settled',noPrior:true,mode:'current',autoBreakEvenTarget:true});
  assert.equal(c.finalShares,100);
  assert.equal(c.finalCost,8000000);
  assert.equal(c.finalAvg,80000);
  assert.equal(c.currentValue,8000000);
  assert.equal(c.currentPositionPL,0);
  assert.equal(c.positionBEOrder,80000);
  assert.equal(c.targetPrice,80000);
  assert.equal(c.sFull.saleQty,100);
  assert.equal(c.sPrincipal.saleQty,100);
});

test('compute: 이전 손실 포함 재매수의 통합 회복가격',()=>{
  const c=compute(settledWithPrior,{caseType:'settled',noPrior:false,mode:'current',autoBreakEvenTarget:true});
  assert.equal(c.priorPL,-4032440);
  assert.equal(c.finalShares,576);
  assert.equal(c.finalCost,47623680);
  assert.equal(c.positionBEOrder,82680);
  assert.equal(c.integratedBasis,51656120);
  assert.equal(c.integratedBE,89681);
  assert.equal(c.integratedBEOrder,89685);
  assert.equal(c.targetPrice,89685);
});


test('compute: 이전 확정이익만으로 이미 회복된 재매수는 현재 종가를 자동 목표로 유지한다',()=>{
  const c=compute(settledAlreadyRecovered,{caseType:'settled',noPrior:false,mode:'current',autoBreakEvenTarget:true});
  assert.equal(c.priorPL,1000000);
  assert.equal(c.finalCost,100000);
  assert.equal(c.integratedBasis,0);
  assert.equal(c.integratedBEOrder,0);
  assert.equal(c.integratedRecoverySatisfied,true);
  assert.equal(c.targetPrice,10000);
  assert.equal(c.inputUpdates.overnightPct,0);
  assert.equal(c.inputUpdates.risePct,0);
  assert.equal(Object.is(c.targetPrice,-0),false);
  assert.deepEqual(validate(c.i,{caseType:'settled',mode:'current'}),{errors:[],invalidIds:[]});
});

test('compute: 이미 회복된 자동 목표도 KRX 5원 주문단위로 올림한다',()=>{
  const input={...settledAlreadyRecovered,currentPrice:10003};
  const c=compute(input,{caseType:'settled',noPrior:false,mode:'current',autoBreakEvenTarget:true});
  assert.equal(c.integratedRecoverySatisfied,true);
  assert.equal(c.targetPrice,10005);
  assert.equal(c.targetPrice%5,0);
  assert.equal(c.inputUpdates.overnightPct,(10005/10003-1)*100);
});

test('compute: 보유 중 추가매수의 최종 보유/평단/손익',()=>{
  const c=compute(holding,{caseType:'holding',noPrior:false,mode:'current',autoBreakEvenTarget:true});
  assert.equal(c.finalShares,642);
  assert.equal(c.finalCost,51912930);
  approx(c.finalAvg,80861.26168224298,1e-8);
  assert.equal(c.currentValue,50730840);
  assert.equal(c.currentPositionPL,-1182090);
  assert.equal(c.positionBE,80862);
  assert.equal(c.positionBEOrder,80865);
  assert.equal(c.targetPrice,80865);
});

test('compute: current 모드 변동률에서 목표가격 5원 올림',()=>{
  const input={...settledNoPrior,overnightPct:5};
  const c=compute(input,{caseType:'settled',noPrior:true,mode:'current',autoBreakEvenTarget:false});
  assert.equal(c.targetPrice,84000);
  approx(c.inputUpdates.risePct,5,1e-10);
});

test('compute: rise 모드에서 추가매수가 기준 목표가격',()=>{
  const input={...holding,risePct:10};
  const c=compute(input,{caseType:'holding',noPrior:false,mode:'rise',autoBreakEvenTarget:false});
  assert.equal(c.targetPrice,81785);
  approx(c.inputUpdates.overnightPct,(81785/79020-1)*100,1e-10);
});

test('compute: target 직접입력도 5원 올림 후 두 변동률 갱신',()=>{
  const input={...holding,targetPrice:90391};
  const c=compute(input,{caseType:'holding',noPrior:false,mode:'target',autoBreakEvenTarget:false});
  assert.equal(c.targetPrice,90395);
  approx(c.inputUpdates.overnightPct,14.395089850670706,1e-10);
  approx(c.inputUpdates.risePct,21.580363147276405,1e-10);
});

test('compute: 보유 중 추가매수 3개 매도전략 수량/현금흐름',()=>{
  const c=compute(holding,{caseType:'holding',noPrior:false,mode:'current',autoBreakEvenTarget:true});
  assert.equal(c.sFull.saleQty,642);
  assert.equal(c.sFull.cashAfter,3307930);
  assert.equal(c.sAdd.saleQty,604);
  assert.equal(c.sAdd.cashAfter,235060);
  assert.equal(c.sPrincipal.saleQty,556);
  assert.equal(c.sPrincipal.recoveryPaid,53540);
  assert.equal(c.sPrincipal.recoveryBalance,3646460);
  approx(c.sPrincipal.combined,2400,1e-6);
});

test('compute: 이전 손실 포함 매도전략의 통합손익',()=>{
  const c=compute(settledWithPrior,{caseType:'settled',noPrior:false,mode:'current',autoBreakEvenTarget:true});
  assert.equal(c.sFull.saleQty,576);
  assert.equal(c.sFull.gross,51658560);
  assert.equal(c.sPrincipal.saleQty,532);
  assert.equal(c.sPrincipal.gross,47712420);
  approx(c.sFull.combined,2440,1e-6);
  approx(c.sPrincipal.combined,2440,1e-6);
});

test('validate: 변동률 -100% 경계와 target 소수 주문가는 차단한다',()=>{
  const current=validate({...settledNoPrior,overnightPct:-100},{caseType:'settled',mode:'current'});
  assert.ok(current.invalidIds.includes('overnightPct'));
  const rise=validate({...settledNoPrior,risePct:-100},{caseType:'settled',mode:'rise'});
  assert.ok(rise.invalidIds.includes('risePct'));
  const target=validate({...settledNoPrior,targetPrice:90391.5},{caseType:'settled',mode:'target'});
  assert.ok(target.invalidIds.includes('targetPrice'));
});


test('validate: 최종 보유수량 0 오류는 원인 입력 control과 연결한다',()=>{
  const holdingZero=validate({...holding,existingShares:0,addShares:0},{caseType:'holding',mode:'current'});
  assert.ok(holdingZero.errors.includes('최종 보유수량 1주 이상 필요.'));
  assert.ok(holdingZero.invalidIds.includes('existingShares'));
  assert.ok(holdingZero.invalidIds.includes('addShares'));

  const settledZero=validate({...settledNoPrior,addShares:0},{caseType:'settled',mode:'current'});
  assert.ok(settledZero.errors.includes('보유수량 1주 이상 필요.'));
  assert.ok(settledZero.invalidIds.includes('addShares'));
});

test('validate: 유한하지만 목표가격 계산 범위를 넘는 변동률은 차단한다',()=>{
  const current=validate({...settledNoPrior,overnightPct:1e308},{caseType:'settled',mode:'current'});
  assert.ok(current.invalidIds.includes('overnightPct'));
  const rise=validate({...settledNoPrior,risePct:1e308},{caseType:'settled',mode:'rise'});
  assert.ok(rise.invalidIds.includes('risePct'));
});

test('validate: 안전 정수 범위를 넘는 금액·수량은 차단한다',()=>{
  const unsafe=Number.MAX_SAFE_INTEGER+1;
  const result=validate({...holding,currentPrice:unsafe,addShares:unsafe},{caseType:'holding',mode:'current'});
  assert.ok(result.invalidIds.includes('currentPrice'));
  assert.ok(result.invalidIds.includes('addShares'));
});

test('validate: 개별 입력은 안전 정수여도 곱셈 결과가 안전 범위를 넘으면 차단한다',()=>{
  const result=validate({...settledNoPrior,addPrice:Number.MAX_SAFE_INTEGER,addShares:2},{caseType:'settled',mode:'current'});
  assert.ok(result.invalidIds.includes('addPrice'));
  assert.ok(result.invalidIds.includes('addShares'));
});

test('validate: 안전한 개별값의 이전 손익·현재 손익 합계가 안전 범위를 넘으면 차단한다',()=>{
  const input={
    ...settledWithPrior,
    existingShares:1,existingCost:0,priorSettlementValue:Number.MAX_SAFE_INTEGER,
    currentPrice:Number.MAX_SAFE_INTEGER,addPrice:1,addShares:1,targetPrice:1
  };
  const result=validate(input,{caseType:'settled',noPrior:false,mode:'target',autoBreakEvenTarget:false});
  assert.ok(result.errors.some(message=>message.includes('현재 통합손익')));
  assert.ok(result.errors.some(message=>message.includes('목표가격 통합손익')));
  assert.ok(result.invalidIds.includes('priorSettlementValueInput'));
  assert.ok(result.invalidIds.includes('currentPrice'));
  assert.ok(result.invalidIds.includes('targetPrice'));
});

test('compute: signed zero 입력은 계산 경계에서 0으로 정규화한다',()=>{
  const c=compute({...holding,existingCost:-0,oldRecovery:-0,overnightPct:-0},{caseType:'holding',noPrior:false,mode:'current',autoBreakEvenTarget:false});
  assert.equal(Object.is(c.i.existingCost,-0),false);
  assert.equal(Object.is(c.i.oldRecovery,-0),false);
  assert.equal(Object.is(c.i.overnightPct,-0),false);
  assert.equal(Object.is(c.priorAvg,-0),false);
});

test('compute: DOM-free 계산은 호출자가 넘긴 입력 객체를 변경하지 않는다',()=>{
  const input={...holding};
  const before=structuredClone(input);
  compute(input,{caseType:'holding',noPrior:false,mode:'current',autoBreakEvenTarget:true});
  assert.deepEqual(input,before);
});
