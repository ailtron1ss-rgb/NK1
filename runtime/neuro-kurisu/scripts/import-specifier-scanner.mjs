/**
 * Shared local-import scanner for architecture and server dependency audits.
 * It masks comments, ordinary strings and regex literals before identifying
 * module specifier strings, avoiding false graph edges from code examples.
 */
export function stripComments(source) {
  let output = "";
  let state = "code";
  let quote = "";
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === "line-comment") {
      if (char === "\n" || char === "\r") {
        output += char;
        state = "code";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        i += 1;
        state = "code";
      } else {
        output += char === "\n" || char === "\r" ? char : " ";
      }
      continue;
    }

    if (state === "quoted") {
      output += char;
      if (char === "\\") {
        if (next !== undefined) {
          output += next;
          i += 1;
        }
      } else if (char === quote) {
        state = "code";
        quote = "";
      }
      continue;
    }

    if (char === "'" || char === '"' || char === String.fromCharCode(96)) {
      output += char;
      state = "quoted";
      quote = char;
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      i += 1;
      state = "line-comment";
      continue;
    }

    if (char === "/" && next === "*") {
      output += "  ";
      i += 1;
      state = "block-comment";
      continue;
    }

    output += char;
  }
  return output;
}

function blankRange(source, start, end) {
  return source.slice(start, end).replace(/[^\r\n]/g, " ");
}

function isRegexStart(source, index) {
  const prefix = source.slice(Math.max(0, index - 160), index).replace(/\s+$/, "");
  if (!prefix) return true;
  if (prefix.endsWith("=>")) return true;
  if ("=(:,[!&|?{};".includes(prefix.at(-1))) return true;
  return /(?:^|[^\w$])(return|throw|case|delete|void|typeof|instanceof|in|of|yield|await|else|do)\s*$/.test(prefix);
}

function regexLiteralEnd(source, start) {
  let inCharacterClass = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === "\n" || char === "\r") return start + 1;
    if (char === "[") inCharacterClass = true;
    else if (char === "]") inCharacterClass = false;
    else if (char === "/" && !inCharacterClass) {
      let end = i + 1;
      while (/[a-z]/i.test(source[end] ?? "")) end += 1;
      return end;
    }
  }
  return start + 1;
}

function maskNonSpecifierLiterals(source) {
  let output = "";
  for (let i = 0; i < source.length;) {
    const char = source[i];

    if (char === "/" && isRegexStart(source, i) && source[i + 1] !== "/" && source[i + 1] !== "*") {
      const end = regexLiteralEnd(source, i);
      if (end > i + 1) {
        output += blankRange(source, i, end);
        i = end;
        continue;
      }
    }

    if (char === "'" || char === '"' || char === String.fromCharCode(96)) {
      const quote = char;
      const prefix = source.slice(Math.max(0, i - 160), i).replace(/\s+$/, "");
      const isSpecifier = quote !== String.fromCharCode(96) &&
        /(?:\bfrom\b|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)$/.test(prefix);
      let end = i + 1;
      for (; end < source.length; end += 1) {
        if (source[end] === "\\") {
          end += 1;
          continue;
        }
        if (source[end] === quote) {
          end += 1;
          break;
        }
      }
      output += isSpecifier ? source.slice(i, end) : blankRange(source, i, end);
      i = end;
      continue;
    }

    output += char;
    i += 1;
  }
  return output;
}

function maskedImportCode(source) {
  return maskNonSpecifierLiterals(stripComments(source));
}

// TypeScript import-type queries have the shape import("./module").Type or
// import("./module")["Type"]. They create compile-time graph edges but do not
// load the referenced module at runtime. Exclude them from runtime traversal
// while preserving them as separately labelled architecture graph edges.
const typeImportPattern = /\bimport\s*\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)\s*(?:\.\s*[A-Za-z_$][\w$]*\b(?!\s*\()|\[\s*["'][^"']+["']\s*\])/g;

export function collectRelativeTypeImportSpecifiers(source) {
  const code = maskedImportCode(source);
  const specifiers = new Set();
  for (const match of code.matchAll(typeImportPattern)) specifiers.add(match[2]);
  return [...specifiers];
}

export function collectRelativeImportSpecifiers(source) {
  const code = maskedImportCode(source);
  // Covers static imports, re-exports, side-effect imports, literal dynamic
  // imports and literal CommonJS requires. Bare packages are not graph edges.
  const typeImportStarts = new Set([...code.matchAll(typeImportPattern)].map(match => match.index));
  const pattern = /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)(["'])(\.\.?\/[^"']+)\1/g;
  const specifiers = new Set();
  for (const match of code.matchAll(pattern)) {
    if (typeImportStarts.has(match.index)) continue;
    specifiers.add(match[2]);
  }
  return [...specifiers];
}
