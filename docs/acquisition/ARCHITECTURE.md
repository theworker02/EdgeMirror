# Architecture — EdgeMirror

See also repository root architecture docs where present (`ARCHITECTURE.md`, `docs/`, `README.md`).

## Stack

TypeScript / Node.js monorepo (npm workspaces)

## Deployment

CLI (npm package `edgemirror`), optional dashboard/api packages, GitHub Actions integration, optional live Cloudflare credentials.

## Summary

Local↔remote parity engine for Cloudflare Workers — doctor/verify gates, Supercharger scheduler, bindings matrix, optional billing packages.

## Boundaries

- Third-party runtimes, cloud providers, and SDKs are **dependencies**, not owned assets.
- Project-specific diligence: [`EDGEMIRROR_DILIGENCE.md`](./EDGEMIRROR_DILIGENCE.md).

Buyer should walk architecture with the handoff plan ([HANDOFF_PLAN.md](./HANDOFF_PLAN.md)).
