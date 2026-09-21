# Executive Summary — EdgeMirror

**Date:** 2026-09-21  
**Current license:** EdgeMirror Source-Available Evaluation License (proprietary source-available)  
**Prior license (historical distributions):** Apache License, Version 2.0 (Apache-2.0)  
**Transition marker:** 6f2e998 (2026-09-20)

## What this is

Local↔remote parity engine for Cloudflare Workers — doctor/verify gates, Supercharger scheduler, bindings matrix, optional billing packages.

## Problem addressed

Teams deploy Workers without knowing local vs remote parity gaps; EdgeMirror aims to catch those before production.

## Maturity

Early commercial product posture (v1.4.0 diligence freeze). Single human git author; heavy Cursor co-authorship trailers.

## Deployment model

CLI (npm package `edgemirror`), optional dashboard/api packages, GitHub Actions integration, optional live Cloudflare credentials.

## Language / stack

TypeScript / Node.js monorepo (npm workspaces) · Version metadata: **1.4.0**

## Licensing posture (factual)

- Current tree: proprietary / source-available terms in root `LICENSE` (see exact text).
- Historical distributions under **Apache License, Version 2.0 (Apache-2.0)** remain governed by those terms for copies received, where applicable.
- See [`LICENSE_TRANSITION_ANALYSIS.md`](./LICENSE_TRANSITION_ANALYSIS.md) and root `LICENSE_TRANSITION_NOTICE.md`.

## Ownership (asserted, not adjudicated)

Asserted holder: **theworker02 (https://github.com/theworker02)**.  
LICENSE copyright: theworker02. Historical Apache notice said 'EdgeMirror contributors'. Sole human author theworker02; Cursor Co-authored-by on most commits. No CLA/DCO files. LICENSE §5 contribution assignment present.

**REQUIRES_LEGAL_REVIEW** before treating ownership as adjudicated or exclusive.

## What a buyer can expect

- Ability to evaluate and (after commercial license / acquisition) operate the project with documented handoff materials in this data room.
- Material third-party and historical-license limitations disclosed herein.
- No fabricated users, revenue, benchmarks, or exclusivity claims in this data room.

## Top diligence risks

- REQUIRES_LEGAL_REVIEW: Apache→proprietary transition
- REQUIRES_LEGAL_REVIEW: Cursor co-authorship chain of title
- REQUIRES_LEGAL_REVIEW: LICENSE §5 assignment vs formal CLA
