# Configuration

File: `edgemirror.yaml` (created by `edgemirror init`).

```yaml
project:
  # wranglerConfig: wrangler.jsonc

remote:
  maxRuns: 200
  maxDurationMinutes: 15
  cleanup: true

redaction:
  enabled: true
  patterns: []

corpus:
  includeBuiltin: true
  paths: []

reporters:
  formats:
    - terminal
```

Validated by Zod in `packages/cli/src/config/index.ts`. Artifacts directory: `.edgemirror/`.
