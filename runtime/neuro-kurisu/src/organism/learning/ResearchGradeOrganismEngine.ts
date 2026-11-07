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

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const ACTIONS2:readonly ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const COMPONENTS:readonly ResearchComponent[]=['memory','world-model','self-model','prediction','social','agency','workspace','embodiment','active-perception','counterfactual'];
const EVIDENCE_KINDS=['tool-postcondition','world-postcondition','device-observation','sensor-observation','internal-transition','simulation','manual'] as const;
const FAULT_KINDS=['restart','missing-state','corrupt-state','interrupted-action','sensor-failure','resource-pressure'] as const;
const str=(v:unknown,f:string,n=200):string=>typeof v==='string'&&v?v.slice(0,n):f;
const strOrNull=(v:unknown,n=160):string|null=>typeof v==='string'&&v?v.slice(0,n):null;
const sanDecision=(x:unknown):LifeDecision|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,cycle:cnt(r.cycle,0),action:ACTIONS2.includes(r.action as ActionKind)?r.action as ActionKind:'reflect',predicted01:C01(r.predicted01,0),contextKey:str(r.contextKey,'',200),at:cnt(r.at,0)};};
const sanOutcome=(x:unknown):LifeOutcome|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {decisionId:str(r.decisionId,'',120),actual01:C01(r.actual01,0),reward01:finN(r.reward01,0),predictionError01:C01(r.predictionError01,0),verified01:C01(r.verified01,0),causal01:C01(r.causal01,0),external01:C01(r.external01,0),at:cnt(r.at,0)};};
const sanEvidence=(x:unknown):PostconditionEvidence|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,decisionId:str(r.decisionId,'',120),action:ACTIONS2.includes(r.action as ActionKind)?r.action as ActionKind:'reflect',expected:str(r.expected,'',240),observed:str(r.observed,'',240),matched:Boolean(r.matched),evidenceKind:(EVIDENCE_KINDS as readonly string[]).includes(r.evidenceKind as string)?r.evidenceKind as EvidenceKind:'manual',confidence01:C01(r.confidence01,0),independent01:C01(r.independent01,0),at:cnt(r.at,0)};};
const sanIntention=(x:unknown):Intention|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,text:str(r.text,'',240),goalId:strOrNull(r.goalId),priority01:C01(r.priority01,0),status:['open','paused','completed','abandoned'].includes(r.status as string)?r.status as Intention['status']:'open',createdAt:cnt(r.createdAt,0),updatedAt:cnt(r.updatedAt,0),resumeCount:cnt(r.resumeCount,0)};};
const sanLongitudinal=(x:unknown):LongitudinalWindow|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,startedAt:cnt(r.startedAt,0),endedAt:r.endedAt===null||r.endedAt===undefined?null:cnt(r.endedAt,0),cycles:cnt(r.cycles,0),decisions:cnt(r.decisions,0),verifiedOutcomes:cnt(r.verifiedOutcomes,0),closedLoop01:C01(r.closedLoop01,0),persistence01:C01(r.persistence01,0),externalGrounding01:C01(r.externalGrounding01,0),recovery01:C01(r.recovery01,0),status:r.status==='closed'?'closed':'active'};};
const sanReplication=(x:unknown):ReplicationRun|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,component:COMPONENTS.includes(r.component as ResearchComponent)?r.component as ResearchComponent:'memory',seed:cnt(r.seed,0),cycles:cnt(r.cycles,0),baseline01:C01(r.baseline01,0),treatment01:C01(r.treatment01,0),delta01:finN(r.delta01,0),replicated:Boolean(r.replicated),at:cnt(r.at,0)};};
const sanRecovery=(x:unknown):FaultRecoveryEvent|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const id=str(r.id,'',120);if(!id)return null;return {id,kind:(FAULT_KINDS as readonly string[]).includes(r.kind as string)?r.kind as FaultRecoveryEvent['kind']:'restart',detected:Boolean(r.detected),recovered:Boolean(r.recovered),continuity01:C01(r.continuity01,0),at:cnt(r.at,0)};};
const sanProduction=(x:unknown):ProductionSample|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {at:cnt(r.at,0),uptimeMs:cnt(r.uptimeMs,0),memoryRssMB:cnt(r.memoryRssMB,0),heapUsedMB:cnt(r.heapUsedMB,0),eventLoopLagMs:Math.max(0,finN(r.eventLoopLagMs,0)),cpuLoad01:C01(r.cpuLoad01,0),thermal01:C01(r.thermal01,0),battery01:C01(r.battery01,0)};};
export class ResearchGradeOrganismEngine {
  private state=defaultResearchGradeOrganism();
  private activeWindowId:string|null=null;
  restore(raw?:Partial<ResearchGradeState>|null){
    const d=defaultResearchGradeOrganism();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const arr=(k:string,n:number):unknown[]=>Array.isArray(read(k))?(read(k) as unknown[]).slice(-n):[];
    const mRaw=(read('metrics')&&typeof read('metrics')==='object')?read('metrics') as Record<string,unknown>:{};
    this.state={version:2,cycles:cnt(read('cycles'),d.cycles),nextId:Math.max(1,cnt(read('nextId'),d.nextId)),lastAt:cnt(read('lastAt'),d.lastAt),startedAt:cnt(read('startedAt'),d.startedAt),
      decisions:arr('decisions',512).map(sanDecision).filter((x):x is LifeDecision=>x!==null),
      outcomes:arr('outcomes',512).map(sanOutcome).filter((x):x is LifeOutcome=>x!==null),
      evidence:arr('evidence',512).map(sanEvidence).filter((x):x is PostconditionEvidence=>x!==null),
      intentions:arr('intentions',128).map(sanIntention).filter((x):x is Intention=>x!==null),
      longitudinal:arr('longitudinal',64).map(sanLongitudinal).filter((x):x is LongitudinalWindow=>x!==null),
      replications:arr('replications',128).map(sanReplication).filter((x):x is ReplicationRun=>x!==null),
      recovery:arr('recovery',128).map(sanRecovery).filter((x):x is FaultRecoveryEvent=>x!==null),
      production:arr('production',256).map(sanProduction).filter((x):x is ProductionSample=>x!==null),
      metrics:{closedLoop01:C01(mRaw.closedLoop01,d.metrics.closedLoop01),externalGrounding01:C01(mRaw.externalGrounding01,d.metrics.externalGrounding01),activePerception01:C01(mRaw.activePerception01,d.metrics.activePerception01),longHorizon01:C01(mRaw.longHorizon01,d.metrics.longHorizon01),causal01:C01(mRaw.causal01,d.metrics.causal01),autonomy01:C01(mRaw.autonomy01,d.metrics.autonomy01),continuity01:C01(mRaw.continuity01,d.metrics.continuity01),recovery01:C01(mRaw.recovery01,d.metrics.recovery01),replication01:C01(mRaw.replication01,d.metrics.replication01),production01:C01(mRaw.production01,d.metrics.production01),overall01:C01(mRaw.overall01,d.metrics.overall01)},
      architectureFrozen:Boolean(read('architectureFrozen')),architectureDigest:str(read('architectureDigest'),'',160),lastError:str(read('lastError'),'',240)};
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
