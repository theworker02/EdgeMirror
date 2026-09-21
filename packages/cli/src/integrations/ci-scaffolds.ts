/** CI scaffold content for `edgemirror init --ci` / `--github` / `--cloudflare-gate`. */

export {
  GITHUB_WORKFLOW_YAML,
  CLOUDFLARE_GATE_WORKFLOW_YAML,
  CLOUDFLARE_GATE_README,
} from "./github-workflow.js";

export const GITLAB_CI_YAML = `# EdgeMirror verify (GitLab CI)
# Independent open-source — not affiliated with Cloudflare, Inc.
# Remote/preview require CI variables — omit rather than fabricate results.
# Fail the pipeline on divergence / insufficient evidence before deploy.

stages:
  - verify
  - deploy

edgemirror:
  stage: verify
  image: node:22
  script:
    - npm ci
    - npm run build --if-present
    - npx edgemirror verify --local --ci --format agent
  artifacts:
    when: always
    paths:
      - .edgemirror/
    expire_in: 1 week
  variables:
    CI: "true"
    # Optional for remote parity:
    # CLOUDFLARE_API_TOKEN: $CLOUDFLARE_API_TOKEN
    # CLOUDFLARE_ACCOUNT_ID: $CLOUDFLARE_ACCOUNT_ID

# Uncomment to make deploy depend on verify:
# deploy:
#   stage: deploy
#   image: node:22
#   script:
#     - npm ci
#     - npx edgemirror deploy --ci
#   needs: [edgemirror]
#   only:
#     - main
`;

export const WORKERS_BUILDS_HINT = `# Cloudflare Workers Builds + EdgeMirror

EdgeMirror is independent OSS and is **not affiliated with Cloudflare, Inc.**

## Required quality gate (before deploy)

Configure Workers Builds so verify runs **before** the deploy step:

\`\`\`bash
npm ci && npx edgemirror verify --local --ci --format agent && npx wrangler deploy
\`\`\`

Or use the Wrangler-adjacent path (verify-then-deploy, refuses on failed verify unless \`--force\`):

\`\`\`bash
npm ci && npx edgemirror deploy --ci
\`\`\`

## Notes

- Use \`--local\` until \`CLOUDFLARE_API_TOKEN\` / \`CLOUDFLARE_ACCOUNT_ID\` are configured as build secrets.
- Never treat a skipped remote check as a MATCH.
- Evidence lands under \`.edgemirror/\` in the build workspace (ephemeral unless you export artifacts).
- For GitHub-hosted repos, prefer \`edgemirror init --cloudflare-gate\` for the reusable workflow.
- Escalate platform issues with \`npx edgemirror support-bundle\`.
`;
