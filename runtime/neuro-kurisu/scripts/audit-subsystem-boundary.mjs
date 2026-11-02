import fs from 'node:fs';
import path from 'node:path';
import { maskNonCode } from './lib/source-mask.mjs';
import { DOMAIN_SUBSYSTEMS, FROZEN_CROSS_SUBSYSTEM_EDGES, edgeKey, isDomain, newCrossSubsystemEdges } from './lib/subsystem-boundary-rules.mjs';

const root = process.cwd();
const subRoot = path.join(root, 'src', 'organism');

const subsystemOf = (p) => {
  const rel = path.relative(subRoot, p);
  const i = rel.indexOf(path.sep);
  return i < 0 ? null : rel.slice(0, i);
};

const files = [];
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (p.endsWith('.ts')) files.push(p);
  }
})(subRoot);

const pat = /(?:from\s*|import\s*|import\()(['"])(\.\.?\/[^'"]+)\1/g;
const observed = new Set();

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const runtime = text.replace(/import\s+type\s+[^;\n]+from\s*['"][^'"]+['"]\s*;?/g, '');
  const masked = maskNonCode(runtime);
  let m;
  while ((m = pat.exec(runtime))) {
    if (masked.slice(m.index, m.index + m[0].length).trim() === '') continue;
    const clean = m[2].split('?')[0];
    const p = path.resolve(path.dirname(f), clean);
    const target = [p, ...['.ts', '.tsx', '.mts', '.cts'].map((e) => p + e), path.join(p, 'index.ts')]
      .find((x) => fs.existsSync(x) && fs.statSync(x).isFile());
    if (!target) continue;
    const from = subsystemOf(f);
    const to = subsystemOf(target);
    if (!from || !to || from === to) continue;
    if (!isDomain(from) || !isDomain(to)) continue;
    observed.add(edgeKey(from, to));
  }
}

const fresh = newCrossSubsystemEdges(observed);
if (fresh.length) {
  console.error(`cross-subsystem-ratchet: new domain->domain imports are not allowed:\n${fresh.join('\n')}`);
  console.error(`\nIf the new edge is intentional, add it to FROZEN_CROSS_SUBSYSTEM_EDGES in scripts/lib/subsystem-boundary-rules.mjs with a rationale.`);
  process.exit(1);
}
console.log(`SUBSYSTEM_BOUNDARY=PASS domains=${DOMAIN_SUBSYSTEMS.length} observedEdges=${observed.size} frozenEdges=${FROZEN_CROSS_SUBSYSTEM_EDGES.size} newEdges=0`);
