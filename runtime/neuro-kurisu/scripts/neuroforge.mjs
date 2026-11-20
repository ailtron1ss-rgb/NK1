#!/usr/bin/env node
import { lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { analyzeNeuroForge, renderNeuroForgeProposal, renderNeuroForgeSummary } from '../src/organism/research/neuroforge/NeuroForgeEngine.ts';
import { scanNeuroForgeProject } from '../src/organism/research/neuroforge/NeuroForgeScanner.ts';

function parseArgs(argv) {
  const result = { command: argv[0] ?? 'help', values: {} };
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for ' + key);
    result.values[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

async function isFile(path) {
  try { return (await lstat(path)).isFile(); } catch { return false; }
}

async function isDirectory(path) {
  try { return (await lstat(path)).isDirectory(); } catch { return false; }
}

async function discoverDonorRoots(root) {
  const absoluteRoot = resolve(root);
  const manifestMarkers = [
    'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'requirements.txt',
    'setup.py', 'setup.cfg', 'composer.json', 'Gemfile', 'pom.xml', 'build.gradle',
    'CMakeLists.txt', 'mix.exs',
  ];
  for (const marker of manifestMarkers) {
    if (await isFile(resolve(absoluteRoot, marker))) return [absoluteRoot];
  }

  // README/LICENSE files also occur in collection roots. A repository is treated
  // as one donor only when there is a project manifest, a Git directory, or a
  // conventional source root; otherwise direct child directories are separate donors.
  if (await isDirectory(resolve(absoluteRoot, '.git'))) return [absoluteRoot];
  const sourceRoots = ['src', 'app', 'lib', 'core', 'runtime', 'packages', 'cmd', 'internal'];
  for (const directory of sourceRoots) {
    if (await isDirectory(resolve(absoluteRoot, directory))) return [absoluteRoot];
  }

  const entries = await readdir(absoluteRoot, { withFileTypes: true });
  const roots = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => resolve(absoluteRoot, entry.name))
    .sort();
  return roots.length ? roots : [absoluteRoot];
}

function usage() {
  return [
    'NeuroForge — offline donor inventory and capability-gap analysis',
    '',
    'Usage:',
    '  node --experimental-strip-types scripts/neuroforge.mjs analyze --baseline <nk1-src> --donors <donor-root> --out <output-dir>',
    '',
    'The donor root may be one project or a directory containing project folders.',
    'NeuroForge does not execute donor code, copy source files, or authorize reuse.',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help' || args.command === '--help') {
    process.stdout.write(usage() + '\n');
    return;
  }
  if (args.command !== 'analyze') throw new Error('Unsupported command: ' + args.command);
  const baselineRoot = args.values.baseline;
  const donorRoot = args.values.donors;
  const outputRoot = args.values.out;
  if (!baselineRoot || !donorRoot || !outputRoot) throw new Error('analyze requires --baseline, --donors and --out');

  const baseline = await scanNeuroForgeProject(resolve(baselineRoot), { projectId: 'nk1-baseline' });
  const donorRoots = await discoverDonorRoots(resolve(donorRoot));
  const donors = [];
  for (const root of donorRoots) {
    const id = basename(root).replace(/[^A-Za-z0-9._-]+/g, '-');
    donors.push(await scanNeuroForgeProject(root, { projectId: id }));
  }
  const report = analyzeNeuroForge({ baseline, donors });
  const out = resolve(outputRoot);
  await mkdir(resolve(out, 'donors'), { recursive: true });
  await mkdir(resolve(out, 'proposals'), { recursive: true });
  await writeFile(resolve(out, 'baseline.manifest.json'), JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  for (const donor of donors) {
    await writeFile(resolve(out, 'donors', donor.projectId + '.manifest.json'), JSON.stringify(donor, null, 2) + '\n', 'utf8');
    const proposals = report.proposals.filter(row => row.donorId === donor.projectId);
    await writeFile(resolve(out, 'proposals', donor.projectId + '.md'), proposals.map(renderNeuroForgeProposal).join('\n---\n\n'), 'utf8');
  }
  await writeFile(resolve(out, 'neuroforge-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(resolve(out, 'summary.md'), renderNeuroForgeSummary(report), 'utf8');
  process.stdout.write(JSON.stringify({
    ok: true,
    baselineFiles: baseline.stats.files,
    donorsScanned: donors.length,
    proposals: report.proposals.length,
    candidateGaps: report.proposals.filter(row => row.gapClass === 'candidate-gap').length,
    blockedProposals: report.proposals.filter(row => row.promotionStatus === 'blocked').length,
    output: out,
    codeCopied: false,
    donorCodeExecuted: false,
  }, null, 2) + '\n');
}

main().catch(error => {
  process.stderr.write('NeuroForge: ' + (error?.message ?? String(error)) + '\n');
  process.exitCode = 1;
});
