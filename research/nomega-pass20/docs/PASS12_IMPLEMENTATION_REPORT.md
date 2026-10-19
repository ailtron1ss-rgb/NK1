# NOMEGA Pass 12 — Canonical Stabilization / Neural Substrate Repair

## Scope

This pass implements the first part of the agreed Pass 12 plan: fix confirmed defects, restore canonical contracts, remove optimistic evidence defaults, and strengthen the trainable neural substrate without adding another historical version family.

## Real code changes

1. **Canonical Program IR contract**
   - Added the real `ProgramIRV1` compatibility type to `program_ir_v1.py`.
   - It subclasses the existing `ProgramSketchV1` representation rather than creating a second IR implementation.
   - All 31 canonical registry targets now import and resolve successfully.

2. **Canonical skill-retrieval contract**
   - Kept `neural_skill_retrieval` as the canonical facade.
   - Updated the stale facade test that incorrectly required the versioned backend directly.

3. **Evidence integrity**
   - `AutonomousDevelopmentRunnerV1._next_metrics()` no longer converts missing measurements into `1.0` success evidence.
   - Missing values are represented as `None`/unknown and must be handled by downstream gates.
   - Added regression coverage for this behavior.

4. **No-reset lifecycle semantics**
   - When a cycle produces no new promotion, the runner now carries forward the measured active artifact rather than emitting an empty artifact field.
   - This is retention of existing state, not a synthetic promotion or success.

5. **E/I recurrent plasticity defect**
   - The previous local-plasticity implementation multiplied the recurrent matrix by the excitatory mask, zeroing all inhibitory-source columns before the inhibitory constraint was applied.
   - Recurrent weights are now stored as non-negative magnitudes and E/I sign is supplied by source masks.
   - Added a regression test proving inhibitory recurrent weights survive local plasticity.

6. **Trainable spike path**
   - Added a hard-forward/surrogate-backward spike operator.
   - The functional recurrent path now has a real gradient through spike generation instead of a hard threshold with zero derivative.
   - Added a regression test proving non-zero finite gradients reach trainable parameters.

7. **Dead slow-weight parameter removed from the substrate state**
   - The previously unused `slow_weight` parameter was eliminated as a separate parameter.
   - `recurrent` is now the canonical slow recurrent magnitude matrix; `fast_weight` remains the transient component.
   - Consolidation operates on this actual slow matrix.

8. **Mutation safety**
   - Removed `.data` writes from structural plasticity mutations; these methods already execute under `torch.no_grad()`.

9. **Canonical registry refresh**
   - Regenerated `runtime/canonical_module_registry_v1.json` from the current source tree.

## Verification performed

- Python compilation: passed.
- Targeted canonical + neural + runner suite: **15 passed** before adding the final registry-contract test.
- Canonical target import audit: **31/31 resolved**.
- Registry scan after changes: **302 modules, 38 canonical, 24 research, 159 legacy/versioned, 118 consolidation candidates, 0 import cycles**.
- Direct E/I regression experiment: inhibitory recurrent weights remain non-zero after local plasticity.
- Direct surrogate-gradient experiment: finite non-zero gradients are observed.
- Full suite collection: **417 tests**.
- Full suite was intentionally not claimed green: the run exceeded the available execution window after progressing through the suite; this remains an open verification task rather than a fabricated success.

## Research alignment used for this pass

- AlphaEvolve: evaluator-grounded evolutionary code improvement.
- ShinkaEvolve: open-ended program evolution with archives, islands, and executable verification.
- CodeEvolve (2026 revision): island-based evolution, crossover, refinement, structured diffs, sandboxed evaluation.
- Recent self-evolving coding-agent literature: evolution of framework, memory, skills, tools, workflow, and topology rather than only task outputs.
- Recent astrocyte-gated continual-learning work: slow activity-dependent gating of plasticity as a computational direction for stability/plasticity management.

These references inform architecture choices; they are not treated as proof that NOMEGA has achieved the corresponding capabilities.

## Next pass

**Pass 13 — Neural Substrate V2**

- benchmark the substrate against matched ANN/SNN baselines;
- separate dendritic, E/I, surrogate-gradient, local-plasticity and astrocytic contributions with ablations;
- establish multi-seed and OOD evidence;
- integrate continual-learning evaluation;
- only then promote neural substrate mechanisms into the main self-development loop.
