# B367 Causal Evidence

Статус: CURRENT

## B367 predictive closure battery

Seeds: 6
Training cycles: 360/seed

Минимальные значения:

- external field policy L1: **1.604969**
- learned transfer L1: **0.014191**
- forecast lesion L1: **0.006932**
- restart L1: **0**
- forecast confidence: **0.932300+**
- forecast error: **<= 0.058563**

PASS criteria:

- external world model contribution causal — PASS;
- learned internal neural forecast survives without external predictive context — PASS;
- forecast subsystem lesion changes policy — PASS;
- restart preserves behavior exactly — PASS.

## Existing neural regression battery

B365 unified causal:

- minimum lesion L1 = **0.043220**;
- minimum lesion/sham ratio = **5.43**.

B365 outcome transfer:

- minimum policy L1 = **1.086810**.

B366 action commitment:

- all 6 seeds PASS;
- entropy remained below 0.995.

B351 identity/developmental regression:

- history effect L1 = **0.289825**;
- lesion residual = **0.000751**;
- ablation drop = **0.997408**;
- all criteria PASS.

## Persistence

`organism-smoke` PASS.
`restart-persistence` PASS.
B367 neural restart drift = **0**.

## Static release integrity

Forensics: PASS.
Source hygiene: PASS.
Architecture: PASS.
Integrity: PASS.
Release contract: PASS.
Executable syntax: PASS.
Core ownership: PASS.

## Device boundary

`device:preflight`: HOST PASS.
Termux API commands are optional and absent in current host environment.
Therefore physical Android evidence remains unverified.
