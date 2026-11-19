# NK1 WorkPass — autonomous runtime cadence correction (2026-11-01)

## Defect

The previous gate used `if (!due && !silence)`, which throttled externally-triggered work while allowing silent/internal work to run on every heartbeat. The controller also overwrote `lastAt` before using it to decide whether an autonomous action continued after prior activity.

## Correction

- Internal/silent activity is skipped until `nextWakeAt` is due.
- A genuine external signal bypasses the ambient cadence and remains reactive, subject to the existing recovery/safety window.
- A skipped heartbeat does not increment self-started activity.
- `continuedAfterSilence` compares the current autonomous action against the prior activity timestamp.
- `lastAt` is updated when an activity is actually selected, not before the cadence decision.

## Regression coverage

The WorkPass224 test now verifies:
1. initial autonomous activity when the schedule is due;
2. suppression of a silent heartbeat before the next wake;
3. immediate external-triggered activity before the ambient wake;
4. suppression of another early silent heartbeat;
5. autonomous resumption at the due time and correct silence-continuation accounting.

The unified organism runtime workflow now executes `test:big-pass-224` for changes to the runtime system/tests.

## Boundaries

This fix corrects cadence and counters. It does not prove autonomous thought quality, persistent self-generated goals, an hourly initiative rate, real-device background execution, or subjective consciousness.

## Snapshot restoration hardening (2026-11-01)

The autonomous-life controller now treats persisted state as untrusted input. It reads own data descriptors instead of invoking getters, validates finite timestamps and safe integer counters, clamps normalized metrics, allowlists lifecycle modes and activities, and filters malformed recent-history rows. Hostile proxy/descriptor failures reset the import atomically to defaults. Valid recent entries preserve their newest-first ordering and are detached from the caller's objects.

The existing unified organism runtime workflow already executes `test:big-pass-224`; the expanded regression now exercises the restore boundary as part of that same CI path.

This is a persistence-integrity improvement, not evidence of hour-long autonomous initiative, browser/mobile background execution or subjective consciousness.


