import assert from 'node:assert/strict';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';
import { PerceptualEvidenceCompiler, defaultPerceptualEvidence } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { P37EmbodiedSensoriumEngine, defaultP37EmbodiedSensorium } from '../src/organism/body/P37EmbodiedSensorium.ts';

/**
 * WorkPass72 — device evidence / perceptual evidence / embodied sensorium
 * restore integrity. Each owner merged a persisted snapshot with a bare spread
 * (or nested spreads), letting NaN reach success rates, grounding metrics,
 * sensor health and body coherence.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- DeviceEvidenceLedger ---------------------------------------------------
{
  const l = new DeviceEvidenceLedger();
  l.restore({ version: 1, probes: -1, verifiedProbes: NaN, hostProbes: -1, unavailableProbes: NaN, lastStatus: 'bogus', records: [{ id: 'r1', at: -1, status: 'bogus', capabilityDigest: 5, telemetryFresh: 'yes', commandSuccessRate01: 9, source: 5 }, { at: 1 }] });
  const st = l.snapshot();
  assert.equal(st.probes, 0, 'device negative probes -> 0');
  assert.equal(st.verifiedProbes, 0, 'device NaN verified -> 0');
  assert.equal(st.hostProbes, 0, 'device negative host -> 0');
  assert.equal(st.unavailableProbes, 0, 'device NaN unavailable -> 0');
  assert.equal(st.lastStatus, 'UNAVAILABLE', 'device unknown status -> UNAVAILABLE');
  assert.equal(st.records.length, 1, 'device drops record without id');
  assert.equal(st.records[0].status, 'UNAVAILABLE', 'device record unknown status -> UNAVAILABLE');
  assert.equal(st.records[0].at, 0, 'device negative at -> 0');
  assert.equal(st.records[0].capabilityDigest, '', 'device non-string digest -> empty');
  assert.equal(st.records[0].telemetryFresh, false, 'device non-boolean fresh -> false');
  assert.equal(st.records[0].commandSuccessRate01, 1, 'device over-1 rate -> 1');
  assert.equal(st.records[0].source, '', 'device non-string source -> empty');
  assert.doesNotThrow(() => l.restore(hostile('records')));
  const d = defaultDeviceEvidence();
  l.restore(d);
  assert.deepEqual(l.snapshot(), d, 'device default round-trips');
}

// --- PerceptualEvidenceCompiler ---------------------------------------------
{
  const c = new PerceptualEvidenceCompiler();
  c.restore({ version: 1, updates: -1, lastAt: -1, scene: 5, evidence: [{ id: 'e1', at: -1, modality: 'bogus', claim: 5, confidence01: 9, uncertainty01: -1, kind: 'bogus', parents: ['p', 5] }, { at: 1 }], activeQuery: { id: 'q1', modality: 5, query: 5, priority01: 9, expectedInformationGain01: -1, estimatedCost01: NaN }, metrics: { grounding01: 9, conflict01: -1, bogus: 5 }, lastHash: 5 });
  const st = c.snapshot();
  assert.equal(st.updates, 0, 'pe negative updates -> 0');
  assert.equal(st.lastAt, 0, 'pe negative lastAt -> 0');
  assert.equal(st.scene, 'unknown', 'pe non-string scene -> default');
  assert.equal(st.evidence.length, 1, 'pe drops record without id');
  assert.equal(st.evidence[0].modality, 'fusion', 'pe unknown modality -> fusion');
  assert.equal(st.evidence[0].kind, 'unresolved', 'pe unknown kind -> unresolved');
  assert.equal(st.evidence[0].confidence01, 1, 'pe over-1 confidence -> 1');
  assert.equal(st.evidence[0].uncertainty01, 0, 'pe negative uncertainty -> 0');
  assert.deepEqual(st.evidence[0].parents, ['p'], 'pe drops non-string parents');
  assert.equal(st.activeQuery.id, 'q1', 'pe keeps query with id');
  assert.equal(st.activeQuery.priority01, 1, 'pe over-1 query priority -> 1');
  assert.equal(st.activeQuery.expectedInformationGain01, 0, 'pe negative gain -> 0');
  assert.equal(st.activeQuery.estimatedCost01, 0, 'pe NaN cost -> 0');
  assert.equal(st.metrics.grounding01, 1, 'pe over-1 grounding -> 1');
  assert.equal(st.metrics.conflict01, 0, 'pe negative conflict -> 0');
  assert.ok(!('bogus' in st.metrics), 'pe drops unknown metric key');
  assert.equal(st.lastHash, '', 'pe non-string hash -> empty');
  assert.doesNotThrow(() => c.restore(hostile('evidence')));
  const d = defaultPerceptualEvidence();
  c.restore(d);
  assert.deepEqual(c.snapshot(), d, 'pe default round-trips');
}

// --- P37EmbodiedSensoriumEngine ---------------------------------------------
{
  const e = new P37EmbodiedSensoriumEngine();
  e.restore({ version: 1, tick: -1, scene: { label: 5, confidence01: 9, stability01: -1, at: -1 }, claims: [{ id: 'c1', modality: 'bogus', label: 5, kind: 'bogus', confidence01: 9, salience01: -1, at: -1, source: 'bogus' }, { label: 'x' }], entities: [{ id: 'en1', label: 5, kind: 'bogus', confidence01: 9, salience01: -1, firstSeenAt: -1, lastSeenAt: -1, seenCount: 0, present01: 9, x: NaN, y: null, z: -1, modalities: ['text', 'bogus'], presenceStatus: 'bogus', persistence01: 9, absenceEvidence01: -1 }, {}], events: [{ id: 'ev1', label: 5, confidence01: 9, at: -1, persistence01: -1, sources: ['audio', 'bogus'] }, {}], relationEdges: [{ from: 'a', relation: 5, to: 'b', confidence01: 9, at: -1 }, { from: 'a' }], spatialSelf: { location: 5, x: NaN, y: -1, z: 9, orientationDeg: NaN, confidence01: 9, at: -1 }, body: { energy01: 9, thermal01: -1, capacity01: NaN, awake: 'yes', motion01: 9, sensoryFreshness01: -1, at: -1 }, sensors: { text: { reliability01: 9, freshness01: -1, conflict01: NaN, samples: -1 }, bogus: { reliability01: 1 } }, activePerception: [{ modality: 'bogus', reason: 5, expectedInformationGain01: 9, estimatedCost01: -1, priority01: NaN, createdAt: -1 }], affordance: { respond: 9, explore: -1, bogus: 5 }, semanticMemoryBudget01: 9, worldTransitionError01: -1, crossModalAgreement01: NaN, objectPermanence01: 9, selfLocationConfidence01: -1, bodyWorldCoherence01: NaN, episodeKey: 5, episodeBoundary01: 9, crossModalEntityBinding01: -1, lastHash: 5 });
  const st = e.snapshot();
  assert.equal(st.tick, 0, 'p37 negative tick -> 0');
  assert.equal(st.scene.label, 'unknown', 'p37 non-string scene label -> default');
  assert.equal(st.scene.confidence01, 1, 'p37 over-1 scene confidence -> 1');
  assert.equal(st.scene.stability01, 0, 'p37 negative stability -> 0');
  assert.equal(st.claims.length, 1, 'p37 drops claim without id');
  assert.equal(st.claims[0].modality, 'world', 'p37 unknown claim modality -> world');
  assert.equal(st.claims[0].kind, 'unknown', 'p37 unknown claim kind -> unknown');
  assert.equal(st.claims[0].confidence01, 1, 'p37 over-1 claim confidence -> 1');
  assert.equal(st.claims[0].source, 'structured', 'p37 unknown claim source -> structured');
  assert.equal(st.entities.length, 1, 'p37 drops entity without id');
  assert.equal(st.entities[0].seenCount, 1, 'p37 seenCount floored to 1');
  assert.equal(st.entities[0].present01, 1, 'p37 over-1 present -> 1');
  assert.equal(st.entities[0].x, 0, 'p37 NaN x -> 0');
  assert.equal(st.entities[0].y, null, 'p37 null y preserved');
  assert.deepEqual(st.entities[0].modalities, ['text'], 'p37 drops unknown entity modality');
  assert.equal(st.entities[0].presenceStatus, 'unknown', 'p37 unknown presence -> unknown');
  assert.equal(st.events.length, 1, 'p37 drops event without id');
  assert.deepEqual(st.events[0].sources, ['audio'], 'p37 drops unknown event source');
  assert.equal(st.relationEdges.length, 1, 'p37 drops edge missing endpoint');
  assert.equal(st.relationEdges[0].confidence01, 1, 'p37 over-1 edge confidence -> 1');
  assert.equal(st.spatialSelf.x, 0, 'p37 NaN spatial x -> 0');
  assert.equal(st.spatialSelf.z, 9, 'p37 preserves finite spatial z (raw coordinate)');
  assert.equal(st.body.energy01, 1, 'p37 over-1 energy -> 1');
  assert.equal(st.body.thermal01, 0, 'p37 negative thermal -> 0');
  assert.equal(st.body.capacity01, .84, 'p37 NaN capacity -> default');
  assert.equal(st.body.awake, false, 'p37 non-boolean awake -> false');
  assert.equal(st.sensors.text.reliability01, 1, 'p37 over-1 sensor reliability -> 1');
  assert.equal(st.sensors.text.freshness01, 0, 'p37 negative sensor freshness -> 0');
  assert.equal(st.sensors.text.conflict01, 0, 'p37 NaN sensor conflict -> 0');
  assert.equal(st.sensors.text.samples, 0, 'p37 negative samples -> 0');
  assert.equal(st.sensors.vision.reliability01, .35, 'p37 keeps untouched sensor default');
  assert.equal(st.activePerception.length, 1, 'p37 keeps active request');
  assert.equal(st.activePerception[0].modality, 'world', 'p37 unknown active modality -> world');
  assert.equal(st.activePerception[0].priority01, 0, 'p37 NaN priority -> 0');
  assert.equal(st.affordance.respond, 1, 'p37 over-1 affordance -> 1');
  assert.equal(st.affordance.explore, 0, 'p37 negative affordance -> 0');
  assert.ok(!('bogus' in st.affordance), 'p37 drops unknown affordance key');
  assert.equal(st.semanticMemoryBudget01, 1, 'p37 over-1 budget -> 1');
  assert.equal(st.worldTransitionError01, 0, 'p37 negative transition error -> 0');
  assert.equal(st.crossModalAgreement01, .5, 'p37 NaN agreement -> default');
  assert.equal(st.episodeKey, 'episode:unknown', 'p37 non-string episodeKey -> default');
  assert.equal(st.episodeBoundary01, 1, 'p37 over-1 episode boundary -> 1');
  assert.equal(st.lastHash, '', 'p37 non-string hash -> empty');
  assert.doesNotThrow(() => e.restore(hostile('claims')));
  const d = defaultP37EmbodiedSensorium();
  e.restore(d);
  assert.deepEqual(e.snapshot(), d, 'p37 default round-trips');
}

console.log('WORKPASS72_DEVICE_PERCEPTUAL_EVIDENCE_EMBODIED_SENSORIUM_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['DeviceEvidenceLedger', 'PerceptualEvidenceCompiler', 'P37EmbodiedSensoriumEngine'] }));
