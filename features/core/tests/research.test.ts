/**
 * Tests for the research method.
 */

import { describe, it, expect } from "vitest";
import { research } from "../tasks/research/index.js";
import { MockFileSystem, MockAIModel } from "./mocks.js";
import type { CoreConfig } from "../types.js";

describe("research", () => {
  const config: CoreConfig = {
    projectRoot: "/project",
    featuresDir: "/project/features",
  };

  it("generates and writes research", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal\n\nBuild a widget.",
      "/project/features/myfeature/index.ts": "export const widget = {};",
    });

    const ai = new MockAIModel();
    ai.setResearchResponse("# Research\n\n- Found library X\n- Best practice Y");

    const result = await research("myfeature", config, fs, ai);

    expect(result.featureName).toBe("myfeature");
    expect(result.researchPath).toBe("/project/features/myfeature/docs/RESEARCH.md");
    expect(result.content).toBe("# Research\n\n- Found library X\n- Best practice Y");

    // Verify file was written
    const writtenContent = fs.getFile("/project/features/myfeature/docs/RESEARCH.md");
    expect(writtenContent).toBe("# Research\n\n- Found library X\n- Best practice Y");
  });

  it("overwrites existing research", async () => {
    const fs = new MockFileSystem({
      "/project/features/myfeature/GOAL.md": "# Goal",
      "/project/features/myfeature/docs/RESEARCH.md": "# Old Research",
    });

    const ai = new MockAIModel();
    ai.setResearchResponse("# New Research");

    await research("myfeature", config, fs, ai);

    const writtenContent = fs.getFile("/project/features/myfeature/docs/RESEARCH.md");
    expect(writtenContent).toBe("# New Research");
  });
});
