# Evidence Model

Every parity finding should be reconstructible from durable artifacts.

## Layout

```text
.edgemirror/
  runs/<runId>/
    traces/<traceId>.json
    receipts/<findingId>.json
    reports/report.{txt,json,html,agent.json}
    summary.json
  bundles/<id>.edgemirror/
    manifest.json
    receipts/…
    traces/… (or run/…)
  ownership/<uuid>.json
  vitest/last-run.json
  receipts/            # also created at init for convenience
  traces/
  reports/
  repros/
```

## Trace

`ExecutionTrace` (`schemaVersion: "1.0"`) captures:

- HTTP observations (status, headers, body) with explicit `availability`
- Exceptions, console lines, duration
- Binding / storage / DO / queue observation slots (may be `unavailable`)
- Runtime metadata (Wrangler, compatibility date/flags)
- `status`: `ok` | `error` | `REMOTE_NOT_CONFIGURED` | `BUDGET_EXCEEDED` | `SKIPPED`

Unavailable observations are represented explicitly — **never invented**.

Source: `packages/cli/src/trace/schema.ts`.

## Receipt

`EvidenceReceipt` (`schemaVersion: "1.0"`) records:

| Field | Purpose |
|-------|---------|
| `findingId` | Stable id such as `EM-001` |
| `classification` | Parity classification enum |
| `localTraceHash` / `remoteTraceHash` | SHA-256 of traces |
| `resultHash` | SHA-256 of `ParityResult` |
| `artifactPaths` | Related files |
| `edgemirrorVersion` | Tool version that produced the receipt |

Source: `packages/cli/src/provenance/index.ts`.

## Bundle

`edgemirror bundle EM-001` (or a run id) copies related artifacts into:

```text
.edgemirror/bundles/<id>.edgemirror/
  manifest.json    # path + sha256 + bytes per file
  …
```

`BundleManifest.schemaVersion` is `"1.0"`.

## Classifications

| Classification | Meaning |
|----------------|---------|
| `MATCH` | Comparable observations agree |
| `EXPECTED_DIFFERENCE` | Documented expected drift |
| `CONFIGURATION_DIFFERENCE` | Config / env skew |
| `APPLICATION_NONDETERMINISM` | App-level nondeterminism |
| `POSSIBLE_RUNTIME_DIVERGENCE` | Suspicious; needs more evidence |
| `RUNTIME_DIVERGENCE` | Confirmed unexpected divergence |
| `INSUFFICIENT_EVIDENCE` | Could not compare fairly |
| `REMOTE_NOT_CONFIGURED` | Remote path skipped honestly |

## Scoring

Parity % = matched / (matched + divergent) among **comparable** executed tests.

`REMOTE_NOT_CONFIGURED` and insufficient evidence are counted separately and **never** inflate the percentage.

## DEMO isolation

`edgemirror demo` produces labeled DEMO findings in an isolated temp project. They must not be treated as corpus or production evidence.
