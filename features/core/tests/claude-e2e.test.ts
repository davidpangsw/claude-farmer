/**
 * End-to-end integration test for ClaudeCodeAI.
 *
 * This test spawns the actual `claude` CLI to verify real output parsing.
 * The test is skipped if the `claude` CLI is not installed.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { ClaudeCodeAI } from "../claude/index.js";
import type { WorkingDirContext } from "../types.js";

/**
 * Check if the claude CLI is available.
 */
function isClaudeCliAvailable(): boolean {
  try {
    execSync("which claude", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const CLAUDE_AVAILABLE = isClaudeCliAvailable();

describe.skipIf(!CLAUDE_AVAILABLE)("ClaudeCodeAI E2E", () => {
  // Note: These tests are slow as they spawn the actual Claude CLI
  // They verify that output parsing works with real Claude responses

  it("generates review from real Claude CLI", async () => {
    const ai = new ClaudeCodeAI({
      ultrathink: false, // Faster for tests
      timeout: 120000, // 2 minute timeout
    });

    const context: WorkingDirContext = {
      workingDirName: "test-project",
      workingDirPath: "/tmp/test-project",
      goal: {
        path: "/tmp/test-project/claude-farmer/GOAL.md",
        content: "# Goal\n\nCreate a simple hello world function.",
      },
      sourceFiles: [
        {
          path: "/tmp/test-project/index.ts",
          content: "export function hello() { return 'Hello'; }",
        },
      ],
    };

    const review = await ai.generateReview(context);

    // Should return some text (the actual content will vary)
    expect(typeof review).toBe("string");
    expect(review.length).toBeGreaterThan(0);
  }, 150000); // 2.5 minute timeout for the test itself

  it("generates edits from real Claude CLI", async () => {
    const ai = new ClaudeCodeAI({
      ultrathink: false,
      timeout: 120000,
    });

    const context: WorkingDirContext = {
      workingDirName: "test-project",
      workingDirPath: "/tmp/test-project",
      goal: {
        path: "/tmp/test-project/claude-farmer/GOAL.md",
        content: "# Goal\n\nAdd a goodbye function that returns 'Goodbye'.",
      },
      sourceFiles: [
        {
          path: "/tmp/test-project/index.ts",
          content: "export function hello() { return 'Hello'; }",
        },
      ],
    };

    const edits = await ai.generateEdits(context);

    // Should return an array (may be empty or have edits)
    expect(Array.isArray(edits)).toBe(true);

    // If there are edits, they should have valid structure
    for (const edit of edits) {
      expect(typeof edit.path).toBe("string");
      expect(typeof edit.content).toBe("string");
    }
  }, 150000);
});

describe.skipIf(CLAUDE_AVAILABLE)("ClaudeCodeAI E2E (skipped - claude CLI not found)", () => {
  it("skips E2E tests when claude CLI is not available", () => {
    // This test exists just to show why E2E tests were skipped
    console.log("Claude CLI not found - E2E tests skipped. Install claude CLI to run these tests.");
    expect(true).toBe(true);
  });
});
