# B288 — Карта дублирования social/relationship подсистем

Дата: 2026-09-12

## Цель

Уменьшить расхождение между большим числом исторически добавленных social/relationship компонентов и одной канонической обучаемой нейронной моделью.

## Канонический владелец

`B288SocialPredictiveSelfOtherBrain`

Он отвечает за canonical person-specific latent, recurrent social dynamics, predictive error, relationship values, context-sensitive action/goal bias, plasticity и personality evidence.

## Что обнаружено

| Источник | Функциональное пересечение | Решение B288 |
|---|---|---|
| `SocialMindKernel` | intent/repair/relationship state | legacy adapter; данные консолидируются в canonical person state |
| `SocialPredictiveNeuralSubstrate` | social neural prediction | legacy predictive evidence; B288 является новым canonical self/other substrate |
| `SocialWorldModel` | social need/valence prediction | upstream textual/semantic evidence; не отдельный relationship owner |
| `RelationshipSelf` | trust/warmth/predictability/boundary | compatibility source |
| `LongTermSocialMind` | relationship history/shared commitments | long-term adapter |
| `SocialDevelopmentSystem` | prediction + social value + repair | compatibility source; B288 absorbs numerical relationship state |
| `AutonomousRelationshipManager` | contact continuity/initiative | autonomy/activity evidence source |
| `AutonomousSocialInitiativeEngine` | proactive social decisions | initiative evidence source; policy arbitration remains canonical |
| `B287RelationshipValueDevelopmentCore` | neural relationship value/plasticity | predecessor/legacy learning source; B288 is canonical social-brain state |

## Почему модули пока не удалены

Некоторые из них используются другими частями `OrganismCore`, `MemorySubsystemRuntime` и persistence schemas. Без доказательства эквивалентности механическое удаление было бы хуже: оно повысило бы локальную простоту ценой потери поведения.

Поэтому B288 вводит постепенную консолидацию:

1. старые системы остаются источниками evidence;
2. B288 сводит их в один person-specific recurrent state;
3. измеряется `legacyAdapterCoverage01`;
4. измеряется `legacyConflict01`;
5. action/goal arbitration постепенно переносится на B288;
6. после независимого доказательства старые runtime owners могут быть retired/deleted.

## Текущее состояние консолидации

Полная adapter coverage в synthetic consolidation test: `1.0`.

Количество deduplicated source identities: `9`.

То есть все девять исторически пересекающихся источников теперь имеют явный путь в канонический social brain вместо неявного двойного владения.

## Критерий удаления legacy-модулей

Модуль можно удалить только после того, как выполнены одновременно:

- behavioural equivalence на Core;
- snapshot/migration equivalence;
- hidden-task non-regression;
- personality evidence non-regression;
- causal-lesion non-regression;
- отсутствие других runtime callers;
- отдельный rollbackable release.

До этого удаление запрещено.
