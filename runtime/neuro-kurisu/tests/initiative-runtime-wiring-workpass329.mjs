import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../src/organism/core/OrganismRuntime.ts", import.meta.url), "utf8");

test("spontaneous dialogue imports and evaluates the bounded initiative policy", () => {
  assert.match(runtime, /import\s+\{\s*evaluateInitiative\s*\}\s+from\s+['"]\.\.\/extensions\/motivation\/InitiativePolicy\.ts['"]/);
  const gateAt = runtime.indexOf("const initiativeDecision = !externalText && options.spontaneous");
  const reservationAt = runtime.indexOf("this.core.autonomousSocialInitiativeForGeneration()", gateAt);
  assert.ok(gateAt >= 0 && reservationAt > gateAt, "policy must gate the Core initiative reservation");
  assert.match(runtime.slice(gateAt, reservationAt), /energy:\s*body\.bodyEnergy01/);
  assert.match(runtime.slice(gateAt, reservationAt), /threat:\s*Math\.max\(body\.thermalStrain01/);
  assert.match(runtime.slice(gateAt, reservationAt), /cycle\.state\.needs\.novelty/);
});

test("deferred initiative decisions are observable and Core retains durable reservation", () => {
  const gateAt = runtime.indexOf("const initiativeDecision = !externalText && options.spontaneous");
  const after = runtime.slice(gateAt, gateAt + 2600);
  assert.match(after, /if\s*\(!externalText && options\.spontaneous && initiativeDecision && !initiativeDecision\.allowed\)/);
  assert.match(after, /source:\s*'initiative-policy'/);
  assert.match(after, /this\.core\.autonomousSocialInitiativeForGeneration\(\)/);
  assert.match(after, /Persistent cooldown is enforced by Core's initiative reservation/);
});
