# Finding Format

How EdgeMirror identifies, stores, and packages parity findings.

## Finding IDs

Findings are allocated as `EM-###` (zero-padded) via `nextFindingId("EM")` in `packages/cli/src/provenance/index.ts`.

Example: `EM-001`, `EM-002`.

DEMO runs use the same allocator inside an isolated temp project and must remain labeled as DEMO in reports.

## ParityResult

Core fields (`packages/cli/src/trace/schema.ts`):

```text
testId
findingId?
classification
differences[]          # path, local, remote, severity, note?
evidence[]             # kind, description, artifactPath?, hash?
confidence             # 0..1 numeric confidence
localRuns / remoteRuns
localMatches / remoteMatches
localTraceIds[] / remoteTraceIds[]
normalizationRulesApplied[]
parityContribution     # 0 | 1 | null
```

## EvidenceReceipt file

Path pattern: `.edgemirror/runs/<runId>/receipts/<findingId>.json` (also searchable under `.edgemirror/receipts/`).

```json
{
  "schemaVersion": "1.0",
  "receiptId": "<hex>",
  "findingId": "EM-001",
  "createdAt": "<iso8601>",
  "edgemirrorVersion": "0.1.0",
  "classification": "RUNTIME_DIVERGENCE",
  "testId": "http-get-root",
  "localTraceHash": "<sha256>",
  "remoteTraceHash": "<sha256>",
  "resultHash": "<sha256>",
  "artifactPaths": [],
  "notes": []
}
```

## Portable bundle

```bash
edgemirror bundle EM-001
```

Produces `.edgemirror/bundles/EM-001.edgemirror/` with `manifest.json` listing each file’s relative path, SHA-256, and byte length.

## Sharing / upstream / Cloudflare support

Until EMF/1 (public interchange format) ships:

1. Prefer **`edgemirror support-bundle`** (alias `escalate`) — writes `.edgemirror/support-bundles/cf-escalation-*/` with:
   - `CLOUDFLARE_TICKET.md` (summary template)
   - `support-report.json` + `bindings-matrix.txt`
   - `doctor-fingerprint.json` (no secrets)
   - `receipts/EM-###.json` + recent `runs/`
   - compat/matrix artifacts when present
   - `manifest.json` (SHA-256 integrity)
2. Or attach a single finding via `edgemirror bundle EM-001`
3. Include `edgemirror verify --format agent` JSON in CI summaries
4. Do not claim Cloudflare reproduction without the original Worker + Wrangler fingerprint

## Planned (not shipped)

- EMF/1 public schema
- `edgemirror reproduce EM-###`
- Public explorer ingestion

See [ROADMAP.md](../ROADMAP.md).
