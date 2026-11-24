# Legacy browser organism

Preserved from the Grok Workspace as historical/reference code. It is **not** the active runtime.

The active application reads and writes organism state only through `src/organism/store.ts` -> `/api/organism/*` -> `runtime/neuro-kurisu`. This directory must not be imported by the active cognitive loop.
