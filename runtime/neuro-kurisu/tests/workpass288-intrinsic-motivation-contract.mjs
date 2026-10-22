import assert from 'node:assert/strict';
import { IntrinsicMotivationEngine } from '../src/organism/cognition/IntrinsicMotivationEngine.ts';

const engine=new IntrinsicMotivationEngine();
const state=engine.update({
  uncertainty:NaN,
  predictionError:Infinity,
  novelty:-4,
  goalPressure:0.2,
  socialNeed:0.4,
  energy:0.7,
  lastSuccess:NaN,
  worldEvidenceQuality:2,
});
for(const key of ['epistemic','novelty','competence','coherence','social','homeostatic','overall']) {
  assert.ok(Number.isFinite(state[key]), key+' must be finite');
  assert.ok(state[key]>=0&&state[key]<=1, key+' must be bounded');
}
assert.equal(state.epistemic,0);
assert.equal(state.novelty,0);
assert.equal(state.competence,0.5*0.72+0*0.18+0.8*0.10);

engine.restore({
  epistemic:NaN,
  novelty:0.8,
  competence:Infinity,
  coherence:-2,
  social:0.2,
  homeostatic:0.1,
  overall:1,
  dominant:'homeostatic',
  updatedAt:Infinity,
});
const restored=engine.snapshot();
assert.equal(restored.epistemic,0);
assert.equal(restored.novelty,0.8);
assert.equal(restored.competence,0);
assert.equal(restored.coherence,0);
assert.equal(restored.overall,0.8);
assert.equal(restored.dominant,'novelty');
assert.ok(Number.isFinite(restored.updatedAt));
assert.equal(engine.proposeGoal()?.reason,'intrinsic-novelty=0.80');

const detached=engine.snapshot();
detached.novelty=0;
assert.equal(engine.snapshot().novelty,0.8);

engine.restore({overall:1,dominant:'made-up'});
assert.equal(engine.snapshot().overall,0);
assert.equal(engine.proposeGoal(),null);
assert.equal(engine.proposeInitiative({observationId:'obs-1',predictionId:'pred-1',worldEvidenceQuality:0.9,causalContinuity01:0.8}),null);

engine.update({uncertainty:0.9,predictionError:0.7,novelty:0.8,goalPressure:0.2,socialNeed:0.1,energy:0.8,lastSuccess:0.5,worldEvidenceQuality:0.9});
const initiative=engine.proposeInitiative({observationId:'obs-2',predictionId:'pred-2',worldEvidenceQuality:0.9,causalContinuity01:0.8});
assert.equal(initiative?.kind,'intrinsic-goal-candidate');
assert.equal(initiative?.evidence.observationId,'obs-2');
assert.ok(initiative?.goal.reason.includes('intrinsic-'));
assert.equal(engine.proposeInitiative({observationId:'obs-3',predictionId:'pred-3',worldEvidenceQuality:0.49,causalContinuity01:0.8}),null);
assert.equal(engine.proposeInitiative({observationId:'obs-4',predictionId:'pred-4',worldEvidenceQuality:0.9,causalContinuity01:NaN}),null);
assert.equal(engine.proposeInitiative({observationId:'bad\\nobs',predictionId:'pred-5',worldEvidenceQuality:0.9,causalContinuity01:0.8}),null);

console.log('WorkPass288-289 intrinsic motivation contract: PASS');
