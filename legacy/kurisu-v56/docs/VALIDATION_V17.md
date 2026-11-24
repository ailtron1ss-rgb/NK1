# Validation — v17

Date: 2026-08-13

## Core TypeScript

Command:

```bash
npm run validate:core
```

Result: **PASS** with TypeScript 5.8.3.

The checked set includes the cognitive modules and `BrainOrchestrator`.

## Runtime smoke test

The cognitive organism was transpiled to CommonJS and executed with a mocked `localStorage`.

Verified:

- attention winner is produced;
- organism turn is produced;
- meta-cognition updates;
- persistent state can be serialized;
- no runtime exception in the new cognitive path.

## Full build

`npm install --no-audit --no-fund` was attempted in the isolated environment but exceeded the execution time limit. Therefore a complete Vite/Express production build is **not claimed**.

## Model verification

Current Hugging Face checks confirm:

- Qwen3 0.6B Instruct ONNX exists and provides `model_q4f16.onnx` (648 MB) and other quantizations.
- Phi-3.5 Mini Instruct ONNX Web exists and provides a 220 MB Q4F16 ONNX artifact.

## Known limitation

Browser ONNX inference is still not equivalent to a native GGUF/llama.cpp backend. v17 deliberately does not pretend otherwise.
