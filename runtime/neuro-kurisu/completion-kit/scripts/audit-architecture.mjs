import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const runtimeRoot = path.resolve(kitRoot, '..');
const json = async file => JSON.parse(await readFile(path.join(kitRoot, file), 'utf8'));

export async function runArchitectureAudit({ root = runtimeRoot } = {}) {
  const [owners, moduleMap] = await Promise.all([json('architecture/owners.json'), json('architecture/module-map.json')]);
  const failures = [];
  const warnings = [];
  const ownerNames = new Set();
  const ownerPaths = new Set();
  for (const owner of owners.owners) {
    if (ownerNames.has(owner.name)) failures.push(`duplicate-owner-name:${owner.name}`);
    ownerNames.add(owner.name);
    if (ownerPaths.has(owner.ownerFile)) failures.push(`duplicate-physical-owner:${owner.ownerFile}`);
    ownerPaths.add(owner.ownerFile);
    try { await readFile(path.join(root, owner.ownerFile), 'utf8'); }
    catch { failures.push(`missing-owner-file:${owner.name}:${owner.ownerFile}`); }
  }
  const required = [...new Set([...moduleMap.requiredFiles, owners.compositionRoot, owners.runtimeEntrypoint, owners.cognitiveOwner, owners.subsystemRegistry])];
  const existing = [];
  const missing = [];
  for (const relative of required) {
    try { await readFile(path.join(root, relative), 'utf8'); existing.push(relative); }
    catch { missing.push(relative); failures.push(`missing-required-file:${relative}`); }
  }
  const compositionPath = path.join(root, owners.compositionRoot);
  let compositionText = '';
  try { compositionText = await readFile(compositionPath, 'utf8'); }
  catch { /* already reported above */ }
  for (const owner of owners.owners) {
    const moduleName = path.basename(owner.ownerFile, path.extname(owner.ownerFile));
    if (!compositionText.includes(moduleName)) failures.push(`composition-root-does-not-reference-owner:${owner.name}:${moduleName}`);
  }
  const statuses = {};
  const allowedStatuses = new Set(['EXISTS', 'GAP', 'NEW', 'PARTIAL']);
  for (const module of moduleMap.modules) {
    statuses[module.status] = (statuses[module.status] ?? 0) + 1;
    if (!allowedStatuses.has(module.status)) failures.push(`unknown-module-status:${module.id}:${module.status}`);
    if (module.status === 'EXISTS') {
      try { await readFile(path.join(root, module.path), 'utf8'); }
      catch { failures.push(`module-status-exists-but-file-missing:${module.id}:${module.path}`); }
    }
  }
  const report = {
    schemaVersion: 1,
    audit: 'nk1-completion-architecture',
    runtimeRoot: path.resolve(root),
    checkedAt: new Date().toISOString(),
    counts: { owners: owners.owners.length, requiredFiles: required.length, existingFiles: existing.length, missingFiles: missing.length, modules: moduleMap.modules.length, statuses },
    failures,
    warnings,
    pass: failures.length === 0,
    limitations: ['Static file and composition-reference audit only.', 'Does not prove every module is called on a live runtime path.', 'Does not prove intelligence, autonomy or cognitive quality.'],
  };
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runArchitectureAudit();
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}
