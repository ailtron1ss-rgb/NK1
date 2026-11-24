import { createHash, randomUUID } from 'node:crypto';

export interface ContinuityCommit {
  seq:number;
  at:number;
  tick:number;
  sessionId:string;
  parentHash:string;
  stateHash:string;
  eventHash:string;
  reason:string;
  identityFingerprint:string;
  subjectId:string;
  lastAction:string;
  activeGoalIds:string[];
  memoryAnchorIds:string[];
  autobiographicalMomentId:string;
  unresolvedIntentions:number;
  schemaVersion:number;
}

export interface ContinuityResume {
  sessionId:string;
  at:number;
  tick:number;
  predecessorHash:string;
  verified:boolean;
  gapMs:number;
  reason:string;
}

export interface PersistentContinuityKernelState {
  version:1;
  subjectId:string;
  birthAt:number;
  branchId:string;
  sessionId:string;
  sessionCount:number;
  active:boolean;
  headSeq:number;
  headHash:string;
  headTick:number;
  headAt:number;
  previousAt:number;
  continuity01:number;
  causalLineage01:number;
  restartContinuity01:number;
  gapCount:number;
  brokenLinks:number;
  rejectedCommits:number;
  commits:number;
  resumes:number;
  lineage:ContinuityCommit[];
  lineageBaseSeq:number;
  lineageTruncated:boolean;
  resumesLog:ContinuityResume[];
}

export interface ContinuityMaterialInput {
  subjectId:string;
  schemaVersion:number;
  tick:number;
  at:number;
  lastAction:string;
  lastActionSuccess:number|null;
  identityFingerprint:string;
  identityContinuity01:number;
  p84MomentId:string;
  p84Continuity01:number;
  p84CausalContinuity01:number;
  memoryAnchorIds:string[];
  activeGoalIds:string[];
  unresolvedIntentions:number;
  worldRevision:number;
  b1600CampaignStep:number;
  b1600Development01:number;
}

const clean=(x:unknown,n=160)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const uniq=(xs:unknown[],limit=24)=>[...new Set(xs.map(x=>clean(x,96)).filter(Boolean))].slice(-limit);
const stableJson=(value:unknown)=>JSON.stringify(value,(key,val)=>Array.isArray(val)?val.map(v=>v):val&&typeof val==='object'?Object.keys(val).sort().reduce((o,k)=>{o[k]=val[k];return o;},{} as any):val);
const hash=(value:unknown)=>createHash('sha256').update(String(stableJson(value) ?? 'null')).digest('hex');

export const defaultPersistentContinuityKernel=():PersistentContinuityKernelState=>({
  version:1, subjectId:randomUUID(), birthAt:Date.now(), branchId:randomUUID(), sessionId:'', sessionCount:0, active:false,
  headSeq:0, headHash:'', headTick:0, headAt:0, previousAt:0, continuity01:1, causalLineage01:1, restartContinuity01:1,
  gapCount:0, brokenLinks:0, rejectedCommits:0, commits:0, resumes:0, lineage:[], lineageBaseSeq:0, lineageTruncated:false, resumesLog:[],
});

/**
 * Authoritative continuity layer. Existing memory/identity systems produce
 * evidence; this kernel owns the durable lineage head that says which state
 * was actually accepted as the continuation of the same organism.
 */
export class PersistentContinuityKernel {
  readonly systemName='system:persistent-continuity-kernel' as const;
  private state=defaultPersistentContinuityKernel();
  private readonly maxLineage:number;
  private readonly maxResumes:number;
  constructor(maxLineage=256,maxResumes=128){this.maxLineage=Math.max(32,Math.floor(maxLineage));this.maxResumes=Math.max(32,Math.floor(maxResumes));}

  restore(raw?:Partial<PersistentContinuityKernelState>|null){
    const d=defaultPersistentContinuityKernel(), r=raw??{};
    this.state={
      ...d,...r,version:1,
      subjectId:clean(r.subjectId,96)||d.subjectId,
      birthAt:Number(r.birthAt??d.birthAt),branchId:clean(r.branchId,96)||d.branchId,
      sessionId:clean(r.sessionId,96),sessionCount:Math.max(0,Math.floor(Number(r.sessionCount??0))),active:Boolean(r.active),
      headSeq:Math.max(0,Math.floor(Number(r.headSeq??0))),headHash:clean(r.headHash,128),headTick:Math.max(0,Math.floor(Number(r.headTick??0))),headAt:Number(r.headAt??0),previousAt:Number(r.previousAt??0),
      continuity01:clamp(Number(r.continuity01??d.continuity01)),causalLineage01:clamp(Number(r.causalLineage01??d.causalLineage01)),restartContinuity01:clamp(Number(r.restartContinuity01??d.restartContinuity01)),
      gapCount:Math.max(0,Math.floor(Number(r.gapCount??0))),brokenLinks:Math.max(0,Math.floor(Number(r.brokenLinks??0))),rejectedCommits:Math.max(0,Math.floor(Number(r.rejectedCommits??0))),commits:Math.max(0,Math.floor(Number(r.commits??0))),resumes:Math.max(0,Math.floor(Number(r.resumes??0))),
      lineage:Array.isArray(r.lineage)?r.lineage.slice(-this.maxLineage):[],lineageBaseSeq:Math.max(0,Math.floor(Number(r.lineageBaseSeq??(Array.isArray(r.lineage)&&r.lineage.length?Number(r.lineage[0]?.seq??0):0)))),lineageTruncated:Boolean(r.lineageTruncated),resumesLog:Array.isArray(r.resumesLog)?r.resumesLog.slice(-this.maxResumes):[]
    };
  }
  snapshot():PersistentContinuityKernelState{return structuredClone(this.state);}

  materialHash(material:ContinuityMaterialInput):string{return hash({
    // Identity anchors are intentionally stable across process restart and
    // host/runtime reconstruction. Volatile telemetry belongs in diagnostics,
    // never in the authoritative continuation hash.
    subjectId:material.subjectId,schemaVersion:material.schemaVersion,tick:material.tick,lastAction:material.lastAction,lastActionSuccess:material.lastActionSuccess,
    identityFingerprint:material.identityFingerprint,p84MomentId:material.p84MomentId,memoryAnchorIds:uniq(material.memoryAnchorIds),activeGoalIds:uniq(material.activeGoalIds),
    unresolvedIntentions:Math.max(0,Math.floor(material.unresolvedIntentions))
  });}

  beginSession(input:{now:number;tick:number;currentStateHash:string;reason?:string}):ContinuityResume{
    const at=Math.max(0,Number(input.now));
    const previousAt=this.state.headAt||this.state.previousAt||at;
    const gapMs=Math.max(0,at-previousAt);
    const predecessorHash=this.state.headHash;
    const predecessorStateHash=this.state.lineage.at(-1)?.stateHash || '';
    const verified=!predecessorStateHash || predecessorStateHash===clean(input.currentStateHash,128);
    const sessionId=randomUUID();
    this.state.sessionId=sessionId;this.state.sessionCount++;this.state.resumes++;this.state.active=true;this.state.previousAt=previousAt;
    if(gapMs>0) this.state.gapCount+=1;
    if(!verified){this.state.brokenLinks+=1;this.state.restartContinuity01=clamp(this.state.restartContinuity01*.55);}
    else this.state.restartContinuity01=clamp(this.state.restartContinuity01*.96+.04);
    const row:ContinuityResume={sessionId,at,tick:Math.max(0,Math.floor(input.tick)),predecessorHash,verified,gapMs,reason:clean(input.reason||'process-resume',160)};
    this.state.resumesLog=[...this.state.resumesLog,row].slice(-this.maxResumes);
    this.refreshContinuity();
    return structuredClone(row);
  }

  commit(material:ContinuityMaterialInput,reason='checkpoint'):{ok:boolean;record?:ContinuityCommit;error?:string}{
    if(!this.state.active){this.state.rejectedCommits++;return {ok:false,error:'continuity-session-inactive'};}
    if(material.subjectId!==this.state.subjectId){this.state.rejectedCommits++;this.state.brokenLinks++;return {ok:false,error:'continuity-subject-mismatch'};}
    const stateHash=this.materialHash(material);
    const parentHash=this.state.headHash;
    const expectedSeq=this.state.headSeq+1;
    const prev=this.state.lineage.at(-1);
    if(prev && (prev.eventHash!==this.state.headHash || prev.seq!==this.state.headSeq)){this.state.rejectedCommits++;this.state.brokenLinks++;return {ok:false,error:'continuity-head-corrupt'};}
    if(prev && material.tick<prev.tick){this.state.rejectedCommits++;this.state.brokenLinks++;return {ok:false,error:'continuity-time-regression'};}
    const payload={seq:expectedSeq,at:material.at,tick:material.tick,sessionId:this.state.sessionId,parentHash,stateHash,reason:clean(reason,128),identityFingerprint:clean(material.identityFingerprint,128),subjectId:this.state.subjectId,lastAction:clean(material.lastAction,64),activeGoalIds:uniq(material.activeGoalIds),memoryAnchorIds:uniq(material.memoryAnchorIds),autobiographicalMomentId:clean(material.p84MomentId,96),unresolvedIntentions:Math.max(0,Math.floor(material.unresolvedIntentions)),schemaVersion:material.schemaVersion};
    const eventHash=hash(payload);
    const record:ContinuityCommit={...payload,eventHash};
    const extended=[...this.state.lineage,record];this.state.lineageTruncated=extended.length>this.maxLineage;this.state.lineage=extended.slice(-this.maxLineage);this.state.lineageBaseSeq=this.state.lineage[0]?.seq??0;
    this.state.headSeq=record.seq;this.state.headHash=record.eventHash;this.state.headTick=record.tick;this.state.headAt=record.at;this.state.previousAt=record.at;this.state.commits++;
    this.state.continuity01=clamp(this.state.continuity01*.985+.015*(material.p84Continuity01*.45+material.p84CausalContinuity01*.25+material.identityContinuity01*.2+this.state.restartContinuity01*.1));
    this.state.causalLineage01=clamp(this.state.causalLineage01*.97+.03*(material.p84CausalContinuity01*.45+material.b1600Development01*.25+(material.activeGoalIds.length?1:.6)*.15+(material.memoryAnchorIds.length?1:.6)*.15));
    return {ok:true,record:structuredClone(record)};
  }

  verify(currentStateHash?:string){
    const rows=this.state.lineage;let chain=true;let monotonic=true;let prevHash=rows.length&&this.state.lineageTruncated?'__TRUNCATED_ANCHOR__':'';let prevTick=-1;
    for(const r of rows){
      if(prevHash!=='__TRUNCATED_ANCHOR__' && r.parentHash!==prevHash) chain=false;
      if(r.tick<prevTick||r.seq<=0) monotonic=false;
      const payload={seq:r.seq,at:r.at,tick:r.tick,sessionId:r.sessionId,parentHash:r.parentHash,stateHash:r.stateHash,reason:r.reason,identityFingerprint:r.identityFingerprint,subjectId:r.subjectId,lastAction:r.lastAction,activeGoalIds:r.activeGoalIds,memoryAnchorIds:r.memoryAnchorIds,autobiographicalMomentId:r.autobiographicalMomentId,unresolvedIntentions:r.unresolvedIntentions,schemaVersion:r.schemaVersion};
      if(hash(payload)!==r.eventHash) chain=false;
      prevHash=r.eventHash;prevTick=r.tick;
    }
    const headOk=(!rows.length&&this.state.headHash==='')||(rows.length>0&&rows.at(-1)!.eventHash===this.state.headHash&&rows.at(-1)!.seq===this.state.headSeq);
    const currentOk=currentStateHash===undefined||!this.state.headHash||(!rows.length?true:rows.at(-1)!.stateHash===currentStateHash);
    return {verified:chain&&monotonic&&headOk&&currentOk,chain,monotonic,headOk,currentOk,commits:this.state.commits,headSeq:this.state.headSeq,headHash:this.state.headHash,gapCount:this.state.gapCount,brokenLinks:this.state.brokenLinks,restartContinuity01:this.state.restartContinuity01,continuity01:this.state.continuity01,causalLineage01:this.state.causalLineage01,lineageLength:rows.length,lineageBaseSeq:this.state.lineageBaseSeq,lineageTruncated:this.state.lineageTruncated,globalAncestryProofAvailable:!this.state.lineageTruncated||this.state.lineageBaseSeq<=1};
  }


  private refreshContinuity(){
    const gapPenalty=Math.min(.35,this.state.gapCount*.015);
    const breakPenalty=Math.min(.45,this.state.brokenLinks*.08);
    this.state.continuity01=clamp(.50*this.state.continuity01+.25*this.state.causalLineage01+.20*this.state.restartContinuity01+.05*(1-gapPenalty-breakPenalty));
  }

  diagnostics(){return {...this.verify(),sessionId:this.state.sessionId,sessionCount:this.state.sessionCount,resumes:this.state.resumes,rejectedCommits:this.state.rejectedCommits,lineageLength:this.state.lineage.length,firstSeq:this.state.lineage[0]?.seq??0,lastTick:this.state.headTick};}
}
