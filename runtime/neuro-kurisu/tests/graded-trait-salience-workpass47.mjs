import assert from 'node:assert/strict';
import { buildGradedTraitSalience } from '../src/organism/language/GradedTraitSalience.ts';
import { buildAutonomousDialoguePrompt, buildCognitivePrompt, buildCognitiveProposalPrompt } from '../src/organism/language/LanguageOrgan.ts';

assert.equal(buildGradedTraitSalience({ values: { curiosity: 0.9 }, evidence: { curiosity: 0 } }), '', 'unobserved drift must not become personality prose');
assert.equal(buildGradedTraitSalience({ values: { curiosity: 0.51 }, evidence: { curiosity: 0.8 } }), '', 'tiny drift must remain below salience floor');
const profile = buildGradedTraitSalience({
  values: { curiosity: 0.72, persistence: 0.38, caution: 0.55 },
  evidence: { curiosity: 0.7, persistence: 0.5, caution: 0.06 },
  maxTraits: 2,
});
assert.match(profile, /LEARNED PERSONALITY TENDENCIES/);
assert.match(profile, /curiosity: pronounced shift.*repeated evidence/);
assert.match(profile, /persistence: noticeable shift/);
assert.doesNotMatch(profile, /caution:/, 'weak evidence should not occupy a scarce trait slot');
assert.match(profile, /not a replacement for my stable Kurisu identity/);

const cycle = {
  decision: { selected: { action: 'reflect', goalId: null }, candidates: [] },
  goals: [], state: { tick: 1, at: 1000, needs: { energy: .7, novelty: .8, uncertainty: .4, cognitiveLoad: .2 }, predictionError: .3, selfPredictionError: .2, worldContextVersion: 1 },
  memories: [], workspace: { content: {} },
};
const initiative = {
  id: 'soc:test:1', contact: null, kind: 'share-thought', priority01: .8, status: 'planned', createdAt: 1000,
  reason: 'endogenous-conversation', topic: 'Why predictions should be compared with outcomes', topicSource: 'curiosity', openingIntent: 'offer-an-idea',
};
for (const prompt of [
  buildCognitivePrompt(cycle, [], 'hello', undefined, profile),
  buildAutonomousDialoguePrompt(cycle, initiative, [], undefined, profile),
  buildCognitiveProposalPrompt(cycle, 'only supplied observation', undefined, profile),
]) {
  assert.match(prompt.system + '\n' + prompt.user, /LEARNED PERSONALITY TENDENCIES/);
  assert.match(prompt.system + '\n' + prompt.user, /curiosity: pronounced shift/);
}
console.log('WorkPass47 graded trait salience: PASS (evidence gate, magnitude gate, stable baseline, graded directions, top-K and all language routes)');
