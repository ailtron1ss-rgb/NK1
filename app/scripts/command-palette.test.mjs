import assert from "node:assert/strict";
import test from "node:test";
import { filterUiCommands } from "../src/organism/commandPalette.ts";

const commands = [
  { id: "home", title: "Open home", keywords: ["avatar", "chat"] },
  { id: "memory", title: "Open memory", keywords: ["search", "recall", "facts"] },
  { id: "health", title: "Runtime health", keywords: ["status", "diagnostics", "recovery"] },
];

test("filters commands by title and keywords", () => {
  assert.deepEqual(filterUiCommands(commands, "recall").map(x => x.id), ["memory"]);
  assert.deepEqual(filterUiCommands(commands, "runtime").map(x => x.id), ["health"]);
});

test("normalizes case, whitespace and unicode compatibility forms", () => {
  assert.deepEqual(filterUiCommands(commands, "  MEMORY ").map(x => x.id), ["memory"]);
  assert.deepEqual(filterUiCommands(commands, "  ").map(x => x.id), ["home", "memory", "health"]);
});

test("does not mutate the command source", () => {
  const before = commands.slice();
  filterUiCommands(commands, "chat");
  assert.deepEqual(commands, before);
});
