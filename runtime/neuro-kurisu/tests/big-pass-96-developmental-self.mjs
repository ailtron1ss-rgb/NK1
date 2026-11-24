import assert from 'node:assert/strict';
import { P84AutobiographicalContinuityFabric } from '../src/organism/developmental/P84AutobiographicalContinuityFabric.ts';
import { FutureSelfModel } from '../src/organism/cognition/evolution/FutureSelfModel.ts';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';

const p84=new P84AutobiographicalContinuityFabric(24);
const a=p84.recordDevelopmentalConsequence({tick:1,action:'respond',socialSignal01:.7,identityPressure01:.2,selfChange01:.4,causalSignal01:.82,evidenceQuality01:.76,futureSelfDelta01:.05,verified01:true,summary:'verified social consequence'});
const b=p84.recordDevelopmentalConsequence({tick:2,action:'verify',socialSignal01:.5,identityPressure01:.35,selfChange01:.3,causalSignal01:.7,evidenceQuality01:.8,futureSelfDelta01:.02,verified01:true,summary:'second consequence'});
assert.equal(p84.developmentalSummary().count,2);
assert.ok(a.verified01 && b.causalSignal01>.6);
const restored=new P84AutobiographicalContinuityFabric(24); restored.restore(p84.snapshot());
assert.equal(restored.developmentalSummary().count,2);

const future=new FutureSelfModel();
const forecast=future.forecastDevelopmental({identityContinuity01:.82,agency01:.71,socialBinding01:.66,identityPressure01:.2,socialDemand01:.55,horizonCycles:8,confidence01:.74,sourceMomentId:b.sourceMomentId??undefined});
assert.equal(forecast.horizonCycles,8);
const mismatch=future.resolveDevelopmental({identityContinuity01:.8,agency01:.69,socialBinding01:.64});
assert.ok(mismatch>=0 && mismatch<=1);
const fsRestored=new FutureSelfModel(); fsRestored.restore(future.snapshot());
assert.equal(fsRestored.snapshot().developmentalForecasts.length,1);

const learning=new UnifiedLearningSubstrate();
const transfer=learning.observeDevelopmentalSignal({identityContinuity01:.82,socialBinding01:.64,identityPressure01:.2,causalSignal01:.8,evidenceQuality01:.77,selfChange01:.34});
assert.ok(transfer>.5);
assert.ok(learning.diagnostics().developmentalTransfer01>0);

console.log(`BIG_PASS_96_DEVELOPMENTAL_SELF=PASS consequences=${p84.developmentalSummary().count} mismatch=${mismatch.toFixed(4)} transfer=${transfer.toFixed(4)}`);
