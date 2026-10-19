# LEGACY MERGE CATALOG — 34.50.0

| Legacy asset | Decision | Rationale |
|---|---|---|
| Live2D model/moc3/physics/CDI | INTEGRATE | required embodiment |
| quality texture | INTEGRATE | full-fidelity profile |
| mobile texture | ADAPT/DERIVE | mobile GPU/storage efficiency |
| VoiceProsodyController | ADAPT | useful mechanism, stale dependencies |
| speechBreath | ADAPT | concept useful in VoiceEmbodiment |
| speechInterrupt | ADAPT | upgraded to real process interruption |
| voiceConversation | REFERENCE | old orchestration conflicts with canonical runtime |
| VoiceControls | ADAPT | UI ideas reusable without old React runtime |
| old organism cores | EXCLUDE-RUNTIME | duplicate cognition/truth |
