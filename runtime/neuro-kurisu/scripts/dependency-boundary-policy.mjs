import path from "node:path";

const isWithin = (file, directory) => {
  const relative = path.relative(directory, file);
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative)
  );
};

const hasPathSegment = (file, segment) =>
  path.normalize(file).split(path.sep).includes(segment);

const PUBLIC_CONTRACT_PREFIX = path.join("src", "organism", "contracts") + path.sep;
const APP_RUNTIME_BRIDGES = new Map([
  [
    "../../app/src/components/avatar/browserVoiceProsody.ts",
    new Set([
      "src/organism/body/VoiceEmbodiment.ts",
      "src/organism/body/EmbodiedBody.ts",
    ]),
  ],
]);

/**
 * Pure policy for disallowed module edges. Paths in files and graph must be
 * absolute, normalized paths, matching Node's path.resolve() output.
 */
export function collectDependencyBoundaryViolations({
  root,
  files,
  graph,
  canonicalRoot,
  appSourceRoot,
  appServerRoot,
  runtimeServerRoot,
}) {
  const canonicalFiles = files.filter(file => isWithin(file, canonicalRoot));
  const violations = [];
  const forbiddenCoreTargets = [
    ["app-source", appSourceRoot],
    ["app-server", appServerRoot],
    ["runtime-server", runtimeServerRoot],
  ];

  for (const from of canonicalFiles) {
    for (const dep of graph.get(from) ?? []) {
      const fromPath = path.relative(root, from);
      const toPath = path.relative(root, dep);

      for (const [boundary, targetRoot] of forbiddenCoreTargets) {
        if (isWithin(dep, targetRoot)) {
          violations.push({
            rule: "canonical-core-to-outward-layer",
            boundary,
            from: fromPath,
            to: toPath,
          });
        }
      }

      const runtimeResearchRoot = path.join(canonicalRoot, "research");
      if (hasPathSegment(dep, "research") && !isWithin(dep, runtimeResearchRoot)) {
        violations.push({
          rule: "canonical-core-to-external-research",
          from: fromPath,
          to: toPath,
        });
      }

      if (hasPathSegment(dep, "legacy") || hasPathSegment(dep, "legacy-original")) {
        violations.push({
          rule: "canonical-core-to-legacy",
          from: fromPath,
          to: toPath,
        });
      }
    }
  }

  // App source may import public organism contracts. A two-edge compatibility
  // bridge is kept only for the browser voice adapter: one pure planner and
  // one body-state type. No other app source receives this exception.
  for (const from of files.filter(file => isWithin(file, appSourceRoot))) {
    const fromPath = path.relative(root, from);
    const allowedTargets = APP_RUNTIME_BRIDGES.get(fromPath) ?? new Set();

    for (const dep of graph.get(from) ?? []) {
      const toPath = path.relative(root, dep);
      const insideRuntimeSource = isWithin(dep, path.join(root, "src"));
      const publicContract = toPath.startsWith(PUBLIC_CONTRACT_PREFIX);
      const explicitlyAllowedBridge = allowedTargets.has(toPath);

      if (insideRuntimeSource && !publicContract && !explicitlyAllowedBridge) {
        violations.push({
          rule: "app-source-to-runtime-private-import",
          from: fromPath,
          to: toPath,
        });
      }
    }
  }

  return violations;
}
