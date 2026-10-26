import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const DEFAULT_UI_BUILD_TIMEOUT_MS = 600_000;

/**
 * Build the Vite UI on first start when the distributable is missing.
 * The build is web-only: database migrations remain part of the explicit
 * app "build" lifecycle and are not silently performed by the runtime launcher.
 */
export function ensureUiBuilt(repositoryRoot, options = {}) {
  if (typeof repositoryRoot !== 'string' || repositoryRoot.trim() === '') {
    throw new TypeError('repository root must be a non-empty path');
  }
  const root = path.resolve(repositoryRoot);
  const appRoot = path.join(root, 'app');
  const appPackage = path.join(appRoot, 'package.json');
  const indexPath = path.join(appRoot, 'dist', 'index.html');
  const exists = options.exists ?? existsSync;

  if (exists(indexPath)) return { built: false, indexPath };
  if (!exists(appPackage)) throw new Error(`UI package manifest is missing: ${appPackage}`);

  const timeoutMs = options.timeoutMs ?? DEFAULT_UI_BUILD_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 1_800_000) {
    throw new RangeError('UI build timeout must be an integer in 1000..1800000 ms');
  }

  const args = ['--prefix', 'app', 'run', 'build:web'];
  const runBuild = options.runBuild ?? (() => spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    timeout: timeoutMs,
    windowsHide: true,
  }));
  const result = runBuild({ cwd: root, timeoutMs, command: 'npm', args: [...args] });
  if (result?.error || result?.status !== 0) {
    const detail = result?.error?.message || (result?.signal ? `signal=${result.signal}` : `status=${String(result?.status)}`);
    throw new Error(`UI build failed before startup (${detail}); fix app build errors and retry`);
  }
  if (!exists(indexPath)) {
    throw new Error(`UI build completed without producing ${indexPath}`);
  }
  return { built: true, indexPath };
}
