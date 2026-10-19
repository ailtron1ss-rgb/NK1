# P2842 FINAL AUDIT — Neuro Kurisu 35.18.5

Date: 2026-09-20
Base: Neuro Kurisu 35.18.4 / P2841
Release: 35.18.5
Organism core: 100.11.0-causal-calibration-active-perception-p2842
State schema: 211

## 1. Main objective

Connect the exact pre-action prediction to the verified external consequence and use repeated matched evidence to control long-term learning promotion, while measuring the actual information value of active perception without introducing a second causal subsystem.

## 2. Code implementation

### Production code
- `WorldCausalCalibration` now stores verification, independence, evidence quality and matched context provenance.
- `WorldCausalCalibration.actionReadiness()` uses accumulated history and minimum trial coverage rather than allowing one event to saturate readiness.
- `OrganismCore` exposes exact prediction tracking, grounded causal outcome recording and active-perception pending request access.
- `OrganismRuntime` links every reward prediction ticket to the causal calibrator before action, creates a coarse context key, gates external learning with both reality holdout and calibration readiness, and closes the active-perception request using observed gain after the outcome.
- `ActivePerceptionExecutor` exposes a zero-copy pending-request id accessor for hotpath use.
- `RealityGroundingController` carries a coarse context key into the external-grounding record.

### Persistence / release
- State schema: 210 -> 211.
- Release: 35.18.4 -> 35.18.5.
- Package, lockfile, release contract and manifests regenerated.
- Backward migration from schema 210 verified.

## 3. New verification tests

- `tests/p2842-causal-calibration.mjs`
  - one verified trial readiness: 0.1623
  - six repeated matched verified trials readiness: 0.9754
- `tests/p2842-active-perception-runtime.mjs`
  - full runtime step
  - external postcondition verified
  - active perception executed and measured
  - exact prediction ticket resolved
- `tests/p2842-calibration-persistence.mjs`
  - two runtime cycles
  - calibration persisted across restart
- `tests/p2842-schema-migration.mjs`
  - schema 210 -> 211

## 4. Regression verification

PASS:
- P2842 typecheck
- P2842 causal calibration
- P2842 runtime
- P2842 persistence
- P2842 migration
- P2841 postcondition
- P2841 runtime external grounding
- P2841 persistence grounding
- P2841 migration
- P2840 shadow boundary
- P2840 reality learning gate
- P2840 reality boundary
- normal organism smoke
- mobile 256 MB V8 smoke
- server smoke
- syntax audit
- forensics audit
- architecture audit
- source hygiene audit
- release contract audit
- full project audit
- integrity audit
- release-source verification
- archive manifest verification

Known limitation:
The long chained test runner can hit a process/resource timeout when many heavy historical tests are run consecutively. Individual gates pass when executed in clean processes. This is not counted as a functional PASS for the chain.

## 5. Mobile performance measurement

The mobile smoke still passes after P2842.

Before the hotpath optimization in this pass:
- elapsed ≈ 31.25 s
- peak RSS ≈ 417,948 KB

After optimization:
- elapsed ≈ 29.22 s
- peak RSS ≈ 386,928 KB

Approximate change:
- elapsed: -6.5%
- peak RSS: -7.4%

The process still exceeds a literal 256 MB physical-RAM budget even though V8 is capped at 256 MB. This remains a mobile resource debt and must not be described as a 256 MB-device certification.

## 6. Architecture status

- canonical files: 521
- source files: 1639
- cycles: 0
- legacy leakage: 0
- missing canonical files: 0
- source hygiene errors: 0
- forensic duplicate content: 0
- forensic duplicate names: 0

## 7. Code-change magnitude versus P2841

Directory comparison:
- previous archive files: 3851
- current working tree before final-report regeneration: 3861
- added paths: 10
- removed paths: 0
- modified paths: 13

Textual diff for modified code-like files:
- insertions: 223
- deletions: 63

New P2842 tests: 86 lines.
New research/release documentation: 92 lines.

The implementation remains deliberately small because the main architectural objective was to reuse existing canonical owners instead of creating duplicate causal engines.

## 8. Estimated completion

These are engineering coverage estimates against the project's full artificial-organism target, not measurements of consciousness:

- Runtime integration: 88%
- Neural substrate: 73%
- Reality grounding: 80%
- Continuous life: 85%
- Memory: 83%
- World model: 73%
- Autonomous agency: 70%
- Identity/personality: 71%
- Lifelong external learning: 52%
- Social organism: 55%
- Mobile readiness: 68%
- Causal verification: 77%
- Consciousness research readiness: 20%

Overall engineering readiness estimate: ~70/100.

## 9. Research conclusions carried forward

P2842 adopts the lightweight parts of three 2026 research directions:
1. evaluate world models by actionable downstream benefit rather than visual plausibility;
2. preserve the distinctions that matter for intervention queries;
3. treat interaction as an epistemic loop for causal hypothesis generation and continual refinement.

The project does not import heavyweight external world-model runtimes into the mobile hotpath.

## 10. Next high-value work

P2843: external action postcondition matrix by action class.
P2844: active perception policy optimization by information gain / energy / latency.
P2845: repeated causal intervention holdouts at 6/12/24 trials with matched contexts.
P2846: 1h / 6h / 24h Android endurance and restart continuity.
P2847: egocentric visual memory grounded in verified external episodes.
P2848: long-horizon world-model calibration and counterfactual recovery.
P2849: verified evidence -> autobiographical identity update path.
