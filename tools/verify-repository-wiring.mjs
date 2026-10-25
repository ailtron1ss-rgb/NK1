import fs from 'node:fs';
import path from 'node:path';

const NODE_FILE = /\bnode\s+(?:(?:--[\w-]+)(?:=[^\s]+)?\s+)*(?:"([^"]+\.(?:mjs|cjs|js|ts|mts|cts|tsx|jsx))"|'([^']+\.(?:mjs|cjs|js|ts|mts|cts|tsx|jsx))'|([^\s;&|"'()]+\.(?:mjs|cjs|js|ts|mts|cts|tsx|jsx)))(?=\s|$)/g;
const PYTHON_FILE = /\bpython3?\s+(?:"([^"]+\.py)"|'([^']+\.py)'|([^\s;&|"']+\.py))(?=\s|$)/g;
const NPM_RUN = /\bnpm(?:\.cmd)?\s+(?:--prefix\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))\s+)?run\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9:_-]+))/g;

function unquote(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}


const CODE_EXTENSIONS = /\.(?:mjs|cjs|js|ts|tsx|mts|cts|jsx)$/i;
const IGNORED_SOURCE_DIRECTORIES = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '.turbo', 'vendor', 'artifacts', 'out'
]);

function canonicalPathWithMissingTail(candidatePath) {
  let current = path.resolve(candidatePath);
  const missingSegments = [];
  while (true) {
    try {
      const realCurrent = fs.realpathSync(current);
      return path.resolve(realCurrent, ...missingSegments.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(candidatePath);
      missingSegments.push(path.basename(current));
      current = parent;
    }
  }
}

function isWithinRoot(rootDirectory, candidatePath) {
  const canonicalRoot = canonicalPathWithMissingTail(rootDirectory);
  const canonicalCandidate = canonicalPathWithMissingTail(candidatePath);
  const relative = path.relative(canonicalRoot, canonicalCandidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}


function walkCodeFiles(directory, rootDirectory = directory) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
  catch { return results; }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(rootDirectory, fullPath).split(path.sep);
    const historicalSnapshot = relative[0] === 'legacy' || (
      relative[0] === 'app' && relative[1] === 'src' && relative[2] === 'legacy' && relative[3] === 'browser-organism'
    );
    const runtimeHistory = relative[0] === 'runtime' && relative[1] === 'neuro-kurisu' && (
      (relative[2] === 'docs' && relative[3] === 'history') ||
      (relative[2] === 'research' && relative[3] === 'history') ||
      (relative[2] === 'tests' && relative[3] === 'history') ||
      (relative[2] === 'scripts' && relative[3] === 'history')
    );
    if (entry.isDirectory()) {
      if (!IGNORED_SOURCE_DIRECTORIES.has(entry.name) && !historicalSnapshot && !runtimeHistory) {
        results.push(...walkCodeFiles(fullPath, rootDirectory));
      }
    } else if (entry.isFile() && CODE_EXTENSIONS.test(entry.name) && !historicalSnapshot && !runtimeHistory) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function extractRelativeModuleSpecifiers(source) {
  const found = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '/' && source[index + 1] === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2);
      index = close < 0 ? source.length : close + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === String.fromCharCode(96)) {
      const quote = char;
      const stringStart = index;
      let cursor = index + 1;
      let value = '';
      while (cursor < source.length) {
        const current = source[cursor];
        if (current === '\\') {
          if (cursor + 1 < source.length) value += source[cursor + 1];
          cursor += 2;
          continue;
        }
        if (current === quote) break;
        value += current;
        cursor += 1;
      }
      const prefix = source.slice(Math.max(0, stringStart - 120), stringStart);
      const isModuleSpecifier = /\bfrom\s*$/.test(prefix) ||
        /\bimport\s*(?:\(\s*)?$/.test(prefix) ||
        /\brequire\s*\(\s*$/.test(prefix);
      if (isModuleSpecifier && (value.startsWith('./') || value.startsWith('../'))) {
        found.push(value);
      }
      index = Math.min(source.length, cursor + 1);
      continue;
    }
    index += 1;
  }
  return found;
}

function resolveRelativeModule(importerPath, specifier, rootDirectory) {
  const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
  // Dynamic/template-built paths cannot be statically resolved; avoid false positives.
  if (!cleanSpecifier || /[{}$*]/.test(cleanSpecifier)) return true;
  const base = path.resolve(path.dirname(importerPath), cleanSpecifier);
  if (rootDirectory && !isWithinRoot(rootDirectory, base)) return false;
  const extension = path.extname(cleanSpecifier).toLowerCase();
  const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json']);
  const candidates = [base];
  if (extension === '.js') candidates.push(base.slice(0, -3) + '.d.ts', base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx', base.slice(0, -3) + '.mts', base.slice(0, -3) + '.cts');
  else if (extension === '.mjs') candidates.push(base.slice(0, -4) + '.d.mts', base.slice(0, -4) + '.mts', base.slice(0, -4) + '.ts');
  else if (extension === '.cjs') candidates.push(base.slice(0, -4) + '.d.cts', base.slice(0, -4) + '.cts', base.slice(0, -4) + '.ts');
  else if (extension === '.jsx') candidates.push(base.slice(0, -4) + '.tsx');
  else if (!sourceExtensions.has(extension)) {
    for (const suffix of ['.ts', '.tsx', '.mts', '.cts', '.d.ts', '.d.mts', '.d.cts', '.js', '.jsx', '.mjs', '.cjs', '.json']) candidates.push(base + suffix);
    for (const suffix of ['.ts', '.tsx', '.mts', '.cts', '.d.ts', '.d.mts', '.d.cts', '.js', '.jsx', '.mjs', '.cjs']) candidates.push(path.join(base, 'index' + suffix));
  }
  for (const candidate of new Set(candidates)) {
    try { if (fs.statSync(candidate).isFile()) return true; } catch { /* next resolution candidate */ }
  }
  return false;
}

function collectWorkflowJobs(content) {
  const lines = content.split(/\r?\n/);
  const jobsLine = lines.findIndex(line => /^(\s*)jobs:\s*(?:#.*)?$/.test(line));
  if (jobsLine < 0) return { jobIds: new Set(), dependencies: [], jobCount: 0 };
  const jobsIndent = lines[jobsLine].match(/^(\s*)/)[0].length;
  let sectionEnd = jobsLine + 1;
  while (sectionEnd < lines.length) {
    const line = lines[sectionEnd];
    if (line.trim() && line.match(/^\s*/)[0].length <= jobsIndent) break;
    sectionEnd += 1;
  }

  const firstContentLine = lines.slice(jobsLine + 1, sectionEnd)
    .find(line => line.trim() && !line.trimStart().startsWith('#'));
  if (!firstContentLine) return { jobIds: new Set(), dependencies: [], jobCount: 0 };
  const jobIndent = firstContentLine.match(/^\s*/)[0].length;
  const jobPattern = /^(\s*)([A-Za-z0-9_-]+):\s*(?:#.*)?$/;
  const jobStarts = [];
  for (let index = jobsLine + 1; index < sectionEnd; index += 1) {
    const match = lines[index].match(jobPattern);
    if (match && match[1].length === jobIndent) jobStarts.push({ index, id: match[2] });
  }

  const jobIds = new Set(jobStarts.map(job => job.id));
  const dependencies = [];
  for (let position = 0; position < jobStarts.length; position += 1) {
    const job = jobStarts[position];
    const end = jobStarts[position + 1]?.index ?? sectionEnd;
    const propertyIndent = lines.slice(job.index + 1, end)
      .filter(line => line.trim() && !line.trimStart().startsWith('#'))
      .map(line => line.match(/^\s*/)[0].length)
      .filter(indent => indent > jobIndent)
      .sort((left, right) => left - right)[0];
    if (propertyIndent === undefined) continue;

    for (let index = job.index + 1; index < end; index += 1) {
      const field = lines[index].match(/^(\s*)needs:\s*(.*?)\s*$/);
      if (!field || field[1].length !== propertyIndent) continue;
      const tail = stripYamlComment(field[2]).trim();
      let needed = [];
      if (tail.startsWith('[') && tail.endsWith(']')) {
        needed = tail.slice(1, -1).split(',').map(value => unquote(value.trim())).filter(Boolean);
      } else if (tail) {
        needed = [unquote(tail)];
      } else {
        for (let cursor = index + 1; cursor < end; cursor += 1) {
          if (lines[cursor].trim() && lines[cursor].match(/^\s*/)[0].length <= propertyIndent) break;
          const item = lines[cursor].match(/^\s*-\s*(.*?)\s*$/);
          if (item) needed.push(unquote(stripYamlComment(item[1])));
        }
      }
      for (const dependency of needed) {
        if (!dependency || /[\x24{}*]/.test(dependency)) continue;
        dependencies.push({ jobId: job.id, dependency });
      }
    }
  }
  return { jobIds, dependencies, jobCount: jobIds.size };
}


function walkYamlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walkYamlFiles(fullPath));
    else if (/\.ya?ml$/i.test(entry.name)) results.push(fullPath);
  }
  return results.sort();
}

function stripYamlComment(value) {
  const input = String(value ?? '');
  let quote = null;
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quote === '"') {
      if (escaped) { escaped = false; continue; }
      if (character === '\\') { escaped = true; continue; }
      if (character === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      if (character === "'" && input[index + 1] === "'") { index += 1; continue; }
      if (character === "'") quote = null;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '#' && (index === 0 || /\s/.test(input[index - 1]))) return input.slice(0, index).trimEnd();
  }
  return input.trimEnd();
}
function collectWorkflowRunNames(content) {
  const lines = content.split(/\r?\n/);
  const names = [];
  for (let i = 0; i < lines.length; i += 1) {
    const start = lines[i].match(/^(\s*)workflow_run:\s*$/);
    if (!start) continue;
    const sectionIndent = start[1].length;
    const block = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() && lines[j].match(/^\s*/)[0].length <= sectionIndent) break;
      block.push(lines[j]);
    }
    for (let j = 0; j < block.length; j += 1) {
      const workflowField = block[j].match(/^\s*workflows:\s*(.*?)\s*$/);
      if (!workflowField) continue;
      const tail = stripYamlComment(workflowField[1]);
      if (tail.startsWith('[') && tail.endsWith(']')) {
        for (const item of tail.slice(1, -1).split(',')) {
          const value = unquote(item);
          if (value) names.push(value);
        }
      } else {
        const fieldIndent = block[j].match(/^\s*/)[0].length;
        for (let k = j + 1; k < block.length; k += 1) {
          if (block[k].trim() && block[k].match(/^\s*/)[0].length <= fieldIndent) break;
          const item = block[k].match(/^\s*-\s*(.*?)\s*$/);
          if (item) {
            const value = unquote(stripYamlComment(item[1]));
            if (value) names.push(value);
          }
        }
      }
    }
  }
  return names;
}

function collectSteps(content) {
  const lines = content.split(/\r?\n/);
  const steps = [];
  for (let section = 0; section < lines.length; section += 1) {
    const sectionMatch = lines[section].match(/^(\s*)steps:\s*(?:#.*)?$/);
    if (!sectionMatch) continue;
    const sectionIndent = sectionMatch[1].length;
    let end = section + 1;
    while (end < lines.length) {
      const current = lines[end];
      if (current.trim() && current.match(/^\s*/)[0].length <= sectionIndent) break;
      end += 1;
    }
    let stepIndent = null;
    const starts = [];
    for (let cursor = section + 1; cursor < end; cursor += 1) {
      const item = lines[cursor].match(/^(\s*)-\s+/);
      if (!item) continue;
      const indent = item[1].length;
      if (stepIndent === null) stepIndent = indent;
      if (indent === stepIndent) starts.push(cursor);
    }
    for (let index = 0; index < starts.length; index += 1) {
      steps.push(lines.slice(starts[index], starts[index + 1] ?? end).join('\n'));
    }
    section = end - 1;
  }
  return steps;
}
function extractRunText(step) {
  const lines = step.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*)(?:-\s*)?run:\s*(.*?)\s*$/);
    if (!match) continue;
    const indent = match[1].length;
    const tail = stripYamlComment(match[2]);
    if (tail && !/^[|>][-+]?\s*$/.test(tail)) return unquote(tail);
    const commands = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() && lines[j].match(/^\s*/)[0].length <= indent) break;
      commands.push(lines[j].replace(new RegExp('^\\s{' + (indent + 2) + '}'), ''));
    }
    return commands.join('\n');
  }
  return '';
}

function collectPathFilters(content) {
  const lines = content.split(/\r?\n/);
  const paths = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*)paths:\s*(.*?)\s*$/);
    if (!match) continue;
    const indent = match[1].length;
    const tail = stripYamlComment(match[2]);
    if (tail.startsWith('[') && tail.endsWith(']')) {
      for (const item of tail.slice(1, -1).split(',')) paths.push(unquote(item));
      continue;
    }
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() && lines[j].match(/^\s*/)[0].length <= indent) break;
      const item = lines[j].match(/^\s*-\s*(.*?)\s*$/);
      if (item) paths.push(unquote(stripYamlComment(item[1])));
    }
  }
  return paths.filter(Boolean);
}

export function auditRepositoryWiring(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const errors = [];
  const errorKeys = new Set();
  const packageCache = new Map();
  const auditedScripts = new Set();
  const activeScripts = new Set();
  const workflowFiles = walkYamlFiles(path.join(root, '.github', 'workflows'));
  const workflowNameToFile = new Map();
  let workflowJobsChecked = 0;
  let workflowDependenciesChecked = 0;
  let localActionsChecked = 0;

  function report(message) {
    if (errorKeys.has(message)) return;
    errorKeys.add(message);
    errors.push(message);
  }

  function readPackage(packageDirectory, origin) {
    const absoluteDirectory = path.resolve(packageDirectory);
    if (!isWithinRoot(root, absoluteDirectory)) {
      report(origin + ': npm package path escapes repository root: ' + path.relative(root, absoluteDirectory));
      packageCache.set(absoluteDirectory, null);
      return null;
    }
    if (packageCache.has(absoluteDirectory)) return packageCache.get(absoluteDirectory);
    const packagePath = path.join(absoluteDirectory, 'package.json');
    if (!fs.existsSync(packagePath)) {
      report(origin + ': package.json not found at ' + path.relative(root, packagePath));
      packageCache.set(absoluteDirectory, null);
      return null;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const record = { directory: absoluteDirectory, path: packagePath, scripts: parsed.scripts ?? {} };
      packageCache.set(absoluteDirectory, record);
      return record;
    } catch (error) {
      report(origin + ': invalid JSON in ' + path.relative(root, packagePath) + ' (' + error.message + ')');
      packageCache.set(absoluteDirectory, null);
      return null;
    }
  }


  function checkLocalFile(candidate, origin) {
    const absolutePath = path.resolve(candidate);
    if (!isWithinRoot(root, absolutePath)) {
      report(origin + ': referenced path escapes repository root: ' + path.relative(root, absolutePath));
      return;
    }
    if (!fs.existsSync(absolutePath)) report(origin + ': referenced path not found: ' + path.relative(root, absolutePath));
  }


  function auditShellCommands(commandText, workingDirectory, origin, ancestry = []) {
    let currentDirectory = path.resolve(workingDirectory);
    const normalizedCommands = String(commandText).replace(/\\\r?\n[ \t]*/g, ' ');
    const commandLines = normalizedCommands.split(/\r?\n/);
    for (const line of commandLines) {
      // Build one ordered stream of statically recognizable operations. Resolving all
      // `cd` commands before file/script references loses shell evaluation order.
      const operations = [];
      const cdPattern = /(?:^|&&|\|\||;)\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g;
      for (const match of line.matchAll(cdPattern)) {
        operations.push({ index: match.index ?? 0, type: 'cd', target: match[1] ?? match[2] ?? match[3] });
      }

      NODE_FILE.lastIndex = 0;
      for (const match of line.matchAll(NODE_FILE)) {
        operations.push({ index: match.index ?? 0, type: 'node', target: match[1] ?? match[2] ?? match[3] });
      }

      PYTHON_FILE.lastIndex = 0;
      for (const match of line.matchAll(PYTHON_FILE)) {
        operations.push({ index: match.index ?? 0, type: 'python', target: match[1] ?? match[2] ?? match[3] });
      }

      NPM_RUN.lastIndex = 0;
      for (const match of line.matchAll(NPM_RUN)) {
        operations.push({
          index: match.index ?? 0,
          type: 'npm',
          prefix: match[1] ?? match[2] ?? match[3],
          scriptName: match[4] ?? match[5] ?? match[6]
        });
      }

      operations.sort((a, b) => a.index - b.index);
      for (const operation of operations) {
        if (operation.type === 'cd') {
          const destination = operation.target;
          if (destination && !destination.startsWith('$') && !destination.startsWith('<')) {
            const nextDirectory = path.resolve(currentDirectory, destination);
            if (!isWithinRoot(root, nextDirectory)) {
              report(origin + ': cd target escapes repository root: ' + path.relative(root, nextDirectory));
              continue;
            }
            currentDirectory = nextDirectory;
            if (!fs.existsSync(currentDirectory)) {
              report(origin + ': cd target not found: ' + path.relative(root, currentDirectory));
            }
          }
          continue;
        }

        if (operation.target && !operation.target.startsWith('$') && !operation.target.startsWith('<')) {
          checkLocalFile(path.resolve(currentDirectory, operation.target), origin);
        }

        if (operation.type === 'npm') {
          const packageDirectory = operation.prefix
            ? path.resolve(currentDirectory, operation.prefix)
            : currentDirectory;
          auditNpmScript(packageDirectory, operation.scriptName, origin, ancestry);
        }
      }
    }
  }

  function auditNpmScript(packageDirectory, scriptName, origin, ancestry) {
    const pkg = readPackage(packageDirectory, origin);
    if (!pkg) return;
    const scriptValue = pkg.scripts[scriptName];
    const label = path.relative(root, pkg.path) + ' :: ' + scriptName;
    if (typeof scriptValue !== 'string') {
      report(origin + ': npm script not defined: ' + label);
      return;
    }
    const key = pkg.path + '::' + scriptName;
    if (ancestry.includes(key) || activeScripts.has(key)) {
      report(origin + ': cyclic npm script reference: ' + ancestry.concat(key).map(value => value.split('::').slice(-1)[0]).join(' -> '));
      return;
    }
    if (auditedScripts.has(key)) return;
    activeScripts.add(key);
    auditShellCommands(scriptValue, pkg.directory, 'npm script ' + label, ancestry.concat(key));
    activeScripts.delete(key);
    auditedScripts.add(key);
  }

  for (const workflowPath of workflowFiles) {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const workflowRelative = path.relative(root, workflowPath);
    const nameMatch = content.match(/^name:\s*(.*?)\s*$/m);
    if (nameMatch) {
      const name = unquote(stripYamlComment(nameMatch[1]));
      if (name) workflowNameToFile.set(name, workflowRelative);
    }
  }

  for (const workflowPath of workflowFiles) {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const workflowRelative = path.relative(root, workflowPath);
    const workflowJobs = collectWorkflowJobs(content);
    workflowJobsChecked += workflowJobs.jobCount;
    for (const edge of workflowJobs.dependencies) {
      workflowDependenciesChecked += 1;
      if (!workflowJobs.jobIds.has(edge.dependency)) {
        report(workflowRelative + ': job "' + edge.jobId + '" needs missing workflow job "' + edge.dependency + '"');
      }
    }

    for (const workflowName of collectWorkflowRunNames(content)) {
      if (!workflowNameToFile.has(workflowName)) report(workflowRelative + ': workflow_run references missing workflow name: ' + workflowName);
    }

    for (const step of collectSteps(content)) {
      const origin = workflowRelative + ' step';
      const workingMatch = step.match(/^\s*working-directory:\s*(.*?)\s*$/m);
      let workingDirectory = root;
      if (workingMatch) {
        const value = unquote(stripYamlComment(workingMatch[1]));
        if (value && !value.includes('$' + '{{') && !value.startsWith('$')) {
          const requestedWorkingDirectory = path.resolve(root, value);
          if (!isWithinRoot(root, requestedWorkingDirectory)) {
            report(origin + ': working-directory escapes repository root: ' + value);
          } else {
            workingDirectory = requestedWorkingDirectory;
            if (!fs.existsSync(workingDirectory)) report(origin + ': working-directory not found: ' + value);
          }
        }
      }

      for (const match of step.matchAll(/^\s*(?:-\s*)?uses:\s*(\.\/[^\s#]+)/gm)) {
        localActionsChecked += 1;
        const actionPath = path.resolve(root, match[1]);
        checkLocalFile(actionPath, origin);
        if (!isWithinRoot(root, actionPath) || !fs.existsSync(actionPath)) continue;
        let stat;
        try { stat = fs.statSync(actionPath); } catch { continue; }
        if (!stat.isDirectory()) {
          report(origin + ': local action path must be a directory: ' + match[1]);
          continue;
        }
        const manifestName = ['action.yml', 'action.yaml'].find(name => fs.existsSync(path.join(actionPath, name)));
        if (!manifestName) {
          report(origin + ': local action manifest not found (action.yml or action.yaml): ' + match[1]);
          continue;
        }
        const manifestPath = path.join(actionPath, manifestName);
        if (!isWithinRoot(root, manifestPath)) {
          report(origin + ': local action manifest escapes repository root: ' + manifestPath);
          continue;
        }
        try {
          if (!fs.statSync(manifestPath).isFile()) {
            report(origin + ': local action manifest is not a file: ' + manifestPath);
          }
        } catch {
          report(origin + ': local action manifest is not readable: ' + manifestPath);
        }
      }

      for (const key of ['node-version-file', 'cache-dependency-path']) {
        const property = new RegExp('^\\s*' + key + ':\\s*([^\\n]+)', 'm');
        const valueMatch = step.match(property);
        if (valueMatch) {
          const value = unquote(stripYamlComment(valueMatch[1]));
          if (value && !value.includes('$' + '{{') && !value.startsWith('$') && !value.includes('*')) {
            checkLocalFile(path.resolve(root, value), origin + ' ' + key);
          }
        }
      }

      const runText = extractRunText(step);
      if (runText) auditShellCommands(runText, workingDirectory, origin);
    }

    for (const filterPath of collectPathFilters(content)) {
      const normalized = filterPath.replace(/^!/, '');
      if (!normalized || normalized.includes('*') || normalized.includes('?') || normalized.includes('[') || normalized.includes(']') || normalized.includes('$' + '{{')) continue;
      checkLocalFile(path.resolve(root, normalized), workflowRelative + ' path filter');
    }
  }


  // Resolve local JavaScript/TypeScript module edges beyond paths executed by CI.
  const codeFiles = walkCodeFiles(root);
  let relativeImportsChecked = 0;
  for (const codePath of codeFiles) {
    let source;
    try {
      source = fs.readFileSync(codePath, 'utf8');
    } catch (error) {
      report(path.relative(root, codePath) + ': unable to read source module (' + error.message + ')');
      continue;
    }
    for (const specifier of extractRelativeModuleSpecifiers(source)) {
      relativeImportsChecked += 1;
      if (!resolveRelativeModule(codePath, specifier, root)) {
        report(path.relative(root, codePath) + ': unresolved relative module import ' + JSON.stringify(specifier));
      }
    }
  }

  return {
    errors,
    workflowsScanned: workflowFiles.length,
    sourceFilesScanned: codeFiles.length,
    relativeImportsChecked,
    npmScriptsChecked: auditedScripts.size,
    packagesRead: [...packageCache.values()].filter(Boolean).length
    workflowJobsChecked,
    workflowDependenciesChecked,
    localActionsChecked
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const result = auditRepositoryWiring(process.cwd());
  if (result.errors.length) {
    console.error('Repository wiring audit FAILED with ' + result.errors.length + ' issue(s):');
    for (const error of result.errors) console.error(' - ' + error);
    process.exitCode = 1;
  } else {
    console.log('Repository wiring audit PASS: ' + result.workflowsScanned + ' workflows, ' + result.sourceFilesScanned + ' source files, ' + result.relativeImportsChecked + ' relative imports, ' + result.npmScriptsChecked + ' reachable npm scripts, ' + result.packagesRead + ' package manifests checked.');
  }
}
