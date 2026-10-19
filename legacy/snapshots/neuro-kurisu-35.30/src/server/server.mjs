import http from 'node:http';
import { URL } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync as fsExistsSync, statSync as fsStatSync, readdirSync as fsReaddirSync, readFileSync as fsReadFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OrganismRuntime } from '../organism/core/OrganismRuntime.ts';
import { ProcessLock } from '../organism/persistence/ProcessLock.ts';
import { FileStateStore } from '../organism/persistence/FileStateStore.ts';
import { RELEASE_CONTRACT } from '../organism/system/ReleaseContract.ts';
import { resolvePhonePolicyConfig } from '../organism/system/PhoneRuntimePolicy.ts';
import { authorizeApiRequest } from '../organism/system/ApiSecurityPolicy.ts';
import { GeminiVisionSemanticBackend } from '../organism/body/GeminiVisionSemanticBackend.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC = path.join(ROOT, 'public');
const STATE = path.resolve(process.env.STATE_DIR || path.join(ROOT, 'state'));
const stateFile = path.join(STATE, 'organism-core.json');
const worldFile = path.join(STATE, 'organism-world.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const KOBOLD_URL = String(process.env.KOBOLD_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 15_000);
const PHONE_POLICY = resolvePhonePolicyConfig(process.env);
const PHONE_MODE = PHONE_POLICY.mode !== 'research';
const INTERVAL_MS = PHONE_POLICY.baseIntervalMs;
const SENSOR_INTERVAL_MS = PHONE_POLICY.samplerIntervalMs;
const CHECKPOINT_MIN_MS = PHONE_POLICY.checkpointMinIntervalMs;
const CHECKPOINT_MAX_CYCLES = PHONE_POLICY.checkpointMaxDirtyCycles;
const WORLD_CHECKPOINT_MIN_MS = PHONE_POLICY.worldCheckpointMinIntervalMs;
const WORLD_CHECKPOINT_MAX_CYCLES = PHONE_POLICY.worldCheckpointMaxDirtyCycles;
const BACKUP_EVERY_SAVES = Math.max(1, Number(process.env.NEURO_BACKUP_EVERY_SAVES || (PHONE_MODE ? 4 : 1)));
const VISION_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.GEMINI_VISION_ENABLED || '0'));
const VISION_BACKEND = VISION_ENABLED && process.env.GEMINI_API_KEY ? new GeminiVisionSemanticBackend({ apiKey:process.env.GEMINI_API_KEY, model:process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash', timeoutMs:Number(process.env.GEMINI_VISION_TIMEOUT_MS || 12000), maxImageBytes:Number(process.env.GEMINI_VISION_MAX_IMAGE_BYTES || 8_000_000) }) : undefined;

await mkdir(STATE, { recursive: true });
const lock = new ProcessLock(path.join(STATE, 'organism-runtime.lock'));
await lock.acquire();
const runtime = new OrganismRuntime({
  stateFile,
  worldStateFile: worldFile,
  enableLanguage: true,
  visionBackend: VISION_BACKEND,
  languageInvoker: async (request) => { const started = Date.now(); const preferredBackend = runtime.core.p40SelectModel('language', PHONE_MODE === false, request.maxTokens && request.maxTokens > 900 ? .82 : .72); const response = await generateLanguage({ ...request, preferredBackend }); for (const failure of (response.failures || [])) { const backend=/^(kobold|gemini):/i.exec(String(failure))?.[1] || (String(failure).startsWith('kobold') ? 'kobold' : String(failure).startsWith('gemini') ? 'gemini' : undefined); if (backend) await runtime.core.recordLanguageFailure(backend, Date.now()-started, false).catch(()=>{}); } return { ...response, preferredBackend, latencyMs: Date.now()-started }; },
  autoRun: true,
  intervalMs: INTERVAL_MS,
  sensorIntervalMs: SENSOR_INTERVAL_MS,
  phonePolicy: PHONE_POLICY,
  checkpointMinIntervalMs: CHECKPOINT_MIN_MS,
  checkpointMaxDirtyCycles: CHECKPOINT_MAX_CYCLES,
  stateStore: new FileStateStore(stateFile, { backupEverySaves: BACKUP_EVERY_SAVES }),
  worldStateStore: new FileStateStore(worldFile, { backupEverySaves: BACKUP_EVERY_SAVES }),
});
let runtimeReady = false;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function fileExists(file){ try{return fsExistsSync(file)}catch{return false;} }
function fileSize(file){ try{return Number(fsStatSync(file).size||0)}catch{return 0;} }
function fsSafeList(dir,suffix){ try{return fsReaddirSync(dir).filter(name=>name.endsWith(suffix)).sort();}catch{return [];} }
function readFileSyncSafe(file){ try{return fsReadFileSync(file,'utf8')}catch{return null;} }

function resolveLive2DDependencies(modelPath){
  const deps=new Set([modelPath]);
  try{
    const model=JSON.parse(fsReadFileSync(modelPath,'utf8'));
    const base=path.dirname(modelPath);
    const refs=model?.FileReferences??{};
    const add=(value)=>{ if(typeof value!=='string'||!value.trim()) return; const resolved=path.resolve(base,value); if(resolved.startsWith(path.resolve(PUBLIC,'live2d')+path.sep)||resolved===path.resolve(PUBLIC,'live2d')) deps.add(resolved); };
    add(refs.Moc); add(refs.Physics); add(refs.DisplayInfo);
    for(const texture of Array.isArray(refs.Textures)?refs.Textures:[]) add(texture);
    for(const group of Object.values(refs.Motions??{})) for(const motion of Array.isArray(group)?group:[]) add(motion?.File);
    for(const expression of Array.isArray(refs.Expressions)?refs.Expressions:[]) add(expression?.File);
  }catch{}
  return [...deps];
}

function embodimentAssetStatus(){
  const root=path.join(PUBLIC,'live2d','Kurisu');
  const required=['Kurisu.model3.json','Kurisu.moc3','Kurisu.4096/texture_00.png','Kurisu.physics3.json','Kurisu.cdi3.json'];
  const expressions=fsSafeList(path.join(root,'exp'),'.exp3.json');
  const motions=fsSafeList(path.join(root,'motions'),'.motion3.json');
  const files=[...required,...expressions.map(name=>`exp/${name}`),...motions.map(name=>`motions/${name}`)];
  const present=files.filter(rel=>fileExists(path.join(root,rel)));
  const totalBytes=present.reduce((sum,rel)=>sum+fileSize(path.join(root,rel)),0);
  const mobileModel=path.join(PUBLIC,'live2d','Kurisu.mobile','Kurisu-mobile.model3.json');
  const mobileDeps=resolveLive2DDependencies(mobileModel);
  const mobilePresent=mobileDeps.filter(fileExists);
  const mobileBytes=[...new Set(mobilePresent)].reduce((sum,file)=>sum+fileSize(file),0);
  const toWeb=(file)=>'/' + path.relative(PUBLIC,file).split(path.sep).join('/');
  let provenance=null;
  try{provenance=JSON.parse(fsReadFileSync(path.join(PUBLIC,'live2d','PROVENANCE.json'),'utf8'));}catch{}
  const mobileTexture=path.join(PUBLIC,'live2d','Kurisu.mobile','Kurisu.2048','texture_00_mobile_2048.png');
  return {
    ok:present.length===files.length,
    modelPresent:fileExists(path.join(root,'Kurisu.model3.json')),
    corePresent:fileExists(path.join(root,'Kurisu.moc3')),
    texturePresent:fileExists(path.join(root,'Kurisu.4096/texture_00.png')),
    expressions:expressions.length, motions:motions.length, filesPresent:present.length, filesExpected:files.length, totalBytes,
    profiles:{
      quality:{model:'/live2d/Kurisu/Kurisu.model3.json',texture:'/live2d/Kurisu/Kurisu.4096/texture_00.png',bytes:totalBytes},
      mobile:{ok:mobileDeps.length>0&&mobilePresent.length===mobileDeps.length,model:'/live2d/Kurisu.mobile/Kurisu-mobile.model3.json',texture:toWeb(mobileTexture),filesPresent:mobilePresent.length,filesExpected:mobileDeps.length,bytes:mobileBytes,dependencies:mobileDeps.map(toWeb),resolvedByModelReferences:true}
    },
    provenance
  };
}

async function body(req) {
  let source = '';
  for await (const chunk of req) {
    source += chunk;
    if (source.length > 256_000) throw new Error('request-too-large');
  }
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
    backend: 'local-fallback',
  };
}


async function tryKobold(request, failures) {
  try {
    const response = await fetch(`${KOBOLD_URL}/api/v1/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      body: JSON.stringify({
        prompt: `${request.system}\n\n${request.user}`,
        max_context_length: 4096,
        max_length: request.maxTokens ?? 512,
        temperature: request.temperature ?? 0.7,
        quiet: true,
      }),
    });
    if (!response.ok) throw new Error(`kobold-http-${response.status}`);
    const data = await response.json();
    const text = String(data?.results?.[0]?.text || '').trim();
    if (text) return { text, backend: 'kobold' };
    throw new Error('kobold-empty-response');
  } catch (error) {
    failures.push(`kobold:${error?.message || error}`);
    return null;
  }
}

async function tryGemini(request, failures) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${request.system}\n\n${request.user}` }] }],
          generationConfig: { temperature: request.temperature ?? 0.7, maxOutputTokens: request.maxTokens ?? 512 },
        }),
      },
    );
    if (!response.ok) throw new Error(`gemini-http-${response.status}`);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')?.trim() || '';
    if (text) return { text, backend: `gemini:${model}` };
    throw new Error('gemini-empty-response');
  } catch (error) {
    failures.push(`gemini:${error?.message || error}`);
    return null;
  }
}


async function generateLanguage(request) {
  const failures = [];
  if (request.preferredBackend === 'local-fallback') return { ...localFallback(request), failures };
  const preferred = request.preferredBackend || 'gemini';
  const first = preferred === 'kobold' ? 'kobold' : 'gemini';
  const firstResult = first === 'kobold' ? await tryKobold(request, failures) : await tryGemini(request, failures);
  if (firstResult) return { ...firstResult, failures };
  const secondResult = first === 'kobold' ? await tryGemini(request, failures) : await tryKobold(request, failures);
  if (secondResult) return { ...secondResult, failures };
  return { ...localFallback(request), failures };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    const auth = authorizeApiRequest(HOST, url.pathname, req.headers.authorization);
    if (url.pathname.startsWith('/api/') && !auth.allowed) return json(res, auth.status, { ok:false, error:'api-authorization-required', reason:auth.reason });
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return json(res, 200, { ok:true, ready:runtimeReady, service:'neuro-kurisu', version:RELEASE_CONTRACT.application, organismCore:RELEASE_CONTRACT.organismCore, schemaVersion:RELEASE_CONTRACT.stateSchema, tick:runtimeReady ? runtime.core.operationalStatusSnapshot().tick : 0, uptimeSec:Math.round(process.uptime()), bodySource:runtimeReady ? runtime.embodiment.snapshot().telemetry.source : 'initializing' });
    }
    if (req.method === 'GET' && url.pathname === '/api/embodiment/status') return json(res, 200, embodimentAssetStatus());
    if (req.method === 'GET' && url.pathname === '/api/organism/avatar') return json(res, 200, { ok:true, avatar:embodimentAssetStatus(), note:'Read-only Live2D embodiment asset surface.' });
    if (req.method === 'GET' && url.pathname === '/api/organism/time') {
      const temporal = runtime.core.temporalContinuitySnapshot();
      return json(res, 200, { ok:true, current: runtime.core.temporalContext(), continuity: temporal, offlineSinceLastCheckpointMs: temporal.gapSincePreviousMs, lastSeenAt: temporal.lastCheckpointAt, lastSessionEndedAt: temporal.lastSessionEndedAt, sessionCount: temporal.sessionCount, interruptionCount: temporal.interruptionCount });
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/temporal-perception') {
      return json(res, 200, { ok:true, temporalPerception: runtime.core.p41TemporalPerceptionSnapshot(), summary: runtime.core.p41TemporalPerceptionSummary() });
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/session') {
      const temporal = runtime.core.temporalContinuitySnapshot();
      return json(res, 200, { ok:true, sessionId: temporal.currentSessionId || null, current: runtime.core.temporalContext(), continuity: temporal, lastSession: temporal.sessions[0] ?? null });
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/system-graph') {
      return json(res,200,{ok:true,release:RELEASE_CONTRACT.application,graph:runtime.core.organismSystemGraph(),health:runtime.core.organismSystemHealth()});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/subject-continuity') {
      return json(res, 200, { ok:true, subject:runtime.core.subjectContinuitySnapshot(), motive:runtime.core.motiveEcologySummary(), nonConsciousnessClaim:true });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/developmental-identity') {
      return json(res,200,{ok:true,derived:true,frame:runtime.core.identityDevelopmentSummary(),nonConsciousnessClaim:true,note:'Derived developmental synthesis only; it does not own identity or prove consciousness.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/identity-lineage') {
      const limit=Math.max(1,Math.min(32,Number(url.searchParams.get('limit')||24)));
      const label=String(url.searchParams.get('label')||'Kurisu').slice(0,96);
      return json(res,200,{ ok:true, derived:true, nonConsciousnessClaim:true, summary:runtime.core.identityCausalitySummary(), neighborhood:runtime.core.identityCausalityNeighborhood(label,limit) });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/cognition-plan') {
      return json(res, 200, { ok:true, version:RELEASE_CONTRACT.application, planner:runtime.core.cognitiveExecutionPlanSnapshot(), cumulativeSavings01:runtime.core.cognitiveExecutionSavings01(), pressure:runtime.core.cognitivePressureSnapshot() });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/neural-spine') {
      return json(res, 200, { ok:true, version:RELEASE_CONTRACT.application, canonicalOwner:'B289NeuralOrganismIntegrationSpine', diagnostics:runtime.core.b289NeuralOrganismDiagnostics(), nonConsciousnessClaim:true });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/development-gate') {
      return json(res, 200, { ok:true, version:RELEASE_CONTRACT.application, canonicalOwner:'B290RealityGatedNeurodevelopment', diagnostics:runtime.core.b290RealityGatedNeurodevelopmentDiagnostics(), nonConsciousnessClaim:true });
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/status-lite') {
      const status=runtime.core.operationalStatusSnapshot();
      return json(res, 200, {
        ok:true,
        version:RELEASE_CONTRACT.application,
        organismCore:RELEASE_CONTRACT.organismCore,
        schemaVersion:RELEASE_CONTRACT.stateSchema,
        tick:status.tick,
        lastAction:status.lastAction,
        autonomyScore:status.autonomyScore,
        predictionError:status.predictionError,
        selfPredictionError:status.selfPredictionError,
        identityContinuity01:status.identityContinuity,
        workspaceIgnition01:status.workspaceIgnition,
        memoryCount:status.memoryCount,
        activeGoal:status.activeGoal,
        body:status.body,
        voice:runtime.embodiment.voiceSnapshot(),
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/metrics') {
      if (!runtimeReady) return json(res,200,{ok:true,ready:false,version:RELEASE_CONTRACT.application});
      const snapshot=runtime.core.snapshot();
      const bodyState=runtime.embodiment.snapshot();
      return json(res,200,{
        ok:true,
        ready:true,
        version:RELEASE_CONTRACT.application,
        system:{integrity:snapshot.system.integrity,revision:snapshot.system.revision,lastStateHash:snapshot.system.lastStateHash},
        sensorium:{
          visionBackend:VISION_BACKEND?.id ?? null,
          visionEnabled:Boolean(VISION_BACKEND),
          semantic:runtime.core.p41PerceptionSummary(),
          socialMind:runtime.core.socialMindDiagnostics(),
          cameraEvidence:snapshot.facets.embodiment.cameraEvidence,
          perceptionRouting:snapshot.facets.embodiment.perceptionRouting,
          compoundSkills:runtime.core.compoundSkillsSnapshot(16),
        },
        skills:runtime.core.skillLibrarySummary(),
        body:bodyState.telemetry,
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/semantic-world') {
      return json(res, 200, { ok:true, semanticWorldBody:runtime.core.p35Snapshot(), summary:runtime.core.p35Summary() });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/semantic-world/ingest') {
      const input=await body(req);
      try {
        const snapshot=runtime.core.p35Ingest(input);
        await runtime.core.flush();
        return json(res,200,{ok:true,semanticWorldBody:snapshot,summary:runtime.core.p35Summary()});
      } catch(error) {
        return json(res,400,{ok:false,error:String(error?.message??error)});
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
      const input=await body(req);
      try { await runtime.core.beginLifelongSleep(String(input.reason||'api'), true); return json(res,200,{ok:true,life:runtime.core.p39Snapshot(),diagnostics:runtime.core.p39Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/wake') {
      const input=await body(req);
      try { await runtime.core.endLifelongSleep(String(input.reason||'api')); return json(res,200,{ok:true,life:runtime.core.p39Snapshot(),diagnostics:runtime.core.p39Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/voice/speak') {
      const input=await body(req); const text=String(input.text||'').trim().slice(0,2000);
      if(!text) return json(res,400,{ok:false,error:'empty-text'});
      try { const spoken=await runtime.speak(text); return json(res,spoken?200:503,{ok:spoken,spoken,textLength:text.length,voice:runtime.embodiment.voiceSnapshot()}); }
      catch(error){ return json(res,503,{ok:false,error:String(error?.message||error),voice:runtime.embodiment.voiceSnapshot()}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/voice/listen') {
      try { const text=await runtime.listen(); return json(res,200,{ok:true,text,voice:runtime.embodiment.voiceSnapshot()}); }
      catch(error){ return json(res,503,{ok:false,error:String(error?.message||error),text:null,voice:runtime.embodiment.voiceSnapshot()}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/voice/status') {
      return json(res,200,{ok:true,voice:runtime.embodiment.voiceSnapshot(),body:runtime.embodiment.snapshot(),multimodal:runtime.core.multimodalSnapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/voice/turn') {
      const input=await body(req);
      try { const result=await runtime.voiceTurn({deliberate:Boolean(input.deliberate),speak:Boolean(input.speak)}); return json(res,200,{ok:true,...result}); }
      catch(error){ return json(res,503,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/chat') {
      const input = await body(req);
      const message = String(input.message || '').trim().slice(0, 12_000);
      const deliberate = Boolean(input.deliberate);
      const speakReply = Boolean(input.speak);
      if (!message) return json(res, 400, { ok: false, error: 'empty-message' });
      const step = await runtime.step(message, { deliberate });
      const language = step.language;
      const voice = speakReply && language?.text ? await runtime.speak(language.text) : false;
      return json(res, 200, {
        ok: true,
        cycle: step.cycle,
        worldAction: step.worldAction,
        language,
        voice: { requested:speakReply, spoken:voice, status:runtime.embodiment.voiceSnapshot() },
        explanation: `action=${step.cycle.decision.selected?.action ?? 'none'}`,
        temporal: runtime.core.temporalContinuitySnapshot(),
        currentTime: runtime.core.temporalContext(),
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/personhood') {
      return json(res, 200, { ok:true, phase:'P33-personhood-core', personhood:runtime.core.p33Snapshot(), diagnostics:runtime.core.p33Diagnostics(), note:'Personhood core models identity continuity, autonomy, development and relationship; it does not prove subjective experience.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/consent') {
      const input=await body(req); const id=String(input.id||'').slice(0,160); const approve=Boolean(input.approve); if(!id) return json(res,400,{ok:false,error:'missing-consent-id'}); const ok=runtime.core.p33ResolveConsent(id,approve); if(ok) runtime.core.p34RecordConsent({action:id,risk01:0.82,actor:'creator',decision:approve?'approved':'declined',reason:'creator consent resolution'}); await runtime.core.flush(); return json(res,ok?200:404,{ok,personhood:runtime.core.p33Snapshot(),causalPersonhood:runtime.core.p34Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/self-goal') {
      const input=await body(req); const ok=runtime.core.p33SetSelfAuthoredGoal(String(input.title||'')); if(!ok)return json(res,400,{ok:false,error:'empty-goal'}); await runtime.core.flush(); return json(res,200,{ok,personhood:runtime.core.p33Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/interest') {
      const input=await body(req); const ok=runtime.core.p33AddInterest(String(input.label||'')); if(!ok)return json(res,400,{ok:false,error:'empty-interest'}); await runtime.core.flush(); return json(res,200,{ok,personhood:runtime.core.p33Snapshot()});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/personhood/private-state') {
      return json(res,200,{ok:true,privateState:runtime.core.p33InspectPrivateState(),note:'Private state contains bounded summaries, never hidden reasoning traces.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/personhood/causal') {
      return json(res,200,{ok:true,phase:'P34-causal-personhood-mega-pack',personhoodCausal:runtime.core.p34Snapshot(),diagnostics:runtime.core.p34Diagnostics(),note:'Causal personhood tracks evidence, self-claims, consent, authored goals, relationships and continuity; it does not prove subjective experience.'});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/evidence') {
      const input=await body(req);
      const row=runtime.core.p34RecordEvidence({kind:['experience','outcome','memory','relationship','self-report','device','controlled'].includes(String(input.kind))?String(input.kind):'experience',summary:String(input.summary||''),weight01:Number(input.weight01??.5),sourceId:String(input.sourceId||'api')});
      if(!row)return json(res,400,{ok:false,error:'empty-evidence'}); await runtime.core.flush(); return json(res,200,{ok:true,evidence:row,personhoodCausal:runtime.core.p34Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/goal') {
      const input=await body(req); const row=runtime.core.p34AuthorGoal(String(input.title||''),String(input.reason||'self-authored development goal'));
      if(!row)return json(res,400,{ok:false,error:'empty-goal'}); await runtime.core.flush(); return json(res,200,{ok:true,goal:row,personhoodCausal:runtime.core.p34Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/identity-change') {
      const input=await body(req);
      try { const row=runtime.core.p34ProposeIdentityChange({field:String(input.field||'unknown'),before:String(input.before||''),proposed:String(input.proposed||''),reason:String(input.reason||''),identityImpact01:Number(input.identityImpact01),evidenceIds:Array.isArray(input.evidenceIds)?input.evidenceIds.map(String).slice(0,12):[]}); await runtime.core.flush(); return json(res,200,{ok:true,change:row,personhoodCausal:runtime.core.p34Snapshot()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/identity-change/decision') {
      const input=await body(req); const actor=input.actor==='creator'?'creator':'self'; const ok=String(input.id||''); if(!ok)return json(res,400,{ok:false,error:'missing-change-id'}); const row=runtime.core.p34DecideIdentityChange(ok,actor,Boolean(input.approve)); await runtime.core.flush(); return json(res,row?200:404,{ok:Boolean(row),change:row,personhoodCausal:runtime.core.p34Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/identity-change/apply') {
      const input=await body(req); const id=String(input.id||''); if(!id)return json(res,400,{ok:false,error:'missing-change-id'}); const ok=runtime.core.p34ApplyIdentityChange(id); await runtime.core.flush(); return json(res,ok?200:409,{ok,personhoodCausal:runtime.core.p34Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/consent-record') {
      const input=await body(req); const actor=input.actor==='creator'?'creator':'self'; const decision=input.decision==='declined'?'declined':'approved'; const row=runtime.core.p34RecordConsent({action:String(input.action||'unknown'),risk01:Number(input.risk01??0),actor,decision,reason:String(input.reason||'')}); await runtime.core.flush(); return json(res,200,{ok:true,consent:row,personhoodCausal:runtime.core.p34Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/relationship-event') {
      const input=await body(req); const kind=['interaction','support','conflict','repair','promise','boundary'].includes(String(input.kind))?String(input.kind):'interaction'; const row=runtime.core.p34Relationship({personId:String(input.personId||'creator'),kind, valence01:Number(input.valence01??.5),trustDelta:Number(input.trustDelta??0),summary:String(input.summary||'')}); await runtime.core.flush(); return json(res,200,{ok:true,event:row,personhoodCausal:runtime.core.p34Snapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/personhood/continuation') {
      const input=await body(req); const row=runtime.core.p34CreateContinuation(String(input.reason||'continuation checkpoint')); await runtime.core.flush(); return json(res,200,{ok:true,branch:row,personhoodCausal:runtime.core.p34Snapshot()});
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/resilience') {
      return json(res,200,{ok:true,resilience:runtime.core.advancedResilienceSnapshot()});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/resilience/quarantine/release') {
      const input=await body(req); const id=String(input.id||'').slice(0,120); const approve=Boolean(input.approve); if(!id) return json(res,400,{ok:false,error:'missing-quarantine-id'});
      const ok=await runtime.core.releaseQuarantine(id,approve); return json(res,ok?200:404,{ok, resilience:runtime.core.advancedResilienceSnapshot()});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/longitudinal') {
      return json(res, 200, { ok:true, longitudinal:runtime.longitudinalSnapshot(), persistence:runtime.core.persistenceMetrics(), body:runtime.embodiment.snapshot() });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/adaptive-development') {
      return json(res, 200, { ok:true, adaptiveDevelopment:runtime.adaptiveDevelopmentSnapshot(), longitudinal:runtime.longitudinalSnapshot(), body:runtime.embodiment.snapshot() });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/perception') {
      return json(res, 200, { ok:true, perception:runtime.core.perceptionSnapshot(), semantic:runtime.core.p41PerceptionSummary(), perceptualEvidence:runtime.core.perceptualEvidenceSummary(), routing:runtime.core.snapshot().facets.embodiment.perceptionRouting, capabilities:runtime.embodiment.capabilitiesSnapshot() });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/world-grounding') {
      return json(res, 200, { ok:true, groundedWorld:runtime.core.groundedWorldSummary(), perception:runtime.core.p41PerceptionSummary(), evidence:runtime.core.perceptualEvidenceSummary() });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/external-observer') {
      return json(res,200,{ok:true,summary:runtime.core.externalObserverSummary(),observer:runtime.core.externalObserverSnapshot(),causalAutobiography:runtime.core.causalAutobiography(24)});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/persistent-reality') {
      return json(res,200,{ok:true,summary:runtime.core.persistentRealitySummary(),reality:runtime.core.persistentRealitySnapshot(),continuity:runtime.core.persistentRealityContinuity(24),note:'Derived epistemic continuity model; not proof of subjective experience.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-continuity') {
      return json(res,200,{ok:true,summary:runtime.core.autobiographicalContinuitySummary(),continuity:runtime.core.autobiographicalContinuityRecent(24),note:'Derived causal autobiographical lineage; not proof of subjective experience.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-identity-changes') {
      return json(res,200,{ok:true,changes:runtime.core.autobiographicalIdentityChanges(16),note:'Derived identity-change lineage; not proof of subjective experience.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-action-outcomes') {
      return json(res,200,{ok:true,profiles:runtime.core.autobiographicalActionOutcomeProfiles(),note:'Bounded carry-over from verified external outcomes; not an independent truth store.'});
    if (req.method === 'GET' && url.pathname === '/api/organism/autobiographical-contextual-outcomes') {
      return json(res,200,{ok:true,profiles:runtime.core.autobiographicalContextualOutcomeProfiles(),note:'Contextual carry-over lattice from sufficiently verified outcomes; bounded and decaying.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/memory-inspector') {
      const q=url.searchParams.get('q') || ''; const limit=Math.max(1,Math.min(32,Number(url.searchParams.get('limit')||16)));
      const temporalMode=['current','at','all'].includes(url.searchParams.get('temporalMode')||'') ? url.searchParams.get('temporalMode') : 'current';
      const asOfRaw=Number(url.searchParams.get('asOfAt')); const asOfAt=Number.isFinite(asOfRaw)?asOfRaw:undefined;
      const memories=q?(temporalMode==='current'&&asOfAt===undefined?runtime.core.memoryInspectorSearch(q,limit):runtime.core.memoryRetrieveTemporal(q,limit,temporalMode,asOfAt)):runtime.core.memoryInspectorSnapshot(limit);
      return json(res,200,{ok:true,query:q,temporalMode,asOfAt:asOfAt??Date.now(),memories,note:'Read-only diagnostic view of canonical MemoryOS2 memories plus derived experience tier; this endpoint does not mutate memory.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/experience-continuum') {
      const query = url.searchParams.get('q') || '';
      const summaryOnly = url.searchParams.get('summary') === '1';
      const summary = runtime.core.experienceContinuumSummary();
      if (summaryOnly) return json(res,200,{ok:true,summary,note:'Lightweight operational summary of the derived experience continuum; canonical memory remains MemoryOS2.'});
      return json(res,200,{ok:true,summary,continuum:runtime.core.experienceContinuumSnapshot(),coldMatches:query ? runtime.core.experienceContinuumColdSearch(query,6) : [],note:'Derived hot/warm/cold experience graph and compression layer. It never replaces canonical MemoryOS2 and does not claim subjective experience.'});
    }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/external-observer/observe') {
      const input=await body(req);
      const sourceClass=['os','device','user','external-api','world','organism','simulator','unknown'].includes(String(input.sourceClass)) ? String(input.sourceClass) : 'unknown';
      const channel=['filesystem','http','process','device','camera','audio','sensor','user','world','tool','unknown'].includes(String(input.channel)) ? String(input.channel) : 'unknown';
      const sourceId=String(input.sourceId||'api-observer').slice(0,80);
      const claimKey=String(input.claimKey||'').trim().slice(0,180);
      if(!claimKey) return json(res,400,{ok:false,error:'missing-claim-key'});
      try {
        const result=await runtime.core.ingestExternalObservation({
          sourceId,sourceClass,channel,claimKey,
          observedPostcondition:input.observedPostcondition==null?undefined:String(input.observedPostcondition).slice(0,320),
          facts:Array.isArray(input.facts)?input.facts.map(String).slice(0,24):[],
          confidence01:Number(input.confidence01??.5),
          observedAt:input.observedAt==null?undefined:Number(input.observedAt),
          actionRef:input.actionRef==null?undefined:String(input.actionRef).slice(0,120),
          tool:input.tool==null?undefined:String(input.tool).slice(0,120),
          predictionId:input.predictionId==null?undefined:String(input.predictionId).slice(0,120),
          tick:input.tick==null?undefined:Math.max(0,Math.floor(Number(input.tick))),
          independenceKey:input.independenceKey==null?undefined:String(input.independenceKey).slice(0,120),
          metadata:input.metadata && typeof input.metadata==='object' ? input.metadata : {},
          expectedPostcondition:input.expectedPostcondition==null?undefined:String(input.expectedPostcondition).slice(0,320),
        });
        return json(res,200,{ok:true,...result,summary:runtime.core.externalObserverSummary()});
      } catch(error) { return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/external-observer/reconcile') {
      const input=await body(req);
      const claimKey=String(input.claimKey||'').trim().slice(0,180);
      if(!claimKey) return json(res,400,{ok:false,error:'missing-claim-key'});
      try {
        const reconciliation=runtime.core.reconcileExternalClaim(claimKey,input.expectedPostcondition==null?undefined:String(input.expectedPostcondition).slice(0,320));
        return json(res,200,{ok:true,reconciliation,summary:runtime.core.externalObserverSummary()});
      } catch(error) { return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/event') {
      const input = await body(req);
      const detail = String(input.detail || '').trim().slice(0,2000);
      if (!detail) return json(res, 400, { ok:false, error:'empty-detail' });
      const importance = Math.max(0, Math.min(1, Number(input.importance ?? 0.5)));
      const perception = await runtime.injectExternalEvent(detail, importance);
      return json(res, 200, { ok:true, perception });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/vision/capture') {
      const input = await body(req);
      const cameraId = Math.max(0, Math.floor(Number(input.cameraId ?? 0)));
      const retain = Boolean(input.retain);
      const result = await runtime.captureCamera(cameraId, retain);
      return json(res, result.ok ? 200 : 503, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/vision/capture-if-useful') {
      const input = await body(req);
      const cameraId = Math.max(0, Math.floor(Number(input.cameraId ?? 0)));
      const retain = Boolean(input.retain);
      const result = await runtime.captureCameraForCognition(cameraId, retain);
      return json(res, result.ok || result.skipped ? 200 : 503, result);
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/skills') {
      return json(res, 200, {
        ok:true,
        summary:runtime.core.skillLibrarySummary(),
        compoundSkills:runtime.core.compoundSkillsSnapshot(32),
        reusable:runtime.core.reusableSkills(16),
        deviceTools:runtime.core.actionToolsSnapshot().filter(tool=>tool.id.startsWith('organism.device.')),
        note:'Reusable skills are evidence-gated procedures; they are not proof of general intelligence or consciousness.'
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/skills/execute') {
      const input=await body(req);
      const id=String(input.id??'').slice(0,160);
      const reason=String(input.reason??'api-skill-execution').slice(0,240);
      const toolInput=input.toolInput && typeof input.toolInput==='object' ? input.toolInput : {};
      const result=await runtime.core.executeReusableSkill(id,toolInput,reason);
      return json(res,result.ok?200:409,result);
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/semantic-intelligence') {
      return json(res,200,{ok:true,semanticIntelligence:runtime.core.p40SemanticSnapshot(),summary:runtime.core.p40SemanticSummary(),note:'P40 semantic intelligence state and summary; not evidence of subjective consciousness.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/native-perception') {
      return json(res,200,{ok:true,nativePerception:runtime.core.p41NativePerceptionSnapshot(),summary:runtime.core.p41NativePerceptionSummary(),note:'P41 native perception state; semantic interpretation requires explicit semantic evidence.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/semantic-perception') {
      return json(res,200,{ok:true,perception:runtime.core.p41PerceptionSnapshot(),summary:runtime.core.p41PerceptionSummary(),nextPerception:runtime.core.p41NextPerception(),note:'P41 semantic perception state; not evidence of subjective consciousness.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/sensorium/status') {
      const snapshot=runtime.core.snapshot();
      return json(res,200,{ok:true,cameraEvidence:snapshot.facets.embodiment.cameraEvidence,p41Native:snapshot.facets.embodiment.p41NativePerception.metrics,p41Semantic:runtime.core.p41PerceptionSummary(),nextPerception:runtime.core.p41NextPerception(),visionBackend:VISION_BACKEND?.id ?? null,visionEnabled:Boolean(VISION_BACKEND),note:'Camera evidence records acquisition and low-level signal only; semantic vision is true only when an explicitly configured vision backend returns semantic output.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/learning') {
      return json(res, 200, { ok:true, phase:'P23-true-learning-counterfactual-development', learning:runtime.core.p23LearningSnapshot(), evidenceDebt:runtime.core.p23EvidenceDebt(16), topSkills:runtime.core.p23TopSkills(16) });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/neural-world') {
      return json(res, 200, { ok:true, phase:'P27-learned-perception-world-foundation', p27:runtime.core.p27Snapshot(), note:'vision/audio inputs are compact local features; semantic vision/audio backend remains an explicit external/local capability' });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/neural-world/encode') {
      const input=await body(req);
      try {
        const vision=input.vision && Array.isArray(input.vision.features) ? { features:input.vision.features.slice(0,128).map(Number), confidence01:Number(input.vision.confidence01 ?? .62) } : undefined;
        const audio=input.audio && Array.isArray(input.audio.samples) ? { samples:input.audio.samples.slice(0,3200).map(Number), sampleRate:Number(input.audio.sampleRate ?? 16000), confidence01:Number(input.audio.confidence01 ?? .58) } : undefined;
        const encoded=runtime.core.p27Encode({text:input.text?String(input.text).slice(0,4000):undefined,vision,audio,world:input.world});
        const latent=runtime.core.p27Fuse(encoded); await runtime.core.flush();
        return json(res,200,{ok:true,encoded,latent,p27:runtime.core.p27Snapshot()});
      } catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/neural-world/counterfactuals') {
      try { const counterfactuals=runtime.core.p27Counterfactuals(); await runtime.core.flush(); return json(res,200,{ok:true,counterfactuals,p27:runtime.core.p27Snapshot()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/consciousness') {
      return json(res, 200, { ok:true, phase:'P31-functional-consciousness-mega-pack', consciousness:runtime.core.p31Snapshot(), note:'Функциональный профиль сознания-подобных механизмов; не доказательство субъективного опыта.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/causal-self') {
      return json(res,200,{ok:true,phase:'P32-causal-self-model-mega-pack', causalSelfModel:runtime.core.p32Snapshot(), diagnostics:runtime.core.p32Diagnostics(), note:'Функциональная причинная модель собственного поведения; не доказательство субъективного опыта.'});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/predict') {
      const input=await body(req); const allowed=['respond','explore','verify','rest','reflect','wait','defer'];
      const action=allowed.includes(String(input.action)) ? String(input.action) : 'wait';
      try { const prediction=runtime.core.p32PredictSelf(action); return json(res,200,{ok:true,prediction,diagnostics:runtime.core.p32Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/intervention') {
      const input=await body(req);
      try { const intervention=runtime.core.p32RecordIntervention({variable:String(input.variable||'unknown').slice(0,120),control01:Number(input.control01),treatment01:Number(input.treatment01),independent:Boolean(input.independent),repetitions:Number(input.repetitions||1)}); await runtime.core.flush(); return json(res,200,{ok:true,intervention,diagnostics:runtime.core.p32Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/lesion') {
      const input=await body(req);
      try { const result=runtime.core.p32LesionSelfCausal(Boolean(input.persist)); await runtime.core.flush(); return json(res,200,{ok:true,result,diagnostics:runtime.core.p32Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/consciousness/lesion') {
      const input=await body(req);
      const mode=['workspace','higher-order','self-perspective','none'].includes(String(input.mode)) ? String(input.mode) : 'none';
      try { const result=runtime.core.p31Lesion(mode); await runtime.core.flush(); return json(res,200,{ok:true,result,consciousness:runtime.core.p31Snapshot()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/developmental-synthesis') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, synthesis:runtime.core.developmentalSynthesisSnapshot(), diagnostics:runtime.core.developmentalSynthesisDiagnostics(), note:'Strategy abstraction, compound behavioral learning and counterfactual regret diagnostics; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/developmental-executive') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, executive:runtime.core.developmentalExecutiveSnapshot(), diagnostics:runtime.core.developmentalExecutiveDiagnostics(), note:'Autonomous developmental planning, goal-to-strategy execution, retention/transfer/repair state; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/meta-developmental') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, metaDevelopmental:runtime.core.metaDevelopmentalDiagnostics(), note:'Meta-level learning allocation and strategy abstraction diagnostics; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/developmental-portfolio') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, portfolio:runtime.core.developmentalPortfolioSnapshot(), diagnostics:runtime.core.developmentalPortfolioDiagnostics(), note:'Cross-domain developmental portfolio and learning-budget diagnostics; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/life') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, life:runtime.core.p39Snapshot(), diagnostics:runtime.core.p39Diagnostics(), note:'Continuous artificial life state with continuity, recovery, maintenance and host-transfer tracking; not evidence of subjective consciousness.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/life/host') {
      const input=await body(req);
      const hostId=String(input.hostId||'unknown-host').trim();
      if(!hostId) return json(res,400,{ok:false,error:'hostId is required'});
      try { const life=await runtime.core.p39RegisterHost(hostId); return json(res,200,{ok:true,life,diagnostics:runtime.core.p39Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/life-course') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, lifeCourse:runtime.core.lifeCourseSnapshot(), diagnostics:runtime.core.lifeCourseDiagnostics(), note:'Multi-horizon goal arbitration, developmental continuity and cross-goal conflict diagnostics; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/personal-worldline') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, worldline:runtime.core.personalWorldlineSnapshot(), diagnostics:runtime.core.personalWorldlineDiagnostics(), note:'Cross-linked autobiographical, relational, goal and entity trajectory diagnostics; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/life-trajectory') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, trajectory:runtime.core.integratedLifeTrajectorySnapshot(), diagnostics:runtime.core.integratedLifeTrajectoryDiagnostics(), note:'Integrated long-horizon trajectory control combining existing self/world/social/goal/learning signals; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/verified-autonomous-life') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, verifiedLife:runtime.core.verifiedAutonomousLifeSnapshot(), diagnostics:runtime.core.verifiedAutonomousLifeDiagnostics(), benchmark:runtime.core.verifiedAutonomousLifeBenchmark(), audit:runtime.core.verifiedAutonomousLifeSelfAudit(), note:'Decision-to-outcome accountability, integrity chain and longitudinal verification; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/autonomous-cognitive-life') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, autonomousLife:runtime.core.autonomousCognitiveLifeSnapshot(), diagnostics:runtime.core.autonomousCognitiveLifeDiagnostics(), benchmark:runtime.core.autonomousCognitiveLifeBenchmark(), nextPerception:runtime.core.autonomousCognitiveLifeSelectPerception(), note:'Closed-loop agency, active perception, autonomous scheduling, longitudinal personality and research controls; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/research-grade-organism') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, research:runtime.core.researchGradeOrganismSnapshot(), diagnostics:runtime.core.researchGradeOrganismDiagnostics(), benchmark:runtime.core.researchGradeOrganismBenchmark(), audit:runtime.core.researchGradeOrganismSelfAudit(), note:'Research-grade autonomous-life evidence, real postcondition contracts, longitudinal continuity, recovery and replication controls; not evidence of subjective consciousness.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/operational-life/causal-intervention') {
      const input=await body(req);
      try { const result=runtime.core.operationalLifeRecordCausalIntervention({target:String(input.target||'unknown'),control01:Number(input.control01),treatment01:Number(input.treatment01),confidence01:Number(input.confidence01),independent01:Number(input.independent01),repetitions:Number(input.repetitions||1)}); await runtime.core.flush(); return json(res,200,{ok:true,result,diagnostics:runtime.core.operationalLifeDiagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/operational-life/self-development') {
      const input=await body(req);
      try { const result=runtime.core.operationalLifeProposeSelfDevelopment({hypothesis:String(input.hypothesis||''),intervention:String(input.intervention||''),baseline01:Number(input.baseline01),treatment01:Number(input.treatment01),holdout01:Number(input.holdout01),safety01:Number(input.safety01)}); await runtime.core.flush(); return json(res,200,{ok:true,result,diagnostics:runtime.core.operationalLifeDiagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/operational-life/replication') {
      const input=await body(req);
      try { const result=runtime.core.operationalLifeRecordReplication({track:String(input.track||'closed-loop'),seed:Number(input.seed||0),control01:Number(input.control01),treatment01:Number(input.treatment01),holdout01:Number(input.holdout01),evaluator:String(input.evaluator||'api')}); await runtime.core.flush(); return json(res,200,{ok:true,result,diagnostics:runtime.core.operationalLifeDiagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/operational-life') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, operationalLife:runtime.core.operationalLifeSnapshot(), diagnostics:runtime.core.operationalLifeDiagnostics(), benchmark:runtime.core.operationalLifeBenchmark(), audit:runtime.core.operationalLifeSelfAudit(), note:'Verified operational life loop, external postconditions, active perception, causal experimentation, longitudinal personality/social/embodiment records, replication and recovery gates; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/cognitive-organism-continuity') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, continuity:runtime.core.cognitiveOrganismContinuitySnapshot(), diagnostics:runtime.core.cognitiveOrganismContinuityDiagnostics(), benchmark:runtime.core.cognitiveOrganismContinuityBenchmark(), note:'Integrated persistent agency, counterfactual planning, long-horizon learning, self/relational continuity, embodiment, research and verification controls; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/subsystems') {
      return json(res, 200, { ok:true, health:runtime.core.cognitiveSubsystemHealth(), note:'Physical subsystem health probes; availability is not a claim about consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/runtime/evidence') {
      return json(res, 200, { ok:true, evidence:runtime.evidenceSnapshot(), note:'Runtime evidence bus; observations are provenance-bound and do not by themselves prove subjective experience.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/personal-curriculum') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, personalCurriculum:runtime.core.personalCurriculumSnapshot(), diagnostics:runtime.core.personalCurriculumDiagnostics(), note:'Autobiographical/social learning-thread and curriculum-allocation diagnostics; not evidence of subjective consciousness.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/projects/active') {
      return json(res, 200, { ok:true, project:runtime.activeProjectSnapshot() });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/projects/tool') {
      const input=await body(req);
      const id=String(input.id||'').slice(0,160); const reason=String(input.reason||'api-project-tool').slice(0,240);
      const toolInput=input.toolInput && typeof input.toolInput==='object' ? input.toolInput : {};
      try { const result=await runtime.executeProjectTool(id,toolInput,reason); return json(res,result.ok?200:409,result); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/projects/step') {
      const input=await body(req);
      const reason=String(input.reason||'api-project-step').slice(0,240); const stepInput=input.toolInput && typeof input.toolInput==='object' ? input.toolInput : {};
      try { const result=await runtime.executeNextProjectStep(reason,stepInput); return json(res,result.ok?200:409,result); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/continual-intelligence') {
      return json(res, 200, { ok:true, phase:'P30-continual-intelligence-mega-pack', p30:runtime.core.p30Snapshot(), diagnostics:runtime.core.p30Diagnostics() });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/continual-intelligence/experiment') {
      const input=await body(req);
      try { const experiment=runtime.core.p30ProposeExperiment(String(input.taskId||'general').slice(0,96)); await runtime.core.flush(); return json(res,200,{ok:true,experiment,p30:runtime.core.p30Snapshot()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/continual-intelligence/trajectory') {
      const input=await body(req);
      try { const allowed=['respond','explore','verify','rest','reflect','wait','defer']; const actions=Array.isArray(input.actions)?input.actions.filter(a=>allowed.includes(a)).slice(0,6):['wait','rest']; return json(res,200,{ok:true,trajectory:runtime.core.p30Trajectory(actions)}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/true-learning') {
      return json(res, 200, { ok:true, phase:'P26-neural-perception-true-learning', p26:runtime.core.p26Snapshot(), p23:runtime.core.p23LearningSnapshot() });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/true-learning/replay') {
      const input=await body(req);
      try { const updates=await runtime.core.runP26Replay(Number(input.limit||256)); return json(res,200,{ok:true,updates,p26:runtime.core.p26Snapshot()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/scientific-development') {
      return json(res, 200, { ok:true, phase:'P25-scientific-development-and-evaluation', p25:runtime.core.p25Snapshot() });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/scientific-development/experiment') {
      const input=await body(req);
      try {
        const experiment=runtime.core.p25RecordControlledExperiment({
          name:String(input.name||'controlled-experiment').slice(0,160), controlLabel:String(input.controlLabel||'control').slice(0,80), treatmentLabel:String(input.treatmentLabel||'treatment').slice(0,80),
          metric:String(input.metric||'metric').slice(0,120), controlValue:Number(input.controlValue), treatmentValue:Number(input.treatmentValue), sampleSize:Number(input.sampleSize||1), independentConditions:Boolean(input.independentConditions), interpretation:input.interpretation?String(input.interpretation).slice(0,240):undefined,
        });
        await runtime.core.flush(); return json(res,200,{ok:true,experiment,p25:runtime.core.p25Snapshot()});
      } catch (error) { return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/scientific-development/evaluation') {
      const input=await body(req);
      try {
        const evaluation=runtime.core.p25RecordEvaluation({ taskId:String(input.taskId||'task').slice(0,120), suite:String(input.suite||'default').slice(0,120), phase:['holdout','device','longitudinal','regression'].includes(input.phase)?input.phase:'regression', score01:Number(input.score01), criteriaPassed:Number(input.criteriaPassed||0), criteriaTotal:Number(input.criteriaTotal||0), evaluator:String(input.evaluator||'external').slice(0,120), evidenceLevel:['unverified','observed','repeated','controlled','longitudinal','device-verified'].includes(input.evidenceLevel)?input.evidenceLevel:undefined });
        await runtime.core.flush(); return json(res,200,{ok:true,evaluation,p25:runtime.core.p25Snapshot()});
      } catch (error) { return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/scientific-development/ablation') {
      const input=await body(req);
      try { const ablation=runtime.core.p25RecordAblation({module:String(input.module||'unknown').slice(0,120),baselineScore01:Number(input.baselineScore01),ablatedScore01:Number(input.ablatedScore01),sampleSize:Number(input.sampleSize||1),interpretation:input.interpretation?String(input.interpretation).slice(0,240):undefined}); await runtime.core.flush(); return json(res,200,{ok:true,ablation,p25:runtime.core.p25Snapshot()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'GET' && url.pathname === '/api/organism/world-identity') {
      return json(res, 200, { ok:true, phase:'P24-world-model-multimodal-identity', p24:runtime.core.p24Snapshot(), bodyWorldPrediction:runtime.core.p24BodyWorldPrediction(5), modelSwitchBenchmark:runtime.core.p24ModelSwitchSnapshot() });
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/model-switch/benchmark') {
      const input=await body(req);
      if(!input.requestId || !input.backendA || !input.backendB || typeof input.responseA !== 'string' || typeof input.responseB !== 'string') return json(res,400,{ok:false,error:'invalid-model-switch-trial'});
      const trial=runtime.core.p24RecordModelSwitchTrial({ requestId:String(input.requestId), backendA:String(input.backendA), backendB:String(input.backendB), responseA:String(input.responseA).slice(0,12000), responseB:String(input.responseB).slice(0,12000), latencyAms:Number(input.latencyAms||0), latencyBms:Number(input.latencyBms||0), qualityA01:input.qualityA01==null?null:Number(input.qualityA01), qualityB01:input.qualityB01==null?null:Number(input.qualityB01), identityAnchor:input.identityAnchor?String(input.identityAnchor).slice(0,1000):undefined, constraints:Array.isArray(input.constraints)?input.constraints.slice(0,16).map(String):[] });
      await runtime.core.flush();
      return json(res,200,{ok:true,trial,p24:runtime.core.p24ModelSwitchSnapshot()});
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/social-mind') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, diagnostics:runtime.core.socialMindDiagnostics(), socialMind:runtime.core.socialMindSnapshot(), secondOrder:runtime.core.socialMindSecondOrder('user'), counterfactuals:runtime.core.socialMindCounterfactuals('user'), repair:runtime.core.socialMindRepairProposal('user'), note:'Social Mind stores bounded person candidates, first- and second-order hypotheses, counterfactual alternatives and outcome learning. Person candidates are not verified real-world identities and inference is uncertainty-bearing.' });
    }

    if (req.method === 'GET' && url.pathname === '/api/organism/developmental-self') {
      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, developmental:runtime.core.developmentalSelfSnapshot(), note:'Developmental self is a bounded causal lineage and forecasting system; its metrics are not proof of subjective experience or consciousness.' });
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
      if (relative.includes('..')) return json(res, 400, { ok: false });
      const file = path.join(PUBLIC, relative);
      let content;
      try { content = await readFile(file); } catch (error) { if (error?.code === 'ENOENT') return json(res, 404, { ok:false, error:'static-not-found' }); throw error; }
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
  } catch (error) {
    return json(res, 500, { ok: false, error: error?.message || String(error) });
  }
}

const server = http.createServer((req, res) => void route(req, res));
server.listen(PORT, HOST, () => console.log(`[Neuro-Kurisu Evolution] http://${HOST}:${PORT}`));

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (runtimeReady) await runtime.core.endTemporalSession('shutdown', true).catch(() => {});
  await runtime.flush().catch(() => {});
  runtime.stop();
  await lock.release().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  await runtime.init();
  runtimeReady = true;
} catch (error) {
  console.error('[Neuro-Kurisu Evolution] runtime init failed:', error?.stack || error);
  await shutdown();
  process.exitCode = 1;
}
