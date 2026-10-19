# Neuro-Kurisu Evolution Current Release — итоговый отчёт эволюционной пересборки

## 1. Итог

Этот релиз является не продолжением старой «слоёной» архитектуры, а новой canonical control point после P0–P6. Полный предыдущий проект сохранён в `legacy-original/`, но canonical runtime больше не зависит от него.

## 2. Version contract

- Application: `Current Release`
- Organism Core: `см. VERSION.json`
- State schema: `8`
- Node: `>=22.12.0`
- npm: `>=10.8.0`
- external npm runtime/build dependencies: `0`

Единый контракт находится в `VERSION.json`, `RELEASE_MANIFEST.json` и `src/organism/system/ReleaseContract.ts`.

## 3. Структура

```text
src/organism/
  core/          canonical state + decision loop + runtime
  cognition/     memory, self-model, workspace, motivation, evolution
  world/         world model, planning, counterfactuals, active inference
  body/          embodiment + Android/Termux resource bridge
  memory/        event history + autobiographical structures
  persistence/   atomic store, migrations, lock, journal
  language/      language organ + persona profile
  research/      runtime-neutral research primitives
  system/        contracts, capabilities, integrity, replay, action gateway
```

## 4. Данные

Фазовые поля P1–P5 устранены из canonical state. Они сохранены только для миграции/истории. Система использует доменные facets: `memory`, `embodiment`, `learning`, `consciousness`, `evolution`.

Каждый checkpoint получает stable SHA-256 state hash, invariant result, capability snapshot и replay signature. Volatile operational timestamps не участвуют в hash.

## 5. Runtime hardening

- single-writer / process lock;
- atomic persistence;
- batch commit per cognitive cycle;
- bounded external LLM timeouts;
- supervisor/backoff;
- operational journal;
- dry-run action gateway;
- health/metrics endpoints;
- deterministic local language fallback;
- clean state directory in release archive.

## 6. Research architecture

Cognitive mechanisms are separated from research runners. Heavy causal research does not block production release.

Current P6 lab: baseline + matched lesions for self-projects, agency, value evolution and identity trajectory.

Baseline (42 cycles): 5 projects, 42 agency records, 13 value revisions, 126 trajectory samples, authorship score ~0.521.

Lesion outcomes: corresponding feature channels collapse to zero while unrelated channels remain active. This is evidence of functional causal dependence, not proof of phenomenal consciousness.

## 7. Forensic quality gates

The project now includes dedicated checks for:

- lockfile;
- runtime/build dependency count;
- TypeScript;
- JavaScript/MJS syntax;
- shell syntax;
- JSON validity;
- release version/schema consistency;
- import graph and runtime cycles;
- legacy leakage;
- stale paths/version markers;
- duplicate content;
- duplicate names (except conventional `index.ts` barrels);
- empty files;
- trailing whitespace;
- excessive/very long lines;
- process lock;
- restart persistence;
- server health;
- state integrity and replay.

One command is intended as the release contract:

```bash
npm run release:audit
```

Diagnostic command:

```bash
npm run doctor
```

## 8. What the project is and is not

Это экспериментальная архитектура автономного искусственного организма. Она не доказывает субъективное сознание, а строит и измеряет набор функциональных свойств, которые могут быть релевантны consciousness-like processing.

## 9. Launch from zero

See `docs/LAUNCH_FROM_ZERO_RU.md`. Minimal path:

```bash
npm ci
npm run release:audit
npm run device:preflight
npm start
```

Для длительного Android запуска сначала использовать Device Gate и сохранять `health`, `metrics`, restarts, thermal, battery, state integrity и backend failures.

## 10. Final roadmap

`Device Reality → World Interaction → Social Mind → Lifelong Learning → Self-Authorship 2.0 → Persistent Identity → Consciousness Evidence Program → Open-Ended Artificial Organism → Self-Directed Scientific Discovery → Multi-Agent Society`.

Финальная цель — не максимально большой кодовый объём, а минимально необходимая, хорошо проверяемая система, которая может непрерывно существовать, строить собственную траекторию и менять будущие предпочтения под влиянием собственного опыта.
