# WorkPass480 — Root persistence of Hexis source lineage

**Date:** 2026-10-27

The Hexis evidence-lineage monitor is a distinct source of state from NK1's cognitive source monitor. It is persisted under `facets.advanced.hexisSourceMonitor`, deliberately avoiding an overloaded `sources` key.

Changes:
- Adds the optional typed field to `AdvancedDevelopmentFacet`.
- Provides a backward-compatible empty default for old snapshots.
- Syncs the live MemorySubsystemRuntime provenance monitor into the root persisted facet whenever OrganismCore builds its persistence projection.
- Restores from the explicit key and supports the prior nested `sourceMonitor` property for compatibility with direct runtime snapshots.

This ensures a normal root OrganismCore snapshot/checkpoint contains the same provenance lineage used for canonical-memory duplicate prevention. Passing the isolated runtime snapshot test alone is not the same as validating a complete production restart; the root projection is now explicitly wired and CI remains the validation gate.
