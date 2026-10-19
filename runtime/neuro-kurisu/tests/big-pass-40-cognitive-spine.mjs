import assert from 'node:assert/strict';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';
import { ExternalEvidenceTrustEngine } from '../src/organism/system/ExternalEvidenceTrust.ts';
import { LongHorizonPredictionBenchmark } from '../src/organism/system/LongHorizonPredictionBenchmark.ts';
import { ModelOlympics } from '../src/organism/system/ModelOlympics.ts';

const ex=new AutonomousProjectExecutor();
ex.ensure({id:'p1',origin:'unresolved'});
ex.observe({action:'verify',success01:.9,evidence01:.9,relevant:true,tick:1});
const after=ex.snapshot();
assert.equal(after.completedSteps,1);
assert.equal(ex.currentStep()?.id,'repeat');
// A skipped project cadence must not erase progress. This mirrors the fixed Core lifecycle.
assert.equal(ex.snapshot().completedSteps,1);

const trust=new ExternalEvidenceTrustEngine();
trust.observe({claimKey:'x',source:'device',independenceKey:'camera:0',confidence01:.95,at:Date.now()});
trust.observe({claimKey:'x',source:'external-api',independenceKey:'api:weather',confidence01:.92,at:Date.now()+1});
assert.equal(trust.independenceCount('x'),2);
assert.ok(trust.scoreClaim('x')>.55);

const lhp=new LongHorizonPredictionBenchmark();
const base={version:87,tick:0,at:Date.now(),needs:{energy:.8,cognitiveLoad:.2,uncertainty:.2,socialNeed:.2,novelty:.3,identityCoherence:.9,goalPressure:.3},predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.5,selfPredictionError:.2,predictedNextAction:'verify',lastPredictionConfidence:.7,worldContextVersion:1};
lhp.seed(base,1,.9); lhp.tick({...base,tick:1});
lhp.seed({...base,tick:1},4,.9); lhp.tick({...base,tick:6});
assert.ok(lhp.snapshot().version===2);
assert.ok(Number.isFinite(lhp.snapshot().improvementByHorizon['1']));

const olympics=new ModelOlympics();
for(let i=0;i<16;i++) olympics.scoreRound({actual01:.8,predictions:{strong:{predicted01:.8},weak:{predicted01:.2}},at:i});
const ensemble=olympics.ensemble({strong:.9,weak:.1});
assert.ok(ensemble>.5 && ensemble<.9);
assert.equal(olympics.snapshot().winner,'strong');

console.log('BIG_PASS_40_SPINE=PASS',JSON.stringify({projectCompleted:after.completedSteps,projectNext:ex.currentStep()?.id,independentEvidence:trust.independenceCount('x'),horizonVersion:lhp.snapshot().version,ensemble:+ensemble.toFixed(4),winner:olympics.snapshot().winner}));
