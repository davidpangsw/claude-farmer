/**
 * Tests for Claude Code integration.
 *
 * These tests verify the argument building and JSON parsing logic
 * without actually spawning Claude processes.
 */

import { describe, it, expect } from "vitest";
import { sep } from "path";

/**
 * Helper to build Claude CLI args (extracted from runClaudeCode logic)
 */
function buildClaudeArgs(options: {
  prompt: string;
  ultrathink?: boolean;
  model?: string;
}): string[] {
  const args = ["-p"]; // -p for headless/print mode

  if (options.model) {
    args.push("--model", options.model);
  }

  // Enable extended thinking by prepending "ultrathink:" to the prompt
  const prompt =
    options.ultrathink !== false
      ? `ultrathink: ${options.prompt}`
      : options.prompt;

  args.push(prompt);

  return args;
}

describe("Claude CLI argument building", () => {
  it("uses -p flag for headless mode (not --print)", () => {
    const args = buildClaudeArgs({ prompt: "test", ultrathink: false });

    expect(args).toContain("-p");
    expect(args).not.toContain("--print");
  });

  it("prepends ultrathink: to prompt when ultrathink is enabled (default)", () => {
    const args = buildClaudeArgs({ prompt: "test prompt" });

    // ultrathink defaults to true, so prompt should have prefix
    expect(args[args.length - 1]).toBe("ultrathink: test prompt");
    // Should NOT have --ultrathink flag (that's not a valid CLI option)
    expect(args).not.toContain("--ultrathink");
  });

  it("prepends ultrathink: to prompt when ultrathink is explicitly true", () => {
    const args = buildClaudeArgs({ prompt: "test prompt", ultrathink: true });

    expect(args[args.length - 1]).toBe("ultrathink: test prompt");
  });

  it("does NOT prepend ultrathink when ultrathink is false", () => {
    const args = buildClaudeArgs({ prompt: "test prompt", ultrathink: false });

    expect(args[args.length - 1]).toBe("test prompt");
  });

  it("includes model flag when specified", () => {
    const args = buildClaudeArgs({
      prompt: "test",
      model: "opus",
      ultrathink: false,
    });

    expect(args).toContain("--model");
    expect(args).toContain("opus");
    expect(args.indexOf("--model")).toBe(args.indexOf("opus") - 1);
  });
});

describe("JSON parsing for file edits", () => {
  /**
   * Type guard to validate FileEdit structure (matches actual implementation)
   */
  function isValidFileEdit(
    obj: unknown
  ): obj is { path: string; content: string } {
    return (
      typeof obj === "object" &&
      obj !== null &&
      typeof (obj as any).path === "string" &&
      typeof (obj as any).content === "string"
    );
  }

  /**
   * Parse file edits from output (matches actual implementation logic)
   */
  function parseFileEdits(
    output: string
  ): { path: string; content: string }[] | null {
    const jsonMatches = output.match(/\[[\s\S]*?\]/g);
    if (!jsonMatches || jsonMatches.length === 0) {
      return null;
    }

    for (let i = jsonMatches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(jsonMatches[i]);
        if (Array.isArray(parsed) && parsed.every(isValidFileEdit)) {
          return parsed;
        }
      } catch {
        // Try next match
      }
    }

    return null;
  }

  it("finds valid FileEdit array among multiple JSON arrays in output", () => {
    // Simulated output with example code in prompt AND actual result
    const output = `
Here's the implementation:

\`\`\`json
[{"path": "...", "content": "..."}]
\`\`\`

And here are the actual file edits:

[{"path": "/project/index.ts", "content": "export const x = 1;"}]
`;

    const edits = parseFileEdits(output);
    expect(edits).toEqual([
      { path: "/project/index.ts", content: "export const x = 1;" },
    ]);
  });

  it("returns last valid array when multiple valid arrays exist", () => {
    const output = `
[{"path": "/old.ts", "content": "old"}]
[{"path": "/new.ts", "content": "new"}]
`;

    const edits = parseFileEdits(output);
    // Should return the last valid one
    expect(edits).toEqual([{ path: "/new.ts", content: "new" }]);
  });

  it("skips invalid JSON and finds valid array", () => {
    const output = `
[invalid json here]
[{"path": "/valid.ts", "content": "code"}]
`;

    const edits = parseFileEdits(output);
    expect(edits).toEqual([{ path: "/valid.ts", content: "code" }]);
  });

  it("skips arrays with wrong structure", () => {
    const output = `
[1, 2, 3]
["a", "b", "c"]
[{"wrong": "structure"}]
[{"path": "/correct.ts", "content": "yes"}]
`;

    const edits = parseFileEdits(output);
    expect(edits).toEqual([{ path: "/correct.ts", content: "yes" }]);
  });

  it("returns null when no valid FileEdit array exists", () => {
    const output = `No JSON here, just text.`;
    expect(parseFileEdits(output)).toBeNull();

    const output2 = `[1, 2, 3] [{"wrong": true}]`;
    expect(parseFileEdits(output2)).toBeNull();
  });

  it("handles empty array", () => {
    const output = `[]`;
    const edits = parseFileEdits(output);
    expect(edits).toEqual([]);
  });

  it("rejects invalid FileEdit structures", () => {
    expect(isValidFileEdit({ path: "/test.ts" })).toBe(false); // missing content
    expect(isValidFileEdit({ content: "test" })).toBe(false); // missing path
    expect(isValidFileEdit({ path: 123, content: "test" })).toBe(false); // wrong type
    expect(isValidFileEdit(null)).toBe(false);
    expect(isValidFileEdit(undefined)).toBe(false);
    expect(isValidFileEdit("string")).toBe(false);
    expect(isValidFileEdit({ path: "/test.ts", content: "code" })).toBe(true);
  });

  it("handles greedy vs non-greedy regex correctly", () => {
    const output = `[1, 2] some text [3, 4]`;

    // Greedy would match entire string as one match
    const greedyMatch = output.match(/\[[\s\S]*\]/);
    expect(greedyMatch?.[0]).toBe("[1, 2] some text [3, 4]");

    // Non-greedy finds each array separately
    const nonGreedyMatches = output.match(/\[[\s\S]*?\]/g);
    expect(nonGreedyMatches).toHaveLength(2);
    expect(nonGreedyMatches?.[0]).toBe("[1, 2]");
    expect(nonGreedyMatches?.[1]).toBe("[3, 4]");
  });
});

describe("Windows path compatibility", () => {
  it("path.sep filters claude-farmer directory correctly on current platform", () => {
    // Build the filter pattern the same way context.ts does
    const pattern = `${sep}claude-farmer${sep}`;

    // Test with current platform's separator
    if (sep === "/") {
      // Unix-like system
      const unixPath =
        "/project/features/myfeature/claude-farmer/docs/test.ts";
      expect(unixPath.includes(pattern)).toBe(true);

      const nonClaudeFarmerPath = "/project/features/myfeature/src/test.ts";
      expect(nonClaudeFarmerPath.includes(pattern)).toBe(false);
    } else {
      // Windows
      const windowsPath =
        "C:\\project\\features\\myfeature\\claude-farmer\\docs\\test.ts";
      expect(windowsPath.includes(pattern)).toBe(true);

      const nonClaudeFarmerPath =
        "C:\\project\\features\\myfeature\\src\\test.ts";
      expect(nonClaudeFarmerPath.includes(pattern)).toBe(false);
    }
  });

  it("hardcoded /claude-farmer/ would fail on Windows", () => {
    // This test documents why we use sep instead of hardcoded "/"
    const hardcodedPattern = "/claude-farmer/";
    const windowsPath =
      "C:\\project\\features\\myfeature\\claude-farmer\\docs\\test.ts";

    // Hardcoded forward slashes don't match Windows backslash paths
    expect(windowsPath.includes(hardcodedPattern)).toBe(false);
  });
});
