import assert from 'node:assert/strict';
import { ExternalEvidenceTrustEngine } from '../src/organism/system/ExternalEvidenceTrust.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';

const trust = new ExternalEvidenceTrustEngine();
const first = trust.observe({ claimKey: 'source-integrity', source: 'web', independenceKey: 'publisher-a', at: 1_800_000_000_000, confidence01: .8 });
assert.match(first.id, /^evidence:[a-f0-9]{64}$/);
const duplicate = trust.observe({ claimKey: ' source-integrity ', source: ' WEB ', independenceKey: ' PUBLISHER-A ', at: 1_800_000_000_000, confidence01: .9 });
assert.equal(duplicate.id, first.id, 'natural key retains the first persisted id');
const trustRestore = new ExternalEvidenceTrustEngine();
trustRestore.restore({ version: 1, records: [{ ...first, id: 'evidence:deadbeef' }] });
const legacy = trustRestore.observe({ claimKey: 'source-integrity', source: 'web', independenceKey: 'publisher-a', at: 1_800_000_000_000, confidence01: .9 });
assert.equal(legacy.id, 'evidence:deadbeef', 'existing FNV IDs remain stable across upgrade');

const firewall = new EvidenceFirewallEngine();
const at = Date.now();
firewall.observe({ claimKey: 'same-document', sourceClass: 'external-api', sourceKey: 'publisher-a', documentKey: 'doc-1', contentHash: 'sha256:a', at, confidence01: .8, trust01: .8 });
const snapshot = firewall.snapshot();
assert.match(snapshot.observations[0].id, /^fw:[a-f0-9]{64}$/);
const restoredFirewall = new EvidenceFirewallEngine();
restoredFirewall.restore({ ...snapshot, observations: snapshot.observations.map(row => ({ ...row, id: 'fw:deadbeef' })) });
restoredFirewall.observe({ claimKey: 'same-document', sourceClass: 'external-api', sourceKey: 'publisher-a', documentKey: 'doc-1', contentHash: 'sha256:a', at: at + 1000, confidence01: .9, trust01: .9 });
assert.equal(restoredFirewall.snapshot().observations.filter(row => row.claimKey === 'same-document').length, 1, 'old observation is upgraded in place without duplicate evidence');
assert.equal(restoredFirewall.snapshot().observations[0].id, 'fw:deadbeef', 'persisted firewall id survives the migration');
console.log('EVIDENCE_HASH_UNIFICATION_WORKPASS39=PASS SHA256=PASS canonical-keys=PASS legacy-id-preservation=PASS no-duplicate-upgrade=PASS');
