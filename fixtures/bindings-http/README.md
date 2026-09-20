# Bindings HTTP fixture

Local-first Worker that exposes **HTTP-observable** effects of:

- plaintext `vars`
- KV (`KV`)
- D1 (`DB`)
- R2 (`BUCKET`)

```bash
# from repo root
npm run build -w edgemirror
cd fixtures/bindings-http
node ../../packages/cli/dist/cli/bin.js verify --local --filter bindings
```

Parity compares response bodies — not raw binding dumps. Queues / AI / Workflows remain out of scope here.
