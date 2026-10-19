# External Research Sources — 2026-09-20 / P2836

## 1. V-JEPA 2 — world-model direction

Source: https://ai.meta.com/research/vjepa/
Paper: https://ai.meta.com/research/publications/v-jepa-2-self-supervised-video-models-enable-understanding-prediction-and-planning/

Finding used by P2836: separate prediction/planning world-model capacity from the real interaction/evidence loop. V-JEPA 2 is explicitly positioned as a self-supervised world model for understanding, prediction and planning, with a later alignment to robot interaction.

## 2. Interpreting Physics in Video World Models — 2026

Source: https://ai.meta.com/research/publications/interpreting-physics-in-video-world-models/

Finding used by P2836: physical information may emerge as distributed hierarchical representations instead of a single compact physics-engine state. This supports keeping the project's neural substrate distributed/recurrent rather than collapsing all physical reasoning into one scalar state vector.

## 3. Titans — test-time neural memory

Source: https://research.google/pubs/titans-learning-to-memorize-at-test-time/

Finding used by P2836: long-term memory can be updated during inference/test time and can complement short-term attention/context. The project uses only the architectural idea in a compact controller; it does not import Titans weights or reproduce its full architecture.

## 4. Nested Learning — multi-timescale learning

Source: https://arxiv.org/abs/2512.24695

Finding used by P2836: learning can be decomposed into nested/parallel processes with different context flows. This motivated the fast/slow replay thermostat in P2820.

## 5. NeuralBench — standardized NeuroAI evaluation

Source: https://ai.meta.com/research/publications/neuralbench-a-unifying-framework-to-benchmark-neuroai-models/

Finding used by P2836: future neural-substrate claims should use standardized multi-task evaluation and not rely on a single hand-written test.

## 6. REAL — 2026 embodied-agent source

Source: https://github.com/InternRobotics/REAL

Finding used by P2836: open-world embodied systems increasingly separate visual exploration, communication, tool interaction and real-world deployment, with explicit benchmarked physical episodes. Useful as an external architecture/benchmark reference.

## 7. Kairos — 2026 cross-embodiment world model

Source: https://github.com/kairos-agi/kairos

Finding used by P2836: persistent world representations, world-action modeling and hybrid temporal memory are converging into a single embodied stack. Too large for the current phone hotpath, but relevant for future external model adapters.

## 8. CausalWM — 2026 causal world-model direction

Source: https://github.com/AetherLabsAI/CausalWM

Finding used by P2836: explicit intermediate motion/geometry predictions can be used to constrain future-video prediction. Current project should borrow the principle — explicit causal intermediate states — without importing the large GPU-only model into mobile runtime.

## 9. OpenETA — 2026 closed-loop embodiment harness

Source: https://github.com/OpenMOSS/OpenETA

Finding used by P2836: perception, action, verification and learning should be treated as one measurable physical-world loop with typed tool contracts and bounded rollouts.

## 10. OpenDW / action-conditioned world models

Source: https://github.com/dexmal/OpenDW

Finding used by P2836: action-conditioned future-state prediction is becoming a practical open-source world-model pattern. This is a future adapter target, not a dependency of the current Termux hotpath.
