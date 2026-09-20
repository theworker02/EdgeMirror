import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Opt-in Cloudflare live suite.
 * Does not run as part of ordinary `npm test`.
 */
export default defineConfig({
  root,
  test: {
    include: ["tests/cloudflare-live/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
