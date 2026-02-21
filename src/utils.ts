import { logger } from "./logger.js";

/**
 * Safely parse JSON with error handling
 */
export function safeJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    logger.warn("Failed to parse JSON, using fallback");
    return fallback;
  }
}

/**
 * Format a date as ISO string
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Format a date as Unix timestamp (seconds)
 */
export function formatTimestamp(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert Unix timestamp to Date
 */
export function fromTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Generate a random ID
 */
export function generateId(length: number = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 100, maxDelay = 1000 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn("Attempt {attempt}/{max} failed: {error}", {
        attempt: attempt + 1,
        max: maxAttempts,
        error: lastError.message,
      });

      if (attempt < maxAttempts - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Validate an email address
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix: string = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Deep clone an object using JSON
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}
