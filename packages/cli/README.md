# EdgeMirror CLI

```bash
npx edgemirror verify
```

Production-parity testing for Cloudflare Workers.

This package is the **unscoped** public CLI (`edgemirror`). It is independent open-source software and is **not** affiliated with or endorsed by Cloudflare.

## Install

```bash
npm install -D edgemirror
# or, without publishing:
npm install ./edgemirror-0.1.0.tgz
```

Requires Node.js ≥ 20. For local Worker execution, install `wrangler` in the target project (peer dependency).

## Commands

```bash
edgemirror doctor
edgemirror verify --local
edgemirror verify --supercharge
edgemirror demo
edgemirror supercharge plan
```

See the [repository README](https://github.com/theworker02/EdgeMirror) and [docs/DISTRIBUTION.md](https://github.com/theworker02/EdgeMirror/blob/main/docs/DISTRIBUTION.md).

## License

Source-available proprietary — see repository [LICENSE](../../LICENSE) and [COMMERCIAL.md](../../COMMERCIAL.md).
