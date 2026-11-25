export interface RuntimeRecoveryItem {
  id: string;
  action: string;
  status: string;
  reason: string | null;
  createdAt: number | null;
  outcome: string | null;
  raw: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 240);
  }
  return "";
}

function numberField(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function parseRuntimeRecovery(value: unknown): RuntimeRecoveryItem[] {
  const root = isRecord(value) ? value : {};
  const recovery = root.recovery;
  const rows = Array.isArray(recovery)
    ? recovery
    : isRecord(recovery)
      ? Array.isArray(recovery.items) ? recovery.items
        : Array.isArray(recovery.queue) ? recovery.queue
          : Array.isArray(recovery.pending) ? recovery.pending : []
      : [];
  return rows.slice(0, 64).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const id = textField(raw, ["id", "actionId", "operationId"]) || "recovery-" + index;
    return [{
      id: id.slice(0, 160),
      action: textField(raw, ["action", "toolId", "operation", "kind"]) || "Unknown action",
      status: textField(raw, ["status", "state", "phase"]) || "unknown",
      reason: textField(raw, ["reason", "reasonCode", "error"]) || null,
      createdAt: numberField(raw, ["createdAt", "created_at", "at"]),
      outcome: textField(raw, ["outcomeClass", "outcome", "resolution"]) || null,
      raw,
    }];
  });
}

export function safeRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function readFiniteMetric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
