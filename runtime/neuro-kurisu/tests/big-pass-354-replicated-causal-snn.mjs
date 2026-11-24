import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.16,sensoryFreshness01:.74,battery01:.84,cpuLoad01:.22,ramPressure01:.20};
const cfg={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:true,enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
const contexts=[
  {name:'epistemic',epistemic:.70,autonomy:.12,maintenance:.08,social:.10,novelty:.38,uncertainty:.72},
  {name:'autonomy',epistemic:.12,autonomy:.70,maintenance:.10,social:.08,novelty:.78,uncertainty:.34},
  {name:'maintenance',epistemic:.14,autonomy:.12,maintenance:.68,social:.06,novelty:.28,uncertainty:.30},
  {name:'mixed',epistemic:.38,autonomy:.30,maintenance:.14,social:.18,novelty:.56,uncertainty:.50},
];
const l1=(a,b)=>A.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0)/2;
const reward=(action,c)=>action===(c.autonomy>.5?'explore':c.epistemic>.5?'verify':c.maintenance>.5?'rest':'reflect')?.92:.36;
const seeded=(seed)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return x>>>0;};
const jitter=(seed,i,scale)=>(((seeded(seed+i*97)/0xffffffff)*2)-1)*scale;

async function make(initial){const c=new OrganismCore(new MemoryStateStore(initial?{initial}:undefined),cfg);await c.init();return c;}
async function train(c,seed,n=96){
  const order=[0,1,2,3].sort((a,b)=>(((seed+a*17)%11)-((seed+b*17)%11)));
  for(let i=0;i<n;i++){
    const base=contexts[order[i%4]];
    const cxt={...base,novelty:Math.max(0,Math.min(1,base.novelty+jitter(seed,i,.035))),uncertainty:Math.max(0,Math.min(1,base.uncertainty+jitter(seed+31,i,.03)))};
    c.b299CausalPersonalitySetContext(cxt);
    const r=await c.observe({...cxt,embodiment:EMB},'operational');
    const a=r.decision.selected?.action??'wait';
    await c.feedback({reward:reward(a,cxt),success:reward(a,cxt),surprise:.08});
  }
}
async function runDistribution(c,cxt,n=80){
  const sum=Object.fromEntries(A.map(x=>[x,0]));
  for(let i=0;i<n;i++){
    c.b299CausalPersonalitySetContext(cxt);
    const r=await c.observe({...cxt,embodiment:EMB},'operational');
    const cs=r.decision.candidates??[]; const mx=Math.max(...cs.map(x=>x.score),0);
    const ws=cs.map(x=>Math.exp((x.score-mx)/.035)); const z=ws.reduce((a,b)=>a+b,0)||1;
    cs.forEach((x,j)=>{sum[x.action]=(sum[x.action]??0)+ws[j]/z;});
  }
  return Object.fromEntries(A.map(x=>[x,(sum[x]??0)/n]));
}
async function runWithRestart(c,cxt){
  const before=await runDistribution(c,cxt,20);
  const mid=c.snapshot();
  const restarted=await make(mid);
  const after=await runDistribution(restarted,cxt,60);
  const continuity=l1(before,after);
  const neural=restarted.b269SpikingNeuralSnapshot();
  return {distribution:after,continuityL1:continuity,neural};
}
function shamSnapshot(snapshot){
  const s=structuredClone(snapshot); const syn=s.system.spikingPlasticNeuralB269.synapses.filter(x=>x.active);
  const n=Math.min(43,syn.length); let totalAbs=0; for(let i=0;i<n;i++) totalAbs+=Math.abs(syn[i].weight);
  const target=.45*Math.max(1,totalAbs/n);
  for(let i=0;i<n;i++){const x=syn[i];const dir=i%2===0?1:-1;x.weight=Math.max(-1,Math.min(1,x.weight+dir*target));}
  return s;
}

const seeds=[101,202,303,404,505];
const seedResults=[];
for(const seed of seeds){
  const trainer=await make(); await train(trainer,seed); const learned=trainer.snapshot();
  const contextsResult=[];
  for(const cxt of contexts){
    const on=await make(learned); const onRun=await runWithRestart(on,cxt);
    const off=await make(learned); const lesion=off.b269SpikingNeuralApplyStructuralLesion(.90); const offRun=await runWithRestart(off,cxt);
    const sham=await make(shamSnapshot(learned)); const shamRun=await runWithRestart(sham,cxt);
    const causal=l1(onRun.distribution,offRun.distribution); const shamShift=l1(onRun.distribution,shamRun.distribution);
    contextsResult.push({context:cxt.name,causalL1:causal,shamL1:shamShift,ratio:causal/Math.max(shamShift,1e-6),restartContinuityL1:onRun.continuityL1,lesionPersisted:offRun.neural.synapses.filter(s=>s.active).length<learned.system.spikingPlasticNeuralB269.synapses.filter(s=>s.active).length,neuralCyclesDelta:offRun.neural.cycles-learned.system.spikingPlasticNeuralB269.cycles});
  }
  const mean=contextsResult.reduce((s,r)=>s+r.causalL1,0)/contextsResult.length;
  const meanSham=contextsResult.reduce((s,r)=>s+r.shamL1,0)/contextsResult.length;
  const contextPasses=contextsResult.filter(r=>r.causalL1>=.04 && r.ratio>=1.5 && r.lesionPersisted && r.neuralCyclesDelta>=50).length;
  seedResults.push({seed,meanCausalL1:mean,meanShamL1:meanSham,ratio:mean/Math.max(meanSham,1e-6),contextPasses,contexts:contextsResult});
}
const replicatedSeeds=seedResults.filter(r=>r.meanCausalL1>=.05 && r.ratio>=2 && r.contextPasses===4).length;
const globalMean=seedResults.reduce((s,r)=>s+r.meanCausalL1,0)/seedResults.length;
const globalSham=seedResults.reduce((s,r)=>s+r.meanShamL1,0)/seedResults.length;
const globalRatio=globalMean/Math.max(globalSham,1e-6);
const pass=replicatedSeeds===seeds.length && globalMean>=.05 && globalRatio>=2;
console.log(JSON.stringify({pass,status:pass?'REPLICATED_CAUSAL_SNN':'REPLICATION_NOT_CLOSED',seeds,replicatedSeeds,totalSeeds:seeds.length,globalMeanCausalL1:globalMean,globalMeanShamL1:globalSham,globalCausalToShamRatio:globalRatio,results:seedResults},null,2));
assert.equal(replicatedSeeds,seeds.length,'Brick 3 replication did not pass for every independent training trajectory');
assert(globalMean>=.05,'global causal L1 below replication floor');
assert(globalRatio>=2,'global causal/sham ratio below replication floor');
