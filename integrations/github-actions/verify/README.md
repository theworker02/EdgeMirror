# EdgeMirror Verify (composite action)

Reusable GitHub Action wrapper around `edgemirror verify` — the **Workers quality gate** that should run **before** `wrangler deploy`.

Fails CI on:

| Exit | Meaning |
|------|---------|
| 1 | Confirmed divergence |
| 2 | Configuration / execution failure |
| 3 | Insufficient evidence (e.g. remote required but `REMOTE_NOT_CONFIGURED`) |

## Usage (composite)

```yaml
- uses: theworker02/EdgeMirror/integrations/github-actions/verify@main
  with:
    local-only: "true"
    format: agent
```

## Usage (reusable workflow — preferred)

```yaml
jobs:
  edgemirror-verify:
    uses: theworker02/EdgeMirror/.github/workflows/reusable-edgemirror-verify.yml@main
    with:
      local-only: true
```

Scaffold into any Worker repo:

```bash
npx edgemirror init --cloudflare-gate
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `local-only` | `true` | Skip remote/preview (honest when no CF secrets) |
| `format` | `agent` | Report format |
| `working-directory` | `.` | Project directory |

Set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` and `local-only: false` for remote parity. Never invents results when secrets are absent.

## Deploy path

```bash
npx edgemirror deploy          # verify then wrangler
npx edgemirror deploy --force  # loud override only
```

## Support escalation

```bash
npx edgemirror support-bundle
```

EdgeMirror is independent OSS — not affiliated with Cloudflare, Inc.
