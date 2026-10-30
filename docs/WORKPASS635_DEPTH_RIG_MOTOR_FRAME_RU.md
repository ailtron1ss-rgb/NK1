# NK1 2.5D motor-frame adapter — WorkPass 635

Дата: 2026-10-30  
Ветка: `work/nk1-2p5d-depth-rig-2026-10-30`  
Основа: `workpass70-source`

## Назначение

Подключить renderer-neutral MotorFrame из PR #410 к уже исполняемому Three.js depth-rig пути PR #408, не создавая второго владельца эмоций, действий или motor-goal arbitration.

## Реализация

- Добавлен структурный контракт `DepthRigMotorFrameV1`, совместимый по существенным полям с `EmbodiedMotorController.MotorFrame`: версия, goal ID, фаза и состояния суставов.
- `resolveDepthRigIntentFromMotorFrame(...)` переводит только явно заданные `jointId → DepthRigMotorChannel` bindings в intent-каналы 2.5D. Имена костей или суставов автоматически не угадываются.
- Для визуального исполнения используется измеренный `angleRad`, а не `targetAngleRad`: рендер получает текущее состояние ограниченного контроллера и не перескакивает к будущей цели.
- Кадры без активной цели (idle/rejected/expired), отсутствующие или недоступные суставы оставляют исходный semantic intent без изменений.
- Некорректный envelope, дублирующиеся bindings, неверные значения суставов или небезопасный gain отклоняются атомарно; вызывающий renderer сохраняет безопасный semantic fallback.
- В `Avatar3DStage` добавлены необязательные `motorFrame` и `motorBindings`. Когда они предоставлены, измеренные joint channels накладываются на существующий depth-rig semantic intent; без них поведение остаётся прежним.

## Проверки

Добавлены пять регрессионных сценариев: measured-vs-target angle, inactive frame fallback, unavailable/missing joints, malformed/duplicate bindings и channel safety clamps.

## Границы подтверждения

- Это адаптер renderer contract, а не доказательство того, что приложение уже передаёт живой MotorFrame: текущий родительский UI пока не заполняет новые optional props.
- Реальный 2.5D GLB с авторскими слоями, pivot/occlusion masks, художественная лицевая библиотека и визуальная проверка на Android/desktop остаются отдельными gates.
- Никакие новые 2.5D art assets не генерировались; последний GitHub Release ZIP не изменён.
