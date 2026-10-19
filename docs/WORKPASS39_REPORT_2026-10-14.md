# WorkPass39 report — 2026-10-14

## Purpose
Continue from WorkPass38 and unify the existing organism rather than adding another framework. Runtime remains Neuro-Kurisu 35.61.0 / persisted schema 225. The purpose is a coherent autonomous personality architecture: body/world state, feeling, emotion, attention, memory, self-model, planning, decision, action, outcome verification and learning must exchange attributable data through existing owners. This is engineering toward the user's intended personality, not evidence of subjective consciousness.

## Implemented code changes
1. **Canonical external evidence IDs.** New evidence uses canonical serialization and SHA-256 in ExternalObserverFabric, ExternalEvidenceTrust and EvidenceFirewall; old persisted FNV-style identities are retained when matching known legacy evidence so restoring history does not mint duplicate evidence.
2. **Confidence/resource-aware workspace.** CognitiveNetworkBus uses confidence, specialist weight, attention budget and bounded energy penalty. Invalid values, unknown specialists, duplicate live specialists and duplicate restored specialists are normalized. Stale prior-cycle broadcasts do not score actions when the cognitive network is disabled.
3. **Brain map in the real application.** `CognitiveArchitectureMap` is read-only metadata for 14 systems / 22 typed flows with an explicit owner for organism state, memory, final arbiter, side effects, evidence and research promotion. It is exposed through OrganismCore, `/api/organism/cognitive-architecture`, and the Runtime Atlas Brain Architecture panel.
4. **Emotion/body → workspace → action.** The real EmotionAppraisalEngine and feeling/interoception path build an `affect` specialist signal with tendency, valence, arousal, stress, relevance, confidence, feeling intensity, body focus and interoceptive mismatch. When selected, it adds only a capped 0.035 prior to compatible action candidates. P69 remains final arbiter. Live OrganismCore test observed anxiety at arousal ~0.85 under stress and calm at ~0.19 under stable body conditions.
5. **No evidence loss in salience fusion.** Duplicate salience sources now combine novelty, surprise, confidence and source evidence before broadcast selection rather than one source replacing another.
6. **Historical provenance is reversible.** Old immutable bytes for CognitiveNetworkBus and ExternalEvidenceTrust were restored from WorkPass38 and placed in SHA-addressed blobs. Eight references were redirected away from modified current files. Four source archives verify 8,512/8,512 elements; the historical snapshot verifies 10,427 member paths and 18,935 logical content references.
7. **Safe exact-duplicate cleanup.** Consolidated shared archive blobs only after redirecting/verifying references, and replaced three duplicated historical reports with pointers to canonical files. Intentional dual-deployment assets and unique legacy source snapshots were not removed.
8. **Open-source reuse decisions.** Reviewed 15 repositories/docs. Applied patterns for scoped checkpoint vs long-term memory, pre/post tool guardrails, evidence-based evaluation, and lightweight provider boundaries without adding a second orchestrator, memory owner, or unlicensed third-party payload. Full external source downloads/byte-level license review remain blocked by outbound DNS (`EAI_AGAIN`).

## Verification results
- WorkPass39 focused runtime suite: PASS, including real cycle integration.
- Runtime TypeScript typecheck: PASS.
- Server HTTP smoke: PASS.
- Release metadata: 34/34; metadata contract: 6/6.
- App-script suite: 212/212; browser-smoke verdict: 51/51.
- Relative imports: 10 checked, none missing.
- UI/API linkage: 125 routes, 49 Runtime Atlas surfaces, required seams pass.
- Resource/Live2D audit: PASS.
- Source archive verification: 8,512/8,512; historical snapshot: 10,427 members, 18,935 logical content checks.
- Retrieval benchmark: corpus 18, train 4, holdout 8, `recallDelta=0`, injected exact/near-duplicate leakage probes do not show leakage; candidate remains **not promoted**.
- `npm ci` from app cannot fetch registry packages (`EAI_AGAIN registry.npmjs.org`); no production Vite build or installed-browser Live2D E2E is claimed.

## Progress
Implementation of this pass: **92/100**. Official weighted release roadmap remains **76.0%** (unchanged by unsupported inference/retrieval claims). The project is not release-ready while production build, interactive browser E2E, real provider/device receipt reconciliation, independent labelled retrieval evaluation, clean-room restore/rollback and soak remain open.
