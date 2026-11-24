import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.16,sensoryFreshness01:.74,battery01:.84,cpuLoad01:.22,ramPressure01:.20};
const cfg={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
const c=new OrganismCore(new MemoryStateStore(),cfg); await c.init();
const t0=Date.now(); let lastAction=null; let restarts=0;
for(let i=0;i<1000;i++){
  const r=await c.observe({novelty:.25+((i%11)/20),uncertainty:.30+((i%7)/18),embodiment:EMB},'operational');
  lastAction=r.decision.selected?.action??'wait';
  await c.feedback({reward:lastAction==='explore'?.82:lastAction==='verify'?.74:.46,success:lastAction==='explore'?.82:lastAction==='verify'?.74:.46,surprise:.12});
  if(i===499){ const snap=c.snapshot(); const r2=new OrganismCore(new MemoryStateStore({initial:snap}),cfg); await r2.init(); assert.equal(r2.snapshot().state.tick,snap.state.tick); assert.equal(r2.b269SpikingNeuralSnapshot().cycles,c.b269SpikingNeuralSnapshot().cycles); restarts++; }
}
const elapsed=Date.now()-t0; const snap=c.snapshot(); const diag=c.b269SpikingNeuralDiagnostics(); const neural=c.b269SpikingNeuralSnapshot();
assert.equal(snap.state.tick,1000); assert.equal(restarts,1); assert(neural.cycles>=1000); assert(neural.learningUpdates>=1000);
console.log(JSON.stringify({pass:true,cycles:snap.state.tick,elapsedMs:elapsed,avgMsPerCycle:elapsed/1000,lastAction,restarts,b269Cycles:neural.cycles,b269LearningUpdates:neural.learningUpdates,activeSynapses:diag.activeSynapses},null,2));
