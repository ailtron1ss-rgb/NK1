import assert from 'node:assert/strict';
import { GovernanceSubsystemRuntime } from '../src/organism/core/GovernanceSubsystemRuntime.ts';

const first = new GovernanceSubsystemRuntime();
const snapshot = first.snapshot();
assert.equal(snapshot.constitutionEvolution.schemaVersion, 1);
assert.equal(snapshot.constitutionEvolution.active.version, '1.0.0');
assert.ok(Array.isArray(snapshot.constitutionEvolution.auditEvents));

const restored = new GovernanceSubsystemRuntime();
restored.restoreFromPersisted({ advanced: snapshot });
assert.equal(restored.constitutionEvolution.diagnostics().lastRestore.ok, true);
assert.equal(restored.constitutionEvolution.activeConstitution().digest, snapshot.constitutionEvolution.active.digest);

const tampered = structuredClone(snapshot);
tampered.constitutionEvolution.protectedInvariantDigest = 'f'.repeat(64);
const failClosed = new GovernanceSubsystemRuntime();
failClosed.restoreFromPersisted({ advanced: tampered });
assert.equal(failClosed.constitutionEvolution.activeConstitution().version, '1.0.0');
assert.equal(failClosed.constitutionEvolution.diagnostics().lastRestore.ok, false);

console.log('OMESTRO_20_GOVERNANCE_RUNTIME_PERSISTENCE=PASS');
