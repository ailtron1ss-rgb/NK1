import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Resolve paths from this module's URL, not process.cwd() or URL.pathname.
// The latter breaks on Windows drive paths and encoded directory names.
export const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
export const SUPER_STATE_DIRECTORY = path.resolve(PROJECT_ROOT, '.super-state');
export const RUNTIME_SERVER_PATH = path.resolve(
  PROJECT_ROOT,
  'runtime/neuro-kurisu/src/server/server.mjs',
);
