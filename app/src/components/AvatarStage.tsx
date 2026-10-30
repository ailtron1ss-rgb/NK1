import { useEffect, useRef, useState } from "react";
import type { EmotionLabel, OrganismSnapshot } from "@/organism/types";
import { planAvatarMotorIntent } from "./avatar/motorIntent";
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
} from "./avatar/embodimentTimeline";

const EXPR: Record<EmotionLabel, string> = {
  curiosity: "thinking", calm: "neutral", joy: "happy", anxiety: "sad",
  frustration: "angry", sadness: "sad", anger: "angry", protective: "focused",
};
type ViewMode = "live2d" | "legacy" | "original" | "3d";
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

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
  const motionIntentKeyRef = useRef("");
  const motionIntentTokenRef = useRef(0);
  const activeSpeechSessionRef = useRef<BrowserSpeechSession | null>(null);
  const lastSpeechSessionRef = useRef<BrowserSpeechSession | null>(null);
  const speechPhaseRef = useRef<SpeechPhase>("idle");
  const [live, setLive] = useState(false);
  const [viewerReadyRevision, setViewerReadyRevision] = useState(0);
  // Native speech is opt-in. Opening the app never starts speaking historical chat.
  const [voiceEnabled, setVoiceEnabled] = useState(() => readAvatarPreference("kurisu-avatar-voice-enabled") === "true");
  const [voiceName, setVoiceName] = useState(() => readAvatarPreference("kurisu-avatar-voice-name") ?? "");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<"off" | "ready" | "unsupported" | "speaking" | "unknown">(() => typeof window !== "undefined" && "speechSynthesis" in window ? "off" : "unsupported");
  const [mouthPose, setMouthPose] = useState<MouthPose>(CLOSED_MOUTH);
  const [mode, setMode] = useState<ViewMode>(() => {
    const saved = readAvatarPreference("kurisu-avatar-mode");
    return saved === "legacy" || saved === "original" || saved === "3d" ? saved : "live2d";
  });
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
    }
    try { window.speechSynthesis?.cancel(); } catch { /* browser may deny speech */ }
    utteranceRef.current = null;
    setMouthPose(CLOSED_MOUTH);
    setVoiceStatus(voiceEnabled ? "ready" : "off");
  };

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
      if (ev.data.type === "live2d_error") {
        if (typeof ev.data.error !== "string" || ev.data.error.length > 512) return;
        setLive(false);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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
        const language = inferSpeechLanguage(text);
        const rate = 0.96;
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
        };
        activeSpeechSessionRef.current = session;
        lastSpeechSessionRef.current = session;
        speechPhaseRef.current = "starting";
        setMouthPose(sampleVisemeTimeline(session.timeline, 0));
        setVoiceStatus("ready");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = rate;
        const utteranceEmotion = lastTurn.emotion ?? snap.emotion.label;
        utterance.pitch = utteranceEmotion === "joy" ? 1.03 : utteranceEmotion === "frustration" || utteranceEmotion === "anger" ? 0.92 : 1.0;
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
    // A cancelled utterance is a hard embodiment boundary: return to the shipped idle
    // clip and clear gesture offsets instead of replaying the interrupted response pose.
    const speechCancelled = speechPhaseRef.current === "cancelled";
    const bodyGestureActive = !speechCancelled && motorPlan.gesture;
    const motionGroup = speechCancelled ? "Idle" : motorPlan.motionGroup;
    const motionIndex = speechCancelled ? 0 : motorPlan.motionIndex;
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
      gaze: { x: motorPlan.gazeX, y: motorPlan.gazeY, driven: true },
      body: {
        // Profile-specific micro-tilt composes with the authored clip; the CDI3 rig has no arm IK.
        headTilt: speechCancelled ? 0 : Math.max(-0.15, Math.min(0.15, motorPlan.headTilt + (
          motorPlan.gestureProfile === "considering" || motorPlan.gestureProfile === "examining" ? -1 :
          motorPlan.gestureProfile === "none" ? 0 : 1
        ) * motorPlan.gestureIntensity * 0.018)),
        gesture: bodyGestureActive,
        gestureProfile: speechCancelled ? "none" : motorPlan.gestureProfile,
        gestureIntensity: speechCancelled ? 0 : motorPlan.gestureIntensity,
        motionGroup,
        motionIndex: motionGroup === "Special" ? motionIndex : 0,
        motionToken: Number.isSafeInteger(motionToken) && motionToken > 0 ? motionToken : 0,
      },
      voiceEmphasis: activeUtterance ? Math.min(1, snap.emotion.arousal + 0.15) : 0,
    };
    win.postMessage(intent, window.location.origin);
  }, [snap.emotion, snap.lastOption, snap.chat, snap.tick, snap.awake, thinking, live, viewerReadyRevision, mode, voiceStatus, mouthPose, turnKey]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-elevated">
      <div className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1 rounded-md border border-border bg-black/60 p-1 backdrop-blur">
        <button type="button" onClick={() => setMode("live2d")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "live2d" ? "bg-accent text-accent-fg" : "text-white/70")}>Live2D</button>
        <button type="button" onClick={() => setMode("legacy")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "legacy" ? "bg-accent text-accent-fg" : "text-white/70")}>Legacy</button>
        <button type="button" onClick={() => setMode("original")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "original" ? "bg-accent text-accent-fg" : "text-white/70")}>NK1 Original</button>
        <button type="button" onClick={() => setMode("3d")} className={cn("rounded px-2 py-1 text-[10px] font-mono", mode === "3d" ? "bg-accent text-accent-fg" : "text-white/70")}>3D</button>
        <button type="button" aria-pressed={voiceEnabled} onClick={() => { if (voiceEnabled) stopSpeech(); setVoiceEnabled((value) => !value); }} disabled={voiceStatus === "unsupported"} className={cn("rounded px-2 py-1 text-[10px] font-mono", voiceEnabled ? "bg-accent text-accent-fg" : "text-white/70")}>{voiceEnabled ? "Голос: вкл." : "Голос: выкл."}</button>
        {voiceEnabled && voices.length > 0 ? <select aria-label="Голос Курису" value={voiceName} onChange={(event) => { stopSpeech(); setVoiceName(event.target.value); }} className="max-w-32 rounded bg-black/70 px-1 py-1 text-[10px] text-white"><option value="">Авто</option>{voices.map((voice) => <option key={`${voice.name}:${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}</select> : null}
      </div>
      {mode === "legacy" ? <LegacySpriteDeck emotion={snap.emotion.label} action={snap.lastOption} thinking={thinking} speaking={voiceStatus === "speaking" || thinking || (lastTurn?.role === "kurisu" && Date.now() - Number(lastTurn.at || 0) < 5_000)} /> : mode === "original" ? <KurisuOriginalStage emotion={snap.emotion.label} action={snap.lastOption} arousal={snap.emotion.arousal} gazeX={originalGaze.x} gazeY={originalGaze.y} speaking={voiceStatus === "speaking"} mouthPose={mouthPose} thinking={thinking} /> : mode === "3d" ? <Avatar3DStage emotion={snap.emotion.label} action={snap.lastOption} arousal={snap.emotion.arousal} valence={snap.emotion.valence} dominance={snap.emotion.dominance} energy={snap.needs.energy} cognitiveLoad={snap.needs.cognitiveLoad} uncertainty={snap.needs.uncertainty} socialNeed={snap.needs.socialNeed} novelty={snap.needs.novelty} goalPressure={snap.needs.goalPressure} curiosity={snap.curiosity} predictionError={snap.predictionError} traits={snap.identity.traits} gazeX={originalGaze.x} gazeY={originalGaze.y} speaking={voiceStatus === "speaking"} mouthPose={mouthPose} thinking={thinking} awake={snap.awake} /> : <>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-ember)_18%,transparent),transparent_62%)]" />
        <iframe ref={frame} title="Kurisu Live2D" src="/live2d/viewer.html?profile=auto" className={cn("relative z-10 h-[320px] w-full border-0 transition-opacity duration-300 md:h-[420px]", live ? "opacity-100" : "opacity-0")} allow="autoplay" />
        {!live ? <div className="absolute inset-0 z-[11] flex items-center justify-center p-6"><div className="max-w-sm rounded-xl border border-border bg-bg/85 p-4 text-center backdrop-blur"><p className="text-xs font-medium uppercase tracking-wider text-subtle">Live2D unavailable</p><p className="mt-1 text-sm text-fg">Переключитесь на Legacy — там используются реальные legacy sprite-ассеты.</p><button type="button" onClick={() => setMode("legacy")} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:bg-elevated">Open Legacy</button></div></div> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4">
          <div><p className="font-display text-lg tracking-tight text-fg">Kurisu</p><p className="text-xs text-muted tabular-nums">{snap.awake ? "awake" : "sleep"} · {snap.emotion.label} · t{snap.tick}</p><p className="text-[10px] text-muted">{voiceStatus === "unsupported" ? "голос недоступен в этом браузере" : voiceStatus === "unknown" ? "исход воспроизведения неизвестен" : voiceStatus === "speaking" ? "говорит · виземы привязаны к временной шкале речи" : voiceEnabled ? "голос включён · речь запускается для новых реплик" : "голос выключен"}</p></div>
          <span className="rounded-full border border-border bg-bg/70 px-2.5 py-1 text-xs uppercase tracking-wider text-muted">{live ? "live2d" : "live2d unavailable"}</span>
        </div>
      </>}
    </div>
  );
}
