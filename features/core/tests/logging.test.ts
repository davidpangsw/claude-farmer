/**
 * Unit tests for logging utilities.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createIterationLogger } from "../logging/index.js";

describe("IterationLogger", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "logging-test-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates log file in claude-farmer/logs directory", async () => {
    const logger = createIterationLogger(tempDir, 1);
    logger.log("Test message");
    logger.finalize();

    // Give time for sync write
    await new Promise(resolve => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "claude-farmer", "logs");
    const files = await readdir(logsDir);

    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/^\d{8}_\d{6}\.log$/);
  });

  it("writes log messages with timestamps", async () => {
    const logger = createIterationLogger(tempDir, 2);
    logger.log("Test log message");
    logger.error("Test error message");
    logger.finalize();

    // Give time for sync write
    await new Promise(resolve => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "claude-farmer", "logs");
    const files = await readdir(logsDir);
    const latestLog = files.sort().pop()!;
    const content = await readFile(join(logsDir, latestLog), "utf-8");

    expect(content).toContain("Test log message");
    expect(content).toContain("Test error message");
  });

  it("logs iteration start and completion messages", async () => {
    const logger = createIterationLogger(tempDir, 3);
    logger.finalize();

    // Give time for sync write
    await new Promise(resolve => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "claude-farmer", "logs");
    const files = await readdir(logsDir);
    const latestLog = files.sort().pop()!;
    const content = await readFile(join(logsDir, latestLog), "utf-8");

    expect(content).toContain("Iteration 3 started");
    expect(content).toContain("Iteration 3 completed");
  });
});
