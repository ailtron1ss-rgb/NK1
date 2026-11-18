import assert from 'node:assert/strict';
import { CognitiveProviderFeedbackController } from '../src/organism/cognition/CognitiveProviderFeedbackController.ts';

const feedback = new CognitiveProviderFeedbackController();
const empty = feedback.snapshot('deep');
assert.deepEqual(empty,{
  version:1,
  mode:'deep',
  sampleCount:0,
  truncatedCount:0,
  nearLimitCount:0,
  truncationPressure01:0,
});

for(let index=0;index<3;index+=1){
  const result=feedback.record({
    requestId:`session:tick:${index+1}`,
    mode:'deep',
    completionTokens:96,
    maxTokens:96,
    finishReason:'length',
  });
  assert.equal(result.accepted,true);
}
assert.equal(feedback.snapshot('deep').sampleCount,3);
assert.equal(feedback.snapshot('deep').truncationPressure01,0,
  'adaptive budget changes must wait for the minimum evidence window');

const fourth=feedback.record({
  requestId:'session:tick:4',
  mode:'deep',
  completionTokens:96,
  maxTokens:96,
  finishReason:'length',
});
assert.equal(fourth.accepted,true);
assert.deepEqual(feedback.snapshot('deep'),{
  version:1,
  mode:'deep',
  sampleCount:4,
  truncatedCount:4,
  nearLimitCount:4,
  truncationPressure01:1,
});

assert.equal(feedback.record({
  requestId:'session:tick:4',
  mode:'deep',
  completionTokens:96,
  maxTokens:96,
  finishReason:'length',
}).reason,'duplicate-request-id',
'request usage must not train the calibration controller twice');

for(let index=5;index<=8;index+=1){
  assert.equal(feedback.record({
    requestId:`session:tick:${index}`,
    mode:'deep',
    completionTokens:90,
    maxTokens:96,
    finishReason:'stop',
  }).accepted,true);
}
const mixed=feedback.snapshot('deep');
assert.equal(mixed.sampleCount,8);
assert.equal(mixed.truncatedCount,4);
assert.equal(mixed.nearLimitCount,8);
assert.equal(mixed.truncationPressure01,.6,
  'truncation and near-limit evidence must produce a bounded smoothed pressure');

assert.equal(feedback.snapshot('shallow').sampleCount,0,
  'provider feedback must be isolated by cognitive mode');
assert.equal(feedback.snapshot('shallow').truncationPressure01,0);

const invalidInputs=[
  { requestId:'bad id',mode:'deep',completionTokens:10,maxTokens:128,finishReason:'stop' },
  { requestId:'session:bad-mode',mode:'unknown',completionTokens:10,maxTokens:128,finishReason:'stop' },
  { requestId:'session:bad-completion',mode:'deep',completionTokens:-1,maxTokens:128,finishReason:'stop' },
  { requestId:'session:bad-limit',mode:'deep',completionTokens:10,maxTokens:97,finishReason:'stop' },
  { requestId:'session:bad-finish',mode:'deep',completionTokens:10,maxTokens:128,finishReason:'made-up' },
  { requestId:'session:bad-overflow',mode:'deep',completionTokens:1_000_001,maxTokens:128,finishReason:'stop' },
];
for(const input of invalidInputs){
  const result=feedback.record(input);
  assert.equal(result.accepted,false);
  assert.equal(typeof result.reason,'string');
}
assert.equal(feedback.snapshot('deep').sampleCount,8,
  'invalid observations must not contaminate the adaptive window');

for(let index=9;index<=48;index+=1){
  feedback.record({
    requestId:`session:rolling:${index}`,
    mode:'deep',
    completionTokens:10,
    maxTokens:128,
    finishReason:'stop',
  });
}
const rolling=feedback.snapshot('deep');
assert.equal(rolling.sampleCount,32,'per-mode evidence window must remain bounded');
assert.ok(rolling.truncatedCount<=32);
assert.ok(rolling.nearLimitCount<=32);
assert.ok(rolling.truncationPressure01>=0&&rolling.truncationPressure01<=1);

const snapshots=feedback.snapshotAll();
assert.deepEqual(snapshots.map(item=>item.mode),[
  'reflex','shallow','retrieve','deep','simulate','defer','sleep',
]);
const detached=feedback.snapshot('deep');
detached.truncationPressure01=99;
assert.ok(feedback.snapshot('deep').truncationPressure01<=1,
  'diagnostic snapshots must not expose mutable calibration state');

console.log('COGNITIVE_PROVIDER_FEEDBACK_PASS');
