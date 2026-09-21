# EdgeMirror benchmarks

Evidence-based Supercharger numbers. Every figure is labeled **MEASURED** or **ESTIMATE**.

> Re-run on your machine before citing externally. These are harness outputs, not marketing claims about wrangler / workerd end-to-end verify speed.

## How to reproduce

```bash
npm install
npm run build -w edgemirror

# Resource snapshot (MEASURED host facts)
node packages/cli/dist/cli/bin.js supercharge doctor

# CU budget differentiation (package selection is DETERMINISTIC; wall ranges are ESTIMATES)
node packages/cli/dist/cli/bin.js supercharge plan --cu 5
node packages/cli/dist/cli/bin.js supercharge plan --cu 500

# Synthetic scheduler microbench (MEASURED wall times)
node packages/cli/dist/cli/bin.js supercharge bench --jobs 24 --sleep-ms 15 --mode FAST --json
```

Methodology notes also live in [`benchmarks/README.md`](../benchmarks/README.md). Performance gates: [`.agent/performance-gates.md`](../.agent/performance-gates.md).

---

## MEASURED — synthetic microbench

**Captured:** 2026-09-21T01:43:31.167Z  
**Host:** win32 · Node v24.16.0 · 32 CPUs · ~62 GB RAM (from `supercharge doctor`)  
**Workload:** 24 jobs × 15 ms sleep · governor mode `FAST`  
**Artifact:** [`benchmarks/microbench-1789955011168.json`](../benchmarks/microbench-1789955011168.json)

| Metric | Standard (sequential) | Supercharger (scheduler) |
|--------|----------------------|---------------------------|
| Wall time | **382 ms** | **61 ms** |
| Jobs / sec | 62.82 | 393.44 |
| Concurrency | 1 (sequential) | 8 |
| CU used | — | 24 (accounting only) |
| Wall ratio (`standard / supercharger`) | | **6.263×** |

### Gates (PASS)

| Gate | Result | Detail |
|------|--------|--------|
| `microbench-completes` | ok | standard=382ms supercharger=61ms |
| `scheduler-not-slower-than-3x` | ok | ratio=0.160 (limit 3.0) |
| `cu-accounting-present` | ok | cuUsed=24 |
| `no-fake-speedup-field` | ok | ratioKeys=wallSpeedupMeasured |

**Disclaimer (from harness):** Measured synthetic I/O-bound jobs only. Not a claim about wrangler/parity verify speedups.

### Prior run (same harness, smaller workload)

| Artifact | Jobs × sleep | Standard | Supercharger | Ratio |
|----------|--------------|----------|--------------|-------|
| [`microbench-1789867391397.json`](../benchmarks/microbench-1789867391397.json) | 16 × 10 ms | 243 ms | 44 ms | 5.53× |

---

## MEASURED selection difference — CU 5 vs CU 500

`edgemirror supercharge plan` selects work packages by CU budget + value density. Selection is **deterministic** from the optimizer. Wall-time bands printed by `plan` are **ESTIMATES** (heuristic) and must not be cited as measured.

**Corpus:** builtin tests only (no Wrangler project in cwd when captured).  
**Mode:** `BALANCED`  
**Artifacts:** [`benchmarks/plan-cu5.json`](../benchmarks/plan-cu5.json), [`benchmarks/plan-cu500.json`](../benchmarks/plan-cu500.json)

| | **CU budget 5** | **CU budget 500** |
|--|-----------------|-------------------|
| Verification depth | 2 | 4 |
| Selected packages | `required_parity`, `extended_parity` | `required_parity`, `extended_parity`, `compat_matrix`, `historical_regression`, `differential_fuzz`, `research_swarm` |
| Deferred | compat / historical / fuzz / research | *(none)* |
| Jobs | 5 | 14 |
| Estimated job CU | 5 | 273 |
| Est. parallel waves | 4 | 5 |
| Est. wall (heuristic) | 200–4025 ms | 250–6365 ms |

**What this proves:** Raising the CU budget changes *which work gets scheduled*, not just a soft “try harder” knob. Low budgets keep essential parity packages; high budgets unlock compat cells and research packages.

**What this does not prove:** Absolute wall-clock for a real Worker verify on your laptop — re-measure with `supercharge bench` and optional timed `verify --local` / `verify --local --supercharge`.

---

## ESTIMATES vs MEASURED (labeling rules)

| Source | Label | Safe to publish as |
|--------|-------|--------------------|
| `supercharge bench` wallMs / ratio | **MEASURED** | Synthetic scheduler speedup on named workload + host |
| `supercharge doctor` CPUs / memory | **MEASURED** | Host capacity snapshot |
| `supercharge plan` selected/deferred packages | **DETERMINISTIC** | CU budget differentiation |
| `supercharge plan` Est. wall ranges | **ESTIMATE** | Heuristic only — do not market as speedup |
| Untimed `verify` anecdotes | **not published** | Run and record before documenting |

---

## What we explicitly do not claim

- No “100× faster Workers deploys”
- No wrangler/workerd speedups unless separately timed on a named fixture
- No GPU / native acceleration results (not enabled)
- CU is never a token price or cryptocurrency
- Dashboard Supercharger gauges in DEMO UI are visual fixtures — CLI `supercharge` is the real engine

---

## Related

- [SUPERCHARGER.md](./SUPERCHARGER.md)
- [benchmarks/README.md](../benchmarks/README.md)
- [ROADMAP.md](../ROADMAP.md)
