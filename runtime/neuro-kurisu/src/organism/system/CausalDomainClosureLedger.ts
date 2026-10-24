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
const safeCount=(value:unknown):number=>{const n=Number(value??0);return Number.isFinite(n)&&n>=0?Math.min(Number.MAX_SAFE_INTEGER,Math.floor(n)):0;};
const finiteCount=(value:unknown):number=>{const n=Number(value??0);return Number.isFinite(n)&&n>=0?Math.min(Number.MAX_SAFE_INTEGER,Math.floor(n)):0;};
const normalizeCounters=(x:any):CausalDomainCounters=>({
  memoryCount:finiteCount(x?.memoryCount),
  worldTick:finiteCount(x?.worldTick),
  identityRevision:finiteCount(x?.identityRevision),
  agencyDecisions:finiteCount(x?.agencyDecisions),
  learningUpdates:finiteCount(x?.learningUpdates),
  selfChangeCount:finiteCount(x?.selfChangeCount),
  lifeGraphCompleteChains:finiteCount(x?.lifeGraphCompleteChains),
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
    const capacityValue=Number(raw?.capacity??base.capacity);
    const cap=Number.isFinite(capacityValue)?Math.max(8,Math.min(128,Math.floor(capacityValue))):base.capacity;
    const totalCycles=safeCount(raw?.totalCycles);
    const rawRecent=Array.isArray(raw?.recent)?raw!.recent.slice(0,cap):[];
    const recent=rawRecent.map(x=>this.cleanRecord(x));
    const latest=recent[0];
    const rawStatus:CausalClosureStatus=['PASS','DEGRADED','FAIL'].includes(raw?.lastStatus as any)?raw!.lastStatus!:'PASS';
    const rank:Record<CausalClosureStatus,number>={PASS:0,DEGRADED:1,FAIL:2};
    const failedLatest=Boolean(latest&&(latest.status==='FAIL'||latest.failureReason||latest.evidence.cognitiveCycleComplete===false));
    const lastStatus:CausalClosureStatus=latest&&rank[latest.status]>rank[rawStatus]?latest.status:rawStatus;
    const latestOverridesSummary=Boolean(latest&&rank[latest.status]>rank[rawStatus]);
    const rawLatest=rawRecent[0] as any;
    let completeCycles=Math.min(totalCycles,safeCount(raw?.completeCycles));
    let degradedCycles=safeCount(raw?.degradedCycles);
    let failures=Math.max(safeCount(raw?.failures),failedLatest?1:0);
    // When the bounded window contains the full non-empty history, derive counters from
    // normalized terminal records instead of trusting contradictory summaries.
    if(totalCycles>0&&recent.length===totalCycles){
      completeCycles=recent.filter(record=>record.complete&&record.status==='PASS').length;
      degradedCycles=recent.filter(record=>record.status==='DEGRADED').length;
      failures=recent.filter(record=>record.status==='FAIL').length;
    }else if(failedLatest&&rawLatest?.complete===true&&!latest?.complete){
      completeCycles=Math.max(0,completeCycles-1);
    }
    const rawMeanScore=clamp(Number(raw?.meanScore01??0));
    const lastScoreOverstatement=failedLatest&&latest?Math.max(0,clamp(Number(rawLatest?.score01??0))-latest.score01):0;
    const meanScore01=clamp(rawMeanScore-lastScoreOverstatement/Math.max(1,totalCycles));
    this.state={
      version:1,capacity:cap,totalCycles,completeCycles,
      degradedCycles,
      failures:Math.max(failures,failedLatest?1:0),
      meanScore01,
      lastTick:finiteCount(raw?.lastTick),
      lastStatus,
      lastBehaviorHash:latestOverridesSummary&&latest?latest.behaviorHash:failedLatest&&latest?latest.behaviorHash:String(raw?.lastBehaviorHash??'').slice(0,160),
      lastDurableHash:String(raw?.lastDurableHash??'').slice(0,160),
      recent:recent.slice(0,cap),
    };
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
    const previouslyFailed=record.status==='FAIL';
    const score=record.failureReason||cognitiveCycleFailed||previouslyFailed?0:clamp(changed*.10+causalEdges*.11+(evidence.memoryWorldVerified?.08:0)+(evidence.worldAgencyLearningVerified?.08:0)+(evidence.causalLifeGraphChain?.12:0)+(persistence?.05:0));
    const complete=!previouslyFailed && !record.failureReason && !cognitiveCycleFailed && changed===5 && causalEdges>=4 && persistence && evidence.memoryWorldVerified && evidence.worldAgencyLearningVerified && evidence.causalLifeGraphChain;
    const status: CausalClosureStatus = previouslyFailed||record.failureReason||cognitiveCycleFailed?'FAIL':(complete?'PASS':((evidence.worldChanged||evidence.agencyChanged||evidence.learningChanged||evidence.selfChanged)?'DEGRADED':'FAIL'));
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
    const failureReason=typeof raw?.failureReason==='string'?raw.failureReason.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,240)||undefined:undefined;
    const cognitiveCycleFailed=e.cognitiveCycleComplete===false;
    const rawStatus:CausalClosureStatus=['PASS','DEGRADED','FAIL'].includes(raw?.status)?raw.status:'DEGRADED';
    // A persisted PASS without its matching complete=true proof is contradictory.
    const status:CausalClosureStatus=failureReason||cognitiveCycleFailed||rawStatus==='PASS'&&raw?.complete!==true?'FAIL':rawStatus;
    return {
      version:1,
      tick:finiteCount(raw?.tick),
      at:Number.isFinite(Number(raw?.at))?Number(raw.at):0,
      status,
      score01:status==='FAIL'?0:clamp(Number(raw?.score01??0)),
      complete:status==='PASS'&&Boolean(raw?.complete),
      causalChain:Array.isArray(raw?.causalChain)?raw.causalChain.filter((x:any)=>typeof x==='string').map((x:string)=>x.slice(0,80)).slice(0,8):[],
      evidence:{
        memoryChanged:Boolean(e.memoryChanged),worldChanged:Boolean(e.worldChanged),agencyChanged:Boolean(e.agencyChanged),
        learningChanged:Boolean(e.learningChanged),selfChanged:Boolean(e.selfChanged),memoryWorldVerified:Boolean(e.memoryWorldVerified),
        worldAgencyLearningVerified:Boolean(e.worldAgencyLearningVerified),causalLifeGraphChain:Boolean(e.causalLifeGraphChain),
        replaySignaturePresent:Boolean(e.replaySignaturePresent),durableStateAligned:Boolean(e.durableStateAligned),
        ...(typeof e.cognitiveCycleComplete==='boolean'?{cognitiveCycleComplete:e.cognitiveCycleComplete}:{})
      },
      before:normalizeCounters(raw?.before),after:normalizeCounters(raw?.after),
      behaviorHash:String(raw?.behaviorHash??'').slice(0,160),durableHash:raw?.durableHash?String(raw.durableHash).slice(0,160):undefined,
      failureReason
    };
  }
}
