export interface ChatCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CHAT_CACHE_KEY = "neuro-kurisu-chat-v2";
export const PROACTIVE_ACKED_CACHE_KEY = "neuro-kurisu-proactive-acked-v1";
const MAX_CHAT_TURNS = 120;
const MAX_ACKED_IDS = 120;
const INITIATIVE_TURN_PREFIX = "ui-initiative-";

function safeInitiativeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return /^[A-Za-z0-9:._-]{1,160}$/u.test(clean) ? clean : null;
}

function isPositiveAck(result: unknown): boolean {
  if (result === true) return true;
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const value = result as Record<string, unknown>;
  return value.ok === true && value.acknowledged === true;
}

function loadAcknowledgedIds(storage: ChatCacheStorage | null): Set<string> {
  try {
    if (!storage || typeof storage.getItem !== "function") return new Set();
    const raw = JSON.parse(storage.getItem(PROACTIVE_ACKED_CACHE_KEY) || "[]");
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.map(safeInitiativeId).filter((id): id is string => Boolean(id)).slice(-MAX_ACKED_IDS));
  } catch {
    return new Set();
  }
}

function rememberAcknowledged(storage: ChatCacheStorage | null, initiativeId: string): boolean {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    const ids = loadAcknowledgedIds(storage);
    ids.add(initiativeId);
    storage.setItem(PROACTIVE_ACKED_CACHE_KEY, JSON.stringify([...ids].slice(-MAX_ACKED_IDS)));
    return true;
  } catch {
    return false;
  }
}

function persistedInitiativeIds(chat: readonly unknown[]): string[] {
  const found = new Set<string>();
  for (const turn of chat.slice(-MAX_CHAT_TURNS)) {
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) continue;
    const row = turn as Record<string, unknown>;
    const turnId = typeof row.id === "string" ? row.id : "";
    const backend = typeof row.backend === "string" ? row.backend : "";
    if (!turnId.startsWith(INITIATIVE_TURN_PREFIX) || !backend.startsWith("autonomous-initiative:")) continue;
    const initiativeId = safeInitiativeId(turnId.slice(INITIATIVE_TURN_PREFIX.length));
    if (initiativeId) found.add(initiativeId);
  }
  return [...found];
}

/** Persist a bounded transcript. False keeps the server delivery unacknowledged. */
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

/** Write transcript first, then ACK; remember only a positive server acknowledgement. */
export async function persistChatBeforeAcknowledge(
  storage: ChatCacheStorage | null,
  chat: readonly unknown[],
  initiativeId: string,
  acknowledge: (initiativeId: string) => Promise<unknown>,
): Promise<boolean> {
  const safeId = safeInitiativeId(initiativeId);
  if (!safeId || !persistChatCache(storage, chat)) return false;
  if (loadAcknowledgedIds(storage).has(safeId)) return true;
  try {
    if (!isPositiveAck(await acknowledge(safeId))) return false;
    return rememberAcknowledged(storage, safeId);
  } catch {
    return false;
  }
}

/** Retry ACKs from the durable local transcript after an HTTP response was lost. */
export async function retryPersistedProactiveAcks(
  storage: ChatCacheStorage | null,
  chat: readonly unknown[],
  acknowledge: (initiativeId: string) => Promise<unknown>,
): Promise<number> {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return 0;
  const acknowledged = loadAcknowledgedIds(storage);
  let repaired = 0;
  for (const initiativeId of persistedInitiativeIds(chat)) {
    if (acknowledged.has(initiativeId)) continue;
    try {
      if (!isPositiveAck(await acknowledge(initiativeId))) continue;
      if (!rememberAcknowledged(storage, initiativeId)) break;
      acknowledged.add(initiativeId);
      repaired += 1;
    } catch {
      // Leave the stable turn unacknowledged so a later idle poll can retry.
    }
  }
  return repaired;
}
