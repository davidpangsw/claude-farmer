/**
 * Integration tests for the core feature.
 *
 * Tests the Patch command workflow: Review → Develop
 * (Git operations are tested separately via shell scripts)
 *
 * Working directory structure expected by the farmer:
 *   <working_directory>/
 *   └── claude-farmer/
 *       ├── GOAL.md       # Human-written specification
 *       └── docs/         # Markdown files for AI to read/write
 */

import { describe, it, expect } from "vitest";
import { gatherWorkingDirContext } from "../features/core/index.js";
import type {
  FileSystem,
  AIModel,
  WorkingDirContext,
  FileEdit,
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

  async appendFile(path: string, content: string): Promise<void> {
    const existing = this.files.get(path) || "";
    this.files.set(path, existing + content);
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

  async deleteFile(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(path);
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
 * Only implements Review and Develop (per README.md workflow).
 */
class TestAIModel implements AIModel {
  async generateReview(context: WorkingDirContext): Promise<string> {
    // Review includes research via web search, then generates suggestions
    const hasCode = context.sourceFiles.length > 0;
    return `# Review: ${context.workingDirName}

## Summary
${hasCode ? "Feature has implementation." : "Feature needs implementation."}

## Suggestions
${hasCode ? "1. Add more tests" : "1. Implement the feature"}
`;
  }

  async generateEdits(context: WorkingDirContext): Promise<FileEdit[]> {
    // Develop: implement GOAL, address REVIEW feedback
    return [
      {
        path: `${context.workingDirPath}/index.ts`,
        content: `/**
 * ${context.workingDirName} feature
 */
export function hello(): string {
  return "Hello from ${context.workingDirName}";
}
`,
      },
    ];
  }
}

describe("Core Integration - Patch Workflow", () => {
  it("runs patch workflow: review → develop", async () => {
    // Working directory with claude-farmer/GOAL.md structure
    const fs = new TestFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal\n\nBuild a greeting feature.",
    });

    const ai = new TestAIModel();
    const workingDir = "/project/features/myfeature";

    // Step 1: Review (before implementation)
    const reviewResult1 = await review(workingDir, fs, ai);
    expect(reviewResult1.workingDirName).toBe("myfeature");
    expect(reviewResult1.content).toContain("needs implementation");
    expect(fs.getFile("/project/features/myfeature/claude-farmer/docs/REVIEW.md")).toContain(
      "needs implementation"
    );

    // Step 2: Develop
    const developResult = await develop(workingDir, fs, ai);
    expect(developResult.edits).toHaveLength(1);
    expect(fs.getFile("/project/features/myfeature/index.ts")).toContain(
      "Hello from myfeature"
    );

    // Step 3: Review (after implementation) - verifies iterative improvement
    const reviewResult2 = await review(workingDir, fs, ai);
    expect(reviewResult2.content).toContain("has implementation");
  });

  it("gathers context correctly for patch workflow", async () => {
    // Working directory with claude-farmer/ structure
    const fs = new TestFileSystem({
      "/project/features/test/claude-farmer/GOAL.md": "# Goal\n\nTest feature.",
      "/project/features/test/index.ts": "export const x = 1;",
      "/project/features/test/claude-farmer/docs/REVIEW.md": "# Review",
    });

    const context = await gatherWorkingDirContext("/project/features/test", fs);

    expect(context.workingDirName).toBe("test");
    expect(context.goal.content).toBe("# Goal\n\nTest feature.");
    expect(context.review?.content).toBe("# Review");
    expect(context.sourceFiles).toHaveLength(1);
  });
});
