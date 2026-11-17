import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  SynapticCommons,
  parseSynapticPublicKeyMap,
  synapticArtifactFingerprint,
  synapticAttestationSigningPayload,
} from '../src/organism/learning/SynapticCommons.ts';

const now = 1_800_000_000_000;
const publisher = generateKeyPairSync('ed25519');
const attestor = generateKeyPairSync('ed25519');
const untrustedPublisher = generateKeyPairSync('ed25519');
const publisherPublic = publisher.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const publisherPrivate = publisher.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const attestorPublic = attestor.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const attestorPrivate = attestor.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const untrustedPublic = untrustedPublisher.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const untrustedPrivate = untrustedPublisher.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const rsaPublisher = generateKeyPairSync('rsa', { modulusLength: 2048 });
const rsaPublic = rsaPublisher.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const envFingerprint = 'e'.repeat(64);
assert.throws(() => parseSynapticPublicKeyMap(JSON.stringify({ rsa: rsaPublic })), /requires-ed25519/,
  'the host trust store accepts Ed25519 public keys only');
assert.throws(() => parseSynapticPublicKeyMap(JSON.stringify({ publisher: publisherPrivate })), /public-keys-only/,
  'private signing keys must never be accepted in runtime trust configuration');
const trust = {
  trustedPublisherKeys: new Map([['publisher-1', publisherPublic]]),
  trustedAttestorKeys: new Map([['evaluator-1', attestorPublic]]),
  trustedLicenseReviewFingerprints: new Set(['b'.repeat(64)]),
  now: () => now,
};

function makeArtifact(overrides = {}, privateKey = publisherPrivate, keyId = 'publisher-1') {
  const artifact = {
    schemaVersion: 1,
    skill: {
      skillId: 'summarize-docs',
      name: 'Summarize documents',
      version: '1.0.0',
      summary: 'A bounded declarative summarization procedure.',
      kind: 'procedure',
      ...(overrides.skill ?? {}),
    },
    contract: {
      capability: 'documents.summarize',
      requiredCapabilities: ['documents.read'],
      requiredTools: ['documents.fetch'],
      permissionClass: 'assisted',
      allowedModes: ['assisted'],
      minimumRuntimeVersion: '1.0.0',
      environmentFingerprint: envFingerprint,
      ...(overrides.contract ?? {}),
    },
    definition: {
      format: 'declarative-json-v1',
      payload: { steps: [{ operation: 'invoke-capability', capability: 'documents.fetch' }] },
      ...(overrides.definition ?? {}),
    },
    provenance: {
      sourceInstanceId: 'nk1-instance-alpha',
      sourceRuntimeVersion: '1.2.0',
      sourceArtifactFingerprint: 'a'.repeat(64),
      createdAt: now,
      ...(overrides.provenance ?? {}),
    },
    license: {
      identifier: 'Apache-2.0',
      redistributionAllowed: true,
      reviewFingerprint: 'b'.repeat(64),
      ...(overrides.license ?? {}),
    },
    signature: { keyId, algorithm: 'Ed25519', value: 'A'.repeat(88) },
  };
  const fingerprint = synapticArtifactFingerprint(artifact);
  artifact.signature.value = sign(null, Buffer.from(fingerprint, 'utf8'), privateKey).toString('base64');
  return artifact;
}

function makeAttestation(artifactFingerprint, overrides = {}, privateKey = attestorPrivate) {
  const attestation = {
    schemaVersion: 1,
    artifactFingerprint,
    attestorId: 'evaluator-1',
    runtimeVersion: '1.2.0',
    environmentFingerprint: envFingerprint,
    testSuiteFingerprint: 'c'.repeat(64),
    holdoutFingerprint: 'd'.repeat(64),
    independentSeedCount: 5,
    holdoutSamples: 5,
    baselinePasses: 3,
    candidatePasses: 4,
    issuedAt: now,
    expiresAt: now + 7 * 24 * 60 * 60_000,
    signature: { algorithm: 'Ed25519', value: 'A'.repeat(88) },
    ...overrides,
  };
  const payload = synapticAttestationSigningPayload(attestation);
  attestation.signature.value = sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  return attestation;
}

const commons = new SynapticCommons(trust);
assert.deepEqual(commons.snapshot(), { schemaVersion: 1, revision: 0, records: [] });

const artifact = makeArtifact();
const fingerprint = synapticArtifactFingerprint(artifact);
const imported = commons.importArtifact(artifact);
assert.equal(imported.duplicate, false);
assert.equal(imported.record.artifactFingerprint, fingerprint);
assert.equal(imported.record.status, 'quarantined',
  'publisher trust never skips quarantine or a local compatibility check');
assert.equal(commons.diagnostics().executableCount, 0,
  'Synaptic Commons is a distribution registry, never an execution engine');

const duplicate = commons.importArtifact(artifact);
assert.equal(duplicate.duplicate, true);
assert.equal(commons.snapshot().records.length, 1, 'identical imports must be idempotent');

assert.throws(() => commons.exportArtifact(fingerprint), /requires-attested-artifact/,
  'quarantined artifacts cannot be exported as trusted reusable skills');

const incompatible = commons.evaluateCompatibility(fingerprint, {
  runtimeVersion: '1.2.0',
  environmentFingerprint: envFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
  permittedTools: [],
  now,
});
assert.equal(incompatible.status, 'quarantined');
assert.equal(incompatible.compatibility?.reasons[0], 'tool-not-permitted:documents.fetch');

const compatible = commons.evaluateCompatibility(fingerprint, {
  runtimeVersion: '1.2.0',
  environmentFingerprint: envFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
  permittedTools: ['documents.fetch'],
  now,
});
assert.equal(compatible.status, 'compatible');
assert.equal(compatible.compatibility?.compatible, true);

const attestation = makeAttestation(fingerprint);
const attested = commons.attachAttestation(fingerprint, attestation);
assert.equal(attested.status, 'attested');
assert.equal(commons.diagnostics().attested, 1);
const exportTarget = {
  runtimeVersion: '1.2.0',
  environmentFingerprint: envFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
  permittedTools: ['documents.fetch'],
  now,
};
const exported = commons.exportArtifact(fingerprint, exportTarget);
assert.throws(() => commons.exportArtifact(fingerprint, {
  ...exportTarget, environmentFingerprint: 'f'.repeat(64),
}), /host-context-stale/, 'export refuses a host environment different from the attested one');
assert.throws(() => commons.exportArtifact(fingerprint, {
  ...exportTarget, permittedTools: [],
}), /current-host-incompatible/, 'export rechecks the live host permission manifest');
assert.equal(exported.attestation.artifactFingerprint, fingerprint);
assert.equal(exported.artifact.skill.skillId, 'summarize-docs');

const clonedSnapshot = commons.snapshot();
clonedSnapshot.records[0].artifact.skill.name = 'tampered outside';
assert.equal(commons.get(fingerprint)?.artifact.skill.name, 'Summarize documents',
  'snapshots must not expose mutable internal state');

const restored = new SynapticCommons(trust);
restored.restore(commons.snapshot());
assert.equal(restored.get(fingerprint)?.status, 'attested',
  'restart restore re-verifies the publisher and independent attestor signatures');

const tamperedRestore = commons.snapshot();
tamperedRestore.records[0].artifact.skill.name = 'forged after persistence';
assert.throws(() => new SynapticCommons(trust).restore(tamperedRestore),
  /(?:record-fingerprint-invalid|publisher-signature-invalid)/,
  'persisted content is reauthenticated after restart');

const untrustedArtifact = makeArtifact({ skill: { version: '1.0.0', skillId: 'other-skill' } }, untrustedPrivate, 'untrusted-publisher');
assert.throws(() => commons.importArtifact(untrustedArtifact), /publisher-not-trusted/,
  'an arbitrary publisher cannot inject a skill into the common store');

const poisoned = makeArtifact({
  skill: { skillId: 'poisoned-skill' },
  definition: { payload: { conversationTranscript: 'private dialogue must never be shared' } },
});
assert.throws(() => commons.importArtifact(poisoned), /private-field-rejected/,
  'private episodic and dialogue data are rejected before persistence');

const malformedArray = makeArtifact({ skill: { skillId: 'array-extension' } });
Object.defineProperty(malformedArray.definition.payload.steps, 'unexpected', {
  enumerable: true, value: 'extra array properties are not JSON data',
});
assert.throws(() => commons.importArtifact(malformedArray), /array-shape-invalid/,
  'arrays with custom properties are not silently canonicalized into signed JSON');

const executable = makeArtifact({
  skill: { skillId: 'executable-skill' },
  definition: { payload: { script: 'process.env.SECRET' } },
});
assert.throws(() => commons.importArtifact(executable), /executable-field-rejected/,
  'executable payloads are not accepted by the declarative Commons transport');

const email = makeArtifact({
  skill: { skillId: 'email-leak' },
  definition: { payload: { note: 'contact me at private@example.com' } },
});
assert.throws(() => commons.importArtifact(email), /sensitive-value-rejected/,
  'obvious direct identifiers are rejected from portable artifacts');

const noLicense = makeArtifact({
  skill: { skillId: 'uncleared-license' },
  license: { redistributionAllowed: false },
});
assert.throws(() => commons.importArtifact(noLicense), /license-not-cleared/,
  'unreviewed or non-redistributable material cannot enter the shared catalogue');

const unreviewedLicense = makeArtifact({ skill: { skillId: 'unreviewed-license' }, license: { reviewFingerprint: 'f'.repeat(64) } });
assert.throws(() => commons.importArtifact(unreviewedLicense), /license-review-not-trusted-by-host/,
  'a publisher cannot self-assert legal redistribution clearance without a host-approved review fingerprint');

const evidenceCommons = new SynapticCommons(trust);
const evidenceArtifact = makeArtifact({ skill: { skillId: 'attestation-evidence-gates' } });
const evidenceFingerprint = synapticArtifactFingerprint(evidenceArtifact);
evidenceCommons.importArtifact(evidenceArtifact);
evidenceCommons.evaluateCompatibility(evidenceFingerprint, {
  runtimeVersion: '1.2.0',
  environmentFingerprint: envFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
  permittedTools: ['documents.fetch'],
  now,
});
const weak = makeAttestation(evidenceFingerprint, { independentSeedCount: 2 });
assert.throws(() => evidenceCommons.attachAttestation(evidenceFingerprint, weak), /evidence-invalid/,
  'fewer than five independent holdout seeds cannot attest a compatible skill');

const noImprovement = makeAttestation(evidenceFingerprint, { baselinePasses: 4, candidatePasses: 4 });
assert.throws(() => evidenceCommons.attachAttestation(evidenceFingerprint, noImprovement), /evidence-invalid/,
  'a candidate without positive holdout improvement cannot be attested');

const wrongEnvironment = makeAttestation(evidenceFingerprint, { environmentFingerprint: 'f'.repeat(64) });
assert.throws(() => evidenceCommons.attachAttestation(evidenceFingerprint, wrongEnvironment), /context-mismatch/,
  'holdout evidence from a different environment cannot attest this local copy');

const tamperedAttestation = makeAttestation(evidenceFingerprint);
tamperedAttestation.candidatePasses = 5;
assert.throws(() => evidenceCommons.attachAttestation(evidenceFingerprint, tamperedAttestation), /attestor-signature-invalid/,
  'modifying an evidence receipt invalidates its signature');

const anotherArtifact = makeArtifact({ skill: { version: '1.0.0', summary: 'Changed content, same slot.' } });
assert.throws(() => commons.importArtifact(anotherArtifact), /skill-version-conflict/,
  'one skill id/version cannot be rebound to a second artifact fingerprint');

const incompatibleRuntime = new SynapticCommons(trust);
const future = incompatibleRuntime.importArtifact(makeArtifact({
  skill: { skillId: 'future-skill' },
  contract: { minimumRuntimeVersion: '9.0.0' },
}));
const futureResult = incompatibleRuntime.evaluateCompatibility(future.record.artifactFingerprint, {
  runtimeVersion: '1.2.0',
  environmentFingerprint: envFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
  permittedTools: ['documents.fetch'],
  now,
});
assert.equal(futureResult.status, 'quarantined');
assert.ok(futureResult.compatibility?.reasons.includes('runtime-version-below-minimum'));

const destructiveCommons = new SynapticCommons(trust);
const destructive = destructiveCommons.importArtifact(makeArtifact({
  skill: { skillId: 'destructive-skill' },
  contract: { permissionClass: 'destructive' },
}));
const destructiveResult = destructiveCommons.evaluateCompatibility(destructive.record.artifactFingerprint, {
  runtimeVersion: '1.2.0',
  environmentFingerprint: envFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
  permittedTools: ['documents.fetch'],
  now,
});
assert.equal(destructiveResult.status, 'quarantined');
assert.ok(destructiveResult.compatibility?.reasons.includes('destructive-permission-not-shareable'));

const overlongDescriptor = makeArtifact({
  skill: { skillId: 'overlong-field', name: 'n'.repeat(121) },
});
assert.throws(() => commons.importArtifact(overlongDescriptor), /field-too-long/,
  'oversized fields must be rejected, never silently truncated before signature verification');

const prereleaseRuntime = new SynapticCommons(trust);
const stableRequirement = prereleaseRuntime.importArtifact(makeArtifact({
  skill: { skillId: 'stable-runtime-required' },
  contract: { minimumRuntimeVersion: '1.2.0' },
}));
const prereleaseCompatibility = prereleaseRuntime.evaluateCompatibility(
  stableRequirement.record.artifactFingerprint,
  {
    runtimeVersion: '1.2.0-rc.1',
    environmentFingerprint: envFingerprint,
    supportedCapabilities: ['documents.read', 'documents.summarize'],
    permittedTools: ['documents.fetch'],
    now,
  },
);
assert.equal(prereleaseCompatibility.status, 'quarantined',
  'a prerelease runtime must not satisfy a stable minimum runtime version');

const attestedStateBeforeExpiry = commons.snapshot();
let expiryNow = now;
const expiryTrust = { ...trust, now: () => expiryNow };
const restoredBeforeExpiry = new SynapticCommons(expiryTrust);
restoredBeforeExpiry.restore(attestedStateBeforeExpiry);
expiryNow = attestation.expiresAt + 1;
const restoredAfterExpiry = new SynapticCommons(expiryTrust);
assert.doesNotThrow(() => restoredAfterExpiry.restore(attestedStateBeforeExpiry),
  'expired evidence remains verifiable during restore and must not prevent runtime startup');
assert.throws(() => restoredAfterExpiry.exportArtifact(fingerprint, exportTarget), /attestation-expired/,
  'expired evidence remains non-exportable');

const revoked = commons.revokeAttestedArtifact(fingerprint, 'independent review found a poisoned capability mapping');
assert.equal(revoked.status, 'revoked');
assert.ok(revoked.attestation, 'revocation preserves the signed evidence for audit');
assert.equal(commons.diagnostics().revoked, 1);
assert.throws(() => commons.exportArtifact(fingerprint), /requires-attested-artifact/,
  'revoked skills can never be exported as trusted packages');
assert.throws(() => commons.evaluateCompatibility(fingerprint, {
  runtimeVersion: '1.2.0', environmentFingerprint: envFingerprint,
  supportedCapabilities: ['documents.read', 'documents.summarize'],
  permittedTools: ['documents.fetch'], now,
}), /skill-revoked/, 'revocation is terminal and cannot be undone by rerunning compatibility');

const revokedRestore = new SynapticCommons({
  trustedPublisherKeys: new Map(),
  trustedAttestorKeys: new Map(),
  trustedLicenseReviewFingerprints: new Set(),
  now: () => now,
});
revokedRestore.restore(commons.snapshot());
assert.equal(revokedRestore.get(fingerprint)?.status, 'revoked',
  'revocation survives trust-root rotation as an audit-only tombstone');
assert.throws(() => revokedRestore.reject(fingerprint, 'change state'), /skill-revoked/,
  'a revoked record cannot be rewritten as an ordinary rejection');

const corrupted = { schemaVersion: 1, revision: 0, records: [{ status: 'attested' }] };
assert.throws(() => new SynapticCommons(trust).restore(corrupted),
  /synaptic-artifact-schema-unsupported|synaptic-artifact-must-be-object/,
  'malformed registry state fails closed rather than silently dropping records');

console.log(JSON.stringify({
  status: 'SYNAPTIC_COMMONS_CONTRACT_PASS',
  imported: true,
  quarantine: true,
  compatibilityGate: true,
  attestationGate: true,
  privacyGate: true,
  executablePayloadGate: true,
  restartReauthentication: true,
  executableCount: 0,
}));
