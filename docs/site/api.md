# API

**No public hosted HTTP API is shipped** on the docs baseline.

Future Cloud control-plane APIs will be versioned separately. Until then:

- Use the CLI
- Use report formats: `edgemirror verify --format json|agent`
- Use filesystem artifacts under `.edgemirror/`

Do not invent REST endpoints in client integrations.
