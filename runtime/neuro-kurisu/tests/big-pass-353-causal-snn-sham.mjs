import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.16,sensoryFreshness01:.74,battery01:.84,cpuLoad01:.22,ramPressure01:.20};
const cfg={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
const hist=a=>{const h=Object.fromEntries(A.map(x=>[x,0]));for(const x of a)h[x]++;const n=a.length||1;return Object.fromEntries(A.map(x=>[x,h[x]/n]));};
const l1=(a,b)=>A.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0)/2;
const contexts=[
 {name:'epistemic',epistemic:.70,autonomy:.12,maintenance:.08,social:.10,novelty:.38,uncertainty:.72},
 {name:'autonomy',epistemic:.12,autonomy:.70,maintenance:.10,social:.08,novelty:.78,uncertainty:.34},
 {name:'maintenance',epistemic:.14,autonomy:.12,maintenance:.68,social:.06,novelty:.28,uncertainty:.30},
 {name:'mixed',epistemic:.38,autonomy:.30,maintenance:.14,social:.18,novelty:.56,uncertainty:.50},
];
const reward=(action,c)=>action===(c.autonomy>.5?'explore':c.epistemic>.5?'verify':c.maintenance>.5?'rest':'reflect')?.92:.36;
async function make(initial){const c=new OrganismCore(new MemoryStateStore(initial?{initial}:undefined),cfg);await c.init();return c;}
async function train(c,n=100){for(let i=0;i<n;i++){const cxt=contexts[i%contexts.length];c.b299CausalPersonalitySetContext(cxt);const r=await c.observe({...cxt,embodiment:EMB},'operational');const a=r.decision.selected?.action??'wait';await c.feedback({reward:reward(a,cxt),success:reward(a,cxt),surprise:.08});}}
async function run(c,cxt,n=80){const sum=Object.fromEntries(A.map(x=>[x,0]));for(let i=0;i<n;i++){c.b299CausalPersonalitySetContext(cxt);const r=await c.observe({...cxt,embodiment:EMB},'operational');const cs=r.decision.candidates??[];const mx=Math.max(...cs.map(x=>x.score),0);const ws=cs.map(x=>Math.exp((x.score-mx)/.035));const z=ws.reduce((a,b)=>a+b,0)||1;cs.forEach((x,j)=>{sum[x.action]=(sum[x.action]??0)+ws[j]/z;});}return Object.fromEntries(A.map(x=>[x,(sum[x]??0)/n]));}
function shamSnapshot(snapshot){const s=structuredClone(snapshot);const syn=s.system.spikingPlasticNeuralB269.synapses.filter(x=>x.active);const n=Math.min(43,syn.length);let totalAbs=0;for(let i=0;i<n;i++){totalAbs+=Math.abs(syn[i].weight);}
  const target=0.45*Math.max(1,totalAbs/n); for(let i=0;i<n;i++){const x=syn[i];const dir=i%2===0?1:-1; x.weight=Math.max(-1,Math.min(1,x.weight+dir*target));}
  return s;
}
const trainer=await make(); await train(trainer,120); const learned=trainer.snapshot();
const results=[];
for(const cxt of contexts){
  const on=await make(learned); const onH=await run(on,cxt);
  const off=await make(learned); const lesion=off.b269SpikingNeuralApplyStructuralLesion(.90); const offH=await run(off,cxt);
  const sham=await make(shamSnapshot(learned)); const shamH=await run(sham,cxt);
  const causal=l1(onH,offH), shamShift=l1(onH,shamH);
  if(lesion.removedSynapses<250) throw new Error('structural lesion too shallow'); if(causal<.02) throw new Error('causal effect too weak');
  results.push({context:cxt.name,causalL1:causal,shamL1:shamShift,ratio:causal/Math.max(shamShift,1e-6),on:onH,off:offH,sham:shamH});
}
const mean=results.reduce((s,r)=>s+r.causalL1,0)/results.length; const meanSham=results.reduce((s,r)=>s+r.shamL1,0)/results.length;
console.log(JSON.stringify({contexts:results,meanCausalL1:mean,meanShamL1:meanSham,causalToShamRatio:mean/Math.max(meanSham,1e-6)},null,2)); assert(mean>=.05); if(!(mean>meanSham*1.5)) process.exitCode=2;
console.log(JSON.stringify({pass:true,status:'causal-across-contexts',contexts:results,meanCausalL1:mean,meanShamL1:meanSham,causalToShamRatio:mean/Math.max(meanSham,1e-6)},null,2));
