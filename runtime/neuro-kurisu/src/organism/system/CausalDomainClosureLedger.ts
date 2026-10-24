import { createHash } from 'node:crypto';

export type CausalClosureStatus = 'PASS'|'DEGRADED'|'FAIL';

export interface CausalDomainCounters {
  memoryCount:number;
  worldTick:number;
  identityRevision:number;
  agencyDecisions:number;
  learningUpdates:number;
  selfChangeCount:number;
  lifeGraphCompleteChains:number;
}

export interface CausalDomainEvidence {
  memoryChanged:boolean;
  worldChanged:boolean;
  agencyChanged:boolean;
  learningChanged:boolean;
  selfChanged:boolean;
  memoryWorldVerified:boolean;
  worldAgencyLearningVerified:boolean;
  causalLifeGraphChain:boolean;
  replaySignaturePresent:boolean;
  durableStateAligned:boolean;
  /** Explicit result of UnifiedCognitiveCycle; omitted only by legacy snapshots/tests. */
  cognitiveCycleComplete?:boolean;
}

export interface CausalDomainClosureRecord {
  version:1;
  tick:number;
  at:number;
  status:CausalClosureStatus;
  score01:number;
  complete:boolean;
  causalChain:string[];
  evidence:CausalDomainEvidence;
  before:CausalDomainCounters;
  after:CausalDomainCounters;
  behaviorHash:string;
  durableHash?:string;
  /** Present when the cycle ended without reaching its normal causal closure. */
  failureReason?:string;
}

export interface CausalDomainClosureSnapshot {
  version:1;
  capacity:number;
  totalCycles:number;
  completeCycles:number;
  degradedCycles:number;
  failures:number;
  meanScore01:number;
  lastTick:number;
  lastStatus:CausalClosureStatus;
  lastBehaviorHash:string;
  lastDurableHash:string;
  recent:CausalDomainClosureRecord[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const normalizeCounters=(x:any):CausalDomainCounters=>({
  memoryCount:Math.max(0,Number(x?.memoryCount??0)),
  worldTick:Math.max(0,Number(x?.worldTick??0)),
  identityRevision:Math.max(0,Number(x?.identityRevision??0)),
  agencyDecisions:Math.max(0,Number(x?.agencyDecisions??0)),
  learningUpdates:Math.max(0,Number(x?.learningUpdates??0)),
  selfChangeCount:Math.max(0,Number(x?.selfChangeCount??0)),
  lifeGraphCompleteChains:Math.max(0,Number(x?.lifeGraphCompleteChains??0)),
});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fastHash=(value:unknown)=>{let h=2166136261;const text=JSON.stringify(value);for(let i=0;i<text.length;i+=1){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};

export const defaultCausalDomainClosureLedger=():CausalDomainClosureSnapshot=>({version:1,capacity:32,totalCycles:0,completeCycles:0,degradedCycles:0,failures:0,meanScore01:0,lastTick:0,lastStatus:'PASS',lastBehaviorHash:'',lastDurableHash:'',recent:[]});

export class CausalDomainClosureLedger {
  private state=defaultCausalDomainClosureLedger();
  private pending:{tick:number;at:number;before:CausalDomainCounters}|null=null;
  constructor(capacity=32){this.state.capacity=Math.max(8,Math.min(128,Math.floor(capacity)));}

  restore(raw?:Partial<CausalDomainClosureSnapshot>|null):void{
    const base=defaultCausalDomainClosureLedger();
    const cap=Math.max(8,Math.min(128,Math.floor(Number(raw?.capacity??base.capacity))));
    this.state={...base,...(raw??{}),version:1,capacity:cap,
      totalCycles:Math.max(0,Number(raw?.totalCycles??0)),completeCycles:Math.max(0,Number(raw?.completeCycles??0)),
      degradedCycles:Math.max(0,Number(raw?.degradedCycles??0)),failures:Math.max(0,Number(raw?.failures??0)),
      meanScore01:clamp(Number(raw?.meanScore01??0)),lastTick:Math.max(0,Number(raw?.lastTick??0)),
      lastStatus:['PASS','DEGRADED','FAIL'].includes(raw?.lastStatus as any)?raw!.lastStatus!:'PASS',
      lastBehaviorHash:String(raw?.lastBehaviorHash??''),lastDurableHash:String(raw?.lastDurableHash??''),
      recent:Array.isArray(raw?.recent)?raw!.recent.slice(0,cap).map(x=>this.cleanRecord(x)):[]};
  }

  begin(input:{tick:number;at?:number;counters:CausalDomainCounters}):void{
    this.pending={tick:Math.max(0,Math.floor(Number(input.tick))),at:Number(input.at??Date.now()),before:normalizeCounters(input.counters)};
  }

  failPending(input:{reason:string;counters?:CausalDomainCounters}):CausalDomainClosureRecord|null{
    if(!this.pending)return null;
    const reason=(typeof input?.reason==='string'?input.reason:'cycle execution failed')
      .normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,240)||'cycle execution failed';
    return this.end({
      counters:input.counters??this.pending.before,
      evidence:{
        memoryChanged:false,worldChanged:false,agencyChanged:false,learningChanged:false,selfChanged:false,
        memoryWorldVerified:false,worldAgencyLearningVerified:false,causalLifeGraphChain:false,
        replaySignaturePresent:false,durableStateAligned:false,cognitiveCycleComplete:false
      },
      failureReason:reason
    });
  }

  /** Retroactively downgrade a cycle when durable/batch finalization fails after normal closure. */
  failLatest(input:{reason:string;tick?:number;counters?:CausalDomainCounters}):CausalDomainClosureRecord|null{
    if(this.pending)return this.failPending({reason:input.reason,counters:input.counters});
    const previous=this.state.recent[0];
    if(!previous || (input.tick!==undefined && previous.tick!==Math.max(0,Math.floor(Number(input.tick)))))return null;
    const reason=(typeof input?.reason==='string'?input.reason:'cycle finalization failed')
      .normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,240)||'cycle finalization failed';
    const evidence:CausalDomainEvidence={
      memoryChanged:false,worldChanged:false,agencyChanged:false,learningChanged:false,selfChanged:false,
      memoryWorldVerified:false,worldAgencyLearningVerified:false,causalLifeGraphChain:false,
      replaySignaturePresent:false,durableStateAligned:false,cognitiveCycleComplete:previous.evidence.cognitiveCycleComplete
    };
    const after=normalizeCounters(input.counters??previous.after);
    const record:CausalDomainClosureRecord={
      ...previous, status:'FAIL', score01:0, complete:false, causalChain:[], evidence, after,
      failureReason:reason, behaviorHash:fastHash({tick:previous.tick,status:'FAIL',reason,after})
    };
    this.state={
      ...this.state,
      completeCycles:Math.max(0,this.state.completeCycles-Number(previous.complete)),
      degradedCycles:Math.max(0,this.state.degradedCycles-Number(previous.status==='DEGRADED')),
      failures:this.state.failures+Number(previous.status!=='FAIL'),
      meanScore01:clamp(this.state.meanScore01+(0-previous.score01)/Math.max(1,this.state.totalCycles)),
      lastStatus:previous.tick===this.state.lastTick?'FAIL':this.state.lastStatus,
      lastBehaviorHash:previous.tick===this.state.lastTick?record.behaviorHash:this.state.lastBehaviorHash,
      recent:[record,...this.state.recent.slice(1)]
    };
    return structuredClone(record);
  }
  end(input:{counters:CausalDomainCounters;evidence:CausalDomainEvidence;durableHash?:string;failureReason?:string}):CausalDomainClosureRecord|null{
    if(!this.pending)return null;
    const pending=this.pending;
    const after=normalizeCounters(input.counters);
    const evidence={...input.evidence};
    const changed=[evidence.memoryChanged,evidence.worldChanged,evidence.agencyChanged,evidence.learningChanged,evidence.selfChanged].filter(Boolean).length;
    const causalEdges=[evidence.memoryChanged,evidence.memoryWorldVerified,evidence.worldAgencyLearningVerified,evidence.causalLifeGraphChain,evidence.learningChanged&&evidence.selfChanged].filter(Boolean).length;
    const persistence=evidence.replaySignaturePresent&&evidence.durableStateAligned;
    const failureReason=typeof input.failureReason==='string'
      ? input.failureReason.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,240)||'cycle execution failed'
      : undefined;
    const cognitiveCycleFailed=evidence.cognitiveCycleComplete===false;
    const score=failureReason||cognitiveCycleFailed?0:clamp(changed*.10+causalEdges*.11+(evidence.memoryWorldVerified?.08:0)+(evidence.worldAgencyLearningVerified?.08:0)+(evidence.causalLifeGraphChain?.12:0)+(persistence?.05:0));
    const complete=!failureReason && !cognitiveCycleFailed && changed===5 && causalEdges>=4 && persistence && evidence.memoryWorldVerified && evidence.worldAgencyLearningVerified && evidence.causalLifeGraphChain;
    const status:CausalClosureStatus=failureReason||cognitiveCycleFailed?'FAIL':(complete?'PASS':((evidence.worldChanged||evidence.agencyChanged||evidence.learningChanged||evidence.selfChanged)?'DEGRADED':'FAIL'));
    const causalChain=['memory','world','agency','learning','self'].filter((_,i)=>[evidence.memoryChanged,evidence.worldChanged,evidence.agencyChanged,evidence.learningChanged,evidence.selfChanged][i]);
    const record:CausalDomainClosureRecord={
      version:1,tick:pending.tick,at:pending.at,status,score01:score,complete,causalChain,evidence,
      before:pending.before,after,
      behaviorHash:fastHash({tick:pending.tick,after,evidence,causalChain,failureReason:failureReason??null}),
      durableHash:input.durableHash,
      ...(failureReason?{failureReason}:{})
    };
    const total=this.state.totalCycles+1;
    this.state={...this.state,totalCycles:total,completeCycles:this.state.completeCycles+(complete?1:0),degradedCycles:this.state.degradedCycles+(status==='DEGRADED'?1:0),failures:this.state.failures+(status==='FAIL'?1:0),meanScore01:clamp((this.state.meanScore01*this.state.totalCycles+score)/total),lastTick:record.tick,lastStatus:status,lastBehaviorHash:record.behaviorHash,lastDurableHash:input.durableHash??this.state.lastDurableHash,recent:[record,...this.state.recent].slice(0,this.state.capacity)};
    this.pending=null;
    return structuredClone(record);
  }

  durable(input:{tick:number;stateTick:number;replaySignature:string;continuousTick?:number;processed?:number}):CausalDomainClosureRecord{
    const checks={replaySignaturePresent:Boolean(input.replaySignature),durableStateAligned:input.stateTick===input.tick && (input.continuousTick==null || input.continuousTick===input.tick)};
    const record:CausalDomainClosureRecord={
      version:1,tick:Math.max(0,Math.floor(Number(input.tick))),at:Date.now(),
      status:checks.replaySignaturePresent&&checks.durableStateAligned?'PASS':'DEGRADED',
      score01:(checks.replaySignaturePresent?0.5:0)+(checks.durableStateAligned?0.5:0),
      complete:checks.replaySignaturePresent&&checks.durableStateAligned,
      causalChain:[],
      evidence:{memoryChanged:false,worldChanged:false,agencyChanged:false,learningChanged:false,selfChanged:false,memoryWorldVerified:false,worldAgencyLearningVerified:false,causalLifeGraphChain:false,replaySignaturePresent:checks.replaySignaturePresent,durableStateAligned:checks.durableStateAligned},
      before:normalizeCounters({worldTick:input.tick}),after:normalizeCounters({worldTick:input.tick}),
      behaviorHash:this.state.lastBehaviorHash,
      durableHash:hash({tick:input.tick,replaySignature:input.replaySignature,continuousTick:input.continuousTick??null,processed:input.processed??null})
    };
    this.state.lastDurableHash=record.durableHash!;
    return structuredClone(record);
  }

  finalizeDurable(input:{tick:number;stateTick:number;replaySignature:string;continuousTick?:number;processed?:number}):CausalDomainClosureRecord|null {
    const record=this.state.recent[0];
    if(!record || record.tick!==Math.max(0,Math.floor(Number(input.tick)))) return null;
    const replaySignaturePresent=Boolean(input.replaySignature);
    const durableStateAligned=input.stateTick===input.tick && (input.continuousTick==null || input.continuousTick===input.tick);
    const evidence={...record.evidence,replaySignaturePresent,durableStateAligned};
    const changed=[evidence.memoryChanged,evidence.worldChanged,evidence.agencyChanged,evidence.learningChanged,evidence.selfChanged].filter(Boolean).length;
    const causalEdges=[evidence.memoryChanged,evidence.memoryWorldVerified,evidence.worldAgencyLearningVerified,evidence.causalLifeGraphChain,evidence.learningChanged&&evidence.selfChanged].filter(Boolean).length;
    const persistence=replaySignaturePresent&&durableStateAligned;
    const cognitiveCycleFailed=evidence.cognitiveCycleComplete===false;
    const score=record.failureReason||cognitiveCycleFailed?0:clamp(changed*.10+causalEdges*.11+(evidence.memoryWorldVerified?.08:0)+(evidence.worldAgencyLearningVerified?.08:0)+(evidence.causalLifeGraphChain?.12:0)+(persistence?.05:0));
    const complete=!record.failureReason && !cognitiveCycleFailed && changed===5 && causalEdges>=4 && persistence && evidence.memoryWorldVerified && evidence.worldAgencyLearningVerified && evidence.causalLifeGraphChain;
    const status:CausalClosureStatus=record.failureReason||cognitiveCycleFailed?'FAIL':(complete?'PASS':((evidence.worldChanged||evidence.agencyChanged||evidence.learningChanged||evidence.selfChanged)?'DEGRADED':'FAIL'));
    const durableHash=hash({tick:input.tick,replaySignature:input.replaySignature,continuousTick:input.continuousTick??null,processed:input.processed??null});
    const priorStatus=record.status;
    const next={...record,evidence,score01:score,complete,status,durableHash};
    this.state.completeCycles+=Number(complete)-Number(record.complete);
    this.state.degradedCycles+=(status==='DEGRADED'?1:0)-(priorStatus==='DEGRADED'?1:0);
    this.state.failures+=(status==='FAIL'?1:0)-(priorStatus==='FAIL'?1:0);
    const count=Math.max(1,this.state.totalCycles);
    this.state.meanScore01=clamp(this.state.meanScore01 + (score-record.score01)/count);
    this.state.lastStatus=status;
    this.state.lastBehaviorHash=record.behaviorHash;
    this.state.lastDurableHash=durableHash;
    this.state.recent=[next,...this.state.recent.slice(1)];
    return structuredClone(next);
  }

  snapshot():CausalDomainClosureSnapshot{return structuredClone(this.state);}
  diagnostics(){return {totalCycles:this.state.totalCycles,completeCycles:this.state.completeCycles,degradedCycles:this.state.degradedCycles,failures:this.state.failures,completionRate01:clamp(this.state.completeCycles/Math.max(1,this.state.totalCycles)),meanScore01:this.state.meanScore01,lastTick:this.state.lastTick,lastStatus:this.state.lastStatus,lastDurableHash:this.state.lastDurableHash};}

  private cleanRecord(raw:any):CausalDomainClosureRecord{
    const e=raw?.evidence??{};
    return {
      version:1,
      tick:Math.max(0,Number(raw?.tick??0)),
      at:Number(raw?.at??0),
      status:['PASS','DEGRADED','FAIL'].includes(raw?.status)?raw.status:'DEGRADED',
      score01:clamp(Number(raw?.score01??0)),
      complete:Boolean(raw?.complete),
      causalChain:Array.isArray(raw?.causalChain)?raw.causalChain.map(String).slice(0,8):[],
      evidence:{
        memoryChanged:Boolean(e.memoryChanged),worldChanged:Boolean(e.worldChanged),agencyChanged:Boolean(e.agencyChanged),
        learningChanged:Boolean(e.learningChanged),selfChanged:Boolean(e.selfChanged),memoryWorldVerified:Boolean(e.memoryWorldVerified),
        worldAgencyLearningVerified:Boolean(e.worldAgencyLearningVerified),causalLifeGraphChain:Boolean(e.causalLifeGraphChain),
        replaySignaturePresent:Boolean(e.replaySignaturePresent),durableStateAligned:Boolean(e.durableStateAligned),
        ...(typeof e.cognitiveCycleComplete==='boolean'?{cognitiveCycleComplete:e.cognitiveCycleComplete}:{})
      },
      before:normalizeCounters(raw?.before),after:normalizeCounters(raw?.after),
      behaviorHash:String(raw?.behaviorHash??''),durableHash:raw?.durableHash?String(raw.durableHash):undefined,
      failureReason:typeof raw?.failureReason==='string'?raw.failureReason.slice(0,240):undefined
    };
  }
}
