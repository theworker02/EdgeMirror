# EdgeMirror dashboard

Static visual shell for product screens. Uses `@edgemirror/ui` tokens and **DEMO** data only.

```bash
node apps/dashboard/scripts/build.mjs
npx --yes serve apps/dashboard/public -p 4173
```

Open `http://localhost:4173` — every page shows a DEMO banner.

Screens: Overview, Projects, Runs, Findings, Compatibility, Supercharger (stub), Corpus, Billing, Settings.
