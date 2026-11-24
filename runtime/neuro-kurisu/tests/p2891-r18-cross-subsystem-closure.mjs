import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryRetentionEconomy } from '../src/organism/system/MemoryRetentionEconomy.ts';
import { WorldCausalCalibration } from '../src/organism/system/WorldCausalCalibration.ts';

const mem=new MemoryOS2();
const older=mem.encode({content:'Project status: deployment is stable and verified.',kind:'semantic',source:'external',context:{topic:'project'},salience:.8,emotionalWeight:.2,identityRelevance:.4,goalRelevance:.8,socialRelevance:.2,predictionError:.1,confidence:.9,epistemicStatus:'fact',entities:['project','deployment'],semanticLinks:[],temporalLinks:[],causalLinks:[] , observedAt:1000});
const newer=mem.encode({content:'Project status: deployment is blocked and not verified.',kind:'semantic',source:'external',context:{topic:'project'},salience:.9,emotionalWeight:.2,identityRelevance:.4,goalRelevance:.9,socialRelevance:.2,predictionError:.3,confidence:.9,epistemicStatus:'fact',entities:['project','deployment'],semanticLinks:[],temporalLinks:[],causalLinks:[],observedAt:2000});
const conflict=mem.adjudicateImplicitConflicts({at:2100,limit:16,pairBudget:32});
assert.equal(conflict.resolved,1);
const retrieved=mem.retrieve('project deployment verification',4);
assert.ok(retrieved.every((row)=>row.validUntilAt==null));

const economy=new MemoryRetentionEconomy();
const assessed=economy.assess({tick:1,salience01:.8,identity01:.7,goal01:.8,social01:.3,predictionError01:.2,emotion01:.4,recency01:.9,novelty01:.4,redundancy01:.1,storageCost01:.2,pressure01:.1});
for(let i=0;i<32;i++) economy.observeOutcome({score01:assessed.score01,observedUtility01:i%2?.82:.32,features:assessed.utility,learningRate01:.02});
assert.equal(economy.learnedPolicyDiagnostics().samples,32);

const world=new WorldCausalCalibration();
const context='e:3|u:1|n:2|g:none';
for(let i=0;i<12;i++){
  const id=`r18-${i}`;
  world.track({predictionId:id,action:'verify',predicted01:.7,confidence01:.8,at:i+1});
  world.observe({predictionId:id,action:'verify',actual01:.82,source:'observation',verified01:.9,independent01:.9,evidence01:.85,matchedContextKey:context,at:i+2});
}
const calibrated=world.calibratedConfidence('verify',.4,context);
assert.ok(calibrated>.4);
console.log(JSON.stringify({ok:true,implicitConflictResolved:conflict.resolved,staleAvoided:mem.implicitConflictDiagnostics().staleRetrievalsAvoided,learningSamples:economy.learnedPolicyDiagnostics().samples,calibratedConfidence:calibrated}));
