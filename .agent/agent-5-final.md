# Agent 5 — Final report (Supercharger / Performance)

## Summary

Shipped optional Supercharger under `packages/cli/src/supercharger/` with DAG scheduling, adaptive concurrency, CU accounting (not crypto), governors, content-addressed cache (no remote evidence), incremental/`--fast` selection, parallel minimizer, hardened `runner start`, matrix pruning, measured microbench + Agent 6 gates.

**OSS `edgemirror verify` without `--supercharge` remains the default path** (fixture smoke exit 0).

## Profile first

- Synthetic I/O profile: `benchmarks/profile-baseline.json`
- Bottleneck insight: independent execute jobs benefit from concurrency; wrangler prepare remains dominant for real verify (not claimed as productized speedup)

## Delivered (A5.1–A5.15)

| Item | Status |
|------|--------|
| Profile first | Done |
| Job DAG | Done |
| Adaptive concurrency | Done |
| Content-addressed cache | Done (forbidden kinds for parity evidence) |
| Incremental / `--fast` / `--full` / `--nightly` | Done (nightly=full, labeled) |
| Parallel minimizer | Done (new module) |
| `edgemirror runner start` hardening | Done (token + loopback) |
| CU accounting | Done (explicit non-currency) |
| ECO/BALANCED/FAST/MAX | Done |
| Time-to-confidence priorities | Done |
| Matrix optimization | Done (`pruneCompatMatrix`) |
| Benchmarks measured-only | Done (`supercharge bench`, `benchmarks/README.md`) |
| Native/GPU | Deferred — not profiled beneficial |
| Perf gates for Agent 6 | Done (`.agent/performance-gates.md`) |

## Commands

```text
edgemirror supercharge doctor
edgemirror supercharge plan [--json]
edgemirror supercharge bench [--json]
edgemirror supercharge minimize-demo
edgemirror verify [--supercharge] [--fast|--full|--nightly] [--mode MODE]
edgemirror compat --supercharge
edgemirror runner start   # requires EDGEMIRROR_RUNNER_TOKEN
```

## Tests

- Unit: 33 passed (16 Supercharger + existing diff/discovery)
- Fixture: `verify --local --filter http-get-root` exit 0 on `fixtures/basic-worker`
- Microbench gates: PASS on this host (measured; see latest `benchmarks/microbench-*.json`)

## Key paths

```text
packages/cli/src/supercharger/
packages/cli/src/cli/commands/supercharge.ts
packages/cli/src/cli/commands/runner.ts
benchmarks/README.md
.agent/performance-gates.md
```

## Handoff

- Agent 3: runner auth = Bearer `EDGEMIRROR_RUNNER_TOKEN` (≥16), loopback default
- Agent 6: wire `supercharge bench` / `evaluatePerfGates` into CI; see performance-gates.md
- Agent 2/4: no preview adapters or product docs rewritten here

## Honesty

No fabricated product speedups. CU ≠ crypto. Cache never substitutes for remote verification evidence.
