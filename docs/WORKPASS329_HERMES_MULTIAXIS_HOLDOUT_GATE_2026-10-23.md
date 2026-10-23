# WorkPass329 — multi-axis holdout gate for reflective skill learning

**Date:** 23 October 2026  
**Branch:** `workpass328-upstream-donor-gate` (source stack based on `workpass70-source`)  
**Scope:** native adaptation of a focused upstream mechanism into the canonical P23/SkillLearnBench path.  
**Evidence status:** code and regression have been committed; the exact-head test, runtime typecheck and hosted CI execution are not yet verified.

## Why this change

The existing SkillLearnBench gate compared a paired task-macro composite:

`0.5 × task success + 0.3 × trajectory quality + 0.2 × skill quality`

and separately enforced a hard safety gate. A weighted score can nevertheless rise when one important component degrades substantially, because another component's gain compensates for it. For autonomous skill revision, this lets aggregate fitness obscure a real failure mode.

## Upstream mechanism reviewed

Repository: [NousResearch/Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution)  
Pinned revision used for inspection: [`0a929e3aa20e15cf04dc7c28492a7d41a5139125`](https://github.com/NousResearch/hermes-agent-self-evolution/commit/0a929e3aa20e15cf04dc7c28492a7d41a5139125)

Reviewed directly from the upstream Git tree:

- [`evolution/skills/evolve_skill.py`](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/evolution/skills/evolve_skill.py) — separates train/validation optimization from final holdout evaluation and validates candidate constraints before deployment/review.
- [`evolution/core/fitness.py`](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/evolution/core/fitness.py) — exposes multiple quality dimensions and a weighted composite.
- [`evolution/core/constraints.py`](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/evolution/core/constraints.py) — applies explicit candidate constraints rather than relying only on a fitness score.
- [`pyproject.toml`](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/pyproject.toml) and [README](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/README.md) — declare an MIT license.

This is a targeted mechanism review, not a claim that the whole upstream repository or its tests have been audited or reproduced.

## What changed in NK1

The implementation remains in the canonical `runtime/neuro-kurisu/src/organism/learning/SkillLearnBenchAdapter.ts`; no second learner, store, evaluator or promotion authority was introduced.

- Kept the existing paired trial identity checks, macro task averaging, validation-improvement threshold, aggregate holdout-regression check and hard safety rejection.
- Added separate holdout-regression ceilings for **task success**, **trajectory quality** and **skill quality**. Each defaults to a maximum tolerated decline of `0.02` (two percentage points on the normalized 0–1 scale) and can be configured explicitly.
- Computes each comparison from the matched baseline and candidate reports with a task-macro mean, so tasks with more repeated trials do not gain extra weight.
- Emits a specific rejection reason and actionable feedback for each component that exceeds its regression budget. The aggregate composite cannot override those component constraints.
- The helper now retains matched baseline reports internally to support the component comparisons; the external report shape and existing approval/activation lifecycle stay unchanged.
- Added a regression scenario in which weighted holdout composite improves while trajectory quality drops. The test neutralizes the aggregate-only threshold and asserts that the component gate still rejects the candidate. Separate cases cover task-success and skill-quality rejection paths, plus invalid-threshold validation for all three controls.
- Wired the focused regression into the root `audit:quick` command and the WorkPass71 core validation workflow.

### NK1 commits

- Adapter/gate: [`b9dfe3ea4859031cb64840d536c04cf98d265895`](https://github.com/ailtron1ss-rgb/NK1/commit/b9dfe3ea4859031cb64840d536c04cf98d265895)
- Initial regression: [`8cdf72ba5fd23954e462dbccd68136a2f18c8fdd`](https://github.com/ailtron1ss-rgb/NK1/commit/8cdf72ba5fd23954e462dbccd68136a2f18c8fdd)
- Expanded task-success/trajectory/skill-quality rejection coverage: [`22e33cfa4f699a0c242e904d52b4cf92ad1a5712`](https://github.com/ailtron1ss-rgb/NK1/commit/22e33cfa4f699a0c242e904d52b4cf92ad1a5712)
- Root audit wiring: [`43b2129684b7a7350cfc18451caaede8c27f8c74`](https://github.com/ailtron1ss-rgb/NK1/commit/43b2129684b7a7350cfc18451caaede8c27f8c74)
- Core CI wiring: [`85cfc7e761c15a20879267c022c8011481e05daa`](https://github.com/ailtron1ss-rgb/NK1/commit/85cfc7e761c15a20879267c022c8011481e05daa)

## Dependencies, licensing and provenance

- No dependency was installed or added. The useful idea was small enough to adapt natively; adding DSPy, OpenAI Python client and the donor's Python stack would duplicate the TypeScript runtime path and increase deployment cost without being necessary for this gate.
- No upstream source file was copied or vendored.
- License review remains **partial**: upstream `pyproject.toml` and README declare MIT, but a standalone `LICENSE` file was not retrievable at the pinned path through the repository contents API. Because this pass contains only a native adaptation, no copied source is introduced; nevertheless, the donor is not marked fully license-audited for broader reuse.
- No benchmark uplift is claimed. This change prevents one class of regression; it has not yet demonstrated that NK1 solves more tasks.

## Exact-head verification and release boundary

The source-stack checkpoint records recent GitHub Actions attempts that stopped before a runner was assigned (`runner_id=0`, zero steps and no logs). That is an infrastructure/startup blocker, not evidence that the code passed or failed. The new focused test and runtime typecheck therefore remain **unverified** until an actionable run executes on the exact branch head.

Commands wired for that next run:

```bash
npm --prefix runtime/neuro-kurisu run test:p29:hermes-reflective-candidate-gate
npm --prefix runtime/neuro-kurisu run typecheck
npm run audit:upstream-donors
npm run test:upstream-donors
```

No learning score should be raised and no candidate may bypass the existing independent evaluation, signed evidence or authenticated approval path. The wider project still needs an independent paired-seed benchmark with a frozen holdout and observable task-level outcomes; the last documented retrieval experiment had `recallDelta=0` and was not promoted. The latest Release API metadata still points to tag `Neuro` / asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes; published 19 October 2026). That binary was not downloaded or rebuilt: the available GitHub access path here returns UTF-8 text and exposes no release-asset upload operation. No release ZIP was published, and `main` remains untouched.

## Next engineering passes

1. Restore actionable hosted CI (the account owner should inspect GitHub Actions/Billing & Licensing and the missing check-run annotations) and run the focused regression plus TypeScript check on this exact head.
2. Trace production bootstrap → observed skill execution → reflective repair → independent evaluation → signed shadow receipt → explicit approval; do not infer production wiring from file presence.
3. Run a frozen paired-seed validation/holdout experiment and report task success, each component delta, safety failures, calibration, retention/forgetting, rollback and resource cost. Keep all scores unchanged until that experiment is reproducible.
4. Extend the same per-component policy to new measures only when there is an observed failure and a fixed task rubric, rather than adding more scores for their own sake.
