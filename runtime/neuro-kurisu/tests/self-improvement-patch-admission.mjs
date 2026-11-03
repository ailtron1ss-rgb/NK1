import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { buildSourceGraph } from '../src/organism/analysis/SourceGraph.ts';
import { canonicalPatchReceiptPayload, parseUnifiedDiff } from '../src/organism/analysis/PatchReceiptGuard.ts';
import { SelfImprovementCandidatePool } from '../src/organism/analysis/SelfImprovementCandidatePool.ts';

const baseSha='a'.repeat(40), file='src/organism/cognition/Evolvable.ts';
const patch=[`diff --git a/${file} b/${file}`,'index 1111111..2222222 100644',
  `--- a/${file}`,`+++ b/${file}`,'@@ -1 +1 @@',
  '-export function tune(x: number) { return x; }',
  '+export function tune(x: number) { return x + 1; }',''].join('\n');
const pair=generateKeyPairSync('ed25519');
const trustedPublicKeys={'nk1-test-key':pair.publicKey.export({type:'spki',format:'pem'}).toString()};
const unsigned={schemaVersion:1,keyId:'nk1-test-key',baseSha,
  patchSha256:createHash('sha256').update(patch,'utf8').digest('hex'),changedFiles:parseUnifiedDiff(patch)};
const receipt={...unsigned,signature:sign(null,Buffer.from(canonicalPatchReceiptPayload(unsigned),'utf8'),pair.privateKey).toString('base64')};
const graph=buildSourceGraph([
 {path:file,text:'export function tune(x: number) { return x; }\n'},
 {path:'src/organism/learning/VerifiedOutcomePromotionGate.ts',text:'export class VerifiedOutcomePromotionGate {}\n'},
]);
const candidate=id=>({candidateId:id,targetFiles:[file],evolveBlocks:[{file,startLine:1,endLine:1}],
 observations:Array.from({length:5},(_,i)=>({id:`holdout-${i+1}`,proxyGain:.30,downstreamGain:.28})),rollbackReady:true});
const trustedPool=(trust={baseSha,trustedPublicKeys})=>new SelfImprovementCandidatePool({},undefined,trust);
const receiptProof=(extra={})=>({receipt,patchText:patch,...extra});
test('admits candidate through the signed exact-diff path',()=>{
 const pool=trustedPool();
 const result=pool.submitVerified(candidate('signed-change'),graph,receiptProof());
 assert.equal(result.accepted,true,result.reason);
});
test('refuses invalid signature at candidate admission',()=>{
 const pool=trustedPool();
 const result=pool.submitVerified(candidate('invalid-signature'),graph,{receipt:{...receipt,signature:'A'.repeat(88)},patchText:patch});
 assert.equal(result.accepted,false); assert.match(result.reason,/^patch-receipt:/);
});
test('refuses a candidate whose evolve block omits the actual changed lines',()=>{
 const pool=trustedPool();
 const result=pool.submitVerified({...candidate('out-of-range'),evolveBlocks:[{file,startLine:2,endLine:3}]},graph,receiptProof());
 assert.equal(result.accepted,false); assert.match(result.reason,/changed-lines-outside-evolve-block/);
});
test('does not trust keys and base SHA supplied by the candidate proof',()=>{
 const pool=new SelfImprovementCandidatePool();
 const result=pool.submitVerified(candidate('self-appointed-authority'),graph,{
  receipt,patchText:patch,expectedBaseSha:baseSha,trustedPublicKeys,
 });
 assert.equal(result.accepted,false,'candidate-supplied public keys must not establish trust');
 assert.equal(result.reason,'patch-receipt:host-trust-unconfigured');
});

test('uses the host-pinned base SHA and key registry instead of proof overrides',()=>{
 const pool=trustedPool();
 const result=pool.submitVerified(candidate('host-authority-wins'),graph,
  receiptProof({expectedBaseSha:'b'.repeat(40),trustedPublicKeys:{}}));
 assert.equal(result.accepted,true,result.reason);
});
test('snapshots the host public-key registry at construction',()=>{
 const mutableKeys={...trustedPublicKeys};
 const pool=trustedPool({baseSha,trustedPublicKeys:mutableKeys});
 const wrong=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString();
 mutableKeys['nk1-test-key']=wrong;
 assert.equal(pool.submitVerified(candidate('immutable-key-snapshot'),graph,receiptProof()).accepted,true);
});
test('rejects a receipt that does not match the host-pinned source revision',()=>{
 const pool=trustedPool({baseSha:'b'.repeat(40),trustedPublicKeys});
 const result=pool.submitVerified(candidate('wrong-host-base'),graph,receiptProof());
 assert.equal(result.accepted,false);
 assert.equal(result.reason,'patch-receipt:patch-base-sha-mismatch');
});
test('refuses invalid or empty host trust configuration at construction',()=>{
 assert.throws(()=>new SelfImprovementCandidatePool({},undefined,{baseSha,trustedPublicKeys:{}}),
  /candidate-pool-patch-receipt-trust-invalid/);
 assert.throws(()=>new SelfImprovementCandidatePool({},undefined,{baseSha:'short',trustedPublicKeys}),
  /candidate-pool-patch-receipt-trust-invalid/);
});
test('keeps metrics-only candidates distinct from signed-patch candidates',()=>{
 const metricsPool=new SelfImprovementCandidatePool();
 const metrics=metricsPool.submit(candidate('metrics-only'),graph);
 assert.equal(metrics.accepted,true);
 assert.equal(metrics.admissionClass,'metrics-only');
 assert.equal(metricsPool.best().admissionClass,'metrics-only');

 const verifiedPool=trustedPool();
 const verified=verifiedPool.submitVerified(candidate('signed-patch'),graph,receiptProof());
 assert.equal(verified.accepted,true,verified.reason);
 assert.equal(verified.admissionClass,'signed-patch-receipt');
 assert.equal(verifiedPool.best().admissionClass,'signed-patch-receipt');
});

test('admission from signed patch uses only host-owned P36 holdout evidence, not candidate observations',()=>{
 const patchSha256=receipt.patchSha256;
 let authorityRequest;
 const hostAuthority=Object.freeze({
  measure(request){
   authorityRequest=request;
   return Object.freeze({
    candidateId:request.candidateId,baseSha,patchSha256,
    treatmentMethod:'nk1-patch-sha256:'+patchSha256,
    manifestFingerprint:'c'.repeat(64),taskFamily:'self-improvement',
    baselineMethod:'baseline-v1',pairedSeedCount:4,
    baselinePassRate:.5,candidatePassRate:1,absoluteGain:.5,
    evidenceFingerprint:'d'.repeat(64),sourceEvidenceFingerprint:'e'.repeat(64),
    evidenceRefs:Object.freeze(Array.from({length:8},(_,i)=>'signed-ref-'+i)),
    delayMs:0,evidenceScope:'point-in-time-holdout-only',
   });
  },
 });
 const pool=new SelfImprovementCandidatePool({},undefined,{baseSha,trustedPublicKeys},hostAuthority);
 const input=candidate('host-measured-outcome');
 input.observations=Array.from({length:5},(_,i)=>({id:'inflated-'+i,proxyGain:.99,downstreamGain:.99}));
 assert.equal(typeof pool.submitVerifiedOutcome,'function',
  'pool needs a distinct host-evidence admission method');
 const result=pool.submitVerifiedOutcome(input,graph,receiptProof());
 assert.equal(result.accepted,true,result.reason);
 assert.equal(result.admissionClass,'host-verified-holdout-outcome');
 assert.equal(authorityRequest.candidateId,'host-measured-outcome');
 assert.equal(authorityRequest.baseSha,baseSha);
 assert.equal(authorityRequest.patchSha256,patchSha256);
 assert.equal(pool.best().downstreamGain,.5,'rank uses independently verified P36 gain, not candidate-claimed .99');
 assert.equal(pool.best().proxyGain,null,'unmeasured proxy is not represented as zero or as a verified score');
 assert.equal(pool.best().outcomeEvidence.absoluteGain,.5);
});

test('refuses P36 holdout admission when no host outcome authority is configured',()=>{
 const pool=trustedPool();
 const result=pool.submitVerifiedOutcome(candidate('missing-p36-authority'),graph,receiptProof());
 assert.equal(result.accepted,false);
 assert.equal(result.reason,'patch-outcome:host-authority-unconfigured');
 assert.equal(pool.size,0);
});
test('does not read candidate-supplied observations when using host P36 admission',()=>{
 const pool=new SelfImprovementCandidatePool({},undefined,{baseSha,trustedPublicKeys},{
  measure(request){
   return {
    candidateId:request.candidateId,baseSha,patchSha256:request.patchSha256,
    treatmentMethod:'nk1-patch-sha256:'+request.patchSha256,
    manifestFingerprint:'c'.repeat(64),taskFamily:'self-improvement',
    baselineMethod:'baseline-v1',pairedSeedCount:4,
    baselinePassRate:.5,candidatePassRate:1,absoluteGain:.5,
    evidenceFingerprint:'d'.repeat(64),sourceEvidenceFingerprint:'e'.repeat(64),
    evidenceRefs:Array.from({length:8},(_,i)=>'signed-'+i),
    delayMs:0,evidenceScope:'point-in-time-holdout-only',
   };
  },
 });
 let getterCalled=false;
 const input=candidate('observation-getter-never-read');
 Object.defineProperty(input,'observations',{get(){getterCalled=true;throw new Error('candidate observation getter executed');}});
 const result=pool.submitVerifiedOutcome(input,graph,receiptProof());
 assert.equal(getterCalled,false);
 assert.equal(result.accepted,true,result.reason);
 assert.equal(pool.best().downstreamGain,.5);
 assert.equal(pool.best().proxyGain,null);
});
test('rejects P36 authority evidence whose treatment method is not the exact patch digest identity',()=>{
 const pool=new SelfImprovementCandidatePool({},undefined,{baseSha,trustedPublicKeys},{
  measure(request){
   return {
    candidateId:request.candidateId,baseSha,patchSha256:request.patchSha256,
    treatmentMethod:'candidate-controlled-method',
    manifestFingerprint:'c'.repeat(64),taskFamily:'self-improvement',
    baselineMethod:'baseline-v1',pairedSeedCount:4,
    baselinePassRate:.5,candidatePassRate:1,absoluteGain:.5,
    evidenceFingerprint:'d'.repeat(64),sourceEvidenceFingerprint:'e'.repeat(64),
    evidenceRefs:Array.from({length:8},(_,i)=>'signed-'+i),
    delayMs:0,evidenceScope:'point-in-time-holdout-only',
   };
  },
 });
 const result=pool.submitVerifiedOutcome(candidate('wrong-treatment-method'),graph,receiptProof());
 assert.equal(result.accepted,false);
 assert.equal(result.reason,'patch-outcome:evidence-binding-invalid');
});
