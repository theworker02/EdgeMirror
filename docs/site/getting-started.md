# Getting Started

## Requirements

- Node.js ≥ 20
- A Cloudflare Worker project (Wrangler config)

## Install from this monorepo

```bash
npm install
npm run build
npm test
```

## First verify (local)

```bash
cd fixtures/basic-worker   # or your Worker
npx edgemirror init
npx edgemirror doctor
npx edgemirror verify --local
```

## See a labeled divergence

```bash
npx edgemirror demo
```

DEMO findings are isolated and never mixed with your real corpus.

## With Cloudflare credentials

Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then:

```bash
npx edgemirror verify
npx edgemirror preview
```

Missing credentials → `REMOTE_NOT_CONFIGURED` (honest skip).

## CI scaffold

```bash
npx edgemirror init --ci
# or
npx edgemirror init --github
```

## Next

- [CLI reference](./cli-reference.md)
- [Cloudflare support](./cloudflare/support-matrix.md)
- [Evidence model](../EVIDENCE_MODEL.md)
