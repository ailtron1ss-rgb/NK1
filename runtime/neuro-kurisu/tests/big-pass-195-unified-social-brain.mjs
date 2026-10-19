import assert from 'node:assert/strict';
import { SocialPredictiveNeuralSubstrate } from '../src/organism/cognition/SocialPredictiveNeuralSubstrate.ts';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';

const model=new SocialPredictiveNeuralSubstrate();
for(let i=0;i<180;i++){
  model.observe({
    personFeatures:[.72,.55,.63,.3,.2,.68],
    socialContext:[.66,.62,.35,.18,.7,.28],
    selfFeatures:[.9,.84,.73,.92],
    worldFeatures:[.24,.82,.79,.88],
    actionContext:[.42,.16,.83,1],tick:i+1,at:1000+i*1000,
  });
  model.learnOutcome({actualIntent01:.2,actualValence01:.7,actualResponse01:.9,success01:.86,socialMismatch01:.12});
}
const d=model.diagnostics();
assert.equal(d.sampleCount,180);
assert.equal(d.learningSteps,180);
assert.ok(d.validated);
assert.ok(d.meanPredictionError01 < .35);
const snap=model.snapshot();
const restored=new SocialPredictiveNeuralSubstrate();
restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap);

const social=new SocialMindKernel();
social.observePerson({id:'user',displayName:'user',at:1000,confidence01:.95,source:'interaction'});
const intent=social.observeText('user','Можешь помочь мне с этим?',2000);
assert.equal(intent.kind,'assistance');
const outcome=social.recordOutcome('user',{actualIntent:'assistance',outcome01:.88,surprise01:.12,at:3000,agentAction:'respond'});
assert.ok(outcome<.5);
assert.ok(social.secondOrder('user').length>=1);
console.log(`BIG_PASS_195_SOCIAL_BRAIN=PASS samples=${d.sampleCount} meanError=${d.meanPredictionError01.toFixed(3)} validated=${d.validated} socialOutcomeError=${outcome.toFixed(3)}`);
