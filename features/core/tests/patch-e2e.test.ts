/**
 * End-to-end integration test for the patch command.
 *
 * This test runs the actual patch workflow with the real Claude CLI.
 * The test is skipped if the `claude` CLI is not installed.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { glob } from "glob";
import { tmpdir } from "os";
import { join } from "path";
import { patch } from "../commands/patch/index.js";
import { ClaudeCodeAI } from "../claude/index.js";

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

/**
 * Check if git is available and initialized.
 */
function isGitAvailable(): boolean {
  try {
    execSync("which git", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const CLAUDE_AVAILABLE = isClaudeCliAvailable();
const GIT_AVAILABLE = isGitAvailable();
const CAN_RUN_E2E = CLAUDE_AVAILABLE && GIT_AVAILABLE;

describe.skipIf(!CAN_RUN_E2E)("Patch E2E", () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create a temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), "claude-farmer-e2e-"));

    // Initialize git repo
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: "pipe" });

    // Create initial structure
    await mkdir(join(tempDir, "claude-farmer", "docs"), { recursive: true });
    await writeFile(
      join(tempDir, "claude-farmer", "GOAL.md"),
      "# Goal\n\nCreate a simple greeting function that returns 'Hello, World!'.\n"
    );
    await writeFile(
      join(tempDir, "index.ts"),
      "// Placeholder\n"
    );

    // Initial commit
    execSync("git add -A && git commit -m 'Initial'", { cwd: tempDir, stdio: "pipe" });
  });

  afterAll(async () => {
    // Cleanup
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("runs a single patch iteration and produces edits", async () => {
    const ai = new ClaudeCodeAI({
      cwd: tempDir,
      ultrathink: false, // Faster for tests
      timeout: 180000, // 3 minute timeout
    });

    const result = await patch(tempDir, ai, {
      once: true,
    });

    expect(result.iterations).toBe(1);

    // Check that REVIEW.md was created
    const reviewPath = join(tempDir, "claude-farmer", "docs", "REVIEW.md");
    const reviewContent = await readFile(reviewPath, "utf-8");
    expect(reviewContent.length).toBeGreaterThan(0);

    // Check that log was created
    const logFiles = await glob(`${tempDir}/claude-farmer/logs/*.log`);
    expect(logFiles.length).toBeGreaterThan(0);
  }, 240000); // 4 minute timeout for the test itself
});

describe.skipIf(CAN_RUN_E2E)("Patch E2E (skipped)", () => {
  it("skips E2E tests when prerequisites not available", () => {
    const reasons = [];
    if (!CLAUDE_AVAILABLE) reasons.push("claude CLI not found");
    if (!GIT_AVAILABLE) reasons.push("git not found");
    console.log(`Patch E2E tests skipped: ${reasons.join(", ")}`);
    expect(true).toBe(true);
  });
});
