# Legacy Merge Catalog 34.52.0

| Legacy area | Decision | Reason |
|---|---|---|
| Live2D model/moc3/physics/CDI/textures | INTEGRATE | Required embodiment assets; retained under canonical runtime. |
| Live2D expressions/motions | INTEGRATE | Real avatar capability; no duplicate cognition owner. |
| Mobile 2048 texture | ADAPT | Derived resource for phone constraints; original quality asset retained. |
| Avatar/Memory Inspector UI patterns | ADAPT | Useful observability without restoring old UI runtime. |
| VoiceProsodyController | ADAPT | Useful voice-state behavior under current VoiceEmbodiment. |
| speechBreath | ADAPT | Prosody/breath pacing integrated as derived embodiment behavior. |
| speechInterrupt | ADAPT | Reworked to real TTS process interruption. |
| VoiceControls | ADAPT | Current UI/voice controls rebuilt on canonical APIs. |
| old React UI | REFERENCE | Historical UX ideas; architecture conflicts with current runtime. |
| old organism/neurocore stacks | EXCLUDE-RUNTIME | Duplicate owners and obsolete architecture. |
| old memory/world stacks | EXCLUDE-RUNTIME | Would create parallel truth stores. |
| old provider graphs | EXCLUDE-RUNTIME | Replaceable infrastructure and excessive coupling. |
| Termux doctor/start scripts | REFERENCE/ADAPT | Reuse patterns only after validation against current runtime. |
| historical research/release docs | REFERENCE | Preserve project memory without rewriting history. |
