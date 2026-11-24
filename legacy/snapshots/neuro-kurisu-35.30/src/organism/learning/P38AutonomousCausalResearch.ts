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
    const d=defaultState();const r=raw??{};
    this.state={...d,...r,
      hypotheses:Array.isArray(r.hypotheses)?r.hypotheses.slice(-96):[],
      trials:Array.isArray(r.trials)?r.trials.slice(-192):[],
      evidence:Array.isArray(r.evidence)?r.evidence.slice(-192):[],
      actionBias:{...d.actionBias,...(r.actionBias??{})},
      metrics:{...d.metrics,...(r.metrics??{})},
    };
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
    const positive=significant.filter(d=>d>0).length;
    const negative=significant.filter(d=>d<0).length;
    const majority=Math.max(positive,negative);
    const replicationConsistency01=majority/replicaDeltas.length;
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
