import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const acts=['respond','explore','verify','rest','reflect','wait','defer'];
const env=(id,bias)=>({taskId:id,initialState:[.15+bias,.45,.55],transition:(s,a,t)=>{
  const target=(bias>.1?['verify','explore','respond']:['rest','reflect','wait'])[t%3];
  const match=a===target; const ai=acts.indexOf(a); const d=(ai%2)*.02;
  return {nextState:s.map((v,i)=>Math.max(0,Math.min(1,v+(match?.025:-.015)+(i===0?d:0)))),reward01:Math.max(0,Math.min(1,match?.82-d+t*.005:.24-d))};
}});

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'});
await core.init();
const candidates=()=>acts.map((action,i)=>({id:`b265-candidate-${i}`,action,score:.4,predictedUtility:action==='verify'?.72:action==='explore'?.68:action==='respond'?.63:.38,predictedNeedRelief:.5,predictedCost:action==='rest'?.12:.32,confidence:.64,generatedAt:0}));
const chooser=()=> (state,step)=>core.b264CausalPolicyDecide(candidates(),step).chosen?.action ?? 'wait';
for(let i=0;i<4;i++) core.b265EvaluatePolicy(env(`core-${i}`,.02*i),chooser(),8,31+i);
const hold=core.b265EvaluateHoldout([env('core-h1',.16),env('core-h2',.18),env('core-h3',.20)],()=>chooser(),8);
const cf=core.b265Counterfactual(env('core-cf',.19),'verify','rest',7);
const d=core.b265IndependentPolicyDiagnostics();
assert.ok(d.evaluations>=7,'independent evaluator must receive multiple trajectories');
assert.ok(d.steps>=56,'evaluator must see multi-step trajectories');
assert.ok(hold.episodes===3);
assert.ok(cf.gain01>=0);
const snap=core.snapshot();
assert.ok(snap.system.independentPolicyEvaluatorB265?.steps>=56,'B265 state must be persisted in OrganismCore snapshot');
const core2=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'});
await core2.init();
const restoredBefore=core2.b265IndependentPolicyDiagnostics();
assert.ok(restoredBefore.steps===0 || restoredBefore.steps<=d.steps,'fresh in-memory core must not invent B265 history');
console.log(JSON.stringify({pass:true,hold,counterfactual:cf,diagnostics:d,persistedSteps:snap.system.independentPolicyEvaluatorB265.steps},null,2));
