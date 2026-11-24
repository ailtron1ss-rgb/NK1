# Brain Branch Progress — BIG PASS 208

## Current position

**Ветка:** Карта искусственного мозга
**Последний закрытый проход:** B-M3 / BIG PASS 208
**Статус:** implemented + regression-checked + archive-checked

## Закрытые уровни

| Уровень | Pass | Состояние |
|---|---|---|
| Brain ontology / map | 207 | implemented |
| Thalamocortical gating | 207 | implemented-partial |
| Basal ganglia action selection | 208 | implemented-computational-analogue |
| Memory → World causality | 205 | verified controlled links |
| World → Agency → Learning | 206 | verified controlled ablation |
| Cross-domain closure | 204 | 18/18 complete |

## Реальный cumulative proof

### B204
- 18/18 complete cycles
- continuity ≈ 0.9961
- memory→world = true
- world→agency = true
- agency→learning = true
- learning→self = true
- restore = PASS

### B205
- 6/6 controlled Memory→World links verified
- measurable prediction delta ≈ 0.03543
- restore = PASS

### B206
- controlled World→Agency→Learning status = verified
- live cycle records remain unverified until ablation
- restore = PASS

### B207
- 18 brain systems
- 18 brain edges
- thalamocortical state-dependent gate integrated into CognitiveKernelCoordinator
- low/high resource gating verified
- restore = PASS

### B208
- explicit direct / indirect / hyperdirect-like basal-ganglia signals
- dopamine-gated action plasticity
- action eligibility trace
- reversible lesion test
- coordinator integration
- Core persistence
- Core restart restore
- atlas binding

## Current largest gaps

1. Explicit striatum / GPi / GPe / STN / SNr state dynamics.
2. Dorsal vs ventral striatal territory separation.
3. Motor / associative / limbic loop separation.
4. Full cortico-basal-ganglia-thalamo-cortical motor loop.
5. Cerebellar predictive-control analogue.
6. Hypothalamus/brainstem explicit arousal and sleep architecture.
7. Neuromodulatory source→target projection graph.
8. Glia, vascular/metabolic and immune computational layers.
9. Multiscale cortical area graph and laminar dynamics.
10. Whole-brain causal replay/lesion battery.

## Rule for future passes

Новый мозговой компонент не считается закрытым только потому, что появился код. Он должен иметь:

1. owner в Brain Atlas;
2. explicit computational contract;
3. controlled test;
4. ablation/lesion test, где применимо;
5. persistence/restart evidence;
6. integration evidence;
7. regression against previous passes;
8. explicit remaining biological gaps.

## Следующий большой проход

**B-M4 Cerebellar Predictive Control**:

fast forward model → timing → sensorimotor prediction error → calibration → action refinement,
с отдельным ablation proof и ограниченным CPU/RAM budget для мобильного runtime.
