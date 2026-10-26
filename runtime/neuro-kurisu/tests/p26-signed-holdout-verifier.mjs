import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as signSignature } from 'node:crypto';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';
import {
  canonicalP26HoldoutPayload,
  createP26HoldoutEvidenceVerifierFromEnv,
} from '../src/organism/learning/P26TrustedHoldoutEvidenceAuthority.ts';

const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const publicKeyPem=publicKey.export({type:'spki',format:'pem'}).toString();
const config=JSON.stringify({
  'oracle-a':{publicKeyPem,protocolIds:['frozen-v1']},
});
const verifyHoldoutEvidence=createP26HoldoutEvidenceVerifierFromEnv(config);
assert.equal(typeof verifyHoldoutEvidence,'function');
const base={
  evidenceId:'signed-evidence-001',
  taskId:'task-holdout-7',
  protocolId:'frozen-v1',
  verifierId:'oracle-a',
  sampleSetHash:'sha256:independent-set-7',
  baseline01:.42,
  learned01:.81,
  verified:true,
  independent:true,
};
const signEvidence=(overrides={})=>{
  const input={...base,...overrides,signature:''};
  const signature=signSignature(null,Buffer.from(canonicalP26HoldoutPayload(input),'utf8'),privateKey).toString('base64');
  return {...input,signature};
};
const evidence=signEvidence();
assert.equal(verifyHoldoutEvidence(evidence),true,'trusted Ed25519 signature should validate exact evidence fields');

const engine=new P26TrueLearningEngine({verifyHoldoutEvidence});
const accepted=engine.recordVerifiedHoldout(evidence);
assert.equal(accepted.accepted,true);
assert.equal(engine.metrics().independentHoldoutSamples,1);
assert.equal(engine.metrics().generalizationEvidence01,.05);
assert.equal(engine.recordVerifiedHoldout(evidence).reason,'duplicate-holdout-evidence');

const altered=signEvidence({baseline01:.99});
assert.equal(verifyHoldoutEvidence({...altered,signature:evidence.signature}),false,
  'reusing a signature with altered scores must be rejected');
assert.equal(engine.recordVerifiedHoldout({...altered,signature:evidence.signature}).reason,'holdout-evidence-not-authenticated');

const disallowedProtocol=signEvidence({evidenceId:'evidence-protocol-outside-config',protocolId:'unregistered-v9'});
assert.equal(verifyHoldoutEvidence(disallowedProtocol),false,
  'a trusted key cannot submit protocols outside its allowlist');
const notIndependent=signEvidence({evidenceId:'evidence-not-independent',independent:false});
assert.equal(verifyHoldoutEvidence(notIndependent),false);
assert.throws(()=>createP26HoldoutEvidenceVerifierFromEnv('not-json'),/p26-holdout-verifier-config-invalid-json/);
assert.throws(()=>createP26HoldoutEvidenceVerifierFromEnv(JSON.stringify({
  'oracle-a':{publicKeyPem:privateKey.export({type:'pkcs8',format:'pem'}).toString(),protocolIds:['frozen-v1']},
})),/p26-holdout-verifier-entry-invalid/);

const restored=new P26TrueLearningEngine({verifyHoldoutEvidence});
const damaged=engine.snapshot();
damaged.holdoutEvidence.push({...evidence,evidenceId:'forged-restore',sampleSetHash:'attacker-controlled',recordedAt:Date.now()});
restored.restore(damaged);
assert.equal(restored.metrics().independentHoldoutSamples,1,'restored evidence must be reverified, not trusted by persisted flags');
assert.equal(restored.recordVerifiedHoldout(evidence).reason,'duplicate-holdout-evidence',
  'the signed evidence identity must survive a valid restore');
console.log('P26_SIGNED_HOLDOUT_VERIFIER=PASS',JSON.stringify({
  acceptedSignedEvidence:true,
  alteredScoreRejected:true,
  protocolAllowlistEnforced:true,
  nonIndependentRejected:true,
  forgedRestoreRejected:true,
  independentHoldoutSamples:restored.metrics().independentHoldoutSamples,
}));
