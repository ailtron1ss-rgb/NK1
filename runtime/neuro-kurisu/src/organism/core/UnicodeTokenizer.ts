/** Shared Unicode token boundary with explicit legacy-compatible separators. */
export interface UnicodeTokenizerOptions {
  /** Lumina's historical tokenizer treated identifiers and hyphenated words as one token. */
  includeUnderscore?: boolean;
  includeHyphen?: boolean;
  minimumLength?: number;
}

export function tokenizeUnicodeTerms(value: string, options: UnicodeTokenizerOptions = {}): string[] {
  const minimumLength = Number.isFinite(options.minimumLength)
    ? Math.max(1, Math.min(32, Math.floor(options.minimumLength!)))
    : 2;
  const separators = `${options.includeUnderscore ? '_' : ''}${options.includeHyphen ? '-' : ''}`;
  // Hyphen is intentionally the final optional character, so it is literal in this class.
  const characterClass = `[\\p{L}\\p{N}${separators}]`;
  const pattern = new RegExp(`${characterClass}{${minimumLength},}`, 'gu');
  return String(value ?? '').toLocaleLowerCase().normalize('NFKC').match(pattern) ?? [];
}
