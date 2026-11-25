import type { OrganismSnapshot, ActionKind, EmotionLabel, EmotionTendency, OrganismAffectFrame, MemoryRecord, Skill, Goal, Belief, AvatarBrainEnvelopeV1 } from "@/organism/types";
import type { BackendUiSnapshot } from "./types";

const clamp = (n: unknown, fallback = 0) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : fallback;
};

const action = (x: unknown): ActionKind => {
  const allowed = new Set<ActionKind>(["respond","explore","verify","rest","reflect","wait"]);
  return allowed.has(String(x) as ActionKind) ? String(x) as ActionKind : "wait";
};

const emotion = (x: unknown): EmotionLabel => {
  const allowed = new Set<EmotionLabel>(["curiosity","calm","joy","anxiety","frustration","sadness","anger","protective"]);
  return allowed.has(String(x) as EmotionLabel) ? String(x) as EmotionLabel : "calm";
};


const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const EMOTION_TENDENCIES = new Set<EmotionTendency>(["respond","explore","verify","rest","reflect","wait","engage","protect","withdraw","approach","defer"]);
const AFFECT_SOURCES = new Set(["emotion-appraisal","appraisal-summary","cognitive-field-fallback","default"]);
function normalizeAffectFrame(value: unknown, tick: number, now: number): OrganismAffectFrame | null {
  if(!isRecord(value)||value.schemaVersion!==1||!Number.isSafeInteger(value.stateVersion)||value.stateVersion!==tick||
    !Number.isSafeInteger(value.tick)||Number(value.tick)<0||typeof value.label!=="string"||
    !EMOTION_TENDENCIES.has(value.actionTendency as EmotionTendency)||!AFFECT_SOURCES.has(String(value.source))||
    typeof value.cause!=="string"||value.cause.length>512) return null;
  const sample=value.sampledAt,age=now-Number(sample);
  if(typeof sample!=="number"||!Number.isFinite(sample)||sample<0||age< -250||age>30_000||
    typeof value.ageMs!=="number"||!Number.isFinite(value.ageMs)||Math.abs(value.ageMs-Math.max(0,age))>5_000||
    typeof value.freshness01!=="number"||!Number.isFinite(value.freshness01)||value.freshness01<=0||value.freshness01>1||
    Math.abs(value.freshness01-Math.max(0,1-Math.max(0,age)/30_000))>.1) return null;
  if(!["valence01","arousal01","dominance01","intensity01","confidence01","stress01"].every(k=>typeof value[k]==="number"&&Number.isFinite(value[k])&&Number(value[k])>=0&&Number(value[k])<=1))return null;
  if(value.episodeId!==null&&(typeof value.episodeId!=="string"||value.episodeId.length>256))return null;
  if(value.feelingId!==null&&(typeof value.feelingId!=="string"||value.feelingId.length>256))return null;
  const moodRaw=value.mood;
  let mood: OrganismAffectFrame["mood"]=null;
  if(isRecord(moodRaw)&&moodRaw.schemaVersion===1&&typeof moodRaw.sampledAt==="number"&&Number.isFinite(moodRaw.sampledAt)&&
    typeof moodRaw.ageMs==="number"&&Number.isFinite(moodRaw.ageMs)&&typeof moodRaw.freshness01==="number"&&Number.isFinite(moodRaw.freshness01)){
    const moodAge=now-moodRaw.sampledAt;
    const moodNumeric=["valence01","arousal01","stress01","socialSafety01","deviation01","recoveryRate01","resilience01","resilienceConfidence01"];
    const moodValid=moodAge>=-250&&moodAge<=7*24*60*60_000&&Math.abs(moodRaw.ageMs-Math.max(0,moodAge))<=5_000&&
      moodRaw.freshness01>=0&&moodRaw.freshness01<=1&&Math.abs(moodRaw.freshness01-Math.exp(-Math.max(0,moodAge)/(24*60*60_000)))<=.08&&
      moodNumeric.every(k=>typeof moodRaw[k]==="number"&&Number.isFinite(moodRaw[k])&&Number(moodRaw[k])>=0&&Number(moodRaw[k])<=1);
    if(moodValid)mood=moodRaw as unknown as OrganismAffectFrame["mood"];
  }
  const allowedLabels=new Set(["curiosity","calm","joy","anxiety","frustration","sadness","anger","protective"]);
  if(!allowedLabels.has(value.label))return null;
  return {...value,mood} as unknown as OrganismAffectFrame;
}

const AVATAR_BRAIN_EXPRESSIONS = new Set(["neutral", "curious", "focused", "amused", "concerned", "tired", "determined"]);
const AVATAR_BRAIN_PROFILES = new Set(["2d", "2.5d", "3d"]);
const AVATAR_BRAIN_CHANNELS = [
  "eyeOpen", "browRaise", "browFurrow", "mouthSmile", "mouthOpen", "cheekRaise",
  "headTilt", "headYaw", "gazeX", "gazeY", "idleMotion", "lipSyncGain",
] as const;
const AVATAR_BRAIN_AFFECT = [
  "valence01", "arousal01", "dominance01", "curiosity01",
  "warmth01", "stress01", "confidence01", "memoryRecall01",
] as const;

function normalizeAvatarBrain(value: unknown, tick: number): AvatarBrainEnvelopeV1 | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.stateVersion) || value.stateVersion !== tick) return null;
  if (!isRecord(value.frame)) return null;
  const frame = value.frame;
  if (frame.schemaVersion !== 1 || frame.source !== "organism-state"
    || typeof frame.profile !== "string" || !AVATAR_BRAIN_PROFILES.has(frame.profile)
    || typeof frame.expression !== "string" || !AVATAR_BRAIN_EXPRESSIONS.has(frame.expression)
    || !Number.isFinite(frame.expressionWeight) || Number(frame.expressionWeight) < 0 || Number(frame.expressionWeight) > 1
    || !Number.isFinite(frame.freshness01) || Number(frame.freshness01) < 0 || Number(frame.freshness01) > 1
    || typeof frame.reducedMotion !== "boolean" || !Number.isFinite(frame.projectedAt) || Number(frame.projectedAt) < 0) return null;
  const channels = frame.channels;
  const affect = frame.affect;
  const rendererHints = frame.rendererHints;
  if (!isRecord(channels) || AVATAR_BRAIN_CHANNELS.some((key) =>
    !Number.isFinite(channels[key]) || Number(channels[key]) < -1 || Number(channels[key]) > 1)) return null;
  if (!isRecord(affect) || AVATAR_BRAIN_AFFECT.some((key) =>
    !Number.isFinite(affect[key]) || Number(affect[key]) < 0 || Number(affect[key]) > 1)) return null;
  if (!isRecord(rendererHints) || !isRecord(rendererHints.live2d)
    || !isRecord(rendererHints.layered2d) || !isRecord(rendererHints.spatial3d)) return null;
  if (Object.values(rendererHints.live2d).some((v) => !Number.isFinite(v))
    || Object.values(rendererHints.layered2d).some((v) => !Number.isFinite(v))
    || Object.values(rendererHints.spatial3d).some((v) => !Number.isFinite(v))) return null;
  return value as unknown as AvatarBrainEnvelopeV1;
}

export function toOrganismSnapshot(remote: BackendUiSnapshot, chat: OrganismSnapshot["chat"], now = Date.now()): OrganismSnapshot {
  const hasAffectFrame = Object.prototype.hasOwnProperty.call(remote, "affectFrame");
  const affectFrame = hasAffectFrame ? normalizeAffectFrame(remote.affectFrame, Number(remote.tick), now) : null;
  const normalizedEmotion = affectFrame ? {
    label: affectFrame.label, valence: affectFrame.valence01, arousal: affectFrame.arousal01,
    dominance: affectFrame.dominance01, tendency: affectFrame.actionTendency, cause: affectFrame.cause,
  } : hasAffectFrame ? {
    label: "calm" as EmotionLabel, valence: .5, arousal: .22, dominance: .5,
    tendency: "engage" as EmotionTendency, cause: "stale-affect-frame",
  } : {
    label: emotion(remote.emotion.label), valence: clamp(remote.emotion.valence),
    arousal: clamp(remote.emotion.arousal), dominance: clamp(remote.emotion.dominance),
    tendency: (EMOTION_TENDENCIES.has(remote.emotion.tendency as EmotionTendency) ? remote.emotion.tendency : action(remote.emotion.tendency)) as EmotionTendency,
    cause: remote.emotion.cause,
  };
  const last = remote.lastDecision;
  const memories: MemoryRecord[] = remote.memories.map((m) => ({
    id: m.id,
    kind: ["self","identity","autobiographical"].includes(m.kind.toLowerCase()) ? "self" : ["semantic","belief","fact","goal"].some((k) => m.kind.toLowerCase().includes(k)) ? "semantic" : "episode",
    text: m.summary,
    salience: clamp(m.salience),
    recencyTick: remote.tick,
    createdAt: Number(m.createdAt || remote.at),
    emotion: emotion(remote.emotion.label),
    option: action(remote.state.lastAction),
    predictionError: clamp(m.predictionError, clamp(remote.state.predictionError)),
    verified: String(m.kind).includes("verified"),
    touches: Number(m.retrievalCount ?? (m.retrievedAt ? 1 : 0)),
  }));
  const skills: Skill[] = remote.skills.map((s) => ({
    id: s.id,
    name: `${s.action} · ${s.context}`,
    pattern: s.status,
    uses: Number(s.uses || 0),
    success: clamp(s.successRate),
    coalition: [],
    lastTick: remote.tick,
  }));
  const goals: Goal[] = remote.goals.map((g) => ({
    id: g.id,
    title: g.title,
    source: g.source === "homeostatic" ? "homeostatic" : g.source === "learned" ? "learned" : g.source === "intrinsic" ? "intrinsic" : "learned",
    importance: clamp(g.importance),
    urgency: clamp(g.urgency),
    progress: clamp(g.progress),
    status: g.status === "completed" ? "done" : g.status === "paused" ? "paused" : "active",
  }));
  const beliefs: Belief[] = remote.beliefs.map((b) => ({
    id: b.id,
    claim: b.claim,
    kind: ["FACT","MEASURED","ESTIMATED","HYPOTHESIS"].includes(b.kind) ? b.kind as Belief["kind"] : "HYPOTHESIS",
    confidence: clamp(b.confidence),
    support: Number(b.support || 0),
    createdAt: remote.at,
    updatedAt: remote.at,
    source: b.source || "canonical-memory",
  }));

  return {
    version: Number(remote.schemaVersion),
    tick: Number(remote.tick),
    at: Number(remote.at),
    awake: Boolean(remote.awake),
    avatarBrain: normalizeAvatarBrain(remote.avatarBrain, Number(remote.tick)),
    needs: remote.state.needs,
    emotion: normalizedEmotion,
    affectFrame,
    identity: {
      subjectId: remote.identity.subjectId,
      name: remote.identity.name,
      fingerprint: remote.identity.fingerprint,
      createdAt: remote.identity.createdAt,
      cycles: remote.identity.cycles,
      traits: remote.identity.traits,
      traitNames: Array.isArray(remote.identity.traitNames) ? remote.identity.traitNames : [],
      trust: clamp(remote.identity.trust),
    },
    lastAction: action(remote.state.lastAction),
    lastOption: action(remote.state.lastAction),
    lastReward: clamp(remote.state.lastReward01 ?? 0.5),
    predictionError: clamp(remote.state.predictionError),
    valueEstimate: last?.selectedScore ?? 0,
    curiosity: clamp(remote.state.needs.novelty),
    memories,
    beliefs,
    skills,
    goals,
    chat,
    lastDecision: last ? {
      tick: last.tick,
      option: action(last.action),
      optionValue: Number(last.selectedScore || 0),
      action: action(last.action),
      candidates: last.candidates.map((c) => ({ action: action(c.action), score: Number(c.score || 0), confidence: clamp(c.confidence) })),
      predictionError: clamp(remote.state.predictionError),
      retrievedIds: remote.memories.slice(0, 8).map((m) => m.id),
      workspace: last.workspace,
      reason: last.reason,
    } : null,
    canonicalWorld: {
      scene: remote.world.scene,
      featureDim: Number(remote.world.featureDim || 0),
      hiddenDim: Number(remote.world.hiddenDim || 0),
      predictionError01: clamp(remote.world.predictionError01),
      modelSamples: Number(remote.world.modelSamples || 0),
      latentConfidence01: clamp(remote.world.lastLatentConfidence01),
      entities: Number(remote.world.entities || 0),
      conflicts: Number(remote.world.conflicts || 0),
      workspaceIgnition01: clamp(remote.workspace.ignition01),
      workspaceRecurrence01: clamp(remote.workspace.recurrence01),
      workspaceDiversity01: clamp(remote.workspace.diversity01),
      identityContinuity01: clamp(remote.consciousness.identityContinuity01),
      metacognitiveAccuracy01: clamp(remote.consciousness.metacognitiveAccuracy01),
      evidenceCoverage01: clamp(remote.consciousness.evidenceCoverage01),
    },
    worldErrorEma: clamp(remote.world.predictionError01, clamp(remote.state.predictionError)),
    replayCount: Number(remote.learning.steps || 0),
    learnSteps: Number(remote.learning.steps || 0),
    languageCalls: Number(remote.language?.calls ?? 0),
    locale: "ru",
    thoughts: [
      `${remote.state.lastAction} · next ${remote.state.predictedNextAction}`,
      `world ${remote.world.scene} · P.E. ${remote.world.predictionError01.toFixed(3)}`,
      `workspace ignition ${remote.workspace.ignition01.toFixed(3)}`,
    ],
  };
}
