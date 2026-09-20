# Live Cloudflare demo

Static landing (GitHub Pages): https://theworker02.github.io/EdgeMirror/

```bash
# from repo root after build
node packages/cli/dist/cli/bin.js pitch-demo
# equivalent:
node packages/cli/dist/cli/bin.js demo cloudflare

node packages/cli/dist/cli/bin.js demo reset   # ownership-safe cleanup; needs credentials
```

Target: under five minutes for a technical meeting — real local execution, optional preview, labeled controlled divergence, evidence bundle. DEMO/pitch findings stay isolated from real corpora.

Without Cloudflare credentials, preview reports `REMOTE_NOT_CONFIGURED` — never fabricated.

Offline DEMO (no Cloudflare):

```bash
node packages/cli/dist/cli/bin.js demo
```
