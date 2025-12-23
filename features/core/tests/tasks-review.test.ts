/**
 * Unit tests for the review task.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { review } from "../tasks/review/index.js";
import type { AIModel, WorkingDirContext } from "../types.js";

describe("review task", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "review-task-test-"));

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

  it("calls AI generateReview with gathered context", async () => {
    const mockReviewContent = "# Review\n\n## Summary\nTest review.";
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(mockReviewContent),
      generateEdits: vi.fn().mockResolvedValue([]),
    };

    await review(tempDir, mockAI);

    expect(mockAI.generateReview).toHaveBeenCalledTimes(1);
    const context = (mockAI.generateReview as ReturnType<typeof vi.fn>).mock.calls[0][0] as WorkingDirContext;
    expect(context.goal.content).toContain("Create a hello function");
  });

  it("writes REVIEW.md to docs directory", async () => {
    const mockReviewContent = "# Review\n\n## Summary\nGenerated review.";
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(mockReviewContent),
      generateEdits: vi.fn().mockResolvedValue([]),
    };

    const result = await review(tempDir, mockAI);

    expect(result.reviewPath).toBe(join(tempDir, "claude-farmer", "docs", "REVIEW.md"));
    const content = await readFile(result.reviewPath, "utf-8");
    expect(content).toBe(mockReviewContent);
  });

  it("returns review result with content", async () => {
    const mockReviewContent = "# Review\n\nContent here.";
    const mockAI: AIModel = {
      generateReview: vi.fn().mockResolvedValue(mockReviewContent),
      generateEdits: vi.fn().mockResolvedValue([]),
    };

    const result = await review(tempDir, mockAI);

    expect(result.content).toBe(mockReviewContent);
    expect(result.workingDirName).toBe(join(tempDir).split("/").pop());
  });
});
