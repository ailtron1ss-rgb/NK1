# Future high-value candidates

## A. Unsupervised neural pretraining

Pretrain the ordered text encoder and neural substrate on task-free streams using
prediction/compression/objective families before supervised execution grounding.
Gate later task adaptation with an evidence-based transfer test.

## B. Local credit assignment

Implement a GLE-inspired two-compartment error path and SAL-style local alignment as
separate ablations. The success criterion is a verified-execution gain at matched compute,
not biological resemblance.

## C. Neural value model for partial programs

Train a small value/critic network over `ProgramSketch + partial opcode trace + execution
feedback`. Use it to rank candidate programs before expensive HVM verification.

## D. Neural substrate portfolio

Use `NeuralRoutePolicyV1` to call V9 for easy/low-risk tasks and progressively activate
V11/V12/V13 only when uncertainty/novelty and remaining budget justify the cost.

## E. Astrocyte memory integration

Learn context-specific sparse memory traces and test whether they improve recovery,
continual learning and task-family transfer without increasing catastrophic interference.

## F. Mobile specialization

Measure the same router on the target Termux phone with sustained thermal/battery
telemetry. Do not infer device suitability from host timings.
