import assert from 'node:assert/strict';
import { P41SemanticPerceptionEngine, defaultP41SemanticPerception } from '../src/organism/cognition/P41SemanticPerception.ts';

const engine = new P41SemanticPerceptionEngine();
assert.deepEqual(engine.snapshot(), defaultP41SemanticPerception());

const t0 = 1_000;
const first = engine.ingest({
  text: 'Kurisu is in the laboratory',
  vision: { semantic: true, sceneLabel: 'laboratory', confidence01: .88, objects: [{ label:'terminal', kind:'object', confidence01:.91, x:1, y:0, z:2 }], relations:[{ from:'Kurisu', relation:'near', to:'terminal', confidence01:.84 }], events:[{label:'screen-on', confidence01:.77}], latencyMs:210 },
  audio: { semantic: true, events:[{label:'keyboard', confidence01:.71}], latencyMs:160 },
  sensor: { location:'lab', energy01:.82, thermal01:.22, capacity01:.91, freshness01:.97 },
  world: { scene:'laboratory', objects:[{label:'terminal',confidence01:.8}], events:['screen-on'] },
  at:t0,
});
assert.equal(first.scene.label,'laboratory');
assert.ok(first.entities.some(e=>e.label==='terminal'));
assert.ok(first.events.some(e=>e.label==='screen-on'));
assert.ok(first.snapshots.length===1);

const second = engine.ingest({
  vision: { semantic:false, sceneLabel:'office', confidence01:.9 },
  audio: { semantic:false },
  sensor: { location:'office', energy01:.6, thermal01:.34, capacity01:.74, freshness01:.91 },
  at:2_000,
});
assert.ok(second.pending.some(p=>p.modality==='vision' && p.status==='pending'));
assert.ok(second.pending.some(p=>p.modality==='audio' && p.status==='pending'));
assert.ok(second.snapshots.length===2);
assert.ok(second.metrics.temporalBinding01>0);

const pending = engine.nextPerception(2_050);
assert.ok(pending && ['vision','audio'].includes(pending.modality));
const empiricalReliabilityBeforeFulfil = engine.snapshot().modalityReliability[pending.modality].reliability01;
assert.equal(engine.fulfill(pending.id,true,2_100),true);
const after = engine.snapshot();
assert.equal(after.modalityReliability[pending.modality].reliability01, empiricalReliabilityBeforeFulfil, 'successful service fulfilment is not proof of semantic correctness');
assert.ok(after.modalityReliability[pending.modality].serviceSuccess01 > .5);
console.log(`P41_SEMANTIC_PERCEPTION=PASS entities=${after.entities.length} events=${after.events.length} pending=${after.pending.length} temporal=${after.metrics.temporalBinding01.toFixed(3)}`);
