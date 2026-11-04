import assert from 'node:assert/strict';
import { DeviceAwareNeuralScheduler, defaultDeviceAwareNeuralScheduler } from '../src/organism/cognition/DeviceAwareNeuralScheduler.ts';
import { CrossLayerAdaptiveArbiter } from '../src/organism/cognition/CrossLayerAdaptiveArbiter.ts';
import { ClosedLoopEvidenceLedger, defaultClosedLoopEvidenceLedger } from '../src/organism/cognition/ClosedLoopEvidenceLedger.ts';
import { P2703GlobalWorkspaceConvergence } from '../src/organism/cognition/P2703GlobalWorkspaceConvergence.ts';
import { ActiveInformationGainController } from '../src/organism/cognition/ActiveInformationGainController.ts';
import { HippocampalFormationCircuit } from '../src/organism/memory/HippocampalFormationCircuit.ts';

/**
 * WorkPass72 — device scheduler, cross-layer arbiter, closed-loop evidence
 * ledger, global-workspace convergence, active-information-gain controller and
 * the hippocampal formation circuit. Each merged a persisted snapshot with a
 * bare spread or structuredClone, letting NaN reach device/thermal state,
 * source reliability, evidence episodes, workspace latent/recurrent state,
 * hypotheses and hippocampal traces.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- DeviceAwareNeuralScheduler ---------------------------------------------
{
  const m = new DeviceAwareNeuralScheduler();
  m.restore({ version: 1, tick: -1, decisions: NaN, thermalStrain01: 9, battery01: -1, cpuLoad01: NaN, ramPressure01: 9, sensorFreshness01: -1, budget01: NaN, degradedMode01: 9, skippedDeepRollouts: -1, throttledCycles: NaN, thermalSafety01: 9, computeEfficiency01: -1, lastReason: 5 });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'scheduler negative tick -> 0');
  assert.equal(st.decisions, 0, 'scheduler NaN decisions -> 0');
  assert.equal(st.thermalStrain01, 1, 'scheduler over-1 strain -> 1');
  assert.equal(st.battery01, 0, 'scheduler negative battery -> 0');
  assert.equal(st.cpuLoad01, .2, 'scheduler NaN cpu -> default');
  assert.equal(st.ramPressure01, 1, 'scheduler over-1 ram -> 1');
  assert.equal(st.sensorFreshness01, 0, 'scheduler negative freshness -> 0');
  assert.equal(st.budget01, .75, 'scheduler NaN budget -> default');
  assert.equal(st.degradedMode01, 1, 'scheduler over-1 degraded -> 1');
  assert.equal(st.skippedDeepRollouts, 0, 'scheduler negative skips -> 0');
  assert.equal(st.throttledCycles, 0, 'scheduler NaN throttles -> 0');
  assert.equal(st.thermalSafety01, 1, 'scheduler over-1 safety -> 1');
  assert.equal(st.computeEfficiency01, 0, 'scheduler negative efficiency -> 0');
  assert.equal(st.lastReason, 'baseline', 'scheduler non-string reason -> default');
  assert.doesNotThrow(() => m.restore(hostile('thermalStrain01')));
  const d = defaultDeviceAwareNeuralScheduler();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'scheduler default round-trips');
}

// --- CrossLayerAdaptiveArbiter ----------------------------------------------
{
  const m = new CrossLayerAdaptiveArbiter();
  m.restore({ version: 1, decisions: -1, updates: NaN, disagreements: -1, abstentions: NaN, correctiveReroutes: -1, fusionQuality01: 9, calibration01: -1, disagreement01: NaN, sourceDiversity01: 9, learningEfficiency01: -1, selectedAction: 'bogus', selectedSource: 'bogus', sourceReliability: { neural: { reliability01: 9, plasticity01: 9, uses: -1, wins: NaN, losses: -1, lastGain01: 9 }, bogus: { reliability01: 9 } }, lastWeights: { neural: 9, causal: -1, bogus: 1 } });
  const st = m.snapshot();
  assert.equal(st.decisions, 0, 'arbiter negative decisions -> 0');
  assert.equal(st.updates, 0, 'arbiter NaN updates -> 0');
  assert.equal(st.fusionQuality01, 1, 'arbiter over-1 fusion -> 1');
  assert.equal(st.calibration01, 0, 'arbiter negative calibration -> 0');
  assert.equal(st.disagreement01, 0, 'arbiter NaN disagreement -> default');
  assert.equal(st.sourceDiversity01, 1, 'arbiter over-1 diversity -> 1');
  assert.equal(st.selectedAction, null, 'arbiter unknown action -> null');
  assert.equal(st.selectedSource, null, 'arbiter unknown source -> null');
  assert.equal(st.sourceReliability.neural.reliability01, 1, 'arbiter over-1 reliability -> 1');
  assert.equal(st.sourceReliability.neural.plasticity01, .5, 'arbiter over-.5 plasticity -> .5');
  assert.equal(st.sourceReliability.neural.uses, 0, 'arbiter negative uses -> 0');
  assert.equal(st.sourceReliability.neural.wins, 0, 'arbiter NaN wins -> 0');
  assert.equal(st.sourceReliability.neural.lastGain01, 1, 'arbiter over-1 lastGain -> 1');
  assert.equal(st.sourceReliability.bogus, undefined, 'arbiter drops unknown source key');
  assert.equal(Object.keys(st.sourceReliability).length, 10, 'arbiter keeps ten canonical sources');
  assert.equal(st.lastWeights.neural, 1, 'arbiter over-1 weight -> 1');
  assert.equal(st.lastWeights.causal, 0, 'arbiter negative weight -> 0');
  assert.equal(st.lastWeights.bogus, undefined, 'arbiter drops unknown weight key');
  assert.doesNotThrow(() => m.restore(hostile('sourceReliability')));
  m.restore({});
  assert.deepEqual(m.snapshot(), new CrossLayerAdaptiveArbiter().snapshot(), 'arbiter empty restore matches default');
}

// --- ClosedLoopEvidenceLedger -----------------------------------------------
{
  const m = new ClosedLoopEvidenceLedger();
  m.restore({ version: 1, writes: -1, verified: NaN, contradictions: -1, causalUpdates: NaN, meanGrounding01: 9, meanInformationGain01: -1, closedLoopQuality01: NaN, lastEpisodeId: 5, episodes: [{ id: 'e1', tick: -1, action: 'bogus', predicted01: 9, observed01: -1, reward01: NaN, verified01: 9, predictionError01: -1, contradiction01: NaN, grounding01: 9, informationGain01: -1, causalCredit01: NaN, sourceIds: [5, 'ok', '', 6] }, { tick: 1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.writes, 0, 'ledger negative writes -> 0');
  assert.equal(st.verified, 0, 'ledger NaN verified -> 0');
  assert.equal(st.meanGrounding01, 1, 'ledger over-1 grounding -> 1');
  assert.equal(st.meanInformationGain01, 0, 'ledger negative info -> 0');
  assert.equal(st.closedLoopQuality01, .3, 'ledger NaN quality -> default');
  assert.equal(st.lastEpisodeId, null, 'ledger non-string id -> null');
  assert.equal(st.episodes.length, 1, 'ledger drops id-less episode');
  assert.equal(st.episodes[0].id, 'e1', 'ledger keeps valid episode');
  assert.equal(st.episodes[0].tick, 0, 'ledger negative tick -> 0');
  assert.equal(st.episodes[0].action, 'wait', 'ledger unknown action -> wait');
  assert.equal(st.episodes[0].predicted01, 1, 'ledger over-1 predicted -> 1');
  assert.equal(st.episodes[0].observed01, 0, 'ledger negative observed -> 0');
  assert.equal(st.episodes[0].reward01, 0, 'ledger NaN reward -> 0');
  assert.equal(st.episodes[0].grounding01, 1, 'ledger over-1 grounding -> 1');
  assert.deepEqual(st.episodes[0].sourceIds, ['ok'], 'ledger keeps only non-empty string source ids');
  assert.doesNotThrow(() => m.restore(hostile('episodes')));
  const d = defaultClosedLoopEvidenceLedger();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'ledger default round-trips');
}

// --- P2703GlobalWorkspaceConvergence ----------------------------------------
{
  const m = new P2703GlobalWorkspaceConvergence();
  m.restore({ version: 1, tick: -1, cycles: NaN, temperature: 0, latent: [9, -1, NaN], recurrent: [[9, -1, NaN]], sourceWeights: { neural: 9, bogus: 1 }, selectedSources: ['neural', 'bogus', 5], selectedIds: ['a', 5], selectionWeights: [9, -1], ignition01: 9, recurrence01: -1, diversity01: NaN, broadcast01: 9, actionInfluence01: -1, disagreement01: NaN, learningUpdates: -1, rewardMean01: 9, lastReward01: -1, broadcastActionBias: { respond: 9, bogus: 1 } });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'workspace negative tick -> 0');
  assert.equal(st.cycles, 0, 'workspace NaN cycles -> 0');
  assert.equal(st.temperature, .05, 'workspace zero temperature floored to .05');
  assert.equal(st.latent.length, 24, 'workspace latent fixed length 24');
  assert.equal(st.latent[0], 1, 'workspace over-1 latent -> 1');
  assert.equal(st.latent[1], -1, 'workspace signed latent preserved at -1');
  assert.equal(st.latent[2], 0, 'workspace NaN latent -> 0');
  assert.equal(st.recurrent.length, 24, 'workspace recurrent fixed 24 rows');
  assert.equal(st.recurrent[0].length, 24, 'workspace recurrent row fixed length 24');
  assert.equal(st.recurrent[0][0], 1, 'workspace over-1 recurrent -> 1');
  assert.equal(st.recurrent[1][0], 0, 'workspace missing recurrent row -> zeros');
  assert.equal(st.sourceWeights.neural, 4, 'workspace source weight clamped to 4');
  assert.equal(st.sourceWeights.bogus, undefined, 'workspace drops unknown source key');
  assert.deepEqual(st.selectedSources, ['neural'], 'workspace keeps only known sources');
  assert.deepEqual(st.selectedIds, ['a'], 'workspace keeps only string ids');
  assert.equal(st.ignition01, 1, 'workspace over-1 ignition -> 1');
  assert.equal(st.recurrence01, 0, 'workspace negative recurrence -> 0');
  assert.equal(st.diversity01, 0, 'workspace NaN diversity -> default');
  assert.equal(st.broadcastActionBias.respond, 1, 'workspace over-1 broadcast bias -> 1');
  assert.equal(st.broadcastActionBias.bogus, undefined, 'workspace drops unknown broadcast key');
  assert.doesNotThrow(() => m.restore(hostile('recurrent')));
  const d = new P2703GlobalWorkspaceConvergence().snapshot();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'workspace default round-trips');
}

// --- ActiveInformationGainController ----------------------------------------
{
  const m = new ActiveInformationGainController();
  m.restore({ version: 1, tick: -1, decisions: NaN, experiments: -1, observations: NaN, usefulExperiments: -1, failedExperiments: NaN, modelUpdates: -1, informationGain01: 9, expectedUtility01: -1, epistemicValue01: NaN, calibration01: 9, explorationPressure01: -1, selectedAction: 'bogus', selectedHypothesis: 5, hypotheses: [{ id: 'h1', belief01: 9, uncertainty01: -1, evidence: -1, reward01: NaN, predictionError01: 9, lastTick: -1 }, { id: 5 }], actionValue: { respond: 9, bogus: 1 }, actionUncertainty: { respond: -1 }, actionCounts: { respond: -1, explore: 5 }, actionWins: { respond: NaN } });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'aigc negative tick -> 0');
  assert.equal(st.decisions, 0, 'aigc NaN decisions -> 0');
  assert.equal(st.informationGain01, 1, 'aigc over-1 info -> 1');
  assert.equal(st.expectedUtility01, 0, 'aigc negative utility -> 0');
  assert.equal(st.epistemicValue01, .15, 'aigc NaN epistemic -> default');
  assert.equal(st.selectedAction, null, 'aigc unknown action -> null');
  assert.equal(st.selectedHypothesis, null, 'aigc non-string hypothesis -> null');
  assert.equal(st.hypotheses.length, 2, 'aigc keeps both hypotheses');
  assert.equal(st.hypotheses[0].belief01, 1, 'aigc over-1 belief -> 1');
  assert.equal(st.hypotheses[0].uncertainty01, 0, 'aigc negative uncertainty -> 0');
  assert.equal(st.hypotheses[0].evidence, 0, 'aigc negative evidence -> 0');
  assert.equal(st.hypotheses[0].reward01, .5, 'aigc NaN reward -> default');
  assert.equal(st.hypotheses[0].lastTick, 0, 'aigc negative lastTick -> 0');
  assert.equal(st.hypotheses[1].id, 'h', 'aigc non-string hypothesis id -> h');
  assert.equal(st.actionValue.respond, 1, 'aigc over-1 action value -> 1');
  assert.equal(st.actionValue.bogus, undefined, 'aigc drops unknown action value key');
  assert.equal(st.actionUncertainty.respond, 0, 'aigc negative action uncertainty -> 0');
  assert.equal(st.actionCounts.respond, 0, 'aigc negative action count -> 0');
  assert.equal(st.actionCounts.explore, 5, 'aigc action count preserved');
  assert.equal(st.actionWins.respond, 0, 'aigc NaN action wins -> 0');
  assert.doesNotThrow(() => m.restore(hostile('hypotheses')));
  m.restore({});
  assert.deepEqual(m.snapshot(), new ActiveInformationGainController().snapshot(), 'aigc empty restore matches default');
}

// --- HippocampalFormationCircuit --------------------------------------------
{
  const m = new HippocampalFormationCircuit();
  m.restore({ version: 1, encodingCount: -1, recalls: NaN, replayRuns: -1, separated01: 9, completed01: -1, predictionError01: NaN, regions: { dg: false, ca3: 'no', ca1: true, subiculum: 0 }, traces: [{ memoryId: 5, dg: [9, -1, NaN], ca3: [], ca1: 'x', subiculum: [1], tick: -1, replayCount: NaN, uncertainty01: 9 }, 'x'], lastRecall: { memoryId: 5, separation01: 9, completion01: -1, predictionError01: NaN, uncertainty01: 9 } });
  const st = m.snapshot();
  assert.equal(st.encodingCount, 0, 'hpc negative encoding -> 0');
  assert.equal(st.recalls, 0, 'hpc NaN recalls -> 0');
  assert.equal(st.separated01, 1, 'hpc over-1 separated -> 1');
  assert.equal(st.completed01, 0, 'hpc negative completed -> 0');
  assert.equal(st.predictionError01, 0, 'hpc NaN error -> default');
  assert.equal(st.regions.dg, false, 'hpc false region preserved');
  assert.equal(st.regions.ca3, true, 'hpc non-false region -> true');
  assert.equal(st.regions.cubiculum, undefined, 'hpc regions unchanged shape');
  assert.equal(st.regions.subiculum, true, 'hpc 0 region -> true');
  assert.equal(st.traces.length, 1, 'hpc drops non-object trace');
  assert.equal(st.traces[0].memoryId, '', 'hpc non-string memoryId -> empty');
  assert.equal(st.traces[0].dg.length, 3, 'hpc dg vector length preserved');
  assert.equal(st.traces[0].dg[0], 1, 'hpc over-1 dg -> 1');
  assert.equal(st.traces[0].dg[1], -1, 'hpc signed dg preserved at -1');
  assert.equal(st.traces[0].dg[2], 0, 'hpc NaN dg -> 0');
  assert.equal(st.traces[0].ca3.length, 0, 'hpc empty ca3 preserved');
  assert.equal(st.traces[0].ca1.length, 0, 'hpc non-array ca1 -> empty');
  assert.equal(st.traces[0].tick, 0, 'hpc negative trace tick -> 0');
  assert.equal(st.traces[0].replayCount, 0, 'hpc NaN replay -> 0');
  assert.equal(st.traces[0].uncertainty01, 1, 'hpc over-1 trace uncertainty -> 1');
  assert.equal(st.lastRecall.memoryId, null, 'hpc non-string lastRecall id -> null');
  assert.equal(st.lastRecall.separation01, 1, 'hpc over-1 lastRecall separation -> 1');
  assert.equal(st.lastRecall.completion01, 0, 'hpc negative lastRecall completion -> 0');
  assert.equal(st.lastRecall.predictionError01, 0, 'hpc NaN lastRecall error -> default');
  assert.doesNotThrow(() => m.restore(hostile('traces')));
  m.restore({});
  assert.deepEqual(m.snapshot(), new HippocampalFormationCircuit().snapshot(), 'hpc empty restore matches default');
}

console.log('WORKPASS72_DEVICESCHED_ARBITER_EVIDENCE_WORKSPACE_AIGC_HIPPOCAMPAL_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['DeviceAwareNeuralScheduler', 'CrossLayerAdaptiveArbiter', 'ClosedLoopEvidenceLedger', 'P2703GlobalWorkspaceConvergence', 'ActiveInformationGainController', 'HippocampalFormationCircuit'] }));
