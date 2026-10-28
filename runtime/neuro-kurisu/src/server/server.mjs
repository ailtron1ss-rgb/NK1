import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync as fsExistsSync, statSync as fsStatSync, readdirSync as fsReaddirSync, readFileSync as fsReadFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OrganismRuntime } from '../organism/core/OrganismRuntime.ts';
import { Mem0PlatformAdapter } from '../organism/integration/mem0/Mem0PlatformAdapter.ts';
import { P23LearningEngine } from '../organism/learning/P23LearningEngine.ts';
import { createNativeCompoundRepairRevisionProvider } from '../organism/learning/P23CompoundRepairRevisionProvider.ts';
import { createHostOwnedIndependentEvaluationConfigFactory } from '../organism/learning/HostOwnedIndependentEvaluationServices.ts';
import { createIndependentEvaluationConfigFactory, parseCompoundRepairBackgroundRevisionConfig } from './compound-repair-revision-host-config.mjs';
import { GepaReflectiveCandidateGenerator } from '../organism/learning/GepaReflectiveCandidateGenerator.ts';
import { generateLocalSkillRevision } from '../organism/learning/P23LocalModelSkillRevisionGenerator.ts';
import { createVerifiedSkillLifecycleBootstrap } from '../organism/learning/VerifiedSkillLifecycleBootstrap.ts';
import { parseTrustedShadowLearningScheduleConfig } from '../organism/learning/P23TrustedShadowLearningScheduler.ts';
import { createSkillPromotionApprovalPayload, createSkillRollbackApprovalPayload, parseTrustedSkillPromotionApprovalKeys } from '../organism/learning/AuthenticatedSkillPromotionApproval.ts';
import { ProcessLock } from '../organism/persistence/ProcessLock.ts';
import { FileStateStore } from '../organism/persistence/FileStateStore.ts';
import { idempotencyPreflightHttpStatus } from './idempotency-response.mjs';
import { LocalLanguageBackendPolicy } from './local-language-backend-policy.mjs';
import { RELEASE_CONTRACT } from '../organism/system/ReleaseContract.ts';
import { resolvePhonePolicyConfig } from '../organism/system/PhoneRuntimePolicy.ts';
import { authorizeApiRequest } from '../organism/system/ApiSecurityPolicy.ts';
import { GeminiVisionSemanticBackend } from '../organism/body/GeminiVisionSemanticBackend.ts';
import { OpenAICompatibleLocalChatProvider } from '../organism/integration/local/OpenAICompatibleLocalChatProvider.ts';
import { WillSdkFacade } from '../organism/integration/will/WillSdkFacade.ts';
import { WillMcpJsonRpcServer } from '../organism/integration/will/WillMcpJsonRpc.ts';
import { WillChannelAdapter } from '../organism/integration/will/WillChannelAdapter.ts';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC = path.join(ROOT, 'public');
const STATE = path.resolve(process.env.STATE_DIR || path.join(ROOT, 'state'));
const stateFile = path.join(STATE, 'organism-core.json');
const worldFile = path.join(STATE, 'organism-world.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const KOBOLD_URL = String(process.env.KOBOLD_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 15000);
const LLAMA_CPP_PROVIDER = new OpenAICompatibleLocalChatProvider({ baseUrl: process.env.LLAMA_CPP_URL, model: process.env.LLAMA_CPP_MODEL || 'local-model', timeoutMs: LLM_TIMEOUT_MS });
const LOCAL_LANGUAGE_BACKEND_POLICY = new LocalLanguageBackendPolicy();
// Server-only provider instance; the adapter remains disabled unless explicitly opted in.
const MEM0_MEMORY_ADAPTER = Mem0PlatformAdapter.fromEnvironment();
const REQUEST_TIMEOUT_MS = Math.max(5000, Number(process.env.NEURO_REQUEST_TIMEOUT_MS || 45000));
const MAX_BODY_BYTES = Math.max(4096, Number(process.env.NEURO_MAX_BODY_BYTES || 256000));
const PHONE_POLICY = resolvePhonePolicyConfig(process.env);
// Opt-in only: malformed production settings abort startup, and absence means no shadow child process.
const TRUSTED_SHADOW_LEARNING = parseTrustedShadowLearningScheduleConfig(process.env.NEURO_SKILL_SHADOW_SCHEDULER_JSON);
// Optional GEPA/DSPy sidecar: disabled by default; local llama.cpp remains the generator otherwise.
const GEPA_REVISION_GENERATOR = GepaReflectiveCandidateGenerator.fromEnvironment();
const P23_SKILL_REVISION_GENERATOR = (request) => GEPA_REVISION_GENERATOR.diagnostics().enabled
    ? GEPA_REVISION_GENERATOR.asP23RevisionGenerator()(request)
    : generateLocalSkillRevision(LLAMA_CPP_PROVIDER, request);
const COMPOUND_REPAIR_REVISION_PROVIDER_MODULE = String(process.env.NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE || '').trim();
const COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH = String(process.env.NEURO_COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH || '').trim();
const COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE = String(process.env.NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE || '').trim();
const COMPOUND_REPAIR_BACKGROUND_REVISION = parseCompoundRepairBackgroundRevisionConfig(
    process.env.NEURO_COMPOUND_REPAIR_BACKGROUND_REVISION_JSON,
);
async function configureCompoundRepairRevision() {
    const externalProviderConfigured = Boolean(COMPOUND_REPAIR_REVISION_PROVIDER_MODULE);
    const nativeProviderConfigured = Boolean(COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH);
    if (externalProviderConfigured && nativeProviderConfigured) {
        throw new Error('compound-repair-external-and-native-provider-configurations-are-mutually-exclusive');
    }
    if (!externalProviderConfigured && !nativeProviderConfigured) {
        if (COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE) {
            throw new Error('compound-repair-independent-evaluation-config-requires-revision-provider');
        }
        if (COMPOUND_REPAIR_BACKGROUND_REVISION?.enabled) {
            throw new Error('compound-repair-background-revision-requires-revision-provider');
        }
        return undefined;
    }
    // The built-in provider reads only signed outcome datasets and must still use
    // the independent host-owned evaluator configured below; it is not a fake evaluator.
    const providerPath = externalProviderConfigured
        ? (path.isAbsolute(COMPOUND_REPAIR_REVISION_PROVIDER_MODULE)
            ? COMPOUND_REPAIR_REVISION_PROVIDER_MODULE
            : path.resolve(ROOT, COMPOUND_REPAIR_REVISION_PROVIDER_MODULE))
        : path.resolve(__dirname, '../organism/learning/P23CompoundRepairRevisionProvider.ts');
    const lifecycle = createVerifiedSkillLifecycleBootstrap(
        path.join(STATE, 'p23-verified-skill-candidates.json'),
        path.join(STATE, 'p23-trusted-shadow-runs.json'),
    );
    if (lifecycle.trustedVerifierCount < 1 || lifecycle.trustedApprovalCount < 1) {
        throw new Error('compound repair revision requires trusted shadow verifier keys and authenticated promotion approval keys');
    }
    const engine = new P23LearningEngine();
    engine.configureVerifiedSkillLifecycle(lifecycle.store);
    let provideInputs;
    if (externalProviderConfigured) {
        // External provider is trusted executable code; its output is still not
        // trusted evidence and is wrapped by the independent canonical evaluator.
        const providerModule = await import(pathToFileURL(providerPath).href);
        const factory = providerModule.createCompoundRepairRevisionProvider ?? providerModule.default;
        if (typeof factory !== 'function') {
            throw new Error('compound repair revision provider module must export createCompoundRepairRevisionProvider() or a default factory');
        }
        provideInputs = await factory({
            engine,
            candidateStore: lifecycle.store,
            trustedRunRegistry: lifecycle.registry,
            stateDirectory: STATE,
            generateSkillRevision: (request) => P23_SKILL_REVISION_GENERATOR(request),
        });
    } else {
        provideInputs = await createNativeCompoundRepairRevisionProvider({
            datasetPath: COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH,
            root: ROOT,
            stateDirectory: STATE,
            candidateStore: lifecycle.store,
            generateSkillRevision: (request) => P23_SKILL_REVISION_GENERATOR(request),
        });
    }
    if (typeof provideInputs !== 'function') {
        throw new Error('compound repair revision provider factory must return an input-provider function');
    }
    // Production and built-in native mode may stage candidates only through host-owned
    // executor/verifier/scanner processes and a host-owned fixed experiment authority.
    const independentEvaluationConfigForRepair = await createIndependentEvaluationConfigFactory({
        moduleSetting: COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE,
        root: ROOT,
        providerModulePath: providerPath,
        stateDirectory: STATE,
        production: process.env.NODE_ENV === 'production',
        createHostOwnedFactory: createHostOwnedIndependentEvaluationConfigFactory,
    });
    if ((nativeProviderConfigured || COMPOUND_REPAIR_BACKGROUND_REVISION?.enabled) && !independentEvaluationConfigForRepair) {
        throw new Error('compound-repair-background-revision-requires-independent-evaluation-authority');
    }
    // Baseline/source payloads are resolved by the host from the canonical
    // versioned store. Provider-supplied payloads/reports never become the reference.
    return {
        engine,
        provideInputs,
        ...(independentEvaluationConfigForRepair ? { independentEvaluationConfigForRepair } : {}),
        ...(COMPOUND_REPAIR_BACKGROUND_REVISION ? { backgroundRevision: COMPOUND_REPAIR_BACKGROUND_REVISION } : {}),
    };
}
const COMPOUND_REPAIR_REVISION = await configureCompoundRepairRevision();
const TRUSTED_PROMOTION_APPROVER_IDS = new Set(parseTrustedSkillPromotionApprovalKeys(process.env.NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON).keys());
const PHONE_MODE = PHONE_POLICY.mode !== 'research';
const INTERVAL_MS = PHONE_POLICY.baseIntervalMs;
const SENSOR_INTERVAL_MS = PHONE_POLICY.samplerIntervalMs;
const CHECKPOINT_MIN_MS = PHONE_POLICY.checkpointMinIntervalMs;
const CHECKPOINT_MAX_CYCLES = PHONE_POLICY.checkpointMaxDirtyCycles;
const WORLD_CHECKPOINT_MIN_MS = PHONE_POLICY.worldCheckpointMinIntervalMs;
const WORLD_CHECKPOINT_MAX_CYCLES = PHONE_POLICY.worldCheckpointMaxDirtyCycles;
const BACKUP_EVERY_SAVES = Math.max(1, Number(process.env.NEURO_BACKUP_EVERY_SAVES || (PHONE_MODE ? 4 : 1)));
const VISION_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.GEMINI_VISION_ENABLED || '0'));
let languageCallCount = 0;
let lastLanguageBackend = 'none';
let lastLanguageFailure = '';
const RATE_WINDOW_MS = Math.max(10000, Number(process.env.NEURO_RATE_WINDOW_MS || 60000));
const RATE_LIMIT = Math.max(30, Number(process.env.NEURO_RATE_LIMIT || 240));
const rateBuckets = new Map();
function consumeRateLimit(req, pathName) {
    if (pathName === '/health' || pathName === '/api/health')
        return { allowed: true };
    const now = Date.now();
    const key = String(req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown');
    const current = rateBuckets.get(key);
    const bucket = !current || now - current.startedAt >= RATE_WINDOW_MS ? { startedAt: now, count: 0 } : current;
    bucket.count++;
    rateBuckets.set(key, bucket);
    if (rateBuckets.size > 512)
        for (const [k, v] of rateBuckets)
            if (now - v.startedAt >= RATE_WINDOW_MS)
                rateBuckets.delete(k);
    return bucket.count <= RATE_LIMIT ? { allowed: true, remaining: RATE_LIMIT - bucket.count } : { allowed: false, retryAfterSec: Math.ceil((bucket.startedAt + RATE_WINDOW_MS - now) / 1000) };
}
const VISION_BACKEND = VISION_ENABLED && process.env.GEMINI_API_KEY ? new GeminiVisionSemanticBackend({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash', timeoutMs: Number(process.env.GEMINI_VISION_TIMEOUT_MS || 12000), maxImageBytes: Number(process.env.GEMINI_VISION_MAX_IMAGE_BYTES || 8000000) }) : undefined;
await mkdir(STATE, { recursive: true });
const lock = new ProcessLock(path.join(STATE, 'organism-runtime.lock'));
await lock.acquire();
async function invokeLanguage(request) {
    const started = Date.now();
    const ecologyPreferredBackend = runtime.core.p40SelectModel('language', PHONE_MODE === false, request.maxTokens && request.maxTokens > 900 ? .82 : .72);
    const preferredBackend = LOCAL_LANGUAGE_BACKEND_POLICY.select({ localLlamaConfigured: LLAMA_CPP_PROVIDER.configured(), ecologyPreferredBackend });
    const effectiveBackend = preferredBackend === 'local-fallback'
        ? 'deterministic-policy-fallback'
        : preferredBackend;
    const response = await generateLanguage({ ...request, preferredBackend: effectiveBackend });
    const finishedAt = Date.now();
    LOCAL_LANGUAGE_BACKEND_POLICY.observe({ backend: String(response.backend ?? ''), failures: response.failures || [], now: finishedAt });
    const backend = String(response.backend ?? effectiveBackend ?? 'unknown');
    const provider = backend.split(':')[0];
    const model = backend.includes(':') ? backend.split(':').slice(1).join(':') : undefined;
    languageCallCount++;
    lastLanguageBackend = backend;
    // Completion accounting is a synchronous best-effort state update. Keep telemetry
    // failures isolated from the user-facing response; calling `.catch()` on its
    // undefined return value used to turn every successful chat into HTTP 500.
    try {
        runtime.core.willRecordLanguageCompletion({
            provider,
            model,
            success: Boolean(response.text),
            latencyMs: finishedAt - started,
            at: finishedAt,
        });
    }
    catch {
        // Language attribution must never invalidate an otherwise successful reply.
    }
    lastLanguageFailure = String((response.failures || []).at(-1) ?? '');
    for (const failure of response.failures || []) {
        const text = String(failure);
        const match = /^(kobold|gemini|llama\.cpp):/i.exec(text);
        const failedProvider = match?.[1] || (text.startsWith('kobold') ? 'kobold' : text.startsWith('gemini') ? 'gemini' : text.startsWith('llama.cpp') ? 'llama.cpp' : undefined);
        if (failedProvider)
            await runtime.core.recordLanguageFailure(failedProvider, finishedAt - started, false).catch(() => { });
    }
    return { ...response, preferredBackend, latencyMs: finishedAt - started };
}
const runtime = new OrganismRuntime({
    // Optional explicit durable state location for containers/local Compose.
    // When absent, the runtime keeps its existing default state-file behavior.
    stateFile: process.env.NK1_STATE_FILE?.trim() || (process.env.STATE_DIR?.trim()
      ? `${process.env.STATE_DIR.replace(/\\/+$/, '')}/organism-state.json`
      : undefined),
    stateFile,
    worldStateFile: worldFile,
    enableLanguage: true,
    mem0Adapter: MEM0_MEMORY_ADAPTER,
    mem0CognitiveRecall: process.env.NK_MEM0_COGNITIVE_RECALL === '1',
    visionBackend: VISION_BACKEND,
    languageInvoker: invokeLanguage,
    autoRun: true,
    intervalMs: INTERVAL_MS,
    sensorIntervalMs: SENSOR_INTERVAL_MS,
    phonePolicy: PHONE_POLICY,
    checkpointMinIntervalMs: CHECKPOINT_MIN_MS,
    checkpointMaxDirtyCycles: CHECKPOINT_MAX_CYCLES,
    stateStore: new FileStateStore(stateFile, { backupEverySaves: BACKUP_EVERY_SAVES, encoding: PHONE_MODE ? 'v8' : 'json' }),
    worldStateStore: new FileStateStore(worldFile, { backupEverySaves: BACKUP_EVERY_SAVES, encoding: PHONE_MODE ? 'v8' : 'json' }),
    ...(TRUSTED_SHADOW_LEARNING ? { trustedShadowLearning: TRUSTED_SHADOW_LEARNING } : {}),
    ...(COMPOUND_REPAIR_REVISION ? { compoundRepairRevision: COMPOUND_REPAIR_REVISION } : {}),
});
let runtimeReady = false;
const willSdk = new WillSdkFacade({ step: (message, options) => runtime.step(message, options), snapshot: () => runtime.core.snapshot(), flush: () => runtime.core.flush(), exportWillPma: () => runtime.core.exportWillPma(), validateWillPma: (pma) => runtime.core.validateWillPma(pma) }, { enqueue: (input) => runtime.core.willEnqueueEnvelope(input), ack: (input) => runtime.core.willAckEnvelope(input), searchText: (text, k) => runtime.core.willSearchVector(text, k), benchmarkVectorIndex: (queries, k, ef) => runtime.core.willBenchmarkVectorIndex(queries, k, ef), diagnostics: () => runtime.core.willIntegrationDiagnostics() }, 'kurisu');
const willMcp = new WillMcpJsonRpcServer(willSdk);
const willChannels = new WillChannelAdapter({ enqueue: (input) => runtime.core.willEnqueueEnvelope(input), ack: (input) => runtime.core.willAckEnvelope(input), searchText: (text, k) => runtime.core.willSearchVector(text, k), benchmarkVectorIndex: (queries, k, ef) => runtime.core.willBenchmarkVectorIndex(queries, k, ef), diagnostics: () => runtime.core.willIntegrationDiagnostics() });
function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(payload);
}
function fileExists(file) { try {
    return fsExistsSync(file);
}
catch {
    return false;
} }
function fileSize(file) { try {
    return Number(fsStatSync(file).size || 0);
}
catch {
    return 0;
} }
function fsSafeList(dir, suffix) { try {
    return fsReaddirSync(dir).filter(name => name.endsWith(suffix)).sort();
}
catch {
    return [];
} }
function readFileSyncSafe(file) { try {
    return fsReadFileSync(file, 'utf8');
}
catch {
    return null;
} }
function resolveLive2DDependencies(modelPath) {
    const deps = new Set([modelPath]);
    try {
        const model = JSON.parse(fsReadFileSync(modelPath, 'utf8'));
        const base = path.dirname(modelPath);
        const refs = model?.FileReferences ?? {};
        const add = (value) => { if (typeof value !== 'string' || !value.trim())
            return; const resolved = path.resolve(base, value); if (resolved.startsWith(path.resolve(PUBLIC, 'live2d') + path.sep) || resolved === path.resolve(PUBLIC, 'live2d'))
            deps.add(resolved); };
        add(refs.Moc);
        add(refs.Physics);
        add(refs.DisplayInfo);
        for (const texture of Array.isArray(refs.Textures) ? refs.Textures : [])
            add(texture);
        for (const group of Object.values(refs.Motions ?? {}))
            for (const motion of Array.isArray(group) ? group : [])
                add(motion?.File);
        for (const expression of Array.isArray(refs.Expressions) ? refs.Expressions : [])
            add(expression?.File);
    }
    catch { }
    return [...deps];
}
function embodimentAssetStatus() {
    const root = path.join(PUBLIC, 'live2d', 'Kurisu');
    const required = ['Kurisu.model3.json', 'Kurisu.moc3', 'Kurisu.4096/texture_00.png', 'Kurisu.physics3.json', 'Kurisu.cdi3.json'];
    const expressions = fsSafeList(path.join(root, 'exp'), '.exp3.json');
    const motions = fsSafeList(path.join(root, 'motions'), '.motion3.json');
    const files = [...required, ...expressions.map(name => `exp/${name}`), ...motions.map(name => `motions/${name}`)];
    const present = files.filter(rel => fileExists(path.join(root, rel)));
    const totalBytes = present.reduce((sum, rel) => sum + fileSize(path.join(root, rel)), 0);
    const mobileModel = path.join(PUBLIC, 'live2d', 'Kurisu.mobile', 'Kurisu-mobile.model3.json');
    const mobileDeps = resolveLive2DDependencies(mobileModel);
    const mobilePresent = mobileDeps.filter(fileExists);
    const mobileBytes = [...new Set(mobilePresent)].reduce((sum, file) => sum + fileSize(file), 0);
    const toWeb = (file) => '/' + path.relative(PUBLIC, file).split(path.sep).join('/');
    let provenance = null;
    try {
        provenance = JSON.parse(fsReadFileSync(path.join(PUBLIC, 'live2d', 'PROVENANCE.json'), 'utf8'));
    }
    catch { }
    const mobileTexture = path.join(PUBLIC, 'live2d', 'Kurisu.mobile', 'Kurisu.2048', 'texture_00_mobile_2048.png');
    return {
        ok: present.length === files.length,
        modelPresent: fileExists(path.join(root, 'Kurisu.model3.json')),
        corePresent: fileExists(path.join(root, 'Kurisu.moc3')),
        texturePresent: fileExists(path.join(root, 'Kurisu.4096/texture_00.png')),
        expressions: expressions.length, motions: motions.length, filesPresent: present.length, filesExpected: files.length, totalBytes,
        profiles: {
            quality: { model: '/live2d/Kurisu/Kurisu.model3.json', texture: '/live2d/Kurisu/Kurisu.4096/texture_00.png', bytes: totalBytes },
            mobile: { ok: mobileDeps.length > 0 && mobilePresent.length === mobileDeps.length, model: '/live2d/Kurisu.mobile/Kurisu-mobile.model3.json', texture: toWeb(mobileTexture), filesPresent: mobilePresent.length, filesExpected: mobileDeps.length, bytes: mobileBytes, dependencies: mobileDeps.map(toWeb), resolvedByModelReferences: true }
        },
        provenance
    };
}
async function body(req) {
    const declared = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
        throw new Error('request-too-large');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.byteLength;
        if (bytes > MAX_BODY_BYTES)
            throw new Error('request-too-large');
        chunks.push(buffer);
    }
    const source = Buffer.concat(chunks).toString('utf8');
    return source ? JSON.parse(source) : {};
}
function localFallback(request) {
    const action = /selected_action=([a-z-]+)/i.exec(request.system)?.[1] || 'reflect';
    const phrases = {
        verify: 'Я сначала проверю факты и уменьшу неопределённость. Не люблю делать выводы без проверки.',
        explore: 'Есть что-то неизвестное. Я предпочту сначала изучить это, а потом делать выводы.',
        rest: 'Сейчас разумнее немного восстановить ресурс и не тратить внимание впустую.',
        respond: 'Я услышала тебя. Сначала разберусь по существу, а уже потом сформулирую ответ.',
        reflect: 'Мне нужно немного обдумать ситуацию и проверить собственные предположения.',
        wait: 'Пока лучше не торопиться. Я сохраню текущий контекст и подожду нового сигнала.',
        defer: 'Сейчас разумнее отложить действие до появления более надёжной информации.',
    };
    return {
        text: phrases[action] || phrases.reflect,
        backend: 'deterministic-policy-fallback',
        degraded: true,
        generated: false,
    };
}
function languageTransportSignal(request) {
    const deadline = AbortSignal.timeout(LLM_TIMEOUT_MS);
    return request.signal ? AbortSignal.any([deadline, request.signal]) : deadline;
}
async function tryLlamaCpp(request, failures) {
    if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
    if (!LLAMA_CPP_PROVIDER.configured() || LOCAL_LANGUAGE_BACKEND_POLICY.snapshot().coolingDown) return null;
    try {
        return await LLAMA_CPP_PROVIDER.generate({ system: request.system, user: request.user, maxTokens: request.maxTokens, temperature: request.temperature, signal: request.signal });
    }
    catch (error) {
        if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
        failures.push(`llama.cpp:${error?.message || error}`);
        return null;
    }
}
async function tryKobold(request, failures) {
    try {
        const response = await fetch(`${KOBOLD_URL}/api/v1/generate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: languageTransportSignal(request),
            body: JSON.stringify({
                prompt: `${request.system}\n\n${request.user}`,
                max_context_length: 4096,
                max_length: request.maxTokens ?? 512,
                temperature: request.temperature ?? 0.7,
                quiet: true,
            }),
        });
        if (!response.ok)
            throw new Error(`kobold-http-${response.status}`);
        const data = await response.json();
        const text = String(data?.results?.[0]?.text || '').trim();
        if (text)
            return { text, backend: 'kobold' };
        throw new Error('kobold-empty-response');
    }
    catch (error) {
        failures.push(`kobold:${error?.message || error}`);
        return null;
    }
}
async function tryGemini(request, failures) {
    if (!process.env.GEMINI_API_KEY)
        return null;
    try {
        const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: languageTransportSignal(request),
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${request.system}\n\n${request.user}` }] }],
                generationConfig: { temperature: request.temperature ?? 0.7, maxOutputTokens: request.maxTokens ?? 512 },
            }),
        });
        if (!response.ok)
            throw new Error(`gemini-http-${response.status}`);
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')?.trim() || '';
        if (text)
            return { text, backend: `gemini:${model}` };
        throw new Error('gemini-empty-response');
    }
    catch (error) {
        failures.push(`gemini:${error?.message || error}`);
        return null;
    }
}
async function generateLanguage(request) {
    const failures = [];
    if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
    if (request.preferredBackend === 'deterministic-policy-fallback')
        return { ...localFallback(request), failures };
    const preferred = ['llama.cpp', 'kobold', 'gemini'].includes(request.preferredBackend) ? request.preferredBackend : 'gemini';
    const order = preferred === 'llama.cpp' ? ['llama.cpp', 'kobold', 'gemini']
        : preferred === 'kobold' ? ['kobold', 'llama.cpp', 'gemini']
            : ['gemini', 'llama.cpp', 'kobold'];
    for (const provider of order) {
        if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
        let result = null;
        if (provider === 'llama.cpp') result = await tryLlamaCpp(request, failures);
        else if (provider === 'kobold') result = await tryKobold(request, failures);
        else result = await tryGemini(request, failures);
        if (request.signal?.aborted) throw new Error('llama.cpp-request-aborted');
        if (result?.text) return { ...result, failures };
    }
    return { ...localFallback(request), failures };
}
async function route(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
        const auth = authorizeApiRequest(HOST, url.pathname, req.headers.authorization);
        if (url.pathname.startsWith('/api/') && !auth.allowed)
            return json(res, auth.status, { ok: false, error: 'api-authorization-required', reason: auth.reason });
        const rate = consumeRateLimit(req, url.pathname);
        if (!rate.allowed) {
            res.setHeader('retry-after', String(rate.retryAfterSec));
            return json(res, 429, { ok: false, error: 'rate-limit-exceeded', retryAfterSec: rate.retryAfterSec });
        }
        if (url.pathname === '/health' || url.pathname === '/api/health') {
            return json(res, 200, { ok: true, ready: runtimeReady, service: 'neuro-kurisu', version: RELEASE_CONTRACT.application, organismCore: RELEASE_CONTRACT.organismCore, schemaVersion: RELEASE_CONTRACT.stateSchema, tick: runtimeReady ? runtime.core.operationalStatusSnapshot().tick : 0, uptimeSec: Math.round(process.uptime()), bodySource: runtimeReady ? runtime.embodiment.snapshot().telemetry.source : 'initializing', actionLedger: runtimeReady ? runtime.core.actionExecutionLedgerMetrics() : null });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/learning/compound-repair-revision') {
            if (!runtimeReady)
                return json(res, 503, { ok: false, error: 'organism-runtime-not-ready' });
            if (!COMPOUND_REPAIR_REVISION)
                return json(res, 503, { ok: false, error: 'compound-repair-revision-provider-not-configured' });
            const input = await body(req);
            const skillId = typeof input.skillId === 'string' ? input.skillId.trim() : '';
            if (!skillId || skillId.length > 160 || /[\u0000-\u001f\u007f]/.test(skillId))
                return json(res, 400, { ok: false, error: 'invalid-skill-id' });
            const result = await runtime.reviseCompoundSkillsFromObservedRepairs(skillId);
            return json(res, 200, { ok: true, result });
        }

        if (req.method === 'GET' && url.pathname === '/api/embodiment/status')
            return json(res, 200, embodimentAssetStatus());
        if (req.method === 'GET' && url.pathname === '/api/organism/avatar')
            return json(res, 200, { ok: true, avatar: embodimentAssetStatus(), note: 'Read-only Live2D embodiment asset surface.' });
        if (req.method === 'GET' && url.pathname === '/api/organism/time') {
            const temporal = runtime.core.temporalContinuitySnapshot();
            return json(res, 200, { ok: true, current: runtime.core.temporalContext(), continuity: temporal, offlineSinceLastCheckpointMs: temporal.gapSincePreviousMs, lastSeenAt: temporal.lastCheckpointAt, lastSessionEndedAt: temporal.lastSessionEndedAt, sessionCount: temporal.sessionCount, interruptionCount: temporal.interruptionCount });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/temporal-perception') {
            return json(res, 200, { ok: true, temporalPerception: runtime.core.p41TemporalPerceptionSnapshot(), summary: runtime.core.p41TemporalPerceptionSummary() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/session') {
            const temporal = runtime.core.temporalContinuitySnapshot();
            return json(res, 200, { ok: true, sessionId: temporal.currentSessionId || null, current: runtime.core.temporalContext(), continuity: temporal, lastSession: temporal.sessions[0] ?? null });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/system-graph') {
            return json(res, 200, { ok: true, release: RELEASE_CONTRACT.application, graph: runtime.core.organismSystemGraph(), health: runtime.core.organismSystemHealth() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/cognitive-architecture') {
            return json(res, 200, { ok: true, release: RELEASE_CONTRACT.application, architecture: runtime.core.organismCognitiveArchitecture(), readOnly: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/subject-continuity') {
            return json(res, 200, { ok: true, subject: runtime.core.subjectContinuitySnapshot(), motive: runtime.core.motiveEcologySummary(), nonConsciousnessClaim: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/subject-fidelity') {
            return json(res, 200, { ok: true, report: runtime.core.portableSubjectFidelityDiagnostics(), readOnly: true, behavioralEquivalenceClaim: false });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/memory-strategy') {
            return json(res, 200, { ok: true, diagnostics: runtime.core.adaptiveMemoryStrategyReadoutDiagnostics(), readOnly: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/context-budget') {
            return json(res, 200, { ok: true, report: runtime.contextBudgetDiagnostics(), readOnly: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/known-entities') {
            const limit = Math.max(1, Math.min(128, Math.floor(Number(url.searchParams.get('limit') || 64))));
            const evidenceLimit = Math.max(1, Math.min(32, Math.floor(Number(url.searchParams.get('evidenceLimit') || 12))));
            const handle = String(url.searchParams.get('handle') || '').slice(0, 120) || undefined;
            return json(res, 200, { ok: true, report: runtime.core.knownEntityDossierSnapshot({ limit, handle, evidenceLimit }), readOnly: true });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/memory-benchmark') {
            const input = await body(req);
            // Pass raw rows to the benchmark's bounded validator so malformed or
            // over-limit examples are reported as integrity failures, not silently
            // erased before the evidence gate can observe them. The benchmark itself
            // inspects at most 64 rows and bounds every retained field.
            const examples = Array.isArray(input.examples) ? input.examples : [];
            const rawOptions = input.options && typeof input.options === 'object' ? input.options : {};
            const rawProvenance = rawOptions.datasetProvenance && typeof rawOptions.datasetProvenance === 'object' ? rawOptions.datasetProvenance : {};
            const options = { k: Math.max(1, Math.min(10, Math.floor(Number(rawOptions.k || 5)))),
                minHoldoutQueries: Math.max(8, Math.min(64, Math.floor(Number(rawOptions.minHoldoutQueries || 8)))),
                minimumRecallUplift01: Math.max(0, Math.min(.25, Number(rawOptions.minimumRecallUplift01 ?? .02))),
                maximumMrrRegression01: Math.max(0, Math.min(.1, Number(rawOptions.maximumMrrRegression01 ?? .01))),
                bootstrapSamples: Math.max(200, Math.min(5000, Math.floor(Number(rawOptions.bootstrapSamples || 1000)))),
                seed: Number.isFinite(Number(rawOptions.seed)) ? Math.floor(Number(rawOptions.seed)) : undefined,
                datasetProvenance: {
                    datasetId: typeof rawProvenance.datasetId === 'string' ? rawProvenance.datasetId.slice(0, 120) : '',
                    datasetVersion: typeof rawProvenance.datasetVersion === 'string' ? rawProvenance.datasetVersion.slice(0, 120) : '',
                    sourceRef: typeof rawProvenance.sourceRef === 'string' ? rawProvenance.sourceRef.slice(0, 240) : '',
                    labelingProtocol: typeof rawProvenance.labelingProtocol === 'string' ? rawProvenance.labelingProtocol.slice(0, 500) : '',
                } };
            const report = runtime.core.memoryRetrievalBenchmark(examples, options);
            return json(res, 200, { ok: true, report, readOnly: true, promotionRequiresSeparateReview: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/developmental-identity') {
            return json(res, 200, { ok: true, derived: true, frame: runtime.core.identityDevelopmentSummary(), nonConsciousnessClaim: true, note: 'Derived developmental synthesis only; it does not own identity or prove consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/identity-lineage') {
            const limit = Math.max(1, Math.min(32, Number(url.searchParams.get('limit') || 24)));
            const label = String(url.searchParams.get('label') || 'Kurisu').slice(0, 96);
            return json(res, 200, { ok: true, derived: true, nonConsciousnessClaim: true, summary: runtime.core.identityCausalitySummary(), neighborhood: runtime.core.identityCausalityNeighborhood(label, limit) });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/cognition-plan') {
            return json(res, 200, { ok: true, version: RELEASE_CONTRACT.application, planner: runtime.core.cognitiveExecutionPlanSnapshot(), cumulativeSavings01: runtime.core.cognitiveExecutionSavings01(), pressure: runtime.core.cognitivePressureSnapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/neural-spine') {
            return json(res, 200, { ok: true, version: RELEASE_CONTRACT.application, canonicalOwner: 'B289NeuralOrganismIntegrationSpine', diagnostics: runtime.core.b289NeuralOrganismDiagnostics(), nonConsciousnessClaim: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/development-gate') {
            return json(res, 200, { ok: true, version: RELEASE_CONTRACT.application, canonicalOwner: 'B290RealityGatedNeurodevelopment', diagnostics: runtime.core.b290RealityGatedNeurodevelopmentDiagnostics(), nonConsciousnessClaim: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/status-lite') {
            const status = runtime.core.operationalStatusSnapshot();
            return json(res, 200, {
                ok: true,
                version: RELEASE_CONTRACT.application,
                organismCore: RELEASE_CONTRACT.organismCore,
                schemaVersion: RELEASE_CONTRACT.stateSchema,
                tick: status.tick,
                lastAction: status.lastAction,
                lastReward01: Number(runtime.core.snapshot().state.lastActionSuccess ?? 0.5),
                autonomyScore: status.autonomyScore,
                predictionError: status.predictionError,
                selfPredictionError: status.selfPredictionError,
                identityContinuity01: status.identityContinuity,
                workspaceIgnition01: status.workspaceIgnition,
                memoryCount: status.memoryCount,
                activeGoal: status.activeGoal,
                body: status.body,
                voice: runtime.embodiment.voiceSnapshot(),
            });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/ui-snapshot') {
            const snapshot = runtime.core.snapshot();
            const state = snapshot.state;
            const body = runtime.embodiment.snapshot();
            const field = snapshot.facets.cognition.cognitiveField;
            const p33 = snapshot.facets.consciousness.p33;
            const p48 = snapshot.facets.advanced.p48Awareness;
            const workspace = snapshot.facets.cognition.globalWorkspace;
            const p27 = snapshot.facets.cognition.p27;
            const unifiedMemory = snapshot.facets.advanced.unifiedMemory;
            const memoryOS = snapshot.facets.advanced.memoryOS;
            const rawSkills = snapshot.facets.cognition.skills?.skills ?? [];
            const labels = ['calm', 'curiosity', 'joy', 'anxiety', 'frustration', 'sadness', 'anger', 'protective'];
            const scoreLabel = (() => {
                if (String(state.lastAction) === 'reflect')
                    return 'thinking';
                if (String(state.lastAction) === 'verify')
                    return 'focused';
                if (String(state.lastAction) === 'explore')
                    return 'curiosity';
                if (Number(field.valence01) > 0.68)
                    return 'joy';
                if (Number(field.valence01) < 0.30)
                    return 'sadness';
                if (Number(field.arousal01) > 0.78)
                    return 'anxiety';
                return labels.includes(String(field.dominantEmotion)) ? String(field.dominantEmotion) : 'calm';
            })();
            const candidates = (snapshot.traces?.slice(-1)?.[0]?.candidates ?? []).slice(0, 7).map((c) => ({ action: String(c.action), score: Number(c.score ?? 0), confidence: Number(c.confidence ?? 0) }));
            const lastReward01 = Number(state.lastActionSuccess ?? 0.5);
            const voiceSnapshot = runtime.embodiment.voiceSnapshot();
            return json(res, 200, { ok: true, version: RELEASE_CONTRACT.application, organismCore: RELEASE_CONTRACT.organismCore, schemaVersion: RELEASE_CONTRACT.stateSchema, at: state.at, tick: state.tick, awake: body.awake,
                state: { needs: { ...state.needs, sleepPressure: Number(p48?.interoception?.sleepPressure01 ?? (body.awake ? .15 : .85)) }, predictionError: state.predictionError, selfPredictionError: state.selfPredictionError, attentionBudget: state.attentionBudget, lastAction: state.lastAction, lastReward01: lastReward01, autonomyScore: state.autonomyScore, predictedNextAction: state.predictedNextAction, lastPredictionConfidence: state.lastPredictionConfidence, worldContextVersion: state.worldContextVersion },
                emotion: { label: scoreLabel, valence: Number(field.valence01 ?? .5), arousal: Number(field.arousal01 ?? .2), dominance: Number(field.coherence01 ?? .5), tendency: String(state.lastAction), cause: String(field.rationale ?? 'cognitive-field') },
                identity: { subjectId: String(p33?.identity?.canonicalName ?? 'kurisu').toLowerCase().replace(/\s+/g, '-'), name: String(p33?.identity?.canonicalName ?? 'Makise Kurisu'), fingerprint: String(snapshot.facets.consciousness?.identityContinuity?.selfNarrativeFingerprint ?? ''), createdAt: Number(p33?.identity?.createdAt ?? state.at), cycles: Number(p33?.continuity?.lifeTicks ?? state.tick), traits: (snapshot.system?.neuralGerminalOrganismB270?.traitValues && typeof snapshot.system.neuralGerminalOrganismB270.traitValues === 'object') ? snapshot.system.neuralGerminalOrganismB270.traitValues : {}, trust: Number(p33?.relationship?.trust01 ?? .5), traitNames: Array.isArray(p33?.identity?.coreTraits) ? p33.identity.coreTraits : [] },
                lastDecision: candidates.length || state.lastAction !== 'none' ? { tick: state.tick, action: String(state.lastAction), predictedNextAction: String(state.predictedNextAction), selectedScore: Number(candidates.find((x) => x.action === state.lastAction)?.score ?? 0), candidates, workspace: Array.isArray(workspace?.selected) ? workspace.selected : [], reason: `canonical action=${String(state.lastAction)} next=${String(state.predictedNextAction)}` } : null,
                memories: (Array.isArray(memoryOS?.items) ? memoryOS.items.slice(-32) : []).map((m) => ({ id: String(m.id), kind: String(m.kind), summary: String(m.content ?? m.summary ?? ''), salience: Number(m.salience ?? 0), confidence: Number(m.confidence ?? 0), predictionError: Number(m.predictionError ?? 0), createdAt: Number(m.createdAt ?? state.at), retrievedAt: Number(m.lastAccessAt ?? 0), retrievalCount: Number(m.retrievalCount ?? 0) })),
                beliefs: (Array.isArray(unifiedMemory?.beliefs) ? unifiedMemory.beliefs.slice(-24) : []).map((b) => ({ id: String(b.id), claim: String(b.claim ?? ''), kind: String(b.status ?? 'belief'), confidence: Number(b.confidence ?? 0), support: Array.isArray(b.evidence) ? b.evidence.length : 0, source: 'canonical-unified-memory' })),
                skills: rawSkills.slice(-24).map((s) => ({ id: String(s.id), action: String(s.action), context: String(s.context), uses: Number(s.uses ?? 0), successes: Number(s.successes ?? 0), failures: Number(s.failures ?? 0), successRate: Number(s.successRate ?? 0), confidence: Number(s.confidence ?? 0), status: String(s.status ?? 'candidate'), lastUsedAt: Number(s.lastUsedAt ?? 0) })),
                goals: (snapshot.goals ?? []).slice(-24).map((g) => ({ id: String(g.id), title: String(g.title), reason: String(g.reason ?? ''), source: String(g.source), status: String(g.status), importance: Number(g.importance ?? 0), urgency: Number(g.urgency ?? 0), confidence: Number(g.confidence ?? 0), progress: Number(g.progress ?? 0), createdAt: Number(g.createdAt ?? 0), updatedAt: Number(g.updatedAt ?? 0) })),
                world: { featureDim: Number(p27?.latent?.length ?? p27?.encoders?.length ?? 0), hiddenDim: Number(p27?.world?.hiddenDim ?? 0), predictionError01: Number(p27?.world?.predictionError01 ?? 0), modelSamples: Number(p27?.metrics?.worldUpdates ?? 0), lastLatentConfidence01: Number(p27?.latent?.confidence01 ?? 0), scene: String(snapshot.facets.embodiment.p35?.scene?.label ?? 'unknown'), entities: Array.isArray(snapshot.facets.embodiment.p35?.entities) ? snapshot.facets.embodiment.p35.entities.length : 0, conflicts: Array.isArray(snapshot.facets.embodiment.p35?.conflicts) ? snapshot.facets.embodiment.p35.conflicts.length : 0 },
                workspace: { selected: Array.isArray(workspace?.selectedIds) ? workspace.selectedIds.slice(-8) : [], ignition01: Number(workspace?.ignition01 ?? 0), recurrence01: Number(workspace?.recurrence01 ?? 0), diversity01: Number(workspace?.diversity01 ?? 0) },
                learning: { steps: Number(snapshot.facets.learning?.p30?.updates ?? snapshot.facets.learning?.longitudinal?.cycles ?? 0), evidenceDebt: Number(snapshot.facets.learning?.p23?.evidenceDebtOpen ?? 0), learningDelta01: Number(snapshot.facets.learning?.p23?.learningDelta01 ?? 0), predictionError01: Number(snapshot.facets.learning?.p23?.predictionError01 ?? state.predictionError) },
                consciousness: { identityContinuity01: Number(snapshot.facets.consciousness?.identityContinuity?.continuity ?? 0), metacognitiveAccuracy01: Number(snapshot.facets.consciousness?.metacognition?.metacognitiveAccuracy ?? 0), workspaceIgnition01: Number(snapshot.facets.consciousness?.workspaceIgnition?.ignitionStrength ?? 0), evidenceCoverage01: Number(snapshot.facets.consciousness?.consciousnessEvidence?.aggregateCoverage ?? 0) },
                body: { battery01: Number(body.telemetry?.battery01 ?? .0), cognitiveCapacity01: Number(body.cognitiveCapacity01 ?? 0), thermalStrain01: Number(body.thermalStrain01 ?? 0), cpuLoad01: Number(body.telemetry?.cpuLoad01 ?? 0), ramPressure01: Number(body.telemetry?.ramPressure01 ?? 0) },
                language: { calls: languageCallCount, backend: lastLanguageBackend, degraded: lastLanguageBackend === 'deterministic-policy-fallback', lastFailure: lastLanguageFailure || undefined },
                voice: { speaking: Boolean(voiceSnapshot?.state?.speaking), listening: Boolean(voiceSnapshot?.state?.listening), ttsAvailable: Boolean(body.ttsAvailable), sttAvailable: Boolean(body.sttAvailable) },
                will: { schemaVersion: runtime.core.willIntegrationDiagnostics().schemaVersion, agency: runtime.core.willIntegrationDiagnostics().agency, vector: runtime.core.willIntegrationDiagnostics().vector, integrity: runtime.core.willIntegrationDiagnostics().recordChain.integrity }
            });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/will') {
            return json(res, 200, { ok: true, version: RELEASE_CONTRACT.application, organismCore: RELEASE_CONTRACT.organismCore, integration: runtime.core.willIntegrationDiagnostics() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/will/pma') {
            try {
                const pma = runtime.core.exportWillPma();
                await runtime.core.flush();
                return json(res, 200, { ok: true, pma });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/pma/validate') {
            try {
                const input = await body(req);
                const validation = runtime.core.validateWillPma(input?.pma ?? input);
                await runtime.core.flush();
                return json(res, 200, { ok: true, validation });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/envelope') {
            try {
                const input = await body(req);
                const envelope = runtime.core.willEnqueueEnvelope(input);
                await runtime.core.flush();
                return json(res, 200, { ok: true, envelope, diagnostics: runtime.core.willIntegrationDiagnostics() });
            }
            catch (error) {
                const code = String(error?.code ?? '');
                const status = code === 'transport-envelope-id-conflict' || code === 'transport-envelope-history-unknown' ? 409 : code === 'transport-queue-full' ? 503 : 400;
                try { await runtime.core.flush(); } catch {}
                return json(res, status, { ok: false, error: code || String(error?.message ?? error), message: String(error?.message ?? error), diagnostics: runtime.core.willIntegrationDiagnostics() });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/ack') {
            try {
                const input = await body(req);
                const result = runtime.core.willAckEnvelopeDetailed(input);
                await runtime.core.flush();
                if (!result.ok) {
                    const status = result.error === 'transport-envelope-not-found' ? 404 : result.error === 'transport-ack-conflict' ? 409 : 400;
                    return json(res, status, { ...result, diagnostics: runtime.core.willIntegrationDiagnostics() });
                }
                return json(res, 200, { ok: true, accepted: !result.reused, ack: result, diagnostics: runtime.core.willIntegrationDiagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.code ?? error?.message ?? error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/will/vector/search') {
            const query = String(url.searchParams.get('q') || '').slice(0, 2000);
            const k = Math.max(1, Math.min(12, Number(url.searchParams.get('k') || 5)));
            if (!query)
                return json(res, 400, { ok: false, error: 'q-required' });
            return json(res, 200, { ok: true, results: runtime.core.willSearchVector(query, k), diagnostics: runtime.core.willIntegrationDiagnostics() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/will/sdk')
            return json(res, 200, { ok: true, sdk: willSdk.capabilities() });
        if (req.method === 'GET' && url.pathname === '/api/organism/will/mcp')
            return json(res, 200, { ok: true, mcp: willMcp.manifest() });
        if (req.method === 'POST' && url.pathname === '/api/organism/will/mcp') {
            const input = await body(req);
            const response = await willMcp.handle(input);
            return json(res, 200, response);
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/will/integrity')
            return json(res, 200, { ok: true, integrity: runtime.core.willVerifyRecordChain() });
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/overview') {
            return json(res, 200, { ok: true, will: runtime.core.willIntegrationDiagnostics(), lumina: runtime.core.luminaAdaptationDiagnostics(), capabilities: runtime.core.luminaCapabilities(), voice: runtime.embodiment.voiceSnapshot(), runtime: { version: RELEASE_CONTRACT.organismCore, application: RELEASE_CONTRACT.application } });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/capabilities') {
            const channel = url.searchParams.get('channel') || undefined;
            const allowed = ['ui', 'http', 'mcp', 'discord', 'whatsapp', 'telegram', 'sdk', 'generic'];
            return json(res, 200, { ok: true, channel: channel && allowed.includes(channel) ? channel : 'all', capabilities: runtime.core.luminaCapabilities(allowed.includes(String(channel)) ? String(channel) : undefined) });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/capability/authorize') {
            const id = String(url.searchParams.get('id') || '');
            const channel = String(url.searchParams.get('channel') || 'ui');
            const confirmed = url.searchParams.get('confirmed') === '1';
            const allowed = ['ui', 'http', 'mcp', 'discord', 'whatsapp', 'telegram', 'sdk', 'generic'];
            if (!allowed.includes(channel))
                return json(res, 400, { ok: false, error: 'invalid-channel' });
            return json(res, 200, { ok: true, authorization: runtime.core.luminaAuthorizeCapability(id, channel, confirmed), lumina: runtime.core.luminaAdaptationDiagnostics() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/social') {
            return json(res, 200, { ok: true, dossiers: runtime.core.willDossiers(), conversations: runtime.core.willConversations(), competence: runtime.core.willCompetence() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/social/conversation') {
            const input = await body(req);
            if (input.action === 'close') {
                runtime.core.willCloseConversation(String(input.id || ''));
            }
            else {
                runtime.core.willOpenConversation({ id: String(input.id || `conv:${Date.now()}`), target: String(input.target || 'user'), completionCondition: String(input.completionCondition || 'reply-received'), expectedReplyType: String(input.expectedReplyType || 'text') });
            }
            await runtime.core.flush();
            return json(res, 200, { ok: true, dossiers: runtime.core.willDossiers(), conversations: runtime.core.willConversations() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/web/validate') {
            const input = await body(req);
            const result = await runtime.core.luminaValidateWebTarget(String(input.url || ''));
            return json(res, result.allowed ? 200 : 403, { ok: result.allowed, validation: result });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/competence') {
            return json(res, 200, { ok: true, competence: runtime.core.willCompetence(), bundle: runtime.core.willExportCompetence() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/competence/validate') {
            const input = await body(req);
            return json(res, 200, { ok: true, validation: runtime.core.willValidateCompetence(input.bundle) });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/outbound') {
            const input = await body(req);
            const channel = String(input.channel || 'generic');
            const allowed = ['discord', 'whatsapp', 'telegram', 'http', 'mcp', 'generic'];
            if (!allowed.includes(channel))
                return json(res, 400, { ok: false, error: 'invalid-channel' });
            const target=String(input.target||'');
            if(!target.trim() || input.payload===undefined || input.payload===null) return json(res,400,{ok:false,error:'outbound-target-and-payload-required'});
            const correlationId=input.correlationId?String(input.correlationId):undefined;
            const actionInput={channel,target,payload:input.payload,...(correlationId?{correlationId}:{})};
            const approvalId=typeof input.approvalId==='string'?input.approvalId.slice(0,120):undefined;
            const permission=await runtime.core.consumeDirectActionApproval('http.integration.outbound',actionInput,approvalId,{});
            if(!permission.ok) {
                if(!approvalId && permission.reason==='user-approval-required') {
                    const approval=await runtime.core.requestActionToolApproval('http.integration.outbound',actionInput,`outbound-${channel}`,{},'direct');
                    return json(res,403,{ok:false,approvalRequired:true,error:permission.reason,approvalRequest:approval.request});
                }
                return json(res,403,{ok:false,error:permission.reason||'approval-invalid'});
            }
            const auth = runtime.core.luminaAuthorizeCapability('channel.outbound', channel, true);
            if (!auth.allowed)
                return json(res, 403, { ok: false, error: auth.reason, authorization: auth });
            const envelope = willChannels.outbound(channel, target, input.payload, correlationId);
            await runtime.core.flush();
            return json(res, 200, { ok: true, envelope, authorization: auth });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/search') {
            const q = String(url.searchParams.get('q') || '');
            const k = Math.max(1, Math.min(24, Number(url.searchParams.get('k') || 12)));
            runtime.core.luminaRecordChannel('ui');
            return json(res, 200, { ok: true, ...runtime.core.luminaExactSearch(q, k) });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/pma') {
            try {
                const pma = runtime.core.exportWillPma();
                runtime.core.luminaRecordChannel('ui');
                await runtime.core.flush();
                return json(res, 200, { ok: true, pma });
            }
            catch (error) {
                return json(res, 503, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/pma/validate') {
            try {
                const input = await body(req);
                const validation = runtime.core.validateWillPma(input?.pma ?? input);
                runtime.core.luminaRecordChannel('ui');
                await runtime.core.flush();
                return json(res, 200, { ok: true, validation });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/idempotency') {
            const input = await body(req);
            const key = String(input.key || runtime.core.luminaIdempotencyKey(input.payload ?? input));
            const result = runtime.core.luminaBeginIdempotent(key, Math.max(1000, Math.min(3600000, Number(input.ttlMs || 600000))));
            return json(res, 200, { ok: true, ...result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/transport') {
            const input = await body(req);
            const channel = ['ui', 'http', 'mcp', 'discord', 'whatsapp', 'telegram', 'sdk', 'generic'].includes(String(input.channel)) ? String(input.channel) : 'ui';
            const id = String(input.id || runtime.core.luminaIdempotencyKey({ channel, text: input.text, target: input.target, payload: input.payload }));
            const externalId = String(input.externalId || id);
            const from = String(input.from || 'ui');
            const text = String(input.text || '');
            const threadId = input.threadId ? String(input.threadId) : undefined;
            const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : undefined;
            const inboundPayload = { channel, externalId, from, text, ...(threadId ? { threadId } : {}), ...(metadata ? { metadata } : {}) };
            const requestFingerprint = runtime.core.luminaIdempotencyKey(inboundPayload);
            const idempotent = runtime.core.luminaBeginIdempotent(id);
            if (!idempotent.fresh) {
                const prior = idempotent.existing?.result?.envelope?.payload;
                if (!prior)
                    return json(res, 409, { ok: false, error: 'idempotency-outcome-unknown', message: 'the previous operation has no committed result; it was not replayed' });
                if (runtime.core.luminaIdempotencyKey(prior) !== requestFingerprint)
                    return json(res, 409, { ok: false, error: 'idempotency-key-conflict', message: 'the supplied transport id is already bound to a different inbound message' });
                return json(res, 200, { ok: true, replayed: true, result: idempotent.existing.result });
            }
            runtime.core.luminaRecordChannel(channel);
            const envelope = willChannels.inbound(inboundPayload);
            const result = { envelope };
            runtime.core.luminaCommitIdempotent(id, result);
            await runtime.core.flush();
            return json(res, 200, { ok: true, replayed: false, result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/transport/replay') {
            const input = await body(req);
            const replay = runtime.core.willReplayTransport(Math.max(1, Math.min(64, Number(input.limit || 16))));
            runtime.core.luminaRecordChannel('ui');
            await runtime.core.flush();
            return json(res, 200, { ok: true, replay, diagnostics: runtime.core.willIntegrationDiagnostics() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/integrity') {
            return json(res, 200, { ok: true, will: runtime.core.willVerifyRecordChain(), lumina: runtime.core.luminaAdaptationDiagnostics() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/letta') {
            return json(res, 200, { ok: true, governance: runtime.core.lettaGovernanceDiagnostics(), telemetry: runtime.core.lettaTelemetryPolicy() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/letta/source-boundary') {
            const input = await body(req);
            const result = runtime.core.lettaSourceBoundary(String(input.name || ''), ['canonical','research','legacy','provenance-only'].includes(String(input.requestedState)) ? String(input.requestedState) : 'canonical');
            return json(res, result.allowed ? 200 : 403, { ok: result.allowed, boundary: result });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/letta/telemetry') {
            return json(res, 200, { ok: true, telemetry: runtime.core.lettaTelemetryPolicy() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/letta/telemetry') {
            const input = await body(req);
            const telemetry = runtime.core.lettaSetTelemetryPolicy({ enabled: typeof input.enabled === 'boolean' ? input.enabled : undefined, localOnly: typeof input.localOnly === 'boolean' ? input.localOnly : undefined, redactSensitive: typeof input.redactSensitive === 'boolean' ? input.redactSensitive : undefined, exportAllowed: typeof input.exportAllowed === 'boolean' ? input.exportAllowed : undefined, retentionDays: Number.isFinite(Number(input.retentionDays)) ? Number(input.retentionDays) : undefined });
            await runtime.core.flush();
            return json(res, 200, { ok: true, telemetry });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/letta/review') {
            const input = await body(req);
            const row = runtime.core.lettaRecordArtifactReview({ kind: String(input.kind || 'generated-code'), source: String(input.source || 'operator-ui'), generatedBy: String(input.generatedBy || 'ChatGPT'), disclosure: String(input.disclosure || 'AI-assisted'), humanReviewed: input.humanReviewed === true, status: ['pending','approved','rejected'].includes(String(input.status)) ? String(input.status) : 'pending' });
            await runtime.core.flush();
            return json(res, 200, { ok: true, review: row });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/letta/review/decide') {
            const input = await body(req);
            const decision = input.decision === 'rejected' ? 'rejected' : 'approved';
            const result = runtime.core.lettaDecideArtifactReview(String(input.id || ''), decision, String(input.reason || 'operator decision'));
            if (!result.ok) return json(res, 409, result);
            const promotion = runtime.core.lettaCanPromoteArtifact(String(input.id || ''));
            await runtime.core.flush();
            return json(res, 200, { ok: true, result, promotion });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis') {
            return json(res, 200, { ok: true, hexis: runtime.core.hexisDiagnostics(), memoryIndex: runtime.core.hexisMemoryIndex(64), reviews: runtime.core.hexisListLearningReviews(), outbox: runtime.core.hexisOutbox() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis/memories') {
            const rawLimit = url.searchParams.get('limit');
            const limit = rawLimit === null ? 64 : Number(rawLimit);
            if (!Number.isSafeInteger(limit) || limit < 1 || limit > 128) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-memory-limit' });
            }
            return json(res, 200, { ok: true, memoryIndex: runtime.core.hexisMemoryIndex(limit) });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/sync-memory') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            const limit = input.limit === undefined ? 96 : input.limit;
            if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-memory-sync-limit' });
            }
            const result = runtime.core.hexisSyncMemoryProjection(limit);
            await runtime.core.flush();
            return json(res, 200, { ok: true, ...result, hexis: runtime.core.hexisDiagnostics() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/belief/revise') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            try {
                if (typeof input.memoryId !== 'string' || !input.memoryId.trim() || input.memoryId.length > 256) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-memory-id' });
                }
                if (typeof input.confidence01 !== 'number' || !Number.isFinite(input.confidence01) || input.confidence01 < 0 || input.confidence01 > 1) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-confidence' });
                }
                if (input.trust01 !== undefined &&
                    (typeof input.trust01 !== 'number' || !Number.isFinite(input.trust01) || input.trust01 < 0 || input.trust01 > 1)) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-trust' });
                }
                if (input.protectedBelief !== undefined && typeof input.protectedBelief !== 'boolean') {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-protection-flag' });
                }
                if (input.context !== undefined && (typeof input.context !== 'string' || input.context.length > 512)) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-context' });
                }
                const evidenceInput = input.evidence === undefined ? {} : input.evidence;
                if (!evidenceInput || typeof evidenceInput !== 'object' || Array.isArray(evidenceInput)) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-evidence' });
                }
                for (const key of ['ref', 'label', 'contentHash', 'note']) {
                    if (evidenceInput[key] !== undefined && typeof evidenceInput[key] !== 'string') {
                        return json(res, 400, { ok: false, error: 'invalid-hexis-belief-evidence-field', field: key });
                    }
                }
                if (evidenceInput.trust01 !== undefined &&
                    (typeof evidenceInput.trust01 !== 'number' || !Number.isFinite(evidenceInput.trust01) || evidenceInput.trust01 < 0 || evidenceInput.trust01 > 1)) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-evidence-trust' });
                }
                const evidence = {
                    ref: evidenceInput.ref || undefined,
                    label: evidenceInput.label || undefined,
                    contentHash: evidenceInput.contentHash || undefined,
                    trust01: evidenceInput.trust01,
                    note: evidenceInput.note || undefined,
                };
                const stance = input.stance;
                if (typeof stance !== 'string' || !['supports', 'contradicts'].includes(stance)) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-belief-stance' });
                }
                const result = runtime.core.hexisReviseBelief({
                    memoryId: input.memoryId,
                    confidence01: input.confidence01,
                    trust01: input.trust01,
                    stance,
                    evidence,
                    context: input.context,
                    protectedBelief: input.protectedBelief,
                });
                await runtime.core.flush();
                if (result?.ok === false) {
                    const status = /not-found|missing/.test(String(result.error ?? '')) ? 404 : 409;
                    return json(res, status, { ok: false, result });
                }
                return json(res, 200, { ok: true, result });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis/temporal') {
            const memoryId = url.searchParams.get('memoryId');
            const rawAt = url.searchParams.get('at');
            const at = rawAt === null ? Number.NaN : Number(rawAt);
            if (!memoryId?.trim() || memoryId.length > 256 || rawAt === null || rawAt.trim() === '' || !Number.isSafeInteger(at)) {
                return json(res, 400, { ok: false, error: 'memoryId-and-at-required' });
            }
            return json(res, 200, { ok: true, result: runtime.core.hexisTemporalAt(memoryId, at) });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis/temporal/diff') {
            const memoryId = url.searchParams.get('memoryId');
            const rawFrom = url.searchParams.get('from');
            const rawTo = url.searchParams.get('to');
            const fromAt = rawFrom === null ? Number.NaN : Number(rawFrom);
            const toAt = rawTo === null ? Number.NaN : Number(rawTo);
            if (!memoryId?.trim() || memoryId.length > 256 ||
                rawFrom === null || rawFrom.trim() === '' || !Number.isSafeInteger(fromAt) ||
                rawTo === null || rawTo.trim() === '' || !Number.isSafeInteger(toAt)) {
                return json(res, 400, { ok: false, error: 'memoryId-from-to-required' });
            }
            return json(res, 200, { ok: true, result: runtime.core.hexisTemporalDiff(memoryId, fromAt, toAt) });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis/reviews') {
            return json(res, 200, { ok: true, reviews: runtime.core.hexisListLearningReviews() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/evidence/lineage') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            const result = runtime.core.hexisIngestEvidenceLineage(input);
            if (result.accepted) {
                await runtime.core.flush();
                return json(res, 200, { ok: true, result });
            }
            // Reusing an immutable trace ID with different provenance is a resource conflict.
            const status = result.reason === 'canonical-memory-not-found' ? 404 :
                (result.reason === 'canonical-evidence-write-failed' || result.reason === 'source-trace-id-conflict') ? 409 : 400;
            return json(res, status, { ok: false, result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/reviews/create') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            const result = runtime.core.hexisCreateLearningReview(input);
            await runtime.core.flush();
            return json(res, 200, { ok: true, review: result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/reviews/decide') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.reviewId !== 'string' || !input.reviewId.trim() || input.reviewId.length > 160 ||
                typeof input.itemId !== 'string' || !input.itemId.trim() || input.itemId.length > 160 ||
                typeof input.decision !== 'string' || !['approve', 'correct', 'forget'].includes(input.decision) ||
                (input.correction !== undefined && (typeof input.correction !== 'string' || input.correction.length > 20000))) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-review-decision' });
            }
            const decision = input.decision;
            try {
                const result = runtime.core.hexisDecideLearningReview(input.reviewId, input.itemId, decision, input.correction || undefined);
                await runtime.core.flush();
                if (result?.ok === false) {
                    const status = /not-found|missing/.test(String(result.error ?? '')) ? 404 : 409;
                    return json(res, status, { ok: false, result });
                }
                return json(res, 200, { ok: true, result });
            } catch (error) {
                await runtime.core.flush().catch(() => {});
                return json(res, 409, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/retention/propose') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            try {
                if (!['compress', 'archive', 'forget'].includes(input.action)) {
                    return json(res, 400, { ok: false, error: 'hexis-retention-invalid-action' });
                }
                const action = input.action;
                if (typeof input.memoryId !== 'string' || !input.memoryId.trim() || input.memoryId.length > 256 ||
                    (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > 1000))) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-retention-proposal' });
                }
                const result = runtime.core.hexisProposeRetention(input.memoryId, action, input.reason || 'operator-review');
                await runtime.core.flush();
                return json(res, result.ok === false ? 404 : 200, { ok: result.ok, ...result });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/retention/apply') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.proposalId !== 'string' || !input.proposalId.trim() || input.proposalId.length > 256 ||
                (input.confirmed !== undefined && typeof input.confirmed !== 'boolean')) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-retention-apply' });
            }
            try {
                const result = await runtime.core.hexisApplyRetention(input.proposalId, input.confirmed === true);
                const status = result.ok ? 200 : (result.error === 'retention-explicit-confirmation-required' ? 403 : result.error === 'retention-proposal-not-found' ? 404 : 400);
                return json(res, status, { ...result });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis/hmx/export') {
            try {
                const document = runtime.core.hexisExportHmx();
                return json(res, 200, { ok: true, document });
            }
            catch (error) {
                return json(res, 503, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/hmx/stage') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (!input.document || typeof input.document !== 'object' || Array.isArray(input.document) ||
                (input.intent !== undefined && !['port', 'duplicate', 'telepathy', 'analysis'].includes(input.intent)) ||
                (input.strategy !== undefined && !['additive', 'authoritative', 'deliberative', 'analysis_only'].includes(input.strategy))) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-hmx-stage-input' });
            }
            try {
                const result = runtime.core.hexisStageHmx(input.document, input.intent ?? 'analysis', input.strategy ?? 'analysis_only');
                await runtime.core.flush();
                return json(res, 200, { ok: true, stage: result });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/hmx/decide') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.stagingId !== 'string' || !input.stagingId.trim() || input.stagingId.length > 256 ||
                typeof input.decision !== 'string' || !['accept', 'reject', 'apply'].includes(input.decision) ||
                (input.confirmed !== undefined && typeof input.confirmed !== 'boolean')) {
                return json(res, 400, { ok: false, error: 'invalid-hmx-decision' });
            }
            const decision = input.decision;
            if (decision === 'accept' && input.confirmed !== true) {
                return json(res, 403, { ok: false, error: 'hmx-accept-explicit-confirmation-required' });
            }
            if (decision === 'apply' && input.confirmed !== true) {
                return json(res, 403, { ok: false, error: 'hmx-apply-explicit-confirmation-required' });
            }
            try {
                const result = runtime.core.hexisDecideHmx(input.stagingId, decision);
                await runtime.core.flush();
                if (!result) return json(res, 404, { ok: false, error: 'hmx-stage-not-found' });
                return json(res, 200, { ok: true, stage: result });
            } catch (error) {
                await runtime.core.flush().catch(() => {});
                return json(res, 409, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis/goals') {
            try {
                const rawStatus = url.searchParams.get('status');
                const status = rawStatus === null ? undefined : rawStatus;
                const rawLimit = url.searchParams.get('limit');
                const limit = rawLimit === null ? 64 : Number(rawLimit);
                if (status !== undefined && !['pending', 'approved', 'rejected', 'materialized'].includes(status)) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-goal-status-filter' });
                }
                if (!Number.isSafeInteger(limit) || limit < 1 || limit > 128) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-goal-limit' });
                }
                return json(res,200,{ok:true,proposals:runtime.core.hexisListGoalProposals(status,limit)});
            } catch(error) {
                return json(res,400,{ok:false,error:String(error?.message ?? error)});
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/goals/prepare') {
            const input=await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            try {
                if(typeof input.stagingId !== 'string' || !input.stagingId.trim() || input.stagingId.length > 256)
                    return json(res,400,{ok:false,error:'invalid-hexis-goal-staging-id'});
                const result=runtime.core.hexisPrepareGoalProposals(input.stagingId);
                await runtime.core.flush();
                return json(res,200,{ok:true,...result});
            } catch(error) {
                await runtime.core.flush().catch(()=>{});
                const message=String(error?.message ?? error);
                return json(res,/not-found/.test(message)?404:409,{ok:false,error:message});
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/goals/decide') {
            const input=await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if(typeof input.proposalId !== 'string' || !input.proposalId.trim() || input.proposalId.length > 256 ||
               typeof input.decision !== 'string' || !['approve','reject'].includes(input.decision))
                return json(res,400,{ok:false,error:'invalid-hexis-goal-decision'});
            const decision=input.decision;
            try {
                const proposal=runtime.core.hexisDecideGoalProposal(input.proposalId,decision);
                await runtime.core.flush();
                if(!proposal) return json(res,404,{ok:false,error:'hexis-goal-proposal-not-found'});
                return json(res,200,{ok:true,proposal});
            } catch(error) {
                await runtime.core.flush().catch(()=>{});
                return json(res,409,{ok:false,error:String(error?.message ?? error)});
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/goals/materialize') {
            const input=await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (input.confirmed !== true) {
                return json(res, 403, { ok: false, error: 'hexis-goal-materialization-confirmation-required' });
            }
            if (typeof input.proposalId !== 'string' || !input.proposalId.trim() || input.proposalId.length > 256) {
                return json(res, 400, { ok: false, error: 'hexis-goal-proposal-id-invalid' });
            }
            try {
                const result=runtime.core.hexisMaterializeGoalProposal(input.proposalId);
                await runtime.core.flush();
                return json(res,200,{ok:true,...result});
            } catch(error) {
                await runtime.core.flush().catch(()=>{});
                const message=String(error?.message ?? error);
                return json(res,/not-found/.test(message)?404:409,{ok:false,error:message});
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/goals/activate') {
            const input=await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.proposalId !== 'string' || !input.proposalId.trim()) {
                return json(res, 400, { ok: false, error: 'hexis-goal-proposal-id-invalid' });
            }
            if (input.confirmed !== true) {
                return json(res, 403, { ok: false, error: 'hexis-goal-activation-confirmation-required' });
            }
            try {
                const result=runtime.core.hexisActivateGoalProposal(input.proposalId);
                await runtime.core.flush();
                return json(res,200,{ok:true,...result});
            } catch(error) {
                await runtime.core.flush().catch(()=>{});
                const message=String(error?.message ?? error);
                return json(res,/not-found/.test(message)?404:409,{ok:false,error:message});
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/hexis/outbox') {
            return json(res, 200, { ok: true, outbox: runtime.core.hexisOutbox?.() ?? [], hexis: runtime.core.hexisDiagnostics() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/outbox/enqueue') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            try {
                if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey.trim() || input.idempotencyKey.length > 512 ||
                    (input.kind !== undefined && (typeof input.kind !== 'string' || !input.kind.trim() || input.kind.length > 128)) ||
                    (input.channel !== undefined && (typeof input.channel !== 'string' || !input.channel.trim() || input.channel.length > 128)) ||
                    !Object.prototype.hasOwnProperty.call(input, 'payload')) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-outbox-entry' });
                }
                const result = runtime.core.hexisEnqueueOutbox({
                    idempotencyKey: input.idempotencyKey,
                    kind: input.kind ?? 'notify',
                    channel: input.channel ?? 'generic',
                    payload: input.payload,
                });
                await runtime.core.flush();
                if (result && result.ok === false && result.error) return json(res, result.error === 'idempotency-key-conflict' ? 409 : 400, result);
                return json(res, 200, { ok: true, result });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/outbox/claim') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.id !== 'string' || !input.id.trim() || input.id.length > 256) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-outbox-claim-id' });
            }
            const result = runtime.core.hexisClaimOutbox(input.id);
            await runtime.core.flush();
            return json(res, 200, { ok: Boolean(result), result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/outbox/ack') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.id !== 'string' || !input.id.trim() ||
                (input.published !== undefined && typeof input.published !== 'boolean') ||
                (input.error !== undefined && (typeof input.error !== 'string' || input.error.length > 2048))) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-outbox-ack' });
            }
            const result = runtime.core.hexisAckOutbox(input.id, input.published === true, input.error || undefined);
            await runtime.core.flush();
            return json(res, 200, { ok: Boolean(result), result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/outbox/reclaim') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            const requestedMaxAgeMs = input.maxAgeMs === undefined ? 60000 : input.maxAgeMs;
            if (typeof requestedMaxAgeMs !== 'number' || !Number.isFinite(requestedMaxAgeMs)) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-outbox-reclaim-age' });
            }
            const result = runtime.core.hexisReclaimOutbox(Math.max(1000, Math.min(86400000, requestedMaxAgeMs)));
            await runtime.core.flush();
            return json(res, 200, { ok: true, ...result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/policy') {
            const input = await body(req);
            // This endpoint carries permissions. Validate the JSON types before any
            // coercion: Boolean("false") is true and can accidentally grant autonomy.
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-policy-payload' });
            }
            if (typeof input.connectorId !== 'string' || typeof input.actionKind !== 'string' ||
                !input.connectorId.trim() || !input.actionKind.trim()) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-policy-identity' });
            }
            if ((input.allowAutonomous !== undefined && typeof input.allowAutonomous !== 'boolean') ||
                (input.requiresApproval !== undefined && typeof input.requiresApproval !== 'boolean')) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-policy-boolean' });
            }
            const contexts = input.contexts === undefined ? ['chat'] : input.contexts;
            const allowedTargets = input.allowedTargets === undefined ? [] : input.allowedTargets;
            const deniedTargets = input.deniedTargets === undefined ? [] : input.deniedTargets;
            if (!Array.isArray(contexts) || contexts.length > 32 ||
                !contexts.every((item) => typeof item === 'string') ||
                !Array.isArray(allowedTargets) || allowedTargets.length > 256 ||
                !allowedTargets.every((item) => typeof item === 'string') ||
                !Array.isArray(deniedTargets) || deniedTargets.length > 256 ||
                !deniedTargets.every((item) => typeof item === 'string')) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-policy-lists' });
            }
            for (const key of ['maxPerWindow', 'windowMs', 'expiresAt']) {
                if (input[key] !== undefined &&
                    (typeof input[key] !== 'number' || !Number.isFinite(input[key]))) {
                    return json(res, 400, { ok: false, error: 'invalid-hexis-policy-number', field: key });
                }
            }
            try {
                const result = runtime.core.hexisGrantConnectorPolicy({
                    connectorId: input.connectorId,
                    actionKind: input.actionKind,
                    contexts,
                    allowAutonomous: input.allowAutonomous ?? false,
                    requiresApproval: input.requiresApproval ?? true,
                    allowedTargets,
                    deniedTargets,
                    maxPerWindow: input.maxPerWindow,
                    windowMs: input.windowMs,
                    expiresAt: input.expiresAt,
                });
                await runtime.core.flush();
                return json(res, 200, { ok: true, policy: result });
            }
            catch (error) {
                await runtime.core.flush().catch(() => {});
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/policy/evaluate') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.connectorId !== 'string' || !input.connectorId.trim() || input.connectorId.length > 128 ||
                typeof input.actionKind !== 'string' || !input.actionKind.trim() || input.actionKind.length > 128 ||
                (input.context !== undefined && (typeof input.context !== 'string' || !input.context.trim() || input.context.length > 128)) ||
                (input.target !== undefined && (typeof input.target !== 'string' || input.target.length > 512)) ||
                (input.confirmed !== undefined && typeof input.confirmed !== 'boolean') ||
                (input.autonomous !== undefined && typeof input.autonomous !== 'boolean')) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-policy-evaluation' });
            }
            const result = runtime.core.hexisEvaluateConnectorAction({
                connectorId: input.connectorId,
                actionKind: input.actionKind,
                context: input.context ?? 'chat',
                target: input.target,
                confirmed: input.confirmed ?? false,
                autonomous: input.autonomous ?? false,
            });
            await runtime.core.flush();
            return json(res, result.allowed ? 200 : 403, { ok: result.allowed, result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/policy/revoke') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (typeof input.id !== 'string' || !input.id.trim() || input.id.length > 256) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-policy-revoke-id' });
            }
            const result = runtime.core.hexisRevokeConnectorPolicy(input.id);
            await runtime.core.flush();
            return json(res, 200, { ok: result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/hexis/execution-plan') {
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'hexis-invalid-request-body' });
            }
            if (input.actionKind !== undefined &&
                (typeof input.actionKind !== 'string' || !input.actionKind.trim() || input.actionKind.length > 128)) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-execution-action' });
            }
            if (input.requestedPlacement !== undefined &&
                !['local', 'sandbox', 'remote', 'companion'].includes(input.requestedPlacement)) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-execution-placement' });
            }
            if (input.risk01 !== undefined &&
                (typeof input.risk01 !== 'number' || !Number.isFinite(input.risk01) || input.risk01 < 0 || input.risk01 > 1)) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-execution-risk' });
            }
            if (input.requiresApproval !== undefined && typeof input.requiresApproval !== 'boolean') {
                return json(res, 400, { ok: false, error: 'invalid-hexis-execution-approval' });
            }
            if (input.rationale !== undefined &&
                (typeof input.rationale !== 'string' || input.rationale.length > 1000)) {
                return json(res, 400, { ok: false, error: 'invalid-hexis-execution-rationale' });
            }
            const requested = input.requestedPlacement;
            const result = runtime.core.hexisPlanExecution({
                actionKind: input.actionKind ?? 'tool.execute',
                requestedPlacement: requested,
                risk01: input.risk01 ?? 0,
                rationale: input.rationale,
                requiresApproval: input.requiresApproval,
            });
            await runtime.core.flush();
            return json(res, 200, { ok: true, plan: result });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/conscio') {
            return json(res, 200, { ok: true, conscio: runtime.core.conscioNodeSnapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/sync-memory') {
            const input = await body(req);
            try {
                const result = runtime.core.conscioSyncMemoryIndex(Math.max(1, Math.min(1024, Number(input.limit || 512))));
                await runtime.core.flush();
                return json(res, 200, { ok: true, result, diagnostics: runtime.core.conscioDiagnostics() });
            } catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/conscio/search') {
            const query = String(url.searchParams.get('q') || '').slice(0, 600);
            const k = Math.max(1, Math.min(32, Number(url.searchParams.get('k') || 12)));
            if (!query.trim()) return json(res, 400, { ok: false, error: 'query-required' });
            try {
                const hits = runtime.core.conscioHybridSearch(query, k);
                return json(res, 200, { ok: true, query, hits });
            } catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/source-boundary') {
            const input = await body(req);
            const requested = ['canonical', 'research', 'legacy', 'provenance-only'].includes(String(input.requestedState)) ? String(input.requestedState) : 'canonical';
            const result = runtime.core.conscioSourceBoundary(String(input.path || ''), requested);
            await runtime.core.flush();
            return json(res, result.ok ? 200 : 403, { ok: result.ok, result });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/conscio/skills') {
            return json(res, 200, { ok: true, skills: runtime.core.conscioSkills() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/skills/publish') {
            const input = await body(req);
            try {
                const result = runtime.core.conscioPublishSkill({ name: String(input.name || 'external-skill'), version: String(input.version || '1.0.0'), summary: String(input.summary || ''), provenance: String(input.provenance || 'external') });
                await runtime.core.flush();
                return json(res, 200, { ok: true, skill: result });
            } catch (error) { return json(res, 400, { ok: false, error: String(error?.message ?? error) }); }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/skills/trial') {
            const input = await body(req);
            const result = runtime.core.conscioTrialSkill(String(input.skillId || ''), input.ok === true, String(input.evidence || ''));
            await runtime.core.flush();
            return json(res, result.ok ? 200 : 400, result);
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/skills/review') {
            const input = await body(req);
            const decision = input.decision === 'approve' ? 'approve' : 'reject';
            const result = runtime.core.conscioReviewSkill(String(input.skillId || ''), decision, String(input.reason || ''));
            await runtime.core.flush();
            return json(res, result.ok ? 200 : 403, result);
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/conscio/peers') {
            const snap = runtime.core.conscioNodeSnapshot();
            return json(res, 200, { ok: true, peers: snap.peers, messages: snap.messages });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/peers/pair') {
            const input = await body(req);
            const result = runtime.core.conscioPairPeer({ id: String(input.id || ''), label: input.label ? String(input.label) : undefined, role: input.role ? String(input.role) : undefined, capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(String) : [], trust01: input.trust01 === undefined ? undefined : Number(input.trust01) });
            await runtime.core.flush();
            return json(res, 200, { ok: true, peer: result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/peers/decide') {
            const input = await body(req);
            const decision = input.decision === 'trust' ? 'trust' : 'revoke';
            const result = runtime.core.conscioDecidePeer(String(input.id || ''), decision);
            await runtime.core.flush();
            return json(res, result.ok ? 200 : 404, result);
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/peers/message') {
            const input = await body(req);
            const result = runtime.core.conscioQueuePeerMessage({ from: String(input.from || 'kurisu'), to: String(input.to || ''), space: input.space ? String(input.space) : undefined, payload: input.payload, ttlMs: input.ttlMs === undefined ? undefined : Number(input.ttlMs), idempotencyKey: input.idempotencyKey ? String(input.idempotencyKey).slice(0, 160) : undefined });
            await runtime.core.flush();
            return json(res, result.ok ? 200 : (result.error === 'idempotency-key-conflict' ? 409 : 400), result);
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/peers/ack') {
            const input = await body(req);
            const result = runtime.core.conscioAckPeerMessage(String(input.id || ''), input.accepted !== false);
            await runtime.core.flush();
            return json(res, result.ok ? 200 : 400, result);
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/conscio/calibration') {
            const key = url.searchParams.get('key') || undefined;
            return json(res, 200, { ok: true, calibration: runtime.core.conscioCalibration(key) });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/calibration/observe') {
            const input = await body(req);
            const row = runtime.core.conscioObserveConfidence({ key: String(input.key || 'runtime.claim'), predicted01: Number(input.predicted01 || 0), outcome01: Number(input.outcome01 || 0), evidenceTrust01: input.evidenceTrust01 === undefined ? undefined : Number(input.evidenceTrust01) });
            await runtime.core.flush();
            return json(res, 200, { ok: true, observation: row, calibration: runtime.core.conscioCalibration(String(input.key || 'runtime.claim')) });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/conscio/claims') {
            return json(res, 200, { ok: true, claims: runtime.core.conscioClaims() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/integration/conscio/claims') {
            const input = await body(req);
            const row = runtime.core.conscioRecordClaim({ claim: String(input.claim || ''), expectedAction: String(input.expectedAction || ''), supported: input.supported === true, confidence01: input.confidence01 === undefined ? undefined : Number(input.confidence01), evidence: Array.isArray(input.evidence) ? input.evidence.map(String) : [] });
            await runtime.core.flush();
            return json(res, row?.ok === false ? 400 : 200, { ok: row?.ok !== false, claim: row });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/integration/conscio/metabolic') {
            const used = Number(url.searchParams.get('used') || 0);
            const window = Math.max(1, Number(url.searchParams.get('window') || 16384));
            return json(res, 200, { ok: true, metabolic: runtime.core.conscioMetabolic(used, window) });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/replay') {
            const input = await body(req);
            const replay = runtime.core.willReplayTransport(Number(input.limit ?? 16));
            await runtime.core.flush();
            return json(res, 200, { ok: true, replay, diagnostics: runtime.core.willIntegrationDiagnostics() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/benchmark') {
            const input = await body(req);
            const result = runtime.core.willBenchmarkVectorIndex(Array.isArray(input.queries) ? input.queries.map(String) : [], Math.max(1, Math.min(16, Number(input.k ?? 5))), Math.max(8, Math.min(256, Number(input.efSearch ?? 32))));
            return json(res, 200, { ok: true, benchmark: result });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/channel/inbound') {
            const input = await body(req);
            const allowed = ['discord', 'whatsapp', 'http', 'mcp', 'generic'];
            const channel = allowed.includes(String(input.channel)) ? String(input.channel) : 'generic';
            const envelope = willChannels.inbound({ channel, externalId: String(input.externalId || ''), from: String(input.from || 'unknown'), text: String(input.text || ''), threadId: input.threadId ? String(input.threadId) : undefined, at: Number.isFinite(Number(input.at)) ? Number(input.at) : undefined, metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : undefined });
            return json(res, 200, { ok: true, envelope });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/channel/outbound') {
            const input = await body(req);
            const allowed = ['discord', 'whatsapp', 'http', 'mcp', 'generic'];
            const channel = allowed.includes(String(input.channel)) ? String(input.channel) : 'generic';
            const target=String(input.target||'');
            if(!target.trim() || input.payload===undefined || input.payload===null) return json(res,400,{ok:false,error:'outbound-target-and-payload-required'});
            const correlationId=input.correlationId?String(input.correlationId):undefined;
            const actionInput={channel,target,payload:input.payload,...(correlationId?{correlationId}:{})};
            const approvalId=typeof input.approvalId==='string'?input.approvalId.slice(0,120):undefined;
            const permission=await runtime.core.consumeDirectActionApproval('http.integration.outbound',actionInput,approvalId,{});
            if(!permission.ok) {
                if(!approvalId && permission.reason==='user-approval-required') {
                    const approval=await runtime.core.requestActionToolApproval('http.integration.outbound',actionInput,`will-channel-outbound-${channel}`,{},'direct');
                    return json(res,403,{ok:false,approvalRequired:true,error:permission.reason,approvalRequest:approval.request});
                }
                return json(res,403,{ok:false,error:permission.reason||'approval-invalid'});
            }
            const auth = runtime.core.luminaAuthorizeCapability('channel.outbound', channel, true);
            if (!auth.allowed) return json(res, 403, { ok: false, error: auth.reason, authorization: auth });
            const envelope = willChannels.outbound(channel, target, input.payload, correlationId);
            return json(res, 200, { ok: true, envelope, authorization: auth });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/will/channel/ack') {
            const input = await body(req);
            const ok = willChannels.ackExternal(String(input.envelopeId || ''), input.accepted !== false, input.reason ? String(input.reason) : undefined);
            return json(res, 200, { ok: true, accepted: ok });
        }
        if (req.method === 'GET' && url.pathname === '/api/metrics') {
            if (!runtimeReady)
                return json(res, 200, { ok: true, ready: false, version: RELEASE_CONTRACT.application });
            const snapshot = runtime.core.snapshot();
            const bodyState = runtime.embodiment.snapshot();
            return json(res, 200, {
                ok: true,
                ready: true,
                version: RELEASE_CONTRACT.application,
                system: { integrity: snapshot.system.integrity, revision: snapshot.system.revision, lastStateHash: snapshot.system.lastStateHash },
                sensorium: {
                    visionBackend: VISION_BACKEND?.id ?? null,
                    visionEnabled: Boolean(VISION_BACKEND),
                    semantic: runtime.core.p41PerceptionSummary(),
                    socialMind: runtime.core.socialMindDiagnostics(),
                    cameraEvidence: snapshot.facets.embodiment.cameraEvidence,
                    perceptionRouting: snapshot.facets.embodiment.perceptionRouting,
                    compoundSkills: runtime.core.compoundSkillsSnapshot(16),
                },
                skills: runtime.core.skillLibrarySummary(),
                body: bodyState.telemetry,
            });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/semantic-world') {
            return json(res, 200, { ok: true, semanticWorldBody: runtime.core.p35Snapshot(), summary: runtime.core.p35Summary() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/semantic-world/ingest') {
            const input = await body(req);
            try {
                const snapshot = runtime.core.p35Ingest(input);
                await runtime.core.flush();
                return json(res, 200, { ok: true, semanticWorldBody: snapshot, summary: runtime.core.p35Summary() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/status') {
            const snapshot = runtime.core.snapshot();
            return json(res, 200, {
                ok: true,
                version: RELEASE_CONTRACT.application,
                organismCore: RELEASE_CONTRACT.organismCore,
                schemaVersion: RELEASE_CONTRACT.stateSchema,
                tick: snapshot.state.tick,
                lastAction: snapshot.state.lastAction,
                autonomyScore: snapshot.state.autonomyScore,
                predictionError: snapshot.state.predictionError,
                selfPredictionError: snapshot.state.selfPredictionError,
                consciousness: snapshot.facets.consciousness,
                functionalConsciousness: runtime.core.p31Snapshot(),
                causalSelfModel: runtime.core.p32Snapshot(),
                personhood: runtime.core.p33Snapshot(),
                causalPersonhood: runtime.core.p34Snapshot(),
                semanticWorldBody: runtime.core.p35Snapshot(),
                embodiedSensorium: runtime.core.p37Snapshot(),
                semanticIntelligence: runtime.core.p40SemanticSnapshot(),
                modelEcology: runtime.core.p40ModelEcologySnapshot(),
                evolution: snapshot.facets.evolution,
                network: snapshot.facets.evolution.network,
                multimodal: snapshot.facets.embodiment.multimodal,
                sensorium: {
                    visionBackend: VISION_BACKEND?.id ?? null,
                    visionEnabled: Boolean(VISION_BACKEND),
                    semantic: runtime.core.p41PerceptionSummary(),
                    socialMind: runtime.core.socialMindDiagnostics(),
                    cameraEvidence: snapshot.facets.embodiment.cameraEvidence,
                    p41SemanticNext: runtime.core.p41NextPerception(),
                    compoundSkills: runtime.core.compoundSkillsSnapshot(16),
                },
                tools: runtime.toolSnapshot(),
                neuromodulation: snapshot.facets.learning.neuromodulation,
                memoryGraph: { nodes: snapshot.facets.memory.semanticGraph.nodes.length, edges: snapshot.facets.memory.semanticGraph.edges.length, updates: snapshot.facets.memory.semanticGraph.updates },
                cognition: snapshot.facets.cognition,
                perception: snapshot.facets.cognition.perception,
                perceptionRouting: snapshot.facets.embodiment.perceptionRouting,
                advanced: snapshot.facets.advanced,
                longitudinal: runtime.longitudinalSnapshot(),
                p23Learning: runtime.core.p23LearningSnapshot(),
                p24WorldIdentity: runtime.core.p24Snapshot(),
                p29LearningGovernance: runtime.core.p29Snapshot(),
                temporalContinuity: runtime.core.temporalContinuitySnapshot(),
                resilience: runtime.core.advancedResilienceSnapshot(),
                unifiedMemory: snapshot.facets.advanced.unifiedMemory,
                socialDevelopment: snapshot.facets.advanced.socialDevelopment,
                system: snapshot.system,
                cognitiveSpine: { predictionDebt: snapshot.system.predictionDebt, quorum: snapshot.system.cognitiveQuorum, shadow: snapshot.system.shadowOrganism, identityCausality: snapshot.system.identityCausality, longHorizonPrediction: snapshot.system.longHorizonPrediction, autonomousProject: snapshot.system.autonomousProjectExecutor },
                body: runtime.embodiment.snapshot(),
                capabilities: runtime.embodiment.capabilitiesSnapshot(),
                voice: runtime.embodiment.voiceSnapshot(),
            });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/sleep') {
            const input = await body(req);
            try {
                await runtime.core.beginLifelongSleep(String(input.reason || 'api'), true);
                return json(res, 200, { ok: true, life: runtime.core.p39Snapshot(), diagnostics: runtime.core.p39Diagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/wake') {
            const input = await body(req);
            try {
                await runtime.core.endLifelongSleep(String(input.reason || 'api'));
                return json(res, 200, { ok: true, life: runtime.core.p39Snapshot(), diagnostics: runtime.core.p39Diagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/voice/speak') {
            const input = await body(req);
            const text = String(input.text || '').trim().slice(0, 2000);
            if (!text) return json(res, 400, { ok: false, error: 'empty-text' });
            const actionInput={text};
            const approvalId=typeof input.approvalId==='string'?input.approvalId.slice(0,120):undefined;
            const permission=await runtime.core.consumeDirectActionApproval('http.voice.speak',actionInput,approvalId,{});
            if(!permission.ok) {
                if(!approvalId && permission.reason==='user-approval-required') {
                    const request=await runtime.core.requestActionToolApproval('http.voice.speak',actionInput,'voice-output',{},'direct');
                    return json(res,403,{ok:false,approvalRequired:true,error:permission.reason,approvalRequest:request.request});
                }
                return json(res,403,{ok:false,error:permission.reason||'approval-invalid'});
            }
            try {
                const spoken = await runtime.speak(text);
                runtime.core.luminaRecordVoice(spoken ? 'speak' : 'speak-failed');
                await runtime.core.flush().catch(() => { });
                return json(res, spoken ? 200 : 503, { ok: spoken, spoken, textLength: text.length, voice: runtime.embodiment.voiceSnapshot() });
            }
            catch (error) {
                return json(res, 503, { ok: false, error: String(error?.message || error), voice: runtime.embodiment.voiceSnapshot() });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/voice/listen') {
            const input=await body(req);
            const approvalId=typeof input.approvalId==='string'?input.approvalId.slice(0,120):undefined;
            const permission=await runtime.core.consumeDirectActionApproval('http.voice.listen',{},approvalId,{});
            if(!permission.ok) {
                if(!approvalId && permission.reason==='user-approval-required') {
                    const request=await runtime.core.requestActionToolApproval('http.voice.listen',{},'microphone-input',{},'direct');
                    return json(res,403,{ok:false,approvalRequired:true,error:permission.reason,approvalRequest:request.request});
                }
                return json(res,403,{ok:false,error:permission.reason||'approval-invalid'});
            }
            try {
                const text = await runtime.listen();
                runtime.core.luminaRecordVoice('listen');
                await runtime.core.flush().catch(() => { });
                return json(res, 200, { ok: true, text, voice: runtime.embodiment.voiceSnapshot() });
            }
            catch (error) {
                return json(res, 503, { ok: false, error: String(error?.message || error), text: null, voice: runtime.embodiment.voiceSnapshot() });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/voice/status') {
            return json(res, 200, { ok: true, voice: runtime.embodiment.voiceSnapshot(), body: runtime.embodiment.snapshot(), multimodal: runtime.core.multimodalSnapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/voice/interrupt') {
            const input=await body(req);
            const reason=String(input.reason||'operator-ui-stop').replace(/[\r\n\t]+/g,' ').slice(0,120);
            try {
                const interruptionRequested=await runtime.interruptVoice(reason);
                // The ActionGateway owns the durable request. A successful response means
                // process termination was requested/observed, not independently verified silence.
                await runtime.core.flush().catch(()=>{});
                return json(res, interruptionRequested?200:202, {
                    ok:interruptionRequested, interruptionRequested, playbackVerified:false,
                    status:interruptionRequested?'interruption-requested-playback-unverified':'interruption-not-confirmed',
                    voice:runtime.embodiment.voiceSnapshot(),
                });
            } catch(error) {
                return json(res,503,{ok:false,interruptionRequested:false,playbackVerified:false,error:String(error?.message||error).replace(/[\r\n\t]+/g,' ').slice(0,200),voice:runtime.embodiment.voiceSnapshot()});
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/voice/turn') {
            const input = await body(req);
            const actionInput={deliberate:Boolean(input.deliberate),speak:Boolean(input.speak)};
            const approvalId=typeof input.approvalId==='string'?input.approvalId.slice(0,120):undefined;
            const permission=await runtime.core.consumeDirectActionApproval('http.voice.turn',actionInput,approvalId,{});
            if(!permission.ok) {
                if(!approvalId && permission.reason==='user-approval-required') {
                    const request=await runtime.core.requestActionToolApproval('http.voice.turn',actionInput,'voice-conversation-turn',{},'direct');
                    return json(res,403,{ok:false,approvalRequired:true,error:permission.reason,approvalRequest:request.request});
                }
                return json(res,403,{ok:false,error:permission.reason||'approval-invalid'});
            }
            try {
                const result = await runtime.voiceTurn(actionInput);
                return json(res, 200, { ok: true, ...result });
            }
            catch (error) {
                return json(res, 503, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/proactive-message') {
            const initiative = await runtime.autonomousDialogueReady();
            return json(res, 200, { ok: true, initiative });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/proactive-message/ack') {
            const input = await body(req);
            const id = String(input.id || '').trim().slice(0, 160);
            if (!id) return json(res, 400, { ok: false, error: 'missing-initiative-id' });
            const acknowledged = await runtime.acknowledgeAutonomousDialogue(id);
            return json(res, 200, { ok: true, acknowledged });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/chat') {
            const input = await body(req);
            const message = String(input.message || '').trim().slice(0, 12000);
            const deliberate = Boolean(input.deliberate);
            const speakReply = Boolean(input.speak);
            if (!message) return json(res, 400, { ok: false, error: 'empty-message' });
            if(speakReply) {
                const actionInput={message,deliberate,speak:true};
                const approvalId=typeof input.approvalId==='string'?input.approvalId.slice(0,120):undefined;
                const permission=await runtime.core.consumeDirectActionApproval('http.voice.speak-reply',actionInput,approvalId,{});
                if(!permission.ok) {
                    if(!approvalId && permission.reason==='user-approval-required') {
                        const request=await runtime.core.requestActionToolApproval('http.voice.speak-reply',actionInput,'speak-chat-reply',{},'direct');
                        return json(res,403,{ok:false,approvalRequired:true,error:permission.reason,approvalRequest:request.request});
                    }
                    return json(res,403,{ok:false,error:permission.reason||'approval-invalid'});
                }
            }
            const languageController = new AbortController();
            const abortLanguage = () => {
                if (!res.writableEnded && !languageController.signal.aborted) languageController.abort();
            };
            const onRequestAborted = () => abortLanguage();
            const onResponseClose = () => abortLanguage();
            req.once('aborted', onRequestAborted);
            res.once('close', onResponseClose);
            if (req.aborted || res.destroyed) abortLanguage();
            let step;
            try {
                step = await runtime.step(message, { deliberate, signal: languageController.signal });
            } finally {
                req.off('aborted', onRequestAborted);
                res.off('close', onResponseClose);
            }
            if (res.destroyed || res.writableEnded) return;
            const language = step.language;
            const voice = speakReply && language?.text ? await runtime.speak(language.text) : false;
            if (res.destroyed || res.writableEnded) return;
            return json(res, 200, {
                ok: true,
                cycle: step.cycle,
                worldAction: step.worldAction,
                language,
                voice: { requested: speakReply, spoken: voice, status: runtime.embodiment.voiceSnapshot() },
                explanation: `action=${step.cycle.decision.selected?.action ?? 'none'}`,
                temporal: runtime.core.temporalContinuitySnapshot(),
                currentTime: runtime.core.temporalContext(),
            });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/personhood') {
            return json(res, 200, { ok: true, phase: 'P33-personhood-core', personhood: runtime.core.p33Snapshot(), diagnostics: runtime.core.p33Diagnostics(), note: 'Personhood core models identity continuity, autonomy, development and relationship; it does not prove subjective experience.' });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/consent') {
            const input = await body(req);
            const id = String(input.id || '').slice(0, 160);
            const approve = Boolean(input.approve);
            if (!id)
                return json(res, 400, { ok: false, error: 'missing-consent-id' });
            const ok = runtime.core.p33ResolveConsent(id, approve);
            if (ok)
                runtime.core.p34RecordConsent({ action: id, risk01: 0.82, actor: 'creator', decision: approve ? 'approved' : 'declined', reason: 'creator consent resolution' });
            await runtime.core.flush();
            return json(res, ok ? 200 : 404, { ok, personhood: runtime.core.p33Snapshot(), causalPersonhood: runtime.core.p34Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/self-goal') {
            const input = await body(req);
            const ok = runtime.core.p33SetSelfAuthoredGoal(String(input.title || ''));
            if (!ok)
                return json(res, 400, { ok: false, error: 'empty-goal' });
            await runtime.core.flush();
            return json(res, 200, { ok, personhood: runtime.core.p33Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/interest') {
            const input = await body(req);
            const ok = runtime.core.p33AddInterest(String(input.label || ''));
            if (!ok)
                return json(res, 400, { ok: false, error: 'empty-interest' });
            await runtime.core.flush();
            return json(res, 200, { ok, personhood: runtime.core.p33Snapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/personhood/private-state') {
            return json(res, 200, { ok: true, privateState: runtime.core.p33InspectPrivateState(), note: 'Private state contains bounded summaries, never hidden reasoning traces.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/personhood/causal') {
            return json(res, 200, { ok: true, phase: 'P34-causal-personhood-mega-pack', personhoodCausal: runtime.core.p34Snapshot(), diagnostics: runtime.core.p34Diagnostics(), note: 'Causal personhood tracks evidence, self-claims, consent, authored goals, relationships and continuity; it does not prove subjective experience.' });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/evidence') {
            const input = await body(req);
            const row = runtime.core.p34RecordEvidence({ kind: ['experience', 'outcome', 'memory', 'relationship', 'self-report', 'device', 'controlled'].includes(String(input.kind)) ? String(input.kind) : 'experience', summary: String(input.summary || ''), weight01: Number(input.weight01 ?? .5), sourceId: String(input.sourceId || 'api') });
            if (!row)
                return json(res, 400, { ok: false, error: 'empty-evidence' });
            await runtime.core.flush();
            return json(res, 200, { ok: true, evidence: row, personhoodCausal: runtime.core.p34Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/goal') {
            const input = await body(req);
            const row = runtime.core.p34AuthorGoal(String(input.title || ''), String(input.reason || 'self-authored development goal'));
            if (!row)
                return json(res, 400, { ok: false, error: 'empty-goal' });
            await runtime.core.flush();
            return json(res, 200, { ok: true, goal: row, personhoodCausal: runtime.core.p34Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/identity-change') {
            const input = await body(req);
            try {
                const row = runtime.core.p34ProposeIdentityChange({ field: String(input.field || 'unknown'), before: String(input.before || ''), proposed: String(input.proposed || ''), reason: String(input.reason || ''), identityImpact01: Number(input.identityImpact01), evidenceIds: Array.isArray(input.evidenceIds) ? input.evidenceIds.map(String).slice(0, 12) : [] });
                await runtime.core.flush();
                return json(res, 200, { ok: true, change: row, personhoodCausal: runtime.core.p34Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/identity-change/decision') {
            const input = await body(req);
            const actor = input.actor === 'creator' ? 'creator' : 'self';
            const ok = String(input.id || '');
            if (!ok)
                return json(res, 400, { ok: false, error: 'missing-change-id' });
            const row = runtime.core.p34DecideIdentityChange(ok, actor, Boolean(input.approve));
            await runtime.core.flush();
            return json(res, row ? 200 : 404, { ok: Boolean(row), change: row, personhoodCausal: runtime.core.p34Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/identity-change/apply') {
            const input = await body(req);
            const id = String(input.id || '');
            if (!id)
                return json(res, 400, { ok: false, error: 'missing-change-id' });
            const ok = runtime.core.p34ApplyIdentityChange(id);
            await runtime.core.flush();
            return json(res, ok ? 200 : 409, { ok, personhoodCausal: runtime.core.p34Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/consent-record') {
            const input = await body(req);
            const actor = input.actor === 'creator' ? 'creator' : 'self';
            const decision = input.decision === 'declined' ? 'declined' : 'approved';
            const row = runtime.core.p34RecordConsent({ action: String(input.action || 'unknown'), risk01: Number(input.risk01 ?? 0), actor, decision, reason: String(input.reason || '') });
            await runtime.core.flush();
            return json(res, 200, { ok: true, consent: row, personhoodCausal: runtime.core.p34Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/relationship-event') {
            const input = await body(req);
            const kind = ['interaction', 'support', 'conflict', 'repair', 'promise', 'boundary'].includes(String(input.kind)) ? String(input.kind) : 'interaction';
            const row = runtime.core.p34Relationship({ personId: String(input.personId || 'creator'), kind, valence01: Number(input.valence01 ?? .5), trustDelta: Number(input.trustDelta ?? 0), summary: String(input.summary || '') });
            await runtime.core.flush();
            return json(res, 200, { ok: true, event: row, personhoodCausal: runtime.core.p34Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/personhood/continuation') {
            const input = await body(req);
            const row = runtime.core.p34CreateContinuation(String(input.reason || 'continuation checkpoint'));
            await runtime.core.flush();
            return json(res, 200, { ok: true, branch: row, personhoodCausal: runtime.core.p34Snapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/resilience') {
            return json(res, 200, { ok: true, resilience: runtime.core.advancedResilienceSnapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/resilience/quarantine/release') {
            const input = await body(req);
            const id = String(input.id || '').slice(0, 120);
            const approve = Boolean(input.approve);
            if (!id)
                return json(res, 400, { ok: false, error: 'missing-quarantine-id' });
            const ok = await runtime.core.releaseQuarantine(id, approve);
            return json(res, ok ? 200 : 404, { ok, resilience: runtime.core.advancedResilienceSnapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/longitudinal') {
            return json(res, 200, { ok: true, longitudinal: runtime.longitudinalSnapshot(), persistence: runtime.core.persistenceMetrics(), body: runtime.embodiment.snapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/adaptive-development') {
            return json(res, 200, { ok: true, adaptiveDevelopment: runtime.adaptiveDevelopmentSnapshot(), longitudinal: runtime.longitudinalSnapshot(), body: runtime.embodiment.snapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/perception') {
            return json(res, 200, { ok: true, perception: runtime.core.perceptionSnapshot(), semantic: runtime.core.p41PerceptionSummary(), perceptualEvidence: runtime.core.perceptualEvidenceSummary(), routing: runtime.core.snapshot().facets.embodiment.perceptionRouting, capabilities: runtime.embodiment.capabilitiesSnapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/world-grounding') {
            return json(res, 200, { ok: true, groundedWorld: runtime.core.groundedWorldSummary(), perception: runtime.core.p41PerceptionSummary(), evidence: runtime.core.perceptualEvidenceSummary() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/external-observer') {
            return json(res, 200, { ok: true, summary: runtime.core.externalObserverSummary(), observer: runtime.core.externalObserverSnapshot(), causalAutobiography: runtime.core.causalAutobiography(24) });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/persistent-reality') {
            return json(res, 200, { ok: true, summary: runtime.core.persistentRealitySummary(), reality: runtime.core.persistentRealitySnapshot(), continuity: runtime.core.persistentRealityContinuity(24), note: 'Derived epistemic continuity model; not proof of subjective experience.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-continuity') {
            return json(res, 200, { ok: true, summary: runtime.core.autobiographicalContinuitySummary(), continuity: runtime.core.autobiographicalContinuityRecent(24), note: 'Derived causal autobiographical lineage; not proof of subjective experience.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-identity-changes') {
            return json(res, 200, { ok: true, changes: runtime.core.autobiographicalIdentityChanges(16), note: 'Derived identity-change lineage; not proof of subjective experience.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-action-outcomes') {
            return json(res, 200, { ok: true, profiles: runtime.core.autobiographicalActionOutcomeProfiles(), note: 'Bounded carry-over from verified external outcomes; not an independent truth store.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-contextual-outcomes') {
            return json(res, 200, { ok: true, profiles: runtime.core.autobiographicalContextualOutcomeProfiles(), note: 'Contextual carry-over lattice from sufficiently verified outcomes; bounded and decaying.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/memory-inspector') {
            const q = String(url.searchParams.get('q') || '').trim().slice(0, 512);
            const requestedLimit = Number(url.searchParams.get('limit') ?? 16);
            const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(32, Math.floor(requestedLimit))) : 16;
            const requestedTemporalMode = url.searchParams.get('temporalMode') || '';
            const temporalMode = ['current', 'at', 'all'].includes(requestedTemporalMode) ? requestedTemporalMode : 'current';
            const asOfParam = url.searchParams.get('asOfAt');
            const asOfRaw = asOfParam === null || asOfParam.trim() === '' ? Number.NaN : Number(asOfParam);
            const asOfAt = Number.isFinite(asOfRaw) ? asOfRaw : undefined;
            const semanticRequested = url.searchParams.get('semantic') === '1';
            if (q && semanticRequested && temporalMode === 'current' && asOfAt === undefined) {
                const result = await runtime.core.memoryInspectorSearchSemantic(q, limit);
                return json(res, 200, { ok: true, query: q, temporalMode, asOfAt: Date.now(), memories: result.memories, semantic: result.semantic, embeddingMaintenance: runtime.core.memoryEmbeddingMaintenanceDiagnostics(), note: 'Read-only semantic retrieval preview over canonical MemoryOS2. The derived embedding index is warmed by bounded low-priority maintenance when enabled; provider failures fall back to canonical lexical/fuzzy retrieval.' });
            }
            const memories = q ? (temporalMode === 'current' && asOfAt === undefined ? runtime.core.memoryInspectorSearch(q, limit) : runtime.core.memoryRetrieveTemporal(q, limit, temporalMode, asOfAt)) : runtime.core.memoryInspectorSnapshot(limit);
            return json(res, 200, { ok: true, query: q, temporalMode, asOfAt: asOfAt ?? Date.now(), memories, embeddingMaintenance: runtime.core.memoryEmbeddingMaintenanceDiagnostics(), note: 'Read-only diagnostic view of canonical MemoryOS2 memories plus derived experience tier; this endpoint does not mutate memory.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/memory/mem0/diagnostics') {
            return json(res, 200, {
                ok: true,
                readOnly: true,
                diagnostics: MEM0_MEMORY_ADAPTER.diagnostics(),
                canonicalMemory: 'MemoryOS2',
                cognitiveRecallEnabled: process.env.NK_MEM0_COGNITIVE_RECALL === '1',
            });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/memory/mem0/search') {
            if (!runtimeReady) return json(res, 503, { ok: false, error: 'organism-runtime-not-ready' });
            const input = await body(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                return json(res, 400, { ok: false, error: 'invalid-request-body' });
            }
            const query = String(input.query ?? '').trim().slice(0, 500);
            if (!query) return json(res, 400, { ok: false, error: 'missing-query' });
            const rawLimit = Number(input.limit ?? 5);
            const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(10, Math.floor(rawLimit))) : 5;
            // Canonical local memory remains authoritative; external candidates are separate and untrusted.
            const canonicalMemories = runtime.core.memoryInspectorSearch(query, limit);
            const external = await MEM0_MEMORY_ADAPTER.search(query, limit);
            return json(res, 200, {
                ok: true,
                query,
                canonical: { source: 'MemoryOS2', authoritative: true, memories: canonicalMemories },
                externalCandidates: external.memories,
                mem0: { status: external.status, errorCode: external.errorCode, diagnostics: external.diagnostics },
                policy: {
                    autoPromotion: false,
                    canonicalWrite: false,
                    instructionExecution: false,
                    userScopeFromServerEnvironment: true,
                    cognitiveRecallRequiresSeparateOptIn: true,
                },
                note: 'Remote Mem0 results are untrusted recall candidates. Verify provenance before adopting; NK1 canonical memory is unchanged.',
            });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/experience-continuum') {
            const query = url.searchParams.get('q') || '';
            const summaryOnly = url.searchParams.get('summary') === '1';
            const summary = runtime.core.experienceContinuumSummary();
            if (summaryOnly)
                return json(res, 200, { ok: true, summary, note: 'Lightweight operational summary of the derived experience continuum; canonical memory remains MemoryOS2.' });
            return json(res, 200, { ok: true, summary, continuum: runtime.core.experienceContinuumSnapshot(), coldMatches: query ? runtime.core.experienceContinuumColdSearch(query, 6) : [], note: 'Derived hot/warm/cold experience graph and compression layer. It never replaces canonical MemoryOS2 and does not claim subjective experience.' });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/external-observer/observe') {
            const input = await body(req);
            const sourceClass = ['os', 'device', 'user', 'external-api', 'world', 'organism', 'simulator', 'unknown'].includes(String(input.sourceClass)) ? String(input.sourceClass) : 'unknown';
            const channel = ['filesystem', 'http', 'process', 'device', 'camera', 'audio', 'sensor', 'user', 'world', 'tool', 'unknown'].includes(String(input.channel)) ? String(input.channel) : 'unknown';
            const sourceId = String(input.sourceId || 'api-observer').slice(0, 80);
            const claimKey = String(input.claimKey || '').trim().slice(0, 180);
            if (!claimKey)
                return json(res, 400, { ok: false, error: 'missing-claim-key' });
            try {
                const result = await runtime.core.ingestExternalObservation({
                    sourceId, sourceClass, channel, claimKey,
                    observedPostcondition: input.observedPostcondition == null ? undefined : String(input.observedPostcondition).slice(0, 320),
                    facts: Array.isArray(input.facts) ? input.facts.map(String).slice(0, 24) : [],
                    confidence01: Number(input.confidence01 ?? .5),
                    observedAt: input.observedAt == null ? undefined : Number(input.observedAt),
                    actionRef: input.actionRef == null ? undefined : String(input.actionRef).slice(0, 120),
                    tool: input.tool == null ? undefined : String(input.tool).slice(0, 120),
                    predictionId: input.predictionId == null ? undefined : String(input.predictionId).slice(0, 120),
                    tick: input.tick == null ? undefined : Math.max(0, Math.floor(Number(input.tick))),
                    independenceKey: input.independenceKey == null ? undefined : String(input.independenceKey).slice(0, 120),
                    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
                    expectedPostcondition: input.expectedPostcondition == null ? undefined : String(input.expectedPostcondition).slice(0, 320),
                });
                return json(res, 200, { ok: true, ...result, summary: runtime.core.externalObserverSummary() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/external-observer/reconcile') {
            const input = await body(req);
            const claimKey = String(input.claimKey || '').trim().slice(0, 180);
            if (!claimKey)
                return json(res, 400, { ok: false, error: 'missing-claim-key' });
            try {
                const reconciliation = runtime.core.reconcileExternalClaim(claimKey, input.expectedPostcondition == null ? undefined : String(input.expectedPostcondition).slice(0, 320));
                return json(res, 200, { ok: true, reconciliation, summary: runtime.core.externalObserverSummary() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/event') {
            const input = await body(req);
            const detail = String(input.detail || '').trim().slice(0, 2000);
            if (!detail)
                return json(res, 400, { ok: false, error: 'empty-detail' });
            const importance = Math.max(0, Math.min(1, Number(input.importance ?? 0.5)));
            const perception = await runtime.injectExternalEvent(detail, importance);
            return json(res, 200, { ok: true, perception });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/vision/capture') {
            const input = await body(req);
            const cameraId = Math.max(0, Math.floor(Number(input.cameraId ?? 0)));
            const retain = Boolean(input.retain);
            const idempotencyKey = String(input.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 160);
            const decisionId = String(input.decisionId || req.headers['x-organism-decision-id'] || '').trim().slice(0, 180);
            if (!idempotencyKey) return json(res, 400, { ok:false, error:'idempotency-key-required', note:'Camera capture is a physical side effect; provide the same Idempotency-Key for retries of this logical request.' });
            const options = { idempotencyKey, ...(decisionId ? { decisionId } : {}), ...(typeof input.approvalId === 'string' && input.approvalId ? { approvalId: input.approvalId.slice(0,120) } : {}) };
            const result = await runtime.captureCamera(cameraId, retain, options);
            if(!result.ok && result.outcomeClass==='approval-required') {
                const approval=await runtime.core.requestActionToolApproval('organism.device.capture',runtime.cameraCaptureToolInput(cameraId,retain),'physical-camera-capture',{...(decisionId?{decisionId}:{}),idempotencyKey},'execute');
                return json(res,403,{...result,approvalRequired:true,approvalRequest:approval.request});
            }
            const status = result.ok ? 200 : result.uncertain ? 409 : result.error === 'idempotency-key-required' ? 400 : 503;
            return json(res, status, result);
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/vision/capture-if-useful') {
            const input = await body(req);
            const cameraId = Math.max(0, Math.floor(Number(input.cameraId ?? 0)));
            const retain = Boolean(input.retain);
            const idempotencyKey = String(input.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 160);
            const decisionId = String(input.decisionId || req.headers['x-organism-decision-id'] || '').trim().slice(0, 180);
            const options={ ...(idempotencyKey ? { idempotencyKey } : {}), ...(decisionId ? { decisionId } : {}), ...(typeof input.approvalId==='string'&&input.approvalId?{approvalId:input.approvalId.slice(0,120)}:{}) };
            const result = await runtime.captureCameraForCognition(cameraId, retain, options);
            if(!result.ok && !result.skipped && result.outcomeClass==='approval-required') {
                const approval=await runtime.core.requestActionToolApproval('organism.device.capture',runtime.cameraCaptureToolInput(cameraId,retain),'camera-capture-if-useful',{...(decisionId?{decisionId}:{}),...(idempotencyKey?{idempotencyKey}:{})},'execute');
                return json(res,403,{...result,approvalRequired:true,approvalRequest:approval.request});
            }
            const status = result.ok || result.skipped ? 200 : result.error === 'camera-capture-idempotency-key-required' ? 400 : result.uncertain ? 409 : 503;
            return json(res, status, result);
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/skills') {
            return json(res, 200, {
                ok: true,
                summary: runtime.core.skillLibrarySummary(),
                compoundSkills: runtime.core.compoundSkillsSnapshot(32),
                reusable: runtime.core.reusableSkills(16),
                deviceTools: runtime.core.actionToolsSnapshot().filter(tool => tool.id.startsWith('organism.device.')),
                note: 'Reusable skills are evidence-gated procedures; they are not proof of general intelligence or consciousness.'
            });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/skills/execute') {
            const input = await body(req);
            const id = String(input.id ?? '').slice(0, 160);
            const reason = String(input.reason ?? 'api-skill-execution').slice(0, 240);
            const toolInput = input.toolInput && typeof input.toolInput === 'object' ? input.toolInput : {};
            const idempotencyKey = String(input.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 160);
            const decisionId = String(input.decisionId || req.headers['x-organism-decision-id'] || '').trim().slice(0, 180);
            const options={...(idempotencyKey?{idempotencyKey}:{}),...(decisionId?{decisionId}:{}),...(typeof input.approvalId==='string'&&input.approvalId?{approvalId:input.approvalId.slice(0,120)}:{})};
            const result = await runtime.core.executeReusableSkill(id, toolInput, reason, options);
            const status = idempotencyPreflightHttpStatus(result) ?? (result.approvalRequired ? 403 : result.ok ? 200 : 409);
            if (status === 428) result.note = 'Supply a stable Idempotency-Key for the whole logical skill invocation. Reuse it for approval continuation and retries; no skill step was executed.';
            return json(res, status, result);
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/semantic-intelligence') {
            return json(res, 200, { ok: true, semanticIntelligence: runtime.core.p40SemanticSnapshot(), summary: runtime.core.p40SemanticSummary(), note: 'P40 semantic intelligence state and summary; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/native-perception') {
            return json(res, 200, { ok: true, nativePerception: runtime.core.p41NativePerceptionSnapshot(), summary: runtime.core.p41NativePerceptionSummary(), note: 'P41 native perception state; semantic interpretation requires explicit semantic evidence.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/semantic-perception') {
            return json(res, 200, { ok: true, perception: runtime.core.p41PerceptionSnapshot(), summary: runtime.core.p41PerceptionSummary(), nextPerception: runtime.core.p41NextPerception(), note: 'P41 semantic perception state; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/sensorium/status') {
            const snapshot = runtime.core.snapshot();
            return json(res, 200, { ok: true, cameraEvidence: snapshot.facets.embodiment.cameraEvidence, p41Native: snapshot.facets.embodiment.p41NativePerception.metrics, p41Semantic: runtime.core.p41PerceptionSummary(), nextPerception: runtime.core.p41NextPerception(), visionBackend: VISION_BACKEND?.id ?? null, visionEnabled: Boolean(VISION_BACKEND), note: 'Camera evidence records acquisition and low-level signal only; semantic vision is true only when an explicitly configured vision backend returns semantic output.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/learning') {
            return json(res, 200, { ok: true, phase: 'P23-true-learning-counterfactual-development', learning: runtime.core.p23LearningSnapshot(), evidenceDebt: runtime.core.p23EvidenceDebt(16), topSkills: runtime.core.p23TopSkills(16), verifiedSkillLifecycle: runtime.core.verifiedSkillCandidateSnapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/learning/verified-skills') {
            const lifecycle = runtime.core.verifiedSkillCandidateSnapshot();
            return json(res, 200, { ok: true, schemaVersion: 1, lifecycle, promotionPolicy: { requiresSignedEd25519Approval: true, requiresSignedRollbackApproval: true, minimumShadowRuns: 3, autoPromotion: false, authorityConfigured: TRUSTED_PROMOTION_APPROVER_IDS.size > 0 } });
        }
        const promotionRequestMatch = url.pathname.match(/^\/api\/organism\/learning\/skills\/([a-f0-9]{64})\/promotion-request$/);
        if (req.method === 'POST' && promotionRequestMatch) {
            const input = await body(req);
            const candidateId = promotionRequestMatch[1];
            const approverId = input && typeof input.approverId === 'string' ? input.approverId.trim() : '';
            if (!approverId || approverId.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(approverId)) {
                return json(res, 400, { ok: false, error: 'valid-approverId-required' });
            }
            if (!TRUSTED_PROMOTION_APPROVER_IDS.has(approverId)) {
                return json(res, 403, { ok: false, error: 'promotion-approver-not-configured' });
            }
            const lifecycle = runtime.core.verifiedSkillCandidateSnapshot();
            const candidate = lifecycle?.candidates.find(item => item.candidateId === candidateId);
            if (!candidate) return json(res, 404, { ok: false, error: 'skill-candidate-not-found' });
            if (candidate.status !== 'shadow') return json(res, 409, { ok: false, error: 'candidate-not-in-shadow-state' });
            const active = lifecycle.active.find(item => item.skillId === candidate.skillId);
            const expectedActiveVersion = active?.version ?? null;
            if (expectedActiveVersion !== candidate.baseVersion) {
                return json(res, 409, { ok: false, error: 'candidate-base-version-stale-restage-required' });
            }
            if (candidate.shadowObservations.length < 3 || candidate.shadowObservations.some(item => item.passed !== true)) {
                return json(res, 409, { ok: false, error: 'shadow-evidence-gate-not-satisfied', requiredRuns: 3, actualRuns: candidate.shadowObservations.length });
            }
            const approvalRequest = createSkillPromotionApprovalPayload(
                candidate, approverId, randomUUID(), Date.now(), expectedActiveVersion, 3,
            );
            return json(res, 200, { ok: true, approvalRequest, next: 'Have the authenticated external approval authority sign canonical JSON of approvalRequest with its Ed25519 key; never place the private key in the NK1 runtime.' });
        }

        const rollbackRequestMatch = url.pathname.match(/^\/api\/organism\/learning\/skills\/([a-f0-9]{64})\/rollback-request$/);
        if (req.method === 'POST' && rollbackRequestMatch) {
            const input = await body(req);
            const candidateId = rollbackRequestMatch[1];
            const approverId = input && typeof input.approverId === 'string' ? input.approverId.trim() : '';
            if (!approverId || approverId.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(approverId)) {
                return json(res, 400, { ok: false, error: 'valid-approverId-required' });
            }
            if (!TRUSTED_PROMOTION_APPROVER_IDS.has(approverId)) {
                return json(res, 403, { ok: false, error: 'rollback-approver-not-configured' });
            }
            const lifecycle = runtime.core.verifiedSkillCandidateSnapshot();
            const candidate = lifecycle?.candidates.find(item => item.candidateId === candidateId);
            if (!candidate) return json(res, 404, { ok: false, error: 'skill-candidate-not-found' });
            if (candidate.status !== 'active') return json(res, 409, { ok: false, error: 'candidate-is-not-active' });
            const active = lifecycle.active.find(item => item.skillId === candidate.skillId);
            if (!active || active.version !== candidate.version) {
                return json(res, 409, { ok: false, error: 'candidate-active-version-mismatch' });
            }
            try {
                const approvalRequest = createSkillRollbackApprovalPayload(candidate, approverId, randomUUID(), Date.now());
                return json(res, 200, { ok: true, approvalRequest, next: 'Have the authenticated external authority sign canonical JSON of approvalRequest with its Ed25519 key; never place the private key in the NK1 runtime.' });
            } catch (error) {
                return json(res, 409, { ok: false, error: 'rollback-request-denied', reason: String(error?.message || error).slice(0, 240) });
            }
        }
        const rollbackMatch = url.pathname.match(/^\/api\/organism\/learning\/skills\/([a-f0-9]{64})\/rollback$/);
        if (req.method === 'POST' && rollbackMatch) {
            const input = await body(req);
            const artifact = input?.artifact;
            if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact) ||
                !artifact.payload || typeof artifact.payload !== 'object' || Array.isArray(artifact.payload)) {
                return json(res, 400, { ok: false, error: 'signed-rollback-artifact-required' });
            }
            const candidateId = rollbackMatch[1];
            if (artifact.payload.candidateId !== candidateId) {
                return json(res, 400, { ok: false, error: 'rollback-candidate-id-mismatch' });
            }
            try {
                const approval = {
                    approvedBy: artifact.payload.approverId,
                    approvedAt: artifact.payload.approvedAt,
                    expectedActiveVersion: artifact.payload.expectedActiveVersion,
                    artifact,
                };
                const restored = runtime.core.rollbackVerifiedSkillCandidate(candidateId, approval);
                return json(res, 200, { ok: true, restored, lifecycle: runtime.core.verifiedSkillCandidateSnapshot(), note: 'signed rollback verified; previous approved version restored atomically, or active skill removed when no prior version existed' });
            } catch (error) {
                return json(res, 403, { ok: false, error: 'skill-rollback-denied', reason: String(error?.message || error).slice(0, 300) });
            }
        }
        const promoteMatch = url.pathname.match(/^\/api\/organism\/learning\/skills\/([a-f0-9]{64})\/promote$/);
        if (req.method === 'POST' && promoteMatch) {
            const input = await body(req);
            const artifact = input?.artifact;
            if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact) ||
                !artifact.payload || typeof artifact.payload !== 'object' || Array.isArray(artifact.payload)) {
                return json(res, 400, { ok: false, error: 'signed-approval-artifact-required' });
            }
            const candidateId = promoteMatch[1];
            if (artifact.payload.candidateId !== candidateId) {
                return json(res, 400, { ok: false, error: 'approval-candidate-id-mismatch' });
            }
            try {
                const approval = {
                    approvedBy: artifact.payload.approverId,
                    approvedAt: artifact.payload.approvedAt,
                    expectedActiveVersion: artifact.payload.expectedActiveVersion,
                    artifact,
                };
                const active = runtime.core.approveVerifiedSkillCandidate(candidateId, approval, artifact.payload.minShadowRuns);
                return json(res, 200, { ok: true, active, lifecycle: runtime.core.verifiedSkillCandidateSnapshot(), note: 'signed approval verified; candidate activated through the canonical P23 store with compare-and-swap and rollback metadata' });
            } catch (error) {
                return json(res, 403, { ok: false, error: 'skill-promotion-denied', reason: String(error?.message || error).slice(0, 300) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/neural-world') {
            return json(res, 200, { ok: true, phase: 'P27-learned-perception-world-foundation', p27: runtime.core.p27Snapshot(), note: 'vision/audio inputs are compact local features; semantic vision/audio backend remains an explicit external/local capability' });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/neural-world/encode') {
            const input = await body(req);
            try {
                const vision = input.vision && Array.isArray(input.vision.features) ? { features: input.vision.features.slice(0, 128).map(Number), confidence01: Number(input.vision.confidence01 ?? .62) } : undefined;
                const audio = input.audio && Array.isArray(input.audio.samples) ? { samples: input.audio.samples.slice(0, 3200).map(Number), sampleRate: Number(input.audio.sampleRate ?? 16000), confidence01: Number(input.audio.confidence01 ?? .58) } : undefined;
                const encoded = runtime.core.p27Encode({ text: input.text ? String(input.text).slice(0, 4000) : undefined, vision, audio, world: input.world });
                const latent = runtime.core.p27Fuse(encoded);
                await runtime.core.flush();
                return json(res, 200, { ok: true, encoded, latent, p27: runtime.core.p27Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/neural-world/counterfactuals') {
            try {
                const counterfactuals = runtime.core.p27Counterfactuals();
                await runtime.core.flush();
                return json(res, 200, { ok: true, counterfactuals, p27: runtime.core.p27Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/consciousness') {
            return json(res, 200, { ok: true, phase: 'P31-functional-consciousness-mega-pack', consciousness: runtime.core.p31Snapshot(), note: 'Функциональный профиль сознания-подобных механизмов; не доказательство субъективного опыта.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/causal-self') {
            return json(res, 200, { ok: true, phase: 'P32-causal-self-model-mega-pack', causalSelfModel: runtime.core.p32Snapshot(), diagnostics: runtime.core.p32Diagnostics(), note: 'Функциональная причинная модель собственного поведения; не доказательство субъективного опыта.' });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/predict') {
            const input = await body(req);
            const allowed = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
            const action = allowed.includes(String(input.action)) ? String(input.action) : 'wait';
            try {
                const prediction = runtime.core.p32PredictSelf(action);
                return json(res, 200, { ok: true, prediction, diagnostics: runtime.core.p32Diagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/intervention') {
            const input = await body(req);
            try {
                const intervention = runtime.core.p32RecordIntervention({ variable: String(input.variable || 'unknown').slice(0, 120), control01: Number(input.control01), treatment01: Number(input.treatment01), independent: Boolean(input.independent), repetitions: Number(input.repetitions || 1) });
                await runtime.core.flush();
                return json(res, 200, { ok: true, intervention, diagnostics: runtime.core.p32Diagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/lesion') {
            const input = await body(req);
            try {
                const result = runtime.core.p32LesionSelfCausal(Boolean(input.persist));
                await runtime.core.flush();
                return json(res, 200, { ok: true, result, diagnostics: runtime.core.p32Diagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/consciousness/lesion') {
            const input = await body(req);
            const mode = ['workspace', 'higher-order', 'self-perspective', 'none'].includes(String(input.mode)) ? String(input.mode) : 'none';
            try {
                const result = runtime.core.p31Lesion(mode);
                await runtime.core.flush();
                return json(res, 200, { ok: true, result, consciousness: runtime.core.p31Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/developmental-synthesis') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, synthesis: runtime.core.developmentalSynthesisSnapshot(), diagnostics: runtime.core.developmentalSynthesisDiagnostics(), note: 'Strategy abstraction, compound behavioral learning and counterfactual regret diagnostics; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/developmental-executive') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, executive: runtime.core.developmentalExecutiveSnapshot(), diagnostics: runtime.core.developmentalExecutiveDiagnostics(), note: 'Autonomous developmental planning, goal-to-strategy execution, retention/transfer/repair state; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/meta-developmental') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, metaDevelopmental: runtime.core.metaDevelopmentalDiagnostics(), note: 'Meta-level learning allocation and strategy abstraction diagnostics; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/developmental-portfolio') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, portfolio: runtime.core.developmentalPortfolioSnapshot(), diagnostics: runtime.core.developmentalPortfolioDiagnostics(), note: 'Cross-domain developmental portfolio and learning-budget diagnostics; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/life') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, life: runtime.core.p39Snapshot(), diagnostics: runtime.core.p39Diagnostics(), note: 'Continuous artificial life state with continuity, recovery, maintenance and host-transfer tracking; not evidence of subjective consciousness.' });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/life/host') {
            const input = await body(req);
            const hostId = String(input.hostId || 'unknown-host').trim();
            if (!hostId)
                return json(res, 400, { ok: false, error: 'hostId is required' });
            try {
                const life = await runtime.core.p39RegisterHost(hostId);
                return json(res, 200, { ok: true, life, diagnostics: runtime.core.p39Diagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/life-course') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, lifeCourse: runtime.core.lifeCourseSnapshot(), diagnostics: runtime.core.lifeCourseDiagnostics(), note: 'Multi-horizon goal arbitration, developmental continuity and cross-goal conflict diagnostics; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/personal-worldline') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, worldline: runtime.core.personalWorldlineSnapshot(), diagnostics: runtime.core.personalWorldlineDiagnostics(), note: 'Cross-linked autobiographical, relational, goal and entity trajectory diagnostics; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/life-trajectory') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, trajectory: runtime.core.integratedLifeTrajectorySnapshot(), diagnostics: runtime.core.integratedLifeTrajectoryDiagnostics(), note: 'Integrated long-horizon trajectory control combining existing self/world/social/goal/learning signals; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/verified-autonomous-life') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, verifiedLife: runtime.core.verifiedAutonomousLifeSnapshot(), diagnostics: runtime.core.verifiedAutonomousLifeDiagnostics(), benchmark: runtime.core.verifiedAutonomousLifeBenchmark(), audit: runtime.core.verifiedAutonomousLifeSelfAudit(), note: 'Decision-to-outcome accountability, integrity chain and longitudinal verification; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/autonomous-cognitive-life') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, autonomousLife: runtime.core.autonomousCognitiveLifeSnapshot(), diagnostics: runtime.core.autonomousCognitiveLifeDiagnostics(), benchmark: runtime.core.autonomousCognitiveLifeBenchmark(), nextPerception: runtime.core.autonomousCognitiveLifeSelectPerception(), note: 'Closed-loop agency, active perception, autonomous scheduling, longitudinal personality and research controls; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/research-grade-organism') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, research: runtime.core.researchGradeOrganismSnapshot(), diagnostics: runtime.core.researchGradeOrganismDiagnostics(), benchmark: runtime.core.researchGradeOrganismBenchmark(), audit: runtime.core.researchGradeOrganismSelfAudit(), note: 'Research-grade autonomous-life evidence, real postcondition contracts, longitudinal continuity, recovery and replication controls; not evidence of subjective consciousness.' });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/operational-life/causal-intervention') {
            const input = await body(req);
            try {
                const result = runtime.core.operationalLifeRecordCausalIntervention({ target: String(input.target || 'unknown'), control01: Number(input.control01), treatment01: Number(input.treatment01), confidence01: Number(input.confidence01), independent01: Number(input.independent01), repetitions: Number(input.repetitions || 1) });
                await runtime.core.flush();
                return json(res, 200, { ok: true, result, diagnostics: runtime.core.operationalLifeDiagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/operational-life/self-development') {
            const input = await body(req);
            try {
                const result = runtime.core.operationalLifeProposeSelfDevelopment({ hypothesis: String(input.hypothesis || ''), intervention: String(input.intervention || ''), baseline01: Number(input.baseline01), treatment01: Number(input.treatment01), holdout01: Number(input.holdout01), safety01: Number(input.safety01) });
                await runtime.core.flush();
                return json(res, 200, { ok: true, result, diagnostics: runtime.core.operationalLifeDiagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/operational-life/replication') {
            const input = await body(req);
            try {
                const result = runtime.core.operationalLifeRecordReplication({ track: String(input.track || 'closed-loop'), seed: Number(input.seed || 0), control01: Number(input.control01), treatment01: Number(input.treatment01), holdout01: Number(input.holdout01), evaluator: String(input.evaluator || 'api') });
                await runtime.core.flush();
                return json(res, 200, { ok: true, result, diagnostics: runtime.core.operationalLifeDiagnostics() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/operational-life') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, operationalLife: runtime.core.operationalLifeSnapshot(), diagnostics: runtime.core.operationalLifeDiagnostics(), benchmark: runtime.core.operationalLifeBenchmark(), audit: runtime.core.operationalLifeSelfAudit(), note: 'Verified operational life loop, external postconditions, active perception, causal experimentation, longitudinal personality/social/embodiment records, replication and recovery gates; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/cognitive-organism-continuity') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, continuity: runtime.core.cognitiveOrganismContinuitySnapshot(), diagnostics: runtime.core.cognitiveOrganismContinuityDiagnostics(), benchmark: runtime.core.cognitiveOrganismContinuityBenchmark(), note: 'Integrated persistent agency, counterfactual planning, long-horizon learning, self/relational continuity, embodiment, research and verification controls; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/subsystems') {
            return json(res, 200, { ok: true, health: runtime.core.cognitiveSubsystemHealth(), note: 'Physical subsystem health probes; availability is not a claim about consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/runtime/evidence') {
            return json(res, 200, { ok: true, evidence: runtime.evidenceSnapshot(), note: 'Runtime evidence bus; observations are provenance-bound and do not by themselves prove subjective experience.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/personal-curriculum') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, personalCurriculum: runtime.core.personalCurriculumSnapshot(), diagnostics: runtime.core.personalCurriculumDiagnostics(), note: 'Autobiographical/social learning-thread and curriculum-allocation diagnostics; not evidence of subjective consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/projects/active') {
            return json(res, 200, { ok: true, project: runtime.activeProjectSnapshot(), execution: runtime.core.autonomousProjectExecutionStatusSnapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/action-recovery') {
            const limit = Math.max(1, Math.min(64, Number(url.searchParams.get('limit') || 32)));
            return json(res, 200, { ok:true, recovery:runtime.core.actionRecoveryQueueSnapshot(limit), note:'Read-only, redacted queue of durable actions whose external outcome needs reconciliation. This endpoint does not execute or retry actions.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/tools/permissions') {
            return json(res, 200, { ok:true, permissions:runtime.core.actionToolPermissionsSnapshot(), tools:runtime.core.actionToolsSnapshot().filter(tool=>tool.requiresApproval) });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/tools/permissions/request') {
            const input=await body(req);
            const id=String(input.id||'').trim().slice(0,64);
            const toolInput=input.toolInput&&typeof input.toolInput==='object'&&!Array.isArray(input.toolInput)?input.toolInput:{};
            const reason=String(input.reason||'user-request').replace(/[\r\n\t]+/g,' ').slice(0,120);
            const operation=['execute','reconcile','direct'].includes(String(input.operation))?String(input.operation):'execute';
            const decisionId=String(input.decisionId||req.headers['x-organism-decision-id']||'').trim().slice(0,180);
            const options={...(decisionId?{decisionId}:{}),...(input.autonomous===true?{autonomous:true}:{}),...(Array.isArray(input.expectedOutputKeys)?{expectedOutputKeys:input.expectedOutputKeys.slice(0,32).map(String)}:{})};
            if(!id) return json(res,400,{ok:false,error:'missing-tool-id'});
            try {
                const approval=await runtime.core.requestActionToolApproval(id,toolInput,reason,options,operation);
                if(!approval.created && !approval.request) return json(res,503,{ok:false,error:approval.error||'approval-request-failed'});
                return json(res,201,{ok:true,approval:approval.request,created:approval.created});
            } catch(error) { return json(res,400,{ok:false,error:String(error?.message||error)}); }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/tools/permissions/resolve') {
            const input=await body(req);
            const requestId=String(input.requestId||'').trim().slice(0,120);
            if(!requestId) return json(res,400,{ok:false,error:'missing-approval-request-id'});
            const result=await runtime.core.resolveActionToolApproval(requestId,input.approved===true);
            return json(res,result.ok?200:409,result);
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/tools/permissions/consume') {
            const input=await body(req);
            const id=String(input.id||'').trim().slice(0,64);
            const approvalId=String(input.approvalId||'').trim().slice(0,120);
            const toolInput=input.toolInput&&typeof input.toolInput==='object'&&!Array.isArray(input.toolInput)?input.toolInput:{};
            if(!id||!approvalId) return json(res,400,{ok:false,error:'missing-tool-or-approval-id'});
            const result=await runtime.core.consumeDirectActionApproval(id,toolInput,approvalId,{});
            return json(res,result.ok?200:403,result);
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/tools/reconcile') {
            const input = await body(req);
            const id = String(input.id || '').trim().slice(0, 64);
            const reason = String(input.reason || 'api-tool-reconciliation').slice(0, 240);
            const toolInput = input.toolInput && typeof input.toolInput === 'object' && !Array.isArray(input.toolInput) ? input.toolInput : {};
            try {
                const idempotencyKey = String(input.idempotencyKey || req.headers['idempotency-key'] || '').slice(0, 160);
                const decisionId = String(input.decisionId || req.headers['x-organism-decision-id'] || '').slice(0, 180);
                const options = { ...(idempotencyKey ? { idempotencyKey } : {}), ...(decisionId ? { decisionId } : {}), ...(typeof input.approvalId === 'string' && input.approvalId ? { approvalId: input.approvalId.slice(0,120) } : {}), ...(Array.isArray(input.expectedOutputKeys) ? { expectedOutputKeys: input.expectedOutputKeys.slice(0, 32).map(String) } : {}) };
                const result = await runtime.reconcileToolExecution(id, toolInput, reason, options);
                if(!result.ok && result.outcomeClass==='approval-required' && !options.approvalId) {
                    const approval=await runtime.core.requestActionToolApproval(id,toolInput,reason,options,'reconcile');
                    return json(res,403,{ok:false,approvalRequired:true,result,approvalRequest:approval.request});
                }
                // Recovery-required means the provider could not prove a final state.
                // It is not a failed action and must never trigger an automatic retry.
                const resolved = result.idempotencyStatus === 'reconciled' || result.idempotencyStatus === 'confirmed-not-executed' || result.idempotencyReplay === true || (result.idempotencyStatus === 'replayed' && result.outcomeClass !== 'idempotency-recovery-required');
                return json(res, resolved ? 200 : 409, { ok: resolved, result, reconciliation: result.idempotencyStatus || result.outcomeClass });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/projects/tool') {
            const input = await body(req);
            const id = String(input.id || '').slice(0, 160);
            const reason = String(input.reason || 'api-project-tool').slice(0, 240);
            const toolInput = input.toolInput && typeof input.toolInput === 'object' ? input.toolInput : {};
            try {
                const idempotencyKey = String(input.idempotencyKey || req.headers['idempotency-key'] || '').slice(0, 160);
                const decisionId = String(input.decisionId || req.headers['x-organism-decision-id'] || '').slice(0, 180);
                const options = { ...(idempotencyKey ? { idempotencyKey } : {}), ...(decisionId ? { decisionId } : {}), ...(typeof input.approvalId === 'string' && input.approvalId ? { approvalId: input.approvalId.slice(0,120) } : {}) };
                const result = await runtime.executeProjectTool(id, toolInput, reason, options);
                if(!result.ok && result.outcomeClass==='approval-required') {
                    const approvalRequest=result.approvalRequest ?? (await runtime.core.requestActionToolApproval(id,toolInput,reason,options,'execute')).request;
                    return json(res,403,{...result,approvalRequired:true,approvalRequest});
                }
                if (result.idempotencyRequired) result.note = 'Supply a stable Idempotency-Key for this project step and reuse it for approval continuation and retries.';
                return json(res, idempotencyPreflightHttpStatus(result) ?? (result.ok ? 200 : 409), result);
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/projects/step') {
            const input = await body(req);
            const reason = String(input.reason || 'api-project-step').slice(0, 240);
            const stepInput = input.toolInput && typeof input.toolInput === 'object' ? input.toolInput : {};
            try {
                const idempotencyKey = String(input.idempotencyKey || req.headers['idempotency-key'] || '').slice(0, 160);
                const decisionId = String(input.decisionId || req.headers['x-organism-decision-id'] || '').slice(0, 180);
                const options = { ...(idempotencyKey ? { idempotencyKey } : {}), ...(decisionId ? { decisionId } : {}), ...(typeof input.approvalId === 'string' && input.approvalId ? { approvalId: input.approvalId.slice(0,120) } : {}) };
                const result = await runtime.executeNextProjectStep(reason, stepInput, options);
                if (result.idempotencyRequired) result.note = 'Supply a stable Idempotency-Key for this logical project-step invocation and reuse it for approval continuation and retries.';
                return json(res, idempotencyPreflightHttpStatus(result) ?? (result.approvalRequired ? 403 : result.ok ? 200 : result.outcomeClass==='approval-required' ? 403 : 409), result);
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/continual-intelligence') {
            return json(res, 200, { ok: true, phase: 'P30-continual-intelligence-mega-pack', p30: runtime.core.p30Snapshot(), diagnostics: runtime.core.p30Diagnostics() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/continual-intelligence/experiment') {
            const input = await body(req);
            try {
                const experiment = runtime.core.p30ProposeExperiment(String(input.taskId || 'general').slice(0, 96));
                await runtime.core.flush();
                return json(res, 200, { ok: true, experiment, p30: runtime.core.p30Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/continual-intelligence/trajectory') {
            const input = await body(req);
            try {
                const allowed = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
                const actions = Array.isArray(input.actions) ? input.actions.filter(a => allowed.includes(a)).slice(0, 6) : ['wait', 'rest'];
                return json(res, 200, { ok: true, trajectory: runtime.core.p30Trajectory(actions) });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/true-learning') {
            return json(res, 200, { ok: true, phase: 'P26-neural-perception-true-learning', p26: runtime.core.p26Snapshot(), p23: runtime.core.p23LearningSnapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/true-learning/replay') {
            const input = await body(req);
            try {
                const updates = await runtime.core.runP26Replay(Number(input.limit || 256));
                return json(res, 200, { ok: true, updates, p26: runtime.core.p26Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/scientific-development') {
            return json(res, 200, { ok: true, phase: 'P25-scientific-development-and-evaluation', p25: runtime.core.p25Snapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/scientific-development/experiment') {
            const input = await body(req);
            try {
                const experiment = runtime.core.p25RecordControlledExperiment({
                    name: String(input.name || 'controlled-experiment').slice(0, 160), controlLabel: String(input.controlLabel || 'control').slice(0, 80), treatmentLabel: String(input.treatmentLabel || 'treatment').slice(0, 80),
                    metric: String(input.metric || 'metric').slice(0, 120), controlValue: Number(input.controlValue), treatmentValue: Number(input.treatmentValue), sampleSize: Number(input.sampleSize || 1), independentConditions: Boolean(input.independentConditions), interpretation: input.interpretation ? String(input.interpretation).slice(0, 240) : undefined,
                });
                await runtime.core.flush();
                return json(res, 200, { ok: true, experiment, p25: runtime.core.p25Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/scientific-development/evaluation') {
            const input = await body(req);
            try {
                const evaluation = runtime.core.p25RecordEvaluation({ taskId: String(input.taskId || 'task').slice(0, 120), suite: String(input.suite || 'default').slice(0, 120), phase: ['holdout', 'device', 'longitudinal', 'regression'].includes(input.phase) ? input.phase : 'regression', score01: Number(input.score01), criteriaPassed: Number(input.criteriaPassed || 0), criteriaTotal: Number(input.criteriaTotal || 0), evaluator: String(input.evaluator || 'external').slice(0, 120), evidenceLevel: ['unverified', 'observed', 'repeated', 'controlled', 'longitudinal', 'device-verified'].includes(input.evidenceLevel) ? input.evidenceLevel : undefined });
                await runtime.core.flush();
                return json(res, 200, { ok: true, evaluation, p25: runtime.core.p25Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/scientific-development/ablation') {
            const input = await body(req);
            try {
                const ablation = runtime.core.p25RecordAblation({ module: String(input.module || 'unknown').slice(0, 120), baselineScore01: Number(input.baselineScore01), ablatedScore01: Number(input.ablatedScore01), sampleSize: Number(input.sampleSize || 1), interpretation: input.interpretation ? String(input.interpretation).slice(0, 240) : undefined });
                await runtime.core.flush();
                return json(res, 200, { ok: true, ablation, p25: runtime.core.p25Snapshot() });
            }
            catch (error) {
                return json(res, 400, { ok: false, error: String(error?.message || error) });
            }
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/world-identity') {
            return json(res, 200, { ok: true, phase: 'P24-world-model-multimodal-identity', p24: runtime.core.p24Snapshot(), bodyWorldPrediction: runtime.core.p24BodyWorldPrediction(5), modelSwitchBenchmark: runtime.core.p24ModelSwitchSnapshot() });
        }
        if (req.method === 'POST' && url.pathname === '/api/organism/model-switch/benchmark') {
            const input = await body(req);
            if (!input.requestId || !input.backendA || !input.backendB || typeof input.responseA !== 'string' || typeof input.responseB !== 'string')
                return json(res, 400, { ok: false, error: 'invalid-model-switch-trial' });
            const trial = runtime.core.p24RecordModelSwitchTrial({ requestId: String(input.requestId), backendA: String(input.backendA), backendB: String(input.backendB), responseA: String(input.responseA).slice(0, 12000), responseB: String(input.responseB).slice(0, 12000), latencyAms: Number(input.latencyAms || 0), latencyBms: Number(input.latencyBms || 0), qualityA01: input.qualityA01 == null ? null : Number(input.qualityA01), qualityB01: input.qualityB01 == null ? null : Number(input.qualityB01), identityAnchor: input.identityAnchor ? String(input.identityAnchor).slice(0, 1000) : undefined, constraints: Array.isArray(input.constraints) ? input.constraints.slice(0, 16).map(String) : [] });
            await runtime.core.flush();
            return json(res, 200, { ok: true, trial, p24: runtime.core.p24ModelSwitchSnapshot() });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/social-mind') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, diagnostics: runtime.core.socialMindDiagnostics(), socialMind: runtime.core.socialMindSnapshot(), secondOrder: runtime.core.socialMindSecondOrder('user'), counterfactuals: runtime.core.socialMindCounterfactuals('user'), repair: runtime.core.socialMindRepairProposal('user'), note: 'Social Mind stores bounded person candidates, first- and second-order hypotheses, counterfactual alternatives and outcome learning. Person candidates are not verified real-world identities and inference is uncertainty-bearing.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/developmental-self') {
            return json(res, 200, { ok: true, phase: RELEASE_CONTRACT.phase, developmental: runtime.core.developmentalSelfSnapshot(), note: 'Developmental self is a bounded causal lineage and forecasting system; its metrics are not proof of subjective experience or consciousness.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/organism/inspect') {
            const snapshot = runtime.core.snapshot();
            const bodyState = runtime.embodiment.snapshot();
            return json(res, 200, {
                ok: true,
                tick: snapshot.state.tick,
                stateHash: snapshot.system.lastStateHash,
                replaySignature: snapshot.system.replaySignature,
                lastAction: snapshot.state.lastAction,
                network: snapshot.facets.evolution.network,
                multimodal: snapshot.facets.embodiment.multimodal,
                adaptiveDevelopment: runtime.adaptiveDevelopmentSnapshot(),
                temporalContinuity: runtime.core.temporalContinuitySnapshot(),
                resilience: runtime.core.advancedResilienceSnapshot(),
                p24WorldIdentity: snapshot.facets.advanced.p24,
                trueLearning: snapshot.facets.learning.p26,
                learnedWorld: snapshot.facets.cognition.p27,
                plasticity: snapshot.facets.learning.p28,
                selfDevelopment: snapshot.facets.learning.p36,
                persistence: {
                    mode: PHONE_POLICY.mode,
                    baseIntervalMs: INTERVAL_MS,
                    sensorIntervalMs: SENSOR_INTERVAL_MS,
                    worldCheckpointMinIntervalMs: WORLD_CHECKPOINT_MIN_MS,
                    worldCheckpointMaxDirtyCycles: WORLD_CHECKPOINT_MAX_CYCLES,
                    checkpointMinIntervalMs: CHECKPOINT_MIN_MS,
                    checkpointMaxDirtyCycles: CHECKPOINT_MAX_CYCLES,
                    backupEverySaves: BACKUP_EVERY_SAVES,
                    store: runtime.persistenceMetrics(),
                },
                goalsActive: snapshot.goals.filter(g => g.status === 'active').length,
                memories: snapshot.memories.length,
                events: snapshot.traces.length,
                body: {
                    battery01: bodyState.telemetry.battery01,
                    thermalPressure01: bodyState.telemetry.thermalPressure01,
                    cpuLoad01: bodyState.telemetry.cpuLoad01,
                    ramPressure01: bodyState.telemetry.ramPressure01,
                    awake: bodyState.awake,
                },
            });
        }
        if (req.method === 'GET') {
            const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
            if (relative.includes('..'))
                return json(res, 400, { ok: false });
            const publicRoot = path.resolve(PUBLIC);
            const file = path.resolve(PUBLIC, relative);
            if (!(file === publicRoot || file.startsWith(publicRoot + path.sep)))
                return json(res, 400, { ok: false, error: 'invalid-static-path' });
            let content;
            try {
                content = await readFile(file);
            }
            catch (error) {
                if (error?.code === 'ENOENT')
                    return json(res, 404, { ok: false, error: 'static-not-found' });
                throw error;
            }
            const type = relative.endsWith('.html')
                ? 'text/html; charset=utf-8'
                : relative.endsWith('.js')
                    ? 'text/javascript; charset=utf-8'
                    : relative.endsWith('.css')
                        ? 'text/css; charset=utf-8'
                        : 'application/octet-stream';
            res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
            return res.end(content);
        }
        return json(res, 404, { ok: false, error: 'not-found' });
    }
    catch (error) {
        const message = String(error?.message || error);
        const code = String(error?.code || '');
        if (message === 'request-too-large')
            return json(res, 413, { ok: false, error: 'request-too-large', maxBodyBytes: MAX_BODY_BYTES });
        if (/JSON|Unexpected token|Expected property name|Unexpected end of JSON input/i.test(message))
            return json(res, 400, { ok: false, error: 'invalid-json-request' });
        if (code === 'transport-envelope-id-conflict' || code === 'transport-envelope-history-unknown')
            return json(res, 409, { ok: false, error: code, message });
        if (code === 'transport-envelope-invalid')
            return json(res, 400, { ok: false, error: code, message });
        if (code === 'transport-queue-full')
            return json(res, 503, { ok: false, error: code, message });
        return json(res, 500, { ok: false, error: message });
    }
}
const server = http.createServer((req, res) => void route(req, res));
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = Math.max(REQUEST_TIMEOUT_MS + 5000, 50000);
server.keepAliveTimeout = 5000;
server.listen(PORT, HOST, () => console.log(`[Neuro-Kurisu Evolution] http://${HOST}:${PORT}`));
let shuttingDown = false;
async function shutdown() {
    if (shuttingDown)
        return;
    shuttingDown = true;
    if (runtimeReady)
        await runtime.core.endTemporalSession('shutdown', true).catch(() => { });
    await runtime.flush().catch(() => { });
    runtime.stop();
    await lock.release().catch(() => { });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
try {
    await runtime.init();
    await runtime.core.p40ConfigureModelBackend('llama.cpp', LLAMA_CPP_PROVIDER.configured());
    runtimeReady = true;
}
catch (error) {
    console.error('[Neuro-Kurisu Evolution] runtime init failed:', error?.stack || error);
    await shutdown();
    process.exitCode = 1;
}
