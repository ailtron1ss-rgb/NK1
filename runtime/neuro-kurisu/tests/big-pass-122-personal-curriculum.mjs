import assert from 'node:assert/strict';
import { PersonalCurriculumEngine } from '../src/organism/learning/PersonalCurriculumEngine.ts';

const goal={id:'g1',title:'Сохранить устойчивый способ исследования',reason:'автобиографический опыт и социальная ответственность',source:'intrinsic',status:'active',importance:.82,urgency:.66,confidence:.62,progress:.22,createdAt:1,updatedAt:1};
const e=new PersonalCurriculumEngine();
e.beginCycle();
for(let i=0;i<8;i++){
  e.observeOutcome({goal,outcome01:i<6?.82:.7,verified:true,contextKey:`ctx-${i}`,causal01:.72,social01:.82,identity01:.86,retention01:.72,transfer01:.62,at:1000+i,sourceMomentCount:i+1});
}
const s=e.snapshot();
assert.equal(s.threads.length,1);
assert.ok(s.threads[0].contexts>=3);
assert.ok(s.curriculumPressure01>.2);
assert.ok(s.identityLearning01>.2);
const ranked=e.rankGoals({goals:[goal],identity01:.9,social01:.7,novelty01:.45,uncertainty01:.55});
assert.equal(ranked[0].goalId,'g1');
assert.ok(ranked[0].score01>.4);
assert.equal(e.suggestedAction('g1'),'wait');
const restored=new PersonalCurriculumEngine(); restored.restore(s);
assert.deepEqual(restored.snapshot(),s);
assert.equal(s.completedThreads, 1, 'completion count must represent unique currently-satisfied threads');
assert.equal(s.suppressedThreads, 0);

// Restoring must preserve legitimate wall-clock timestamps.
const timestampState = structuredClone(s);
timestampState.lastAt = Date.now();
timestampState.threads[0].lastAt = Date.now();
const timestampRestored = new PersonalCurriculumEngine();
timestampRestored.restore(timestampState);
assert.equal(timestampRestored.snapshot().lastAt, timestampState.lastAt);
assert.equal(timestampRestored.snapshot().threads[0].lastAt, timestampState.threads[0].lastAt);

// Malformed persisted values must not become curriculum evidence.
const poisoned = structuredClone(s);
poisoned.cycles = -7;
poisoned.curriculumPressure01 = Number.NaN;
poisoned.threads[0].priority01 = 1.7;
const guarded = new PersonalCurriculumEngine();
guarded.restore(poisoned);
assert.equal(guarded.snapshot().cycles, 0);
assert.equal(guarded.snapshot().curriculumPressure01, 0.28);
assert.equal(guarded.snapshot().threads.length, 0);
assert.ok(Number.isFinite(guarded.snapshot().curriculumPressure01));

// Accessor-backed snapshots fail closed without executing getters.
let restoreGetterCalls = 0;
const hostile = {};
Object.defineProperty(hostile, 'cycles', {
  enumerable: true,
  get() { restoreGetterCalls++; return 999; },
});
const accessorGuarded = new PersonalCurriculumEngine();
accessorGuarded.restore(hostile);
assert.equal(restoreGetterCalls, 0);
assert.equal(accessorGuarded.snapshot().cycles, 0);
assert.equal(accessorGuarded.snapshot().threads.length, 0);

// New contrary evidence reopens a formerly satisfied thread.
const reopened = new PersonalCurriculumEngine();
reopened.restore(s);
reopened.observeOutcome({
  goal, outcome01: 0.1, verified: true, contextKey: 'ctx-reopen',
  causal01: 0.72, social01: 0.82, identity01: 0.86, retention01: 0.72, transfer01: 0.62, at: 2000,
});
assert.notEqual(reopened.snapshot().threads[0].status, 'satisfied');
assert.equal(reopened.snapshot().completedThreads, 0,
  'new contrary outcome must reopen satisfaction rather than leave a stale completion count');

// Suppressed and completed counters are derived from live unique thread statuses,
// not incremented on every repeated observation or trusted from persistence.
const suppressedState = structuredClone(s);
suppressedState.threads[0].status = 'suppressed';
suppressedState.completedThreads = 456;
suppressedState.suppressedThreads = 789;
const suppressedEngine = new PersonalCurriculumEngine();
suppressedEngine.restore(suppressedState);
assert.equal(suppressedEngine.snapshot().completedThreads, 0);
assert.equal(suppressedEngine.snapshot().suppressedThreads, 1);
suppressedEngine.observeOutcome({
  goal, outcome01: 0.2, verified: true, contextKey: 'ctx-suppressed',
  causal01: 0.72, social01: 0.82, identity01: 0.86, retention01: 0.72, transfer01: 0.62, at: 2001,
});
assert.equal(suppressedEngine.snapshot().suppressedThreads, 1);

console.log('BIG_PASS_122_PERSONAL_CURRICULUM=PASS');
console.log(JSON.stringify({threads:s.threads.length,contexts:s.threads[0].contexts,priority01:s.threads[0].priority01,learningNeed01:s.threads[0].learningNeed01,curriculumPressure01:s.curriculumPressure01,identityLearning01:s.identityLearning01},null,2));
