/** Scaffold content for `edgemirror init --github` / `--cloudflare-gate`. */

/** Baseline PR verify workflow (local-only by default). */
export const GITHUB_WORKFLOW_YAML = `# EdgeMirror PR verification — run before wrangler deploy
# Independent open-source — not affiliated with Cloudflare, Inc.
# Exit codes: 0 parity · 1 divergence · 2 config · 3 insufficient evidence
name: EdgeMirror Verify

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  edgemirror:
    runs-on: ubuntu-latest
    # Least privilege: contents read only. Do not grant secrets to fork PRs.
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install
        run: npm ci

      - name: Build (if present)
        run: npm run build --if-present

      - name: EdgeMirror verify (local)
        # Remote/preview require secrets — omit rather than fabricate results.
        # Fork PRs must not receive CLOUDFLARE_* or runner tokens.
        uses: theworker02/EdgeMirror/integrations/github-actions/verify@main
        with:
          local-only: "true"
          format: agent
        env:
          CI: true
          # Optional — only on trusted (non-fork) refs; set local-only: "false":
          # CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          # CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Upload evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: edgemirror-evidence
          path: .edgemirror/
          if-no-files-found: ignore
`;

/**
 * Gold-standard Cloudflare Workers quality gate:
 * required check before deploy — uses the reusable workflow when possible,
 * documents verify-before-wrangler-deploy as the default path.
 */
export const CLOUDFLARE_GATE_WORKFLOW_YAML = `# EdgeMirror Cloudflare quality gate
# Required check before \`wrangler deploy\` / \`edgemirror deploy\`.
# Independent open-source — not affiliated with Cloudflare, Inc.
#
# Why this exists: Workers local tooling (wrangler / workerd) is excellent and
# still not identical to production. This gate fails CI on divergence or
# insufficient evidence so deploys are not blind.
#
# Exit codes: 0 parity · 1 divergence · 2 config · 3 insufficient evidence
name: EdgeMirror Cloudflare Gate

on:
  pull_request:
  push:
    branches: [main, master]
  workflow_dispatch:

concurrency:
  group: edgemirror-gate-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  edgemirror-verify:
    name: Verify before deploy
    uses: theworker02/EdgeMirror/.github/workflows/reusable-edgemirror-verify.yml@main
    with:
      working-directory: .
      # Keep true until CLOUDFLARE_* secrets are configured on trusted refs.
      local-only: true
      format: agent
    # Uncomment when secrets exist on non-fork refs (never pass to fork PRs):
    # secrets:
    #   CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
    #   CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  # Optional deploy job — only runs after verify succeeds.
  # Enable when you want Actions to deploy; otherwise keep deploy local/manual
  # with: npx edgemirror deploy
  # deploy:
  #   name: Deploy after verify
  #   needs: edgemirror-verify
  #   if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  #   runs-on: ubuntu-latest
  #   permissions:
  #     contents: read
  #   steps:
  #     - uses: actions/checkout@v4
  #     - uses: actions/setup-node@v4
  #       with:
  #         node-version: "22"
  #         cache: npm
  #     - run: npm ci
  #     - run: npm run build --if-present
  #     - name: edgemirror deploy (verify-then-wrangler)
  #       run: npx edgemirror deploy --ci
  #       env:
  #         CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
  #         CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
`;

/** Short companion doc dropped next to the gate workflow. */
export const CLOUDFLARE_GATE_README = `# EdgeMirror Cloudflare quality gate

This workflow is the **standard Workers deploy confidence check**:
\`edgemirror verify\` must pass before \`wrangler deploy\`.

## Commands

\`\`\`bash
# Scaffold (from a Worker repo)
npx edgemirror init --cloudflare-gate

# Local / CI verify
npx edgemirror verify --ci --format agent

# Verify then wrangler deploy (refuses on failed verify unless --force)
npx edgemirror deploy
\`\`\`

## GitHub required check

1. Merge a PR that adds \`.github/workflows/edgemirror-verify.yml\`
2. Repo → Settings → Branches → Branch protection → require status check
   **Verify before deploy** / job \`edgemirror-verify\`
3. Do not allow deploy paths that skip this check

## Reusable workflow (advanced)

\`\`\`yaml
jobs:
  verify:
    uses: theworker02/EdgeMirror/.github/workflows/reusable-edgemirror-verify.yml@main
    with:
      local-only: true
\`\`\`

## Support escalation

Attach differential evidence to Cloudflare tickets:

\`\`\`bash
npx edgemirror support-bundle
\`\`\`

EdgeMirror is independent OSS and is **not affiliated with Cloudflare, Inc.**
Missing credentials yield \`REMOTE_NOT_CONFIGURED\` — never fabricated parity.
`;
