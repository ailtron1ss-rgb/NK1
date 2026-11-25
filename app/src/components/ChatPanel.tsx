import { useEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Sun, RotateCcw, Mic, MicOff, LoaderCircle, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKurisu } from "@/organism/store";
import { emptySnapshot } from "@/organism/types";
import { cn } from "@/lib/utils";
import { draftAfterSend } from "@/organism/chatDraft";
import { persistChatDraft, readPersistentChatDraft, type ChatDraftStorage } from "@/organism/chatDraftStorage";

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
          <h2 className="font-display text-base text-fg">Cognitive cycle</h2>
          <p className="text-xs text-muted">
            {snap.lastDecision?.reason ?? "waiting for observation"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={snap.awake ? "Sleep" : "Wake"} onClick={snap.awake ? sleep : wake} disabled={connection.status !== "connected" || busy}>
            {snap.awake ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Export UI chat history" title="Export chat" onClick={() => {
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), turns: snap.chat }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "neurocore-chat-history.json";
            anchor.click();
            URL.revokeObjectURL(url);
          }}><Download className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Clear UI chat history" onClick={() => {
            if (window.confirm("Clear only this browser chat transcript? Canonical memory will not be changed.")) reset();
          }} disabled={busy}><RotateCcw className="size-4" /></Button>
        </div>
      </header>
      {connection.status !== "connected" ? (
        <div className="border-b border-border bg-elevated px-4 py-2 text-xs text-muted" role="status" aria-live="polite">
          {connection.status === "connecting" ? "Connecting to the canonical runtime…" :
            connection.status === "disconnected" ? "Runtime disconnected. Your message draft is kept if sending fails." :
              "Runtime connection degraded. The last confirmed snapshot is retained."}
          {connection.lastSyncedAt ? <span className="ml-2 text-subtle">Last sync: {new Date(connection.lastSyncedAt).toLocaleTimeString()}</span> : null}
        </div>
      ) : null}
      {connection.serviceDegraded ? <div className="border-b border-border bg-ember/10 px-4 py-2 text-xs text-muted" role="status">Language provider is degraded; replies may use the configured fallback.</div> : null}
      {error ? <div className="border-b border-border bg-ember/10 px-4 py-2 text-xs text-muted" role="alert">Runtime: {error}</div> : null}
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
                {m.delivery === "sending" ? "Sending…" : m.delivery === "sent" ? "Sent" : m.delivery === "rejected" ? "Not accepted · correct the request before resending" : "Outcome not confirmed · check the conversation before retrying"}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9px] tabular-nums text-subtle">{Number.isFinite(m.at) ? new Date(m.at).toLocaleTimeString() : ""}</span>
              {m.role === "kurisu" ? <span className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-subtle">{m.backend ?? "canonical"} · {m.emotion ?? "unknown"} · {m.option ?? "unknown"}</span><button type="button" className="rounded p-1 text-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Copy assistant reply" title="Copy reply" onClick={() => { void navigator.clipboard?.writeText(m.text); }}><Copy className="size-3.5" /></button></span> : null}
            </div>
          </article>
        ))}
        {busy ? <p className="text-xs text-muted">Canonical runtime is processing…</p> : null}
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
          placeholder={connection.status === "connected" ? "Write to Kurisu… (Enter to send, Shift+Enter for a new line)" : "Write a message — it will remain recoverable if the runtime is offline…"}
          aria-label="Message to Kurisu"
          aria-describedby="chat-composer-hint"
          rows={2}
          maxLength={4000}
          className="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={voiceInputStatus === "listening" || voiceInputStatus === "stop-unconfirmed" ? "Stop microphone capture" : "Start microphone input"}
          title={voiceInputStatus === "listening" ? "Stop listening" : voiceInputStatus === "requesting" ? "Waiting for microphone approval or capture" : voiceInputStatus === "stop-unconfirmed" ? "Retry stop confirmation" : "Listen"}
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
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
          <ArrowUp className="size-4" />
        </Button>
      </form>
      <p id="chat-composer-hint" className="px-3 text-[10px] text-subtle">Enter sends · Shift+Enter adds a line · microphone transcripts are not sent automatically</p>
      {voiceInputStatus === "requesting" ? <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status" aria-live="polite">Waiting for microphone approval or the runtime to confirm an active capture.</p> : null}
      {voiceInputStatus === "listening" ? <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status" aria-live="polite">Runtime confirmed active microphone capture. The transcript will be inserted for review; it will not be sent automatically.</p> : null}
      {voiceInputStatus === "stopping" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status">Requesting microphone stop confirmation…</p>
      ) : null}
      {voiceInputStatus === "stop-unconfirmed" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="alert">Microphone stop is not confirmed. Retry the stop request before starting another capture.</p>
      ) : null}
      {voiceInputStatus === "transcribed" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status">Transcript inserted into the draft. Review it before sending.</p>
      ) : null}
      {voiceInputError ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="alert">Microphone: {voiceInputError}</p>
      ) : null}
    </section>
  );
}
