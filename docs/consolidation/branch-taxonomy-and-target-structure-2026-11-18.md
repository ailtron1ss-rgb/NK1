# NK1 branch taxonomy and consolidation target — 2026-11-18

## Interpretation note

The counts below are **multi-label keyword matches** against branch names and PR titles/head refs. One branch or PR can match several domains. These are navigation signals for the next source-code review, not a final classification based on full diffs.

## Current branch naming inventory

Total: 1,033 branch refs.

| Current prefix | Count |
|---|---:|
| aspect/ | 225 |
| fix/ | 179 |
| work/ | 161 |
| feature/ | 46 |
| docs/ | 28 |
| feat/ | 15 |
| integrate/ | 10 |
| audit/ | 6 |
| cline/ | 5 |
| research/ | 4 |
| planning/ | 4 |
| architecture/ | 2 |
| optimization/ | 2 |
| rebase/ | 2 |
| Root-level names (no prefix) | 334 |
| ci/ | 1 |
| compat/ | 1 |
| consolidation/ | 1 |
| automation/ | 1 |
| experiment/ | 1 |
| jules-generated | 1 |
| nk1 | 1 |
| perf/ | 1 |
| typescript/ | 1 |
| verify/ | 1 |

The largest structural issue is not only duplicates. It is the coexistence of several naming systems: aspect, fix, work, feature, workpassNN, generated branches, and root-level names. A final taxonomy should reduce these to a small number of persistent aspect branches plus short-lived task branches.

## Multi-label semantic signals in branch names and PR titles

| Candidate domain | Branch refs matched | PRs matched | Open PRs matched |
|---|---:|---:|---:|
| Safety / trust / evidence | 208 | 341 | 136 |
| Memory / retrieval | 180 | 220 | 79 |
| Brain / cognition runtime | 123 | 171 | 89 |
| Learning / evaluation | 114 | 183 | 71 |
| Integration / adapters | 115 | 188 | 81 |
| Autonomy / planning | 98 | 150 | 88 |
| Avatar / embodiment | 85 | 123 | 47 |
| Affect / user model | 70 | 82 | 36 |
| Infrastructure / CI | 34 | 52 | 15 |
| Voice / speech | 16 | 30 | 13 |
| Docs / research / audit | 106 | 159 | 96 |

These counts overlap and must not be summed. The low voice/speech count should not be read as low importance; many speech branches also match avatar, safety, integration or cognition terms.

## Proposed persistent aspect structure

Aim for 12–14 long-lived aspect branches, with temporary topic branches created from the corresponding aspect branch and integrated back after review.

1. **core-organism-runtime** — OrganismBus, OrganismState, canonical cognitive cycle, state ownership, event contracts, scheduling and runtime lifecycle.
2. **memory-and-retrieval** — episodic/semantic/associative memory, HeXis, HMX, MemoryOS2, temporal memory, source lineage, forgetting and retrieval.
3. **learning-and-neuroplasticity** — Neuro-Plastic Core, LoRA/QLoRA, online adaptation, consolidation, replay, skill evolution and weight/state safety.
4. **motivation-autonomy-planning** — drives, goals, initiative, action selection, planning, consequences, scenario simulation and governed autonomy.
5. **affect-personality-usermodel** — affective state, identity/personality stability, UserModel, ToM, social context, emotional appraisal and explicit forget/consent semantics.
6. **embodiment-avatar** — 2D/2.5D/3D, Live2D, VRM/GLB, rigging, motion, expression, sprite catalog, rendering and avatar persistence.
7. **voice-and-speech** — ASR, transcript observers, turn-taking, speech admission, TTS, prosody, phonemes, lip sync and interruption handling.
8. **tooling-and-integrations** — plugins, MCP, gateways, external services, adapter contracts and isolated donor-framework integrations.
9. **safety-trust-and-governance** — ethical gates, permission boundaries, action ledger, provenance receipts, anti-replay, rollback, credentials and policy enforcement.
10. **evaluation-and-observability** — paired seeds, holdouts, benchmarks, ablations, readiness evidence, telemetry, regression reports and performance budgets.
11. **client-mobile-and-ux** — frontend state projections, mobile, UI navigation, user settings, accessibility, responsive design and offline behavior.
12. **infrastructure-release-and-operations** — CI, Docker, workflows, build/reproducibility, artifact generation, packaging, deployment and release verification.
13. **research-and-assimilation** — source-project comparison, literature, donor inventory, architecture proposals and unaccepted experiments; accepted code moves to its owning aspect.

Cross-cutting safety/evidence should not become a second runtime or duplicated business logic. Shared contracts belong in core; safety implementations live in the safety aspect and are called through explicit interfaces.

## Branch policy proposal

- Persistent branches should have one canonical name per aspect, all based on the current source line.
- Short-lived task branches should be named under their aspect, for example aspect/memory/<topic>-<date> or aspect/voice/<topic>-<date>.
- No new permanent workpassNN, unqualified root-level, or parallel feature/fix branch families unless there is a documented reason.
- A task branch is integrated only after a file-level diff review, dependency scan, tests and evidence status.
- Merge commit/cherry-pick provenance should record source branch, original PR, original commit SHA, selected files and blob SHA where binary files are involved.
- Branches referenced as bases by open PRs remain protected until those PRs are retargeted or closed.
- Do not merge into main as a substitute for source integration. workpass70-source remains the working source line; release archive comparison remains a separate gate.

## Existing PR target split

The PR census has 414 open PRs:
- 203 target workpass70-source.
- 69 target main.
- 13 target integration.
- The remaining 129 target 30+ specialized branches.

This distribution is a major source of fragmentation. It means we should not merge all PRs into one base in bulk. First identify which open PRs are genuinely source-ready; then reconcile PR chains that target an aspect branch; finally classify main-targeted docs/artifact PRs separately from runtime source changes.

## Recommended execution order

1. Protect and map every open PR head/base reference.
2. Eliminate exact duplicate HEAD refs only after all PR/tag/ref relationships are recorded.
3. Group code-bearing PRs by changed paths, patch/blob fingerprints and source dependencies.
4. Build one canonical aspect branch per domain from workpass70-source, not from main.
5. Extract unique commits/files into those aspect branches; retain variant assets and provenance.
6. Run relevant tests and independent holdout/evaluation gates.
7. Close exact duplicate PRs only after preserving a canonical implementation and confirming there are no dependent PRs.
8. Delete obsolete branch refs only when the tool supports it and the full reference audit proves they are unreachable/unneeded.

## Status

The taxonomy remains a proposal. The first two deliverables are created:
- Full branch and PR census (branch 1,033 / PR 937).
- First verified asset-only embodiment integration candidate, PR #950.
No bulk branch deletion or broad code merge has been performed.
