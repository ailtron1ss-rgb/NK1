# P41 — Project Assessment

## Практический эффект
Организм получил первую полноценную нижнюю границу между физическим sensing и semantic cognition: raw sensor signals больше не обязаны сразу превращаться в выдуманное «понимание». Это позволяет в будущем подключать разные real vision/audio backends без изменения Personhood/Consciousness/Decision слоёв.

## Что улучшено сверх первоначального плана
- native raw RGB/audio feature extraction;
- pending semantic work вместо fake understanding;
- temporal perception snapshots;
- modality reliability and latency;
- perception-to-action bias;
- deterministic local signal path;
- bounded memory;
- explicit provenance;
- server endpoints for raw/native and semantic perception.

## Новые доказательные требования
1. real device camera capture -> native signal -> semantic backend -> entity track;
2. audio sample -> native features -> semantic event backend -> event continuity;
3. missing backend must produce `pending`, not hallucinated semantics;
4. perception errors must affect uncertainty/verification rather than silently disappear;
5. raw sensing must remain bounded on phone resources.


State schema after P41 temporal layer: 45.
