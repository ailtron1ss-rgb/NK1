import assert from 'node:assert/strict';
import { RuntimePerformanceGovernor } from '../src/organism/system/RuntimePerformanceGovernor.ts';
import { CognitiveResourceEconomy } from '../src/organism/system/CognitiveResourceEconomy.ts';

const governor = new RuntimePerformanceGovernor(500);
const nominalPressure = governor.record({wallMs:120,cpuMs:80,heapUsedBytes:70_000_000,rssBytes:120_000_000,ramPressure01:.10,thermal01:.10});
const stressedPressure = governor.record({wallMs:4_000,cpuMs:3_500,heapUsedBytes:220_000_000,rssBytes:360_000_000,ramPressure01:.95,thermal01:.90});
assert.ok(stressedPressure.schedulerMultiplier01 > nominalPressure.schedulerMultiplier01);
assert.ok(stressedPressure.maintenanceMultiplier01 >= nominalPressure.maintenanceMultiplier01);

const input = {tick:11,energy01:.84,cognitiveLoad01:.26,uncertainty01:.47,novelty01:.39,predictionDebt01:.21,thermalStrain01:.24,ramPressure01:.31,awake:true};
const nominal = new CognitiveResourceEconomy().allocate({...input,performancePressure01:0});
const pressured = new CognitiveResourceEconomy().allocate({...input,performancePressure01:1});
for (const key of ['totalBudget01','attention01','simulation01','learning01','memory01','externalInteraction01','scarcity01','maxCounterfactualBranches','permitExpensiveLanguage']) {
  assert.deepEqual(pressured[key], nominal[key], `host performance pressure changed cognitive field: ${key}`);
}

console.log(`P2875_HOST_PRESSURE_SEMANTIC_ISOLATION=PASS scheduler=${stressedPressure.schedulerMultiplier01.toFixed(3)} totalBudget=${nominal.totalBudget01.toFixed(3)}`);
