import { useEffect, useState } from "react";
import { Activity, RefreshCw, WifiOff } from "lucide-react";
import { neuroApiUrl } from "@/neuro-kurisu/api";

type RuntimeStatus = {
  ok: boolean;
  version?: string;
  organismCore?: string;
  schemaVersion?: number;
  tick?: number;
  lastAction?: string;
  memoryCount?: number;
  autonomyScore?: number;
  predictionError?: number;
};

type HealthView =
  | { state: "loading" }
  | { state: "online"; value: RuntimeStatus; checkedAt: number }
  | { state: "offline"; message: string; checkedAt: number };

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
        // Reuse the existing status-lite API path, already covered by the /api/organism Vite proxy.
        const response = await fetch(neuroApiUrl("/api/organism/status-lite"), {
          method: "GET",
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const payload = await response.json() as RuntimeStatus;
        if (!response.ok || payload.ok !== true) {
          throw new Error(`runtime status endpoint returned HTTP ${response.status}`);
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
  const label = online ? "Online" : view.state === "loading" ? "Connecting" : "Offline";

  return (
    <section
      aria-label="NeuroCore runtime status"
      aria-live="polite"
      className="w-full min-w-0 rounded-xl border border-border bg-surface/80 px-3 py-2 text-xs sm:w-auto sm:min-w-[210px]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {online ? <Activity className="size-3.5 text-emerald-400" /> : <WifiOff className="size-3.5 text-amber-400" />}
          <span className="font-medium text-fg">Runtime</span>
          <span className={online ? "text-emerald-400" : "text-muted"}>{label}</span>
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
          <span>Memory</span><span className="tabular-nums text-right text-fg">{Number(view.value.memoryCount ?? 0).toLocaleString()}</span>
          <span>Last action</span><span className="truncate text-right text-fg">{view.value.lastAction ?? "unknown"}</span>
        </div>
      ) : (
        <p className="mt-1 max-w-[260px] break-words text-[10px] leading-relaxed text-muted">
          {view.state === "loading" ? "Reading live organism status…" : view.message}
        </p>
      )}
      <p className="mt-1 text-right text-[9px] text-subtle">
        {view.state === "loading" ? "No runtime metrics yet" : `Checked ${new Date(view.checkedAt).toLocaleTimeString()}`}
      </p>
    </section>
  );
}
