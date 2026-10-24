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

let restoreGetterReads = 0;
const hostileRestore = Object.defineProperty({}, 'novelty', {
  enumerable: true, get() { restoreGetterReads++; return 1; },
});
engine.restore(hostileRestore);
assert.equal(restoreGetterReads, 0, 'motivation restore must not execute persisted-state getters');
assert.equal(engine.snapshot().novelty, 0, 'unsafe persisted motivation state fails closed to defaults');

engine.update({ uncertainty:.7, predictionError:.2, novelty:.3, goalPressure:.2,
  socialNeed:.1, energy:.8, lastSuccess:.8, worldEvidenceQuality:.7 });
const beforeRejectedUpdate = engine.snapshot();
let updateGetterReads = 0;
const hostileUpdate = Object.defineProperty({
  predictionError:.2, novelty:.3, goalPressure:.2, socialNeed:.1, energy:.8,
  lastSuccess:.8, worldEvidenceQuality:.7,
}, 'uncertainty', {
  enumerable: true, get() { updateGetterReads++; return .99; },
});
assert.throws(() => engine.update(hostileUpdate), /intrinsic-motivation-input-must-be-plain-data/);
assert.equal(updateGetterReads, 0, 'live motivation update must reject getter-backed signals without invoking them');
assert.deepEqual(engine.snapshot(), beforeRejectedUpdate, 'rejected motivation updates must not partially mutate drive state');

const cyclicUpdate = { uncertainty:.7, predictionError:.2, novelty:.3, goalPressure:.2,
  socialNeed:.1, energy:.8, lastSuccess:.8, worldEvidenceQuality:.7 };
cyclicUpdate.self = cyclicUpdate;
assert.throws(() => engine.update(cyclicUpdate), /intrinsic-motivation-input-must-be-plain-data/);
assert.deepEqual(engine.snapshot(), beforeRejectedUpdate, 'cyclic motivation input must fail without state mutation');

console.log('WorkPass288 intrinsic motivation contract: PASS');
