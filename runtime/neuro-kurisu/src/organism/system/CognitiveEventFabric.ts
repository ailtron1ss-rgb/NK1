import { sha256Stable } from '../core/StableSerialization.ts';

/**
 * BIG PASS 161 — Unified Cognitive Event Fabric.
 *
 * This is intentionally a thin causal ledger over the existing runtime evidence
 * and organism EventLog. It does not become a second source of truth for memory,
 * world or goals. It only records the causal spine of an operational cycle:
 * observation -> prediction -> action -> outcome -> learning/self update.
 */
export type CognitiveStage = 'observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'self-update'|'tool-action'|'tool-outcome'|'tool-evidence'|'external-evidence'|'tool-reconciliation';

export interface CognitiveEventNode {
  id: string;
  tick: number;
  at: number;
  stage: CognitiveStage;
  source: string;
  parentIds: string[];
  external: boolean;
  confidence01: number;
  payload: Record<string, unknown>;
}

export type OperationalCycleStageName = 'observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'self-update';
export type OperationalCycleStageIds = Partial<Record<OperationalCycleStageName, string | undefined>>;
type OperationalCyclePhaseInput = { source?:string; external?:boolean; confidence01?:number; payload?:Record<string,unknown> };

export interface OperationalCycleLineageCheck {
  tick: number | null;
  complete: boolean;
  integrity01: number;
  missingStages: string[];
  invalidStages: string[];
  missingEdges: string[];
}

export interface ExternalObservationProjectionRef { observationId:string; eventId:string; projectionHash:string; projectedAt:number; }
export interface ToolReceiptRevisionProjectionRef { revisionId:string; eventId:string; projectionHash:string; projectedAt:number; }

export interface ToolReceiptProjectionIndexEntry {
  executionId: string;
  actionEventId: string;
  outcomeEventId: string;
  evidenceEventId: string;
  projectedAt: number;
  /** Hash of the immutable receipt projection input; catches accidental key reuse. */
  projectionHash?: string;
  /** Bounded idempotency references for independent observations linked to this exact execution. */
  externalObservations?:ExternalObservationProjectionRef[];
  /** Append-only authoritative provider receipt revisions for the original execution. */
  receiptRevisions?:ToolReceiptRevisionProjectionRef[];
}

export interface CognitiveEventFabricSnapshot {
  version: 1;
  capacity: number;
  total: number;
  buffered: number;
  linkedParentEvents: number;
  danglingParentLinks: number;
  lineageIntegrity01: number;
  cycleCoverage01: number;
  causalDensity01: number;
  recentTicks: number;
  recent: CognitiveEventNode[];
  /** Bounded replay guard for external tool receipt projections. Older snapshots omit it. */
  receiptProjectionIndex?: ToolReceiptProjectionIndexEntry[];
  /** Small, sanitized causal nodes omitted from the ordinary 96-event snapshot window. */
  receiptEvents?: CognitiveEventNode[];
}

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const isRecord=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object')return false;
  try{return !Array.isArray(value);}catch{return false;}
};
const isPlainRecord=(value:unknown):value is Record<string,unknown>=>{
  if(!isRecord(value))return false;
  try {
    const prototype=Object.getPrototypeOf(value);
    return prototype===Object.prototype||prototype===null;
  } catch {
    // Refuse proxy objects whose prototype cannot be inspected safely.
    return false;
  }
};
function readOwnDataFields(value:unknown,fields:readonly string[]):Record<string,unknown>|null {
  if(!isPlainRecord(value))return null;
  const result:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const field of fields){
    let descriptor:PropertyDescriptor|undefined;
    try { descriptor=Object.getOwnPropertyDescriptor(value,field); }
    catch { return null; }
    if(!descriptor)continue;
    if(!Object.hasOwn(descriptor,'value'))return null;
    result[field]=descriptor.value;
  }
  return result;
}

const isCanonicalCognitiveIdentifier=(value:unknown,maxLength:number):value is string=>
  typeof value==='string'&&value.length>0&&value===value.trim()&&value.length<=maxLength&&!/[\x00-\x1f\x7f-\x9f]/.test(value);

const OMIT_PAYLOAD_VALUE=Symbol('omit-cognitive-payload-value');
const MAX_COGNITIVE_PAYLOAD_DEPTH=32;
const MAX_COGNITIVE_PAYLOAD_NODES=16384;
const MAX_COGNITIVE_PAYLOAD_ARRAY_LENGTH=16384;
const MAX_COGNITIVE_PAYLOAD_KEYS=8192;
const MAX_COGNITIVE_PAYLOAD_TEXT_UNITS=131072;

function clonePayloadValue(
  value:unknown,
  ancestors:Set<object>,
  depth:number,
  budget:{nodes:number;textUnits:number},
):unknown|typeof OMIT_PAYLOAD_VALUE {
  budget.nodes+=1;
  if(budget.nodes>MAX_COGNITIVE_PAYLOAD_NODES) throw new RangeError('cognitive-event-payload-node-limit');
  if(depth>MAX_COGNITIVE_PAYLOAD_DEPTH) throw new RangeError('cognitive-event-payload-depth-limit');
  if(value===null||typeof value==='boolean') return value;
  if(typeof value==='string'){
    budget.textUnits+=value.length;
    if(budget.textUnits>MAX_COGNITIVE_PAYLOAD_TEXT_UNITS)throw new RangeError('cognitive-event-payload-text-budget');
    return value;
  }
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  if(value===undefined||typeof value==='function'||typeof value==='symbol') return OMIT_PAYLOAD_VALUE;
  if(typeof value==='bigint') throw new TypeError('cognitive-event-payload-bigint-not-json-serializable');
  if(typeof value!=='object') return OMIT_PAYLOAD_VALUE;

  if(value instanceof Date) {
    const timestamp=Date.prototype.getTime.call(value);
    return Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;
  }
  if(ancestors.has(value)) throw new TypeError('circular-cognitive-event-payload');
  ancestors.add(value);
  try {
    if(Array.isArray(value)) {
      if(value.length>MAX_COGNITIVE_PAYLOAD_ARRAY_LENGTH) throw new RangeError('cognitive-event-payload-array-limit');
      const output:unknown[]=[];
      for(let index=0;index<value.length;index+=1) {
        const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
        if(!descriptor||!descriptor.enumerable||!('value' in descriptor)) { output.push(null); continue; }
        const cloned=clonePayloadValue(descriptor.value,ancestors,depth+1,budget);
        output.push(cloned===OMIT_PAYLOAD_VALUE?null:cloned);
      }
      return output;
    }

    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null) {
      throw new TypeError('unsupported-cognitive-event-payload-object');
    }
    const descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>;
    const keys=Object.keys(descriptors);
    if(keys.length>MAX_COGNITIVE_PAYLOAD_KEYS) throw new RangeError('cognitive-event-payload-key-limit');
    const output:Record<string,unknown>={};
    for(const key of keys.sort()) {
      if(key.length>512) throw new RangeError('cognitive-event-payload-key-length-limit');
      budget.textUnits+=key.length;
      if(budget.textUnits>MAX_COGNITIVE_PAYLOAD_TEXT_UNITS)throw new RangeError('cognitive-event-payload-text-budget');
      const descriptor=descriptors[key]!;
      if(!descriptor.enumerable||!('value' in descriptor)) continue;
      const cloned=clonePayloadValue(descriptor.value,ancestors,depth+1,budget);
      if(cloned!==OMIT_PAYLOAD_VALUE) Object.defineProperty(output,key,{
        configurable:true,enumerable:true,writable:true,value:cloned,
      });
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

const cleanPayload=(value:unknown):Record<string,unknown>=>{
  if(!isRecord(value)) return {};
  const cloned=clonePayloadValue(value,new Set<object>(),0,{nodes:0,textUnits:0});
  return cloned!==OMIT_PAYLOAD_VALUE&&isRecord(cloned)?cloned:{};
};

function eventEnvelopeFingerprint(event:Pick<CognitiveEventNode,'tick'|'at'|'stage'|'source'|'parentIds'|'external'|'confidence01'|'payload'>):string {
  return sha256Stable({
    tick:event.tick,
    at:event.at,
    stage:event.stage,
    source:event.source,
    parentIds:[...event.parentIds],
    external:event.external,
    confidence01:clamp01(event.confidence01),
    payload:cleanPayload(event.payload),
  });
}

function cloneCognitiveEvent(event:CognitiveEventNode):CognitiveEventNode {
  return {
    ...event,
    parentIds:[...event.parentIds],
    payload:cleanPayload(event.payload),
  };
}
const COGNITIVE_STAGES=new Set<CognitiveStage>(['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update','tool-action','tool-outcome','tool-evidence','external-evidence','tool-reconciliation']);

function assertSynchronousLedgerTransactionResult(value:unknown):void {
  if(value===null||(typeof value!=='object'&&typeof value!=='function'))return;
  const seen=new Set<object>();
  let cursor:object|null=value as object;
  while(cursor!==null){
    if(seen.has(cursor))throw new TypeError('cognitive-event-ledger-transaction-result-prototype-cycle');
    seen.add(cursor);
    let descriptor:PropertyDescriptor|undefined;
    try { descriptor=Object.getOwnPropertyDescriptor(cursor,'then'); }
    catch { throw new TypeError('cognitive-event-ledger-transaction-result-not-inspectable'); }
    if(descriptor){
      // Never invoke a caller-controlled getter while deciding whether a callback
      // crossed the synchronous transaction boundary.
      if(!Object.hasOwn(descriptor,'value'))throw new TypeError('cognitive-event-ledger-transaction-then-accessor');
      if(typeof descriptor.value==='function')throw new TypeError('cognitive-event-ledger-transaction-must-be-synchronous');
      return;
    }
    try { cursor=Object.getPrototypeOf(cursor); }
    catch { throw new TypeError('cognitive-event-ledger-transaction-result-not-inspectable'); }
  }
}
export class CognitiveEventFabric {
  private readonly capacity:number;
  private events:CognitiveEventNode[]=[];
  private total=0;
  private readonly receiptProjectionIndex=new Map<string,ToolReceiptProjectionIndexEntry>();

  constructor(capacity=512){
    this.capacity=Number.isFinite(capacity)
      ?Math.max(128,Math.min(4096,Math.floor(capacity)))
      :512;
  }


  /**
   * Atomically coordinate synchronous work with the event ledger.
   * A thrown validation/evaluation error restores event rows, counters and receipt replay references.
   * Promise/thenable results are rejected so the transaction can never commit before an await.
   */
  withAtomicLedgerTransaction<T>(operation:()=>T):T{
    if(typeof operation!=='function')throw new TypeError('cognitive-event-ledger-transaction-operation-required');
    return this.withAtomicLedgerMutation(()=>{
      const result=operation();
      assertSynchronousLedgerTransactionResult(result);
      return result;
    });
  }
  private withAtomicLedgerMutation<T>(operation:()=>T):T{
    const eventsBefore=this.events.slice();
    const totalBefore=this.total;
    const receiptIndexBefore=[...this.receiptProjectionIndex.entries()];
    try{
      return operation();
    }catch(error){
      this.events=eventsBefore;
      this.total=totalBefore;
      this.receiptProjectionIndex.clear();
      for(const [executionId,entry] of receiptIndexBefore)this.receiptProjectionIndex.set(executionId,entry);
      throw error;
    }
  }

  restore(raw?:Partial<CognitiveEventFabricSnapshot>|null):void{
    // Preserve the historical empty-reset behavior for an absent snapshot. Any supplied
    // object must validate before the live event ledger or receipt index is mutated.
    if(raw===undefined||raw===null){
      this.events=[];
      this.receiptProjectionIndex.clear();
      this.total=0;
      return;
    }
    if(!isPlainRecord(raw))throw new TypeError('invalid-cognitive-event-fabric-snapshot-root');

    let rootDescriptors:Record<string,PropertyDescriptor>;
    try {
      rootDescriptors=Object.getOwnPropertyDescriptors(raw) as Record<string,PropertyDescriptor>;
    } catch {
      throw new TypeError('invalid-cognitive-event-fabric-snapshot-root');
    }
    if(Object.values(rootDescriptors).some(descriptor=>!Object.hasOwn(descriptor,'value'))) {
      throw new TypeError('cognitive-event-fabric-snapshot-root-accessor');
    }
    const rootHas=(key:string)=>Object.hasOwn(rootDescriptors,key);
    const rootValue=(key:string):unknown=>rootHas(key)?rootDescriptors[key]!.value:undefined;
    if(rootHas('version')&&rootValue('version')!==1) {
      throw new RangeError('unsupported-cognitive-event-fabric-snapshot-version');
    }
    if(rootHas('capacity')&&(
      typeof rootValue('capacity')!=='number'||!Number.isSafeInteger(rootValue('capacity'))||
      (rootValue('capacity') as number)<1||(rootValue('capacity') as number)>4096
    ))throw new TypeError('invalid-cognitive-event-fabric-snapshot-capacity');
    if(rootHas('total')&&(
      typeof rootValue('total')!=='number'||!Number.isSafeInteger(rootValue('total'))||(rootValue('total') as number)<0
    ))throw new TypeError('invalid-cognitive-event-fabric-snapshot-total');

    const readSnapshotArray=(key:string,limit:number):unknown[]=>{
      if(!rootHas(key)){
        // 'recent' is the primary persisted ledger. Missing it is a truncated snapshot,
        // not an instruction to erase valid in-memory causal history.
        if(key==='recent')throw new TypeError('invalid-cognitive-event-fabric-snapshot-array:recent');
        return [];
      }
      const candidate=rootValue(key);
      let array=false;
      try { array=Array.isArray(candidate); } catch { /* reject below */ }
      if(!array)throw new TypeError('invalid-cognitive-event-fabric-snapshot-array:'+key);
      let prototype:object|null;
      let descriptors:Record<string,PropertyDescriptor>;
      try {
        prototype=Object.getPrototypeOf(candidate as object);
        descriptors=Object.getOwnPropertyDescriptors(candidate as object) as Record<string,PropertyDescriptor>;
      } catch {
        throw new TypeError('invalid-cognitive-event-fabric-snapshot-array:'+key);
      }
      if(prototype!==Array.prototype)throw new TypeError('invalid-cognitive-event-fabric-snapshot-array:'+key);
      const lengthDescriptor=descriptors.length;
      if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||
        typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||
        lengthDescriptor.value<0||lengthDescriptor.value>limit) {
        throw new RangeError('invalid-cognitive-event-fabric-snapshot-array-length:'+key);
      }
      const length=lengthDescriptor.value;
      for(const ownKey of Object.keys(descriptors)){
        if(ownKey==='length')continue;
        if(!/^(0|[1-9]\d*)$/.test(ownKey)||Number(ownKey)>=length) {
          throw new TypeError('invalid-cognitive-event-fabric-snapshot-array-key:'+key);
        }
      }
      const result:unknown[]=[];
      for(let index=0;index<length;index+=1){
        const descriptor=descriptors[String(index)];
        if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')) {
          throw new TypeError('invalid-cognitive-event-fabric-snapshot-array-slot:'+key);
        }
        result.push(descriptor.value);
      }
      return result;
    };
    const readDataRecord=(candidate:unknown,fields:readonly string[]):Record<string,unknown>|null=>{
      if(!isPlainRecord(candidate))return null;
      let descriptors:Record<string,PropertyDescriptor>;
      try { descriptors=Object.getOwnPropertyDescriptors(candidate) as Record<string,PropertyDescriptor>; }
      catch { return null; }
      const values:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
      for(const field of fields){
        const descriptor=descriptors[field];
        if(!descriptor)continue;
        if(!Object.hasOwn(descriptor,'value'))return null;
        values[field]=descriptor.value;
      }
      return values;
    }; 

    // Nested lineage arrays get descriptor-only handling. Never read proxy-backed length or slots directly.
    const readNestedDataArray=(candidate:unknown,limit:number):unknown[]|null=>{
      let array=false;
      try { array=Array.isArray(candidate); } catch { return null; }
      if(!array)return null;
      let prototype:object|null;
      let descriptors:Record<string,PropertyDescriptor>;
      try {
        prototype=Object.getPrototypeOf(candidate as object);
        descriptors=Object.getOwnPropertyDescriptors(candidate as object) as Record<string,PropertyDescriptor>;
      } catch { return null; }
      if(prototype!==Array.prototype)return null;
      const lengthDescriptor=descriptors.length;
      if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||
        typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||
        lengthDescriptor.value<0||lengthDescriptor.value>limit)return null;
      const length=lengthDescriptor.value;
      const keys=Object.keys(descriptors).filter(key=>key!=='length');
      if(keys.length!==length||keys.some(key=>!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=length))return null;
      const values:unknown[]=[];
      for(let index=0;index<length;index+=1){
        const descriptor=descriptors[String(index)];
        if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return null;
        values.push(descriptor.value);
      }
      return values;
    };
    const cloneSnapshotPayload=(input:unknown,depth=0,state:{nodes:number;textUnits:number;ancestors:Set<object>}={nodes:0,textUnits:0,ancestors:new Set<object>()}):unknown=>{
      state.nodes+=1;
      if(state.nodes>16384)throw new RangeError('invalid-cognitive-event-payload-node-limit');
      if(depth>32)throw new RangeError('invalid-cognitive-event-payload-depth-limit');
      if(input===null||typeof input==='boolean')return input;
      if(typeof input==='string'){
        state.textUnits+=input.length;
        if(state.textUnits>MAX_COGNITIVE_PAYLOAD_TEXT_UNITS)throw new RangeError('invalid-cognitive-event-payload-text-budget');
        return input;
      }
      if(typeof input==='number'){
        if(!Number.isFinite(input))throw new TypeError('invalid-cognitive-event-payload-number');
        return input;
      }
      if(typeof input!=='object')throw new TypeError('invalid-cognitive-event-payload-value');
      if(state.ancestors.has(input))throw new TypeError('invalid-cognitive-event-payload-cycle');
      state.ancestors.add(input);
      try {
        let array=false;
        try { array=Array.isArray(input); } catch { throw new TypeError('invalid-cognitive-event-payload-array'); }
        if(array){
          let prototype:object|null;
          let descriptors:Record<string,PropertyDescriptor>;
          try {
            prototype=Object.getPrototypeOf(input);
            descriptors=Object.getOwnPropertyDescriptors(input) as Record<string,PropertyDescriptor>;
          } catch { throw new TypeError('invalid-cognitive-event-payload-array'); }
          if(prototype!==Array.prototype)throw new TypeError('invalid-cognitive-event-payload-array');
          const lengthDescriptor=descriptors.length;
          if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||
            typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||
            lengthDescriptor.value<0||lengthDescriptor.value>16384)throw new RangeError('invalid-cognitive-event-payload-array');
          const length=lengthDescriptor.value;
          const keys=Object.keys(descriptors).filter(key=>key!=='length');
          if(keys.length!==length||keys.some(key=>!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=length)) {
            throw new TypeError('invalid-cognitive-event-payload-array-shape');
          }
          const copied:unknown[]=[];
          for(let index=0;index<length;index+=1){
            const descriptor=descriptors[String(index)];
            if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')) {
              throw new TypeError('invalid-cognitive-event-payload-array-accessor');
            }
            copied.push(cloneSnapshotPayload(descriptor.value,depth+1,state));
          }
          return copied;
        }
        if(!isPlainRecord(input))throw new TypeError('invalid-cognitive-event-payload-record');
        let descriptors:Record<string,PropertyDescriptor>;
        try { descriptors=Object.getOwnPropertyDescriptors(input) as Record<string,PropertyDescriptor>; }
        catch { throw new TypeError('invalid-cognitive-event-payload-record'); }
        const keys=Object.keys(descriptors);
        if(keys.length>8192)throw new RangeError('invalid-cognitive-event-payload-key-limit');
        const copied:Record<string,unknown>={};
        for(const key of keys.sort()){
          if(key.length>512)throw new RangeError('invalid-cognitive-event-payload-key-length');
          state.textUnits+=key.length;
          if(state.textUnits>MAX_COGNITIVE_PAYLOAD_TEXT_UNITS)throw new RangeError('invalid-cognitive-event-payload-text-budget');
          const descriptor=descriptors[key]!;
          if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value')) {
            throw new TypeError('invalid-cognitive-event-payload-accessor');
          }
          Object.defineProperty(copied,key,{
            configurable:true,enumerable:true,writable:true,
            value:cloneSnapshotPayload(descriptor.value,depth+1,state),
          });
        }
        return copied;
      } finally {
        state.ancestors.delete(input);
      }
    };

    const rowLimit=Math.max(512,this.capacity*4);
    const recentRows=readSnapshotArray('recent',rowLimit);
    const receiptEvents=readSnapshotArray('receiptEvents',rowLimit);
    const receiptRows=readSnapshotArray('receiptProjectionIndex',256);
    const rows=[...recentRows,...receiptEvents];
    const seen=new Set<string>();
    const restored:CognitiveEventNode[]=[];
    for(const candidate of rows){
      const value=readDataRecord(candidate,[
        'id','stage','tick','at','source','parentIds','external','confidence01','payload',
      ]);
      if(!value)continue;
      const id=typeof value.id==='string'?value.id:'';
      const stage=typeof value.stage==='string'?value.stage as CognitiveStage:undefined;
      // Restore strictly typed identity and clocks; do not coerce malformed values into valid events.
      const tick=value.tick;
      if(!id||id!==id.trim()||id.length>180||/[\u0000-\u001f\u007f-\u009f]/.test(id)||
        !COGNITIVE_STAGES.has(stage as CognitiveStage)||typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<0||seen.has(id))continue;
      const atPresent=Object.hasOwn(value,'at');
      const rawAt=value.at;
      if(atPresent&&(typeof rawAt!=='number'||!Number.isFinite(rawAt)||rawAt<0))continue;
      const sourcePresent=Object.hasOwn(value,'source');
      if(sourcePresent&&(typeof value.source!=='string'||!value.source.trim()||value.source!==value.source.trim()||
        value.source.length>120||/[\u0000-\u001f\u007f-\u009f]/.test(value.source)))continue;
      const externalPresent=Object.hasOwn(value,'external');
      if(externalPresent&&typeof value.external!=='boolean')continue;
      const confidencePresent=Object.hasOwn(value,'confidence01');
      if(confidencePresent&&(
        typeof value.confidence01!=='number'||!Number.isFinite(value.confidence01)||
        value.confidence01<0||value.confidence01>1
      ))continue;
      const parentsPresent=Object.hasOwn(value,'parentIds');
      const rawParentIds=value.parentIds;
      const parentInput=parentsPresent?readNestedDataArray(rawParentIds,12):[];
      if(parentInput===null)continue;
      const parentIds:string[]=[];
      let invalidParentLineage=false;
      for(const parent of parentInput){
        if(typeof parent!=='string'||!parent.trim()||parent!==parent.trim()||parent.length>180||/[\u0000-\u001f\u007f-\u009f]/.test(parent)) {
          invalidParentLineage=true;
          break;
        }
        parentIds.push(parent);
      }
      if(invalidParentLineage||new Set(parentIds).size!==parentIds.length)continue;
      const at=atPresent?rawAt as number:0;
      let payload:Record<string,unknown>={};
      if(Object.hasOwn(value,'payload')){
        if(!isPlainRecord(value.payload))continue;
        try {
          const cloned=cloneSnapshotPayload(value.payload);
          if(!isRecord(cloned))continue;
          payload=cloned;
        } catch { continue; }
      }
      // Malformed rows do not reserve an ID: a later valid duplicate can recover.
      seen.add(id);
      restored.push({
        id,stage:stage as CognitiveStage,tick,at,
        source:sourcePresent?value.source as string:'restored-unknown',
        parentIds,
        external:externalPresent?value.external as boolean:false,
        confidence01:confidencePresent?value.confidence01 as number:.5,
        payload,
      });
      if(restored.length>=this.capacity)break;
    }
    const restoredById=new Map(restored.map(event=>[event.id,event] as const));
    const restoredReceiptProjectionIndex=new Map<string,ToolReceiptProjectionIndexEntry>();
    for(const candidateEntry of receiptRows) {
      const entry=readDataRecord(candidateEntry,[
        'executionId','actionEventId','outcomeEventId','evidenceEventId','projectedAt',
        'projectionHash','externalObservations','receiptRevisions',
      ]);
      if(!entry)continue;
      const executionId=entry.executionId;
      const actionEventId=entry.actionEventId;
      const outcomeEventId=entry.outcomeEventId;
      const evidenceEventId=entry.evidenceEventId;
      const canonicalReceiptId=(value:unknown):value is string=>
        typeof value==='string'&&value.length>0&&value.length<=180&&value===value.trim()&&
        !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
      if(!canonicalReceiptId(executionId)||!canonicalReceiptId(actionEventId)||
        !canonicalReceiptId(outcomeEventId)||!canonicalReceiptId(evidenceEventId))continue;
      const projectedAt=entry.projectedAt;
      if(typeof projectedAt!=='number'||!Number.isFinite(projectedAt)||projectedAt<0)continue;
      if(restoredReceiptProjectionIndex.has(executionId))continue;
      // Look up only IDs narrowed by canonicalReceiptId above; raw snapshot fields remain unknown.
      const action=restoredById.get(actionEventId), outcome=restoredById.get(outcomeEventId), evidence=restoredById.get(evidenceEventId);
      // Never restore a replay guard whose three referenced nodes have aged out,
      // been truncated or no longer match the execution identity/stage contract.
      if(action?.stage!=='tool-action' || outcome?.stage!=='tool-outcome' || evidence?.stage!=='tool-evidence') continue;
      if(action.payload.executionId!==entry.executionId || outcome.payload.executionId!==entry.executionId || evidence.payload.executionId!==entry.executionId) continue;
      if(!outcome.parentIds.includes(action.id) || !evidence.parentIds.includes(outcome.id)) continue;
      const suppliedProjectionHash=typeof entry.projectionHash==='string'?entry.projectionHash.toLowerCase():'';
      const projectionHashValid=/^[a-f0-9]{64}$/.test(suppliedProjectionHash);
      const expectedHash=evidence.payload.expectedPostconditionHash;
      const observedHash=evidence.payload.observedPostconditionHash;
      // The presence of these fields distinguishes modern receipts with null hashes
      // (empty postcondition text) from legacy snapshots that predate event-level hashes.
      const hasExpectedHashField=Object.hasOwn(evidence.payload,'expectedPostconditionHash');
      const hasObservedHashField=Object.hasOwn(evidence.payload,'observedPostconditionHash');
      const legacyHashless=!hasExpectedHashField&&!hasObservedHashField;
      if(!projectionHashValid||hasExpectedHashField!==hasObservedHashField)continue;
      if(!legacyHashless) {
        const hashValueIsValid=(value:unknown):boolean=>value===null||
          (typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value));
        if(!hashValueIsValid(expectedHash)||!hashValueIsValid(observedHash))continue;
        if(typeof action.payload.tool!=='string'||typeof outcome.payload.ok!=='boolean'||
          typeof outcome.payload.verified!=='boolean'||typeof outcome.payload.outcomeClass!=='string'||
          typeof evidence.payload.verificationBasis!=='string'||
          typeof evidence.payload.externalObservation!=='boolean'||
          (evidence.payload.observationId!==null&&typeof evidence.payload.observationId!=='string')||
          typeof evidence.payload.expectedPostconditionPresent!=='boolean'||
          typeof evidence.payload.observedPostconditionPresent!=='boolean'||
          typeof evidence.payload.observationIntegrated!=='boolean')continue;
        const reconstructedProjection={
          tick:outcome.tick,
          executionId:entry.executionId,
          toolId:action.payload.tool,
          decisionId:(action.payload.requestedDecisionId??action.payload.decisionId)??null,
          ok:outcome.payload.ok,
          verified:outcome.payload.verified,
          outcomeClass:outcome.payload.outcomeClass,
          confidence01:outcome.confidence01,
          verificationBasis:evidence.payload.verificationBasis,
          externalObservation:evidence.payload.externalObservation,
          observationId:evidence.payload.observationId??null,
          expectedPostconditionPresent:evidence.payload.expectedPostconditionPresent,
          observedPostconditionPresent:evidence.payload.observedPostconditionPresent,
          expectedPostconditionHash:expectedHash,
          observedPostconditionHash:observedHash,
          observationIntegrated:evidence.payload.observationIntegrated,
        };
        if(sha256Stable(reconstructedProjection)!==suppliedProjectionHash)continue;
      }
      function decodeReceiptRefs(field:'externalObservations',receipt:Record<string,unknown>):ExternalObservationProjectionRef[]|null;
      function decodeReceiptRefs(field:'receiptRevisions',receipt:Record<string,unknown>):ToolReceiptRevisionProjectionRef[]|null;
      function decodeReceiptRefs(field:'externalObservations'|'receiptRevisions',receipt:Record<string,unknown>):ExternalObservationProjectionRef[]|ToolReceiptRevisionProjectionRef[]|null {
        if(!Object.hasOwn(receipt,field))return [];
        const arrayValue=receipt[field];
        let isArray=false;
        try { isArray=Array.isArray(arrayValue); } catch { /* rejected below */ }
        if(!isArray)return null;
        let prototype:object|null;
        let descriptors:Record<string,PropertyDescriptor>;
        try {
          prototype=Object.getPrototypeOf(arrayValue as object);
          descriptors=Object.getOwnPropertyDescriptors(arrayValue as object) as Record<string,PropertyDescriptor>;
        } catch { return null; }
        if(prototype!==Array.prototype)return null;
        const lengthDescriptor=descriptors.length;
        if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||
          typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||
          lengthDescriptor.value<0||lengthDescriptor.value>256)return null;
        const length=lengthDescriptor.value;
        const ownKeys=Object.keys(descriptors).filter(key=>key!=='length');
        if(ownKeys.length!==length||ownKeys.some(key=>!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=length))return null;
        const acceptedExternal:ExternalObservationProjectionRef[]=[];
        const acceptedRevisions:ToolReceiptRevisionProjectionRef[]=[];
        for(let index=0;index<length;index+=1){
          const slot=descriptors[String(index)];
          if(!slot||!slot.enumerable||!Object.hasOwn(slot,'value'))return null;
          const refFields=field==='externalObservations'
            ?['observationId','eventId','projectionHash','projectedAt']
            :['revisionId','eventId','projectionHash','projectedAt'];
          const ref=readDataRecord(slot.value,refFields);
          if(!ref)return null;
          const identity=field==='externalObservations'?ref.observationId:ref.revisionId;
          const eventId=ref.eventId;
          const projectionHash=ref.projectionHash;
          const projectedAt=ref.projectedAt;
          if(typeof identity!=='string'||!identity.trim()||identity!==identity.trim()||identity.length>180||
            typeof eventId!=='string'||!eventId.trim()||eventId!==eventId.trim()||eventId.length>180||
            typeof projectionHash!=='string'||!/^[a-f0-9]{64}$/i.test(projectionHash)||
            typeof projectedAt!=='number'||!Number.isFinite(projectedAt)||projectedAt<0)return null;
          const event=restoredById.get(eventId);
          if(field==='externalObservations'){
            if(event?.stage!=='external-evidence'||event.payload.executionId!==executionId||
              event.payload.observationId!==identity||event.payload.projectionHash!==projectionHash.toLowerCase())return null;
            acceptedExternal.push({observationId:identity,eventId,projectionHash:projectionHash.toLowerCase(),projectedAt});
          }else{
            if(event?.stage!=='tool-reconciliation'||event.payload.executionId!==executionId||
              event.payload.revisionId!==identity||event.payload.projectionHash!==projectionHash.toLowerCase())return null;
            acceptedRevisions.push({revisionId:identity,eventId,projectionHash:projectionHash.toLowerCase(),projectedAt});
          }
        }
        return field==='externalObservations'?acceptedExternal.slice(-32):acceptedRevisions.slice(-32);
      }
      const externalObservations=decodeReceiptRefs('externalObservations',entry);
      const receiptRevisions=decodeReceiptRefs('receiptRevisions',entry);
      if(externalObservations===null||receiptRevisions===null)continue;
      restoredReceiptProjectionIndex.set(executionId,{executionId,actionEventId,outcomeEventId,evidenceEventId,projectedAt,...(/^[a-f0-9]{64}$/i.test(String(entry.projectionHash??''))?{projectionHash:String(entry.projectionHash).toLowerCase()}: {}),...(externalObservations.length?{externalObservations}:{}),...(receiptRevisions.length?{receiptRevisions}:{})});
      if(restoredReceiptProjectionIndex.size>=256) break;
    }
    const rawTotal=rootHas('total')?rootValue('total') as number:restored.length;
    const restoredTotal=Math.max(restored.length,rawTotal);
    // Commit all staged state only after root validation and receipt projections complete.
    this.events=restored;
    this.receiptProjectionIndex.clear();
    for(const [executionId,entry] of restoredReceiptProjectionIndex)this.receiptProjectionIndex.set(executionId,entry);
    this.total=restoredTotal;
  }

  append(input:{id?:string;tick:number;stage:CognitiveStage;source:string;parentIds?:string[];external?:boolean;confidence01?:number;payload?:Record<string,unknown>;at?:number}):CognitiveEventNode{
    if(!isPlainRecord(input))throw new TypeError('invalid-cognitive-event-input');

    // Snapshot only own data properties. Top-level getters must not run while
    // a causal event is being validated or its replay identity is being computed.
    const inputFieldNames=['id','tick','at','stage','source','parentIds','external','confidence01','payload'] as const;
    const inputValues:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
    for(const field of inputFieldNames){
      let descriptor:PropertyDescriptor|undefined;
      try {
        descriptor=Object.getOwnPropertyDescriptor(input,field);
      } catch {
        throw new TypeError('invalid-cognitive-event-input-field:'+field);
      }
      if(!descriptor)continue;
      if(!Object.hasOwn(descriptor,'value')) {
        throw new TypeError('cognitive-event-input-field-accessor:'+field);
      }
      inputValues[field]=descriptor.value;
    }

    const idValue=inputValues.id;
    const suppliedId=typeof idValue==='string'?idValue:'';
    if(idValue!==undefined&&(
      !suppliedId||suppliedId!==suppliedId.trim()||suppliedId.length>180||/[\u0000-\u001f\u007f-\u009f]/u.test(suppliedId)
    )) {
      throw new Error('invalid-cognitive-event-id');
    }

    const tick=inputValues.tick;
    if(typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<0) {
      throw new RangeError('invalid-cognitive-event-tick');
    }
    const atInput=inputValues.at;
    if(atInput!==undefined&&(typeof atInput!=='number'||!Number.isFinite(atInput)||atInput<0)) {
      throw new RangeError('invalid-cognitive-event-timestamp');
    }
    const stageInput=inputValues.stage;
    if(typeof stageInput!=='string'||!COGNITIVE_STAGES.has(stageInput as CognitiveStage)) {
      throw new TypeError('invalid-cognitive-event-stage');
    }
    const sourceInput=inputValues.source;
    if(typeof sourceInput!=='string')throw new TypeError('invalid-cognitive-event-source');
    // Identity-bearing strings must be canonical; truncation/normalization could alias events.
    if(!sourceInput.trim()||sourceInput!==sourceInput.trim()||sourceInput.length>120||/[\u0000-\u001f\u007f-\u009f]/u.test(sourceInput)) {
      throw new RangeError('invalid-cognitive-event-source');
    }

    const rawParentIds=inputValues.parentIds;
    if(rawParentIds!==undefined&&!Array.isArray(rawParentIds)) {
      throw new TypeError('invalid-cognitive-event-parents');
    }
    const parentInput=Array.isArray(rawParentIds)?rawParentIds:[];
    let parentLength=0;
    if(Array.isArray(rawParentIds)){
      let lengthDescriptor:PropertyDescriptor|undefined;
      try {
        lengthDescriptor=Object.getOwnPropertyDescriptor(rawParentIds,'length');
      } catch {
        throw new TypeError('invalid-cognitive-event-parents');
      }
      if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||
        typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0) {
        throw new TypeError('invalid-cognitive-event-parents');
      }
      parentLength=lengthDescriptor.value;
    }
    if(parentLength>12)throw new RangeError('invalid-cognitive-event-parent-count');
    const parentIds:string[]=[];
    for(let index=0;index<parentLength;index+=1){
      let descriptor:PropertyDescriptor|undefined;
      try {
        descriptor=Object.getOwnPropertyDescriptor(parentInput,String(index));
      } catch {
        throw new TypeError('invalid-cognitive-event-parent-id');
      }
      // Do not execute array getters or silently accept holes in causal lineage.
      if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')) {
        throw new TypeError('invalid-cognitive-event-parent-id');
      }
      const parent=descriptor.value;
      if(typeof parent!=='string'||!parent.trim()||parent!==parent.trim()) {
        throw new TypeError('invalid-cognitive-event-parent-id');
      }
      if(parent.length>180||/[\u0000-\u001f\u007f-\u009f]/u.test(parent)) {
        throw new RangeError('invalid-cognitive-event-parent-id');
      }
      parentIds.push(parent);
    }
    if(new Set(parentIds).size!==parentIds.length) {
      throw new TypeError('invalid-cognitive-event-duplicate-parent-id');
    }

    const externalInput=inputValues.external;
    if(externalInput!==undefined&&typeof externalInput!=='boolean') {
      throw new TypeError('invalid-cognitive-event-external-flag');
    }
    const external=externalInput===undefined?false:externalInput;
    const confidenceInput=inputValues.confidence01;
    if(confidenceInput!==undefined&&typeof confidenceInput!=='number') {
      throw new TypeError('invalid-cognitive-event-confidence');
    }
    if(confidenceInput!==undefined&&(
      !Number.isFinite(confidenceInput)||confidenceInput<0||confidenceInput>1
    )) {
      throw new RangeError('invalid-cognitive-event-confidence');
    }
    const confidence01=confidenceInput===undefined?0.5:confidenceInput;

    // Explicit payload roots must be plain data records, not primitives that collapse to {}.
    const payloadInput=inputValues.payload;
    if(payloadInput!==undefined&&!isPlainRecord(payloadInput)) {
      throw new TypeError('invalid-cognitive-event-payload');
    }
    const payload=cleanPayload(payloadInput);
    // Canonicalize and validate everything before stable-ID lookup or any journal mutation.
    sha256Stable(payload);
    const prior=suppliedId?this.events.find(event=>event.id===suppliedId):undefined;
    const at=atInput!==undefined?atInput:(prior?.at??Date.now());
    const event:CognitiveEventNode={
      id:suppliedId||('cef:'+at+':'+tick+':'+Math.random().toString(16).slice(2)),
      tick,
      at,
      stage:stageInput as CognitiveStage,
      source:sourceInput,
      parentIds,
      external,
      confidence01,
      payload,
    };

    if(prior) {
      if(eventEnvelopeFingerprint(prior)!==eventEnvelopeFingerprint(event)) {
        throw new Error('cognitive-event-id-conflict');
      }
      return cloneCognitiveEvent(prior);
    }

    this.events.unshift(event);
    if(this.events.length>this.capacity)this.events=this.events.slice(0,this.capacity);
    this.total+=1;
    this.pruneReceiptProjectionIndex();
    return cloneCognitiveEvent(event);
  }
  /** Read-only lookup by stable event ID. Returned payloads are detached. */
  getById(id:string):CognitiveEventNode|null {
    const normalized=typeof id==='string'?id.trim():'';
    if(!normalized)return null;
    const event=this.events.find(row=>row.id===normalized);
    return event?cloneCognitiveEvent(event):null;
  }
  private pruneReceiptProjectionIndex():void {
    if(!this.receiptProjectionIndex.size) return;
    const ids=new Set(this.events.map(event=>event.id));
    for(const [executionId,entry] of this.receiptProjectionIndex) {
      if(!ids.has(entry.actionEventId)||!ids.has(entry.outcomeEventId)||!ids.has(entry.evidenceEventId))
        this.receiptProjectionIndex.delete(executionId);
    }
  }

  /**
   * Project a completed ActionGateway receipt into the same causal journal used by
   * operational cycles. This is a separate, cross-tick trace: it deliberately does
   * not manufacture learning/self-update stages or inflate operational-cycle coverage.
   * The executionId is the deduplication key; a replay returns the original event IDs.
   */
  appendToolReceiptTrace(input:{
    tick:number; executionId:string; toolId:string; decisionId?:string;
    ok:boolean; verified:boolean; outcomeClass:string; confidence01:number;
    verificationBasis:string; externalObservation:boolean; observationId?:string;
    expectedPostcondition?:string; observedPostcondition?:string;
    observationIntegrated:boolean; at?:number;
  }): { replayed:boolean; executionId:string; actionEventId:string; outcomeEventId:string; evidenceEventId:string } {
    const safeInput=readOwnDataFields(input,[
      'tick','executionId','toolId','decisionId','ok','verified','outcomeClass','confidence01',
      'verificationBasis','externalObservation','observationId','expectedPostcondition',
      'observedPostcondition','observationIntegrated','at',
    ]);
    if(!safeInput)throw new TypeError('invalid-tool-receipt-input');
    input=safeInput as unknown as typeof input;

    if(typeof input.executionId!=='string')throw new TypeError('invalid-tool-receipt-execution-id');
    const executionId=input.executionId;
    if(!executionId)throw new Error('tool-receipt-execution-id-required');
    if(!isCanonicalCognitiveIdentifier(executionId,180))throw new RangeError('invalid-tool-receipt-execution-id');
    if(typeof input.toolId!=='string'||!input.toolId)throw new TypeError('invalid-tool-receipt-tool-id');
    if(!isCanonicalCognitiveIdentifier(input.toolId,64))throw new RangeError('invalid-tool-receipt-tool-id');
    if(typeof input.tick!=='number'||!Number.isSafeInteger(input.tick)||input.tick<0)throw new RangeError('invalid-cognitive-event-tick');
    if(input.at!==undefined&&(typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0))throw new RangeError('invalid-cognitive-event-timestamp');
    if(typeof input.ok!=='boolean'||typeof input.verified!=='boolean'||typeof input.externalObservation!=='boolean'||typeof input.observationIntegrated!=='boolean')throw new TypeError('invalid-tool-receipt-boolean');
    if(typeof input.confidence01!=='number'||!Number.isFinite(input.confidence01)||input.confidence01<0||input.confidence01>1)throw new TypeError('invalid-cognitive-event-confidence');
    const optionalText=(value:unknown,key:string,maxLength:number):string|undefined=>{
      if(value===undefined||value===null)return undefined;
      if(typeof value!=='string')throw new TypeError(`invalid-tool-receipt-${key}`);
      if(value.length>maxLength)throw new RangeError(`invalid-tool-receipt-${key}`);
      return value;
    };
    const decisionValue=optionalText(input.decisionId,'decision-id',180);
    if(decisionValue&&!isCanonicalCognitiveIdentifier(decisionValue,180))throw new TypeError('invalid-tool-receipt-decision-id');
    const decisionId=decisionValue||undefined;
    const outcomeClass=optionalText(input.outcomeClass,'outcome-class',64)??'unknown';
    const verificationBasis=optionalText(input.verificationBasis,'verification-basis',48)??'none';
    const observationValue=optionalText(input.observationId,'observation-id',180)??'';
    if(observationValue&&!isCanonicalCognitiveIdentifier(observationValue,180))throw new TypeError('invalid-tool-receipt-observation-id');
    const expectedPostcondition=optionalText(input.expectedPostcondition,'expected-postcondition',16384)??'';
    const observedPostcondition=optionalText(input.observedPostcondition,'observed-postcondition',16384)??'';
    const safeTool=input.toolId;
    const normalized={
      tick:input.tick,executionId,toolId:safeTool,decisionId:decisionId??null,
      ok:input.ok,verified:input.verified,outcomeClass,
      confidence01:clamp01(input.confidence01),verificationBasis,
      externalObservation:input.externalObservation,observationId:observationValue||null,
      expectedPostconditionPresent:Boolean(expectedPostcondition.trim()),
      observedPostconditionPresent:Boolean(observedPostcondition.trim()),
      // Keep canonical claims as hashes only; never copy raw postcondition text into the event ledger.
      expectedPostconditionHash:expectedPostcondition.trim()?sha256Stable(expectedPostcondition.normalize('NFKC').trim()):null,
      observedPostconditionHash:observedPostcondition.trim()?sha256Stable(observedPostcondition.normalize('NFKC').trim()):null,
      observationIntegrated:input.observationIntegrated,
    };
    const projectionHash=sha256Stable(normalized);
    const allForExecution=this.events.filter(event=>event.payload.executionId===executionId&&['tool-action','tool-outcome','tool-evidence'].includes(event.stage));
    const prior=this.receiptProjectionIndex.get(executionId);
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    const priorNodes=prior?[byId.get(prior.actionEventId),byId.get(prior.outcomeEventId),byId.get(prior.evidenceEventId)]:[];
    const candidateNodes=prior?priorNodes:allForExecution;
    if(candidateNodes.length){
      const action=candidateNodes.find(event=>event?.stage==='tool-action');
      const outcome=candidateNodes.find(event=>event?.stage==='tool-outcome');
      const evidence=candidateNodes.find(event=>event?.stage==='tool-evidence');
      const complete=Boolean(action&&outcome&&evidence&&candidateNodes.length===3&&outcome.parentIds.includes(action.id)&&evidence.parentIds.includes(outcome.id));
      if(!complete){
        if(candidateNodes.some(Boolean))throw new Error('tool-receipt-trace-incomplete-reconciliation-required');
      } else {
        const storedMatches=action!.payload.tool===normalized.toolId&&
          (action!.payload.requestedDecisionId??action!.payload.decisionId)===(normalized.decisionId??null)&&
          outcome!.tick===normalized.tick&&outcome!.payload.tool===normalized.toolId&&outcome!.payload.ok===normalized.ok&&
          outcome!.payload.verified===normalized.verified&&outcome!.payload.outcomeClass===normalized.outcomeClass&&
          Math.abs(clamp01(Number(outcome!.confidence01))-normalized.confidence01)<1e-9&&
          evidence!.payload.verificationBasis===normalized.verificationBasis&&evidence!.payload.externalObservation===normalized.externalObservation&&
          evidence!.payload.observationId===normalized.observationId&&evidence!.payload.observationIntegrated===normalized.observationIntegrated&&
          evidence!.payload.expectedPostconditionPresent===normalized.expectedPostconditionPresent&&
          evidence!.payload.observedPostconditionPresent===normalized.observedPostconditionPresent&&
          (evidence!.payload.expectedPostconditionHash===normalized.expectedPostconditionHash||
            (typeof evidence!.payload.expectedPostconditionHash!=='string'&&prior?.projectionHash===projectionHash))&&
          (evidence!.payload.observedPostconditionHash===normalized.observedPostconditionHash||
            (typeof evidence!.payload.observedPostconditionHash!=='string'&&prior?.projectionHash===projectionHash));
        if(!storedMatches||(prior?.projectionHash&&prior.projectionHash!==projectionHash))throw new Error('tool-receipt-execution-id-conflict');
        const replayEntry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action!.id,outcomeEventId:outcome!.id,evidenceEventId:evidence!.id,projectedAt:prior?.projectedAt??action!.at,projectionHash};
        this.receiptProjectionIndex.set(executionId,replayEntry);
        return {...replayEntry,replayed:true};
      }
    }
    const at=input.at===undefined?Date.now():input.at;
    const decision=this.events.find(event=>event.id===decisionId);
    return this.withAtomicLedgerMutation(()=>{
      const action=this.append({
        tick:input.tick,stage:'tool-action',source:'action-gateway',
        parentIds:decision?[decision.id]:[],external:false,confidence01:input.verified?Math.max(.5,clamp01(input.confidence01)):.5,at,
        payload:{executionId,tool:safeTool,decisionId:decision?.id??null,requestedDecisionId:normalized.decisionId??null,decisionLinked:Boolean(decision)},
      });
      const outcome=this.append({
        tick:input.tick,stage:'tool-outcome',source:'action-gateway-outcome',
        parentIds:[action.id],external:false,confidence01:clamp01(input.confidence01),at,
        payload:{executionId,tool:safeTool,ok:input.ok,verified:input.verified,outcomeClass},
      });
      const evidence=this.append({
        tick:input.tick,stage:'tool-evidence',source:'outcome-verification',
        parentIds:[outcome.id],external:input.externalObservation,confidence01:clamp01(input.confidence01),at,
        payload:{executionId,tool:safeTool,verificationBasis,externalObservation:input.externalObservation,observationId:observationValue||null,observationIntegrated:input.observationIntegrated,expectedPostconditionPresent:normalized.expectedPostconditionPresent,observedPostconditionPresent:normalized.observedPostconditionPresent,expectedPostconditionHash:normalized.expectedPostconditionHash,observedPostconditionHash:normalized.observedPostconditionHash},
      });
      const entry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action.id,outcomeEventId:outcome.id,evidenceEventId:evidence.id,projectedAt:at,projectionHash};
      this.receiptProjectionIndex.set(executionId,entry);
      while(this.receiptProjectionIndex.size>256) { const oldest=this.receiptProjectionIndex.keys().next().value; if(oldest===undefined) break; this.receiptProjectionIndex.delete(oldest); }
      return {...entry,replayed:false};
    });
  }



  hasToolReceiptTrace(executionId:string):boolean{
    const id=String(executionId??'').trim();
    if(!id)return false;
    const entry=this.receiptProjectionIndex.get(id);
    if(!entry)return false;
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    return byId.get(entry.actionEventId)?.stage==='tool-action'&&byId.get(entry.outcomeEventId)?.stage==='tool-outcome'&&byId.get(entry.evidenceEventId)?.stage==='tool-evidence';
  }

  /**
   * Append authoritative provider evidence without rewriting the immutable receipt
   * trio. All sensitive receipt identifiers are represented by hashes in CEF.
   */
  appendToolReceiptRevision(input:{
    tick:number;executionId:string;toolId:string;revisionId:string;revisionNumber:number;providerReceiptHash:string;
    revisionFingerprint:string;outcomeClass:string;ok:boolean;verified:boolean;verificationBasis:string;confidence01:number;
    observationId?:string;status:'verified'|'contradicted'|'unverified';reason?:string;at?:number;
  }):{resolved:boolean;replayed:boolean;reason?:string;eventId?:string;projectionHash?:string}{
    const safeInput=readOwnDataFields(input,[
      'tick','executionId','toolId','revisionId','revisionNumber','providerReceiptHash','revisionFingerprint',
      'outcomeClass','ok','verified','verificationBasis','confidence01','observationId','status','reason','at',
    ]);
    if(!safeInput)return {resolved:false,replayed:false,reason:'revision-input-invalid'};
    input=safeInput as unknown as typeof input;

    if(typeof input.executionId!=='string')return {resolved:false,replayed:false,reason:'execution-id-invalid'};
    const executionId=input.executionId;
    if(!executionId)return {resolved:false,replayed:false,reason:'execution-id-required'};
    if(!isCanonicalCognitiveIdentifier(executionId,180))return {resolved:false,replayed:false,reason:'execution-id-invalid'};
    if(typeof input.revisionId!=='string')return {resolved:false,replayed:false,reason:'revision-id-invalid'};
    const revisionId=input.revisionId;
    if(!revisionId)return {resolved:false,replayed:false,reason:'revision-id-required'};
    if(!isCanonicalCognitiveIdentifier(revisionId,180))return {resolved:false,replayed:false,reason:'revision-id-invalid'};
    if(typeof input.toolId!=='string')return {resolved:false,replayed:false,reason:'tool-id-invalid'};
    const toolId=input.toolId;
    if(!toolId)return {resolved:false,replayed:false,reason:'tool-id-required'};
    if(!isCanonicalCognitiveIdentifier(toolId,64))return {resolved:false,replayed:false,reason:'tool-id-invalid'};
    if(typeof input.providerReceiptHash!=='string'||!/^[a-f0-9]{64}$/i.test(input.providerReceiptHash)||
      typeof input.revisionFingerprint!=='string'||!/^[a-f0-9]{64}$/i.test(input.revisionFingerprint))return {resolved:false,replayed:false,reason:'revision-hash-invalid'};
    if(typeof input.tick!=='number'||!Number.isSafeInteger(input.tick)||input.tick<0)return {resolved:false,replayed:false,reason:'tick-invalid'};
    if(!Number.isSafeInteger(input.revisionNumber)||input.revisionNumber<1)return {resolved:false,replayed:false,reason:'revision-number-invalid'};
    if(typeof input.ok!=='boolean'||typeof input.verified!=='boolean')return {resolved:false,replayed:false,reason:'revision-boolean-invalid'};
    if(typeof input.confidence01!=='number'||!Number.isFinite(input.confidence01)||input.confidence01<0||input.confidence01>1)return {resolved:false,replayed:false,reason:'confidence-invalid'};
    if(input.at!==undefined&&(typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0))return {resolved:false,replayed:false,reason:'timestamp-invalid'};
    if(input.status!=='verified'&&input.status!=='contradicted'&&input.status!=='unverified')return {resolved:false,replayed:false,reason:'revision-status-invalid'};
    const rawOutcomeClass=input.outcomeClass??'unknown';
    const rawVerificationBasis=input.verificationBasis??'none';
    if(typeof rawOutcomeClass!=='string'||rawOutcomeClass.length>64)return {resolved:false,replayed:false,reason:'outcome-class-invalid'};
    if(typeof rawVerificationBasis!=='string'||rawVerificationBasis.length>48)return {resolved:false,replayed:false,reason:'verification-basis-invalid'};
    const rawObservationId=input.observationId??'';
    if(typeof rawObservationId!=='string'||(rawObservationId!==''&&!isCanonicalCognitiveIdentifier(rawObservationId,180)))return {resolved:false,replayed:false,reason:'observation-id-invalid'};
    const rawReason=input.reason??'';
    if(typeof rawReason!=='string')return {resolved:false,replayed:false,reason:'revision-reason-invalid'};
    const safeReason=rawReason.replace(/[\r\n\t]+/g,' ');
    if(safeReason.length>160)return {resolved:false,replayed:false,reason:'revision-reason-invalid'};
    const entry=this.receiptProjectionIndex.get(executionId);
    if(!entry||!this.hasToolReceiptTrace(executionId))return {resolved:false,replayed:false,reason:'no-canonical-tool-receipt'};
    const receiptAction=this.events.find(event=>event.id===entry.actionEventId);
    const receiptOutcome=this.events.find(event=>event.id===entry.outcomeEventId);
    if(receiptAction?.payload.tool!==toolId||receiptOutcome?.payload.tool!==toolId)return {resolved:false,replayed:false,reason:'execution-tool-mismatch'};
    const normalized={
      executionId,toolId,revisionId,
      revisionNumber:input.revisionNumber,
      providerReceiptHash:input.providerReceiptHash.toLowerCase(),
      revisionFingerprint:input.revisionFingerprint.toLowerCase(),
      outcomeClass:rawOutcomeClass,ok:input.ok,verified:input.verified,
      verificationBasis:rawVerificationBasis,confidence01:input.confidence01,
      observationId:rawObservationId||null,status:input.status,reason:safeReason,
    };
    const projectionHash=sha256Stable(normalized);
    const refs=entry.receiptRevisions??[];
    const prior=refs.find(ref=>ref.revisionId===revisionId);
    if(prior){
      if(prior.projectionHash!==projectionHash)throw new Error('tool-receipt-revision-conflict');
      return {resolved:true,replayed:true,eventId:prior.eventId,projectionHash};
    }
    // Never drop an idempotency reference and later accept the same revision again.
    // A bounded receipt ledger fails closed when its reference budget is exhausted.
    if(refs.length>=32)return {resolved:false,replayed:false,reason:'tool-receipt-revision-ledger-full'};
    const eventId=`cef:tool-receipt-revision:${sha256Stable({executionId,revisionId}).slice(0,48)}`;
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    const existing=byId.get(eventId);
    if(existing){
      if(existing.stage!=='tool-reconciliation'||existing.payload.executionId!==executionId||existing.payload.revisionId!==revisionId||existing.payload.projectionHash!==projectionHash)throw new Error('tool-receipt-revision-conflict');
      const ref={revisionId,eventId,projectionHash,projectedAt:existing.at};
      this.receiptProjectionIndex.set(executionId,{...entry,receiptRevisions:[...refs,ref]});
      return {resolved:true,replayed:true,eventId,projectionHash};
    }
    const latestRevision=refs.at(-1);
    const at=input.at===undefined?Date.now():input.at;
    const parents=[entry.outcomeEventId,...(latestRevision?[latestRevision.eventId]:[])].slice(0,12);
    const event=this.append({id:eventId,tick:input.tick,stage:'tool-reconciliation',source:'authoritative-provider-receipt',parentIds:parents,external:false,confidence01:clamp01(input.confidence01),at,payload:{...normalized,projectionHash,baseOutcomeEventId:entry.outcomeEventId,previousRevisionEventId:latestRevision?.eventId??null}});
    const ref={revisionId,eventId:event.id,projectionHash,projectedAt:at};
    this.receiptProjectionIndex.set(executionId,{...entry,receiptRevisions:[...refs,ref]});
    return {resolved:true,replayed:false,eventId:event.id,projectionHash};
  }

  /**
   * Append independently sourced post-action evidence to the exact ActionGateway receipt.
   * The event uses a separate stage so late evidence cannot distort operational-cycle coverage.
   * Raw postcondition text is not copied into CEF; only canonical hashes/presence flags are retained.
   */
  appendToolExternalObservation(input:{tick:number;executionId:string;toolId:string;observationId:string;verified:boolean;confidence01:number;sourceId?:string;sourceClass?:string;channel?:string;independenceKey?:string;expectedPostcondition?:string;observedPostcondition?:string;reason?:string;at?:number}):{resolved:boolean;reason?:string;replayed?:boolean;eventId?:string;archived?:boolean}{
    const safeInput=readOwnDataFields(input,[
      'tick','executionId','toolId','observationId','verified','confidence01','sourceId','sourceClass','channel',
      'independenceKey','expectedPostcondition','observedPostcondition','reason','at',
    ]);
    if(!safeInput)return {resolved:false,reason:'observation-input-invalid'};
    input=safeInput as unknown as typeof input;

    if(typeof input.executionId!=='string')return {resolved:false,reason:'execution-id-invalid'};
    const executionId=input.executionId;
    if(!executionId)return {resolved:false,reason:'execution-id-required'};
    if(!isCanonicalCognitiveIdentifier(executionId,180))return {resolved:false,reason:'execution-id-invalid'};
    if(typeof input.observationId!=='string')return {resolved:false,reason:'observation-id-invalid'};
    const observationId=input.observationId;
    if(!observationId)return {resolved:false,reason:'observation-id-required'};
    if(!isCanonicalCognitiveIdentifier(observationId,180))return {resolved:false,reason:'observation-id-invalid'};
    if(typeof input.toolId!=='string')return {resolved:false,reason:'tool-id-invalid'};
    const toolId=input.toolId;
    if(!toolId)return {resolved:false,reason:'tool-id-required'};
    if(!isCanonicalCognitiveIdentifier(toolId,64))return {resolved:false,reason:'tool-id-invalid'};
    if(typeof input.tick!=='number'||!Number.isSafeInteger(input.tick)||input.tick<0)return {resolved:false,reason:'tick-invalid'};
    if(typeof input.verified!=='boolean')return {resolved:false,reason:'verified-invalid'};
    if(typeof input.confidence01!=='number'||!Number.isFinite(input.confidence01)||input.confidence01<0||input.confidence01>1)return {resolved:false,reason:'confidence-invalid'};
    if(input.at!==undefined&&(typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0))return {resolved:false,reason:'timestamp-invalid'};
    const textValue=(value:unknown,key:string,maxLength:number,fallback:string):string=>{
      if(value===undefined||value===null)return fallback;
      if(typeof value!=='string'||value.length>maxLength)throw new TypeError('invalid-external-observation-'+key);
      return value;
    };
    let sourceId:string,sourceClass:string,channel:string,independenceKey:string,expectedPostcondition:string,observedPostcondition:string,reason:string;
    try {
      sourceId=textValue(input.sourceId,'source-id',80,'unknown');
      sourceClass=textValue(input.sourceClass,'source-class',32,'unknown');
      channel=textValue(input.channel,'channel',32,'unknown');
      independenceKey=textValue(input.independenceKey,'independence-key',120,'');
      expectedPostcondition=textValue(input.expectedPostcondition,'expected-postcondition',16384,'');
      observedPostcondition=textValue(input.observedPostcondition,'observed-postcondition',16384,'');
      reason=textValue(input.reason,'reason',160,'');
    } catch(error) {
      return {resolved:false,reason:error instanceof Error?error.message:'observation-text-invalid'};
    }
    if((sourceId&&!isCanonicalCognitiveIdentifier(sourceId,80))||
      (independenceKey&&!isCanonicalCognitiveIdentifier(independenceKey,120)))return {resolved:false,reason:'observation-identity-invalid'};
    const entry=this.receiptProjectionIndex.get(executionId);
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    const action=entry?byId.get(entry.actionEventId):this.events.find(event=>event.stage==='tool-action'&&event.payload.executionId===executionId);
    const outcome=entry?byId.get(entry.outcomeEventId):this.events.find(event=>event.stage==='tool-outcome'&&event.payload.executionId===executionId);
    if(!action||!outcome||action.stage!=='tool-action'||outcome.stage!=='tool-outcome'||!outcome.parentIds.includes(action.id))return {resolved:false,reason:'no-canonical-tool-receipt'};
    if(typeof action.payload.tool!=='string'||typeof outcome.payload.tool!=='string'||
      action.payload.tool!==toolId||outcome.payload.tool!==toolId)return {resolved:false,reason:'execution-tool-mismatch'};
    const expected=expectedPostcondition.normalize('NFKC').trim();
    const observed=observedPostcondition.normalize('NFKC').trim();
    const safePayload={executionId,toolId,observationId,verified:input.verified,confidence01:input.confidence01,sourceId,sourceClass,channel,independenceKey,expectedPostconditionHash:expected?sha256Stable(expected):null,observedPostconditionHash:observed?sha256Stable(observed):null,expectedPostconditionPresent:Boolean(expected),observedPostconditionPresent:Boolean(observed),reason};
    const projectionHash=sha256Stable(safePayload);
    const refs=entry?.externalObservations??[];
    const prior=refs.find(ref=>ref.observationId===observationId);
    if(prior){
      if(prior.projectionHash!==projectionHash)throw new Error('external-observation-projection-conflict');
      return {resolved:true,replayed:true,eventId:prior.eventId,archived:!byId.has(prior.eventId)};
    }
    const eventId=`cef:tool-external-observation:${sha256Stable({executionId,observationId}).slice(0,48)}`;
    const existing=byId.get(eventId);
    if(existing){
      if(existing.stage!=='external-evidence'||existing.payload.projectionHash!==projectionHash||existing.payload.executionId!==executionId||existing.payload.observationId!==observationId)throw new Error('external-observation-projection-conflict');
      const ref={observationId,eventId,projectionHash,projectedAt:existing.at};
      if(entry)this.receiptProjectionIndex.set(executionId,{...entry,externalObservations:[...refs,ref].slice(-32)});
      return {resolved:true,replayed:true,eventId};
    }
    const at=input.at===undefined?Date.now():input.at;
    const evidence=this.append({id:eventId,tick:input.tick,stage:'external-evidence',source:'external-observer-fabric',parentIds:[outcome.id],external:true,confidence01:clamp01(input.confidence01),at,payload:{...safePayload,projectionHash,receiptActionEventId:action.id,receiptOutcomeEventId:outcome.id,evidenceStatus:input.verified?'corroborated':expected&&observed&&expected!==observed?'contradicted':'unresolved'}});
    const ref={observationId,eventId:evidence.id,projectionHash,projectedAt:at};
    if(entry)this.receiptProjectionIndex.set(executionId,{...entry,externalObservations:[...refs,ref].slice(-32)});
    return {resolved:true,replayed:false,eventId:evidence.id};
  }

  recordOperationalCycle(input:{
    tick:number;
    observation?:OperationalCyclePhaseInput;
    prediction?:OperationalCyclePhaseInput;
    appraisal?:OperationalCyclePhaseInput;
    attention?:OperationalCyclePhaseInput;
    memory?:OperationalCyclePhaseInput;
    goal?:OperationalCyclePhaseInput;
    plan?:OperationalCyclePhaseInput;
    action?:OperationalCyclePhaseInput;
    outcome?:OperationalCyclePhaseInput;
    learning?:OperationalCyclePhaseInput;
    selfUpdate?:OperationalCyclePhaseInput;
    at?:number;
  }){
    type PhaseKey='observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'selfUpdate';
    type PreparedPhase={source:string;confidence01?:number;external?:boolean;payload:Record<string,unknown>};
    type PhaseSpec={key:PhaseKey;stage:CognitiveStage;defaultSource:string;parents:PhaseKey[];forwardsExternal?:boolean};
    const specs:PhaseSpec[]=[
      {key:'observation',stage:'observation',defaultSource:'runtime',parents:[],forwardsExternal:true},
      {key:'prediction',stage:'prediction',defaultSource:'prediction',parents:['observation']},
      {key:'appraisal',stage:'appraisal',defaultSource:'appraisal',parents:['observation','prediction']},
      {key:'attention',stage:'attention',defaultSource:'attention',parents:['appraisal','prediction']},
      {key:'memory',stage:'memory',defaultSource:'memory',parents:['attention','observation']},
      {key:'goal',stage:'goal',defaultSource:'goal',parents:['appraisal','memory','prediction']},
      {key:'plan',stage:'plan',defaultSource:'plan',parents:['goal','prediction']},
      {key:'action',stage:'action',defaultSource:'action',parents:['plan','prediction','observation']},
      {key:'outcome',stage:'outcome',defaultSource:'outcome',parents:['action','prediction'],forwardsExternal:true},
      {key:'learning',stage:'learning',defaultSource:'learning',parents:['outcome','action']},
      {key:'selfUpdate',stage:'self-update',defaultSource:'self-update',parents:['learning','outcome']},
    ];
    const readDataField=(record:Record<string,unknown>,key:string):unknown=>{
      const descriptor=Object.getOwnPropertyDescriptor(record,key);
      if(!descriptor)return undefined;
      if(!Object.hasOwn(descriptor,'value'))throw new TypeError('cognitive-cycle-accessor-not-allowed');
      return descriptor.value;
    };
    if(!isRecord(input))throw new TypeError('invalid-cognitive-cycle-input');
    const rawInput=input as unknown as Record<string,unknown>;
    const rawTick=readDataField(rawInput,'tick');
    if(typeof rawTick!=='number'||!Number.isSafeInteger(rawTick)||rawTick<0)throw new RangeError('invalid-cognitive-event-tick');
    const rawAt=readDataField(rawInput,'at');
    if(rawAt!==undefined&&(typeof rawAt!=='number'||!Number.isFinite(rawAt)||rawAt<0))throw new RangeError('invalid-cognitive-event-timestamp');

    // Normalize every supplied phase before the first event is appended. A malformed
    // late learning/self-update payload must never leave earlier observation/plan events behind.
    const prepared:Partial<Record<PhaseKey,PreparedPhase>>={};
    for(const spec of specs){
      const rawPhase=readDataField(rawInput,spec.key);
      if(!rawPhase)continue;
      if(!isRecord(rawPhase))throw new TypeError(`invalid-cognitive-cycle-phase:${spec.key}`);
      const phaseRecord=rawPhase as Record<string,unknown>;
      const rawSource=readDataField(phaseRecord,'source');
      const source=rawSource??spec.defaultSource;
      if(typeof source!=='string')throw new TypeError('invalid-cognitive-event-source');
      const confidence01=readDataField(phaseRecord,'confidence01');
      if(confidence01!==undefined&&(typeof confidence01!=='number'||!Number.isFinite(confidence01)))throw new TypeError('invalid-cognitive-event-confidence');
      let external:boolean|undefined;
      if(spec.forwardsExternal){
        const rawExternal=readDataField(phaseRecord,'external');
        if(rawExternal!==undefined&&typeof rawExternal!=='boolean')throw new TypeError('invalid-cognitive-event-external-flag');
        external=rawExternal as boolean|undefined;
      }
      const payload=cleanPayload(readDataField(phaseRecord,'payload'));
      prepared[spec.key]={source,confidence01:confidence01 as number|undefined,external,payload};
    }

    const ids:Partial<Record<PhaseKey,string>>={};
    return this.withAtomicLedgerMutation(()=>{
      for(const spec of specs){
        const phase=prepared[spec.key];
        if(!phase)continue;
        const parentIds=spec.parents.map(key=>ids[key]).filter((id):id is string=>Boolean(id));
        const event=this.append({
          tick:rawTick,
          stage:spec.stage,
          source:phase.source,
          parentIds,
          ...(spec.forwardsExternal?{external:phase.external}:{}),
          confidence01:phase.confidence01,
          payload:phase.payload,
          at:rawAt as number|undefined,
        });
        ids[spec.key]=event.id;
      }
      return ids;
    });
  }

  verifyOperationalCycle(stageIds: OperationalCycleStageIds): OperationalCycleLineageCheck {
    const required = ['observation','prediction','action','outcome','learning','self-update'] as const;
    const optional = ['appraisal','attention','memory','goal','plan'] as const;
    const byId = new Map(this.events.map(event => [event.id, event] as const));
    const found = new Map<string, CognitiveEventNode>();
    const missingStages: string[] = [];
    const invalidStages: string[] = [];
    let cycleTick: number | null = null;

    const stageOrder: OperationalCycleStageName[] = [
      'observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update',
    ];
    const requiredSet = new Set<string>(required);
    const requestedOptional = new Set<OperationalCycleStageName>(
      optional.filter(stage => Boolean(stageIds[stage])),
    );

    for (const stage of stageOrder) {
      const id = stageIds[stage];
      const isRequired = requiredSet.has(stage);
      if (!id) {
        if (isRequired) missingStages.push(stage);
        continue;
      }
      const event = byId.get(id);
      if (!event) {
        if (isRequired) missingStages.push(stage);
        else invalidStages.push(`${stage}:missing-event`);
        continue;
      }
      if (event.stage !== stage) {
        invalidStages.push(`${stage}:expected-stage-${stage}-got-${event.stage}`);
        continue;
      }
      if (cycleTick === null) cycleTick = event.tick;
      if (event.tick !== cycleTick) {
        invalidStages.push(`${stage}:tick-mismatch`);
        continue;
      }
      found.set(stage, event);
    }

    const edgeRequirements: Array<[OperationalCycleStageName, OperationalCycleStageName, string]> = [
      ['prediction','observation','prediction->observation'],
      ['action','prediction','action->prediction'],
      ['action','observation','action->observation'],
      ['outcome','action','outcome->action'],
      ['learning','outcome','learning->outcome'],
      ['self-update','learning','self-update->learning'],
    ];
    const optionalEdgeRequirements: Array<[OperationalCycleStageName, OperationalCycleStageName, string]> = [
      ['appraisal','observation','appraisal->observation'],
      ['appraisal','prediction','appraisal->prediction'],
      ['attention','appraisal','attention->appraisal'],
      ['attention','prediction','attention->prediction'],
      ['memory','attention','memory->attention'],
      ['memory','observation','memory->observation'],
      ['goal','appraisal','goal->appraisal'],
      ['goal','memory','goal->memory'],
      ['plan','goal','plan->goal'],
      ['plan','prediction','plan->prediction'],
    ];
    for (const edge of optionalEdgeRequirements) {
      if (requestedOptional.has(edge[0])) edgeRequirements.push(edge);
    }
    // If a plan phase is supplied, the required action must causally descend from it.
    if (requestedOptional.has('plan')) edgeRequirements.push(['action','plan','action->plan']);

    const missingEdges: string[] = [];
    let validEdges = 0;
    for (const [childStage, parentStage, label] of edgeRequirements) {
      const child = found.get(childStage);
      const parent = found.get(parentStage);
      if (child && parent && child.parentIds.includes(parent.id)) validEdges++;
      else missingEdges.push(label);
    }
    const expectedStageCount = required.length + requestedOptional.size;
    const stageCoverage = found.size / Math.max(1, expectedStageCount);
    const edgeCoverage = validEdges / Math.max(1, edgeRequirements.length);
    const integrity01 = clamp01(stageCoverage * .6 + edgeCoverage * .4);
    const complete = missingStages.length === 0 && invalidStages.length === 0 && missingEdges.length === 0;
    return { tick: cycleTick, complete, integrity01: complete ? 1 : integrity01, missingStages, invalidStages, missingEdges };
  }

  recent(limit=64):CognitiveEventNode[]{return this.events.slice(0,Math.max(1,Math.min(256,Math.floor(limit)))).map(cloneCognitiveEvent);}

  snapshot():CognitiveEventFabricSnapshot{
    const known=new Set(this.events.map(e=>e.id));
    let linked=0,dangling=0;
    for(const e of this.events)for(const p of e.parentIds){if(known.has(p))linked++;else dangling++;}
    const byTick=new Map<number,Set<CognitiveStage>>();
    // Receipt traces are cross-tick action records, not operational cycles. They
    // must not inflate or dilute the denominator for same-tick cognitive-cycle coverage.
    const operationalStages=new Set<CognitiveStage>(['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update']);
    for(const e of this.events){
      if(!operationalStages.has(e.stage)) continue;
      const s=byTick.get(e.tick)??new Set<CognitiveStage>();s.add(e.stage);byTick.set(e.tick,s);
    }
    const complete=[...byTick.values()].filter(s=>s.has('observation')&&s.has('prediction')&&s.has('action')&&s.has('outcome')).length;
    const coverage=byTick.size?clamp01(complete/byTick.size):0;
    const totalParentRefs=linked+dangling;
    const allTicks=this.events.map(e=>e.tick);
    const recentTicks=allTicks.length?Math.max(...allTicks)-Math.min(...allTicks):0;
    const recent=this.recent(96);
    const recentIds=new Set(recent.map(event=>event.id));
    const receiptIds=new Set([...this.receiptProjectionIndex.values()].flatMap(entry=>[entry.actionEventId,entry.outcomeEventId,entry.evidenceEventId,...(entry.externalObservations??[]).map(ref=>ref.eventId),...(entry.receiptRevisions??[]).map(ref=>ref.eventId)]));
    // The public snapshot intentionally keeps only 96 ordinary events. Include the
    // sanitized receipt nodes that still have live replay guards so restart restore
    // can retain exact causal links even when a receipt falls outside that window.
    const receiptEvents=this.events.filter(event=>receiptIds.has(event.id)&&!recentIds.has(event.id)).map(cloneCognitiveEvent);
    return{version:1,capacity:this.capacity,total:this.total,buffered:this.events.length,linkedParentEvents:linked,danglingParentLinks:dangling,lineageIntegrity01:clamp01(linked/Math.max(1,totalParentRefs)),cycleCoverage01:coverage,causalDensity01:clamp01(linked/Math.max(1,this.events.length*2)),recentTicks,recent,receiptEvents,receiptProjectionIndex:[...this.receiptProjectionIndex.values()].map(entry=>({
      ...entry,
      ...(entry.externalObservations?{externalObservations:entry.externalObservations.map(ref=>({...ref}) )}:{}),
      ...(entry.receiptRevisions?{receiptRevisions:entry.receiptRevisions.map(ref=>({...ref}) )}:{}),
    }))};
  }
}
