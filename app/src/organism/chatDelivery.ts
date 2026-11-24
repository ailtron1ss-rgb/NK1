import type { ChatTurn } from "./types";

export type ChatDeliveryStatus = "sending" | "sent" | "unknown";

/** Update only the matching user turn; unrelated or legacy turns stay untouched. */
export function withChatDeliveryStatus(
  turns: ChatTurn[],
  turnId: string,
  delivery: ChatDeliveryStatus,
): ChatTurn[] {
  return turns.map((turn) =>
    turn.id === turnId && turn.role === "user" ? { ...turn, delivery } : turn
  );
}
