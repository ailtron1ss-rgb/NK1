import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_REPOSITORY_ROOT = path.resolve(DEFAULT_RUNTIME_ROOT, '../..');

const group = (id, file, needles, purpose) => ({ id, file, needles, purpose });

export const SOURCE_ASSIMILATION_ADAPTERS = [
  {
    id: 'hexis',
    name: 'Hexis',
    mode: 'canonical-evidence-and-belief-adapter',
    benefit: 'Проверяемое происхождение фактов, пересмотр убеждений с аудитом, временная память и review; MemoryOS2 остаётся единственным владельцем канонической памяти.',
    groups: [
      group('adapter-implementation', 'src/organism/integration/hexis/HexisAdaptationFabric.ts', [
        'export class HexisAdaptationFabric', 'reviseBelief(', 'recordTemporalAssertion(', 'stageHmx(', 'grantConnectorPolicy(', 'restore(', 'snapshot()',
      ], 'Адаптер реализует ограниченные belief, temporal, review и connector contracts.'),
      group('system-composition', 'src/organism/core/OrganismSystemFabric.ts', [
        'new HexisAdaptationFabric()', 'this.hexisAdaptation.snapshot()', 'this.hexisAdaptation.restore(system.hexisAdaptation)',
      ], 'Адаптер создаётся и управляется composition root, а не отдельным heartbeat.'),
      group('canonical-evidence-bridge', 'src/organism/integration/hexis/HexisCanonicalEvidenceBridge.ts', [
        'export class HexisCanonicalEvidenceBridge', 'recordSourceTrace(', 'recordP65Claim(',
      ], 'Связывает SourceMonitor/P65 с MemoryFabric через provenance gate.'),
      group('memory-subsystem-wiring', 'src/organism/core/MemorySubsystemRuntime.ts', [
        'new HexisCanonicalEvidenceBridge(this.fabric, this.sourceMonitor, this.p65EpistemicLedger)',
        'this.sourceMonitor.restore(advanced.hexisSourceMonitor ?? advanced.sourceMonitor)',
        'hexisSourceMonitor:this.sourceMonitor.snapshot()',
      ], 'Использует канонический MemoryFabric и сохраняемый SourceMonitor.'),
      group('core-provenance-gate', 'src/organism/core/OrganismCore.ts', [
        'hexisIngestEvidenceLineage(', 'source-content-fingerprint-mismatch',
        'this.memorySubsystem.hexisCanonicalEvidenceBridge.recordSourceTrace(memoryId, id)',
      ], 'Проверяет lineage/provenance до записи evidence в каноническую память.'),
      group('adaptation-contract-tests', 'tests/integration/hexis-adaptation.mjs', [
        'assert.equal(duplicate.applied, false)', "assert.equal(blockedContradiction.reason, 'protected')",
        "assert.equal(outConflict.error,'idempotency-key-conflict')",
      ], 'Проверяет deduplication, защищённые убеждения и idempotency.'),
      group('evidence-bridge-tests', 'tests/integration/hexis-canonical-evidence-bridge.mjs', [
        'assert.equal(first.accepted, true)', 'provenance ingestion must not change belief confidence',
        'p65-content-fingerprint-mismatch', 'runtime snapshot/restore',
      ], 'Проверяет provenance, spoof/replay, fingerprint и восстановление.'),
    ],
  },
  {
    id: 'letta',
    name: 'Letta',
    mode: 'reference-governance-only',
    benefit: 'Даёт NK1 governance-контракты для границ исходников, телеметрии и проверки артефактов; не создаёт вторую archival/core memory и не импортирует Letta runtime.',
    groups: [
      group('adapter-implementation', 'src/organism/integration/letta/LettaGovernanceAdaptationFabric.ts', [
        'export class LettaGovernanceAdaptationFabric', 'sourceBoundary(', 'setTelemetryPolicy(', 'canPromoteGeneratedArtifact(', 'restore(', 'snapshot()',
      ], 'Ограниченный governance adapter; в самом исходнике указан reference-only режим.'),
      group('system-composition', 'src/organism/core/OrganismSystemFabric.ts', [
        'new LettaGovernanceAdaptationFabric()', 'this.lettaGovernanceAdaptation.snapshot()',
        'this.lettaGovernanceAdaptation.restore(system.lettaGovernanceAdaptation)',
      ], 'Композиция и восстановление управляются общим system fabric.'),
      group('persisted-state-contract', 'src/organism/core/OrganismCore.ts', [
        'lettaGovernanceAdaptation?: LettaGovernanceAdaptationState;',
        'defaultLettaGovernanceAdaptationState()',
      ], 'Состояние имеет типизированную persisted-проекцию и начальное значение.'),
      group('contract-tests', 'tests/integration/letta-governance-adaptation.mjs', [
        'defaultLettaGovernanceAdaptationState()', 'canPromoteGeneratedArtifact', 'auditProvenancePaths',
      ], 'Проверяет происхождение артефактов и блокирование чувствительных путей.'),
    ],
  },
  {
    id: 'lumina',
    name: 'Lumina',
    mode: 'capability-search-idempotency-adapter',
    benefit: 'Повторно использует компактные механизмы policy/capability, точного поиска и idempotency; даёт безопасные интерфейсные швы без копирования Python-приложения или голосовых assets.',
    groups: [
      group('adapter-implementation', 'src/organism/integration/lumina/LuminaAdaptationFabric.ts', [
        'export class LuminaAdaptationFabric', 'authorizeCapability(', 'validateWebTarget(', 'beginIdempotent(', 'search(', 'restore(', 'snapshot()',
      ], 'Проверяет capabilities, targets, exact search и идемпотентность.'),
      group('system-composition', 'src/organism/core/OrganismSystemFabric.ts', [
        'new LuminaAdaptationFabric()', 'this.luminaAdaptation.snapshot()', 'this.luminaAdaptation.restore(system.luminaAdaptation)',
      ], 'Адаптер не запускает конкурирующий lifecycle.'),
      group('persisted-state-contract', 'src/organism/core/OrganismCore.ts', [
        'luminaAdaptation?: LuminaAdaptationState;', 'defaultLuminaAdaptationState()',
      ], 'Состояние адаптера проходит через system snapshot.'),
      group('contract-tests', 'tests/integration/lumina-adaptation.mjs', [
        'Lumina idempotency prevents duplicate application', 'requires explicit confirmation',
        'private-or-special-address',
      ], 'Проверяет idempotency, подтверждение и блокирование loopback/private targets.'),
    ],
  },
  {
    id: 'will',
    name: 'Will',
    mode: 'agency-attention-adapter',
    benefit: 'Добавляет проверяемые контракты ранжирования, transport/replay, hash-chain, vector recall и attribution; неподтверждённые исходы не должны повышать competence.',
    groups: [
      group('adapter-implementation', 'src/organism/integration/will/WillIntegrationBridge.ts', [
        'export class WillIntegrationBridge', 'rankCandidates(', 'recordLanguageCompletion(', 'verifyRecordChain(', 'snapshot()', 'restore(',
      ], 'Содержит ограниченные agency/transport/vector механизмы.'),
      group('system-composition', 'src/organism/core/OrganismSystemFabric.ts', [
        'new WillIntegrationBridge()', 'this.willIntegration.snapshot()', 'this.willIntegration.restore(system.willIntegration)',
      ], 'Composition root владеет жизненным циклом и checkpoint.'),
      group('persisted-state-contract', 'src/organism/core/OrganismCore.ts', [
        'willIntegration?: WillIntegrationState;', 'defaultWillIntegrationState()',
      ], 'Состояние WILL имеет типизированную persisted-проекцию.'),
      group('contract-tests', 'tests/integration/will-integration-bridge.mjs', [
        'ranks candidates deterministically', 'tamper-evident chain detects digest corruption',
        'unverified success cannot inflate WILL competence',
      ], 'Проверяет детерминизм, tamper detection, restore и trust boundary.'),
    ],
  },
  {
    id: 'mem0',
    name: 'Mem0',
    mode: 'optional-external-recall-adapter',
    benefit: 'Дополнительный retrieval подключается только явным opt-in, ограничен тремя кандидатами и остаётся недоверенным контекстом; MemoryOS2 не делегирует ему владение памятью.',
    groups: [
      group('adapter-implementation', 'src/organism/integration/mem0/Mem0PlatformAdapter.ts', [
        'export class Mem0PlatformAdapter', 'static fromEnvironment(', 'redactMem0Text(', 'async search(', 'this.enabled = options.enabled === true',
        'this.allowWrites = options.allowWrites === true',
      ], 'Адаптер ограничивает сетевые ответы, redaction, timeout и отдельный write opt-in.'),
      group('runtime-opt-in-and-budget', 'src/organism/core/OrganismRuntime.ts', [
        'mem0CognitiveRecall?: boolean', 'this.mem0CognitiveRecallEnabled = config.mem0CognitiveRecall === true',
        '!this.mem0CognitiveRecallEnabled', 'this.mem0Adapter.search(query, 3)',
        'External memory must never prevent a local-first response.',
      ], 'Внешний recall выключен по умолчанию, bounded и best-effort.'),
      group('canonical-memory-firewall-tests', 'tests/mem0-runtime-wiring.mjs', [
        'remote recall needs a separate explicit runtime opt-in', 'remote recall must be capped at three candidates',
        'external candidates must not be silently re-ingested as canonical recall',
        'the adapter must be disabled by default',
      ], 'Проверяет opt-in, лимит и запрет превращать внешние кандидаты в канонические факты.'),
      group('platform-and-oss-contract-tests', 'tests/mem0-platform-adapter-workpass1.mjs', [
        'Mem0PlatformAdapter', 'writes-disabled', 'consent-required',
      ], 'Проверяет platform adapter и ограничения изменяющих операций.'),
      group('oss-contract-tests', 'tests/mem0-oss-adapter-workpass2.mjs', [
        'Mem0PlatformAdapter', 'mem0-oss',
      ], 'Проверяет отдельный OSS режим и его provenance.'),
    ],
  },
  {
    id: 'llama.cpp',
    name: 'llama.cpp',
    mode: 'optional-schema-constrained-local-output',
    benefit: 'Использует поддерживаемый llama-server response_format/json_schema в уже существующем loopback-провайдере; P23 получает структурно ограниченный candidate, но не может обойти независимую оценку и promotion gate.',
    groups: [
      group('provider-schema-boundary', 'src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts', [
        'export interface LocalChatResponseFormat', "type: 'json_object' | 'json_schema'", 'function normalizeResponseFormat(', 'MAX_RESPONSE_SCHEMA_BYTES', 'json_schema: { schema: format.schema as Record<string, unknown> }', 'response_format: responseFormat',
      ], 'Добавляет ограниченное server-side JSON/JSON Schema decoding без новой зависимости или нового provider owner.'),
      group('p23-source-shape-constraint', 'src/organism/learning/P23LocalModelSkillRevisionGenerator.ts', [
        'function buildPayloadJsonSchema(', 'MAX_JSON_SCHEMA_DEPTH', 'additionalProperties: false',
        "responseFormat: { type: 'json_schema', schema: buildPayloadJsonSchema(request.sourcePayload) }",
      ], 'Выводит shape-only schema из подтверждённого исходного payload; поля сохраняются, значения могут изменяться.'),
      group('provider-contract-tests', 'tests/local-chat-provider-workpass40.mjs', [
        'llama-server requires response_format.json_schema.schema', '/response-schema-circular/', '/response-schema-accessor-rejected/',
      ], 'Проверяет формат запроса, цикл и отказ без вызова getter.'),
      group('p23-generator-contract-tests', 'tests/p23-local-model-skill-revision-generator.mjs', [
        'server-side constrained JSON decoding', 'exact source payload shape',
      ], 'Проверяет, что generator передаёт schema, не раскрывает holdout и не меняет promotion authority.'),
    ],
  },
  {
    id: 'dspy-gepa',
    name: 'DSPy / GEPA',
    mode: 'optional-validation-only-candidate-sidecar',
    benefit: 'Возвращает один изменённый skill payload, сохраняя независимую P23 evaluation, candidate staging, signed shadow evidence и promotion authority; sidecar выключен по умолчанию.',
    groups: [
      group('candidate-adapter', 'src/organism/learning/GepaReflectiveCandidateGenerator.ts', [
        'export class GepaReflectiveCandidateGenerator', "NK1_GEPA_ENABLED === '1'",
        'holdoutResultsIncluded: false', 'holdoutCaseIdentifiersIncluded: false',
        "activationAuthority: 'NK1-P23'", 'SAFE_DIRECTIVES', 'assertSourcePayloadShape',
      ], 'Проецирует только validation rows, allowlists evidence IDs, заменяет caller directives на фиксированные инструкции, ограничивает transport и возвращает только candidatePayload.'),
      group('server-composition', 'src/server/server.mjs', [
        'GepaReflectiveCandidateGenerator.fromEnvironment()', 'GEPA_CANDIDATE_STATUS.enabled',
        'asP23RevisionGenerator()', 'generateLocalSkillRevision(LLAMA_CPP_PROVIDER, request)',
        'GEPA sidecar opt-in requires the trusted P23 compound repair revision provider module',
      ], 'Включается только вместе с доверенной P23 composition; при выключении остаётся локальный llama.cpp generator.'),
      group('holdout-firewall', 'src/organism/learning/SkillRevisionPlan.ts', [
        'void holdout', 'Build all generator-facing prose exclusively from validation observations.',
        'Do not copy fitness.reasons/feedback', 'fitness.validationTaskRegressions',
      ], 'Holdout продолжает блокировать promotion/safety, но его значения и направление не попадают в generator-facing targets или rationale.'),
      group('holdout-firewall-regression', 'tests/p23-revision-plan-holdout-isolation.mjs', [
        'changing only holdout outcomes, scores, reasons and feedback must not change any generator-facing content',
        'SECRET_HOLDOUT', 'P23_REVISION_PLAN_HOLDOUT_ISOLATION=PASS',
      ], 'Противоположные holdout результаты при одинаковой validation выборке должны давать идентичный план генерации.'),
      group('sidecar-transport-contract', 'tests/gepa-reflective-candidate-generator.mjs', [
        'holdoutResultsIncluded', 'holdoutResultsIncluded', 'candidate payload cannot drop source fields',
        'real loopback HTTP roundtrip reaches the P23 callback', 'GEPA_REFLECTIVE_CANDIDATE_GENERATOR=PASS',
      ], 'Проверяет HTTPS/loopback, bounds, no holdout leakage, candidate-only response и реальный loopback P23 handoff.'),
      group('validation-metric-builder', 'src/organism/learning/P23ValidationCandidateParetoArchive.ts', [
        'buildP23ValidationCandidateMetrics', 'MAX_VALIDATION_TRIALS', 'safetyCompliance01',
        'p23-validation-metrics-duplicate-trial', 'isValidP23ValidationCandidateMetrics',
      ], 'Сохраняет детерминированные task-level validation vectors без holdout полей и с provenance по task/trial.'),
      group('per-example-pareto-dominance', 'src/organism/learning/P23ValidationCandidateParetoArchive.ts', [
        'dominatesP23ValidationCandidate', 'computeP23ValidationParetoFront', 'sameTaskCohort',
        'p23-validation-pareto-task-cohort-mismatch',
      ], 'Pareto dominance сравнивает все objective × task пары; несопоставимые task cohorts не ранжируются.'),
      group('versioned-store-pareto-index', 'src/organism/learning/VersionedSkillCandidateStore.ts', [
        'validationParetoFront(', 'computeP23ValidationParetoFront(comparable)', 'revisionProvenance.validationMetrics',
      ], 'Pareto front вычисляется read-only из единственного versioned candidate owner, без второй skill library.'),
      group('durable-validation-vector-guard', 'src/organism/learning/AtomicFileSkillStorePersistence.ts', [
        'isValidP23ValidationCandidateMetrics', 'revisionProvenance.validationMetrics', 'persisted versioned skill store snapshot',
      ], 'Durable restore/CAS отвергает некорректные или подменённые validation vectors.' ),
      group('p23-fresh-candidate-quality-gate', 'src/organism/learning/P23LearningEngine.ts', [
        'fitness.eligible !== true', 'buildP23ValidationCandidateMetrics(candidateEvaluation.validation)',
        'reflectiveCandidateValidationParetoFront(', 'independent validation/holdout gate',
      ], 'Только свежий кандидат, прошедший собственный независимый gate, может попасть в versioned store; archive получает validation only.'),
      group('pareto-lifecycle-regression-contract', 'tests/p23-validation-candidate-pareto-archive.mjs', [
        'P23_VALIDATION_CANDIDATE_PARETO_ARCHIVE=PASS',
        'freshly generated candidates that fail the independent paired gate must not be staged',
        'only validation reports are persisted in versioned candidate provenance',
      ], 'Проверяет complementarity, dominance, gate-before-stage, holdout exclusion и durable metrics linkage.'),
    ],
  },
];

export const REQUIRED_ARCHIVE_SOURCES = [
  'Agent0', 'AutoGPT', 'Microsoft Agent Framework', 'AutoGen', 'Chroma', 'DSPy', 'FAISS',
  'Hermes Agent', 'Hyperon', 'Langroid', 'Letta', 'llama.cpp', 'Mem0', 'OpenAI Agents Python',
  'OpenClaw', 'Hexis', 'PocketFlow', 'Lumina', 'CAMEL OWL', 'Superpowers', 'Will',
];

const REQUIRED_LICENSE_GUARDS = ['Polyform Shield', 'CC BY 4.0', 'корневой LICENSE'];

async function readUtf8(file) {
  try {
    return { content: await readFile(file, 'utf8'), error: null };
  } catch (error) {
    return { content: '', error: error?.code === 'ENOENT' ? 'missing-file' : String(error?.message ?? error) };
  }
}

export async function auditSourceAssimilation(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  const runtimeRoot = path.join(repositoryRoot, 'runtime', 'neuro-kurisu');
  const results = [];
  const findings = [];
  let totalGroups = 0;
  let passedGroups = 0;
  let presentTests = 0;
  let expectedTestFiles = 0;

  for (const adapter of SOURCE_ASSIMILATION_ADAPTERS) {
    const adapterGroups = [];
    for (const item of adapter.groups) {
      totalGroups += 1;
      const filePath = path.join(runtimeRoot, item.file);
      const file = await readUtf8(filePath);
      const missing = item.needles.filter(needle => !file.content.includes(needle));
      const passed = file.error === null && missing.length === 0;
      if (passed) passedGroups += 1;
      else findings.push({
        adapter: adapter.id,
        check: item.id,
        file: path.relative(repositoryRoot, filePath),
        error: file.error,
        missing,
      });
      if (item.id.includes('test')) {
        expectedTestFiles += 1;
        if (passed) presentTests += 1;
      }
      adapterGroups.push({
        id: item.id,
        path: path.relative(repositoryRoot, filePath),
        passed,
        missing,
        purpose: item.purpose,
      });
    }
    const complete = adapterGroups.every(item => item.passed);
    results.push({
      id: adapter.id,
      name: adapter.name,
      mode: adapter.mode,
      benefit: adapter.benefit,
      status: complete ? 'WIRED_STATICALLY' : 'GAP',
      groups: adapterGroups,
    });
  }

  const registerPath = path.join(repositoryRoot, 'docs', 'SOURCE_ASSIMILATION_REGISTER_2026-11-13_RU.md');
  const register = await readUtf8(registerPath);
  const missingSources = REQUIRED_ARCHIVE_SOURCES.filter(name => !register.content.includes(name));
  const missingLicenseGuards = REQUIRED_LICENSE_GUARDS.filter(needle => !register.content.includes(needle));
  const sourceRegisterPassed = register.error === null && missingSources.length === 0 && missingLicenseGuards.length === 0;
  if (!sourceRegisterPassed) findings.push({
    adapter: 'source-register',
    check: 'inventory-and-license-guard',
    file: path.relative(repositoryRoot, registerPath),
    error: register.error,
    missing: [...missingSources, ...missingLicenseGuards],
  });

  const staticCoveragePct = totalGroups === 0 ? 0 : Math.round((passedGroups / totalGroups) * 100);
  const summary = {
    adapters: results.length,
    adaptersComplete: results.filter(item => item.status === 'WIRED_STATICALLY').length,
    staticGroupsPassed: passedGroups,
    staticGroupsTotal: totalGroups,
    staticCoveragePct,
    contractTestFilesPresent: presentTests,
    contractTestFilesExpected: expectedTestFiles,
    sourceRegisterPassed,
    sourceNamesPresent: REQUIRED_ARCHIVE_SOURCES.length - missingSources.length,
    sourceNamesExpected: REQUIRED_ARCHIVE_SOURCES.length,
    gaps: findings.length,
    executedTests: false,
    releaseVerification: false,
  };

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    scope: 'Static source-contract audit only. It verifies code wiring and test-file presence; it does not execute tests, prove upstream code lineage, grant license clearance, or certify a release.',
    summary,
    sourceRegister: {
      path: path.relative(repositoryRoot, registerPath),
      passed: sourceRegisterPassed,
      missingSources,
      missingLicenseGuards,
    },
    adapters: results,
    findings,
  };
}

async function main() {
  const report = await auditSourceAssimilation();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('SOURCE_ASSIMILATION_AUDIT=' + (report.summary.gaps === 0 ? 'PASS' : 'FAIL'));
    console.log('ADAPTERS=' + report.summary.adaptersComplete + '/' + report.summary.adapters);
    console.log('STATIC_COVERAGE=' + report.summary.staticGroupsPassed + '/' + report.summary.staticGroupsTotal + ' (' + report.summary.staticCoveragePct + '%)');
    console.log('CONTRACT_TEST_FILES=' + report.summary.contractTestFilesPresent + '/' + report.summary.contractTestFilesExpected + ' (presence only; not executed)');
    console.log('SOURCE_REGISTER=' + report.summary.sourceNamesPresent + '/' + report.summary.sourceNamesExpected + ' names; license guards=' + (report.summary.sourceRegisterPassed ? 'PASS' : 'FAIL'));
    for (const adapter of report.adapters) {
      console.log(adapter.id.toUpperCase() + '=' + adapter.status + ' groups=' + adapter.groups.filter(item => item.passed).length + '/' + adapter.groups.length + ' mode=' + adapter.mode);
    }
    for (const finding of report.findings) {
      console.error('GAP ' + finding.adapter + '/' + finding.check + ' file=' + finding.file + ' missing=' + (finding.missing || []).join(','));
    }
    console.log('NOTE: static wiring is not evidence that tests ran or that any donor source code was copied.');
  }
  if (report.summary.gaps > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('SOURCE_ASSIMILATION_AUDIT=ERROR ' + String(error?.stack ?? error));
    process.exitCode = 1;
  });
}
