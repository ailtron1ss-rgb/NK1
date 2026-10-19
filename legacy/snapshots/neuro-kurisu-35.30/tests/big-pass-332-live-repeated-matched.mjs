import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const base=path.join(tmpdir(),`nk332-live-${process.pid}-${Date.now()}`);
const opts={stateFile:base+'.json',worldStateFile:base+'.world.json',autoRun:false,enableLanguage:false,intervalMs:5000,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'};
const runs=[];
try {
  // Bootstrap boot, then two independent restart boots with repeated live trials.
  for(let boot=0;boot<3;boot++){
    const runtime=new OrganismRuntime(opts);
    await runtime.init();
    const recovery=runtime.core.recoveryAutobiographicalSnapshot().watchdog.recoveryCount;
    for(let i=0;i<3;i++) await runtime.step(`B332 live repeated trial boot ${boot} step ${i}`,{deliberate:false});
    const strategy=runtime.core.recoveryStrategyDiagnostics();
    runs.push({boot,recovery,episodes:strategy.episodes.map(e=>({bootId:e.bootId,matchedTrials:e.matchedTrials,source:e.counterfactualSource}))});
    if(boot>0) {
      const current=strategy.episodes.find(e=>e.bootId===strategy.episodes.at(-1)?.bootId);
      assert.ok((current?.matchedTrials??0)>=1,`live recovery episode must retain matched evidence, got ${current?.matchedTrials}`);
      assert.ok((current?.matchedTrials??0)<3,`live runtime unexpectedly collapsed multiple context/action cohorts into one matched cohort: ${current?.matchedTrials}`);
    }
    runtime.stop();
  }
  const final=runs.at(-1);
  console.log(JSON.stringify({status:'PASS',expectation:'live-repeated-promotion remains blocked until a stable context/action cohort exists',runs},null,2));
} finally {
  for(const suffix of ['.json','.world.json','.continuity.jsonl','.operational.jsonl','.json.bak','.world.json.bak','.world.json.tmp']) await rm(base+suffix,{force:true});
}
