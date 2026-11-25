import assert from "node:assert/strict";
import test from "node:test";
import { filterUiCommands, nextUiCommandIndex } from "../src/organism/commandPalette.ts";

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


test("keyboard navigation wraps and skips disabled commands", () => {
  const items = [
    { id: "a", title: "A", keywords: [], disabled: false },
    { id: "b", title: "B", keywords: [], disabled: true },
    { id: "c", title: "C", keywords: [], disabled: false },
  ];
  assert.equal(nextUiCommandIndex(items, 0, 1), 2);
  assert.equal(nextUiCommandIndex(items, 2, 1), 0);
  assert.equal(nextUiCommandIndex(items, 0, -1), 2);
});

test("keyboard navigation returns no selection when all commands are disabled", () => {
  assert.equal(nextUiCommandIndex([{ id: "a", title: "A", keywords: [], disabled: true }], 0, 1), -1);
  assert.equal(nextUiCommandIndex([], 0, 1), -1);
});
