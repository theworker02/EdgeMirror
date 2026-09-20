/** CI scaffold content for `edgemirror init --ci` / `--github`. */

export { GITHUB_WORKFLOW_YAML } from "./github-workflow.js";

export const GITLAB_CI_YAML = `# EdgeMirror verify (GitLab CI)
# Independent open-source — not affiliated with Cloudflare, Inc.
# Remote/preview require CI variables — omit rather than fabricate results.

stages:
  - verify

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
`;

export const WORKERS_BUILDS_HINT = `# Cloudflare Workers Builds + EdgeMirror

EdgeMirror is independent OSS and is **not affiliated with Cloudflare, Inc.**

## Suggested build command

\`\`\`bash
npm ci && npx edgemirror verify --local --ci --format agent
\`\`\`

## Notes

- Use \`--local\` until \`CLOUDFLARE_API_TOKEN\` / \`CLOUDFLARE_ACCOUNT_ID\` are configured as build secrets.
- Never treat a skipped remote check as a MATCH.
- Evidence lands under \`.edgemirror/\` in the build workspace (ephemeral unless you export artifacts).
`;
