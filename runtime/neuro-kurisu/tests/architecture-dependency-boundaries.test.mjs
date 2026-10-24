import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectDependencyBoundaryViolations } from "../scripts/dependency-boundary-policy.mjs";

const runtimeRoot = fileURLToPath(new URL("..", import.meta.url));
const auditor = fileURLToPath(new URL("../scripts/audit-architecture.mjs", import.meta.url));

function makePolicyFixture() {
  const root = path.resolve("/fixture/repository/runtime/neuro-kurisu");
  const canonicalRoot = path.join(root, "src", "organism");
  const appSourceRoot = path.resolve(root, "../../app/src");
  const appServerRoot = path.resolve(root, "../../app/server");
  const runtimeServerRoot = path.join(root, "src", "server");
  const core = path.join(canonicalRoot, "core", "Brain.ts");
  const safeContract = path.join(canonicalRoot, "contracts", "CognitivePorts.ts");
  const ui = path.join(appSourceRoot, "App.tsx");
  const runtimeServer = path.join(runtimeServerRoot, "server.mjs");
  const appServer = path.join(appServerRoot, "routes.mjs");
  const research = path.resolve(root, "../../research", "prototype", "index.mjs");
  const legacy = path.resolve(root, "../../legacy", "archive", "old-core.ts");

  const inspect = edges => collectDependencyBoundaryViolations({
    root,
    files: [core, safeContract, ui],
    graph: new Map([
      [core, edges],
      [safeContract, []],
      [ui, []],
    ]),
    canonicalRoot,
    appSourceRoot,
    appServerRoot,
    runtimeServerRoot,
  });

  return { inspect, core, safeContract, ui, runtimeServer, appServer, research, legacy };
}

test("dependency boundary policy permits core-to-contract imports", () => {
  const fixture = makePolicyFixture();
  assert.deepEqual(fixture.inspect([fixture.safeContract]), []);
});

test("dependency boundary policy reports each forbidden core edge", () => {
  const fixture = makePolicyFixture();
  const violations = fixture.inspect([
    fixture.ui,
    fixture.appServer,
    fixture.runtimeServer,
    fixture.research,
    fixture.legacy,
  ]);
  const signatures = new Set(violations.map(item => item.rule + ":" + (item.boundary ?? "")));

  assert.ok(signatures.has("canonical-core-to-outward-layer:app-source"));
  assert.ok(signatures.has("canonical-core-to-outward-layer:app-server"));
  assert.ok(signatures.has("canonical-core-to-outward-layer:runtime-server"));
  assert.ok(signatures.has("canonical-core-to-research:"));
  assert.ok(signatures.has("canonical-core-to-legacy:"));
});

test("dependency boundary policy rejects UI imports into private runtime source", () => {
  const fixture = makePolicyFixture();
  const graph = new Map([
    [fixture.core, []],
    [fixture.safeContract, []],
    [fixture.ui, [fixture.core]],
  ]);
  const root = path.resolve("/fixture/repository/runtime/neuro-kurisu");
  const violations = collectDependencyBoundaryViolations({
    root,
    files: [fixture.core, fixture.safeContract, fixture.ui],
    graph,
    canonicalRoot: path.join(root, "src", "organism"),
    appSourceRoot: path.resolve(root, "../../app/src"),
    appServerRoot: path.resolve(root, "../../app/server"),
    runtimeServerRoot: path.join(root, "src", "server"),
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "app-source-to-runtime-private-import");
});

test("full architecture audit enforces dependency boundaries on the current tree", () => {
  const result = spawnSync(process.execPath, [auditor], {
    cwd: runtimeRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(
    result.status,
    0,
    "architecture audit failed:\n" + String(result.stdout) + "\n" + String(result.stderr),
  );
  assert.match(result.stdout, /CLEAN_ARCHITECTURE=PASS/);
  assert.match(result.stdout, /dependencyEdges=\\d+/);
  assert.match(result.stdout, /boundaryViolations=0/);
  assert.doesNotMatch(result.stdout, /dependency boundary violations|canonical leakage|import cycles detected|missing relative imports/);
  console.log(result.stdout.trim());
});
