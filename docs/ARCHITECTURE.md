# EdgeMirror Architecture

EdgeMirror answers one question:

> Does this Cloudflare application behave the same way locally as it does on the real Cloudflare platform?

## Principles

- **CLI and testing engine first** — hosted Cloud is optional and not required for OSS verify
- **Real execution over mocks** — never fabricate parity results
- **Evidence over claims** — every finding carries provenance
- **`REMOTE_NOT_CONFIGURED` when credentials are absent** — never pretend remote ran
- **Cloudflare-only production target for v1** — adapters exist so other runtimes can plug in later
- **Control plane ≠ execution plane** (future Cloud) — untrusted project code must not run inside billing/API processes

## Package layout (shipped)

```text
packages/cli/          Publishable `edgemirror` package (CLI + engine modules)
packages/vitest/       Thin Vitest reporter (`@edgemirror/vitest`)
corpus/                Versioned parity fixtures
fixtures/              Workers used to test EdgeMirror itself
integrations/          GitHub Actions and CI helpers
docs/                  Architecture, Cloudflare, site content, diligence
pitch/                 Engineering briefs
```

Phase 4 may add `apps/*` and commercial packages; empty directories are scaffolding only until they contain real code.

### Internal modules (`packages/cli/src`)

| Module | Responsibility |
|--------|----------------|
| `cli/` | Command parsing, onboarding, terminal UX |
| `config/` | `edgemirror.yaml` / project config |
| `discovery/` | `doctor` — Wrangler, workerd, bindings fingerprint |
| `execution/` | `ExecutionTarget` — local, remote, preview |
| `trace/` | Stable execution trace schema |
| `normalizer/` | Nondeterminism stripping with inspectable rules |
| `diff/` | Differential comparison + classification |
| `provenance/` | Evidence receipts + artifact hashing |
| `reporter/` | Terminal / JSON / HTML / agent reports |
| `cleanup/` | Ownership-tracked remote resource cleanup |
| `corpus/` | Fixture loading and corpus format |
| `minimizer/` | Delta-debugging reproductions |
| `privacy/` | Secret redaction before persistence |
| `adapters/` | Runtime / binding / reporter plugin surfaces |
| `bundle/` | Portable `.edgemirror` evidence directories |
| `compat/` | Compatibility-date matrix |
| `demo/` | Isolated DEMO divergence path |
| `orchestrator/` | End-to-end verify/test orchestration |

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

<!-- AGENT1:assets docs/assets/architecture-preview.svg -->

## Supercharger (optional, not shipped)

Planned performance layer: job DAG, adaptive concurrency, content-addressed cache, Compute Unit budgets.

- Must not invalidate parity evidence semantics
- Must remain optional — `edgemirror verify` works without it
- CU is **accounting only** (not cryptocurrency)

See [SUPERCHARGER.md](./SUPERCHARGER.md).

## Hosted service (planned)

Future split:

| Plane | Role |
|-------|------|
| Control plane | Auth, orgs, entitlements, run metadata |
| Execution plane | Sandboxed runners executing customer projects |

OSS CLI remains fully capable without the hosted service.

## Exit codes (`edgemirror test --ci` / `verify --ci`)

| Code | Meaning |
|------|---------|
| 0 | Parity established |
| 1 | Confirmed unexpected divergence |
| 2 | Configuration / execution failure |
| 3 | Insufficient evidence |

## Related docs

- [EVIDENCE_MODEL.md](./EVIDENCE_MODEL.md)
- [FINDING_FORMAT.md](./FINDING_FORMAT.md)
- [DATA_MODEL.md](./DATA_MODEL.md)
- [ADAPTER_SPEC.md](./ADAPTER_SPEC.md)
- [CLOUDFLARE_INTEGRATION.md](./CLOUDFLARE_INTEGRATION.md)
- [RUNNER_PROTOCOL.md](./RUNNER_PROTOCOL.md)

## What is intentionally deferred

- Differential fuzzing at scale
- Non-Cloudflare production runtimes
- Automatic upstream issue publishing
- Claiming measured Supercharger speedups before harness results exist
