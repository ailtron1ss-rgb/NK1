#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = path.join(ROOT, '.neurok-os', 'evidence');
const TOP_KEYS = new Set([
  'schemaVersion','receiptId','recordedAt','repository','branch','commitSha',
  'workstream','taskId','status','command','environment','result','artifacts','dataset','metrics'
]);
const SECRET_PATTERN = /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|Bearer\s+\S+|password\s*=|api[_-]?key\s*=)/i;
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;

function onlyKeys(value, allowed, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${label} contains unsupported field: ${key}`);
  return true;
}

export function validateEvidenceReceipt(receipt, expectedSha) {
  const errors = [];
  if (!onlyKeys(receipt, TOP_KEYS, 'receipt', errors)) return { ok:false, errors };
  const required = ['schemaVersion','receiptId','recordedAt','repository','branch','commitSha','workstream','taskId','status','command','environment','result'];
  for (const key of required) if (!(key in receipt)) errors.push(`missing required field: ${key}`);
  if (receipt.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.receiptId ?? '')) errors.push('receiptId must be a UUID');
  if (typeof receipt.recordedAt !== 'string' || !Number.isFinite(Date.parse(receipt.recordedAt))) errors.push('recordedAt must be an ISO date-time');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(receipt.repository ?? '')) errors.push('repository must be owner/name');
  if (typeof receipt.branch !== 'string' || !receipt.branch || receipt.branch.length > 255) errors.push('branch is required and must be at most 255 characters');
  if (!SHA40.test((receipt.commitSha ?? '').toLowerCase())) errors.push('commitSha must be a full 40-character SHA');
  if (expectedSha && receipt.commitSha?.toLowerCase() !== expectedSha.toLowerCase()) errors.push('receipt commitSha does not match expected exact SHA');
  if (!/^[A-Z0-9][A-Z0-9._-]{1,31}$/.test(receipt.workstream ?? '')) errors.push('workstream must be a bounded uppercase identifier');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(receipt.taskId ?? '')) errors.push('taskId is invalid');
  if (!['PASS','FAIL','BLOCKED','UNKNOWN'].includes(receipt.status)) errors.push('status is invalid');
  if (typeof receipt.command !== 'string' || !receipt.command.trim() || receipt.command.length > 500 || SECRET_PATTERN.test(receipt.command)) {
    errors.push('command is required, bounded, and must not contain secret-like values');
  }
  if (onlyKeys(receipt.environment, new Set(['nodeVersion','platform','arch']), 'environment', errors)) {
    for (const key of ['nodeVersion','platform','arch']) {
      if (typeof receipt.environment[key] !== 'string' || !receipt.environment[key] || receipt.environment[key].length > 32) errors.push(`environment.${key} is required`);
    }
  }
  if (onlyKeys(receipt.result, new Set(['exitCode','durationMs']), 'result', errors)) {
    if (!Number.isInteger(receipt.result.exitCode)) errors.push('result.exitCode must be an integer');
    if (receipt.status === 'PASS' && receipt.result.exitCode !== 0) errors.push('PASS status requires exitCode 0');
    if (receipt.status === 'FAIL' && receipt.result.exitCode === 0) errors.push('FAIL status requires a non-zero exitCode');
    if (!Number.isFinite(receipt.result.durationMs) || receipt.result.durationMs < 0) errors.push('result.durationMs must be a finite non-negative number');
  }
  if (receipt.artifacts !== undefined) {
    if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length > 100) errors.push('artifacts must be an array of at most 100 items');
    else for (const [i,item] of receipt.artifacts.entries()) {
      if (!onlyKeys(item,new Set(['name','sha256','sizeBytes']),`artifacts[${i}]`,errors)) continue;
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(item.name ?? '')) errors.push(`artifacts[${i}].name is invalid`);
      if (!SHA64.test((item.sha256 ?? '').toLowerCase())) errors.push(`artifacts[${i}].sha256 is invalid`);
      if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 0) errors.push(`artifacts[${i}].sizeBytes is invalid`);
    }
  }
  if (receipt.dataset !== undefined) {
    if (onlyKeys(receipt.dataset,new Set(['id','sha256','split']),'dataset',errors)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(receipt.dataset.id ?? '')) errors.push('dataset.id is invalid');
      if (!SHA64.test((receipt.dataset.sha256 ?? '').toLowerCase())) errors.push('dataset.sha256 is invalid');
      if (!['train','validation','holdout','test'].includes(receipt.dataset.split)) errors.push('dataset.split is invalid');
    }
  }
  if (receipt.metrics !== undefined) {
    if (!receipt.metrics || typeof receipt.metrics !== 'object' || Array.isArray(receipt.metrics) || Object.keys(receipt.metrics).length > 100) {
      errors.push('metrics must be an object with at most 100 numeric entries');
    } else for (const [key,value] of Object.entries(receipt.metrics)) {
      if (!/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(key) || !Number.isFinite(value)) errors.push(`metric ${key} must have a safe key and finite numeric value`);
    }
  }
  return { ok:errors.length === 0, errors };
}

export async function recordEvidence(receipt, options = {}) {
  const expectedSha = options.expectedSha ?? execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  const validation = validateEvidenceReceipt(receipt, expectedSha);
  if (!validation.ok) throw new Error(`evidence receipt rejected: ${validation.errors.join('; ')}`);
  const directory = path.resolve(options.directory ?? process.env.NEUROK_OS_EVIDENCE_DIR ?? DEFAULT_DIR, receipt.commitSha.toLowerCase());
  await mkdir(directory,{recursive:true,mode:0o700});
  const target = path.join(directory,`${receipt.receiptId}.json`);
  const content = `${JSON.stringify(receipt,null,2)}\n`;
  await writeFile(target,content,{flag:'wx',mode:0o600});
  return { path:target, sha256:createHash('sha256').update(content).digest('hex'), commitSha:receipt.commitSha.toLowerCase() };
}

function readArg(argv,name) {
  const index=argv.indexOf(`--${name}`);
  return index<0?undefined:argv[index+1];
}

async function main() {
  const [command,...args]=process.argv.slice(2);
  const file=readArg(args,'receipt-file');
  if (!file) throw new Error('--receipt-file is required');
  const receipt=JSON.parse(await readFile(path.resolve(file),'utf8'));
  if (command==='validate') {
    const expectedSha=readArg(args,'expected-sha');
    if (!expectedSha) throw new Error('--expected-sha is required for exact-SHA validation');
    const result=validateEvidenceReceipt(receipt,expectedSha);
    console.log(JSON.stringify(result,null,2));
    if (!result.ok) process.exitCode=1;
    return;
  }
  if (command==='record') {
    const result=await recordEvidence(receipt);
    console.log(JSON.stringify(result,null,2));
    return;
  }
  console.error('Usage: node tools/neurok-os-evidence.mjs [validate --receipt-file FILE --expected-sha SHA | record --receipt-file FILE]');
  process.exitCode=2;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
