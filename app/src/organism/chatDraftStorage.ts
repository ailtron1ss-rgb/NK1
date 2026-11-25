export interface ChatDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CHAT_DRAFT_STORAGE_KEY = "neuro-kurisu-chat-draft-v1";
const MAX_DRAFT_LENGTH = 4_000;

export function readPersistentChatDraft(storage: ChatDraftStorage | null): string {
  try {
    const value = storage?.getItem(CHAT_DRAFT_STORAGE_KEY);
    return typeof value === "string" ? value.slice(0, MAX_DRAFT_LENGTH) : "";
  } catch {
    return "";
  }
}

export function persistChatDraft(storage: ChatDraftStorage | null, draft: string): boolean {
  try {
    if (!storage) return false;
    const value = String(draft ?? "").slice(0, MAX_DRAFT_LENGTH);
    if (value.trim()) storage.setItem(CHAT_DRAFT_STORAGE_KEY, value);
    else storage.removeItem(CHAT_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    // Storage may be disabled or quota-limited; composing must continue to work.
    return false;
  }
}
