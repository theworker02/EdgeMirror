# Security Policy

## Supported versions

Security fixes land on the `main` branch of https://github.com/theworker02/EdgeMirror.

## Reporting a vulnerability

Please **do not** open a public issue for security-sensitive reports.

1. Contact the maintainer via GitHub: [@theworker02](https://github.com/theworker02)
2. Or use GitHub **Private vulnerability reporting** on this repository if enabled

Include: impact, reproduction steps, affected commit/version, and whether credentials or remote Workers were involved.

We aim to acknowledge reports within a reasonable time and will coordinate disclosure.

## Operator notes

EdgeMirror may create temporary Cloudflare Workers named `edgemirror-tmp-*` when remote/preview runs are authenticated. Cleanup is ownership-gated. Prefer least-privilege API tokens.

Full trust-boundary documentation: [`docs/SECURITY.md`](./docs/SECURITY.md) · threat model: [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md).
