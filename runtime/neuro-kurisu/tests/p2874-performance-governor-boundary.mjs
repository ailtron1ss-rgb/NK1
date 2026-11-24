import assert from 'node:assert/strict';
import { RuntimePerformanceGovernor } from '../src/organism/system/RuntimePerformanceGovernor.ts';
import { CognitiveResourceEconomy } from '../src/organism/system/CognitiveResourceEconomy.ts';

const governor = new RuntimePerformanceGovernor(500);
const nominal = governor.record({wallMs:100,cpuMs:60,heapUsedBytes:70_000_000,rssBytes:120_000_000});
const stressed = governor.record({wallMs:2200,cpuMs:1900,heapUsedBytes:190_000_000,rssBytes:320_000_000,ramPressure01:.9,thermal01:.8});
assert.ok(stressed.performancePressure01 > nominal.performancePressure01);
assert.ok(stressed.maintenanceMultiplier01 > nominal.maintenanceMultiplier01);
assert.ok(stressed.schedulerMultiplier01 > nominal.schedulerMultiplier01);
const economy = new CognitiveResourceEconomy();
const a = economy.allocate({tick:1,energy01:.8,cognitiveLoad01:.2,uncertainty01:.3,novelty01:.3,ramPressure01:.2,thermalStrain01:.2,awake:true});
const b = economy.allocate({tick:2,energy01:.8,cognitiveLoad01:.2,uncertainty01:.3,novelty01:.3,ramPressure01:.2,thermalStrain01:.2,performancePressure01:0,awake:true});
assert.equal(a.mode,b.mode);
assert.ok(Math.abs(a.totalBudget01-b.totalBudget01)<1e-9);
console.log(`P2874_PERFORMANCE_BOUNDARY=PASS pressure=${stressed.performancePressure01.toFixed(3)} maintenance=${stressed.maintenanceMultiplier01.toFixed(3)}`);
