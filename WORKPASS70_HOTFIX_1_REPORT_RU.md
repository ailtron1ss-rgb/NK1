# NeuroCore — WorkPass70 hotfix 1 report

**Date:** 2026-10-19  
**Base:** WorkPass70 release asset, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`  
**Status:** implementation hotfix; not production-approved.

## Code changes

### 1. Speech timeline offsets

- Replaced code-point iteration with grapheme segmentation through `Intl.Segmenter`.
- Added a compatibility fallback for combining marks, variation selectors, emoji modifiers, ZWJ sequences and regional-indicator pairs.
- Each frame now records inclusive `charIndex` and exclusive `endCharIndex` in UTF-16 units, matching SpeechSynthesis boundary events.
- Whitespace normalization no longer collapses a run of CR/LF/tab characters into one code unit, which previously shifted every later boundary offset.

### 2. Continuum-memory timescale bug

- Fixed `B401B420AdaptiveCognitiveResearchCore.expertScores()`: `??` precedence caused two intended differences to be evaluated as fallback expressions, producing the wrong continuum score and TypeScript TS2881 errors.
- The corrected score is `0.45 + 0.36 * (fast - medium) + 0.22 * (medium - slow)`, with a 0.5 fallback applied to each individual value.
- Added a focused regression test using fast=0.8, medium=0.5, slow=0.2; expected output is 0.624.

## Verification evidence

- Targeted speech timeline suite: 11/11 passed locally.
- App script regression suite: 229/229 passed in GitHub Actions before the runtime typecheck step.
- Continuum timescale regression: passed locally.
- Existing B401–B420 adaptive research ensemble test: passed locally (240 decisions, 240 updates, 104 prototypes; lesion deltas remained non-zero).
- Speech interruption gateway, Termux TTS concurrency, archived receipt reconciliation and organism smoke: passed locally.
- `npm run audit:quick`: passed locally before the continuum-expression correction; this audit does not include TypeScript typecheck.

## Release gates still open

- The attached hotfix release is published only after the GitHub Actions validation workflow passes app typecheck, runtime typecheck and the regression tail. The workflow-run URL and exact commit should be checked in the repository Actions history.
- Production Vite build and real browser/Live2D E2E are not established by these tests.
- Real Android/Termux speech timing and p95 audio-to-mouth offset remain unverified.
- Memory retrieval uplift remains `recallDelta=0` in the existing benchmark and is not promoted.
- Independent multi-seed holdout, long-duration soak and full license review remain open.

No claim of improved subjective consciousness or general intelligence is made. This hotfix repairs two concrete correctness defects and adds regression coverage.
