import assert from 'node:assert/strict';
import { PersistenceProjectionGovernor } from '../src/organism/persistence/PersistenceProjectionGovernor.ts';

const g = new PersistenceProjectionGovernor();
let d = g.decide({ force:true, baseEvery:4, pressure01:0.1 });
assert.equal(d.full,true);
d = g.decide({ force:false, baseEvery:4, pressure01:0.1 }); assert.equal(d.full,false); assert.equal(d.dirtyCyclesSinceFull,1);
d = g.decide({ force:false, baseEvery:4, pressure01:0.1 }); assert.equal(d.full,false);
d = g.decide({ force:false, baseEvery:4, pressure01:0.1 }); assert.equal(d.full,false);
d = g.decide({ force:false, baseEvery:4, pressure01:0.1 }); assert.equal(d.full,true);
d = g.decide({ force:false, baseEvery:4, pressure01:.9 }); assert.equal(d.full,true); assert.equal(d.reason,'pressure');
console.log(`PERSISTENCE_PROJECTION_GOVERNOR=PASS full=${g.snapshot().fullCheckpoints} hot=${g.snapshot().hotCheckpoints}`);
