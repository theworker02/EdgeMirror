# Demo script — 5-minute live path

**Audience:** Live diligence / partnership call  
**Goal:** Show honesty + gates + escalation + optional Supercharger — not theater.

**Prep (before the call):**

```bash
git clone https://github.com/theworker02/EdgeMirror.git
cd EdgeMirror && npm install && npm run build
# Optional but recommended for remote half:
npx wrangler login
```

Binary for this repo: `node packages/cli/dist/cli/bin.js` (or `npx edgemirror` when published).

---

## Minute 0–1 — Frame (no slides required)

**Say:** Wrangler/workerd are excellent and still not identical to production. EdgeMirror is the differential evidence layer — local left, remote/preview right, classified findings, never invent remote MATCH.

**Point to:** https://theworker02.github.io/EdgeMirror/ · [`ACQUISITION.md`](../../ACQUISITION.md)  
**Disclaimer:** Independent; not affiliated with or endorsed by Cloudflare.

---

## Minute 1–2 — `pitch-demo` (labeled divergence)

```bash
node packages/cli/dist/cli/bin.js pitch-demo
```

**Show:** Real local workerd + (when authed) real preview / throwaway `edgemirror-tmp-*` Worker. Pitch path **intentionally** surfaces a labeled divergence so the room sees a finding, not silent MATCH theater. DEMO-labeled — not production metrics.

**If no auth:** Remote stays `REMOTE_NOT_CONFIGURED` — that is the product working correctly.

---

## Minute 2–3 — `verify` (honest gate)

```bash
node packages/cli/dist/cli/bin.js verify --local
# With credentials / project:
# node packages/cli/dist/cli/bin.js verify
```

**Show:** Exit codes and receipts matter. Divergence or insufficient evidence fails the gate. Mention CI: `init --cloudflare-gate` and deploy: `edgemirror deploy` = verify then wrangler (`--force` is loud).

---

## Minute 3–4 — `support-bundle` (escalation)

```bash
node packages/cli/dist/cli/bin.js support-bundle
# alias: escalate
```

**Show:** Packet suitable for a Cloudflare support ticket — doctor/support-report + compat artifacts + `EM-###` evidence when present. This is the support-cost argument.

---

## Minute 4–5 — Supercharger bench (optional acceleration)

```bash
node packages/cli/dist/cli/bin.js supercharge bench --jobs 500 --sleep-ms 8 --mode MAX --scheduler classic --json
node packages/cli/dist/cli/bin.js supercharge bench --jobs 500 --sleep-ms 8 --mode MAX --scheduler double-trouble --json
```

**Say:** Optional. Not required for verify. Synthetic I/O microbench — **MEASURED** scheduler capacity (≥500 jobs), not a wrangler/workerd speedup claim. **CU is accounting only — not cryptocurrency.**

**Published numbers (do not invent live):** see [`docs/BENCHMARKS.md`](../../docs/BENCHMARKS.md) — classic ~123.5× / double-trouble ~125.7× on the named 500×8ms harness (gates PASS).

Optional one-liner: `verify --supercharge --scheduler double-trouble`.

---

## Close (30 seconds)

1. Diligence packet: [`ONE_PAGER.md`](./ONE_PAGER.md) link list  
2. Contact: GitHub [@theworker02](https://github.com/theworker02) · reference `ACQUISITION.md`  
3. License: source-available proprietary — commercial via [`COMMERCIAL.md`](../../COMMERCIAL.md)  
4. **Do not** claim endorsement, MAU, or Hosted Cloud as shipped

## Fallback if network / auth fails

Run local-only verify + pitch-demo honesty path + Supercharger bench (no Cloudflare API required for synthetic bench). Still demonstrates the evidence and scheduler stories.
