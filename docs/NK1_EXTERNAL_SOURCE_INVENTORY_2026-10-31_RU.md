# NK1 external source inventory — uploaded archives, 31.10.2026

Этот реестр фиксирует три архива, загруженных в текущий проект, и способ их дальнейшей интеграции. Исходники не копируются целиком в production runtime этим проходом: до точечного переноса проверяются совместимость, дублирование существующих адаптеров, размер и лицензии.

## Проверенные архивы

| Source | Supplied archive | Upstream ref from archive | SHA-256 archive | LICENSE |
|---|---|---|---|---|
| Inspect AI | inspect_ai-0.3.286.zip | 5dcbc98f86b6fd3d4a045b6ad001c6be41a10646 | 022feef01ee5a978a496cf0b1b56609e6400d7869fd7e0074d194bf3b1d57e0a | MIT |
| whisper.cpp | whisper.cpp-1.9.5.zip | d1be6fde11ac6e0407606b4e42fe72d34add8037 | 7a7a73071939f16bc028ad2f713f16f26e37afb6cc155d0f19e3d65705d2b1d9 | MIT |
| three-vrm | three-vrm-3.5.5.zip | ff42fae4fcee1fcbca2cd262c7f5f8cbddeaf5ab | 4dfc3b486fff6bebe8baae826d57c5406fc41ae77e300ee7b65ea69c8ed48984 | MIT |
| NK1 completion pack | NK1_completion_pack_2026-10-31.zip | Generated overlay pack | 7b10612a33041de6c06c820844543daac6884a311e6eeba6039ecf008e342813 | NK1 project material |

The MIT license texts were present in the three upstream archives. If any upstream code is copied into a distributed release, preserve the corresponding copyright/license notice and register the source files and hashes in NK1 release provenance. The presence of an MIT LICENSE in a downloaded archive is not a substitute for the project's own human release review and dependency/SBOM review.

## Proposed integration order

### 1. Inspect AI — external evaluator, not another NK1 runtime

Upstream: https://github.com/UKGovernmentBEIS/inspect_ai  
Docs: https://inspect.aisi.org.uk/

Use it as an independent evaluation harness for multi-turn scenarios, tool-use trajectories, refusal/abstention and observed postconditions. The first adapter should consume an immutable NK1 evidence export and produce a separate Inspect log; it must not mutate MemoryOS2, P23, the skill store or canonical runtime state.

Next technical step: define a narrow export schema and a Python task/scorer that checks event lineage, full-cycle completion and verified outcomes. Pin the external runner and test it offline with deterministic samples before adding a CI job.

### 2. whisper.cpp — optional offline speech recognition

Upstream: https://github.com/ggml-org/whisper.cpp  
The uploaded archive includes Android and WebAssembly build paths and JavaScript bindings.

Candidate use: an opt-in offline STT backend behind the existing speech provider boundary, with Android/native and browser/WASM builds kept separate. Do not place model weights in the application bundle by default. Measure Russian/English accuracy, first-token latency, peak RAM, battery/thermal load and interruption behavior on the target phone before enabling it.

### 3. three-vrm — renderer proof-of-fit, not a second avatar stack

Upstream: https://github.com/pixiv/three-vrm  
Package version: 3.5.5, package name `@pixiv/three-vrm`.

Candidate use: compare the upstream VRM loader/humanoid/expression/look-at/spring-bone behavior against NK1's existing VRM humanoid and calibration adapters. The app already has Three.js; this does not justify adding another avatar runtime automatically. Run a small compatibility prototype first, then reuse only primitives that outperform the existing path without creating duplicate ownership of rig state.

## Existing NK1 overlap

- Inspect AI can complement P23 independent skill evaluation; it must not become a second skill lifecycle or a promotion authority.
- whisper.cpp complements the speech gateway but must not create a second transcript owner or bypass speech event IDs / interruption contracts.
- three-vrm overlaps existing VRM adapters and calibration paths; preserve one canonical embodiment state.
- Mem0, Letta, Hexis and Conscio already have NK1 adapters/fabrics. Do not redownload/revendor them as a substitute for provider contract tests.

## Status

- Archive bytes, SHA-256 and LICENSE presence were inspected in the current workspace.
- This pass vendors no third-party runtime source or model weights.
- Actual upstream code adaptation, device benchmarks and human license approval remain separate steps.
