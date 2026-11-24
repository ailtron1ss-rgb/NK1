import assert from 'node:assert/strict';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';

const k=new SocialMindKernel();
k.observePerson({id:'u',displayName:'user',at:1000,confidence01:.95,visible01:1,source:'interaction'});
const predicted=k.observeText('u','Можешь помочь мне?',2000);
assert.equal(predicted.kind,'assistance');
assert.ok(k.secondOrder('u').some(b=>b.claim.includes('person-expected-agent-action:respond')));
const pe=k.recordOutcome('u',{outcome01:.2,surprise01:.85,at:3000,agentAction:'respond'});
assert.ok(pe>.5 && pe<.9);
assert.ok(k.counterfactuals('u').length>=1);
const repair=k.proposeRepair('u');
assert.equal(typeof repair.need01,'number');
const s=k.snapshot();
assert.ok(s.secondOrderBeliefs.length>=1);
assert.ok(s.counterfactuals.length>=1);
console.log(`BIG_PASS_95_SOCIAL_SECOND_ORDER=PASS secondOrder=${s.secondOrderBeliefs.length} counterfactuals=${s.counterfactuals.length} predictionError=${pe.toFixed(3)}`);
