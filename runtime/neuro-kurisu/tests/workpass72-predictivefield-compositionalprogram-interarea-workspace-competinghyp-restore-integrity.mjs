import assert from 'node:assert/strict';
import { B2503ActionablePredictiveField, defaultB2503State } from '../src/organism/cognition/B2503ActionablePredictiveField.ts';
import { B275NeuralCompositionalPolicy, defaultB275State } from '../src/organism/cognition/B275NeuralCompositionalPolicy.ts';
import { B276LatentActionProgramSynthesizer, defaultB276State } from '../src/organism/cognition/B276LatentActionProgramSynthesizer.ts';
import { B281PredictiveInterAreaMessaging, defaultB281State } from '../src/organism/cognition/B281PredictiveInterAreaMessaging.ts';
import { B282PredictiveGlobalWorkspace, defaultB282State } from '../src/organism/cognition/B282PredictiveGlobalWorkspace.ts';
import { B283CompetingPredictiveHypotheses, defaultB283State } from '../src/organism/cognition/B283CompetingPredictiveHypotheses.ts';

/**
 * WorkPass72 — the predictive/neural family: actionable predictive field,
 * neural compositional policy, latent action program synthesizer, predictive
 * inter-area messaging, predictive global workspace and competing predictive
 * hypotheses. Each merged a persisted snapshot with a bare spread, letting NaN
 * reach transition rows, policy weights, program nodes, message predictions,
 * workspace matrices and hypothesis latents.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B2503ActionablePredictiveField -----------------------------------------
{
  const m = new B2503ActionablePredictiveField();
  m.restore({ version: 1, enabled: 'no', tick: -1, cycles: NaN, learningUpdates: -1, rollouts: NaN, predictionError01: 9, uncertainty01: -1, calibration01: NaN, causalEffect01: 9, actionPredictions: [9, -1], actionUncertainty: [9], actionBias: [9], lastState: [9, -1, NaN], lastPredictions: [9], horizon: 9, lesion: 'yes', transitions: [{ state: [9, -1, NaN], next: [9], action: 'bogus', reward01: 9, confidence01: -1, surprise01: NaN, mass01: 9, tick: -1, verified01: 9 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2503 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2503 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2503 NaN cycles -> 0');
  assert.equal(st.predictionError01, 1, 'b2503 over-1 error -> 1');
  assert.equal(st.uncertainty01, 0, 'b2503 negative uncertainty -> 0');
  assert.equal(st.calibration01, .5, 'b2503 NaN calibration -> default');
  assert.equal(st.causalEffect01, 1, 'b2503 over-1 causal effect -> 1');
  assert.equal(st.actionPredictions.length, 7, 'b2503 actionPredictions fixed length 7');
  assert.equal(st.actionPredictions[0], 1, 'b2503 over-1 prediction -> 1');
  assert.equal(st.actionPredictions[1], 0, 'b2503 negative prediction -> 0');
  assert.equal(st.actionPredictions[6], .5, 'b2503 missing prediction -> .5');
  assert.equal(st.lastState.length, 24, 'b2503 lastState fixed length 24');
  assert.equal(st.lastState[0], 1, 'b2503 over-1 state -> 1');
  assert.equal(st.lastState[2], .5, 'b2503 NaN state -> .5');
  assert.equal(st.horizon, 3, 'b2503 out-of-range horizon -> default');
  assert.equal(st.lesion, false, 'b2503 truthy-string lesion -> false');
  assert.equal(st.transitions.length, 1, 'b2503 drops non-object transition');
  assert.equal(st.transitions[0].action, 'wait', 'b2503 unknown action -> wait');
  assert.equal(st.transitions[0].reward01, 1, 'b2503 over-1 reward -> 1');
  assert.equal(st.transitions[0].confidence01, 0, 'b2503 negative confidence -> 0');
  assert.equal(st.transitions[0].tick, 0, 'b2503 negative tick -> 0');
  assert.doesNotThrow(() => m.restore(hostile('transitions')));
  const d = defaultB2503State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2503 default round-trips');
}

// --- B275NeuralCompositionalPolicy ------------------------------------------
{
  const m = new B275NeuralCompositionalPolicy();
  m.restore({ version: 1, tick: -1, decisions: NaN, previousAction: 'bogus', previousReward01: 9, value01: -1, policyEntropy01: NaN, exploration01: 9, compositionDiversity01: -1, neuralGrounding01: NaN, selfAlignment01: 9, personalityAlignment01: -1, activePolicyId: 5, lastSelected: 'bogus', bias: [9, -1], lastContext: [9], lastFeature: [9], composedSkills: [{ id: 's1', sourceSkillIds: [5, 'ok', ''], actions: ['respond', 'bogus'], featureAnchor: [9], reliability01: 9, transferCount: -1, createdTick: NaN, lastUsedTick: -1, status: 'bogus' }, { id: 5 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b275 negative tick -> 0');
  assert.equal(st.decisions, 0, 'b275 NaN decisions -> 0');
  assert.equal(st.previousAction, null, 'b275 unknown previous action -> null');
  assert.equal(st.previousReward01, 1, 'b275 over-1 reward -> 1');
  assert.equal(st.value01, 0, 'b275 negative value -> 0');
  assert.equal(st.exploration01, 1, 'b275 over-1 exploration -> 1');
  assert.equal(st.activePolicyId, null, 'b275 non-string policy id -> null');
  assert.equal(st.lastSelected, null, 'b275 unknown last selected -> null');
  assert.equal(st.bias.length, 32, 'b275 bias fixed length 32');
  assert.equal(st.bias[0], 1, 'b275 over-1 bias -> 1');
  assert.equal(st.bias[1], -1, 'b275 signed bias preserved at -1');
  assert.equal(st.lastContext.length, 1, 'b275 lastContext length preserved');
  assert.equal(st.composedSkills.length, 1, 'b275 drops id-less skill');
  assert.equal(st.composedSkills[0].id, 's1', 'b275 keeps valid skill');
  assert.deepEqual(st.composedSkills[0].sourceSkillIds, ['ok'], 'b275 keeps non-empty string source ids');
  assert.deepEqual(st.composedSkills[0].actions, ['respond'], 'b275 keeps only known actions');
  assert.equal(st.composedSkills[0].reliability01, 1, 'b275 over-1 reliability -> 1');
  assert.equal(st.composedSkills[0].transferCount, 0, 'b275 negative transfer count -> 0');
  assert.equal(st.composedSkills[0].status, 'experimental', 'b275 unknown status -> experimental');
  assert.doesNotThrow(() => m.restore(hostile('composedSkills')));
  const d = defaultB275State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b275 default round-trips');
}

// --- B276LatentActionProgramSynthesizer -------------------------------------
{
  const m = new B276LatentActionProgramSynthesizer();
  m.restore({ version: 1, ticks: -1, proposals: NaN, executionPlan: ['respond', 'bogus'], executionCursor: -1, executionCompletions: NaN, executionProgramId: 5, activeProgramId: 5, lastPrimitive: 'bogus', neuralGrounding01: 9, selfAlignment01: -1, actionConsequenceCredits01: { respond: 9, bogus: 1 }, executionHistory: [{ tick: -1, programId: 'p1', stepIndex: -1, primitive: 'bogus', completed: 'yes', reward01: 9 }, { tick: 1 }, 'x'], nodes: [{ id: 'n1', opLatent: [9, -1], primitive: 'bogus', children: [5, 'ok', ''], gate01: 9, value01: -1, visits: NaN }, { opLatent: [] }, 'x'], programs: [{ id: 'p1', nodes: [5, 'n1'], latent: [9, -1], predictedGain01: 9, novelty01: -1, status: 'bogus', createdTick: -1, structureRevisionCount: -1, stepCredits01: [9, -1] }, { nodes: [] }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.ticks, 0, 'b276 negative ticks -> 0');
  assert.equal(st.proposals, 0, 'b276 NaN proposals -> 0');
  assert.deepEqual(st.executionPlan, ['respond'], 'b276 keeps only known actions');
  assert.equal(st.executionCursor, 0, 'b276 negative cursor -> 0');
  assert.equal(st.executionCompletions, 0, 'b276 NaN completions -> 0');
  assert.equal(st.executionProgramId, null, 'b276 non-string execution program -> null');
  assert.equal(st.activeProgramId, null, 'b276 non-string active program -> null');
  assert.equal(st.lastPrimitive, null, 'b276 unknown last primitive -> null');
  assert.equal(st.neuralGrounding01, 1, 'b276 over-1 grounding -> 1');
  assert.equal(st.selfAlignment01, 0, 'b276 negative alignment -> 0');
  assert.equal(st.actionConsequenceCredits01.respond, 1, 'b276 over-1 credit -> 1');
  assert.equal(st.actionConsequenceCredits01.bogus, undefined, 'b276 drops unknown credit key');
  assert.equal(st.executionHistory.length, 1, 'b276 drops id-less history row');
  assert.equal(st.executionHistory[0].tick, 0, 'b276 negative history tick -> 0');
  assert.equal(st.executionHistory[0].primitive, 'wait', 'b276 unknown history primitive -> wait');
  assert.equal(st.executionHistory[0].completed, false, 'b276 truthy-string completed -> false');
  assert.equal(st.executionHistory[0].reward01, 1, 'b276 over-1 history reward -> 1');
  assert.equal(st.nodes.length, 1, 'b276 drops id-less node');
  assert.equal(st.nodes[0].id, 'n1', 'b276 keeps valid node');
  assert.equal(st.nodes[0].primitive, 'wait', 'b276 unknown node primitive -> wait');
  assert.deepEqual(st.nodes[0].children, ['ok'], 'b276 keeps non-empty string children');
  assert.equal(st.nodes[0].gate01, 1, 'b276 over-1 gate -> 1');
  assert.equal(st.nodes[0].visits, 0, 'b276 NaN visits -> 0');
  assert.equal(st.programs.length, 1, 'b276 drops id-less program');
  assert.equal(st.programs[0].id, 'p1', 'b276 keeps valid program');
  assert.deepEqual(st.programs[0].nodes, ['n1'], 'b276 keeps non-empty string program nodes');
  assert.equal(st.programs[0].predictedGain01, 1, 'b276 over-1 gain -> 1');
  assert.equal(st.programs[0].novelty01, 0, 'b276 negative novelty -> 0');
  assert.equal(st.programs[0].status, 'candidate', 'b276 unknown status -> candidate');
  assert.equal(st.programs[0].structureRevisionCount, 0, 'b276 negative revision -> 0');
  assert.equal(st.programs[0].stepCredits01[0], 1, 'b276 over-1 step credit -> 1');
  assert.doesNotThrow(() => m.restore(hostile('nodes')));
  const d = defaultB276State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b276 default round-trips');
}

// --- B281PredictiveInterAreaMessaging ---------------------------------------
{
  const m = new B281PredictiveInterAreaMessaging();
  m.restore({ version: 1, tick: -1, steps: NaN, lastAction: 'bogus', messageCoherence01: 9, delayedCredit01: -1, messageTrace: { 'sensorium->memory': [9, -1] }, availability: { 'sensorium->memory': [9] }, pending: { 'sensorium->memory': { tick: -1, edge: 5, source: [9], message: [9], predicted: [9], error01: 9, eligibility: [[9]] } }, lastMessages: { 'sensorium->memory': [9] }, lastAreaSpikes: { sensorium: [9, -1], bogus: [9] }, areaPredictionError01: { sensorium: 9 }, history: [{ tick: -1, edge: 5, error01: 9, credit01: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b281 negative tick -> 0');
  assert.equal(st.steps, 0, 'b281 NaN steps -> 0');
  assert.equal(st.lastAction, null, 'b281 unknown action -> null');
  assert.equal(st.messageCoherence01, 1, 'b281 over-1 coherence -> 1');
  assert.equal(st.delayedCredit01, 0, 'b281 negative credit -> 0');
  assert.equal(st.messageTrace['sensorium->memory'][0], 1, 'b281 over-1 trace -> 1');
  assert.equal(st.messageTrace['sensorium->memory'][1], -1, 'b281 signed trace preserved');
  assert.equal(st.messageTrace['sensorium->memory'].length, 8, 'b281 trace fixed length 8');
  assert.equal(st.availability['sensorium->memory'].length, 8, 'b281 availability fixed length 8');
  assert.ok(st.pending['sensorium->memory'], 'b281 keeps valid pending row');
  assert.equal(st.pending['sensorium->memory'].tick, 0, 'b281 negative pending tick -> 0');
  assert.equal(st.pending['sensorium->memory'].edge, 'sensorium->memory', 'b281 non-string edge -> key');
  assert.equal(st.pending['sensorium->memory'].error01, 1, 'b281 over-1 pending error -> 1');
  assert.equal(st.pending['memory->sensorium'], null, 'b281 missing pending row -> null');
  assert.equal(st.lastMessages['sensorium->memory'][0], 1, 'b281 over-1 lastMessage -> 1');
  assert.equal(st.lastAreaSpikes.sensorium.length, 8, 'b281 spikes fixed length 8');
  assert.equal(st.lastAreaSpikes.sensorium[0], 1, 'b281 over-1 spike -> 1');
  assert.equal(st.lastAreaSpikes.bogus, undefined, 'b281 drops unknown area key');
  assert.equal(Object.keys(st.lastAreaSpikes).length, 4, 'b281 keeps four canonical areas');
  assert.equal(st.areaPredictionError01.sensorium, 1, 'b281 over-1 area error -> 1');
  assert.equal(st.history.length, 1, 'b281 drops non-object history row');
  assert.equal(st.history[0].tick, 0, 'b281 negative history tick -> 0');
  assert.equal(st.history[0].credit01, 0, 'b281 negative history credit -> 0');
  assert.doesNotThrow(() => m.restore(hostile('pending')));
  const d = defaultB281State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b281 default round-trips');
}

// --- B282PredictiveGlobalWorkspace ------------------------------------------
{
  const m = new B282PredictiveGlobalWorkspace();
  m.restore({ version: 1, tick: -1, steps: NaN, ignitionCount: -1, areaEncoders: { sensorium: [[9, -1], 'x'], bogus: [[9]] }, hypothesisScores: { sensorium: 9, bogus: 9 }, globalLatent: [9, -1, NaN], predictedNextGlobal: [9], lastCoalition: ['sensorium', 'bogus', 5], ignition01: 9, globalCoherence01: -1, history: [{ tick: -1, coalition: ['sensorium', 'bogus'], score01: 9, error01: -1 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b282 negative tick -> 0');
  assert.equal(st.steps, 0, 'b282 NaN steps -> 0');
  assert.equal(st.ignitionCount, 0, 'b282 negative ignition count -> 0');
  assert.equal(st.areaEncoders.sensorium.length, 8, 'b282 encoder fixed 8 rows');
  assert.equal(st.areaEncoders.sensorium[0].length, 16, 'b282 encoder row fixed length 16');
  assert.equal(st.areaEncoders.sensorium[0][0], 1, 'b282 over-1 encoder -> 1');
  assert.equal(st.areaEncoders.sensorium[0][1], -1, 'b282 signed encoder preserved');
  assert.equal(st.areaEncoders.sensorium[1].length, 16, 'b282 non-array encoder row -> base row length 16');
  assert.ok(st.areaEncoders.sensorium[1].every(Number.isFinite), 'b282 non-array encoder row finite');
  assert.equal(st.areaEncoders.bogus, undefined, 'b282 drops unknown area encoder');
  assert.equal(st.hypothesisScores.sensorium, 1, 'b282 over-1 hypothesis score -> 1');
  assert.equal(st.hypothesisScores.bogus, undefined, 'b282 drops unknown hypothesis key');
  assert.equal(st.globalLatent.length, 16, 'b282 globalLatent fixed length 16');
  assert.equal(st.globalLatent[0], 1, 'b282 over-1 latent -> 1');
  assert.equal(st.globalLatent[1], -1, 'b282 signed latent preserved');
  assert.deepEqual(st.lastCoalition, ['sensorium'], 'b282 keeps only known coalition areas');
  assert.equal(st.ignition01, 1, 'b282 over-1 ignition -> 1');
  assert.equal(st.globalCoherence01, 0, 'b282 negative coherence -> 0');
  assert.equal(st.history.length, 1, 'b282 drops non-object history row');
  assert.deepEqual(st.history[0].coalition, ['sensorium'], 'b282 sanitizes history coalition');
  assert.equal(st.history[0].score01, 1, 'b282 over-1 history score -> 1');
  assert.equal(st.history[0].error01, 0, 'b282 negative history error -> 0');
  assert.doesNotThrow(() => m.restore(hostile('areaEncoders')));
  const d = defaultB282State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b282 default round-trips');
}

// --- B283CompetingPredictiveHypotheses --------------------------------------
{
  const m = new B283CompetingPredictiveHypotheses();
  m.restore({ version: 1, tick: -1, steps: NaN, hypothesisSwitches: -1, activeHypothesisId: 9, committedHypothesisId: 9, previousCommittedHypothesisId: -1, globalLatent: [9, -1, NaN], predictedNext: [9], plannedSequence: ['respond', 'bogus'], plannedReturn01: 9, planningSteps: -1, diversity01: 9, selfAlignment01: -1, hypotheses: [{ latent: [9, -1], predictor: [[9, -1]], actionTransition: [[9]], posterior01: 9, confidence01: -1, evidence01: NaN, lastError01: 9, age: -1, dwell: NaN, actionWeights: [[9]], status: 'bogus', switches: -1, acceptedAt: -1 }, 'x'], history: [{ tick: -1, active: -1, posterior: 9, error: -1, status: 5 }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b283 negative tick -> 0');
  assert.equal(st.steps, 0, 'b283 NaN steps -> 0');
  assert.equal(st.hypothesisSwitches, 0, 'b283 negative switches -> 0');
  assert.equal(st.activeHypothesisId, 3, 'b283 out-of-range active id -> 3');
  assert.equal(st.committedHypothesisId, 3, 'b283 out-of-range committed id -> 3');
  assert.equal(st.previousCommittedHypothesisId, 0, 'b283 negative committed id -> 0');
  assert.equal(st.globalLatent.length, 16, 'b283 globalLatent fixed length 16');
  assert.equal(st.globalLatent[0], 1, 'b283 over-1 latent -> 1');
  assert.equal(st.globalLatent[1], -1, 'b283 signed latent preserved');
  assert.deepEqual(st.plannedSequence, ['respond'], 'b283 keeps only known planned actions');
  assert.equal(st.plannedReturn01, 1, 'b283 over-1 planned return -> 1');
  assert.equal(st.planningSteps, 0, 'b283 negative planning steps -> 0');
  assert.equal(st.diversity01, 1, 'b283 over-1 diversity -> 1');
  assert.equal(st.selfAlignment01, 0, 'b283 negative self alignment -> 0');
  assert.equal(st.hypotheses.length, 4, 'b283 keeps four canonical hypotheses');
  assert.equal(st.hypotheses[0].latent.length, 16, 'b283 hypothesis latent fixed length 16');
  assert.equal(st.hypotheses[0].latent[0], 1, 'b283 over-1 hypothesis latent -> 1');
  assert.equal(st.hypotheses[0].predictor.length, 16, 'b283 predictor fixed 16 rows');
  assert.equal(st.hypotheses[0].predictor[0].length, 16, 'b283 predictor row fixed length 16');
  assert.equal(st.hypotheses[0].actionTransition.length, 7, 'b283 actionTransition fixed 7 rows');
  assert.equal(st.hypotheses[0].posterior01, 1, 'b283 over-1 posterior -> 1');
  assert.equal(st.hypotheses[0].confidence01, 0, 'b283 negative confidence -> 0');
  assert.equal(st.hypotheses[0].age, 0, 'b283 negative age -> 0');
  assert.equal(st.hypotheses[0].status, 'active', 'b283 unknown status -> active');
  assert.equal(st.hypotheses[0].switches, 0, 'b283 negative switches -> 0');
  assert.equal(st.hypotheses[1].id, 1, 'b283 non-object hypothesis -> base row');
  assert.equal(st.history.length, 1, 'b283 drops non-object history row');
  assert.equal(st.history[0].tick, 0, 'b283 negative history tick -> 0');
  assert.equal(st.history[0].posterior, 1, 'b283 over-1 history posterior -> 1');
  assert.equal(st.history[0].error, 0, 'b283 negative history error -> 0');
  assert.doesNotThrow(() => m.restore(hostile('hypotheses')));
  const d = defaultB283State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b283 default round-trips');
}

console.log('WORKPASS72_PREDICTIVEFIELD_COMPOSITIONALPROGRAM_INTERAREA_WORKSPACE_COMPETINGHYP_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B2503ActionablePredictiveField', 'B275NeuralCompositionalPolicy', 'B276LatentActionProgramSynthesizer', 'B281PredictiveInterAreaMessaging', 'B282PredictiveGlobalWorkspace', 'B283CompetingPredictiveHypotheses'] }));
