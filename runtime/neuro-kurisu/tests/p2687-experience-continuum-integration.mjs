import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const mem=(i,now)=>({
  id:`m-${i}`,content:`experience ${i} topic ${i%5} surprise ${i%7}`,kind:i%9===0?'identity':i%5===0?'autobiographical':'episodic',
  createdAt:now-i*86400000,lastAccessAt:now-i*3600000,salience:(i%10)/10+.05,emotionalWeight:(i%6)/6,
  identityRelevance:i%9===0?.92:(i%4)/8,goalRelevance:i%5===0?.82:(i%7)/10,socialRelevance:(i%3)/6,
  predictionError:i%7===0?.9:(i%8)/10,temperature01:.5,confidence:i%6===0?.9:.62,epistemicStatus:'fact',source:'p2687-test',
  entities:[`topic${i%5}`],semanticLinks:i?['m-'+(i-1)]:[],temporalLinks:i?['m-'+(i-1)]:[],causalLinks:i%3===0&&i?['m-'+(i-1)]:[],revisionHistory:[],dormant:false,retrievalCount:i%5,semanticVector:[]
});

const now=Date.now();
const fabric=new ExperienceContinuumFabric({maxNodes:384,maxEdges:1024,maxClusters:96});
for(let i=0;i<72;i++) fabric.observe(mem(i,now),{tick:i+1,at:now-i*1000,novelty01:i%7===0?.9:.28,identityContinuity01:.84,valueStability01:.8,evidenceSupport01:i%11===0?.35:.78,activeGoalIds:['goal-A']});
for(let tick=1;tick<=96;tick++) fabric.tick({tick,at:now+tick*1000,pressure01:tick%13===0?.86:.58,identityContinuity01:.82,valueStability01:.78,evidenceSupport01:.76,activeGoalIds:['goal-A']});
const summary=fabric.summary();
assert.equal(summary.version,7);
assert(summary.adaptiveReplayGovernor.cycles>=6);
assert(summary.adaptiveReplayGovernor.schedules>0);
assert(summary.replay.selected>0);
assert(summary.replay.events.length>0);
for(const node of fabric.snapshot().graphNodes){assert((node.replayCount??0)>=0);}
const snapshot=fabric.snapshot();
const restored=new ExperienceContinuumFabric();
restored.restore(snapshot);
const restoredSummary=restored.summary();
assert.equal(restoredSummary.adaptiveReplayGovernor.selected,summary.adaptiveReplayGovernor.selected);
assert.equal(restoredSummary.replay.events.length,summary.replay.events.length);
const replayed=restored.reactivate(snapshot.graphNodes[0]?.memoryId??'missing',now+100000);
if(replayed){
  const validation=restored.recordReplayValidation({memoryId:replayed.memoryId,retentionScore01:.78,baselineScore01:.61,delayMs:8*86400000,transferPotential01:.74,interferenceRisk01:.11,independentVerified:true,evidenceKey:'p2687-integration'});
  assert.equal(validation.independentVerified,true);
  assert(restored.summary().adaptiveReplayGovernor.feedbackUpdates>=1);
}
console.log(JSON.stringify({pass:true,status:'P2687_EXPERIENCE_CONTINUUM_INTEGRATION_PASS',summary:restored.summary()},null,2));
