import assert from "node:assert/strict";
import { ActionGateway } from "../src/organism/system/ActionGateway.ts";

const contract = {
  type: "object",
  properties: {
    query: { type: "string", minLength: 2, maxLength: 64, pattern: "^[a-z0-9 ._-]+$" },
    limit: { type: "integer", minimum: 1, maximum: 10 },
    filters: { type: "object", properties: { kinds: { type: "array", minItems: 1, maxItems: 4, uniqueItems: true, items: { type: "string", minLength: 2, maxLength: 16 } } }, required: ["kinds"], additionalProperties: false, maxProperties: 1 },
  },
  required: ["query"],
  additionalProperties: false,
  maxProperties: 3,
  maxSerializedBytes: 1024,
};
const gateway = new ActionGateway();
let calls = 0;
gateway.registerTool({ id: "catalog.search", capability: "catalog.read", destructive: false, inputContract: contract, execute: async input => { calls++; return { ok: true, query: String(input.query) }; } });
assert.equal(gateway.listTools().find(x => x.id === "catalog.search")?.hasInputContract, true);
assert.equal((await gateway.executeTool("catalog.search", { query: "nk1 architecture", limit: 3, filters: { kinds: ["memory", "tool"] } })).ok, true);
assert.equal(calls, 1);

const bad = [
  [{ limit: 1 }, "required-property-missing"],
  [{ query: "x" }, "string-too-short"],
  [{ query: "A".repeat(70) }, "string-too-long"],
  [{ query: "NK1; DROP" }, "pattern-mismatch"],
  [{ query: "NK1", extra: true }, "additional-property"],
  [{ query: "NK1", limit: 11 }, "number-too-large"],
  [{ query: "NK1", filters: { kinds: ["ok", 42] } }, "type-mismatch"],
  [{ query: "NK1", limit: Number.NaN }, "number-not-finite"],
];
for (const [input, code] of bad) {
  const before = calls;
  const result = await gateway.executeTool("catalog.search", input, "contract-test");
  assert.equal(result.outcomeClass, "gate-check-failed");
  assert.equal(result.result.error, "tool-input-invalid");
  assert.ok(result.result.issues.some(issue => issue.code === code));
  assert.equal(calls, before);
}
let getterCalls = 0;
const accessor = { query: "NK1" };
Object.defineProperty(accessor, "limit", { enumerable: true, get() { getterCalls++; return 3; } });
assert.equal((await gateway.executeTool("catalog.search", accessor)).result.error, "tool-input-invalid");
assert.equal(getterCalls, 0);
const cycle = { query: "NK1" }; cycle.filters = cycle;
assert.equal((await gateway.executeTool("catalog.search", cycle)).result.error, "tool-input-invalid");
assert.equal(calls, 1);

const mutable = { type: "object", properties: { value: { type: "string", minLength: 2 } }, required: ["value"], additionalProperties: false };
gateway.registerTool({ id: "catalog.immutable-schema", capability: "catalog.read", destructive: false, inputContract: mutable, execute: async () => ({ ok: true }) });
mutable.properties.value.minLength = 40;
assert.equal((await gateway.executeTool("catalog.immutable-schema", { value: "ok" })).ok, true);

assert.throws(() => gateway.registerTool({
  id: "catalog.bad-schema", capability: "catalog.read", destructive: false,
  inputContract: { type: "object", properties: { value: { type: "string", pattern: "[" } }, required: ["value"] },
  execute: async () => ({ ok: true }),
}), /invalid-tool-input-contract/);

const mutator = new ActionGateway();
let ledgerWrites = 0, mutations = 0;
mutator.setExecutionLedgerPersister(async () => { ledgerWrites++; });
mutator.registerTool({
  id: "catalog.update", capability: "catalog.write", destructive: false, requiresIdempotencyKey: true,
  inputContract: { type: "object", properties: { key: { type: "string", minLength: 3, maxLength: 32, pattern: "^[a-z0-9._-]+$" } }, required: ["key"], additionalProperties: false },
  execute: async input => { mutations++; return { ok: true, key: input.key }; },
});
const invalidWrite = await mutator.executeTool("catalog.update", { key: "../bad", injected: true });
assert.equal(invalidWrite.result.error, "tool-input-invalid");
assert.equal(ledgerWrites, 0, "invalid write must not persist a pending receipt");
assert.equal(mutations, 0, "invalid write must not enter executor");
assert.equal((await mutator.executeTool("catalog.update", { key: "valid-key" })).outcomeClass, "idempotency-key-required");
assert.equal(ledgerWrites, 0);
const success = await mutator.executeTool("catalog.update", { key: "valid-key" }, "valid-write", { idempotencyKey: "workpass624-write-1" });
assert.equal(success.ok, true);
assert.equal(mutations, 1);
assert.ok(ledgerWrites >= 2);

assert.throws(() => mutator.registerTool({
  id: "catalog.bad-array", capability: "catalog.read", destructive: false,
  inputContract: { type: "object", properties: { items: { type: "array" } } },
  execute: async () => ({ ok: true }),
}), /array-items-required/);

console.log("TOOL_INPUT_CONTRACTS_WORKPASS624_PASS");
console.log(JSON.stringify({ rejectedInputCases: bad.length + 4, validCalls: calls + mutations, ledgerWrites }, null, 2));
