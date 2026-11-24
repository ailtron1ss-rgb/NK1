import { useEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Sun, RotateCcw, Mic, MicOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKurisu } from "@/organism/store";
import { emptySnapshot } from "@/organism/types";
import { cn } from "@/lib/utils";
import { draftAfterSend } from "@/organism/chatDraft";

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
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [snap.chat.length, busy]);

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
          <Button variant="ghost" size="icon" aria-label="Clear UI chat history" onClick={reset} disabled={busy}>
            <RotateCcw className="size-4" />
          </Button>
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
        onSubmit={async (e) => {
          e.preventDefault();
          const submitted = text;
          if (!submitted.trim() || busy) return;
          setText("");
          const delivered = await send(submitted);
          setText((current) => draftAfterSend(current, submitted, delivered));
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={connection.status === "connected" ? "Write to Kurisu…" : "Write a message — it will remain recoverable if the runtime is offline…"}
          aria-label="Message to Kurisu"
          maxLength={4000}
          className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={voiceInputStatus === "listening" || voiceInputStatus === "stop-unconfirmed" ? "Stop microphone capture" : "Start microphone input"}
          title={voiceInputStatus === "listening" ? "Stop listening" : voiceInputStatus === "stop-unconfirmed" ? "Retry stop confirmation" : "Listen"}
          disabled={voiceInputStatus === "stopping" || (voiceInputStatus !== "listening" && voiceInputStatus !== "stop-unconfirmed" && (busy || connection.status !== "connected" || !snap.voice.sttAvailable))}
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
          {voiceInputStatus === "listening" || voiceInputStatus === "stopping" || voiceInputStatus === "stop-unconfirmed"
            ? voiceInputStatus === "stopping" ? <LoaderCircle className="size-4 animate-spin" /> : <MicOff className="size-4" />
            : <Mic className="size-4" />}
        </Button>
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
          <ArrowUp className="size-4" />
        </Button>
      </form>
      {voiceInputStatus === "listening" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted" role="status" aria-live="polite">
          Listening through the configured runtime. The transcript will be inserted for review; it will not be sent automatically.
        </p>
      ) : null}
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
