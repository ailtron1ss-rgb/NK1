# Интеграция N.E.K.O. Motion Semantics → NK1

Дата: 2026-11-04  
Рабочая ветка: `aspect/neko-semantic-gesture-bridge-20261104`

## Что перенесено

Из N.E.K.O. адаптирован принцип семантических action cards: короткое выраженное действие преобразуется в стабильный идентификатор жеста, а не в произвольную команду рендереру. В NK1 добавлен resolver явных закрытых stage directions, который выбирает один жест с учётом приоритета и отрицательных блоков.

Поддержанные intents: `nod`, `shake`, `wave`, `clap`, `bow`. Они направляются в канонические normalized motion programs NK1. Motion arbitration сохраняет приоритет сна и активного мышления, а рендереры продолжают получать только bounded body channels.

## Границы безопасности и архитектуры

- Разбираются только короткие закрытые stage directions в круглых или full-width скобках; обычный текст диалога не сканируется.
- Отрицательные формулировки вроде `(не кивает)` блокируют жест.
- За одно сообщение выбирается не более одного действия; приоритеты разрешают конкурирующие жесты.
- Сырой текст не сохраняется в карточке и не добавляется в память.
- Жесты — одноразовые normalized motion programs, кроме уже существующей циклической `wave`; они возвращаются в нейтральную позу.
- Sleep и thinking остаются выше gesture priority.
- Нет прямого управления DOM/VRM, нет новых sidecar runtime и нет нового источника состояния тела.

## Почему не копировались VRMA и 3D-модели

Архив содержит 75 manifest entries: 13 официальных Apache-2.0 actions и 62 дополнительных action assets с отдельным provenance. В наборе также есть чужие VRM-модели и VRMA-клипы для конкретных humanoid rigs. Архивный runtime зависит от глобальных объектов N.E.K.O. (`window.vrmManager`, inter-page bridge и motion lifecycle events), поэтому его нельзя безопасно вставить в NK1 напрямую.

Эта интеграция не переносит бинарные модели, VRMA или renderer runtime. Она повторно использует существующие NK1 `motionLibrary`, `motionArbitration`, `AvatarStage` и capability-aware renderer path. Переиспользование конкретных клипов возможно отдельным проходом после asset-by-asset лицензирования, rig-совместимости и continuity-тестов.

## Проверки

- Resolver unit tests: языковые cues, закрытая/незакрытая stage direction, negation, приоритет, лимиты обработки.
- Motion arbitration tests: пять программ, приоритет thinking/sleep, возврат одноразовых жестов к neutral pose.
- Обязательные CI gates: embodiment-switch workflow, app typecheck и полный renderer smoke.
