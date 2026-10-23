import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validateCiConfig({ workflows, nodeVersion }) {
  const errors = [];
  const pinnedNode = String(nodeVersion ?? "").trim();

  if (!/^\d+\.\d+\.\d+$/.test(pinnedNode)) {
    errors.push("Root .nvmrc must pin an exact Node.js version (for example 22.16.0).");
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

    if (/uses:\s*actions\/setup-node@/m.test(text)) {
      if (!/node-version-file:\s*['"]?\.nvmrc['"]?/m.test(text)) {
        errors.push(`${name}: setup-node must select the project runtime from root .nvmrc.`);
      }
      if (!text.includes("expected=\"v$(tr -d '[:space:]' < .nvmrc)\"") ||
          !text.includes('test "$actual" = "$expected"')) {
        errors.push(`${name}: setup-node must be followed by a runtime assertion against .nvmrc.`);
      }
    }

    if (name.endsWith("workpass79-cognitive-regression.yml")) {
      const timeoutMatch = /^\s*timeout-minutes:\s*(\d+)\s*$/m.exec(text);
      if (!timeoutMatch || Number(timeoutMatch[1]) < 15) {
        errors.push(`${name}: cognitive regression timeout must be at least 15 minutes to avoid premature cancellation.`);
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
