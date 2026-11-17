# World Forge — OmeStro №15

**Статус:** IMPLEMENTED и подключён к FutureSimulator на изолированной feature-ветке; exact-head CI ожидается. Реалистичность миров и перенос на реальные задачи не доказаны.

## Назначение
World Forge создаёт воспроизводимые синтетические сценарии для проверки устойчивости планирования, распределения ресурсов, навигации и проверки гипотез. Он расширяет существующую линию FutureSimulator / WorldModel2, не создавая второй canonical world model и не изменяя реальные системы.

## Усиление реализации

### Stateful simulation
- Добавлены startScenario/step: пошаговая среда, в которой наблюдения, осмотр, перемещение, сбор ресурсов, перестроение маршрута, приоритет и проверка свидетельств меняют состояние. Стоимость и риск каждого действия назначаются симулятором, а не агентом.
- Возмущения теперь действуют в назначенный тик: resource-shock уменьшает запас, route-block закрывает цель-маршрут, signal-noise повышает шум, deadline-shift сокращает оставшиеся шаги.
- Каждая сессия имеет внутреннее каноническое состояние; старый snapshot не может откатить симуляцию, а изменённые вызывающей стороной ресурсы/позиция не используются как источник истины. Вход команды не принимает cost, risk01 или accepted.
- Сессии и ключи ограничены TTL и максимальным числом активных сценариев. Очистка истёкших записей выполняется при обращении/генерации, без фоновых таймеров.

### Evaluator hardening
- Ключи оценивания переведены на ECMAScript private fields (#answers/#sessions); обычное JS-свойство answers больше не открывает answer key. Идентификаторы сценариев используют SHA-256 fingerprint с привязкой к split, seed, domain и фактической difficulty.
- Trace и identity читаются через own data descriptors. Getter-ы не выполняются; proxy, accessor, class instance, sparse array, неизвестные поля и некорректные числа учитываются как нарушение и не проходят оценку.
- Ограничения шага/ресурса/риска берутся из evaluator-owned записи, а не из изменяемого публичного scenario object. Публичный scenario не содержит расписания disturbances или seedFingerprint; step result сообщает только число скрытых изменений без их типа/амплитуды. Критическое свидетельство засчитывается только по успешному verify-действию.
- FutureSimulator больше не публикует сам объект WorldForge; наружу отданы ограниченные методы генерации train/validation, старта и шага симуляции, оценки канонической сессии и закрытия. WorldForgeTools регистрирует пять ограниченных команд в ActionGateway; CognitiveRuntimeCluster выполняет регистрацию при инициализации. Runtime API не принимает произвольный caller-supplied trace. Результат строится по trace, который записывает внутренняя сессия после каждого шага.
- Изменения состояния в runtime tools получают capability `planning.simulation.state`: команды меняют только ограниченный синтетический sandbox. Шаг дополнительно защищён каноническим `tick` и stale-state rejection; это не внешняя запись, платёж или действие с устройством, поэтому durable side-effect receipt ActionGateway здесь не требуется.
- Runtime facade и ActionGateway tools не генерируют holdout и не открывают объект evaluator. Генератор инструмента сам задаёт случайный seed, не возвращая его вызывающему агенту. Прямой WorldForge остаётся внутренней доверенной точкой для offline harness; полноценная изоляция holdout в отдельном процессе/секретном evaluator пока не реализована. Синтетический holdout в одном процессе не является криптографически секретным от владельца кода/seed.

## Реализованный контур
- Три сценарных домена: resource allocation, route planning, investigation.
- Контролируемая сложность, скрытые evaluator-only переменные, несколько семейств допустимых стратегий и управляемые возмущения.
- Отдельные namespace для train, validation и holdout; детерминированное воспроизведение по seed.
- Публичный сценарий не содержит answer key. Критерии и порог успеха остаются в приватном evaluator registry процесса.
- Оценка включает покрытие целей/свидетельств, эффективность, устойчивость, семейство стратегии и нарушения ограничений.
- Неизвестный/истёкший сценарий, изменённая split identity и malformed trace закрываются отказом; шаги, ресурсный бюджет и риск проверяются по evaluator-owned ограничениям.
- Holdout не выдаёт oracle-ответ агенту. Результат явно маркируется syntheticOnly=true и independentlyVerified=false.
- Девять focused regression suites и отдельный GitHub Actions workflow; workflow использует версию Node из корневого .nvmrc.

## Ограничения
1. Это синтетическая лаборатория, а не реальный тренажёр физического мира.
2. Случайность детерминирована, но realism и распределение сценариев ещё не откалиброваны по внешним данным.
3. Изоляция answer key действует в пределах экземпляра WorldForge; это не криптографическая защита от кода, имеющего доступ к памяти процесса. Holdout нельзя считать секретным против разработчика с доступом к исходникам и seed.
4. Нет автоматического обучения/обновления модели и нет права на продвижение знаний из holdout.
5. Для доказательства переноса необходимы внешние тесты, независимый holdout и сравнение с одинаковым baseline.

## Интеграционный контракт
WorldForge.generate() выдаёт задания для исследовательского/оценочного контура. WorldForge.step() меняет только внутреннее состояние синтетической сессии. FutureSimulator.evaluateWorldForgeSession() оценивает только evaluator-owned trace активной сессии; runtime facade не принимает произвольные трассы. WorldForgeTools exposes только schema-ограниченные команды generate/begin/step/evaluate/release, причём seed и расписание возмущений остаются внутри host-сервиса. Ни один из этих методов не вызывает ActionGateway, не исполняет внешние действия, не меняет FutureSimulator forecast state и не пишет в MemoryOS2. Связь с Shared Future scenario space — через scenario ID/метаданные, без дублирования ledger и canonical goals.

## Verification
Дополнительные тесты: world-forge-evaluator-isolation.mjs, world-forge-perturbation-opacity.mjs, world-forge-action-integrity.mjs, world-forge-dynamic-transitions.mjs, world-forge-ttl-bounds.mjs, world-forge-runtime-tools.mjs и расширенный world-forge-future-simulator-integration.mjs. Workflow выполняет их вместе с двумя исходными проверками и npm run typecheck.
Локальный запуск в этой среде не выполнялся: исходный репозиторий доступен через GitHub connector без локального checkout. Статус тестов определяется только завершённым GitHub Actions на точном HEAD PR.
