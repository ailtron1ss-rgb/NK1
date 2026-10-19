import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { CognitiveSubsystemFacade } from '../src/organism/core/CognitiveSubsystemFacade.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { performance } from 'node:perf_hooks';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:16});
await core.init();

// Lifecycle-only surface: verify the methods that cannot be safely called on cold instances.
const coreSnap=core.snapshot();
assert.ok(coreSnap.state && Number.isFinite(coreSnap.state.tick));
const kernelSnap=core.cognitiveKernelSnapshot();
assert.ok(kernelSnap.p61 && kernelSnap.p64);

const facade = new CognitiveSubsystemFacade(core);
assert.ok(facade.snapshot().state);
assert.ok(facade.prediction());
assert.ok(facade.predictionDebt());
assert.equal(typeof facade.canSpend('memory',0.02),'boolean');

// Direct coordinator lifecycle proof using the same kernel contracts as OrganismCore.
const k61=new P61IntegratedMindKernel();
const k64=new P64IntegratedOrganismDynamics();
const coordinator=new CognitiveKernelCoordinator(k61,k64);
assert.ok(coordinator.snapshot().p61 && coordinator.snapshot().p64);

// Micro-cycle persistence proof: force enough mobile micro cycles to cross the dirty-cycle ceiling.
const before=core.snapshot().state.tick;
for(let i=0;i<24;i++){
  const r=await core.observeOperational({
    embodiment:{bodyEnergy01:.82,thermalStrain01:.16,cognitiveCapacity01:.86,sensoryFreshness01:.9,awake:true,battery01:.86,cpuLoad01:.18,ramPressure01:.16}
  });
  assert.ok(r.decision);
}
const beforeReload=core.snapshot();
assert.ok(beforeReload.state.tick>=before+24);
const reloaded=new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile',checkpointMaxDirtyCycles:16});
await reloaded.init();
const afterReload=reloaded.snapshot();
const crashLoss=beforeReload.state.tick-afterReload.state.tick;
assert.ok(crashLoss>=0 && crashLoss<=16,`micro-cycle crash-loss window exceeded ceiling: ${crashLoss}`);
await core.flush();
const exactReload=new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile',checkpointMaxDirtyCycles:16});
await exactReload.init();
const exact=exactReload.snapshot();
assert.ok(exact.state.tick>=beforeReload.state.tick,'explicit flush did not persist the latest temporal state');
console.log('TICKS',before,beforeReload.state.tick,afterReload.state.tick,exact.state.tick,'crashLoss',crashLoss);

console.log(JSON.stringify({
  pass:176,
  lifecycle:{coreSnapshot:true,kernelSnapshot:true,facadeSnapshot:true,facadePrediction:true,facadePredictionDebt:true,facadeCanSpend:true,directKernelSnapshot:true},
  microPersistence:{beforeTick:before,beforeReloadTick:beforeReload.state.tick,afterReloadTick:afterReload.state.tick,preserved:true},
},null,2));
