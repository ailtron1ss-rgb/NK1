import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeManifestCounts } from '../scripts/lib/manifest-counts.mjs';

// Build a throwaway tree with a known shape so the counting rules are pinned:
// src/organism/** is "canonical", *.ts|mjs|js is "source surface", and
// legacy-original/history/node_modules/state are never counted.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-manifest-counts-'));
const write = (rel) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '');
};

write('src/organism/core/A.ts');            // canonical + source
write('src/organism/core/nested/B.mjs');    // canonical + source
write('src/organism/notes.md');             // canonical, not source
write('src/server/server.mjs');             // source only
write('public/index.html');                 // neither
write('legacy-original/old.ts');            // skipped dir
write('history/h.ts');                      // skipped dir
write('node_modules/pkg/index.js');         // skipped dir
write('state/s.json');                      // skipped dir

const counts = await computeManifestCounts(root);
assert.deepEqual(counts, { canonicalFiles: 3, sourceSurfaceFiles: 3 });

fs.rmSync(root, { recursive: true, force: true });
console.log(JSON.stringify({ pass: true, suite: 'manifest-counts', ...counts }));
