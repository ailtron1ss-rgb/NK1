# Changelog V124

## Core
- `DataGroundedTargetConfig` + `DataGroundedTarget`
- default target switched from self-generated latent to fixed data-grounded next-step target
- sparse read exposed through spine/trunk outputs
- legacy V106 compatibility tests moved to `history/tests_v106_legacy`

## Verification
- 82 current tests PASS
- executable stub scan: 0
- inert config check: PASS
- registry truthfulness: PASS
- checkpoint round-trip: 108/108
- compileall: PASS
