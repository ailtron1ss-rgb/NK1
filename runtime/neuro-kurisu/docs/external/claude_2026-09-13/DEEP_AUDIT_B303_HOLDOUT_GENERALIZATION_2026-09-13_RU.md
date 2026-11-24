# Глубокий аудит B303 — Holdout Generalization & Recovery
Дата: 13.09.2026

## 1. Назначение
B303 не добавляет ещё одну систему личности или ещё один обучающий контур. Это evaluation-only слой поверх B296 → B299 → B302 → B301.

Главная задача B303: проверить, сохраняется ли уже сформированное поведение при переходе из тренировочного семейства контекстов в действительно новый holdout-контекст и после restart.

## 2. Почему выбран именно этот шаг
До B303 проект уже имел:
- B296: реальный spiking/plastic neural substrate;
- B299/B300: causal personality learning и contextual personality;
- B301: mobile state economy;
- B302: long-horizon coordination and consolidation evidence.

Следующий риск был не в отсутствии ещё одного «мозгового модуля», а в том, что многие positive tests проверяют выполнение внутри уже известных контекстов. Поэтому B303 концентрируется на переносе и recovery.

## 3. Что именно добавлено
Файл:
`src/organism/system/B303HoldoutGeneralizationLedger.ts`

Леджер:
- не изменяет policy;
- не учит личность;
- не изменяет reward;
- не заменяет B296/B299;
- хранит bounded evaluation evidence;
- отдельно считает training / holdout / recovery;
- хранит context fingerprints;
- считает novelty holdout относительно training;
- измеряет holdout coherence, evidence rate, policy shift, recovery stability и aggregate transfer score.

## 4. Интеграция
B303 подключён в `OrganismCore` после B299/B302 outcome bridge.

В fingerprint используются уже существующие runtime-параметры:
- social need;
- uncertainty;
- novelty;
- energy;
- autonomy score;
- выбранное действие;
- world/internal outcome class.

Это не отдельное восприятие и не отдельная память личности.

Persistence B303 намеренно не делается на каждом outcome. Изменения синхронизируются:
- на фазовых границах;
- на периодической границе каждые 8 ticks;
- при verified world outcome;
- на полном snapshot.

Причина: B303 — оценочный ledger, а не критическое обучающее ядро.

## 5. Главный тест
`tests/big-pass-303-holdout-generalization.mjs`

Сценарий:
- 80 live ticks training + holdout;
- 60 training pulses;
- 20 holdout pulses;
- 8 recovery pulses после restart;
- 20 full cognitive pulses;
- 60 micro-cycles;
- 5 verified holdout world transitions;
- 80 B296 learning updates;
- 12,480 B296 synaptic updates;
- 80 B299 learning updates;
- 3 B302 consolidation windows;
- restart без потери B303/B296/B299 state.

Длительный тест выполняется внутри `OrganismCore.beginBatch()/endBatch()`. Это убирает побочную стоимость промежуточной persistence из измерения и позволяет измерять именно когнитивную траекторию. В конце snapshot/restart проверяется отдельно.

## 6. Фактический результат
B303:
- holdout coherence: 0.5575;
- holdout policy shift: 0.000289;
- holdout distribution gap: 0.0;
- unseen transfer score: 0.3415;
- evaluation readiness: 0.4567;
- holdout novel context rate: 1.0;
- recovery stability: 0.9992;
- training fingerprints: 48;
- holdout fingerprints: 20.

Performance:
- mean cycle ≈ 43.76 ms;
- p95 ≈ 211.62 ms;
- контейнерный RSS в прогоне ≈ 421 MB.

## 7. Что это означает простым языком
Система получила опыт в одном наборе ситуаций, затем была переведена на другой набор ситуаций, fingerprint которых не совпал с тренировочным набором.

Она не показала разрушения поведения и пережила restart без потери накопленного состояния.

Но это ещё не означает, что организм понял смысл новых ситуаций по-человечески. Это ограниченное доказательство устойчивого переноса/сохранения поведения.

## 8. Что доказано
1. Holdout contexts действительно отличаются от training contexts по текущему fingerprinting protocol.
2. Существующая neural/plastic path продолжает обучаться во время длинного прогона.
3. World-transition evidence продолжает проходить через B294/B299/B302.
4. B303/B296/B299 переживают restore.
5. Runtime остаётся измеримым в mobile profile.

## 9. Что НЕ доказано
- человеческая генерализация;
- сознание;
- субъективный опыт;
- open-ended autonomy;
- длительная автономия на сотнях/тысячах full cognitive pulses;
- работа на реальном Android device с измеренным thermal/RAM profile.

Особенно важно: `holdoutDistributionGap01=0` означает, что выбранные действия по частотам практически не изменились. Это может быть признаком устойчивости, но не доказывает появление новой стратегии.

## 10. Verification debt
B303 также не пытается скрыть существующий verification debt. Большая часть исходного surface area всё ещё не имеет полноценного end-to-end evidence.

Текущий порядок приоритетов:
1. long-horizon full-pulse endurance;
2. stronger unseen-context semantic transfer;
3. mobile RAM/thermal proof on real Android/Termux;
4. independent replication;
5. reduction of unverified function surface.

## 11. Архитектурное решение
B303 оставлен как ledger/evaluator вместо нового learner. Это уменьшает дублирование и не создаёт второй источник истины для личности.
