# Roadmap gaps — WorkPass69 (2026-10-19)

## P0 — dependency-complete app build

1. In a network-enabled clean environment run `npm run install:all` against both committed lockfiles without modifying them.
2. Run app and runtime typechecks plus production Vite build; record toolchain, artifact hashes and clean-room results.
3. Exercise real desktop and mobile browser journeys for approval, interruption, reload, reconnect, replay, panel switching and Live2D. `ui-smoke.mjs`/browser-smoke contract is not a substitute for this gate.

## P0 — physical speech and external side effect

1. On a real Android/Termux target, speak a controlled safe phrase, request keyed interrupt, and observe the actual audio output independently.
2. Test process timeout after start, process death, gateway restart, reconnect, delayed response, duplicate replay and changed-payload key conflict.
3. Verify that the same execution/speech IDs survive recovery, audible side effect does not repeat, and playback/silence is not marked verified without an independent signal.

## P0/P1 — causal learning and memory

- Only independent confirmed outcomes may update skill/world/interest state. Exercise delayed receipts and restart with exact IDs.
- Retrieval remains `recallDelta=0`; vector candidate must stay `not-promoted` until repeatable independent RU/EN holdout uplift without false-recall/regression/resource degradation.

## P1 — body, initiative and release hardening

- Validate Live2D/audio-clock/viseme synchronization on target hardware; a process exit is not audio timing evidence.
- Complete Toolmaker promotion/rollback demo, SBOM and nested-source license sign-off, clean-room restore/rollback, target GTX 1650 profile and 24–72 h soak.

No file deletion or release-ready claim is made in this workpass.
