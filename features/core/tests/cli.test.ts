/**
 * Tests for CLI argument parsing.
 */

import { describe, it, expect } from "vitest";
import { resolve } from "path";

/**
 * CLI options interface (matches cli.ts).
 */
interface CliOptions {
  workingDir: string;
  once: boolean;
  ultrathink: boolean;
  dryRun: boolean;
}

/**
 * Parse command line arguments (extracted from cli.ts for testing).
 */
function parseArgs(args: string[], cwd: string = process.cwd()): CliOptions {
  const options: CliOptions = {
    workingDir: cwd,
    once: false,
    ultrathink: false,
    dryRun: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--once") {
      options.once = true;
    } else if (arg === "--ultrathink") {
      options.ultrathink = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (!arg.startsWith("--") && !arg.startsWith("-")) {
      options.workingDir = resolve(arg);
    }

    i++;
  }

  return options;
}

describe("CLI argument parsing", () => {
  it("uses current directory when no path specified", () => {
    const options = parseArgs([], "/home/user");
    expect(options.workingDir).toBe("/home/user");
  });

  it("resolves relative path to absolute", () => {
    const options = parseArgs(["./my-project"], "/home/user");
    expect(options.workingDir).toBe(resolve("./my-project"));
  });

  it("parses --once flag", () => {
    const options = parseArgs(["--once"]);
    expect(options.once).toBe(true);
  });

  it("parses --ultrathink flag", () => {
    const options = parseArgs(["--ultrathink"]);
    expect(options.ultrathink).toBe(true);
  });

  it("parses --dry-run flag", () => {
    const options = parseArgs(["--dry-run"]);
    expect(options.dryRun).toBe(true);
  });

  it("parses multiple flags together", () => {
    const options = parseArgs(["--once", "--ultrathink", "--dry-run"]);
    expect(options.once).toBe(true);
    expect(options.ultrathink).toBe(true);
    expect(options.dryRun).toBe(true);
  });

  it("parses path with flags in any order", () => {
    const options = parseArgs(["--once", "./project", "--dry-run"]);
    expect(options.once).toBe(true);
    expect(options.dryRun).toBe(true);
    expect(options.workingDir).toBe(resolve("./project"));
  });

  it("handles absolute paths", () => {
    const options = parseArgs(["/absolute/path/to/project"]);
    expect(options.workingDir).toBe("/absolute/path/to/project");
  });
});
