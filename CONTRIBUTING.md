# Contributing to EdgeMirror

Thanks for helping improve production confidence for Cloudflare Workers.

## Requirements

- Node.js **≥ 20**
- npm (workspaces)
- Optional: Cloudflare credentials for live remote/preview tests (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)

Ordinary unit and fixture tests **do not** require paid Cloudflare infrastructure.

## Quick start (clone → tests)

```bash
git clone https://github.com/theworker02/EdgeMirror.git
cd EdgeMirror
npm install
npm run build
npm test
```

Useful scripts (root `package.json`):

| Script | Purpose |
|--------|---------|
| `npm run build` | Build `edgemirror` CLI and workspace packages |
| `npm run gate:distribution` | Pack CLI tarball; install into blank Worker; doctor + verify |
| `npm test` | CLI test suite |
| `npm run test:unit` | Unit tests under `packages/cli/src` |
| `npm run typecheck` | Typecheck workspaces |
| `npm run edgemirror` | Run built CLI |

## Repository structure

```text
packages/cli/          edgemirror CLI + parity engine
packages/vitest/       Thin Vitest reporter
corpus/                Versioned parity fixtures
fixtures/              Workers used to test EdgeMirror
integrations/          GitHub Actions helpers
docs/                  Architecture, Cloudflare, site content, diligence
docs/site/             Documentation-site hierarchy (markdown)
pitch/                 Engineering briefs (non-marketing acquisition asks)
```

Empty `apps/*` / commercial package directories may appear as Phase 4 scaffolding — they are **not** required to contribute to the OSS CLI.

## Testing

```bash
# Default suite
npm test

# Local verify against the basic fixture
cd fixtures/basic-worker
npx edgemirror init
npx edgemirror verify --local
```

### Cloudflare integration tests

Live Cloudflare tests (when present under paths such as `tests/cloudflare-live/`) must:

- Be **opt-in** (explicit credentials / env flags)
- Never run in default `npm test`
- Never fabricate remote results when credentials are absent

Until Agent 2 merges a live suite, treat remote behavior as covered by honest `REMOTE_NOT_CONFIGURED` paths and local fixture tests.

### DEMO vs real corpus

`edgemirror demo` creates an **isolated** labeled DEMO finding. Never mix DEMO artifacts into shared corpus assertions.

## Style

- TypeScript, ESM (`"type": "module"`)
- Prefer structured process argument arrays over shell string concatenation
- Never invent observations — use `unavailable` / status codes
- Keep reports and traces redaction-aware (`packages/cli/src/privacy`)

## Commits

Use conventional commits:

```text
feat(cli): …
fix(diff): …
docs(site): …
chore(release): …
```

Keep commits focused. Do not commit secrets, `.edgemirror/` run artifacts, or `.env` files.

## Pull requests

1. Branch from an up-to-date base (coordinate with maintainers during multi-agent sprints).
2. Include tests for behavior changes.
3. Update docs when CLI flags or schemas change.
4. Note any Cloudflare credential requirements in the PR body.
5. Do not claim Cloudflare endorsement.

## Fixtures

- `fixtures/basic-worker` — healthy parity path
- `fixtures/divergent-worker` — intentional divergence for engine tests
- Corpus JSON under `corpus/` — keep IDs stable; document expected behavior

## Security reports

Do not file public issues with exploit details. Contact the repository owner (`theworker02`) privately. See [docs/SECURITY.md](./docs/SECURITY.md).

## License

EdgeMirror is source-available proprietary software (see [LICENSE](./LICENSE) and [COMMERCIAL.md](./COMMERCIAL.md)). By contributing, you assign or license your contribution to the Licensor as described in LICENSE so it can be relicensed and commercialized. Do not contribute code you cannot grant on those terms.
