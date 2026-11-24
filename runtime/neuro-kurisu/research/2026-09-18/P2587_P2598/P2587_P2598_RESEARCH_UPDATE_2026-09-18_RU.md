# Дополнение исследования P2587–P2598 — 18.09.2026

После внедрения кода проведён повторный внешний обзор свежих работ сентября 2026 года.

## 1. Actionable world model как критерий результата

Yao et al. предлагают оценивать world model не по визуальной правдоподобности самой по себе, а по тому, даёт ли предсказание измеримый выигрыш в планировании, действии, обучении, проверке, восстановлении и выборе данных. Это соответствует нашему контуру `prediction → action → consequence → verification → learning → transfer` и объясняет, почему H1/H2/H4/H8/H16 тестируются через downstream-поведение.

## 2. Dream rehearsal и channel forgetting

Nijjer показывает на continual model-based RL, что сохранённая память не гарантирует сохранение поведения: actor может забывать при сохранном world model. Градуированная dream rehearsal с self-imitation использовалась для восстановления навыка без нового взаимодействия с внешней средой. В Neuro Kurisu эта идея уже представлена ограниченной внутренней репетицией P2575–P2586; P2587–P2598 переносит её результаты в процедурный skill substrate.

## 3. Causal Action Effect Reweighting

CAER предлагает переносить больше обучающего сигнала на части прогноза, причинно затронутые действием, а не равномерно распределять loss. В проекте реализована лёгкая `CAER-inspired` эвристика для latent dynamics. Это не утверждается как полная реплика оригинального алгоритма.

## 4. Высокоуровневые действия как средство уменьшения стоимости планирования

`Lifting Embodied World Models for Planning and Control` показывает направление, в котором высокоуровневый action/goal переводится в последовательность низкоуровневых действий; такой слой уменьшает размер пространства поиска. Это мотивирует дальнейшее развитие option-like `TransferableEmbodiedSkillSystem` вместо расширения только прямого action table.

## 5. Embodied-brain stack и shared contracts

Работа `From World Action Models to Embodied Brains` выделяет совместимые контракты между world model, action space, verification, tools/controllers и trace logging. Это совпадает с архитектурным приоритетом проекта: новые экспериментальные модели должны подключаться через проверяемые state/decision/outcome интерфейсы, а не создавать параллельные независимые мозговые ветви.

## 6. Risk / uncertainty / recoverability

RIWM-перспектива подчёркивает, что вероятность/правдоподобие будущего недостаточны: важны последствия, вмешательство, epistemic uncertainty и recoverability. Это поддерживает дальнейшее расширение текущих uncertainty/verification/recovery метрик, особенно для H8/H16.

## 7. Что это меняет в дорожной карте

Следующий блок должен не просто увеличивать число навыков. Приоритеты: `task-id-free transfer`, консолидация процедурных прототипов, adversarial intervention tests, recovery после намеренно ошибочного world model, calibrated uncertainty для H8/H16, high-level options, реальные Android sensor/thermal measurements и связка этих сигналов с автономным budgeting.
