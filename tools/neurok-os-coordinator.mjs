#!/usr/bin/env node
import { mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
  return withLock(stateDir, async () => {
    const now = options.now ?? Date.now();
    const state = await readState(stateDir);
    const claims = activeClaims(state, now);
    const existing = claims.find(item => item.taskId === request.taskId);
    if (existing) {
      const same = existing.agentId === request.agentId &&
        existing.baseSha === request.baseSha &&
        JSON.stringify([...existing.paths].sort()) === JSON.stringify([...paths].sort());
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
      baseSha: request.baseSha.toLowerCase(),
      paths,
      createdAt: now,
      renewedAt: now,
      expiresAt: now + request.ttlMs
    };
    await writeState(stateDir, { schemaVersion: 1, claims: [...claims, claim] });
    return { ...claim, renewed: false };
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
  if (command === 'claim') {
    const result = await claimTask({
      taskId: args.task,
      agentId: args.agent,
      baseSha: args.sha,
      paths: (args.paths ?? '').split(','),
      ttlMs: Number(args.ttlMs ?? 3_600_000)
    });
    console.log(JSON.stringify(result, null, 2));
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
  console.error('Usage: node tools/neurok-os-coordinator.mjs [claim|release|list] --task ID --agent ID --sha FULL_SHA --paths a.ts,b.ts [--ttlMs 3600000]');
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
