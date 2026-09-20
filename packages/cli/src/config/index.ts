import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";

const RemoteBudgetSchema = z.object({
  maxRuns: z.number().int().positive().default(200),
  maxDurationMinutes: z.number().positive().default(15),
  cleanup: z.boolean().default(true),
});

const RedactionSchema = z.object({
  enabled: z.boolean().default(true),
  patterns: z.array(z.string()).default([]),
});

export const EdgeMirrorConfigSchema = z.object({
  project: z
    .object({
      name: z.string().optional(),
      wranglerConfig: z.string().optional(),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? {})
    .default({}),
  remote: RemoteBudgetSchema.default({}),
  redaction: RedactionSchema.default({}),
  corpus: z
    .object({
      includeBuiltin: z.boolean().default(true),
      paths: z.array(z.string()).default([]),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? { includeBuiltin: true, paths: [] })
    .default({}),
  reporters: z
    .object({
      formats: z.array(z.enum(["terminal", "json", "html"])).default(["terminal"]),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? { formats: ["terminal" as const] })
    .default({}),
});

export type EdgeMirrorConfig = z.infer<typeof EdgeMirrorConfigSchema>;

export const DEFAULT_CONFIG: EdgeMirrorConfig = EdgeMirrorConfigSchema.parse({});

export function configPath(projectRoot: string): string {
  return join(projectRoot, "edgemirror.yaml");
}

export function artifactsDir(projectRoot: string): string {
  return join(projectRoot, ".edgemirror");
}

export function loadConfig(projectRoot: string): EdgeMirrorConfig {
  const path = configPath(projectRoot);
  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }
  const raw = yaml.load(readFileSync(path, "utf8"));
  // YAML `project:` with only comments becomes null — coerce empties.
  const normalized =
    raw && typeof raw === "object"
      ? Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
            k,
            v === null ? undefined : v,
          ]),
        )
      : {};
  return EdgeMirrorConfigSchema.parse(normalized ?? {});
}

export function writeDefaultConfig(projectRoot: string): string {
  const path = configPath(projectRoot);
  if (existsSync(path)) {
    return path;
  }
  const contents = `# EdgeMirror configuration
# https://github.com/theworker02/EdgeMirror

project:
  # wranglerConfig: wrangler.jsonc

remote:
  maxRuns: 200
  maxDurationMinutes: 15
  cleanup: true

redaction:
  enabled: true
  patterns: []

corpus:
  includeBuiltin: true
  paths: []

reporters:
  formats:
    - terminal
`;
  writeFileSync(path, contents, "utf8");
  return path;
}

export function ensureArtifactsDir(projectRoot: string): string {
  const dir = artifactsDir(projectRoot);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "traces"), { recursive: true });
  mkdirSync(join(dir, "reports"), { recursive: true });
  mkdirSync(join(dir, "receipts"), { recursive: true });
  mkdirSync(join(dir, "repros"), { recursive: true });
  mkdirSync(join(dir, "ownership"), { recursive: true });
  return dir;
}

export function resolveProjectRoot(cwd = process.cwd()): string {
  return resolve(cwd);
}

export function findUp(start: string, names: string[]): string | undefined {
  let dir = resolve(start);
  for (;;) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
