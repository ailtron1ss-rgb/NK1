# WorkPass125 — repository synchronization and integration baseline

**Date:** 2026-10-21  
**Scope:** Stage 1 of the learning-system rebuild: establish the real source baseline, branch/PR topology, rollback points, canonical subsystem owners, and evidence gates before merging or rewriting learning code.  
**Evidence labels:** `OBSERVED` means read from the live GitHub API/tree in this pass; `IMPLEMENTED` means code/files exist, not that behavior passed; `UNRESOLVED` means no adequate evidence was available.

## Executive result

**Stage 1 result: source topology mapped; safe integration route established; no unverified branch was merged into `main`.**

The repository is deliberately split into a small release/metadata `main` branch and a full source tree on `workpass70-source`, with later work arranged as a stacked draft-PR chain. The `main` tree has 12 paths; the WorkPass124 tree has 10,301 paths. GitHub's compare endpoint reports no common ancestor between `main` and the source branches. This is not a normal merge-ready topology and must not be “fixed” by force-merging or replacing `main` with an unreviewed source tree.

- **Release/metadata anchor:** `main` at `69f8186c8bc2cfcadc7c88fc89406358eedbe8c1`.
- **Source rollback anchor:** `workpass70-source` at `e0d8e5b1a422c1e42db817cc37e5e1f97549c4d5`.
- **Current learning stack head:** `workpass124-learning-evidence-hardening` at `372c0bbb4d020901e1c935cf84fc63cff13c9f36`.
- **Immediate parent / prior pass:** `workpass123-authenticated-skill-lifecycle` at `21fef8029b7329f438276c915ce1139c4dfff093`.
- **Current PR:** [#12 — WorkPass124](https://github.com/ailtron1ss-rgb/NK1/pull/12), draft, unmerged, based on WorkPass123.
- **No release approval:** combined status for the current WorkPass124 head returned no status checks; the surfaced associated runs for WorkPass108 evidence identity, WorkPass105 verified outcome ledger, and WorkPass110 continual-learning metrics were failures. PR #12 explicitly says the new failure-boundary regression has not yet had a successful CI execution. Do not treat missing statuses as a pass.

## 1. Branch and PR topology

The observed stacked chain is:

```text
main (12 paths; release metadata/workflows; unrelated Git root)
└─ not a merge base for the full source tree — DO NOT merge directly

workpass70-source (source baseline, e0d8e5b)
└─ workpass79-cognitive-rebuild (PR #1; draft)
   └─ workpass116-seed-clustered-learning-eval (PR #4; draft)
      └─ workpass117-verified-replay-admission (PR #5; draft)
         └─ workpass118-multi-source-learning-integration (PR #6; draft)
            └─ workpass119-skill-retrieval-feedback-curriculum (PR #7; draft)
               └─ workpass120-verified-skill-revision-gate (PR #8; draft)
                  └─ workpass121-ledger-bound-promotion-proposals (PR #9; draft)
                     └─ workpass122-promotion-gate-coverage-hardening (PR #10; draft)
                        └─ workpass123-authenticated-skill-lifecycle (PR #11; draft)
                           └─ workpass124-learning-evidence-hardening (PR #12; draft; current head)
```

Observed branch heads:

| Branch | Head SHA | Latest commit message | Integration state |
|---|---|---|---|
| `workpass116-seed-clustered-learning-eval` | `28e6c0ee4344c572db9efc75e59c39b9408832a5` | Track seed-clustered learning evaluation and research comparison | Draft PR #4; not merged |
| `workpass117-verified-replay-admission` | `b4aebdcb39ca9b02573747e074ded19f296dfc66` | Reuse one manifest fingerprint across replay admission | Draft PR #5; not merged |
| `workpass118-multi-source-learning-integration` | `296a647764965661760e135d3ee5474b9b70dbc0` | Correct XSkill source reference | Draft PR #6; not merged |
| `workpass119-skill-retrieval-feedback-curriculum` | `ac8ecd4491f834f1ea67f3a28ac6108fd978ecb2` | Document repaired execution evidence integration | Draft PR #7; not merged |
| `workpass120-verified-skill-revision-gate` | `862a0a0827f3eb412fbe3f82ab47b552ab882f11` | Exclude mismatched task-family pairs | Draft PR #8; not merged |
| `workpass121-ledger-bound-promotion-proposals` | `b6de182f60fe7781cf6b8a1cfdfeae0097e016db` | Document seed-clustered evidence requirements | Draft PR #9; not merged |
| `workpass122-promotion-gate-coverage-hardening` | `bc49b28fbb73d7d2ec0f3909e54355ee39067914` | Cover non-finite minimum gain threshold regression | Draft PR #10; not merged |
| `workpass123-authenticated-skill-lifecycle` | `21fef8029b7329f438276c915ce1139c4dfff093` | Assert promotion metrics follow activation and rollback | Draft PR #11; not merged |
| `workpass124-learning-evidence-hardening` | `372c0bbb4d020901e1c935cf84fc63cff13c9f36` | Include new branch and failure-boundary test trigger | Draft PR #12; not merged |

**Topology decision:** continue changes on the source stack, preserve each PR's intended base, and keep changes reviewable. Do not target `main` from WorkPass116–124. First land/validate the stack against `workpass70-source` through its declared parent chain; then handle the release/metadata branch separately with a deliberate release process.

## 2. Rollback and baseline contract

- Before a risky learning or persistence change, record the exact base SHA and the relevant test/corpus manifest.
- For the source stack, use `e0d8e5b1a422c1e42db817cc37e5e1f97549c4d5` as the known WorkPass70 source anchor and the current PR base/head pair as the incremental rollback boundary.
- Do not roll back by resetting a branch or force-updating a ref. Revert the smallest faulty commit on the same stack and preserve evidence artifacts.
- Never compare a candidate against a different corpus, manifest, task-family distribution, or evaluation budget. Keep per-case outputs, seed clusters, and the manifest fingerprint with the result.
- Before any promotion claim, record exact commit, Node/runtime version, workflow run URL, command, exit code, and raw per-case result. An empty status response is `UNKNOWN`, not `PASS`.

## 3. Canonical subsystem ownership map

The full source tree already defines a single owner for core runtime capabilities. Future work must extend these owners rather than add parallel systems.

| Capability | Canonical owner / evidence surface | Rule |
|---|---|---|
| Persistent memory and retrieval | `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | One writable memory owner. Retrieval ranking and residency mutation stay separate. Legacy 48-dimensional hash projection is not a semantic embedding. |
| Retrieval baseline / experiment | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts`; `MemoryRetrievalExperiment.ts` | Baseline and candidate share the validated corpus; seeds estimate uncertainty, they do not train the retriever. Prior `recallDelta=0` remains a no-uplift result. |
| Outcome verification | `runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts` | Only exact normalized evidence issued by the verification service can authenticate a matching external postcondition; copied objects/booleans/ACKs are not proof. |
| Skill learning and transfer | `runtime/neuro-kurisu/src/organism/learning/`; existing cognition owners such as `HierarchicalProceduralSkillEngine.ts`, `TransferableEmbodiedSkillSystem.ts`, `B274AutonomousSkillLaboratory.ts` | Reuse existing skill contracts; distinguish skill artifact validity, actual invocation/trajectory, and independently verified task outcome. |
| Evidence ledger / promotion | P23 learning and verified-outcome modules/tests, including `p23-verified-outcome-ledger.mjs`, `p23-verified-outcome-promotion-gate.mjs`, `p23-verified-replay-admission.mjs`, `p23-verified-skill-promotion-proposal.mjs` | Proposal, admission, promotion and rollback must share authenticated evidence and version identity; no bypass around the final gate. |
| Runtime integration | `runtime/neuro-kurisu/src/organism/`; `scripts/audit-core-ownership.mjs`; `scripts/audit-actions-runtime.mjs` | Keep one organism/runtime, one ActionGateway and explicit subsystem APIs. |
| Client/UI | `app/` | UI is a client shell, not a second memory or organism owner. |

## 4. Inventory findings and overlap policy

**OBSERVED:** WorkPass124 has 10,301 tree paths, including the runtime, a large test set, workflows, research notes, and source/reference assets. The learning subsystem has many historically named test/audit files (P23, P26, P27xx, big-pass, WorkPass80–124). This is a signal for reachability/ownership analysis, **not proof that files are duplicates or dead**.

Existing audit entry points include:

- `runtime/neuro-kurisu/scripts/audit-core-ownership.mjs`
- `runtime/neuro-kurisu/scripts/audit-actions-runtime.mjs`
- `runtime/neuro-kurisu/scripts/audit-function-liveness.mjs`
- `runtime/neuro-kurisu/scripts/audit-source-truth.mjs`
- `runtime/neuro-kurisu/scripts/audit-upstream-integrations.mjs`
- `runtime/neuro-kurisu/tests/p23-true-learning.mjs`
- `runtime/neuro-kurisu/tests/p23-seed-clustered-outcome-comparison.mjs`
- `runtime/neuro-kurisu/tests/p23-skill-retrieval-reflection-curriculum.mjs`
- `runtime/neuro-kurisu/tests/p23-skill-store-failure-boundaries.mjs`
- `runtime/neuro-kurisu/tests/p23-verified-outcome-artifact-authentication.mjs`
- `runtime/neuro-kurisu/tests/p23-verified-skill-revision-gate.mjs`

**No deletion is authorized by this inventory.** Before consolidating tests or removing a module, inspect imports, package-script references, workflow wiring, dynamic test discovery, runtime registration, manifests, provenance, generated assets and recovery paths. Prefer reversible archival with a manifest and updated links.

## 5. Current risk register

| Risk | Evidence | Required closure |
|---|---|---|
| Source/release branch divergence | `main` has 12 paths; source stack has 10,301; no common ancestor reported by compare API | Preserve the split; design an explicit release synchronization path instead of direct merge |
| Stale navigation/status docs | `AGENTS.md`, `NEUROCORE_START_HERE.md`, and README still describe WorkPass94/96 and `workpass79` as current while the active PR stack is at WorkPass124 | Update durable navigation only after the source-stack state is verified; make one canonical checkpoint pointer |
| Unverified current CI | No combined statuses; surfaced WorkPass105/108/110 runs failed; PR #12 says its regression has no successful run yet | Obtain a successful exact-head run for the new failure-boundary test, then typecheck + owning learning/evidence suites |
| Learning efficacy remains unproven | Repository docs report `recallDelta=0`; seed-clustered comparison is a measurement correction, not uplift | Require independent held-out task outcomes, same corpus, per-case data, effect sizes and resource cost |
| Promotion bypass / evidence identity | WorkPass117–124 add successive integrity layers; no end-to-end green proof observed in this pass | Inspect every promotion/replay call path and test spoofed, copied, late, duplicate, mismatched and restart-recovered evidence |
| Potential redundant audit/test surface | Many similarly named pass-specific tests/audits in the 10,301-path tree | Run the existing reachability/ownership audits and review candidates manually; do not infer duplication from names |

## 6. Stage-1 exit criteria

- [x] Resolve canonical repository and active source stack from live GitHub state.
- [x] Record exact release, source-baseline, current-head and previous-head SHAs.
- [x] Map WorkPass116–124 as a stacked, unmerged PR sequence.
- [x] Establish that `main` is not the direct integration target for source-stack PRs.
- [x] Identify canonical memory, learning, verification, promotion and runtime owners.
- [x] Establish safe duplicate-handling and rollback rules.
- [ ] Obtain green exact-head CI for WorkPass124 and the owning runtime typecheck/regressions.
- [ ] Run the source-level promotion-bypass/call-graph audit and review its concrete findings.
- [ ] Refresh durable navigation/checkpoint docs to point to the verified active stack.

The last three items remain open because this pass did not have a successful exact-head CI result or execution environment for running the repository's local Node suite. They must not be marked done based on this document.

## Next code-first pass

1. Execute and repair the WorkPass124 failure-boundary test and the owning typecheck/learning suites until a green exact-head run exists.
2. Walk the promotion/replay call graph from `LearningEngine`/skill stores through evidence admission to the final promotion gate; patch any actual bypass with a failing behavioral regression.
3. Integrate the stack through its declared PR parents in order; do not squash away provenance until each parent is validated.
4. Reconcile stale navigation documents after CI state is current, then resume measured memory/skill-learning uplift work.
