import { command, option, run } from "cmd-ts";
import * as fs from "node:fs";

/**
 * Application configuration interface
 */
export interface AppConfig {
  database: {
    url: string;
  };
  server: {
    host: string;
    port: number;
  };
  log: {
    level: string;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AppConfig = {
  database: {
    url: "app.db",
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  log: {
    level: "info",
  },
};

/**
 * Parse TOML config file
 */
function parseTomlFile(filePath: string): Partial<AppConfig> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const toml = require("toml");
    const parsed = toml.parse(content) as Record<string, unknown>;

    const config: Partial<AppConfig> = {};

    if (typeof parsed.database === "object" && parsed.database !== null) {
      const db = parsed.database as Record<string, unknown>;
      if (typeof db.url === "string") {
        config.database = { url: db.url };
      }
    }

    if (typeof parsed.server === "object" && parsed.server !== null) {
      const srv = parsed.server as Record<string, unknown>;
      config.server = {
        host: typeof srv.host === "string" ? srv.host : DEFAULT_CONFIG.server.host,
        port: typeof srv.port === "number" ? srv.port : DEFAULT_CONFIG.server.port,
      };
    }

    if (typeof parsed.log === "object" && parsed.log !== null) {
      const lg = parsed.log as Record<string, unknown>;
      if (typeof lg.level === "string") {
        config.log = { level: lg.level };
      }
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to parse config file ${filePath}: ${error}`);
  }
}

/**
 * Deep merge configuration objects
 */
function deepMerge<T>(defaultConfig: T, userConfig: Partial<T>): T {
  const result = { ...defaultConfig };

  for (const key in userConfig) {
    const value = userConfig[key];
    const defaultValue = (result as Record<string, unknown>)[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        defaultValue as Record<string, unknown>,
        value as Partial<Record<string, unknown>>
      );
    } else if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Load configuration from environment variables
 * Maps DB_PATH, HOST, PORT, LOG_LEVEL to config values
 */
export function loadConfigFromEnv(): Partial<AppConfig> {
  const config: Partial<AppConfig> = {};

  if (process.env.DB_PATH) {
    config.database = { url: process.env.DB_PATH };
  }

  if (process.env.HOST || process.env.PORT) {
    const serverConfig: { host?: string; port?: number } = {};
    if (process.env.HOST) {
      serverConfig.host = process.env.HOST;
    }
    if (process.env.PORT) {
      serverConfig.port = parseInt(process.env.PORT, 10);
    }
    config.server = serverConfig as any;
  }

  if (process.env.LOG_LEVEL) {
    config.log = { level: process.env.LOG_LEVEL };
  }

  return config;
}

/**
 * Load configuration from file and merge with defaults
 */
export function loadConfig(configPath: string): AppConfig {
  const userConfig = parseTomlFile(configPath);
  return deepMerge(DEFAULT_CONFIG, userConfig);
}

/**
 * CLI options interface
 */
export interface CliOptions {
  configFile: string;
  database: string;
}

/**
 * Define CLI options using cmd-ts
 */
const configFileOption = option({
  type: {
    async from(str: string) {
      return str;
    },
    displayName: "string",
  },
  long: "config",
  short: "c",
  defaultValue: () => "config.toml",
  description: "Path to the configuration file (default: config.toml)",
});

const databaseOption = option({
  type: {
    async from(str: string) {
      return str;
    },
    displayName: "string",
  },
  long: "database",
  short: "d",
  defaultValue: () => "app.db",
  description: "Database file path (default: app.db)",
});

/**
 * Parse command line arguments
 */
export async function parseCliArgs(args: string[] = process.argv.slice(2)): Promise<CliOptions> {
  const appCommand = command({
    name: "bun-fastify-template",
    description: "A Bun + Fastify web service template",
    version: "1.0.0",
    args: {
      configFile: configFileOption,
      database: databaseOption,
    },
    handler: (opts) => opts,
  });

  const result = await run(appCommand, args);
  return result as unknown as CliOptions;
}

/**
 * Load full configuration
 * Priority order: default value -> env var -> CLI args -> config file
 * @param envConfig - Config loaded from environment variables
 * @param cliOptions - Parsed CLI arguments (from parseCliArgs)
 */
export async function loadFullConfig(
  envConfig: Partial<AppConfig>,
  cliOptions: CliOptions
): Promise<AppConfig & { cli: CliOptions }> {
  // Step 1: Start with default values
  let config = { ...DEFAULT_CONFIG };

  // Step 2: Apply environment variables
  config = deepMerge(config, envConfig);

  // Step 3: Apply CLI arguments (override env vars)
  const cliConfig: Partial<AppConfig> = {
    database: {
      url: cliOptions.database,
    },
  };
  config = deepMerge(config, cliConfig);

  // Step 4: Apply config file (highest priority - overrides CLI)
  let fileConfig: Partial<AppConfig>;
  try {
    fileConfig = parseTomlFile(cliOptions.configFile);
  } catch (error) {
    console.warn(`Warning: Failed to load config file: ${error}`);
    fileConfig = {};
  }
  config = deepMerge(config, fileConfig);

  return {
    ...config,
    cli: cliOptions,
  };
}
