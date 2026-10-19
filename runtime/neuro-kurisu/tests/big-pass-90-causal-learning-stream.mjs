import assert from 'node:assert/strict';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';

const mkState=(overrides={})=>({
  tick:1,at:1000,predictionError:.6,attentionBudget:.8,selfPredictionError:.2,autonomyScore:.6,
  needs:{energy:.7,cognitiveLoad:.3,uncertainty:.65,novelty:.7,goalPressure:.6,socialNeed:.4,identityCoherence:.82},
  ...overrides,
});
const trace={
  id:'trace-90',tick:1,createdAt:1000,candidates:[],selected:{action:'explore',goalId:'goal-1',predictedUtility:.6,confidence:.7,predictedCost:.3,reasons:[]},
  stateBefore:mkState(),reasoningSignals:{},userRequestedAction:null,autonomousOverride:true,predictedOutcomes:[]
};

const stream=new CausalExperienceStream(16);
stream.observe(trace);
const record=stream.recordOutcome(trace,mkState({tick:2,at:1100,needs:{...mkState().needs,energy:.55,uncertainty:.4,novelty:.75}}),{reward01:.8,success01:.8,surprise01:.7,novelty01:.75});
assert.ok(record);
assert.ok(record.causalStrength01>.3);
assert.ok(stream.summary().rolling.learningOpportunity01>0);
const packet=stream.learningPacket(8);
assert.equal(packet.records.length,1);
assert.ok(packet.meanCausalStrength01>0);
const persisted=stream.snapshot();
const restored=new CausalExperienceStream(16);
restored.restore(persisted);
assert.deepEqual(restored.recent(8),stream.recent(8));
const consolidated=restored.consolidate(8,1200);
assert.equal(consolidated.length,1);
assert.equal(restored.summary().consolidated,1);
console.log('BIG_PASS_90_CAUSAL_STREAM=PASS');
