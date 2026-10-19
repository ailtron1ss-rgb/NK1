# Что такое Neuro/Kurisu простыми словами — P2820

## Что это за проект

Это экспериментальная программная основа искусственного организма/искусственной личности. Сейчас это не «готовая копия человеческого мозга» и не доказанное сознание. Это исследовательская система, в которой уже связаны компактная нейронная ветка, постоянная память, world model, причинное обучение, replay, goals, personality/self-model hooks, адаптивная пластичность и непрерывность состояния.

Главная идея проекта: не заставлять один огромный языковой модуль изображать личность, а постепенно строить внутренний цикл обучения и жизни, где опыт меняет состояние, состояние влияет на решение, действие создаёт последствия, последствия меняют модель мира и память, а память и обучение постепенно меняют будущие решения и устойчивые черты.

## Что происходит при запуске

В штатном runtime создаётся организмный процесс с состоянием и persistence. Дальше драйвер/сервер передаёт ему события и циклы. На каждом цикле система:

1. кодирует вход и обновляет внутреннее состояние;
2. оценивает uncertainty, novelty, goals и homeostasis;
3. использует world model и причинные сигналы для выбора действия;
4. выполняет action/commit в рамках подключённой среды;
5. получает consequence/reward/prediction error;
6. записывает episodic experience;
7. обучает neural substrate;
8. решает, что replay-ить и когда;
9. переносит повторяющиеся полезные события в более медленные memory tiers;
10. обновляет policy, personality-related state и persistent knowledge.

При restart состояние может восстанавливаться, поэтому проект уже ориентирован не на независимые «сессии», а на длительную линию жизни.

## Что действительно стало полезнее после исходного архива

- P2708–P2716: реальная online neural learning/credit coupling вместо только внешних score-обёрток.
- P2720: context-aware neuroplasticity, sparse updates, protected updates и adaptive delay learning.
- P2724: continual/autonomous loop с context shift, replay и resource-aware поведением.
- P2734: fast/meta self-optimization и adaptive replay policy.
- P2742/P2750: online world-model + causal/intervention loop, который влияет на decision и learning.
- P2760: настоящая fast/medium/slow memory с разной частотой обновления и bridge-переносом.
- P2774: model-time replay, episodic compaction и recurrence-gated semantic consolidation.
- P2805: stability/plasticity arbitration, sparse/protected neural updates, slow weight references и selective reset.
- P2820: slow self-knowledge teacher, self-distillation, context-aware adaptive coreset и teacher-aware replay compatibility.

## Какое впечатление даёт запуск

На текущем уровне это больше похоже не на обычного чат-бота, а на экспериментальный cognitive runtime: внутри постоянно есть состояние, память, обучение, прогнозирование и история. Однако без богатой внешней среды он остаётся ограниченным внутренним организмом — он не становится автоматически полноценной самостоятельной человеческой личностью только потому, что запущен.

Для реального medium Android пока остаются ограничения по RSS/CPU и нужен отдельный физический device gate. Поэтому проект уже серьёзно исследует on-device режим, но ещё не имеет права называться полностью готовым Android-организмом.
