# Phase 2 Gap Analysis

Date: 2026-09-19  
Compared against current EdgeMirror tree after Phase 1 vertical-slice completion and Phase 2 incremental implementation.

## Phase 1 baseline (after this work)

| Capability | State |
|------------|-------|
| Doctor / discovery | **Done** — `discoverProject`, JSONC/TOML parse, bindings fingerprint |
| Local execution | **Done** — `LocalExecutionTarget` via `wrangler dev --local` |
| Remote path | **Done** — authenticates or returns `REMOTE_NOT_CONFIGURED` |
| Traces / normalize / diff | **Done** |
| Evidence receipts + reports | **Done** — terminal/json/html/agent |
| Cleanup ownership | **Done** — marker-based |
| Corpus + CLI (`init`/`doctor`/`test`) | **Done** |
| Automated tests | **Done** — unit + remote-not-configured + local fixture smoke |
| README disclaimer | **Done** |

**Blocked without Cloudflare credentials:** real remote deploy, preview URL creation, remote parity %, production smoke against live workers.dev.

## Phase 2 requirements vs current

| Requirement | Status | Notes |
|-------------|--------|-------|
| Zero-config discovery | **Implemented** | `discovery/zeroconfig.ts` — wrangler, package.json, vitest/vite/tsconfig, PM |
| `edgemirror verify` / `v` | **Implemented** | Auto-runs available checks; evidence under `.edgemirror/runs/` |
| Cloudflare Vitest integration | **Partial** | Detect + `--vitest`; `@edgemirror/vitest` thin reporter. Does not embed CF pool. |
| Preview URL execution | **Implemented** | `preview` command + `verify --preview`; honest not-configured |
| Local ↔ preview differential | **Implemented** | Reuses normalize/diff/evidence |
| GitHub PR verification | **Implemented** | `init --github` + `integrations/github-actions/verify` |
| Evidence bundle | **Implemented** | `edgemirror bundle EM-###` → `.edgemirror/bundles/*.edgemirror/` |
| Compatibility-date testing | **Partial** | Local matrix real; remote matrix deferred (needs creds) |
| Version-skew / rollout / prod smoke | **Stub / deferred** | Prefer real preview+compat+verify over fake skew |
| Interactive TUI | **Deferred** | Lower priority |
| VS Code extension | **Deferred** | Lower priority |
| MCP interface | **Deferred** | Prefer working verify |
| `@edgemirror/sdk` / `@edgemirror/vite` | **Not split yet** | CLI exports cover SDK needs for now |

## Docs checklist

| Doc | Status |
|-----|--------|
| ARCHITECTURE.md | Present (Phase 1) |
| PHASE2_GAP_ANALYSIS.md | This file |
| SECURITY.md | Added |
| THREAT_MODEL.md | Added |
| EVIDENCE_MODEL.md | Added |
| CLOUDFLARE_INTEGRATION.md | Added |
| ADAPTER_SPEC.md | Added |
| ACQUISITION_READINESS.md | Added (technical diligence) |

## Recommended next milestones

1. Wire real preview URL parsing against live `wrangler versions upload` with credentials.
2. Expand compat matrix (flags × dates) with fixture Workers.
3. Optional `@edgemirror/sdk` extract once external consumers appear.
4. Thin MCP tool surface wrapping `verify`/`doctor`/`bundle`.
5. Affected/changed test selection (`--affected`) via git diff.
6. Production smoke against user-provided URL (explicit opt-in, never default invent).
