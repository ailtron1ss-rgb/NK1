/**
 * Shared local-import scanner for architecture and server dependency audits.
 * It masks line/block comments before matching imports, preserving line breaks
 * so a code example in a comment cannot become a false dependency edge.
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

export function collectRelativeImportSpecifiers(source) {
  const code = stripComments(source);
  // Covers static imports, re-exports, side-effect imports, literal dynamic
  // imports and literal CommonJS requires. Bare packages are not graph edges.
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)(["'])(\.\.?\/[^"']+)\1/g;
  const specifiers = new Set();
  for (const match of code.matchAll(pattern)) specifiers.add(match[2]);
  return [...specifiers];
}
