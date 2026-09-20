# Concepts

## Parity

Same `ParityTest` executed on local and remote/preview targets; traces compared after normalization.

## Evidence

Findings carry hashed receipts (`EM-###`). See [EVIDENCE_MODEL.md](../../EVIDENCE_MODEL.md).

## Classifications

Including `MATCH`, `RUNTIME_DIVERGENCE`, `INSUFFICIENT_EVIDENCE`, `REMOTE_NOT_CONFIGURED`. Full list in the evidence model.

## Honesty

EdgeMirror never fabricates remote traces. Infrastructure failures are not runtime divergences (Agent 2 invariant).

## DEMO vs real

`edgemirror demo` produces labeled DEMO results in isolation.
