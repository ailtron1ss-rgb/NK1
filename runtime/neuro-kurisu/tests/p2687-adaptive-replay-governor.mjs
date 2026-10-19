import assert from 'node:assert/strict';
import { AdaptiveReplayGovernor } from '../src/organism/system/AdaptiveReplayGovernor.ts';

const now=Date.now();
const make=(id,patch={})=>({
  id,kind:patch.kind??'episodic',ageMs:patch.ageMs??(id==='old'?25*86400000:2*86400000),lastReplayedAt:patch.lastReplayedAt??0,
  replayCount:patch.replayCount??0,surprise01:patch.surprise01??.7,decayNeed01:patch.decayNeed01??.6,
  transferPotential01:patch.transferPotential01??.62,identity01:patch.identity01??.35,goal01:patch.goal01??.45,
  novelty01:patch.novelty01??.55,stability01:patch.stability01??.58,interference01:patch.interference01??.3,
  activeGoalMatch:patch.activeGoalMatch??false,clusterKey:patch.clusterKey??`${patch.kind??'episodic'}|${id}`,
});
const nodes=[
  make('surprise',{surprise01:.96,novelty01:.88,clusterKey:'episode|surprise'}),
  make('identity',{identity01:.96,goal01:.82,transferPotential01:.88,clusterKey:'identity|self'}),
  make('old',{ageMs:38*86400000,stability01:.24,decayNeed01:.96,clusterKey:'episode|old'}),
  make('unsafe',{interference01:.95,stability01:.08,replayCount:6,surprise01:.16,transferPotential01:.15,clusterKey:'episode|unsafe'}),
  make('cooldown',{lastReplayedAt:now-1000,replayCount:1,clusterKey:'episode|cooldown'}),
  make('redundant-a',{clusterKey:'same|cluster',surprise01:.85}),
  make('redundant-b',{clusterKey:'same|cluster',surprise01:.84}),
];

const g=new AdaptiveReplayGovernor();
let scheduled=0,selected=0;
for(let tick=1;tick<=64;tick++){
  const plan=g.plan({tick,at:now+tick*1000,pressure01:tick%9===0?.84:.52,energy01:.78,memoryPressure01:tick%21===0?.88:.3,mobile:true,activeGoalIds:['goal-1'],nodes});
  assert(['fast','medium','slow','none'].includes(plan.lane));
  assert(plan.budget>=0 && plan.budget<=6);
  for(const row of plan.candidates){
    for(const key of ['priority01','learningOpportunity01','retentionPotential01','interferenceRisk01','decayNeed01','cooldown01']) assert(row[key]>=0&&row[key]<=1,`${key} out of bounds`);
  }
  if(plan.due){scheduled++;selected+=plan.candidates.length;}
}
assert(scheduled>=16);
assert(selected>0);
const before=g.snapshot().policyWeights;
const feedback=g.feedback({memoryId:'surprise',retentionGain01:.72,transferPotential01:.81,interferenceRisk01:.12,independentVerified:true,delayMs:7*86400000});
assert.equal(feedback.updated,true);
const after=g.snapshot().policyWeights;
assert.notDeepEqual(after,before,'verified feedback did not adapt replay policy');
const stats=g.diagnostics();
assert(stats.cooldownSuppressed>0);
assert(stats.interferenceAvoided>0);
const restored=new AdaptiveReplayGovernor();
restored.restore(g.snapshot());
assert.equal(restored.diagnostics().feedbackUpdates,g.diagnostics().feedbackUpdates);
assert.equal(restored.diagnostics().selected,g.diagnostics().selected);
console.log(JSON.stringify({pass:true,status:'P2687_ADAPTIVE_REPLAY_GOVERNOR_PASS',scheduled,selected,stats,feedbackUtility01:feedback.utility01},null,2));
