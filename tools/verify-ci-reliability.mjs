import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validateCiConfig({ workflows, nodeVersion }) {
  const errors = [];
  const pinnedNode = String(nodeVersion ?? "").trim();

  if (!/^(?:\d+|\d+\.\d+\.\d+)$/.test(pinnedNode)) {
    errors.push("Root .nvmrc must pin a Node.js major or exact version (for example 24 or 24.0.1).");
  }

  for (const [name, source] of Object.entries(workflows ?? {})) {
    const text = String(source ?? "");
    const actionPattern = /^\s*(?:-\s*)?uses:\s*actions\/(checkout|setup-node)@([^\s#]+)/gm;
    for (const match of text.matchAll(actionPattern)) {
      const actionName = match[1];
      const ref = match[2];
      const major = /^v(\d+)(?:\.\d+(?:\.\d+)?)?$/i.exec(ref);
      if (!major || Number(major[1]) < 7) {
        errors.push(`${name}: actions/${actionName}@${ref} is not an approved Node.js-24-compatible v7+ release tag; review non-tag refs separately.`);
      }
    }

    const enforceRuntimePin = name.endsWith("workpass71-validation.yml") ||
      name.endsWith("workpass79-cognitive-regression.yml");
    if (enforceRuntimePin && /uses:\s*actions\/setup-node@/m.test(text)) {
      if (!/node-version-file:\s*['"]?\.nvmrc['"]?/m.test(text)) {
        errors.push(name + ": setup-node must select the project runtime from root .nvmrc.");
      }
      if (!text.includes("expected=\"$(tr -d '[:space:]' < .nvmrc)\"") ||
          !text.includes('case "$expected" in') ||
          !text.includes("node --version") ||
          !text.includes('test "$actual" = "$expected"')) {
        errors.push(name + ": setup-node must be followed by a runtime assertion against .nvmrc.");
      }
    }


    if (/^  push:/m.test(text) && /^  pull_request:/m.test(text)) {
      const concurrencyBlock = /^concurrency:\s*\n((?:[ \t]+[^\n]*\n?)*)/m.exec(text)?.[1] ?? "";
      const cancelsSupersededRuns = /^\s*cancel-in-progress:\s*true\s*$/m.test(concurrencyBlock);
      const group = /^\s*group:\s*(.+)$/m.exec(concurrencyBlock)?.[1] ?? "";
      const reusesBranchFallback = group.includes("github.head_ref || github.ref_name");
      const eventScoped = group.includes("${{ github.event_name }}");
      const pullRequestScoped = group.includes("${{ github.event.pull_request.number");
      const fullRefScoped = group.includes("${{ github.ref }}");
      if (cancelsSupersededRuns && reusesBranchFallback &&
          !eventScoped && !pullRequestScoped && !fullRefScoped) {
        errors.push(name + ": concurrency.group must include github.event_name, a pull-request number, or a distinct full ref when push and pull_request both use cancel-in-progress.");
      }
    }

    if (name.endsWith("workpass79-cognitive-regression.yml")) {
      const timeoutMatch = /^\s*timeout-minutes:\s*(\d+)\s*$/m.exec(text);
      if (!timeoutMatch || Number(timeoutMatch[1]) < 15) {
        errors.push(`${name}: cognitive regression timeout must be at least 15 minutes to avoid premature cancellation.`);
      }
      const pullRequestBlock = /^  pull_request:[ \t]*\n((?:(?: {4,}[^\n]*)\n)*)/m.exec(text)?.[1] ?? "";
      if (!/^\s*-\s*rebuild\s*$/m.test(pullRequestBlock)) {
        errors.push(`${name}: cognitive regression workflow must run for pull requests targeting rebuild.`);
      }
    }

    if (/ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION\s*[:=]\s*true/i.test(text)) {
      errors.push(`${name}: do not opt out of the retired Node.js 20 Actions runtime.`);
    }
  }

  if (!Object.keys(workflows ?? {}).length) errors.push("No workflow YAML files were found.");
  return errors;
}

async function main() {
  const nodeVersion = await readFile(path.join(repoRoot, ".nvmrc"), "utf8");
  const dir = path.join(repoRoot, ".github", "workflows");
  const names = (await readdir(dir)).filter((name) => /\.ya?ml$/i.test(name)).sort();
  const workflows = {};
  for (const name of names) {
    workflows[name] = await readFile(path.join(dir, name), "utf8");
  }

  const errors = validateCiConfig({ workflows, nodeVersion });
  if (errors.length) {
    console.error("CI RELIABILITY AUDIT FAILED");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`CI RELIABILITY AUDIT PASSED: ${names.length} workflow file(s); Node.js ${nodeVersion.trim()}; first-party action/runtime policy satisfied.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("CI RELIABILITY AUDIT ERROR:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
