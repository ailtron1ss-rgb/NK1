import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const runtimeRoot = path.resolve(kitRoot, '..');
const repositoryRoot = path.resolve(runtimeRoot, '..', '..');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export function auditTestSurface({ gates, rootScripts = {}, runtimeScripts = {} }) {
  const failures = [];
  const seenGateIds = new Set();
  for (const gate of gates.gates ?? []) {
    if (!gate.id || seenGateIds.has(gate.id)) failures.push(`duplicate-or-empty-gate-id:${gate.id ?? ''}`);
    seenGateIds.add(gate.id);
    if (!Array.isArray(gate.scripts) || gate.scripts.length === 0) {
      failures.push(`gate-has-no-scripts:${gate.id ?? 'unknown'}`);
      continue;
    }
    for (const script of gate.scripts) {
      if (typeof script !== 'string' || script.length === 0) {
        failures.push(`invalid-script-name:${gate.id}`);
      } else if (!(script in rootScripts) && !(script in runtimeScripts)) {
        failures.push(`missing-gate-script:${gate.id}:${script}`);
      }
    }
  }
  return {
    schemaVersion: 1,
    audit: 'nk1-completion-test-surface',
    gateCount: seenGateIds.size,
    checkedScriptCount: (gates.gates ?? []).reduce((count, gate) => count + (Array.isArray(gate.scripts) ? gate.scripts.length : 0), 0),
    failures,
    pass: failures.length === 0,
    limitations: [
      'Checks that declared npm script names exist in the root or runtime package manifests.',
      'Does not execute scripts or prove that their underlying tests provide meaningful coverage.',
      'Physical-device, independent holdout and human-review gates require separate evidence.'
    ]
  };
}

export async function runTestSurfaceAudit() {
  const [gates, rootPackage, runtimePackage] = await Promise.all([
    readJson(path.join(kitRoot, 'architecture/gates.json')),
    readJson(path.join(repositoryRoot, 'package.json')),
    readJson(path.join(runtimeRoot, 'package.json'))
  ]);
  return auditTestSurface({
    gates,
    rootScripts: rootPackage.scripts ?? {},
    runtimeScripts: runtimePackage.scripts ?? {}
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await runTestSurfaceAudit();
    console.log(JSON.stringify(report, null, 2));
    if (!report.pass) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ audit: 'nk1-completion-test-surface', pass: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
