/**
 * Tests for the summary task.
 */

import { describe, it, expect } from "vitest";
import { summary } from "../tasks/summary/index.js";
import { MockFileSystem, MockAIModel } from "./mocks.js";
import type { CoreConfig, SummaryFile } from "../types.js";

describe("summary", () => {
  const config: CoreConfig = {
    projectRoot: "/project",
    featuresDir: "/project/features",
  };

  it("generates and writes summary files", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal\n\nBuild a widget.",
      "/project/features/myfeature/index.ts": "export const widget = {};",
    });

    const summaryFiles: SummaryFile[] = [
      { filename: "OVERVIEW.md", content: "# Overview\n\nThis feature builds a widget." },
      { filename: "sequence.puml", content: "@startuml\nA -> B\n@enduml" },
    ];

    const ai = new MockAIModel("", [], "", summaryFiles);

    const result = await summary("myfeature", config, fs, ai);

    expect(result.featureName).toBe("myfeature");
    expect(result.summaryDir).toBe("/project/features/myfeature/SUMMARY");
    expect(result.files).toHaveLength(2);

    // Verify files were written
    expect(fs.getFile("/project/features/myfeature/SUMMARY/OVERVIEW.md")).toBe(
      "# Overview\n\nThis feature builds a widget."
    );
    expect(fs.getFile("/project/features/myfeature/SUMMARY/sequence.puml")).toBe(
      "@startuml\nA -> B\n@enduml"
    );
  });

  it("handles empty summary (simple feature)", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal",
    });

    const ai = new MockAIModel("", [], "", []);

    const result = await summary("myfeature", config, fs, ai);

    expect(result.files).toHaveLength(0);
  });
});
