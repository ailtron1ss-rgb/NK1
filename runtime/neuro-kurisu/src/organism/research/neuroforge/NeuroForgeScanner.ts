import { createHash } from 'node:crypto';
import { lstat, open, readdir } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { readNeuroForgeGitProvenance, type NeuroForgeGitProvenance } from './NeuroForgeGitProvenance.ts';

export type NeuroForgeFileRole = 'source' | 'test' | 'documentation' | 'configuration' | 'license' | 'asset' | 'other';
export type NeuroForgeCapabilityId =
  | 'memory-retrieval'
  | 'durable-workflows'
  | 'agent-tools'
  | 'model-serving'
  | 'model-provider-adapters'
  | 'voice'
  | 'embodied-interaction'
  | 'evaluation'
  | 'observability'
  | 'sandbox-security'
  | 'simulation-rl'
  | 'symbolic-reasoning'
  | 'reproducible-builds'
  | 'vector-retrieval'
  | 'coding-agents';

export interface NeuroForgeScanOptions {
  projectId?: string;
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxDepth?: number;
  maxTextBytes?: number;
}

export interface NeuroForgeFileRecord {
  path: string;
  sizeBytes: number;
  sha256: string;
  language: string;
  role: NeuroForgeFileRole;
}

export interface NeuroForgeCapabilitySignal {
  capabilityId: NeuroForgeCapabilityId;
  confidence01: number;
  evidenceLevel: 'implementation' | 'content-only' | 'example-or-test' | 'configuration-only';
  evidenceFiles: string[];
}

export interface NeuroForgeProjectManifest {
  schemaVersion: 2;
  projectId: string;
  rootName: string;
  rootPath: string;
  scannedAt: number;
  projectVersion: string | null;
  upstreamRevision: string | null;
  sourceProvenance: NeuroForgeGitProvenance;
  snapshotSha256: string;
  stats: {
    files: number;
    sourceFiles: number;
    testFiles: number;
    documentationFiles: number;
    configurationFiles: number;
    assetFiles: number;
    totalBytes: number;
    skippedFiles: number;
  };
  languages: Record<string, number>;
  rootLicense: {
    path: string | null;
    spdxId: string | null;
    status: 'identified' | 'unknown' | 'missing' | 'nested-only';
  };
  licenseFiles: Array<{ path: string; scope: 'root' | 'nested'; spdxId: string | null; sha256: string }>;
  noticeFiles: string[];
  dependencies: string[];
  externalImports: string[];
  securityFindings: Array<{ path: string; kind: 'credential-file' | 'possible-secret-assignment'; severity: 'high' | 'review'; line?: number }>;
  capabilitySignals: NeuroForgeCapabilitySignal[];
  warnings: string[];
  files: NeuroForgeFileRecord[];
}

const IGNORE_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'dist', 'build', 'out', '.next',
  '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', 'coverage',
  '.turbo', '.cache', 'target',
]);
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.pyi', '.go', '.rs',
  '.java', '.kt', '.kts', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb',
  '.php', '.swift', '.scala', '.sql', '.sh', '.ps1',
]);
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.adoc', '.txt']);
const CONFIG_NAMES = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'cargo.toml', 'go.mod',
  'tsconfig.json', 'dockerfile', 'makefile', 'flake.nix',
]);
const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg', '.woff', '.woff2',
  '.ttf', '.otf', '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.glb', '.gltf',
  '.vrm', '.onnx', '.bin', '.pt', '.pth', '.safetensors', '.zip', '.7z', '.pdf',
]);

const CAPABILITY_RULES: Array<{ id: NeuroForgeCapabilityId; pattern: RegExp }> = [
  { id: 'memory-retrieval', pattern: /\b(memory(?:os|store|graph|retrieval)?|mem0|letta|retriev(?:al|er)|recall|episodic|semantic(?:memory|search)?)\b/i },
  { id: 'durable-workflows', pattern: /\b(temporal|durable[\s_-]?workflow(?:[\s_-]?(?:engine|orchestrat))?|workflow[\s_-]?(engine|orchestrat)|checkpoint[\s_-]?workflow)\b/i },
  { id: 'agent-tools', pattern: /\b(browser[\s_-]?use|openhands|swe[\s_-]?agent|model[\s_-]?context[\s_-]?protocol|mcp[\s_-]?(?:server|client)|tool[\s_-]?(?:call|executor|registry|gateway|contract)|action[\s_-]?gateway|plugin[\s_-]?gateway|external[\s_-]?project[\s_-]?research)\b/i },
  { id: 'model-serving', pattern: /\b(vllm|llama[\s._-]?cpp[\s_-]?(?:server|runtime)|tgi|text[\s_-]?generation[\s_-]?inference|inference[\s_-]?server|model[\s_-]?serving|local[\s_-]?inference[\s_-]?runtime|ollama[\s_-]?(?:serve|server)|sglang|triton[\s_-]?inference)\b/i },
  { id: 'model-provider-adapters', pattern: /\b(ollama|openai[\s_-]?(?:compatible|chat)|litellm|llm[\s_-]?provider|model[\s_-]?provider|provider[\s_-]?(?:adapter|registry)|chat[\s_-]?client|embedding[\s_-]?(?:function|provider|client)|local[\s_-]?embedding[\s_-]?provider)\b/i },
  { id: 'voice', pattern: /\b(whisper|asr|tts|piper|speech|audio|voice|phoneme|transcription)\b/i },
  { id: 'embodied-interaction', pattern: /\b(avatar|live2d|robotics?|lerobot|kinematic|vrm|embodiment|sensorimotor)\b/i },
  { id: 'evaluation', pattern: /\b(inspect[\s_-]?ai|evaluation[\s_-]?(?:harness|suite|runner|framework)|benchmark[\s_-]?(?:runner|suite|harness)|holdout|scorer|paired[\s_-]?evaluation)\b/i },
  { id: 'observability', pattern: /\b(telemetry|opentelemetry|distributed[\s_-]?tracing|trace[\s_-]?ledger|metrics[\s_-]?(?:collector|exporter)|flight[\s_-]?recorder|structured[\s_-]?logging)\b/i },
  { id: 'sandbox-security', pattern: /\b(sandbox(?:ing)?|firecracker|opa[\s_-]?(?:policy|rego)|policy[\s_-]?engine|security[\s_-]?(?:gate|boundary|scanner)|secret[\s_-]?scanner|credential[\s_-]?scanner)\b/i },
  { id: 'simulation-rl', pattern: /\b(gymnasium|cleanrl|genesis[\s_-]?sim|simulator|reinforcement[\s_-]?learning|policy[\s_-]?gradient|environment[\s_-]?rollout)\b/i },
  { id: 'symbolic-reasoning', pattern: /\b(hyperon|metta|open[\s_-]?nars|soar|symbolic[\s_-]?reason(?:ing)?|atomspace|neuro[\s_-]?symbolic|concept[\s_-]?compiler)\b/i },
  { id: 'reproducible-builds', pattern: /\b(nix|lockfile|package[\s_-]?lock|pnpm[\s_-]?lock|yarn[\s_-]?lock|cargo[\s_-]?lock|poetry[\s_-]?lock|uv[\s_-]?lock|reproducible[\s_-]?build|dockerfile|flake\.nix|build[\s_-]?provenance|software[\s_-]?bill[\s_-]?of[\s_-]?materials)\b/i },
  { id: 'vector-retrieval', pattern: /\b(faiss|chroma|vector[\s_-]?(?:search|index|store)|embedding(?:s)?|ann[\s_-]?index|hnsw)\b/i },
  { id: 'coding-agents', pattern: /\b(openhands|swe[\s_-]?agent|mini[\s_-]?swe|repository[\s_-]?(?:agent|editor)|coding[\s_-]?(?:agent|context)|code[\s_-]?agent|patch[\s_-]?appl(?:ier|y)|computer[\s_-]?use[\s_-]?agent)\b/i },
];

const CAPABILITY_CONTENT_RULES: Record<NeuroForgeCapabilityId, RegExp> = {
  'memory-retrieval': /\b(mem0|letta|episodic[\s_-]?memory|semantic[\s_-]?memory|memory[\s_-]?(?:retrieval|store|consolidation|index)|memoryos)\b/i,
  'durable-workflows': /\b(temporal[\s_-]?(?:workflow|sdk)|durable[\s_-]?workflow|workflow[\s_-]?engine|checkpoint[\s_-]?workflow)\b/i,
  'agent-tools': /\b(model[\s_-]?context[\s_-]?protocol|mcp[\s_-]?(?:server|client)|tool[\s_-]?(?:executor|registry|gateway|contract)|action[\s_-]?gateway|plugin[\s_-]?gateway|external[\s_-]?project[\s_-]?research|browser[\s_-]?use|openhands|swe[\s_-]?agent)\b/i,
  'model-serving': /\b(vllm|llama[\s._-]?cpp[\s_-]?(?:server|runtime)|text[\s_-]?generation[\s_-]?inference|inference[\s_-]?server|model[\s_-]?serving|local[\s_-]?inference[\s_-]?runtime|ollama[\s_-]?(?:serve|server)|sglang|triton[\s_-]?inference)\b/i,
  'model-provider-adapters': /\b(ollama|openai[\s_-]?(?:compatible|chat)|litellm|llm[\s_-]?provider|model[\s_-]?provider|provider[\s_-]?(?:adapter|registry)|chat[\s_-]?client|embedding[\s_-]?(?:function|provider|client)|local[\s_-]?embedding[\s_-]?provider)\b/i,
  'voice': /\b(whisper|asr|tts|piper|speech[\s_-]?to[\s_-]?text|text[\s_-]?to[\s_-]?speech|voice[\s_-]?synthesis)\b/i,
  'embodied-interaction': /\b(live2d|vrm|lerobot|sensorimotor|embodiment|kinematic[\s_-]?control)\b/i,
  'evaluation': /\b(inspect[\s_-]?ai|evaluation[\s_-]?(?:harness|suite|runner)|benchmark[\s_-]?(?:runner|suite|harness)|holdout|scorer|paired[\s_-]?evaluation)\b/i,
  'observability': /\b(telemetry|opentelemetry|distributed[\s_-]?tracing|trace[\s_-]?ledger|metrics[\s_-]?(?:collector|exporter)|flight[\s_-]?recorder|structured[\s_-]?logging)\b/i,
  'sandbox-security': /\b(sandbox(?:ing)?|firecracker|opa[\s_-]?(?:policy|rego)|rego[\s_-]?policy|policy[\s_-]?engine|security[\s_-]?(?:gate|boundary|scanner)|secret[\s_-]?scanner|credential[\s_-]?scanner)\b/i,
  'simulation-rl': /\b(gymnasium|cleanrl|genesis[\s_-]?sim|reinforcement[\s_-]?learning|policy[\s_-]?gradient|environment[\s_-]?rollout)\b/i,
  'symbolic-reasoning': /\b(hyperon|metta|open[\s_-]?nars|soar|symbolic[\s_-]?reason(?:ing)?|atomspace|neuro[\s_-]?symbolic|concept[\s_-]?compiler)\b/i,
  'reproducible-builds': /\b(reproducible[\s_-]?build|hermetic[\s_-]?build|build[\s_-]?provenance|software[\s_-]?bill[\s_-]?of[\s_-]?materials|sbom|lockfile[\s_-]?integrity|dependency[\s_-]?lockfile[\s_-]?verification)\b/i,
  'vector-retrieval': /\b(faiss|chroma|vector[\s_-]?(?:search|index|store)|embedding[\s_-]?(?:model|index|provider)|ann[\s_-]?index|hnsw)\b/i,
  'coding-agents': /\b(openhands|swe[\s_-]?agent|mini[\s_-]?swe|repository[\s_-]?(?:agent|editor)|coding[\s_-]?(?:agent|context)|code[\s_-]?agent|patch[\s_-]?appl(?:ier|y)|computer[\s_-]?use[\s_-]?agent)\b/i,
};

const BUILD_CONFIG_EVIDENCE_PATH = /(^|\/)(dockerfile|docker-compose(?:\.[^/]*)?\.ya?ml|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.lock|poetry\.lock|uv\.lock|flake\.nix|flake\.lock|nix\.conf)$/i;
const isDependencyManifest = (base: string): boolean => base === 'package.json' || base === 'go.mod' || base === 'cargo.toml' || /^requirements(?:[-_.].*)?\.txt$/.test(base);

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readBoundedFile(path: string, maxBytes: number): Promise<{
  data: Buffer | null;
  reason: 'read-failed' | 'file-size-limit' | 'not-regular-file' | null;
}> {
  const handle = await open(path, 'r').catch(() => null);
  if (!handle) return { data: null, reason: 'read-failed' };

  try {
    const current = await handle.stat();
    const pathCurrent = await lstat(path).catch(() => null);
    if (!current.isFile() || !pathCurrent || pathCurrent.isSymbolicLink() || !pathCurrent.isFile() ||
        current.dev !== pathCurrent.dev || current.ino !== pathCurrent.ino) {
      return { data: null, reason: 'not-regular-file' };
    }
    if (current.size > maxBytes) return { data: null, reason: 'file-size-limit' };

    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= maxBytes) {
      const capacity = Math.min(64 * 1024, maxBytes + 1 - total);
      const chunk = Buffer.alloc(capacity);
      const { bytesRead } = await handle.read(chunk, 0, capacity, null);
      if (bytesRead === 0) return { data: Buffer.concat(chunks, total), reason: null };
      total += bytesRead;
      if (total > maxBytes) return { data: null, reason: 'file-size-limit' };
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return { data: null, reason: 'file-size-limit' };
  } catch {
    return { data: null, reason: 'read-failed' };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function extensionOf(value: string): string {
  const name = basename(value);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

function normalizedPath(value: string): string {
  return value.split('\\').join('/');
}

function fileRole(relativePath: string): NeuroForgeFileRole {
  const base = basename(relativePath).toLowerCase();
  const extension = extensionOf(base);
  if (/^(license|licence|copying)(\.|$)/i.test(base)) return 'license';
  if (/^notice(\.|$)/i.test(base)) return 'other';
  if (/(^|\/)(__tests__|tests?)(\/|$)|(?:^|[_-])tests?\.[^.]+$|^test[_-].+\.[^.]+$|\.(test|spec)\./i.test(relativePath)) return 'test';
  if (CONFIG_NAMES.has(base) || isDependencyManifest(base) || BUILD_CONFIG_EVIDENCE_PATH.test(relativePath) || /(^|\/)(\.github|\.devcontainer)(\/|$)/i.test(relativePath) || extension === '.yml' || extension === '.yaml' || extension === '.toml') return 'configuration';
  if (DOC_EXTENSIONS.has(extension)) return 'documentation';
  if (SOURCE_EXTENSIONS.has(extension)) return 'source';
  if (ASSET_EXTENSIONS.has(extension)) return 'asset';
  return 'other';
}

function languageFor(relativePath: string): string {
  const base = basename(relativePath).toLowerCase();
  if (base === 'dockerfile') return 'docker';
  if (base === 'makefile') return 'make';
  const extension = extensionOf(base);
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.mjs': 'javascript', '.cjs': 'javascript', '.py': 'python', '.pyi': 'python',
    '.go': 'go', '.rs': 'rust', '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin',
    '.c': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.h': 'c-header', '.hpp': 'cpp-header',
    '.cs': 'csharp', '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.scala': 'scala',
    '.sql': 'sql', '.sh': 'shell', '.ps1': 'powershell', '.md': 'markdown',
    '.mdx': 'markdown', '.rst': 'restructuredtext', '.json': 'json', '.toml': 'toml',
    '.yml': 'yaml', '.yaml': 'yaml', '.css': 'css', '.html': 'html',
  };
  return map[extension] ?? 'other';
}

function isCredentialPath(relativePath: string): boolean {
  const base = basename(relativePath).toLowerCase();
  if (/^\.env(?:$|\.)/.test(base) && !/\.(example|sample|template|default|defaults|dist)(?:\.|$)/.test(base)) return true;
  return /(id_rsa|id_ed25519|credentials?\.(json|ya?ml)|secrets?\.(json|ya?ml)|\.(pem|p12|pfx|key))$/i.test(base);
}

function detectSpdx(text: string): string | null {
  if (/MIT License|Permission is hereby granted, free of charge/i.test(text)) return 'MIT';
  if (/Apache License(?:,\s*|\s+)Version 2\.0|Apache-2\.0/i.test(text)) return 'Apache-2.0';
  if (/GNU AFFERO GENERAL PUBLIC LICENSE.*Version 3|AGPL-3\.0/i.test(text)) return 'AGPL-3.0-or-later';
  if (/GNU GENERAL PUBLIC LICENSE.*Version 3|GPL-3\.0/i.test(text)) return 'GPL-3.0-or-later';
  if (/GNU LESSER GENERAL PUBLIC LICENSE.*Version 3|LGPL-3\.0/i.test(text)) return 'LGPL-3.0-or-later';
  if (/Mozilla Public License Version 2\.0|MPL-2\.0/i.test(text)) return 'MPL-2.0';
  if (/BSD 3-Clause|Redistribution and use in source and binary forms, with or without modification/i.test(text)) return 'BSD-3-Clause';
  if (/BSD 2-Clause/i.test(text)) return 'BSD-2-Clause';
  if (/ISC License/i.test(text)) return 'ISC';
  if (/Creative Commons Attribution[- ]4\.0(?: International)?|Attribution 4\.0 International|CC[ -]?BY[ -]?4\.0|CC-BY-4\.0/i.test(text)) return 'CC-BY-4.0';
  if (/Creative Commons Attribution-ShareAlike 4\.0|CC[ -]?BY[ -]?SA[ -]?4\.0/i.test(text)) return 'CC-BY-SA-4.0';
  if (/Creative Commons Zero v1\.0 Universal|CC0-1\.0/i.test(text)) return 'CC0-1.0';
  if (/The Unlicense/i.test(text)) return 'Unlicense';
  return null;
}

function addDependency(target: Set<string>, raw: unknown): void {
  const value = String(raw ?? '').trim();
  if (!value || value.startsWith('#') || value.startsWith('-')) return;
  const name = value.split(/[<>=!~;\s[]/)[0]?.trim();
  if (name && /^[A-Za-z0-9@._/-]+$/.test(name)) target.add(name);
}

function parseDependencies(relativePath: string, text: string, target: Set<string>): void {
  const base = basename(relativePath).toLowerCase();
  if (base === 'package.json') {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        const values = parsed[key];
        if (values && typeof values === 'object') {
          for (const name of Object.keys(values as Record<string, unknown>)) addDependency(target, name);
        }
      }
    } catch { /* malformed manifests remain visible as source evidence, not trusted dependencies */ }
    return;
  }
  if (/^requirements(?:[-_.].*)?\.txt$/.test(base)) {
    for (const line of text.split(/\r?\n/)) addDependency(target, line.replace(/\s+#.*$/, ''));
    return;
  }
  if (base === 'go.mod') {
    for (const match of text.matchAll(/^\s*([A-Za-z0-9._/-]+)\s+v[0-9]/gm)) addDependency(target, match[1]);
    return;
  }
  if (base === 'cargo.toml') {
    let inDependencies = false;
    for (const line of text.split(/\r?\n/)) {
      const section = line.match(/^\s*\[([^\]]+)\]/);
      if (section) inDependencies = /^dependencies(?:\.|$)/.test(section[1]);
      else if (inDependencies) {
        const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
        if (match) addDependency(target, match[1]);
      }
    }
  }
}

function extractImports(relativePath: string, text: string, target: Set<string>): void {
  const extension = extensionOf(relativePath);
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    const patterns = [
      /\bfrom\s*['"]([^'"]+)['"]/g,
      /\bimport\s*['"]([^'"]+)['"]/g,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const name = match[1];
        if (name && !name.startsWith('.') && !name.startsWith('/') && !name.startsWith('node:')) target.add(name);
      }
    }
  } else if (extension === '.py' || extension === '.pyi') {
    for (const match of text.matchAll(/^\s*(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/gm)) {
      const name = match[1] ?? match[2];
      if (name && !name.startsWith('.')) target.add(name.split('.')[0]);
    }
  }
}

function expandCamelCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2').replace(/([0-9])([A-Za-z])/g, '$1 $2').replace(/[_-]+/g, ' ');
}
function isAuxiliaryCapabilityPath(relativePath: string): boolean {
  return /(^|\/)(docs?|examples?|samples?|demos?|benchs?|benchmarks?|evals?|i18n|locales?)(\/|$)/i.test(relativePath) ||
    /(^|\/)eng\/verify-samples(\/|$)/i.test(relativePath) || relativePath.replace(/\\/g, '/').toLowerCase().startsWith('.github/');
}
function inferCapabilitySignals(rows: Array<{ path: string; role: NeuroForgeFileRole; text: string }>): NeuroForgeCapabilitySignal[] {
  const output: NeuroForgeCapabilitySignal[] = [];
  const evidenceRows = rows.filter(row => row.role === 'source' || row.role === 'test' || row.role === 'configuration')
    .map(row => ({ path: row.path, role: row.role, auxiliary: isAuxiliaryCapabilityPath(row.path), normalizedPath: expandCamelCase(row.path), normalizedText: row.role === 'configuration' ? '' : expandCamelCase(row.text) }));
  for (const rule of CAPABILITY_RULES) {
    const implementationMatches: Array<{ path: string; weight: number }> = [];
    const contentOnlyMatches: Array<{ path: string; weight: number }> = [];
    const supportingMatches: Array<{ path: string; weight: number }> = [];
    const configMatches: Array<{ path: string; weight: number }> = [];
    for (const row of evidenceRows) {
      if (row.role === 'configuration') {
        if (rule.id === 'reproducible-builds' && BUILD_CONFIG_EVIDENCE_PATH.test(row.path) && rule.pattern.test(row.normalizedPath)) configMatches.push({ path: row.path, weight: 0.30 });
        continue;
      }
      const pathMatch = rule.pattern.test(row.normalizedPath);
      const contentMatch = !pathMatch && CAPABILITY_CONTENT_RULES[rule.id].test(row.normalizedText);
      if (!pathMatch && !contentMatch) continue;
      const pathWeight = pathMatch ? 1 : 0.55;
      if (row.role === 'source' && !row.auxiliary && pathMatch) implementationMatches.push({ path: row.path, weight: pathWeight });
      else if (row.role === 'source' && !row.auxiliary && contentMatch) contentOnlyMatches.push({ path: row.path, weight: 0.30 * pathWeight });
      else supportingMatches.push({ path: row.path, weight: (row.role === 'test' ? 0.40 : 0.35) * pathWeight });
    }
    const evidenceLevel: NeuroForgeCapabilitySignal['evidenceLevel'] =
      implementationMatches.length ? 'implementation' : supportingMatches.length ? 'example-or-test' : contentOnlyMatches.length ? 'content-only' : 'configuration-only';
    const matches = [...implementationMatches, ...supportingMatches, ...contentOnlyMatches, ...configMatches];
    if (!matches.length) continue;
    const weighted = matches.reduce((sum, row) => sum + row.weight, 0);
    const confidence01 = Math.max(0, Math.min(0.95, 1 - Math.exp(-weighted / 2.4)));
    output.push({ capabilityId: rule.id, confidence01: Number(confidence01.toFixed(4)), evidenceLevel, evidenceFiles: matches.slice(0, 12).map(row => row.path) });
  }
  return output.sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
}
function isExampleOrDocumentationPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  const base = basename(normalized);
  return DOC_EXTENSIONS.has(extensionOf(base)) || /(^|\/)(docs?|examples?|fixtures?|samples?|testdata|tests?|__tests__|i18n|locales?)(\/|$)/.test(normalized) ||
    normalized.startsWith('.github/') || /^\.env\.(?:example|sample|template|default|defaults|dist)(?:\.|$)/.test(base) || /\.(example|sample|template)(\.|$)/.test(base);
}
function shannonEntropy(value: string): number {
  if (!value.length) return 0;
  const counts = new Map<string, number>(); for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0; for (const count of counts.values()) { const probability = count / value.length; entropy -= probability * Math.log2(probability); }
  return entropy;
}
function findHighConfidenceSecretAssignment(line: string): boolean {
  const keyPattern = /(?:^|[({,;]\s*)(?:(?:export\s+(?:default\s+)?)?(?:const|let|var|final|static|private|public|readonly|local)\s+)?(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$]*(?:api[_-]?(?:key|token)|client[_-]?secret|secret[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|password)\b\s*[:=]\s*/i;
  const assignment = keyPattern.exec(line); if (!assignment) return false;
  const tail = line.slice(assignment.index + assignment[0].length).trimStart();
  let value = ''; let remainder = '';
  const quote = tail[0]; const quotedValue = quote === '"' || quote === "'";
  if (quotedValue) {
    const close = tail.indexOf(quote, 1); if (close < 0) return false;
    value = tail.slice(1, close); remainder = tail.slice(close + 1).trimStart();
  } else {
    const bare = /^[A-Za-z0-9_./+=:-]+/.exec(tail); if (!bare) return false;
    value = bare[0]; remainder = tail.slice(value.length).trimStart();
    if (remainder.startsWith('(') || remainder.startsWith('.') || remainder.startsWith('[')) return false;
  }
  if (remainder && !/^(?:[,;)}\]]|#|\/\/|\/\*|$)/.test(remainder)) return false;
  if (!value || /(?:example|sample|placeholder|changeme|dummy|your[_ -]|replace[_ -]?me|default|fake|mock|test[_ -]?key|todo|none|null|process\.env|os\.environ|secret[_ -]?ref|<[^>]+>)/i.test(value)) return false;
  const recognizedPrefix = /^(?:sk-(?:proj-|live-|test-)?|gh[pousr]_|github_pat_|AKIA|ASIA|xox[baprs]-|eyJ)/i.test(value);
  const literalCredentialShape = quotedValue || (/\d/.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[-_+=/:.]/.test(value));
  return value.length >= 24 && (recognizedPrefix || (literalCredentialShape && shannonEntropy(value) >= 3.2));
}

export async function scanNeuroForgeProject(root: string, options: NeuroForgeScanOptions = {}): Promise<NeuroForgeProjectManifest> {
  const absoluteRoot = resolve(root);
  const rootMetadata = await lstat(absoluteRoot).catch(() => null);
  if (!rootMetadata || !rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error('source-root-must-be-a-real-directory');
  }
  const sourceProvenance = await readNeuroForgeGitProvenance(absoluteRoot);
  const maxFiles = Math.max(1, Math.min(50000, Math.floor(options.maxFiles ?? 20000)));
  const maxFileBytes = Math.max(1024, Math.min(8 * 1024 * 1024, Math.floor(options.maxFileBytes ?? 2 * 1024 * 1024)));
  const maxTotalBytes = Math.max(maxFileBytes, Math.min(1024 * 1024 * 1024, Math.floor(options.maxTotalBytes ?? 256 * 1024 * 1024)));
  const maxDepth = Math.max(1, Math.min(32, Math.floor(options.maxDepth ?? 16)));
  const maxTextBytes = Math.max(1024, Math.min(256 * 1024, Math.floor(options.maxTextBytes ?? 8 * 1024)));
  const files: NeuroForgeFileRecord[] = [];
  const samples: Array<{ path: string; role: NeuroForgeFileRole; text: string }> = [];
  const licenseFiles: NeuroForgeProjectManifest['licenseFiles'] = [];
  const noticeFiles: string[] = [];
  const dependencies = new Set<string>();
  const externalImports = new Set<string>();
  const securityFindings: NeuroForgeProjectManifest['securityFindings'] = [];
  const warnings: string[] = [];
  const languageCounts: Record<string, number> = {};
  const skipped: Array<{ path: string; sizeBytes: number; reason: string }> = [];
  let totalBytes = 0;
  let rootPackageVersion: string | null = null;
  let stop = false;

  async function walk(directory: string, depth: number): Promise<void> {
    if (stop || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(directory);
    } catch {
      warnings.push('directory-read-failed:' + normalizedPath(relative(absoluteRoot, directory)));
      return;
    }
    entries.sort((a, b) => a.localeCompare(b));
    for (const name of entries) {
      if (stop) return;
      const absolutePath = join(directory, name);
      let metadata: any;
      try {
        metadata = await lstat(absolutePath);
      } catch {
        skipped.push({ path: normalizedPath(relative(absoluteRoot, absolutePath)), sizeBytes: 0, reason: 'stat-failed' });
        continue;
      }
      if (metadata.isSymbolicLink()) {
        const symlinkPath = normalizedPath(relative(absoluteRoot, absolutePath));
        skipped.push({ path: symlinkPath, sizeBytes: 0, reason: 'symlink-skipped' });
        warnings.push('symlink-skipped:' + symlinkPath);
        continue;
      }
      if (metadata.isDirectory()) {
        if (IGNORE_DIRS.has(name.toLowerCase())) continue;
        await walk(absolutePath, depth + 1);
        continue;
      }
      if (!metadata.isFile()) continue;
      const relativePath = normalizedPath(relative(absoluteRoot, absolutePath));
      const declaredSizeBytes = Number(metadata.size ?? 0);
      if (files.length >= maxFiles) {
        skipped.push({ path: relativePath, sizeBytes: declaredSizeBytes, reason: 'file-count-limit' });
        stop = true;
        warnings.push('file-count-limit-reached');
        continue;
      }
      if (declaredSizeBytes > maxFileBytes) {
        skipped.push({ path: relativePath, sizeBytes: declaredSizeBytes, reason: 'file-size-limit' });
        continue;
      }
      if (totalBytes + declaredSizeBytes > maxTotalBytes) {
        skipped.push({ path: relativePath, sizeBytes: declaredSizeBytes, reason: 'total-size-limit' });
        stop = true;
        warnings.push('total-size-limit-reached');
        continue;
      }

      const bounded = await readBoundedFile(absolutePath, maxFileBytes);
      if (!bounded.data) {
        skipped.push({
          path: relativePath,
          sizeBytes: declaredSizeBytes,
          reason: bounded.reason ?? 'read-failed',
        });
        continue;
      }
      const data = bounded.data;
      const sizeBytes = data.byteLength;
      if (totalBytes + sizeBytes > maxTotalBytes) {
        skipped.push({ path: relativePath, sizeBytes, reason: 'total-size-limit' });
        stop = true;
        warnings.push('total-size-limit-reached');
        continue;
      }
      totalBytes += sizeBytes;
      const sha256 = digest(data);
      const role = fileRole(relativePath);
      const language = languageFor(relativePath);
      files.push({ path: relativePath, sizeBytes, sha256, language, role });
      if (language !== 'other') languageCounts[language] = (languageCounts[language] ?? 0) + 1;

      const base = basename(relativePath).toLowerCase();
      if (/^notice(\.|$)/i.test(base)) noticeFiles.push(relativePath);
      const isLicense = /^(license|licence|copying)(\.|$)/i.test(base);
      const isRoot = !relativePath.includes('/');
      const isCredential = isCredentialPath(relativePath);
      if (isCredential) securityFindings.push({ path: relativePath, kind: 'credential-file', severity: 'high' });

      // Keep text only for source, license and dependency manifests.
      // Tests/configs retain path-only evidence to avoid memory inflation and false proposals.
      const isDependencyConfig = role === 'configuration' && isDependencyManifest(base);
      const needsText = !isCredential && !ASSET_EXTENSIONS.has(extensionOf(base)) && sizeBytes > 0 &&
        (isLicense || role === 'source' || isDependencyConfig);
      const text = needsText ? data.subarray(0, maxTextBytes).toString('utf8') : '';
      if (isLicense) licenseFiles.push({ path: relativePath, scope: isRoot ? 'root' : 'nested', spdxId: detectSpdx(text), sha256 });
      if (isRoot && base === 'package.json' && text) {
        try {
          const parsed = JSON.parse(text) as { version?: unknown };
          if (typeof parsed.version === 'string' && parsed.version.trim()) rootPackageVersion = parsed.version.trim();
        } catch { /* malformed root package metadata is evidence only */ }
      }
      if (needsText && (role === 'source' || isDependencyConfig)) {
        if (!isCredential && !isExampleOrDocumentationPath(relativePath)) {
          const lines = text.split(/\r?\n/);
          for (let index = 0; index < lines.length; index += 1) {
            if (!/pragma:\s*allowlist\s+secret/i.test(lines[index]!) && findHighConfidenceSecretAssignment(lines[index]!)) {
              securityFindings.push({ path: relativePath, kind: 'possible-secret-assignment', severity: 'high', line: index + 1 });
            }
          }
        }
        if (isDependencyConfig) parseDependencies(relativePath, text, dependencies);
        if (role === 'source') extractImports(relativePath, text, externalImports);
        samples.push({ path: relativePath, role, text: role === 'configuration' ? '' : text });
      } else if (role === 'test' || role === 'configuration') samples.push({ path: relativePath, role, text: '' });
    }
  }

  await walk(absoluteRoot, 0);
  files.sort((a, b) => a.path.localeCompare(b.path));
  skipped.sort((a, b) => a.path.localeCompare(b.path));
  licenseFiles.sort((a, b) => a.path.localeCompare(b.path));
  noticeFiles.sort();

  const projectVersion = rootPackageVersion;

  const rootLicenseFile = licenseFiles.find(row => row.scope === 'root');
  const rootLicense = rootLicenseFile
    ? { path: rootLicenseFile.path, spdxId: rootLicenseFile.spdxId, status: rootLicenseFile.spdxId ? 'identified' as const : 'unknown' as const }
    : { path: null, spdxId: null, status: licenseFiles.length ? 'nested-only' as const : 'missing' as const };

  const snapshotMaterial = files.map(row => row.path + '\0' + row.sha256 + '\0' + row.sizeBytes)
    .concat(skipped.map(row => 'skipped\0' + row.path + '\0' + row.sizeBytes + '\0' + row.reason))
    .join('\n');
  const sourceFiles = files.filter(row => row.role === 'source').length;
  const testFiles = files.filter(row => row.role === 'test').length;
  const documentationFiles = files.filter(row => row.role === 'documentation').length;
  const configurationFiles = files.filter(row => row.role === 'configuration').length;
  const assetFiles = files.filter(row => row.role === 'asset').length;

  return {
    schemaVersion: 2,
    projectId: options.projectId?.trim() || basename(absoluteRoot),
    rootName: basename(absoluteRoot),
    rootPath: absoluteRoot,
    scannedAt: Date.now(),
    projectVersion,
    upstreamRevision: sourceProvenance.revision,
    sourceProvenance,
    snapshotSha256: digest(snapshotMaterial),
    stats: {
      files: files.length, sourceFiles, testFiles, documentationFiles,
      configurationFiles, assetFiles, totalBytes, skippedFiles: skipped.length,
    },
    languages: Object.fromEntries(Object.entries(languageCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    rootLicense,
    licenseFiles,
    noticeFiles,
    dependencies: Array.from(dependencies).sort(),
    externalImports: Array.from(externalImports).sort(),
    securityFindings: securityFindings.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind)),
    capabilitySignals: inferCapabilitySignals(samples),
    warnings: [...new Set(warnings)].sort(),
    files,
  };
}

export function neuroForgeCapabilityCatalog(): NeuroForgeCapabilityId[] {
  return CAPABILITY_RULES.map(row => row.id);
}
