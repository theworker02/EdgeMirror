# Cloudflare Integration

EdgeMirror targets Cloudflare Workers as the only production-quality runtime in Phase 1–2.

## Local

- Spawns `wrangler dev --local` on an ephemeral port
- Issues HTTP requests from the corpus
- Captures status, headers, body

## Remote

- Requires `CLOUDFLARE_API_TOKEN` (or interactive `wrangler login`)
- Deploys an isolated `edgemirror-tmp-*` Worker
- Executes the same corpus against `*.workers.dev`
- Deletes the Worker on cleanup when configured

## Preview

- Uses `wrangler versions upload` when credentials exist
- Or `--preview-url` for an existing URL
- Otherwise `REMOTE_NOT_CONFIGURED` / `PREVIEW_NOT_AVAILABLE`

## Vitest

- Detects `vitest.config.*` and `@cloudflare/vitest-pool-workers`
- `edgemirror verify --vitest` runs the project's test script
- `@edgemirror/vitest` is a thin reporter only

## Non-affiliation

EdgeMirror is not affiliated with Cloudflare, Inc. Wrangler remains the deployment tool of record; `edgemirror deploy` only orchestrates verify → wrangler.
