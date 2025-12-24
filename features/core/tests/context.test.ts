/**
 * Unit tests for context gathering utilities.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { gatherWorkingDirContext } from "../context.js";

describe("gatherWorkingDirContext", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "context-test-"));

    // Create basic structure
    await mkdir(join(tempDir, "claude-farmer", "docs"), { recursive: true });
    await writeFile(
      join(tempDir, "claude-farmer", "GOAL.md"),
      "# Goal\n\nTest goal content."
    );
    await writeFile(join(tempDir, "index.ts"), "export const x = 1;");
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("gathers GOAL.md content", async () => {
    const context = await gatherWorkingDirContext(tempDir);

    expect(context.goal.content).toContain("Test goal content");
    expect(context.workingDirPath).toBe(tempDir);
  });

  it("gathers source files", async () => {
    const context = await gatherWorkingDirContext(tempDir);

    expect(context.sourceFiles.length).toBeGreaterThan(0);
    const indexFile = context.sourceFiles.find(f => f.path.endsWith("index.ts"));
    expect(indexFile).toBeDefined();
    expect(indexFile?.content).toBe("export const x = 1;");
  });

  it("excludes claude-farmer directory from source files", async () => {
    const context = await gatherWorkingDirContext(tempDir);

    const claudeFarmerFiles = context.sourceFiles.filter(f =>
      f.path.includes("claude-farmer")
    );
    expect(claudeFarmerFiles).toHaveLength(0);
  });

  it("includes REVIEW.md when it exists", async () => {
    await writeFile(
      join(tempDir, "claude-farmer", "docs", "REVIEW.md"),
      "# Review\n\nTest review."
    );

    const context = await gatherWorkingDirContext(tempDir);

    expect(context.review).toBeDefined();
    expect(context.review?.content).toContain("Test review");
  });

  it("excludes node_modules", async () => {
    await mkdir(join(tempDir, "node_modules", "some-pkg"), { recursive: true });
    await writeFile(
      join(tempDir, "node_modules", "some-pkg", "index.js"),
      "module.exports = {};"
    );

    const context = await gatherWorkingDirContext(tempDir);

    const nodeModulesFiles = context.sourceFiles.filter(f =>
      f.path.includes("node_modules")
    );
    expect(nodeModulesFiles).toHaveLength(0);
  });

  it("excludes package-lock.json", async () => {
    await writeFile(
      join(tempDir, "package-lock.json"),
      JSON.stringify({ name: "test", lockfileVersion: 2 })
    );

    const context = await gatherWorkingDirContext(tempDir);

    const lockFiles = context.sourceFiles.filter(f =>
      f.path.endsWith("package-lock.json")
    );
    expect(lockFiles).toHaveLength(0);
  });

  it("excludes files larger than 100KB", async () => {
    // Create a file larger than 100KB
    const largeContent = "x".repeat(101 * 1024);
    await writeFile(join(tempDir, "large-file.ts"), largeContent);

    const context = await gatherWorkingDirContext(tempDir);

    const largeFile = context.sourceFiles.find(f =>
      f.path.endsWith("large-file.ts")
    );
    expect(largeFile).toBeUndefined();
  });
});
