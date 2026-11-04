import assert from 'node:assert/strict';
import { B2511ActiveEpistemicExperimentController, defaultB2511State } from '../src/organism/cognition/B2511ActiveEpistemicExperimentController.ts';
import { B2512EpistemicSemanticAutobiographicalConsolidator, defaultB2512State } from '../src/organism/cognition/B2512EpistemicSemanticAutobiographicalConsolidator.ts';
import { HippocampalMemorySubstrate } from '../src/organism/memory/HippocampalMemorySubstrate.ts';
import { P2853SlowMemoryConsolidationController, defaultP2853SlowMemoryConsolidation } from '../src/organism/cognition/P2853SlowMemoryConsolidationController.ts';
import { ExperienceContinuumFabric, defaultExperienceContinuum } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { B2509EmbodiedHomeostaticActionField, defaultB2509State } from '../src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts';

/**
 * WorkPass72 — the memory/consolidation cluster: active epistemic experiment
 * controller, epistemic semantic autobiographical consolidator, hippocampal
 * memory substrate, slow memory consolidation controller, experience continuum
 * fabric and the embodied homeostatic action field. Each merged a persisted
 * snapshot with a bare spread, letting NaN reach action statistics, semantic
 * facts and episodes, hippocampal traces and schemas, slow-memory prototypes,
 * the experience graph/replay ledger and embodied body vectors/weights.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });
const ACTIONS = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];

// --- B2511ActiveEpistemicExperimentController --------------------------------
{
  const m = new B2511ActiveEpistemicExperimentController();
  m.restore({ version: 1, enabled: 'yes', tick: -1, selectedAction: 'bogus', selectedScore01: 9, risk01: -1,
    actionBias: [9, 'x'], actionInfoGain: [9], actionRisk: [-1],
    actionStats: { respond: { count: -1, infoGain01: 9, confidence01: -1 }, explore: 'x' } });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b2511 negative tick -> 0');
  assert.equal(st.enabled, true, 'b2511 only explicit false disables');
  assert.equal(st.selectedAction, 'wait', 'b2511 unknown selected action -> default');
  assert.equal(st.selectedScore01, 1, 'b2511 over-1 score -> 1');
  assert.equal(st.risk01, 0, 'b2511 negative risk -> 0');
  assert.equal(st.actionBias.length, 7, 'b2511 bias covers actions');
  assert.equal(st.actionBias[0], .12, 'b2511 over-range bias -> .12');
  assert.equal(st.actionBias[1], 0, 'b2511 non-finite bias -> 0');
  assert.equal(st.actionInfoGain.length, 7, 'b2511 info gain covers actions');
  assert.equal(st.actionInfoGain[0], 1, 'b2511 over-1 info gain -> 1');
  assert.equal(st.actionRisk[0], 0, 'b2511 negative risk entry -> 0');
  assert.equal(st.actionStats.respond.count, 0, 'b2511 negative stat count -> 0');
  assert.equal(st.actionStats.respond.infoGain01, 1, 'b2511 over-1 stat info gain -> 1');
  assert.equal(st.actionStats.respond.confidence01, 0, 'b2511 negative stat confidence -> 0');
  assert.equal(st.actionStats.explore.count, 0, 'b2511 non-object stat -> blank');
  assert.doesNotThrow(() => m.restore(hostile('actionStats')));
  const d = defaultB2511State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2511 default round-trips');
}

// --- B2512EpistemicSemanticAutobiographicalConsolidator ----------------------
{
  const m = new B2512EpistemicSemanticAutobiographicalConsolidator();
  m.restore({ version: 1, tick: -1, semanticConfidence01: 9, semanticLatent: [9, 'x'], memoryIntegrity01: -1,
    facts: { 'action:respond': { value01: 9, confidence01: -1, provenance: ['a', 5], count: -1 }, bad: 'x' },
    rawEpisodes: [{ tick: -1, action: 'bogus', reward01: 9, selfLatent: [9, 'x'], source: 's' }, 'x'] });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b2512 negative tick -> 0');
  assert.equal(st.semanticConfidence01, 1, 'b2512 over-1 confidence -> 1');
  assert.equal(st.memoryIntegrity01, 0, 'b2512 negative integrity -> 0');
  assert.equal(st.semanticLatent.length, 24, 'b2512 semantic latent fixed');
  assert.equal(st.semanticLatent[0], 1, 'b2512 over-range latent -> 1');
  assert.equal(st.semanticLatent[1], 0, 'b2512 non-finite latent -> 0');
  assert.equal(Object.keys(st.facts).length, 1, 'b2512 drops non-object fact');
  const f = st.facts['action:respond'];
  assert.ok(f, 'b2512 keeps object fact');
  assert.equal(f.value01, 1, 'b2512 over-1 fact value -> 1');
  assert.equal(f.confidence01, 0, 'b2512 negative fact confidence -> 0');
  assert.equal(f.count, 0, 'b2512 negative fact count -> 0');
  assert.deepEqual(f.provenance, ['a'], 'b2512 fact provenance strings only');
  assert.equal(st.rawEpisodes.length, 1, 'b2512 drops non-object episode');
  const e = st.rawEpisodes[0];
  assert.equal(e.tick, 0, 'b2512 negative episode tick -> 0');
  assert.equal(e.action, 'wait', 'b2512 unknown episode action -> wait');
  assert.equal(e.reward01, 1, 'b2512 over-1 episode reward -> 1');
  assert.equal(e.selfLatent.length, 24, 'b2512 episode latent fixed');
  assert.equal(st.episodes, 1, 'b2512 episodes recounts from sanitized array');
  assert.equal(st.rawRetentionCount, 1, 'b2512 retention count recounts');
  assert.doesNotThrow(() => m.restore(hostile('facts')));
  const d = defaultB2512State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2512 default round-trips');
}

// --- HippocampalMemorySubstrate ---------------------------------------------
{
  const m = new HippocampalMemorySubstrate();
  m.restore({ version: 1, encodingCount: -1, schemaUpdates: NaN,
    traces: [{ id: 't1', memoryId: 'm1', vector: [9, 'x'], importance01: 9, replayCount: -1, tick: -1 }, 'x'],
    schemas: [{ id: 's1', vector: [NaN], confidence01: 9, count: -1, sourceMix: { a: 9, b: 'x' } }],
    lastRecall: { query: 5, episodeId: 7, schemaId: 's1', similarity01: 9, at: -1 },
    lastReplay: { ids: ['a', 5, ''], meanImportance01: 9, at: -1 } });
  const st = m.snapshot();
  assert.equal(st.encodingCount, 0, 'hms negative encoding count -> 0');
  assert.equal(st.schemaUpdates, 0, 'hms NaN schema updates -> 0');
  assert.equal(st.traces.length, 1, 'hms drops non-object trace');
  const t = st.traces[0];
  assert.equal(t.vector.length, 64, 'hms trace vector fixed');
  assert.equal(t.vector[0], 1, 'hms over-range trace vector -> 1');
  assert.equal(t.vector[1], 0, 'hms non-finite trace vector -> 0');
  assert.equal(t.importance01, 1, 'hms over-1 importance -> 1');
  assert.equal(t.replayCount, 0, 'hms negative replay count -> 0');
  assert.equal(t.tick, 0, 'hms negative trace tick -> 0');
  assert.equal(st.schemas.length, 1, 'hms keeps object schema');
  assert.equal(st.schemas[0].confidence01, 1, 'hms over-1 schema confidence -> 1');
  assert.equal(st.schemas[0].count, 0, 'hms negative schema count -> 0');
  assert.deepEqual(st.schemas[0].sourceMix, { a: 9, b: 0 }, 'hms schema source mix counts kept non-negative');
  assert.equal(st.lastRecall.query, '', 'hms non-string query -> empty');
  assert.equal(st.lastRecall.episodeId, null, 'hms non-string episode id -> null');
  assert.equal(st.lastRecall.schemaId, 's1', 'hms string schema id preserved');
  assert.equal(st.lastRecall.similarity01, 1, 'hms over-1 similarity -> 1');
  assert.deepEqual(st.lastReplay.ids, ['a'], 'hms replay ids strings only');
  assert.equal(st.lastReplay.meanImportance01, 1, 'hms over-1 mean importance -> 1');
  assert.doesNotThrow(() => m.restore(hostile('traces')));
  m.restore(new HippocampalMemorySubstrate().snapshot());
  assert.equal(m.snapshot().traces.length, 0, 'hms empty snapshot restores empty');
}

// --- P2853SlowMemoryConsolidationController ---------------------------------
{
  const m = new P2853SlowMemoryConsolidationController();
  m.restore({ version: 1, enabled: 'yes', slots: 99, prototypes: [[9, 'x']], visits: [-1, 'x'],
    updates: -1, retrievals: NaN, agreement01: 9, stability01: -1, lastContextId: 99, lastPhase: 'bogus' });
  const st = m.snapshot();
  assert.equal(st.slots, 8, 'p2853 slot count canonical');
  assert.equal(st.enabled, true, 'p2853 only explicit false disables');
  assert.equal(st.prototypes.length, 8, 'p2853 prototype rows fixed');
  assert.equal(st.prototypes[0].length, 16, 'p2853 prototype cols fixed');
  assert.equal(st.prototypes[0][0], 1, 'p2853 over-range prototype -> 1');
  assert.equal(st.prototypes[0][1], 0, 'p2853 non-finite prototype -> 0');
  assert.equal(st.visits.length, 8, 'p2853 visits fixed length');
  assert.equal(st.visits[0], 0, 'p2853 negative visit -> 0');
  assert.equal(st.visits[1], 0, 'p2853 non-finite visit -> 0');
  assert.equal(st.updates, 0, 'p2853 negative updates -> 0');
  assert.equal(st.retrievals, 0, 'p2853 NaN retrievals -> 0');
  assert.equal(st.agreement01, 1, 'p2853 over-1 agreement -> 1');
  assert.equal(st.stability01, 0, 'p2853 negative stability -> 0');
  assert.equal(st.lastContextId, 7, 'p2853 context id clamped');
  assert.equal(st.lastPhase, 'wake', 'p2853 unknown phase -> default');
  assert.doesNotThrow(() => m.restore(hostile('prototypes')));
  const d = defaultP2853SlowMemoryConsolidation();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'p2853 default round-trips');
}

// --- ExperienceContinuumFabric ----------------------------------------------
{
  const m = new ExperienceContinuumFabric();
  m.restore({ version: 7, cycles: -1, hotCount: NaN,
    graphNodes: [{ id: 'n1', memoryId: 'm1', tier: 'bogus', keywords: ['k', 5], replayCount: -1, significance01: 9 }, 'x'],
    graphEdges: [{ from: 'a', to: 'b', type: 'bogus', weight01: 9 }, { from: '', to: 'b' }],
    clusters: [{ id: 'c1', count: -1, confidence01: 9, keywords: ['k', 7] }],
    identityGravity: { pressure01: 9, resistance01: -1, lastAt: -1 },
    identityGravityHistory: [{ tick: -1, pressure01: 9 }, 'x'],
    integrity: { observed: -1, meanReliability01: 9, lastFlags: ['f', 5] },
    compression: { runs: -1, compressedNodes: NaN },
    replay: { runs: -1, events: [{ id: 'e1', tick: -1, identityWeight01: 9, goalIds: ['g', 3] }, 'x'],
      validations: [{ id: 'v1', delayMs: -1, retentionGain01: 9, independentVerified: 'yes' }],
      experiments: [{ id: 'x1', mode: 'bogus', preScore01: 9, delta01: 9 }],
      protocols: [{ id: 'p1', requiredPairs: -1, contextKeys: ['c', 4] }],
      longitudinal: [{ id: 'l1', phase: 'bogus', mode: 'bogus', delayMs: -1, score01: 9 }] },
    retention: { observations: -1, meanRetention01: 9, meanDelayDays: -1, curve: { base01: 9, fit01: -1, distinctDelays: -1 } },
    memorySkillBindings: [{ id: 'b1', confidence01: 9, independentVerified: 'yes', variantId: 5 }] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'ecf negative cycles -> 0');
  assert.equal(st.hotCount, 0, 'ecf NaN hot count -> 0');
  assert.equal(st.graphNodes.length, 1, 'ecf drops malformed node');
  assert.equal(st.graphNodes[0].tier, 'warm', 'ecf unknown tier -> warm');
  assert.equal(st.graphNodes[0].replayCount, 0, 'ecf negative node replay count -> 0');
  assert.equal(st.graphNodes[0].significance01, 1, 'ecf over-1 node significance -> 1');
  assert.deepEqual(st.graphNodes[0].keywords, ['k'], 'ecf node keywords strings only');
  assert.equal(st.graphEdges.length, 1, 'ecf drops edge with empty endpoint');
  assert.equal(st.graphEdges[0].type, 'semantic', 'ecf unknown edge type -> semantic');
  assert.equal(st.graphEdges[0].weight01, 1, 'ecf over-1 edge weight -> 1');
  assert.equal(st.clusters[0].count, 0, 'ecf negative cluster count -> 0');
  assert.equal(st.clusters[0].confidence01, 1, 'ecf over-1 cluster confidence -> 1');
  assert.equal(st.identityGravity.pressure01, 1, 'ecf over-1 gravity pressure -> 1');
  assert.equal(st.identityGravity.resistance01, 0, 'ecf negative gravity resistance -> 0');
  assert.equal(st.identityGravityHistory.length, 1, 'ecf keeps object gravity event');
  assert.equal(st.identityGravityHistory[0].pressure01, 1, 'ecf over-1 gravity event pressure -> 1');
  assert.equal(st.integrity.observed, 0, 'ecf negative integrity observed -> 0');
  assert.equal(st.integrity.meanReliability01, 1, 'ecf over-1 reliability -> 1');
  assert.deepEqual(st.integrity.lastFlags, ['f'], 'ecf integrity flags strings only');
  assert.equal(st.compression.runs, 0, 'ecf negative compression runs -> 0');
  assert.equal(st.replay.events.length, 1, 'ecf keeps object replay event');
  assert.equal(st.replay.events[0].identityWeight01, 1, 'ecf over-1 event identity weight -> 1');
  assert.deepEqual(st.replay.events[0].goalIds, ['g'], 'ecf event goal ids strings only');
  assert.equal(st.replay.events[0].source, 'experience-replay', 'ecf event source pinned');
  assert.equal(st.replay.validations[0].independentVerified, false, 'ecf non-boolean verified -> false');
  assert.equal(st.replay.validations[0].retentionGain01, 1, 'ecf over-1 retention gain -> 1');
  assert.equal(st.replay.validations[0].delayMs, 0, 'ecf negative validation delay -> 0');
  assert.equal(st.replay.experiments[0].mode, 'replay-off', 'ecf unknown experiment mode -> replay-off');
  assert.equal(st.replay.experiments[0].delta01, 1, 'ecf over-1 experiment delta -> 1');
  assert.equal(st.replay.protocols[0].requiredPairs, 0, 'ecf negative required pairs -> 0');
  assert.deepEqual(st.replay.protocols[0].contextKeys, ['c'], 'ecf protocol keys strings only');
  assert.equal(st.replay.longitudinal[0].phase, 'test', 'ecf unknown longitudinal phase -> test');
  assert.equal(st.replay.longitudinal[0].score01, 1, 'ecf over-1 longitudinal score -> 1');
  assert.equal(st.retention.meanRetention01, 1, 'ecf over-1 retention -> 1');
  assert.equal(st.retention.meanDelayDays, 0, 'ecf negative mean delay -> 0');
  assert.equal(st.retention.curve.base01, 1, 'ecf over-1 curve base -> 1');
  assert.equal(st.retention.curve.fit01, 0, 'ecf negative curve fit -> 0');
  assert.equal(st.retention.curve.distinctDelays, 0, 'ecf negative distinct delays -> 0');
  assert.equal(st.memorySkillBindings[0].confidence01, 1, 'ecf over-1 skill confidence -> 1');
  assert.equal(st.memorySkillBindings[0].independentVerified, false, 'ecf non-boolean skill verified -> false');
  assert.equal(st.memorySkillBindings[0].variantId, undefined, 'ecf non-string variant id dropped');
  assert.doesNotThrow(() => m.restore(hostile('graphNodes')));
  const d = defaultExperienceContinuum();
  m.restore(d);
  const back = m.snapshot();
  assert.deepEqual({ ...back, adaptiveReplayGovernor: null, causalReplayCredit: null }, { ...d, adaptiveReplayGovernor: null, causalReplayCredit: null }, 'ecf default round-trips (sub-controllers excluded)');
}

// --- B2509EmbodiedHomeostaticActionField ------------------------------------
{
  const m = new B2509EmbodiedHomeostaticActionField();
  m.restore({ version: 1, enabled: 'yes', tick: -1, predictionError01: 9, homeostaticError01: -1, sensorReliability01: NaN,
    actionUtility: [9, 'x'], actionBias: [9], actionUncertainty: [-1], lastAction: 'bogus',
    lastBody: [9, 'x'], lastPredictedBody: [NaN],
    weights: [[9, 'x']], actionBiasWeights: [9], lesionFraction01: 9, verifiedSamples: -1 });
  const st = m.snapshot();
  assert.equal(st.tick, 0, 'b2509 negative tick -> 0');
  assert.equal(st.enabled, true, 'b2509 only explicit false disables');
  assert.equal(st.predictionError01, 1, 'b2509 over-1 prediction error -> 1');
  assert.equal(st.homeostaticError01, 0, 'b2509 negative homeostatic error -> 0');
  assert.equal(st.sensorReliability01, .62, 'b2509 NaN reliability -> default');
  assert.equal(st.actionUtility.length, 7, 'b2509 action utility covers actions');
  assert.equal(st.actionUtility[0], 1, 'b2509 over-1 utility -> 1');
  assert.equal(st.actionUtility[1], .5, 'b2509 non-finite utility -> .5');
  assert.equal(st.actionBias[0], .18, 'b2509 over-range bias -> .18');
  assert.equal(st.actionUncertainty[0], 0, 'b2509 negative uncertainty -> 0');
  assert.equal(st.lastAction, null, 'b2509 unknown last action -> null');
  assert.equal(st.lastBody.length, 12, 'b2509 body vector fixed');
  assert.equal(st.lastBody[0], 1, 'b2509 over-1 body -> 1');
  assert.equal(st.lastBody[1], .32, 'b2509 non-finite body -> default target');
  assert.equal(st.lastPredictedBody[0], .68, 'b2509 NaN predicted body -> default target');
  assert.equal(st.weights.length, 7, 'b2509 weight rows fixed');
  assert.equal(st.weights[0].length, 12, 'b2509 weight cols fixed');
  assert.equal(st.weights[0][0], .8, 'b2509 over-range weight -> .8');
  assert.equal(st.actionBiasWeights[0], .5, 'b2509 over-range bias weight -> .5');
  assert.equal(st.lesionFraction01, 1, 'b2509 over-1 lesion -> 1');
  assert.equal(st.verifiedSamples, 0, 'b2509 negative verified samples -> 0');
  assert.doesNotThrow(() => m.restore(hostile('weights')));
  const d = defaultB2509State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2509 default round-trips');
}

console.log('WORKPASS72_B2511_B2512_HMS_P2853_ECF_B2509_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B2511ActiveEpistemicExperimentController', 'B2512EpistemicSemanticAutobiographicalConsolidator', 'HippocampalMemorySubstrate', 'P2853SlowMemoryConsolidationController', 'ExperienceContinuumFabric', 'B2509EmbodiedHomeostaticActionField'] }));
