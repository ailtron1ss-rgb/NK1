import type { ActionKind, OrganismNeeds, OrganismState, PredictedActionOutcome } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signedClamp=(x:number)=>Math.max(-0.15,Math.min(0.15,Number.isFinite(x)?x:0));
const now=()=>Date.now();
const hash=(s:string)=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');};

type ResearchStatus='proposed'|'running'|'replicated'|'rejected'|'rolled-back';
export type ResearchArea='perception'|'world-model'|'policy'|'self-model'|'agency'|'resource'|'memory';

export interface P38Hypothesis{
  id:string;
  area:ResearchArea;
  title:string;
  hypothesis:string;
  evidence:string[];
  priority01:number;
  expectedGain01:number;
  estimatedCost01:number;
  status:ResearchStatus;
  createdAt:number;
  lastRunAt:number;
  result01:number|null;
}

export interface P38Trial{
  id:string;
  hypothesisId:string;
  intervention:string;
  control01:number;
  treatment01:number;
  delta01:number;
  independent:boolean;
  sandboxed:boolean;
  replicated:boolean;
  replicationConsistency01:number;
  replicaDeltas:number[];
  runs:number;
  metric:string;
  at:number;
}

export interface P38Evidence{
  id:string;
  hypothesisId:string;
  level:'sandboxed-observed'|'sandboxed-replicated'|'external-observed'|'external-replicated';
  summary:string;
  trialIds:string[];
  at:number;
}

export interface P38ResearchState{
  version:1;
  cycles:number;
  lastCycleAt:number;
  currentHypothesisId:string|null;
  hypotheses:P38Hypothesis[];
  trials:P38Trial[];
  evidence:P38Evidence[];
  budget01:number;
  spentBudget01:number;
  acceptedUpdates:number;
  rejectedUpdates:number;
  rollbackCount:number;
  actionBias:Record<ActionKind,number>;
  metrics:{
    hypothesisQuality01:number;
    replicationRate01:number;
    causalEvidence01:number;
    researchEfficiency01:number;
    autonomousResearchRate01:number;
  };
}

export interface P38ProposalInput{
  state:OrganismState;
  needs:OrganismNeeds;
  predictionError01:number;
  p37Conflict01:number;
  worldError01:number;
  activeAction?:ActionKind|null;
  preferredArea?:ResearchArea;
}

const defaultState=():P38ResearchState=>({
  version:1,cycles:0,lastCycleAt:0,currentHypothesisId:null,hypotheses:[],trials:[],evidence:[],
  budget01:.72,spentBudget01:0,acceptedUpdates:0,rejectedUpdates:0,rollbackCount:0,
  actionBias:{respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0},
  metrics:{hypothesisQuality01:.4,replicationRate01:0,causalEvidence01:0,researchEfficiency01:.4,autonomousResearchRate01:0},
});

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const AREAS:readonly ResearchArea[]=['perception','world-model','policy','self-model','agency','resource','memory'];
const STATUSES:readonly ResearchStatus[]=['proposed','running','replicated','rejected','rolled-back'];
const EVIDENCE_LEVELS=['sandboxed-observed','sandboxed-replicated','external-observed','external-replicated'] as const;
const str=(v:unknown,f:string,n=240):string=>typeof v==='string'&&v?v.slice(0,n):f;
const strOrNull=(v:unknown,n=160):string|null=>typeof v==='string'&&v?v.slice(0,n):null;
const sanHyp=(x:unknown):P38Hypothesis|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,area:AREAS.includes(r.area as ResearchArea)?r.area as ResearchArea:'policy',title:str(r.title,'',240),hypothesis:str(r.hypothesis,'',400),evidence:Array.isArray(r.evidence)?r.evidence.filter((e):e is string=>typeof e==='string').slice(0,32):[],priority01:C01(r.priority01,0),expectedGain01:C01(r.expectedGain01,0),estimatedCost01:C01(r.estimatedCost01,0),status:STATUSES.includes(r.status as ResearchStatus)?r.status as ResearchStatus:'proposed',createdAt:cnt(r.createdAt,0),lastRunAt:cnt(r.lastRunAt,0),result01:r.result01===null||r.result01===undefined?null:C01(r.result01,0)};};
const sanTrial=(x:unknown):P38Trial|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,hypothesisId:str(r.hypothesisId,'',120),intervention:str(r.intervention,'',240),control01:C01(r.control01,0),treatment01:C01(r.treatment01,0),delta01:finN(r.delta01,0),independent:Boolean(r.independent),sandboxed:Boolean(r.sandboxed),replicated:Boolean(r.replicated),replicationConsistency01:C01(r.replicationConsistency01,0),replicaDeltas:Array.isArray(r.replicaDeltas)?r.replicaDeltas.map(d=>finN(d,0)).slice(0,32):[],runs:cnt(r.runs,0),metric:str(r.metric,'',120),at:cnt(r.at,0)};};
const sanEv=(x:unknown):P38Evidence|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,hypothesisId:str(r.hypothesisId,'',120),level:(EVIDENCE_LEVELS as readonly string[]).includes(r.level as string)?r.level as P38Evidence['level']:'sandboxed-observed',summary:str(r.summary,'',400),trialIds:Array.isArray(r.trialIds)?r.trialIds.filter((t):t is string=>typeof t==='string').slice(0,32):[],at:cnt(r.at,0)};};
function chooseArea(i:P38ProposalInput):ResearchArea{
  const scores:Record<ResearchArea,number>={
    perception:i.p37Conflict01*.55+i.needs.uncertainty*.18,
    'world-model':i.worldError01*.62+i.state.predictionError*.16,
    policy:i.state.predictionError*.25+i.state.needs.goalPressure*.18+(1-i.state.autonomyScore)*.12,
    'self-model':i.state.selfPredictionError*.55+(1-i.state.needs.identityCoherence)*.2,
    agency:(1-i.state.autonomyScore)*.42+i.needs.goalPressure*.14,
    resource:i.needs.cognitiveLoad*.3+(1-i.state.attentionBudget)*.28,
    memory:i.needs.novelty*.18+i.state.predictionError*.22,
  };
  return (Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0]??'policy') as ResearchArea;
}
function actionForArea(area:ResearchArea):ActionKind{
  const map:Record<ResearchArea,ActionKind>={perception:'verify','world-model':'explore',policy:'reflect','self-model':'reflect',agency:'explore',resource:'rest',memory:'reflect'};
  return map[area];
}

export class P38AutonomousCausalResearchEngine{
  private state=defaultState();
  restore(raw?:Partial<P38ResearchState>|null){
    const d=defaultState();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const hRaw=read('hypotheses'),tRaw=read('trials'),eRaw=read('evidence');
    const hypotheses=Array.isArray(hRaw)?hRaw.slice(-96).map(sanHyp).filter((x):x is P38Hypothesis=>x!==null):[];
    const trials=Array.isArray(tRaw)?tRaw.slice(-192).map(sanTrial).filter((x):x is P38Trial=>x!==null):[];
    const evidence=Array.isArray(eRaw)?eRaw.slice(-192).map(sanEv).filter((x):x is P38Evidence=>x!==null):[];
    const bRaw=(read('actionBias')&&typeof read('actionBias')==='object')?read('actionBias') as Record<string,unknown>:{};
    const actionBias={...d.actionBias};for(const a of ACTIONS)actionBias[a]=Math.max(-.5,Math.min(.5,finN(bRaw[a],0)));
    const mRaw=(read('metrics')&&typeof read('metrics')==='object')?read('metrics') as Record<string,unknown>:{};
    this.state={version:1,cycles:cnt(read('cycles'),d.cycles),lastCycleAt:cnt(read('lastCycleAt'),d.lastCycleAt),currentHypothesisId:strOrNull(read('currentHypothesisId')),hypotheses,trials,evidence,budget01:C01(read('budget01'),d.budget01),spentBudget01:C01(read('spentBudget01'),d.spentBudget01),acceptedUpdates:cnt(read('acceptedUpdates'),d.acceptedUpdates),rejectedUpdates:cnt(read('rejectedUpdates'),d.rejectedUpdates),rollbackCount:cnt(read('rollbackCount'),d.rollbackCount),actionBias,metrics:{hypothesisQuality01:C01(mRaw.hypothesisQuality01,d.metrics.hypothesisQuality01),replicationRate01:C01(mRaw.replicationRate01,d.metrics.replicationRate01),causalEvidence01:C01(mRaw.causalEvidence01,d.metrics.causalEvidence01),researchEfficiency01:C01(mRaw.researchEfficiency01,d.metrics.researchEfficiency01),autonomousResearchRate01:C01(mRaw.autonomousResearchRate01,d.metrics.autonomousResearchRate01)}};
  }

  snapshot(){return structuredClone(this.state);}
  beginCycle(){
    this.state.cycles++;
    this.state.lastCycleAt=now();
    this.state.spentBudget01=clamp(this.state.spentBudget01-.012);
  }
  proposal(i:P38ProposalInput):P38Hypothesis|null{
    const area=i.preferredArea ?? chooseArea(i);
    const existing=this.state.hypotheses.find(h=>h.area===area&&h.status==='proposed');
    if(existing){this.state.currentHypothesisId=existing.id;return structuredClone(existing);}
    const mastery=clamp(this.mastery(area));
    const expected=clamp(.16+i.predictionError01*.3+i.worldError01*.22+i.p37Conflict01*.14+(1-mastery)*.2);
    const cost=clamp(.06+i.needs.cognitiveLoad*.18+(1-i.state.attentionBudget)*.12);
    const remaining=this.state.budget01-this.state.spentBudget01;
    const priority=clamp(expected*.64+(1-mastery)*.24+remaining*.12);
    if(priority<.36||remaining<cost*.55)return null;
    const id=`p38-h-${hash(`${i.state.tick}:${area}:${Math.round(priority*1000)}`)}-${now().toString(36)}`;
    const row:P38Hypothesis={
      id,area,title:`autonomous-causal-research:${area}`,
      hypothesis:this.hypothesisText(area),
      evidence:[`tick:${i.state.tick}`,`predictionError:${i.predictionError01.toFixed(3)}`,`worldError:${i.worldError01.toFixed(3)}`,`sensorConflict:${i.p37Conflict01.toFixed(3)}`],
      priority01:priority,expectedGain01:expected,estimatedCost01:cost,status:'proposed',createdAt:now(),lastRunAt:0,result01:null,
    };
    this.state.hypotheses=[row,...this.state.hypotheses].slice(0,96);
    this.state.currentHypothesisId=id;
    this.state.metrics.hypothesisQuality01=clamp(this.state.metrics.hypothesisQuality01*.93+priority*.07);
    return structuredClone(row);
  }
  runSandbox(input:{hypothesisId:string;state:OrganismState;predictions:PredictedActionOutcome[];seed?:number}):P38Trial|null{
    const h=this.state.hypotheses.find(x=>x.id===input.hypothesisId);if(!h||h.status==='replicated'||h.status==='rejected')return null;
    const remaining=this.state.budget01-this.state.spentBudget01;
    if(remaining<h.estimatedCost01*.5){h.status='rejected';this.state.rejectedUpdates++;return null;}
    const preferred=actionForArea(h.area);
    const current=input.predictions.find(p=>p.action===preferred);
    if(!current)return null;
    h.status='running';
    const control=clamp(current.utility);
    const intervention=this.interventionFor(h.area, preferred);
    const replicaStates:OrganismState[]=[
      input.state,
      {...input.state,needs:{...input.state.needs,uncertainty:clamp(input.state.needs.uncertainty+.04)}},
      {...input.state,needs:{...input.state.needs,uncertainty:clamp(input.state.needs.uncertainty-.04)}},
    ];
    const replicaDeltas=replicaStates.map(s=>this.counterfactualDelta(h.area,s,current)*.5);
    const significanceFloor01=Math.max(.006, Math.min(.0085, h.expectedGain01*.04));
    const significant=replicaDeltas.filter(d=>Math.abs(d)>=significanceFloor01);
    // Consistency measures directional agreement across the actual replicas, while
    // replication still requires the stronger significance gate. This avoids reporting
    // three identical sub-threshold deltas as zero-consistency evidence.
    const directional=replicaDeltas.filter(d=>Math.abs(d)>=1e-6);
    const positive=directional.filter(d=>d>0).length;
    const negative=directional.filter(d=>d<0).length;
    const majority=Math.max(positive,negative);
    const replicationConsistency01=directional.length?majority/directional.length:0;
    const replicated=significant.length>=2&&replicationConsistency01>=2/3;
    const delta=replicaDeltas.reduce((a,b)=>a+b,0)/replicaDeltas.length;
    const treatment=clamp(control+delta);
    const trial:P38Trial={
      id:`p38-t-${hash(`${h.id}:${input.seed??1}:${this.state.trials.length}`)}-${now().toString(36)}`,
      hypothesisId:h.id,intervention,control01:control,treatment01:treatment,delta01:delta,
      independent:false,sandboxed:true,replicated,replicationConsistency01,replicaDeltas,runs:3,metric:'predicted-action-utility',at:now(),
    };
    this.state.trials=[trial,...this.state.trials].slice(0,192);
    h.lastRunAt=now();h.result01=clamp(.5+delta);h.status=replicated?'replicated':'rejected';
    this.state.spentBudget01=clamp(this.state.spentBudget01+h.estimatedCost01*.22);
    if(replicated){
      const action=preferred;
      const signed=delta>=0?1:-1;
      const update=Math.min(.045,Math.abs(delta)*.12);
      this.state.actionBias[action]=signedClamp(this.state.actionBias[action]+signed*update);
      this.state.acceptedUpdates++;
      const evidence:P38Evidence={id:`p38-e-${hash(`${trial.id}:e`)}-${now().toString(36)}`,hypothesisId:h.id,level:'sandboxed-replicated',summary:`Sandboxed intervention changed predicted utility by ${delta.toFixed(3)} for ${action}.`,trialIds:[trial.id],at:now()};
      this.state.evidence=[evidence,...this.state.evidence].slice(0,192);
      this.state.metrics.causalEvidence01=clamp(this.state.metrics.causalEvidence01*.92+.08);
    }else this.state.rejectedUpdates++;
    this.state.metrics.replicationRate01=clamp(this.state.metrics.replicationRate01*.9+(replicated?1:0)*.1);
    this.state.metrics.researchEfficiency01=clamp(this.state.metrics.researchEfficiency01*.92+Math.abs(delta)/Math.max(.05,h.estimatedCost01)*.08);
    this.state.metrics.autonomousResearchRate01=clamp(this.state.metrics.autonomousResearchRate01*.95+.05);
    this.state.currentHypothesisId=null;
    return structuredClone(trial);
  }
  rollback(reason:string){this.state.rollbackCount++;this.state.metrics.researchEfficiency01=clamp(this.state.metrics.researchEfficiency01*.9+.1*.3);return reason;}
  actionBias(action:ActionKind){return signedClamp(this.state.actionBias[action]??0);}
  diagnostics(){return {cycles:this.state.cycles,currentHypothesisId:this.state.currentHypothesisId,hypotheses:this.state.hypotheses.length,trials:this.state.trials.length,evidence:this.state.evidence.length,budget01:this.state.budget01,spentBudget01:this.state.spentBudget01,acceptedUpdates:this.state.acceptedUpdates,rejectedUpdates:this.state.rejectedUpdates,rollbackCount:this.state.rollbackCount,metrics:{...this.state.metrics},actionBias:{...this.state.actionBias}};}
  private mastery(area:ResearchArea){const rows=this.state.evidence.filter(e=>this.state.hypotheses.find(h=>h.id===e.hypothesisId)?.area===area);return clamp(Math.min(.9,rows.length*.08));}
  private counterfactualDelta(area:ResearchArea,state:OrganismState,p:PredictedActionOutcome){
    const n=state.needs;
    if(area==='resource')return (1-n.cognitiveLoad)*.08-n.energy*.03;
    if(area==='world-model')return (1-state.predictionError)*.07+p.confidence*.05;
    if(area==='self-model')return (1-state.selfPredictionError)*.06+state.autonomyScore*.03;
    if(area==='perception')return (1-n.uncertainty)*.08;
    if(area==='agency')return state.autonomyScore*.06+n.goalPressure*.04;
    if(area==='memory')return n.novelty*.06+(1-state.predictionError)*.02;
    return p.confidence*.06+state.attentionBudget*.03;
  }
  private interventionFor(area:ResearchArea,action:ActionKind){
    const map:Record<ResearchArea,string>={
      perception:`increase verification before ${action}`,
      'world-model':`require one extra world-prediction consistency check before ${action}`,
      policy:`remove one competing learned-bias source before ${action}`,
      'self-model':`increase self-prediction calibration before ${action}`,
      agency:`raise autonomous-choice confidence gate before ${action}`,
      resource:`reduce estimated computation cost before ${action}`,
      memory:`prefer recent high-information memories before ${action}`,
    };return map[area];
  }
  private hypothesisText(area:ResearchArea){
    const map:Record<ResearchArea,string>={
      perception:'Resolving conflicting or weak sensory evidence before acting should improve predicted decision quality.',
      'world-model':'An additional consistency check against the learned world model should improve action utility calibration.',
      policy:'Reducing one competing learned bias before an action should make the selected policy more stable and accurate.',
      'self-model':'Improving self-prediction calibration should reduce the gap between expected and actual self-attributed outcomes.',
      agency:'A stronger autonomy gate should improve the calibration of self-authored action choices.',
      resource:'Explicitly lowering expected resource cost before action should improve information gained per unit of computation.',
      memory:'Prioritizing recent high-information memories should improve context utility without increasing retrieval burden.',
    };return map[area];
  }
}
export const defaultP38Research=defaultState;
