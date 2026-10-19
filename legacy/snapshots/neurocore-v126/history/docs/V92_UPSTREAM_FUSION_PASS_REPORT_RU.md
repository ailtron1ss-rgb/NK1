# V92 — Source-backed Neural Fusion Pass Report

## Goal

Shift NeuroCore from repeated reimplementation to source-backed integration wherever an existing implementation is suitable, while keeping one coherent current trunk.

## Current result

- 20 upstream candidates catalogued.
- 4 candidates have exact lazy Python import targets: FLA DeltaNet, FLA Gated DeltaNet, FLA KDA, portable Mamba-3.
- 3 major research-only repositories are explicitly isolated: official NVIDIA GDN-2, ATLAS Torch, Titans PyTorch.
- ZIP intake is reproducible and path-traversal safe.
- Current runtime does not import optional upstream libraries at startup.
- Missing upstream dependency never triggers native fallback inside `make_upstream_backend`.
- Current recurrent owner remains exactly one.

## Research basis

FLA's current main has added GDN-2, Raven, PGDN, PKDA, Mamba-3, Parallax, Wall, KDA, DeltaFormer, MoM and newer sequence/attention implementations over 2025-2026.

The official/state-spaces Mamba repository contains a Mamba-3 implementation; the portable MIT repository provides a readable PyTorch Mamba-3 with full/step/cache APIs.

## Limitation

No full third-party repository was physically copied in V92 because GitHub/PyPI download was unavailable in this execution environment. This is recorded as a limitation rather than hidden.

## Decision

No new upstream backend is marked `integrated` in V92. The infrastructure is ready for V93 once source archives are available.


## V93 continuation
The V93 source-backed layer expands the catalog to the complete current `fla.layers` export surface observed in upstream main, adds constructor introspection, and adds a non-mutating probe runner. No unavailable upstream is replaced silently.
