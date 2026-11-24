import { Activity, AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKurisu } from "@/organism/store";

const copy = {
  connecting: { label: "Connecting", detail: "Waiting for the canonical runtime.", icon: Activity },
  connected: { label: "Connected", detail: "The latest canonical snapshot is current.", icon: Wifi },
  degraded: { label: "Degraded", detail: "Showing the last confirmed snapshot.", icon: AlertTriangle },
  disconnected: { label: "Offline", detail: "No canonical snapshot is currently available.", icon: WifiOff },
} as const;

export function ConnectionStatus() {
  const connection = useKurisu((s) => s.connection);
  const refresh = useKurisu((s) => s.refresh);
  const state = copy[connection.status];
  const Icon = state.icon;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2" role="status" aria-live="polite" aria-label={state.detail}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted">
        <Icon className="size-3.5" aria-hidden="true" />
        {state.label}
      </span>
      {connection.serviceDegraded ? <span className="hidden text-[10px] text-amber-400 sm:inline">Language fallback</span> : null}
      {connection.version ? (
        <span className="hidden text-[10px] tabular-nums text-subtle sm:inline">
          {connection.version} · schema {connection.schemaVersion} · tick {connection.tick}
        </span>
      ) : null}
      {connection.lastSyncedAt ? (
        <span className="hidden text-[10px] text-subtle md:inline">
          {new Date(connection.lastSyncedAt).toLocaleTimeString()}
        </span>
      ) : null}
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => void refresh()} disabled={connection.status === "connecting"} aria-label="Refresh canonical runtime connection">
        <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
