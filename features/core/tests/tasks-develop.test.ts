/**
 * Unit tests for the develop task.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from "fs/promises";
import { tmpdir } from "os";
import { join, basename } from "path";
import { develop } from "../tasks/develop/index.js";
import type { AIModel, FileEdit } from "../types.js";

describe("develop task", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "develop-task-test-"));

    await mkdir(join(tempDir, "claude-farmer", "docs"), { recursive: true });
    await writeFile(
      join(tempDir, "claude-farmer", "GOAL.md"),
      "# Goal\n\nCreate a hello function."
    );
    await writeFile(join(tempDir, "index.ts"), "export const x = 1;");
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("calls AI generateEdits with gathered context", async () => {
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(""),
      generateEdits: vi.fn().mockResolvedValue([]),
    };

    await develop(tempDir, mockAI);

    expect(mockAI.generateEdits).toHaveBeenCalledTimes(1);
  });

  it("writes files from AI edits", async () => {
    const mockEdits: FileEdit[] = [
      { path: "src/hello.ts", content: "export function hello() { return 'Hello'; }" },
    ];
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(""),
      generateEdits: vi.fn().mockResolvedValue(mockEdits),
    };

    const result = await develop(tempDir, mockAI);

    expect(result.edits.length).toBeGreaterThan(0);
    const helloFile = result.edits.find(e => e.path.endsWith("hello.ts"));
    expect(helloFile).toBeDefined();

    const content = await readFile(join(tempDir, "src", "hello.ts"), "utf-8");
    expect(content).toContain("Hello");
  });

  it("blocks path traversal attempts", async () => {
    const mockEdits: FileEdit[] = [
      { path: "../../../etc/passwd", content: "malicious content" },
      { path: "valid.ts", content: "valid content" },
    ];
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(""),
      generateEdits: vi.fn().mockResolvedValue(mockEdits),
    };

    const result = await develop(tempDir, mockAI);

    // Should only have the valid file (+ DEVELOP.json)
    const passwdEdit = result.edits.find(e => e.path.includes("passwd"));
    expect(passwdEdit).toBeUndefined();

    const validEdit = result.edits.find(e => e.path.endsWith("valid.ts"));
    expect(validEdit).toBeDefined();
  });

  it("generates fallback DEVELOP.json when AI does not include it", async () => {
    const mockEdits: FileEdit[] = [
      { path: "test.ts", content: "test content" },
    ];
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(""),
      generateEdits: vi.fn().mockResolvedValue(mockEdits),
    };

    const result = await develop(tempDir, mockAI);

    const developJson = result.edits.find(e => e.path.endsWith("DEVELOP.json"));
    expect(developJson).toBeDefined();

    const jsonPath = join(tempDir, "claude-farmer", "docs", "DEVELOP.json");
    await access(jsonPath); // Should not throw
    const content = JSON.parse(await readFile(jsonPath, "utf-8"));
    expect(content.changes).toBeDefined();
  });

  it("returns empty edits when AI returns empty array", async () => {
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(""),
      generateEdits: vi.fn().mockResolvedValue([]),
    };

    const result = await develop(tempDir, mockAI);

    expect(result.edits).toHaveLength(0);
    expect(result.workingDirName).toBe(basename(tempDir));
  });
});
