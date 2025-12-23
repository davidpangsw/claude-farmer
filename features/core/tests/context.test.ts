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

  it("gathers files with multiple extensions using default patterns", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
      "/project/src/index.ts": "export const x = 1;",
      "/project/src/Component.tsx": "export function Component() {}",
      "/project/src/utils.js": "module.exports = {};",
      "/project/src/helper.jsx": "export function Helper() {}",
      "/project/package.json": '{"name": "test"}',
      "/project/README.md": "# README",
    });

    const context = await gatherWorkingDirContext("/project", fs);

    // Should include all file types from default patterns
    const extensions = context.sourceFiles.map(f => f.path.split(".").pop());
    expect(extensions).toContain("ts");
    expect(extensions).toContain("tsx");
    expect(extensions).toContain("js");
    expect(extensions).toContain("jsx");
    expect(extensions).toContain("json");
    expect(extensions).toContain("md");
  });

  it("supports custom file patterns", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
      "/project/src/index.ts": "export const x = 1;",
      "/project/src/style.css": "body {}",
      "/project/src/config.yaml": "key: value",
    });

    // Only gather CSS files
    const context = await gatherWorkingDirContext("/project", fs, ["**/*.css"]);

    expect(context.sourceFiles).toHaveLength(1);
    expect(context.sourceFiles[0].path).toContain(".css");
  });

  it("deduplicates files when patterns overlap", async () => {
    const fs = new MockFileSystem({
      "/project/claude-farmer/GOAL.md": "# Goal",
      "/project/src/index.ts": "export const x = 1;",
    });

    // Both patterns would match the same file
    const context = await gatherWorkingDirContext("/project", fs, ["**/*.ts", "**/index.ts"]);

    expect(context.sourceFiles).toHaveLength(1);
  });
});
