import Fastify, { type FastifyInstance } from "fastify";
import { logger, setLogLevel, getLogLevel, withLogTag } from "./logger.js";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "3000", 10);

let server: FastifyInstance | null = null;

/**
 * Create and configure the Fastify server
 */
export function createServer(): FastifyInstance {
  const app = Fastify({
    logger: false, // We use our own logger
  });

  // Helper functions that use the default logger - no logger parameter needed!
  function checkDatabase(): boolean {
    logger.info("Checking database connection...");
    // Simulate database check
    return true;
  }

  function checkCache(): boolean {
    logger.info("Checking cache connection...");
    // Simulate cache check
    return true;
  }

  // Health check endpoint - uses withCategoryPrefix to set category context
  app.get("/health", async () => {
    // All logs here will have category ["app", "health"]
    return withLogTag(["health"], async () => {
      logger.info("Health check started");

      const dbStatus = checkDatabase();  // Uses default logger, but gets the category prefix
      const cacheStatus = checkCache();  // Uses default logger, but gets the category prefix

      logger.info("Health check completed: {db}, {cache}", {
        db: dbStatus ? "ok" : "fail",
        cache: cacheStatus ? "ok" : "fail",
      });

      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        checks: { database: dbStatus, cache: cacheStatus },
      };
    });
  });

  // Get current log level
  app.get("/api/log-level", async () => {
    return { level: getLogLevel() };
  });

  // Set log level
  app.post("/api/log-level", async (request, reply) => {
    return withLogTag(["log"], async () => {
      const body = request.body as { level?: string; category?: string[] };

      if (!body.level) {
        reply.code(400).send({ error: "Missing 'level' field in request body" });
        return;
      }

      const validLevels = ["debug", "info", "warning", "error", "fatal"] as const;
      type LogLevel = (typeof validLevels)[number];

      if (!validLevels.includes(body.level as LogLevel)) {
        reply.code(400).send({
          error: `Invalid log level. Valid values: ${validLevels.join(", ")}`,
        });
        return;
      }

      const oldLevel = getLogLevel();
      const category = body.category && body.category.length > 0 ? body.category : undefined;
      setLogLevel(body.level as LogLevel, category);

      logger.info("Log level changed: {old} -> {new} {category}", {
        old: oldLevel,
        new: body.level,
        category: category ? `(${category.join(",")})` : "(global)",
      });

      return {
        success: true,
        oldLevel,
        newLevel: body.level,
        category: category ?? "global",
      };
    });
  });

  // Example: Hello endpoint
  app.get("/api/hello", async () => {
    return withLogTag(["api"], () => {
      logger.info("Hello endpoint called");
      return { message: "Hello, world!" };
    });
  });

  // Example: Echo endpoint
  app.post("/api/echo", async (request) => {
    return withLogTag(["api"], () => {
      logger.debug("Echo endpoint called with body: {body}", {
        body: request.body,
      });
      return request.body;
    });
  });

  // 404 handler
  app.setNotFoundHandler(async () => {
    return { error: "Not found" };
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    return withLogTag(["server"], () => {
      const err = error as { statusCode?: number; message?: string };
      logger.error("Request error: {error}", { error: err.message ?? String(error) });

      reply.code(err.statusCode ?? 500).send({
        error: err.message ?? "Internal server error",
      });
    });
  });

  return app;
}

/**
 * Start the Fastify server
 */
export async function startServer(): Promise<FastifyInstance> {
  if (server) {
    return server;
  }

  const srv = createServer();

  try {
    await srv.listen({ port: PORT, host: HOST });
    logger.info("Server listening on {host}:{port}", { host: HOST, port: PORT });
    logger.info("Application started successfully");
    server = srv;
    return srv;
  } catch (error) {
    logger.error("Failed to start server: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Stop the Fastify server
 */
export async function stopServer(): Promise<void> {
  if (server) {
    await server.close();
    server = null;
    logger.info("Server stopped");
  }
}

/**
 * Get the server instance
 */
export function getServer(): FastifyInstance | null {
  return server;
}
