import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, Moon, Sun, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKurisu } from "@/organism/store";
import { emptySnapshot } from "@/organism/types";
import { cn } from "@/lib/utils";
import {
  convertBrowserRecordingToWhisperWav,
  WHISPER_MAX_CAPTURE_SECONDS,
} from "@/components/avatar/browserWhisperAudio";

const TRANSCRIBE_PATH = "/api/organism/speech/transcribe";

export function ChatPanel() {
  const snap = useKurisu((s) => s.snap) ?? emptySnapshot();
  const busy = useKurisu((s) => s.busy);
  const send = useKurisu((s) => s.send);
  const sleep = useKurisu((s) => s.sleep);
  const wake = useKurisu((s) => s.wake);
  const reset = useKurisu((s) => s.reset);
  const error = useKurisu((s) => s.error);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [startingCapture, setStartingCapture] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingFailedRef = useRef(false);
  const startLockRef = useRef(false);
  const mountedRef = useRef(true);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [snap.chat.length, busy]);

  const releaseMicrophone = () => {
    if (recordTimerRef.current !== null) {
      window.clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  const transcribeRecording = async (recorded: Blob) => {
    const controller = new AbortController();
    transcriptionAbortRef.current = controller;
    setTranscribing(true);
    setVoiceStatus("Преобразую аудио и распознаю его локально…");
    try {
      const wav = await convertBrowserRecordingToWhisperWav(recorded);
      const response = await fetch(TRANSCRIBE_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "audio/wav" },
        body: wav,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as { text?: unknown; error?: unknown };
      if (!response.ok) {
        const reason = typeof payload.error === "string" ? payload.error : "whisper-transcription-failed";
        throw new Error(reason);
      }
      const transcript = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!transcript) throw new Error("whisper-empty-transcript");
      setText((current) => {
        const prefix = current.trim();
        return (prefix ? `${prefix} ${transcript}` : transcript).slice(0, 4_000);
      });
      setVoiceStatus("Распознано локально. Проверьте текст и нажмите «Отправить».");
    } catch (caught) {
      if (!controller.signal.aborted) {
        const reason = caught instanceof Error ? caught.message : "speech-transcription-failed";
        setVoiceStatus(reason === "whisper-provider-not-configured"
          ? "Локальный Whisper не настроен. Проверьте NK1_WHISPER_CPP_URL."
          : `Не удалось распознать речь: ${reason}`);
      }
    } finally {
      if (transcriptionAbortRef.current === controller) transcriptionAbortRef.current = null;
      if (mountedRef.current) setTranscribing(false);
    }
  };

  const toggleMicrophone = async () => {
    if (recording) {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      return;
    }
    if (busy || transcribing || startingCapture || startLockRef.current) return;
    setVoiceStatus("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceStatus("Этот браузер не поддерживает запись с микрофона.");
      return;
    }
    startLockRef.current = true;
    setStartingCapture(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
        return;
      }
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingFailedRef.current = false;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recordingFailedRef.current = true;
        setVoiceStatus("Браузер не смог записать аудио с микрофона.");
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorder.onstop = () => {
        const captured = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const failed = recordingFailedRef.current;
        recordingFailedRef.current = false;
        chunksRef.current = [];
        releaseMicrophone();
        setRecording(false);
        if (failed) setVoiceStatus("Запись завершилась с ошибкой; аудио не отправлено на распознавание.");
        else if (captured.size > 0) void transcribeRecording(captured);
        else setVoiceStatus("Запись пуста. Попробуйте ещё раз.");
      };
      recorder.start(250);
      startLockRef.current = false;
      setStartingCapture(false);
      setRecording(true);
      setVoiceStatus("Запись… нажмите микрофон ещё раз, чтобы закончить.");
      recordTimerRef.current = window.setTimeout(() => {
        setVoiceStatus("Достигнут лимит записи. Начинаю распознавание…");
        if (recorder.state !== "inactive") recorder.stop();
      }, WHISPER_MAX_CAPTURE_SECONDS * 1_000);
    } catch (caught) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      if (mountedRef.current) {
        const reason = caught instanceof Error ? caught.message : "microphone-access-failed";
        setVoiceStatus(`Нет доступа к микрофону: ${reason}`);
      }
    } finally {
      startLockRef.current = false;
      if (mountedRef.current) setStartingCapture(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startLockRef.current = true;
      if (recordTimerRef.current !== null) window.clearTimeout(recordTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      transcriptionAbortRef.current?.abort();
    };
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-base text-fg">Cognitive cycle</h2>
          <p className="text-xs text-muted">
            {snap.lastDecision?.reason ?? "waiting for observation"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={snap.awake ? "Sleep" : "Wake"} onClick={snap.awake ? sleep : wake}>
            {snap.awake ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Clear UI chat history" onClick={reset}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </header>
      {error ? <div className="border-b border-border bg-ember/10 px-4 py-2 text-xs text-muted">Runtime: {error}</div> : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {snap.chat.map((m) => (
          <article
            key={m.id}
            className={cn(
              "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-elevated text-fg"
                : "border border-border bg-bg text-fg",
            )}
          >
            <p>{m.text}</p>
            {m.role === "kurisu" ? (
              <p className="mt-1 text-xs uppercase tracking-wider text-subtle">
                {m.backend ?? "local"} · {m.emotion} · {m.option}
              </p>
            ) : null}
          </article>
        ))}
        {busy ? <p className="text-xs text-muted">Canonical runtime is processing…</p> : null}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          setText("");
          void send(value);
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={recording ? "Stop recording and transcribe" : "Record speech"}
          aria-pressed={recording}
          disabled={startingCapture || transcribing || (busy && !recording)}
          onClick={() => void toggleMicrophone()}
        >
          {recording ? <MicOff className="size-4 text-accent" /> : <Mic className="size-4" />}
        </Button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write or dictate to Kurisu…"
          maxLength={4000}
          className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button type="submit" size="icon" disabled={busy || transcribing || !text.trim()} aria-label="Send">
          <ArrowUp className="size-4" />
        </Button>
      </form>
      {voiceStatus ? <p className="px-4 pb-3 text-xs text-muted" aria-live="polite">{voiceStatus}</p> : null}
    </section>
  );
}
