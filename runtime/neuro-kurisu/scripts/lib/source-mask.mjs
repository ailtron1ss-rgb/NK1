// Byte-stable masking of non-code regions. A module specifier such as `from './x.ts'`
// or `import('./x.ts')` is only real when it appears in code; the same text inside a
// comment, string literal or regex literal is just data (tests assert on such strings).
// Masking those regions keeps every original offset valid, so callers can run their
// specifier regex against the untouched source and reject matches that land on a masked
// byte, without paying for a full TypeScript parser.
const PUNCT_BEFORE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>']);
const KEYWORD_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'yield', 'await', 'instanceof', 'new', 'delete', 'void', 'throw']);
const isWordChar = ch => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '_' || ch === '$';
const isSpace = ch => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';

export function maskNonCode(source) {
  const n = source.length;
  const out = source.split('');
  const blank = (from, to) => {
    for (let k = from < 0 ? 0 : from; k < to && k < n; k++) {
      const ch = out[k];
      if (ch !== '\n' && ch !== '\r') out[k] = ' ';
    }
  };
  let i = 0;
  let lastWord = '';
  let lastPunct = '';
  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];
    if (c === '/' && c2 === '/') { let j = source.indexOf('\n', i); if (j === -1) j = n; blank(i, j); i = j; continue; }
    if (c === '/' && c2 === '*') { const close = source.indexOf('*/', i + 2); const j = close === -1 ? n : close + 2; blank(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === c) { j++; break; }
        if (c !== '`' && d === '\n') break;
        j++;
      }
      blank(i, j); i = j; lastWord = ''; lastPunct = c; continue;
    }
    if (c === '/') {
      const regexAllowed = lastPunct ? PUNCT_BEFORE_REGEX.has(lastPunct) : (lastWord === '' || KEYWORD_BEFORE_REGEX.has(lastWord));
      if (regexAllowed) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < n) {
          const d = source[j];
          if (d === '\\') { j += 2; continue; }
          if (d === '\n') break;
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) { j++; closed = true; break; }
          j++;
        }
        if (closed) { blank(i, j); i = j; lastWord = ''; lastPunct = '/'; continue; }
      }
      lastPunct = '/'; lastWord = ''; i++; continue;
    }
    if (isWordChar(c)) { let j = i; while (j < n && isWordChar(source[j])) j++; lastWord = source.slice(i, j); lastPunct = ''; i = j; continue; }
    if (isSpace(c)) { i++; continue; }
    lastPunct = c; lastWord = ''; i++;
  }
  return out.join('');
}
