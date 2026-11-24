# P41 — Semantic Perception & Real Sensing

## Практический эффект шага
P41 превращает вход камеры/микрофона/сенсоров в настоящий многоуровневый perception pipeline. Если доступны сырые RGB и audio samples, система извлекает реальные локальные физические признаки на устройстве; если semantic backend установлен, его структурированные сущности/события/отношения попадают в temporal semantic graph; если backend отсутствует, организм не притворяется, что понял изображение или звук, а создаёт pending perception task.

## Архитектурная идея
P41 разделён на два связанных слоя:

1. `P41NativePerception` — дешёвый local signal processing для raw RGB/audio.
2. `P41SemanticPerception` — temporal semantic state, entities, events, relations, provenance, unresolved work, modality reliability и action-relevant perception bias.

Так сохраняется честная граница:
**signal recognition != semantic understanding**.

## Что реально работает
- raw RGB sampling и image statistics;
- audio RMS, zero-crossing, band-energy и acoustic cues;
- bounded histories;
- temporal object continuity;
- event persistence;
- modality reliability;
- semantic provenance;
- unresolved vision/audio queue;
- active perception priority;
- action bias от perception state;
- persistence и migration;
- server API.

## Что пока не заявляется
- human-level vision;
- human-level speech understanding;
- self-trained foundation vision/audio encoder;
- phenomenal consciousness.

## Главный инженерный принцип
Нельзя превращать наличие raw media в ложный semantic claim. Без semantic backend P41 сохраняет физический signal result и explicit unresolved task.

## Phone design
P41 ограничивает raw RGB sampling до bounded pixel budget и хранит ограниченные histories. Audio analysis использует линейные time-domain расчёты вместо полного FFT, чтобы hot path оставался пригодным для среднего телефона.
