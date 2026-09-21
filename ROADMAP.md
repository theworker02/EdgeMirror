# Roadmap

Statuses reflect the repository on `main` (source-available proprietary EdgeMirror).

| Status | Meaning |
|--------|---------|
| **SHIPPED** | Implemented and usable in this repo |
| **IN DEVELOPMENT** | Actively being built — not yet guaranteed |
| **PLANNED** | Intended; not started or only stubs |
| **RESEARCH** | Exploring; may change or drop |

## SHIPPED

- CLI vertical slice: `init`, `doctor`, `verify`/`v`, `test`, `preview`, `compat`, `bundle`, `deploy`, `demo` / `pitch-demo`, `support-bundle`
- Bare onboarding / safe local auto-verify
- Local ↔ remote differential engine with normalize/diff/evidence
- Honest `REMOTE_NOT_CONFIGURED` / insufficient-evidence exit codes
- Ownership-tracked temporary Worker cleanup
- GitHub / GitLab / Workers Builds CI scaffolding (`init --ci`, `init --github`, `init --cloudflare-gate`)
- Composite GitHub Action + reusable verify workflow
- `@edgemirror/vitest` thin reporter
- Fixture Workers + basic HTTP corpus + bindings-http STABLE matrix
- **Supercharger (optional):** DAG scheduler, governors, CU budgets, cache, `supercharge plan|bench|doctor`, measured microbench harness — see [docs/SUPERCHARGER.md](./docs/SUPERCHARGER.md) and [docs/BENCHMARKS.md](./docs/BENCHMARKS.md)

## IN DEVELOPMENT

| Area | Notes |
|------|-------|
| Security hardening suite | Extends SECURITY / THREAT_MODEL |
| Release gates / package publish | npm timing TBD |
| Hosted Cloud control plane | Catalog/scripts + Stripe test paths when keys configured; not a public multi-tenant product yet |

## PLANNED

- Broader binding instrumentation depth (Durable Objects, Queues, D1 deep traces) beyond HTTP/WS-observable STABLE coverage
- EMF/1 public finding format + `reproduce` command
- Public compatibility explorer / intelligence surface
- Hosted EdgeMirror Cloud (control plane ≠ execution plane)
- Subscription / entitlements (Stripe billing; CU accounting only)
- `edgemirror badge` / status badges from real verify results
- Version-skew / gradual deployment workflows with real evidence
- Optional MCP / SDK package splits when external consumers exist

## RESEARCH

- Differential fuzzing at scale
- Non-Cloudflare runtimes (adapters exist as interfaces only)
- Automatic upstream issue publishing
- Native / GPU acceleration for Supercharger (only if profiled)

## Explicit non-goals (near term)

- Fabricating parity %, unverified benchmarks, or adoption metrics
- Claiming Cloudflare endorsement or certification
- Replacing Wrangler as the deployment tool of record
- Requiring Supercharger or Cloud for evaluation / OSS-path `edgemirror verify`
