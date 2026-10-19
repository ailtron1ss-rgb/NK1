import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = ['app/src', 'runtime/neuro-kurisu/src', 'research', 'tools', 'contracts', 'docs'];
const buckets = {};
const allFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.cache', '__pycache__', '.super-state', '.verify-state'].includes(entry.name)) continue;
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else allFiles.push(p);
  }
};
for (const root of sourceRoots) if (existsSync(resolve(ROOT, root))) walk(resolve(ROOT, root));
for (const p of allFiles) {
  const top = relative(ROOT, p).split('/')[0];
  buckets[top] ??= { files: 0, bytes: 0, byExtension: {} };
  const b = buckets[top]; const ext = extname(p).toLowerCase() || '[no-ext]';
  b.files++; b.bytes += statSync(p).size; b.byExtension[ext] = (b.byExtension[ext] ?? 0) + 1;
}
const inventory = {
  generatedAt: new Date().toISOString(),
  totalSourceFiles: allFiles.length,
  totalSourceBytes: allFiles.reduce((n, p) => n + statSync(p).size, 0),
  buckets,
  owners: {
    canonicalRuntime: 'runtime/neuro-kurisu',
    uiShell: 'app',
    live2d: 'app/public/live2d',
    legacyVisual: 'app/src/legacy/avatar',
    researchBridge: 'research/research_bridge.py',
    legacyProvenance: 'legacy',
  },
};
writeFileSync(resolve(ROOT, 'contracts/inventory/live-source-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify(inventory, null, 2));
