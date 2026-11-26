import assert from 'node:assert/strict';
import { MultimodalPerception, defaultMultimodalState } from '../src/organism/body/MultimodalPerception.ts';
import { MultimodalSituationModel, defaultMultimodalSituation } from '../src/organism/body/MultimodalSituationModel.ts';
import { PerceptualEvidenceCompiler, defaultPerceptualEvidence } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';
import { EmbodimentSubsystemRuntime } from '../src/organism/core/EmbodimentSubsystemRuntime.ts';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
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
  modalities: { text: 'corrupt', speech: null, audio: 3, vision: 5 },
  visionCaptures: -5,
  recent: 'not-an-array',
});
const mm = multimodal.snapshot();
assert.deepEqual(mm.modalities, { ...defaultMultimodalState().modalities, audio: 3, vision: 5 }, 'valid current-source audio/vision counts survive; string/null counters fall back');
assert.equal(mm.events, 0);
assert.equal(mm.fused, 0);
assert.equal(mm.visionCaptures, 0);
assert.equal(mm.lastConfidence, 1, 'confidence above 1 clamps to 1');
assert.equal(mm.lastSalience, defaultMultimodalState().lastSalience);
assert.deepEqual(mm.recent, []);
// The next observation must fold a finite counter, never NaN.
multimodal.observe({ modality: 'text', summary: 'hello', confidence: 0.5, salience: 0.5, evidence: [] });
assert.equal(multimodal.snapshot().events, 1, 'counter must be a finite integer after restore');

// A revoked Proxy can throw even during Array.isArray(); restore must fail closed.
{
  const revoked = Proxy.revocable({ events: 7 }, {});
  revoked.revoke();
  const safe = new MultimodalPerception();
  assert.doesNotThrow(() => safe.restore(revoked.proxy));
  assert.deepEqual(safe.snapshot(), defaultMultimodalState(), 'revoked Proxy restores to safe defaults');
}

// A throwing reflection trap is contained; ordinary accessors are never invoked.
{
  const trap = new Proxy({ events: 7 }, {
    getOwnPropertyDescriptor() {
      throw new Error('hostile descriptor trap');
    },
  });
  const safe = new MultimodalPerception();
  assert.doesNotThrow(() => safe.restore(trap));
  assert.deepEqual(safe.snapshot(), defaultMultimodalState(), 'throwing Proxy traps restore to safe defaults');
}

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
assert.equal(pe.metrics.conflict01, defaultPerceptualEvidence().metrics.conflict01, 'unverified aggregate metrics reset to defaults');
assert.equal(pe.metrics.unresolved01, defaultPerceptualEvidence().metrics.unresolved01, 'unverified aggregate metrics reset to defaults');
assert.equal(pe.evidence.length, 0, 'plain records without the required evidence schema are dropped');
assert.equal(pe.activeQuery.modality, 'unknown');
assert.equal(pe.activeQuery.priority01, 1);

// A valid snapshot round-trips exactly.
const evidenceSource = new PerceptualEvidenceCompiler();
evidenceSource.recordExternalEvidence({ at: 10, claim: 'sensor:door-open', confidence01: 0.8 });
const evidenceSnapshot = evidenceSource.snapshot();
const evidenceRestored = new PerceptualEvidenceCompiler();
evidenceRestored.restore(evidenceSnapshot);
assert.deepEqual(evidenceRestored.snapshot().evidence, evidenceSnapshot.evidence, 'valid accepted evidence rows must round-trip');
assert.equal(evidenceRestored.snapshot().updates, 1, 'restore derives the update count from accepted rows');
assert.deepEqual(evidenceRestored.snapshot().metrics, defaultPerceptualEvidence().metrics, 'restore resets aggregate metrics without host admission receipts');
assert.notEqual(evidenceRestored.snapshot().lastHash, '', 'restore recomputes the evidence digest after resetting aggregates');

// --- DeviceEvidenceLedger -----------------------------------------------------
const ledger = new DeviceEvidenceLedger();
ledger.restore({ probes: 'x', verifiedProbes: -9, hostProbes: 1.5, lastStatus: 'TOTALLY_VERIFIED', records: [{ bogus: true }, 7] });
const le = ledger.snapshot();
assert.equal(le.probes, 0);
assert.equal(le.verifiedProbes, 0, 'a hostile snapshot must not inflate verified probes');
assert.equal(le.hostProbes, 0);
assert.equal(le.lastStatus, defaultDeviceEvidence().lastStatus, 'unknown status falls back');
assert.equal(le.records.length, 0, 'invalid top-level counters reset the complete ledger snapshot');
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

// Native arrays used by persistence restores must be dense data-only arrays.
// Proxy, sparse and accessor-backed arrays are rejected before filter/slice.
let arrayTrapCalls = 0;
const proxyArray = new Proxy([], {
  getOwnPropertyDescriptor(target, key) { arrayTrapCalls += 1; return Reflect.getOwnPropertyDescriptor(target, key); },
  ownKeys(target) { arrayTrapCalls += 1; return Reflect.ownKeys(target); },
});
const proxyArrayRestore = new MultimodalPerception();
proxyArrayRestore.restore({ ...defaultMultimodalState(), recent: proxyArray });
assert.deepEqual(proxyArrayRestore.snapshot().recent, [], 'Proxy arrays fail closed');
assert.equal(arrayTrapCalls, 0, 'types.isProxy rejects the array before invoking any traps');

let slotGetterCalls = 0;
const accessorArray = [{ id: 'safe' }];
Object.defineProperty(accessorArray, '0', { enumerable: true, configurable: true, get() { slotGetterCalls += 1; return { id: 'injected' }; } });
const accessorArrayRestore = new MultimodalPerception();
accessorArrayRestore.restore({ ...defaultMultimodalState(), recent: accessorArray });
assert.deepEqual(accessorArrayRestore.snapshot().recent, [], 'accessor-backed array slots are rejected');
assert.equal(slotGetterCalls, 0, 'array getter is not invoked');

const sparseArray = new Array(2);
const sparseArrayRestore = new P37EmbodiedSensoriumEngine();
sparseArrayRestore.restore({ ...defaultP37EmbodiedSensorium(), entities: sparseArray });
assert.deepEqual(sparseArrayRestore.snapshot().entities, [], 'sparse persisted arrays fail closed');

const p35ProxyArray = new Proxy([], { getPrototypeOf() { arrayTrapCalls += 1; return Array.prototype; } });
const p35ArrayRestore = new P35SemanticWorldBodyEngine();
p35ArrayRestore.restore({ ...defaultP35SemanticWorldBody(), entities: p35ProxyArray });
assert.deepEqual(p35ArrayRestore.snapshot().entities, [], 'P35 rejects proxy-backed entity arrays');
assert.equal(arrayTrapCalls, 0, 'P35 array proxy traps are not invoked');

let recordProxyTrapCalls = 0;
const proxyRecord = new Proxy({}, { getPrototypeOf() { recordProxyTrapCalls += 1; return Object.prototype; } });
const recordProxyRestore = new P35SemanticWorldBodyEngine();
recordProxyRestore.restore(proxyRecord);
assert.deepEqual(recordProxyRestore.snapshot(), defaultP35SemanticWorldBody(), 'Proxy-backed records fail closed');
assert.equal(recordProxyTrapCalls, 0, 'record Proxy is rejected before reflective traps run');

// Arrays with a custom prototype are not plain persisted arrays: overridden
// methods could otherwise run inside the restore boundary.
let customFilterCalls = 0;
const customArrayPrototype = Object.create(Array.prototype);
Object.defineProperty(customArrayPrototype, 'filter', {
  value() { customFilterCalls += 1; return [{ id: 'injected' }]; },
});
const customPrototypeArray = [{ id: 'persisted' }];
Object.setPrototypeOf(customPrototypeArray, customArrayPrototype);
const customPrototypeRestore = new MultimodalPerception();
customPrototypeRestore.restore({ ...defaultMultimodalState(), recent: customPrototypeArray });
assert.deepEqual(customPrototypeRestore.snapshot().recent, [], 'arrays with custom prototypes fail closed');
assert.equal(customFilterCalls, 0, 'custom array methods are never invoked during restore');

console.log('EMBODIMENT_RESTORE_SANITIZATION_INTEGRITY=PASS');


// The canonical Embodiment owner must restore from the exact shape emitted by
// its own snapshot(), while remaining compatible with older long facet names.
{
  const source = new EmbodimentSubsystemRuntime();
  source.p41SemanticPerception.ingest({
    at: 4_000,
    world: {
      scene: 'round-trip-lab',
      objects: [{
        label: 'door',
        trackId: 'round-trip-door-1',
        confidence01: 0.87,
        evidenceKind: 'model-output',
      }],
    },
  });
  const snapshot = source.snapshot();
  assert.ok(snapshot.p41Semantic.entities.length > 0);
  const restored = new EmbodimentSubsystemRuntime();
  restored.restoreFromPersisted({
    cognition: { perception: snapshot.perception },
    embodiment: snapshot,
    advanced: {},
  });
  const restoredP41 = restored.p41SemanticPerception.snapshot();
  assert.equal(restoredP41.tick, snapshot.p41Semantic.tick);
  assert.equal(restoredP41.scene.label, 'round-trip-lab');
  assert.equal(restoredP41.entities[0]?.trackId, 'world:canonical:round-trip-door-1');

  const legacy = new EmbodimentSubsystemRuntime();
  legacy.restoreFromPersisted({
    cognition: { perception: snapshot.perception },
    embodiment: { p41SemanticPerception: snapshot.p41Semantic },
    advanced: {},
  });
  assert.equal(legacy.p41SemanticPerception.snapshot().entities[0]?.trackId, 'world:canonical:round-trip-door-1');

  let getterInvoked = false;
  const hostileRoot = {};
  Object.defineProperty(hostileRoot, 'embodiment', {
    enumerable: true,
    get() { getterInvoked = true; throw new Error('embodiment restore getter'); },
  });
  assert.doesNotThrow(() => legacy.restoreFromPersisted(hostileRoot));
  assert.equal(getterInvoked, false, 'owner-level persisted input must be checked before property reads');
}

console.log('EMBODIMENT_SNAPSHOT_RESTORE_KEY_PARITY=PASS');


// The composition-root restore is the first entry point for persisted owner
// state. A hostile Proxy must be rejected before any property or reflection trap.
{
  const fabric = new OrganismSystemFabric();
  let proxyTrapInvoked = false;
  const proxy = new Proxy({}, {
    get() { proxyTrapInvoked = true; throw new Error('fabric-persisted-get'); },
    ownKeys() { proxyTrapInvoked = true; throw new Error('fabric-persisted-ownKeys'); },
    getPrototypeOf() { proxyTrapInvoked = true; throw new Error('fabric-persisted-prototype'); },
  });
  assert.doesNotThrow(() => fabric.restoreFromPersisted(proxy));
  assert.equal(proxyTrapInvoked, false, 'composition-root restore must reject a top-level Proxy before reflection');
}
