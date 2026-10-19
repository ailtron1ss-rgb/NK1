import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = path.join(root, 'runtime/neuro-kurisu');
const testsRoot = path.join(runtimeRoot, 'tests');
const workflowPath = path.join(root, '.github/workflows/workpass71-validation.yml');
const packagePath = path.join(runtimeRoot, 'package.json');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return /\.(?:mjs|cjs|js|ts|tsx)$/.test(entry.name) ? [absolute] : [];
  }));
  return nested.flat();
}

const [workflow, packageJsonText] = await Promise.all([
  readFile(workflowPath, 'utf8'),
  readFile(packagePath, 'utf8'),
]);
const packageJson = JSON.parse(packageJsonText);
const scriptsText = Object.entries(packageJson.scripts ?? {})
  .map(([name, command]) => `${name}: ${command}`)
  .join('\n');
const runnableFiles = (await walk(testsRoot)).map(file => path.relative(root, file).split(path.sep).join('/')).sort();
const referenceSources = [
  { name: 'workflow', text: workflow },
  { name: 'package scripts', text: scriptsText },
];
const references = [];
for (const source of referenceSources) {
  const matches = source.text.match(/(?:runtime\/neuro-kurisu\/)?tests\/[\w./-]+\.(?:mjs|cjs|js|ts|tsx)/g) ?? [];
  for (const match of matches) {
    const normalized = match.startsWith('runtime/') ? match : `runtime/neuro-kurisu/${match}`;
    references.push({ source: source.name, path: normalized.replace(/\\/g, '/') });
  }
}
const counts = new Map();
for (const ref of references) counts.set(ref.path, (counts.get(ref.path) ?? 0) + 1);
const missingReferences = [...counts.keys()].filter(file => !runnableFiles.includes(file)).sort();
const duplicateReferences = [...counts.entries()].filter(([, count]) => count > 1).map(([file, count]) => ({ file, count })).sort((a, b) => a.file.localeCompare(b.file));
const referenced = new Set([...counts.keys()].filter(file => runnableFiles.includes(file)));
const requiredWorkflowTests = [
  'runtime/neuro-kurisu/tests/local-chat-provider-workpass40.mjs',
  'runtime/neuro-kurisu/tests/local-llm-selection-workpass74.mjs',
  'runtime/neuro-kurisu/tests/language-invoke-order-regression.mjs',
  'runtime/neuro-kurisu/tests/cold-retrieval-residency-regression.mjs',
  'runtime/neuro-kurisu/tests/r15-temporal-memory-behavior.mjs',
  'runtime/neuro-kurisu/tests/memory-temporal-inspector-closure.mjs',
  'runtime/neuro-kurisu/tests/memory-revision-history-budget-workpass36.mjs',
];
const missingRequired = requiredWorkflowTests.filter(file => !workflow.includes(file) && !workflow.includes(file.replace('runtime/neuro-kurisu/', '')));
const report = {
  status: missingReferences.length === 0 && missingRequired.length === 0 ? 'PASS' : 'FAIL',
  scope: 'static direct-reference inventory; not proof that every test is executed or behavior is correct',
  testFilesFound: runnableFiles.length,
  directlyReferencedRunnableFiles: referenced.size,
  unreferencedCandidates: runnableFiles.length - referenced.size,
  packageScriptCount: Object.keys(packageJson.scripts ?? {}).length,
  explicitReferenceCount: references.length,
  missingReferences,
  duplicateReferences,
  requiredWorkflowTests,
  missingRequired,
};
console.log('RUNTIME_TEST_COVERAGE_AUDIT=' + JSON.stringify(report));
assert.equal(missingReferences.length, 0, 'package/workflow test references must point to existing files');
assert.equal(missingRequired.length, 0, 'required regression tests must remain wired into the active workflow');
