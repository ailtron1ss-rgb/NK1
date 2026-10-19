import assert from 'node:assert/strict';
import { AdaptiveReplayGovernor } from '../src/organism/system/AdaptiveReplayGovernor.ts';

const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
const kinds=['episodic','semantic','identity','autobiographical'];
const nodes=Array.from({length:96},(_,i)=>({
  id:`a-${i}`,kind:kinds[i%kinds.length],ageMs:(1+i%35)*86400000,lastReplayedAt:0,replayCount:i%3,
  surprise01:clamp(.15+(i%11)/11),decayNeed01:clamp(.12+(i%17)/17),
  transferPotential01:clamp(.2+(i%13)/16),identity01:i%19===0?.94:(i%7)/12,
  goal01:i%9===0?.9:(i%8)/12,novelty01:clamp(.12+(i%9)/10),
  stability01:clamp(.28+(i%15)/18),interference01:clamp(.1+(i%12)/14),
  activeGoalMatch:i%9===0,clusterKey:`${kinds[i%kinds.length]}|${i%12}`,
}));

const variants={
  balanced:{surprise:.22,decay:.20,transfer:.18,identity:.12,goal:.10,novelty:.08,stability:.10,adaptive:false},
  surpriseHeavy:{surprise:.42,decay:.12,transfer:.16,identity:.08,goal:.08,novelty:.10,stability:.04,adaptive:false},
  forgettingHeavy:{surprise:.12,decay:.40,transfer:.18,identity:.08,goal:.08,novelty:.08,stability:.06,adaptive:false},
  adaptive:{surprise:.22,decay:.20,transfer:.18,identity:.12,goal:.10,novelty:.08,stability:.10,adaptive:true},
};

function runVariant(name,config){
  const g=new AdaptiveReplayGovernor();
  g.restore({policyWeights:config});
  const selected=[]; let plans=0;
  for(let tick=1;tick<=320;tick++){
    const p=g.plan({tick,at:Date.now()+tick*1000,pressure01:.42+(tick%17===0?.42:0),energy01:.8,memoryPressure01:tick%53===0?.9:.28,mobile:true,activeGoalIds:['goal-A'],nodes});
    if(!p.due)continue;
    plans++;
    selected.push(...p.candidates);
    if(config.adaptive && p.candidates.length){
      for(const row of p.candidates.slice(0,3)){
        const source=nodes.find(n=>n.id===row.id);
        const retention=clamp(.52*source.decayNeed01+.30*source.transferPotential01+.18*source.surprise01-.12*source.interference01);
        const transfer=clamp(.65*source.transferPotential01+.2*source.goal01+.15*source.identity01);
        g.feedback({memoryId:row.id,retentionGain01:retention,transferPotential01:transfer,interferenceRisk01:source.interference01,independentVerified:true,delayMs:7*86400000});
      }
    }
  }
  const quality=selected.length?selected.reduce((s,row)=>s+row.learningOpportunity01-row.interferenceRisk01*.5,0)/selected.length:0;
  const unique=new Set(selected.map(r=>r.id));
  const clusters=new Set(selected.map(r=>r.id.split('-')[0]));
  return {name,plans,selected:selected.length,unique:selected.length?unique.size:0,quality01:clamp((quality+1)/2),interference01:selected.length?selected.reduce((s,r)=>s+r.interferenceRisk01,0)/selected.length:0,diagnostics:g.diagnostics()};
}

const results=Object.entries(variants).map(([name,cfg])=>runVariant(name,cfg));
for(const r of results){
  assert(r.plans>0);
  assert(r.unique>0);
  assert(r.quality01>=0&&r.quality01<=1);
  assert(r.interference01>=0&&r.interference01<=1);
}
const adaptive=results.find(r=>r.name==='adaptive');
assert(adaptive.diagnostics.feedbackUpdates>0);
assert(results.some(r=>r.name!=='adaptive' && r.quality01!==adaptive.quality01),'ablation variants did not differ');
console.log(JSON.stringify({pass:true,status:'P2687_REPLAY_POLICY_ABLATION_PASS',results},null,2));
