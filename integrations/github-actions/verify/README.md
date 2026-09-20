# EdgeMirror Verify (composite action)

Reusable GitHub Action wrapper around `edgemirror verify`.

## Usage

```yaml
- uses: theworker02/EdgeMirror/integrations/github-actions/verify@main
  with:
    local-only: "true"
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `local-only` | `true` | Skip remote/preview (honest when no CF secrets) |
| `format` | `agent` | Report format |
| `working-directory` | `.` | Project directory |

Set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` and `local-only: false` for remote parity.
