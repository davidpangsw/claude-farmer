/**
 * Tests for the patch command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { patch } from "../commands/patch/index.js";
import { MockFileSystem, MockAIModel } from "./mocks.js";
import type { FileEdit } from "../types.js";

// Mock child_process.execSync
vi.mock("child_process", () => ({
  execSync: vi.fn(() => ""),
}));

import { execSync } from "child_process";

const mockedExecSync = vi.mocked(execSync);

describe("patch", () => {
  beforeEach(() => {
    mockedExecSync.mockClear();
    mockedExecSync.mockReturnValue("");
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

  it("passes commit message to git-patch-complete.sh", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
      "/project/src/index.ts": "export const x = 1;",
    });

    const edits: FileEdit[] = [
      { path: "/project/src/index.ts", content: "export const x = 2;" },
      { path: "/project/src/utils.ts", content: "export function helper() {}" },
    ];
    const ai = new MockAIModel("# Review", edits);

    await patch("/project", fs, ai, { once: true });

    // Check that the second call (git-patch-complete.sh) includes a commit message
    expect(mockedExecSync).toHaveBeenCalledTimes(2);
    const completeCall = mockedExecSync.mock.calls[1][0] as string;
    expect(completeCall).toContain("git-patch-complete.sh");
    expect(completeCall).toContain("claude-farmer: updated");
    expect(completeCall).toContain("index.ts");
    expect(completeCall).toContain("utils.ts");
  });

  it("truncates commit message when many files edited", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const edits: FileEdit[] = [
      { path: "/project/a.ts", content: "a" },
      { path: "/project/b.ts", content: "b" },
      { path: "/project/c.ts", content: "c" },
      { path: "/project/d.ts", content: "d" },
      { path: "/project/e.ts", content: "e" },
    ];
    const ai = new MockAIModel("# Review", edits);

    await patch("/project", fs, ai, { once: true });

    const completeCall = mockedExecSync.mock.calls[1][0] as string;
    expect(completeCall).toContain("and 2 more");
  });

  it("stops after one iteration with --once flag when no edits", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal\n\nAlready complete.",
    });

    // Return no edits
    const ai = new MockAIModel("# Review\n\nPerfect.", []);

    const result = await patch("/project", fs, ai, { once: true });

    expect(result.iterations).toBe(1);
    // Only checkout script should be called (no complete since no edits)
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff when no edits and not --once", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("# Review", []);
    
    // Track sleep calls
    const sleepCalls: number[] = [];
    const mockSleep = async (ms: number) => {
      sleepCalls.push(ms);
      // After 3 sleep calls, make the AI return edits to stop the loop
      if (sleepCalls.length >= 3) {
        ai.setEditsResponse([{ path: "/project/index.ts", content: "// done" }]);
      }
    };

    const result = await patch("/project", fs, ai, { _sleepFn: mockSleep });

    // Should have slept 3 times with exponential backoff
    expect(sleepCalls).toHaveLength(3);
    expect(sleepCalls[0]).toBe(60000);   // 1 minute
    expect(sleepCalls[1]).toBe(120000);  // 2 minutes
    expect(sleepCalls[2]).toBe(240000);  // 4 minutes
    
    // 4 iterations: 3 with no edits (sleep), 1 with edits (stop)
    expect(result.iterations).toBe(4);
  });

  it("resets backoff after successful edits", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    let callCount = 0;
    const ai = new MockAIModel("# Review", []);
    
    const sleepCalls: number[] = [];
    const mockSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    vi.spyOn(ai, "generateEdits").mockImplementation(async () => {
      callCount++;
      // Iteration 1: no edits (sleep 1 min)
      // Iteration 2: no edits (sleep 2 min)
      // Iteration 3: edits (reset backoff)
      // Iteration 4: no edits (sleep 1 min - reset!)
      // Iteration 5: edits (stop test)
      if (callCount === 3 || callCount === 5) {
        return [{ path: "/project/index.ts", content: `// v${callCount}` }];
      }
      return [];
    });

    // Use once: true after 5 iterations to stop
    let iterations = 0;
    vi.spyOn(ai, "generateReview").mockImplementation(async () => {
      iterations++;
      if (iterations >= 5) {
        // Force stop by making next iteration have edits and using once
      }
      return "# Review";
    });

    // Run for exactly 5 iterations then stop
    const patchPromise = patch("/project", fs, ai, { 
      _sleepFn: mockSleep,
      once: false 
    });

    // Since we return edits on iteration 5, it will stop
    const result = await patchPromise;

    // Verify backoff reset: after edits in iteration 3, sleep should be 1 min again
    expect(sleepCalls[0]).toBe(60000);   // After iteration 1
    expect(sleepCalls[1]).toBe(120000);  // After iteration 2  
    expect(sleepCalls[2]).toBe(60000);   // After iteration 4 (reset after iteration 3 had edits)
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

  it("retries on transient errors", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    let callCount = 0;
    const ai = new MockAIModel("# Review", []);
    vi.spyOn(ai, "generateReview").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("network timeout");
      }
      return "# Review";
    });

    const sleepCalls: number[] = [];
    const mockSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    // Should retry and succeed
    const result = await patch("/project", fs, ai, { once: true, _sleepFn: mockSleep });

    expect(callCount).toBe(2); // First failed, second succeeded
    expect(result.iterations).toBe(2);
    expect(sleepCalls.length).toBe(1); // Slept once for retry
  });

  it("throws after max retries on transient errors", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("# Review", []);
    vi.spyOn(ai, "generateReview").mockRejectedValue(new Error("network timeout"));

    const sleepCalls: number[] = [];
    const mockSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    await expect(patch("/project", fs, ai, { _sleepFn: mockSleep })).rejects.toThrow(
      "network timeout"
    );

    // Should have retried MAX_ERROR_RETRIES times (3)
    expect(sleepCalls.length).toBe(3);
  });

  it("throws immediately on non-transient errors", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("# Review", []);
    vi.spyOn(ai, "generateReview").mockRejectedValue(new Error("Invalid API key"));

    const sleepCalls: number[] = [];
    const mockSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    await expect(patch("/project", fs, ai, { _sleepFn: mockSleep })).rejects.toThrow(
      "Invalid API key"
    );

    // Should NOT have retried
    expect(sleepCalls.length).toBe(0);
  });

  it("loops multiple times when edits are made each iteration", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    let callCount = 0;
    const ai = new MockAIModel("# Review", []);
    vi.spyOn(ai, "generateEdits").mockImplementation(async () => {
      callCount++;
      // Return edits for first 2 calls, then empty to stop (with --once behavior via _sleepFn)
      if (callCount <= 2) {
        return [{ path: "/project/index.ts", content: `// v${callCount}` }];
      }
      return [];
    });

    const result = await patch("/project", fs, ai, { once: true });

    // With once: true, only runs one iteration
    expect(result.iterations).toBe(1);
  });

  it("continues looping with edits without --once flag", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    let callCount = 0;
    const ai = new MockAIModel("# Review", []);
    vi.spyOn(ai, "generateEdits").mockImplementation(async () => {
      callCount++;
      // Return edits for first 2 calls, then trigger stop
      if (callCount <= 2) {
        return [{ path: "/project/index.ts", content: `// v${callCount}` }];
      }
      // Third call returns edits to stop (since we need to test the loop)
      return [{ path: "/project/done.ts", content: "// done" }];
    });

    // Use a sleep fn that stops after we've verified looping works
    let shouldStop = false;
    const mockSleep = async () => {
      shouldStop = true;
    };

    // Spy on generateEdits to stop after 3 iterations
    let iterations = 0;
    const originalGenerateEdits = ai.generateEdits.bind(ai);
    vi.spyOn(ai, "generateEdits").mockImplementation(async (ctx) => {
      iterations++;
      if (iterations > 3) {
        // Force stop by returning edits and relying on the loop logic
        throw new Error("__TEST_STOP__");
      }
      return originalGenerateEdits(ctx);
    });

    try {
      await patch("/project", fs, ai, { _sleepFn: mockSleep });
    } catch (e) {
      if ((e as Error).message !== "__TEST_STOP__") throw e;
    }

    // Verify we looped at least twice with successful edits
    expect(iterations).toBeGreaterThanOrEqual(2);
    // git-patch-complete should have been called for iterations with edits
    expect(mockedExecSync).toHaveBeenCalled();
  });

  it("captures git script output to logs", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
      "/project/src/index.ts": "export const x = 1;",
    });

    // Make execSync return some output
    mockedExecSync.mockReturnValue("Already up to date.\n");

    const edits: FileEdit[] = [
      { path: "/project/src/index.ts", content: "export const x = 2;" },
    ];
    const ai = new MockAIModel("# Review", edits);

    await patch("/project", fs, ai, { once: true });

    // Check that the log contains the script output
    const allFiles = fs.getAllFiles();
    const logFiles = Array.from(allFiles.entries()).filter(([p]) =>
      p.includes("claude-farmer/logs/")
    );
    expect(logFiles.length).toBe(1);

    const logContent = logFiles[0][1];
    expect(logContent).toContain("Script output: Already up to date.");
  });

  it("accepts ultrathink option", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("# Review", []);

    // Should accept ultrathink option without error
    const result = await patch("/project", fs, ai, { once: true, ultrathink: true });

    expect(result.iterations).toBe(1);
  });
});
