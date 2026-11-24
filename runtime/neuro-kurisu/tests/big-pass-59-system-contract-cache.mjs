import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
const fabric = new OrganismSystemFabric();
const a = fabric.contracts();
const b = fabric.contracts();
assert.strictEqual(a, b, 'resolved system contract array should be cached');
assert.equal(a.length, 7);
assert.deepEqual(fabric.executionOrder(), a.slice().sort((x,y)=>(x.executionRank??99)-(y.executionRank??99)).map(x=>x.name));
console.log(`BIG_PASS_59_SYSTEM_CONTRACT_CACHE=PASS contracts=${a.length}`);
