# The Invention Loop — усиленная реализация NK1

Ветка: `aspect/the-invention-loop-20261117`  
Назначение: превращать инженерные гипотезы в проверенные улучшения, не смешивая генерацию идей, факт изменения кода и доказательство пользы.

## Жизненный цикл
`proposed → designed → prototyped → tested → critiqued → replicated → accepted`

Любая неудача по заранее объявленному порогу или блокирующая независимая критика ведёт в `rejected`.

## Предрегистрация и разделение ролей
- До прототипирования фиксируются вопрос, гипотеза, критерии успеха, baseline, шкала метрики, направление оптимизации, порог, fingerprint набора испытаний и четыре разные роли проверяющих.
- Роли первичного verifier, независимого критика, replication verifier и holdout verifier фиксируются до запуска; другой ID не может подменить роль постфактум.
- Для каждой outcome-записи требуются authority, seed, attempt, уникальный run ID, environment ID, evidence reference и SHA-256 evidence-артефакта.
- Самоотчёт `self-report` не принимается. Результат проходит через существующий в NK1 `VerifiedOutcomeLedger`: проверяется authority-класс, verifier identity по manifest, task/version, seed/attempt и неповторность evidence reference.
- Репликация должна прийти от заранее выбранного другого verifier и из другой environment; holdout имеет отдельные verifier, environment и run ID.
- Fingerprint тестового набора — SHA-256; его изменение между preregistration и receipt блокирует приём результата.
- Эффект рассчитывается внутри модуля из observed, baseline, metricScale и направления метрики. Caller-supplied effect/score не используется.
- Один run/evidence receipt не может быть переиспользован в другом этапе или другом invention record.

## Целостность состояния
Каждый переход записывает состояние в per-record hash chain. Во время восстановления история перепроверяется, а сохранённое состояние сравнивается с последним аудируемым снимком. Изменённые или неаудируемые записи отправляются в quarantine; счётчики вычисляются заново и не доверяются сериализованным числам. Старый version-1 формат без audit trail не повышается автоматически до доверенного.

Hash chain защищает от случайного/непреднамеренного изменения и обеспечивает обнаружение изменения цепочки; это не цифровая подпись verifier. Текущая система принимает verifier authority из доверенного host/evaluator boundary. Для криптографической аттестации личности проверяющего нужна отдельная подписывающая authority и проверка подписи на стороне host.

## Runtime и границы полномочий
The Invention Loop принадлежит `EvidenceResearchSubsystemRuntime`, входит в snapshot/restore и экспортируется organism entry point. Координатор ведёт экспериментальный протокол и admission доказательств; он не исполняет произвольный код, не сливает ветки, не публикует Release и не продвигает веса модели. Исполнение и promotion остаются за отдельными sandbox, ActionGateway, независимыми evaluator-ами и approval gates.

## Проверка
Из `runtime/neuro-kurisu`:
```sh
node --experimental-strip-types tests/the-invention-loop.mjs
npm run typecheck
```
Для PR создан отдельный workflow `.github/workflows/the-invention-loop.yml`, который запускает целевой lifecycle-тест и затем полный runtime typecheck.
