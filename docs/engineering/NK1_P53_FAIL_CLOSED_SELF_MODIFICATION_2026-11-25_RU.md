# NeuroCore — P53 fail-closed self-modification

**Date:** 2026-11-25  
**Repository:** `ailtron1ss-rgb/NK1`  
**Canonical base:** `workpass70-source @ 9008a8982a5173304456bee2c604bd0bc8665964`  
**Aspect:** `aspect/p53-independent-promotion-quarantine-20261125`  
**PR:** #1180

## Confirmed risk

P53 is an existing, runtime-invoked behavioral policy adaptation lab. Its previous test path derived a field named `holdout01` from its own shadow score, grounding, and a caller-provided `holdoutFactor01`. Its own proxy scores could set candidate status to `promotable`; the periodic cycle could then promote after two such tests. The public Core method checked identity continuity, but no independent host-owned outcome verifier was required.

This was not just a missing benchmark. It was a trust-boundary flaw: the subsystem being evaluated could also manufacture the evidence that authorized its own policy change.

## Safety change

- P53 v3 is preview-only. Shadow evaluation remains useful as a diagnostic signal, but it cannot set a holdout score, transfer score, or confirmed improvement.
- The legacy `holdoutFactor01` input is ignored for promotion-quality evidence.
- Direct promotion is fail-closed; it returns a candidate snapshot without changing the active policy profile or incrementing promotion counters.
- The periodic research loop no longer self-promotes candidates.
- Persisted P53 v2 promotions and `promotable/promoted` candidates are quarantined during both module restore and canonical StateMigrations.
- The migration resets the active knob profile to neutral and clears historical promotion/improvement credit that was not independently verified. A bounded counter retains the legacy promotion count.
- Terminal rejection remains terminal.

## Re-enable gate

P53 must remain preview-only until an external host-owned path can bind a candidate to independently resolved task identity, run identity, held-out evidence, transfer evidence and rollback authority. A caller boolean or candidate-controlled scalar is not proof. Promotion must require an explicit capability from that independent authority.

## Evidence boundary

The tests prove that self-generated proxies cannot promote behavioral knobs and that legacy unverified promotion state is neutralized. They do not demonstrate that any proposed knob change improves behavior. Independent transfer and real-world performance remain unproven.
