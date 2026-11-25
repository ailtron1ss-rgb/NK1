import { useEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Sun, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKurisu } from "@/organism/store";
import { emptySnapshot } from "@/organism/types";
import { cn } from "@/lib/utils";
import { neuroApi } from "@/neuro-kurisu/api";

export function ChatPanel() {
  const snap = useKurisu((s) => s.snap) ?? emptySnapshot();
  const busy = useKurisu((s) => s.busy);
  const send = useKurisu((s) => s.send);
  const sleep = useKurisu((s) => s.sleep);
  const wake = useKurisu((s) => s.wake);
  const reset = useKurisu((s) => s.reset);
  const error = useKurisu((s) => s.error);
  const [text, setText] = useState("");
  const [proactiveConsent, setProactiveConsent] = useState<boolean | null>(null);
  const [proactiveOutbox, setProactiveOutbox] = useState<{ pending: number; deadLettered: number; leased: number; backoff: number; claimable: number; exhausted: number } | null>(null);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStartHourUtc, setQuietStartHourUtc] = useState(22);
  const [quietEndHourUtc, setQuietEndHourUtc] = useState(8);
  const [quietHoursBusy, setQuietHoursBusy] = useState(false);
  const [proactiveConsentBusy, setProactiveConsentBusy] = useState(false);
  const [proactiveConsentError, setProactiveConsentError] = useState<string | null>(null);
  const proactiveConsentEpoch = useRef(0);
  const quietHoursDirty = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [snap.chat.length, busy]);

  useEffect(() => {
    let cancelled = false;
    let refreshInFlight = false;
    const refreshPolicy = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      const epochAtStart = proactiveConsentEpoch.current;
      void neuroApi.proactiveDeliveryPolicy().then((result) => {
        if (!cancelled && epochAtStart === proactiveConsentEpoch.current) {
          setProactiveConsent(result.policy.consentGranted === true);
          setProactiveOutbox(result.policy.outbox);
          if (!quietHoursDirty.current) {
            setQuietHoursEnabled(result.policy.quietHoursEnabled === true);
            setQuietStartHourUtc(result.policy.quietStartHourUtc);
            setQuietEndHourUtc(result.policy.quietEndHourUtc);
          }
          setProactiveConsentError(null);
        }
      }).catch((error) => {
        if (!cancelled) setProactiveConsentError(error instanceof Error ? error.message : String(error));
      }).finally(() => {
        refreshInFlight = false;
      });
    };
    refreshPolicy();
    const timer = window.setInterval(refreshPolicy, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const saveQuietHours = async () => {
    if (quietHoursBusy || proactiveConsentBusy || quietStartHourUtc < 0 || quietStartHourUtc > 23
      || quietEndHourUtc < 0 || quietEndHourUtc > 23) return;
    proactiveConsentEpoch.current += 1;
    setQuietHoursBusy(true);
    setProactiveConsentError(null);
    try {
      const result = await neuroApi.setProactiveQuietHours({
        enabled: quietHoursEnabled,
        startHourUtc: quietStartHourUtc,
        endHourUtc: quietEndHourUtc,
      });
      setQuietHoursEnabled(result.policy.quietHoursEnabled === true);
      setQuietStartHourUtc(result.policy.quietStartHourUtc);
      setQuietEndHourUtc(result.policy.quietEndHourUtc);
      quietHoursDirty.current = false;
      setProactiveOutbox(result.policy.outbox);
    } catch (error) {
      setProactiveConsentError(error instanceof Error ? error.message : String(error));
    } finally {
      proactiveConsentEpoch.current += 1;
      setQuietHoursBusy(false);
    }
  };

  const toggleProactiveConsent = async () => {
    if (proactiveConsent === null || proactiveConsentBusy || quietHoursBusy) return;
    proactiveConsentEpoch.current += 1;
    setProactiveConsentBusy(true);
    setProactiveConsentError(null);
    try {
      const result = await neuroApi.setProactiveConsent(!proactiveConsent);
      setProactiveConsent(result.policy.consentGranted === true);
      setProactiveOutbox(result.policy.outbox);
    } catch (error) {
      setProactiveConsentError(error instanceof Error ? error.message : String(error));
    } finally {
      // Invalidate policy reads that raced this mutation; the next poll will
      // reconcile the committed server state, including ambiguous HTTP failures.
      proactiveConsentEpoch.current += 1;
      setProactiveConsentBusy(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-base text-fg">Cognitive cycle</h2>
          <p className="text-xs text-muted">
            {snap.lastDecision?.reason ?? "waiting for observation"}
          </p>
          <p className="mt-1 text-[11px] text-subtle">Internal reflection continues when unsolicited messages are paused.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={quietHoursEnabled} onChange={(event) => { quietHoursDirty.current = true; setQuietHoursEnabled(event.target.checked); }} disabled={quietHoursBusy || proactiveConsentBusy} />
              Quiet hours (UTC)
            </label>
            <label className="inline-flex items-center gap-1">
              <span>From</span>
              <input aria-label="Quiet hours start hour UTC" type="number" min={0} max={23} step={1} value={quietStartHourUtc} onChange={(event) => { quietHoursDirty.current = true; setQuietStartHourUtc(Math.max(0, Math.min(23, Number(event.target.value)))); }} disabled={quietHoursBusy || proactiveConsentBusy} className="w-12 rounded border border-border bg-bg px-1 py-0.5 text-fg" />
            </label>
            <label className="inline-flex items-center gap-1">
              <span>To</span>
              <input aria-label="Quiet hours end hour UTC" type="number" min={0} max={23} step={1} value={quietEndHourUtc} onChange={(event) => { quietHoursDirty.current = true; setQuietEndHourUtc(Math.max(0, Math.min(23, Number(event.target.value)))); }} disabled={quietHoursBusy || proactiveConsentBusy} className="w-12 rounded border border-border bg-bg px-1 py-0.5 text-fg" />
            </label>
            <Button type="button" variant="ghost" size="sm" disabled={quietHoursBusy || proactiveConsentBusy} onClick={() => void saveQuietHours()}>{quietHoursBusy ? "Saving…" : "Save hours"}</Button>
          </div>
          <p className="mt-1 text-[10px] text-subtle">Hours use UTC: the start hour is included and the end hour is excluded (for example, 22–08 blocks 22:00 through 07:59). Equal start and end hours pause delivery for the full day.</p>
          {proactiveOutbox ? <p className="mt-1 text-[10px] text-subtle" aria-live="polite">Outbox: {proactiveOutbox.pending} pending · {proactiveOutbox.leased} leased · {proactiveOutbox.backoff} retry · {proactiveOutbox.claimable} ready · {proactiveOutbox.exhausted} exhausted · {proactiveOutbox.deadLettered} dead-lettered</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button type="button" variant="outline" size="sm" disabled={proactiveConsent === null || proactiveConsentBusy || quietHoursBusy} aria-pressed={proactiveConsent === true} onClick={() => void toggleProactiveConsent()}>
            {proactiveConsent === null ? "Proactive consent: loading" : proactiveConsent ? "Pause proactive messages" : "Enable proactive messages"}
          </Button>
          <Button variant="ghost" size="icon" aria-label={snap.awake ? "Sleep" : "Wake"} onClick={snap.awake ? sleep : wake}>
            {snap.awake ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Clear UI chat history" onClick={reset}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </header>
      {error ? <div className="border-b border-border bg-ember/10 px-4 py-2 text-xs text-muted">Runtime: {error}</div> : null}
      {proactiveConsentError ? <div className="border-b border-border px-4 py-2 text-xs text-muted">Proactive consent: {proactiveConsentError}</div> : null}
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
          const v = text;
          setText("");
          void send(v);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write to Kurisu…"
          maxLength={4000}
          className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </section>
  );
}
