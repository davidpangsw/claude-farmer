/**
 * Tests for the develop task.
 */

import { describe, it, expect } from "vitest";
import { develop } from "../tasks/develop/index.js";
import { MockFileSystem, MockAIModel } from "./mocks.js";
import type { FileEdit } from "../types.js";

describe("develop", () => {
  it("applies edits from AI", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal\n\nBuild a widget.",
    });

    const edits: FileEdit[] = [
      {
        path: "/project/features/myfeature/widget.ts",
        content: "export class Widget {\n  render() {\n    return 'Hello';\n  }\n}",
      },
      {
        path: "/project/features/myfeature/index.ts",
        content: "export { Widget } from './widget.js';",
      },
    ];

    const ai = new MockAIModel("", edits);

    const result = await develop("/project/features/myfeature", fs, ai);

    expect(result.workingDirName).toBe("myfeature");
    expect(result.edits).toHaveLength(2);

    // Verify files were written
    expect(fs.getFile("/project/features/myfeature/widget.ts")).toBe(
      "export class Widget {\n  render() {\n    return 'Hello';\n  }\n}"
    );
    expect(fs.getFile("/project/features/myfeature/index.ts")).toBe(
      "export { Widget } from './widget.js';"
    );
  });

  it("uses review context when available", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal",
      "/project/features/myfeature/claude-farmer/docs/REVIEW.md": "# Review\n\nAdd error handling.",
      "/project/features/myfeature/index.ts": "export function doThing() {}",
    });

    const edits: FileEdit[] = [
      {
        path: "/project/features/myfeature/index.ts",
        content: "export function doThing() {\n  try {\n    // implementation\n  } catch (e) {\n    throw new Error('Failed');\n  }\n}",
      },
    ];

    const ai = new MockAIModel("", edits);

    const result = await develop("/project/features/myfeature", fs, ai);

    expect(result.edits).toHaveLength(1);
    expect(fs.getFile("/project/features/myfeature/index.ts")).toContain("catch");
  });

  it("handles empty edits", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal\n\nAlready complete.",
      "/project/features/myfeature/index.ts": "// Perfect code",
    });

    const ai = new MockAIModel("", []);

    const result = await develop("/project/features/myfeature", fs, ai);

    expect(result.edits).toHaveLength(0);
  });

  it("creates nested directories for new files", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/claude-farmer/GOAL.md": "# Goal",
    });

    const edits: FileEdit[] = [
      {
        path: "/project/features/myfeature/utils/helpers/format.ts",
        content: "export function format(s: string) { return s; }",
      },
    ];

    const ai = new MockAIModel("", edits);

    const result = await develop("/project/features/myfeature", fs, ai);

    expect(result.edits).toHaveLength(1);
    expect(fs.getFile("/project/features/myfeature/utils/helpers/format.ts")).toBeDefined();
  });
});
