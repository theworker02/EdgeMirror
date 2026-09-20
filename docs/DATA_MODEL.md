# Data Model

Logical entities used by the OSS CLI today. Hosted Cloud schemas are **planned** and not specified as shipped APIs.

## Core entities (CLI / filesystem)

| Entity | Identity | Persistence |
|--------|----------|-------------|
| Project | Filesystem root + Wrangler config | `edgemirror.yaml`, wrangler.* |
| ConfigurationFingerprint | Hash of config + binding summary | Embedded in each `ExecutionTrace` |
| ParityTest | `id` (corpus) | `corpus/**/*.json`, config corpus paths |
| ExecutionTrace | `traceId` | `.edgemirror/**/traces/*.json` |
| ParityResult | per test within a run | Inside reports / hashed into receipts |
| EvidenceReceipt | `findingId` (`EM-###`) | `.edgemirror/**/receipts/*.json` |
| Bundle | `targetId` (finding or run) | `.edgemirror/bundles/<id>.edgemirror/` |
| OwnershipMarker | UUID | `.edgemirror/ownership/*.json` |
| EnvironmentFingerprint | doctor output | stdout / `--json` |

## Binding summary

Discovered (not deeply instrumented by default):

```text
kv, d1, r2, durableObjects, queues, serviceBindings,
workflows, hyperdrive, vectorize, ai, other[]
```

Counts come from Wrangler config parsing. Observation depth for each binding type varies; see Cloudflare docs for support honesty.

## Config (`edgemirror.yaml`)

Validated by Zod (`packages/cli/src/config/index.ts`):

| Section | Fields |
|---------|--------|
| `project` | `name?`, `wranglerConfig?` |
| `remote` | `maxRuns`, `maxDurationMinutes`, `cleanup` |
| `redaction` | `enabled`, `patterns[]` |
| `corpus` | `includeBuiltin`, `paths[]` |
| `reporters` | `formats[]` (`terminal` \| `json` \| `html`) |

## Planned Cloud entities (not shipped)

Documented for diligence only — **no public API guarantee**:

```text
Organization, User, Membership (RBAC)
Project (cloud), Run, Finding, Trace blob refs
Entitlement / Plan / Compute Unit ledger
Runner registration, job vouchers
```

These must not be confused with local `.edgemirror/` artifacts.

## Related

- [EVIDENCE_MODEL.md](./EVIDENCE_MODEL.md)
- [FINDING_FORMAT.md](./FINDING_FORMAT.md)
- [RUNNER_PROTOCOL.md](./RUNNER_PROTOCOL.md)
