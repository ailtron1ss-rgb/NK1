import assert from 'node:assert/strict';
import { B2503ActionablePredictiveField, defaultB2503State } from '../src/organism/cognition/B2503ActionablePredictiveField.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map((a,i)=>[a,i===1?.69:i===2?.63:.49]));
const st=(t)=>Array.from({length:24},(_,i)=>((t*13+i*5)%29)/28);
for(let seed=1;seed<=5;seed++){
  const n=new B2503ActionablePredictiveField();n.restore(defaultB2503State());
  for(let t=1;t<=100;t++){
    const x=st(t+seed); const r=n.beforeDecision({tick:t,state01:x,baseUtilities:base,uncertainty01:t%8===0?.7:.25,predictionError01:t%11===0?.55:.13,novelty01:t%9===0?.8:.25,energy01:.72,goalPressure01:.58});
    n.afterOutcome({tick:t,action:r.selectedAction,reward01:r.selectedAction==='verify'&&t%10===0?.92:.41,nextState01:st(t+seed+1),predictionError01:t%11===0?.45:.12,verified01:t%4===0?1:0});
  }
  const d=n.diagnostics();assert.ok(d.cycles>=100&&d.rollouts>0&&d.learningUpdates>0&&d.transitionCount>0); const snap=n.snapshot(); const probe=n.beforeDecision({tick:101,state01:st(101+seed),baseUtilities:base,uncertainty01:.3,predictionError01:.18,novelty01:.35,energy01:.7,goalPressure01:.6});
  const n2=new B2503ActionablePredictiveField();n2.restore(snap);const probe2=n2.beforeDecision({tick:101,state01:st(101+seed),baseUtilities:base,uncertainty01:.3,predictionError01:.18,novelty01:.35,energy01:.7,goalPressure01:.6});assert.ok(A.reduce((z,a)=>z+Math.abs(probe.predictedUtility[a]-probe2.predictedUtility[a]),0)<1e-10);
}
const n=new B2503ActionablePredictiveField();for(let t=1;t<=60;t++){const x=st(t);const r=n.beforeDecision({tick:t,state01:x,baseUtilities:base,uncertainty01:.35,predictionError01:.2,novelty01:.35,energy01:.7,goalPressure01:.6});n.afterOutcome({tick:t,action:r.selectedAction,reward01:t%3===0?.9:.2,nextState01:st(t+1),predictionError01:.15,verified01:1});}
const lesion=n.lesionFraction(.5);assert.ok(lesion.effect01>.0001);
console.log(JSON.stringify({pass:true,status:'B2503_ACTIONABLE_PREDICTIVE_PASS',diagnostics:n.diagnostics(),lesion},null,2));
