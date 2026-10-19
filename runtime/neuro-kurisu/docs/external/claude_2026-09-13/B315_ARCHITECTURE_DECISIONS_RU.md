# B315 Architecture Decisions

1. Keep B285 as canonical autobiographical/life-consolidation owner.
2. Do not create a parallel scar memory store.
3. Use bounded contextual transfer similar in spirit to existing AdaptivePolicy generalization.
4. Keep global scar and context scar separate: global protects against broad repeated failures, context scar avoids overgeneralizing one situation.
5. Keep lesion on the entire mechanism.
6. Preserve persistence at schema 127 without a schema bump because fields are additive and normalized.
