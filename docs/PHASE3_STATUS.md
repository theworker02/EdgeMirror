# Phase 3 Status

Date: 2026-09-19  
Baseline commit before Phase 3: `043de9f`

## Landed in this checkpoint

| Item | Status | Notes |
|------|--------|-------|
| Bare `edgemirror` onboarding | **Shipped** | TTY menu; non-interactive + Worker → `verify --local`; `--auto-verify` / `EDGEMIRROR_AUTO_VERIFY` |
| Menu → scriptable commands | **Shipped** | Every menu row maps to a real CLI invocation |
| `edgemirror demo` | **Shipped** | Isolated temp Worker; DEMO-labeled finding; never writes to caller corpus |
| create-cloudflare / C3 autodetection | **Shipped** | Signals on `discoverZeroConfig().createCloudflare` |
| `edgemirror init --ci` | **Shipped** | Detects GitHub / GitLab / Workers Builds; scaffolds honestly |
| Zero-install (`npx`) | **Unchanged** | `@edgemirror/cli` bin remains `edgemirror` |
| `docs/PHASE3_GAP_ANALYSIS.md` | **Partial** | See gap analysis; Phase 4 supersedes remaining distribution work |

## Deferred (moved to Phase 4 or later)

| Item | Why deferred |
|------|----------------|
| `edgemirror badge` | Prefer shipping with dashboard/status surface |
| README hero rebuild | Phase 4 M1 |
| EMF/1 public format + `reproduce` | Phase 4 explorer + evidence |
| Supercharger Sprint A (DAG/scheduler/CU) | Partial → Phase 4 M4 interfaces |
| 100-project challenge | Metadata only if/when time; no fake runs |
| Live remote preview with CF credentials | Still needs `CLOUDFLARE_API_TOKEN` |

## Honesty invariants preserved

- `REMOTE_NOT_CONFIGURED` when credentials absent
- DEMO findings never mixed with real corpus
- No fabricated parity %, speedups, or adoption metrics
- OSS `edgemirror verify` works without Cloud / Supercharger
