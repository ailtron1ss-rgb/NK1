import { useEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Sun, RotateCcw, Mic, MicOff, LoaderCircle, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKurisu } from "@/organism/store";
import { emptySnapshot } from "@/organism/types";
import { cn } from "@/lib/utils";
import { draftAfterSend } from "@/organism/chatDraft";
import { persistChatDraft, readPersistentChatDraft, type ChatDraftStorage } from "@/organism/chatDraftStorage";
import { UI_ACTION_LABELS, UI_CONNECTION_STATUS_LABELS, UI_EMOTION_LABELS } from "@/organism/uiLabels";

function chatDraftStorage(): ChatDraftStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function ChatPanel() {
  const snap = useKurisu((s) => s.snap) ?? emptySnapshot();
  const busy = useKurisu((s) => s.busy);
  const connection = useKurisu((s) => s.connection);
  const send = useKurisu((s) => s.send);
  const sleep = useKurisu((s) => s.sleep);
  const wake = useKurisu((s) => s.wake);
  const reset = useKurisu((s) => s.reset);
  const listen = useKurisu((s) => s.listen);
  const stopListening = useKurisu((s) => s.stopListening);
  const voiceInputStatus = useKurisu((s) => s.voiceInputStatus);
  const voiceInputError = useKurisu((s) => s.voiceInputError);
  const error = useKurisu((s) => s.error);
  const [text, setText] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [snap.chat.length, busy]);

  useEffect(() => {
    setText((current) => current.length ? current : readPersistentChatDraft(chatDraftStorage()));
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (draftLoaded) persistChatDraft(chatDraftStorage(), text);
  }, [draftLoaded, text]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-base text-fg">Цикл общения</h2>
          <p className="text-xs text-muted">
            {snap.lastDecision?.reason ?? "Ожидаем наблюдение"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={snap.awake ? "Уложить спать" : "Разбудить"} onClick={snap.awake ? sleep : wake} disabled={connection.status !== "connected" || busy}>
            {snap.awake ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Экспортировать историю чата" title="Экспорт чата" onClick={() => {
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), turns: snap.chat }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "neurocore-chat-history.json";
            anchor.click();
            URL.revokeObjectURL(url);
          }}><Download className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Очистить историю чата" onClick={() => {
            if (window.confirm("Очистить только историю чата в этом браузере? Каноническая память не изменится.")) reset();
          }} disabled={busy}><RotateCcw className="size-4" /></Button>
        </div>
      </header>
      {connection.status !== "connected" ? (
        <div className="border-b border-border bg-elevated px-4 py-2 text-xs text-muted" role="status" aria-live="polite">
          {connection.status === "connecting" ? `${UI_CONNECTION_STATUS_LABELS.connecting}: ожидаем подтверждение канонического runtime…` :
            connection.status === "disconnected" ? "Runtime отключён. Черновик сообщения сохранится, если отправка не удастся." :
              "Соединение с runtime нестабильно. Сохраняем последний подтверждённый снимок."}
          {connection.lastSyncedAt ? <span className="ml-2 text-subtle">Последняя синхронизация: {new Date(connection.lastSyncedAt).toLocaleTimeString()}</span> : null}
        </div>
      ) : null}
      {connection.serviceDegraded ? <div className="border-b border-border bg-ember/10 px-4 py-2 text-xs text-muted" role="status">Провайдер языка работает в ограниченном режиме; ответы могут использовать настроенный резервный вариант.</div> : null}
      {error ? <div className="border-b border-border bg-ember/10 px-4 py-2 text-xs text-muted" role="alert">Ошибка runtime: {error}</div> : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
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
            {m.role === "user" && m.delivery ? (
              <p className="mt-1 text-[10px] text-subtle" role="status">
                {m.delivery === "sending" ? "Отправляется…" : m.delivery === "sent" ? "Отправлено" : m.delivery === "rejected" ? "Не принято · исправьте запрос перед повторной отправкой" : "Результат не подтверждён · проверьте переписку перед повторной отправкой"}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9px] tabular-nums text-subtle">{Number.isFinite(m.at) ? new Date(m.at).toLocaleTimeString() : ""}</span>
              {m.role === "kurisu" ? <span className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-subtle">{m.backend ?? "канонический runtime"} · {(m.emotion ? UI_EMOTION_LABELS[m.emotion as keyof typeof UI_EMOTION_LABELS] ?? m.emotion : "эмоция не указана")} · {(m.option ? UI_ACTION_LABELS[m.option as keyof typeof UI_ACTION_LABELS] ?? m.option : "действие не указано")}</span><button type="button" className="rounded p-1 text-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Скопировать ответ Курису" title="Скопировать ответ" onClick={() => { void navigator.clipboard?.writeText(m.text); }}><Copy className="size-3.5" /></button></span> : null}
            </div>
          </article>
        ))}
        {busy ? <p className="text-xs text-muted">Канонический runtime обрабатывает запрос…</p> : null}
        <div ref={end} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const submitted = text;
          if (!submitted.trim() || busy) return;
          const delivered = await send(submitted);
          setText((current) => delivered && current === submitted
            ? ""
            : draftAfterSend(current, submitted, delivered));
        }}
      >
        <textarea
          ref={composer}
          value={text}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          onChange={(e) => setText(e.target.value)}
          placeholder={connection.status === "connected" ? "Напишите Курису… (Enter — отправить, Shift+Enter — новая строка)" : "Напишите сообщение — черновик сохранится, даже если runtime отключён…"}
          aria-label="Сообщение для Курису"
          aria-describedby="chat-composer-hint"
          rows={2}
          maxLength={4000}
          className="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="min-h-11 min-w-11"
          aria-label={voiceInputStatus === "listening" || voiceInputStatus === "stop-unconfirmed" ? "Остановить запись с микрофона" : "Начать ввод с микрофона"}
          title={voiceInputStatus === "listening" ? "Остановить прослушивание" : voiceInputStatus === "requesting" ? "Ожидаем разрешение на микрофон" : voiceInputStatus === "stop-unconfirmed" ? "Повторить подтверждение остановки" : "Начать прослушивание"}
          disabled={voiceInputStatus === "requesting" || voiceInputStatus === "stopping" || (voiceInputStatus !== "listening" && voiceInputStatus !== "stop-unconfirmed" && (busy || connection.status !== "connected" || !snap.voice.sttAvailable))}
          onClick={() => {
            if (voiceInputStatus === "listening" || voiceInputStatus === "stop-unconfirmed") {
              void stopListening();
              return;
            }
            void listen().then((transcript) => {
              if (!transcript) return;
              setText((current) => [current.trim(), transcript].filter(Boolean).join(" ").slice(0, 4000));
            });
          }}
        >
          {voiceInputStatus === "requesting" || voiceInputStatus === "listening" || voiceInputStatus === "stopping" || voiceInputStatus === "stop-unconfirmed"
            ? voiceInputStatus === "requesting" || voiceInputStatus === "stopping" ? <LoaderCircle className="size-4 animate-spin" /> : <MicOff className="size-4" />
            : <Mic className="size-4" />}
        </Button>
        <Button type="submit" size="icon" className="min-h-11 min-w-11" disabled={busy || !text.trim()} aria-label="Отправить">
          <ArrowUp className="size-4" />
        </Button>
      </form>
      <p id="chat-composer-hint" className="px-3 text-[10px] text-subtle">Enter — отправить · Shift+Enter — новая строка · текст с микрофона не отправляется автоматически</p>
      {voiceInputStatus === "requesting" ? <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status" aria-live="polite">Ожидаем разрешение на микрофон или подтверждение активной записи от runtime.</p> : null}
      {voiceInputStatus === "listening" ? <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status" aria-live="polite">Runtime подтвердил активную запись с микрофона. Расшифровка появится в черновике и не будет отправлена автоматически.</p> : null}
      {voiceInputStatus === "stopping" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status">Запрашиваем подтверждение остановки микрофона…</p>
      ) : null}
      {voiceInputStatus === "stop-unconfirmed" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="alert">Остановка микрофона не подтверждена. Повторите запрос остановки перед новой записью.</p>
      ) : null}
      {voiceInputStatus === "transcribed" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status">Расшифровка добавлена в черновик. Проверьте её перед отправкой.</p>
      ) : null}
      {voiceInputError ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="alert">Микрофон: {voiceInputError}</p>
      ) : null}
    </section>
  );
}
