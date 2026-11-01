import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
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

  // A failed primary replacement must not consume the backup-preservation guard.
  const retryPath=join(dir,'retry-primary.json');
  const retryWriter=new FileStateStore(retryPath,{backupEverySaves:1,encoding:'json'});
  await retryWriter.save({tick:20,identity:'verified-backup'});
  await retryWriter.save({tick:21,identity:'newer-primary'});
  await writeFile(retryPath,'{broken','utf8');
  const retryReader=new FileStateStore(retryPath,{backupEverySaves:1,encoding:'json'});
  const retryRecovered=await retryReader.load();
  assert.deepEqual(retryRecovered,{tick:20,identity:'verified-backup'});
  await unlink(retryPath);
  await mkdir(retryPath);
  await assert.rejects(retryReader.save(retryRecovered), error =>
    error?.code === 'EISDIR' || error?.code === 'EPERM' || error?.code === 'EEXIST',
    'a directory at the primary path must make the replacement fail');
  const leftoverTemps=(await readdir(dir)).filter(name =>
    name.startsWith('retry-primary.json.') && name.endsWith('.tmp'));
  assert.deepEqual(leftoverTemps,[],'a failed rename must remove its temporary file');
  await rm(retryPath,{recursive:true,force:true});
  await writeFile(retryPath,'{still-broken','utf8');
  await retryReader.save(retryRecovered);
  await unlink(retryPath);
  const retryVerifier=new FileStateStore(retryPath,{encoding:'json'});
  assert.deepEqual(await retryVerifier.load(),{tick:20,identity:'verified-backup'},
    'a retry after failed replacement must still preserve the verified backup');

  console.log(JSON.stringify({pass:true,jsonBytes:(await readFile(jsonPath)).byteLength,v8Bytes:(await readFile(v8Path)).byteLength,migratedEncoding:'v8'}));
} finally { await rm(dir,{recursive:true,force:true}); }
