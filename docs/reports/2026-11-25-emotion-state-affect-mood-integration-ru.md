# NeuroCore / NK1 — Emotion and State Integration

**Date:** 2026-11-25  
**Aspect branch:** `aspect/affect-history-aggregate-reconciliation-20261119`  
**Base:** `workpass70-source`  
**Work type:** integration patch; draft PR only.

## Audit result

The canonical `workpass70-source` snapshot did not contain the prior chat's canonical `EmotionAffectFrameV1` projection or the slow mood/recovery state. The current aspect branch already held the P66 elapsed-time regulation work and its provenance-aware Core call sites. That P66 work was retained rather than overwritten.

The branch's P66 path already provides elapsed-time EMA and recovery debt, stable-duration accounting, observation-source diagnostics, duplicate-sample suppression and rejection of future/out-of-order samples. This integration keeps those exact behaviors.

## Changes added on top

- `EmotionAppraisalEngine` now owns a persistent slow `AffectMoodState`, separate from acute `EmotionEpisode` and `FeelingEpisode`.
- Mood changes are bounded and time-decayed. Body/interoceptive observations update the slow channels; recovery is measured from the change in normalized mood deviation. The resilience score is an internal estimate with explicit evidence confidence, not a medical or empirical psychometric measure.
- `projectEmotionAffectFrame()` produces a single revision-bound `EmotionAffectFrameV1` used by runtime, API, voice and avatar.
- Action-outcome aliases are migrated into one canonical action vocabulary; calibration merges are attempt-weighted and counters bounded.
- Acute episode decay and slow mood decay are now independent in `actionBias()`: the 60-second freshness horizon scales only the acute tendency; P66 pressure, admitted outcome calibration and the evidence-gated mood prior retain their own context/freshness horizons. The final signed prior remains confidence/attention gated and capped at ±0.045.
- Added five paired mood-vs-neutral scenarios with identical acute episode and calibration. The test requires a small persistent rest increase and exploration decrease after 15 minutes, reduced mood contribution after 24 hours, and no mood effect when event/interoceptive evidence is zero. This is a deterministic causal contract test, not measured behavioral uplift.
- OrganismCore passes the cognitive observation timestamp into the affect engine while retaining the P66 provenance work already on the branch.
- Runtime and server compute the affect frame once. Legacy emotion fields are projected from the same frame.
- AvatarBrain validates state revision, time and freshness, applies only a low-weight mood contribution, avoids double decay and fails stale revisions closed.
- UI normalization validates acute affect independently from slow mood. Legacy tendency values remain representable. Avatar stage and renderer-neutral body bridge use the same freshness-checked presentation resolver.
- Added focused runtime and app regression tests, strict targeted app TypeScript configuration, and a combined Actions workflow.

## Validation evidence

### Previously executed local checks on the archive-derived worktree

- Runtime TypeScript check: PASS.
- Mood dynamics and recovery test: PASS.
- P66 dense/sparse cadence parity (61 vs 7 observations over 60 s): PASS; stress and recovery-debt values equal within floating precision.
- P66 duplicate, out-of-order and far-future input boundaries: PASS.
- Canonical affect frame / avatar lineage: PASS.
- P66 hysteresis state consistency: PASS.
- App targeted TypeScript check: PASS.
- App affect normalize/presentation/body bridge integration: PASS; embodiment bridge 17/17 and browser voice prosody 6/6.

These local runs were on a separate archive-derived checkout whose original base SHA was `615ffda7958273fed97aa809d374d8812eabed0a`; they do not substitute for CI on this updated branch.

### Required remote confirmation

- At PR head `6efe9624edd86d398d75b53010bb790f64f04b5f`, exact-head Actions passed: P66 temporal regulation, Core provenance, emotion/interoception, P66→P68, runtime voice-context, app affect-frame integration, and Emotion Restore Integrity. WorkPass79 cognitive runtime regression also completed successfully.
- The mood/acute-prior separation and five-seed paired regression were added afterward at `769afdaf0b3c31eba6baa8b47faaf0ab172c540e`. Its exact-head reruns are pending/queued at report time; therefore the new paired result is not yet claimed as remotely verified.

## Explicit boundaries

- No release ZIP was changed or published.
- No production release or merge into `workpass70-source` is claimed.
- No consciousness claim is made.
- No Android device, acoustic playback, or long-duration renderer soak is claimed.
