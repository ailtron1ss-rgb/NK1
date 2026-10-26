# NK1 WorkPass109 — fail-closed TTS operation-ID validation

Date: 2026-10-26  
Branch: `feature/visual-embodiment`

## Change

- Explicit TTS operation IDs now reject leading/trailing whitespace and Unicode C0/C1 control characters before the speech gateway can be called.
- Invalid IDs report `tts-invalid-context`; they do not fall through to fresh-ID generation and cannot dispatch physical TTS.
- Omitted/empty IDs still receive a fresh `speech-${randomUUID()}` per independent invocation. Valid explicit IDs remain stable for retries of the same logical operation.
- Added a regression that passes a newline-containing ID and asserts rejection, the error code, and zero dispatcher calls.

## Commits

- Runtime validation: `f637d4a0fd0a8a0a7e6f409edbea5e593571f363`
- Regression: `4646d67f52b42cc61ec96f6c652cc85dfcf68b6c`

## Validation

[GitHub Actions run 40306694824](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40306694824) **passed** on exact tested head `4646d67f52b42cc61ec96f6c652cc85dfcf68b6c`.

- `AVATAR_SPEECH_IDENTITY=PASS`
- `AVATAR_SPEECH_ID_VALIDATION=PASS`
- `AVATAR_SPEECH_UTF16=PASS`
- Live2D resource integrity: 24/24 manifest resources pass; browser profiles and avatar wiring pass.
- App embodiment timeline suite: 16 passed, 0 failed.
- App TypeScript check passed.

