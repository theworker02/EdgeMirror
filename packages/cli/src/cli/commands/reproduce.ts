import type { Command } from "commander";
import { resolveProjectRoot } from "../../config/index.js";
import { findReceipt, listFindingIds } from "../../findings/index.js";
import { exportEmfFinding } from "../../emf/index.js";
import { EDGEMIRROR_VERSION } from "../../version.js";

export function registerReproduceCommand(program: Command): void {
  program
    .command("reproduce")
    .description(
      "Print honest reproduce steps for an EM-### finding from local receipts",
    )
    .argument("[findingId]", "Finding id (EM-001). Omit to list known findings.")
    .option("--json", "Print EMF/1 JSON")
    .option("--export", "Write EMF/1 file under .edgemirror/emf/")
    .action(
      (
        findingId: string | undefined,
        opts: { json?: boolean; export?: boolean },
      ) => {
        const root = resolveProjectRoot();
        const known = listFindingIds(root);

        if (!findingId) {
          if (known.length === 0) {
            console.log(
              "No EM-### receipts found. Run `edgemirror verify` or `edgemirror pitch-demo` first.",
            );
            process.exitCode = 1;
            return;
          }
          console.log("Known findings:");
          for (const id of known) console.log(`  ${id}`);
          console.log("");
          console.log(`Usage: edgemirror reproduce ${known[0]}`);
          return;
        }

        const id = findingId.toUpperCase();
        const found = findReceipt(root, id);
        if (!found) {
          console.error(
            `Missing artifact for ${id}. Known: ${known.join(", ") || "(none)"}.`,
          );
          console.error(
            "Honesty: EdgeMirror will not invent reproduce steps without a receipt.",
          );
          process.exitCode = 1;
          return;
        }

        if (opts.export || opts.json) {
          const out = exportEmfFinding(root, id);
          if ("error" in out) {
            console.error(out.error);
            process.exitCode = 1;
            return;
          }
          if (opts.json) {
            console.log(JSON.stringify(out.emf, null, 2));
          } else {
            console.log(`EMF/1 written: ${out.outPath}`);
          }
          if (opts.export && opts.json) {
            console.error(`Also wrote ${out.outPath}`);
          }
          return;
        }

        const r = found.receipt;
        console.log(`EdgeMirror reproduce — ${r.findingId}`);
        console.log(`Version: ${EDGEMIRROR_VERSION}`);
        console.log(`Receipt: ${found.path}`);
        console.log(`Test:    ${r.testId}`);
        console.log(`Class:   ${r.classification}`);
        console.log(`Created: ${r.createdAt}`);
        console.log("");
        console.log("Steps (honest):");
        console.log("  1. Ensure the same Worker project + compatibility date.");
        console.log("  2. edgemirror doctor");
        console.log("  3. edgemirror verify --local");
        console.log(
          "  4. edgemirror verify   # remote half needs Cloudflare credentials",
        );
        console.log(`  5. edgemirror bundle ${r.findingId}`);
        console.log(`  6. edgemirror reproduce ${r.findingId} --export`);
        console.log("");
        if (r.notes?.length) {
          console.log("Receipt notes:");
          for (const n of r.notes) console.log(`  - ${n}`);
          console.log("");
        }
        console.log("Hashes:");
        console.log(`  local:  ${r.localTraceHash.slice(0, 16)}…`);
        console.log(`  remote: ${r.remoteTraceHash.slice(0, 16)}…`);
        console.log(`  result: ${r.resultHash.slice(0, 16)}…`);
        console.log("");
        console.log(
          "DEMO / pitch-demo findings are labeled — do not cite as production bugs.",
        );
      },
    );
}

export function registerEmfCommand(program: Command): void {
  program
    .command("emf")
    .description("Export EM-### receipt as EMF/1 public finding JSON")
    .argument("<findingId>", "Finding id (EM-001)")
    .option("--stdout", "Print JSON to stdout instead of writing a file")
    .action((findingId: string, opts: { stdout?: boolean }) => {
      const root = resolveProjectRoot();
      const out = exportEmfFinding(root, findingId);
      if ("error" in out) {
        console.error(out.error);
        process.exitCode = 1;
        return;
      }
      if (opts.stdout) {
        console.log(JSON.stringify(out.emf, null, 2));
      } else {
        console.log(`EMF/1: ${out.outPath}`);
        console.log(
          `Finding ${out.emf.findingId} · ${out.emf.classification} · test ${out.emf.testId}`,
        );
      }
    });
}
