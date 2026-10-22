# WorkPass97 — Node.js 24 migration and continual-learning retention fix

Date: 2026-10-20  
Branch: `workpass79-cognitive-rebuild`

## Changes

- Migrated all four repository workflows from `actions/checkout@v4` and `actions/setup-node@v4` to current major `@v7` actions, whose upstream release notes document the Node.js 24 action runtime.
- Standardized workflow test runtimes on Node.js 24 and changed the repository `.nvmrc` to `24`.
- Added a CI runtime contract check, cognitive-core ownership audit, and runtime smoke integration gate to the continual-learning workflow; retained typecheck, skill-learning, persistence/restart, parametric-learning, transfer-calibration, and curriculum tests.
- Fixed a continual-learning retention defect: skill `updatedAt` was refreshed only when status or validation score changed enough. Repeated fresh validation evidence could therefore leave an actively used skill looking stale and decay its action-ranking bias to zero. The skill record now refreshes when its evidence count or validation window advances.
- Added a regression test where fresh outcomes arrive but the held-out score barely changes; the skill retention timestamp must still advance.

## Verification boundary

The preceding WorkPass96 head `982615841c5ea2fd89e1ab28053b9f2df36b5817` passed its existing five-stage GitHub Actions workflow. This WorkPass97 update intentionally changes the Actions runtime and adds more gates, so that earlier pass does not verify this new head. The new head must complete the workflow before this pass is marked CI-verified.

## Remaining work

- Run the updated workflow on Node.js 24 and address any compatibility regressions.
- Expand repository-wide dependency/security update coverage beyond the currently targeted runtime path; do not auto-upgrade application dependencies without lockfile-aware validation.
- Continue validating learning against independently grounded real outcomes and longer-horizon tool/environment tasks. Synthetic fixtures prove regression behavior, not real-world learning quality.
- Full React/Vite production build, browser/mobile/Live2D end-to-end tests, real local-model evaluation, and device-level execution remain separate release gates.
