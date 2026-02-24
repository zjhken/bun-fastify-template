import Database from "bun:sqlite";
import { logger, withLogTag } from "./logger.js";

// Get database path from environment or use default
function getDbPath(): string {
  return process.env.DB_PATH || "./data/app.db";
}

// Singleton database instance
let db: Database | null = null;

/**
 * Initialize the SQLite database
 */
export function initDb(): Database {
  return withLogTag(["db"], () => {
    if (db) {
      return db;
    }

    const dbPath = getDbPath();

    // Ensure the directory exists
    const dbDir = dbPath.substring(0, dbPath.lastIndexOf("/"));
    if (dbDir && dbDir !== ".") {
      Bun.$`mkdir -p ${dbDir}`.catch((err) => {
        logger.error("Failed to create database directory: {err}", { err });
      });
    }

    // Create database connection
    db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.exec("PRAGMA journal_mode = WAL;");

    // Create tables if they don't exist
    createTables();

    logger.info("Database initialized: {path}", { path: dbPath });

    return db;
  });
}

/**
 * Create database tables
 */
function createTables(): void {
  if (!db) return;

  // Example: users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  logger.debug("Database tables created/verified");
}

/**
 * Get the database instance
 * @throws Error if database is not initialized
 */
export function getDb(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  withLogTag(["db"], () => {
    if (db) {
      db.close();
      db = null;
      logger.info("Database connection closed");
    }
  });
}

/**
 * Execute a transaction
 */
export async function transaction<T>(fn: (db: Database) => T): Promise<T> {
  const database = getDb();
  database.exec("BEGIN;");
  try {
    const result = fn(database);
    database.exec("COMMIT;");
    return result;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
