# EdgeMirror distribution

## Goal

External developers should eventually install EdgeMirror with:

```bash
npx edgemirror verify
```

That requires an **unscoped** npm package named `edgemirror`, not a personal or org-scoped package as the primary identity.

## Package identity

| Asset | Recommended identity | Notes |
|-------|----------------------|-------|
| GitHub repository | Independent `EdgeMirror` repo (org or transfer-ready) | Transfers carry issues/PRs/releases |
| npm package | **`edgemirror`** (unscoped) | Maintainers can be transferred; scopes cannot move across orgs |
| Domain / brand | Independent of personal GitHub username | Document ownership separately |

### Avoid as permanent public distribution

- `@theworker02/edgemirror` — personal scope, transfer friction
- `@magnexis/edgemirror` — org scope cannot become `@cloudflare/edgemirror` later
- GitHub Packages as the *canonical* registry — requires `@scope/name` and consumers must configure `npm.pkg.github.com`

GitHub Packages remains fine for **internal** or pre-release mirrors. Public adoption should target **npmjs.com**.

## Publishable package (today)

Workspace package:

```text
packages/cli  →  name: "edgemirror"
bin.edgemirror → ./dist/cli/bin.js
```

Build and pack **without publishing**:

```bash
npm run build -w edgemirror
npm pack -w edgemirror
# → edgemirror-0.1.0.tgz
```

Install the tarball into any project:

```bash
npm install ./edgemirror-0.1.0.tgz
npx edgemirror doctor
npx edgemirror verify --local
```

## Distribution-readiness gate

```bash
npm run gate:distribution
```

This script:

1. Builds the CLI  
2. Creates `edgemirror-*.tgz` via `npm pack`  
3. Creates a **blank** Cloudflare Worker in a temp directory (not the monorepo)  
4. Installs the tarball + `wrangler` into that project  
5. Runs `edgemirror doctor` and `edgemirror verify --local` from `node_modules/.bin`  

Exit code `0` only if those steps succeed. Keep temp dirs with `EDGEMIRROR_DIST_KEEP=1`.

Wire this into release CI (`ci:local` / release receipt) before any public `npm publish`.

## Diligence checklist (separable assets)

Document ownership outside personal accounts where possible:

- [ ] GitHub repository owner  
- [ ] npm package maintainers (`edgemirror`)  
- [ ] Domain / DNS  
- [ ] Trademarks / brand assets  
- [ ] Dependency license inventory (`npm run security:sbom`)  
- [ ] Cloudflare account used for demos / dogfood  
- [ ] Stripe account (Cloud billing)  
- [ ] Hosted infrastructure / signing keys  

## Publishing later (when ready)

1. Confirm name availability and trademark appropriateness for `edgemirror` on npmjs.com.  
2. Pass `npm run gate:distribution`.  
3. `npm publish -w edgemirror --access public` (explicit human authorization).  
4. Prefer provenance / trusted publishing when available.  

Do **not** publish solely to satisfy packaging hygiene — the gate proves installability first.
