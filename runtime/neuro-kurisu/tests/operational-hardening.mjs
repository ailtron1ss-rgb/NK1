import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ProcessLock, ProcessLockError } from '../src/organism/persistence/ProcessLock.ts';
import { OperationalJournal } from '../src/organism/persistence/OperationalJournal.ts';
const dir = await mkdtemp(path.join(tmpdir(),'nk-operational-'));
try {
  const lockPath = path.join(dir,'runtime.lock');
  const a = new ProcessLock(lockPath); await a.acquire();
  const b = new ProcessLock(lockPath); let blocked=false;
  try { await b.acquire(); } catch (e) { blocked = e instanceof ProcessLockError; }
  if (!blocked) throw new Error('second process lock was not rejected');
  await a.release(); await b.acquire(); await b.release();
  const log = new OperationalJournal(path.join(dir,'ops.jsonl'));
  await log.write('info','test.begin'); await log.write('error','test.failure',{code:'E_TEST'});
  const content = await readFile(path.join(dir,'ops.jsonl'),'utf8');
  if (!content.includes('test.failure')) throw new Error('operational journal missing event');
  console.log('OPERATIONAL_HARDENING=PASS');
} finally { await rm(dir,{recursive:true,force:true}); }
