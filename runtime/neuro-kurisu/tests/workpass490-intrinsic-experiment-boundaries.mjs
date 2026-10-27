import assert from 'node:assert/strict';
import { IntrinsicExperimentGenerator } from '../src/organism/cognition/IntrinsicExperimentGenerator.ts';

let now=1_800_000_000_123;
const generator=new IntrinsicExperimentGenerator(()=>now,()=> 'test-id');
const goals=[];
assert.equal(generator.generate({uncertainty:Number.NaN,predictionError:Number.POSITIVE_INFINITY,novelty:Number.NEGATIVE_INFINITY,goals}),null,
  'non-finite signals must not accidentally pass the intrinsic-drive threshold');

const first=generator.generate({uncertainty:.8,predictionError:.2,novelty:.1,goals});
assert.ok(first);
assert.equal(first.createdAt,now);
assert.equal(first.id,`exp-${now}-test-id`);
assert.equal(first.action,'inspect');
assert.ok(Number.isFinite(first.expectedInformationGain));
assert.ok(first.expectedInformationGain>=0&&first.expectedInformationGain<=1);

now+=10;
const second=generator.generate({uncertainty:.8,predictionError:.2,novelty:.1,goals});
assert.equal(second.createdAt,now,'timestamp should be sampled once per generated experiment');
assert.notEqual(first.id,second.id,'same suffix at different logical times must not collide');

assert.equal(generator.fromDreamAssociation({
  id:'dream-1',question:'check association',confidence:Number.NaN,at:now,
  sourceMemoryIds:['mem-a','mem-b'],sharedTerms:['memory','signal'],
  kind:'association',validationStatus:'candidate',
},goals),null,'non-finite dream confidence must not create a verification task');

const dream=generator.fromDreamAssociation({
  id:'dream-2',question:'  verify association  ',confidence:.7,at:now,
  sourceMemoryIds:['mem-a','mem-b'],sharedTerms:['memory','signal'],
  kind:'association',validationStatus:'candidate',
},goals);
assert.ok(dream);
assert.equal(dream.question,'verify association');
assert.equal(dream.epistemicStatus,'hypothesis');
assert.equal(dream.verificationRequired,true);
assert.equal(dream.status,'candidate');
assert.equal(dream.createdAt,now);
assert.ok(dream.hypothesis.includes('Unverified association hypothesis only'));
console.log('WorkPass490 intrinsic experiment boundary regressions passed');
