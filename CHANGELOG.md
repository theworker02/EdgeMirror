# Changelog

All notable changes to EdgeMirror are documented here.

This file is reconstructed from **git history** on `main` / `agent/docs` baseline. Dates and features are not invented.

Format inspired by [Keep a Changelog](https://keepachangelog.com/). Version tags may lag commits until release engineering cuts formal releases.

## [Unreleased]

### Documentation

- Expanded Cloudflare-ready README (problem/solution, STABLE bindings, CI gate, deploy path, support-bundle, Supercharger, commercial/acquisition pointers)
- Fixed GitHub hero/logo rendering via PNG exports (`docs/assets/hero.png`, `logo.png`); removed corrupt control character from `hero.svg`
- Published measured Supercharger benchmarks in `docs/BENCHMARKS.md` (microbench + CU 5 vs 500 plan differentiation)
- Corrected stale “Supercharger not shipped / no public benchmarks” claims across README, ROADMAP, SUPERCHARGER, ARCHITECTURE, site docs

## [0.1.0] — 2026-09-19

Baseline package version in `package.json` / `@edgemirror/cli@0.1.0`. Two commits on the documented history:

### Added — Phase 3 friction (`88dd111`)

- Bare `edgemirror` interactive onboarding (TTY) with safe local auto-verify
- `--auto-verify` / `EDGEMIRROR_AUTO_VERIFY` for non-interactive local verify
- `edgemirror demo` — isolated DEMO Worker with labeled divergence; never mixes with the real corpus
- create-cloudflare / C3 autodetection heuristics in zero-config discovery
- `edgemirror init --ci` — detects GitHub Actions / GitLab / Workers Builds and scaffolds honestly
- Phase 3 status and gap analysis docs

### Added — Phase 1 parity engine + Phase 2 verify workflow (`043de9f`)

- Publishable CLI workspace (`@edgemirror/cli`) with commands: `init`, `doctor`, `test`, `verify`/`v`, `preview`, `compat`, `bundle`, `deploy`
- Local execution via `wrangler dev --local`
- Remote / preview paths that report `REMOTE_NOT_CONFIGURED` when Cloudflare credentials are absent (never faked)
- Trace schema (`ExecutionTrace` 1.0), normalizer, differential comparison, classifications
- Evidence receipts, reports (terminal / json / html / agent), ownership-tracked remote cleanup
- Built-in corpus fixture (`http-get-root`), basic + divergent Worker fixtures
- Zero-config discovery (Wrangler, package managers, Vitest/Vite signals)
- Compatibility-date local matrix (`compat`)
- Portable evidence bundles (`bundle EM-###`)
- GitHub Actions workflow scaffold (`init --github`) and composite action under `integrations/github-actions/verify`
- Thin Vitest reporter package `@edgemirror/vitest`
- Architecture, security, threat model, evidence model, Cloudflare integration, adapter spec, acquisition-readiness docs
- Source-available proprietary license + commercial sales path (`COMMERCIAL.md`), funding metadata

### Notes

- Hosted Cloud, Supercharger scheduler/CU, and public explorer were **not** part of these commits.
- Remote parity percentages require live Cloudflare credentials; absent credentials yield honest skip statuses.

[Unreleased]: https://github.com/theworker02/EdgeMirror/compare/88dd111...HEAD
[0.1.0]: https://github.com/theworker02/EdgeMirror/tree/88dd111
