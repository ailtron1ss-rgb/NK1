# WorkPass68 code changes — 2026-10-19

## Canonical TTS boundary

- `EmbodimentRuntime.speak()` no longer imports or directly invokes the low-level Termux bridge. It fails closed if a gateway dispatcher has not been configured.
- `OrganismRuntime` wires that dispatcher to `OrganismCore.executeTool('organism.device.speak', ...)`, carrying a stable `speechEventId` and deriving the idempotency key from it.
- The canonical `organism.device.speak` adapter is explicitly idempotency-keyed. The legacy `android.speak` entry remains an ActionGateway-registered adapter rather than an unmediated side-effect caller.

## Honest uncertain outcome semantics

- `AndroidEmbodimentBridge.ts` exposes `speakViaTermuxWithOutcome()` and `TermuxSpeechOutcome` with `completed`, `not-started`, and `unknown` variants.
- `ENOENT` before process start and empty input are proven no-start cases. After dispatch, non-zero exit, signal termination and deadline expiry are unknown because the provider/device may already have emitted audio.
- The old boolean helper is retained as a compatibility wrapper but throws on unknown rather than translating uncertainty to `false`.
- `OrganismCore` returns `not-applied` only when no side effect could have started; it throws `ToolExecutionUncertainError` for post-start uncertainty to preserve pending reconciliation. A completed command returns a command receipt only (`verified:false`); no independent playback check is implied.
- `EmbodiedActionExecutor` represents unresolved TTS as `ambiguous`. `EmbodiedRecoveryController` records that evidence without inflating failure streak/cooldown or applying reliability/failure learning.

## Contract and tests

- Synced `VERSION.json`, `ReleaseContract.ts`, root `SUPER_VERSION.json`, package metadata, `contracts/integration-manifest.json`, and generated runtime manifests to root release `35.0.0-super-workpass68` / runtime `35.88.0`, schema 225.
- Added `tests/termux-tts-outcome-workpass68.mjs` and `tests/workpass68-speech-gateway-boundary.mjs`; added `test:workpass68` / `audit:workpass68` scripts.
- Generated runtime canonical, source and archive manifests after the code edits.

## Explicit limitations

Fake-process regression coverage proves classification and fail-closed routing logic, not physical audio. Live Android/Termux, provider receipts, independent audio verification, dependency-complete app build and browser/Live2D E2E remain unverified.
