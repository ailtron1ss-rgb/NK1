import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const obs={embodiment:{bodyEnergy01:.94,cognitiveCapacity01:.92,thermalStrain01:.11,sensoryFreshness01:.88,battery01:.93,cpuLoad01:.15,ramPressure01:.15,awake:true},novelty:.42,surprise:.08};
const world=(tick,action,reward,branch)=>({action,before:{tick,location:`b313-${branch}`,energy:.82,attention:.81,uncertainty:.46,facts:[`${action}-probe`],objects:[],events:[]},after:{tick:tick+1,location:`b313-${branch}`,energy:.84,attention:.8,uncertainty:reward>.5?.28:.72,facts:[`${action}-probe`,`reward-${reward>.5?'positive':'negative'}`],objects:[],events:['verified-transition']},reward,surprise:reward>.5?.08:.62,at:100000+tick});
const make=async(initial)=>{const c=new OrganismCore(new MemoryStateStore(initial?{initial}:{}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});await c.init();return c;};

const seed=await make();
const initial=seed.snapshot();

async function train(core,mode){
  for(let i=0;i<24;i++){
    const reward=mode==='positive' ? .95 : .05;
    const r=await core.observe({text:'b313 training',...obs});
    const action=r.decision?.selected?.action ?? 'respond';
    await core.feedback({success:reward,reward:reward*.9,surprise:reward>.5?.08:.62,evidenceSource:'device',worldTransition:world(i,action,reward,mode)});
  }
}
async function evaluate(core){
  const counts=Object.fromEntries(actions.map(a=>[a,0]));
  const handoffs=[];
  for(let i=0;i<16;i++){
    const r=await core.observeOperational(obs);
    const a=r.decision?.selected?.action ?? 'wait';
    counts[a]++;
    const h=core.b312ExecutiveDecisionHandoffDiagnostics();
    handoffs.push({action:a,promotions:h.promotions,confirmations:h.confirmations,lastReason:h.lastReason});
  }
  return {counts,handoffs};
}

const positive=await make(initial);
const negative=await make(initial);
await train(positive,'positive');
await train(negative,'negative');
const positiveBefore=positive.b313LongitudinalDiagnostics();
const negativeBefore=negative.b313LongitudinalDiagnostics();
const positiveEval=await evaluate(positive);
const negativeEval=await evaluate(negative);
const positiveAfter=positive.b313LongitudinalDiagnostics();
const negativeAfter=negative.b313LongitudinalDiagnostics();

const l1=actions.reduce((s,a)=>s+Math.abs((positiveEval.counts[a]??0)-(negativeEval.counts[a]??0)),0);
const gap=positiveAfter.positiveVsNegativeGap01;
const neuralDelta=Math.abs((positive.b296NeuralPersonalityAgencyDiagnostics?.plasticity01??0)-(negative.b296NeuralPersonalityAgencyDiagnostics?.plasticity01??0));
const posB296=positive.b296NeuralPersonalityAgencyDiagnostics();
const negB296=negative.b296NeuralPersonalityAgencyDiagnostics();
const posB299=positive.b299CausalPersonalityDiagnostics();
const negB299=negative.b299CausalPersonalityDiagnostics();
const neuralPlasticityGap=Math.abs(posB296.plasticity01-negB296.plasticity01);
const personalityGap=Math.abs(posB299.personalityInfluence01-negB299.personalityInfluence01)+Math.abs(posB299.personalityStability01-negB299.personalityStability01);
const posPolicyValues=Object.values(positive.adaptivePolicy.snapshot().values).flatMap((row)=>Object.entries(row).filter(([a])=>actions.includes(a)).map(([action,v])=>({action,verifiedValue:Number(v?.verifiedValue??.5),verifiedUpdates:Number(v?.verifiedUpdates??0)})));
const negPolicyValues=Object.values(negative.adaptivePolicy.snapshot().values).flatMap((row)=>Object.entries(row).filter(([a])=>actions.includes(a)).map(([action,v])=>({action,verifiedValue:Number(v?.verifiedValue??.5),verifiedUpdates:Number(v?.verifiedUpdates??0)})));
const sharedPolicyActions=actions.map(action=>({action,pos:Math.max(0,...posPolicyValues.filter(x=>x.action===action&&x.verifiedUpdates>0).map(x=>x.verifiedValue)),neg:Math.min(1,...negPolicyValues.filter(x=>x.action===action&&x.verifiedUpdates>0).map(x=>x.verifiedValue).concat([.5]))})).filter(x=>posPolicyValues.some(p=>p.action===x.action&&p.verifiedUpdates>0)||negPolicyValues.some(n=>n.action===x.action&&n.verifiedUpdates>0));
const policyGap=sharedPolicyActions.length?Math.max(...sharedPolicyActions.map(x=>Math.abs(x.pos-x.neg))):0;

assert.ok(policyGap>0.08,'B313 positive/negative training failed to produce policy divergence');
assert.ok(neuralPlasticityGap>0.005,'B313 neural trajectories did not diverge');
assert.ok(personalityGap>0.03,'B313 personality trajectories did not diverge');
assert.ok((positiveAfter.consolidationBridgeUpdates + negativeAfter.consolidationBridgeUpdates)>0,'B313 B285 consolidation bridge never activated');
assert.ok(positiveAfter.developmentalDivergence01>0 || negativeAfter.developmentalDivergence01>0,'B313 divergence metric stayed zero');

const posSnap=positive.snapshot();
const restored=await make(posSnap);
const rd=restored.b313LongitudinalDiagnostics();
assert.equal(rd.cycles,positiveAfter.cycles,'B313 longitudinal cycles lost after restart');
assert.equal(rd.verifiedCycles,positiveAfter.verifiedCycles,'B313 verified cycles lost after restart');
assert.equal(rd.consolidationBridgeUpdates,positiveAfter.consolidationBridgeUpdates,'B313 consolidation bridge evidence lost after restart');

const lesioned=await make(posSnap);
const beforeLesion=lesioned.b313LongitudinalDiagnostics().consolidationBridgeUpdates;
lesioned.b313LongitudinalLesion();
for(let i=0;i<4;i++){const rr=await lesioned.observeOperational(obs); await lesioned.feedback({success:.95,reward:.86,surprise:.08,evidenceSource:'device',worldTransition:world(200+i,rr.decision?.selected?.action??'wait',.95,'lesion')});}
const afterLesion=lesioned.b313LongitudinalDiagnostics();
assert.equal(afterLesion.consolidationBridgeUpdates,beforeLesion,'B313 lesion failed to stop future consolidation-to-policy bridge updates');
const report={pass:true,positiveEval,negativeEval,distributionL1:l1,wholeOrganismDistributionShiftObserved:l1>0,positiveGap:positiveAfter.positiveVsNegativeGap01,policyGap,policyComparisons:sharedPolicyActions,neuralPlasticityGap,personalityGap,positiveDevelopment:positiveAfter.developmentalDivergence01,negativeDevelopment:negativeAfter.developmentalDivergence01,consolidationBridge:{positive:positiveAfter.consolidationBridgeUpdates,negative:negativeAfter.consolidationBridgeUpdates,strengthPositive:positiveAfter.consolidationBridgeStrength01,strengthNegative:negativeAfter.consolidationBridgeStrength01},restart:{cycles:rd.cycles,verifiedCycles:rd.verifiedCycles,bridge:rd.consolidationBridgeUpdates},lesion:{before:beforeLesion,after:afterLesion.consolidationBridgeUpdates}};
console.log(JSON.stringify(report,null,2));
process.exit(0);
