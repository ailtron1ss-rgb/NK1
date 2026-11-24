import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.16,sensoryFreshness01:.74,battery01:.84,cpuLoad01:.22,ramPressure01:.20};
const cfg={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
const hist=a=>{const h=Object.fromEntries(A.map(x=>[x,0]));for(const x of a)h[x]++;const n=a.length||1;return Object.fromEntries(A.map(x=>[x,h[x]/n]));};
const l1=(a,b)=>A.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0)/2;
const ctx=i=>i%2?{epistemic:.14,autonomy:.66,maintenance:.10,social:.10,novelty:.78,uncertainty:.42}:{epistemic:.64,autonomy:.18,maintenance:.10,social:.08,novelty:.34,uncertainty:.68};
const reward=(action,c)=>action===(c.autonomy>.5?'explore':c.epistemic>.5?'verify':'reflect')?.92:.36;
async function make(initial){const c=new OrganismCore(new MemoryStateStore(initial?{initial}:undefined),cfg);await c.init();return c;}
async function train(c,n=80){for(let i=0;i<n;i++){const x=ctx(i);c.b299CausalPersonalitySetContext(x);const r=await c.observe({...x,embodiment:EMB},'operational');const a=r.decision.selected?.action??'wait';await c.feedback({reward:reward(a,x),success:reward(a,x),surprise:.08});}}
async function run(c,n=80){const out=[];for(let i=0;i<n;i++){const x={epistemic:.55,autonomy:.25,maintenance:.12,social:.08,novelty:.63,uncertainty:.57};c.b299CausalPersonalitySetContext(x);const r=await c.observe({...x,embodiment:EMB},'operational');out.push(r.decision.selected?.action??'wait');}return out;}
const trainer=await make();await train(trainer);const snap=trainer.snapshot();
const on=await make(snap);const onH=hist(await run(on));
const off=await make(snap);const lesion=off.b269SpikingNeuralApplyStructuralLesion(.90);const offH=hist(await run(off));
const effect=l1(onH,offH);const neural=off.b269SpikingNeuralSnapshot();
assert(effect>0.02,'B269 ablation produced no meaningful action-distribution change');
assert(lesion.removedSynapses>=250,'structural lesion was not deep enough');
assert(neural.cycles>=80,'B269 did not participate in the causal holdout');
console.log(JSON.stringify({pass:true,status:effect>=.05?'causally-active-moderate':'causally-active-weak',effectL1:effect,on:onH,off:offH,lesion,neural:{cycles:neural.cycles,learningUpdates:neural.learningUpdates,activeSynapses:neural.synapses.filter(s=>s.active).length,lastPrediction01:neural.lastPrediction01}},null,2));
