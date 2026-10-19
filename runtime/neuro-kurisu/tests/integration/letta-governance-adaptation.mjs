import assert from 'node:assert/strict';
import { LettaGovernanceAdaptationFabric, defaultLettaGovernanceAdaptationState } from '../../src/organism/integration/letta/LettaGovernanceAdaptationFabric.ts';

const fabric = new LettaGovernanceAdaptationFabric();
assert.equal(defaultLettaGovernanceAdaptationState().source.name, 'letta-main');
assert.equal(fabric.sourceBoundary('Letta main 2026-10-08').allowed, false);
assert.equal(fabric.sourceBoundary('Neuro-Kurisu 35.40').allowed, true);
const telemetry = fabric.setTelemetryPolicy({ enabled: false, localOnly: true, exportAllowed: false, retentionDays: 45 });
assert.equal(telemetry.enabled, false);
assert.equal(telemetry.retentionDays, 45);
const review = fabric.recordArtifactReview({ kind:'generated-code', source:'letta-reference', generatedBy:'ChatGPT', disclosure:'AI-assisted', humanReviewed:true });
assert.equal(fabric.canPromoteGeneratedArtifact(review.id).allowed, false);
assert.equal(fabric.decideArtifactReview(review.id, 'approved').ok, true);
assert.equal(fabric.canPromoteGeneratedArtifact(review.id).allowed, true);
assert.equal(fabric.auditProvenancePaths(['legacy/input-archives/raw-source-archives/letta-main.zip']).ok, true);
assert.equal(fabric.auditProvenancePaths(['core/.env.local', 'core/gmail-credentials.json']).ok, false);
console.log('LETTA_GOVERNANCE_ADAPTATION=PASS');
