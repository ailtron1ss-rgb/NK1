import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir=await mkdtemp(join(tmpdir(),'nk-file-byte-accounting-'));
try {
  const file=join(dir,'state.json');
  const store=new FileStateStore(file,{backupEverySaves:99,directoryFsyncEverySaves:99});
  const value={
    latin:'hello',
    cyrillic:'Курису Максэ',
    astral:'🧠🚀🌌',
    mixed:Array.from({length:64},(_,i)=>`${i % 2 ? 'αβγ' : 'ΔΩ'}-${i}-🧬`).join('|'),
    escapedSurrogate:'\\ud800 literal',
  };
  await store.save(value);
  const payload=await readFile(file,'utf8');
  const expectedBytes=new TextEncoder().encode(payload).byteLength;
  const metrics=store.metrics();
  if(metrics.lastPayloadBytes!==expectedBytes) throw new Error(`byte accounting mismatch: metrics=${metrics.lastPayloadBytes} expected=${expectedBytes}`);
  if(metrics.bytesWritten!==expectedBytes) throw new Error(`cumulative byte accounting mismatch: metrics=${metrics.bytesWritten} expected=${expectedBytes}`);
  console.log(JSON.stringify({PASS:true,lastPayloadBytes:metrics.lastPayloadBytes,bytesWritten:metrics.bytesWritten,fileBytes:(await readFile(file)).byteLength}));
} finally {
  await rm(dir,{recursive:true,force:true});
}
