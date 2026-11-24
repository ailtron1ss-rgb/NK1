import assert from 'node:assert/strict';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from '../src/organism/system/B292CognitiveStateBus.ts';
import { B292IntentTrace, defaultB292IntentTrace } from '../src/organism/system/B292IntentTrace.ts';

const bus=new B292CognitiveStateBus();
bus.restore(defaultB292CognitiveStateBus());
for(let i=1;i<=240;i++){
  const s=bus.build({tick:i,goalId:'g1',goalPressure01:.4,identityContinuity01:.88,selfAgency01:.7,selfCoherence01:.8,realityAlignment01:.72,novelty01:(i%20)/20,uncertainty01:.25,energy01:.75,thermal01:.18,predictionError01:i%15===0?.72:.16,cognitiveLoad01:.22,externalInput01:i%13===0?1:0,b289Agency01:.72,b289Integration01:.82,b290Mode:i%31===0?'verify':'consolidate',b290Gate01:.74,b291Mode:'maintain',b291Gate01:.81,workingIntent:'explore',selectedAction:'explore'});
  assert.ok(s.readiness01>=0&&s.readiness01<=1);
  assert.ok(s.stability01>=0&&s.stability01<=1);
}
const trace=new B292IntentTrace();
trace.restore(defaultB292IntentTrace());
for(let i=1;i<=240;i++){
  trace.observeDecision({tick:i,goalId:'g1',action:i%19===0?'verify':'explore',mode:i%19===0?'switch':'maintain',autonomy01:.72,gate01:.81,external01:i%13===0?1:0});
  trace.observeOutcome({tick:i,action:i%19===0?'verify':'explore',reward01:i%17===0?.2:.78,predictionError01:i%17===0?.72:.14,external01:i%13===0?1:0});
}
const snap=trace.snapshot();
assert.equal(snap.records.length,96);
assert.ok(snap.switchCount>0);
assert.ok(snap.outcomeCount===240);
assert.ok(snap.commitment01>=0&&snap.commitment01<=1);
console.log(JSON.stringify({pass:true,busCycles:240,intentDecisions:240,commitment01:snap.commitment01,continuity01:snap.continuity01,switchCount:snap.switchCount,successEMA01:snap.successEMA01}));
