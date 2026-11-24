# WorkPass68 handover — 2026-10-19

- Base archive: `Neuro_Kurisu_WORKPASS67_2026-10-19.zip`
- Root release: `35.0.0-super-workpass68`
- Canonical runtime: `35.88.0`; persisted schema: `225`
- Release state: `implementation-workpass; release gates remain open`

## Implemented

1. Routed physical Termux TTS invoked through `EmbodimentRuntime` into `OrganismCore.executeTool('organism.device.speak', ...)`, and therefore through the canonical `ActionGateway` receipt, policy and idempotency path. The dispatcher requires a stable speech-event identity and derives an idempotency key.
2. Added typed TTS outcome semantics: `completed`, `not-started`, and `unknown`. Empty input or a confirmed spawn `ENOENT` is `not-started`. A zero exit without a signal is only a command-completion receipt. Timeout, signal termination or non-zero exit after process start is `unknown`, because audio may already have begun.
3. Unknown post-start outcomes are routed into ActionGateway uncertain-execution/reconciliation behavior instead of a false no-effect failure; no blind automatic retry is issued.
4. Added `ambiguous` as an embodiment execution state. Ambiguous outcomes are logged as unresolved evidence but do not increment failure streak, cooldown or reliability penalty and do not earn success/skill credit.
5. Updated `contracts/integration-manifest.json` so root release ownership/version and canonical runtime version match the code/package and generated release manifests.
6. Added regression tests for child-process completion, partial exit, timeout, missing command, gateway-only speech dispatch, durable idempotency requirement and ambiguous recovery scoring.

## Verification actually run

- `npm run typecheck` in `runtime/neuro-kurisu`: PASS (`TYPECHECK=PASS mode=tsc compiler=PATH`).
- `test:workpass68:tts-outcome`: PASS (`completed`, post-start partial exit `unknown`, timeout `unknown`, missing command `not-started`).
- `npm run test:workpass68`: PASS after refactoring its command graph to avoid recursively repeating the WorkPass67→66→65 test chains. It runs one runtime typecheck, both new tests, release alignment and the relevant archive/revision recovery regressions.
- `npm run audit:workpass68`: PASS, exit 0. Root release metadata 34/34, contract tests 6/6, dependency contract 1/1, installer 5/5, app scripts 218/218, browser-smoke contract 51/51, memory benchmark, server imports, UI/API linkage (131 routes, 50 surfaces), assets, runtime contract, integrity and source verification all passed.
- Retrieval benchmark: `recallDelta=0`, CI lower/median/upper all 0, candidate `not-promoted`.
- A short real install retry with `NK_NPM_INSTALL_TIMEOUT_MS=10000` returned `SUPER_INSTALL=TIMEOUT` for `app` and exit 1 as designed; the network-enabled dependency install/build remains open.

## Evidence boundary / still open

- Termux process behavior was tested with a controlled fake executable. No real Android target, audio playback loopback, provider-side receipt or independent playback postcondition was available. Process exit is deliberately not described as verified audible output.
- App `node_modules` are absent and registry requests fail with `EAI_AGAIN`; dependency-complete Vite production build and real desktop/mobile browser + Live2D E2E remain open.
- Memory retrieval remains `recallDelta=0`; candidate remains `not-promoted` pending an independent labelled holdout.
- External provider/device ACK-gap, process death/reconnect/replay/postcondition, causal learning on real observations, clean-room rollback, license/SBOM sign-off and 24–72h soak remain open.
- Official weighted roadmap remains 80.1%; this pass changes the code-level speech action boundary, not release readiness.

## Next

1. In a network-enabled clean workspace, install both committed lockfiles without rewriting them; run app/runtime typecheck and production Vite build.
2. On an actual Android/Termux target, record native command result and independent audio/playback postcondition through the canonical reconciliation path.
3. Verify timeout-after-start, process death, app reconnect, duplicate replay and late receipt without repeated speech or false learning credit.
4. Run real browser/Live2D journeys and then repeat the release fault matrix and soak.
