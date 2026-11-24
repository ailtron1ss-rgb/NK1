import assert from 'node:assert/strict';
import { B294CausalNeuralEventSpine } from '../src/organism/system/B294CausalNeuralEventSpine.ts';
import { CausalLifeGraph } from '../src/organism/system/CausalLifeGraph.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const spine = new B294CausalNeuralEventSpine();
const decision = spine.beginDecision({
  tick: 1, goalId: 'goal-1', action: 'explore', mode: 'autonomous', autonomy01: .82,
  predictionError01: .2, uncertainty01: .24, predictedSelf01: .8, predictedWorld01: .74,
  channelSignals: { b269:.72, b270:.66, b289:.71, b290:.68, b291:.8, b292:.74, b293:.76, world:.7 },
});
const first = spine.closeOutcome({
  tick: 1, reward01: .82, predictionError01: .18, actualSelf01: .84, actualWorld01: .8,
  external01: 1, identityContinuity01: .91, causalEffect01: .86,
});
const afterFirst = spine.metrics();
const second = spine.closeOutcome({
  tick: 1, reward01: .82, predictionError01: .18, actualSelf01: .84, actualWorld01: .8,
  external01: 1, identityContinuity01: .91, causalEffect01: .86,
});
const afterSecond = spine.metrics();
assert.equal(first.updated, true, 'first outcome must close the episode');
assert.equal(second.updated, false, 'duplicate close must be rejected');
assert.equal(second.reason, 'episode-already-closed');
assert.equal(afterSecond.outcomeCount, afterFirst.outcomeCount, 'duplicate close changed outcome count');
assert.equal(afterSecond.learningUpdates, afterFirst.learningUpdates, 'duplicate close changed learning updates');
assert.equal(afterSecond.synapticUpdates, afterFirst.synapticUpdates, 'duplicate close changed synaptic updates');
assert.equal(decision.episodeId, first.episodeId);

const graph = new CausalLifeGraph();
const start = performance.now();
for (let tick = 1; tick <= 64; tick += 1) {
  graph.recordCycle({
    tick,
    experience: { id:`exp:${tick}`, label:'embodied experience', confidence01:.82 },
    emotion: { id:`emo:${tick}`, label:'appraisal', confidence01:.72 },
    memory: { id:`mem:${tick}`, label:'retrieved memory', confidence01:.66 },
    decision: { id:`dec:${tick}`, label:'explore', confidence01:.7 },
    action: { id:`act:${tick}`, label:'explore', confidence01:.71 },
    outcome: { id:`out:${tick}`, label:'success', confidence01:.84, external01: tick%5===0?1:0 },
    learning: { id:`learn:${tick}`, label:'outcome learning', confidence01:.75 },
    selfChange: { id:`self:${tick}`, label:'bounded self-change', confidence01:.63 },
  });
}
const elapsed = performance.now() - start;
const summary = graph.summary();
assert.ok(summary.nodes <= 768, `node bound exceeded: ${summary.nodes}`);
assert.ok(summary.edges <= 1536, `edge bound exceeded: ${summary.edges}`);
assert.ok(summary.completeChains > 0, 'causal chain coverage disappeared');
assert.ok(summary.chainCoverage01 > .5, `causal chain coverage too low: ${summary.chainCoverage01}`);
const path = graph.causalPath({kind:'experience', refId:'exp:64'}, {kind:'self-change', refId:'self:64'}, 10);
assert.equal(path.found, true, 'causal path index failed');
const actionNode = graph.chainForTick(64).nodes.find((node) => node.kind === 'action');
assert.equal(actionNode?.metadata?.b294CausalEpisodeId, undefined, 'direct graph should not invent neural episode IDs');

const core = new OrganismCore(new MemoryStateStore());
await core.init();
const world = (tick) => ({ tick, location:'causal-lab', energy:.84, attention:.8, uncertainty:.3, facts:['causal'], objects:[], events:[`e${tick}`] });
const before = core.b294CausalNeuralEventDiagnostics();
for (let i = 0; i < 6; i += 1) {
  await core.observe({ text:`causal closure ${i}`, novelty:.42, worldContext:world(i) });
  await core.feedback({ success:.78, reward:.74, surprise:.12, evidenceSource:'device', worldTransition:{ action:'explore', before:world(i), after:world(i+1), reward:.74, surprise:.12, at:10000+i } });
}
const after = core.b294CausalNeuralEventDiagnostics();
assert.equal(after.outcomeCount - before.outcomeCount, 6, `B294 outcome count indicates duplicate closure: ${before.outcomeCount}->${after.outcomeCount}`);
assert.equal(after.learningUpdates - before.learningUpdates, 6, `B294 learning updates indicate duplicate closure: ${before.learningUpdates}->${after.learningUpdates}`);
const graphSummary = core.causalLifeGraphSummary();
assert.ok(graphSummary.completeChains >= 1, 'live causal life graph lost complete chains');
const liveCausal = core.snapshot().system.causalLifeGraph;
const linkedOutcome = (liveCausal.nodes ?? []).find((node) => node.kind === 'outcome' && node.metadata?.b294CausalEpisodeId);
assert.ok(linkedOutcome?.metadata?.b294CausalEpisodeId, 'B294 episode lineage did not reach persistent causal outcome node');

console.log(`P2865_CAUSAL_EVENT_CLOSURE=PASS spineEpisode=${decision.episodeId} graphNodes=${summary.nodes} graphEdges=${summary.edges} chainCoverage=${summary.chainCoverage01.toFixed(3)} graph64ms=${elapsed.toFixed(1)} coreOutcomes=${before.outcomeCount}->${after.outcomeCount}`);
