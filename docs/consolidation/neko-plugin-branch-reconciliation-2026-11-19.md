# N.E.K.O. plugin branch reconciliation — 2026-11-19

## Scope and baseline

Repository: `ailtron1ss-rgb/NK1`  
Canonical working source at inspection: `workpass70-source` @ `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`.

This review covers the N.E.K.O. plugin gateway, manifest policy, event bridge, message ingress, and atomic restore branches. It is a focused branch-family review, not a complete audit of all NK1 refs.

## Branch / PR lineage

| Earlier PR / branch | State | Current source path |
|---|---|---|
| #780 `aspect/neko-plugin-gateway-adapter-20261104` | closed, not merged | Gateway implementation evolved into event-aware adapter via #789/#803 |
| #784 `aspect/neko-plugin-manifest-policy-20261104` | closed, not merged | Registry/test integrated through composition work and later hardened by #809 |
| #788 `aspect/neko-plugin-runtime-composition-20261104` | closed, not merged | Rebased composition candidate #798 merged |
| #789 `aspect/neko-plugin-event-bridge-20261104` | closed, not merged | Rebased #803 merged |
| #791 `aspect/neko-plugin-message-ingress-20261104` | closed, not merged | Rebased #804 merged |
| #807 `aspect/neko-voice-transcript-observer-rebased-20261104` | merged | Voice observer / bridge candidate in source history |
| #808 `aspect/neko-plugin-policy-atomic-restore-20261104` | closed, not merged | Rebased #809 merged |

Relevant merged PRs include #798, #803, #804, #807 and #809. The old PR branches are provenance and review history; their unmerged status does not imply that their useful implementation remains absent.

## File-level evidence

### #780 — gateway adapter

Old branch file:
- `runtime/neuro-kurisu/src/organism/integration/neko/PluginGatewayAdapter.ts`
- blob `25bf019a1199d80b0ffa730deb63512bd61ac68f`, 14,212 bytes / 316 lines.

Current source file:
- blob `283ca52207c176cbff451838420d26a29dd1609f`, 15,955 bytes / 356 lines.

The current file includes the earlier adapter's tool-call/resource-read handling and extends it with an optional host-owned event bridge for `event_push`, event ID validation, event publication, replay handling and fail-closed bridge errors. The old implementation rejected `event_push` unconditionally. In a distinct-line comparison only three nonblank lines are unique to the old version, while the current version adds the event bridge contract. Do not restore the old file over source.

Other paths from #780:
- `NEKO_PLUGIN_GATEWAY_ADAPTER_RU.md`: exact blob match in source (`10bde86c99602a3f781cb73eb4746ab53a1ec219`).
- `neko-plugin-gateway-adapter.mjs`: exact blob match in source (`ccc123d38aabf682e33cd1a9fe670d8ef831d29a`).
- `neko-plugin-gateway-real-action-gateway.mjs`: exact blob match in source (`7ea6db0d68a777016eee0c75cb73defdb883ba93`).
- Gateway workflow differs and is extended in source to cover event bridge files/tests.
- Runtime `package.json` differs because the current source contains later additions; the gateway test script remains in the shared script set.

Disposition: implementation and tests are represented in current source, with a stronger event-aware adapter. No code cherry-pick from #780 is indicated. Preserve branch/PR provenance until ref deletion checks are available.

### #784 — manifest policy registry

Old registry blob: `114438087e770fd3a3b51028b389ac62a6979807` (352 lines).  
Current source registry blob: `5a485ce02e2ade050b04bbade6602831aacd78be` (364 lines).

The current implementation replaces the old per-row `register()` restore loop with an all-or-nothing restore:
- clears the current registry;
- validates each row into a temporary map;
- rejects invalid/duplicate entries without retaining a valid prefix;
- installs the map only when every entry passes.

Old test blob: `07da342f79d724d0698582f4a5eed3393e869613` (221 lines).  
Current test blob: `9d436775d2ec447a0b2175d5d3a6e15b0a927262` (242 lines).

The current test file retains the earlier test scenarios and adds invalid-snapshot, duplicate-snapshot and valid-restore atomicity coverage. Its summary marker is now `NEKO_PLUGIN_MANIFEST_POLICY=PASS cases=12` (the code's declared case count; this report does not claim a fresh local test run).

The old standalone manifest-policy workflow and documentation file are absent from current source. CI coverage is not absent: `.github/workflows/nk1-neko-plugin-runtime-composition.yml` runs manifest policy tests alongside gateway, real ActionGateway, composition and typecheck. A second standalone workflow would duplicate coverage. The unique documentation is restored in this PR as `runtime/neuro-kurisu/docs/NEKO_PLUGIN_MANIFEST_POLICY_RU.md`, with the current atomic-restore semantics documented.

Disposition: keep current runtime code and shared workflow; preserve the old standalone policy document as a source documentation file; do not reintroduce its duplicate workflow.

### #789 → #803 — event bridge

The old and rebased PRs have the same five paths. Exact patch equality was observed for:
- `NekoPluginEventBridge.ts`;
- `PluginGatewayAdapter.ts`;
- `neko-plugin-event-bridge.mjs`.

Workflow and `CognitiveEventFabric.ts` patches differ slightly after rebase. This is not a whole-PR textual duplicate; it is a rebase of the same feature with source-context adjustments. The current source contains the event-aware adapter blob `283ca52207c176cbff451838420d26a29dd1609f`.

### #791 → #804 — message ingress

All six paths appear in both versions. Exact patch equality was observed for:
- `NEKO_PLUGIN_MESSAGE_INGRESS_RU.md`;
- `OrganismRuntime.ts`;
- `RuntimeInputPolicy.ts`;
- `PluginMessageIngress.ts`;
- `neko-plugin-message-ingress.mjs`.

The only path with a non-identical patch was the workflow, consistent with rebasing/trigger adjustments. The merged rebased PR #804 is the canonical integration; the old PR #791 is not a second implementation.

### #808 → #809 — atomic restore

The current source contains the hardened registry restore and test additions from the merged rebased PR #809. The implementation builds a temporary map and installs it only after full validation. The old #808 workflow patch was not carried as a separate workflow; the shared composition workflow is the current coverage owner.

## Consolidation decisions

1. Keep current `workpass70-source` implementation; do not cherry-pick the older adapter or registry versions over it.
2. Treat #780/#784/#789/#791/#808 branches as historical/superseded candidates, not as proof of missing runtime work.
3. Use #798/#803/#804/#807/#809 as merged provenance for their respective integrated behaviors.
4. Restore the missing manifest-policy documentation (this PR) and retain references to old branch/blob SHAs.
5. Do not add a second CI workflow for manifest policy; shared workflow already includes the policy test and typecheck.
6. Do not delete branch refs in this pass. Before deletion, recheck all open PR head/base relationships, tags, workflow references, protected refs and deployments. PR records and original commits remain part of the audit trail.

## Verification boundary

This pass verified GitHub blob identities and PR patches/metadata. It did not run commands in a local clone, and it does not claim the entire NK1 test suite passed. Relevant PR workflow runs and current-source checks must be queried by exact SHA before making a fresh test-status claim.
