import type { ChatTurn } from "./types";

/** A browser reload destroys the pending network request; never leave a turn stuck at "sending". */
export function recoverPendingChatTurns(turns: ChatTurn[]): ChatTurn[] {
  return turns.map((turn) => {
    if (turn.role === "user" && turn.delivery === "sending") return { ...turn, delivery: "unknown" };
    return turn;
  });
}
