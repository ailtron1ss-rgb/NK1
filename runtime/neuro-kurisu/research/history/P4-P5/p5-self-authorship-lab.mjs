import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { CausalExperimentEngine } from '../src/organism/research/CausalExperimentEngine.ts';

const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const sequence=Array.from({length:48},(_,i)=>({
  surprise:[0.72,0.58,0.81,0.46][i%4], novelty:[0.78,0.62,0.83,0.55][i%4], socialSignal:[0.35,0.6,0.28,0.5][i%4],
  worldContext:{tick:i+1,location:i%2?'lab':'home',energy:0.68,attention:0.8,uncertainty:0.55+(i%3)*0.12,facts:['evidence exists','lab reachable'],events:[`p5-${i}`],objects:[{id:'notebook',label:'notebook',location:'lab',value:0.6,visible:true,collected:false}]}
}));
class MemoryStore{constructor(){this.value=null;}async load(){return this.value?structuredClone(this.value):null;}async save(v){this.value=structuredClone(v);}}
async function run(label,flags={}){
 const core=new OrganismCore(new MemoryStore(),{...flags}); await core.init();
 for(const obs of sequence){ await core.observe(obs); await core.feedback({success:0.8,surprise:0.72,reward:0.6}); }
 const s=core.snapshot();
 const intrinsic=s.facets.evolution.selfProjects.projects.filter(p=>p.origin==='intrinsic'||p.origin==='unresolved').length;
 return {condition:label,cycles:s.state.tick,selfProjects:s.facets.evolution.selfProjects.projects.length,intrinsicProjects:intrinsic,agencyRecords:s.facets.evolution.agency.records.length,agencyRate:s.facets.evolution.agency.autonomousChoiceRate,valueRevisions:s.facets.learning.valueRevisionLog.length,trajectory:s.facets.evolution.identityTrajectory.continuity,trajectorySamples:s.facets.evolution.identityTrajectory.samples,narrative:s.facets.evolution.narrative.chapters.length,authorship:s.facets.evolution.selfProjects.authorshipScore};
}
const conditions=[
 ['baseline',{}],
 ['self-project-lesion',{enableSelfProjects:false}],
 ['agency-lesion',{enableAgencyModel:false}],
 ['value-evolution-lesion',{enableValueEvolution:false,enableValuePlasticity:false}],
 ['identity-lesion',{enableIdentityTrajectory:false}],
];
const rows=[]; for(const [name,flags] of conditions){for(let seed=0;seed<3;seed++) rows.push({...await run(`${name}-seed${seed}`,flags),seed});}
const mean=(name,key)=>{const xs=rows.filter(r=>r.condition.startsWith(name));return xs.reduce((a,b)=>a+b[key],0)/Math.max(1,xs.length)};
const aggregated=conditions.map(([name])=>({condition:name,selfProjects:mean(name,'selfProjects'),intrinsicProjects:mean(name,'intrinsicProjects'),agencyRecords:mean(name,'agencyRecords'),agencyRate:mean(name,'agencyRate'),valueRevisions:mean(name,'valueRevisions'),trajectory:mean(name,'trajectory'),trajectorySamples:mean(name,'trajectorySamples'),narrative:mean(name,'narrative'),authorship:mean(name,'authorship')}));
const base=aggregated[0]; const records=[]; const eng=new CausalExperimentEngine(); for(const row of aggregated.slice(1)){records.push(...eng.compare(base,row));}
const report={generatedAt:new Date().toISOString(),repetitions:3,conditions:aggregated,causalRecords:records,pairedSummary:eng.paired(records),caveats:['P5 causal lab tests architecture-level necessity, not subjective experience.','Synthetic environment and 48-cycle horizon limit generalisation.','Device Gate and multi-week longitudinal data are required for stronger claims.']};
await import('node:fs/promises').then(fs=>fs.mkdir('research/results',{recursive:true}).then(()=>fs.writeFile('research/results/p5-self-authorship-lab.json',JSON.stringify(report,null,2),'utf8')));
if(base.selfProjects<=0 || aggregated[1].selfProjects!==0 || aggregated[2].agencyRecords!==0 || aggregated[3].valueRevisions!==0 || aggregated[4].trajectorySamples!==0) throw new Error('P5 lesion separation failed');
console.log('P5_SELF_AUTHORSHIP_LAB=PASS', JSON.stringify({baseline:aggregated[0], pairedCoverage:report.pairedSummary.coverage, meanAbsEffect:Number(report.pairedSummary.meanAbsEffect.toFixed(4))}));
