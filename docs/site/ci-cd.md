# CI/CD — Cloudflare Workers quality gate

Treat EdgeMirror as a **required check before `wrangler deploy`**. It fails on divergence or insufficient evidence and never invents remote parity (`REMOTE_NOT_CONFIGURED` when secrets are absent).

## Scaffold (gold standard)

```bash
edgemirror init --cloudflare-gate
# alternatives:
edgemirror init --ci
edgemirror init --github
```

Writes `.github/workflows/edgemirror-verify.yml` that calls the reusable workflow, plus `.edgemirror/CLOUDFLARE_GATE.md`.

## Reusable workflow

```yaml
jobs:
  edgemirror-verify:
    uses: theworker02/EdgeMirror/.github/workflows/reusable-edgemirror-verify.yml@main
    with:
      local-only: true
      format: agent
```

Mark the job as a **required branch-protection status check**.

## Composite action

See [`integrations/github-actions/verify`](../../integrations/github-actions/verify/README.md).

```yaml
- uses: theworker02/EdgeMirror/integrations/github-actions/verify@main
  with:
    local-only: "true"
```

## Deploy path

```bash
edgemirror deploy                 # verify → wrangler deploy
edgemirror deploy --force         # loud override after failed verify
edgemirror deploy --skip-verify --force   # skip verify (also requires --force)
```

## Support escalation

```bash
edgemirror support-bundle   # alias: escalate
```

Attach the generated `.edgemirror/support-bundles/cf-escalation-*/` folder to Cloudflare tickets.

## Exit codes (`--ci`)

| Code | Meaning |
|------|---------|
| 0 | Parity / intentional local success |
| 1 | Confirmed unexpected divergence |
| 2 | Config / execution failure |
| 3 | Insufficient evidence |

## Workers Builds

See scaffold hint from `edgemirror init --ci` when a Wrangler project is detected without GitHub/GitLab markers: run verify before deploy in the build command.
