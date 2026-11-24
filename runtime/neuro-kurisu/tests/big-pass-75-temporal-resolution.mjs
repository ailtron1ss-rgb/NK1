import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const body={bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2};
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:128,enableTemporalResolutionGovernor:true});
await core.init();
let micro=0,pulse=0; const ids=[]; const before=core.snapshotLight().tick;
for(let i=0;i<12;i++){
  const r=await core.observeOperational({embodiment:body});
  const tr=core.temporalResolutionSnapshot();
  if(tr.lastLevel==='micro')micro++; else pulse++;
  ids.push(r.decision?.id);
}
assert.ok(micro>0,'mobile idle stream must use micro-cycles');
assert.ok(pulse>0,'mobile idle stream must periodically pulse');
const idleTick=core.snapshotLight().tick;
assert.equal(idleTick-before,12,'micro/pulse stream must preserve temporal continuity');
const tracesAfterIdle=core.snapshot().traces.length;
const ext=await core.observeOperational({text:'external signal must force a cognitive pulse',embodiment:body});
assert.equal(core.temporalResolutionSnapshot().lastLevel,'pulse','external signal must force pulse');
assert.ok(ext.decision?.id,'pulse must still produce a decision');
assert.equal(core.snapshot().traces.length,tracesAfterIdle+1,'micro-cycles must not create fake persistent decision traces');
const state=core.snapshot();
assert.ok(state.system.temporalResolution,'temporal resolution state must persist in organism state');
console.log(`BIG_PASS_75_TEMPORAL=PASS micro=${micro} pulse=${pulse} tickDelta=${idleTick-before} persisted=true traceDelta=${core.snapshot().traces.length-tracesAfterIdle}`);
