# B276 Release Notes

B276 introduces hierarchical latent action-program synthesis on top of B275 neural compositional policy.

## Main changes

- new `B276LatentActionProgramSynthesizer`;
- latent program nodes and child links;
- neural/self/world/goal/personality grounding;
- independent verification and rejection;
- new-context transfer;
- Core integration;
- persistence and migration;
- standalone, independent, Core and migration tests;
- release commands and evidence.

## Important limitation

Primitive ActionKind remain fixed. B276 therefore demonstrates open-ended composition at the program level, not invention of new low-level motor primitives.
