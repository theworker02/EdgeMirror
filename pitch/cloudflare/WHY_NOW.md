# Why now — EdgeMirror × Cloudflare Workers

**Audience:** Product / corpdev / platform leaders evaluating buy-vs-build timing  
**Honesty:** No endorsement claims. No fabricated MAU. CU ≠ cryptocurrency.

## The trust gap is structural

Wrangler and workerd are the right local tools — and they are still **not** the production Workers platform. Compatibility dates, binding semantics, and edge behaviors drift. Docs and anecdotes do not scale. At Workers adoption volume, the missing piece is a **default evidence loop**: same request corpus, local vs remote/preview, classified diffs, attachable receipts.

EdgeMirror owns that loop today. Waiting does not close the gap; it only leaves deploys under-instrumented while the platform grows.

## What “now” means in the developer path

| Moment | Without evidence | With EdgeMirror |
|--------|------------------|-----------------|
| **PR / CI** | Local green merges blind to remote drift | Required gate fails on divergence / insufficient evidence (`init --cloudflare-gate`, reusable workflow) |
| **Deploy** | `wrangler deploy` after vibes | `edgemirror deploy` = verify → wrangler; `--force` is loud |
| **Support** | Tickets without reproducible local↔remote traces | `support-bundle` / `escalate` packages doctor + compat + `EM-###` |
| **Large corpora** | Sequential verify wall-clock pain | Optional **Supercharger** — `classic` or **double-trouble** (pair-wise) schedulers; measured ≥500-job capacity |

## Why the v1.4.0 freeze matters

The **v1.4.0** cut packages the diligence-ready surface:

- CI gate + deploy harden + support-bundle (already the platform-quality hooks)
- Supercharger **Double Trouble** (`--scheduler classic|double-trouble`) with published MEASURED 500-job benches
- Evidence interchange (EMF/1), `badge`, and `reproduce` landing with the freeze
- Public executive packet under `pitch/cloudflare/` for corpdev routing

Build-vs-buy calculus favors a repo that already ships honesty contracts (`REMOTE_NOT_CONFIGURED`), ownership-tracked temp Workers, and measured optional acceleration — rather than starting a parallel internal evidence project after the next support spike.

## What is intentionally *not* “now”

- Hosted multi-tenant EdgeMirror Cloud as a public product (not shipped)
- Claiming Cloudflare cannot operate without this repo
- Marketing CU as a token economy
- Replacing Wrangler

## Bottom line

Workers trust at scale needs **differential evidence in the default path**. EdgeMirror ships that path; **v1.4.0** freezes it for diligence. Partnership or acquisition is how Cloudflare owns the loop without a greenfield rebuild.

See [`EXECUTIVE_SUMMARY.md`](./EXECUTIVE_SUMMARY.md) · [`ACQUISITION.md`](../../ACQUISITION.md) · [`docs/BENCHMARKS.md`](../../docs/BENCHMARKS.md)
