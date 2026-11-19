import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readAvatarPreference, writeAvatarPreference } from "./safeLocalStorage.ts";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

/** @param {unknown} value */
function setWindow(value) {
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value });
}
function restoreWindow() {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
}

test("avatar preference reads fail closed when storage is unavailable", () => {
  try {
    Reflect.deleteProperty(globalThis, "window");
    assert.equal(readAvatarPreference("profile"), null);
    Object.defineProperty(globalThis, "window", { configurable: true, get() { throw new Error("blocked"); } });
    assert.equal(readAvatarPreference("profile"), null);
    assert.equal(writeAvatarPreference("profile", "formal"), false);
  } finally { restoreWindow(); }
});

test("avatar preference reads and writes tolerate storage exceptions", () => {
  try {
    setWindow({ localStorage: {
      getItem() { throw new Error("read denied"); },
      setItem() { throw new Error("write denied"); },
    } });
    assert.equal(readAvatarPreference("profile"), null);
    assert.equal(writeAvatarPreference("profile", "formal"), false);
  } finally { restoreWindow(); }
});

test("avatar preference persists when storage works", () => {
  /** @type {Map<string, string>} */
  const values = new Map();
  try {
    setWindow({ localStorage: {
      /** @param {string} key */
      getItem(key) { return values.get(key) ?? null; },
      /** @param {string} key @param {string} value */
      setItem(key, value) { values.set(key, value); },
    } });
    assert.equal(readAvatarPreference("profile"), null);
    assert.equal(writeAvatarPreference("profile", "formal"), true);
    assert.equal(readAvatarPreference("profile"), "formal");
  } finally { restoreWindow(); }
});

test("LegacySpriteDeck routes optional outfit persistence through the safe adapter", async () => {
  const component = await readFile(new URL("./LegacySpriteDeck.tsx", import.meta.url), "utf8");
  assert.match(component, /import \{ readAvatarPreference, writeAvatarPreference \} from "\.\/safeLocalStorage"/);
  assert.match(component, /readAvatarPreference\("kurisu-visual-profile"\)/);
  assert.match(component, /writeAvatarPreference\("kurisu-visual-profile", outfit\)/);
  assert.doesNotMatch(component, /window\.localStorage\.(?:getItem|setItem)/);
});

test("AvatarStage routes mode and voice preferences through the safe adapter", async () => {
  const component = await readFile(new URL("../../components/AvatarStage.tsx", import.meta.url), "utf8");
  assert.match(component, /import \{ readAvatarPreference, writeAvatarPreference \} from "@\/legacy\/avatar\/safeLocalStorage"/);
  for (const key of ["kurisu-avatar-mode", "kurisu-avatar-voice-enabled", "kurisu-avatar-voice-name"]) {
    assert.ok(component.includes(`readAvatarPreference("${key}")`) || component.includes(`writeAvatarPreference("${key}",`),
      `AvatarStage must route ${key} through the safe adapter`);
  }
  assert.doesNotMatch(component, /window\.localStorage\.(?:getItem|setItem)/);
});
