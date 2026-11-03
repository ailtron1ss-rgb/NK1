#!/usr/bin/env node
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyReadSet } from './neurok-os-readset.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_POLICY = path.join(ROOT, 'engineering-os', 'patch-policy.v1.json');
const MAX_PATCH_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 500;

function normalizePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') ||
      value.startsWith('/') || /^[a-zA-Z]:/.test(value) || value.includes('\\')) {
    throw new Error(`unsafe patch path: ${String(value)}`);
  }
  const parts = value.split('/');
  if (parts.some(part => part === '' || part === '.' || part === '..' || part.toLowerCase() === '.git')) {
    throw new Error(`unsafe patch path: ${value}`);
  }
  return parts.join('/');
}

function parseDiffPath(raw, prefix) {
  let value = raw.trim();
  const tab = value.indexOf('\t');
  if (tab >= 0) value = value.slice(0, tab);
  if (value.startsWith('"')) {
    let escaped = false;
    let end = -1;
    for (let i = 1; i < value.length; i += 1) {
      if (!escaped && value[i] === '"') { end = i; break; }
      if (!escaped && value[i] === '\\') escaped = true;
      else escaped = false;
    }
    if (end < 0) throw new Error('malformed quoted diff path');
    value = JSON.parse(value.slice(0, end + 1));
  }
  if (value === '/dev/null') return null;
  if (!value.startsWith(prefix)) throw new Error(`expected ${prefix} path in unified diff`);
  return normalizePath(value.slice(2));
}

function parseHunkHeader(line) {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(line);
  if (!match) throw new Error(`malformed unified diff hunk header: ${line}`);
  return {
    oldStart:Number(match[1]), oldExpected:Number(match[2] ?? 1),
    newStart:Number(match[3]), newExpected:Number(match[4] ?? 1),
    oldSeen:0, newSeen:0, oldChanged:[], newChanged:[]
  };
}

function finishHunk(file) {
  const hunk = file?.activeHunk;
  if (!hunk) return;
  if (hunk.oldSeen !== hunk.oldExpected || hunk.newSeen !== hunk.newExpected) {
    throw new Error(`hunk line-count mismatch for ${file.path ?? 'unknown file'}: expected -${hunk.oldExpected}/+${hunk.newExpected}, saw -${hunk.oldSeen}/+${hunk.newSeen}`);
  }
  const range = values => values.length ? { start:Math.min(...values), end:Math.max(...values) } : null;
  file.hunks.push({
    oldRange:hunk.oldExpected ? { start:hunk.oldStart, end:hunk.oldStart + hunk.oldExpected - 1 } : null,
    newRange:hunk.newExpected ? { start:hunk.newStart, end:hunk.newStart + hunk.newExpected - 1 } : null,
    deletedLineRange:range(hunk.oldChanged),
    addedLineRange:range(hunk.newChanged)
  });
  file.activeHunk = null;
}

function finishFile(file, files) {
  if (!file) return;
  finishHunk(file);
  if (!file.oldPath && !file.newPath) throw new Error('diff file is missing ---/+++ paths');
  file.path = file.newPath ?? file.oldPath;
  file.status = !file.oldPath ? 'added' : !file.newPath ? 'deleted' :
    file.oldPath !== file.newPath ? 'renamed' : 'modified';
  files.push({
    path:file.path,
    oldPath:file.oldPath,
    newPath:file.newPath,
    status:file.status,
    hunks:file.hunks
  });
}

export function inspectUnifiedDiff(patch) {
  if (typeof patch !== 'string' || Buffer.byteLength(patch, 'utf8') === 0) throw new Error('patch must be a non-empty UTF-8 string');
  if (Buffer.byteLength(patch, 'utf8') > MAX_PATCH_BYTES) throw new Error('patch exceeds 5 MiB inspection limit');
  const lines = patch.replace(/\r\n/g, '\n').split('\n');
  const files = [];
  let current = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('diff --git ')) {
      finishFile(current, files);
      current = { oldPath:null, newPath:null, hunks:[], activeHunk:null };
      continue;
    }
    if (!current) {
      if (line.trim() === '') continue;
      throw new Error('patch must use git unified diff format beginning with diff --git');
    }
    if (line === 'GIT binary patch' || line.startsWith('Binary files ')) throw new Error('binary patches are not supported by line-range inspection');
    if (line.startsWith('rename from ')) { current.oldPath = normalizePath(line.slice('rename from '.length)); continue; }
    if (line.startsWith('rename to ')) { current.newPath = normalizePath(line.slice('rename to '.length)); continue; }
    if (line.startsWith('--- ')) {
      finishHunk(current);
      current.oldPath = parseDiffPath(line.slice(4), 'a/');
      continue;
    }
    if (line.startsWith('+++ ')) {
      current.newPath = parseDiffPath(line.slice(4), 'b/');
      continue;
    }
    if (line.startsWith('@@ ')) {
      finishHunk(current);
      current.activeHunk = parseHunkHeader(line);
      continue;
    }
    if (line.startsWith('\\ No newline at end of file')) continue;
    if (current.activeHunk) {
      const hunk = current.activeHunk;
      if (line.startsWith('+')) {
        hunk.newChanged.push(hunk.newStart + hunk.newSeen);
        hunk.newSeen += 1;
      } else if (line.startsWith('-')) {
        hunk.oldChanged.push(hunk.oldStart + hunk.oldSeen);
        hunk.oldSeen += 1;
      } else if (line.startsWith(' ')) {
        hunk.oldSeen += 1;
        hunk.newSeen += 1;
      } else if (line === '' && index === lines.length - 1) {
        continue;
      } else {
        throw new Error(`invalid hunk line at ${index + 1}`);
      }
    }
  }
  finishFile(current, files);
  if (files.length === 0) throw new Error('patch contains no file changes');
  if (files.length > MAX_FILES) throw new Error('patch exceeds 500-file inspection limit');
  const seen = new Set();
  for (const file of files) {
    if (seen.has(file.path)) throw new Error(`duplicate patch target: ${file.path}`);
    seen.add(file.path);
  }
  return {
    schemaVersion:1,
    digestSha256:createHash('sha256').update(patch, 'utf8').digest('hex'),
    fileCount:files.length,
    files
  };
}

export function evaluatePatchPolicy(inspection, policy) {
  if (policy?.schemaVersion !== 1 || !Array.isArray(policy.denyPrefixes) ||
      !Array.isArray(policy.denyExactPaths) || !Array.isArray(policy.humanApprovalPrefixes) ||
      !Array.isArray(policy.humanApprovalExactPaths)) {
    throw new Error('invalid patch policy schema');
  }
  const denied = [];
  const humanApproval = [];
  for (const file of inspection.files) {
    const target = file.path.toLowerCase();
    if (policy.denyExactPaths.some(item => target === item.toLowerCase()) ||
        policy.denyPrefixes.some(item => target.startsWith(item.toLowerCase()))) {
      denied.push(file.path);
    } else if (policy.humanApprovalExactPaths.some(item => target === item.toLowerCase()) ||
        policy.humanApprovalPrefixes.some(item => target.startsWith(item.toLowerCase()))) {
      humanApproval.push(file.path);
    }
  }
  return {
    decision:denied.length ? 'deny' : humanApproval.length ? 'human-approval-required' : 'reviewable',
    denied,
    humanApprovalRequired:humanApproval,
    note:'This is a preflight classification only; it does not apply patches or replace independent review.'
  };
}

const FULL_SHA = /^[a-f0-9]{40}$/i;

function blockedAdmission(reason, extra = {}) {
  return Object.freeze({
    decision: 'blocked',
    reason,
    note: 'Patch admission is preflight only; no patch is applied and independent review is still required.',
    ...extra,
  });
}

/**
 * Fail-closed patch admission:
 * 1. verify the receipt against its immutable Git base and the candidate checkout;
 * 2. require a read receipt for every pre-existing file changed by the patch;
 * 3. only then apply the existing deny/human-approval/reviewable policy.
 *
 * This does not apply a patch or prove that an agent semantically understood its inputs.
 */
export function evaluatePatchAdmission(inspection, receipt, options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return blockedAdmission('invalid-read-set');
  }
  const expectedBaseSha = typeof options.expectedBaseSha === 'string'
    ? options.expectedBaseSha.toLowerCase() : '';
  const currentSha = typeof options.currentSha === 'string'
    ? options.currentSha.toLowerCase() : '';
  if (!FULL_SHA.test(expectedBaseSha)) return blockedAdmission('invalid-task-base-sha');
  if (!FULL_SHA.test(currentSha)) return blockedAdmission('invalid-current-sha');
  if (!inspection || inspection.schemaVersion !== 1 || !Array.isArray(inspection.files) ||
      inspection.files.length < 1 || inspection.files.length > MAX_FILES ||
      typeof inspection.digestSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(inspection.digestSha256)) {
    return blockedAdmission('invalid-patch-inspection');
  }

  let readSet;
  try {
    readSet = verifyReadSet(receipt, { root, currentSha });
  } catch (error) {
    return blockedAdmission('invalid-read-set', {
      error: String(error?.message ?? error).slice(0, 180),
    });
  }
  if (readSet.baseSha !== expectedBaseSha) {
    return blockedAdmission('task-base-mismatch', { readSet, expectedBaseSha });
  }
  if (!readSet.ok) {
    return blockedAdmission('stale-read-set', { readSet });
  }

  let requiredReadPaths;
  try {
    requiredReadPaths = [...new Set(inspection.files.map(file => {
      if (!file || typeof file !== 'object') throw new Error('invalid patch file entry');
      if (file.oldPath === null || file.oldPath === undefined) return null;
      return normalizePath(file.oldPath);
    }).filter(Boolean))].sort();
  } catch (error) {
    return blockedAdmission('invalid-patch-inspection', {
      error: String(error?.message ?? error).slice(0, 180),
      readSet,
    });
  }

  const covered = new Set(readSet.unchangedPaths);
  const coveredReadPaths = requiredReadPaths.filter(filePath => covered.has(filePath));
  const missingReadPaths = requiredReadPaths.filter(filePath => !covered.has(filePath));
  if (missingReadPaths.length) {
    return blockedAdmission('missing-patch-target-context', {
      readSet,
      requiredReadPaths,
      coveredReadPaths,
      missingReadPaths,
    });
  }

  let policyDecision;
  try {
    policyDecision = evaluatePatchPolicy(inspection, options.policy);
  } catch (error) {
    return blockedAdmission('invalid-patch-policy', {
      readSet,
      requiredReadPaths,
      coveredReadPaths,
      error: String(error?.message ?? error).slice(0, 180),
    });
  }
  return Object.freeze({
    decision: policyDecision.decision,
    reason: 'fresh-read-set',
    patchDigestSha256: inspection.digestSha256,
    expectedBaseSha,
    currentSha,
    requiredReadPaths: Object.freeze(requiredReadPaths),
    coveredReadPaths: Object.freeze(coveredReadPaths),
    missingReadPaths: Object.freeze([]),
    readSet,
    policy: policyDecision,
    note: 'Fresh read-set verified. This is still preflight only; no patch is applied and independent review is required.',
  });
}

async function repositoryFile(input, label) {
  if (typeof input !== 'string' || !input.trim()) throw new Error(label + ' is required');
  const lexical = path.resolve(ROOT, input);
  if (lexical !== ROOT && !lexical.startsWith(ROOT + path.sep)) {
    throw new Error(label + ' must stay inside the repository');
  }
  // Lexical containment alone does not prevent a repository symlink from
  // pointing outside the checkout. Resolve the final path before reading it.
  const resolved = await realpath(lexical);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    throw new Error(label + ' resolves outside the repository');
  }
  return resolved;
}

function readArg(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index < 0 ? undefined : argv[index + 1];
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!['inspect', 'admit'].includes(command)) {
    console.error('Usage: node tools/neurok-os-patch.mjs inspect --patch-file FILE [--policy FILE] | admit --patch-file FILE --read-set RECEIPT --base-sha FULL_SHA [--current-sha FULL_SHA] [--policy FILE]');
    process.exitCode = 2;
    return;
  }
  const patchFile = readArg(args, 'patch-file');
  if (!patchFile) throw new Error('--patch-file is required');
  const patchPath = await repositoryFile(patchFile, 'patch file');
  const policyFile = await repositoryFile(readArg(args, 'policy') ?? 'engineering-os/patch-policy.v1.json', 'policy file');
  const patchBytes = await readFile(patchPath);
  if (patchBytes.length > MAX_PATCH_BYTES) throw new Error('patch exceeds 5 MiB inspection limit');
  const policy = JSON.parse(await readFile(policyFile, 'utf8'));
  const inspection = inspectUnifiedDiff(patchBytes.toString('utf8'));
  if (command === 'inspect') {
    console.log(JSON.stringify({ inspection, policy:evaluatePatchPolicy(inspection, policy) }, null, 2));
    return;
  }

  const receiptFile = readArg(args, 'read-set');
  const expectedBaseSha = readArg(args, 'base-sha');
  const currentSha = readArg(args, 'current-sha') ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!receiptFile) throw new Error('--read-set is required');
  if (!expectedBaseSha) throw new Error('--base-sha is required');
  const receiptPath = await repositoryFile(receiptFile, 'read-set receipt');
  const receiptBytes = await readFile(receiptPath);
  if (receiptBytes.length > 256 * 1024) throw new Error('read-set receipt exceeds 256 KiB');
  const receipt = JSON.parse(receiptBytes.toString('utf8'));
  const result = evaluatePatchAdmission(inspection, receipt, {
    root: ROOT, expectedBaseSha, currentSha, policy,
  });
  console.log(JSON.stringify({ inspection, admission: result }, null, 2));
  if (result.decision === 'blocked' || result.decision === 'deny') process.exitCode = 1;
  else if (result.decision === 'human-approval-required') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
