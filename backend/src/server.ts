import { loadEnv } from "./config/env.js";
import { createLogger } from "./utils/logger.js";
import { createApp } from "./app.js";

/** Process entry point: validate config, start HTTP server, shut down cleanly. */
const env = loadEnv();
const logger = createLogger(env);
const app = createApp({ env, logger });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "FitPal API listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
    process.exit(0);
  });
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  process.exit(1);
});
