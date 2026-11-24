# PASS20

- Capability Forge: persistent experience/knowledge separation, structured executable skill composition, adversarial test evolution, staged evidence scheduling, and integrated orchestration.
- External 2026 research register added under `docs/research/pass20/`.

# Changelog (condensed)

- 62: phone profiles + invent law
- 63–64: RuleDNA + seed ablation
- 65–67: residual/stack/ROL + invent_fast
- 68–72: bottom-up → vacuum templates 4/4
- 73: template-free ablation 1/4
- 74–75: systematic free 3/4 → 4/4
- **76: pure-grow flag; metrics panel; archive harvest**

## 1.13.1

- Added batched NeuralProgramTrainerV3 with architecture-preserving checkpoint load.
- Added execution-feedback policy training with held-out TinyVM/HVM reward, group-relative updates and verified trajectory archival.
- Hardened neural grounding OOD family-ID and checkpoint-lineage correctness.
- Added open-source research registry for RLEF-Code, synth_gen, ShinkaEvolve, SkillLearnBench and ExecuTorch.
- Execution-feedback policy remains research-only pending positive multi-seed causal gain.


## Pass16 — Skill Governance & Contamination Resistance

- Added evidence-gated skill admission, quarantine, reactivation and usage accounting.
- Unified SkillBank, VersionedSkillRegistry and SkillCompiler behind one canonical lifecycle.
- Prevented probationary memories from entering normal replay.
- Added runtime skill-usage observation and lifecycle provenance.


### Pass16 hardening continuation
- Skill admission now measures restart equivalence in a fresh Python interpreter; caller-supplied restart claims cannot satisfy the gate. Equal-budget evidence is measured from the fixed executable budget.
