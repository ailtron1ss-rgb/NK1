#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_ENTRIES = 1000;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const SHA40 = /^[a-f0-9]{40}$/i;
const SHA64 = /^[a-f0-9]{64}$/i;

function normalizeReadSetPath(input) {
  if (typeof input !== "string" || input.length === 0 || input.includes("\0") ||
      /[\u0000-\u001f\u007f]/.test(input) || input.includes(":") ||
      input.startsWith("/") || input.startsWith("\\") || /^[a-zA-Z]:/.test(input) ||
      input.includes("\\")) {
    throw new Error("unsafe read-set path: " + String(input));
  }
  const parts = input.split("/");
  if (parts.some(part => part === "" || part === "." || part === ".." || part.toLowerCase() === ".git")) {
    throw new Error("unsafe read-set path: " + input);
  }
  return parts.join("/");
}

function git(args, root) {
  return execFileSync("git", args, {
    cwd: root,
    maxBuffer: MAX_FILE_BYTES + 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function requireCommit(sha, root, label) {
  if (typeof sha !== "string" || !SHA40.test(sha)) {
    throw new Error(label + " must be a full 40-character Git SHA");
  }
  try {
    git(["cat-file", "-e", sha.toLowerCase() + "^{commit}"], root);
  } catch {
    throw new Error(label + " is not an available Git commit");
  }
  return sha.toLowerCase();
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readAt(commit, filePath, root) {
  try {
    return git(["show", commit + ":" + filePath], root);
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? "");
    if (/does not exist in|path .* does not exist|exists on disk, but not in/i.test(detail)) return null;
    throw new Error("cannot read " + filePath + " at " + commit + ": " + detail.slice(0, 300));
  }
}

function denseArray(value, maximum) {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const length = lengthDescriptor && Object.prototype.hasOwnProperty.call(lengthDescriptor, "value")
      ? lengthDescriptor.value : Number.NaN;
    if (!Number.isSafeInteger(length) || length < 1 || length > maximum) return null;
    const result = [];
    for (let i = 0; i < length; i += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function ownRecord(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownData(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")
      ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function validateReceipt(receipt) {
  if (!ownRecord(receipt)) throw new Error("read-set receipt must be a plain data record");
  if (ownData(receipt, "schemaVersion") !== 1) throw new Error("unsupported read-set receipt schema");
  if (ownData(receipt, "algorithm") !== "sha256") throw new Error("unsupported read-set hash algorithm");
  const baseSha = ownData(receipt, "baseSha");
  if (typeof baseSha !== "string" || !SHA40.test(baseSha)) throw new Error("receipt baseSha must be a full Git SHA");
  const rawEntries = denseArray(ownData(receipt, "entries"), MAX_ENTRIES);
  if (!rawEntries) throw new Error("receipt entries must be a dense array of 1-1000 rows");
  const entries = [];
  const seen = new Set();
  for (const raw of rawEntries) {
    if (!ownRecord(raw)) throw new Error("receipt entries must contain plain data records");
    const filePath = normalizeReadSetPath(ownData(raw, "path"));
    const sha256 = ownData(raw, "sha256");
    if (typeof sha256 !== "string" || !SHA64.test(sha256)) throw new Error("receipt contains an invalid SHA-256 digest");
    if (seen.has(filePath)) throw new Error("receipt contains duplicate paths");
    seen.add(filePath);
    entries.push({ path: filePath, sha256: sha256.toLowerCase() });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { baseSha: baseSha.toLowerCase(), entries };
}

export function captureReadSet(paths, options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  const baseSha = requireCommit(options.baseSha, root, "baseSha");
  const requested = denseArray(paths, MAX_ENTRIES);
  if (!requested) throw new Error("paths must be a dense array of 1-1000 repository-relative paths");
  const normalized = requested.map(normalizeReadSetPath);
  if (new Set(normalized).size !== normalized.length) throw new Error("duplicate read-set paths are not allowed");
  let totalBytes = 0;
  const entries = [];
  for (const filePath of normalized) {
    const bytes = readAt(baseSha, filePath, root);
    if (!bytes) throw new Error("read-set path is missing at base SHA: " + filePath);
    if (bytes.length > MAX_FILE_BYTES) throw new Error("read-set file exceeds the 16 MiB limit: " + filePath);
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("read-set exceeds the 64 MiB total limit");
    entries.push({ path: filePath, sha256: hash(bytes) });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return Object.freeze({
    schemaVersion: 1,
    algorithm: "sha256",
    baseSha,
    entries: Object.freeze(entries.map(entry => Object.freeze(entry)))
  });
}

export function verifyReadSet(receipt, options = {}) {
  const root = path.resolve(options.root ?? ROOT);
  const currentSha = requireCommit(options.currentSha, root, "currentSha");
  const normalized = validateReceipt(receipt);
  const baseSha = requireCommit(normalized.baseSha, root, "receipt baseSha");
  const stalePaths = [];
  const invalidPaths = [];
  const unchangedPaths = [];
  let totalBytes = 0;

  for (const entry of normalized.entries) {
    const baseBytes = readAt(baseSha, entry.path, root);
    if (!baseBytes || hash(baseBytes) !== entry.sha256) {
      invalidPaths.push(entry.path);
      continue;
    }
    const currentBytes = readAt(currentSha, entry.path, root);
    if (!currentBytes) {
      stalePaths.push({ path: entry.path, reason: "missing" });
      continue;
    }
    totalBytes += currentBytes.length;
    if (currentBytes.length > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_BYTES) {
      invalidPaths.push(entry.path);
      continue;
    }
    if (hash(currentBytes) !== entry.sha256) stalePaths.push({ path: entry.path, reason: "content-changed" });
    else unchangedPaths.push(entry.path);
  }

  return Object.freeze({
    ok: stalePaths.length === 0 && invalidPaths.length === 0,
    baseSha,
    currentSha,
    checkedCount: normalized.entries.length,
    unchangedPaths: Object.freeze(unchangedPaths),
    stalePaths: Object.freeze(stalePaths),
    invalidPaths: Object.freeze(invalidPaths)
  });
}

function parseArgs(argv) {
  const result = { paths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error("unexpected argument: " + token);
    const key = token.slice(2);
    if (key === "path") result.paths.push(argv[++index]);
    else result[key] = argv[++index];
    if (result[key] === undefined) throw new Error("missing value for --" + key);
  }
  return result;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === "capture") {
    const receipt = captureReadSet(args.paths, { baseSha: args.base, root: ROOT });
    const output = args.out ? path.resolve(ROOT, args.out) : path.join(ROOT, "read-set.receipt.json");
    const temporary = output + "." + process.pid + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    await rename(temporary, output);
    console.log(JSON.stringify({ ok: true, output, entries: receipt.entries.length, baseSha: receipt.baseSha }, null, 2));
    return;
  }
  if (command === "verify") {
    if (!args.receipt) throw new Error("verify requires --receipt");
    const currentSha = args.current ?? git(["rev-parse", "HEAD"], ROOT).toString("utf8").trim();
    const receipt = JSON.parse(await readFile(path.resolve(ROOT, args.receipt), "utf8"));
    const result = verifyReadSet(receipt, { currentSha, root: ROOT });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  console.error("Usage: node tools/neurok-os-readset.mjs capture --base FULL_SHA --path FILE [--path FILE...] [--out RECEIPT] | verify --receipt RECEIPT [--current FULL_SHA]");
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
