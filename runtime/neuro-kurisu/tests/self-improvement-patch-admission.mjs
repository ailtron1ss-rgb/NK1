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
test('admits candidate through the signed exact-diff path',()=>{
 const pool=new SelfImprovementCandidatePool();
 const result=pool.submitVerified(candidate('signed-change'),graph,{receipt,patchText:patch,expectedBaseSha:baseSha,trustedPublicKeys});
 assert.equal(result.accepted,true,result.reason);
});
test('refuses invalid signature at candidate admission',()=>{
 const pool=new SelfImprovementCandidatePool();
 const result=pool.submitVerified(candidate('invalid-signature'),graph,{receipt:{...receipt,signature:'A'.repeat(88)},patchText:patch,expectedBaseSha:baseSha,trustedPublicKeys});
 assert.equal(result.accepted,false); assert.match(result.reason,/^patch-receipt:/);
});
test('refuses a candidate whose evolve block omits the actual changed lines',()=>{
 const pool=new SelfImprovementCandidatePool();
 const result=pool.submitVerified({...candidate('out-of-range'),evolveBlocks:[{file,startLine:2,endLine:3}]},graph,
 {receipt,patchText:patch,expectedBaseSha:baseSha,trustedPublicKeys});
 assert.equal(result.accepted,false); assert.match(result.reason,/changed-lines-outside-evolve-block/);
});
