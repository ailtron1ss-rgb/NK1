import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { recordEvidence, validateEvidenceReceipt } from './neurok-os-evidence.mjs';

const sha='a'.repeat(40);
const receipt=()=>({
 schemaVersion:1,
 receiptId:'550e8400-e29b-41d4-a716-446655440000',
 recordedAt:'2026-11-03T09:00:00.000Z',
 repository:'ailtron1ss-rgb/NK1',
 branch:'aspect/evidence-test',
 commitSha:sha,
 workstream:'OS-06',
 taskId:'TASK-EVIDENCE-1',
 status:'PASS',
 command:'npm run neurok-os:test',
 environment:{nodeVersion:'24.22.1',platform:'linux',arch:'x64'},
 result:{exitCode:0,durationMs:123.4},
 artifacts:[{name:'test-report.json',sha256:'b'.repeat(64),sizeBytes:42}],
 dataset:{id:'memory-holdout-v1',sha256:'c'.repeat(64),split:'holdout'},
 metrics:{passRate:1,recallDelta:0.04}
});

test('validates a structured exact-SHA receipt',()=>{
 const result=validateEvidenceReceipt(receipt(),sha);
 assert.equal(result.ok,true,result.errors.join('; '));
});

test('rejects stale SHA, secret-like command values and unknown fields',()=>{
 const stale=validateEvidenceReceipt(receipt(),'d'.repeat(40));
 assert.ok(stale.errors.some(error=>error.includes('exact SHA')));
 const secret=receipt(); secret.command='curl -H "Authorization: Bearer abc123"';
 assert.ok(validateEvidenceReceipt(secret,sha).errors.some(error=>error.includes('secret-like')));
 const extra=receipt(); extra.stdout='private output';
 assert.ok(validateEvidenceReceipt(extra,sha).errors.some(error=>error.includes('unsupported field')));
});

test('rejects non-finite metrics and malformed artifact digests',()=>{
 const bad=receipt(); bad.metrics.recallDelta=Number.NaN; bad.artifacts[0].sha256='bad';
 const result=validateEvidenceReceipt(bad,sha);
 assert.ok(result.errors.some(error=>error.includes('finite numeric')));
 assert.ok(result.errors.some(error=>error.includes('artifacts[0].sha256')));
});

test('records immutable evidence under exact commit SHA',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'neurok-evidence-'));
 try {
  const result=await recordEvidence(receipt(),{expectedSha:sha,directory});
  assert.equal(result.commitSha,sha);
  const saved=JSON.parse(await readFile(result.path,'utf8'));
  assert.equal(saved.receiptId,receipt().receiptId);
  await assert.rejects(()=>recordEvidence(receipt(),{expectedSha:sha,directory}),/EEXIST/);
 } finally { await rm(directory,{recursive:true,force:true}); }
});

test('does not record stale receipts',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'neurok-evidence-'));
 try {
  await assert.rejects(()=>recordEvidence(receipt(),{expectedSha:'d'.repeat(40),directory}),/exact SHA/);
 } finally { await rm(directory,{recursive:true,force:true}); }
});
