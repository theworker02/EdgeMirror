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
    traces/…
  ownership/<uuid>.json
  vitest/last-run.json
```

## Trace

`ExecutionTrace` (`schemaVersion: 1.0`) captures HTTP observations, exceptions, runtime metadata, and explicit `availability` for fields that were not observed. Status includes `REMOTE_NOT_CONFIGURED` when remote did not run.

## Receipt

`EvidenceReceipt` hashes local/remote traces and the `ParityResult`, recording classification and artifact paths.

## Bundle

`edgemirror bundle EM-001` copies related artifacts into a portable directory with `manifest.json` (path + sha256 + bytes).

## Scoring

Parity % = matched / (matched + divergent) among **comparable** executed tests.  
`REMOTE_NOT_CONFIGURED` and insufficient evidence are counted separately and **never** inflate the percentage.
