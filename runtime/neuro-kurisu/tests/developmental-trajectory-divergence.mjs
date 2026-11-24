import assert from 'node:assert/strict';
import { IdentityTrajectoryEngine } from '../src/organism/cognition/evolution/IdentityTrajectoryEngine.ts';

const values={curiosity:.8,truth:.95,autonomy:.82,evidence:.92,care:.65,responsibility:.86,social:.5,updatedAt:0,plasticityBudget:.8};
const projects=[];
function seeded(){ const e=new IdentityTrajectoryEngine(); e.update({values,activeProjects:projects,narrativeContinuity:.8,authoredContinuity:.7}); return e; }

const verifyPath=seeded();
const explorePath=seeded();
for(let i=0;i<8;i++){
  verifyPath.observeOutcome({action:'verify',success01:.86,surprise01:.72,trust01:.9,phase:'revising',attractor:'truthfulness',motive:'epistemic',goalFamily:'evidence'});
  explorePath.observeOutcome({action:'explore',success01:.86,surprise01:.72,trust01:.9,phase:'exploring',attractor:'exploration',motive:'exploratory',goalFamily:'discovery'});
}
const a=verifyPath.snapshot();
const b=explorePath.snapshot();
assert.equal(a.version,2);
assert.equal(b.version,2);
assert.ok((a.actionBiases.verify??0)>(a.actionBiases.explore??0));
assert.ok((b.actionBiases.explore??0)>(b.actionBiases.verify??0));
assert.ok(a.pathDependence01>.15 && b.pathDependence01>.15);
assert.notEqual(a.dominantDirection,b.dominantDirection);
assert.ok(Math.abs((a.actionBiases.verify??0)-(b.actionBiases.verify??0))>.02);

const reverseEngine = new IdentityTrajectoryEngine();
for(let i=0;i<6;i++) reverseEngine.observeOutcome({action:'verify',success01:.95,surprise01:.65,trust01:1,phase:'revising',attractor:'truthfulness',goalFamily:'evidence'});
const positiveCarry=reverseEngine.actionBias('verify');
for(let i=0;i<8;i++) reverseEngine.observeOutcome({action:'verify',success01:.05,surprise01:.9,trust01:1,phase:'revising',attractor:'truthfulness',goalFamily:'evidence'});
const reversedCarry=reverseEngine.actionBias('verify');
assert.ok(reversedCarry<positiveCarry,`counterevidence failed to reduce carry-over: ${positiveCarry} -> ${reversedCarry}`);

const restored=new IdentityTrajectoryEngine();
restored.restore(a);
assert.equal(restored.snapshot().version,2);
assert.equal(restored.snapshot().outcomeSamples,8);
assert.equal(restored.actionBias('verify') > restored.actionBias('explore'),true);

console.log(`DEVELOPMENTAL_TRAJECTORY_DIVERGENCE=PASS verifyBias=${restored.actionBias('verify').toFixed(4)} exploreBias=${restored.actionBias('explore').toFixed(4)} path=${a.pathDependence01.toFixed(3)}`);
