/**
 * BIG PASS 166 — World-model ensemble controller.
 *
 * This is intentionally a meta-model over existing world predictors. It does not
 * create a second world database; it tracks bounded online reliability for the
 * existing predictors and performs confidence/error-weighted arbitration.
 */
export type WorldModelMember = 'worldModel2'|'p27'|'residual'|'contextual';
export interface WorldModelMemberStats {
  samples:number;
  meanError01:number;
  variance01:number;
  meanConfidence01:number;
  reliability01:number;
  lastError01:number;
  lastAt:number;
}
export interface WorldEnsemblePredictionTicket {
  predictionId:string;
  action:string;
  createdAt:number;
  candidates:EnsembleCandidate[];
}

export interface WorldEnsembleState {
  version:3;
  predictions:number;
  outcomes:number;
  disagreements:number;
  meanDisagreement01:number;
  selected:Record<WorldModelMember,number>;
  members:Record<WorldModelMember,WorldModelMemberStats>;
  pendingPredictions:Record<string,WorldEnsemblePredictionTicket>;
  predictionSequence:number;
  lastDecision?: { action:string; selected:WorldModelMember; agreement01:number; uncertainty01:number; at:number };
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const memberDefault=():WorldModelMemberStats=>({samples:0,meanError01:.5,variance01:.25,meanConfidence01:.25,reliability01:.25,lastError01:.5,lastAt:0});
const defaults=():WorldEnsembleState=>({version:3,predictions:0,outcomes:0,disagreements:0,meanDisagreement01:.5,selected:{worldModel2:0,p27:0,residual:0,contextual:0},members:{worldModel2:memberDefault(),p27:memberDefault(),residual:memberDefault(),contextual:memberDefault()},pendingPredictions:{},predictionSequence:0});

export interface EnsembleCandidate { member:WorldModelMember; prediction01:number; confidence01:number; }

export class WorldModelEnsembleController {
  private pruneCadenceCounter=0;
  private state=defaults();
  restore(raw?:Partial<WorldEnsembleState>|null){
    const d=defaults();
    const rawPending=Object.fromEntries(Object.entries(raw?.pendingPredictions??{}).filter(([,t])=>t && Array.isArray((t as any).candidates)).sort((a,b)=>Number((a[1] as any).createdAt??0)-Number((b[1] as any).createdAt??0)).slice(-256));
    this.state={...d,...(raw??{}),version:3,selected:{...d.selected,...(raw?.selected??{})},members:{...d.members,...(raw?.members??{})},pendingPredictions:rawPending,predictionSequence:Number(raw?.predictionSequence??0)};
    for(const m of ['worldModel2','p27','residual','contextual'] as WorldModelMember[]) this.state.members[m]={...memberDefault(),...(raw?.members?.[m]??{})};
  }
  snapshot(){return structuredClone(this.state);}
  private weight(c:EnsembleCandidate){
    const s=this.state.members[c.member];
    const sampleMaturity=Math.min(1,s.samples/24);
    return Math.max(.03,.10+.45*clamp(c.confidence01)+.30*clamp(s.reliability01)+.15*sampleMaturity);
  }
  private pruneTickets(now=Date.now(), maxAgeMs=120000, maxEntries=256){
    this.pruneCadenceCounter++;
    if((this.pruneCadenceCounter & 7)!==0)return;
    const all=Object.entries(this.state.pendingPredictions);
    if(all.length<=maxEntries){let stale=false;for(const [,t] of all){if(now-(t.createdAt??now)>maxAgeMs){stale=true;break;}}if(!stale)return;}
    const entries=all.filter(([,t])=>now-(t.createdAt??now)<=maxAgeMs);
    if(entries.length<=maxEntries){this.state.pendingPredictions=Object.fromEntries(entries);return;}
    entries.sort((a,b)=>a[1].createdAt-b[1].createdAt);
    this.state.pendingPredictions=Object.fromEntries(entries.slice(-maxEntries));
  }
  arbitrate(action:string,candidates:EnsembleCandidate[],fallback01=.5):{predictionId:string;prediction01:number;confidence01:number;agreement01:number;uncertainty01:number;selected:WorldModelMember;weights:Record<WorldModelMember,number>}{
    const usable=candidates.filter(c=>Number.isFinite(c.prediction01));
    this.pruneTickets();
    if(!usable.length){const predictionId=`ensemble-${++this.state.predictionSequence}`; this.state.pendingPredictions[predictionId]={predictionId,action,createdAt:Date.now(),candidates:[]}; return {predictionId,prediction01:clamp(fallback01),confidence01:.1,agreement01:0,uncertainty01:1,selected:'worldModel2',weights:{worldModel2:.25,p27:.25,residual:.25,contextual:.25}};}
    const weights:Record<WorldModelMember,number>={worldModel2:0,p27:0,residual:0,contextual:0};
    let sumW=0;
    for(const c of usable){const w=this.weight(c);weights[c.member]+=w;sumW+=w;}
    const prediction=usable.reduce((s,c)=>s+c.prediction01*this.weight(c),0)/Math.max(.001,sumW);
    const spread=usable.reduce((s,c)=>s+Math.abs(c.prediction01-prediction)*this.weight(c),0)/Math.max(.001,sumW);
    const agreement=clamp(1-spread*2.2);
    const confidence=clamp(usable.reduce((s,c)=>s+c.confidence01*this.weight(c),0)/Math.max(.001,sumW)*(.45+.55*agreement));
    const uncertainty=clamp((1-confidence)*.65+(1-agreement)*.35);
    const selected=usable.slice().sort((a,b)=>this.weight(b)-this.weight(a))[0].member;
    const predictionId=`ensemble-${++this.state.predictionSequence}`;
    this.state.pendingPredictions[predictionId]={predictionId,action,createdAt:Date.now(),candidates:structuredClone(usable)};
    this.state.predictions++;
    if(usable.length>1){this.state.disagreements++;this.state.meanDisagreement01=clamp(this.state.meanDisagreement01*.94+spread*.06);}
    this.state.selected[selected]=(this.state.selected[selected]??0)+1;
    this.state.lastDecision={action,selected,agreement01:agreement,uncertainty01:uncertainty,at:Date.now()};
    return {predictionId,prediction01:clamp(prediction),confidence01:confidence,agreement01:agreement,uncertainty01:uncertainty,selected,weights};
  }
  observeOutcomeForAction(action:string,actual01:number){
    this.pruneTickets();
    const ticket=Object.values(this.state.pendingPredictions).filter(t=>t.action===action).sort((a,b)=>a.createdAt-b.createdAt)[0];
    if(!ticket) return {resolved:false,predictionId:null,candidates:[] as EnsembleCandidate[]};
    this.observeOutcome(ticket.predictionId,actual01);
    return {resolved:true,predictionId:ticket.predictionId,candidates:structuredClone(ticket.candidates)};
  }
  observeOutcome(candidatesOrPredictionId:EnsembleCandidate[]|string,actual01:number){
    this.pruneTickets();
    const ticketId=typeof candidatesOrPredictionId==='string'?candidatesOrPredictionId:null;
    const ticket=ticketId?this.state.pendingPredictions[ticketId]:undefined;
    const candidates=ticket?.candidates ?? (Array.isArray(candidatesOrPredictionId)?candidatesOrPredictionId:[]);
    if(ticketId) delete this.state.pendingPredictions[ticketId];
    this.state.outcomes++;
    for(const c of candidates){
      const s=this.state.members[c.member];
      const error=clamp(Math.abs(actual01-c.prediction01));
      s.samples+=1;
      const lr=Math.min(.25,2/s.samples);
      s.meanError01=clamp(s.meanError01*(1-lr)+error*lr);
      s.variance01=clamp(s.variance01*.92+Math.abs(error-s.meanError01)*.08);
      s.meanConfidence01=clamp(s.meanConfidence01*.9+c.confidence01*.1);
      s.lastError01=error; s.lastAt=Date.now();
      s.reliability01=clamp((1-s.meanError01)*.62+(1-s.variance01)*.18+s.meanConfidence01*.20);
    }
  }
  member(member:WorldModelMember){return structuredClone(this.state.members[member]);}
  recordExternalOutcome(member:WorldModelMember, prediction01:number, confidence01:number, actual01:number){
    const s=this.state.members[member];
    const error=clamp(Math.abs(clamp(actual01)-clamp(prediction01)));
    s.samples+=1; const lr=Math.min(.25,2/s.samples);
    s.meanError01=clamp(s.meanError01*(1-lr)+error*lr);
    s.variance01=clamp(s.variance01*.92+Math.abs(error-s.meanError01)*.08);
    s.meanConfidence01=clamp(s.meanConfidence01*.9+clamp(confidence01)*.1);
    s.lastError01=error; s.lastAt=Date.now();
    s.reliability01=clamp((1-s.meanError01)*.62+(1-s.variance01)*.18+s.meanConfidence01*.20);
    return structuredClone(s);
  }
  pendingPredictionCount(){ this.pruneTickets(); return Object.keys(this.state.pendingPredictions).length; }
  summary(){
    const d=this.state; this.pruneTickets();
    return {predictions:d.predictions,outcomes:d.outcomes,disagreements:d.disagreements,meanDisagreement01:d.meanDisagreement01,selected:{...d.selected},reliability:Object.fromEntries(Object.entries(d.members).map(([k,v])=>[k,v.reliability01])),pendingPredictions:Object.keys(d.pendingPredictions).length};
  }
}
export const defaultWorldEnsemble=defaults;
