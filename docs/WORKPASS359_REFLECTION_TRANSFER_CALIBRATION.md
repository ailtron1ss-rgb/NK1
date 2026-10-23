# WorkPass359 — Reflection calibration and transfer-evidence discipline

Date: 2026-10-23
Branch: `feature/learning`
Status: implementation committed; exact-head execution unverified.

## Research patterns inspected

- **Hermes Agent Self-Evolution** — [repository](https://github.com/NousResearch/hermes-agent-self-evolution): trace-guided diagnosis, targeted candidate mutation, evaluation against a task set, constraint gates, bounded artifacts and human-reviewed promotion. NK1 already has a native TypeScript candidate/evaluator/staging lifecycle; this pass preserves that lifecycle rather than introducing a second Python/Gepa pipeline.
- **Reflexion** — [paper](https://arxiv.org/abs/2303.11366): task feedback becomes an episodic reflection used to inform subsequent attempts. NK1's reflection remains a hypothesis derived from observations, not a trusted label or activation authority.
- **Voyager** — [paper](https://arxiv.org/abs/2305.16291): automatic curriculum, persistent skill library, iterative improvement and self-verification. NK1's curriculum is connected to the organism's P23 reflection/evidence-debt output; one-context recurrence must not masquerade as cross-context skill transfer.
- **CleanRL** — [documentation](https://docs.cleanrl.dev/): transparent benchmark protocols and seeded reproducibility. NK1 should continue to require matched task manifests/seeds and independent holdout outcomes before crediting performance or transfer improvements.

## Implemented changes

1. Outcome reflection reports the explicit `0.5` task-pass threshold, observed pass rate, descriptive Wilson lower/upper bounds and interval width from the recent window.
2. Reflection confidence now penalizes a wide success interval and accounts for window size as well as prediction error. Because events may be correlated, the interval is a conservative descriptive signal only; it is not presented as calibrated confidence or independent proof.
3. Curriculum repair priority combines prediction mismatch, continuous outcome quality, surprise and the conservative lower pass-rate bound.
4. `P23LearningEngine.recommendLearningTargets()` no longer sets `transfer01 = occurrences / 12`. Repetition in one context is evidence of recurrence/repair value, not transfer. Transfer is held at zero until an evaluator supplies cross-context/held-out evidence.
5. Added regressions for threshold stability, all-failure uncertainty, duplicate/conflicting event identities, malformed rows, unsafe property access, target-ID conflicts and the transfer/recurrence distinction. The suite is already wired to `test:p23:learning`.

## Deliberate limits

- The Wilson interval assumes Bernoulli-like independent observations for strict inferential interpretation; NK1's experience stream may be temporally correlated, so no statistical guarantee is claimed.
- This pass does not prove increased task success, skill transfer, intelligence or consciousness.
- No dependency was added: the existing TypeScript implementation and Node.js test harness are retained.
- GitHub Actions on recent repository heads have failed before exposing runnable steps. Treat this pass as code committed and regression wiring present, but **not test-verified** until a runner executes the exact branch head.
- `main` and the release ZIP are untouched.

## Next implementation gates

1. Carry independent task-family and seed provenance into the reflection input without leaking holdout outcomes to the generator.
2. Estimate transfer only from matched cross-context trials compared with the no-transfer baseline; report uncertainty, per-family results and regressions.
3. Validate the reflection → repair-plan → generated candidate → independent evaluation → authenticated staging sequence end to end.
4. Run the exact-head P23 suite and runtime typecheck after the Actions runner scheduling issue is resolved.
