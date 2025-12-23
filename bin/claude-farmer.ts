#!/usr/bin/env node
/**
 * Claude Farmer CLI
 *
 * Farm your code with Claude tokens overnight.
 *
 * Usage:
 *   claude-farmer patch [working_directory] [options]
 *
 * Commands:
 *   patch  - Run Review → Develop → Commit cycle
 *
 * Options:
 *   --once               - Run once instead of looping
 *   --help               - Show this help message
 *
 * Working directory structure:
 *   <working_directory>/
 *   └── claude-farmer/
 *       ├── GOAL.md       # Human-written specification
 *       └── docs/         # Auto-generated markdown files
 */

import { resolve } from "path";
import { promises as fsPromises } from "fs";
import { join } from "path";
import { glob } from "fs/promises";
import { ClaudeCodeAI, patch } from "../features/core/index.js";
import type { FileSystem } from "../features/core/index.js";

// Node.js file system implementation
class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return fsPromises.readFile(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fsPromises.writeFile(path, content, "utf-8");
  }

  async appendFile(path: string, content: string): Promise<void> {
    await fsPromises.appendFile(path, content, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fsPromises.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    const globPattern = pattern || "**/*.ts";
    const fullPattern = join(directory, globPattern);
    const files: string[] = [];

    try {
      for await (const entry of glob(fullPattern)) {
        files.push(entry);
      }
    } catch {
      // Directory doesn't exist or no matches
    }

    return files;
  }

  async mkdir(path: string): Promise<void> {
    await fsPromises.mkdir(path, { recursive: true });
  }

  async deleteFile(path: string): Promise<void> {
    await fsPromises.unlink(path);
  }
}

function printHelp(): void {
  console.log(`
Claude Farmer - Farm your code with Claude tokens overnight

Usage:
  claude-farmer patch [working_directory] [options]

Commands:
  patch   Run Review → Develop → Commit cycle

Options:
  --once               Run once instead of looping (default: loop forever)
  --ultrathink         Enable extended thinking mode (default: off)
  --help               Show this help message

Examples:
  claude-farmer patch                           # Use current directory
  claude-farmer patch ./features/myfeature      # Specify working directory
  claude-farmer patch --once                    # Run single iteration
`);
}


async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  if (command !== "patch") {
    console.error(`Error: Unknown command "${command}"`);
    console.error("Available commands: patch");
    process.exit(1);
  }

  // Parse arguments - working_directory is optional positional arg after command
  let workingDirArg: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      workingDirArg = args[i];
      break;
    }
  }

  const once = args.includes("--once");
  const ultrathink = args.includes("--ultrathink");

  // Resolve working directory (default to current directory)
  const workingDir = workingDirArg ? resolve(workingDirArg) : process.cwd();

  const fs = new NodeFileSystem();

  const ai = new ClaudeCodeAI({
    cwd: workingDir,
    ultrathink,
  });

  console.log(`Claude Farmer - Patch command`);
  console.log(`Working directory: ${workingDir}`);
  console.log(`Mode: ${once ? "once" : "loop"}${ultrathink ? ", ultrathink" : ""}`);

  try {
    const result = await patch(workingDir, fs, ai, { once, ultrathink });
    console.log(`\nCompleted ${result.iterations} iteration(s)`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
