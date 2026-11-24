# Neuro-Kurisu — Strict Recheck Audit 35.6.9 / B356

Дата: 2026-09-14
База: Neuro-Kurisu 35.6.8 / B355
Текущий release: 35.6.9 / B356

## 1. Что было обязательным по roadmap
После B355 нельзя было считать Brick 4 завершённым: B355 доказывал только один committed primitive. Следующий обязательный барьер требовал:
- полноценной многосоставной программы;
- точного порядка primitive;
- restart перед каждым шагом;
- сохранения completion после restart;
- matched OFF-контроля;
- доказательства, что ON меняет фактический selected action, а не только внутренний cursor;
- сохранения B353/B354 causal-SNN baseline.

Все перечисленные host-runtime требования B356 выполнены.

## 2. Реальные изменения кода
### B276 execution state
Добавлен bounded `executionHistory` на 64 события, сохраняемый в snapshot.

### B276 action attribution
`actionBias()` теперь cursor-aware: влияние получает только текущий executable primitive. Будущие шаги программы больше не протекают в текущую policy decision.

### Release
Версия поднята с 35.6.8/B355 на 35.6.9/B356. Синхронизированы package.json, package-lock.json, VERSION.json, RELEASE_MANIFEST.json и ReleaseContract.

## 3. B356 compositional trajectory evidence
Тест: `tests/big-pass-356-compositional-trajectory-restart.mjs`

Результаты:
- 5 независимых seed: PASS.
- 3 primitive в каждой проверенной программе: 5/5 PASS.
- точный порядок selected primitive: 15/15 PASS.
- restart перед каждым следующим шагом: 15/15 PASS.
- completion после полного прохода и restart: 5/5 PASS.
- execution OFF не продвигает cursor: 5/5 PASS.
- контрфактический OFF выбирает другой первый action: 5/5 PASS.

Наблюдавшиеся траектории:
1. verify → explore → reflect
2. explore → respond → reflect
3. respond → explore → reflect
4. wait → respond → explore
5. reflect → respond → explore

OFF первые действия:
1. wait
2. wait
3. rest
4. explore
5. wait

Следовательно, в этих matched условиях изменение ON/OFF меняет не только bookkeeping, но и фактическое selected action.

## 4. Регрессия предыдущих causal gates
### Brick 3 — B353 causal SNN
PASS после B356.
Средний causal L1: 0.0780206405.
Средний SHAM L1: 0.0178028476.
Causal/SHAM: 4.38248x.
Все четыре контекста остаются PASS.

### Brick 1 — B351 DIT
PASS после B356.
History effect L1: 0.3372168894.
Ablation drop: 0.9989016528.
Sham drop: 0.0009079604.
Все заявленные DIT criteria PASS.

## 5. Инженерные проверки
- `node scripts/typecheck-runtime.mjs`: PASS.
- release contract: PASS.
- release source: PASS.
- architecture: PASS; sourceFiles=1240, canonicalFiles=400, missing=0, cycles=0, legacyLeakage=0.
- integrity: PASS; files=2678, release=35.6.9.
- archive manifest: PASS; files=2903, missing=0, hashMismatches=0, extra=0.
- lockfile: PASS; zero-dependency-tree.
- source hygiene: 0 errors, 7 исторических duplicate-content warnings; они не новые и не являются функциональной ошибкой.

## 6. Progression
Строгий milestone progress:
- Brick 0 SPINE_ONLY: 100% / CLOSED.
- Brick 1 DIT: 100% / PASS.
- Brick 2 cheap-cycle host gate: 100% host / Android gate OPEN.
- Brick 3 causal SNN: 100% host replication gate / CLOSED.
- Brick 4 compositional execution first causal trajectory gate: 100% / PASS.
- Brick 4 program consequence learning + unseen-context transfer: 0% нового acceptance gate / NEXT.
- Brick 5 predictive planning: ~25%.
- Brick 6 long phone life: ~25%.
- Brick 7 physical body/sensors: ~20%.
- Brick 8 functional consciousness testing: ~40%; phenomenal consciousness UNKNOWN.

Оценка продвижения ветки brain/identity относительно текущей целевой дорожной карты: ~60%.
Оценка пути до автономного работающего организма на реальном среднем Android/Termux устройстве: ~40%; физический device gate ещё не выполнен.

## 7. Что теперь реально умеет organism spine
Текущая система имеет persistent state, experience/history, B299 personality learning, needs/goals, world prediction, B269 spiking neural substrate, causal neural credit, restart continuity, developmental state и теперь verified compositional action programs, которые способны причинно вести выбранное действие по нескольким шагам после restart.

Это не равняется человеческому сознанию и не доказывает phenomenal consciousness.

## 8. Следующий обязательный шаг
Не переходить к Brick 5 раньше следующего causal Brick 4 gate:
1. программа должна улучшаться от последствий собственного исполнения;
2. изменение программы должно быть видно на unseen context;
3. нужен matched program-ablation/sham;
4. causal effect должен сохраняться после restart и длинной последовательности;
5. baseline B269 attribution не должен деградировать.

Только после выполнения этого барьера compositional execution можно считать не только исполнимым, но обучаемым компонентом агентности.

## 9. Ограничения
Physical Android/Termux gate остаётся OPEN. Никаких утверждений о реальной работе на конкретном пользовательском телефоне в этом release не делается.
