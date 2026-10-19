# P35 — Implementation & Gaps

## Практический эффект
P35 впервые даёт организму единое bounded представление мира и host/body: сущности, отношения, сцена, пространственный self-frame, состояние тела, модальная надёжность и affordances. Эти данные сохраняются и могут влиять на выбор действий.

## Что реально можно сделать сейчас
1. Передать structured vision objects/scene/relations и получить их в общем semantic world graph.
2. Передать structured audio events и связать их с той же scene timeline.
3. Передать world-context и host/body state; они попадут в world/body representation.
4. Получить semantic summary через API.
5. При изменении body state автоматически изменить affordances, например повысить привлекательность `rest`.
6. Переносить P35 state между перезапусками.

## Чего P35 ещё не делает
- не извлекает богатую семантику изображения самостоятельно;
- не распознаёт речь самостоятельно;
- не строит полноценный neural spatial map;
- не даёт human-level scene understanding;
- не подтверждает субъективное сознание.

## Почему это не считается декоративным
В `OrganismCore` P35 вызывается в реальном `observe()` пути, его affordance влияет на utility выбранных actions, состояние попадает в persistence, а server API позволяет подавать и читать данные.

## Следующее улучшение
Нужен внешний semantic backend contract с явным provenance и confidence, а затем multi-step learned spatial world model. Только после его реализации можно уменьшать статус `semantic vision/audio` с `adapter` до `learned capability`.
