/** Scaffold content for `edgemirror init --github`. */

export const GITHUB_WORKFLOW_YAML = `# EdgeMirror PR verification
# Independent open-source — not affiliated with Cloudflare, Inc.
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

      - name: Build EdgeMirror (if monorepo tooling present)
        run: npm run build --if-present

      - name: EdgeMirror verify (local)
        # Remote/preview require secrets — omit rather than fabricate results.
        # Fork PRs must not receive CLOUDFLARE_* or runner tokens.
        run: npx edgemirror verify --local --ci --format agent
        env:
          # Optional — only on trusted (non-fork) refs; remove --local to enable remote:
          # CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          # CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CI: true

      - name: Upload evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: edgemirror-evidence
          path: .edgemirror/
          if-no-files-found: ignore
`;
