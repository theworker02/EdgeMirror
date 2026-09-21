# @edgemirror/vitest

Thin Vitest **reporter/adapter** for EdgeMirror — so Cloudflare-ecosystem tests naturally surface beside parity evidence.

- Does **not** replace Vitest
- Does **not** replace `@cloudflare/vitest-pool-workers`
- Writes a small summary under `.edgemirror/vitest/` so `edgemirror verify --vitest` can correlate runs

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { EdgeMirrorVitestReporter } from "@edgemirror/vitest";

export default defineConfig({
  test: {
    // Keep the Cloudflare workers pool; add EdgeMirror as an extra reporter.
    reporters: ["default", new EdgeMirrorVitestReporter()],
  },
});
```

Pair with the deploy gate:

```bash
npx edgemirror init --cloudflare-gate
npx edgemirror verify --vitest --ci
npx edgemirror deploy
```
