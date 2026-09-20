# `@edgemirror/ui`

Design system for EdgeMirror product surfaces (dashboard, HTML reports, docs embeds).

## Tokens

```ts
import "@edgemirror/ui/tokens.css";
import "@edgemirror/ui/components.css";
// or
import "@edgemirror/ui/index.css";
```

See `branding/BRAND.md` and `branding/STATUS.md`.

## Components

| Builder | CSS class |
|---------|-----------|
| `renderStatusBadge` | `.em-status` |
| `renderFindingCard` | `.em-finding` |
| `renderRunTimeline` | `.em-timeline` |
| `renderMetric` | `.em-metric` |
| `renderCompatibilityCell` | `.em-compat` |
| `renderEvidencePanel` | `.em-evidence` |
| `renderTraceDiff` | `.em-diff` |
| `renderCodeBlock` | `.em-code` |
| `renderCommand` | `.em-command` |
| `renderSuperchargerGauge` | `.em-gauge` (visual stub) |
| `renderDemoBanner` | `.em-banner-demo` |

## Status language

```ts
import { statusFromClassification, STATUS_LABEL } from "@edgemirror/ui";
```

Maps engine classifications → `VERIFIED | DIVERGENT | RUNNING | UNKNOWN | STALE | BLOCKED | FAILED | DEMO`.

## Theme

Set `data-theme="dark"` (default) or `data-theme="light"` on `<html>`.
