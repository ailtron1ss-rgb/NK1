export interface MemoryExplorerItem {
  id: string;
  kind: string;
  text: string;
  source: string | null;
  confidence: number | null;
  salience: number | null;
  createdAt: number | null;
  provenance: string | null;
  raw: Record<string, unknown>;
}

export interface MemoryExplorerResult {
  query: string;
  temporalMode: string;
  note: string | null;
  semantic: unknown;
  memories: MemoryExplorerItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstText(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 4000);
  }
  return "";
}

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function provenanceText(value: unknown): string | null {
  if (typeof value === "string") return value.trim().slice(0, 500) || null;
  if (!isRecord(value)) return null;
  const source = firstText(value, ["source", "origin", "provider", "uri", "path"]);
  const ref = firstText(value, ["id", "ref", "eventId", "turnId"]);
  return [source, ref].filter(Boolean).join(" · ").slice(0, 500) || null;
}

/** Safely project the server's read-only MemoryOS2 inspector response into UI rows. */
export function parseMemoryExplorerResponse(value: unknown): MemoryExplorerResult {
  const root = isRecord(value) ? value : {};
  const rows = Array.isArray(root.memories) ? root.memories : [];
  const memories: MemoryExplorerItem[] = rows.slice(0, 32).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const text = firstText(raw, ["summary", "text", "content", "claim", "experience", "description", "value"]);
    if (!text) return [];
    const id = firstText(raw, ["id", "memoryId", "key"]) || "memory-row-" + index;
    const kind = firstText(raw, ["kind", "type", "tier", "memoryType"]) || "unknown";
    const source = firstText(raw, ["source", "origin", "provider"]) || null;
    const provenance = provenanceText(raw.provenance ?? raw.evidence ?? raw.reference);
    return [{
      id: id.slice(0, 160),
      kind: kind.slice(0, 80),
      text,
      source: source?.slice(0, 240) ?? null,
      confidence: finite(raw.confidence ?? raw.confidence01),
      salience: finite(raw.salience ?? raw.salience01),
      createdAt: finite(raw.createdAt ?? raw.created_at ?? raw.at),
      provenance,
      raw,
    }];
  });
  return {
    query: firstText(root, ["query"]),
    temporalMode: firstText(root, ["temporalMode"]) || "current",
    note: firstText(root, ["note"]) || null,
    semantic: root.semantic ?? null,
    memories,
  };
}
