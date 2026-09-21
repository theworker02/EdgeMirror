# Vitest and Vite

EdgeMirror zero-config detects `vitest.config.*` and `@cloudflare/vitest-pool-workers` via `edgemirror doctor`. Correlate Vitest runs with EdgeMirror evidence without replacing Cloudflare’s pool.

## Recommended Cloudflare-ecosystem setup

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { EdgeMirrorVitestReporter } from "@edgemirror/vitest";

export default defineConfig({
  test: {
    // Keep @cloudflare/vitest-pool-workers as your pool — EdgeMirror does not replace it.
    reporters: ["default", new EdgeMirrorVitestReporter()],
  },
});
```

Then:

```bash
npx vitest run
npx edgemirror verify --vitest   # correlates .edgemirror/vitest/ summaries
npx edgemirror init --cloudflare-gate
```

`@edgemirror/vitest` is a **thin reporter** — it writes under `.edgemirror/vitest/` so CI/verify can surface CF-ecosystem test context. It does **not** embed or replace `@cloudflare/vitest-pool-workers`.

Vite detection is informational for project discovery; there is no separate `@edgemirror/vite` package.
