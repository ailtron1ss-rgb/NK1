import assert from 'node:assert/strict';
import { IdentityTrajectoryEngine, defaultIdentityTrajectory } from '../src/organism/cognition/evolution/IdentityTrajectoryEngine.ts';
const engine=new IdentityTrajectoryEngine(); engine.restore(defaultIdentityTrajectory());
const base=engine.snapshot();
for(let i=0;i<20;i++) engine.observeOutcome({action:i%2?'explore':'verify',success01:i%2?.2:.8,surprise01:.7,trust01:.1,phase:'exploring',attractor:'curiosity',identityPressure01:.9,predictionError01:.8,goalFamily:'adversarial'});
const after=engine.snapshot();
assert.ok(after.pathDependence01-base.pathDependence01 < .5,'single noisy source must not explode identity path dependence');
const ignored=engine.observeMemoryInfluence({magnitude01:.95,independentSources:0,outcomeCount:0,verified:false}); assert.equal(ignored.applied,false);
console.log(`BIG_PASS_168_ADVERSARIAL=PASS basePath=${base.pathDependence01.toFixed(3)} afterPath=${after.pathDependence01.toFixed(3)} rejectedUncorroborated=${ignored.applied===false}`);
