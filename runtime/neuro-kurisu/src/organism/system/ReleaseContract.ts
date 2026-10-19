export const RELEASE_CONTRACT = Object.freeze({
  application: '35.90.0',
  organismCore: '100.32.0-r26-hierarchical-lowrank-causal',
  stateSchema: 225,
  phase: 'WorkPass70/Unified-Embodiment-Intent-Audio-Clock-and-Viseme-Timeline',
  node: '>=22.12.0',
  npm: '>=10.8.0',
  canonicalPath: 'src/organism',
  legacyPath: 'legacy-original',
} as const);
export type ReleaseContract = typeof RELEASE_CONTRACT;
