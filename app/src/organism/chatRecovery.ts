import type { ChatTurn } from "./types";

const DELIVERY_STATES = new Set(["sending", "sent", "rejected", "unknown"]);

/**
 * Browser reload destroys an in-flight request. Recover valid turns, mark
 * unresolved user sends as unknown, and discard malformed local cache rows.
 */
export function recoverPendingChatTurns(input: unknown[]): ChatTurn[] {
  return input.slice(-120).flatMap((raw): ChatTurn[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id.trim() || (row.role !== "user" && row.role !== "kurisu") || typeof row.text !== "string") return [];
    if (typeof row.at !== "number" || !Number.isFinite(row.at) || typeof row.tick !== "number" || !Number.isFinite(row.tick)) return [];
    const delivery = typeof row.delivery === "string" && DELIVERY_STATES.has(row.delivery) ? row.delivery as ChatTurn["delivery"] : undefined;
    const role = row.role;
    return [{
      id: row.id.slice(0, 180),
      role,
      text: row.text.slice(0, 4_000),
      at: row.at,
      tick: row.tick,
      ...(typeof row.emotion === "string" ? { emotion: row.emotion as ChatTurn["emotion"] } : {}),
      ...(typeof row.option === "string" ? { option: row.option as ChatTurn["option"] } : {}),
      ...(typeof row.backend === "string" ? { backend: row.backend.slice(0, 120) } : {}),
      ...(delivery ? { delivery: role === "user" && delivery === "sending" ? "unknown" : delivery } : {}),
    }];
  });
}
