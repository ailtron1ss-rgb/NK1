import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from '../../../app/node_modules/typescript/lib/typescript.js';

const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  useDefineForClassFields: true,
  verbatimModuleSyntax: true,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
};

/**
 * Test-only TypeScript ESM loader. It performs transpilation (including
 * parameter properties) with the repository's pinned TypeScript package.
 * Type checking remains a separate CI gate.
 */
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.(?:ts|tsx)$/.test(new URL(url).pathname)) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: options,
      fileName: fileURLToPath(url),
      reportDiagnostics: false,
    });
    return { format: 'module', source: output.outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
