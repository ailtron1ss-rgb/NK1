import type { CodeAssimilationCandidate } from './CodeAssimilationContracts.ts';
import type {
  CodeAssimilationArchivePreflightLimits,
  CodeAssimilationArchivePreflightReport,
} from './CodeAssimilationArchivePreflight.ts';

export interface CodeAssimilationArchiveExtractionInput {
  candidate: CodeAssimilationCandidate;
  archiveBytes: Uint8Array;
  parserId: string;
  parserVersion: string;
  limits?: Partial<CodeAssimilationArchivePreflightLimits>;
}

export interface CodeAssimilationExtractedFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface CodeAssimilationArchiveExtractionResult {
  readonly schemaVersion: 1;
  readonly accepted: true;
  readonly preflight: CodeAssimilationArchivePreflightReport;
  readonly filePaths: readonly string[];
  readonly files: readonly CodeAssimilationExtractedFile[];
  readonly extractionFingerprint: string;
  readFile(path: string): Uint8Array | null;
}

export function extractCodeAssimilationArchive(
  _input: CodeAssimilationArchiveExtractionInput,
): CodeAssimilationArchiveExtractionResult {
  throw new Error('code-assimilation-extraction-not-implemented');
}
