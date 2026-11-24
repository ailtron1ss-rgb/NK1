import type { ToolDefinition } from '../system/ActionGateway.ts';
import type { OutcomeVerification, OutcomeVerificationContext } from '../system/OutcomeVerificationService.ts';
import { sha256Stable, stableJson } from '../core/StableSerialization.ts';
import { hasAuthenticatedOutcomeEvidence } from './VerifiedOutcomeArtifact.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry, type VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import type { DevelopmentEvidenceVerificationBinding } from './P36AutonomousSelfDevelopment.ts';

export interface P36VerifiedOutcomeLedgerEvaluatorConfig {
  /** The same in-memory ledger whose rows were ingested from trusted signed artifacts. */
  ledger: VerifiedOutcomeLedger;
  manifest: readonly TaskManifestEntry[];
  evaluatorVersion: string;
  /** Host-pinned comparison; callers cannot select a more flattering method pair. */
  baselineMethod: string;
  treatmentMethod: string;
  taskFamily: string;
  sourceId: string;
  independenceKey: string;
  /** Paired seed-level comparisons; defaults to four to avoid single-seed claims. */
  minimumPairedSeeds?: number;
}

export interface P36VerifiedOutcomeLedgerQuery extends Omit<DevelopmentEvidenceVerificationBinding,'control01'|'treatment01'> {
  baselineMethod: string;
  treatmentMethod: string;
  taskFamily: string;
  manifestFingerprint: string;
}

export interface P36VerifiedOutcomeLedgerRequest extends P36VerifiedOutcomeLedgerQuery {
  control01:number;
  treatment01:number;
}

export interface P36VerifiedOutcomeLedgerMeasurement {
  observationId: string;
  evidenceFingerprint: string;
  manifestFingerprint: string;
  taskFamily: string;
  baselineMethod: string;
  treatmentMethod: string;
  pairedSeedCount: number;
  control01: number;
  treatment01: number;
  evidenceRefs: string[];
  expectedPostcondition: string;
  observedPostcondition: string;
}

interface PreparedAuthority {
  ledger: VerifiedOutcomeLedger;
  manifest: TaskManifestEntry[];
  manifestById: Map<string,TaskManifestEntry>;
  manifestFingerprint: string;
  evaluatorVersion: string;
  baselineMethod: string;
  treatmentMethod: string;
  taskFamily: string;
  sourceId: string;
  independenceKey: string;
  minimumPairedSeeds: number;
}

const validIdentity=(value:unknown,max=180):value is string=>
  typeof value==='string'&&value.length>0&&value.length<=max&&value===value.normalize('NFKC').trim()&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);

function prepareAuthority(config:P36VerifiedOutcomeLedgerEvaluatorConfig):PreparedAuthority {
  if(!config||!(config.ledger instanceof VerifiedOutcomeLedger)||!Array.isArray(config.manifest)||
     !validIdentity(config.evaluatorVersion,64)||!validIdentity(config.baselineMethod,180)||
     !validIdentity(config.treatmentMethod,180)||config.baselineMethod===config.treatmentMethod||
     !validIdentity(config.taskFamily,96)||!validIdentity(config.sourceId,80)||!validIdentity(config.independenceKey,120)) {
    throw new Error('p36-verified-outcome-ledger-config-invalid');
  }
  const minimumPairedSeeds=config.minimumPairedSeeds??4;
  if(!Number.isSafeInteger(minimumPairedSeeds)||minimumPairedSeeds<4||minimumPairedSeeds>128) {
    throw new Error('p36-verified-outcome-ledger-minimum-paired-seeds-invalid');
  }
  let manifest:TaskManifestEntry[];
  try { manifest=structuredClone(config.manifest) as TaskManifestEntry[]; }
  catch { throw new Error('p36-verified-outcome-ledger-manifest-not-cloneable'); }
  const validator=new VerifiedOutcomeLedger(manifest);
  const manifestFingerprint=validator.manifestFingerprint();
  if(config.ledger.manifestFingerprint()!==manifestFingerprint) {
    throw new Error('p36-verified-outcome-ledger-manifest-mismatch');
  }
  return {
    ledger:config.ledger,
    manifest:validator.snapshot().manifest as TaskManifestEntry[],
    manifestById:new Map(validator.snapshot().manifest.map(task=>[task.taskId,task] as const)),
    manifestFingerprint,evaluatorVersion:config.evaluatorVersion,
    baselineMethod:config.baselineMethod,treatmentMethod:config.treatmentMethod,taskFamily:config.taskFamily,
    sourceId:config.sourceId,independenceKey:config.independenceKey,minimumPairedSeeds,
  };
}

function measure(authority:PreparedAuthority,input:unknown):P36VerifiedOutcomeLedgerMeasurement|null {
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const q=input as P36VerifiedOutcomeLedgerQuery;
  // This ledger contains point-in-time holdout results only. It cannot attest delayed
  // retention, transfer, a self-report, a non-holdout split, or arbitrary context labels.
  if(q.evidenceSource!=='external-evaluator'||q.holdout!==true||q.delayMs!==0||
     q.evaluatorVersion!==authority.evaluatorVersion||q.manifestFingerprint!==authority.manifestFingerprint||
     q.protocolId!==authority.manifestFingerprint||q.baselineMethod!==authority.baselineMethod||
     q.treatmentMethod!==authority.treatmentMethod||q.taskFamily!==authority.taskFamily||q.contextKey!==q.taskFamily||
     !validIdentity(q.taskFamily,96)||!validIdentity(q.baselineMethod,180)||
     !validIdentity(q.treatmentMethod,180)||q.baselineMethod===q.treatmentMethod) return null;

  const tasks=authority.manifest.filter(task=>task.split==='holdout'&&task.family===q.taskFamily)
    .sort((a,b)=>a.taskId.localeCompare(b.taskId));
  if(tasks.length===0)return null;
  const taskIds=tasks.map(task=>task.taskId);
  const snapshot=authority.ledger.snapshot();
  if(authority.ledger.manifestFingerprint()!==authority.manifestFingerprint)return null;

  const bySeed=new Map<number,Map<string,Map<string,VerifiedTaskOutcome>>>();
  for(const outcome of snapshot.outcomes) {
    if(outcome.attempt!==1||outcome.authority!=='independent-verifier'||
       (outcome.method!==q.baselineMethod&&outcome.method!==q.treatmentMethod)||
       !hasAuthenticatedOutcomeEvidence(authority.ledger,outcome.evidenceRef)) continue;
    const task=authority.manifestById.get(outcome.taskId);
    if(!task||task.split!=='holdout'||task.family!==q.taskFamily||task.version!==outcome.taskVersion||
       task.verifierId!==outcome.verifierId) continue;
    let tasksForSeed=bySeed.get(outcome.seed);
    if(!tasksForSeed){tasksForSeed=new Map();bySeed.set(outcome.seed,tasksForSeed);}
    let methodsForTask=tasksForSeed.get(task.taskId);
    if(!methodsForTask){methodsForTask=new Map();tasksForSeed.set(task.taskId,methodsForTask);}
    methodsForTask.set(outcome.method,outcome);
  }

  const seedScores:Array<{seed:number;control01:number;treatment01:number;evidenceRefs:string[]}>= [];
  for(const [seed,tasksForSeed] of [...bySeed.entries()].sort((a,b)=>a[0]-b[0])) {
    if(!taskIds.every(taskId=>tasksForSeed.get(taskId)?.has(q.baselineMethod)&&tasksForSeed.get(taskId)?.has(q.treatmentMethod)))continue;
    const baselineRows=taskIds.map(taskId=>tasksForSeed.get(taskId)!.get(q.baselineMethod)!);
    const treatmentRows=taskIds.map(taskId=>tasksForSeed.get(taskId)!.get(q.treatmentMethod)!);
    seedScores.push({
      seed,
      control01:baselineRows.filter(row=>row.passed).length/taskIds.length,
      treatment01:treatmentRows.filter(row=>row.passed).length/taskIds.length,
      evidenceRefs:[...baselineRows,...treatmentRows].map(row=>row.evidenceRef).sort(),
    });
  }
  if(seedScores.length<authority.minimumPairedSeeds)return null;
  const control01=seedScores.reduce((sum,row)=>sum+row.control01,0)/seedScores.length;
  const treatment01=seedScores.reduce((sum,row)=>sum+row.treatment01,0)/seedScores.length;
  const evidenceRefs=[...new Set(seedScores.flatMap(row=>row.evidenceRefs))].sort();
  const evidenceFingerprint=sha256Stable({
    manifestFingerprint:authority.manifestFingerprint,taskFamily:q.taskFamily,
    baselineMethod:q.baselineMethod,treatmentMethod:q.treatmentMethod,seedScores,evidenceRefs,
  });
  const observationId=`p36-ledger-${evidenceFingerprint.slice(0,48)}`;
  const postcondition=`verified-holdout-ledger:${evidenceFingerprint}:baseline=${control01.toFixed(12)};candidate=${treatment01.toFixed(12)}`;
  return {
    observationId,evidenceFingerprint,manifestFingerprint:authority.manifestFingerprint,
    taskFamily:q.taskFamily,baselineMethod:q.baselineMethod,treatmentMethod:q.treatmentMethod,
    pairedSeedCount:seedScores.length,control01,treatment01,evidenceRefs,
    expectedPostcondition:postcondition,observedPostcondition:postcondition,
  };
}

/**
 * Compute task-balanced pass rates from signed, authenticated holdout artifacts.
 * This score-free query can be used to prepare the score claims for the ActionGateway request;
 * the registered executor recomputes them, so stale/fabricated claims fail closed.
 * This provider deliberately refuses delayMs > 0: the ledger proves holdout quality,
 * not longitudinal retention. A separate delayed evaluator must prove that gate.
 */
export function measureP36VerifiedOutcomeLedger(
  input:P36VerifiedOutcomeLedgerQuery,
  config:P36VerifiedOutcomeLedgerEvaluatorConfig,
):P36VerifiedOutcomeLedgerMeasurement|null {
  return measure(prepareAuthority(config),input);
}

function rejectedVerification(notes:string):OutcomeVerification {
  return {verified:false,basis:'none',confidence01:0,externalObservation:false,notes};
}

/**
 * Host-configurable ToolDefinition for `OrganismConfig.p36IndependentEvaluator`.
 * Every score claim is re-derived from authenticated artifacts inside both execute
 * and verify; a caller cannot make a raw score authoritative by echoing it back.
 */
export function createP36VerifiedOutcomeLedgerEvaluator(
  config:P36VerifiedOutcomeLedgerEvaluatorConfig,
):Omit<ToolDefinition,'id'> {
  const authority=prepareAuthority(config);
  return {
    capability:'learning.evaluation.verified-outcome-ledger',
    destructive:false,
    projectAllowed:true,
    observationSource:{
      sourceId:authority.sourceId,sourceClass:'external-api',channel:'tool',
      independenceKey:authority.independenceKey,
    },
    execute:async(input)=>{
      try {
        const result=measure(authority,input);
        if(!result)return {ok:false,effectStatus:'not-applied',error:'p36-verified-ledger-evidence-unavailable'};
        // measure() has already validated the query contract; keep caller fields unknown until score checks.
        const q=input as Record<string,unknown>;
        if(typeof q.control01!=='number'||!Number.isFinite(q.control01)||q.control01<0||q.control01>1||
           typeof q.treatment01!=='number'||!Number.isFinite(q.treatment01)||q.treatment01<0||q.treatment01>1) {
          return {ok:false,effectStatus:'not-applied',error:'p36-verified-ledger-score-claim-invalid'};
        }
        if(Math.abs(q.control01-result.control01)>1e-12||Math.abs(q.treatment01-result.treatment01)>1e-12) {
          return {ok:false,effectStatus:'not-applied',error:'p36-verified-ledger-score-claim-mismatch'};
        }
        return {ok:true,evidenceKind:'verified-outcome-ledger-holdout',...result};
      } catch {
        return {ok:false,effectStatus:'not-applied',error:'p36-verified-ledger-evaluation-failed'};
      }
    },
    verify:async(context:OutcomeVerificationContext)=>{
      try {
        const measurement=measure(authority,context.input);
        const result=context.result as Record<string,unknown>;
        const q=context.input as unknown as P36VerifiedOutcomeLedgerRequest;
        if(!measurement||typeof q.control01!=='number'||!Number.isFinite(q.control01)||q.control01<0||q.control01>1||
           typeof q.treatment01!=='number'||!Number.isFinite(q.treatment01)||q.treatment01<0||q.treatment01>1||
           result.ok!==true||result.evidenceKind!=='verified-outcome-ledger-holdout'||
           Math.abs(q.control01-measurement.control01)>1e-12||Math.abs(q.treatment01-measurement.treatment01)>1e-12||
           result.observationId!==measurement.observationId||result.evidenceFingerprint!==measurement.evidenceFingerprint||
           result.manifestFingerprint!==measurement.manifestFingerprint||result.taskFamily!==measurement.taskFamily||
           result.baselineMethod!==measurement.baselineMethod||result.treatmentMethod!==measurement.treatmentMethod||
           result.pairedSeedCount!==measurement.pairedSeedCount||result.control01!==measurement.control01||
           result.treatment01!==measurement.treatment01||
           stableJson(result.evidenceRefs)!==stableJson(measurement.evidenceRefs)||
           result.expectedPostcondition!==measurement.expectedPostcondition||
           result.observedPostcondition!==measurement.observedPostcondition) {
          return rejectedVerification('independent signed holdout outcomes did not match the exact P36 request');
        }
        return {
          verified:true,basis:'external-postcondition',externalObservation:true,confidence01:.98,
          observationId:measurement.observationId,
          expectedPostcondition:measurement.expectedPostcondition,
          observedPostcondition:measurement.observedPostcondition,
          notes:'scores re-derived from signed, authenticated paired holdout outcomes; delayed retention is not asserted',
        };
      } catch {
        return rejectedVerification('verified outcome ledger could not independently re-derive the P36 result');
      }
    },
  };
}
