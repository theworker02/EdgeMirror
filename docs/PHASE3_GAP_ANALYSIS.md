# Phase 3 Gap Analysis

Date: 2026-09-19  
Compared against Phase 2 baseline (`043de9f`) after Phase 3 friction checkpoint.

## Sprint 1 — Friction

| Requirement | Status | Notes |
|-------------|--------|-------|
| Bare `edgemirror` onboarding / auto local verify | **Done** | `cli/onboarding.ts` |
| Zero-install excellence | **Partial** | Works via workspace `npx`; published npm timing not measured here |
| create-cloudflare autodetection | **Done** | Heuristic signals only |
| `edgemirror demo` isolated DEMO | **Done** | Synthesized remote, clearly labeled |
| This gap doc | **Done** | |

## Sprint 2 — Distribution

| Requirement | Status |
|-------------|--------|
| `init --ci` | **Done** |
| GH Action PR summary polish | **Deferred** (workflow scaffold exists) |
| `edgemirror badge` | **Deferred** → Phase 4 |
| README hero | **Deferred** → Phase 4 M1 |

## Sprint 3 — Evidence

| Requirement | Status |
|-------------|--------|
| EMF/1 format | **Deferred** → Phase 4 explorer |
| `reproduce EM-###` | **Deferred** |
| Public explorer skeleton | **Deferred** → Phase 4 `apps/explorer` |
| Upstream Markdown embeds | **Deferred** |

## Supercharger

| Requirement | Status |
|-------------|--------|
| Sprint A (DAG, scheduler, CU, governors) | **Not in this checkpoint** → Phase 4 M4 interfaces |
| Verify without Supercharger unchanged | **Preserved** (no Supercharger wiring yet) |

## Blocked without Cloudflare credentials

Real remote deploy, preview URL creation, remote parity %, production smoke.

## Recommended Phase 4 focus

Productization: docs site, control-plane API, dashboard, billing (Stripe), explorer — without crippling OSS CLI.
