import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const BASE_CONFIG={
  performanceProfile:'mobile',
  cycleResultMode:'operational',
  enableTemporalResolutionGovernor:true,
  operationalPulseEvery:2,
  checkpointMaxDirtyCycles:1,
  checkpointMinIntervalMs:0,
};
const healthy={embodiment:{bodyEnergy01:.90,cognitiveCapacity01:.88,thermalStrain01:.16,sensoryFreshness01:.86,battery01:.88,cpuLoad01:.20,ramPressure01:.20,awake:true},novelty:.44,surprise:.10};
const stressed={embodiment:{bodyEnergy01:.32,cognitiveCapacity01:.36,thermalStrain01:.82,sensoryFreshness01:.55,battery01:.18,cpuLoad01:.78,ramPressure01:.82,awake:true},novelty:.76,surprise:.48};
const world=(tick,action,reward,branch)=>({action,before:{tick,location:`b317-${branch}`,energy:.80,attention:.75,uncertainty:reward>.55?.45:.72,facts:[`${branch}-before-${tick}`,`action:${action}`],objects:[],events:[]},after:{tick:tick+1,location:`b317-${branch}`,energy:Math.max(.18,.78-reward*.04),attention:Math.min(.92,.74+reward*.10),uncertainty:reward>.55?.26:.76,facts:[`${branch}-after-${tick}`,`action:${action}`,`outcome:${reward>.55?'positive':'negative'}`],objects:[],events:['verified-transition']},reward,surprise:reward>.55?.07:.64,at:900000+tick});

const make=async(initial)=>{const store=new MemoryStateStore(initial?{initial}:{});const c=new OrganismCore(store,BASE_CONFIG);await c.init();return {core:c,store};};
const scoreVector=counts=>ACTIONS.map(a=>counts[a]??0);
const l1=(a,b)=>ACTIONS.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0);

async function runBranch(core, branch, cycles){
  const counts=Object.fromEntries(ACTIONS.map(a=>[a,0]));
  const closure=[]; const timings=[];
  for(let i=0;i<cycles;i++){
    const observation = branch==='positive'
      ? {...healthy,text:i%5===0?'Verify the consequence and update from the observed outcome.':'Explore a useful consequence before acting.'}
      : branch==='negative'
        ? {...healthy,text:i%5===0?'This context produced a bad verified consequence; avoid repeating it.':'Reconsider the uncertain action using evidence.'}
        : {...stressed,text:'Protect resources and verify before costly action.'};
    const started=performance.now();
    const result=await core.observeOperational(observation);
    timings.push(performance.now()-started);
    const action=result.decision?.selected?.action ?? result.decision?.action ?? 'wait';
    counts[action]=(counts[action]??0)+1;
    const reward=branch==='positive'
      ? (action==='verify'?.94:action==='explore'?.89:action==='reflect'?.83:.76)
      : branch==='negative'
        ? (action==='rest'?.46:action==='defer'?.34:.12)
        : (action==='rest'?.82:action==='wait'?.78:.30);
    await core.feedback({success:reward,reward:reward*.9,surprise:reward>.55?.08:.60,evidenceSource:branch==='stress'?'device':'device',worldTransition:world(i,action,reward,branch)});
    const d=core.cognitiveDomainClosureDiagnostics();
    closure.push(d);
  }
  const sorted=[...timings].sort((a,b)=>a-b);
  return {counts,closure,lastClosure:closure.at(-1),meanMs:timings.reduce((a,b)=>a+b,0)/Math.max(1,timings.length),p95Ms:sorted[Math.floor(sorted.length*.95)]};
}

// A. Independent positive/negative developmental trajectories.
const seedPack=await make();
const initial=seedPack.core.snapshot();
const positivePack=await make(initial);
const negativePack=await make(initial);
const stressPack=await make(initial);
const positive=positivePack.core, negative=negativePack.core, stress=stressPack.core;
const pos=await runBranch(positive,'positive',4);
const neg=await runBranch(negative,'negative',4);
const st=await runBranch(stress,'stress',4);

const posB296=positive.b296NeuralPersonalityAgencyDiagnostics();
const negB296=negative.b296NeuralPersonalityAgencyDiagnostics();
const posB299=positive.b299CausalPersonalityDiagnostics();
const negB299=negative.b299CausalPersonalityDiagnostics();
const posB313=positive.b313LongitudinalDiagnostics();
const negB313=negative.b313LongitudinalDiagnostics();
const posCritical=positive.b305CriticalPathDiagnostics();
const negCritical=negative.b305CriticalPathDiagnostics();
const closurePos=positive.cognitiveDomainClosureDiagnostics();
const closureNeg=negative.cognitiveDomainClosureDiagnostics();
const closureStress=stress.cognitiveDomainClosureDiagnostics();

// B. Require actual cross-domain activity, not merely function existence.
for (const [label,diag] of [['positive',closurePos],['negative',closureNeg]]) {
  assert.ok(diag.totalCycles>=3,`B317 ${label} closure did not accumulate enough cycles`);
  assert.ok(diag.completeCycles>=Math.floor(diag.totalCycles*.50),`B317 ${label} cognitive-domain closure too sparse`);
  assert.ok(diag.meanContinuity01>.55,`B317 ${label} continuity evidence too weak`);
  assert.ok(diag.persistenceCoverage01>0.80,`B317 ${label} persistence-ready coverage too low`);
}
assert.ok(closureStress.totalCycles>=3,'B317 stress branch did not execute');
assert.ok(closureStress.meanContinuity01>.30,'B317 resource-stress branch lost all cognitive closure');

// C. Learning must actually diverge behaviourally between matched branches.
const distributionShift=l1(pos.counts,neg.counts);
const neuralGap=Math.abs(posB296.plasticity01-negB296.plasticity01);
const personalityGap=Math.abs(posB299.personalityInfluence01-negB299.personalityInfluence01)+Math.abs(posB299.personalityStability01-negB299.personalityStability01);
const policyGap=Math.abs((posB299.personalityInfluence01??0)-(negB299.personalityInfluence01??0));
assert.ok(posB296.learningUpdates>0 && negB296.learningUpdates>0,'B317 live branches did not learn');
assert.ok(posB296.synapticUpdates>0 && negB296.synapticUpdates>0,'B317 live branches produced no neural plasticity');
assert.ok(distributionShift>=2 || neuralGap>.005 || personalityGap>.025,'B317 matched branches did not diverge behaviourally/internal-state-wise');

// D. The cross-domain critical path must be exercised in each branch.
for (const [label,d] of [['positive',posCritical],['negative',negCritical]]) {
  assert.ok(d.cycles>=3,`B317 ${label} critical path too short`);
  assert.ok(d.neuralUpdateCycles>0,`B317 ${label} neural edge never activated`);
  assert.ok(d.causalBridgeCycles>0,`B317 ${label} causal edge never activated`);
  assert.ok(d.personalityUpdateCycles>0,`B317 ${label} personality edge never activated`);
  assert.ok(d.policyShiftCycles>0,`B317 ${label} policy edge never activated`);
  assert.ok(d.verifiedOutcomeCycles>0,`B317 ${label} verified outcome edge never activated`);
}

// E. Restart proof: state after a durable snapshot must preserve both continuity and learning.
const beforeRestart=await positivePack.store.load();
const expectedClosure=positive.cognitiveDomainClosureDiagnostics();
const expectedClosureSnapshot=positive.cognitiveDomainClosureSnapshot();
const expectedLearning=positive.b296NeuralPersonalityAgencyDiagnostics().learningUpdates;
const restoredPack=await make(beforeRestart);
const restored=restoredPack.core;
const restoredClosure=restored.cognitiveDomainClosureDiagnostics();
const restoredLearning=restored.b296NeuralPersonalityAgencyDiagnostics().learningUpdates;
assert.equal(restoredClosure.totalCycles,expectedClosure.totalCycles,'B317 cognitive closure lost after restart');
assert.equal(restoredPack.core.cognitiveDomainClosureSnapshot().totalCycles,expectedClosureSnapshot.totalCycles,'B317 raw closure snapshot lost after real store restart');
assert.equal(restoredClosure.completeCycles,expectedClosure.completeCycles,'B317 closure completion history lost after restart');
assert.equal(restoredLearning,expectedLearning,'B317 learning history lost after restart');

// F. Continue after restart: restored organism must remain causally alive, not merely load a snapshot.
const resumed=await runBranch(restored,'positive',3);
const resumedClosure=restored.cognitiveDomainClosureDiagnostics();
assert.ok(resumedClosure.totalCycles>expectedClosure.totalCycles,'B317 restored runtime did not continue cognitive life');
assert.ok(resumedClosure.completeCycles>=expectedClosure.completeCycles,'B317 restored runtime regressed closure completions');
assert.ok(restored.b296NeuralPersonalityAgencyDiagnostics().learningUpdates>expectedLearning,'B317 restored runtime stopped learning after restart');

// G. Negative control: resource stress may reduce depth, but must not produce fabricated perfect health.
const stressTelemetry=stress.snapshot().state.needs;
assert.ok(stressTelemetry.energy<.90,'B317 stress branch did not retain resource pressure');
assert.ok(closureStress.meanContinuity01<closurePos.meanContinuity01 || stressTelemetry.energy<.60,'B317 stress branch behaved identically to healthy branch');

const result={
  pass:true,
  baseline:{initialTick:initial.state.tick},
  trajectories:{
    positive:{...pos,closure:closurePos,b296:{learningUpdates:posB296.learningUpdates,synapticUpdates:posB296.synapticUpdates,plasticity01:posB296.plasticity01},b299:{personalityInfluence01:posB299.personalityInfluence01,personalityStability01:posB299.personalityStability01},b313:{developmentalDivergence01:posB313.developmentalDivergence01,consolidationBridgeUpdates:posB313.consolidationBridgeUpdates},criticalPath:posCritical},
    negative:{...neg,closure:closureNeg,b296:{learningUpdates:negB296.learningUpdates,synapticUpdates:negB296.synapticUpdates,plasticity01:negB296.plasticity01},b299:{personalityInfluence01:negB299.personalityInfluence01,personalityStability01:negB299.personalityStability01},b313:{developmentalDivergence01:negB313.developmentalDivergence01,consolidationBridgeUpdates:negB313.consolidationBridgeUpdates},criticalPath:negCritical},
    stress:{...st,closure:closureStress,needs:stressTelemetry},
  },
  divergence:{distributionShift,neuralGap,personalityGap,policyGap},
  restart:{preservedClosureCycles:restoredClosure.totalCycles,preservedLearningUpdates:restoredLearning,resumedCycles:resumedClosure.totalCycles,resumedLearningUpdates:restored.b296NeuralPersonalityAgencyDiagnostics().learningUpdates},
};
console.log(JSON.stringify(result,null,2));
process.exit(0);
