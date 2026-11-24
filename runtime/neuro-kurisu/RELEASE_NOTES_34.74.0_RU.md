# Neuro-Kurisu 34.74.0 — BIG PASS 100

## Self-Repair + Skill Lineage

PASS 100 extends the compound skill compiler from fallback adaptation into an evidence-gated repair loop.

### Added
- deterministic failure fingerprints and bounded failure diagnosis;
- persistent repair ledger per compound skill;
- learned repair candidate ordering from previously verified repairs;
- holdout-context marker for verified fallback success;
- lineageVersion for every skill mutation/promotion;
- repair ledger persistence and migration from v5;
- promotion gate now requires repeated verified fallback evidence plus independent/holdout context evidence;
- repair diagnostics are kept bounded to protect phone memory and hot-path cost.

### Design principle
A failure is not treated as proof that a replacement is better. A repair is only promoted after verified success and evidence from a distinct/holdout context. Internal repetition alone cannot establish truth.

## Safety
Destructive tools remain blocked by ActionGateway policy and live destructive actions still require a verifier. Repair logic can only select already-registered skill tools; it does not synthesize arbitrary executable code.
