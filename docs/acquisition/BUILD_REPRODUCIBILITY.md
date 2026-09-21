# Build Reproducibility — EdgeMirror

**Date:** 2026-09-21

## Fresh machine path

```
git clone https://github.com/theworker02/EdgeMirror.git && cd EdgeMirror
npm install
npm run build
npm test
npx edgemirror --help  # after workspace build, or use packages/cli
```

## Assumptions

- Stack: TypeScript / Node.js monorepo (npm workspaces)
- No machine-specific absolute paths should be required.
- Cloud credentials are optional unless exercising live provider features.

## Known reproducibility limits

Documented in KNOWN_LIMITATIONS.md and project-specific diligence.
