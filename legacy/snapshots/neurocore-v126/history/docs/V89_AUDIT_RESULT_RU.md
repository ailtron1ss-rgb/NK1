# NeuroCore V89 — фактический результат прохода

Дата: 2026-09-25

## Что сделано кодом

1. Создан `src/neurocore/current/` как единственный путь развития current runtime.
2. `NeuroCoreCurrent` — прямой `nn.Module`; он не наследует ни один `VXX` класс.
3. `frontier.py` переведён на ленивую загрузку current engine.
4. Корневой `neurocore` больше не импортирует историческую цепь при обычном импорте; legacy symbols разрешаются явно.
5. Добавлен `MechanismRegistry` с состояниями candidate/integrated/rejected/legacy.
6. Добавлены строгие contracts для sequence learning (`x=[B,T,D]`, target=`[B,T-1,L]`).
7. Добавлена отдельная checkpoint schema boundary для current с `engine_source_version`.
8. Исправлен реальный дефект V88 в расчёте gradient spike: spike считается относительно предыдущей EMA, после чего EMA обновляется.
9. Default pytest ограничен current qualification gate; исторические тесты не смешиваются с ним.
10. Добавлен `scripts/verify_current.py` для автоматической проверки current ancestry/параметров/registry.

## Фактическая проверка

- V89 current gate: **4/4 PASS**.
- V86 + V87 + V88 gates: **19/19 PASS**.
- `compileall`: PASS.
- `NeuroCoreCurrent` bases: только `nn.Module`.
- total parameters: **366,909**.
- trainable parameters: **159,342**.
- integrated mechanisms: selective recurrent spine, compositional predictive memory, adaptive replay utility, sparse utility cache.
- обычный `import neurocore` не поднимает историческую VXX цепь.

## Почему размер архива V70 был намного больше V88

V70 содержал огромный research/data/evidence payload. В сравнении с V88 падение размера ZIP не означает соответствующего уменьшения Python runtime: V70 имел около 2.87 MB Python-кода против около 2.99 MB в V88, а основная масса V70 приходилась на JSON/NPZ/TXT артефакты.

## Ограничение текущего прохода

Current composition root пока содержит **V88-compatible measured backend**. Это безопасная стадия консолидации: поведение и доказанные механизмы сохранены, а способ эволюции уже изменён. Полное flattening вычислительного engine — отдельный Pass 90.

Последовательный объединённый rerun всех проверок в одной shell-команде был остановлен по тайм-ауту после уже успешных 4/4 и 19/19 прогонов; это не зафиксировано как test failure.
