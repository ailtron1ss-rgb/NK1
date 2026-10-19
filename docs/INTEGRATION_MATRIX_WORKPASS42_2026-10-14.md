# WorkPass42 — integration and file ownership matrix (2026-10-14)

| Area | Canonical owner | Other copies / projections | Cleanup policy | Still open |
|---|---|---|---|---|
| Organism runtime | `runtime/neuro-kurisu` / `OrganismCore` | HTTP server and Runtime Atlas are projections | No second writable organism is created | Target production E2E |
| Long-term memory | MemoryOS2/MemoryFabric | Hexis temporal review and older memory adapters | Adapters may retain audit projections; no competing owner | Independently labelled temporal holdout; current retrieval uplift 0 |
| Causal cycle | `CognitiveEventFabric` + unified cycle contract | Older archived cognition files remain in Legacy | Historical bytes preserved via source manifests and immutable blobs | Real external outcome receipts |
| Action execution | ActionGateway + durable receipt archive | Provider adapters and old source implementations | Completion keys are not evicted silently | Real provider/device reconnect/replay |
| Canonical Live2D | `runtime/neuro-kurisu/public/live2d` | `app/public/live2d` is generated shadow only for Vite | 21 exact shadows omitted in package; hash-verified `assets:sync`/`assets:clean` | Full browser E2E with model and motions |
| App-only Live2D tooling | `app/public/live2d/viewer.html`, `vendor/` | None if no source duplication | Retained; not overwritten/deleted by clean command | Vite installed build |
| Kurisu v56/v9 code | Separate source snapshots under `legacy/` | 27 same-relative-path v9 copies omitted where v56 bytes match exactly | v9 paths restored from `historical-duplicate-paths-workpass42.json` | Full functional/licensing review of useful adapters before integration |
| Lumina/Letta upstream archives | `legacy/input-archives/raw-source-archives/*.zip` | Two alias ZIP paths omitted | Exact ZIP aliases materializable via restoration manifest | Manual license sign-off and per-upstream semantic review |
| Other upstream project archives | `legacy/input-archives` and source archive manifests | Compact aliases and content blobs | 8,512 archive entries checked; changed historical preimages stored immutable | License review; selective deeper integrations |
| Historical project snapshot | `docs/archive-optimization/historical-snapshot-2026-10-06.manifest.json` | Shared canonical content + 8 old-version blobs | 10,427/10,427 source records verify | Full rebuild optional, ZIP container may differ |
| WorkPass documentation | Current report/task/status under `docs/` | Historical reports under `docs/history/` | 68 root reports moved unchanged; 27 exact repeated copies indexed for restore | Continue keeping one canonical current summary |
| Dependency and provenance | root/app/runtime lockfiles + `contracts/SBOM.final.json` | Source archive license notices | Lock/version roots checked; SPDX/notice evidence remains informational | Unknown nested licenses need human review |

## Canonical file layout

`docs/PROJECT_FILE_MAP_WORKPASS42.md` is the entry point. `SUPER_VERSION.json`, `CHANGELOG.md`, root `package.json`, and `Список дел.md` identify the current line. Archive materialization and path restoration are described in `docs/archive-optimization/README.md`.
