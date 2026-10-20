import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};
const scriptNames = new Set(Object.keys(scripts));
const missingScriptRefs = [];
const missingFileRefs = [];
let scriptReferenceCount = 0;
let fileReferenceCount = 0;

for (const [owner, command] of Object.entries(scripts)) {
  // npm accepts options before the script name; skip common options without
  // accidentally treating "-s" or "--silent" as a script name.
  const runPattern = /\bnpm\s+run\s+(?:(?:--[a-z][a-z-]*|-s|-q)\s+)*([A-Za-z0-9][A-Za-z0-9:_-]*)/g;
  for (const match of command.matchAll(runPattern)) {
    const target = match[1];
    scriptReferenceCount += 1;
    if (!scriptNames.has(target)) missingScriptRefs.push({ owner, target });
  }

  const filePattern = /\b(tests\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts|mts|cts))\b/g;
  for (const match of command.matchAll(filePattern)) {
    const relativeTarget = match[1];
    fileReferenceCount += 1;
    const resolved = path.resolve(packageRoot, relativeTarget);
    if (!resolved.startsWith(path.join(packageRoot, 'tests') + path.sep) || !existsSync(resolved)) {
      missingFileRefs.push({ owner, target: relativeTarget });
    }
  }
}

const uniqueMissingFiles = [...new Map(missingFileRefs.map(item => [item.target, item])).values()];
const uniqueMissingScripts = [...new Map(missingScriptRefs.map(item => [item.target, item])).values()];
const report = {
  package: packageJson.name,
  packageVersion: packageJson.version,
  scriptCount: scriptNames.size,
  npmRunReferencesChecked: scriptReferenceCount,
  localTestFileReferencesChecked: fileReferenceCount,
  missingScriptTargets: uniqueMissingScripts,
  missingTestFiles: uniqueMissingFiles,
};

console.log('WORKPASS84_SCRIPT_INTEGRITY=' + (uniqueMissingScripts.length === 0 && uniqueMissingFiles.length === 0 ? 'PASS ' : 'FAIL ') + JSON.stringify(report));
assert.deepEqual(uniqueMissingScripts, [], 'Every npm run target referenced by package scripts must exist.');
assert.deepEqual(uniqueMissingFiles, [], 'Every local tests/* file referenced by package scripts must exist.');
