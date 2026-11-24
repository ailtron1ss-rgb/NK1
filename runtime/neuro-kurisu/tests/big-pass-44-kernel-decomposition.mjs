import assert from 'node:assert/strict';
import { CognitiveKernelCoordinator } from '../src/organism/core/CognitiveKernelCoordinator.ts';
import { P61IntegratedMindKernel } from '../src/organism/cognition/P61IntegratedMindKernel.ts';
import { P64IntegratedOrganismDynamics } from '../src/organism/cognition/P64IntegratedOrganismDynamics.ts';

const s={
 tick:3,at:123456,observationId:'test',externalInput:false,
 identity01:.82,workspace01:.6,metacognitive01:.55,predictionError01:.2,uncertainty01:.3,novelty01:.4,
 grounding01:.65,causal01:.6,bodyEnergy01:.8,thermal01:.2,cognitiveCapacity01:.8,memoryPressure01:.15,
 socialNeed01:.2,goalPressure01:.4,realityGap01:.2,memoryHealth01:.85,developmentalPriority01:.3,
 identityDecision:'allow',candidates:[{action:'rest',score:.4,confidence01:.6,source:'internal',salience01:.4},{action:'explore',score:.65,confidence01:.7,source:'internal',salience01:.65}]
};
const p61a=new P61IntegratedMindKernel(), p64a=new P64IntegratedOrganismDynamics();
const p61b=new P61IntegratedMindKernel(), p64b=new P64IntegratedOrganismDynamics();
const ca=new CognitiveKernelCoordinator(p61a,p64a), cb=new CognitiveKernelCoordinator(p61b,p64b);
const p64Signals={...s}; delete p64Signals.observationId; delete p64Signals.candidates; delete p64Signals.externalInput;
const direct61=p61a.integrate(s);
const direct64=p64a.arbitrate({tick:s.tick,at:s.at,signals:p64Signals,candidates:s.candidates.map(x=>({...x,userRequested:false}))});
const actualCandidates=s.candidates.map(x=>({...x}));
const combined=cb.integrateAndArbitrate(s,p64Signals,actualCandidates,undefined);
assert.equal(combined.p61.mode,direct61.mode);
assert.equal(combined.p64.mode,direct64.mode);
assert.equal(combined.p64.broadcastToken,direct64.broadcastToken);
assert.equal(combined.candidates.length,2);

console.log(`BIG_PASS_44_KERNEL=PASS coordinator-equivalence`);
