import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the TypeScript compiler from the project's pinned lockfiles instead of a
// machine-specific absolute path, matching scripts/typecheck-runtime.mjs so every
// script parses with the same compiler the runtime or app lockfile pins.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const candidates = [
  path.join(root, 'node_modules', 'typescript', 'lib', 'typescript.js'),
  path.resolve(root, '../../app/node_modules/typescript/lib/typescript.js'),
];
const resolved = candidates.find(existsSync);
if (!resolved) {
  throw new Error(
    'TypeScript compiler not found; install the runtime or app lockfile (npm ci --prefix app) before running this script.',
  );
}
export const ts = createRequire(import.meta.url)(resolved);
