# Workers, Wrangler, and workerd

EdgeMirror is the **Wrangler-adjacent quality companion**: it orchestrates Wrangler for local/remote/preview execution and makes verify-before-deploy the default path. It does not replace Cloudflare tooling or imply endorsement.

## Local

EdgeMirror spawns `wrangler dev --local` (workerd) on an ephemeral port and runs the HTTP corpus. Quality: production-quality for HTTP parity (support report).

## Remote

With credentials, deploys an isolated `edgemirror-tmp-*` Worker, runs the same corpus, cleans up when ownership markers allow.

## Preview

Uses `wrangler versions upload` preview URLs when credentials exist, or an explicit `--url` / `--preview-url`.

## Auth

See support report `authentication`. Missing → `REMOTE_NOT_CONFIGURED`.

## Zero-config / init

```bash
edgemirror init                 # edgemirror.yaml + .edgemirror/
edgemirror init --cloudflare-gate  # required CI gate before wrangler deploy
edgemirror doctor               # fingerprints Wrangler, workerd, auth, bindings
```

Doctor also surfaces Vitest / Vite / TypeScript zero-config extras when present.

## Deploy (verify then wrangler)

```bash
edgemirror deploy
# Failed verify aborts. Override only with:
edgemirror deploy --force
```

## Support escalation

```bash
edgemirror support-bundle
```

Packages `EM-###` receipts, `doctor --support-report`, bindings matrix, and compat artifacts for Cloudflare tickets. See [FINDING_FORMAT.md](../../FINDING_FORMAT.md).

## Non-affiliation

EdgeMirror orchestrates Wrangler; it does not replace Cloudflare tooling or imply endorsement.
