# NK1 — Neuro-Plastic / P25 / Neural Prosthesis branch consolidation

**Audit date:** 2026-11-19  
**Repository:** `ailtron1ss-rgb/NK1`  
**Canonical integration branch:** `workpass70-source`  
**Source HEAD observed before this report commit:** `71f085a3935fd2202431c1e2205218e03f8194c6`  
**Scope:** Neuro-Plastic Core, P25 Adaptive Synaptic Matrix, its security follow-ups, and the adjacent Neural Prosthesis / Layer Force branch family. This is not a full audit of all repository refs.

## 1. Result in one paragraph

The Neuro-Plastic Core work has already been integrated in several successive generations. The correct current line is the merged 2026-11-18 branch `aspect/neuro-plastic-core-lora-adapters-20261118` (PR #936), followed by independent security and lifecycle integrations #940, #943, #944 and #948. The older 2026-11-17 PR #937 is now closed as superseded; its one distinctive strict model-response check was deliberately not replayed because the current provider and its regression test explicitly support OpenAI-compatible structured responses that omit the response `model` field, falling back to the requested alias. The open P25 donor PR #942 is also closed as superseded: its persistent single-use report ledger is already in source, and #948 adds the stronger host-owned monotonic CAS anchor. The separate Neural Prosthesis and Layer Force work remains open and was not merged into production as part of this pass.

## 2. Current-source integration map

| PR | GitHub disposition | Change set | Merge commit |
|---|---|---|---|
| [#936](https://github.com/ailtron1ss-rgb/NK1/pull/936) | Merged | Neuro-Plastic Core offline LoRA/QLoRA pipeline plus P25/Adaptive Synaptic Matrix integration; 26 files, +5,823/-9 | `d84e4ed6d9531f2af913256ae56012f565b73770` |
| [#939](https://github.com/ailtron1ss-rgb/NK1/pull/939) | Merged | Current-source P25 canonical registry-backed synaptic routing; 12 files, +1,724/-4 | `f4b5b7638810bc2127524e2f402b01c04e504d00` |
| [#940](https://github.com/ailtron1ss-rgb/NK1/pull/940) | Merged | Replace runtime HMAC activation gates with externally verified Ed25519 trust; 12 files, +879/-138 | `24a7a05abea0b904c9b543af8ec4ff55dcd7dd17` |
| [#943](https://github.com/ailtron1ss-rgb/NK1/pull/943) | Merged | Offline trainer/symlink hardening and CPU LoRA train-export-reload smoke; 5 files, +258/-1 | `7a22979b4d4214522510e899f860e60bb77a5b64` |
| [#944](https://github.com/ailtron1ss-rgb/NK1/pull/944) | Merged | Re-check the candidate after asynchronous host approval so a concurrent rollback cannot resurrect it; 2 files, +58/-2 | `07452517bc1d7c4635d54ca31eb4d5b488e743e5` |
| [#948](https://github.com/ailtron1ss-rgb/NK1/pull/948) | Merged | Bounded single-use validation ledger plus host-owned monotonic anti-rollback anchor and snapshot reconciliation; 7 files, +622/-30 | `2d8a71cd937ed7196f69b6cef68f4fa016b508ee` |

The exact-head Actions runs queried for #940, #943, #944 and #948 all reported successful relevant jobs. In particular, #948's P25 Adaptive Synaptic Matrix and Unified Organism Runtime workflows both completed successfully. #943's Neuro-Plastic offline adapter workflow completed successfully. The CPU smoke gate is configured in the current `.github/workflows/neuro-plastic-core.yml` and explicitly trains, exports, hashes and reloads a local tiny LoRA adapter; do not generalize this into proof of production GPU training or live model quality.

## 3. PRs closed as superseded in this pass

### PR #937 — older Neuro-Plastic Core donor

- Previous state: open Draft; head `1d681ebe869b9ed7cdcb34ebecb23dab2505a0ca`, branch `aspect/neuro-plastic-core-lora-adapters-20261117`.
- New state: **closed, not merged**.
- Superseded by #936 and its security follow-ups #940/#943/#944/#948.
- The exact-head Actions run set previously fetched for #937 reported SUCCESS for the Neuro-Plastic Core offline adapter gate, Unified Organism Runtime, Core regression, and associated contracts. This is evidence that the old revision passed its then-current jobs, not a reason to replay its older tree over the newer source.

#### File-by-file blob fingerprint comparison (18 changed paths)

The full 18-path PR filename list was enumerated. Current-source and donor blob SHA values were fetched for every path.

| Changed path | Current `workpass70-source` blob | 2026-11-17 donor blob | Finding |
|---|---|---|---|
| `.github/workflows/neuro-plastic-core.yml` | `c1ba4760373fab29750696656a9453e68785806f` | `9bf514075af667a3a30b7f64f67be76eb6f98704` | Current workflow adds signer, smoke and hardening gates |
| `.gitignore` | `be5dfe9784a69228f052eb7f732c8feea6362680` | same | Exact blob match |
| `NEURO_PLASTIC_CORE_RU.md` | `b6fcc7dca3a4f1e5f7f941b34c7d2b3e105648c1` | `b9767a89c2628fad38c73402d4c0a28be2001b14` | Current documentation includes later trust/symlink/CPU-smoke boundaries |
| `requirements-neuro-plastic.txt` | `3faf8fd5fc0165b33875894371f4df5099992f0d` | same | Exact blob match |
| `scripts/neuro_plastic_registry.mjs` | `824d9e8c4fb8029b133e55d1d038c6c0cd965b25` | `dbf6827801aa1ff147a19e3ab2b6cb3cffb1be29` | Current CLI includes later external-signer support |
| `scripts/neuro_plastic_train.py` | `dfae9e72182c34021642eac15682ea802d3ecf6f` | `d7a45992c11e6ab2db3774b3ce22c3e5b6fd7c23` | Current trainer is newer and includes post-donor hardening |
| `NeuroPlasticInferenceAdapter.ts` | `a6fc5ac55b6336be473b7cb18b6c28b143db47c9` | `f709b1c22fed2bac59378caa37865405b1c2fd3b` | Current adapter revision differs |
| `OpenAICompatibleLocalChatProvider.ts` | `eaed6e2ddb4965886e65b9d2b1511b57992c2e44` | `e2b94255559af51406e68ccd8e331abcf533e6a4` | One intentional compatibility difference; see below |
| `LanguageOrgan.ts` | `46b300c10c191cb68fde82d48a99336c20bb0e3b` | `53b11e33513d66f7c9aae20a762afd7776aa45e6` | Current runtime wiring is newer |
| `NeuroPlasticAdapterRegistry.ts` | `ad2bee6fc50ab7fc86855f7f530933a6854e491e` | `77d36a9eba7a05b49114eac8963b5cb046a19e1b` | Current registry includes external trust and post-await rollback-race revalidation |
| `NeuroPlasticArtifactVerifier.ts` | `9b1ca612189d4c3e8eb8a7ab406392eb29d9ee1e` | `b4d606c7dc42ad13b7090fdce675b87ea241a8fe` | Current verifier differs and contains later path hardening |
| `NeuroPlasticCorpusBuilder.ts` | `cf50f251f5b0b4901add30fbb6fed94cdb232761` | `990d749dee2509bd53435460052b6d42c5b0eb8d` | Current builder is newer |
| `src/server/server.mjs` | `ae84859f3eafae27c9743a7239fe71e28f1a55ef` | `558c1fdac2785210a7e8b41813a53ab97c4d3558` | Current server includes later trust/runtime integration |
| `tests/local-chat-provider-workpass40.mjs` | `0f8f41959aff3d4d81cbcbe9a41000fce0bf0893` | `ededd9f6027154549cd287220f1f0232ea1c68fe` | Exact semantic difference reviewed below |
| `tests/neuro-plastic-core.mjs` | `dffcfb08cf7e90f2b86c010d17d69d4d4900a4f8` | `fad387e7781558d2791171d21615e16ffd7a29ee` | Current regression suite is newer |
| `tests/neuro-plastic-language-routing.mjs` | `6275edd2247c3d8e0c2b33bd8ec9d468dbfa55bd` | same | Exact blob match |
| `tests/neuro-plastic-registry-cli.mjs` | `b74dad7360301bf976bf96383b7d293919a0f056` | `f26da79a7e23caf64e21e87b8c76ff01a7100aa6` | Current test exercises newer external-signer CLI shape |
| `tests/test_neuro_plastic_train.py` | `b88699af0bfb4b171941f4d5423b9c26235b4463` | `a83ad7153b7ef0dea3f64aa83dd9bc8685505491` | Current test contains additional trainer guards |

This fingerprint table is not a claim that each old source line was copied: it shows which exact blobs were equal and which had moved on. No old file was copied wholesale to source in this pass.

#### Explicit compatibility decision

The 2026-11-17 donor added a strict check that throws `llama.cpp-response-model-missing` when a successful local OpenAI-compatible response has no `model` property. The current provider instead uses the explicitly requested model alias when a server omits that property. The current `local-chat-provider-workpass40.mjs` test deliberately exercises a structured-content response that has no `model` property and expects it to succeed. The strict variant would break that current compatibility contract. It is therefore recorded as an unadopted alternative, not silently merged. The source branch and test were not changed for this behavior in this consolidation.

### PR #942 — P25 persistent single-use report ledger

- Previous state: open Draft; branch `aspect/omestro-25-adaptive-synaptic-matrix-20261117`.
- New state: **closed, not merged**.
- Superseded by merged PR #948.
- The PR #942 patch adds the 64-entry non-evicting ordered report-digest ledger, monotonic count, SHA-256 ordered-sequence commitment, corruption/truncation/reordering detection, saturation and fail-closed restore. The current `AdaptiveSynapticMatrix.ts` has those same fields and behaviors. PR #948 includes that ledger plus a host-owned `SynapticReplayAnchorStore` contract with atomic compare-and-swap and explicit restore/activation reconciliation.
- Current source includes `tests/p25-synaptic-replay-anchor.mjs` (blob `2a959844acb4faa6bda8968c08be99ad80853060`, 9,455 bytes), which exercises the host-owned anchor/CAS/rollback boundary. The dedicated PR #948 P25 Actions gate completed successfully on the exact head `9372c5e90dc2124f08251a14170283dba6ade020`.
- No second copy of #942 was merged.

## 4. Related P25 branches and PRs

| PR | Result | Disposition |
|---|---|---|
| #921 Adaptive Synaptic Matrix initial donor | Closed, not merged | Superseded by current P25 routing + anti-replay integrations |
| #938 initial canonical routing | Closed, not merged | Superseded by #939 |
| #939 canonical registry-backed routing v2 | Merged | Included in current P25 route |
| #942 persistent single-use ledger | Closed, not merged | Superseded by #948 |
| #948 host-owned monotonic replay anchor | Merged | Current anti-rollback integration |

The current P25 source/test files were checked for the accepted-report list/count/commitment, saturation, replay rejection, history-capacity rejection, and the external replay-anchor test. Current P25 workflows on #948 report SUCCESS.

## 5. Neural Prosthesis and Layer Force — intentionally not folded into Neuro-Plastic Core

These are adjacent but distinct features and must not be merged as if they were duplicate branches:

- [PR #925](https://github.com/ailtron1ss-rgb/NK1/pull/925), head `ad80723cb2dd551fb026a7a99678b93849167788`, remains open Draft. It contains 21 files (+3,621/-19): a separate Python research package, engine/evaluation/training/service code, tests, local chat provider and sidecar supervisor integration, plus P40/Language/Server wiring. Its exact-head workflow set previously fetched completed successfully, including the dedicated **NK1 Neural Prosthesis** and Neuro-Plastic adapter gates. It is not merged into current source.
- [PR #931](https://github.com/ailtron1ss-rgb/NK1/pull/931), head `d87d7213412de9b71786996f1c8c7451f17e33b3`, remains open Draft and is based on the older Neural Prosthesis branch. It adds Layer Force activation-steering work (10 files, +1,691/-27). It depends on the Neural Prosthesis line and is not independently integrated.
- A second branch `aspect/neural-prosthesis-transformer-residual-20261118` also exists. Branch-to-branch comparison shows divergent histories and a different 15-file surface from the 21-file PR #925 donor. It is not declared a duplicate and is not deleted or merged by this pass.

**Decision:** leave #925/#931 open for a dedicated review/rebase/validation. Their research/service runtime dependencies and wiring deserve separate file-by-file treatment; merging them wholesale into the completed Neuro-Plastic pass would mix separate aspect scopes.

## 6. Branch names tracked in this family

Neuro-Plastic/P25:
- `aspect/neuro-plastic-core-lora-adapters-20261117` — old donor, PR #937 closed as superseded
- `aspect/neuro-plastic-core-lora-adapters-20261118` — PR #936 merged
- `aspect/neuro-plastic-core-lora-adapters-symlink-hardening-20261118` — PR #943 merged
- `aspect/neuro-plastic-ed25519-approval-20261118` — PR #940 merged
- `aspect/neuroplastic-activation-race-guard-20261118` — PR #944 merged
- `aspect/omestro-25-adaptive-synaptic-matrix-20261117` — initial P25 donor; PRs #921/#942 closed as superseded
- `aspect/p25-monotonic-replay-anchor-20261118` — PR #948 merged

Neural Prosthesis / Layer Force:
- `aspect/neural-prosthesis-transformer-residual-20261117` — PR #925 open
- `aspect/neural-prosthesis-transformer-residual-20261118` — distinct alternate line, not yet reconciled
- `aspect/layer-force-activation-steering-20261117` — PR #931 open

Closing a PR did not delete its branch ref. The currently connected GitHub action set does not expose a branch/ref deletion operation. No branch ref was deleted, force-repointed, or rewritten by this audit.

## 7. Repository-wide branch counter at this checkpoint

A complete paginated enumeration of `search_branches(query="")` returned **998 unique branch names** across 11 pages (the final zero-row page closed pagination; no duplicate names were observed).

| Prefix | Branches |
|---|---:|
| no prefix | 265 |
| `aspect/*` | 241 |
| `fix/*` | 176 |
| `work*` | 159 |
| `feature/*` | 44 |
| `consolidation/*` | 33 |
| `docs/*` | 24 |
| `feat/*` | 14 |
| `integrate/*` | 10 |
| `audit/*` | 6 |
| `planning/*` | 4 |
| `research/*` | 4 |
| all smaller prefixes combined | 18 |

The count is live and can move while other chats operate on the repository. It counts branch names, not unique commit heads or fully audited branch trees. Closing #937 and #942 reduces open PR clutter but does **not** reduce the count of branch refs.

## 8. Release and safety boundaries

- The October 19 Release ZIP remains the primary published artifact. This pass did not download/unpack it or independently verify parity against current source.
- No Release ZIP, release tag, or `main` branch was modified.
- All new source integration/branch decisions in this pass target `workpass70-source`.
- No destructive branch-ref operation was performed.
- The 998 refs have not each been audited file-by-file; this report covers the named Neuro-Plastic/P25/Neural Prosthesis family only.
