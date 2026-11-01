import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { deserialize } from 'node:v8';

const dir=await mkdtemp(join(tmpdir(),'neuro-pass17-'));
const jsonPath=join(dir,'state.json');
const v8Path=join(dir,'state-v8.bin');
try {
  const jsonValue={tick:17, values:[1,2,3], nested:{ok:true}};
  const rich={tick:17, values:[1,2,3], map:new Map([['x',42]]), set:new Set(['a','b']), nested:{ok:true,undef:undefined}};
  const jsonStore=new FileStateStore(jsonPath,{backupEverySaves:99,encoding:'json'});
  await jsonStore.save(jsonValue);
  const jsonLoaded=await jsonStore.load();
  assert.equal(jsonLoaded?.tick,17);
  assert.deepEqual(jsonLoaded?.values,[1,2,3]);
  assert.equal(jsonLoaded?.nested?.ok,true);

  const v8Store=new FileStateStore(v8Path,{backupEverySaves:99,encoding:'v8'});
  await v8Store.save(rich);
  const raw=await readFile(v8Path);
  assert.doesNotThrow(()=>deserialize(raw));
  const v8Loaded=await v8Store.load();
  assert.equal(v8Loaded?.tick,17);
  assert.equal(v8Loaded?.map.get('x'),42);
  assert.equal(v8Loaded?.set.has('a'),true);
  assert.equal(v8Loaded?.nested.undef,undefined);

  const migrateStore=new FileStateStore(jsonPath,{backupEverySaves:99,encoding:'v8'});
  const migrated=await migrateStore.load();
  assert.equal(migrated?.tick,17);
  await migrateStore.save({...migrated,tick:18});
  const migratedRaw=await readFile(jsonPath);
  assert.doesNotThrow(()=>deserialize(migratedRaw));
  assert.equal((await migrateStore.load())?.tick,18);
  // A missing primary file must still recover the last verified backup.
  const recoveryPath=join(dir,'recoverable-state.json');
  const recoveryWriter=new FileStateStore(recoveryPath,{backupEverySaves:1,encoding:'json'});
  await recoveryWriter.save({tick:1,identity:'last-good'});
  await recoveryWriter.save({tick:2,identity:'newer-primary'});
  await unlink(recoveryPath);
  const recoveryReader=new FileStateStore(recoveryPath,{backupEverySaves:1,encoding:'json'});
  const recovered=await recoveryReader.load();
  assert.deepEqual(recovered,{tick:1,identity:'last-good'},'missing primary must restore the last durable backup instead of reporting an empty organism');
  await recoveryReader.save(recovered);
  assert.deepEqual(JSON.parse(await readFile(recoveryPath,'utf8')),{tick:1,identity:'last-good'},'a recovered snapshot must be able to recreate the missing primary');
  const emptyReader=new FileStateStore(join(dir,'never-created.json'),{encoding:'json'});
  assert.equal(await emptyReader.load(),null,'a genuinely new store with no primary or backup remains empty');

  // A corrupt primary must not overwrite the only verified backup during repair.
  const corruptPath=join(dir,'corrupt-primary.json');
  const corruptWriter=new FileStateStore(corruptPath,{backupEverySaves:1,encoding:'json'});
  await corruptWriter.save({tick:10,identity:'verified-backup'});
  await corruptWriter.save({tick:11,identity:'new-primary'});
  await writeFile(corruptPath,'{broken','utf8');
  const corruptReader=new FileStateStore(corruptPath,{backupEverySaves:1,encoding:'json'});
  const recoveredCorrupt=await corruptReader.load();
  assert.deepEqual(recoveredCorrupt,{tick:10,identity:'verified-backup'});
  await corruptReader.save(recoveredCorrupt);
  await unlink(corruptPath);
  const secondRecovery=new FileStateStore(corruptPath,{encoding:'json'});
  assert.deepEqual(await secondRecovery.load(),{tick:10,identity:'verified-backup'},'repair must preserve the verified backup instead of rotating corrupt bytes over it');

  // A process crash after backup-temp fsync must not truncate the last good backup.
  const crashPath=join(dir,'backup-crash.json');
  const crashWriter=new FileStateStore(crashPath,{backupEverySaves:1,encoding:'json'});
  await crashWriter.save({tick:1,identity:'previous-known-good-backup'});
  await crashWriter.save({tick:2,identity:'current-primary'});
  const storeModuleUrl=new URL('../src/organism/persistence/FileStateStore.ts',import.meta.url).href;
  const childSource=`import { FileStateStore } from ${JSON.stringify(storeModuleUrl)};
const store = new FileStateStore(${JSON.stringify(crashPath)},{backupEverySaves:1,encoding:'json'});
await store.save({tick:3,identity:'interrupted-next-primary'});`;
  const interrupted=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',childSource],{
    env:{...process.env,NEURO_CRASH_INJECT:'after-backup-file-fsync'},
    encoding:'utf8',timeout:10000,maxBuffer:1024*1024,
  });
  assert.equal(interrupted.signal,'SIGKILL','the child must stop at the backup-temp fsync crash point');
  assert.deepEqual(JSON.parse(await readFile(crashPath,'utf8')),{tick:2,identity:'current-primary'});
  assert.deepEqual(JSON.parse(await readFile(crashPath+'.bak','utf8')),{tick:1,identity:'previous-known-good-backup'},'an interrupted backup copy must leave the previous backup intact');
  // Strict mode must surface directory-fsync failure instead of reporting a durable save.
  const strictDirectoryPath=join(dir,'strict-directory-fsync.json');
  const strictDirectoryStore=new FileStateStore(strictDirectoryPath,{
    backupEverySaves:99,encoding:'json',strictDirectoryFsync:true,
  });
  strictDirectoryStore.syncParentDirectory=async()=>{ throw new Error('injected-directory-fsync-failure'); };
  await assert.rejects(
    strictDirectoryStore.save({tick:1,identity:'directory-sync-required'}),
    /directory-fsync-required:injected-directory-fsync-failure/,
    'strict directory fsync must fail closed when directory durability cannot be confirmed',
  );
  assert.deepEqual(JSON.parse(await readFile(strictDirectoryPath,'utf8')),{tick:1,identity:'directory-sync-required'},
    'the rename can already be visible even though strict durability confirmation failed');
  assert.equal(strictDirectoryStore.metrics().saves,0,
    'strict failure must not be accounted as a successful durable save');

  // In strict mode, the backup rename must be directory-synced before primary is replaced.
  const strictBackupPath=join(dir,'strict-backup-order.json');
  const strictBackupStore=new FileStateStore(strictBackupPath,{
    backupEverySaves:1,encoding:'json',strictDirectoryFsync:true,
  });
  const realStrictDirectorySync=strictBackupStore.syncParentDirectory.bind(strictBackupStore);
  let strictDirectorySyncCalls=0;
  strictBackupStore.syncParentDirectory=async()=>{
    strictDirectorySyncCalls+=1;
    await realStrictDirectorySync();
  };
  await strictBackupStore.save({tick:1,identity:'durable-before-rotation'});
  assert.equal(strictDirectorySyncCalls,1,'the initial primary rename must be directory-synced');
  await strictBackupStore.save({tick:2,identity:'new-primary'});
  assert.equal(strictDirectorySyncCalls,3,
    'backup rename and subsequent primary rename must each be directory-synced in strict mode');
  assert.deepEqual(JSON.parse(await readFile(strictBackupPath,'utf8')),{tick:2,identity:'new-primary'});
  assert.deepEqual(JSON.parse(await readFile(strictBackupPath+'.bak','utf8')),{tick:1,identity:'durable-before-rotation'});

  // Non-strict mode remains best-effort for filesystems that reject directory fsync.
  const bestEffortPath=join(dir,'best-effort-directory-fsync.json');
  const bestEffortStore=new FileStateStore(bestEffortPath,{
    backupEverySaves:99,encoding:'json',strictDirectoryFsync:false,directoryFsyncEverySaves:1,
  });
  bestEffortStore.syncParentDirectory=async()=>{ throw new Error('injected-directory-fsync-unsupported'); };
  await bestEffortStore.save({tick:2,identity:'best-effort'});
  assert.deepEqual(JSON.parse(await readFile(bestEffortPath,'utf8')),{tick:2,identity:'best-effort'});

  console.log(JSON.stringify({pass:true,backupAtomicCrash:true,jsonBytes:(await readFile(jsonPath)).byteLength,v8Bytes:(await readFile(v8Path)).byteLength,migratedEncoding:'v8'}));
} finally { await rm(dir,{recursive:true,force:true}); }
