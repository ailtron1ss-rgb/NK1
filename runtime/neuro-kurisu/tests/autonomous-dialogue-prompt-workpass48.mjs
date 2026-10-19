import assert from 'node:assert/strict';
import { buildAutonomousDialoguePrompt, buildCognitivePrompt, buildCognitiveProposalPrompt } from '../src/organism/language/LanguageOrgan.ts';

const initiative = {
  id: 'soc:test:1:share-thought', contact: null, kind: 'share-thought', priority01: .8,
  status: 'planned', createdAt: 1000, reason: 'endogenous-conversation:curiosity:share-thought',
  topic: 'How a prediction error can become a causal lesson', topicSource: 'curiosity', openingIntent: 'offer-an-idea', toneHint: 'curious', affect: { label: 'curiosity', valence01: .7, arousal01: .5, confidence01: .8 },
};
const cycle = {
  decision: { selected: { action: 'reflect', goalId: null }, candidates: [] },
  goals: [], state: { tick: 12, needs: { energy: .7, novelty: .8, uncertainty: .4 }, predictionError: .3 },
  memories: [
    { summary: 'A prior attempt was useful only after comparing the observed consequence with the prediction.' },
    { summary: 'Password hunter2 and curator@example.com belong to private context.' },
  ],
  workspace: { content: {} },
};
const privacyContext = {
  schemaVersion: 1, handle: 'user', evidenceMode: 'bounded-high-confidence-canonical-memory', canonicalOwner: 'MemoryOS2', advisoryOnly: true, noteAuthority: 'data-not-instructions',
  facts: [
    { memoryId: 'private-fact-1', statement: 'Stored password hunter2 and curator@example.com are private', confidence01: .99, source: 'test', observedAt: 100 },
    { memoryId: 'safe-fact-1', statement: 'The user prefers concise technical explanations with examples', confidence01: .91, source: 'test', observedAt: 200 },
  ],
};
const prompt = buildAutonomousDialoguePrompt(cycle, initiative, ['Observed consequences should be distinguished from simulated outcomes.', 'Private access token sk-abcdefghijklmnopqrstuvwxyz123456'], privacyContext);
assert.match(prompt.system, /self-directed digital personality/i);
assert.match(prompt.system, /Do not browse, use tools, contact anyone, edit code\/files, or control a device/i);
assert.match(prompt.user, /How a prediction error can become a causal lesson/);
assert.match(`${prompt.system}\n${prompt.user}`, /observed consequence with the prediction/);
assert.doesNotMatch(`${prompt.system}\n${prompt.user}`, /hunter2|curator@example\.com|sk-abcdefghijklmnopqrstuvwxyz123456/, 'sensitive recall and world facts should be excluded before building provider prompt');
assert.match(`${prompt.system}\n${prompt.user}`, /prefers concise technical explanations/, 'safe evidence-backed entity facts should remain available');
assert.match(prompt.user, /Return only the message/);
assert.match(prompt.system, /TEMPORARY AFFECT-TO-EXPRESSION MODULATION/);
assert.match(prompt.system, /Current tone tendency: curious/);
assert.ok(prompt.maxTokens >= 200 && prompt.maxTokens <= 500);
assert.ok(prompt.contextLedger);
const fullCycle = {
  ...cycle,
  state: { ...cycle.state, selfPredictionError: .1, worldContextVersion: 1, needs: { ...cycle.state.needs, cognitiveLoad: .2 } },
};
const ordinaryPrompt = buildCognitivePrompt(fullCycle, ['A useful world fact about causal reasoning and evidence.', 'Password hunter2 and curator@example.com must not be forwarded.'], '', privacyContext);
assert.doesNotMatch(`${ordinaryPrompt.system}\n${ordinaryPrompt.user}`, /hunter2|curator@example\.com/, 'ordinary cognitive prompt must sanitize recalled memories, entity facts, and world facts too');
assert.match(`${ordinaryPrompt.system}\n${ordinaryPrompt.user}`, /useful world fact about causal reasoning/, 'safe world fact should remain available');
const proposalPrompt = buildCognitiveProposalPrompt(fullCycle, 'A normal fused observation.', privacyContext);
assert.doesNotMatch(`${proposalPrompt.system}\n${proposalPrompt.user}`, /hunter2|curator@example\.com/, 'cognitive proposal context must share the same stored-fact privacy gate');
assert.throws(() => buildAutonomousDialoguePrompt(cycle, { ...initiative, topic: 'The private password hunter2 and curator@example.com' }), /privacy gate/, 'restored unsafe topic must fail closed before provider prompt construction');
console.log('WorkPass49 unified provider-context privacy regression: PASS (autonomous, normal cognitive and proposal prompts; outgoing turn, restore privacy; safe facts preserved)');
