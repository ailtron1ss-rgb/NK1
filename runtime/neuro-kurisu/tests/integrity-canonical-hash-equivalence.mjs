import assert from 'node:assert/strict';
import { IntegritySentinel } from '../src/organism/system/IntegritySentinel.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { createHash } from 'node:crypto';

function legacyHash(value) {
  const digest = createHash('sha256');
  const feed = (x, root = false) => {
    if (x === null) { digest.update('null'); return; }
    if (typeof x !== 'object') { const encoded = JSON.stringify(x); digest.update(encoded === undefined ? 'null' : encoded); return; }
    if (Array.isArray(x)) { digest.update('['); for (let i=0;i<x.length;i++) { if (i) digest.update(','); feed(x[i]); } digest.update(']'); return; }
    const keys = Object.keys(x).filter(k => !(root && k === 'system')).sort();
    digest.update('{');
    for (let i=0;i<keys.length;i++) { if (i) digest.update(','); const k=keys[i]; digest.update(JSON.stringify(k)); digest.update(':'); feed(x[k]); }
    digest.update('}');
  };
  feed(value, true);
  return digest.digest('hex');
}

const core = new OrganismCore(new MemoryStateStore(), { performanceProfile:'mobile', cycleResultMode:'operational' });
await core.init();
for (let i=0;i<12;i++) await core.observe({ novelty:.4+i*.01, embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.88,awake:true,battery01:.78,cpuLoad01:.2,ramPressure01:.22}}, 'operational');
const state = core.persisted;
const sentinel = new IntegritySentinel();
assert.equal(sentinel.hash(state), legacyHash(state));
console.log(JSON.stringify({ pass:true, hash:sentinel.hash(state) }));
