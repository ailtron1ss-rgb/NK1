import { useEffect, useRef, useState } from "react";
import {
  EmbodimentSwitchCoordinator,
  type EmbodimentAdapter,
  type AdapterApplyReceipt,
  type AdapterVerification,
  type EmbodimentSwitchPhase,
} from "./avatar/embodimentCoordinator";
import type { EmbodimentMode, SemanticBodyState, ExpressionChannel } from "./avatar/embodimentSwitch";
import type { EmbodimentRendererSignal } from "./avatar/embodimentRendererSignals";
import type { EmotionLabel, OrganismSnapshot } from "@/organism/types";
import { neuroApiUrl } from "@/neuro-kurisu/api";
import {
  connectNativeSpeechProviderEvents,
  describeNativeSpeechProviderStatus,
  type NativeSpeechProviderConnection,
  type NativeSpeechProviderEvent,
} from "./avatar/nativeSpeechProviderEvents";
import { planAvatarMotorIntent } from "./avatar/motorIntent";
import { buildBrowserVoiceProsody } from "./avatar/browserVoiceProsody";
import {
  connectMotorFrameStream,
  type MotorFrameConnectionStatus,
  type MotorFrameProjectionState,
  type RendererMotorCommandBatch,
} from "./avatar/motorFrameStream";
import { cn } from "@/lib/utils";
import { LegacySpriteDeck } from "@/legacy/avatar/LegacySpriteDeck";
import { KurisuOriginalStage } from "./KurisuOriginalStage";
import { Avatar3DStage } from "./Avatar3DStage";
import { readAvatarPreference, writeAvatarPreference } from "@/legacy/avatar/safeLocalStorage";
import {
  appendVisemeClockAnchor,
  buildVisemeTimeline,
  CLOSED_MOUTH,
  reanchorMonotonicAudioClock,
  sampleMonotonicAudioClock,
  sampleVisemeClock,
  sampleVisemeTimeline,
  timelineOffsetForCharIndex,
  type VisemeClockAnchor,
  type EmbodimentIntentV1,
  type MouthPose,
  type SpeechPhase,
  type VisemeFrame,
  createSpeechLifecycleEventV1,
  acceptsSpeechLifecycleEventV1,
  type SpeechLifecycleEventV1,
  type SpeechLifecyclePhaseV1,
} from "./avatar/embodimentTimeline";

const EXPR: Record<EmotionLabel, string> = {
  curiosity: "thinking", calm: "neutral", joy: "happy", anxiety: "sad",
  frustration: "angry", sadness: "sad", anger: "angry", protective: "focused",
};
type ViewMode = "live2d" | "legacy" | "original" | "2.5d" | "3d";
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
type Live2DActionStatus = "started" | "unavailable" | "error" | "not-requested";
const isLive2DActionStatus = (value: unknown): value is Live2DActionStatus =>
  value === "started" || value === "unavailable" || value === "error" || value === "not-requested";

function inferSpeechLanguage(text: string): string {
  const cyrillic = (text.match(/[А-Яа-яЁё]/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/gu) ?? []).length;
  return cyrillic >= latin ? "ru-RU" : "en-US";
}

type BrowserSpeechSession = {
  speechEventId: string;
  audioClockId: string;
  text: string;
  timeline: VisemeFrame[];
  boundaryAnchors: VisemeClockAnchor[];
  lastAudioElapsedMs: number;
  anchorAudioPerformanceAtMs: number;
  anchorAudioElapsedMs: number;
  clockSource: "speech-synthesis-elapsed-time-anchored-monotonic" | "speech-synthesis-boundary-anchored-monotonic";
  voiceEmphasis: number;
  lifecycleSequence: number;
  lastLifecycleEvent: SpeechLifecycleEventV1 | null;
};

function speechAudioClockNow(session: BrowserSpeechSession, nowMs: number): number {
  // Persist the monotonic high-water mark on every sample, not only on boundary/end.
  // Otherwise a later browser elapsedTime boundary could reset the clock backwards.
  session.lastAudioElapsedMs = sampleMonotonicAudioClock(
    session.lastAudioElapsedMs, session.anchorAudioElapsedMs, session.anchorAudioPerformanceAtMs, nowMs,
  );
  return session.lastAudioElapsedMs;
}

function speechTimelineNow(session: BrowserSpeechSession, nowMs: number): number {
  return sampleVisemeClock(session.boundaryAnchors, speechAudioClockNow(session, nowMs));
}

function recordSpeechLifecycle(session: BrowserSpeechSession, phase: SpeechLifecyclePhaseV1, nowMs: number, details: { charIndex?: number; errorCode?: string } = {}): void {
  const event = createSpeechLifecycleEventV1({
    eventId: `${session.speechEventId}:${session.lifecycleSequence + 1}`,
    utteranceId: session.speechEventId,
    sequence: session.lifecycleSequence + 1,
    provider: "browser-speech-synthesis",
    clockId: session.audioClockId,
    monotonicTimeMs: Math.max(0, speechAudioClockNow(session, nowMs)),
    phase,
    ...details,
  });
  if (!acceptsSpeechLifecycleEventV1(session.lastLifecycleEvent, event)) return;
  session.lifecycleSequence = event.sequence;
  session.lastLifecycleEvent = event;
}

function sameMouthPose(a: MouthPose, b: MouthPose): boolean {
  return a.viseme === b.viseme && Math.abs(a.open - b.open) < 0.015 && Math.abs(a.form - b.form) < 0.02;
}

export function AvatarStage({ snap, thinking = false }: { snap: OrganismSnapshot; thinking?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const observedInitialTurn = useRef(false);
  const lastObservedTurnKey = useRef("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speechSequenceRef = useRef(0);
  const intentStateVersionRef = useRef(0);
  const latestIntentStateVersionRef = useRef(0);
  const [intentAck, setIntentAck] = useState<{ stateVersion: number; status: "parameters-observed" | "accepted-unverified"; observedCount: number; expressionStatus: Live2DActionStatus; motionStatus: Live2DActionStatus } | null>(null);
  const motionIntentKeyRef = useRef("");
  const motionIntentTokenRef = useRef(0);
  const activeSpeechSessionRef = useRef<BrowserSpeechSession | null>(null);
  const lastSpeechSessionRef = useRef<BrowserSpeechSession | null>(null);
  const speechPhaseRef = useRef<SpeechPhase>("idle");
  const [live, setLive] = useState(false);
  const [live2dMotorModelId, setLive2dMotorModelId] = useState<string | null>(null);
  const live2dMotorModelIdRef = useRef<string | null>(null);
  const [live2dMotorBatch, setLive2dMotorBatch] = useState<RendererMotorCommandBatch | null>(null);
  const [live2dMotorProjection, setLive2dMotorProjection] = useState<MotorFrameProjectionState>("unmapped");
  const [live2dMotorConnection, setLive2dMotorConnection] = useState<MotorFrameConnectionStatus>("unavailable");
  const [live2dMotorAck, setLive2dMotorAck] = useState<{ frameTick: number; observedCount: number; commandCount: number; readbackAvailable: boolean } | null>(null);
  const [viewerReadyRevision, setViewerReadyRevision] = useState(0);
  // Native speech is opt-in. Opening the app never starts speaking historical chat.
  const [voiceEnabled, setVoiceEnabled] = useState(() => readAvatarPreference("kurisu-avatar-voice-enabled") === "true");
  const [voiceName, setVoiceName] = useState(() => readAvatarPreference("kurisu-avatar-voice-name") ?? "");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<"off" | "ready" | "unsupported" | "speaking" | "unknown">(() => typeof window !== "undefined" && "speechSynthesis" in window ? "off" : "unsupported");
  const [mouthPose, setMouthPose] = useState<MouthPose>(CLOSED_MOUTH);
  const [nativeSpeechProviderEvent, setNativeSpeechProviderEvent] = useState<NativeSpeechProviderEvent | null>(null);
  const [nativeSpeechConnection, setNativeSpeechConnection] = useState<NativeSpeechProviderConnection>("connecting");
  const [mode, setMode] = useState<ViewMode>(() => {
    const saved = readAvatarPreference("kurisu-avatar-mode");
    return saved === "legacy" || saved === "original" || saved === "2.5d" || saved === "3d" ? saved : "live2d";
  });
  const currentModeRef = useRef(mode);
  currentModeRef.current = mode;
  const [activeSwitch, setActiveSwitch] = useState<{ executionId: string; revision: number } | null>(null);
  const [switchPhase, setSwitchPhase] = useState<EmbodimentSwitchPhase>("idle");
  const [switchDetail, setSwitchDetail] = useState("");
  const switchRevisionRef = useRef(0);
  const switchExecutionCounterRef = useRef(0);
  const switchContextRef = useRef<{ executionId: string; revision: number } | null>(null);
  const switchCoordinatorRef = useRef<EmbodimentSwitchCoordinator | null>(null);
  const switchSignalStoreRef = useRef(new Map<string, EmbodimentRendererSignal>());
  const switchWaitersRef = useRef(new Map<string, Set<{ kind: "ready" | "apply" | "verify"; resolve: (signal: EmbodimentRendererSignal) => void; reject: (error: Error) => void }>>());
  const signalKey = (executionId: string, adapterId: string, kind: string) => [executionId, adapterId, kind].join("|");
  const publishRendererSignal = (signal: EmbodimentRendererSignal) => {
    const executionId = signal.kind === "apply" ? signal.receipt.executionId
      : signal.kind === "verify" ? signal.verification.executionId : signal.executionId;
    const adapterId = signal.kind === "apply" ? signal.receipt.adapterId
      : signal.kind === "verify" ? signal.verification.adapterId : signal.adapterId;
    const key = signalKey(executionId, adapterId, signal.kind);
    const store = switchSignalStoreRef.current;
    store.set(key, signal);
    if (store.size > 64) store.delete(store.keys().next().value as string);
    const waiterKey = signalKey(executionId, adapterId, "*");
    const waiters = switchWaitersRef.current.get(waiterKey);
    if (waiters) {
      for (const waiter of [...waiters]) {
        if (signal.kind === "failed") {
          waiter.reject(new Error(signal.reason || "renderer-prepare-failed"));
          waiters.delete(waiter);
        } else if (signal.kind === waiter.kind) {
          waiter.resolve(signal);
          waiters.delete(waiter);
        }
      }
      if (waiters.size === 0) switchWaitersRef.current.delete(waiterKey);
    }
  };
  const waitForRendererSignal = (
    kind: "ready" | "apply" | "verify",
    adapterId: string,
    executionId: string,
    signal: AbortSignal,
    timeoutMs = 9000,
  ): Promise<EmbodimentRendererSignal> => {
    const cachedFailure = switchSignalStoreRef.current.get(signalKey(executionId, adapterId, "failed"));
    if (cachedFailure?.kind === "failed") return Promise.reject(new Error(cachedFailure.reason));
    const cached = switchSignalStoreRef.current.get(signalKey(executionId, adapterId, kind));
    if (cached) return Promise.resolve(cached);
    if (signal.aborted) return Promise.reject(new Error("switch-aborted"));
    return new Promise((resolve, reject) => {
      const waiterKey = signalKey(executionId, adapterId, "*");
      const waiter = { kind, resolve, reject };
      const waiters = switchWaitersRef.current.get(waiterKey) ?? new Set();
      waiters.add(waiter);
      switchWaitersRef.current.set(waiterKey, waiters);
      const cleanup = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        waiters.delete(waiter);
        if (!waiters.size) switchWaitersRef.current.delete(waiterKey);
      };
      const timer = window.setTimeout(() => { cleanup(); reject(new Error("renderer-signal-timeout:" + kind)); }, timeoutMs);
      const onAbort = () => { cleanup(); reject(new Error("switch-aborted")); };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  };
  const embodimentModeForView = (view: ViewMode): EmbodimentMode | null =>
    view === "live2d" ? "live2d" : view === "2.5d" ? "depth2d" : view === "3d" ? "vrm3d" : null;
  const viewForEmbodimentMode = (target: EmbodimentMode): ViewMode =>
    target === "live2d" ? "live2d" : target === "depth2d" ? "2.5d" : "3d";
  const adapterIdForMode = (target: EmbodimentMode): string =>
    target === "live2d" ? "nk1-live2d" : target === "depth2d" ? "nk1-depth-rig-scene-v1" : "nk1-three-scene-v1";
  const createEmbodimentAdapter = (target: EmbodimentMode): EmbodimentAdapter => {
    const adapterId = adapterIdForMode(target);
    const view = viewForEmbodimentMode(target);
    const context = () => switchContextRef.current;
    const ensureReady = async (signal: AbortSignal) => {
      const active = context();
      if (!active) throw new Error("switch-context-missing");
      if (currentModeRef.current !== view) {
        setMode(view);
        const ready = await waitForRendererSignal("ready", adapterId, active.executionId, signal);
        if (ready.kind !== "ready" || ready.stateRevision !== active.revision) throw new Error("renderer-ready-revision-mismatch");
      }
    };
    return {
      id: adapterId,
      mode: target,
      prepare: async (_state: SemanticBodyState, signal: AbortSignal) => {
        const active = context();
        if (!active) throw new Error("switch-context-missing");
        if (currentModeRef.current !== view) setMode(view);
        const ready = await waitForRendererSignal("ready", adapterId, active.executionId, signal);
        if (ready.kind !== "ready" || ready.stateRevision !== active.revision) throw new Error("renderer-ready-revision-mismatch");
      },
      apply: async (_state: SemanticBodyState, signal: AbortSignal): Promise<AdapterApplyReceipt> => {
        const active = context();
        if (!active) throw new Error("switch-context-missing");
        await ensureReady(signal);
        const result = await waitForRendererSignal("apply", adapterId, active.executionId, signal);
        if (result.kind !== "apply") throw new Error("renderer-apply-receipt-missing");
        return result.receipt;
      },
      verify: async (_receipt: AdapterApplyReceipt, signal: AbortSignal): Promise<AdapterVerification> => {
        const active = context();
        if (!active) throw new Error("switch-context-missing");
        const result = await waitForRendererSignal("verify", adapterId, active.executionId, signal);
        if (result.kind !== "verify") throw new Error("renderer-verification-missing");
        return result.verification;
      },
      dispose: async () => undefined,
    };
  };
  const buildSemanticBodySnapshot = (revision: number): SemanticBodyState => {
    const rawEmotion = String(snap.emotion.label).toLowerCase();
    const emotion: ExpressionChannel =
      rawEmotion.includes("joy") || rawEmotion.includes("happy") ? "joy"
      : rawEmotion.includes("sad") ? "sadness"
      : rawEmotion.includes("ang") || rawEmotion.includes("frustr") ? "anger"
      : rawEmotion.includes("anx") || rawEmotion.includes("fear") ? "anxiety"
      : rawEmotion.includes("curio") ? "curiosity"
      : rawEmotion.includes("protect") ? "protective"
      : rawEmotion.includes("surpris") ? "surprise" : "neutral";
    const speechPhaseValue = String(speechPhaseRef.current);
    const speechPhase = (["idle", "starting", "speaking", "ended", "cancelled"].includes(speechPhaseValue)
      ? speechPhaseValue : "unknown") as SemanticBodyState["speech"]["phase"];
    const activeSpeech = activeSpeechSessionRef.current;
    const session = activeSpeech ?? lastSpeechSessionRef.current;
    const audioTimeMs = activeSpeech ? speechAudioClockNow(activeSpeech, performance.now())
      : Math.max(0, Number(session?.lastAudioElapsedMs ?? 0));
    return {
      schemaVersion: 1,
      revision,
      capturedAtMonotonicMs: performance.now(),
      emotion,
      emotionIntensity: Math.max(0, Math.min(1, snap.emotion.arousal)),
      expression: String(snap.emotion.label || "neutral").slice(0, 96),
      gaze: { x: Math.max(-1, Math.min(1, originalGaze.x)), y: Math.max(-1, Math.min(1, originalGaze.y)) },
      speech: { eventId: session?.speechEventId ?? null, phase: speechPhase, audioTimeMs,
        mouthOpen: Math.max(0, Math.min(1, mouthPose.open)), mouthForm: Math.max(-1, Math.min(1, mouthPose.form)) },
      action: String(snap.lastOption || "wait").slice(0, 96),
      intentId: turnKey || null,
      pose: { gazeX: originalGaze.x, gazeY: originalGaze.y },
      wardrobeId: null,
    };
  };
  const requestViewMode = async (targetView: ViewMode) => {
    const previousView = currentModeRef.current;
    if (targetView === previousView || switchContextRef.current) return;
    const targetMode = embodimentModeForView(targetView);
    if (!targetMode) {
      switchCoordinatorRef.current = null;
      switchContextRef.current = null;
      setActiveSwitch(null);
      setSwitchPhase("idle");
      setSwitchDetail("");
      setMode(targetView);
      return;
    }
    const revision = Math.max(switchRevisionRef.current + 1, Number.isSafeInteger(snap.tick) ? snap.tick : 0);
    switchRevisionRef.current = revision;
    switchExecutionCounterRef.current += 1;
    const executionId = `nk1.switch.${revision}.${switchExecutionCounterRef.current}`;
    const context = { executionId, revision };
    switchContextRef.current = context;
    setActiveSwitch(context);
    setSwitchDetail("");
    const snapshot = buildSemanticBodySnapshot(revision);
    const sourceMode = embodimentModeForView(currentModeRef.current);
    const events = (event: { phase: EmbodimentSwitchPhase; fromAdapterId: string; toAdapterId: string; revision: number; detail?: string }) => {
      setSwitchPhase(event.phase);
      setSwitchDetail(event.detail || "");
    };
    try {
      if (!sourceMode) {
        setSwitchPhase("preparing");
        setMode(targetView);
        const ready = await waitForRendererSignal("ready", adapterIdForMode(targetMode), executionId, new AbortController().signal);
        if (ready.kind !== "ready" || ready.stateRevision !== revision) throw new Error("renderer-ready-revision-mismatch");
        switchCoordinatorRef.current = new EmbodimentSwitchCoordinator(createEmbodimentAdapter(targetMode), events);
        setSwitchPhase("committed");
        setSwitchDetail("Initial renderer activated; subsequent body changes use transactional handoff. GPU presentation is not verified.");
      } else {
        if (!switchCoordinatorRef.current || switchCoordinatorRef.current.activeAdapterId !== adapterIdForMode(sourceMode)) {
          switchCoordinatorRef.current = new EmbodimentSwitchCoordinator(createEmbodimentAdapter(sourceMode), events);
        }
        const outcome = await switchCoordinatorRef.current.switchTo(createEmbodimentAdapter(targetMode), snapshot, new AbortController().signal);
        if (outcome.status === "committed") {
          setSwitchPhase("committed");
          setSwitchDetail("Renderer readback verified for the same semantic revision; presented GPU frame remains unverified.");
        } else if (outcome.status === "rolled-back") {
          setSwitchPhase("failed");
          setSwitchDetail("Target renderer rejected; source body restored: " + outcome.reason);
        } else if (outcome.status === "unchanged") {
          setSwitchPhase("idle");
        } else {
          setSwitchPhase("failed");
          setSwitchDetail(outcome.reason);
        }
      }
    } catch (error) {
      setSwitchPhase("failed");
      setSwitchDetail(error instanceof Error ? error.message : "body-switch-failed");
      if (currentModeRef.current !== previousView) setMode(previousView);
    } finally {
      switchContextRef.current = null;
      setActiveSwitch(null);
    }
  };
  const lastTurn = snap.chat[snap.chat.length - 1];
  const originalGazeByAction: Record<OrganismSnapshot["lastOption"], { x: number; y: number }> = {
    explore: { x: 0.24, y: 0.04 }, verify: { x: 0.14, y: -0.10 }, reflect: { x: -0.19, y: -0.14 },
    respond: { x: 0.01, y: 0.01 }, wait: { x: -0.035, y: -0.005 }, rest: { x: -0.06, y: 0.075 },
  };
  const originalGaze = originalGazeByAction[snap.lastOption] ?? originalGazeByAction.wait;
  const turnKey = lastTurn?.role === "kurisu" ? `${String(lastTurn.id ?? lastTurn.at)}:${String(lastTurn.at)}:${lastTurn.text}` : "";

  const stopSpeech = () => {
    const active = activeSpeechSessionRef.current;
    if (active) {
      active.lastAudioElapsedMs = Math.max(active.lastAudioElapsedMs, speechAudioClockNow(active, performance.now()));
      activeSpeechSessionRef.current = null;
      lastSpeechSessionRef.current = active;
      speechPhaseRef.current = "cancelled";
      recordSpeechLifecycle(active, "cancelled", performance.now());
    }
    try { window.speechSynthesis?.cancel(); } catch { /* browser may deny speech */ }
    utteranceRef.current = null;
    setMouthPose(CLOSED_MOUTH);
    setVoiceStatus(voiceEnabled ? "ready" : "off");
  };

  useEffect(() => connectNativeSpeechProviderEvents({
    url: neuroApiUrl("/api/organism/voice/events"),
    onEvent: setNativeSpeechProviderEvent,
    onConnection: setNativeSpeechConnection,
  }), []);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== frame.current?.contentWindow) return;
      if (!isRecord(ev.data) || typeof ev.data.type !== "string") return;
      if (ev.data.type === "live2d_ready") {
        if (typeof ev.data.profile !== "string" || ev.data.profile.length > 24 || typeof ev.data.modelPath !== "string" || typeof ev.data.modelId !== "string") return;
        const live2dIdentity = ev.data.profile === "mobile" && ev.data.modelPath === "./Kurisu.mobile/Kurisu-mobile.model3.json"
          ? "kurisu-live2d-mobile-v1"
          : (ev.data.profile === "balanced" || ev.data.profile === "quality") && ev.data.modelPath === "./Kurisu/Kurisu.model3.json"
            ? "kurisu-live2d-balanced-v1" : null;
        if (!live2dIdentity || ev.data.modelId !== live2dIdentity) return;
        live2dMotorModelIdRef.current = live2dIdentity;
        setLive2dMotorModelId(live2dIdentity);
        setLive2dMotorBatch(null);
        setLive2dMotorProjection("waiting");
        setLive2dMotorAck(null);
        setLive(true);
        const readyContext = switchContextRef.current;
        if (readyContext && currentModeRef.current === "live2d") {
          publishRendererSignal({ kind: "ready", adapterId: "nk1-live2d", executionId: readyContext.executionId,
            stateRevision: readyContext.revision, modelId: live2dIdentity });
        }
        // A remounted iframe may be a new viewer even if `live` was already true.
        // Bump a nonce so the latest intent is replayed only after that viewer is ready.
        setViewerReadyRevision((revision) => revision + 1);
      }
      if (ev.data.type === "live2d_intent_ack") {
        const version = ev.data.stateVersion;
        if (currentModeRef.current !== "live2d" || typeof version !== "number" || !Number.isSafeInteger(version) || version <= 0 || version !== latestIntentStateVersionRef.current) return;
        if (ev.data.appliedRevision !== version || ev.data.complete !== false) return;
        if (ev.data.status !== "parameters-observed" && ev.data.status !== "accepted-unverified") return;
        if (ev.data.visualCompletionVerified !== false) return;
        if (!isLive2DActionStatus(ev.data.expressionStatus) || !isLive2DActionStatus(ev.data.motionStatus)) return;
        // A partial ACK is never a renderer receipt; it confirms parameter readback only.
        const observed = isRecord(ev.data.observedParameters) ? ev.data.observedParameters : {};
        const observedCount = Object.values(observed).filter((value) => typeof value === "number" && Number.isFinite(value)).length;
        setIntentAck({ stateVersion: version, status: ev.data.status, observedCount, expressionStatus: ev.data.expressionStatus, motionStatus: ev.data.motionStatus });
      }
      if (ev.data.type === "live2d_switch_apply_receipt") {
        const receipt = ev.data;
        const context = switchContextRef.current;
        if (!context || receipt.adapterId !== "nk1-live2d" || receipt.executionId !== context.executionId
          || receipt.stateRevision !== context.revision || !Number.isFinite(receipt.appliedAtMonotonicMs)
          || !Array.isArray(receipt.acceptedChannels) || receipt.acceptedChannels.length === 0
          || receipt.acceptedChannels.length > 32
          || !receipt.acceptedChannels.every((x: unknown) => typeof x === "string" && x.length > 0 && x.length <= 96)
          || new Set(receipt.acceptedChannels).size !== receipt.acceptedChannels.length
          || !Array.isArray(receipt.rejectedChannels)
          || !receipt.rejectedChannels.every((x: unknown) => typeof x === "string" && x.length <= 96)
          || receipt.visualCompletionVerified !== false) return;
        publishRendererSignal({ kind: "apply", receipt: {
          adapterId: receipt.adapterId, executionId: receipt.executionId, stateRevision: receipt.stateRevision,
          appliedAtMonotonicMs: receipt.appliedAtMonotonicMs,
          acceptedChannels: receipt.acceptedChannels, rejectedChannels: receipt.rejectedChannels,
        } });
      }
      if (ev.data.type === "live2d_switch_verification") {
        const verification = ev.data;
        const context = switchContextRef.current;
        if (!context || verification.adapterId !== "nk1-live2d" || verification.executionId !== context.executionId
          || verification.stateRevision !== context.revision || typeof verification.verified !== "boolean"
          || !Number.isFinite(verification.observedAtMonotonicMs)
          || !Array.isArray(verification.observedChannels)
          || !verification.observedChannels.every((x: unknown) => typeof x === "string" && x.length > 0 && x.length <= 96)
          || !Array.isArray(verification.mismatches)
          || !verification.mismatches.every((x: unknown) => typeof x === "string" && x.length <= 96)
          || verification.visualCompletionVerified !== false) return;
        publishRendererSignal({ kind: "verify", verification: {
          adapterId: verification.adapterId, executionId: verification.executionId, stateRevision: verification.stateRevision,
          verified: verification.verified, observedAtMonotonicMs: verification.observedAtMonotonicMs,
          observedChannels: verification.observedChannels, mismatches: verification.mismatches,
          reason: typeof verification.reason === "string" ? verification.reason.slice(0, 160) : undefined,
        } });
      }
      if (ev.data.type === "live2d_motor_frame_ack") {
        const ack = ev.data;
        if (currentModeRef.current !== "live2d" || typeof ack.modelId !== "string" || ack.modelId !== live2dMotorModelIdRef.current
          || typeof ack.frameTick !== "number" || !Number.isSafeInteger(ack.frameTick) || ack.frameTick < 0
          || typeof ack.profileId !== "string" || ack.profileId.length > 96
          || typeof ack.observedCount !== "number" || !Number.isSafeInteger(ack.observedCount) || ack.observedCount < 0
          || typeof ack.commandCount !== "number" || !Number.isSafeInteger(ack.commandCount) || ack.commandCount < 1
          || ack.observedCount > ack.commandCount || typeof ack.readbackAvailable !== "boolean"
          || ack.visualCompletionVerified !== false) return;
        setLive2dMotorAck({ frameTick: ack.frameTick, observedCount: ack.observedCount,
          commandCount: ack.commandCount, readbackAvailable: ack.readbackAvailable });
      }
      if (ev.data.type === "live2d_error") {
        if (typeof ev.data.error !== "string" || ev.data.error.length > 512) return;
        setLive(false);
        live2dMotorModelIdRef.current = null;
        setLive2dMotorModelId(null);
        setLive2dMotorBatch(null);
        setLive2dMotorProjection("unmapped");
        setIntentAck(null);
        const context = switchContextRef.current;
        if (context && currentModeRef.current === "live2d") {
          publishRendererSignal({ kind: "failed", adapterId: "nk1-live2d", executionId: context.executionId,
            stateRevision: context.revision, reason: ev.data.error.slice(0, 240) });
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (mode !== "live2d") {
      latestIntentStateVersionRef.current = 0;
      setIntentAck(null);
      setLive2dMotorBatch(null);
      setLive2dMotorProjection("unmapped");
      setLive2dMotorConnection("unavailable");
      setLive2dMotorAck(null);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "live2d" || !live || !live2dMotorModelId) {
      setLive2dMotorConnection("unavailable");
      setLive2dMotorBatch(null);
      return;
    }
    setLive2dMotorConnection("connecting");
    return connectMotorFrameStream({
      url: neuroApiUrl("/api/organism/motor-frame/stream"),
      renderer: "live2d",
      modelId: live2dMotorModelId,
      onConnection: setLive2dMotorConnection,
      onProjection: (projection) => {
        setLive2dMotorProjection(projection.state);
        if (projection.state === "ready") setLive2dMotorBatch(projection.batch);
        else setLive2dMotorBatch(null);
      },
    });
  }, [mode, live, live2dMotorModelId]);

  useEffect(() => {
    // Each preference is best-effort: a blocked storage write must not prevent avatar/voice controls.
    writeAvatarPreference("kurisu-avatar-mode", mode);
    writeAvatarPreference("kurisu-avatar-voice-enabled", String(voiceEnabled));
    writeAvatarPreference("kurisu-avatar-voice-name", voiceName);
  }, [mode, voiceEnabled, voiceName]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) { setVoiceStatus("unsupported"); return; }
    const synth = window.speechSynthesis;
    const readVoices = () => {
      const available = synth.getVoices();
      voicesRef.current = available;
      setVoices(available);
      if (speechPhaseRef.current === "speaking") setVoiceStatus("speaking");
      else if (speechPhaseRef.current === "unknown") setVoiceStatus("unknown");
      else setVoiceStatus(voiceEnabled ? "ready" : "off");
    };
    readVoices();
    synth.addEventListener?.("voiceschanged", readVoices);

    // Observe only newly-created turns: existing history is never replayed on mount.
    if (!observedInitialTurn.current) {
      observedInitialTurn.current = true;
      lastObservedTurnKey.current = turnKey;
    } else if (turnKey && turnKey !== lastObservedTurnKey.current) {
      lastObservedTurnKey.current = turnKey;
      // A new turn supersedes any pending utterance before the replacement starts.
      if (activeSpeechSessionRef.current) stopSpeech();
      if (voiceEnabled && lastTurn?.text?.trim()) {
        const text = lastTurn.text;
        const utteranceEmotion = lastTurn.emotion ?? snap.emotion.label;
        const prosody = buildBrowserVoiceProsody({
          text,
          emotion: utteranceEmotion,
          action: snap.lastOption,
          arousal: snap.emotion.arousal,
          valence: snap.emotion.valence,
          cognitiveLoad: snap.needs.cognitiveLoad,
          uncertainty: snap.needs.uncertainty,
          socialNeed: snap.needs.socialNeed,
        });
        const language = prosody.language || inferSpeechLanguage(text);
        const rate = prosody.rate;
        const sequence = ++speechSequenceRef.current;
        const speechEventId = `avatar-speech-${Date.now().toString(36)}-${sequence.toString(36)}`;
        const session: BrowserSpeechSession = {
          speechEventId,
          audioClockId: `avatar-clock-${speechEventId}`,
          text,
          timeline: buildVisemeTimeline(text, rate, language),
          boundaryAnchors: [{ charIndex: 0, audioTimeMs: 0, timelineTimeMs: 0 }],
          lastAudioElapsedMs: 0,
          anchorAudioPerformanceAtMs: performance.now(),
          anchorAudioElapsedMs: 0,
          clockSource: "speech-synthesis-boundary-anchored-monotonic",
          voiceEmphasis: prosody.emphasis01,
          lifecycleSequence: 0,
          lastLifecycleEvent: null,
        };
        recordSpeechLifecycle(session, "queued", performance.now());
        activeSpeechSessionRef.current = session;
        lastSpeechSessionRef.current = session;
        speechPhaseRef.current = "starting";
        setMouthPose(sampleVisemeTimeline(session.timeline, 0));
        setVoiceStatus("ready");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = rate;
        utterance.pitch = prosody.pitch;
        utterance.volume = prosody.volume;
        const availableVoices = voicesRef.current;
        const selected = availableVoices.find((voice) => voice.name === voiceName) ?? availableVoices.find((voice) => voice.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2).toLowerCase())) ?? null;
        if (selected) utterance.voice = selected;
        utterance.onstart = () => {
          if (activeSpeechSessionRef.current !== session) return;
          const now = performance.now();
          session.boundaryAnchors = [{ charIndex: 0, audioTimeMs: 0, timelineTimeMs: 0 }];
          session.anchorAudioPerformanceAtMs = now;
          session.anchorAudioElapsedMs = 0;
          session.lastAudioElapsedMs = 0;
          session.clockSource = "speech-synthesis-boundary-anchored-monotonic";
          speechPhaseRef.current = "speaking";
          recordSpeechLifecycle(session, "started", now);
          setVoiceStatus("speaking");
          setMouthPose(sampleVisemeTimeline(session.timeline, 0));
        };
        utterance.onboundary = (event) => {
          if (activeSpeechSessionRef.current !== session || speechPhaseRef.current !== "speaking") return;
          const now = performance.now();
          const currentAudioMs = speechAudioClockNow(session, now);
          const rawCharIndex = Number(event.charIndex);
          if (!Number.isSafeInteger(rawCharIndex) || rawCharIndex < 0) return;
          const boundaryTimelineMs = timelineOffsetForCharIndex(session.timeline, rawCharIndex);
          // One audio clock drives both the published audio time and the viseme sampler.
          // Browser elapsedTime may lag our monotonic estimate; preserve the high-water mark,
          // but bind the current character to that time so future frames re-calibrate.
          const reportedElapsedMs = Number.isFinite(event.elapsedTime) && event.elapsedTime >= 0
            ? event.elapsedTime * 1000
            : currentAudioMs;
          const clockAnchor = reanchorMonotonicAudioClock(
            session.lastAudioElapsedMs, session.anchorAudioElapsedMs, session.anchorAudioPerformanceAtMs, now, reportedElapsedMs,
          );
          session.anchorAudioElapsedMs = clockAnchor.anchorElapsedMs;
          session.anchorAudioPerformanceAtMs = clockAnchor.anchorPerformanceAtMs;
          session.lastAudioElapsedMs = clockAnchor.highWaterMs;
          const boundaryAudioMs = session.lastAudioElapsedMs;
          recordSpeechLifecycle(session, "boundary", now, { charIndex: rawCharIndex });
          const nextAnchors = appendVisemeClockAnchor(session.boundaryAnchors, {
            charIndex: rawCharIndex, audioTimeMs: boundaryAudioMs, timelineTimeMs: boundaryTimelineMs,
          });
          if (nextAnchors !== session.boundaryAnchors) session.boundaryAnchors = nextAnchors;
          if (Number.isFinite(event.elapsedTime) && event.elapsedTime >= 0) session.clockSource = "speech-synthesis-elapsed-time-anchored-monotonic";
          setMouthPose(sampleVisemeTimeline(session.timeline, sampleVisemeClock(session.boundaryAnchors, boundaryAudioMs)));
        };
        utterance.onend = () => {
          if (activeSpeechSessionRef.current !== session) return;
          session.lastAudioElapsedMs = Math.max(session.lastAudioElapsedMs, speechAudioClockNow(session, performance.now()));
          activeSpeechSessionRef.current = null;
          lastSpeechSessionRef.current = session;
          speechPhaseRef.current = "ended";
          recordSpeechLifecycle(session, "ended", performance.now());
          utteranceRef.current = null;
          setVoiceStatus("ready");
          setMouthPose(CLOSED_MOUTH);
        };
        utterance.onerror = (event) => {
          if (activeSpeechSessionRef.current !== session) return;
          session.lastAudioElapsedMs = Math.max(session.lastAudioElapsedMs, speechAudioClockNow(session, performance.now()));
          activeSpeechSessionRef.current = null;
          lastSpeechSessionRef.current = session;
          speechPhaseRef.current = "unknown";
          recordSpeechLifecycle(session, "error", performance.now(), { errorCode: String(event.error || "unknown").slice(0, 64) });
          utteranceRef.current = null;
          setVoiceStatus("unknown");
          setMouthPose(CLOSED_MOUTH);
          console.warn("Kurisu browser speech outcome unknown", { speechEventId, error: event.error });
        };
        utteranceRef.current = utterance;
        try {
          synth.cancel();
          synth.speak(utterance);
        } catch (error) {
          activeSpeechSessionRef.current = null;
          lastSpeechSessionRef.current = session;
          speechPhaseRef.current = "unknown";
          recordSpeechLifecycle(session, "error", performance.now(), { errorCode: "start-failed" });
          utteranceRef.current = null;
          setVoiceStatus("unknown");
          setMouthPose(CLOSED_MOUTH);
          console.warn("Kurisu browser speech could not be started", { speechEventId, error });
        }
      }
    } else if (!turnKey) {
      lastObservedTurnKey.current = "";
    }
    if (!voiceEnabled && !activeSpeechSessionRef.current) setVoiceStatus("off");

    return () => {
      synth.removeEventListener?.("voiceschanged", readVoices);
      const active = activeSpeechSessionRef.current;
      if (active) {
        active.lastAudioElapsedMs = Math.max(active.lastAudioElapsedMs, speechAudioClockNow(active, performance.now()));
        activeSpeechSessionRef.current = null;
        lastSpeechSessionRef.current = active;
        speechPhaseRef.current = "cancelled";
        recordSpeechLifecycle(active, "cancelled", performance.now());
        try { synth.cancel(); } catch { /* no-op */ }
        setMouthPose(CLOSED_MOUTH);
        setVoiceStatus(voiceEnabled ? "ready" : "off");
      }
    };
    // turnKey is a stable identity for the newest assistant turn; snapshot values change every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, voiceEnabled, voiceName]);

  // Advance the grapheme-level viseme schedule from one boundary-anchored monotonic clock.
  // Rendering is capped to ~24 updates/second so the canvas receives useful timing without
  // forcing React to rerender for every display refresh.
  useEffect(() => {
    const session = activeSpeechSessionRef.current;
    if (!session || voiceStatus !== "speaking") return;
    let raf = 0;
    let lastUpdateAt = 0;
    const tick = (now: number) => {
      if (activeSpeechSessionRef.current !== session || speechPhaseRef.current !== "speaking") return;
      if (now - lastUpdateAt >= 40) {
        lastUpdateAt = now;
        const pose = sampleVisemeTimeline(session.timeline, speechTimelineNow(session, now));
        setMouthPose((current) => sameMouthPose(current, pose) ? current : pose);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [voiceStatus, turnKey, voiceEnabled, voiceName]);

  useEffect(() => {
    const win = frame.current?.contentWindow;
    if (!win || !live || mode !== "live2d") return;
    const expression = EXPR[snap.emotion.label] ?? "neutral";
    const gazeByAction: Record<OrganismSnapshot["lastOption"], { x: number; y: number }> = {
      explore: { x: 0.24, y: 0.04 }, verify: { x: 0.14, y: -0.10 }, reflect: { x: -0.19, y: -0.14 },
      respond: { x: 0.01, y: 0.01 }, wait: { x: -0.035, y: -0.005 }, rest: { x: -0.06, y: 0.075 },
    };
    const gaze = gazeByAction[snap.lastOption] ?? gazeByAction.wait;
    const valenceOffset = (snap.emotion.valence - 0.5) * 0.16;
    const activeSession = activeSpeechSessionRef.current;
    const session = activeSession ?? lastSpeechSessionRef.current;
    const activeUtterance = Boolean(activeSession && speechPhaseRef.current === "speaking" && voiceStatus === "speaking");
    const freshTextTurn = speechPhaseRef.current !== "cancelled" && speechPhaseRef.current !== "unknown" && lastTurn?.role === "kurisu" && Date.now() - Number(lastTurn.at || 0) < 5_000;
    const motorPlan = planAvatarMotorIntent({
      emotion: snap.emotion.label,
      valence: snap.emotion.valence,
      arousal: snap.emotion.arousal,
      action: snap.lastOption,
      thinking,
      speaking: activeUtterance,
      hasFreshTurn: freshTextTurn,
      turnText: lastTurn?.role === "kurisu" ? lastTurn.text : "",
      awake: snap.awake,
    });
    const bodyGestureActive = motorPlan.gesture;
    const motionGroup = motorPlan.motionGroup;
    const motionIndex = motorPlan.motionIndex;
    // Increment only when the semantic motor goal changes. Snapshot ticks and mouth frames
    // must not continually restart the same motion clip.
    const motionIdentity = freshTextTurn ? (session?.speechEventId ?? turnKey) : `state:${motorPlan.action}`;
    const motionSignature = `${motorPlan.action}:${motionGroup}:${motionIndex}:${motionIdentity}`;
    if (motionIntentKeyRef.current !== motionSignature) {
      motionIntentKeyRef.current = motionSignature;
      motionIntentTokenRef.current += 1;
    }
    const motionToken = motionIntentTokenRef.current;
    const audioTimeMs = activeSession
      ? speechAudioClockNow(activeSession, performance.now())
      : Math.max(0, Number(session?.lastAudioElapsedMs ?? 0));
    const intent: EmbodimentIntentV1 = {
      type: "kurisu_embodiment_intent",
      protocolVersion: 1,
      stateVersion: ++intentStateVersionRef.current,
      sentAtEpochMs: Date.now(),
      speechEventId: session?.speechEventId ?? null,
      audioClockId: session?.audioClockId ?? null,
      speechPhase: speechPhaseRef.current,
      audioTimeMs,
      clockSource: session?.clockSource ?? "none",
      priority: speechPhaseRef.current === "cancelled" ? 100 : activeUtterance ? 70 : thinking ? 45 : 30,
      cancellationToken: session ? `cancel:${session.speechEventId}` : null,
      expression,
      expressionIntensity: snap.emotion.arousal,
      mouth: activeUtterance ? mouthPose : CLOSED_MOUTH,
      gaze: { x: Math.max(-0.4, Math.min(0.4, gaze.x + valenceOffset)), y: gaze.y, driven: true },
      body: {
        headTilt: motorPlan.headTilt,
        gesture: bodyGestureActive,
        motionGroup,
        motionIndex: motionGroup === "Special" ? motionIndex : 0,
        motionToken: Number.isSafeInteger(motionToken) && motionToken > 0 ? motionToken : 0,
      },
      voiceEmphasis: activeUtterance ? (session?.voiceEmphasis ?? 0) : 0,
    };
    latestIntentStateVersionRef.current = intent.stateVersion;
    win.postMessage({ ...intent, motorFrameBatch: live2dMotorBatch, switchExecutionId: activeSwitch?.executionId ?? null, switchStateRevision: activeSwitch?.revision ?? null }, window.location.origin);
  }, [snap.emotion, snap.lastOption, snap.chat, snap.tick, snap.awake, thinking, live, viewerReadyRevision, mode, voiceStatus, mouthPose, turnKey, live2dMotorBatch, activeSwitch?.executionId, activeSwitch?.revision]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-elevated">
      <div className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1 rounded-md border border-border bg-black/60 p-1 backdrop-blur">
        <button type="button" onClick={() => void requestViewMode("live2d")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "live2d" ? "bg-accent text-accent-fg" : "text-white/70")}>Live2D</button>
        <button type="button" onClick={() => void requestViewMode("legacy")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "legacy" ? "bg-accent text-accent-fg" : "text-white/70")}>Legacy</button>
        <button type="button" onClick={() => void requestViewMode("original")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "original" ? "bg-accent text-accent-fg" : "text-white/70")}>NK1 Original</button>
        <button type="button" onClick={() => void requestViewMode("2.5d")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "2.5d" ? "bg-accent text-accent-fg" : "text-white/70")}>2.5D</button>
        <button type="button" onClick={() => void requestViewMode("3d")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "3d" ? "bg-accent text-accent-fg" : "text-white/70")}>3D</button>
        <button type="button" aria-pressed={voiceEnabled} onClick={() => { if (voiceEnabled) stopSpeech(); setVoiceEnabled((value) => !value); }} disabled={voiceStatus === "unsupported"} className={cn("rounded px-2 py-1 text-[10px] font-mono", voiceEnabled ? "bg-accent text-accent-fg" : "text-white/70")}>{voiceEnabled ? "Голос: вкл." : "Голос: выкл."}</button>
        {voiceEnabled && voices.length > 0 ? <select aria-label="Голос Курису" value={voiceName} onChange={(event) => { stopSpeech(); setVoiceName(event.target.value); }} className="max-w-32 rounded bg-black/70 px-1 py-1 text-[10px] text-white"><option value="">Авто</option>{voices.map((voice) => <option key={`${voice.name}:${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}</select> : null}
      </div>
      {switchPhase !== "idle" || switchDetail ? <div className="absolute bottom-2 left-2 z-30 max-w-[80%] rounded border border-border bg-black/70 px-2 py-1 text-[9px] text-white/80">{switchPhase}{switchDetail ? " · " + switchDetail : ""}</div> : null}
      {mode === "legacy" ? <LegacySpriteDeck emotion={snap.emotion.label} action={snap.lastOption} thinking={thinking} speaking={voiceStatus === "speaking" || thinking || (lastTurn?.role === "kurisu" && Date.now() - Number(lastTurn.at || 0) < 5_000)} /> : mode === "original" ? <KurisuOriginalStage emotion={snap.emotion.label} action={snap.lastOption} arousal={snap.emotion.arousal} gazeX={originalGaze.x} gazeY={originalGaze.y} speaking={voiceStatus === "speaking"} mouthPose={mouthPose} thinking={thinking} /> : (mode === "3d" || mode === "2.5d") ? <Avatar3DStage bodyMode={mode} switchExecutionId={activeSwitch?.executionId ?? null} switchStateRevision={activeSwitch?.revision} onRendererSignal={publishRendererSignal} revision={snap.tick} emotion={snap.emotion.label} action={snap.lastOption} arousal={snap.emotion.arousal} valence={snap.emotion.valence} dominance={snap.emotion.dominance} energy={snap.needs.energy} cognitiveLoad={snap.needs.cognitiveLoad} uncertainty={snap.needs.uncertainty} socialNeed={snap.needs.socialNeed} novelty={snap.needs.novelty} goalPressure={snap.needs.goalPressure} curiosity={snap.curiosity} predictionError={snap.predictionError} traits={snap.identity.traits} gazeX={originalGaze.x} gazeY={originalGaze.y} speaking={voiceStatus === "speaking"} mouthPose={mouthPose} thinking={thinking} awake={snap.awake} /> : <>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-ember)_18%,transparent),transparent_62%)]" />
        <iframe ref={frame} title="Kurisu Live2D" src="/live2d/viewer.html?profile=auto" className={cn("relative z-10 h-[320px] w-full border-0 transition-opacity duration-300 md:h-[420px]", live ? "opacity-100" : "opacity-0")} allow="autoplay" />
        {!live ? <div className="absolute inset-0 z-[11] flex items-center justify-center p-6"><div className="max-w-sm rounded-xl border border-border bg-bg/85 p-4 text-center backdrop-blur"><p className="text-xs font-medium uppercase tracking-wider text-subtle">Live2D unavailable</p><p className="mt-1 text-sm text-fg">Переключитесь на Legacy — там используются реальные legacy sprite-ассеты.</p><button type="button" onClick={() => void requestViewMode("legacy")} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:bg-elevated">Open Legacy</button></div></div> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4">
          <div><p className="font-display text-lg tracking-tight text-fg">Kurisu</p><p className="text-xs text-muted tabular-nums">{snap.awake ? "awake" : "sleep"} · {snap.emotion.label} · t{snap.tick}</p><p className="text-[10px] text-muted">{voiceStatus === "unsupported" ? "голос недоступен в этом браузере" : voiceStatus === "unknown" ? "исход воспроизведения неизвестен" : voiceStatus === "speaking" ? "говорит · виземы привязаны к временной шкале речи" : voiceEnabled ? "голос включён · речь запускается для новых реплик" : "голос выключен"}</p><p className="text-[10px] text-muted">Termux provider: {nativeSpeechConnection === "connected" ? "подключён" : nativeSpeechConnection === "reconnecting" ? "переподключение" : nativeSpeechConnection === "closed" ? "отключён" : "подключение"}</p>
          <p className="text-[9px] text-muted">MotorFrame · {live2dMotorProjection} / {live2dMotorConnection}{live2dMotorAck ? ` · tick ${live2dMotorAck.frameTick} · readback ${live2dMotorAck.observedCount}/${live2dMotorAck.commandCount}` : ""}</p>{nativeSpeechProviderEvent ? <p className="max-w-[min(75vw,420px)] text-[10px] text-muted">{describeNativeSpeechProviderStatus(nativeSpeechProviderEvent)}</p> : null}{intentAck ? <p className="text-[9px] text-muted tabular-nums">intent #{intentAck.stateVersion} · {intentAck.status === "parameters-observed" ? `параметры: ${intentAck.observedCount}/6` : "принятие без readback"} · expr:{intentAck.expressionStatus} · motion:{intentAck.motionStatus} · partial</p> : null}</div>
          <span className="rounded-full border border-border bg-bg/70 px-2.5 py-1 text-xs uppercase tracking-wider text-muted">{live ? "live2d" : "live2d unavailable"}</span>
        </div>
      </>}
    </div>
  );
}
