# EdgeMirror — Executive summary

**Audience:** Cloudflare corporate development, product partnerships, Workers platform leadership  
**One page · board-room brief**  
**Status:** Independent source-available product — **not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.**  
**Release freeze:** **v1.4.0**

---

## Problem

Workers succeed when developers trust that **local ≈ production**. Wrangler and workerd are excellent — and still not identical to the production platform. Teams merge and deploy on local green without differential evidence. Support escalations arrive without reproducible local↔remote receipts. That is a **platform quality gap**, not a documentation gap.

## Solution

**EdgeMirror** is a CLI-first **local ↔ Cloudflare Workers parity engine**. It runs the same corpus against local (workerd) and remote/preview targets, normalizes nondeterminism, classifies differences, and emits hashed evidence receipts (`EM-###`). Missing credentials yield `REMOTE_NOT_CONFIGURED` — never fabricated MATCH.

It plugs into the path Cloudflare already owns: CI before merge, verify before `wrangler deploy`, and support packets for tickets.

## Why buy or partner **now**

| Pressure | EdgeMirror response |
|----------|---------------------|
| Local/prod trust at Workers scale | Differential evidence as a default gate, not an anecdote |
| CI / deploy harden | Required gate scaffolding + `edgemirror deploy` (verify → wrangler) |
| Support cost | `support-bundle` packages doctor + compat + `EM-###` receipts |
| Throughput on large corpora | Optional **Supercharger** — including **Double Trouble** pair-wise scheduler (measured ≥500-job capacity) |
| Diligence readiness | Public repo, acquisition brief, engineering packet, live demo — no captive MAU theater |

Delay means the trust gap stays under-instrumented while Workers adoption grows. EdgeMirror already ships the evidence loop; partnership or acquisition collapses build-vs-buy for this class of tooling.

## What ships (v1.4.0 cut)

- Publishable CLI identity `edgemirror` — verify / preview / deploy / doctor / pitch-demo
- Cloudflare CI gate (`init --cloudflare-gate`, reusable workflow) and deploy hardening
- `support-bundle` for escalation
- Full **STABLE** bindings matrix (HTTP/WS-observable surfaces)
- Optional **Supercharger**: classic + **double-trouble** schedulers, CU budgets (**CU ≠ cryptocurrency**), measured 500-job microbench
- Evidence / EMF / badge / reproduce surfaces landing with the freeze (see diligence links)

## What does **not** ship

- Cloudflare endorsement or “official product” status
- Fabricated MAU, revenue, or captive usage metrics
- Hosted multi-tenant EdgeMirror Cloud as a public product
- Replacement of Wrangler as the deploy tool of record
- Apache / OSI open-source claims — license is **source-available proprietary** ([`COMMERCIAL.md`](../../COMMERCIAL.md))

## Contact

**Primary:** GitHub [@theworker02](https://github.com/theworker02)  
**Repo:** https://github.com/theworker02/EdgeMirror  
**Acquisition brief:** [`ACQUISITION.md`](../../ACQUISITION.md)  
**Live demo:** https://theworker02.github.io/EdgeMirror/  
**Outreach log (partners inbox SENT once):** [`OUTREACH.md`](./OUTREACH.md)

For acquisition or partnership diligence, open a private channel via the GitHub account above and reference this packet. Prefer written evidence over verbal-only claims.
