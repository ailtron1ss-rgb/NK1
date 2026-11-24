import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RuntimePerformanceGovernor } from '../src/organism/system/RuntimePerformanceGovernor.ts';
import { CognitiveResourceEconomy } from '../src/organism/system/CognitiveResourceEconomy.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

// Direct bounded endurance: 1000 performance samples must stay finite and bounded.
const gov=new RuntimePerformanceGovernor(1200);
for(let i=0;i<1000;i++){
  gov.record({wallMs:i%17===0?2100:480+(i%13)*17,cpuMs:180+(i%7)*25,heapUsedBytes:90*1024*1024+(i%11)*1024*1024,rssBytes:180*1024*1024+(i%9)*2*1024*1024,thermal01:i%31===0?.74:.22,ramPressure01:i%47===0?.81:.28});
}
const direct=gov.snapshot();
assert.equal(direct.samples,1000);
assert.ok(Number.isFinite(direct.p95WallMs) && direct.p95WallMs>0);
assert.ok(direct.performancePressure01>=0 && direct.performancePressure01<=1);
assert.ok(direct.maxWallMs>=2100);

const economy=new CognitiveResourceEconomy();
const nominal=economy.allocate({tick:1,energy01:.8,cognitiveLoad01:.2,uncertainty01:.4,novelty01:.4,thermalStrain01:.2,ramPressure01:.2,performancePressure01:0,awake:true});
const pressured=economy.allocate({tick:2,energy01:.8,cognitiveLoad01:.2,uncertainty01:.4,novelty01:.4,thermalStrain01:.2,ramPressure01:.2,performancePressure01:.9,awake:true});
assert.equal(pressured.totalBudget01,nominal.totalBudget01,'host performance pressure must not alter cognitive budget');
assert.equal(pressured.scarcity01,nominal.scarcity01,'host performance pressure must not alter organism resource scarcity');
assert.equal(pressured.simulation01,nominal.simulation01);
assert.equal(pressured.learning01,nominal.learning01);
assert.equal(pressured.memory01,nominal.memory01);

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'neuro-kurisu-p2864-'));
const stateFile=path.join(dir,'state.json');
const runtime=new OrganismRuntime({stateFile,autoRun:false,enableLanguage:false,realityMode:'external-first',performanceProfile:'mobile',intervalMs:5000});
await runtime.init();
for(let i=0;i<5;i++) await runtime.step();
const before=runtime.runtimePerformanceSnapshot();
const econBefore=runtime.cognitiveResourceEconomySnapshot();
assert.ok((before?.samples??0)>=5,'runtime must record real cycle performance');
assert.ok((econBefore?.performancePressure01??0)>=0 && (econBefore?.performancePressure01??0)<=1);
await runtime.flush();
await runtime.stop();

const runtime2=new OrganismRuntime({stateFile,autoRun:false,enableLanguage:false,realityMode:'external-first',performanceProfile:'mobile',intervalMs:5000});
await runtime2.init();
const after=runtime2.runtimePerformanceSnapshot();
assert.ok((after?.samples??0)>=5,'performance state must survive restart');
assert.ok((after?.totalWallMs??0)>=before.totalWallMs,'persisted wall-time must be monotonic');
await runtime2.stop();
await fs.rm(dir,{recursive:true,force:true});

console.log(`P2864_RUNTIME_PERFORMANCE=PASS samples=${after.samples} p95Ms=${Math.round(after.p95WallMs)} pressure=${after.performancePressure01.toFixed(3)} budgetNominal=${nominal.totalBudget01.toFixed(3)} budgetPressured=${pressured.totalBudget01.toFixed(3)}`);
