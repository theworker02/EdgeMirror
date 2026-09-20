# Runner Protocol

Status of execution “runners” in EdgeMirror.

## Today (SHIPPED): in-process execution targets

The OSS CLI does **not** speak a networked runner protocol. Execution is local to the CLI process via `ExecutionTarget` implementations:

| Target | Module | Mechanism |
|--------|--------|-----------|
| Local | `execution/local.ts` | Spawns `wrangler dev --local`, HTTP corpus |
| Remote | `execution/remote.ts` | Deploys temporary Worker when credentials exist |
| Preview | `execution/preview.ts` | Preview URL or `wrangler versions upload` when available |

Shared interface (`packages/cli/src/execution` / adapters):

```text
prepare() → execute(ParityTest) → cleanup()
```

Traces are written by the CLI; there is no separate authenticated runner agent.

## Planned (NOT SHIPPED): remote Supercharger / Cloud runners

Future managed or self-hosted runners would need:

| Concern | Requirement |
|---------|-------------|
| Authentication | Short-lived credentials; runners cannot request arbitrary org jobs |
| Job vouchers | Unforgeable entitlement / CU budget proof |
| Sandbox | Customer code outside control plane |
| Artifact trust | Treat runner output as untrusted until verified |
| Protocol versioning | Explicit schema version on job + result envelopes |

Until Agent 5 / Cloud land a concrete protocol, **no wire format is normative**. Do not invent endpoints or message types in integrations.

## Related security expectations

See [THREAT_MODEL.md](./THREAT_MODEL.md) and [SECURITY.md](./SECURITY.md). Agent 3 owns adversarial coverage for future runner auth.
