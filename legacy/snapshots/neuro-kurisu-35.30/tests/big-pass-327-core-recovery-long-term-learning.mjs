import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const base=path.join(tmpdir(),`nk327-core-${process.pid}-${Date.now()}`);
const opts={stateFile:base+'.json',worldStateFile:base+'.world.json',autoRun:false,enableLanguage:false,intervalMs:5000,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'};

const runs=[];
try {
  for(let i=0;i<4;i++){
    const runtime=new OrganismRuntime(opts);
    await runtime.init();
    const before=runtime.core.recoveryAutobiographicalSnapshot();
    const step=await runtime.step(`B327 recovery episode ${i+1}`,{deliberate:false});
    const strategy=runtime.core.recoveryStrategyDiagnostics();
    runs.push({i,recoveryCount:before.watchdog.recoveryCount,bootId:before.watchdog.bootId,action:step.cycle.decision.selected?.action??'wait',strategy});
    runtime.stop();
  }
  const after=runs.at(-1).strategy;
  assert.ok(after.totalEpisodes>=3,'Core should record one verified recovery episode on each post-restart boot');
  assert.ok(after.episodes.filter(e=>e.independent).length>=3,'Recovery episodes must carry independent evidence from world transitions');
  assert.equal(after.totalPromotions,0,'Core must not promote recovery strategy from weak causal evidence');
  assert.ok(after.causalBlockedEpisodes>=3,'Weak real-world causal evidence must be explicitly blocked rather than promoted');
  const bootIds=new Set(after.episodes.map(e=>e.bootId));
  assert.ok(bootIds.size>=3,'Recovery learning must span independent runtime boots');
  console.log(JSON.stringify({status:'PASS',runs,totalEpisodes:after.totalEpisodes,totalPromotions:after.totalPromotions,recentEpisodes:after.episodes},null,2));
} finally {
  for(const suffix of ['.json','.world.json','.continuity.jsonl','.operational.jsonl','.json.bak','.world.json.bak','.world.json.tmp']) await rm(base+suffix,{force:true});
}
