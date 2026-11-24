export const RELEASE_CONTRACT = Object.freeze({
  application: '35.30.0',
  organismCore: '100.21.0-r16-multi-system',
  stateSchema: 219,
  phase: 'Stage-114/R16-Multi-System-Closure',
  node: '>=22.12.0',
  npm: '>=10.8.0',
  canonicalPath: 'src/organism',
  legacyPath: 'legacy-original',
} as const);
export type ReleaseContract = typeof RELEASE_CONTRACT;
