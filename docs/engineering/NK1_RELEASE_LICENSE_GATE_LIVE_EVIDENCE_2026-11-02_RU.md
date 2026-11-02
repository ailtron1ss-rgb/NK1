# NK1 — live release-license gate evidence (2026-11-02)

## Срез и воспроизводимость

- Source branch: `workpass70-source`.
- Exact source SHA: `608435493b4af3b4a222d385f1b77d978d18583b`.
- Release lineage: `WORKPASS70`.
- Audit host: изолированный ProductOS checkout с detached worktree на точном source SHA; исходная ветка GitHub не изменялась.
- SBOM/provenance generation timestamp: `2026-11-02T09:44:46.080Z`.
- Command 1: `npm run test:provenance-current` — PASS (1/1).
- Command 2: `npm run audit:release-license-readiness` — exit 1, expected fail-closed result, `releaseRedistributionReady=false`.
- Inventory: 477 locked npm components; 8 source archives; 11 repository LICENSE/NOTICE records; four source archives contain detected license evidence.
- Dependency fingerprint: `a10f75530eeac185de88cdf338b094c2cbd9bec7a4c16c9cee7b5d040cb92cd4`.

Audit reproduction:
```bash
npm run test:provenance-current
npm run audit:release-license-readiness
```

## Structured 115-error result

| Scope | Errors | Meaning |
|---|---:|---|
| `global-review` | 5 | global decision and its human reviewer/status/time fields remain pending |
| `root-project` | 5 | repository root has no declared root LICENSE and no approval |
| `runtime-project` | 5 | runtime LICENSE says private / all rights reserved; no redistribution grant |
| `locked-npm-dependencies` | 5 | human inventory review missing; recorded fingerprint does not match current measured fingerprint |
| `source-archives` | 40 | 8 archives × five missing human decision fields |
| `repository-license-files` | 55 | 11 LICENSE/NOTICE records × five missing human decision fields |
| **Total** | **115** | release remains blocked |

The structured `errorSummary` is now emitted by `tools/audit-release-license-readiness.mjs` as `{ total, byScope: [{ scope, errorCount, errors }] }`. It is a view of the original error list, not a second source of truth. Tests assert that the grouped count equals `errorCount`, and that a fully approved fixture returns an empty summary. This change does not downgrade or bypass a single gate.

## Exact dependency and source evidence

| Item | Current evidence | SHA-256 |
|---|---|---|
| Locked npm inventory | 477 components; human fingerprint approval pending | `a10f75530eeac185de88cdf338b094c2cbd9bec7a4c16c9cee7b5d040cb92cd4` |
| NOMEGA archive | license not detected in inspected top-level members; ownership/embedded rights unverified | `01dfdf650158d29869c87bc0df584d7f9fed56b63feb17f47f9aae887af5079b` |
| NeuroCore V126 archive | license not detected in inspected top-level members; provenance/rights need confirmation | `c57561e020593a67ae9bbf248da77cef9dee4b47d45e44c63db80ec05cd3dce0` |
| NeuroCore V143 archive | license not detected in inspected top-level members; provenance/rights need confirmation | `97cacf02b82d1008ef52f2072a458d3a8467dbc5402408dd2e5733b077885d03` |
| Conscio 4.8.2 archive | embedded LICENSE detected; upstream/revision and exact terms not verified | `05cc43c834029a02e841f6318e353af3f7681c4863c176d9396715a7446b1fb6` |
| Grok workspace archive | no top-level license detected; do not infer project identity from filename | `75d102549c372d7fed9cdcdcdbe9a3df5f475ca2540360d6be6551c3f2c53ea1` |
| Letta archive | embedded LICENSE detected; exact archived revision not verified | `5d28f152aba633fcc26fe20125fad28f73c6773e6526fc65249656b2d0c61075` |
| Lumina archive | embedded LICENSE detected; upstream identity ambiguous | `a820cb1b394018451c8ee5863ae0a1f74666bd10519007d6e37e69e42452d467` |
| Will archive | LICENSE and NOTICE detected; exact archived revision not verified | `9d0c30277f0981b67104b1e2a07d9c7f025fee60ae57bd470cca898cf0d457a4` |

### Eleven repository LICENSE/NOTICE records

| Path | Observed expression / status | SHA-256 |
|---|---|---|
| `app/.grok/skills/generate2dmap/LICENSE` | MIT candidate; pending human review | `d63ddc781bf0d15753fe0ba22c7cd5828dabb7776465ea4d4939558d4909b0fa` |
| `app/.grok/skills/generate2dsprite/LICENSE` | MIT candidate; pending human review | `d63ddc781bf0d15753fe0ba22c7cd5828dabb7776465ea4d4939558d4909b0fa` |
| `app/.grok/skills/video2dsprite/LICENSE` | MIT candidate; pending human review | `d63ddc781bf0d15753fe0ba22c7cd5828dabb7776465ea4d4939558d4909b0fa` |
| `legacy/input-archives/hexis-main-2026-10-08/LICENSE` | MIT candidate; pending human review | `b5138e29f1b4a2ca7f6106af7317efb23d89e255867609b79cd26baef4843308` |
| `legacy/input-archives/will-main-2026-10-08/LICENSE` | Apache-2.0 candidate; pending human review | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `legacy/input-archives/will-main-2026-10-08/NOTICE` | Apache-2.0 NOTICE evidence; not a separate grant | `baedc4a6fccbaaaa9801fde10279a5720e7f58542f3f46a4af9fd0be10e4812c` |
| `runtime/neuro-kurisu/LICENSE` | `LicenseRef-NK1-Private-All-Rights-Reserved`; no public redistribution grant | `4a3eeabf67408063d4b46aada572343348a792c901db1eb0ae08cca30eea42c4` |
| `runtime/neuro-kurisu/research/vendor/CleanRL/LICENSE` | MIT header; upstream license is composite; scope review pending | `34ad40e40ee9d274d4bfcbcd1b56f2a1f8a22b5eb71e42094e78151b76377a85` |
| `runtime/neuro-kurisu/research/vendor/ContinualAI-Avalanche/LICENSE` | MIT candidate; whitespace-normalized content match; pending review | `81a826c503145d79c454c6e49fce9f7bea17d8c1dacff93fe0dbc92283c8bbe5` |
| `runtime/neuro-kurisu/research/vendor/OpenAI-Baselines/LICENSE` | MIT candidate; pending human review | `fd85a61f2f086d9da85b5d3cbb1a5f49665fc7fe9fed5f799cb5753ad766f710` |
| `runtime/neuro-kurisu/research/vendor/SkillLearnBench/LICENSE` | MIT candidate; pending human review | `d4a5e863f521c0fe405a0d94271be34740539f9dfa973c99ab883a771f7fa622` |

Detailed upstream evidence and limitations remain in [RELEASE_LICENSE_VENDOR_EVIDENCE_2026-10-31_RU.md](../RELEASE_LICENSE_VENDOR_EVIDENCE_2026-10-31_RU.md).

## Package assembly smoke — technical only

A temporary package smoke was performed on exact source SHA `608435493b4af3b4a222d385f1b77d978d18583b`:

- `git archive` created a prefixed ZIP.
- Fresh generated `contracts/SBOM.final.json` and `contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json` were overlaid into that same prefix.
- Both records occurred exactly once and matched the generated bytes.
- `unzip -t` completed without errors.
- The new release-manifest ZIP-evidence verifier confirmed both embedded records by path, size and SHA-256.
- Temporary smoke archive: 128,286,056 bytes; SHA-256 `8e8c6117c495d2509eedf3ceaaa638edc7588345e438d00e194b74dbf6f30261`.

This smoke confirms archive assembly and evidence binding only. It is not a published asset, it does not pass the human license gate, and it does not authorize redistribution.

## Required human decisions — unchanged and fail-closed

1. Decide whether the root project has a distributable license and identify the rights holder.
2. Decide separately whether the private/all-rights-reserved runtime may be redistributed; absent explicit permission, it remains blocked.
3. Review the exact 477-component locked npm inventory and approve only the current measured fingerprint.
4. Identify exact upstream repositories/commits and distribution terms for all eight source archives; inspect all nested license/NOTICE files, not only the top-level subset.
5. Review all eleven repository LICENSE/NOTICE records; distinguish MIT/Apache notices from actual permission to redistribute NK1 as a whole.
6. Only a human reviewer may set `status=approved`, `reviewerType=human`, reviewer, timestamp, evidenceRef and `redistributionApproved=true` where rights are actually established.

**No human approval was created or inferred in this pass. No Release was published.**
