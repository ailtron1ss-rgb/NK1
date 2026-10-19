# B312 Release Notes

- Added `B312ExecutiveDecisionHandoff`.
- Added verified policy -> final action handoff.
- Added safety/user-request/lesion barriers.
- Added confirmation vs promotion metrics.
- Strengthened bounded neighbor policy transfer.
- Added migration test and live OrganismCore handoff test.
- Removed temporary debug tests from release tree.
- No duplicate policy learner introduced.

## Final release verification addendum

Release candidate rechecked after all B312 code and documentation changes.

Static/structural: architecture PASS; integrity PASS; forensics PASS (0 duplicate content, 0 duplicate names, 0 stale markers); hygiene 0/0; contract PASS; syntax PASS; release-source PASS; UI smoke PASS; server smoke PASS.

Functional: B312 standalone/live/migration PASS; B311/B310/B306/B305/B298 isolated regressions PASS.

Important non-claim: the short natural whole-organism baseline/trained comparison remained 6 explore / 2 verify in both branches. B312 therefore does not claim a natural distribution shift or P6 closure.
