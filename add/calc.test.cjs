const test=require('node:test');
const assert=require('node:assert/strict');
const {compute,validate,ceil5}=require('./calc.js');

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

test('ceil5: 5원 주문단위 올림 경계',()=>{
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
