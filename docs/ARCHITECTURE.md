# EdgeMirror Architecture

EdgeMirror answers one question:

> Does this Cloudflare application behave the same way locally as it does on the real Cloudflare platform?

## Principles

- **CLI and testing engine first** — no SaaS dashboard in v1
- **Real execution over mocks** — never fabricate parity results
- **Evidence over claims** — every finding carries provenance
- **REMOTE_NOT_CONFIGURED** when credentials are absent — never pretend remote ran
- **Cloudflare-only production target for v1** — adapters exist so other runtimes can plug in later

## Package layout

```text
packages/cli/          Publishable `edgemirror` package (CLI + engine modules)
corpus/                Versioned parity fixtures
fixtures/              Workers used to test EdgeMirror itself
integrations/          GitHub Actions and Cloudflare helpers
docs/                  Architecture and design notes
```

Internal modules inside `packages/cli/src` (merged where separate packages would add no benefit):

| Module | Responsibility |
|--------|----------------|
| `cli/` | Command parsing and terminal UX |
| `config/` | `edgemirror.yaml` / project config |
| `discovery/` | `doctor` — Wrangler, workerd, bindings fingerprint |
| `execution/` | `ExecutionTarget` — local + remote |
| `trace/` | Stable execution trace schema |
| `normalizer/` | Nondeterminism stripping with inspectable rules |
| `diff/` | Differential comparison + classification |
| `provenance/` | Evidence receipts + artifact hashing |
| `reporter/` | Terminal / JSON / HTML reports |
| `cleanup/` | Ownership-tracked remote resource cleanup |
| `corpus/` | Fixture loading and corpus format |
| `minimizer/` | Delta-debugging reproductions |
| `privacy/` | Secret redaction before persistence |
| `adapters/` | Runtime / binding / reporter plugin surfaces |

## Vertical slice (release gate)

```text
discover project
  → prepare local target
  → prepare remote target (or REMOTE_NOT_CONFIGURED)
  → execute same ParityTest on both
  → capture ExecutionTrace
  → redact → normalize
  → diff → classify
  → evidence receipt + report
  → cleanup EdgeMirror-owned remote resources
```

## Exit codes (`edgemirror test --ci`)

| Code | Meaning |
|------|---------|
| 0 | Parity established |
| 1 | Confirmed unexpected divergence |
| 2 | Configuration / execution failure |
| 3 | Insufficient evidence |

## What is intentionally deferred

- Differential fuzzing (Phase 3)
- Hosted EdgeMirror Cloud
- Non-Cloudflare runtimes
- Automatic upstream issue publishing
