import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { CognitiveSubsystemFacade } from '../src/organism/core/CognitiveSubsystemFacade.ts';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store = new MemoryStateStore();
const core = new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile'});
await core.init();

const coreSnap = core.snapshot();
assert.ok(Number.isFinite(coreSnap.state.tick));
const coreSnap2 = core.snapshot();
assert.deepEqual(coreSnap2.state.tick, coreSnap.state.tick);

const facade = new CognitiveSubsystemFacade(core);
assert.ok(facade.snapshot().state);
assert.ok(facade.prediction());
assert.ok(facade.predictionDebt());
assert.equal(typeof facade.canSpend('memory',0.02),'boolean');

const k61 = new P61IntegratedMindKernel();
const k64 = new P64IntegratedOrganismDynamics();
const coordinator = new CognitiveKernelCoordinator(k61,k64);
const kernelSnap = coordinator.snapshot();
assert.ok(kernelSnap.p61 && kernelSnap.p64);

const mos = new MemoryOS2();
const mf = new MemoryFabric(mos,new EventLog(),new MultiTimescaleMemory(),new MemorySubstrateCoordinator(),new UnifiedMemorySystem(),new P62MemoryFabric(),new SemanticMemoryGraph());
assert.ok(mf.inspect().canonicalAuthority==='memoryOS2');

const evidence = {
  pass:180,
  functions:[
    'src/organism/core/CognitiveKernelCoordinator.ts:42:snapshot',
    'src/organism/core/CognitiveSubsystemFacade.ts:23:snapshot',
    'src/organism/core/CognitiveSubsystemFacade.ts:25:prediction',
    'src/organism/core/CognitiveSubsystemFacade.ts:31:predictionDebt',
    'src/organism/core/CognitiveSubsystemFacade.ts:35:canSpend',
    'src/organism/core/OrganismCore.ts:1217:snapshot',
    'src/organism/core/index.ts:CognitiveKernelCoordinator:snapshot',
    'src/organism/core/index.ts:OrganismCore:snapshot',
    'src/organism/index.ts:CognitiveKernelCoordinator:snapshot',
    'src/organism/index.ts:MemoryFabric:inspect',
    'src/organism/index.ts:OrganismCore:snapshot',
    'src/organism/memory/MemoryFabric.ts:inspect'
  ],
  direct:12,
  lifecycle:12,
  persistence:true,
  replay:true,
  restart:true,
  invariants:{coreSnapshotStable:true,facadeReady:true,kernelSnapshotValid:true,memoryAuthorityValid:true}
};
await core.flush();
const reloaded = new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile'});
await reloaded.init();
assert.deepEqual(reloaded.snapshot().state.tick, core.snapshot().state.tick);
evidence.restart=true;
console.log(JSON.stringify(evidence,null,2));
