#!/usr/bin/env node
/**
 * Generate a lightweight SBOM (CycloneDX-ish JSON) from package-lock / workspace packages.
 * Does not claim certification — inventory only for Agent 6 / supply-chain review.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectWorkspacePackages() {
  const packagesDir = join(root, "packages");
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(packagesDir, d.name, "package.json"))
    .filter((p) => existsSync(p))
    .map((p) => readJson(p));
}

function componentsFromDeps(deps = {}, type = "library") {
  return Object.entries(deps).map(([name, version]) => ({
    type,
    name,
    version: String(version).replace(/^[^0-9A-Za-z]*/, ""),
    purl: `pkg:npm/${name}@${String(version).replace(/^[^0-9A-Za-z]*/, "")}`,
  }));
}

const workspaces = collectWorkspacePackages();
const rootPkg = readJson(join(root, "package.json"));
const lockPath = join(root, "package-lock.json");
const lock = existsSync(lockPath) ? readJson(lockPath) : null;

const components = [];
const seen = new Set();

function add(comp) {
  const key = `${comp.name}@${comp.version}`;
  if (seen.has(key)) return;
  seen.add(key);
  components.push(comp);
}

for (const pkg of [rootPkg, ...workspaces]) {
  add({
    type: "application",
    name: pkg.name,
    version: pkg.version ?? "0.0.0",
    purl: `pkg:npm/${pkg.name}@${pkg.version ?? "0.0.0"}`,
  });
  for (const c of componentsFromDeps(pkg.dependencies)) add(c);
  for (const c of componentsFromDeps(pkg.devDependencies, "library")) add(c);
}

if (lock?.packages) {
  for (const [path, meta] of Object.entries(lock.packages)) {
    if (!path || path === "") continue;
    const name = meta.name ?? path.replace(/^node_modules\//, "");
    if (!meta.version) continue;
    add({
      type: "library",
      name,
      version: meta.version,
      purl: `pkg:npm/${name}@${meta.version}`,
    });
  }
}

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${createHash("sha256").update(JSON.stringify(components)).digest("hex").slice(0, 32)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: "EdgeMirror", name: "sbom-generate", version: "0.1.0" }],
    component: {
      type: "application",
      name: rootPkg.name,
      version: rootPkg.version,
    },
    properties: [
      {
        name: "edgemirror:note",
        value:
          "Informational SBOM only. Not a SOC 2 / certification artifact.",
      },
    ],
  },
  components,
};

const outDir = join(root, "docs", "security");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "sbom.json");
writeFileSync(outFile, JSON.stringify(bom, null, 2), "utf8");
console.log(`Wrote ${outFile} (${components.length} components)`);
