# Roadmap gaps after WorkPass70

## P0 — Real browser / Live2D playback timing

Install `app` workspace dependencies from the committed lockfile in a network-enabled clean environment; run production Vite build and app typecheck; run desktop and mobile browser journeys with the actual bundled Live2D model. Capture actual output audio timing and model mouth parameters; measure p50/p95 offset and validate cancellation, replacement utterance, hidden/reloaded iframe and background-tab throttling. The current nine targeted tests include production inline viewer-handler execution in an isolated Node VM; they remain contract/unit tests, not browser-renderer or audio E2E.

## P0 — Physical TTS cancellation and outcome truth

Run Android/Termux TTS through the existing ActionGateway. Confirm a real audio output begins, interrupt the exact `speechEventId`, capture independent evidence that audio ceased, and test late acknowledgement / duplicate interrupt / next utterance. Process termination alone is not proof of audible silence.

## P0 — External actions

Verify a real provider/device operation through acceptance/ACK gap, SIGKILL, reconnect, duplicate replay, read-after-write and exact outcome finalization. Local filesystem fixtures do not close the provider gate.

## P0/P1 — Memory and learning

A frozen independent Russian/English retrieval holdout must show measurable benefit without unacceptable false recall, contradiction, privacy or resource regressions; current recallDelta remains zero. Learning credit must be attached once to independently verified outcomes across delayed receipt and restart.

## P1 — Personality/body continuity

Map the intent envelope to approved Live2D parameters for expression, gaze, head tilt, body motion and stable character traits. Separate state dynamics from animation policy, then validate that gestures respect speech/action lifecycle and do not indicate unverified action success.

## P1 — Release durability

Complete clean-room install/build, rollback tests, SBOM and file/model/dataset licensing review, state/memory/receipt restore, and a minimum 24-hour soak (72 hours recommended).
