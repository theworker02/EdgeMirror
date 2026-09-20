# Supercharger benchmarks — methodology

## Purpose

Produce **measured** comparisons between:

1. **Standard** — sequential job execution (no Supercharger scheduler)
2. **Supercharger** — adaptive scheduler under a governor mode

These numbers are **not marketing claims**. They are reproducible harness outputs for Agent 6 performance gates and local regression checks.

## What is measured

| Metric | Source |
|--------|--------|
| Wall time (ms) | `performance.now()` / scheduler `wallMs` |
| Jobs/sec | `jobs / (wallMs/1000)` |
| Concurrency | Governor × resource recommendation |
| CU used | CU ledger (accounting only — not currency) |
| Cache hits | Scheduler cache-hit counter |
| Measured ratio | `standard.wallMs / supercharger.wallMs` |

## What is intentionally not claimed

- No “100× faster verify”
- No wrangler/workerd speedups unless separately profiled on a named fixture
- No GPU/native acceleration results (not enabled; not profiled)
- CU is never described as a token price or cryptocurrency

## Workloads

### 1. Synthetic microbench (default)

```bash
npm run build -w @edgemirror/cli
node packages/cli/dist/cli/bin.js supercharge bench --jobs 24 --sleep-ms 15 --mode FAST --json
```

Or from library:

```ts
import { runMicrobench, evaluatePerfGates } from "@edgemirror/cli";
const bench = await runMicrobench({ jobs: 24, sleepMs: 15, mode: "FAST" });
const gates = evaluatePerfGates(bench);
```

**Profile baseline** (machine capacity / synthetic headroom): `benchmarks/profile-baseline.json`

### 2. Parity verify (optional, environment-specific)

```bash
# Standard OSS path (must keep working)
node packages/cli/dist/cli/bin.js verify --local -q

# Supercharger path (opt-in)
node packages/cli/dist/cli/bin.js verify --local --supercharge --mode FAST -q
```

Compare wall clocks with an external timer. **Do not** paste unverified numbers into docs as product claims.

## Performance gates (Agent 6)

See `.agent/performance-gates.md`.

Hard gates today:

1. Microbench completes with positive wall times
2. Scheduler not catastrophically slower than 3× sequential on synthetic I/O
3. CU accounting present
4. Only `wallSpeedupMeasured` ratio field (no marketing speedup field)

## Reproducibility checklist

1. Record Node version, OS, CPU count (`edgemirror supercharge doctor`)
2. Pin `--jobs` / `--sleep-ms` / `--mode`
3. Save JSON under `.edgemirror/benchmarks/` or `benchmarks/`
4. Re-run 3×; report median if publishing internally
5. Label every figure **measured on &lt;host&gt; at &lt;timestamp&gt;**
