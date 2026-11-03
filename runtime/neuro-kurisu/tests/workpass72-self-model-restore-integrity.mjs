import assert from 'node:assert/strict';
import { SelfModelEngine, defaultSelfModel } from '../src/organism/cognition/SelfModelV2.ts';

/** defaultSelfModel() stamps Date.now(); compare everything except that volatile field. */
const assertDefaults = (model) => {
  const { updatedAt, ...rest } = model;
  const { updatedAt: ignored, ...expected } = defaultSelfModel();
  assert.deepEqual(rest, expected);
};

// 1. Valid snapshot round-trips and keeps learned values.
const engine = new SelfModelEngine();
engine.restore({
  predictedAction:'verify', confidence:.62, actionAccuracy:.71, calibrationError:.18,
  identityCoherence:.83, agencyBelief:.64, recentErrors:[0,1,0], preferredStrategies:['verify','reflect'],
  updatedAt:1234, recoveryCount:2, lastRecoveryAt:900, continuityShock01:.1, postRecoveryIntegration01:.7,
  goalAlignment01:.6, goalAlignmentEMA01:.58, selfConsistentAction11:{verify:.4,rest:-.2},
  identityGateAcceptedCount:3, identityGateRejectedCount:1,
  lastIdentityGate:{accepted:true,reason:'verified-independent-outcome-bound',at:10,evidenceRef:'world-transition:x'},
});
let snapshot = engine.snapshot();
assert.equal(snapshot.predictedAction,'verify');
assert.equal(snapshot.identityCoherence,.83);
assert.equal(snapshot.agencyBelief,.64);
assert.deepEqual(snapshot.preferredStrategies,['verify','reflect']);
assert.equal(snapshot.selfConsistentAction11.verify,.4);
assert.equal(snapshot.selfConsistentAction11.rest,-.2);
assert.equal(snapshot.identityGateAcceptedCount,3);
assert.equal(snapshot.lastIdentityGate.accepted,true);

// 2. A corrupt snapshot must not crash or leak invalid values into live behaviour.
const corrupt = new SelfModelEngine();
assert.doesNotThrow(() => corrupt.restore({
  identityCoherence:99, agencyBelief:NaN, actionAccuracy:-3, recentErrors:'notarray',
  selfConsistentAction11:null, recoveryCount:-5, preferredStrategies:'nope',
  lastIdentityGate:{accepted:'yes',reason:5,at:Infinity},
}));
snapshot = corrupt.snapshot();
assert.ok(snapshot.identityCoherence >= 0 && snapshot.identityCoherence <= 1);
assert.ok(snapshot.agencyBelief >= 0 && snapshot.agencyBelief <= 1);
assert.ok(snapshot.actionAccuracy >= 0 && snapshot.actionAccuracy <= 1);
assert.deepEqual(snapshot.recentErrors,[]);
assert.deepEqual(snapshot.preferredStrategies,[]);
assert.deepEqual(snapshot.selfConsistentAction11,{});
assert.equal(snapshot.recoveryCount,0);
assert.equal(snapshot.lastIdentityGate,null);
// The prior crash: actionBias indexed a null consistency map.
assert.doesNotThrow(() => corrupt.actionBias('explore'));
assert.ok(Number.isFinite(corrupt.actionBias('explore')));

// 3. Accessors, exotic prototypes and hostile traps fail closed without executing getters.
let getterCalls = 0;
const hostile = {};
Object.defineProperty(hostile,'agencyBelief',{ enumerable:true, get(){ getterCalls++; throw new Error('getter executed'); } });
Object.defineProperty(hostile,'identityCoherence',{ enumerable:true, get(){ getterCalls++; throw new Error('getter executed'); } });
const guarded = new SelfModelEngine();
guarded.restore({ identityCoherence:.5, agencyBelief:.5 });
assert.doesNotThrow(() => guarded.restore(hostile));
assert.equal(getterCalls,0,'restore must never execute snapshot accessors');
assertDefaults(guarded.snapshot());

const inherited = Object.create({ agencyBelief:.9 });
assert.doesNotThrow(() => guarded.restore(inherited));
assert.equal(guarded.snapshot().agencyBelief, defaultSelfModel().agencyBelief,'inherited properties are ignored');

const proxy = new Proxy({}, { getPrototypeOf(){ throw new Error('prototype trap'); } });
assert.doesNotThrow(() => guarded.restore(proxy));
assertDefaults(guarded.snapshot());

const revoked = Proxy.revocable({},{}); revoked.revoke();
assert.doesNotThrow(() => guarded.restore(revoked.proxy));
assertDefaults(guarded.snapshot());

// 4. Unknown action kinds and out-of-range strategy entries are dropped.
const strict = new SelfModelEngine();
strict.restore({ predictedAction:'teleport', selfConsistentAction11:{verify:.4,bad:'x',huge:99}, preferredStrategies:['verify','',42,'reflect'] });
snapshot = strict.snapshot();
assert.equal(snapshot.predictedAction,'none');
assert.deepEqual(Object.keys(snapshot.selfConsistentAction11).sort(),['huge','verify']);
assert.equal(snapshot.selfConsistentAction11.huge,1,'finite out-of-range consistency is clamped');
assert.deepEqual(snapshot.preferredStrategies,['verify','reflect']);

console.log('WORKPASS72_SELF_MODEL_RESTORE_INTEGRITY=PASS');
