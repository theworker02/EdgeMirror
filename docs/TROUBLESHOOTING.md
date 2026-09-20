# Troubleshooting

Practical failures for the current CLI. Baseline commands validated on docs branch build; Agent 2 Cloudflare extras noted as merge-pending.

## Wrangler unavailable / project not detected

**Symptoms:** `doctor` fails; verify cannot start local target.

```bash
edgemirror doctor -v
npx wrangler --version
```

Ensure `wrangler.toml` / `wrangler.json` / `wrangler.jsonc` exists. Set `project.wranglerConfig` in `edgemirror.yaml` if needed.

## Cloudflare auth failure

**Symptoms:** Remote/preview unavailable; `REMOTE_NOT_CONFIGURED` or Wrangler auth errors.

Prefer `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (see support report `authentication`). EdgeMirror never invents remote parity when auth is missing.

After Agent 2 merge:

```bash
edgemirror doctor --support-report
edgemirror doctor --bindings
```

## Preview failure / `PREVIEW_NOT_AVAILABLE`

```bash
edgemirror preview --url https://your-preview-url.example
```

Or supply credentials so `wrangler versions upload` can run.

## Unsupported / experimental binding parity

Doctor may **discover** bindings while running HTTP/WS-observable parity. All matrix surfaces are **STABLE** — see [CLOUDFLARE_INTEGRATION.md](./CLOUDFLARE_INTEGRATION.md) and `fixtures/bindings-http`.

## Remote timeout / budget exceeded

Trace status `BUDGET_EXCEEDED` or early stop. Adjust `edgemirror.yaml`:

```yaml
remote:
  maxRuns: 200
  maxDurationMinutes: 15
  cleanup: true
```

Reduce scope: `edgemirror verify --filter <pattern>`.

## Runner unavailable

OSS CLI has no external runner pool today. Failures are local Wrangler/process issues. Future Supercharger/Cloud runners: [RUNNER_PROTOCOL.md](./RUNNER_PROTOCOL.md).

## CU exhausted

CU metering is **not shipped** on the docs baseline. When Supercharger lands, CU remains accounting only (not crypto).

## Sandbox / local boot failure

```bash
edgemirror doctor -v
npx wrangler dev --local
```

Check port conflicts and Worker boot errors.

## DEMO mixed with real findings

`edgemirror demo` is isolated. Do not treat DEMO receipts as corpus evidence. Use `--keep` only for inspection.

## Pitch demo / demo reset (after Agent 2 merge)

```bash
edgemirror pitch-demo          # or: edgemirror demo cloudflare
edgemirror demo reset          # ownership-safe CF cleanup; needs credentials
```

Not present on docs branch `88dd111` until `agent/cloudflare` merges.

## CI exit code 3

Insufficient evidence (often remote without credentials).

```bash
edgemirror verify --local --ci
```

## More detail

```bash
edgemirror verify --format json
edgemirror verify --format agent
edgemirror doctor --json
```

Inspect `.edgemirror/runs/<id>/reports/` and receipts.
