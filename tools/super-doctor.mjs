#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { inspectToolchainVersions } from './toolchain-contract.mjs';

const root = process.cwd();
const out = [];
const ok = (name, pass, detail = '') => out.push({ name, pass, detail });
function ver(bin, args = ['--version']) {
  try { return execFileSync(bin, args, { encoding: 'utf8' }).trim(); }
  catch { return null; }
}
function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return null; }
}

const node = ver(process.execPath);
const npm = ver('npm');
const py = ver('python3');
const nodePin = (() => {
  try { return readFileSync(path.join(root, '.nvmrc'), 'utf8').trim(); }
  catch { return null; }
})();
const manifests = [
  { name: 'root', path: 'package.json' },
  { name: 'runtime', path: 'runtime/neuro-kurisu/package.json' },
  { name: 'app', path: 'app/package.json' },
].map(({ name, path: relativePath }) => ({
  name,
  path: relativePath,
  value: readJson(path.join(root, relativePath)),
}));
const contracts = manifests.map(({ name, value }) => ({
  name,
  ...inspectToolchainVersions({
    nodeVersion: node,
    npmVersion: npm,
    nodePin,
    nodeRequirement: value?.engines?.node,
    npmRequirement: value?.engines?.npm,
  }),
}));
const nodePass = !!nodePin && contracts.length === 3
  && contracts.every((contract) => contract.nodePinMatches && contract.nodeMeetsRequirement);
const npmPass = contracts.length === 3 && contracts.every((contract) => contract.npmMeetsRequirement);
const describeEngines = (key) => manifests.map(({ name, value }) => `${name}=${value?.engines?.[key] || 'missing'}`).join(', ');

ok('node', nodePass, `actual=${node || 'missing'}; .nvmrc=${nodePin || 'missing'}; engines: ${describeEngines('node')}`);
ok('npm', npmPass, `actual=${npm || 'missing'}; engines: ${describeEngines('npm')}`);
ok('python', !!py, py || 'missing');
for (const manifest of manifests) {
  ok(`toolchain-manifest:${manifest.name}`, manifest.value !== null && !!manifest.value.engines?.node && !!manifest.value.engines?.npm,
    manifest.value ? `read ${manifest.path}` : `missing or invalid ${manifest.path}`);
}
ok('app-lock', existsSync(path.join(root, 'app/package-lock.json')));
ok('no-shipped-node_modules', !existsSync(path.join(root, 'app/node_modules')) && !existsSync(path.join(root, 'runtime/neuro-kurisu/node_modules')));
ok('no-shipped-state', !existsSync(path.join(root, 'runtime/neuro-kurisu/state')) && !existsSync(path.join(root, '.super-state')));
const secretFiles = ['.env.local', 'core/auth/gmail-credentials.json'];
for (const rel of secretFiles) {
  ok(`no-provenance-secret:${rel}`, !existsSync(path.join(root, 'legacy/input-archives/hexis-main-2026-10-08', rel)));
}
const result = { ok: out.every((check) => check.pass), checks: out, checkedAt: new Date().toISOString() };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
