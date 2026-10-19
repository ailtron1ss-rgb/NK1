import assert from 'node:assert/strict';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const context='e2|c1|u2|n1|g1|s1';
const action='verify';

// Canonical policy: one recovery episode may receive repeated matched trials
// without creating duplicate episodes for the same boot.
const policy=new AdaptivePolicyEngine();
for(const actual of [.80,.81,.82]) policy.observeMatchedCounterfactualCalibration({contextKey:context,action,selectedExpected01:.82,actualSelectedReward01:actual});
const first=policy.observeRecoveryOutcome({bootId:'boot-1',contextKey:context,action,reward:.90,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:1,independent:true,autonomous:true});
assert.equal(first.recorded,true);
const second=policy.observeRecoveryOutcome({bootId:'boot-1',contextKey:context,action,reward:.89,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:2,independent:true,autonomous:true});
assert.equal(second.recorded,true);
assert.equal(second.promoted,false,'Two matched trials on one boot cannot promote');
const third=policy.observeRecoveryOutcome({bootId:'boot-1',contextKey:context,action,reward:.91,causalConfidence01:.95,selectedExpected01:.82,alternativeExpected01:.42,counterfactualSource:'matched-simulated',matchedTrials:3,independent:true,autonomous:true});
assert.equal(third.recorded,true);
const snap=policy.snapshot();
assert.equal(snap.recoveryStrategy.totalEpisodes,1,'Repeated same-boot trials must remain one recovery episode');
assert.equal(snap.recoveryStrategy.episodes[0].matchedTrials,3);

// Live Core path: repeated matched projection is real, but natural context/action drift
// must not be collapsed into one trial series. We therefore require safety, not promotion.
const base=path.join(tmpdir(),`nk332-core-${process.pid}-${Date.now()}`);
const opts={stateFile:base+'.json',worldStateFile:base+'.world.json',autoRun:false,enableLanguage:false,intervalMs:5000,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'};
const runtime=new OrganismRuntime(opts);
try {
  await runtime.init();
  await runtime.step('B332 live accumulator safety',{deliberate:false});
  const strategy=runtime.core.recoveryStrategyDiagnostics();
  assert.equal(strategy.totalPromotions,0,'Single live recovery boot must not promote');
  console.log(JSON.stringify({status:'PASS',policyEpisodeCount:snap.recoveryStrategy.totalEpisodes,policyMatchedTrials:snap.recoveryStrategy.episodes[0].matchedTrials,liveEpisodes:strategy.totalEpisodes,livePromotions:strategy.totalPromotions,liveMatchedCounterfactuals:strategy.matchedCounterfactuals},null,2));
} finally {
  runtime.stop();
  for(const suffix of ['.json','.world.json','.continuity.jsonl','.operational.jsonl','.json.bak','.world.json.bak','.world.json.tmp']) await rm(base+suffix,{force:true});
}
