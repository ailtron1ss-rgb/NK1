import assert from 'node:assert/strict';
import { MultimodalPerception, defaultMultimodalState } from '../src/organism/body/MultimodalPerception.ts';
import { MultimodalSituationModel, defaultMultimodalSituation } from '../src/organism/body/MultimodalSituationModel.ts';
import { PerceptualEvidenceCompiler, defaultPerceptualEvidence } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';
import { EmbodimentSubsystemRuntime } from '../src/organism/core/EmbodimentSubsystemRuntime.ts';

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

console.log('EMBODIMENT_RESTORE_SANITIZATION_INTEGRITY=PASS');
