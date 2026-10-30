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
assert.equal(gateway.listTools().find(x => x.id === "catalog.search")?.inputSchema?.type, "object");
assert.deepEqual(gateway.listTools().map(x => x.id), [...gateway.listTools().map(x => x.id)].sort());
gateway.registerTool({
  id: "catalog.short-code",
  capability: "catalog.read",
  destructive: false,
  inputContract: { type: "object", properties: { code: { type: "string", pattern: "^[a-z]{2,5}$" } }, required: ["code"], additionalProperties: false },
  execute: async input => ({ ok: true, code: input.code }),
});
assert.equal((await gateway.executeTool("catalog.short-code", { code: "nk1" })).ok, true, "bounded quantifiers remain supported in safe patterns");
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
let proxyTraps = 0;
const hostileProxy = new Proxy({ query: "nk1" }, { getPrototypeOf() { proxyTraps++; throw new Error("proxy-trap-must-not-run"); } });
assert.equal((await gateway.executeTool("catalog.search", hostileProxy)).result.error, "tool-input-invalid");
assert.equal(proxyTraps, 0, "Proxy values must be rejected before invoking traps");
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
assert.throws(() => gateway.registerTool({
  id: "catalog.catastrophic-pattern", capability: "catalog.read", destructive: false,
  inputContract: { type: "object", properties: { value: { type: "string", pattern: "^(a+)+$" } }, required: ["value"] },
  execute: async () => ({ ok: true }),
}), /multiple-pattern-repetitions|unsupported-pattern-construct/);
assert.throws(() => gateway.registerTool({
  id: "catalog.two-repeats", capability: "catalog.read", destructive: false,
  inputContract: { type: "object", properties: { value: { type: "string", pattern: "^[a-z]+[0-9]+$" } }, required: ["value"] },
  execute: async () => ({ ok: true }),
}), /multiple-pattern-repetitions/);

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

const outputGateway = new ActionGateway();
let outputLedgerWrites = 0, outputExecutions = 0;
outputGateway.setExecutionLedgerPersister(async () => { outputLedgerWrites++; });
outputGateway.registerTool({
  id: "catalog.output-check",
  capability: "catalog.write",
  destructive: false,
  requiresIdempotencyKey: true,
  inputContract: { type: "object", properties: { key: { type: "string", minLength: 3, maxLength: 24 } }, required: ["key"], additionalProperties: false },
  outputContract: { type: "object", properties: { ok: { type: "boolean" }, receipt: { type: "string", minLength: 4 } }, required: ["ok", "receipt"], additionalProperties: false },
  execute: async () => { outputExecutions++; return { ok: true, receipt: 42 }; },
});
const invalidOutput = await outputGateway.executeTool("catalog.output-check", { key: "abc" }, "output-contract-test", { idempotencyKey: "workpass625-output-1" });
assert.equal(invalidOutput.outcomeClass, "executed-unverified");
assert.equal(invalidOutput.result.error, "tool-output-invalid");
assert.equal(invalidOutput.verified, false);
assert.equal(outputExecutions, 1, "output validation must run after executor entry");
const outputReplay = await outputGateway.executeTool("catalog.output-check", { key: "abc" }, "output-contract-test", { idempotencyKey: "workpass625-output-1" });
assert.equal(outputReplay.idempotentReplay, true);
assert.equal(outputExecutions, 1, "output-invalid keyed effects must replay, never execute twice");
assert.ok(outputLedgerWrites >= 2);

let schemaProxyTraps = 0;
const badSchemaProxy = new Proxy({ type: "object" }, { getPrototypeOf() { schemaProxyTraps++; throw new Error("schema-proxy-trap-must-not-run"); } });
assert.throws(() => mutator.registerTool({ id: "catalog.proxy-schema", capability: "catalog.read", destructive: false, inputContract: badSchemaProxy, execute: async () => ({ ok: true }) }), /invalid-tool-input-contract/);
assert.equal(schemaProxyTraps, 0);

assert.throws(() => mutator.registerTool({
  id: "catalog.bad-array", capability: "catalog.read", destructive: false,
  inputContract: { type: "object", properties: { items: { type: "array" } } },
  execute: async () => ({ ok: true }),
}), /array-items-required/);

// Legacy tools without a per-tool schema still cross the shared inert-JSON envelope.
let legacyCalls = 0;
const legacyGateway = new ActionGateway({ live: true });
legacyGateway.setExecutionLedgerPersister(async () => {});
legacyGateway.registerTool({
  id: "fixture.legacy.safe",
  capability: "catalog.read",
  destructive: false,
  execute: async () => { legacyCalls += 1; return { ok: true }; },
});
let legacyGetterCalls = 0;
const accessorInput = {};
Object.defineProperty(accessorInput, "query", { enumerable: true, get() { legacyGetterCalls += 1; return "side-effect"; } });
const accessorResult = await legacyGateway.executeTool("fixture.legacy.safe", accessorInput);
assert.equal(accessorResult.outcomeClass, "gate-check-failed");
assert.equal(accessorResult.result.error, "tool-input-invalid");
assert.equal(legacyGetterCalls, 0, "input validation must inspect descriptors without invoking getters");
assert.equal(legacyCalls, 0, "unsafe legacy inputs must be rejected before executor entry");

let legacyProxyTraps = 0;
const proxyInput = new Proxy({}, { getPrototypeOf() { legacyProxyTraps += 1; throw new Error("proxy-trap"); } });
const proxyResult = await legacyGateway.executeTool("fixture.legacy.safe", proxyInput);
assert.equal(proxyResult.result.error, "tool-input-invalid");
assert.equal(legacyProxyTraps, 0, "proxy detection must happen before reflective traps");

const cyclicInput = {};
cyclicInput.self = cyclicInput;
assert.equal((await legacyGateway.executeTool("fixture.legacy.safe", cyclicInput)).result.error, "tool-input-invalid");
assert.equal((await legacyGateway.executeTool("fixture.legacy.safe", { payload: "x".repeat(70_000) })).result.error, "tool-input-invalid");
assert.equal(legacyCalls, 0);

// Approval previews and fingerprints are another trust boundary: they must not execute getters.
let approvalGetterCalls = 0;
const approvalInput = {};
Object.defineProperty(approvalInput, "target", { enumerable: true, get() { approvalGetterCalls += 1; return "recipient"; } });
await assert.rejects(
  legacyGateway.requestToolApproval("http.integration.outbound", approvalInput, "unsafe-preview", {}, "direct"),
  /approval-input-invalid/,
);
assert.equal(approvalGetterCalls, 0, "approval preview must reject accessors before reading values");

// Reconciliation is also a public ingress and must not hash or query providers with unsafe input.
const reconcileResult = await legacyGateway.reconcileToolExecution("fixture.legacy.safe", proxyInput, "unsafe-reconcile", { idempotencyKey: "reconcile-key" });
assert.equal(reconcileResult.result.error, "reconciliation-input-invalid");
assert.equal(legacyProxyTraps, 0);

// Governance coverage is observable without silently changing legacy registration behavior.
legacyGateway.registerTool({
  id: "fixture.code.modify",
  capability: "code.modify",
  destructive: true,
  execute: async () => ({ ok: true }),
});
const governance = legacyGateway.toolGovernanceReport();
assert.equal(governance.version, 1);
assert.ok(governance.totals.registered >= 2);
const mutatingTool = governance.tools.find(row => row.id === "fixture.code.modify");
assert.ok(mutatingTool);
assert.equal(mutatingTool.riskTier, "critical");
assert.equal(mutatingTool.required.inputContract, true);
assert.equal(mutatingTool.required.outputContract, true);
assert.equal(mutatingTool.required.independentVerifier, true);
assert.equal(mutatingTool.present.inputContract, false);
assert.ok(mutatingTool.gaps.includes("inputContract"));
assert.ok(mutatingTool.gaps.includes("outputContract"));
assert.ok(mutatingTool.gaps.includes("independentVerifier"));
assert.ok(governance.totals.withGaps >= 1);

console.log("TOOL_INPUT_CONTRACTS_WORKPASS624_PASS");
console.log("TOOL_INPUT_BOUNDARY_HARDENING_WORKPASS632_PASS");
console.log("TOOL_GOVERNANCE_COVERAGE_WORKPASS633_PASS");
console.log(JSON.stringify({ rejectedInputCases: bad.length + 6, validCalls: calls + mutations, outputExecutions, ledgerWrites, outputLedgerWrites }, null, 2));
