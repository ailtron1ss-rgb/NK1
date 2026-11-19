import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runtimeRoot = fileURLToPath(new URL("..", import.meta.url));
const coreRoot = path.join(runtimeRoot, "src/organism/core");
const wrapperPath = path.join(coreRoot, "DevelopmentalNeuralRuntime.ts");
const groups = [
  ["Learning", "createDevelopmentalLearningInstances"],
  ["Causal", "createDevelopmentalCausalInstances"],
  ["Predictive", "createDevelopmentalPredictiveInstances"],
  ["LifeCourse", "createDevelopmentalLifeCourseInstances"],
];

async function readGroup(name) {
  const file = path.join(coreRoot, "DevelopmentalInstanceGroup" + name + ".ts");
  return { file, source: await readFile(file, "utf8") };
}

test("developmental runtime preserves all 135 public constructor-backed properties via owned groups", async () => {
  const wrapper = await readFile(wrapperPath, "utf8");
  assert.match(wrapper, /export class DevelopmentalNeuralRuntime\s*\{/);
  assert.doesNotMatch(wrapper, /^\s*readonly\s+[A-Za-z_$]\w*\s*=\s*new\s+/m);

  const declared = [...wrapper.matchAll(
    /^\s*readonly\s+([A-Za-z_$]\w*)\s*:\s*(createDevelopmental[A-Za-z_$]\w*InstancesResult)\["([A-Za-z_$]\w*)"\]\s*=\s*undefined as unknown as\s*\2\["\3"\];$/gm,
  )].map(match => {
    assert.equal(match[1], match[3], "field declaration and group key must match");
    return { field: match[1], resultAlias: match[2] };
  });
  assert.equal(declared.length, 135, "the wrapper must preserve all constructor-backed fields");
  assert.equal(new Set(declared.map(item => item.field)).size, declared.length, "field names must be unique");

  const constructorStart = wrapper.indexOf("  constructor() {");
  const firstField = wrapper.indexOf("  readonly ");
  assert.ok(constructorStart >= 0 && firstField > constructorStart, "group initialization must occur in the constructor");
  const constructor = wrapper.slice(constructorStart, firstField);
  const groupedFields = [];

  for (const [name, factory] of groups) {
    const group = await readGroup(name);
    const keys = [...group.source.matchAll(/^\s{2}([A-Za-z_$]\w*):\s*new\s+/gm)].map(match => match[1]);
    assert.ok(keys.length > 0, "group " + name + " must own constructor-backed fields");
    assert.equal(new Set(keys).size, keys.length, "duplicate constructor field in group " + name);
    groupedFields.push(...keys);

    assert.match(wrapper, new RegExp("import \\{\\s*" + factory + "\\s*\\} from ['\"]\\.\\/DevelopmentalInstanceGroup" + name + "\\.ts['\"]"));
    assert.equal([...constructor.matchAll(new RegExp("\\b" + factory + "\\s*\\(\\)", "g"))].length, 1,
      "constructor must initialize group " + name + " exactly once");

    const alias = factory + "Result";
    for (const key of keys) {
      assert.ok(
        declared.some(field => field.field === key && field.resultAlias === alias),
        "public field " + key + " must be typed by its owning group " + name,
      );
    }

    const syntax = spawnSync(process.execPath, ["--experimental-strip-types", "--check", group.file], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    assert.equal(syntax.status, 0, "group syntax check failed: " + group.file + "\n" + syntax.stderr);
  }

  assert.deepEqual(groupedFields, declared.map(item => item.field),
    "group constructor evaluation order must match the public property order");
  const wrapperSyntax = spawnSync(process.execPath, ["--experimental-strip-types", "--check", wrapperPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  assert.equal(wrapperSyntax.status, 0, "wrapper syntax check failed:\n" + wrapperSyntax.stderr);
});

