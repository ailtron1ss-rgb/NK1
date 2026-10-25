import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdownExtensions = new Set([".md", ".mdx", ".markdown"]);
const ignoredDirectoryPaths = new Set([".git", "node_modules", "dist", "coverage", "legacy/input-archives", "app/.grok"]);

function maskNonMarkdown(source) {
  let masked = source.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\r\n]/g, " "));
  const lines = masked.split(/(?<=\n)/);
  let fenceChar = null;
  let fenceLength = 0;
  const chunks = [];
  for (const line of lines) {
    const bare = line.replace(/[\r\n]+$/, "");
    const opener = /^ {0,3}(\x60{3,}|~{3,})/.exec(bare);
    if (fenceChar) {
      chunks.push(line.replace(/[^\r\n]/g, " "));
      const fencePattern = fenceChar === "\x60" ? "\x60" : "~";
      if (new RegExp("^ {0,3}" + fencePattern + "{" + fenceLength + ",}[ \t]*$").test(bare)) {
        fenceChar = null;
        fenceLength = 0;
      }
    } else if (opener) {
      fenceChar = opener[1][0];
      fenceLength = opener[1].length;
      chunks.push(line.replace(/[^\r\n]/g, " "));
    } else {
      chunks.push(line);
    }
  }
  masked = chunks.join("");
  return masked.replace(/(\x60+)[^\n]*?\1/g, (match) => match.replace(/[^\r\n]/g, " "));
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

function scanInlineDestinations(source) {
  const links = [];
  const pattern = /!?\[[^\]\n]*\]\(/g;
  for (const match of source.matchAll(pattern)) {
    let i = match.index + match[0].length;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    let destination = "";
    if (source[i] === "<") {
      i += 1;
      const start = i;
      while (i < source.length && source[i] !== ">" && source[i] !== "\n") i += 1;
      if (source[i] !== ">") continue;
      destination = source.slice(start, i);
    } else {
      let depth = 0;
      const start = i;
      let escaped = false;
      while (i < source.length) {
        const char = source[i];
        if (escaped) { escaped = false; i += 1; continue; }
        if (char === "\\") { escaped = true; i += 1; continue; }
        if (char === "(") { depth += 1; i += 1; continue; }
        if (char === ")") { if (depth === 0) break; depth -= 1; i += 1; continue; }
        if (/\s/.test(char) && depth === 0) break;
        i += 1;
      }
      destination = source.slice(start, i);
    }
    destination = destination.trim();
    if (destination) links.push({ destination, index: match.index, kind: "markdown" });
  }
  return links;
}

function scanReferenceDefinitions(source) {
  const links = [];
  const pattern = /^ {0,3}\[[^\]\n]+\]:\s*(?:<([^>]+)>|(\S+))/gm;
  for (const match of source.matchAll(pattern)) {
    const destination = (match[1] ?? match[2] ?? "").trim();
    if (destination) links.push({ destination, index: match.index, kind: "reference" });
  }
  return links;
}

function scanHtmlDestinations(source) {
  const links = [];
  const pattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
  for (const match of source.matchAll(pattern)) {
    if (match[2]) links.push({ destination: match[2].trim(), index: match.index, kind: "html" });
  }
  return links;
}

export function extractMarkdownLinks(markdown) {
  const masked = maskNonMarkdown(String(markdown ?? ""));
  return [...scanInlineDestinations(masked), ...scanReferenceDefinitions(masked), ...scanHtmlDestinations(masked)]
    .map((item) => ({ ...item, line: lineNumberAt(masked, item.index) }))
    .sort((a, b) => a.index - b.index);
}

function isExternal(destination) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(destination) || destination.startsWith("#") || destination.startsWith("data:");
}

function decodedPath(rawPath) {
  try { return { value: decodeURIComponent(rawPath), error: null }; }
  catch { return { value: rawPath, error: "invalid URL percent-encoding" }; }
}

async function isFileOrDirectory(target) {
  try { await stat(target); return true; }
  catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    return false;
  }
}

async function targetExists(target, rawTarget) {
  if (await isFileOrDirectory(target)) return true;
  if (!path.extname(target) && !/[\\/]$/.test(rawTarget)) {
    for (const suffix of [".md", ".markdown", ".html"]) if (await isFileOrDirectory(target + suffix)) return true;
    for (const indexName of ["README.md", "index.md", "index.html"]) if (await isFileOrDirectory(path.join(target, indexName))) return true;
  }
  return false;
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

async function walkMarkdown(root, relativeDirectory = "") {
  const files = [];
  for (const entry of await readdir(path.join(root, relativeDirectory), { withFileTypes: true })) {
    const rel = path.posix.join(relativeDirectory.split(path.sep).join("/"), entry.name).replace(/^\.\//, "");
    if (entry.isDirectory()) {
      if ([...ignoredDirectoryPaths].some((ignored) => rel === ignored || rel.startsWith(ignored + "/"))) continue;
      files.push(...await walkMarkdown(root, path.join(relativeDirectory, entry.name)));
    } else if (entry.isFile() && markdownExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(rel);
    }
  }
  return files;
}

export async function auditMarkdownLinks({ root = repoRoot, files = null } = {}) {
  const absoluteRoot = path.resolve(root);
  const sourceFiles = files ? [...new Set(files.map((file) => path.posix.normalize(String(file).replace(/\\/g, "/"))))].sort() : (await walkMarkdown(absoluteRoot)).sort();
  const issues = [];
  let scannedFiles = 0;
  for (const relativeFile of sourceFiles) {
    const sourcePath = path.resolve(absoluteRoot, relativeFile);
    if (!isInsideRoot(absoluteRoot, sourcePath)) {
      issues.push({ source: relativeFile, line: 1, destination: relativeFile, reason: "source file path escapes repository root" });
      continue;
    }
    let source;
    try { source = await readFile(sourcePath, "utf8"); }
    catch (error) {
      issues.push({ source: relativeFile, line: 1, destination: relativeFile, reason: error?.code === "ENOENT" ? "source file not found" : "source file unreadable" });
      continue;
    }
    scannedFiles += 1;
    for (const link of extractMarkdownLinks(source)) {
      const raw = link.destination;
      if (!raw || isExternal(raw)) continue;
      const pathPart = raw.split(/[?#]/, 1)[0];
      if (!pathPart) continue;
      const decoded = decodedPath(pathPart);
      if (decoded.error) { issues.push({ source: relativeFile, line: link.line, destination: raw, reason: decoded.error }); continue; }
      const cleanPath = decoded.value.replace(/\\/g, "/");
      const targetPath = cleanPath.startsWith("/") ? path.resolve(absoluteRoot, "." + cleanPath) : path.resolve(absoluteRoot, path.dirname(relativeFile), cleanPath);
      if (!isInsideRoot(absoluteRoot, targetPath)) {
        issues.push({ source: relativeFile, line: link.line, destination: raw, reason: "target escapes repository root" });
      } else if (!(await targetExists(targetPath, cleanPath))) {
        issues.push({ source: relativeFile, line: link.line, destination: raw, reason: "target not found" });
      }
    }
  }
  return { root: absoluteRoot, scannedFiles, issueCount: issues.length, issues };
}

function parseArgs(args) {
  const options = { strict: false, json: false, root: repoRoot, files: null };
  const files = [];
  let readingFiles = false;
  for (const arg of args) {
    if (arg === "--strict") { options.strict = true; readingFiles = false; }
    else if (arg === "--json") { options.json = true; readingFiles = false; }
    else if (arg === "--files") { options.files ??= []; readingFiles = true; }
    else if (arg.startsWith("--root=")) { options.root = path.resolve(arg.slice("--root=".length)); readingFiles = false; }
    else if (arg.startsWith("--")) throw new Error("Unknown option: " + arg);
    else if (readingFiles) files.push(arg);
    else throw new Error("Unexpected argument: " + arg);
  }
  if (options.files) options.files = files;
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await auditMarkdownLinks(options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log("MARKDOWN LINK AUDIT: " + result.scannedFiles + " file(s), " + result.issueCount + " issue(s).");
    for (const issue of result.issues) console.log("- " + issue.source + ":" + issue.line + " -> " + issue.destination + " (" + issue.reason + ")");
  }
  if (options.strict && result.issueCount > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("MARKDOWN LINK AUDIT ERROR:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
