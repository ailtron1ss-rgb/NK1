export interface ChatCacheStorage {
  setItem(key: string, value: string): void;
}

export const CHAT_CACHE_KEY = "neuro-kurisu-chat-v2";
const MAX_CHAT_TURNS = 120;

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
 * turn available for idempotent retry when the server lease expires.
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
