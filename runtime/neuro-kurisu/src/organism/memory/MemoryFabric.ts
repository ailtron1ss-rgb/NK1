import type { OrganismEvent } from './EventSourcing.ts';
import { EventLog, makeEvent } from './EventSourcing.ts';
import { createHash } from 'node:crypto';
import { MemoryOS2, type MemoryItem2, type MemoryOSState2, type MemoryTemporalQueryOptions, type SemanticIndexMaintenanceResult } from '../developmental/MemoryOS2.ts';
import { MultiTimescaleMemory, type MemoryRecord } from './MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem, type MemoryDevelopmentState } from '../developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric, type P62Frame } from './P62MemoryFabric.ts';
import { SemanticMemoryGraph } from './SemanticMemoryGraph.ts';
import { MemoryPolicyOutcomeLedger, defaultMemoryPolicyOutcomeLedger, type MemoryPolicyDelayedOutcome } from '../system/MemoryPolicyOutcomeLedger.ts';

export type MemoryLifecycleEncodeInput = Omit<MemoryItem2,'id'|'createdAt'|'lastAccessAt'|'retrievalCount'|'revisionHistory'|'dormant'|'semanticVector'|'temperature01'> & { id?: string };
type EncodeInput = MemoryLifecycleEncodeInput;

export type MemoryLifecycleAction = 'encode'|'revise-status'|'revise-content'|'update-signals'|'update-context'|'forget'|'rollback-created';
export type MemoryLifecycleCommand =
  | { action:'encode'; input:EncodeInput; commandId?:string; tick?:number; emitEvent?:boolean; syncCompatibility?:boolean; forceDistinct?:boolean }
  | { action:'revise-status'; id:string; to:MemoryItem2['epistemicStatus']; reason:string; commandId?:string; tick?:number }
  | { action:'revise-content'; id:string; newContent:string; options?:Parameters<MemoryOS2['reviseContent']>[2]; commandId?:string; tick?:number }
  | { action:'update-signals'; id:string; patch:Parameters<MemoryOS2['updateSignals']>[1]; reason?:string; commandId?:string; tick?:number }
  | { action:'update-context'; id:string; patch:Record<string,string|undefined>; commandId?:string; tick?:number }
  | { action:'forget'; id:string; reason?:string; commandId?:string; tick?:number }
  | { action:'rollback-created'; id:string; exportId:string; stagingId:string; attempt:number; reason?:string; commandId?:string; tick?:number };

interface MemoryLifecycleReceipt {
  commandId:string;
  fingerprint:string;
  action:MemoryLifecycleAction;
  at:number;
  outcome:'applied'|'noop';
  resultKind:'memory'|'context'|'boolean'|'void'|'null';
  memoryId?:string;
  booleanValue?:boolean;
}

export class MemoryLifecycleCommandConflictError extends Error {
  constructor(commandId:string){super(`Memory lifecycle command ID was replayed with a different payload: ${commandId}`);this.name='MemoryLifecycleCommandConflictError';}
}

/** A receipt aged out of the hot journal. Refuse ambiguous retries instead of silently repeating a mutation. */
export class MemoryLifecycleCommandRecoveryRequiredError extends Error {
  constructor(commandId:string){super(`Memory lifecycle command ${commandId} may have been committed before its hot receipt expired; reconcile before retrying.`);this.name='MemoryLifecycleCommandRecoveryRequiredError';}
}

function stableCommandJson(value:any):string {
  if(Array.isArray(value))return `[${value.map(stableCommandJson).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${stableCommandJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export interface MemoryFabricConfig {
  maxHotItems?: number;
  maxRecentEvents?: number;
  compatibilityRefreshEvery?: number;
}

export interface MemoryFabricSnapshot {
  version: 2;
  /** Bloom tombstones preserve fail-closed knowledge of command IDs evicted from the 512-entry hot ledger. */
  retiredMutationReceiptBloom?: string;
  retiredMutationReceiptCount?: number;
  retiredMutationReceiptBloomCorrupt?: boolean;
  stats: {
    encodes: number;
    newItems: number;
    reconsolidations: number;
    retrievals: number;
    retrievalHits: number;
    maintenanceRuns: number;
    compatibilityProjections: number;
  };
  hotIds: string[];
  residency?: { counts:{hot:number;warm:number;cold:number}; targetItems:number; materializedVectors:number };
  policyOutcomeLedger?: ReturnType<MemoryPolicyOutcomeLedger['snapshot']>;
  /** Persisted command receipts prevent the same external mutation from replaying after restore. */
  mutationReceipts?: MemoryLifecycleReceipt[];
}

export interface MemoryFabricRestore {
  retiredMutationReceiptBloom?: string;
  retiredMutationReceiptCount?: number;
  retiredMutationReceiptBloomCorrupt?: boolean;
  stats?: Partial<MemoryFabricSnapshot['stats']>;
  hotIds?: string[];
  policyOutcomeLedger?: ReturnType<MemoryPolicyOutcomeLedger['snapshot']>;
  /** Persisted command receipts prevent the same external mutation from replaying after restore. */
  mutationReceipts?: MemoryLifecycleReceipt[];
}

const clampInt=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.floor(Number.isFinite(x)?x:min)));
const RETIRED_RECEIPT_BLOOM_BYTES=128*1024;
const RETIRED_RECEIPT_BLOOM_BITS=RETIRED_RECEIPT_BLOOM_BYTES*8;
const RETIRED_RECEIPT_BLOOM_HASHES=7;
const BASE64_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encodeBase64Bytes(bytes:Uint8Array):string {
  let out='';
  for(let i=0;i<bytes.length;i+=3){
    const a=bytes[i]??0,b=bytes[i+1]??0,c=bytes[i+2]??0;
    out+=BASE64_ALPHABET[a>>2]+BASE64_ALPHABET[((a&3)<<4)|(b>>4)]+(i+1<bytes.length?BASE64_ALPHABET[((b&15)<<2)|(c>>6)]:'=')+(i+2<bytes.length?BASE64_ALPHABET[c&63]:'=');
  }
  return out;
}
function decodeBase64Bytes(value:string):Uint8Array {
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(value))throw new Error('invalid-base64');
  const padding=value.endsWith('==')?2:value.endsWith('=')?1:0;
  const out=new Uint8Array(Math.max(0,(value.length/4)*3-padding));
  let offset=0;
  for(let i=0;i<value.length;i+=4){
    const a=BASE64_ALPHABET.indexOf(value[i]??'A'),b=BASE64_ALPHABET.indexOf(value[i+1]??'A'),c=value[i+2]==='='?0:BASE64_ALPHABET.indexOf(value[i+2]??'A'),d=value[i+3]==='='?0:BASE64_ALPHABET.indexOf(value[i+3]??'A');
    const n=(a<<18)|(b<<12)|(c<<6)|d;
    if(offset<out.length)out[offset++]=(n>>16)&255;
    if(offset<out.length)out[offset++]=(n>>8)&255;
    if(offset<out.length)out[offset++]=n&255;
  }
  if(encodeBase64Bytes(out)!==value)throw new Error('non-canonical-base64');
  return out;
}

/**
 * Unified memory coordinator. MemoryOS2 remains the single durable authority.
 * Other memory stores are compatibility/read models and are never promoted to
 * a second source of truth by this class.
 */
export class MemoryFabric {
  private readonly config:Required<MemoryFabricConfig>;
  private readonly hotIds:string[]=[];
  private readonly statsData={encodes:0,newItems:0,reconsolidations:0,retrievals:0,retrievalHits:0,maintenanceRuns:0,compatibilityProjections:0};
  private readonly memoryOS:MemoryOS2;
  private readonly events:EventLog;
  private readonly multiTimescale:MultiTimescaleMemory;
  private readonly substrate:MemorySubstrateCoordinator;
  private readonly unifiedMemory:UnifiedMemorySystem;
  private readonly p62:P62MemoryFabric;
  private readonly semanticMemory:SemanticMemoryGraph;
  private lastMaintenanceTick=-1;
  private readonly policyOutcomeLedger=defaultMemoryPolicyOutcomeLedger();
  private readonly mutationReceipts=new Map<string,MemoryLifecycleReceipt>();
  private retiredMutationReceiptBloom=new Uint8Array(RETIRED_RECEIPT_BLOOM_BYTES);
  private retiredMutationReceiptCount=0;
  private retiredMutationReceiptBloomCorrupt=false;
  private cognitionSemanticInFlight:Promise<Awaited<ReturnType<MemoryOS2['previewRetrieveWithEmbeddings']>>>|null=null;
  private semanticMaintenanceInFlight:Promise<SemanticIndexMaintenanceResult>|null=null;
  private lastSemanticMaintenanceStartedAt=0;
  private lastCognitiveMemoryQueryAt=0;
  private lastPolicyDecisionId:string|undefined;
  private readonly maxMutationReceipts=512;

  constructor(
    memoryOS:MemoryOS2,
    events:EventLog,
    multiTimescale:MultiTimescaleMemory,
    substrate:MemorySubstrateCoordinator,
    unifiedMemory:UnifiedMemorySystem,
    p62:P62MemoryFabric,
    semanticMemory:SemanticMemoryGraph,
    config:MemoryFabricConfig={}
  ) {
    this.memoryOS=memoryOS;
    this.events=events;
    this.multiTimescale=multiTimescale;
    this.substrate=substrate;
    this.unifiedMemory=unifiedMemory;
    this.p62=p62;
    this.semanticMemory=semanticMemory;
    this.config={
      maxHotItems:clampInt(config.maxHotItems??32,8,96),
      maxRecentEvents:clampInt(config.maxRecentEvents??96,32,320),
      compatibilityRefreshEvery:clampInt(config.compatibilityRefreshEvery??8,1,64),
    };
  }

  /**
   * The single mutation boundary for canonical memory. Callers that may replay
   * after retries/restart supply commandId; the bounded receipt ledger then
   * makes the side effect and lifecycle event idempotent across snapshot/restore.
   * MemoryOS2 remains the only writable store; projections are updated explicitly.
   */
  applyLifecycleCommand(command:MemoryLifecycleCommand):MemoryItem2|Record<string,string>|boolean|void|null {
    const action=command.action;
    // Command IDs are idempotency keys, not display text. Normalizing or truncating
    // them can alias two distinct mutations to one cached receipt; reject malformed
    // caller input before fingerprinting, reading state, or performing any write.
    const rawCommandId:unknown=(command as {commandId?:unknown}).commandId;
    let commandId='';
    if(rawCommandId!==undefined){
      if(typeof rawCommandId!=='string'||rawCommandId.length===0||rawCommandId.length>128||
        rawCommandId!==rawCommandId.trim()||/[\u0000-\u001f\u007f-\u009f]/u.test(rawCommandId)){
        throw new TypeError('memory-lifecycle-command-id-invalid');
      }
      commandId=rawCommandId;
    }
    const semanticPayload:any={...command};
    delete semanticPayload.commandId; delete semanticPayload.tick;
    delete semanticPayload.emitEvent; delete semanticPayload.syncCompatibility;
    const fingerprint=createHash('sha256').update(stableCommandJson(semanticPayload)).digest('hex');
    if(commandId){
      const prior=this.mutationReceipts.get(commandId);
      if(prior){
        if(prior.fingerprint!==fingerprint||prior.action!==action)throw new MemoryLifecycleCommandConflictError(commandId);
        return this.replayMutationReceipt(prior);
      }
      // A Bloom tombstone cannot recover the result, but it can prove (or conservatively
      // suspect) that this key was used after its exact receipt left the hot journal.
      // Fail closed; never silently execute a possibly committed mutation again.
      if(this.retiredMutationReceiptBloomCorrupt||this.mightHaveRetiredMutationReceipt(commandId))
        throw new MemoryLifecycleCommandRecoveryRequiredError(commandId);
    }

    let result:MemoryItem2|Record<string,string>|boolean|void|null=null;
    let outcome:'applied'|'noop'='noop';
    let memoryId:string|undefined;
    let booleanValue:boolean|undefined;
    let eventPayload:Record<string,unknown>|undefined;
    const tick=Number.isFinite(command.tick)?Math.floor(Number(command.tick)):0;

    switch(action){
      case 'encode': {
        this.statsData.encodes++;
        const before=this.memoryOS.size();
        const item=this.memoryOS.encode(command.input,{clone:false,forceDistinct:command.forceDistinct===true});
        const created=this.memoryOS.size()>before;
        if(created)this.statsData.newItems++; else this.statsData.reconsolidations++;
        this.touchHot(item.id);
        result=item; memoryId=item.id; outcome='applied';
        eventPayload={memoryId:item.id,kind:item.kind,source:item.source,created,action:created?'encode':'reconsolidate',commandId:commandId||undefined};
        if(command.syncCompatibility)this.projectCompatibility(32);
        if(command.emitEvent===false)eventPayload=undefined;
        break;
      }
      case 'revise-status': {
        const before=this.findCanonical(command.id);
        if(before&&before.epistemicStatus!==command.to){
          this.memoryOS.revise(command.id,command.to,command.reason);
          result=undefined; memoryId=command.id; outcome='applied';
          eventPayload={action, memoryId, from:before.epistemicStatus,to:command.to,reason:String(command.reason).slice(0,240),commandId:commandId||undefined};
        }else{result=undefined;memoryId=before?.id;}
        break;
      }
      case 'revise-content': {
        const before=this.findCanonical(command.id);
        const item=this.memoryOS.reviseContent(command.id,command.newContent,command.options??{});
        result=item; memoryId=item?.id;
        outcome=item&&before&&(item.id!==before.id||item.content!==before.content)?'applied':'noop';
        if(item){this.touchHot(item.id);if(outcome==='applied')eventPayload={action,sourceMemoryId:command.id,memoryId:item.id,revisionGroupId:item.revisionGroupId,revisionSequence:item.revisionSequence,reason:String(command.options?.reason??'content-revision').slice(0,240),commandId:commandId||undefined};}
        break;
      }
      case 'update-signals': {
        const before=this.findCanonical(command.id);
        const changed=Boolean(before&&Object.entries(command.patch).some(([key,value])=>(before as any)[key]!==value));
        if(!before){result=null;break;}
        if(!changed){result=before;memoryId=before.id;break;}
        const item=this.memoryOS.updateSignals(command.id,command.patch,command.reason??'reconsolidation');
        result=item; memoryId=item?.id;
        outcome=item?'applied':'noop';
        if(item)eventPayload={action,memoryId:item.id,fields:Object.keys(command.patch),reason:String(command.reason??'reconsolidation').slice(0,240),commandId:commandId||undefined};
        break;
      }
      case 'update-context': {
        const before=this.findCanonical(command.id);
        if(!before){result=null;break;}
        const changedEntries=Object.entries(command.patch).filter(([key,value])=>value!==undefined&&value!==''&&before.context?.[key]!==String(value));
        if(!changedEntries.length){result=structuredClone(before.context??{});memoryId=before.id;break;}
        const context=this.memoryOS.updateContext(command.id,Object.fromEntries(changedEntries));
        result=context; memoryId=before.id;
        outcome=context?'applied':'noop';
        if(context)eventPayload={action,memoryId:before.id,fields:changedEntries.map(([key])=>key),commandId:commandId||undefined};
        break;
      }
      case 'rollback-created': {
        if(!commandId)throw new Error('memory-lifecycle-hmx-rollback-command-id-required');
        const before=this.findCanonical(command.id);
        if(!before){
          // Compensation is idempotent: an absent row is already rolled back.
          result=true; booleanValue=true; memoryId=command.id; outcome='noop';
          break;
        }
        if(!String(before.source??'').startsWith('hexis:')||
          before.context?.hexisExportId!==command.exportId||
          before.context?.hexisImportStageId!==command.stagingId||
          before.context?.hexisImportAttempt!==String(command.attempt)){
          throw new Error('memory-lifecycle-hmx-rollback-scope-mismatch');
        }
        const removed=this.memoryOS.rollbackCreatedHmxImport(command.id,command.exportId,command.stagingId,command.attempt);
        if(!removed&&this.findCanonical(command.id))throw new Error('memory-lifecycle-hmx-rollback-not-applied');
        result=true; booleanValue=true; memoryId=command.id; outcome=removed?'applied':'noop';
        this.hotIds.splice(0,this.hotIds.length,...this.hotIds.filter(id=>id!==command.id));
        eventPayload={action,memoryId:command.id,exportId:command.exportId,stagingId:command.stagingId,attempt:command.attempt,reason:String(command.reason??'hmx-apply-rollback').slice(0,240),commandId:commandId||undefined};
        break;
      }
      case 'forget': {
        const forgotten=this.memoryOS.forgetById(command.id,command.reason??'memory-knockout');
        result=forgotten; booleanValue=forgotten;memoryId=command.id;outcome=forgotten?'applied':'noop';
        if(forgotten){this.hotIds.splice(0,this.hotIds.length,...this.hotIds.filter(id=>id!==command.id));eventPayload={action,memoryId:command.id,reason:String(command.reason??'memory-knockout').slice(0,240),commandId:commandId||undefined};}
        break;
      }
    }

    if(eventPayload){
      if(action==='encode')this.events.append(makeEvent('memory-created',tick,eventPayload));
      else this.events.append(makeEvent('memory-lifecycle',tick,eventPayload));
    }
    if(commandId){
      const receipt:MemoryLifecycleReceipt={commandId,fingerprint,action,at:Date.now(),outcome,
        resultKind:action==='update-context'&&result&&typeof result==='object'?'context':result&&typeof result==='object'?'memory':typeof result==='boolean'?'boolean':result===null?'null':'void',
        ...(memoryId?{memoryId}:{}),...(booleanValue!==undefined?{booleanValue}:{})};
      this.mutationReceipts.set(commandId,receipt);
      while(this.mutationReceipts.size>this.maxMutationReceipts){
        const oldest=this.mutationReceipts.keys().next().value as string|undefined;
        if(oldest===undefined)break;
        this.retireMutationReceipt(oldest);
        this.mutationReceipts.delete(oldest);
      }
    }
    return result;
  }

  private findCanonical(id:string):MemoryItem2|null {
    const item=this.memoryOS.snapshot({clone:false}).items.find(row=>row.id===String(id));
    return item?structuredClone(item):null;
  }

  private replayMutationReceipt(receipt:MemoryLifecycleReceipt):MemoryItem2|Record<string,string>|boolean|void|null {
    if(receipt.resultKind==='boolean')return Boolean(receipt.booleanValue);
    if(receipt.resultKind==='memory')return receipt.memoryId?this.findCanonical(receipt.memoryId):null;
    if(receipt.resultKind==='context'){const current=receipt.memoryId?this.findCanonical(receipt.memoryId):null;return structuredClone(current?.context??{});}
    if(receipt.resultKind==='null')return null;
    return undefined;
  }

  encode(input:EncodeInput, context:{tick?:number;emitEvent?:boolean;syncCompatibility?:boolean;commandId?:string;forceDistinct?:boolean}={}) {
    return this.applyLifecycleCommand({action:'encode',input,tick:context?.tick,emitEvent:context?.emitEvent,syncCompatibility:context?.syncCompatibility,commandId:context?.commandId,forceDistinct:context?.forceDistinct}) as MemoryItem2;
  }

  /** Non-mutating search for inspectors and diagnostics; it must not train policy or heat live memories. */
  previewRetrieve(query:string,limit=8,goalRelevance=0,identityRelevance=0,context:{temporalMode?:MemoryTemporalQueryOptions['temporalMode'];asOfAt?:number}={}) {
    return this.memoryOS.previewRetrieve(query,Math.max(1,Math.min(32,Math.floor(Number.isFinite(limit)?limit:8))),goalRelevance,identityRelevance,{temporalMode:context.temporalMode,asOfAt:context.asOfAt});
  }

  /** Read-only semantic inspector path; serialize it with cognitive retrieval and background indexing. */
  async previewRetrieveWithEmbeddings(query:string,limit=8,goalRelevance=0,identityRelevance=0,context:{temporalMode?:MemoryTemporalQueryOptions['temporalMode'];asOfAt?:number}={}) {
    // Inspector requests are explicit and may do more work than live cognition, but they
    // must still use the same local embedding provider serially. Wait for already-running
    // work, then claim the shared foreground slot before yielding to another operation.
    while(this.cognitionSemanticInFlight||this.semanticMaintenanceInFlight){
      const pending=this.cognitionSemanticInFlight??this.semanticMaintenanceInFlight;
      if(!pending)break;
      await pending.catch(()=>undefined);
    }
    const work=this.memoryOS.previewRetrieveWithEmbeddings(
      query,
      Math.max(1,Math.min(32,Math.floor(Number.isFinite(limit)?limit:8))),
      goalRelevance,
      identityRelevance,
      {temporalMode:context.temporalMode,asOfAt:context.asOfAt},
    );
    const tracked=work.finally(()=>{if(this.cognitionSemanticInFlight===tracked)this.cognitionSemanticInFlight=null;});
    this.cognitionSemanticInFlight=tracked;
    return tracked;
  }

  /**
   * Bounded semantic recall for the live cognitive cycle. The canonical lexical
   * retrieval is always obtained first. Semantic indexing runs with a small bounded
   * batch and a strict foreground budget; if the provider is cold or busy, the cycle
   * immediately keeps the lexical result while the single in-flight job may warm the
   * derived vector index for subsequent turns.
   */
  async retrieveForCognition(query:string,limit=8,goalRelevance=0,identityRelevance=0,context:{tick?:number;temporalMode?:MemoryTemporalQueryOptions['temporalMode'];asOfAt?:number}={}):Promise<MemoryItem2[]> {
    this.lastCognitiveMemoryQueryAt=Date.now();
    const safeLimit=Math.max(1,Math.min(16,Math.floor(Number.isFinite(limit)?limit:8)));
    const fallback=this.retrieve(query,safeLimit,goalRelevance,identityRelevance,{...context,emitEvent:false});
    const runtimeEnabled=/^(1|true|yes|on)$/i.test(String(process.env.NK_EMBEDDINGS_RUNTIME_ENABLED??''));
    if(!runtimeEnabled||!String(query??'').trim()||!this.memoryOS.embeddingConfigured()) return fallback;

    // Foreground cognition must not compete with low-priority background indexing;
    // lexical retrieval stays available while a bounded maintenance batch warms the index.
    if(this.cognitionSemanticInFlight||this.semanticMaintenanceInFlight) return fallback;
    const providerTimeout=Math.max(500,Math.min(20000,Number(process.env.NK_EMBEDDINGS_TIMEOUT_MS??5000)||5000));
    const work=this.memoryOS.previewRetrieveWithEmbeddings(query,safeLimit,goalRelevance,identityRelevance,
      {temporalMode:context.temporalMode,asOfAt:context.asOfAt},
      {maxIndexItems:12,maxLexicalPool:24,providerTimeoutMs:providerTimeout});
    const tracked=work.finally(()=>{if(this.cognitionSemanticInFlight===tracked)this.cognitionSemanticInFlight=null;});
    this.cognitionSemanticInFlight=tracked;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const budgetMs=Math.max(50,Math.min(1000,Number(process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS??220)||220));
    const outcome=await Promise.race([
      tracked.then(result=>({kind:'complete' as const,result})),
      new Promise<{kind:'timeout'}>(resolve=>{timer=setTimeout(()=>resolve({kind:'timeout'}),budgetMs);}),
    ]);
    if(timer)clearTimeout(timer);
    if(outcome.kind!=='complete'||!outcome.result.semantic.enabled||outcome.result.semantic.fallbackReason) return fallback;
    const rows=outcome.result.items.slice(0,safeLimit);
    for(const row of rows)this.touchHot(row.id);
    const policy=this.memoryOS.adaptivePolicyDiagnostics();
    const decision=this.policyOutcomeLedger.register({policy:policy.lastPolicy,contextKey:policy.lastContextKey,query,memoryIds:rows.map(row=>row.id),at:Date.now(),hit01:rows.length?1:0,computeCost01:this.memoryOS.retrievalDiagnostics().candidateCount/192});
    this.lastPolicyDecisionId=decision.id;
    if(context.tick!==undefined) this.events.append(makeEvent('attention',context.tick,{source:'memory-fabric',query:query.slice(0,120),hits:rows.length,touchedMemoryIds:rows.slice(0,8).map(row=>row.id),evidenceMode:'semantic-cognitive-retrieval'} as any));
    return rows;
  }

  retrieve(query:string,limit=8,goalRelevance=0,identityRelevance=0,context:{tick?:number;emitEvent?:boolean;temporalMode?:MemoryTemporalQueryOptions['temporalMode'];asOfAt?:number}={}) {
    const rows=this.memoryOS.retrieve(query,Math.max(1,Math.min(32,Math.floor(limit))),goalRelevance,identityRelevance,{temporalMode:context.temporalMode,asOfAt:context.asOfAt},false);
    this.statsData.retrievals++;
    this.statsData.retrievalHits+=rows.length;
    const policy=this.memoryOS.adaptivePolicyDiagnostics();
    const decision=this.policyOutcomeLedger.register({policy:policy.lastPolicy,contextKey:policy.lastContextKey,query,memoryIds:rows.map(row=>row.id),at:Date.now(),hit01:rows.length?1:0,computeCost01:this.memoryOS.retrievalDiagnostics().candidateCount/192});
    this.lastPolicyDecisionId=decision.id;
    for(const row of rows)this.touchHot(row.id);
    if(context.emitEvent){
      this.events.append(makeEvent('attention',context.tick??0,{
        source:'memory-fabric',
        query:query.slice(0,160),
        hits:rows.length,
        touchedMemoryIds:rows.slice(0,12).map(row=>row.id),
        evidenceMode:'retrieval-audit',
      }));
    }
    this.unifiedMemory.recordRetrieval(query,rows.length);
    return rows;
  }

  recall(query:string,limit=8):P62Frame {
    const canonical=this.memoryOS.snapshot({clone:false});
    const continuum=this.multiTimescale.retrieve(query,Math.min(16,Math.max(1,limit)),false);
    const frame=this.p62.recall({
      query,
      memoryOS:canonical.items.slice(0,128).map(m=>({id:m.id,content:m.content,kind:m.kind,confidence01:m.confidence,salience01:m.salience,source:m.source,status:m.epistemicStatus})),
      multiTimescale:continuum.map(m=>({id:m.id,content:m.summary,kind:m.kind,confidence01:m.confidence,salience01:m.salience,source:'multi-timescale'})),
      semanticNodes:this.semanticMemory.retrieve(query,Math.min(8,Math.max(1,limit)),false).map(x=>({id:x.id,label:x.label,type:x.type,salience:x.salience})),
      beliefs:this.unifiedMemory.snapshot().beliefs,
      maxItems:Math.max(1,Math.min(12,limit)),
    });
    return frame;
  }

  maintain(options:{pressure01?:number;maxItems?:number;tick?:number;force?:boolean;hotBudget?:number;warmBudget?:number;coldBudget?:number;identityTension01?:number;byteBudget?:number;protectedIds?:string[]}={}) {
    const tick=Number.isFinite(options.tick)?Number(options.tick):-1;
    if(!options.force && tick>=0 && tick===this.lastMaintenanceTick)return {skipped:true,changed:0};
    const before=this.memoryOS.size();
    this.memoryOS.maintain({pressure01:options.pressure01,maxItems:options.maxItems});
    const byteBudget=Math.max(262144,Math.min(1048576,Math.floor(options.byteBudget??Math.max(262144,Math.min(1048576,Math.floor((options.maxItems??768)*720))))));
    const byteBudgetResult=this.memoryOS.enforceByteBudget({maxBytes:byteBudget,tick,protectedIds:options.protectedIds,reason:'memory-fabric-byte-budget'});
    if(options.hotBudget!==undefined||options.warmBudget!==undefined||options.coldBudget!==undefined||options.identityTension01!==undefined) this.memoryOS.applyResidencyPlan({hotBudget:options.hotBudget,warmBudget:options.warmBudget,coldBudget:options.coldBudget,pressure01:options.pressure01,identityTension01:options.identityTension01});
    this.lastMaintenanceTick=tick;
    this.statsData.maintenanceRuns++;
    this.scheduleSemanticIndexMaintenance();
    const changed=Math.max(0,before-this.memoryOS.size());
    const totalChanged=changed;
    if(totalChanged||options.force)this.events.append(makeEvent('memory-lifecycle',tick,{source:'memory-fabric',before,after:this.memoryOS.size(),changed:totalChanged,capacityChanged:changed,byteBudget,byteBudgetEvictions:byteBudgetResult.evicted.length,estimatedBytes:byteBudgetResult.usedBytes,pressure01:options.pressure01??0} as Record<string,unknown>));
    return {skipped:false,changed:totalChanged,byteBudget:byteBudgetResult};
  }

  private scheduleSemanticIndexMaintenance(){
    const enabled=/^(1|true|yes|on)$/i.test(String(process.env.NK_EMBEDDINGS_RUNTIME_ENABLED??''));
    const now=Date.now();
    if(!enabled||!this.memoryOS.embeddingConfigured()||this.cognitionSemanticInFlight||this.semanticMaintenanceInFlight)return;
    // Do not launch background work during active recall; cap one batch per 1.5 seconds.
    if(now-this.lastCognitiveMemoryQueryAt<1000||now-this.lastSemanticMaintenanceStartedAt<1500)return;
    this.lastSemanticMaintenanceStartedAt=now;
    const work=this.memoryOS.maintainSemanticIndexBatch({maxItems:8,providerTimeoutMs:1800,now});
    const tracked=work.finally(()=>{if(this.semanticMaintenanceInFlight===tracked)this.semanticMaintenanceInFlight=null;});
    this.semanticMaintenanceInFlight=tracked;
  }

  semanticEmbeddingMaintenanceDiagnostics(){
    return {...this.memoryOS.semanticEmbeddingMaintenanceDiagnostics(),runtimeEnabled:/^(1|true|yes|on)$/i.test(String(process.env.NK_EMBEDDINGS_RUNTIME_ENABLED??'')),maintenanceInFlight:Boolean(this.semanticMaintenanceInFlight)};
  }

  memoryConflictDiagnostics(){ return this.memoryOS.implicitConflictDiagnostics(); }
  reconcileImplicitMemoryConflicts(options:{limit?:number;pairBudget?:number;at?:number}={}){ return this.memoryOS.adjudicateImplicitConflicts(options); }

  projectCompatibility(limit=48) {
    const rows=this.substrate.projectCompatibilityRecords(this.memoryOS.snapshot({clone:false}),limit);
    this.statsData.compatibilityProjections++;
    for(const row of rows)this.multiTimescale.add(row,false);
    return rows.length;
  }

  ingestCompatibility(row:MemoryRecord, tick=0, commandId?:string) {
    const input=this.substrate.compatibilityInput(row);
    const replayKey=commandId??`compatibility-ingest:${String(row.id).slice(0,72)}:${createHash('sha256').update(stableCommandJson(input)).digest('hex').slice(0,20)}`;
    return this.encode(input,{tick,commandId:replayKey});
  }

  /** Import legacy/multi-timescale rows through the canonical mutation boundary. */
  consolidateCompatibility(rows:MemoryRecord[],limit=32,tick=0) {
    const inputs=this.substrate.compatibilityInputs(rows,limit);
    let ingested=0;
    for(let index=0;index<inputs.length;index++){
      const input=inputs[index]!;
      const originalId=String(input.context?.originalId??index).slice(0,96);
      const inputHash=createHash('sha256').update(stableCommandJson(input)).digest('hex').slice(0,20);
      const item=this.encode(input,{tick,commandId:`compatibility-restore:${originalId}:${inputHash}`});
      if(item?.id)ingested++;
    }
    return ingested;
  }

  compactRecentEvents(max=this.config.maxRecentEvents) {
    const bounded=Math.max(32,Math.min(320,Math.floor(max)));
    const recent=this.events.recent(bounded,false);
    const counts=new Map<string,number>();
    for(const event of recent)counts.set(event.type,(counts.get(event.type)??0)+1);
    return {
      retained:recent.length,
      oldestTick:recent[0]?.tick??0,
      newestTick:recent.at(-1)?.tick??0,
      types:Object.fromEntries(counts),
    };
  }

  hotIdsSnapshot(){return [...this.hotIds];}

  private retiredMutationReceiptIndexes(commandId:string):number[]{
    const hash=createHash('sha256').update('neuro-kurisu-memory-lifecycle-retired-command-v1\0').update(commandId).digest();
    const indexes:number[]=[];
    for(let i=0;i<RETIRED_RECEIPT_BLOOM_HASHES;i++)indexes.push(hash.readUInt32BE(i*4)&(RETIRED_RECEIPT_BLOOM_BITS-1));
    return indexes;
  }

  private retireMutationReceipt(commandId:string):void {
    for(const bit of this.retiredMutationReceiptIndexes(commandId))this.retiredMutationReceiptBloom[bit>>>3]|=1<<(bit&7);
    this.retiredMutationReceiptCount++;
  }

  private mightHaveRetiredMutationReceipt(commandId:string):boolean {
    return this.retiredMutationReceiptIndexes(commandId).every(bit=>(this.retiredMutationReceiptBloom[bit>>>3]&(1<<(bit&7)))!==0);
  }

  snapshot():MemoryFabricSnapshot {
    return {
      version:2,stats:{...this.statsData},hotIds:[...this.hotIds],residency:this.memoryOS.residencyDiagnostics(),
      policyOutcomeLedger:this.policyOutcomeLedger.snapshot(),mutationReceipts:[...this.mutationReceipts.values()].slice(-this.maxMutationReceipts).map(row=>({...row})),
      ...(this.retiredMutationReceiptCount?{retiredMutationReceiptBloom:encodeBase64Bytes(this.retiredMutationReceiptBloom),retiredMutationReceiptCount:this.retiredMutationReceiptCount}:{}),
      ...(this.retiredMutationReceiptBloomCorrupt?{retiredMutationReceiptBloomCorrupt:true}:{}),
    };
  }

  restore(raw:MemoryFabricRestore|undefined){
    if(!raw)return;
    Object.assign(this.statsData,{...this.statsData,...raw.stats});
    this.hotIds.length=0;this.hotIds.push(...(raw.hotIds??[]).slice(0,this.config.maxHotItems));
    this.policyOutcomeLedger.restore(raw.policyOutcomeLedger);
    this.mutationReceipts.clear();
    this.retiredMutationReceiptBloom=new Uint8Array(RETIRED_RECEIPT_BLOOM_BYTES);
    const rawReceiptCount=raw.retiredMutationReceiptCount;
    const validReceiptCount=rawReceiptCount===undefined||(typeof rawReceiptCount==='number'&&Number.isSafeInteger(rawReceiptCount)&&rawReceiptCount>=0);
    this.retiredMutationReceiptCount=validReceiptCount?(rawReceiptCount??0):0;
    this.retiredMutationReceiptBloomCorrupt=raw.retiredMutationReceiptBloomCorrupt===true||!validReceiptCount;
    if(raw.retiredMutationReceiptBloom!==undefined&&typeof raw.retiredMutationReceiptBloom!=='string')this.retiredMutationReceiptBloomCorrupt=true;
    if(typeof raw.retiredMutationReceiptBloom==='string'){
      try{
        const decoded=decodeBase64Bytes(raw.retiredMutationReceiptBloom);
        if(decoded.byteLength!==RETIRED_RECEIPT_BLOOM_BYTES)throw new Error('invalid-bloom');
        this.retiredMutationReceiptBloom.set(decoded);
      }catch{this.retiredMutationReceiptBloomCorrupt=true;}
    }else if(this.retiredMutationReceiptCount>0){
      this.retiredMutationReceiptBloomCorrupt=true;
    }
    const rawReceipts=raw.mutationReceipts;
    if(rawReceipts!==undefined&&!Array.isArray(rawReceipts))this.retiredMutationReceiptBloomCorrupt=true;
    if(Array.isArray(rawReceipts)&&rawReceipts.length>this.maxMutationReceipts)this.retiredMutationReceiptBloomCorrupt=true;
    const validReceipt=(row:any):boolean=>{
      if(!row||typeof row.commandId!=='string'||row.commandId.length===0||row.commandId.length>128||
        row.commandId!==row.commandId.trim()||/[\u0000-\u001f\u007f-\u009f]/.test(row.commandId)||
        typeof row.fingerprint!=='string'||!/^[a-f0-9]{64}$/i.test(row.fingerprint)||
        !['encode','revise-status','revise-content','update-signals','update-context','forget','rollback-created'].includes(row.action)||
        !['memory','context','boolean','void','null'].includes(row.resultKind)||!['applied','noop'].includes(row.outcome)||
        typeof row.at!=='number'||!Number.isFinite(row.at)||row.at<0||
        (row.memoryId!==undefined&&(typeof row.memoryId!=='string'||!row.memoryId||row.memoryId.length>256||/[\u0000-\u001f\u007f-\u009f]/.test(row.memoryId)))||
        (row.booleanValue!==undefined&&typeof row.booleanValue!=='boolean'))return false;
      if((row.resultKind==='memory'||row.resultKind==='context')&&(typeof row.memoryId!=='string'||!row.memoryId))return false;
      if(row.resultKind==='boolean'&&typeof row.booleanValue!=='boolean')return false;
      if(row.resultKind!=='boolean'&&row.booleanValue!==undefined)return false;
      return true;
    };
    const conflictingReceiptIds=new Set<string>();
    for(const row of (Array.isArray(rawReceipts)?rawReceipts:[]).slice(-this.maxMutationReceipts)){
      if(!validReceipt(row)){this.retiredMutationReceiptBloomCorrupt=true;continue;}
      const commandId=row.commandId;
      const normalized={...row,commandId,fingerprint:row.fingerprint.toLowerCase(),at:Math.floor(row.at)};
      if(conflictingReceiptIds.has(commandId)){this.retiredMutationReceiptBloomCorrupt=true;continue;}
      const prior=this.mutationReceipts.get(commandId);
      if(prior){
        // Any duplicated command identity is outside the snapshot contract; even a byte-identical
        // duplicate makes the replay journal uncertain. Never retain a receipt for that key.
        this.mutationReceipts.delete(commandId);
        conflictingReceiptIds.add(commandId);
        this.retiredMutationReceiptBloomCorrupt=true;
        continue;
      }
      this.mutationReceipts.set(commandId,normalized);
    }
  }


  resolveAdaptivePolicyOutcome(input:{memoryId:string;validationAt:number;retentionScore01:number;transferPotential01:number;interferenceRisk01:number;causalCredit01:number;independentVerified:boolean;decisionId?:string}){
    const outcome=this.policyOutcomeLedger.resolve(input);
    if(!outcome)return null;
    // Candidate scores from an unverified replay are audit data, not a learning
    // target. Only independently verified outcomes update adaptive policy state.
    if(outcome.independentVerified)this.memoryOS.observeRetrievalOutcomeV2(outcome,outcome.policy);
    return outcome;
  }
  adaptivePolicyOutcomeDiagnostics(){return {...this.policyOutcomeLedger.diagnostics(),lastPolicyDecisionId:this.lastPolicyDecisionId};}
  lastAdaptivePolicyDecisionId(){return this.lastPolicyDecisionId??null;}
  retrieveWithPolicyDecision(query:string,limit=8,goalRelevance=0,identityRelevance=0,context:{tick?:number;emitEvent?:boolean}={}){
    const rows=this.retrieve(query,limit,goalRelevance,identityRelevance,context);
    return {decisionId:this.lastPolicyDecisionId??null,rows};
  }

  revise(id:string,to:MemoryItem2['epistemicStatus'],reason:string,options:{tick?:number;commandId?:string}={}){
    return this.applyLifecycleCommand({action:'revise-status',id,to,reason,tick:options?.tick,commandId:options?.commandId}) as void;
  }

  reviseContent(id:string,newContent:string,options:Parameters<MemoryOS2['reviseContent']>[2]={},context:{tick?:number;commandId?:string}={}){
    return this.applyLifecycleCommand({action:'revise-content',id,newContent,options,tick:context?.tick,commandId:context?.commandId}) as MemoryItem2|null;
  }

  updateSignals(id:string, patch:Parameters<MemoryOS2['updateSignals']>[1], reason='reconsolidation', context:{tick?:number;commandId?:string}={}){
    return this.applyLifecycleCommand({action:'update-signals',id,patch,reason,tick:context?.tick,commandId:context?.commandId}) as MemoryItem2|null;
  }

  updateContext(id:string, patch:Record<string,string|undefined>, context:{tick?:number;commandId?:string}={}){
    return this.applyLifecycleCommand({action:'update-context',id,patch,tick:context?.tick,commandId:context?.commandId}) as Record<string,string> | null;
  }

  markDormant(id:string,dormant=true,reason='memory-economy',context:{tick?:number;commandId?:string}={}){
    return this.updateSignals(id,{dormant},reason,context);
  }

  forgetById(id:string,reason='memory-knockout',context:{tick?:number;commandId?:string}={}){
    return this.applyLifecycleCommand({action:'forget',id,reason,tick:context?.tick,commandId:context?.commandId}) as boolean;
  }

  /** Scoped compensation for a newly-created HMX row when ordinary forgetting correctly
   * refuses protected states (quarantined/identity). The export check prevents touching native memory.
   */
  rollbackHmxCreatedMemory(id:string,exportId:string,stagingId:string,attempt:number,reason='hmx-apply-rollback',context:{tick?:number;commandId?:string}={}):boolean {
    if(typeof id!=='string'||!id||id.length>256||/[\u0000-\u001f\u007f-\u009f]/u.test(id)||
      typeof exportId!=='string'||!/^exp_[a-f0-9]{16}$/.test(exportId)||
      typeof stagingId!=='string'||!stagingId||stagingId.length>512||stagingId!==stagingId.trim()||/[\u0000-\u001f\u007f-\u009f]/u.test(stagingId)||
      !Number.isSafeInteger(attempt)||attempt<1){
      throw new TypeError('memory-lifecycle-hmx-rollback-input-invalid');
    }
    // The scope arguments are authority-bearing. Only copy the explicitly supported
    // execution metadata from context; a JavaScript caller can pass extra runtime keys
    // despite the TypeScript shape, and must not be able to override id/export/stage/attempt.
    const commandContext=context&&typeof context==='object'?context:{};
    return this.applyLifecycleCommand({
      action:'rollback-created',id,exportId,stagingId,attempt,reason,
      ...(commandContext.commandId!==undefined?{commandId:commandContext.commandId}:{}),
      ...(commandContext.tick!==undefined?{tick:commandContext.tick}:{}),
    }) as boolean;
  }

  canonicalSize(){return this.memoryOS.size();}
  canonicalSnapshot(clone=true){return this.memoryOS.snapshot({clone});}

  inspect(){
    const canonical=this.memoryOS.snapshot({clone:false});
    const compatibility=this.multiTimescale.snapshot({clone:false});
    return {
      canonicalAuthority:'memoryOS2' as const,
      canonicalItems:canonical.items.length,
      compatibilityItems:compatibility.length,
      hotItems:this.hotIds.length,
      stats:{...this.statsData},
      eventWindow:this.compactRecentEvents(),
      mutationReceiptJournal:{count:this.mutationReceipts.size,capacity:this.maxMutationReceipts,retiredCount:this.retiredMutationReceiptCount,tombstoneBytes:this.retiredMutationReceiptCount?RETIRED_RECEIPT_BLOOM_BYTES:0,corrupt:this.retiredMutationReceiptBloomCorrupt},
    };
  }

  private touchHot(id:string){
    const i=this.hotIds.indexOf(id);if(i>=0)this.hotIds.splice(i,1);
    this.hotIds.unshift(id);
    if(this.hotIds.length>this.config.maxHotItems)this.hotIds.length=this.config.maxHotItems;
  }
}

export function isMemoryFabricSnapshot(value:unknown):value is MemoryFabricSnapshot {
  const x=value as MemoryFabricSnapshot|undefined;
  return Boolean(x&&x.version===2&&x.stats&&Array.isArray(x.hotIds));
}
