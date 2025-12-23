/**
 * Tests for the patch command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { patch } from "../commands/patch/index.js";
import { MockFileSystem, MockAIModel } from "./mocks.js";
import type { FileEdit } from "../types.js";

// Mock child_process.execSync
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";

const mockedExecSync = vi.mocked(execSync);

describe("patch", () => {
  beforeEach(() => {
    mockedExecSync.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs once with --once flag", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal\n\nBuild something.",
      "/project/src/index.ts": "export const x = 1;",
    });

    const edits: FileEdit[] = [
      { path: "/project/src/index.ts", content: "export const x = 2;" },
    ];
    const ai = new MockAIModel("# Review\n\nLooks good.", edits);

    const result = await patch("/project", fs, ai, { once: true });

    expect(result.iterations).toBe(1);
    expect(result.workingDirName).toBe("project");
    // Should call git scripts twice (checkout + complete)
    expect(mockedExecSync).toHaveBeenCalledTimes(2);
  });

  it("stops loop when no edits are made", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal\n\nAlready complete.",
    });

    // Return no edits - should stop after one iteration
    const ai = new MockAIModel("# Review\n\nPerfect.", []);

    const result = await patch("/project", fs, ai);

    expect(result.iterations).toBe(1);
    // Only checkout script should be called (no complete since no edits)
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it("writes REVIEW.md during iteration", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("# Review\n\n- Suggestion 1", []);

    await patch("/project", fs, ai, { once: true });

    const reviewContent = fs.getFile("/project/claude-farmer/docs/REVIEW.md");
    expect(reviewContent).toBe("# Review\n\n- Suggestion 1");
  });

  it("applies file edits during iteration", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
      "/project/src/index.ts": "// old",
    });

    const edits: FileEdit[] = [
      { path: "/project/src/index.ts", content: "// new" },
    ];
    const ai = new MockAIModel("# Review", edits);

    await patch("/project", fs, ai, { once: true });

    expect(fs.getFile("/project/src/index.ts")).toBe("// new");
  });

  it("creates log file after iteration", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("# Review", []);

    await patch("/project", fs, ai, { once: true });

    // Check that a log file was created
    const allFiles = fs.getAllFiles();
    const logFiles = Array.from(allFiles.keys()).filter((p) =>
      p.includes("claude-farmer/logs/")
    );
    expect(logFiles.length).toBe(1);
    expect(logFiles[0]).toMatch(/\.log$/);
  });

  it("logs error and re-throws on failure", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("# Review", []);
    // Make generateReview throw an error
    vi.spyOn(ai, "generateReview").mockRejectedValue(new Error("AI failed"));

    await expect(patch("/project", fs, ai, { once: true })).rejects.toThrow(
      "AI failed"
    );

    // Log file should still be created with error
    const allFiles = fs.getAllFiles();
    const logFiles = Array.from(allFiles.keys()).filter((p) =>
      p.includes("claude-farmer/logs/")
    );
    expect(logFiles.length).toBe(1);

    const logContent = fs.getFile(logFiles[0]);
    expect(logContent).toContain("ERROR: AI failed");
  });

  it("loops multiple times until no edits", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    let callCount = 0;
    const ai = new MockAIModel("# Review", []);
    vi.spyOn(ai, "generateEdits").mockImplementation(async () => {
      callCount++;
      // Return edits for first 2 calls, then empty
      if (callCount <= 2) {
        return [{ path: "/project/index.ts", content: `// v${callCount}` }];
      }
      return [];
    });

    const result = await patch("/project", fs, ai);

    expect(result.iterations).toBe(3);
    // 3 checkouts + 2 completes (no complete on 3rd iteration since no edits)
    expect(mockedExecSync).toHaveBeenCalledTimes(5);
  });
});
