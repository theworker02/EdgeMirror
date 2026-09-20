# Roadmap

Statuses reflect the repository as of baseline commit `88dd111` (Phase 3 friction) plus documentation on `agent/docs`.

| Status | Meaning |
|--------|---------|
| **SHIPPED** | Implemented and usable in this repo |
| **IN DEVELOPMENT** | Actively being built on parallel agent branches — not yet merged/guaranteed |
| **PLANNED** | Intended; not started or only stubs |
| **RESEARCH** | Exploring; may change or drop |

## SHIPPED

- CLI vertical slice: `init`, `doctor`, `verify`/`v`, `test`, `preview`, `compat`, `bundle`, `deploy`, `demo`
- Bare onboarding / safe local auto-verify
- Local ↔ remote differential engine with normalize/diff/evidence
- Honest `REMOTE_NOT_CONFIGURED` / insufficient-evidence exit codes
- Ownership-tracked temporary Worker cleanup
- GitHub / GitLab / Workers Builds CI scaffolding (`init --ci`, `init --github`)
- Composite GitHub Action for verify
- `@edgemirror/vitest` thin reporter
- Fixture Workers + basic HTTP corpus

## IN DEVELOPMENT

Work owned by parallel sprint agents — treat as unstable until merged by release engineering:

| Area | Owner | Notes |
|------|-------|-------|
| Brand / README visuals | Agent 1 | **COMPLETE** on `agent/brand` — wired into docs README |
| Live Cloudflare adapters / support report | Agent 2 | **COMPLETE** on `agent/cloudflare` — matrix documented from support report |
| Security hardening suite | Agent 3 | Extends SECURITY / THREAT_MODEL |
| Supercharger performance layer | Agent 5 | Optional; CU ≠ crypto |
| Release gates / package publish | Agent 6 | npm timing TBD; merge coordination |

## PLANNED

- Broader binding instrumentation (Durable Objects, Queues, D1 deep traces) — quality gated on Agent 2 coverage
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

- Fabricating parity %, benchmarks, or adoption metrics
- Claiming Cloudflare endorsement or certification
- Replacing Wrangler as the deployment tool of record
- Requiring Supercharger or Cloud for OSS `edgemirror verify`
