import path from 'node:path';

/** Resolve the one canonical runtime HTTP entrypoint from the repository root. */
export function resolveRuntimeServerEntry(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || repositoryRoot.trim() === '') {
    throw new TypeError('repository root must be a non-empty path');
  }
  return path.resolve(repositoryRoot, 'runtime', 'neuro-kurisu', 'src', 'server', 'server.mjs');
}
