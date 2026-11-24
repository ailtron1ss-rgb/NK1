import assert from 'node:assert/strict';
import { buildCognitiveFrame } from '../src/organism/core/CognitiveFrame.ts';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';
import { CognitiveSpineScheduler } from '../src/organism/system/CognitiveSpineScheduler.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const state={
  version:92,tick:7,at:1000,
  needs:{energy:.8,cognitiveLoad:.2,uncertainty:.5,socialNeed:.2,novelty:.4,identityCoherence:.9,goalPressure:.25},
  predictionError:.3,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.3,selfPredictionError:.2,predictedNextAction:'wait',lastPredictionConfidence:.6,worldContextVersion:1,
};
const quiet=buildCognitiveFrame(state,{});
const sensory=buildCognitiveFrame(state,{text:'hello',vision:{features:[1,2],confidence01:.8,sceneLabel:'room'},audio:{samples:[0,.1,-.1],events:[]},embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.8,thermalStrain01:.1,sensoryFreshness01:.9,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2}});
assert.equal(quiet.externalInput,false);
assert.equal(sensory.externalInput,true);
assert.ok((sensory.signalMask & 1)!==0 && (sensory.signalMask & 2)!==0 && (sensory.signalMask & 4)!==0);
assert.ok(sensory.expectedInformationGain01>quiet.expectedInformationGain01);

const spine=new CognitiveSpineScheduler();
const planner=new CognitiveExecutionPlanner();
const decision=spine.decide({tick:sensory.tick,surprise01:sensory.surprise01,predictionError01:sensory.predictionError01,novelty01:sensory.novelty01,goalPressure01:sensory.goalPressure01,budgetMode:'balanced',remainingBudget01:.86,externalInput:sensory.externalInput,awake:true});
const plan=planner.compile(sensory,decision,.86);
assert.equal(plan.run.perception,true);
assert.equal(plan.run.memory,true);
assert.equal(plan.run['world-rollout'], false, 'warm rollout should be gated when value/cadence are low');
assert.ok(planner.snapshot().stats.perception.opportunities===1);
// Strong prediction error + goal pressure must recover deep cognition.
const urgent=buildCognitiveFrame({...state,predictionError:.9,needs:{...state.needs,goalPressure:.9,uncertainty:.8,novelty:.8}},{text:'urgent'});
const urgentDecision=spine.decide({tick:urgent.tick,surprise01:.9,predictionError01:urgent.predictionError01,novelty01:urgent.novelty01,goalPressure01:urgent.goalPressure01,budgetMode:'balanced',remainingBudget01:.86,externalInput:true,awake:true});
const urgentPlan=planner.compile(urgent,urgentDecision,.86);
assert.equal(urgentPlan.run['world-rollout'],true);
assert.equal(urgentPlan.run.shadow,true);

const constrained=buildCognitiveFrame(state,{embodiment:{bodyEnergy01:.12,cognitiveCapacity01:.15,thermalStrain01:.84,sensoryFreshness01:.4,awake:true,battery01:.12,cpuLoad01:.9,ramPressure01:.9}});
const constrainedDecision=spine.decide({tick:constrained.tick,surprise01:constrained.surprise01,predictionError01:constrained.predictionError01,novelty01:constrained.novelty01,goalPressure01:constrained.goalPressure01,budgetMode:'balanced',remainingBudget01:.18,externalInput:true,awake:true});
const protectedPlan=planner.compile(constrained,constrainedDecision,.18);
assert.equal(protectedPlan.run['slow-cognition'],false);
assert.equal(protectedPlan.run.research,false);

const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000});
await core.init();
const first=await core.observeOperational({text:'test',embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.84,thermalStrain01:.16,sensoryFreshness01:.86,awake:true,battery01:.82,cpuLoad01:.2,ramPressure01:.18}});
const exec=core.cognitiveExecutionPlanSnapshot();
assert.equal(exec.version,1);
assert.equal(exec.tick,core.snapshot().state.tick);
assert.ok(exec.stats.perception.opportunities>=1);
await core.flush();
const restored=new OrganismCore(new MemoryStateStore(core.snapshot()),{cycleResultMode:'operational',checkpointMinIntervalMs:60000});
await restored.init();
assert.equal(restored.cognitiveExecutionPlanSnapshot().version,1);
const toolResult=await core.executeTool('organism.inspect',{},'verification-contract-test');
assert.equal(toolResult.ok,true);
assert.equal(toolResult.verified,true);
assert.equal(toolResult.audit.verificationBasis,'tool-contract');
core.registerActionTool({id:'test.ok-only',capability:'test.read',destructive:false,projectAllowed:true,execute:async()=>({ok:true})});
const weakTool=await core.executeTool('test.ok-only',{},'verification-contract-negative');
assert.equal(weakTool.ok,true);
assert.equal(weakTool.verified,false);
assert.equal(weakTool.audit.verificationBasis,'none');
console.log(`BIG_PASS_50_COGNITIVE_EXECUTION=PASS tick=${exec.tick} savings01=${planner.cumulativeSavings01().toFixed(3)} perceptionRuns=${exec.stats.perception.runs}`);
