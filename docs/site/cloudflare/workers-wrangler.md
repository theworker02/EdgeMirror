# Workers, Wrangler, and workerd

## Local

EdgeMirror spawns `wrangler dev --local` (workerd) on an ephemeral port and runs the HTTP corpus. Quality: production-quality for HTTP parity (support report).

## Remote

With credentials, deploys an isolated `edgemirror-tmp-*` Worker, runs the same corpus, cleans up when ownership markers allow.

## Preview

Uses `wrangler versions upload` preview URLs when credentials exist, or an explicit `--url` / `--preview-url`.

## Auth

See support report `authentication`. Missing → `REMOTE_NOT_CONFIGURED`.

## Non-affiliation

EdgeMirror orchestrates Wrangler; it does not replace Cloudflare tooling or imply endorsement.
