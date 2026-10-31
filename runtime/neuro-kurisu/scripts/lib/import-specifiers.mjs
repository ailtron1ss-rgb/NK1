// Pure, dependency-free scanner for relative import/export specifiers.
//
// The architecture audit needs the relative specifiers that a module actually
// imports so it can build the dependency graph. A naive regex over the raw
// source also matches `from './x'` / `import('./x')` text that appears inside
// string literals, template literals and comments. Test fixtures that quote an
// import statement (for example `source.includes("import { X } from './X.ts'")`)
// then look like a real import and are reported as missing, which fails the
// release gate even though the code is correct.
//
// This scanner keeps the historical matching scope (`from '...'` and
// `import('...')` only) but only reports specifiers that occur in executable
// code, not in strings, template literals or comments. Returned `index` values
// point into the original string so callers can keep using ordering checks.

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;

function readQuoted(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    const c = source[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === quote) return { value: source.slice(start + 1, i), end: i };
    if (c === '\n' && quote !== '`') return null;
    i += 1;
  }
  return null;
}

// A `/` opens a regex literal only where a value may start. After an
// identifier, number or closing bracket it is a division operator.
function regexAllowedAfter(prevSignificant) {
  if (prevSignificant === null) return true;
  if (IDENT_PART.test(prevSignificant)) return false;
  return ![')', ']'].includes(prevSignificant);
}

function skipRegex(source, start) {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const c = source[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '\n') return start + 1;
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return i + 1;
    i += 1;
  }
  return start + 1;
}

export function scanRelativeImportSpecifiers(source) {
  const results = [];
  let i = 0;
  let prevSignificant = null;
  // Set after an `import type` / `export type` keyword so the statement's
  // module string is ignored, matching the historical type-stripping pass.
  let typeOnlyPending = false;

  while (i < source.length) {
    const c = source[i];

    if (c === ';') typeOnlyPending = false;

    if (c === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 ? source.length : nl;
      continue;
    }

    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const str = readQuoted(source, i);
      i = str ? str.end + 1 : i + 1;
      prevSignificant = str ? ')' : prevSignificant;
      continue;
    }

    if (c === '/' && regexAllowedAfter(prevSignificant)) {
      i = skipRegex(source, i);
      prevSignificant = ')';
      continue;
    }

    if (IDENT_START.test(c)) {
      let j = i + 1;
      while (j < source.length && IDENT_PART.test(source[j])) j += 1;
      const word = source.slice(i, j);

      let k = j;
      while (k < source.length && /\s/.test(source[k])) k += 1;

      const isDynamicImport = word === 'import' && source[k] === '(';
      let quoteAt = isDynamicImport ? k + 1 : k;
      if (isDynamicImport) {
        while (quoteAt < source.length && /\s/.test(source[quoteAt])) quoteAt += 1;
      }
      const hasQuote =
        (word === 'from' || isDynamicImport || (word === 'import' && !isDynamicImport)) &&
        (source[quoteAt] === '"' || source[quoteAt] === "'");

      // `import type` / `export type` are ignored, matching the historical
      // audit which stripped type-only imports before scanning.
      const isTypeOnly =
        (word === 'import' || word === 'export') && source.slice(k, k + 4) === 'type';
      if (isTypeOnly) typeOnlyPending = true;

      if (hasQuote && !typeOnlyPending) {
        const str = readQuoted(source, quoteAt);
        if (str && /^\.\.?\//.test(str.value)) {
          results.push({ specifier: str.value, index: quoteAt });
          i = str.end + 1;
          prevSignificant = ')';
          typeOnlyPending = false;
          continue;
        }
      }

      prevSignificant = IDENT_PART.test(word[word.length - 1]) ? word[word.length - 1] : c;
      i = j;
      continue;
    }

    if (!/\s/.test(c)) prevSignificant = c;
    i += 1;
  }

  return results;
}
