import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import type { CausalExperienceRecord, CausalLearningPacket } from './CausalExperienceStream.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DIM=16;
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface UnifiedLearningPattern {
  id:string;
  key:string;
  samples:number;
  taskId:string;
  dominantAction:ActionKind;
  meanReward01:number;
  meanPredictionError01:number;
  meanCausalStrength01:number;
  meanNovelty01:number;
  transferPotential01:number;
  confidence01:number;
  firstAt:number;
  lastAt:number;
}

export interface TransferProbe {
  id:string;
  sourceTaskId:string;
  targetTaskId:string;
  baseline01:number;
  postScore01:number;
  delta01:number;
  independentVerified:boolean;
  holdout:boolean;
  contextKey:string;
  at:number;
}

export interface TransferProbeLedgerEntry {
  id:string;
  fingerprint:string;
}

export interface ExternalLearningHypothesis {
  id:string;
  taskId:string;
  action:ActionKind;
  reward01:number;
  success01:number;
  surprise01:number;
  novelty01:number;
  causalStrength01:number;
  transferPotential01:number;
  claimedProvenance:'experience-replay'|'skill-repair'|'external';
  receivedAt:number;
}

export interface UnifiedLearningLoopState {
  cycleId:string;
  phase:'idle'|'experience'|'memory'|'replay'|'learning'|'policy'|'verification'|'consolidation';
  completed:number;
  total:number;
  lastOutcomeVerified:boolean;
  lastLearningDelta01:number;
  lastPolicyDelta01:number;
  lastTransferDelta01:number;
  lastRetention01:number;
  closedLoopCount:number;
  verifiedClosedLoopCount:number;
  failedClosedLoopCount:number;
  lastAt:number;
}

export interface UnifiedLearningState {
  version:4;
  cycles:number;
  samples:number;
  updates:number;
  sharedRepresentation01:number[];
  representationDrift01:number;
  predictionAgreement01:number;
  crossTaskTransfer01:number;
  consolidationEfficiency01:number;
  developmentalTransfer01:number;
  lastDevelopmentalSignal01:number;
  lastLearningOpportunity01:number;
  lastAt:number;
  patterns:UnifiedLearningPattern[];
  /** Unverified external inputs are retained separately and never train core patterns directly. */
  externalHypotheses:ExternalLearningHypothesis[];
  provenanceCounts:{runtime:number;experienceReplay:number;skillRepair:number;external:number};
  validatedTransferSamples:number;
  positiveTransferSamples:number;
  negativeTransferSamples:number;
  interference01:number;
  transferProbes:TransferProbe[];
  /** Bounded persistent dedupe registry; recent probe rows alone are insufficient after eviction. */
  transferProbeLedger:TransferProbeLedgerEntry[];
  loop:UnifiedLearningLoopState;
}

export interface UnifiedLearningSignal {
  latent01:number[];
  learningOpportunity01:number;
  representationNovelty01:number;
  transferPotential01:number;
  consolidationPriority01:number;
}

export const defaultUnifiedLearning=():UnifiedLearningState=>({
  version:4,cycles:0,samples:0,updates:0,sharedRepresentation01:new Array(DIM).fill(.5),
  representationDrift01:0,predictionAgreement01:.5,crossTaskTransfer01:0,consolidationEfficiency01:0,developmentalTransfer01:0,lastDevelopmentalSignal01:0,
  lastLearningOpportunity01:0,lastAt:0,patterns:[],externalHypotheses:[],provenanceCounts:{runtime:0,experienceReplay:0,skillRepair:0,external:0},validatedTransferSamples:0,positiveTransferSamples:0,negativeTransferSamples:0,interference01:0,transferProbes:[],transferProbeLedger:[],loop:{cycleId:'',phase:'idle',completed:0,total:7,lastOutcomeVerified:false,lastLearningDelta01:0,lastPolicyDelta01:0,lastTransferDelta01:0,lastRetention01:1,closedLoopCount:0,verifiedClosedLoopCount:0,failedClosedLoopCount:0,lastAt:0},
});

function stateVector(state:OrganismState):number[]{
  const n=state.needs;
  return [n.energy,n.cognitiveLoad,n.uncertainty,n.novelty,n.goalPressure,n.socialNeed,n.identityCoherence,state.predictionError,state.attentionBudget,state.selfPredictionError,
    1-n.energy,1-n.cognitiveLoad,1-n.uncertainty,1-n.novelty,1-n.goalPressure,1-n.socialNeed].map(clamp01);
}
function centroid(oldV:number[],newV:number[],alpha:number){return newV.map((v,i)=>clamp01((oldV[i]??.5)*(1-alpha)+v*alpha));}
function distance(a:number[],b:number[]){let s=0,n=Math.min(a.length,b.length);for(let i=0;i<n;i++)s+=(clamp01(a[i])-clamp01(b[i]))**2;return n?clamp01(Math.sqrt(s/n)*1.8):0;}

const normalizeEvidenceId=(value:unknown,maxLength=96):string=>{
  if(typeof value!=='string')return '';
  const normalized=value.normalize('NFKC');
  if(Array.from(normalized).some(character=>{
    const code=character.codePointAt(0)??0;
    return code<=0x1f||(code>=0x7f&&code<=0x9f);
  }))return '';
  const trimmed=normalized.trim();
  return trimmed.length>0&&trimmed.length<=maxLength?trimmed:'';
};
const isUnitInterval=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const transferProbeFingerprint=(probe:Pick<TransferProbe,'sourceTaskId'|'targetTaskId'|'baseline01'|'postScore01'|'independentVerified'|'holdout'|'contextKey'>):string=>
  JSON.stringify([probe.sourceTaskId,probe.targetTaskId,probe.baseline01,probe.postScore01,probe.independentVerified,probe.holdout,probe.contextKey]);
function restoreTransferProbe(value:unknown):TransferProbe|null{
  if(!value||typeof value!=='object')return null;
  const raw=value as Partial<TransferProbe>;
  const id=normalizeEvidenceId(raw.id);
  const sourceTaskId=normalizeEvidenceId(raw.sourceTaskId);
  const targetTaskId=normalizeEvidenceId(raw.targetTaskId);
  const contextKey=normalizeEvidenceId(raw.contextKey);
  if(!id||!sourceTaskId||!targetTaskId||!contextKey||
    !isUnitInterval(raw.baseline01)||!isUnitInterval(raw.postScore01)||
    typeof raw.independentVerified!=='boolean'||typeof raw.holdout!=='boolean'||
    !Number.isSafeInteger(raw.at)||Number(raw.at)<0||typeof raw.delta01!=='number'||!Number.isFinite(raw.delta01))return null;
  const delta01=raw.postScore01-raw.baseline01;
  if(Math.abs(raw.delta01-delta01)>1e-9)return null;
  return {id,sourceTaskId,targetTaskId,baseline01:raw.baseline01,postScore01:raw.postScore01,delta01,
    independentVerified:raw.independentVerified,holdout:raw.holdout,contextKey,at:Number(raw.at)};
}

function isGroundedRuntimeOutcome(record:CausalExperienceRecord):boolean{
  const metrics=[record.reward01,record.success01,record.surprise01,record.predictionError01,record.novelty01,
    record.uncertainty01,record.energyBefore01,record.energyAfter01,record.stateDelta01,record.causalStrength01,
    record.identityRelevance01,record.goalPressure01];
  return record.provenance==='runtime-outcome'&&record.stateGrounded===true&&
    typeof record.traceId==='string'&&record.traceId.length>0&&record.traceId.length<=180&&
    Number.isSafeInteger(record.tick)&&record.tick>=0&&ACTIONS.includes(record.action)&&
    metrics.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1)&&
    Array.isArray(record.policyFeatures01)&&record.policyFeatures01.length>=16&&record.policyFeatures01.length<=64&&
    record.policyFeatures01.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1);
}

function restoreExternalHypotheses(value:unknown):ExternalLearningHypothesis[]{
  if(!Array.isArray(value))return [];
  return value.filter((item:unknown):item is ExternalLearningHypothesis=>{
    if(!item||typeof item!=='object')return false;
    const h=item as Partial<ExternalLearningHypothesis>;
    return typeof h.id==='string'&&h.id.length>0&&h.id.length<=160&&
      typeof h.taskId==='string'&&h.taskId.length>0&&h.taskId.length<=96&&ACTIONS.includes(h.action as ActionKind)&&
      [h.reward01,h.success01,h.surprise01,h.novelty01,h.causalStrength01,h.transferPotential01].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)&&
      (h.claimedProvenance==='experience-replay'||h.claimedProvenance==='skill-repair'||h.claimedProvenance==='external')&&
      typeof h.receivedAt==='number'&&Number.isFinite(h.receivedAt)&&h.receivedAt>=0;
  }).slice(-128).map(h=>({...h,id:h.id.slice(0,160),taskId:h.taskId.slice(0,96)}));
}

export class UnifiedLearningSubstrate {
  private state=defaultUnifiedLearning();
  restore(raw?:Partial<UnifiedLearningState>|null){
    const d=defaultUnifiedLearning(),r=raw??{};
    // v3 patterns/representations could have been updated by caller-asserted
    // skill-repair/replay claims. They have no per-sample evidence references,
    // so they cannot be safely relabelled as trusted. Reset only the learned
    // substrate on migration; durable organism memory and identity are untouched.
    if(r.version!==4){
      const safeCycles=typeof r.cycles==='number'&&Number.isSafeInteger(r.cycles)&&r.cycles>=0?r.cycles:0;
      this.state={...d,cycles:safeCycles};
      return;
    }
    const rawRepresentation=r.sharedRepresentation01;
    const validRepresentation=Array.isArray(rawRepresentation)&&rawRepresentation.length===DIM&&
      rawRepresentation.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1);
    const safeCount=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
    const safeMetric=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
    const rawProvenance=r.provenanceCounts;
    const provenanceCounts={
      runtime:safeCount(rawProvenance?.runtime),
      experienceReplay:safeCount(rawProvenance?.experienceReplay),
      skillRepair:safeCount(rawProvenance?.skillRepair),
      external:safeCount(rawProvenance?.external),
    };
    // Snapshot data crosses a persistence boundary: sanitize recent probes and
    // rebuild their stable-ID ledger before any restored evidence affects metrics.
    const ledger=new Map<string,string>();
    if(Array.isArray(r.transferProbeLedger)){
      for(const item of r.transferProbeLedger.slice(-4096)){
        if(!item||typeof item!=='object')continue;
        const entry=item as TransferProbeLedgerEntry;
        const probeId=normalizeEvidenceId(entry.id);
        if(probeId&&typeof entry.fingerprint==='string'&&entry.fingerprint.length>0&&entry.fingerprint.length<=1024)
          ledger.set(probeId,entry.fingerprint);
      }
    }
    const restoredTransferProbes:TransferProbe[]=[];
    const restoredSeen=new Set<string>();
    const rawTransferProbes=Array.isArray(r.transferProbes)?r.transferProbes.slice(-96):[];
    for(const rawProbe of rawTransferProbes){
      const probe=restoreTransferProbe(rawProbe);
      if(!probe||restoredSeen.has(probe.id))continue;
      const fingerprint=transferProbeFingerprint(probe);
      const registered=ledger.get(probe.id);
      if(registered&&registered!==fingerprint)continue;
      if(!registered)ledger.set(probe.id,fingerprint);
      restoredSeen.add(probe.id);
      restoredTransferProbes.push(probe);
    }
    const transferProbeLedger=[...ledger.entries()].slice(-4096).map(([probeId,fingerprint])=>({id:probeId,fingerprint}));
    this.state={
      ...d,
      version:4,
      cycles:safeCount(r.cycles),
      samples:safeCount(r.samples),
      updates:safeCount(r.updates),
      sharedRepresentation01:validRepresentation?rawRepresentation as number[]:d.sharedRepresentation01.slice(),
      representationDrift01:safeMetric(r.representationDrift01),
      predictionAgreement01:safeMetric(r.predictionAgreement01,.5),
      crossTaskTransfer01:safeMetric(r.crossTaskTransfer01),
      consolidationEfficiency01:safeMetric(r.consolidationEfficiency01),
      developmentalTransfer01:safeMetric(r.developmentalTransfer01),
      lastDevelopmentalSignal01:safeMetric(r.lastDevelopmentalSignal01),
      lastLearningOpportunity01:safeMetric(r.lastLearningOpportunity01),
      lastAt:safeCount(r.lastAt),
      patterns:Array.isArray(r.patterns)?r.patterns.slice(-128):[],
      externalHypotheses:restoreExternalHypotheses(r.externalHypotheses),
      provenanceCounts,
      validatedTransferSamples:safeCount(r.validatedTransferSamples),
      positiveTransferSamples:safeCount(r.positiveTransferSamples),
      negativeTransferSamples:safeCount(r.negativeTransferSamples),
      interference01:safeMetric(r.interference01),
      transferProbes:restoredTransferProbes,
      transferProbeLedger,
      loop:r.loop&&typeof r.loop==='object'?{...d.loop,...r.loop}:d.loop,
    };
  }
  snapshot(){return structuredClone(this.state);}
  /** Read-only oldest-first queue for independent assessment; reading never promotes or deletes a claim. */
  pendingExternalHypotheses(limit=32):ExternalLearningHypothesis[]{
    const wanted=Math.max(1,Math.min(128,Math.floor(Number.isFinite(limit)?limit:32)));
    return this.state.externalHypotheses.slice(0,wanted).map(item=>structuredClone(item));
  }
  beginCycle(){this.state.cycles++;this.state.loop={...this.state.loop,cycleId:'',phase:'idle',completed:0,total:7,lastOutcomeVerified:false,lastLearningDelta01:0,lastPolicyDelta01:0,lastTransferDelta01:0,lastRetention01:1,lastAt:Date.now()};}

  beginLearningLoop(input:{traceId:string;taskId:string;at?:number}){
    const at=input.at??Date.now();
    this.state.loop={...this.state.loop,cycleId:String(input.traceId).slice(0,128),phase:'experience',completed:1,total:7,lastOutcomeVerified:false,lastLearningDelta01:0,lastPolicyDelta01:0,lastTransferDelta01:0,lastRetention01:1,lastAt:at};
    return structuredClone(this.state.loop);
  }

  advanceLearningLoop(phase:UnifiedLearningLoopState['phase'], input?:{learningDelta01?:number;policyDelta01?:number;transferDelta01?:number;retention01?:number;at?:number}){
    const order:UnifiedLearningLoopState['phase'][]=['idle','experience','memory','replay','learning','policy','verification','consolidation'];
    const index=Math.max(0,order.indexOf(phase));
    const at=input?.at??Date.now();
    this.state.loop={...this.state.loop,phase,completed:Math.max(this.state.loop.completed,index),lastLearningDelta01:clamp01(input?.learningDelta01??this.state.loop.lastLearningDelta01),lastPolicyDelta01:clamp01(input?.policyDelta01??this.state.loop.lastPolicyDelta01),lastTransferDelta01:clamp01(input?.transferDelta01??this.state.loop.lastTransferDelta01),lastRetention01:clamp01(input?.retention01??this.state.loop.lastRetention01),lastAt:at};
    return structuredClone(this.state.loop);
  }

  closeLearningLoop(input:{verified:boolean;learningDelta01:number;policyDelta01:number;transferDelta01:number;retention01:number;at?:number}){
    const at=input.at??Date.now();
    const verified=Boolean(input.verified);
    this.state.loop={...this.state.loop,phase:'consolidation',completed:7,total:7,lastOutcomeVerified:verified,lastLearningDelta01:clamp01(input.learningDelta01),lastPolicyDelta01:clamp01(input.policyDelta01),lastTransferDelta01:clamp01(input.transferDelta01),lastRetention01:clamp01(input.retention01),closedLoopCount:this.state.loop.closedLoopCount+1,verifiedClosedLoopCount:this.state.loop.verifiedClosedLoopCount+(verified?1:0),failedClosedLoopCount:this.state.loop.failedClosedLoopCount+(verified?0:1),lastAt:at};
    return structuredClone(this.state.loop);
  }

  learningLoopDiagnostics(){return structuredClone(this.state.loop);}

  encode(state:OrganismState):number[]{
    const x=stateVector(state);
    const alpha=this.state.samples<8?.12:.045;
    const drift=distance(this.state.sharedRepresentation01,x);
    this.state.sharedRepresentation01=centroid(this.state.sharedRepresentation01,x,alpha);
    this.state.representationDrift01=clamp01(this.state.representationDrift01*.94+drift*.06);
    return x;
  }

  ingestExternalSignal(input:{taskId:string;action:ActionKind;reward01:number;success01:number;surprise01:number;novelty01:number;causalStrength01:number;transferPotential01?:number;provenance?:'experience-replay'|'skill-repair'|'external'}){
    const reward=clamp01(input.reward01),success=clamp01(input.success01),surprise=clamp01(input.surprise01),novelty=clamp01(input.novelty01),causal=clamp01(input.causalStrength01);
    const transfer=clamp01(input.transferPotential01??(.45*causal+.25*novelty+.30*success));
    const opportunity=clamp01(.50*causal+.22*surprise+.18*novelty+.10*transfer);
    const priority=clamp01(.58*opportunity+.42*transfer);
    // Provenance is a claim from the caller, not proof of origin. Quarantine this
    // signal as a hypothesis; only the verified runtime-outcome lane may update
    // behavioral patterns, transfer estimates, or the shared representation.
    const claimedProvenance=input.provenance==='experience-replay'||input.provenance==='skill-repair'?input.provenance:'external';
    this.state.provenanceCounts.external++;
    const receivedAt=Date.now();
    this.state.externalHypotheses.push({
      id:`ulh-${this.state.externalHypotheses.length+1}-${receivedAt}`,
      taskId:String(input.taskId??'').normalize('NFKC').trim().slice(0,96)||'unknown-task',
      action:ACTIONS.includes(input.action)?input.action:'wait',
      reward01:reward,success01:success,surprise01:surprise,novelty01:novelty,
      causalStrength01:causal,transferPotential01:transfer,
      claimedProvenance:claimedProvenance,receivedAt,
    });
    if(this.state.externalHypotheses.length>128)this.state.externalHypotheses=this.state.externalHypotheses.slice(-128);
    return {learningOpportunity01:opportunity,consolidationPriority01:priority,transferPotential01:transfer,acceptedAs:'unverified-hypothesis' as const,coreLearningUpdated:false};
  }
  ingest(trace:OrganismDecisionTrace,after:OrganismState,record:CausalExperienceRecord|null,packet:CausalLearningPacket):UnifiedLearningSignal{
    const before=stateVector(trace.stateBefore),afterV=stateVector(after);
    const drift=distance(before,afterV);
    const repNovelty=distance(this.state.sharedRepresentation01,afterV);
    const trustedRecord=record&&isGroundedRuntimeOutcome(record)&&
      record.traceId===trace.id&&record.tick===trace.tick&&record.action===trace.selected?.action
      ?record:null;
    const trustedPacketRecords=Array.isArray(packet?.records)?packet.records.filter(isGroundedRuntimeOutcome):[];
    const packetOpportunity=trustedPacketRecords.length
      ?trustedPacketRecords.reduce((sum,row)=>sum+row.causalStrength01*.6+row.surprise01*.2+row.predictionError01*.2,0)/trustedPacketRecords.length
      :0;
    const prediction=clamp01(trace.stateBefore.predictionError);
    const novelty=clamp01(trace.stateBefore.needs.novelty);
    // Without a record bound to this exact decision and a grounded state change,
    // learn only representation/prediction structure; do not import reward credit.
    const causal=trustedRecord?.causalStrength01??clamp01(.45*drift+.35*prediction+.20*packetOpportunity);
    const reward=trustedRecord?.reward01??.5;
    const transfer=clamp01(.45*(1-Math.abs(reward-.5)*1.2)+.3*causal+.25*repNovelty);
    const opportunity=clamp01(.48*causal+.2*prediction+.16*novelty+.16*repNovelty);
    const consolidationPriority=clamp01(opportunity*.55+Math.min(1,trustedPacketRecords.length/12)*.25+transfer*.2);
    const alpha=.04+.10*opportunity;
    this.state.sharedRepresentation01=centroid(this.state.sharedRepresentation01,afterV,alpha);
    this.state.representationDrift01=clamp01(this.state.representationDrift01*.9+drift*.1);
    this.state.predictionAgreement01=clamp01(this.state.predictionAgreement01*.94+(1-prediction)*.06);
    this.state.crossTaskTransfer01=clamp01(this.state.crossTaskTransfer01*.96+transfer*.04);
    this.state.consolidationEfficiency01=clamp01(this.state.consolidationEfficiency01*.97+(consolidationPriority>0.5?1:0)*.03);
    this.state.lastLearningOpportunity01=opportunity;
    this.state.samples++;this.state.updates++;this.state.lastAt=Date.now();
    if(trustedRecord)this.upsertPattern(trustedRecord,transfer);
    return {latent01:this.state.sharedRepresentation01.slice(),learningOpportunity01:opportunity,representationNovelty01:repNovelty,transferPotential01:transfer,consolidationPriority01:consolidationPriority};
  }

  private upsertPattern(record:CausalExperienceRecord,transferPotential01:number){
    const key=`${record.taskId}|${record.action}`;
    const prev=this.state.patterns.find(p=>p.key===key);
    if(!prev){
      this.state.patterns.push({id:`ulp-${this.state.patterns.length+1}-${record.tick}`,key,samples:1,taskId:record.taskId,dominantAction:record.action,meanReward01:record.reward01,meanPredictionError01:record.predictionError01,meanCausalStrength01:record.causalStrength01,meanNovelty01:record.novelty01,transferPotential01,confidence01:.35,firstAt:record.at,lastAt:record.at});
    }else{
      const a=1/Math.max(2,prev.samples+1);prev.samples++;prev.meanReward01=prev.meanReward01*(1-a)+record.reward01*a;prev.meanPredictionError01=prev.meanPredictionError01*(1-a)+record.predictionError01*a;prev.meanCausalStrength01=prev.meanCausalStrength01*(1-a)+record.causalStrength01*a;prev.meanNovelty01=prev.meanNovelty01*(1-a)+record.novelty01*a;prev.transferPotential01=prev.transferPotential01*(1-a)+transferPotential01*a;prev.confidence01=clamp01(prev.confidence01*.92+.08*clamp01(.45+prev.samples/32));prev.lastAt=record.at;
    }
    this.state.patterns.sort((a,b)=>(b.samples*b.meanCausalStrength01)-(a.samples*a.meanCausalStrength01));
    if(this.state.patterns.length>128)this.state.patterns=this.state.patterns.slice(0,128);
  }

  beginTransferProbe(input:{sourceTaskId:string;targetTaskId:string;baseline01:number;contextKey:string;at?:number}){
    const sourceTaskId=normalizeEvidenceId(input.sourceTaskId);
    const targetTaskId=normalizeEvidenceId(input.targetTaskId);
    const contextKey=normalizeEvidenceId(input.contextKey);
    const at=input.at??Date.now();
    const validInput=Boolean(sourceTaskId&&targetTaskId&&contextKey&&isUnitInterval(input.baseline01)&&Number.isSafeInteger(at)&&at>=0);
    const id=validInput?normalizeEvidenceId('transfer:'+sourceTaskId.slice(0,24)+':'+targetTaskId.slice(0,24)+':'+at+':'+this.state.transferProbes.length+':'+this.state.validatedTransferSamples):'';
    // Keep the historical non-null builder API for TypeScript callers. Invalid
    // inputs produce an unmistakably invalid candidate which recordTransferProbe rejects.
    return {id,sourceTaskId,targetTaskId,baseline01:input.baseline01,contextKey,at:Number.isSafeInteger(at)&&at>=0?at:-1};
  }

  recordTransferProbe(input:{id:string;sourceTaskId:string;targetTaskId:string;baseline01:number;postScore01:number;independentVerified:boolean;holdout:boolean;contextKey:string;at?:number}):TransferProbe|null{
    const id=normalizeEvidenceId(input?.id);
    const sourceTaskId=normalizeEvidenceId(input?.sourceTaskId);
    const targetTaskId=normalizeEvidenceId(input?.targetTaskId);
    const contextKey=normalizeEvidenceId(input?.contextKey);
    const at=input?.at??Date.now();
    if(!id||!sourceTaskId||!targetTaskId||!contextKey||
      !isUnitInterval(input?.baseline01)||!isUnitInterval(input?.postScore01)||
      typeof input?.independentVerified!=='boolean'||typeof input?.holdout!=='boolean'||
      !Number.isSafeInteger(at)||at<0)return null;
    const probe:TransferProbe={id,sourceTaskId,targetTaskId,baseline01:input.baseline01,postScore01:input.postScore01,
      delta01:input.postScore01-input.baseline01,independentVerified:input.independentVerified,
      holdout:input.holdout,contextKey,at};
    const fingerprint=transferProbeFingerprint(probe);
    const known=this.state.transferProbeLedger.find(entry=>entry.id===id);
    if(known){
      if(known.fingerprint!==fingerprint)return null;
      const existing=this.state.transferProbes.find(row=>row.id===id);
      return existing?structuredClone(existing):null;
    }
    this.state.transferProbeLedger.push({id,fingerprint});
    if(this.state.transferProbeLedger.length>4096)this.state.transferProbeLedger=this.state.transferProbeLedger.slice(-4096);
    this.state.transferProbes.push(probe);
    if(this.state.transferProbes.length>96)this.state.transferProbes=this.state.transferProbes.slice(-96);
    const delta=probe.delta01;
    if(probe.independentVerified&&probe.holdout){
      this.state.validatedTransferSamples++;
      if(delta>.04)this.state.positiveTransferSamples++; else if(delta<-.04)this.state.negativeTransferSamples++;
      const signed=clamp01(Math.abs(Math.min(0,delta))*2);
      this.state.interference01=clamp01(this.state.interference01*.94+signed*.06);
      const magnitude=clamp01(Math.abs(delta)*1.5);
      this.state.crossTaskTransfer01=clamp01(this.state.crossTaskTransfer01*.92+(delta>0?magnitude:delta<0?0:magnitude*.35)*.08);
    }
    return structuredClone(probe);
  }

  transferMatrix(taskIds?:string[]){
    const filter=taskIds&&taskIds.length?new Set(taskIds.map(x=>String(x).slice(0,96))):null;
    const rows=this.state.transferProbes.filter(p=>p.independentVerified&&p.holdout&&(!filter||filter.has(p.sourceTaskId)||filter.has(p.targetTaskId)));
    const matrix=new Map<string,{n:number;meanDelta01:number;positive:number;negative:number}>();
    for(const p of rows){const key=`${p.sourceTaskId}->${p.targetTaskId}`;const cur=matrix.get(key)??{n:0,meanDelta01:0,positive:0,negative:0};cur.n++;cur.meanDelta01+=(p.delta01-cur.meanDelta01)/cur.n;if(p.delta01>.04)cur.positive++;if(p.delta01<-.04)cur.negative++;matrix.set(key,cur);}
    return [...matrix.entries()].map(([pair,v])=>({pair,...v})).sort((a,b)=>b.n-a.n);
  }

  transferInferenceGate(input:{sourceTaskId:string;targetTaskId:string;minHoldout?:number;minDistinctContexts?:number}){
    const rows=this.state.transferProbes.filter(p=>p.sourceTaskId===input.sourceTaskId&&p.targetTaskId===input.targetTaskId&&p.independentVerified&&p.holdout);
    const contexts=new Set(rows.map(p=>p.contextKey));
    const minHoldout=Math.max(2,Math.min(32,Math.floor(input.minHoldout??4)));
    const minContexts=Math.max(2,Math.min(32,Math.floor(input.minDistinctContexts??2)));
    const mean=rows.length?rows.reduce((s,p)=>s+p.delta01,0)/rows.length:0;
    const positive=rows.filter(p=>p.delta01>.04).length,negative=rows.filter(p=>p.delta01<-.04).length;
    return {sourceTaskId:input.sourceTaskId,targetTaskId:input.targetTaskId,holdoutSamples:rows.length,distinctContexts:contexts.size,meanDelta01:mean,positive,negative,eligibleForConfirmatoryInference:rows.length>=minHoldout&&contexts.size>=minContexts,reason:rows.length<minHoldout?'insufficient-holdout':contexts.size<minContexts?'insufficient-context-diversity':'eligible'};
  }

  transferDiagnostics(){
    const validated=this.state.transferProbes.filter(p=>p.independentVerified&&p.holdout);
    return {validatedSamples:this.state.validatedTransferSamples,positiveSamples:this.state.positiveTransferSamples,negativeSamples:this.state.negativeTransferSamples,interference01:this.state.interference01,crossTaskTransfer01:this.state.crossTaskTransfer01,validatedProbeRate01:this.state.transferProbes.length?validated.length/this.state.transferProbes.length:0,recentValidated:validated.slice(-12)};
  }

  observeDevelopmentalSignal(input:{identityContinuity01:number;socialBinding01:number;identityPressure01:number;causalSignal01:number;evidenceQuality01:number;selfChange01:number}):number{
    const values=[clamp01(input.identityContinuity01),clamp01(input.socialBinding01),clamp01(1-input.identityPressure01),clamp01(input.causalSignal01),clamp01(input.evidenceQuality01),clamp01(input.selfChange01)];
    const signal=clamp01(values.reduce((a,b)=>a+b,0)/values.length);
    const transfer=clamp01(.34*signal+.24*clamp01(input.evidenceQuality01)+.22*clamp01(input.causalSignal01)+.20*(1-clamp01(input.identityPressure01)));
    const alpha=.025+.05*transfer;
    for(let i=0;i<Math.min(values.length,this.state.sharedRepresentation01.length);i++) this.state.sharedRepresentation01[i]=clamp01(this.state.sharedRepresentation01[i]*(1-alpha)+values[i]*alpha);
    this.state.developmentalTransfer01=clamp01(this.state.developmentalTransfer01*.96+transfer*.04);
    this.state.lastDevelopmentalSignal01=signal;
    this.state.lastAt=Date.now();
    return transfer;
  }

  consolidate(limit=8){
    return this.state.patterns.filter(p=>p.samples>=2 && (p.meanCausalStrength01>=.44 || p.transferPotential01>=.62)).slice(0,Math.max(1,Math.min(32,Math.floor(limit)))).map(p=>structuredClone(p));
  }

  diagnostics(){
    return {
      version:2,cycles:this.state.cycles,samples:this.state.samples,updates:this.state.updates,
      representationDrift01:this.state.representationDrift01,predictionAgreement01:this.state.predictionAgreement01,
      crossTaskTransfer01:this.state.crossTaskTransfer01,consolidationEfficiency01:this.state.consolidationEfficiency01,
      developmentalTransfer01:this.state.developmentalTransfer01,lastDevelopmentalSignal01:this.state.lastDevelopmentalSignal01,
      lastLearningOpportunity01:this.state.lastLearningOpportunity01,patternCount:this.state.patterns.length,
      provenanceCounts:this.state.provenanceCounts,externalHypothesisCount:this.state.externalHypotheses.length,validatedTransferSamples:this.state.validatedTransferSamples,
      positiveTransferSamples:this.state.positiveTransferSamples,negativeTransferSamples:this.state.negativeTransferSamples,
      interference01:this.state.interference01,transferProbes:this.state.transferProbes.length,learningLoop:this.state.loop,topPatterns:this.state.patterns.slice(0,8)
    };
  }
}
