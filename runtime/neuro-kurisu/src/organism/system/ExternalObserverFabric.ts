import type { WorldContext } from '../core/types.ts';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sha256Stable, stableJson } from '../core/StableSerialization.ts';

export type ExternalObservationSourceClass = 'os'|'device'|'user'|'external-api'|'world'|'organism'|'simulator'|'unknown';
export type ExternalObservationChannel = 'filesystem'|'http'|'process'|'device'|'camera'|'audio'|'sensor'|'user'|'world'|'tool'|'unknown';
export type PostconditionAssessment = 'match'|'mismatch'|'unknown';
export type RealityConsensusStatus = 'corroborated'|'supported'|'disputed'|'unknown';

export type ExternalObserverSourceIdentity = Pick<ExternalObserverSource,'id'|'sourceClass'|'channel'|'independenceKey'>;
export type ExternalObserverSourceRegistrationAuthorizer = (source:ExternalObserverSourceIdentity)=>boolean;

export interface ExternalObserverSource {
  id:string;
  sourceClass:ExternalObservationSourceClass;
  channel:ExternalObservationChannel;
  independenceKey:string;
  reliability01:number;
  enabled:boolean;
  samples:number;
  accepted:number;
  contradicted:number;
  lastAt:number;
}

export interface ExternalObservation {
  id:string;
  /** Verifier-minted upstream identity; a join key, never proof authority by itself. */
  evidenceEventId?:string;
  actionRef?:string;
  predictionId?:string;
  tool?:string;
  tick?:number;
  observedAt:number;
  sourceId:string;
  sourceClass:ExternalObservationSourceClass;
  channel:ExternalObservationChannel;
  independenceKey:string;
  claimKey:string;
  subject?:string;
  observedPostcondition?:string;
  facts:string[];
  confidence01:number;
  /** Registered source trust at capture time; replay never recomputes this upward. */
  sourceReliabilityAtCapture01?:number;
  freshness01:number;
  payloadHash:string;
  worldContextAfter?:WorldContext;
  metadata:Record<string,unknown>;
}

export interface ExternalObservationAssessment {
  observationId:string;
  actionRef?:string;
  claimKey:string;
  expectedPostcondition:string;
  observedPostcondition:string;
  assessment:PostconditionAssessment;
  similarity01:number;
  confidence01:number;
  verified:boolean;
  reason:string;
  assessedAt:number;
}

export interface RealityClaimReconciliation {
  claimKey:string;
  expectedPostcondition?:string;
  status:RealityConsensusStatus;
  support01:number;
  contradiction01:number;
  independentSupportSources:number;
  independentContradictionSources:number;
  corroborationFactor01:number;
  recommendedConfidence01:number;
  observationIds:string[];
}

export interface ExternalObserverState {
  version:2;
  observations:ExternalObservation[];
  assessments:ExternalObservationAssessment[];
  sources:ExternalObserverSource[];
  linkedActions:Array<{actionRef:string;observationId:string;assessment:PostconditionAssessment;at:number}>;
  reconciliations:number;
  corroboratedClaims:number;
  totalObservations:number;
  totalAssessments:number;
  verifiedCount:number;
  contradictedCount:number;
  unknownCount:number;
  meanObservationConfidence01:number;
  lastAt:number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const norm=(x:unknown)=>String(x??'').trim().toLowerCase().replace(/\s+/g,' ').slice(0,320);
const baseReliability=(sourceClass:ExternalObservationSourceClass)=>({os:.92,device:.80,user:.68,'external-api':.84,world:.56,organism:.25,simulator:.18,unknown:.40}[sourceClass]);
const VALID_SOURCE_CLASSES=new Set<ExternalObservationSourceClass>(['os','device','user','external-api','world','organism','simulator','unknown']);
const VALID_CHANNELS=new Set<ExternalObservationChannel>(['filesystem','http','process','device','camera','audio','sensor','user','world','tool','unknown']);
const nonNegativeInteger=(value:unknown)=>Math.max(0,Math.floor(Number.isFinite(Number(value))?Number(value):0));
const nonNegativeFinite=(value:unknown)=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
/** Strong SHA-256 fingerprints for new observations. Existing v2 rows keep their short legacy IDs. */
function stableHash(seed:string){return createHash('sha256').update(seed).digest('hex');}
/** Historical 32-bit FNV fingerprint; used only to identify already-persisted rows. */
function legacyStableHash(seed:string){let h=2166136261>>>0;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');}
function stableId(input:{sourceId:string;claimKey:string;actionRef?:string;observedAt:number;payloadHash:string}){
  return `obs:${sha256Stable({sourceId:input.sourceId,claimKey:input.claimKey,actionRef:input.actionRef??'',observedAtBucket:Math.floor(input.observedAt/1000),payloadHash:input.payloadHash})}`;
}
function isSafeEvidenceEventId(value:unknown):value is string{
  return typeof value==='string'&&value.length>0&&value.length<=180&&value.trim()===value&&!Array.from(value).some((character)=>{const code=character.charCodeAt(0);return code<=0x1f||code===0x7f||(code>=0x80&&code<=0x9f);});
}
function legacyStableId(input:{sourceId:string;claimKey:string;actionRef?:string;observedAt:number;payloadHash:string}){
  return `obs:${legacyStableHash(`${input.sourceId}|${input.claimKey}|${input.actionRef??''}|${Math.floor(input.observedAt/1000)}|${input.payloadHash}`)}`;
}
function freshness(observedAt:number,at:number){const age=Math.max(0,at-observedAt);return Math.exp(-age/(10*60*1000));}
function compareStrings(expected:string, observed:string):{assessment:PostconditionAssessment;similarity01:number;reason:string}{
  const e=norm(expected),o=norm(observed);
  if(!e||!o)return {assessment:'unknown',similarity01:0,reason:'missing-postcondition'};
  if(e===o)return {assessment:'match',similarity01:.98,reason:'normalized-exact-match'};
  const ep=/^([^:=]+)\s*[:=]\s*(.+)$/.exec(e);
  const op=/^([^:=]+)\s*[:=]\s*(.+)$/.exec(o);
  if(ep&&op&&norm(ep[1])===norm(op[1])&&norm(ep[2])!==norm(op[2]))return {assessment:'mismatch',similarity01:.02,reason:'same-field-conflicting-value'};
  if(o.includes(e)||e.includes(o))return {assessment:'match',similarity01:.84,reason:'postcondition-containment-match'};
  const et=new Set(e.split(/[^a-zа-яё0-9_-]+/i).filter(Boolean));
  const ot=new Set(o.split(/[^a-zа-яё0-9_-]+/i).filter(Boolean));
  const inter=[...et].filter(x=>ot.has(x)).length;
  const union=new Set([...et,...ot]).size;
  const j=union?inter/union:0;
  if(j>=.70)return {assessment:'match',similarity01:.74,reason:'high-token-overlap'};
  if(j<=.15)return {assessment:'unknown',similarity01:j,reason:'insufficient-token-overlap-for-contradiction'};
  return {assessment:'unknown',similarity01:j,reason:'ambiguous-token-overlap'};
}

export const defaultExternalObserver=():ExternalObserverState=>({version:2,observations:[],assessments:[],sources:[],linkedActions:[],reconciliations:0,corroboratedClaims:0,totalObservations:0,totalAssessments:0,verifiedCount:0,contradictedCount:0,unknownCount:0,meanObservationConfidence01:0,lastAt:0});

/**
 * BIG PASS 64: canonical transport for real-world observations.
 * It stores observations, not beliefs; verification is only promoted after a
 * separate observation is compared with the expected postcondition.
 */
export class ExternalObserverFabric {
  private state=defaultExternalObserver();
  private readonly corroboratedClaimKeys=new Set<string>();
  private readonly maxObservations:number;
  private readonly maxAssessments:number;
  private readonly maxSources:number;
  private readonly maxLinks:number;
  private readonly onObservation?: (observation:ExternalObservation)=>void;
  private readonly requireRegisteredSources:boolean;
  private readonly authorizeSourceRegistration?:ExternalObserverSourceRegistrationAuthorizer;

  constructor(config:{maxObservations?:number;maxAssessments?:number;maxSources?:number;maxLinks?:number;requireRegisteredSources?:boolean;authorizeSourceRegistration?:ExternalObserverSourceRegistrationAuthorizer;onObservation?:(observation:ExternalObservation)=>void}={}){
    this.maxObservations=Math.max(64,Math.floor(config.maxObservations??256));
    this.maxAssessments=Math.max(64,Math.floor(config.maxAssessments??192));
    this.maxSources=Math.max(16,Math.floor(config.maxSources??48));
    this.maxLinks=Math.max(32,Math.floor(config.maxLinks??128));
    this.onObservation=config.onObservation;
    this.authorizeSourceRegistration=config.authorizeSourceRegistration;
    // Strict runtimes separate source identity from observations. New identities
    // must match a trusted registrar policy, not merely supply plausible labels.
    this.requireRegisteredSources=config.requireRegisteredSources??false;
  }

  restore(raw?:Partial<ExternalObserverState>|null){
    const d=defaultExternalObserver(),r=raw??{};
    this.corroboratedClaimKeys.clear();
    const restoredSources:ExternalObserverSource[]=[];
    const seenSourceIds=new Set<string>();
    // Persisted source registries are state, not authority to bypass identity checks.
    // Keep the most-recent-first order emitted by registerSource and discard malformed
    // or duplicate IDs before observations are reconciled against them.
    for(const value of (Array.isArray(r.sources)?r.sources:[]) as unknown[]){
      // Invalid, duplicate, or unauthorized rows must not consume the bounded
      // registry's restore budget and crowd out later valid declarations.
      if(restoredSources.length>=this.maxSources)break;
      if(!value||typeof value!=='object')continue;
      const source=value as any;
      const id=typeof source.id==='string'?source.id.trim().slice(0,80):'';
      if(!/^[a-z0-9._-]{2,80}$/i.test(id)||seenSourceIds.has(id))continue;
      if(!VALID_SOURCE_CLASSES.has(source.sourceClass)||!VALID_CHANNELS.has(source.channel))continue;
      const independenceKey=typeof source.independenceKey==='string'&&source.independenceKey.trim()
        ?source.independenceKey.trim().slice(0,120):id;
      if(this.requireRegisteredSources&&!this.authorizeSourceRegistration?.({id,sourceClass:source.sourceClass,channel:source.channel,independenceKey}))continue;
      const reliability=Number(source.reliability01);
      const normalizedReliability=Number.isFinite(reliability)?clamp(reliability):baseReliability(source.sourceClass);
      // In strict mode the persisted snapshot may lower trust, but it cannot
      // elevate an authorized source above its conservative class prior.
      const restoredReliability=this.requireRegisteredSources
        ?Math.min(baseReliability(source.sourceClass),normalizedReliability)
        :normalizedReliability;
      restoredSources.push({
        id,sourceClass:source.sourceClass,channel:source.channel,independenceKey,
        reliability01:restoredReliability,
        enabled:typeof source.enabled==='boolean'?source.enabled:true,
        samples:nonNegativeInteger(source.samples),accepted:nonNegativeInteger(source.accepted),
        contradicted:nonNegativeInteger(source.contradicted),lastAt:nonNegativeFinite(source.lastAt),
      });
      seenSourceIds.add(id);
    }
    const restoredObservations=Array.isArray(r.observations)?r.observations as unknown[]:[];
    const observations:ExternalObservation[]=[];
    const sourceById=new Map(restoredSources.map(source=>[source.id,source] as const));
    for(const value of restoredObservations){
      // Bound accepted rows rather than raw offsets: corrupt/orphan rows must not
      // crowd valid recent observations out of the bounded restore window.
      if(observations.length>=this.maxObservations)break;
      if(!value||typeof value!=='object')continue;
      const row=value as any;
      if(typeof row.id!=='string'||typeof row.sourceId!=='string'||typeof row.claimKey!=='string')continue;
      if(!Number.isFinite(Number(row.observedAt))||!Number.isFinite(Number(row.confidence01)))continue;
      if(this.requireRegisteredSources){
        const source=sourceById.get(row.sourceId);
        if(!source||!source.enabled||source.sourceClass!==row.sourceClass||source.channel!==row.channel)continue;
        const rowKey=typeof row.independenceKey==='string'&&row.independenceKey.trim()
          ?row.independenceKey.trim().slice(0,120):undefined;
        if(rowKey!==undefined&&rowKey!==source.independenceKey)continue;
        const capturedTrust=Number(row.sourceReliabilityAtCapture01);
        const sourceReliabilityAtCapture01=Number.isFinite(capturedTrust)
          ?Math.min(source.reliability01,clamp(capturedTrust))
          :source.reliability01;
        observations.push({
          ...row,independenceKey:rowKey??source.independenceKey,
          observedAt:nonNegativeFinite(row.observedAt),confidence01:clamp(Number(row.confidence01)),
          sourceReliabilityAtCapture01,
          freshness01:clamp(Number(row.freshness01)),
          facts:Array.isArray(row.facts)?row.facts.filter((fact:unknown)=>typeof fact==='string').slice(0,64):[],
          metadata:row.metadata&&typeof row.metadata==='object'&&!Array.isArray(row.metadata)?row.metadata:{},
        } as ExternalObservation);
      } else {
        observations.push(value as ExternalObservation);
      }
    }
    const observationIds=new Set(observations.map(observation=>observation.id));
    const assessments:ExternalObserverState['assessments']=[];
    for(const value of (Array.isArray(r.assessments)?r.assessments:[]) as unknown[]){
      if(assessments.length>=this.maxAssessments)break;
      if(!value||typeof value!=='object')continue;
      const assessment=value as ExternalObserverState['assessments'][number];
      if(typeof assessment.observationId!=='string'||!observationIds.has(assessment.observationId))continue;
      assessments.push(assessment);
    }
    const linkedActions:ExternalObserverState['linkedActions']=[];
    for(const value of (Array.isArray(r.linkedActions)?r.linkedActions:[]) as unknown[]){
      if(linkedActions.length>=this.maxLinks)break;
      if(!value||typeof value!=='object')continue;
      const linked=value as ExternalObserverState['linkedActions'][number];
      if(typeof linked.observationId!=='string'||!observationIds.has(linked.observationId))continue;
      linkedActions.push(linked);
    }
    this.state={...d,...r,
      version:2,observations,assessments,sources:restoredSources,linkedActions,
    };
    this.recompute();
    for(const claimKey of new Set(this.state.observations.map(o=>o.claimKey))) this.refreshCorroboratedClaim(claimKey);
    this.recompute();
  }

  snapshot(){return structuredClone(this.state);}

  /** Return the current trust prior for a registered, enabled source; never create identities here. */
  registeredSourceReliability01(sourceId:string):number|null {
    const source=this.state.sources.find(item=>item.id===sourceId);
    return source?.enabled?clamp(source.reliability01):null;
  }

  registerSource(input:Partial<ExternalObserverSource>&Pick<ExternalObserverSource,'id'|'sourceClass'|'channel'>){
    const id=String(input.id).trim().slice(0,80);
    if(!/^[a-z0-9._-]{2,80}$/i.test(id))throw new Error('invalid-observer-source-id');
    const now=Date.now();
    const prior=this.state.sources.find(s=>s.id===id);
    // A source ID is the stable trust-registry identity. Allowing a later
    // registration to rewrite its class/channel/independence key lets one
    // physical source masquerade as a second independent witness.
    const requestedIndependenceKey=String(input.independenceKey??prior?.independenceKey??id).slice(0,120);
    if(prior && (
      prior.sourceClass!==input.sourceClass ||
      prior.channel!==input.channel ||
      prior.independenceKey!==requestedIndependenceKey
    )) {
      throw new Error('external-observer-source-identity-conflict');
    }

    if(this.requireRegisteredSources){
      // In strict mode, registerSource is not a trust-calibration API. Existing
      // identities are immutable here, and new ones must match an allowlisted
      // source declaration owned by the application/tool registry.
      if(prior) return structuredClone(prior);
      if(this.state.sources.length>=this.maxSources) throw new Error('observer-source-registry-capacity-exceeded');
      const identity:ExternalObserverSourceIdentity={id,sourceClass:input.sourceClass,channel:input.channel,independenceKey:requestedIndependenceKey};
      if(!this.authorizeSourceRegistration?.(identity)) throw new Error('external-observer-source-registration-not-authorized');
      const next:ExternalObserverSource={
        ...identity,reliability01:baseReliability(input.sourceClass),enabled:true,
        samples:0,accepted:0,contradicted:0,lastAt:0,
      };
      this.state.sources=[next,...this.state.sources].slice(0,this.maxSources);
      this.recompute();
      return structuredClone(next);
    }

    // Standalone adapters keep legacy operational configuration semantics. Their
    // trust prior is conservative, and a sample confidence never initializes it.
    if(!prior && this.state.sources.length>=this.maxSources) throw new Error('observer-source-registry-capacity-exceeded');
    const next:ExternalObserverSource={
      id,sourceClass:prior?.sourceClass??input.sourceClass,channel:prior?.channel??input.channel,
      independenceKey:prior?.independenceKey??requestedIndependenceKey,
      reliability01:clamp(input.reliability01??prior?.reliability01??baseReliability(input.sourceClass)),
      enabled:input.enabled??prior?.enabled??true,
      samples:prior?.samples??0,accepted:prior?.accepted??0,contradicted:prior?.contradicted??0,lastAt:prior?.lastAt??0,
    };
    this.state.sources=[next,...this.state.sources.filter(s=>s.id!==id)].slice(0,this.maxSources);
    this.recompute();
    return structuredClone(next);
  }

  ensureSource(input:{sourceId:string;sourceClass:ExternalObservationSourceClass;channel:ExternalObservationChannel;independenceKey?:string;reliability01?:number}){
    const existing=this.state.sources.find(s=>s.id===input.sourceId);
    if(existing){
      // Do not silently accept an observation whose caller labels disagree with
      // the registry. The registered identity remains authoritative, but a
      // mismatch is often a spoofing or wiring error and must fail closed.
      if(existing.sourceClass!==input.sourceClass || existing.channel!==input.channel ||
        (input.independenceKey!==undefined && existing.independenceKey!==String(input.independenceKey).slice(0,120))){
        throw new Error('external-observer-source-identity-conflict');
      }
      return existing;
    }
    // The canonical runtime disables implicit identity creation: an observation is
    // evidence about a known source, not authority to mint a new trust-registry entry.
    if(this.requireRegisteredSources) throw new Error('external-observer-source-not-registered');
    // Observation confidence describes this sample, not the source's long-term reliability.
    // Standalone adapters retain auto-registration, always with a conservative class prior.
    return this.registerSource({id:input.sourceId,sourceClass:input.sourceClass,channel:input.channel,independenceKey:input.independenceKey});
  }

  observe(input:{sourceId:string;sourceClass:ExternalObservationSourceClass;channel:ExternalObservationChannel;claimKey:string;observedPostcondition?:string;facts?:string[];confidence01?:number;observedAt?:number;actionRef?:string;predictionId?:string;tool?:string;tick?:number;independenceKey?:string;worldContextAfter?:WorldContext;metadata?:Record<string,unknown>;payload?:unknown;evidenceEventId?:string}):ExternalObservation{
    if(input.evidenceEventId!==undefined&&!isSafeEvidenceEventId(input.evidenceEventId))throw new TypeError('external-observer-evidence-event-id-invalid');
    const evidenceEventId=input.evidenceEventId;
    const observedAt=Number.isFinite(input.observedAt)?Number(input.observedAt):Date.now();
    const source=this.ensureSource({sourceId:input.sourceId,sourceClass:input.sourceClass,channel:input.channel,independenceKey:input.independenceKey,reliability01:input.confidence01});
    if(!source.enabled)throw new Error(`observer-source-disabled:${source.id}`);
    const claimKey=norm(input.claimKey).slice(0,180);
    const payloadValue=input.payload??{observedPostcondition:input.observedPostcondition,facts:input.facts??[],worldContextAfter:input.worldContextAfter??null};
    // Canonical JSON avoids property-order-dependent IDs; SHA-256 removes the
    // collision-prone 32-bit fingerprint from all newly written evidence rows.
    const canonicalPayload=stableJson(payloadValue);
    const payloadHash=stableHash(canonicalPayload);
    const idInput={sourceId:source.id,claimKey,actionRef:input.actionRef,observedAt,payloadHash};
    const id=evidenceEventId
      ?`obs:${sha256Stable({namespace:'nk1-verifier-event-v1',evidenceEventId})}`
      :stableId(idInput);
    const existing=this.state.observations.find(o=>o.id===id||
      (evidenceEventId!==undefined&&o.evidenceEventId===evidenceEventId));
    if(existing){
      const samePayload=existing.evidenceEventId===evidenceEventId&&existing.sourceId===source.id&&
        existing.sourceClass===source.sourceClass&&existing.channel===source.channel&&
        existing.claimKey===claimKey&&(existing.actionRef??'')===(input.actionRef??'')&&
        existing.observedAt===observedAt&&existing.payloadHash===payloadHash&&
        existing.independenceKey===source.independenceKey;
      if(!samePayload)throw new Error('external-observer-evidence-event-identity-conflict');
      this.onObservation?.(structuredClone(existing));
      return structuredClone(existing);
    }
    // Compatibility bridge: restoring a persisted v2 row must remain idempotent.
    // Reuse an old ID only when all its identity dimensions and legacy payload
    // hash agree, so an FNV collision alone can never deduplicate new evidence.
    const legacyPayloadHash=legacyStableHash(JSON.stringify(payloadValue));
    const legacyId=legacyStableId({...idInput,payloadHash:legacyPayloadHash});
    const legacyExisting=this.state.observations.find(o=>o.id===legacyId && o.payloadHash===legacyPayloadHash && o.sourceId===source.id && o.claimKey===claimKey && (o.actionRef??'')===(input.actionRef??'') && Math.floor(o.observedAt/1000)===Math.floor(observedAt/1000));
    if(legacyExisting)return structuredClone(legacyExisting);
    const row:ExternalObservation={
      id,...(evidenceEventId?{evidenceEventId}:{}),actionRef:input.actionRef?.slice(0,120),predictionId:input.predictionId?.slice(0,120),tool:input.tool?.slice(0,120),tick:input.tick,observedAt,
      sourceId:source.id,sourceClass:source.sourceClass,channel:source.channel,independenceKey:source.independenceKey,
      claimKey,subject:input.claimKey?claimKey:undefined,
      observedPostcondition:input.observedPostcondition?String(input.observedPostcondition).slice(0,320):undefined,
      facts:[...(input.facts??[])].map(x=>norm(x)).filter(Boolean).slice(0,24),confidence01:clamp(input.confidence01??source.reliability01),
      sourceReliabilityAtCapture01:source.reliability01,
      freshness01:freshness(observedAt,Date.now()),payloadHash,worldContextAfter:input.worldContextAfter?structuredClone(input.worldContextAfter):undefined,
      metadata:structuredClone(input.metadata??{}),
    };
    // Forward before mutating observer state: if the evidence sink rejects a conflict,
    // the observation itself must not appear successfully committed in this subsystem.
    this.onObservation?.(structuredClone(row));
    this.state.observations=[row,...this.state.observations].slice(0,this.maxObservations);
    source.samples+=1;source.lastAt=observedAt;
    this.refreshCorroboratedClaim(row.claimKey);
    this.recompute();
    return structuredClone(row);
  }

  assess(observationId:string,expectedPostcondition:string){
    const observation=this.state.observations.find(o=>o.id===observationId);
    if(!observation)throw new Error('unknown-observation');
    const normalizedExpected=String(expectedPostcondition).slice(0,320);
    const prior=this.state.assessments.find(a=>a.observationId===observationId&&a.expectedPostcondition===normalizedExpected);
    // Replay returns the original assessment before refreshing source counters or
    // trust. Otherwise an exact replay would become another corroboration sample.
    if(prior)return structuredClone(prior);
    const observed=String(observation.observedPostcondition??observation.facts[0]??'');
    const comparison=compareStrings(expectedPostcondition,observed);
    const source=this.state.sources.find(s=>s.id===observation.sourceId);
    const liveFreshness=freshness(observation.observedAt,Date.now());
    observation.freshness01=liveFreshness;
    // Similarity is directional: a clear field/value mismatch has low similarity
    // by definition, but can still be strong evidence that the desired state was
    // not reached. Do not attenuate explicit contradiction confidence by similarity.
    // Ambiguous textual mismatch remains unknown in compareStrings and cannot earn credit.
    const sourceConfidence=clamp(observation.confidence01*(source?.reliability01??.4)*liveFreshness);
    const confidence=comparison.assessment==='mismatch'
      ? sourceConfidence
      : clamp(sourceConfidence*comparison.similarity01);
    const verified=comparison.assessment==='match' && confidence>=.72 && observation.sourceClass!=='organism' && observation.sourceClass!=='simulator';
    const assessedConfidence=comparison.assessment==='mismatch'
      ? confidence
      : verified?confidence:clamp(confidence*.8);
    const assessment:ExternalObservationAssessment={observationId,actionRef:observation.actionRef,claimKey:observation.claimKey,expectedPostcondition:String(expectedPostcondition).slice(0,320),observedPostcondition:observed.slice(0,320),assessment:comparison.assessment,similarity01:comparison.similarity01,confidence01:assessedConfidence,verified,reason:comparison.reason,assessedAt:Date.now()};
    this.state.assessments=[assessment,...this.state.assessments].slice(0,this.maxAssessments);
    if(observation.actionRef)this.state.linkedActions=[{actionRef:observation.actionRef,observationId,assessment:assessment.assessment,at:assessment.assessedAt},...this.state.linkedActions.filter(x=>x.observationId!==observationId)].slice(0,this.maxLinks);
    if(source){
      if(assessment.assessment==='match')source.accepted+=1;
      if(assessment.assessment==='mismatch')source.contradicted+=1;
      // Assessment confidence is already attenuated by the prior source trust.
      // Do not multiply that prior into itself a second time when learning trust.
      // Definitive matches can improve trust; definitive contradictions reduce it.
      if(assessment.assessment==='match'||assessment.assessment==='mismatch'){
        const trustTarget01=clamp(observation.confidence01*liveFreshness*assessment.similarity01);
        source.reliability01=clamp(source.reliability01*.94+trustTarget01*.06);
      }
    }
    this.refreshCorroboratedClaim(observation.claimKey);
    this.recompute();
    return structuredClone(assessment);
  }

  observeAndAssess(input:Parameters<ExternalObserverFabric['observe']>[0]&{expectedPostcondition:string}){
    const observation=this.observe(input);
    return {observation,assessment:this.assess(observation.id,input.expectedPostcondition),reconciliation:this.reconcileClaim(observation.claimKey,input.expectedPostcondition)};
  }

  async observeFilesystem(input:{path:string;sourceId?:string;actionRef?:string;claimKey?:string;tick?:number;maxBytes?:number}){
    const filePath=String(input.path||'');
    if(!filePath || filePath.includes('\0'))throw new Error('invalid-observation-path');
    const info=await stat(filePath);
    const maxBytes=Math.max(0,Math.min(16_384,Math.floor(input.maxBytes??4096)));
    const bytes=info.isFile()?await readFile(filePath,'utf8'):'';
    const sample=bytes.slice(0,maxBytes);
    const observedPostcondition=`path=${filePath};type=${info.isDirectory()?'directory':info.isFile()?'file':'other'};size=${info.size}`;
    return this.observe({sourceId:input.sourceId??'filesystem',sourceClass:'os',channel:'filesystem',claimKey:input.claimKey??`filesystem:${filePath}`,observedPostcondition,facts:[observedPostcondition,`sampleHash=${stableHash(sample)}`],confidence01:.94,actionRef:input.actionRef,tick:input.tick,metadata:{mtimeMs:info.mtimeMs,mode:info.mode,sampleBytes:sample.length},payload:{size:info.size,mtimeMs:info.mtimeMs,sampleHash:stableHash(sample)}});
  }

  async observeHttp(input:{url:string;sourceId?:string;actionRef?:string;tool?:string;tick?:number;claimKey?:string;timeoutMs?:number}){
    const target=new URL(String(input.url||''));
    if(!['http:','https:'].includes(target.protocol))throw new Error('observer-http-scheme-not-allowed');
    const timeoutMs=Math.max(500,Math.min(10_000,Math.floor(input.timeoutMs??5000)));
    const response=await fetch(target,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(timeoutMs)});
    const contentType=String(response.headers.get('content-type')??'');
    const body=(await response.text()).slice(0,2048);
    const observedPostcondition=`httpStatus=${response.status};contentType=${contentType.split(';')[0]||'unknown'}`;
    return this.observe({sourceId:input.sourceId??'http-observer',sourceClass:'external-api',channel:'http',claimKey:input.claimKey??`http:${target.origin}${target.pathname}`,observedPostcondition,facts:[observedPostcondition,`bodyHash=${stableHash(body)}`],confidence01:response.ok?.90:.82,actionRef:input.actionRef,tool:input.tool,tick:input.tick,metadata:{status:response.status,contentType,location:response.headers.get('location')},payload:{status:response.status,contentType,bodyHash:stableHash(body)}});
  }

  observeProcess(input:{pid:number;sourceId?:string;actionRef?:string;tick?:number;claimKey?:string}){
    const pid=Math.max(1,Math.floor(Number(input.pid)));
    let alive=true;
    try{process.kill(pid,0);}catch(error){if((error as any)?.code==='ESRCH')alive=false;else if((error as any)?.code==='EPERM')alive=true;else throw error;}
    const observedPostcondition=`process=${pid};alive=${alive}`;
    return this.observe({sourceId:input.sourceId??'process-observer',sourceClass:'os',channel:'process',claimKey:input.claimKey??`process:${pid}`,observedPostcondition,facts:[observedPostcondition],confidence01:.98,actionRef:input.actionRef,tick:input.tick,metadata:{pid,alive},payload:{pid,alive}});
  }

  reconcileClaim(claimKey:string,expectedPostcondition?:string,now=Date.now()):RealityClaimReconciliation{
    const key=norm(claimKey);
    const rows=this.state.observations.filter(o=>o.claimKey===key).slice(0,64);
    if(!rows.length)return {claimKey:key,expectedPostcondition, status:'unknown', support01:0, contradiction01:0, independentSupportSources:0, independentContradictionSources:0, corroborationFactor01:0, recommendedConfidence01:0, observationIds:[]};
    const supportByInd=new Map<string,number>();
    const contradictionByInd=new Map<string,number>();
    for(const row of rows){
      const source=this.state.sources.find(s=>s.id===row.sourceId);
      const weight=clamp(row.confidence01*(source?.reliability01??.4)*freshness(row.observedAt,now));
      let assessment:PostconditionAssessment='unknown';
      let sim=0;
      if(expectedPostcondition){ const c=compareStrings(expectedPostcondition,String(row.observedPostcondition??row.facts[0]??'')); assessment=c.assessment; sim=c.similarity01; }
      else {
        const observed=norm(String(row.observedPostcondition??row.facts[0]??''));
        assessment=observed?'match':'unknown'; sim=observed?1:0;
      }
      // Similarity is high for matches but intentionally low for a clear
      // contradiction (e.g. status=ready vs status=blocked). Using similarity
      // for both directions erased the strongest negative evidence. Weight the
      // direction actually observed; unknown comparisons still contribute zero.
      const directionalStrength=assessment==='match'?sim:assessment==='mismatch'?1-sim:0;
      const contribution=clamp(weight*directionalStrength);
      const ind=row.independenceKey||row.sourceId;
      if(assessment==='match')supportByInd.set(ind,Math.max(supportByInd.get(ind)??0,contribution));
      else if(assessment==='mismatch')contradictionByInd.set(ind,Math.max(contradictionByInd.get(ind)??0,contribution));
    }
    const combine=(vals:number[])=>1-vals.reduce((prod,v)=>prod*(1-clamp(v)),1);
    const support01=combine([...supportByInd.values()]);
    const contradiction01=combine([...contradictionByInd.values()]);
    const independentSupportSources=[...supportByInd.values()].filter(v=>v>=.45).length;
    const independentContradictionSources=[...contradictionByInd.values()].filter(v=>v>=.45).length;
    const corroborationFactor01=clamp(Math.min(1,Math.max(independentSupportSources,independentContradictionSources)/2)*.35 + Math.max(support01,contradiction01)*.65);
    const status:RealityConsensusStatus=
      independentSupportSources>=2 && support01>=.68 && support01>contradiction01*1.08 ? 'corroborated' :
      support01>=.78 && support01>contradiction01*1.25 ? 'supported' :
      contradiction01>=.68 && contradiction01>support01*1.08 ? 'disputed' : 'unknown';
    const direction=status==='disputed'?contradiction01:support01;
    return {claimKey:key,expectedPostcondition, status, support01, contradiction01, independentSupportSources, independentContradictionSources, corroborationFactor01, recommendedConfidence01:clamp(direction*.72+corroborationFactor01*.28), observationIds:rows.map(r=>r.id)};
  }

  latestForAction(actionRef:string){return this.state.observations.filter(o=>o.actionRef===actionRef).sort((a,b)=>b.observedAt-a.observedAt)[0]??null;}
  latestAssessmentForAction(actionRef:string){return this.state.assessments.find(a=>a.actionRef===actionRef)??null;}
  summary(){const assessedIds=new Set(this.state.assessments.map(a=>a.observationId));const unresolved=this.state.observations.reduce((n,o)=>n+(assessedIds.has(o.id)?0:1),0);return {version:2,observations:this.state.observations.length,assessments:this.state.assessments.length,sources:this.state.sources.length,linkedActions:this.state.linkedActions.length,reconciliations:this.state.reconciliations,corroboratedClaims:this.state.corroboratedClaims,verifiedCount:this.state.verifiedCount,contradictedCount:this.state.contradictedCount,unknownCount:this.state.unknownCount,unresolvedCount:unresolved,verificationRate01:this.state.assessments.length?this.state.verifiedCount/this.state.assessments.length:0,meanObservationConfidence01:this.state.meanObservationConfidence01,lastAt:this.state.lastAt};}

  private refreshCorroboratedClaim(claimKey:string){
    const key=norm(claimKey);
    if(!key)return;
    const status=this.reconcileClaim(key).status;
    if(status==='corroborated') this.corroboratedClaimKeys.add(key); else this.corroboratedClaimKeys.delete(key);
  }

  private recompute(){
    this.state.totalObservations=this.state.observations.length;
    this.state.reconciliations=this.state.observations.length?new Set(this.state.observations.map(o=>o.claimKey)).size:0;
    this.state.corroboratedClaims=this.corroboratedClaimKeys.size;
    this.state.totalAssessments=this.state.assessments.length;
    this.state.verifiedCount=this.state.assessments.filter(a=>a.verified).length;
    this.state.contradictedCount=this.state.assessments.filter(a=>a.assessment==='mismatch').length;
    this.state.unknownCount=this.state.assessments.filter(a=>a.assessment==='unknown').length;
    this.state.meanObservationConfidence01=this.state.observations.length?clamp(this.state.observations.reduce((s,o)=>s+o.confidence01,0)/this.state.observations.length):0;
    this.state.lastAt=Math.max(this.state.lastAt,...this.state.observations.map(o=>o.observedAt),0);
  }
}
