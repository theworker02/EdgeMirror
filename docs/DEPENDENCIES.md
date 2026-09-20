# Dependencies

Inventory of EdgeMirror’s direct dependencies for technical diligence. Versions as declared in package manifests at baseline `0.1.0` / commit `88dd111` lineage.

## Runtime requirements

| Requirement | Constraint |
|-------------|------------|
| Node.js | `>=20` |
| Wrangler / workerd | Invoked via project / `npx wrangler` (devDependency on CLI package for local testing) |

## `@edgemirror/cli` dependencies

| Package | Role |
|---------|------|
| `commander` | CLI parsing |
| `js-yaml` | `edgemirror.yaml` |
| `picocolors` | Terminal styling |
| `zod` | Config schema validation |

### `@edgemirror/cli` devDependencies

| Package | Role |
|---------|------|
| `typescript` | Build |
| `vitest` | Tests |
| `wrangler` | Fixture / integration execution |
| `@types/node`, `@types/js-yaml` | Types |

## `@edgemirror/vitest`

Thin reporter; see `packages/vitest/package.json` for its declared peers/deps. It does **not** embed `@cloudflare/vitest-pool-workers`.

## Concentration / supply-chain notes

- EdgeMirror shells out to **Wrangler**; behavior tracks Wrangler releases.
- Cloudflare API availability and token scopes gate remote/preview paths.
- Prefer pinning Wrangler in consumer projects.
- Minimal direct dependency surface by design.

## Generating a live audit

```bash
npm audit
```

Release engineering (Agent 6) may add SBOM / license inventory gates. Agent 3 owns security audit depth.

## Non-dependencies (clarifications)

- **No cryptocurrency / blockchain libraries** — Compute Units (planned) are accounting meters only.
- **No Stripe / hosted DB in OSS CLI** — commercial stack is separate and not required to verify.
