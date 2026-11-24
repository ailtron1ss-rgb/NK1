import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowDir = path.join(root, '.github', 'workflows');
const workflows = readdirSync(workflowDir).filter(name => /\.ya?ml$/i.test(name)).sort();
assert.ok(workflows.length > 0, 'expected at least one GitHub Actions workflow');

const nvmrc = readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
assert.match(nvmrc, /^24(?:\.\d+(?:\.\d+)?)?$/, '.nvmrc must select Node.js 24');

const nodeVersionValue = content => {
  const match = content.match(/^\s*node-version:\s*(['"]?)([^'"\n]+?)\1\s*$/m);
  return match ? match[2] : null;
};
const nodeVersionFileValue = content => {
  const match = content.match(/^\s*node-version-file:\s*(['"]?)([^'"\n]+?)\1\s*$/m);
  return match ? match[2] : null;
};
// `.nvmrc` is authoritative for the Node 24 pin, so a workflow may select the
// version either inline (node-version: 24) or by referencing the pin file.
const selectsNode24 = content => {
  if (/^\s*node-version:\s*['"]?24(?:\.x)?['"]?\s*$/m.test(content)) return true;
  return nodeVersionFileValue(content) === '.nvmrc';
};

const errors = [];
for (const name of workflows) {
  const content = readFileSync(path.join(workflowDir, name), 'utf8');
  if (/uses:\s*actions\/checkout@v(?!7(?:\s|$))\d+/m.test(content)) {
    errors.push(`${name}: actions/checkout must use the Node 24-compatible v7 major`);
  }
  if (/uses:\s*actions\/setup-node@v(?!7(?:\s|$))\d+/m.test(content)) {
    errors.push(`${name}: actions/setup-node must use the Node 24-compatible v7 major`);
  }
  if (!/uses:\s*actions\/setup-node@v7/m.test(content)) continue;
  if (selectsNode24(content)) continue;
  const pinned = nodeVersionValue(content);
  errors.push(
    pinned
      ? `${name}: setup-node@v7 pins Node.js ${pinned} but the repository requires ${nvmrc}`
      : `${name}: setup-node@v7 must select Node.js ${nvmrc} via node-version or node-version-file: .nvmrc`
  );
}
assert.deepEqual(errors, [], errors.join('\n'));
console.log(`ACTIONS_RUNTIME_AUDIT=PASS workflows=${workflows.length} node=${nvmrc}`);
