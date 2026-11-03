import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { canonicalPatchReceiptPayload, parseUnifiedDiff, verifyPatchReceipt } from '../src/organism/analysis/PatchReceiptGuard.ts';

const baseSha='a'.repeat(40), file='src/organism/cognition/Evolvable.ts';
const patch=[
  \`diff --git a/\${file} b/\${file}\`,'index 1111111..2222222 100644',
  \`--- a/\${file}\`,\`+++ b/\${file}\`,'@@ -1 +1 @@',
  '-export function tune(x: number) { return x; }',
  '+export function tune(x: number) { return x + 1; }','',
].join('\\n');
const pair=generateKeyPairSync('ed25519');
const trustedPublicKeys={'nk1-test-key':pair.publicKey.export({type:'spki',format:'pem'}).toString()};
const blocks=[{file,startLine:1,endLine:1}], targets=[file];
function receiptFor(text=patch,overrides={}) {
  const unsigned={schemaVersion:1,keyId:'nk1-test-key',baseSha,
    patchSha256:createHash('sha256').update(text,'utf8').digest('hex'),changedFiles:parseUnifiedDiff(text),...overrides};
  return {...unsigned,signature:sign(null,Buffer.from(canonicalPatchReceiptPayload(unsigned),'utf8'),pair.privateKey).toString('base64')};
}
function verify(receipt,text=patch,extra={}) {
  return verifyPatchReceipt(receipt,{patchText:text,expectedBaseSha:baseSha,expectedTargetFiles:targets,evolveBlocks:blocks,trustedPublicKeys,...extra});
}
test('parses exact added line range',()=>assert.deepEqual(parseUnifiedDiff(patch),[{path:file,ranges:[{startLine:1,endLine:1}]}]));
test('accepts trusted Ed25519 receipt bound to source SHA, raw diff and evolve block',()=>{
  const result=verify(receiptFor()); assert.equal(result.ok,true,result.reason); assert.equal(result.reason,'patch-receipt-verified');
});
test('rejects replay against another source SHA',()=>assert.equal(verify(receiptFor(),patch,{expectedBaseSha:'b'.repeat(40)}).reason,'patch-base-sha-mismatch'));
test('rejects patch tampering after signing',()=>assert.equal(verify(receiptFor(),patch.replace('return x + 1','return x + 2')).reason,'patch-digest-mismatch'));
test('rejects false changed-line claims',()=>{
  const r=receiptFor(); assert.equal(verify({...r,changedFiles:[{path:file,ranges:[{startLine:2,endLine:2}]}]}).reason,'patch-changed-lines-mismatch');
});
test('rejects edits outside evolve blocks',()=>{
  assert.match(verify(receiptFor(),patch,{evolveBlocks:[{file,startLine:2,endLine:3}]}).reason,/^changed-lines-outside-evolve-block:/);
});
test('rejects target file mismatch',()=>assert.equal(verify(receiptFor(),patch,{expectedTargetFiles:['src/other.ts']}).reason,'patch-target-files-mismatch'));
test('rejects untrusted key and invalid signature',()=>{
  assert.equal(verify(receiptFor(),patch,{trustedPublicKeys:{}}).reason,'patch-signing-key-untrusted');
  const wrong=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString();
  assert.equal(verify(receiptFor(),patch,{trustedPublicKeys:{'nk1-test-key':wrong}}).reason,'patch-signature-invalid');
});
test('rejects binary, new/delete, rename and traversal patches',()=>{
  const bad=['diff --git a/blob b/blob\\nGIT binary patch\\n',
    'diff --git a/new.ts b/new.ts\\nnew file mode 100644\\n--- /dev/null\\n+++ b/new.ts\\n@@ -0,0 +1 @@\\n+x\\n',
    'diff --git a/old.ts b/new.ts\\nrename from old.ts\\nrename to new.ts\\n--- a/old.ts\\n+++ b/new.ts\\n@@ -1 +1 @@\\n-x\\n+y\\n',
    'diff --git a/../outside.ts b/../outside.ts\\n--- a/../outside.ts\\n+++ b/../outside.ts\\n@@ -1 +1 @@\\n-x\\n+y\\n'];
  for(const text of bad) assert.throws(()=>parseUnifiedDiff(text));
});
test('maps deletion-only hunks to their insertion seam',()=>{
  const deletion=[\`diff --git a/\${file} b/\${file}\`,'index 1111111..2222222 100644',
    \`--- a/\${file}\`,\`+++ b/\${file}\`,'@@ -2 +1,0 @@','-obsolete line',''].join('\\n');
  assert.deepEqual(parseUnifiedDiff(deletion),[{path:file,ranges:[{startLine:1,endLine:1}]}]);
});
test('rejects malformed receipt and accessor-backed trust map',()=>{
  assert.equal(verify({...receiptFor(),changedFiles:new Array(1)}).reason,'patch-receipt-malformed');
  const map={}; Object.defineProperty(map,'nk1-test-key',{get(){throw new Error('getter must not run');}});
  assert.equal(verify(receiptFor(),patch,{trustedPublicKeys:map}).reason,'patch-signing-key-untrusted');
});
