/**
 * Tests for the review task.
 */

import { describe, it, expect } from "vitest";
import { review } from "../tasks/review/index.js";
import { MockFileSystem, MockAIModel } from "./mocks.js";

describe("review", () => {
  it("generates and writes a review", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal\n\nBuild a widget.",
      "/project/features/myfeature/index.ts": "export const widget = {};",
    });

    const ai = new MockAIModel("# Review\n\n- Add tests\n- Improve types");

    const result = await review("/project/features/myfeature", fs, ai);

    expect(result.workingDirName).toBe("myfeature");
    expect(result.reviewPath).toBe("/project/features/myfeature/claude-farmer/docs/REVIEW.md");
    expect(result.content).toBe("# Review\n\n- Add tests\n- Improve types");

    // Verify file was written
    const writtenContent = fs.getFile("/project/features/myfeature/claude-farmer/docs/REVIEW.md");
    expect(writtenContent).toBe("# Review\n\n- Add tests\n- Improve types");
  });

  it("overwrites existing review", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal",
      "/project/features/myfeature/claude-farmer/docs/REVIEW.md": "# Old Review",
    });

    const ai = new MockAIModel("# New Review");

    await review("/project/features/myfeature", fs, ai);

    const writtenContent = fs.getFile("/project/features/myfeature/claude-farmer/docs/REVIEW.md");
    expect(writtenContent).toBe("# New Review");
  });
});
