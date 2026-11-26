import { Activity, AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKurisu } from "@/organism/store";
import { UI_CONNECTION_STATUS_LABELS } from "@/organism/uiLabels";

const copy = {
  connecting: { detail: "Ожидаем подтверждения канонического runtime.", icon: Activity },
  connected: { detail: "Последний канонический снимок актуален.", icon: Wifi },
  degraded: { detail: "Показан последний подтверждённый снимок.", icon: AlertTriangle },
  disconnected: { detail: "Канонический снимок сейчас недоступен.", icon: WifiOff },
} as const;

export function ConnectionStatus() {
  const connection = useKurisu((s) => s.connection);
  const refresh = useKurisu((s) => s.refresh);
  const state = { ...copy[connection.status], label: UI_CONNECTION_STATUS_LABELS[connection.status] };
  const Icon = state.icon;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2" role="status" aria-live="polite" aria-label={state.detail}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted">
        <Icon className="size-3.5" aria-hidden="true" />
        {state.label}
      </span>
      {connection.serviceDegraded ? <span className="hidden text-[10px] text-amber-400 sm:inline">Резервный языковой провайдер</span> : null}
      {connection.version ? (
        <span className="hidden text-[10px] tabular-nums text-subtle sm:inline">
          {connection.version} · схема {connection.schemaVersion} · такт {connection.tick}
        </span>
      ) : null}
      {connection.lastSyncedAt ? (
        <span className="hidden text-[10px] text-subtle md:inline">
          {new Date(connection.lastSyncedAt).toLocaleTimeString()}
        </span>
      ) : null}
      <Button type="button" size="sm" variant="ghost" className="min-h-11 px-3" onClick={() => void refresh()} disabled={connection.status === "connecting"} aria-label="Повторить подключение к каноническому runtime">
        <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
        Повторить
      </Button>
    </div>
  );
}
