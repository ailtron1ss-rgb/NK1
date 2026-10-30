import type { ActionKind } from '../core/types.ts';
import { randomUUID } from 'node:crypto';
import {
  OutcomeVerificationService,
  assessExternalPostcondition,
  isTrustedDecisionLinkedExternalPostcondition,
  type OutcomeVerification,
  type OutcomeVerifier,
} from './OutcomeVerificationService.ts';
import { sha256Stable, stableJson } from '../core/StableSerialization.ts';
import type { ExternalObservationChannel, ExternalObservationSourceClass } from './ExternalObserverFabric.ts';
import { cloneFrozenToolInputContract, cloneFrozenToolOutputContract, validateToolInputContract, validateToolOutputContract, type ToolInputContract, type ToolOutputContract } from './ToolInputContract.ts';

export type ActionOutcomeClass =
  | 'unavailable'
  | 'competence-insufficient'
  | 'gate-check-failed'
  | 'policy-refused'
  | 'execution-failed'
  | 'executed-unverified'
  | 'executed-verified'
  | 'executed-contradicted'
  | 'idempotency-conflict'
  | 'idempotency-recovery-required'
  | 'idempotency-storage-failed'
  | 'idempotency-ledger-full'
  | 'failed-no-effect'
  | 'executed-partial'
  | 'reconciled-not-executed'
  | 'idempotency-key-required'
  | 'approval-required'
  | 'approval-invalid'
  | 'approval-storage-failed';


const EXECUTOR_ENTERED_OUTCOMES: ReadonlySet<ActionOutcomeClass> = new Set([
  'execution-failed',
  'failed-no-effect',
  'executed-unverified',
  'executed-verified',
  'executed-contradicted',
  'executed-partial',
]);

/** True only when the registered tool executor was entered for this outcome. */
export function wasToolExecutorEntered(outcomeClass: ActionOutcomeClass | string | undefined): boolean {
  return typeof outcomeClass === 'string' && EXECUTOR_ENTERED_OUTCOMES.has(outcomeClass as ActionOutcomeClass);
}

export class ToolExecutionUncertainError extends Error {
  readonly code = 'TOOL_EXECUTION_OUTCOME_UNCERTAIN';
  constructor(message = 'tool-execution-outcome-uncertain') { super(message); this.name = 'ToolExecutionUncertainError'; }
}

/**
 * Adapter attestation that the operation did not cross its side-effect boundary.
 * This is intentionally a separate error type: a generic timeout/transport error
 * from a keyed mutating tool is ambiguous and must leave its durable receipt pending.
 */
export class ToolExecutionNoEffectError extends Error {
  readonly code = 'TOOL_EXECUTION_FAILED_NO_EFFECT';
  constructor(message = 'tool-execution-failed-no-effect') { super(message); this.name = 'ToolExecutionNoEffectError'; }
}

/**
 * Adapter attestation that an operation partially changed the external target.
 * The gateway does not terminalize or learn from this response until read-only
 * provider reconciliation establishes the authoritative final state.
 */
export class ToolExecutionPartialError extends Error {
  readonly code = 'TOOL_EXECUTION_PARTIAL';
  constructor(message = 'tool-execution-partial') { super(message); this.name = 'ToolExecutionPartialError'; }
}

export interface ActionAuditRecord {
  at:number; executionId?:string; action:ActionKind|'tool'; tool?:string; accepted:boolean;
  mode:'dry-run'|'live'; reason:string; verified?:boolean;
  verificationBasis?:'none'|'tool-contract'|'external-postcondition';
  verificationConfidence01?:number; observationId?:string; result?:string;
  /** Outcome semantics are kept separate from competence and availability. */
  outcomeClass?:ActionOutcomeClass;
  competenceConfidence01?:number;
}
export interface ActionGatewayExecutionOptions {
  /** Caller-supplied stable identity for one logical side effect. Never use a fresh random value on retry. */
  idempotencyKey?: string;
  /** Exact canonical decision link from the host; never inferred from executionId. */
  decisionId?: string;
  /** Set only when the host can assert that this tool was initiated autonomously. */
  autonomous?: boolean;
  /** Skill-level result shape constraints that must be evaluated before a keyed receipt is committed. */
  expectedOutputKeys?: string[];
  /** One-shot, time-limited user approval bound to the exact tool and canonical request. */
  approvalId?: string;
}
export interface ToolObservationSource {
  sourceId: string;
  sourceClass: ExternalObservationSourceClass;
  channel: ExternalObservationChannel;
  /** Stable identity for the upstream source (not a per-observation identifier). */
  independenceKey: string;
}
export interface ActionExecutionFinalizationContext {
  toolId: string; input: Record<string, unknown>; reason: string; result: ToolExecution; options: ActionGatewayExecutionOptions;
  /** Ephemeral process-local attestation computed before cloning verifier objects; never persisted as authority. */
  decisionLinkedExternalPostcondition: boolean;
}
export interface ActionExecutionLedgerEntry {
  keyHash:string; requestHash:string; status:'pending'|'completed'; recordedAt:number;
  /** Deterministic per logical operation; retained even when a crash leaves the receipt pending. */
  executionId?:string; toolId?:string; decisionId?:string; autonomous?:boolean;
  response?:ToolExecution; responseOmitted?:boolean;
}

export interface ToolExecutionContext {
  /** Stable across every retry/recovery of the same keyed operation. */
  executionId:string;
  /** SHA-256 digest of the idempotency key; safe to pass to an external provider as its idempotency token. */
  idempotencyKey?:string;
  decisionId?:string;
  autonomous:boolean;
}
export type ActionToolPermissionClass = 'web'|'device'|'filesystem'|'code'|'system'|'self-modification';
export type ActionToolApprovalOperation = 'execute'|'reconcile'|'direct';
export type ActionToolApprovalStatus = 'pending'|'approved'|'declined'|'consumed'|'expired';
export interface ActionToolApprovalRecord {
  id:string; toolId:string; permissionClass:ActionToolPermissionClass; operation:ActionToolApprovalOperation;
  requestHash:string; status:ActionToolApprovalStatus; createdAt:number; expiresAt:number;
  resolvedAt?:number; consumedAt?:number; actor?:string; reasonCode:string;
  inputKeys:string[]; inputPreview:Record<string,unknown>; decisionId?:string; autonomous:boolean;
}
export interface ActionToolPermissionSnapshot {version:1; requests:ActionToolApprovalRecord[]; created:number; approved:number; declined:number; consumed:number; expired:number; lastChangeAt:number;}
export interface ActionExecutionLedgerSnapshot { version:1; records:ActionExecutionLedgerEntry[]; permissions?:ActionToolPermissionSnapshot; }
export interface ActionExecutionLedgerArchiveMetadata {
  keyHash:string; requestHash:string; status:'completed'; executionId?:string; toolId?:string; decisionId?:string;
  recordedAt:number; outcomeClass?:ActionOutcomeClass; verified?:boolean; reconciled?:boolean;
}
export interface ActionExecutionLedgerArchivePort {
  get(keyHash:string):Promise<ActionExecutionLedgerEntry|undefined>;
  append(entry:ActionExecutionLedgerEntry):Promise<void>;
  /** Append an authoritative, identity-preserving reconciliation revision to an unresolved archived receipt. */
  appendRevision?(entry:ActionExecutionLedgerEntry):Promise<void>;
  metadataFor?(keyHash:string):ActionExecutionLedgerArchiveMetadata|undefined;
  unresolvedEntries?():ActionExecutionLedgerArchiveMetadata[];
  metrics?:()=>{entries:number;bytes:number;loaded:boolean};
}
export interface ActionGatewayConfig { live?:boolean; allow?:ActionKind[]; maxIdempotencyRecords?:number; }
export interface ToolAvailability {
  available:boolean;
  reason?:string;
}
export interface ToolCompetence {
  competent:boolean;
  confidence01?:number;
  reason?:string;
}
export type ToolReceiptLookup =
  | { status:'found'; authoritative:true; receiptId:string; result:Record<string,unknown>; checkedAt?:number }
  | { status:'not-found'; authoritative:true; reason:string; checkedAt?:number }
  | { status:'unknown'; reason?:string; retryAfterMs?:number; checkedAt?:number };

export interface ToolDefinition {
  id:string; capability:string; destructive:boolean; projectAllowed?:boolean;
  execute:(input:Record<string,unknown>, context?:ToolExecutionContext)=>Promise<Record<string,unknown>>;
  /** Declarative input contract checked before approval, receipt admission and execution. */
  inputContract?: ToolInputContract;
  /** Optional output contract; invalid output is recorded as executed-but-unverified. */
  outputContract?: ToolOutputContract;
  /** This action is unsafe to invoke without a stable key and durable receipt ledger. */
  requiresIdempotencyKey?:boolean;
  /**
   * Authoritative provider receipt lookup for a previously persisted pending operation.
   * Must be read-only and must never execute or retry the requested side effect.
   */
  reconcile?:(input:Record<string,unknown>, context:ToolExecutionContext)=>Promise<ToolReceiptLookup>;
  verify?:OutcomeVerifier;
  /** Tool-local precondition check. A missing tool and an unavailable tool are not failures of competence. */
  availability?:(input:Record<string,unknown>)=>ToolAvailability;
  /** Optional explicit competence check. A policy refusal must never be converted into a competence failure. */
  competence?:(input:Record<string,unknown>)=>ToolCompetence;
  /** Declares the independent source identity for verified external postconditions. */
  observationSource?: ToolObservationSource;
  /** Explicitly governed capability class; inferred from ID/capability when omitted. */
  permissionClass?: ActionToolPermissionClass;
}
export interface ToolExecution {
  ok:boolean; verified:boolean; executionId:string; tool:string; capability:string;
  result:Record<string,unknown>; audit:ActionAuditRecord; verification:OutcomeVerification;
  outcomeClass:ActionOutcomeClass;
  competenceConfidence01?:number;
  /** True only when this response was served from the idempotency ledger. */
  idempotentReplay?:boolean;
  /** True when a prior pending receipt was resolved using the provider's read-only lookup. */
  reconciled?:boolean;
  /** Opaque provider receipt identity, not the raw response body. */
  providerReceiptId?:string;
  idempotencyStatus?:'recorded'|'replayed'|'recovery-required'|'conflict'|'payload-omitted'|'reconciled'|'confirmed-not-executed';
}
const DEFAULT_ALLOWED:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const unavailableVerification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'not executed'};
/**
 * Even legacy tools without a declared schema must receive inert JSON data.
 * This envelope rejects accessors, proxies, cycles, exotic prototypes and
 * oversized/deep payloads before hashing, previewing, approving or executing.
 * Per-tool contracts remain stricter and take precedence when registered.
 */
const DEFAULT_TOOL_INPUT_ENVELOPE:ToolInputContract=Object.freeze({
  type:'object', additionalProperties:true, maxProperties:32, maxSerializedBytes:65_536,
});
function classifyVerifiedExecution(toolOk:boolean, verification:OutcomeVerification):{ok:boolean;verified:boolean;outcomeClass:ActionOutcomeClass;contradicted:boolean} {
  const assessment=assessExternalPostcondition(verification);
  const contradicted=toolOk && assessment==='contradiction';
  const ok=toolOk && !contradicted;
  const verified=ok && (assessment==='match' || (assessment==='not-external' && verification.verified===true));
  const outcomeClass:ActionOutcomeClass=!toolOk?'execution-failed':contradicted?'executed-contradicted':verified?'executed-verified':'executed-unverified';
  return {ok,verified,outcomeClass,contradicted};
}
const defaultActionToolPermissions=():ActionToolPermissionSnapshot=>({version:1,requests:[],created:0,approved:0,declined:0,consumed:0,expired:0,lastChangeAt:0});
const DIRECT_PERMISSION_ACTIONS = new Set(['http.voice.speak','http.voice.listen','http.voice.turn','http.voice.speak-reply']);
function inferPermissionClass(id:string, capability=''):ActionToolPermissionClass|null {
  const normalizedId=String(id||'').toLocaleLowerCase();
  // Synthesized conversational audio is an output channel, not a privileged device
  // command. It still requires durable idempotency; the adapter is not allowed to
  // bypass ActionGateway. Listening, camera, and other device operations remain gated.
  if (normalizedId==='organism.device.speak' || normalizedId==='android.speak' || normalizedId==='organism.device.speech.interrupt') return null;
  if (DIRECT_PERMISSION_ACTIONS.has(normalizedId) || /^http\.voice\./.test(normalizedId)) return 'device';
  if (/^http\.(research|integration\.(web|outbound))\./.test(normalizedId)) return 'web';
  const text=`${id} ${capability}`.toLocaleLowerCase();
  if (/self[._ -]?modif|self[._ -]?improv|hot[._ -]?patch|identity[._ -]?change|code[._ -]?mutation/.test(text)) return 'self-modification';
  if (/(^|[ ._-])(web|internet|browser|http|external[ ._-]?research|search[ ._-]?web)([ ._-]|$)/.test(text) || /project\.external\.research/.test(text)) return 'web';
  if (/(^|[ ._-])(device|phone|camera|microphone|mic|audio|speech|sensor|termux)([ ._-]|$)/.test(text) || /http\.voice\./.test(text)) return 'device';
  if (/(^|[ ._-])(filesystem|file[ ._-]?(read|write|delete|move|edit)|directory|path[ ._-]?write)([ ._-]|$)/.test(text)) return 'filesystem';
  if (/(^|[ ._-])(code|shell|terminal|process|exec|command|script[ ._-]?run)([ ._-]|$)/.test(text)) return 'code';
  if (/(^|[ ._-])(system|service|restart|shutdown|settings[ ._-]?write|configuration[ ._-]?write)([ ._-]|$)/.test(text)) return 'system';
  return null;
}

const MUTATING_ACTION_TOKENS = new Set([
  'write','set','send','speak','speech','listen','turn','capture','create','update','patch','post','put',
  'delete','remove','move','rename','upload','execute','exec','run','command','install','launch','start',
  'stop','shutdown','restart','modify','mutate','commit','publish','dispatch','type','press','tap','transfer',
  'purchase','save','append','outbound','rewrite','apply','edit','change','record','submit','trigger','invoke',
]);
const READ_ONLY_ACTION_TOKENS = new Set([
  'read','get','list','query','search','inspect','status','health','observe','lookup','fetch','discover',
  'check','preview','describe','resolve','verify','reconcile','snapshot','metadata','capabilities','help',
]);
function requiresDurableIdempotency(tool:ToolDefinition|undefined):boolean {
  if (!tool) return false;
  if (tool.requiresIdempotencyKey === true || tool.destructive === true) return true;
  const text=`${tool.id} ${tool.capability}`.toLocaleLowerCase();
  const tokens=text.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some(token=>MUTATING_ACTION_TOKENS.has(token))) return true;
  const permission=tool.permissionClass??inferPermissionClass(tool.id,tool.capability);
  // Unknown code/device/system operations default to keyed execution unless the
  // name/capability explicitly identifies a read-only operation. Browser research
  // stays optional-key unless it performs outbound writes (classified above).
  if (permission && ['device','filesystem','code','system','self-modification'].includes(permission)) {
    return !tokens.some(token=>READ_ONLY_ACTION_TOKENS.has(token));
  }
  return false;
}
function safeApprovalPreview(input:Record<string,unknown>):{keys:string[];preview:Record<string,unknown>} {
  const preview:Record<string,unknown>={};
  const redact=/(secret|password|passwd|token|authorization|credential|cookie|api.?key|private.?key|access.?key|raw.?content|binary|base64|file.?content|document.?body|prompt.?context|^(?:content|fileContents?|patch|diff|raw|document|body)$)/i;
  const entries=Object.entries(input).slice(0,24);
  for(const [key,value] of entries) {
    if(redact.test(key)){preview[key]='[redacted]';continue;}
    if(value===null||typeof value==='number'||typeof value==='boolean'){preview[key]=value;continue;}
    if(typeof value==='string'){
      const safe=value
        .replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/ig,'$1[redacted]')
        .replace(/([?&](?:access[_-]?token|refresh[_-]?token|token|key|secret|password|api[_-]?key|client[_-]?secret)=)[^&\s]+/ig,'$1[redacted]')
        .replace(/(https?:\/\/)[^:/@\s]+:[^/@\s]+@/ig,'$1[redacted]@')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig,'[email]')
        .replace(/(?<!\w)\+?\d[\d .()/-]{7,}\d(?!\w)/g,'[phone]');
      preview[key]=safe.length>600?`${safe.slice(0,600)}… [${safe.length} chars]`:safe;
      continue;
    }
    if(Array.isArray(value)){preview[key]=`[array: ${value.length} items]`;continue;}
    if(typeof value==='object'&&value){preview[key]=`[object: ${Object.keys(value as object).slice(0,12).join(', ')}]`;continue;}
    preview[key]='[unsupported value]';
  }
  return {keys:entries.map(([key])=>key),preview};
}
function canonicalExpectedOutputKeys(values:unknown):string[]|null {
  if (!Array.isArray(values)) return null;
  return [...new Set(values.map((value)=>String(value).trim()).filter(Boolean))].sort().slice(0,32);
}
export class ActionGateway {
  private readonly live:boolean;
  private readonly allowed:Set<ActionKind>;
  private readonly tools=new Map<string,ToolDefinition>();
  private history:ActionAuditRecord[]=[];
  private readonly verifier=new OutcomeVerificationService();
  private readonly maxIdempotencyRecords:number;
  private readonly executionLedger=new Map<string,ActionExecutionLedgerEntry>();
  private permissionState:ActionToolPermissionSnapshot=defaultActionToolPermissions();
  private permissionAdmissionTail:Promise<void>=Promise.resolve();
  private readonly inFlight=new Map<string,{requestHash:string;kind:'execute'|'reconcile';promise:Promise<ToolExecution>}>();
  private ledgerAdmissionTail:Promise<void>=Promise.resolve();
  private executionLedgerPersister:((snapshot:ActionExecutionLedgerSnapshot)=>Promise<void>|void)|undefined;
  private executionLedgerArchive:ActionExecutionLedgerArchivePort|undefined;
  private executionFinalizer:((context:ActionExecutionFinalizationContext)=>Promise<void>|void)|undefined;

  constructor(config:ActionGatewayConfig={}){this.live=Boolean(config.live);this.allowed=new Set(config.allow??DEFAULT_ALLOWED);this.maxIdempotencyRecords=Math.max(16,Math.min(512,Math.floor(config.maxIdempotencyRecords??128)));}

  setExecutionLedgerPersister(persist:(snapshot:ActionExecutionLedgerSnapshot)=>Promise<void>|void):void {
    this.executionLedgerPersister=persist;
  }

  setExecutionLedgerArchive(archive:ActionExecutionLedgerArchivePort):void { this.executionLedgerArchive=archive; }

  executionLedgerMetrics(){return {hotRecords:this.executionLedger.size,maxHotRecords:this.maxIdempotencyRecords,archive:this.executionLedgerArchive?.metrics?.()??{entries:0,bytes:0,loaded:false},durablePersisterConfigured:Boolean(this.executionLedgerPersister)};}

  /** Unresolved persisted receipts mean a side effect may have happened without a committed outcome. */
  private isUnresolvedLedgerEntry(entry:ActionExecutionLedgerEntry|ActionExecutionLedgerArchiveMetadata):boolean {
    if(entry.status==='pending') return true;
    const response='response' in entry ? entry.response : undefined;
    const outcomeClass=response?.outcomeClass ?? ('outcomeClass' in entry ? entry.outcomeClass : undefined);
    const verified=response?.verified ?? ('verified' in entry ? entry.verified : undefined);
    if(entry.status!=='completed') return false;
    if(!response && !('outcomeClass' in entry)) return true;
    return outcomeClass!=='failed-no-effect' && wasToolExecutorEntered(outcomeClass) && verified!==true;
  }

  unresolvedExecutionCount():number {
    const unresolved=new Set<string>();
    for(const entry of this.executionLedger.values()) {
      const archived=this.executionLedgerArchive?.metadataFor?.(entry.keyHash);
      if(archived) {
        if(this.isUnresolvedLedgerEntry(archived)) unresolved.add(entry.keyHash);
      } else if(this.isUnresolvedLedgerEntry(entry)) unresolved.add(entry.keyHash);
    }
    for(const entry of this.executionLedgerArchive?.unresolvedEntries?.()??[]) unresolved.add(entry.keyHash);
    return unresolved.size;
  }

  /**
   * Redacted recovery queue merges hot and archived ledger rows. The archive's latest
   * revision wins over a stale hot shadow. No key hashes, request fingerprints, raw
   * inputs, or provider receipt payloads leave the gateway.
   */
  unresolvedExecutionSnapshot(limit=32, at=Date.now()) {
    const max=Math.max(1,Math.min(64,Math.floor(Number(limit)||32)));
    const byKey=new Map<string,ActionExecutionLedgerEntry|ActionExecutionLedgerArchiveMetadata>();
    for(const entry of this.executionLedger.values()) {
      const archived=this.executionLedgerArchive?.metadataFor?.(entry.keyHash);
      const selected=archived??entry;
      if(this.isUnresolvedLedgerEntry(selected)) byKey.set(entry.keyHash,selected);
    }
    for(const entry of this.executionLedgerArchive?.unresolvedEntries?.()??[]) byKey.set(entry.keyHash,entry);
    const rows=[...byKey.values()].sort((a,b)=>a.recordedAt-b.recordedAt || String(a.executionId??'').localeCompare(String(b.executionId??'')));
    return {
      version:1 as const,
      generatedAt:Math.max(0,Number(at)||Date.now()),
      unresolvedCount:rows.length,
      returnedCount:Math.min(rows.length,max),
      entries:rows.slice(0,max).map(entry=>{
        const toolId=String(entry.toolId??'unknown-tool');
        const definition=this.tools.get(toolId);
        const pending=entry.status==='pending';
        const ledgerEntry=entry as ActionExecutionLedgerEntry;
        const archiveEntry=entry as ActionExecutionLedgerArchiveMetadata;
        const outcomeClass=('response' in entry ? ledgerEntry.response?.outcomeClass : archiveEntry.outcomeClass)??null;
        const outcomeVerified='response' in entry ? ledgerEntry.response?.verified : archiveEntry.verified;
        const outcomeUnverified=!pending && outcomeClass!=='failed-no-effect' && wasToolExecutorEntered(outcomeClass??undefined) && outcomeVerified!==true;
        return {
          executionId:entry.executionId??null,
          toolId,
          decisionId:entry.decisionId??null,
          ledgerStatus:entry.status,
          status:pending?'reconciliation-required':outcomeUnverified?'outcome-unverified-requires-reconciliation':'completed-receipt-missing-response',
          outcomeClass,
          recordedAt:entry.recordedAt,
          ageMs:Math.max(0,(Number(at)||Date.now())-entry.recordedAt),
          reconciliationSupported:Boolean(definition?.reconcile),
          registeredTool:Boolean(definition),
          nextAction:(pending||outcomeUnverified)?(definition?.reconcile?'provider-read-only-reconciliation':'manual-reconciliation-required'):'inspect-durable-ledger',
          reasonCode:pending?'side-effect-may-have-occurred':outcomeUnverified?'external-postcondition-unresolved':'completed-receipt-response-missing',
        };
      }),
      redacted:true as const,
      readOnly:true as const,
    };
  }

  /** Finalization runs before the completed receipt is durably committed. This lets the host atomically save the receipt with causal/evidence projections. */
  setExecutionFinalizer(finalize:(context:ActionExecutionFinalizationContext)=>Promise<void>|void):void {
    this.executionFinalizer=finalize;
  }

  observationSourceForTool(id:string):ToolObservationSource|undefined {
    const source=this.tools.get(id)?.observationSource;
    return source?structuredClone(source):undefined;
  }

  snapshotExecutionLedger():ActionExecutionLedgerSnapshot {
    return {version:1,records:[...this.executionLedger.values()].sort((a,b)=>b.recordedAt-a.recordedAt).map(row=>structuredClone(row)),permissions:structuredClone(this.permissionState)};
  }

  /** User review queue; public rows omit full request hashes, actors and any raw input. */
  toolPermissionSnapshot(at=Date.now()) {
    this.expirePermissionRequests(at);
    return { version:1 as const, requests:this.permissionState.requests.slice(-64).map(row=>this.publicApproval(row)), created:this.permissionState.created, approved:this.permissionState.approved, declined:this.permissionState.declined, consumed:this.permissionState.consumed, expired:this.permissionState.expired, lastChangeAt:this.permissionState.lastChangeAt, requiredClasses:['web','device','filesystem','code','system','self-modification'], pending:this.permissionState.requests.filter(x=>x.status==='pending'||x.status==='approved').length };
  }

  private withPermissionAdmission<T>(operation:()=>Promise<T>):Promise<T> {
    const current=this.permissionAdmissionTail.then(operation,operation);
    this.permissionAdmissionTail=current.then(()=>undefined,()=>undefined);
    return current;
  }

  private permissionClassFor(id:string):ActionToolPermissionClass|null {
    return this.tools.get(id)?.permissionClass ?? inferPermissionClass(id,this.tools.get(id)?.capability ?? '');
  }

  private approvalFingerprint(toolId:string,input:Record<string,unknown>,options:ActionGatewayExecutionOptions,operation:ActionToolApprovalOperation):string {
    return sha256Stable({toolId,input,operation,decisionId:typeof options.decisionId==='string'?options.decisionId.trim()||null:null,autonomous:Boolean(options.autonomous),expectedOutputKeys:canonicalExpectedOutputKeys(options.expectedOutputKeys)});
  }

  async requestToolApproval(toolId:string,input:Record<string,unknown>={},reason='user-request',options:ActionGatewayExecutionOptions={},operation:ActionToolApprovalOperation='execute') {
    return this.withPermissionAdmission(async()=>{
    const permissionClass=this.permissionClassFor(toolId) ?? (DIRECT_PERMISSION_ACTIONS.has(toolId)?'device':null);
    if(!permissionClass) throw new Error('approval-not-required-for-this-tool');
    if(!['execute','reconcile','direct'].includes(operation)) throw new Error('invalid-approval-operation');
    const registered=this.tools.get(toolId);
    const inputValidation=validateToolInputContract(input,registered?.inputContract??DEFAULT_TOOL_INPUT_ENVELOPE);
    if(!inputValidation.valid) throw new Error('approval-input-invalid');
    let requestHash:string;
    try { requestHash=this.approvalFingerprint(toolId,input,options,operation); } catch { throw new Error('approval-input-not-serializable'); }
    const at=Date.now(); this.expirePermissionRequests(at);
    const duplicate=this.permissionState.requests.find(x=>x.toolId===toolId&&x.requestHash===requestHash&&x.status==='pending'&&x.expiresAt>at);
    if(duplicate) return structuredClone({created:false,request:this.publicApproval(duplicate)});
    const summary=safeApprovalPreview(input);
    const rec:ActionToolApprovalRecord={id:`approval-${randomUUID()}`,toolId,permissionClass,operation,requestHash,status:'pending',createdAt:at,expiresAt:at+5*60_000,
      reasonCode:String(reason||'user-request').replace(/[\r\n\t]+/g,' ').slice(0,120),inputKeys:summary.keys,inputPreview:summary.preview,
      ...(typeof options.decisionId==='string'&&options.decisionId.trim()?{decisionId:options.decisionId.trim().slice(0,180)}:{}),autonomous:Boolean(options.autonomous)};
    this.permissionState.requests=[...this.permissionState.requests,rec].slice(-128);
    this.permissionState.created++; this.permissionState.lastChangeAt=at;
    try { await this.persistExecutionLedger(); } catch { this.permissionState.requests=this.permissionState.requests.filter(x=>x.id!==rec.id); this.permissionState.created=Math.max(0,this.permissionState.created-1); return {created:false,error:'approval-storage-failed',request:null}; }
    return {created:true,request:this.publicApproval(rec)};
    });
  }

  async resolveToolApproval(requestId:string,approved:boolean,actor='owner') {
    return this.withPermissionAdmission(async()=>{
    const at=Date.now(); this.expirePermissionRequests(at);
    const row=this.permissionState.requests.find(x=>x.id===requestId);
    if(!row) return {ok:false,error:'approval-request-not-found'};
    if(row.status!=='pending') return {ok:false,error:`approval-request-not-pending:${row.status}`,request:this.publicApproval(row)};
    if(row.expiresAt<=at){row.status='expired';this.permissionState.expired++;this.permissionState.lastChangeAt=at;await this.persistExecutionLedger().catch(()=>{});return {ok:false,error:'approval-request-expired',request:this.publicApproval(row)};}
    row.status=approved?'approved':'declined'; row.resolvedAt=at; row.actor=String(actor||'owner').slice(0,40);
    if(approved)this.permissionState.approved++;else this.permissionState.declined++;
    this.permissionState.lastChangeAt=at;
    try { await this.persistExecutionLedger(); } catch { row.status='pending'; row.resolvedAt=undefined; row.actor=undefined; if(approved)this.permissionState.approved=Math.max(0,this.permissionState.approved-1);else this.permissionState.declined=Math.max(0,this.permissionState.declined-1); return {ok:false,error:'approval-storage-failed'}; }
    return {ok:true,request:this.publicApproval(row)};
    });
  }

  /** Consume a single approved ticket before a protected side effect starts. */
  async consumeDirectActionApproval(toolId:string,input:Record<string,unknown>,approvalId:string|undefined,options:ActionGatewayExecutionOptions={},operation:ActionToolApprovalOperation='direct'):Promise<{ok:boolean;reason?:string}> {
    return this.withPermissionAdmission(async()=>{
    const permissionClass=this.permissionClassFor(toolId) ?? (DIRECT_PERMISSION_ACTIONS.has(toolId)?'device':null);
    if(!permissionClass) return {ok:true};
    const registered=this.tools.get(toolId);
    const inputValidation=validateToolInputContract(input,registered?.inputContract??DEFAULT_TOOL_INPUT_ENVELOPE);
    if(!inputValidation.valid) return {ok:false,reason:'approval-input-invalid'};
    if(!approvalId) return {ok:false,reason:'user-approval-required'};
    let fingerprint:string; try{fingerprint=this.approvalFingerprint(toolId,input,options,operation);}catch{return {ok:false,reason:'approval-input-not-serializable'};}
    const now=Date.now(); this.expirePermissionRequests(now);
    const row=this.permissionState.requests.find(x=>x.id===approvalId);
    if(!row) return {ok:false,reason:'approval-request-not-found'};
    if(row.expiresAt<=now||row.status==='expired'){return {ok:false,reason:'approval-request-expired'};}
    if(row.status!=='approved') return {ok:false,reason:`approval-not-approved:${row.status}`};
    if(row.toolId!==toolId||row.permissionClass!==permissionClass||row.operation!==operation||row.requestHash!==fingerprint) return {ok:false,reason:'approval-does-not-match-action'};
    const priorLastChangeAt=this.permissionState.lastChangeAt;
    row.status='consumed'; row.consumedAt=now; this.permissionState.consumed++; this.permissionState.lastChangeAt=now;
    try { await this.persistExecutionLedger(); }
    catch { row.status='approved'; row.consumedAt=undefined; this.permissionState.consumed=Math.max(0,this.permissionState.consumed-1); this.permissionState.lastChangeAt=priorLastChangeAt; return {ok:false,reason:'approval-storage-failed'}; }
    return {ok:true};
    });
  }

  private expirePermissionRequests(at=Date.now()) {
    let changed=false;
    for(const row of this.permissionState.requests) if((row.status==='pending'||row.status==='approved')&&row.expiresAt<=at){row.status='expired';changed=true;this.permissionState.expired++;}
    if(changed)this.permissionState.lastChangeAt=at;
  }
  private publicApproval(row:ActionToolApprovalRecord) { return {id:row.id,toolId:row.toolId,permissionClass:row.permissionClass,operation:row.operation,status:row.status,createdAt:row.createdAt,expiresAt:row.expiresAt,resolvedAt:row.resolvedAt,consumedAt:row.consumedAt,reasonCode:row.reasonCode,inputKeys:row.inputKeys,inputPreview:row.inputPreview,decisionId:row.decisionId,autonomous:row.autonomous,requestHashPrefix:row.requestHash.slice(0,12)}; }


  restoreExecutionLedger(snapshot:unknown):void {
    const raw=snapshot && typeof snapshot==='object' ? snapshot as Partial<ActionExecutionLedgerSnapshot> : {};
    const rows=Array.isArray(raw.records)?raw.records:[];
    const restored=new Map<string,ActionExecutionLedgerEntry>();
    for(const value of rows) {
      if(!value || typeof value!=='object') continue;
      const row=value as ActionExecutionLedgerEntry;
      if(!/^[a-f0-9]{64}$/i.test(String(row.keyHash??'')) || !/^[a-f0-9]{64}$/i.test(String(row.requestHash??''))) continue;
      if(row.status!=='pending' && row.status!=='completed') continue;
      const recordedAt=Number(row.recordedAt); if(!Number.isFinite(recordedAt)||recordedAt<0) continue;
      const safe:ActionExecutionLedgerEntry={keyHash:row.keyHash.toLowerCase(),requestHash:row.requestHash.toLowerCase(),status:row.status,recordedAt,
        ...(typeof row.executionId==='string'&&/^exec-[a-z0-9-]{8,80}$/i.test(row.executionId)?{executionId:row.executionId}:{}),
        ...(typeof row.toolId==='string'&&row.toolId.length<=64?{toolId:row.toolId}:{}),
        ...(typeof row.decisionId==='string'&&row.decisionId.length<=180?{decisionId:row.decisionId}:{}),
        ...(typeof row.autonomous==='boolean'?{autonomous:row.autonomous}:{})};
      if(row.status==='completed' && row.response && typeof row.response==='object') {
        try {
          const response=structuredClone(row.response) as ToolExecution;
          const audit=response?.audit;
          const verification=response?.verification;
          const structurallyValid=Boolean(response && typeof response==='object' &&
            typeof response.ok==='boolean' && typeof response.verified==='boolean' &&
            typeof response.executionId==='string' && typeof response.tool==='string' &&
            typeof response.capability==='string' && response.result!==null &&
            typeof response.result==='object' && !Array.isArray(response.result) &&
            audit && typeof audit==='object' && typeof audit.accepted==='boolean' &&
            verification && typeof verification==='object' && typeof verification.verified==='boolean');
          const identityValid=structurallyValid &&
            typeof safe.executionId==='string' && response.executionId===safe.executionId &&
            typeof safe.toolId==='string' && response.tool===safe.toolId &&
            (audit.executionId===undefined || audit.executionId===response.executionId) &&
            (audit.tool===undefined || audit.tool===response.tool);
          const outcomeConsistent=identityValid &&
            audit.accepted===response.ok &&
            (audit.verified===undefined || audit.verified===response.verified) &&
            (audit.outcomeClass===undefined || audit.outcomeClass===response.outcomeClass) &&
            (response.verified!==true || verification.verified===true);
          const responseBytes=outcomeConsistent ? new TextEncoder().encode(stableJson(response)).byteLength : Infinity;
          // A restored receipt is replayable only if its identity, outcome/audit
          // projections and size agree with the canonical ledger row. Otherwise
          // retain the key as a recovery tombstone; never re-run the side effect.
          if(outcomeConsistent && responseBytes<=48*1024) safe.response=response;
          else safe.responseOmitted=true;
        } catch { safe.responseOmitted=true; }
      } else if(row.status==='completed') safe.responseOmitted=true;
      const prior=restored.get(safe.keyHash);
      if(prior && (prior.requestHash!==safe.requestHash || stableJson(prior)!==stableJson(safe))) throw new Error('action-ledger-snapshot-key-conflict');
      restored.set(safe.keyHash,safe);
    }
    this.executionLedger.clear();
    for(const row of [...restored.values()].sort((a,b)=>a.recordedAt-b.recordedAt)) this.executionLedger.set(row.keyHash,row);
    const permissions=raw.permissions as Partial<ActionToolPermissionSnapshot>|undefined;
    const cleanRequests:Array<ActionToolApprovalRecord>=[];
    if(Array.isArray(permissions?.requests)) for(const item of permissions!.requests.slice(-128)) {
      if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id.startsWith('approval-')||!['web','device','filesystem','code','system','self-modification'].includes(item.permissionClass)||!['execute','reconcile','direct'].includes(item.operation)||!['pending','approved','declined','consumed','expired'].includes(item.status)||!/^[a-f0-9]{64}$/i.test(String(item.requestHash??''))) continue;
      const createdAt=Number(item.createdAt),expiresAt=Number(item.expiresAt); if(!Number.isFinite(createdAt)||!Number.isFinite(expiresAt)||expiresAt<createdAt||expiresAt-createdAt>5*60_000+1000) continue;
      cleanRequests.push({...structuredClone(item),requestHash:item.requestHash.toLowerCase(),createdAt,expiresAt,inputKeys:Array.isArray(item.inputKeys)?item.inputKeys.slice(0,24).map(x=>String(x).slice(0,80)):[],inputPreview:item.inputPreview&&typeof item.inputPreview==='object'?structuredClone(item.inputPreview):{},autonomous:Boolean(item.autonomous)});
    }
    this.permissionState={version:1,requests:cleanRequests,created:Math.max(0,Math.floor(Number(permissions?.created??cleanRequests.length))),approved:Math.max(0,Math.floor(Number(permissions?.approved??0))),declined:Math.max(0,Math.floor(Number(permissions?.declined??0))),consumed:Math.max(0,Math.floor(Number(permissions?.consumed??0))),expired:Math.max(0,Math.floor(Number(permissions?.expired??0))),lastChangeAt:Math.max(0,Number(permissions?.lastChangeAt??0))};
    this.expirePermissionRequests();
  }

  authorize(action:ActionKind,reason:string):ActionAuditRecord {
    const accepted=this.allowed.has(action);
    const rec:ActionAuditRecord={at:Date.now(),action,accepted,mode:this.live?'live':'dry-run',reason:reason.slice(0,240),outcomeClass:accepted?undefined:'policy-refused'};
    this.push(rec);return rec;
  }

  registerTool(def:ToolDefinition) {
    if(!/^[a-z0-9._-]{2,64}$/i.test(def.id)) throw new Error('invalid-tool-id');
    if(typeof def.execute!=='function') throw new Error('tool-executor-required');
    if(def.observationSource) {
      const source=def.observationSource;
      if(!/^[a-z0-9._-]{2,80}$/i.test(String(source.sourceId??'')) || !String(source.independenceKey??'').trim() || String(source.independenceKey).length>120) throw new Error('invalid-tool-observation-source');
      if(!['os','device','user','external-api','world','organism','simulator','unknown'].includes(source.sourceClass)) throw new Error('invalid-tool-observation-source-class');
      if(!['filesystem','http','process','device','camera','audio','sensor','user','world','tool','unknown'].includes(source.channel)) throw new Error('invalid-tool-observation-channel');
    }
    if(this.tools.has(def.id)) throw new Error(`duplicate-tool-id:${def.id}`);
    const registered = (def.inputContract || def.outputContract) ? {
      ...def,
      ...(def.inputContract ? { inputContract: cloneFrozenToolInputContract(def.inputContract) } : {}),
      ...(def.outputContract ? { outputContract: cloneFrozenToolOutputContract(def.outputContract) } : {}),
    } : def;
    this.tools.set(def.id,registered);
  }
  listTools() {
    return [...this.tools.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(t=>({
      id:t.id,capability:t.capability,destructive:t.destructive,projectAllowed:Boolean(t.projectAllowed),
      hasInputContract:Boolean(t.inputContract),inputSchema:t.inputContract?structuredClone(t.inputContract):undefined,
      hasOutputContract:Boolean(t.outputContract),outputSchema:t.outputContract?structuredClone(t.outputContract):undefined,
      permissionClass:t.permissionClass??inferPermissionClass(t.id,t.capability)??'none',requiresApproval:Boolean(t.permissionClass??inferPermissionClass(t.id,t.capability)),hasAvailabilityGate:Boolean(t.availability),hasCompetenceGate:Boolean(t.competence),hasOutcomeVerifier:Boolean(t.verify),hasReceiptReconciliation:Boolean(t.reconcile),requiresIdempotencyKey:requiresDurableIdempotency(t),
    }));
  }

  async executeTool(id:string,input:Record<string,unknown>={},reason='tool-request',options:ActionGatewayExecutionOptions={}):Promise<ToolExecution> {
    const registeredTool=this.tools.get(id);
    const validation=validateToolInputContract(input,registeredTool?.inputContract??DEFAULT_TOOL_INPUT_ENVELOPE);
    if(!validation.valid) return this.result(id,registeredTool?.capability??'unknown','tool-input-invalid','gate-check-failed','exec-' + randomUUID(),{error:'tool-input-invalid',issues:validation.issues},'tool arguments must be inert bounded JSON and satisfy the registered contract before approval, receipt admission or executor entry');
    const rawKey=options?.idempotencyKey;
    if(rawKey===undefined || rawKey===null || rawKey==='') {
      if(requiresDurableIdempotency(this.tools.get(id))) return this.result(id,this.tools.get(id)?.capability??'unknown','idempotency-key-required','idempotency-key-required',`exec-${randomUUID()}`,{error:'idempotency-key-required'},'this operation is classified as side-effecting or high-risk and requires a stable key plus durable receipt ledger');
      const permission=await this.consumeDirectActionApproval(id,input,options.approvalId,options,'execute');
      if(!permission.ok) return this.result(id,this.tools.get(id)?.capability??'unknown',permission.reason??'user-approval-required',permission.reason==='approval-storage-failed'?'approval-storage-failed':permission.reason==='user-approval-required'?'approval-required':'approval-invalid',`exec-${randomUUID()}`,{error:permission.reason??'user-approval-required'},'protected tool execution requires a persisted one-time user approval bound to this exact request');
      return this.executeToolDirect(id,input,reason,{decisionId:options.decisionId,autonomous:Boolean(options.autonomous)});
    }
    const key=String(rawKey).trim();
    if(!key || key.length>160 || /[\u0000-\u001f\u007f]/.test(key)) {
      return this.result(id,'unknown','invalid-idempotency-key','idempotency-conflict',`exec-${randomUUID()}`,{error:'invalid-idempotency-key'},'idempotency key must be 1..160 printable characters');
    }
    let requestHash:string;
    try { requestHash=sha256Stable({toolId:id,input,expectedOutputKeys:canonicalExpectedOutputKeys(options.expectedOutputKeys),decisionId:typeof options.decisionId==='string'?options.decisionId.trim()||null:null,autonomous:Boolean(options.autonomous)}); }
    catch { return this.result(id,'unknown','idempotency-input-not-serializable','idempotency-conflict',`exec-${randomUUID()}`,{error:'idempotency-input-not-serializable'},'idempotent requests require a stable JSON-compatible input'); }
    const keyHash=sha256Stable({idempotencyKey:key});
    // A keyed side effect without a durable receipt store is not idempotent. Refuse it before tool lookup/execution.
    if(!this.executionLedgerPersister) return this.result(id,'unknown','idempotency-storage-unavailable','idempotency-storage-failed',`exec-${randomUUID()}`,{error:'idempotency-storage-unavailable'},'keyed execution requires a durable ledger persister');
    const current=this.inFlight.get(keyHash);
    if(current) {
      if(current.requestHash!==requestHash) return this.idempotencyConflict(id,`exec-${randomUUID()}`);
      const shared=await current.promise;
      return {...structuredClone(shared),idempotentReplay:true,idempotencyStatus:'replayed'};
    }
    // Reserve the key in-flight before the first await below. Without this, two
    // same-key requests can both pass the archive lookup and execute concurrently.
    const task=this.executeToolWithIdempotency(id,input,reason,options,keyHash,requestHash);
    this.inFlight.set(keyHash,{requestHash,kind:'execute',promise:task});
    try { return await task; }
    finally { const active=this.inFlight.get(keyHash); if(active?.promise===task) this.inFlight.delete(keyHash); }
  }

  /**
   * Resolve a pending keyed side effect by asking its registered adapter for an
   * authoritative provider receipt. This method never calls `execute`.
   *
   * `not-found` is terminal only when the adapter can prove that its receipt lookup
   * covers the full acceptance window and that this exact idempotency token was not
   * accepted. Otherwise adapters must return `unknown` and the pending receipt stays
   * fail-closed for later reconciliation.
   */
  async reconcileToolExecution(id:string,input:Record<string,unknown>={},reason='tool-receipt-reconciliation',options:ActionGatewayExecutionOptions={}):Promise<ToolExecution> {
    const registeredTool=this.tools.get(id);
    const inputValidation=validateToolInputContract(input,registeredTool?.inputContract??DEFAULT_TOOL_INPUT_ENVELOPE);
    if(!inputValidation.valid) return this.result(id,registeredTool?.capability??'unknown','reconciliation-input-invalid','gate-check-failed',`exec-${randomUUID()}`,{error:'reconciliation-input-invalid',issues:inputValidation.issues},'receipt reconciliation requires the original bounded JSON request before provider lookup');
    const rawKey=options?.idempotencyKey;
    if(rawKey===undefined||rawKey===null||rawKey==='') return this.result(id,'unknown','reconciliation-idempotency-key-required','idempotency-recovery-required',`exec-${randomUUID()}`,{error:'reconciliation-idempotency-key-required'},'receipt reconciliation requires the original idempotency key');
    const key=String(rawKey).trim();
    if(!key||key.length>160||/[\u0000-\u001f\u007f]/.test(key)) return this.result(id,'unknown','invalid-idempotency-key','idempotency-conflict',`exec-${randomUUID()}`,{error:'invalid-idempotency-key'},'idempotency key must be 1..160 printable characters');
    let requestHash:string;
    try { requestHash=sha256Stable({toolId:id,input,expectedOutputKeys:canonicalExpectedOutputKeys(options.expectedOutputKeys),decisionId:typeof options.decisionId==='string'?options.decisionId.trim()||null:null,autonomous:Boolean(options.autonomous)}); }
    catch { return this.result(id,'unknown','idempotency-input-not-serializable','idempotency-conflict',`exec-${randomUUID()}`,{error:'idempotency-input-not-serializable'},'receipt reconciliation requires the same stable JSON-compatible request'); }
    const keyHash=sha256Stable({idempotencyKey:key});
    if(!this.executionLedgerPersister) return this.result(id,'unknown','idempotency-storage-unavailable','idempotency-storage-failed',`exec-${randomUUID()}`,{error:'idempotency-storage-unavailable'},'receipt reconciliation requires the durable execution ledger');

    // One local operation per key at a time. If an execution is still settling,
    // wait for its durable result; if it remains pending, then start lookup.
    for (;;) {
      const active=this.inFlight.get(keyHash);
      if(active) {
        if(active.requestHash!==requestHash) return this.idempotencyConflict(id,`exec-${randomUUID()}`);
        const waited=await active.promise;
        if(active.kind==='reconcile') return {...structuredClone(waited),idempotentReplay:true};
        // A regular execution may have ended with a durable pending receipt. Inspect
        // the ledger again before deciding whether a provider lookup is needed.
        const settled=await this.findLedgerEntry(keyHash);
        if(settled.error) return this.result(id,'unknown','idempotency-storage-failed','idempotency-storage-failed',waited.executionId,{error:settled.error},'could not read the persisted receipt after waiting for execution to settle');
        if(settled.entry?.status==='completed') {
          if(settled.entry.requestHash!==requestHash) return this.idempotencyConflict(id,settled.entry.executionId??waited.executionId);
          return this.replayLedgerEntry(settled.entry,id);
        }
        // Pending or absent proceeds to the provider-lookup path below.
      }
      const raced=this.inFlight.get(keyHash);
      if(raced) continue;
      const task=Promise.resolve().then(()=>this.reconcileToolExecutionDirect(id,input,reason,options,keyHash,requestHash));
      this.inFlight.set(keyHash,{requestHash,kind:'reconcile',promise:task});
      try { return await task; }
      finally { const current=this.inFlight.get(keyHash); if(current?.promise===task) this.inFlight.delete(keyHash); }
    }
  }

  private async findLedgerEntry(keyHash:string):Promise<{entry?:ActionExecutionLedgerEntry;error?:string;source?:'archive'|'hot'}> {
    if(this.executionLedgerArchive) {
      try { const archived=await this.executionLedgerArchive.get(keyHash); if(archived) return {entry:archived,source:'archive'}; }
      catch { return {error:'idempotency-archive-read-failed'}; }
    }
    const entry=this.executionLedger.get(keyHash);
    return entry?{entry:structuredClone(entry),source:'hot'}:{};
  }

  private async reconcileToolExecutionDirect(id:string,input:Record<string,unknown>,reason:string,options:ActionGatewayExecutionOptions,keyHash:string,requestHash:string):Promise<ToolExecution> {
    const lookup=await this.findLedgerEntry(keyHash);
    if(lookup.error) return this.result(id,'unknown','idempotency-storage-failed','idempotency-storage-failed',this.executionIdForKey(keyHash),{error:lookup.error},'receipt lookup could not read the durable local ledger');
    const prior=lookup.entry;
    if(!prior) return this.result(id,'unknown','no-pending-receipt-to-reconcile','idempotency-recovery-required',this.executionIdForKey(keyHash),{error:'no-pending-receipt-to-reconcile'},'no durable receipt exists for the supplied operation key; reconciliation never creates or executes an operation');
    if(prior.requestHash!==requestHash) return this.idempotencyConflict(id,prior.executionId??this.executionIdForKey(keyHash));
    const priorResponse = prior.response as ToolExecution | undefined;
    // A completed local receipt may still be epistemically unresolved. In that case
    // an explicit reconciliation call is allowed to use the adapter's read-only
    // provider receipt lookup; it must not call the executor again. Verified terminal
    // receipts remain ordinary idempotent replays.
    const completedNeedsProviderReconciliation = prior.status === 'completed' &&
      Boolean(priorResponse && priorResponse.outcomeClass !== 'failed-no-effect' && wasToolExecutorEntered(priorResponse.outcomeClass) && priorResponse.verified !== true);
    if(prior.status==='completed' && !completedNeedsProviderReconciliation) return this.replayLedgerEntry(prior,id);
    if((prior.toolId && prior.toolId!==id) || !prior.executionId) return this.result(id,'unknown','pending-receipt-identity-invalid','idempotency-recovery-required',prior.executionId??this.executionIdForKey(keyHash),{error:'pending-receipt-identity-invalid'},'pending receipt tool/execution identity is missing or inconsistent');
    const permission=await this.consumeDirectActionApproval(id,input,options.approvalId,options,'reconcile');
    if(!permission.ok) return this.result(id,this.tools.get(id)?.capability??'unknown',permission.reason??'user-approval-required',permission.reason==='approval-storage-failed'?'approval-storage-failed':permission.reason==='user-approval-required'?'approval-required':'approval-invalid',prior.executionId,{error:permission.reason??'user-approval-required'},'protected receipt lookup requires a persisted one-time user approval');
    const tool=this.tools.get(id);
    if(!tool?.reconcile) return this.result(id,'unknown','tool-does-not-support-receipt-reconciliation','idempotency-recovery-required',prior.executionId,{error:'tool-does-not-support-receipt-reconciliation',toolId:id},'adapter has no authoritative read-only receipt lookup; pending action remains unresolved');
    const context:ToolExecutionContext={executionId:prior.executionId,idempotencyKey:keyHash,decisionId:prior.decisionId??options.decisionId,autonomous:prior.autonomous??Boolean(options.autonomous)};
    let provider:ToolReceiptLookup;
    try { provider=await tool.reconcile(structuredClone(input),structuredClone(context)); }
    catch(error) { provider={status:'unknown',reason:String((error as Error)?.message??'provider-receipt-lookup-failed').slice(0,180)}; }
    const checkedAt=Number.isFinite(Number(provider?.checkedAt))?Math.max(0,Number(provider.checkedAt)):Date.now();
    let response:ToolExecution;
    if(provider?.status==='found' && provider.authoritative===true) {
      const receiptId=String(provider.receiptId??'').trim();
      if(!receiptId||receiptId.length>180||/[\u0000-\u001f\u007f]/.test(receiptId)||!provider.result||typeof provider.result!=='object'||Array.isArray(provider.result))
        return this.result(id,'unknown','provider-receipt-invalid','idempotency-recovery-required',prior.executionId,{error:'provider-receipt-invalid'},'provider result lacks a bounded receipt identifier or structured result; pending receipt remains unresolved');
      let result:Record<string,unknown>; let bytes=0;
      try { result=structuredClone(provider.result); bytes=new TextEncoder().encode(stableJson(result)).length; }
      catch { return this.result(id,'unknown','provider-receipt-not-serializable','idempotency-recovery-required',prior.executionId,{error:'provider-receipt-not-serializable'},'provider receipt is not stable JSON and cannot be committed safely'); }
      if(bytes>48*1024) return this.result(id,'unknown','provider-receipt-too-large','idempotency-recovery-required',prior.executionId,{error:'provider-receipt-too-large',bytes},'provider result exceeds the bounded durable receipt size; adapter must return a concise canonical receipt');
      const toolOk=result.ok!==false;
      const verification=await this.verifier.verify({
         toolId:id,input,result,
         executionId:prior.executionId,
         ...(typeof prior.decisionId==='string'?{decisionId:prior.decisionId}:{}),
       },tool.verify);
      const classified=classifyVerifiedExecution(toolOk,verification);
      const auditReason=classified.contradicted?'external-postcondition-contradicted':reason;
      const audit=this.auditTool(id,classified.ok,auditReason,classified.verified,tool.capability,result,verification.basis,verification,prior.executionId,classified.outcomeClass);
      response={ok:classified.ok,verified:classified.verified,executionId:prior.executionId,tool:id,capability:tool.capability,result,audit,verification,outcomeClass:classified.outcomeClass,reconciled:true,providerReceiptId:receiptId,idempotencyStatus:'reconciled'};
    } else if(provider?.status==='not-found' && provider.authoritative===true && String(provider.reason??'').trim()) {
      // The adapter attests that this lookup covers the provider's acceptance window
      // and that this key has never taken effect. We terminalize; a fresh attempt needs
      // a fresh logical idempotency key, and no competence/temporal reward is applied.
      const why=String(provider.reason).trim().slice(0,180);
      response=this.result(id,'unknown','reconciled-not-executed','reconciled-not-executed',prior.executionId,{error:'provider-confirmed-not-executed',reason:why,providerCheckedAt:checkedAt},'provider authoritatively confirmed that the side effect was not accepted');
      response={...response,reconciled:true,idempotencyStatus:'confirmed-not-executed'};
    } else {
      const why=String((provider as any)?.reason??'provider-receipt-status-unknown').replace(/[\r\n\t]+/g,' ').slice(0,180);
      return this.result(id,'unknown','idempotency-recovery-required','idempotency-recovery-required',prior.executionId,{error:'provider-receipt-status-unknown',reason:why,...(Number.isFinite(Number((provider as any)?.retryAfterMs))?{retryAfterMs:Math.max(0,Math.min(3_600_000,Number((provider as any).retryAfterMs)))}:{})},'provider could not authoritatively resolve the side effect; pending receipt remains unchanged');
    }
    const reconciliationDecisionId = prior.decisionId ?? options.decisionId;
    const decisionLinkedExternalPostcondition = typeof reconciliationDecisionId === 'string' &&
      isTrustedDecisionLinkedExternalPostcondition(response.verification, {
        toolId: id, input, executionId: response.executionId, decisionId: reconciliationDecisionId,
      });
    try { await this.executionFinalizer?.({
      toolId:id,input:structuredClone(input),reason:`${reason};receipt-reconciled`,
      result:structuredClone(response),options:structuredClone({ ...options, ...(reconciliationDecisionId ? { decisionId: reconciliationDecisionId } : {}) }),
      decisionLinkedExternalPostcondition,
    }); }
    catch(error) {
      return {...response,ok:false,verified:false,outcomeClass:'idempotency-recovery-required',idempotencyStatus:'recovery-required',result:{error:'reconciliation-finalization-failed',originalExecutionId:prior.executionId,reason:String((error as Error)?.message??'finalizer-error').slice(0,160)},audit:{...response.audit,accepted:false,verified:false,outcomeClass:'idempotency-recovery-required',result:'reconciliation-finalization-failed'}};
    }
    const completed:ActionExecutionLedgerEntry={...prior,status:'completed',recordedAt:Date.now(),response:structuredClone(response)};
    let omitted=false;
    try { omitted=new TextEncoder().encode(stableJson(response)).length>48*1024; } catch { omitted=true; }
    if(omitted) {
      completed.responseOmitted=true;
      completed.response={...response,result:{error:'idempotency-replay-payload-omitted',originalExecutionId:response.executionId},idempotencyStatus:'payload-omitted'};
      response={...response,result:{error:'idempotency-replay-payload-omitted',originalExecutionId:response.executionId},idempotencyStatus:'payload-omitted'};
    }
    if(lookup.source==='archive') {
      // Archive receipts are append-only. Reconciliation must append a validated
      // identity-preserving revision rather than shadowing an immutable older row in
      // the hot snapshot (which would otherwise win forever after restart).
      try {
        if(!this.executionLedgerArchive?.appendRevision) throw new Error('archive-revision-not-supported');
        await this.executionLedgerArchive.appendRevision(completed);
      } catch(error) {
        return {...response,ok:false,verified:false,outcomeClass:'idempotency-recovery-required',idempotencyStatus:'recovery-required',result:{error:'archived-receipt-revision-failed',originalExecutionId:prior.executionId,reason:String((error as Error)?.message??'archive-revision-failed').slice(0,120)},audit:{...response.audit,accepted:false,verified:false,outcomeClass:'idempotency-recovery-required',result:'archived-receipt-revision-failed'}};
      }
      // An older snapshot may contain a stale shadow copy. The archive is authoritative;
      // removing the shadow is best-effort because the revision is already durable.
      if(this.executionLedger.has(keyHash)) {
        const shadow=this.executionLedger.get(keyHash)!;
        this.executionLedger.delete(keyHash);
        try { await this.persistExecutionLedger(); }
        catch { this.executionLedger.set(keyHash,shadow); /* archive precedence keeps this fail-safe */ }
      }
      return {...response,idempotencyStatus:omitted?'payload-omitted':response.idempotencyStatus};
    }
    this.executionLedger.set(keyHash,completed);
    try { await this.persistExecutionLedger(); }
    catch {
      this.executionLedger.set(keyHash,prior);
      try { await this.persistExecutionLedger(); } catch { /* remain fail-closed */ }
      return {...response,ok:false,verified:false,outcomeClass:'idempotency-recovery-required',idempotencyStatus:'recovery-required',result:{error:'reconciled-receipt-persistence-failed',originalExecutionId:prior.executionId},audit:{...response.audit,accepted:false,verified:false,outcomeClass:'idempotency-recovery-required',result:'reconciled-receipt-persistence-failed'}};
    }
    return {...response,idempotencyStatus:omitted?'payload-omitted':response.idempotencyStatus};
  }

  private async executeToolWithIdempotency(id:string,input:Record<string,unknown>,reason:string,options:ActionGatewayExecutionOptions,keyHash:string,requestHash:string):Promise<ToolExecution> {
    let archived:ActionExecutionLedgerEntry|undefined;
    if(this.executionLedgerArchive) {
      try { archived=await this.executionLedgerArchive.get(keyHash); }
      catch { return this.result(id,'unknown','idempotency-storage-failed','idempotency-storage-failed',`exec-${randomUUID()}`,{error:'idempotency-archive-read-failed'},'archive lookup failed; refusing to execute a potentially repeated side effect'); }
    }
    if(archived) {
      if(archived.requestHash!==requestHash) return this.idempotencyConflict(id,`exec-${randomUUID()}`);
      return this.replayLedgerEntry(archived,id);
    }
    const prior=this.executionLedger.get(keyHash);
    if(prior) {
      if(prior.requestHash!==requestHash) return this.idempotencyConflict(id,`exec-${randomUUID()}`);
      if(prior.status==='pending') return this.result(id,'unknown','idempotency-recovery-required','idempotency-recovery-required',prior.executionId??this.executionIdForKey(keyHash),{error:'idempotency-recovery-required',originalRequestHash:requestHash,toolId:prior.toolId??id,decisionId:prior.decisionId??options.decisionId??null},'a prior process persisted this request as pending; automatic re-execution is blocked until the host reconciles the real-world outcome');
      return this.replayLedgerEntry(prior,id);
    }
    const permission=await this.consumeDirectActionApproval(id,input,options.approvalId,options,'execute');
    if(!permission.ok) return this.result(id,this.tools.get(id)?.capability??'unknown',permission.reason??'user-approval-required',permission.reason==='approval-storage-failed'?'approval-storage-failed':permission.reason==='user-approval-required'?'approval-required':'approval-invalid',`exec-${randomUUID()}`,{error:permission.reason??'user-approval-required'},'protected tool execution requires a persisted one-time user approval bound to this exact request');
    const pending:ActionExecutionLedgerEntry={keyHash,requestHash,status:'pending',recordedAt:Date.now(),executionId:this.executionIdForKey(keyHash),toolId:id,decisionId:options.decisionId,autonomous:Boolean(options.autonomous)};
    const admissionResult=await this.admitPendingReceipt(pending,id);
    if(admissionResult) return admissionResult;
    return this.executeWithLedger(id,input,reason,pending,options);
  }

  /** Serialize capacity checks and pending-record commits across distinct keys. */
  private async admitPendingReceipt(pending:ActionExecutionLedgerEntry,id:string):Promise<ToolExecution|null> {
    let release!:()=>void;
    const previous=this.ledgerAdmissionTail;
    this.ledgerAdmissionTail=new Promise<void>(resolve=>{release=resolve;});
    await previous;
    try {
      try { await this.makeLedgerRoom(); }
      catch { return this.result(id,'unknown','idempotency-storage-failed','idempotency-storage-failed',`exec-${randomUUID()}`,{error:'idempotency-archive-write-failed'},'could not archive a prior receipt; refusing to execute a side effect'); }
      if(this.executionLedger.size>=this.maxIdempotencyRecords) {
        return this.result(id,'unknown','idempotency-ledger-full','idempotency-ledger-full',`exec-${randomUUID()}`,{error:'idempotency-ledger-full'},'ledger is full and no durable archive is available; refusing to discard prior keys or execute a side effect');
      }
      this.executionLedger.set(pending.keyHash,pending);
      try { await this.persistExecutionLedger(); }
      catch {
        this.executionLedger.delete(pending.keyHash);
        return this.result(id,'unknown','idempotency-storage-failed','idempotency-storage-failed',`exec-${randomUUID()}`,{error:'idempotency-storage-failed'},'execution was not started because the pending receipt could not be persisted');
      }
      return null;
    } finally { release(); }
  }

  private executionIdForKey(keyHash:string):string { return `exec-${String(keyHash).slice(0,32).toLowerCase()}`; }

  private async executeWithLedger(id:string,input:Record<string,unknown>,reason:string,pending:ActionExecutionLedgerEntry,options:ActionGatewayExecutionOptions):Promise<ToolExecution> {
    let response=await this.executeToolDirect(id,input,reason,{executionId:pending.executionId??this.executionIdForKey(pending.keyHash),idempotencyKey:pending.keyHash,decisionId:options.decisionId,autonomous:Boolean(options.autonomous)});
    // An adapter can explicitly report that its side effect may have occurred but
    // no authoritative result is available. Keep the original pending receipt and
    // do not finalize/learn/commit a false terminal failure.
    if(response.outcomeClass==='idempotency-recovery-required' || response.outcomeClass==='executed-partial') {
      // Ambiguous and partial effects keep the original durable pending receipt.
      // Do not finalize or credit them until a read-only adapter reconciliation
      // produces an authoritative terminal outcome.
      return {...response,ok:false,verified:false,idempotencyStatus:'recovery-required'};
    }
    const expectedKeys=canonicalExpectedOutputKeys(options.expectedOutputKeys)??[];
    const missingOutputKey=expectedKeys.find(key=>!(key in (response.result??{})));
    if(missingOutputKey) {
      const failure=`missing-expected-output:${missingOutputKey}`;
      response={...response,ok:false,verified:false,result:{...response.result,error:failure},verification:{verified:false,basis:'none',confidence01:0,externalObservation:false,notes:failure},outcomeClass:'execution-failed',audit:{...response.audit,accepted:false,verified:false,outcomeClass:'execution-failed',result:failure}};
    }
    try {
      const decisionLinkedExternalPostcondition = typeof options.decisionId === 'string' &&
        isTrustedDecisionLinkedExternalPostcondition(response.verification, {
          toolId: id, input, executionId: response.executionId, decisionId: options.decisionId,
        });
      await this.executionFinalizer?.({
        toolId:id, input:structuredClone(input), reason, result:structuredClone(response),
        options:structuredClone(options), decisionLinkedExternalPostcondition,
      });
    } catch (error) {
      // The external action may already have happened. Keep the durable pending
      // receipt so retries fail closed and request explicit reconciliation.
      return { ...response, ok:false, verified:false, outcomeClass:'idempotency-recovery-required', idempotencyStatus:'recovery-required', result:{ error:'post-execution-finalization-failed', originalExecutionId:response.executionId, reason:String((error as Error)?.message??'finalizer-error').slice(0,160) } };
    }
    const completed:ActionExecutionLedgerEntry={...pending,status:'completed',recordedAt:Date.now()};
    let replayPayloadOmitted=false;
    try {
      const serialized=stableJson(response);
      replayPayloadOmitted=new TextEncoder().encode(serialized).length>48*1024;
    } catch { replayPayloadOmitted=true; }
    if (replayPayloadOmitted) {
      // Keep the execution/verification outcome stable on the first response and
      // on replay, while replacing oversized details with a bounded receipt.
      const compact={...response,result:{error:'idempotency-replay-payload-omitted',originalExecutionId:response.executionId},idempotencyStatus:'payload-omitted' as const};
      completed.responseOmitted=true;
      completed.response=structuredClone(compact);
      response=compact;
    } else {
      completed.response=structuredClone(response);
    }
    this.executionLedger.set(pending.keyHash,completed);
    try {
      await this.persistExecutionLedger();
    } catch {
      // The external side effect and/or finalizer may already have happened. Revert
      // the in-memory ledger to pending and never report a committed receipt unless
      // the completed receipt was durably checkpointed. A best-effort pending save
      // repairs stores that recover from a transient failure; it is safe to retry
      // because pending entries block automatic side-effect re-execution.
      this.executionLedger.set(pending.keyHash,pending);
      try { await this.persistExecutionLedger(); } catch { /* remain fail-closed in memory */ }
      return {
        ...response,
        ok:false,
        verified:false,
        outcomeClass:'idempotency-recovery-required',
        idempotencyStatus:'recovery-required',
        result:{error:'completion-receipt-persistence-failed',originalExecutionId:response.executionId},
        audit:{...response.audit,accepted:false,verified:false,outcomeClass:'idempotency-recovery-required',result:'completion-receipt-persistence-failed'},
      };
    }
    this.trimExecutionLedger();
    return {...response,idempotencyStatus:replayPayloadOmitted?'payload-omitted':'recorded'};
  }

  private async persistExecutionLedger():Promise<void> {
    if(!this.executionLedgerPersister) throw new Error('idempotency-storage-unavailable');
    await this.executionLedgerPersister(this.snapshotExecutionLedger());
  }

  private async makeLedgerRoom():Promise<void> {
    while(this.executionLedger.size>=this.maxIdempotencyRecords) {
      // Never evict epistemically unresolved outcomes from the hot ledger. They need
      // active reconciliation and must remain visible even if the archive is full.
      // A verified result, explicit no-effect, or authoritative provider absence is safe.
      const oldest=[...this.executionLedger.values()].filter(row=>row.status==='completed'
        && Boolean(row.response)
        && (row.response!.verified===true || row.response!.outcomeClass==='failed-no-effect'
          || row.response!.outcomeClass==='reconciled-not-executed'))
        .sort((a,b)=>a.recordedAt-b.recordedAt)[0];
      if(!oldest || !this.executionLedgerArchive) return;
      // Archive first and fsync there; only then remove the hot entry and persist that change.
      await this.executionLedgerArchive.append(oldest);
      this.executionLedger.delete(oldest.keyHash);
      try { await this.persistExecutionLedger(); }
      catch (error) {
        // Keep the hot entry if the main snapshot could not be updated; archive+hot duplicates are safe.
        this.executionLedger.set(oldest.keyHash,oldest);
        throw error;
      }
    }
  }

  private replayLedgerEntry(entry:ActionExecutionLedgerEntry,id:string):ToolExecution {
    if(entry.response) {
      const response=structuredClone(entry.response);
      return {...response,idempotentReplay:true,idempotencyStatus:entry.responseOmitted?'payload-omitted':'replayed'};
    }
    return this.result(id,'unknown','idempotency-recovery-required','idempotency-recovery-required',`exec-${randomUUID()}`,{error:'idempotency-recovery-required'},'completed receipt has no replayable result; refusing to execute the side effect again');
  }

  private idempotencyConflict(id:string,executionId:string):ToolExecution {
    return this.result(id,'unknown','idempotency-key-reused-with-different-request','idempotency-conflict',executionId,{error:'idempotency-key-reused-with-different-request'},'the key is already bound to a different canonical request');
  }

  private trimExecutionLedger():void {
    // Deliberately never evict a completed key without archiving it. Capacity is
    // reclaimed only by makeLedgerRoom(), which appends+fsyncs the receipt first.
  }

  private async executeToolDirect(id:string,input:Record<string,unknown>={},reason='tool-request',context:Partial<ToolExecutionContext>={}):Promise<ToolExecution> {
    const executionId=typeof context.executionId==='string'&&/^exec-[a-z0-9-]{8,80}$/i.test(context.executionId)?context.executionId:`exec-${randomUUID()}`;
    const tool=this.tools.get(id);
    if(!tool) return this.result(id,'unknown','unknown-tool','unavailable',executionId,{error:'unknown-tool'},'tool is not registered');

    // Availability is checked first. Missing prerequisites are not execution failures.
    if(tool.availability) {
      let check:ToolAvailability;
      try { check=tool.availability(input); }
      catch {
        return this.result(id,tool.capability,'availability-check-failed','gate-check-failed',executionId,{error:'availability-check-failed'},'tool availability check threw');
      }
      if(!check || check.available!==true) {
        const why=String(check?.reason||'tool-unavailable').slice(0,240);
        return this.result(id,tool.capability,why,'unavailable',executionId,{error:'tool-unavailable',reason:why},'tool preconditions are not satisfied');
      }
    }

    // Competence is an optional explicit prerequisite; absence means "not assessed",
    // not "incompetent". Refusals are handled later as policy outcomes.
    let competenceConfidence01:number|undefined;
    if(tool.competence) {
      let check:ToolCompetence;
      try { check=tool.competence(input); }
      catch {
        return this.result(id,tool.capability,'competence-check-failed','gate-check-failed',executionId,{error:'competence-check-failed'},'competence check threw');
      }
      competenceConfidence01=clamp01(check?.confidence01 ?? 0);
      if(!check || check.competent!==true) {
        const why=String(check?.reason||'competence-insufficient').slice(0,240);
        return this.result(id,tool.capability,why,'competence-insufficient',executionId,{error:'competence-insufficient',reason:why},'explicit competence gate declined the tool',competenceConfidence01);
      }
    }

    // Policy refusal is not written as incompetence and never invokes the executor.
    if(tool.destructive&&!this.live)
      return this.result(id,tool.capability,'dry-run-destructive-block','policy-refused',executionId,{error:'dry-run-destructive-block'},'destructive action is disabled in dry-run',competenceConfidence01);
    if(tool.destructive&&this.live&&!tool.verify)
      return this.result(id,tool.capability,'live-destructive-verifier-required','policy-refused',executionId,{error:'live-destructive-verifier-required'},'live destructive tools require an independent postcondition verifier',competenceConfidence01);

    try {
      const result=await tool.execute(input,{executionId,idempotencyKey:context.idempotencyKey,decisionId:context.decisionId,autonomous:context.autonomous===true});
      if(tool.outputContract) {
        const validation=validateToolOutputContract(result,tool.outputContract);
        if(!validation.valid) {
          const invalidOutput={error:'tool-output-invalid',issues:validation.issues};
          const outputVerification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'tool executor was entered but its result failed the registered output contract; the external effect must remain unverified and may require read-only reconciliation'};
          const outputAudit=this.auditTool(id,false,'tool-output-invalid',false,tool.capability,invalidOutput,'none',outputVerification,executionId,'executed-unverified',competenceConfidence01);
          return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:invalidOutput,audit:outputAudit,verification:outputVerification,outcomeClass:'executed-unverified',competenceConfidence01};
        }
      }
      // A negative adapter response is not evidence that a remote side effect did
      // not happen: some providers apply the operation and then return an error/lost
      // ACK. For durable keyed mutators, require explicit `effectStatus: not-applied`
      // (handled below) or a typed ToolExecutionNoEffectError before terminalizing.
      if (result?.ok === false
        && result?.effectStatus !== 'not-applied'
        && result?.effectStatus !== 'partial'
        && Boolean(context.idempotencyKey)
        && requiresDurableIdempotency(tool)) {
        const uncertainVerification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'adapter returned a negative response without proof that no external side effect occurred; provider reconciliation is required'};
        const uncertainResult={error:'tool-negative-response-outcome-unknown',reason:typeof result.error==='string'?result.error.slice(0,200):'negative-adapter-response-without-no-effect-proof'};
        const audit=this.auditTool(id,false,'tool-negative-response-outcome-unknown',false,tool.capability,uncertainResult,'none',uncertainVerification,executionId,'idempotency-recovery-required',competenceConfidence01);
        return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:uncertainResult,audit,verification:uncertainVerification,outcomeClass:'idempotency-recovery-required',idempotencyStatus:'recovery-required',competenceConfidence01};
      }
      // Trusted adapters may explicitly attest a partial effect. Keep this receipt
      // unresolved; a later read-only provider lookup must establish the final state.
      if (result?.effectStatus === 'partial') {
        const verification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'adapter reported a partial effect; provider reconciliation required'};
        const partialResult={...result,error:typeof result.error==='string'?result.error:'tool-execution-partial'};
        const audit=this.auditTool(id,false,'tool-execution-partial',false,tool.capability,partialResult,'none',verification,executionId,'executed-partial',competenceConfidence01);
        return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:partialResult,audit,verification,outcomeClass:'executed-partial',competenceConfidence01};
      }
      const toolOk=result?.ok!==false;
      // A no-effect result is terminal only when a trusted adapter marks the
      // operation as not applied. Ordinary false/timeout responses do not carry
      // that guarantee and may still require reconciliation.
      if (!toolOk && result?.effectStatus === 'not-applied') {
        const verification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'adapter explicitly confirmed that no side effect was applied'};
        const failedResult={...result,error:typeof result.error==='string'?result.error:'tool-failed-no-effect'};
        const audit=this.auditTool(id,false,'tool-failed-no-effect',false,tool.capability,failedResult,'none',verification,executionId,'failed-no-effect',competenceConfidence01);
        return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:failedResult,audit,verification,outcomeClass:'failed-no-effect',competenceConfidence01};
      }
      const verification=await this.verifier.verify({
         toolId:id,input,result,
         executionId,
         ...(typeof context.decisionId==='string'?{decisionId:context.decisionId}:{}),
       },tool.verify);
      const classified=classifyVerifiedExecution(toolOk,verification);
      const auditReason=classified.contradicted?'external-postcondition-contradicted':reason;
      const audit=this.auditTool(id,classified.ok,auditReason,classified.verified,tool.capability,result,verification.basis,verification,executionId,classified.outcomeClass,competenceConfidence01);
      const providerReceiptId=typeof result?.providerReceiptId==='string'&&result.providerReceiptId.trim()&&result.providerReceiptId.length<=180&&!/[\u0000-\u001f\u007f]/.test(result.providerReceiptId)?result.providerReceiptId.trim():undefined;
      return {ok:classified.ok,verified:classified.verified,executionId,tool:id,capability:tool.capability,result,audit,verification,outcomeClass:classified.outcomeClass,competenceConfidence01,...(providerReceiptId?{providerReceiptId}:{})};
    } catch(error) {
      const msg=String((error as any)?.message||error).replace(/[\r\n\t]+/g,' ').slice(0,240);
      const verification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:error instanceof ToolExecutionUncertainError?'external side effect may have occurred; provider receipt reconciliation is required':'tool execution failed'};
      if(error instanceof ToolExecutionNoEffectError) {
        const noEffectVerification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'trusted adapter explicitly confirmed no side effect occurred'};
        const audit=this.auditTool(id,false,'tool-failed-no-effect',false,tool.capability,{error:'tool-failed-no-effect'},'none',noEffectVerification,executionId,'failed-no-effect',competenceConfidence01);
        return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:{error:'tool-failed-no-effect',reason:msg},audit,verification:noEffectVerification,outcomeClass:'failed-no-effect',competenceConfidence01};
      }
      if(error instanceof ToolExecutionPartialError) {
        const partialVerification:OutcomeVerification={verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'trusted adapter reported a partial effect; provider reconciliation required'};
        const audit=this.auditTool(id,false,'tool-execution-partial',false,tool.capability,{error:'tool-execution-partial'},'none',partialVerification,executionId,'executed-partial',competenceConfidence01);
        return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:{error:'tool-execution-partial',reason:msg},audit,verification:partialVerification,outcomeClass:'executed-partial',competenceConfidence01};
      }
      // A generic exception from a keyed mutating tool can be a lost ACK after the
      // provider accepted the operation. Fail closed by preserving the pending
      // receipt; adapters must use ToolExecutionNoEffectError (or effectStatus) to
      // attest definite non-execution. This prevents hidden uncertainty from being
      // committed as a terminal failure or used to penalize a skill.
      if(error instanceof ToolExecutionUncertainError || (Boolean(context.idempotencyKey) && requiresDurableIdempotency(tool))) {
        const uncertaintySource=error instanceof ToolExecutionUncertainError?'adapter-declared-uncertain':'unclassified-keyed-adapter-error';
        const audit=this.auditTool(id,false,'tool-outcome-uncertain',false,tool.capability,{error:'tool-outcome-uncertain',uncertaintySource},'none',verification,executionId,'idempotency-recovery-required',competenceConfidence01);
        return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:{error:'tool-outcome-uncertain',reason:msg,uncertaintySource},audit,verification,outcomeClass:'idempotency-recovery-required',idempotencyStatus:'recovery-required',competenceConfidence01};
      }
      const audit=this.auditTool(id,false,msg,false,tool.capability,undefined,'none',verification,executionId,'execution-failed',competenceConfidence01);
      return {ok:false,verified:false,executionId,tool:id,capability:tool.capability,result:{error:msg},audit,verification,outcomeClass:'execution-failed',competenceConfidence01};
    }
  }

  snapshot():ActionAuditRecord[]{return structuredClone(this.history)}

  private result(
    tool:string,capability:string,reason:string,outcomeClass:ActionOutcomeClass,executionId:string,
    result:Record<string,unknown>,notes:string,competenceConfidence01?:number,
  ):ToolExecution {
    const verification:OutcomeVerification={...unavailableVerification,notes};
    const audit=this.auditTool(tool,false,reason,false,capability,result,'none',verification,executionId,outcomeClass,competenceConfidence01);
    return {ok:false,verified:false,executionId,tool,capability,result,audit,verification,outcomeClass,competenceConfidence01};
  }

  private auditTool(
    tool:string,accepted:boolean,reason:string,verified:boolean,capability='unknown',
    result?:Record<string,unknown>,verificationBasis:ActionAuditRecord['verificationBasis']='none',
    verification?:OutcomeVerification,executionId?:string,outcomeClass?:ActionOutcomeClass,competenceConfidence01?:number,
  ) {
    let resultSummary:string|undefined;
    if(result) {
      try { resultSummary=JSON.stringify(result).slice(0,300); }
      catch { resultSummary='[unserializable-result]'; }
    }
    const rec:ActionAuditRecord={
      at:Date.now(),executionId,action:'tool',tool,accepted,mode:this.live?'live':'dry-run',
      reason:reason.slice(0,240),verified,verificationBasis,verificationConfidence01:verification?.confidence01,
      observationId:verification?.observationId,result:resultSummary,outcomeClass,competenceConfidence01,
    };
    this.push(rec);return rec;
  }
  private push(rec:ActionAuditRecord){this.history=[rec,...this.history].slice(0,512)}
}
function clamp01(n:unknown):number { const value=Number(n); return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0; }
