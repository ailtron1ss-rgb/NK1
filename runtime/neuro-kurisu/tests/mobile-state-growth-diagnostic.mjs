import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:60000});
await core.init();
const obs={embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}};
for(let i=0;i<1000;i++) await core.observeOperational(obs);
const p=core.persisted; const f=p.facets; const sizes={
 traces:p.traces?.length,memories:p.memories?.length,goals:p.goals?.length,
 eventLog:f.memory?.eventLog?.length,autobio:f.memory?.autobiographicalMemories?.length,
 p23:f.learning?.p23?.experiences?.length,p29:f.learning?.p29?.updates?.length,p30:f.learning?.p30?.trajectories?.length,
 p38:f.learning?.p38?.proposals?.length,p39:f.learning?.p39?.sessions?.length,
 network:f.evolution?.network?.history?.length,narrative:f.evolution?.narrative?.entries?.length,
 cognitiveField:f.cognition?.cognitiveField?.pressures?.length,sources:f.cognition?.sources?.events?.length,
 p41:f.embodiment?.p41SemanticPerception?.history?.length,p37:f.embodiment?.p37?.events?.length,
 p65:f.advanced?.p65EpistemicLedger?.beliefs?.length,p70:f.advanced?.p70MemoryLifecycleGovernor?.history?.length,
 continuumNodes:f.advanced?.experienceContinuum?.graphNodes?.length,continuumEdges:f.advanced?.experienceContinuum?.graphEdges?.length,
 continuumClusters:f.advanced?.experienceContinuum?.clusters?.length,
}; console.log(JSON.stringify(sizes,null,2));
