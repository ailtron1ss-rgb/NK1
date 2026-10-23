# WorkPass402 — строгая проверка семейств в реальном пути promotion

## Найденный разрыв связности

WorkPass400 добавил veto для регрессий validation-family, а WorkPass401 — настраиваемые минимумы family coverage. Но реальный путь активации `P23LearningEngine.approveIndependentlyEvaluatedSkillCandidate` вызывал `compareMatchedIndependentEvaluations(baseline, evaluation)` без строгих параметров. Поэтому диагностический API понимал новую политику, а production promotion мог случайно остаться на совместимом default-профиле и принять отчёты без меток семейств.

## Исправление

### 1. Передача политики через независимый оценщик

`compareMatchedIndependentEvaluations` теперь принимает типизированный третий аргумент `SkillLearnBenchCandidateGateOptions` и передаёт его в общий `evaluateSkillLearnBenchCandidate`. По умолчанию параметры не меняются, поэтому старые диагностические вызовы совместимы.

### 2. Fail-closed policy в P23 production activation

`approveIndependentlyEvaluatedSkillCandidate` теперь вызывает comparator с фиксированной внутренней политикой:

- `minimumValidationFamilies: 1`
- `minimumHoldoutFamilies: 1`
- `minimumValidationFamilyTasks: 2`
- `minimumHoldoutFamilyTasks: 2`

Пользователь или генерируемый навык не может отключить эти minima через опции — у production entry point нет аргумента для переопределения. У каждой части evaluation должны быть хотя бы две distinct canonical tasks в одном семействе. Семейные labels должны быть получены из доверенного experiment manifest: `createIndependentSkillCandidateEvaluator` уже разрешает семейство из `experimentAuthority.manifest` поверх caller-provided `taskFamily`, а существующая регрессия WorkPass213 проверяет, что поддельная метка заменяется canonical manifest value.

Если семейная разметка отсутствует или недостаточна хотя бы в validation либо holdout, comparator добавит соответствующую причину coverage failure и активация будет отвергнута до записи нового active version. Диагностические и исторические сценарии, не использующие production activation, могут явно/по умолчанию сохранять совместимый режим.

### 3. Регрессия и CI

`tests/workpass225-matched-independent-evaluation.mjs` теперь передаёт строгие minima в comparator с отчётами без family metadata и проверяет нулевую coverage плюс обе причины отказа. P26 workflow добавлен в path filter для этой тестовой оболочки и запускает её отдельным шагом на Node.js 24.

Другой существующий тест `workpass203-independent-candidate-evaluator.mjs` проверяет, что labels получаются из canonical manifest, а не из вызывающего кода. Вместе эти проверки закрывают связь от источника family identity до фактической promotion policy.

## Связь с исследованиями

[SkillLearnBench](https://arxiv.org/abs/2604.20087) оценивает skill quality, trajectory quality и task outcome на verified задачах из 15 поддоменов; получаемые улучшения не универсальны для всех задач. [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) мотивирует separation между генерацией, тестированием и promotion под guardrails. NK1 адаптирует проверку доменного покрытия в свой существующий evidence-bound pipeline, а не вводит отдельную параллельную систему.

## Ограничения

- Один family с двумя задачами на split — минимальный структурный gate, а не достаточная статистическая мощность для доказательства generalization.
- По-настоящему production-grade профиль всё ещё требует нескольких paired seeds на family, доверительных интервалов/оценки шума и закреплённого manifest fingerprint.
- Код и регрессия закоммичены на `feature/learning`, но успешное исполнение теста и typecheck не подтверждено: GitHub Actions продолжает возвращать failure без доступного списка шагов или лога. Не делать вывод, что новая проверка прошла runtime.
- `main` и Release ZIP этим проходом не изменялись.
