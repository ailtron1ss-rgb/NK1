import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  SignedReplayEvidenceAuthority,
  signReplayEvidenceArtifactForFixture,
} from '../src/organism/learning/SignedReplayEvidenceArtifact.ts';

const verifier=generateKeyPairSync('ed25519');
const otherVerifier=generateKeyPairSync('ed25519');
const publicKey=verifier.publicKey.export({type:'spki',format:'pem'}).toString();
const privateKey=verifier.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const otherPublicKey=otherVerifier.publicKey.export({type:'spki',format:'pem'}).toString();
const protocolFingerprint='a'.repeat(64);
const input={
  experimentId:'durable-replay-1',
  taskId:'memory-transfer',
  phase:'holdout',
  mode:'replay-on',
  contextKey:'holdout-ru-a',
  pairKey:'pair-a',
  delayMs:86_400_000,
  baselineScore01:.5,
  score01:.86,
};
const authority=new SignedReplayEvidenceAuthority(new Map([['trusted-replay-verifier',publicKey]]));
const artifact=signReplayEvidenceArtifactForFixture({
  artifactId:'replay-artifact-1',
  runId:'replay-run-1',
  kind:'longitudinal-trial',
  verifierId:'trusted-replay-verifier',
  observedAt:1_800_000_000_000,
  protocolFingerprint,
  input,
},privateKey);
const expected={kind:'longitudinal-trial',input,protocolFingerprint};
const accepted=authority.ingest(artifact,expected);
assert.equal(accepted.accepted,true,'a valid signed exact measurement must be admitted');
assert.equal(authority.isTrusted(accepted.receipt,expected),true,
  'the verifier receipt must be process-local and bound to the exact tuple');

// A signed result cannot be rebound to a different score or pair.
assert.equal(authority.isTrusted(accepted.receipt,{...expected,input:{...input,score01:.99}}),false);
assert.equal(authority.isTrusted({...accepted.receipt},expected),false,
  'copying receipt JSON must not copy its WeakMap authority');

// Duplicate artifact IDs are idempotent only for the exact same signed payload.
const duplicate=authority.ingest(artifact,expected);
assert.equal(duplicate.accepted,true);
assert.equal(duplicate.duplicate,true);
assert.equal(authority.snapshot().artifacts.length,1);
const conflict=signReplayEvidenceArtifactForFixture({
  artifactId:'replay-artifact-1',
  runId:'replay-run-1',
  kind:'longitudinal-trial',
  verifierId:'trusted-replay-verifier',
  observedAt:1_800_000_000_001,
  protocolFingerprint,
  input:{...input,score01:.87},
},privateKey);
assert.equal(authority.ingest(conflict,{...expected,input:{...input,score01:.87}}).accepted,false,
  'same artifact ID with changed bytes must be rejected');

// Tampering, unknown keys, revoked keys and wrong experiment contracts fail closed.
const tampered=structuredClone(artifact);
tampered.payload.input.score01=.9;
const freshAuthority=new SignedReplayEvidenceAuthority(new Map([['trusted-replay-verifier',publicKey]]));
assert.equal(freshAuthority.ingest(tampered,expected).accepted,false);
const untrusted=new SignedReplayEvidenceAuthority(new Map([['other-verifier',otherPublicKey]]));
assert.equal(untrusted.ingest(artifact,expected).accepted,false);
const revoked=new SignedReplayEvidenceAuthority(new Map([['trusted-replay-verifier',publicKey]]),{
  revokedVerifierIds:new Set(['trusted-replay-verifier']),
});
assert.equal(revoked.ingest(artifact,expected).accepted,false);
assert.equal(freshAuthority.ingest(artifact,{...expected,protocolFingerprint:'b'.repeat(64)}).accepted,false);

// Snapshot stores signed artifacts, not trusted booleans. A new authority must
// re-verify signatures against externally supplied keys before it mints receipts.
const snapshot=authority.snapshot();
const afterRestart=new SignedReplayEvidenceAuthority(new Map([['trusted-replay-verifier',publicKey]]));
const restored=afterRestart.restore(snapshot);
assert.equal(restored.accepted,1);
assert.equal(restored.rejected,0);
const restoredReceipt=afterRestart.receiptFor('replay-artifact-1');
assert.ok(restoredReceipt);
assert.equal(afterRestart.isTrusted(restoredReceipt,expected),true);
assert.equal(authority.isTrusted(restoredReceipt,expected),false,
  'a receipt minted after restart belongs to the new authority instance only');

const poisoned=structuredClone(snapshot);
poisoned.artifacts[0].payload.input.score01=.91;
const afterPoison=new SignedReplayEvidenceAuthority(new Map([['trusted-replay-verifier',publicKey]]));
const poisonedResult=afterPoison.restore(poisoned);
assert.equal(poisonedResult.accepted,0);
assert.equal(poisonedResult.rejected,1);

const noKeys=new SignedReplayEvidenceAuthority(new Map());
assert.deepEqual(noKeys.restore(snapshot),{accepted:0,rejected:1});
const bounded=new SignedReplayEvidenceAuthority(new Map([['trusted-replay-verifier',publicKey]]),{maxArtifacts:1});
assert.equal(bounded.ingest(artifact,expected).accepted,true);
const second=signReplayEvidenceArtifactForFixture({
  artifactId:'replay-artifact-2',runId:'replay-run-2',kind:'longitudinal-trial',
  verifierId:'trusted-replay-verifier',observedAt:1_800_000_000_002,
  protocolFingerprint,input:{...input,pairKey:'pair-b'},
},privateKey);
assert.equal(bounded.ingest(second,{kind:'longitudinal-trial',protocolFingerprint,input:{...input,pairKey:'pair-b'}}).accepted,false,
  'capacity pressure must not evict accepted IDs and reopen replay');

console.log('DURABLE_REPLAY_EVIDENCE_ARTIFACT=PASS');
