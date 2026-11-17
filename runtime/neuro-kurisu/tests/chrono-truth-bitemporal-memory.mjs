import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const memoryOS = new MemoryOS2({ signalFusionProfile: 'balanced' });
const encode = (content, extra = {}) => memoryOS.encode({
  content,
  kind: 'semantic',
  source: 'chrono-truth-regression',
  tags: ['project-state'],
  context: { project: 'NK1' },
  salience: .8,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .4,
  socialRelevance: .1,
  predictionError: .2,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: ['NK1'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: 100,
  validUntilAt: null,
  observedAt: 100,
  recordedFromAt: 200,
  recordedUntilAt: null,
  freshnessUntilAt: 125,
  temporalKind: 'fact',
  ...extra,
}, { clone: false });

const first = encode('Project location is East Campus.');
const firstId = first.id;
assert.equal(
  memoryOS.temporalBitemporalAt(firstId, 150, 250)?.content,
  'Project location is East Campus.',
  'the fact must be visible after its valid time and after NK1 recorded it',
);
assert.equal(
  memoryOS.temporalBitemporalAt(firstId, 150, 199),
  null,
  'a fact must not appear in system knowledge before its transaction time',
);
assert.equal(
  memoryOS.temporalBitemporalAt(firstId, 150, 250)?.epistemicStatus,
  'fact',
  'an expired freshness estimate must not silently convert an uncorrected fact into a falsehood',
);

const corrected = memoryOS.reviseContent(firstId, 'Project location is West Campus.', {
  validAt: 120,
  recordedAt: 260,
  reason: 'retroactive-location-correction',
});
assert.ok(corrected, 'a correction must append a new revision');
assert.equal(first.validUntilAt, 120, 'current valid-time interval must close at the world-change time');
assert.equal(first.recordedFromAt, 260, 'the current stored state must begin when the correction was recorded');
assert.equal(first.bitemporalHistory?.length, 1, 'the previous knowledge state must be retained');
assert.equal(first.revisionHistory.at(-1)?.at, 260, 'the revision audit timestamp must use transaction time, not world-valid time');

assert.equal(
  memoryOS.temporalBitemporalAt(firstId, 150, 250)?.content,
  'Project location is East Campus.',
  'before learning the correction, NK1 must still recall its prior belief',
);
assert.equal(
  memoryOS.temporalBitemporalAt(firstId, 110, 270)?.content,
  'Project location is East Campus.',
  'after learning the correction, the earlier world-time interval remains the old fact',
);
assert.equal(
  memoryOS.temporalBitemporalAt(firstId, 150, 270)?.content,
  'Project location is West Campus.',
  'after learning the correction, the new fact must apply from its valid time',
);

const knewThen = memoryOS.previewRetrieve('Project location Campus', 8, 0, 0, {
  temporalMode: 'at',
  asOfAt: 150,
  knowledgeAtAt: 250,
});
assert.equal(knewThen[0]?.id, firstId, 'retrieval must honor the transaction-time axis independently');
const knowsNow = memoryOS.previewRetrieve('Project location Campus', 8, 0, 0, {
  temporalMode: 'at',
  asOfAt: 150,
  knowledgeAtAt: 270,
});
assert.equal(knowsNow[0]?.id, corrected.id, 'retrieval must surface the corrected fact for later knowledge time');

const fabric = new MemoryFabric(
  memoryOS,
  new EventLog(128),
  new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  new P62MemoryFabric(),
  new SemanticMemoryGraph(),
);
const fabricKnewThen = fabric.retrieve('Project location Campus', 8, 0, 0, {
  temporalMode: 'at',
  asOfAt: 150,
  knowledgeAtAt: 250,
});
assert.equal(fabricKnewThen[0]?.id, firstId, 'MemoryFabric operational retrieval must forward knowledge time');
const fabricKnowsNow = fabric.retrieve('Project location Campus', 8, 0, 0, {
  temporalMode: 'at',
  asOfAt: 150,
  knowledgeAtAt: 270,
});
assert.equal(fabricKnowsNow[0]?.id, corrected.id, 'MemoryFabric must select the corrected revision for later knowledge time');

const statusFact = encode('NK1 confidence is currently classified as a fact.');
const originalConfidence = statusFact.confidence;
const lineageKeysBeforeAttachment = statusFact.evidenceLineageKeys?.length ?? 0;
memoryOS.updateSignals(statusFact.id, { confidence: .4 }, 'confidence-calibration');
const confidenceRecordedAt = statusFact.recordedFromAt;
assert.equal(
  memoryOS.temporalBitemporalAt(statusFact.id, 150, confidenceRecordedAt - 1)?.confidence,
  originalConfidence,
  'confidence history must preserve the value NK1 held before calibration',
);
assert.equal(
  memoryOS.temporalBitemporalAt(statusFact.id, 150, confidenceRecordedAt)?.confidence,
  .4,
  'confidence calibration must begin at transaction time',
);
memoryOS.attachEvidenceSource(statusFact.id, {
  source: 'chrono-truth-secondary-audit',
  provenanceClass: 'external',
  sourceAuthority01: .85,
  independenceKey: 'chrono-truth-secondary-audit',
  observedAt: 300,
  evidenceFreshnessAt: 300,
}, 'evidence-lineage');
const evidenceRecordedAt = statusFact.recordedFromAt;
assert.equal(
  memoryOS.temporalBitemporalAt(statusFact.id, 150, evidenceRecordedAt - 1)?.evidenceLineageKeys?.length ?? 0,
  lineageKeysBeforeAttachment,
  'prior knowledge must not contain evidence sources learned later',
);
assert.equal(
  memoryOS.temporalBitemporalAt(statusFact.id, 150, evidenceRecordedAt)?.evidenceLineageKeys?.length,
  lineageKeysBeforeAttachment + 1,
  'new evidence provenance must begin at transaction time',
);
memoryOS.revise(statusFact.id, 'belief', 'status-reconciliation');
const statusRecordedAt = statusFact.recordedFromAt;
assert.equal(
  memoryOS.temporalBitemporalAt(statusFact.id, 150, statusRecordedAt - 1)?.epistemicStatus,
  'fact',
  'status changes must preserve the prior epistemic classification',
);
assert.equal(
  memoryOS.temporalBitemporalAt(statusFact.id, 150, statusRecordedAt)?.epistemicStatus,
  'belief',
  'the new classification must begin at transaction time',
);

const contextFact = encode('NeuroCore runtime workspace is the north campus.', {
  context: { project: 'NeuroCore', campus: 'North' },
  tags: ['initial-context'],
  validFromAt: 300,
  observedAt: 300,
  recordedFromAt: 320,
});
memoryOS.updateContext(contextFact.id, { campus: 'South', environment: 'production' });
const contextRecordedAt = contextFact.recordedFromAt;
assert.equal(
  memoryOS.temporalBitemporalAt(contextFact.id, 350, contextRecordedAt - 1)?.context?.campus,
  'North',
  'historical context must not be overwritten by a later updateContext mutation',
);
assert.equal(
  memoryOS.temporalBitemporalAt(contextFact.id, 350, contextRecordedAt)?.context?.campus,
  'South',
  'the new context must begin at the transaction-time boundary',
);
assert.deepEqual(
  memoryOS.temporalBitemporalAt(contextFact.id, 350, contextRecordedAt - 1)?.tags,
  ['initial-context'],
  'historical tags must be retained with the same knowledge snapshot',
);

const lateLearnedFact = encode('The archive was stored in the east facility.', {
  validFromAt: 500,
  observedAt: 500,
  recordedFromAt: 600,
});
const retroactiveCorrection = memoryOS.reviseContent(
  lateLearnedFact.id,
  'The archive was stored in the west facility.',
  { validAt: 450, recordedAt: 700, reason: 'retroactive-effective-date-before-first-known-date' },
);
assert.equal(
  retroactiveCorrection?.validFromAt,
  450,
  'a correction may become valid before the first recorded valid-time start',
);
assert.equal(
  memoryOS.temporalBitemporalAt(lateLearnedFact.id, 475, 750)?.content,
  'The archive was stored in the west facility.',
  'the corrected fact must cover an earlier world-time period after NK1 learns it',
);
assert.equal(
  memoryOS.temporalBitemporalAt(lateLearnedFact.id, 475, 650),
  null,
  'before the correction was recorded, NK1 must not claim a fact for a period it did not previously know',
);

const restored = new MemoryOS2({ signalFusionProfile: 'balanced' });
restored.restore(memoryOS.snapshot());
assert.equal(
  restored.temporalBitemporalAt(firstId, 150, 250)?.content,
  'Project location is East Campus.',
  'restore must retain the old bitemporal knowledge interval',
);
assert.equal(
  restored.temporalBitemporalAt(firstId, 150, 270)?.content,
  'Project location is West Campus.',
  'restore must retain the current bitemporal knowledge interval',
);

console.log('CHRONOTRUTH_BITEMPORAL_MEMORY=PASS', JSON.stringify({
  originalId: firstId,
  correctedId: corrected.id,
  oldKnowledgeRetained: true,
  validTimeAndKnowledgeTimeIndependent: true,
  restoreRoundTrip: true,
}));
