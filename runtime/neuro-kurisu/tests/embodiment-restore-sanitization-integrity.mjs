import assert from 'node:assert/strict';
import { MultimodalPerception, defaultMultimodalState } from '../src/organism/body/MultimodalPerception.ts';
import { MultimodalSituationModel, defaultMultimodalSituation } from '../src/organism/body/MultimodalSituationModel.ts';
import { PerceptualEvidenceCompiler, defaultPerceptualEvidence } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';
import { EmbodimentSubsystemRuntime } from '../src/organism/core/EmbodimentSubsystemRuntime.ts';
import { P35SemanticWorldBodyEngine, defaultP35SemanticWorldBody } from '../src/organism/body/P35SemanticWorldBody.ts';
import { P37EmbodiedSensoriumEngine, defaultP37EmbodiedSensorium } from '../src/organism/body/P37EmbodiedSensorium.ts';
import { EmbodiedRecoveryController } from '../src/organism/body/EmbodiedRecoveryController.ts';

// Persisted body-subsystem snapshots are written to disk every tick and restored
// on the next start. Before this hardening, each restore() spread raw persisted
// values into live state, so a corrupted/truncated/hand-edited snapshot leaked
// NaN, strings, out-of-range numbers and non-plain objects into the running
// organism and poisoned every later metric that reads them. Each boundary must
// now fail closed to its default.

// --- MultimodalPerception -----------------------------------------------------
const multimodal = new MultimodalPerception();
multimodal.restore({
  events: 'nan',
  fused: -3,
  lastConfidence: 7,
  lastSalience: null,
  modalities: { text: 'corrupt', speech: null, vision: 5 },
  visionCaptures: -5,
  recent: 'not-an-array',
});
const mm = multimodal.snapshot();
assert.deepEqual(mm.modalities, { ...defaultMultimodalState().modalities, vision: 5 }, 'only valid counts survive; string/null counters fall back');
assert.equal(mm.events, 0);
assert.equal(mm.fused, 0);
assert.equal(mm.visionCaptures, 0);
assert.equal(mm.lastConfidence, 1, 'confidence above 1 clamps to 1');
assert.equal(mm.lastSalience, defaultMultimodalState().lastSalience);
assert.deepEqual(mm.recent, []);
// The next observation must fold a finite counter, never NaN.
multimodal.observe({ modality: 'text', summary: 'hello', confidence: 0.5, salience: 0.5, evidence: [] });
assert.equal(multimodal.snapshot().events, 1, 'counter must be a finite integer after restore');

// A valid snapshot round-trips exactly.
const multimodalSource = new MultimodalPerception();
multimodalSource.observe({ modality: 'vision', summary: 'frame', confidence: 0.7, salience: 0.6, evidence: ['cam'] });
const multimodalSnapshot = multimodalSource.snapshot();
const multimodalRestored = new MultimodalPerception();
multimodalRestored.restore(multimodalSnapshot);
assert.deepEqual(multimodalRestored.snapshot(), multimodalSnapshot, 'valid multimodal snapshot must round-trip');

// --- MultimodalSituationModel -------------------------------------------------
const situation = new MultimodalSituationModel();
situation.restore({
  situations: 'x',
  modalityReliability: { text: 5, vision: 'x', sensor: -0.4 },
  last: { version: 1, at: 'now', features: 'no', modalities: ['text', 'bogus'], confidence01: 9 },
  crossModalAgreements: 2.5,
});
const st = situation.snapshot();
assert.equal(st.modalityReliability.text, 1, 'reliability above 1 clamps to 1');
assert.equal(st.modalityReliability.vision, defaultMultimodalSituation().modalityReliability.vision, 'non-number reliability falls back');
assert.equal(st.modalityReliability.sensor, 0, 'negative reliability clamps to 0');
assert.equal(st.situations, 0);
assert.equal(st.crossModalAgreements, 0, 'non-integer counter falls back');
assert.deepEqual(st.last.modalities, ['text'], 'unknown modality ids are dropped');
assert.deepEqual(st.last.features, [], 'non-numeric features are dropped');
assert.equal(st.last.confidence01, 1);
assert.equal(st.last.at, 0);

// --- PerceptualEvidenceCompiler ----------------------------------------------
const evidence = new PerceptualEvidenceCompiler();
evidence.restore({
  updates: 'bad',
  scene: 42,
  metrics: { grounding01: 'x', conflict01: 99, unresolved01: -1 },
  evidence: [{ bogus: true }, 'not-a-record'],
  activeQuery: { id: 5, modality: 6, query: null, priority01: 9 },
});
const pe = evidence.snapshot();
assert.equal(pe.updates, 0);
assert.equal(pe.scene, defaultPerceptualEvidence().scene);
assert.equal(pe.metrics.grounding01, defaultPerceptualEvidence().metrics.grounding01, 'string metric falls back');
assert.equal(pe.metrics.conflict01, 1, 'metric above 1 clamps to 1');
assert.equal(pe.metrics.unresolved01, 0, 'negative metric clamps to 0');
assert.equal(pe.evidence.length, 1, 'only plain-record evidence rows survive; primitives are dropped');
assert.equal(pe.activeQuery.modality, 'unknown');
assert.equal(pe.activeQuery.priority01, 1);

// A valid snapshot round-trips exactly.
const evidenceSource = new PerceptualEvidenceCompiler();
evidenceSource.recordExternalEvidence({ at: 10, claim: 'sensor:door-open', confidence01: 0.8, verified: true });
const evidenceSnapshot = evidenceSource.snapshot();
const evidenceRestored = new PerceptualEvidenceCompiler();
evidenceRestored.restore(evidenceSnapshot);
assert.deepEqual(evidenceRestored.snapshot(), evidenceSnapshot, 'valid evidence snapshot must round-trip');

// --- DeviceEvidenceLedger -----------------------------------------------------
const ledger = new DeviceEvidenceLedger();
ledger.restore({ probes: 'x', verifiedProbes: -9, hostProbes: 1.5, lastStatus: 'TOTALLY_VERIFIED', records: [{ bogus: true }, 7] });
const le = ledger.snapshot();
assert.equal(le.probes, 0);
assert.equal(le.verifiedProbes, 0, 'a hostile snapshot must not inflate verified probes');
assert.equal(le.hostProbes, 0);
assert.equal(le.lastStatus, defaultDeviceEvidence().lastStatus, 'unknown status falls back');
assert.equal(le.records.length, 1, 'only plain-record ledger rows survive');
assert.equal(ledger.certification().status, 'unavailable', 'a corrupted snapshot must not certify a device');

// --- EmbodimentSubsystemRuntime camera evidence -------------------------------
const runtime = new EmbodimentSubsystemRuntime();
runtime.cameraEvidence.restore({ captures: 'x', lastAt: -1, cumulativeNovelty01: 5, previousHash: 7, last: 'nope' });
const cam = runtime.cameraEvidence.snapshot();
assert.equal(cam.captures, 0);
assert.equal(cam.lastAt, 0);
assert.equal(cam.cumulativeNovelty01, 1, 'novelty above 1 clamps to 1');
assert.equal(cam.previousHash, '');
assert.equal(cam.last, null);

// --- Accessor / Proxy safety --------------------------------------------------
// A persisted record must be read through own data descriptors only, so a hostile
// getter or Proxy reflection trap can never execute during restore.
let getterCalls = 0;
const accessorInput = { ...defaultMultimodalState() };
Object.defineProperty(accessorInput, 'events', {
  enumerable: true,
  get() {
    getterCalls += 1;
    throw new Error('persisted getter must not execute');
  },
});
const accessorRestored = new MultimodalPerception();
accessorRestored.restore(accessorInput);
assert.equal(getterCalls, 0, 'restore must inspect descriptors instead of executing getters');
assert.equal(accessorRestored.snapshot().events, 0);

const hostileProxy = new Proxy({}, {
  getOwnPropertyDescriptor() {
    throw new Error('hostile descriptor trap');
  },
});
const proxyRestored = new MultimodalPerception();
proxyRestored.restore(hostileProxy);
assert.deepEqual(proxyRestored.snapshot(), defaultMultimodalState(), 'a hostile proxy must fail closed to defaults');

// --- Defaults for null/undefined ----------------------------------------------
const emptyRestored = new PerceptualEvidenceCompiler();
emptyRestored.restore(undefined);
assert.deepEqual(emptyRestored.snapshot(), defaultPerceptualEvidence());

// --- P35 semantic world/body --------------------------------------------------
const p35 = new P35SemanticWorldBodyEngine();
p35.restore({
  tick: -1,
  metrics: { grounding01: 'x', conflict01: 99 },
  body: { energy01: 'bad', awake: 'yes' },
  modalityReliability: { text: 5, vision: 'x' },
  spatialSelf: { x: Number.NaN, orientationDeg: 1e9 },
  scene: { label: 5, confidence01: 9 },
  affordances: { respond: 7, bogus: 1 },
});
const p35s = p35.snapshot();
assert.equal(p35s.tick, 0, 'negative tick falls back');
assert.equal(p35s.metrics.grounding01, defaultP35SemanticWorldBody().metrics.grounding01, 'string metric falls back');
assert.equal(p35s.metrics.conflict01, defaultP35SemanticWorldBody().metrics.conflict01);
assert.equal(p35s.body.energy01, defaultP35SemanticWorldBody().body.energy01, 'non-number energy falls back');
assert.equal(p35s.body.awake, true, 'non-boolean awake fails closed to awake');
assert.equal(p35s.modalityReliability.text, 1, 'reliability above 1 clamps to 1');
assert.equal(p35s.modalityReliability.vision, defaultP35SemanticWorldBody().modalityReliability.vision);
assert.equal(p35s.spatialSelf.x, 0, 'NaN coordinate falls back');
assert.equal(p35s.spatialSelf.orientationDeg, 720, 'out-of-range orientation clamps');
assert.equal(p35s.scene.label, 'unknown', 'non-string scene label falls back');
assert.equal(p35s.scene.confidence01, 1);
assert.equal(p35s.affordances.respond, 1, 'affordance weight above 1 clamps to 1');
assert.equal('bogus' in p35s.affordances, false, 'unknown affordance keys are dropped');
assert.equal(Number.isFinite(p35.ingest({ text: 'hello', at: 1 }).body.energy01), true, 'P35 stays finite after ingest');

// A valid P35 snapshot round-trips exactly.
const p35Source = new P35SemanticWorldBodyEngine();
p35Source.ingest({ text: 'a person is near the door', vision: { sceneLabel: 'hall', confidence01: 0.7 }, at: 5 });
const p35Snapshot = p35Source.snapshot();
const p35Restored = new P35SemanticWorldBodyEngine();
p35Restored.restore(p35Snapshot);
assert.deepEqual(p35Restored.snapshot(), p35Snapshot, 'valid P35 snapshot must round-trip');

// --- P37 embodied sensorium ---------------------------------------------------
const p37 = new P37EmbodiedSensoriumEngine();
p37.restore({
  tick: -1,
  scene: { label: 5, confidence01: 9 },
  body: { energy01: 'bad', awake: 'yes' },
  sensors: { text: 'x', vision: { reliability01: 5, samples: -3 } },
  affordance: { respond: 5 },
  spatialSelf: { x: Number.NaN },
  entities: [{ id: 1, present01: 9, seenCount: -4, x: Number.NaN, presenceStatus: 'TOTALLY_VISIBLE' }, 'not-a-record'],
});
const p37s = p37.snapshot();
assert.equal(p37s.tick, 0);
assert.equal(p37s.body.energy01, defaultP37EmbodiedSensorium().body.energy01);
assert.equal(p37s.body.awake, true);
assert.equal(p37s.scene.label, 'unknown');
assert.equal(p37s.scene.confidence01, 1);
assert.equal(p37s.sensors.text.reliability01, defaultP37EmbodiedSensorium().sensors.text.reliability01, 'non-record sensor row falls back');
assert.equal(p37s.sensors.vision.reliability01, 1, 'sensor reliability above 1 clamps to 1');
assert.equal(p37s.sensors.vision.samples, 0, 'negative sample counter falls back');
assert.equal(p37s.affordance.respond, 1);
assert.equal(p37s.spatialSelf.x, 0, 'NaN spatial coordinate falls back');
assert.equal(p37s.entities.length, 1, 'only plain-record entity rows survive');
assert.equal(p37s.entities[0].id, 'entity-unknown', 'non-string entity id falls back');
assert.equal(p37s.entities[0].presenceStatus, 'unknown', 'unknown presence status falls back');
assert.equal(p37s.entities[0].seenCount, 1, 'non-positive seenCount is at least 1');
assert.equal(p37s.entities[0].x, null, 'a corrupted coordinate becomes null, never NaN');
assert.equal(Number.isFinite(p37.ingest({ text: 'hello', at: 1 }).body.energy01), true, 'P37 stays finite after ingest');

// A valid P37 snapshot round-trips exactly.
const p37Source = new P37EmbodiedSensoriumEngine();
p37Source.ingest({ text: 'the cat is on the mat', vision: { sceneLabel: 'room', confidence01: 0.6 }, at: 9 });
const p37Snapshot = p37Source.snapshot();
const p37Restored = new P37EmbodiedSensoriumEngine();
p37Restored.restore(p37Snapshot);
assert.deepEqual(p37Restored.snapshot(), p37Snapshot, 'valid P37 snapshot must round-trip');

// --- EmbodiedRecoveryController ----------------------------------------------
// A hostile action name such as `constructor` previously resolved to
// Object.prototype.constructor through the actionStates record, so advise()/
// record() would read a function instead of a ledger row.
const recovery = new EmbodiedRecoveryController();
recovery.restore({
  version: 1,
  enabled: 'yes',
  tick: -1,
  globalReliability01: 5,
  mode: 'TOTALLY_BLOCKED',
  actionStates: { explore: { attempts: 'x', reliability01: 9 }, constructor: { attempts: 5 }, ['__proto__']: { attempts: 9 } },
  episodes: [{ tick: -1, verificationClass: 'bogus' }, 'not-a-record'],
});
const rec = recovery.snapshot();
assert.equal(rec.enabled, true, 'non-boolean enabled fails closed to the safety default');
assert.equal(rec.tick, 0);
assert.equal(rec.globalReliability01, 1, 'reliability above 1 clamps to 1');
assert.equal(rec.mode, 'normal', 'unknown recovery mode falls back');
assert.equal(rec.actionStates.explore.attempts, 0, 'string counter falls back');
assert.equal(rec.actionStates.explore.reliability01, 1);
assert.equal(Object.prototype.hasOwnProperty.call(rec.actionStates, 'constructor'), false, 'prototype-key action names are dropped');
assert.equal(Object.prototype.hasOwnProperty.call(rec.actionStates, '__proto__'), false);
assert.equal(rec.episodes.length, 1, 'only plain-record episodes survive');
assert.equal(rec.episodes[0].verificationClass, 'unverified', 'unknown reliability class falls back');
assert.equal(rec.episodes[0].tick, 0);
assert.equal(recovery.advise('constructor', 1_000).mode, 'normal', 'advise stays safe for a prototype-key action');

// A valid recovery snapshot round-trips exactly.
const recoverySource = new EmbodiedRecoveryController();
recoverySource.record({ tick: 1, at: 10, action: 'explore', status: 'executed', realityClass: 'device-actuation', source: 'android-termux', verified01: 0.99, independent01: 0.99, effect01: 0.7, consequenceError01: 0.1 });
recoverySource.record({ tick: 2, at: 20, action: 'explore', status: 'failed', realityClass: 'device-actuation', source: 'android-termux', verified01: 0, independent01: 0, effect01: 0, consequenceError01: 0.9 });
const recoverySnapshot = recoverySource.snapshot();
const recoveryRestored = new EmbodiedRecoveryController(recoverySnapshot);
assert.deepEqual(recoveryRestored.snapshot(), recoverySnapshot, 'valid recovery snapshot must round-trip');

console.log('EMBODIMENT_RESTORE_SANITIZATION_INTEGRITY=PASS');
