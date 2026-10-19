import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cfg={performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000};
const core=new OrganismCore(new MemoryStateStore(),cfg); await core.init();
const obs={embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.86,thermalStrain01:.18,sensoryFreshness01:.88,awake:true,battery01:.82,cpuLoad01:.22,ramPressure01:.2}};
let selected=[];
for(let i=0;i<1;i++){
  const r=await core.observeOperational({...obs,surprise:i%4===0?.50:.12,novelty:i%5===0?.62:.20});
  selected.push(r.decision?.selected?.action??null);
  await core.feedback({reward:i<10?.72:.18,surprise:i<10?.12:.72,notes:'b347-predictive-calibration'});
}
const d=core.b299CausalPersonalityDiagnostics();
const p=d.dominantPhenotype;
assert.ok(p);
assert.ok(p.samples>=1);
assert.ok(p.calibrationCount>=1);
assert.ok(Number.isFinite(p.calibrationErrorEMA01));
console.log('B347_CORE_PREDICTIVE_CALIBRATION=PASS',JSON.stringify({cycles:1,selected:selected,dominant:{action:p.action,samples:p.samples,calibrationCount:p.calibrationCount,calibrationErrorEMA01:Number(p.calibrationErrorEMA01.toFixed(4)),calibrationBias11:Number(p.calibrationBias11.toFixed(4)),lastPredictedReward01:Number(p.lastPredictedReward01.toFixed(4))}}));
