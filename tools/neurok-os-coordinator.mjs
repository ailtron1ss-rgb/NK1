#!/usr/bin/env node
import { mkdir, readFile, writeFile, rename, rm, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_STATE_DIR = path.join(ROOT, '.neurok-os');
const CLAIMS_FILE = 'claims.v1.json';
const LOCK_DIR = '.claims.lock';
const LOCK_STALE_MS = 15_000;
const LOCK_RETRIES = 120;
const LOCK_RETRY_MS = 25;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeClaimPath(input) {
  if (typeof input !== 'string' || input.length === 0 || input.includes('\0') ||
      input.startsWith('/') || /^[a-zA-Z]:/.test(input) || input.includes('\\')) {
    throw new Error(`unsafe claim path: ${String(input)}`);
  }
  const parts = input.split('/');
  if (parts.some(part => part === '' || part === '.' || part === '..')) {
    throw new Error(`unsafe claim path: ${input}`);
  }
  return parts.join('/');
}

function pathsOverlap(a, b) {
  const left = a.toLowerCase().split('/');
  const right = b.toLowerCase().split('/');
  const limit = Math.min(left.length, right.length);
  for (let i = 0; i < limit; i += 1) if (left[i] !== right[i]) return false;
  return true;
}

function validateReadSet(readSet) {
  if (readSet === undefined) return [];
  if (!Array.isArray(readSet) || readSet.length > 200) throw new Error('readSet must contain at most 200 dependency snapshots');
  const seen = new Set();
  return readSet.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`readSet[${index}] must be an object`);
    const filePath = normalizeClaimPath(entry.path);
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256 ?? '')) throw new Error(`readSet[${index}] SHA-256 digest is invalid`);
    if (seen.has(filePath)) throw new Error(`duplicate read-set dependency: ${filePath}`);
    seen.add(filePath);
    return { path: filePath, sha256: entry.sha256.toLowerCase() };
  });
}

async function readRepositoryFile(root, relativePath) {
  const rootReal = await realpath(root);
  const target = path.resolve(rootReal, relativePath);
  const relative = path.relative(rootReal, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`read-set path escapes repository root: ${relativePath}`);
  const targetReal = await realpath(target);
  const resolved = path.relative(rootReal, targetReal);
  if (!resolved || resolved.startsWith('..') || path.isAbsolute(resolved)) throw new Error(`read-set symlink escapes repository root: ${relativePath}`);
  return readFile(targetReal);
}

export async function createReadSetSnapshot(paths, options = {}) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 200) {
    throw new Error('snapshot paths must contain 1-200 repository-relative files');
  }
  const normalized = paths.map(normalizeClaimPath);
  if (new Set(normalized).size !== normalized.length) throw new Error('duplicate read-set snapshot paths are not allowed');
  const root = path.resolve(options.root ?? ROOT);
  const snapshot = [];
  for (const filePath of normalized) {
    const bytes = await readRepositoryFile(root, filePath);
    snapshot.push({ path: filePath, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return snapshot;
}

async function inspectReadSet(readSet, options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  const stalePaths = [];
  const missingPaths = [];
  for (const item of readSet) {
    try {
      const bytes = await readRepositoryFile(root, item.path);
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== item.sha256) stalePaths.push(item.path);
    } catch (error) {
      if (error.code === 'ENOENT') missingPaths.push(item.path);
      else throw error;
    }
  }
  return { fresh: stalePaths.length === 0 && missingPaths.length === 0, stalePaths, missingPaths };
}

function validateRequest({ taskId, agentId, baseSha, paths, ttlMs }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(taskId ?? '')) throw new Error('taskId is required and must be a bounded identifier');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(agentId ?? '')) throw new Error('agentId is required and must be a bounded identifier');
  if (!/^[a-f0-9]{40}$/i.test(baseSha ?? '')) throw new Error('baseSha must be a full 40-character Git SHA');
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 100) throw new Error('paths must contain 1-100 repository-relative paths');
  if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > MAX_TTL_MS) throw new Error('ttlMs must be between 1 second and 24 hours');
  const normalized = [...new Set(paths.map(normalizeClaimPath))];
  if (normalized.length !== paths.length) throw new Error('duplicate claim paths are not allowed');
  return normalized;
}

async function readState(stateDir) {
  try {
    const parsed = JSON.parse(await readFile(path.join(stateDir, CLAIMS_FILE), 'utf8'));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.claims)) throw new Error('invalid claim state schema');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, claims: [] };
    throw error;
  }
}

async function withLock(stateDir, action) {
  await mkdir(stateDir, { recursive: true });
  const lockPath = path.join(stateDir, LOCK_DIR);
  let acquired = false;
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    try {
      await mkdir(lockPath);
      await writeFile(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      acquired = true;
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > LOCK_STALE_MS) await rm(lockPath, { recursive: true, force: true });
      } catch (statError) {
        if (statError.code !== 'ENOENT') throw statError;
      }
      await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
  if (!acquired) throw new Error('claim store is busy; retry later');
  try {
    return await action();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

async function writeState(stateDir, state) {
  const target = path.join(stateDir, CLAIMS_FILE);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, target);
}

function activeClaims(state, now) {
  return state.claims.filter(claim => Number.isFinite(claim.expiresAt) && claim.expiresAt > now);
}

export async function claimTask(request, options = {}) {
  const stateDir = path.resolve(options.stateDir ?? process.env.NEUROK_OS_STATE_DIR ?? DEFAULT_STATE_DIR);
  const paths = validateRequest(request);
  const readSet = validateReadSet(request.readSet);
  if (readSet.length) {
    const snapshot = await inspectReadSet(readSet, { root: options.root });
    if (!snapshot.fresh) throw new Error(`read-set snapshot is stale at claim creation: ${[...snapshot.stalePaths, ...snapshot.missingPaths].join(', ')}`);
  }
  const baseSha = request.baseSha.toLowerCase();
  if (options.currentSha && baseSha !== options.currentSha.toLowerCase()) {
    throw new Error('claim base SHA does not match the current checkout HEAD');
  }
  return withLock(stateDir, async () => {
    const now = options.now ?? Date.now();
    const state = await readState(stateDir);
    const claims = activeClaims(state, now);
    const existing = claims.find(item => item.taskId === request.taskId);
    if (existing) {
      const same = existing.agentId === request.agentId &&
        existing.baseSha === baseSha &&
        JSON.stringify([...existing.paths].sort()) === JSON.stringify([...paths].sort()) &&
        JSON.stringify(existing.readSet ?? []) === JSON.stringify(readSet);
      if (!same) throw new Error(`task already claimed by ${existing.agentId} with a different contract`);
      existing.expiresAt = now + request.ttlMs;
      existing.renewedAt = now;
      await writeState(stateDir, { schemaVersion: 1, claims });
      return { ...existing, renewed: true };
    }
    for (const incoming of paths) {
      const conflict = claims.find(item => item.paths.some(held => pathsOverlap(incoming, held)));
      if (conflict) throw new Error(`path conflict: ${incoming} is owned by task ${conflict.taskId} (${conflict.agentId})`);
    }
    const claim = {
      taskId: request.taskId,
      agentId: request.agentId,
      baseSha,
      paths,
      readSet,
      createdAt: now,
      renewedAt: now,
      expiresAt: now + request.ttlMs
    };
    await writeState(stateDir, { schemaVersion: 1, claims: [...claims, claim] });
    return { ...claim, renewed: false };
  });
}

export async function verifyClaimFreshness(taskId, agentId, options = {}) {
  const stateDir = path.resolve(options.stateDir ?? process.env.NEUROK_OS_STATE_DIR ?? DEFAULT_STATE_DIR);
  return withLock(stateDir, async () => {
    const state = await readState(stateDir);
    const claims = activeClaims(state, options.now ?? Date.now());
    const claim = claims.find(item => item.taskId === taskId);
    if (!claim) throw new Error('task claim not found or expired');
    if (claim.agentId !== agentId) throw new Error('only the owning agent may verify this claim');
    const root = path.resolve(options.root ?? ROOT);
    const currentSha = (options.currentSha ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()).toLowerCase();
    if (claim.baseSha !== currentSha) {
      return { fresh: false, stalePaths: [], missingPaths: [], reason: 'base SHA changed; reacquire the claim' };
    }
    if (!Array.isArray(claim.readSet) || claim.readSet.length === 0) {
      return { fresh: false, stalePaths: [], missingPaths: [], reason: 'claim has no read-set; context freshness is unverified' };
    }
    return inspectReadSet(claim.readSet, { root });
  });
}

export async function releaseTask({ taskId, agentId }, options = {}) {
  const stateDir = path.resolve(options.stateDir ?? process.env.NEUROK_OS_STATE_DIR ?? DEFAULT_STATE_DIR);
  return withLock(stateDir, async () => {
    const state = await readState(stateDir);
    const claims = activeClaims(state, options.now ?? Date.now());
    const existing = claims.find(item => item.taskId === taskId);
    if (!existing) return { released: false, reason: 'not-found' };
    if (existing.agentId !== agentId) throw new Error('only the owning agent may release this claim');
    await writeState(stateDir, { schemaVersion: 1, claims: claims.filter(item => item.taskId !== taskId) });
    return { released: true, taskId };
  });
}

export async function listClaims(options = {}) {
  const stateDir = path.resolve(options.stateDir ?? process.env.NEUROK_OS_STATE_DIR ?? DEFAULT_STATE_DIR);
  return withLock(stateDir, async () => {
    const state = await readState(stateDir);
    const claims = activeClaims(state, options.now ?? Date.now());
    if (claims.length !== state.claims.length) await writeState(stateDir, { schemaVersion: 1, claims });
    return claims;
  });
}

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = argv[++i];
  }
  return out;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = argsOf(rest);
  if (command === 'snapshot') {
    if (!args.out) throw new Error('snapshot requires --out FILE');
    const paths = (args.paths ?? '').split(',').filter(Boolean);
    const snapshot = await createReadSetSnapshot(paths);
    const target = path.resolve(args.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ path: target, files: snapshot.length }, null, 2));
    return;
  }
  if (command === 'claim') {
    const currentSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const result = await claimTask({
      taskId: args.task,
      agentId: args.agent,
      baseSha: args.sha,
      paths: (args.paths ?? '').split(','),
      readSet: args.readSetFile ? JSON.parse(await readFile(path.resolve(args.readSetFile), 'utf8')) : undefined,
      ttlMs: Number(args.ttlMs ?? 3_600_000)
    }, { currentSha });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'verify') {
    const result = await verifyClaimFreshness(args.task, args.agent);
    console.log(JSON.stringify(result, null, 2));
    if (!result.fresh) process.exitCode = 1;
    return;
  }
  if (command === 'release') {
    console.log(JSON.stringify(await releaseTask({ taskId: args.task, agentId: args.agent }), null, 2));
    return;
  }
  if (command === 'list') {
    console.log(JSON.stringify(await listClaims(), null, 2));
    return;
  }
  console.error('Usage: node tools/neurok-os-coordinator.mjs [snapshot|claim|verify|release|list] --task ID --agent ID --sha FULL_SHA --paths a.ts,b.ts [--readSetFile FILE] [--ttlMs 3600000]');
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
