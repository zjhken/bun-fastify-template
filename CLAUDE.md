# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun install` - Install dependencies
- `bun run index.ts` - Run the application
- `bun test` - Run all tests
- `bun --hot ./index.ts` - Run with hot reload for development

## Project Setup

This is a Bun + TypeScript web service template using Fastify, SQLite, and Logtape.

### Architecture

The application is structured as follows:

- **index.ts** - Main entry point, initializes all components and handles graceful shutdown
- **src/logger.ts** - Logtape logger with custom format: `timestamp|log_level|tag_seperated_with_comma|message`
- **src/server.ts** - Fastify web server with REST API endpoints
- **src/db.ts** - SQLite database setup with connection pooling and transactions
- **src/utils.ts** - Common utility functions

### Logger

Uses `@logtape/logtape` with a custom format. Import the logger from `src/logger.ts`:

```ts
import { logger } from "./src/logger.js";

logger.info("User logged in: {userId}", { userId: 123 });
logger.error("Database error: {error}", { error: err.message });
```

The log format is: `timestamp|log_level|tag_seperated_with_comma|message`

Example: `2025-02-18T12:34:56.789Z|INFO|app,server|Server listening on 0.0.0.0:3000`

### Log Level Endpoint

The server has an endpoint to dynamically change the log level:

```bash
# Get current log level
curl http://localhost:3000/api/log-level

# Set log level
curl -X POST http://localhost:3000/api/log-level -H "Content-Type: application/json" -d '{"level":"debug"}'
```

Valid levels: `debug`, `info`, `warning`, `error`, `fatal`

### Server

Uses Fastify for the web server. Add new routes to `src/server.ts`:

```ts
app.get("/api/users", async () => {
  return { users: [] };
});
```

### Database

Uses `bun:sqlite` for SQLite. The database is initialized in `src/db.ts`:

```ts
import { getDb } from "./src/db.js";

const db = getDb();
const result = db.query("SELECT * FROM users").all();
```

Available functions:
- `getDb()` - Get the database instance
- `transaction(fn)` - Execute a function in a transaction
- `closeDb()` - Close the database connection

### Environment Variables

- `HOST` - Server host (default: `0.0.0.0`)
- `PORT` - Server port (default: `3000`)
- `DB_PATH` - SQLite database file path (default: `./data/app.db`)

## Bun vs Node.js

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Bun automatically loads .env files - don't use dotenv

## Database & APIs

- SQLite: `bun:sqlite` (not better-sqlite3)
- File I/O: `Bun.file()` (not node:fs)
- Shell: `Bun.$`command`` (not execa)
