# EMF/1 — EdgeMirror Finding Format

Public, versioned JSON for a single `EM-###` differential finding.

## Schema

| Field | Meaning |
|-------|---------|
| `schema` | Always `EMF/1` |
| `schemaVersion` | `1.0` |
| `findingId` | e.g. `EM-001` |
| `classification` | From evidence receipt (MATCH, RUNTIME_DIVERGENCE, …) |
| `hashes` | SHA-256 lineage for local/remote traces + result |
| `reproduce` | Honest command list — never invents missing artifacts |

## CLI

```bash
edgemirror emf EM-001
edgemirror emf EM-001 --stdout
edgemirror reproduce EM-001 --export
```

Writes `.edgemirror/emf/EM-001.emf.json` by default.

## Honesty

- EMF/1 is only emitted from an existing local receipt.
- DEMO / pitch-demo findings must stay labeled.
- `REMOTE_NOT_CONFIGURED` is not a MATCH.
