# V92 — Source-backed fusion

## Почему

NeuroCore не должен повторно реализовывать опубликованные sequence-механизмы только ради появления ещё одного файла. Внешние реализации нужно сохранять с provenance и подключать через единый контракт.

## Правило

`DISCOVER → SOURCE/LICENCE AUDIT → VENDOR/IMPORT → ADAPTER → MATCHED QUALIFICATION → PROMOTE/REJECT`

## Архитектурный контракт

Current владеет:

- canonical recurrent state;
- memory ownership;
- routing policy;
- replay/learning policy;
- checkpoint ABI.

Upstream владеет только математическим/операционным backend-ом, если его source и лицензия это допускают.

Это не допускает второго canonical memory owner.

## Целевые backend families

1. DeltaNet/Gated DeltaNet
2. Gated DeltaNet-2
3. Kimi Delta Attention
4. Preconditioned GDN/KDA
5. Raven
6. Mamba-3
7. DeltaProduct
8. Dynamic hierarchical sequence models (H-Net)
9. Long-term memory candidates (MoM/Titans/ATLAS)

## Admission

Backend не становится integrated из-за paper/demo. Минимальный gate:

- shape + forward correctness;
- backward/gradient flow;
- matched parameter/state budget;
- multiple seeds;
- task-specific metric;
- long-horizon / interference test, если backend memory-like;
- resource measurement;
- license/provenance record.
