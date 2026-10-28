# Release license review worklist — 2026-10-28

## Purpose and decision boundary

This worklist captures the exact fail-closed audit output produced by the WorkPass70 source publisher on **2026-10-28**. It is an operational checklist, not a legal conclusion and not an approval record.

- Audit run: [Publish validated WorkPass70 source release #28](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40634367275)
- Audited source SHA: `c2e841247db1a9d99242abce65286639bb14bc72`
- Current dependency fingerprint reported by the audit: `9a1e917b21f64845572e72bd565a95d4af5103b046b3ecf8cecf947efa92f6b3`
- Locked npm components: **462**
- Source archives: **8**
- Repository LICENSE/NOTICE inventory entries: **11**
- Audit outcome: `releaseRedistributionReady: false`; **135 errors**.

The report says the code/source provenance test passed, while the license-readiness gate stopped publication. Do not change review statuses or loosen this gate simply to produce a green CI run.

## Error inventory

| Group | Count | What is missing |
|---|---:|---|
| Global review | 6 | Human approval, status, reviewer type/name, review timestamp, evidence reference |
| Root project | 7 | Approved status, explicit license expression, redistribution decision, human reviewer/name, timestamp, evidence |
| Runtime project | 7 | Same seven decisions for `runtime/neuro-kurisu` |
| Locked npm dependency inventory | 5 | Human review status/type/name, timestamp, evidence reference |
| Locked npm fingerprint | 1 | The current fingerprint has not been reviewed/recorded in the manifest |
| Source archives | 56 | 8 archives × 7 missing approval/evidence fields |
| Repository license files | 53 | 7 license-file records × 7 missing fields, plus 4 missing human review records for vendored licenses |
| **Total** | **135** | |

The authoritative path inventory and exact source hashes remain in `contracts/RELEASE_LICENSE_REVIEW.json` and the current `contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS70.json`. Review decisions must refer to the exact hashes in those files.

## 1. Global and project-level decisions

- [ ] **Global release review:** approve or reject source redistribution as a whole; record `status`, `reviewerType: "human"`, the named reviewer, a valid non-future ISO timestamp, and `evidenceRef`.
- [ ] **Repository root:** choose the intended project-wide license expression and document compatibility/redistribution terms. The audit specifically reports that the root project has no explicit license expression in current package metadata.
- [ ] **Runtime:** decide the license expression and redistribution conditions for `runtime/neuro-kurisu`, including its relationship to the repository-root license.
- [ ] Record actual review outcomes in `contracts/RELEASE_LICENSE_REVIEW.json` only after the appropriate human decision. Do not invent a reviewer, date, URL, license identifier, or permission.

## 2. Locked npm dependency inventory

The publisher enumerated 462 locked npm components. A fresh dependency fingerprint was produced by the audit:

`9a1e917b21f64845572e72bd565a95d4af5103b046b3ecf8cecf947efa92f6b3`

- [ ] Review the full current locked dependency inventory, including package/version/package URL and declared license evidence in the current SBOM.
- [ ] Record the reviewer, evidence reference, timestamp and approved review status.
- [ ] Bind `componentFingerprintSha256` to the fingerprint for the inventory actually reviewed.
- [ ] If the lockfiles, SBOM, package versions, purls or license expressions change, regenerate provenance and repeat the review against the new fingerprint.

A detected SPDX identifier in an SBOM is input evidence; it is not proof by itself that the entire assembled product is cleared for redistribution.

## 3. Source archives — eight records require review

All paths are relative to the repository. The existing review manifest stores each archive's SHA-256 and should remain the authoritative hash source.

| Archive | Automatic inventory observation | Required human action |
|---|---|---|
| `legacy/input-archives/NOMEGA_PASS20_CAPABILITY_FORGE.zip` | No license detected among top-level members | Find authoritative upstream license/NOTICE and confirm distribution rights for the exact archive hash |
| `legacy/input-archives/NeuroCore_V126_Consolidation_Decontaminated_2026-09-30.zip` | No license detected among top-level members | Same review |
| `legacy/input-archives/NeuroCore_V143_FwPKM_Language_2026-10-01.zip` | No license detected among top-level members | Same review |
| `legacy/input-archives/external-sources/conscio-4.8.2.tar.gz` | Embedded member `conscio-4.8.2/LICENSE` found | Identify its actual license terms and confirm redistribution scope |
| `legacy/input-archives/grok-workspace.zip` | No license detected among top-level members | Find authoritative upstream license/NOTICE and confirm distribution rights |
| `legacy/input-archives/raw-source-archives/letta-main.zip` | Embedded member `letta-main/LICENSE` found | Identify its actual license terms and confirm redistribution scope |
| `legacy/input-archives/raw-source-archives/lumina-main.zip` | Embedded member `lumina-main/LICENSE` found | Identify its actual license terms and confirm redistribution scope |
| `legacy/input-archives/raw-source-archives/will-main.zip` | Embedded members `will-main/NOTICE` and `will-main/LICENSE` found | Review both license and notice obligations and confirm redistribution scope |

“No license detected” means the automated inventory did not establish evidence; it does **not** mean public domain, permissive use, or permission to redistribute.

For each archive, a complete human-reviewed record needs a decision on the license expression, redistribution permission, reviewer identity/type, review timestamp, and an evidence reference that supports the decision for that exact archive hash.

## 4. Repository LICENSE/NOTICE files

Seven manifest entries were found but lack completed approval records:

- [ ] `app/.grok/skills/generate2dmap/LICENSE`
- [ ] `app/.grok/skills/generate2dsprite/LICENSE`
- [ ] `app/.grok/skills/video2dsprite/LICENSE`
- [ ] `legacy/input-archives/hexis-main-2026-10-08/LICENSE`
- [ ] `legacy/input-archives/will-main-2026-10-08/LICENSE`
- [ ] `legacy/input-archives/will-main-2026-10-08/NOTICE`
- [ ] `runtime/neuro-kurisu/LICENSE`

The audit also reports that no human review record exists for these four vendored license files:

- [ ] `runtime/neuro-kurisu/research/vendor/CleanRL/LICENSE`
- [ ] `runtime/neuro-kurisu/research/vendor/ContinualAI-Avalanche/LICENSE`
- [ ] `runtime/neuro-kurisu/research/vendor/OpenAI-Baselines/LICENSE`
- [ ] `runtime/neuro-kurisu/research/vendor/SkillLearnBench/LICENSE`

For each current repository license file, reconcile the actual file hash to the manifest before review; the audit will reject stale hashes. Classify the license/NOTICE evidence and have a human confirm the intended distribution compatibility. Repeated identical license-text hashes may reduce repeated legal analysis, but each path still needs correct inventory coverage.

## 5. Evidence fields and closure sequence

For root/runtime projects, archive entries, and repository license-file records, the audit requires the applicable fields to be real and complete:

- `status: "approved"` only after a real decision.
- Explicit `licenseExpression`.
- `redistributionApproved: true` only when redistribution was actually approved.
- `reviewerType: "human"` and a non-empty named reviewer.
- A valid, non-future ISO timestamp.
- A non-empty `evidenceRef` to the reviewed terms, upstream license/NOTICE, decision record or other supporting evidence.

For the npm inventory, use the corresponding human review fields and the exact current `componentFingerprintSha256`; do not set a project license expression or redistribution flag where the schema does not require it.

Recommended closure order:

1. Human owner decides the repository/runtime licensing policy and global redistribution position.
2. Complete archive and vendored-source review using the exact manifest hashes; record any exclusions or obligations only through the authorized project decision.
3. Complete the locked npm dependency inventory review and bind the correct fingerprint.
4. Update the manifest with the real reviewer/evidence records.
5. Run `npm run test:provenance-current`, then `npm run audit:release-license-readiness` on the resulting exact source tree.
6. Only if the audit passes should the source publisher proceed to archive creation. Independently verify the resulting Release asset and SHA-256.

## Current status

**Blocked pending human review.** No license permission has been inferred, no reviewer identity has been manufactured, and no release gate is waived by this worklist.
