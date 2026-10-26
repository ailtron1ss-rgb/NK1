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
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const cleanPayload=(x:unknown):Record<string,unknown>=>{
  if(!isRecord(x)) return {};
  const detached:Record<string,unknown>={};
  // Do not invoke top-level getters while projecting a causal event payload.
  for(const key of Object.keys(x)){
    const descriptor=Object.getOwnPropertyDescriptor(x,key);
    if(descriptor && Object.hasOwn(descriptor,'value')) detached[key]=descriptor.value;
  }
  return detached;
};
const ownDataValue=(value:unknown,key:string):unknown=>{
  if(value===null||(typeof value!=='object'&&typeof value!=='function'))return undefined;
  try {
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')
      ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
};
const ownArrayValues=(value:unknown,maxItems:number):unknown[]=>{
  if(!Array.isArray(value))return [];
  const length=Math.min(value.length,Math.max(0,Math.floor(maxItems)));
  const values:unknown[]=[];
  for(let i=0;i<length;i++) {
    const descriptor=ownDataValue(value,String(i));
    // Sparse slots and accessors are not data rows and must not be invoked.
    if(descriptor!==undefined)values.push(descriptor);
  }
  return values;
};
const hasOwnAccessorField=(value:unknown,key:string):boolean=>{
  if(value===null||(typeof value!=='object'&&typeof value!=='function'))return false;
  try {
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return Boolean(descriptor&&!Object.prototype.hasOwnProperty.call(descriptor,'value'));
  } catch {
    return true;
  }
};
const hasOwnField=(value:unknown,key:string):boolean=>{
  if(value===null||(typeof value!=='object'&&typeof value!=='function'))return false;
  try {
    return Object.getOwnPropertyDescriptor(value,key)!==undefined;
  } catch {
    // Proxies that refuse inspection are treated as containing an invalid field.
    return true;
  }
};
const hasOnlyCanonicalEventId=(value:unknown):value is string=>
  typeof value==='string'&&value.length>0&&value.length<=180&&value===value.trim()&&
  !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const clonePlainJsonData=(value:unknown,state:{seen:Set<object>;nodes:number}={seen:new Set<object>(),nodes:0},depth=0):unknown=>{
  state.nodes+=1;
  if(depth>32||state.nodes>16384)throw new TypeError('event-payload-json-budget-exceeded');
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number') {
    if(!Number.isFinite(value))throw new TypeError('event-payload-non-finite-number');
    return value;
  }
  if(typeof value!=='object')throw new TypeError('event-payload-non-json-value');
  if(state.seen.has(value))throw new TypeError('event-payload-circular-reference');
  state.seen.add(value);
  try {
    if(Array.isArray(value)) {
      if(Object.getPrototypeOf(value)!==Array.prototype||value.length>4096) {
        throw new TypeError('event-payload-invalid-array');
      }
      const keys=Object.keys(value);
      if(keys.length!==value.length||keys.some((key,index)=>key!==String(index))) {
        throw new TypeError('event-payload-sparse-or-extended-array');
      }
      const copied:unknown[]=[];
      for(let i=0;i<value.length;i++) {
        const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
        if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true) {
          throw new TypeError('event-payload-accessor-or-hole');
        }
        copied.push(clonePlainJsonData(descriptor.value,state,depth+1));
      }
      return copied;
    }
    const proto=Object.getPrototypeOf(value);
    if(proto!==Object.prototype&&proto!==null)throw new TypeError('event-payload-non-plain-object');
    const copied:Record<string,unknown>={};
    for(const key of Object.keys(value)) {
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.enumerable!==true) {
        throw new TypeError('event-payload-accessor');
      }
      Object.defineProperty(copied,key,{
        value:clonePlainJsonData(descriptor.value,state,depth+1),
        enumerable:true,writable:true,configurable:true,
      });
    }
    return copied;
  } finally {
    state.seen.delete(value);
  }
};
const snapshotOwnDataFields=(value:unknown,fields:readonly string[],context:string):Record<string,unknown>=>{
  if(!isRecord(value))throw new TypeError(context+'-must-be-a-record');
  const accessor=fields.find(key=>hasOwnAccessorField(value,key));
  if(accessor)throw new TypeError(context+'-field-accessor:'+accessor);
  const snapshot:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const key of fields){
    if(!hasOwnField(value,key))continue;
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')) {
      throw new TypeError(context+'-field-not-data:'+key);
    }
    Object.defineProperty(snapshot,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
  }
  return snapshot;
};
const hasCanonicalBoundedText=(value:unknown,maxLength:number,allowEmpty=false):value is string=>
  typeof value==='string'&&value.length<=maxLength&&value===value.trim()&&
  (allowEmpty||value.length>0)&&!/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const isSha256Hex=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const COGNITIVE_STAGES=new Set<CognitiveStage>(['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update','tool-action','tool-outcome','tool-evidence','external-evidence','tool-reconciliation']);

export class CognitiveEventFabric {
  private readonly capacity:number;
  private events:CognitiveEventNode[]=[];
  private total=0;
  private readonly receiptProjectionIndex=new Map<string,ToolReceiptProjectionIndexEntry>();

  constructor(capacity=512){this.capacity=Math.max(128,Math.min(4096,Math.floor(capacity)));}

  restore(raw?:Partial<CognitiveEventFabricSnapshot>|null):void{
    if(raw!==undefined&&raw!==null&&!isRecord(raw)) {
      throw new TypeError('cognitive-event-fabric-snapshot-must-be-a-record');
    }
    const root=isRecord(raw)?raw:{};
    const rootFields=['version','recent','receiptEvents','receiptProjectionIndex','total'];
    const accessorRootField=rootFields.find(key=>hasOwnAccessorField(root,key));
    if(accessorRootField) {
      throw new TypeError('cognitive-event-fabric-snapshot-field-accessor:'+accessorRootField);
    }
    const hasVersion=hasOwnField(root,'version');
    const schemaVersion=ownDataValue(root,'version');
    if(hasVersion&&schemaVersion!==1) {
      throw new RangeError('unsupported-cognitive-event-fabric-snapshot-version');
    }

    // Missing fields are allowed for legacy snapshots; present fields must retain
    // their declared schema type. Do not turn a corrupt root into an empty ledger.
    for(const key of ['recent','receiptEvents','receiptProjectionIndex'] as const) {
      if(hasOwnField(root,key)&&!Array.isArray(ownDataValue(root,key))) {
        throw new TypeError('cognitive-event-fabric-snapshot-field-must-be-an-array:'+key);
      }
    }
    if(hasOwnField(root,'total')) {
      const declaredTotal=ownDataValue(root,'total');
      if(typeof declaredTotal!=='number'||!Number.isSafeInteger(declaredTotal)||declaredTotal<0) {
        throw new TypeError('cognitive-event-fabric-snapshot-total-must-be-a-safe-integer');
      }
    }

    // Decode into local collections first. A malformed schema or hostile accessor
    // cannot clear/partially rebuild the live ledger before validation finishes.
    const recentRows=ownArrayValues(ownDataValue(root,'recent'),this.capacity*2);
    const receiptEventRows=ownArrayValues(ownDataValue(root,'receiptEvents'),this.capacity*2);
    const rows=[...recentRows,...receiptEventRows].slice(0,this.capacity*2);
    const seen=new Set<string>();
    const restored:CognitiveEventNode[]=[];
    for(const value of rows){
      try {
        if(!isRecord(value))continue;
        if(['id','stage','tick','at','source','parentIds','external','confidence01','payload'].some(key=>hasOwnAccessorField(value,key)))continue;
        const idValue=ownDataValue(value,'id');
        const stageValue=ownDataValue(value,'stage');
        const tickValue=ownDataValue(value,'tick');
        if(!hasOnlyCanonicalEventId(idValue) ||
          typeof stageValue!=='string'||!COGNITIVE_STAGES.has(stageValue as CognitiveStage)||
          typeof tickValue!=='number'||!Number.isSafeInteger(tickValue)||tickValue<0||seen.has(idValue)) continue;

        const atValue=ownDataValue(value,'at');
        const sourceValue=ownDataValue(value,'source');
        const externalValue=ownDataValue(value,'external');
        const confidenceValue=ownDataValue(value,'confidence01');
        const payloadValue=ownDataValue(value,'payload');
        const parentValue=ownDataValue(value,'parentIds');

        if(atValue!==undefined&&(typeof atValue!=='number'||!Number.isFinite(atValue)||atValue<0))continue;
        if(sourceValue!==undefined&&(typeof sourceValue!=='string'||!sourceValue.trim()||sourceValue.length>120))continue;
        if(externalValue!==undefined&&typeof externalValue!=='boolean')continue;
        if(confidenceValue!==undefined&&(
          typeof confidenceValue!=='number'||!Number.isFinite(confidenceValue)||confidenceValue<0||confidenceValue>1
        ))continue;
        if(payloadValue!==undefined&&!isRecord(payloadValue))continue;

        const parentIds:string[]=[];
        if(parentValue!==undefined){
          if(!Array.isArray(parentValue)||parentValue.length>12)continue;
          const rawParents=ownArrayValues(parentValue,12);
          if(rawParents.length!==parentValue.length||rawParents.some(parent=>!hasOnlyCanonicalEventId(parent)))continue;
          parentIds.push(...rawParents as string[]);
        }

        // Copy nested payload data through own property descriptors. structuredClone/JSON
        // serializers can evaluate nested getters, so neither is an admissible parser
        // for an untrusted restored event.
        const payloadRaw=payloadValue===undefined?{}:payloadValue;
        const payload=clonePlainJsonData(payloadRaw) as Record<string,unknown>;
        if(!isRecord(payload))continue;
        sha256Stable(payload);
        const node:CognitiveEventNode={
          id:idValue,
          stage:stageValue as CognitiveStage,
          tick:tickValue,
          at:atValue===undefined?0:atValue,
          source:sourceValue===undefined?'restored-unknown':sourceValue as string,
          parentIds,
          external:externalValue===undefined?false:externalValue as boolean,
          confidence01:confidenceValue===undefined ? 0.5 : confidenceValue as number,
          payload,
        };
        seen.add(idValue);
        restored.push(node);
        if(restored.length>=this.capacity)break;
      } catch {
        // Malformed individual rows are dropped; valid rows already staged locally
        // remain isolated until the complete snapshot projection is ready.
      }
    }

    const restoredById=new Map(restored.map(event=>[event.id,event] as const));
    const restoredIndex=new Map<string,ToolReceiptProjectionIndexEntry>();
    const receiptRows=ownArrayValues(ownDataValue(root,'receiptProjectionIndex'),512);
    const sanitizeReceiptRef=(value:unknown,kind:'observation'|'revision',executionId:string):ExternalObservationProjectionRef|ToolReceiptRevisionProjectionRef|null=>{
      if(!isRecord(value))return null;
      if(['observationId','revisionId','eventId','projectionHash','projectedAt'].some(key=>hasOwnAccessorField(value,key)))return null;
      const idKey=kind==='observation'?'observationId':'revisionId';
      const refId=ownDataValue(value,idKey);
      const eventId=ownDataValue(value,'eventId');
      const projectionHash=ownDataValue(value,'projectionHash');
      const projectedAt=ownDataValue(value,'projectedAt');
      if(!hasOnlyCanonicalEventId(refId)||!hasOnlyCanonicalEventId(eventId)||
        typeof projectionHash!=='string'||!/^[a-f0-9]{64}$/i.test(projectionHash)||
        typeof projectedAt!=='number'||!Number.isFinite(projectedAt)||projectedAt<0)return null;
      const event=restoredById.get(eventId);
      if(kind==='observation'){
        if(event?.stage!=='external-evidence'||
          ownDataValue(event.payload,'executionId')!==executionId||
          ownDataValue(event.payload,'observationId')!==refId||
          ownDataValue(event.payload,'projectionHash')!==projectionHash.toLowerCase())return null;
        return {observationId:refId,eventId,projectionHash:projectionHash.toLowerCase(),projectedAt};
      }
      if(event?.stage!=='tool-reconciliation'||
        ownDataValue(event.payload,'executionId')!==executionId||
        ownDataValue(event.payload,'revisionId')!==refId||
        ownDataValue(event.payload,'projectionHash')!==projectionHash.toLowerCase())return null;
      return {revisionId:refId,eventId,projectionHash:projectionHash.toLowerCase(),projectedAt};
    };

    for(const value of receiptRows){
      if(!isRecord(value))continue;
      if(['executionId','actionEventId','outcomeEventId','evidenceEventId','projectedAt','projectionHash','externalObservations','receiptRevisions'].some(key=>hasOwnAccessorField(value,key)))continue;
      const executionId=ownDataValue(value,'executionId');
      const actionEventId=ownDataValue(value,'actionEventId');
      const outcomeEventId=ownDataValue(value,'outcomeEventId');
      const evidenceEventId=ownDataValue(value,'evidenceEventId');
      const projectedAt=ownDataValue(value,'projectedAt');
      const projectionHash=ownDataValue(value,'projectionHash');
      const hasIndexProjectionHash=hasOwnField(value,'projectionHash');
      if(!hasOnlyCanonicalEventId(executionId)||!hasOnlyCanonicalEventId(actionEventId)||
        !hasOnlyCanonicalEventId(outcomeEventId)||!hasOnlyCanonicalEventId(evidenceEventId)||
        typeof projectedAt!=='number'||!Number.isFinite(projectedAt)||projectedAt<0||
        (hasIndexProjectionHash&&!isSha256Hex(projectionHash)))continue;
      const action=restoredById.get(actionEventId);
      const outcome=restoredById.get(outcomeEventId);
      const evidence=restoredById.get(evidenceEventId);
      if(action?.stage!=='tool-action'||outcome?.stage!=='tool-outcome'||evidence?.stage!=='tool-evidence')continue;
      if(ownDataValue(action.payload,'executionId')!==executionId||
        ownDataValue(outcome.payload,'executionId')!==executionId||
        ownDataValue(evidence.payload,'executionId')!==executionId)continue;
      if(!outcome.parentIds.includes(action.id)||!evidence.parentIds.includes(outcome.id))continue;

      const eventProjectionValues=[
        ownDataValue(action.payload,'projectionHash'),
        ownDataValue(outcome.payload,'projectionHash'),
        ownDataValue(evidence.payload,'projectionHash'),
      ];
      const hasEventProjectionHash=[
        hasOwnField(action.payload,'projectionHash'),
        hasOwnField(outcome.payload,'projectionHash'),
        hasOwnField(evidence.payload,'projectionHash'),
      ].some(Boolean);
      let acceptedProjectionHash:string|undefined;
      if(hasEventProjectionHash) {
        if(!eventProjectionValues.every(isSha256Hex)||
          eventProjectionValues[0]!==eventProjectionValues[1]||
          eventProjectionValues[1]!==eventProjectionValues[2])continue;
        const expectedHash=ownDataValue(evidence.payload,'expectedPostconditionHash');
        const observedHash=ownDataValue(evidence.payload,'observedPostconditionHash');
        if(!hasOwnField(evidence.payload,'expectedPostconditionHash')||
          !hasOwnField(evidence.payload,'observedPostconditionHash')||
          (expectedHash!==null&&!isSha256Hex(expectedHash))||
          (observedHash!==null&&!isSha256Hex(observedHash)))continue;
        if(hasIndexProjectionHash&&projectionHash!==eventProjectionValues[0])continue;
        acceptedProjectionHash=eventProjectionValues[0] as string;
      } else if(hasIndexProjectionHash) {
        // Compatibility with pre-WorkPass365 snapshots whose event payloads did not bind the projection hash.
        acceptedProjectionHash=(projectionHash as string).toLowerCase();
      }

      const observationsRaw=ownDataValue(value,'externalObservations');
      const observations=ownArrayValues(observationsRaw,32)
        .map(ref=>sanitizeReceiptRef(ref,'observation',executionId))
        .filter((ref):ref is ExternalObservationProjectionRef=>ref!==null);
      const revisionsRaw=ownDataValue(value,'receiptRevisions');
      const revisions=ownArrayValues(revisionsRaw,32)
        .map(ref=>sanitizeReceiptRef(ref,'revision',executionId))
        .filter((ref):ref is ToolReceiptRevisionProjectionRef=>ref!==null);
      const accepted:ToolReceiptProjectionIndexEntry={
        executionId,actionEventId,outcomeEventId,evidenceEventId,projectedAt,
        ...(acceptedProjectionHash?{projectionHash:acceptedProjectionHash}:{}),
        ...(observations.length?{externalObservations:observations}:{}),
        ...(revisions.length?{receiptRevisions:revisions}:{}),
      };
      restoredIndex.set(executionId,accepted);
      if(restoredIndex.size>=256)break;
    }

    const rawTotal=ownDataValue(root,'total');
    const restoredTotal=typeof rawTotal==='number'&&Number.isSafeInteger(rawTotal)&&rawTotal>=0
      ?Math.max(restored.length,rawTotal):restored.length;
    this.events=restored;
    this.receiptProjectionIndex.clear();
    for(const [executionId,entry] of restoredIndex)this.receiptProjectionIndex.set(executionId,entry);
    this.total=restoredTotal;
  }

  append(input:{id?:string;tick:number;stage:CognitiveStage;source:string;parentIds?:string[];external?:boolean;confidence01?:number;payload?:Record<string,unknown>;at?:number}):CognitiveEventNode{
    if(!isRecord(input))throw new TypeError('cognitive-event-input-must-be-a-record');
    const inputFields=['id','tick','at','stage','source','parentIds','external','confidence01','payload'];
    const accessorInputField=inputFields.find(key=>hasOwnAccessorField(input,key));
    if(accessorInputField)throw new TypeError('cognitive-event-input-field-accessor:'+accessorInputField);

    const tickValue=ownDataValue(input,'tick');
    if(typeof tickValue!=='number'||!Number.isSafeInteger(tickValue)||tickValue<0) {
      throw new RangeError('invalid-cognitive-event-tick');
    }
    const stageValue=ownDataValue(input,'stage');
    if(typeof stageValue!=='string'||!COGNITIVE_STAGES.has(stageValue as CognitiveStage)) {
      throw new TypeError('invalid-cognitive-event-stage');
    }
    const sourceValue=ownDataValue(input,'source');
    if(typeof sourceValue!=='string')throw new TypeError('invalid-cognitive-event-source');

    const explicitAt=ownDataValue(input,'at');
    const hasExplicitAt=explicitAt!==undefined;
    const at=hasExplicitAt?explicitAt:Date.now();
    if(typeof at!=='number'||!Number.isFinite(at)||at<0) {
      throw new RangeError('invalid-cognitive-event-timestamp');
    }

    const idValue=ownDataValue(input,'id');
    let suppliedId='';
    if(idValue!==undefined) {
      if(!hasOnlyCanonicalEventId(idValue))throw new Error('invalid-cognitive-event-id');
      suppliedId=idValue;
    }

    const parentValue=ownDataValue(input,'parentIds');
    let parentIds:string[]=[];
    if(parentValue!==undefined) {
      if(!Array.isArray(parentValue))throw new TypeError('invalid-cognitive-event-parent-ids');
      let copiedParents:unknown;
      try {
        copiedParents=clonePlainJsonData(parentValue);
      } catch {
        throw new TypeError('invalid-cognitive-event-parent-ids');
      }
      if(!Array.isArray(copiedParents)||copiedParents.length>12||
        copiedParents.some(parent=>!hasOnlyCanonicalEventId(parent))||
        new Set(copiedParents).size!==copiedParents.length) {
        throw new TypeError('invalid-cognitive-event-parent-ids');
      }
      parentIds=copiedParents as string[];
    }

    const externalValue=ownDataValue(input,'external');
    if(externalValue!==undefined&&typeof externalValue!=='boolean') {
      throw new TypeError('invalid-cognitive-event-external-flag');
    }
    const external=externalValue===undefined?false:externalValue;
    const confidenceValue=ownDataValue(input,'confidence01');
    if(confidenceValue!==undefined&&(
      typeof confidenceValue!=='number'||!Number.isFinite(confidenceValue)||confidenceValue<0||confidenceValue>1
    ))throw new RangeError('invalid-cognitive-event-confidence');
    const confidence01=confidenceValue===undefined?0.5:confidenceValue;

    const payloadValue=ownDataValue(input,'payload');
    const payloadRaw=payloadValue===undefined?{}:payloadValue;
    if(!isRecord(payloadRaw))throw new TypeError('cognitive-event-payload-must-be-a-record');
    // Preserve the established contract: omit top-level payload accessors without invoking them,
    // then strictly clone nested data. Nested accessors remain invalid and fail closed.
    const payload=clonePlainJsonData(cleanPayload(payloadRaw)) as Record<string,unknown>;
    if(!isRecord(payload))throw new TypeError('cognitive-event-payload-must-be-a-record');
    // Payload snapshots use the same bounded plain-JSON contract as restore, so
    // accepted evidence cannot later disappear because restore rejects its shape.
    sha256Stable(payload);

    const normalizedSource=String(sourceValue||'unknown').slice(0,120);
    const normalizedTick=tickValue;
    const stage=stageValue as CognitiveStage;

    if(suppliedId){
      const prior=this.events.find(event=>event.id===suppliedId);
      if(prior){
        // A replay without an explicit timestamp reuses the first event's timestamp.
        const comparisonAt=hasExplicitAt?at:prior.at;
        const expectedFingerprint=sha256Stable({
          tick:normalizedTick,
          at:comparisonAt,
          stage,
          source:normalizedSource,
          parentIds,
          external,
          confidence01,
          payload,
        });
        const priorFingerprint=sha256Stable({
          tick:prior.tick,
          at:prior.at,
          stage:prior.stage,
          source:prior.source,
          parentIds:prior.parentIds,
          external:prior.external,
          confidence01:prior.confidence01,
          payload:prior.payload,
        });
        if(expectedFingerprint!==priorFingerprint)throw new Error('cognitive-event-id-conflict');
        return structuredClone(prior);
      }
    }

    const event:CognitiveEventNode={
      id:suppliedId||`cef:${at}:${normalizedTick}:${Math.random().toString(16).slice(2)}`,
      tick:normalizedTick,at,
      stage,source:normalizedSource,
      parentIds,external,confidence01,payload,
    };
    this.events.unshift(event);
    if(this.events.length>this.capacity)this.events=this.events.slice(0,this.capacity);
    this.total+=1;
    this.pruneReceiptProjectionIndex();
    return structuredClone(event);
  }

  private withAtomicLedgerMutation<T>(operation:()=>T):T {
    const previousEvents=this.events.slice();
    const previousTotal=this.total;
    const previousIndex=new Map(this.receiptProjectionIndex);
    try {
      return operation();
    } catch(error) {
      this.events=previousEvents;
      this.total=previousTotal;
      this.receiptProjectionIndex.clear();
      for(const [executionId,entry] of previousIndex)this.receiptProjectionIndex.set(executionId,entry);
      throw error;
    }
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
    const data=snapshotOwnDataFields(input,[
      'tick','executionId','toolId','decisionId','ok','verified','outcomeClass','confidence01',
      'verificationBasis','externalObservation','observationId','expectedPostcondition',
      'observedPostcondition','observationIntegrated','at',
    ],'tool-receipt-input');

    const tick=data.tick;
    if(typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<0)throw new RangeError('tool-receipt-tick-invalid');
    const executionId=data.executionId;
    if(!hasOnlyCanonicalEventId(executionId))throw new TypeError('tool-receipt-execution-id-invalid');
    const toolId=data.toolId;
    if(!hasCanonicalBoundedText(toolId,64))throw new TypeError('tool-receipt-tool-id-invalid');

    let decisionId:string|undefined;
    if(data.decisionId!==undefined&&data.decisionId!=='') {
      if(!hasOnlyCanonicalEventId(data.decisionId))throw new TypeError('tool-receipt-decision-id-invalid');
      decisionId=data.decisionId;
    }
    const ok=data.ok;
    const verified=data.verified;
    const externalObservation=data.externalObservation;
    const observationIntegrated=data.observationIntegrated;
    if(typeof ok!=='boolean')throw new TypeError('tool-receipt-ok-must-be-boolean');
    if(typeof verified!=='boolean')throw new TypeError('tool-receipt-verified-must-be-boolean');
    if(typeof externalObservation!=='boolean')throw new TypeError('tool-receipt-external-observation-must-be-boolean');
    if(typeof observationIntegrated!=='boolean')throw new TypeError('tool-receipt-observation-integrated-must-be-boolean');

    const confidence01=data.confidence01;
    if(typeof confidence01!=='number'||!Number.isFinite(confidence01)||confidence01<0||confidence01>1) {
      throw new RangeError('tool-receipt-confidence-invalid');
    }
    const outcomeClass=data.outcomeClass===undefined?'unknown':data.outcomeClass;
    if(!hasCanonicalBoundedText(outcomeClass,64))throw new TypeError('tool-receipt-outcome-class-invalid');
    const verificationBasis=data.verificationBasis===undefined?'none':data.verificationBasis;
    if(!hasCanonicalBoundedText(verificationBasis,48))throw new TypeError('tool-receipt-verification-basis-invalid');

    let observationId:string|null=null;
    if(data.observationId!==undefined&&data.observationId!=='') {
      if(!hasOnlyCanonicalEventId(data.observationId))throw new TypeError('tool-receipt-observation-id-invalid');
      observationId=data.observationId;
    }
    const expectedRaw=data.expectedPostcondition===undefined?'':data.expectedPostcondition;
    const observedRaw=data.observedPostcondition===undefined?'':data.observedPostcondition;
    if(typeof expectedRaw!=='string'||expectedRaw.length>8192)throw new TypeError('tool-receipt-expected-postcondition-invalid');
    if(typeof observedRaw!=='string'||observedRaw.length>8192)throw new TypeError('tool-receipt-observed-postcondition-invalid');
    const expectedCanonical=expectedRaw.normalize('NFKC').trim().toLowerCase();
    const observedCanonical=observedRaw.normalize('NFKC').trim().toLowerCase();
    const expectedPostconditionHash=expectedCanonical?sha256Stable(expectedCanonical):null;
    const observedPostconditionHash=observedCanonical?sha256Stable(observedCanonical):null;

    const atValue=data.at;
    const at=atValue===undefined?Date.now():atValue;
    if(typeof at!=='number'||!Number.isFinite(at)||at<0)throw new RangeError('tool-receipt-timestamp-invalid');

    const normalized={
      tick,executionId,toolId,decisionId:decisionId??null,
      ok,verified,outcomeClass,confidence01,verificationBasis,
      externalObservation,observationId,
      expectedPostconditionPresent:Boolean(expectedCanonical),
      observedPostconditionPresent:Boolean(observedCanonical),
      expectedPostconditionHash,observedPostconditionHash,
      observationIntegrated,
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
        const eventHashes=[action!.payload.projectionHash,outcome!.payload.projectionHash,evidence!.payload.projectionHash];
        const anyEventHash=[action!,outcome!,evidence!].some(event=>hasOwnField(event.payload,'projectionHash'));
        const eventFingerprintMatches=!anyEventHash||(
          eventHashes.every(value=>value===projectionHash)&&
          evidence!.payload.expectedPostconditionHash===expectedPostconditionHash&&
          evidence!.payload.observedPostconditionHash===observedPostconditionHash
        );
        const storedMatches=action!.payload.tool===toolId&&
          action!.payload.decisionId===(decisionId??null)&&
          outcome!.tick===tick&&outcome!.payload.tool===toolId&&outcome!.payload.ok===ok&&
          outcome!.payload.verified===verified&&outcome!.payload.outcomeClass===outcomeClass&&
          Math.abs(clamp01(Number(outcome!.confidence01))-confidence01)<1e-9&&
          evidence!.payload.verificationBasis===verificationBasis&&evidence!.payload.externalObservation===externalObservation&&
          evidence!.payload.observationId===observationId&&evidence!.payload.observationIntegrated===observationIntegrated&&
          evidence!.payload.expectedPostconditionPresent===Boolean(expectedCanonical)&&
          evidence!.payload.observedPostconditionPresent===Boolean(observedCanonical)&&eventFingerprintMatches;
        if(!storedMatches||(prior?.projectionHash&&prior.projectionHash!==projectionHash))throw new Error('tool-receipt-execution-id-conflict');
        const replayEntry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action!.id,outcomeEventId:outcome!.id,evidenceEventId:evidence!.id,projectedAt:prior?.projectedAt??action!.at,projectionHash};
        this.receiptProjectionIndex.set(executionId,replayEntry);
        return {...replayEntry,replayed:true};
      }
    }

    const decision=decisionId?this.events.find(event=>event.id===decisionId):undefined;
    if(decisionId&&!decision)throw new Error('tool-receipt-decision-anchor-not-found');

    return this.withAtomicLedgerMutation(()=>{
      const action=this.append({
        tick,stage:'tool-action',source:'action-gateway',
        parentIds:decision?[decision.id]:[],external:false,
        confidence01:verified?Math.max(.5,confidence01):.5,at,
        payload:{executionId,tool:toolId,decisionId:decision?.id??null,decisionLinked:Boolean(decision),projectionHash},
      });
      const outcome=this.append({
        tick,stage:'tool-outcome',source:'action-gateway-outcome',
        parentIds:[action.id],external:false,confidence01,at,
        payload:{executionId,tool:toolId,ok,verified,outcomeClass,projectionHash},
      });
      const evidence=this.append({
        tick,stage:'tool-evidence',source:'outcome-verification',
        parentIds:[outcome.id],external:externalObservation,confidence01,at,
        payload:{
          executionId,tool:toolId,verificationBasis,externalObservation,observationId,
          observationIntegrated,
          expectedPostconditionPresent:Boolean(expectedCanonical),
          observedPostconditionPresent:Boolean(observedCanonical),
          expectedPostconditionHash,observedPostconditionHash,projectionHash,
        },
      });
      const entry:ToolReceiptProjectionIndexEntry={executionId,actionEventId:action.id,outcomeEventId:outcome.id,evidenceEventId:evidence.id,projectedAt:at,projectionHash};
      this.receiptProjectionIndex.set(executionId,entry);
      while(this.receiptProjectionIndex.size>256) {
        const oldest=this.receiptProjectionIndex.keys().next().value;
        if(oldest===undefined)break;
        this.receiptProjectionIndex.delete(oldest);
      }
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
    const executionId=String(input.executionId??'').trim().slice(0,180);
    const revisionId=String(input.revisionId??'').trim().slice(0,180);
    const toolId=String(input.toolId??'').trim().slice(0,64);
    if(!executionId)return {resolved:false,replayed:false,reason:'execution-id-required'};
    if(!revisionId)return {resolved:false,replayed:false,reason:'revision-id-required'};
    if(!toolId)return {resolved:false,replayed:false,reason:'tool-id-required'};
    if(!/^[a-f0-9]{64}$/i.test(String(input.providerReceiptHash??''))||!/^[a-f0-9]{64}$/i.test(String(input.revisionFingerprint??'')))return {resolved:false,replayed:false,reason:'revision-hash-invalid'};
    const entry=this.receiptProjectionIndex.get(executionId);
    if(!entry||!this.hasToolReceiptTrace(executionId))return {resolved:false,replayed:false,reason:'no-canonical-tool-receipt'};
    const receiptAction=this.events.find(event=>event.id===entry.actionEventId);
    const receiptOutcome=this.events.find(event=>event.id===entry.outcomeEventId);
    if(receiptAction?.payload.tool!==toolId||receiptOutcome?.payload.tool!==toolId)return {resolved:false,replayed:false,reason:'execution-tool-mismatch'};
    const normalized={executionId,toolId,revisionId,revisionNumber:Math.max(1,Math.floor(input.revisionNumber)),providerReceiptHash:String(input.providerReceiptHash).toLowerCase(),revisionFingerprint:String(input.revisionFingerprint).toLowerCase(),outcomeClass:String(input.outcomeClass??'unknown').slice(0,64),ok:Boolean(input.ok),verified:Boolean(input.verified),verificationBasis:String(input.verificationBasis??'none').slice(0,48),confidence01:clamp01(input.confidence01),observationId:String(input.observationId??'').slice(0,180)||null,status:input.status,reason:String(input.reason??'').replace(/[\r\n\t]+/g,' ').slice(0,160)};
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
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
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
    const executionId=String(input.executionId??'').trim().slice(0,180);
    const observationId=String(input.observationId??'').trim().slice(0,180);
    const toolId=String(input.toolId??'').trim().slice(0,64);
    if(!executionId)return {resolved:false,reason:'execution-id-required'};
    if(!observationId)return {resolved:false,reason:'observation-id-required'};
    if(!toolId)return {resolved:false,reason:'tool-id-required'};
    const entry=this.receiptProjectionIndex.get(executionId);
    const byId=new Map(this.events.map(event=>[event.id,event] as const));
    const action=entry?byId.get(entry.actionEventId):this.events.find(event=>event.stage==='tool-action'&&event.payload.executionId===executionId);
    const outcome=entry?byId.get(entry.outcomeEventId):this.events.find(event=>event.stage==='tool-outcome'&&event.payload.executionId===executionId);
    if(!action||!outcome||action.stage!=='tool-action'||outcome.stage!=='tool-outcome'||!outcome.parentIds.includes(action.id))return {resolved:false,reason:'no-canonical-tool-receipt'};
    if(String(action.payload.tool??'')!==toolId||String(outcome.payload.tool??'')!==toolId)return {resolved:false,reason:'execution-tool-mismatch'};
    const expected=String(input.expectedPostcondition??'').normalize('NFKC').trim().toLocaleLowerCase();
    const observed=String(input.observedPostcondition??'').normalize('NFKC').trim().toLocaleLowerCase();
    const safePayload={executionId,toolId,observationId,verified:Boolean(input.verified),confidence01:clamp01(input.confidence01),sourceId:String(input.sourceId??'unknown').slice(0,80),sourceClass:String(input.sourceClass??'unknown').slice(0,32),channel:String(input.channel??'unknown').slice(0,32),independenceKey:String(input.independenceKey??'').slice(0,120),expectedPostconditionHash:expected?sha256Stable(expected):null,observedPostconditionHash:observed?sha256Stable(observed):null,expectedPostconditionPresent:Boolean(expected),observedPostconditionPresent:Boolean(observed),reason:String(input.reason??'').slice(0,160)};
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
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
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
    const ids:Partial<Record<'observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'selfUpdate',string>>={};
    const parents=(...eventIds:(string|undefined)[])=>eventIds.filter((id):id is string=>Boolean(id));
    if(input.observation){const e=this.append({tick:input.tick,stage:'observation',source:input.observation.source??'runtime',external:input.observation.external,confidence01:input.observation.confidence01,payload:input.observation.payload,at:input.at});ids.observation=e.id;}
    if(input.prediction){const e=this.append({tick:input.tick,stage:'prediction',source:input.prediction.source??'prediction',parentIds:parents(ids.observation),confidence01:input.prediction.confidence01,payload:input.prediction.payload,at:input.at});ids.prediction=e.id;}
    if(input.appraisal){const e=this.append({tick:input.tick,stage:'appraisal',source:input.appraisal.source??'appraisal',parentIds:parents(ids.observation,ids.prediction),confidence01:input.appraisal.confidence01,payload:input.appraisal.payload,at:input.at});ids.appraisal=e.id;}
    if(input.attention){const e=this.append({tick:input.tick,stage:'attention',source:input.attention.source??'attention',parentIds:parents(ids.appraisal,ids.prediction),confidence01:input.attention.confidence01,payload:input.attention.payload,at:input.at});ids.attention=e.id;}
    if(input.memory){const e=this.append({tick:input.tick,stage:'memory',source:input.memory.source??'memory',parentIds:parents(ids.attention,ids.observation),confidence01:input.memory.confidence01,payload:input.memory.payload,at:input.at});ids.memory=e.id;}
    if(input.goal){const e=this.append({tick:input.tick,stage:'goal',source:input.goal.source??'goal',parentIds:parents(ids.appraisal,ids.memory,ids.prediction),confidence01:input.goal.confidence01,payload:input.goal.payload,at:input.at});ids.goal=e.id;}
    if(input.plan){const e=this.append({tick:input.tick,stage:'plan',source:input.plan.source??'plan',parentIds:parents(ids.goal,ids.prediction),confidence01:input.plan.confidence01,payload:input.plan.payload,at:input.at});ids.plan=e.id;}
    if(input.action){const e=this.append({tick:input.tick,stage:'action',source:input.action.source??'action',parentIds:parents(ids.plan,ids.prediction,ids.observation),confidence01:input.action.confidence01,payload:input.action.payload,at:input.at});ids.action=e.id;}
    if(input.outcome){const e=this.append({tick:input.tick,stage:'outcome',source:input.outcome.source??'outcome',parentIds:parents(ids.action,ids.prediction),external:input.outcome.external,confidence01:input.outcome.confidence01,payload:input.outcome.payload,at:input.at});ids.outcome=e.id;}
    if(input.learning){const e=this.append({tick:input.tick,stage:'learning',source:input.learning.source??'learning',parentIds:parents(ids.outcome,ids.action),confidence01:input.learning.confidence01,payload:input.learning.payload,at:input.at});ids.learning=e.id;}
    if(input.selfUpdate){const e=this.append({tick:input.tick,stage:'self-update',source:input.selfUpdate.source??'self-update',parentIds:parents(ids.learning,ids.outcome),confidence01:input.selfUpdate.confidence01,payload:input.selfUpdate.payload,at:input.at});ids.selfUpdate=e.id;}
    return ids;
  }

  verifyOperationalCycle(stageIds: OperationalCycleStageIds): OperationalCycleLineageCheck {
    const required = ['observation','prediction','action','outcome','learning','self-update'] as const;
    const optional = ['appraisal','attention','memory','goal','plan'] as const;
    const byId = new Map(this.events.map(event => [event.id, event] as const));
    const found = new Map<string, CognitiveEventNode>();
    const missingStages: string[] = [];
    const invalidStages: string[] = [];
    let cycleTick: number | null = null;

    for (const stage of required) {
      const id = stageIds[stage];
      const event = id ? byId.get(id) : undefined;
      if (!event) { missingStages.push(stage); continue; }
      if (event.stage !== stage) { invalidStages.push(stage + ':expected-stage-' + stage + '-got-' + event.stage); continue; }
      if (cycleTick === null) cycleTick = event.tick;
      if (event.tick !== cycleTick) { invalidStages.push(stage + ':tick-mismatch'); continue; }
      found.set(stage, event);
    }

    for (const stage of optional) {
      const id = stageIds[stage];
      if (id === undefined) continue;
      if (typeof id !== 'string' || !id) { invalidStages.push(stage + ':invalid-id'); continue; }
      const event = byId.get(id);
      if (!event) { invalidStages.push(stage + ':missing-event'); continue; }
      if (event.stage !== stage) { invalidStages.push(stage + ':expected-stage-' + stage + '-got-' + event.stage); continue; }
      if (cycleTick === null) cycleTick = event.tick;
      if (event.tick !== cycleTick) { invalidStages.push(stage + ':tick-mismatch'); continue; }
      found.set(stage, event);
    }

    const requiredEdges: Array<[OperationalCycleStageName, OperationalCycleStageName, string]> = [
      ['prediction','observation','prediction->observation'],
      ['action','prediction','action->prediction'],
      ['action','observation','action->observation'],
      ['outcome','action','outcome->action'],
      ['learning','outcome','learning->outcome'],
      ['self-update','learning','self-update->learning'],
    ];
    const missingEdges: string[] = [];
    let validEdges = 0;
    for (const [childStage, parentStage, label] of requiredEdges) {
      const child = found.get(childStage);
      const parent = found.get(parentStage);
      if (child && parent && child.parentIds.includes(parent.id)) validEdges++;
      else missingEdges.push(label);
    }

    const extendedParents:Record<(typeof optional)[number], readonly OperationalCycleStageName[]> = {
      appraisal:['observation','prediction'],
      attention:['appraisal','prediction'],
      memory:['attention','observation'],
      goal:['appraisal','memory'],
      plan:['goal','prediction'],
    };
    let extendedEdgeCount = 0;
    for (const childStage of optional) {
      if (stageIds[childStage] === undefined) continue;
      const child = found.get(childStage);
      for (const parentStage of extendedParents[childStage]) {
        extendedEdgeCount++;
        const parent = found.get(parentStage);
        if (child && parent && child.parentIds.includes(parent.id)) validEdges++;
        else missingEdges.push(childStage + '->' + parentStage);
      }
    }
    // When a plan is part of the same trace, the action must cite that plan.
    if (stageIds.plan !== undefined) {
      extendedEdgeCount++;
      const action = found.get('action');
      const plan = found.get('plan');
      if (action && plan && action.parentIds.includes(plan.id)) validEdges++;
      else missingEdges.push('action->plan');
    }

    const requiredFoundCount = required.filter(stage => found.has(stage)).length;
    const stageCoverage = requiredFoundCount / required.length;
    const optionalRequestedCount = optional.filter(stage => stageIds[stage] !== undefined).length;
    const optionalCoverage = optionalRequestedCount
      ? optional.filter(stage => stageIds[stage] !== undefined && found.has(stage)).length / optionalRequestedCount
      : 1;
    const edgeCoverage = validEdges / Math.max(1, requiredEdges.length + extendedEdgeCount);
    const integrity01 = clamp01(.50 * stageCoverage + .32 * edgeCoverage + .18 * optionalCoverage);
    const complete = missingStages.length === 0 && invalidStages.length === 0 && missingEdges.length === 0;
    return { tick: cycleTick, complete, integrity01: complete ? 1 : integrity01, missingStages, invalidStages, missingEdges };
  }

  getById(id:string):CognitiveEventNode|null {
    const normalized=typeof id==='string'?id.trim():'';
    if(!normalized)return null;
    const event=this.events.find(row=>row.id===normalized);
    return event?structuredClone(event):null;
  }

  recent(limit=64):CognitiveEventNode[]{return structuredClone(this.events.slice(0,Math.max(1,Math.min(256,Math.floor(limit)))));}

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
    const receiptEvents=this.events.filter(event=>receiptIds.has(event.id)&&!recentIds.has(event.id)).map(event=>({...event,parentIds:[...event.parentIds],payload:{...event.payload}}));
    return{version:1,capacity:this.capacity,total:this.total,buffered:this.events.length,linkedParentEvents:linked,danglingParentLinks:dangling,lineageIntegrity01:clamp01(linked/Math.max(1,totalParentRefs)),cycleCoverage01:coverage,causalDensity01:clamp01(linked/Math.max(1,this.events.length*2)),recentTicks,recent,receiptEvents,receiptProjectionIndex:[...this.receiptProjectionIndex.values()]};
  }
}
