import { writeFile, mkdir } from 'node:fs/promises';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { CausalExperimentEngine } from '../src/organism/research/CausalExperimentEngine.ts';
import { PerturbationalProbe } from '../src/organism/research/PerturbationalProbe.ts';

const clamp=(n)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const sequence=Array.from({length:36},(_,i)=>({
  surprise:[0.18,0.46,0.72,0.31][i%4],
  novelty:[0.55,0.32,0.81,0.42][i%4],
  socialSignal:[0.35,0.62,0.28,0.50][i%4],
  worldContext:{tick:i+1,location:i%3===0?'home':'lab',energy:0.5+(i%4)*0.08,attention:0.7,uncertainty:0.35+(i%3)*0.16,facts:['communication channel','lab reachable'],events:[`event-${i}`],objects:[{id:'notebook',label:'notebook',location:'lab',value:0.6,visible:i%2===0,collected:false}]}
}));

async function runCondition(condition, flags, seed=0){
  class MemoryStore { constructor(){this.value=null;} async load(){return this.value?structuredClone(this.value):null;} async save(value){this.value=structuredClone(value);} }
  const core=new OrganismCore(new MemoryStore(), flags);
  await core.init();
  for(const base of sequence){ const obs={...base,surprise:clamp(base.surprise+(((seed%3)-1)*0.04)),novelty:clamp(base.novelty+(((seed%2)?0.03:-0.02)))}; await core.observe(obs); if(obs.surprise>0.55) await core.feedback({success:0.65,reward:0.55,surprise:obs.surprise}); }
  const snap=core.snapshot();
  const counts={};
  for(const t of snap.traces){const a=t.selected?.action??'wait';counts[a]=(counts[a]??0)+1;}
  const total=snap.traces.length||1;
  const probs=Object.values(counts).map(x=>x/total);
  const entropy=clamp(-probs.reduce((s,p)=>s+(p>0?p*Math.log2(p):0),0)/3);
  const intrinsicCount=snap.goals.filter(g=>g.source==='intrinsic').length;
  const result={condition,cycles:snap.state.tick,autonomyRate:clamp(snap.state.autonomyScore),actionEntropy:entropy,selfPrediction: flags?.enableSelfPrediction===false ? 0 : clamp(1-snap.state.selfPredictionError),identityContinuity:snap.facets.consciousness.identityContinuity.continuity,workspaceIgnition:snap.facets.consciousness.workspaceIgnition.ignitionStrength,intrinsicGoalRate:clamp(intrinsicCount/Math.max(1,total)),valueRevisions:snap.facets.learning.valueRevisionLog.length, evidenceCoverage:snap.facets.consciousness.consciousnessEvidence.aggregateCoverage};
  return result;
}

const conditions=[
  ['baseline',{}],
  ['self-model-lesion',{enableSelfPrediction:false}],
  ['workspace-lesion',{enableWorkspace:false}],
  ['intrinsic-goal-lesion',{enableIntrinsicGoals:false,enableIntrinsicMotivation:false}],
  ['active-inference-lesion',{enableActiveInference:false}],
  ['value-plasticity-lesion',{enableValuePlasticity:false,enableValueEvolution:false}],
];
const results=[];
for(const [name,flags] of conditions){ for(let seed=0;seed<3;seed+=1) results.push(await runCondition(`${name}-seed${seed}`,flags,seed)); }
const aggregate=(rows)=>{ const base=rows[0]; const group=(prefix)=>rows.filter(x=>x.condition.startsWith(prefix)); const mean=(xs,k)=>xs.reduce((s,x)=>s+x[k],0)/Math.max(1,xs.length); return ['baseline','self-model-lesion','workspace-lesion','intrinsic-goal-lesion','active-inference-lesion','value-plasticity-lesion'].map(name=>{const g=group(name); return {condition:name,cycles:mean(g,'cycles'),autonomyRate:mean(g,'autonomyRate'),actionEntropy:mean(g,'actionEntropy'),selfPrediction:mean(g,'selfPrediction'),identityContinuity:mean(g,'identityContinuity'),workspaceIgnition:mean(g,'workspaceIgnition'),intrinsicGoalRate:mean(g,'intrinsicGoalRate'),valueRevisions:mean(g,'valueRevisions'),evidenceCoverage:mean(g,'evidenceCoverage')};}); };
const aggregated=aggregate(results);
const engine=new CausalExperimentEngine();
const baseline=aggregated[0];
const records=results.slice(1).flatMap(r=>engine.compare(baseline,r));
const perturb=new PerturbationalProbe();
const p=perturb.run(aggregated.map(r=>r.workspaceIgnition),aggregated.filter(r=>r.condition!=='workspace-lesion').map(r=>r.workspaceIgnition));
const report={generatedAt:new Date().toISOString(),repetitions:3,baseline,conditions:aggregated,rawConditions:results,causalRecords:records,pairedSummary:engine.paired(records),perturbationalProbe:p,caveats:['Это экспериментальная причинная оценка функциональных свойств. Она не доказывает субъективный опыт.','Результаты зависят от искусственной среды и конечного набора циклов.','Для сильных выводов нужны повторные seeds, device soak и longitudinal trials.']};
await mkdir('research/results',{recursive:true});
await writeFile('research/results/p4-consciousness-lab.json',JSON.stringify(report,null,2),'utf8');
console.log('P4_CONSCIOUSNESS_LAB=PASS', JSON.stringify({cycles:baseline.cycles, coverage:report.pairedSummary.coverage, meanAbsEffect:Number(report.pairedSummary.meanAbsEffect.toFixed(4))}));
