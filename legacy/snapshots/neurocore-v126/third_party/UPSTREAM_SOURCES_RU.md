# NeuroCore V92 — upstream source registry

NeuroCore теперь предпочитает source-backed reuse: published neural mechanisms рассматриваются как внешние backend candidates и подключаются через единый контракт только после qualification.

## Основной upstream pool

`flash-linear-attention` — MIT; актуальный main перечисляет GDN-2, Raven, PGDN, PKDA, Mamba-3, KDA, DeltaFormer, MoM, Wall, Parallax, CAT и другие реализации.

Repo: https://github.com/fla-org/flash-linear-attention
ZIP: https://github.com/fla-org/flash-linear-attention/archive/refs/heads/main.zip

## Direct candidates

### Preconditioned DeltaNet
Repo: https://github.com/ntumm120/preconditioned-deltanet
ZIP: https://github.com/ntumm120/preconditioned-deltanet/archive/refs/heads/main.zip

Нужен для PGDN/PKDA/ATK reference и сопоставления с текущим preconditioner.

### Official Mamba-3
Repo: https://github.com/state-spaces/mamba
ZIP: https://github.com/state-spaces/mamba/archive/refs/heads/main.zip

Official Mamba-3 implementation. Полный оптимизированный путь ориентирован на accelerator stack.

### Portable Mamba-3
Repo: https://github.com/Aiyoniganmaaiya/mamba3-ssm
ZIP: https://github.com/Aiyoniganmaaiya/mamba3-ssm/archive/refs/heads/main.zip

Readable PyTorch reference; upstream README указывает API `Mamba3`, `step`, inference cache и 10/10 sanity tests.

### DeltaProduct
Repo: https://github.com/automl/DeltaProduct
ZIP: https://github.com/automl/DeltaProduct/archive/refs/heads/main.zip

Candidate for more expressive state transitions.

### H-Net
Repo: https://github.com/goombalab/hnet
ZIP: https://github.com/goombalab/hnet/archive/refs/heads/main.zip

Candidate for dynamic hierarchical temporal abstraction.

### ATLAS Torch
Repo: https://github.com/danielquintas8/atlas-torch
ZIP: https://github.com/danielquintas8/atlas-torch/archive/refs/heads/main.zip

Research-only until long-term-memory cost/benefit is qualified.

### Titans PyTorch
Repo: https://github.com/lucidrains/titans-pytorch
ZIP: https://github.com/lucidrains/titans-pytorch/archive/refs/heads/main.zip

Research-only candidate for test-time learned memory.

### Official NVIDIA GDN-2
Repo: https://github.com/NVlabs/GatedDeltaNet-2
ZIP: https://github.com/NVlabs/GatedDeltaNet-2/archive/refs/heads/main.zip

Research-only in NeuroCore because its license is different from the MIT source pool.

## What is actually vendored in V92

В текущей sandbox-среде GitHub/PyPI не разрешили получить archive bytes, поэтому V92 **не притворяется**, что содержит полные upstream repositories. Встроен registry/intake/adapter слой и provenance. После загрузки ZIP можно выполнить безопасный intake:

`python scripts/admit_upstream_source.py <repo.zip> --name <stable-name>`

Чужой код не выполняется автоматически.
