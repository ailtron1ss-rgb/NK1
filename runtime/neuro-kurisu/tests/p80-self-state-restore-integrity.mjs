import assert from 'node:assert/strict';
import { P80UnifiedSelfState, defaultP80 } from '../src/organism/cognition/P80UnifiedSelfState.ts';

const valid=new P80UnifiedSelfState();
const snapshot=valid.snapshot();
snapshot.cycles=9;snapshot.continuity01=.91;snapshot.coherence01=.87;snapshot.agency01=.68;
snapshot.realityAlignment01=.93;snapshot.currentMode='reflect';snapshot.recentModes=['wait','explore','reflect'];
snapshot.recentActions=['verify','reflect'];snapshot.modeStreak=3;snapshot.noveltyPressure01=.44;
snapshot.lastTick=88;snapshot.lastAction='reflect';snapshot.lastReason='planned self review';
const restored=new P80UnifiedSelfState();restored.restore(snapshot);
assert.deepEqual(restored.snapshot(),snapshot,'valid P80 self-state snapshots must round-trip');

let getterCalls=0;const hostile={};
Object.defineProperty(hostile,'continuity01',{enumerable:true,get(){getterCalls++;throw new Error('P80 getter executed');}});
const fromGetter=new P80UnifiedSelfState();
assert.doesNotThrow(()=>fromGetter.restore(hostile));
assert.equal(getterCalls,0,'restore must not invoke persisted getters');
assert.equal(fromGetter.snapshot().continuity01,defaultP80().continuity01);

const revoked=Proxy.revocable({},{});revoked.revoke();
const fromProxy=new P80UnifiedSelfState();
assert.doesNotThrow(()=>fromProxy.restore(revoked.proxy));
assert.equal(fromProxy.snapshot().version,1);
assert.equal(fromProxy.snapshot().currentMode,'wait');

const malformed=new P80UnifiedSelfState();
malformed.restore({
 version:99,cycles:-3,continuity01:5,coherence01:-2,agency01:Infinity,realityAlignment01:.6,
 currentMode:'self-hack',recentModes:['wait','root-access',,'reflect',7],
 recentActions:['verify',7,'x'.repeat(500),'reflect'],modeStreak:2.5,noveltyPressure01:NaN,
 lastTick:-1,lastAction:7,lastReason:'r'.repeat(8000)
});
const clean=malformed.snapshot();
assert.equal(clean.version,1);assert.equal(clean.cycles,0);assert.equal(clean.continuity01,1);
assert.equal(clean.coherence01,0);assert.equal(clean.agency01,defaultP80().agency01);
assert.equal(clean.currentMode,'wait');assert.deepEqual(clean.recentModes,['wait','reflect']);
assert.deepEqual(clean.recentActions,['verify','reflect']);assert.equal(clean.modeStreak,0);
assert.equal(clean.noveltyPressure01,defaultP80().noveltyPressure01);assert.equal(clean.lastTick,0);
assert.equal(clean.lastAction,'wait');assert.ok(clean.lastReason.length<=240);

const reset=new P80UnifiedSelfState();reset.restore(undefined);
assert.deepEqual(reset.snapshot().recentModes,[]);
console.log('p80-self-state-restore-integrity: PASS');
