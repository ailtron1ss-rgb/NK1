import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePatchPolicy, inspectUnifiedDiff } from './neurok-os-patch.mjs';
import policy from '../engineering-os/patch-policy.v1.json' with { type:'json' };

const patch = `diff --git a/src/core.ts b/src/core.ts
index 1111111..2222222 100644
--- a/src/core.ts
+++ b/src/core.ts
@@ -10,3 +10,4 @@ export function run() {
 const a = 1;
-return a;
+const b = 2;
+return a + b;
 }
`;

test('inspects exact changed paths, line ranges and patch digest', () => {
  const result = inspectUnifiedDiff(patch);
  assert.equal(result.fileCount, 1);
  assert.equal(result.files[0].path, 'src/core.ts');
  assert.deepEqual(result.files[0].hunks[0].deletedLineRange, { start:11, end:11 });
  assert.deepEqual(result.files[0].hunks[0].addedLineRange, { start:11, end:12 });
  assert.match(result.digestSha256, /^[a-f0-9]{64}$/);
});

test('requires human approval for authority and workflow paths', () => {
  const result = inspectUnifiedDiff(patch.replaceAll('src/core.ts', '.github/workflows/build.yml'));
  assert.equal(evaluatePatchPolicy(result, policy).decision, 'human-approval-required');
});

test('denies secret and git metadata targets', () => {
  const secretPatch = patch.replaceAll('src/core.ts', '.env');
  const result = evaluatePatchPolicy(inspectUnifiedDiff(secretPatch), policy);
  assert.equal(result.decision, 'deny');
  assert.deepEqual(result.denied, ['.env']);
});

test('rejects traversal and absolute patch targets', () => {
  for (const target of ['../outside.ts', '/etc/passwd', 'C:/outside.ts']) {
    const candidate = patch.replaceAll('src/core.ts', target);
    assert.throws(() => inspectUnifiedDiff(candidate), /unsafe patch path/);
  }
});

test('rejects binary patches and malformed hunk counts', () => {
  assert.throws(() => inspectUnifiedDiff('diff --git a/a.bin b/a.bin\nGIT binary patch'), /binary patches/);
  assert.throws(() => inspectUnifiedDiff(patch.replace('@@ -10,3 +10,4 @@', '@@ -10,9 +10,9 @@')), /line-count mismatch/);
});

test('rejects malformed unified diff line content', () => {
  assert.throws(() => inspectUnifiedDiff(patch.replace(' const a = 1;', '?const a = 1;')), /invalid hunk line/);
});

test('denies nested environment files, private-key material and nested git metadata', () => {
  for (const target of ['config/.env.production', 'runtime/.npmrc', 'keys/id_rsa', 'nested/.git/config', 'secrets/token.pem']) {
    const result = evaluatePatchPolicy(inspectUnifiedDiff(patch.replaceAll('src/core.ts', target)), policy);
    assert.equal(result.decision, 'deny', target);
    assert.deepEqual(result.denied, [target]);
  }
});
