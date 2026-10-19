import assert from 'node:assert/strict';
import { B284NeuralAutobiographicalIdentityCore } from '../src/organism/cognition/B284NeuralAutobiographicalIdentityCore.ts';

const b = new B284NeuralAutobiographicalIdentityCore();
const common = { evidence01: .86, verified01: .92, independent01: .9 };
let r = b.observeVerifiedRevisionEvidence({ tick: 1, reason: 'major-outcome', contextKey: 'lab|world|verify', ...common });
assert.equal(r.revised, false);
r = b.observeVerifiedRevisionEvidence({ tick: 2, reason: 'major-outcome', contextKey: 'lab|world|verify', ...common });
assert.equal(r.revised, false, 'same context should not satisfy holdout');
r = b.observeVerifiedRevisionEvidence({ tick: 3, reason: 'major-outcome', contextKey: 'home|world|verify', ...common });
assert.equal(r.revised, true, 'third corroboration with context holdout must promote');
assert.equal(b.snapshot().identityRevision, 1);
r = b.observeVerifiedRevisionEvidence({ tick: 4, reason: 'major-outcome', contextKey: 'lab|external|verify', ...common });
assert.equal(r.revised, false, 'cooldown should prevent immediate second revision');
const restored = new B284NeuralAutobiographicalIdentityCore();
restored.restore(b.snapshot());
assert.deepEqual(restored.snapshot(), b.snapshot());
console.log(`P2871_IDENTITY_REVISION_HOLDOUT=PASS revision=${b.snapshot().identityRevision} cooldownUntil=${b.snapshot().revisionCooldownUntilTick}`);
