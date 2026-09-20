# Preview and deploy

## Preview differential

```bash
edgemirror preview
edgemirror preview --url https://example.workers.dev
edgemirror verify --preview
edgemirror verify --preview-url https://example.workers.dev
```

## Deploy orchestration

```bash
edgemirror deploy
edgemirror deploy --local-verify
edgemirror deploy --skip-verify
```

`edgemirror deploy` runs verify then `wrangler deploy`. It never replaces Wrangler as the deployment tool of record.
