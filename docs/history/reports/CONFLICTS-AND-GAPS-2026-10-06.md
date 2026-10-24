# Conflicts, limits and remaining work — 2026-10-06

## Resolved in SUPER integration

- Exactly one writable organism owner: `runtime/neuro-kurisu`. The Grok browser-organism is retained only under `app/src/legacy/browser-organism/`.
- UI state is sourced from `/api/organism/ui-snapshot`; it no longer invents embedding, inner-world, reward, epistemic/value or language counters that the backend does not provide.
- Identity trait values are wired to canonical `neuralGerminalOrganismB270.traitValues`.
- Live2D uses the supplied model graph and shows an explicit unavailable state when the renderer cannot load; no procedural portrait is used as a false success path.
- Legacy visual profiles resolve only to the 32 supplied sprite-manifest assets; missing assets are reported explicitly.
- Persistence/concurrency teardown races, P36 migration drift, P38 consistency semantics and server shutdown awaiting were repaired in earlier integration passes.
- NOMEGA packaging/version drift and duplicate unreachable symbolic expert code were cleaned.
- Exact source archives, Grok `.grok` references and provenance hashes are retained under `legacy/input-archives/` and `contracts/inventory/`.

## Remaining engineering constraints

- `app/node_modules` is intentionally not shipped. A clean Vite/TypeScript production build requires installing the dependencies from `app/package-lock.json` in a normal networked/CI environment.
- Camera, microphone, Gemini and Kobold are external capabilities. Their absence is reported as unavailable/degraded; the project does not fabricate hardware or LLM success.
- Research candidates (NeuroCore V143, NOMEGA Pass20, DeepCode v21) are connected through a read-only qualification bridge. Automatic promotion into the canonical runtime is disabled by design.

## Current structural policy

- `runtime/` = production cognitive runtime and writable state ownership.
- `app/` = delivery/UI shell, adapters and visual surfaces.
- `research/` = candidate engines and evidence-producing experiments.
- `legacy/` = immutable history/provenance.
- `contracts/` + `docs/` + `tools/` = navigation, ownership, inventory and repeatable audits.

## Not claims

Project metrics are engineering measurements. They do not establish consciousness, sentience or personhood.
