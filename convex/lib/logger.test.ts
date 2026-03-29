import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createLogEntry,
  outputLog,
  createLogger,
  type LogEntry,
  type LogLevel,
} from "./logger";

// ============================================================================
// Helpers
// ============================================================================

/** Capture all calls to console.log, console.warn, console.error */
function captureConsole() {
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => logs.push(String(args[0]));
  console.warn = (...args: unknown[]) => warns.push(String(args[0]));
  console.error = (...args: unknown[]) => errors.push(String(args[0]));

  return {
    logs,
    warns,
    errors,
    restore() {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    },
  };
}

/** Parse a JSON string and return the parsed object, or fail the test */
function parseJson(str: string): Record<string, unknown> {
  return JSON.parse(str);
}

// ============================================================================
// createLogEntry tests
// ============================================================================

describe("createLogEntry", () => {
  it("creates a valid log entry with required fields", () => {
    const entry = createLogEntry("info", "pipeline", "Stage 1 started");

    expect(entry.level).toBe("info");
    expect(entry.module).toBe("pipeline");
    expect(entry.message).toBe("Stage 1 started");
    expect(entry.timestamp).toBeTypeOf("number");
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  it("includes context fields when provided", () => {
    const entry = createLogEntry("info", "pipeline", "Stage 1 complete", {
      runId: "run_123",
      pages: 5,
    });

    expect(entry.runId).toBe("run_123");
    expect(entry.pages).toBe(5);
  });

  it("supports all log levels", () => {
    const levels: LogLevel[] = ["info", "warn", "error"];
    for (const level of levels) {
      const entry = createLogEntry(level, "test", `message at ${level}`);
      expect(entry.level).toBe(level);
    }
  });

  it("produces valid JSON when stringified", () => {
    const entry = createLogEntry("info", "pipeline", "Test message", {
      runId: "run_abc",
      stage: 1,
    });
    const json = JSON.stringify(entry);
    const parsed = JSON.parse(json);

    expect(parsed.level).toBe("info");
    expect(parsed.module).toBe("pipeline");
    expect(parsed.message).toBe("Test message");
    expect(parsed.runId).toBe("run_abc");
    expect(parsed.stage).toBe(1);
  });
});

// ============================================================================
// outputLog tests
// ============================================================================

describe("outputLog", () => {
  let capture: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
  });

  it("outputs info level to console.log", () => {
    const entry = createLogEntry("info", "test", "info message");
    outputLog(entry);

    expect(capture.logs.length).toBe(1);
    expect(capture.warns.length).toBe(0);
    expect(capture.errors.length).toBe(0);
  });

  it("outputs warn level to console.warn", () => {
    const entry = createLogEntry("warn", "test", "warn message");
    outputLog(entry);

    expect(capture.logs.length).toBe(0);
    expect(capture.warns.length).toBe(1);
    expect(capture.errors.length).toBe(0);
  });

  it("outputs error level to console.error", () => {
    const entry = createLogEntry("error", "test", "error message");
    outputLog(entry);

    expect(capture.logs.length).toBe(0);
    expect(capture.warns.length).toBe(0);
    expect(capture.errors.length).toBe(1);
  });

  it("outputs valid JSON string", () => {
    const entry = createLogEntry("info", "pipeline", "Test", { runId: "r1" });
    outputLog(entry);

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.level).toBe("info");
    expect(parsed.module).toBe("pipeline");
    expect(parsed.message).toBe("Test");
    expect(parsed.runId).toBe("r1");
  });
});

// ============================================================================
// createLogger tests
// ============================================================================

describe("createLogger", () => {
  let capture: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
  });

  it("creates a logger with info, warn, error, and withContext methods", () => {
    const logger = createLogger("test");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.withContext).toBe("function");
  });

  it("logger.info outputs structured JSON with level=info", () => {
    const logger = createLogger("pipeline");
    logger.info("Stage 1 started");

    expect(capture.logs.length).toBe(1);
    const parsed = parseJson(capture.logs[0]);
    expect(parsed.level).toBe("info");
    expect(parsed.module).toBe("pipeline");
    expect(parsed.message).toBe("Stage 1 started");
    expect(parsed.timestamp).toBeTypeOf("number");
  });

  it("logger.warn outputs structured JSON with level=warn", () => {
    const logger = createLogger("pipeline");
    logger.warn("Low confidence");

    expect(capture.warns.length).toBe(1);
    const parsed = parseJson(capture.warns[0]);
    expect(parsed.level).toBe("warn");
    expect(parsed.module).toBe("pipeline");
    expect(parsed.message).toBe("Low confidence");
  });

  it("logger.error outputs structured JSON with level=error", () => {
    const logger = createLogger("pipeline");
    logger.error("Batch failed");

    expect(capture.errors.length).toBe(1);
    const parsed = parseJson(capture.errors[0]);
    expect(parsed.level).toBe("error");
    expect(parsed.module).toBe("pipeline");
    expect(parsed.message).toBe("Batch failed");
  });

  it("includes base context in every log entry", () => {
    const logger = createLogger("pipeline", { runId: "run_abc" });
    logger.info("Test message");

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.runId).toBe("run_abc");
  });

  it("merges additional context with base context", () => {
    const logger = createLogger("pipeline", { runId: "run_abc" });
    logger.info("Stage complete", { pages: 5 });

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.runId).toBe("run_abc");
    expect(parsed.pages).toBe(5);
    expect(parsed.module).toBe("pipeline");
  });

  it("additional context overrides base context", () => {
    const logger = createLogger("pipeline", { stage: "base" });
    logger.info("Override test", { stage: "override" });

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.stage).toBe("override");
  });

  it("returns the log entry object", () => {
    const logger = createLogger("pipeline");
    const entry = logger.info("Test", { key: "value" });

    expect(entry.level).toBe("info");
    expect(entry.module).toBe("pipeline");
    expect(entry.message).toBe("Test");
    expect(entry.key).toBe("value");
  });
});

// ============================================================================
// withContext tests
// ============================================================================

describe("createLogger withContext", () => {
  let capture: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
  });

  it("creates a child logger with merged context", () => {
    const parent = createLogger("pipeline", { runId: "run_parent" });
    const child = parent.withContext({ batchIndex: 5 });

    child.info("Child message");

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.runId).toBe("run_parent");
    expect(parsed.batchIndex).toBe(5);
    expect(parsed.module).toBe("pipeline");
  });

  it("child logger context merges with parent context", () => {
    const parent = createLogger("pipeline", { runId: "run_1" });
    const child = parent.withContext({ batchIndex: 3 });
    child.info("Batch started", { rows: 10 });

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.runId).toBe("run_1");
    expect(parsed.batchIndex).toBe(3);
    expect(parsed.rows).toBe(10);
  });

  it("child does not mutate parent context", () => {
    const parent = createLogger("pipeline", { runId: "run_1" });
    const child = parent.withContext({ extraField: true });

    // Log from parent
    parent.info("Parent message");
    const parentParsed = parseJson(capture.logs[0]);
    expect(parentParsed.extraField).toBeUndefined();

    // Log from child
    child.info("Child message");
    const childParsed = parseJson(capture.logs[1]);
    expect(childParsed.extraField).toBe(true);
  });
});

// ============================================================================
// Pipeline-specific log structure tests
// ============================================================================

describe("Pipeline log structure (RNF-033)", () => {
  let capture: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
  });

  it("pipeline logs contain required fields: level, stage, message, runId", () => {
    const logger = createLogger("pipeline", { runId: "run_test_123" });
    logger.info("Stage 1 complete", { pages: 5 });

    const parsed = parseJson(capture.logs[0]);

    // Required fields per RNF-033
    expect(parsed.level).toBe("info");
    expect(parsed.module).toBe("pipeline");
    expect(parsed.message).toBe("Stage 1 complete");
    expect(parsed.runId).toBe("run_test_123");
    expect(parsed.timestamp).toBeTypeOf("number");
  });

  it("mutation logs include operation and productId", () => {
    const logger = createLogger("products", {
      userId: "user_provider_1",
      productId: "prod_abc",
    });
    logger.info("Product updated", {
      operation: "updateProduct",
      productId: "prod_abc",
      fields: ["name", "price"],
    });

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.level).toBe("info");
    expect(parsed.module).toBe("products");
    expect(parsed.operation).toBe("updateProduct");
    expect(parsed.productId).toBe("prod_abc");
    expect(parsed.userId).toBe("user_provider_1");
  });

  it("delete mutation logs include operation and productId", () => {
    const logger = createLogger("products", {
      userId: "user_provider_1",
      productId: "prod_xyz",
    });
    logger.info("Product deleted", {
      operation: "remove",
      productId: "prod_xyz",
      productName: "Tomate perita",
    });

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.operation).toBe("remove");
    expect(parsed.productId).toBe("prod_xyz");
    expect(parsed.userId).toBe("user_provider_1");
  });

  it("mergeDuplicates logs include operation, duplicateIds, userId", () => {
    const logger = createLogger("duplicates", { userId: "user_provider_1" });
    logger.info("Duplicates merged", {
      operation: "mergeDuplicates",
      duplicateIds: ["prod_a", "prod_b"],
      survivorId: "prod_a",
      removedId: "prod_b",
    });

    const parsed = parseJson(capture.logs[0]);
    expect(parsed.operation).toBe("mergeDuplicates");
    expect(parsed.duplicateIds).toEqual(["prod_a", "prod_b"]);
    expect(parsed.userId).toBe("user_provider_1");
  });

  it("all log entries are valid JSON (not string interpolation)", () => {
    const logger = createLogger("pipeline", { runId: "run_json_test" });
    logger.info("Test message");
    logger.warn("Warning message", { detail: "something" });
    logger.error("Error message", { code: 500 });

    // Verify all outputs are valid JSON
    for (const output of [...capture.logs, ...capture.warns, ...capture.errors]) {
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed.level).toBeDefined();
      expect(parsed.module).toBeDefined();
      expect(parsed.message).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    }
  });

  it("no raw string interpolation in log output", () => {
    const logger = createLogger("pipeline", { runId: "run_no_interp" });
    logger.info("Stage 1 complete", { pages: 3 });

    const output = capture.logs[0];
    // Should NOT contain template literal artifacts like `${...}`
    expect(output).not.toMatch(/\$\{/);
    // Should NOT be plain text like "Pipeline: Stage 1..."
    expect(() => JSON.parse(output)).not.toThrow();
  });
});

// ============================================================================
// verify ingest.ts has no raw console calls
// ============================================================================

describe("ingest.ts console usage verification", () => {
  it("should have no raw console.log or console.error calls in ingest.ts", async () => {
    // This is a source-code-level check
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const ingestPath = path.resolve(import.meta.dirname ?? ".", "../ingest.ts");
    const source = await fs.readFile(ingestPath, "utf-8");

    // Count raw console.log / console.error / console.warn calls
    // Exclude the import and the logger module itself
    const consoleLogMatches = source.match(/console\.(log|error|warn)\(/g);
    expect(consoleLogMatches).toBeNull();
  });
});
