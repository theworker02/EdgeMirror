# Vitest and Vite

EdgeMirror zero-config may detect `vitest.config.*` and `@cloudflare/vitest-pool-workers`.

```bash
edgemirror verify --vitest
```

`@edgemirror/vitest` is a **thin reporter** — it does not embed or replace the Cloudflare Vitest pool.

Vite detection is informational for project discovery; there is no separate `@edgemirror/vite` package on the docs baseline.
