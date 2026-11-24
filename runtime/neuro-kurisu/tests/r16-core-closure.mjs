import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:4});
await core.init();
for(let i=0;i<6;i++) await core.observe({text:`R16 closure observation ${i}`,novelty:.4});
await core.flush();
const snap=core.snapshot(); assert.ok(snap.state.tick>=6); assert.ok(core.memorySnapshot());
console.log(JSON.stringify({pass:true,tick:snap.state.tick},null,2));
