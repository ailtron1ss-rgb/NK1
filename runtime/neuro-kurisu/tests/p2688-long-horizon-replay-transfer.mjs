import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const mem=(i,now)=>({
  id:`lh-${i}`,content:`long horizon causal transfer ${i} domain ${i%6}`,kind:i%10===0?'identity':'episodic',
  createdAt:now-i*21600000,lastAccessAt:now-i*1800000,salience:.55+(i%5)*.06,emotionalWeight:.25,
  identityRelevance:i%10===0?.95:.2,goalRelevance:i%4===0?.9:.36,socialRelevance:.18,
  predictionError:i%6===0?.95:.24,temperature01:.5,confidence:.76,epistemicStatus:'fact',source:'p2688-long-horizon',
  entities:[`domain${i%6}`],semanticLinks:i?['lh-'+(i-1)]:[],temporalLinks:i?['lh-'+(i-1)]:[],causalLinks:i%3===0&&i?['lh-'+(i-1)]:[],revisionHistory:[],dormant:false,retrievalCount:i%5,semanticVector:[]
});

const now=Date.now();
const f=new ExperienceContinuumFabric({maxNodes:384,maxEdges:1024,maxClusters:96});
for(let i=0;i<120;i++) f.observe(mem(i,now),{tick:i+1,at:now-i*60000,novelty01:i%6===0?.92:.28,identityContinuity01:.83,valueStability01:.8,evidenceSupport01:.72,activeGoalIds:['g-transfer']});
const verificationService=new OutcomeVerificationService();
let validations=0;
for(let tick=1;tick<=320;tick++){
  f.tick({tick,at:now+tick*60000,pressure01:tick%17===0?.9:.56,identityContinuity01:.83,valueStability01:.8,evidenceSupport01:.74,activeGoalIds:['g-transfer']});
  if(tick%40===0){
    const events=f.snapshot().replay.events.slice(-4);
    for(const e of events){
      const retentionScore01=.58+(tick%3)*.1;
      const input={memoryId:e.memoryId,retentionScore01,baselineScore01:.48,delayMs:(tick%5+1)*86400000,transferPotential01:.66+(tick%4)*.05,interferenceRisk01:.14,evidenceKey:`p2688-lh:${tick}:${e.id}`,taskId:'transfer-task',contextKey:`ctx-${tick%3}`};
      // Only a trusted external receipt bound to this tuple earns causal replay credit.
      const verification=await verificationService.verify(
        {toolId:'memory.retention-postcondition',input,result:{retentionScore01}},
        ()=>({verified:true,basis:'external-postcondition',confidence01:.99,externalObservation:true,observationId:`obs-lh-${tick}-${e.id}`,expectedPostcondition:`retention-score:${retentionScore01}`,observedPostcondition:`retention-score:${retentionScore01}`})
      );
      f.recordReplayValidation({...input,verification,replayEventId:e.id,at:e.at+(tick%5+1)*86400000});
      validations++;
    }
  }
}
const s=f.summary();
assert(s.cycles>=320);
assert(s.replay.events.length>0);
assert(validations>0);
assert(s.causalReplayCredit.verifiedAssignments===validations);
assert(s.causalReplayCredit.meanCredit01>0);
assert(s.causalReplayCredit.recentCount>0&&s.causalReplayCredit.recentCount<=128);
assert(s.graphNodes<=384&&s.graphEdges<=1024&&s.clusters<=96);
console.log(JSON.stringify({
  pass:true,status:'P2688_LONG_HORIZON_REPLAY_TRANSFER_PASS',
  cycles:s.cycles,replayEvents:s.replay.events.length,validations,
  causalReplayCredit:s.causalReplayCredit,
  bounded:{graphNodes:s.graphNodes,graphEdges:s.graphEdges,clusters:s.clusters}
},null,2));
