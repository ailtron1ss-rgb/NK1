import type { PersistedOrganism } from './OrganismCore.ts';
import type { ProjectionGroup } from '../persistence/AdvancedProjectionScheduler.ts';

export interface PersistenceProjectionContext { [key:string]: any; }
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

/**
 * BIG PASS 57: owns persistence projection mapping outside OrganismCore.
 * Snapshots are memoized within a single projection pass only; no cached
 * snapshot survives the pass, so persistence semantics remain time-local.
 */
export class PersistenceProjectionCoordinator {
  private readonly snapshotCache = new Map<string, unknown>();

  private snapshotOnce(key: string, provider: { snapshot: (...args:any[]) => any } | null | undefined, ...args:any[]): any {
    if (this.snapshotCache.has(key)) return this.snapshotCache.get(key);
    if (!provider || typeof provider.snapshot !== 'function') {
      this.snapshotCache.set(key, undefined);
      return undefined;
    }
    const value = provider.snapshot(...args);
    this.snapshotCache.set(key, value);
    return value;
  }

  sync(target: PersistedOrganism, ctx: PersistenceProjectionContext, includeAdvanced=true, forceAllAdvanced=false): void {
    this.snapshotCache.clear();
    const budgetAction=ctx.persistenceBudgetController.decide(target);
    target.traces=target.traces.slice(0,budgetAction.traceLimit);
    // Durable world state is materialized at the persistence boundary, not on every observation.
    // The live WorldModel remains the runtime source of truth between checkpoints.
    target.worldModel=ctx.worldSubsystem.world.persisted();
    target.facets.memory.eventLog=ctx.memorySubsystem.events.recent(budgetAction.eventLimit);
    target.facets.memory.selfModel=this.snapshotOnce('snap:memorySubsystem.selfModel', ctx.memorySubsystem.selfModel);
    target.facets.memory.userModel=this.snapshotOnce('snap:memorySubsystem.userModel', ctx.memorySubsystem.userModel);
    target.facets.memory.socialModel=this.snapshotOnce('snap:memorySubsystem.socialModel', ctx.memorySubsystem.socialModel);
    target.facets.memory.adaptiveValues=this.snapshotOnce('snap:memorySubsystem.valuePlasticity', ctx.memorySubsystem.valuePlasticity);
    target.facets.memory.autobiographicalMemories=ctx.memorySubsystem.memorySubstrate.projectCompatibilityRecords(ctx.memorySubsystem.memoryOS.snapshot({clone:false}), budgetAction.compatibilityMemoryLimit);
    target.facets.learning.selfAuthorship=this.snapshotOnce('snap:selfSubsystem.selfAuthorship', ctx.selfSubsystem.selfAuthorship);
    target.facets.learning.sensorimotor=this.snapshotOnce('snap:sensorimotor', ctx.sensorimotor);
    target.facets.learning.neuromodulation=this.snapshotOnce('snap:neuromodulation', ctx.neuromodulation);
    target.facets.learning.lifelong=this.snapshotOnce('snap:lifelong', ctx.lifelong);
    target.facets.learning.adaptivePolicy=this.snapshotOnce('snap:adaptivePolicy', ctx.adaptivePolicy);
    target.facets.learning.p23=this.snapshotOnce('snap:p23Learning', ctx.p23Learning);
    target.facets.cognition.contextualWorld=this.snapshotOnce('snap:worldSubsystem.contextualWorld', ctx.worldSubsystem.contextualWorld);
    target.facets.learning.p26=this.snapshotOnce('snap:p26TrueLearning', ctx.p26TrueLearning);
    target.facets.learning.p28=this.snapshotOnce('snap:p28Plasticity', ctx.p28Plasticity);
    target.facets.learning.p29=this.snapshotOnce('snap:p29Learning', ctx.p29Learning);
    target.facets.learning.p30=this.snapshotOnce('snap:p30Continual', ctx.p30Continual);
    target.facets.learning.p36=this.snapshotOnce('snap:p36SelfDevelopment', ctx.p36SelfDevelopment);
    if (ctx.autonomousScientificBrain) target.facets.learning.autonomousScientificBrain=this.snapshotOnce('snap:autonomousScientificBrain', ctx.autonomousScientificBrain);
    target.facets.cognition.p27=this.snapshotOnce('snap:worldSubsystem.p27NeuralWorld', ctx.worldSubsystem.p27NeuralWorld);
    if(includeAdvanced){
    const advancedGroups: ProjectionGroup[] = ['critical','memory','identity','reality','developmental','slow'];
    const projectionPressure = clamp(1 - target.state.needs.energy + target.state.needs.cognitiveLoad * .35);
    const materialize = new Set<ProjectionGroup>(advancedGroups.filter(group => forceAllAdvanced || (ctx.revisionGraph.changed(group) && ctx.advancedProjectionScheduler.shouldMaterialize(group, target.state.tick, false, projectionPressure))));
      if(materialize.has('slow')) {
      target.facets.advanced.p24=this.snapshotOnce('snap:worldSubsystem.p24WorldIdentity', ctx.worldSubsystem.p24WorldIdentity);
      }
      if(materialize.has('slow')) {
      target.facets.advanced.p25=this.snapshotOnce('snap:p25ScientificDevelopment', ctx.p25ScientificDevelopment);
      }
      if(materialize.has('memory')) {
      target.facets.advanced.p47=this.snapshotOnce('snap:memorySubsystem.p47MemoryMind', ctx.memorySubsystem.p47MemoryMind);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p48Awareness=this.snapshotOnce('snap:p48Awareness', ctx.p48Awareness);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p49TemporalLife=typeof (ctx.p49TemporalLife as any)?.persistenceSnapshot==='function'
        ? (ctx.p49TemporalLife as any).persistenceSnapshot()
        : this.snapshotOnce('snap:p49TemporalLife', ctx.p49TemporalLife);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p50CausalSelfWorld=this.snapshotOnce('snap:worldSubsystem.p50CausalSelfWorld', ctx.worldSubsystem.p50CausalSelfWorld);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p51GroundedCausalWorkspace=typeof (ctx.worldSubsystem.p51GroundedCausalWorkspace as any)?.persistenceSnapshot==='function'
        ? (ctx.worldSubsystem.p51GroundedCausalWorkspace as any).persistenceSnapshot()
        : this.snapshotOnce('snap:worldSubsystem.p51GroundedCausalWorkspace', ctx.worldSubsystem.p51GroundedCausalWorkspace);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p52CounterfactualDevelopment=typeof (ctx.p52CounterfactualDevelopment as any)?.persistenceSnapshot==='function'
        ? (ctx.p52CounterfactualDevelopment as any).persistenceSnapshot()
        : this.snapshotOnce('snap:worldSubsystem.p52CounterfactualDevelopment', ctx.p52CounterfactualDevelopment);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.p53DevelopmentalSelfModification=this.snapshotOnce('snap:p53DevelopmentalSelfModification', ctx.p53DevelopmentalSelfModification);
      }
      if(materialize.has('developmental')) {
      const p54=this.snapshotOnce('snap:p54LongHorizonEvidence', ctx.p54LongHorizonEvidence);
      if (Array.isArray((p54 as any).history)) (p54 as any).history=(p54 as any).history.slice(0,budgetAction.evidenceHistoryLimit);
      target.facets.advanced.p54LongHorizonEvidence=p54;
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.p55DevelopmentalForkUniverse=this.snapshotOnce('snap:p55DevelopmentalForkUniverse', ctx.p55DevelopmentalForkUniverse);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.p56IntegratedDevelopmentalMind=typeof (ctx.p56IntegratedDevelopmentalMind as any)?.persistenceSnapshot==='function'
        ? (ctx.p56IntegratedDevelopmentalMind as any).persistenceSnapshot()
        : this.snapshotOnce('snap:p56IntegratedDevelopmentalMind', ctx.p56IntegratedDevelopmentalMind);
      }
      if(materialize.has('reality')) {
      const p57=this.snapshotOnce('snap:worldSubsystem.p57RealityFirstObservatory', ctx.worldSubsystem.p57RealityFirstObservatory);
      for (const key of ['history','records','observations'] as const) { if (Array.isArray((p57 as any)[key])) (p57 as any)[key]=(p57 as any)[key].slice(0,budgetAction.realityHistoryLimit); }
      target.facets.advanced.p57RealityFirstObservatory=p57;
      }
      if(materialize.has('slow')) {
      target.facets.advanced.p58CognitiveKernel=this.snapshotOnce('snap:p58CognitiveKernel', ctx.p58CognitiveKernel);
      }
      if(materialize.has('memory')) {
      target.facets.advanced.p59MemoryOperatingSystem=typeof (ctx.memorySubsystem.p59MemoryOperatingSystem as any)?.persistenceSnapshot==='function'
        ? (ctx.memorySubsystem.p59MemoryOperatingSystem as any).persistenceSnapshot()
        : this.snapshotOnce('snap:memorySubsystem.p59MemoryOperatingSystem', ctx.memorySubsystem.p59MemoryOperatingSystem);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p60IdentityGuardian=this.snapshotOnce('snap:selfSubsystem.p60IdentityGuardian', ctx.selfSubsystem.p60IdentityGuardian);
      }
      if(materialize.has('slow')) {
      target.facets.advanced.p61IntegratedMind=typeof (ctx.p61IntegratedMind as any)?.persistenceSnapshot==='function'
        ? (ctx.p61IntegratedMind as any).persistenceSnapshot()
        : this.snapshotOnce('snap:p61IntegratedMind', ctx.p61IntegratedMind);
      }
      if(materialize.has('memory')) {
      const p62:any=typeof (ctx.memorySubsystem.p62MemoryFabric as any)?.persistenceSnapshot==='function'
        ? (ctx.memorySubsystem.p62MemoryFabric as any).persistenceSnapshot()
        : this.snapshotOnce('snap:memorySubsystem.p62MemoryFabric', ctx.memorySubsystem.p62MemoryFabric);
      p62.history=p62.history.slice(0,budgetAction.p62HistoryLimit);
      target.facets.advanced.p62MemoryFabric=p62;
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.p63DevelopmentalOperatingSystem=typeof (ctx.p63DevelopmentalOperatingSystem as any)?.persistenceSnapshot==='function'
        ? (ctx.p63DevelopmentalOperatingSystem as any).persistenceSnapshot()
        : this.snapshotOnce('snap:p63DevelopmentalOperatingSystem', ctx.p63DevelopmentalOperatingSystem);
      }
      if(materialize.has('slow')) {
      target.facets.advanced.p64IntegratedOrganismDynamics=typeof (ctx.p64IntegratedOrganismDynamics as any)?.persistenceSnapshot==='function'
        ? (ctx.p64IntegratedOrganismDynamics as any).persistenceSnapshot()
        : this.snapshotOnce('snap:p64IntegratedOrganismDynamics', ctx.p64IntegratedOrganismDynamics);
      }
      if(materialize.has('reality')) {
      target.facets.advanced.p65EpistemicLedger=typeof (ctx.memorySubsystem.p65EpistemicLedger as any)?.persistenceSnapshot==='function'
        ? (ctx.memorySubsystem.p65EpistemicLedger as any).persistenceSnapshot()
        : this.snapshotOnce('snap:memorySubsystem.p65EpistemicLedger', ctx.memorySubsystem.p65EpistemicLedger);
      }
      if(materialize.has('reality')) {
      target.facets.advanced.p66InteroceptiveHomeostasis=typeof (ctx.p66InteroceptiveHomeostasis as any)?.persistenceSnapshot==='function'
        ? (ctx.p66InteroceptiveHomeostasis as any).persistenceSnapshot()
        : this.snapshotOnce('snap:p66InteroceptiveHomeostasis', ctx.p66InteroceptiveHomeostasis);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.p67AutonomousGoalGenesis=this.snapshotOnce('snap:p67AutonomousGoalGenesis', ctx.p67AutonomousGoalGenesis);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.p68GoalEcology=typeof (ctx.p68GoalEcology as any)?.persistenceSnapshot==='function'
        ? (ctx.p68GoalEcology as any).persistenceSnapshot()
        : this.snapshotOnce('snap:p68GoalEcology', ctx.p68GoalEcology);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p69ConstitutionalArbiter=this.snapshotOnce('snap:governanceSubsystem.p69ConstitutionalArbiter', ctx.governanceSubsystem.p69ConstitutionalArbiter);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p70MemoryLifecycleGovernor=this.snapshotOnce('snap:memorySubsystem.p70MemoryLifecycleGovernor', ctx.memorySubsystem.p70MemoryLifecycleGovernor);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p71SelfConsistency=this.snapshotOnce('snap:selfSubsystem.p71SelfConsistency', ctx.selfSubsystem.p71SelfConsistency);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p72LifeCycle=this.snapshotOnce('snap:governanceSubsystem.p72LifeCycle', ctx.governanceSubsystem.p72LifeCycle);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p73CapabilityLedger=this.snapshotOnce('snap:governanceSubsystem.p73CapabilityLedger', ctx.governanceSubsystem.p73CapabilityLedger);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p74IntegratedOrganismKernel=this.snapshotOnce('snap:p74IntegratedOrganismKernel', ctx.p74IntegratedOrganismKernel);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p75MemoryContinuumOS=this.snapshotOnce('snap:memorySubsystem.p75MemoryContinuumOS', ctx.memorySubsystem.p75MemoryContinuumOS);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p76IdentityLifeOS=this.snapshotOnce('snap:selfSubsystem.p76IdentityLifeOS', ctx.selfSubsystem.p76IdentityLifeOS);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p77RealityExperimentOS=this.snapshotOnce('snap:p77RealityExperimentOS', ctx.p77RealityExperimentOS);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p78AutobiographicalSelfContinuity=this.snapshotOnce('snap:selfSubsystem.p78AutobiographicalSelfContinuity', ctx.selfSubsystem.p78AutobiographicalSelfContinuity);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.p79EmbodiedSituationModel=this.snapshotOnce('snap:worldSubsystem.p79EmbodiedSituationModel', ctx.worldSubsystem.p79EmbodiedSituationModel);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p80UnifiedSelfState=this.snapshotOnce('snap:selfSubsystem.p80UnifiedSelfState', ctx.selfSubsystem.p80UnifiedSelfState);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p81PredictiveAttention=this.snapshotOnce('snap:p81PredictiveAttention', ctx.p81PredictiveAttention);
      }
      if(materialize.has('critical')) {
      target.facets.advanced.p82RealityProgress=this.snapshotOnce('snap:p82RealityProgress', ctx.p82RealityProgress);
      }
      if(materialize.has('reality')) {
      target.facets.advanced.p83PersistentRealityModel=this.snapshotOnce('snap:worldSubsystem.p83PersistentReality', ctx.worldSubsystem.p83PersistentReality);
      target.facets.advanced.p84AutobiographicalContinuity=this.snapshotOnce('snap:selfSubsystem.p84AutobiographicalContinuity', ctx.selfSubsystem.p84AutobiographicalContinuity);
      }
      if(materialize.has('memory')) {
      target.facets.advanced.longitudinal=this.snapshotOnce('snap:longitudinal', ctx.longitudinal);
      }
      if(materialize.has('reality')) {
      target.facets.advanced.worldModel2=this.snapshotOnce('snap:worldSubsystem.worldModel2', ctx.worldSubsystem.worldModel2);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.adaptiveDevelopment=this.snapshotOnce('snap:adaptiveDevelopment', ctx.adaptiveDevelopment);
      }
      if(materialize.has('reality')) {
      target.facets.advanced.regret=this.snapshotOnce('snap:regretEngine', ctx.regretEngine);
      }
      if(materialize.has('memory')) {
      target.facets.advanced.semanticScars=this.snapshotOnce('snap:semanticScars', ctx.semanticScars);
      }
      if(materialize.has('slow')) {
      target.facets.advanced.valueProvenance=this.snapshotOnce('snap:valueProvenance', ctx.valueProvenance);
      }
      if(materialize.has('reality')) {
      target.facets.advanced.commitmentRepair=this.snapshotOnce('snap:commitmentRepair', ctx.commitmentRepair);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.modelSwitch=this.snapshotOnce('snap:modelSwitch', ctx.modelSwitch);
      }
      if(materialize.has('memory')) {
      target.facets.advanced.microDreams=this.snapshotOnce('snap:microDreams', ctx.microDreams);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.developmentalForks=this.snapshotOnce('snap:developmentalForks', ctx.developmentalForks);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.relationshipSelf=this.snapshotOnce('snap:relationshipSelf', ctx.relationshipSelf);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.multiHypothesisPersonality=this.snapshotOnce('snap:multiHypothesisPersonality', ctx.multiHypothesisPersonality);
      }
      if(materialize.has('slow')) {
      target.facets.advanced.futureSimulator=this.snapshotOnce('snap:futureSimulator', ctx.futureSimulator);
      }
      if(materialize.has('slow')) {
      target.facets.advanced.longTermSocialMind=this.snapshotOnce('snap:longTermSocialMind', ctx.longTermSocialMind);
      }
      if(materialize.has('developmental')) {
      target.facets.advanced.selfGovernance=this.snapshotOnce('snap:governanceSubsystem.selfGovernance', ctx.governanceSubsystem.selfGovernance);
      }
      if(materialize.has('memory')) {
      target.facets.advanced.unifiedMemory=this.snapshotOnce('snap:memorySubsystem.unifiedMemory', ctx.memorySubsystem.unifiedMemory);
      }
      if(materialize.has('slow')) {
      target.facets.advanced.socialDevelopment=this.snapshotOnce('snap:socialDevelopment', ctx.socialDevelopment);
      }
      if(materialize.has('identity')) {
      target.facets.advanced.futureSelf=this.snapshotOnce('snap:futureSelf', ctx.futureSelf);
      }
      for (const group of materialize) { ctx.advancedProjectionScheduler.mark(group, target.state.tick); ctx.revisionGraph.markMaterialized(group); ctx.revisionTokens.markMaterialized(group, target.state.tick); }
    }
    target.facets.embodiment.multimodal=this.snapshotOnce('snap:embodimentSubsystem.multimodal', ctx.embodimentSubsystem.multimodal);
    target.facets.embodiment.toolAudit=this.snapshotOnce('snap:actionGateway', ctx.actionGateway);
    target.facets.memory.workspace=this.snapshotOnce('snap:memorySubsystem.workspaceV2', ctx.memorySubsystem.workspaceV2);
    target.facets.memory.semanticGraph=this.snapshotOnce('snap:memorySubsystem.semanticMemory', ctx.memorySubsystem.semanticMemory);
    target.worldModel=ctx.worldSubsystem.world.persisted();
    target.facets.consciousness.intrinsic=this.snapshotOnce('snap:intrinsicMotivation', ctx.intrinsicMotivation);
    target.facets.consciousness.activeInference=this.snapshotOnce('snap:worldSubsystem.activeInference', ctx.worldSubsystem.activeInference);
    target.facets.consciousness.identityContinuity=this.snapshotOnce('snap:selfSubsystem.identityContinuity', ctx.selfSubsystem.identityContinuity);
    target.facets.consciousness.metacognition=this.snapshotOnce('snap:metacognition', ctx.metacognition);
    target.facets.consciousness.consciousnessEvidence=this.snapshotOnce('snap:evidenceLedger', ctx.evidenceLedger);
    target.facets.consciousness.p31=this.snapshotOnce('snap:selfSubsystem.p31Consciousness', ctx.selfSubsystem.p31Consciousness);
    target.facets.consciousness.p32=this.snapshotOnce('snap:selfSubsystem.p32CausalSelf', ctx.selfSubsystem.p32CausalSelf);
    target.facets.consciousness.p33=this.snapshotOnce('snap:selfSubsystem.p33Personhood', ctx.selfSubsystem.p33Personhood);
    target.facets.consciousness.p34=this.snapshotOnce('snap:selfSubsystem.p34Personhood', ctx.selfSubsystem.p34Personhood);
    target.facets.embodiment.p35=this.snapshotOnce('snap:embodimentSubsystem.p35SemanticWorldBody', ctx.embodimentSubsystem.p35SemanticWorldBody);
    target.facets.embodiment.p37=this.snapshotOnce('snap:embodimentSubsystem.p37EmbodiedSensorium', ctx.embodimentSubsystem.p37EmbodiedSensorium);
    target.facets.learning.p38=this.snapshotOnce('snap:p38Research', ctx.p38Research);
    target.facets.learning.p39=this.snapshotOnce('snap:p39Life', ctx.p39Life);
    target.facets.learning.p40ModelEcology=this.snapshotOnce('snap:p40ModelEcology', ctx.p40ModelEcology);
    target.facets.embodiment.p40SemanticIntelligence=this.snapshotOnce('snap:embodimentSubsystem.p40SemanticIntelligence', ctx.embodimentSubsystem.p40SemanticIntelligence);
    target.facets.embodiment.p41SemanticPerception=this.snapshotOnce('snap:embodimentSubsystem.p41SemanticPerception', ctx.embodimentSubsystem.p41SemanticPerception);
    target.facets.embodiment.p41NativePerception=this.snapshotOnce('snap:embodimentSubsystem.p41NativePerception', ctx.embodimentSubsystem.p41NativePerception);
    target.facets.embodiment.p41TemporalPerception=this.snapshotOnce('snap:embodimentSubsystem.p41TemporalPerception', ctx.embodimentSubsystem.p41TemporalPerception);
    target.facets.embodiment.perceptualEvidence=this.snapshotOnce('snap:perceptualEvidence', ctx.perceptualEvidence);
    target.facets.advanced.groundedWorld=this.snapshotOnce('snap:worldSubsystem.groundedWorld', ctx.worldSubsystem.groundedWorld);
    target.facets.embodiment.p42Experience=this.snapshotOnce('snap:embodimentSubsystem.p42Experience', ctx.embodimentSubsystem.p42Experience);
    target.facets.embodiment.p43Imagery=this.snapshotOnce('snap:embodimentSubsystem.p43Imagery', ctx.embodimentSubsystem.p43Imagery);
    target.facets.learning.p44PredictiveWorld=this.snapshotOnce('snap:worldSubsystem.p44PredictiveWorld', ctx.worldSubsystem.p44PredictiveWorld);
    target.facets.evolution.selfProjects=this.snapshotOnce('snap:agencySubsystem.selfProjects', ctx.agencySubsystem.selfProjects);
    target.facets.evolution.agency=this.snapshotOnce('snap:agencySubsystem.deliberation', ctx.agencySubsystem.deliberation);
    target.facets.evolution.valueEvolution=this.snapshotOnce('snap:valueEvolution', ctx.valueEvolution);
    target.facets.evolution.identityTrajectory=this.snapshotOnce('snap:identityTrajectory', ctx.identityTrajectory);
    target.facets.evolution.narrative=this.snapshotOnce('snap:narrative', ctx.narrative);
    target.facets.evolution.developmentalAttractors=this.snapshotOnce('snap:developmentalAttractors', ctx.developmentalAttractors);
    target.facets.evolution.network=this.snapshotOnce('snap:cognitiveNetwork', ctx.cognitiveNetwork);
    target.facets.advanced.consequenceAttribution=this.snapshotOnce('snap:governanceSubsystem.selfGovernance', ctx.governanceSubsystem.selfGovernance).consequences.slice(0,256);
  }

  syncHot(target: PersistedOrganism, ctx: PersistenceProjectionContext): void {
    this.snapshotCache.clear();
    target.facets.memory.eventLog=ctx.memorySubsystem.events.recent(192);
    target.facets.memory.workspace=this.snapshotOnce('snap:memorySubsystem.workspaceV2', ctx.memorySubsystem.workspaceV2);
    target.facets.memory.semanticGraph=this.snapshotOnce('snap:memorySubsystem.semanticMemory', ctx.memorySubsystem.semanticMemory);
    target.facets.consciousness.identityContinuity=this.snapshotOnce('snap:selfSubsystem.identityContinuity', ctx.selfSubsystem.identityContinuity);
    target.facets.consciousness.metacognition=this.snapshotOnce('snap:metacognition', ctx.metacognition);
    target.facets.consciousness.p31=this.snapshotOnce('snap:selfSubsystem.p31Consciousness', ctx.selfSubsystem.p31Consciousness);
    target.facets.advanced.p48Awareness=this.snapshotOnce('snap:p48Awareness', ctx.p48Awareness);
    target.facets.advanced.p69ConstitutionalArbiter=this.snapshotOnce('snap:governanceSubsystem.p69ConstitutionalArbiter', ctx.governanceSubsystem.p69ConstitutionalArbiter);
    target.facets.advanced.p70MemoryLifecycleGovernor=this.snapshotOnce('snap:memorySubsystem.p70MemoryLifecycleGovernor', ctx.memorySubsystem.p70MemoryLifecycleGovernor);
    target.facets.advanced.p71SelfConsistency=this.snapshotOnce('snap:selfSubsystem.p71SelfConsistency', ctx.selfSubsystem.p71SelfConsistency);
    target.facets.advanced.p72LifeCycle=this.snapshotOnce('snap:governanceSubsystem.p72LifeCycle', ctx.governanceSubsystem.p72LifeCycle);
    target.facets.advanced.p73CapabilityLedger=this.snapshotOnce('snap:governanceSubsystem.p73CapabilityLedger', ctx.governanceSubsystem.p73CapabilityLedger);
    target.facets.advanced.p74IntegratedOrganismKernel=this.snapshotOnce('snap:p74IntegratedOrganismKernel', ctx.p74IntegratedOrganismKernel);
    target.facets.advanced.p75MemoryContinuumOS=this.snapshotOnce('snap:memorySubsystem.p75MemoryContinuumOS', ctx.memorySubsystem.p75MemoryContinuumOS);
    target.facets.advanced.p76IdentityLifeOS=this.snapshotOnce('snap:selfSubsystem.p76IdentityLifeOS', ctx.selfSubsystem.p76IdentityLifeOS);
    target.facets.advanced.p77RealityExperimentOS=this.snapshotOnce('snap:p77RealityExperimentOS', ctx.p77RealityExperimentOS);
    target.facets.advanced.p78AutobiographicalSelfContinuity=this.snapshotOnce('snap:selfSubsystem.p78AutobiographicalSelfContinuity', ctx.selfSubsystem.p78AutobiographicalSelfContinuity);
    target.facets.advanced.p79EmbodiedSituationModel=this.snapshotOnce('snap:worldSubsystem.p79EmbodiedSituationModel', ctx.worldSubsystem.p79EmbodiedSituationModel);
    target.facets.advanced.p80UnifiedSelfState=this.snapshotOnce('snap:selfSubsystem.p80UnifiedSelfState', ctx.selfSubsystem.p80UnifiedSelfState);
    target.facets.advanced.p81PredictiveAttention=this.snapshotOnce('snap:p81PredictiveAttention', ctx.p81PredictiveAttention);
    target.facets.advanced.p82RealityProgress=this.snapshotOnce('snap:p82RealityProgress', ctx.p82RealityProgress);
    target.facets.advanced.p83PersistentRealityModel=this.snapshotOnce('snap:worldSubsystem.p83PersistentReality', ctx.worldSubsystem.p83PersistentReality);
    target.facets.advanced.p84AutobiographicalContinuity=this.snapshotOnce('snap:selfSubsystem.p84AutobiographicalContinuity', ctx.selfSubsystem.p84AutobiographicalContinuity);

  }
  /** BIG PASS 58: owns the post-projection runtime/system snapshot mapping. */
  syncRuntimeSystemState(target: PersistedOrganism, ctx: PersistenceProjectionContext, continuity: any, replay: { deterministicSignature: string }): void {
    // Large developmental/neural states are projected once per checkpoint. Keeping
    // their detached snapshots out of the hot observation loop removes a major
    // allocation/GC source while preserving durable recovery semantics.
    const hotNeural=ctx.hotNeuralPersistence;
    if (hotNeural) {
      target.system.b385B390AutonomousDevelopmentalOrganism=hotNeural.b385B390AutonomousDevelopmentalOrganism;
      target.system.b391B400NeuralDevelopmentalIntegration=hotNeural.b391B400NeuralDevelopmentalIntegration;
      target.system.b401B420AdaptiveCognitiveResearch=hotNeural.b401B420AdaptiveCognitiveResearch;
      target.system.b421B450ResearchAcceleration=hotNeural.b421B450ResearchAcceleration;
      target.system.b451B500MetaCognitiveDevelopment=hotNeural.b451B500MetaCognitiveDevelopment;
      target.system.b501B560HierarchicalMetaMemory=hotNeural.b501B560HierarchicalMetaMemory;
      target.system.b561B620MetaCognitiveEvolution=hotNeural.b561B620MetaCognitiveEvolution;
      target.system.b621B720UnifiedAdaptiveMind=hotNeural.b621B720UnifiedAdaptiveMind;
      target.system.b721B900DevelopmentalLearning=hotNeural.b721B900DevelopmentalLearning;
      target.system.b901B1100CausalDevelopmentalMetaLearner=hotNeural.b901B1100CausalDevelopmentalMetaLearner;
      target.system.b1101B1350SelfDevelopment=hotNeural.b1101B1350SelfDevelopment;
      target.system.b1351B1600LifelongDevelopment=hotNeural.b1351B1600LifelongDevelopment;
      target.system.b1701B2200UnifiedLifeContinuity=hotNeural.b1701B2200UnifiedLifeContinuity;
      target.system.spikingPlasticNeuralB269=hotNeural.spikingPlasticNeuralB269;
      target.system.b2501DeepNeuralCausalBranch=hotNeural.b2501DeepNeuralCausalBranch;
      target.system.b2502EINeuralReplayField=hotNeural.b2502EINeuralReplayField;
      target.system.neuralPersonalityAgencyNucleusB296=hotNeural.neuralPersonalityAgencyNucleusB296;
      target.system.unifiedNeuroCausalCoreB365=hotNeural.unifiedNeuroCausalCoreB365;
    }
    // Reuse the per-checkpoint snapshot cache populated by sync(). Providers that
    // require sealing/capture are updated before the projection pass by OrganismCore.
    target.facets.learning.p29=this.snapshotOnce('snap:p29Learning', ctx.p29Learning);
    target.facets.learning.p30=this.snapshotOnce('snap:p30Continual', ctx.p30Continual);
    target.facets.learning.p36=this.snapshotOnce('snap:p36SelfDevelopment', ctx.p36SelfDevelopment);
    target.facets.embodiment.p35=this.snapshotOnce('snap:embodimentSubsystem.p35SemanticWorldBody', ctx.embodimentSubsystem.p35SemanticWorldBody);
    target.facets.embodiment.p37=this.snapshotOnce('snap:embodimentSubsystem.p37EmbodiedSensorium', ctx.embodimentSubsystem.p37EmbodiedSensorium);
    target.facets.embodiment.p40SemanticIntelligence=this.snapshotOnce('snap:embodimentSubsystem.p40SemanticIntelligence', ctx.embodimentSubsystem.p40SemanticIntelligence);
    target.facets.embodiment.p41SemanticPerception=this.snapshotOnce('snap:embodimentSubsystem.p41SemanticPerception', ctx.embodimentSubsystem.p41SemanticPerception);
    target.facets.embodiment.p41NativePerception=this.snapshotOnce('snap:embodimentSubsystem.p41NativePerception', ctx.embodimentSubsystem.p41NativePerception);
    target.facets.embodiment.p42Experience=this.snapshotOnce('snap:embodimentSubsystem.p42Experience', ctx.embodimentSubsystem.p42Experience);
    target.facets.embodiment.p43Imagery=this.snapshotOnce('snap:embodimentSubsystem.p43Imagery', ctx.embodimentSubsystem.p43Imagery);
    target.facets.learning.p40ModelEcology=this.snapshotOnce('snap:p40ModelEcology', ctx.p40ModelEcology);
    target.facets.learning.p44PredictiveWorld=this.snapshotOnce('snap:worldSubsystem.p44PredictiveWorld', ctx.worldSubsystem.p44PredictiveWorld);
    target.system.predictionLedger=this.snapshotOnce('snap:evidenceResearchSubsystem.predictionLedger', ctx.evidenceResearchSubsystem.predictionLedger);
    target.system.externalEvidenceTrust=this.snapshotOnce('snap:evidenceResearchSubsystem.externalEvidenceTrust', ctx.evidenceResearchSubsystem.externalEvidenceTrust);
    target.system.externalObserver=this.snapshotOnce('snap:evidenceResearchSubsystem.externalObserver', ctx.evidenceResearchSubsystem.externalObserver);
    target.system.selfPredictionBenchmark=this.snapshotOnce('snap:evidenceResearchSubsystem.selfPredictionBenchmark', ctx.evidenceResearchSubsystem.selfPredictionBenchmark);
    target.system.modelOlympics=this.snapshotOnce('snap:evidenceResearchSubsystem.modelOlympics', ctx.evidenceResearchSubsystem.modelOlympics);
    target.system.predictionDebt=this.snapshotOnce('snap:evidenceResearchSubsystem.predictionDebt', ctx.evidenceResearchSubsystem.predictionDebt);
    target.system.cognitiveQuorum=this.snapshotOnce('snap:agencySubsystem.quorum', ctx.agencySubsystem.quorum);
    target.system.shadowOrganism=this.snapshotOnce('snap:evidenceResearchSubsystem.shadowOrganism', ctx.evidenceResearchSubsystem.shadowOrganism);
    target.system.identityCausality=this.snapshotOnce('snap:evidenceResearchSubsystem.identityCausality', ctx.evidenceResearchSubsystem.identityCausality);
    target.system.longHorizonPrediction=this.snapshotOnce('snap:evidenceResearchSubsystem.longHorizonPrediction', ctx.evidenceResearchSubsystem.longHorizonPrediction);
    target.system.autonomousProjectExecutor=this.snapshotOnce('snap:agencySubsystem.projectExecutor', ctx.agencySubsystem.projectExecutor);
    target.system.skillAcquisitionBenchmark=this.snapshotOnce('snap:evidenceResearchSubsystem.skillAcquisitionBenchmark', ctx.evidenceResearchSubsystem.skillAcquisitionBenchmark);
    target.system.evidenceFirewall=this.snapshotOnce('snap:evidenceResearchSubsystem.evidenceFirewall', ctx.evidenceResearchSubsystem.evidenceFirewall);
    target.system.projectResearchSession=this.snapshotOnce('snap:evidenceResearchSubsystem.projectResearchSession', ctx.evidenceResearchSubsystem.projectResearchSession);
    target.system.cognitiveSpineSchedule=this.snapshotOnce('snap:cognitiveSpineScheduler', ctx.cognitiveSpineScheduler);
    target.system.cognitiveExecutionPlan=this.snapshotOnce('snap:cognitiveExecutionPlanner', ctx.cognitiveExecutionPlanner);
    target.system.advancedProjectionSchedule=this.snapshotOnce('snap:advancedProjectionScheduler', ctx.advancedProjectionScheduler);
    target.system.revisionGraph=ctx.revisionGraph.currentSnapshot();
    target.system.revisionTokens=this.snapshotOnce('snap:revisionTokens', ctx.revisionTokens);
    if (ctx.b333AutonomousGoalGenesis?.snapshot) target.system.b333AutonomousGoalGenesis=this.snapshotOnce('snap:b333AutonomousGoalGenesis', ctx.b333AutonomousGoalGenesis);
    if (ctx.b334AutonomousProjectLifecycle?.snapshot) target.system.b334AutonomousProjectLifecycle=this.snapshotOnce('snap:b334AutonomousProjectLifecycle', ctx.b334AutonomousProjectLifecycle);
    target.system.advancedProjectionScheduleMetrics=ctx.advancedProjectionScheduler.metrics(target.state.tick);
    if (ctx.memoryRetentionEconomy?.snapshot) target.system.memoryRetentionEconomy=this.snapshotOnce('snap:memoryRetentionEconomy', ctx.memoryRetentionEconomy);
    if (ctx.behavioralInfluenceLedger?.snapshot) target.system.behavioralInfluenceLedger=this.snapshotOnce('snap:behavioralInfluenceLedger', ctx.behavioralInfluenceLedger);
    if (ctx.emotionAppraisal?.snapshot) target.system.emotionAppraisal=this.snapshotOnce('snap:emotionAppraisal', ctx.emotionAppraisal);
    if (ctx.worldSubsystem?.worldModelEnsemble?.snapshot) target.system.worldModelEnsemble=this.snapshotOnce('snap:worldModelEnsemble', ctx.worldSubsystem.worldModelEnsemble);
    if (ctx.memoryCausalEconomy?.snapshot) target.system.memoryCausalEconomy=this.snapshotOnce('snap:memoryCausalEconomy', ctx.memoryCausalEconomy);
    if (ctx.activePerceptionExecutor?.snapshot) target.system.activePerceptionExecutor=this.snapshotOnce('snap:activePerceptionExecutor', ctx.activePerceptionExecutor);
    if (ctx.activePerceptionNeural?.snapshot) target.system.activePerceptionNeural=this.snapshotOnce('snap:activePerceptionNeural', ctx.activePerceptionNeural);
    if (ctx.worldCausalCalibration?.snapshot) target.system.worldCausalCalibration=this.snapshotOnce('snap:worldCausalCalibration', ctx.worldCausalCalibration);
    if (ctx.selfModelValidation?.snapshot) target.system.selfModelValidation=this.snapshotOnce('snap:selfModelValidation', ctx.selfModelValidation);
    if (ctx.failureRecoveryCertification?.snapshot) target.system.failureRecoveryCertification=this.snapshotOnce('snap:failureRecoveryCertification', ctx.failureRecoveryCertification);
    const canonicalNeuralSubstrate = ctx.canonicalNeuralSubstrate?.snapshot
      ? this.snapshotOnce('snap:canonicalNeuralSubstrate', ctx.canonicalNeuralSubstrate)
      : undefined;
    if (canonicalNeuralSubstrate !== undefined) target.system.canonicalNeuralSubstrate = canonicalNeuralSubstrate;
    if (ctx.neuralSubstrateBackend?.fullSnapshot) target.system.neuralSubstrateBackend = ctx.neuralSubstrateBackend.fullSnapshot(canonicalNeuralSubstrate);
    if (ctx.recurrentCausalMemory?.snapshot) target.system.recurrentCausalMemory=this.snapshotOnce('snap:recurrentCausalMemory', ctx.recurrentCausalMemory);
    target.system.continuity={...continuity};
    target.system.replaySignature=replay.deterministicSignature;
    target.system.lastReplayAt=Date.now();
  }

}
