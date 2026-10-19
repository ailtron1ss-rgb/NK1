import assert from 'node:assert/strict';
import { P33PersonhoodCore, defaultP33Personhood } from '../src/organism/cognition/P33PersonhoodCore.ts';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const t = Date.now();
const personhood = new P33PersonhoodCore();
personhood.restore(defaultP33Personhood());
const goalEvidence = personhood.observeInterestEvidence({
  text: 'Интегрировать программирование runtime, обучение искусственного интеллекта и причинные связи памяти.',
  evidenceId: 'active-goal:causal-memory-runtime', source: 'active-goal', salience01: .94, at: t,
});
assert.ok(goalEvidence.includes('programming-systems'));
assert.ok(goalEvidence.includes('ai-learning'));
const profileBefore = personhood.snapshot().development.interestProfiles.find(x => x.id === 'programming-systems');
assert.ok(profileBefore && profileBefore.evidenceCount > 0 && profileBefore.confidence01 > .24);
assert.deepEqual(personhood.observeInterestEvidence({
  text: 'Интегрировать программирование runtime, обучение искусственного интеллекта и причинные связи памяти.',
  evidenceId: 'active-goal:causal-memory-runtime', source: 'active-goal', salience01: .94, at: t + 1000,
}), [], 'replaying an identical goal evidence id must not reinforce the same interest twice');
const profileAfterReplay = personhood.snapshot().development.interestProfiles.find(x => x.id === 'programming-systems');
assert.equal(profileAfterReplay?.evidenceCount, profileBefore.evidenceCount);

personhood.observeInterestEvidence({ text: 'Эпизодическое воспоминание связывает эмоцию, действие и причинный результат.', evidenceId: 'memory:episode-42', source: 'memory', salience01: .9, at: t + 2000 });
personhood.setSelfAuthoredGoal('Понять, как собственные интересы меняются после научных открытий');
personhood.observeInterestEvidence({ text: 'Сравнить собственные научные гипотезы с результатами независимых экспериментов.', evidenceId: 'self-goal:science', source: 'self-authored', salience01: .8, at: t + 3000 });
const learnedSnapshot = personhood.snapshot();
const restoredPersonhood = new P33PersonhoodCore();
restoredPersonhood.restore(learnedSnapshot);
assert.ok(restoredPersonhood.snapshot().development.interestProfiles.some(x => x.evidenceIds.includes('memory:episode-42:memory-identity')));
assert.ok(restoredPersonhood.snapshot().development.interestProfiles.some(x => x.sources.includes('self-authored')), 'self-authored goal evidence must remain persisted on its profile');
assert.ok(restoredPersonhood.interestRelevance('развитие личности и автобиографическая память').some(x => x.id === 'memory-identity'));

const feedbackDomain = 'memory-identity';
const beforePositive = restoredPersonhood.snapshot().development.interestProfiles.find(x => x.id === feedbackDomain);
const positiveIds = restoredPersonhood.recordInterestFeedback({
  text: 'Автобиографическая память, развитие личности и причинные воспоминания',
  evidenceId: 'initiative-feedback-positive-1', signal: 'positive', relevance01: .9, at: t + 4000,
});
assert.ok(positiveIds.includes(feedbackDomain));
const afterPositive = restoredPersonhood.snapshot().development.interestProfiles.find(x => x.id === feedbackDomain);
assert.ok(afterPositive.strength01 > beforePositive.strength01, 'explicit positive response must strengthen the matching interest');
assert.ok(afterPositive.sources.includes('positive-feedback'));
restoredPersonhood.recordInterestFeedback({ text: 'Автобиографическая память, развитие личности и причинные воспоминания', evidenceId: 'initiative-feedback-positive-1', signal: 'positive', relevance01: .9, at: t + 4500 });
assert.equal(restoredPersonhood.snapshot().development.interestProfiles.find(x => x.id === feedbackDomain)?.strength01, afterPositive.strength01, 'feedback replay is idempotent');
const beforeNegative = restoredPersonhood.snapshot().development.interestProfiles.find(x => x.id === feedbackDomain);
restoredPersonhood.recordInterestFeedback({ text: 'Автобиографическая память, развитие личности и причинные воспоминания', evidenceId: 'initiative-feedback-negative-2', signal: 'negative', relevance01: .9, at: t + 5000 });
const afterNegativeProfile = restoredPersonhood.snapshot().development.interestProfiles.find(x => x.id === feedbackDomain);
assert.ok(afterNegativeProfile.strength01 < beforeNegative.strength01, 'negative feedback should nudge only the linked topic interest down');
const reloadedFeedback = new P33PersonhoodCore();
reloadedFeedback.restore(restoredPersonhood.snapshot());
assert.ok(reloadedFeedback.snapshot().development.interestProfiles.find(x => x.id === feedbackDomain)?.sources.includes('negative-feedback'), 'positive and negative evidence sources survive persistence');

const social = new AutonomousSocialInitiativeEngine();
const first = social.cycle({
  at: t, externalInput: false, socialNeed01: .9, relationship01: .4, energy01: .9, identity01: .9, novelty01: .6,
  emotionLabel: 'curiosity', emotionValence01: .68, emotionArousal01: .7, emotionConfidence01: .9,
  quietPeriodMs: 0, cooldownMs: 0, startupGraceMs: 0,
  topics: [{ topic: 'Почему причинная память помогает проверить научные гипотезы и исправлять решения?', source: 'memory', salience01: .84, freshness01: .8, interestFit01: .96, affectFit01: .93, interestDomain: 'memory-identity' }],
});
assert.equal(first.shouldInitiate, true);
assert.equal(social.stageMessage(first.initiative.id, 'У меня появилась мысль о связи причинной памяти и научных гипотез.', t + 1), true);
assert.equal(social.acknowledge(first.initiative.id, t + 2), true);
const feedback = social.observeExternalResponse('Интересно, расскажи подробнее о памяти и причинных следах.', t + 3);
assert.equal(feedback?.signal, 'positive');
const state = social.snapshot();
assert.equal(state.initiatives[0].feedbackSignal, 'positive');
const restoredSocial = new AutonomousSocialInitiativeEngine();
restoredSocial.restore(state);
assert.equal(restoredSocial.snapshot().initiatives[0].feedbackSignal, 'positive', 'conversation feedback persists over restore');
assert.equal(restoredSocial.observeExternalResponse('Расскажи подробнее о памяти.', t + 4), null, 'one user turn cannot label the same thread twice');

const negativeSocial = new AutonomousSocialInitiativeEngine();
const negativeFirst = negativeSocial.cycle({
  at: t, externalInput: false, socialNeed01: .9, relationship01: .4, energy01: .9, identity01: .9, novelty01: .6,
  quietPeriodMs: 0, cooldownMs: 0, startupGraceMs: 0,
  topics: [{ topic: 'Explore causal memory retrieval episodes model adaptation calibration evidence transfer persistence patterns', source: 'memory', salience01: .9, freshness01: .8, interestFit01: .9, affectFit01: .9 }],
});
assert.equal(negativeSocial.stageMessage(negativeFirst.initiative.id, 'Давай исследуем причинную память.', t + 1), true);
negativeSocial.acknowledge(negativeFirst.initiative.id, t + 2);
assert.equal(negativeSocial.observeExternalResponse('Не надо об этом, не хочу продолжать эту тему.', t + 3)?.signal, 'negative');
const afterNegative = negativeSocial.cycle({
  at: t + 10_000, externalInput: false, socialNeed01: .9, relationship01: .4, energy01: .9, identity01: .9, novelty01: .95,
  quietPeriodMs: 0, cooldownMs: 0, startupGraceMs: 0,
  topics: [
    { topic: 'Causal memory retrieval episodes model adaptation calibration with neural inference pipeline design', source: 'memory', salience01: .99, freshness01: .99, interestFit01: .99, affectFit01: .99 },
    { topic: 'Исследовать новые гипотезы о физике времени и причинности', source: 'curiosity', salience01: .68, freshness01: .8, interestFit01: .7, affectFit01: .8 },
  ],
});
assert.equal(afterNegative.shouldInitiate, true);
assert.match(afterNegative.initiative.topic, /физике времени/iu, 'negative feedback suppresses a thread, not the person’s entire curiosity');
console.log('WORKPASS50_INTEREST_CONTINUITY=PASS');
