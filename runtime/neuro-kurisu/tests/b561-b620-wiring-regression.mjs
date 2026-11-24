import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
const r=await core.observe({text:'wiring regression verify strategy and meta cognitive path',novelty:.91,uncertainty:.88,reward:.72,success:.76,surprise:.83,embodiment:{awake:true,bodyEnergy01:.82,cognitiveCapacity01:.74,thermalStrain01:.14,sensoryFreshness01:.86,battery01:.81,cpuLoad01:.24,ramPressure01:.2}},'operational');
const d=core.b561B620Diagnostics(); assert(d.decisions>0); assert(d.lastGain01>0); assert(['recall','plan','reflect','experiment','skill-transfer','identity','stabilize'].includes(d.lastStrategy));
assert(r && r.decision && r.decision.selected && r.decision.selected.action);
console.log(JSON.stringify({pass:true,status:'B561_B620_WIRING_PASS',strategy:d.lastStrategy,mode:d.lastMode,computeBudget01:d.lastCompute01,metaEntropy01:d.lastEntropy01,gain01:d.lastGain01,selectedAction:r.decision.selected.action},null,2));
