import assert from 'node:assert/strict';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const gateway = new ActionGateway();
const declaredSources = [
  { sourceId: 'camera-front', sourceClass: 'device', channel: 'camera', independenceKey: 'camera:front' },
  { sourceId: 'camera-side-low-confidence', sourceClass: 'device', channel: 'camera', independenceKey: 'camera:side-low' },
  { sourceId: 'camera-side', sourceClass: 'device', channel: 'camera', independenceKey: 'camera:side' },
  { sourceId: 'user-report', sourceClass: 'user', channel: 'user', independenceKey: 'user:session-1' },
];
for (const source of declaredSources) {
  gateway.registerTool({
    id: `observer.${source.sourceId}`,
    capability: 'test.observer',
    destructive: false,
    observationSource: source,
    execute: async () => ({ ok: true }),
  });
}
const authorizeSourceRegistration = source => gateway.isDeclaredObservationSource({
  sourceId: source.id, sourceClass: source.sourceClass, channel: source.channel, independenceKey: source.independenceKey,
});
const runtime = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
const evidenceEventId = `outcome:${'a'.repeat(40)}`;
const input = {
  sourceId: 'camera-front',
  sourceClass: 'device',
  channel: 'camera',
  claimKey: 'scene:freshness',
  observedPostcondition: 'fresh scene observed',
  confidence01: 0.98,
  observedAt: 1000,
  actionRef: 'exec-abcdefgh',
  tool: 'organism.device.read',
  tick: 11,
  independenceKey: 'camera:front',
  evidenceEventId,
  payload: { observationId: 'obs-1', scene: 'fresh' },
};

// Canonical evidence ingestion accepts observations only after explicit source registration.
for (const source of declaredSources.slice(0, 3)) runtime.externalObserver.registerSource({
  id: source.sourceId, sourceClass: source.sourceClass, channel: source.channel, independenceKey: source.independenceKey,
});

const observation = runtime.externalObserver.observe(input);
let ledger = runtime.realityEvidenceLedger.snapshot();
assert.equal(ledger.total, 1, 'production subsystem owner must forward an observer event into the canonical reality ledger');
assert.equal(ledger.recent[0].eventId, evidenceEventId, 'verifier identity must survive the observer-to-ledger bridge');
assert.equal(ledger.recent[0].realityClass, 'device-observation', 'device observations must retain their evidence class');

const replay = runtime.externalObserver.observe(input);
assert.equal(replay.id, observation.id, 'observer retry must remain idempotent');
assert.equal(runtime.realityEvidenceLedger.snapshot().total, 1, 'observer retry must not inflate ledger evidence count');

const userRuntime = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
userRuntime.externalObserver.registerSource({id:'user-report',sourceClass:'user',channel:'user',independenceKey:'user:session-1'});
userRuntime.externalObserver.observe({
  sourceId: 'user-report',
  sourceClass: 'user',
  channel: 'user',
  claimKey: 'reported:scene',
  observedPostcondition: 'the scene looked fresh',
  confidence01: 1,
  observedAt: 2000,
  independenceKey: 'user:session-1',
  payload: { report: 'fresh' },
});
const userEvidence = userRuntime.realityEvidenceLedger.snapshot();
assert.equal(userEvidence.total, 1, 'user reports may be retained as context');
assert.equal(userEvidence.externalCount, 0, 'user reports must not be promoted as external confirmation');

// A single external source grounds a claim but must not satisfy the stronger
// independent-corroboration threshold used for consequential promotion.
const oneSourceAssessment = runtime.realityEvidenceLedger.claimAssessment('fresh scene observed');
assert.equal(oneSourceAssessment.promotionAllowed, true, 'one reliable external source may ground a claim');
assert.equal(oneSourceAssessment.independentPromotionAllowed, false, 'one source must not satisfy independent corroboration');
assert.equal(oneSourceAssessment.promotionReason, 'awaiting-second-independent-external-source');

runtime.externalObserver.observe({
  ...input,
  sourceId: 'camera-side-low-confidence',
  independenceKey: 'camera:side-low',
  confidence01: 0.20,
  evidenceEventId: `outcome:${'b'.repeat(40)}`,
  payload: { observationId: 'obs-2', scene: 'fresh' },
});
const mixedConfidence = runtime.realityEvidenceLedger.claimAssessment('fresh scene observed');
assert.equal(mixedConfidence.independentExternalSources, 2, 'distinct source keys must be counted separately');
assert.equal(mixedConfidence.qualifiedIndependentExternalSources, 1, 'low-confidence source must not qualify as corroboration');
assert.equal(mixedConfidence.independentPromotionAllowed, false, 'one high-confidence source plus one weak source must not pass');

runtime.externalObserver.observe({
  ...input,
  sourceId: 'camera-side',
  independenceKey: 'camera:side',
  evidenceEventId: `outcome:${'c'.repeat(40)}`,
  payload: { observationId: 'obs-3', scene: 'fresh' },
});
const corroborated = runtime.realityEvidenceLedger.claimAssessment('fresh scene observed');
assert.equal(corroborated.independentExternalSources, 3, 'all distinct source keys remain visible in assessment');
assert.equal(corroborated.qualifiedIndependentExternalSources, 2, 'both strong sources meet the confidence floor');
assert.equal(corroborated.independentPromotionAllowed, true, 'two high-confidence independent sources may satisfy corroboration');

const persisted = runtime.snapshot();
const restored = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
restored.restore(persisted);
const restoredLedger = restored.realityEvidenceLedger.snapshot();
assert.equal(restoredLedger.total, 3, 'restore must retain all three distinct evidence events without duplicate rows');
assert.deepEqual(
  new Set(restoredLedger.recent.map(row => row.eventId)),
  new Set([evidenceEventId, `outcome:${'b'.repeat(40)}`, `outcome:${'c'.repeat(40)}`]),
  'restore must preserve every verifier event identity across observer-ledger reconciliation',
);
console.log('WORKPASS521_OBSERVER_LEDGER_BRIDGE=PASS liveBridge=true idempotentReplay=true userReportNotExternal=true restoreReconciliation=true');
