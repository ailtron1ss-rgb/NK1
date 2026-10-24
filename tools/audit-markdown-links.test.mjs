import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { auditMarkdownLinks, extractMarkdownLinks } from "./audit-markdown-links.mjs";

const fence = String.fromCharCode(96).repeat(3);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-markdown-links-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "docs", "sections"), { recursive: true });
  await mkdir(path.join(root, "assets"), { recursive: true });
  await writeFile(path.join(root, "docs", "guide.md"), "# Guide\n");
  await writeFile(path.join(root, "docs", "sections", "README.md"), "# Section\n");
  await writeFile(path.join(root, "assets", "logo.svg"), "<svg/>\n");
  await writeFile(path.join(root, "README.md"), [
    "# Fixture", "", "[guide](docs/guide.md#overview)", "[extensionless](docs/guide)",
    "[directory](docs/sections/)", "![logo](assets/logo.svg?raw=1)",
    "[external](https://example.com/path)", "[mail](mailto:test@example.com)", "[anchor](#fixture)",
    "", "`[not a link](missing-inline.md)`", fence + "md",
    "[not a link](missing-fenced.md)", fence, "", "[broken](missing.md#section)", "[outside](../../outside.md)", ""
  ].join("\n"), "utf8");
  return root;
}

test("extracts inline, reference-definition, and HTML destinations with line numbers", () => {
  const links = extractMarkdownLinks([
    "[normal](docs/file.md#part)", "[wrapped](<docs/file with spaces.md>)",
    "[ref]: ../README.md \"title\"", "<a href=\"docs/page.html\">page</a>", "<img src='assets/face.png' />"
  ].join("\n"));
  assert.deepEqual(links.map((link) => [link.destination, link.line, link.kind]), [
    ["docs/file.md#part", 1, "markdown"], ["docs/file with spaces.md", 2, "markdown"],
    ["../README.md", 3, "reference"], ["docs/page.html", 4, "html"], ["assets/face.png", 5, "html"]
  ]);
});

test("validates local links, extensionless Markdown links, directories, query strings and anchors", async (t) => {
  const root = await fixture(t);
  const result = await auditMarkdownLinks({ root, files: ["README.md"] });
  assert.equal(result.scannedFiles, 1);
  assert.deepEqual(result.issues.map((issue) => [issue.destination, issue.reason]), [
    ["missing.md#section", "target not found"], ["../../outside.md", "target escapes repository root"]
  ]);
  assert.equal(result.issueCount, 2);
});

test("reports broken local HTML and reference links", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "README.md"), [
    "[reference][docs]", "[docs]: missing-reference.md", "<a href='missing-page.html'>page</a>"
  ].join("\n"));
  const result = await auditMarkdownLinks({ root, files: ["README.md"] });
  assert.deepEqual(result.issues.map((issue) => [issue.line, issue.destination]), [
    [2, "missing-reference.md"], [3, "missing-page.html"]
  ]);
});

test("reports absent source files instead of silently skipping requested inputs", async (t) => {
  const root = await fixture(t);
  const result = await auditMarkdownLinks({ root, files: ["does-not-exist.md"] });
  assert.equal(result.scannedFiles, 0);
  assert.equal(result.issueCount, 1);
  assert.match(result.issues[0].reason, /source file not found/);
});

test("masks code samples and HTML comments so examples are not treated as active links", () => {
  const links = extractMarkdownLinks([
    "`[inline](inside-code.md)`", fence + "markdown", "[fenced](inside-fence.md)", fence,
    "<!-- [commented](inside-comment.md) -->", "[real](outside.md)"
  ].join("\n"));
  assert.deepEqual(links.map((link) => link.destination), ["outside.md"]);
});
