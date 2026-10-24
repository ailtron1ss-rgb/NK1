# Hexis → NK1: correction-to-enforcement adaptation

**Upstream:** https://github.com/hexis-framework/hexis
**License inspected:** MIT (LICENSE, Hexis Contributors, 2026).
**Reviewed:** 2026-10-24
**Status:** mechanism adapted; upstream runtime files are not copied verbatim.

## What was carried over

Hexis models a lifecycle from observed problem → soft rule → reinforced reminder → escalation after repeated violations. NK1 now has a typed correction-memory component in the learning runtime. It accepts only structured correction events that have an applied correction, a reviewer reference, a SHA-256 evidence fingerprint, and an affirmative host verifier. The stored data is compact and excludes free-form prompt/conversation text.

The escalation policy is deliberately adapted rather than transplanted unchanged:

- First reviewed correction creates a **soft rule**.
- Repeated reviewed failures caused by context pressure can create a **gate candidate** when the rule is binary and impact is high enough.
- A critical reviewed incident may request a gate review immediately.
- Ambiguous rules, instruction conflicts, and edge cases lead to rewriting or clarifying the rule rather than hardening a bad rule.
- Duplicate observation IDs are idempotent; conflicting reuse quarantines the observation.
- A gate candidate is never a live gate. It requires independent approval outside this component.

## Integration boundary

The state is part of P23LearningEngine snapshots, so it persists with the existing learning state. The verifier defaults to deny and must be configured by the trusted runtime. Raw outcome frequency is not treated as proof that a correction occurred; calls must come from a reviewed-correction path.

The upstream Hexis project currently targets Claude Code. NK1 reuses the general disposition/escalation pattern, not its Claude-specific hooks or CLI. See the upstream README and enforcement escalation design:
https://github.com/hexis-framework/hexis
https://github.com/hexis-framework/hexis/blob/main/docs/enforcement-escalation.md

No claim of subjective consciousness or automatic self-authorization follows from this integration.
