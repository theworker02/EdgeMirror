/**
 * Copy design-system CSS + brand icon into the static dashboard shell.
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..", "..");
const pub = join(root, "public");
const cssDir = join(pub, "css");
const imgDir = join(pub, "img");

mkdirSync(cssDir, { recursive: true });
mkdirSync(imgDir, { recursive: true });

const tokens = readFileSync(
  join(repo, "packages/ui/src/tokens.css"),
  "utf8",
);
const components = readFileSync(
  join(repo, "packages/ui/src/components.css"),
  "utf8",
);
const shell = readFileSync(join(repo, "packages/ui/src/index.css"), "utf8")
  .replace('@import "./tokens.css";', "")
  .replace('@import "./components.css";', "");

writeFileSync(
  join(cssDir, "edgemirror.css"),
  `${tokens}\n${components}\n${shell}\n`,
  "utf8",
);

cpSync(
  join(repo, "branding/assets/icon.svg"),
  join(imgDir, "icon.svg"),
);
cpSync(
  join(repo, "branding/assets/favicon.svg"),
  join(imgDir, "favicon.svg"),
);

console.log("dashboard assets synced");
