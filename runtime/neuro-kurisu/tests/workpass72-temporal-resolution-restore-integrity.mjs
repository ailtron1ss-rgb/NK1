import assert from 'node:assert/strict';
import { TemporalResolutionGovernor, defaultTemporalResolutionState } from '../src/organism/core/TemporalResolutionGovernor.ts';

// 1. A valid snapshot round-trips exactly.
const governor = new TemporalResolutionGovernor();
governor.restore({ version:1, pulses:4, microCycles:11, idleCyclesSincePulse:3, lastLevel:'micro', lastReason:'cadence', fullEvery:2, savedPulseFraction01:.73, lastAt:1234 });
let snapshot = governor.snapshot();
assert.equal(snapshot.pulses,4);
assert.equal(snapshot.microCycles,11);
assert.equal(snapshot.idleCyclesSincePulse,3);
assert.equal(snapshot.lastLevel,'micro');
assert.equal(snapshot.lastReason,'cadence');
assert.equal(snapshot.fullEvery,2);
assert.equal(snapshot.savedPulseFraction01,.73);
assert.equal(snapshot.lastAt,1234);

// 2. A corrupt snapshot cannot poison future cadence decisions.
const corrupt = new TemporalResolutionGovernor();
corrupt.restore({ version:1, pulses:3, microCycles:9, idleCyclesSincePulse:NaN, lastLevel:'bogus', lastReason:'nonsense', fullEvery:-5, savedPulseFraction01:42, lastAt:-99 });
snapshot = corrupt.snapshot();
assert.ok(Number.isSafeInteger(snapshot.idleCyclesSincePulse) && snapshot.idleCyclesSincePulse >= 0, 'idle counter must be a non-negative integer');
assert.ok(['pulse','micro'].includes(snapshot.lastLevel), 'lastLevel must be a known level');
assert.ok(['quality','external-signal','pressure','cadence','resource','idle'].includes(snapshot.lastReason), 'lastReason must be a known reason');
assert.ok(Number.isSafeInteger(snapshot.fullEvery) && snapshot.fullEvery >= 1, 'fullEvery must stay a positive integer');
assert.ok(snapshot.savedPulseFraction01 >= 0 && snapshot.savedPulseFraction01 <= 1, 'saved fraction must stay normalized');
assert.ok(snapshot.lastAt >= 0, 'lastAt must be non-negative');
// Preserved counters from the same snapshot remain intact.
assert.equal(snapshot.pulses,3);
assert.equal(snapshot.microCycles,9);
// The governor must keep pulsing under a balanced profile after corruption.
let fullPulses = 0;
for (let tick = 0; tick < 20; tick++) {
  const decision = corrupt.decide({ profile:'balanced', externalSignal:false, pressure01:0, tick });
  assert.ok(Number.isFinite(decision.idleCyclesSincePulse));
  if (decision.runFullCognition) fullPulses++;
}
assert.ok(fullPulses > 0, 'a corrupted restore must not freeze the cognitive pulse');

// 3. Accessors, exotic prototypes and hostile traps fail closed without executing getters.
let getterCalls = 0;
const hostile = {};
Object.defineProperty(hostile,'idleCyclesSincePulse',{ enumerable:true, get(){ getterCalls++; throw new Error('getter executed'); } });
Object.defineProperty(hostile,'pulses',{ enumerable:true, get(){ getterCalls++; throw new Error('getter executed'); } });
const guarded = new TemporalResolutionGovernor();
guarded.restore({ version:1, pulses:7, microCycles:2, idleCyclesSincePulse:1, lastLevel:'pulse', lastReason:'quality', fullEvery:1, savedPulseFraction01:.2, lastAt:10 });
assert.doesNotThrow(() => guarded.restore(hostile));
assert.equal(getterCalls,0,'restore must never execute snapshot accessors');
assert.deepEqual(guarded.snapshot(), defaultTemporalResolutionState(), 'a hostile snapshot resets to defaults');

const inherited = Object.create({ pulses:900 });
inherited.version = 1;
assert.doesNotThrow(() => guarded.restore(inherited));
assert.equal(guarded.snapshot().pulses,0,'inherited properties are ignored');

const hostileProxy = new Proxy({}, { getPrototypeOf(){ throw new Error('prototype trap'); } });
assert.doesNotThrow(() => guarded.restore(hostileProxy));
assert.equal(guarded.snapshot().pulses,0,'prototype traps fail closed');

const revoked = Proxy.revocable({},{}); revoked.revoke();
assert.doesNotThrow(() => guarded.restore(revoked.proxy));
assert.equal(guarded.snapshot().pulses,0,'revoked proxies fail closed');

// 4. Unknown versions reset instead of importing unversioned state.
guarded.restore({ version:9, pulses:100, fullEvery:5 });
assert.equal(guarded.snapshot().pulses,0);
assert.equal(guarded.snapshot().fullEvery,1);

// 5. A non-finite base cadence must not leak NaN into fullEvery.
const cadence = new TemporalResolutionGovernor();
const decision = cadence.decide({ profile:'balanced', externalSignal:false, baseFullEvery:NaN, tick:0 });
assert.ok(Number.isSafeInteger(decision.fullEvery) && decision.fullEvery >= 1, 'fullEvery must remain a positive integer for a non-finite base');

console.log('WORKPASS72_TEMPORAL_RESOLUTION_RESTORE_INTEGRITY=PASS');
