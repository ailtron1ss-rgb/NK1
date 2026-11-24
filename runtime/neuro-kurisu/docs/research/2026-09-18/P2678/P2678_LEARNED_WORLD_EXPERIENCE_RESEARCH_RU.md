# P2678 — Learned World Experience Memory / research

## Цель
Перевести world-model stack от преимущественно модельных bias-сигналов к накоплению непосредственно наблюдавшихся контекст→действие→исход связей.

## Исследовательские основания
- Active inference (Nature Communications, 08.09.2026): действия могут выбиратьcя с учётом ожидаемой информационной ценности и value; информация используется для различения конкурирующих моделей мира.
- World Models for Embodied Intelligence (arXiv:2609.16697, 15.09.2026): полезность world model должна измеряться влиянием на planning, action, learning, verification, recovery и data selection, а не только правдоподобием генерации.
- TMoW (arXiv:2601.22647): test-time routing между world models, prototype-based routing и расширение смеси на новых доменах.
- Modular Memory is the Key to Continual Learning Agents (arXiv:2603.01761): модульная память должна дополнять in-weight learning быстрым накоплением опыта и снижать проблему catastrophic forgetting.
- Nature Neuroscience 2026: information gathering может быть связано не только с абсолютной uncertainty, но и с относительным балансом evidence между альтернативами; это мотивирует будущий policy-information-gain calibrator.

## Реализованный эксперимент P2678
B2524 `NonparametricWorldExperienceMemory` — bounded prototype memory. Каждая запись содержит компактный контекст, действие, reward, prediction error, count и success. При решении выполняется k-nearest/prototype retrieval с kernel weighting; после outcome ближайший опыт обновляется либо создаётся новый prototype.

## Архитектурная цепочка
`latent/internal state -> B2524 experience retrieval -> B2522 mixture routing -> B2523 verification -> action -> outcome -> B2524 update -> B2522 source credit`

## Важное исправление P2678
B2522 получил source-specific credit assignment. Ранее одинаковый итог мог обновлять reliability всех источников почти одинаково; теперь update зависит от exposure, signed contribution и alignment конкретного источника.

## Ограничения
B2524 — лёгкая непараметрическая память, а не полноценная нейронная world model. Она предназначена как bridge к дальнейшему learned latent transition model и causal intervention memory.
