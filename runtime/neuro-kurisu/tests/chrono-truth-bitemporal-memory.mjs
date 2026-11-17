import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

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

const corrected = memoryOS.reviseContent(firstId, 'Project location is West Campus.', {
  validAt: 120,
  recordedAt: 260,
  reason: 'retroactive-location-correction',
});
assert.ok(corrected, 'a correction must append a new revision');
assert.equal(first.validUntilAt, 120, 'current valid-time interval must close at the world-change time');
assert.equal(first.recordedFromAt, 260, 'the current stored state must begin when the correction was recorded');
assert.equal(first.bitemporalHistory?.length, 1, 'the previous knowledge state must be retained');

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
