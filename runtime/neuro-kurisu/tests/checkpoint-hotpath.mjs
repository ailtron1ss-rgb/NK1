import assert from 'node:assert/strict';
import { IntegritySentinel } from '../src/organism/system/IntegritySentinel.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const sentinel=new IntegritySentinel();
const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false});
await core.init();
const state=core.snapshot();
const before=state.state.tick;
const integrity=sentinel.check(state);
const stamped=sentinel.stamp(state,{...state.system.capabilities},integrity,{clone:false});
assert.equal(stamped,state);
assert.equal(state.state.tick,before);
assert.equal(typeof stamped.system.lastStateHash,'string');
assert.equal(stamped.system.lastStateHash.length,64);
console.log('CHECKPOINT_HOTPATH=PASS streamedHash=true inPlaceStamp=true');
