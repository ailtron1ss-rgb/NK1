# P2641–P2658 — архитектурные решения

## 1. Не создавать ещё один независимый мозг
Новый компонент не дублирует memory/world/skills. Он является cross-layer controller и потребляет их сигналы.

## 2. Goal hysteresis
Цель не должна полностью меняться из-за одного шумного outcome. Revision происходит только при заметном расхождении качества.

## 3. Prototype transfer with negative-transfer penalty
Prototype similarity без penalty недостаточна. Поэтому confidence/transfer уменьшаются при систематически плохих переносах.

## 4. Causal credit
Outcome обновляет action-specific credit. Это связывает действие и последствия без изменения всей neural matrix на каждом событии.

## 5. Recovery is learned
Fault injection учитывается как training signal. Recovery readiness растёт только от наблюдаемого recovery outcome.

## 6. Mobile-first
State ограничен 24-dimensional context, максимум 24 goals и 48 prototypes. Это намеренно существенно легче полноценного world model.

## 7. Verification boundary
Высокие score этого контроллера не означают сознание. Они означают наличие измеримых механизмов autonomy/continuity/learning/recovery.
