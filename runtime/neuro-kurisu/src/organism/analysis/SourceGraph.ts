/**
 * Deterministic structural index of the organism's own source tree.
 *
 * The organism previously had no structural view of its code: every "self-analysis"
 * was lexical (grep) or a named-but-empty heuristic. This module produces a
 * dependency graph that a self-modification pass can query before touching code.
 *
 * Parsing is regex/brace-depth based and dependency-free so it runs inside the
 * strip-types runtime with no install step. Every edge carries provenance:
 * `EXTRACTED` when it comes directly from syntax (import/definition), `INFERRED`
 * when it comes from an identifier match against a known symbol name. Callers must
 * not treat `INFERRED` edges as fact.
 */

export type SourceNodeKind = 'file' | 'class' | 'function' | 'interface' | 'type' | 'const';
export type EdgeProvenance = 'EXTRACTED' | 'INFERRED';
export type SourceEdgeKind = 'imports' | 'defines' | 'references';

export interface SourceNode {
  id: string;
  kind: SourceNodeKind;
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  exported: boolean;
}

export interface SourceEdge {
  from: string;
  to: string;
  kind: SourceEdgeKind;
  provenance: EdgeProvenance;
}

export interface SourceGraph {
  version: 1;
  files: string[];
  nodes: SourceNode[];
  edges: SourceEdge[];
}

export interface SourceFileInput {
  path: string;
  text: string;
}

export const SOURCE_GRAPH_VERSION = 1 as const;

/**
 * Replaces the contents of string/template literals and comments with spaces while
 * preserving offsets and line breaks. This keeps later regex passes from matching
 * declaration keywords that only appear inside a string or a comment.
 */
export function maskNonCode(text: string): string {
  const out = text.split('');
  let i = 0;
  const n = text.length;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < n; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') {
          j += 2;
          continue;
        }
        if (text[j] === c) break;
        j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/** Finds the closing brace of a block starting at the first `{` at or after `from`. */
function blockEnd(masked: string, from: number): number {
  let depth = 0;
  let seen = false;
  for (let i = from; i < masked.length; i += 1) {
    const c = masked[i];
    if (c === '{') {
      depth += 1;
      seen = true;
    } else if (c === '}') {
      depth -= 1;
      if (seen && depth === 0) return i;
    }
  }
  return masked.length;
}

const DECLARATION = /(?:^|\n)\s*(export\s+)?(?:default\s+)?(?:declare\s+)?(class|interface|function|type|const|enum)\s+([A-Za-z_$][\w$]*)/g;
// `d` gives capture-group offsets so the path can be read from the unmasked text.
const IMPORT_FROM = /(?:^|\n)\s*import\s+(?:type\s+)?[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/gd;
const BARE_IMPORT = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/gd;

export interface ParsedFile {
  symbols: SourceNode[];
  imports: string[];
}

/**
 * Module specifiers are read from `text`, not from the masked copy: masking blanks
 * the inside of string literals, which is exactly where the specifier lives. The
 * masked copy still supplies the match offsets, so a commented-out import is skipped.
 */
function readSpecifiers(masked: string, text: string, re: RegExp, out: string[]): void {
  re.lastIndex = 0;
  for (let m = re.exec(masked); m; m = re.exec(masked)) {
    const indices = m.indices?.[1];
    if (!indices) continue;
    const specifier = text.slice(indices[0], indices[1]).trim();
    if (specifier) out.push(specifier);
  }
}

export function parseSourceFile(path: string, text: string): ParsedFile {
  const masked = maskNonCode(text);
  const symbols: SourceNode[] = [];
  const imports: string[] = [];

  readSpecifiers(masked, text, IMPORT_FROM, imports);
  readSpecifiers(masked, text, BARE_IMPORT, imports);

  DECLARATION.lastIndex = 0;
  for (let m = DECLARATION.exec(masked); m; m = DECLARATION.exec(masked)) {
    const keyword = m[2];
    const name = m[3];
    const exported = Boolean(m[1]);
    const startOffset = m.index + (m[0].startsWith('\n') ? 1 : 0);
    const kind: SourceNodeKind =
      keyword === 'enum' ? 'type' : (keyword as SourceNodeKind);
    const startLine = lineOf(masked, startOffset);
    const bodyStart = masked.indexOf('{', DECLARATION.lastIndex);
    const isBlock = keyword === 'class' || keyword === 'interface' || keyword === 'function' || keyword === 'enum';
    const endOffset = isBlock && bodyStart !== -1 ? blockEnd(masked, bodyStart) : masked.indexOf('\n', DECLARATION.lastIndex);
    const endLine = lineOf(masked, endOffset === -1 ? masked.length : endOffset);
    symbols.push({
      id: `${path}#${name}`,
      kind,
      name,
      file: path,
      startLine,
      endLine,
      exported,
    });
  }

  return { symbols, imports };
}

/**
 * Resolve a relative import against the importing file, not against a global
 * basename index. Basename-only matching aliases unrelated modules whenever two
 * directories contain the same filename, which corrupts impact analysis.
 *
 * TypeScript ESM projects commonly write .js specifiers for .ts source files;
 * extension and index candidates below preserve that convention without
 * guessing across directories.
 */
function normalizeRepoPath(value: string): string | null {
  const parts: string[] = [];
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
}

function resolveRelativeModule(
  importerPath: string,
  importPath: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  if (!importPath.startsWith('.')) return null;
  const importer = normalizeRepoPath(importerPath);
  if (!importer) return null;
  const importerParts = importer.split('/');
  importerParts.pop();
  const resolved = normalizeRepoPath([...importerParts, importPath].join('/'));
  if (!resolved) return null;

  const candidates = [resolved];
  if (/\.js$/i.test(resolved)) {
    candidates.push(resolved.replace(/\.js$/i, '.ts'));
    candidates.push(resolved.replace(/\.js$/i, '.tsx'));
    candidates.push(resolved.replace(/\.js$/i, '.mts'));
  } else if (/\.mjs$/i.test(resolved)) {
    candidates.push(resolved.replace(/\.mjs$/i, '.mts'));
    candidates.push(resolved.replace(/\.mjs$/i, '.ts'));
  } else if (!/\.[A-Za-z0-9]+$/.test(resolved)) {
    candidates.push(
      resolved + '.ts',
      resolved + '.tsx',
      resolved + '.mts',
      resolved + '.js',
      resolved + '/index.ts',
      resolved + '/index.tsx',
      resolved + '/index.mts',
      resolved + '/index.js',
    );
  }
  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}

export function buildSourceGraph(files: SourceFileInput[]): SourceGraph {
  const nodes: SourceNode[] = [];
  const edges: SourceEdge[] = [];
  const parsed = new Map<string, ParsedFile>();

  for (const file of files) {
    const result = parseSourceFile(file.path, file.text);
    parsed.set(file.path, result);
    nodes.push({
      id: `${file.path}#__module__`,
      kind: 'file',
      name: file.path,
      file: file.path,
      startLine: 1,
      endLine: file.text.split('\n').length,
      exported: true,
    });
    nodes.push(...result.symbols);
  }

  const knownFiles = new Set(files.map((file) => normalizeRepoPath(file.path)).filter((path): path is string => path !== null));

  for (const file of files) {
    const result = parsed.get(file.path);
    if (!result) continue;
    const moduleId = `${file.path}#__module__`;
    for (const spec of result.imports) {
      const target = resolveRelativeModule(file.path, spec, knownFiles);
      if (!target || target === file.path) continue;
      edges.push({ from: moduleId, to: `${target}#__module__`, kind: 'imports', provenance: 'EXTRACTED' });
      for (const symbol of parsed.get(target)?.symbols ?? []) {
        if (symbol.exported) {
          edges.push({ from: moduleId, to: symbol.id, kind: 'imports', provenance: 'EXTRACTED' });
        }
      }
    }
    for (const symbol of result.symbols) {
      edges.push({ from: moduleId, to: symbol.id, kind: 'defines', provenance: 'EXTRACTED' });
    }
  }

  const maskedByFile = new Map<string, string>();
  for (const file of files) maskedByFile.set(file.path, maskNonCode(file.text));

  const declaredNames = new Set<string>();
  for (const node of nodes) {
    if (node.kind !== 'file') declaredNames.add(node.name);
  }
  const nodesByName = new Map<string, SourceNode[]>();
  for (const node of nodes) {
    if (node.kind === 'file') continue;
    const list = nodesByName.get(node.name) ?? [];
    list.push(node);
    nodesByName.set(node.name, list);
  }

  // One identifier scan per file, then a set intersection against declared names.
  // The previous form built a RegExp per (file, name) pair, which is O(files x names)
  // regex compilations and made the index too slow to run inside a live cycle.
  const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
  for (const file of files) {
    const masked = maskedByFile.get(file.path) ?? '';
    const moduleId = `${file.path}#__module__`;
    const present = new Set<string>();
    IDENTIFIER.lastIndex = 0;
    for (let m = IDENTIFIER.exec(masked); m; m = IDENTIFIER.exec(masked)) {
      if (declaredNames.has(m[0])) present.add(m[0]);
    }
    for (const name of present) {
      for (const node of nodesByName.get(name) ?? []) {
        if (node.file === file.path) continue;
        edges.push({ from: moduleId, to: node.id, kind: 'references', provenance: 'INFERRED' });
      }
    }
  }

  return { version: SOURCE_GRAPH_VERSION, files: files.map((f) => f.path), nodes, edges };
}

/** Transitive set of files/symbols that depend on `nodeId` (reverse reachability). */
export function impactOf(graph: SourceGraph, nodeId: string): string[] {
  const reverse = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = reverse.get(edge.to) ?? [];
    list.push(edge.from);
    reverse.set(edge.to, list);
  }
  const seen = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const parent of reverse.get(current) ?? []) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      queue.push(parent);
    }
  }
  seen.delete(nodeId);
  return [...seen].sort();
}

/** Symbols defined in more than one file — a proxy for a duplicated source of truth. */
export function findDuplicateDefinitions(graph: SourceGraph): { name: string; files: string[] }[] {
  const byName = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    if (node.kind === 'file') continue;
    const set = byName.get(node.name) ?? new Set<string>();
    set.add(node.file);
    byName.set(node.name, set);
  }
  const out: { name: string; files: string[] }[] = [];
  for (const [name, files] of byName) {
    if (files.size > 1) out.push({ name, files: [...files].sort() });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Non-exported symbols with no inbound reference edge — candidates for dead code. */
export function findUnreferencedSymbols(graph: SourceGraph): SourceNode[] {
  const referenced = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind === 'references' || edge.kind === 'imports') referenced.add(edge.to);
  }
  return graph.nodes
    .filter((n) => n.kind !== 'file' && !n.exported && !referenced.has(n.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function graphSummary(graph: SourceGraph) {
  const byKind: Record<string, number> = {};
  for (const node of graph.nodes) byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
  return {
    version: graph.version,
    files: graph.files.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    extractedEdges: graph.edges.filter((e) => e.provenance === 'EXTRACTED').length,
    inferredEdges: graph.edges.filter((e) => e.provenance === 'INFERRED').length,
    byKind,
  };
}
