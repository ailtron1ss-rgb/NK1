import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utility=Object.fromEntries(actions.map((a,i)=>[a,.32+i*.038]));
const variants={
  control:{p2734:false,p2742:false,p2750:false,p2774:false,p2805:false,p2820:false},
  p2734:{p2734:true,p2742:false,p2750:false,p2774:false,p2805:false,p2820:false},
  causal:{p2734:true,p2742:true,p2750:false,p2774:false,p2805:false,p2820:false},
  world:{p2734:true,p2742:true,p2750:true,p2774:false,p2805:false,p2820:false},
  memory:{p2734:true,p2742:true,p2750:true,p2774:true,p2805:false,p2820:false},
  stability:{p2734:true,p2742:true,p2750:true,p2774:true,p2805:true,p2820:false},
  full:{p2734:true,p2742:true,p2750:true,p2774:true,p2805:true,p2820:true},
};
const regimes={
  ABA:[0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
  ABCBA:[0,0,0,0,1,1,1,1,2,2,2,2,1,1,1,1,0,0,0,0,1,1,1,1,2,2,2,2,1,1,1,1,0,0,0,0,1,1,1,1,2,2,2,2,1,1,1,1,0,0,0,0,1,1,1,1,2,2,2,2,1,1,1,1],
};
const seedPhase=(seed)=>seed*0.173;
const vec=(task,t,seed)=>Array.from({length:64},(_,k)=>
  .29*Math.sin((k+1)*.069+t*.015+task*.57+seedPhase(seed))+
  .20*Math.cos((k+3)*.043-t*.008-task*.19+seed*.11)+.04*task+.015*Math.sin((k+5)*.021*seed)
);

function run(cfg,regimeName,regime,seed){
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(true);
  b.setSelfOptimizingContinualEnabled(cfg.p2734);
  b.setCausalPredictiveInterventionEnabled(cfg.p2742);
  b.setUnifiedCausalWorldLoopEnabled(cfg.p2750);
  b.setModelTimeReplayEnabled(cfg.p2774);
  b.setStabilityPlasticityEnabled(cfg.p2805);
  b.setSelfKnowledgeCoresetEnabled(cfg.p2820);
  let totalReward=0;
  const taskRewards=new Map();
  const taskFirst=new Map();
  const taskLast=new Map();
  for(let t=0;t<regime.length;t++){
    const task=regime[t];
    const shock=(t+seed*3)%23===0||((t+seed)%17===0&&task===2);
    const decision=b.beforeDecision({
      tick:t,
      input:vec(task,t,seed),
      baseUtilities:utility,
      predictionError01:shock?.66:.14+.03*task+.01*seed,
      novelty01:shock?.70:(task===2?.52:.17+.04*task),
      uncertainty01:shock?.61:(task===2?.44:.20),
      homeostasis01:.45,
      identityGap01:.12+task*.027,
      goalPressure01:.28+task*.06,
      reward01:.56,
      identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.10+t*.012+seed*.07)+task*.17),
      embodied:{cpuLoad01:shock?.90:.28,ramPressure01:shock?.80:.24,battery01:shock?.18:.86,sensorFreshness01:.94}
    });
    const action=actions.slice().sort((a,b)=>(
      ((utility[b]??.5)+(decision.actionBias[b]??0))-((utility[a]??.5)+(decision.actionBias[a]??0))
    ))[0];
    b.commitAction(action,{...utility,...decision.actionBias});
    const reward=(task===0&&action==='reflect')?.86:
      (task===1&&action==='respond')?.87:
      (task===2&&action==='verify')?.89:.60;
    totalReward+=reward;
    taskRewards.set(task,(taskRewards.get(task)??0)+reward);
    if(!taskFirst.has(task))taskFirst.set(task,[]);
    taskFirst.get(task).push(reward);
    if(t>=regime.length-16){ if(!taskLast.has(task))taskLast.set(task,[]); taskLast.get(task).push(reward); }
    b.afterOutcome({
      tick:t+1,
      action,
      reward01:reward,
      predictionError01:1-reward,
      verified01:reward>.79?1:.56,
      nextInput:vec(task,t+1,seed),
      holdout01:t%19===0?1:0,
      goalPressure01:.28+task*.06,
      identityGap01:.12+task*.027,
      identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.10+(t+1)*.012+seed*.07)+task*.17)
    });
  }
  const d=b.diagnostics();
  const mass=d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
  const a0=taskFirst.get(0)??[];
  const aLast=(taskLast.get(0)??[]);
  const firstA=a0.slice(0,Math.min(16,a0.length)).reduce((a,x)=>a+x,0)/Math.max(1,Math.min(16,a0.length));
  const lastA=aLast.length?aLast.reduce((a,x)=>a+x,0)/aLast.length:0;
  const self=d.selfKnowledgeCoreset;
  return {
    variant:cfg, regime:regimeName, seed,
    rewardMean:totalReward/regime.length,
    mass, firstA,lastA,Aretention:lastA-firstA,
    contexts:d.unifiedCausalWorldLoop.contextCount??0,
    replay:d.modelTimeReplay.replaySamples??0,
    teacher:self.teacherUpdates, coreset:self.coresetWrites,
    stability:d.stabilityPlasticity.stability01,
    plasticity:d.stabilityPlasticity.plasticity01
  };
}

const results=[];
for(const [regimeName,regime] of Object.entries(regimes)){
  for(const [name,cfg] of Object.entries(variants)){
    for(const seed of [0,1]) results.push(run(cfg,regimeName,regime,seed));
  }
}
assert.equal(results.length,28);
const grouped=new Map();
for(const r of results){ const key=`${r.regime}/${Object.entries(variants)[Object.keys(variants).findIndex(v=>v[1]===r.variant)]?.[0]??''}`; }
const byKey=(r)=>{
  const keys=Object.entries(variants).map(([k,v])=>[k,v]);
  const name=keys.find(([k,v])=>v===r.variant)?.[0]??'unknown';
  return `${r.regime}/${name}`;
};
for(const r of results){ const k=byKey(r); const a=grouped.get(k)??[]; a.push(r); grouped.set(k,a); }
const fullABA=grouped.get('ABA/full');
const ctlABA=grouped.get('ABA/control');
assert.ok(fullABA.every(r=>r.teacher>0 && r.coreset>0));
assert.ok(Math.abs(fullABA.reduce((s,r)=>s+r.mass,0)/2-(ctlABA.reduce((s,r)=>s+r.mass,0)/2))>.003);
assert.ok(new Set(results.map(r=>r.mass.toFixed(4))).size>=8,'all-layer matrix collapsed into one trajectory');
const summary=[];
for(const [k,rows] of grouped){
  const avg=(f)=>rows.reduce((s,r)=>s+r[f],0)/rows.length;
  summary.push(`${k}:reward=${avg('rewardMean').toFixed(4)} mass=${avg('mass').toFixed(4)} Aret=${avg('Aretention').toFixed(4)} replay=${avg('replay').toFixed(1)} teacher=${avg('teacher').toFixed(1)} coreset=${avg('coreset').toFixed(1)} stability=${avg('stability').toFixed(4)}`);
}
console.log('P2820_SYNERGY_MATRIX=PASS runs=28 regimes=2 variants=7 seeds=2');
console.log(summary.join('\n'));
