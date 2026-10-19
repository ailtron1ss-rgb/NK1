import { SelfGovernanceEngine, defaultSelfGovernance } from '../src/organism/cognition/evolution/SelfGovernanceEngine.ts';

const seeds=[11,17,29];
const conditions=['baseline','governance-off','future-self-off','consequence-off'];
const run=(seed,condition)=>{
  let rng=seed>>>0; const next=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const engine=new SelfGovernanceEngine(); let autonomous=0; let overrides=0; let ownership=0; let regrets=0;
  const out=[];
  for(let i=0;i<40;i++){
    const internal=.25+next()*.7; const commitment=.2+next()*.75; const regretPressure=next()*.6;
    const candidates=[{id:'verify',goalId:'g1',action:'verify',score:.52+next()*.18,predictedUtility:.58, predictedNeedRelief:.2,predictedCost:.3,confidence:.65,generatedAt:i},{id:'respond',goalId:'g2',action:'respond',score:.52+next()*.16,predictedUtility:.56,predictedNeedRelief:.15,predictedCost:.2,confidence:.72,generatedAt:i},{id:'rest',goalId:'g3',action:'rest',score:.45+next()*.1,predictedUtility:.48,predictedNeedRelief:.3,predictedCost:.1,confidence:.7,generatedAt:i}];
    const goals=[{id:'g1',title:'verify science',reason:'intrinsic',source:'intrinsic',status:'active',importance:.9,urgency:.8,confidence:.7,progress:.2,createdAt:0,updatedAt:i}];
    const requested=i%3===0?'respond':null;
    const influenced=condition==='governance-off'?candidates:engine.influence(candidates,requested,goals,internal,regretPressure);
    const chosen=influenced[0]; if(chosen&&requested&&chosen.action!==requested)overrides++; if(chosen&&!requested)autonomous++;
    if(condition!=='governance-off') engine.recordDecision({requestedAction:requested,chosenAction:chosen.action,autonomous:!requested||chosen.action!==requested,internalPressure:internal,commitmentPressure:commitment,regretPressure,reason:'research'});
    const actual=.25+next()*.7; const counter=.45+next()*.5;
    if(condition!=='consequence-off'){const c=engine.recordConsequence({action:chosen.action,expectedReward:chosen.predictedUtility,actualReward:actual,counterfactualBest:counter}); ownership+=c.ownership; regrets+=c.regret;}
  }
  const snap=engine.snapshot(); return {seed,condition,records:snap.records.length,consequences:snap.consequences.length,governanceScore:snap.governanceScore,ownership:snap.consequenceOwnership,regret:snap.regretMean,autonomous,overrides};
};
const results=seeds.flatMap(seed=>conditions.map(condition=>run(seed,condition)));
const baseline=results.filter(r=>r.condition==='baseline');
const lesions={
  'governance-off':results.filter(r=>r.condition==='governance-off'),
  'future-self-off':results.filter(r=>r.condition==='future-self-off'),
  'consequence-off':results.filter(r=>r.condition==='consequence-off'),
};
const mean=a=>a.reduce((s,r)=>s+r,0)/a.length;
if(mean(baseline.map(x=>x.records))<35) throw new Error('baseline governance recording too low');
if(mean(lesions['governance-off'].map(x=>x.records))!==0) throw new Error('governance lesion failed');
if(mean(lesions['consequence-off'].map(x=>x.consequences))!==0) throw new Error('consequence lesion failed');
const output={version:1,seeds,conditions,results,summary:{baselineGovernanceRecords:mean(baseline.map(x=>x.records)),baselineConsequences:mean(baseline.map(x=>x.consequences)),baselineOwnership:mean(baseline.map(x=>x.ownership)),baselineRegret:mean(baseline.map(x=>x.regret))}};
await import('node:fs/promises').then(fs=>fs.writeFile('research/results/p11-agency-lab.json',JSON.stringify(output,null,2)+'\n'));
console.log(`P11_AGENCY_LAB=PASS seeds=${seeds.length} conditions=${conditions.length} baselineRecords=${output.summary.baselineGovernanceRecords.toFixed(1)} ownership=${output.summary.baselineOwnership.toFixed(3)} regret=${output.summary.baselineRegret.toFixed(3)}`);
