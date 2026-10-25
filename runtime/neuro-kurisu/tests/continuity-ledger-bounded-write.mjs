import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContinuityLedger } from '../src/organism/system/ContinuityLedger.ts';

const root=await mkdtemp(join(tmpdir(),'nk-continuity-ledger-budget-'));
const maxBytes=64*1024;
const ledger=new ContinuityLedger(join(root,'continuity.jsonl'),maxBytes,1);
const frame=(tick,replaySignature)=>({
  at:1_800_000_000_000+tick,tick,stage:'regression',action:'observe',
  energy01:.8,uncertainty01:.2,predictionError01:.1,selfPredictionError01:.1,
  identityContinuity01:.9,memoryCount:10,goalCount:2,stateBytes:2048,replaySignature,
});
try {
  await ledger.record(frame(1,'a'.repeat(49_000)));
  await ledger.record(frame(2,'🙂'.repeat(20_000)));
  await ledger.close();

  const file=join(root,'continuity.jsonl');
  const text=await readFile(file,'utf8');
  const bytes=new TextEncoder().encode(text).byteLength;
  assert.ok(bytes<=maxBytes,'diagnostic journal must never exceed its configured UTF-8 byte budget');
  const lines=text.split('\n').filter(Boolean);
  assert.equal(lines.length,1,'when the next full JSONL frame cannot fit, it is dropped rather than truncated');
  const restored=JSON.parse(lines[0]);
  assert.equal(restored.tick,1,'the intact prefix of the continuity history is preserved');
  assert.equal(restored.replaySignature.length,49_000);
  assert.ok(!text.includes('�'),'bounded writes must not split a UTF-16 surrogate pair');
  console.log('CONTINUITY_LEDGER_BOUNDED_WRITE=PASS',JSON.stringify({bytes,maxBytes,frames:lines.length}));
} finally {
  await ledger.close();
  await rm(root,{recursive:true,force:true});
}
