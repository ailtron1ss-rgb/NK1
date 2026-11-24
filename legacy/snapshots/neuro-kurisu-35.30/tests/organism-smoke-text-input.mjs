import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';
const r=new OrganismRuntime({stateFile:'/tmp/nk-text-smoke.json',worldStateFile:'/tmp/nk-text-world.json',enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal(),performanceProfile:'mobile'});
await r.init();
for(let i=0;i<6;i++){const out=await r.step('Проверь неизвестное и действуй осторожно.');assert.ok(out.cycle?.decision?.selected,'missing decision');}
const s=r.core.smokeSnapshotSummary();
assert.ok(s.tick>=6,'text smoke tick failed');
r.stop();
console.log('TEXT_INPUT_SMOKE=PASS',JSON.stringify(s));
