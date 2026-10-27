import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const net=new B272EndogenousGoalGenesis();
const rewards={explore:.72,verify:.68,respond:.61,reflect:.57,rest:.48,wait:.43,defer:.41};
const goals=[]; let accepted=0;
for(let t=0;t<360;t++){
  const reward= t<180 ? rewards.explore : (t%5===0?rewards.verify:rewards.reflect);
  const predictionError=t<140?.30:(t<220?.55:.18);
  const r=net.step({tick:t,selfLatent:Array.from({length:16},(_,i)=>Math.tanh(Math.sin(t*.07+i*.11))),worldLatent:Array.from({length:16},(_,i)=>Math.sin(t*.03+i*.17)),needs:{energy01:.72-(t%17)*.006,uncertainty01:predictionError,novelty01:.34+(t%11)*.035,goalPressure01:.28+predictionError*.55,socialNeed01:.22+(t%7)*.035},traits:{curiosity:.68,caution:.58,'truth-seeking':.71,'self-reflection':.63,'self-preservation':.66,care:.57,'social-attunement':.54,persistence:.70},predictionError01:predictionError,autobiographicalContinuity01:.70+.08*Math.sin(t*.05),identityContinuity01:.76+.06*Math.cos(t*.03),intrinsicReward01:.60,lastAction:rAction(net),lastReward01:reward});
  goals.push(r.goalId);
  const lr=net.learnFromOutcome({tick:t,action:r.action,reward01:reward,predictionError01:predictionError,externalEvidence01:t%23===0?1:0,independentEvaluatorGain01:reward-.5,acceptedExternalGoal:reward>.56});
  if(lr.accepted)accepted++;
}
const afterCreditedOutcome=net.snapshot();
const currentAction=net.currentGoal().action;
assert.throws(()=>net.learnFromOutcome({tick:359,action:currentAction,reward01:.99,predictionError01:0,externalEvidence01:1,acceptedExternalGoal:true}),/already been credited/);
assert.deepEqual(net.snapshot(),afterCreditedOutcome,'replaying the same tick must not apply learning twice');
assert.equal(afterCreditedOutcome.lastOutcomeTick,359,'the last credited tick must persist');

const d=net.diagnostics();

// Goal-vector diversity must increase as cosine similarity decreases. This
// calibration catches an inverted metric that can otherwise look non-zero on
// random goals while reporting clones as maximally diverse.
const hashVectorForFixture = vector => vector.reduce(
  (h, x, i) => ((h * 131 + Math.round((x + .5) * 997) + i * 17) >>> 0),
  2166136261,
).toString(16).padStart(8, '0');
const diversityFor = vectors => {
  const raw = net.snapshot();
  raw.goalHistory = vectors.map((vector, index) => ({
    tick: raw.tick - vectors.length + 1 + index,
    id: `g-${hashVectorForFixture(vector)}`,
    vector,
    action: 'reflect',
    reward01: .5,
    predictionError01: .5,
    accepted: false,
  }));
  const restored = new B272EndogenousGoalGenesis();
  restored.restore(raw);
  return restored.diagnostics().goalVectorDiversity01;
};
const repeatedGoal = [.3, 0, 0, 0, 0, 0, 0, 0];
const oppositeGoal = [-.3, 0, 0, 0, 0, 0, 0, 0];
assert.ok(Math.abs(diversityFor([repeatedGoal, repeatedGoal])) < 1e-9,
  'identical goal vectors must have zero pairwise diversity');
assert.ok(Math.abs(diversityFor([repeatedGoal, oppositeGoal]) - 1) < 1e-9,
  'opposite normalized goal vectors must have maximal pairwise diversity');

assert.ok(d.learningUpdates>=340,'B272 did not learn enough');
assert.ok(d.generatedGoals>=340,'B272 did not generate goals');
assert.ok(d.goalEntropy01>.15,'goal generation collapsed to one fixed representation');
assert.ok(d.prototypeDiversity01>.05,'action prototypes never differentiated');
assert.ok(d.goalNovelty01>.2,'goal novelty inactive');
assert.ok(d.agency01>.2,'endogenous agency stayed inert');
assert.ok(accepted>40,'too few endogenous goals accepted by outcome gate');
const before=net.currentGoal();
const snap=net.snapshot();
const restored=new B272EndogenousGoalGenesis(); restored.restore(snap);
assert.deepEqual(restored.currentGoal(),before,'B272 goal state did not round-trip');
assert.equal(restored.snapshot().lastOutcomeTick,snap.lastOutcomeTick,'last credited outcome tick did not round-trip');
assert.ok(Object.keys(restored.snapshot().goalOutcomeMemory).length>0,'valid outcome memory should survive an evidence-bound restore');

const forgedZeroUpdate=net.snapshot();
const forgedId=forgedZeroUpdate.currentGoalId;
forgedZeroUpdate.goalOutcomeMemory[forgedId]={vector:forgedZeroUpdate.currentGoal.slice(),meanReward01:1,meanPredictionError01:0,updates:0,lastTick:forgedZeroUpdate.tick};
const forgedMemoryRestore=new B272EndogenousGoalGenesis();
forgedMemoryRestore.restore(forgedZeroUpdate);
assert.equal(Object.hasOwn(forgedMemoryRestore.snapshot().goalOutcomeMemory,forgedId),false,'zero-update outcome memory without valid learning count must be quarantined');

const duplicateLedger=net.snapshot();
duplicateLedger.outcomeHistory.push({...duplicateLedger.outcomeHistory[duplicateLedger.outcomeHistory.length-1],reward01:0});
const duplicateLedgerRestore=new B272EndogenousGoalGenesis();
duplicateLedgerRestore.restore(duplicateLedger);
assert.equal(duplicateLedgerRestore.snapshot().outcomeHistory.some(item=>item.tick===duplicateLedger.tick),false,'ambiguous duplicate outcome ticks must be quarantined');
assert.equal(duplicateLedgerRestore.snapshot().lastOutcomeTick,duplicateLedger.tick,'quarantining ambiguous rows must not permit outcome replay');

const comparisonState=net.snapshot();
const baselineNet=new B272EndogenousGoalGenesis(); baselineNet.restore(comparisonState);
const drivenNet=new B272EndogenousGoalGenesis(); drivenNet.restore(comparisonState);
const comparisonInput={
  tick:360,selfLatent:new Array(16).fill(0.2),worldLatent:new Array(16).fill(0.1),
  needs:{energy01:0.7,uncertainty01:0.4,novelty01:0.5,goalPressure01:0.3,socialNeed01:0.2},
  traits:{curiosity:0.7,'truth-seeking':0.7,'self-reflection':0.6,'self-preservation':0.7,care:0.6,'social-attunement':0.5,persistence:0.7},
  predictionError01:0.3,autobiographicalContinuity01:0.8,identityContinuity01:0.8,
  intrinsicReward01:0.2,lastAction:null,lastReward01:0.5,
};
const baselineValue=baselineNet.step({...comparisonInput,intrinsicDrive01:0,intrinsicDriveConfidence01:1}).predictedFutureValue01;
const drivenValue=drivenNet.step({...comparisonInput,intrinsicDrive01:0.9,intrinsicDriveConfidence01:1}).predictedFutureValue01;
assert.ok(drivenValue>baselineValue+0.1,'calibrated intrinsic drive did not influence endogenous goal value');
const untrustedDriveNet=new B272EndogenousGoalGenesis(); untrustedDriveNet.restore(comparisonState);
const untrustedValue=untrustedDriveNet.step({...comparisonInput,intrinsicDrive01:0.9,intrinsicDriveConfidence01:0}).predictedFutureValue01;
assert.ok(Math.abs(untrustedValue-baselineValue)<1e-9,'untrusted intrinsic drive bypassed confidence weighting');
const actionCounts=new Map();
for(const g of goals.slice(-120))actionCounts.set(g,(actionCounts.get(g)||0)+1);
assert.ok(actionCounts.size>3,'goal identities collapsed');


const badIdentifierSnapshot=net.snapshot();
badIdentifierSnapshot.goalHistory=[{
  tick:badIdentifierSnapshot.tick,
  id:String.fromCharCode(1),
  vector:badIdentifierSnapshot.currentGoal,
  action:badIdentifierSnapshot.currentAction,
  reward01:0.5,
  predictionError01:0.5,
  accepted:false,
}];
const badIdentifierRestore=new B272EndogenousGoalGenesis();
badIdentifierRestore.restore(badIdentifierSnapshot);
assert.equal(badIdentifierRestore.snapshot().goalHistory.length,0,'control-bearing goal IDs must be quarantined');

const tampered=new B272EndogenousGoalGenesis();
const corrupt=snap;
corrupt.tick=Number.NaN;
corrupt.steps=-1;
corrupt.learningUpdates=Number.POSITIVE_INFINITY;
corrupt.acceptedGoals=999;
corrupt.rejectedGoals=-3;
corrupt.rollbackCount=Number.MAX_SAFE_INTEGER;
corrupt.currentAction='execute-shell';
corrupt.currentConfidence01=Number.NaN;
corrupt.currentGoal=[Number.NaN,1];
corrupt.actionPrototypeWeights=Array.from({length:500},()=>new Array(500).fill(Number.POSITIVE_INFINITY));
corrupt.goalHistory=[{tick:Number.NaN,id:'forged',vector:[Number.NaN],action:'execute-shell',reward01:2,predictionError01:-1,accepted:true}];
corrupt.outcomeHistory=[{tick:999999,goalId:'bad-id',action:'execute-shell',reward01:2,predictionError01:Number.NaN}];
corrupt.goalOutcomeMemory={'__proto__':{vector:[1],meanReward01:2,meanPredictionError01:Number.NaN,updates:Number.POSITIVE_INFINITY,lastTick:999999}};
tampered.restore(corrupt);
const sanitized=tampered.snapshot();
assert.equal(sanitized.version,1);
assert.equal(sanitized.tick,0);
assert.equal(sanitized.steps,0);
assert.equal(sanitized.learningUpdates,0);
assert.equal(sanitized.acceptedGoals,0);
assert.equal(sanitized.rejectedGoals,0);
assert.equal(sanitized.rollbackCount,0);
assert.equal(sanitized.currentAction,'reflect');
assert.ok(sanitized.currentGoal.length===8&&sanitized.currentGoal.every(Number.isFinite));
assert.equal(sanitized.actionPrototypeWeights.length,7);
assert.ok(sanitized.actionPrototypeWeights.every(row=>row.length===8&&row.every(Number.isFinite)));
assert.equal(sanitized.goalHistory.length,0);
assert.equal(sanitized.outcomeHistory.length,0);
assert.equal(Object.keys(sanitized.goalOutcomeMemory).length,0);
const beforeUnsupported=tampered.snapshot();
assert.throws(()=>tampered.restore({version:2}),/version/);
assert.deepEqual(tampered.snapshot(),beforeUnsupported,'unsupported restore must not partially mutate state');

const invalidTickNet=new B272EndogenousGoalGenesis();
assert.throws(()=>invalidTickNet.step({...comparisonInput,tick:Number.NaN}),/tick/);
assert.throws(()=>invalidTickNet.step({...comparisonInput,needs:{...comparisonInput.needs,energy01:Number.NaN}}),/energy01/);
assert.equal(invalidTickNet.snapshot().steps,0,'invalid step must be rejected before state mutation');
const badRestoreState=net.snapshot();
const badRestoredNet=new B272EndogenousGoalGenesis();
badRestoredNet.restore(badRestoreState);
const current=badRestoredNet.currentGoal();
const beforeBadOutcome=badRestoredNet.snapshot();
assert.throws(()=>badRestoredNet.learnFromOutcome({tick:current.id==='never'?0:badRestoredNet.snapshot().tick-1,action:current.action,reward01:.8,predictionError01:.2,externalEvidence01:0}),/tick/);
assert.throws(()=>badRestoredNet.learnFromOutcome({tick:badRestoredNet.snapshot().tick,action:'explore',reward01:Number.NaN,predictionError01:.2,externalEvidence01:0}),/action|signals/);
assert.deepEqual(badRestoredNet.snapshot(),beforeBadOutcome,'rejected outcome must not mutate learner state');

const evidenceLow=new B272EndogenousGoalGenesis();
const evidenceHigh=new B272EndogenousGoalGenesis();
const lowGoal=evidenceLow.step({...comparisonInput,tick:0});
const highGoal=evidenceHigh.step({...comparisonInput,tick:0});
const lowGain=evidenceLow.learnFromOutcome({tick:0,action:lowGoal.action,reward01:.7,predictionError01:.2,externalEvidence01:0}).gain11;
const highGain=evidenceHigh.learnFromOutcome({tick:0,action:highGoal.action,reward01:.7,predictionError01:.2,externalEvidence01:1}).gain11;
assert.ok(highGain>lowGain,'external evidence must contribute to bounded learning credit');

console.log(JSON.stringify({pass:true,diagnostics:d,accepted,uniqueRecentGoals:actionCounts.size,currentGoal:before},null,2));
function rAction(n){return n.currentGoal().action;}
