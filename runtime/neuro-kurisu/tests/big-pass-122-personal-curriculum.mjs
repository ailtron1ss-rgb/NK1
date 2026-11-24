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
console.log('BIG_PASS_122_PERSONAL_CURRICULUM=PASS');
console.log(JSON.stringify({threads:s.threads.length,contexts:s.threads[0].contexts,priority01:s.threads[0].priority01,learningNeed01:s.threads[0].learningNeed01,curriculumPressure01:s.curriculumPressure01,identityLearning01:s.identityLearning01},null,2));
