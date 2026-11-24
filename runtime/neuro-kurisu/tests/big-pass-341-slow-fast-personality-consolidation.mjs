import assert from 'node:assert/strict';
import { B299CausalPersonalityDevelopmentLoop } from '../src/organism/system/B299CausalPersonalityDevelopmentLoop.ts';

const run = (rewards, action='explore') => {
  const b = new B299CausalPersonalityDevelopmentLoop();
  for (let i=0;i<rewards.length;i++) {
    b.observeOutcome({tick:i,action,reward01:rewards[i],predictionError01:Math.abs(.55-rewards[i]),causalConfidence01:.90,identityContinuity01:.90,externalEvidence01:.80,worldTransition:true,independent:true,autonomous:true,predictedUtility01:.60,neuralPlasticity01:.90,selfModelAlignment01:.90,goalLearningQuality01:.90,context:{epistemic:.78,autonomy:.42}});
  }
  return b;
};

const one = run([.05]);
const oneD = one.diagnostics();
const repeated = run(Array(36).fill(.95));
const repD = repeated.diagnostics();
assert.ok(Math.abs(oneD.dominantPhenotype.consolidatedPreference11) < Math.abs(repD.dominantPhenotype.consolidatedPreference11), 'single experience over-consolidated personality');
assert.ok(repD.dominantPhenotype.consolidationEvidence01 > .20, 'repeated experience did not consolidate evidence');

const mixed = run([...Array(36).fill(.95), ...Array(36).fill(.05)]);
const mixedD = mixed.diagnostics();
assert.ok(Math.abs(mixedD.dominantPhenotype.consolidatedPreference11) < Math.abs(repD.dominantPhenotype.consolidatedPreference11), 'contrary experience failed to soften slow personality weight');
assert.ok(Math.abs(mixedD.dominantPhenotype.consolidatedPreference11) > .02, 'contrary experience erased slow personality too aggressively');

const restored = new B299CausalPersonalityDevelopmentLoop();
restored.restore(mixed.snapshot());
const rd = restored.diagnostics();
assert.equal(rd.dominantPhenotype.consolidatedPreference11, mixedD.dominantPhenotype.consolidatedPreference11, 'restart lost slow personality weight');
assert.equal(rd.dominantPhenotype.consolidationEvidence01, mixedD.dominantPhenotype.consolidationEvidence01, 'restart lost consolidation evidence');

console.log(JSON.stringify({pass:true,single:{fast:oneD.dominantPhenotype.preference11,slow:oneD.dominantPhenotype.consolidatedPreference11},repeated:{fast:repD.dominantPhenotype.preference11,slow:repD.dominantPhenotype.consolidatedPreference11,consolidationEvidence:repD.dominantPhenotype.consolidationEvidence01},mixed:{fast:mixedD.dominantPhenotype.preference11,slow:mixedD.dominantPhenotype.consolidatedPreference11,consolidationEvidence:mixedD.dominantPhenotype.consolidationEvidence01}}));
process.exit(0);
