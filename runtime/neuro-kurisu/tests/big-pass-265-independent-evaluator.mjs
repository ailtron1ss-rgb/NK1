import assert from 'node:assert/strict';
import { B265IndependentPolicyEvaluator } from '../src/organism/cognition/B265IndependentPolicyEvaluator.ts';

const acts=['respond','explore','verify','rest','reflect','wait','defer'];
const makeEnv=(id,bias)=>({
  taskId:id,
  initialState:[.2+bias,.4,.6],
  transition:(s,a,t)=>{
    const ai=acts.indexOf(a);
    const target=(bias>.1?['verify','explore','respond']:['rest','reflect','wait'])[t%3];
    const match=a===target;
    const drift=(ai%3)*.03;
    const delta=match?.04:-.02;
    return {
      nextState:s.map((v,i)=>Math.max(0,Math.min(1,v+delta+(i===0?drift:0)))),
      reward01:Math.max(0,Math.min(1,(match?.82:.26)-drift*.2+t*.01)),
    };
  },
});

const evaluator=new B265IndependentPolicyEvaluator();
const chooseFactory=()=>()=>((_,step)=>step%3===0?'verify':step%3===1?'explore':'respond');
const trains=[];
for(let i=0;i<6;i++) trains.push(evaluator.evaluateEpisode(makeEnv(`train-${i}`,i*.02),chooseFactory()(),8,17+i));
const holdout=evaluator.evaluateHoldout(Array.from({length:5},(_,i)=>makeEnv(`hold-${i}`,0.15+i*.01)),()=>chooseFactory()(),8);
const counterfactual=evaluator.evaluateCounterfactual(makeEnv('cf',.18),'verify','rest',6);
const calibration=evaluator.evaluateCalibration([makeEnv('cal-1',.16),makeEnv('cal-2',.19)],()=>chooseFactory()(),8);
const diagnostics=evaluator.diagnostics();
assert.equal(diagnostics.episodes,11);
assert.equal(diagnostics.steps,11*8);
assert.ok(holdout.episodes===5);
assert.ok(holdout.advantage01>=0);
assert.ok(counterfactual.gain01>=0);
assert.ok(calibration.calibration01>=0 && calibration.calibration01<=1);
const snap=evaluator.snapshot();
const restored=new B265IndependentPolicyEvaluator();
restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap);
console.log(JSON.stringify({pass:true,trainEpisodes:trains.length,holdout,counterfactual,calibration,diagnostics:restored.diagnostics()},null,2));
