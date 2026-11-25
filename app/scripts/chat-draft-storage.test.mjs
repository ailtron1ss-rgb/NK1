import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_DRAFT_STORAGE_KEY,
  persistChatDraft,
  readPersistentChatDraft,
} from "../src/organism/chatDraftStorage.ts";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test("persists a non-empty draft and restores it after remount", () => {
  const storage = memoryStorage();
  assert.equal(persistChatDraft(storage, "unfinished thought"), true);
  assert.equal(storage.values.get(CHAT_DRAFT_STORAGE_KEY), "unfinished thought");
  assert.equal(readPersistentChatDraft(storage), "unfinished thought");
});

test("clearing a delivered draft removes the saved value", () => {
  const storage = memoryStorage();
  persistChatDraft(storage, "sent");
  assert.equal(persistChatDraft(storage, ""), true);
  assert.equal(readPersistentChatDraft(storage), "");
});

test("bounds restored text and stored input to the composer limit", () => {
  const storage = memoryStorage();
  persistChatDraft(storage, "x".repeat(4500));
  assert.equal(readPersistentChatDraft(storage).length, 4000);
});

test("storage failures do not break the composer", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(readPersistentChatDraft(blocked), "");
  assert.equal(persistChatDraft(blocked, "safe in-memory draft"), false);
  assert.equal(readPersistentChatDraft(null), "");
  assert.equal(persistChatDraft(null, "draft"), false);
});
