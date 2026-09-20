# @edgemirror/vitest

Thin Vitest **reporter/adapter** for EdgeMirror.

- Does **not** replace Vitest
- Does **not** replace `@cloudflare/vitest-pool-workers`
- Writes a small summary under `.edgemirror/vitest/` so `edgemirror verify --vitest` can correlate runs

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { EdgeMirrorVitestReporter } from "@edgemirror/vitest";

export default defineConfig({
  test: {
    reporters: ["default", new EdgeMirrorVitestReporter()],
  },
});
```
