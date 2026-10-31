import { createHash } from 'node:crypto';
import { assertCognitiveCycleBoundaryInput } from './CognitiveCycleBoundary.ts';
import { normalizeWorldContext } from './WorldContextNormalizer.ts';
import { FileStateStore } from '../persistence/FileStateStore.ts';
import { OrganismCore, type OrganismConfig, type PersistedOrganism } from './OrganismCore.ts';
import { WorldEnvironment, type EnvironmentAction, type PersistedWorld } from '../world/WorldEnvironment.ts';
import { PlanEngine } from '../world/PlanEngine.ts';
import { OfflineConsolidation, type ConsolidationResult } from '../cognition/OfflineConsolidation.ts';
import type { OrganismCycleResult, CognitiveProposal, WorldContext, WorldTransitionForOrganism } from './types.ts';
import { buildAutonomousDialoguePrompt, buildCognitivePrompt, type LanguageInvoker, type LanguageResponse } from '../language/LanguageOrgan.ts';
import type { ContextBudgetLedgerReport } from '../language/ContextBudgetLedger.ts';
import { CounterfactualEngine } from '../world/CounterfactualEngine.ts';
import { EmbodimentRuntime } from '../body/EmbodimentRuntime.ts';
import { OrganismMotorRuntime } from '../body/OrganismMotorRuntime.ts';
import { Mem0PlatformAdapter, type Mem0Candidate } from '../integration/mem0/Mem0PlatformAdapter.ts';
import { buildCognitiveProposalPrompt, parseCognitiveProposal } from '../language/LanguageOrgan.ts';
import { OperationalJournal } from '../persistence/OperationalJournal.ts';
import type { JsonStateStore } from '../persistence/FileStateStore.ts';
import { choosePhonePolicyDelay, type PhonePolicyConfig } from '../system/PhoneRuntimePolicy.ts';
import { RuntimeClockScheduler, type RuntimeClockDecision } from '../system/RuntimeClockScheduler.ts';
import { ContinuityLedger } from '../system/ContinuityLedger.ts';
import { RuntimeEvidenceBus } from '../system/RuntimeEvidenceBus.ts';
import { CognitiveEventFabric } from '../system/CognitiveEventFabric.ts';
import { CognitiveResourceEconomy } from '../system/CognitiveResourceEconomy.ts';
import { UnifiedCognitiveCycle } from '../system/UnifiedCognitiveCycle.ts';
import { ContinuousCognitiveFabric } from '../system/ContinuousCognitiveFabric.ts';
import { RuntimeClosureLedger } from '../system/RuntimeClosureLedger.ts';
import { CausalDomainClosureLedger, type CausalDomainEvidence } from '../system/CausalDomainClosureLedger.ts';
import { AdaptiveConsolidationGate } from '../system/AdaptiveConsolidationGate.ts';
import { cameraEvidenceFromResult, inspectCameraFile, type CameraEvidence } from '../body/CameraEvidenceProcessor.ts';
import { EmbodiedActionExecutor, type EmbodiedActionResult } from '../body/EmbodiedActionExecutor.ts';
import { EmbodiedRecoveryController } from '../body/EmbodiedRecoveryController.ts';
import type { VisionSemanticBackend } from '../body/VisionSemanticBackend.ts';
import { TemporalObjectTracker } from '../body/TemporalObjectTracker.ts';
import { RealityGroundingController, type RealityGroundingMode } from '../system/RealityGroundingController.ts';
import { NeuralCausalTraceLedger } from '../system/NeuralCausalTraceLedger.ts';
import { RealityLearningGate } from '../system/RealityLearningGate.ts';
import { RealityShadowBridge } from '../system/RealityShadowBridge.ts';
import { ExternalPostconditionVerifier } from '../system/ExternalPostconditionVerifier.ts';
import { RuntimePerformanceGovernor } from '../system/RuntimePerformanceGovernor.ts';
import type { ActionGatewayExecutionOptions, ToolExecution } from '../system/ActionGateway.ts';
import { P23TrustedShadowLearningScheduler, type TrustedShadowLearningScheduleConfig } from '../learning/P23TrustedShadowLearningScheduler.ts';
import { ProceduralSkillLibrary, type SkillLibraryState } from '../learning/ProceduralSkillLibrary.ts';
import type { P23LearningEngine } from '../learning/P23LearningEngine.ts';
import { configureLearningJournals, createDefaultLearningJournals } from '../learning/LearningJournalBootstrap.ts';
import { P23CompoundRepairRevisionCoordinator, type CompoundRepairRetryBackoffSnapshot, type CompoundRepairRevisionInputProvider } from '../learning/P23CompoundRepairRevisionCoordinator.ts';
import { withIndependentCandidateEvaluation } from '../learning/P23IndependentEvaluationProvider.ts';
import type { IndependentCandidateEvaluationConfig } from '../learning/IndependentSkillCandidateEvaluator.ts';
import { createHostOwnedIndependentEvaluationConfigFactory, type HostOwnedIndependentEvaluationFactoryOptions } from '../learning/HostOwnedIndependentEvaluationServices.ts';

function currentBudgetAllowsLanguage(mode: string | undefined): boolean { return mode !== 'sleep' && mode !== 'defer'; }
const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
// External repair hints are advisory only and must be fresh; stale/future timestamps cannot bias autonomous revision order.
const EXTERNAL_REPAIR_HINT_TTL_MS=7*24*60*60*1000;
const EXTERNAL_REPAIR_HINT_MAX_FUTURE_SKEW_MS=5*60*1000;
function stableSpeechEventId(channel:string,tick:number,text:string):string { return `speech-${channel}-${Math.max(0,Math.floor(Number(tick)||0))}-${createHash('sha256').update(String(text??'')).digest('hex').slice(0,24)}`; }

function environmentToWorldContext(snapshot: ReturnType<WorldEnvironment['snapshot']>): WorldContext {
  return {
    tick: Number(snapshot.tick),
    location: String(snapshot.location),
    energy: clamp01(snapshot.energy),
    attention: clamp01(snapshot.attention),
    uncertainty: clamp01(snapshot.uncertainty),
    facts: snapshot.facts.slice(-120),
    objects: snapshot.objects.slice(-64).map(object => ({ ...object })),
    events: snapshot.events.slice(-40),
  };
}

function environmentTransitionToOrganismTransition(transition: ReturnType<WorldEnvironment['simulate']>): WorldTransitionForOrganism {
  return {
    action: transition.action,
    before: environmentToWorldContext(transition.before),
    after: environmentToWorldContext(transition.after),
    reward: transition.reward,
    surprise: transition.surprise,
    at: transition.at,
  };
}

function bodyActionCost(body: ReturnType<EmbodimentRuntime['snapshot']>, action: EnvironmentAction): number {
  const base = { observe:0.04, inspect:0.12, move:0.16, collect:0.14, rest:0.01, communicate:0.06 }[action];
  return Math.max(0, Math.min(1, base + (1-body.cognitiveCapacity01)*0.25 + body.thermalStrain01*0.15));
}

export interface RuntimeConfig extends OrganismConfig {
  stateFile: string;
  worldStateFile?: string;
  intervalMs?: number;
  enableLanguage?: boolean;
  autoRun?: boolean;
  sensorIntervalMs?: number;
  phonePolicy?: Partial<PhonePolicyConfig>;
  languageInvoker?: LanguageInvoker;
  stateStore?: JsonStateStore<PersistedOrganism>;
  worldStateStore?: JsonStateStore<PersistedWorld>;
  journal?: { write(level: 'info'|'warn'|'error', event: string, data?: Record<string, unknown>): Promise<void> };
  visionBackend?: VisionSemanticBackend;
  /** Explicit opt-in to scheduled, Core-owned P23 candidate/shadow learner runs. */
  trustedShadowLearning?: TrustedShadowLearningScheduleConfig;
  /** Explicitly configure the production bridge from verified compound repairs into P23 revision staging. */
  compoundRepairRevision?: {
    engine: P23LearningEngine;
    provideInputs: CompoundRepairRevisionInputProvider;
    /** When supplied, replaces provider-supplied candidate evaluation with exact-payload independent execution. */
    independentEvaluationConfigForRepair?: (input: Parameters<CompoundRepairRevisionInputProvider>[0]) => IndependentCandidateEvaluationConfig;
    /** Optional background repair-to-P23 loop. Opt-in and independently evaluated; never auto-activates candidates. */
    backgroundRevision?: { enabled: boolean; initialDelayMs?: number; intervalMs?: number };
  };
  /** Optional shared Mem0 adapter; disabled-by-default adapter is created if omitted. */
  mem0Adapter?: Mem0PlatformAdapter;
  /** Separate explicit opt-in before remote recall is allowed into live language context. */
  mem0CognitiveRecall?: boolean;
  /** P2836: how real device outcomes compete with the predictive simulator. */
  realityMode?: RealityGroundingMode;
  /** Optional host-supplied calibrated renderer profiles; never inferred from uploaded model names. */
  motorRigProfiles?: readonly import('../system/MotorRigProfile.ts').MotorRigProfileV1[];
}

export interface RuntimeStep { cycle: OrganismCycleResult; worldAction: EnvironmentAction; language?: LanguageResponse; embodiedAction?: EmbodiedActionResult; }

export class OrganismRuntime {
  /**
   * Host-owned production composition: prepare the three separately configured
   * executables before constructing the runtime, then bind their config factory
   * to the existing P23 compound-repair coordinator. No default executable paths
   * or in-process fake authorities are created here.
   */
  static async createWithHostOwnedIndependentEvaluation(
    config: RuntimeConfig,
    hostAuthorities: HostOwnedIndependentEvaluationFactoryOptions<Parameters<CompoundRepairRevisionInputProvider>[0]>,
  ): Promise<OrganismRuntime> {
    if (!config.compoundRepairRevision) {
      throw new Error('host-owned-independent-evaluation-requires-compound-repair-revision');
    }
    const independentEvaluationConfigForRepair =
      await createHostOwnedIndependentEvaluationConfigFactory(hostAuthorities);
    return new OrganismRuntime({
      ...config,
      compoundRepairRevision: {
        ...config.compoundRepairRevision,
        independentEvaluationConfigForRepair,
      },
    });
  }
  readonly core: OrganismCore;
  readonly environment = new WorldEnvironment();
  readonly plans: PlanEngine;
  readonly consolidation = new OfflineConsolidation();
  readonly counterfactuals = new CounterfactualEngine(this.environment);
  readonly embodiment = new EmbodimentRuntime();
  /** Single owner of canonical renderer-neutral MotorFrame execution. */
  readonly motor = new OrganismMotorRuntime();
  readonly embodiedActions = new EmbodiedActionExecutor(this.embodiment);
  readonly embodiedRecovery = new EmbodiedRecoveryController();
  private readonly config: Required<Pick<RuntimeConfig, 'intervalMs'|'enableLanguage'>> & RuntimeConfig;
  private readonly temporalObjectTracker = new TemporalObjectTracker();
  private readonly mem0Adapter: Mem0PlatformAdapter;
  private readonly mem0CognitiveRecallEnabled: boolean;
  private stepsSinceConsolidation = 0;
  private readonly worldStore: JsonStateStore<PersistedWorld>;
  private readonly journal: { write(level: 'info'|'warn'|'error', event: string, data?: Record<string, unknown>): Promise<void> };
  private readonly sensorIntervalMs: number;
  private readonly phonePolicy: PhonePolicyConfig;
  private worldDirtyCycles = 0;
  private lastWorldCheckpointAt = 0;
  private lastThermalStrain01 = 0.2;
  private consecutiveActiveCycles = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private initialized = false;
  private lastContextBudgetLedger: ContextBudgetLedgerReport | null = null;
  contextBudgetDiagnostics() {
    return this.lastContextBudgetLedger ? structuredClone(this.lastContextBudgetLedger) : {
      version: 1, owner: 'LanguageOrgan', policy: 'priority-bounded-loss-accounting', maxDynamicChars: 0,
      totalInputChars: 0, renderedChars: 0, omittedChars: 0, estimatedInputTokens: 0, estimatedRenderedTokens: 0,
      includedSections: 0, truncatedSections: 0, omittedSections: 0, receipts: [], note: 'no-language-prompt-built-yet'
    };
  }
  private readonly clockScheduler = new RuntimeClockScheduler();
  private readonly continuityLedger: ContinuityLedger;
  private readonly evidenceBus = new RuntimeEvidenceBus(384);
  private readonly cognitiveEventFabric = new CognitiveEventFabric(512);
  private readonly resourceEconomy = new CognitiveResourceEconomy();
  private readonly unifiedCycle = new UnifiedCognitiveCycle();
  private readonly continuousCognitiveFabric = new ContinuousCognitiveFabric();
  private readonly realityGrounding = new RealityGroundingController();
  private readonly neuralCausalTrace = new NeuralCausalTraceLedger();
  private readonly realityLearningGate = new RealityLearningGate();
  private readonly realityShadowBridge = new RealityShadowBridge();
  private readonly postconditionVerifier = new ExternalPostconditionVerifier();
  private readonly runtimePerformance = new RuntimePerformanceGovernor(1200);
  private readonly runtimeClosure = new RuntimeClosureLedger();
  private readonly causalDomainClosureLedger = new CausalDomainClosureLedger(32);
  private readonly adaptiveConsolidationGate = new AdaptiveConsolidationGate();
  private readonly trustedShadowLearningScheduler: P23TrustedShadowLearningScheduler | null;
  private readonly compoundRepairRevisionCoordinator: P23CompoundRepairRevisionCoordinator | null;
  private compoundRepairRevisionCursor = 0;
  private readonly compoundRepairRevisionMetrics = {
    version: 1 as const,
    schedulerDecisions: 0,
    resourceGated: 0,
    noEvidence: 0,
    notReady: 0,
    attempts: 0,
    staged: 0,
    deduplicated: 0,
    backoffSkipped: 0,
    failures: 0,
    lastDecisionAt: 0,
    lastDecisionReason: 'not-configured',
    lastAttemptAt: 0,
    lastSkillId: null as string | null,
    lastStatus: 'not-configured',
    lastCandidateId: null as string | null,
    lastFailureCategory: null as string | null,
  };
  private readonly proceduralSkillLibrary = new ProceduralSkillLibrary();
  private readonly proceduralSkillStore: JsonStateStore<SkillLibraryState>;
  private stopping = false;
  private sleepStartedAt: number | null = null;
  private sleepReason = '';
  private lastAutonomyStepAt = 0;
  private lastEmergencyCheckpointTick = -1;
  private emergencyCheckpointCount = 0;
  private lastEmergencyCheckpointReason: string | null = null;
  private pendingEmergencyCheckpointReason: string | null = null;
  private pendingEmergencyCheckpointTick = -1;


  constructor(config: RuntimeConfig) {
    this.config = { intervalMs: 30_000, enableLanguage: false, autoRun: false, ...config };
    this.mem0Adapter = config.mem0Adapter ?? Mem0PlatformAdapter.fromEnvironment();
    this.mem0CognitiveRecallEnabled = config.mem0CognitiveRecall === true;
    const defaultSensorCadenceMs = config.performanceProfile === 'mobile' ? 60_000 : 60_000;
    const inheritedSensorCadenceMs = config.intervalMs == null ? defaultSensorCadenceMs : Math.max(30_000, Number(config.intervalMs) * 2);
    this.sensorIntervalMs = Math.max(10_000, Number(config.sensorIntervalMs ?? inheritedSensorCadenceMs));
    this.phonePolicy = {
      mode: 'active', baseIntervalMs: this.config.intervalMs, samplerIntervalMs: this.sensorIntervalMs,
      checkpointMinIntervalMs: Number(config.checkpointMinIntervalMs ?? 60_000), checkpointMaxDirtyCycles: Number(config.checkpointMaxDirtyCycles ?? 3),
      worldCheckpointMinIntervalMs: Number(config.phonePolicy?.worldCheckpointMinIntervalMs ?? 300_000),
      worldCheckpointMaxDirtyCycles: Number(config.phonePolicy?.worldCheckpointMaxDirtyCycles ?? 10), maxConsecutiveActiveCycles: Number(config.phonePolicy?.maxConsecutiveActiveCycles ?? 3),
      ...(config.phonePolicy ?? {}),
    };
    this.phonePolicy.baseIntervalMs = Math.max(5_000, Number(this.phonePolicy.baseIntervalMs));
    this.phonePolicy.samplerIntervalMs = Math.max(10_000, Number(this.phonePolicy.samplerIntervalMs));
    this.phonePolicy.checkpointMaxDirtyCycles = Math.max(1, Number(this.phonePolicy.checkpointMaxDirtyCycles));
    this.phonePolicy.worldCheckpointMaxDirtyCycles = Math.max(1, Number(this.phonePolicy.worldCheckpointMaxDirtyCycles));
    this.stopping = false;
    this.core = new OrganismCore(config.stateStore ?? new FileStateStore<PersistedOrganism>(config.stateFile), { ...config, cycleResultMode:'operational' });
    const learningJournals = createDefaultLearningJournals(config.stateFile);
    this.core.configureP23LearningJournals(learningJournals);
    this.trustedShadowLearningScheduler = config.trustedShadowLearning?.enabled === true
      ? new P23TrustedShadowLearningScheduler(this.core, config.trustedShadowLearning)
      : null;
    if (config.compoundRepairRevision) {
      const backgroundRevision = config.compoundRepairRevision.backgroundRevision;
      if (backgroundRevision && (typeof backgroundRevision.enabled !== 'boolean' ||
          (backgroundRevision.intervalMs !== undefined &&
            (!Number.isSafeInteger(backgroundRevision.intervalMs) || backgroundRevision.intervalMs < 60_000 || backgroundRevision.intervalMs > 86_400_000)) ||
          (backgroundRevision.initialDelayMs !== undefined &&
            (!Number.isSafeInteger(backgroundRevision.initialDelayMs) || backgroundRevision.initialDelayMs < 0 || backgroundRevision.initialDelayMs > 86_400_000)))) {
        throw new Error('compound-repair-background-schedule-invalid');
      }
      if (backgroundRevision?.enabled === true &&
          typeof config.compoundRepairRevision.independentEvaluationConfigForRepair !== 'function') {
        throw new Error('background-compound-repair-revision-requires-independent-evaluation-authority');
      }
      // Production revision staging must not trust an evaluator supplied by the same
      // provider that proposes the candidate. Keep legacy provider-only wiring for
      // development, but fail startup in production unless the independent sandbox,
      // verifier and safety authorities are configured by the trusted host.
      if (process.env.NODE_ENV === 'production' &&
          typeof config.compoundRepairRevision.independentEvaluationConfigForRepair !== 'function') {
        throw new Error('production-compound-repair-revision-requires-independent-evaluation-authority');
      }
      if (typeof config.compoundRepairRevision.provideInputs !== 'function') {
        throw new Error('compound-repair-revision requires a trusted input provider');
      }
      // Fail at startup instead of accepting a P23 engine that cannot stage
      // into its canonical authenticated candidate lifecycle.
      if (!config.compoundRepairRevision.engine.verifiedSkillCandidateSnapshot()) {
        throw new Error('compound-repair-revision requires a configured verified P23 candidate store');
      }
      const provideInputs = config.compoundRepairRevision.independentEvaluationConfigForRepair
        ? withIndependentCandidateEvaluation(
            config.compoundRepairRevision.provideInputs,
            config.compoundRepairRevision.independentEvaluationConfigForRepair,
          )
        : config.compoundRepairRevision.provideInputs;
      configureLearningJournals(config.compoundRepairRevision.engine, learningJournals);
      this.compoundRepairRevisionCoordinator = new P23CompoundRepairRevisionCoordinator(
        this,
        config.compoundRepairRevision.engine,
        provideInputs,
        new FileStateStore<CompoundRepairRetryBackoffSnapshot>(`${config.stateFile}.p23-retry-backoff.json`),
      );
    } else {
      this.compoundRepairRevisionCoordinator = null;
    }
    this.realityGrounding.setMode(config.realityMode ?? 'hybrid');
    this.plans = new PlanEngine(this.environment, {
      predict: (action, baseReward, context) => {
        const wm = this.core.worldModelProvider().predict(action, baseReward, context as any);
        return {
          predicted: wm.predicted,
          confidence: Math.max(0.15, wm.confidence),
          samples: wm.samples ?? 0,
          uncertainty: wm.uncertainty,
          modelReady: Boolean(wm.modelReady),
        };
      },
    });
    const worldPath = config.worldStateFile ?? config.stateFile.replace(/\.json$/i, '.world.json');
    this.worldStore = config.worldStateStore ?? new FileStateStore<PersistedWorld>(worldPath);
    const skillStatePath = `${config.stateFile}.procedural-skills.json`;
    this.proceduralSkillStore = new FileStateStore<SkillLibraryState>(skillStatePath);
    this.journal = config.journal ?? new OperationalJournal(config.stateFile.replace(/\.json$/i, '.operational.jsonl'));
    this.continuityLedger = new ContinuityLedger(config.stateFile.replace(/\.json$/i, '.continuity.jsonl'));
    this.registerRuntimeClocks();
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  async init(): Promise<void> {
    return this.enqueue(async () => {
      if (this.initialized) return;
      await this.journal.write('info', 'runtime.init.begin');
      await this.core.init();
      const restoredTemporalTracks=this.temporalObjectTracker.restoreFromPerception(
        this.core.p41PerceptionSnapshot().entities,
        Date.now(),
      );
      if(restoredTemporalTracks.restored>0){
        await this.journal.write('info','runtime.perception.tracks-restored',restoredTemporalTracks);
      }
      await this.compoundRepairRevisionCoordinator?.restoreRetryBackoff();
      this.proceduralSkillLibrary.restore(await this.proceduralSkillStore.load() ?? undefined);
      const systemSnapshot = this.core.systemSnapshot();
      this.evidenceBus.restore(systemSnapshot.runtimeEvidence ?? undefined);
      this.cognitiveEventFabric.restore(systemSnapshot.runtimeCognitiveEventFabric ?? systemSnapshot.cognitiveEventFabric ?? undefined);
      this.resourceEconomy.restore(systemSnapshot.runtimeCognitiveResourceEconomy ?? systemSnapshot.cognitiveResourceEconomy ?? undefined);
      this.runtimePerformance.restore(systemSnapshot.runtimePerformance ?? undefined);
      this.unifiedCycle.restore(systemSnapshot.runtimeUnifiedCognitiveCycle ?? systemSnapshot.unifiedCognitiveCycle ?? undefined);
      this.continuousCognitiveFabric.restore(systemSnapshot.continuousCognitiveFabric ?? undefined);
      this.realityGrounding.restore(systemSnapshot.realityGrounding ?? undefined);
      this.realityGrounding.setMode(this.config.realityMode ?? systemSnapshot.realityGrounding?.mode ?? 'hybrid');
      this.neuralCausalTrace.restore(systemSnapshot.neuralCausalTrace ?? undefined);
      this.realityLearningGate.restore(systemSnapshot.realityLearningGate ?? undefined);
      this.realityShadowBridge.restore(systemSnapshot.realityShadowBridge ?? undefined);
      this.runtimeClosure.restore(systemSnapshot.runtimeClosure ?? undefined);
      this.causalDomainClosureLedger.restore(systemSnapshot.causalDomainClosureLedger ?? undefined);
      this.core.setCausalDomainClosureLedger(this.causalDomainClosureLedger.snapshot());
      const runtimeView = this.core.runtimeClosureOperationalSnapshot();
      this.runtimeClosure.restoreVerification({
        at: Date.now(),
        tick: runtimeView.tick,
        previousDurableHash: systemSnapshot.runtimeClosure?.lastDurableHash,
        replaySignature: runtimeView.replaySignature,
        continuousTick: runtimeView.continuous?.tick,
        processed: runtimeView.continuous?.processed,
      });
      this.core.setRuntimeClosure(this.runtimeClosure.snapshot());
      const world = await this.worldStore.load();
      this.environment.restore(world);
      if (!world) { await this.worldStore.save(this.environment.persisted()); this.lastWorldCheckpointAt = Date.now(); }
      const snap = this.core.snapshot();
      await this.embodiment.init(snap.facets.embodiment?.body);
      if (this.config.motorRigProfiles?.length) this.configureMotorRendererProfiles(this.config.motorRigProfiles);
      this.embodiedRecovery.restore(snap.facets.embodiment?.embodiedRecovery);
      this.core.registerActionTool({ id:'android.listen', capability:'android.stt', destructive:false, inputContract:{type:'object',properties:{},required:[],additionalProperties:false,maxProperties:0}, outputContract:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:true,maxProperties:2}, execute:async()=>{ const text=await this.embodiment.listen(); return {ok:text!=null,text:text?.slice(0,4000) ?? null}; } });
      this.core.registerActionTool({ id:'organism.project.device', capability:'project.device.read', destructive:false, projectAllowed:true, inputContract:{type:'object',properties:{},required:[],additionalProperties:false,maxProperties:0}, outputContract:{type:'object',properties:{ok:{type:'boolean'},verified:{type:'boolean'},evidenceSource:{type:'string',enum:['device','host-fallback']},independenceKey:{type:'string',minLength:1,maxLength:180},battery01:{type:'number',minimum:0,maximum:1},thermal01:{type:'number',minimum:0,maximum:1},cpuLoad01:{type:'number',minimum:0,maximum:1},ramPressure01:{type:'number',minimum:0,maximum:1},awake:{type:'boolean'},sampledAt:{type:'number',minimum:0},staleMs:{type:'number',minimum:0},error:{type:'string',minLength:1,maxLength:80}},required:['ok','verified','evidenceSource','independenceKey'],additionalProperties:false,maxProperties:12}, execute:async()=>{ const b=this.embodiment.snapshot(); const sampleAt=b.telemetry.sampledAt; const fresh=b.telemetry.source==='android-termux' && b.telemetry.staleMs===0 && Number.isFinite(sampleAt) && sampleAt>0; return {ok:fresh,verified:fresh,evidenceSource:fresh?'device':'host-fallback',independenceKey:`device:${Number.isFinite(sampleAt)?sampleAt:'unavailable'}`,...(Number.isFinite(b.telemetry.battery01)?{battery01:b.telemetry.battery01}:{}),...(Number.isFinite(b.telemetry.thermalPressure01)?{thermal01:b.telemetry.thermalPressure01}:{}),...(Number.isFinite(b.telemetry.cpuLoad01)?{cpuLoad01:b.telemetry.cpuLoad01}:{}),...(Number.isFinite(b.telemetry.ramPressure01)?{ramPressure01:b.telemetry.ramPressure01}:{}),...(typeof b.awake==='boolean'?{awake:b.awake}:{}),...(Number.isFinite(sampleAt)?{sampledAt:sampleAt}:{}),...(Number.isFinite(b.telemetry.staleMs)?{staleMs:b.telemetry.staleMs}:{}),...(fresh?{}:{error:'android-telemetry-not-fresh'})}; } });
      this.core.registerActionTool({ id:'organism.project.world', capability:'project.world.read', destructive:false, projectAllowed:true, inputContract:{type:'object',properties:{},required:[],additionalProperties:false,maxProperties:0}, outputContract:{type:'object',properties:{ok:{type:'boolean',enum:[true]},evidenceSource:{type:'string',enum:['simulator']},independenceKey:{type:'string',minLength:1,maxLength:180},tick:{type:'integer',minimum:0}},required:['ok','evidenceSource','independenceKey','tick'],additionalProperties:true,maxProperties:16}, execute:async()=>{ const c=this.environment.observationContext(); return {ok:true,evidenceSource:'simulator',independenceKey:`sim-world:${c.tick}`,tick:c.tick,location:c.location,energy:c.energy,attention:c.attention,uncertainty:c.uncertainty,facts:c.facts.slice(-12),objects:c.objects.slice(-12),events:c.events.slice(-12)}; } });
      this.embodiment.setSpeechGatewayDispatcher(async(text,ttsOptions,speechEventId)=>{
        const idempotencyKey=`tts-${createHash('sha256').update(speechEventId).digest('hex')}`;
        const execution=await this.core.executeTool('organism.device.speak',{text,speechEventId,language:ttsOptions.language,region:ttsOptions.region,pitch:ttsOptions.pitch,rate:ttsOptions.rate,volume:ttsOptions.volume,stream:ttsOptions.stream},'embodiment-runtime-voice-output',{idempotencyKey,decisionId:speechEventId,autonomous:true});
        const uncertain=execution.outcomeClass==='idempotency-recovery-required'||execution.outcomeClass==='executed-partial'||execution.idempotencyStatus==='recovery-required';
        const result=execution.result&&typeof execution.result==='object'?execution.result as Record<string,unknown>:{};
        return {ok:execution.ok===true,uncertain,outcomeClass:execution.outcomeClass,reason:String(result.error??execution.audit?.reason??'')};
      });
      this.embodiment.setSpeechInterruptGatewayDispatcher(async(speechEventId,reason,interruptEventId)=>{
        const idempotencyKey=`tts-interrupt-${createHash('sha256').update(interruptEventId).digest('hex')}`;
        const execution=await this.core.executeTool('organism.device.speech.interrupt',{speechEventId,reason},'embodiment-runtime-voice-interrupt',{idempotencyKey,decisionId:interruptEventId,autonomous:false});
        const uncertain=execution.outcomeClass==='idempotency-recovery-required'||execution.outcomeClass==='executed-partial'||execution.idempotencyStatus==='recovery-required';
        const result=execution.result&&typeof execution.result==='object'?execution.result as Record<string,unknown>:{};
        return {ok:execution.ok===true,uncertain,outcomeClass:execution.outcomeClass,reason:String(result.error??execution.audit?.reason??'')};
      });
      await this.core.setEmbodiment(this.embodiment.snapshot(), this.embodiment.eventLog(), { sensorFailures: snap.facets.embodiment?.sensorFailures ?? 0 });
      this.initialized = true;
      this.startEmbodimentClock();
      this.clockScheduler.start('reflection');
      if (this.trustedShadowLearningScheduler) this.clockScheduler.start('trusted-shadow-learning');
      if (this.config.autoRun) this.startCognitiveClock();
      await this.journal.write('info', 'runtime.init.complete', { tick: this.core.operationalStatusSnapshot().tick });
    });
  }

  /**
   * Install the complete calibrated Live2D/2.5D/VRM profile set atomically.
   * The first profile supplies the canonical skeleton; later profiles must
   * describe exactly the same joint contract. Profiles are host-owned config,
   * not client-uploaded commands.
   */
  configureMotorRendererProfiles(
    profiles: readonly import('../system/MotorRigProfile.ts').MotorRigProfileV1[],
  ): void {
    this.motor.registerRendererRigProfiles(profiles);
    this.motor.startContinuous(50);
  }

  /** Configure the one canonical motor skeleton from a calibrated avatar profile. */
  configureMotorSkeleton(definitions: readonly import('../system/EmbodiedMotorController.ts').JointDefinition[]): void {
    this.motor.configureSkeleton(definitions);
    this.motor.startContinuous(50);
  }

  /** Submit a goal only after the upstream cognitive/action/ethical gate has approved it. */
  submitApprovedMotorGoal(
    goal: import('../system/EmbodiedMotorController.ts').MotorGoal,
    monotonicNowMs = performance.now(),
  ): { accepted: boolean; reason: string } {
    return this.motor.submitApprovedGoal(goal, monotonicNowMs);
  }

  /** Renderer adapters subscribe to the bounded latest-value MotorFrame channel. */
  subscribeMotorFrames(
    listener: (frame: import('../system/EmbodiedMotorController.ts').MotorFrame) => void,
    replayLatest = true,
  ): () => void {
    return this.motor.subscribe(listener, replayLatest);
  }

  motorFrameSnapshot() { return this.motor.latestFrame(); }

  /** B368: explicit endogenous cycle with no external command. */
  async autonomousStep(options: { deliberate?: boolean } = { deliberate: false }): Promise<RuntimeStep> {
    return this.step(undefined, { deliberate: false, ...options });
  }

  /** B368: bounded sequential autonomous closed loop. */
  async runAutonomousCycles(count = 1): Promise<{ cycles:number; actions:string[]; worldTicks:number; neuralLearningUpdates:number; temporalUpdates:number; externalCommands:number }> {
    const total=Math.max(0,Math.min(512,Math.floor(Number(count)||0)));
    const actions:string[]=[];
    for(let i=0;i<total;i+=1){ const result=await this.autonomousStep(); actions.push(result.worldAction); }
    const neural=this.core.b365UnifiedNeuroCausalDiagnostics();
    return {cycles:total,actions,worldTicks:this.environment.snapshot().tick,neuralLearningUpdates:Number(neural.learningUpdates??0),temporalUpdates:Number(neural.temporalUpdates??0),externalCommands:0};
  }

  async step(externalText?: string, options: { deliberate?: boolean; spontaneous?: boolean; signal?: AbortSignal } = { deliberate: true }): Promise<RuntimeStep> {
    return this.enqueue(async () => {
      const stepStartedAt=Date.now();
      let stepCpuStart:any=null;
      try { stepCpuStart=(process as any).cpuUsage?.(); } catch {}
      await this.core.beginBatch();
      const worldBeforeTick=Number(this.environment.snapshot().tick);
      const domainBefore=this.core.causalDomainOperationalSnapshot(worldBeforeTick);
      this.causalDomainClosureLedger.begin({
        at: Date.now(),
        tick: Number(domainBefore.tick)+1,
        counters: {
          memoryCount: domainBefore.memoryCount, worldTick: domainBefore.worldTick, identityRevision: domainBefore.identityRevision,
          agencyDecisions: domainBefore.agencyDecisions, learningUpdates: domainBefore.learningUpdates, selfChangeCount: domainBefore.selfChangeCount,
          lifeGraphCompleteChains: domainBefore.lifeGraphCompleteChains,
        },
      });
      try {
        const previousTick = this.core.operationalStatusSnapshot().tick;
        const previousProcessed = this.continuousCognitiveFabric.diagnostics().processed;
        const result = await this.stepInternal(externalText, options);
        const fabric = this.continuousCognitiveFabric.diagnostics();
        this.runtimeClosure.step({
          at: Date.now(),
          previousTick,
          stateTick: result.cycle.state.tick,
          cycleTick: result.cycle.state.tick,
          continuousTick: fabric.processed > 0 ? Number(fabric.tick ?? 0) : undefined,
          processed: fabric.processed,
          previousProcessed,
          continuity01: fabric.continuity01,
          energy01: result.cycle.state.needs.energy,
          uncertainty01: result.cycle.state.needs.uncertainty,
          identityContinuity01: this.core.operationalStatusSnapshot().identityContinuity,
          predictionError01: result.cycle.state.predictionError,
          action: result.worldAction,
        });
        this.core.setRuntimeClosure(this.runtimeClosure.snapshot());
        await this.journal.write('info', 'runtime.step', { tick: result.cycle.state.tick, action: result.worldAction, external: Boolean(externalText) });
        await this.continuityLedger.record({
          at: Date.now(), tick: result.cycle.state.tick, stage: this.core.runtimeMetadataSnapshot().stage, action: result.worldAction,
          energy01: result.cycle.state.needs.energy, uncertainty01: result.cycle.state.needs.uncertainty,
          predictionError01: result.cycle.state.predictionError, selfPredictionError01: result.cycle.state.selfPredictionError,
          identityContinuity01: this.core.consciousnessSnapshot().identityContinuity.continuity,
          memoryCount: result.cycle.memories?.length ?? 0, goalCount: result.cycle.goals?.length ?? 0,
          stateBytes: new TextEncoder().encode(JSON.stringify({ state: result.cycle.state })).byteLength,
          replaySignature: this.core.runtimeMetadataSnapshot().replaySignature,
        }).catch(() => {});

        const worldAfterTick=Number(this.environment.snapshot().tick);
        const domainAfter=this.core.causalDomainOperationalSnapshot(worldAfterTick);
        const evidence:CausalDomainEvidence={
          memoryChanged: domainAfter.memoryCount > domainBefore.memoryCount || domainAfter.memoryEventCount > domainBefore.memoryEventCount || (domainAfter.continuousProcessed ?? 0) > (domainBefore.continuousProcessed ?? 0),
          worldChanged: worldAfterTick > worldBeforeTick,
          agencyChanged: domainAfter.agencyDecisions > domainBefore.agencyDecisions,
          learningChanged: domainAfter.learningUpdates > domainBefore.learningUpdates,
          selfChanged: domainAfter.selfChangeCount > domainBefore.selfChangeCount || Math.abs(domainAfter.identityContinuity01-domainBefore.identityContinuity01)>=0.005,
          memoryWorldVerified: this.core.memoryWorldCausalBridgeSnapshot().recent?.some((row:any)=>Number(row?.tick)===Number(result.cycle.state.tick) && row?.status==='verified') ?? false,
          worldAgencyLearningVerified: this.core.worldAgencyLearningCausalBridgeSnapshot().recent?.some((row:any)=>Number(row?.tick)===Number(result.cycle.state.tick) && row?.status==='verified') ?? false,
          causalLifeGraphChain: Boolean((domainAfter as any).lifeGraphCurrentTickComplete),
          replaySignaturePresent: Boolean(domainAfter.replaySignature),
          durableStateAligned: domainAfter.lastCheckpointTick === domainAfter.tick && Boolean(domainAfter.replaySignature),
        };
        const closureRecord=this.causalDomainClosureLedger.end({counters:{
          memoryCount:domainAfter.memoryCount,worldTick:domainAfter.worldTick,identityRevision:domainAfter.identityRevision,agencyDecisions:domainAfter.agencyDecisions,
          learningUpdates:domainAfter.learningUpdates,selfChangeCount:domainAfter.selfChangeCount,lifeGraphCompleteChains:domainAfter.lifeGraphCompleteChains,
        },evidence});
        this.core.setCausalDomainClosureLedger(this.causalDomainClosureLedger.snapshot());
        if (closureRecord && closureRecord.status==='FAIL') {
          await this.journal.write('warn','runtime.causal-domain-closure.degraded',{tick:closureRecord.tick,score01:closureRecord.score01,chain:closureRecord.causalChain});
        }
        return result;
      } catch (error: any) {
        await this.journal.write('error', 'runtime.step.failed', { message: String(error?.message || error) });
        throw error;
      } finally {
        await this.core.endBatch();
        let cpuMs=0;
        try { if(stepCpuStart && (process as any).cpuUsage) { const cpu=(process as any).cpuUsage(stepCpuStart); cpuMs=(Number(cpu?.user??0)+Number(cpu?.system??0))/1000; } } catch {}
        const mem=process.memoryUsage();
        const afterBody=this.embodiment.snapshot();
        this.runtimePerformance.record({wallMs:Math.max(0,Date.now()-stepStartedAt),cpuMs,heapUsedBytes:Number(mem.heapUsed),rssBytes:Number(mem.rss),thermal01:afterBody.thermalStrain01,ramPressure01:afterBody.telemetry.ramPressure01});
        this.core.setRuntimePerformance(this.runtimePerformance.snapshot());
        if (this.pendingEmergencyCheckpointReason !== null) {
          const reason = this.pendingEmergencyCheckpointReason;
          const tick = this.pendingEmergencyCheckpointTick;
          this.pendingEmergencyCheckpointReason = null;
          this.pendingEmergencyCheckpointTick = -1;
          await this.core.flush();
          this.lastEmergencyCheckpointTick = tick;
          this.emergencyCheckpointCount += 1;
          this.lastEmergencyCheckpointReason = reason;
          await this.journal.write('warn','runtime.emergency-checkpoint',{tick,reason});
        }
        const runtimeView = this.core.runtimeClosureOperationalSnapshot();
        this.runtimeClosure.durable({
          at: Date.now(),
          tick: runtimeView.tick,
          stateTick: runtimeView.tick,
          replaySignature: runtimeView.replaySignature,
          continuousTick: runtimeView.continuous?.tick,
          continuityProcessed: runtimeView.continuous?.processed,
          memoryCount: runtimeView.memoryCount,
        });
        this.core.setRuntimeClosure(this.runtimeClosure.snapshot());
        const causalView=this.core.causalDomainOperationalSnapshot(Number(this.environment.snapshot().tick));
        this.causalDomainClosureLedger.durable({
          tick: causalView.tick,
          stateTick: causalView.tick,
          replaySignature: causalView.replaySignature,
          continuousTick: causalView.continuousTick,
          processed: causalView.continuousProcessed,
        });
        this.causalDomainClosureLedger.finalizeDurable({
          tick: causalView.tick,
          stateTick: causalView.tick,
          replaySignature: causalView.replaySignature,
          continuousTick: causalView.continuousTick,
          processed: causalView.continuousProcessed,
        });
        this.core.setCausalDomainClosureLedger(this.causalDomainClosureLedger.snapshot());
      }
    });
  }

  /** Remote recall is a separately gated, best-effort source. It never writes to canonical MemoryOS2. */
  private async retrieveMem0Context(query: string): Promise<Mem0Candidate[]> {
    if (!this.mem0CognitiveRecallEnabled || !query.trim() || !this.mem0Adapter.diagnostics().available) return [];
    try {
      const result = await this.mem0Adapter.search(query, 3);
      return result.status === 'ok' ? result.memories.slice(0, 3) : [];
    } catch {
      // External memory must never prevent a local-first response.
      return [];
    }
  }

  private async generateCognitiveProposal(cycle: OrganismCycleResult, fusedObservation: string, deliberate = false, autonomous = false, signal?: AbortSignal): Promise<CognitiveProposal|null> {
    if (!this.config.enableLanguage || !this.config.languageInvoker) return null;
    const current = this.core.operationalStatusSnapshot();
    const budgetSnapshot = this.core.cognitiveBudgetOperationalSnapshot();
    const shouldAsk = Boolean(fusedObservation.trim()) && (deliberate || (autonomous && current.predictionError > 0.62));
    if (!shouldAsk) return null;
    const request=buildCognitiveProposalPrompt(cycle,fusedObservation,this.core.knownEntityPromptContext('user'),this.core.personalityTraitPromptContext());
    if(signal) request.signal=signal;
    this.lastContextBudgetLedger = request.contextLedger ?? null;
    const budgetMode = budgetSnapshot?.mode ?? 'shallow';
    if (!deliberate && (budgetMode === 'sleep' || budgetMode === 'defer' || budgetMode === 'reflex')) return null;
    const infoGain=cycle.state.needs.uncertainty * .55 + cycle.state.needs.novelty * .45;
    const tierCost=budgetMode==='deep' ? .42 : budgetMode==='simulate' ? .30 : .20;
    const spend=this.core.cognitiveBudgetSpend(budgetMode==='deep'?'llm-deep':'llm-fast',tierCost,infoGain,'cognitive-proposal');
    if(!spend.accepted) return parseCognitiveProposal('budget constrained: preserve resources and verify supplied evidence before changing course','local-fallback');
    try {
      const response=await this.config.languageInvoker(request);
      await this.core.recordLanguageBackend(response.backend, response.latencyMs, true);
      this.evidenceBus.publish({tick:cycle.state.tick,kind:'model',source:response.backend,confidence01:.7,payload:{latencyMs:response.latencyMs,role:'cognitive-proposal'}});
      return parseCognitiveProposal(response.text,'llm');
    } catch (error) {
      if(signal?.aborted) return parseCognitiveProposal('language request cancelled; preserve the current verified state','local-fallback');
      await this.core.recordLanguageFailure(undefined, 0).catch(()=>{});
      this.evidenceBus.publish({tick:cycle.state.tick,kind:'model',source:'language-failure',confidence01:.15,payload:{role:'cognitive-proposal',message:String((error as any)?.message || error).slice(0,180)}});
      return parseCognitiveProposal('local structured fallback: verify supplied evidence before changing course','local-fallback');
    }
  }

  private async stepInternal(externalText?: string, options: { deliberate?: boolean; spontaneous?: boolean; signal?: AbortSignal } = {}): Promise<RuntimeStep> {
    if (!this.initialized) throw new Error('OrganismRuntime.init() must be called first');
    if (externalText) this.embodiment.userActivity();
    let body = await this.embodiment.sample();
    const resourceAllocation = this.resourceEconomy.allocate({
      tick: this.core.operationalStatusSnapshot().tick,
      at: Date.now(),
      energy01: body.bodyEnergy01,
      cognitiveLoad01: body.cognitiveCapacity01 <= 0 ? 1 : 1 - body.cognitiveCapacity01,
      uncertainty01: this.core.operationalStatusSnapshot().predictionError,
      novelty01: this.core.operationalStatusSnapshot().autonomyScore,
      predictionDebt01: Number((this.core.predictionDebtSnapshot() as any)?.meanPriority01 ?? 0),
      thermalStrain01: body.thermalStrain01,
      ramPressure01: clamp01((1-body.cognitiveCapacity01)*.65 + (1-body.cognitiveCapacity01)*.35),
      performancePressure01: 0,
      awake: body.awake,
    });
    this.evidenceBus.publish({tick:this.core.operationalStatusSnapshot().tick,kind:'resource',source:'cognitive-resource-economy',confidence01:.92,payload:{mode:resourceAllocation.mode,scarcity01:resourceAllocation.scarcity01,attention01:resourceAllocation.attention01,simulation01:resourceAllocation.simulation01,learning01:resourceAllocation.learning01}});
    this.core.setRuntimeCognitiveResourceEconomy(this.resourceEconomy.snapshot());
    const previousNeural = this.core.b365UnifiedNeuroCausalDiagnostics();
    const perceptionPlan = this.core.b365PlanActivePerception({
      tick:this.core.operationalStatusSnapshot().tick,
      uncertainty01:this.core.operationalStatusSnapshot().predictionError,
      predictionError01:previousNeural.predictionError01,
      novelty01:previousNeural.grounding?.activePerceptionDemand01 ?? this.core.operationalStatusSnapshot().autonomyScore,
      forceHighValueCheck:Boolean(externalText) || this.realityShadowBridge.diagnostics().meanDivergence01 > .38 || this.core.operationalStatusSnapshot().predictionError > .62 || (this.realityGrounding.diagnostics().meanIndependent01 < .30 && this.realityGrounding.diagnostics().externalPrimary > 0),
    });
    const previousSampledAt=body.telemetry.sampledAt;
    const activeBody = await this.embodiment.sampleActive(perceptionPlan.requestedSensors,true);
    const observedSensors:string[]=[];
    if(activeBody.telemetry.source==='android-termux' && activeBody.telemetry.staleMs===0){
      if(perceptionPlan.requestedSensors.includes('battery') || perceptionPlan.requestedSensors.includes('thermal')) observedSensors.push('battery');
      if(perceptionPlan.requestedSensors.includes('motion')) observedSensors.push('motion');
      if(perceptionPlan.requestedSensors.includes('light')) observedSensors.push('light');
      if(perceptionPlan.requestedSensors.includes('proximity')) observedSensors.push('proximity');
      if(perceptionPlan.requestedSensors.includes('network')) observedSensors.push('network');
    }
    const perceptionFulfilled = activeBody.telemetry.sampledAt>previousSampledAt && activeBody.telemetry.source==='android-termux' ? Math.min(1, observedSensors.length/Math.max(1,perceptionPlan.requestedSensors.filter((x:string)=>x!=='camera').length)) : 0;
    this.core.b365RecordPerceptionPlanResult({tick:this.core.operationalStatusSnapshot().tick,observedSensors,fulfilled01:perceptionFulfilled});
    const wasAwake = activeBody.awake;
    body = activeBody;
    if (this.embodiment.maybeSleep() && !externalText) {
      if (wasAwake && !this.embodimentStatus().awake && this.sleepStartedAt == null) { this.sleepStartedAt = Date.now(); this.sleepReason = this.embodimentStatus().wakeReason || 'resource-or-idle'; }
      await this.consolidateInternal();
    await this.core.setEmbodiment(this.embodiment.snapshot(), this.embodiment.eventLog());
    }
    const rawObservation = this.environment.toOrganismObservation();
    // Normalize world data at the actual runtime-to-core boundary. The helper
    // preserves "unknown" instead of coercing malformed observations to facts.
    const normalizedWorldContext = normalizeWorldContext(rawObservation.worldContext, {
      tick: this.core.operationalStatusSnapshot().tick,
    });
    if (!normalizedWorldContext) {
      throw new Error('World context normalization failed at OrganismRuntime boundary');
    }
    const observation = { ...rawObservation, worldContext: normalizedWorldContext };
    // Validate the normalized observation before any nested fields are consumed.
    assertCognitiveCycleBoundaryInput(observation, 'full');
    const modalityEvents = [];
    if (externalText) modalityEvents.push(this.core.recordMultimodalObservation({ modality:'text', summary:externalText.slice(0,500), confidence:.88, salience:.72, evidence:['user-input'], content:externalText }));
    modalityEvents.push(this.core.recordMultimodalObservation({ modality:'sensor', summary:this.embodiment.resourceSummary(), confidence:body.sensoryFreshness01*.82, salience:Math.max(.18,Math.abs(body.telemetry.motion01 ?? 0)+.15), evidence:['device-telemetry'] }));
    modalityEvents.push(this.core.recordMultimodalObservation({ modality:'world', summary:observation.worldContext.facts.slice(-8).join(' | '), confidence:.7, salience:Math.max(.15,observation.surprise ?? .2), evidence:['world-model'] }));
    // OrganismCore owns the canonical PerceptionEngine and persists its snapshot.
    // Observe the event counter around the single core.observe call; never run
    // a second runtime-local perception engine against the same raw sample.
    const perceptionBefore = this.core.perceptionSnapshot();
    const cycle = await this.core.observe({
      ...observation,
      text: externalText,
      externalGoal: externalText ? { title: externalText.slice(0, 160), importance: 0.65, urgency: 0.4 } : undefined,
      embodiment: { bodyEnergy01: body.bodyEnergy01, cognitiveCapacity01: body.cognitiveCapacity01, thermalStrain01: body.thermalStrain01, sensoryFreshness01: body.sensoryFreshness01, awake: body.awake, battery01: body.telemetry.battery01, cpuLoad01: body.telemetry.cpuLoad01, ramPressure01: body.telemetry.ramPressure01 },
    });
    const perceptionAfter = this.core.perceptionSnapshot();
    const canonicalPerceptionEvent = perceptionAfter.eventCount > perceptionBefore.eventCount
      ? perceptionAfter.lastEvent
      : null;
    if (canonicalPerceptionEvent && canonicalPerceptionEvent.kind !== 'quiet') {
      this.evidenceBus.publish({
        tick: cycle.state.tick,
        kind: 'observation',
        source: 'perception-engine',
        confidence01: canonicalPerceptionEvent.confidence,
        payload: {
          eventId: canonicalPerceptionEvent.id,
          eventKind: canonicalPerceptionEvent.kind,
          eventSource: canonicalPerceptionEvent.source,
          salience01: canonicalPerceptionEvent.salience,
          novelty01: canonicalPerceptionEvent.novelty,
          detail: canonicalPerceptionEvent.detail,
          evidence: canonicalPerceptionEvent.evidence.slice(0, 8),
          owner: 'OrganismCore',
        },
      });
      if (canonicalPerceptionEvent.source !== 'social') {
        modalityEvents.push({
          modality: canonicalPerceptionEvent.source === 'android' ? 'sensor' : 'world',
          summary: (canonicalPerceptionEvent.kind + ': ' + canonicalPerceptionEvent.detail).slice(0, 500),
        });
      }
    }
    const activePerceptionRequestId = this.core.activePerceptionPendingId();
    const executionPlan = this.core.cognitiveExecutionPlanSnapshot();
    const fusedObservation = modalityEvents.slice(-6).map((x:any)=>`[${x.modality}] ${x.summary}`).join(' | ');
    const slowCognitionAllowed = executionPlan?.run?.['slow-cognition'] !== false;
    const cognitiveProposal = slowCognitionAllowed
      ? await this.generateCognitiveProposal(cycle, fusedObservation, Boolean(options.deliberate), !externalText, options.signal)
      : null;
    if (cognitiveProposal) {
      this.core.recordMultimodalObservation({ modality:'world', summary:`cognitive-proposal: ${cognitiveProposal.summary}`, confidence:1-cognitiveProposal.uncertainty, salience:.42, evidence:cognitiveProposal.evidenceNeeded.slice(0,6), content:cognitiveProposal.hypotheses.join(' | ') });
    }
    const internalAction = cycle.decision.selected?.action ?? 'wait';
    const observationEvidence = this.evidenceBus.publish({tick:cycle.state.tick,kind:'observation',source:'runtime',confidence01:.72,payload:{external:Boolean(externalText),predictionError:cycle.state.predictionError,selectedAction:internalAction}});
    const projectAllowed = executionPlan?.run?.project !== false;
    const planningBudget = projectAllowed
      ? this.core.cognitiveBudgetSpend('planning',undefined,cycle.state.needs.uncertainty,'action-planning')
      : { accepted: false };
    const selectedGoal = cycle.goals.find(g => g.id === cycle.decision.selected?.goalId) ?? null;
    const plan = planningBudget.accepted && projectAllowed
      ? this.plans.build(selectedGoal, internalAction, 4, 4)
      : this.plans.buildBudgetFallback(selectedGoal, internalAction, projectAllowed ? 'planning-budget-exhausted' : 'planner-project-gated');
    const worldRolloutAllowed = executionPlan?.run?.['world-rollout'] !== false;
    const shadowPassAllowed = executionPlan?.run?.shadow !== false;
    const simBudget = worldRolloutAllowed && shadowPassAllowed
      ? this.core.cognitiveBudgetSpend('simulation',undefined,cycle.state.needs.uncertainty,'counterfactual-rollout')
      : { accepted: false };
    const branches = simBudget.accepted && worldRolloutAllowed && shadowPassAllowed
      ? this.counterfactuals.imagine(plan.steps[0]?.environmentAction, resourceAllocation.maxCounterfactualBranches, 4)
      : [];
    await this.core.recordCounterfactuals(branches);
    const worldAction = plan.steps[0]?.environmentAction ?? 'observe';
    const expectedReward = plan.steps[0]?.predictedReward ?? 0.5;
    const before = this.environment.observationContext();
    const causalContextKey = `loc:${String(before.location ?? 'unknown').trim().toLowerCase().slice(0,64)}|goal:${String(cycle.decision.selected?.goalId ?? 'none').slice(0,32)}|energy:${Math.floor(Math.max(0,Math.min(1,cycle.state.needs.energy))*4)}`;
    // P2840: predictive simulation is pure. Canonical world state is committed only
    // after reality arbitration decides that no authoritative external outcome exists.
    const shadowTransition = this.environment.simulate(worldAction, before);
    const transition = shadowTransition;
    const matchedCandidates: import('../world/WorldEnvironment.ts').EnvironmentAction[] = shadowPassAllowed
      ? ['observe','inspect','move','collect','rest','communicate'].filter((a): a is import('../world/WorldEnvironment.ts').EnvironmentAction => a !== worldAction)
      : [];
    const matchedProjections = shadowPassAllowed
      ? matchedCandidates.map(action => ({ action, projection: this.environment.project(action, before) }))
      : [];
    const matched = matchedProjections.filter(x => x.projection.valid).sort((a,b) => b.projection.reward-a.projection.reward)[0] ?? null;
    if (matched) {
      const matchedAction = matched.action;
      const matchedProjection = matched.projection;
      const selectedExpected01 = Math.max(0,Math.min(1,(expectedReward+1)/2));
      const alternativeExpected01 = Math.max(0,Math.min(1,(matchedProjection.reward+1)/2));
      const actualSelectedReward01 = Math.max(0,Math.min(1,(transition.reward+1)/2));
      const actualAlternativeReward01 = alternativeExpected01;
      this.core.recordMatchedCounterfactual({tick:cycle.state.tick,action:matchedAction,internalAction,contextKey:this.core.recoveryStrategyContextKey(cycle.state),selectedExpected01,alternativeExpected01,actualSelectedReward01,matchedTrials:1,source:'matched-simulated'});
    }
    const rewardPredictionId = this.core.recordPrediction({
      tick: cycle.state.tick, kind: 'reward', action: worldAction,
      predicted01: Math.max(0, Math.min(1, expectedReward)),
      confidence01: Math.max(0.05, Math.min(0.99, plan.steps[0]?.confidence ?? cycle.decision.selected?.confidence ?? 0.5)),
      context: { internalAction, selectedGoalId: cycle.decision.selected?.goalId ?? null },
    });
    this.core.trackWorldCausalPrediction({
      predictionId:rewardPredictionId,
      action:worldAction,
      predicted01:Math.max(0,Math.min(1,expectedReward)),
      confidence01:Math.max(0.05,Math.min(0.99,plan.steps[0]?.confidence ?? cycle.decision.selected?.confidence ?? .5)),
      intervention:true,
      at:cycle.state.at,
      persist:false,
    });
    const predictionEvidence = this.evidenceBus.publish({
      tick:cycle.state.tick,kind:'prediction',source:'reward-model',confidence01:plan.steps[0]?.confidence ?? .5,
      parentIds:[observationEvidence.id],payload:{id:rewardPredictionId,action:worldAction,predicted01:expectedReward,shadowModel:true},
    });
    const actionEvidence = this.evidenceBus.publish({
      tick:cycle.state.tick,kind:'action',source:'organism-action-gate',confidence01:cycle.decision.selected?.confidence ?? .5,
      parentIds:[predictionEvidence.id],payload:{action:worldAction,internalAction,deviceActionPending:true},
    });
    const bodyIsPhysical = body.telemetry.source === 'android-termux' && body.telemetry.staleMs === 0;
    this.core.recordRealityEvidence({tick:cycle.state.tick,realityClass:bodyIsPhysical?'device-observation':'derived',claim:bodyIsPhysical?'device-resource-sample':'host-resource-sample-derived',confidence01:bodyIsPhysical ? body.sensoryFreshness01*.82 : body.sensoryFreshness01*.25,independenceKey:`${bodyIsPhysical?'device':'host'}:${body.telemetry.sampledAt}`,parentIds:[observationEvidence.id]});
    this.core.recordRealityEvidence({tick:cycle.state.tick,realityClass:'simulator',claim:'shadow-world-transition-outcome',confidence01:.72,independenceKey:`sim-shadow:${transition.at}`,parentIds:[predictionEvidence.id]});

    const selectedCandidate = cycle.decision.selected;
    const expectedReward01 = Math.max(0, Math.min(1, selectedCandidate?.predictedUtility ?? expectedReward));
    const expectedStateDelta01 = 0.5;
    let language: LanguageResponse | undefined;
    const autonomousAgenda = !externalText && options.spontaneous
      ? this.core.autonomousSocialInitiativeForGeneration()
      : null;
    const languageBudgetAllows = currentBudgetAllowsLanguage(this.core.cognitiveBudgetOperationalSnapshot()?.mode);
    if (this.config.enableLanguage && this.config.languageInvoker && languageBudgetAllows && (Boolean(externalText) || Boolean(autonomousAgenda))) {
      const mem0Query = externalText || autonomousAgenda?.topic || '';
      const externalMem0Memories = await this.retrieveMem0Context(mem0Query);
      const request = externalText
        ? buildCognitivePrompt(cycle, transition.after.facts, externalText, this.core.knownEntityPromptContext('user'), this.core.personalityTraitPromptContext(), externalMem0Memories)
        : buildAutonomousDialoguePrompt(cycle, autonomousAgenda!, transition.after.facts, this.core.knownEntityPromptContext('user'), this.core.personalityTraitPromptContext(), externalMem0Memories);
      if(options.signal) request.signal=options.signal;
      this.lastContextBudgetLedger = request.contextLedger ?? null;
      try {
        language = await this.config.languageInvoker(request);
        if (!externalText && autonomousAgenda && !this.core.stageAutonomousSocialInitiativeMessage(autonomousAgenda.id, language?.text ?? '', Date.now())) {
          this.evidenceBus.publish({ tick: cycle.state.tick, kind: 'model', source: 'autonomous-dialogue-stage', confidence01: .25, payload: { initiativeId: autonomousAgenda.id, staged: false, reason: 'empty-or-stale-initiative' } });
        }
      } catch (error) {
        if(options.signal?.aborted) {
          this.evidenceBus.publish({tick:cycle.state.tick,kind:'model',source:'language-cancelled',confidence01:.95,payload:{reason:'caller-aborted',role:'response-generation'}});
        } else if (!externalText && autonomousAgenda) {
          this.core.deferAutonomousSocialInitiative(autonomousAgenda.id, Date.now());
          this.evidenceBus.publish({ tick: cycle.state.tick, kind: 'model', source: 'autonomous-dialogue-failure', confidence01: .2, payload: { initiativeId: autonomousAgenda.id, reason: String((error as any)?.message ?? error).slice(0, 180) } });
        } else {
          throw error;
        }
      }
    } else if (autonomousAgenda) {
      this.core.deferAutonomousSocialInitiative(autonomousAgenda.id, Date.now());
    }
    const actionAdvice = this.embodiedRecovery.advise(internalAction);
    const physicalAction = actionAdvice.allowed ? internalAction : 'wait';
    if (!actionAdvice.allowed && physicalAction !== internalAction) this.embodiedRecovery.noteRetry(internalAction);
    const embodiedAction = await this.embodiedActions.execute(physicalAction, {
      spokenText: options.spontaneous ? '' : (language?.text || externalText || ''),
      speechEventId:language?.text ? stableSpeechEventId('cycle',cycle.state.tick,language.text) : undefined,
      allowCamera: process.env.NEURO_ALLOW_AUTONOMOUS_CAMERA === '1',
      captureCamera: async (cameraId, retain) => {
        const keepForVision = retain || Boolean(this.config.visionBackend);
        const cameraKey = `autonomous-camera:${cycle.state.tick}:${cameraId}:${keepForVision ? 'path' : 'metadata'}`;
        const shot = await this.captureCameraDirect(cameraId, retain, { idempotencyKey: cameraKey, decisionId: cycle.decision.id, autonomous: true });
        return { ok: shot.ok === true, path: 'path' in shot ? shot.path : undefined, size: 'size' in shot ? shot.size : undefined, hash: 'hash' in shot ? shot.hash : undefined, error: 'error' in shot ? shot.error : undefined, executionId: shot.executionId, providerReceiptId: 'providerReceiptId' in shot ? shot.providerReceiptId : undefined };
      },
    });
    await this.core.setEmbodiedActionResult(embodiedAction);
    const consequencePredictedForRecovery = clamp01(.10 + .34*Number(cycle.decision.selected?.confidence ?? .5) + .34*(1-cycle.state.predictionError) + .12*(1-body.thermalStrain01) + .10*(body.awake ? 1 : .4));
    const recoveryRecord = this.embodiedRecovery.record({
      tick:cycle.state.tick, action:embodiedAction.action, status:embodiedAction.status, realityClass:embodiedAction.realityClass, source:embodiedAction.source,
      verified01:embodiedAction.consequenceVerification.verified ? 1 : 0,
      independent01:embodiedAction.consequenceVerification.independent ? 1 : 0,
      effect01:embodiedAction.effect01, consequenceError01:Math.abs(consequencePredictedForRecovery-embodiedAction.consequenceVerification.changed01),
      verificationMode:embodiedAction.consequenceVerification.verificationMode, sourceStable:embodiedAction.consequenceVerification.sourceStable,
      freshBefore01:embodiedAction.consequenceVerification.freshBefore01, freshAfter01:embodiedAction.consequenceVerification.freshAfter01,
      artifact:Boolean(embodiedAction.artifact), enabled:true,
    });
    this.core.setEmbodiedRecoverySnapshot(this.embodiedRecovery.snapshot());

    const postcondition = this.postconditionVerifier.assess(embodiedAction);
    const grounded = this.realityGrounding.resolve({
      tick:cycle.state.tick,
      action:(embodiedAction.action as import('../core/types.ts').ActionKind) ?? selectedCandidate?.action ?? null,
      expectedReward01,
      predictionConfidence01:clamp01(Number(selectedCandidate?.confidence ?? plan.steps[0]?.confidence ?? .5)),
      simulatedReward01:Math.max(0,Math.min(1,(transition.reward+1)/2)),
      simulatedSurprise01:clamp01(transition.surprise),
      simulatedSuccess01:transition.valid?1:0,
      embodiedAction,
      novelty01:clamp01(Math.max(transition.surprise,cycle.state.needs.novelty)),
      resource01:clamp01(resourceAllocation.learning01),
      contextKey:causalContextKey,
    });
    if (grounded.source==='external') {
      grounded.verified01 = Math.min(grounded.verified01, postcondition.verified01);
      grounded.independent01 = Math.min(grounded.independent01, postcondition.independent01);
      grounded.evidence01 = Math.min(grounded.evidence01, Math.max(postcondition.evidence01, .18));
      grounded.consequence01 = Math.min(grounded.consequence01, postcondition.consequence01 + .35*(1-postcondition.verified01));
      grounded.reason = `${grounded.reason};postcondition=${postcondition.proofClass}`;
    }
    this.realityGrounding.refineLatest({verified01:grounded.verified01,independent01:grounded.independent01,evidence01:grounded.evidence01,consequence01:grounded.consequence01,reason:grounded.reason});
    this.core.setRealityGrounding(this.realityGrounding.snapshot());

    const shadowResolution=this.realityShadowBridge.resolve({
      source:grounded.source,
      shadowReward01:Math.max(0,Math.min(1,(shadowTransition.reward+1)/2)),
      groundedReward01:grounded.reward01,
      shadowSurprise01:clamp01(shadowTransition.surprise),
    });
    if (grounded.source==='external') {
      this.core.recordGroundedExternalOutcome({
        at:cycle.state.at, action:String(embodiedAction.action), status:embodiedAction.status, proofClass:postcondition.proofClass,
        verified01:grounded.verified01, independent01:grounded.independent01, evidence01:grounded.evidence01,
        consequence01:grounded.consequence01, claim:postcondition.reason, provenanceId:`outcome:${cycle.state.tick}:${embodiedAction.at}`,
        divergence01:shadowResolution.divergence01,
      });
    }
    if(shadowResolution.commitShadow){
      this.environment.commit(shadowTransition);
      this.worldDirtyCycles += 1;
      if(this.shouldCheckpointWorld()) await this.checkpointWorld();
    }
    this.core.setRealityShadowBridge(this.realityShadowBridge.snapshot());

    const holdoutReadiness01=this.realityGrounding.causalHoldoutReadiness((embodiedAction.action as import('../core/types.ts').ActionKind) ?? selectedCandidate?.action ?? null, grounded.source, 6);
    const calibrationReadiness01=this.core.worldCausalActionReadiness(String(worldAction),6,causalContextKey);
    const learningGate=this.realityLearningGate.decide({
      source:grounded.source, evidence01:grounded.evidence01, verified01:grounded.verified01,
      independent01:grounded.independent01, consequence01:grounded.consequence01,
      predictionError01:clamp01(cycle.state.predictionError), surprise01:grounded.surprise01,
      reward01:grounded.reward01, success01:grounded.success01,
      actuation:Boolean(embodiedAction.action==='respond'||embodiedAction.action==='rest'),
      resource01:clamp01(resourceAllocation.learning01),
    });
    if(grounded.source==='external') {
      const combinedCausalReadiness01=clamp01(.62*holdoutReadiness01+.38*calibrationReadiness01);
      const memoryFactor=.72+.28*combinedCausalReadiness01;
      const identityFactor=.65+.35*combinedCausalReadiness01;
      learningGate.memoryPromotionScale01=clamp01(learningGate.memoryPromotionScale01*memoryFactor);
      learningGate.identityUpdateScale01=clamp01(learningGate.identityUpdateScale01*identityFactor);
      learningGate.learningScale01=clamp01(.44*learningGate.neuralUpdateScale01+.30*learningGate.worldModelUpdateScale01+.18*learningGate.memoryPromotionScale01+.08*learningGate.identityUpdateScale01);
      learningGate.reason=`${learningGate.reason};causal-holdout-readiness=${holdoutReadiness01.toFixed(3)};calibration-readiness=${calibrationReadiness01.toFixed(3)};combined=${combinedCausalReadiness01.toFixed(3)}`;
      this.realityLearningGate.refineLatest({memoryPromotionScale01:learningGate.memoryPromotionScale01,identityUpdateScale01:learningGate.identityUpdateScale01,learningScale01:learningGate.learningScale01,reason:learningGate.reason});
    }
    this.core.setRealityLearningGate(this.realityLearningGate.snapshot());

    const resolvedRewardSigned = clamp01(grounded.reward01)*2-1;
    const learningRewardSigned = clamp01(learningGate.reward01)*2-1;
    const resolvedPrediction = this.core.resolvePrediction(rewardPredictionId, resolvedRewardSigned);
    const outcomeSource = grounded.source === 'external' ? 'device' : 'simulator';
    const outcomeEvidence = this.evidenceBus.publish({
      tick:cycle.state.tick,kind:'outcome',source:grounded.source === 'external' ? 'external-device':'shadow-simulator',
      confidence01:grounded.evidence01,parentIds:[actionEvidence.id,predictionEvidence.id],external01:grounded.source==='external',
      payload:{reward01:grounded.reward01,surprise01:grounded.surprise01,action:embodiedAction.action,reason:grounded.reason,verified01:grounded.verified01,independent01:grounded.independent01,consequence01:grounded.consequence01,predictionError01:resolvedPrediction?.error01 ?? null},
    });
    await this.core.feedback({
      success: learningGate.success01,
      reward: learningRewardSigned,
      evidenceSource: outcomeSource,
      surprise: learningGate.surprise01,
      worldEvent: { type: grounded.source === 'external' ? 'external_action_consequence' : 'environment_transition', importance: learningGate.surprise01, payload: { action: embodiedAction.action, internalAction, facts: grounded.source === 'simulation' ? transition.after.facts.slice(-6) : [this.embodiment.resourceSummary()], plan, realitySource:grounded.source, shadowHeld01:shadowResolution.commitShadow?0:1, shadowDivergence01:shadowResolution.divergence01 } },
      learning: {
        source: grounded.source,
        evidence01: learningGate.evidence01,
        verified01: learningGate.verified01,
        independent01: learningGate.independent01,
        consequence01: learningGate.consequence01,
        learningScale01: learningGate.learningScale01,
        neuralUpdateScale01: learningGate.neuralUpdateScale01,
        worldModelUpdateScale01: learningGate.worldModelUpdateScale01,
        memoryPromotionScale01: learningGate.memoryPromotionScale01,
        identityUpdateScale01: learningGate.identityUpdateScale01,
        reward01: learningGate.reward01,
        success01: learningGate.success01,
        surprise01: learningGate.surprise01,
      },
      worldTransition: grounded.source === 'simulation' ? environmentTransitionToOrganismTransition(transition) : undefined,
      observation: { worldContext: environmentToWorldContext(grounded.source === 'simulation' ? transition.after : before), novelty: clamp01(grounded.consequenceError01*learningGate.worldModelUpdateScale01), surprise: learningGate.surprise01, reward: learningRewardSigned, success: learningGate.success01, embodiment: { bodyEnergy01: body.bodyEnergy01, cognitiveCapacity01: body.cognitiveCapacity01, thermalStrain01: body.thermalStrain01, sensoryFreshness01: body.sensoryFreshness01, awake: body.awake, battery01: body.telemetry.battery01, cpuLoad01: body.telemetry.cpuLoad01, ramPressure01: body.telemetry.ramPressure01 } },
    });

    if(activePerceptionRequestId){
      const activeGain=clamp01(
        .62*perceptionFulfilled+
        .20*grounded.consequenceError01+
        .18*grounded.surprise01,
      );
      this.core.activePerceptionComplete(activePerceptionRequestId,activeGain);
    }

    this.core.recordGroundedWorldCausalOutcome({
      predictionId:rewardPredictionId,
      action:worldAction,
      actual01:clamp01(grounded.reward01),
      source:grounded.source==='external' ? 'intervention' : 'feedback',
      confidence01:clamp01(plan.steps[0]?.confidence ?? cycle.decision.selected?.confidence ?? .5),
      verified01:grounded.verified01,
      independent01:grounded.independent01,
      evidence01:grounded.evidence01,
      matchedContextKey:causalContextKey,
      at:cycle.state.at,
    });

    const actualStateDelta01 = grounded.source === 'external'
      ? grounded.consequence01
      : Math.max(0, Math.min(1, Math.abs(transition.after.energy-transition.before.energy)*.8 + Math.abs(transition.after.attention-transition.before.attention)*.6));
    if (grounded.source === 'simulation') {
      this.core.recordSensorimotor(cycle.state.tick, transition, expectedReward, bodyActionCost(this.embodiment.snapshot(), worldAction));
    }
    this.core.b365LearnGroundedTransition({
      tick:cycle.state.tick, action:selectedCandidate?.action ?? null, expectedReward01, actualReward01:learningGate.reward01,
      expectedStateDelta01, actualStateDelta01:actualStateDelta01*learningGate.worldModelUpdateScale01, verified01:grounded.verified01, evidence01:grounded.evidence01*learningGate.worldModelUpdateScale01,
    });
    const embodiedActionKind = (embodiedAction.action as import('../core/types.ts').ActionKind) ?? selectedCandidate?.action ?? null;
    const consequenceActual01 = grounded.consequence01;
    const predictedConfidence = clamp01(Number(selectedCandidate?.confidence ?? 0.5));
    const consequencePredicted01 = clamp01(.10 + .34*predictedConfidence + .34*(1-cycle.state.predictionError) + .12*(1-body.thermalStrain01) + .10*(body.awake ? 1 : .4));
    this.core.b365LearnEmbodiedConsequence({
      tick:cycle.state.tick, action:embodiedActionKind, predictedEffect01:consequencePredicted01, actualEffect01:clamp01(.5+(consequenceActual01-.5)*learningGate.neuralUpdateScale01),
      verified01:grounded.verified01, independent01:grounded.independent01, source:embodiedAction.source,
    });

    const embodiedLedgerClass = embodiedAction.realityClass === 'device-observation' ? 'device-observation' : 'derived';
    this.core.recordRealityEvidence({tick:cycle.state.tick,realityClass:embodiedLedgerClass,claim:`embodied-action:${physicalAction}`,confidence01:grounded.evidence01,independenceKey:`embodied:${embodiedAction.at}:${embodiedAction.source}`,parentIds:[actionEvidence.id]});
    this.core.recordRealityEvidence({tick:cycle.state.tick,realityClass:grounded.source==='external' ? 'device-observation' : 'simulator',claim:`action-consequence:${physicalAction}`,confidence01:grounded.evidence01,independenceKey:`consequence:${cycle.state.tick}:${embodiedAction.source}:${grounded.source}`,parentIds:[outcomeEvidence.id]});
    if(grounded.source==='external') {
      this.core.recordExternalPerceptualEvidence({
        at:cycle.state.at,
        modality:embodiedAction.realityClass==='device-observation'?'sensor':'world',
        claim:`external-outcome:${embodiedAction.action}:verified=${grounded.verified01.toFixed(2)}:independent=${grounded.independent01.toFixed(2)}:consequence=${grounded.consequence01.toFixed(2)}:shadowDivergence=${shadowResolution.divergence01.toFixed(2)}`,
        confidence01:grounded.evidence01, verified:grounded.verified01>.5, parents:[outcomeEvidence.id,actionEvidence.id],
      });
    }

    const continuousFabric = this.continuousCognitiveFabric.step({
      tick: cycle.state.tick,
      at: cycle.state.at,
      signal: {
        id: `experience:${cycle.state.tick}:${embodiedAction.action}`,
        timestamp: cycle.state.at,
        source: grounded.source === 'external' ? (externalText ? 'user-input+external-device' : 'external-device') : (externalText ? 'user-input+shadow-world' : 'shadow-world+sensor'),
        meaning: grounded.reward01,
        novelty: clamp01(Math.max(grounded.surprise01, cycle.state.needs.novelty)),
        emotionalImpact: clamp01(cycle.state.needs.goalPressure * 0.45 + cycle.state.needs.socialNeed * 0.25 + grounded.surprise01 * 0.30),
        tags: [String(embodiedAction.action), grounded.source === 'external' ? 'grounded' : 'shadow', externalText ? 'external-input' : 'autonomous', grounded.surprise01 > 0.55 ? 'challenge' : 'experience', cycle.state.needs.novelty > 0.6 ? 'learning' : 'routine'],
      },
      identityEvent: {
        id: `identity:${cycle.state.tick}:${embodiedAction.action}`,
        timestamp: cycle.state.at,
        significance: clamp01(Math.max(learningGate.surprise01, Math.abs(learningGate.reward01-.5)*2)*learningGate.identityUpdateScale01),
        emotionalWeight: clamp01(cycle.state.needs.goalPressure * 0.55 + cycle.state.needs.socialNeed * 0.25 + learningGate.surprise01 * 0.20),
        tags: [String(embodiedAction.action), grounded.source === 'external' ? 'reality' : 'shadow', 'continuity', grounded.surprise01 > 0.50 ? 'challenge' : 'reflection', cycle.state.needs.novelty > 0.55 ? 'learning' : 'experience'],
      },
      belief: grounded.surprise01 > 0.45 ? {
        id: `world-prediction:${cycle.state.tick}`,
        confidence: clamp01((1 - (resolvedPrediction?.error01 ?? cycle.state.predictionError))*learningGate.identityUpdateScale01),
        content: grounded.source === 'external' ? 'external consequence calibrated against prior prediction' : 'shadow-world transition remains predictive only',
      } : undefined,
      evidenceSupport01: grounded.evidence01,
      allowDream: cycle.state.tick % 8 === 0 || Boolean(this.sleepStartedAt),
    });
    this.core.setContinuousCognitiveFabric(continuousFabric);
    this.evidenceBus.publish({tick:cycle.state.tick,kind:'model',source:'continuous-cognitive-fabric',confidence01:continuousFabric.continuity01,payload:{continuity01:continuousFabric.continuity01,memoryRetention01:continuousFabric.memoryRetention01,spine01:continuousFabric.lastSpine01,conflict01:continuousFabric.lastConflict?.intensity ?? 0,realitySource:grounded.source,grounding01:this.realityGrounding.snapshot().meanGrounding01}});

    const afterNeural = this.core.b365UnifiedNeuroCausalDiagnostics();
    const neuralTrace = this.neuralCausalTrace.record({
      tick:cycle.state.tick,action:embodiedActionKind,reward01:grounded.reward01,external01:grounded.source==='external',
      verified01:grounded.verified01,independent01:grounded.independent01,evidence01:grounded.evidence01,
      before:{
        learningUpdates:Number(previousNeural.learningUpdates ?? 0),
        replayUpdates:Number(previousNeural.replayUpdates ?? 0),
        predictionError01:clamp01(Number(previousNeural.predictionError01 ?? .5)),
        plasticity01:clamp01(Number(previousNeural.plasticity01 ?? 0)),
        recurrentCoherence01:clamp01(Number(previousNeural.recurrentCoherence01 ?? 0)),
        neuralConfidence01:clamp01(Number(previousNeural.neuralConfidence01 ?? 0)),
        groundingReliability01:clamp01((.18+.42*Number(previousNeural.grounding?.freshness01 ?? 0)+.40*Number(previousNeural.grounding?.sensorConfidence01 ?? 0))*(.35+.65*Number(previousNeural.grounding?.verified01 ?? 0))),
      },
      after:{
        learningUpdates:Number(afterNeural.learningUpdates ?? 0),
        replayUpdates:Number(afterNeural.replayUpdates ?? 0),
        predictionError01:clamp01(Number(afterNeural.predictionError01 ?? .5)),
        plasticity01:clamp01(Number(afterNeural.plasticity01 ?? 0)),
        recurrentCoherence01:clamp01(Number(afterNeural.recurrentCoherence01 ?? 0)),
        neuralConfidence01:clamp01(Number(afterNeural.neuralConfidence01 ?? 0)),
        groundingReliability01:clamp01((.18+.42*Number(afterNeural.grounding?.freshness01 ?? 0)+.40*Number(afterNeural.grounding?.sensorConfidence01 ?? 0))*(.35+.65*Number(afterNeural.grounding?.verified01 ?? 0))),
      },
      reason:`${grounded.source==='external'?'external-grounded':'simulation-fallback'}-neural-loop;learningScale=${learningGate.learningScale01.toFixed(3)};worldScale=${learningGate.worldModelUpdateScale01.toFixed(3)};identityScale=${learningGate.identityUpdateScale01.toFixed(3)};shadowDivergence=${shadowResolution.divergence01.toFixed(3)};causalHoldout=${holdoutReadiness01.toFixed(3)};intervention/lesion-still-required-for-causal-attribution`,
    });
    this.core.setNeuralCausalTrace(this.neuralCausalTrace.snapshot());
    this.core.recordRealityEvidence({tick:cycle.state.tick,realityClass:grounded.source==='external'?'device-observation':'simulator',claim:'neural-learning-input-provenance',confidence01:grounded.evidence01,independenceKey:`neural-input:${cycle.state.tick}:${grounded.source}`,parentIds:[outcomeEvidence.id]});

    this.core.closeB380TemporalLife({tick:cycle.state.tick,at:cycle.state.at,action:embodiedAction.action,goalId:cycle.decision.selected?.goalId??null,reward01:grounded.reward01,success01:grounded.success01,surprise01:grounded.surprise01,predictionError01:clamp01(Math.max(resolvedPrediction?.error01??cycle.state.predictionError,grounded.consequenceError01)),physicalVerified01:grounded.verified01,independent01:grounded.independent01,evidenceQuality01:grounded.evidence01,recoveryEvent01:(embodiedAction.status!=='executed'||recoveryRecord.recovered)?1:0,sleepBoundary01:body.awake?0:1,external01:grounded.source==='external'?1:0});
    const b380Token=this.core.b380TemporalLifeSnapshot().lastToken;
    if(b380Token){ this.core.consolidateB365Experience({tick:b380Token.tick,action:b380Token.action as import('../core/types.ts').ActionKind,reward01:b380Token.reward01,predictionError01:b380Token.predictionError01,salience01:b380Token.salience01,verified01:b380Token.physicalVerified01,independent01:b380Token.independent01,evidenceQuality01:b380Token.evidenceQuality01,continuity01:b380Token.continuity01,goalId:b380Token.goalId}); }
    await this.core.setEmbodiment(this.embodiment.snapshot(), this.embodiment.eventLog());

    // Record causal-cycle completion only after feedback, model updates, and embodiment state updates have actually run.
    const cycleStageIds = this.cognitiveEventFabric.recordOperationalCycle({
      tick:cycle.state.tick,
      observation:{source:'runtime',external:Boolean(externalText),confidence01:.72,payload:{predictionError:cycle.state.predictionError,selectedAction:internalAction,evidenceId:observationEvidence.id}},
      prediction:{source:'reward-model',confidence01:plan.steps[0]?.confidence ?? .5,payload:{predictionId:rewardPredictionId,evidenceId:predictionEvidence.id,action:worldAction,predicted01:expectedReward,shadowModel:true}},
      appraisal:{source:'homeostatic-appraisal',confidence01:clamp01(1-cycle.state.needs.uncertainty),payload:{energy01:cycle.state.needs.energy,cognitiveLoad01:cycle.state.needs.cognitiveLoad,uncertainty01:cycle.state.needs.uncertainty,novelty01:cycle.state.needs.novelty,socialNeed01:cycle.state.needs.socialNeed,goalPressure01:cycle.state.needs.goalPressure,predictionError01:cycle.state.predictionError}},
      attention:{source:'global-workspace',confidence01:clamp01(cycle.workspace.selected.length/Math.max(1,cycle.decision.candidates.length)),payload:{broadcastId:cycle.workspace.broadcastId,selectedCandidateIds:cycle.workspace.selected.slice(0,16),recurrentCycles:cycle.workspace.recurrentCycles,attentionBudget01:cycle.state.attentionBudget}},
      memory:{source:'active-memory-context',confidence01:clamp01(cycle.memories.length/8),payload:{retrievedMemoryIds:cycle.memories.slice(0,12).map(memory=>memory.id),retrievedCount:cycle.memories.length,continuity01:continuousFabric.continuity01,memoryRetention01:continuousFabric.memoryRetention01,lastSpine01:continuousFabric.lastSpine01}},
      goal:{source:'canonical-goal-selection',confidence01:clamp01(cycle.decision.selected?.confidence ?? .5),payload:{selectedGoalId:cycle.decision.selected?.goalId ?? null,activeGoalIds:cycle.goals.slice(0,12).map(goal=>goal.id),autonomousOverride:cycle.decision.autonomousOverride}},
      plan:{source:'plan-engine',confidence01:clamp01(plan.steps[0]?.confidence ?? .5),payload:{stepCount:plan.steps.length,nextAction:worldAction,firstStepConfidence01:plan.steps[0]?.confidence ?? null}},
      action:{source:'organism-action-gate',confidence01:cycle.decision.selected?.confidence ?? .5,payload:{evidenceId:actionEvidence.id,action:embodiedAction.action,internalAction,goalId:cycle.decision.selected?.goalId ?? null}},
      outcome:{source:grounded.source==='external'?'external-device':'shadow-simulator',external:grounded.source==='external',confidence01:grounded.evidence01,payload:{evidenceId:outcomeEvidence.id,reward01:grounded.reward01,surprise:grounded.surprise01,error01:resolvedPrediction?.error01 ?? null,verified01:grounded.verified01}},
      learning:{source:'core.feedback',confidence01:clamp01((1-(resolvedPrediction?.error01??0.5))*learningGate.learningScale01),payload:{predictionError01:resolvedPrediction?.error01??null,realitySource:grounded.source,learningPriority01:grounded.learningPriority01,learningScale01:learningGate.learningScale01}},
      selfUpdate:{source:'core.lifecycle',confidence01:this.core.consciousnessSnapshot().identityContinuity.continuity,payload:{identityContinuity01:this.core.consciousnessSnapshot().identityContinuity.continuity}},
      at:cycle.state.at,
    });
    const fabricSnapshot = this.cognitiveEventFabric.snapshot();
    this.core.setRuntimeCognitiveEventFabric(fabricSnapshot);
    const cycleStageMap = {observation:cycleStageIds.observation,prediction:cycleStageIds.prediction,appraisal:cycleStageIds.appraisal,attention:cycleStageIds.attention,memory:cycleStageIds.memory,goal:cycleStageIds.goal,plan:cycleStageIds.plan,action:cycleStageIds.action,outcome:cycleStageIds.outcome,learning:cycleStageIds.learning,'self-update':cycleStageIds.selfUpdate};
    const cycleLineage = this.cognitiveEventFabric.verifyOperationalCycle(cycleStageMap, cycle.state.tick);
    const cycleVerification = this.unifiedCycle.evaluate({tick:cycle.state.tick,stageIds:cycleStageMap,parentIntegrity01:cycleLineage.complete ? cycleLineage.integrity01 : 0});
    this.core.setRuntimeUnifiedCognitiveCycle(this.unifiedCycle.snapshot());
    this.core.recordRealityEvidence({tick:cycle.state.tick,realityClass:'derived',claim:'cognitive-cycle-completeness',confidence01:cycleVerification.complete ? .95 : .35,independenceKey:`cycle:${cycle.state.tick}`,parentIds:Object.values(cycleStageIds).filter(Boolean) as string[]});


    // B364: severe embodied resource pressure is now a real durability event, not only a
    // scheduling signal. When battery/thermal/RAM/awake state crosses a critical boundary,
    // force a durable core checkpoint immediately (with a bounded cooldown) so the organism
    // cannot lose a large amount of learned state precisely when the device is becoming
    // unstable. This remains below constitutional cognition: it protects persistence, not choice.
    const emergencyReasons:string[] = [];
    if (body.telemetry.battery01 <= .18) emergencyReasons.push('battery-critical');
    if (body.thermalStrain01 >= .82) emergencyReasons.push('thermal-critical');
    if (body.telemetry.ramPressure01 >= .90) emergencyReasons.push('ram-critical');
    if (!body.awake) emergencyReasons.push('not-awake');
    const emergencyReason = emergencyReasons.join('+');
    const emergencyDue = Boolean(emergencyReason) && (this.lastEmergencyCheckpointTick < 0 || cycle.state.tick - this.lastEmergencyCheckpointTick >= 8);
    if (emergencyDue) {
      // This method is executed inside core.beginBatch()/endBatch(). OrganismCore intentionally
      // defers physical persistence while a batch is open, so queue the durability operation and
      // execute the real checkpoint immediately after endBatch() in step().
      this.pendingEmergencyCheckpointReason = emergencyReason;
      this.pendingEmergencyCheckpointTick = cycle.state.tick;
    }

    if(cycle.state.tick % 8 === 0 || Boolean(externalText)) this.core.setRuntimeEvidence(this.evidenceBus.snapshot());
    this.core.setRuntimeCognitiveEventFabric(this.cognitiveEventFabric.snapshot());
    this.core.setRuntimeCognitiveResourceEconomy(this.resourceEconomy.snapshot());
    this.core.setRealityEvidenceLedger(this.core.realityEvidenceLedgerSnapshot());
    this.core.setRuntimeUnifiedCognitiveCycle(this.unifiedCycle.snapshot());

    this.stepsSinceConsolidation += 1;
    // On a medium phone, consolidation must be budgeted as a background operation:
    // the core projection is several MB and a forced flush every ~24 cycles can
    // dominate wall-clock time. We keep the same adaptive gate, but give mobile
    // runs a longer accumulation window so learning remains continuous without
    // turning maintenance into the main workload.
    const heapPressure01 = (() => {
      try {
        const m = process.memoryUsage();
        return clamp01(Number(m.heapUsed) / Math.max(1, Number(m.heapTotal)));
      } catch { return 0; }
    })();
    // P2705 mobile maintenance governor: when V8 is already under heap pressure,
    // delay non-critical consolidation instead of creating another large snapshot/GC
    // burst. Durable checkpoints and explicit sleep consolidation remain unchanged.
    const consolidationCadence = this.mobileConsolidationCadence(heapPressure01);
    if (this.stepsSinceConsolidation >= consolidationCadence) {
      const traces=this.core.consolidationInputSnapshot().traces.slice(0,24);
      const selected=traces.filter(t=>t.selected);
      const actionKinds=new Set(selected.map(t=>String(t.selected?.action??'')));
      const repeatedActions=selected.length>0 ? clamp01((selected.length-actionKinds.size)/Math.max(1,selected.length)) : 0;
      const recurrence=clamp01(.55*repeatedActions+.25*(selected.length/Math.max(1,traces.length))+.20*(cycle.state.predictionError>.55?1:0));
      const gate=this.adaptiveConsolidationGate.decide({
        tick:cycle.state.tick, stepsSinceConsolidation:this.stepsSinceConsolidation, recurrence01:recurrence,
        predictionError01:cycle.state.predictionError, novelty01:cycle.state.needs.novelty,
        memoryPressure01:1-cycle.state.needs.energy, ramPressure01:body.telemetry.ramPressure01,
        performanceProfile:'balanced', explicit:false,
      });
      if(gate.run) await this.consolidateInternal(false);
    }
    return { cycle: { ...cycle, multimodal: this.core.multimodalSnapshot(), cognitiveProposal }, worldAction, language, embodiedAction };
  }

  realityGroundingSnapshot(){ return this.realityGrounding.snapshot(); }
  neuralCausalTraceSnapshot(){ return this.neuralCausalTrace.snapshot(); }
  realityLearningGateSnapshot(){ return this.realityLearningGate.snapshot(); }
  realityShadowBridgeSnapshot(){ return this.realityShadowBridge.snapshot(); }

  /** Compile a bounded procedural skill into the runtime-owned library and persist it before returning. */
  async compileCompoundSkill(input:Parameters<ProceduralSkillLibrary['compileCompoundSkill']>[0]) {
    return this.enqueue(async()=>{
      if(!this.initialized) throw new Error('organism-runtime-not-initialized');
      const skill=this.proceduralSkillLibrary.compileCompoundSkill(input);
      if(skill) await this.proceduralSkillStore.save(this.proceduralSkillLibrary.snapshot());
      return skill;
    });
  }
  /** Execute a persisted procedural skill through the canonical Core ActionGateway. Provenance is caller-supplied and never inferred. */
  async executeCompoundSkill(id:string, run:{runId:string;context:string;holdout:boolean;independent:boolean;autonomous:boolean}):Promise<Awaited<ReturnType<ProceduralSkillLibrary['executeCompoundSkill']>>> {
    return this.enqueue(async()=>{
      if(!this.initialized) throw new Error('organism-runtime-not-initialized');
      const runId=String(run?.runId??'').trim();
      const context=String(run?.context??'').slice(0,180);
      if(!runId||runId.length>180||!context||typeof run?.holdout!=='boolean'||typeof run?.independent!=='boolean'||typeof run?.autonomous!=='boolean')
        throw new Error('compound-skill-run-provenance-required');
      try {
        return await this.proceduralSkillLibrary.executeCompoundSkill(id,{
          context,holdout:run.holdout,independent:run.independent,
          executeTool:async(toolId,toolInput,step)=>{
            const idempotencyKey=createHash('sha256').update(['procedural-skill',runId,id,step.id,toolId].join('\u0000')).digest('hex');
            const execution=await this.core.executeTool(toolId,toolInput,`procedural-skill:${id}:${step.id}`,{
              idempotencyKey,decisionId:runId,autonomous:run.autonomous,expectedOutputKeys:step.expectedOutputKeys,
            });
            const result=execution.result&&typeof execution.result==='object'?execution.result:{};
            return {ok:execution.ok===true,verified:execution.verified===true,result,error:execution.ok?undefined:String(result.error??execution.audit?.reason??execution.outcomeClass),confidence01:execution.verification?.confidence01};
          },
        });
      } finally {
        await this.proceduralSkillStore.save(this.proceduralSkillLibrary.snapshot());
      }
    });
  }
  proceduralSkillLibrarySnapshot(){ return this.proceduralSkillLibrary.snapshot(); }
  /**
   * Return generator-ready repair evidence from actual persisted compound executions.
   * Holdout observations are excluded; evidence is descriptive and never authorizes activation.
   */
  compoundSkillRepairEvidence(id?:string){
    const state=this.proceduralSkillLibrary.snapshot();
    return state.compoundSkills
      .filter(skill=>!id||skill.id===id)
      .flatMap(skill=>skill.repairsLedger
        .filter(row=>!row.holdout)
        .map(row=>({
          skillId:skill.id,
          skillName:skill.name,
          failureFingerprint:row.failureFingerprint,
          stepId:row.stepId,
          failedTool:row.toolId,
          diagnosis:row.diagnosis,
          contextSignature:row.contextSignature,
          candidateTools:[...row.candidateTools],
          selectedTool:row.selectedTool,
          verified:row.verified,
          confidence01:row.confidence01,
          observedAt:row.at,
          revisionEligible:Boolean(row.verified&&row.selectedTool&&row.selectedTool!==row.toolId&&row.candidateTools.includes(row.selectedTool)&&row.confidence01>=skill.policy.minEvidence01),
        })))
      .sort((a,b)=>b.observedAt-a.observedAt)
      .slice(0,96);
  }


  /**
   * Production runtime entry point for the configured repair-to-P23 lifecycle.
   * It serializes orchestration with other runtime mutations and fails closed when no
   * trusted proposal/evaluation/generator provider was configured by the application.
   */
  async reviseCompoundSkillsFromObservedRepairs(skillId:string) {
    return this.enqueue(async()=>{
      if(!this.initialized) throw new Error('organism-runtime-not-initialized');
      if(!this.compoundRepairRevisionCoordinator) {
        throw new Error('compound-repair-revision-provider-not-configured');
      }
      const result=await this.compoundRepairRevisionCoordinator.reviseFromObservedRepairs(skillId);
      await this.journal.write('info','runtime.p23.compound-repair-revision.completed',{
        skillId,status:result.status,repairEvidenceCount:result.repairEvidenceCount,
        ...(result.status==='candidate-staged'?{candidateId:result.candidateId}:{}),
      }).catch(()=>{});
      return result;
    });
  }

  /**
   * Feed real, verified non-holdout compound-repair observations into the existing P23
   * revision generator and versioned candidate lifecycle. The caller must provide the
   * authentic promotion proposal, independently produced evaluation reports, configured
   * P23 engine/store, and generator; this method cannot mint evidence or activate a candidate.
   */
  async generateCompoundSkillRevision(input:{
    engine:P23LearningEngine;
    proposal:Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>[0];
    skillId:string;
    sourceCandidateId:string;
    baseline:Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>[3];
    candidateEvaluation:Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>[4];
    generate:(request:Parameters<Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>[5]>[0] & {
      repairEvidence:ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>;
    })=>Promise<unknown>|unknown;
    evaluateRevisedCandidate:Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>[6];
    options?:Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>[7];
    sourceEvidenceFingerprint?: string;
  }){
    if(!input?.engine || typeof input.engine.generateAndStageReflectiveSkillRevision!=='function') {
      throw new Error('configured P23 learning engine is required');
    }
    if(typeof input.generate!=='function') throw new Error('configured skill revision generator is required');
    const repairEvidence=this.compoundSkillRepairEvidence(input.skillId).filter(row=>row.revisionEligible);
    if(repairEvidence.length===0) {
      throw new Error('no verified non-holdout compound repair evidence is eligible for revision');
    }
    const computedEvidenceFingerprint=createHash('sha256').update(JSON.stringify(repairEvidence)).digest('hex');
    if(input.sourceEvidenceFingerprint!==undefined && input.sourceEvidenceFingerprint!==computedEvidenceFingerprint) {
      throw new Error('compound repair evidence changed before revision provenance could be bound');
    }
    const result=await input.engine.generateAndStageReflectiveSkillRevision(
      input.proposal,input.skillId,input.sourceCandidateId,input.baseline,input.candidateEvaluation,
      request=>input.generate({...request,repairEvidence:structuredClone(repairEvidence)}),
      input.evaluateRevisedCandidate,input.options,computedEvidenceFingerprint,
    );
    await this.journal.write('info','runtime.p23.compound-repair-revision.staged',{
      skillId:input.skillId,sourceCandidateId:input.sourceCandidateId,candidateId:result.candidate.candidateId,
      repairEvidenceCount:repairEvidence.length,repairFingerprints:repairEvidence.map(row=>row.failureFingerprint),
      sourceEvidenceFingerprint:computedEvidenceFingerprint,
      note:'staged candidate only; independent shadow evidence and explicit promotion approval remain required',
    }).catch(()=>{});
    return {...result,repairEvidenceCount:repairEvidence.length};
  }
  async executeTool(id:string,input:Record<string,unknown>={},reason='runtime-tool',options:import('../system/ActionGateway.ts').ActionGatewayExecutionOptions={}){ return this.enqueue(()=>this.core.executeTool(id,input,reason,options)); }
  async reconcileToolExecution(id:string,input:Record<string,unknown>={},reason='runtime-tool-reconciliation',options:import('../system/ActionGateway.ts').ActionGatewayExecutionOptions={}){ return this.enqueue(()=>this.core.reconcileToolExecution(id,input,reason,options)); }
  async executeProjectTool(id:string,input:Record<string,unknown>={},reason='project-tool',options:import('../system/ActionGateway.ts').ActionGatewayExecutionOptions={}){ return this.enqueue(()=>this.core.executeProjectTool(id,input,reason,options)); }
  async executeNextProjectStep(reason='project-step', input:Record<string,unknown>={}, options:import('../system/ActionGateway.ts').ActionGatewayExecutionOptions={}){ return this.enqueue(()=>this.core.executeNextProjectStep(reason,input,options)); }
  toolSnapshot(){ return this.core.actionToolsSnapshot(); }
  cognitiveResourceEconomySnapshot(){ return this.resourceEconomy.snapshot(); }
  runtimePerformanceSnapshot(){ return this.runtimePerformance.snapshot(); }
  realityEvidenceLedgerSnapshot(){ return this.core.realityEvidenceLedgerSnapshot(); }
  unifiedCognitiveCycleSnapshot(){ return this.unifiedCycle.snapshot(); }
  activeProjectSnapshot(){ return this.core.activeProjectSnapshot(); }
  runtimeDecisionSnapshot(){ const p=this.runtimeDecision(); return { ...p, body:this.embodiment.snapshot(), clocks:this.clockScheduler.snapshot() }; }
  evidenceSnapshot(){ return this.evidenceBus.snapshot(); }
  embodiedRecoverySnapshot(){ return this.embodiedRecovery.snapshot(); }
  cognitiveEventFabricSnapshot(){ return this.cognitiveEventFabric.snapshot(); }
  cognitiveBudgetSnapshot(){ return this.core.cognitiveBudgetOperationalSnapshot(); }
  cognitiveImmuneSnapshot(){ return this.core.cognitiveImmuneSnapshot(); }
  async sampleEmbodiment(): Promise<ReturnType<EmbodimentRuntime['snapshot']>> {
    return this.enqueue(async () => {
      const before = this.embodiment.snapshot();
      const body = await this.embodiment.sample();
    const resourceAllocation = this.resourceEconomy.allocate({
      tick: this.core.operationalStatusSnapshot().tick,
      at: Date.now(),
      energy01: body.bodyEnergy01,
      cognitiveLoad01: body.cognitiveCapacity01 <= 0 ? 1 : 1 - body.cognitiveCapacity01,
      uncertainty01: this.core.operationalStatusSnapshot().predictionError,
      novelty01: this.core.operationalStatusSnapshot().autonomyScore,
      predictionDebt01: Number((this.core.predictionDebtSnapshot() as any)?.meanPriority01 ?? 0),
      thermalStrain01: body.thermalStrain01,
      ramPressure01: body.telemetry.ramPressure01,
      performancePressure01: this.runtimePerformance.decision().performancePressure01,
      awake: body.awake,
    });
    this.evidenceBus.publish({tick:this.core.operationalStatusSnapshot().tick,kind:'resource',source:'cognitive-resource-economy',confidence01:.92,payload:{mode:resourceAllocation.mode,scarcity01:resourceAllocation.scarcity01,attention01:resourceAllocation.attention01,simulation01:resourceAllocation.simulation01,learning01:resourceAllocation.learning01}});
    this.core.setRuntimeCognitiveResourceEconomy(this.resourceEconomy.snapshot());
      if (before.awake && !body.awake && this.sleepStartedAt == null) { this.sleepStartedAt = Date.now(); this.sleepReason = body.wakeReason || 'resource-pressure'; }
      const sensorDiagnostics = this.embodiment.sensorDiagnosticsSnapshot();
      const telemetryFresh = body.telemetry.source === 'android-termux' && body.telemetry.staleMs === 0;
      this.core.b365RecordGroundedObservation({
        tick:this.core.operationalStatusSnapshot().tick,
        source:body.telemetry.source === 'android-termux' ? 'android-termux' : 'node-host',
        freshness01:telemetryFresh ? 1 : Math.max(0, Math.min(1, 1 - Math.min(1, body.telemetry.staleMs / 30000))),
        sensorConfidence01:telemetryFresh ? (sensorDiagnostics.diagnostics?.commandsSucceeded ? Math.min(1, 0.65 + sensorDiagnostics.diagnostics.commandsSucceeded*0.08) : 0.6) : 0.35,
        verified01:telemetryFresh ? 1 : 0,
        energy01:body.telemetry.battery01, thermal01:body.thermalStrain01, motion01:body.telemetry.motion01 ?? 0,
        light01:body.telemetry.ambientLight01 ?? 0.5, proximity01:body.telemetry.proximity01 ?? 0.5, network01:body.telemetry.networkOnline ? 1 : 0,
      });
      await this.core.setEmbodiment(body, this.embodiment.eventLog(), { sensorFailures: sensorDiagnostics.sensorFailures, sensorDiagnostics, durability: 'defer' });
      return body;
    });
  }

  async enterSleep(reason = 'manual'): Promise<ReturnType<EmbodimentRuntime['snapshot']>> {
    return this.enqueue(async () => {
      this.embodiment.sleep(reason);
      await this.core.beginLifelongSleep(reason, true);
      if (this.sleepStartedAt == null) { this.sleepStartedAt = Date.now(); this.sleepReason = reason; }
      const body = this.embodiment.snapshot();
      await this.core.setEmbodiment(body, this.embodiment.eventLog());
      await this.consolidateInternal();
      return body;
    });
  }

  async wake(reason = 'manual'): Promise<ReturnType<EmbodimentRuntime['snapshot']>> {
    return this.enqueue(async () => {
      const at = Date.now();
      this.embodiment.wake(reason);
      await this.core.endLifelongSleep(reason);
      const body = this.embodiment.snapshot();
      const session = this.sleepStartedAt == null ? undefined : { startedAt: this.sleepStartedAt, endedAt: at, reason: this.sleepReason || reason, durationMs: Math.max(0, at - this.sleepStartedAt) };
      this.sleepStartedAt = null;
      this.sleepReason = '';
      await this.core.setEmbodiment(body, this.embodiment.eventLog(), session ? { sleepSession: session } : undefined);
      return body;
    });
  }

  async injectExternalEvent(detail: string, importance = 0.5) {
    return this.enqueue(async () => {
      this.embodiment.externalEvent(detail, importance);
      const body = this.embodiment.snapshot();
      await this.core.observe({
        worldEvent:{ type:'external_event', importance, payload:{ detail } },
        novelty:importance,
        surprise:importance,
        embodiment:{
          bodyEnergy01:body.bodyEnergy01,
          cognitiveCapacity01:body.cognitiveCapacity01,
          thermalStrain01:body.thermalStrain01,
          sensoryFreshness01:body.sensoryFreshness01,
          awake:body.awake,
          battery01:body.telemetry.battery01,
          cpuLoad01:body.telemetry.cpuLoad01,
          ramPressure01:body.telemetry.ramPressure01,
        },
      });
      await this.core.setEmbodiment(body, this.embodiment.eventLog());
      return this.core.perceptionSnapshot();
    });
  }
  adaptiveDevelopmentSnapshot(){ return this.core.adaptiveDevelopmentSnapshot(); }
  cameraCaptureToolInput(cameraId=0, retain=false) {
    const backendNeedsPath=Boolean(this.config.visionBackend);
    return { cameraId:Math.max(0,Math.floor(Number(cameraId)||0)), retain:Boolean(retain||backendNeedsPath), timeoutMs:12000 };
  }
  async captureCamera(cameraId = 0, retain = false, options: ActionGatewayExecutionOptions = {}) {
    return this.enqueue(async () => this.captureCameraDirect(cameraId, retain, options));
  }

  /** Canonical camera path: ActionGateway receipt first, then perception consumes that exact receipt. */
  private async captureCameraDirect(cameraId = 0, retain = false, options: ActionGatewayExecutionOptions = {}) {
    const normalized = this.cameraCaptureToolInput(cameraId,retain);
    const normalizedCameraId = normalized.cameraId;
    const backendNeedsPath = Boolean(this.config.visionBackend);
    const effectiveRetain = normalized.retain;
    const toolExecution: ToolExecution = await this.core.executeTool(
      'organism.device.capture', normalized,
      'runtime-camera-capture', options,
    );
    const result = toolExecution.result ?? {};
    if (toolExecution.ok !== true || result.ok !== true) {
      return {
        ok: false, verified: false, error: String(result.error ?? toolExecution.outcomeClass ?? 'camera-capture-failed'),
        executionId: toolExecution.executionId, outcomeClass: toolExecution.outcomeClass,
        idempotencyStatus: toolExecution.idempotencyStatus, uncertain: toolExecution.outcomeClass === 'idempotency-recovery-required',
      };
    }
    const successResult = {
      ok: true as const, path: typeof result.path === 'string' ? result.path : undefined,
      size: Number(result.size ?? 0), hash: typeof result.hash === 'string' ? result.hash : undefined,
    };
    let evidence: CameraEvidence = cameraEvidenceFromResult(successResult, normalizedCameraId, this.core.cameraEvidenceSnapshot().last?.sha256 ?? '', Date.now());
    if (successResult.path) {
      try {
        evidence = await inspectCameraFile({ path: successResult.path, cameraId: normalizedCameraId, previousHash: this.core.cameraEvidenceSnapshot().last?.sha256 ?? '', at: Date.now() });
      } catch {
        // Metadata-only fallback is retained; missing decoding is not upgraded into fake semantic vision.
      }
    }
    const state = this.core.recordCameraEvidence(evidence);
    let semantic = null as Awaited<ReturnType<VisionSemanticBackend['analyze']>> | null;
    let trackingMetrics: ReturnType<TemporalObjectTracker['update']>['metrics'] | null = null;
    if (this.config.visionBackend) this.core.setSemanticVisionAvailability(true);
    if (this.config.visionBackend && evidence.path) {
      const started = Date.now();
      try {
        semantic = await this.config.visionBackend.analyze({
          imagePath: evidence.path, at: evidence.at, cameraId: normalizedCameraId,
          context: { scene: this.core.p41PerceptionSnapshot().scene.label, uncertainty01: this.core.operationalStatusSnapshot().needs.uncertainty },
        });
        semantic = { ...semantic, latencyMs: Math.max(0, Date.now()-started) };
        if (semantic.semantic) {
          const trackedFrame=this.temporalObjectTracker.update({
            cameraId:normalizedCameraId,
            at:evidence.at,
            frameId:toolExecution.executionId, // execution identity, not image hash: identical static frames are still new captures.
            objects:semantic.objects??[],
          });
          trackingMetrics=trackedFrame.metrics;
          semantic={...semantic,objects:trackedFrame.objects};
          this.core.recordSemanticVisionFrame();
          this.core.p41PerceptionIngest({ vision: { cameraId: normalizedCameraId, sceneLabel: semantic.sceneLabel, confidence01: semantic.confidence01, objects: semantic.objects, relations: semantic.relations, events: semantic.events, latencyMs: semantic.latencyMs, semantic: true }, at: evidence.at });
          const pendingVision=this.core.p41NextPerception();
          if(pendingVision?.modality==='vision') this.core.p41FulfillPerception(pendingVision.id,true);
        }
      } catch {
        semantic = { semantic:false, backend:this.config.visionBackend.id, latencyMs:Math.max(0,Date.now()-started), evidenceKind:'external', confidence01:0, } as any;
      }
    }
    await this.core.flush();
    // The requested retention policy is distinct from temporary retention required by an installed vision backend.
    if (backendNeedsPath && !retain && evidence.path) {
      const fs = await import('node:fs/promises'); await fs.rm(evidence.path,{force:true});
      const pathModule = await import('node:path'); await fs.rm(pathModule.dirname(evidence.path),{recursive:true,force:true});
    }
    return {
      ...successResult, ok: true, verified: toolExecution.verified, executionId: toolExecution.executionId,
      providerReceiptId: toolExecution.providerReceiptId ?? (typeof result.providerReceiptId === 'string' ? result.providerReceiptId : undefined),
      evidence, cameraEvidence: this.core.cameraEvidenceSnapshot(), semanticVision: semantic?.semantic === true,
      semanticBackend: semantic?.backend ?? null, semanticResult: semantic, tracking: trackingMetrics,
    };
  }

  async captureCameraForCognition(cameraId = 0, retain = false, options: ActionGatewayExecutionOptions = {}) {
    return this.enqueue(async () => {
      const body = this.embodiment.snapshot();
      const plan = this.core.cognitiveExecutionPlanSnapshot();
      // Camera capture demand is modality-specific; a high-value research/project operation must not wake the camera by accident.
      const demand = plan ? clamp01(Number(plan.expectedValue01?.perception ?? 0)) : 0;
      const next = this.core.p41NextPerception();
      const motion01 = Number(body.telemetry.motion01 ?? 0);
      const plannerAllowsPerception = plan?.run?.perception !== false;
      // EVC-driven camera work obeys the planner; queued vision requests and strong motion remain explicit reactive triggers.
      const visionNeeded = next?.modality === 'vision' || motion01 > .5 || (plannerAllowsPerception && demand > .62);
      const resourceBlocked = body.telemetry.battery01 < .12 || body.thermalStrain01 > .82 || body.telemetry.ramPressure01 > .88 || !body.awake;
      if (!visionNeeded || resourceBlocked) return { ok:false, skipped:true, reason:resourceBlocked?'resource-gate':'low-vision-utility', demand01:demand, nextPerception:next, resourceGate:resourceBlocked };
      if (!options.idempotencyKey) return { ok:false, skipped:false, error:'camera-capture-idempotency-key-required' };
      return this.captureCameraDirect(cameraId, retain, options);
    });
  }
  /** Read the current affective appraisal from the canonical cognitive snapshot. */
  private voiceEmotionContext(): {label:string;valence01:number;arousal01:number;dominance01:number} {
    const snapshot=this.core.snapshot() as any;
    const field=snapshot?.facets?.cognition?.cognitiveField;
    const finite=(value:unknown,fallback:number)=>Number.isFinite(Number(value))?Number(value):fallback;
    const known=new Set(['curiosity','calm','joy','anxiety','frustration','sadness','anger','protective']);
    const rawLabel=String(field?.dominantEmotion??'calm').toLocaleLowerCase();
    return {
      label:known.has(rawLabel)?rawLabel:'calm',
      valence01:Math.max(0,Math.min(1,finite(field?.valence01,.5))),
      arousal01:Math.max(0,Math.min(1,finite(field?.arousal01,.22))),
      dominance01:Math.max(0,Math.min(1,finite(field?.coherence01,.5))),
    };
  }

  async speak(text: string): Promise<boolean> {
    return this.enqueue(async () => {
      const snapshot=this.core.operationalStatusSnapshot();
      const subject=this.core.subjectContinuitySnapshot();
      const p64=this.core.p64Snapshot();
      return this.embodiment.speak(text,{
        action:snapshot.lastAction,
        mode:p64.lastFrame?.mode ?? null,
        needs:snapshot.needs,
        continuity01:subject.continuity01,
        grounding01:subject.embodiedGrounding01,
        uncertainty01:snapshot.needs.uncertainty,
        emotion:this.voiceEmotionContext(),
        speechEventId:stableSpeechEventId('api',snapshot.tick,text),
      });
    });
  }
  async listen(): Promise<string | null> {
    return this.enqueue(async () => {
      const text=await this.embodiment.listen();
      if(text){
        this.embodiment.userActivity();
        const clean=text.trim().slice(0,4000);
        this.core.recordMultimodalObservation({modality:'speech',summary:clean.slice(0,220),confidence:.86,salience:.68,evidence:['termux-speech-to-text'],content:clean});
      }
      return text;
    });
  }
  async voiceStatus(){ return this.enqueue(async ()=>({voice:this.embodiment.voiceSnapshot(),body:this.embodiment.snapshot(),multimodal:this.core.multimodalSnapshot()})); }
  /** Interrupts physical speech through a durable ActionGateway operation; never kills Termux directly. */
  async interruptVoice(reason='manual'): Promise<boolean> { return this.embodiment.markVoiceInterruption(reason); }
  async voiceTurn(options:{deliberate?:boolean;speak?:boolean}={}){
    return this.enqueue(async ()=>{
      const text=await this.embodiment.listen();
      if(!text) return {text:null,step:null,spoken:false,voice:this.embodiment.voiceSnapshot()};
      this.embodiment.userActivity();
      const clean=text.trim().slice(0,4000);
      this.core.recordMultimodalObservation({modality:'speech',summary:clean.slice(0,220),confidence:.86,salience:.74,evidence:['termux-speech-to-text','voice-turn'],content:clean});
      await this.core.beginBatch();
      try {
        const step=await this.stepInternal(clean,{deliberate:Boolean(options.deliberate)});
        await this.journal.write('info','runtime.voice-turn',{tick:step.cycle.state.tick,action:step.worldAction,speakRequested:Boolean(options.speak)});
        await this.continuityLedger.record({
          at:Date.now(),tick:step.cycle.state.tick,stage:this.core.runtimeMetadataSnapshot().stage,action:step.worldAction,
          energy01:step.cycle.state.needs.energy,uncertainty01:step.cycle.state.needs.uncertainty,
          predictionError01:step.cycle.state.predictionError,selfPredictionError01:step.cycle.state.selfPredictionError,
          identityContinuity01:this.core.consciousnessSnapshot().identityContinuity.continuity,
          memoryCount:step.cycle.memories?.length??0,goalCount:step.cycle.goals?.length??0,
          stateBytes:new TextEncoder().encode(JSON.stringify({state:step.cycle.state})).byteLength,
          replaySignature:this.core.runtimeMetadataSnapshot().replaySignature,
        }).catch(()=>{});
        let spoken=false;
        if(options.speak && step.language?.text){
          const subject=this.core.subjectContinuitySnapshot();
          const voicePlanContext={action:step.cycle.state.lastAction,mode:this.core.p64Snapshot().lastFrame?.mode??null,needs:step.cycle.state.needs,continuity01:subject.continuity01,grounding01:subject.embodiedGrounding01,uncertainty01:step.cycle.state.needs.uncertainty,emotion:this.voiceEmotionContext(),speechEventId:stableSpeechEventId('voice-turn',step.cycle.state.tick,step.language.text)};
          spoken=await this.embodiment.speak(step.language.text,voicePlanContext);
        }
        return {text:clean,step,spoken,voice:this.embodiment.voiceSnapshot()};
      } catch (error:any) {
        await this.journal.write('error','runtime.voice-turn.failed',{message:String(error?.message||error)});
        throw error;
      } finally {
        await this.core.endBatch();
      }
    });
  }

  /** Run one configured P23 candidate/shadow attempt through OrganismCore's durable trust boundary. */
  async runTrustedShadowLearningOnce() {
    if (!this.initialized) throw new Error('OrganismRuntime.init() must be called before trusted shadow learning');
    if (!this.trustedShadowLearningScheduler) throw new Error('trusted shadow learning is not enabled in RuntimeConfig');
    return this.trustedShadowLearningScheduler.runOnce(this.core.operationalStatusSnapshot().tick);
  }

  trustedShadowLearningDiagnostics() {
    return this.trustedShadowLearningScheduler?.snapshot() ?? { enabled: false as const };
  }

  embodimentStatus(): ReturnType<EmbodimentRuntime['snapshot']> { return this.embodiment.snapshot(); }
  embodimentDiagnostics(){ return this.embodiment.sensorDiagnosticsSnapshot(); }
  async stop(): Promise<void> {
    // Stop is a durability boundary, not merely a scheduler shutdown.  The previous
    // implementation closed runtime clocks/ledgers without forcing the core/world
    // stores to persist the final in-memory cycle.  On mobile this is especially
    // dangerous because checkpoint cadence is deliberately throttled.
    this.stopping = true;
    this.motor.stopContinuous();
    this.clockScheduler.stop();
    await this.clockScheduler.drain();
    await this.trustedShadowLearningScheduler?.drain();
    await this.queue.catch(() => undefined);

    // All queued cognitive work has drained, so the final flush is now serialized
    // with the same queue used by step()/tool calls.  This closes the crash/restart
    // window without making every cycle pay a synchronous disk write.
    await this.enqueue(async () => {
      // Capture the closure before the single durable flush. A previous implementation
      // flushed twice here, which is disproportionately expensive because a full core
      // projection serializes several MB of state on a phone.
      const runtimeView = this.core.runtimeClosureOperationalSnapshot();
      this.runtimeClosure.durable({
        at: Date.now(),
        tick: runtimeView.tick,
        stateTick: runtimeView.tick,
        replaySignature: runtimeView.replaySignature,
        continuousTick: runtimeView.continuous?.tick,
        continuityProcessed: runtimeView.continuous?.processed,
        memoryCount: runtimeView.memoryCount,
      });
      this.core.setRuntimeClosure(this.runtimeClosure.snapshot());
      await this.core.flush();
      await this.checkpointWorld(true);
      await this.journal.write('info', 'runtime.stop.durable', {
        tick: runtimeView.tick,
        worldTick: this.environment.snapshot().tick,
      }).catch(() => {});
    });

    await this.continuityLedger.flush().catch(() => {});
    await this.continuityLedger.close();
  }

  private runtimeDecision(): ReturnType<typeof choosePhonePolicyDelay> {
    const body = this.embodiment.snapshot();
    const performance = this.runtimePerformance.decision();
    const base = choosePhonePolicyDelay({
      baseIntervalMs: this.phonePolicy.baseIntervalMs, mode: this.phonePolicy.mode, awake: body.awake,
      battery01: body.telemetry.battery01, thermalStrain01: body.thermalStrain01, ramPressure01: body.telemetry.ramPressure01,
      cpuLoad01: body.telemetry.cpuLoad01, lastStepMs: Math.max(this.lastAutonomyStepAt, performance.effectiveLastStepMs), previousThermalStrain01: this.lastThermalStrain01,
      consecutiveActiveCycles: this.consecutiveActiveCycles, maxConsecutiveActiveCycles: this.phonePolicy.maxConsecutiveActiveCycles,
    });
    // Runtime-performance pressure is a host execution signal. It may delay or
    // thin background work, but it must not enter OrganismCore cognitive scoring.
    const schedulerMultiplier = performance.schedulerMultiplier01;
    const nextDelayMs = Math.max(5_000, Math.round(base.nextDelayMs * schedulerMultiplier));
    const sampleDelayMs = Math.max(10_000, Math.min(10 * 60_000, Math.round(base.sampleDelayMs * schedulerMultiplier)));
    const reasonCodes = performance.performancePressure01 > 0.05
      ? [...new Set([...base.reasonCodes, 'runtime-performance'])]
      : base.reasonCodes;
    return { ...base, nextDelayMs, sampleDelayMs, reasonCodes };
  }

  private hasEligibleCompoundRepairEvidence(): boolean {
    return this.compoundSkillRepairEvidence().some(row => row.revisionEligible);
  }

  private nextCompoundRepairSkillId(): string | null {
    const evidence = this.compoundSkillRepairEvidence().filter(row => row.revisionEligible);
    const skillIds = [...new Set(evidence.map(row => row.skillId))];
    if (!skillIds.length) return null;

    // External repair/replay reports are never evidence or promotion authority.
    // A skill-repair claim may only prioritize an ID already present in the runtime's
    // verified non-holdout repairs ledger, which P23 re-evaluates independently.
    let hintedSkillIds: string[] = [];
    try {
      const hypotheses = this.core.unifiedLearningExternalHypotheses(128);
      if (Array.isArray(hypotheses)) {
        hintedSkillIds = skillIds.filter(skillId => hypotheses.some(hypothesis =>
          hypothesis?.claimedProvenance === 'skill-repair' &&
          typeof hypothesis.taskId === 'string' &&
          hypothesis.taskId.length <= 160 &&
          hypothesis.taskId.startsWith(`skill-repair:${skillId}:`) &&
          typeof hypothesis.receivedAt === 'number' &&
          Number.isFinite(hypothesis.receivedAt) &&
          hypothesis.receivedAt <= Date.now() + EXTERNAL_REPAIR_HINT_MAX_FUTURE_SKEW_MS &&
          Date.now() - hypothesis.receivedAt <= EXTERNAL_REPAIR_HINT_TTL_MS,
        ));
      }
    } catch {
      // Triage enrichment is optional. Trusted runtime repair evidence remains enough.
      hintedSkillIds = [];
    }
    const orderedSkillIds = [
      ...hintedSkillIds,
      ...skillIds.filter(skillId => !hintedSkillIds.includes(skillId)),
    ];
    const index = this.compoundRepairRevisionCursor % orderedSkillIds.length;
    this.compoundRepairRevisionCursor = (index + 1) % orderedSkillIds.length;
    return orderedSkillIds[index] ?? null;
  }

  private registerCompoundRepairRevisionClock(): void {
    const config = this.config.compoundRepairRevision?.backgroundRevision;
    if (config?.enabled !== true || !this.compoundRepairRevisionCoordinator) return;
    const initialDelayMs = config.initialDelayMs ?? 300_000;
    const intervalMs = config.intervalMs ?? 900_000;
    this.clockScheduler.register({
      id: 'p23-compound-repair-revision',
      initialDelayMs,
      decide: () => {
        const body = this.embodiment.snapshot();
        const decision = this.runtimeDecision();
        const battery01 = Number(body.telemetry.battery01 ?? 1);
        const ramPressure01 = Number(body.telemetry.ramPressure01 ?? 0);
        const pressure01 = this.runtimePerformance.decision().performancePressure01;
        const resourceReady = decision.cognitiveBudget01 >= 0.70 &&
          battery01 > 0.20 && ramPressure01 < 0.82 &&
          body.thermalStrain01 < 0.72 && pressure01 < 0.78;
        const hasEvidence = this.hasEligibleCompoundRepairEvidence();
        const ready = this.initialized && !this.stopping && body.awake && resourceReady && hasEvidence;
        const reason = !this.initialized || this.stopping || !body.awake
          ? 'p23-compound-repair-not-ready'
          : !hasEvidence ? 'p23-compound-repair-no-eligible-evidence'
          : resourceReady ? 'p23-compound-repair-resource-ready'
          : 'p23-compound-repair-resource-gated';
        this.compoundRepairRevisionMetrics.schedulerDecisions++;
        this.compoundRepairRevisionMetrics.lastDecisionAt = Date.now();
        this.compoundRepairRevisionMetrics.lastDecisionReason = reason;
        if (!hasEvidence) this.compoundRepairRevisionMetrics.noEvidence++;
        else if (!ready && reason === 'p23-compound-repair-not-ready') this.compoundRepairRevisionMetrics.notReady++;
        else if (!resourceReady) this.compoundRepairRevisionMetrics.resourceGated++;
        if (ready) this.compoundRepairRevisionMetrics.lastStatus = 'scheduled';
        return { delayMs: intervalMs, reason, run: ready };
      },
      task: async () => {
        const skillId = this.nextCompoundRepairSkillId();
        if (!skillId || !this.initialized || this.stopping) return;
        this.compoundRepairRevisionMetrics.attempts++;
        this.compoundRepairRevisionMetrics.lastAttemptAt = Date.now();
        this.compoundRepairRevisionMetrics.lastSkillId = skillId;
        this.compoundRepairRevisionMetrics.lastCandidateId = null;
        this.compoundRepairRevisionMetrics.lastFailureCategory = null;
        // This enters the existing serialized runtime queue and canonical P23 gate.
        // Candidate staging is not activation: shadow evidence + explicit approval
        // and rollback remain required in the versioned-skill lifecycle.
        const result = await this.reviseCompoundSkillsFromObservedRepairs(skillId);
        const stagedCandidateId = typeof result.candidateId === 'string' && result.candidateId.trim().length > 0
          ? result.candidateId
          : null;
        const reportedStatus = result.status === 'candidate-staged' && stagedCandidateId === null ? 'error' : result.status;
        this.compoundRepairRevisionMetrics.lastStatus = reportedStatus;
        if (result.status === 'candidate-staged' && stagedCandidateId !== null) {
          this.compoundRepairRevisionMetrics.staged++;
          this.compoundRepairRevisionMetrics.lastCandidateId = stagedCandidateId;
        } else if (result.status === 'candidate-staged') {
          this.compoundRepairRevisionMetrics.failures++;
          this.compoundRepairRevisionMetrics.lastFailureCategory = 'candidate-staged-without-candidate-id';
          this.core.markRuntimeAnomaly('p23-compound-repair-revision:candidate-staged-without-candidate-id');
        } else if (result.status === 'already-staged-for-evidence') {
          this.compoundRepairRevisionMetrics.deduplicated++;
        } else if (result.status === 'retry-backoff-active') {
          this.compoundRepairRevisionMetrics.backoffSkipped++;
        }
        await this.journal.write(reportedStatus === 'candidate-staged' ? 'info' : 'warn',
          'runtime.p23.compound-repair-revision.background',
          { skillId, status: reportedStatus, repairEvidenceCount: result.repairEvidenceCount,
            ...(stagedCandidateId !== null ? { candidateId: stagedCandidateId } : {}),
            ...(result.status === 'retry-backoff-active' ? { retryInMs: result.retryInMs, attempts: result.attempts } : {}) },
        ).catch(() => {});
      },
      onError: async error => {
        const message = String((error as any)?.message || error).slice(0, 500);
        this.compoundRepairRevisionMetrics.failures++;
        this.compoundRepairRevisionMetrics.lastStatus = 'error';
        this.compoundRepairRevisionMetrics.lastFailureCategory = 'revision-generation-or-evaluation-failed';
        this.core.markRuntimeAnomaly('p23-compound-repair-revision:' + message);
        await this.journal.write('warn', 'runtime.p23.compound-repair-revision.background.failed', { message }).catch(() => {});
      },
    });
  }

  private registerRuntimeClocks(): void {
    this.registerCompoundRepairRevisionClock();
    if (this.trustedShadowLearningScheduler) {
      this.clockScheduler.register({
        id: 'trusted-shadow-learning',
        initialDelayMs: this.trustedShadowLearningScheduler.initialDelayMs,
        decide: () => {
          const body = this.embodiment.snapshot();
          const decision = this.runtimeDecision();
          const battery01 = Number(body.telemetry.battery01 ?? 1);
          const ramPressure01 = Number(body.telemetry.ramPressure01 ?? 0);
          const resourceReady = decision.cognitiveBudget01 >= 0.65 && battery01 > 0.15 &&
            ramPressure01 < 0.90 && body.thermalStrain01 < 0.80;
          return {
            delayMs: this.trustedShadowLearningScheduler!.intervalMs,
            reason: resourceReady ? 'p23-trusted-shadow-resource-ready' : 'p23-trusted-shadow-resource-gated',
            run: this.initialized && !this.stopping && body.awake && resourceReady,
          };
        },
        task: async () => {
          const result = await this.runTrustedShadowLearningOnce();
          await this.journal.write(result.receipt.status === 'completed' ? 'info' : 'warn', 'runtime.p23.trusted-shadow.completed', {
            runId: result.receipt.runId,
            executionId: result.receipt.executionId,
            status: result.receipt.status,
            exitCode: result.receipt.exitCode,
            durationMs: result.receipt.durationMs,
            verifiedObservationStatus: this.trustedShadowLearningScheduler?.snapshot().lastEvidenceStatus ?? 'not-configured',
            note: 'execution receipt is not verified task outcome or promotion evidence',
          }).catch(() => {});
        },
        onError: async (error) => {
          const message = String((error as any)?.message || error).slice(0, 500);
          this.core.markRuntimeAnomaly('p23-trusted-shadow-learning:' + message);
          await this.journal.write('warn', 'runtime.p23.trusted-shadow.failed', { message }).catch(() => {});
        },
      });
    }
    this.clockScheduler.register({
      id: 'cognitive', initialDelayMs: 0,
      decide: () => {
        const p = this.runtimeDecision();
        return { delayMs: p.nextDelayMs, reason: p.reasonCodes.join(','), run: p.cognitiveBudget01 >= 0.45 && this.embodiment.snapshot().awake };
      },
      task: async () => {
        const body = this.embodiment.snapshot();
        if (!body.awake) { await this.sleepConsolidate(); this.consecutiveActiveCycles = 0; return; }
        const started = Date.now();
        try { await this.step(undefined, { deliberate: false, spontaneous: true }); this.consecutiveActiveCycles += 1; }
        finally { this.lastAutonomyStepAt = Date.now() - started; this.lastThermalStrain01 = this.embodiment.snapshot().thermalStrain01; }
      },
      onError: async (error) => {
        this.core.markRuntimeAnomaly(`cognitive-clock:${String((error as any)?.message || error)}`);
        await this.journal.write('warn', 'runtime.clock.failed', { clock: 'cognitive', message: String((error as any)?.message || error) }).catch(() => {});
      },
    });
    this.clockScheduler.register({
      id: 'embodiment', initialDelayMs: this.sensorIntervalMs,
      decide: () => { const p=this.runtimeDecision(); return { delayMs:p.sampleDelayMs, reason:`sensor-cadence:${p.reasonCodes.join(',')}`, run:!this.stopping }; },
      task: async () => { await this.sampleEmbodiment(); },
      onError: async (error) => { await this.journal.write('warn', 'runtime.clock.failed', { clock: 'embodiment', message: String((error as any)?.message || error) }).catch(() => {}); },
    });
    this.clockScheduler.register({
      id: 'reflection', initialDelayMs: this.reflectionIntervalMs(),
      decide: () => ({ delayMs: this.reflectionIntervalMs(), reason: 'reflection-cadence', run: this.initialized && !this.stopping }),
      task: async () => { if (this.embodiment.snapshot().awake && this.stepsSinceConsolidation >= 12) await this.sleepConsolidate(); },
      onError: async (error) => { await this.journal.write('warn', 'runtime.clock.failed', { clock: 'reflection', message: String((error as any)?.message || error) }).catch(() => {}); },
    });
  }

  private heapPressure01(): number {
    try { const m=process.memoryUsage(); return clamp01(Number(m.heapUsed)/Math.max(1,Number(m.heapTotal))); } catch { return 0; }
  }
  private mobileConsolidationCadence(_heapPressure01=this.heapPressure01()): number {
    // Consolidation is cognitive semantics, not maintenance. Mobile may defer
    // checkpoints/serialization, but it must not defer the semantic learning event.
    return 24;
  }

  private reflectionIntervalMs(): number {
    const base = this.phonePolicy.mode === 'eco' ? 45 * 60_000 : this.phonePolicy.mode === 'research' ? 5 * 60_000 : 15 * 60_000;
    return Math.max(60_000, Math.round(base * (this.embodiment.snapshot().awake ? 1 : 2)));
  }

  private startCognitiveClock(): void { if (this.initialized) this.clockScheduler.start('cognitive'); }
  private startEmbodimentClock(): void { if (this.initialized) this.clockScheduler.start('embodiment'); }

  private shouldCheckpointWorld(force = false): boolean {
    if (force || this.lastWorldCheckpointAt === 0) return true;
    if (this.worldDirtyCycles >= this.phonePolicy.worldCheckpointMaxDirtyCycles) return true;
    return Date.now() - this.lastWorldCheckpointAt >= this.phonePolicy.worldCheckpointMinIntervalMs;
  }

  private async checkpointWorld(force = false): Promise<void> {
    if (!this.shouldCheckpointWorld(force)) return;
    await this.worldStore.save(this.environment.persisted());
    this.worldDirtyCycles = 0;
    this.lastWorldCheckpointAt = Date.now();
  }

  /** Pending self-initiated chat turn for the UI; no tool/device side effects occur here. */
  async autonomousDialogueReady() {
    return this.enqueue(async () => this.core.pendingAutonomousSocialInitiativeMessage());
  }

  /** Mark a proactive chat turn delivered exactly once after the UI has stored it. */
  async acknowledgeAutonomousDialogue(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const acknowledged = this.core.acknowledgeAutonomousSocialInitiative(id, Date.now());
      if (acknowledged) await this.core.flush();
      return acknowledged;
    });
  }

  async flush(): Promise<void> {
    return this.enqueue(async () => {
      await this.core.flush();
      const view = this.core.runtimeClosureOperationalSnapshot();
      this.runtimeClosure.durable({ at: Date.now(), tick: view.tick, stateTick: view.tick, replaySignature: view.replaySignature, continuousTick: view.continuous?.tick, continuityProcessed: view.continuous?.processed, memoryCount: view.memoryCount });
      this.core.setRuntimeClosure(this.runtimeClosure.snapshot());
      await this.core.flush();
    });
  }
  async sleepConsolidate(): Promise<ConsolidationResult> { return this.enqueue(() => this.consolidateInternal(true)); }
  consolidationGateDiagnostics(){ return this.adaptiveConsolidationGate.diagnostics(); }
  compoundRepairRevisionDiagnostics() {
    return {
      ...this.compoundRepairRevisionMetrics,
      enabled: this.config.compoundRepairRevision?.backgroundRevision?.enabled === true,
      schedule: this.config.compoundRepairRevision?.backgroundRevision?.enabled === true
        ? {
            initialDelayMs: this.config.compoundRepairRevision.backgroundRevision.initialDelayMs ?? 300_000,
            intervalMs: this.config.compoundRepairRevision.backgroundRevision.intervalMs ?? 900_000,
          }
        : null,
      retryBackoff: this.compoundRepairRevisionCoordinator?.retryBackoffDiagnostics() ?? [],
      note: 'Runtime-local counters are observational, not persistent outcome evidence; candidates remain staged until authenticated promotion approval.',
    };
  }
  longitudinalSnapshot(){
    const heap=this.heapPressure01();
    return {
      ...this.core.longitudinalSnapshot(),
      trustedShadowLearning:this.trustedShadowLearningScheduler?.snapshot() ?? { enabled:false },
      compoundRepairRevision:this.compoundRepairRevisionDiagnostics(),
      lastAutonomyStepMs:this.lastAutonomyStepAt,
      runtimeClocks:this.clockScheduler.snapshot(),
      continuityLedger:this.continuityLedger.metrics(),
      consolidationGate:this.adaptiveConsolidationGate.diagnostics(),
      mobileMaintenance:{heapPressure01:heap,stepsSinceConsolidation:this.stepsSinceConsolidation,cadence:this.mobileConsolidationCadence(heap)},
    };
  }
  persistenceMetrics(){
    const heap=this.heapPressure01();
    return {
      core:this.core.persistenceMetrics(),
      trustedShadowLearning:this.trustedShadowLearningScheduler?.snapshot() ?? { enabled:false },
      compoundRepairRevision:this.compoundRepairRevisionDiagnostics(),
      predictionLedger:this.core.predictionLedgerSnapshot(),
      continuity:this.core.continuitySnapshot(),
      world:typeof this.worldStore.metrics==='function' ? this.worldStore.metrics() : null,
      worldDirtyCycles:this.worldDirtyCycles,
      lastWorldCheckpointAt:this.lastWorldCheckpointAt,
      emergencyCheckpoint:{count:this.emergencyCheckpointCount,lastTick:this.lastEmergencyCheckpointTick,lastReason:this.lastEmergencyCheckpointReason},
      runtimeClocks:this.clockScheduler.snapshot(),
      continuityLedger:{...this.continuityLedger.metrics(), ...this.continuityLedger.diagnostics()},
      mobileMaintenance:{heapPressure01:heap,stepsSinceConsolidation:this.stepsSinceConsolidation,cadence:this.mobileConsolidationCadence(heap)},
    };
  }
  continuousCognitiveDiagnostics(){ return this.continuousCognitiveFabric.diagnostics(); }
  runtimeClosureDiagnostics(){ return this.runtimeClosure.diagnostics(); }
  causalDomainClosureDiagnostics(){ return this.causalDomainClosureLedger.diagnostics(); }
  causalDomainClosureSnapshot(){ return this.causalDomainClosureLedger.snapshot(); }


  private async consolidateInternal(explicit=false): Promise<ConsolidationResult> {
    if (!this.initialized) throw new Error('OrganismRuntime.init() must be called before consolidation');
    const snapshot = this.core.consolidationInputSnapshot();
    const result = this.consolidation.run(snapshot.traces, snapshot.goals);
    await this.core.applyConsolidation(result.goalUpdates, result.memories);
    this.core.b365ReplayConsolidate(16, this.core.operationalStatusSnapshot().tick);
    this.core.consolidateLongitudinal();
    await this.core.flush();
    this.stepsSinceConsolidation = 0;
    return result;
  }
}
