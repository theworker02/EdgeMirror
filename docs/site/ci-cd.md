# CI/CD

## Scaffold

```bash
edgemirror init --ci
edgemirror init --github
```

Detects GitHub Actions, GitLab CI, or Workers Builds hints honestly.

## Composite action

See [`integrations/github-actions/verify`](../../integrations/github-actions/verify/README.md).

```yaml
- uses: theworker02/EdgeMirror/integrations/github-actions/verify@main
  with:
    local-only: "true"
```

## Exit codes (`--ci`)

| Code | Meaning |
|------|---------|
| 0 | Parity / intentional local success |
| 1 | Confirmed unexpected divergence |
| 2 | Config / execution failure |
| 3 | Insufficient evidence |
