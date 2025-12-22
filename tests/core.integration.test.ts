/**
 * Integration tests for the core feature.
 *
 * Tests the Patch command workflow: Review → Develop
 * (Git operations are tested separately via shell scripts)
 */

import { describe, it, expect } from "vitest";
import { gatherFeatureContext } from "../features/core/index.js";
import type {
  FileSystem,
  AIModel,
  FeatureContext,
  FileEdit,
  SummaryFile,
  CoreConfig,
} from "../features/core/index.js";
// Import tasks directly (internal to core feature)
import { review } from "../features/core/tasks/review/index.js";
import { develop } from "../features/core/tasks/develop/index.js";

/**
 * In-memory file system for integration testing.
 */
class TestFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor(initialFiles: Record<string, string>) {
    for (const [path, content] of Object.entries(initialFiles)) {
      this.files.set(path, content);
    }
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    const results: string[] = [];
    for (const path of this.files.keys()) {
      if (path.startsWith(directory) && path.endsWith(".ts")) {
        results.push(path);
      }
    }
    return results;
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  getAllFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, content] of this.files) {
      result[path] = content;
    }
    return result;
  }
}

/**
 * Test AI model that simulates the patch workflow.
 */
class TestAIModel implements AIModel {
  async generateResearch(context: FeatureContext): Promise<string> {
    return `# Research: ${context.featureName}\n\nResearch findings.`;
  }

  async generateReview(context: FeatureContext): Promise<string> {
    const hasCode = context.sourceFiles.length > 0;
    return `# Review: ${context.featureName}

## Summary
${hasCode ? "Feature has implementation." : "Feature needs implementation."}

## Suggestions
${hasCode ? "1. Add more tests" : "1. Implement the feature"}
`;
  }

  async generateEdits(context: FeatureContext): Promise<FileEdit[]> {
    // Simulate development: generate implementation
    return [
      {
        path: `${context.featurePath}/index.ts`,
        content: `/**
 * ${context.featureName} feature
 */
export function hello(): string {
  return "Hello from ${context.featureName}";
}
`,
      },
    ];
  }

  async generateSummary(context: FeatureContext): Promise<SummaryFile[]> {
    return [{ filename: "OVERVIEW.md", content: `# ${context.featureName}` }];
  }
}

describe("Core Integration - Patch Workflow", () => {
  const config: CoreConfig = {
    projectRoot: "/project",
    featuresDir: "/project/features",
  };

  it("runs patch workflow: review → develop", async () => {
    const fs = new TestFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal\n\nBuild a greeting feature.",
    });

    const ai = new TestAIModel();

    // Step 1: Review (before implementation)
    const reviewResult1 = await review("myfeature", config, fs, ai);
    expect(reviewResult1.featureName).toBe("myfeature");
    expect(reviewResult1.content).toContain("needs implementation");
    expect(fs.getFile("/project/features/myfeature/docs/REVIEW.md")).toContain(
      "needs implementation"
    );

    // Step 2: Develop
    const developResult = await develop("myfeature", config, fs, ai);
    expect(developResult.edits).toHaveLength(1);
    expect(fs.getFile("/project/features/myfeature/index.ts")).toContain(
      "Hello from myfeature"
    );

    // Step 3: Review (after implementation) - verifies iterative improvement
    const reviewResult2 = await review("myfeature", config, fs, ai);
    expect(reviewResult2.content).toContain("has implementation");
  });

  it("gathers context correctly for patch workflow", async () => {
    const fs = new TestFileSystem({
      "/project/features/test/GOAL.md": "# Goal\n\nTest feature.",
      "/project/features/test/index.ts": "export const x = 1;",
      "/project/features/test/docs/REVIEW.md": "# Review",
    });

    const context = await gatherFeatureContext("test", config, fs);

    expect(context.featureName).toBe("test");
    expect(context.goal.content).toBe("# Goal\n\nTest feature.");
    expect(context.review?.content).toBe("# Review");
    expect(context.sourceFiles).toHaveLength(1);
  });
});
