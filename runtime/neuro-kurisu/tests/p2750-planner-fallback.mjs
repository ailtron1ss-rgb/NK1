import assert from 'node:assert/strict';
import { P2750UnifiedCausalWorldLoop } from '../src/organism/cognition/P2750UnifiedCausalWorldLoop.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map(a=>[a,.45]));
const c=new P2750UnifiedCausalWorldLoop();
const cold=c.beforeDecision({tick:1,latent:[.2,-.1,.4,.1,-.3,.2,.1,.0],baseUtilities:base,novelty01:.82,uncertainty01:.88,predictionError01:.76,resource01:.82,goalPressure01:.52,identityGap01:.16});
assert.ok(cold.informationValue01>.25,'cold planner ignored epistemic uncertainty');
assert.ok(cold.learningScale01<1.05,'cold planner did not restrict learning');
for(let t=2;t<180;t++){
  const l=[Math.sin(t*.03),Math.cos(t*.05),Math.sin(t*.07),.1,-.1,.2,.05,.0];
  const d=c.beforeDecision({tick:t,latent:l,baseUtilities:base,novelty01:.18,uncertainty01:.25,predictionError01:.17,resource01:.86,goalPressure01:.52,identityGap01:.12});
  c.observeOutcome({tick:t,latentBefore:l,latentAfter:l.map((x,k)=>x+(k===0?.03:-.01)),action:d.selectedAction,reward01:.78,predictionError01:.22,novelty01:.18,uncertainty01:.25,verified01:.92,contextId:d.contextId});
  const synthetic=c.syntheticReplay(1);if(synthetic.length)c.noteSyntheticCredit(synthetic[0].confidence01*(.5+synthetic[0].priority01*.5));
}
const hot=c.metrics();
assert.ok(hot.worldConfidence01>cold.worldConfidence01,'world confidence did not learn');
assert.ok(hot.actions.some(a=>a.samples>50),'action world models did not accumulate');
assert.ok(hot.syntheticReplayUsed>0,'synthetic replay never became available');
assert.ok(hot.plannerPolicyAgreement01>=0&&hot.plannerPolicyAgreement01<=1);
console.log(`P2750_PLANNER_FALLBACK=PASS coldInfo=${cold.informationValue01.toFixed(4)} coldLR=${cold.learningScale01.toFixed(4)} `+
`hotWorld=${hot.worldConfidence01.toFixed(4)} hotAgree=${hot.plannerPolicyAgreement01.toFixed(4)} synth=${hot.syntheticReplayUsed}`);
