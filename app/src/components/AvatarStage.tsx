import { useCallback, useEffect, useRef, useState } from "react";
import type { EmotionLabel, OrganismSnapshot } from "@/organism/types";
import { neuroApiUrl } from "@/neuro-kurisu/api";
import {
  connectNativeSpeechProviderEvents,
  describeNativeSpeechProviderStatus,
  type NativeSpeechProviderConnection,
  type NativeSpeechProviderEvent,
} from "./avatar/nativeSpeechProviderEvents";
import { buildBrowserVoiceProsody, resolveBrowserVoiceAffect } from "./avatar/browserVoiceProsody";
import {
  advanceBodySwitchFromStart,
  beginBodySwitch,
  projectSemanticBodyState,
} from "./avatar/embodimentUiBridge";
import {
  arbitrateMotion,
  defaultMotionArbitrationState,
  type MotionArbitrationState,
  type MotionIntent,
} from "./avatar/motionArbitration";
import { resolveSemanticGestureIntent } from "./avatar/semanticGestureIntent";
import type { BodyChannel, SwitchPlan } from "./avatar/embodimentSwitch";
import { createAvatarArticulatedBodyState, stepAvatarArticulatedBody } from "./avatar/articulatedBodyParticles";
import { buildAvatarRenderProjection } from "./avatar/avatarRenderProjection.ts";
import { avatarRendererPresentation } from "./avatar/avatarRendererPresentation.ts";
import { createAvatarPresentationReceipt, describeAvatarFrameStatus, isCurrentAvatarPresentationReceipt, type AvatarPresentationReceiptV1 } from "./avatar/avatarPresentationReceipt.ts";
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
  type Live2DBodyChannel,
  type MouthPose,
  type SpeechPhase,
  type VisemeFrame,
  createSpeechLifecycleEventV1,
  acceptsSpeechLifecycleEventV1,
  type SpeechLifecycleEventV1,
  type SpeechLifecyclePhaseV1,
} from "./avatar/embodimentTimeline";

type ViewMode = "live2d" | "legacy" | "original" | "3d";
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
  const [presentationReceipt, setPresentationReceipt] = useState<AvatarPresentationReceiptV1 | null>(null);
  const motionIntentKeyRef = useRef("");
  const motionIntentTokenRef = useRef(0);
  const activeSpeechSessionRef = useRef<BrowserSpeechSession | null>(null);
  const lastSpeechSessionRef = useRef<BrowserSpeechSession | null>(null);
  const speechPhaseRef = useRef<SpeechPhase>("idle");
  const [live, setLive] = useState(false);
  const [viewerReadyRevision, setViewerReadyRevision] = useState(0);
  // First render must be identical on the server and in the browser. Browser-only
  // preferences are restored after hydration, never inside a useState initializer.
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<"off" | "ready" | "unsupported" | "speaking" | "unknown">("off");
  const [mouthPose, setMouthPose] = useState<MouthPose>(CLOSED_MOUTH);
  const [nativeSpeechProviderEvent, setNativeSpeechProviderEvent] = useState<NativeSpeechProviderEvent | null>(null);
  const [nativeSpeechConnection, setNativeSpeechConnection] = useState<NativeSpeechProviderConnection>("connecting");
  const [mode, setMode] = useState<ViewMode>("live2d");
  const live2dPresentation = avatarRendererPresentation("live2d");
  const legacyPresentation = avatarRendererPresentation("legacy");
  const originalPresentation = avatarRendererPresentation("original");
  const threeDPresentation = avatarRendererPresentation("3d");
  const activeModePresentation = avatarRendererPresentation(mode);
  const currentPresentationReceipt = isCurrentAvatarPresentationReceipt(presentationReceipt, mode, snap.tick) ? presentationReceipt : null;
  const presentationStatus = describeAvatarFrameStatus(mode, snap.tick, currentPresentationReceipt);
  // Aspect 11: the last planned renderer handoff, kept for truthful UI reporting.
  const [bodySwitch, setBodySwitch] = useState<{ from: ViewMode; to: ViewMode; plan: SwitchPlan } | null>(null);
  const [switchOpacity, setSwitchOpacity] = useState(1);
  const previousModeRef = useRef<ViewMode>(mode);
  const bodyRevisionRef = useRef(0);
  // Aspect 11 / motor: continuous renderer-neutral motion arbiter. It advances on a
  // rAF loop and only feeds the handoff snapshot; it never drives a renderer directly.
  const motionStateRef = useRef<MotionArbitrationState>(defaultMotionArbitrationState());
  const articulatedBodyRef = useRef(createAvatarArticulatedBodyState());
  const motionChannelsRef = useRef<Partial<Record<BodyChannel, number>>>({});
  const latestMotionIntentRef = useRef<MotionIntent | null>(null);
  const latestGestureRef = useRef<{ programId: NonNullable<MotionIntent["gestureProgram"]>; expiresAtEpochMs: number } | null>(null);
  const [motionChannels, setMotionChannels] = useState<Partial<Record<BodyChannel, number>>>({});
  // Latest-value refs so the mode-change effect can stay independent of per-tick churn.
  const latestSnapRef = useRef(snap);
  const mouthPoseRef = useRef(mouthPose);
  const latestProjectionRef = useRef<ReturnType<typeof buildAvatarRenderProjection> | null>(null);
  const recordPresentationReceipt = useCallback((receipt: AvatarPresentationReceiptV1) => {
    if (receipt.tick !== latestSnapRef.current.tick) return;
    setPresentationReceipt(receipt);
  }, []);
  const lastTurn = snap.chat[snap.chat.length - 1];
  const turnKey = lastTurn?.role === "kurisu" ? `${String(lastTurn.id ?? lastTurn.at)}:${String(lastTurn.at)}:${lastTurn.text}` : "";
  const activeProjectionSession = activeSpeechSessionRef.current;
  const projectionSession = activeProjectionSession ?? lastSpeechSessionRef.current;
  const activeBrowserUtterance = Boolean(activeProjectionSession && speechPhaseRef.current === "speaking" && voiceStatus === "speaking");
  const turnAgeMs = lastTurn?.role === "kurisu" ? Date.now() - Number(lastTurn.at ?? 0) : Number.POSITIVE_INFINITY;
  const hasFreshTurn = speechPhaseRef.current !== "cancelled" && speechPhaseRef.current !== "unknown"
    && Number.isFinite(turnAgeMs) && turnAgeMs >= 0 && turnAgeMs <= 5_000;
  const projection = buildAvatarRenderProjection({
    snapshot: snap,
    thinking,
    speaking: activeBrowserUtterance,
    hasFreshTurn,
    turnText: lastTurn?.role === "kurisu" ? lastTurn.text : "",
    speechPhase: speechPhaseRef.current,
    speechEventId: projectionSession?.speechEventId ?? null,
    audioClockId: projectionSession?.audioClockId ?? null,
    audioTimeMs: Math.max(0, Number(projectionSession?.lastAudioElapsedMs ?? 0)),
    clockSource: projectionSession?.clockSource ?? "none",
    mouthPose,
    voiceEmphasis: activeBrowserUtterance ? Number(projectionSession?.voiceEmphasis ?? 0) : 0,
  });
  latestProjectionRef.current = projection;
  latestSnapRef.current = snap;

  useEffect(() => {
    // A receipt belongs to one renderer instance and one organism tick only.
    // Switching mode or advancing/restoring the canonical tick requires a new receipt.
    setPresentationReceipt(null);
  }, [mode, snap.tick]);

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
        if (typeof ev.data.profile !== "string" || ev.data.profile.length > 24) return;
        setLive(true);
        // A remounted iframe may be a new viewer even if `live` was already true.
        // Bump a nonce so the latest intent is replayed only after that viewer is ready.
        setViewerReadyRevision((revision) => revision + 1);
      }
      if (ev.data.type === "live2d_intent_ack") {
        const version = ev.data.stateVersion;
        if (typeof version !== "number" || !Number.isSafeInteger(version) || version <= 0 || version !== latestIntentStateVersionRef.current) return;
        if (ev.data.appliedRevision !== version || ev.data.complete !== false) return;
        if (ev.data.status !== "parameters-observed" && ev.data.status !== "accepted-unverified") return;
        if (ev.data.visualCompletionVerified !== false) return;
        if (!isLive2DActionStatus(ev.data.expressionStatus) || !isLive2DActionStatus(ev.data.motionStatus)) return;
        // A partial ACK is never a renderer receipt; it confirms parameter readback only.
        const observed = isRecord(ev.data.observedParameters) ? ev.data.observedParameters : {};
        const observedCount = Object.values(observed).filter((value) => typeof value === "number" && Number.isFinite(value)).length;
        setIntentAck({ stateVersion: version, status: ev.data.status, observedCount, expressionStatus: ev.data.expressionStatus, motionStatus: ev.data.motionStatus });
        const receiptStage = ev.data.status === "parameters-observed" ? "parameters-observed" : "accepted-unverified";
        const frameTick = ev.data.frameTick;
        if (typeof frameTick === "number" && Number.isSafeInteger(frameTick) && frameTick >= 0) {
          const frameReceipt = createAvatarPresentationReceipt("live2d", frameTick, receiptStage);
          if (frameReceipt && frameReceipt.tick === latestProjectionRef.current?.tick) setPresentationReceipt(frameReceipt);
        }
      }
      if (ev.data.type === "live2d_error") {
        if (typeof ev.data.error !== "string" || ev.data.error.length > 512) return;
        setLive(false);
        setIntentAck(null);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    const savedMode = readAvatarPreference("kurisu-avatar-mode");
    if (savedMode === "legacy" || savedMode === "original" || savedMode === "3d") setMode(savedMode);
    setVoiceEnabled(readAvatarPreference("kurisu-avatar-voice-enabled") === "true");
    setVoiceName(readAvatarPreference("kurisu-avatar-voice-name") ?? "");
    setVoiceStatus("speechSynthesis" in window ? "off" : "unsupported");
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    // Each preference is best-effort: a blocked storage write must not prevent avatar/voice controls.
    writeAvatarPreference("kurisu-avatar-mode", mode);
    writeAvatarPreference("kurisu-avatar-voice-enabled", String(voiceEnabled));
    writeAvatarPreference("kurisu-avatar-voice-name", voiceName);
  }, [mode, voiceEnabled, voiceName, preferencesLoaded]);

  useEffect(() => { latestSnapRef.current = snap; mouthPoseRef.current = mouthPose; }, [snap, mouthPose]);

  // Publish only the latest canonical intent here. One shared 30-Hz clock below
  // advances the sole motion arbiter and feeds every renderer from the same pose.
  useEffect(() => {
    const assistantTurnAgeMs = lastTurn?.role === "kurisu"
      ? Date.now() - Number(lastTurn.at ?? 0)
      : Number.POSITIVE_INFINITY;
    const semanticGesture = Number.isFinite(assistantTurnAgeMs)
      && assistantTurnAgeMs >= 0 && assistantTurnAgeMs <= 5_000
      ? resolveSemanticGestureIntent(lastTurn?.role === "kurisu" ? lastTurn.text : "")
      : null;
    latestGestureRef.current = semanticGesture
      ? { programId: semanticGesture.programId, expiresAtEpochMs: Date.now() + Math.max(0, 5_000 - assistantTurnAgeMs) }
      : null;
    latestMotionIntentRef.current = {
      action: snap.lastOption,
      emotion: snap.emotion.label,
      speaking: voiceStatus === "speaking",
      thinking,
      awake: snap.awake,
      energy01: snap.needs.energy,
      semanticAction: projection.motorPlan.action,
      character: projection.character,
    };
  }, [snap, thinking, voiceStatus, projection.motorPlan.action]);

  useEffect(() => {
    let raf = 0;
    let lastStepAt = performance.now();
    let active = true;
    const frame = (now: number) => {
      if (!active) return;
      const deltaMs = now - lastStepAt;
      if (deltaMs >= 33) {
        lastStepAt = now;
        const intent = latestMotionIntentRef.current;
        if (intent) {
          const gesture = latestGestureRef.current;
          const currentIntent: MotionIntent = {
            ...intent,
            gestureProgram: gesture && Date.now() <= gesture.expiresAtEpochMs ? gesture.programId : undefined,
          };
          try {
            const result = arbitrateMotion(motionStateRef.current, currentIntent, deltaMs);
            motionStateRef.current = result.state;
            // Brain projection and semantic motion are merged before physical articulation.
            const bodyTargets = {
              ...result.channels,
              ...(latestProjectionRef.current?.bodyChannels ?? {}),
            } as Partial<Record<BodyChannel, number>>;
            const particleStep = stepAvatarArticulatedBody(
              articulatedBodyRef.current,
              bodyTargets,
              deltaMs,
              {
                awake: currentIntent.awake,
                energy01: currentIntent.energy01,
                reducedMotion: currentIntent.character?.reducedMotion === true,
              },
            );
            articulatedBodyRef.current = particleStep.state;
            const next = particleStep.channels;
            const previous = motionChannelsRef.current;
            const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
            const changed = [...keys].some((key) => {
              const channel = key as BodyChannel;
              return Math.abs((previous[channel] ?? 0) - (next[channel] ?? 0)) > 0.001;
            });
            if (changed) {
              motionChannelsRef.current = next;
              setMotionChannels(next);
            }
          } catch {
            // Keep the last verified pose if a malformed frame reaches the arbiter.
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Aspect 11: plan a renderer handoff whenever the bodySwitch changes. The projection is
  // monotonic and derived from the canonical snapshot; it never mutates organism state.
  // Only channels the destination declares are applied, and the crossfade is bounded.
  //
  // This effect depends on `mode` alone: the snapshot changes every tick, so binding the
  // crossfade to it would cancel and restart the animation each frame. Latest values are
  // read from refs instead.
  useEffect(() => {
    const from = previousModeRef.current;
    if (from === mode) return;
    previousModeRef.current = mode;
    const revision = ++bodyRevisionRef.current;
    const currentSnap = latestSnapRef.current;
    const currentProjection = latestProjectionRef.current;
    if (!currentProjection) return;
    let plan: SwitchPlan;
    try {
      const state = projectSemanticBodyState({
        snapshot: currentSnap,
        revision,
        monotonicMs: performance.now(),
        headTilt: currentProjection.motorPlan.headTilt,
        gaze: currentProjection.gaze,
        speechPhase: currentProjection.speech.phase,
        speechEventId: currentProjection.speech.speechEventId,
        audioTimeMs: currentProjection.speech.audioTimeMs,
        mouth: currentProjection.mouthPose,
        pose: motionChannelsRef.current,
      });
      plan = beginBodySwitch(from, mode, state).plan;
    } catch {
      // A rejected projection must not leave a half-applied handoff on screen.
      setBodySwitch(null);
      setSwitchOpacity(1);
      return;
    }
    setBodySwitch({ from, to: mode, plan });
    const durationMs = 220;
    let progress = { progress: 0, committed: false };
    const startAt = performance.now();
    setSwitchOpacity(0.35);
    let raf = requestAnimationFrame(function tick(now: number) {
      progress = advanceBodySwitchFromStart(progress, startAt, now, durationMs);
      setSwitchOpacity(0.35 + 0.65 * progress.progress);
      if (!progress.committed) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
        const voiceAffect = resolveBrowserVoiceAffect(snap.emotion);
        const prosody = buildBrowserVoiceProsody({
          text,
          emotion: voiceAffect.emotion,
          action: snap.lastOption,
          arousal: voiceAffect.arousal,
          valence: voiceAffect.valence,
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
    const currentProjection = latestProjectionRef.current;
    if (!win || !live || mode !== "live2d" || !currentProjection) return;
    const motorPlan = currentProjection.motorPlan;
    const motionGroup = motorPlan.motionGroup;
    const motionIndex = motorPlan.motionIndex;
    // Increment only when the canonical motor goal changes. Snapshot and mouth frames
    // must not continually restart the same Live2D motion.
    const motionIdentity = currentProjection.hasFreshTurn
      ? (currentProjection.speech.speechEventId ?? turnKey)
      : `state:${motorPlan.action}`;
    const motionSignature = `${motorPlan.action}:${motionGroup}:${motionIndex}:${motionIdentity}`;
    if (motionIntentKeyRef.current !== motionSignature) {
      motionIntentKeyRef.current = motionSignature;
      motionIntentTokenRef.current += 1;
    }
    const motionToken = motionIntentTokenRef.current;
    const mergedBodyChannels = { ...currentProjection.bodyChannels, ...motionChannels };
    const live2dBodyChannels: Partial<Record<Live2DBodyChannel, number>> = {};
    for (const channel of ["headYaw", "headPitch", "headRoll", "torsoYaw", "torsoPitch", "gazeX", "gazeY", "breath"] as const) {
      const value = mergedBodyChannels[channel];
      if (typeof value === "number" && Number.isFinite(value)) {
        live2dBodyChannels[channel] = Math.max(-1, Math.min(1, value));
      }
    }
    const intent: EmbodimentIntentV1 = {
      type: "kurisu_embodiment_intent",
      protocolVersion: 1,
      stateVersion: ++intentStateVersionRef.current,
      frameTick: currentProjection.tick,
      sentAtEpochMs: Date.now(),
      speechEventId: currentProjection.speech.speechEventId,
      audioClockId: currentProjection.speech.audioClockId,
      speechPhase: currentProjection.speech.phase,
      audioTimeMs: currentProjection.speech.audioTimeMs,
      clockSource: currentProjection.speech.clockSource,
      priority: currentProjection.speech.phase === "cancelled" ? 100 : currentProjection.speaking ? 70 : thinking ? 45 : 30,
      cancellationToken: currentProjection.speech.speechEventId
        ? `cancel:${currentProjection.speech.speechEventId}`
        : null,
      expression: currentProjection.expression,
      expressionIntensity: currentProjection.expressionIntensity,
      mouth: currentProjection.mouthPose,
      gaze: { ...currentProjection.gaze, driven: true },
      body: {
        headTilt: motorPlan.headTilt,
        gesture: motorPlan.gesture,
        motionGroup,
        motionIndex: motionGroup === "Special" ? motionIndex : 0,
        motionToken: Number.isSafeInteger(motionToken) && motionToken > 0 ? motionToken : 0,
        channels: live2dBodyChannels,
      },
      voiceEmphasis: currentProjection.voiceEmphasis,
    };
    latestIntentStateVersionRef.current = intent.stateVersion;
    setPresentationReceipt((current) => current?.renderer === "live2d" ? null : current);
    win.postMessage(intent, window.location.origin);
  }, [snap, thinking, live, viewerReadyRevision, mode, voiceStatus, mouthPose, turnKey, motionChannels]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-elevated">
      <div role="toolbar" aria-label="Управление аватаром" className="relative z-30 flex w-full flex-wrap items-center gap-2 border-b border-border bg-black/70 p-2 backdrop-blur">
        <div role="group" aria-label="Режим отображения персонажа" className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label={live2dPresentation.ariaLabel} title={live2dPresentation.title} aria-pressed={mode === "live2d"} onClick={() => setMode("live2d")} className={cn("min-h-11 rounded px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", mode === "live2d" ? "bg-accent text-accent-fg" : "text-white/80")}>Live2D</button>
          <button type="button" aria-label={legacyPresentation.ariaLabel} title={legacyPresentation.title} aria-pressed={mode === "legacy"} onClick={() => setMode("legacy")} className={cn("min-h-11 rounded px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", mode === "legacy" ? "bg-accent text-accent-fg" : "text-white/80")}>Legacy</button>
          <button type="button" aria-label={originalPresentation.ariaLabel} title={originalPresentation.title} aria-pressed={mode === "original"} onClick={() => setMode("original")} className={cn("min-h-11 rounded px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", mode === "original" ? "bg-accent text-accent-fg" : "text-white/80")}>NK1 Original</button>
          <button type="button" aria-label={threeDPresentation.ariaLabel} title={threeDPresentation.title} aria-pressed={mode === "3d"} onClick={() => setMode("3d")} className={cn("min-h-11 rounded px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", mode === "3d" ? "bg-accent text-accent-fg" : "text-white/80")}>3D · предпросмотр</button>
        </div>
        <div role="status" aria-live="polite" aria-label="Тип выбранного тела и подтверждение кадра" className="basis-full space-y-0.5 px-2 text-[10px] leading-4 text-white/70 md:basis-full md:ml-1">
          <span className="block">{activeModePresentation.description}</span>
          <span className="block text-white/55 tabular-nums">{presentationStatus}</span>
        </div>
        <button type="button" aria-label="Включить или выключить голос Курису" aria-pressed={voiceEnabled} onClick={() => { if (voiceEnabled) stopSpeech(); setVoiceEnabled((value) => !value); }} disabled={voiceStatus === "unsupported"} className={cn("min-h-11 rounded px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", voiceEnabled ? "bg-accent text-accent-fg" : "text-white/80")}>{voiceEnabled ? "Голос: вкл." : "Голос: выкл."}</button>
        {voiceEnabled && voices.length > 0 ? <select aria-label="Голос Курису" value={voiceName} onChange={(event) => { stopSpeech(); setVoiceName(event.target.value); }} className="min-h-11 max-w-40 rounded bg-black/70 px-3 py-2 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="">Авто</option>{voices.map((voice) => <option key={`${voice.name}:${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}</select> : null}
      </div>
      <div className="transition-opacity duration-200 ease-out" style={{ opacity: switchOpacity }}>
      {mode === "legacy" ? <LegacySpriteDeck emotion={snap.emotion.label} action={snap.lastOption} thinking={thinking} speaking={projection.speaking || thinking || projection.hasFreshTurn} /> : mode === "original" ? <KurisuOriginalStage
          emotion={snap.emotion.label}
          action={snap.lastOption}
          valence={snap.emotion.valence}
          arousal={snap.emotion.arousal}
          gazeX={projection.gaze.x}
          gazeY={projection.gaze.y}
          speaking={projection.speaking}
          mouthPose={projection.mouthPose}
          thinking={thinking}
          motorPlan={projection.motorPlan}
          motorSignals={{
            energy: snap.needs.energy,
            cognitiveLoad: snap.needs.cognitiveLoad,
          }}
          bodyChannels={{ ...projection.bodyChannels, ...motionChannels }}
          avatarBrainChannels={projection.brainChannels ?? undefined}
          frameTick={snap.tick}
          onFrameReceipt={recordPresentationReceipt}
        /> : mode === "3d" ? <Avatar3DStage emotion={snap.emotion.label} action={snap.lastOption} motorPlan={projection.motorPlan} arousal={snap.emotion.arousal} valence={snap.emotion.valence} dominance={snap.emotion.dominance} energy={snap.needs.energy} cognitiveLoad={snap.needs.cognitiveLoad} uncertainty={snap.needs.uncertainty} socialNeed={snap.needs.socialNeed} novelty={snap.needs.novelty} goalPressure={snap.needs.goalPressure} curiosity={snap.curiosity} predictionError={snap.predictionError} traits={snap.identity.traits} gazeX={projection.gaze.x} gazeY={projection.gaze.y} speaking={projection.speaking} mouthPose={projection.mouthPose} thinking={thinking} awake={snap.awake} bodyChannels={{ ...projection.bodyChannels, ...motionChannels }} avatarBrainFrame={projection.brainFrame ?? undefined} frameTick={snap.tick} onFrameReceipt={recordPresentationReceipt} onReturnTo2D={() => setMode("live2d")} /> : <>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-ember)_18%,transparent),transparent_62%)]" />
        <iframe ref={frame} title="Kurisu Live2D" src="/live2d/viewer.html?profile=auto" className={cn("relative z-10 h-[320px] w-full border-0 transition-opacity duration-300 md:h-[420px]", live ? "opacity-100" : "opacity-0")} allow="autoplay" />
        {!live ? <div className="absolute inset-0 z-[11] flex items-center justify-center p-6"><div className="max-w-sm rounded-xl border border-border bg-bg/85 p-4 text-center backdrop-blur"><p className="text-xs font-medium uppercase tracking-wider text-subtle">Модель Live2D недоступна</p><p className="mt-1 text-sm text-fg">Переключитесь на Legacy — там используются реальные legacy sprite-ассеты.</p><button type="button" onClick={() => setMode("legacy")} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:bg-elevated">Открыть Legacy</button></div></div> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4">
          <div><p className="font-display text-lg tracking-tight text-fg">Kurisu</p><p className="text-xs text-muted tabular-nums">{snap.awake ? "Бодрствует" : "Спит"} · {snap.emotion.label} · t{snap.tick}</p><p className="text-[10px] text-muted">{voiceStatus === "unsupported" ? "голос недоступен в этом браузере" : voiceStatus === "unknown" ? "исход воспроизведения неизвестен" : voiceStatus === "speaking" ? "говорит · виземы привязаны к временной шкале речи" : voiceEnabled ? "голос включён · речь запускается для новых реплик" : "голос выключен"}</p><p className="text-[10px] text-muted">Провайдер речи Termux: {nativeSpeechConnection === "connected" ? "подключён" : nativeSpeechConnection === "reconnecting" ? "переподключение" : nativeSpeechConnection === "closed" ? "отключён" : "подключение"}</p>{nativeSpeechProviderEvent ? <p className="max-w-[min(75vw,420px)] text-[10px] text-muted">{describeNativeSpeechProviderStatus(nativeSpeechProviderEvent)}</p> : null}{intentAck ? <p className="text-[9px] text-muted tabular-nums">intent #{intentAck.stateVersion} · {intentAck.status === "parameters-observed" ? `параметры: ${intentAck.observedCount}/6` : "принятие без readback"} · expr:{intentAck.expressionStatus} · motion:{intentAck.motionStatus} · partial</p> : null}</div>
          <span className="rounded-full border border-border bg-bg/70 px-2.5 py-1 text-xs uppercase tracking-wider text-muted">{live ? "Live2D" : "Live2D недоступна"}</span>
        </div>
      </>}
      </div>
      {bodySwitch ? (
        <p className="pointer-events-none absolute bottom-1 left-3 z-30 text-[9px] text-muted tabular-nums">
          body {bodySwitch.from}→{bodySwitch.to} · ревизия {bodySwitch.plan.stateRevision}
          {bodySwitch.plan.requiresNeutralRebind ? " · перепривязка" : ""}
          {bodySwitch.plan.unsupportedChannels.length > 0 ? ` · неподдерживаемые: ${bodySwitch.plan.unsupportedChannels.join(",")}` : ""}
        </p>
      ) : null}
    </div>
  );
}
