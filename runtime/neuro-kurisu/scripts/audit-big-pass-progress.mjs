import fs from 'node:fs';
const version=JSON.parse(fs.readFileSync(path.join(process.cwd(),'VERSION.json'),'utf8'));
import path from 'node:path';

const root=process.cwd();
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const checks=[
  ['P40 circuit breaker fields',/cooldownUntil|consecutiveFailures/.test(read('src/organism/learning/P40ModelEcology.ts'))],
  ['P40 legacy-safe restore',/configured:x\.configured \?\? x\.available/.test(read('src/organism/learning/P40ModelEcology.ts'))],
  ['Adaptive sensor schedule',/p\.sampleDelayMs/.test(read('src/organism/core/OrganismRuntime.ts'))],
  ['Runtime evidence bus',fs.existsSync(path.join(root,'src/organism/system/RuntimeEvidenceBus.ts'))],
  ['Runtime evidence API',/runtime-control|\/api\/runtime\/evidence/.test(read('src/server/server.mjs'))],
  ['Process CPU pressure signal',/cpuUsage/.test(read('src/organism/body/AndroidEmbodimentBridge.ts'))],
  ['Telemetry stale age',/staleMs: (?:androidFresh|Math\.max)/.test(read('src/organism/body/AndroidEmbodimentBridge.ts'))],
  ['Screen override contract',/NEURO_SCREEN_INTERACTIVE/.test(read('src/organism/body/AndroidEmbodimentBridge.ts'))],
  ['P41 coarse spectral analysis',/goertzel/.test(read('src/organism/cognition/P41NativePerception.ts'))],
  ['P41 spatial edge analysis',/edgeSum|edgeCount/.test(read('src/organism/cognition/P41NativePerception.ts'))],
  ['Project tool executor retry state',/canAttempt\(tick/.test(read('src/organism/system/AutonomousProjectExecutor.ts')) && /observeToolResult/.test(read('src/organism/system/AutonomousProjectExecutor.ts'))],
  ['Project tool budget gate',/executeProjectTool[\s\S]*cognitiveBudget/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Runtime evidence lightweight metrics',/metrics\(\)/.test(read('src/organism/system/RuntimeEvidenceBus.ts'))],
  ['Termux API install dependency',/termux-api -y/.test(read('scripts/termux/install-from-download.sh'))],
  ['Release version synchronized',read('VERSION.json').includes(version.application)],
  ['Regression test registered',/test:big-pass-38/.test(read('package.json'))],
  ['Budget/evidence regression test',fs.existsSync(path.join(root,'tests/big-pass-36-budget-evidence.mjs'))],
  ['Prediction improvement metric',/improvement01|baselineKindError01/.test(read('src/organism/system/PredictionLedger.ts'))],
  ['P65 prediction semantics fixed',/predicted01\?:number/.test(read('src/organism/memory/P65EpistemicLedger.ts')) && /claim\.predicted01/.test(read('src/organism/memory/P65EpistemicLedger.ts'))],
  ['P65 belief lifecycle',/expireBeliefs|supportBelief/.test(read('src/organism/memory/P65EpistemicLedger.ts'))],
  ['Evidence lineage integrity',/lineageIntegrity01|danglingParentLinks/.test(read('src/organism/system/RuntimeEvidenceBus.ts'))],
  ['Evidence persistence restore',/runtimeEvidence|setRuntimeEvidence/.test(read('src/organism/core/OrganismCore.ts')) && /evidenceBus\.restore/.test(read('src/organism/core/OrganismRuntime.ts'))],
  ['Shared budget execution',/cognitiveBudgetSpend\('llm|cognitiveBudgetSpend\('planning/.test(read('src/organism/core/OrganismRuntime.ts'))],
  ['Facade boundary introduced',fs.existsSync(path.join(root,'src/organism/core/CognitiveSubsystemFacade.ts'))],
  ['Balanced directory fsync',/directoryFsyncEverySaves|strictDirectoryFsync/.test(read('src/organism/persistence/FileStateStore.ts'))],
  ['Evidence bus test',fs.existsSync(path.join(root,'tests/big-pass-35-hardening.mjs'))],
  ['Evidence trust engine',fs.existsSync(path.join(root,'src/organism/system/ExternalEvidenceTrust.ts'))],
  ['Self prediction benchmark',fs.existsSync(path.join(root,'src/organism/system/SelfPredictionBenchmark.ts')) && /selfPredictionBenchmark/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Model Olympics runtime',fs.existsSync(path.join(root,'src/organism/system/ModelOlympics.ts')) && /modelOlympics\.scoreRound/.test(read('src/organism/core/OrganismCore.ts')) && /modelOlympics\.calibrate/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Project milestones',/requiredEvidenceClass|replicatedEvidenceCount|milestones: SelfProjectMilestone\[\]|validatedEvidenceCount/.test(read('src/organism/cognition/evolution/SelfProjectEngine.ts'))],
  ['Project external validation wiring',/externalEvidence01:\s*projectEvidenceExternal/.test(read('src/organism/core/OrganismCore.ts')) && /evidenceSource/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Project evidence regression test',fs.existsSync(path.join(root,'tests/p67-project-evidence.mjs'))],
  ['Self prediction calibration corrected',/Math\.abs\(\(1-mismatch\)-confidence\)/.test(read('src/organism/cognition/SelfModelV2.ts'))],
  ['Prediction debt lifecycle',fs.existsSync(path.join(root,'src/organism/system/PredictionDebt.ts')) && /predictionDebt/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Cognitive quorum runtime',fs.existsSync(path.join(root,'src/organism/system/CognitiveQuorum.ts')) && (/cognitiveQuorum\.evaluate/.test(read('src/organism/core/OrganismCore.ts')) || /agencySubsystem\.quorum/.test(read('src/organism/core/OrganismCore.ts')))],
  ['Shadow organism runtime',fs.existsSync(path.join(root,'src/organism/system/ShadowOrganism.ts')) && /shadowOrganism\.decide/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Identity causality graph',fs.existsSync(path.join(root,'src/organism/system/IdentityCausalityGraph.ts')) && /identityCausality\.observe/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Long-horizon 1/4/12 benchmark',fs.existsSync(path.join(root,'src/organism/system/LongHorizonPredictionBenchmark.ts')) && /\[1,4,12\]/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Autonomous project executor',fs.existsSync(path.join(root,'src/organism/system/AutonomousProjectExecutor.ts')) && (/autonomousProjectExecutor\.observe/.test(read('src/organism/core/OrganismCore.ts')) || /agencySubsystem\.projectExecutor/.test(read('src/organism/core/OrganismCore.ts')))],
  ['Project skill promotion wiring',/skillPromoted/.test(read('src/organism/system/AutonomousProjectExecutor.ts')) && /skillRecord\?\.status === 'habit'/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Project external evidence strictness',/projectEvidenceExternal/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Project tool event type',/'project-tool-execution'/.test(read('src/organism/memory/EventSourcing.ts'))],
  ['Project tool API bridge',/projects\/tool/.test(read('src/server/server.mjs')) && /executeProjectTool/.test(read('src/organism/core/OrganismRuntime.ts')) && /projectAllowed/.test(read('src/organism/system/ActionGateway.ts'))],
  ['Active project API',/projects\/active/.test(read('src/server/server.mjs')) && /activeProjectSnapshot/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Simulator is not external truth',/projectEvidenceExternal = externalEvidenceSources\.includes/.test(read('src/organism/core/OrganismCore.ts')) && /source:p57External\?'external-feedback':'unknown'/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 39 spine regression test',fs.existsSync(path.join(root,'tests/big-pass-39-cognitive-spine.mjs')) && fs.existsSync(path.join(root,'tests/big-pass-39-reality-boundary.mjs'))],
  ['BIG PASS 39 package script',/test:big-pass-39/.test(read('package.json'))],
  ['BIG PASS 38 regression test',fs.existsSync(path.join(root,'tests/big-pass-38-autonomous-spine.mjs'))],
  ['Per-tick model cache',/modelSignalsByAction/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Shared P24 body forecast cache',/p24BodyForecast5/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Shared P26 loss snapshot',/p26RecentLoss01/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Shared P44 experience vector',/p44ExperienceVector/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Adaptive perception cadence',/perceptionRefresh/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Cold perception reuse',/p41TemporalPerception \?\?/.test(read('src/organism/core/OrganismCore.ts')) || /p41NativePerception \?\?/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Duplicate runtime evidence snapshot removed',((read('src/organism/core/OrganismRuntime.ts').match(/setRuntimeEvidence\(this\.evidenceBus\.snapshot\(\)\)/g)||[]).length)<=1],
  ['BIG PASS 41 performance test',fs.existsSync(path.join(root,'tests/big-pass-41-performance-spine.mjs'))],
  ['BIG PASS 41 package script',/test:big-pass-41/.test(read('package.json'))],
  ['Current release contract synchronized',read('src/organism/system/ReleaseContract.ts').includes(version.application) && JSON.parse(read('package-lock.json')).version===version.application],
];
checks.push(
  ['BIG PASS 43 performance test',fs.existsSync(path.join(root,'tests/big-pass-43-performance-cache.mjs'))],
  ['BIG PASS 43 project persistence test',fs.existsSync(path.join(root,'tests/project-execution-persistence.mjs'))],
  ['Operational snapshot gating',/resultMode !== 'operational'[\s\S]*p69ConstitutionalArbiter/.test(read('src/organism/core/OrganismCore.ts'))],
  ['EventLog readonly slice',/recent\(n=64, clone=true\)/.test(read('src/organism/memory/EventSourcing.ts'))],
  ['Project preferred tool',/preferredTool\?: string/.test(read('src/organism/system/AutonomousProjectExecutor.ts'))],
  ['Project context tool',/organism\.project\.context/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Project evidence tool',/organism\.project\.evidence/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Automatic project step API',/executeNextProjectStep/.test(read('src/organism/core/OrganismCore.ts')) && /projects\/step/.test(read('src/server/server.mjs')) && /executeNextProjectStep/.test(read('src/organism/core/OrganismRuntime.ts'))],
  ['Semantic-memory scoping fixed',/memorySubsystem\.semanticMemory/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Current release source truth', JSON.parse(read('VERSION.json')).version === JSON.parse(read('package.json')).version && JSON.parse(read('package-lock.json')).version === JSON.parse(read('VERSION.json')).version && read('src/organism/system/ReleaseContract.ts').includes(`application: '${JSON.parse(read('VERSION.json')).version}'`)],
  ['P49 episode token cache',/episodeTokens|tokensForEpisode/.test(read('src/organism/developmental/P49TemporalLifeEngine.ts'))],
  ['Durable-only integrity hashing',/hash:fullProjection/.test(read('src/organism/core/OrganismCore.ts')) && /hash\?: boolean/.test(read('src/organism/system/IntegritySentinel.ts'))],
  ['Bounded governance history with totals',/totalRecords|totalConsequences/.test(read('src/organism/cognition/evolution/SelfGovernanceEngine.ts')) && /slice\(0, 160\)/.test(read('src/organism/cognition/evolution/SelfGovernanceEngine.ts'))],
  ['P52 bounded counterfactual history',/slice\(-160\)|slice\(0,128\)/.test(read('src/organism/world/P52CounterfactualDevelopmentMind.ts'))],
  ['Compatibility memory cadence',/compatibilityRefresh/.test(read('src/organism/core/OrganismCore.ts')) && /state\.tick % 8 === 0/.test(read('src/organism/core/OrganismCore.ts'))],
  ['P50/P51 no-clone hot path',/clone:false/.test(read('src/organism/core/OrganismCore.ts')) && /options\.clone===false/.test(read('src/organism/world/P50CausalSelfWorldEngine.ts')) && /options\.clone===false/.test(read('src/organism/world/P51GroundedCausalWorkspace.ts'))],
  ['MemoryOS hot encode no-clone',/options:\{clone\?:boolean\}/.test(read('src/organism/developmental/MemoryOS2.ts')) && /clone:false/.test(read('src/organism/core/OrganismCore.ts'))],
  ['1000-cycle mobile stability test',fs.existsSync(path.join(root,'tests/long-horizon-operational-1000.mjs')) && /test:long-horizon:operational:1000/.test(read('package.json'))],
  ['Integrity hash preservation test',fs.existsSync(path.join(root,'tests/integrity-stamp-options.mjs'))],
  ['Governance retention regression test',fs.existsSync(path.join(root,'tests/big-pass-45-retention-governance.mjs'))],
  ['Multi-project scheduler',fs.existsSync(path.join(root,'src/organism/system/MultiProjectScheduler.ts')) && (/multiProjectScheduler\.choose/.test(read('src/organism/core/OrganismCore.ts')) || /agencySubsystem\.projectScheduler/.test(read('src/organism/core/OrganismCore.ts')))],
  ['Multi-project selection boundary',/activeProjects\(\)/.test(read('src/organism/cognition/evolution/SelfProjectEngine.ts')) && /selectProject\(projectId/.test(read('src/organism/cognition/evolution/SelfProjectEngine.ts'))],
  ['Project switch event lineage',/'project-switch'/.test(read('src/organism/memory/EventSourcing.ts')) && /events\.append\(makeEvent\('project-switch'/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Project continuity hysteresis',/continuity-hysteresis|0\.04/.test(read('src/organism/system/MultiProjectScheduler.ts'))],
  ['Project wall-clock recency',/86_400_000/.test(read('src/organism/system/MultiProjectScheduler.ts')) && /at\?: number/.test(read('src/organism/system/MultiProjectScheduler.ts'))],
  ['Model Olympics decay',/\.985/.test(read('src/organism/system/ModelOlympics.ts')) && /rolling memory/.test(read('src/organism/system/ModelOlympics.ts'))],
  ['BIG PASS 46 regression test',fs.existsSync(path.join(root,'tests/big-pass-46-multi-project-models.mjs'))],
  ['BIG PASS 46 package script',/test:big-pass-46/.test(read('package.json'))],
  ['Forensics absolute-path false-positive fixed',/\(\?:\^\|\[\\s/.test(read('scripts/audit-forensics.mjs'))],
);

checks.push(
  ['BIG PASS 47 external project research tool',fs.existsSync(path.join(root,'src/organism/system/ExternalProjectResearchTool.ts')) && /project\.external\.research/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Project network HTTPS + allowlist gate',/only-https-allowed|host-not-allowlisted|hostIsUnsafe/.test(read('src/organism/system/ExternalProjectResearchTool.ts'))],
  ['Project network size/timeout bound',/maxBytes|timeoutMs|response-too-large|network-timeout/.test(read('src/organism/system/ExternalProjectResearchTool.ts'))],
  ['Project network private-host protection',/private-host-blocked|redirect-not-accepted/.test(read('src/organism/system/ExternalProjectResearchTool.ts'))],
  ['Project research evidence wiring',/externalEvidence:Boolean\(result\.result\?\.externalEvidence\)/.test(read('src/organism/core/OrganismCore.ts')) && /source:'external-api'/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Skill acquisition benchmark',fs.existsSync(path.join(root,'src/organism/system/SkillAcquisitionBenchmark.ts')) && /skillAcquisitionBenchmark\.observe/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Skill benchmark persistence',/skillAcquisitionBenchmark/.test(read('src/organism/core/OrganismCore.ts')) && /skillAcquisitionBenchmark/.test(read('src/organism/persistence/StateMigrations.ts'))],
  ['Subsystem registry boundary',fs.existsSync(path.join(root,'src/organism/core/CognitiveSubsystemRegistry.ts')) && /cognitiveSubsystemRegistry/.test(read('src/organism/core/OrganismCore.ts'))],
  ['Subsystem registry health API',/cognitiveSubsystemHealth/.test(read('src/organism/core/OrganismCore.ts')) && /organism\/subsystems/.test(read('src/server/server.mjs'))],
  ['Project step explicit input bridge',/executeNextProjectStep\(reason = 'project-step', input:Record/.test(read('src/organism/core/OrganismCore.ts')) && /toolInput/.test(read('src/organism/system/AutonomousProjectExecutor.ts'))],
  ['BIG PASS 47 external/skill regression tests',fs.existsSync(path.join(root,'tests/big-pass-47-external-skill.mjs')) && fs.existsSync(path.join(root,'tests/big-pass-47-integration.mjs'))],
  ['BIG PASS 47 subsystem regression test',fs.existsSync(path.join(root,'tests/subsystem-registry.mjs'))],
);

checks.push(
  ['BIG PASS 48 Evidence Firewall',fs.existsSync(path.join(root,'src/organism/system/EvidenceFirewall.ts')) && /quarantine|independentSources|promoted/.test(read('src/organism/system/EvidenceFirewall.ts'))],
  ['BIG PASS 48 multi-source research session',fs.existsSync(path.join(root,'src/organism/system/ProjectResearchSession.ts')) && /independentSources|promoted/.test(read('src/organism/system/ProjectResearchSession.ts'))],
  ['BIG PASS 48 dependency-inverted ports',/CognitiveSubsystemAccessors/.test(read('src/organism/core/CognitiveSubsystemPorts.ts')) && !/import type \{ OrganismCore \}/.test(read('src/organism/core/CognitiveSubsystemPorts.ts'))],
  ['BIG PASS 48 firewall persistence',/evidenceFirewall|projectResearchSession/.test(read('src/organism/core/OrganismCore.ts')) && /evidenceFirewall|projectResearchSession/.test(read('src/organism/persistence/StateMigrations.ts'))],
  ['BIG PASS 48 research second source',/NEURO_PROJECT_RESEARCH_URL_2|researchSeed2/.test(read('src/organism/system/AutonomousProjectExecutor.ts'))],
  ['BIG PASS 48 source/content identity split',/contentHash.*sourceKey|sourceKey.*contentHash/.test(read('src/organism/system/EvidenceFirewall.ts'))],
  ['BIG PASS 48 contradiction retention',/contentHash.*at|contested/.test(read('src/organism/system/EvidenceFirewall.ts'))],
  ['BIG PASS 48 public ingestion',/ingestExternalProjectResearch/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 48 firewall regression tests',fs.existsSync(path.join(root,'tests/big-pass-48-firewall.mjs')) && fs.existsSync(path.join(root,'tests/big-pass-48-persistence.mjs'))],
  ['BIG PASS 48 subsystem regression test',fs.existsSync(path.join(root,'tests/big-pass-48-subsystem-ports.mjs'))],
  ['BIG PASS 48 package script',/test:big-pass-48/.test(read('package.json'))],
  ['BIG PASS 48 historical schema reference',/stateSchema=92|state schema.*92/.test(read('docs/BIG_PASS_48_AUDIT_REPORT_RU.md'))],
  ['BIG PASS 48 proof-carrying receipt',/promotionReceipt/.test(read('src/organism/system/EvidenceFirewall.ts')) && fs.existsSync(path.join(root,'tests/big-pass-48-proof-receipt.mjs'))]
);

checks.push(
  ['BIG PASS 49 Agency physical owner',fs.existsSync(path.join(root,'src/organism/core/AgencySubsystemRuntime.ts')) && /SelfProjectEngine|AgencyDeliberationEngine|AutonomousProjectExecutor|MultiProjectScheduler/.test(read('src/organism/core/AgencySubsystemRuntime.ts'))],
  ['BIG PASS 49 Evidence/Research physical owner',fs.existsSync(path.join(root,'src/organism/core/EvidenceResearchSubsystemRuntime.ts')) && /PredictionLedger|EvidenceFirewallEngine|ProjectResearchSession|ModelOlympics/.test(read('src/organism/core/EvidenceResearchSubsystemRuntime.ts'))],
  ['BIG PASS 49 Core ownership audit',fs.existsSync(path.join(root,'scripts/audit-core-ownership.mjs'))],
  ['BIG PASS 49 Facade inversion',fs.existsSync(path.join(root,'scripts/audit-facade-dependency.mjs')) && !/from ['\"].*OrganismCore/.test(read('src/organism/core/CognitiveSubsystemFacade.ts'))],
  ['BIG PASS 49 temporal session duplicate regression',fs.existsSync(path.join(root,'tests/big-pass-49-subsystem-extraction.mjs')) && /endTemporalSession/.test(read('tests/big-pass-49-subsystem-extraction.mjs'))],
  ['BIG PASS 49 Project DAG ready nodes',fs.existsSync(path.join(root,'tests/big-pass-49-project-dag.mjs')) && /dependsOn|ready/.test(read('src/organism/system/AutonomousProjectExecutor.ts'))],
  ['BIG PASS 49 PID scoped P11',/process\.pid/.test(read('tests/p11-integration.mjs'))],
  ['BIG PASS 49 public core exports physical runtimes',/AgencySubsystemRuntime|EvidenceResearchSubsystemRuntime/.test(read('src/organism/core/index.ts'))],
  ['BIG PASS 49 physical subsystem release preserved', fs.existsSync(path.join(root,'RELEASE_NOTES_34.30.0_RU.md')) && /BIG PASS 49/.test(read('docs/BIG_PASS_49_AUDIT_REPORT_RU.md'))],
  ['BIG PASS 49 historical schema reference',/schema 92|stateSchema.?92/.test(read('docs/BIG_PASS_49_AUDIT_REPORT_RU.md')) || fs.existsSync(path.join(root,'RELEASE_NOTES_34.30.0_RU.md'))],
  ['BIG PASS 49 current release docs',fs.existsSync(path.join(root,'docs/BIG_PASS_49_AUDIT_REPORT_RU.md')) && fs.existsSync(path.join(root,'docs/FIRST_AUDIT_FULL_CROSSWALK_BIG_PASS_49_RU.md') )]
);

checks.push(
  ['BIG PASS 50 CognitiveFrame',fs.existsSync(path.join(root,'src/organism/core/CognitiveFrame.ts')) && /buildCognitiveFrame/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 50 Execution Planner',fs.existsSync(path.join(root,'src/organism/core/CognitiveExecutionPlanner.ts')) && /cognitiveExecutionPlanner/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 50 verification semantics',/verified:verification\.verified/.test(read('src/organism/system/ActionGateway.ts'))],
  ['BIG PASS 51 Self physical owner',fs.existsSync(path.join(root,'src/organism/core/SelfSubsystemRuntime.ts')) && /SelfAuthorshipEngine|P80UnifiedSelfState/.test(read('src/organism/core/SelfSubsystemRuntime.ts')) && !/new SelfAuthorshipEngine\(/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 51 Governance physical owner',fs.existsSync(path.join(root,'src/organism/core/GovernanceSubsystemRuntime.ts')) && /CapabilityRegistry|SelfGovernanceEngine/.test(read('src/organism/core/GovernanceSubsystemRuntime.ts')) && !/new CapabilityRegistry\(/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 51 Memory physical owner',fs.existsSync(path.join(root,'src/organism/core/MemorySubsystemRuntime.ts')) && /MemoryOS2|P62MemoryFabric/.test(read('src/organism/core/MemorySubsystemRuntime.ts')) && !/new MemoryOS2\(/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 51 World physical owner',fs.existsSync(path.join(root,'src/organism/core/WorldSubsystemRuntime.ts')) && /WorldModel|P27NeuralWorldFoundation/.test(read('src/organism/core/WorldSubsystemRuntime.ts')) && !/new WorldModel\(/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 51 Embodiment physical owner',fs.existsSync(path.join(root,'src/organism/core/EmbodimentSubsystemRuntime.ts')) && /MultimodalPerception|P41NativePerceptionEngine/.test(read('src/organism/core/EmbodimentSubsystemRuntime.ts')) && !/new MultimodalPerception\(/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 51 Flight Recorder',fs.existsSync(path.join(root,'src/organism/core/SubsystemFlightRecorder.ts')) && /flightRecorder/.test(read('src/organism/core/CognitiveSubsystemRegistry.ts'))],
  ['BIG PASS 51 Organism Metabolism',/CognitiveOrganismMetabolism|metabolism:defaultMetabolism/.test(read('src/organism/core/CognitiveExecutionPlanner.ts'))],
  ['BIG PASS 51 seven-domain ownership',/\['self','world','memory','agency','embodiment','research','governance'\]/.test(read('src/organism/core/CognitiveSubsystemRegistry.ts'))],
);


checks.push(
  ['BIG PASS 52 Memory Fabric coordinator',fs.existsSync(path.join(root,'src/organism/memory/MemoryFabric.ts')) && /class MemoryFabric/.test(read('src/organism/memory/MemoryFabric.ts')) && /single durable authority/.test(read('src/organism/memory/MemoryFabric.ts'))],
  ['BIG PASS 52 Core uses Fabric retrieval',/memorySubsystem\.fabric\.retrieve/.test(read('src/organism/core/OrganismCore.ts')) && /memorySubsystem\.fabric\.recall/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 52 Core uses Fabric encode/maintenance',/memorySubsystem\.fabric\.encode/.test(read('src/organism/core/OrganismCore.ts')) && /memorySubsystem\.fabric\.maintain/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 52 Memory index',/tokenIndex|retrievalDiagnostics/.test(read('src/organism/developmental/MemoryOS2.ts'))],
  ['BIG PASS 52 Memory Fabric regression',fs.existsSync(path.join(root,'tests/big-pass-52-memory-fabric.mjs')) && fs.existsSync(path.join(root,'tests/big-pass-52-memory-index.mjs'))],
  ['BIG PASS 52 package scripts',/test:big-pass-52-memory-fabric/.test(read('package.json')) && /test:big-pass-52-memory-index/.test(read('package.json'))],
  ['BIG PASS 52 release source synchronized',JSON.parse(read('VERSION.json')).application===JSON.parse(read('package.json')).version && /MemoryOS2/.test(read('src/organism/memory/MemoryFabric.ts'))],
);

checks.push(
  ['BIG PASS 56 system fabric',fs.existsSync(path.join(root,'src/organism/core/OrganismSystemFabric.ts')) && /OrganismSystemFabric/.test(read('src/organism/core/OrganismSystemFabric.ts'))],
  ['BIG PASS 56 core physical ownership',!/new\s+(SelfSubsystemRuntime|GovernanceSubsystemRuntime|MemorySubsystemRuntime|WorldSubsystemRuntime|EmbodimentSubsystemRuntime|AgencySubsystemRuntime|EvidenceResearchSubsystemRuntime)\s*\(/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 56 moved self organs',/p48Awareness|p49TemporalLife/.test(read('src/organism/core/SelfSubsystemRuntime.ts'))],
  ['BIG PASS 56 moved agency organs',/p67AutonomousGoalGenesis|p68GoalEcology/.test(read('src/organism/core/AgencySubsystemRuntime.ts'))],
  ['BIG PASS 56 moved research organs',/p38Research|p53DevelopmentalSelfModification/.test(read('src/organism/core/EvidenceResearchSubsystemRuntime.ts'))],
  ['BIG PASS 56 moved embodiment organ',/p66InteroceptiveHomeostasis/.test(read('src/organism/core/EmbodimentSubsystemRuntime.ts'))],
);

checks.push(
  ['BIG PASS 59 System Contract cache', fs.existsSync(path.join(root,'tests/big-pass-59-system-contract-cache.mjs')) && /resolvedContracts/.test(read('src/organism/core/OrganismSystemFabric.ts'))],
  ['BIG PASS 59 projection reuse test', fs.existsSync(path.join(root,'tests/big-pass-59-projection-reuse.mjs'))],
  ['BIG PASS 59 shared projection context', /const projectionContext = this\.projectionContext\(\);/.test(read('src/organism/core/OrganismCore.ts')) && /syncRuntimeSystemState\(this\.persisted, projectionContext/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 59 runtime snapshots use cache', /snapshotOnce\('snap:p30Continual'/.test(read('src/organism/core/PersistenceProjectionCoordinator.ts')) && /snapshotOnce\('snap:worldSubsystem.p44PredictiveWorld'/.test(read('src/organism/core/PersistenceProjectionCoordinator.ts'))],
  ['BIG PASS 59 P29/P37 pre-projection capture', /p29Learning\.captureLastKnownGood/.test(read('src/organism/core/OrganismCore.ts')) && /p37EmbodiedSensorium\.sealHash/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 59 release documentation', fs.existsSync(path.join(root,'docs/BIG_PASS_59_AUDIT_REPORT_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_59_PLAN_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_59_PROGRESS_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_59_VERIFICATION_RU.md'))],
  ['BIG PASS 59 package scripts', /test:big-pass-59/.test(read('package.json')) && /audit:pass59/.test(read('package.json'))],
  ['BIG PASS 59 release history preserved', fs.existsSync(path.join(root,'RELEASE_NOTES_34.30.0_RU.md')) && /34\.30\.0/.test(read('RELEASE_NOTES_34.30.0_RU.md'))]
);

checks.push(
  ['BIG PASS 61 Shadow Cognition',fs.existsSync(path.join(root,'src/organism/system/ShadowOrganism.ts')) && /ensembleDisagreement01|entropy01|escalation/.test(read('src/organism/system/ShadowOrganism.ts'))],
  ['BIG PASS 61 selective deep routing',/shadowEscalation/.test(read('src/organism/core/CognitiveExecutionPlanner.ts'))],
  ['BIG PASS 61 pressure integration',/shadowDisagreement01|shadowEscalation01/.test(read('src/organism/cognition/CognitivePressureField.ts'))],
  ['BIG PASS 61 immediate persistence',/if \(shadowDecision\) this\.persisted\.system\.shadowOrganism/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 61 regression tests',fs.existsSync(path.join(root,'tests/big-pass-61-shadow-cognition.mjs')) && fs.existsSync(path.join(root,'tests/big-pass-61-shadow-core-e2e.mjs'))],
  ['BIG PASS 61 release docs',fs.existsSync(path.join(root,'docs/BIG_PASS_61_AUDIT_REPORT_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_61_PLAN_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_61_PROGRESS_RU.md'))],
);

checks.push(
  ['BIG PASS 60 world fabric', fs.existsSync(path.join(root,'src/organism/core/WorldSubsystemRuntime.ts')) && /observeGroundedContext/.test(read('src/organism/core/WorldSubsystemRuntime.ts')) && /predictIntegrated/.test(read('src/organism/core/WorldSubsystemRuntime.ts')) && /evaluateAction/.test(read('src/organism/core/WorldSubsystemRuntime.ts')) && /observeActionOutcome/.test(read('src/organism/core/WorldSubsystemRuntime.ts'))],
  ['BIG PASS 60 passive world learning', /observePassiveTransition\(before:WorldContext,after:WorldContext\)/.test(read('src/organism/developmental/WorldModel2.ts')) && /observePassiveTransition\(beforeLatent,p27Latent\)/.test(read('src/organism/core/WorldSubsystemRuntime.ts'))],
  ['BIG PASS 60 core world delegation', /worldSubsystem\.observeGroundedContext/.test(read('src/organism/core/OrganismCore.ts')) && /worldSubsystem\.evaluateAction/.test(read('src/organism/core/OrganismCore.ts')) && /worldSubsystem\.observeActionOutcome/.test(read('src/organism/core/OrganismCore.ts'))],
  ['BIG PASS 60 model disagreement signal', /world-model-disagreement/.test(read('src/organism/core/OrganismCore.ts')) && /modelAgreement01/.test(read('src/organism/core/WorldSubsystemRuntime.ts'))],
  ['BIG PASS 60 regression tests', fs.existsSync(path.join(root,'tests/big-pass-60-core-world-loop.mjs')) && fs.existsSync(path.join(root,'tests/big-pass-60-learned-world-fabric.mjs')) && fs.existsSync(path.join(root,'tests/big-pass-60-world-fabric-performance.mjs'))],
  ['BIG PASS 60 package scripts', /test:big-pass-60/.test(read('package.json')) && /audit:pass60/.test(read('package.json'))],
  ['BIG PASS 60 historical release preserved', fs.existsSync(path.join(root,'RELEASE_NOTES_34.31.0_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_60_AUDIT_REPORT_RU.md'))],
  ['BIG PASS 60 release documentation', fs.existsSync(path.join(root,'docs/BIG_PASS_60_AUDIT_REPORT_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_60_PLAN_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_60_PROGRESS_RU.md')) && fs.existsSync(path.join(root,'docs/BIG_PASS_60_VERIFICATION_RU.md'))]
);

const done=checks.filter(([,ok])=>ok).length;
const percent=Math.round(done/checks.length*100);
console.log(`BIG_PASS_PROGRESS=${percent} checks=${done}/${checks.length}`);
for(const [label,ok] of checks) console.log(`${ok?'PASS':'TODO'} ${label}`);
