# Neuro-Kurisu 34.24.0 — BIG PASS 53

## Главный результат
Perception получает единый `PerceptualEvidenceCompiler`: native P41, semantic P41, temporal P41 и multimodal evidence теперь сводятся в один bounded provenance layer. Это не объявляет наличие полноценной нейронной vision/audio системы.

## Изменения
- perceptual evidence state с confidence/uncertainty/provenance/parent links;
- active perception query поднимается в единый summary;
- persistence/restore нового perception layer;
- perception API расширен semantic/evidence summaries;
- camera capture получил opt-in `retain`; default cleanup сохранён;
- release source синхронизирован на 34.24.0.

## Проверки
- typecheck;
- BIG PASS 53 grounding test;
- P41 semantic/native/performance;
- relevant P17/P40/P41/P42-P44/P50-P82 integration;
- release source/integrity/archive gates.
