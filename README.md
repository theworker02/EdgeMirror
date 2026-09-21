# EdgeMirror

![EdgeMirror](./branding/assets/logo.svg)

**Know before you deploy.**

The evidence layer Cloudflare Workers deploys need — differential proof that local workerd ≈ the real platform, before `wrangler deploy`.

**Live Cloudflare demo (static):** [theworker02.github.io/EdgeMirror](https://theworker02.github.io/EdgeMirror/)

```bash
npx edgemirror verify
# Standard gate before deploy:
npx edgemirror init --cloudflare-gate
npx edgemirror deploy
```

EdgeMirror is an independent **source-available** project (not open source) and is **not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.** Evaluation use is permitted under [`LICENSE`](./LICENSE); production and commercial use require a paid license — see [`COMMERCIAL.md`](./COMMERCIAL.md).

![License](https://img.shields.io/badge/license-Proprietary%20(source--available)-0e1419?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D20-1a7a6d?style=flat-square)
![Cloudflare Workers](https://img.shields.io/badge/target-Cloudflare%20Workers-F38020?style=flat-square&labelColor=0e1419)
![Parity](https://img.shields.io/badge/parity-evidence%20based-3dbaa8?style=flat-square&labelColor=0e1419)



![EdgeMirror hero — know before you deploy](./docs/assets/hero.svg)

## Platform quality (why this matters)

Cloudflare’s Workers story depends on **trust that local ≈ production**. EdgeMirror owns that differential evidence:

1. **Default CI / deploy gate** — `edgemirror verify` fails on divergence or insufficient evidence; scaffold with `init --cloudflare-gate` and require the check before merge/deploy.
2. **Wrangler-adjacent deploy path** — `edgemirror deploy` runs verify, then shells out to `wrangler deploy`. Failed verify aborts unless `--force` (loud warning).
3. **Support escalation** — `edgemirror support-bundle` exports `EM-###` receipts + doctor support-report + compat artifacts for Cloudflare tickets.

Without this class of evidence, teams ship Workers changes **blind** to local/prod drift. EdgeMirror does not invent parity: missing credentials → `REMOTE_NOT_CONFIGURED`.

Acquisition / partnership brief: [ACQUISITION.md](./ACQUISITION.md)

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

![EdgeMirror architecture overview](./docs/assets/architecture-preview.svg)

### Visual examples (DEMO-labeled)

The following SVGs are **illustrative / DEMO** stand-ins from Agent 1 — not live production metrics or recorded terminals:


| Asset                                                                          | Notes                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------- |
| [docs/assets/terminal-demo.svg](./docs/assets/terminal-demo.svg)               | SVG stand-in (not a real gif/webm recording) |
| [docs/assets/finding-example.svg](./docs/assets/finding-example.svg)           | **DEMO** finding presentation                |
| [docs/assets/compatibility-matrix.svg](./docs/assets/compatibility-matrix.svg) | **DEMO** matrix illustration                 |
| [docs/assets/github-check.svg](./docs/assets/github-check.svg)                 | Illustrative CI mock                         |
| [docs/assets/supercharger.svg](./docs/assets/supercharger.svg)                 | Visual stub only (Supercharger not shipped)  |


Dashboard UI (when present) is likewise **DEMO-labeled** — do not treat screenshot fixtures as production telemetry. Brand guidelines: [branding/BRAND.md](./branding/BRAND.md) · status vocabulary: [branding/STATUS.md](./branding/STATUS.md) · badges: [docs/assets/badges.md](./docs/assets/badges.md).

## Status (honest)


| Capability                                     | Status                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Bare `edgemirror` onboarding / `--auto-verify` | Works                                                                                          |
| `doctor` / discovery                           | Works                                                                                          |
| Local execution                                | Works                                                                                          |
| Remote / preview differential                  | Requires Cloudflare credentials; otherwise `REMOTE_NOT_CONFIGURED`                             |
| Normalize → diff → evidence                    | Works                                                                                          |
| `verify` / `v`                                 | Works                                                                                          |
| `compat` (local matrix)                        | Works; remote matrix not fabricated                                                            |
| `bundle EM-###`                                | Works                                                                                          |
| `demo` (isolated labeled DEMO)                 | Works                                                                                          |
| `init --ci` / `--github` / `--cloudflare-gate` | Works — gold-standard reusable workflow gate |
| GitHub Action + reusable workflow              | Works — fail on divergence / insufficient evidence |
| `@edgemirror/vitest`                           | Thin reporter — does not replace Vitest                                                        |
| Supercharger                                   | CU budget selects different work packages — see [docs/SUPERCHARGER.md](./docs/SUPERCHARGER.md) |
| Hosted EdgeMirror Cloud                        | Catalog/scripts ready; Stripe test catalog + Checkout when keys configured                     |
| GitHub Pages demo                              | Static Cloudflare pitch landing in `site/`                                                     |
| `support-bundle` / `escalate`                  | Works — Cloudflare ticket packet (receipts + doctor + compat)                                  |
| `deploy` (verify-then-wrangler)                | Works — refuses failed verify unless `--force`                                                 |




## Commands (validated CLI)


| Command       | Alias | Purpose                                                           |
| ------------- | ----- | ----------------------------------------------------------------- |
| *(bare)*      |       | Interactive onboarding (TTY) or safe local verify                 |
| `init`        |       | `edgemirror.yaml` + `.edgemirror/`; `--github` / `--ci` / `--cloudflare-gate` |
| `doctor`      |       | Environment / Wrangler fingerprint                                |
| `verify`      | `v`   | High-level checks; honest skips when remote unavailable           |
| `test`        |       | Local ↔ remote (or preview) differential corpus                   |
| `preview`     |       | Local ↔ preview URL differential                                  |
| `compat`      |       | Compatibility-date local matrix                                   |
| `bundle <id>` |       | Portable evidence under `.edgemirror/bundles/`                    |
| `deploy`      |       | `verify` then `wrangler deploy`; `--force` to override (loud)     |
| `support-bundle` | `escalate` | Cloudflare ticket packet (EM receipts + doctor + compat)     |
| `demo`        |       | Isolated DEMO Worker with labeled divergence                      |


Agent-friendly output: `edgemirror verify --format agent`

## Cloudflare support

Claims come from Agent 2’s machine-readable report (`.agent/cloudflare-support-report.json`; after merge: `edgemirror doctor --support-report`).


| Area                                                                          | Parity (EdgeMirror) |
| ----------------------------------------------------------------------------- | ------------------- |
| HTTP fetch handler                                                            | **STABLE**          |
| Plaintext vars                                                                | **STABLE**          |
| KV / D1 / R2 / Durable Objects / service bindings                             | **STABLE**          |
| Queues / Workflows / Hyperdrive / Vectorize / Workers AI / WebSockets / Crons | **STABLE**          |


Full matrix: [docs/CLOUDFLARE_INTEGRATION.md](./docs/CLOUDFLARE_INTEGRATION.md) · [docs/site/cloudflare/support-matrix.md](./docs/site/cloudflare/support-matrix.md) · fixture: [`fixtures/bindings-http`](./fixtures/bindings-http)

Levels describe EdgeMirror capability, not Cloudflare product GA. Every surface above has HTTP/WS-observable corpus coverage (`edgemirror doctor --bindings`).

## Supercharger

Optional performance layer (scheduler, Compute Units, caching). **Not required** for `edgemirror verify`.

**Compute Units (CU) are accounting meters — not cryptocurrency, tokens, or tradable assets.**

Details: [docs/SUPERCHARGER.md](./docs/SUPERCHARGER.md)

## GitHub Actions — required gate before deploy

Cloudflare Workers teams should treat EdgeMirror as a **required status check** before merge/deploy:

```bash
npx edgemirror init --cloudflare-gate
# or
npx edgemirror init --github
npx edgemirror init --ci
```

**Reusable workflow** (call from any Worker repo):

```yaml
jobs:
  edgemirror-verify:
    uses: theworker02/EdgeMirror/.github/workflows/reusable-edgemirror-verify.yml@main
    with:
      local-only: true
```

**Composite action:** [integrations/github-actions/verify](./integrations/github-actions/verify/README.md)

Then deploy only through the verified path:

```bash
npx edgemirror deploy              # verify → wrangler deploy
npx edgemirror deploy --force      # loud override — not the default
npx edgemirror support-bundle      # attach to a Cloudflare support ticket
```

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


| Code | Meaning                                                          |
| ---- | ---------------------------------------------------------------- |
| 0    | Parity established (or intentional local-only success)           |
| 1    | Confirmed unexpected divergence                                  |
| 2    | Configuration / execution failure                                |
| 3    | Insufficient evidence (e.g. remote attempted but not configured) |




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

| Doc | Purpose |
|-----|---------|
| [ACQUISITION.md](./ACQUISITION.md) | **Acquisition / partnership brief** for Cloudflare diligence |
| [docs/ACQUISITION_READINESS.md](./docs/ACQUISITION_READINESS.md) | Technical diligence checklist |
| [pitch/cloudflare/ENGINEERING_BRIEF.md](./pitch/cloudflare/ENGINEERING_BRIEF.md) | Engineering one-pager |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture |
| [docs/CLOUDFLARE_INTEGRATION.md](./docs/CLOUDFLARE_INTEGRATION.md) | Bindings matrix (all STABLE) |
| [docs/EVIDENCE_MODEL.md](./docs/EVIDENCE_MODEL.md) | Receipts & classification |
| [docs/SECURITY.md](./docs/SECURITY.md) / [SECURITY.md](./SECURITY.md) | Security policy & trust boundaries |
| [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md) | Pack / install gate |
| [docs/site/](./docs/site/) | Doc site sources |
| Live demo | https://theworker02.github.io/EdgeMirror/ |

## For Cloudflare (acquisition / partnership)

EdgeMirror is an **independent** source-available project offered for diligence, commercial licensing, and acquisition conversations. Start here:

1. [ACQUISITION.md](./ACQUISITION.md) — forward-facing brief  
2. [docs/ACQUISITION_READINESS.md](./docs/ACQUISITION_READINESS.md) — technical packet  
3. Contact: GitHub [@theworker02](https://github.com/theworker02)

Demo site acquisition page: https://theworker02.github.io/EdgeMirror/acquisition.html

Also: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) · [CONTRIBUTING.md](./CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) · [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md)

## Benchmarks

No public speedup numbers are published until Supercharger lands measured harness results (Agent 5). Do not treat marketing claims as facts.

## Architecture

CLI-first engine: discovery → execution targets → traces → normalize/diff → provenance. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Security

Threat model and practices: [SECURITY.md](./SECURITY.md), [docs/SECURITY.md](./docs/SECURITY.md), [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md). Report vulnerabilities privately to [@theworker02](https://github.com/theworker02).

## Roadmap

Honest statuses in [ROADMAP.md](./ROADMAP.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

**Source-available proprietary** — evaluation under [LICENSE](./LICENSE); commercial / production use via [COMMERCIAL.md](./COMMERCIAL.md). See also [NOTICE](./NOTICE) and the [License Transition & Enforcement Notice](./LICENSE_TRANSITION_NOTICE.md) (historical Apache-2.0 vs current proprietary; enforcement by copyright holder and/or acquirer).