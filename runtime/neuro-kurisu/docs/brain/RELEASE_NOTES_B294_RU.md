# Release Notes B294

## B294 — Causal Neural Event Spine

Главное изменение: введён bounded causal event-linked neural credit-assignment layer.

### Verified
- standalone 1200 decision/outcome cycles;
- 1200 learning updates;
- 66 635 synaptic updates;
- 8 752 spike events;
- B294 core integration;
- 6/6 local function contracts;
- restart persistence;
- concurrency;
- UI and server;
- Live2D integrity;
- full project audit;
- mobile 1000-cycle horizon, p95 144.80 ms.

### Design principle

B294 не владеет личностью, памятью, целями или финальным выбором. Он распределяет причинный credit между существующими owners и возвращает небольшой bounded action bias.

### Research boundary

Нейронный контур является инженерной spiking/recurrent abstraction. Он не является биологическим brain simulation и не является доказательством субъективного сознания.
