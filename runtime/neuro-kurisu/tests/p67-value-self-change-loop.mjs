import assert from 'node:assert/strict';
import { P67AutonomousGoalGenesis } from '../src/organism/developmental/P67AutonomousGoalGenesis.ts';

const base={tick:100,at:1000,energy01:.4,uncertainty01:.62,predictionError01:.62,novelty01:.68,socialNeed01:.1,goalPressure01:.66,homeostaticPressure01:.66,epistemicUnresolved:6,identity01:.9,activeGoalCount:0,lastMode:'explore',identityDecision:'allow'};
const lowValues={curiosity:.5,autonomy:.5,responsibility:.5,care:.5,truth:.5,evidence:.5,social:.2};
const highTruth={...lowValues,truth:.99,evidence:.99};
const highResponsibility={...lowValues,responsibility:.99,care:.98};
const highCuriosity={...lowValues,curiosity:.99,autonomy:.99};
const runs=[['low',lowValues],['truth',highTruth],['responsibility',highResponsibility],['curiosity',highCuriosity]];
const results={};
for(const [name,valueWeights] of runs){
  const g=new P67AutonomousGoalGenesis();
  const candidate=g.propose({...base,valueWeights});
  assert.ok(candidate,`${name} value history should still allow a goal under the matched context`);
  results[name]=candidate;
}
assert.notEqual(results.truth.valueAlignment01, results.responsibility.valueAlignment01);
assert.notEqual(results.curiosity.valueAlignment01, results.responsibility.valueAlignment01);
assert.ok(results.responsibility.importance>results.low.importance,'responsibility self-change must increase aligned goal importance');
assert.ok(results.truth.importance>results.low.importance,'truth/evidence self-change must increase aligned goal importance');
assert.ok(results.curiosity.importance>results.low.importance,'curiosity/autonomy self-change must increase aligned goal importance');
assert.equal(results.responsibility.valueFocus,'responsibility');
assert.equal(results.truth.valueFocus,'responsibility');
assert.ok(results.responsibility.reason.includes('value='));
assert.ok(results.truth.reason.includes('value='));
assert.ok(results.curiosity.reason.includes('value='));

const nullableDominants = new P67AutonomousGoalGenesis().propose({
  ...base,
  valueWeights: highTruth,
  motiveDominant: null,
  attractorDominant: null,
});
assert.ok(nullableDominants, 'nullable drive labels from the live Core should be treated as absent optional metadata');
console.log(`P67_VALUE_SELF_CHANGE=PASS low=${results.low.importance.toFixed(4)} truth=${results.truth.importance.toFixed(4)} responsibility=${results.responsibility.importance.toFixed(4)} curiosity=${results.curiosity.importance.toFixed(4)}`);
