import { strict as assert } from 'node:assert';
import { P33PersonhoodCore, defaultP33Personhood } from '../src/organism/cognition/P33PersonhoodCore.ts';

const e=new P33PersonhoodCore();
const d=defaultP33Personhood();
assert.equal(d.identity.canonicalName,'Makise Kurisu');
const decision=e.reviewDecision({requestedAction:'respond',chosenAction:'explore',autonomous:true,risk01:.2,reason:'self-authored choice'});
assert.equal(decision.decision,'accepted');
const m=e.integrateMoment({state:{tick:1,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.3,socialNeed:.2,novelty:.4,identityCoherence:.9,goalPressure:.2},at:Date.now(),predictionError:.1,attentionBudget:.8,lastAction:'explore',lastActionSuccess:null,autonomyScore:.8,selfPredictionError:.1,predictedNextAction:'explore',lastPredictionConfidence:.7,worldContextVersion:1,version:36},momentId:'moment-1',chosenAction:'explore',reason:decision.explanation,autonomous:true,ownership01:.8,relationshipSignal01:.7});
assert.equal(m.current.chosenAction,'explore');
const before=e.snapshot().metrics.selfAuthorship01;
e.observeOutcome({action:'explore',success01:.9,reward01:.9,externallyRequested:false,momentId:m.current.selfMomentId});
assert.ok(e.snapshot().metrics.selfAuthorship01>=before);
assert.equal(e.setSelfAuthoredGoal('understand my own continuity'),true);
assert.equal(e.addInterest('causal neuroscience'),true);
const privateState=e.inspectPrivateState();
assert.ok(privateState.summaries.length>=1);
console.log('P33_PERSONHOOD=PASS', JSON.stringify(e.diagnostics()));
