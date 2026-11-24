import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const EMB={awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.16,sensoryFreshness01:.74,battery01:.84,cpuLoad01:.22,ramPressure01:.20};
const seq=(n)=>Array.from({length:n},(_,i)=>i%2===0
  ? {epistemic:.64,autonomy:.18,maintenance:.10,social:.08, novelty:.34, uncertainty:.68}
  : {epistemic:.14,autonomy:.66,maintenance:.10,social:.10, novelty:.78, uncertainty:.42});
function hist(actions){const h=Object.fromEntries(ACTIONS.map(a=>[a,0])); for(const a of actions)h[a]=(h[a]??0)+1; const n=Math.max(1,actions.length); return Object.fromEntries(ACTIONS.map(a=>[a,h[a]/n]));}
function policyFromDecision(decision){const t=.035; const rows=decision.candidates.map(c=>[c.action,c.score]); const max=Math.max(...rows.map(x=>x[1]),0); const ex=rows.map(([a,v])=>[a,Math.exp((v-max)/t)]); const z=ex.reduce((s,x)=>s+x[1],0)||1; return Object.fromEntries(ACTIONS.map(a=>[a,(ex.find(x=>x[0]===a)?.[1]??0)/z]));}
async function runPolicy(core, contexts){const acc=Object.fromEntries(ACTIONS.map(a=>[a,0])); let count=0; const actions=[]; for(const c of contexts){core.b299CausalPersonalitySetContext(c); const r=await core.observe({...c,embodiment:EMB},'operational'); const p=policyFromDecision(r.decision); for(const a of ACTIONS)acc[a]+=p[a]??0; actions.push(r.decision.selected?.action??'wait'); count++;} return {policy:Object.fromEntries(ACTIONS.map(a=>[a,acc[a]/Math.max(1,count)])),actions};}
function l1(a,b){return ACTIONS.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0)/2;}
function rewardFor(action, c){
  const target=c.autonomy>.5?'explore':c.epistemic>.5?'verify':'reflect';
  return action===target?.92: action==='wait'?.34: action==='defer'?.38: .46;
}
const DIT_CONFIG={performanceProfile:'mobile',cycleResultMode:'operational',spineOnly:true,
  enableHomeostasis:true,enableIntrinsicGoals:true,enableWorldModel:true,enableSelfPrediction:false,enableWorkspace:false,enableActiveInference:false,enableIntrinsicMotivation:false,enableValuePlasticity:false,enableSelfProjects:false,enableAgencyModel:false,enableValueEvolution:false,enableIdentityTrajectory:false,enableCognitiveNetwork:false,enableNeuromodulation:false,enableSemanticMemory:false,enableCognitiveField:false,enableContradictions:false,enableCognitiveBudget:false,enableCognitiveImmune:false,enableProceduralSkills:false,enableScientificMethod:false,enableLearnedResidualWorld:false,enableUnifiedMemory:false,enableSocialDevelopment:false,enablePerception:false,enableLifelongLearning:false};
async function make(spineOnly=true, initial){
  const core=new OrganismCore(new MemoryStateStore(initial?{initial}:undefined),{...DIT_CONFIG,spineOnly});
  await core.init();
  return core;
}
async function runSequence(core, contexts, feedback=false, out=[]){
  for(const c of contexts){
    core.b299CausalPersonalitySetContext(c);
    const r=await core.observe({novelty:c.novelty,uncertainty:c.uncertainty,embodiment:EMB},'operational');
    const action=r.decision.selected?.action ?? 'wait';
    out.push(action);
    if(feedback) await core.feedback({reward:rewardFor(action,c),success:rewardFor(action,c),surprise:Math.abs(.5-rewardFor(action,c))});
  }
  return out;
}

// Brick 1: endogenous training on two contexts, no injected preference values.
const trainer=await make(true);
await runSequence(trainer,seq(64),true,[]);
const trainedSnap=trainer.snapshot();
const trainedB299=structuredClone(trainedSnap.system.causalPersonalityDevelopmentB299);
assert(trainedB299.learningUpdates>=40,'B299 did not learn enough endogenous outcomes');
assert(trainedB299.actionPhenotypes.some(p=>p.samples>0),'B299 samples are empty');

// Restart must preserve the learned identity state.
const restarted=await make(true,trainedSnap);
const restartedB299=restarted.snapshot().system.causalPersonalityDevelopmentB299;
assert.equal(restartedB299.learningUpdates,trainedB299.learningUpdates,'restart lost B299 learning updates');

const unseen=Array.from({length:40},()=>({epistemic:.55,autonomy:.25,maintenance:.12,social:.08,novelty:.63,uncertainty:.57}));

// Matched baseline: keep identical physiological/body/world state and inject only the trained B299 identity state.
const fresh=await make(true);
const matchedBase=structuredClone(fresh.snapshot());
const trainedB299Only=structuredClone(trainedSnap.system.causalPersonalityDevelopmentB299);
matchedBase.system.causalPersonalityDevelopmentB299=structuredClone(trainedB299Only);

// Untaught baseline keeps the same state but no B299 learned history.
const freshBase=structuredClone(fresh.snapshot());
const freshRun=await runPolicy(await make(true,freshBase),unseen);
const freshHist=freshRun.policy;

// Trained normal: only B299 history differs from the same matched baseline.
const normal=await make(true,matchedBase);
const normalRun=await runPolicy(normal,unseen);
const normalHist=normalRun.policy;

// Real lesion: remove the complete B299 identity-owner channel's causal contribution from the matched baseline.
const lesion=await make(true,matchedBase);
lesion.b299CausalPersonalityLesion(1.0);
const lesionRun=await runPolicy(lesion,unseen);
const lesionHist=lesionRun.policy;

// Sham lesion: same matched baseline, but only a small deterministic perturbation of stored preferences.
const shamSnap=structuredClone(matchedBase);
const phen=shamSnap.system.causalPersonalityDevelopmentB299.actionPhenotypes;
for(let i=0;i<phen.length;i++){
  const delta=((i%3)-1)*.025;
  phen[i].preference11=Math.max(-1,Math.min(1,phen[i].preference11+delta));
  phen[i].consolidatedPreference11=Math.max(-1,Math.min(1,phen[i].consolidatedPreference11-delta*.5));
}
const sham=await make(true,shamSnap);
const shamRun=await runPolicy(sham,unseen);
const shamHist=shamRun.policy;

const historyEffect=l1(freshHist,normalHist);
const lesionResidual=l1(freshHist,lesionHist);
const shamResidual=l1(freshHist,shamHist);
const ablationDrop=historyEffect>1e-9 ? Math.max(0,(historyEffect-lesionResidual)/historyEffect) : 0;
const shamDrop=historyEffect>1e-9 ? Math.max(0,(historyEffect-shamResidual)/historyEffect) : 0;
const lesionVsNormal=l1(normalHist,lesionHist);
const shamVsNormal=l1(normalHist,shamHist);

const criteria={
  endogenousLearning:trainedB299.learningUpdates>=40,
  restartContinuity:restartedB299.learningUpdates===trainedB299.learningUpdates,
  distributionalIdentityChange:historyEffect>=0.08,
  lesionReversion:ablationDrop>=0.70,
  shamControl:shamDrop<0.30,
  lesionStrongerThanSham:lesionVsNormal>shamVsNormal+0.02,
};
const pass=Object.values(criteria).every(Boolean);

const report={
  pass,
  mode:'SPINE_ONLY',
  brick: '0+1',
  cyclesTrained:64,
  unseenCycles:40,
  trainedLearningUpdates:trainedB299.learningUpdates,
  developmentalStage:trainedB299.developmentalStage,
  maturity01:trainedB299.maturity01,
  freshHistogram:freshHist,
  trainedHistogram:normalHist,
  lesionHistogram:lesionHist,
  shamHistogram:shamHist,
  historyEffectL1:historyEffect,
  lesionResidualL1:lesionResidual,
  shamResidualL1:shamResidual,
  ablationDrop01:ablationDrop,
  shamDrop01:shamDrop,
  lesionVsNormalL1:lesionVsNormal,
  shamVsNormalL1:shamVsNormal,
  criteria,
};
console.log(JSON.stringify(report,null,2));
if(!pass) process.exitCode=2;
