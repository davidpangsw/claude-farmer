#!/usr/bin/env node
/**
 * Claude Farmer CLI
 *
 * Farm your code with Claude tokens overnight.
 *
 * Usage:
 *   claude-farmer <command> [working_directory] [options]
 *
 * Commands:
 *   patch   - Run Review → Develop → Commit cycle
 *   develop - Run Develop task once (no review, no commit)
 *
 * Options:
 *   --ultrathink         - Enable extended thinking mode
 *   --help               - Show this help message
 */

import { resolve } from "path";
import { ClaudeCodeAI, patch, develop } from "../features/core/index.js";

function printHelp(): void {
  console.log(`
Claude Farmer - Farm your code with Claude tokens overnight

Usage:
  claude-farmer <command> [working_directory] [options]

Commands:
  patch     Run Review → Develop → Commit cycle
  develop   Run Develop task once (no review, no commit)

Options:
  --once               Run once instead of looping (patch only)
  --ultrathink         Enable extended thinking mode
  --help               Show this help message

Examples:
  claude-farmer patch                           # Use current directory
  claude-farmer patch ./features/myfeature      # Specify working directory
  claude-farmer patch --once                    # Run single iteration
  claude-farmer develop ./features/myfeature    # Run develop only
`);
}

function parseArgs(args: string[]): { workingDir: string; once: boolean; ultrathink: boolean } {
  let workingDirArg: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      workingDirArg = args[i];
      break;
    }
  }

  return {
    workingDir: workingDirArg ? resolve(workingDirArg) : process.cwd(),
    once: args.includes("--once"),
    ultrathink: args.includes("--ultrathink"),
  };
}

async function runPatch(args: string[]): Promise<void> {
  const { workingDir, once, ultrathink } = parseArgs(args);

  const ai = new ClaudeCodeAI({ cwd: workingDir, ultrathink });

  console.log(`Claude Farmer - Patch command`);
  console.log(`Working directory: ${workingDir}`);
  console.log(`Mode: ${once ? "once" : "loop"}${ultrathink ? ", ultrathink" : ""}`);

  const result = await patch(workingDir, ai, { once, ultrathink });
  console.log(`\nCompleted ${result.iterations} iteration(s)`);
}

async function runDevelop(args: string[]): Promise<void> {
  const { workingDir, ultrathink } = parseArgs(args);

  const ai = new ClaudeCodeAI({ cwd: workingDir, ultrathink });

  console.log(`Claude Farmer - Develop command`);
  console.log(`Working directory: ${workingDir}`);
  console.log(`Mode: once${ultrathink ? ", ultrathink" : ""}`);

  const result = await develop(workingDir, ai);
  console.log(`\nDevelop completed: ${result.edits.length} file(s) edited`);
  for (const edit of result.edits) {
    console.log(`  - ${edit.path}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  try {
    if (command === "patch") {
      await runPatch(args);
    } else if (command === "develop") {
      await runDevelop(args);
    } else {
      console.error(`Error: Unknown command "${command}"`);
      console.error("Available commands: patch, develop");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
