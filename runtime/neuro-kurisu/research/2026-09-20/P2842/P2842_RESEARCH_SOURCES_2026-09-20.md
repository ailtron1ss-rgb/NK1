# P2842 — Research sources (2026-09-20)

## 1. World models for embodied intelligence
Yao et al., 2026, *World Models for Embodied Intelligence: From Plausible to Controllable to Actionable*.
Key implication: evaluate world models by whether predictions improve planning, action, learning, verification, recovery and data selection; not by visual plausibility alone.
Source: https://arxiv.org/abs/2609.16697

## 2. Query-conditioned / intervention-aware world models
Thorpe et al., 2026, *Physically Viable World Models: A Case for Query-Conditioned Embodied AI*.
Key implication: the model should preserve the distinctions relevant to the intervention being queried; prediction of observations alone is insufficient.
Source: https://arxiv.org/abs/2605.30542

## 3. Self-evolving causal world modelling
Yu & Inamura, 2026, *Self-Evolving Cognitive Framework via Causal World Modeling for Embodied Scientific Intelligence*.
Key implication: embodied interaction can be treated as an epistemic process for causal hypothesis generation, intervention-driven feedback and continual causal-model refinement.
Source: https://arxiv.org/abs/2606.22449

## Project application
P2842 implements the lightweight subset that fits the existing mobile runtime:
- exact pre-action prediction tickets are tracked and resolved after the action;
- external verification metadata becomes part of causal calibration;
- repeated matched context trials gate promotion readiness;
- active perception gain is recorded from actual sensor coverage plus consequence surprise/error;
- calibration survives restart through the existing persisted system state.

No heavyweight external world model is imported into the phone hotpath.
