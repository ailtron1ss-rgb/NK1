# NK1 — bounded MotorFrame transport (Aspect 06)

Date: 2026-10-30

## Purpose

The motor controller and IK solvers produce renderer-neutral joint frames. An avatar adapter needs a safe hand-off that does not make the organism runtime import UI, browser, Three.js, Live2D, VRM, or device code. `MotorFrameChannel` supplies that boundary.

## Contract

- One latest-value slot, not an animation queue. Slow renderers skip obsolete frames instead of accumulating latency or memory.
- Accepts only version 1 frames with bounded joint count, finite kinematic values, valid joint identities, phase, completion, and status-list references.
- Requires strictly increasing tick and non-decreasing monotonic timestamp; stale or rewound frames cannot replace the latest state.
- Stores and delivers defensive copies so renderers/listeners cannot mutate controller output or the channel's canonical snapshot.
- Synchronous bounded listener set with explicit subscription disposal and optional one-time latest-frame replay.
- A failing renderer listener is isolated; later listeners still receive the frame and an error counter is exposed.
- No wall clock, timer, browser, renderer, UI, device, persistence, or network dependency.

## Intended integration

The controller remains the producer. A runtime integration point can call `channel.publish(controller.step(monotonicNowMs))`; a renderer adapter subscribes and maps measured joint angles through explicit rig bindings. The channel is transport only: it does not select cognitive actions, generate motor goals, perform IK, or claim that a visual pose was applied.

## Validation scope

The focused Node regression suite checks envelope and numeric validation, stale/re-wound frame rejection, latest-value semantics, defensive-copy isolation, listener failure isolation, explicit replay, bounded subscriptions, and clearing. This suite proves the channel contract only. It does not prove Live2D/2.5D/VRM integration, renderer readback, device timing, or end-to-end visual embodiment.
