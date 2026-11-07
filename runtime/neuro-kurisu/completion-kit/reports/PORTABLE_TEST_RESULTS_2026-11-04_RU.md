# Portable Completion Kit v0.2.0 — локальный протокол проверки (2026-11-04)

## Результат unit tests
- Node.js: v22.16.0.
- Чисто распакованный portable-пакет: **31 passed, 0 failed**.
- ZIP: 65,090 bytes, 50 entries, CRC verification passed.
- SHA-256: `6a2aca594f6c97dc4f4ac5dd82f057daa9a3e9766d5b8fabe33b818ff801668a`.
- Покрытие: architecture audit, static import graph, CEF lineage, promotion policy, paired statistics, dataset SHA/path-traversal, Git provenance, exact-SHA receipt adapter и tree generation.
- Production promotion CLI использует канонический NK1 `src/organism/learning/PairedSeedConfidence.ts`; policy tests внедряют детерминированный test estimator и проверяют fail-closed отсутствие canonical dependency.

## Проверка совместимости с исходниками NK1
- Upstream `runtime/neuro-kurisu/package.json` на branch `workpass70-source`, version `35.90.0`.
- Все имена команд из `architecture/gates.json` сверены с runtime/root package scripts: **0 missing scripts**.
- Root NeuroK Engineering OS содержит `neurok-os:evidence`; receipt schema сверена с адаптером Completion Kit.
- Корневой `.gitignore` upstream не исключал `.neurok-os/`; в PR добавлены ignore rule и regression test, чтобы local claims/evidence не загрязняли Git.

## Проверка Engineering OS adapter
- На временном Git checkout gate runner записал PASS receipt с full commit SHA и SHA-256 отчёта.
- Намеренно падающая gate-команда создала FAIL receipt с ненулевым exitCode.
- Dirty-worktree negative control не создал evidence receipt и заблокировал PASS.
- Для этих сценариев использовался fixture с совместимым CLI-контрактом `neurok-os:evidence`. Это **не** запуск настоящего NK1 evidence CLI на полном checkout.
- Реальную интеграцию необходимо повторить после установки ZIP в актуальный NK1; root package scripts и schema сверены с upstream.

## Что не доказано
- Полный runtime audit / import graph / test-surface pass на реальном checkout.
- Все TypeScript gates, production build и все GitHub Actions на exact v0.2.0 source tree.
- RU/EN memory holdout uplift, transfer/generalization, useful long-horizon self-initiative.
- Browser/WebGL E2E, Android audio/device soak, power-loss recovery, privacy deletion propagation и human license review.
- Сознание, AGI или прирост интеллекта.

## Повторение
Распаковать архив в `runtime/neuro-kurisu/`, затем выполнить из `runtime/neuro-kurisu/completion-kit/`:

```bash
npm test
npm run gate -- foundation
npm run audit
npm run imports
npm run test-surface
npm run report
```

Gate runner требует clean Git checkout, GitHub origin и доступную корневую команду `npm run neurok-os:evidence`.
