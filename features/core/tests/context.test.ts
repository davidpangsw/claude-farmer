/**
 * Tests for context gathering.
 */

import { describe, it, expect } from "vitest";
import { gatherWorkingDirContext } from "../context.js";
import { MockFileSystem } from "./mocks.js";

describe("gatherWorkingDirContext", () => {
  it("gathers basic context without review", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal\n\nBuild something.",
      "/project/features/myfeature/index.ts": "export const foo = 1;",
    });

    const context = await gatherWorkingDirContext("/project/features/myfeature", fs);

    expect(context.workingDirName).toBe("myfeature");
    expect(context.workingDirPath).toBe("/project/features/myfeature");
    expect(context.goal.content).toBe("# Goal\n\nBuild something.");
    expect(context.review).toBeUndefined();
    expect(context.sourceFiles).toHaveLength(1);
    expect(context.sourceFiles[0].path).toBe("/project/features/myfeature/index.ts");
  });

  it("gathers context with existing review", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal",
      "/project/features/myfeature/claude-farmer/docs/REVIEW.md": "# Review\n\nSuggestions here.",
    });

    const context = await gatherWorkingDirContext("/project/features/myfeature", fs);

    expect(context.review).toBeDefined();
    expect(context.review?.content).toBe("# Review\n\nSuggestions here.");
  });

  it("gathers multiple source files, excluding claude-farmer/", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal",
      "/project/features/myfeature/index.ts": "export * from './utils.js';",
      "/project/features/myfeature/utils.ts": "export function helper() {}",
      "/project/features/myfeature/types.ts": "export interface Foo {}",
      "/project/features/myfeature/claude-farmer/docs/internal.ts": "// should be excluded",
    });

    const context = await gatherWorkingDirContext("/project/features/myfeature", fs);

    expect(context.sourceFiles).toHaveLength(3);
  });

  it("throws if GOAL.md is missing", async () => {
    const fs = new MockFileSystem({});

    await expect(gatherWorkingDirContext("/project/features/myfeature", fs)).rejects.toThrow(
      "File not found"
    );
  });
});
