# P2613–P2626 Method Matrix

| Method | Status | Why |
|---|---|---|
| Task-ID-free prototype routing | Implemented | removes exact-task lookup shortcut |
| Specificity/abstractness-like skill utility | Implemented | filters over-specialized transfer |
| Explicit transfer abstention | Implemented | prevents forced negative transfer |
| Hierarchical latent planning | Integrated | already present; now fed by device/risk gating |
| Risk-informed world model | Implemented lightweight | risk affects action/recovery |
| Test-time residual world adaptation | Implemented | bounded closed-loop correction |
| Multi-world-model expert routing | Deferred | requires larger external benchmark |
| Dream rehearsal | Existing + retained | anti-forgetting |
| Uncertainty-calibrated replay | Partially integrated | telemetry and replay priorities; full IDER not yet |
| Goal/identity-conditioned routing | Implemented | binds skills to organism continuity |
| Device/thermal-aware scheduling | Implemented | phone-first compute degradation |
| Real Android thermal governor | Deferred | requires device measurements |
| Real sensor fault injection | Deferred | depends on external sensor adapters |
