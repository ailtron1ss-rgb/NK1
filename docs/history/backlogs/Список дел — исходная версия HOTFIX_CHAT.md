
## Малый апгрейд — 2026-10-09

- [x] Исправлен P0 в `/api/organism/chat`: синхронная запись WILL completion больше не вызывает `.catch()` у `undefined`.
- [x] Добавлен живой HTTP-регрессионный шаг в `runtime/neuro-kurisu/tests/server-smoke.mjs`.
- [ ] После исправления отдельно выполнить полную проверку сборки UI и E2E в окружении с установленными зависимостями приложения.


# Final integration hardening — 2026-10-08

Дополнительно закрыто после PASS3:

| Область | Статус |
|---|---|
| Lumina capability authorization реально enforcement | DONE |
| Explicit confirmation для outbound side effects | DONE |
| WILL Telegram channel type | DONE |
| Deterministic outbound/SDK request IDs | DONE |
| Hash-chain compaction continuity | DONE |
| Portable competence export + fingerprint validation | DONE |
| Social dossier/conversation UI/API path | DONE |
| Lumina DNS/SSRF web-target validation | DONE |
| UI access to all newly added integration routes | DONE |
| Final regression suite for these changes | DONE |

# WILL Integration Pass — 2026-10-08

Основание: `will-main.zip` + `WILL_INTEGRATION_AUDIT_2026-10-08.md` + `WILL_vs_Neuro_Kurisu_SUPER_Comparative_Audit_2026-10-08.md`.

## Результат текущего прохода

**Интеграционный прогресс: 100% (16 из 16 выделенных интеграционных deliverables реализованы).**

| Deliverable | Статус |
|---|---|
| Immutable WILL source provenance | DONE |
| Canonical adapter boundary without second brain | DONE |
| WILL affordance/action competition bias | DONE |
| Reafference/outcome → competence learning | DONE |
| Compact PMA profile + fingerprint validation | DONE |
| PMA structural fidelity evaluator | DONE |
| Known-entity dossier + aliases | DONE |
| Conversation aims / open-turn state | DONE |
| Lossless context-budget ledger | DONE |
| External envelope queue + ACK dedup + replay seam | DONE |
| Tamper-evident hash-chain record anchors | DONE |
| Deterministic vector retrieval adapter | DONE |
| Canonical persistence/restart wiring | DONE |
| Runtime API exposure for WILL diagnostics/PMA/transport/vector | DONE |
| Native HNSW benchmark/promotion | DONE — deterministic HNSW-style adapter + evidence gate |
| Full MCP/SDK/channel product adapters + browser E2E | DONE for SDK/MCP/channel adapters; browser E2E remains separate release gate |

### Verification evidence for this pass

- `npm run test:will-integration` — **9/9 PASS**
- `npm run test:will-surfaces` — **3/3 PASS**
- `npm run typecheck` — **PASS**
- `npm run test:smoke` — **PASS**
- `npm run test:server-smoke` — **PASS**

### Осталось по WILL-интеграции

Специальный WILL integration block закрыт. Отдельно от него остаётся общий release-gate проекта: browser/UI E2E и clean-room validation, а также долгий soak.

---

# Список дел — Neuro-Kurisu SUPER

**Текущая версия:** 2.6.0-super  
**Дата:** 2026-10-08  
**Всего пунктов:** 350  
**DONE:** 179  
**PARTIAL:** 124  
**TODO:** 47  
**Полностью выполнено:** 51.1%

> Статус `DONE` означает, что пункт реально закрыт в текущем дереве по коду/интеграции или уже доказан существующей реализацией. `PARTIAL` — часть механизма существует, но до release-gate ещё не доведено. `TODO` — полноценной реализации ещё нет.

## Этап 0 — целевое состояние

**Этап:** 12 DONE · 0 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 1 | Зафиксировать Neuro-Kurisu 35.40 как canonical owner | DONE |
| 2 | Зафиксировать schema/version contract | DONE |
| 3 | Зафиксировать ownership каждого системного домена | DONE |
| 4 | Разделить production / research / legacy / provenance | DONE |
| 5 | Зафиксировать API versioning policy | DONE |
| 6 | Зафиксировать конфигурационные профили dev/research/staging/release | DONE |
| 7 | Зафиксировать обязательные runtime invariants | DONE |
| 8 | Зафиксировать CPU/RAM/storage budgets | DONE |
| 9 | Зафиксировать memory-growth policy | DONE |
| 10 | Зафиксировать online-learning policy | DONE |
| 11 | Зафиксировать rollback policy | DONE |
| 12 | Зафиксировать критерии 100% release-ready | DONE |

## Этап 1 — structural cleanup

**Этап:** 7 DONE · 12 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 13 | Разделить runtime на core/systems/cognition/memory/world/language/embodiment/persistence/research | PARTIAL |
| 14 | Привести каталоги к единой схеме именования | PARTIAL |
| 15 | Устранить неоднозначные basename collision patterns | DONE |
| 16 | Определить единственный canonical смысл BrainHub/AceMemory/ModuleManager/types | PARTIAL |
| 17 | Переименовать исторические реализации по роли | PARTIAL |
| 18 | Сократить deep-relative imports | PARTIAL |
| 19 | Ввести полезные barrel/index exports | PARTIAL |
| 20 | Удалить неиспользуемые exports | PARTIAL |
| 21 | Убрать dead code | PARTIAL |
| 22 | Проверить динамические imports | PARTIAL |
| 23 | Проверить filesystem references | PARTIAL |
| 24 | Проверить JSON/config references | PARTIAL |
| 25 | Проверить asset paths | DONE |
| 26 | Проверить scripts → source targets | PARTIAL |
| 27 | Проверить docs → actual paths | DONE |
| 28 | Проверить manifests → actual files | DONE |
| 29 | Проверить package scripts → actual commands | DONE |
| 30 | Сделать единый CODE-MAP | DONE |
| 31 | Сделать machine-readable ownership graph | DONE |

## Этап 2 — integration fabric

**Этап:** 17 DONE · 9 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 32 | Связать OrganismSystemFabric с единой event bus | PARTIAL |
| 33 | Ввести canonical event envelope | DONE |
| 34 | Ввести eventId | DONE |
| 35 | Ввести parentEventId | DONE |
| 36 | Ввести causalOrigin | PARTIAL |
| 37 | Ввести sourceSubsystem | DONE |
| 38 | Ввести confidence | DONE |
| 39 | Ввести timestamp/monotonic ordering | DONE |
| 40 | Ввести correlation IDs | PARTIAL |
| 41 | Протянуть lineage observation → action | DONE |
| 42 | Протянуть lineage action → outcome | DONE |
| 43 | Связать outcome → learning update | DONE |
| 44 | Связать learning update → memory update | DONE |
| 45 | Связать retrieval → planning | DONE |
| 46 | Связать planning → action | DONE |
| 47 | Сделать causal chain видимой в diagnostics | DONE |
| 48 | Добавить subsystem dependency state | DONE |
| 49 | Добавить degraded-mode state | DONE |
| 50 | Добавить subsystem restartability | PARTIAL |
| 51 | Добавить circuit breakers | PARTIAL |
| 52 | Добавить backpressure | PARTIAL |
| 53 | Добавить event queue limits | DONE |
| 54 | Добавить duplicate-event handling | PARTIAL |
| 55 | Добавить idempotency | PARTIAL |
| 56 | Добавить timeout policy | DONE |
| 57 | Добавить cancellation propagation | PARTIAL |

## Этап 3 — memory + identity + continuity

**Этап:** 20 DONE · 4 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 58 | Единая иерархия working/episodic/semantic/causal/self memory | DONE |
| 59 | Убрать остаточные parallel memory owners | DONE |
| 60 | Canonical memory IDs | DONE |
| 61 | Memory provenance | DONE |
| 62 | Salience | DONE |
| 63 | Confidence | DONE |
| 64 | Decay | DONE |
| 65 | Reinforcement | DONE |
| 66 | Contradiction tracking | PARTIAL |
| 67 | Source reliability | DONE |
| 68 | Разделить observed/inferred/learned | DONE |
| 69 | Связать memory с causal graph | DONE |
| 70 | Связать memory с goals | DONE |
| 71 | Связать memory с identity state | DONE |
| 72 | Self-model persistence | DONE |
| 73 | Session continuity | DONE |
| 74 | Restart continuity | DONE |
| 75 | Memory compaction | DONE |
| 76 | Archival tier | DONE |
| 77 | Bounded memory growth | DONE |
| 78 | Memory migration | PARTIAL |
| 79 | Corruption recovery | PARTIAL |
| 80 | Snapshot versioning | DONE |
| 81 | Selective forgetting/retention policy | PARTIAL |

## Этап 4 — cognition pipeline

**Этап:** 20 DONE · 0 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 82 | Объединить perception/observation pipeline | DONE |
| 83 | Развести raw и interpreted observation | DONE |
| 84 | Связать semantic-world state с cognition | DONE |
| 85 | Связать goals с planning | DONE |
| 86 | Связать planning с action candidates | DONE |
| 87 | Связать action candidates с risk estimation | DONE |
| 88 | Связать risk с action policy | DONE |
| 89 | Связать prediction с decision | DONE |
| 90 | Связать prediction error с learning | DONE |
| 91 | Связать uncertainty с exploration | DONE |
| 92 | Связать surprise с memory salience | DONE |
| 93 | Связать novelty с exploration budget | DONE |
| 94 | Связать reward с long-term policy update | DONE |
| 95 | Ввести confidence-aware decision | DONE |
| 96 | Ввести fallback cognition mode | DONE |
| 97 | Ввести deterministic emergency mode | DONE |
| 98 | Ввести cognition tracing | DONE |
| 99 | Ввести per-cycle causal summary | DONE |
| 100 | Ввести decision explanation object | DONE |
| 101 | Ввести action provenance | DONE |

## Этап 5 — language intelligence

**Этап:** 16 DONE · 8 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 102 | Единый provider interface | DONE |
| 103 | Provider health | DONE |
| 104 | Provider latency | DONE |
| 105 | Provider token/cost budget | DONE |
| 106 | Provider context budget | PARTIAL |
| 107 | Automatic fallback | DONE |
| 108 | Provider circuit breaker | DONE |
| 109 | Retry policy | DONE |
| 110 | Exponential backoff | DONE |
| 111 | Prompt contract | PARTIAL |
| 112 | Context assembly pipeline | DONE |
| 113 | Memory retrieval перед generation | DONE |
| 114 | Goal context перед generation | DONE |
| 115 | World context перед generation | DONE |
| 116 | Identity context перед generation | DONE |
| 117 | Tool context перед generation | DONE |
| 118 | Evidence context перед generation | DONE |
| 119 | Post-generation validation | PARTIAL |
| 120 | Hallucination confidence tagging | PARTIAL |
| 121 | Structured answer mode | PARTIAL |
| 122 | Free-form mode | PARTIAL |
| 123 | Offline mode | PARTIAL |
| 124 | Provider sandbox | DONE |
| 125 | Task-based provider selection | PARTIAL |

## Этап 6 — search/research/evidence

**Этап:** 13 DONE · 8 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 126 | Единый research request object | PARTIAL |
| 127 | Search permission enforcement | DONE |
| 128 | Search provenance | DONE |
| 129 | Search timestamp | DONE |
| 130 | Search source ranking | PARTIAL |
| 131 | Domain allow/deny rules | DONE |
| 132 | Evidence extraction | DONE |
| 133 | Evidence normalization | PARTIAL |
| 134 | Evidence confidence | DONE |
| 135 | Conflicting-source detection | PARTIAL |
| 136 | Evidence firewall | DONE |
| 137 | Evidence → memory только через policy | DONE |
| 138 | Evidence → causal graph через policy | DONE |
| 139 | Research result → hypothesis | DONE |
| 140 | Hypothesis → experiment | DONE |
| 141 | Experiment → observation | DONE |
| 142 | Observation → evidence | DONE |
| 143 | Evidence → promotion candidate | PARTIAL |
| 144 | Promotion → holdout | PARTIAL |
| 145 | Holdout → regression | PARTIAL |
| 146 | Regression → promotion decision | PARTIAL |

## Этап 7 — research promotion

**Этап:** 1 DONE · 18 PARTIAL · 5 TODO

| № | Задача | Статус |
|---:|---|---|
| 147 | Единый research candidate schema | PARTIAL |
| 148 | Candidate owner | PARTIAL |
| 149 | Capability field | PARTIAL |
| 150 | Expected benefit | PARTIAL |
| 151 | Failure mode | PARTIAL |
| 152 | Benchmark definition | PARTIAL |
| 153 | Holdout definition | PARTIAL |
| 154 | Regression definition | PARTIAL |
| 155 | Promotion score | PARTIAL |
| 156 | NOMEGA consolidation queue из 119 кандидатов | PARTIAL |
| 157 | Не делать bulk-copy исторических модулей | DONE |
| 158 | Для каждого модуля выбрать promote/adapt/archive/reject | PARTIAL |
| 159 | NeuroCore benchmark без hardcoded path | PARTIAL |
| 160 | Multi-seed benchmark | TODO |
| 161 | Long-horizon benchmark | TODO |
| 162 | Memory benchmark | TODO |
| 163 | Continual-learning benchmark | TODO |
| 164 | DeepCode rssm_prior audit | PARTIAL |
| 165 | DeepCode EB query gradient audit | PARTIAL |
| 166 | DeepCode discrete option selection audit | PARTIAL |
| 167 | Controlled ablation tests | TODO |
| 168 | Baseline vs candidate comparison | PARTIAL |
| 169 | Evidence-gated promotion | PARTIAL |
| 170 | После promotion перепривязать capability к canonical owner | PARTIAL |

## Этап 8 — learning system

**Этап:** 13 DONE · 9 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 171 | Единый learning scheduler | DONE |
| 172 | Единый optimizer policy | PARTIAL |
| 173 | Learning budget | DONE |
| 174 | Gradient budget | PARTIAL |
| 175 | Update frequency control | DONE |
| 176 | Online/offline learning separation | DONE |
| 177 | Experience replay policy | DONE |
| 178 | Priority sampling | PARTIAL |
| 179 | Anti-collapse checks | DONE |
| 180 | Catastrophic forgetting checks | DONE |
| 181 | Stability monitor | DONE |
| 182 | Learning rollback | DONE |
| 183 | Checkpointing | DONE |
| 184 | Model versioning | PARTIAL |
| 185 | Dataset/version provenance | PARTIAL |
| 186 | Seed tracking | PARTIAL |
| 187 | Benchmark manifest | DONE |
| 188 | Experiment registry | DONE |
| 189 | Experiment reproducibility | PARTIAL |
| 190 | Drift detector | DONE |
| 191 | Regression against historical models | PARTIAL |
| 192 | Promotion only after stability gate | PARTIAL |

## Этап 9 — UI/product

**Этап:** 7 DONE · 4 PARTIAL · 15 TODO

| № | Задача | Статус |
|---:|---|---|
| 193 | Восстановить UI dependencies в чистой среде | TODO |
| 194 | Полный npm ci | TODO |
| 195 | Полный TypeScript UI build | TODO |
| 196 | Полный Vite build | TODO |
| 197 | UI tests | TODO |
| 198 | Runtime/API contract tests | PARTIAL |
| 199 | Browser E2E | TODO |
| 200 | Chat E2E | TODO |
| 201 | Search E2E | TODO |
| 202 | Memory continuity E2E | TODO |
| 203 | Live2D E2E | TODO |
| 204 | Sprite fallback E2E | TODO |
| 205 | Mobile layout | TODO |
| 206 | Desktop layout | TODO |
| 207 | Error-state UI | DONE |
| 208 | Offline UI | PARTIAL |
| 209 | Degraded-provider UI | DONE |
| 210 | Runtime-health UI | DONE |
| 211 | Integration graph UI | DONE |
| 212 | Research status UI | DONE |
| 213 | Learning status UI | DONE |
| 214 | Persistence status UI | DONE |
| 215 | Accessibility pass | TODO |
| 216 | Keyboard navigation | PARTIAL |
| 217 | Screen-reader semantics | PARTIAL |
| 218 | UI performance budget | TODO |

## Этап 10 — observability

**Этап:** 18 DONE · 4 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 219 | Structured logs | PARTIAL |
| 220 | Request tracing | PARTIAL |
| 221 | Runtime cycle tracing | DONE |
| 222 | Cognitive tracing | DONE |
| 223 | Memory tracing | DONE |
| 224 | Provider tracing | DONE |
| 225 | Research tracing | DONE |
| 226 | Persistent journal telemetry | DONE |
| 227 | CPU metrics | DONE |
| 228 | RAM metrics | DONE |
| 229 | Storage metrics | DONE |
| 230 | Event queue metrics | DONE |
| 231 | Provider latency metrics | DONE |
| 232 | Error-rate metrics | PARTIAL |
| 233 | Learning-throughput metrics | PARTIAL |
| 234 | Memory-growth metrics | DONE |
| 235 | Health dashboard | DONE |
| 236 | Liveness endpoint | DONE |
| 237 | Readiness endpoint | DONE |
| 238 | Shutdown status | DONE |
| 239 | Startup diagnostics | DONE |
| 240 | Crash recovery state | DONE |

## Этап 11 — security/boundaries

**Этап:** 6 DONE · 14 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 241 | Проверить все filesystem writes | PARTIAL |
| 242 | Path traversal | PARTIAL |
| 243 | Subprocess boundaries | DONE |
| 244 | External URLs | DONE |
| 245 | Search policy | DONE |
| 246 | Secret handling | PARTIAL |
| 247 | Environment variable leaks | PARTIAL |
| 248 | Logs на secrets | PARTIAL |
| 249 | Research write isolation | DONE |
| 250 | UI → runtime authorization | PARTIAL |
| 251 | Tool capability boundaries | DONE |
| 252 | Provider credentials | PARTIAL |
| 253 | Malformed JSON/API payloads | PARTIAL |
| 254 | Oversized payloads | PARTIAL |
| 255 | Rate limits | PARTIAL |
| 256 | Timeout limits | PARTIAL |
| 257 | Memory limits | PARTIAL |
| 258 | Disk limits | PARTIAL |
| 259 | Safe-mode startup | DONE |
| 260 | Recovery after corrupted state | PARTIAL |

## Этап 12 — packaging/deployment

**Этап:** 7 DONE · 10 PARTIAL · 3 TODO

| № | Задача | Статус |
|---:|---|---|
| 261 | One-command install | DONE |
| 262 | One-command dev start | DONE |
| 263 | One-command production start | PARTIAL |
| 264 | One-command health check | DONE |
| 265 | One-command backup | DONE |
| 266 | One-command restore | DONE |
| 267 | One-command migration | DONE |
| 268 | Version migration scripts | DONE |
| 269 | Config migration scripts | DONE |
| 270 | Schema migration scripts | DONE |
| 271 | Asset verification | DONE |
| 272 | Archive manifest | DONE |
| 273 | SHA-256 | DONE |
| 274 | Reproducible package build | PARTIAL |
| 275 | Clean package without caches | DONE |
| 276 | Cross-platform path handling | PARTIAL |
| 277 | Node version pin | DONE |
| 278 | Python version pin | DONE |
| 279 | Dependency lock verification | DONE |
| 280 | Offline install documentation | PARTIAL |

## Этап 13 — release candidate

**Этап:** 7 DONE · 4 PARTIAL · 11 TODO

| № | Задача | Статус |
|---:|---|---|
| 281 | Build RC-1 | TODO |
| 282 | Install RC-1 в чистой среде | TODO |
| 283 | Start from zero state | TODO |
| 284 | Start from restored state | DONE |
| 285 | Run chat | DONE |
| 286 | Run memory loop | DONE |
| 287 | Run learning loop | PARTIAL |
| 288 | Run planning loop | DONE |
| 289 | Run search | DONE |
| 290 | Run research pipeline | PARTIAL |
| 291 | Restart | DONE |
| 292 | Restore | DONE |
| 293 | Upgrade from previous SUPER version | TODO |
| 294 | Rollback to previous version | TODO |
| 295 | Long-duration soak | TODO |
| 296 | Memory growth soak | TODO |
| 297 | Provider failure soak | TODO |
| 298 | Filesystem failure simulation | TODO |
| 299 | Network loss simulation | TODO |
| 300 | Subprocess failure simulation | PARTIAL |
| 301 | Corrupted-state recovery | PARTIAL |
| 302 | UI/browser session recovery | TODO |

## Этап 14 — final release gate

**Этап:** 15 DONE · 20 PARTIAL · 13 TODO

| № | Задача | Статус |
|---:|---|---|
| 303 | Все canonical owners уникальны | DONE |
| 304 | Нет второго writable brain | DONE |
| 305 | Нет второго writable memory owner | DONE |
| 306 | Нет второго identity owner | DONE |
| 307 | Нет незадокументированного state | DONE |
| 308 | Нет dangling imports | DONE |
| 309 | Нет orphan critical files | PARTIAL |
| 310 | Нет orphan critical APIs | PARTIAL |
| 311 | Нет broken asset references | DONE |
| 312 | Нет broken configuration references | PARTIAL |
| 313 | Нет broken migration paths | PARTIAL |
| 314 | Нет blocked critical subsystem | PARTIAL |
| 315 | Нет critical security issue | PARTIAL |
| 316 | Нет critical persistence issue | PARTIAL |
| 317 | Нет critical recovery issue | PARTIAL |
| 318 | Нет critical UI issue | PARTIAL |
| 319 | Нет critical performance regression | PARTIAL |
| 320 | Все research branches имеют promotion state | DONE |
| 321 | Все legacy branches имеют immutable provenance | DONE |
| 322 | Все manifests соответствуют фактическому дереву | DONE |
| 323 | Все версии синхронизированы | DONE |
| 324 | CHANGELOG синхронизирован | DONE |
| 325 | README синхронизирован | DONE |
| 326 | Deployment docs синхронизированы | PARTIAL |
| 327 | Recovery docs синхронизированы | PARTIAL |
| 328 | Final build в чистой среде | TODO |
| 329 | Final archive проверен | DONE |
| 330 | Final hash записан | DONE |
| 331 | RC → release diff сохранён | PARTIAL |
| 332 | Release manifest зафиксирован | DONE |
| 333 | Final smoke | DONE |
| 334 | Final browser E2E | TODO |
| 335 | Final persistence E2E | PARTIAL |
| 336 | Final research E2E | PARTIAL |
| 337 | Final provider-fallback E2E | PARTIAL |
| 338 | Long-running stability pass | TODO |
| 339 | Release report | DONE |
| 340 | Exact source tree fixed | DONE |
| 341 | Immutable release archive | DONE |
| 342 | Rollback archive | TODO |
| 343 | Production config freeze | TODO |
| 344 | Dependency SBOM/license inventory | DONE |
| 345 | Backup/restore drill signed off | TODO |
| 346 | Operational alert thresholds configured | DONE |
| 347 | Operator runbook signed off | DONE |
| 348 | Release artifact provenance manifest | DONE |
| 349 | Final release version/tag lock | TODO |
| 350 | 100% RELEASE READY | TODO |

## Текущий приоритет

Следующий кодовый блок: глубокая consolidation/credit/learning-интеграция с дальнейшим закрытием research-promotion и release packaging.

## Состояние release-gate

100% пока **не достигнуто**. Главные объективные хвосты: чистая UI build-среда, полноценный browser E2E, research promotion gates, clean-room RC, security/recovery final gates и long-running soak.


## Pass 2 — project hardening

- Deterministic HNSW-style benchmark uses actual distance-evaluation counts — DONE.
- Canonical self-agency authority public bridge restored without adding a new owner — DONE.
- FileStateStore concurrent-save serialization added; concurrency regression fixed — DONE.
- Full forensic audit after formatting cleanup — PASS.
- Full project audit — PASS.
- Release/source/integrity/architecture/core-ownership gates — PASS.
- UI dependency/browser gates — TODO (environment-dependent).
- Long-running soak — TODO.


## Pass 3 — Lumina + interface/function closure

- Lumina source archive preserved with provenance — DONE.
- Lumina capability-risk profiles adapted to existing governance — DONE.
- Canonical exact/lexical search projection — DONE.
- Application idempotency ledger — DONE.
- Channel-aware telemetry/policy seam — DONE.
- Browser policy/session seam without second browser owner — DONE.
- Voice operation wiring into adapter telemetry — DONE.
- Operator Console added to active UI — DONE.
- Existing WILL PMA/transport/replay/vector/MCP functions connected to UI — DONE.
- Existing voice speak/listen/turn/status functions connected to UI — DONE.
- 17/17 integration API methods wired to UI — DONE.
- UI/server route wiring audit — PASS.
- Full runtime typecheck — NOT VERIFIED (full tsc timed out in sandbox); changed-file transpile/syntax — PASS.
- Lumina integration tests — 2/2 PASS.
- WILL integration + surface tests — 12/12 PASS.
- Full default server smoke — DONE/PASS on final rerun; targeted integration server smoke — PASS.
- Architecture/forensics/hygiene/integrity/syntax/release-source — PASS.
- Core ownership direct constructors reduced to 5 — PASS.
- Archive manifest — regenerated after Pass 4 (see final manifest).
- App clean-room TypeScript/Vite build — TODO (app/node_modules unavailable in execution environment).
- Browser E2E / external Playwright worker — TODO.
- Long-running soak / final production gates — TODO.


## Pass 4 — Hexis integration + cross-project hardening

- Full Hexis source/provenance review — DONE.
- Evidence-based belief revision with independent-source deduplication — DONE.
- Point-in-time memory and temporal diff — DONE.
- Learning Review approve/correct/forget — DONE.
- Retention proposal + explicit confirmation + fidelity receipt — DONE.
- Guarded HMX 1.7 staging/export/import — DONE.
- Transactional outbox claim/ACK/reclaim — DONE.
- Connector policy with context/approval/target/rate/expiry gates — DONE.
- Risk-aware execution placement — DONE.
- Canonical MemoryOS ↔ Hexis projection sync — DONE.
- Hexis Control Center in active UI — DONE.
- All 41 current API methods/routes wired to UI; missing routes 0; unused UI methods 0 — PASS.
- WAS NOT promoted as parallel owner: Hexis PostgreSQL/Agent/Memory/Identity/Next.js/heartbeat/companion executor — DONE by exclusion.
- Hexis credential-bearing `.env.local` and Gmail credentials excluded from provenance — DONE.
- Architecture/core-ownership/hygiene/forensics/source-truth/integrity/release gates — PASS.
- Full runtime tsc — NOT VERIFIED in sandbox due execution timeout.
- Full default server smoke — NOT VERIFIED in sandbox due execution timeout; targeted Hexis server smoke PASS.
- Full UI Vite build/browser E2E — TODO / environment-dependent.


## Pass 4 — Hexis final integration / hardening

| № | Задача | Статус |
|---:|---|---|
| 351 | Hexis evidence-based belief revision + duplicate-source protection | DONE |
| 352 | Point-in-time temporal memory + diff | DONE |
| 353 | Learning Review approve/correct/forget | DONE |
| 354 | Retention/forgetting + fidelity receipt + confirmation gate | DONE |
| 355 | Guarded HMX 1.7 staging/export/import | DONE |
| 356 | Transactional outbox claim/ACK/reclaim | DONE |
| 357 | Connector policy context/target/approval/rate/expiry | DONE |
| 358 | Risk-aware execution placement | DONE |
| 359 | Canonical MemoryOS ↔ Hexis projection synchronization | DONE |
| 360 | Hexis Control Center with real UI access | DONE |
| 361 | 41/41 current integration API methods have UI usage | DONE |
| 362 | Hexis credentials excluded from provenance archive | DONE |
| 363 | Architecture/hygiene/forensics/integrity/source-truth gates | DONE |
| 364 | Full runtime tsc | TODO / sandbox timeout |
| 365 | Full project audit:all | TODO / sandbox timeout |
| 366 | Clean-room Vite/browser E2E | TODO / dependency environment |

## Pass 5 — final hardening and release tooling

- Stronger HTTP byte-based request limits and correct 413/400 semantics — DONE.
- Static asset path confinement hardened against traversal — DONE.
- Runtime Atlas added to the main interface for the principal read-only API surface — DONE.
- UI wiring audit extended to Runtime Atlas dynamic client methods — DONE.
- Generated Python bytecode removed from shipped provenance tree — DONE.
- Node/npm and Python version pinning added — DONE.
- One-command install/backup/restore/migrate/doctor/release verification — DONE.
- Version/config/schema migration tooling — DONE.
- SBOM and production configuration freeze — DONE.
- Operational alert threshold manifest and health guard — DONE.
- Research regression sweep: R22/R23/R26 targeted tests 17/17 PASS in this pass — DONE.
- Persistence concurrency/crash recovery: PASS — DONE.
- Full clean-room UI install/Vite build — TODO (npm ci timed out; offline cache lacked ajv package metadata).
- Full runtime `tsc` — NOT VERIFIED in sandbox (process exceeds execution limit without diagnostic output); changed-file transpile/syntax gates pass.
- Long-duration soak in unrestricted environment — TODO.
- Final browser E2E with installed UI dependencies — TODO.
## FINAL3 — 2026-10-08

- [DONE] Letta source/provenance branch boundary integrated into canonical runtime.
- [DONE] Letta telemetry policy persisted and exposed through API/UI.
- [DONE] Letta generated-artifact human-review promotion gate integrated.
- [DONE] Full runtime TypeScript typecheck after Letta/previous integrations.
- [DONE] WILL/Lumina/Hexis regression suite green after final type fixes.
- [DONE] HTTP input hardening and Hexis server smoke green.
- [DONE] UI/API wiring: 46 API routes, 0 missing routes, 0 unused UI methods.
- [DONE] Architecture/integrity/hygiene/forensics/source/contract/archive gates green.
- [DONE] Organism/restart/memory/genesis regression green.
- [PARTIAL] Aggregate server-smoke may exceed sandbox time limit; targeted HTTP smoke and manual health pass.
- [PARTIAL] Clean-room UI dependency install/Vite/browser E2E and unrestricted soak remain environment-dependent.
- [PARTIAL] Direct Library duplication of all source branches blocked by current Library storage quota; source archives remain preserved inside release tree.


## Pass 6 — Conscio 4.8.2 integration + final hardening

| № | Задача | Статус |
|---:|---|---|
| 367 | Conscio source archived with immutable provenance/hash | DONE |
| 368 | Source-state boundary canonical/research/legacy/provenance-only | DONE |
| 369 | FTS5/BM25/trigram/RRF lexical retrieval adapter | DONE |
| 370 | Canonical memory → Conscio lexical index sync | DONE |
| 371 | Skill quarantine/trial/evidence-gated promotion | DONE |
| 372 | Skill post-review immutability | DONE |
| 373 | Liaison peer pairing/trust/revoke | DONE |
| 374 | Peer queue/ACK/reclaim-compatible message surface | DONE |
| 375 | Peer message idempotency key support | DONE |
| 376 | Confidence observation + Brier/ECE calibration surface | DONE |
| 377 | Evidence-required supported claim recording | DONE |
| 378 | Metabolic context advisory | DONE |
| 379 | Conscio HTTP API surface | DONE |
| 380 | Conscio full UI control console | DONE |
| 381 | 18/18 Conscio UI/API methods wired | DONE |
| 382 | 6/6 Letta governance methods wired | DONE |
| 383 | Server-level Conscio end-to-end smoke | DONE |
| 384 | Conscio hostile-query/source-boundary regression | DONE |
| 385 | Full runtime TypeScript typecheck after Conscio changes | DONE |
| 386 | Runtime/server/restart/memory/concurrency regression | DONE |
| 387 | Function-reality critical path | DONE |
| 388 | Archive/integrity/source/architecture final gates | PASS |
| 389 | Full clean-room UI build/browser E2E | TODO |
| 390 | Unrestricted long-duration soak | TODO |
| 391 | Full semantic coverage of historical source tree | PARTIAL |
