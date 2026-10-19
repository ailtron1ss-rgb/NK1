# BIG PASS 94 — SOCIAL MIND + PERSON CONTINUITY

Версия: 34.67.0
Статус: research-release

## Цель
Связать реальное perceptual person evidence с социальным моделированием, непрерывностью личности объекта, гипотезами намерения, результатами взаимодействия, memory/provenance и agency pressure — без выдачи эвристики за доказанное понимание человека.

## Реально внедрено
- `SocialMindKernel`: bounded social-person state, evidence ledger, intent hypotheses, interaction episodes, belief claims.
- Person continuity: устойчивый person candidate ID + ограниченный spatial re-identification при смене label.
- Evidence-first social inference: `observed` vs `model-output` разделены.
- Relation evidence: vision relations, связанные с person candidate, становятся отдельными социальными evidence records.
- Outcome learning: outcome сравнивается с предсказанной intent hypothesis и обновляет predictability/trust/warmth/guardedness.
- Social demand подключён к homeostatic socialNeed и CognitiveField.
- LongTermSocialMind получает новый intent prediction вместе с существующим SocialWorldModel prediction.
- `/api/metrics` публикует `sensorium.socialMind`.
- Persistence/restore включают `socialMind`.
- Server regression расширен проверкой social-mind metrics.
- Unicode-safe intent matching для русского и английского языка.

## Что намеренно НЕ заявляется
- точная идентификация реального человека;
- распознавание мыслей/эмоций по одному изображению;
- доказанная Theory of Mind;
- человеческий social understanding;
- сознание.

## Следующий крупный цикл
BIG PASS 95: углубление Social Mind в person-state / multi-hypothesis intent / second-order belief experiments, с causal outcome learning и connection к memory/self, без тяжёлых mobile dependencies.

## Итог self-check
Изменено относительно 34.66.0: **11** существующих файлов; добавлено: **7** новых файлов. Новый read-only endpoint: `/api/organism/social-mind`.

## Финальная проверка
Полный `audit:full` завершён с **ok=true**, 0 ошибок. Предупреждения ограничены vendor Live2D JSON и не относятся к исполняемому runtime.
