# B305 Architecture Decisions

1. B305 не создаёт нового learner/personality store.
2. CriticalPathVerificationLedger — evaluation-only и не меняет policy.
3. Independent holdout uses separate task-family splits rather than another learner.
4. Termux benchmark is portable and does not claim Android results until run on Android.
5. Existing B296/B299/B302/B304 remain canonical sources of neural, personality, long-horizon and semantic learning state.
6. Signed personality biases are preserved without clamp-to-zero semantics.
