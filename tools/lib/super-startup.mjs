import net from 'node:net';
import path from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRuntimeLaunchSpec(root, stateDir, {
  nodeExecutable = process.execPath,
  nodeEnv = 'production',
  port = 3310,
  host = '127.0.0.1',
} = {}) {
  const projectRoot = path.resolve(root);
  const runtimeRoot = path.join(projectRoot, 'runtime', 'neuro-kurisu');
  const runtimeEntry = path.join(runtimeRoot, 'src', 'server', 'server.mjs');

  if (typeof nodeExecutable !== 'string' || nodeExecutable.trim() === '') {
    throw new Error('Runtime launch requires a non-empty Node.js executable.');
  }
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`Runtime launch port is invalid: ${port}`);
  }
  if (typeof host !== 'string' || host.trim() === '') {
    throw new Error('Runtime launch host must be a non-empty string.');
  }

  return {
    command: nodeExecutable,
    args: ['--experimental-strip-types', runtimeEntry],
    cwd: runtimeRoot,
    env: {
      PORT: String(port),
      HOST: host,
      STATE_DIR: path.resolve(stateDir),
      NODE_ENV: String(nodeEnv),
    },
  };
}

function parseVersion(value, label) {
  const match = String(value ?? '').trim().match(/(?:^|[^0-9])v?(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) throw new Error(`${label} version could not be read: ${JSON.stringify(value)}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3] ?? 0) };
}

export function assertToolchainVersions({
  nodeVersion,
  npmVersion,
  pythonVersion,
  expectedNodeMajor,
  expectedPythonVersion,
}) {
  const node = parseVersion(nodeVersion, 'Node.js');
  const npm = parseVersion(npmVersion, 'npm');
  const python = parseVersion(pythonVersion, 'Python');
  const expectedPython = String(expectedPythonVersion ?? '').trim().match(/^(\d+)\.(\d+)/);

  if (!Number.isInteger(expectedNodeMajor) || expectedNodeMajor < 1) {
    throw new Error(`Invalid Node.js major pin: ${expectedNodeMajor}`);
  }
  if (node.major !== expectedNodeMajor) {
    throw new Error(`Node.js ${expectedNodeMajor}.x is required by .nvmrc; found ${nodeVersion}. Switch Node with nvm/use Node ${expectedNodeMajor}, then rerun.`);
  }
  if (npm.major < 10 || (npm.major === 10 && npm.minor < 8)) {
    throw new Error(`npm >=10.8.0 is required; found ${npmVersion}. Upgrade npm before installing dependencies.`);
  }
  if (!expectedPython) throw new Error(`Invalid .python-version pin: ${JSON.stringify(expectedPythonVersion)}`);
  if (python.major !== Number(expectedPython[1]) || python.minor !== Number(expectedPython[2])) {
    throw new Error(`Python ${expectedPython[1]}.${expectedPython[2]}.x is required by .python-version; found ${pythonVersion}. Install/switch to the pinned Python version.`);
  }

  return { node, npm, python };
}

export function workspaceNeedsNodeModules(manifest) {
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].some((section) => {
    const value = manifest?.[section];
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
  });
}

export async function assertPortAvailable(port, host = '127.0.0.1') {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid TCP port: ${port}`);
  }

  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} on ${host} is already in use. Stop the conflicting process and retry.`));
      } else {
        reject(error);
      }
    });
    server.listen(port, host, () => server.close((error) => error ? reject(error) : resolve()));
  });
}

export async function waitForHttpReady({
  url,
  serviceName = url,
  timeoutMs = 60000,
  pollIntervalMs = 300,
  fetchImpl = globalThis.fetch,
  isAlive = () => true,
  isReady = (response) => response?.ok === true,
}) {
  if (typeof fetchImpl !== 'function') throw new Error('HTTP readiness check requires fetch().');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error(`Invalid readiness timeout: ${timeoutMs}`);

  const deadline = Date.now() + timeoutMs;
  let lastFailure = 'no response';

  while (Date.now() < deadline) {
    if (!isAlive()) throw new Error(`${serviceName} exited before becoming ready (${lastFailure}).`);
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(Math.min(2000, Math.max(250, timeoutMs))),
      });
      if (response?.ok && await isReady(response)) return response;
      lastFailure = response?.ok
        ? 'HTTP response received but service readiness predicate returned false'
        : `HTTP ${response?.status ?? 'unknown'}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
  }

  throw new Error(`${serviceName} did not become ready within ${timeoutMs} ms (last result: ${lastFailure}).`);
}
