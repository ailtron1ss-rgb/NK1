# Исследовательский обзор B2201–B2500 — 16.09.2026

## Зачем этот этап

Цель — превратить persistent continuity из проверки состояния в причинную модель жизненной истории: незавершённые намерения, проекты, поведенческие паттерны, автобиографические события, самоописания и развитие должны участвовать в следующем выборе.

## Основные внешние направления

1. Lifelong learning for agents: TPAMI 2026 survey выделяет память, perception и action как взаимосвязанные опоры continual adaptation и борьбы с catastrophic forgetting.
2. WorldEvolver (2026): episodic memory + semantic memory + selective foresight; world model должен пересматриваться по mismatch, а низкоуверенные rollouts фильтроваться.
3. LWM-Planner (AISTATS 2026): task-critical facts, predictive-consistency filter и lookahead используют прошлый опыт непосредственно в выборе действия.
4. EvolvingAgent / EvoAgent: self-planning, self-reflection, continual world model и self-evolving curriculum для long-horizon tasks.
5. ECHO (ACL 2026): critic и policy должны коэволюционировать, иначе feedback становится stale по мере изменения policy.
6. CRPS (ACL Findings 2026): curriculum replay может структурировать обучение по progressive suffixes успешных траекторий.

## Что адаптировано под Neuro-Kurisu

- canonical life-course self-model вместо ещё одного плоского memory store;
- persistent commitments с recoverable status;
- autobiographical event chain и life narrative hash;
- self-beliefs с confidence/stability/evidence/contradiction;
- behavioural fingerprint с anchor и допустимым developmental drift;
- self-model causal readout, который реально меняет action bias;
- bounded event retention и selective forgetting;
- restart preservation of unfinished commitments;
- lesion testing для commitments/self-beliefs/causal-self.

## Важное ограничение

Внешние benchmark-результаты не переносятся автоматически на проект. В этом релизе собственные цифры должны считаться primary evidence.
