/**
 * JSDoc coverage test (VAL-DOC-001, VAL-DOC-002).
 *
 * Scans all target source files and asserts that every exported function
 * (query, mutation, action, export function, export const) has a preceding
 * JSDoc block.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SourceFile {
  relativePath: string;
  absolutePath: string;
}

// Read a source file, returning its content as an array of lines.
function readLines(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content.split("\n");
}

// Check whether the line at lineIndex has a preceding JSDoc block.
// Searches backwards from the line before the declaration to find the
// closing star-slash of a JSDoc comment.
function hasPrecedingJsdoc(lines: string[], lineIndex: number): boolean {
  let i = lineIndex - 1;

  // Skip blank lines
  while (i >= 0 && lines[i].trim() === "") {
    i--;
  }

  // The closest non-blank line should be the end of a JSDoc block
  if (i < 0) return false;
  return lines[i].trim().endsWith("*/");
}

// Find all lines that contain an exported Convex function or an exported
// function/const declaration in a given source file.
function findExportedFunctionLines(lines: string[]): number[] {
  const result: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // exported Convex functions: export const xxx = query/mutation/action/internalQuery/internalMutation({
    if (/^export\s+const\s+\w+\s*=\s*(query|mutation|action|internalQuery|internalMutation)\s*\(/.test(trimmed)) {
      result.push(i);
      continue;
    }

    // exported function declarations: export function xxx(
    if (/^export\s+function\s+\w+/.test(trimmed)) {
      result.push(i);
      continue;
    }

    // exported async functions: export async function xxx
    if (/^export\s+async\s+function\s+\w+/.test(trimmed)) {
      result.push(i);
      continue;
    }

    // exported classes: export class xxx
    if (/^export\s+class\s+\w+/.test(trimmed)) {
      result.push(i);
      continue;
    }

    // exported const that is a function: export const xxx = (args) =>
    if (/^export\s+const\s+\w+\s*=\s*(\([^)]*\)|function)\s*(=>|\{)/.test(trimmed)) {
      result.push(i);
      continue;
    }

    // exported const with type annotation callable: export const xxx: Type = (...
    if (/^export\s+const\s+\w+\s*:\s*\w+\s*=\s*\(/.test(trimmed)) {
      result.push(i);
      continue;
    }
  }

  return result;
}

// For a given source file, find all exported functions and check that each
// has a preceding JSDoc block. Returns violations with line numbers and names.
function findMissingJsdoc(file: SourceFile): { line: number; name: string }[] {
  const lines = readLines(file.absolutePath);
  const exportedLines = findExportedFunctionLines(lines);
  const violations: { line: number; name: string }[] = [];

  for (const lineIndex of exportedLines) {
    if (!hasPrecedingJsdoc(lines, lineIndex)) {
      const match = lines[lineIndex].match(/export\s+(?:const|function|class|async\s+function)\s+(\w+)/);
      const name = match ? match[1] : `line ${lineIndex + 1}`;
      violations.push({ line: lineIndex + 1, name });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Convex backend files (VAL-DOC-001)
// ---------------------------------------------------------------------------

const CONVEX_FILES: SourceFile[] = [
  "convex/ingest.ts",
  "convex/products.ts",
  "convex/duplicates.ts",
  "convex/stats.ts",
  "convex/providers.ts",
  "convex/ingestionProgress.ts",
].map((p) => ({
  relativePath: p,
  absolutePath: path.join(PROJECT_ROOT, p),
}));

describe("VAL-DOC-001: All exported Convex functions have JSDoc", () => {
  for (const file of CONVEX_FILES) {
    describe(file.relativePath, () => {
      it("every exported query/mutation/action has a preceding JSDoc block", () => {
        const violations = findMissingJsdoc(file);

        if (violations.length > 0) {
          const details = violations
            .map((v) => `  - "${v.name}" at line ${v.line}`)
            .join("\n");
          expect.fail(
            `Missing JSDoc on ${violations.length} exported function(s) in ${file.relativePath}:\n${details}`
          );
        }

        // Also verify at least one exported function was found
        const lines = readLines(file.absolutePath);
        const exportedLines = findExportedFunctionLines(lines);
        expect(
          exportedLines.length,
          `No exported functions found in ${file.relativePath}`
        ).toBeGreaterThan(0);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Lib files (VAL-DOC-002)
// ---------------------------------------------------------------------------

const LIB_FILES: SourceFile[] = [
  "convex/lib/schemas.ts",
  "convex/lib/validation.ts",
  "convex/lib/levenshtein.ts",
  "convex/lib/rateLimiter.ts",
  "convex/lib/logger.ts",
  "src/lib/filters.ts",
  "src/lib/format.ts",
].map((p) => ({
  relativePath: p,
  absolutePath: path.join(PROJECT_ROOT, p),
}));

describe("VAL-DOC-002: All exported lib functions have JSDoc", () => {
  for (const file of LIB_FILES) {
    describe(file.relativePath, () => {
      it("every exported function/const has a preceding JSDoc block", () => {
        const violations = findMissingJsdoc(file);

        if (violations.length > 0) {
          const details = violations
            .map((v) => `  - "${v.name}" at line ${v.line}`)
            .join("\n");
          expect.fail(
            `Missing JSDoc on ${violations.length} exported function(s)/const(s) in ${file.relativePath}:\n${details}`
          );
        }
      });
    });
  }
});
