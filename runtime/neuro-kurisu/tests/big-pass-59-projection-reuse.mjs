import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode:'operational', checkpointMinIntervalMs:0, checkpointMaxDirtyCycles:1 });
await core.init();
const counts = new Map();
const wrapped=[];
const candidates = [
  ['p29Learning','p29Learning'],
  ['p30Continual','p30Continual'],
  ['p36SelfDevelopment','p36SelfDevelopment'],
  ['p35SemanticWorldBody', 'p35SemanticWorldBody'],
  ['p40SemanticIntelligence','p40SemanticIntelligence'],
  ['p41SemanticPerception','p41SemanticPerception'],
  ['p41NativePerception','p41NativePerception'],
  ['p42Experience','p42Experience'],
  ['p43Imagery','p43Imagery'],
  ['p44PredictiveWorld','p44PredictiveWorld']
];
const systems = core.organismSystems;
for (const [group,key] of candidates) {
  const owner = ['p35SemanticWorldBody','p40SemanticIntelligence','p41SemanticPerception','p41NativePerception','p42Experience','p43Imagery'].includes(key) ? systems.embodiment :
    key==='p44PredictiveWorld' ? systems.world : undefined;
  const target = owner?.[key] ?? core[group];
  if (!target || typeof target.snapshot !== 'function') continue;
  const original = target.snapshot.bind(target);
  let n=0;
  target.snapshot = (...args)=>{ n++; counts.set(key,n); return original(...args); };
  wrapped.push([target, original]);
}
await core.checkpoint(true);
for (const [target,original] of wrapped) target.snapshot=original;
const duplicated = [...counts.entries()].filter(([,n])=>n>1);
assert.equal(duplicated.length, 0, `duplicate snapshot providers detected: ${JSON.stringify(duplicated)}`);
assert.ok(counts.size>5);
console.log(`BIG_PASS_59_PROJECTION_REUSE=PASS providers=${counts.size} maxCalls=${Math.max(...counts.values())}`);
