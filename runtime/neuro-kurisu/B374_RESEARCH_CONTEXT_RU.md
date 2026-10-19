# B374 — Research Context

B374 выбирает следующий архитектурный слой на основе исследований 2025–2026 годов, но не копирует их напрямую.

## 1. Temporal self / autobiographical memory
Работа Scientific Reports (2025) рассматривает сеть, связанную с ментальной проекцией себя через episodic autobiographical memories. Для Neuro-Kurisu это трансформировано в инженерный принцип: прошлые verified self-transitions должны участвовать в формировании future-self, а не быть только журналом.

## 2. Self как internal predictive model
Обзор роботических моделей temporal self описывает self-модель как внутреннее предсказание регулярностей сенсорного взаимодействия; agency может быть связано с предсказанием результатов собственных движений. B374 переносит это в действие-conditioned self prediction и causal policy field.

## 3. Lifelong embodied learning
Nature Machine Intelligence (2025) показывает важность continual accumulation, reuse и generalization в robotic lifelong reinforcement learning. B374 поэтому ограничивает память, использует consolidation и не делает full retraining.

## 4. Continual memory consolidation
Nature Communications (2025) показывает пользу dual specific/generalized memory для снижения catastrophic forgetting. B374 сохраняет конкретные autobiographical traces и извлекает из них устойчивые stable/future self representations.

## 5. Self-evolving embodied AI
Работы 2025–2026 годов по self-evolving embodied AI подчёркивают continuous internal-state feedback, memory updating, self-adaptation и long-horizon operation. В B374 это выражается как internal neural self-state → verified experience → developmental self update.

## Source / Implemented separation
SOURCE ≠ IMPLEMENTED.
Research papers задают design hypotheses. Реализованными считаются только механизмы, которые прошли source/runtime/causal/persistence evidence в самом проекте.
