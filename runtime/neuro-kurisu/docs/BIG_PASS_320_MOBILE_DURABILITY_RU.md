# BIG PASS 320 — Mobile Durability / Adaptive Crash-Loss Window

Дата: 2026-09-14
Release: Neuro-Kurisu 35.6.1 + B320

## Цель

После B317/B318/B319 persistence-контур уже умел доказывать cognitive closure, реальный process restart и recovery после аварии записи. B320 делает следующий шаг: durable-state становится ресурсно-осознанным для среднего телефона.

Новая политика должна учитывать:

- реальный размер последнего durable payload;
- фактическую стоимость последней записи;
- battery pressure;
- thermal pressure;
- RAM pressure;
- runtime profile.

Она не заменяет persistence и не скрывает crash risk. Она определяет только bounded dirty-cycle window между полными durable checkpoints.

## Реализовано

### 1. PersistenceDurabilityGovernor

Добавлен `src/organism/persistence/PersistenceDurabilityGovernor.ts`.

Governor:

- принимает фактические telemetry/resource данные;
- расширяет checkpoint window при большом/медленном state;
- ещё сильнее расширяет его при thermal/RAM pressure;
- сжимает окно при низком battery, потому что потеря последних циклов становится опаснее стоимости записи;
- имеет profile caps для quality/balanced/mobile;
- сохраняет diagnostic state:
  - effectiveMaxDirtyCycles;
  - targetCrashLossCycles;
  - lastPayloadBytes;
  - lastSaveMs;
  - estimatedWriteAmplification01;
  - lastDecision.

### 2. Интеграция в OrganismCore

Adaptive policy подключена к реальным checkpoint paths, а не только к диагностике.

Закрыты старые bypass-точки:

- обычный checkpoint;
- `beginBatch/endBatch`;
- operational micro-cycle.

Дополнительно устранён off-by-one: `N` теперь означает действительно не более `N` накопленных dirty cycles перед durable checkpoint.

### 3. Новый release test

Добавлен:

`tests/big-pass-320-mobile-durability.mjs`

Он проверяет:

- реальный file-backed payload;
- реальную latency записи;
- adaptive window;
- slow/large state policy;
- low-battery policy;
- resource-pressure policy;
- end-to-end dirty-cycle boundary;
- final durable tick.

## Фактически получено

На текущем host после реального checkpoint:

- payload ≈ 1.845 MB;
- last durable file ≈ 2.060 MB;
- измеренная последняя запись в финальном checkpoint ≈ 54 ms;
- effective mobile window = 6 cycles.

Синтетическая cost-stress проверка:

- large+slow state → window 8;
- low battery → window 4;
- thermal/RAM pressure → window 12.

Это означает, что policy реально реагирует на разные режимы, а не просто возвращает константу.

## Regression evidence

### Typecheck

PASS.

### B317 Reality Closure

PASS.

Ключевые факты сохранены:

- 4/4 neural update cycles;
- 4/4 causal bridge cycles;
- 4/4 personality update cycles;
- 4/4 policy shift cycles;
- 4/4 verified outcome cycles;
- 4/4 persistence checks;
- edge integrity = 1;
- persistence coverage = 1.

Autonomous outcome и novel holdout coverage остаются нулевыми в этом коротком B317 сценарии — это правильно и не засчитывается искусственно.

### B318 Durable Process Restart

PASS.

Разные process PIDs:

- writer PID отличается от restart PID;
- state loaded from same durable file;
- tick продолжил рост;
- learning updates продолжили рост;
- closure cycles продолжили рост.

### B319 Crash Recovery

B319 был доказан до внедрения B320 и имеет отдельный PASS-архив по 5 crash points. После B320 полный повтор B319 matrix не засчитывается как новый PASS, поскольку полный прогон в текущей среде превысил runtime budget. Это не трактуется как функциональная ошибка B320.

## Важное инженерное решение

B320 не должен ухудшать доказуемую persistence continuity.

Поэтому правило теперь такое:

`observed device/resource state -> durability policy -> bounded dirty window -> durable checkpoint -> measured write cost -> next policy`

Это замкнутый feedback-loop, а не фиксированный threshold.

## Что B320 НЕ доказывает

- реальный Android ARM64 performance;
- physical power-loss semantics конкретной модели телефона;
- filesystem-specific durability guarantees всех Android storage layers;
- полноценный adaptive policy по реальной батарее устройства без Device Gate run.

Следующий практический большой шаг: B321 Device Reality Durability Gate — реальная ARM64/Termux проверка состояния, файловой системы, свободной RAM, latency checkpoint и фактического crash-loss window на целевом телефоне.
