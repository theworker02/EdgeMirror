# Privacy

How EdgeMirror handles potentially sensitive data during parity runs.

## What may be captured

Traces and reports can include:

- HTTP response bodies and headers from your Worker
- Exception messages and stacks
- Console output
- Configuration fingerprints (paths, binding counts, compatibility dates)

Treat `.edgemirror/` artifacts as **sensitive** even after redaction.

## Redaction (shipped)

Before persistence, strings pass through `packages/cli/src/privacy`:

- Bearer tokens
- Authorization / API key header shapes
- AWS access key patterns
- PEM private key blocks
- `CLOUDFLARE_API_TOKEN` assignment shapes
- Optional custom regexes from `edgemirror.yaml` → `redaction.patterns`

Redaction is best-effort. It is **not** a guarantee that artifacts are safe to publish.

## Credentials

- Prefer `CLOUDFLARE_API_TOKEN` with least privilege
- Never commit tokens or `.env`
- Doctor / reports must not print secret values

## DEMO mode

`edgemirror demo` uses an isolated temp Worker. Still avoid pasting DEMO reports that might contain local environment leakage into public issues without review.

## Hosted Cloud (planned)

Future multi-tenant storage must define:

- Encryption at rest
- Tenant isolation
- Access audit
- Retention windows (see [DATA_RETENTION.md](./DATA_RETENTION.md))

Those controls are **not** shipped in the OSS CLI.
