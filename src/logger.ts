import { configure, getLogger, type LogRecord, type LogLevel, type Logger, type ContextLocalStorage, withCategoryPrefix as withCategoryPrefixImpl } from "@logtape/logtape";

// Bun and Node.js have built-in AsyncLocalStorage
import { AsyncLocalStorage } from "node:async_hooks";

// Create async local storage for context propagation
const asyncLocalStorage = new AsyncLocalStorage<Record<string, unknown>>();

// Custom formatter: timestamp|log_level|tag_seperated_with_comma|message
function customFormatter(record: LogRecord): string {
  // Format timestamp as ISO string
  const timestamp = new Date(record.timestamp).toISOString();

  // Log level in uppercase
  const level = record.level.toUpperCase();

  // Join category with comma, use "-" if empty
  const tags = record.category.length > 0 ? record.category.join(",") : "-";

  // Format message - the message array contains interleaved template values
  // For simple strings, just join all parts
  const message = record.message.map(String).join("");

  return `${timestamp}|${level}|${tags}|${message}`;
}

// Store log levels per category (empty array represents global/default)
const categoryLogLevels = new Map<string, LogLevel>();
let currentLogLevel: LogLevel = "info";

/**
 * Initialize the logger with custom formatting
 * @param level - The log level to use (default: "info")
 */
export async function initLogger(level: LogLevel = "info"): Promise<void> {
  currentLogLevel = level;
  await configure({
    sinks: {
      console: (record) => {
        const formatted = customFormatter(record);
        console.log(formatted);
      },
    },
    // Enable async context propagation
    contextLocalStorage: asyncLocalStorage as unknown as ContextLocalStorage<Record<string, unknown>>,
    loggers: [
      {
        // Use empty category as base - set categories via withCategoryPrefix
        category: [],
        sinks: ["console"],
        lowestLevel: currentLogLevel,
      },
    ],
  });
}

/**
 * Get the main application logger (empty base category)
 * Use withCategoryPrefix to set the actual category for logs
 */
export const logger = getLogger([]);

/**
 * Get a logger with a specific category
 * @param category - The category for the logger (e.g., ["app", "health"])
 */
export function getCategoryLogger(category: string[]): Logger {
  return getLogger(category);
}

/**
 * Convert category array to string key for Map
 */
function categoryToKey(category: string[]): string {
  return category.join(",");
}

/**
 * Set the log level at runtime
 * @param level - The log level to set
 * @param category - Optional category array (e.g., ["app", "health"]). If not provided, sets global log level.
 */
export function setLogLevel(level: LogLevel, category?: string[]): void {
  if (category && category.length > 0) {
    // Set log level for specific category
    const key = categoryToKey(category);
    categoryLogLevels.set(key, level);
  } else {
    // Set global log level
    currentLogLevel = level;
  }

  // Build loggers configuration
  const loggersConfig: Array<{
    category: string[];
    sinks: string[];
    lowestLevel: LogLevel;
  }> = [
    {
      category: [],
      sinks: ["console"],
      lowestLevel: currentLogLevel,
    },
  ];

  // Add category-specific loggers
  for (const [catKey, catLevel] of categoryLogLevels.entries()) {
    const catArray = catKey.split(",").filter((c) => c.length > 0);
    loggersConfig.push({
      category: catArray,
      sinks: ["console"],
      lowestLevel: catLevel,
    });
  }

  // Reconfigure with new log levels
  configure({
    reset: true,
    sinks: {
      console: (record) => {
        const formatted = customFormatter(record);
        console.log(formatted);
      },
    },
    loggers: loggersConfig,
  }).catch((err) => {
    console.error("Failed to reconfigure logger:", err);
  });
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Run a callback with a category prefix that applies to all logs within.
 * This allows setting a category context without passing loggers around.
 *
 * @example
 * ```ts
 * withCategoryPrefix(["app", "health"], () => {
 *   logger.info("This will be logged with category: app,health");
 *   checkDatabase(); // Functions can use the default logger
 * });
 * ```
 */
export const withLogTag = withCategoryPrefixImpl;
