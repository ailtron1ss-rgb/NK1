import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const version = readJson('VERSION.json');
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const manifest = readJson('RELEASE_MANIFEST.json');

function command(name, args) {
  try { return execFileSync(name, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return 'unavailable'; }
}

const stateDir = path.join(root, 'state');
const nodeModules = path.join(root, 'node_modules');
const stateEntries = fs.existsSync(stateDir) ? fs.readdirSync(stateDir) : [];
const depCount = Object.keys(lock.packages ?? {}).filter((k) => k && k !== 'node_modules').length;
const result = {
  ok: true,
  environment: { platform: process.platform, arch: process.arch, node: process.version, npm: command('npm', ['--version']), cpus: os.cpus().length, memoryMB: Math.round(os.totalmem() / 1024 / 1024) },
  release: version,
  package: { version: pkg.version, dependencyCount: depCount, nodeModulesPresent: fs.existsSync(nodeModules) },
  manifest: { release: manifest.release, version: manifest.version, organismCore: manifest.organismCore, canonicalFiles: manifest.canonicalFiles, sourceSurfaceFiles: manifest.sourceSurfaceFiles, stateSchema: manifest.stateSchema },
  runtime: { stateEntries, stateClean: stateEntries.length === 0 },
  commands: { start: pkg.scripts?.start, audit: pkg.scripts?.['release:audit'], fullAudit: pkg.scripts?.['audit:full'], research: pkg.scripts?.['research:all'] },
};
if (version.application !== pkg.version || version.application !== manifest.version || version.organismCore !== manifest.organismCore || version.stateSchema !== manifest.stateSchema || version.phase !== manifest.phase) result.ok = false;
if (depCount !== 0) result.ok = false;
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
