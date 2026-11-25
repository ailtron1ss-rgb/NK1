import type { ChatTurn, EmotionLabel, OptionKind } from "./types";

export interface ChatCacheStorage {
  setItem(key: string, value: string): void;
}

export const CHAT_CACHE_KEY = "neuro-kurisu-chat-v2";
const MAX_CHAT_TURNS = 120;
const MAX_CHAT_TEXT = 12_000;
const MAX_CHAT_ID = 200;
const EMOTIONS = new Set<EmotionLabel>([
  "curiosity", "calm", "joy", "anxiety", "frustration", "sadness", "anger", "protective",
]);
const OPTIONS = new Set<OptionKind>(["respond", "explore", "verify", "rest", "reflect", "wait"]);

function restoreTurn(value: unknown): ChatTurn | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id.trim() || raw.id !== raw.id.trim() || raw.id.length > MAX_CHAT_ID) return null;
  if (raw.role !== "user" && raw.role !== "kurisu") return null;
  if (typeof raw.text !== "string") return null;
  const text = raw.text.replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, "").slice(0, MAX_CHAT_TEXT);
  if (!text.trim()) return null;
  if (!Number.isSafeInteger(raw.at) || Number(raw.at) < 0) return null;
  if (!Number.isSafeInteger(raw.tick) || Number(raw.tick) < 0) return null;

  const turn: ChatTurn = {
    id: raw.id,
    role: raw.role,
    text,
    at: Number(raw.at),
    tick: Number(raw.tick),
  };
  if (typeof raw.emotion === "string" && EMOTIONS.has(raw.emotion as EmotionLabel)) {
    turn.emotion = raw.emotion as EmotionLabel;
  }
  if (typeof raw.option === "string" && OPTIONS.has(raw.option as OptionKind)) {
    turn.option = raw.option as OptionKind;
  }
  if (typeof raw.backend === "string" && raw.backend.length <= 160) {
    turn.backend = raw.backend;
  }
  return turn;
}

/** Restore only valid, bounded chat turns from the browser's untrusted local cache. */
export function restoreChatCache(serialized: string | null): ChatTurn[] {
  if (typeof serialized !== "string" || !serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    const restored = parsed.slice(-MAX_CHAT_TURNS)
      .map(restoreTurn)
      .filter((turn): turn is ChatTurn => turn !== null);
    const seen = new Set<string>();
    return restored.filter((turn) => {
      if (seen.has(turn.id)) return false;
      seen.add(turn.id);
      return true;
    });
  } catch {
    return [];
  }
}

/** Persist the bounded chat transcript. False means a later delivery attempt is required. */
export function persistChatCache(storage: ChatCacheStorage | null, chat: readonly unknown[]): boolean {
  try {
    if (!storage || typeof storage.setItem !== "function" || !Array.isArray(chat)) return false;
    const serialized = JSON.stringify(chat.slice(-MAX_CHAT_TURNS));
    if (typeof serialized !== "string") return false;
    storage.setItem(CHAT_CACHE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * The proactive delivery ACK is a commit after the local transcript write.
 * Storage failure prevents ACK; transport failure leaves the persisted stable
 * turn available for idempotent retry when the server lease expires. A resolved
 * HTTP request is not sufficient: the server must confirm acknowledged=true.
 */
export async function persistChatBeforeAcknowledge(
  storage: ChatCacheStorage | null,
  chat: readonly unknown[],
  acknowledge: () => Promise<unknown>,
): Promise<boolean> {
  if (!persistChatCache(storage, chat)) return false;
  try {
    const receipt = await acknowledge();
    if (!receipt || typeof receipt !== "object") return false;
    const result = receipt as { ok?: unknown; acknowledged?: unknown };
    return result.ok === true && result.acknowledged === true;
  } catch {
    return false;
  }
}
