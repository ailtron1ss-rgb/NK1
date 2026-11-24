import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:600000,checkpointMaxDirtyCycles:256});
await core.init();
const neb=core.neuralExperienceBranch;
const b269=core.spikingPlasticNeuralB269;
const wrap=(obj,name)=>{
  const original=obj[name].bind(obj);
  let calls=0;
  obj[name]=(...args)=>{calls++;return original(...args);};
  return ()=>calls;
};
const nebCalls=wrap(neb,'snapshot');
const b269Calls=wrap(b269,'snapshot');
await core.observe({novelty:.31,surprise:.08,embodiment:{bodyEnergy01:.86,cognitiveCapacity01:.86,thermalStrain01:.18,battery01:.84,cpuLoad01:.20,ramPressure01:.18,sensoryFreshness01:.84,awake:true}});
const afterObserve={neb:nebCalls(),b269:b269Calls()};
await core.flush();
const afterFlush={neb:nebCalls(),b269:b269Calls()};
const persisted=core.persisted;
const pass=afterObserve.neb===0 && afterFlush.neb===1 && afterFlush.b269===afterObserve.b269+1
  && Boolean(persisted?.system?.neuralExperienceBranch) && Boolean(persisted?.system?.spikingPlasticNeuralB269);
console.log(JSON.stringify({PASS:pass,afterObserve,afterFlush,persistedNeural:!!persisted?.system?.neuralExperienceBranch,persistedB269:!!persisted?.system?.spikingPlasticNeuralB269},null,2));
if(!pass) process.exit(1);
