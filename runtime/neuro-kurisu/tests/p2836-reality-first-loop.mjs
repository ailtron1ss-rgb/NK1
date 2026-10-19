import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RealityGroundingController } from '../src/organism/system/RealityGroundingController.ts';
import { NeuralCausalTraceLedger } from '../src/organism/system/NeuralCausalTraceLedger.ts';
import { P2820SelfKnowledgeCoresetBridge } from '../src/organism/cognition/P2820SelfKnowledgeCoresetBridge.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));

const fakeEmbodied={
  version:1, action:'explore', status:'executed', realityClass:'device-observation', source:'android-termux', at:Date.now(),
  before:{battery01:.9,thermal01:.1,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  after:{battery01:.9,thermal01:.1,cognitiveCapacity01:.9,awake:true,source:'android-termux'},
  stateDelta:{battery01:0,thermal01:0,cognitiveCapacity01:0,awakeChanged:false},
  effect01:.7, reason:'test', capability:'android.sensors', consequenceVerification:{attempted:true,independent:true,verified:true,sourceStable:true,freshBefore01:1,freshAfter01:1,changed01:.35,reason:'test-independent',verificationMode:'independent-observation'}
};

const controller=new RealityGroundingController();
controller.setMode('external-first');
const external=controller.resolve({tick:1,action:'explore',expectedReward01:.55,predictionConfidence01:.7,simulatedReward01:.2,simulatedSurprise01:.4,simulatedSuccess01:.8,embodiedAction:fakeEmbodied,novelty01:.6,resource01:.8});
if(external.source!=='external' || external.verified01!==1 || external.independent01!==1 || !controller.snapshot().externalPrimary) throw new Error(`external grounding failed: ${JSON.stringify(external)}`);
const unavailable=controller.resolve({tick:2,action:'explore',expectedReward01:.55,predictionConfidence01:.7,simulatedReward01:.2,simulatedSurprise01:.4,simulatedSuccess01:.8,embodiedAction:{...fakeEmbodied,status:'unavailable',source:'node-host',realityClass:'derived'},novelty01:.3,resource01:.8});
if(unavailable.source!=='simulation') throw new Error('safe simulation fallback failed');

const replayBridge=new P2820SelfKnowledgeCoresetBridge();
for(let tick=1;tick<=8;tick++) replayBridge.observeOutcome({tick,contextId:tick%4,action:tick%2?'explore':'respond',reward01:.55+(tick%3)*.08,predictionError01:tick%3===0?.72:.24,novelty01:tick%4===0?.8:.25,verified01:tick%3===0?.5:1,uncertainty01:.35,latent:Array.from({length:8},(_,i)=>Math.sin(tick+i))});
const replayAllocation=replayBridge.replayAllocation({resource01:.7,predictionError01:.62,novelty01:.71,grounding01:.58,transferRisk01:.15,contextMatch01:.8});
if(replayBridge.snapshot().replayAllocationCount!==1 || replayAllocation.fastBudget<1 || replayAllocation.slowBudget<1) throw new Error('P2820 adaptive replay thermostat failed');

const ledger=new NeuralCausalTraceLedger();
const before={learningUpdates:2,replayUpdates:1,predictionError01:.6,plasticity01:.2,recurrentCoherence01:.4,neuralConfidence01:.4,groundingReliability01:.3};
const after={learningUpdates:4,replayUpdates:3,predictionError01:.35,plasticity01:.28,recurrentCoherence01:.52,neuralConfidence01:.56,groundingReliability01:.72};
const trace=ledger.record({tick:1,action:'explore',reward01:.8,external01:true,verified01:1,independent01:1,evidence01:.9,before,after});
if(!(trace.causalLink01>.4) || trace.ablationRequired!==true || ledger.snapshot().traces!==1) throw new Error('neural causal ledger failed');

const dir=await mkdtemp(join(tmpdir(),'neuro-p2836-'));
const runtime=new OrganismRuntime({
  stateFile:join(dir,'state.json'), worldStateFile:join(dir,'world.json'),
  autoRun:false, enableLanguage:false, performanceProfile:'mobile', realityMode:'external-first', intervalMs:60000,
});
await runtime.init();
const result=await runtime.autonomousStep();
const ground=runtime.realityGroundingSnapshot();
const neural=runtime.neuralCausalTraceSnapshot();
if(ground.steps<1 || neural.traces<1) throw new Error(`runtime integration counters failed: ground=${JSON.stringify(ground)} neural=${JSON.stringify(neural)}`);
const sys=runtime.core.systemSnapshot();
if(!sys.realityGrounding || !sys.neuralCausalTrace) throw new Error('P2836 state was not persisted into core system snapshot');
await runtime.stop();
await rm(dir,{recursive:true,force:true});
console.log(`P2836_REALITY_FIRST=PASS runtimeStep=${result.cycle.state.tick} source=${ground.last?.source} traces=${neural.traces} grounding=${clamp(ground.meanGrounding01).toFixed(3)}`);
