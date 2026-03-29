/**
 * Structured JSON logging utility (RNF-033).
 *
 * Provides structured logging functions that output valid JSON entries.
 * Each log entry contains:
 *   - level: "info" | "warn" | "error"
 *   - module: the originating stage or module name
 *   - message: human-readable description
 *   - additional contextual fields (runId, productId, userId, etc.)
 *
 * No external packages required — uses only built-in JSON.stringify.
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: number;
  [key: string]: unknown;
}

// ============================================================================
// Core log function
// ============================================================================

/**
 * Create a structured log entry and output it to the appropriate console method.
 *
 * @param level - Log severity
 * @param module - Stage or module name (e.g. "pipeline", "products", "duplicates")
 * @param message - Human-readable message
 * @param context - Additional structured fields (runId, productId, userId, etc.)
 * @returns The structured log entry object
 */
export function createLogEntry(
  level: LogLevel,
  module: string,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  const entry: LogEntry = {
    level,
    module,
    message,
    timestamp: Date.now(),
    ...context,
  };
  return entry;
}

/**
 * Output a structured log entry as JSON to the appropriate console method.
 */
export function outputLog(entry: LogEntry): void {
  const json = JSON.stringify(entry);

  switch (entry.level) {
    case "error":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    case "info":
    default:
      console.log(json);
      break;
  }
}

// ============================================================================
// Logger interface
// ============================================================================

export interface Logger {
  /** Log an informational message */
  info(message: string, context?: Record<string, unknown>): LogEntry;
  /** Log a warning message */
  warn(message: string, context?: Record<string, unknown>): LogEntry;
  /** Log an error message */
  error(message: string, context?: Record<string, unknown>): LogEntry;
  /** Create a child logger with pre-set context fields */
  withContext(context: Record<string, unknown>): Logger;
}

// ============================================================================
// Logger implementation
// ============================================================================

/**
 * Create a structured logger bound to a specific module.
 *
 * @param module - The module/stage name for all log entries
 * @param baseContext - Optional default context to include in every entry
 * @returns Logger instance with info, warn, error, and withContext methods
 *
 * @example
 * ```ts
 * const logger = createLogger("pipeline", { runId: "abc123" });
 * logger.info("Stage 1 complete", { pages: 5 });
 * // Outputs: {"level":"info","module":"pipeline","message":"Stage 1 complete","timestamp":1234567890,"runId":"abc123","pages":5}
 * ```
 */
export function createLogger(
  module: string,
  baseContext?: Record<string, unknown>
): Logger {
  function log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    const entry = createLogEntry(
      level,
      module,
      message,
      { ...baseContext, ...context }
    );
    outputLog(entry);
    return entry;
  }

  return {
    info(message: string, context?: Record<string, unknown>): LogEntry {
      return log("info", message, context);
    },
    warn(message: string, context?: Record<string, unknown>): LogEntry {
      return log("warn", message, context);
    },
    error(message: string, context?: Record<string, unknown>): LogEntry {
      return log("error", message, context);
    },
    withContext(context: Record<string, unknown>): Logger {
      return createLogger(module, { ...baseContext, ...context });
    },
  };
}
