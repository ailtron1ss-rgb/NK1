import { useEffect, useState } from "react";
import { Check, Mic, Volume2 } from "lucide-react";
import { useKurisu, type AvatarViewMode, type UiConnectionStatus } from "@/organism/store";
import type { OrganismSnapshot } from "@/organism/types";

const modes: Array<{ id: AvatarViewMode; label: string; description: string }> = [
  { id: "live2d", label: "Live2D", description: "Интерактивная 2D-модель Cubism с подтверждением состояния viewer." },
  { id: "original", label: "NK1 Original", description: "Встроенная векторная сцена персонажа на SVG." },
  { id: "legacy", label: "Legacy", description: "Запасной режим на статичных спрайтах." },
  { id: "3d", label: "3D · предпросмотр", description: "Экспериментальный предпросмотр VRM/GLB; модель не прошла production-приёмку." },
];

const connectionStatusLabels: Record<UiConnectionStatus, string> = {
  connecting: "Подключение",
  connected: "Подключено",
  degraded: "Ограниченный режим",
  disconnected: "Нет соединения",
};

export function SettingsPanel({ snap }: { snap: OrganismSnapshot }) {
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
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5" aria-label="Голосовые настройки">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-accent/10 p-2 text-accent"><Volume2 className="size-5" aria-hidden="true" /></div>
          <div><h2 className="font-display text-lg text-fg">Голос</h2><p className="text-xs text-muted">Синтез речи средствами браузера</p></div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-bg p-3">
          <div className="min-w-0">
            <p id="voice-replies-label" className="text-sm font-medium text-fg">Озвучивать новые ответы</p>
            <p id="voice-replies-description" className="text-xs text-muted">Старая история чата автоматически не воспроизводится.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-labelledby="voice-replies-label"
            aria-describedby="voice-replies-description"
            aria-checked={voiceEnabled}
            disabled={!speechAvailable}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={voiceEnabled ? "shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg" : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted disabled:opacity-50"}
          >
            {voiceEnabled ? "Вкл." : speechAvailable ? "Выкл." : "Недоступно"}
          </button>
        </div>
        <label className="mt-4 block text-xs font-medium text-muted" htmlFor="kurisu-voice-choice">Голосовой профиль</label>
        <select id="kurisu-voice-choice" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} disabled={!speechAvailable || !voiceEnabled || voices.length === 0} className="mt-1 h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg disabled:opacity-50">
          <option value="">Автоматически подобрать по языку</option>
          {voices.map((voice) => <option key={voice.name + voice.lang} value={voice.name}>{voice.name} · {voice.lang}</option>)}
        </select>
        <p className="mt-2 text-xs text-subtle">
          {speechAvailable
            ? (voices.length ? "Список голосов предоставляет текущий браузер или операционная система." : "Ожидаем список голосовых профилей браузера.")
            : "Этот браузер не поддерживает синтез речи SpeechSynthesis."}
        </p>
        <div className="mt-4 flex items-start gap-2 rounded-md bg-elevated p-3 text-xs text-muted">
          <Mic className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-medium text-fg">Микрофон runtime / ASR:</strong> {snap.voice.sttAvailable ? "доступен" : "недоступен"}.
            {snap.voice.listening ? " Сейчас активен сеанс прослушивания." : " Каждая запись проходит через явное разрешение микрофона в runtime."}
          </span>
        </div>
        <p className="mt-2 text-xs text-subtle">
          TTS runtime: {snap.voice.ttsAvailable ? "доступен" : "недоступен"}. Браузерный синтез речи выше — отдельный добровольно включаемый канал.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 md:p-5" aria-label="Аватар и отображение">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-accent/10 p-2 text-accent"><Check className="size-5" aria-hidden="true" /></div>
          <div><h2 className="font-display text-lg text-fg">Аватар и отображение</h2><p className="text-xs text-muted">Общие настройки главного экрана и панели аватара</p></div>
        </div>
        <div className="mt-4 space-y-2">
          {modes.map((mode) => (
            <button key={mode.id} type="button" aria-pressed={avatarMode === mode.id} onClick={() => setAvatarMode(mode.id)} className={avatarMode === mode.id ? "flex w-full items-start gap-3 rounded-lg border border-accent/60 bg-accent/10 p-3 text-left" : "flex w-full items-start gap-3 rounded-lg border border-border bg-bg p-3 text-left hover:border-accent/40"}>
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border">{avatarMode === mode.id ? <Check className="size-3.5 text-accent" /> : null}</span>
              <span className="min-w-0"><span className="block text-sm font-medium text-fg">{mode.label}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted">{mode.description}</span></span>
            </button>
          ))}
          <div className="rounded-lg border border-border bg-bg p-3 opacity-70" aria-disabled="true">
            <p className="text-sm font-medium text-fg">2.5D · не включён</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Адаптер сцены ожидает утверждённую многослойную графику, маски, pivot-точки и визуальную проверку в браузере и на устройствах.</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-bg p-3" aria-label="Состояние соединения runtime">
          <p className="text-xs font-medium text-muted">Подключение runtime</p>
          <p className="mt-1 text-sm text-fg">{connectionStatusLabels[connection.status]} · {connection.version ?? "версия недоступна"}</p>
          {connection.serviceDegraded ? <p className="mt-1 text-xs text-amber-400">Активен резервный языковой провайдер.</p> : null}
          <p className="mt-1 text-xs text-subtle">
            {connection.lastError
              ? "Последняя ошибка: " + connection.lastError
              : connection.lastSyncedAt
                ? "Последнее подтверждение: " + new Date(connection.lastSyncedAt).toLocaleTimeString()
                : "Канонический снимок в этой сессии ещё не подтверждён."}
          </p>
        </div>
      </section>
    </div>
  );
}
