import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { auditRepositoryWiring } from './verify-repository-wiring.mjs';

function write(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-repo-wiring-'));
  write(root, '.nvmrc', '24\n');
  write(root, 'package-lock.json', '{}\n');
  write(root, 'package.json', JSON.stringify({
    name: 'fixture-root',
    private: true,
    scripts: {
      audit: 'node tools/audit.mjs',
      'test:nested': 'npm --prefix runtime run test',
      'not-used': 'npm run missing-script'
    }
  }, null, 2));
  write(root, 'runtime/package.json', JSON.stringify({
    name: 'fixture-runtime',
    private: true,
    scripts: { test: 'node --test tests/test.mjs' }
  }, null, 2));
  write(root, 'tools/audit.mjs', 'export const audit = true;\n');
  write(root, 'runtime/tests/test.mjs', 'export const test = true;\n');
  write(root, 'tools/source-a.mjs', 'export const sourceA = true;\n');
  write(root, 'tools/source-b.mjs', "import { sourceA } from './source-a.mjs';\nexport { sourceA };\n");
  write(root, 'local-action/action.yml', 'name: fixture-local-action\nruns:\n  using: composite\n  steps: []\n');
  write(root, '.github/workflows/core.yml', `name: Core validation
on:
  push:
    paths:
      - "package.json"
  pull_request:
    paths:
      - ".nvmrc"
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: ".nvmrc"
          cache-dependency-path: "package-lock.json"
      - name: Run root and nested commands
        run: |
          npm run audit
          npm run test:nested
`);
  write(root, '.github/workflows/publish.yml', `name: Release publisher
on:
  workflow_run:
    workflows: ["Core validation"]
    types: [completed]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: ./local-action
`);
  return root;
}

function withFixture(run) {
  const root = makeFixture();
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('valid workflow, npm scripts, executable paths and workflow_run names pass', () => {
  withFixture(root => {
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.workflowsScanned, 2);
    assert.equal(result.npmScriptsChecked, 3);
    assert.equal(result.packagesRead, 2);
    assert.ok(result.sourceFilesScanned >= 4);
    assert.ok(result.relativeImportsChecked >= 1);
  });
});

test('resolves shell references against the working directory active at each command', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'node tools/audit.mjs && cd runtime && node tests/test.mjs';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
  });
});

test('reports a missing executable referenced by an npm script', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'node tools/missing.mjs';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('tools/missing.mjs')));
  });
});

test('reports a missing nested npm script', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8').replace('npm run test:nested', 'npm run does-not-exist');
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('npm script not defined') && message.includes('does-not-exist')));
  });
});

test('reports workflow_run references that no workflow declares', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/publish.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8').replace('Core validation', 'Missing validation workflow');
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('workflow_run references missing workflow name')));
  });
});

test('reports exact file paths in workflow path filters when absent', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    fs.writeFileSync(workflowPath, fs.readFileSync(workflowPath, 'utf8').replace('"package.json"', '"missing-contract.json"'));
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('missing-contract.json')));
  });
});

test('detects recursive npm script wiring rather than silently accepting a cycle', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'npm run test:nested';
    pkg.scripts['test:nested'] = 'npm run audit';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('cyclic npm script reference')));
  });
});


test('reports unresolved relative imports, not only broken workflow commands', () => {
  withFixture(root => {
    const missingReference = ['im', 'port', " './ghost.mjs';"].join('');
    write(root, 'tools/broken-import.mjs', missingReference);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message =>
      message.includes('tools/broken-import.mjs') && message.includes('unresolved relative module import') && message.includes('./ghost.mjs')
    ));
  });
});


test('preserves the active working directory across 120 multiline command references', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const commands = ['node tools/audit.mjs', 'cd runtime'];
    const count = 120;
    for (let index = 0; index < count; index += 1) {
      const name = 'wiring-' + String(index).padStart(3, '0') + '.mjs';
      write(root, path.join('runtime', 'tests', name), 'export const fixture = true;\n');
      commands.push('node tests/' + name);
    }
    pkg.scripts.audit = commands.join('\n');
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
    assert.ok(result.sourceFilesScanned >= count);
  });
});

test('reports 120 distinct broken executable references rather than hiding them', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const count = 120;
    pkg.scripts.audit = Array.from({ length: count }, (_, index) =>
      'node missing/entry-' + String(index).padStart(3, '0') + '.mjs'
    ).join('\n');
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    const missing = result.errors.filter(message => message.includes('referenced path not found: missing/entry-'));
    assert.equal(missing.length, count);
    for (let index = 0; index < count; index += 1) {
      assert.ok(missing.some(message => message.includes('entry-' + String(index).padStart(3, '0') + '.mjs')));
    }
  });
});

test('resolves quoted Node and Python entry points containing spaces', () => {
  withFixture(root => {
    write(root, 'tools/check script.mjs', 'export const check = true;\n');
    write(root, 'research/check script.py', 'check = True\n');
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'node "tools/check script.mjs" && python3 "research/check script.py"';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
  });
});

test('normalizes shell line continuations before resolving entry points', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = ['node tools/audit.mjs', 'cd runtime && \\', ' node "tests/test.mjs"'].join('\n');
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
  });
});

test('supports valid workflow step indentation and quoted hashes in YAML scalars', () => {
  withFixture(root => {
    const corePath = path.join(root, '.github/workflows/core.yml');
    let core = fs.readFileSync(corePath, 'utf8');
    core = core.replace('name: Core validation', 'name: "Core # validation"');
    core = core.replace(/^ {6}/gm, '        ');
    fs.writeFileSync(corePath, core);
    const publishPath = path.join(root, '.github/workflows/publish.yml');
    let publish = fs.readFileSync(publishPath, 'utf8');
    publish = publish.replace('Core validation', '"Core # validation"');
    fs.writeFileSync(publishPath, publish);
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
  });
});

test('rejects repository-external script, import, and npm-prefix references', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'node ../outside.mjs && npm --prefix ../outside-package run test';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    write(root, 'tools/escape-import.mjs', "import '../../outside.mjs';\n");
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('referenced path escapes repository root')));
    assert.ok(result.errors.some(message => message.includes('npm package path escapes repository root')));
    assert.ok(result.errors.some(message => message.includes('unresolved relative module import')));
  });
});

test('resolves source modules with every supported JavaScript and TypeScript extension', () => {
  withFixture(root => {
    const extensions = ['.mjs', '.cjs', '.js', '.ts', '.mts', '.cts', '.tsx', '.jsx'];
    for (let index = 0; index < extensions.length; index += 1) {
      const target = 'module-' + index + extensions[index];
      write(root, path.join('tools', 'targets', target), 'export const target = true;\n');
      write(root, path.join('tools', 'importer-' + index + '.mjs'), "import './targets/" + target + "';\n");
    }
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
    assert.ok(result.relativeImportsChecked >= extensions.length + 1);
  });
});


test('rejects symlink-mediated escapes for executables, imports, and nested npm packages', () => {
  withFixture(root => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-wiring-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'outside.mjs'), 'export const outside = true;\n');
      fs.writeFileSync(path.join(outside, 'package.json'), JSON.stringify({
        name: 'outside-fixture',
        private: true,
        scripts: { test: 'node outside.mjs' }
      }, null, 2));
      fs.symlinkSync(outside, path.join(root, 'linked'), 'dir');
      write(root, 'tools/symlink-import.mjs', "import '../linked/outside.mjs';\n");

      const packagePath = path.join(root, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      pkg.scripts.audit = 'node linked/outside.mjs && npm --prefix linked run test';
      fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

      const result = auditRepositoryWiring(root);
      assert.ok(result.errors.some(message => message.includes('referenced path escapes repository root')));
      assert.ok(result.errors.some(message => message.includes('npm package path escapes repository root')));
      assert.ok(result.errors.some(message => message.includes('unresolved relative module import')));
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});


test('checks an inline workflow run step instead of silently skipping it', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const replaced = workflow.replace(
      '      - name: Run root and nested commands\n        run: |\n          npm run audit\n          npm run test:nested',
      '      - run: node missing-inline-entry.mjs'
    );
    assert.notEqual(replaced, workflow, 'fixture should replace the multiline step with an inline run step');
    fs.writeFileSync(workflowPath, replaced);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('missing-inline-entry.mjs')));
  });
});

test('checks inline local action references and requires an action manifest', () => {
  withFixture(root => {
    write(root, 'empty-action/README.md', 'This folder intentionally has no GitHub Action manifest.\n');
    const workflowPath = path.join(root, '.github/workflows/publish.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8').replace('./local-action', './empty-action');
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message =>
      message.includes('local action manifest not found') && message.includes('./empty-action')
    ));
    assert.ok(result.localActionsChecked >= 1);
  });
});

test('reports workflow jobs that depend on a missing job ID', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8').replace(
      '    runs-on: ubuntu-latest\n    steps:',
      '    runs-on: ubuntu-latest\n    needs: package-build-that-does-not-exist\n    steps:'
    );
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message =>
      message.includes('job "validate" needs missing workflow job "package-build-that-does-not-exist"')
    ));
    assert.ok(result.workflowJobsChecked >= 1);
    assert.ok(result.workflowDependenciesChecked >= 1);
  });
});

test('accepts existing scalar and block-list workflow job dependencies', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8')
      .replace('  validate:\n    runs-on: ubuntu-latest', '  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node tools/audit.mjs\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node tools/audit.mjs\n  validate:\n    needs:\n      - build\n      - lint\n    runs-on: ubuntu-latest');
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
    assert.ok(result.workflowJobsChecked >= 3);
    assert.equal(result.workflowDependenciesChecked, 2);
  });
});


test('does not let a rejected cd escape contaminate later command resolution', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'cd .. && node tools/audit.mjs';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('cd target escapes repository root')));
    assert.ok(!result.errors.some(message => message.includes('referenced path not found: ../tools/audit.mjs')));
  });
});

test('does not use a rejected workflow working-directory for its commands', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8').replace(
      '      - name: Run root and nested commands\n        run: |',
      '      - name: Run root and nested commands\n        working-directory: ../outside\n        run: |'
    );
    assert.notEqual(workflow, fs.readFileSync(workflowPath, 'utf8'));
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('working-directory escapes repository root')));
    assert.ok(!result.errors.some(message => message.includes('npm script not defined')));
  });
});


test('rejects a local action manifest symlink that resolves outside the repository', () => {
  withFixture(root => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-action-manifest-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'action.yml'), 'name: external-manifest\nruns:\n  using: composite\n  steps: []\n');
      fs.mkdirSync(path.join(root, 'leaky-action'), { recursive: true });
      fs.symlinkSync(path.join(outside, 'action.yml'), path.join(root, 'leaky-action', 'action.yml'), 'file');
      const workflowPath = path.join(root, '.github/workflows/publish.yml');
      const workflow = fs.readFileSync(workflowPath, 'utf8').replace('./local-action', './leaky-action');
      fs.writeFileSync(workflowPath, workflow);
      const result = auditRepositoryWiring(root);
      assert.ok(result.errors.some(message => message.includes('local action manifest escapes repository root')));
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
