# Supercharger

Optional performance and compute-orchestration layer for EdgeMirror.

## Status

| Item | Status |
|------|--------|
| Required for `edgemirror verify` | **No** — verify works without Supercharger |
| Shipped on docs baseline (`88dd111`) | **No** |
| Parallel implementation | Agent 5 (`agent/supercharger`) — IN DEVELOPMENT until merged |
| Public benchmarks | **None published** — no invented speedups |

## What Supercharger is for

On large corpora and matrices, sequential execution becomes slow. Supercharger is intended to provide:

- Job DAG scheduling of independent parity work
- Adaptive concurrency
- Content-addressed caches that **must not** invalidate parity evidence semantics
- Incremental / fast selection (when implemented)
- Parallel minimization (when present)
- Mode presets (ECO / BALANCED / FAST / MAX — confirm names against CLI when shipped)
- Compute Unit (CU) budgets and governors

## Compute Units (CU)

**CU is an accounting meter for compute effort. CU is not cryptocurrency.**

| CU is | CU is not |
|-------|-----------|
| A budget / quota unit for verification work | A coin, token, NFT, or tradable asset |
| Enforced by entitlement services when Cloud exists | Something users “mine” |
| Useful for fair scheduling and plan limits | A payment rail (Stripe handles money) |

OSS users must be able to run verification **without** purchasing CU.

## Evidence integrity

Supercharger optimizations must preserve:

- Honest `REMOTE_NOT_CONFIGURED` behavior
- Trace / receipt hashing semantics
- Classification rules

Caching may skip re-execution only when inputs and environment fingerprints prove equivalence.

## CLI documentation rule

Document Supercharger flags **only after** validating against `edgemirror --help` on a merged binary. Do not invent `edgemirror supercharge` commands.

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ROADMAP.md](../ROADMAP.md)
- [RUNNER_PROTOCOL.md](./RUNNER_PROTOCOL.md)
