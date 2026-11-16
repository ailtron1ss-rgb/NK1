import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';

export type NeuroForgeFileRole = 'source' | 'test' | 'documentation' | 'configuration' | 'license' | 'asset' | 'other';
export type NeuroForgeCapabilityId =
  | 'memory-retrieval'
  | 'durable-workflows'
  | 'agent-tools'
  | 'model-serving'
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
  evidenceFiles: string[];
}

export interface NeuroForgeProjectManifest {
  schemaVersion: 1;
  projectId: string;
  rootName: string;
  rootPath: string;
  scannedAt: number;
  projectVersion: string | null;
  upstreamRevision: string | null;
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
  securityFindings: Array<{ path: string; kind: 'credential-file' | 'possible-secret-assignment'; line?: number }>;
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
  { id: 'memory-retrieval', pattern: /\b(memory|mem0|letta|retriev|recall|episodic|semantic)\b/i },
  { id: 'durable-workflows', pattern: /\b(temporal|durable[\s_-]?workflow|workflow[\s_-]?(engine|orchestrat)|checkpoint[\s_-]?workflow)\b/i },
  { id: 'agent-tools', pattern: /\b(browser[\s_-]?use|openhands|swe[\s_-]?agent|mcp|tool[\s_-]?call|tool[\s_-]?executor)\b/i },
  { id: 'model-serving', pattern: /\b(vllm|llama[\s._-]?cpp|inference|model[\s_-]?serving|quantiz)\b/i },
  { id: 'voice', pattern: /\b(whisper|asr|tts|piper|speech|audio|voice)\b/i },
  { id: 'embodied-interaction', pattern: /\b(avatar|live2d|robot|motor|lerobot|kinematic|vrm)\b/i },
  { id: 'evaluation', pattern: /\b(inspect[\s_-]?ai|evaluation|benchmark|holdout|scorer)\b/i },
  { id: 'observability', pattern: /\b(telemetry|opentelemetry|trace|metrics|logging|flight[\s_-]?recorder)\b/i },
  { id: 'sandbox-security', pattern: /\b(sandbox|firecracker|opa|policy[\s_-]?engine|permission|security[\s_-]?gate)\b/i },
  { id: 'simulation-rl', pattern: /\b(gymnasium|cleanrl|genesis|simulator|simulation|reinforcement[\s_-]?learning)\b/i },
  { id: 'symbolic-reasoning', pattern: /\b(hyperon|metta|open? nars|soar|symbolic[\s_-]?reason)\b/i },
  { id: 'reproducible-builds', pattern: /\b(nix|lockfile|reproducible[\s_-]?build|docker|flake\.nix)\b/i },
  { id: 'vector-retrieval', pattern: /\b(faiss|chroma|vector[\s_-]?search|embedding|ann[\s_-]?index)\b/i },
  { id: 'coding-agents', pattern: /\b(openhands|swe[\s_-]?agent|repository[\s_-]?agent|coding[\s_-]?agent)\b/i },
];

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedPath(value: string): string {
  return value.split('\\').join('/');
}

function fileRole(relativePath: string): NeuroForgeFileRole {
  const base = basename(relativePath).toLowerCase();
  const extension = extname(base);
  if (/^(license|licence|copying)(\.|$)/i.test(base)) return 'license';
  if (/^notice(\.|$)/i.test(base)) return 'other';
  if (/(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\./i.test(relativePath)) return 'test';
  if (DOC_EXTENSIONS.has(extension)) return 'documentation';
  if (CONFIG_NAMES.has(base) || /(^|\/)(\.github|\.devcontainer)(\/|$)/i.test(relativePath) || extension === '.yml' || extension === '.yaml' || extension === '.toml') return 'configuration';
  if (SOURCE_EXTENSIONS.has(extension)) return 'source';
  if (ASSET_EXTENSIONS.has(extension)) return 'asset';
  return 'other';
}

function languageFor(relativePath: string): string {
  const base = basename(relativePath).toLowerCase();
  if (base === 'dockerfile') return 'docker';
  if (base === 'makefile') return 'make';
  const extension = extname(base);
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
  if (/^\.env(?:$|\.)/.test(base) && !/\.(example|sample|template)$/.test(base)) return true;
  return /(id_rsa|id_ed25519|credentials?\.(json|ya?ml)|secrets?\.(json|ya?ml)|\.(pem|p12|pfx|key))$/i.test(base);
}

function detectSpdx(text: string): string | null {
  if (/MIT License|Permission is hereby granted, free of charge/i.test(text)) return 'MIT';
  if (/Apache License, Version 2\.0|Apache-2\.0/i.test(text)) return 'Apache-2.0';
  if (/GNU AFFERO GENERAL PUBLIC LICENSE.*Version 3|AGPL-3\.0/i.test(text)) return 'AGPL-3.0-or-later';
  if (/GNU GENERAL PUBLIC LICENSE.*Version 3|GPL-3\.0/i.test(text)) return 'GPL-3.0-or-later';
  if (/GNU LESSER GENERAL PUBLIC LICENSE.*Version 3|LGPL-3\.0/i.test(text)) return 'LGPL-3.0-or-later';
  if (/Mozilla Public License Version 2\.0|MPL-2\.0/i.test(text)) return 'MPL-2.0';
  if (/BSD 3-Clause|Redistribution and use in source and binary forms, with or without modification/i.test(text)) return 'BSD-3-Clause';
  if (/BSD 2-Clause/i.test(text)) return 'BSD-2-Clause';
  if (/ISC License/i.test(text)) return 'ISC';
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
  const extension = extname(relativePath).toLowerCase();
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

function inferCapabilitySignals(rows: Array<{ path: string; role: NeuroForgeFileRole; text: string }>): NeuroForgeCapabilitySignal[] {
  const output: NeuroForgeCapabilitySignal[] = [];
  for (const rule of CAPABILITY_RULES) {
    const matches: Array<{ path: string; weight: number }> = [];
    for (const row of rows) {
      if (!rule.pattern.test(row.path + '\n' + row.text)) continue;
      const weight = row.role === 'source' ? 1 : row.role === 'test' ? 0.65 : row.role === 'configuration' ? 0.45 : row.role === 'documentation' ? 0.3 : 0.2;
      matches.push({ path: row.path, weight });
    }
    if (!matches.length) continue;
    const weighted = matches.reduce((sum, row) => sum + row.weight, 0);
    const confidence01 = Math.max(0, Math.min(0.95, 1 - Math.exp(-weighted / 2.4)));
    output.push({
      capabilityId: rule.id,
      confidence01: Number(confidence01.toFixed(4)),
      evidenceFiles: matches.slice(0, 12).map(row => row.path),
    });
  }
  return output.sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
}

export async function scanNeuroForgeProject(root: string, options: NeuroForgeScanOptions = {}): Promise<NeuroForgeProjectManifest> {
  const absoluteRoot = resolve(root);
  const maxFiles = Math.max(1, Math.min(50000, Math.floor(options.maxFiles ?? 20000)));
  const maxFileBytes = Math.max(1024, Math.min(8 * 1024 * 1024, Math.floor(options.maxFileBytes ?? 2 * 1024 * 1024)));
  const maxTotalBytes = Math.max(maxFileBytes, Math.min(1024 * 1024 * 1024, Math.floor(options.maxTotalBytes ?? 256 * 1024 * 1024)));
  const maxDepth = Math.max(1, Math.min(32, Math.floor(options.maxDepth ?? 16)));
  const maxTextBytes = Math.max(1024, Math.min(256 * 1024, Math.floor(options.maxTextBytes ?? 64 * 1024)));
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
  let stop = false;

  async function walk(directory: string, depth: number): Promise<void> {
    if (stop || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      warnings.push('directory-read-failed:' + normalizedPath(relative(absoluteRoot, directory)));
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (stop) return;
      if (entry.isSymbolicLink()) {
        warnings.push('symlink-skipped:' + normalizedPath(relative(absoluteRoot, join(directory, entry.name))));
        continue;
      }
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name.toLowerCase())) continue;
        await walk(join(directory, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const absolutePath = join(directory, entry.name);
      const relativePath = normalizedPath(relative(absoluteRoot, absolutePath));
      let data: Buffer;
      try {
        data = await readFile(absolutePath);
      } catch {
        skipped.push({ path: relativePath, sizeBytes: 0, reason: 'read-failed' });
        continue;
      }
      const sizeBytes = data.byteLength;
      if (files.length >= maxFiles) {
        skipped.push({ path: relativePath, sizeBytes, reason: 'file-count-limit' });
        stop = true;
        warnings.push('file-count-limit-reached');
        continue;
      }
      if (sizeBytes > maxFileBytes) {
        skipped.push({ path: relativePath, sizeBytes, reason: 'file-size-limit' });
        continue;
      }
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
      if (isCredential) securityFindings.push({ path: relativePath, kind: 'credential-file' });

      const shouldReadText = !isCredential && !ASSET_EXTENSIONS.has(extname(base)) && sizeBytes > 0;
      const text = shouldReadText ? data.subarray(0, maxTextBytes).toString('utf8') : '';
      if (isLicense) {
        licenseFiles.push({ path: relativePath, scope: isRoot ? 'root' : 'nested', spdxId: detectSpdx(text), sha256 });
      }
      if (shouldReadText) {
        const lines = text.split(/\r?\n/);
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index]!;
          if (/(?:api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}/i.test(line) &&
              !/(example|sample|placeholder|changeme|dummy|your[_ -])/i.test(line)) {
            securityFindings.push({ path: relativePath, kind: 'possible-secret-assignment', line: index + 1 });
          }
        }
        parseDependencies(relativePath, text, dependencies);
        extractImports(relativePath, text, externalImports);
        samples.push({ path: relativePath, role, text });
      }
    }
  }

  await walk(absoluteRoot, 0);
  files.sort((a, b) => a.path.localeCompare(b.path));
  skipped.sort((a, b) => a.path.localeCompare(b.path));
  licenseFiles.sort((a, b) => a.path.localeCompare(b.path));
  noticeFiles.sort();

  let projectVersion: string | null = null;
  const rootPackage = samples.find(row => row.path === 'package.json');
  if (rootPackage) {
    try {
      const parsed = JSON.parse(rootPackage.text) as { version?: unknown };
      if (typeof parsed.version === 'string' && parsed.version.trim()) projectVersion = parsed.version.trim();
    } catch { /* package metadata remains an inventory signal, not trusted configuration */ }
  }

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
    schemaVersion: 1,
    projectId: options.projectId?.trim() || basename(absoluteRoot),
    rootName: basename(absoluteRoot),
    rootPath: absoluteRoot,
    scannedAt: Date.now(),
    projectVersion,
    upstreamRevision: null,
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
