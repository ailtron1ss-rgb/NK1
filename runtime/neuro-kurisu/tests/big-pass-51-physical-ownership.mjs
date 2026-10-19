import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nk-p51-'));
const store = new FileStateStore(path.join(dir, 'state.json'));
const core = new OrganismCore(store, { autoPersist:false, cycleResultMode:'operational' });
await core.init();

const manifest = core.cognitiveSubsystemManifest();
const ownership = Object.fromEntries(manifest.map(x=>[x.name,x.ownership]));
assert.equal(ownership.self, 'physical');
assert.equal(ownership.governance, 'physical');
assert.equal(typeof core.selfSubsystemSnapshot().identityContinuity, 'object');
assert.equal(typeof core.governanceSubsystemSnapshot().capabilities, 'object');

const before = core.selfSubsystemSnapshot();
await core.observe({ text:'BIG PASS 51 ownership test' }, 'operational');
const after = core.selfSubsystemSnapshot();
assert.equal(typeof after.p31, 'object');
assert.equal(typeof after.p80, 'object');
assert.ok(after.p31 && before.p31);

console.log('BIG_PASS_51_PHYSICAL_OWNERSHIP=PASS');
