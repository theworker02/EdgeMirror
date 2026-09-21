# Supercharger

Optional performance and compute-orchestration layer for EdgeMirror.

## Status

| Item | Status |
|------|--------|
| Required for `edgemirror verify` | **No** - verify works without Supercharger |
| Shipped in this repository | **Yes** - `packages/cli/src/supercharger/` + `edgemirror supercharge` |
| Schedulers | **`classic`** (default adaptive) · **`double-trouble`** (pair-wise / dyadic) |
| Opt-in flags | `edgemirror verify --supercharge [cu] [--scheduler classic\|double-trouble]`, `compat --supercharge`, `supercharge plan\|bench\|doctor` |
| Public benchmarks | **Published** - measured microbench (incl. 500-job classic + Double Trouble) + CU plan differentiation; see [BENCHMARKS.md](./BENCHMARKS.md) |

## What Supercharger provides

On large corpora and matrices, sequential execution becomes slow. Supercharger provides:

- Job DAG scheduling of independent parity work
- Adaptive concurrency (governors: ECO / BALANCED / FAST / MAX)
- **Double Trouble** scheduler — launch ready work in pair-wise waves (`--scheduler double-trouble`)
- Content-addressed caches that **must not** invalidate parity evidence semantics
- Incremental / `--fast` selection
- Parallel minimization helpers
- Compute Unit (CU) budgets and governors - budget changes which packages are selected

## Schedulers: classic vs Double Trouble

| Kind | Flag | Behavior |
|------|------|----------|
| **classic** | `--scheduler classic` (default) | Adaptive take from the ready queue up to free concurrency slots |
| **double-trouble** | `--scheduler double-trouble` (aliases: `dt`, `pairs`) | Dyadic / pair-wise: prefer even batches; launch ready work in groups of two (pair waves) |

Either scheduler preserves evidence integrity. Choice is performance/orchestration preference — not a different parity contract.

**Capacity:** Synthetic microbench demonstrates **≥500** independent jobs under governor `MAX` (concurrency up to 128). See MEASURED 500-job rows in [BENCHMARKS.md](./BENCHMARKS.md).

## Compute Units (CU)

**CU is an accounting meter for compute effort. CU is not cryptocurrency.**

| CU is | CU is not |
|-------|-----------|
| A budget / quota unit for verification work | A coin, token, NFT, or tradable asset |
| Enforced by entitlement services when Cloud exists | Something users "mine" |
| Useful for fair scheduling and plan limits | A payment rail (Stripe handles money) |

Evaluation users can run verification **without** purchasing CU. Supercharger remains optional.

## Evidence integrity

Supercharger optimizations must preserve:

- Honest `REMOTE_NOT_CONFIGURED` behavior
- Trace / receipt hashing semantics
- Classification rules

Caching may skip re-execution only when inputs and environment fingerprints prove equivalence.

## CLI

Validated against the merged binary:

```bash
edgemirror supercharge doctor
edgemirror supercharge plan [--cu N] [--mode MODE] [--json]
edgemirror supercharge bench [--jobs N] [--sleep-ms N] [--mode MODE] [--scheduler classic|double-trouble] [--json]
edgemirror supercharge minimize-demo
edgemirror verify --supercharge [cu]
edgemirror verify --supercharge --scheduler double-trouble
edgemirror verify --fast
edgemirror compat --supercharge
```

`plan` wall-time bands are **ESTIMATES**. `bench` wall times and ratios are **MEASURED**. See [BENCHMARKS.md](./BENCHMARKS.md).

## Related

- [BENCHMARKS.md](./BENCHMARKS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ROADMAP.md](../ROADMAP.md)
- [RUNNER_PROTOCOL.md](./RUNNER_PROTOCOL.md)
- [benchmarks/README.md](../benchmarks/README.md)
