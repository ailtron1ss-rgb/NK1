import { resolve } from 'node:path';

/**
 * Canonical launch contracts for the services owned by the top-level supervisor.
 * Commands and relative script paths are evaluated from each spec's cwd.
 */
export function buildSupervisedServiceSpecs({ root, stateDir, nodeExecutable }) {
  if (typeof root !== 'string' || !root.trim()) throw new Error('supervisor root is required');
  if (typeof stateDir !== 'string' || !stateDir.trim()) throw new Error('supervisor state directory is required');
  if (typeof nodeExecutable !== 'string' || !nodeExecutable.trim()) throw new Error('Node executable is required');

  const projectRoot = resolve(root);
  const runtimeRoot = resolve(projectRoot, 'runtime/neuro-kurisu');
  const durableState = resolve(stateDir);

  return [
    {
      label: 'neuro-kurisu',
      command: nodeExecutable,
      args: ['--experimental-strip-types', 'src/server/server.mjs'],
      cwd: runtimeRoot,
      preflightPaths: ['src/server/server.mjs'],
      env: {
        PORT: '3310',
        HOST: '127.0.0.1',
        STATE_DIR: resolve(durableState, 'organism'),
        NODE_ENV: 'production',
      },
    },
    {
      label: 'research-bridge',
      command: 'python3',
      args: ['research/research_bridge.py'],
      cwd: projectRoot,
      preflightPaths: ['research/research_bridge.py'],
      env: { RESEARCH_PORT: '8765' },
    },
    {
      label: 'ui-preview',
      command: 'npm',
      args: ['--prefix', 'app', 'run', 'preview'],
      cwd: projectRoot,
      preflightPaths: ['app/package.json', 'app/node_modules/vite/bin/vite.js', 'app/dist/index.html'],
      env: {},
    },
    {
      label: 'gateway',
      command: nodeExecutable,
      args: ['tools/super-gateway.mjs'],
      cwd: projectRoot,
      preflightPaths: ['tools/super-gateway.mjs'],
      env: {
        SUPER_GATEWAY_PORT: '8080',
        SUPER_UI_PORT: '8081',
        SUPER_RUNTIME_PORT: '3310',
        SUPER_RESEARCH_PORT: '8765',
      },
    },
  ];
}


/**
 * Return unavailable service prerequisites without creating state or launching
 * any child process. The injected path probe keeps the policy independently
 * testable; production passes fs.existsSync.
 */
export function missingServiceRequirements(specs, pathExists) {
  if (!Array.isArray(specs)) throw new TypeError('service specs must be an array');
  if (typeof pathExists !== 'function') throw new TypeError('path existence probe is required');
  const missing = [];
  for (const spec of specs) {
    const label = typeof spec?.label === 'string' && spec.label.trim() ? spec.label.trim() : 'unknown-service';
    if (typeof spec?.cwd !== 'string' || !spec.cwd.trim() || !Array.isArray(spec.preflightPaths)) {
      missing.push({ label, path: '<invalid-service-spec>' });
      continue;
    }
    for (const relativePath of spec.preflightPaths) {
      if (typeof relativePath !== 'string' || !relativePath.trim()) {
        missing.push({ label, path: '<invalid-prerequisite-path>' });
        continue;
      }
      const candidate = resolve(spec.cwd, relativePath);
      let exists = false;
      try { exists = pathExists(candidate) === true; } catch { exists = false; }
      if (!exists) missing.push({ label, path: candidate });
    }
  }
  return missing;
}
