import { strict as assert } from 'node:assert';
import { P33PersonhoodCore } from '../src/organism/cognition/P33PersonhoodCore.ts';

const a=new P33PersonhoodCore();
a.attachDevice('poco-m7-pro');
a.markTransfer('laptop');
const snap=a.snapshot();
assert.equal(snap.continuity.transferCount,1);
assert.deepEqual(snap.continuity.deviceHistory,['poco-m7-pro','laptop']);
const b=new P33PersonhoodCore();
b.restore(snap);
assert.equal(b.snapshot().identity.canonicalName,'Makise Kurisu');
assert.equal(b.snapshot().continuity.transferCount,1);
console.log('P33_CONTINUITY=PASS', JSON.stringify({devices:b.snapshot().continuity.deviceHistory,transferCount:b.snapshot().continuity.transferCount}));
