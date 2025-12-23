#!/usr/bin/env node
/**
 * CLI entry point for claude-farmer.
 *
 * Usage: claude-farmer patch [working_directory] [options]
 *
 * Options:
 *   --once         Run once instead of looping
 *   --ultrathink   Enable extended thinking mode
 *   --dry-run      Show proposed changes without writing files or committing
 *   --version      Show version number
 */

import { patch } from "./commands/patch/index.js";
import { ClaudeCodeAI } from "./claude/index.js";
import { NodeFileSystem } from "./fs.js";
import { resolve } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliOptions {
  workingDir: string;
  once: boolean;
  ultrathink: boolean;
  dryRun: boolean;
}

/**
 * Get package version from package.json.
 */
function getVersion(): string {
  try {
    const packagePath = join(__dirname, "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    return packageJson.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Parse command line arguments.
 */
function parseArgs(args: string[]): CliOptions | null {
  const options: CliOptions = {
    workingDir: process.cwd(),
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
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--version" || arg === "-v") {
      console.log(`claude-farmer v${getVersion()}`);
      process.exit(0);
    } else if (!arg.startsWith("--") && !arg.startsWith("-")) {
      // Positional argument: working directory
      options.workingDir = resolve(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }

    i++;
  }

  return options;
}

/**
 * Print usage information.
 */
function printUsage(): void {
  console.log(`
Usage: claude-farmer patch [working_directory] [options]

Orchestrates iterative code improvement:
  1. Review - Analyze code and generate suggestions
  2. Develop - Implement improvements
  3. Commit - Save changes with meaningful message

Options:
  --once         Run once instead of looping (default: loop forever)
  --ultrathink   Enable extended thinking mode for AI
  --dry-run      Show proposed changes without writing files or committing
  --version, -v  Show version number
  --help, -h     Show this help message

Examples:
  claude-farmer patch                    # Run in current directory, loop mode
  claude-farmer patch ./my-project       # Run on specific directory
  claude-farmer patch --once             # Run single iteration
  claude-farmer patch --dry-run --once   # Preview changes without applying
`);
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  // Skip "node" and script path, handle "patch" subcommand
  const args = process.argv.slice(2);

  // Check for version flag at top level
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`claude-farmer v${getVersion()}`);
    process.exit(0);
  }

  // Check for subcommand
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const subcommand = args[0];
  if (subcommand !== "patch") {
    console.error(`Unknown command: ${subcommand}`);
    console.error('Available commands: patch');
    printUsage();
    process.exit(1);
  }

  // Parse remaining arguments
  const options = parseArgs(args.slice(1));
  if (!options) {
    process.exit(1);
  }

  console.log(`claude-farmer: Starting patch on ${options.workingDir}`);
  if (options.once) console.log("  Mode: single iteration");
  if (options.ultrathink) console.log("  Extended thinking: enabled");
  if (options.dryRun) console.log("  Dry run: enabled");

  const fs = new NodeFileSystem();
  const ai = new ClaudeCodeAI({
    cwd: options.workingDir,
    ultrathink: options.ultrathink,
  });

  try {
    const result = await patch(options.workingDir, fs, ai, {
      once: options.once,
      ultrathink: options.ultrathink,
      dryRun: options.dryRun,
    });

    console.log(`\nclaude-farmer: Completed ${result.iterations} iteration(s)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nclaude-farmer: Error - ${message}`);
    process.exit(1);
  }
}

main();
