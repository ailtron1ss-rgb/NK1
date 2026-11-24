import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const net=new B272EndogenousGoalGenesis();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const reward=(family,action,state)=>{
  const u=state.uncertainty, n=state.novelty, social=state.social, energy=state.energy;
  if(family==='discover') return action==='explore' ? .82-.08*u : action==='verify' ? .58+.12*u : .36;
  if(family==='repair') return action==='verify' ? .80+.08*u : action==='reflect' ? .60 : .34;
  if(family==='social') return action==='respond' ? .79+.08*social : action==='reflect' ? .55 : .31;
  if(family==='recovery') return action==='rest' ? .83+.10*(1-energy) : action==='reflect' ? .52 : .28;
  if(family==='coherence') return action==='reflect' ? .78+.12*(1-u) : action==='verify' ? .62 : .35;
  return .4+.1*n;
};
for(let t=0;t<240;t++){
  const family=['discover','repair','social','recovery','coherence'][t%5];
  const unc=family==='repair'?.82:family==='discover'?.62:.28+(t%7)*.03;
  const r=net.step({tick:t,selfLatent:Array(16).fill(0).map((_,i)=>Math.sin(t*.09+i*.13)),worldLatent:Array(16).fill(0).map((_,i)=>Math.cos(t*.03+i*.17)),needs:{energy01:.75,uncertainty01:unc,novelty01:family==='discover'?.8:.35,goalPressure01:unc*.7, socialNeed01:family==='social'?.8:.25},traits:{curiosity:.72,caution:.66,'truth-seeking':.75,'self-reflection':.68,'self-preservation':.69,care:family==='social'?.75:.52,'social-attunement':family==='social'?.74:.51,persistence:.71},predictionError01:unc,autobiographicalContinuity01:.74,identityContinuity01:.79,intrinsicReward01:.63,lastAction:null,lastReward01:.5});
  const sr=reward(family,r.action,{uncertainty:unc,novelty:.5,social:family==='social'?.8:.2,energy:.75});
  net.learnFromOutcome({tick:t,action:r.action,reward01:sr,predictionError01:unc,externalEvidence01:1,independentEvaluatorGain01:sr-.5,acceptedExternalGoal:sr>=.58});
}
const frozen=net.snapshot();
const evalNet=new B272EndogenousGoalGenesis(); evalNet.restore(frozen);
let policy=0,baseline=0,oracle=0;
for(let i=0;i<80;i++){
  const family=['discover','repair','social','recovery','coherence'][i%5];
  const s={uncertainty:family==='repair'?.88:family==='discover'?.68:.32,social:family==='social'?.82:.24,energy:family==='recovery'?.42:.76,novelty:family==='discover'?.85:.35};
  const r=evalNet.step({tick:1000+i,selfLatent:Array(16).fill(0).map((_,j)=>Math.sin((1000+i)*.07+j*.11)),worldLatent:Array(16).fill(0).map((_,j)=>Math.cos((1000+i)*.03+j*.13)),needs:{energy01:s.energy,uncertainty01:s.uncertainty,novelty01:s.novelty,goalPressure01:s.uncertainty*.68,socialNeed01:s.social},traits:{curiosity:.72,caution:.66,'truth-seeking':.75,'self-reflection':.68,'self-preservation':.69,care:.58,'social-attunement':.56,persistence:.71},predictionError01:s.uncertainty,autobiographicalContinuity01:.76,identityContinuity01:.80,intrinsicReward01:.64,lastAction:null,lastReward01:.5});
  policy+=reward(family,r.action,s);
  const b=actions[i%actions.length]; baseline+=reward(family,b,s);
  oracle+=Math.max(...actions.map(a=>reward(family,a,s)));
}
policy/=80;baseline/=80;oracle/=80;
assert.ok(policy>baseline+.015,`endogenous policy did not beat baseline: ${policy} <= ${baseline}`);
assert.ok(policy>baseline+.015,'policy did not beat independent baseline');
console.log(JSON.stringify({pass:true,policyMean01:policy,baselineMean01:baseline,oracleMean01:oracle,gain01:policy-baseline},null,2));
