# Security

EdgeMirror runs locally and may deploy **temporary, EdgeMirror-owned** Workers when remote/preview tests are enabled.

## Trust boundaries

- **Local machine** — reads project Wrangler config, spawns `wrangler` / `npx`, writes `.edgemirror/`.
- **Cloudflare API** — only when credentials are present; used to create/delete temporary Workers or preview versions.
- **CI** — GitHub Actions should use least-privilege tokens (`Workers Scripts:Edit` scoped).

## Credentials

- Prefer `CLOUDFLARE_API_TOKEN` over global API keys.
- Never commit tokens. `.env` is gitignored.
- Traces and reports pass through redaction (`privacy/`) before persistence; treat artifacts as potentially sensitive anyway.

## Resource safety

- Remote resources are claimed with ownership markers under `.edgemirror/ownership/`.
- Cleanup only deletes resources EdgeMirror can prove it owns.
- Temporary Worker names use `edgemirror-tmp-*` prefixes.

## Supply chain

- CLI shells out to `npx wrangler` — pin Wrangler in the target project where possible.
- No SaaS control plane in v1/v2; reduced remote attack surface.

## Reporting

Report security issues privately to the repository owner (`theworker02` on GitHub). Do not file public issues with exploit details.
