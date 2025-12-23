/**
 * Tests for the logging utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createIterationLogger } from "../logging/index.js";
import { MockFileSystem } from "./mocks.js";

describe("IterationLogger", () => {
  beforeEach(() => {
    // Mock Date to get consistent timestamps
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T10:30:45.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates log file with YYYYMMDD_HHmmss timestamp format", async () => {
    const fs = new MockFileSystem({});
    const logger = createIterationLogger("/project", fs, 1);

    const logPath = await logger.finalize();

    // Timestamp uses local time - check the format pattern
    expect(logPath).toMatch(/\/project\/claude-farmer\/logs\/\d{8}_\d{6}\.log$/);
  });

  it("logs iteration start and end", async () => {
    const fs = new MockFileSystem({});
    const logger = createIterationLogger("/project", fs, 1);

    await logger.finalize();

    const allFiles = fs.getAllFiles();
    const logFiles = Array.from(allFiles.entries()).filter(([p]) =>
      p.includes("claude-farmer/logs/")
    );
    expect(logFiles.length).toBe(1);

    const content = logFiles[0][1];
    expect(content).toContain("Iteration 1 started");
    expect(content).toContain("Iteration 1 completed");
  });

  it("logs review completion", async () => {
    const fs = new MockFileSystem({});
    const logger = createIterationLogger("/project", fs, 1);

    logger.logReview("/project/claude-farmer/docs/REVIEW.md", 500);
    await logger.finalize();

    const allFiles = fs.getAllFiles();
    const logContent = Array.from(allFiles.values())[0];
    expect(logContent).toContain("Review completed");
    expect(logContent).toContain("500 chars");
  });

  it("logs develop completion with file details", async () => {
    const fs = new MockFileSystem({});
    const logger = createIterationLogger("/project", fs, 1);

    logger.logDevelop([
      { path: "/project/src/a.ts", content: "abc" },
      { path: "/project/src/b.ts", content: "defgh" },
    ]);
    await logger.finalize();

    const allFiles = fs.getAllFiles();
    const logContent = Array.from(allFiles.values())[0];
    expect(logContent).toContain("Develop completed: 2 file(s) edited");
    expect(logContent).toContain("/project/src/a.ts (3 chars)");
    expect(logContent).toContain("/project/src/b.ts (5 chars)");
  });

  it("logs commit message", async () => {
    const fs = new MockFileSystem({});
    const logger = createIterationLogger("/project", fs, 1);

    logger.logCommit("Added new feature");
    await logger.finalize();

    const allFiles = fs.getAllFiles();
    const logContent = Array.from(allFiles.values())[0];
    expect(logContent).toContain("Committed: Added new feature");
  });

  it("logs no changes", async () => {
    const fs = new MockFileSystem({});
    const logger = createIterationLogger("/project", fs, 1);

    logger.logNoChanges();
    await logger.finalize();

    const allFiles = fs.getAllFiles();
    const logContent = Array.from(allFiles.values())[0];
    expect(logContent).toContain("No changes to commit");
  });

  it("logs errors", async () => {
    const fs = new MockFileSystem({});
    const logger = createIterationLogger("/project", fs, 1);

    logger.logError("Something went wrong");
    await logger.finalize();

    const allFiles = fs.getAllFiles();
    const logContent = Array.from(allFiles.values())[0];
    expect(logContent).toContain("ERROR: Something went wrong");
  });
});

describe("Log rotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps exactly 100 log files when more exist", async () => {
    const files: Record<string, string> = {};

    // Create 105 existing log files
    for (let i = 1; i <= 105; i++) {
      const timestamp = `20240315_${String(i).padStart(6, "0")}`;
      files[`/project/claude-farmer/logs/${timestamp}.log`] = `Log ${i}`;
    }

    const fs = new MockFileSystem(files);
    const logger = createIterationLogger("/project", fs, 106);

    await logger.finalize();

    // After rotation, should have 100 files
    const allFiles = fs.getAllFiles();
    const logFiles = Array.from(allFiles.keys()).filter((p) =>
      p.includes("claude-farmer/logs/")
    );

    expect(logFiles.length).toBe(100);
  });

  it("does not delete files when under 100", async () => {
    const files: Record<string, string> = {};

    // Create 50 existing log files
    for (let i = 1; i <= 50; i++) {
      const timestamp = `20240315_${String(i).padStart(6, "0")}`;
      files[`/project/claude-farmer/logs/${timestamp}.log`] = `Log ${i}`;
    }

    const fs = new MockFileSystem(files);
    const logger = createIterationLogger("/project", fs, 51);

    await logger.finalize();

    const allFiles = fs.getAllFiles();
    const logFiles = Array.from(allFiles.keys()).filter((p) =>
      p.includes("claude-farmer/logs/")
    );

    // Should have 51 files (50 existing + 1 new)
    expect(logFiles.length).toBe(51);
  });

  it("deletes oldest files based on timestamp in filename", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/logs/20240101_000001.log": "oldest",
      "/project/claude-farmer/logs/20240315_120000.log": "newer",
    });

    // Add 99 more files to trigger rotation (total 101 before new one, need to delete 2)
    for (let i = 2; i <= 100; i++) {
      const timestamp = `20240315_${String(i).padStart(6, "0")}`;
      await fs.writeFile(
        `/project/claude-farmer/logs/${timestamp}.log`,
        `Log ${i}`
      );
    }

    const logger = createIterationLogger("/project", fs, 102);
    await logger.finalize();

    // The oldest file should be deleted
    expect(fs.getFile("/project/claude-farmer/logs/20240101_000001.log")).toBeUndefined();
    // The newer file should still exist
    expect(fs.getFile("/project/claude-farmer/logs/20240315_120000.log")).toBe("newer");
  });
});
