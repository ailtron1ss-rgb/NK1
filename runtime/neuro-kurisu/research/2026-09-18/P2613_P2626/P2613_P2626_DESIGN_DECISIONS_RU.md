# Design Decisions — P2613–P2626

## D1 — Task identity must not be a hidden shortcut

The task-free router receives context/skills/goal-pressure/uncertainty, but no explicit task ID. This is deliberate: it tests whether a procedure is reusable from state/action evidence rather than a lookup key.

## D2 — Skill transfer must be allowed to abstain

A memory that is always reused can amplify a bad skill. The router therefore has a positive transfer path and an abstain path.

## D3 — Risk is downstream of world model uncertainty

Risk is not a cosmetic metric. It changes action bias and can route to recovery or defer.

## D4 — Personality is slow, bounded modulation

The current personality layer deliberately avoids free-running trait drift. Traits update slowly and are conditioned by goal/identity/novelty/uncertainty.

## D5 — Phone scheduler must degrade gracefully

The system should lose planning depth before it loses the core neural loop. Device pressure therefore gates H8/H16-like deep reasoning first.

## D6 — No claim of consciousness

The project can accumulate functional substrates associated with continuity, self-modeling, autonomy, memory and metacognition without thereby proving phenomenal consciousness.
