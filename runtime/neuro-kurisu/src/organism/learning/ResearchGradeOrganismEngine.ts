import { createHash } from 'node:crypto';
import type { ActionKind, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const now=()=>Date.now();
const mean=(xs:number[], fallback=.5)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;

export type EvidenceKind='tool-postcondition'|'world-postcondition'|'device-observation'|'sensor-observation'|'internal-transition'|'simulation'|'manual';
export type ResearchComponent='memory'|'world-model'|'self-model'|'prediction'|'social'|'agency'|'workspace'|'embodiment'|'active-perception'|'counterfactual';

export interface PostconditionEvidence { id:string; decisionId:string; action:ActionKind; expected:string; observed:string; matched:boolean; evidenceKind:EvidenceKind; confidence01:number; independent01:number; at:number; }
export interface LifeDecision { id:string; cycle:number; action:ActionKind; predicted01:number; contextKey:string; at:number; }
export interface LifeOutcome { decisionId:string; actual01:number; reward01:number; predictionError01:number; verified01:number; causal01:number; external01:number; at:number; }
export interface Intention { id:string; text:string; goalId:string|null; priority01:number; status:'open'|'paused'|'completed'|'abandoned'; createdAt:number; updatedAt:number; resumeCount:number; }
export interface LongitudinalWindow { id:string; startedAt:number; endedAt:number|null; cycles:number; decisions:number; verifiedOutcomes:number; closedLoop01:number; persistence01:number; externalGrounding01:number; recovery01:number; status:'active'|'closed'; }
export interface ReplicationRun { id:string; component:ResearchComponent; seed:number; cycles:number; baseline01:number; treatment01:number; delta01:number; replicated:boolean; at:number; }
export interface FaultRecoveryEvent { id:string; kind:'restart'|'missing-state'|'corrupt-state'|'interrupted-action'|'sensor-failure'|'resource-pressure'; detected:boolean; recovered:boolean; continuity01:number; at:number; }
export interface ProductionSample { at:number; uptimeMs:number; memoryRssMB:number; heapUsedMB:number; eventLoopLagMs:number; cpuLoad01:number; thermal01:number; battery01:number; }
export interface ResearchGradeState {
  version:2; cycles:number; nextId:number; lastAt:number; startedAt:number;
  decisions:LifeDecision[]; outcomes:LifeOutcome[]; evidence:PostconditionEvidence[]; intentions:Intention[];
  longitudinal:LongitudinalWindow[]; replications:ReplicationRun[]; recovery:FaultRecoveryEvent[]; production:ProductionSample[];
  metrics:{closedLoop01:number; externalGrounding01:number; activePerception01:number; longHorizon01:number; causal01:number; autonomy01:number; continuity01:number; recovery01:number; replication01:number; production01:number; overall01:number};
  architectureFrozen:boolean; architectureDigest:string; lastError:string;
}

export interface ResearchGradeContext {
  state:OrganismState; action:ActionKind; predicted01:number; contextKey?:string; verified01?:number; causal01?:number;
  externalEvidence01?:number; activePerception01?:number; longHorizon01?:number; autonomy01?:number; continuity01?:number; at?:number;
}

export const defaultResearchGradeOrganism=():ResearchGradeState=>({
  version:2,cycles:0,nextId:1,lastAt:0,startedAt:now(),decisions:[],outcomes:[],evidence:[],intentions:[],longitudinal:[],replications:[],recovery:[],production:[],
  metrics:{closedLoop01:.15,externalGrounding01:.05,activePerception01:.2,longHorizon01:.3,causal01:.1,autonomy01:.2,continuity01:.4,recovery01:.7,replication01:.1,production01:.5,overall01:.25},
  architectureFrozen:false,architectureDigest:'',lastError:''
});

export class ResearchGradeOrganismEngine {
  private state=defaultResearchGradeOrganism();
  private activeWindowId:string|null=null;
  restore(raw?:Partial<ResearchGradeState>|null){
    const d=defaultResearchGradeOrganism(),r:any=raw??{};
    this.state={...d,...r,version:2,
      decisions:Array.isArray(r.decisions)?r.decisions.slice(-512):[], outcomes:Array.isArray(r.outcomes)?r.outcomes.slice(-512):[],
      evidence:Array.isArray(r.evidence)?r.evidence.slice(-512):[], intentions:Array.isArray(r.intentions)?r.intentions.slice(-128):[],
      longitudinal:Array.isArray(r.longitudinal)?r.longitudinal.slice(-64):[], replications:Array.isArray(r.replications)?r.replications.slice(-128):[],
      recovery:Array.isArray(r.recovery)?r.recovery.slice(-128):[], production:Array.isArray(r.production)?r.production.slice(-256):[], metrics:{...d.metrics,...(r.metrics??{})}
    };
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(ctx:ResearchGradeContext){
    const at=ctx.at??now(); if(this.state.lastAt && at+30000<this.state.lastAt)this.recordRecovery('restart',true,.96,at);
    if(!this.activeWindowId){this.activeWindowId=this.id('win'); this.state.longitudinal.unshift({id:this.activeWindowId,startedAt:at,endedAt:null,cycles:0,decisions:0,verifiedOutcomes:0,closedLoop01:this.state.metrics.closedLoop01,persistence01:.8,externalGrounding01:this.state.metrics.externalGrounding01,recovery01:this.state.metrics.recovery01,status:'active'});}
    this.state.cycles++;this.state.lastAt=at;
    const w=this.state.longitudinal.find(x=>x.id===this.activeWindowId); if(w)w.cycles=this.state.cycles;
    this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.96+(ctx.activePerception01??this.state.metrics.activePerception01)*.04);
    this.state.metrics.longHorizon01=clamp(this.state.metrics.longHorizon01*.96+(ctx.longHorizon01??this.state.metrics.longHorizon01)*.04);
    this.state.metrics.autonomy01=clamp(this.state.metrics.autonomy01*.95+(ctx.autonomy01??this.state.metrics.autonomy01)*.05);
    this.state.metrics.continuity01=clamp(this.state.metrics.continuity01*.95+(ctx.continuity01??this.state.metrics.continuity01)*.05);
    this.captureProduction(at);
    this.refreshOverall();
  }
  registerDecision(action:ActionKind,predicted01:number,contextKey?:string,at=now()){
    const id=this.id('dec');this.state.decisions.unshift({id,cycle:this.state.cycles,action,predicted01:clamp(predicted01),contextKey:String(contextKey??'default').slice(0,96),at});this.state.decisions=this.state.decisions.slice(0,512);
    const w=this.state.longitudinal.find(x=>x.id===this.activeWindowId);if(w)w.decisions++;
    return id;
  }
  registerOutcome(input:{decisionId:string;actual01:number;reward01?:number;verified01:number;causal01:number;external01:number;at?:number}){
    const d=this.state.decisions.find(x=>x.id===input.decisionId); if(!d){this.state.lastError='unmatched-outcome';return {ok:false,reason:'unmatched-outcome'} as const;}
    const error=Math.abs(d.predicted01-clamp(input.actual01));
    this.state.outcomes.unshift({decisionId:d.id,actual01:clamp(input.actual01),reward01:clamp(input.reward01??input.actual01),predictionError01:error,verified01:clamp(input.verified01),causal01:clamp(input.causal01),external01:clamp(input.external01),at:input.at??now()});this.state.outcomes=this.state.outcomes.slice(0,512);
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.86+(1-error)*.06+input.verified01*.04+input.external01*.04);
    this.state.metrics.externalGrounding01=clamp(this.state.metrics.externalGrounding01*.88+input.external01*.08+input.verified01*.04);
    this.state.metrics.causal01=clamp(this.state.metrics.causal01*.9+input.causal01*.06+input.verified01*.04);
    const w=this.state.longitudinal.find(x=>x.id===this.activeWindowId);if(w){w.verifiedOutcomes++;w.closedLoop01=this.state.metrics.closedLoop01;w.externalGrounding01=this.state.metrics.externalGrounding01;}
    this.refreshOverall(); return {ok:true,error01:error} as const;
  }
  recordPostcondition(input:{decisionId:string;action:ActionKind;expected:string;observed:string;matched:boolean;evidenceKind:EvidenceKind;confidence01:number;independent01:number;at?:number}){
    const row:PostconditionEvidence={id:this.id('ev'),decisionId:input.decisionId,action:input.action,expected:String(input.expected).slice(0,240),observed:String(input.observed).slice(0,240),matched:Boolean(input.matched),evidenceKind:input.evidenceKind,confidence01:clamp(input.confidence01),independent01:clamp(input.independent01),at:input.at??now()};
    this.state.evidence.unshift(row);this.state.evidence=this.state.evidence.slice(0,512);const strength=(row.matched?.55:0)+row.confidence01*.25+row.independent01*.20;this.state.metrics.externalGrounding01=clamp(this.state.metrics.externalGrounding01*.9+strength*.1);this.refreshOverall();return row;
  }
  upsertIntention(text:string,goalId:string|null,priority01:number,at=now()){
    const normalized=String(text).trim().slice(0,240);let x=this.state.intentions.find(i=>i.text===normalized&&i.status==='open');
    if(!x){x={id:this.id('int'),text:normalized,goalId,priority01:clamp(priority01),status:'open',createdAt:at,updatedAt:at,resumeCount:0};this.state.intentions.unshift(x);}else{x.priority01=clamp(priority01);x.updatedAt=at;x.resumeCount++;}
    this.state.intentions=this.state.intentions.slice(0,128);return x;
  }
  resolveIntention(id:string,status:'completed'|'abandoned'|'paused',at=now()){const x=this.state.intentions.find(i=>i.id===id);if(!x)return false;x.status=status;x.updatedAt=at;return true;}
  closeWindow(at=now()){const w=this.state.longitudinal.find(x=>x.id===this.activeWindowId);if(w){w.endedAt=at;w.status='closed';w.persistence01=this.recoveryScore();w.recovery01=this.recoveryScore();}this.activeWindowId=null;}
  recordRecovery(kind:FaultRecoveryEvent['kind'],recovered:boolean,continuity01:number,at=now()){const row={id:this.id('rec'),kind,detected:true,recovered:Boolean(recovered),continuity01:clamp(continuity01),at};this.state.recovery.unshift(row);this.state.recovery=this.state.recovery.slice(0,128);this.state.metrics.recovery01=clamp(this.state.metrics.recovery01*.82+(row.recovered?row.continuity01:.0)*.18);return row;}
  recordReplication(component:ResearchComponent,seed:number,baseline01:number,treatment01:number,cycles:number,replicated:boolean,at=now()){const delta=treatment01-baseline01;this.state.replications.unshift({id:this.id('rep'),component,seed,cycles,baseline01,treatment01,delta01:delta,replicated:Boolean(replicated),at});this.state.replications=this.state.replications.slice(0,128);this.state.metrics.replication01=clamp(this.state.metrics.replication01*.9+(replicated?.9:.2)*.1);this.refreshOverall();return this.state.replications[0];}
  freezeArchitecture(manifest:string){this.state.architectureDigest=createHash('sha256').update(String(manifest)).digest('hex');this.state.architectureFrozen=true;return this.state.architectureDigest;}
  productionHealth(){const samples=this.state.production.slice(0,24);return {samples:samples.length,avgRssMB:mean(samples.map(x=>x.memoryRssMB),0),maxRssMB:samples.reduce((m,x)=>Math.max(m,x.memoryRssMB),0),avgEventLoopLagMs:mean(samples.map(x=>x.eventLoopLagMs),0),production01:this.state.metrics.production01};}
  captureProduction(at=now()){
    const mem=process.memoryUsage();const row:ProductionSample={at,uptimeMs:Math.max(0,(at-this.state.startedAt)),memoryRssMB:mem.rss/1048576,heapUsedMB:mem.heapUsed/1048576,eventLoopLagMs:0,cpuLoad01:0,thermal01:.2,battery01:.8};this.state.production.unshift(row);this.state.production=this.state.production.slice(0,256);
    const pressure=clamp(row.memoryRssMB/768);this.state.metrics.production01=clamp(this.state.metrics.production01*.95+(1-pressure)*.05);
  }
  selfAudit(){const ids=new Set(this.state.decisions.map(x=>x.id));const outcomesLinked=this.state.outcomes.every(x=>ids.has(x.decisionId));const evidenceLinked=this.state.evidence.every(x=>ids.has(x.decisionId));const ok=outcomesLinked&&evidenceLinked&&this.state.metrics.overall01>=.25;return {pass:ok,outcomesLinked,evidenceLinked,cycles:this.state.cycles,decisions:this.state.decisions.length,outcomes:this.state.outcomes.length,evidence:this.state.evidence.length,intentionsOpen:this.state.intentions.filter(x=>x.status==='open').length,replications:this.state.replications.length,recoveries:this.state.recovery.length,architectureFrozen:this.state.architectureFrozen,overall01:this.state.metrics.overall01};}
  benchmark(){return {overall01:this.state.metrics.overall01,closedLoop01:this.state.metrics.closedLoop01,externalGrounding01:this.state.metrics.externalGrounding01,causal01:this.state.metrics.causal01,autonomy01:this.state.metrics.autonomy01,continuity01:this.state.metrics.continuity01,recovery01:this.state.metrics.recovery01,replication01:this.state.metrics.replication01,production01:this.state.metrics.production01};}
  diagnostics(){return {metrics:{...this.state.metrics},activeWindowId:this.activeWindowId,openIntentions:this.state.intentions.filter(x=>x.status==='open').length,verifiedOutcomes:this.state.outcomes.filter(x=>x.verified01>=.7).length,externalEvidence:this.state.evidence.filter(x=>x.evidenceKind!=='internal-transition'&&x.evidenceKind!=='simulation').length,production:this.productionHealth(),architectureDigest:this.state.architectureDigest,lastError:this.state.lastError};}
  private recoveryScore(){return mean(this.state.recovery.slice(0,32).map(x=>x.recovered?x.continuity01:0),.7)}
  private refreshOverall(){const m=this.state.metrics;m.overall01=clamp(m.closedLoop01*.20+m.externalGrounding01*.13+m.activePerception01*.08+m.longHorizon01*.10+m.causal01*.10+m.autonomy01*.10+m.continuity01*.10+m.recovery01*.06+m.replication01*.06+m.production01*.07);}
  private id(prefix:string){return `${prefix}-${this.state.cycles}-${this.state.nextId++}`;}
}
