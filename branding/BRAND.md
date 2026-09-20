# EdgeMirror brand system

Independent developer infrastructure for **production parity testing**.  
Not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.

## Intent

EdgeMirror should feel like:

| Signal | Meaning |
|--------|---------|
| Runtime infrastructure | Tooling you trust next to Wrangler |
| Verification | Evidence over claims |
| Mirroring | Local ↔ platform reflection |
| Comparison | Side-by-side differential |
| Precision | Quiet confidence, not hype |

## Avoid

- Neon gradients, sparkles, robot/brain motifs, generic shields
- Cloudflare logo derivatives or orange-cloud pastiche
- Fabricated metrics, certifications, or “official” language

## Logo

**Concept:** two execution panes across a vertical mirror axis — local on the left, remote on the right — meeting at a thin comparison edge.

Assets (see `assets/`):

| File | Use |
|------|-----|
| `icon.svg` | App icon / mark (16–64px) |
| `logo.svg` | Mark + wordmark, dark-friendly |
| `logo-light.svg` | Mark + wordmark on light surfaces |
| `logo-mono.svg` | Single-ink / print |
| `wordmark.svg` | Wordmark only |
| `favicon.svg` | Browser favicon |

## Color

CSS variables live in `@edgemirror/ui` (`tokens.css`). Summary:

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--em-ink` | `#0e1419` | `#e8eef2` | Primary text |
| `--em-muted` | `#5a6a75` | `#8a9aa6` | Secondary text |
| `--em-surface` | `#f4f6f8` | `#0c1116` | Page background |
| `--em-panel` | `#ffffff` | `#141b22` | Panels |
| `--em-line` | `#d0d8de` | `#243040` | Rules / borders |
| `--em-mirror` | `#1a7a6d` | `#3dbaa8` | Accent (mirror edge) |
| `--em-local` | `#2b5a8a` | `#6aa3d8` | Local target |
| `--em-remote` | `#6b4a1f` | `#d4a574` | Remote / platform target |

Accent is a restrained teal — precision, not neon.

## Typography

| Role | Stack |
|------|-------|
| UI / docs | `"IBM Plex Sans", "Source Sans 3", "Segoe UI", sans-serif` |
| Code / evidence | `"IBM Plex Mono", "ui-monospace", "Cascadia Code", monospace` |
| Display (rare) | Same as UI — avoid decorative display faces |

Prefer tabular figures in metrics and diffs.

## Spacing

Base unit **4px**. Common steps: 4 / 8 / 12 / 16 / 24 / 32 / 48.

CLI: blank line between sections; two spaces for nested evidence; never collapse finding details into icons alone.

## Hierarchy

1. Product name / run id  
2. Status (from status vocabulary)  
3. Score / summary counts  
4. Findings with classification + confidence  
5. Diff paths and provenance notes  

Decorative chrome never replaces evidence.

## Dark / light

- Default product surfaces: dark (CLI terminals, HTML reports, dashboard).
- Marketing / README SVGs: provide both; prefer light paper with ink for print-friendly README embeds.
- Logos ship light, dark, and mono variants.

## Icon treatment

Stroke-based, 1.5px at 24px viewBox, square caps, no filled “blob” mascots. Status icons use the status color tokens only.
