# The Invention Loop — усиленная реализация NK1

Ветка: `aspect/the-invention-loop-20261117`  
Назначение: превращать инженерные гипотезы в проверенные улучшения, не смешивая генерацию идей, факт изменения кода и доказательство пользы.

## Жизненный цикл
`proposed → designed → prototyped → tested → critiqued → replicating → replicated → holdingout → accepted`

Любая неудача скринингового primary-прогона, агрегатного replication/holdout gate или блокирующая независимая критика ведёт в `rejected`.

## Предрегистрация и разделение ролей
- До прототипирования фиксируются вопрос, гипотеза, критерии успеха, baseline, шкала метрики, направление оптимизации, порог, минимальная доля успешных прогонов, SHA-256 fingerprint набора испытаний и точные seed когорты.
- Один primary seed используется только для скрининга. Репликация и закрытый holdout каждый требуют минимум **5 заранее выбранных разных seed** в каждом непересекающемся наборе; сами запуски дополнительно разводятся по уникальным environment ID.
- Для replication и holdout результаты собираются по каждому seed. Продвижение требует полного покрытия всех preregistered seed и уникальных сред выполнения, среднего эффекта не ниже порога и доли успешных прогонов не ниже preregistered `minSuccessRate`.
- Каждый прогон одноразовый (`attempt=1`); скрытые повторы и переиспользование run/evidence reference между стадиями и разными inventions блокируются. Для новой серии попыток нужна новая запись invention с новой preregistration.
- Роли primary verifier, independent critic, replication verifier и holdout verifier фиксируются до запуска и должны быть разными.
- Для каждого результата требуются authority, seed, attempt, уникальный run ID, environment ID, evidence reference и SHA-256 evidence-артефакта.
- Самоотчёт `self-report` не принимается. Результат проходит через существующий в NK1 `VerifiedOutcomeLedger`: проверяется authority-класс, verifier identity по manifest, task/version, seed/attempt и неповторность evidence reference.
- Эффект вычисляется внутри модуля из observed, baseline, metricScale и направления метрики. Caller-supplied effect/score не используется.
- Входные структуры отсоединяются через NK1 plain-data trust boundary до чтения полей; accessor/getter-backed, циклические и неподдерживаемые payload блокируются.

## Целостность состояния
Каждый переход записывает состояние в per-record SHA-256 hash chain. Во время восстановления история перепроверяется, а сохранённое состояние сравнивается с последним аудируемым снимком. Изменённые или неаудируемые записи отправляются в quarantine; счётчики вычисляются заново и не доверяются сериализованным числам. Старый version-1/version-2 формат без полного audit contract не повышается автоматически до доверенного.

Hash chain защищает от случайного/непреднамеренного изменения и обеспечивает обнаружение изменения цепочки; это не цифровая подпись verifier. Текущая система использует контракт `VerifiedOutcomeLedger` и preregistered verifier IDs, но криптографическая аттестация личности требует отдельной подписи и проверки на стороне host/evaluator.

## Runtime и границы полномочий
The Invention Loop принадлежит `EvidenceResearchSubsystemRuntime`, входит в snapshot/restore и экспортируется organism entry point. Координатор ведёт экспериментальный протокол и admission доказательств; он не исполняет произвольный код, не сливает ветки, не публикует Release и не продвигает веса модели. Исполнение и promotion остаются за отдельными sandbox, ActionGateway, независимыми evaluator-ами и approval gates.

## Проверка
Из `runtime/neuro-kurisu`:
```sh
node --experimental-strip-types tests/the-invention-loop.mjs
npm run typecheck
```
Для PR создан отдельный workflow `.github/workflows/the-invention-loop.yml`, который запускает целевой lifecycle-тест и затем полный runtime typecheck.
