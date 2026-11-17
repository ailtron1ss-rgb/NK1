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

const provenanceFact = encode('The active deployment strategy is blue-green.', {
  source: 'chrono-truth-user-source',
  provenanceClass: 'user',
  sourceAuthority01: .94,
  independenceKey: 'chrono-truth-user-source',
  validFromAt: 250,
  observedAt: 250,
  recordedFromAt: 260,
});
memoryOS.attachEvidenceSource(provenanceFact.id, {
  source: 'chrono-truth-signed-audit',
  provenanceClass: 'external',
  sourceAuthority01: .98,
  independenceKey: 'chrono-truth-signed-audit',
  observedAt: 270,
  evidenceFreshnessAt: 270,
}, 'signed-independent-audit');
const provenanceCorrection = memoryOS.reviseContent(
  provenanceFact.id,
  'The active deployment strategy is canary.',
  { validAt: 250, recordedAt: 280, reason: 'deployment-strategy-correction' },
);
assert.ok(provenanceCorrection, 'a provenance-bearing fact must accept a content correction');
assert.deepEqual(
  new Set((provenanceCorrection.evidenceSources ?? []).map(row => row.independenceKey)),
  new Set(['chrono-truth-user-source', 'chrono-truth-signed-audit']),
  'a content revision must carry every independently attributed evidence source forward',
);
assert.ok(
  provenanceCorrection.evidenceLineageKeys?.includes('lineage:chrono-truth-signed-audit'),
  'a content revision must preserve compact evidence lineage keys',
);
assert.equal(
  provenanceCorrection.provenanceClass,
  'user',
  'a content correction must retain its primary provenance class',
);
const provenanceCorrectionRecordedAt = provenanceCorrection.recordedFromAt;
assert.equal(
  memoryOS.temporalBitemporalAt(provenanceFact.id, 260, provenanceCorrectionRecordedAt - 1)?.evidenceSources?.length,
  2,
  'the previous content must remain associated with the complete evidence set NK1 knew then',
);
assert.equal(
  memoryOS.temporalBitemporalAt(provenanceFact.id, 260, provenanceCorrectionRecordedAt)?.evidenceSources?.length,
  2,
  'the corrected content must retain the same evidence set after the correction',
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
const contextHistory = memoryOS.temporalBitemporalHistory(contextFact.id);
assert.ok(contextHistory.some(row => row.context?.campus === 'North'), 'full history must expose the old context version');
assert.ok(contextHistory.some(row => row.context?.campus === 'South'), 'full history must expose the new context version');
assert.equal(
  memoryOS.temporalBitemporalDiff(contextFact.id, 350, contextRecordedAt - 1, contextRecordedAt).changed,
  true,
  'bitemporal diff must detect context-only changes',
);

const historicalMetadataOS = new MemoryOS2({ signalFusionProfile: 'balanced', metadataRecallEnabled: true });
const metadataFact = historicalMetadataOS.encode({
  content: 'The active workspace has an assigned physical site.',
  kind: 'semantic',
  source: 'chrono-truth-metadata-regression',
  tags: ['workspace'],
  context: { location: 'North Campus', project: 'NeuroCore' },
  salience: .8,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .1,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: ['NeuroCore'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: 300,
  observedAt: 300,
  recordedFromAt: 320,
}, { clone: false });
const historicalMetadataFabric = new MemoryFabric(
  historicalMetadataOS,
  new EventLog(128),
  new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  new P62MemoryFabric(),
  new SemanticMemoryGraph(),
);
const beforeContextKnowledgeAt = metadataFact.recordedFromAt;
historicalMetadataOS.updateContext(metadataFact.id, { location: 'South Campus' });
const afterContextKnowledgeAt = metadataFact.recordedFromAt;
const oldMetadataRecall = historicalMetadataFabric.retrieve('North Campus', 8, 0, 0, {
  temporalMode: 'at', asOfAt: 350, knowledgeAtAt: beforeContextKnowledgeAt,
});
assert.equal(
  oldMetadataRecall[0]?.context?.location,
  'North Campus',
  'retrieval must rank and return the metadata that existed at the requested knowledge-time',
);
const newMetadataRecall = historicalMetadataFabric.retrieve('South Campus', 8, 0, 0, {
  temporalMode: 'at', asOfAt: 350, knowledgeAtAt: afterContextKnowledgeAt,
});
assert.equal(
  newMetadataRecall[0]?.context?.location,
  'South Campus',
  'retrieval must use updated metadata after the transaction-time boundary',
);
assert.equal(
  historicalMetadataFabric.retrieve('South Campus', 8, 0, 0, {
    temporalMode: 'at', asOfAt: 350, knowledgeAtAt: beforeContextKnowledgeAt,
  }).length,
  0,
  'future metadata must not leak into earlier knowledge-time retrieval',
);
const cognitiveOldMetadata = await historicalMetadataFabric.retrieveForCognition('North Campus', 8, 0, 0, {
  temporalMode: 'at',
  asOfAt: 350,
  knowledgeAtAt: beforeContextKnowledgeAt,
});
assert.equal(
  cognitiveOldMetadata[0]?.context?.location,
  'North Campus',
  'the preview-then-commit cognitive path must return the same historical metadata view',
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

const boundedHistoryOS = new MemoryOS2({ signalFusionProfile: 'balanced' });
const boundedFact = boundedHistoryOS.encode({
  content: 'The long-lived workspace location changes over time.',
  kind: 'semantic',
  source: 'chrono-truth-history-bound-regression',
  tags: ['workspace'],
  context: { location: 'Site 0' },
  salience: .7,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .1,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: ['workspace'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: 800,
  observedAt: 800,
  recordedFromAt: 820,
}, { clone: false });
for (let i = 1; i <= 40; i++) {
  boundedHistoryOS.updateContext(boundedFact.id, { location: `Site ${i}` });
}
assert.equal(
  boundedFact.bitemporalHistory?.length,
  32,
  'per-item bitemporal history must stay within its hard retention bound',
);
const corruptBitemporalSnapshot = boundedHistoryOS.snapshot();
const corruptBitemporalRow = corruptBitemporalSnapshot.items.find(row => row.id === boundedFact.id);
assert.ok(corruptBitemporalRow, 'snapshot must contain the bounded temporal fact');
corruptBitemporalRow.bitemporalHistory.push({
  validFromAt: 'not-a-time',
  validUntilAt: null,
  recordedFromAt: 999999,
  recordedUntilAt: null,
  confidence: 1,
  epistemicStatus: 'fact',
  source: 'corrupted-import',
  temporalKind: 'fact',
});
const hardenedRestore = new MemoryOS2({ signalFusionProfile: 'balanced' });
hardenedRestore.restore(corruptBitemporalSnapshot);
const hardenedFact = hardenedRestore.get(boundedFact.id);
assert.ok(
  hardenedFact.bitemporalHistory.length <= 32 &&
  hardenedFact.bitemporalHistory.every(row =>
    Number.isFinite(row.validFromAt) && Number.isFinite(row.recordedFromAt)
  ),
  'restore must drop malformed intervals and keep the temporal retention bound',
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
assert.equal(
  restored.temporalBitemporalAt(contextFact.id, 350, contextRecordedAt - 1)?.context?.campus,
  'North',
  'restore must retain the previous context metadata snapshot',
);
assert.equal(
  restored.temporalBitemporalAt(contextFact.id, 350, contextRecordedAt)?.context?.campus,
  'South',
  'restore must retain the updated context metadata snapshot',
);
assert.equal(
  restored.temporalBitemporalAt(lateLearnedFact.id, 475, 750)?.content,
  'The archive was stored in the west facility.',
  'restore must preserve retroactive valid-time corrections',
);

console.log('CHRONOTRUTH_BITEMPORAL_MEMORY=PASS', JSON.stringify({
  originalId: firstId,
  correctedId: corrected.id,
  oldKnowledgeRetained: true,
  validTimeAndKnowledgeTimeIndependent: true,
  restoreRoundTrip: true,
}));

// Keep bounded-history and hostile-restore cases in the exact-head regression gate.
