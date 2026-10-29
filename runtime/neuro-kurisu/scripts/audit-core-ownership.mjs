import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getCountedDirectConstructorOwners } from './core-ownership-policy.mjs';

const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const agency = await readFile(new URL('../src/organism/core/AgencySubsystemRuntime.ts', import.meta.url), 'utf8');
const research = await readFile(new URL('../src/organism/core/EvidenceResearchSubsystemRuntime.ts', import.meta.url), 'utf8');
const self = await readFile(new URL('../src/organism/core/SelfSubsystemRuntime.ts', import.meta.url), 'utf8');
const governance = await readFile(new URL('../src/organism/core/GovernanceSubsystemRuntime.ts', import.meta.url), 'utf8');
const memory = await readFile(new URL('../src/organism/core/MemorySubsystemRuntime.ts', import.meta.url), 'utf8');
const world = await readFile(new URL('../src/organism/core/WorldSubsystemRuntime.ts', import.meta.url), 'utf8');
const embodiment = await readFile(new URL('../src/organism/core/EmbodimentSubsystemRuntime.ts', import.meta.url), 'utf8');

const moved = [
  ['SelfProjectEngine', core, agency], ['AgencyDeliberationEngine', core, agency], ['CognitiveBudgetManager', core, agency], ['CognitiveQuorumEngine', core, agency], ['AutonomousProjectExecutor', core, agency], ['MultiProjectScheduler', core, agency],
  ['PredictionLedger', core, research], ['ExternalEvidenceTrustEngine', core, research], ['ExternalProjectResearchTool', core, research], ['EvidenceFirewallEngine', core, research], ['ProjectResearchSession', core, research], ['SkillAcquisitionBenchmark', core, research], ['SelfPredictionBenchmark', core, research], ['ModelOlympics', core, research], ['PredictionDebtEngine', core, research], ['ShadowOrganismEngine', core, research], ['IdentityCausalityGraphEngine', core, research], ['LongHorizonPredictionBenchmark', core, research],
  ['P48FunctionalAwarenessCore', core, self], ['P49TemporalLifeEngine', core, self],
  ['IdentityContinuityEngine', core, self], ['SelfAuthorshipEngine', core, self], ['P31FunctionalConsciousnessEngine', core, self], ['P32CausalSelfModelEngine', core, self], ['P33PersonhoodCore', core, self], ['P34CausalPersonhoodEngine', core, self], ['P60IdentityGuardian', core, self], ['P71SelfConsistencyModel', core, self], ['P76IdentityLifeOS', core, self], ['P78AutobiographicalSelfContinuity', core, self], ['P80UnifiedSelfState', core, self],
  ['CapabilityRegistry', core, governance], ['IntegritySentinel', core, governance], ['ReplayEngine', core, governance], ['AdvancedResilienceEngine', core, governance], ['P69ConstitutionalArbiter', core, governance], ['P72LifeCycleOrchestrator', core, governance], ['P73CapabilityEvolutionLedger', core, governance], ['SelfGovernanceEngine', core, governance],
  ['EventLog', core, memory], ['MultiTimescaleMemory', core, memory], ['AutobiographicalMemory', core, memory], ['SelfModelEngine', core, memory], ['SocialWorldModel', core, memory], ['ValuePlasticity', core, memory], ['RecurrentWorkspaceV2', core, memory], ['SemanticMemoryGraph', core, memory], ['MemoryOS2', core, memory], ['MemorySubstrateCoordinator', core, memory], ['UnifiedMemorySystem', core, memory], ['P47TemporalMemoryMind', core, memory], ['P59MemoryOperatingSystem', core, memory], ['P62MemoryFabric', core, memory], ['P65EpistemicLedger', core, memory], ['P70MemoryLifecycleGovernor', core, memory], ['P75MemoryContinuumOS', core, memory],
  ['P66InteroceptiveHomeostasis', core, embodiment],
  ['P38AutonomousCausalResearchEngine', core, research], ['P53DevelopmentalSelfModificationLab', core, research],
  ['P67AutonomousGoalGenesis', core, agency], ['P68GoalEcology', core, agency],
  ['WorldModel', core, world], ['ActiveInferenceEngine', core, world], ['LearnedResidualWorldModel', core, world], ['ContextualWorldModel', core, world], ['WorldModel2', core, world], ['P24WorldIdentityEngine', core, world], ['P27NeuralWorldFoundation', core, world], ['P44EmbodiedPredictiveSelfWorld', core, world], ['P50CausalSelfWorldEngine', core, world], ['P51GroundedCausalWorkspace', core, world], ['P52CounterfactualDevelopmentMind', core, world], ['P57RealityFirstObservatory', core, world], ['P79EmbodiedSituationModel', core, world],
  ['MultimodalPerception', core, embodiment], ['PerceptionEngine', core, embodiment], ['P35SemanticWorldBodyEngine', core, embodiment], ['P37EmbodiedSensoriumEngine', core, embodiment], ['P40SemanticIntelligenceEngine', core, embodiment], ['P41SemanticPerceptionEngine', core, embodiment], ['P41NativePerceptionEngine', core, embodiment], ['P41TemporalPerceptionModel', core, embodiment], ['P42UnifiedEmbodiedExperienceEngine', core, embodiment], ['P43EmbodiedImageryWorkspace', core, embodiment],
];
const errors=[];

// Regression guard: only the exact documented field+constructor pair is exempt.
// Same field with another type and same type under another field both count.
const ownershipPolicyProbe = [
  { field: 'operationalMicroCycle', constructor: 'OperationalMicroCycleRuntime' },
  { field: 'operationalMicroCycle', constructor: 'UnexpectedRuntime' },
  { field: 'renamedOperationalMicroCycle', constructor: 'OperationalMicroCycleRuntime' },
  { field: 'ordinaryOwner', constructor: 'OtherRuntime' },
];
assert.deepEqual(
  getCountedDirectConstructorOwners(ownershipPolicyProbe),
  ownershipPolicyProbe.slice(1),
  'only the exact documented orchestration owner may be exempt from the constructor ceiling',
);

const extractedFieldOwners = [
  ...['p54LongHorizonEvidence','p55DevelopmentalForkUniverse','p56IntegratedDevelopmentalMind','p58CognitiveKernel','p61IntegratedMind','p63DevelopmentalOperatingSystem','p64IntegratedOrganismDynamics','p74IntegratedOrganismKernel','p81PredictiveAttention','autonomousPersonhood','identityContinuityGuard','autonomousValueFormation','autobiographicalLifeNarrative','p39Life','p40ModelEcology'].map(field=>[field,self,'self']),
  ...['b306AutonomousInitiativeVerification','b333AutonomousGoalGenesis','b334AutonomousProjectLifecycle','b335AutonomousProjectHoldout','b336ProjectCausalOwnership','decisionActionPipeline','longHorizonAutonomy','autonomousResourceToolLife','autonomousRuntimeLife','selfDirectedLife','autonomousLearningMemory','autonomousRelationships','openEndedSkillAcquisition','autonomousSocialInitiative','liveSelfImprovementSupervisor'].map(field=>[field,agency,'agency']),
  ...['memoryRetentionEconomy','memoryCausalEconomy','causalLifeGraph','memoryWorldCausalBridge'].map(field=>[field,memory,'memory']),
  ...['interoceptiveStateEstimator','activePerceptionExecutor','activePerceptionNeural','perceptualEvidence','cameraEvidence'].map(field=>[field,embodiment,'embodiment']),
  ...['worldCausalCalibration','worldAgencyLearningCausalBridge','derivedWorldPreviewCache'].map(field=>[field,world,'world']),
  ...['p77RealityExperimentOS','p82RealityProgress'].map(field=>[field,research,'research']),
  ...['behavioralInfluenceLedger','realityEvidenceLedger','selfModelValidation','failureRecoveryCertification','cognitiveDomainClosure','causalDomainClosureLedger'].map(field=>[field,governance,'governance']),
  ...['cognitiveEventFabric','cognitiveResourceEconomy','unifiedCognitiveCycle','emotionAppraisal','cognitiveExecutionPlanner','temporalResolutionGovernor','cognitiveKernelCoordinator','cognitiveSubsystemRegistry'].map(field=>[field,null,'cognitiveRuntime']),
];
for(const [field, ownerText, ownerName] of extractedFieldOwners){
  if(new RegExp(`(?:^|\n)\\s*(?:private\\s+)?(?:readonly\\s+)?${field}\\s*=`, 'm').test(core)) errors.push(`core-still-declares-extracted-field:${field}`);
  const owner = ownerText ?? (await readFile(new URL('../src/organism/core/CognitiveRuntimeCluster.ts', import.meta.url), 'utf8'));
  if(!new RegExp(`(?:^|\n)\\s*(?:readonly\\s+)?${field}\\s*=`, 'm').test(owner) && !new RegExp(`(?:^|\n)\\s*(?:readonly\\s+)?${field}\\s*[:=]`, 'm').test(owner)) errors.push(`runtime-missing-extracted-field:${ownerName}:${field}`);
}
for(const [name, coreText, ownerText] of moved){
  if(new RegExp(`new\\s+${name}\\s*\\(`).test(coreText)) errors.push(`core-still-instantiates:${name}`);
  if(!new RegExp(`new\\s+${name}\\s*\\(`).test(ownerText)) errors.push(`owner-missing-constructor:${name}`);
}
const fabricText=await readFile(new URL('../src/organism/core/OrganismSystemFabric.ts', import.meta.url), 'utf8');
if(!/new\s+OrganismSystemFabric\s*\(/.test(core)) errors.push('organism-system-fabric-missing');
for(const owner of ['SelfSubsystemRuntime','GovernanceSubsystemRuntime','MemorySubsystemRuntime','WorldSubsystemRuntime','EmbodimentSubsystemRuntime','AgencySubsystemRuntime','EvidenceResearchSubsystemRuntime']){
  if(!new RegExp(`new\\s+${owner}\\s*\\(`).test(fabricText)) errors.push(`fabric-missing-constructor:${owner}`);
}

const extractedRuntimes=[
  ['DevelopmentalNeuralRuntime','../src/organism/core/DevelopmentalNeuralRuntime.ts'],
  ['CognitiveRuntimeCluster','../src/organism/core/CognitiveRuntimeCluster.ts'],
  ['PersistenceRuntime','../src/organism/core/PersistenceRuntime.ts'],
];
for(const [runtimeName, runtimePath] of extractedRuntimes){
  const runtimeText=await readFile(new URL(runtimePath, import.meta.url), 'utf8');
  if(!new RegExp(`new\\s+${runtimeName}\\s*\\(`).test(core)) errors.push(`core-missing-runtime-owner:${runtimeName}`);
  const constructors=[...runtimeText.matchAll(/^\s+(?:readonly\s+)?[A-Za-z_$][\w$]*\s*=\s*new\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m=>m[1]);
  for(const ctor of new Set(constructors)){
    const directOwnerPattern=new RegExp('^\\s*(?:private\\s+)?(?:readonly\\s+)?[A-Za-z_$][A-Za-z0-9_$]*\\s*=\\s*new\\s+'+ctor+'\\s*\\(','m');
    if(directOwnerPattern.test(core)) errors.push(`core-still-owns-extracted-constructor:${runtimeName}:${ctor}`);
  }
}
const coreDirectConstructorOwners=[...core.matchAll(/^\s*(?:private\s+)?(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*=\s*new\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m=>({field:m[1],constructor:m[2]}));
const coreDirectConstructors=coreDirectConstructorOwners.length;
// The exception is an exact field+constructor pair, not a field-name-only bypass.
const countedDirectConstructorOwners = getCountedDirectConstructorOwners(coreDirectConstructorOwners);
const countedDirectConstructors = countedDirectConstructorOwners.length;
if(countedDirectConstructors > 5) errors.push(`core-direct-constructors-too-many:${countedDirectConstructors}`);
console.log(`CORE_OWNERSHIP=${errors.length?'FAIL':'PASS'} errors=${errors.length} directConstructors=${coreDirectConstructors} countedDirectConstructors=${countedDirectConstructors} exemptOrchestrationOwner=operationalMicroCycle:OperationalMicroCycleRuntime countedDirectConstructorOwners=${JSON.stringify(countedDirectConstructorOwners)} directConstructorOwners=${JSON.stringify(coreDirectConstructorOwners)}`);
if(errors.length){for(const e of errors) console.log(`ERROR=${e}`); process.exit(1);}
