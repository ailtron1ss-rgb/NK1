import assert from 'node:assert/strict';
import { B2522AdaptiveWorldModelMixtureRouter } from '../src/organism/cognition/B2522AdaptiveWorldModelMixtureRouter.ts';
import { B2523MultiHorizonCounterfactualVerifier } from '../src/organism/cognition/B2523MultiHorizonCounterfactualVerifier.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const util=()=>Object.fromEntries(actions.map((a,i)=>[a,.46+(i%4)*.025]));
const bias=(scale,shift=0)=>Object.fromEntries(actions.map((a,i)=>[a,Math.sin(i*1.7+shift)*scale]));
const router=new B2522AdaptiveWorldModelMixtureRouter(); const verifier=new B2523MultiHorizonCounterfactualVerifier();
for(let t=1;t<=800;t++){
 const r=router.beforeDecision({tick:t,baseUtilities:util(),persistentBias:bias(.05),counterfactualBias:bias(.07,.7),sensorimotorBias:bias(.04,1.4),generativeBias:bias(.08,2.2),persistentConfidence01:.65,counterfactualConfidence01:t%13===0?.25:.72,sensorimotorConfidence01:.58,generativeConfidence01:t%17===0?.2:.78,uncertainty01:t%11===0?.82:.25,novelty01:t%7===0?.7:.22,predictionError01:t%19===0?.75:.2,computeBudget01:.82});
 const v=verifier.beforeDecision({tick:t,baseUtilities:util(),uncertainty01:t%11===0?.82:.25,predictionError01:t%19===0?.75:.2,goalPressure01:.58,modelConfidence01:r.mixtureConfidence01,routerDisagreement01:r.disagreement01,computeBudget01:.82});
 const a=actions.slice().sort((x,y)=>(util()[y]+r.actionBias[y]+v.actionBias[y])-(util()[x]+r.actionBias[x]+v.actionBias[x]))[0];
 router.afterOutcome({tick:t,reward01:a==='verify'&&t%19===0?.9:.64,predictionError01:t%19===0?.7:.2,verified01:a==='verify'&&t%19===0?.92:.74,selectedAction:a});
 verifier.afterOutcome({tick:t,action:a,reward01:a==='verify'&&t%19===0?.9:.64,predictionError01:t%19===0?.7:.2,verified01:a==='verify'&&t%19===0?.92:.74});
}
const rm=router.diagnostics(),vm=verifier.diagnostics();
assert.equal(rm.cycles,800); assert.equal(vm.cycles,800); assert(rm.learningUpdates>0); assert(vm.rollouts>0); assert(rm.coverage01>0); assert(vm.verificationConfidence01>0); assert(rm.disagreement01>=0&&rm.disagreement01<=1); assert(vm.selectedHorizon>=2);
const rs=router.snapshot(),rr=new B2522AdaptiveWorldModelMixtureRouter();rr.restore(rs);assert.deepEqual(rr.snapshot(),rs);const vs=verifier.snapshot(),vr=new B2523MultiHorizonCounterfactualVerifier();vr.restore(vs);assert.deepEqual(vr.snapshot(),vs);
const runtime=new OrganismRuntime({stateStore:new MemoryStateStore(),stateFile:'/tmp/nk-p2677.json',enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'operational',performanceProfile:'mobile'});await runtime.init();
for(let i=0;i<6;i++) await runtime.autonomousStep({novelty:i%9===0?.72:.22,uncertainty:i%11===0?.78:.28,reward:i%17===0?.35:.74,embodiment:{bodyEnergy01:.72,cognitiveCapacity01:.82,thermalStrain01:.15,sensoryFreshness01:.86,awake:true,battery01:.78,cpuLoad01:.24,ramPressure01:.21}});
const rd=runtime.core.b2522AdaptiveWorldModelMixtureRouterDiagnostics();const vd=runtime.core.b2523MultiHorizonCounterfactualVerifierDiagnostics();
assert(rd.cycles>0);assert(vd.cycles>0);assert(rd.learningUpdates>0);assert(vd.rollouts>0);const persisted=runtime.core.snapshot().system;assert(persisted.b2522AdaptiveWorldModelMixtureRouter);assert(persisted.b2523MultiHorizonCounterfactualVerifier);await runtime.stop();
console.log(JSON.stringify({standalone:{routerCycles:rm.cycles,routerUpdates:rm.learningUpdates,coverage01:rm.coverage01,disagreement01:rm.disagreement01,mixtureConfidence01:rm.mixtureConfidence01,routingEntropy01:rm.routingEntropy01,verifierCycles:vm.cycles,rollouts:vm.rollouts,horizon:vm.selectedHorizon,verificationConfidence01:vm.verificationConfidence01,agreement01:vm.counterfactualAgreement01},integrated:{routerCycles:rd.cycles,routerUpdates:rd.learningUpdates,coverage01:rd.coverage01,disagreement01:rd.disagreement01,verifierCycles:vd.cycles,rollouts:vd.rollouts,horizon:vd.selectedHorizon,verificationConfidence01:vd.verificationConfidence01}}));
