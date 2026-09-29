const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const gas=fs.readFileSync(path.join(__dirname,'..','GAS_code.js'),'utf8');

// 전체 production GAS를 실행하며 외부 Properties/Trigger/GitHub 경계만 대역으로 둔다.
function harness({phase='morning',at='2026-09-29T00:01:00Z',results=[]}={}){
  let now=Date.parse(at),sequence=0,lockBusy=false;
  const triggers=[],store={},calls=[],queries=[],runs=new Map();
  const originalId=`krx-auto:2026-09-29:${phase}`;
  runs.set(originalId,{id:100,status:'completed',conclusion:'failure'});
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const props={getProperty:k=>store[k]??null,setProperty(k,v){store[k]=v;},deleteProperty(k){delete store[k];},getProperties:()=>({...store})};
  const context=vm.createContext({Date:FixedDate,console,
    PropertiesService:{getScriptProperties:()=>props},
    LockService:{getScriptLock:()=>({tryLock(){if(lockBusy){lockBusy=false;return false;}return true;},releaseLock(){}})},
    Utilities:{formatDate(date,_zone,format){const shifted=new Date(date.getTime()+9*3600000);if(format==='yyyy-MM-dd')return shifted.toISOString().slice(0,10);if(format==='u')return String(shifted.getUTCDay()||7);throw Error(format);}},
    ScriptApp:{getProjectTriggers:()=>triggers.slice(),deleteTrigger(t){const i=triggers.indexOf(t);if(i>=0)triggers.splice(i,1);},newTrigger(handler){let target;const api={timeBased(){return api;},at(value){target=value;return api;},create(){const t={id:String(++sequence),target,getUniqueId(){return this.id;},getHandlerFunction(){return handler;}};triggers.push(t);return t;}};return api;}}
  });
  vm.runInContext(gas,context);
  context.getProp=()=> 'main';
  context.krxDispatchHash=()=> 'audit-request-hash';
  const productionDispatch=context.dispatchKrxPriceWorkflow;
  context.dispatchKrxPriceWorkflow=body=>{
    calls.push(body.requestId);
    const result=results.length>1?results.shift():results[0];
    if(result==='lock_busy'){
      lockBusy=true;
      // 실제 dispatch 함수의 tryLock 실패 응답을 사용한다.
      return productionDispatch(body);
    }
    if(result instanceof Error)throw result;
    return result||{ok:true,action:'workflow_dispatched'};
  };
  context.findKrxWorkflowRunByRequestId=(_branch,date,id)=>{queries.push({date,id});return runs.get(id)||null;};
  context.findActiveKrxWorkflowRun=()=>null;
  const initial=context.scheduleKrxAutoVerification_(phase,'2026-09-29',originalId,0,0,'test',new FixedDate());
  assert.equal(initial.scheduled,true);
  return {context,triggers,store,calls,queries,runs,originalId,
    next(){assert.ok(triggers.length,'예약된 trigger가 있어야 한다');const trigger=triggers[0];now=trigger.target.getTime();return context.runKrxAutoVerificationHandler_(phase,{triggerUid:trigger.id});},
    metadata(){return JSON.parse(store[`KRX_AUTO_VERIFY_${triggers[0].id}`]);},
    setNow(value){now=Date.parse(value);}
  };
}
const accepted={ok:true,action:'workflow_dispatched'};

test('복구 lock_busy는 성공으로 표시하지 않고 같은 recovery identity로 재시도 후 최종 성공을 확인한다',()=>{
  const h=harness({results:['lock_busy',accepted]});
  const first=h.next();
  assert.equal(first.ok,false);
  assert.equal(first.action,'auto_verification_recovery_pending');
  assert.equal(first.recoveryResult.timing.outcome,'lock_busy');
  const pending=h.metadata();
  assert.equal(pending.recoveryDispatchPending,true);
  assert.equal(pending.recoveryAttempt,1);
  const retried=h.next();
  assert.equal(retried.action,'auto_verification_recovery_dispatched');
  assert.deepEqual(h.calls,[pending.requestId,pending.requestId]);
  assert.equal(h.metadata().recoveryDispatchPending,undefined);
  h.runs.set(pending.requestId,{id:101,status:'completed',conclusion:'success'});
  assert.equal(h.next().action,'auto_verification_success');
  assert.equal(h.triggers.length,0);
  assert.equal(Object.keys(h.store).length,0);
});

for(const action of ['workflow_in_progress','workflow_status_uncertain','workflow_dispatch_uncertain']){
  test(`복구 ${action}은 같은 identity로 코어에 재진입하고 접수 전 완료 조회로 빠지지 않는다`,()=>{
    const h=harness({results:[{ok:true,action},{ok:true,action:'workflow_duplicate_ignored'}]});
    assert.equal(h.next().action,'auto_verification_recovery_pending');
    assert.equal(h.next().action,'auto_verification_recovery_dispatched');
    assert.equal(h.calls[0],h.calls[1]);
    assert.equal(h.queries.length,1,'미접수 retry는 nonexistent run 조회 대신 기존 dispatch 코어에 위임한다');
  });
}

for(const status of [429,503]){
  test(`복구 HTTP ${status} 이후 같은 identity를 유지해 재시도한다`,()=>{
    const error=Object.assign(new Error('GitHub API error'),{githubHttpStatus:status});
    const h=harness({results:[error,accepted]});
    assert.equal(h.next().action,'auto_verification_recovery_error');
    assert.equal(h.metadata().recoveryDispatchPending,true);
    assert.equal(h.next().action,'auto_verification_recovery_dispatched');
    assert.equal(h.calls[0],h.calls[1]);
  });
}

test('복구 응답 유실 이후 duplicate proof로 수렴하고 새 recovery 번호를 만들지 않는다',()=>{
  const h=harness({results:[new Error('socket timeout'),{ok:true,action:'workflow_duplicate_ignored'}]});
  h.next();const id=h.metadata().requestId;
  h.runs.set(id,{id:101,status:'completed',conclusion:'success'});
  h.next();assert.equal(h.next().action,'auto_verification_success');
  assert.deepEqual(h.calls,[id,id]);
});

for(const status of [401,403,404,422]){
  test(`복구 terminal HTTP ${status}은 자동 재시도하지 않는다`,()=>{
    const h=harness({results:[Object.assign(new Error('GitHub API error'),{githubHttpStatus:status})]});
    const result=h.next();
    assert.equal(result.ok,false);assert.equal(result.verification,null);
    assert.equal(h.triggers.length,0);
  });
}

test('명시적 비일시 실패 결과는 recovered/dispatched로 표시하지 않는다',()=>{
  const h=harness({results:[{ok:false,error:'invalid configuration'}]});
  const result=h.next();
  assert.equal(result.action,'auto_verification_recovery_rejected');
  assert.equal(result.ok,false);assert.equal(h.triggers.length,0);
});

test('반복 미접수 retry는 검증 횟수 한도에서 종료하고 recovery 번호를 소비하지 않는다',()=>{
  const h=harness({phase:'close',at:'2026-09-29T06:31:00Z',results:['lock_busy']});
  let result;for(let i=0;h.triggers.length&&i<10;i++)result=h.next();
  assert.equal(result.verification.reason,'verification_attempt_limit');
  assert.equal(h.calls.length,7);
  assert.equal(new Set(h.calls).size,1);
  assert.equal(h.triggers.length,0);
});

test('pending recovery도 morning deadline을 넘기면 dispatch하지 않는다',()=>{
  const h=harness({results:['lock_busy']});h.next();
  const trigger=h.triggers[0];h.setNow('2026-09-29T00:31:00Z');
  assert.equal(h.context.runKrxAutoMorningVerify({triggerUid:trigger.id}).action,'auto_verification_expired');
  assert.equal(h.calls.length,1);assert.equal(h.triggers.length,0);
});

test('접수된 recovery의 terminal 실패만 다음 번호를 만들며 최대 2회에서 종료한다',()=>{
  const h=harness();h.next();
  h.runs.set(h.calls[0],{id:101,status:'completed',conclusion:'failure'});h.next();
  h.runs.set(h.calls[1],{id:102,status:'completed',conclusion:'failure'});
  assert.equal(h.next().action,'auto_verification_recovery_exhausted');
  assert.deepEqual(h.calls,['krx-auto-recovery:2026-09-29:morning:1','krx-auto-recovery:2026-09-29:morning:2']);
  assert.equal(h.triggers.length,0);
});

test('접수 후 exact run 미가시성은 재조회만 하고 dispatch를 반복하지 않는다',()=>{
  const h=harness();h.next();
  assert.equal(h.next().action,'auto_verification_run_not_visible');
  assert.equal(h.calls.length,1);
});

test('pending recovery metadata의 identity가 맞지 않으면 실행하지 않는다',()=>{
  const h=harness({results:['lock_busy']});h.next();
  const trigger=h.triggers[0],key=`KRX_AUTO_VERIFY_${trigger.id}`;
  h.store[key]=JSON.stringify({...h.metadata(),requestId:h.originalId});
  assert.equal(h.next().reason,'invalid_verification_metadata');
  assert.equal(h.calls.length,1);
});
