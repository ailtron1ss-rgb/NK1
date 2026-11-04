import type { CodeAssimilationArchiveExtractionResult } from './CodeAssimilationArchiveExtraction.ts';

export interface CodeAssimilationMaterializedFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}
export interface CodeAssimilationMaterializedWorkspace {
  readonly rootDirectory: string;
  readonly candidateFingerprint: string;
  readonly sourceFingerprint: string;
  readonly extractionFingerprint: string;
  readonly files: readonly CodeAssimilationMaterializedFile[];
  verifyIntegrity(): { readonly verified: true; readonly filesChecked: number };
  cleanup(): void;
}

export function materializeCodeAssimilationArchive(
  _extraction: CodeAssimilationArchiveExtractionResult,
): CodeAssimilationMaterializedWorkspace {
  throw new Error('code-assimilation-workspace-not-implemented');
}
