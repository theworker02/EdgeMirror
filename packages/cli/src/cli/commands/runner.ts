import type { Command } from "commander";
import { startRunner, type GovernorMode } from "../../supercharger/index.js";

export function registerRunnerCommand(program: Command): void {
  const cmd = program
    .command("runner")
    .description("Authenticated EdgeMirror runner pool controls");

  cmd
    .command("start")
    .description(
      "Start a hardened local runner (requires EDGEMIRROR_RUNNER_TOKEN ≥16 chars)",
    )
    .option("--host <host>", "Bind host (default 127.0.0.1)", "127.0.0.1")
    .option("--port <port>", "Bind port (0 = ephemeral)", "0")
    .option("--token <token>", "Runner token (else EDGEMIRROR_RUNNER_TOKEN)")
    .option("--mode <mode>", "ECO|BALANCED|FAST|MAX", "BALANCED")
    .option("--max-concurrency <n>", "Concurrency ceiling")
    .action(
      async (opts: {
        host?: string;
        port?: string;
        token?: string;
        mode?: string;
        maxConcurrency?: string;
      }) => {
        const handle = await startRunner({
          host: opts.host,
          port: Number(opts.port ?? 0),
          token: opts.token,
          mode: (opts.mode ?? "BALANCED").toUpperCase() as GovernorMode,
          maxConcurrency: opts.maxConcurrency
            ? Number(opts.maxConcurrency)
            : undefined,
        });
        console.log(`EdgeMirror runner listening on ${handle.url}`);
        console.log("Auth: Authorization: Bearer <token>");
        console.log("Health: GET /health");
        console.log("Jobs:   POST /v1/jobs (envelope accept only)");
        console.log("Ctrl+C to stop.");

        const stop = async () => {
          await handle.close();
          process.exit(0);
        };
        process.on("SIGINT", () => void stop());
        process.on("SIGTERM", () => void stop());

        // Keep process alive
        await new Promise(() => {
          /* hang until signal */
        });
      },
    );
}
