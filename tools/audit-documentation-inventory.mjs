import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractMarkdownLinks } from "./audit-markdown-links.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdownExtensions = new Set([".md", ".mdx", ".markdown"]);
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", "legacy/input-archives", "app/.grok"]);

export async function walkMarkdownFiles(root, relativeDirectory = "") {
  const files = [];
  const entries = await readdir(path.join(root, relativeDirectory), { withFileTypes: true });
  for (const entry of entries) {
    const relative = path.posix.join(relativeDirectory.split(path.sep).join("/"), entry.name).replace(/^\.\//, "");
    if (entry.isDirectory()) {
      if ([...ignoredDirectories].some((ignored) => relative === ignored || relative.startsWith(ignored + "/"))) continue;
      files.push(...await walkMarkdownFiles(root, path.join(relativeDirectory, entry.name)));
    } else if (entry.isFile() && markdownExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(relative);
    }
  }
  return files;
}

const textExtensions = new Set([
  ".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx",
  ".py", ".sh", ".bash", ".ps1", ".json", ".jsonc", ".yml", ".yaml",
  ".toml", ".xml", ".html", ".htm", ".txt", ".csv", ".sql", ".dockerfile"
]);

async function walkTextFiles(root, relativeDirectory = "") {
  const files = [];
  const entries = await readdir(path.join(root, relativeDirectory), { withFileTypes: true });
  for (const entry of entries) {
    const relative = path.posix.join(relativeDirectory.split(path.sep).join("/"), entry.name).replace(/^\.\//, "");
    if (entry.isDirectory()) {
      if ([...ignoredDirectories].some((ignored) => relative === ignored || relative.startsWith(ignored + "/"))) continue;
      files.push(...await walkTextFiles(root, path.join(relativeDirectory, entry.name)));
    } else if (entry.isFile() && !markdownExtensions.has(path.extname(entry.name).toLowerCase())) {
      const extension = path.extname(entry.name).toLowerCase();
      if (textExtensions.has(extension) || entry.name.toLowerCase() === "dockerfile" || entry.name.toLowerCase() === ".gitignore") {
        files.push(relative);
      }
    }
  }
  return files;
}

async function scanNonMarkdownReferences(root, markdownPaths) {
  const fileSet = new Set(markdownPaths);
  const byBasename = new Map();
  for (const target of markdownPaths) {
    const key = path.posix.basename(target).toLowerCase();
    if (!byBasename.has(key)) byBasename.set(key, []);
    byBasename.get(key).push(target);
  }

  const hits = new Map(markdownPaths.map((target) => [target, new Set()]));
  const sourceFiles = await walkTextFiles(root);
  const tokenPattern = /[A-Za-z0-9_.\/\\-]+\.(?:md|mdx|markdown)\b/gi;
  let scannedFiles = 0;
  let readErrors = 0;

  for (const relativeSource of sourceFiles) {
    let size;
    try { size = (await stat(path.resolve(root, relativeSource))).size; }
    catch { readErrors += 1; continue; }
    if (size > 4 * 1024 * 1024) continue;

    let source;
    try { source = await readFile(path.resolve(root, relativeSource), "utf8"); }
    catch { readErrors += 1; continue; }
    if (source.includes("\u0000")) continue;
    scannedFiles += 1;

    const seenTargets = new Set();
    for (const match of source.matchAll(tokenPattern)) {
      const token = match[0].replace(/^[.\/\\]+/, "");
      const normalized = token.replace(/\\/g, "/");
      const candidates = new Set();

      if (fileSet.has(normalized)) candidates.add(normalized);
      const relativeResolved = path.relative(root, path.resolve(root, path.dirname(relativeSource), token)).split(path.sep).join("/");
      if (fileSet.has(relativeResolved)) candidates.add(relativeResolved);

      const basename = path.posix.basename(normalized).toLowerCase();
      const basenameCandidates = byBasename.get(basename) ?? [];
      // Basename-only references are retained as conservative evidence. They
      // can be ambiguous, so each matching path is kept as a review candidate.
      for (const candidate of basenameCandidates) candidates.add(candidate);

      for (const target of candidates) seenTargets.add(target);
    }

    for (const target of seenTargets) {
      if (!hits.has(target)) hits.set(target, new Set());
      hits.get(target).add(relativeSource);
    }
  }

  return {
    scannedFiles,
    readErrors,
    hits: new Map([...hits.entries()].map(([target, sources]) => [target, [...sources].sort()])),
  };
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function familyFor(relativePath) {
  const name = path.posix.basename(relativePath).toUpperCase();
  if (/^PROJECT_CURRENT_STATUS_/.test(name)) return "project-current-status";
  if (/^PROJECT_PROGRESS_SCORECARD_/.test(name)) return "project-progress-scorecard";
  if (/^NEURO_KURISU_FULL_RELEASE_BACKLOG_/.test(name)) return "full-release-backlog-snapshots";
  if (/^ROADMAP_GAPS_TO_TARGET_WORKPASS/.test(name)) return "roadmap-gap-snapshots";
  if (/^INTEGRATION_MATRIX_WORKPASS/.test(name)) return "integration-matrix-snapshots";
  if (/^OPEN_SOURCE_INTEGRATION_REVIEW_WORKPASS/.test(name)) return "open-source-review-snapshots";
  if (/^PROJECT_CURRENT_STATUS/.test(name)) return "project-status";
  const workpass = /^WORKPASS(\d+)_([A-Z0-9_]+)\.(?:MD|MDX|MARKDOWN)$/.exec(name);
  if (workpass) {
    const kind = workpass[2];
    if (/HANDOVER/.test(kind)) return "workpass-handovers";
    if (/REPORT|IMPLEMENTATION/.test(kind)) return "workpass-reports";
    if (/TASKS?/.test(kind)) return "workpass-task-lists";
    if (/CHECKPOINT/.test(kind)) return "workpass-checkpoints";
    if (/CODE_CHANGES/.test(kind)) return "workpass-change-ledgers";
    if (/AUDIT|INVENTORY|CHANGED_FILES/.test(kind)) return "workpass-audit-ledgers";
  }
  return null;
}

function isExternal(destination) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(destination) ||
    destination.startsWith("#") || destination.startsWith("data:");
}

function resolveMarkdownTarget(root, sourcePath, destination, fileSet) {
  const pathPart = String(destination).split(/[?#]/, 1)[0];
  if (!pathPart) return null;
  let decoded;
  try { decoded = decodeURIComponent(pathPart); } catch { return null; }
  const clean = decoded.replace(/\\/g, "/");
  const absolute = clean.startsWith("/")
    ? path.resolve(root, "." + clean)
    : path.resolve(root, path.dirname(sourcePath), clean);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  const candidates = [relative];
  if (!path.extname(relative) && !/[\\/]$/.test(relative)) {
    candidates.push(relative + ".md", relative + ".mdx", relative + ".markdown");
    candidates.push(relative + "/README.md", relative + "/index.md");
  }
  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

export async function buildDocumentationInventory({ root = repoRoot, files = null } = {}) {
  const absoluteRoot = path.resolve(root);
  const filePaths = (files ?? await walkMarkdownFiles(absoluteRoot))
    .map((item) => path.posix.normalize(String(item).replace(/\\/g, "/")))
    .filter((item) => !item.startsWith("../") && item !== "..")
    .sort();
  const fileSet = new Set(filePaths);
  const exactContent = new Map();
  const families = new Map();
  const inlinks = new Map(filePaths.map((item) => [item, 0]));
  const records = [];
  const linkIssues = [];
  let localLinks = 0;

  for (const relativePath of filePaths) {
    let content;
    try {
      content = await readFile(path.resolve(absoluteRoot, relativePath), "utf8");
    } catch (error) {
      linkIssues.push({ path: relativePath, reason: error?.code === "ENOENT" ? "listed Markdown file missing" : "Markdown file unreadable" });
      continue;
    }
    const hash = sha256(content);
    const family = familyFor(relativePath);
    const record = { path: relativePath, sha256: hash, bytes: Buffer.byteLength(content), family };
    records.push(record);
    if (!exactContent.has(hash)) exactContent.set(hash, []);
    exactContent.get(hash).push(relativePath);
    if (family) {
      if (!families.has(family)) families.set(family, []);
      families.get(family).push(relativePath);
    }

    for (const link of extractMarkdownLinks(content)) {
      if (isExternal(link.destination)) continue;
      const pathPart = String(link.destination).split(/[?#]/, 1)[0];
      if (!pathPart) continue;
      localLinks += 1;
      const target = resolveMarkdownTarget(absoluteRoot, relativePath, link.destination, fileSet);
      if (target) inlinks.set(target, (inlinks.get(target) ?? 0) + 1);
    }
  }

  const duplicateGroups = [...exactContent.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([hash, paths]) => ({ sha256: hash, count: paths.length, paths: paths.sort() }))
    .sort((a, b) => b.count - a.count || a.paths[0].localeCompare(b.paths[0]));
  const familyGroups = [...families.entries()]
    .map(([family, paths]) => ({ family, count: paths.length, paths: paths.sort() }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
  const nonMarkdown = await scanNonMarkdownReferences(absoluteRoot, filePaths);
  const orphanCandidates = records
    .filter((record) => inlinks.get(record.path) === 0)
    .map((record) => ({
      path: record.path,
      family: record.family,
      bytes: record.bytes,
      nonMarkdownReferenceFiles: nonMarkdown.hits.get(record.path) ?? [],
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const zeroLocalReferenceCandidates = orphanCandidates
    .filter((record) => record.nonMarkdownReferenceFiles.length === 0)
    .map(({ path: filePath, family, bytes }) => ({ path: filePath, family, bytes }));

  return {
    root: absoluteRoot,
    scannedFiles: records.length,
    unreadableOrMissingFiles: linkIssues.length,
    localLinkDestinations: localLinks,
    exactDuplicateGroupCount: duplicateGroups.length,
    exactDuplicateFileCount: duplicateGroups.reduce((total, group) => total + group.count, 0),
    filenameFamilyCount: familyGroups.length,
    familyCandidateFileCount: familyGroups.reduce((total, group) => total + group.count, 0),
    zeroInboundLinkCandidateCount: orphanCandidates.length,
    nonMarkdownTextFilesScanned: nonMarkdown.scannedFiles,
    nonMarkdownReferenceFileCount: [...nonMarkdown.hits.values()].filter((sources) => sources.length > 0).length,
    nonMarkdownReferenceHitCount: [...nonMarkdown.hits.values()].reduce((total, sources) => total + sources.length, 0),
    textFileReadErrorCount: nonMarkdown.readErrors,
    zeroInboundAllLocalReferenceCandidateCount: zeroLocalReferenceCandidates.length,
    // Candidate lists are inventory evidence, not an automated deletion/move recommendation.
    exactDuplicateGroups: duplicateGroups,
    filenameFamilies: familyGroups,
    zeroInboundLinkCandidates: orphanCandidates,
    zeroInboundAllLocalReferenceCandidates: zeroLocalReferenceCandidates,
    fileRecords: records,
    issues: linkIssues,
  };
}

function parseArgs(args) {
  const options = { root: repoRoot, json: false };
  for (const arg of args) {
    if (arg === "--json") options.json = true;
    else if (arg.startsWith("--root=")) options.root = path.resolve(arg.slice("--root=".length));
    else throw new Error("Unknown option: " + arg);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = await buildDocumentationInventory({ root: options.root });
  if (options.json) {
    console.log(JSON.stringify(inventory, null, 2));
    return;
  }
  console.log("DOCUMENTATION INVENTORY");
  console.log("markdownFiles=" + inventory.scannedFiles);
  console.log("localLinkDestinations=" + inventory.localLinkDestinations);
  console.log("exactDuplicateGroups=" + inventory.exactDuplicateGroupCount);
  console.log("filesInExactDuplicateGroups=" + inventory.exactDuplicateFileCount);
  console.log("filenameFamilyGroups=" + inventory.filenameFamilyCount);
  console.log("filesInFilenameFamilies=" + inventory.familyCandidateFileCount);
  console.log("zeroInboundMarkdownLinkCandidates=" + inventory.zeroInboundLinkCandidateCount);
  console.log("nonMarkdownTextFilesScanned=" + inventory.nonMarkdownTextFilesScanned);
  console.log("markdownFilesReferencedFromNonMarkdownText=" + inventory.nonMarkdownReferenceFileCount);
  console.log("nonMarkdownReferenceHits=" + inventory.nonMarkdownReferenceHitCount);
  console.log("zeroInboundAllScannedLocalReferenceCandidates=" + inventory.zeroInboundAllLocalReferenceCandidateCount);
  console.log("textFileReadErrors=" + inventory.textFileReadErrorCount);
  console.log("unreadableOrMissingMarkdownFiles=" + inventory.unreadableOrMissingFiles);
  console.log("");
  console.log("LARGEST EXACT DUPLICATE GROUPS (preserve until link/provenance review):");
  for (const group of inventory.exactDuplicateGroups.slice(0, 20)) {
    console.log("- count=" + group.count + " sha256=" + group.sha256 + " paths=" + group.paths.slice(0, 8).join(" | "));
  }
  console.log("");
  console.log("LARGEST NAME FAMILIES (candidate snapshots, not proven duplicates):");
  for (const family of inventory.filenameFamilies.slice(0, 25)) {
    console.log("- " + family.family + ": " + family.count + " files; examples=" + family.paths.slice(0, 5).join(" | "));
  }
  console.log("");
  console.log("ZERO-INBOUND-LINK SAMPLE (not proof of orphaned/unneeded content):");
  for (const file of inventory.zeroInboundLinkCandidates.slice(0, 30)) console.log("- " + file.path + " (non-Markdown references: " + file.nonMarkdownReferenceFiles.length + ")");
  console.log("");
  console.log("NO INBOUND LOCAL REFERENCES IN SCANNED TREES (still require external/provenance review):");
  for (const file of inventory.zeroInboundAllLocalReferenceCandidates.slice(0, 30)) console.log("- " + file.path);
  if (inventory.issues.length) {
    console.log("");
    console.log("INVENTORY READ ISSUES:");
    for (const issue of inventory.issues.slice(0, 30)) console.log("- " + issue.path + ": " + issue.reason);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("DOCUMENTATION INVENTORY ERROR:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
