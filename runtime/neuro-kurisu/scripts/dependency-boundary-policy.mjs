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

      if (hasPathSegment(dep, "research")) {
        violations.push({
          rule: "canonical-core-to-research",
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

  // Browser/application implementation must use the public API rather than
  // directly importing runtime source. Tests are not included in appSourceRoot.
  for (const from of files.filter(file => isWithin(file, appSourceRoot))) {
    for (const dep of graph.get(from) ?? []) {
      if (isWithin(dep, path.join(root, "src"))) {
        violations.push({
          rule: "app-source-to-runtime-private-import",
          from: path.relative(root, from),
          to: path.relative(root, dep),
        });
      }
    }
  }

  return violations;
}
