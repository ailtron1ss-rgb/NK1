import { useEffect, useState } from "react";
import { Activity, RefreshCw, WifiOff } from "lucide-react";
import { neuroApiUrl } from "@/neuro-kurisu/api";

type RuntimeHealth = {
  ok: boolean;
  ready: boolean;
  service: string;
  legacyService?: string;
  version?: string;
  organismCore?: string;
  schemaVersion?: number;
  tick?: number;
  uptimeSec?: number;
  bodySource?: string;
};

type HealthView =
  | { state: "loading" }
  | { state: "online"; value: RuntimeHealth; checkedAt: number }
  | { state: "offline"; message: string; checkedAt: number };

function duration(seconds: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  const remainder = value % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

export function RuntimeHealthPanel() {
  const [view, setView] = useState<HealthView>({ state: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    let timeout: number | null = null;

    const refresh = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      timeout = window.setTimeout(() => controller?.abort(), 5_000);
      try {
        const response = await fetch(neuroApiUrl("/api/health"), {
          method: "GET",
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const payload = await response.json() as RuntimeHealth;
        if (!response.ok || payload.ok !== true) {
          throw new Error(`health endpoint returned HTTP ${response.status}`);
        }
        if (!disposed) {
          setView({ state: "online", value: payload, checkedAt: Date.now() });
        }
      } catch (error) {
        if (!disposed) {
          setView({
            state: "offline",
            message: error instanceof Error ? error.message : String(error),
            checkedAt: Date.now(),
          });
        }
      } finally {
        if (timeout !== null) window.clearTimeout(timeout);
        timeout = null;
        inFlight = false;
      }
    };

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);

    return () => {
      disposed = true;
      controller?.abort();
      if (timeout !== null) window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  const online = view.state === "online";
  const ready = online && view.value.ready;
  const label = !online ? (view.state === "loading" ? "Connecting" : "Offline") : ready ? "Ready" : "Starting";

  return (
    <section
      aria-label="NeuroCore runtime status"
      aria-live="polite"
      className="min-w-[210px] rounded-xl border border-border bg-surface/80 px-3 py-2 text-xs"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {online ? <Activity className="size-3.5 text-emerald-400" /> : <WifiOff className="size-3.5 text-amber-400" />}
          <span className="font-medium text-fg">Runtime</span>
          <span className={ready ? "text-emerald-400" : online ? "text-amber-300" : "text-muted"}>{label}</span>
        </div>
        <button
          type="button"
          aria-label="Refresh runtime status"
          title="Refresh runtime status"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="rounded p-1 text-muted transition hover:bg-elevated hover:text-fg"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {online ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] text-muted">
          <span>Core</span><span className="truncate text-right text-fg">{view.value.organismCore ?? view.value.version ?? "unknown"}</span>
          <span>Tick</span><span className="tabular-nums text-right text-fg">{Number(view.value.tick ?? 0).toLocaleString()}</span>
          <span>Uptime</span><span className="tabular-nums text-right text-fg">{duration(Number(view.value.uptimeSec ?? 0))}</span>
          <span>Body</span><span className="truncate text-right text-fg">{view.value.bodySource ?? "unknown"}</span>
        </div>
      ) : (
        <p className="mt-1 max-w-[260px] break-words text-[10px] leading-relaxed text-muted">
          {view.state === "loading" ? "Reading the live /api/health endpoint…" : view.message}
        </p>
      )}
      <p className="mt-1 text-right text-[9px] text-subtle">
        {view.state === "loading" ? "No runtime metrics yet" : `Checked ${new Date(view.checkedAt).toLocaleTimeString()}`}
      </p>
    </section>
  );
}
