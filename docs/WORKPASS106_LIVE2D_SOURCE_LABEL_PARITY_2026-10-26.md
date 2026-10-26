# NK1 WorkPass106 — Live2D source-label parity

Date: 2026-10-26  
Branch: `feature/visual-embodiment`

## Defect reproduced

The Live2D validation run [40174852050](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40174852050) passed 14 of 15 embodiment timeline tests. The parity assertion failed for the final real newline in `а🙂‍↔️б\n`: the canonical timeline uses a neutral-space pose after control-whitespace normalization, but the runtime metadata returned a space where the source string's UTF-16 slice was a newline.

## Change

- `runtime/neuro-kurisu/public/avatar-state.mjs`: normalize CR/LF/tab only for frame timing and pose calculation; retain the original bounded source for `grapheme` metadata.
- The normalization is one UTF-16 code unit to one UTF-16 code unit, so the original grapheme labels still align with `charIndex` / `endCharIndex` and Web Speech boundary offsets.
- `runtime/neuro-kurisu/tests/avatar-speech-runtime.mjs`: add a direct regression with a joined emoji and trailing newline, asserting source labels, UTF-16 offsets, and the neutral whitespace pose.
- `runtime/neuro-kurisu/tests/avatar-state-mapping.mjs`: update the older contract assertion, which still expected normalized labels. Timing and pose expectations remain normalized; exposed grapheme labels now consistently match the original source across both tests.

## Commits

- Source: `2d733978699617e3576c18ce48fba8168e5d4ee9`
- Runtime regression: `70e47511b964ea0d49b7ee99fd1aafe86e5d95e1`
- Runtime contract alignment: `8cf467f0fb0ecf6c55afce233ac64f86df3f6b91`

## Validation status

The prior failures were confirmed on the earlier heads: first the React/runtime parity assertion expected the original newline, then the runtime-specific assertion still expected a normalized space. Both test contracts are now aligned with the chosen source-label semantics. The latest-head GitHub Actions run is queued/in progress; this report does not claim a pass until it completes successfully. Acoustic/phoneme-accurate lip-sync and physical Android audio/device behavior remain separate, unverified gates.
