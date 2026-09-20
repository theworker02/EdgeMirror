# EdgeMirror status language

Canonical product statuses for CLI, dashboard, and design system.  
Technical parity classifications remain visible alongside these labels.

## Vocabulary

| Status | Meaning | When to use |
|--------|---------|-------------|
| `VERIFIED` | Local and platform observations agree within rules | Parity `MATCH` / intentional expected agreement |
| `DIVERGENT` | Confirmed unexpected difference | Unexpected body/status/header/binding drift |
| `RUNNING` | Execution in progress | Live runs, Supercharger jobs (when present) |
| `UNKNOWN` | Not enough signal to classify | Missing observations, incomplete traces |
| `STALE` | Result older than refresh policy | Cached dashboard rows past TTL |
| `BLOCKED` | Cannot proceed — config or credentials | `REMOTE_NOT_CONFIGURED`, missing Wrangler, etc. |
| `FAILED` | Execution or tooling failure | Crashes, non-zero runner errors, bad config |

## Mapping from parity classifications

| Classification | Product status | Notes |
|----------------|----------------|-------|
| `MATCH` | `VERIFIED` | Keep classification in evidence |
| `EXPECTED_DIFFERENCE` | `VERIFIED` | Annotate as expected |
| `POSSIBLE_RUNTIME_DIVERGENCE` | `DIVERGENT` | Primary finding state |
| `RUNTIME_DIVERGENCE` | `DIVERGENT` | Confirmed divergence |
| `REMOTE_NOT_CONFIGURED` | `BLOCKED` | Never fabricate remote |
| `INSUFFICIENT_EVIDENCE` | `UNKNOWN` | Exit code 3 territory |
| `CONFIGURATION_DIFFERENCE` | `DIVERGENT` | Or `BLOCKED` if unrunnable |
| `APPLICATION_NONDETERMINISM` | `UNKNOWN` | Inspect normalizer notes |
| (runner error) | `FAILED` | Show stderr / hints |

## Visual tokens

| Status | Color token | CLI badge |
|--------|-------------|-----------|
| `VERIFIED` | `--em-status-verified` (`#1a7a6d` / `#3dbaa8`) | green |
| `DIVERGENT` | `--em-status-divergent` (`#a33b2b` / `#e07a6a`) | red |
| `RUNNING` | `--em-status-running` (`#2b5a8a` / `#6aa3d8`) | cyan |
| `UNKNOWN` | `--em-status-unknown` (`#5a6a75` / `#8a9aa6`) | dim |
| `STALE` | `--em-status-stale` (`#8a7040` / `#c4a56a`) | yellow |
| `BLOCKED` | `--em-status-blocked` (`#8a7040` / `#c4a56a`) | yellow |
| `FAILED` | `--em-status-failed` (`#a33b2b` / `#e07a6a`) | red |

## DEMO overlay

Any fixture or synthetic run for screenshots must show:

```text
DEMO
```

as an explicit badge and in finding IDs (`EM-DEMO-*`). Never present DEMO data as production metrics.
