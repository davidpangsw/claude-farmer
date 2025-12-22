/**
 * Tests for context gathering.
 */

import { describe, it, expect } from "vitest";
import { gatherFeatureContext } from "../context.js";
import { MockFileSystem } from "./mocks.js";
import type { CoreConfig } from "../types.js";

describe("gatherFeatureContext", () => {
  const config: CoreConfig = {
    projectRoot: "/project",
    featuresDir: "/project/features",
  };

  it("gathers basic context without research or review", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal\n\nBuild something.",
      "/project/features/myfeature/index.ts": "export const foo = 1;",
    });

    const context = await gatherFeatureContext("myfeature", config, fs);

    expect(context.featureName).toBe("myfeature");
    expect(context.featurePath).toBe("/project/features/myfeature");
    expect(context.goal.content).toBe("# Goal\n\nBuild something.");
    expect(context.research).toBeUndefined();
    expect(context.review).toBeUndefined();
    expect(context.sourceFiles).toHaveLength(1);
    expect(context.sourceFiles[0].path).toBe("/project/features/myfeature/index.ts");
  });

  it("gathers context with existing research", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal",
      "/project/features/myfeature/docs/RESEARCH.md": "# Research\n\nFindings here.",
    });

    const context = await gatherFeatureContext("myfeature", config, fs);

    expect(context.research).toBeDefined();
    expect(context.research?.content).toBe("# Research\n\nFindings here.");
  });

  it("gathers context with existing review", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal",
      "/project/features/myfeature/docs/REVIEW.md": "# Review\n\nSuggestions here.",
    });

    const context = await gatherFeatureContext("myfeature", config, fs);

    expect(context.review).toBeDefined();
    expect(context.review?.content).toBe("# Review\n\nSuggestions here.");
  });

  it("gathers multiple source files", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal",
      "/project/features/myfeature/index.ts": "export * from './utils.js';",
      "/project/features/myfeature/utils.ts": "export function helper() {}",
      "/project/features/myfeature/types.ts": "export interface Foo {}",
    });

    const context = await gatherFeatureContext("myfeature", config, fs);

    expect(context.sourceFiles).toHaveLength(3);
  });

  it("throws if GOAL.md is missing", async () => {
    const fs = new MockFileSystem({});

    await expect(gatherFeatureContext("myfeature", config, fs)).rejects.toThrow(
      "File not found"
    );
  });
});
