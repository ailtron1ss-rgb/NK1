# BIG PASS 188 — MASTER FUNCTION REALITY AUDIT

Generated: 2026-09-11T05:39:48.413Z

## Rule

function is complete only when behavioral evidence exists; static existence never counts as completion

## Global inventory

Semantic source functions: **2650**
Function-like declarations in liveness sweep: **2734**
Functions with bodies: **2705**
Zero static references: **158**
One-or-less static references: **490**

## Behavioral evidence

Parameterized attempted: **555**
Parameterized passed: **541**
Parameterized skipped (unsafe): **30**
Lifecycle-needed: **12**
Parameterized failures: **0**

Snapshot/restore closure: **207/207 PASS**

Strict VERIFIED: **38 / 2650 = 1.43%**
Evidence coverage: **7.23%**

## By domain

| Domain | Total | Verified | Integration | Unsafe | Unverified |
|---|---:|---:|---:|---:|---:|
| infrastructure | 885 | 17 | 281 | 97 | 490 |
| perception | 208 | 0 | 31 | 69 | 108 |
| agency | 185 | 0 | 33 | 13 | 139 |
| world | 406 | 2 | 90 | 22 | 292 |
| learning | 470 | 0 | 71 | 21 | 378 |
| consciousness | 59 | 14 | 7 | 4 | 34 |
| self | 208 | 0 | 54 | 2 | 152 |
| emotion | 17 | 0 | 4 | 0 | 13 |
| memory | 212 | 5 | 43 | 1 | 163 |

## Non-negotiable interpretation

- VERIFIED is not a consciousness claim.
- INTEGRATION_ONLY is not a completion claim.
- UNSAFE_TO_AUTO_RUN requires a dedicated controlled test.
- UNVERIFIED remains incomplete regardless of how much code exists.

## Current highest-value gap

The largest gap is behavioral evidence across the 1769 unverified functions.
The next passes must target the highest-criticality stateful functions and attach direct, regression, persistence or replay evidence.