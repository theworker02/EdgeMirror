# CLI reference

Validated against `@edgemirror/cli` on docs branch baseline (`88dd111`) unless marked **post-merge (agent/cloudflare)**.

## Global

```text
edgemirror [--auto-verify] [-V|--version] [-h|--help]
```

Bare invocation: interactive onboarding (TTY) or safe local verify.

## Commands (baseline)

| Command | Options (summary) |
|---------|-------------------|
| `init` | `--github`, `--ci`, `--cloudflare-gate`, `--force` |
| `doctor` | `-v/--verbose`, `--json`, `--bindings`, `--support-report` |
| `verify` / `v` | `--format terminal\|json\|agent`, `--vitest`, `--preview`, `--preview-url`, `--local`, `--ci`, `--filter`, `-q` |
| `test` | `--local`, `--skip-remote`, `--preview`, `--preview-url`, `--filter`, `--ci`, `-q` |
| `preview` | `--url`, `--filter`, `--ci` |
| `compat` / `matrix` | `--dates`, `--filter` |
| `bundle <id>` | Finding `EM-###` or run id |
| `deploy` | `--force`, `--skip-verify` (requires `--force`), `--local-verify`, `--ci` |
| `support-bundle` / `escalate` | Cloudflare ticket packet (receipts + doctor + compat) |
| `demo` | `--keep`, `-q` |

## Commands (post-merge agent/cloudflare)

| Command | Notes |
|---------|-------|
| `doctor --bindings` | Human support matrix |
| `doctor --support-report` | JSON support report |
| `matrix` | Alias of `compat` |
| `pitch-demo` | Live meeting demo |
| `demo cloudflare` | Same as pitch-demo |
| `demo reset` | Ownership-safe CF cleanup |

Confirm with `edgemirror --help` after merge before scripting.
