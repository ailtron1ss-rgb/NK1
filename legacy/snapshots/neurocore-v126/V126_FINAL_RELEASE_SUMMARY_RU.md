# V126 — Final Release Summary

**Current:** V126 / 1.26.0 / `v126-consolidation-runtime`

## Проверено

**95/95 current tests PASS** · compileall PASS · verify_current PASS · checkpoint 108/108 · decontamination PASS · executable stubs 0 · inert config PASS · truthful registry PASS · 1 canonical recurrent owner · 100% gradient tensor/element coverage.

## Реальный результат

Fast→slow consolidation теперь действительно входит в trainer при opt-in `interval_steps`. Functional sparse-delta write сохранил autograd и убрал прежнюю серию clone/concat/in-place операций. Production и qualification используют один sparse-memory read path. Version metadata теперь имеет единый source of truth.

## Что не скрывается

Consolidation, unified sparse memory и fingerprint не promoted. Их runtime-жизнь доказана, но устойчивое downstream-превосходство ещё не доказано. Sparse runtime по-прежнему требует segmented/paged исполнения для низкобатчевого CPU.

## Следом

V127: collision-resistant addressing, segmented sparse runtime и matched continual-learning qualification.

Дополнительный sparse-gradient liveness probe: все 10 trainable tensor paths sparse-memory проявились как живые хотя бы в одном из 3 независимых seed; это не означает, что каждый sparse routing parameter получает градиент на каждом отдельном batch.
