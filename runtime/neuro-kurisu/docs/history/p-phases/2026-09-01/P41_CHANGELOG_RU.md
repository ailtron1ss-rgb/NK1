# P41 — Changelog

## 9.1.0 / P41

### Added
- `P41NativePerceptionEngine`: real local bounded signal processing for raw RGB and audio samples.
- `P41SemanticPerceptionEngine`: temporal entities, events, relations, provenance and unresolved semantic work.
- Native audio cues: RMS, zero crossing, energy bands, activity and silence.
- Native image cues: brightness, contrast, edge density, color distribution and change.
- Temporal snapshots and bounded histories.
- Active perception queue based on expected information gain / estimated cost.
- Action-relevant perception bias.
- Semantic and native perception server endpoints.
- P41 migration 43→44.
- P41 regression, integration, server and performance tests.

### Fixed
- `EmbodimentFacet` persistence now includes P41 native and semantic perception state.
- Raw media is no longer treated as semantic understanding automatically.
- P41 hot-path RGB/audio work is bounded for phone operation.
- Decision utility line in `OrganismCore` was decomposed into named contributions for maintainability.
- Capability registry now contains only real P41 capabilities.

### Explicit limitations
- P41 does not contain a human-level vision model.
- P41 does not contain a semantic speech/audio foundation model.
- Raw-signal cues are not claims of object/scene understanding.
- Real device endurance and physical embodiment remain separate verification gates.
