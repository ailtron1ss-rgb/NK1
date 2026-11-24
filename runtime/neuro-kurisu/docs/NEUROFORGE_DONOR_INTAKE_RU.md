# NeuroForge — donor intake and capability analysis

## Purpose

NeuroForge is NK1's offline donor-source intake tool. It inventories source projects, records content fingerprints and license evidence, detects dependency/import/security signals, compares donor capability signals with the scanned NK1 source tree, and emits reviewable integration proposals.

It extends the archived NOMEGA Pass20 Capability Forge research with a separate software-source assimilation path. It does not replace P23 learning, MemoryOS2, CapabilityRegistry, ActionGateway, or the existing candidate-promotion pipeline.

## Run

From `runtime/neuro-kurisu`:

```bash
npm run neuroforge -- analyze \
  --baseline ./src \
  --donors /path/to/01_ORIGINALS \
  --out ./artifacts/neuroforge
```

The donor path may point to one project or a folder containing one folder per donor. The command performs no network requests and does not execute donor programs.

## Outputs

- `baseline.manifest.json`: deterministic inventory fingerprint and source signals for the selected NK1 baseline.
- `donors/*.manifest.json`: donor files, hashes, languages, dependencies, imports, Git origin/commit provenance when available, license evidence, notices, possible credential paths, and capability signals.
- `neuroforge-report.json`: donor-versus-baseline gap analysis and blocked proposals.
- `proposals/*.md`: review packet per donor.
- `summary.md`: concise analysis summary.

## Safety and evidence boundaries

- Source files are hashed and sampled locally; their contents are not copied to the report.
- Credential-like files are reported by path and finding kind only; detected values are never emitted.
- Symlinks and common generated/dependency directories are skipped.
- File-count, file-size, total-size, depth, and text-sample limits are enforced before and during bounded reads. Symlinks are recorded as skipped, and incomplete inventories block promotion.
- Git provenance is read locally from a real `.git` directory (including a bounded ancestor lookup); the exact HEAD commit and sanitized `origin` URL are recorded. No Git command, network request, credential-bearing URL, or arbitrary worktree pointer is followed. Missing, invalid, or external-worktree metadata remains explicitly unpinned.
- The SPDX guess from a LICENSE file is evidence only. It does not establish legal permission for the whole repository, nested projects, dependencies, models, or assets.
- No donor source is executed, installed, copied, or promoted.
- All proposals remain blocked pending exact upstream revision, human legal clearance, dependency/license review, security review, isolated reproduction, behavioral benchmark, independent holdout, exact-head CI, and release parity.
- Capability signals now carry an explicit evidence level: implementation, content-only, example/test, or configuration-only. Only path-anchored implementation evidence can produce integration proposals.
- Model-serving is distinct from model-provider adapters; an Ollama/OpenAI-compatible client is not an inference server.
- Tests are retained as path-only supporting evidence; their bodies are not retained in the capability corpus. Source samples are bounded to 8 KiB by default.
- Manifest and analysis report schema version is 2. Security findings carry a severity and never emit secret values.
- Capability matches are deterministic heuristics, not semantic proof that a capability works or is better than NK1.

## Current scope

This is a working offline intake, provenance, capability-gap, and proposal-generation engine. It is not yet an automatic source-code porting model or GitHub PR generator. Those require a separately reviewed model-provider adapter and isolated execution environment; neither is allowed to bypass the evidence gates above.
