import { initLogger, logger, withCategoryPrefix } from "./logger.js";
import { initDb, closeDb } from "./db.js";
import { startServer, stopServer } from "./server.js";
import { loadFullConfig, loadConfigFromEnv, parseCliArgs } from "./config.js";

/**
 * Main entry point for the application
 */
async function main(): Promise<void> {
  // Step 1: Load config from environment variables
  const envConfig = loadConfigFromEnv();

  // Step 2: Parse CLI arguments (override env vars)
  const cliOptions = await parseCliArgs();

  // Step 3: Load full configuration (env -> cli -> config file)
  const config = await loadFullConfig(envConfig, cliOptions);

  // Initialize logger first with log level from config
  await initLogger(config.log.level as any);

  logger.info("Application starting...");
  logger.info("Config loaded: {config}", { config });

  // Initialize database
  initDb();

  // Start the server
  await startServer();

  // Handle shutdown signals
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Start the application
main().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  return withCategoryPrefix(["app"], async () => {
    logger.info("Received {signal}, shutting down...", { signal });
    try {
      await stopServer();
      closeDb();
      logger.info("Application shut down gracefully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  });
}
