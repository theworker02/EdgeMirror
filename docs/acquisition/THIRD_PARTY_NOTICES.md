# Third-Party Notices — EdgeMirror

**Date:** 2026-09-21

This file summarizes third-party materials observed in-tree. It is **not** a complete SBOM.

## Package dependencies

npm: commander, js-yaml, picocolors, zod (MIT/ISC); stripe (MIT); wrangler/workerd (MIT OR Apache-2.0 / Apache-2.0). No GPL/AGPL observed in lock metadata.

Retain upstream license texts when redistributing binaries or bundled node_modules/site-packages.

## Non-package third-party materials

Cloudflare Wrangler/workerd runtime (not vendored source). Brand assets claimed first-party. No fonts/submodules found.

## Trademarks

Third-party marks referenced in docs remain owned by their respective owners. Project disclaimers (where present) should be preserved.

## Action items

- [ ] Regenerate machine-readable SBOM at closing
- [ ] Confirm Qt/PySide6 redistribution path if shipping GUI wheels — **REQUIRES_LEGAL_REVIEW**
- [ ] Confirm any vendored trees still carry upstream LICENSE/NOTICE
