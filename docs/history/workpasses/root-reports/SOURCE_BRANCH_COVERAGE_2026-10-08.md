# Source branch coverage — final integration review — 2026-10-08

## WILL

The supplied `will-main` branch contains 199 TypeScript source files under `src` and 256 TypeScript test files.

### High-value capability families

| WILL family | Final status | Canonical target |
|---|---|---|
| Affordance/action competition | INTEGRATED | canonical action/agency stack + `WillIntegrationBridge` |
| Reafference/outcome learning | INTEGRATED | action outcome verification + WILL competence artifacts |
| Competence codec | INTEGRATED/ADAPTED | fingerprinted competence bundle + canonical skills remain owner |
| Conversation aims | INTEGRATED | social dossier/conversation bridge + UI |
| Known entities / aliases | INTEGRATED | canonical social/identity projections |
| Reputation | INTEGRATED | dossier trust/reputation fields |
| Access grants / revocation | ADAPTED | Lumina capability authorization + existing governance |
| PMA / fidelity | INTEGRATED | canonical persistence + WILL portable projection |
| Context budget / lossless accounting | INTEGRATED | cognitive budget + context ledger |
| External envelope / ACK / replay | INTEGRATED | WILL transport seam |
| Deterministic vector index / benchmark | INTEGRATED | optional retrieval adapter behind canonical memory |
| Record anchoring / tamper evidence | INTEGRATED | canonical audit continuity chain |
| LLM attribution | INTEGRATED | provider/model completion recording |
| MCP | INTEGRATED | canonical server adapter |
| SDK | INTEGRATED | canonical SDK facade |
| Discord / WhatsApp / channel envelopes | INTEGRATED AS ADAPTERS | ActionGateway + transport policy |
| Telegram transport envelope | INTEGRATED AS ADAPTER | channel type + explicit outbound policy |
| Deliberation cache | REFERENCE ONLY | existing cognitive budget/model ecology is deeper; no duplicate cache owner |
| Provider-specific unfinished HELM layer | NOT PROMOTED | deliberately isolated pending evidence |
| WILL neural/faculty implementations | NOT COPIED | Neuro-Kurisu neural/cognitive stack is the canonical owner |

## Lumina

The supplied `lumina-main` branch contains 81 Python modules: core 31, tools 18, communications 3, TTS 8, STT 1, UI 4, plus project/config/tests/assets.

| Lumina family | Final status | Canonical target |
|---|---|---|
| Tool risk profiles | INTEGRATED | Lumina adaptation capability policy |
| Exact lexical search | INTEGRATED | canonical memory/goal/skill projections |
| Idempotency ledger | INTEGRATED | transport/action retry seam |
| Capability confirmation | INTEGRATED | explicit outbound/execute confirmation |
| Web target SSRF policy | INTEGRATED/ADAPTED | DNS + special/private IP validation |
| Browser | ADAPTER SEAM ONLY | existing governance remains owner; Playwright worker stays optional |
| Sandbox | EXISTING EQUIVALENT KEPT | existing Neuro-Kurisu research/action sandboxes are canonical |
| Terminal | EXISTING EQUIVALENT KEPT | existing subprocess boundaries remain owner |
| Telegram/Discord bridges | ADAPTED AS CHANNEL SURFACES | canonical transport + policy; credentials are external configuration |
| TTS/STT | INTEGRATED VIA EMBODIMENT API | existing voice subsystem remains owner |
| Backends | EXISTING PROVIDER ECOLOGY KEPT | no second LLM routing owner |
| Personas | EXISTING IDENTITY OWNER KEPT | portable representation may be exported later |
| Persistence / SQLite authority | NOT COPIED | canonical persistence remains owner |
| Memory / palace / decay | ADAPTED CONCEPTUALLY | canonical MemoryFabric/MemoryOS remains owner |
| Dreaming loop | EXISTING MICRO-DREAM / DEVELOPMENT STACK KEPT | no second dream owner |
| Toolmaker | GOVERNANCE ADAPTED | existing capability/self-development promotion remains owner |
| Desktop PySide UI | NOT COPIED | active React/Live2D UI is canonical |
| Project system | EXISTING PROJECT OWNER KEPT | no duplicate project database |
| Secrets/PIN local stores | EXISTING AUTH/SECRET BOUNDARY KEPT | no duplicate credential authority |
| Rate limiting | EXISTING SERVER LIMITS KEPT | no duplicate limiter owner |

## Important conclusion

The final tree contains the useful *semantics and seams* from both branches without creating a second brain, second identity owner, second memory authority, or second policy authority.

The remaining non-promotions are deliberate: they are either already implemented more deeply in Neuro-Kurisu, require external credentials/runtime dependencies, or were unfinished/too provider-specific to justify promotion without evidence.
