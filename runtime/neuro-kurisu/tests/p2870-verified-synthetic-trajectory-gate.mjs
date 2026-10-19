import assert from 'node:assert/strict';
import { VerifiedSyntheticTrajectoryGate } from '../src/organism/cognition/VerifiedSyntheticTrajectoryGate.ts';

const gate=new VerifiedSyntheticTrajectoryGate();
const steps=[{actionIndex:1,latent:[.1,.2,.3,.4],predictedNext:[.4,.3,.2,.1],reward01:.72,confidence01:.82,priority01:.78}];
assert.equal(gate.stage({tick:10,contextId:2,steps,priority01:.78,confidence01:.82})?.startsWith('svt-'),true);
assert.equal(gate.metrics().promotions,0);
let p=gate.observeOutcome({tick:11,action:'explore',reward01:.70,nextLatent:[.41,.29,.19,.11],verified01:.78,holdout01:0,contextId:2});
assert.equal(p.length,0,'one real confirmation must not promote');
p=gate.observeOutcome({tick:12,action:'explore',reward01:.69,nextLatent:[.39,.31,.21,.09],verified01:.72,holdout01:1,contextId:3});
assert.equal(p.length,1,'two confirmations with holdout evidence should promote');
assert.equal(gate.metrics().promotions,1);
assert.equal(gate.metrics().pending,0);
assert.ok(p[0].gain01>0);
const persisted=gate.snapshot();
const restored=new VerifiedSyntheticTrajectoryGate();
restored.restore(persisted);
assert.deepEqual(restored.snapshot(),persisted,'gate snapshot/restart mismatch');
console.log(`P2870_VERIFIED_SYNTHETIC_PROMOTION=PASS promotions=${gate.metrics().promotions} confirmations=${gate.metrics().confirmations} holdout=${p[0].holdoutConfirmations}`);
