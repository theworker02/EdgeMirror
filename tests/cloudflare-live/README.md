# Cloudflare live tests

These tests talk to the real Cloudflare API.

## Gate

Ordinary `npm test` does **not** run this suite.

Require:

```bash
EDGEMIRROR_CLOUDFLARE_LIVE=1
CLOUDFLARE_API_TOKEN=...   # Workers Scripts:Edit
CLOUDFLARE_ACCOUNT_ID=...
```

## Run

```bash
# from repo root (after build / with ts resolution)
npx vitest run --config tests/cloudflare-live/vitest.config.ts

# or via workspace script
npm run test:cloudflare-live -w @edgemirror/cli
```

Without credentials, live cases assert `REMOTE_NOT_CONFIGURED` or skip — they never fabricate preview/remote results.
