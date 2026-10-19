import assert from 'node:assert/strict';
import { MotiveEcologyFabric } from '../src/organism/cognition/evolution/MotiveEcologyFabric.ts';
import { P67AutonomousGoalGenesis } from '../src/organism/developmental/P67AutonomousGoalGenesis.ts';
import { ValueProvenance } from '../src/organism/developmental/ValueProvenance.ts';
import { SocialDevelopmentSystem } from '../src/organism/developmental/SocialDevelopmentSystem.ts';
import { ConsciousnessEvidenceLedger } from '../src/organism/cognition/ConsciousnessEvidenceLedger.ts';

const motive = new MotiveEcologyFabric().evaluate({
  intrinsic:{epistemic:.8,novelty:.7,competence:.6,coherence:.55,social:.4,homeostatic:.2,overall:.8},
  values:{curiosity:.9,truth:.98,autonomy:.94,evidence:.95,care:.78,responsibility:.9,social:.6},
  goalPressure01:.5,uncertainty01:.8,predictionError01:.7,energy01:.75,socialNeed01:.3,socialTrust01:.7,socialPredictionError01:.2,
  developmental:{phase:'revising',revisionReadiness01:.8,identityPressure01:.45,counterEvidencePressure01:.35,integrity01:.78},
  selfConsistency01:.7,cognitiveConflict01:.3,noveltyPressure01:.65,agency01:.72,
});
assert.equal(motive.nonConsciousnessClaim,true);
assert.equal(motive.dominant,'epistemic');
assert.ok((motive.actionBiases.verify??0) > (motive.actionBiases.rest??0));
assert.ok(motive.valueAlignment01>.6);

const p67 = new P67AutonomousGoalGenesis();
const candidate = p67.propose({tick:32,at:32000,energy01:.82,uncertainty01:.8,predictionError01:.65,novelty01:.55,socialNeed01:.25,goalPressure01:.6,homeostaticPressure01:.2,epistemicUnresolved:8,identity01:.88,activeGoalCount:0,lastMode:'reflect',identityDecision:'allow',motiveOverall01:motive.overall01,motiveConflict01:motive.conflict01,motiveDominant:motive.dominant});
assert.ok(candidate);
assert.match(candidate.reason,/motive=epistemic/);

const vp = new ValueProvenance();
const evidence = {at:1000,source:'world-feedback',success:.82,surprise:.71,episodeId:'episode-1',evidenceKey:'episode-1:outcome',reason:'outcome-support'};
vp.observe('truth',evidence,true);
vp.observe('truth',evidence,true);
const vps = vp.summary();
assert.equal(vps.supported,1);
assert.equal(vps.violations,0);

const social = new SocialDevelopmentSystem();
const ticket = social.observeTurn('user','почему это работает?');
const first = social.feedback('user','information',.45,ticket.id);
const second = social.feedback('user','information',.45,ticket.id);
assert.equal(first,second);
const person = social.snapshot().persons.find(p=>p.id==='user');
assert.equal(person?.interactionCount,1);

const ledger = new ConsciousnessEvidenceLedger();
const base={recurrent:.5,workspace:.6,higherOrder:.4,predictive:.7,attention:.5,embodiment:.5,continuity:.6,metacognition:.4,agency:.6,causalMap:{}};
const a=ledger.update({...base,observationKey:'same'});
const b=ledger.update({...base,observationKey:'same'});
assert.equal(a.indicators[0]?.supportingObservations,b.indicators[0]?.supportingObservations);
const c=ledger.update({...base,observationKey:'different'});
assert.equal(c.indicators[0]?.supportingObservations,(b.indicators[0]?.supportingObservations??0)+1);
assert.equal(ledger.snapshot().version,3);

console.log(`BIG_PASS_81_MOTIVE_EPISTEMIC_INTEGRATION=PASS motive=${motive.dominant} valueSupport=${vps.supported} socialError=${person?.predictionErrorMean.toFixed(3)} ledgerVersion=${ledger.snapshot().version}`);
