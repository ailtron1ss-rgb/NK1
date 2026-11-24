import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const make = (enabled, suffix) => new OrganismRuntime({
  stateFile: `/tmp/neuro-kurisu-b368-${suffix}.json`,
  stateStore: new MemoryStateStore(),
  enableB365FullPath: enabled,
  cycleResultMode: 'full',
  performanceProfile: 'balanced',
  enableLanguage: false,
  autoRun: false,
  intervalMs: 30000,
});
const on = make(true, 'on');
const off = make(false, 'off');
await on.init();
await off.init();
const a = await on.autonomousStep();
const b = await off.autonomousStep();
const map = (frame) => Object.fromEntries(frame.cycle.decision.candidates.map(c => [c.action, c.score]));
const am = map(a), bm = map(b);
const keys = [...new Set([...Object.keys(am), ...Object.keys(bm)])];
const l1 = keys.reduce((s, k) => s + Math.abs((am[k] ?? 0) - (bm[k] ?? 0)), 0);
const onDiag = on.core.b365UnifiedNeuroCausalDiagnostics();
const offDiag = off.core.b365UnifiedNeuroCausalDiagnostics();
const onClosed = await on.runAutonomousCycles(3);
const offClosed = await off.runAutonomousCycles(3);
const onDiag2 = on.core.b365UnifiedNeuroCausalDiagnostics();
const offDiag2 = off.core.b365UnifiedNeuroCausalDiagnostics();
assert.ok(onDiag.cycles >= 1, `B365 full-runtime cycles missing: ${onDiag.cycles}`);
assert.equal(offDiag.cycles, 0, `B365 disabled ablation still stepped: ${offDiag.cycles}`);
assert.ok(onDiag.learningUpdates >= 1, `B365 full-runtime learning missing: ${onDiag.learningUpdates}`);
assert.ok(onDiag.temporalUpdates >= 1, `B365 full-runtime temporal learning missing: ${onDiag.temporalUpdates}`);
assert.ok(l1 > 0.003, `B365 full-runtime candidate separation too small: ${l1}`);
assert.ok(onDiag2.learningUpdates > onDiag.learningUpdates, 'B365 full-runtime learning did not accumulate');
assert.ok(onDiag2.temporalUpdates > onDiag.temporalUpdates, 'B365 full-runtime temporal updates did not accumulate');
assert.equal(offDiag2.cycles, 0, `B365 disabled run accumulated cycles: ${offDiag2.cycles}`);
assert.equal(offDiag2.learningUpdates, 0, `B365 disabled run accumulated learning: ${offDiag2.learningUpdates}`);
assert.equal(onClosed.externalCommands, 0, `Autonomous run accepted external commands: ${onClosed.externalCommands}`);
console.log(JSON.stringify({pass:true,status:'B368_FULL_RUNTIME_B365_CAUSAL_PASS',scoreL1:Number(l1.toFixed(6)),firstStep:{onLearning:onDiag.learningUpdates,onTemporal:onDiag.temporalUpdates,offCycles:offDiag.cycles},closedLoop:{on:onClosed,off:offClosed},final:{onLearning:onDiag2.learningUpdates,onTemporal:onDiag2.temporalUpdates,offCycles:offDiag2.cycles},selectedOn:a.cycle.decision.selected?.action,selectedOff:b.cycle.decision.selected?.action},null,2));
