import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { PredictionLedger } from '../system/PredictionLedger.ts';
import { ExternalEvidenceTrustEngine } from '../system/ExternalEvidenceTrust.ts';
import { ExternalProjectResearchTool } from '../system/ExternalProjectResearchTool.ts';
import { EvidenceFirewallEngine } from '../system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../system/ProjectResearchSession.ts';
import { createConfiguredResearchNliBackend } from '../system/ResearchSemanticEntailment.ts';
import { SkillAcquisitionBenchmark } from '../system/SkillAcquisitionBenchmark.ts';
import { SelfPredictionBenchmark } from '../system/SelfPredictionBenchmark.ts';
import { ModelOlympics } from '../system/ModelOlympics.ts';
import { PredictionDebtEngine } from '../system/PredictionDebt.ts';
import { ShadowOrganismEngine } from '../system/ShadowOrganism.ts';
import { IdentityCausalityGraphEngine } from '../system/IdentityCausalityGraph.ts';
import { LongHorizonPredictionBenchmark } from '../system/LongHorizonPredictionBenchmark.ts';
import { P38AutonomousCausalResearchEngine } from '../learning/P38AutonomousCausalResearch.ts';
import { P53DevelopmentalSelfModificationLab } from '../developmental/P53DevelopmentalSelfModificationLab.ts';
import { ExternalObserverFabric, type ExternalObservation, type ExternalObserverSourceRegistrationAuthorizer } from '../system/ExternalObserverFabric.ts';
import { RealityEvidenceLedger, type EvidenceRealityClass } from '../system/RealityEvidenceLedger.ts';
import { P77RealityExperimentOS, defaultP77 } from '../system/P77RealityExperimentOS.ts';
import { P82RealityProgressController, defaultP82 } from '../system/P82RealityProgressController.ts';

/**
 * BIG PASS 49: physical ownership boundary for evidence, prediction and research.
 * All stateful engines here are coupled through evidence/prediction semantics rather than Core internals.
 */
export class EvidenceResearchSubsystemRuntime {
  readonly systemName='research' as const;
  readonly dependencies=['world', 'memory', 'governance'] as const;
  readonly systemCapabilities=['state', 'research', 'prediction', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly predictionLedger = new PredictionLedger(256);
  readonly externalEvidenceTrust = new ExternalEvidenceTrustEngine();
  readonly externalProjectResearchTool = new ExternalProjectResearchTool();
  readonly evidenceFirewall = new EvidenceFirewallEngine();
  readonly projectResearchSession = new ProjectResearchSession(this.evidenceFirewall);
  /** Explicitly opt-in NLI backend; absent configuration keeps the runtime offline and conservative. */
  readonly researchNliBackend = createConfiguredResearchNliBackend();
  readonly skillAcquisitionBenchmark = new SkillAcquisitionBenchmark();
  readonly selfPredictionBenchmark = new SelfPredictionBenchmark();
  readonly modelOlympics = new ModelOlympics();
  readonly predictionDebt = new PredictionDebtEngine();
  readonly shadowOrganism = new ShadowOrganismEngine();
  readonly identityCausality = new IdentityCausalityGraphEngine();
  readonly longHorizonPrediction = new LongHorizonPredictionBenchmark();
  readonly p38Research = new P38AutonomousCausalResearchEngine();
  readonly p53DevelopmentalSelfModification = new P53DevelopmentalSelfModificationLab();
  /** Canonical event-idempotent sink for observer outputs; IDs correlate events but do not grant trust. */
  readonly realityEvidenceLedger: RealityEvidenceLedger;
  private recordExternalObservationEvidence(observation:ExternalObservation):void {
    // Sample confidence is not source trust. The observer's assessment path
    // multiplies these signals; the canonical promotion ledger must do the same.
    const currentSourceReliability01=this.externalObserver.registeredSourceReliability01(observation.sourceId);
    if(currentSourceReliability01===null)return;
    const capturedTrust=Number(observation.sourceReliabilityAtCapture01);
    // Replays can conservatively lower confidence after source debiasing, but
    // improvement in the source's current reputation never upgrades old evidence.
    const sourceReliability01=Number.isFinite(capturedTrust)
      ?Math.min(currentSourceReliability01,Math.max(0,Math.min(1,capturedTrust)))
      :currentSourceReliability01;
    const eventId=observation.evidenceEventId??observation.id;
    const calibratedConfidence01=Math.max(0,Math.min(1,observation.confidence01*sourceReliability01));
    const priorEvidence=this.realityEvidenceLedger.findByEventId(eventId);
    const evidenceConfidence01=priorEvidence
      ?Math.min(calibratedConfidence01,priorEvidence.confidence01)
      :calibratedConfidence01;
    const realityClass:EvidenceRealityClass = observation.sourceClass==='user' ? 'user-reported'
      : observation.sourceClass==='simulator' ? 'simulator'
      : observation.sourceClass==='organism' ? 'model-generated'
      : observation.sourceClass==='unknown' ? 'derived'
      : observation.sourceClass==='device' ? 'device-observation'
      : 'external-observation';
    const claim=String(observation.observedPostcondition??observation.claimKey).normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
    const independenceKey=String(observation.independenceKey||observation.sourceId).normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,160);
    if(!claim||!independenceKey)return;
    const parentIds=[observation.actionRef,observation.predictionId,observation.tool]
      .filter((value):value is string=>typeof value==='string'&&value.trim().length>0)
      .map(value=>value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,256)).filter(value=>value.length>0).slice(0,8);
    this.realityEvidenceLedger.record({
      eventId,
      tick:Number.isSafeInteger(observation.tick)&&Number(observation.tick)>=0?Number(observation.tick):0,
      at:Number.isFinite(observation.observedAt)&&observation.observedAt>=0?observation.observedAt:Date.now(),
      realityClass,claim,confidence01:evidenceConfidence01,independenceKey,parentIds,
    });
  }
  readonly externalObserver:ExternalObserverFabric;

  constructor(config:{authorizeSourceRegistration?:ExternalObserverSourceRegistrationAuthorizer;realityEvidenceLedger?:RealityEvidenceLedger}={}) {
    this.realityEvidenceLedger=config.realityEvidenceLedger??new RealityEvidenceLedger();
    this.externalObserver=new ExternalObserverFabric({
      requireRegisteredSources:Boolean(config.authorizeSourceRegistration),
      authorizeSourceRegistration:config.authorizeSourceRegistration,
      onObservation:observation=>this.recordExternalObservationEvidence(observation),
    });
  }

  snapshot() {
    return {
      predictionLedger: this.predictionLedger.snapshot(),
      externalEvidenceTrust: this.externalEvidenceTrust.snapshot(),
      externalProjectResearchTool: this.externalProjectResearchTool.snapshot(),
      evidenceFirewall: this.evidenceFirewall.snapshot(),
      projectResearchSession: this.projectResearchSession.snapshot(),
      researchNli: { enabled: Boolean(this.researchNliBackend), modelId: this.researchNliBackend?.modelId ?? null },
      skillAcquisitionBenchmark: this.skillAcquisitionBenchmark.snapshot(),
      selfPredictionBenchmark: this.selfPredictionBenchmark.snapshot(),
      modelOlympics: this.modelOlympics.snapshot(),
      predictionDebt: this.predictionDebt.snapshot(),
      shadowOrganism: this.shadowOrganism.snapshot(),
      identityCausality: this.identityCausality.snapshot(),
      longHorizonPrediction: this.longHorizonPrediction.snapshot(),
      p38Research: this.p38Research.snapshot(),
      p53DevelopmentalSelfModification: this.p53DevelopmentalSelfModification.snapshot(),
      externalObserver: this.externalObserver.snapshot(),
      realityEvidenceLedger: this.realityEvidenceLedger.snapshot(),
    };
  }


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p77RealityExperimentOS = new P77RealityExperimentOS();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p82RealityProgress = new P82RealityProgressController();
  restoreFromPersisted(system: any, learning: any = {}, advanced: any = {}) {
    this.restore({
      predictionLedger:system?.predictionLedger, externalEvidenceTrust:system?.externalEvidenceTrust,
      evidenceFirewall:system?.evidenceFirewall, projectResearchSession:system?.projectResearchSession,
      skillAcquisitionBenchmark:system?.skillAcquisitionBenchmark, selfPredictionBenchmark:system?.selfPredictionBenchmark,
      modelOlympics:system?.modelOlympics, predictionDebt:system?.predictionDebt, shadowOrganism:system?.shadowOrganism,
      identityCausality:system?.identityCausality, longHorizonPrediction:system?.longHorizonPrediction,
      p38Research:learning?.p38, p53DevelopmentalSelfModification:advanced?.p53DevelopmentalSelfModification, externalObserver:system?.externalObserver, realityEvidenceLedger:system?.realityEvidenceLedger,
    });
  }

  restore(raw: Partial<ReturnType<EvidenceResearchSubsystemRuntime['snapshot']>> | null | undefined) {
    if (!raw) return;
    this.predictionLedger.restore(raw.predictionLedger);
    this.externalEvidenceTrust.restore(raw.externalEvidenceTrust);
    this.evidenceFirewall.restore(raw.evidenceFirewall);
    this.projectResearchSession.restore(raw.projectResearchSession);
    this.skillAcquisitionBenchmark.restore(raw.skillAcquisitionBenchmark);
    this.selfPredictionBenchmark.restore(raw.selfPredictionBenchmark);
    this.modelOlympics.restore(raw.modelOlympics);
    this.predictionDebt.restore(raw.predictionDebt);
    this.shadowOrganism.restore(raw.shadowOrganism);
    this.identityCausality.restore(raw.identityCausality);
    this.longHorizonPrediction.restore(raw.longHorizonPrediction);
    this.p38Research.restore((raw as any).p38Research);
    this.p53DevelopmentalSelfModification.restore((raw as any).p53DevelopmentalSelfModification);
    // Keep the persisted ledger from granting authority to observer events
    // whose source identity is no longer accepted by the strict restore policy.
    // Collect both stable row IDs and verifier-minted event IDs before validation.
    const rawObserverState=(raw as any).externalObserver;
    const rawObserverRows:Array<unknown>=Array.isArray(rawObserverState?.observations)?rawObserverState.observations:[];
    this.externalObserver.restore(rawObserverState);
    // Source identity is checked independently of the bounded observation cache.
    // A valid but older row may have been evicted from observer memory while its
    // canonical ledger event remains legitimate historical evidence.
    const observerState=this.externalObserver.snapshot();
    const registeredSources=new Map(observerState.sources.map(source=>[source.id,source]));
    const orphanedObserverEventIds=new Set<string>();
    for(const value of rawObserverRows){
      if(!value||typeof value!=='object'||Array.isArray(value))continue;
      const row=value as any;
      const rowEventIds=[
        ...(typeof row.id==='string'&&row.id.trim()?[row.id]:[]),
        ...(typeof row.evidenceEventId==='string'&&row.evidenceEventId.trim()?[row.evidenceEventId]:[]),
      ];
      if(rowEventIds.length===0)continue;
      const source=typeof row.sourceId==='string'?registeredSources.get(row.sourceId):undefined;
      const rowIndependenceKey=typeof row.independenceKey==='string'&&row.independenceKey.trim()
        ?row.independenceKey.trim().slice(0,120)
        :undefined;
      const validObserverRow=typeof row.id==='string'&&typeof row.sourceId==='string'&&typeof row.claimKey==='string'&&
        Number.isFinite(Number(row.observedAt))&&Number.isFinite(Number(row.confidence01))&&
        Boolean(source&&source.enabled&&source.sourceClass===row.sourceClass&&source.channel===row.channel)&&
        (rowIndependenceKey===undefined||rowIndependenceKey===source?.independenceKey);
      if(!validObserverRow)for(const eventId of rowEventIds)orphanedObserverEventIds.add(eventId);
    }
    let ledgerToRestore=(raw as any).realityEvidenceLedger;
    if(orphanedObserverEventIds.size>0&&ledgerToRestore&&typeof ledgerToRestore==='object'&&
       !Array.isArray(ledgerToRestore)&&Array.isArray(ledgerToRestore.recent)){
      ledgerToRestore={
        ...ledgerToRestore,
        recent:ledgerToRestore.recent.filter((value:unknown)=>{
          if(!value||typeof value!=='object'||Array.isArray(value))return true;
          const row=value as any;
          const eventId=typeof row.eventId==='string'?row.eventId:typeof row.id==='string'?row.id:undefined;
          return eventId===undefined||!orphanedObserverEventIds.has(eventId);
        }),
      };
    }
    this.realityEvidenceLedger.restore(ledgerToRestore);
    // Older valid rows without independenceKey inherit the registered source key
    // rather than falling back to a potentially weaker row ID.
    for(const observation of observerState.observations){
      const source=registeredSources.get(observation.sourceId);
      if(!source || source.sourceClass!==observation.sourceClass || source.channel!==observation.channel) continue;
      const rowIndependenceKey=typeof observation.independenceKey==='string'&&observation.independenceKey.trim()
        ? observation.independenceKey
        : undefined;
      if(rowIndependenceKey!==undefined && rowIndependenceKey!==source.independenceKey) continue;
      this.recordExternalObservationEvidence(rowIndependenceKey===undefined
        ? {...observation,independenceKey:source.independenceKey}
        : observation);
    }
  }
}
