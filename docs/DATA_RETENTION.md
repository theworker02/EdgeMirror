# Data Retention

## Local CLI (shipped)

| Data | Default location | Retention |
|------|------------------|-----------|
| Traces, receipts, reports | `.edgemirror/` under the project | Until the user deletes them |
| Ownership markers | `.edgemirror/ownership/` | Until cleanup / manual delete |
| Temporary remote Workers | Cloudflare account (`edgemirror-tmp-*`) | Deleted on cleanup when `remote.cleanup: true` (default) |
| DEMO temp directories | OS temp | Removed after demo unless `--keep` |

EdgeMirror does **not** upload local artifacts to a vendor service in the OSS CLI path.

### Recommendations

- Add `.edgemirror/` to `.gitignore` (project templates should already ignore it where configured)
- Purge bundles before sharing if bodies may contain secrets
- Rotate Cloudflare tokens if a run directory was shared broadly

## Hosted EdgeMirror Cloud (planned — not shipped)

No production retention SLA exists yet. Diligence expectations when Cloud ships:

| Class | Suggested default (subject to change) |
|-------|----------------------------------------|
| Run metadata | Configurable; org policy |
| Trace blobs | Time-bounded; CU/plan gated |
| Billing records | Per legal/accounting requirements |
| Deleted orgs | Soft-delete then hard-delete window |

Until Cloud ships, treat this section as **aspirational policy**, not a product promise.
