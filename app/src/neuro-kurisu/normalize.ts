import type { OrganismSnapshot, ActionKind, EmotionLabel, MemoryRecord, Skill, Goal, Belief, AvatarBrainEnvelopeV1 } from "@/organism/types";
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

export function toOrganismSnapshot(remote: BackendUiSnapshot, chat: OrganismSnapshot["chat"]): OrganismSnapshot {
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
    voice: {
      speaking: Boolean(remote.voice?.speaking),
      listening: Boolean(remote.voice?.listening),
      ttsAvailable: Boolean(remote.voice?.ttsAvailable),
      sttAvailable: Boolean(remote.voice?.sttAvailable),
    },
    avatarBrain: normalizeAvatarBrain(remote.avatarBrain, Number(remote.tick)),
    needs: remote.state.needs,
    emotion: {
      label: emotion(remote.emotion.label),
      valence: clamp(remote.emotion.valence),
      arousal: clamp(remote.emotion.arousal),
      dominance: clamp(remote.emotion.dominance),
      tendency: action(remote.emotion.tendency),
      cause: remote.emotion.cause,
    },
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
