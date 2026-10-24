import assert from 'node:assert/strict';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const fabric = new ExternalObserverFabric();
const registered = fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'device',
  channel: 'sensor',
  independenceKey: 'physical-sensor-bank-a',
  reliability01: 0.9,
});
assert.equal(registered.independenceKey, 'physical-sensor-bank-a');

// Re-registering a known source may update operational trust settings, but
// must never let the same source ID claim a different independence group.
assert.throws(() => fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'device',
  channel: 'sensor',
  independenceKey: 'pretend-independent-source',
}), /external-observer-source-identity-conflict/);

assert.throws(() => fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'external-api',
  channel: 'http',
  independenceKey: 'physical-sensor-bank-a',
}), /external-observer-source-identity-conflict/);

 // Observation ingress must reject caller labels that disagree with the registry,
 // rather than silently accepting a mislabeled observation under a trusted ID.
assert.throws(() => fabric.observe({
  sourceId: 'device-primary',
  sourceClass: 'external-api',
  channel: 'http',
  independenceKey: 'pretend-independent-source',
  claimKey: 'door=open',
  observedPostcondition: 'door=open',
  confidence01: 0.99,
}), /external-observer-source-identity-conflict/);
assert.equal(fabric.snapshot().observations.length, 0);

const afterRejectedChanges = fabric.snapshot().sources.find(source => source.id === 'device-primary');
assert.equal(afterRejectedChanges.sourceClass, 'device');
assert.equal(afterRejectedChanges.channel, 'sensor');
assert.equal(afterRejectedChanges.independenceKey, 'physical-sensor-bank-a');

// Legitimate reliability/enablement updates remain possible when identity is stable.
const updated = fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'device',
  channel: 'sensor',
  independenceKey: 'physical-sensor-bank-a',
  reliability01: 0.7,
});
assert.equal(updated.reliability01, 0.7);
assert.equal(updated.independenceKey, 'physical-sensor-bank-a');

// A caller's confidence in one sample must not mint a permanently high-trust source.
const autoRegistered = new ExternalObserverFabric();
autoRegistered.observe({
  sourceId: 'api-untrusted',
  sourceClass: 'external-api',
  channel: 'http',
  claimKey: 'status=ready',
  observedPostcondition: 'status=ready',
  confidence01: 0.99,
});
const mintedSource = autoRegistered.snapshot().sources.find(source => source.id === 'api-untrusted');
assert.equal(mintedSource.reliability01, 0.84, 'new external-api sources must start from the conservative class prior');
assert.equal(autoRegistered.snapshot().observations[0].confidence01, 0.99, 'sample confidence remains separate evidence');

// Source registry exhaustion must not evict established identities or accept new evidence.
const bounded = new ExternalObserverFabric({ maxSources: 16 });
for (let i = 0; i < 16; i += 1) {
  bounded.registerSource({
    id: `capacity-${String(i).padStart(2, '0')}`,
    sourceClass: 'unknown',
    channel: 'unknown',
    independenceKey: `group-${i}`,
  });
}
assert.equal(bounded.snapshot().sources.length, 16);
assert.throws(() => bounded.observe({
  sourceId: 'capacity-new',
  sourceClass: 'unknown',
  channel: 'unknown',
  claimKey: 'attacker=claim',
  observedPostcondition: 'attacker=claim',
}), /observer-source-registry-capacity-exceeded/);
assert.equal(bounded.snapshot().sources.length, 16, 'registry must not silently evict a registered source');
assert.ok(bounded.snapshot().sources.some(source => source.id === 'capacity-00'), 'oldest source identity must remain intact');
assert.equal(bounded.snapshot().observations.length, 0, 'evidence from the rejected identity must not persist');
const existingAtCapacity = bounded.registerSource({
  id: 'capacity-00',
  sourceClass: 'unknown',
  channel: 'unknown',
  independenceKey: 'group-0',
  reliability01: 0.51,
});
assert.equal(existingAtCapacity.reliability01, 0.51, 'known source calibration remains writable at capacity');
assert.equal(bounded.snapshot().sources.length, 16, 'updating a known identity must not grow or shrink the registry');

// The production evidence sink must not let a first observation mint a source identity.
const authorityGateway = new ActionGateway();
const allowedCameraSource = {
  sourceId: 'registered-camera',
  sourceClass: 'device',
  channel: 'camera',
  independenceKey: 'camera:front',
};
authorityGateway.registerTool({
  id: 'camera.front.read',
  capability: 'device.camera.read',
  destructive: false,
  observationSource: allowedCameraSource,
  execute: async () => ({ ok: true }),
});
const authorizeSourceRegistration = source => authorityGateway.isDeclaredObservationSource({
  sourceId: source.id, sourceClass: source.sourceClass, channel: source.channel, independenceKey: source.independenceKey,
});
const guardedRuntime = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
assert.throws(() => guardedRuntime.externalObserver.observe({
  sourceId: 'unregistered-camera',
  sourceClass: 'device',
  channel: 'camera',
  independenceKey: 'camera:unregistered',
  claimKey: 'scene=fresh',
  observedPostcondition: 'scene=fresh',
  confidence01: 0.99,
}), /external-observer-source-not-registered/);
assert.equal(guardedRuntime.externalObserver.snapshot().observations.length, 0, 'rejected ingress must not persist an observation');
assert.equal(guardedRuntime.realityEvidenceLedger.snapshot().total, 0, 'rejected ingress must not reach the canonical evidence ledger');

assert.throws(() => guardedRuntime.externalObserver.registerSource({
  id: 'made-up-camera',
  sourceClass: 'device',
  channel: 'camera',
  independenceKey: 'camera:spoofed',
  reliability01: 1,
}), /external-observer-source-registration-not-authorized/);
const registeredSource = guardedRuntime.externalObserver.registerSource({
  id: 'registered-camera',
  sourceClass: 'device',
  channel: 'camera',
  independenceKey: 'camera:front',
  reliability01: 0.99,
  enabled: false,
});
assert.equal(registeredSource.reliability01, 0.8, 'strict registration must use the conservative source-class prior');
assert.equal(registeredSource.enabled, true, 'strict registration must not accept caller-controlled enablement');
const admittedObservation = guardedRuntime.externalObserver.observe({
  sourceId: 'registered-camera',
  sourceClass: 'device',
  channel: 'camera',
  independenceKey: 'camera:front',
  claimKey: 'scene=fresh',
  observedPostcondition: 'scene=fresh',
  confidence01: 0.99,
});
assert.equal(admittedObservation.sourceId, 'registered-camera');
assert.equal(guardedRuntime.realityEvidenceLedger.snapshot().total, 1, 'registered source observation must still reach the canonical ledger');

// Restore reconciliation must not launder an orphan observation into the canonical ledger.
const cleanLedger = new EvidenceResearchSubsystemRuntime().realityEvidenceLedger.snapshot();
const orphanSnapshot = structuredClone(guardedRuntime.snapshot());
orphanSnapshot.externalObserver.sources = [];
// Deliberately retain the previously persisted ledger event: strict observer
// restore must revoke its active evidence when the trusted source disappears.
const orphanRestore = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
orphanRestore.restore(orphanSnapshot);
assert.equal(orphanRestore.realityEvidenceLedger.snapshot().externalCount, 0,
  'orphan observer events already present in the ledger must lose external-confirmation authority');
assert.equal(orphanRestore.realityEvidenceLedger.snapshot().recent.length, 0,
  'orphan observer events must be removed from the active evidence window');
assert.equal(orphanRestore.externalObserver.snapshot().observations.length, 0, 'orphan rows must be removed from strict observer state, not just hidden from the ledger');

const mismatchedSnapshot = structuredClone(guardedRuntime.snapshot());
mismatchedSnapshot.externalObserver.sources[0].sourceClass = 'user';
mismatchedSnapshot.externalObserver.sources[0].channel = 'user';
mismatchedSnapshot.externalObserver.sources[0].independenceKey = 'user:forged';
// Keep the old ledger row to ensure a forged source identity cannot leave a stale
// external record behind after the matching observer row is rejected.
const mismatchedRestore = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
mismatchedRestore.restore(mismatchedSnapshot);
assert.equal(mismatchedRestore.realityEvidenceLedger.snapshot().externalCount, 0, 'restored rows cannot override the registered source class/channel');
assert.equal(mismatchedRestore.realityEvidenceLedger.snapshot().recent.length, 0, 'rejected observer evidence must not remain active in the canonical ledger');
assert.equal(mismatchedRestore.externalObserver.snapshot().observations.length, 0, 'identity-mismatched rows must not remain in internal consensus calculations');

const disabledSnapshot = structuredClone(guardedRuntime.snapshot());
disabledSnapshot.externalObserver.sources[0].enabled = false;
const disabledRestore = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
disabledRestore.restore(disabledSnapshot);
assert.equal(disabledRestore.realityEvidenceLedger.snapshot().externalCount, 0,
  'previous evidence from a disabled observer source must not keep external-confirmation authority');
assert.equal(disabledRestore.realityEvidenceLedger.snapshot().recent.length, 0,
  'disabled observer evidence must be removed from the active ledger projection');

const legacySnapshot = structuredClone(guardedRuntime.snapshot());
delete legacySnapshot.externalObserver.observations[0].independenceKey;
legacySnapshot.realityEvidenceLedger = cleanLedger;
const legacyRestore = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
legacyRestore.restore(legacySnapshot);
const legacyLedgerRow = legacyRestore.realityEvidenceLedger.snapshot().recent[0];
assert.equal(legacyRestore.realityEvidenceLedger.snapshot().total, 1, 'legacy rows with a known source remain recoverable');
assert.equal(legacyLedgerRow.independenceKey, 'camera:front', 'legacy rows inherit independence identity from the registry');

const poisonedTrustSnapshot = structuredClone(guardedRuntime.snapshot());
poisonedTrustSnapshot.externalObserver.sources[0].reliability01 = 9;
const normalizedTrustRestore = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration });
normalizedTrustRestore.restore(poisonedTrustSnapshot);
assert.equal(normalizedTrustRestore.externalObserver.snapshot().sources[0].reliability01, 0.8,
  'strictly authorized device trust may be downgraded by persisted state but never elevated above the conservative class prior');

// Invalid or unauthorized snapshot rows must not consume the restore capacity
// before a valid source declaration is considered.
const restorePolicy = source => source.id === 'trusted-camera' && source.sourceClass === 'device'
  && source.channel === 'camera' && source.independenceKey === 'camera:front';
const trustedSourceRuntime = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration: restorePolicy });
trustedSourceRuntime.externalObserver.registerSource({
  id: 'trusted-camera', sourceClass: 'device', channel: 'camera', independenceKey: 'camera:front',
});
const trustedObservation = trustedSourceRuntime.externalObserver.observe({
  sourceId: 'trusted-camera', sourceClass: 'device', channel: 'camera', independenceKey: 'camera:front',
  claimKey: 'scene=clear', observedPostcondition: 'scene=clear', confidence01: 0.95,
  actionRef: 'trusted-action-1',
});
trustedSourceRuntime.externalObserver.assess(trustedObservation.id, 'scene=clear');
const crowdedRestoreSnapshot = structuredClone(trustedSourceRuntime.externalObserver.snapshot());
// Persisted snapshots are most-recent-first. Old invalid rows beyond the raw
// limit must not evict the valid observation, assessment, or action link.
crowdedRestoreSnapshot.observations = [
  ...crowdedRestoreSnapshot.observations,
  ...Array.from({ length: 64 }, (_, index) => ({
    id: `orphan-observation-${index}`, sourceId: 'missing-source',
    sourceClass: 'device', channel: 'camera', independenceKey: 'camera:front',
    claimKey: 'scene=clear', observedAt: Date.now() - index - 1,
    confidence01: 0.8, freshness01: 1, facts: [], metadata: {},
  })),
];
crowdedRestoreSnapshot.assessments = [
  ...crowdedRestoreSnapshot.assessments,
  ...Array.from({ length: 64 }, (_, index) => ({
    observationId: `orphan-observation-${index}`, expectedPostcondition: 'scene=clear',
    observedPostcondition: 'scene=clear', assessment: 'match', similarity01: 1,
    confidence01: 0.8, verified: true, reason: 'fixture', assessedAt: Date.now(),
  })),
];
crowdedRestoreSnapshot.linkedActions = [
  ...crowdedRestoreSnapshot.linkedActions,
  ...Array.from({ length: 64 }, (_, index) => ({
    actionRef: `orphan-action-${index}`, observationId: `orphan-observation-${index}`,
    assessment: 'match', at: Date.now(),
  })),
];
crowdedRestoreSnapshot.sources = [
  ...Array.from({ length: 16 }, (_, index) => ({
    id: `untrusted-${index}`, sourceClass: 'unknown', channel: 'unknown',
    independenceKey: `untrusted-${index}`, reliability01: 1, enabled: true,
  })),
  ...crowdedRestoreSnapshot.sources,
];
const crowdedRestore = new EvidenceResearchSubsystemRuntime({ authorizeSourceRegistration: restorePolicy });
crowdedRestore.externalObserver.restore(crowdedRestoreSnapshot);
assert.ok(crowdedRestore.externalObserver.snapshot().sources.some(source => source.id === 'trusted-camera'),
  'invalid/unapproved rows must not crowd a valid declared source out of the bounded restore registry');
assert.equal(crowdedRestore.externalObserver.snapshot().observations.length, 1,
  'valid recent observation must survive invalid rows beyond the raw restore limit');
assert.equal(crowdedRestore.externalObserver.snapshot().assessments.length, 1,
  'assessment linked to a retained observation must survive invalid rows beyond the raw restore limit');
assert.equal(crowdedRestore.externalObserver.snapshot().linkedActions.length, 1,
  'action link linked to a retained observation must survive invalid rows beyond the raw restore limit');

console.log('WorkPass548 observer source identity regression: PASS');
