import assert from 'node:assert/strict';
import { P69ConstitutionalArbiter, defaultP69 } from '../src/organism/cognition/P69ConstitutionalArbiter.ts';
import { P61IntegratedMindKernel, defaultP61 } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P58CognitiveKernel, defaultP58 } from '../src/organism/cognition/P58CognitiveKernel.ts';
import { PerceptualEpistemicGraph, defaultEpistemicState } from '../src/organism/cognition/PerceptualEpistemicGraph.ts';
import { NeuroSymbolicConceptCompiler, defaultNeuroSymbolicCompiler } from '../src/organism/cognition/NeuroSymbolicConceptCompiler.ts';
import { B2518PersistentSelfWorldModel, defaultB2518State } from '../src/organism/cognition/B2518PersistentSelfWorldModel.ts';
import { NeuromodulationSystem } from '../src/organism/cognition/NeuromodulationSystem.ts';

/**
 * WorkPass72 — cognition kernels, epistemic graph, concept compiler,
 * persistent self-world model and neuromodulation restore integrity. Each owner
 * merged a persisted snapshot with a bare spread (or structuredClone), letting
 * NaN reach kernel metrics, mode counters, concept centroids, learned
 * transitions and neuromodulator levels.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- P69ConstitutionalArbiter -----------------------------------------------
{
  const a = new P69ConstitutionalArbiter();
  a.restore({ version: 1, cycles: -1, vetoes: NaN, cautions: -1, modeChanges: NaN, forcedDiversions: -1, modeCounts: { protect: -1, bogus: 5 }, meanConfidence01: 9, meanConstraintSlack01: -1, lastMode: 'bogus', modeStreak: NaN, recentActions: ['a', 5, ''], lastChosen: 5 });
  const st = a.snapshot();
  assert.equal(st.cycles, 0, 'p69 negative cycles -> 0');
  assert.equal(st.vetoes, 0, 'p69 NaN vetoes -> 0');
  assert.equal(st.modeCounts.protect, 0, 'p69 negative mode count -> 0');
  assert.ok(!('bogus' in st.modeCounts), 'p69 drops unknown mode key');
  assert.equal(st.meanConfidence01, 1, 'p69 over-1 confidence -> 1');
  assert.equal(st.meanConstraintSlack01, 0, 'p69 negative slack -> 0');
  assert.equal(st.lastMode, 'observe', 'p69 unknown lastMode -> observe');
  assert.equal(st.modeStreak, 0, 'p69 NaN streak -> 0');
  assert.deepEqual(st.recentActions, ['a'], 'p69 drops non-string/empty actions');
  assert.equal(st.lastChosen, null, 'p69 non-string lastChosen -> null');
  assert.doesNotThrow(() => a.restore(hostile('modeCounts')));
  const d = defaultP69();
  a.restore(d);
  assert.deepEqual(a.snapshot(), d, 'p69 default round-trips');
}

// --- P61IntegratedMindKernel ------------------------------------------------
{
  const k = new P61IntegratedMindKernel();
  const badFrame = { tick: -1, at: -1, mode: 'bogus', ignited: 'yes', ignition01: 9, competition01: -1, coalition: ['a', 5], broadcastToken: 5, confidence01: 9, integration01: -1, stability01: NaN, realityGap01: 9, developmentalPressure01: -1, memoryPressure01: NaN, actionBias: { respond: 9, bad: -1 }, reasons: ['r', 5], externalInput: 'yes' };
  k.restore({ version: 1, cycles: -1, ignitions: NaN, modeCounts: { orient: -1, bogus: 5 }, meanIntegration01: 9, meanStability01: -1, meanIgnition01: NaN, meanRealityGap01: 9, lastFrame: badFrame, frames: [badFrame, null] });
  const st = k.snapshot();
  assert.equal(st.cycles, 0, 'p61 negative cycles -> 0');
  assert.equal(st.ignitions, 0, 'p61 NaN ignitions -> 0');
  assert.equal(st.modeCounts.orient, 0, 'p61 negative mode count -> 0');
  assert.ok(!('bogus' in st.modeCounts), 'p61 drops unknown mode key');
  assert.equal(st.meanIntegration01, 1, 'p61 over-1 integration -> 1');
  assert.equal(st.meanStability01, 0, 'p61 negative stability -> 0');
  assert.equal(st.meanIgnition01, .35, 'p61 NaN ignition -> default');
  assert.equal(st.frames.length, 1, 'p61 drops non-object frame');
  assert.equal(st.frames[0].mode, 'orient', 'p61 unknown frame mode -> orient');
  assert.equal(st.frames[0].ignited, false, 'p61 non-boolean ignited -> false');
  assert.equal(st.frames[0].ignition01, 1, 'p61 over-1 frame ignition -> 1');
  assert.deepEqual(st.frames[0].coalition, ['a'], 'p61 drops non-string coalition');
  assert.equal(st.frames[0].broadcastToken, '', 'p61 non-string token -> empty');
  assert.equal(st.frames[0].actionBias.respond, 1, 'p61 over-1 bias -> 1');
  assert.equal(st.frames[0].actionBias.bad, 0, 'p61 negative bias -> 0');
  assert.deepEqual(st.frames[0].reasons, ['r'], 'p61 drops non-string reasons');
  assert.equal(st.lastFrame.mode, 'orient', 'p61 lastFrame sanitized');
  assert.doesNotThrow(() => k.restore(hostile('frames')));
  const d = defaultP61();
  k.restore(d);
  assert.deepEqual(k.snapshot(), d, 'p61 default round-trips');
}

// --- P58CognitiveKernel -----------------------------------------------------
{
  const k = new P58CognitiveKernel();
  const badFrame = { tick: -1, at: -1, mode: 'bogus', salience01: 9, confidence01: -1, integrated01: NaN, stability01: 9, realityGap01: -1, actionBias: { verify: 9, bad: -1 }, reasons: ['r', 5], broadcastToken: 5 };
  k.restore({ version: 1, cycles: -1, modeCounts: { stabilize: -1, bogus: 5 }, meanIntegrated01: 9, meanStability01: -1, meanRealityGap01: NaN, lastFrame: badFrame, frames: [badFrame, null] });
  const st = k.snapshot();
  assert.equal(st.cycles, 0, 'p58 negative cycles -> 0');
  assert.equal(st.modeCounts.stabilize, 0, 'p58 negative mode count -> 0');
  assert.ok(!('bogus' in st.modeCounts), 'p58 drops unknown mode key');
  assert.equal(st.meanIntegrated01, 1, 'p58 over-1 integrated -> 1');
  assert.equal(st.meanStability01, 0, 'p58 negative stability -> 0');
  assert.equal(st.meanRealityGap01, .5, 'p58 NaN reality gap -> default');
  assert.equal(st.frames.length, 1, 'p58 drops non-object frame');
  assert.equal(st.frames[0].mode, 'stabilize', 'p58 unknown frame mode -> stabilize');
  assert.equal(st.frames[0].salience01, 1, 'p58 over-1 salience -> 1');
  assert.equal(st.frames[0].confidence01, 0, 'p58 negative confidence -> 0');
  assert.equal(st.frames[0].integrated01, 0, 'p58 NaN integrated -> 0');
  assert.equal(st.frames[0].actionBias.verify, 1, 'p58 over-1 bias -> 1');
  assert.equal(st.frames[0].actionBias.bad, 0, 'p58 negative bias -> 0');
  assert.equal(st.frames[0].broadcastToken, '', 'p58 non-string token -> empty');
  assert.equal(st.lastFrame.mode, 'stabilize', 'p58 lastFrame sanitized');
  assert.doesNotThrow(() => k.restore(hostile('frames')));
  const d = defaultP58();
  k.restore(d);
  assert.deepEqual(k.snapshot(), d, 'p58 default round-trips');
}

// --- PerceptualEpistemicGraph -----------------------------------------------
{
  const g = new PerceptualEpistemicGraph();
  g.restore({ version: 1, claims: [{ id: 'c1', at: -1, modality: 5, claim: 'x', source: 'bogus', confidence01: 9, targetIds: ['t', 5], supersedes: 5 }, { claim: 'no-id' }], contradictionPairs: -1, resolvedPairs: NaN, corroboratedPairs: -1, meanConfidence01: 9, lastAt: -1 });
  const st = g.snapshot();
  assert.equal(st.claims.length, 1, 'peg drops claim without id');
  assert.equal(st.claims[0].source, 'unresolved', 'peg unknown source -> unresolved');
  assert.equal(st.claims[0].confidence01, 1, 'peg over-1 confidence -> 1');
  assert.equal(st.claims[0].at, 0, 'peg negative at -> 0');
  assert.equal(st.claims[0].modality, '', 'peg non-string modality -> empty');
  assert.deepEqual(st.claims[0].targetIds, ['t'], 'peg drops non-string targetIds');
  assert.equal(st.claims[0].supersedes, undefined, 'peg non-string supersedes -> undefined');
  assert.equal(st.contradictionPairs, 0, 'peg negative pairs -> 0');
  assert.equal(st.resolvedPairs, 0, 'peg NaN pairs -> 0');
  assert.equal(st.meanConfidence01, 1, 'peg over-1 mean -> 1');
  assert.equal(st.lastAt, 0, 'peg negative lastAt -> 0');
  assert.doesNotThrow(() => g.restore(hostile('claims')));
  const d = defaultEpistemicState();
  g.restore(d);
  assert.deepEqual(g.snapshot(), d, 'peg default round-trips');
}

// --- NeuroSymbolicConceptCompiler -------------------------------------------
{
  const c = new NeuroSymbolicConceptCompiler();
  c.restore({ version: 1, cycles: -1, compiled: NaN, concepts: { cat: { label: 5, centroid: [9, -1, NaN], confidence01: 9, uses: -1, success01: -1 }, empty: { centroid: [] }, bad: 'x' }, mappingCoherence01: 9, lastConcept: 5 });
  const st = c.snapshot();
  assert.equal(st.cycles, 0, 'nsc negative cycles -> 0');
  assert.equal(st.compiled, 0, 'nsc NaN compiled -> 0');
  assert.equal(st.mappingCoherence01, 1, 'nsc over-1 coherence -> 1');
  assert.equal(st.lastConcept, 'none', 'nsc non-string lastConcept -> default');
  assert.equal(st.concepts.cat.centroid[0], 1, 'nsc over-1 centroid -> 1');
  assert.equal(st.concepts.cat.centroid[1], 0, 'nsc negative centroid -> 0');
  assert.equal(st.concepts.cat.centroid[2], 0, 'nsc NaN centroid -> 0');
  assert.equal(st.concepts.cat.confidence01, 1, 'nsc over-1 confidence -> 1');
  assert.equal(st.concepts.cat.uses, 0, 'nsc negative uses -> 0');
  assert.ok(!('empty' in st.concepts), 'nsc drops empty-centroid concept');
  assert.ok(!('bad' in st.concepts), 'nsc drops non-object concept');
  assert.doesNotThrow(() => c.restore(hostile('concepts')));
  const d = defaultNeuroSymbolicCompiler();
  c.restore(d);
  assert.deepEqual(c.snapshot(), d, 'nsc default round-trips');
}

// --- B2518PersistentSelfWorldModel ------------------------------------------
{
  const m = new B2518PersistentSelfWorldModel();
  m.restore({ version: 1, enabled: 'no', tick: -1, cycles: NaN, learningUpdates: -1, predictions: NaN, transitions: -1, confidence01: 9, selfContinuity01: -1, worldStability01: NaN, predictionError01: 9, actionBias: { respond: 9, bogus: -1 }, model: { t1: { n: -1, action: 'bogus', reward01: 9, error01: -1, verified01: NaN, nextKey: 5, confidence01: 9, lastTick: -1 }, bad: 'x' }, lastKey: 5, lesionFraction01: 9 });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2518 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2518 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2518 NaN cycles -> 0');
  assert.equal(st.transitions, 1, 'b2518 recomputes transitions from model');
  assert.equal(st.confidence01, 1, 'b2518 over-1 confidence -> 1');
  assert.equal(st.selfContinuity01, 0, 'b2518 negative continuity -> 0');
  assert.equal(st.worldStability01, .55, 'b2518 NaN stability -> default');
  assert.equal(st.actionBias.respond, .065, 'b2518 bias clamped to .065');
  assert.equal(st.actionBias.bogus, undefined, 'b2518 drops unknown bias key');
  assert.equal(st.model.t1.action, 'wait', 'b2518 unknown transition action -> wait');
  assert.equal(st.model.t1.reward01, 1, 'b2518 over-1 reward -> 1');
  assert.equal(st.model.t1.n, 0, 'b2518 negative n -> 0');
  assert.equal(st.model.t1.nextKey, '', 'b2518 non-string nextKey -> empty');
  assert.ok(!('bad' in st.model), 'b2518 drops non-object transition');
  assert.equal(st.lastKey, 'root', 'b2518 non-string lastKey -> default');
  assert.equal(st.lesionFraction01, 1, 'b2518 over-1 lesion -> 1');
  assert.doesNotThrow(() => m.restore(hostile('model')));
  const d = defaultB2518State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2518 default round-trips');
}

// --- NeuromodulationSystem --------------------------------------------------
{
  const n = new NeuromodulationSystem();
  const before = n.snapshot();
  n.restore({ dopamine01: 9, norepinephrine01: -1, acetylcholine01: NaN, serotonin01: 'x', explorationBias01: 9, exploitationBias01: -1, attentionGain01: NaN, updateRate01: 9, bogus: 5 });
  const st = n.snapshot();
  assert.equal(st.dopamine01, 1, 'nm over-1 dopamine -> 1');
  assert.equal(st.norepinephrine01, 0, 'nm negative -> 0');
  assert.equal(st.acetylcholine01, before.acetylcholine01, 'nm NaN -> keeps current');
  assert.equal(st.serotonin01, before.serotonin01, 'nm non-number -> keeps current');
  assert.ok(!('bogus' in st), 'nm drops unknown key');
  assert.doesNotThrow(() => n.restore(hostile('dopamine01')));
  n.restore(undefined);
  assert.deepEqual(n.snapshot(), st, 'nm undefined restore is a no-op');
}

console.log('WORKPASS72_COGNITION_KERNELS_EPISTEMIC_CONCEPT_SELFWORLD_NEUROMOD_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P69ConstitutionalArbiter', 'P61IntegratedMindKernel', 'P58CognitiveKernel', 'PerceptualEpistemicGraph', 'NeuroSymbolicConceptCompiler', 'B2518PersistentSelfWorldModel', 'NeuromodulationSystem'] }));
