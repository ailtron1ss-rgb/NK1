import { useEffect, useState } from "react";
import { Check, Mic, Volume2 } from "lucide-react";
import { useKurisu, type AvatarViewMode } from "@/organism/store";

const modes: Array<{ id: AvatarViewMode; label: string; description: string }> = [
  { id: "live2d", label: "Live2D", description: "Interactive 2D model and viewer readback." },
  { id: "original", label: "NK1 Original", description: "Native SVG character stage." },
  { id: "legacy", label: "Legacy", description: "Sprite-based visual fallback." },
  { id: "3d", label: "3D · Preview", description: "Experimental VRM/GLB preview; not a certified production asset." },
];

export function SettingsPanel() {
  const avatarMode = useKurisu((s) => s.avatarMode);
  const setAvatarMode = useKurisu((s) => s.setAvatarMode);
  const voiceEnabled = useKurisu((s) => s.voiceEnabled);
  const setVoiceEnabled = useKurisu((s) => s.setVoiceEnabled);
  const voiceName = useKurisu((s) => s.voiceName);
  const setVoiceName = useKurisu((s) => s.setVoiceName);
  const connection = useKurisu((s) => s.connection);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechAvailable, setSpeechAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    setSpeechAvailable(true);
    update();
    synth.addEventListener?.("voiceschanged", update);
    return () => synth.removeEventListener?.("voiceschanged", update);
  }, []);

  return (
    <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-accent/10 p-2 text-accent"><Volume2 className="size-5" /></div>
          <div><h2 className="font-display text-lg text-fg">Voice</h2><p className="text-xs text-muted">Browser speech output</p></div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-bg p-3">
          <div><p className="text-sm font-medium text-fg">Speak new replies</p><p className="text-xs text-muted">Previous chat history is never replayed automatically.</p></div>
          <button type="button" role="switch" aria-checked={voiceEnabled} disabled={!speechAvailable} onClick={() => setVoiceEnabled(!voiceEnabled)} className={voiceEnabled ? "rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg" : "rounded-full border border-border px-3 py-1.5 text-xs text-muted disabled:opacity-50"}>
            {voiceEnabled ? "On" : speechAvailable ? "Off" : "Unavailable"}
          </button>
        </div>
        <label className="mt-4 block text-xs font-medium text-muted" htmlFor="kurisu-voice-choice">Voice profile</label>
        <select id="kurisu-voice-choice" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} disabled={!speechAvailable || !voiceEnabled || voices.length === 0} className="mt-1 h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg disabled:opacity-50">
          <option value="">Automatic language match</option>
          {voices.map((voice) => <option key={voice.name + voice.lang} value={voice.name}>{voice.name} · {voice.lang}</option>)}
        </select>
        <p className="mt-2 text-xs text-subtle">{speechAvailable ? (voices.length ? "Voice availability is provided by the current browser or operating system." : "Waiting for browser voice profiles.") : "This browser does not expose SpeechSynthesis."}</p>
        <div className="mt-4 flex items-center gap-2 rounded-md bg-elevated p-3 text-xs text-muted">
          <Mic className="size-4 shrink-0" />
          <span>Microphone / ASR is a separate input capability. It is not shown as active until a real listening session is connected.</span>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-accent/10 p-2 text-accent"><Check className="size-5" /></div>
          <div><h2 className="font-display text-lg text-fg">Avatar and display</h2><p className="text-xs text-muted">Shared preferences for the home screen and avatar stage</p></div>
        </div>
        <div className="mt-4 space-y-2">
          {modes.map((mode) => (
            <button key={mode.id} type="button" aria-pressed={avatarMode === mode.id} onClick={() => setAvatarMode(mode.id)} className={avatarMode === mode.id ? "flex w-full items-start gap-3 rounded-lg border border-accent/60 bg-accent/10 p-3 text-left" : "flex w-full items-start gap-3 rounded-lg border border-border bg-bg p-3 text-left hover:border-accent/40"}>
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border">{avatarMode === mode.id ? <Check className="size-3.5 text-accent" /> : null}</span>
              <span className="min-w-0"><span className="block text-sm font-medium text-fg">{mode.label}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted">{mode.description}</span></span>
            </button>
          ))}
          <div className="rounded-lg border border-border bg-bg p-3 opacity-70" aria-disabled="true">
            <p className="text-sm font-medium text-fg">2.5D · Not enabled</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">The scene adapter still needs accepted layered artwork, masks, pivots and browser/device visual verification.</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-bg p-3">
          <p className="text-xs font-medium text-muted">Runtime connection</p>
          <p className="mt-1 text-sm text-fg">{connection.status} · {connection.version ?? "version unavailable"}</p>
          {connection.serviceDegraded ? <p className="mt-1 text-xs text-amber-400">Language provider fallback is active.</p> : null}
          <p className="mt-1 text-xs text-subtle">{connection.lastError ?? (connection.lastSyncedAt ? "Last confirmed at " + new Date(connection.lastSyncedAt).toLocaleTimeString() : "No canonical snapshot has been confirmed in this session.")}</p>
        </div>
      </section>
    </div>
  );
}
