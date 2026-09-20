# Performance gates — handoff for Agent 6

Agent 5 (Supercharger) owns the harness. Agent 6 wires these into release CI.

## Commands

```bash
# Build
npm run build -w @edgemirror/cli

# Unit tests including Supercharger
npm run test:unit -w @edgemirror/cli

# Measured microbench + gate evaluation (exit 1 on hard fail)
node packages/cli/dist/cli/bin.js supercharge bench --json
```

## Library API

```ts
import { runMicrobench, evaluatePerfGates } from "@edgemirror/cli";

const bench = await runMicrobench({ jobs: 24, sleepMs: 15, mode: "FAST" });
const report = evaluatePerfGates(bench);
if (!report.passed) process.exit(1);
```

## Hard gates

| ID | Rule |
|----|------|
| `microbench-completes` | Both standard and Supercharger wallMs > 0 |
| `scheduler-not-slower-than-3x` | Supercharger wall ≤ 3× sequential + 50ms (catastrophic regression only) |
| `cu-accounting-present` | `cuUsed > 0` |
| `no-fake-speedup-field` | Ratio object is only `wallSpeedupMeasured` + disclaimer present |

## Soft / deferred

- Live wrangler verify wall-time budgets (machine-dependent; gate separately when credentials/fixtures stable)
- GPU/native acceleration — **not shipped**; no gate until profiled faster

## OSS invariant

`edgemirror verify` without `--supercharge` must remain green. Supercharger is opt-in.

## Auth coordination (Agent 3)

`edgemirror runner start` requires `EDGEMIRROR_RUNNER_TOKEN` (≥16 chars), loopback bind by default, Bearer auth on `/health` and `/v1/jobs`.
