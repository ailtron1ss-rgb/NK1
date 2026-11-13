import assert from 'node:assert/strict';
import {
  CognitiveResourceEconomy,
  cognitiveAttentionIntentFromAction,
} from '../src/organism/system/CognitiveResourceEconomy.ts';

const input = { tick: 1, at: 1000, energy01: .9, cognitiveLoad01: .15,
  uncertainty01: .4, novelty01: .5, thermalStrain01: .1, ramPressure01: .1, awake: true };
const economy = new CognitiveResourceEconomy();
assert.equal(economy.snapshot().attentionEffort01, .7);
assert.equal(economy.snapshot().attentionEffortTarget01, .7);

const neutral = economy.allocate(input);
assert.equal(neutral.attentionEffort01, .7);
assert.equal(neutral.attentionEffortIntent, 'homeostatic');

const engaged = economy.allocate({ ...input, tick: 2, attentionIntent: 'engage' });
assert.equal(engaged.attentionEffort01, 1);
assert.equal(engaged.attentionEffortTarget01, 1);
assert.ok(engaged.attention01 > neutral.attention01, 'voluntary engagement should mobilize more of the available attention ceiling');
assert.ok(engaged.attention01 <= engaged.totalBudget01, 'voluntary effort must never exceed the organism-level budget');

const resting = economy.allocate({ ...input, tick: 3, attentionIntent: 'rest' });
assert.equal(resting.attentionEffort01, .4);
assert.equal(resting.attentionEffortIntent, 'rest');
assert.ok(resting.attention01 < neutral.attention01, 'rest should reduce engaged attention');

const recovering = economy.allocate({ ...input, tick: 4 });
assert.equal(recovering.attentionEffortIntent, 'homeostatic');
assert.ok(recovering.attentionEffort01 > .4 && recovering.attentionEffort01 < .7,
  'effort must relax gradually toward its homeostatic baseline');
const sameTick = economy.allocate({ ...input, tick: 4 });
assert.equal(sameTick.attentionEffort01, recovering.attentionEffort01,
  'multiple resource samples in one cognitive tick must not accelerate homeostatic relaxation');

const exhausted = economy.allocate({ ...input, tick: 5, energy01: .1, attentionIntent: 'engage' });
assert.equal(exhausted.attentionEffort01, .7, 'low energy must veto voluntary engagement');
assert.ok(exhausted.attention01 <= exhausted.totalBudget01);

const asleep = economy.allocate({ ...input, tick: 6, awake: false, attentionIntent: 'engage' });
assert.equal(asleep.attentionEffort01, .7, 'sleep state must veto voluntary engagement');

assert.equal(cognitiveAttentionIntentFromAction('explore'), 'engage');
assert.equal(cognitiveAttentionIntentFromAction('verify'), 'engage');
assert.equal(cognitiveAttentionIntentFromAction('reflect'), 'engage');
assert.equal(cognitiveAttentionIntentFromAction('rest'), 'rest');
assert.equal(cognitiveAttentionIntentFromAction('wait'), 'rest');
assert.equal(cognitiveAttentionIntentFromAction('respond'), undefined);
assert.equal(cognitiveAttentionIntentFromAction('none'), undefined);

const restored = new CognitiveResourceEconomy();
restored.restore({ version: 1, attentionEffort01: 1, attentionEffortTarget01: .4, attentionEffortIntent: 'rest' });
assert.equal(restored.snapshot().attentionEffort01, 1);
assert.equal(restored.snapshot().attentionEffortTarget01, .4);
assert.equal(restored.snapshot().attentionEffortIntent, 'rest');
const oldSnapshot = new CognitiveResourceEconomy();
oldSnapshot.restore({ version: 1, totalBudget01: .6 });
assert.equal(oldSnapshot.snapshot().attentionEffort01, .7, 'legacy snapshots must restore the homeostatic default');
assert.equal(oldSnapshot.snapshot().attentionEffortTarget01, .7);

const malformed = new CognitiveResourceEconomy();
malformed.restore({ version: 1, attentionEffort01: 99, attentionEffortTarget01: -10 });
assert.equal(malformed.snapshot().attentionEffort01, 1);
assert.equal(malformed.snapshot().attentionEffortTarget01, .4);

console.log('WILL_VOLUNTARY_ATTENTION_BUDGET_PASS');
