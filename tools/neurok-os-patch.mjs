#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  if (parts.some(part => part === '' || part === '.' || part === '..')) {
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
      !Array.isArray(policy.denyExactPaths) || !Array.isArray(policy.denySegments) ||
      !Array.isArray(policy.denyBasenames) || !Array.isArray(policy.denyBasenamePrefixes) ||
      !Array.isArray(policy.denyBasenameSuffixes) || !Array.isArray(policy.humanApprovalPrefixes) ||
      !Array.isArray(policy.humanApprovalExactPaths)) {
    throw new Error('invalid patch policy schema');
  }
  const denied = [];
  const humanApproval = [];
  for (const file of inspection.files) {
    const target = file.path.toLowerCase();
    const segments = target.split('/');
    const basename = segments.at(-1);
    const sensitiveTarget = policy.denyExactPaths.some(item => target === item.toLowerCase()) ||
      policy.denyPrefixes.some(item => target.startsWith(item.toLowerCase())) ||
      policy.denySegments.some(item => segments.includes(item.toLowerCase())) ||
      policy.denyBasenames.some(item => basename === item.toLowerCase()) ||
      policy.denyBasenamePrefixes.some(item => basename.startsWith(item.toLowerCase())) ||
      policy.denyBasenameSuffixes.some(item => basename.endsWith(item.toLowerCase()));
    if (sensitiveTarget) {
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

function readArg(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index < 0 ? undefined : argv[index + 1];
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'inspect') {
    console.error('Usage: node tools/neurok-os-patch.mjs inspect --patch-file FILE [--policy FILE]');
    process.exitCode = 2;
    return;
  }
  const patchFile = readArg(args, 'patch-file');
  if (!patchFile) throw new Error('--patch-file is required');
  const policyFile = readArg(args, 'policy') ?? DEFAULT_POLICY;
  const patch = await readFile(path.resolve(patchFile), 'utf8');
  const policy = JSON.parse(await readFile(path.resolve(policyFile), 'utf8'));
  const inspection = inspectUnifiedDiff(patch);
  console.log(JSON.stringify({ inspection, policy:evaluatePatchPolicy(inspection, policy) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
