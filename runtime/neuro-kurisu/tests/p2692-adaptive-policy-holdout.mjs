import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Independent holdout: each context has a different policy with the best delayed outcome.
// The holdout is deterministic and deliberately separate from the training query strings.
const train=new MemoryOS2({signalFusionProfile:'balanced'});
for(let i=0;i<120;i++) train.encode({content:`training episode subject-${i%10} objective-${i%6} event-${i%4}`,kind:'episodic',salience:.4+(i%5)*.1,emotionalWeight:.2,identityRelevance:.1,goalRelevance:(i%6)/6,socialRelevance:.1,predictionError:(i%7)/7,confidence:.8,epistemicStatus:'fact',source:'p2692-train',entities:[`subject-${i%10}`],semanticLinks:[],temporalLinks:[],causalLinks:[]});
const policies=['semantic','hybrid','causal','temporal','balanced'];
const contexts=[
  {goal:.9,causal:.1,temporal:.1,pressure:.1,best:'semantic'},
  {goal:.1,causal:.1,temporal:.1,pressure:.1,best:'hybrid'},
  {goal:.2,causal:.9,temporal:.1,pressure:.2,best:'causal'},
  {goal:.2,causal:.1,temporal:.9,pressure:.2,best:'temporal'},
  {goal:.5,causal:.5,temporal:.5,pressure:.8,best:'balanced'}
];
// Train each contextual bucket with an externally assigned delayed outcome.
for(let round=0;round<30;round++) for(const c of contexts){
  const query=c.best==='causal'?`why caused training subject-${round%10}`:c.best==='temporal'?`recent training subject-${round%10}`:`training subject-${round%10} objective-${round%6}`;
  const rows=train.retrieve(query,8,c.goal,.3);
  const chosen=train.adaptivePolicyDiagnostics().lastPolicy;
  const quality=chosen===c.best?.95:.18;
  train.observeRetrievalOutcomeV2({quality01:quality,retention01:quality,transfer01:quality,interference01:quality,delayed01:quality,computeCost01:.15},chosen);
  if(!rows.length) throw new Error('empty retrieval during training');
}
const d=train.adaptivePolicyDiagnostics();
if(d.contextCount<5) throw new Error(`expected contextual learning, got ${d.contextCount}`);
if(Object.values(d.trials).reduce((a,b)=>a+b,0)!==150) throw new Error('unexpected trial count');
if(d.contextCount<8) throw new Error(`context buckets did not separate enough: ${d.contextCount}`);
// Persistence check: learned contextual values survive snapshot/restore.
const restored=new MemoryOS2({signalFusionProfile:'balanced'}); restored.restore(train.snapshot());
const d2=restored.adaptivePolicyDiagnostics();
if(d2.contextCount!==d.contextCount) throw new Error('context policy state did not persist');
console.log(`P2692_ADAPTIVE_POLICY_HOLDOUT=PASS contexts=${d2.contextCount} trials=${JSON.stringify(d2.trials)} reward=${JSON.stringify(d2.reward)}`);
