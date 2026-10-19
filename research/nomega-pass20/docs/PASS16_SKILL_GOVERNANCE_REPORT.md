# NOMEGA Pass16 — Skill Governance & Contamination Resistance

## Implemented

- Added `SkillGovernanceV1`: reusable-skill admission requires complete execution evidence.
- One-shot/request-level verification is retained as `probation`, not globally reusable `active`.
- Added repeated failure / negative-transfer quarantine.
- Reactivation of quarantined skills requires fresh full evidence.
- Replay excludes probationary and quarantined memories by default.
- Versioned skill registry and compiled-skill store now carry lifecycle status.
- Added `CanonicalSkillLifecycleV1` so SkillBank, VersionedSkillRegistry and SkillCompiler share one admission path.
- Cognitive runtime now records real skill usage when the skill expert actually executes a skill.
- Runtime state restores versioned skills.
- Added canonical registry entries for skill governance/lifecycle.

## Evidence boundary

The admission gate deliberately does not invent OOD, multi-seed, restart, or equal-budget evidence. Missing dimensions remain unknown, so ordinary single-request verification cannot promote a reusable skill.

## Verification

Pass16 targeted governance/regression tests: 40 passed in the final verification run.

The admission path was hardened so restart equivalence is measured in a fresh Python process rather than accepted from a caller-provided value. Equal-budget evidence is measured from the fixed TinyVM/HVM execution budget; caller claims are retained only as ignored legacy metadata.

Final checks: `compileall core/nomega` passed; pytest collection succeeded with 457 tests and 0 collection errors. The full repository suite remains a separate release gate because historical/legacy slow paths have not been declared green.

The remaining standalone skill induction/transfer implementations are retained as legacy research paths because they are still imported by historical modules/tests; they are not promoted to the canonical runtime path. Canonical reusable-skill admission flows through `CanonicalSkillLifecycleV1`.

Research alignment: recent 2026 work on self-evolving coding agents emphasizes executable feedback, repository context, generalization, safety and maintainability; SKILLFOUNDRY emphasizes executable skill packages with provenance/tests and closed-loop repair/prune; recent contamination work argues for pre-commit multi-critic gates because post-hoc removal may not undo inherited contamination. These findings support NOMEGA's probation/quarantine lifecycle and motivate the next marginal-gain/transfer gate.
