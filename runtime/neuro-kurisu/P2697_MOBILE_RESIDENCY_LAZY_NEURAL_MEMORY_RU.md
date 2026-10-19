# P2697 — Mobile Residency + Lazy Neural Memory

## Цель прохода
Углубить реальную память организма без наращивания RAM-нагрузки: холодные воспоминания должны оставаться холодными после перезапуска, а нейросемантическое представление должно материализоваться только тогда, когда конкретная память реально участвует в retrieval.

## Модули
- `src/organism/developmental/MemoryOS2.ts` — основной модуль.
- `src/organism/developmental/MemoryResidencyGovernor.ts` — политика hot/warm/cold.
- `src/organism/memory/MemoryFabric.ts` — внешний фасад памяти и delayed policy outcome.
- `src/organism/developmental/AdaptiveMemoryPolicy.ts` — контекстная политика retrieval.

## Что реально изменено
1. **Cold restore без массовой рематериализации.** Ранее `restore()` восстанавливал semantic vector для каждого элемента, даже если запись была cold. Теперь пустой vector сохраняется пустым.
2. **Lazy vector materialization.** При retrieval vector строится только для кандидата, который дошёл до semantic scoring.
3. **Bounded rematerialization.** После retrieval cold-кандидаты, которые не попали в возвращаемый набор, снова освобождают vector.
4. **O(1) lookup кандидата.** Добавлен `itemIndex: Map<string, MemoryItem2>`, чтобы retrieval не выполнял линейный `find()` по всему массиву для каждого кандидата.
5. **Индекс очищается при удалении/overflow.** Это не только оптимизация, но и предотвращение удержания старых объектов через вторичный индекс.
6. **Backward-compatible residency inference.** Старые snapshots без tier получают warm/cold по наличию materialized vector.

## Проверка
`tests/p2697-mobile-residency.mjs`:
- 900 canonical memories;
- 820 cold / 64 warm / 16 hot;
- 80 materialized vectors до snapshot;
- после restore — те же 80, без восстановления 900 vectors;
- retrieval — 97 кандидатов, bounded materialization сохраняется;
- PASS.

## Важное ограничение
Это не означает, что весь организм уже гарантированно помещается в RAM среднего телефона. Полный mobile soak остаётся отдельным gate: текущая известная точка P2696 была ~359.2 MB peak RSS. Следующий проход должен профилировать не только MemoryOS, но и весь organism runtime: cloning, snapshots, event logs, multimodal buffers и persisted facets.

## Исследовательские выводы
Открытый код не следует копировать целиком. Наиболее полезные направления:
- Agent World Model — генерация исполняемых сред и верификация tool-use траекторий;
- Generative Agents — memory stream + reflection + hierarchical planning;
- RLwithReplay — replay как механизм обучения и мысленных симуляций;
- Spiking-WM / BrainCog ecosystem — spiking world model, temporal memory, multi-compartment neural integration.

Для нашего проекта эти идеи должны становиться отдельными проверяемыми модулями, а не внешними декоративными зависимостями.
