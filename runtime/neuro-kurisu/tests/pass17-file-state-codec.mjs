import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  console.log(JSON.stringify({pass:true,jsonBytes:(await readFile(jsonPath)).byteLength,v8Bytes:(await readFile(v8Path)).byteLength,migratedEncoding:'v8'}));
} finally { await rm(dir,{recursive:true,force:true}); }
