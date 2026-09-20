# EdgeMirror

<p align="center">
  <img src="./branding/assets/logo.svg" alt="EdgeMirror" width="280" />
</p>

**Know before you deploy.**

Production confidence for Cloudflare Workers — does this app behave the same locally as on the real Cloudflare platform?

```bash
npx edgemirror verify
```

EdgeMirror is an independent open-source project and is **not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.**

[![License](https://img.shields.io/badge/license-Apache%202.0-0e1419?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-1a7a6d?style=flat-square)](./package.json)
[![Cloudflare Workers](https://img.shields.io/badge/target-Cloudflare%20Workers-F38020?style=flat-square&labelColor=0e1419)](./docs/CLOUDFLARE_INTEGRATION.md)
[![Parity](https://img.shields.io/badge/parity-evidence%20based-3dbaa8?style=flat-square&labelColor=0e1419)](./docs/EVIDENCE_MODEL.md)

<!-- CI / npm version badges: add only after Agent 6 wires real CI and npm publish — see docs/assets/badges.md -->

<p align="center">
  <img src="./docs/assets/hero.svg" alt="EdgeMirror hero — know before you deploy" width="720" />
</p>

## What EdgeMirror does

EdgeMirror runs the **same parity corpus** against:

1. **Local** — `wrangler dev --local` (workerd)
2. **Remote / preview** — real Cloudflare Workers or preview URLs when credentials exist

It then **normalizes** nondeterminism, **diffs** traces, **classifies** differences, and writes **evidence receipts** you can share or attach to a PR.

When Cloudflare credentials are missing, EdgeMirror reports `REMOTE_NOT_CONFIGURED` — it never invents parity.

## 30-second example

```bash
# In this repo (or any Worker with wrangler config):
npm install
npm run build

cd fixtures/basic-worker
npx edgemirror init
npx edgemirror doctor
npx edgemirror verify --local
npx edgemirror demo          # isolated DEMO divergence — never mixes with real corpus
```

With `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`:

```bash
npx edgemirror verify
npx edgemirror preview
```

## Why it exists

Local Workers tooling is excellent — and still not identical to the production platform. Teams need **differential evidence**, not vibes, before merge and deploy.

## How it works

```text
discover project
  → prepare local target
  → prepare remote/preview (or REMOTE_NOT_CONFIGURED)
  → execute the same ParityTest on both
  → capture ExecutionTrace → redact → normalize
  → diff → classify
  → evidence receipt + report
  → cleanup EdgeMirror-owned remote resources
```

<p align="center">
  <img src="./docs/assets/architecture-preview.svg" alt="EdgeMirror architecture overview" width="720" />
</p>

### Visual examples (DEMO-labeled)

The following SVGs are **illustrative / DEMO** stand-ins from Agent 1 — not live production metrics or recorded terminals:

| Asset | Notes |
|-------|-------|
| [docs/assets/terminal-demo.svg](./docs/assets/terminal-demo.svg) | SVG stand-in (not a real gif/webm recording) |
| [docs/assets/finding-example.svg](./docs/assets/finding-example.svg) | **DEMO** finding presentation |
| [docs/assets/compatibility-matrix.svg](./docs/assets/compatibility-matrix.svg) | **DEMO** matrix illustration |
| [docs/assets/github-check.svg](./docs/assets/github-check.svg) | Illustrative CI mock |
| [docs/assets/supercharger.svg](./docs/assets/supercharger.svg) | Visual stub only (Supercharger not shipped) |

Dashboard UI (when present) is likewise **DEMO-labeled** — do not treat screenshot fixtures as production telemetry. Brand guidelines: [branding/BRAND.md](./branding/BRAND.md) · status vocabulary: [branding/STATUS.md](./branding/STATUS.md) · badges: [docs/assets/badges.md](./docs/assets/badges.md).

## Status (honest)

| Capability | Status |
|------------|--------|
| Bare `edgemirror` onboarding / `--auto-verify` | Works |
| `doctor` / discovery | Works |
| Local execution | Works |
| Remote / preview differential | Requires Cloudflare credentials; otherwise `REMOTE_NOT_CONFIGURED` |
| Normalize → diff → evidence | Works |
| `verify` / `v` | Works |
| `compat` (local matrix) | Works; remote matrix not fabricated |
| `bundle EM-###` | Works |
| `demo` (isolated labeled DEMO) | Works |
| `init --ci` / `--github` | Works |
| GitHub Action scaffold | Works |
| `@edgemirror/vitest` | Thin reporter — does not replace Vitest |
| Supercharger | **Not shipped** — see [docs/SUPERCHARGER.md](./docs/SUPERCHARGER.md) |
| Hosted EdgeMirror Cloud | **Not shipped** |

## Commands (validated CLI)

| Command | Alias | Purpose |
|---------|-------|---------|
| *(bare)* | | Interactive onboarding (TTY) or safe local verify |
| `init` | | `edgemirror.yaml` + `.edgemirror/`; `--github` / `--ci` scaffolds |
| `doctor` | | Environment / Wrangler fingerprint |
| `verify` | `v` | High-level checks; honest skips when remote unavailable |
| `test` | | Local ↔ remote (or preview) differential corpus |
| `preview` | | Local ↔ preview URL differential |
| `compat` | | Compatibility-date local matrix |
| `bundle <id>` | | Portable evidence under `.edgemirror/bundles/` |
| `deploy` | | `verify` then `wrangler deploy` (never replaces Wrangler) |
| `demo` | | Isolated DEMO Worker with labeled divergence |

Agent-friendly output: `edgemirror verify --format agent`

## Cloudflare support

Claims come from Agent 2’s machine-readable report (`.agent/cloudflare-support-report.json`; after merge: `edgemirror doctor --support-report`).

| Area | Parity (EdgeMirror) |
|------|---------------------|
| HTTP fetch handler | **STABLE** |
| Plaintext vars | BETA |
| KV / D1 / R2 / Durable Objects / service bindings | EXPERIMENTAL |
| Queues / Workflows / Hyperdrive / Vectorize / Workers AI / WebSockets / Crons | **UNSUPPORTED** |

Full matrix: [docs/CLOUDFLARE_INTEGRATION.md](./docs/CLOUDFLARE_INTEGRATION.md) · [docs/site/cloudflare/support-matrix.md](./docs/site/cloudflare/support-matrix.md)

Levels describe EdgeMirror capability, not Cloudflare product GA. Do not invent STABLE features beyond the report.

## Supercharger

Optional performance layer (scheduler, Compute Units, caching). **Not required** for `edgemirror verify`.

**Compute Units (CU) are accounting meters — not cryptocurrency, tokens, or tradable assets.**

Details: [docs/SUPERCHARGER.md](./docs/SUPERCHARGER.md)

## GitHub Actions

```bash
npx edgemirror init --github
# or
npx edgemirror init --ci
```

Composite action: [`integrations/github-actions/verify`](./integrations/github-actions/verify/README.md)

## Compatibility testing

```bash
npx edgemirror compat --dates 2024-11-11,2025-04-01
```

Local executions are real. Remote matrix cells are never invented.

## Evidence

Runs write artifacts to `.edgemirror/runs/<id>/` (traces, receipts, reports).

```bash
npx edgemirror bundle EM-001
```

See [docs/EVIDENCE_MODEL.md](./docs/EVIDENCE_MODEL.md) and [docs/FINDING_FORMAT.md](./docs/FINDING_FORMAT.md).

## Exit codes (`--ci`)

| Code | Meaning |
|------|---------|
| 0 | Parity established (or intentional local-only success) |
| 1 | Confirmed unexpected divergence |
| 2 | Configuration / execution failure |
| 3 | Insufficient evidence (e.g. remote attempted but not configured) |

## Installation

**Requirements:** Node.js ≥ 20, a Cloudflare Worker project (Wrangler config).

```bash
# From source (this monorepo)
npm install
npm run build
npm test

# Pack without publishing (proves installability)
npm run pack:cli
# → edgemirror-0.1.0.tgz

# In a Worker project (tarball today; npmjs.com later)
npm install -D ./edgemirror-0.1.0.tgz   # or: npm install -D edgemirror  (when published)
npx edgemirror init
npx edgemirror verify
```

Canonical public identity is the **unscoped** package `edgemirror` on npmjs.com — not GitHub Packages and not a personal `@user/` scope. See [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md). Prove a clean install with:

```bash
npm run gate:distribution
```

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md) | Package identity, pack/publish, transfer notes |
| [docs/site/](./docs/site/) | Docs-site hierarchy (Getting Started → Troubleshooting) |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design |
| [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common failures |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Clone → tests |
| [ROADMAP.md](./ROADMAP.md) | Shipped vs planned |
| [CHANGELOG.md](./CHANGELOG.md) | From git history |

## Benchmarks

No public speedup numbers are published until Supercharger lands measured harness results (Agent 5). Do not treat marketing claims as facts.

## Architecture

CLI-first engine: discovery → execution targets → traces → normalize/diff → provenance. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Security

Threat model and practices: [docs/SECURITY.md](./docs/SECURITY.md), [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md). Report issues privately to the repository owner (`theworker02`).

## Roadmap

Honest statuses in [ROADMAP.md](./ROADMAP.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
