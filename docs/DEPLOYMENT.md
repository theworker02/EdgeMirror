# Deployment — EdgeMirror

CLI (npm package `edgemirror`), optional dashboard/api packages, GitHub Actions integration, optional live Cloudflare credentials.

## Minimal path

See [`acquisition/BUYER_DEMO.md`](./acquisition/BUYER_DEMO.md).

## Rollback

- Application projects: redeploy previous release tag / prior container digest.
- Documentation corpora (ETW): revert git tag; do not delete historical license tags.
