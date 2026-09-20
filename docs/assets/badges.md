# Honest badge strategy

Use only factual badges. Do **not** invent Cloudflare certification or endorsement.

## Recommended (Agent 4 may paste into README)

```markdown
[![License](https://img.shields.io/badge/license-Apache%202.0-0e1419?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-1a7a6d?style=flat-square)](./package.json)
[![npm](https://img.shields.io/npm/v/edgemirror?style=flat-square&label=edgemirror)](https://www.npmjs.com/package/edgemirror)
```

CI badge — only after Agent 6 wires a real workflow on the default branch:

```markdown
[![CI](https://github.com/theworker02/EdgeMirror/actions/workflows/ci.yml/badge.svg)](https://github.com/theworker02/EdgeMirror/actions)
```

Workers support — factual product scope, not endorsement:

```markdown
[![Cloudflare Workers](https://img.shields.io/badge/target-Cloudflare%20Workers-F38020?style=flat-square&labelColor=0e1419)](./docs/CLOUDFLARE_INTEGRATION.md)
```

Parity / status (static, honest):

```markdown
[![Parity](https://img.shields.io/badge/parity-evidence%20based-3dbaa8?style=flat-square&labelColor=0e1419)](./docs/EVIDENCE_MODEL.md)
```

## Forbidden

```text
Cloudflare Certified
Official Cloudflare
Cloudflare Approved
Cloudflare Partner (unless true)
fabricated download / star / uptime counts
```

## Local SVG badges (optional offline)

See `docs/assets/badges/` for monochrome SVG badges that do not depend on shields.io.
