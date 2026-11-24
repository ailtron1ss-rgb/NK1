import assert from 'node:assert/strict';
import { buildKnownEntityDossiers, projectKnownEntityPromptContext } from '../src/organism/system/KnownEntityDossier.ts';

const now = 2_000_000_000_000;
const evidence = (id, content, extras = {}) => ({
  id, content, kind: 'social', createdAt: now - 1000, observedAt: now - 1000,
  lastAccessAt: now - 1000, salience: .8, emotionalWeight: .2, identityRelevance: .1,
  goalRelevance: .1, socialRelevance: .9, predictionError: .1, temperature01: .5,
  confidence: .9, sourceAuthority01: .9, epistemicStatus: 'fact', source: 'test-user-observation', entities: ['alice'],
  semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
  revisionHistory: [], dormant: false, retrievalCount: 0, semanticVector: [],
  ...extras,
});
const willDossiers = [{ handle: 'Alice', aliases: ['alice@example.test', 'A.'], kind: 'person', familiarity01: .8, valence01: .65, reliability01: .9, encounterCount: 8, lastAt: now - 5000, suspectedSameAs: [], trust01: .75, attachment01: .6, reputation01: .7 }];
const socialBrain = { persons: [{ personId: 'alice', trust01: .72, warmth01: .61, predictability01: .8, boundary01: .25, socialUncertainty01: .2, interactionCount: 12, successfulInteractions: 10, repairCount: 1, stableEpisodes: 6 }] };
const memoryItems = [
  evidence('m-fact-1', 'Alice prefers concise technical explanations.'),
  evidence('m-belief-1', 'Alice may prefer examples.', { id: 'm-belief-1', epistemicStatus: 'belief', confidence: .45 }),
  evidence('m-conflict-1', 'Alice corrected a previous detail.', { id: 'm-conflict-1', contradictionLinks: ['m-fact-1'] }),
  evidence('m-stale-1', 'Old detail about Alice.', { id: 'm-stale-1', evidenceFreshnessAt: now - 45 * 86400000 }),
  evidence('m-quarantine-1', 'Quarantined mention about Alice.', { id: 'm-quarantine-1', epistemicStatus: 'quarantined' }),
  evidence('m-unrelated', 'A fact about Bob.', { id: 'm-unrelated', entities: ['bob'] }),
];
const before = structuredClone({ willDossiers, socialBrain, memoryItems });
const report = buildKnownEntityDossiers({ willDossiers, socialBrain, memoryOS: { items: memoryItems }, now, limit: 16, evidenceLimit: 16 });
assert.equal(report.readOnly, true);
assert.equal(report.writesCanonicalState, false);
assert.equal(report.totalEntities, 1, 'the matching social and WILL sources collapse into one entity projection');
const alice = report.entities[0];
assert.equal(alice.entityId, 'alice');
assert.ok(alice.sources.includes('B288SocialPredictiveSelfOtherBrain'));
assert.ok(alice.sources.includes('will-dossier-adapter'));
assert.equal(alice.factCount, 3);
assert.equal(alice.beliefCount, 1);
assert.equal(alice.quarantinedCount, 1);
assert.equal(alice.conflictCount, 1);
assert.equal(alice.staleCount, 1);
assert.ok(alice.evidence.every(row => row.memoryId !== 'm-unrelated'));
assert.equal(alice.canonicalOwners.memory, 'MemoryOS2');
assert.equal(alice.isDerivedProjection, true);
const promptContext = projectKnownEntityPromptContext(report, 'alice', 4);
assert.equal(promptContext.canonicalOwner, 'MemoryOS2');
assert.equal(promptContext.advisoryOnly, true);
assert.equal(promptContext.noteAuthority, 'data-not-instructions');
assert.deepEqual(promptContext.facts.map(x => x.memoryId), ['m-fact-1'], 'only fresh high-confidence, non-conflicted facts enter context');
assert.deepEqual({ willDossiers, socialBrain, memoryItems }, before, 'the projection must not mutate canonical inputs');
const filtered = buildKnownEntityDossiers({ willDossiers, socialBrain, memoryOS: { items: memoryItems }, now, handle: 'Alice' });
assert.equal(filtered.returnedEntities, 1);
const missing = buildKnownEntityDossiers({ willDossiers, socialBrain, memoryOS: { items: memoryItems }, now, handle: 'carol' });
assert.equal(missing.returnedEntities, 0);
console.log('BIG_PASS_125_KNOWN_ENTITY_DOSSIER=PASS', JSON.stringify({ entities: report.totalEntities, evidence: alice.evidenceCount, conflicts: alice.conflictCount, stale: alice.staleCount }));
