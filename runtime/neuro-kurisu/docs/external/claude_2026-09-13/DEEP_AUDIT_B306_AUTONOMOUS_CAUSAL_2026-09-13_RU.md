# Глубокий аудит B306 — причинная проверка автономной инициативы
Дата: 13.09.2026

## 1. Почему B306 нужен

В B305 проект уже умел регистрировать автономные решения и имел большой набор автономных модулей. Однако факт `autonomousDecisions > 0` сам по себе не доказывает, что внутренняя автономная причина реально изменила выбор действия.

B306 поэтому не создаёт новый autonomous brain. Он добавляет causal verification поверх существующего `AutonomousPersonhoodKernel` и существующего выбора действия.

Проверяемая цепочка:

`внутреннее состояние -> autonomous plan -> kernel bias -> ranking action -> outcome -> persistence`

## 2. Главное изменение

Добавлен `src/organism/system/B306AutonomousInitiativeVerificationLedger.ts`.

Ledger не выбирает действие и не обучает личность. Он фиксирует:
- было ли внешнее пользовательское событие;
- был ли автономный режим разрешён;
- возникла ли self-authored agenda;
- вклад `AutonomousPersonhoodKernel` в выбранное действие;
- counterfactual score после удаления этого вклада;
- изменилось ли место действия в ranking;
- был ли результат успешным.

`AutonomousPersonhoodKernel` получил контролируемый lesion. При lesion 0.90 сумма внутренних action-bias в unit-test снизилась с `0.314049` до `0.031405`.

## 3. Live evidence

B306 live test: `tests/big-pass-306-autonomous-causal-verification.mjs`

- 16 decision cycles;
- 16/16 autonomous-eligible без внешнего текста;
- 2 self-authored agenda creations;
- 12/16 решений causally influenced by the autonomous-personhood kernel;
- causal influence rate `0.75`;
- causal success rate `0.9167`;
- mean kernel bias `0.07717`;
- mean counterfactual selected-vs-alternative margin `-0.05498`;
- restart сохранил 16 decisions и 12 causally-influenced decisions;
- lesion `0.95` сохраняется после restart.

Простыми словами: в этих 12 случаях, если мысленно убрать вклад конкретного автономного ядра, выбранное действие перестаёт быть лучшим. Это гораздо сильнее, чем просто увидеть действие без пользовательского запроса.

## 4. Реальная нейронность в том же окружении

Старые проверки после B306:
- B296: 16 learning updates и 2496 synaptic updates в B305 critical path;
- B296 standalone/core regression: 5784 synaptic updates в standalone neural run, core learningUpdates=40;
- B305 critical path: PASS.

B306 не заменяет neural substrate и не пишет собственные «нейроны».

## 5. Persistence finding и исправление

Первая версия B306 прошла live causal test, но потеряла ledger при restart. Причина была в migration mapping `StateMigrations.ts`.

Исправлено:
- добавлено typed field `b306AutonomousInitiativeVerification`;
- добавлено preservation mapping;
- повторный restart тест проходит.

Это важный результат проверки: до исправления release не считался готовым.

## 6. Что B306 не доказывает

B306 не доказывает субъективное сознание, свободную волю или человеческое понимание.

Он доказывает более узкую инженерную вещь: существующий autonomous-personhood kernel имеет измеримый причинный вклад в выбор действия и этот вклад можно ослабить lesion-интервенцией.

## 7. Связь с предыдущими ветками

B298: neural/causal closed loop.
B299/B300: causal personality development и contextual personality.
B301: mobile state economy.
B302: long-horizon ledger.
B303/B304: holdout/generalization.
B305: critical-path verification.
B306: причинная атрибуция автономной инициативы.

Новый модуль не должен становиться вторым центром автономии; он является evidence layer над существующим runtime.

## 8. Ограничения

1. Реальный Android/Termux hardware benchmark в этой среде невозможен; B305 host-proxy benchmark не является сертификацией телефона.
2. P6/P7 ещё не закрыты.
3. Semantic verification debt остаётся большим и требует прицельной проверки критической цепочки.
4. Consciousness evidence остаётся низким и не должен повышаться только из-за B306.
