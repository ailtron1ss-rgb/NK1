import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async rel => JSON.parse(await readFile(path.join(root, rel), 'utf8'));
async function filesBelow(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await filesBelow(full));
    else if (ent.isFile() && /\.(?:[cm]?js|jsx|tsx?|mjs)$/.test(ent.name)) out.push(full);
  }
  return out;
}

test('app lockfile matches manifest and has no unused resolver optional-peer tree', async () => {
  const pkg = await readJson('app/package.json');
  const lock = await readJson('app/package-lock.json');
  const lockRoot = lock.packages?.[''];
  assert.ok(lockRoot, 'app package-lock must have a v3 root entry');
  assert.deepEqual(lockRoot.dependencies ?? {}, pkg.dependencies ?? {}, 'app direct dependencies must match lockfile root');
  assert.deepEqual(lockRoot.devDependencies ?? {}, pkg.devDependencies ?? {}, 'app dev dependencies must match lockfile root');
  assert.equal(pkg.dependencies?.['@hookform/resolvers'], undefined, 'unused @hookform/resolvers must not remain a direct dependency');
  assert.equal(lock.packages['node_modules/@hookform/resolvers'], undefined, 'resolver package must not remain as stale lock entry');
  assert.equal(lock.packages['node_modules/@standard-schema/utils'], undefined, 'orphaned resolver utility must not remain in lock');
  for (const [packagePath, metadata] of Object.entries(lock.packages)) {
    for (const field of ['dependencies', 'optionalDependencies']) {
      assert.equal(metadata[field]?.['@standard-schema/utils'], undefined, `${packagePath || '<root>'} must not require removed utility`);
    }
  }
  const sourceRoots = ['app/src', 'app/scripts'];
  const sourceFiles = (await Promise.all(sourceRoots.map(p => filesBelow(path.join(root, p))))).flat();
  for (const file of sourceFiles) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, /@hookform\/resolvers|(?:zod|ajv)Resolver\s*\(/, `${path.relative(root, file)} must not import the removed resolver`);
  }
  const sbom = await readJson('contracts/SBOM.final.json');
  assert.ok(!sbom.components.some(c => c.name === '@hookform/resolvers'), 'SBOM must match dependency pruning');
  assert.ok(!sbom.components.some(c => c.name === '@standard-schema/utils'), 'SBOM must not retain orphaned utility');
});
