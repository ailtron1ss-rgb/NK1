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
      env: { RESEARCH_PORT: '8765' },
    },
    {
      label: 'ui-preview',
      command: 'npm',
      args: ['--prefix', 'app', 'run', 'preview'],
      cwd: projectRoot,
      env: {},
    },
    {
      label: 'gateway',
      command: nodeExecutable,
      args: ['tools/super-gateway.mjs'],
      cwd: projectRoot,
      env: {
        SUPER_GATEWAY_PORT: '8080',
        SUPER_UI_PORT: '8081',
        SUPER_RUNTIME_PORT: '3310',
        SUPER_RESEARCH_PORT: '8765',
      },
    },
  ];
}
