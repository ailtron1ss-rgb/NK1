import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const workflows = readdirSync(workflowDir).filter(name => /\.ya?ml$/i.test(name)).sort();
assert.ok(workflows.length > 0, 'expected at least one GitHub Actions workflow');

const errors = [];
for (const name of workflows) {
  const content = readFileSync(path.join(workflowDir, name), 'utf8');
  if (/uses:\s*actions\/checkout@v(?!7(?:\s|$))\d+/m.test(content)) {
    errors.push(`${name}: actions/checkout must use the Node 24-compatible v7 major`);
  }
  if (/uses:\s*actions\/setup-node@v(?!7(?:\s|$))\d+/m.test(content)) {
    errors.push(`${name}: actions/setup-node must use the Node 24-compatible v7 major`);
  }
  if (/uses:\s*actions\/setup-node@v7/m.test(content) && !/node-version:\s*['"]?24(?:\.x)?['"]?\s*$/m.test(content)) {
    errors.push(`${name}: setup-node@v7 must explicitly select Node.js 24`);
  }
}
const nvmrc = readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
assert.match(nvmrc, /^24(?:\.\d+(?:\.\d+)?)?$/, '.nvmrc must select Node.js 24');
assert.deepEqual(errors, [], errors.join('\n'));
console.log(`ACTIONS_RUNTIME_AUDIT=PASS workflows=${workflows.length} node=${nvmrc}`);
