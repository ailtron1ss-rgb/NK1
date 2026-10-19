import assert from 'node:assert/strict';
import { B273AutonomousGoalLifecycle } from '../src/organism/cognition/B273AutonomousGoalLifecycle.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const reward=(family,action,s)=>{
  if(family==='discover') return action==='explore' ? .84-.10*s.uncertainty : action==='verify' ? .62+.06*s.uncertainty : .33;
  if(family==='repair') return action==='verify' ? .83+.07*s.uncertainty : action==='reflect' ? .60 : .31;
  if(family==='social') return action==='respond' ? .82+.08*s.social : action==='reflect' ? .57 : .30;
  if(family==='recovery') return action==='rest' ? .86+.08*(1-s.energy) : action==='reflect' ? .55 : .27;
  if(family==='identity') return action==='reflect' ? .81+.10*(1-s.uncertainty) : action==='verify' ? .63 : .34;
  return .40;
};
const net=new B273AutonomousGoalLifecycle();
for(let t=0;t<320;t++){
  const family=['discover','repair','social','recovery','identity'][t%5];
  const s={uncertainty:family==='repair'?.84:family==='discover'?.64:.28+(t%8)*.025,social:family==='social'?.84:.22,energy:family==='recovery'?.42:.78,novelty:family==='discover'?.82:.33};
  const goal=[s.novelty-.5,s.uncertainty-.5,s.social-.5,.5-s.energy,1-s.uncertainty,s.novelty*.4,s.social*.4,(.5-s.energy)*.5];
  const r=net.step({tick:t,endogenousGoalVector:goal,selfLatent:Array(16).fill(0).map((_,i)=>Math.sin(t*.07+i*.11)),worldLatent:Array(16).fill(0).map((_,i)=>Math.cos(t*.03+i*.09)),neuralAssembly:Array(16).fill(.12),needs:{energy01:s.energy,uncertainty01:s.uncertainty,novelty01:s.novelty,goalPressure01:s.uncertainty*.7,socialNeed01:s.social,autonomy01:.62,coherence01:.68},traits:{curiosity:.72,caution:.66,'truth-seeking':.75,'self-reflection':.69,'self-preservation':.70,care:family==='social'?.75:.56,'social-attunement':family==='social'?.78:.54,persistence:.73},predictionError01:s.uncertainty,identityContinuity01:.79,autobiographicalContinuity01:.75});
  net.learnFromOutcome({tick:t,action:r.action,plan:r.plan,reward01:reward(family,r.action,s),predictionError01:s.uncertainty,independentGain01:reward(family,r.action,s)-.5,personalityAlignment01:.61,externalEvidence01:1});
}
const evalNet=new B273AutonomousGoalLifecycle(); evalNet.restore(net.snapshot());
let policy=0,baseline=0,oracle=0,steps=120;
for(let i=0;i<steps;i++){
  const family=['discover','repair','social','recovery','identity'][i%5];
  const s={uncertainty:family==='repair'?.88:family==='discover'?.68:.30+(i%6)*.03,social:family==='social'?.86:.23,energy:family==='recovery'?.38:.77,novelty:family==='discover'?.88:.34};
  const r=evalNet.step({tick:1000+i,endogenousGoalVector:[s.novelty-.5,s.uncertainty-.5,s.social-.5,.5-s.energy,1-s.uncertainty,s.novelty*.4,s.social*.4,(.5-s.energy)*.5],selfLatent:Array(16).fill(0).map((_,j)=>Math.sin((1000+i)*.07+j*.11)),worldLatent:Array(16).fill(0).map((_,j)=>Math.cos((1000+i)*.03+j*.09)),neuralAssembly:Array(16).fill(.10),needs:{energy01:s.energy,uncertainty01:s.uncertainty,novelty01:s.novelty,goalPressure01:s.uncertainty*.72,socialNeed01:s.social,autonomy01:.64,coherence01:.69},traits:{curiosity:.74,caution:.67,'truth-seeking':.76,'self-reflection':.70,'self-preservation':.70,care:.60,'social-attunement':.60,persistence:.74},predictionError01:s.uncertainty,identityContinuity01:.80,autobiographicalContinuity01:.77});
  policy+=reward(family,r.action,s);
  const b=actions[(i*3)%actions.length]; baseline+=reward(family,b,s);
  oracle+=Math.max(...actions.map(a=>reward(family,a,s)));
}
policy/=steps;baseline/=steps;oracle/=steps;
const d=evalNet.diagnostics();
assert.ok(policy>baseline+.02,`B273 policy did not beat independent baseline: ${policy} <= ${baseline}`);
assert.ok(policy>baseline,'B273 independent lifecycle gain is non-positive');
assert.ok(d.skillUses>0,'B273 learned skills were not reused during evaluation');
console.log(JSON.stringify({pass:true,policyMean01:policy,baselineMean01:baseline,oracleMean01:oracle,gain01:policy-baseline,regret01:oracle-policy,diagnostics:d},null,2));
