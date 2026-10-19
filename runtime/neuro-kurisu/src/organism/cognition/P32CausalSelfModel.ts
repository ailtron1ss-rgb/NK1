import { createHash } from 'node:crypto';
import type { ActionKind, OrganismState } from '../core/types.ts';

type CauseKind = 'self-action'|'external-event'|'body-state'|'belief'|'outcome';
type EvidenceKind = 'observational'|'controlled'|'counterfactual'|'device';
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const now=()=>Date.now();
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(k,x)=>typeof x==='undefined'?null:x)).digest('hex').slice(0,24);

export interface CausalNode { id:string; kind:CauseKind; label:string; confidence01:number; observations:number; at:number; }
export interface CausalEdge { id:string; from:string; to:string; effectMean:number; strength01:number; confidence01:number; evidenceCount:number; evidenceKind:EvidenceKind; lastAt:number; }
export interface SelfActionPrediction { action:ActionKind; expectedSuccess01:number; expectedAgency01:number; expectedSurprise01:number; confidence01:number; at:number; }
export interface SelfCausalRevision { id:string; target:string; before01:number; after01:number; reason:string; evidenceIds:string[]; at:number; }
export interface CausalInterventionRecord { id:string; variable:string; control01:number; treatment01:number; delta01:number; independent:boolean; repetitions:number; causalStrength01:number; evidenceLevel:'recorded'|'controlled-repeated'|'insufficient'; at:number; }
export interface CausalSelfModelState {
  version:1;
  selfStateHash:string;
  nodes:CausalNode[];
  edges:CausalEdge[];
  pendingPrediction:SelfActionPrediction|null;
  predictions:{count:number;meanAbsError01:number;calibration01:number};
  interventions:CausalInterventionRecord[];
  revisions:SelfCausalRevision[];
  metrics:{selfCausalCoherence01:number;agencyCalibration01:number;selfPredictionAccuracy01:number;causalSpecificity01:number;revisionReadiness01:number};
  lastRevisionAt:number;
}

export interface CausalSelfPreviewInput {
  state:OrganismState;
  action:ActionKind;
  autonomy01:number;
  p31SelfAccess01:number;
  p31Agency01:number;
  uncertainty01:number;
}

export interface CausalSelfOutcomeInput {
  action:ActionKind;
  success01:number;
  reward01:number;
  surprise01:number;
  externallyRequested:boolean;
  observationId:string;
  state:OrganismState;
  /** P290 provenance gate: controls how strongly outcome evidence mutates the self-causal model. */
  learningScale01?:number;
  identityUpdateScale01?:number;
  evidenceWeight01?:number;
}

const defaultState=():CausalSelfModelState=>({
  version:1,selfStateHash:'',nodes:[],edges:[],pendingPrediction:null,
  predictions:{count:0,meanAbsError01:0.5,calibration01:0.5},
  interventions:[],revisions:[],
  metrics:{selfCausalCoherence01:0.2,agencyCalibration01:0.5,selfPredictionAccuracy01:0.5,causalSpecificity01:0.3,revisionReadiness01:0.2},
  lastRevisionAt:0,
});

export class P32CausalSelfModelEngine {
  private state=defaultState();
  restore(v?:CausalSelfModelState):void {
    const d=defaultState();
    this.state={...d,...(v||{}),
      nodes:Array.isArray(v?.nodes)?v!.nodes.slice(-96):[],
      edges:Array.isArray(v?.edges)?v!.edges.slice(-192):[],
      interventions:Array.isArray(v?.interventions)?v!.interventions.slice(-96):[],
      revisions:Array.isArray(v?.revisions)?v!.revisions.slice(-96):[],
      predictions:{...d.predictions,...(v?.predictions||{})},
      metrics:{...d.metrics,...(v?.metrics||{})},
    };
  }
  snapshot():CausalSelfModelState{return structuredClone(this.state);}
  summary(){return{version:1,nodes:this.state.nodes.length,edges:this.state.edges.length,revisions:this.state.revisions.length,metrics:{...this.state.metrics},predictions:{...this.state.predictions}};}

  private upsertNode(kind:CauseKind,label:string,confidence01:number):CausalNode {
    const id=`${kind}:${hash(label)}`;
    const existing=this.state.nodes.find(x=>x.id===id);
    if(existing){
      existing.confidence01=clamp(existing.confidence01*.85+clamp(confidence01)*.15);
      existing.observations+=1; existing.at=now();
      return existing;
    }
    const node:CausalNode={id,kind,label,confidence01:clamp(confidence01),observations:1,at:now()};
    this.state.nodes=[...this.state.nodes,node].slice(-96); return node;
  }

  private connect(from:CausalNode,to:CausalNode,effect:number,evidenceKind:EvidenceKind):CausalEdge {
    const id=`edge:${hash({from:from.id,to:to.id})}`;
    const existing=this.state.edges.find(x=>x.id===id);
    if(existing){
      existing.effectMean=existing.effectMean*.82+effect*.18;
      existing.strength01=clamp(existing.strength01*.84+Math.abs(effect)*.16);
      existing.confidence01=clamp(existing.confidence01*.82+.18*(evidenceKind==='controlled'?1:.55));
      existing.evidenceCount+=1; existing.evidenceKind=evidenceKind; existing.lastAt=now();
      return existing;
    }
    const edge:CausalEdge={id,from:from.id,to:to.id,effectMean:effect,strength01:clamp(Math.abs(effect)),confidence01:evidenceKind==='controlled'?0.7:0.25,evidenceCount:1,evidenceKind,lastAt:now()};
    this.state.edges=[...this.state.edges,edge].slice(-192); return edge;
  }

  predict(input:CausalSelfPreviewInput):SelfActionPrediction {
    const actionNode=this.upsertNode('self-action',input.action,input.autonomy01);
    const expectedSuccess=clamp(.45 + input.p31SelfAccess01*.12 + input.p31Agency01*.16 - input.uncertainty01*.20 + (actionNode.confidence01-.5)*.18);
    const expectedAgency=clamp(input.p31Agency01*.65 + input.autonomy01*.25 + .05);
    const expectedSurprise=clamp(input.uncertainty01*.7 + Math.abs(input.state.predictionError)*.3);
    const confidence=clamp(.25 + input.p31SelfAccess01*.25 + (1-input.uncertainty01)*.25 + actionNode.confidence01*.25);
    this.state.pendingPrediction={action:input.action,expectedSuccess01:expectedSuccess,expectedAgency01:expectedAgency,expectedSurprise01:expectedSurprise,confidence01:confidence,at:now()};
    this.recomputeHash(input.state);
    return structuredClone(this.state.pendingPrediction);
  }

  observeOutcome(input:CausalSelfOutcomeInput):CausalSelfModelState {
    const pred=this.state.pendingPrediction;
    const learningScale=clamp(input.learningScale01??1);
    const identityScale=clamp(input.identityUpdateScale01??learningScale);
    const evidenceWeight=clamp(input.evidenceWeight01??learningScale);
    const actionNode=this.upsertNode('self-action',input.action,input.externallyRequested?.34:.76);
    const outcomeNode=this.upsertNode('outcome',`success:${Math.round(clamp(input.success01)*10)/10}`,clamp(1-input.surprise01));
    const bodyNode=this.upsertNode('body-state',`energy:${Math.round(input.state.needs.energy*10)/10}|unc:${Math.round(input.state.needs.uncertainty*10)/10}`,clamp(1-input.state.needs.uncertainty));
    const sign=(input.success01-.5)*2*evidenceWeight;
    const evidence:EvidenceKind=input.externallyRequested?'observational':'counterfactual';
    this.connect(actionNode,outcomeNode,sign,evidence);
    this.connect(actionNode,bodyNode,(input.state.needs.energy-.5)*2*evidenceWeight,evidence);
    if(pred && pred.action===input.action){
      const successErr=Math.abs(pred.expectedSuccess01-clamp(input.success01));
      const surpriseErr=Math.abs(pred.expectedSurprise01-clamp(input.surprise01));
      const agencyObserved=input.externallyRequested?.32:clamp(.55+successErr*-0.2+sign*.12);
      const agencyErr=Math.abs(pred.expectedAgency01-agencyObserved);
      const totalErr=clamp(successErr*.45+surpriseErr*.25+agencyErr*.30);
      const n=this.state.predictions.count+1;
      const predictionRate=.06*learningScale;
      const agencyRate=.08*learningScale;
      const revisionRate=.1*learningScale;
      this.state.predictions={count:n,meanAbsError01:clamp(this.state.predictions.meanAbsError01*(1-predictionRate)+totalErr*predictionRate),calibration01:clamp(this.state.predictions.calibration01*(1-predictionRate)+(1-totalErr)*predictionRate)};
      this.state.metrics.selfPredictionAccuracy01=clamp(1-this.state.predictions.meanAbsError01);
      this.state.metrics.agencyCalibration01=clamp(this.state.metrics.agencyCalibration01*(1-agencyRate)+(1-agencyErr)*agencyRate);
      this.state.metrics.revisionReadiness01=clamp(this.state.metrics.revisionReadiness01*(1-revisionRate)+totalErr*revisionRate);
      if(totalErr>.55 && identityScale>=.45){
        const previous=this.state.metrics.selfCausalCoherence01;
        const after=clamp(previous*.82+.18*(1-totalErr));
        this.state.revisions=[...this.state.revisions,{id:hash({input,at:now()}),target:`action:${input.action}`,before01:previous,after01:after,reason:'prediction-outcome mismatch exceeded revision threshold',evidenceIds:[input.observationId],at:now()}].slice(-96);
        this.state.lastRevisionAt=now();
        this.state.metrics.selfCausalCoherence01=after;
      } else {
        const causalRate=.06*identityScale;
        this.state.metrics.selfCausalCoherence01=clamp(this.state.metrics.selfCausalCoherence01*(1-causalRate)+(1-totalErr)*causalRate);
      }
    }
    this.state.metrics.causalSpecificity01=clamp(this.state.edges.reduce((s,e)=>s+e.strength01*e.confidence01,0)/Math.max(1,this.state.edges.length));
    this.state.pendingPrediction=null;
    this.recomputeHash(input.state);
    return this.snapshot();
  }

  recordControlledIntervention(input:{variable:string;control01:number;treatment01:number;independent:boolean;repetitions:number}):CausalInterventionRecord {
    const repetitions=Math.max(1,Math.floor(input.repetitions));
    const delta=clamp(input.treatment01)-clamp(input.control01);
    const causalStrength=clamp(Math.abs(delta)*Math.min(1,repetitions/3)*(input.independent?1:.35));
    const evidenceLevel: CausalInterventionRecord['evidenceLevel']=input.independent&&repetitions>=3?'controlled-repeated':'insufficient';
    const row:CausalInterventionRecord={id:hash({input,at:now()}),variable:String(input.variable).slice(0,120),control01:clamp(input.control01),treatment01:clamp(input.treatment01),delta01:delta,independent:Boolean(input.independent),repetitions,causalStrength01:causalStrength,evidenceLevel,at:now()};
    this.state.interventions=[...this.state.interventions,row].slice(-96);
    if(input.independent&&repetitions>=3){
      const from=this.upsertNode('belief',`intervention:${row.variable}`,causalStrength);
      const to=this.upsertNode('outcome',`intervention-outcome:${Math.round(input.treatment01*10)/10}`,causalStrength);
      this.connect(from,to,delta,'controlled');
    }
    this.state.metrics.causalSpecificity01=clamp(this.state.metrics.causalSpecificity01*.75+causalStrength*.25);
    this.recomputeHash();
    return structuredClone(row);
  }

  lesionSelfCausalLinks(persist=false):{before:number;after:number;delta:number;edgesAffected:number;persisted:boolean} {
    const backup=structuredClone(this.state);
    const before=clamp(this.state.metrics.selfCausalCoherence01*.5+this.state.metrics.agencyCalibration01*.25+this.state.metrics.selfPredictionAccuracy01*.25);
    const affected=this.state.edges.filter(e=>this.state.nodes.find(n=>n.id===e.from)?.kind==='self-action').length;
    this.state.metrics.selfCausalCoherence01*=.45;
    this.state.metrics.agencyCalibration01*=.72;
    const after=clamp(this.state.metrics.selfCausalCoherence01*.5+this.state.metrics.agencyCalibration01*.25+this.state.metrics.selfPredictionAccuracy01*.25);
    const result={before,after,delta:after-before,edgesAffected:affected,persisted:Boolean(persist)};
    if(!persist) this.state=backup;
    else this.recomputeHash();
    return result;
  }

  diagnostics(){return {nodes:this.state.nodes.length,edges:this.state.edges.length,interventions:this.state.interventions.length,revisions:this.state.revisions.length,pendingPrediction:Boolean(this.state.pendingPrediction),metrics:{...this.state.metrics},predictions:{...this.state.predictions},lastRevisionAt:this.state.lastRevisionAt};}
  private recomputeHash(state?:OrganismState){
    const {selfStateHash:_, ...material}=this.state;
    this.state.selfStateHash=hash({tick:state?.tick??0,model:material});
  }
}
export const defaultP32CausalSelfModel=defaultState;
